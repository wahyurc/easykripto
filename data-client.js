'use strict';

(() => {
  const cache=new Map(),pending=new Map();
  let generation=0,queue=Promise.resolve(),calls=[],session=null,serverCooldown=0;
  const controllers=new Set();
  const wait=(ms,signal)=>new Promise((resolve,reject)=>{
    if(signal.aborted){reject(new DOMException('Dibatalkan','AbortError'));return;}
    const abort=()=>{clearTimeout(timer);reject(new DOMException('Dibatalkan','AbortError'));};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    signal.addEventListener('abort',abort,{once:true});
  });
  window.EasyData={
    async analyze({chain,address,kind='wallet',signal,onWait}){
      if(!session)throw new Error('Masuk ke akun terlebih dahulu.');
      if(!blockchainNetworks.some(n=>n.id===chain)||!validChainAddress(address,chain))throw new Error('Alamat tidak sesuai jaringan.');
      if(kind==='holders'&&chain!=='solana')throw new Error('Data holder saat ini tersedia untuk Solana.');
      const key=`${chain}:${kind}:${chain==='solana'?address:address.toLowerCase()}`;
      const saved=cache.get(key);if(saved?.until>Date.now())return saved.data;
      const epoch=generation;
      if(!pending.has(key)){
        const controller=new AbortController();controllers.add(controller);
        const work=queue.catch(()=>{}).then(async()=>{
          if(epoch!==generation)throw new DOMException('Sesi berubah','AbortError');
          const configured=window.EASYKRIPTO_API_ORIGIN;
          const origin=configured?new URL(configured).origin:location.origin;
          for(let attempt=0;attempt<3;attempt++){
            calls=calls.filter(time=>time>Date.now()-61000);
            const until=Math.max(serverCooldown,calls.length>=4?calls[0]+61000:0),delay=until-Date.now();
            if(delay>0){onWait?.(`Menunggu giliran analisis, sekitar ${Math.ceil(delay/1000)} detik…`);await wait(delay,controller.signal);}
            calls=calls.filter(time=>time>Date.now()-61000);
            const token=await window.easykriptoIdToken();
            if(epoch!==generation)throw new DOMException('Sesi berubah','AbortError');
            controller.signal.throwIfAborted();calls.push(Date.now());
            const response=await fetch(`${origin}/api/analysis/${kind}?chain=${chain}&address=${encodeURIComponent(address)}`,{headers:{...await window.EasyAppCheck.headers(),Authorization:`Bearer ${token}`},credentials:'omit',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(40000)])});
            const body=await response.json().catch(()=>null);
            if(epoch!==generation)throw new DOMException('Sesi berubah','AbortError');
            if(response.status===429){const seconds=Number(response.headers.get('Retry-After')||body?.retryAfter||60);serverCooldown=Date.now()+Math.min(300,Math.max(1,Number.isFinite(seconds)?seconds:60))*1000+1000;if(attempt<2){onWait?.('Sumber data membatasi permintaan. Pembaruan dijeda dan akan dicoba kembali…');continue;}}
            if(!response.ok)throw new Error(body?.error||'Layanan analisis belum tersedia.');
            if(cache.size>=40)cache.delete(cache.keys().next().value);
            cache.set(key,{data:body,until:Date.now()+120000});return body;
          }
        });
        queue=work;
        const task=work.finally(()=>{controllers.delete(controller);if(pending.get(key)===task)pending.delete(key);});
        pending.set(key,task);
      }
      const data=await pending.get(key);
      if(signal?.aborted||epoch!==generation)throw new DOMException('Dibatalkan','AbortError');
      return data;
    }
  };
  window.addEventListener('easykripto-session',event=>{
    const uid=event.detail.user?.id||null;
    if(uid===session)return;
    session=uid;generation++;controllers.forEach(c=>c.abort());controllers.clear();pending.clear();cache.clear();calls=[];serverCooldown=0;queue=Promise.resolve();
  });
})();
