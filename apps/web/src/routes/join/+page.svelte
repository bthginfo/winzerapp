<script lang="ts">
 import {onMount} from 'svelte';import {goto} from '$app/navigation';import {translator} from '$lib/app-i18n';let {data}=$props();let t=$derived(translator(data.lang)),token=$state(''),message=$state(''),busy=$state(false);
 onMount(()=>{token=location.hash.slice(1);history.replaceState(null,'','/join');if(token)sessionStorage.setItem('vinea-invitation',token);else token=sessionStorage.getItem('vinea-invitation')??'';});
 async function accept(){busy=true;try{const res=await fetch('/api/invitations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'accept',token})});if(res.ok){sessionStorage.removeItem('vinea-invitation');await goto('/app/today');}else message=t((await res.json()).message);}catch{message=t('CONNECTION_FAILED');}finally{busy=false;}}
</script>
<main><h1>Vinea · {t('acceptInvitation')}</h1><p>{t('invitationIdentity')}</p>{#if data.signedIn}<button onclick={accept} disabled={!token||busy}>{t('acceptInvitation')}</button>{:else}<a href="/login?returnTo=join">{t('signin')} / {t('signup')}</a>{/if}<p role="status">{message}</p></main>
<style>main{max-width:560px;margin:10vh auto;padding:25px;font-family:system-ui}button{padding:14px;background:#285741;color:white;border:0;border-radius:7px}</style>
