'use strict';
(() => {
  const retry = document.getElementById('offline-retry');
  const status = document.getElementById('offline-status');
  const root = new URL('./', location.href);
  const update = () => {
    status.textContent = navigator.onLine ? 'Perangkat memiliki koneksi. Ketuk tombol untuk mencoba menghubungkan aplikasi.' : 'Perangkat sedang offline. Aktifkan Wi-Fi atau data seluler untuk melanjutkan.';
  };
  retry.addEventListener('click', async () => {
    retry.disabled = true;
    status.textContent = 'Memeriksa koneksi ke aplikasi…';
    try {
      const url = new URL('index.html', root);
      url.searchParams.set('pwa-reconnect', Date.now());
      const response = await fetch(url, {cache:'no-store', signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('Unavailable');
      root.hash = location.hash || 'ringkasan';
      location.replace(root.href);
    } catch {
      status.textContent = 'Aplikasi belum dapat dijangkau. Periksa koneksi, lalu coba lagi. Pantauan tersimpan tidak dihapus.';
      retry.disabled = false;
    }
  });
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
})();
