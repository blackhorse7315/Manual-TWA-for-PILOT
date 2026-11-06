'use strict';
const $=id=>document.getElementById(id);
const planes=[['ALL','Semua pesawat'],['PK-TWV','Bell 412EP · PK-TWV'],['PK-TWZ','AW109S Grand · PK-TWZ'],['PK-TWY','Gulfstream IV-SP · PK-TWY'],['PK-TWX','King Air 350i · PK-TWX'],['PK-TWW','NC212-200 · PK-TWW'],['VP-CGO','Global Express · VP-CGO']];
const kinds={RFM:'RFM',AFM:'AFM',NORMAL:'Normal Checklist',EMERGENCY:'Emergency Checklist'};
// UID Admin khusus yang telah ditetapkan untuk project transwisata-egr.
const ADMIN_UID='uKTUIiuS3rQcRcmFLhliufbOcds1';
let pdfObject=null,pdfLib=null,previewToken=0,searchToken=0,previewPage=1,previewScale=1,pdfBlob=null,searchMatches=[],renderToken=0,pdfAssetUrls=[],db,local=[],cloud=[],tab='ALL',authUser=null,isAdmin=false,fb=null,viewURL=null,viewDoc=null,installEvent=null,loggingIn=false,activeUploadTask=null,uploadBusy=false,uploadCancelled=false,catalogUnsubscribe=null;
const configured=()=>{const c=window.TWA_FIREBASE_CONFIG;return !!(c&&c.apiKey&&!c.apiKey.startsWith('ISI_')&&c.projectId&&!c.projectId.startsWith('ISI_')&&c.appId&&!c.appId.startsWith('ISI_'))};
const clean=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function toast(msg){$('toast').textContent=msg;$('toast').style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').style.display='none',5800)}
function modal(id,show){$(id).classList.toggle('open',show)}
function idb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('twa-hybrid-flight-manuals-transwisata-egr',1);r.onupgradeneeded=()=>r.result.createObjectStore('manuals',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function tx(mode,fn){return new Promise((resolve,reject)=>{const t=db.transaction('manuals',mode),r=fn(t.objectStore('manuals'));let value;r.onsuccess=()=>value=r.result;t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)})}
async function localReload(){local=await tx('readonly',s=>s.getAll());render();storageInfo()}
function merged(){const byId=new Map(local.map(d=>[d.id,{...d,local:true}]));for(const c of cloud){byId.set(c.id,{...c,local:byId.has(c.id),file:byId.get(c.id)?.file||null})}return [...byId.values()]}
function render(){const q=$('search').value.trim().toLowerCase(),p=$('aircraft').value;const cloudIds=new Set(cloud.map(x=>x.id));const rows=merged().filter(d=>(p==='ALL'||d.aircraft===p)&&(tab==='ALL'||d.kind===tab)&&[d.title,d.aircraft,d.revision,d.kind].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.aircraft.localeCompare(b.aircraft)||['EMERGENCY','NORMAL','RFM','AFM'].indexOf(a.kind)-['EMERGENCY','NORMAL','RFM','AFM'].indexOf(b.kind)||String(b.effective).localeCompare(String(a.effective)));
$('count').textContent=rows.length+' dokumen';$('localState').textContent='Offline: '+local.length+' PDF';$('sectionTitle').textContent=tab==='ALL'?'Katalog Flight Manuals':kinds[tab];$('syncAll').disabled=!fb||!navigator.onLine||!cloud.length;
$('docs').innerHTML=rows.length?rows.map(d=>{const orphan=d.local&&fb&&navigator.onLine&&!cloudIds.has(d.id);const state=orphan?'Arsip lokal — cek revisi':d.local?'✓ Offline siap':'Perlu download';const status=orphan?'old':d.local?'ready':'';return `<article class="doc ${d.kind==='EMERGENCY'?'emg':''}"><div class="doctop"><span class="docicon">${d.kind==='EMERGENCY'?'🚨':d.kind==='NORMAL'?'✅':'📘'}</span><span class="pill ${status}">${state}</span></div><div><div class="meta">${clean(d.aircraft)} · ${clean(kinds[d.kind]||d.kind)}</div><h3>${clean(d.title)}</h3><div class="meta">${clean(d.revision||'Revisi tidak dicantumkan')} · Effective: ${clean(d.effective||'-')}</div><div class="meta">${d.local?'📱 Tersimpan di perangkat':'☁️ Cloud · Belum disimpan offline'}</div></div><div class="docfoot"><button class="btn primary" data-act="preview" data-id="${clean(d.id)}">👁 Preview PDF</button>${!d.local?`<button class="btn good" data-act="download" data-id="${clean(d.id)}">↓ Make Offline</button>`:`<button class="btn good" disabled>✓ Offline Ready</button>`}<button class="btn" data-act="details" data-id="${clean(d.id)}">Detail</button>${isAdmin&&cloudIds.has(d.id)?`<button class="btn danger" data-act="removeCloud" data-id="${clean(d.id)}">Tarik dari Katalog</button>`:''}${d.local?`<button class="btn" data-act="removeLocal" data-id="${clean(d.id)}">Hapus Lokal</button>`:''}</div></article>`}).join(''):`<div class="empty">📂<h3>Belum ada dokumen tersedia</h3>${configured()?'Pastikan internet aktif untuk melihat katalog publik. Manual yang sudah diunduh tetap dapat dibuka saat offline.':'Konfigurasi Firebase di config.js terlebih dahulu.'}</div>`;
$('adminPanel').classList.toggle('show',isAdmin);$('adminUpload').hidden=!isAdmin;$('adminUpload').disabled=!navigator.onLine; if(isAdmin){$('roleState').textContent='Login: Admin · '+(authUser?.email||'');} else if(authUser){$('roleState').textContent='Login: Pilot · '+(authUser.email||'')+' · UID: '+authUser.uid;}
}
async function storageInfo(){if(!navigator.storage?.estimate)return;try{const s=await navigator.storage.estimate();const pdf=local.reduce((v,d)=>v+(d.file?.size||0),0);$('storage').textContent=`Tersimpan offline: ${local.length} PDF (${(pdf/1048576).toFixed(1)} MB) · Penggunaan situs: ${((s.usage||0)/1048576).toFixed(1)} MB · Kuota perkiraan: ${((s.quota||0)/1073741824).toFixed(2)} GB.`}catch{}}
function connection(){const on=navigator.onLine;$('connection').textContent=on?'● Online':'● Offline';$('connection').classList.toggle('offline',!on);if(!on)$('cloudState').textContent='Cloud: offline — salinan lokal tetap tersedia';render();if(on&&fb)refreshCloud().catch(e=>toast('Sinkronisasi: '+e.message))}
async function loadFirebase(){if(!configured()){$('cloudState').textContent='Cloud: atur config.js terlebih dahulu';return}if(!navigator.onLine){$('cloudState').textContent='Cloud: perangkat sedang offline';return}try{
  const ver='10.14.1',base=`https://www.gstatic.com/firebasejs/${ver}/`;
  const [appMod,authMod,fsMod,storageMod]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js'),import(base+'firebase-storage.js')]);
  const app=appMod.initializeApp(window.TWA_FIREBASE_CONFIG);
  fb={auth:authMod,fs:fsMod,st:storageMod,authObj:authMod.getAuth(app),store:fsMod.getFirestore(app),bucket:storageMod.getStorage(app)};
  $('cloudState').textContent='Cloud: Firebase terhubung';
  // Katalog publik ditampilkan tanpa login. Listener aktif dan sinkron pada semua perangkat online.
  startPublicCatalogListener();
  authMod.onAuthStateChanged(fb.authObj,async u=>{
    authUser=u;isAdmin=false;
    $('signIn').hidden=!!u;$('signOut').hidden=!u;
    $('roleState').textContent=u?'Login: '+u.email:'Pengguna · akses katalog tanpa login';
    if(u){
      if(u.uid===ADMIN_UID){isAdmin=true;}
      else {
        try{const role=await fsMod.getDoc(fsMod.doc(fb.store,'users',u.uid));isAdmin=role.exists()&&role.data().role==='admin'}
        catch(e){console.warn('Role fetch:',e)}
      }
    }
    render();
  });
}catch(e){$('cloudState').textContent='Cloud gagal dimuat; mode offline tetap tersedia';console.error(e);toast('Gagal menghubungkan Firebase: '+e.message)}}
function publicManualQuery(){return fb.fs.query(fb.fs.collection(fb.store,'manuals'),fb.fs.where('active','==',true))}
function applyCloudSnapshot(snapshot){
  cloud=snapshot.docs.map(d=>({id:d.id,...d.data()}));
  $('cloudState').textContent=`Cloud: ${cloud.length} manual tersedia untuk pengguna`;
  render();
}
function startPublicCatalogListener(){
  if(!fb||!navigator.onLine||catalogUnsubscribe)return;
  $('cloudState').textContent='Cloud: memuat katalog publik…';
  catalogUnsubscribe=fb.fs.onSnapshot(publicManualQuery(),applyCloudSnapshot,err=>{
    console.error('Katalog publik gagal:',err);
    $('cloudState').textContent='Katalog gagal: '+(err.code||err.message);
    if(catalogUnsubscribe){catalogUnsubscribe();catalogUnsubscribe=null;}
    toast('Gagal membaca katalog publik. Publish Firestore Rules V8: '+err.message);
  });
}
async function refreshCloud(){
  if(!fb||!navigator.onLine)return;
  applyCloudSnapshot(await fb.fs.getDocs(publicManualQuery()));
}
async function downloadDoc(d){if(!fb||!navigator.onLine)throw Error('Internet diperlukan untuk download pertama kali.');const path=d.storagePath;if(!path)throw Error('Lokasi file cloud tidak ditemukan.');const {st,bucket}=fb;let blob;
  try{blob=await st.getBlob(st.ref(bucket,path))}catch(e){throw Error('Download gagal. Periksa Storage Rules dan konfigurasi CORS bucket. '+e.message)}
  if(!(blob instanceof Blob)||blob.size===0)throw Error('PDF kosong.');const bytes=new Uint8Array(await blob.slice(0,5).arrayBuffer());if(String.fromCharCode(...bytes)!=='%PDF-')throw Error('File cloud bukan PDF valid.');
  if(d.bytes&&blob.size!==d.bytes)throw Error('Ukuran PDF tidak sesuai dengan katalog.');
  if(d.sha256){if(!crypto.subtle)throw Error('Browser tidak mendukung verifikasi checksum.');const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==d.sha256)throw Error('Checksum PDF tidak cocok — download dibatalkan.');}
  const localDoc={...d,file:new File([blob],d.filename||'manual.pdf',{type:'application/pdf'}),savedAt:Date.now()};await tx('readwrite',s=>s.put(localDoc));await localReload();return localDoc;
}
async function downloadAll(){if(!cloud.length)return;const btn=$('syncAll');btn.disabled=true;let done=0,fail=0;for(const d of cloud.filter(c=>!local.some(l=>l.id===c.id))){btn.textContent=`Mengunduh ${done+fail+1}…`;try{await downloadDoc(d);done++}catch(e){fail++;console.error('Download',d.title,e);toast(`${d.title}: ${e.message}`)}}btn.textContent='↓ Unduh Semua ke Offline';render();toast(`${done} PDF berhasil tersimpan, ${fail} gagal. Uji satu per satu saat mode pesawat.`)}
function setUploadProgress(percent,status,stats){
  $('uploadProgressWrap').hidden=false;
  $('uploadProgress').value=Math.max(0,Math.min(100,percent));
  $('uploadStatus').textContent=status;
  $('uploadStats').textContent=stats;
}
function bytesLabel(n){return (n/1048576).toFixed(1)+' MB'}
function cancelCurrentUpload(){
  if(!uploadBusy){modal('uploadModal',false);return}
  if(!confirm('Batalkan upload yang sedang berlangsung? File yang belum selesai tidak akan diterbitkan.'))return;
  uploadCancelled=true;
  if(activeUploadTask){activeUploadTask.cancel();$('uploadStatus').textContent='Membatalkan upload…'}
  else $('uploadStatus').textContent='Pembatalan diminta…';
}
async function checkStorageConnection(){
  const panel=$('storageCheckResult'),button=$('storageCheck');
  panel.hidden=false;button.disabled=true;
  const steps=[];
  const show=()=>{panel.textContent=steps.join('\n')};
  try{
    if(!navigator.onLine)throw Error('OFFLINE: browser melaporkan tidak ada koneksi internet.');
    if(!fb||!authUser)throw Error('Belum login atau Firebase SDK belum dimuat.');
    steps.push('Project: '+window.TWA_FIREBASE_CONFIG.projectId);
    steps.push('Bucket konfigurasi: '+window.TWA_FIREBASE_CONFIG.storageBucket);
    steps.push('UID aktif: '+authUser.uid);
    steps.push('1/3 Authentication: memeriksa sesi…');show();
    const token=await Promise.race([authUser.getIdToken(false),new Promise((_,reject)=>setTimeout(()=>reject(Error('Timeout meminta Firebase Auth token (12 detik)')),12000))]);
    if(!token)throw Error('Token login kosong.');
    steps[steps.length-1]='1/3 Authentication: OK (token tersedia; tidak ditampilkan)';show();
    steps.push('2/3 Endpoint Storage: memeriksa respons server…');show();
    const url='https://firebasestorage.googleapis.com/v0/b/'+encodeURIComponent(window.TWA_FIREBASE_CONFIG.storageBucket)+'/o/'+encodeURIComponent('manuals/__twa_storage_check_nonexistent__.pdf');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),14000);
    let r;
    try{r=await fetch(url,{method:'GET',headers:{Authorization:'Firebase '+token},signal:controller.signal,cache:'no-store'});}finally{clearTimeout(timer)}
    let message='';try{const body=await r.json();message=String(body?.error?.message||body?.error?.status||'').slice(0,250)}catch{}
    steps[steps.length-1]=`2/3 Endpoint Storage: HTTP ${r.status}${message?' — '+message:''}`;show();
    steps.push('3/3 Hasil: '); 
    if(r.status===404){steps[steps.length-1]+='Server merespons, objek tes memang tidak ada. Bucket dan koneksi kemungkinan OK. Upload tetap memerlukan izin create pada Storage Rules.';}
    else if(r.status===401||r.status===403){steps[steps.length-1]+='Akses ditolak. Periksa Rules Storage, user login, dan IAM/billing bucket. Jangan gunakan allow write: if true.';}
    else if(r.status===402){steps[steps.length-1]+='Storage tidak dapat digunakan karena masalah billing. Periksa status akun penagihan.';}
    else if(r.status===400){steps[steps.length-1]+='Permintaan tidak diterima. Periksa nama bucket di Storage → Files dan konfigurasi aplikasi.';}
    else if(r.ok){steps[steps.length-1]+='Endpoint memberi respons berhasil, namun path tes mungkin sudah ada.';}
    else{steps[steps.length-1]+='Ada masalah endpoint/bucket. Lihat pesan HTTP di atas dan Storage → Files.';}
    show();
  }catch(e){
    const explanation=e.name==='AbortError'?'Timeout 14 detik saat menghubungi endpoint. Periksa jaringan, pemblokir koneksi/ekstensi, atau bucket Firebase.':e.message;
    steps.push('GAGAL: '+explanation);show();
  }finally{button.disabled=false}
}
async function publish(e){
  e.preventDefault();if(uploadBusy)return;
  if(!isAdmin||!authUser||!navigator.onLine){toast('Hanya admin online yang boleh upload.');return}
  if(!fb){toast('Firebase belum terhubung.');return}
  const file=$('pdf').files[0];if(!file)return;
  const signature=new Uint8Array(await file.slice(0,5).arrayBuffer());
  if(String.fromCharCode(...signature)!=='%PDF-'){toast('File PDF tidak valid.');return}
  const btn=$('publish');uploadBusy=true;uploadCancelled=false;btn.disabled=true;
  const id=crypto.randomUUID(), storagePath='manuals/'+id+'.pdf';let uploaded=false;
  $('cancelUpload').textContent='Batalkan Upload';
  $('uploadDiagnostic').hidden=true;
  setUploadProgress(0,'Menghubungkan ke Firebase Storage…',`${bytesLabel(file.size)} · Menunggu respons Firebase`);
  try{
    const {st,bucket,fs,store}=fb;btn.textContent='Menghubungkan…';
    // Start actual transfer first. Computing a 40+ MB hash before transfer used
    // to make the progress indicator appear stuck at 0%.
    const started=performance.now();let lastUpdate=0,lastBytes=-1;
    // Avoid silently waiting several minutes for a failed backend request.
    // Firebase modular SDK 10.x: retry limits are writable properties on the Storage instance.
    // The old st.setMaxUploadRetryTime(...) call threw TypeError before upload started.
    bucket.maxUploadRetryTime = 120000;
    bucket.maxOperationRetryTime = 30000;
    const diagnosticBase=`Bucket: ${window.TWA_FIREBASE_CONFIG.storageBucket} | UID: ${authUser.uid}`;
    setUploadProgress(0,'Menghubungkan ke Storage… (batas percobaan 120 detik)',diagnosticBase);
    await new Promise((resolve,reject)=>{
      let warningTimer=null;
      try {
        const task=st.uploadBytesResumable(st.ref(bucket,storagePath),file,{contentType:'application/pdf'});
        activeUploadTask=task;
        warningTimer=setTimeout(()=>{
          if(task.snapshot.bytesTransferred===0){
            setUploadProgress(0,navigator.onLine?'Belum ada data terkirim — memeriksa respons Storage…':'Perangkat offline — upload tidak dapat dilanjutkan',
              `0 / ${bytesLabel(file.size)} · ${diagnosticBase}`);
          }
        },15000);
        task.on('state_changed',snap=>{
          const now=performance.now();
          if(now-lastUpdate<180 && snap.bytesTransferred<snap.totalBytes && snap.bytesTransferred===lastBytes)return;
          lastUpdate=now;lastBytes=snap.bytesTransferred;
          const pct=snap.totalBytes?Math.floor(snap.bytesTransferred*100/snap.totalBytes):0;
          const rate=snap.bytesTransferred/Math.max(1,(now-started)/1000);
          btn.textContent=`Mengunggah ${pct}%`;
          const state=!navigator.onLine?'Jaringan offline — menunggu koneksi':snap.state==='paused'?'Upload dijeda — menunggu Firebase':snap.bytesTransferred===0?'Menunggu respons Firebase…':'Mengunggah PDF ke Firebase Storage…';
          setUploadProgress(pct,state,`${bytesLabel(snap.bytesTransferred)} / ${bytesLabel(snap.totalBytes)} · ${pct}% · rata-rata ${bytesLabel(rate)}/detik`);
        },err=>{clearTimeout(warningTimer);reject(err)},()=>{clearTimeout(warningTimer);resolve()});
      }catch(err){clearTimeout(warningTimer);reject(err)}
    });
    activeUploadTask=null;uploaded=true;
    if(uploadCancelled)throw Error('Upload dibatalkan setelah file terkirim; belum diterbitkan ke katalog.');
    setUploadProgress(100,'Upload terkirim 100%. Memverifikasi checksum PDF…',`${bytesLabel(file.size)} terkirim · sedang memeriksa integritas`);
    btn.textContent='Memverifikasi file…';
    if(!crypto.subtle)throw Error('Browser tidak mendukung SHA-256. Gunakan browser terbaru.');
    // Allow browser to paint the 100% state before hashing a large PDF.
    await new Promise(resolve=>setTimeout(resolve,30));
    const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
    const sha256=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
    setUploadProgress(100,'Upload selesai. Menyimpan data katalog…',`${bytesLabel(file.size)} terkirim · 100%`);
    btn.textContent='Menerbitkan katalog…';
    const doc={aircraft:$('plane').value,kind:$('kind').value,title:$('title').value.trim(),revision:$('revision').value.trim(),effective:$('effective').value,filename:file.name,bytes:file.size,sha256,storagePath,active:true,uploadedBy:authUser.uid,uploadedAt:fs.serverTimestamp()};
    await fs.setDoc(fs.doc(store,'manuals',id),doc);
    modal('uploadModal',false);$('uploadForm').reset();
    $('uploadProgressWrap').hidden=true;
    toast('Manual berhasil dipublikasikan ke katalog publik. Setiap perangkat harus download agar offline.');
    try{await refreshCloud()}catch(err){console.warn('Katalog belum tersinkronisasi:',err)}
  }catch(err){
    console.error(err);
    const cancelled=err.code==='storage/canceled'||uploadCancelled;
    const code=err.code||'unknown';
    const status=err.customData?.serverResponse||'';
    const diagnosis=code==='storage/unauthorized'?'Akses Storage ditolak. Periksa Storage Rules dan UID Admin.':
      code==='storage/retry-limit-exceeded'?'Storage tidak memberi respons hingga batas percobaan. Gunakan tombol Tes Koneksi Storage; periksa apakah bucket sudah dibuat di Storage → Files, serta jaringan dan Storage Rules.':
      code==='storage/bucket-not-found'?'Bucket tidak ditemukan. Bandingkan nama bucket dengan Firebase Console → Storage → Files.':
      code==='storage/quota-exceeded'?'Kuota atau billing Storage bermasalah. Periksa paket Blaze dan Billing.':
      code==='storage/unauthenticated'?'Sesi Firebase Authentication tidak berlaku. Logout lalu login kembali.':
      code==='storage/canceled'?'Upload dibatalkan.':
      uploaded?'Upload PDF berhasil, tetapi penulisan katalog Firestore gagal. Periksa Firestore Rules.':
      'Lihat pesan error dan Firebase Console → Storage untuk memeriksa koneksi, rules, dan bucket.';
    const detail=`${code} — ${diagnosis} ${err.message||''} ${status}`.trim();
    setUploadProgress($('uploadProgress').value,cancelled?'Upload dibatalkan':'Upload gagal — lihat diagnosis',detail);
    $('uploadDiagnostic').hidden=false;
    $('uploadDiagnostic').textContent=`DIAGNOSIS UPLOAD\n${detail}\nBucket: ${window.TWA_FIREBASE_CONFIG.storageBucket}\nUID: ${authUser.uid}\nCatatan: Jangan bagikan token autentikasi atau informasi sandi.`;
    toast(cancelled?'Upload dibatalkan.':diagnosis);
  }finally{
    activeUploadTask=null;uploadBusy=false;uploadCancelled=false;
    btn.disabled=false;btn.textContent='Upload & Publikasikan';$('cancelUpload').textContent='Batal';
  }
}
// PDF.js is downloaded once on the device and cached in Cache Storage for offline search.
// PDF bytes themselves are NEVER cached here; they are kept in IndexedDB.
const PDFJS_BASE='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const PDFJS_CACHE='twa-pdf-search-engine-v1';
const PDFJS_FILES=['pdf.min.js','pdf.worker.min.js'];
let pdfEnginePromise=null;
async function getPdfEngine(){
  if(pdfLib)return pdfLib;
  if(pdfEnginePromise)return pdfEnginePromise;
  pdfEnginePromise=(async()=>{
    const cache=await caches.open(PDFJS_CACHE);
    const urls=PDFJS_FILES.map(n=>PDFJS_BASE+n);
    const blobs=[];
    for(const url of urls){
      let res=await cache.match(url);
      if(!res){if(!navigator.onLine)throw Error('Mesin pencarian PDF belum disiapkan di perangkat ini. Hubungkan internet sekali dan buka Preview PDF.');
        res=await fetch(url,{mode:'cors'});
        if(!res.ok)throw Error('Gagal memuat komponen pencarian PDF: '+res.status);
        await cache.put(url,res.clone());
      }
      blobs.push(await res.blob());
    }
    const scriptURL=URL.createObjectURL(new Blob([blobs[0]],{type:'text/javascript'}));
    const workerURL=URL.createObjectURL(new Blob([blobs[1]],{type:'text/javascript'}));
    pdfAssetUrls.push(scriptURL,workerURL);
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=scriptURL;script.onload=resolve;script.onerror=()=>reject(Error('Komponen pencarian PDF gagal dimuat.'));document.head.appendChild(script)
    });
    if(!window.pdfjsLib)throw Error('PDF.js gagal diinisialisasi.');
    pdfLib=window.pdfjsLib;
    pdfLib.GlobalWorkerOptions.workerSrc=workerURL;
    return pdfLib;
  })().catch(e=>{pdfEnginePromise=null;throw e});
  return pdfEnginePromise;
}
function setPreviewStatus(s){$('searchStatus').textContent=s}
async function renderPdfPage(pageNo){
  if(!pdfObject)return;
  const token=++renderToken;
  pageNo=Math.max(1,Math.min(pdfObject.numPages,Number(pageNo)||1));
  const page=await pdfObject.getPage(pageNo);
  if(token!==renderToken)return;
  const stage=$('viewStage');
  const base=page.getViewport({scale:1});
  const fit=Math.max(.25,(stage.clientWidth-30)/base.width);
  const scale=fit*previewScale;
  const viewport=page.getViewport({scale});
  const canvas=$('pageCanvas');
  const ratio=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(viewport.width*ratio);canvas.height=Math.round(viewport.height*ratio);
  canvas.style.width=Math.round(viewport.width)+'px';canvas.style.height=Math.round(viewport.height)+'px';
  const context=canvas.getContext('2d');
  await page.render({canvasContext:context,viewport,transform:ratio!==1?[ratio,0,0,ratio,0,0]:null}).promise;
  if(token!==renderToken)return;
  previewPage=pageNo;$('pageNum').value=pageNo;$('pageTotal').textContent='/ '+pdfObject.numPages;
  $('zoomValue').textContent=Math.round(previewScale*100)+'%';
  stage.scrollTo({left:0,top:0});
}
function highlightSnippet(text,term){
  const pos=text.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
  if(pos<0)return clean(text.slice(0,180));
  return clean(text.slice(Math.max(0,pos-55),pos))+'<mark>'+clean(text.slice(pos,pos+term.length))+'</mark>'+clean(text.slice(pos+term.length,pos+term.length+100));
}
async function searchPdf(){
  const query=$('pdfSearch').value.trim();
  if(!query||!pdfObject)return;
  const token=++searchToken;searchMatches=[];
  $('pdfHits').innerHTML='Memulai pencarian…';setPreviewStatus('Mencari…');
  let total=0;
  for(let pageNo=1;pageNo<=pdfObject.numPages;pageNo++){
    if(token!==searchToken)return;
    try{
      const page=await pdfObject.getPage(pageNo);
      const content=await page.getTextContent();
      // Join text runs with spaces so phrases spanning multiple text runs can be found.
      const text=content.items.map(i=>i.str||'').join(' ');
      let idx=0,foundOnPage=0;
      while((idx=text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase(),idx))!==-1){
        searchMatches.push({page:pageNo,text:text.slice(Math.max(0,idx-60),Math.min(text.length,idx+query.length+110))});
        total++;foundOnPage++;idx+=Math.max(query.length,1);
        if(foundOnPage>=8||total>=300)break;
      }
    }catch(e){console.warn('Tidak dapat mengindeks halaman '+pageNo,e)}
    if(pageNo%8===0||pageNo===pdfObject.numPages||total>=300){
      setPreviewStatus('Halaman '+pageNo+'/'+pdfObject.numPages+' · '+total+' hasil');
      $('pdfHits').innerHTML=searchMatches.length?searchMatches.map((m,i)=>`<button type="button" class="result" data-hit="${i}"><small>Halaman ${m.page}</small>${highlightSnippet(m.text,query)}</button>`).join(''):'Belum ada hasil.';
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(total>=300)break;
  }
  if(token!==searchToken)return;
  setPreviewStatus(total?total+' hasil · klik hasil untuk ke halaman':'Teks tidak ditemukan');
  if(!total)$('pdfHits').textContent='Tidak ditemukan. Untuk PDF scan gambar, pencarian teks memerlukan OCR.';
}
async function openDoc(d){
  const token=++previewToken;
  searchToken++;renderToken++;
  viewDoc=null;pdfBlob=null;pdfObject=null;
  $('viewer').classList.remove('native');
  $('viewer').classList.add('open');document.body.style.overflow='hidden';
  $('viewTitle').textContent=d.aircraft+' · '+d.title;
  $('pdfHits').textContent='Ketik kata atau frasa dan pilih Cari.';
  $('pdfSearch').value='';setPreviewStatus('Membuka dokumen…');
  $('pageTotal').textContent='/ –';$('pageNum').value=1;
  const localDoc=local.find(x=>x.id===d.id);
  $('viewerOffline').hidden=!!localDoc;
  try{
    let blob=localDoc?.file;
    if(!blob){
      if(!fb||!navigator.onLine)throw Error('Dokumen belum tersedia offline. Hubungkan internet dan pilih Make Offline.');
      blob=await fb.st.getBlob(fb.st.ref(fb.bucket,d.storagePath));
      if(d.bytes&&blob.size!==d.bytes)throw Error('Ukuran dokumen berbeda dengan katalog.');
    }
    if(token!==previewToken)return;
    const magic=new Uint8Array(await blob.slice(0,5).arrayBuffer());
    if(String.fromCharCode(...magic)!=='%PDF-')throw Error('File bukan PDF yang valid.');
    pdfBlob=blob;
    viewDoc={...d,file:blob,filename:d.filename||d.title+'.pdf'};
    if(viewURL)URL.revokeObjectURL(viewURL);
    viewURL=URL.createObjectURL(blob);
    $('pdfFrame').src=viewURL+'#toolbar=1';
    const engine=await getPdfEngine();
    if(token!==previewToken)return;
    pdfObject=await engine.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise;
    if(token!==previewToken)return;
    previewScale=1;previewPage=1;
    await renderPdfPage(1);
    setPreviewStatus(pdfObject.numPages+' halaman · siap dicari');
  }catch(e){
    if(token!==previewToken)return;
    console.error('Preview',e);
    if(viewURL){$('viewer').classList.add('native');setPreviewStatus('Mode PDF bawaan: '+e.message);}
    else {setPreviewStatus('Preview gagal: '+e.message);toast(e.message)}
  }
}
function closeViewer(){
  previewToken++;searchToken++;renderToken++;
  $('viewer').classList.remove('open','native');$('pdfFrame').src='about:blank';document.body.style.overflow='';
  const old=viewURL;viewURL=null;viewDoc=null;pdfObject=null;pdfBlob=null;
  if(old)setTimeout(()=>URL.revokeObjectURL(old),3000);
}
function savePdf(){
  if(!viewDoc?.file)return toast('Dokumen belum selesai dimuat.');
  const u=URL.createObjectURL(viewDoc.file),a=document.createElement('a');a.href=u;a.download=viewDoc.filename||'manual.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);
}
async function makeViewedOffline(){
  if(!viewDoc?.file)return toast('Buka dokumen terlebih dahulu.');
  const d=viewDoc;
  const btn=$('viewerOffline');btn.disabled=true;btn.textContent='Menyimpan…';
  try{
    // For cloud-origin preview verify bytes/checksum using canonical download routine.
    if(!local.some(x=>x.id===d.id)){
      const magic=new Uint8Array(await d.file.slice(0,5).arrayBuffer());
      if(String.fromCharCode(...magic)!=='%PDF-')throw Error('Berkas bukan PDF valid');
      if(d.bytes&&d.file.size!==d.bytes)throw Error('Ukuran file berbeda dari katalog');
      if(d.sha256){const hashBytes=await crypto.subtle.digest('SHA-256',await d.file.arrayBuffer());const hash=[...new Uint8Array(hashBytes)].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==d.sha256)throw Error('Checksum PDF tidak cocok');}
      const record={...d,file:new File([d.file],d.filename||'manual.pdf',{type:'application/pdf'}),savedAt:Date.now()};
      await tx('readwrite',s=>s.put(record));await localReload();
    }
    btn.hidden=true;toast('Make Offline berhasil. Dokumen tersimpan pada perangkat ini. Uji saat Airplane Mode.');
  }catch(e){toast('Make Offline gagal: '+e.message)}finally{btn.disabled=false;btn.textContent='↓ Make Offline'}
}
async function actions(e){const button=e.target.closest('[data-act]');if(!button)return;const d=merged().find(x=>x.id===button.dataset.id);if(!d)return;const action=button.dataset.act;try{if(action==='preview'||action==='open')return await openDoc(d);if(action==='details')return alert(`AIRCRAFT: ${d.aircraft}\nTYPE: ${kinds[d.kind]}\nTITLE: ${d.title}\nREVISION: ${d.revision}\nEFFECTIVE: ${d.effective}\nLOCAL: ${d.local?'YES':'NO'}\n${d.bytes?'SIZE: '+(d.bytes/1048576).toFixed(2)+' MB':''}\n\nPeriksa selalu status revisi melalui document control.`);if(action==='download'){button.disabled=true;button.textContent='Menyimpan offline…';await downloadDoc(d);return toast('Make Offline berhasil. PDF tersimpan pada perangkat ini. Uji saat mode pesawat.')};if(action==='removeLocal'){if(!confirm('Hapus salinan offline '+d.title+' dari perangkat ini?'))return;await tx('readwrite',s=>s.delete(d.id));await localReload();return toast('Salinan lokal dihapus.')};if(action==='removeCloud'){if(!isAdmin||!confirm('Tarik manual ini dari katalog pusat? Salinan pada perangkat pilot lain tidak otomatis terhapus.'))return;await fb.fs.updateDoc(fb.fs.doc(fb.store,'manuals',d.id),{active:false,withdrawnAt:fb.fs.serverTimestamp()});await refreshCloud();return toast('Ditarik dari katalog pusat. Beritahu pilot agar menghapus arsip lama.')}}catch(err){console.error(err);toast(err.message)}finally{render()}}
async function init(){planes.forEach(([v,l])=>{$('aircraft').add(new Option(l,v));if(v!=='ALL')$('plane').add(new Option(l,v))});db=await idb();await localReload();connection();if('serviceWorker'in navigator&&location.protocol!=='file:'){try{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;$('shellStatus').textContent='App shell siap untuk offline (pastikan uji buka ulang dengan mode pesawat).'}catch(e){$('shellStatus').textContent='Service Worker belum siap: '+e.message}}else $('shellStatus').textContent='Gunakan HTTPS (misalnya GitHub Pages) untuk instalasi PWA dan offline.';
  $('search').oninput=render;$('aircraft').onchange=render;$('docs').onclick=actions;$('tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('selected',x===b));render()};
  $('syncAll').onclick=downloadAll;$('signIn').onclick=()=>{if(!fb){toast('Firebase belum siap. Periksa konfigurasi dan koneksi.');return}modal('loginModal',true)};$('signOut').onclick=()=>fb&&fb.auth.signOut(fb.authObj);$('showPass').onchange=e=>$('password').type=e.target.checked?'text':'password';$('loginForm').onsubmit=async e=>{e.preventDefault();if(loggingIn)return;loggingIn=true;$('loginSubmit').disabled=true;try{await fb.auth.signInWithEmailAndPassword(fb.authObj,$('email').value.trim(),$('password').value);$('password').value='';modal('loginModal',false);toast('Login berhasil. Sinkronisasi katalog sedang berlangsung.')}catch(err){toast('Login gagal: '+err.message)}finally{loggingIn=false;$('loginSubmit').disabled=false}};
  $('newManual').onclick=()=>{if(!navigator.onLine)return toast('Upload membutuhkan koneksi internet.');modal('uploadModal',true)};$('adminUpload').onclick=()=>{if(!navigator.onLine)return toast('Upload membutuhkan koneksi internet.');modal('uploadModal',true)};$('uploadForm').onsubmit=publish;$('pdf').onchange=()=>{const f=$('pdf').files[0];$('pdfInfo').textContent=f?`${f.name} · ${bytesLabel(f.size)}. Lama upload tergantung jaringan; pantau progres di bawah.`:'Pilih PDF untuk upload.';$('uploadProgressWrap').hidden=true;$('uploadDiagnostic').hidden=true;$('storageCheckResult').hidden=true};$('cancelUpload').onclick=cancelCurrentUpload;$('storageCheck').onclick=checkStorageConnection;document.querySelectorAll('[data-close]').forEach(b=>{if(b.id!=='cancelUpload')b.onclick=()=>{if(b.dataset.close==='uploadModal'&&uploadBusy)return toast('Batalkan upload terlebih dahulu.');modal(b.dataset.close,false)}});$('back').onclick=closeViewer;
  $('viewerOffline').onclick=makeViewedOffline;
  $('pagePrev').onclick=()=>renderPdfPage(previewPage-1).catch(e=>toast(e.message));
  $('pageNext').onclick=()=>renderPdfPage(previewPage+1).catch(e=>toast(e.message));
  $('pageNum').onchange=()=>renderPdfPage($('pageNum').value).catch(e=>toast(e.message));
  $('zoomIn').onclick=()=>{previewScale=Math.min(3,previewScale+0.25);renderPdfPage(previewPage).catch(e=>toast(e.message))};
  $('zoomOut').onclick=()=>{previewScale=Math.max(.5,previewScale-0.25);renderPdfPage(previewPage).catch(e=>toast(e.message))};
  $('findPdf').onclick=searchPdf;
  $('stopSearch').onclick=()=>{searchToken++;setPreviewStatus('Pencarian dihentikan')};
  $('pdfSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();searchPdf()}};
  $('pdfHits').onclick=e=>{const hit=e.target.closest('[data-hit]');if(!hit)return;const m=searchMatches[Number(hit.dataset.hit)];if(m){document.querySelectorAll('.result').forEach(r=>r.classList.remove('selected'));hit.classList.add('selected');renderPdfPage(m.page).catch(err=>toast(err.message))}};
  $('openNative').onclick=()=>{if(!viewDoc)return;const u=URL.createObjectURL(viewDoc.file),w=window.open(u,'_blank');if(!w)toast('Izinkan pop-up atau gunakan Simpan PDF.');setTimeout(()=>URL.revokeObjectURL(u),120000)};$('savePdf').onclick=savePdf;
  $('persistent').onclick=async()=>{if(!navigator.storage?.persist)return toast('Browser ini tidak mendukung persistent storage.');toast(await navigator.storage.persist()?'Persistent storage disetujui. Tetap siapkan backup.':'Belum diizinkan browser. Periksa storage dan uji offline.')};
  $('test').onclick=()=>alert('UJI SEBELUM TERBANG\n1. Buka aplikasi saat online (tanpa login).\n2. Unduh semua manual yang relevan.\n3. Pastikan status “Offline siap”.\n4. Tutup aplikasi, aktifkan Airplane Mode.\n5. Buka kembali dari ikon Home Screen.\n6. Buka setiap PDF dan cek halaman, kelengkapan, revisi.\n7. Bila gagal, gunakan sumber resmi alternatif sesuai prosedur perusahaan.');
  $('export').onclick=()=>{const data=merged().map(({file,...d})=>d);const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='TWA-manual-inventory.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)};
  $('install').onclick=async()=>{if(installEvent){installEvent.prompt();await installEvent.userChoice;installEvent=null}else alert('iPhone: Safari → Share → Add to Home Screen.\nAndroid: Chrome → Menu → Install app / Add to Home screen.\nDesktop: gunakan ikon Install pada address bar.')} ;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e});
  window.addEventListener('online',()=>{connection();if(uploadBusy)$('uploadStatus').textContent='Koneksi kembali — Firebase melanjutkan upload…';if(!fb)loadFirebase();else if(!catalogUnsubscribe)startPublicCatalogListener()});window.addEventListener('offline',()=>{connection();if(uploadBusy)$('uploadStatus').textContent='Koneksi internet terputus — upload menunggu jaringan';});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeViewer();if(!uploadBusy)modal('uploadModal',false);modal('loginModal',false)}});await loadFirebase();
}
init().catch(e=>{console.error(e);$('docs').innerHTML='<div class="empty">Tidak dapat menggunakan penyimpanan browser. Gunakan mode browser biasa (bukan Private), aktifkan penyimpanan situs, kemudian coba kembali.</div>'});
