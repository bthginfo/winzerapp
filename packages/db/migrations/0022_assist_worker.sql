CREATE FUNCTION app.ai_connection(tid uuid,actor text,cid uuid) RETURNS TABLE(configuration jsonb,ciphertext text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);IF NOT app.is_member(tid) OR app.role()='external' THEN PERFORM app.fail('FORBIDDEN'); END IF;
 RETURN QUERY SELECT c.configuration,s.ciphertext FROM app.connection c JOIN app.connection_secret s ON s.tenant_id=c.tenant_id AND s.connection_id=c.id WHERE c.tenant_id=tid AND c.id=cid AND c.adapter='openai-compatible' AND c.enabled;
END $$;
CREATE FUNCTION app.worker_batch(maximum integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE t record; total jsonb:='[]';
BEGIN
 IF maximum<1 OR maximum>50 THEN PERFORM app.fail('INVALID_COMMAND'); END IF;
 FOR t IN SELECT DISTINCT o.tenant_id,(SELECT m.user_id FROM app.membership m WHERE m.tenant_id=o.tenant_id AND m.role='owner' ORDER BY m.created_at LIMIT 1) AS actor FROM app.outbox o WHERE o.status IN ('queued','retrying','ambiguous','running') AND o.available_at<=now() LIMIT maximum LOOP
  total:=total||jsonb_build_array(jsonb_build_object('tenant_id',t.tenant_id,'processed',app.process_jobs(t.tenant_id,t.actor,20)));
 END LOOP;RETURN total;
END $$;
REVOKE ALL ON FUNCTION app.ai_connection(uuid,text,uuid),app.worker_batch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.ai_connection(uuid,text,uuid),app.worker_batch(integer) TO vinea_runtime;
CREATE OR REPLACE FUNCTION app.command(tid uuid,actor text,key text,body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,public AS $$
DECLARE cmd text:=body->>'type'; op app.operation; h text:=encode(public.digest(body::text,'sha256'),'hex'); eid uuid; linked uuid; q numeric; volume numeric; used numeric; rec record; item jsonb; reply jsonb:='{}'; materialrow app.material_item; positionrow app.position; mid uuid; version_now integer;
BEGIN
 IF cmd NOT IN ('season_create','field_record','field_approve','maturity_record','resource_create','harvest_plan','harvest_plan_update','harvest_transform','fermentation_start','fermentation_update','lab_rule_create','material_create','material_receive','treatment_record','cleaning_record','maintenance_create','maintenance_update','cost_record','cost_allocate','bottling_plan','bottling_plan_cancel','bottling_execute','reference_record','packaged_dispatch','rule_set_create','rule_finding','weather_record','weather_rule_create','sensor_create','sensor_disable','blend_brief','vineyard_geometry','connection_create','connection_update','external_map') THEN RETURN app.core_command(tid,actor,key,body); END IF;
 IF tid IS NULL OR actor IS NULL OR key IS NULL OR length(key)<8 OR length(key)>120 THEN PERFORM app.fail('INVALID_COMMAND'); END IF;
 PERFORM set_config('app.tenant_id',tid::text,true); PERFORM set_config('app.actor_id',actor,true);
 IF NOT app.is_member(tid) OR app.role()='external' THEN PERFORM app.fail('FORBIDDEN'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0));
 SELECT * INTO op FROM app.operation WHERE tenant_id=tid AND idempotency_key=key;
 IF FOUND THEN IF op.payload_hash<>h THEN PERFORM app.fail('IDEMPOTENCY_CONFLICT'); END IF; RETURN op.result; END IF;
 IF cmd IN ('season_create','field_record','maturity_record','harvest_plan','harvest_plan_update','vineyard_geometry') THEN PERFORM app.require_role(ARRAY['owner','oenologist','vineyard']);
 ELSIF cmd IN ('field_approve','lab_rule_create','rule_set_create','rule_finding','blend_brief','sensor_create','sensor_disable') THEN PERFORM app.require_role(ARRAY['owner','oenologist']);
 ELSIF cmd IN ('weather_record','weather_rule_create') THEN PERFORM app.require_role(ARRAY['owner','oenologist','office','vineyard']);
 ELSIF cmd IN ('cost_record','cost_allocate','connection_create','connection_update','external_map','resource_create','weather_record','weather_rule_create') THEN PERFORM app.require_role(ARRAY['owner','oenologist','office']);
 ELSE PERFORM app.require_role(ARRAY['owner','oenologist','cellar']); END IF;
 IF (SELECT mode FROM app.tenant WHERE id=tid)='companion' AND cmd IN ('harvest_transform','treatment_record','bottling_execute','packaged_dispatch') THEN PERFORM app.fail('COMPANION_READ_ONLY'); END IF;
 INSERT INTO app.operation(tenant_id,kind,idempotency_key,payload_hash,payload,occurred_at,actor_id,reason) VALUES(tid,cmd,key,h,body,coalesce((body->>'occurred_at')::timestamptz,now()),actor,coalesce(body->>'reason','')) RETURNING * INTO op;
 IF cmd='season_create' THEN
  INSERT INTO app.block_season(tenant_id,vineyard_id,vintage,management,planned_kg,created_by) VALUES(tid,(body->>'vineyard_id')::uuid,(body->>'vintage')::int,body->>'management',app.positive(body->>'planned_kg',true),actor) RETURNING id INTO eid;
 ELSIF cmd='field_record' THEN
  IF body->>'season_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app.block_season WHERE tenant_id=tid AND id=(body->>'season_id')::uuid AND vineyard_id=(body->>'vineyard_id')::uuid) THEN PERFORM app.fail('SEASON_MISMATCH'); END IF;
  IF app.positive(body->>'area_ha')>(SELECT area_ha FROM app.vineyard WHERE tenant_id=tid AND id=(body->>'vineyard_id')::uuid) THEN PERFORM app.fail('AREA_EXCEEDED'); END IF;
  IF body->>'kind'='protection' AND (length(coalesce(body->>'product',''))=0 OR length(coalesce(body->>'authorization',''))=0 OR length(coalesce(body->>'source',''))=0) THEN PERFORM app.fail('TREATMENT_EVIDENCE_REQUIRED'); END IF;
  INSERT INTO app.field_operation(tenant_id,vineyard_id,season_id,kind,description,performed_at,hours,area_ha,product,product_batch,quantity,unit,operator,authorization_ref,source,created_by) VALUES(tid,(body->>'vineyard_id')::uuid,(body->>'season_id')::uuid,body->>'kind',body->>'description',(body->>'performed_at')::timestamptz,app.positive(body->>'hours',true),app.positive(body->>'area_ha'),coalesce(body->>'product',''),coalesce(body->>'product_batch',''),app.positive(body->>'quantity',true),body->>'unit',body->>'operator',coalesce(body->>'authorization',''),coalesce(body->>'source',''),actor) RETURNING id INTO eid;
 ELSIF cmd='field_approve' THEN
  SELECT version INTO version_now FROM app.field_operation WHERE tenant_id=tid AND id=(body->>'field_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(version_now,body->'expected_version');
  UPDATE app.field_operation SET approved_by=actor,approved_at=now(),version=version+1 WHERE tenant_id=tid AND id=(body->>'field_id')::uuid RETURNING id INTO eid;
 ELSIF cmd='maturity_record' THEN
  IF body->>'season_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app.block_season WHERE tenant_id=tid AND id=(body->>'season_id')::uuid AND vineyard_id=(body->>'vineyard_id')::uuid) THEN PERFORM app.fail('SEASON_MISMATCH'); END IF;
  INSERT INTO app.maturity_sample(tenant_id,vineyard_id,season_id,code,sampled_at,location,sugar,sugar_unit,acidity,ph,method,quality,created_by) VALUES(tid,(body->>'vineyard_id')::uuid,(body->>'season_id')::uuid,body->>'code',(body->>'sampled_at')::timestamptz,body->>'location',(body->>'sugar')::numeric,body->>'sugar_unit',(body->>'acidity')::numeric,(body->>'ph')::numeric,body->>'method',body->>'quality',actor) RETURNING id INTO eid;
 ELSIF cmd='resource_create' THEN
  INSERT INTO app.resource(tenant_id,name,kind,description,status,created_by) VALUES(tid,body->>'name',body->>'kind',coalesce(body->>'description',''),'ready',actor) RETURNING id INTO eid;
 ELSIF cmd='harvest_plan' THEN
  IF body->>'resource_id' IS NOT NULL AND EXISTS(SELECT 1 FROM app.harvest_plan WHERE tenant_id=tid AND resource_id=(body->>'resource_id')::uuid AND status NOT IN ('cancelled','completed') AND starts_at<(body->>'ends_at')::timestamptz AND ends_at>(body->>'starts_at')::timestamptz) THEN PERFORM app.fail('RESOURCE_CONFLICT'); END IF;
  IF body->>'resource_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app.resource WHERE tenant_id=tid AND id=(body->>'resource_id')::uuid AND status='ready') THEN PERFORM app.fail('RESOURCE_BLOCKED'); END IF;
  IF body->>'target_vessel_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app.vessel WHERE tenant_id=tid AND id=(body->>'target_vessel_id')::uuid AND status='ready') THEN PERFORM app.fail('VESSEL_BLOCKED'); END IF;
  INSERT INTO app.harvest_plan(tenant_id,vineyard_id,vintage,planned_kg,starts_at,ends_at,resource_id,target_vessel_id,supplier,instructions,created_by) VALUES(tid,(body->>'vineyard_id')::uuid,(body->>'vintage')::int,app.positive(body->>'planned_kg'),(body->>'starts_at')::timestamptz,(body->>'ends_at')::timestamptz,(body->>'resource_id')::uuid,(body->>'target_vessel_id')::uuid,body->>'supplier',body->>'instructions',actor) RETURNING id INTO eid;
 ELSIF cmd='harvest_plan_update' THEN
  SELECT version INTO version_now FROM app.harvest_plan WHERE tenant_id=tid AND id=(body->>'plan_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(version_now,body->'expected_version');
  UPDATE app.harvest_plan SET status=body->>'status',version=version+1 WHERE tenant_id=tid AND id=(body->>'plan_id')::uuid RETURNING id INTO eid;
 ELSIF cmd='harvest_transform' THEN
  q:=app.positive(body->>'input_kg'); volume:=app.positive(body->>'output_l');
  SELECT * INTO rec FROM app.harvest WHERE tenant_id=tid AND id=(body->>'harvest_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  IF q+coalesce((SELECT sum(input_kg) FROM app.harvest_yield WHERE tenant_id=tid AND harvest_id=rec.id),0)>rec.quantity_kg THEN PERFORM app.fail('HARVEST_EXCEEDED'); END IF;
  INSERT INTO app.lot(tenant_id,code,name,grape,vintage,cost_per_l,material,harvest_id,created_by) VALUES(tid,body->>'code',body->>'name',(SELECT grape FROM app.vineyard WHERE tenant_id=tid AND id=rec.vineyard_id),rec.vintage,app.positive(body->>'cost_per_l',true),'must',rec.id,actor) RETURNING id INTO eid;
  PERFORM app.credit(op.id,eid,(body->>'target_vessel_id')::uuid,volume);
  INSERT INTO app.ledger(tenant_id,operation_id,lot_id,account,quantity_l) VALUES(tid,op.id,eid,'transformation',-volume);
  INSERT INTO app.harvest_yield(tenant_id,harvest_id,lot_id,operation_id,input_kg,output_l,byproduct_kg,created_by) VALUES(tid,rec.id,eid,op.id,q,volume,app.positive(body->>'byproduct_kg',true),actor);
 ELSIF cmd='fermentation_start' THEN
  IF EXISTS(SELECT 1 FROM app.fermentation_run WHERE tenant_id=tid AND lot_id=(body->>'lot_id')::uuid AND status IN ('active','paused')) THEN PERFORM app.fail('FERMENTATION_EXISTS'); END IF;
  INSERT INTO app.fermentation_run(tenant_id,lot_id,name,starts_at,status,yeast,target_temperature,notes,created_by) VALUES(tid,(body->>'lot_id')::uuid,body->>'name',(body->>'starts_at')::timestamptz,'active',body->>'yeast',(body->>'target_temperature')::numeric,coalesce(body->>'notes',''),actor) RETURNING id INTO eid;
 ELSIF cmd='fermentation_update' THEN
  SELECT * INTO rec FROM app.fermentation_run WHERE tenant_id=tid AND id=(body->>'run_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(rec.version,body->'expected_version');
  IF rec.status='completed' THEN PERFORM app.fail('ALREADY_COMPLETED'); END IF;
  UPDATE app.fermentation_run SET status=body->>'status',ends_at=CASE WHEN body->>'status'='completed' THEN (body->>'ends_at')::timestamptz ELSE NULL END,version=version+1 WHERE tenant_id=tid AND id=rec.id RETURNING id INTO eid;
 ELSIF cmd='lab_rule_create' THEN
  INSERT INTO app.lab_rule(tenant_id,name,lot_id,parameter,unit,method,minimum,maximum,max_age_hours,created_by) VALUES(tid,body->>'name',(body->>'lot_id')::uuid,body->>'parameter',body->>'unit',body->>'method',(body->>'minimum')::numeric,(body->>'maximum')::numeric,(body->>'max_age_hours')::int,actor) RETURNING id INTO eid;
 ELSIF cmd='material_create' THEN
  INSERT INTO app.material_item(tenant_id,code,name,kind,unit,cost_per_unit,reorder_at,created_by) VALUES(tid,body->>'code',body->>'name',body->>'kind',body->>'unit',app.positive(body->>'cost_per_unit',true),app.positive(body->>'reorder_at',true),actor) RETURNING id INTO eid;
 ELSIF cmd='material_receive' THEN
  SELECT * INTO rec FROM app.material_item WHERE tenant_id=tid AND id=(body->>'material_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(rec.version,body->'expected_version');
  q:=app.positive(body->>'quantity'); IF rec.unit='piece' AND q<>trunc(q) THEN PERFORM app.fail('WHOLE_PIECES_REQUIRED'); END IF;
  INSERT INTO app.material_movement(tenant_id,material_id,operation_id,quantity,batch,reason,created_by) VALUES(tid,rec.id,op.id,q,body->>'batch',body->>'reason',actor) RETURNING id INTO eid;
  UPDATE app.material_item SET version=version+1 WHERE tenant_id=tid AND id=rec.id;
 ELSIF cmd='treatment_record' THEN
  SELECT * INTO positionrow FROM app.position WHERE tenant_id=tid AND id=(body->>'position_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(positionrow.version,body->'expected_version');
  IF (SELECT blocked FROM app.lot WHERE tenant_id=tid AND id=positionrow.lot_id) THEN PERFORM app.fail('BLOCKED_SOURCE'); END IF;
  SELECT * INTO rec FROM app.material_item WHERE tenant_id=tid AND id=(body->>'material_id')::uuid FOR UPDATE; IF NOT FOUND OR rec.kind<>'treatment' THEN PERFORM app.fail('INVALID_MATERIAL'); END IF;
  q:=app.positive(body->>'quantity'); volume:=app.positive(body->>'added_volume_l',true);
  IF (rec.unit='l' AND volume<>q) OR (rec.unit='ml' AND volume<>q/1000) OR (rec.unit IN ('kg','g','piece') AND volume<>0) THEN PERFORM app.fail('UNIT_MISMATCH'); END IF;
  IF q>app.material_available(rec.id) THEN PERFORM app.fail('INSUFFICIENT_MATERIAL'); END IF;
  IF volume>0 THEN PERFORM app.credit(op.id,positionrow.lot_id,positionrow.vessel_id,volume); INSERT INTO app.ledger(tenant_id,operation_id,lot_id,account,quantity_l) VALUES(tid,op.id,positionrow.lot_id,'addition',-volume);
  ELSE UPDATE app.position SET version=version+1 WHERE tenant_id=tid AND id=positionrow.id; END IF;
  INSERT INTO app.material_movement(tenant_id,material_id,operation_id,quantity,batch,reason,lot_id,created_by) VALUES(tid,rec.id,op.id,-q,body->>'batch',body->>'reason',positionrow.lot_id,actor) RETURNING id INTO eid;
  UPDATE app.material_item SET version=version+1 WHERE tenant_id=tid AND id=rec.id;
  INSERT INTO app.cost_entry(tenant_id,lot_id,operation_id,category,amount,currency,basis,description,created_by) VALUES(tid,positionrow.lot_id,op.id,'material',q*rec.cost_per_unit,'EUR','actual',body->>'reason',actor);
 ELSIF cmd='cleaning_record' THEN
  IF body->>'result'='ready' AND EXISTS(SELECT 1 FROM jsonb_array_elements(body->'checklist') c WHERE NOT (c->>'done')::boolean) THEN PERFORM app.fail('CHECKLIST_INCOMPLETE'); END IF;
  IF body->>'vessel_id' IS NOT NULL THEN SELECT version INTO version_now FROM app.vessel WHERE tenant_id=tid AND id=(body->>'vessel_id')::uuid FOR UPDATE; ELSE SELECT version INTO version_now FROM app.resource WHERE tenant_id=tid AND id=(body->>'resource_id')::uuid FOR UPDATE; END IF;
  IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(version_now,body->'expected_version');
  INSERT INTO app.cleaning_record(tenant_id,vessel_id,resource_id,performed_at,method,product,product_batch,quantity,unit,checklist,result,verified_by,created_by) VALUES(tid,(body->>'vessel_id')::uuid,(body->>'resource_id')::uuid,(body->>'performed_at')::timestamptz,body->>'method',body->>'product',coalesce(body->>'product_batch',''),app.positive(body->>'quantity',true),body->>'unit',body->'checklist',body->>'result',body->>'verified_by',actor) RETURNING id INTO eid;
  UPDATE app.vessel SET status=body->>'result',version=version+1 WHERE tenant_id=tid AND id=(body->>'vessel_id')::uuid;
  UPDATE app.resource SET status=body->>'result',version=version+1 WHERE tenant_id=tid AND id=(body->>'resource_id')::uuid;
 ELSIF cmd='maintenance_create' THEN
  INSERT INTO app.maintenance_record(tenant_id,vessel_id,resource_id,title,performed_at,due_at,findings,status,created_by) VALUES(tid,(body->>'vessel_id')::uuid,(body->>'resource_id')::uuid,body->>'title',(body->>'performed_at')::timestamptz,(body->>'due_at')::timestamptz,body->>'findings','open',actor) RETURNING id INTO eid;
  UPDATE app.vessel SET status='blocked',version=version+1 WHERE tenant_id=tid AND id=(body->>'vessel_id')::uuid;
  UPDATE app.resource SET status='blocked',version=version+1 WHERE tenant_id=tid AND id=(body->>'resource_id')::uuid;
 ELSIF cmd='maintenance_update' THEN
  SELECT version INTO version_now FROM app.maintenance_record WHERE tenant_id=tid AND id=(body->>'maintenance_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(version_now,body->'expected_version');
  UPDATE app.maintenance_record SET status=body->>'status',findings=body->>'findings',version=version+1 WHERE tenant_id=tid AND id=(body->>'maintenance_id')::uuid RETURNING id INTO eid;
  -- Only a separate verified cleaning record releases the equipment after maintenance.
 ELSIF cmd='cost_record' THEN
  q:=(body->>'amount')::numeric; IF q=0 THEN PERFORM app.fail('INVALID_QUANTITY'); END IF;
  IF q<0 AND body->>'correction_of' IS NULL THEN PERFORM app.fail('REASON_REQUIRED'); END IF;
  IF body->>'correction_of' IS NOT NULL THEN
   SELECT * INTO rec FROM app.cost_entry WHERE tenant_id=tid AND id=(body->>'correction_of')::uuid; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
   IF rec.lot_id IS DISTINCT FROM (body->>'lot_id')::uuid OR rec.vineyard_id IS DISTINCT FROM (body->>'vineyard_id')::uuid OR rec.bottling_id IS DISTINCT FROM (body->>'bottling_id')::uuid OR rec.basis<>body->>'basis' OR rec.category<>body->>'category' OR q>=0 OR -q>rec.amount+coalesce((SELECT sum(amount) FROM app.cost_entry WHERE tenant_id=tid AND correction_of=rec.id),0) THEN PERFORM app.fail('COST_CORRECTION_INVALID'); END IF;
   IF EXISTS(SELECT 1 FROM app.cost_allocation WHERE tenant_id=tid AND cost_id=rec.id) THEN PERFORM app.fail('COST_ALREADY_ALLOCATED'); END IF;
  END IF;
  INSERT INTO app.cost_entry(tenant_id,lot_id,vineyard_id,bottling_id,operation_id,category,amount,currency,basis,description,invoice,correction_of,created_by) VALUES(tid,(body->>'lot_id')::uuid,(body->>'vineyard_id')::uuid,(body->>'bottling_id')::uuid,op.id,body->>'category',q,'EUR',body->>'basis',body->>'description',coalesce(body->>'invoice',''),(body->>'correction_of')::uuid,actor) RETURNING id INTO eid;
 ELSIF cmd='cost_allocate' THEN
  SELECT * INTO rec FROM app.cost_entry WHERE tenant_id=tid AND id=(body->>'cost_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  IF rec.lot_id IS NOT NULL OR rec.bottling_id IS NOT NULL OR rec.correction_of IS NOT NULL OR EXISTS(SELECT 1 FROM app.cost_entry WHERE tenant_id=tid AND correction_of=rec.id) THEN PERFORM app.fail('COST_ALREADY_ALLOCATED'); END IF;
  q:=app.positive(body->>'amount'); IF q+coalesce((SELECT sum(amount) FROM app.cost_allocation WHERE tenant_id=tid AND cost_id=rec.id),0)>rec.amount THEN PERFORM app.fail('COST_ALLOCATION_EXCEEDED'); END IF;
  INSERT INTO app.cost_allocation(tenant_id,cost_id,lot_id,amount,basis,created_by) VALUES(tid,rec.id,(body->>'lot_id')::uuid,q,body->>'basis',actor) RETURNING id INTO eid;
 ELSIF cmd='bottling_plan' THEN
  IF jsonb_array_length(body->'requirements')=0 THEN PERFORM app.fail('MATERIAL_REQUIREMENTS_REQUIRED'); END IF;
  IF (SELECT count(DISTINCT x->>'material_id') FROM jsonb_array_elements(body->'requirements') x)<>jsonb_array_length(body->'requirements') THEN PERFORM app.fail('DUPLICATE_MATERIAL'); END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(body->'requirements') LOOP IF NOT EXISTS(SELECT 1 FROM app.material_item WHERE tenant_id=tid AND id=(item->>'material_id')::uuid AND kind IN ('bottle','closure','label','box','other')) THEN PERFORM app.fail('INVALID_MATERIAL'); END IF; PERFORM app.positive(item->>'per_bottle'); END LOOP;
  INSERT INTO app.bottling_plan(tenant_id,name,position_id,sku_id,bottle_count,loss_l,starts_at,supplier,requirements,created_by) VALUES(tid,body->>'name',(body->>'position_id')::uuid,(body->>'sku_id')::uuid,(body->>'bottle_count')::int,app.positive(body->>'loss_l',true),(body->>'starts_at')::timestamptz,body->>'supplier',body->'requirements',actor) RETURNING id INTO eid;
 ELSIF cmd='bottling_plan_cancel' THEN
  SELECT * INTO rec FROM app.bottling_plan WHERE tenant_id=tid AND id=(body->>'plan_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(rec.version,body->'expected_version'); IF rec.status<>'planned' THEN PERFORM app.fail('ALREADY_COMPLETED'); END IF;
  UPDATE app.bottling_plan SET status='cancelled',version=version+1 WHERE tenant_id=tid AND id=rec.id RETURNING id INTO eid;
 ELSIF cmd='bottling_execute' THEN
  SELECT * INTO rec FROM app.bottling_plan WHERE tenant_id=tid AND id=(body->>'plan_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(rec.version,body->'expected_version'); IF rec.status<>'planned' THEN PERFORM app.fail('ALREADY_COMPLETED'); END IF;
  reply:=app.core_command(tid,actor,'bottle-'||encode(public.digest(key,'sha256'),'hex'),jsonb_build_object('type','bottle','position_id',rec.position_id,'expected_version',body->'position_version','sku_id',rec.sku_id,'code',body->>'code','bottle_count',(body->>'bottle_count')::int,'loss_l',body->>'loss_l','occurred_at',op.occurred_at));
  eid:=(reply->>'id')::uuid;
  FOR item IN SELECT * FROM jsonb_array_elements(rec.requirements) ORDER BY value->>'material_id' LOOP
   mid:=(item->>'material_id')::uuid; SELECT * INTO materialrow FROM app.material_item WHERE tenant_id=tid AND id=mid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('INVALID_MATERIAL'); END IF;
   q:=app.positive(item->>'per_bottle')*(body->>'bottle_count')::integer; IF materialrow.unit='piece' THEN q:=ceil(q); END IF;
   IF q>app.material_available(mid) THEN PERFORM app.fail('INSUFFICIENT_MATERIAL'); END IF;
   INSERT INTO app.material_movement(tenant_id,material_id,operation_id,quantity,batch,reason,bottling_id,created_by) VALUES(tid,mid,op.id,-q,coalesce(item->>'batch',''),'bottling',eid,actor);
   UPDATE app.material_item SET version=version+1 WHERE tenant_id=tid AND id=mid;
   INSERT INTO app.cost_entry(tenant_id,bottling_id,operation_id,category,amount,currency,basis,description,created_by) VALUES(tid,eid,op.id,'material',q*materialrow.cost_per_unit,'EUR','actual',materialrow.name,actor);
  END LOOP;
  UPDATE app.bottling_plan SET status='completed',bottling_id=eid,version=version+1 WHERE tenant_id=tid AND id=rec.id;
 ELSIF cmd='reference_record' THEN
  INSERT INTO app.reference_sample(tenant_id,lot_id,bottling_id,trial_id,code,location,sampled_at,review_at,description,created_by) VALUES(tid,(body->>'lot_id')::uuid,(body->>'bottling_id')::uuid,(body->>'trial_id')::uuid,body->>'code',body->>'location',(body->>'sampled_at')::timestamptz,(body->>'review_at')::timestamptz,body->>'description',actor) RETURNING id INTO eid;
 ELSIF cmd='packaged_dispatch' THEN
  SELECT * INTO rec FROM app.bottling WHERE tenant_id=tid AND id=(body->>'bottling_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  IF rec.stock_authority<>'app' THEN PERFORM app.fail('ERP_STOCK_AUTHORITY'); END IF;
  q:=(body->>'quantity')::int; IF q<=0 THEN PERFORM app.fail('INVALID_QUANTITY'); END IF;
  IF body->>'kind'='dispatch' THEN q:=-q; ELSIF body->>'kind'='return' THEN IF q> -coalesce((SELECT sum(quantity) FROM app.packaged_movement WHERE tenant_id=tid AND bottling_id=rec.id),0) THEN PERFORM app.fail('RETURN_EXCEEDED'); END IF; ELSE PERFORM app.fail('INVALID_COMMAND'); END IF;
  IF rec.bottle_count+coalesce((SELECT sum(quantity) FROM app.packaged_movement WHERE tenant_id=tid AND bottling_id=rec.id),0)+q<0 THEN PERFORM app.fail('INSUFFICIENT_PACKAGED_STOCK'); END IF;
  INSERT INTO app.packaged_movement(tenant_id,bottling_id,quantity,kind,reason,external_reference,operation_id,created_by) VALUES(tid,rec.id,q,body->>'kind',body->>'reason',coalesce(body->>'external_reference',''),op.id,actor) RETURNING id INTO eid;
 ELSIF cmd='rule_set_create' THEN
  INSERT INTO app.rule_set(tenant_id,name,jurisdiction,valid_from,valid_to,source,reviewer,rules,tests,approved_at,supersedes,created_by) VALUES(tid,body->>'name',body->>'jurisdiction',(body->>'valid_from')::date,(body->>'valid_to')::date,body->>'source',body->>'reviewer',body->'rules',body->'tests',now(),(body->>'supersedes')::uuid,actor) RETURNING id INTO eid;
 ELSIF cmd='rule_finding' THEN
  INSERT INTO app.validation_finding(tenant_id,rule_set_id,lot_id,checked_at,outcome,findings,snapshot,created_by) VALUES(tid,(body->>'rule_set_id')::uuid,(body->>'lot_id')::uuid,now(),body->>'outcome',body->'findings',body->'snapshot',actor) RETURNING id INTO eid;
 ELSIF cmd='weather_record' THEN
  INSERT INTO app.weather_snapshot(tenant_id,vineyard_id,provider,issued_at,latitude,longitude,source,data,created_by) VALUES(tid,(body->>'vineyard_id')::uuid,body->>'provider',(body->>'issued_at')::timestamptz,(body->>'latitude')::numeric,(body->>'longitude')::numeric,body->>'source',body->'data',actor) RETURNING id INTO eid;
 ELSIF cmd='weather_rule_create' THEN
  INSERT INTO app.weather_rule(tenant_id,vineyard_id,name,parameter,maximum,minimum,created_by) VALUES(tid,(body->>'vineyard_id')::uuid,body->>'name',body->>'parameter',(body->>'maximum')::numeric,(body->>'minimum')::numeric,actor) RETURNING id INTO eid;
 ELSIF cmd='sensor_create' THEN
  INSERT INTO app.sensor(tenant_id,name,lot_id,parameter,unit,method,token_hash,created_by) VALUES(tid,body->>'name',(body->>'lot_id')::uuid,body->>'parameter',body->>'unit',body->>'method',body->>'token_hash',actor) RETURNING id INTO eid;
 ELSIF cmd='sensor_disable' THEN
  SELECT version INTO version_now FROM app.sensor WHERE tenant_id=tid AND id=(body->>'sensor_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(version_now,body->'expected_version');
  UPDATE app.sensor SET enabled=false,version=version+1 WHERE tenant_id=tid AND id=(body->>'sensor_id')::uuid RETURNING id INTO eid;
 ELSIF cmd='blend_brief' THEN
  IF EXISTS(SELECT 1 FROM app.blend_brief WHERE tenant_id=tid AND project_id=(body->>'project_id')::uuid) THEN
   SELECT version INTO version_now FROM app.blend_brief WHERE tenant_id=tid AND project_id=(body->>'project_id')::uuid FOR UPDATE; PERFORM app.require_version(version_now,body->'expected_version');
   UPDATE app.blend_brief SET style=body->>'style',budget=(body->>'budget')::numeric,targets=body->'targets',share_limits=body->'share_limits',reference_lot_id=(body->>'reference_lot_id')::uuid,version=version+1 WHERE tenant_id=tid AND project_id=(body->>'project_id')::uuid RETURNING id INTO eid;
  ELSE INSERT INTO app.blend_brief(tenant_id,project_id,style,budget,targets,share_limits,reference_lot_id,created_by) VALUES(tid,(body->>'project_id')::uuid,body->>'style',(body->>'budget')::numeric,body->'targets',body->'share_limits',(body->>'reference_lot_id')::uuid,actor) RETURNING id INTO eid; END IF;
 ELSIF cmd='vineyard_geometry' THEN
  SELECT version INTO version_now FROM app.vineyard WHERE tenant_id=tid AND id=(body->>'vineyard_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(version_now,body->'expected_version');
  IF NOT public.ST_IsValid(public.ST_GeomFromGeoJSON(body->>'geometry')) OR public.ST_GeometryType(public.ST_GeomFromGeoJSON(body->>'geometry'))<>'ST_Polygon' THEN PERFORM app.fail('INVALID_GEOMETRY'); END IF;
  UPDATE app.vineyard SET geometry=body->'geometry',boundary=public.ST_SetSRID(public.ST_GeomFromGeoJSON(body->>'geometry'),4326)::public.geography,version=version+1 WHERE tenant_id=tid AND id=(body->>'vineyard_id')::uuid RETURNING id INTO eid;
 ELSIF cmd='connection_create' THEN
  INSERT INTO app.connection(tenant_id,name,adapter,capabilities,authority,created_by) VALUES(tid,body->>'name',body->>'adapter',body->'capabilities',body->'authority',actor) RETURNING id INTO eid;
 ELSIF cmd='connection_update' THEN
  SELECT version INTO version_now FROM app.connection WHERE tenant_id=tid AND id=(body->>'connection_id')::uuid FOR UPDATE; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF; PERFORM app.require_version(version_now,body->'expected_version');
  UPDATE app.connection SET enabled=(body->>'enabled')::boolean,authority=body->'authority',version=version+1 WHERE tenant_id=tid AND id=(body->>'connection_id')::uuid RETURNING id INTO eid;
 ELSIF cmd='external_map' THEN
  IF body->>'entity_type'='sku' THEN PERFORM 1 FROM app.sku WHERE tenant_id=tid AND id=(body->>'internal_id')::uuid;
  ELSIF body->>'entity_type'='lot' THEN PERFORM 1 FROM app.lot WHERE tenant_id=tid AND id=(body->>'internal_id')::uuid;
  ELSIF body->>'entity_type'='vineyard' THEN PERFORM 1 FROM app.vineyard WHERE tenant_id=tid AND id=(body->>'internal_id')::uuid;
  ELSIF body->>'entity_type'='material' THEN PERFORM 1 FROM app.material_item WHERE tenant_id=tid AND id=(body->>'internal_id')::uuid;
  ELSE PERFORM app.fail('INVALID_COMMAND'); END IF; IF NOT FOUND THEN PERFORM app.fail('NOT_FOUND'); END IF;
  INSERT INTO app.external_reference(tenant_id,connection_id,entity_type,internal_id,external_id,created_by) VALUES(tid,(body->>'connection_id')::uuid,body->>'entity_type',(body->>'internal_id')::uuid,body->>'external_id',actor) RETURNING id INTO eid;
 ELSE PERFORM app.fail('UNKNOWN_COMMAND'); END IF;
 IF (SELECT coalesce(sum(quantity_l),0) FROM app.ledger WHERE tenant_id=tid AND operation_id=op.id)<>0 THEN PERFORM app.fail('LEDGER_UNBALANCED'); END IF;
 reply:=reply||jsonb_build_object('id',eid,'operation_id',op.id,'recorded_at',op.recorded_at);
 UPDATE app.operation SET result=reply WHERE tenant_id=tid AND id=op.id;
 INSERT INTO app.audit(tenant_id,actor_id,event_type,aggregate_id,data) VALUES(tid,actor,cmd,eid,jsonb_build_object('operation_id',op.id,'payload',body));
 INSERT INTO app.outbox(tenant_id,event_type,aggregate_id,data) VALUES(tid,cmd||'.completed',eid,reply);
 RETURN reply;
END $$;
REVOKE ALL ON FUNCTION app.command(uuid,text,text,jsonb),app.material_available(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.command(uuid,text,text,jsonb),app.material_available(uuid) TO vinea_runtime;
