'use strict';

(() => {
  const el=id=>document.getElementById(id),panel=el('notification-dialog'),trigger=el('notification-trigger');
  const defaults={activity:true,watch:true,system:true,api:true,browser:false};
  const nativeNotices=new Set();
  const categories={activity:'Aktivitas wallet',watch:'Pantauan',system:'Sistem',api:'Penggunaan API'};
  const glyph={activity:'transfer',watch:'wallet',system:'info',api:'activity'};
  const dateFormat=new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Makassar'});
  let account=null,items=[],preferences={...defaults},filter='all',returnFocus,toastTimer,toastRemaining=0,toastStarted=0,undo=null;
  const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
  const storageKey=()=>`easykripto.notifications.${account.id}`;
  function action(value){
    if(!value||typeof value!=='object')return null;
    if(['wallet','token'].includes(value.type)&&blockchainNetworks.some(n=>n.id===value.chain)&&validChainAddress(value.address,value.chain))return {type:value.type,chain:value.chain,address:value.address};
    if(value.type==='sync')return {type:'sync'};
    if(value.type==='route'&&['pantauan','aktivitas','ringkasan','peta','superadmin'].includes(value.route))return value.route==='superadmin'&&account?.role!=='superadmin'?null:{type:'route',route:value.route};
    return null;
  }
  function clean(values){
    const seen=new Set();return (Array.isArray(values)?values:[]).filter(item=>item&&typeof item.id==='string'&&item.id.length<=80&&!seen.has(item.id)&&(seen.add(item.id),true)&&Object.hasOwn(categories,item.category)&&Number.isFinite(item.createdAt)&&item.createdAt>Date.now()-30*86400000&&item.createdAt<=Date.now()+60000&&(item.category!=='api'||account?.role==='superadmin')).slice(0,100).map(item=>({...item,title:String(item.title||'Notifikasi').slice(0,120),message:String(item.message||'').slice(0,600),context:String(item.context||'').slice(0,160),key:typeof item.key==='string'?item.key.slice(0,1000):'',level:['success','warning','error','info'].includes(item.level)?item.level:'info',read:item.read===true,action:action(item.action)}));
  }
  function persist(){if(!account)return;try{localStorage.setItem(storageKey(),JSON.stringify({items,preferences}));}catch{el('notification-storage-note').textContent='Penyimpanan perangkat penuh atau tidak tersedia. Riwayat sementara hanya bertahan selama sesi ini.';}}
  function restore(){
    preferences={...defaults};items=[];if(!account)return;
    try{const saved=JSON.parse(localStorage.getItem(storageKey())||'{}');for(const name of Object.keys(defaults))if(typeof saved.preferences?.[name]==='boolean')preferences[name]=saved.preferences[name];items=clean(saved.items);}catch{}
  }
  function relative(timestamp){const minutes=Math.max(0,Math.floor((Date.now()-timestamp)/60000));return minutes<1?'Baru saja':minutes<60?`${minutes} menit lalu`:minutes<1440?`${Math.floor(minutes/60)} jam lalu`:dateFormat.format(timestamp);}
  function render(){
    const unread=items.filter(item=>!item.read).length,badge=el('notification-badge');badge.hidden=!unread;badge.textContent=unread>99?'99+':String(unread);
    trigger.disabled=!account;trigger.setAttribute('aria-label',`Notifikasi${unread?`, ${unread} belum dibaca`:''}`);
    el('notification-summary').textContent=unread?`${unread} belum dibaca`:'Semua sudah dibaca';
    el('notification-read-all').disabled=!unread;el('notification-clear-read').disabled=!items.some(item=>item.read);
    el('notification-api-preference').hidden=account?.role!=='superadmin';
    for(const checkbox of panel.querySelectorAll('[data-notice-preference]'))checkbox.checked=preferences[checkbox.dataset.noticePreference];
    const permission=!('Notification' in window)?'Tidak didukung browser ini':Notification.permission==='granted'?'Izin browser aktif':Notification.permission==='denied'?'Izin diblokir di pengaturan browser':'Belum meminta izin browser';
    el('notification-permission-status').textContent=permission;el('notification-browser-switch').disabled=!('Notification' in window)||Notification.permission==='denied';
    el('notification-monitor-status').textContent=!navigator.onLine?'Offline · pemantauan dijeda':!state.wallets.some(w=>state.alerts[w.id])?'Belum ada lonceng wallet aktif':'Memantau saat aplikasi terbuka · giliran tiap 65 detik';
    if(!panel.open)return;
    const focused=document.activeElement,focusId=focused?.dataset.noticeId,focusKind=focused?.dataset.noticeCommand;
    const list=el('notification-list');list.replaceChildren();
    for(const button of panel.querySelectorAll('[data-notice-filter]'))button.setAttribute('aria-pressed',String(button.dataset.noticeFilter===filter));
    const shown=items.filter(item=>filter==='unread'?!item.read:filter==='activity'?item.category==='activity':filter==='system'?item.category!=='activity':true);
    if(!shown.length){
      const empty=text('div','','notification-empty');empty.innerHTML=icon('bell');empty.append(text('h3',filter==='unread'?'Tidak ada yang terlewat':'Belum ada notifikasi'),text('p',filter==='unread'?'Semua notifikasi sudah dibaca.':'Aktifkan lonceng pada wallet pantauan untuk mendapatkan ringkasan transfer baru yang teramati.'));
      const button=text('button','Buka pantauan','secondary-button');button.type='button';button.addEventListener('click',()=>{close();navigate('pantauan');});empty.append(button);list.append(empty);
    }
    let day='';const dayFormat=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Makassar',weekday:'long',day:'numeric',month:'long'});
    for(const item of shown){
      const heading=dayFormat.format(item.createdAt);if(heading!==day){list.append(text('h3',heading,'notification-day'));day=heading;}
      const row=text('article','','notification-item');row.classList.toggle('unread',!item.read);row.dataset.level=item.level;
      const mark=text('span','',`notification-glyph ${item.level}`);mark.innerHTML=icon(glyph[item.category]);
      const body=text('div','','notification-item-body'),top=text('div','','notification-item-top');top.append(text('span',categories[item.category],'notification-category'));
      const time=text('time',relative(item.createdAt));time.dateTime=new Date(item.createdAt).toISOString();time.title=`${dateFormat.format(item.createdAt)} WITA`;top.append(time);
      const title=text('h4',item.title);if(!item.read)title.append(text('span','Belum dibaca','notification-unread-dot'));body.append(top,title,text('p',item.message));if(item.context)body.append(text('small',item.context,'notification-context'));
      const actions=text('div','','notification-item-actions');
      if(item.action){const button=text('button',item.action.type==='wallet'?'Lihat wallet':item.action.type==='token'?'Lihat token':item.action.type==='sync'?'Sinkronkan ulang':item.action.route==='superadmin'?'Lihat penggunaan API':'Lihat detail','notification-open');button.type='button';button.dataset.noticeCommand='open';button.dataset.noticeId=item.id;button.addEventListener('click',()=>{item.read=true;persist();close();render();run(item.action);});actions.append(button);}
      const read=text('button',item.read?'Tandai belum dibaca':'Tandai dibaca','notification-read');read.type='button';read.dataset.noticeCommand='read';read.dataset.noticeId=item.id;read.addEventListener('click',()=>{item.read=!item.read;persist();render();});actions.append(read);body.append(actions);row.append(mark,body);list.append(row);
    }
    if(focusId){const replacement=[...panel.querySelectorAll('[data-notice-id]')].find(button=>button.dataset.noticeId===focusId&&button.dataset.noticeCommand===focusKind);(replacement||list).focus({preventScroll:true});}
  }
  function run(value){
    if(!account||!value)return;
    if(value.type==='wallet')window.EasyWallet.open({address:value.address,chain:value.chain});
    else if(value.type==='token')window.EasyTokenSearch.open({address:value.address,chain:value.chain});
    else if(value.type==='sync'){navigate('pantauan');if(window.EasyDashboard.allowed())window.EasyDashboard.persist();}
    else if(value.type==='route'&&(value.route!=='superadmin'||account.role==='superadmin'))navigate(value.route);
  }
  function dismissToast(){clearTimeout(toastTimer);toastRemaining=0;el('toast').classList.remove('show');el('toast').replaceChildren();}
  function resumeToast(){clearTimeout(toastTimer);if(toastRemaining>0){toastStarted=Date.now();toastTimer=setTimeout(dismissToast,toastRemaining);}}
  function pauseToast(){clearTimeout(toastTimer);toastRemaining=Math.max(0,toastRemaining-(Date.now()-toastStarted));}
  function showToast({title='',message='',level='info',onAction,label='Lihat',duration=6500}={}){
    dismissToast();const root=el('toast');root.classList.add('notification-toast');root.dataset.level=level;
    const glyphNode=text('span','','notification-toast-glyph');glyphNode.innerHTML=icon(level==='success'?'shield':level==='warning'||level==='error'?'info':'bell');
    const copy=text('div','','notification-toast-copy');if(title)copy.append(text('strong',title));copy.append(text('p',String(message).slice(0,600)));root.append(glyphNode,copy);
    if(onAction){const button=text('button',label,'notification-toast-action');button.type='button';button.addEventListener('click',()=>{dismissToast();onAction();});root.append(button);}
    const closeButton=text('button','','notification-toast-close');closeButton.type='button';closeButton.setAttribute('aria-label','Tutup pemberitahuan');closeButton.innerHTML=icon('close');closeButton.addEventListener('click',dismissToast);root.append(closeButton);
    root.classList.add('show');toastRemaining=duration;resumeToast();
  }
  function push(value){
    if(!account||!Object.hasOwn(categories,value?.category)||!preferences[value.category]||(value.category==='api'&&account.role!=='superadmin'))return;
    const key=String(value.key||'').slice(0,1000),now=Date.now();
    if(key&&items.some(item=>item.key===key&&now-item.createdAt<(value.dedupeMs||600000)))return;
    const item=clean([{...value,id:crypto.randomUUID(),key,createdAt:now,read:false,action:action(value.action)}])[0];if(!item)return;
    items.unshift(item);items=clean(items);persist();render();
    if(!panel.open&&value.toast!==false)showToast({title:item.title,message:item.message,level:item.level,onAction:()=>{open();const found=el('notification-list').querySelector(`[data-notice-id="${item.id}"]`);found?.scrollIntoView({block:'nearest'});},label:'Lihat'});
    if(preferences.browser&&'Notification' in window&&Notification.permission==='granted'&&!document.hasFocus())try{const uid=account.id,notification=new Notification(item.title,{body:item.message,tag:item.key||item.id});nativeNotices.add(notification);notification.onclose=()=>nativeNotices.delete(notification);notification.onclick=()=>{window.focus();if(account?.id===uid)open();notification.close();};if(nativeNotices.size>20){const oldest=nativeNotices.values().next().value;oldest.close();nativeNotices.delete(oldest);}}catch{/* Native mobile notifications may require a service worker. */}
    window.dispatchEvent(new CustomEvent('easykripto-notification',{detail:{category:item.category,id:item.id}}));
  }
  function open(){if(!account||panel.open)return;returnFocus=document.activeElement;if(el('detail-dialog').open)closeDialog();dismissToast();panel.showModal();trigger.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';render();}
  function close(){if(panel.open)panel.close();}
  async function browserPermission(enable=true){
    if(!account)return;const uid=account.id;
    if(!enable){preferences.browser=false;persist();render();return;}
    if(!('Notification' in window)){showToast({message:'Browser ini belum mendukung notifikasi perangkat. Pusat notifikasi tetap tersedia.'});return;}
    try{const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;if(account?.id!==uid)return;preferences.browser=permission==='granted';persist();render();showToast({message:permission==='granted'?'Notifikasi browser diaktifkan saat aplikasi berjalan.':'Izin belum diberikan. Gunakan pusat notifikasi atau ubah izin situs pada pengaturan browser.'});}catch{if(account?.id===uid)showToast({message:'Notifikasi perangkat belum tersedia pada browser ini. Pusat notifikasi tetap dapat digunakan.'});}
  }
  window.EasyNotifications={push,toast:message=>showToast(typeof message==='string'?{message}:message),open,browserPermission};
  trigger.addEventListener('click',open);el('notification-close').addEventListener('click',close);
  panel.addEventListener('click',event=>{if(event.target===panel){const box=panel.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}});
  panel.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');document.body.style.overflow=el('detail-dialog').open?'hidden':'';if(returnFocus?.isConnected&&!el('detail-dialog').open)returnFocus.focus({preventScroll:true});});
  for(const button of panel.querySelectorAll('[data-notice-filter]'))button.addEventListener('click',()=>{filter=button.dataset.noticeFilter;render();});
  el('notification-read-all').addEventListener('click',()=>{items.forEach(item=>item.read=true);persist();render();});
  el('notification-clear-read').addEventListener('click',()=>{undo={uid:account.id,items:items.filter(item=>item.read)};items=items.filter(item=>!item.read);persist();render();showToast({message:'Notifikasi yang sudah dibaca dihapus.',label:'Urungkan',onAction:()=>{if(undo?.uid===account?.id){items=clean([...items,...undo.items].sort((a,b)=>b.createdAt-a.createdAt));undo=null;persist();render();}}});});
  for(const checkbox of panel.querySelectorAll('[data-notice-preference]'))checkbox.addEventListener('change',()=>{const name=checkbox.dataset.noticePreference;if(name==='browser'){void browserPermission(checkbox.checked);return;}preferences[name]=checkbox.checked;persist();});
  el('toast').addEventListener('pointerenter',pauseToast);el('toast').addEventListener('pointerleave',resumeToast);el('toast').addEventListener('focusin',pauseToast);el('toast').addEventListener('focusout',resumeToast);
  window.addEventListener('easykripto-session',event=>{const next=event.detail.user||null;if(account?.id===next?.id&&account?.role===next?.role)return;close();dismissToast();nativeNotices.forEach(notice=>notice.close());nativeNotices.clear();el('notification-list').replaceChildren();account=next;undo=null;filter='all';restore();el('notification-storage-note').textContent='Riwayat 30 hari, maksimal 100 notifikasi per akun di perangkat ini. Tidak disinkronkan antarperangkat.';render();if(account&&!navigator.onLine)push({category:'system',level:'warning',title:'Perangkat sedang offline',message:'Pemantauan dan sinkronisasi memerlukan koneksi. Pantauan yang tersimpan pada perangkat tetap dapat dilihat.',key:'connection-offline',action:{type:'route',route:'pantauan'}});});
  window.addEventListener('easykripto-watch-change',()=>{if(panel.open)render();});
  window.addEventListener('storage',event=>{if(account&&event.key===storageKey()){restore();render();}});
  window.addEventListener('offline',()=>{push({category:'system',level:'warning',title:'Koneksi terputus',message:'Pemantauan tidak dapat diperbarui. Perubahan pantauan tetap disimpan pada perangkat sampai sinkronisasi berhasil.',key:'connection-offline',action:{type:'route',route:'pantauan'}});render();});
  window.addEventListener('online',()=>{push({category:'system',level:'success',title:'Koneksi kembali tersedia',message:'Anda dapat memperbarui data dan menyinkronkan perubahan pantauan yang tertunda.',key:'connection-online',action:{type:'sync'}});render();});
  new MutationObserver(()=>{if(el('detail-dialog').open&&panel.open)close();}).observe(el('detail-dialog'),{attributes:true,attributeFilter:['open']});
  render();
})();
