TRANSWISATA FLIGHT MANUALS – V9 PREVIEW & MAKE OFFLINE

New features:
- Preview PDF from cloud without saving to the device (internet required).
- Make Offline button on each cloud document and inside the viewer.
- Offline Ready badge for verified local IndexedDB copies.
- PDF.js canvas preview, page number, previous/next, zoom and full-document text search.
- Search results can be clicked to jump to a page. Large PDFs are searched progressively, capped at 300 results / 8 per page.
- PDF.js engine files are downloaded from cdnjs once when first preview is opened with internet and cached for later offline use; no third-party upload of PDF content.
- If the engine cannot be loaded, use the browser's native PDF viewer fallback.
- Scanned/image-only PDFs need OCR for text search; this version does NOT OCR.
- PDF files are stored in IndexedDB on each device; clearing site data removes them.
- Existing Firebase configuration, admin upload, realtime public catalog, EGR rules unchanged.

DEPLOY: Upload ALL contents to GitHub Pages. Refresh page and open Preview once while online so PDF.js assets are cached. Download documents using Make Offline and verify by testing Airplane Mode before flight.

SAFETY: Not a certified EFB/document control system. Ensure correct approved versions and backup procedures.
