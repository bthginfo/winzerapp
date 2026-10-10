import {runtime} from './runtime';import {decryptSecret} from './connection-secrets';
function endpoint(contract:Record<string,any>,path:string){const base=new URL(contract.base_url),target=new URL(path,base),allowed=(process.env.ERP_ALLOWED_HOSTS??'').split(',').filter(Boolean);if(base.protocol!=='https:'||base.username||base.password||(base.port&&base.port!=='443')||!allowed.includes(base.hostname)||target.origin!==base.origin)throw new Error('ERP_HOST_NOT_APPROVED');return target;}
export async function deliver(tid:string,actor:string,maximum=3){const sql=runtime();const results=[];
 for(let index=0;index<maximum;index++){
  const [job]=await sql`SELECT * FROM app.delivery_claim(${tid}::uuid,${actor})`;if(!job)break;
  let result:Record<string,unknown>={status:'ambiguous',error:'REMOTE_OUTCOME_UNKNOWN'};
  try{
   const [connection]=await sql`SELECT * FROM app.read_connection(${tid}::uuid,${actor},${job.connection_id}::uuid)`;
   const contract=connection?.configuration?.contract,write=contract?.outbound;if(!connection?.enabled||connection.adapter!=='contract-api'||!write?.confirmed||!write.idempotency||!connection.ciphertext)throw new Error('DOCUMENTED_CONTRACT_REQUIRED');const secret=decryptSecret(connection.ciphertext);if(!secret.api_key)throw new Error('CREDENTIALS_REQUIRED');
   const headers={authorization:'Bearer '+secret.api_key,'content-type':'application/json','idempotency-key':job.id};
   async function request(url:URL,options:RequestInit){const res=await fetch(url,{...options,headers,redirect:'error',signal:AbortSignal.timeout(10000)});if(!res.ok||Number(res.headers.get('content-length')??0)>100000)throw new Error('REMOTE_OUTCOME_UNKNOWN');const text=await res.text();if(text.length>100000)throw new Error('REMOTE_OUTCOME_UNKNOWN');const r=JSON.parse(text);if(r.event_id!==job.id||!['accepted','not_found','pending'].includes(r.status)||(r.status==='accepted'&&(typeof r.external_id!=='string'||r.external_id.length>160)))throw new Error('REMOTE_RECEIPT_INVALID');return r;}
   let receipt:any=null;
   if(job.attempts>1){const url=endpoint(contract,write.reconcile_path);url.searchParams.set('event_id',job.id);receipt=await request(url,{method:'GET'});}
   if(!receipt||receipt.status==='not_found')receipt=await request(endpoint(contract,write.path),{method:'POST',body:JSON.stringify({...job.payload,event_id:job.id})});
   result=receipt.status==='accepted'?{status:'succeeded',external_id:receipt.external_id}:{status:'ambiguous',error:'REMOTE_OUTCOME_PENDING'};
  }catch(cause){const code=cause instanceof Error?cause.message:'';result={status:['DOCUMENTED_CONTRACT_REQUIRED','CREDENTIALS_REQUIRED','ERP_HOST_NOT_APPROVED'].includes(code)?'failed':'ambiguous',error:/^[A-Z_]+$/.test(code)?code:'REMOTE_OUTCOME_UNKNOWN'};}
  await sql`SELECT app.delivery_finish(${tid}::uuid,${actor},${job.id}::uuid,${job.claim},${JSON.stringify(result)}::jsonb)`;results.push({id:job.id,...result});
 }return results;
}
