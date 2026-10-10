import {readFileSync} from 'node:fs';
import {X509Certificate,createHash} from 'node:crypto';

/** Match Node's explicitly configured extra CA trust in Chromium; do not bypass arbitrary TLS errors. */
export function browserOptions(){
 const args=['--no-sandbox'];
 if(process.env.NODE_EXTRA_CA_CERTS){
  const certificates=readFileSync(process.env.NODE_EXTRA_CA_CERTS,'utf8').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)??[];
  const fingerprints=certificates.map(pem=>createHash('sha256').update(new X509Certificate(pem).publicKey.export({type:'spki',format:'der'})).digest('base64'));
  if(fingerprints.length)args.push('--ignore-certificate-errors-spki-list='+fingerprints.join(','));
 }
 const endpoint=new URL(process.env.E2E_URL??'http://localhost:5173');let proxy;
 const configured=process.env.HTTPS_PROXY??process.env.HTTP_PROXY;
 if(configured&&!['localhost','127.0.0.1','::1','[::1]'].includes(endpoint.hostname)){
  const url=new URL(configured);proxy={server:url.origin,...(url.username?{username:decodeURIComponent(url.username),password:decodeURIComponent(url.password)}:{})};
 }
 return {executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args,...(proxy?{proxy}:{})};
}
