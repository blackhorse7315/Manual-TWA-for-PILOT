'use strict';
const $=id=>document.getElementById(id);
const planes=[['ALL','Semua pesawat'],['PK-TWV','Bell 412EP · PK-TWV'],['PK-TWZ','AW109S Grand · PK-TWZ'],['PK-TWY','Gulfstream IV-SP · PK-TWY'],['PK-TWX','King Air 350i · PK-TWX'],['PK-TWW','NC212-200 · PK-TWW'],['VP-CGO','Global Express · VP-CGO']];
const kinds={RFM:'RFM',AFM:'AFM',NORMAL:'Normal Checklist',EMERGENCY:'Emergency Checklist'};
// UID Admin khusus yang telah ditetapkan untuk project transwisata-egr.
const ADMIN_UID='uKTUIiuS3rQcRcmFLhliufbOcds1';
let pdfObject=null,pdfLib=null,previewToken=0,searchToken=0,previewPage=1,previewScale=1,pdfBlob=null,searchMatches=[],renderToken=0,pdfAssetUrls=[],db,local=[],cloud=[],tab='ALL',authUser=null,isAdmin=false,fb=null,viewURL=null,viewDoc=null,installEvent=null,loggingIn=false,activeUploadTask=null,uploadBusy=false,uploadCancelled=false,catalogUnsubscribe=null;
// Capture install eligibility immediately. The event may fire while Firebase/IndexedDB initialize.
let appInstallDismissed=false;
function isStandaloneApp(){
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    navigator.standalone === true);
}
function refreshInstallButton(){
  const b=$('install'); if(!b)return;
  const installed=isStandaloneApp();
  b.hidden=installed;
  b.disabled=false;
  b.textContent=installEvent?'⬇ Install App':'Install App';
  b.title=installed?'Aplikasi sudah berjalan dalam mode terpasang':
    installEvent?'Pasang aplikasi melalui konfirmasi browser':'Lihat petunjuk instalasi perangkat';
}
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  installEvent=e;
  refreshInstallButton();
});
window.addEventListener('appinstalled',()=>{
  installEvent=null; appInstallDismissed=false;
  refreshInstallButton();
  toast('Aplikasi berhasil dipasang. Buka melalui ikon di Home Screen atau desktop.');
});
window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',refreshInstallButton);
async function requestAppInstallation(){
  if(isStandaloneApp()){refreshInstallButton();return;}
  if(installEvent){
    const event=installEvent;
    installEvent=null;
    try{
      await event.prompt();
      const result=await event.userChoice;
      if(result?.outcome==='accepted') toast('Permintaan instalasi diterima. Periksa ikon aplikasi di perangkat.');
      else {appInstallDismissed=true;toast('Instalasi dibatalkan. Gunakan menu browser untuk memasang aplikasi.');}
    }catch(err){console.warn('PWA install prompt failed:',err);showInstallInstructions();}
    refreshInstallButton();
    return;
  }
  showInstallInstructions();
}
function showInstallInstructions(){
  const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  const secure=location.protocol==='https:'||location.hostname==='localhost';
  if(!secure){alert('Aplikasi harus dibuka melalui HTTPS (misalnya GitHub Pages) agar bisa dipasang sebagai PWA.');return;}
  if(ios){alert('Instalasi iPhone/iPad membutuhkan tindakan pengguna. Buka di Safari → tombol Share (Bagikan) → Add to Home Screen (Tambahkan ke Layar Utama) → Add.');return;}
  alert('Browser belum menawarkan prompt instalasi otomatis. Android: Chrome → menu ⋮ → Install app / Add to Home screen. Desktop: Chrome/Edge → ikon Install pada bilah alamat atau menu ⋮ → Install app. Pastikan aplikasi belum terinstal dan fitur PWA didukung browser.');
}
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
$('adminPanel').classList.toggle('show',isAdmin);$('adminOfflinePanel').classList.toggle('show',isAdmin);$('adminSafetyNotice').classList.toggle('show',isAdmin);$('adminUpload').hidden=!isAdmin;$('adminUpload').disabled=!navigator.onLine; if(isAdmin){$('roleState').textContent='Login: Admin · '+(authUser?.email||'');} else if(authUser){$('roleState').textContent='Login: Pilot · '+(authUser.email||'')+' · UID: '+authUser.uid;}
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
// Prefer the public Firebase Storage media endpoint over getBlob(): public V8 rules permit
// unauthenticated reads, and a media URL can be embedded in the native PDF viewer immediately.
// Do not persist tokenized URLs, or cache PDF bytes in the service worker.
function manualMediaURL(d){
  const bucket=window.TWA_FIREBASE_CONFIG?.storageBucket;
  const path=String(d.storagePath||'');
  if(!bucket||!/^manuals\/[A-Za-z0-9_-]+\.pdf$/.test(path))throw Error('Lokasi manual tidak valid.');
  return 'https://firebasestorage.googleapis.com/v0/b/'+encodeURIComponent(bucket)+'/o/'+encodeURIComponent(path)+'?alt=media';
}
function cloudMessage(err){
  if(err?.name==='AbortError')return 'Server tidak merespons tepat waktu. Coba koneksi lain.';
  if(err instanceof TypeError)return 'Browser memblokir pengambilan PDF lintas domain (CORS) atau koneksi terputus. Periksa CORS bucket dan tab Network.';
  return String(err?.message||err);
}
async function fetchCloudPDF(d,onProgress){
  if(!navigator.onLine)throw Error('Internet diperlukan untuk download pertama kali.');
  const url=manualMediaURL(d);
  const controller=new AbortController();
  // Timeout is for connecting/receiving response headers, not downloading a large PDF.
  const firstByteTimer=setTimeout(()=>controller.abort(),20000);
  let res;
  try{res=await fetch(url,{method:'GET',mode:'cors',cache:'no-store',signal:controller.signal});}
  catch(e){throw Error(cloudMessage(e))}
  finally{clearTimeout(firstByteTimer)}
  if(!res.ok){
    let info='';try{info=(await res.text()).slice(0,250)}catch{}
    throw Error('Firebase Storage HTTP '+res.status+(res.status===403?' — aturan baca publik belum aktif.':res.status===404?' — PDF tidak ditemukan di bucket.':'')+' '+info);
  }
  const total=Number(res.headers.get('content-length'))||Number(d.bytes)||0;
  if(!res.body){const b=await res.blob();onProgress?.(b.size,total);return b}
  const reader=res.body.getReader(),chunks=[];let received=0;
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      chunks.push(value);received+=value.byteLength;
      if(received>110*1024*1024)throw Error('PDF melebihi batas aplikasi 110 MB.');
      onProgress?.(received,total);
    }
  }finally{reader.releaseLock()}
  return new Blob(chunks,{type:'application/pdf'});
}
async function validatePDF(d,blob){
  if(!(blob instanceof Blob)||blob.size<5)throw Error('PDF kosong.');
  const bytes=new Uint8Array(await blob.slice(0,5).arrayBuffer());
  if(String.fromCharCode(...bytes)!=='%PDF-')throw Error('File dari cloud bukan PDF valid.');
  if(d.bytes&&blob.size!==d.bytes)throw Error('Ukuran file berbeda dengan katalog ('+blob.size+' / '+d.bytes+' byte).');
  if(d.sha256){
    if(!crypto.subtle)throw Error('Browser tidak mendukung pemeriksaan checksum.');
    const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==d.sha256)throw Error('Checksum tidak cocok. File belum disimpan offline.');
  }
}
async function storeOffline(d,blob){
  await validatePDF(d,blob);
  const record={...d,file:new File([blob],d.filename||'manual.pdf',{type:'application/pdf'}),savedAt:Date.now()};
  delete record.remoteURL;delete record.local;
  await tx('readwrite',store=>store.put(record));await localReload();return record;
}
async function downloadDoc(d){
  const blob=await fetchCloudPDF(d,(done,total)=>toast('Mengunduh '+d.title+': '+(total?Math.round(100*done/total)+'%':(done/1048576).toFixed(1)+' MB')));
  return storeOffline(d,blob);
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
  const immersive=$('viewer').classList.contains('mobile-immersive');
  const fit=Math.max(.25,(stage.clientWidth-(immersive?0:20))/base.width);
  const scale=fit*previewScale;
  const viewport=page.getViewport({scale});
  const canvas=$('pageCanvas');
  const ratio=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(viewport.width*ratio);canvas.height=Math.round(viewport.height*ratio);
  canvas.style.width=Math.round(viewport.width)+'px';canvas.style.height=Math.round(viewport.height)+'px';
  const context=canvas.getContext('2d');
  await page.render({canvasContext:context,viewport,transform:ratio!==1?[ratio,0,0,ratio,0,0]:null}).promise;
  if(token!==renderToken)return;
  previewPage=pageNo;$('pageNum').value=pageNo;$('pageTotal').textContent='/ '+pdfObject.numPages;updateImmersivePage();
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
  $('viewer').classList.add('open','native');document.body.style.overflow='hidden';syncViewerFullscreen();
  $('viewTitle').textContent=d.aircraft+' · '+d.title;
  $('pdfHits').textContent='Pencarian disiapkan. Sementara itu PDF dapat dibaca di preview asli.';
  $('pdfSearch').value='';$('findPdf').disabled=true;
  setPreviewStatus('Membuka preview PDF…');
  $('pageTotal').textContent='/ –';$('pageNum').value=1;
  const localDoc=local.find(x=>x.id===d.id);
  $('viewerOffline').hidden=!!localDoc;updateImmersivePage();
  try{
    let blob=localDoc?.file||null;
    if(viewURL){URL.revokeObjectURL(viewURL);viewURL=null}
    if(blob){
      viewURL=URL.createObjectURL(blob);$('pdfFrame').src=viewURL+'#toolbar=1';
      viewDoc={...d,file:blob,filename:d.filename||d.title+'.pdf'};
      setPreviewStatus('PDF offline dibuka. Memuat mesin pencarian…');
    }else{
      if(!navigator.onLine)throw Error('PDF belum disimpan offline. Hubungkan internet dan tekan Make Offline.');
      const url=manualMediaURL(d);
      // Browser native viewer can stream/display immediately without retrieving full file in JS.
      $('pdfFrame').src=url+'#toolbar=1';
      viewDoc={...d,file:null,remoteURL:url,filename:d.filename||d.title+'.pdf'};
      setPreviewStatus('Preview cloud terbuka. Menyiapkan pencarian teks…');
      // Fetch in parallel only for interactive full-text search and Make Offline.
      // Failure must NEVER prevent the native PDF preview from remaining visible.
      try{
        blob=await fetchCloudPDF(d,(done,total)=>{
          if(token===previewToken)setPreviewStatus('Menyiapkan pencarian: '+(total?Math.min(100,Math.floor(done/total*100))+'%':(done/1048576).toFixed(1)+' MB'));
        });
      }catch(err){
        if(token!==previewToken)return;
        setPreviewStatus('Preview asli tersedia. Pencarian/Make Offline belum siap: '+cloudMessage(err));
        $('pdfHits').textContent='PDF asli dapat dibaca. Untuk pencarian interaktif dan Make Offline, pengunduhan data membutuhkan CORS bucket yang benar. Periksa README V10.';
        return;
      }
      if(token!==previewToken)return;
      await validatePDF(d,blob);
      viewDoc.file=blob;
    }
    if(token!==previewToken)return;
    pdfBlob=blob;
    const engine=await getPdfEngine();
    if(token!==previewToken)return;
    pdfObject=await engine.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise;
    if(token!==previewToken)return;
    previewScale=1;previewPage=1;
    $('viewer').classList.remove('native');
    await renderPdfPage(1);
    $('findPdf').disabled=false;
    setPreviewStatus(pdfObject.numPages+' halaman · preview dan pencarian siap');
  }catch(e){
    if(token!==previewToken)return;
    console.error('Preview',e);
    if(viewDoc?.remoteURL||viewURL){
      $('viewer').classList.add('native');
      setPreviewStatus('PDF asli tersedia; pencarian belum siap: '+cloudMessage(e));
      $('pdfHits').textContent='Pembaca PDF bawaan aktif. Coba kembali saat online atau gunakan Make Offline.';
    }else{setPreviewStatus('Preview gagal: '+cloudMessage(e));toast(cloudMessage(e))}
  }
}
// Fullscreen is initiated only by a user gesture. iOS Safari may not support
// requestFullscreen on arbitrary elements; offer a focus-mode fallback.
function updateImmersivePage(){
  const element=$('immersivePage');
  if(element)element.textContent=(previewPage||1)+' / '+(pdfObject?.numPages||'–');
}
function setMobileImmersive(on){
  const viewer=$('viewer');
  viewer.classList.toggle('mobile-immersive',Boolean(on));
  if(!on)viewer.classList.remove('show-menu','show-results');
  const b=$('immersiveToolbar');if(b)b.textContent='☰ Menu';
  if(pdfObject&&!viewer.classList.contains('native')){
    requestAnimationFrame(()=>renderPdfPage(previewPage).catch(console.warn));
  }
}
function syncViewerFullscreen(){
  const viewer=$('viewer');
  const active=document.fullscreenElement===viewer || document.webkitFullscreenElement===viewer;
  const focused=viewer.classList.contains('focus-mode');
  const btn=$('viewerFullscreen');
  btn.textContent=active||focused?'⤢ Exit Fullscreen':'⛶ Fullscreen';
  btn.setAttribute('aria-pressed',String(Boolean(active||focused)));
  btn.title=active||focused?'Exit Fullscreen (F)':'Fullscreen (F)';
  if(window.matchMedia('(max-width:800px)').matches)setMobileImmersive(Boolean(active||focused));
  else if(viewer.classList.contains('mobile-immersive'))setMobileImmersive(false);
}
async function toggleViewerFullscreen(){
  const viewer=$('viewer');
  if(!viewer.classList.contains('open'))return;
  if(document.fullscreenElement===viewer || document.webkitFullscreenElement===viewer){
    try{
      if(document.exitFullscreen)await document.exitFullscreen();
      else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
    }catch(e){toast('Tidak dapat keluar dari fullscreen: '+e.message)}
    syncViewerFullscreen();return;
  }
  if(viewer.classList.contains('focus-mode')){
    viewer.classList.remove('focus-mode');syncViewerFullscreen();return;
  }
  try{
    if(viewer.requestFullscreen)await viewer.requestFullscreen();
    else if(viewer.webkitRequestFullscreen)await viewer.webkitRequestFullscreen();
    else throw new Error('Fullscreen API tidak tersedia');
  }catch(e){
    // Fallback particularly for iPhone browser; already fixed to viewport.
    viewer.classList.add('focus-mode');
    toast('Browser tidak mendukung fullscreen penuh. Mode fokus aktif; pasang aplikasi ke Home Screen untuk tampilan lebih luas.');
  }
  syncViewerFullscreen();
}
function closeViewer(){
  previewToken++;searchToken++;renderToken++;
  if(document.fullscreenElement===$('viewer') && document.exitFullscreen)document.exitFullscreen().catch(()=>{});
  else if(document.webkitFullscreenElement===$('viewer') && document.webkitExitFullscreen)document.webkitExitFullscreen();
  $('viewer').classList.remove('open','native','focus-mode','mobile-immersive','show-menu','show-results');$('pdfFrame').src='about:blank';document.body.style.overflow='';syncViewerFullscreen();
  const old=viewURL;viewURL=null;viewDoc=null;pdfObject=null;pdfBlob=null;
  if(old)setTimeout(()=>URL.revokeObjectURL(old),3000);
}
function savePdf(){
  if(!viewDoc)return toast('Dokumen belum tersedia.');
  if(viewDoc.file){
    const u=URL.createObjectURL(viewDoc.file),a=document.createElement('a');a.href=u;a.download=viewDoc.filename||'manual.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);
  }else if(viewDoc.remoteURL){window.open(viewDoc.remoteURL,'_blank','noopener,noreferrer');toast('PDF cloud dibuka di tab baru. Gunakan menu download browser.');}
}
async function makeViewedOffline(){
  if(!viewDoc)return toast('Buka dokumen dahulu.');
  const d=viewDoc,btn=$('viewerOffline');btn.disabled=true;btn.textContent='Menyimpan…';
  try{
    const blob=d.file||await fetchCloudPDF(d,(done,total)=>{btn.textContent=total?'Download '+Math.floor(done/total*100)+'%':'Download '+(done/1048576).toFixed(1)+' MB'});
    await storeOffline(d,blob);
    d.file=blob;btn.hidden=true;
    toast('Make Offline berhasil. Uji PDF kembali dengan Airplane Mode.');
  }catch(e){toast('Make Offline gagal: '+cloudMessage(e))}
  finally{btn.disabled=false;btn.textContent='↓ Make Offline'}
}
async function actions(e){const button=e.target.closest('[data-act]');if(!button)return;const d=merged().find(x=>x.id===button.dataset.id);if(!d)return;const action=button.dataset.act;try{if(action==='preview'||action==='open')return await openDoc(d);if(action==='details')return alert(`AIRCRAFT: ${d.aircraft}\nTYPE: ${kinds[d.kind]}\nTITLE: ${d.title}\nREVISION: ${d.revision}\nEFFECTIVE: ${d.effective}\nLOCAL: ${d.local?'YES':'NO'}\n${d.bytes?'SIZE: '+(d.bytes/1048576).toFixed(2)+' MB':''}\n\nPeriksa selalu status revisi melalui document control.`);if(action==='download'){button.disabled=true;button.textContent='Menyimpan offline…';await downloadDoc(d);return toast('Make Offline berhasil. PDF tersimpan pada perangkat ini. Uji saat mode pesawat.')};if(action==='removeLocal'){if(!confirm('Hapus salinan offline '+d.title+' dari perangkat ini?'))return;await tx('readwrite',s=>s.delete(d.id));await localReload();return toast('Salinan lokal dihapus.')};if(action==='removeCloud'){if(!isAdmin||!confirm('Tarik manual ini dari katalog pusat? Salinan pada perangkat pilot lain tidak otomatis terhapus.'))return;await fb.fs.updateDoc(fb.fs.doc(fb.store,'manuals',d.id),{active:false,withdrawnAt:fb.fs.serverTimestamp()});await refreshCloud();return toast('Ditarik dari katalog pusat. Beritahu pilot agar menghapus arsip lama.')}}catch(err){console.error(err);toast(err.message)}finally{render()}}
async function init(){planes.forEach(([v,l])=>{$('aircraft').add(new Option(l,v));if(v!=='ALL')$('plane').add(new Option(l,v))});db=await idb();await localReload();connection();if('serviceWorker'in navigator&&location.protocol!=='file:'){try{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;$('shellStatus').textContent='App shell siap untuk offline (pastikan uji buka ulang dengan mode pesawat).'}catch(e){$('shellStatus').textContent='Service Worker belum siap: '+e.message}}else $('shellStatus').textContent='Gunakan HTTPS (misalnya GitHub Pages) untuk instalasi PWA dan offline.';
  $('search').oninput=render;$('aircraft').onchange=render;$('docs').onclick=actions;$('tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('selected',x===b));render()};
  $('syncAll').onclick=downloadAll;$('signIn').onclick=()=>{if(!fb){toast('Firebase belum siap. Periksa konfigurasi dan koneksi.');return}modal('loginModal',true)};$('signOut').onclick=()=>fb&&fb.auth.signOut(fb.authObj);$('showPass').onchange=e=>$('password').type=e.target.checked?'text':'password';$('loginForm').onsubmit=async e=>{e.preventDefault();if(loggingIn)return;loggingIn=true;$('loginSubmit').disabled=true;try{await fb.auth.signInWithEmailAndPassword(fb.authObj,$('email').value.trim(),$('password').value);$('password').value='';modal('loginModal',false);toast('Login berhasil. Sinkronisasi katalog sedang berlangsung.')}catch(err){toast('Login gagal: '+err.message)}finally{loggingIn=false;$('loginSubmit').disabled=false}};
  $('newManual').onclick=()=>{if(!navigator.onLine)return toast('Upload membutuhkan koneksi internet.');modal('uploadModal',true)};$('adminUpload').onclick=()=>{if(!navigator.onLine)return toast('Upload membutuhkan koneksi internet.');modal('uploadModal',true)};$('uploadForm').onsubmit=publish;$('pdf').onchange=()=>{const f=$('pdf').files[0];$('pdfInfo').textContent=f?`${f.name} · ${bytesLabel(f.size)}. Lama upload tergantung jaringan; pantau progres di bawah.`:'Pilih PDF untuk upload.';$('uploadProgressWrap').hidden=true;$('uploadDiagnostic').hidden=true;$('storageCheckResult').hidden=true};$('cancelUpload').onclick=cancelCurrentUpload;$('storageCheck').onclick=checkStorageConnection;document.querySelectorAll('[data-close]').forEach(b=>{if(b.id!=='cancelUpload')b.onclick=()=>{if(b.dataset.close==='uploadModal'&&uploadBusy)return toast('Batalkan upload terlebih dahulu.');modal(b.dataset.close,false)}});$('back').onclick=closeViewer;$('viewerFullscreen').onclick=toggleViewerFullscreen;
  $('immersiveExit').onclick=toggleViewerFullscreen;
  $('immersiveToolbar').onclick=()=>{const v=$('viewer');const show=v.classList.toggle('show-menu');$('immersiveToolbar').textContent=show?'✕ Tutup':'☰ Menu'};
  $('immersivePlus').onclick=()=>{previewScale=Math.min(3,previewScale+.25);if(pdfObject)renderPdfPage(previewPage).catch(console.warn);else toast('Zoom dapat digunakan setelah PDF siap dalam pembaca interaktif.')} ;
  $('immersiveMinus').onclick=()=>{previewScale=Math.max(.5,previewScale-.25);if(pdfObject)renderPdfPage(previewPage).catch(console.warn);else toast('Zoom dapat digunakan setelah PDF siap dalam pembaca interaktif.')} ;document.addEventListener('fullscreenchange',syncViewerFullscreen);document.addEventListener('webkitfullscreenchange',syncViewerFullscreen);
  let previewResizeTimer;const resizePreview=()=>{if(!$('viewer').classList.contains('open'))return;clearTimeout(previewResizeTimer);previewResizeTimer=setTimeout(()=>{if(pdfObject&&!$('viewer').classList.contains('native'))renderPdfPage(previewPage).catch(console.warn)},170)};window.addEventListener('resize',resizePreview);
  const syncVisualViewport=()=>{const v=window.visualViewport;document.documentElement.style.setProperty('--viewer-height',(v?.height||window.innerHeight)+'px')};syncVisualViewport();window.visualViewport?.addEventListener('resize',()=>{syncVisualViewport();resizePreview()});document.addEventListener('fullscreenchange',resizePreview);document.addEventListener('webkitfullscreenchange',resizePreview);
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
  $('openNative').onclick=()=>{if(!viewDoc)return;const remote=viewDoc.remoteURL;if(remote){window.open(remote,'_blank','noopener,noreferrer');return;}if(!viewDoc.file)return toast('PDF belum siap.');const u=URL.createObjectURL(viewDoc.file),w=window.open(u,'_blank');if(!w)toast('Izinkan pop-up atau gunakan Simpan PDF.');setTimeout(()=>URL.revokeObjectURL(u),120000)};$('savePdf').onclick=savePdf;
  $('persistent').onclick=async()=>{if(!navigator.storage?.persist)return toast('Browser ini tidak mendukung persistent storage.');toast(await navigator.storage.persist()?'Persistent storage disetujui. Tetap siapkan backup.':'Belum diizinkan browser. Periksa storage dan uji offline.')};
  $('test').onclick=()=>alert('UJI SEBELUM TERBANG\n1. Buka aplikasi saat online (tanpa login).\n2. Unduh semua manual yang relevan.\n3. Pastikan status “Offline siap”.\n4. Tutup aplikasi, aktifkan Airplane Mode.\n5. Buka kembali dari ikon Home Screen.\n6. Buka setiap PDF dan cek halaman, kelengkapan, revisi.\n7. Bila gagal, gunakan sumber resmi alternatif sesuai prosedur perusahaan.');
  $('export').onclick=()=>{const data=merged().map(({file,...d})=>d);const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='TWA-manual-inventory.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)};
  $('install').onclick=requestAppInstallation;refreshInstallButton();
  window.addEventListener('online',()=>{connection();if(uploadBusy)$('uploadStatus').textContent='Koneksi kembali — Firebase melanjutkan upload…';if(!fb)loadFirebase();else if(!catalogUnsubscribe)startPublicCatalogListener()});window.addEventListener('offline',()=>{connection();if(uploadBusy)$('uploadStatus').textContent='Koneksi internet terputus — upload menunggu jaringan';});document.addEventListener('keydown',e=>{if((e.key==='f'||e.key==='F')&&$('viewer').classList.contains('open')&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();toggleViewerFullscreen();return;}if(e.key==='Escape'){if(document.fullscreenElement===$('viewer')||document.webkitFullscreenElement===$('viewer'))return;if($('viewer').classList.contains('focus-mode')){$('viewer').classList.remove('focus-mode');syncViewerFullscreen();return;}closeViewer();if(!uploadBusy)modal('uploadModal',false);modal('loginModal',false)}});await loadFirebase();
}
init().catch(e=>{console.error(e);$('docs').innerHTML='<div class="empty">Tidak dapat menggunakan penyimpanan browser. Gunakan mode browser biasa (bukan Private), aktifkan penyimpanan situs, kemudian coba kembali.</div>'});
