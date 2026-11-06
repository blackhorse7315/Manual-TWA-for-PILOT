TRANSWISATA FLIGHT MANUALS V10 – FAST PREVIEW FIX

PERUBAHAN:
1. Preview cloud membuka PDF lewat Firebase Storage media URL, sehingga browser dapat mulai menampilkan PDF asli lebih cepat tanpa menunggu getBlob() SDK.
2. Pencarian interaktif berjalan setelah download PDF melalui fetch selesai. Jika fetch diblokir CORS, PDF asli tetap dapat dibaca dan muncul diagnosis yang jelas.
3. Make Offline dan Unduh Semua memakai fetch media URL, memvalidasi header %PDF-, ukuran dan SHA-256 (jika tersedia), lalu menyimpan di IndexedDB.
4. PDF yang sudah offline tetap prioritas, tanpa mengakses Storage.
5. Firebase project transwisata-egr, admin UID dan fitur katalog publik tetap dipertahankan.

PENTING: Konfigurasi CORS pada bucket dapat tetap diperlukan agar browser mengizinkan fetch PDF untuk pencarian interaktif/Make Offline. Ini konfigurasi bucket, BUKAN Firestore Rules atau Firebase Storage Rules.
Contoh cors.json ada dalam ZIP; gunakan origin GitHub Pages persis, bukan placeholder. Dengan gcloud CLI autentikasi admin Cloud Storage:
  gcloud storage buckets update gs://transwisata-egr.firebasestorage.app --cors-file=cors.json
Verifikasi:
  gcloud storage buckets describe gs://transwisata-egr.firebasestorage.app --format="default(cors_config)"
CORS hanya mengatur izin browser, bukan pemberian otorisasi; aturan baca publik V8 tetap menentukan siapa boleh mengakses PDF.

DEPLOY:
- Upload seluruh file ZIP terbaru ke GitHub Pages; jangan hapus IndexedDB/clear-site-data agar PDF offline lama terjaga.
- Refresh saat online. Uji satu PDF kecil, lihat apakah preview asli tampil cepat, cari teks, lalu Make Offline.
- Uji Airplane Mode dan cek kembali halaman, grafik, revisi, dan checksum.
- Penyimpanan offline bergantung pada kuota/eviction browser, tidak menggantikan prosedur EFB dan salinan approved.

Catatan: Integrasi Firebase live dan browser iPhone tidak dapat diuji dari lingkungan pembuatan ini. Jangan berasumsi pencarian berfungsi offline sebelum diuji pada tiap perangkat.
