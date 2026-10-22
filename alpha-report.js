'use strict';
(() => {
  const el=id=>document.getElementById(id),root=el('view-alpha-report'),body=el('alpha-body');
  let account=null,epoch=0,articles=[],cursor=null,busy=false,saving=false,editing=null,code=false,dirty=false,loaded=false,servicePromise=null;
  const admin=()=>account?.role==='superadmin';
  const services=()=>servicePromise ||= Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')]).then(([app,sdk])=>({sdk,db:sdk.getFirestore(app.getApp())})).catch(error=>{servicePromise=null;throw error;});
  const date=value=>value?.toDate?.().toLocaleString('id-ID',{timeZone:'Asia/Makassar',dateStyle:'medium',timeStyle:'short'})||'Baru saja';
  const safeLink=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}};
  function sanitize(html){
    const source=new DOMParser().parseFromString(String(html),'text/html'),result=document.createElement('div');
    const allowed=new Set(['P','BR','H2','H3','H4','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','PRE','CODE','A','HR','TABLE','THEAD','TBODY','TR','TH','TD']);
    const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','SELECT','LINK','META','TEMPLATE','IMG','VIDEO','AUDIO']);
    function copy(from,to){for(const child of from.childNodes){if(child.nodeType===3){to.append(document.createTextNode(child.textContent));continue;}if(child.nodeType!==1||blocked.has(child.tagName))continue;if(!allowed.has(child.tagName)){copy(child,to);continue;}const node=document.createElement(child.tagName.toLowerCase());if(child.tagName==='A'){const href=safeLink(child.getAttribute('href'));if(href){node.href=href;node.target='_blank';node.rel='noopener noreferrer';}}copy(child,node);to.append(node);}}
    copy(source.body,result);return result.innerHTML;
  }
  const content=()=>sanitize(code?el('alpha-html').value:body.innerHTML);
  function controls(){
    el('alpha-new').hidden=!admin();el('alpha-filter-label').hidden=!admin();
    el('alpha-refresh').disabled=busy||saving||!account;el('alpha-more').disabled=busy||saving;
    for(const input of el('alpha-form').querySelectorAll('input,textarea,select,button'))input.disabled=saving||!admin();
    body.contentEditable=String(admin()&&!saving);el('alpha-editor-close').disabled=saving;
  }
  function render(){
    const query=el('alpha-search').value.trim().toLocaleLowerCase('id-ID'),list=el('alpha-list');list.replaceChildren();
    const shown=articles.filter(item=>`${item.title} ${item.summary}`.toLocaleLowerCase('id-ID').includes(query)).sort((a,b)=>(b.updatedAt?.toMillis?.()||0)-(a.updatedAt?.toMillis?.()||0));
    for(const item of shown){
      const card=document.createElement('article');card.className='panel alpha-card';
      card.innerHTML=`<div class="alpha-card-meta"><span>${item.status==='draft'?'DRAF':'ALPHA REPORT'}</span><time>${escapeHTML(date(item.updatedAt))} WITA</time></div><h2><button type="button" data-alpha-read="${escapeHTML(item.id)}">${escapeHTML(item.title)}</button></h2><p>${escapeHTML(item.summary||'Buka artikel untuk membaca laporan lengkap.')}</p><div class="alpha-card-footer"><span>Oleh ${escapeHTML(item.author)}</span><div><button class="text-button" type="button" data-alpha-read="${escapeHTML(item.id)}">Baca artikel ↗</button>${admin()?`<button class="secondary-button" type="button" data-alpha-edit="${escapeHTML(item.id)}">Edit</button>`:''}</div></div>`;
      list.append(card);
    }
    if(!shown.length){const empty=document.createElement('p');empty.className='alpha-empty';empty.textContent=query?'Tidak ada artikel yang cocok pada daftar yang dimuat.':busy?'Memuat Alpha Report…':'Belum ada artikel pada daftar ini.';list.append(empty);}
    el('alpha-more').hidden=!cursor;controls();
  }
  async function load(more=false){
    if(!account||busy||saving)return;const version=epoch;busy=true;controls();el('alpha-status').textContent='Memuat artikel…';
    try{
      const {sdk,db}=await services();if(version!==epoch)return;
      const filter=admin()?el('alpha-filter').value:'published',constraints=[];
      if(filter!=='all')constraints.push(sdk.where('status','==',filter));
      constraints.push(sdk.orderBy(sdk.documentId()));if(more&&cursor)constraints.push(sdk.startAfter(cursor));constraints.push(sdk.limit(21));
      const result=await sdk.getDocs(sdk.query(sdk.collection(db,'alphaReports'),...constraints));if(version!==epoch)return;
      const docs=result.docs.slice(0,20);cursor=result.docs.length>20?docs.at(-1):null;
      const values=docs.map(doc=>({...doc.data(),id:doc.id}));articles=more?[...articles,...values]:values;loaded=true;
      el('alpha-status').textContent=`${articles.length} artikel dimuat. Daftar yang dimuat diurutkan berdasarkan pembaruan terbaru.`;render();
    }catch{if(version===epoch)el('alpha-status').textContent='Artikel belum dapat dimuat. Periksa koneksi dan akses akun, lalu muat ulang.';}
    finally{if(version===epoch){busy=false;render();}}
  }
  function read(item,preview=false){
    dialog(item.title,`<article class="alpha-content alpha-reader"><p class="alpha-reader-meta">${preview?'PRATINJAU · belum disimpan':escapeHTML(item.author)+' · '+escapeHTML(date(item.updatedAt))+' WITA'}${item.status==='draft'?' · DRAF':''}</p>${sanitize(item.content)}</article>`,'ALPHA REPORT');
    document.getElementById('detail-dialog').classList.add('alpha-dialog');
  }
  function setMode(next){
    if(next===code)return;if(next)el('alpha-html').value=sanitize(body.innerHTML);else body.innerHTML=sanitize(el('alpha-html').value);
    code=next;body.hidden=code;el('alpha-html').hidden=!code;el('alpha-toolbar').hidden=code;
    el('alpha-visual-tab').setAttribute('aria-pressed',String(!code));el('alpha-code-tab').setAttribute('aria-pressed',String(code));
  }
  function edit(item=null){
    if(!admin()||saving)return;if(dirty&&!confirm('Buang perubahan artikel yang belum disimpan?'))return;
    editing=item;dirty=false;setMode(false);el('alpha-title').value=item?.title||'';el('alpha-summary').value=item?.summary||'';body.innerHTML=sanitize(item?.content||'<p></p>');el('alpha-state').value=item?.status||'draft';
    el('alpha-editor-title').textContent=item?'Edit Alpha Report':'Tulis Alpha Report';el('alpha-editor-status').textContent='';el('alpha-editor-panel').hidden=false;controls();el('alpha-editor-panel').scrollIntoView({block:'start',behavior:'smooth'});el('alpha-title').focus({preventScroll:true});
  }
  el('alpha-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!admin()||saving)return;
    const title=el('alpha-title').value.trim(),summary=el('alpha-summary').value.trim(),html=content(),plain=new DOMParser().parseFromString(html,'text/html').body.textContent.trim(),status=el('alpha-state').value;
    if(!title||!plain){el('alpha-editor-status').textContent='Isi judul dan artikel terlebih dahulu.';return;}
    if(new TextEncoder().encode(html).length>100000){el('alpha-editor-status').textContent='Isi artikel terlalu panjang. Maksimal 100 KB HTML.';return;}
    if(status==='published'&&!confirm('Terbitkan artikel ini agar dapat dibaca semua pengguna aplikasi?'))return;
    const version=epoch,uid=account.id,item=editing;saving=true;controls();el('alpha-editor-status').textContent='Menyimpan artikel…';
    try{
      const {sdk,db}=await services();if(version!==epoch||!admin())return;
      const ref=item?sdk.doc(db,'alphaReports',item.id):sdk.doc(sdk.collection(db,'alphaReports'));
      const data={title,summary,content:html,status,author:String(item?.author||account.name||'Tim EasyKripto').slice(0,150),createdAt:item?.createdAt||sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp(),updatedBy:uid};
      await sdk.setDoc(ref,data);if(version!==epoch)return;
      dirty=false;editing=null;el('alpha-editor-panel').hidden=true;toast(status==='published'?'Alpha Report diterbitkan.':'Draf Alpha Report disimpan.');
    }catch{if(version===epoch)el('alpha-editor-status').textContent='Artikel belum tersimpan. Periksa koneksi dan hak superadmin. Isi editor tetap tersedia.';}
    finally{if(version===epoch){saving=false;controls();if(el('alpha-editor-panel').hidden)void load();}}
  });
  root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.alphaRead){const item=articles.find(item=>item.id===button.dataset.alphaRead);if(item)read(item);}if(button.dataset.alphaEdit)edit(articles.find(item=>item.id===button.dataset.alphaEdit));});
  el('alpha-toolbar').addEventListener('mousedown',event=>{if(event.target.closest('button'))event.preventDefault();});
  el('alpha-toolbar').addEventListener('click',event=>{const button=event.target.closest('[data-alpha-command]');if(!button||!admin()||saving)return;let value=button.dataset.alphaValue||null;if(button.dataset.alphaCommand==='createLink'){value=prompt('Alamat tautan lengkap (https://...)');if(!value)return;value=safeLink(value);if(!value){toast('Gunakan tautan http atau https yang valid.');return;}}body.focus();document.execCommand(button.dataset.alphaCommand,false,value);dirty=true;});
  body.addEventListener('paste',event=>{event.preventDefault();if(!admin()||saving)return;const html=event.clipboardData?.getData('text/html');if(html)document.execCommand('insertHTML',false,sanitize(html));else document.execCommand('insertText',false,event.clipboardData?.getData('text/plain')||'');dirty=true;});
  body.addEventListener('drop',event=>event.preventDefault());
  el('alpha-form').addEventListener('input',()=>{dirty=true;});el('alpha-state').addEventListener('change',()=>{dirty=true;});
  el('alpha-visual-tab').addEventListener('click',()=>setMode(false));el('alpha-code-tab').addEventListener('click',()=>setMode(true));
  el('alpha-preview').addEventListener('click',()=>read({title:el('alpha-title').value||'Pratinjau artikel',content:content(),status:el('alpha-state').value},true));
  el('alpha-new').addEventListener('click',()=>edit());el('alpha-editor-close').addEventListener('click',()=>{if(saving||dirty&&!confirm('Tutup editor dan buang perubahan yang belum disimpan?'))return;dirty=false;el('alpha-editor-panel').hidden=true;});
  el('alpha-search').addEventListener('input',render);el('alpha-filter').addEventListener('change',()=>{cursor=null;void load();});el('alpha-refresh').addEventListener('click',()=>void load());el('alpha-more').addEventListener('click',()=>void load(true));
  document.getElementById('detail-dialog').addEventListener('close',()=>document.getElementById('detail-dialog').classList.remove('alpha-dialog'));
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  window.addEventListener('easykripto-session',event=>{account=event.detail.user||null;epoch++;articles=[];cursor=null;loaded=false;busy=false;saving=false;editing=null;dirty=false;el('alpha-form').reset();body.replaceChildren();el('alpha-html').value='';el('alpha-editor-panel').hidden=true;el('alpha-status').textContent='';render();if(account&&location.hash==='#alpha-report')void load();});
  window.addEventListener('hashchange',()=>{if(location.hash==='#alpha-report'&&!loaded)void load();});
})();
