# Easykripto frontend

Antarmuka analisis wallet berbahasa Indonesia yang mengutamakan handphone.

Pasang dependensi dengan `npm install`, jalankan `npm run dev`, lalu buka http://localhost:4173.

## Login Google

1. Buat OAuth Client ID bertipe Web application di Google Cloud dan siapkan consent screen.
2. Tambahkan `http://localhost:4173` pada Authorized JavaScript origins.
3. Salin `.env.example` menjadi `.env`, isi `GOOGLE_CLIENT_ID`, lalu mulai ulang server.
4. Untuk produksi, gunakan origin HTTPS yang sesuai pada Google Cloud dan `APP_ORIGIN`.

Client secret tidak diperlukan. ID token diverifikasi di server menggunakan `google-auth-library`, termasuk audience, issuer, masa berlaku, dan nonce sesi login.
Sesi memakai cookie HttpOnly. Penyimpanan sesi masih di memori sehingga restart server mengharuskan login ulang; ganti dengan penyimpanan sesi bersama untuk deployment produksi.
Alamat wallet tetap tersimpan lokal pada browser, belum dipisahkan menjadi data akun di backend.
Halaman login menjadi tampilan awal; dashboard muncul setelah sesi Google diverifikasi.

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
