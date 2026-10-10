import type { Field } from './forms';
const s=(key:string,collection:string,optional=false):Field=>({key,type:'select',collection,optional});
const e=(key:string,options:string[]):Field=>({key,type:'select',options});
const d=(key:string,optional=false):Field=>({key,type:'datetime',optional});
const f=(key:string,value='',optional=false):Field=>({key,value,optional});
const n=(key:string,value='',min=0,max=10000000):Field=>({key,type:'number',value,min,max});
const a=(key:string,optional=false):Field=>({key,type:'textarea',optional});
export const operationalForms:Record<string,Field[]>={
 season_create:[s('vineyard_id','vineyards'),n('vintage','2026',1900,2200),f('management'),f('planned_kg')],
 field_record:[s('vineyard_id','vineyards'),s('season_id','seasons',true),e('kind',['pruning','soil','canopy','observation','protection','irrigation','harvest','other']),a('description'),d('performed_at'),f('hours','0'),f('area_ha'),f('product','',true),f('product_batch','',true),f('quantity','0'),f('unit'),f('operator'),a('authorization',true),a('source',true)],
 field_approve:[s('field_id','field_operations'),{key:'review_acknowledged',type:'checkbox'}],
 maturity_record:[s('vineyard_id','vineyards'),s('season_id','seasons',true),f('code'),d('sampled_at'),f('location'),f('sugar','',true),f('sugar_unit','°Oe'),f('acidity','',true),f('ph','',true),f('method'),e('quality',['measured','estimated'])],
 resource_create:[f('name'),e('kind',['team','machine','pump','equipment']),a('description',true)],
 harvest_plan:[s('vineyard_id','vineyards'),n('vintage','2026',1900,2200),f('planned_kg'),d('starts_at'),d('ends_at'),s('resource_id','resources',true),s('target_vessel_id','vessels',true),f('supplier'),a('instructions')],
 harvest_plan_update:[s('plan_id','harvest_plans'),e('status',['planned','in_progress','completed','cancelled'])],
 harvest_transform:[s('harvest_id','harvests'),f('input_kg'),f('output_l'),f('byproduct_kg','0'),f('code'),f('name'),s('target_vessel_id','vessels'),f('cost_per_l','0')],
 fermentation_start:[s('lot_id','lots'),f('name'),d('starts_at'),f('yeast'),f('target_temperature','',true),a('notes',true)],
 fermentation_update:[s('run_id','fermentations'),e('status',['active','paused','completed']),d('ends_at')],
 lab_rule_create:[f('name'),s('lot_id','lots',true),e('parameter',['temperature','sugar','alcohol','acidity','ph','free_so2']),f('unit'),f('method'),f('minimum','',true),f('maximum','',true),n('max_age_hours','168',1,87600)],
 material_create:[f('code'),f('name'),e('kind',['bottle','closure','label','box','treatment','cleaner','other']),e('unit',['piece','kg','g','l','ml']),f('cost_per_unit','0'),f('reorder_at','0')],
 material_receive:[s('material_id','materials'),f('quantity'),f('batch'),a('reason')],
 treatment_record:[s('position_id','positions'),s('material_id','materials'),f('quantity'),f('added_volume_l','0'),f('batch'),a('reason'),a('authorization'),f('operator')],
 cleaning_record:[s('vessel_id','vessels',true),s('resource_id','resources',true),d('performed_at'),f('method'),f('product'),f('product_batch','',true),f('quantity','0'),f('unit'),{key:'checklist',type:'completed_checklist'},e('result',['blocked','ready']),f('verified_by')],
 maintenance_create:[s('vessel_id','vessels',true),s('resource_id','resources',true),f('title'),d('performed_at'),d('due_at',true),a('findings')],
 maintenance_update:[s('maintenance_id','maintenance'),e('status',['open','doing','done']),a('findings')],
 cost_record:[s('lot_id','lots',true),s('vineyard_id','vineyards',true),s('bottling_id','bottlings',true),e('category',['work','material','service','energy','loss','other']),f('amount'),e('basis',['planned','actual']),a('description'),f('invoice','',true),s('correction_of','costs',true)],
 cost_allocate:[s('cost_id','costs'),s('lot_id','lots'),f('amount'),f('basis')],
 bottling_plan:[f('name'),s('position_id','positions'),s('sku_id','skus'),n('bottle_count','1000',1),f('loss_l','0'),d('starts_at'),f('supplier'),{key:'requirements',type:'materials'}],
 bottling_plan_cancel:[s('plan_id','bottling_plans')],
 bottling_execute:[s('plan_id','bottling_plans'),f('code'),n('bottle_count','1000',1),f('loss_l','0')],
 reference_record:[s('lot_id','lots',true),s('bottling_id','bottlings',true),s('trial_id','trials',true),f('code'),f('location'),d('sampled_at'),d('review_at',true),a('description')],
 packaged_dispatch:[s('bottling_id','bottlings'),n('quantity','1',1),e('kind',['dispatch','return']),a('reason'),f('external_reference','',true)],
 weather_rule_create:[s('vineyard_id','vineyards'),f('name'),e('parameter',['temperature','precipitation','wind_speed']),f('minimum','',true),f('maximum','',true)],
 sensor_disable:[s('sensor_id','sensors')]
};
export function operationalAllowed(type:string,role:string):boolean|null{
 if(!Object.hasOwn(operationalForms,type))return null;
 if(role==='external')return false;
 if(['season_create','field_record','maturity_record','harvest_plan','harvest_plan_update'].includes(type))return ['owner','oenologist','vineyard'].includes(role);
 if(['field_approve','lab_rule_create','sensor_disable'].includes(type))return ['owner','oenologist'].includes(role);
 if(['resource_create','cost_record','cost_allocate','weather_rule_create'].includes(type))return ['owner','oenologist','office'].includes(role);
 return ['owner','oenologist','cellar'].includes(role);
}
