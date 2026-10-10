CREATE TABLE app.demo_receipt (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id),event_id uuid NOT NULL,external_id text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,event_id),FOREIGN KEY(tenant_id,event_id) REFERENCES app.outbox(tenant_id,id)
);
ALTER TABLE app.demo_receipt ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.demo_receipt FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON app.demo_receipt USING(app.current_member(tenant_id) AND app.role() IN ('owner','oenologist','office'));
CREATE FUNCTION app.process_jobs(tid uuid,actor text,max_jobs integer DEFAULT 20) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE job app.outbox; receipt app.demo_receipt; count_done integer:=0; count_retry integer:=0; count_ambiguous integer:=0;
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);
 IF NOT app.is_member(tid) THEN PERFORM app.fail('FORBIDDEN'); END IF;
 PERFORM app.require_role(ARRAY['owner','oenologist','office']);
 IF max_jobs<1 OR max_jobs>100 THEN PERFORM app.fail('INVALID_COMMAND'); END IF;
 FOR job IN SELECT * FROM app.outbox WHERE tenant_id=tid AND ((status IN ('queued','retrying','ambiguous') AND available_at<=now()) OR (status='running' AND locked_at<now()-interval '10 minutes')) ORDER BY created_at,id LIMIT max_jobs FOR UPDATE SKIP LOCKED LOOP
  -- Always reconcile a prior receipt before attempting any potentially ambiguous write.
  SELECT * INTO receipt FROM app.demo_receipt WHERE tenant_id=tid AND event_id=job.id;
  IF FOUND THEN UPDATE app.outbox SET status='succeeded',locked_at=NULL,last_error=NULL WHERE tenant_id=tid AND id=job.id;count_done:=count_done+1;CONTINUE; END IF;
  UPDATE app.outbox SET status='running',attempts=attempts+1,locked_at=now() WHERE tenant_id=tid AND id=job.id;
  IF job.data->>'demo_behavior'='transient' AND job.attempts=0 THEN
   UPDATE app.outbox SET status='retrying',locked_at=NULL,available_at=now()+interval '2 seconds',last_error='DEMO_TRANSIENT_ERROR' WHERE tenant_id=tid AND id=job.id;count_retry:=count_retry+1;CONTINUE;
  END IF;
  IF job.attempts>=5 THEN UPDATE app.outbox SET status='failed',locked_at=NULL,last_error='RETRY_LIMIT' WHERE tenant_id=tid AND id=job.id;CONTINUE;END IF;
  INSERT INTO app.demo_receipt(tenant_id,event_id,external_id,result) VALUES(tid,job.id,'demo-'||job.id,jsonb_build_object('adapter','demo-erp','transmitted_externally',false,'event_id',job.id));
  IF job.data->>'demo_behavior'='ambiguous' THEN
   UPDATE app.outbox SET status='ambiguous',locked_at=NULL,last_error='DEMO_TIMEOUT_AFTER_ACCEPT' WHERE tenant_id=tid AND id=job.id;count_ambiguous:=count_ambiguous+1;
  ELSE UPDATE app.outbox SET status='succeeded',locked_at=NULL,last_error=NULL WHERE tenant_id=tid AND id=job.id;count_done:=count_done+1;END IF;
 END LOOP;
 RETURN jsonb_build_object('adapter','demo-erp','succeeded',count_done,'retrying',count_retry,'ambiguous',count_ambiguous,'transmitted_externally',false);
END $$;
REVOKE ALL ON FUNCTION app.process_jobs(uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.process_jobs(uuid,text,integer) TO vinea_runtime;
GRANT SELECT ON app.demo_receipt TO vinea_runtime;

CREATE TABLE app.asset (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id),id uuid NOT NULL DEFAULT gen_random_uuid(),lot_id uuid,vineyard_id uuid,filename text NOT NULL,mime_type text NOT NULL,
 content bytea NOT NULL CHECK(octet_length(content)<=2097152),sha256 text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,lot_id) REFERENCES app.lot(tenant_id,id),FOREIGN KEY(tenant_id,vineyard_id) REFERENCES app.vineyard(tenant_id,id)
);
ALTER TABLE app.asset ENABLE ROW LEVEL SECURITY;ALTER TABLE app.asset FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON app.asset USING(app.current_member(tenant_id) AND app.role()<>'external');
CREATE FUNCTION app.store_asset(tid uuid,actor text,meta jsonb,base64 text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE new_id uuid; bytes bytea:=decode(base64,'base64');
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);
 IF NOT app.is_member(tid) THEN PERFORM app.fail('FORBIDDEN');END IF;
 PERFORM app.require_role(ARRAY['owner','oenologist','cellar','vineyard','office']);
 IF octet_length(bytes)>2097152 OR octet_length(bytes)=0 THEN PERFORM app.fail('ASSET_TOO_LARGE');END IF;
 IF coalesce((SELECT sum(octet_length(content)) FROM app.asset WHERE tenant_id=tid),0)+octet_length(bytes)>33554432 THEN PERFORM app.fail('ASSET_QUOTA');END IF;
 INSERT INTO app.asset(tenant_id,lot_id,vineyard_id,filename,mime_type,content,sha256,created_by)
 VALUES(tid,(meta->>'lot_id')::uuid,(meta->>'vineyard_id')::uuid,meta->>'filename',meta->>'mime_type',bytes,encode(public.digest(bytes,'sha256'),'hex'),actor) RETURNING id INTO new_id;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,'asset.created',new_id,meta);
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION app.store_asset(uuid,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.store_asset(uuid,text,jsonb,text) TO vinea_runtime;
GRANT SELECT ON app.asset TO vinea_runtime;
