export interface AdapterCapabilities { id:string;live:boolean;readStock:boolean;writeMovements:boolean;idempotency:boolean;reconcileWrites:boolean;bottleStockAuthority:'app'|'erp'; }
export const demoErpCapabilities:AdapterCapabilities={id:'demo-erp',live:false,readStock:true,writeMovements:true,idempotency:true,reconcileWrites:true,bottleStockAuthority:'erp'};
export interface ErpAdapter { capabilities:AdapterCapabilities; write(eventId:string,payload:unknown):Promise<{externalId:string;status:'accepted'|'ambiguous'}>;reconcile(eventId:string):Promise<{found:boolean;externalId?:string}>; }
// The demo adapter's receipts and processing live in PostgreSQL app.process_jobs.
// A live adapter must implement reconciliation before an ambiguous write is retried.
