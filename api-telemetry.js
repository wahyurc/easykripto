'use strict';

(() => {
  let uid=null,generation=0,pending=[],timer=null,sending=false,activeController=null,disabledUntil=0;
  const providers={'api.dexscreener.com':'dexscreener','api.geckoterminal.com':'gecko','api.gopluslabs.io':'goplus'};
  function metadata(url){
    const parsed=new URL(url),provider=providers[parsed.hostname];if(!provider)return null;
    let chain='auto',method='search';
    if(provider==='dexscreener'){if(parsed.pathname.includes('/token-pairs/')){method='token-pairs';chain=parsed.pathname.split('/')[3]||'auto';}}
    else if(provider==='gecko'){const id=parsed.pathname.match(/\/networks\/([^/]+)/)?.[1];chain={solana:'solana',eth:'ethereum',base:'base',bsc:'bsc',robinhood:'robinhood'}[id]||'auto';method=parsed.pathname.includes('trending_pools')?'trending_pools':parsed.pathname.includes('new_pools')?'new_pools':parsed.pathname.includes('ohlcv')?'ohlcv':'pools';}
    else{method='token_security';chain=parsed.pathname.includes('solana')?'solana':{'1':'ethereum','8453':'base','56':'bsc','4663':'robinhood'}[parsed.pathname.split('/').at(-1)]||'auto';}
    return {provider,method,chain};
  }
  function schedule(){if(!timer&&pending.length&&uid)timer=setTimeout(()=>{timer=null;void flush();},5000);}
  async function flush(){
    if(!uid||sending||!pending.length||!navigator.onLine||Date.now()<disabledUntil)return;
    const version=generation;sending=true;const batch=pending.splice(0,10);activeController=new AbortController();
    try{
      const token=await window.easykriptoIdToken();if(version!==generation)return;
      const origin=window.EASYKRIPTO_API_ORIGIN?new URL(window.EASYKRIPTO_API_ORIGIN).origin:location.origin;
      const response=await fetch(`${origin}/api/monitor/events`,{method:'POST',headers:{...await window.EasyAppCheck.headers(),Authorization:`Bearer ${token}`,'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({events:batch}),signal:AbortSignal.any([activeController.signal,AbortSignal.timeout(12000)])});
      if(!response.ok){disabledUntil=Date.now()+60000;if(response.status>=500&&version===generation)pending.unshift(...batch);}
    }catch{if(version===generation){pending.unshift(...batch);disabledUntil=Date.now()+60000;}}
    finally{if(version===generation){pending=pending.slice(-50);sending=false;activeController=null;if(pending.length){clearTimeout(timer);timer=setTimeout(()=>{timer=null;void flush();},Math.max(5000,disabledUntil-Date.now()));}}}
  }
  window.EasyAPILog={async fetch(url,options){
    const meta=metadata(url),started=performance.now(),version=generation;let status=0,ok=false,cancelled=false;
    try{const response=await fetch(url,options);status=response.status;ok=response.ok;
      if(meta?.provider==='goplus'&&ok){try{ok=(await response.clone().json()).code===1;}catch{ok=false;}}
      return response;
    }catch(error){cancelled=error.name==='AbortError';throw error;}
    finally{if(meta&&uid&&version===generation&&!cancelled){pending.push({id:crypto.randomUUID(),...meta,status,ok,duration:Math.min(120000,Math.round(performance.now()-started))});pending=pending.slice(-50);schedule();}}
  }};
  window.addEventListener('easykripto-session',event=>{const next=event.detail.user?.id||null;if(next===uid)return;uid=next;generation++;pending=[];clearTimeout(timer);timer=null;activeController?.abort();activeController=null;sending=false;disabledUntil=0;});
  window.addEventListener('online',()=>{disabledUntil=0;schedule();});
})();
