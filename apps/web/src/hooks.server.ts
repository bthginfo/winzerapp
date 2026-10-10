import { error, type Handle } from '@sveltejs/kit';
import { languages } from '$lib/i18n';
import { getAuth } from '$lib/server/auth';
export const handle:Handle=async({event,resolve})=>{
  const requested=event.url.searchParams.get('lang')??event.cookies.get('language')??'de';
  const lang=languages.find(l=>l===requested)??'de'; event.locals.lang=lang; event.locals.identity=null;
  if(event.url.searchParams.has('lang')) event.cookies.set('language',lang,{path:'/',sameSite:'lax',secure:event.url.protocol==='https:',maxAge:31536000});
  if(!['GET','HEAD','OPTIONS'].includes(event.request.method) && event.url.pathname.startsWith('/api/') && !event.url.pathname.startsWith('/api/auth/')) {
    if(event.request.headers.get('origin')!==event.url.origin) error(403,'ORIGIN_REQUIRED');
  }
  if(event.url.pathname.startsWith('/app') || (event.url.pathname.startsWith('/api/') && !event.url.pathname.startsWith('/api/auth/') && event.url.pathname!='/api/health')) {
    event.locals.identity=await getAuth().api.getSession({headers:event.request.headers});
  }
  const response=await resolve(event,{transformPageChunk:({html})=>html.replace('%lang%',lang)});
  response.headers.set('X-Content-Type-Options','nosniff'); response.headers.set('Referrer-Policy','same-origin');
  if(event.url.pathname.startsWith('/app') || event.url.pathname.startsWith('/api/')) response.headers.set('Cache-Control','private, no-store');
  return response;
};
