CREATE TABLE app.import_profile(tenant_id uuid NOT NULL REFERENCES app.tenant(id),id uuid NOT NULL DEFAULT gen_random_uuid(),name text NOT NULL,profile text NOT NULL,revision integer NOT NULL,mapping jsonb NOT NULL,decimal_separator text NOT NULL CHECK(decimal_separator IN ('.',',')),created_at timestamptz NOT NULL DEFAULT now(),created_by text NOT NULL,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,name,revision));
ALTER TABLE app.import_profile ENABLE ROW LEVEL SECURITY;ALTER TABLE app.import_profile FORCE ROW LEVEL SECURITY;CREATE POLICY tenant_access ON app.import_profile USING(app.current_member(tenant_id) AND app.role() IN ('owner','oenologist','office'));
CREATE TRIGGER immutable_profile BEFORE UPDATE OR DELETE ON app.import_profile FOR EACH ROW EXECUTE FUNCTION app.immutable_history();
CREATE FUNCTION app.save_import_profile(tid uuid,actor text,body jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE eid uuid;revision integer;
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);PERFORM app.require_role(ARRAY['owner','oenologist','office']);IF NOT app.is_member(tid) THEN PERFORM app.fail('FORBIDDEN');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0));SELECT coalesce(max(p.revision),0)+1 INTO revision FROM app.import_profile p WHERE tenant_id=tid AND name=body->>'name';
 INSERT INTO app.import_profile(tenant_id,name,profile,revision,mapping,decimal_separator,created_by) VALUES(tid,body->>'name',body->>'profile',revision,body->'mapping',body->>'decimal_separator',actor) RETURNING id INTO eid;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,'import.profile_saved',eid,jsonb_build_object('revision',revision));RETURN eid;
END $$;
REVOKE ALL ON FUNCTION app.save_import_profile(uuid,text,jsonb) FROM PUBLIC;GRANT EXECUTE ON FUNCTION app.save_import_profile(uuid,text,jsonb) TO vinea_runtime;
