CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;

-- Better Auth owns authentication and session validation. No custom password logic.
CREATE TABLE public.auth_user (
 id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 email_verified boolean NOT NULL DEFAULT false, image text, two_factor_enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.auth_session (
 id text PRIMARY KEY, expires_at timestamptz NOT NULL, token text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 ip_address text, user_agent text, user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE
);
CREATE INDEX ON public.auth_session(user_id);
CREATE TABLE public.auth_account (
 id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL,
 user_id text NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
 access_token text, refresh_token text, id_token text, access_token_expires_at timestamptz,
 refresh_token_expires_at timestamptz, scope text, password text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider_id, account_id)
);
CREATE INDEX ON public.auth_account(user_id);
CREATE TABLE public.auth_verification (
 id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.auth_verification(identifier);
CREATE TABLE public.auth_rate_limit (
 id text PRIMARY KEY, key text NOT NULL UNIQUE, count integer NOT NULL, last_request bigint NOT NULL
);
CREATE TABLE public.auth_two_factor (
 id text PRIMARY KEY, secret text NOT NULL, backup_codes text NOT NULL,
 user_id text NOT NULL UNIQUE REFERENCES public.auth_user(id) ON DELETE CASCADE,
 verified boolean NOT NULL DEFAULT true, failed_verification_count integer NOT NULL DEFAULT 0, locked_until timestamptz
);

CREATE TABLE app.tenant (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 timezone text NOT NULL DEFAULT 'Europe/Berlin', mode text NOT NULL DEFAULT 'standalone' CHECK(mode IN ('standalone','erp','companion')),
 created_by text NOT NULL REFERENCES public.auth_user(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.membership (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), user_id text NOT NULL REFERENCES public.auth_user(id),
 role text NOT NULL CHECK(role IN ('owner','oenologist','cellar','vineyard','office','external')),
 scope jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE app.vineyard (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 code text NOT NULL, name text NOT NULL, grape text NOT NULL, area_ha numeric(12,4) NOT NULL CHECK(area_ha>0),
 planted_year integer, geometry jsonb, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,code)
);
CREATE TABLE app.harvest (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 vineyard_id uuid NOT NULL, code text NOT NULL, vintage integer NOT NULL CHECK(vintage BETWEEN 1900 AND 2200),
 quantity_kg numeric(20,3) NOT NULL CHECK(quantity_kg>0), received_at timestamptz NOT NULL, quality text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,code), FOREIGN KEY(tenant_id,vineyard_id) REFERENCES app.vineyard(tenant_id,id)
);
CREATE TABLE app.vessel (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 code text NOT NULL, name text NOT NULL, kind text NOT NULL DEFAULT 'tank' CHECK(kind IN ('tank','barrel','container')),
 capacity_l numeric(20,3) NOT NULL CHECK(capacity_l>0), status text NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','cleaning','blocked')),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,code)
);
CREATE TABLE app.lot (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 code text NOT NULL, name text NOT NULL, grape text NOT NULL DEFAULT '', vintage integer CHECK(vintage BETWEEN 1900 AND 2200),
 material text NOT NULL DEFAULT 'wine' CHECK(material IN ('must','wine')),
 cost_per_l numeric(16,6) NOT NULL DEFAULT 0 CHECK(cost_per_l>=0), blocked boolean NOT NULL DEFAULT false,
 block_reason text NOT NULL DEFAULT '', harvest_id uuid, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,code), FOREIGN KEY(tenant_id,harvest_id) REFERENCES app.harvest(tenant_id,id)
);
CREATE TABLE app.position (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), lot_id uuid NOT NULL, vessel_id uuid NOT NULL,
 quantity_l numeric(20,3) NOT NULL CHECK(quantity_l>=0), version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,lot_id,vessel_id),
 FOREIGN KEY(tenant_id,lot_id) REFERENCES app.lot(tenant_id,id), FOREIGN KEY(tenant_id,vessel_id) REFERENCES app.vessel(tenant_id,id)
);
CREATE TABLE app.operation (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 kind text NOT NULL, idempotency_key text NOT NULL, payload_hash text NOT NULL, payload jsonb NOT NULL,
 result jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 correction_of uuid, actor_id text NOT NULL, reason text NOT NULL DEFAULT '',
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,idempotency_key), FOREIGN KEY(tenant_id,correction_of) REFERENCES app.operation(tenant_id,id)
);
CREATE TABLE app.ledger (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), operation_id uuid NOT NULL,
 position_id uuid, lot_id uuid, account text NOT NULL CHECK(account IN ('stock','loss','opening','bottling','sample','adjustment')),
 quantity_l numeric(20,3) NOT NULL CHECK(quantity_l<>0), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,operation_id) REFERENCES app.operation(tenant_id,id),
 FOREIGN KEY(tenant_id,position_id) REFERENCES app.position(tenant_id,id), FOREIGN KEY(tenant_id,lot_id) REFERENCES app.lot(tenant_id,id),
 CHECK((account='stock')=(position_id IS NOT NULL))
);
CREATE INDEX ON app.ledger(tenant_id,position_id);
CREATE TABLE app.lineage (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), parent_lot_id uuid NOT NULL, child_lot_id uuid NOT NULL,
 operation_id uuid NOT NULL, contribution_l numeric(20,3) NOT NULL CHECK(contribution_l>0),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,parent_lot_id) REFERENCES app.lot(tenant_id,id),
 FOREIGN KEY(tenant_id,child_lot_id) REFERENCES app.lot(tenant_id,id), FOREIGN KEY(tenant_id,operation_id) REFERENCES app.operation(tenant_id,id),
 CHECK(parent_lot_id<>child_lot_id), UNIQUE(tenant_id,operation_id,parent_lot_id,child_lot_id)
);
CREATE TABLE app.recipe (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), project_id uuid NOT NULL, revision integer NOT NULL,
 name text NOT NULL, target_l numeric(20,3) NOT NULL CHECK(target_l>0), components jsonb NOT NULL,
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','frozen','approved','superseded')),
 snapshot jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,project_id,revision)
);
CREATE TABLE app.blend_project (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL,
 briefing text NOT NULL DEFAULT '', target_l numeric(20,3) NOT NULL CHECK(target_l>0),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','trial','approved','in_production','completed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id)
);
ALTER TABLE app.recipe ADD FOREIGN KEY(tenant_id,project_id) REFERENCES app.blend_project(tenant_id,id);
CREATE TABLE app.blend_order (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), recipe_id uuid NOT NULL,
 target_vessel_id uuid NOT NULL, status text NOT NULL DEFAULT 'released' CHECK(status IN ('released','partial','completed','cancelled')),
 snapshot jsonb NOT NULL, approved_by text NOT NULL, approved_at timestamptz NOT NULL DEFAULT now(),
 deviation_approved_by text, deviation_snapshot jsonb, operation_id uuid, version integer NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,recipe_id) REFERENCES app.recipe(tenant_id,id),
 FOREIGN KEY(tenant_id,target_vessel_id) REFERENCES app.vessel(tenant_id,id), FOREIGN KEY(tenant_id,operation_id) REFERENCES app.operation(tenant_id,id)
);
CREATE TABLE app.reservation (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), position_id uuid NOT NULL, order_id uuid,
 original_l numeric(20,3) NOT NULL CHECK(original_l>0), remaining_l numeric(20,3) NOT NULL CHECK(remaining_l>=0),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','consumed','released','expired')),
 expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,position_id) REFERENCES app.position(tenant_id,id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES app.blend_order(tenant_id,id), CHECK(remaining_l<=original_l)
);
CREATE INDEX ON app.reservation(tenant_id,position_id) WHERE status='active';
CREATE TABLE app.sample (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), lot_id uuid NOT NULL, code text NOT NULL,
 sampled_at timestamptz NOT NULL, source text NOT NULL DEFAULT 'manual', created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,code), FOREIGN KEY(tenant_id,lot_id) REFERENCES app.lot(tenant_id,id)
);
CREATE TABLE app.analysis (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), sample_id uuid NOT NULL,
 parameter text NOT NULL CHECK(parameter IN ('alcohol','sugar','acidity','ph','free_so2','temperature')),
 value numeric(20,6) NOT NULL, unit text NOT NULL, method text NOT NULL, measured_at timestamptz NOT NULL,
 source text NOT NULL, quality text NOT NULL DEFAULT 'measured' CHECK(quality IN ('measured','estimated')),
 supersedes uuid, created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,sample_id) REFERENCES app.sample(tenant_id,id),
 FOREIGN KEY(tenant_id,supersedes) REFERENCES app.analysis(tenant_id,id)
);
CREATE TABLE app.trial (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), recipe_id uuid NOT NULL,
 sample_ml numeric(12,2) NOT NULL CHECK(sample_ml>0), quantities jsonb NOT NULL,
 blind_code text NOT NULL, operation_id uuid NOT NULL, prepared_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,blind_code), FOREIGN KEY(tenant_id,recipe_id) REFERENCES app.recipe(tenant_id,id),
 FOREIGN KEY(tenant_id,operation_id) REFERENCES app.operation(tenant_id,id)
);
CREATE TABLE app.evaluation (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), trial_id uuid NOT NULL,
 evaluator_id text NOT NULL REFERENCES public.auth_user(id), score integer NOT NULL CHECK(score BETWEEN 0 AND 100),
 aroma integer NOT NULL CHECK(aroma BETWEEN 0 AND 10), balance integer NOT NULL CHECK(balance BETWEEN 0 AND 10),
 comment text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,trial_id,evaluator_id), FOREIGN KEY(tenant_id,trial_id) REFERENCES app.trial(tenant_id,id)
);
CREATE TABLE app.product (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL, PRIMARY KEY(tenant_id,id)
);
CREATE TABLE app.sku (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), product_id uuid NOT NULL, code text NOT NULL,
 fill_l numeric(10,3) NOT NULL CHECK(fill_l>0), erp_reference text, created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,code), FOREIGN KEY(tenant_id,product_id) REFERENCES app.product(tenant_id,id)
);
CREATE TABLE app.bottling (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), operation_id uuid NOT NULL, lot_id uuid NOT NULL, sku_id uuid NOT NULL,
 code text NOT NULL, bottle_count integer NOT NULL CHECK(bottle_count>0), fill_l numeric(10,3) NOT NULL CHECK(fill_l>0),
 loss_l numeric(20,3) NOT NULL CHECK(loss_l>=0), stock_authority text NOT NULL CHECK(stock_authority IN ('app','erp')),
 occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,code), FOREIGN KEY(tenant_id,operation_id) REFERENCES app.operation(tenant_id,id),
 FOREIGN KEY(tenant_id,lot_id) REFERENCES app.lot(tenant_id,id), FOREIGN KEY(tenant_id,sku_id) REFERENCES app.sku(tenant_id,id)
);
CREATE TABLE app.task (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(), title text NOT NULL,
 description text NOT NULL DEFAULT '', due_at timestamptz, assignee_id text, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','doing','done')),
 lot_id uuid, vineyard_id uuid, checklist jsonb NOT NULL DEFAULT '[]', version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,lot_id) REFERENCES app.lot(tenant_id,id),
 FOREIGN KEY(tenant_id,vineyard_id) REFERENCES app.vineyard(tenant_id,id), FOREIGN KEY(tenant_id,assignee_id) REFERENCES app.membership(tenant_id,user_id)
);
CREATE TABLE app.note (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(), lot_id uuid, vineyard_id uuid,
 body text NOT NULL, captured_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,lot_id) REFERENCES app.lot(tenant_id,id), FOREIGN KEY(tenant_id,vineyard_id) REFERENCES app.vineyard(tenant_id,id)
);
CREATE TABLE app.import_batch (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(), file_hash text NOT NULL,
 filename text NOT NULL, kind text NOT NULL, original text NOT NULL, mapping jsonb NOT NULL, rows jsonb NOT NULL,
 state text NOT NULL DEFAULT 'validated' CHECK(state IN ('validated','committed','failed')),
 report jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,file_hash,kind)
);
CREATE TABLE app.export_artifact (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(), kind text NOT NULL,
 snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 PRIMARY KEY(tenant_id,id)
);
CREATE TABLE app.audit (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(), actor_id text NOT NULL,
 event_type text NOT NULL, aggregate_id uuid, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id)
);
CREATE TABLE app.outbox (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(), event_type text NOT NULL,
 aggregate_id uuid, data jsonb NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','retrying','failed','ambiguous')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz,
 last_error text, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id)
);
CREATE INDEX ON app.outbox(status,available_at);

CREATE FUNCTION app.tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant_id',true),'')::uuid $$;
CREATE FUNCTION app.actor_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.actor_id',true),'') $$;
CREATE FUNCTION app.is_member(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT EXISTS(SELECT 1 FROM app.membership WHERE tenant_id=t AND user_id=app.actor_id())
$$;
CREATE FUNCTION app.role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT role FROM app.membership WHERE tenant_id=app.tenant_id() AND user_id=app.actor_id()
$$;
CREATE FUNCTION app.require_role(roles text[]) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF app.role() IS NULL OR NOT app.role()=ANY(roles) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF; END $$;
CREATE FUNCTION app.current_member(t uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT t=app.tenant_id() AND app.is_member(t)
$$;
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='app' LOOP
   EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);
   IF t='tenant' THEN
    EXECUTE 'CREATE POLICY tenant_scope ON app.tenant USING(app.current_member(id))';
   ELSE
    EXECUTE format('CREATE POLICY tenant_scope ON app.%I USING(app.current_member(tenant_id)) WITH CHECK(app.current_member(tenant_id))',t);
   END IF;
 END LOOP;
END $$;
-- Identity bootstrap helpers are owner-only; the runtime role never owns these tables.
ALTER TABLE app.tenant NO FORCE ROW LEVEL SECURITY;
ALTER TABLE app.membership NO FORCE ROW LEVEL SECURITY;
-- Evaluation rows are private to each evaluator until explicitly compared by an oenologist.
CREATE POLICY private_scores ON app.evaluation AS RESTRICTIVE USING(evaluator_id=app.actor_id() OR app.role() IN ('owner','oenologist'));

CREATE FUNCTION app.immutable_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'APPEND_ONLY_HISTORY' USING ERRCODE='23514'; END $$;
CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON app.ledger FOR EACH ROW EXECUTE FUNCTION app.immutable_history();
CREATE TRIGGER lineage_append_only BEFORE UPDATE OR DELETE ON app.lineage FOR EACH ROW EXECUTE FUNCTION app.immutable_history();
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON app.audit FOR EACH ROW EXECUTE FUNCTION app.immutable_history();
CREATE TRIGGER analysis_append_only BEFORE UPDATE OR DELETE ON app.analysis FOR EACH ROW EXECUTE FUNCTION app.immutable_history();
CREATE FUNCTION app.recipe_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.state<>'draft' AND (NEW.components<>OLD.components OR NEW.target_l<>OLD.target_l OR NEW.name<>OLD.name OR NEW.snapshot<>OLD.snapshot) THEN
  RAISE EXCEPTION 'RECIPE_FROZEN' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER recipe_frozen BEFORE UPDATE ON app.recipe FOR EACH ROW EXECUTE FUNCTION app.recipe_guard();

CREATE FUNCTION app.bootstrap(actor text, winery_name text, winery_mode text DEFAULT 'standalone') RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE tid uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.auth_user WHERE id=actor) THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF (SELECT count(*) FROM app.membership WHERE user_id=actor AND role='owner')>=10 THEN RAISE EXCEPTION 'TENANT_LIMIT'; END IF;
 INSERT INTO app.tenant(name,created_by,mode) VALUES(winery_name,actor,winery_mode) RETURNING id INTO tid;
 INSERT INTO app.membership(tenant_id,user_id,role) VALUES(tid,actor,'owner');
 RETURN tid;
END $$;
CREATE FUNCTION app.my_tenants(actor text) RETURNS TABLE(id uuid,name text,role text,mode text,timezone text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT t.id,t.name,m.role,t.mode,t.timezone FROM app.tenant t JOIN app.membership m ON m.tenant_id=t.id WHERE m.user_id=actor ORDER BY t.created_at
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
