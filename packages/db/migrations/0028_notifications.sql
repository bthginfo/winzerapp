CREATE TABLE app.notification_preference(tenant_id uuid NOT NULL REFERENCES app.tenant(id),user_id text NOT NULL REFERENCES public.auth_user(id),email_digest boolean NOT NULL DEFAULT false,PRIMARY KEY(tenant_id,user_id),FOREIGN KEY(tenant_id,user_id) REFERENCES app.membership(tenant_id,user_id));
CREATE TABLE app.notification_digest(tenant_id uuid NOT NULL REFERENCES app.tenant(id),user_id text NOT NULL,day date NOT NULL,status text NOT NULL CHECK(status IN ('sending','sent','ambiguous')),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,user_id,day),FOREIGN KEY(tenant_id,user_id) REFERENCES app.membership(tenant_id,user_id));
ALTER TABLE app.notification_preference ENABLE ROW LEVEL SECURITY;ALTER TABLE app.notification_preference FORCE ROW LEVEL SECURITY;
ALTER TABLE app.notification_digest ENABLE ROW LEVEL SECURITY;ALTER TABLE app.notification_digest FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_access ON app.notification_preference USING(app.current_member(tenant_id) AND user_id=app.actor_id());CREATE POLICY tenant_access ON app.notification_digest USING(app.current_member(tenant_id) AND user_id=app.actor_id());
CREATE FUNCTION app.notification_configure(tid uuid,actor text,enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);IF NOT app.is_member(tid) OR app.role()='external' THEN PERFORM app.fail('FORBIDDEN');END IF;
 INSERT INTO app.notification_preference(tenant_id,user_id,email_digest) VALUES(tid,actor,enabled) ON CONFLICT(tenant_id,user_id) DO UPDATE SET email_digest=excluded.email_digest;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,data) VALUES(tid,actor,'notification.preference',jsonb_build_object('email_digest',enabled));
END $$;
CREATE FUNCTION app.notification_claim() RETURNS TABLE(tenant_id uuid,user_id text,address text,winery text,tasks jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE recipient record;
BEGIN
 FOR recipient IN SELECT p.tenant_id,p.user_id,u.email,t.name FROM app.notification_preference p JOIN app.membership m ON m.tenant_id=p.tenant_id AND m.user_id=p.user_id JOIN public.auth_user u ON u.id=p.user_id JOIN app.tenant t ON t.id=p.tenant_id WHERE p.email_digest AND u.email_verified AND m.role<>'external' AND NOT EXISTS(SELECT 1 FROM app.notification_digest d WHERE d.tenant_id=p.tenant_id AND d.user_id=p.user_id AND d.day=current_date) AND EXISTS(SELECT 1 FROM app.task a WHERE a.tenant_id=p.tenant_id AND a.assignee_id=p.user_id AND a.status<>'done' AND a.due_at<now()+interval '1 day') LIMIT 10 LOOP
  INSERT INTO app.notification_digest(tenant_id,user_id,day,status) VALUES(recipient.tenant_id,recipient.user_id,current_date,'sending') ON CONFLICT DO NOTHING;
  IF FOUND THEN tenant_id:=recipient.tenant_id;user_id:=recipient.user_id;address:=recipient.email;winery:=recipient.name;SELECT jsonb_agg(jsonb_build_object('title',a.title,'due_at',a.due_at,'status',a.status)) INTO tasks FROM app.task a WHERE a.tenant_id=recipient.tenant_id AND a.assignee_id=recipient.user_id AND a.status<>'done' AND a.due_at<now()+interval '1 day';RETURN NEXT;END IF;
 END LOOP;
END $$;
CREATE FUNCTION app.notification_finish(tid uuid,actor text,state text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
BEGIN IF state NOT IN ('sent','ambiguous') THEN PERFORM app.fail('INVALID_COMMAND');END IF;UPDATE app.notification_digest SET status=state WHERE tenant_id=tid AND user_id=actor AND day=current_date AND status='sending';END $$;
REVOKE ALL ON FUNCTION app.notification_configure(uuid,text,boolean),app.notification_claim(),app.notification_finish(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.notification_configure(uuid,text,boolean),app.notification_claim(),app.notification_finish(uuid,text,text) TO vinea_runtime;
