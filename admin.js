'use strict';

(() => {
  const el = id => document.getElementById(id);
  const status = el('admin-status');
  const list = el('admin-record-list');
  const routeNames = {masuk:'Halaman login',ringkasan:'Dashboard',recticker:'Rekomendasi Ticker',bestcoin:'Rekomendasi Ticker',peta:'Peta',pantauan:'Pantauan',aktivitas:'Aktivitas',superadmin:'Superadmin'};
  const dateFormat = new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Makassar'});
  const numberFormat = new Intl.NumberFormat('id-ID');
  let servicePromise, account = null, authorized = false, authEpoch = 0, listRevision = 0;
  let pane = 'visits', filter = 'all', pageIndex = 0, cursors = [null], rows = [], busy = false, hasNext = false;
  let loggedPage = '', syncedAccount = '';
  function services() {
    if (!servicePromise) servicePromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')
    ]).then(([app,sdk]) => ({sdk, db:sdk.getFirestore(app.getApp())})).catch(error=>{servicePromise=null;throw error;});
    return servicePromise;
  }
  function showMessage(text) { list.replaceChildren(); const p=document.createElement('p');p.className='admin-empty';p.textContent=text;list.append(p); }
  function dayStart() {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const value = type => parts.find(part=>part.type===type).value;
    return new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00+08:00`);
  }
  function since(kind) { const day=dayStart();return kind==='today'?day:new Date(day.getTime()-6*86400000); }
  function timestamp(value) { const date=value?.toDate?.();return date&&Number.isFinite(date.getTime())?dateFormat.format(date):'Belum tercatat'; }
  function addText(parent,tag,text,className) { const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;parent.append(node);return node; }
  function renderRows() {
    const search=el('admin-search').value.trim().toLocaleLowerCase('id-ID');
    const shown=rows.filter(row => (pane==='accounts'?[row.name,row.email,row.role]:[routeNames[row.page],row.device,row.browser,row.source,row.userId]).join(' ').toLocaleLowerCase('id-ID').includes(search));
    list.replaceChildren();
    el('admin-record-count').textContent=`${shown.length} dari ${rows.length} data di halaman ini`;
    if (!shown.length) { showMessage(search?'Tidak ditemukan di halaman ini.':'Belum ada catatan pada periode ini.');return; }
    for (const row of shown) {
      const article=document.createElement('article');article.className='admin-record';
      const primary=document.createElement('div'),secondary=document.createElement('div'),time=document.createElement('div');
      if (pane==='accounts') {
        addText(primary,'h3',row.name||'Pengguna');addText(primary,'p',row.email||'Email tidak tersedia');
        const elevated=row.role==='superadmin';addText(secondary,'span',elevated?'Superadmin':'Pengguna',`admin-role${elevated?' elevated':''}`);
        addText(secondary,'p',`Aktif terakhir: ${timestamp(row.lastSeenAt)}`);
        addText(time,'small','Terdaftar');addText(time,'time',timestamp(row.createdAt));
      } else {
        addText(primary,'h3',routeNames[row.page]||'Halaman aplikasi');addText(primary,'p',`${row.device||'Perangkat'} · ${row.browser||'Browser'}`);
        addText(secondary,'small','Sumber kunjungan');addText(secondary,'p',row.source||'Langsung');
        addText(secondary,'small',row.userId?'Akun masuk':'Belum masuk');
        addText(time,'small','Waktu kunjungan');addText(time,'time',timestamp(row.startedAt));
      }
      article.append(primary,secondary,time);list.append(article);
    }
  }
  function updateButtons() {
    el('admin-refresh').disabled=busy||!authorized;
    el('admin-prev').disabled=busy||!authorized||pageIndex===0;
    el('admin-next').disabled=busy||!authorized||!hasNext;
    el('admin-page-label').textContent=`Halaman ${pageIndex+1}`;
    el('admin-tab-visits').disabled=busy;el('admin-tab-accounts').disabled=busy;el('admin-filter').disabled=busy;
  }
  function dataError(error) {
    if (error?.code==='permission-denied') return 'Akses data belum tersedia. Hak superadmin dan pengaturan penyimpanan perlu diaktifkan oleh pengelola.';
    if (error?.code==='unavailable') return 'Data belum dapat dihubungi. Periksa koneksi internet lalu coba lagi.';
    return 'Penyimpanan data belum tersedia. Hubungi pengelola untuk mengaktifkan pencatatan.';
  }
  async function readPage() {
    const revision=++listRevision,epoch=authEpoch;
    const {sdk,db}=await services();
    const field=pane==='accounts'?'createdAt':'startedAt';
    const constraints=[sdk.orderBy(field,'desc')];
    if(filter!=='all')constraints.push(sdk.where(field,'>=',sdk.Timestamp.fromDate(since(filter))));
    if(cursors[pageIndex])constraints.push(sdk.startAfter(cursors[pageIndex]));
    constraints.push(sdk.limit(26));
    const snapshot=await sdk.getDocs(sdk.query(sdk.collection(db,pane),...constraints));
    if(!authorized||epoch!==authEpoch||revision!==listRevision)return;
    hasNext=snapshot.docs.length>25;
    const documents=snapshot.docs.slice(0,25);
    rows=documents.map(document=>document.data());
    cursors[pageIndex+1]=hasNext?documents.at(-1):null;
    renderRows();
  }
  async function readCounts() {
    const epoch=authEpoch,{sdk,db}=await services();
    const accounts=sdk.collection(db,'accounts'),visits=sdk.collection(db,'visits');
    const queries=[accounts,sdk.query(visits,sdk.where('startedAt','>=',sdk.Timestamp.fromDate(since('today')))),sdk.query(visits,sdk.where('startedAt','>=',sdk.Timestamp.fromDate(since('week')))),sdk.query(accounts,sdk.where('createdAt','>=',sdk.Timestamp.fromDate(since('week'))))];
    const counts=await Promise.all(queries.map(query=>sdk.getCountFromServer(query)));
    if(!authorized||epoch!==authEpoch)return;
    ['accounts','today','week','new'].forEach((name,index)=>el(`admin-count-${name}`).textContent=numberFormat.format(counts[index].data().count));
  }
  async function refresh(all=true) {
    if(!authorized||busy)return;
    const epoch=authEpoch;
    busy=true;updateButtons();status.textContent='Memuat catatan terbaru…';list.setAttribute('aria-busy','true');
    try {
      await Promise.all(all?[readPage(),readCounts()]:[readPage()]);
      if(authorized&&epoch===authEpoch)status.textContent=`Diperbarui ${dateFormat.format(new Date())} WITA.`;
    } catch(error) {
      if(authorized&&epoch===authEpoch){rows=[];showMessage('Catatan belum dapat dimuat.');status.textContent=dataError(error);}
    } finally {
      busy=false;updateButtons();list.removeAttribute('aria-busy');
      if(authorized&&epoch!==authEpoch&&location.hash==='#superadmin')void refresh();
    }
  }
  function resetPages() { pageIndex=0;cursors=[null];rows=[];hasNext=false; }
  function pageName() { if(document.body.classList.contains('signed-out'))return 'masuk';const hash=location.hash.slice(1);return routeNames[hash]&&(hash!=='superadmin'||authorized)?hash:'ringkasan'; }
  async function logVisit() {
    if(!account?.id)return;
    const page=pageName();
    if(loggedPage===page)return;
    loggedPage=page;
    const userId=account?.id||'';
    let source='Langsung';try{if(document.referrer)source=new URL(document.referrer).hostname.slice(0,253);}catch{}
    const agent=navigator.userAgent;
    const device=/iPad|Tablet|Android(?!.*Mobile)/i.test(agent)?'Tablet':/Mobi|iPhone|Android/i.test(agent)?'Handphone':'Desktop';
    const browser=/Edg/i.test(agent)?'Edge':/Firefox|FxiOS/i.test(agent)?'Firefox':/Chrome|CriOS/i.test(agent)?'Chrome':/Safari/i.test(agent)?'Safari':'Lainnya';
    try {
      const {sdk,db}=await services();
      const visitId=crypto.randomUUID(),limitRef=sdk.doc(db,'visitLimits',userId);
      await sdk.runTransaction(db,async transaction=>{
        const previous=await transaction.get(limitRef);
        if(previous.exists()&&Date.now()-previous.data().at.toMillis()<60000)return;
        transaction.set(limitRef,{at:sdk.serverTimestamp(),visitId});
        transaction.set(sdk.doc(db,'visits',visitId),{startedAt:sdk.serverTimestamp(),page,device,browser,source,userId});
      });
    } catch { if(loggedPage===page)loggedPage=''; }
  }
  async function syncAccount(user) {
    if(!user?.id)return;
    const signature=`${user.id}:${user.role}`;
    if(syncedAccount===signature)return;
    syncedAccount=signature;
    try {
      const {sdk,db}=await services();
      const ref=sdk.doc(db,'accounts',user.id);
      await sdk.runTransaction(db,async transaction=>{
        const snapshot=await transaction.get(ref);
        const data={uid:user.id,name:user.name.slice(0,150),email:user.email,role:user.role,lastSeenAt:sdk.serverTimestamp()};
        if(snapshot.exists())transaction.update(ref,data);
        else {
          const createdAt=new Date(user.createdAt);
          transaction.set(ref,{...data,createdAt:Number.isFinite(createdAt.getTime())?sdk.Timestamp.fromDate(createdAt):sdk.serverTimestamp()});
        }
      });
    } catch { if(syncedAccount===signature)syncedAccount=''; }
  }
  window.addEventListener('easykripto-session',event=>{
    const next=event.detail.user;
    if(account?.id!==next?.id||account?.role!==next?.role){authEpoch++;resetPages();}
    account=next;authorized=next?.role==='superadmin';
    updateButtons();
    if(!authorized){showMessage('Dashboard ini hanya dapat dibuka oleh superadmin.');['accounts','today','week','new'].forEach(name=>el(`admin-count-${name}`).textContent='—');}
    void syncAccount(next);void logVisit();
    if(authorized&&location.hash==='#superadmin')void refresh();
  });
  window.addEventListener('hashchange',()=>{void logVisit();if(authorized&&location.hash==='#superadmin')void refresh();});
  el('admin-refresh').addEventListener('click',()=>{resetPages();void refresh();});
  el('admin-prev').addEventListener('click',()=>{if(!busy&&pageIndex>0){pageIndex--;void refresh(false);}});
  el('admin-next').addEventListener('click',()=>{if(!busy&&hasNext){pageIndex++;void refresh(false);}});
  el('admin-search').addEventListener('input',renderRows);
  el('admin-filter').addEventListener('change',()=>{filter=el('admin-filter').value;resetPages();void refresh(false);});
  for(const value of ['visits','accounts'])el(`admin-tab-${value}`).addEventListener('click',()=>{
    if(busy||pane===value)return;
    pane=value;filter='all';el('admin-filter').value='all';el('admin-search').value='';resetPages();
    for(const tab of ['visits','accounts']){el(`admin-tab-${tab}`).classList.toggle('active',tab===pane);el(`admin-tab-${tab}`).setAttribute('aria-selected',String(tab===pane));}
    list.setAttribute('aria-labelledby',`admin-tab-${pane}`);
    el('admin-filter-label').textContent=pane==='accounts'?'Periode pendaftaran':'Periode kunjungan';
    el('admin-search').placeholder=pane==='accounts'?'Cari nama atau email':'Cari halaman atau perangkat';
    void refresh(false);
  });
  updateButtons();
})();
