'use strict';

(() => {
  const status = document.getElementById('login-status');
  const placeholder = document.getElementById('google-placeholder');
  const dashboardTitle = document.title;
  const firebaseConfig = {
    apiKey: 'AIzaSyAMnFu4aNNCOFNep_xXJMklFB0bpfvP-n4',
    authDomain: 'easykripto-40e96.firebaseapp.com',
    projectId: 'easykripto-40e96',
    storageBucket: 'easykripto-40e96.firebasestorage.app',
    messagingSenderId: '625824114212',
    appId: '1:625824114212:web:a9b63f76160432561adab1',
    measurementId: 'G-YZR9K7BPN2'
  };
  let profile = null;
  let auth = null;
  let authSdk = null;
  let loginBusy = false;
  function loginError(error) {
    const messages = {
      'auth/popup-blocked': 'Popup Google diblokir. Izinkan popup untuk situs ini, lalu ketuk tombol Google lagi.',
      'auth/popup-closed-by-user': 'Login dibatalkan. Ketuk tombol Google untuk mencoba lagi.',
      'auth/cancelled-popup-request': 'Jendela login sudah terbuka. Lanjutkan di jendela Google.',
      'auth/unauthorized-domain': 'Login belum tersedia untuk alamat ini. Hubungi pengelola aplikasi.',
      'auth/operation-not-allowed': 'Login Google belum tersedia. Hubungi pengelola aplikasi.',
      'auth/network-request-failed': 'Koneksi login terputus. Periksa koneksi internet, lalu coba lagi.',
      'auth/too-many-requests': 'Terlalu banyak percobaan login. Tunggu sebentar, lalu coba lagi.',
      'auth/web-storage-unsupported': 'Browser tidak mengizinkan penyimpanan sesi. Izinkan data situs, lalu muat ulang halaman.',
      'auth/user-disabled': 'Akun ini dinonaktifkan. Hubungi pengelola aplikasi.'
    };
    return messages[error?.code] || 'Login belum dapat diselesaikan. Muat ulang halaman dan coba lagi.';
  }
  function showUser(user) {
    profile = user;
    document.body.classList.toggle('signed-out', !user);
    window.dispatchEvent(new CustomEvent('easykripto-session',{detail:{signedIn:!!user}}));
    if (user) {
      document.title = dashboardTitle;
      const avatar = document.querySelector('.avatar-button');
      const initials = user.name.trim().split(/\s+/).slice(0,2).map(n=>n[0] || '').join('').toUpperCase() || 'EK';
      avatar.textContent = initials;
      if (user.photoURL) {
        try {
          const photoUrl = new URL(user.photoURL);
          if (photoUrl.protocol === 'https:') {
            const picture = document.createElement('img');
            picture.alt = '';
            picture.decoding = 'async';
            picture.referrerPolicy = 'no-referrer';
            picture.addEventListener('error', () => {
              if (avatar.contains(picture)) avatar.textContent = initials;
            }, {once:true});
            picture.src = photoUrl.href;
            avatar.replaceChildren(picture);
          }
        } catch {}
      }
      avatar.setAttribute('aria-label', `Akun ${user.name}`);
      window.dispatchEvent(new Event('resize'));
    } else {
      document.title = 'Masuk — Easykripto';
      const avatar = document.querySelector('.avatar-button');
      avatar.textContent = 'EK';
      avatar.setAttribute('aria-label', 'Pengaturan tampilan');
      document.querySelector('dialog[open]')?.close();
    }
  }
  async function initializeLogin() {
    placeholder.disabled = true;
    try {
      const [appSdk, sdk] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js')
      ]);
      authSdk = sdk;
      auth = sdk.getAuth(appSdk.initializeApp(firebaseConfig));
      auth.languageCode = 'id';
      await sdk.setPersistence(auth, sdk.browserLocalPersistence);
      sdk.onAuthStateChanged(auth, user => {
        showUser(user ? {id:user.uid, name:user.displayName || user.email || 'Pengguna', email:user.email || '', photoURL:user.providerData.find(provider => provider.providerId === 'google.com')?.photoURL || user.photoURL || ''} : null);
        status.textContent = user ? '' : 'Pilih akun Google untuk melanjutkan.';
        placeholder.disabled = loginBusy;
      }, error => {
        showUser(null);
        placeholder.disabled = true;
        status.textContent = loginError(error);
      });
    } catch (error) {
      showUser(null);
      status.textContent = error?.code ? loginError(error) : 'Layanan login tidak dapat dimuat. Periksa koneksi internet, lalu muat ulang halaman.';
    }
  }
  placeholder.addEventListener('click', async () => {
    if (!auth || !authSdk || loginBusy) return;
    loginBusy = true;
    placeholder.disabled = true;
    placeholder.setAttribute('aria-busy', 'true');
    status.textContent = 'Lanjutkan di jendela Google…';
    try {
      const provider = new authSdk.GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      await authSdk.signInWithPopup(auth, provider);
      location.hash = 'ringkasan';
    } catch (error) {
      status.textContent = loginError(error);
    } finally {
      loginBusy = false;
      placeholder.disabled = false;
      placeholder.removeAttribute('aria-busy');
    }
  });
  document.addEventListener('click', async event => {
    const logout = event.target.closest('[data-logout]');
    if (logout) {
      logout.disabled=true;
      try { await authSdk.signOut(auth);location.hash='ringkasan'; }
      catch { logout.disabled=false;logout.textContent='Gagal keluar. Coba lagi.'; }
      return;
    }
    if (profile && event.target.closest('[data-action="settings"]')) {
      const content=document.getElementById('dialog-content');
      const account=document.createElement('div');account.className='detail-note';
      const label=document.createElement('strong');label.textContent=profile.name;
      const email=document.createElement('p');email.textContent=profile.email;
      account.append(label,email);content.prepend(account);
      const button=document.createElement('button');button.className='secondary-button full-width';button.dataset.logout='true';button.textContent='Keluar dari akun';content.append(button);
    }
  });
  initializeLogin();
})();
