TRANSWISATA FLIGHT MANUALS V7 – STORAGE CONNECTION TEST

This version is configured for Firebase project transwisata-egr and UID uKTUIiuS3rQcRcmFLhliufbOcds1.

1. Deploy ALL files in this ZIP to your existing GitHub Pages repository.
2. Hard refresh / close and reopen PWA; avoid Clear Site Data (it can delete offline PDFs).
3. Log in as the intended admin. In Admin → Upload, click Tes Koneksi Storage.
4. Read HTTP status: 404 for a deliberately non-existent PDF usually means the Storage endpoint responded and is reachable; 401/403 signals auth/permission/billing; 400 signals invalid endpoint; timeout/network error signals connectivity or bucket/service issue. The test does NOT prove write permissions.
5. Open https://console.firebase.google.com/project/transwisata-egr/storage and check Files: bucket name must EXACTLY match config.js. The Blaze label alone does not create a bucket; if Storage says Get started, complete setup first.
6. In Storage → Rules, merge storage-flight-manuals-ADD-ONLY.rules with EXISTING EGR rules, preserving them. Firestore rules do NOT govern PDF uploads.
7. Retry uploading one small PDF. Confirm both Storage/manuals/{id}.pdf and Firestore/manuals/{id} exist.
8. Check browser Developer Tools → Network if timeout persists. Do not share ID tokens, password, private documents or full authorization headers.

IMPORTANT: Actual writes could not be tested without authorized direct access to Firebase project. No claim of successful cloud upload is made.
