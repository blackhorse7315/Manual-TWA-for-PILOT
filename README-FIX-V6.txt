TRANSWISATA FLIGHT MANUALS - V6 UPLOAD BUG FIX

Fixed root cause from user screenshot: st.setMaxUploadRetryTime is not a function.
Firebase modular Storage v10 uses instance properties, not that function on the imported module.
Now sets bucket.maxUploadRetryTime=30000 and bucket.maxOperationRetryTime=15000.

This fix allows the upload task to begin; success still depends on bucket activation, permissions, billing, browser network, and Storage Rules.

DEPLOY:
1. Replace all GitHub Pages files with contents of this folder.
2. Hard refresh browser / restart PWA to load new service worker.
3. Log in to Firebase transwisata-egr as admin UID uKTUIiuS3rQcRcmFLhliufbOcds1.
4. Retry uploading a small PDF first, then test larger PDF.
5. If new error is storage/unauthorized or storage/bucket-not-found inspect Firebase Storage Rules or bucket.
Do not replace EGR Firestore/Storage rules with the standalone sample rules in this ZIP. Merge ADD-ONLY fragments with existing rules.
