CREATE TABLE app.integration_delivery (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id),id uuid NOT NULL DEFAULT gen_random_uuid(),connection_id uuid NOT NULL,bottling_id uuid NOT NULL,
 payload jsonb NOT NULL,status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','ambiguous','succeeded','failed')),attempts integer NOT NULL DEFAULT 0,locked_at timestamptz,claim text,external_id text,last_error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,connection_id,bottling_id),FOREIGN KEY(tenant_id,connection_id) REFERENCES app.connection(tenant_id,id),FOREIGN KEY(tenant_id,bottling_id) REFERENCES app.bottling(tenant_id,id)
);
ALTER TABLE app.integration_delivery ENABLE ROW LEVEL SECURITY;ALTER TABLE app.integration_delivery FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_access ON app.integration_delivery USING(app.current_member(tenant_id) AND app.role() IN ('owner','oenologist','office'));
CREATE FUNCTION app.delivery_enqueue(tid uuid,actor text,cid uuid,bid uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE eid uuid;b app.bottling;ref text;
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);PERFORM app.require_role(ARRAY['owner','oenologist','office']);IF NOT app.is_member(tid) THEN PERFORM app.fail('FORBIDDEN');END IF;
 IF NOT EXISTS(SELECT 1 FROM app.connection WHERE tenant_id=tid AND id=cid AND adapter='contract-api' AND enabled AND configuration->'contract'->'outbound'->>'confirmed'='true') THEN PERFORM app.fail('DOCUMENTED_CONTRACT_REQUIRED');END IF;
 SELECT * INTO b FROM app.bottling WHERE tenant_id=tid AND id=bid;IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND');END IF;
 SELECT external_id INTO ref FROM app.external_reference WHERE tenant_id=tid AND connection_id=cid AND entity_type='sku' AND internal_id=b.sku_id;
 IF ref IS NULL THEN SELECT nullif(erp_reference,'') INTO ref FROM app.sku WHERE tenant_id=tid AND id=b.sku_id;END IF;IF ref IS NULL THEN PERFORM app.fail('ERP_REFERENCE_REQUIRED');END IF;
 INSERT INTO app.integration_delivery(tenant_id,connection_id,bottling_id,payload,created_by) VALUES(tid,cid,bid,jsonb_build_object('schema_version',1,'event_type','bottling.completed','bottling_id',bid,'code',b.code,'sku_external_id',ref,'lot_id',b.lot_id,'bottle_count',b.bottle_count,'fill_l',b.fill_l::text,'loss_l',b.loss_l::text,'occurred_at',b.occurred_at,'stock_authority',b.stock_authority,'materials',coalesce((SELECT jsonb_agg(jsonb_build_object('material_id',m.material_id,'external_id',(SELECT external_id FROM app.external_reference WHERE tenant_id=tid AND connection_id=cid AND entity_type='material' AND internal_id=m.material_id),'quantity',m.quantity::text,'batch',m.batch)) FROM app.material_movement m WHERE tenant_id=tid AND bottling_id=bid),'[]'::jsonb),'costs',coalesce((SELECT jsonb_agg(jsonb_build_object('category',category,'amount',amount::text,'currency',currency,'basis',basis,'description',description)) FROM app.cost_entry WHERE tenant_id=tid AND bottling_id=bid),'[]'::jsonb)),actor) ON CONFLICT(tenant_id,connection_id,bottling_id) DO NOTHING;
 SELECT id INTO eid FROM app.integration_delivery WHERE tenant_id=tid AND connection_id=cid AND bottling_id=bid;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,'erp.delivery_requested',eid,jsonb_build_object('connection_id',cid,'bottling_id',bid));RETURN eid;
END $$;
CREATE FUNCTION app.delivery_claim(tid uuid,actor text) RETURNS SETOF app.integration_delivery LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE job app.integration_delivery;
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);PERFORM app.require_role(ARRAY['owner','oenologist','office']);IF NOT app.is_member(tid) THEN PERFORM app.fail('FORBIDDEN');END IF;
 SELECT * INTO job FROM app.integration_delivery d WHERE d.tenant_id=tid AND (d.status IN ('queued','ambiguous') OR (d.status='running' AND d.locked_at<now()-interval '5 minutes')) AND EXISTS(SELECT 1 FROM app.connection c WHERE c.tenant_id=tid AND c.id=d.connection_id AND c.enabled) ORDER BY d.updated_at LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN;END IF;
 IF job.attempts>=5 THEN UPDATE app.integration_delivery SET status='failed',last_error='RETRY_LIMIT',locked_at=NULL WHERE tenant_id=tid AND id=job.id;RETURN;END IF;
 RETURN QUERY UPDATE app.integration_delivery SET status='running',attempts=attempts+1,claim=gen_random_uuid()::text,locked_at=now(),updated_at=now() WHERE tenant_id=tid AND id=job.id RETURNING *;
END $$;
CREATE FUNCTION app.delivery_finish(tid uuid,actor text,eid uuid,claim_key text,result jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);PERFORM app.require_role(ARRAY['owner','oenologist','office']);IF NOT app.is_member(tid) OR result->>'status' NOT IN ('succeeded','ambiguous','failed') THEN PERFORM app.fail('FORBIDDEN');END IF;
 UPDATE app.integration_delivery SET status=result->>'status',external_id=result->>'external_id',last_error=result->>'error',locked_at=NULL,claim=NULL,updated_at=now() WHERE tenant_id=tid AND id=eid AND claim=claim_key AND status='running';IF NOT FOUND THEN PERFORM app.fail('VERSION_CONFLICT');END IF;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,'erp.delivery_result',eid,result);
END $$;
CREATE FUNCTION app.delivery_tenants() RETURNS TABLE(tenant_id uuid,user_id text) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT DISTINCT d.tenant_id,(SELECT m.user_id FROM app.membership m WHERE m.tenant_id=d.tenant_id AND m.role='owner' ORDER BY m.created_at LIMIT 1) FROM app.integration_delivery d WHERE d.status IN ('queued','ambiguous','running') LIMIT 10
$$;
REVOKE ALL ON FUNCTION app.delivery_enqueue(uuid,text,uuid,uuid),app.delivery_claim(uuid,text),app.delivery_finish(uuid,text,uuid,text,jsonb),app.delivery_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.delivery_enqueue(uuid,text,uuid,uuid),app.delivery_claim(uuid,text),app.delivery_finish(uuid,text,uuid,text,jsonb),app.delivery_tenants() TO vinea_runtime;
