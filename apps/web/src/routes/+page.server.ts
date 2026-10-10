import { languages } from '$lib/i18n';
export const load = ({ url, cookies }: import('./$types').PageServerLoadEvent) => {
  const requested = url.searchParams.get('lang') ?? cookies.get('language') ?? 'de';
  return { lang: languages.find(l => l === requested) ?? 'de' };
};
