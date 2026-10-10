ALTER TABLE app.connection DROP CONSTRAINT connection_adapter_check;
ALTER TABLE app.connection ADD CONSTRAINT connection_adapter_check CHECK(adapter IN ('file','sensor','brightsky','openai-compatible','winestro','vintrace','contract-api'));
ALTER TABLE app.connection ADD COLUMN configuration jsonb NOT NULL DEFAULT '{}';
CREATE TABLE app.connection_secret(tenant_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),connection_id uuid NOT NULL,ciphertext text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),created_by text NOT NULL,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,connection_id),FOREIGN KEY(tenant_id,connection_id) REFERENCES app.connection(tenant_id,id));
ALTER TABLE app.connection_secret ENABLE ROW LEVEL SECURITY;ALTER TABLE app.connection_secret FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_access ON app.connection_secret USING(tenant_id=app.tenant_id() AND app.is_member(tenant_id) AND app.role()='owner') WITH CHECK(tenant_id=app.tenant_id() AND app.is_member(tenant_id) AND app.role()='owner');
CREATE TABLE app.tenant_settings(tenant_id uuid NOT NULL REFERENCES app.tenant(id),id uuid NOT NULL DEFAULT gen_random_uuid(),country text NOT NULL DEFAULT 'DE',region text NOT NULL DEFAULT '',modules jsonb NOT NULL DEFAULT '[]',retention_days integer NOT NULL DEFAULT 3650 CHECK(retention_days BETWEEN 30 AND 36500),version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),created_by text NOT NULL,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id));
ALTER TABLE app.tenant_settings ENABLE ROW LEVEL SECURITY;ALTER TABLE app.tenant_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_access ON app.tenant_settings USING(tenant_id=app.tenant_id() AND app.is_member(tenant_id) AND app.role()<>'external') WITH CHECK(tenant_id=app.tenant_id() AND app.is_member(tenant_id) AND app.role()<>'external');
CREATE TABLE app.integration_snapshot(tenant_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),connection_id uuid NOT NULL,source text NOT NULL,data jsonb NOT NULL,fetched_at timestamptz NOT NULL DEFAULT now(),created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,connection_id) REFERENCES app.connection(tenant_id,id));
ALTER TABLE app.integration_snapshot ENABLE ROW LEVEL SECURITY;ALTER TABLE app.integration_snapshot FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_access ON app.integration_snapshot USING(tenant_id=app.tenant_id() AND app.is_member(tenant_id) AND app.role()<>'external') WITH CHECK(tenant_id=app.tenant_id() AND app.is_member(tenant_id) AND app.role()<>'external');
CREATE TRIGGER immutable_snapshot BEFORE UPDATE OR DELETE ON app.integration_snapshot FOR EACH ROW EXECUTE FUNCTION app.immutable_history();
CREATE TABLE app.ai_usage(tenant_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),connection_id uuid NOT NULL,status text NOT NULL CHECK(status IN ('pending','succeeded','failed')),input_tokens integer,output_tokens integer,request_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),created_by text NOT NULL,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,request_id),FOREIGN KEY(tenant_id,connection_id) REFERENCES app.connection(tenant_id,id));
ALTER TABLE app.ai_usage ENABLE ROW LEVEL SECURITY;ALTER TABLE app.ai_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_access ON app.ai_usage USING(tenant_id=app.tenant_id() AND app.is_member(tenant_id) AND app.role()<>'external') WITH CHECK(tenant_id=app.tenant_id() AND app.is_member(tenant_id) AND app.role()<>'external');
CREATE FUNCTION app.configure_connection(tid uuid,actor text,cid uuid,body jsonb,cipher text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE eid uuid;
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);IF NOT app.is_member(tid) OR app.role()<>'owner' THEN PERFORM app.fail('FORBIDDEN'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0));
 IF cid IS NULL THEN INSERT INTO app.connection(tenant_id,name,adapter,capabilities,authority,configuration,enabled,created_by) VALUES(tid,body->>'name',body->>'adapter',body->'capabilities',body->'authority',body->'configuration',(body->>'enabled')::boolean,actor) RETURNING id INTO eid;
 ELSE
  PERFORM app.require_version((SELECT version FROM app.connection WHERE tenant_id=tid AND id=cid),body->'expected_version');
  UPDATE app.connection SET name=body->>'name',adapter=body->>'adapter',capabilities=body->'capabilities',authority=body->'authority',configuration=body->'configuration',enabled=(body->>'enabled')::boolean,version=version+1 WHERE tenant_id=tid AND id=cid RETURNING id INTO eid;
  IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
 END IF;
 IF cipher IS NOT NULL THEN INSERT INTO app.connection_secret(tenant_id,connection_id,ciphertext,created_by) VALUES(tid,eid,cipher,actor) ON CONFLICT(tenant_id,connection_id) DO UPDATE SET ciphertext=excluded.ciphertext,created_at=now(),created_by=actor; END IF;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,'connection.configured',eid,body);
 RETURN eid;
END $$;
CREATE FUNCTION app.read_connection(tid uuid,actor text,cid uuid) RETURNS TABLE(adapter text,configuration jsonb,ciphertext text,enabled boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);IF NOT app.is_member(tid) OR app.role() NOT IN ('owner','oenologist','office') THEN PERFORM app.fail('FORBIDDEN'); END IF;
 RETURN QUERY SELECT c.adapter,c.configuration,s.ciphertext,c.enabled FROM app.connection c LEFT JOIN app.connection_secret s ON s.tenant_id=c.tenant_id AND s.connection_id=c.id WHERE c.tenant_id=tid AND c.id=cid;
END $$;
CREATE FUNCTION app.integration_record(tid uuid,actor text,cid uuid,source_url text,payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE eid uuid;
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);IF NOT app.is_member(tid) THEN PERFORM app.fail('FORBIDDEN'); END IF;PERFORM app.require_role(ARRAY['owner','oenologist','office']);
 IF NOT EXISTS(SELECT 1 FROM app.connection WHERE tenant_id=tid AND id=cid AND enabled) THEN PERFORM app.fail('CONNECTION_DISABLED'); END IF;
 IF length(payload::text)>3000000 THEN PERFORM app.fail('IMPORT_TOO_LARGE'); END IF;
 INSERT INTO app.integration_snapshot(tenant_id,connection_id,source,data,created_by) VALUES(tid,cid,source_url,payload,actor) RETURNING id INTO eid;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,'integration.read',eid,jsonb_build_object('connection_id',cid));RETURN eid;
END $$;
CREATE FUNCTION app.configure_tenant(tid uuid,actor text,body jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE observed integer;
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);IF NOT app.is_member(tid) OR app.role()<>'owner' THEN PERFORM app.fail('FORBIDDEN'); END IF;PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0));
 SELECT version INTO observed FROM app.tenant_settings WHERE tenant_id=tid FOR UPDATE;
 IF FOUND THEN PERFORM app.require_version(observed,body->'expected_version'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=body->>'timezone') THEN PERFORM app.fail('INVALID_TIMEZONE'); END IF;
 UPDATE app.tenant SET timezone=body->>'timezone',mode=body->>'mode' WHERE id=tid;
 INSERT INTO app.tenant_settings(tenant_id,country,region,modules,retention_days,created_by) VALUES(tid,body->>'country',body->>'region',body->'modules',(body->>'retention_days')::int,actor) ON CONFLICT(tenant_id) DO UPDATE SET country=excluded.country,region=excluded.region,modules=excluded.modules,retention_days=excluded.retention_days,version=app.tenant_settings.version+1 RETURNING version INTO observed;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,'tenant.configured',tid,body);RETURN observed;
END $$;
CREATE FUNCTION app.ai_claim(tid uuid,actor text,cid uuid,rid text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE eid uuid; maximum integer;
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);IF NOT app.is_member(tid) OR app.role()='external' THEN PERFORM app.fail('FORBIDDEN'); END IF;PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0));
 SELECT coalesce((configuration->>'daily_requests')::int,20) INTO maximum FROM app.connection WHERE tenant_id=tid AND id=cid AND enabled AND adapter='openai-compatible';IF NOT FOUND THEN PERFORM app.fail('CONNECTION_DISABLED'); END IF;
 IF EXISTS(SELECT 1 FROM app.ai_usage WHERE tenant_id=tid AND request_id=rid) THEN PERFORM app.fail('AI_REQUEST_ALREADY_USED'); END IF;
 IF (SELECT count(*) FROM app.ai_usage WHERE tenant_id=tid AND connection_id=cid AND created_at>date_trunc('day',now()))>=maximum THEN PERFORM app.fail('AI_DAILY_LIMIT'); END IF;
 INSERT INTO app.ai_usage(tenant_id,connection_id,status,request_id,created_by) VALUES(tid,cid,'pending',rid,actor) RETURNING id INTO eid;RETURN eid;
END $$;
CREATE FUNCTION app.ai_finish(tid uuid,actor text,eid uuid,status_value text,input_count integer,output_count integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);IF NOT app.is_member(tid) THEN PERFORM app.fail('FORBIDDEN'); END IF;
 UPDATE app.ai_usage SET status=status_value,input_tokens=input_count,output_tokens=output_count WHERE tenant_id=tid AND id=eid AND created_by=actor AND status='pending';
END $$;
CREATE FUNCTION app.ingest_sensor(hash text,message_id text,records jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE s app.sensor; item jsonb; reply jsonb:='[]'; result jsonb;
BEGIN
 SELECT * INTO s FROM app.sensor WHERE token_hash=hash AND enabled;IF NOT FOUND THEN PERFORM app.fail('FORBIDDEN'); END IF;
 IF jsonb_array_length(records)>100 OR length(message_id) NOT BETWEEN 8 AND 100 THEN PERFORM app.fail('INVALID_COMMAND'); END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(records) LOOP
  result:=app.command(s.tenant_id,s.created_by,'sensor-'||encode(public.digest(s.id::text||message_id||item::text,'sha256'),'hex'),jsonb_build_object('type','analysis_add','lot_id',s.lot_id,'sample_code','sensor-'||s.id::text||'-'||encode(public.digest(item->>'measured_at','sha256'),'hex'),'sampled_at',item->>'measured_at','parameter',s.parameter,'value',item->>'value','unit',s.unit,'method',s.method,'measured_at',item->>'measured_at','quality','measured','source','laboratory'));
  reply:=reply||jsonb_build_array(result);
 END LOOP;RETURN reply;
END $$;
REVOKE ALL ON FUNCTION app.configure_connection(uuid,text,uuid,jsonb,text),app.read_connection(uuid,text,uuid),app.integration_record(uuid,text,uuid,text,jsonb),app.configure_tenant(uuid,text,jsonb),app.ai_claim(uuid,text,uuid,text),app.ai_finish(uuid,text,uuid,text,integer,integer),app.ingest_sensor(text,text,jsonb) FROM PUBLIC;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO vinea_runtime;
GRANT EXECUTE ON FUNCTION app.configure_connection(uuid,text,uuid,jsonb,text),app.read_connection(uuid,text,uuid),app.integration_record(uuid,text,uuid,text,jsonb),app.configure_tenant(uuid,text,jsonb),app.ai_claim(uuid,text,uuid,text),app.ai_finish(uuid,text,uuid,text,integer,integer),app.ingest_sensor(text,text,jsonb) TO vinea_runtime;
