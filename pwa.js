'use strict';

(() => {
  const base = new URL('./', document.querySelector('link[rel="manifest"]').href);
  const display = window.matchMedia('(display-mode: standalone)');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(navigator.userAgent);
  const supported = window.isSecureContext && 'serviceWorker' in navigator;
  const el = id => document.getElementById(id);
  const key = 'easykripto.pwa.install-snoozed-until';
  let registration = null, installPrompt = null, installing = false, installed = false;
  let updateReady = false, refreshing = false, reloadOnChange = false, lastCheck = 0;
  let reloadTimer = null;
  const standalone = () => display.matches || navigator.standalone === true;
  const snoozed = () => {try{return Number(localStorage.getItem(key)) > Date.now();}catch{return false;}};
  const announce = message => window.EasyNotifications?.toast(message);

  function renderInstall() {
    const hidden = !supported || standalone() || installed;
    document.querySelectorAll('[data-pwa-install]').forEach(button => {button.hidden = hidden;});
    el('pwa-install-card').hidden = hidden || snoozed() || (!installPrompt && !ios) || (location.hash && location.hash !== '#ringkasan');
    const confirm = el('pwa-confirm-install');
    if (confirm) {confirm.hidden = !installPrompt || hidden;confirm.disabled = installing;confirm.textContent = installing ? 'Membuka pemasangan…' : 'Pasang Easykripto';}
  }

  function renderConnection() {
    document.querySelectorAll('[data-pwa-connection]').forEach(area => {
      area.hidden = navigator.onLine;
      if (!navigator.onLine) area.innerHTML = '<span><strong>Koneksi terputus</strong><p>Harga dan analisis belum bisa diperbarui. Daftar yang sudah dimuat tetap tersedia; perubahan pantauan disimpan pada perangkat.</p></span>';
    });
  }

  function renderUpdate() {
    document.querySelectorAll('[data-pwa-update]').forEach(area => {
      area.hidden = !updateReady;
      if (!updateReady) return;
      area.innerHTML = '<span><strong>Versi baru siap digunakan</strong><p>Perbarui saat siap. Halaman dimuat ulang; isi formulir yang belum disimpan akan hilang.</p></span><button type="button" data-pwa-refresh>Perbarui</button>';
      const button = area.querySelector('button');
      button.disabled = refreshing || !navigator.onLine;
      button.textContent = refreshing ? 'Memperbarui…' : navigator.onLine ? 'Perbarui' : 'Menunggu koneksi';
    });
    const button = el('pwa-settings-update');
    if (button) {button.disabled = refreshing || !navigator.onLine;button.textContent = updateReady ? 'Perbarui aplikasi' : 'Periksa pembaruan';}
  }

  function openInstall() {
    const ready = standalone() || installed;
    const steps = ios
      ? '<li>Buka Easykripto di <strong>Safari</strong>. Jika berada di aplikasi lain, pilih buka di browser.</li><li>Ketuk tombol <strong>Bagikan</strong> (kotak dengan panah ke atas).</li><li>Pilih <strong>Tambahkan ke Layar Utama</strong>, lalu <strong>Tambah</strong>. Jika pilihan ini belum terlihat, buka menu lainnya.</li>'
      : android
        ? '<li>Buka Easykripto di <strong>Chrome</strong> pada handphone.</li><li>Ketuk menu <strong>⋮</strong>, lalu <strong>Tambahkan ke layar utama</strong> atau <strong>Instal aplikasi</strong>.</li><li>Konfirmasi pemasangan, lalu buka ikon Easykripto di layar utama.</li>'
        : '<li>Buka Easykripto di <strong>Chrome atau Edge</strong>.</li><li>Pilih ikon pemasangan pada bilah alamat, atau menu browser → <strong>Instal aplikasi</strong>.</li><li>Jika menggunakan browser lain, buka menu berbagi atau menu browser dan cari pilihan pemasangan.</li>';
    dialog(ready ? 'Easykripto sudah terpasang.' : 'Analisis, lebih dekat.', `
      <div class="pwa-install-heading"><img src="${escapeHTML(new URL('icons/icon-192.png',base).href)}" width="64" height="64" alt=""><div><strong>Easykripto</strong><p>Ruang analisis token & wallet<br>Gratis · Bahasa Indonesia</p></div></div>
      <ul class="pwa-benefits"><li>Buka langsung dari layar utama.</li><li>Tampilan aplikasi yang lapang dan nyaman.</li><li>Versi terbaru tanpa unduhan dari toko aplikasi.</li></ul>
      ${ready ? '<p class="pwa-local-note">Aplikasi siap digunakan. Login dan fitur analisis tetap menggunakan koneksi internet.</p>' : `<button id="pwa-confirm-install" class="primary-button full-width" type="button" data-pwa-confirm ${installPrompt?'':'hidden'}>Pasang Easykripto</button><ol class="pwa-steps">${steps}</ol>`}
      <div class="pwa-local-note"><strong>Saat offline</strong><br>Aplikasi menampilkan halaman bantuan koneksi. Daftar yang sudah dimuat pada sesi terbuka tetap bisa dilihat. Login baru, harga, sinkronisasi, dan analisis blockchain membutuhkan internet.<br><br>Notifikasi berjalan saat aplikasi aktif; pemasangan belum mengaktifkan pemantauan 24 jam.</div>
      <button class="secondary-button full-width" type="button" data-action="close-dialog">${ready?'Kembali ke aplikasi':'Nanti saja'}</button>`, 'APLIKASI DI PERANGKATMU');
    renderInstall();
  }

  async function install() {
    if (!installPrompt || installing) return;
    const prompt = installPrompt;
    installing = true;renderInstall();
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        closeDialog();
        announce('Pemasangan disetujui. Browser akan menambahkan ikon Easykripto.');
      } else {
        announce('Pemasangan ditunda. Kamu tetap bisa menggunakan aplikasi melalui browser.');
      }
    } catch {announce('Pemasangan belum dapat dibuka. Ikuti petunjuk dari menu browser.');}
    finally {if(installPrompt === prompt)installPrompt = null;installing = false;renderInstall();}
  }

  function showUpdate() {updateReady = true;renderUpdate();}
  async function refresh() {
    if (refreshing || !navigator.onLine) return;
    if (!registration?.waiting) {location.reload();return;}
    refreshing = true;reloadOnChange = true;renderUpdate();
    registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
    reloadTimer = setTimeout(() => {
      refreshing = false;reloadOnChange = false;renderUpdate();
      announce('Pembaruan belum selesai. Coba lagi setelah koneksi stabil.');
    }, 15000);
  }

  async function checkUpdate(manual = false) {
    if (!registration || !navigator.onLine) {
      if(manual)announce(navigator.onLine?'Aplikasi sedang menyiapkan pemasangan. Coba sebentar lagi.':'Sambungkan internet untuk memeriksa pembaruan.');
      return;
    }
    if (!manual && Date.now()-lastCheck < 15*60000) return;
    lastCheck = Date.now();
    const button = el('pwa-settings-update');
    if (button) {button.disabled = true;button.textContent = 'Memeriksa…';}
    try {
      await registration.update();
      if (registration.waiting) showUpdate();
      else if(manual)announce(registration.installing?'Pembaruan sedang disiapkan. Pemberitahuan muncul setelah siap.':'Pemeriksaan selesai. Belum ada pembaruan yang siap dipasang.');
    } catch {if(manual)announce('Pembaruan belum dapat diperiksa. Coba lagi setelah koneksi stabil.');}
    finally {renderUpdate();}
  }

  function settings() {
    const content = el('dialog-content');
    if (content.querySelector('.pwa-settings')) return;
    const section = document.createElement('section');section.className = 'pwa-settings';
    section.innerHTML = `<button class="secondary-button full-width" type="button" data-pwa-install ${!supported||standalone()||installed?'hidden':''}>Pasang aplikasi di perangkat</button><button id="pwa-settings-update" class="secondary-button full-width" type="button" data-pwa-check ${supported?'':'hidden'}>Periksa pembaruan</button><p>${standalone()||installed?'Dibuka sebagai aplikasi.':'Pemasangan gratis melalui browser.'} Pantauan tetap mengikuti akun Google. Pembaruan tidak menghapus daftar pantauan yang sudah disimpan.</p>`;
    content.append(section);renderUpdate();
  }

  window.EasyPWA = {openInstall, checkUpdate};
  window.addEventListener('beforeinstallprompt', event => {event.preventDefault();installPrompt = event;renderInstall();});
  window.addEventListener('appinstalled', () => {installed = true;installPrompt = null;renderInstall();announce('Easykripto sudah terpasang. Buka dari ikon pada perangkatmu.');});
  display.addEventListener('change', renderInstall);
  window.addEventListener('hashchange', renderInstall);
  window.addEventListener('online', () => {renderConnection();renderUpdate();void checkUpdate();});
  window.addEventListener('offline', () => {renderConnection();renderUpdate();});
  document.addEventListener('visibilitychange', () => {if(!document.hidden)void checkUpdate();});
  document.addEventListener('click', event => {
    const button = event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-pwa-install'))openInstall();
    if(button.hasAttribute('data-pwa-confirm'))void install();
    if(button.hasAttribute('data-pwa-refresh'))void refresh();
    if(button.hasAttribute('data-pwa-check'))void(updateReady ? refresh() : checkUpdate(true));
    if(button.hasAttribute('data-pwa-dismiss')){try{localStorage.setItem(key,Date.now()+7*86400000);}catch{}el('pwa-install-card').hidden=true;}
    if(button.dataset.action==='settings')settings();
  });
  renderConnection();renderInstall();

  if (supported) {
    let controlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if(reloadOnChange){clearTimeout(reloadTimer);location.reload();return;}
      if(controlled)showUpdate();
      controlled = true;
    });
    navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'}).then(value => {
      registration = value;lastCheck = Date.now();
      if(value.waiting)showUpdate();
      const watch = worker => {
        if(!worker)return;
        worker.addEventListener('statechange', () => {if(worker.state==='installed'&&navigator.serviceWorker.controller&&value.waiting)showUpdate();});
      };
      watch(value.installing);
      value.addEventListener('updatefound', () => watch(value.installing));
    }).catch(() => {
      el('pwa-install-card').hidden = true;
      // Online functionality stays available if storage or registration is blocked.
    });
  }
})();
