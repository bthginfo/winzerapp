import {openDB} from 'idb';
export interface Draft{id:string;tenantId:string;command:Record<string,unknown>;state:'draft'|'conflict';capturedAt:string;error?:string;deviceId?:string;schemaVersion?:number;requiresReview?:boolean;}
export interface ObjectCard{id:string;tenantId:string;kind:'lots'|'vineyards'|'vessels';record:Record<string,any>;related:Record<string,Record<string,any>[]>;capturedAt:string;}
export interface PhotoDraft{id:string;tenantId:string;file:File;lot_id?:string;vineyard_id?:string;capturedAt:string;error?:string;}
const safe=new Set(['task_create','task_update','note_add','analysis_add','field_record','maturity_record']);
const review=new Set(['transfer','split','loss','mix']);
async function db(){return openDB('vinea-drafts-v1',2,{upgrade(db){for(const name of ['drafts','cards','photos'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});}});}
function changed(){window.dispatchEvent(new Event('vinea-drafts-changed'));}
export async function saveDraft(tenantId:string,command:Record<string,unknown>,id:string=crypto.randomUUID()){
 const type=String(command.type);if(!safe.has(type)&&!review.has(type))throw new Error('OFFLINE_POSTING_FORBIDDEN');
 const deviceId=localStorage.getItem('vinea-device-id')??crypto.randomUUID();localStorage.setItem('vinea-device-id',deviceId);
 const capturedAt=new Date().toISOString(),payload={...command,occurred_at:command.occurred_at??capturedAt,...(type==='note_add'?{captured_at:command.captured_at??capturedAt}:{})};
 await(await db()).put('drafts',{id,tenantId,command:payload,state:'draft',capturedAt,deviceId,schemaVersion:1,requiresReview:review.has(type)});changed();return id;
}
export async function drafts(tenantId:string):Promise<Draft[]>{return(await(await db()).getAll('drafts')).filter(d=>d.tenantId===tenantId);}
export async function removeDraft(id:string){await(await db()).delete('drafts',id);changed();}
export async function syncDrafts(tenantId:string,reviewedIds:string[]=[]){
 const results=[];
 for(const draft of await drafts(tenantId)){
  if(draft.state==='conflict'||(draft.requiresReview&&!reviewedIds.includes(draft.id)))continue;
  try{const res=await fetch('/api/commands',{method:'POST',headers:{'content-type':'application/json','idempotency-key':draft.id},body:JSON.stringify(draft.command)});
   if(res.ok){await removeDraft(draft.id);results.push({id:draft.id,ok:true});}
   else if(res.status<500){const detail=await res.json();draft.state='conflict';draft.error=detail.message??detail.error;await(await db()).put('drafts',draft);results.push({id:draft.id,ok:false});}
   else break;
  }catch{break;}
 }changed();return results;
}
export async function saveCard(tenantId:string,kind:ObjectCard['kind'],record:Record<string,any>,related:ObjectCard['related']){const capturedAt=new Date().toISOString();await(await db()).put('cards',{id:tenantId+':'+kind+':'+record.id,tenantId,kind,record,related,capturedAt});changed();}
export async function cards(tenantId:string):Promise<ObjectCard[]>{return(await(await db()).getAll('cards')).filter(c=>c.tenantId===tenantId);}
export async function savePhoto(tenantId:string,file:File,refs:{lot_id?:string;vineyard_id?:string}){if(file.size>2097152||!['image/jpeg','image/png','application/pdf'].includes(file.type))throw new Error('INVALID_ASSET');const id=crypto.randomUUID();await(await db()).put('photos',{id,tenantId,file,...refs,capturedAt:new Date().toISOString()});changed();return id;}
export async function photos(tenantId:string):Promise<PhotoDraft[]>{return(await(await db()).getAll('photos')).filter(p=>p.tenantId===tenantId);}
export async function removePhoto(id:string){await(await db()).delete('photos',id);changed();}
export async function syncPhotos(tenantId:string){for(const photo of await photos(tenantId)){try{const data=new FormData();data.set('file',photo.file,photo.file.name);data.set('client_id',photo.id);if(photo.lot_id)data.set('lot_id',photo.lot_id);if(photo.vineyard_id)data.set('vineyard_id',photo.vineyard_id);const res=await fetch('/api/assets',{method:'POST',body:data});if(res.ok)await removePhoto(photo.id);else{photo.error=(await res.json()).message??'ASSET_UPLOAD_FAILED';await(await db()).put('photos',photo);if(res.status>=500)break;}}catch{break;}}changed();}
export async function clearDrafts(){const store=await db();await Promise.all(['drafts','cards','photos'].map(name=>store.clear(name)));changed();}
