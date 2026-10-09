'use strict';

(() => {
  const section=document.getElementById('dashboard-search');
  const input=document.getElementById('token-search-input');
  const button=document.getElementById('paste-ca');
  const status=document.getElementById('token-search-status');
  const submit=document.getElementById('submit-token-search');
  const message=()=>selectedBlockchain==='solana'?'Cari CA Solana atau token contoh: ARKA, NOMI, KORA.':`Cari CA ${currentNetwork().name}. Alamat 0x bisa ada pada beberapa jaringan; pilih jaringan yang tepat.`;
  let reading=false,request=null;
  function extractCA(text){
    if(typeof text!=='string'||text.length>4096)return null;
    const trimmed=text.trim();
    if(validChainAddress(trimmed))return trimmed;
    const pattern=currentNetwork().kind==='evm'?/(?<![a-zA-Z0-9])0x[0-9a-fA-F]{40}(?![a-zA-Z0-9])/g:/(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{32,44}(?![1-9A-HJ-NP-Za-km-z])/g;
    const candidates=text.match(pattern)||[];
    const valid=[...new Set(candidates.filter(value=>validChainAddress(value)).map(value=>currentNetwork().kind==='evm'?value.toLowerCase():value))];
    return valid.length===1?valid[0]:null;
  }
  function indicate(ca){
    button.classList.toggle('has-ca',!!ca);
    button.querySelector('.clipboard-indicator').hidden=!ca;
    document.getElementById('paste-ca-label').textContent=ca?'Tempel CA':'Tempel';
    button.setAttribute('aria-label',ca?'Alamat berformat CA terdeteksi di clipboard. Tempel alamat':'Tempel alamat kontrak dari clipboard');
    button.title=ca?`${ca.slice(0,6)}…${ca.slice(-5)}`:'Baca clipboard dan tempel CA';
  }
  function visible(){return !section.hidden&&!document.body.classList.contains('signed-out')&&!document.hidden&&document.hasFocus();}
  async function inspectClipboard(){
    if(reading||!visible()||!navigator.clipboard?.readText||!navigator.permissions?.query)return;
    reading=true;
    try{
      const permission=await navigator.permissions.query({name:'clipboard-read'});
      // Never trigger a permission prompt on page load, focus, or navigation.
      if(permission.state!=='granted'){indicate(null);return;}
      const ca=extractCA(await navigator.clipboard.readText());
      if(visible())indicate(ca);
    }catch{indicate(null);}finally{reading=false;}
  }
  function route(){const hash=location.hash.slice(1);section.hidden=!!hash&&hash!=='ringkasan';if(!section.hidden)inspectClipboard();else indicate(null);}
  button.addEventListener('click',async()=>{
    if(!navigator.clipboard?.readText){status.textContent='Browser belum mendukung akses clipboard. Tekan lama kolom pencarian lalu pilih Tempel.';input.focus();return;}
    button.disabled=true;
    try{
      // This explicit action allows the browser to ask for clipboard permission.
      const ca=extractCA(await navigator.clipboard.readText());indicate(ca);
      if(!ca){status.textContent=`Tidak ditemukan satu CA berformat ${currentNetwork().name} di clipboard. Periksa jaringan yang dipilih.`;return;}
      input.value=ca;input.focus();status.textContent='CA sudah ditempel. Ketuk panah atau tekan Enter untuk mencari token.';
    }catch{indicate(null);status.textContent='Akses clipboard tidak diizinkan. Tempel alamat secara manual di kolom pencarian.';input.focus();}
    finally{button.disabled=false;}
  });
  input.addEventListener('paste',event=>{
    const ca=extractCA(event.clipboardData?.getData('text')||'');
    if(ca){event.preventDefault();input.value=ca;status.textContent='CA sudah ditempel. Tekan Enter atau ketuk panah untuk mencari.';}
  });
  input.addEventListener('input',()=>{status.textContent=message();});
  document.getElementById('token-search-form').addEventListener('submit',async event=>{
    event.preventDefault();if(document.body.classList.contains('signed-out'))return;
    const value=input.value.trim();
    const example=selectedBlockchain==='solana'?tokens.find(t=>[t.name.toLowerCase(),t.full.toLowerCase()].includes(value.toLowerCase())):null;
    if(example){request?.abort();request=null;submit.disabled=false;status.textContent='Menampilkan token contoh.';showToken(example.id);return;}
    const ca=extractCA(value);
    if(!ca){status.textContent=`Masukkan CA ${currentNetwork().name} yang valid. ${message()}`;input.focus();return;}
    const chain=selectedBlockchain,networkName=currentNetwork().name;
    request?.abort();const current=new AbortController();request=current;submit.disabled=true;status.textContent='Mencari data token…';
    const timeout=setTimeout(()=>current.abort(),12000);
    try{
      const response=await fetch(`https://api.dexscreener.com/token-pairs/v1/${chain}/${encodeURIComponent(ca)}`,{signal:current.signal,credentials:'omit'});
      if(response.status===429)throw new Error('Pencarian dibatasi penyedia data. Tunggu sebentar lalu coba lagi.');
      if(!response.ok)throw new Error('Data token belum dapat dimuat. Coba beberapa saat lagi.');
      const data=await response.json();
      const pairs=Array.isArray(data)?data.filter(p=>p.chainId===chain&&typeof p.baseToken?.address==='string'&&equalChainAddress(p.baseToken.address,ca,chain)):[];
      pairs.sort((a,b)=>Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0));
      if(request!==current||chain!==selectedBlockchain||document.body.classList.contains('signed-out'))return;
      const pair=pairs[0];
      if(!pair){status.textContent='Belum ada pasangan perdagangan untuk CA ini di DEX Screener. Periksa jaringan, alamat kontrak, atau ketersediaan pasarnya.';return;}
      const number=(n,money=true)=>n==null||n===''||!Number.isFinite(Number(n))?'Belum tersedia':money?new Intl.NumberFormat('id-ID',{style:'currency',currency:'USD',maximumSignificantDigits:6}).format(Number(n)):new Intl.NumberFormat('id-ID').format(Number(n));
      const label=pair.baseToken.symbol||'Token';
      dialog(label,`<p class="dialog-body-copy" style="margin:12px 0">${escapeHTML(pair.baseToken.name||label)} · ${escapeHTML(networkName)}</p><div class="address-block">${escapeHTML(ca)}</div><div class="detail-metrics" style="margin-top:18px"><div class="detail-metric"><small>Harga USD</small><strong>${number(pair.priceUsd)}</strong></div><div class="detail-metric"><small>Likuiditas pasangan</small><strong>${number(pair.liquidity?.usd)}</strong></div><div class="detail-metric"><small>Volume pasangan · 24 jam</small><strong>${number(pair.volume?.h24)}</strong></div><div class="detail-metric"><small>Market cap</small><strong>${number(pair.marketCap)}</strong></div></div><div class="detail-note">Sumber: DEX Screener, diambil ${new Date().toLocaleTimeString('id-ID')}. Menampilkan pasangan dengan likuiditas terbesar yang tersedia. Data holder dan pergerakan wallet belum dihubungkan.</div><a class="secondary-button full-width" href="https://dexscreener.com/${chain}/${encodeURIComponent(pair.pairAddress)}" target="_blank" rel="noopener noreferrer">Buka pasangan perdagangan ${icon('arrow')}</a>`,'HASIL PENCARIAN · DATA PASAR');
      status.textContent=`${label} ditemukan. Data pasar bersumber dari DEX Screener.`;
    }catch(error){if(request!==current)return;status.textContent=error.name==='AbortError'?'Pencarian terlalu lama. Periksa koneksi dan coba lagi.':error.message==='Failed to fetch'?'Tidak dapat terhubung ke sumber data. Periksa koneksi dan coba lagi.':error.message;}
    finally{clearTimeout(timeout);if(request===current){request=null;submit.disabled=false;}}
  });
  window.addEventListener('focus',inspectClipboard);
  document.addEventListener('visibilitychange',inspectClipboard);
  window.addEventListener('hashchange',route);
  window.addEventListener('easykripto-session',route);
  window.addEventListener('easykripto-network',()=>{request?.abort();request=null;submit.disabled=false;input.value='';input.placeholder=`Tempel CA ${currentNetwork().name}`;input.setAttribute('aria-label',`Cari token dengan CA ${currentNetwork().name}`);status.textContent=message();indicate(null);inspectClipboard();});
  input.addEventListener('focus',inspectClipboard);
  route();
})();
