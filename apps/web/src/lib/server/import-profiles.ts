import { z } from 'zod';
import { commandSchema } from './contracts';
import { readModel,type Model } from './read-model';
export { profileFields } from '$lib/import-fields';
const types:Record<string,string>={analyses:'analysis_add',vineyards:'vineyard_create',vessels:'vessel_create',materials:'material_create',skus:'sku_create',harvests:'harvest_create',field:'field_record',weather:'weather_record'};
function lookup(model:Model,collection:string,value:unknown,by='code'){const row=model[collection].find(r=>r[by]===value);if(!row)throw new Error('REFERENCE_NOT_FOUND: '+collection);return row.id;}
export async function mapImportRows(tenantId:string,userId:string,profile:string,rows:Record<string,string>[],mapping:Record<string,string>,separator='.'){
 const model=await readModel(tenantId,userId,null);
 return rows.map((raw,index)=>{const mapped:Record<string,any>=Object.fromEntries(Object.entries(mapping).filter(([,column])=>column).map(([key,column])=>[key,raw[column]?.trim()]));
  Object.keys(mapped).forEach(key=>{if(mapped[key]===''||mapped[key]===undefined)delete mapped[key];});
  try{
   const command:Record<string,any>={type:types[profile],...mapped};
   for(const field of ['area_ha','quantity_l','capacity_l','cost_per_l','value','fill_l','quantity_kg','cost_per_unit','reorder_at','hours','quantity','temperature','precipitation','wind_speed'])if(separator===','&&typeof command[field]==='string')command[field]=command[field].replace(',','.');
   for(const field of ['vintage','planted_year'])if(command[field]!==undefined)command[field]=Number(command[field]);
   if(profile==='analyses'){command.lot_id=lookup(model,'lots',command.lot_code);delete command.lot_code;command.source='import';}
   if(profile==='skus'){command.product_id=lookup(model,'products',command.product_name,'name');delete command.product_name;}
   if(['harvests','field','weather'].includes(profile)){command.vineyard_id=lookup(model,'vineyards',command.vineyard_code);delete command.vineyard_code;}
   if(profile==='weather'){
    const weather=z.object({issued_at:z.iso.datetime({offset:true}),latitude:z.coerce.number().min(-90).max(90),longitude:z.coerce.number().min(-180).max(180),source:z.string().min(1).max(1000),temperature:z.string().optional(),precipitation:z.string().optional(),wind_speed:z.string().optional()}).parse(command);
    command.provider='station-file';command.latitude=String(weather.latitude);command.longitude=String(weather.longitude);command.data={weather:[{timestamp:weather.issued_at,temperature:weather.temperature??null,precipitation:weather.precipitation??null,wind_speed:weather.wind_speed??null}],sources:[{source:weather.source}]};delete command.temperature;delete command.precipitation;delete command.wind_speed;
    return {row:index+2,...mapped,command};
   }
   const checked=commandSchema.safeParse(command);if(!checked.success)throw new Error(checked.error.issues.map(i=>String(i.path.join('.'))+': '+i.message).join('; '));
   return {row:index+2,...mapped,command:checked.data};
  }catch(cause){return {row:index+2,...mapped,error:cause instanceof Error?cause.message:'INVALID_IMPORT_ROW'};}
 });
}
