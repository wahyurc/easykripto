'use strict';

(() => {
  const status = document.getElementById('login-status');
  const placeholder = document.getElementById('google-placeholder');
  const container = document.getElementById('google-signin');
  let profile = null;
  async function api(path, options = {}) {
    const response = await fetch(path, {credentials:'same-origin', ...options});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Tidak dapat melanjutkan login.');
    return data;
  }
  function showUser(user) {
    profile = user;
    document.body.classList.toggle('signed-out', !user);
    window.dispatchEvent(new CustomEvent('easykripto-session',{detail:{signedIn:!!user}}));
    if (user) {
      const avatar = document.querySelector('.avatar-button');
      avatar.textContent = user.name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
      avatar.setAttribute('aria-label', `Akun ${user.name}`);
      window.dispatchEvent(new Event('resize'));
    } else document.title = 'Masuk — Easykripto';
  }
  async function initializeLogin() {
    try {
      const current = await api('/api/auth/session');
      if (current.user) { showUser(current.user); return; }
      showUser(null);
      const config = await api('/api/auth/config');
      if (!config.clientId) { status.textContent = 'Login Google sedang disiapkan. Silakan kembali setelah layanan diaktifkan.'; return; }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client?hl=id';
      script.async = true;
      script.onerror = () => { status.textContent = 'Google tidak dapat dimuat. Periksa koneksi lalu muat ulang halaman.'; };
      script.onload = () => {
        google.accounts.id.initialize({client_id:config.clientId, nonce:config.nonce, auto_select:false, callback:async ({credential}) => {
          status.textContent = 'Memverifikasi akun…';
          try {
            const result = await api('/api/auth/google', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential})});
            showUser(result.user);status.textContent='';location.hash='ringkasan';
          } catch (error) { status.textContent = `${error.message} Muat ulang halaman untuk mencoba lagi.`; }
        }});
        placeholder.hidden = true;
        google.accounts.id.renderButton(container,{theme:'outline',size:'large',shape:'pill',text:'signin_with',locale:'id',width:Math.min(360,container.parentElement.clientWidth)});
        status.textContent = 'Pilih akun Google untuk melanjutkan.';
      };
      document.head.append(script);
    } catch { showUser(null);status.textContent='Layanan login belum dapat dihubungi. Jalankan aplikasi melalui server, lalu coba lagi.'; }
  }
  document.addEventListener('click', async event => {
    const logout = event.target.closest('[data-logout]');
    if (logout) {
      logout.disabled=true;
      try { await api('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});location.reload(); }
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
