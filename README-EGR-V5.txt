TRANSWISATA FLIGHT MANUALS — FIREBASE PROJECT MIGRATION V5

Project: transwisata-egr
Bucket: transwisata-egr.firebasestorage.app
Admin UID: uKTUIiuS3rQcRcmFLhliufbOcds1

1. Upload ALL files to GitHub Pages, replacing old app files, then hard refresh.
2. In transwisata-egr > Authentication enable Email/Password and confirm an admin account has EXACT UID shown above. Accounts in the old project do not transfer automatically; log in with an account from transwisata-egr.
3. Enable Firestore and Storage for transwisata-egr (Storage bucket must actually exist; billing requirements may apply).
4. IMPORTANT: do not publish firestore.rules or storage.rules as whole replacements if project already has EGR rules. Instead merge firestore-flight-manuals-ADD-ONLY.rules and storage-flight-manuals-ADD-ONLY.rules into existing rules, preserving other collections / paths. Because allow rules are OR-ed, remove any overly broad public wildcard grants to protect manuals.
5. Open in browser when online, log in, upload a small PDF first, verify it exists under Storage/manuals/{id}.pdf and Firestore/manuals/{id}; download it to a pilot device and test Airplane Mode.
6. Offline database separated from the previous Firebase project: previously downloaded local PDFs are not automatically migrated. Re-download required manuals for transwisata-egr.
7. If upload is stuck at 0%, check Storage > Files & Rules, browser console/network, and whether active Storage bucket is configured. Configuration alone does not grant server permission.
8. Do not publish flight manuals for operational use until document approval, applicable aircraft serial/supplements, revision control, offline verification, and company EFB procedures are confirmed.

File map:
config.js: Firebase settings
app.js: UI and data logic
sw.js: service worker
firestore-flight-manuals-ADD-ONLY.rules: fragment to merge into Firestore rules
storage-flight-manuals-ADD-ONLY.rules: fragment to merge into Storage rules
firestore.rules / storage.rules: standalone illustrative examples, NOT safe as replacements for active EGR rules.
