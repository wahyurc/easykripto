# Easykripto frontend

Antarmuka analisis wallet berbahasa Indonesia yang mengutamakan handphone.

Pasang dependensi dengan `npm install`, jalankan `npm run dev`, lalu buka http://localhost:4173.

## GitHub Pages dan login Google melalui Firebase

Aplikasi publik: https://wahyurc.github.io/easykripto/

1. Gunakan proyek Firebase `easykripto-40e96` pada paket Spark.
2. Aktifkan **Authentication → Sign-in method → Google**, pilih email dukungan, lalu simpan.
3. Di **Authentication → Settings → Authorized domains**, daftarkan `wahyurc.github.io` dan `localhost`.
4. Konfigurasi Web Firebase berada pada `auth.js`. Konfigurasi ini bersifat publik; jangan menambahkan service account atau client secret.
5. Buka aplikasi dan ketuk **Masuk dengan Google**. Izinkan popup untuk situs jika browser memblokir jendela Google.

SDK Firebase App dan Authentication versi 13.0.0 dimuat dari CDN resmi Google. Firebase menangani verifikasi akun serta pemulihan sesi browser. Dashboard ditampilkan berdasarkan `onAuthStateChanged`, dan tombol Keluar memakai `signOut`.

Alur memakai popup agar login tidak bergantung pada penyimpanan lintas domain dari redirect di GitHub Pages. Halaman tetap menjadi login sampai Firebase mengonfirmasi sesi pengguna.

Data pantauan masih tersimpan lokal pada browser dan belum dipisahkan per akun. Login frontend tidak membatasi akses terhadap file HTML/JavaScript atau data demo publik. Backend analisis yang ditambahkan nanti perlu memverifikasi Firebase ID token untuk melindungi data akun.

Server lokal tetap dapat digunakan untuk menyajikan file. Endpoint login Google lama di `auth-server.mjs` dan konfigurasi Render masih tersedia sebagai kode sebelumnya, tetapi tidak digunakan oleh antarmuka Firebase. Hosting Render tidak diperlukan untuk login ini; jika memakai domain hosting lain, daftarkan domain tersebut di Authorized domains Firebase.

Referensi: [login Google Firebase](https://firebase.google.com/docs/auth/web/google-signin), [persistensi sesi](https://firebase.google.com/docs/auth/web/auth-state-persistence), [login dan penyimpanan lintas domain](https://firebase.google.com/docs/auth/web/redirect-best-practices).

## Fitur

- Pilihan jaringan: Solana, Ethereum, Base, BNB Chain, dan Robinhood. Pemilih jaringan menampilkan ikon SVG lokal serta mendukung keyboard dan layar handphone.
- Robinhood mendukung penyimpanan alamat EVM. Pencarian pasar bergantung pada ketersediaan data DEX Screener; penambahan pilihan jaringan tidak berarti data GMGN atau pemantauan wallet sudah diintegrasikan.
- Pilihan jaringan tersimpan di browser; pencarian CA dan wallet mengikuti jaringan aktif.
- Wallet diidentifikasi berdasarkan jaringan dan alamat. Alamat EVM yang sama bisa disimpan pada beberapa jaringan.
- Format alamat Solana diperiksa sebagai public key Base58 32 byte; EVM sebagai 0x + 40 digit heksadesimal. Validasi format belum membuktikan bahwa alamat adalah kontrak token.
- Peta serta aktivitas simulasi hanya tersedia di Solana. Jaringan lain menampilkan status belum memiliki data pemantauan.

- Pencarian CA Solana di bagian teratas Ringkasan; data pasar dari API publik DEX Screener setelah pengguna mencari.
- Tombol Tempel membaca clipboard setelah diketuk. Deteksi CA otomatis hanya berjalan saat halaman aktif dan izin clipboard-read sudah diberikan.
- Clipboard tidak disimpan; hanya alamat yang dipilih untuk pencarian dikirim ke DEX Screener. Browser tanpa izin mendukung penempelan manual.

- Ringkasan, peta, pantauan, dan aktivitas.
- Peta SVG wallet–token serta transfer antarwallet, dengan filter waktu.
- Geser, cubit, tombol zoom, dan panel detail.
- Daftar transaksi sebagai alternatif peta dan navigasi keyboard.
- Tambah, cari, salin alamat, dan hapus wallet; penyimpanan lokal browser.
- Preferensi pemberitahuan dan pengurangan gerakan.

## Batas prototipe

Semua token, wallet bawaan, nilai, serta waktu merupakan simulasi. Ukuran lingkaran ditentukan untuk tata letak.
Wallet tambahan tidak masuk ke peta karena belum memiliki data transaksi. Validasi alamat memeriksa format sesuai jaringan, bukan keberadaan akun atau kontrak di blockchain.
Pencarian CA mengambil data pasar DEX Screener. Peta, kartu ringkasan, dan aktivitas bawaan tetap simulasi. Belum ada notifikasi push, sinkronisasi saldo, atau pemantauan transaksi blockchain.
Alamat wallet disimpan pada perangkat ini. Private key dan seed phrase tidak diperlukan.

Font Google Fonts bersifat opsional dan memiliki fallback font sistem. Ikon dan graf tersedia lokal.

Tahap berikutnya: normalisasi transaksi buy/sell/transfer di backend, lengkapi saldo awal dan timestamp, lalu ganti fixture pada app.js dengan API gratis sesuai batas layanan.
