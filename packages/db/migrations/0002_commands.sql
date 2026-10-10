CREATE FUNCTION app.fail(code text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '%',code USING ERRCODE='P0001'; END $$;
CREATE FUNCTION app.require_version(actual integer,expected jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF expected IS NULL OR actual<>(expected#>>'{}')::integer THEN PERFORM app.fail('VERSION_CONFLICT'); END IF; END $$;
CREATE FUNCTION app.positive(value text,allow_zero boolean DEFAULT false) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n numeric;
BEGIN
 IF value IS NULL OR value !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$' OR length(value)>26 THEN PERFORM app.fail('INVALID_DECIMAL'); END IF;
 n:=value::numeric;
 IF n<0 OR (NOT allow_zero AND n=0) THEN PERFORM app.fail('INVALID_QUANTITY'); END IF;
 RETURN n;
END $$;
CREATE FUNCTION app.available(pid uuid,own_order uuid DEFAULT NULL) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT p.quantity_l-coalesce((SELECT sum(r.remaining_l) FROM app.reservation r WHERE r.tenant_id=p.tenant_id AND r.position_id=p.id
   AND r.status='active' AND (r.expires_at IS NULL OR r.expires_at>now()) AND (own_order IS NULL OR r.order_id IS DISTINCT FROM own_order)),0)
 FROM app.position p WHERE p.tenant_id=app.tenant_id() AND p.id=pid
$$;
CREATE FUNCTION app.debit(op uuid,pid uuid,amount numeric,own_order uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p app.position; blocked boolean; r app.reservation; consumed numeric; left_l numeric:=amount;
BEGIN
 SELECT * INTO p FROM app.position WHERE tenant_id=app.tenant_id() AND id=pid FOR UPDATE;
 IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
 SELECT l.blocked INTO blocked FROM app.lot l WHERE l.tenant_id=p.tenant_id AND l.id=p.lot_id;
 IF blocked THEN PERFORM app.fail('BLOCKED_SOURCE'); END IF;
 IF amount<=0 OR amount<>round(amount,3) THEN PERFORM app.fail('INVALID_QUANTITY'); END IF;
 IF amount>app.available(pid,own_order) THEN PERFORM app.fail('INSUFFICIENT_STOCK'); END IF;
 IF own_order IS NOT NULL THEN
  FOR r IN SELECT * FROM app.reservation WHERE tenant_id=p.tenant_id AND position_id=pid AND order_id=own_order AND status='active' ORDER BY id FOR UPDATE LOOP
   consumed:=least(r.remaining_l,left_l);
   UPDATE app.reservation SET remaining_l=remaining_l-consumed,status=CASE WHEN remaining_l-consumed=0 THEN 'consumed' ELSE 'active' END WHERE tenant_id=p.tenant_id AND id=r.id;
   left_l:=left_l-consumed;
   EXIT WHEN left_l=0;
  END LOOP;
 END IF;
 UPDATE app.position SET quantity_l=quantity_l-amount,version=version+1 WHERE tenant_id=p.tenant_id AND id=pid;
 INSERT INTO app.ledger(tenant_id,operation_id,position_id,lot_id,account,quantity_l) VALUES(p.tenant_id,op,pid,p.lot_id,'stock',-amount);
END $$;
CREATE FUNCTION app.credit(op uuid,lid uuid,vid uuid,amount numeric) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE p app.position; v app.vessel; current_l numeric; pid uuid;
BEGIN
 SELECT * INTO v FROM app.vessel WHERE tenant_id=app.tenant_id() AND id=vid FOR UPDATE;
 IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
 IF v.status<>'ready' THEN PERFORM app.fail('VESSEL_UNAVAILABLE'); END IF;
 IF NOT EXISTS(SELECT 1 FROM app.lot WHERE tenant_id=app.tenant_id() AND id=lid) THEN PERFORM app.fail('NOT_FOUND'); END IF;
 IF EXISTS(SELECT 1 FROM app.position WHERE tenant_id=v.tenant_id AND vessel_id=vid AND quantity_l>0 AND lot_id<>lid) THEN PERFORM app.fail('OCCUPIED_VESSEL'); END IF;
 SELECT coalesce(sum(quantity_l),0) INTO current_l FROM app.position WHERE tenant_id=v.tenant_id AND vessel_id=vid;
 IF amount<=0 OR amount<>round(amount,3) OR current_l+amount>v.capacity_l THEN PERFORM app.fail('CAPACITY_EXCEEDED'); END IF;
 INSERT INTO app.position(tenant_id,lot_id,vessel_id,quantity_l,created_by) VALUES(v.tenant_id,lid,vid,amount,app.actor_id())
 ON CONFLICT(tenant_id,lot_id,vessel_id) DO UPDATE SET quantity_l=app.position.quantity_l+excluded.quantity_l,version=app.position.version+1 RETURNING id INTO pid;
 UPDATE app.vessel SET version=version+1 WHERE tenant_id=v.tenant_id AND id=vid;
 INSERT INTO app.ledger(tenant_id,operation_id,position_id,lot_id,account,quantity_l) VALUES(v.tenant_id,op,pid,lid,'stock',amount);
 RETURN pid;
END $$;

CREATE FUNCTION app.command(tid uuid,actor text,key text,body jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE
 cmd text:=body->>'type'; h text:=encode(public.digest(body::text,'sha256'),'hex'); op app.operation;
 reply jsonb:='{}'; entity_id uuid; pid uuid; lid uuid; vid uuid; rid uuid; orderid uuid; p app.position; v app.vessel; l app.lot;
 recipe app.recipe; ordering app.blend_order; taskrow app.task; batch app.import_batch; skurow app.sku;
 q numeric; loss numeric; total numeric; sumq numeric; cost numeric; x jsonb; component jsonb; components jsonb; snapshots jsonb;
 observed integer; old_key text; mode text; actual jsonb; expected jsonb; m text; trial_ml numeric; samples jsonb; sample_l numeric; remainder numeric;
BEGIN
 IF tid IS NULL OR actor IS NULL OR key IS NULL OR length(key)<8 OR length(key)>120 THEN PERFORM app.fail('INVALID_COMMAND'); END IF;
 PERFORM set_config('app.tenant_id',tid::text,true); PERFORM set_config('app.actor_id',actor,true);
 IF NOT app.is_member(tid) THEN PERFORM app.fail('FORBIDDEN'); END IF;
 -- Winery-wide advisory lock orders simultaneous commands; affected rows are also locked deterministically.
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0));
 SELECT * INTO op FROM app.operation WHERE tenant_id=tid AND idempotency_key=key;
 IF FOUND THEN IF op.payload_hash<>h THEN PERFORM app.fail('IDEMPOTENCY_CONFLICT'); END IF; RETURN op.result; END IF;
 PERFORM 1 FROM app.vessel WHERE tenant_id=tid ORDER BY id FOR UPDATE;
 PERFORM 1 FROM app.position WHERE tenant_id=tid ORDER BY id FOR UPDATE;
 PERFORM 1 FROM app.reservation WHERE tenant_id=tid ORDER BY id FOR UPDATE;
 SELECT t.mode INTO mode FROM app.tenant t WHERE t.id=tid;
 IF mode='companion' AND cmd IN ('opening','transfer','split','mix','loss','adjustment','trial','approve','reserve','produce','bottle') THEN PERFORM app.fail('COMPANION_READ_ONLY'); END IF;
 IF cmd IN ('approve','approve_deviation','adjustment','lot_block','member_set','reservation_release') THEN PERFORM app.require_role(ARRAY['owner','oenologist']);
 ELSIF cmd IN ('opening','transfer','split','mix','loss','trial','reserve','produce','bottle','vessel_create','lot_create','product_create','sku_create') THEN PERFORM app.require_role(ARRAY['owner','oenologist','cellar']);
 ELSIF cmd IN ('vineyard_create','harvest_create') THEN PERFORM app.require_role(ARRAY['owner','oenologist','vineyard']);
 ELSIF cmd IN ('import_validate','import_commit','export_snapshot') THEN PERFORM app.require_role(ARRAY['owner','oenologist','office']);
 ELSIF cmd IN ('recipe_save','recipe_freeze','project_create','order_cancel') THEN PERFORM app.require_role(ARRAY['owner','oenologist']);
 ELSIF cmd='analysis_add' THEN PERFORM app.require_role(ARRAY['owner','oenologist','cellar','external']);
 ELSIF cmd NOT IN ('task_create','task_update','note_add','evaluate') THEN PERFORM app.fail('UNKNOWN_COMMAND');
 END IF;
 INSERT INTO app.operation(tenant_id,kind,idempotency_key,payload_hash,payload,occurred_at,actor_id,reason,correction_of)
 VALUES(tid,cmd,key,h,body,coalesce((body->>'occurred_at')::timestamptz,now()),actor,coalesce(body->>'reason',''),(body->>'correction_of')::uuid) RETURNING * INTO op;

 IF cmd='vessel_create' THEN
  INSERT INTO app.vessel(tenant_id,code,name,kind,capacity_l,created_by) VALUES(tid,body->>'code',body->>'name',coalesce(body->>'kind','tank'),app.positive(body->>'capacity_l'),actor) RETURNING id INTO entity_id;
 ELSIF cmd='lot_create' THEN
  INSERT INTO app.lot(tenant_id,code,name,grape,vintage,cost_per_l,material,harvest_id,created_by)
   VALUES(tid,body->>'code',body->>'name',coalesce(body->>'grape',''),(body->>'vintage')::integer,app.positive(coalesce(body->>'cost_per_l','0'),true),coalesce(body->>'material','wine'),(body->>'harvest_id')::uuid,actor) RETURNING id INTO entity_id;
 ELSIF cmd='vineyard_create' THEN
  INSERT INTO app.vineyard(tenant_id,code,name,grape,area_ha,planted_year,geometry,created_by)
   VALUES(tid,body->>'code',body->>'name',body->>'grape',app.positive(body->>'area_ha'),(body->>'planted_year')::integer,body->'geometry',actor) RETURNING id INTO entity_id;
 ELSIF cmd='harvest_create' THEN
  INSERT INTO app.harvest(tenant_id,vineyard_id,code,vintage,quantity_kg,received_at,quality,created_by)
   VALUES(tid,(body->>'vineyard_id')::uuid,body->>'code',(body->>'vintage')::integer,app.positive(body->>'quantity_kg'),(body->>'received_at')::timestamptz,coalesce(body->>'quality',''),actor) RETURNING id INTO entity_id;
 ELSIF cmd='lot_block' THEN
  SELECT * INTO l FROM app.lot WHERE tenant_id=tid AND id=(body->>'lot_id')::uuid;
  IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  PERFORM app.require_version(l.version,body->'expected_version');
  IF length(coalesce(body->>'reason',''))<5 THEN PERFORM app.fail('REASON_REQUIRED'); END IF;
  UPDATE app.lot SET blocked=(body->>'blocked')::boolean,block_reason=body->>'reason',version=version+1 WHERE tenant_id=tid AND id=l.id;
  entity_id:=l.id;
 ELSIF cmd='opening' THEN
  q:=app.positive(body->>'quantity_l'); lid:=(body->>'lot_id')::uuid; vid:=(body->>'vessel_id')::uuid;
  IF EXISTS(SELECT 1 FROM app.position WHERE tenant_id=tid AND lot_id=lid AND vessel_id=vid AND quantity_l>0) THEN PERFORM app.fail('OPENING_EXISTS'); END IF;
  pid:=app.credit(op.id,lid,vid,q);
  INSERT INTO app.ledger(tenant_id,operation_id,lot_id,account,quantity_l) VALUES(tid,op.id,lid,'opening',-q);
  entity_id:=pid;
 ELSIF cmd IN ('transfer','split','loss','adjustment') THEN
  SELECT * INTO p FROM app.position WHERE tenant_id=tid AND id=(body->>'position_id')::uuid;
  IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  PERFORM app.require_version(p.version,body->'expected_version');
  q:=app.positive(body->>'quantity_l'); loss:=app.positive(coalesce(body->>'loss_l','0'),true);
  IF cmd='adjustment' THEN
   IF length(coalesce(body->>'reason',''))<5 OR body->>'correction_of' IS NULL THEN PERFORM app.fail('REASON_REQUIRED'); END IF;
   IF body->>'direction'='increase' THEN
    pid:=app.credit(op.id,p.lot_id,p.vessel_id,q);
    INSERT INTO app.ledger(tenant_id,operation_id,lot_id,account,quantity_l) VALUES(tid,op.id,p.lot_id,'adjustment',-q);
   ELSIF body->>'direction'='decrease' THEN
    PERFORM app.debit(op.id,p.id,q);
    INSERT INTO app.ledger(tenant_id,operation_id,lot_id,account,quantity_l) VALUES(tid,op.id,p.lot_id,'adjustment',q);
   ELSE PERFORM app.fail('INVALID_DIRECTION'); END IF;
  ELSE
   PERFORM app.debit(op.id,p.id,q);
   IF cmd='loss' THEN loss:=q;
   ELSE
    IF loss>=q THEN PERFORM app.fail('INVALID_LOSS'); END IF;
    IF (body->>'target_vessel_id')::uuid=p.vessel_id THEN PERFORM app.fail('SAME_VESSEL'); END IF;
    pid:=app.credit(op.id,p.lot_id,(body->>'target_vessel_id')::uuid,q-loss);
   END IF;
   IF loss>0 THEN INSERT INTO app.ledger(tenant_id,operation_id,lot_id,account,quantity_l) VALUES(tid,op.id,p.lot_id,'loss',loss); END IF;
  END IF;
  entity_id:=p.lot_id;
 ELSIF cmd IN ('mix','produce') THEN
  vid:=(body->>'target_vessel_id')::uuid; components:=body->'sources'; total:=0; cost:=0;
  IF jsonb_array_length(components)<1 OR jsonb_array_length(components)>50 THEN PERFORM app.fail('INVALID_RECIPE'); END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(components))<>(SELECT count(DISTINCT x->>'position_id') FROM jsonb_array_elements(components) x) THEN PERFORM app.fail('DUPLICATE_SOURCE'); END IF;
  IF cmd='produce' THEN
   SELECT * INTO ordering FROM app.blend_order WHERE tenant_id=tid AND id=(body->>'order_id')::uuid FOR UPDATE;
   IF NOT FOUND OR ordering.status NOT IN ('released','partial') THEN PERFORM app.fail('ORDER_NOT_RELEASED'); END IF;
   PERFORM app.require_version(ordering.version,body->'order_version');
   IF ordering.target_vessel_id<>vid THEN PERFORM app.fail('ORDER_TARGET_MISMATCH'); END IF;
   SELECT * INTO recipe FROM app.recipe WHERE tenant_id=tid AND id=ordering.recipe_id;
   -- Exact normalized actual amounts must match the approved recipe or an explicit deviation approval.
   SELECT jsonb_agg(jsonb_build_object('position_id',z->>'position_id','quantity_l',(z->>'quantity_l')::numeric::text) ORDER BY z->>'position_id') INTO actual FROM jsonb_array_elements(components) z;
   SELECT jsonb_agg(jsonb_build_object('position_id',z->>'position_id','quantity_l',(z->>'quantity_l')::numeric::text) ORDER BY z->>'position_id') INTO expected FROM jsonb_array_elements(recipe.components) z;
   IF actual<>expected AND (ordering.deviation_approved_by IS NULL OR actual<>ordering.deviation_snapshot->'sources') THEN PERFORM app.fail('DEVIATION_REQUIRES_APPROVAL'); END IF;
   orderid:=ordering.id;
  END IF;
  -- Occupied targets must be fully included in the explicit mixing inputs, never overwritten.
  FOR p IN SELECT * FROM app.position WHERE tenant_id=tid AND vessel_id=vid AND quantity_l>0 LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(components) c WHERE (c->>'position_id')::uuid=p.id AND (c->>'quantity_l')::numeric=p.quantity_l) THEN PERFORM app.fail('OCCUPIED_VESSEL'); END IF;
  END LOOP;
  INSERT INTO app.lot(tenant_id,code,name,grape,vintage,created_by) VALUES(tid,body->>'code',body->>'name','',(body->>'vintage')::integer,actor) RETURNING id INTO lid;
  FOR component IN SELECT * FROM jsonb_array_elements(components) LOOP
   SELECT * INTO p FROM app.position WHERE tenant_id=tid AND id=(component->>'position_id')::uuid;
   IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
   PERFORM app.require_version(p.version,component->'expected_version');
   q:=app.positive(component->>'quantity_l');
   IF cmd='produce' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(recipe.components) c WHERE (c->>'position_id')::uuid=p.id) THEN PERFORM app.fail('ORDER_SOURCE_MISMATCH'); END IF;
   PERFORM app.debit(op.id,p.id,q,orderid); total:=total+q;
   SELECT l.cost_per_l INTO cost FROM app.lot l WHERE l.tenant_id=tid AND l.id=p.lot_id;
  END LOOP;
  INSERT INTO app.lineage(tenant_id,parent_lot_id,child_lot_id,operation_id,contribution_l)
   SELECT tid,p.lot_id,lid,op.id,sum((c->>'quantity_l')::numeric) FROM jsonb_array_elements(components) c
   JOIN app.position p ON p.tenant_id=tid AND p.id=(c->>'position_id')::uuid GROUP BY p.lot_id;
  loss:=app.positive(coalesce(body->>'loss_l','0'),true);
  IF loss>=total THEN PERFORM app.fail('INVALID_LOSS'); END IF;
  pid:=app.credit(op.id,lid,vid,total-loss);
  IF loss>0 THEN INSERT INTO app.ledger(tenant_id,operation_id,lot_id,account,quantity_l) VALUES(tid,op.id,lid,'loss',loss); END IF;
  UPDATE app.lot SET cost_per_l=(SELECT sum(e.contribution_l*l.cost_per_l)/total FROM app.lineage e JOIN app.lot l ON l.tenant_id=e.tenant_id AND l.id=e.parent_lot_id WHERE e.tenant_id=tid AND e.child_lot_id=lid) WHERE tenant_id=tid AND id=lid;
  IF cmd='produce' THEN
   UPDATE app.blend_order SET status='completed',operation_id=op.id,version=version+1 WHERE tenant_id=tid AND id=orderid;
   UPDATE app.reservation SET status='released' WHERE tenant_id=tid AND order_id=orderid AND status='active';
   UPDATE app.blend_project SET status='completed' WHERE tenant_id=tid AND id=recipe.project_id;
  END IF;
  entity_id:=lid; reply:=jsonb_build_object('position_id',pid,'quantity_l',(total-loss)::text);
 ELSIF cmd='project_create' THEN
  INSERT INTO app.blend_project(tenant_id,name,briefing,target_l,created_by) VALUES(tid,body->>'name',coalesce(body->>'briefing',''),app.positive(body->>'target_l'),actor) RETURNING id INTO entity_id;
 ELSIF cmd='recipe_save' THEN
  entity_id:=(body->>'project_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM app.blend_project WHERE tenant_id=tid AND id=entity_id) THEN PERFORM app.fail('NOT_FOUND'); END IF;
  components:=body->'components'; total:=0;
  IF jsonb_array_length(components)<1 OR jsonb_array_length(components)>50 THEN PERFORM app.fail('INVALID_RECIPE'); END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(components))<>(SELECT count(DISTINCT z->>'position_id') FROM jsonb_array_elements(components) z) THEN PERFORM app.fail('DUPLICATE_SOURCE'); END IF;
  FOR component IN SELECT * FROM jsonb_array_elements(components) LOOP
   IF NOT EXISTS(SELECT 1 FROM app.position WHERE tenant_id=tid AND id=(component->>'position_id')::uuid) THEN PERFORM app.fail('NOT_FOUND'); END IF;
   total:=total+app.positive(component->>'quantity_l');
  END LOOP;
  SELECT coalesce(max(revision),0)+1 INTO observed FROM app.recipe WHERE tenant_id=tid AND project_id=entity_id;
  INSERT INTO app.recipe(tenant_id,project_id,revision,name,target_l,components,created_by) VALUES(tid,entity_id,observed,body->>'name',total,components,actor) RETURNING id INTO entity_id;
 ELSIF cmd='recipe_freeze' THEN
  SELECT * INTO recipe FROM app.recipe WHERE tenant_id=tid AND id=(body->>'recipe_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  PERFORM app.require_version(recipe.version,body->'expected_version');
  IF recipe.state<>'draft' THEN PERFORM app.fail('RECIPE_FROZEN'); END IF;
  SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('blocked',l.blocked,'cost_per_l',l.cost_per_l::text)) INTO snapshots
   FROM app.position p JOIN app.lot l ON l.tenant_id=p.tenant_id AND l.id=p.lot_id
   WHERE p.tenant_id=tid AND p.id IN (SELECT (z->>'position_id')::uuid FROM jsonb_array_elements(recipe.components) z);
  UPDATE app.recipe SET state='frozen',snapshot=jsonb_build_object('positions',snapshots,'captured_at',now()),version=version+1 WHERE tenant_id=tid AND id=recipe.id;
  entity_id:=recipe.id;
 ELSIF cmd='trial' THEN
  SELECT * INTO recipe FROM app.recipe WHERE tenant_id=tid AND id=(body->>'recipe_id')::uuid FOR UPDATE;
  IF NOT FOUND OR recipe.state NOT IN ('frozen','approved') THEN PERFORM app.fail('RECIPE_NOT_FROZEN'); END IF;
  trial_ml:=app.positive(coalesce(body->>'sample_ml','250')); IF trial_ml<>trunc(trial_ml) THEN PERFORM app.fail('SAMPLE_BELOW_PRECISION'); END IF; samples:='[]'; remainder:=trial_ml;
  observed:=0;
  FOR component IN SELECT * FROM jsonb_array_elements(recipe.components) LOOP
   observed:=observed+1;
   q:=CASE WHEN observed=jsonb_array_length(recipe.components) THEN remainder ELSE trunc((component->>'quantity_l')::numeric/recipe.target_l*trial_ml,0) END;
   remainder:=remainder-q; sample_l:=round(q/1000,3);
   IF sample_l=0 THEN PERFORM app.fail('SAMPLE_BELOW_PRECISION'); END IF;
   pid:=(component->>'position_id')::uuid;
   PERFORM app.debit(op.id,pid,sample_l);
   SELECT lot_id INTO lid FROM app.position WHERE tenant_id=tid AND id=pid;
   INSERT INTO app.ledger(tenant_id,operation_id,lot_id,account,quantity_l) VALUES(tid,op.id,lid,'sample',sample_l);
   samples:=samples||jsonb_build_array(jsonb_build_object('position_id',pid,'planned_ml',q::text,'actual_l',sample_l::text));
  END LOOP;
  INSERT INTO app.trial(tenant_id,recipe_id,sample_ml,quantities,blind_code,operation_id,created_by)
   VALUES(tid,recipe.id,trial_ml,samples,upper(substr(encode(public.gen_random_bytes(8),'hex'),1,8)),op.id,actor) RETURNING id INTO entity_id;
  UPDATE app.blend_project SET status='trial' WHERE tenant_id=tid AND id=recipe.project_id;
 ELSIF cmd='evaluate' THEN
  INSERT INTO app.evaluation(tenant_id,trial_id,evaluator_id,score,aroma,balance,comment) VALUES(tid,(body->>'trial_id')::uuid,actor,(body->>'score')::integer,(body->>'aroma')::integer,(body->>'balance')::integer,coalesce(body->>'comment','')) RETURNING id INTO entity_id;
 ELSIF cmd='approve' THEN
  SELECT * INTO recipe FROM app.recipe WHERE tenant_id=tid AND id=(body->>'recipe_id')::uuid FOR UPDATE;
  IF NOT FOUND OR recipe.state<>'frozen' THEN PERFORM app.fail('RECIPE_NOT_FROZEN'); END IF;
  PERFORM app.require_version(recipe.version,body->'expected_version');
  vid:=(body->>'target_vessel_id')::uuid;
  SELECT * INTO v FROM app.vessel WHERE tenant_id=tid AND id=vid;
  IF NOT FOUND OR v.status<>'ready' THEN PERFORM app.fail('VESSEL_UNAVAILABLE'); END IF;
  IF recipe.target_l>v.capacity_l THEN PERFORM app.fail('CAPACITY_EXCEEDED'); END IF;
  IF EXISTS(SELECT 1 FROM app.position WHERE tenant_id=tid AND vessel_id=vid AND quantity_l>0) THEN PERFORM app.fail('OCCUPIED_VESSEL'); END IF;
  snapshots:='[]';
  FOR component IN SELECT * FROM jsonb_array_elements(recipe.components) LOOP
   SELECT * INTO p FROM app.position WHERE tenant_id=tid AND id=(component->>'position_id')::uuid;
   IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
   IF (SELECT blocked FROM app.lot WHERE tenant_id=tid AND id=p.lot_id) THEN PERFORM app.fail('BLOCKED_SOURCE'); END IF;
   q:=app.positive(component->>'quantity_l');
   IF q>app.available(p.id) THEN PERFORM app.fail('INSUFFICIENT_STOCK'); END IF;
   snapshots:=snapshots||jsonb_build_array(to_jsonb(p)||jsonb_build_object('planned_l',q::text));
  END LOOP;
  INSERT INTO app.blend_order(tenant_id,recipe_id,target_vessel_id,snapshot,approved_by) VALUES(tid,recipe.id,vid,jsonb_build_object('positions',snapshots,'recipe',to_jsonb(recipe),'rules','not_checked'),actor) RETURNING id INTO orderid;
  FOR component IN SELECT * FROM jsonb_array_elements(recipe.components) LOOP
   q:=app.positive(component->>'quantity_l');
   INSERT INTO app.reservation(tenant_id,position_id,order_id,original_l,remaining_l,created_by) VALUES(tid,(component->>'position_id')::uuid,orderid,q,q,actor);
  END LOOP;
  UPDATE app.recipe SET state='approved',version=version+1 WHERE tenant_id=tid AND id=recipe.id;
  UPDATE app.blend_project SET status='approved' WHERE tenant_id=tid AND id=recipe.project_id;
  entity_id:=orderid;
 ELSIF cmd='approve_deviation' THEN
  SELECT * INTO ordering FROM app.blend_order WHERE tenant_id=tid AND id=(body->>'order_id')::uuid FOR UPDATE;
  IF NOT FOUND OR ordering.status NOT IN ('released','partial') THEN PERFORM app.fail('ORDER_NOT_RELEASED'); END IF;
  PERFORM app.require_version(ordering.version,body->'expected_version');
  IF length(coalesce(body->>'reason',''))<5 THEN PERFORM app.fail('REASON_REQUIRED'); END IF;
  SELECT jsonb_agg(jsonb_build_object('position_id',z->>'position_id','quantity_l',(z->>'quantity_l')::numeric::text) ORDER BY z->>'position_id') INTO actual FROM jsonb_array_elements(body->'sources') z;
  UPDATE app.blend_order SET deviation_approved_by=actor,deviation_snapshot=jsonb_build_object('sources',actual,'reason',body->>'reason'),version=version+1 WHERE tenant_id=tid AND id=ordering.id;
  entity_id:=ordering.id;
 ELSIF cmd='reserve' THEN
  pid:=(body->>'position_id')::uuid; q:=app.positive(body->>'quantity_l');
  SELECT * INTO p FROM app.position WHERE tenant_id=tid AND id=pid;
  IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  PERFORM app.require_version(p.version,body->'expected_version');
  IF q>app.available(pid) OR (SELECT blocked FROM app.lot WHERE tenant_id=tid AND id=p.lot_id) THEN PERFORM app.fail('INSUFFICIENT_STOCK'); END IF;
  INSERT INTO app.reservation(tenant_id,position_id,original_l,remaining_l,expires_at,created_by) VALUES(tid,pid,q,q,(body->>'expires_at')::timestamptz,actor) RETURNING id INTO entity_id;
 ELSIF cmd='reservation_release' THEN
  UPDATE app.reservation SET status='released' WHERE tenant_id=tid AND id=(body->>'reservation_id')::uuid AND status='active' RETURNING id INTO entity_id;
  IF entity_id IS NULL THEN PERFORM app.fail('NOT_FOUND'); END IF;
 ELSIF cmd='order_cancel' THEN
  UPDATE app.blend_order SET status='cancelled',version=version+1 WHERE tenant_id=tid AND id=(body->>'order_id')::uuid AND status IN ('released','partial') RETURNING id INTO entity_id;
  IF entity_id IS NULL THEN PERFORM app.fail('NOT_FOUND'); END IF;
  UPDATE app.reservation SET status='released' WHERE tenant_id=tid AND order_id=entity_id AND status='active';
 ELSIF cmd='analysis_add' THEN
  IF app.role()='external' AND NOT EXISTS(SELECT 1 FROM app.membership m WHERE m.tenant_id=tid AND m.user_id=actor AND m.scope ? (body->>'lot_id')) THEN PERFORM app.fail('FORBIDDEN'); END IF;
  INSERT INTO app.sample(tenant_id,lot_id,code,sampled_at,source,created_by) VALUES(tid,(body->>'lot_id')::uuid,body->>'sample_code',(body->>'sampled_at')::timestamptz,coalesce(body->>'source','manual'),actor)
   ON CONFLICT(tenant_id,code) DO UPDATE SET code=excluded.code RETURNING id INTO pid;
  IF (SELECT lot_id FROM app.sample WHERE tenant_id=tid AND id=pid)<>(body->>'lot_id')::uuid THEN PERFORM app.fail('SAMPLE_LOT_CONFLICT'); END IF;
  INSERT INTO app.analysis(tenant_id,sample_id,parameter,value,unit,method,measured_at,source,quality,supersedes,created_by)
   VALUES(tid,pid,body->>'parameter',(body->>'value')::numeric,body->>'unit',body->>'method',(body->>'measured_at')::timestamptz,coalesce(body->>'source','manual'),coalesce(body->>'quality','measured'),(body->>'supersedes')::uuid,actor) RETURNING id INTO entity_id;
 ELSIF cmd='product_create' THEN
  INSERT INTO app.product(tenant_id,name,created_by) VALUES(tid,body->>'name',actor) RETURNING id INTO entity_id;
 ELSIF cmd='sku_create' THEN
  INSERT INTO app.sku(tenant_id,product_id,code,fill_l,erp_reference,created_by) VALUES(tid,(body->>'product_id')::uuid,body->>'code',app.positive(body->>'fill_l'),body->>'erp_reference',actor) RETURNING id INTO entity_id;
 ELSIF cmd='bottle' THEN
  SELECT * INTO p FROM app.position WHERE tenant_id=tid AND id=(body->>'position_id')::uuid;
  IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  PERFORM app.require_version(p.version,body->'expected_version');
  SELECT * INTO skurow FROM app.sku WHERE tenant_id=tid AND id=(body->>'sku_id')::uuid;
  IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  observed:=(body->>'bottle_count')::integer; IF observed<=0 THEN PERFORM app.fail('INVALID_QUANTITY'); END IF;
  loss:=app.positive(coalesce(body->>'loss_l','0'),true); q:=observed*skurow.fill_l;
  PERFORM app.debit(op.id,p.id,q+loss);
  INSERT INTO app.ledger(tenant_id,operation_id,lot_id,account,quantity_l) VALUES(tid,op.id,p.lot_id,'bottling',q);
  IF loss>0 THEN INSERT INTO app.ledger(tenant_id,operation_id,lot_id,account,quantity_l) VALUES(tid,op.id,p.lot_id,'loss',loss); END IF;
  INSERT INTO app.bottling(tenant_id,operation_id,lot_id,sku_id,code,bottle_count,fill_l,loss_l,stock_authority,occurred_at,created_by)
   VALUES(tid,op.id,p.lot_id,skurow.id,body->>'code',observed,skurow.fill_l,loss,CASE WHEN mode='erp' THEN 'erp' ELSE 'app' END,op.occurred_at,actor) RETURNING id INTO entity_id;
 ELSIF cmd='task_create' THEN
  INSERT INTO app.task(tenant_id,title,description,due_at,assignee_id,lot_id,vineyard_id,checklist,created_by) VALUES(tid,body->>'title',coalesce(body->>'description',''),(body->>'due_at')::timestamptz,body->>'assignee_id',(body->>'lot_id')::uuid,(body->>'vineyard_id')::uuid,coalesce(body->'checklist','[]'),actor) RETURNING id INTO entity_id;
 ELSIF cmd='task_update' THEN
  SELECT * INTO taskrow FROM app.task WHERE tenant_id=tid AND id=(body->>'task_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  IF app.role() NOT IN ('owner','oenologist','office') AND taskrow.assignee_id IS DISTINCT FROM actor AND taskrow.created_by<>actor THEN PERFORM app.fail('FORBIDDEN'); END IF;
  PERFORM app.require_version(taskrow.version,body->'expected_version');
  UPDATE app.task SET status=body->>'status',checklist=coalesce(body->'checklist',checklist),version=version+1 WHERE tenant_id=tid AND id=taskrow.id;
  entity_id:=taskrow.id;
 ELSIF cmd='note_add' THEN
  INSERT INTO app.note(tenant_id,lot_id,vineyard_id,body,captured_at,created_by) VALUES(tid,(body->>'lot_id')::uuid,(body->>'vineyard_id')::uuid,body->>'body',coalesce((body->>'captured_at')::timestamptz,now()),actor) RETURNING id INTO entity_id;
 ELSIF cmd='member_set' THEN
  IF app.role()<>'owner' THEN PERFORM app.fail('FORBIDDEN'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.auth_user WHERE id=body->>'user_id') THEN PERFORM app.fail('NOT_FOUND'); END IF;
  IF body->>'user_id'=actor AND body->>'role'<>'owner' THEN PERFORM app.fail('CANNOT_REMOVE_SELF_OWNER'); END IF;
  INSERT INTO app.membership(tenant_id,user_id,role,scope) VALUES(tid,body->>'user_id',body->>'role',coalesce(body->'scope','[]')) ON CONFLICT(tenant_id,user_id) DO UPDATE SET role=excluded.role,scope=excluded.scope;
  entity_id:=tid;
 ELSIF cmd='export_snapshot' THEN
  INSERT INTO app.export_artifact(tenant_id,kind,snapshot,created_by) VALUES(tid,body->>'kind',body->'snapshot',actor) RETURNING id INTO entity_id;
 ELSE PERFORM app.fail('UNKNOWN_COMMAND');
 END IF;
 -- Every material movement must conserve litres across stock and explicit external accounts.
 SELECT coalesce(sum(quantity_l),0) INTO total FROM app.ledger WHERE tenant_id=tid AND operation_id=op.id;
 IF total<>0 THEN PERFORM app.fail('LEDGER_UNBALANCED'); END IF;
 reply:=reply||jsonb_build_object('id',entity_id,'operation_id',op.id,'recorded_at',op.recorded_at);
 UPDATE app.operation SET result=reply WHERE tenant_id=tid AND id=op.id;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,cmd,entity_id,jsonb_build_object('operation_id',op.id,'payload',body));
 INSERT INTO app.outbox(tenant_id,event_type,aggregate_id,data) VALUES(tid,cmd||'.completed',entity_id,reply);
 RETURN reply;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
