<script lang="ts">
 import DataTable from './DataTable.svelte';let {model,t}:{model:Record<string,any[]>;t:(key:string)=>string}=$props();let id=$state(''),origins=$state<Record<string,any>[]>([]),message=$state('');
 async function load(){const res=await fetch('/api/provenance/'+id);const result=await res.json();if(!res.ok){message=result.message;return;}origins=result.origins;message=t('actualEvidence');}
</script>
<section class="card"><h2>{t('lineage')}</h2><form onsubmit={(e)=>{e.preventDefault();load();}}><label>{t('lot_id')}<select bind:value={id} required><option value="">—</option>{#each model.lots as lot}<option value={lot.id}>{lot.code} · {lot.name}</option>{/each}</select></label><button>{t('reports')}</button></form><p class="muted">{message}</p><DataTable rows={origins} columns={['code','name','grape','vintage','percentage','harvest_code','vineyard_name','evidence']} {t} /></section>
<style>form{display:flex;gap:15px;align-items:end;flex-wrap:wrap}label{min-width:230px}</style>
