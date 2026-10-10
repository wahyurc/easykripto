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

SDK Firebase App, Authentication, dan Firestore versi 13.0.0 dimuat dari CDN resmi Google. Firebase menangani verifikasi akun serta pemulihan sesi browser. Dashboard ditampilkan berdasarkan `onIdTokenChanged`, dan tombol Keluar memakai `signOut`.

Alur memakai popup agar login tidak bergantung pada penyimpanan lintas domain dari redirect di GitHub Pages. Halaman tetap menjadi login sampai Firebase mengonfirmasi sesi pengguna.

Data pantauan masih tersimpan lokal pada browser dan belum dipisahkan per akun. Login frontend tidak membatasi akses terhadap file HTML/JavaScript atau data demo publik. Backend analisis yang ditambahkan nanti perlu memverifikasi Firebase ID token untuk melindungi data akun.

## Superadmin

Hak akses menggunakan custom claims Firebase `role: "superadmin"` dan `superadmin: true`. Aplikasi membaca claims dari ID token, bukan mencocokkan email di frontend. Status tampil pada pengaturan akun. Pembacaan daftar akun dan log dilindungi Security Rules Firestore; menampilkan menu admin di browser saja tidak memberikan akses ke data.

Skrip `scripts/grant-superadmin.mjs` khusus menetapkan akun `ddr8gb@gmail.com` pada proyek `easykripto-40e96`, memeriksa akun aktif dan email terverifikasi, mempertahankan claims lain, lalu membaca ulang hasil dari Firebase.

1. Akun tujuan harus sudah masuk ke Easykripto setidaknya sekali.
2. Gunakan Application Default Credentials yang memiliki izin `firebaseauth.users.get` dan `firebaseauth.users.update`, atau simpan service account proyek pada `.secrets/firebase-admin.json` yang diabaikan Git.
3. Jalankan `npm run grant:superadmin` dari komputer pengelola. Skrip hanya boleh dijalankan di lingkungan tepercaya, bukan browser atau GitHub Pages.
4. Setelah skrip mengonfirmasi penetapan, keluar lalu masuk kembali pada akun tujuan agar mendapatkan ID token baru. Pemberian claims tidak menjadikan akun sebagai pemilik proyek Firebase atau Google Cloud.

Referensi: [custom claims Firebase](https://firebase.google.com/docs/auth/admin/custom-claims).

### Dashboard dan penyimpanan data

Alamat dashboard: https://wahyurc.github.io/easykripto/#superadmin . Menu **Superadmin** tersedia setelah login dengan akun yang memiliki kedua claims di atas.

- Empat ringkasan: akun tersinkron, kunjungan hari ini, kunjungan tujuh hari, dan akun baru tujuh hari.
- Tab Pengunjung: halaman, perangkat, browser, sumber domain, status login, dan waktu kunjungan.
- Tab Akun terdaftar: nama, email, peran, tanggal pendaftaran, dan aktivitas terakhir.
- Filter periode, pencarian pada 25 catatan yang sedang dimuat, pagination, dan tombol Perbarui data. Waktu menggunakan WITA; tujuh hari berarti hari ini dan enam hari sebelumnya.

Aktivasi pada proyek Firebase `easykripto-40e96`:

1. **Build → Firestore Database → Create database**: Standard edition, database `(default)`, lokasi `asia-southeast2` (Jakarta), Production mode. Tetap gunakan paket Spark.
2. Jalankan `npm run deploy:rules` dari komputer pengelola. Skrip menerbitkan `firestore.rules`, menyimpan cadangan aturan sebelumnya di `.secrets/rules-backups/`, serta menghentikan operasi jika aturan lama berisi pengaturan lain yang perlu digabungkan.
3. Jalankan `npm run sync:users` untuk memasukkan akun Authentication yang sudah terdaftar ke koleksi `accounts`. Tanggal pendaftaran dan aktivitas yang lebih baru dipertahankan. Tidak ada penghapusan akun.
4. Keluar dan masuk kembali sebagai superadmin, lalu buka menu **Superadmin**. Aturan baru mungkin memerlukan beberapa menit untuk tersebar.

Kredensial hanya dipakai skrip lokal. `.secrets/` diabaikan Git; jangan unggah service account ke repository atau kode browser. Service account memerlukan izin Auth untuk membaca pengguna, Firestore untuk membaca/menulis dokumen, dan Firebase Rules untuk menerbitkan aturan. Aktivasi API Firestore melalui Console memerlukan akun pengelola proyek.

Akun baru disinkronkan ketika browser mengonfirmasi sesi login. Log halaman dikirim ke koleksi `visits` saat sesi diketahui dan saat navigasi berubah, termasuk halaman login. Log mulai terkumpul setelah Firestore dan rules aktif; kunjungan sebelum itu tidak dapat dipulihkan. Kunjungan adalah pembukaan halaman, bukan jumlah orang unik. IP, clipboard, private key, dan query URL tidak dicatat.

Pengunjung boleh membuat log dengan struktur terbatas, tetapi tidak dapat membacanya. Catatan browser dapat terblokir atau dimanipulasi; log ini bukan audit server yang menjamin keaslian. Belum ada App Check atau pembatasan laju pengiriman. Perhatikan kuota Firestore jika situs ramai; hindari membuka rules menjadi publik untuk membaca data. Pembacaan dashboard dilakukan saat dibuka/diperbarui, tanpa polling terus-menerus.

Referensi: [Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions), [penerbitan rules](https://firebase.google.com/docs/rules/manage-deploy), [daftar akun Authentication](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/batchGet).

Server lokal tetap dapat digunakan untuk menyajikan file. Endpoint login Google lama di `auth-server.mjs` dan konfigurasi Render masih tersedia sebagai kode sebelumnya, tetapi tidak digunakan oleh antarmuka Firebase. Hosting Render tidak diperlukan untuk login ini; jika memakai domain hosting lain, daftarkan domain tersebut di Authorized domains Firebase.

Referensi: [login Google Firebase](https://firebase.google.com/docs/auth/web/google-signin), [persistensi sesi](https://firebase.google.com/docs/auth/web/auth-state-persistence), [login dan penyimpanan lintas domain](https://firebase.google.com/docs/auth/web/redirect-best-practices).

## Fitur

- Pilihan jaringan: Solana, Ethereum, Base, BNB Chain, dan Robinhood. Pemilih jaringan menampilkan ikon SVG lokal serta mendukung keyboard dan layar handphone.
- Robinhood mendukung penyimpanan alamat EVM. Pencarian pasar bergantung pada ketersediaan data DEX Screener; penambahan pilihan jaringan tidak berarti data GMGN atau pemantauan wallet sudah diintegrasikan.
- Pilihan jaringan tersimpan di browser; pencarian CA dan wallet mengikuti jaringan aktif.
- Wallet diidentifikasi berdasarkan jaringan dan alamat. Alamat EVM yang sama bisa disimpan pada beberapa jaringan.
- Format alamat Solana diperiksa sebagai public key Base58 32 byte; EVM sebagai 0x + 40 digit heksadesimal. Validasi format belum membuktikan bahwa alamat adalah kontrak token.
- Peta dan aktivitas memakai hasil analisis wallet pada semua jaringan yang tersedia.

- Pencarian CA di bagian teratas Ringkasan. Menempelkan satu CA memulai pencarian otomatis: format Solana dikenali langsung, sedangkan CA EVM dicari melalui API publik DEX Screener dengan kecocokan alamat persis pada jaringan yang tersedia di aplikasi.
- Jika hasil pencarian menunjukkan satu jaringan, pemilih jaringan dashboard mengikuti hasil tersebut. Jika alamat ditemukan pada beberapa jaringan, aplikasi menampilkan pilihan beserta logo. Jika data belum tersedia, pengguna dapat memilih jaringan sebagai cadangan untuk memeriksa grafik/risiko. Hasil pencarian DEX Screener terbatas pada indeks dan hasil yang dikembalikan penyedia; tidak membuktikan bahwa CA hanya ada pada jaringan yang ditemukan.
- Tombol Tempel membaca clipboard setelah diketuk. Deteksi CA otomatis hanya berjalan saat halaman aktif dan izin clipboard-read sudah diberikan.
- Clipboard tidak disimpan; hanya alamat yang dipilih untuk pencarian dikirim ke DEX Screener. Browser tanpa izin mendukung penempelan manual.

- Ringkasan, peta, pantauan, dan aktivitas.
- Peta SVG wallet–token serta transfer antarwallet, dengan filter waktu.
- Geser, cubit, tombol zoom, dan panel detail.
- Daftar transaksi sebagai alternatif peta dan navigasi keyboard.
- Tambah, cari, salin alamat, analisis, dan hapus wallet; pantauan per akun di Firebase dengan salinan lokal.
- Preferensi pemberitahuan dan pengurangan gerakan.

## Batas prototipe

## Integrasi API gratis

Pencarian CA memakai DEX Screener untuk harga/volume/likuiditas. Detail token sekarang menambahkan:

- **GeckoTerminal**: maksimal 48 candle per jam, dipilih dari pool token dengan likuiditas terbesar yang tersedia. Pool grafik bisa berbeda dari pool DEX Screener; sumbernya disebutkan pada antarmuka. Tabel OHLCV menjadi alternatif grafik.
- **GoPlus**: informasi risiko untuk Solana (Beta), Ethereum, Base, BNB, dan Robinhood. Tidak ada skor keamanan buatan; field yang tidak tersedia ditampilkan sebagai tidak tersedia. Hasil deteksi tidak menjamin keamanan token.
- **Peta holder Solana**: pemilik dari maksimal 20 akun token terbesar; saldo dijumlahkan ketika pemilik sama. Persentase terhadap supply saat ini, bukan persentase seluruh sampel. Tidak ada hubungan transfer yang dibuat dari kepemilikan saja.

Menu **Peta → Transfer wallet** menerima alamat publik Solana, Ethereum, Base, BNB Chain, atau Robinhood. Wallet tersimpan memiliki tombol **Analisis wallet** pada detailnya. Hasil berisi saldo native, peta transfer langsung, daftar transaksi, dan tautan explorer.

### Data Solana dan batas cakupan

Layanan API untuk GitHub Pages tersedia pada `https://easykripto-data.easykripto-wahyurc.workers.dev`. Analisis Solana melewati Helius; Ethereum/Base/BNB/Robinhood melewati Alchemy. Jika konfigurasi origin dikosongkan, endpoint memakai origin aplikasi untuk server lokal. GitHub Pages memerlukan origin Worker yang dikonfigurasi. Kegagalan ditampilkan tanpa mengganti hasil dengan simulasi.

Transfer wallet Solana diambil dari maksimal 8 transaksi terbaru yang menyebut alamat wallet, memeriksa instruksi utama dan internal. Transfer SPL yang hanya menyebut akun token dapat tidak terjangkau oleh pencarian alamat wallet. Titik yang pemiliknya belum diketahui tetap merupakan akun token dan diberi keterangan. Metode ini belum membentuk riwayat lengkap atau klasifikasi beli/jual.

Transfer EVM melalui Alchemy mencakup maksimal 25 masuk dan 25 keluar, kategori native/ERC-20, dengan deduplikasi. Tidak mencakup seluruh internal transfer/NFT atau keseluruhan riwayat. Ukuran lingkaran transfer mengikuti jumlah kemunculan dalam sampel, bukan nilai USD. Maksimal 12 alamat lawan ditampilkan pada peta; daftar memuat seluruh hasil.

### Mengaktifkan API dengan key

1. Buat key **Free** pada Helius dan Alchemy. Simpan `HELIUS_API_KEY` dan `ALCHEMY_API_KEY` dalam `.env` untuk server lokal, atau gunakan Workers secrets untuk Cloudflare. Jangan memasukkannya ke `data-config.js`, file repository, atau frontend. GitHub Actions Secrets terenkripsi dapat digunakan untuk otomatisasi; tidak dibaca langsung oleh GitHub Pages.
2. Server lokal `npm run dev` menyediakan `/api/analysis/wallet` dan `/api/analysis/holders`. Setelah perubahan environment, restart server lokal. Endpoint menerima Firebase ID token pengguna melalui header Bearer dan memverifikasi signature RSA, issuer, audience, expiry, auth_time, dan email terverifikasi. Pemeriksaan pencabutan sesi belum diterapkan.
3. Worker `easykripto-data` telah diterbitkan dengan key provider sebagai bindings `secret_text`. Untuk menerbitkan ulang dari komputer pengelola, jalankan `npm run deploy:api` dari root proyek. Skrip membaca token dari `CLOUDFLARE_API_TOKEN` atau file lokal `api-keys/CLOUDFLARE_API_KEY`, serta key provider dari `.env`. Token memerlukan izin Workers Scripts Write dan akses daftar akun. Jika ada beberapa akun, tentukan `CLOUDFLARE_ACCOUNT_ID` dalam environment lokal. Skrip memakai subdomain akun yang sudah ada; pada akun baru membuat `easykripto-wahyurc`. Tidak ada service account Firebase yang diperlukan oleh Worker ini.
4. `window.EASYKRIPTO_API_ORIGIN` pada `data-config.js` menunjuk origin HTTPS Worker. Jika berpindah akun/subdomain, gunakan origin yang dilaporkan skrip deployment, lalu push perubahan frontend. Ringkasan deployment disimpan lokal pada `.secrets/cloudflare-deployment.json` yang diabaikan Git.

Pembatasan layanan: cache hasil 120 detik, maksimal 4 analisis per UID/menit dan 2 pekerjaan aktif pada satu instance. Pada Cloudflare batas/cache bersifat per isolate, bukan global lintas pusat data. Endpoint tidak mengizinkan URL RPC arbitrer atau metode penandatanganan/transaksi. Hasil dan pesan error tidak menyertakan API key. Gunakan paket Free provider agar penggunaan tidak beralih menjadi overage berbayar.

API publik di browser memanfaatkan cache 120 detik dan jeda permintaan; pembatasan ini per tab, bukan global untuk semua pengunjung. Lonceng memeriksa wallet secara bergiliran setiap 65 detik saat tab terlihat. Cache 2 menit; polling bukan pemantauan 24 jam. Grafik serta risiko dapat gagal secara independen tanpa menghilangkan informasi pasar yang sudah dimuat.

Referensi: [DEX Screener](https://docs.dexscreener.com/api/reference), [GeckoTerminal](https://api.geckoterminal.com/docs/index.html), [GoPlus](https://docs.gopluslabs.io/reference/support), [Solana RPC](https://solana.com/docs/rpc/http), [Alchemy Transfers](https://www.alchemy.com/docs/reference/transfers-api-quickstart), [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

### Logo token, holder, dan jaringan aktif

- Hasil pencarian token menampilkan logo dari DEX Screener; metadata token pada respons pool GeckoTerminal menjadi sumber cadangan. Jika tidak ada gambar atau gagal dimuat, tampilkan inisial token. URL gambar wajib HTTPS dan tidak mengandung kredensial. Kartu token pantauan juga menampilkan logo yang tersedia dari pasangan pasar.
- Detail token memuat daftar holder otomatis. Solana: pemilik akun token pada sampel RPC dengan saldo positif. Jika pemindaian akun terbesar dibatasi provider, daftar akun token GoPlus menjadi kandidat; pemilik, mint, dan saldo diverifikasi kembali melalui RPC. Daftar ini tidak mencakup seluruh holder.
- Ethereum, Base, BNB Chain, dan Robinhood: maksimal 10 holder dari field holders pada GoPlus Token Security, dengan saldo, persentase supply, dan label kontrak/tag jika tersedia. Saldo EVM merupakan laporan GoPlus, bukan pembacaan balanceOf real time. LP holders tidak dicampur dengan holder token.
- Setiap holder mempunyai tombol **Tambah ke pantauan**, **Salin**, dan **Explorer**. Penambahan langsung menyimpan alamat pada jaringan holder tanpa memindahkan pengguna dari detail token. Tombol menjadi **Sudah dipantau** untuk alamat yang tersimpan; batas 20 wallet tetap berlaku. Daftar holder pada halaman Peta memakai tombol yang sama.
- Pemilih jaringan di sebelah avatar membaca GET /api/analysis/capabilities dan menampilkan jaringan yang didukung implementasi serta konfigurasi layanan. API ini tidak membutuhkan login dan hanya mengembalikan metadata dukungan, tanpa key. Jika layanan tidak dapat dimuat, daftar dukungan aplikasi ditampilkan dengan keterangan. Daftar pantauan tidak dihapus ketika jaringan tidak tersedia.

### Dashboard dan pantauan akun

- Ringkasan, catatan pola, daftar aktivitas, dan peta gabungan menggunakan hasil analisis yang sama. Catatan tidak diberi harga USD atau label beli/jual tanpa bukti. Filter Masuk/Keluar mengikuti arah transfer terhadap alamat yang dipantau atau dianalisis.
- Peta gabungan membatasi tampilan ke 24 titik paling sering muncul; daftar memuat seluruh catatan yang dimuat. Peta alamat membatasi 12 lawan transfer, atau 20 holder Solana. Zoom/geser/cubit dan detail alamat tersedia pada keduanya.
- Cari CA, lalu ketuk **Pantau token** untuk menyimpan metadata token dan membuka kembali harga, grafik, serta risiko. Harga kartu memakai pasangan DEX Screener yang likuiditasnya paling besar pada hasil pencarian, bukan agregat seluruh pasar.
- Maksimal 20 wallet dan 20 token per akun pada antarmuka untuk menjaga kuota gratis. Wallet dan token disimpan pada subkoleksi accounts/{uid}/wallets dan accounts/{uid}/tokens. Aturan mengizinkan pemilik terverifikasi saja, termasuk untuk akun superadmin; peran superadmin tidak memberi akses ke pantauan akun lain.
- Salinan lokal menggunakan Firebase UID. **Impor pantauan lama perangkat** merupakan tindakan eksplisit untuk memindahkan daftar lokal sebelum fitur akun diterapkan. Alamat tidak otomatis disalin ke akun lain.
- **Perbarui data** memuat harga token dan sampel wallet pada jaringan terpilih. Permintaan wallet antre agar tidak melebihi 4 analisis per menit. **Perbarui** pada kartu wallet mengambil data alamat tersebut; cache tetap berlaku.
- Lonceng memeriksa sampel baru selama aplikasi terbuka dan tab terlihat, satu wallet per giliran. Notifikasi dalam aplikasi selalu tersedia; notifikasi browser memerlukan izin dan dukungan browser. Snapshot pertama menjadi pembanding dan tidak memicu notifikasi transaksi lama. Pergantian akun membersihkan hasil analisis dari memori.
- Sinkronisasi cloud yang gagal ditampilkan dengan jelas; gunakan **Sinkronkan** untuk mengulangi perubahan lokal. Sinkronisasi perubahan pantauan pada perangkat lain dimuat saat masuk/muat ulang halaman; bukan kolaborasi waktu nyata.
- Transfer SPL Solana dan holder mempunyai cakupan terbatas seperti dijelaskan di atas. Beli/jual, analisis pemilik bersama, push ketika aplikasi ditutup, serta seluruh riwayat belum tersedia dan tidak disimulasikan.

Font Google Fonts bersifat opsional dengan fallback sistem. Ikon dan graf tersedia lokal. Private key dan seed phrase wallet tidak diperlukan.
