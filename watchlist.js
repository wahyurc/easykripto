'use strict';

(() => {
  const el=id=>document.getElementById(id),root=el('view-pantauan');
  const pageSizes=[10,20,50,100],pages={wallet:1,token:1};
  let size=Number(load('easykripto.watch.pageSize',10)),data=null,account=null,formController=null;
  if(!pageSizes.includes(size))size=10;el('watch-page-size').value=String(size);
  const short=value=>`${value.slice(0,6)}…${value.slice(-4)}`;
  const money=value=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('id-ID',{style:'currency',currency:'USD',maximumSignificantDigits:6}).format(Number(value));
  const number=value=>value==null?'—':new Intl.NumberFormat('id-ID',{maximumSignificantDigits:7}).format(Number(value));
  const time=value=>value?new Date(value).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Belum dimuat';
  const name=chain=>blockchainNetworks.find(n=>n.id===chain)?.name||chain;
  const identity=(item,token=false)=>`<div class="watch-identity">${token?`<span data-watch-token-picture="${escapeHTML(item.id)}"></span>`:`<span class="wallet-avatar">${escapeHTML(item.name.slice(0,2).toUpperCase())}</span>`}<div><strong title="${escapeHTML(item.name)}">${escapeHTML(token?item.symbol:item.name)}</strong><div class="watch-address"><span title="${escapeHTML(item.address)}">${escapeHTML(short(item.address))}</span><button class="watch-copy" type="button" data-copy="${escapeHTML(item.address)}" aria-label="Salin alamat ${escapeHTML(item.name)}">${icon('copy')}</button></div></div></div>`;
  const chain=item=>`<span class="watch-chain">${networkLogo(item.chain)}${escapeHTML(name(item.chain))}</span>`;
  function paginate(kind,items){
    const total=items.length,last=Math.max(1,Math.ceil(total/size));pages[kind]=Math.max(1,Math.min(last,pages[kind]));
    const start=(pages[kind]-1)*size,end=Math.min(start+size,total),label=kind==='wallet'?'wallet':'token';
    el(`${kind}-pagination`).innerHTML=`<span role="status">${total?`${start+1}–${end}`:'0'} dari ${total.toLocaleString('id-ID')} ${label}</span><div><button type="button" data-watch-page="${kind}" data-watch-step="-1" ${pages[kind]===1?'disabled':''} aria-label="Halaman ${label} sebelumnya">Sebelumnya</button><span>Hal. ${pages[kind]} / ${last}</span><button type="button" data-watch-page="${kind}" data-watch-step="1" ${pages[kind]===last?'disabled':''} aria-label="Halaman ${label} berikutnya">Berikutnya</button></div>`;
    return items.slice(start,end);
  }
  function render(model){
    if(model)data=model;if(!data)return;
    const walletQuery=el('wallet-search').value.trim().toLocaleLowerCase('id-ID'),tokenQuery=el('watch-token-search').value.trim().toLocaleLowerCase('id-ID');
    const wallets=data.wallets.filter(item=>`${item.name} ${item.address}`.toLocaleLowerCase('id-ID').includes(walletQuery));
    const tracked=data.tokens.filter(item=>`${item.name} ${item.symbol} ${item.address}`.toLocaleLowerCase('id-ID').includes(tokenQuery));
    el('watch-wallet-count').textContent=data.wallets.length;el('watch-token-count').textContent=data.tokens.length;
    el('wallet-list').innerHTML=paginate('wallet',wallets).map(item=>{
      const snapshot=data.snapshot(item),waiting=data.waiting(item),error=data.error(item),id=escapeHTML(item.id);
      const status=waiting?'Memuat sampel…':error?error:snapshot?time(snapshot.fetchedAt):'Belum dianalisis';
      return `<tr><td>${identity(item)}</td><td>${chain(item)}</td><td class="watch-number">${snapshot?escapeHTML(`${number(snapshot.nativeBalance)} ${snapshot.nativeSymbol}`):'—'}</td><td><div class="watch-row-status${error?' error':''}">${escapeHTML(status)}</div></td><td><div class="watch-row-actions"><button type="button" class="text-button" data-wallet="${id}">Detail</button><button type="button" class="text-button" data-refresh-wallet="${id}" ${waiting?'disabled':''}>Perbarui</button><button type="button" class="icon-button" data-alert="${id}" aria-label="Pantau transaksi baru ${escapeHTML(item.name)}" aria-pressed="${!!state.alerts[item.id]}">${icon('bell')}</button><button type="button" class="icon-button watch-remove" data-remove="${id}" aria-label="Hapus wallet ${escapeHTML(item.name)}">${icon('close')}</button></div></td></tr>`;
    }).join('')||`<tr><td colspan="5" class="watch-empty">${walletQuery?'Tidak ada wallet yang sesuai pencarian.':'Belum ada wallet di jaringan ini. Ketuk Tambah Wallet untuk mulai.'}</td></tr>`;
    const visibleTokens=paginate('token',tracked);
    el('watch-token-list').innerHTML=visibleTokens.map(item=>{
      const market=data.market(item),change=Number(market?.pair?.priceChange?.h24),hasChange=market?.pair?.priceChange?.h24!=null&&Number.isFinite(change),id=escapeHTML(item.id);
      return `<tr><td>${identity(item,true)}</td><td>${chain(item)}</td><td class="watch-number">${market?.error?'—':money(market?.pair?.priceUsd)}</td><td class="watch-number ${hasChange?(change<0?'negative':change>0?'positive':''):''}">${hasChange?`${change>0?'+':''}${change.toLocaleString('id-ID',{maximumFractionDigits:2})}%`:'—'}</td><td><div class="watch-row-status${market?.error?' error':''}">${escapeHTML(market?.error||time(market?.at))}</div></td><td><div class="watch-row-actions"><button type="button" class="text-button" data-token="${id}">Detail</button><button type="button" class="icon-button watch-remove" data-watch-remove-token="${id}" aria-label="Hapus token ${escapeHTML(item.symbol)}">${icon('close')}</button></div></td></tr>`;
    }).join('')||`<tr><td colspan="6" class="watch-empty">${tokenQuery?'Tidak ada token yang sesuai pencarian.':'Belum ada token di jaringan ini. Ketuk Tambah Token atau pantau dari detail token.'}</td></tr>`;
    for(const item of visibleTokens){const picture=[...root.querySelectorAll('[data-watch-token-picture]')].find(node=>node.dataset.watchTokenPicture===item.id);picture?.append(window.EasyTokenUI.iconNode(data.market(item)?.pair?.info?.imageUrl,item.symbol));}
  }
  function addToken(){
    if(!window.EasyDashboard.allowed())return;
    const uid=account,available=supportedNetworks();
    dialog('Tambah token ke pantauan',`<form id="watch-token-form" class="watch-token-form"><div class="form-field"><label for="watch-token-ca">Alamat kontrak (CA)</label><input id="watch-token-ca" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Tempel CA token" aria-describedby="watch-token-error"><small>Jaringan dicari otomatis. Jika alamat ditemukan di beberapa jaringan, pilih token yang sesuai.</small></div><div class="form-field" id="watch-token-network-field" hidden><label for="watch-token-network">Jaringan token</label><select id="watch-token-network"><option value="">Pilih jaringan</option>${available.map(n=>`<option value="${n.id}">${escapeHTML(n.name)}</option>`).join('')}</select></div><p id="watch-token-error" class="form-error" role="status" aria-live="polite"></p><button id="watch-token-save" class="primary-button full-width" type="submit">Tambah ke pantauan</button><button type="button" class="secondary-button full-width" data-action="close-dialog">Batal</button></form>`,'TOKEN PANTAUAN');
    const form=el('watch-token-form'),input=el('watch-token-ca'),select=el('watch-token-network'),message=el('watch-token-error'),submit=el('watch-token-save');
    input.focus();input.addEventListener('input',()=>{formController?.abort();formController=null;select.value='';select.required=false;el('watch-token-network-field').hidden=true;submit.disabled=false;form.removeAttribute('aria-busy');message.textContent='';});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(submit.disabled||account!==uid||!window.EasyDashboard.allowed())return;
      const address=input.value.trim(),solana=validChainAddress(address,'solana');
      if(!solana&&!validChainAddress(address,'ethereum')){message.textContent='Masukkan satu CA Solana atau EVM yang valid.';input.focus();return;}
      const explicit=select.value;let chain=explicit||(solana?'solana':null),pairs=[];
      if(explicit&&!validChainAddress(address,explicit)){message.textContent='Format CA tidak sesuai jaringan yang dipilih.';return;}
      formController?.abort();const controller=new AbortController();formController=controller;submit.disabled=true;form.setAttribute('aria-busy','true');message.textContent='Mendeteksi jaringan dan membaca token…';
      try{
        const endpoint=chain?`https://api.dexscreener.com/token-pairs/v1/${chain}/${encodeURIComponent(address)}`:`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(address)}`;
        const response=await window.EasyAPILog.fetch(endpoint,{credentials:'omit',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
        if(response.status===429)throw new Error('Penyedia membatasi permintaan. Tunggu sebentar lalu coba lagi.');
        if(!response.ok)throw new Error('Data token belum dapat dibaca. Coba lagi nanti.');
        const result=await response.json();if(controller.signal.aborted||account!==uid||!form.isConnected)return;
        pairs=(Array.isArray(result)?result:Array.isArray(result?.pairs)?result.pairs:[]).filter(pair=>pair&&available.some(n=>n.id===pair.chainId)&&typeof pair.baseToken?.address==='string'&&equalChainAddress(pair.baseToken.address,address,pair.chainId));
        const chains=[...new Set(pairs.map(pair=>pair.chainId))];
        if(!chain&&chains.length!==1){
          el('watch-token-network-field').hidden=false;select.required=true;
          for(const option of select.options)option.disabled=chains.length>0&&option.value!==''&&!chains.includes(option.value);
          message.textContent=chains.length?'CA ditemukan di beberapa jaringan. Pilih jaringan lalu ketuk Tambah ke pantauan.':'Jaringan belum dapat dikenali. Pilih jaringan token untuk menyimpan CA; harga dapat belum tersedia.';select.focus();return;
        }
        chain=chain||chains[0];if(!available.some(n=>n.id===chain))throw new Error('Jaringan ini belum didukung aplikasi.');
        if(tokens.some(t=>t.chain===chain&&equalChainAddress(t.address,address,chain))){message.textContent='Token ini sudah ada pada pantauan jaringan tersebut.';return;}
        const pair=pairs.filter(p=>p.chainId===chain).sort((a,b)=>Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0))[0];
        window.EasyDashboard.trackToken({chain,address,name:pair?.baseToken?.name||short(address),symbol:pair?.baseToken?.symbol||'Token',pair});
        if(tokens.some(t=>t.chain===chain&&equalChainAddress(t.address,address,chain))){
          closeDialog();
          if(selectedBlockchain!==chain){const picker=el('network-select');picker.value=chain;picker.dispatchEvent(new Event('change'));}
          else if(!pair)void window.EasyDashboard.refreshTokenPrices();
          navigate('pantauan');toast('Token ditambahkan ke pantauan.');
        }
      }catch(error){if(!controller.signal.aborted&&account===uid&&form.isConnected)message.textContent=error.name==='TimeoutError'?'Pencarian terlalu lama. Coba lagi.':error.message==='Failed to fetch'?'Koneksi ke penyedia terputus. Periksa internet lalu coba lagi.':error.message;}
      finally{if(form.isConnected&&formController===controller){formController=null;submit.disabled=false;form.removeAttribute('aria-busy');}}
    });
  }
  window.EasyWatchlist={render};
  el('watch-add-token').addEventListener('click',addToken);
  el('watch-page-size').addEventListener('change',event=>{const next=Number(event.target.value);if(!pageSizes.includes(next))return;size=next;save('easykripto.watch.pageSize',size);pages.wallet=pages.token=1;render();});
  for(const [id,kind]of [['wallet-search','wallet'],['watch-token-search','token']])el(id).addEventListener('input',()=>{pages[kind]=1;render();});
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    const kind=button.dataset.watchPage;if(['wallet','token'].includes(kind)){pages[kind]+=Number(button.dataset.watchStep);render();}
    const id=button.dataset.watchRemoveToken;if(id&&window.EasyDashboard.allowed()){const token=tokens.find(item=>item.id===id);if(token)dialog('Hapus token dari pantauan?',`<p class="dialog-body-copy">${escapeHTML(token.symbol)} akan dihapus dari pantauan akun ini.</p><button class="danger-button" data-remove-token="${escapeHTML(token.id)}">Hapus token</button><button class="secondary-button full-width" data-action="close-dialog">Batal</button>`,'TOKEN PANTAUAN');}
  });
  el('detail-dialog').addEventListener('close',()=>{formController?.abort();formController=null;});
  window.addEventListener('easykripto-session',event=>{const next=event.detail.user?.id||null;if(next!==account){account=next;pages.wallet=pages.token=1;el('wallet-search').value='';el('watch-token-search').value='';formController?.abort();renderWallets();}});
  window.addEventListener('easykripto-network',()=>{pages.wallet=pages.token=1;renderWallets();});
  renderWallets();
})();
