import { operationalForms,operationalAllowed } from './operational-forms';
export type Field={key:string,type?:'text'|'number'|'datetime'|'select'|'textarea'|'checkbox'|'sources'|'components'|'multiselect'|'checklist'|'completed_checklist'|'materials';options?:string[];collection?:string;value?:string;optional?:boolean;min?:number;max?:number};
const select=(key:string,collection:string):Field=>({key,type:'select',collection});
const time=(key:string,optional=false):Field=>({key,type:'datetime',optional});
const qty=(key:string,value=''):Field=>({key,value});
const number=(key:string,value='',min=0,max=10000000):Field=>({key,type:'number',value,min,max});
const text=(key:string,optional=false):Field=>({key,optional});
export const forms:Record<string,Field[]>={
 ...operationalForms,
 vessel_update:[select('vessel_id','vessels'),{key:'status',type:'select',options:['ready','cleaning','blocked']},{key:'capacity_l',optional:true}],
 vessel_create:[text('code'),text('name'),{key:'kind',type:'select',options:['tank','barrel','container']},qty('capacity_l')],
 lot_create:[text('code'),text('name'),text('grape'),number('vintage','2026',1900,2200),qty('cost_per_l','0'),{key:'material',type:'select',options:['wine','must']}, {...select('harvest_id','harvests'),optional:true}],
 vineyard_create:[text('code'),text('name'),text('grape'),qty('area_ha'),number('planted_year','2026',1800,2200)],
 harvest_create:[select('vineyard_id','vineyards'),text('code'),number('vintage','2026',1900,2200),qty('quantity_kg'),time('received_at'),text('quality',true)],
 opening:[select('lot_id','lots'),select('vessel_id','vessels'),qty('quantity_l'),text('reason')],
 transfer:[select('position_id','positions'),select('target_vessel_id','vessels'),qty('quantity_l'),qty('loss_l','0')],
 loss:[select('position_id','positions'),qty('quantity_l'),text('reason')],
 adjustment:[select('position_id','positions'),qty('quantity_l'),{key:'direction',type:'select',options:['increase','decrease']},select('correction_of','ledger'),text('reason')],
 lot_block:[select('lot_id','lots'),{key:'blocked',type:'checkbox'},text('reason')],
 mix:[text('code'),text('name'),number('vintage','2026',1900,2200),select('target_vessel_id','vessels'),{key:'sources',type:'sources'},qty('loss_l','0')],
 project_create:[text('name'),{key:'briefing',type:'textarea',optional:true},qty('target_l')],
 recipe_save:[select('project_id','projects'),text('name'),{key:'components',type:'components'}],
 recipe_freeze:[select('recipe_id','recipes')],
 trial:[select('recipe_id','recipes'),qty('sample_ml','250')],
 evaluate:[select('trial_id','trials'),number('score','80',0,100),number('aroma','7',0,10),number('balance','7',0,10),{key:'comment',type:'textarea',optional:true}],
 approve:[{key:'review_acknowledged',type:'checkbox'},text('review_note',true),select('recipe_id','recipes'),select('target_vessel_id','vessels')],
 produce:[select('order_id','orders'),text('code'),text('name'),number('vintage','2026',1900,2200),select('target_vessel_id','vessels'),{key:'sources',type:'sources'},qty('loss_l','0')],
 approve_deviation:[select('order_id','orders'),{key:'sources',type:'components'},text('reason')],
 reserve:[select('position_id','positions'),qty('quantity_l'),time('expires_at',true)],
 reservation_release:[select('reservation_id','reservations')],order_cancel:[select('order_id','orders')],
 analysis_add:[select('lot_id','lots'),text('sample_code'),time('sampled_at'),{key:'parameter',type:'select',options:['alcohol','sugar','acidity','ph','free_so2','temperature']},text('value'),text('unit'),text('method'),time('measured_at'),{...select('supersedes','analyses'),optional:true}],
 product_create:[text('name')],sku_create:[select('product_id','products'),text('code'),qty('fill_l','0.75'),text('erp_reference',true)],
 bottle:[select('position_id','positions'),select('sku_id','skus'),text('code'),number('bottle_count','1000',1),qty('loss_l','0')],
 task_create:[text('title'),{...select('assignee_id','members'),optional:true},{key:'checklist',type:'checklist',optional:true},{key:'description',type:'textarea',optional:true},time('due_at',true),{...select('lot_id','lots'),optional:true},{...select('vineyard_id','vineyards'),optional:true}],
 task_update:[select('task_id','tasks'),{key:'status',type:'select',options:['open','doing','done']}],
 note_add:[{key:'body',type:'textarea'},{...select('lot_id','lots'),optional:true},{...select('vineyard_id','vineyards'),optional:true}],
 member_set:[text('user_id'),{key:'role',type:'select',options:['owner','oenologist','cellar','vineyard','office','external']},{key:'scope',type:'multiselect',collection:'lots'}]
};
export function label(row:Record<string,any>,collection:string){if(collection==='members')return row.user_id;if(collection==='seasons')return `${row.vineyard_code} · ${row.vintage}`;if(collection==='field_operations')return `${row.vineyard_code} · ${row.kind} · ${row.performed_at}`;if(collection==='reservations')return `${row.vessel_code} · ${row.lot_code} · ${row.remaining_l} L`;if(collection==='positions')return `${row.vessel_code} · ${row.lot_code} · ${row.available_l} L`;if(collection==='trials')return row.blind_code;if(collection==='ledger')return `${row.kind} · ${row.occurred_at} · ${row.operation_id}`;return row.name??row.title??row.code??`${row.id.slice(0,8)} · ${row.status??row.parameter??''}`;}
export function allowed(type:string,role:string){const extended=operationalAllowed(type,role);if(extended!==null)return extended;if(role==='owner')return true;if(role==='external')return type==='analysis_add';if(['member_set'].includes(type))return false;if(['approve','approve_deviation','adjustment','lot_block','reservation_release','recipe_freeze','recipe_save','project_create','order_cancel'].includes(type))return role==='oenologist';if(['vineyard_create','harvest_create'].includes(type))return ['oenologist','vineyard'].includes(role);if(['task_create','task_update','note_add','evaluate'].includes(type))return true;return ['oenologist','cellar'].includes(role);}
