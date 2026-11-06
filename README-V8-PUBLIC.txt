TRANSWISATA FLIGHT MANUALS V8 — PUBLIC CATALOG, OFFLINE PDF

WHAT CHANGED
- Opening app online shows published manuals to EVERY visitor without login.
- Firebase Firestore realtime listener updates catalog when Admin publishes / withdraws.
- Users download PDF to IndexedDB; offline reading still requires downloading each PDF on each device.
- Admin login is still mandatory for upload and document withdrawal.

DEPLOY
1. Replace ALL previous Github Pages files with the content of this ZIP.
2. Firestore Database > Rules: merge/publish firestore.rules (existing EGR paths preserved).
3. Storage > Rules: merge/publish storage.rules to allow get PDF without login, preserving any other paths in existing Storage Rules.
4. Reopen app ONLINE, hard reload and/or close/reopen installed PWA. Check Cloud total and Download.
5. Test with a NEW INCOGNITO window (not logged in). Documents should list and PDF downloads should succeed.
6. Turn on airplane mode AFTER download and confirm PDF opens from the home-screen installed app.

SECURITY / DOCUMENT CONTROL
Public access makes manual metadata AND PDF content accessible to anyone with application link. Do not use this arrangement for proprietary/restricted manuals without permission. For staff-only access keep sign-in and use existing signedIn() rules instead. When a document is withdrawn from the public catalog, previously downloaded offline copies and known PDF URLs may still be accessible. A controlled distribution/revocation workflow requires additional design. Firebase Storage CORS must also permit the deployed GitHub Pages origin for getBlob().

If catalog is empty: confirm Firestore Rules published (not Storage), documents active=true, and deployment uses transwisata-egr config. Check browser console for permissions errors.
