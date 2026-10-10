CREATE TABLE app.invitation (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id),id uuid NOT NULL DEFAULT gen_random_uuid(),email text NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','oenologist','cellar','vineyard','office','external')),scope jsonb NOT NULL DEFAULT '[]',
 token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,created_by text NOT NULL REFERENCES public.auth_user(id),created_at timestamptz NOT NULL DEFAULT now(),accepted_by text REFERENCES public.auth_user(id),accepted_at timestamptz,revoked_at timestamptz,
 PRIMARY KEY(tenant_id,id)
);
ALTER TABLE app.invitation ENABLE ROW LEVEL SECURITY;ALTER TABLE app.invitation FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_access ON app.invitation USING(app.current_member(tenant_id) AND app.role()='owner');
CREATE FUNCTION app.invite_create(tid uuid,actor text,address text,member_role text,member_scope jsonb,hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE eid uuid; ref text;
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);PERFORM app.require_role(ARRAY['owner']);
 IF NOT app.is_member(tid) OR hash!~'^[a-f0-9]{64}$' OR jsonb_typeof(member_scope)<>'array' OR jsonb_array_length(member_scope)>500 THEN PERFORM app.fail('INVALID_COMMAND');END IF;
 FOR ref IN SELECT jsonb_array_elements_text(member_scope) LOOP
  IF NOT EXISTS(SELECT 1 FROM app.lot WHERE tenant_id=tid AND id::text=ref) THEN PERFORM app.fail('INVALID_SCOPE');END IF;
 END LOOP;
 INSERT INTO app.invitation(tenant_id,email,role,scope,token_hash,expires_at,created_by) VALUES(tid,lower(address),member_role,member_scope,hash,now()+interval '7 days',actor) RETURNING id INTO eid;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,'invitation.created',eid,jsonb_build_object('email',lower(address),'role',member_role,'scope',member_scope));RETURN eid;
END $$;
CREATE FUNCTION app.invite_accept(actor text,hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE invite app.invitation; address text;
BEGIN
 SELECT lower(email) INTO address FROM public.auth_user WHERE id=actor;IF address IS NULL THEN PERFORM app.fail('FORBIDDEN');END IF;
 SELECT * INTO invite FROM app.invitation WHERE token_hash=hash FOR UPDATE;
 IF NOT FOUND OR invite.email<>address OR invite.revoked_at IS NOT NULL OR invite.expires_at<=now() THEN PERFORM app.fail('INVITATION_INVALID');END IF;
 IF invite.accepted_by IS NOT NULL THEN IF invite.accepted_by=actor THEN RETURN invite.tenant_id;ELSE PERFORM app.fail('INVITATION_INVALID');END IF;END IF;
 PERFORM set_config('app.tenant_id',invite.tenant_id::text,true);PERFORM set_config('app.actor_id',actor,true);
 INSERT INTO app.membership(tenant_id,user_id,role,scope) VALUES(invite.tenant_id,actor,invite.role,invite.scope) ON CONFLICT(tenant_id,user_id) DO NOTHING;
 UPDATE app.invitation SET accepted_by=actor,accepted_at=now() WHERE tenant_id=invite.tenant_id AND id=invite.id;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(invite.tenant_id,actor,'invitation.accepted',invite.id,jsonb_build_object('issued_by',invite.created_by));RETURN invite.tenant_id;
END $$;
CREATE FUNCTION app.invite_revoke(tid uuid,actor text,eid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);PERFORM app.require_role(ARRAY['owner']);IF NOT app.is_member(tid) THEN PERFORM app.fail('FORBIDDEN');END IF;
 UPDATE app.invitation SET revoked_at=now() WHERE tenant_id=tid AND id=eid AND accepted_at IS NULL;
 IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND');END IF;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,'invitation.revoked',eid,'{}');
END $$;
ALTER TABLE app.asset ADD COLUMN client_id uuid;
CREATE UNIQUE INDEX asset_client_id ON app.asset(tenant_id,client_id) WHERE client_id IS NOT NULL;
CREATE OR REPLACE FUNCTION app.store_asset(tid uuid,actor text,meta jsonb,base64 text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE new_id uuid;bytes bytea:=decode(base64,'base64');existing app.asset;hash text:=encode(public.digest(bytes,'sha256'),'hex');
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);IF NOT app.is_member(tid) THEN PERFORM app.fail('FORBIDDEN');END IF;PERFORM app.require_role(ARRAY['owner','oenologist','cellar','vineyard','office']);
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0));
 IF meta->>'client_id' IS NOT NULL THEN
  SELECT * INTO existing FROM app.asset WHERE tenant_id=tid AND client_id=(meta->>'client_id')::uuid;
  IF FOUND THEN IF existing.sha256<>hash OR existing.lot_id IS DISTINCT FROM (meta->>'lot_id')::uuid OR existing.vineyard_id IS DISTINCT FROM (meta->>'vineyard_id')::uuid OR existing.filename<>meta->>'filename' OR existing.mime_type<>meta->>'mime_type' THEN PERFORM app.fail('IDEMPOTENCY_CONFLICT');END IF;RETURN existing.id;END IF;
 END IF;
 IF octet_length(bytes)>2097152 OR octet_length(bytes)=0 THEN PERFORM app.fail('ASSET_TOO_LARGE');END IF;
 IF coalesce((SELECT sum(octet_length(content)) FROM app.asset WHERE tenant_id=tid),0)+octet_length(bytes)>33554432 THEN PERFORM app.fail('ASSET_QUOTA');END IF;
 INSERT INTO app.asset(tenant_id,client_id,lot_id,vineyard_id,filename,mime_type,content,sha256,created_by) VALUES(tid,(meta->>'client_id')::uuid,(meta->>'lot_id')::uuid,(meta->>'vineyard_id')::uuid,meta->>'filename',meta->>'mime_type',bytes,hash,actor) RETURNING id INTO new_id;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,'asset.created',new_id,meta);RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION app.invite_create(uuid,text,text,text,jsonb,text),app.invite_accept(text,text),app.invite_revoke(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.invite_create(uuid,text,text,text,jsonb,text),app.invite_accept(text,text),app.invite_revoke(uuid,text,uuid) TO vinea_runtime;
