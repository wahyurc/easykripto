'use strict';

(() => {
  const section=document.getElementById('dashboard-search');
  const input=document.getElementById('token-search-input');
  const button=document.getElementById('paste-ca');
  const status=document.getElementById('token-search-status');
  const submit=document.getElementById('submit-token-search');
  const form=document.getElementById('token-search-form');
  const message=()=> 'Tempel CA. Jaringan dicari otomatis; jika ada beberapa hasil, pilih jaringan token.';
  let reading=false,request=null,automaticNetworkChange=false,chosenChain=null,chosenPairs=null;
  function enrichToken(chain,ca,pair){
    const content=document.getElementById('dialog-content');
    const gmgnChain={solana:'sol',ethereum:'eth',base:'base',bsc:'bsc',robinhood:'robinhood'}[chain];
    if(gmgnChain&&validChainAddress(ca,chain)){
      const trade=document.createElement('a');trade.className='primary-button full-width token-trade-link';
      trade.href=`https://gmgn.ai/${gmgnChain}/token/${encodeURIComponent(ca)}`;
      trade.target='_blank';trade.rel='noopener noreferrer';
      trade.innerHTML=`<img class="token-provider-logo" src="gmgn-logo.png" alt="" width="24" height="24">Trade di GMGN.io ${icon('arrow')}`;
      trade.setAttribute('aria-label','Trade Token ini di GMGN.ai, buka tab baru');
      content.append(trade);
    }
    if(validChainAddress(ca,chain)){
      const mastr=document.createElement('a');mastr.className='secondary-button full-width token-trade-link';
      const address=encodeURIComponent(ca);
      if(chain==='solana')mastr.href=`https://mastrtrade.com/?t=${address}#/trade/${address}`;
      else {
        const pool=validChainAddress(pair?.pairAddress||'',chain)?`/${address}/${encodeURIComponent(pair.pairAddress)}`:'';
        mastr.href=`https://mastrtrade.com/#/multichain/${encodeURIComponent(chain)}${pool}`;
        if(!pool)mastr.title='Pilih token atau tempel CA pada jaringan tujuan di MastrTrade.';
      }
      mastr.target='_blank';mastr.rel='noopener noreferrer';
      mastr.innerHTML=`<img class="token-provider-logo" src="mastrtrade-logo.png" alt="" width="24" height="24">Trade di MastrTrade ${icon('arrow')}`;
      mastr.setAttribute('aria-label','Trade token di MastrTrade, buka tab baru');
      content.append(mastr);
    }
    window.EasyTokenUI.setDialogIcon({imageUrl:pair?.info?.imageUrl,label:pair?.baseToken?.symbol||'Token'});
    const holdersBlock=document.createElement('section');holdersBlock.className='token-data-block token-holders-block';
    const holdersTitle=document.createElement('h3');holdersTitle.textContent='Wallet pemegang token';
    const holdersRoot=document.createElement('div');holdersRoot.id='token-live-holders';holdersRoot.dataset.symbol=String(pair?.baseToken?.symbol||'token').slice(0,32);holdersRoot.setAttribute('aria-live','polite');holdersRoot.textContent='Memuat pemegang token…';holdersBlock.append(holdersTitle,holdersRoot);content.append(holdersBlock);
    const chart=document.createElement('section');chart.className='token-data-block';chart.innerHTML='<h3>Grafik harga · per jam</h3><div id="token-live-chart" role="status">Memuat grafik GeckoTerminal…</div>';
    const risk=document.createElement('section');risk.className='token-data-block';risk.innerHTML='<h3>Pemeriksaan risiko</h3><div id="token-live-risk" role="status">Memuat hasil GoPlus…</div>';
    content.append(chart,risk);
    const saved=tokens.find(token=>token.chain===chain&&equalChainAddress(token.address,ca,chain));
    const track=document.createElement('button');track.type='button';track.className='primary-button full-width';track.textContent=saved?'Hapus token dari pantauan':'Pantau token';
    if(saved)track.dataset.removeToken=saved.id;
    else track.addEventListener('click',()=>{window.EasyDashboard.trackToken({chain,address:ca,name:pair?.baseToken?.name,symbol:pair?.baseToken?.symbol,pair});if(tokens.some(token=>token.chain===chain&&equalChainAddress(token.address,ca,chain))){track.textContent='Token sudah dipantau';track.disabled=true;}});
    content.append(track);
    if(chain==='solana'){
      const holders=document.createElement('button');holders.type='button';holders.className='secondary-button full-width live-holder-actions';holders.textContent='Lihat peta pemegang token';
      holders.addEventListener('click',()=>window.EasyWallet.open({address:ca,chain,kind:'holders'}));content.append(holders);
    }
    window.loadTokenAnalysis({chain,ca});
  }
  function extractCA(text){
    if(typeof text!=='string'||text.length>4096)return null;
    const trimmed=text.trim();
    if(validChainAddress(trimmed,'solana'))return trimmed;
    if(validChainAddress(trimmed,'ethereum'))return trimmed.toLowerCase();
    const pattern=/(?<![a-zA-Z0-9])(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})(?![a-zA-Z0-9])/g;
    const candidates=text.match(pattern)||[];
    const valid=[...new Set(candidates.filter(value=>validChainAddress(value,'solana')||validChainAddress(value,'ethereum')).map(value=>value.startsWith('0x')?value.toLowerCase():value))];
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
      if(!ca){status.textContent='Tidak ditemukan satu CA yang valid di clipboard. Tempel satu alamat Solana atau EVM.';return;}
      input.value=ca;input.focus();form.requestSubmit();
    }catch{indicate(null);status.textContent='Akses clipboard tidak diizinkan. Tempel alamat secara manual di kolom pencarian.';input.focus();}
    finally{button.disabled=false;}
  });
  input.addEventListener('paste',event=>{
    const ca=extractCA(event.clipboardData?.getData('text')||'');
    if(ca){event.preventDefault();input.value=ca;form.requestSubmit();}
  });
  input.addEventListener('input',()=>{request?.abort();request=null;submit.disabled=false;chosenChain=null;chosenPairs=null;status.textContent=message();});
  function chooseNetwork(ca,networks,pairs,detected){
    closeDialog();
    dialog('Pilih jaringan token',`<div class="address-block">${escapeHTML(ca)}</div><p class="detail-note">${detected?'Alamat ini ditemukan pada beberapa jaringan di DEX Screener. Pilih token yang ingin dibuka.':'Jaringan belum dapat ditentukan dari data DEX Screener. Pilih jaringan untuk memeriksa sumber data lainnya.'}</p><div id="ca-network-choices" class="ca-network-choices"></div>`,'JARINGAN TOKEN');
    const choices=document.getElementById('ca-network-choices');
    for(const network of networks){
      const choice=document.createElement('button');choice.type='button';choice.className='secondary-button full-width';
      choice.innerHTML=`${networkLogo(network.id)}<span>${escapeHTML(network.name)}</span>`;
      choice.addEventListener('click',()=>{closeDialog();input.value=ca;chosenChain=network.id;chosenPairs=detected?pairs.filter(pair=>pair.chainId===network.id):null;form.requestSubmit();});
      choices.append(choice);
    }
    status.textContent=detected?'CA ditemukan di beberapa jaringan. Pilih jaringan pada jendela token.':'Jaringan belum terdeteksi. Pilihan jaringan tersedia sebagai cadangan.';
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(document.body.classList.contains('signed-out'))return;
    const value=input.value.trim();
    const ca=extractCA(value);
    if(!ca){status.textContent='Masukkan satu CA Solana atau EVM yang valid.';input.focus();return;}
    let chain=chosenChain||(validChainAddress(ca,'solana')?'solana':null);
    const cachedPairs=chosenPairs;chosenChain=null;chosenPairs=null;
    request?.abort();const current=new AbortController();request=current;submit.disabled=true;status.textContent='Mendeteksi jaringan dan mencari data token…';
    const timeout=setTimeout(()=>current.abort(),12000);
    try{
      let data=cachedPairs;
      if(!data){
        const endpoint=chain?`https://api.dexscreener.com/token-pairs/v1/${chain}/${encodeURIComponent(ca)}`:`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(ca)}`;
        const response=await window.EasyAPILog.fetch(endpoint,{signal:current.signal,credentials:'omit'});
        if(response.status===429)throw new Error('Pencarian dibatasi penyedia data. Tunggu sebentar lalu coba lagi.');
        if(!response.ok)throw new Error('Data token belum dapat dimuat. Coba beberapa saat lagi.');
        data=await response.json();
      }
      const raw=Array.isArray(data)?data:Array.isArray(data.pairs)?data.pairs:[];
      let pairs=raw.filter(p=>supportedNetworks().some(network=>network.id===p.chainId)&&validChainAddress(ca,p.chainId)&&typeof p.baseToken?.address==='string'&&equalChainAddress(p.baseToken.address,ca,p.chainId)&&(!chain||p.chainId===chain));
      if(request!==current||document.body.classList.contains('signed-out'))return;
      if(!chain){
        const found=supportedNetworks().filter(network=>pairs.some(pair=>pair.chainId===network.id));
        if(found.length!==1){chooseNetwork(ca,found.length?found:supportedNetworks().filter(network=>network.kind==='evm'),pairs,found.length>0);return;}
        chain=found[0].id;
      }
      if(chain!==selectedBlockchain){
        automaticNetworkChange=true;
        try{const select=document.getElementById('network-select');select.value=chain;select.dispatchEvent(new Event('change'));}
        finally{automaticNetworkChange=false;}
      }
      input.value=ca;
      const networkName=currentNetwork().name;
      pairs=pairs.filter(pair=>pair.chainId===chain);
      pairs.sort((a,b)=>Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0));
      if(request!==current||chain!==selectedBlockchain||document.body.classList.contains('signed-out'))return;
      const pair=pairs[0];
      if(!pair){
        dialog('Telusuri token',`<div class="address-block">${escapeHTML(ca)}</div><div class="detail-note">DEX Screener belum memiliki pasangan untuk alamat ini pada ${escapeHTML(networkName)}. Grafik dan risiko diperiksa melalui sumber lain; format alamat saja belum membuktikan keberadaan token.</div>`,'DATA TOKEN');
        enrichToken(chain,ca);status.textContent='Pasangan DEX Screener belum ditemukan. Memeriksa sumber data lainnya.';return;
      }
      const number=(n,money=true)=>n==null||n===''||!Number.isFinite(Number(n))?'Belum tersedia':money?new Intl.NumberFormat('id-ID',{style:'currency',currency:'USD',maximumSignificantDigits:6}).format(Number(n)):new Intl.NumberFormat('id-ID').format(Number(n));
      const label=pair.baseToken.symbol||'Token';
      dialog(label,`<p class="dialog-body-copy" style="margin:12px 0">${escapeHTML(pair.baseToken.name||label)} · ${escapeHTML(networkName)}</p><div class="address-block">${escapeHTML(ca)}</div><div class="detail-metrics" style="margin-top:18px"><div class="detail-metric"><small>Harga USD</small><strong>${number(pair.priceUsd)}</strong></div><div class="detail-metric"><small>Likuiditas pasangan</small><strong>${number(pair.liquidity?.usd)}</strong></div><div class="detail-metric"><small>Volume pasangan · 24 jam</small><strong>${number(pair.volume?.h24)}</strong></div><div class="detail-metric"><small>Market cap</small><strong>${number(pair.marketCap)}</strong></div></div><div class="detail-note">Sumber: DEX Screener, diambil ${new Date().toLocaleTimeString('id-ID')}. Menampilkan pasangan dengan likuiditas terbesar yang tersedia. Grafik dan hasil risiko ditampilkan dari penyedia terpisah. Peta holder tersedia untuk Solana.</div><a class="secondary-button full-width token-detail-link" aria-label="Detail Token di DEX Screener, buka tab baru" href="https://dexscreener.com/${chain}/${encodeURIComponent(pair.pairAddress)}" target="_blank" rel="noopener noreferrer"><img class="token-provider-logo" src="dexscreener-logo.png" alt="" width="24" height="24">Detail Token ${icon('arrow')}</a>`,'HASIL PENCARIAN · DATA PASAR');
      enrichToken(chain,ca,pair);
      status.textContent=`${label} ditemukan pada ${networkName}. Data pasar bersumber dari DEX Screener; grafik dan risiko diperiksa terpisah.`;
    }catch(error){if(request!==current)return;status.textContent=error.name==='AbortError'?'Pencarian terlalu lama. Periksa koneksi dan coba lagi.':error.message==='Failed to fetch'?'Tidak dapat terhubung ke sumber data. Periksa koneksi dan coba lagi.':error.message;}
    finally{clearTimeout(timeout);if(request===current){request=null;submit.disabled=false;}}
  });
  window.EasyTokenSearch={open({chain,address}){if(!validChainAddress(address,chain))return;closeDialog();navigate('ringkasan');input.value=address;chosenChain=chain;chosenPairs=null;form.requestSubmit();}};
  window.addEventListener('focus',inspectClipboard);
  document.addEventListener('visibilitychange',inspectClipboard);
  window.addEventListener('hashchange',route);
  window.addEventListener('easykripto-session',event=>{request?.abort();request=null;submit.disabled=false;chosenChain=null;chosenPairs=null;if(!event.detail.signedIn){input.value='';indicate(null);}route();});
  window.addEventListener('easykripto-network',()=>{if(automaticNetworkChange)return;request?.abort();request=null;submit.disabled=false;chosenChain=null;chosenPairs=null;input.value='';input.placeholder='Tempel CA · jaringan otomatis';input.setAttribute('aria-label','Cari token dengan CA, jaringan otomatis');status.textContent=message();indicate(null);inspectClipboard();});
  input.addEventListener('focus',inspectClipboard);
  route();
})();
