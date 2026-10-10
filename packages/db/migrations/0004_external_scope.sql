DO $$ DECLARE t text; predicate text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='app' AND tablename NOT IN ('tenant','membership') LOOP
  predicate:=CASE t
   WHEN 'lot' THEN 'app.role()<>''external'' OR EXISTS(SELECT 1 FROM app.membership m WHERE m.tenant_id=app.tenant_id() AND m.user_id=app.actor_id() AND m.scope ? id::text)'
   WHEN 'sample' THEN 'app.role()<>''external'' OR EXISTS(SELECT 1 FROM app.membership m WHERE m.tenant_id=app.tenant_id() AND m.user_id=app.actor_id() AND m.scope ? lot_id::text)'
   WHEN 'analysis' THEN 'app.role()<>''external'' OR EXISTS(SELECT 1 FROM app.sample s WHERE s.tenant_id=app.tenant_id() AND s.id=sample_id)'
   ELSE 'app.role()<>''external''' END;
  EXECUTE format('CREATE POLICY external_scope ON app.%I AS RESTRICTIVE FOR SELECT USING(%s)',t,predicate);
 END LOOP;
END $$;
