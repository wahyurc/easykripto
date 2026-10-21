'use strict';

(() => {
  const el=id=>document.getElementById(id),root=el('view-pantauan');
  const pageSizes=[10,20,50,100],pages={wallet:1,token:1};
  const selectedWallets=new Set();let filteredWallets=[],pageWallets=[],updating=false;
  let size=Number(load('easykripto.watch.pageSize',10)),data=null,account=null,formController=null,networkSignature='';
  if(!pageSizes.includes(size))size=10;el('watch-page-size').value=String(size);
  const short=value=>`${value.slice(0,6)}…${value.slice(-4)}`;
  const money=value=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('id-ID',{style:'currency',currency:'USD',maximumSignificantDigits:6}).format(Number(value));
  const number=value=>value==null?'—':new Intl.NumberFormat('id-ID',{maximumSignificantDigits:7}).format(Number(value));
  const time=value=>value?new Date(value).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Belum dimuat';
  const name=chain=>blockchainNetworks.find(n=>n.id===chain)?.name||chain;
  const actionPaths={edit:'<path d="m16 3 5 5M4 20l4-1L21 6l-4-4L4 15l-1 6Z"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'};
  const actionIcon=name=>actionPaths[name]?`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${actionPaths[name]}</svg>`:icon(name);
  actionPaths.belloff='<path d="m3 3 18 18M6 6a6 6 0 0 0 0 2c0 7-3 7-3 9h14M10 21h4M10 2a6 6 0 0 1 8 6c0 2 .2 3.5 .6 4.7"/>';
  const walletAction=(item,attribute,label,glyph,{disabled=false,pressed=null,danger=false}={})=>`<button type="button" class="icon-button watch-wallet-action${danger?' watch-remove':''}" ${attribute}="${escapeHTML(item.id)}" aria-label="${escapeHTML(`${label}: ${item.name}`)}" title="${escapeHTML(label)}"${disabled?' disabled':''}${pressed===null?'':` aria-pressed="${pressed}"`}>${actionIcon(glyph)}</button>`;
  function renderSelection(){
    const count=selectedWallets.size,all=el('watch-select-page'),onPage=pageWallets.filter(wallet=>selectedWallets.has(wallet.id)).length;
    all.checked=pageWallets.length>0&&onPage===pageWallets.length;all.indeterminate=onPage>0&&onPage<pageWallets.length;all.disabled=!pageWallets.length;
    el('watch-selected-count').textContent=`${count} wallet dipilih`;
    el('watch-select-filtered').disabled=!filteredWallets.length||count===filteredWallets.length;
    el('watch-select-filtered').textContent=`Pilih semua hasil (${filteredWallets.length})`;
    el('watch-clear-selection').disabled=!count;
    for(const button of root.querySelectorAll('[data-watch-bulk]'))button.disabled=!count||(button.dataset.watchBulk==='update'&&updating);
    for(const input of root.querySelectorAll('[data-watch-select]')){input.checked=selectedWallets.has(input.dataset.watchSelect);input.closest('tr').classList.toggle('watch-selected',input.checked);}
  }
  function runBulk(action){
    if(!selectedWallets.size||!window.EasyDashboard.allowed())return;
    const ids=[...selectedWallets],uid=account,network=selectedBlockchain;
    if(action==='update'){void window.EasyDashboard.refreshAllWallets(ids);return;}
    const valid=()=>uid===account&&network===selectedBlockchain;
    const apply=(kind,value)=>{
      if(!valid())return;
      const count=window.EasyDashboard.bulkWallets(ids,kind,value);
      if(count){selectedWallets.clear();renderSelection();closeDialog();toast(`${count} wallet: ${kind==='remove'?'dihapus dari pantauan':kind==='category'?'kategori diperbarui':value?'notifikasi diaktifkan':'notifikasi dinonaktifkan'}.`);}
    };
    if(action==='category'){
      dialog('Ubah kategori wallet',`<form id="watch-bulk-category-form"><p class="dialog-body-copy">Kategori baru akan diterapkan ke ${ids.length} wallet yang dipilih.</p>${walletCategoryPicker('other','watch-bulk-category')}<button type="submit" class="primary-button full-width">Terapkan kategori</button><button type="button" class="secondary-button full-width" data-action="close-dialog">Batal</button></form>`,'AKSI MASSAL');
      el('watch-bulk-category-form').addEventListener('submit',event=>{event.preventDefault();apply('category',event.currentTarget.querySelector('input[name="watch-bulk-category"]:checked')?.value);});
    }else if(action==='remove'){
      const wallets=state.wallets.filter(wallet=>ids.includes(wallet.id)&&wallet.chain===network);
      dialog('Hapus wallet terpilih?',`<p class="dialog-body-copy">${wallets.length} wallet berikut akan dihapus dari pantauan akun ini, termasuk pengaturan notifikasinya.</p><ul class="watch-bulk-preview">${wallets.slice(0,10).map(wallet=>`<li>${escapeHTML(wallet.name)} <small>${escapeHTML(short(wallet.address))}</small></li>`).join('')}</ul>${wallets.length>10?`<p class="detail-note">Dan ${wallets.length-10} wallet lainnya.</p>`:''}<button type="button" id="watch-bulk-confirm-remove" class="danger-button">Hapus ${wallets.length} wallet</button><button type="button" class="secondary-button full-width" data-action="close-dialog">Batal</button>`,'KONFIRMASI AKSI MASSAL');
      el('watch-bulk-confirm-remove').addEventListener('click',()=>apply('remove'));
    }else if(action==='alerts-on'||action==='alerts-off')apply('alerts',action==='alerts-on');
  }
  const identity=(item,token=false)=>`<div class="watch-identity${token?'':` category-${walletCategory(item.category).id}`}">${token?`<span data-watch-token-picture="${escapeHTML(item.id)}"></span>`:`<span class="wallet-avatar">${escapeHTML(item.name.slice(0,2).toUpperCase())}</span>`}<div><div class="watch-wallet-name"><strong title="${escapeHTML(item.name)}">${escapeHTML(token?item.symbol:item.name)}</strong>${token?'':walletCategoryBadge(item.category)}</div><div class="watch-address"><span title="${escapeHTML(item.address)}">${escapeHTML(short(item.address))}</span><button class="watch-copy" type="button" data-copy="${escapeHTML(item.address)}" aria-label="Salin alamat ${escapeHTML(item.name)}">${icon('copy')}</button></div></div></div>`;
  const chain=item=>`<span class="watch-chain">${networkLogo(item.chain)}${escapeHTML(name(item.chain))}</span>`;
  function networkOptions(){
    const select=el('watch-token-network-filter'),ids=[...new Set([...supportedNetworks().map(n=>n.id),...data.tokens.map(t=>t.chain)])];
    const signature=JSON.stringify(ids.map(id=>[id,name(id)]));if(signature===networkSignature)return;
    const previous=select.value;networkSignature=signature;
    select.innerHTML=`<option value="all">Semua jaringan</option>${ids.map(id=>`<option value="${escapeHTML(id)}">${escapeHTML(name(id))}</option>`).join('')}`;
    select.value=ids.includes(previous)?previous:'all';
  }
  function paginate(kind,items){
    const total=items.length,last=Math.max(1,Math.ceil(total/size));pages[kind]=Math.max(1,Math.min(last,pages[kind]));
    const start=(pages[kind]-1)*size,end=Math.min(start+size,total),label=kind==='wallet'?'wallet':'token';
    el(`${kind}-pagination`).innerHTML=`<span role="status">${total?`${start+1}–${end}`:'0'} dari ${total.toLocaleString('id-ID')} ${label}</span><div><button type="button" data-watch-page="${kind}" data-watch-step="-1" ${pages[kind]===1?'disabled':''} aria-label="Halaman ${label} sebelumnya">Sebelumnya</button><span>Hal. ${pages[kind]} / ${last}</span><button type="button" data-watch-page="${kind}" data-watch-step="1" ${pages[kind]===last?'disabled':''} aria-label="Halaman ${label} berikutnya">Berikutnya</button></div>`;
    return items.slice(start,end);
  }
  function render(model,refreshPrices=false){
    if(model)data=model;if(!data)return;
    networkOptions();
    const walletQuery=el('wallet-search').value.trim().toLocaleLowerCase('id-ID'),tokenQuery=el('watch-token-search').value.trim().toLocaleLowerCase('id-ID');
    const category=el('watch-wallet-category').value,network=el('watch-token-network-filter').value;
    const wallets=data.wallets.filter(item=>(category==='all'||walletCategory(item.category).id===category)&&`${item.name} ${item.address} ${walletCategory(item.category).label}`.toLocaleLowerCase('id-ID').includes(walletQuery));
    const tracked=data.tokens.filter(item=>(network==='all'||item.chain===network)&&`${item.name} ${item.symbol} ${item.address}`.toLocaleLowerCase('id-ID').includes(tokenQuery));
    el('watch-wallet-count').textContent=wallets.length;el('watch-token-count').textContent=tracked.length;
    filteredWallets=wallets;const selectable=new Set(wallets.map(wallet=>wallet.id));for(const id of selectedWallets)if(!selectable.has(id))selectedWallets.delete(id);
    pageWallets=paginate('wallet',wallets);
    el('wallet-list').innerHTML=pageWallets.map(item=>{
      const snapshot=data.snapshot(item),waiting=data.waiting(item),error=data.error(item),id=escapeHTML(item.id);
      const status=waiting?'Memuat saldo & sampel…':error?error:snapshot?time(snapshot.fetchedAt)+(snapshot.transferUnavailable?' · Riwayat transfer belum lengkap':''):'Belum dianalisis';
      const value=snapshot?.assetValue,stable=snapshot?.usdcBalance;
      return `<tr role="row"><td role="cell" data-label="Wallet"><div class="watch-select-identity"><label class="watch-selection-hit"><input type="checkbox" data-watch-select="${id}" aria-label="Pilih wallet ${escapeHTML(item.name)}" ${selectedWallets.has(item.id)?'checked':''}></label>${identity(item)}</div></td><td role="cell" data-label="Jaringan">${chain(item)}</td><td role="cell" data-label="Saldo native" class="watch-number">${snapshot?escapeHTML(`${number(snapshot.nativeBalance)} ${snapshot.nativeSymbol}`):'—'}</td><td role="cell" data-label="Saldo USDC" class="watch-number">${stable!=null?escapeHTML(number(stable))+' USDC':'—'}<small>${snapshot?.usdcSupported===false?'Belum didukung':stable==null?'Belum tersedia':''}</small></td><td role="cell" data-label="Estimasi aset USD" class="watch-number" title="${escapeHTML(value?.basis||'Perbarui wallet untuk menghitung aset')}">${money(value?.usd)}<small>${value?.usd!=null?(value.partial?'Parsial · ':'')+value.pricedAssets+' aset dinilai':'Belum tersedia'}</small></td><td role="cell" data-label="Status & pembaruan"><div class="watch-row-status${error?' error':''}">${escapeHTML(status)}</div></td><td role="cell" data-label="Aksi"><div class="watch-row-actions watch-wallet-actions">${value?walletAction(item,'data-watch-value','Rincian estimasi aset','info'):''}${walletAction(item,'data-wallet','Detail wallet','wallet')}${walletAction(item,'data-watch-edit-wallet','Edit wallet','edit')}${walletAction(item,'data-refresh-wallet',waiting?'Sedang update':'Update wallet','refresh',{disabled:waiting})}${walletAction(item,'data-alert',state.alerts[item.id]?'Nonaktifkan notifikasi transaksi':'Aktifkan notifikasi transaksi','bell',{pressed:!!state.alerts[item.id]})}${walletAction(item,'data-remove','Hapus wallet','trash',{danger:true})}</div></td></tr>`;
    }).join('')||`<tr role="row"><td role="cell" colspan="7" class="watch-empty">${walletQuery||category!=='all'?'Tidak ada wallet yang sesuai filter atau pencarian.':'Belum ada wallet di jaringan ini. Ketuk Tambah Wallet untuk mulai.'}</td></tr>`;
    renderSelection();
    const visibleTokens=paginate('token',tracked);
    el('watch-token-list').innerHTML=visibleTokens.map(item=>{
      const market=data.market(item),change=Number(market?.pair?.priceChange?.h24),hasChange=market?.pair?.priceChange?.h24!=null&&Number.isFinite(change),id=escapeHTML(item.id);
      return `<tr><td>${identity(item,true)}</td><td>${chain(item)}</td><td class="watch-number">${market?.error?'—':money(market?.pair?.priceUsd)}</td><td class="watch-number ${hasChange?(change<0?'negative':change>0?'positive':''):''}">${hasChange?`${change>0?'+':''}${change.toLocaleString('id-ID',{maximumFractionDigits:2})}%`:'—'}</td><td><div class="watch-row-status${market?.error?' error':''}">${escapeHTML(market?.error||time(market?.at))}</div></td><td><div class="watch-row-actions"><button type="button" class="text-button" data-token="${id}">Detail</button><button type="button" class="icon-button watch-remove" data-watch-remove-token="${id}" aria-label="Hapus token ${escapeHTML(item.symbol)}">${icon('close')}</button></div></td></tr>`;
    }).join('')||`<tr><td colspan="6" class="watch-empty">${tokenQuery||network!=='all'?'Tidak ada token yang sesuai filter atau pencarian.':'Belum ada token pantauan. Ketuk Tambah Token atau pantau dari detail token.'}</td></tr>`;
    for(const item of visibleTokens){const picture=[...root.querySelectorAll('[data-watch-token-picture]')].find(node=>node.dataset.watchTokenPicture===item.id);picture?.append(window.EasyTokenUI.iconNode(data.market(item)?.pair?.info?.imageUrl,item.symbol));}
    if(state.route==='pantauan'&&!document.hidden)data.refreshPrices?.(visibleTokens.filter(item=>refreshPrices||!data.market(item)).map(item=>item.id));
  }
  function editWallet(id){
    if(!window.EasyDashboard.allowed())return;
    const wallet=state.wallets.find(item=>item.id===id),uid=account;if(!wallet)return;
    dialog('Edit wallet pantauan',`<form id="watch-edit-wallet-form" class="watch-token-form"><div class="watch-edit-address"><span>${chain(wallet)}</span><code>${escapeHTML(wallet.address)}</code></div><div class="form-field"><label for="watch-edit-wallet-name">Nama wallet</label><input id="watch-edit-wallet-name" value="${escapeHTML(wallet.name)}" required maxlength="80" autocomplete="off" aria-describedby="watch-edit-wallet-error"></div>${walletCategoryPicker(wallet.category,'watch-edit-category')}<p id="watch-edit-wallet-error" class="form-error" role="status" aria-live="polite"></p><button type="submit" class="primary-button full-width">Simpan perubahan</button><button type="button" class="secondary-button full-width" data-action="close-dialog">Batal</button></form>`,'WALLET PANTAUAN');
    const form=el('watch-edit-wallet-form'),input=el('watch-edit-wallet-name'),message=el('watch-edit-wallet-error');input.focus();
    form.addEventListener('submit',event=>{
      event.preventDefault();if(uid!==account||!form.isConnected)return;
      const label=input.value.trim(),category=form.querySelector('input[name="watch-edit-category"]:checked')?.value;
      if(!label){message.textContent='Nama wallet tidak boleh kosong.';input.focus();return;}
      if(window.EasyDashboard.updateWallet(id,{name:label,category})){closeDialog();toast('Nama dan kategori wallet disimpan.');}
      else message.textContent='Wallet belum dapat diubah. Periksa sesi dan daftar pantauan lalu coba lagi.';
    });
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
  window.EasyWatchlist={render,refreshStatus(progress){
    const button=el('watch-refresh-all'),running=!!progress&&!progress.finished;
    updating=running;renderSelection();
    button.disabled=running&&progress.cancelled;button.textContent=running?(progress.cancelled?'Menghentikan…':'Hentikan Update'):'Update All';
    button.setAttribute('aria-busy',String(running));
    el('watch-refresh-status').textContent=progress?`${progress.finished?(progress.cancelled||progress.done<progress.total?'Pembaruan dihentikan. ':'Pembaruan selesai. '):''}${progress.done}/${progress.total} wallet ${name(progress.chain)} · ${progress.success} berhasil dimuat · ${progress.failed} gagal · ${progress.skipped} dilewati.${running?' Antrean mengikuti batas API. Penghentian menunggu permintaan berjalan selesai.':' Nilai parsial dan kendala tersedia pada setiap baris.'}`:'';
  }};
  el('watch-refresh-all').addEventListener('click',()=>void window.EasyDashboard.refreshAllWallets());
  el('watch-select-page').addEventListener('change',event=>{for(const wallet of pageWallets){if(event.target.checked)selectedWallets.add(wallet.id);else selectedWallets.delete(wallet.id);}renderSelection();});
  el('watch-select-filtered').addEventListener('click',()=>{for(const wallet of filteredWallets)selectedWallets.add(wallet.id);renderSelection();});
  el('watch-clear-selection').addEventListener('click',()=>{selectedWallets.clear();renderSelection();});
  root.addEventListener('change',event=>{const id=event.target.dataset.watchSelect;if(!id||!filteredWallets.some(wallet=>wallet.id===id))return;if(event.target.checked)selectedWallets.add(id);else selectedWallets.delete(id);renderSelection();});
  for(const button of root.querySelectorAll('[data-watch-bulk]')){button.innerHTML=actionIcon(button.dataset.watchGlyph);button.addEventListener('click',()=>runBulk(button.dataset.watchBulk));}
  el('watch-add-token').addEventListener('click',addToken);
  el('watch-page-size').addEventListener('change',event=>{const next=Number(event.target.value);if(!pageSizes.includes(next))return;size=next;save('easykripto.watch.pageSize',size);pages.wallet=pages.token=1;render(null,true);});
  for(const [id,kind]of [['wallet-search','wallet'],['watch-token-search','token']])el(id).addEventListener('input',()=>{pages[kind]=1;render(null,kind==='token');});
  for(const [id,kind]of [['watch-wallet-category','wallet'],['watch-token-network-filter','token']])el(id).addEventListener('change',()=>{pages[kind]=1;render(null,kind==='token');});
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    const kind=button.dataset.watchPage;if(['wallet','token'].includes(kind)){pages[kind]+=Number(button.dataset.watchStep);render(null,kind==='token');}
    if(button.dataset.watchEditWallet)editWallet(button.dataset.watchEditWallet);
    if(button.dataset.watchValue&&window.EasyDashboard.allowed()){
      const wallet=state.wallets.find(item=>item.id===button.dataset.watchValue),snapshot=wallet&&data.snapshot(wallet),value=snapshot?.assetValue;
      if(value)dialog('Rincian estimasi aset',`<p class="dialog-body-copy">${escapeHTML(wallet.name)} · ${escapeHTML(name(wallet.chain))}</p><p class="live-metric">${money(value.usd)}</p><p class="detail-note">${value.usd==null?'Nilai belum tersedia.':value.partial?'Subtotal parsial dari aset yang berhasil dinilai.':'Estimasi aset spot yang berhasil dibaca.'} ${value.pricedAssets} aset dinilai; ${value.unpricedAssets||0} aset terbaca belum memiliki harga.</p>${value.warnings?.length?`<ul class="watch-value-warnings">${value.warnings.map(message=>`<li>${escapeHTML(message)}</li>`).join('')}</ul>`:''}<p class="detail-note">${escapeHTML(value.basis)}</p><p class="detail-note">Snapshot saldo: ${escapeHTML(time(snapshot.fetchedAt))}. Harga memakai cache sampai dua menit.</p><button class="secondary-button full-width" data-action="close-dialog">Tutup</button>`,'ESTIMASI USD');
    }
    const id=button.dataset.watchRemoveToken;if(id&&window.EasyDashboard.allowed()){const token=tokens.find(item=>item.id===id);if(token)dialog('Hapus token dari pantauan?',`<p class="dialog-body-copy">${escapeHTML(token.symbol)} akan dihapus dari pantauan akun ini.</p><button class="danger-button" data-remove-token="${escapeHTML(token.id)}">Hapus token</button><button class="secondary-button full-width" data-action="close-dialog">Batal</button>`,'TOKEN PANTAUAN');}
  });
  el('detail-dialog').addEventListener('close',()=>{formController?.abort();formController=null;});
  window.addEventListener('easykripto-session',event=>{const next=event.detail.user?.id||null;if(next!==account){account=next;selectedWallets.clear();pages.wallet=pages.token=1;el('wallet-search').value='';el('watch-token-search').value='';el('watch-wallet-category').value='all';el('watch-token-network-filter').value='all';formController?.abort();renderWallets();}});
  window.addEventListener('easykripto-network',()=>{selectedWallets.clear();pages.wallet=1;renderWallets();});
  window.addEventListener('hashchange',()=>{if(state.route==='pantauan')render(null,true);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.route==='pantauan')render(null,true);});
  renderWallets();
})();
