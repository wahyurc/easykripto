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

### Daftar token di bawah pencarian

- **Baru**: token dasar dari 20 pool baru pada jaringan terpilih dari GeckoTerminal, dengan alamat token unik dan urutan waktu pool terbaru. Pool baru tidak membuktikan token baru dibuat.
- **Trending**: token dasar dari 20 pool trending GeckoTerminal; token yang berulang digabung, memakai data pasangan paling likuid pada hasil. Urutan mengikuti posisi pool pada hasil penyedia.
- **Holder terbanyak**: maksimal 20 kandidat gabungan trending dan baru, diperiksa satu per satu lewat API publik GoPlus tanpa key/deposit. Urutan memakai `holder_count`, bukan jumlah entri holder sampel. Peringkat mencakup kandidat yang berhasil diperiksa, bukan seluruh pasar. Progres dan data yang tidak tersedia ditampilkan; Solana memakai API Beta. Tidak menggunakan peringkat komunitas atau badge whale buatan.
- Ketuk baris untuk membuka detail token, grafik, risiko, daftar holder, dan tombol pantauan yang sudah tersedia. Logo token memakai metadata GeckoTerminal, dengan inisial jika gambar tidak tersedia. Logo jaringan berada di sudut gambar token.
- Tampilan berbahasa Indonesia mengikuti daftar mobile: tiga tab horizontal, panel penjelasan yang dapat ditutup, rank, logo, simbol, MC/FDV, harga USD, perubahan 24 jam, dan jumlah holder pada tab terkait. Sepuluh baris pertama ditampilkan, sisanya melalui **Lihat lebih banyak**. MC yang belum tersedia memakai FDV dengan label berbeda.
- Daftar pasar memakai cache 5 menit, hitungan holder 10 menit, dan antrean API publik yang sama dengan grafik/risiko. Refresh tetap menghormati cache provider 2 menit. Tidak ada polling pasar otomatis; pemindaian dijeda saat tab tersembunyi, membuka dialog, keluar, atau pindah halaman/jaringan. Sumber yang tidak mendukung suatu jaringan menampilkan status data tidak tersedia.
- Latar utama, login, navigasi, dashboard, dan superadmin hitam `#000000`, dengan permukaan gelap, batas abu-abu, teks putih, aksen teal, serta warna perubahan positif/negatif.

### Detail token dan jaringan

- Tombol **Detail Token** memakai logo DEX Screener. Logo DEX Screener dan GMGN disimpan sebagai aset PNG lokal dari cache favicon domain sehingga tidak bergantung pada pemuatan gambar eksternal saat membuka detail.

- Tombol **Trade Token ini** dengan logo GMGN pada detail token membuka halaman GMGN.ai untuk CA dan jaringan yang sama (Solana, Ethereum, Base, BNB, Robinhood), dalam tab baru. Tersedia juga ketika pasangan DEX Screener belum ditemukan. Tautan hanya membuka halaman trading; tidak mengirim transaksi dari Easykripto.

- Hasil pencarian token menampilkan logo dari DEX Screener; metadata token pada respons pool GeckoTerminal menjadi sumber cadangan. Jika tidak ada gambar atau gagal dimuat, tampilkan inisial token. URL gambar wajib HTTPS dan tidak mengandung kredensial. Kartu token pantauan juga menampilkan logo yang tersedia dari pasangan pasar.
- Detail token memuat daftar holder otomatis. Solana: pemilik akun token pada sampel RPC dengan saldo positif. Jika pemindaian akun terbesar dibatasi provider, daftar akun token GoPlus menjadi kandidat; pemilik, mint, dan saldo diverifikasi kembali melalui RPC. Daftar ini tidak mencakup seluruh holder.
- Ethereum, Base, BNB Chain, dan Robinhood: maksimal 10 holder dari field holders pada GoPlus Token Security, dengan saldo, persentase supply, dan label kontrak/tag jika tersedia. Saldo EVM merupakan laporan GoPlus, bukan pembacaan balanceOf real time. LP holders tidak dicampur dengan holder token.
- Setiap holder mempunyai tombol **Tambah ke pantauan**, **Salin**, dan **Explorer**. Penambahan langsung menyimpan alamat pada jaringan holder tanpa memindahkan pengguna dari detail token. Tombol menjadi **Sudah dipantau** untuk alamat yang tersimpan; batas 20 wallet berlaku untuk akun biasa; superadmin tanpa batas jumlah pantauan. Daftar holder pada halaman Peta memakai tombol yang sama.
- Pemilih jaringan di sebelah avatar membaca GET /api/analysis/capabilities dan menampilkan jaringan yang didukung implementasi serta konfigurasi layanan. API ini tidak membutuhkan login dan hanya mengembalikan metadata dukungan, tanpa key. Jika layanan tidak dapat dimuat, daftar dukungan aplikasi ditampilkan dengan keterangan. Daftar pantauan tidak dihapus ketika jaringan tidak tersedia.

### Dashboard dan pantauan akun

- Ringkasan, catatan pola, daftar aktivitas, dan peta gabungan menggunakan hasil analisis yang sama. Catatan tidak diberi harga USD atau label beli/jual tanpa bukti. Filter Masuk/Keluar mengikuti arah transfer terhadap alamat yang dipantau atau dianalisis.
- Peta gabungan membatasi tampilan ke 24 titik paling sering muncul; daftar memuat seluruh catatan yang dimuat. Peta alamat membatasi 12 lawan transfer, atau 20 holder Solana. Zoom/geser/cubit dan detail alamat tersedia pada keduanya.
- Cari CA, lalu ketuk **Pantau token** untuk menyimpan metadata token dan membuka kembali harga, grafik, serta risiko. Harga kartu memakai pasangan DEX Screener yang likuiditasnya paling besar pada hasil pencarian, bukan agregat seluruh pasar.
- Akun biasa maksimal 20 wallet dan 20 token pada antarmuka untuk menjaga kuota gratis. Superadmin tidak memiliki batas jumlah wallet/token yang ditambahkan, dimuat ulang, atau diimpor; status superadmin mengikuti custom claims Firebase yang diverifikasi saat login. Sinkronisasi perubahan dibagi dalam batch maksimal 400 operasi. Batas laju API, cache hasil analisis, dan ukuran tampilan peta tetap berlaku. Wallet dan token disimpan pada subkoleksi accounts/{uid}/wallets dan accounts/{uid}/tokens. Aturan mengizinkan pemilik terverifikasi saja, termasuk untuk akun superadmin; peran superadmin tidak memberi akses ke pantauan akun lain.
- Salinan lokal menggunakan Firebase UID. **Impor pantauan lama perangkat** merupakan tindakan eksplisit untuk memindahkan daftar lokal sebelum fitur akun diterapkan. Alamat tidak otomatis disalin ke akun lain.
- **Perbarui data** memuat harga token dan sampel wallet pada jaringan terpilih. Permintaan wallet antre agar tidak melebihi 4 analisis per menit. **Perbarui** pada kartu wallet mengambil data alamat tersebut; cache tetap berlaku.
- Lonceng memeriksa sampel baru selama aplikasi terbuka dan tab terlihat, satu wallet per giliran. Notifikasi dalam aplikasi selalu tersedia; notifikasi browser memerlukan izin dan dukungan browser. Snapshot pertama menjadi pembanding dan tidak memicu notifikasi transaksi lama. Pergantian akun membersihkan hasil analisis dari memori.
- Sinkronisasi cloud yang gagal ditampilkan dengan jelas; gunakan **Sinkronkan** untuk mengulangi perubahan lokal. Sinkronisasi perubahan pantauan pada perangkat lain dimuat saat masuk/muat ulang halaman; bukan kolaborasi waktu nyata.
- Transfer SPL Solana dan holder mempunyai cakupan terbatas seperti dijelaskan di atas. Beli/jual, analisis pemilik bersama, push ketika aplikasi ditutup, serta seluruh riwayat belum tersedia dan tidak disimulasikan.

Font Google Fonts bersifat opsional dengan fallback sistem. Ikon dan graf tersedia lokal. Private key dan seed phrase wallet tidak diperlukan.

## Pusat notifikasi

- Lonceng di header menampilkan jumlah belum dibaca. Panel desktop dan sheet mobile menyediakan filter Semua, Belum dibaca, Aktivitas, dan Sistem; waktu WITA, kategori, keterangan kejadian, dan tindakan menuju wallet/token atau sinkronisasi ulang.
- Sumber kejadian nyata: penambahan wallet/token, perubahan lonceng, transfer baru pada sampel, analisis manual, kegagalan/pemulihan analisis, koneksi, dan sinkronisasi pantauan. Snapshot pertama tidak menghasilkan notifikasi transaksi lama. Tidak menganggap transfer sebagai beli/jual.
- Notifikasi aktivitas, pantauan, sistem, dan khusus superadmin API dapat diaktifkan/dimatikan melalui preferensi. Notifikasi browser memerlukan tindakan dan izin eksplisit; diaktifkan per akun/perangkat, hanya ketika aplikasi berjalan dan jendela tidak mendapat fokus. Dukungan mobile bergantung browser; belum memakai service worker untuk push latar belakang.
- Riwayat disimpan dalam localStorage berdasarkan Firebase UID: maksimal 100 notifikasi selama 30 hari, tidak disinkronkan antarperangkat. Pergantian akun menutup panel, menghapus pesan sementara, dan membersihkan notifikasi browser yang dibuat sesi sebelumnya. Duplikasi peringatan dikurangi dengan kunci kejadian dan cooldown.
- Tersedia tandai dibaca/belum dibaca, tandai semua, hapus yang dibaca dengan Urungkan. Toast menyediakan ikon, judul, penjelasan, tindakan, dan tombol tutup; timer dijeda saat pointer/fokus berada pada toast. Membuka pusat notifikasi tidak otomatis menandai semuanya dibaca.

## Pemantauan API khusus superadmin

- Panel **Superadmin → Penggunaan API** menyediakan angka permintaan provider, rasio respons berhasil, HTTP 429, rata-rata durasi, grafik bertumpuk per jam/harian untuk 24 jam atau 7 hari, chart distribusi provider, tabel angka alternatif grafik, kartu status, filter log, pagination 50 baris, dan ekspor CSV dari baris yang sudah dimuat.
- Log disimpan dalam Cloudflare D1 gratis `easykripto-api-monitor` melalui binding `API_LOGS`. Schema ada di `api-monitor-schema.sql`. Deployment API membuat/memakai kembali database bernama tersebut, memasang schema tambahan dengan IF NOT EXISTS, lalu memasang binding dan cron pembersihan tiap jam. Token pengelola memerlukan D1 Edit selain Workers Scripts Write dan akses daftar akun. Tidak ada token Cloudflare/service account Firebase dalam frontend atau binding Worker.
- Log server mencatat panggilan RPC aktual Helius, Alchemy, RPC Solana, serta GoPlus cadangan holder. Permintaan Worker dicatat terpisah, termasuk cache. Semua ini dicatat oleh server, bukan laporan browser. Setiap panggilan JSON-RPC dapat menghasilkan satu log; satu analisis wallet dapat memakai beberapa panggilan.
- API publik DEX Screener, GeckoTerminal, GoPlus di browser mengirim metadata ringkas secara batch melalui endpoint terautentikasi. Data ini ditandai **Laporan browser**, bisa tidak lengkap atau tidak tepercaya sebagai metrik tagihan. Tidak mencatat URL, API key, CA, alamat wallet, isi respons, email, atau UID pengguna. Permintaan pemantauan itu sendiri dan Firebase tidak masuk hitungan provider.
- GET `/api/monitor/summary`, GET `/api/monitor/logs`, POST `/api/monitor/budgets` memerlukan Firebase ID token dengan kedua custom claims `superadmin=true` dan `role=superadmin`, diverifikasi signature/expiry di server. Pengguna biasa hanya boleh POST `/api/monitor/events` dengan payload provider/metode yang diizinkan, maksimal 10 entri dan 10 batch per UID/menit. Kontrol CORS membatasi origin aplikasi. Hak superadmin pada UI saja tidak membuka akses server.
- Grafik dan log menampilkan aktivitas sejak pemasangan; tidak ada data contoh. Tidak mengimpor histori tagihan sebelum pemasangan. Log terlihat untuk 7 hari, dengan pembersihan baris lama maksimal 2.000 per giliran setiap jam; statistik per jam dihapus saat lebih dari 7 hari. Retry batch browser tidak menggandakan statistik untuk ID yang sama. Kegagalan pencatatan tidak menghentikan analisis utama; sebagian data dapat tidak tercatat.
- Status **Respons normal** hanya berarti tidak ada kegagalan teramati dalam 5 menit terakhir. **Sedang dibatasi** berarti HTTP 429 teramati; pada Worker dapat berasal dari batas 4 analisis/menit atau antrean. **Respons perlu diperiksa** menandakan kegagalan HTTP/JSON-RPC, termasuk penolakan dengan HTTP 200. Tanpa permintaan terbaru, status menampilkan ketiadaan respons terbaru; tidak menyimpulkan provider sehat tanpa data.
- Superadmin dapat menetapkan batas pemantauan jumlah permintaan per hari dan persentase peringatan 50–99%, default 80%. Hari memakai WITA. Ambang dan hitungan disimpan terpusat di D1. Batas kosong dinonaktifkan; ambang tidak mengubah paket, tidak memblokir permintaan, dan bukan kuota resmi provider. Peringatan mendekati/tercapai serta pembatasan/kegagalan masuk pusat notifikasi superadmin saat aplikasi aktif.
- Panel diperbarui setiap 60 detik selama superadmin membuka tab aktif. Cache statistik 15 detik per isolate. Kuota credit/CU, pemakaian di luar aplikasi, sisa tagihan akun provider, serta total pemakaian akun Cloudflare tidak terhubung dan tidak ditampilkan sebagai angka perkiraan. Dashboard provider menjadi referensi pemakaian resmi. Fitur ini belum memberi push ketika aplikasi ditutup.

Referensi log: [Cloudflare D1 bindings](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). Paket D1 Free membatasi pembacaan/penulisan harian; log dan polling juga memakai kuota tersebut.
