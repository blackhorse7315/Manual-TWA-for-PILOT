const CACHE='twa-hybrid-manuals-shell-v5';
const SHELL=['./','./index.html','./app.js','./config.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('twa-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin)return; // Never cache Firebase or confidential PDF response URLs
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy))}return r}).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{if(res.ok&&SHELL.some(p=>u.pathname.endsWith(p.slice(1)))){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return res})));
});

VERSI ADMIN UPLOAD V2
- Tombol Upload PDF akan muncul bila UID login sama dengan 1Z9zzNkV2mZW2IS8rakS8UBSkky1, meskipun dokumen users/{uid} belum tersedia.
- Publish juga aturan Firestore dan Storage untuk memberikan hak tulis sesuai UID; gabungkan dengan aturan project yang sudah ada, jangan replace seluruh rules.
- Perhatian: wildcard Firestore publik sementara sampai 5 Des 2026 membuat semua dokumen bisa dibaca dan ditulis publik; wajib diamankan sebelum digunakan operasional.
- Setelah deploy, lakukan refresh paksa agar service worker versi baru terpasang.

VERSI UPLOAD PROGRESS
- Admin Upload PDF menggunakan Firebase Storage resumable upload dengan indikator persentase, ukuran terkirim, dan laju transfer.
- Tombol Batalkan Upload tersedia ketika proses berlangsung.
- Pemeriksaan SHA-256 dilakukan sebelum upload (terutama PDF besar dapat memerlukan waktu).
- Kecepatan bergantung pada jaringan, ukuran PDF, dan konfigurasi Firebase Storage.
- Jangan keluar dari halaman sampai status upload dan publikasi katalog selesai.
- Jika muncul storage/unauthorized atau error CORS, periksa rules dan bucket Firebase; ini bukan masalah kecepatan.
- Pastikan Storage Rules dan Firestore Rules diamankan sebelum dipakai operasional.
