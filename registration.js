'use strict';
(() => {
  const el=id=>document.getElementById(id);
  let mode='login',servicesPromise=null,current=null,stop=null,epoch=0,registration=null;
  let complete=null,signupName='',formBusy=false,lastSent=0;
  const services=()=>servicesPromise ||= Promise.all([
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')
  ]).then(([app,sdk])=>({sdk,db:sdk.getFirestore(app.getApp())})).catch(error=>{servicesPromise=null;throw error;});
  const errorText=error=>({
    'auth/email-already-in-use':'Email sudah digunakan. Masuk dengan metode yang digunakan sebelumnya atau gunakan Lupa kata sandi.',
    'auth/invalid-credential':'Email atau kata sandi tidak sesuai. Coba lagi atau gunakan Lupa kata sandi.',
    'auth/user-not-found':'Email atau kata sandi tidak sesuai. Coba lagi atau gunakan Lupa kata sandi.',
    'auth/wrong-password':'Email atau kata sandi tidak sesuai. Coba lagi atau gunakan Lupa kata sandi.',
    'auth/invalid-email':'Alamat email belum valid.',
    'auth/weak-password':'Kata sandi belum memenuhi persyaratan. Gunakan minimal 8 karakter.',
    'auth/password-does-not-meet-requirements':'Kata sandi belum memenuhi kebijakan keamanan. Gunakan kombinasi huruf, angka, dan simbol.',
    'auth/operation-not-allowed':'Pendaftaran email belum tersedia. Hubungi pengelola aplikasi.',
    'auth/too-many-requests':'Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.',
    'auth/network-request-failed':'Koneksi terputus. Periksa internet lalu coba lagi.',
    'permission-denied':'Status pendaftaran belum dapat diakses. Coba kembali atau hubungi pengelola.'
  }[error?.code]||'Permintaan belum dapat diselesaikan. Coba lagi setelah koneksi stabil.');
  function feedback(id,message,error=false){el(id).textContent=message;el(id).dataset.error=String(error);}
  function setMode(value){
    mode=value;const register=value==='register';
    for(const [id,selected]of [['email-login-tab',!register],['email-register-tab',register]]){el(id).setAttribute('aria-selected',String(selected));el(id).tabIndex=selected?0:-1;}
    el('email-auth-panel').setAttribute('aria-labelledby',register?'email-register-tab':'email-login-tab');
    for(const id of ['email-name-field','email-confirm-field','email-register-note'])el(id).hidden=!register;
    el('email-name').required=register;el('email-confirm').required=register;
    el('email-password').minLength=register?8:1;el('email-password').autocomplete=register?'new-password':'current-password';
    el('email-password').value='';el('email-confirm').value='';
    el('email-password-help').textContent=register?'Minimal 8 karakter. Gunakan kombinasi huruf, angka, dan simbol.':'Gunakan kata sandi akun Easykripto.';
    el('email-submit').textContent=register?'Daftar & ajukan persetujuan':'Masuk dengan email';el('email-reset').hidden=register;
    feedback('email-auth-status','');
  }
  function busy(value){formBusy=value;el('email-auth-form').setAttribute('aria-busy',String(value));for(const button of document.querySelectorAll('.auth-tabs button,#email-submit,#email-reset'))button.disabled=value||!window.EasyAuth?.ready();}
  function renderGate(error=false){
    const allowed=!!current&&current.emailVerified&&registration?.status==='approved';
    el('auth-entry').hidden=!!current;el('registration-gate').hidden=!current||allowed;
    if(!current)return;
    el('registration-gate-email').textContent=current.email||'';
    const rejected=registration?.status==='rejected',approved=registration?.status==='approved';
    el('registration-gate-badge').textContent=error?'STATUS BELUM TERSEDIA':rejected?'PENDAFTARAN DITOLAK':approved?'DISETUJUI SUPERADMIN':'MENUNGGU VERIFIKASI';
    el('registration-gate-title').textContent=error?'Status belum dapat diperiksa.':rejected?'Pendaftaran belum disetujui.':!current.emailVerified?'Konfirmasi email kamu.':'Menunggu persetujuan superadmin.';
    el('registration-gate-message').textContent=error?'Akses dashboard tetap ditutup sampai status persetujuan berhasil diperiksa.':rejected?(registration.reason||'Superadmin belum menyetujui pendaftaran ini. Hubungi pengelola jika membutuhkan penjelasan.'):!current.emailVerified?'Buka email konfirmasi dari Easykripto/Firebase, lalu ketuk tautan verifikasi. Periksa juga folder spam.':approved?'Persetujuan diterima. Menyiapkan dashboard…':'Email sudah dikonfirmasi. Superadmin akan meninjau pendaftaranmu secara manual. Kamu tidak perlu mendaftar ulang.';
    el('registration-email-step').classList.toggle('complete',current.emailVerified);
    el('registration-review-step').classList.toggle('complete',approved);el('registration-review-step').classList.toggle('rejected',rejected);
    el('registration-review-step').textContent=rejected?'Pendaftaran ditolak':approved?'Disetujui superadmin':'Persetujuan superadmin';
    el('registration-resend').hidden=current.emailVerified||rejected;
  }
  function apply(user,account,document){
    registration=document;
    if(!document&&user.providerData.every(provider=>provider.providerId!=='password')){current=null;el('auth-entry').hidden=false;el('registration-gate').hidden=true;complete(account);return;}
    current=user;
    if(user.emailVerified&&document?.status==='approved'){
      complete({...account,name:document.name||account.name});renderGate();
    }else{complete(null);renderGate();}
  }
  async function watch(user,account,commit){
    const registrationName=signupName||user?.displayName||user?.email||'Pengguna';
    const version=++epoch;stop?.();stop=null;current=user;complete=commit;registration=null;
    if(!user){renderGate();return;}
    // Do not expose the dashboard while its authorization is being resolved.
    commit(null);el('auth-entry').hidden=true;renderGate(true);
    if(account.role==='superadmin'){current=null;renderGate();commit(account);return;}
    try{
      const {sdk,db}=await services();if(version!==epoch)return;
      const ref=sdk.doc(db,'registrations',user.uid),password=user.providerData.some(provider=>provider.providerId==='password');
      if(password)await sdk.runTransaction(db,async transaction=>{
        const snapshot=await transaction.get(ref);
        if(!snapshot.exists())transaction.set(ref,{uid:user.uid,name:registrationName.trim().slice(0,150),email:user.email,status:'pending',createdAt:sdk.serverTimestamp()});
      });
      if(version!==epoch)return;
      stop=sdk.onSnapshot(ref,snapshot=>{
        if(version!==epoch)return;feedback('registration-gate-status','');apply(user,account,snapshot.exists()?snapshot.data():null);
      },error=>{if(version!==epoch)return;current=user;commit(null);renderGate(true);feedback('registration-gate-status',errorText(error),true);});
    }catch(error){if(version!==epoch)return;commit(null);renderGate(true);feedback('registration-gate-status',errorText(error),true);}
  }
  window.EasyRegistration={watch,ready:()=>busy(formBusy)};
  for(const [id,value]of [['email-login-tab','login'],['email-register-tab','register']]){
    el(id).addEventListener('click',()=>{if(!formBusy)setMode(value);});
    el(id).addEventListener('keydown',event=>{if(!formBusy&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'login':event.key==='End'?'register':mode==='login'?'register':'login';setMode(next);el(next==='login'?'email-login-tab':'email-register-tab').focus();}});
  }
  el('email-toggle-password').addEventListener('click',()=>{const show=el('email-password').type==='password';el('email-password').type=show?'text':'password';el('email-toggle-password').textContent=show?'Sembunyi':'Lihat';el('email-toggle-password').setAttribute('aria-pressed',String(show));el('email-toggle-password').setAttribute('aria-label',show?'Sembunyikan kata sandi':'Tampilkan kata sandi');});
  el('email-auth-form').addEventListener('submit',async event=>{
    event.preventDefault();if(formBusy||!window.EasyAuth?.ready())return;
    const email=el('email-address').value.trim(),password=el('email-password').value;
    if(mode==='register'&&password!==el('email-confirm').value){feedback('email-auth-status','Kata sandi dan pengulangannya belum sama.',true);el('email-confirm').focus();return;}
    if(!navigator.onLine){feedback('email-auth-status','Sambungkan internet untuk melanjutkan.',true);return;}
    busy(true);feedback('email-auth-status',mode==='register'?'Membuat akun dan mengajukan pendaftaran…':'Memeriksa akun…');
    try{
      if(mode==='register'){
        signupName=el('email-name').value.trim();if(!signupName){feedback('email-auth-status','Isi nama lengkap kamu.',true);return;}
        await window.EasyAuth.register(email,password,signupName);
        try{await window.EasyAuth.verifyEmail();lastSent=Date.now();feedback('registration-gate-status','Email konfirmasi sudah dikirim. Periksa kotak masuk dan folder spam.');}catch(error){feedback('registration-gate-status','Akun dibuat, tetapi email konfirmasi belum terkirim. Gunakan Kirim ulang email konfirmasi.',true);}
      }else await window.EasyAuth.emailLogin(email,password);
      el('email-password').value='';el('email-confirm').value='';
    }catch(error){feedback('email-auth-status',errorText(error),true);}
    finally{signupName='';busy(false);}
  });
  el('email-reset').addEventListener('click',async()=>{
    if(formBusy||!window.EasyAuth?.ready())return;
    const input=el('email-address');if(!input.value.trim()||!input.checkValidity()){feedback('email-auth-status','Isi alamat email yang valid terlebih dahulu.',true);input.focus();return;}
    busy(true);try{await window.EasyAuth.resetPassword(input.value.trim());feedback('email-auth-status','Jika email terdaftar untuk login dengan kata sandi, petunjuk pemulihan dikirim. Periksa kotak masuk dan folder spam.');}catch(error){feedback('email-auth-status',errorText(error),true);}finally{busy(false);}
  });
  el('registration-resend').addEventListener('click',async()=>{
    if(Date.now()-lastSent<60000){feedback('registration-gate-status','Tunggu satu menit sebelum mengirim ulang.');return;}
    const button=el('registration-resend');button.disabled=true;
    try{await window.EasyAuth.verifyEmail();lastSent=Date.now();feedback('registration-gate-status','Email konfirmasi dikirim. Periksa kotak masuk dan folder spam.');}catch(error){feedback('registration-gate-status',errorText(error),true);}finally{button.disabled=false;}
  });
  el('registration-check').addEventListener('click',async()=>{
    const button=el('registration-check');button.disabled=true;feedback('registration-gate-status','Memeriksa email dan persetujuan…');
    try{await window.EasyAuth.refreshUser();}catch(error){feedback('registration-gate-status',errorText(error),true);}finally{button.disabled=false;}
  });
  el('registration-logout').addEventListener('click',async()=>{try{await window.EasyAuth.logout();feedback('email-auth-status','');}catch(error){feedback('registration-gate-status',errorText(error),true);}});
  setMode('login');
})();
