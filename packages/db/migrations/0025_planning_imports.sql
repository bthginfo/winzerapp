CREATE TABLE app.resource_booking (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id),id uuid NOT NULL DEFAULT gen_random_uuid(),resource_id uuid NOT NULL,vessel_id uuid,project_id uuid,
 title text NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),route text NOT NULL,status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','doing','done','cancelled')),version integer NOT NULL DEFAULT 1,
 created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,resource_id) REFERENCES app.resource(tenant_id,id),FOREIGN KEY(tenant_id,vessel_id) REFERENCES app.vessel(tenant_id,id),FOREIGN KEY(tenant_id,project_id) REFERENCES app.blend_project(tenant_id,id)
);
ALTER TABLE app.resource_booking ENABLE ROW LEVEL SECURITY;ALTER TABLE app.resource_booking FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_access ON app.resource_booking USING(app.current_member(tenant_id) AND app.role()<>'external');
CREATE FUNCTION app.schedule_resource(tid uuid,actor text,key text,body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE op app.operation;h text:=encode(public.digest(body::text,'sha256'),'hex');eid uuid;current_version integer;reply jsonb;
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);PERFORM app.require_role(ARRAY['owner','oenologist','cellar','vineyard']);IF NOT app.is_member(tid) OR length(key) NOT BETWEEN 8 AND 120 THEN PERFORM app.fail('FORBIDDEN');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0));SELECT * INTO op FROM app.operation WHERE tenant_id=tid AND idempotency_key=key;IF FOUND THEN IF op.payload_hash<>h THEN PERFORM app.fail('IDEMPOTENCY_CONFLICT');END IF;RETURN op.result;END IF;
 IF body->>'id' IS NOT NULL THEN SELECT version INTO current_version FROM app.resource_booking WHERE tenant_id=tid AND id=(body->>'id')::uuid FOR UPDATE;IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND');END IF;PERFORM app.require_version(current_version,body->'expected_version');UPDATE app.resource_booking SET status=body->>'status',version=version+1 WHERE tenant_id=tid AND id=(body->>'id')::uuid RETURNING id INTO eid;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM app.resource WHERE tenant_id=tid AND id=(body->>'resource_id')::uuid AND status='ready') THEN PERFORM app.fail('RESOURCE_BLOCKED');END IF;
  IF EXISTS(SELECT 1 FROM app.resource_booking WHERE tenant_id=tid AND resource_id=(body->>'resource_id')::uuid AND status IN ('planned','doing') AND starts_at<(body->>'ends_at')::timestamptz AND ends_at>(body->>'starts_at')::timestamptz) OR EXISTS(SELECT 1 FROM app.harvest_plan WHERE tenant_id=tid AND resource_id=(body->>'resource_id')::uuid AND status IN ('planned','in_progress') AND starts_at<(body->>'ends_at')::timestamptz AND ends_at>(body->>'starts_at')::timestamptz) THEN PERFORM app.fail('RESOURCE_CONFLICT');END IF;
  IF body->>'vessel_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app.vessel WHERE tenant_id=tid AND id=(body->>'vessel_id')::uuid AND status='ready') THEN PERFORM app.fail('VESSEL_BLOCKED');END IF;
  IF body->>'vessel_id' IS NOT NULL AND EXISTS(SELECT 1 FROM app.resource_booking WHERE tenant_id=tid AND vessel_id=(body->>'vessel_id')::uuid AND status IN ('planned','doing') AND starts_at<(body->>'ends_at')::timestamptz AND ends_at>(body->>'starts_at')::timestamptz) THEN PERFORM app.fail('RESOURCE_CONFLICT');END IF;
  INSERT INTO app.resource_booking(tenant_id,resource_id,vessel_id,project_id,title,starts_at,ends_at,route,created_by) VALUES(tid,(body->>'resource_id')::uuid,(body->>'vessel_id')::uuid,(body->>'project_id')::uuid,body->>'title',(body->>'starts_at')::timestamptz,(body->>'ends_at')::timestamptz,body->>'route',actor) RETURNING id INTO eid;
 END IF;
 reply:=jsonb_build_object('id',eid);INSERT INTO app.operation(tenant_id,kind,idempotency_key,payload_hash,payload,occurred_at,actor_id,result) VALUES(tid,'resource_booking',key,h,body,now(),actor,reply);INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,'resource_booking',eid,body);INSERT INTO app.outbox(tenant_id,event_type,aggregate_id,data) VALUES(tid,'resource_booking.completed',eid,reply);RETURN reply;
END $$;
REVOKE ALL ON FUNCTION app.schedule_resource(uuid,text,text,jsonb) FROM PUBLIC;GRANT EXECUTE ON FUNCTION app.schedule_resource(uuid,text,text,jsonb) TO vinea_runtime;
CREATE OR REPLACE FUNCTION app.profile_import(tid uuid,actor text,key text,body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE batch app.import_batch; op app.operation; h text:=encode(public.digest(body::text,'sha256'),'hex'); eid uuid; reply jsonb; item jsonb; row_report jsonb:='[]'; line integer:=0; nested jsonb; expected_type text;
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);PERFORM app.require_role(ARRAY['owner','oenologist','office']);
 IF NOT app.is_member(tid) OR length(key) NOT BETWEEN 8 AND 120 THEN PERFORM app.fail('FORBIDDEN'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0));
 SELECT * INTO op FROM app.operation WHERE tenant_id=tid AND idempotency_key=key;
 IF FOUND THEN IF op.payload_hash<>h THEN PERFORM app.fail('IDEMPOTENCY_CONFLICT'); END IF; RETURN op.result; END IF;
 IF body->>'type'='profile_validate' THEN
  IF body->>'profile' NOT IN ('analyses','vineyards','vessels','materials','skus','harvests','field','weather') OR jsonb_array_length(body->'rows')>5000 OR length(body->>'original')>3000000 THEN PERFORM app.fail('INVALID_IMPORT'); END IF;
  IF EXISTS(SELECT 1 FROM app.import_batch WHERE tenant_id=tid AND file_hash=body->>'file_hash' AND kind=body->>'profile' AND mapping<>body->'mapping') THEN PERFORM app.fail('IMPORT_MAPPING_CONFLICT'); END IF;
  INSERT INTO app.import_batch(tenant_id,file_hash,filename,kind,original,mapping,rows,created_by) VALUES(tid,body->>'file_hash',body->>'filename',body->>'profile',body->>'original',body->'mapping',body->'rows',actor) ON CONFLICT(tenant_id,file_hash,kind) DO NOTHING;
  SELECT * INTO batch FROM app.import_batch WHERE tenant_id=tid AND file_hash=body->>'file_hash' AND kind=body->>'profile';
  eid:=batch.id;reply:=jsonb_build_object('state',batch.state,'report',batch.report);
 ELSIF body->>'type'='profile_commit' THEN
  SELECT * INTO batch FROM app.import_batch WHERE tenant_id=tid AND id=(body->>'batch_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  eid:=batch.id;
  IF batch.kind NOT IN ('analyses','vineyards','vessels','materials','skus','harvests','field','weather') THEN PERFORM app.fail('INVALID_IMPORT'); END IF;
  IF batch.state='committed' THEN reply:=jsonb_build_object('report',batch.report,'duplicate',true);
  ELSE
   expected_type:=CASE batch.kind WHEN 'analyses' THEN 'analysis_add' WHEN 'vineyards' THEN 'vineyard_create' WHEN 'vessels' THEN 'vessel_create' WHEN 'materials' THEN 'material_create' WHEN 'skus' THEN 'sku_create' WHEN 'harvests' THEN 'harvest_create' WHEN 'field' THEN 'field_record' WHEN 'weather' THEN 'weather_record' END;
   FOR item IN SELECT * FROM jsonb_array_elements(batch.rows) LOOP
    line:=line+1;
    BEGIN
     IF item ? 'error' OR item->'command'->>'type' IS DISTINCT FROM expected_type THEN PERFORM app.fail('INVALID_IMPORT_ROW'); END IF;
     -- A narrow import capability authorizes only the fixed creation command for this row.
     PERFORM set_config('app.import_command',expected_type,true);
     SELECT app.command(tid,actor,'profile-'||batch.id::text||'-'||line::text,item->'command') INTO nested;
     PERFORM set_config('app.import_command','',true);
     row_report:=row_report||jsonb_build_array(jsonb_build_object('row',line+1,'status','imported','id',nested->>'id'));
    EXCEPTION WHEN OTHERS THEN PERFORM set_config('app.import_command','',true);row_report:=row_report||jsonb_build_array(jsonb_build_object('row',line+1,'status','error','error',coalesce(substring(SQLERRM FROM '[A-Z][A-Z_]{4,}'),'IMPORT_ROW_FAILED'))); END;
   END LOOP;
   UPDATE app.import_batch SET state='committed',report=row_report WHERE tenant_id=tid AND id=batch.id;
   reply:=jsonb_build_object('report',row_report,'duplicate',false);
  END IF;
 ELSE PERFORM app.fail('INVALID_IMPORT'); END IF;
 INSERT INTO app.operation(tenant_id,kind,idempotency_key,payload_hash,payload,occurred_at,actor_id,result) VALUES(tid,body->>'type',key,h,body,now(),actor,reply) RETURNING * INTO op;
 reply:=reply||jsonb_build_object('id',eid,'operation_id',op.id);
 UPDATE app.operation SET result=reply WHERE tenant_id=tid AND id=op.id;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,body->>'type',eid,jsonb_build_object('operation_id',op.id));
 RETURN reply;
END $$;
REVOKE ALL ON FUNCTION app.profile_import(uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.profile_import(uuid,text,text,jsonb) TO vinea_runtime;

CREATE OR REPLACE FUNCTION app.require_role(roles text[]) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF NOT coalesce(app.role()=ANY(roles),false) AND NOT coalesce(app.role()='office' AND current_setting('app.import_command',true) IN ('vineyard_create','vessel_create','material_create','sku_create','harvest_create','field_record','analysis_add','weather_record'),false) THEN PERFORM app.fail('FORBIDDEN'); END IF;
END $$;
