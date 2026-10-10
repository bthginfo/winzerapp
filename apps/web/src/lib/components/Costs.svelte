<script lang="ts">
 import type {costSummary} from '@vinea/domain/costs';import DataTable from './DataTable.svelte';let {results,t,lang,timezone}:{results:ReturnType<typeof costSummary>;t:(s:string)=>string;lang:string;timezone:string}=$props();
</script>
<section class="card"><h2>{t('fullCost')}</h2><p class="muted">{t('costBasisHint')}</p><DataTable rows={results.lots} columns={['code','produced_l','loss_l','base_wine_cost','total_actual','total_planned','actual_per_l']} {t} {lang} {timezone} /><h3>{t('bottling_costs')}</h3><DataTable rows={results.bottlings} columns={['code','bottle_count','quantity_l','base_wine_cost','total_actual','total_planned','actual_per_bottle']} {t} {lang} {timezone} /></section>
