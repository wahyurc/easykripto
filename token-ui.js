'use strict';

(() => {
  const short=address=>`${address.slice(0,6)}…${address.slice(-4)}`;
  const addresses={solana:'https://solscan.io/account/',ethereum:'https://etherscan.io/address/',base:'https://basescan.org/address/',bsc:'https://bscscan.com/address/',robinhood:'https://robinhoodchain.blockscout.com/address/'};
  const node=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;};
  function imageURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.href.length<=2048?url.href:null;}catch{return null;}}
  function iconNode(url,label){
    const frame=node('span','','token-logo token-picture');const fallback=node('span',String(label||'Token').slice(0,2).toUpperCase(),'token-picture-fallback');frame.append(fallback);
    const source=imageURL(url);if(!source)return frame;
    const img=document.createElement('img');img.src=source;img.alt=`Logo ${String(label||'token')}`;img.referrerPolicy='no-referrer';img.decoding='async';img.loading='lazy';
    img.addEventListener('load',()=>{fallback.hidden=true;});img.addEventListener('error',()=>{img.remove();fallback.hidden=false;},{once:true});frame.append(img);return frame;
  }
  function updateButtons(root=document){
    for(const button of root.querySelectorAll('[data-track-holder]')){
      const saved=state.wallets.some(w=>w.chain===button.dataset.chain&&equalChainAddress(w.address,button.dataset.trackHolder,w.chain));
      button.disabled=saved||document.body.classList.contains('signed-out');button.textContent=saved?'Sudah dipantau':'Tambah ke pantauan';button.setAttribute('aria-label',`${saved?'Sudah dipantau':'Tambah ke pantauan'} ${button.dataset.trackHolder}`);
    }
  }
  function holderCard(holder,index,{chain,symbol='token'}){
    const row=document.createElement('article');row.className='holder-card';
    const main=node('div','','holder-card-main'),title=node('strong',`${index+1}. ${short(holder.address)}`),full=node('p',holder.address,'holder-address');main.append(title,full);
    const amount=holder.amount==null?'Saldo tidak tersedia':`${new Intl.NumberFormat('id-ID',{maximumSignificantDigits:8}).format(Number(holder.amount))} ${symbol}`;
    const share=holder.share==null?'Persentase tidak tersedia':`${new Intl.NumberFormat('id-ID',{maximumFractionDigits:4}).format(holder.share)}% supply`;
    main.append(node('p',`${amount} · ${share}`,'holder-balance'));
    const labels=[holder.isContract===true?'Kontrak':null,holder.tag||null,holder.accounts?`${holder.accounts} akun token dalam sampel`:null].filter(Boolean);
    if(labels.length)main.append(node('small',labels.join(' · '),'holder-label'));
    const actions=node('div','','holder-card-actions'),track=node('button','Tambah ke pantauan','primary-button');track.type='button';track.dataset.trackHolder=holder.address;track.dataset.chain=chain;track.dataset.symbol=String(symbol).slice(0,32);
    const copy=node('button','Salin','secondary-button');copy.type='button';copy.dataset.copy=holder.address;
    const link=node('a','Explorer','holder-explorer');link.href=addresses[chain]+encodeURIComponent(holder.address);link.target='_blank';link.rel='noopener noreferrer';
    actions.append(track,copy,link);row.append(main,actions);return row;
  }
  function renderHolders(root,data,{chain,symbol='token'}={}){
    if(!root?.isConnected)return;chain=chain||data.chain;root.replaceChildren();
    const holders=(data.holders||[]).filter(holder=>validChainAddress(holder.address,chain)&&Number(holder.amount)>0);
    const header=node('p',`${holders.length} alamat pada sampel${data.totalHolderCount?` · ${data.totalHolderCount} holder dilaporkan penyedia`:''}`,'holder-summary');root.append(header);
    const list=node('div','','holder-list');holders.forEach((holder,index)=>list.append(holderCard(holder,index,{chain,symbol})));root.append(list);
    if(!holders.length)root.append(node('p','Daftar holder dengan saldo positif belum tersedia dari sumber ini.','live-mode-description'));
    root.append(node('p',`${data.note||'Daftar terbatas pada holder yang dilaporkan penyedia, bukan seluruh holder.'} Sumber: ${data.source||'blockchain'}${data.fetchedAt?` · diambil ${new Date(data.fetchedAt).toLocaleTimeString('id-ID')}`:''}.`,'panel-footnote'));updateButtons(root);
  }
  function fromGoPlus(data,chain){
    const seen=new Set(),holders=[];
    for(const entry of (Array.isArray(data.holders)?data.holders:[]).slice(0,10)){
      if(!validChainAddress(entry.address,chain)||!(Number(entry.balance)>0))continue;
      const address=entry.address.toLowerCase();if(seen.has(address))continue;seen.add(address);
      const ratio=entry.percent==null||entry.percent===''?NaN:Number(entry.percent);
      holders.push({address,amount:String(entry.balance),share:Number.isFinite(ratio)&&ratio>=0&&ratio<=1?ratio*100:null,isContract:entry.is_contract==='1'||entry.is_contract===1,tag:typeof entry.tag==='string'?entry.tag.slice(0,100):''});
    }
    return {chain,holders,totalHolderCount:/^\d+$/.test(String(data.holder_count))?String(data.holder_count):null,source:'GoPlus',fetchedAt:new Date().toISOString(),note:'Maksimal 10 holder yang dilaporkan GoPlus. Dapat mencakup kontrak, pool, exchange, atau alamat burn. Waktu pembaruan data penyedia tidak diketahui; saldo bukan verifikasi real time.'};
  }
  window.EasyTokenUI={iconNode,imageURL,renderHolders,fromGoPlus,updateButtons,
    setDialogIcon({imageUrl,label='Token'}){const heading=document.getElementById('dialog-title');if(!heading)return;heading.classList.add('token-result-title');heading.querySelector('.token-picture')?.remove();heading.prepend(iconNode(imageUrl,label));},
    updateCardIcons(){for(const frame of document.querySelectorAll('[data-token-picture]')){if(frame.dataset.loaded===frame.dataset.image)continue;frame.replaceChildren(...iconNode(frame.dataset.image,frame.dataset.label).childNodes);frame.dataset.loaded=frame.dataset.image;}}
  };
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-track-holder]');if(!button)return;const {trackHolder:address,chain,symbol}=button.dataset;
    if(!blockchainNetworks.some(n=>n.id===chain)||!validChainAddress(address,chain))return;
    const saved=state.wallets.some(w=>w.chain===chain&&equalChainAddress(w.address,address,chain));if(saved){updateButtons();return;}
    const wallet={id:`local-${crypto.randomUUID()}`,name:`Holder ${symbol||'token'} ${short(address)}`.slice(0,80),address,chain,alert:false};
    if(window.EasyDashboard.addWallet(wallet)){updateButtons();toast('Holder ditambahkan ke pantauan akun.');}
  });
  window.addEventListener('easykripto-watch-change',()=>updateButtons());
})();
