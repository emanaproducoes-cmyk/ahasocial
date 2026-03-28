// AHA Social Planning — app.js v3.3
const APP = { user:null, currentPage:'dashboard', charts:{}, editingId:null, unsubs:[], agendView:'lista' };

const PL  = {ig:'Instagram',fb:'Facebook',yt:'YouTube',tt:'TikTok',li:'LinkedIn',tw:'Twitter/X'};
const PSI = {ig:'si-ig',fb:'si-fb',yt:'si-yt',tt:'si-tt',li:'si-li'};
const PSH = {ig:'IG',fb:'FB',yt:'YT',tt:'TT',li:'IN',tw:'X'};
const SL  = {pending:'Em Análise',approved:'Aprovado',rejected:'Rejeitado',scheduled:'Agendado',draft:'Rascunho'};
const SB  = {pending:'badge-yellow',approved:'badge-green',rejected:'badge-red',scheduled:'badge-blue',draft:'badge-gray'};
const TEMO= {image:'📸',video:'🎬',story:'📱',reel:'🎵',carousel:'🎠'};

document.addEventListener('DOMContentLoaded', () => {
  if (new URLSearchParams(window.location.search).get('approval')) { setupApprovalPage(); return; }
  initFirebase();
  AUTH.onAuthChange(fbUser => {
    if (fbUser) {
      const name=fbUser.displayName||fbUser.email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      APP.user={uid:fbUser.uid,email:fbUser.email,name,avatar:name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(),photo:fbUser.photoURL,role:'Gerente de Conteúdo'};
      localStorage.setItem('aha_user',JSON.stringify(APP.user));showApp();
    } else { const saved=getSavedUser(); if(saved){APP.user=saved;showApp();} }
  });
});

function getSavedUser(){try{return JSON.parse(localStorage.getItem('aha_user'));}catch{return null;}}

async function doLogin(){
  const email=v('loginEmail')?.trim(),pass=v('loginPass');
  if(!email){toast('Informe seu e-mail.','warning');return;}
  if(!pass||pass.length<6){toast('Senha com 6+ caracteres.','warning');return;}
  if(_firebaseReady){const u=await AUTH.loginEmail(email,pass);if(!u){toast('E-mail ou senha incorretos.','error');return;}}
  else{const name=email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());APP.user={email,name,avatar:name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(),role:'Gerente de Conteúdo'};localStorage.setItem('aha_user',JSON.stringify(APP.user));toast('Bem-vindo!','warning');showApp();}
}
async function doGoogleLogin(){
  if(_firebaseReady){const u=await AUTH.loginGoogle();if(!u)toast('Erro no Google login.','error');}
  else{APP.user={email:'usuario@gmail.com',name:'Usuário Google',avatar:'UG',role:'Gerente de Conteúdo'};localStorage.setItem('aha_user',JSON.stringify(APP.user));showApp();}
}
function doLogout(){
  APP.unsubs.forEach(u=>{try{u();}catch{}});APP.unsubs=[];
  localStorage.removeItem('aha_user');APP.user=null;
  el('loginPage').style.display='flex';el('app').style.display='none';
  try{AUTH.logout();}catch{}
}
function showApp(){
  el('loginPage').style.display='none';el('app').style.display='block';
  const u=APP.user;
  setText('topAvatar',u.avatar||'U');setText('sideAvatar',u.avatar||'U');setText('sideUserName',u.name||'Usuário');
  if(u.photo){['topAvatar','sideAvatar'].forEach(id=>{const e=el(id);if(e){e.style.backgroundImage=`url(${u.photo})`;e.style.backgroundSize='cover';e.textContent='';e.title=u.name;}});}
  if(!_firebaseReady)setTimeout(()=>toast('⚠️ Modo local — configure Firebase para multi-usuário.','warning'),1500);
  if(!LOCAL.get('posts').length)seed();
  startListeners();initApp();
  setInterval(()=>updateBadges(),5000);
}

function seed(){
  LOCAL.set('posts',[
    {id:'p1',title:'Black Friday 2026',status:'approved',platform:'ig',type:'image',date:'2026-03-25',caption:'A maior promoção! Até 60% OFF. 🛒🔥',campaign:'Black Friday 2026',tags:'promoção,oferta',thumb:'🛒',fileUrl:null,fileType:'image',createdAt:'2026-03-25T10:00:00Z'},
    {id:'p2',title:'Stories — Lançamento X',status:'pending',platform:'ig',type:'story',date:'2026-03-27',caption:'Algo novo está chegando! 👀✨',campaign:'Lançamento X',tags:'novo,teaser',thumb:'👀',fileUrl:null,fileType:'image',createdAt:'2026-03-27T09:00:00Z'},
    {id:'p3',title:'TikTok — Trend Dance',status:'pending',platform:'tt',type:'video',date:'2026-03-29',caption:'A trend mais quente! 🕺🎵',campaign:'TikTok Orgânico',tags:'trend,viral',thumb:'🕺',fileUrl:null,fileType:'image',createdAt:'2026-03-29T16:00:00Z'},
  ]);
  LOCAL.set('accounts',[{id:'a1',name:'AHA Publicità',handle:'@ahapublicita',platform:'ig',followers:'48.2K',followersNum:48200,engagement:'4.8%',posts:342,status:'active',igConnected:false,createdAt:'2026-01-01T00:00:00Z'}]);
  LOCAL.set('campaigns',[{id:'c1',name:'Black Friday 2026',status:'active',start:'2026-03-01',end:'2026-03-31',budget:'R$ 15.000',posts:3,approved:1,pending:2,rejected:0,platforms:'ig,fb,tt',desc:'Foco em conversão.',createdAt:'2026-03-01T00:00:00Z'}]);
}

function initApp(){updateBadges();renderDashboard();}
function startListeners(){
  APP.unsubs.forEach(u=>{try{u();}catch{}});APP.unsubs=[];
  APP.unsubs.push(DB.listen('posts',posts=>{LOCAL.set('posts',posts);updateBadges();if(['posts','analise','aprovados','rejeitados','agendamentos','dashboard'].includes(APP.currentPage))renderPage(APP.currentPage);}));
  APP.unsubs.push(DB.listen('accounts',accounts=>{LOCAL.set('accounts',accounts);updateBadges();if(APP.currentPage==='contas')renderContas();}));
  APP.unsubs.push(DB.listen('campaigns',camps=>{LOCAL.set('camps',camps);if(APP.currentPage==='campanhas')renderCampanhas();}));
}

function showPage(page,btn){
  document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
  const sec=el('sec-'+page);if(sec)sec.classList.add('active');
  if(btn)btn.classList.add('active');
  APP.currentPage=page;
  const titles={dashboard:'Dashboard',contas:'Contas',agendamentos:'Agendamentos',posts:'Posts',analise:'Em Análise',aprovados:'Aprovados',rejeitados:'Rejeitados',campanhas:'Campanhas',trafego:'Tráfego Pago'};
  setText('pageTitle',titles[page]||page);
  if(window.innerWidth<960)el('sidebar').classList.remove('mobile-open');
  renderPage(page);
}
function renderPage(page){
  const r={dashboard:renderDashboard,contas:renderContas,agendamentos:renderAgendamentos,posts:()=>renderGrid('posts-grid',LOCAL.get('posts')),analise:()=>renderGrid('analise-grid',LOCAL.get('posts').filter(p=>p.status==='pending')),aprovados:()=>renderGrid('aprovados-grid',LOCAL.get('posts').filter(p=>p.status==='approved')),rejeitados:()=>renderGrid('rejeitados-grid',LOCAL.get('posts').filter(p=>p.status==='rejected')),campanhas:renderCampanhas,trafego:renderTrafego};
  if(r[page])r[page]();
}
function goHome(){showPage('dashboard',document.querySelector('[onclick*="dashboard"]'));}
function toggleMobile(){el('sidebar').classList.toggle('mobile-open');}
function updateBadges(){
  const posts=LOCAL.get('posts'),accs=LOCAL.get('accounts');
  setSafe('badge-contas',accs.length);
  setSafe('badge-analise',posts.filter(p=>p.status==='pending').length);
  setSafe('badge-rejeitados',posts.filter(p=>p.status==='rejected').length);
}

// ── Thumbnails ────────────────────────────────────────────────
function getFileUrl(p){if(!p)return null;if(p.fileUrl&&p.fileUrl.length>5)return p.fileUrl;return null;}
function isVideo(p){return p.fileType==='video'||(p.fileUrl&&p.fileUrl.startsWith('data:video'));}
function thumbBg(p){
  const url=getFileUrl(p);
  if(url){if(isVideo(p))return`<div style="position:absolute;inset:0;background:#000;display:flex;align-items:center;justify-content:center;font-size:32px;">▶️</div>`;return`<div style="position:absolute;inset:0;background-image:url('${encodeURI(url)}');background-size:cover;background-position:center;"></div>`;}
  return`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:40px;background:linear-gradient(135deg,var(--surface2),var(--surface3));">${p.thumb||'📷'}</div>`;
}
function thumbInline(p,size=36){
  const url=getFileUrl(p);
  if(url&&!isVideo(p))return`<img src="${url}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:6px;vertical-align:middle;flex-shrink:0;" loading="lazy" onerror="this.style.display='none'"/>`;
  return`<span style="font-size:${Math.round(size*.7)}px;vertical-align:middle;flex-shrink:0;">${isVideo(p)?'🎬':(p.thumb||'📷')}</span>`;
}
function thumbFull(p){
  const url=getFileUrl(p);
  if(url){if(isVideo(p))return`<video src="${url}" controls style="width:100%;max-height:280px;background:#000;border-radius:var(--radius);display:block;"></video>`;return`<img src="${url}" style="width:100%;max-height:280px;object-fit:contain;border-radius:var(--radius);background:var(--surface2);display:block;" loading="lazy"/>`;}
  return`<div style="height:140px;display:flex;align-items:center;justify-content:center;font-size:64px;background:var(--surface2);border-radius:var(--radius);">${p.thumb||'📷'}</div>`;
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard(){
  const posts=LOCAL.get('posts');
  setText('kpi-total',posts.length);setText('kpi-approved',posts.filter(p=>p.status==='approved').length);
  setText('kpi-pending',posts.filter(p=>p.status==='pending').length);setText('kpi-rejected',posts.filter(p=>p.status==='rejected').length);
  initCharts();renderRecentTable();
}
function renderRecentTable(){
  const tbody=el('recent-posts-tbody');if(!tbody)return;
  const posts=LOCAL.get('posts').slice(0,6);
  tbody.innerHTML=posts.map(p=>`<tr onclick="openPostDetail('${p.id}')" style="cursor:pointer;"><td style="display:flex;align-items:center;gap:10px;">${thumbInline(p,32)}<span class="td-primary">${esc(p.title)}</span></td><td><span class="si ${PSI[p.platform]||''}" style="width:22px;height:22px;font-size:9px;">${PSH[p.platform]||'?'}</span></td><td><span class="badge ${SB[p.status]||'badge-gray'}">${SL[p.status]||p.status}</span></td><td class="td-mono">${p.date||'—'}</td><td><button class="btn btn-xs btn-primary" onclick="event.stopPropagation();openShareModal('${p.id}')">📤 Enviar</button></td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3);">Nenhum post ainda.</td></tr>';
}
function initCharts(){
  Object.values(APP.charts).forEach(c=>{try{c.destroy();}catch{}});APP.charts={};
  const tip={enabled:true,backgroundColor:'#0F172A',titleColor:'#fff',bodyColor:'#94A3B8',padding:12,cornerRadius:8,titleFont:{family:"'DM Sans',sans-serif",weight:'700',size:13},bodyFont:{family:"'DM Sans',sans-serif",size:12},borderColor:'#1E293B',borderWidth:1,displayColors:true,boxPadding:4};
  const g='rgba(226,232,240,0.6)',tc={font:{family:"'DM Sans',sans-serif",size:11},color:'#94A3B8'};
  const mo=['Jan','Fev','Mar','Abr','Mai','Jun','Jul'],posts=LOCAL.get('posts');
  mkC('chartEngajamento','line',{labels:mo,datasets:[{label:'Instagram',data:[4200,4800,5100,6300,5900,7200,8100],borderColor:'#F97316',backgroundColor:'rgba(249,115,22,.1)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5},{label:'Facebook',data:[2100,2400,2200,2800,2600,3100,3400],borderColor:'#1877F2',backgroundColor:'rgba(24,119,242,.07)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5},{label:'TikTok',data:[800,1200,2100,3400,2900,4100,5200],borderColor:'#555',backgroundColor:'rgba(0,0,0,.04)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5}]},{interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,position:'bottom',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip},scales:{x:{grid:{color:g},ticks:tc},y:{grid:{color:g},ticks:tc}}});
  mkC('chartPlatforms','doughnut',{labels:['Instagram','Facebook','YouTube','TikTok','LinkedIn'],datasets:[{data:[38,24,14,17,7],backgroundColor:['#F97316','#1877F2','#FF0000','#333','#0A66C2'],borderWidth:3,borderColor:'#fff',hoverBorderWidth:4}]},{cutout:'65%',plugins:{legend:{position:'right',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip}});
  mkC('chartPosts','bar',{labels:['Jan','Fev','Mar','Abr','Mai','Jun'],datasets:[{label:'Aprovados',data:[12,18,15,22,19,posts.filter(p=>p.status==='approved').length],backgroundColor:'#16A34A',borderRadius:4,borderSkipped:false},{label:'Pendentes',data:[3,5,4,7,3,posts.filter(p=>p.status==='pending').length],backgroundColor:'#D97706',borderRadius:4,borderSkipped:false},{label:'Rejeitados',data:[1,2,1,3,1,posts.filter(p=>p.status==='rejected').length],backgroundColor:'#DC2626',borderRadius:4,borderSkipped:false}]},{plugins:{legend:{position:'bottom',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12}},tooltip:tip},scales:{x:{stacked:true,grid:{display:false},ticks:tc},y:{stacked:true,grid:{color:g},ticks:tc}}});
  mkC('chartReach','line',{labels:mo,datasets:[{label:'Alcance',data:[12000,15000,13500,18000,16500,21000,24500],borderColor:'#7C3AED',backgroundColor:'rgba(124,58,237,.1)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5},{label:'Impressões',data:[18000,22000,20000,27000,24000,31000,36000],borderColor:'#F97316',backgroundColor:'rgba(249,115,22,.06)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2}]},{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip},scales:{x:{grid:{color:g},ticks:tc},y:{grid:{color:g},ticks:{...tc,callback:v=>v>=1000?(v/1000).toFixed(0)+'K':v}}}});
}
function mkC(id,type,data,options={}){const c=el(id);if(!c)return;APP.charts[id]=new Chart(c,{type,data,options:{responsive:true,maintainAspectRatio:false,...options}});}

// ── Grid de posts ─────────────────────────────────────────────
function renderGrid(cid,posts){const g=el(cid);if(!g)return;if(!posts.length){g.innerHTML=emptyS('📭','Nenhum post aqui','Crie um novo agendamento.');return;}g.innerHTML=posts.map(p=>postCard(p)).join('');}
function postCard(p){
  return`<div class="post-card" onclick="openPostDetail('${p.id}')">
    <div class="post-card-thumb" style="position:relative;overflow:hidden;">${thumbBg(p)}
      <div style="position:absolute;top:8px;left:8px;z-index:1;"><span class="si ${PSI[p.platform]||''}" style="width:22px;height:22px;font-size:9px;">${PSH[p.platform]||'?'}</span></div>
      <div style="position:absolute;top:8px;right:8px;z-index:1;"><span class="badge ${SB[p.status]||'badge-gray'}" style="font-size:9px;padding:2px 7px;">${SL[p.status]||p.status}</span></div>
    </div>
    <div class="post-card-body"><div class="post-card-title">${esc(p.title)}</div><div class="post-card-meta">${p.date||'Sem data'} · ${PL[p.platform]||p.platform}</div>${p.campaign?`<div class="post-card-meta" style="margin-top:2px;">📋 ${esc(p.campaign)}</div>`:''}</div>
    <div class="post-card-footer">
      <div style="display:flex;gap:4px;">${p.status==='pending'?`<button class="btn btn-xs btn-primary" onclick="event.stopPropagation();doChangeStatus('${p.id}','approved')">✅</button><button class="btn btn-xs btn-danger" onclick="event.stopPropagation();doChangeStatus('${p.id}','rejected')">✕</button>`:''}${p.status==='rejected'?`<button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();doChangeStatus('${p.id}','pending')">↩</button>`:''}</div>
      <div style="display:flex;gap:4px;"><button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();openPostEditor('${p.id}')">✏️</button><button class="btn btn-xs btn-primary" onclick="event.stopPropagation();openShareModal('${p.id}')">📤</button><button class="btn btn-xs btn-danger" onclick="event.stopPropagation();doDeletePost('${p.id}')">🗑️</button></div>
    </div>
  </div>`;
}

function openPostDetail(id){
  const p=LOCAL.find('posts',id);if(!p)return;
  APP.editingId=id;
  const thumbEl=el('detail-thumb');if(thumbEl)thumbEl.innerHTML=thumbFull(p);
  setText('detail-title',p.title);setText('detail-platform',PL[p.platform]||p.platform);
  setText('detail-date',p.date||'—');setText('detail-campaign',p.campaign||'—');
  setText('detail-type',p.type||'—');setText('detail-caption',p.caption||'Sem legenda.');
  const stEl=el('detail-status');if(stEl){stEl.className='badge '+(SB[p.status]||'badge-gray');stEl.textContent=SL[p.status]||p.status;}
  const tagsEl=el('detail-tags');if(tagsEl)tagsEl.innerHTML=p.tags?p.tags.split(',').filter(Boolean).map(t=>`<span class="badge badge-gray" style="margin:2px;">#${esc(t.trim())}</span>`).join(''):'—';
  openModal('modalPostDetail');
}

// ── AGENDAMENTOS — corrigido ──────────────────────────────────
function renderAgendamentos(){
  // Sincroniza botões de view com estado atual
  document.querySelectorAll('.vt-btn').forEach(b=>b.classList.remove('active'));
  const activeBtn=document.querySelector(`.vt-btn[onclick*="'${APP.agendView}'"]`);
  if(activeBtn)activeBtn.classList.add('active');
  applyAgendView(APP.agendView);
}

function setAgendView(view,btn){
  APP.agendView=view;
  document.querySelectorAll('.view-toggle .vt-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  applyAgendView(view);
}

function applyAgendView(view){
  ['lista','grade','calendario'].forEach(vi=>{const e2=el('agend-'+vi);if(e2)e2.style.display=vi===view?'block':'none';});
  const posts=LOCAL.get('posts');
  if(view==='lista')renderAgendList(posts);
  if(view==='grade'){const g=el('agend-cards');if(g)g.innerHTML=posts.length?posts.map(p=>postCard(p)).join(''):emptyS('📅','Sem posts','Crie um agendamento.');}
  if(view==='calendario')renderCalendar('agend-cal',posts);
}

// LISTA — corrigido para mostrar todos os posts
function renderAgendList(posts){
  const tbody=el('agend-list');if(!tbody)return;
  if(!posts.length){tbody.innerHTML=`<tr><td colspan="6">${emptyS('📅','Nenhum agendamento','Clique em "+ Novo Agendamento".')}</td></tr>`;return;}
  tbody.innerHTML=posts.map(p=>`
  <tr onclick="openPostDetail('${p.id}')" style="cursor:pointer;">
    <td style="display:flex;align-items:center;gap:10px;min-width:0;">${thumbInline(p,40)}<span class="td-primary" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.title)}</span></td>
    <td><span class="badge ${SB[p.status]||'badge-gray'}">${SL[p.status]||p.status}</span></td>
    <td><span class="si ${PSI[p.platform]||''}" style="width:22px;height:22px;font-size:9px;">${PSH[p.platform]||'?'}</span></td>
    <td class="td-mono">${p.date||'—'}</td>
    <td>${p.campaign?esc(p.campaign):'—'}</td>
    <td onclick="event.stopPropagation();" style="white-space:nowrap;">
      <button class="btn btn-xs btn-primary" onclick="openShareModal('${p.id}')">📤</button>
      <button class="btn btn-xs btn-secondary" onclick="openPostEditor('${p.id}')" style="margin-left:3px;">✏️</button>
      <button class="btn btn-xs btn-danger" onclick="doDeletePost('${p.id}')" style="margin-left:3px;">🗑️</button>
    </td>
  </tr>`).join('');
}

// ── Calendário ────────────────────────────────────────────────
function renderCalendar(cid,posts,yr,mo){
  const c=el(cid);if(!c)return;
  const now=new Date(),Y=yr??now.getFullYear(),M=mo??now.getMonth();
  const MN=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DN=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const fd=new Date(Y,M,1).getDay(),dim=new Date(Y,M+1,0).getDate();
  const td=now.getDate(),tm=now.getMonth(),ty=now.getFullYear();
  let h=`<div class="calendar-wrap"><div class="cal-header"><button class="btn btn-secondary btn-sm" onclick="renderCalendar('${cid}',LOCAL.get('posts'),${M===0?Y-1:Y},${M===0?11:M-1})">‹</button><div class="cal-month">${MN[M]} ${Y}</div><button class="btn btn-secondary btn-sm" onclick="renderCalendar('${cid}',LOCAL.get('posts'),${M===11?Y+1:Y},${M===11?0:M+1})">›</button></div><div class="cal-grid">${DN.map(d=>`<div class="cal-day-name">${d}</div>`).join('')}`;
  for(let i=0;i<fd;i++)h+=`<div class="cal-day other-month"></div>`;
  for(let d=1;d<=dim;d++){
    const isT=d===td&&M===tm&&Y===ty;
    const ds=`${Y}-${String(M+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dp=posts.filter(p=>p.date===ds);
    h+=`<div class="cal-day${isT?' today':''}" onclick="calClick('${cid}','${ds}')"><div class="cal-day-num">${d}</div>${dp.map(p=>{const pUrl=getFileUrl(p);return`<div class="cal-event ${p.status==='approved'?'green':p.status==='rejected'?'red':''}" onclick="event.stopPropagation();openPostDetail('${p.id}')" title="${esc(p.title)}" style="${pUrl&&!isVideo(p)?`background-image:url('${pUrl}');background-size:cover;background-position:center;min-height:24px;color:transparent;`:''}">${pUrl&&!isVideo(p)?'&nbsp;':esc(p.title.slice(0,14))+(p.title.length>14?'..':'')}</div>`;}).join('')}</div>`;
  }
  h+=`</div></div>`;c.innerHTML=h;
}
function calClick(cid,ds){if(cid==='agend-cal'){openNewAgendamento();setTimeout(()=>sv('ag-date',ds),60);}}

// ── Upload ────────────────────────────────────────────────────
function triggerFile(inputId){el(inputId)?.click();}
function onDragOver(e){e.preventDefault();e.currentTarget.classList.add('drag-over');}
function onDragLeave(e){e.currentTarget.classList.remove('drag-over');}
async function onDrop(e,previewId,dataId){e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('drag-over');const f=e.dataTransfer?.files[0];if(f)await processFile(f,previewId,dataId);}
async function onFileChange(inputId,previewId,dataId){const input=el(inputId);if(!input||!input.files[0])return;await processFile(input.files[0],previewId,dataId);input.value='';}
async function processFile(file,previewId,dataId){
  const isImg=file.type.startsWith('image/'),isVid=file.type.startsWith('video/');
  if(!isImg&&!isVid){toast('Use PNG, JPG, GIF ou MP4.','warning');return;}
  const prev=el(previewId),dataEl=el(dataId);
  if(prev)prev.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:160px;gap:12px;"><div class="upload-spinner"></div><div style="font-size:12px;color:var(--text3);">Processando...</div></div>`;
  try{
    if(isImg){const compressed=await compressImage(file);if(dataEl)dataEl.value=compressed;if(prev)prev.innerHTML=`<img src="${compressed}" style="width:100%;height:160px;object-fit:cover;border-radius:var(--radius);display:block;"/>`;toast(`✅ ${file.name} carregado!`,'success');}
    else{const thumb=await videoThumbnail(file);if(dataEl)dataEl.value=JSON.stringify({thumb,type:'video',name:file.name,isVideo:true});if(prev)prev.innerHTML=`<div style="position:relative;height:160px;background:#000;border-radius:var(--radius);overflow:hidden;"><img src="${thumb}" style="width:100%;height:100%;object-fit:cover;opacity:.7;"/><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:36px;">▶️</div></div>`;toast(`✅ Vídeo "${file.name}" carregado!`,'success');}
  }catch(e){toast('Erro: '+e.message,'error');if(prev)prev.innerHTML=`<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Arraste ou clique</div><div class="upload-zone-sub">PNG, JPG, MP4 — máx. 15MB</div>`;}
}
function compressImage(file){
  return new Promise((resolve,reject)=>{
    if(file.size>15*1024*1024){reject(new Error('Máx. 15MB.'));return;}
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{const MAX=900;let w=img.width,h=img.height;if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',0.78));};
    img.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));img.src=url;
  });
}
function videoThumbnail(file){
  return new Promise(resolve=>{
    const video=document.createElement('video'),url=URL.createObjectURL(file);
    video.onloadeddata=()=>{video.currentTime=0.5;};
    video.onseeked=()=>{const canvas=document.createElement('canvas');canvas.width=Math.min(video.videoWidth,800);canvas.height=Math.round(video.videoHeight*(canvas.width/video.videoWidth));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',0.7));};
    video.onerror=()=>{URL.revokeObjectURL(url);resolve('');};video.src=url;video.load();
  });
}

// ── NOVO AGENDAMENTO ──────────────────────────────────────────
function openNewAgendamento(){
  APP.editingId=null;
  ['ag-title','ag-date','ag-caption','ag-tags'].forEach(id=>sv(id,''));
  sv('ag-platform','ig');sv('ag-status','pending');sv('ag-campaign','');
  const prev=el('ag-file-preview');
  if(prev)prev.innerHTML=`<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Arraste ou clique para selecionar</div><div class="upload-zone-sub">PNG, JPG, MP4 — máx. 15MB</div>`;
  sv('ag-file-data','');
  resetTipoBtns();
  setText('modalAgendTitulo','📅 Novo Agendamento');
  openModal('modalAgendamento');
}

// ── EDITAR — corrigido: preenche TODOS os campos corretamente ─
function openPostEditor(id){
  const p=LOCAL.find('posts',id);
  if(!p){toast('Post não encontrado.','error');return;}
  APP.editingId=id;

  // Preenche todos os campos
  sv('ag-title', p.title||'');
  sv('ag-platform', p.platform||'ig');
  sv('ag-date', p.date||'');
  sv('ag-campaign', p.campaign||'');
  sv('ag-caption', p.caption||'');
  sv('ag-tags', p.tags||'');
  sv('ag-status', p.status||'pending');

  // Tipo de conteúdo
  document.querySelectorAll('.tipo-btn').forEach(b=>{
    b.classList.remove('active');b.style.cssText='';
    if(b.dataset.tipo===(p.type||'image')){b.classList.add('active');b.style.cssText='border-color:var(--primary);background:var(--primary-light);color:var(--primary);';}
  });

  // Preview do arquivo existente
  const prev=el('ag-file-preview');
  const url=getFileUrl(p);
  if(url&&prev){
    if(isVideo(p))prev.innerHTML=`<div style="position:relative;height:160px;background:#000;border-radius:var(--radius);overflow:hidden;display:flex;align-items:center;justify-content:center;"><div style="font-size:48px;">▶️</div><div style="position:absolute;bottom:6px;left:0;right:0;text-align:center;color:#fff;font-size:11px;">Vídeo carregado</div></div>`;
    else prev.innerHTML=`<img src="${url}" style="width:100%;height:160px;object-fit:cover;border-radius:var(--radius);display:block;" onerror="this.parentNode.innerHTML='<div style=\\'height:160px;display:flex;align-items:center;justify-content:center;font-size:40px;\\'>${p.thumb||'📷'}</div>'"/>`;
    sv('ag-file-data', p.fileUrl||'');
  } else if(prev){
    prev.innerHTML=`<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Arraste ou clique para substituir</div><div class="upload-zone-sub">PNG, JPG, MP4 — máx. 15MB</div>`;
    sv('ag-file-data','');
  }

  setText('modalAgendTitulo','✏️ Editar Post');
  closeModal('modalPostDetail');
  openModal('modalAgendamento');
}

function resetTipoBtns(){
  document.querySelectorAll('.tipo-btn').forEach((b,i)=>{
    b.classList.remove('active');b.style.cssText='';
    if(i===0){b.classList.add('active');b.style.cssText='border-color:var(--primary);background:var(--primary-light);color:var(--primary);';}
  });
}
function selectTipo(btn){document.querySelectorAll('.tipo-btn').forEach(b=>{b.classList.remove('active');b.style.cssText='';});btn.classList.add('active');btn.style.cssText='border-color:var(--primary);background:var(--primary-light);color:var(--primary);';}

// ── SALVAR — corrigido: persiste TODOS os dados ───────────────
async function saveAgendamento(){
  const title=v('ag-title')?.trim();
  const platform=v('ag-platform');
  if(!title){toast('Informe o título. ⚠️','warning');return;}
  if(!platform){toast('Selecione a plataforma.','warning');return;}

  const tipo=document.querySelector('.tipo-btn.active')?.dataset.tipo||'image';
  const fileRaw=v('ag-file-data');
  let fileUrl=null,fileType='image';
  if(fileRaw){
    if(fileRaw.startsWith('{')){try{const fd=JSON.parse(fileRaw);fileUrl=fd.thumb||fd.url;fileType=fd.type||'image';}catch{fileUrl=fileRaw;}}
    else if(fileRaw.startsWith('data:')||fileRaw.startsWith('http')){fileUrl=fileRaw;fileType=fileRaw.startsWith('data:video')?'video':'image';}
  }

  // Se está editando, mantém o fileUrl original se não fez novo upload
  if(APP.editingId && !fileRaw){
    const original=LOCAL.find('posts',APP.editingId);
    if(original){fileUrl=original.fileUrl;fileType=original.fileType;}
  }

  const data={
    title, platform,
    date:     v('ag-date')||'',
    campaign: v('ag-campaign')?.trim()||'',
    caption:  v('ag-caption')?.trim()||'',
    tags:     v('ag-tags')?.trim()||'',
    status:   v('ag-status')||'pending',
    type:     tipo,
    fileUrl,  fileType,
    thumb:    fileUrl?null:(TEMO[tipo]||'📸'),
  };

  closeModal('modalAgendamento');

  if(APP.editingId){
    LOCAL.update('posts',APP.editingId,data);
    DB.update('posts',APP.editingId,data);
    toast('Post atualizado! ✅','success');
    APP.editingId=null;
  } else {
    LOCAL.add('posts',data);
    DB.add('posts',data);
    toast('Agendamento criado! 🗓️','success');
  }

  updateBadges();

  // Permanece no modo de visualização atual
  if(APP.currentPage==='agendamentos') applyAgendView(APP.agendView);
  else renderPage(APP.currentPage);

  updateCampaignCounts();
}

async function saveDraft(){const t=v('ag-title')?.trim()||'Rascunho '+new Date().toLocaleDateString('pt-BR');sv('ag-title',t);sv('ag-status','draft');await saveAgendamento();}

// ── DELETAR — permanece no modo atual ─────────────────────────
async function doDeletePost(id){
  const p=LOCAL.find('posts',id);if(!p||!confirm('Excluir "'+p.title+'"?'))return;
  LOCAL.remove('posts',id);DB.remove('posts',id);
  updateBadges();toast('Post excluído.','info');
  // Permanece no modo atual
  if(APP.currentPage==='agendamentos') applyAgendView(APP.agendView);
  else renderPage(APP.currentPage);
}

function doChangeStatus(id,ns){
  LOCAL.update('posts',id,{status:ns});DB.update('posts',id,{status:ns});
  updateBadges();closeModal('modalPostDetail');
  toast('Post '+({approved:'Aprovado! ✅',rejected:'Rejeitado ❌',pending:'Enviado para análise ⏳'}[ns]||ns),ns==='approved'?'success':ns==='rejected'?'error':'info');
  if(APP.currentPage==='agendamentos') applyAgendView(APP.agendView);
  else renderPage(APP.currentPage);
  updateCampaignCounts();
}
function updateCampaignCounts(){
  const posts=LOCAL.get('posts');
  LOCAL.get('campaigns').forEach(c=>{const cp=posts.filter(p=>p.campaign===c.name);const upd={posts:cp.length,approved:cp.filter(p=>p.status==='approved').length,pending:cp.filter(p=>p.status==='pending').length,rejected:cp.filter(p=>p.status==='rejected').length};LOCAL.update('campaigns',c.id,upd);DB.update('campaigns',c.id,upd);});
}

// ── SHARE — abre nova aba ─────────────────────────────────────
function openShareModal(id){
  const p=LOCAL.find('posts',id);if(!p)return;
  const link=window.location.origin+window.location.pathname.replace('index.html','')+'?approval='+id;
  sv('share-link-input',link);
  el('share-wa').href=`https://wa.me/?text=${encodeURIComponent('Olá! Segue o link para aprovação do criativo:\n\n*'+p.title+'*\n\n'+link+'\n\nAguardo seu retorno! 🙏')}`;
  el('share-email').href=`mailto:?subject=Aprovação de Criativo — ${encodeURIComponent(p.title)}&body=${encodeURIComponent('Olá!\n\nPor favor acesse o link abaixo para revisar o criativo:\n\n'+link+'\n\nAguardo seu retorno.\n\nAHA Social Planning')}`;
  openModal('modalShare');
}
function copyLink(){const val=v('share-link-input');if(!val)return;navigator.clipboard?.writeText(val).then(()=>toast('Link copiado! 📋','success'));}
function openApprovalTab(){const link=v('share-link-input');if(link)window.open(link,'_blank','noopener');}

// ── PÁGINA DE APROVAÇÃO — responsiva, persiste, retorna dados ─
function setupApprovalPage(){
  const id=new URLSearchParams(window.location.search).get('approval');
  if(!id)return;

  document.addEventListener('DOMContentLoaded',()=>{
    // Esconde tudo exceto a página de aprovação
    document.querySelectorAll('#loginPage,#app').forEach(e=>{if(e)e.style.display='none';});
    const appEl=el('approvalPage');
    if(appEl)appEl.style.display='block';

    initFirebase();

    const loadPost=async()=>{
      let p=LOCAL.find('posts',id);
      if(!p&&_firebaseReady){try{p=await FS.get('posts',id);}catch{}}

      if(!p){
        if(appEl)appEl.innerHTML=`<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,#FFF7ED,#F8FAFC);"><div style="text-align:center;max-width:400px;background:#fff;border-radius:16px;padding:40px;box-shadow:0 20px 40px rgba(0,0,0,.1);"><div style="font-size:48px;margin-bottom:16px;">😕</div><h2 style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:8px;">Post não encontrado</h2><p style="color:#64748B;font-size:14px;">Este link pode ter expirado ou o post foi removido.</p></div></div>`;
        return;
      }

      window._approvalId=id;
      window._approvalPost=p;

      // Preenche thumbnail
      const thumbEl=el('ap-thumb');
      if(thumbEl){
        const url=getFileUrl(p);
        if(url&&!isVideo(p))thumbEl.innerHTML=`<img src="${url}" style="width:100%;max-height:400px;object-fit:contain;display:block;"/>`;
        else if(url&&isVideo(p))thumbEl.innerHTML=`<video src="${url}" controls style="width:100%;max-height:400px;display:block;background:#000;"></video>`;
        else thumbEl.innerHTML=`<div style="font-size:80px;padding:40px;text-align:center;">${p.thumb||'📷'}</div>`;
      }

      setText('ap-title',p.title);
      setText('ap-platform',PL[p.platform]||p.platform);
      setText('ap-date',p.date||'—');
      setText('ap-campaign',p.campaign||'—');
      setText('ap-caption',p.caption||'Sem legenda.');

      const stEl=el('ap-status');
      if(stEl){stEl.className='badge '+(SB[p.status]||'badge-gray');stEl.textContent=SL[p.status]||p.status;}

      // Mostra comentário anterior se existir
      if(p.clientComment){
        const commentEl=el('ap-comment');
        if(commentEl)commentEl.value=p.clientComment;
      }

      // Se já foi revisado, mostra o estado
      if(p.status!=='pending'&&p.status!=='draft'){
        showApprovalResult(p.status);
      }
    };

    loadPost();
  });
}

function showApprovalResult(status){
  const resultDiv=el('ap-result');
  if(!resultDiv)return;
  const configs={
    approved:{bg:'#F0FDF4',color:'#16A34A',icon:'✅',text:'Este criativo foi aprovado!'},
    rejected:{bg:'#FEF2F2',color:'#DC2626',icon:'❌',text:'Este criativo foi rejeitado.'},
    pending: {bg:'#FFFBEB',color:'#D97706',icon:'⚠️',text:'Correção solicitada.'},
  };
  const cfg=configs[status]||configs.pending;
  resultDiv.style.cssText=`display:block;text-align:center;padding:20px;margin-top:16px;border-radius:10px;background:${cfg.bg};`;
  resultDiv.innerHTML=`<div style="font-size:36px;margin-bottom:8px;">${cfg.icon}</div><div style="font-size:15px;font-weight:700;color:${cfg.color};">${cfg.text}</div>`;
}

async function approvalAction(action){
  const id=window._approvalId;if(!id)return;
  const ns={approve:'approved',reject:'rejected',correct:'pending'}[action];
  const comment=v('ap-comment')||'';

  // Salva localmente e no Firebase
  const updateData={status:ns,clientComment:comment,reviewedAt:new Date().toISOString(),reviewAction:action};
  LOCAL.update('posts',id,updateData);
  await DB.update('posts',id,updateData);

  // Atualiza o badge de status na página
  const stEl=el('ap-status');
  if(stEl){stEl.className='badge '+(action==='approve'?'badge-green':action==='reject'?'badge-red':'badge-yellow');stEl.textContent=action==='approve'?'✅ Aprovado':action==='reject'?'❌ Rejeitado':'⚠️ Correção Solicitada';}

  // Mostra resultado visual
  showApprovalResult(ns);

  // Toast de confirmação
  toast({approve:'✅ Criativo aprovado! O time foi notificado.',reject:'❌ Criativo rejeitado. O time foi notificado.',correct:'⚠️ Correção solicitada. O time foi notificado.'}[action]||'Resposta registrada!',action==='approve'?'success':action==='reject'?'error':'warning');

  // Desabilita botões de ação mas mantém a página
  document.querySelectorAll('.approval-actions button').forEach(b=>{b.disabled=true;b.style.opacity='.5';});
}

async function saveApprovalComment(){
  const id=window._approvalId;if(!id)return;
  const comment=v('ap-comment')||'';
  if(!comment.trim()){toast('Digite um comentário antes de salvar.','warning');return;}
  LOCAL.update('posts',id,{clientComment:comment,commentSavedAt:new Date().toISOString()});
  await DB.update('posts',id,{clientComment:comment,commentSavedAt:new Date().toISOString()});
  toast('💬 Comentário salvo e enviado ao time!','success');
}

// ── Contas ────────────────────────────────────────────────────
function renderContas(){
  const accounts=LOCAL.get('accounts'),grid=el('accountsGrid');if(!grid)return;
  if(!accounts.length){grid.innerHTML=emptyS('🔗','Nenhuma conta','Clique em "+ Nova Conta".');return;}
  const bgMap={ig:'radial-gradient(circle at 30% 107%,#fdf497,#fd5949 45%,#d6249f 60%,#285AEB)',fb:'#1877F2',yt:'#FF0000',tt:'#111',li:'#0A66C2',tw:'#1DA1F2'};
  grid.innerHTML=accounts.map(acc=>`<div class="account-card"><div class="account-card-head"><div class="account-avatar" style="background:${bgMap[acc.platform]||'#888'};color:#fff;font-size:14px;font-weight:800;">${PSH[acc.platform]||'?'}</div><div class="account-info"><div class="account-name">${esc(acc.name)}</div><div class="account-handle">${esc(acc.handle)}</div></div><span class="badge ${acc.status==='active'?'badge-green':'badge-gray'}">${acc.status==='active'?'Ativo':'Inativo'}</span></div><div class="account-stats"><div class="account-stat"><div class="account-stat-val">${acc.followers||'0'}</div><div class="account-stat-label">Seguidores</div></div><div class="account-stat"><div class="account-stat-val">${acc.engagement||'—'}</div><div class="account-stat-label">Engajamento</div></div><div class="account-stat"><div class="account-stat-val">${acc.posts||0}</div><div class="account-stat-label">Posts</div></div><div class="account-stat"><div class="account-stat-val">${PL[acc.platform]||acc.platform}</div><div class="account-stat-label">Plataforma</div></div></div>${acc.platform==='ig'?`<div style="padding:10px 20px;border-top:1px solid var(--border);">${acc.igConnected?`<div style="font-size:12px;color:var(--green);font-weight:600;">✅ Instagram conectado</div>`:`<button class="btn btn-sm btn-primary" style="width:100%;justify-content:center;" onclick="openModal('modalIgSetup')">🔗 Conectar Instagram via API</button>`}</div>`:''}<div class="account-card-footer"><button class="btn btn-sm btn-danger" onclick="doRemoveAccount('${acc.id}')">🗑️ Remover</button><div style="display:flex;gap:6px;"><button class="btn btn-sm btn-secondary" onclick="editAccount('${acc.id}')">✏️ Editar</button><button class="btn btn-sm btn-primary" onclick="doSyncAccount('${acc.id}')">🔄 Sync</button></div></div></div>`).join('');
}
async function doSyncAccount(id){const a=LOCAL.find('accounts',id);if(!a)return;toast('Sincronizando...','info');await new Promise(r=>setTimeout(r,1200));const upd={posts:(a.posts||0)+Math.floor(Math.random()*5)+1};LOCAL.update('accounts',id,upd);DB.update('accounts',id,upd);renderContas();toast(a.name+' sincronizado! ✅','success');}
async function doRemoveAccount(id){const a=LOCAL.find('accounts',id);if(!a||!confirm('Remover "'+a.name+'"?'))return;LOCAL.remove('accounts',id);DB.remove('accounts',id);updateBadges();renderContas();toast('Conta removida.','info');}
function editAccount(id){const a=LOCAL.find('accounts',id);if(!a)return;APP.editingId=id;sv('acc-platform',a.platform);sv('acc-handle',a.handle.replace('@',''));sv('acc-name',a.name);sv('acc-followers',a.followersNum||0);sv('acc-engagement',a.engagement||'');setText('modalContaTitle','✏️ Editar Conta');openModal('modalConta');}
function openNewConta(){APP.editingId=null;['acc-handle','acc-name','acc-followers','acc-engagement'].forEach(id=>sv(id,''));sv('acc-platform','ig');setText('modalContaTitle','🔗 Conectar Nova Conta');openModal('modalConta');}
async function saveAccount(){
  const platform=v('acc-platform'),handle=v('acc-handle')?.trim();const name=v('acc-name')?.trim()||('AHA '+(PL[platform]||platform));const followersN=parseInt(v('acc-followers'))||0,engagement=v('acc-engagement')?.trim()||'0%';
  if(!platform||!handle){toast('Preencha plataforma e @usuário.','warning');return;}
  const data={name,handle:handle.startsWith('@')?handle:'@'+handle,platform,followers:followersN>=1000?(followersN/1000).toFixed(1)+'K':String(followersN),followersNum:followersN,engagement,posts:0,status:'active',igConnected:false};
  closeModal('modalConta');
  if(APP.editingId){LOCAL.update('accounts',APP.editingId,data);DB.update('accounts',APP.editingId,data);toast('Conta atualizada! ✅','success');APP.editingId=null;}
  else{LOCAL.add('accounts',data);DB.add('accounts',data);toast('Conta conectada! 🔗','success');}
  updateBadges();renderContas();
}

// ── Campanhas ─────────────────────────────────────────────────
function renderCampanhas(){
  const camps=LOCAL.get('campaigns'),cont=el('campanhas-list');if(!cont)return;
  const SLc={active:'Ativa',paused:'Pausada',ended:'Encerrada'},SBc={active:'badge-green',paused:'badge-yellow',ended:'badge-gray'};
  cont.innerHTML=camps.map(c=>{const prog=c.posts?Math.round((c.approved/c.posts)*100):0;const plats=(c.platforms||'').split(',').filter(Boolean);return`<div class="chart-card" style="margin-bottom:14px;"><div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;"><div><div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:3px;">${esc(c.name)}</div><div style="font-size:12px;color:var(--text3);">📅 ${c.start||'—'} → ${c.end||'—'}</div>${c.desc?`<div style="font-size:12px;color:var(--text3);margin-top:2px;">${esc(c.desc)}</div>`:''}</div><div style="display:flex;align-items:center;gap:8px;">${plats.map(pl=>`<span class="si ${PSI[pl]||''}" style="width:22px;height:22px;font-size:9px;">${PSH[pl]||'?'}</span>`).join('')}<span class="badge ${SBc[c.status]||'badge-gray'}">${SLc[c.status]||c.status}</span></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;"><div style="text-align:center;"><div style="font-size:22px;font-weight:800;font-family:'Space Grotesk',sans-serif;">${c.posts}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">Posts</div></div><div style="text-align:center;"><div style="font-size:22px;font-weight:800;color:var(--green);font-family:'Space Grotesk',sans-serif;">${c.approved}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">Aprovados</div></div><div style="text-align:center;"><div style="font-size:22px;font-weight:800;color:var(--yellow);font-family:'Space Grotesk',sans-serif;">${c.pending}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">Pendentes</div></div><div style="text-align:center;"><div style="font-size:22px;font-weight:800;font-family:'Space Grotesk',sans-serif;">${c.budget||'—'}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">Budget</div></div></div><div style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:11px;color:var(--text3);"><span>Progresso</span><span style="font-weight:700;color:${prog>=80?'var(--green)':prog>=50?'var(--yellow)':'var(--primary)'};">${prog}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${prog}%;background:${prog>=80?'var(--green)':prog>=50?'var(--yellow)':'var(--primary)'};"></div></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-sm btn-primary" onclick="editCampaign('${c.id}')">✏️ Editar</button><button class="btn btn-sm btn-secondary" onclick="exportCampReport('${c.id}')">📊 Relatório</button><button class="btn btn-sm btn-secondary" onclick="doToggleCamp('${c.id}','${c.status}')">${c.status==='active'?'⏸ Pausar':'▶ Ativar'}</button><button class="btn btn-sm btn-danger" onclick="doDeleteCamp('${c.id}')">🗑️</button></div></div>`;}).join('')||emptyS('📋','Nenhuma campanha','Crie sua primeira campanha.');
  const active=camps.filter(c=>c.status==='active').length;const tb=camps.reduce((s,c)=>{const n=parseFloat((c.budget||'0').replace(/[^\d.]/g,''));return s+n;},0);const tp=camps.reduce((s,c)=>s+c.posts,0),ta=camps.reduce((s,c)=>s+c.approved,0);
  setSafe('camp-metric-active',active);setSafe('camp-metric-budget','R$ '+(tb/1000).toFixed(0)+'K');setSafe('camp-metric-posts',tp);setSafe('camp-metric-rate',tp?Math.round((ta/tp)*100)+'%':'—');
}
function editCampaign(id){const c=LOCAL.find('campaigns',id);if(!c)return;APP.editingId=id;sv('camp-name',c.name);sv('camp-start',c.start);sv('camp-end',c.end);sv('camp-budget',c.budget);sv('camp-desc',c.desc||'');document.querySelectorAll('.camp-plat-check').forEach(cb=>cb.checked=false);(c.platforms||'').split(',').forEach(pl=>{const cb=document.querySelector('.camp-plat-check[value="'+pl+'"]');if(cb)cb.checked=true;});setText('modalCampanhaTitulo','✏️ Editar Campanha');openModal('modalCampanha');}
function openNewCampanha(){APP.editingId=null;['camp-name','camp-start','camp-end','camp-budget','camp-desc'].forEach(id=>sv(id,''));document.querySelectorAll('.camp-plat-check').forEach(c=>c.checked=false);setText('modalCampanhaTitulo','📋 Nova Campanha');openModal('modalCampanha');}
async function saveCampanha(){const name=v('camp-name')?.trim();if(!name){toast('Informe o nome.','warning');return;}const plats=[...document.querySelectorAll('.camp-plat-check:checked')].map(x=>x.value).join(',')||'ig';const data={name,start:v('camp-start'),end:v('camp-end'),budget:v('camp-budget')?.trim(),desc:v('camp-desc')?.trim(),platforms:plats,status:'active',posts:0,approved:0,pending:0,rejected:0};closeModal('modalCampanha');if(APP.editingId){LOCAL.update('campaigns',APP.editingId,data);DB.update('campaigns',APP.editingId,data);toast('Campanha atualizada! ✅','success');APP.editingId=null;}else{LOCAL.add('campaigns',data);DB.add('campaigns',data);toast('Campanha criada! 🚀','success');}renderCampanhas();}
function doToggleCamp(id,cur){const ns=cur==='active'?'paused':'active';LOCAL.update('campaigns',id,{status:ns});DB.update('campaigns',id,{status:ns});renderCampanhas();toast('Campanha '+(ns==='active'?'ativada ▶':'pausada ⏸'),'info');}
function doDeleteCamp(id){const c=LOCAL.find('campaigns',id);if(!c||!confirm('Excluir "'+c.name+'"?'))return;LOCAL.remove('campaigns',id);DB.remove('campaigns',id);renderCampanhas();toast('Campanha excluída.','info');}
function exportCampReport(id){const c=LOCAL.find('campaigns',id);if(!c)return;const prog=c.posts?Math.round((c.approved/c.posts)*100):0;const txt=`RELATÓRIO — AHA Social Planning\n${'='.repeat(50)}\nCampanha: ${c.name}\nStatus: ${c.status}\nPeríodo: ${c.start||'—'} → ${c.end||'—'}\nBudget: ${c.budget||'—'}\nPosts: ${c.posts} | Aprovados: ${c.approved} | Pendentes: ${c.pending} | Rejeitados: ${c.rejected}\nTaxa: ${prog}%\n\nGerado: ${new Date().toLocaleString('pt-BR')}\nAHA Social Planning © 2026`;dlText(txt,c.name.replace(/\s+/g,'_')+'_relatorio.txt');toast('Relatório exportado! 📊','success');}

// ── Tráfego ───────────────────────────────────────────────────
function renderTrafego(){
  ['chartTrafego','chartInvest'].forEach(id=>{if(APP.charts[id]){try{APP.charts[id].destroy();}catch{}delete APP.charts[id];}});
  const tip={enabled:true,backgroundColor:'#0F172A',titleColor:'#fff',bodyColor:'#94A3B8',padding:12,cornerRadius:8};const tc={font:{family:"'DM Sans',sans-serif",size:11},color:'#94A3B8'};
  mkC('chartTrafego','bar',{labels:['Instagram','Facebook','Google Ads','TikTok','YouTube'],datasets:[{label:'CPC (R$)',data:[1.20,0.85,2.10,0.65,1.80],backgroundColor:'#F97316',borderRadius:6,borderSkipped:false},{label:'CPM (R$)',data:[12,8,18,6,15],backgroundColor:'#7C3AED',borderRadius:6,borderSkipped:false}]},{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12}},tooltip:tip},scales:{x:{grid:{display:false},ticks:tc},y:{grid:{color:'rgba(226,232,240,.6)'},ticks:{...tc,callback:v=>'R$ '+v.toFixed(2)}}}});
  const ci=el('chartInvest');if(ci)APP.charts.chartInvest=new Chart(ci,{type:'doughnut',data:{labels:['Instagram','Facebook','Google','TikTok'],datasets:[{data:[34,23,28,15],backgroundColor:['#F97316','#1877F2','#4285F4','#333'],borderWidth:3,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{position:'right',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip}}});
}

// ── Modals ────────────────────────────────────────────────────
function openModal(id){const e=el(id);if(e){e.classList.add('open');document.body.style.overflow='hidden';}}
function closeModal(id){if(id){const e=el(id);if(e)e.classList.remove('open');}else document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));document.body.style.overflow='';APP.editingId=null;}

// ── Toast ─────────────────────────────────────────────────────
let _tq=[],_tr=false;
function toast(msg,type='info'){_tq.push({msg,type});if(!_tr)_pTQ();}
window.showToast=(m,t)=>toast(m,t);
function _pTQ(){if(!_tq.length){_tr=false;return;}_tr=true;const{msg,type}=_tq.shift(),t=el('toast');if(!t)return;t.querySelector('.toast-icon').textContent={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'}[type]||'ℹ️';t.querySelector('.toast-title').textContent=msg;t.className='toast show toast-'+type;const ln=t.querySelector('.toast-line');if(ln){ln.style.animation='none';setTimeout(()=>ln.style.animation='',10);}setTimeout(()=>{t.classList.remove('show');setTimeout(_pTQ,300);},3500);}

// ── Extras ────────────────────────────────────────────────────
function exportPostsCSV(){const ps=LOCAL.get('posts');if(!ps.length){toast('Nenhum post.','warning');return;}const h='Título,Plataforma,Status,Data,Campanha,Tipo';const rows=ps.map(p=>[p.title,p.platform,p.status,p.date,p.campaign,p.type].map(x=>'"'+(x||'').replace(/"/g,'""')+'"').join(','));const csv=[h,...rows].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download='aha_posts.csv';a.click();toast('CSV exportado! 📥','success');}

// ── Utils ─────────────────────────────────────────────────────
const el=(id)=>document.getElementById(id);
const setText=(id,val)=>{const e=el(id);if(e)e.textContent=val;};
const setSafe=(id,val)=>{const e=el(id);if(e)e.textContent=val;};
const sv=(id,val)=>{const e=el(id);if(e&&val!==undefined&&val!==null)e.value=val;};
const v=(id)=>el(id)?.value||'';
const esc=(s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const emptyS=(icon,t,s)=>`<div class="empty-state"><div class="empty-state-icon">${icon}</div><div class="empty-state-title">${t}</div><div class="empty-state-sub">${s}</div></div>`;
const dlText=(txt,fn)=>{const a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);a.download=fn;a.click();};
