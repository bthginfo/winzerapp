import { z } from 'zod';
import { operationalDefs } from './operational-contracts';
const id=z.uuid(), amount=z.string().regex(/^(0|[1-9]\d*)(\.\d{1,3})?$/).max(24), name=z.string().trim().min(1).max(160), reason=z.string().min(5).max(2000), version=z.number().int().positive(), date=z.iso.datetime({offset:true}), text=z.string().max(5000);
const source=z.object({position_id:id,quantity_l:amount,expected_version:version});
const component=z.object({position_id:id,quantity_l:amount});
export const defs={
 ...operationalDefs,
 vessel_update:{vessel_id:id,expected_version:version,status:z.enum(['ready','cleaning','blocked']),capacity_l:amount.optional()},
 vessel_create:{code:name,name,kind:z.enum(['tank','barrel','container']).default('tank'),capacity_l:amount},
 lot_create:{code:name,name,grape:name.optional(),vintage:z.number().int().min(1900).max(2200),cost_per_l:amount.default('0'),material:z.enum(['must','wine']).default('wine'),harvest_id:id.optional()},
 vineyard_create:{code:name,name,grape:name,area_ha:amount,planted_year:z.number().int().min(1800).max(2200).optional(),geometry:z.record(z.string(),z.unknown()).optional()},
 harvest_create:{vineyard_id:id,code:name,vintage:z.number().int(),quantity_kg:amount,received_at:date,quality:text.optional()},
 opening:{lot_id:id,vessel_id:id,quantity_l:amount,reason},
 transfer:{position_id:id,target_vessel_id:id,quantity_l:amount,loss_l:amount.default('0'),expected_version:version},
 split:{position_id:id,target_vessel_id:id,quantity_l:amount,loss_l:amount.default('0'),expected_version:version},
 loss:{position_id:id,quantity_l:amount,expected_version:version,reason},
 adjustment:{position_id:id,quantity_l:amount,expected_version:version,reason,correction_of:id,direction:z.enum(['increase','decrease'])},
 lot_block:{lot_id:id,expected_version:version,blocked:z.boolean(),reason},
 mix:{target_vessel_id:id,sources:z.array(source).min(1).max(50),code:name,name,vintage:z.number().int(),loss_l:amount.default('0')},
 produce:{target_vessel_id:id,sources:z.array(source).min(1).max(50),code:name,name,vintage:z.number().int(),loss_l:amount.default('0'),order_id:id,order_version:version},
 project_create:{name,briefing:text.optional(),target_l:amount},
 recipe_save:{project_id:id,name,components:z.array(component).min(1).max(50)},
 recipe_freeze:{recipe_id:id,expected_version:version},
 trial:{recipe_id:id,sample_ml:amount.default('250')},
 evaluate:{trial_id:id,score:z.number().int().min(0).max(100),aroma:z.number().int().min(0).max(10),balance:z.number().int().min(0).max(10),comment:text.optional()},
 approve:{review_acknowledged:z.literal(true),review_note:text.optional(),recipe_id:id,target_vessel_id:id,expected_version:version},
 approve_deviation:{order_id:id,expected_version:version,reason,sources:z.array(component).min(1).max(50)},
 reserve:{position_id:id,quantity_l:amount,expected_version:version,expires_at:date.optional()},
 reservation_release:{reservation_id:id},order_cancel:{order_id:id},
 analysis_add:{lot_id:id,sample_code:name,sampled_at:date,parameter:z.enum(['alcohol','sugar','acidity','ph','free_so2','temperature']),value:z.string().regex(/^-?\d+(\.\d{1,6})?$/).max(24),unit:name,method:name,measured_at:date,source:z.enum(['manual','import','laboratory']).default('manual'),quality:z.enum(['measured','estimated']).default('measured'),supersedes:id.optional()},
 product_create:{name},sku_create:{product_id:id,code:name,fill_l:amount,erp_reference:name.optional()},
 bottle:{position_id:id,expected_version:version,sku_id:id,code:name,bottle_count:z.number().int().min(1).max(10000000),loss_l:amount.default('0')},
 task_create:{title:name,description:text.optional(),due_at:date.optional(),assignee_id:name.optional(),lot_id:id.optional(),vineyard_id:id.optional(),checklist:z.array(z.object({label:name,done:z.boolean()})).max(50).optional()},
 task_update:{task_id:id,expected_version:version,status:z.enum(['open','doing','done']),checklist:z.array(z.object({label:name,done:z.boolean()})).max(50).optional()},
 note_add:{body:text.min(1),lot_id:id.optional(),vineyard_id:id.optional(),captured_at:date.optional()},
 member_set:{user_id:name,role:z.enum(['owner','oenologist','cellar','vineyard','office','external']),scope:z.array(id).max(100).default([])}
};
export const commandSchema=z.discriminatedUnion('type',Object.entries(defs).map(([type,fields])=>z.object({type:z.literal(type),...fields,occurred_at:date.optional()})) as unknown as [z.ZodObject,z.ZodObject,...z.ZodObject[]]);
