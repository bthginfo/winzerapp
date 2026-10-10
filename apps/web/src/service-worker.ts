/// <reference lib="webworker" />
import { build,version } from '$service-worker';
const worker=self as unknown as ServiceWorkerGlobalScope;
const cacheName='vinea-public-'+version;
worker.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll([...build,'/offline']))));
worker.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('vinea-public-')&&key!==cacheName).map(key=>caches.delete(key))))));
worker.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==worker.location.origin||url.pathname.startsWith('/api/'))return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(async()=>{const response=await caches.match('/offline');return response??new Response('Offline',{status:503});}));return;}
 if(build.includes(url.pathname))event.respondWith(caches.match(event.request).then(response=>response??fetch(event.request)));
});
