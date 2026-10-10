import type { Handle } from '@sveltejs/kit';
import { languages } from '$lib/i18n';
export const handle: Handle = async ({ event, resolve }) => {
  const requested = event.url.searchParams.get('lang') ?? event.cookies.get('language') ?? 'de';
  const lang = languages.find(l => l === requested) ?? 'de';
  if (event.url.searchParams.has('lang')) event.cookies.set('language', lang, { path: '/', sameSite: 'lax', secure: event.url.protocol === 'https:', maxAge: 31536000 });
  return resolve(event, { transformPageChunk: ({ html }) => html.replace('%lang%', lang) });
};
