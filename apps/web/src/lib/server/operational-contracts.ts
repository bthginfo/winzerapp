import { z } from 'zod';
const id=z.uuid(),name=z.string().trim().min(1).max(160),text=z.string().max(5000),version=z.number().int().positive(),date=z.iso.datetime({offset:true});
export const amount=z.string().regex(/^(0|[1-9]\d*)(\.\d{1,3})?$/).max(24);
const signed=z.string().regex(/^-?(0|[1-9]\d*)(\.\d{1,6})?$/).max(24),year=z.number().int().min(1900).max(2200),decimal=signed.optional();
const parameter=z.enum(['temperature','sugar','alcohol','acidity','ph','free_so2']);
const objectLink={lot_id:id.optional(),vineyard_id:id.optional(),bottling_id:id.optional()};
export const operationalDefs={
 season_create:{vineyard_id:id,vintage:year,management:name,planned_kg:amount},
 field_record:{vineyard_id:id,season_id:id.optional(),kind:z.enum(['pruning','soil','canopy','observation','protection','irrigation','harvest','other']),description:text.min(1),performed_at:date,hours:amount,area_ha:amount,product:name.optional(),product_batch:name.optional(),quantity:amount,unit:name,operator:name,authorization:text.optional(),source:text.optional()},
 field_approve:{field_id:id,expected_version:version,review_acknowledged:z.literal(true)},
 maturity_record:{vineyard_id:id,season_id:id.optional(),code:name,sampled_at:date,location:name,sugar:amount.optional(),sugar_unit:name,acidity:amount.optional(),ph:z.string().refine(s=>/^\d+(\.\d+)?$/.test(s)&&Number(s)<=14).optional(),method:name,quality:z.enum(['measured','estimated']).default('measured')},
 resource_create:{name,kind:z.enum(['team','machine','pump','equipment']),description:text.optional()},
 harvest_plan:{vineyard_id:id,vintage:year,planned_kg:amount,starts_at:date,ends_at:date,resource_id:id.optional(),target_vessel_id:id.optional(),supplier:name,instructions:text},
 harvest_plan_update:{plan_id:id,expected_version:version,status:z.enum(['planned','in_progress','completed','cancelled'])},
 harvest_transform:{harvest_id:id,input_kg:amount,output_l:amount,byproduct_kg:amount,code:name,name,target_vessel_id:id,cost_per_l:amount},
 fermentation_start:{lot_id:id,name,starts_at:date,yeast:name,target_temperature:decimal,notes:text.optional()},
 fermentation_update:{run_id:id,expected_version:version,status:z.enum(['active','paused','completed']),ends_at:date},
 lab_rule_create:{name,lot_id:id.optional(),parameter,unit:name,method:name,minimum:decimal,maximum:decimal,max_age_hours:z.number().int().min(1).max(87600)},
 material_create:{code:name,name,kind:z.enum(['bottle','closure','label','box','treatment','cleaner','other']),unit:z.enum(['piece','kg','g','l','ml']),cost_per_unit:amount,reorder_at:amount},
 material_receive:{material_id:id,expected_version:version,quantity:amount,batch:name,reason:text.min(5)},
 treatment_record:{position_id:id,expected_version:version,material_id:id,quantity:amount,added_volume_l:amount,batch:name,reason:text.min(5),authorization:text.min(1),operator:name},
 cleaning_record:{vessel_id:id.optional(),resource_id:id.optional(),expected_version:version,performed_at:date,method:name,product:name,product_batch:name.optional(),quantity:amount,unit:name,checklist:z.array(z.object({label:name,done:z.boolean()})).min(1).max(50),result:z.enum(['ready','blocked']),verified_by:name},
 maintenance_create:{vessel_id:id.optional(),resource_id:id.optional(),title:name,performed_at:date,due_at:date.optional(),findings:text},
 maintenance_update:{maintenance_id:id,expected_version:version,status:z.enum(['open','doing','done']),findings:text},
 cost_record:{...objectLink,category:z.enum(['work','material','service','energy','loss','other']),amount:signed,currency:z.literal('EUR').default('EUR'),basis:z.enum(['planned','actual']),description:text.min(5),invoice:text.optional(),correction_of:id.optional()},
 cost_allocate:{cost_id:id,lot_id:id,amount, basis:name},
 bottling_plan:{name,position_id:id,sku_id:id,bottle_count:z.number().int().min(1).max(10000000),loss_l:amount,starts_at:date,supplier:name,requirements:z.array(z.object({material_id:id,per_bottle:amount,batch:name.optional()})).min(1).max(50)},
 bottling_plan_cancel:{plan_id:id,expected_version:version},
 bottling_execute:{plan_id:id,expected_version:version,position_version:version,code:name,bottle_count:z.number().int().min(1).max(10000000),loss_l:amount},
 reference_record:{lot_id:id.optional(),bottling_id:id.optional(),trial_id:id.optional(),code:name,location:name,sampled_at:date,review_at:date.optional(),description:text},
 packaged_dispatch:{bottling_id:id,quantity:z.number().int().positive().max(10000000),kind:z.enum(['dispatch','return']),reason:text.min(5),external_reference:name.optional()},
 weather_rule_create:{vineyard_id:id,name,parameter:z.enum(['temperature','precipitation','wind_speed']),minimum:decimal,maximum:decimal},
 sensor_disable:{sensor_id:id,expected_version:version},
 vineyard_geometry:{vineyard_id:id,expected_version:version,geometry:z.object({type:z.literal('Polygon'),coordinates:z.array(z.array(z.tuple([z.number().min(-180).max(180),z.number().min(-90).max(90)])).min(4)).min(1)})},
 connection_create:{name,adapter:z.enum(['file','sensor','brightsky','openai-compatible']),capabilities:z.array(z.enum(['csv','json','xlsx','geojson','read','notes','ocr','search'])).max(10),authority:z.object({wine:z.enum(['app','erp']),bottles:z.enum(['app','erp'])})},
 connection_update:{connection_id:id,expected_version:version,enabled:z.boolean(),authority:z.object({wine:z.enum(['app','erp']),bottles:z.enum(['app','erp'])})},
 external_map:{connection_id:id,entity_type:z.enum(['sku','lot','vineyard','material']),internal_id:id,external_id:name}
};
