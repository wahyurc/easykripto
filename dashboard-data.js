'use strict';

(() => {
  const snapshots=new Map(),markets=new Map(),errors=new Map();
  const short=value=>`${String(value).slice(0,6)}…${String(value).slice(-4)}`;
  const key=(chain,address)=>`${chain}:${chain==='solana'?address:address.toLowerCase()}`;
  const format=value=>value==null?'—':new Intl.NumberFormat('id-ID',{maximumSignificantDigits:7}).format(Number(value));
  const money=value=>value==null?'—':new Intl.NumberFormat('id-ID',{style:'currency',currency:'USD',maximumSignificantDigits:6}).format(Number(value));
  const chainName=chain=>blockchainNetworks.find(n=>n.id===chain)?.name||chain;
  const explorer={solana:'https://solscan.io/tx/',ethereum:'https://etherscan.io/tx/',base:'https://basescan.org/tx/',bsc:'https://bscscan.com/tx/',robinhood:'https://robinhoodchain.blockscout.com/tx/'};
  const empty=message=>`<div class="empty-state">${escapeHTML(message)}</div>`;
  let user=null,epoch=0,ready=false,cloud=null,syncQueue=Promise.resolve(),timer=null,pollIndex=0,busy=new Set(),nodeLookup=new Map();
  let syncMessage='Masuk untuk memuat pantauan.',refreshBusy=false,syncedWatch={wallets:[],tokens:[]};
  function localKey(){return `easykripto.watch.${user.id}`;}
  async function deadline(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Sinkronisasi terlalu lama')),12000);})]);}finally{clearTimeout(timer);}}
  function normalize(items,kind){
    if(!Array.isArray(items))return [];
    const seen=new Set();
    return items.filter(item=>{
      if(!item||typeof item.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)||typeof item.name!=='string'||item.name.length>80||typeof item.address!=='string'||!blockchainNetworks.some(n=>n.id===item.chain)||!validChainAddress(item.address,item.chain))return false;
      const id=key(item.chain,item.address);if(seen.has(id))return false;seen.add(id);return true;
    }).slice(0,20).map(item=>({id:item.id,name:item.name,address:item.address,chain:item.chain,...(kind==='wallets'?{alert:item.alert===true}:{symbol:typeof item.symbol==='string'?item.symbol.slice(0,32):'Token'})}));
  }
  function applyWatch(watch){
    state.wallets=normalize(watch.wallets,'wallets');tokens.splice(0,tokens.length,...normalize(watch.tokens,'tokens'));
    state.alerts=Object.fromEntries(state.wallets.map(w=>[w.id,w.alert===true]));
  }
  function watch(){return {wallets:state.wallets.map(w=>({id:w.id,name:w.name,address:w.address,chain:w.chain,alert:!!state.alerts[w.id]})),tokens:tokens.map(t=>({id:t.id,name:t.name,address:t.address,chain:t.chain,symbol:t.symbol}))};}
  function allowed(){if(!user||!ready){toast('Pantauan akun sedang dimuat. Coba kembali sebentar lagi.');return false;}return true;}
  async function firebase(){
    if(cloud)return cloud;
    const [app,sdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')]);
    cloud={sdk,db:sdk.getFirestore(app.getApp())};return cloud;
  }
  function renderAll(){rebuildEvents();renderSummary();renderWallets();renderActivities();renderMap();const label=$('#watch-sync-status');if(label)label.textContent=syncMessage;}
  function persist(){
    if(!user)return;
    const value=watch(),uid=user.id,version=epoch;save(localKey(),{...value,pending:true,baseline:syncedWatch});
    syncMessage='Menyimpan pantauan ke akun Google…';renderAll();
    syncQueue=syncQueue.catch(()=>{}).then(async()=>{
      if(version!==epoch)return;
      if(!navigator.onLine)throw new Error('Perangkat sedang offline');
      const {sdk,db}=await firebase();
      if(version!==epoch)return;
      const batch=sdk.writeBatch(db);let changes=0;
      for(const kind of ['wallets','tokens']){
        const existing=new Map(syncedWatch[kind].map(item=>[item.id,item])),wanted=new Set(value[kind].map(item=>item.id));
        for(const item of value[kind]){
          const previous=existing.get(item.id);
          if(!previous||Object.entries(item).some(([field,v])=>previous[field]!==v)){batch.set(sdk.doc(db,'accounts',uid,kind,item.id),{...item,updatedAt:sdk.serverTimestamp()});changes++;}
        }
        for(const id of existing.keys())if(!wanted.has(id)){batch.delete(sdk.doc(db,'accounts',uid,kind,id));changes++;}
      }
      if(changes)await batch.commit();
      if(version===epoch){syncedWatch=value;const current=watch(),pending=JSON.stringify(current)!==JSON.stringify(value);save(localKey(),{...current,pending,baseline:value});syncMessage=pending?'Menyimpan perubahan berikutnya…':'Pantauan tersinkron ke akun Google.';renderAll();}
    }).catch(()=>{if(version===epoch){syncMessage='Belum tersinkron. Salinan akun tersedia pada perangkat ini.';renderAll();toast('Sinkronisasi belum berhasil. Ketuk Sinkronkan untuk mencoba lagi.');}});
  }
  function rebuildEvents(){
    const watched=new Set(state.wallets.map(w=>key(w.chain,w.address))),unique=new Map();
    for(const data of snapshots.values())for(const transfer of data.transfers||[]){
      const identity=`${data.chain}:${transfer.id}`;
      const previous=unique.get(identity),observed=previous?.observed||new Set();observed.add(key(data.chain,data.address));
      unique.set(identity,{...transfer,chain:data.chain,observed,source:data.source,fetchedAt:data.fetchedAt});
    }
    const sorted=[...unique.values()].sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0));
    events.splice(0,events.length,...sorted.map((e,index)=>{
      const from=key(e.chain,e.from||''),to=key(e.chain,e.to||'');
      const fromKnown=watched.has(from)||e.observed.has(from),toKnown=watched.has(to)||e.observed.has(to);
      return {...e,id:`event-${index}`,type:fromKnown&&toKnown?'transfer':toKnown?'incoming':'outgoing',minutes:e.timestamp?Math.max(0,(Date.now()-Date.parse(e.timestamp))/60000):Infinity};
    }));
  }
  function feed(){rebuildEvents();return events.filter(e=>e.chain===selectedBlockchain);}
  function walletLabel(address,chain){return state.wallets.find(w=>w.chain===chain&&equalChainAddress(w.address,address||'',chain))?.name||short(address||'?');}
  function assetLabel(e){const token=tokens.find(t=>t.chain===e.chain&&e.assetAddress&&equalChainAddress(t.address,e.assetAddress,e.chain));return token?.symbol||(e.asset?.length>16?short(e.asset):e.asset)||'Token';}
  function row(e){
    const type={incoming:'Masuk',outgoing:'Keluar',transfer:'Antar pantauan'}[e.type];
    return `<button class="activity-row" data-event="${escapeHTML(e.id)}"><span class="activity-icon ${e.type==='incoming'?'buy':e.type==='outgoing'?'sell':'transfer'}">${icon(e.type==='incoming'?'down':e.type==='outgoing'?'up':'transfer')}</span><span class="activity-main"><strong>${escapeHTML(walletLabel(e.from,e.chain))} → ${escapeHTML(walletLabel(e.to,e.chain))}</strong><small>${type} · ${escapeHTML(chainName(e.chain))}</small></span><span class="activity-number">${escapeHTML(format(e.amount))} ${escapeHTML(assetLabel(e))}<small>${Number.isFinite(e.minutes)?`${age(e.minutes)} lalu`:'Waktu tidak tersedia'}</small></span></button>`;
  }
  function summary(){
    const list=feed().filter(e=>e.minutes<=1440),wallets=availableWallets(),currentTokens=tokens.filter(t=>t.chain===selectedBlockchain);
    const examined=[...snapshots.values()].filter(s=>s.chain===selectedBlockchain),newest=examined.map(s=>s.fetchedAt).sort().at(-1);
    const stats=[['Wallet pantauan',wallets.length,'wallet',`${examined.length} alamat dianalisis`],['Transfer masuk / keluar',`${list.filter(e=>e.type==='incoming').length} / ${list.filter(e=>e.type==='outgoing').length}`,'transfer','Jumlah catatan dalam sampel · 24 jam'],['Token pantauan',currentTokens.length,'map','Harga pasangan DEX Screener'],['Aktivitas teramati',list.length,'activity',newest?`Pembaruan ${new Date(newest).toLocaleTimeString('id-ID')}`:'Analisis wallet untuk mulai']];
    $('#stats').innerHTML=stats.map(([label,value,i,note])=>`<article class="stat-card"><div class="stat-label">${label}${icon(i)}</div><div class="stat-value">${value}</div><div class="stat-note">${escapeHTML(note)}</div></article>`).join('');
    $('#recent-activity').innerHTML=list.slice(0,4).map(row).join('')||empty('Belum ada aktivitas 24 jam pada sampel yang dimuat.');
    $('#token-cards').innerHTML=currentTokens.map(t=>{
      const market=markets.get(key(t.chain,t.address));
      return `<button class="token-card" data-token="${escapeHTML(t.id)}"><div class="token-card-head"><span class="token-logo">${escapeHTML(t.symbol.slice(0,2))}</span><span class="token-name"><strong>${escapeHTML(t.symbol)}</strong><small>${escapeHTML(short(t.address))}</small></span></div><div class="token-card-value">${market?.error?'—':money(market?.pair?.priceUsd)}</div><div class="token-card-caption">${market?.error?escapeHTML(market.error):market?.at?`Harga · ${new Date(market.at).toLocaleTimeString('id-ID')}`:'Harga belum dimuat'}</div><div class="token-card-bottom"><span>Buka grafik & risiko</span>${icon('arrow')}</div></button>`;
    }).join('')||empty('Cari CA lalu ketuk Pantau token untuk menambahkan token.');
    const counterparties=new Map();list.forEach(e=>{const addr=e.type==='incoming'?e.from:e.to;if(addr)counterparties.set(addr,(counterparties.get(addr)||0)+1);});
    const top=[...counterparties].sort((a,b)=>b[1]-a[1])[0];
    $('.insight-card').innerHTML=`<div class="insight-label">${icon('spark')} CATATAN SAMPEL</div><h2>${top?'Alamat paling sering muncul.':'Mulai dari satu wallet.'}</h2><p>${top?`${escapeHTML(walletLabel(top[0],selectedBlockchain))} muncul pada ${top[1]} dari ${list.length} catatan transfer 24 jam yang dimuat. Frekuensi bukan bukti pemilik yang sama.`:'Tambahkan wallet, lalu analisis untuk melihat hubungan dan aktivitas dari catatan blockchain.'}</p><button class="text-button" data-route="peta">Telusuri peta ${icon('arrow')}</button>`;
  }
  function activities(){
    $('#all-activity').innerHTML=feed().filter(e=>state.type==='all'||e.type===state.type).slice(0,500).map(row).join('')||empty('Belum ada catatan untuk filter ini. Muat data melalui Peta atau Pantauan.');
    $$('.activity-filters button').forEach(b=>{const active=b.dataset.type===state.type;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
  }
  function wallets(){
    const query=$('#wallet-search').value.trim().toLowerCase();
    $('#wallet-list').innerHTML=availableWallets().filter(w=>`${w.name} ${w.address}`.toLowerCase().includes(query)).map(w=>{
      const data=snapshots.get(key(w.chain,w.address)),waiting=busy.has(w.id),error=errors.get(w.id);
      return `<article class="wallet-card"><div class="wallet-card-heading"><span class="wallet-avatar">${escapeHTML(w.name.slice(0,2).toUpperCase())}</span><div><h3>${escapeHTML(w.name)}</h3><small>${escapeHTML(short(w.address))}</small></div></div><div class="wallet-status"><span class="chain-dot"></span>${waiting?'Memuat sampel…':error?escapeHTML(error):data?`${escapeHTML(format(data.nativeBalance))} ${escapeHTML(data.nativeSymbol)} · ${new Date(data.fetchedAt).toLocaleTimeString('id-ID')}`:'Belum dianalisis'}</div><div class="wallet-card-footer"><button class="text-button" data-wallet="${escapeHTML(w.id)}">Detail ${icon('arrow')}</button><button class="text-button" data-refresh-wallet="${escapeHTML(w.id)}" ${waiting?'disabled':''}>Perbarui</button><button class="icon-button" data-alert="${escapeHTML(w.id)}" aria-label="Pantau transaksi baru ${escapeHTML(w.name)}" aria-pressed="${!!state.alerts[w.id]}">${icon('bell')}</button></div></article>`;
    }).join('')||empty('Belum ada wallet yang cocok. Tambahkan alamat publik pada jaringan ini.');
  }
  function mapView(){
    const list=feed().filter(e=>e.minutes<=state.period*60),nodes=new Map(),groups=new Map();nodeLookup=new Map();
    const add=(id,data)=>{const current=nodes.get(id)||{id,...data,count:0};current.count++;nodes.set(id,current);};
    for(const e of list){
      const from=key(e.chain,e.from||'?'),to=key(e.chain,e.to||'?');let source=from,target=to;
      if(state.mode==='wallet'){
        add(from,{address:e.from,name:walletLabel(e.from,e.chain),chain:e.chain,kind:e.fromType==='token-account'?'account':'wallet'});add(to,{address:e.to,name:walletLabel(e.to,e.chain),chain:e.chain,kind:e.toType==='token-account'?'account':'wallet'});
      }else{
        const tokenId=`asset:${e.chain}:${e.assetAddress||e.asset}`,wallet=e.type==='incoming'?e.to:e.from;
        const walletId=key(e.chain,wallet||'?');add(walletId,{address:wallet,name:walletLabel(wallet,e.chain),chain:e.chain,kind:'wallet'});add(tokenId,{address:e.assetAddress,name:assetLabel(e),chain:e.chain,kind:'token'});
        source=e.type==='incoming'?tokenId:walletId;target=e.type==='incoming'?walletId:tokenId;
      }
      if(source===target)continue;
      const id=`${source}>${target}:${e.type}`,group=groups.get(id)||{source,target,type:e.type,events:[]};group.events.push(e);groups.set(id,group);
    }
    const visible=[...nodes.values()].sort((a,b)=>b.count-a.count).slice(0,24),positions=new Map();
    visible.forEach((node,index)=>{const angle=2*Math.PI*index/visible.length-Math.PI/2,ring=index%2?170:115;const position={...node,x:360+Math.cos(angle)*(ring+45),y:230+Math.sin(angle)*ring,r:Math.min(37,21+Math.sqrt(node.count)*2)};positions.set(node.id,position);nodeLookup.set(`node-${index}`,position);});
    let html='',index=0;
    for(const group of groups.values()){
      const a=positions.get(group.source),b=positions.get(group.target);if(!a||!b)continue;
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)continue;
      const path=`M ${a.x+dx/length*(a.r+3)} ${a.y+dy/length*(a.r+3)} L ${b.x-dx/length*(b.r+6)} ${b.y-dy/length*(b.r+6)}`;
      const color=group.type==='incoming'?'#63dac6':group.type==='outgoing'?'#f28e9a':'#aaa0f5',marker=`observed-${index++}`;
      html+=`<defs><marker id="${marker}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker></defs><g class="graph-edge" role="button" tabindex="0" data-edge="${group.events.map(e=>e.id).join(',')}" aria-label="${escapeHTML(a.name)} ke ${escapeHTML(b.name)}"><title>${escapeHTML(a.name)} → ${escapeHTML(b.name)} · ${group.events.length} transfer</title><path class="edge-hit" d="${path}"/><path class="edge-line" d="${path}" stroke="${color}" marker-end="url(#${marker})"/><circle class="flow-dot" r="2.5" fill="${color}" pointer-events="none"><animateMotion dur="4s" repeatCount="indefinite" path="${path}"/></circle></g>`;
    }
    for(const [id,n]of nodeLookup)html+=`<g class="graph-node" role="button" tabindex="0" data-node="${id}" aria-label="${escapeHTML(n.name)}" transform="translate(${n.x} ${n.y})"><circle class="node-outline" r="${n.r}" fill="${n.kind==='token'?'#233c2c':'#1b2c39'}" stroke="${n.kind==='token'?'#94d991':'#7692ac'}"/><text class="wallet-initial" text-anchor="middle" y="5">${escapeHTML(n.name.slice(0,3))}</text><text class="node-label" text-anchor="middle" y="${n.r+20}">${escapeHTML(n.name.slice(0,15))}</text><text class="node-sub" text-anchor="middle" y="${n.r+33}">${n.count} kemunculan</text></g>`;
    $('.graph-world').innerHTML=html;$('.map-count').textContent=`${list.length} catatan · ${visible.length}/${nodes.size} titik · ${state.period===168?'7 hari':state.period+' jam'}`;
    $('.map-empty').hidden=list.length>0;$('.map-empty').innerHTML='Belum ada transfer pada periode ini.<small>Analisis wallet atau pilih periode lebih panjang.</small>';
    $('.map-list').innerHTML=list.map(row).join('')||empty('Tidak ada catatan pada periode ini.');
    $$('.map-modes button').forEach(b=>{const on=b.dataset.mode===state.mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
    $$('.period-selector button').forEach(b=>{const on=Number(b.dataset.period)===state.period;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});transform();motion();
  }
  function showEvents(ids){
    const list=ids.map(id=>events.find(e=>e.id===id)).filter(Boolean);if(!list.length)return;
    dialog(list.length>1?'Jejak hubungan':'Detail transfer',`<div class="detail-note">${list.length} catatan blockchain. Nilai dalam satuan aset, bukan USD.</div>${list.map(e=>`<article class="live-transfer"><strong>${escapeHTML(walletLabel(e.from,e.chain))} → ${escapeHTML(walletLabel(e.to,e.chain))}</strong><p>${escapeHTML(e.amount??'Tidak tersedia')} ${escapeHTML(assetLabel(e))}</p><p>${e.timestamp?escapeHTML(new Date(e.timestamp).toLocaleString('id-ID',{timeZone:'Asia/Makassar'}))+' WITA':'Waktu tidak tersedia'}</p><div class="address-block">Dari: ${escapeHTML(e.from||'?')}<br>Ke: ${escapeHTML(e.to||'?')}</div>${e.endpointType==='token-account'?'<p>Salah satu alamat merupakan akun token, pemiliknya belum diketahui.</p>':''}<a class="secondary-button full-width" href="${explorer[e.chain]+encodeURIComponent(e.hash)}" target="_blank" rel="noopener noreferrer">Buka transaksi</a></article>`).join('')}`,'DATA BLOCKCHAIN');
  }
  function showNode(id){
    const node=nodeLookup.get(id);if(!node)return;
    if(node.kind==='token'){
      if(node.address)window.EasyTokenSearch.open({chain:node.chain,address:node.address});
      else dialog(node.name,'<p class="detail-note">Aset native jaringan. Ukuran titik mengikuti jumlah kemunculan pada sampel, bukan saldo.</p>','ASET NATIVE');return;
    }
    const wallet=state.wallets.find(w=>w.chain===node.chain&&equalChainAddress(w.address,node.address||'',node.chain));
    if(wallet){showWallet(wallet.id);return;}
    dialog(node.kind==='account'?'Akun token':node.name,`<div class="address-block">${escapeHTML(node.address||'?')}</div><button class="secondary-button full-width" data-copy="${escapeHTML(node.address||'')}">Salin alamat</button>${node.kind!=='account'?`<button class="primary-button full-width" data-open-address="${escapeHTML(node.address||'')}" data-chain="${node.chain}">Analisis alamat</button><button class="secondary-button full-width" data-add-address="${escapeHTML(node.address||'')}" data-chain="${node.chain}">Tambahkan pantauan</button>`:'<p class="detail-note">Ini akun token; alamat pemilik belum diketahui pada sampel ini.</p>'}`,'TITIK PETA');
  }
  function receive(data){
    if(!user||!data.transfers)return;
    const id=key(data.chain,data.address),previous=snapshots.get(id);
    if(snapshots.size>=20&&!snapshots.has(id))snapshots.delete(snapshots.keys().next().value);
    snapshots.set(id,data);
    const wallet=state.wallets.find(w=>w.chain===data.chain&&equalChainAddress(w.address,data.address,data.chain));
    if(wallet&&state.alerts[wallet.id]&&previous){
      const known=new Set(previous.transfers.map(t=>t.id)),newest=Math.max(0,...previous.transfers.map(t=>Date.parse(t.timestamp)||0));
      const fresh=data.transfers.filter(t=>!known.has(t.id)&&(Date.parse(t.timestamp)||0)>=newest);
      if(fresh.length){const message=`${wallet.name}: ${fresh.length} transfer baru teramati.`;toast(message);try{if('Notification' in window&&Notification.permission==='granted')new Notification('Easykripto',{body:message,tag:wallet.id});}catch{/* Some mobile browsers only support service-worker notifications. */}}
    }
    renderAll();
  }
  async function refreshWallet(id,quiet=false){
    const wallet=state.wallets.find(w=>w.id===id);if(!wallet||busy.has(id)||!user)return;
    const version=epoch;busy.add(id);errors.delete(id);renderWallets();
    try{
      const data=await window.EasyData.analyze({chain:wallet.chain,address:wallet.address,onWait:message=>{if(version===epoch){errors.set(id,message);renderWallets();}}});
      if(version===epoch&&state.wallets.some(w=>w.id===id)){errors.delete(id);receive(data);if(!quiet)toast(`Sampel ${wallet.name} diperbarui.`);}
    }catch(error){if(version===epoch){errors.set(id,error.message);if(!quiet)toast(error.message);}}
    finally{if(version===epoch){busy.delete(id);renderWallets();}}
  }
  async function refreshTokens(){
    const version=epoch;
    for(const token of tokens.filter(t=>t.chain===selectedBlockchain)){
      if(version!==epoch)return;
      const id=key(token.chain,token.address),previous=markets.get(id);if(previous?.at>Date.now()-120000)continue;
      try{
        const response=await fetch(`https://api.dexscreener.com/token-pairs/v1/${token.chain}/${encodeURIComponent(token.address)}`,{credentials:'omit',signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw new Error(response.status===429?'Kuota pasar dibatasi':'Harga belum tersedia');
        const body=await response.json();const pairs=(Array.isArray(body)?body:[]).filter(p=>p.chainId===token.chain&&typeof p.baseToken?.address==='string'&&equalChainAddress(p.baseToken.address,token.address,token.chain)).sort((a,b)=>Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0));
        if(version===epoch)markets.set(id,{pair:pairs[0],at:Date.now(),error:pairs.length?null:'Pasangan belum ditemukan'});
      }catch(error){if(version===epoch)markets.set(id,{error:'Harga belum dapat dimuat',at:Date.now()});}
      if(version===epoch)renderSummary();
    }
  }
  function schedule(){
    clearTimeout(timer);if(!user)return;
    timer=setTimeout(async()=>{
      if(!document.hidden){const monitored=state.wallets.filter(w=>state.alerts[w.id]);if(monitored.length)await refreshWallet(monitored[pollIndex++%monitored.length].id,true);}
      schedule();
    },65000);
  }
  async function session(event){
    const account=event.detail.user||null;if(user?.id===account?.id)return;
    if($('#detail-dialog').open)closeDialog();
    user=account;epoch++;const version=epoch;ready=false;busy=new Set();snapshots.clear();markets.clear();errors.clear();events.splice(0);applyWatch({});clearTimeout(timer);syncQueue=Promise.resolve();syncedWatch={wallets:[],tokens:[]};
    syncMessage=user?'Memuat pantauan akun Google…':'Masuk untuk memuat pantauan.';renderAll();
    if(!user)return;
    const cached=load(localKey(),{});applyWatch(cached);renderAll();
    try{
      const {sdk,db}=await firebase(),uid=user.id;
      const collections=await deadline(Promise.all(['wallets','tokens'].map(kind=>sdk.getDocs(sdk.collection(db,'accounts',uid,kind)))));
      if(version!==epoch)return;
      const remote={wallets:collections[0].docs.map(d=>({...d.data(),id:d.id})),tokens:collections[1].docs.map(d=>({...d.data(),id:d.id}))};
      syncedWatch={wallets:normalize(remote.wallets,'wallets'),tokens:normalize(remote.tokens,'tokens')};
      const local=watch();
      if(cached.pending){
        const merged={};
        for(const kind of ['wallets','tokens']){
          const base=new Map(normalize(cached.baseline?.[kind],kind).map(item=>[item.id,item]));
          const current=new Map(local[kind].map(item=>[item.id,item]));
          const target=new Map(syncedWatch[kind].map(item=>[item.id,item]));
          for(const id of base.keys())if(!current.has(id))target.delete(id);
          for(const [id,item]of current)if(JSON.stringify(base.get(id))!==JSON.stringify(item))target.set(id,item);
          merged[kind]=[...target.values()];
        }
        applyWatch(merged);ready=true;persist();
      }
      else if(!remote.wallets.length&&!remote.tokens.length&&(local.wallets.length||local.tokens.length)){ready=true;persist();}
      else{applyWatch(remote);save(localKey(),watch());syncMessage='Pantauan tersinkron ke akun Google.';}
    }catch{if(version!==epoch)return;syncedWatch={wallets:normalize(cached.baseline?.wallets,'wallets'),tokens:normalize(cached.baseline?.tokens,'tokens')};syncMessage='Sinkronisasi belum tersedia. Menggunakan salinan akun pada perangkat ini.';}
    if(version!==epoch)return;ready=true;renderAll();schedule();
    void refreshTokens();const first=availableWallets()[0];if(first)void refreshWallet(first.id,true);
  }
  window.EasyDashboard={row,summary,activities,wallets,map:mapView,showEvents,showNode,receive,persist,allowed,
    addWallet(wallet){if(!allowed())return false;if(state.wallets.length>=20){toast('Maksimal 20 wallet per akun untuk menjaga kuota gratis.');return false;}state.wallets.push(wallet);persist();void refreshWallet(wallet.id);return true;},
    removeWallet(id){state.wallets=state.wallets.filter(w=>{if(w.id!==id)return true;snapshots.delete(key(w.chain,w.address));return false;});delete state.alerts[id];errors.delete(id);persist();},
    toggleAlert(id){if(!allowed())return;state.alerts[id]=!state.alerts[id];persist();if(state.alerts[id])void refreshWallet(id,true);toast(state.alerts[id]?'Pantauan aktif selama aplikasi terbuka.':'Pantauan otomatis dimatikan.');schedule();},
    trackToken({chain,address,name,symbol,pair}){if(!allowed())return;if(tokens.some(t=>key(t.chain,t.address)===key(chain,address))){toast('Token sudah ada dalam pantauan.');return;}if(tokens.length>=20){toast('Maksimal 20 token per akun.');return;}tokens.push({id:crypto.randomUUID(),chain,address,name:String(name||'Token').slice(0,80),symbol:String(symbol||'Token').slice(0,32)});if(pair)markets.set(key(chain,address),{pair,at:Date.now()});persist();toast('Token ditambahkan ke pantauan akun.');},
    openToken(id){const token=tokens.find(t=>t.id===id);if(token)window.EasyTokenSearch.open({chain:token.chain,address:token.address});},
    snapshot(wallet){return snapshots.get(key(wallet.chain,wallet.address));}
  };
  document.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.refreshWallet)void refreshWallet(d.refreshWallet);
    if(d.openAddress)window.EasyWallet.open({address:d.openAddress,chain:d.chain});
    if(d.addAddress){const address=d.addAddress;closeDialog();addWallet();$('#wallet-address').value=address;$('#wallet-name').value=short(address);}
    if(d.removeToken&&allowed()){const index=tokens.findIndex(t=>t.id===d.removeToken);if(index>=0){tokens.splice(index,1);persist();closeDialog();toast('Token dihapus dari pantauan.');}}
    if(d.action==='sync-watch'&&allowed()){await syncQueue;persist();}
    if(d.action==='import-watch'&&allowed()){
      const saved=load('easykripto.wallets',[]);
      const legacy=normalize((Array.isArray(saved)?saved:[]).filter(w=>w&&typeof w==='object').map(w=>({...w,chain:w.chain||'solana'})),'wallets');
      for(const wallet of legacy)if(state.wallets.length<20&&!state.wallets.some(w=>key(w.chain,w.address)===key(wallet.chain,wallet.address)))state.wallets.push(wallet);
      persist();toast('Pantauan lama pada perangkat diimpor ke akun ini.');
    }
    if(d.action==='notification-permission'){
      if(!('Notification' in window)){toast('Browser ini belum mendukung notifikasi. Pemberitahuan dalam aplikasi tetap tersedia.');return;}
      try{const permission=await Notification.requestPermission();toast(permission==='granted'?'Notifikasi browser diizinkan selama aplikasi terbuka.':'Pemberitahuan tetap muncul di dalam aplikasi.');}catch{toast('Pemberitahuan tetap tersedia di dalam aplikasi.');}
    }
    if(d.action==='refresh-dashboard'&&!refreshBusy&&allowed()){
      const version=epoch;refreshBusy=true;b.disabled=true;
      try{await refreshTokens();for(const wallet of availableWallets()){if(version!==epoch)break;await refreshWallet(wallet.id,true);}if(version===epoch)toast('Pembaruan selesai. Status setiap wallet tersedia di Pantauan.');}
      finally{refreshBusy=false;b.disabled=false;}
    }
  });
  window.addEventListener('easykripto-session',session);
  window.addEventListener('easykripto-network',()=>{renderAll();if(user)void refreshTokens();});
  renderAll();
})();
