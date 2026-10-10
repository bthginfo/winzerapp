<script lang="ts">
  import { messages, languages } from '$lib/i18n';
  import { planBlend, type Blend } from '@vinea/domain';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const t = $derived(messages[data.lang]);
  let amountA = $state('600');
  let amountB = $state('400');
  const sources = $derived([
    { id: 'example-A', volume: amountA, available: '1200', cost: '2', alcohol: '12', method: 'synthetic-compatible-v1', blocked: false },
    { id: 'example-B', volume: amountB, available: '900', cost: '3', alcohol: '13.5', method: 'synthetic-compatible-v1', blocked: false }
  ]);
  const calculation = $derived.by((): { result: Blend | null; error: string | null } => {
    try { return { result: planBlend(sources), error: null }; }
    catch (e) { return { result: null, error: e instanceof Error ? e.message : 'UNKNOWN' }; }
  });
  const error = $derived(calculation.error === 'INSUFFICIENT_STOCK' ? t.noStock : calculation.error === 'EMPTY_RECIPE' ? t.empty : calculation.error === 'INVALID_DECIMAL' ? t.invalid : calculation.error === 'BLOCKED_SOURCE' ? t.blocked : t.unknown);
  const locales = { de: 'de-DE', en: 'en-GB', it: 'it-IT', fr: 'fr-FR' };
  function number(value: string, digits = 2) { return new Intl.NumberFormat(locales[data.lang], { maximumFractionDigits: digits }).format(Number(value)); }
  function money(value: string) { return new Intl.NumberFormat(locales[data.lang], { style: 'currency', currency: 'EUR' }).format(Number(value)); }
  function download() {
    if (!calculation.result) return;
    const payload = { kind: 'synthetic-planning-recipe', createdAt: new Date().toISOString(), sources, ...calculation.result, productionApproved: false };
    const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = objectUrl; link.download = 'vinea-recipe.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
</script>

<svelte:head><title>Vinea · {t.blending}</title><meta name="description" content={t.subtitle} /></svelte:head>
<a class="skip" href="#main">{t.skip}</a>
<header>
  <a class="brand" href="/" aria-label="Vinea"><span class="mark">V</span>vinea<span class="dot">.</span></a>
  <nav aria-label={t.blending}><a href="#cellar">{t.cellar}</a><a href="#studio">{t.blending}</a><a href="#roadmap">{t.roadmap}</a></nav>
  <form method="GET"><label for="language">{t.language}</label><select id="language" name="lang" value={data.lang} onchange={(e) => e.currentTarget.form?.requestSubmit()}>{#each languages as lang}<option value={lang}>{lang.toUpperCase()}</option>{/each}</select><noscript><button type="submit">OK</button></noscript></form>
</header>
<main id="main">
  <section class="hero"><div><div class="eyebrow">VINEA / {t.foundation}</div><h1>{t.title}</h1><p>{t.subtitle}</p></div><a class="primary" href="#studio">{t.back} <span aria-hidden="true">↗</span></a></section>
  <aside class="notice"><span class="badge">{t.demo}</span><p>{t.notice}</p></aside>
  <section id="cellar" class="section">
    <div class="section-heading"><h2>{t.lots}</h2><span>{t.cellar} / 02</span></div>
    <div class="lot-grid">{#each [{ id: 'A', grape: 'Riesling', available: '1200', alcohol: '12', cost: '2', color: '#b2b885' }, { id: 'B', grape: 'Weißburgunder / Pinot blanc', available: '900', alcohol: '13.5', cost: '3', color: '#d7b778' }] as lot}
      <article class="lot"><div class="lot-id" style={`--lot-color:${lot.color}`}>{lot.id}</div><div class="lot-info"><span class="eyebrow">{t.lot} {lot.id} · {t.vintage} 2025</span><h3>{lot.grape}</h3><p>{number(lot.available)} L {t.available.toLowerCase()} <span>·</span> {number(lot.alcohol)} % vol <span>·</span> {money(lot.cost)}/L</p></div></article>
    {/each}</div>
  </section>
  <section id="studio" class="section">
    <div class="section-heading"><h2>{t.blending}</h2><span>01 / {t.estimate}</span></div>
    <div class="studio"><div class="recipe"><div class="eyebrow">A + B</div><h3>{t.heading}</h3><p>{t.intro}</p>
      <div class="inputs"><label for="a">{t.source} A <span>Riesling</span><input id="a" type="text" inputmode="decimal" bind:value={amountA} aria-describedby="unit-a" /><small id="unit-a">{t.volume} · max. {number('1200')} L</small></label><label for="b">{t.source} B <span>Pinot blanc</span><input id="b" type="text" inputmode="decimal" bind:value={amountB} aria-describedby="unit-b" /><small id="unit-b">{t.volume} · max. {number('900')} L</small></label></div>
      <button class="reset" onclick={() => { amountA = '600'; amountB = '400'; }}>{t.reset} ↺</button>
    </div><div class="result" aria-live="polite">
      {#if calculation.result}
        <div class="eyebrow">{t.total}</div><div class="large-number">{number(calculation.result.volume)} <span>L</span></div>
        <dl><div><dt>{t.cost}</dt><dd>{money(calculation.result.cost)}</dd></div><div><dt>{t.perLiter}</dt><dd>{money(calculation.result.costPerLiter)}</dd></div><div><dt>{t.alcohol}</dt><dd>{calculation.result.alcohol ? `${number(calculation.result.alcohol)} % vol` : t.missing}</dd></div></dl>
        <div class="trial"><h4>{t.trial}</h4>{#each calculation.result.samples as sample}<p>{t.sample} {sample.id.endsWith('A') ? 'A' : 'B'} <strong>{number(sample.ml)} ml</strong></p>{/each}</div>
        <p class="ph">{t.ph}</p><button class="export" onclick={download}>{t.export} <span aria-hidden="true">↓</span></button>
      {:else}<p class="error" role="alert">{error}</p>{/if}
    </div></div><p class="estimation">{t.estimation}</p>
  </section>
  <section id="roadmap" class="section"><div class="section-heading"><h2>{t.next}</h2><span>{t.planned}</span></div><div class="roadmap">
    {#each [{ title: t.identity, text: t.identityText }, { title: t.ledger, text: t.ledgerText }, { title: t.production, text: t.productionText }, { title: t.data, text: t.dataText }] as item, i}<article><span class="step">0{i + 1}</span><h3>{item.title}</h3><p>{item.text}</p></article>{/each}
  </div></section>
  <footer><span class="brand footer-brand">vinea.</span><p>{t.specification}</p><span>DE / EN / IT / FR</span></footer>
</main>

<style>
  :global(*){box-sizing:border-box} :global(html){scroll-behavior:smooth;scroll-padding-top:90px} :global(body){margin:0;background:#f7f6f0;color:#203e34;font-family:Arial,Helvetica,sans-serif;font-size:16px} :global(button),:global(input),:global(select){font:inherit} :global(a){color:inherit} :global(button),:global(select){cursor:pointer} :global(:focus-visible){outline:3px solid #ac6926;outline-offset:4px} .skip{position:absolute;left:20px;top:-100px;z-index:10;background:#fff;padding:14px}.skip:focus{top:20px}
  header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:24px 5vw;border-bottom:1px solid #d8ddd3;background:#f7f6f0}.brand{display:flex;align-items:center;text-decoration:none;letter-spacing:-2px;font-size:32px;font-weight:700}.mark{background:#203e34;color:#f7f6f0;display:grid;place-items:center;height:40px;width:40px;margin-right:12px;font-size:24px;border-radius:10px;letter-spacing:0}.dot{color:#a87946}nav{display:flex;gap:28px}nav a{text-decoration:none;font-size:14px;padding:12px 0}nav a:hover{text-decoration:underline}form{display:flex;gap:10px;align-items:center;font-size:13px}select{min-height:44px;background:transparent;border:1px solid #b7c1b5;border-radius:7px;padding:8px}
  main{max-width:1320px;margin:auto;padding:0 5vw}.hero{display:flex;align-items:center;justify-content:space-between;gap:32px;padding:70px 0 40px}.eyebrow{text-transform:uppercase;letter-spacing:1.5px;font-size:11px;font-weight:700}h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(38px,5vw,64px);letter-spacing:-2px;max-width:750px;margin:20px 0}p{line-height:1.6}.hero p{color:#556455;font-size:18px}.primary{background:#203e34;color:#fff;min-height:48px;padding:18px 22px;border-radius:8px;text-decoration:none;font-size:14px;white-space:nowrap}.primary span{margin-left:12px}.notice{display:flex;align-items:center;gap:16px;background:#eeeee3;border:1px solid #d6d8c8;padding:14px 18px;border-radius:8px}.notice p{margin:0;font-size:13px;color:#52624e}.badge{font-size:11px;padding:8px;border-radius:4px;background:#dadcc9;white-space:nowrap;font-weight:700}.section{margin-top:44px}.section-heading{display:flex;align-items:center;justify-content:space-between;padding-bottom:18px;gap:20px}.section-heading h2{font-size:20px;margin:0;font-weight:500}.section-heading>span{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#63705e}.lot-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.lot{display:flex;gap:20px;align-items:center;background:#fff;border:1px solid #dfe3d7;border-radius:10px;padding:24px}.lot-id{background:var(--lot-color);width:60px;height:76px;border-radius:20px 20px 8px 8px;display:grid;place-items:center;flex-shrink:0;font-family:Georgia,serif;font-size:30px}.lot h3{font-size:18px;margin:8px 0}.lot p{font-size:12px;color:#67725f;margin:0}.lot p span{margin:0 6px}.lot .eyebrow{font-size:9px}.studio{display:grid;grid-template-columns:1.1fr 1fr;border:1px solid #dbe0d3;border-radius:12px;overflow:hidden;background:#fff}.recipe{padding:36px}.recipe h3{font:400 34px/1.2 Georgia,serif;letter-spacing:-1px;max-width:330px;margin:18px 0}.recipe>p{font-size:14px;color:#63705e;max-width:390px}.inputs{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:32px}label{font-size:13px;font-weight:700}label span{display:block;font-weight:400;color:#6b7864;margin:7px 0 14px}input{width:100%;min-height:58px;font-size:24px;border:1px solid #bec8b7;padding:14px;border-radius:7px;color:#203e34;background:#fcfcf8}small{display:block;font-size:10px;font-weight:400;color:#59664f;margin-top:8px}.reset{border:0;background:none;min-height:44px;padding:0;color:#526548;font-size:12px;text-decoration:underline;margin-top:20px}.result{padding:36px;background:#edf0e7;border-left:1px solid #dbe0d3}.large-number{font-family:Georgia,serif;font-size:60px;letter-spacing:-2px;margin:12px 0 24px}.large-number span{font:400 22px Arial,sans-serif;letter-spacing:0}dl{margin:0}dl>div{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-top:1px solid #d4dccb;font-size:13px}dd{margin:0;font-weight:700;text-align:right}.trial{background:#fafbf6;border-radius:7px;padding:16px 18px;margin-top:20px}.trial h4{font-size:13px;margin:0 0 12px}.trial p{display:flex;justify-content:space-between;font-size:12px;margin:6px 0}.ph{font-size:12px;color:#526148}.export{display:flex;justify-content:space-between;width:100%;background:#203e34;color:#fff;border:0;border-radius:7px;min-height:48px;padding:15px;font-size:13px}.estimation{font-size:11px;color:#606d55;max-width:860px;line-height:1.7}.error{color:#8b291e;background:#fff1e9;padding:18px;border-radius:8px}.roadmap{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;border-top:1px solid #d9dfd0;padding-top:22px}.step{font-family:Georgia,serif;font-size:26px;color:#7b8568}.roadmap h3{font-size:14px;margin-top:20px}.roadmap p{font-size:12px;color:#63705e}footer{display:flex;align-items:center;justify-content:space-between;gap:20px;border-top:1px solid #d9dfd0;margin-top:60px;padding:28px 0;color:#617053;font-size:11px}.footer-brand{font-size:24px;color:#203e34}footer p{margin:0}
  @media(max-width:900px){.hero{align-items:flex-start;flex-direction:column;padding-top:42px}.lot-grid{grid-template-columns:1fr}.roadmap{grid-template-columns:1fr 1fr}nav{gap:16px}.studio{grid-template-columns:1fr}.result{border-left:0;border-top:1px solid #dbe0d3}.large-number{font-size:48px}}
  @media(max-width:540px){header{flex-wrap:wrap;padding:18px 5vw;gap:12px}.brand{font-size:26px}.mark{height:34px;width:34px}nav{order:3;width:100%;justify-content:space-between}form label{display:none}.hero{gap:16px}h1{font-size:42px}.notice{align-items:flex-start;flex-direction:column;gap:8px}.recipe,.result{padding:24px}.inputs{gap:14px}.roadmap{gap:18px}.lot{padding:18px;gap:14px}.lot h3{font-size:16px}.section-heading h2{font-size:18px}.section-heading>span{font-size:9px}footer{flex-wrap:wrap}footer p{order:3;width:100%}.primary{white-space:normal}}
  @media(prefers-reduced-motion:reduce){:global(html){scroll-behavior:auto}}
</style>
