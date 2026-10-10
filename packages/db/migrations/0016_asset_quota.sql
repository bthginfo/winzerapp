CREATE OR REPLACE FUNCTION app.store_asset(tid uuid,actor text,meta jsonb,base64 text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE new_id uuid; bytes bytea:=decode(base64,'base64');
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);
 IF NOT app.is_member(tid) THEN PERFORM app.fail('FORBIDDEN');END IF;
 PERFORM app.require_role(ARRAY['owner','oenologist','cellar','vineyard','office']);
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0));
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
