TRANSWISATA FLIGHT MANUALS V14 — SMART INSTALL

- Tombol Install App langsung memanggil prompt instalasi PWA di Chrome/Edge ketika tersedia.
- Event beforeinstallprompt direkam sejak awal, tidak menunggu Firebase/IndexedDB.
- Tombol Install App disembunyikan saat aplikasi berjalan dalam mode standalone / installed.
- Setelah appinstalled, status berubah dan tombol disembunyikan.
- Safari iPhone/iPad tidak menyediakan instalasi otomatis dari script. Ikuti Share → Add to Home Screen.
- Jika browser belum menawarkan prompt, tombol menjelaskan langkah instalasi manual.
- Instalasi diam-diam tanpa persetujuan pengguna tidak diizinkan oleh browser.
- Firebase, Storage Rules, PDF viewer, fullscreen, dan salinan offline tidak diubah.
- Deploy seluruh file ke GitHub Pages dan refresh pada mode online. Jangan clear site data agar PDF offline tidak hilang.
