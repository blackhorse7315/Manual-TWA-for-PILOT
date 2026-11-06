TRANSWISATA HYBRID ONLINE–OFFLINE FLIGHT MANUALS
================================================

ISI FILE:
index.html, app.js, config.js, sw.js, manifest.webmanifest, icon-192.png, icon-512.png, firestore.rules, storage.rules, cors.json.

KEMAMPUAN:
- Admin upload satu kali ke Firebase Storage dan katalog Firestore.
- Pilot login, melihat katalog, mengunduh satu per satu atau seluruh PDF.
- PDF yang telah diunduh tersimpan dalam IndexedDB perangkat, dapat dibaca saat offline.
- Service Worker menyimpan kerangka aplikasi untuk pembukaan ulang saat offline.
- Katalog revisi, effective date, status dokumen offline, Emergency Checklist cepat.
- SHA-256 checksum tiap download agar file cocok dengan unggahan.

SETUP FIREBASE:
1. Firebase Web App sudah diisi dalam config.js untuk project cuti-apps-twa.
2. Pastikan Firebase Console project cuti-apps-twa memiliki Storage dan Firestore siap.
   apiKey pada konfigurasi Firebase adalah public identifier, BUKAN server admin key.
3. Authentication > Sign-in method: aktifkan Email/Password.
4. Authentication > Users: buat akun admin & pilot, masing-masing akun.
5. Firestore Database: buat database. Di Rules, gabungkan firestore.rules dengan
   aturan yang sudah ada (jangan menimpa rules project lain tanpa menilai dampaknya).
6. Storage: buat default bucket yang dapat diakses aplikasi. Di Rules, gabungkan
   storage.rules dengan aturan lain bila bucket dipakai aplikasi lain.
   Catatan: penggunaan Cloud Storage dapat membutuhkan Firebase Blaze/billing.
7. Di Firestore Console (project cuti-apps-twa), buat document users/<UID_ADMIN> dengan field role (string)
   bernilai "admin". UID diperoleh dari Authentication > Users.
   JANGAN buat menu publik yang dapat mengubah role.
8. Di Firebase Authentication > Settings > Authorized domains, tambahkan domain
   GitHub Pages tempat aplikasi Anda diterbitkan jika diperlukan.
9. Untuk CORS pada getBlob() di browser, sesuaikan origin cors.json dengan
   domain hosting. Gunakan Google Cloud CLI, contoh:
      gcloud storage buckets update gs://YOUR_BUCKET --cors-file=cors.json
   Bila getBlob gagal dengan CORS, periksa konfigurasi ini dan nama bucket.
10. Upload seluruh file HTML/JS/icon/manifest/SW/config ke GitHub Pages dengan
    HTTPS. Buka situs saat online, login Admin, terbitkan dokumen.
11. Pilot buka URL yang sama > login > Unduh Semua ke Offline > install PWA
    melalui Home Screen > uji airplane mode satu per satu.

PENTING:
- Membagikan link TIDAK otomatis menyimpan PDF ke perangkat pilot. Pilot harus
  login saat online lalu mengunduh salinan pertama kali.
- Akun login pilot diperlukan untuk mengakses katalog/cloud saat online.
  PDF offline tersimpan di perangkat dan tetap dapat dibaca setelah logout.
  Gunakan device passcode dan kebijakan EFB/document control perusahaan.
- Pergantian revisi: admin terbitkan file baru, lalu tarik dokumen lama dari
  katalog. Salinan versi lama di perangkat pilot TIDAK otomatis terhapus.
  Admin harus melakukan notifikasi dan pilot wajib memeriksa revisi/current.
- Penghapusan data website/PWA/IndexedDB dapat menghilangkan semua PDF offline.
- Tidak ada jaminan penyimpanan offline permanen (terutama iOS). UJI SEBELUM FLIGHT.
- Jika PDF di iPhone tidak tampil lewat iframe, gunakan Buka PDF / Simpan PDF.
- Manual hanya viewer pendukung, tidak menggantikan approved manuals atau
  persetujuan/operational EFB policy yang berlaku.
- Penarikan dari katalog menyembunyikan manual lama saat online, tetapi salinan
  lama disimpan sebagai arsip lokal sampai pilot menghapusnya sendiri.
- rules merupakan contoh untuk koleksi users dan manuals; evaluasi terhadap
  rules, auth claims, retensi, backup, dan audit organisasi sebelum produksi.
- Jangan membuat aturan Firestore/Storage public read/write hanya demi kemudahan.

Dibuat untuk armada: PK-TWV, PK-TWZ, PK-TWY, PK-TWX, PK-TWW, VP-CGO.

PENTING UNTUK PROJECT cuti-apps-twa YANG DIPAKAI BERSAMA:
- Jangan langsung PUBLISH file firestore.rules atau storage.rules sebagai pengganti aturan lama; gabungkan match /manuals dan role users secara hati-hati dengan existing rules.
- Aplikasi lain dalam project dapat terganggu jika aturan /users atau rules seluruh project ditimpa.
- Firebase config sudah diisi tetapi BELUM membuktikan layanan diaktifkan atau rules terpasang.
- Logo aplikasi sudah diganti mengikuti rancangan Transwisata Flight Manuals.
