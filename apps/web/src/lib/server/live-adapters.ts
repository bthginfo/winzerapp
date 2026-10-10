export const adapterManifests=[
 {id:'file',live:false,read:true,write:false,formats:['csv','json','xlsx','geojson']},
 {id:'winestro',live:true,read:true,write:false,endpoint:'https://weinstore.net/xml/v22.0/wbo-API.php',actions:['getArtikel'],documentation:'https://nephele-s5.de/xml/docs/xml_22.0.php',stockBasis:'available-in-ERP'},
 {id:'vintrace',live:true,read:true,write:false,requiresDocumentedContract:true,documentation:'https://api-docs.vintrace.com/'},
 {id:'contract-api',live:true,read:true,write:false,requiresDocumentedContract:true},
 {id:'openai-compatible',live:true,requiresExplicitConsent:true,endpoint:'https://api.openai.com/v1'},
 {id:'sensor',live:true,ingest:true,write:false},
 {id:'brightsky',live:true,read:true,source:'DWD via Bright Sky'}
];
export async function readAdapter(adapter:string,configuration:Record<string,any>,secret:Record<string,string>){
 let url:string,options:RequestInit;
 if(adapter==='winestro'){
  if(!secret.UID||!secret.apiUSER||!secret.apiCODE||!secret.apiShopID)throw new Error('CREDENTIALS_REQUIRED');
  url='https://weinstore.net/xml/v22.0/wbo-API.php';options={method:'POST',body:new URLSearchParams({UID:secret.UID,apiUSER:secret.apiUSER,apiCODE:secret.apiCODE,apiShopID:secret.apiShopID,apiACTION:'getArtikel',bestand:'true',output:'json',encoding:'none'}),headers:{'content-type':'application/x-www-form-urlencoded'}};
 }else if(adapter==='vintrace'||adapter==='contract-api'){
  const contract=configuration.contract;if(!contract?.confirmed||contract.method!=='GET'||!secret.api_key)throw new Error('DOCUMENTED_CONTRACT_REQUIRED');const base=new URL(contract.base_url);const allowed=(process.env.ERP_ALLOWED_HOSTS??'').split(',').filter(Boolean);if(base.protocol!=='https:'||base.username||base.password||!allowed.includes(base.hostname))throw new Error('ERP_HOST_NOT_APPROVED');const target=new URL(contract.path,base);if(target.origin!==base.origin)throw new Error('ERP_HOST_NOT_APPROVED');url=target.toString();options={headers:{authorization:'Bearer '+secret.api_key}};
 }else if(adapter==='openai-compatible'){if(!secret.api_key)throw new Error('CREDENTIALS_REQUIRED');url='https://api.openai.com/v1/models';options={headers:{authorization:'Bearer '+secret.api_key}};
 }else throw new Error('NO_REMOTE_ADAPTER');
 const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('REMOTE_READ_FAILED');if(Number(response.headers.get('content-length')??0)>3000000)throw new Error('IMPORT_TOO_LARGE');const text=await response.text();if(text.length>3000000)throw new Error('IMPORT_TOO_LARGE');let data;try{data=JSON.parse(text);}catch{throw new Error('REMOTE_FORMAT_INVALID');}if(data.fehler)throw new Error('REMOTE_READ_FAILED');
 return {source:url,data};
}
