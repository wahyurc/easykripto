'use strict';
(() => {
  const el=id=>document.getElementById(id),section=el('registration-admin');
  const labels={pending:'Menunggu',approved:'Disetujui',rejected:'Ditolak'};
  const date=value=>value?.toDate?.().toLocaleString('id-ID',{timeZone:'Asia/Makassar'})||'Belum tersedia';
  let account=null,epoch=0,filter='pending',rows=[],cursor=null,busy=false,reviewing=false,servicePromise=null;
  const services=()=>servicePromise ||= Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')]).then(([app,sdk])=>({sdk,db:sdk.getFirestore(app.getApp())})).catch(error=>{servicePromise=null;throw error;});
  function controls(){for(const b of section.querySelectorAll('button'))b.disabled=busy||reviewing||!account;}
  function render(){
    el('registration-admin-list').innerHTML=rows.map(row=>`<article class="registration-record"><div><h3>${escapeHTML(row.name)}</h3><p>${escapeHTML(row.email)}</p><span class="registration-badge">${labels[row.status]||'Belum tersedia'}</span><p>Diajukan ${escapeHTML(date(row.createdAt))} WITA</p>${row.reviewedAt?`<p>Ditinjau ${escapeHTML(date(row.reviewedAt))} WITA</p>`:''}${row.reason?`<p>Catatan: ${escapeHTML(row.reason)}</p>`:''}</div><div class="registration-record-actions">${row.status!=='approved'?`<button type="button" class="primary-button" data-review-registration="${escapeHTML(row.uid)}" data-review-decision="approved">Setujui</button>`:''}${row.status!=='rejected'?`<button type="button" class="reject" data-review-registration="${escapeHTML(row.uid)}" data-review-decision="rejected">${row.status==='approved'?'Cabut persetujuan':'Tolak'}</button>`:''}</div></article>`).join('');
    el('registration-admin-count').textContent=`${rows.length} pendaftaran dimuat`;el('registration-admin-more').hidden=!cursor;controls();
  }
  async function load(more=false){
    if(!account||busy||reviewing)return;
    const version=epoch;busy=true;controls();el('registration-admin-status').textContent='Memuat pendaftaran…';
    try{
      const {sdk,db}=await services(),constraints=[];
      if(filter!=='all')constraints.push(sdk.where('status','==',filter));else constraints.push(sdk.orderBy('createdAt','desc'));
      if(more&&cursor)constraints.push(sdk.startAfter(cursor));constraints.push(sdk.limit(26));
      const result=await sdk.getDocs(sdk.query(sdk.collection(db,'registrations'),...constraints));
      if(version!==epoch||!account)return;
      const docs=result.docs.slice(0,25);cursor=result.docs.length>25?docs.at(-1):null;
      const loaded=docs.map(doc=>({...doc.data(),uid:doc.id}));rows=more?[...rows,...loaded]:loaded;
      render();el('registration-admin-status').textContent=rows.length?'Pilih pendaftaran untuk meninjau. Konfirmasi email dilakukan terpisah oleh pengguna.':'Belum ada pendaftaran pada status ini.';
    }catch{if(version===epoch)el('registration-admin-status').textContent='Pendaftaran belum dapat dimuat. Periksa koneksi dan hak superadmin.';}
    finally{if(version===epoch){busy=false;controls();}}
  }
  function review(uid,decision){
    const row=rows.find(row=>row.uid===uid);if(!row||!account)return;
    const version=epoch,reviewer=account.id;
    dialog(decision==='approved'?'Setujui pendaftaran ini?':'Tolak pendaftaran ini?',`<form id="registration-review-form" class="registration-review-form"><p><strong>${escapeHTML(row.name)}</strong><br>${escapeHTML(row.email)}</p><p>${decision==='approved'?'Akun mendapat akses setelah alamat email dikonfirmasi.':'Akses dashboard dan analisis akan ditutup. Keputusan dapat diubah oleh superadmin.'}</p><label for="registration-reason">Catatan untuk pengguna ${decision==='rejected'?'(wajib)':'(opsional)'}</label><textarea id="registration-reason" maxlength="300" ${decision==='rejected'?'required':''} placeholder="Jelaskan keputusan secara singkat"></textarea><p id="registration-review-status" role="status" aria-live="polite"></p><button class="primary-button full-width" type="submit">${decision==='approved'?'Konfirmasi persetujuan':'Konfirmasi penolakan'}</button><button class="secondary-button full-width" type="button" data-action="close-dialog">Kembali</button></form>`,'VERIFIKASI MANUAL');
    el('registration-review-form').addEventListener('submit',async event=>{
      event.preventDefault();if(reviewing||version!==epoch||account?.id!==reviewer)return;
      const reason=el('registration-reason').value.trim();if(decision==='rejected'&&!reason){el('registration-review-status').textContent='Isi alasan penolakan.';return;}
      const form=event.currentTarget;reviewing=true;form.setAttribute('aria-busy','true');for(const b of form.querySelectorAll('button'))b.disabled=true;controls();
      try{
        const {sdk,db}=await services();if(version!==epoch)throw new Error('Session changed');
        await sdk.runTransaction(db,async transaction=>{
          if(version!==epoch||account?.id!==reviewer)throw new Error('Session changed');
          const ref=sdk.doc(db,'registrations',uid),snapshot=await transaction.get(ref);
          if(!snapshot.exists()||snapshot.data().status!==row.status)throw new Error('Registration changed');
          transaction.update(ref,{status:decision,reason,reviewedAt:sdk.serverTimestamp(),reviewedBy:reviewer});
        });
        if(version!==epoch)return;closeDialog();
        window.EasyNotifications?.push({category:'system',level:decision==='approved'?'success':'warning',title:decision==='approved'?'Pendaftaran disetujui':'Pendaftaran ditolak',message:row.email,key:'registration-review:'+uid+':'+Date.now(),action:{type:'route',route:'superadmin'}});
      }catch{if(version===epoch&&el('registration-review-status'))el('registration-review-status').textContent='Keputusan belum disimpan. Data mungkin telah berubah atau koneksi terputus. Muat ulang daftar sebelum mencoba lagi.';}
      finally{if(version===epoch){reviewing=false;controls();if(form.isConnected)for(const b of form.querySelectorAll('button'))b.disabled=false;if(!el('detail-dialog').open)void load();}}
    });
  }
  section.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||!account||busy||reviewing)return;
    if(button.dataset.registrationFilter){filter=button.dataset.registrationFilter;cursor=null;rows=[];render();for(const b of section.querySelectorAll('[data-registration-filter]'))b.setAttribute('aria-pressed',String(b.dataset.registrationFilter===filter));void load();}
    if(button.dataset.reviewRegistration)review(button.dataset.reviewRegistration,button.dataset.reviewDecision);
  });
  el('registration-admin-refresh').addEventListener('click',()=>void load());
  el('registration-admin-more').addEventListener('click',()=>void load(true));
  window.addEventListener('easykripto-session',event=>{
    const next=event.detail.user?.role==='superadmin'?event.detail.user:null;if(account?.id===next?.id)return;
    epoch++;account=next;rows=[];cursor=null;busy=false;reviewing=false;section.hidden=!account;el('registration-admin-status').textContent='';render();
    if(account&&location.hash==='#superadmin')void load();
  });
  window.addEventListener('hashchange',()=>{if(account&&location.hash==='#superadmin')void load();});
})();
