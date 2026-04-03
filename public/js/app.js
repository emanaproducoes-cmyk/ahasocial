diff --git a/public/js/app.js b/public/js/app.js
index ef817c218592aa397738f8c524c0b9667e2e1066..045f1251d466a156b1e18184be5a5dee6690ee3d 100644
--- a/public/js/app.js
+++ b/public/js/app.js
@@ -928,51 +928,72 @@ function fileToBase64(file){return new Promise((resolve,reject)=>{if(file.size>1
 function compressImage(file){return new Promise((resolve,reject)=>{if(file.size>15*1024*1024){reject(new Error('Máx. 15MB.'));return;}const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const MAX=900;let w=img.width,h=img.height;if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',0.78));};img.onerror=()=>reject(new Error('Não foi possível ler.'));img.src=url;});}
 function videoThumbnail(file){return new Promise(resolve=>{const video=document.createElement('video'),url=URL.createObjectURL(file);video.onloadeddata=()=>{video.currentTime=0.5;};video.onseeked=()=>{const canvas=document.createElement('canvas');canvas.width=Math.min(video.videoWidth,800);canvas.height=Math.round(video.videoHeight*(canvas.width/video.videoWidth));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',0.7));};video.onerror=()=>{URL.revokeObjectURL(url);resolve('');};video.src=url;video.load();});}
 
 // ── Carrossel ─────────────────────────────────────────────────────
 let _carouselSlides=[];
 function initCarouselSlides(existing){_carouselSlides=existing||[];renderCarouselSlots();}
 function renderCarouselSlots(){
   const cont=el('carousel-slots');if(!cont)return;
   const maxSlides=6;
   let html=`<div style="margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><label style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--primary);color:#fff;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">📂 Adicionar Imagens/Vídeos<input type="file" accept="image/*,video/*" multiple style="display:none;" onchange="addCarouselMultiple(event)"/></label><span style="font-size:11px;color:var(--text3);" id="carousel-count-label">${_carouselSlides.length}/${maxSlides} slides</span></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">`;
   for(let i=0;i<_carouselSlides.length;i++){const s=_carouselSlides[i];const isVid=s.fileType==='video'||(s.fileUrl&&s.fileUrl.startsWith('data:video'));html+=`<div style="position:relative;border-radius:8px;overflow:hidden;border:2px solid var(--primary);box-shadow:0 2px 8px rgba(0,0,0,.08);"><div style="position:relative;height:90px;background:var(--surface2);">${isVid?`<video src="${s.fileUrl}" style="width:100%;height:90px;object-fit:cover;" muted></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><span style="font-size:20px;background:rgba(0,0,0,.5);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">▶️</span></div>`:`<img src="${s.fileUrl}" style="width:100%;height:90px;object-fit:cover;display:block;" loading="lazy"/>`}<button onclick="removeCarouselSlide(${i})" style="position:absolute;top:4px;right:4px;background:rgba(220,38,38,.9);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button><button onclick="moveCarouselSlide(${i},-1)" style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:4px;width:20px;height:18px;font-size:11px;cursor:pointer;${i===0?'opacity:.3;pointer-events:none;':''}">‹</button><button onclick="moveCarouselSlide(${i},1)" style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:4px;width:20px;height:18px;font-size:11px;cursor:pointer;${i===_carouselSlides.length-1?'opacity:.3;pointer-events:none;':''}">›</button></div><div style="font-size:9px;font-weight:700;color:var(--primary);text-align:center;padding:3px 4px;background:var(--primary-light);">${isVid?'🎬':'🖼️'} Slide ${i+1}</div></div>`;}
   for(let i=_carouselSlides.length;i<maxSlides;i++){html+=`<label style="height:110px;border:2px dashed var(--border2);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:4px;" onmouseover="this.style.borderColor='var(--primary)';this.style.background='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border2)';this.style.background=''"><span style="font-size:20px;">➕</span><span style="font-size:10px;font-weight:600;color:var(--text3);">Slide ${i+1}</span><input type="file" accept="image/*,video/*" style="display:none;" onchange="addCarouselSlide(event,${i})"/></label>`;}
   html+='</div>';cont.innerHTML=html;
   const counter=el('carousel-count');if(counter)counter.textContent=`${_carouselSlides.length}/${maxSlides} slides`;
 }
 async function addCarouselMultiple(e){
   const files=Array.from(e.target.files||[]);if(!files.length)return;
   const maxSlides=6;const available=maxSlides-_carouselSlides.length;const toProcess=files.slice(0,available);
   if(files.length>available)toast(`⚠️ Máx. ${maxSlides} slides — ${files.length-available} ignorados`,'warning');
   toast('⏳ Processando '+toProcess.length+' arquivo(s)...','info');
   for(const file of toProcess){try{let fileUrl,fileType;if(file.type.startsWith('image/')){fileUrl=await compressImage(file);fileType='image';}else{fileUrl=await fileToBase64(file).then(b=>'data:'+file.type+';base64,'+b);fileType='video';}_carouselSlides.push({fileUrl,fileType,thumb:'🖼️',caption:''});}catch(err){toast('Erro em '+file.name+': '+err.message,'error');}}
   renderCarouselSlots();toast(`✅ ${toProcess.length} slide(s) adicionados!`,'success');e.target.value='';
 }
 async function addCarouselSlide(e,idx){
   const file=e.target.files[0];if(!file)return;
-  try{let fileUrl,fileType;if(file.type.startsWith('image/')){fileUrl=await compressImage(file);fileType='image';}else{fileUrl=await fileToBase64(file).then(b=>'data:'+file.type+';base64,'+b);fileType='video';}if(idx<_carouselSlides.length){_carouselSlides[idx]={fileUrl,fileType,thumb:'🖼️',caption:'';};}else{_carouselSlides.push({fileUrl,fileType,thumb:'🖼️',caption:''});}renderCarouselSlots();toast(`✅ Slide ${idx+1} adicionado!`,'success');}catch(err){toast('Erro: '+err.message,'error');}e.target.value='';
+  try{
+    let fileUrl,fileType;
+    if(file.type.startsWith('image/')){
+      fileUrl=await compressImage(file);
+      fileType='image';
+    }else{
+      fileUrl=await fileToBase64(file).then(b=>'data:'+file.type+';base64,'+b);
+      fileType='video';
+    }
+
+    if(idx<_carouselSlides.length){
+      _carouselSlides[idx]={fileUrl,fileType,thumb:'🖼️',caption:''};
+    }else{
+      _carouselSlides.push({fileUrl,fileType,thumb:'🖼️',caption:''});
+    }
+
+    renderCarouselSlots();
+    toast(`✅ Slide ${idx+1} adicionado!`,'success');
+  }catch(err){
+    toast('Erro: '+err.message,'error');
+  }
+  e.target.value='';
 }
 function removeCarouselSlide(idx){_carouselSlides.splice(idx,1);renderCarouselSlots();}
 function moveCarouselSlide(idx,dir){const newIdx=idx+dir;if(newIdx<0||newIdx>=_carouselSlides.length)return;const tmp=_carouselSlides[idx];_carouselSlides[idx]=_carouselSlides[newIdx];_carouselSlides[newIdx]=tmp;renderCarouselSlots();}
 
 // ── Modal Agendamento ─────────────────────────────────────────────
 function openNewAgendamento(){
   APP.editingId=null;APP._saving=false;
   ['ag-title','ag-date','ag-caption','ag-tags'].forEach(id=>sv(id,''));
   sv('ag-platform','ig');sv('ag-status','pending');sv('ag-campaign','');
   const prev=el('ag-file-preview');if(prev)prev.innerHTML=`<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Arraste ou clique para selecionar</div><div class="upload-zone-sub">PNG, JPG, MP4 — máx. 15MB</div>`;
   sv('ag-file-data','');resetTipoBtns();_carouselSlides=[];toggleCarouselSection('image');renderCarouselSlots();
   setText('modalAgendTitulo','📅 Novo Agendamento');openModal('modalAgendamento');
 }
 function openPostEditor(id){
   const p=LOCAL.find('posts',id);if(!p)return;
   APP.editingId=id;APP._saving=false;
   sv('ag-title',p.title||'');sv('ag-platform',p.platform||'ig');sv('ag-date',p.date||'');
   sv('ag-campaign',p.campaign||'');sv('ag-caption',p.caption||'');sv('ag-tags',p.tags||'');sv('ag-status',p.status||'pending');
   document.querySelectorAll('.tipo-btn').forEach(b=>{b.classList.remove('active');b.style.cssText='';if(b.dataset.tipo===(p.type||'image')){b.classList.add('active');b.style.cssText='border-color:var(--primary);background:var(--primary-light);color:var(--primary);';}});
   toggleCarouselSection(p.type||'image');
   if(p.type==='carousel'&&p.slides){_carouselSlides=[...p.slides];renderCarouselSlots();}else{_carouselSlides=[];}
   const prev=el('ag-file-preview'),url=getFileUrl(p);
   if(prev&&p.type!=='carousel'){
     if(isVideo(p)){if(p.videoKey){VDB.load(p.videoKey).then(blob=>{if(blob){const src=URL.createObjectURL(blob);prev.innerHTML=`<video src="${src}" controls style="width:100%;height:160px;background:#000;border-radius:var(--radius);display:block;" preload="metadata"></video>`;}else if(url){prev.innerHTML=`<div style="position:relative;"><img src="${url}" style="width:100%;height:120px;object-fit:cover;border-radius:var(--radius);"/><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);border-radius:var(--radius);">▶️</div></div>`;}});sv('ag-file-data',JSON.stringify({vKey:p.videoKey,thumb:p.fileUrl||'',name:p.videoName||'video.mp4',type:p.videoType||'video/mp4'}));}else if(url){prev.innerHTML=`<video src="${url}" controls style="width:100%;height:160px;background:#000;border-radius:var(--radius);display:block;" preload="metadata"></video>`;sv('ag-file-data',p.fileUrl||'');}else{prev.innerHTML=`<div style="height:120px;background:#111;border-radius:var(--radius);display:flex;align-items:center;justify-content:center;font-size:36px;">🎬</div>`;sv('ag-file-data','');}}
     else if(url){prev.innerHTML=`<img src="${url}" style="width:100%;height:120px;object-fit:cover;border-radius:var(--radius);display:block;"/>`;sv('ag-file-data',p.fileUrl||'');}
