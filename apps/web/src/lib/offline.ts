import { openDB } from 'idb';
export interface Draft { id:string;tenantId:string;command:Record<string,unknown>;state:'draft'|'conflict';capturedAt:string;error?:string; }
const safe=new Set(['task_create','task_update','note_add','analysis_add']);
async function db(){return openDB('vinea-drafts-v1',1,{upgrade(db){db.createObjectStore('drafts',{keyPath:'id'});}});}
export async function saveDraft(tenantId:string,command:Record<string,unknown>,id:string=crypto.randomUUID()){
 if(!safe.has(String(command.type)))throw new Error('OFFLINE_POSTING_FORBIDDEN');
 const capturedAt=new Date().toISOString();const payload={...command,occurred_at:command.occurred_at??capturedAt,...(command.type==='note_add'?{captured_at:command.captured_at??capturedAt}:{})};
 await (await db()).put('drafts',{id,tenantId,command:payload,state:'draft',capturedAt});window.dispatchEvent(new Event('vinea-drafts-changed'));return id;
}
export async function drafts(tenantId:string):Promise<Draft[]>{return (await (await db()).getAll('drafts')).filter(d=>d.tenantId===tenantId);}
export async function removeDraft(id:string){await(await db()).delete('drafts',id);}
export async function syncDrafts(tenantId:string){
 const results=[];
 for(const draft of await drafts(tenantId)){
  if(draft.state==='conflict')continue;
  const res=await fetch('/api/commands',{method:'POST',headers:{'content-type':'application/json','idempotency-key':draft.id},body:JSON.stringify(draft.command)});
  if(res.ok){await removeDraft(draft.id);results.push({id:draft.id,ok:true});}
  else{const detail=await res.json();draft.state='conflict';draft.error=detail.message??detail.error;await(await db()).put('drafts',draft);results.push({id:draft.id,ok:false});}
 }
 return results;
}

export async function clearDrafts(){await(await db()).clear('drafts');}
