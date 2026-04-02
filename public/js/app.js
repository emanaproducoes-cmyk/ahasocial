// AHA Social Planning — app.js v5.0
const APP = {
  user:null,
  currentPage: localStorage.getItem('aha_page')||'dashboard',
  currentAccountId: null, // ID of selected account, null = all accounts
  contaSelMode: false,       // selection mode for contas page
  contaSelection: new Set(), // selected account IDs
  charts:{}, editingId:null, unsubs:[], agendView:'lista',
  selection: new Set(), // IDs of selected posts
  selMode: false, // selection mode toggle
  postsView: localStorage.getItem('aha_posts_view')||'grade', // grade | lista | calendario
  kanbanCols: (()=>{
    const COLS_V='v5';
    const DEFAULT=[
      {id:'draft',    label:'Rascunho',          color:'#64748B', icon:'📝', status:'draft'},
      {id:'content',  label:'Conteúdo',           color:'#2563EB', icon:'📋', status:'content'},
      {id:'review',   label:'Revisão',            color:'#7C3AED', icon:'👁', status:'review'},
      {id:'approval', label:'Aprovação Cliente',  color:'#D97706', icon:'⏳', status:'approval'},
      {id:'approved', label:'Aprovado',           color:'#16A34A', icon:'✅', status:'approved'},
      {id:'rejected', label:'Rejeitados',         color:'#DC2626', icon:'❌', status:'rejected'},
      {id:'published',label:'Publicado',          color:'#EA580C', icon:'🚀', status:'published'},
    ];
    try{
      const saved=JSON.parse(localStorage.getItem('aha_kanban_cols')||'null');
      // Reset if old version (missing review or rejected)
      if(!saved||localStorage.getItem('aha_kanban_v')!==COLS_V||!saved.find(c=>c.id==='review')||!saved.find(c=>c.id==='rejected')){
        localStorage.setItem('aha_kanban_cols',JSON.stringify(DEFAULT));
        localStorage.setItem('aha_kanban_v',COLS_V);
        return DEFAULT;
      }
      return saved;
    }catch{return DEFAULT;}
  })()
};

const PL  = {ig:'Instagram',fb:'Facebook',yt:'YouTube',tt:'TikTok',li:'LinkedIn',tw:'Twitter/X'};
const PSI = {ig:'si-ig',fb:'si-fb',yt:'si-yt',tt:'si-tt',li:'si-li'};
const PSH = {ig:'IG',fb:'FB',yt:'YT',tt:'TT',li:'IN',tw:'X'};
const SL  = {pending:'Em Análise',approved:'Aprovado',rejected:'Rejeitado',scheduled:'Agendado',draft:'Rascunho',review:'Em Revisão',content:'Conteúdo',approval:'Aguard. Aprovação',published:'Publicado'};
const SB  = {pending:'badge-yellow',approved:'badge-green',rejected:'badge-red',scheduled:'badge-blue',draft:'badge-gray',review:'badge-purple',content:'badge-blue',approval:'badge-yellow',published:'badge-orange'};
const TEMO= {image:'📸',video:'🎬',story:'📱',reel:'🎵',carousel:'🎠'};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('approval')) { setupApprovalPage(); return; }
  initFirebase();
  AUTH.onAuthChange(fbUser => {
    if (fbUser) {
      const name=fbUser.displayName||fbUser.email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      APP.user={uid:fbUser.uid,email:fbUser.email,name,avatar:name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(),photo:fbUser.photoURL,role:'Gerente de Conteúdo'};
      localStorage.setItem('aha_user',JSON.stringify(APP.user));showApp();
    } else {
      const saved=getSavedUser();
      if(saved){APP.user=saved;showApp();}
    }
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
  localStorage.removeItem('aha_user');
  localStorage.removeItem('aha_page');
  APP.user=null;
  APP._appShown=false;
  APP._saving=false;
  const _lp=el('loginPage');if(_lp){_lp.classList.add('visible');_lp.style.display='flex';}
  const _ap=el('app');if(_ap){_ap.classList.remove('visible');_ap.style.display='none';}
  try{AUTH.logout();}catch{}
}

function showApp(){
  // Guard: if already showing app, only refresh user avatar (avoid double init)
  const appEl=el('app');
  if(appEl&&appEl.classList.contains('visible')&&APP._appShown){
    // Just update avatar in case auth refreshed
    const u2=APP.user;
    setText('topAvatar',u2.avatar||'U');setText('sideAvatar',u2.avatar||'U');setText('sideUserName',u2.name||'Usuário');
    return;
  }
  APP._appShown=true;
  const _lp2=el('loginPage');if(_lp2){_lp2.classList.remove('visible');_lp2.style.display='none';}
  if(appEl){appEl.classList.add('visible');appEl.style.display='block';}
  const u=APP.user;
  setText('topAvatar',u.avatar||'U');setText('sideAvatar',u.avatar||'U');setText('sideUserName',u.name||'Usuário');
  if(u.photo){['topAvatar','sideAvatar'].forEach(id=>{const e=el(id);if(e){e.style.backgroundImage=`url(${u.photo})`;e.style.backgroundSize='cover';e.textContent='';e.title=u.name;}});}
  if(!_firebaseReady){
    setTimeout(()=>toast('⚠️ Sem conexão com Firebase — dados ficam apenas neste dispositivo.','error'),1200);
    if(!LOCAL.get('posts').length) seed();
  }

  // Restaura conta selecionada
  const savedAccount=localStorage.getItem('aha_activeAccount');
  if(savedAccount){
    APP.currentAccountId=savedAccount;
    const savedAcc=LOCAL.find('accounts',savedAccount);
    if(!savedAcc){ APP.currentAccountId=null; localStorage.removeItem('aha_activeAccount'); }
  }

  // Inicia listeners em tempo real (Firestore → LOCAL → render)
  startListeners();
  updateBadges();
  updateAccChip();

  const savedPage=localStorage.getItem('aha_page')||'dashboard';
  const hashPage=location.hash.replace('#','').split('&')[0]||savedPage;
  const initPage=(hashPage&&hashPage!=='posts-menu')?hashPage:savedPage;
  history.replaceState({page:initPage},'',`#${initPage}`);
  const navBtn=document.querySelector(`[onclick*="'${initPage}'"]`);

  // Se Firebase disponível, aguarda primeiro sync antes do render inicial
  // (máx 4s — depois renderiza com cache local para não travar)
  if(_firebaseReady){
    DB.waitForFirstSync(4000).then(()=>{
      showPage(initPage, navBtn, true);
    });
  } else {
    showPage(initPage, navBtn, true);
  }

  if(!APP._badgeInterval) APP._badgeInterval=setInterval(()=>updateBadges(),5000);
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

function startListeners(){
  APP.unsubs.forEach(u=>{try{u();}catch{}});APP.unsubs=[];

  // Posts: re-renderiza qualquer página que dependa de posts
  APP.unsubs.push(DB.listen('posts', posts => {
    updateBadges();
    const postPages=['posts','analise','aprovados','rejeitados','agendamentos','dashboard','workflow','revisao'];
    if(postPages.includes(APP.currentPage)) renderPage(APP.currentPage);
  }));

  // Contas: re-renderiza contas e badges
  APP.unsubs.push(DB.listen('accounts', accounts => {
    updateBadges();
    updateAccChip();
    if(APP.currentPage==='contas') renderContas();
  }));

  // Campanhas: re-renderiza campanhas
  APP.unsubs.push(DB.listen('campaigns', camps => {
    if(APP.currentPage==='campanhas') renderCampanhas();
  }));
}

// ── Navegação ─────────────────────────────────────────────────
let _navPushing=false; // guard to avoid double pushState
function showPage(page,btn,fromHistory){
  if(page==='posts-menu'){
    const sub=el('posts-submenu');
    if(sub)sub.style.display=sub.style.display==='none'?'block':'none';
    return;
  }
  document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
  const sec=el('sec-'+page);if(sec)sec.classList.add('active');
  if(btn){btn.classList.add('active');}
  else{
    // Auto-activate correct nav item
    const navBtn=document.querySelector(`[onclick*="'${page}'"]`);
    if(navBtn)navBtn.classList.add('active');
  }
  APP.currentPage=page;
  localStorage.setItem('aha_page',page);
  setTopNavActive(page);
  const titles={dashboard:'Dashboard',contas:'Contas',agendamentos:'Agendamentos',posts:'Posts',analise:'Em Análise',aprovados:'Aprovados',rejeitados:'Rejeitados',campanhas:'Campanhas',trafego:'Tráfego Pago',workflow:'Workflow',revisao:'Revisão'};
  setText('pageTitle',titles[page]||page);
  if(window.innerWidth<960)el('sidebar').classList.remove('mobile-open');
  // Push browser history only when user navigates (not from popstate)
  if(!fromHistory&&!_navPushing){
    _navPushing=true;
    history.pushState({page},'',`#${page}`);
    _navPushing=false;
  }
  renderPage(page);
  // Refresh topbar button states
  setTimeout(()=>updateBadges(),0);
}
// Handle browser back/forward
window.addEventListener('popstate',function(e){
  const page=(e.state&&e.state.page)||location.hash.replace('#','').replace('?approval=','').split('&')[0]||'dashboard';
  if(page&&page!=='posts-menu'){
    showPage(page,null,true);
  }
});
function renderPage(page){
  const r={
    dashboard:renderDashboard, contas:renderContas,
    agendamentos:renderAgendamentos,
    posts:renderPostsPage,
    analise:()=>renderGrid('analise-grid',getActivePosts().filter(p=>p.status==='pending')),
    aprovados:()=>renderGrid('aprovados-grid',getActivePosts().filter(p=>p.status==='approved')),
    rejeitados:()=>renderGrid('rejeitados-grid',getActivePosts().filter(p=>p.status==='rejected')),
    revisao:()=>renderGrid('revisao-grid',getActivePosts().filter(p=>p.status==='review')),
    campanhas:renderCampanhas, trafego:renderTrafego, workflow:renderKanban,
  };
  if(r[page])r[page]();
}

// ── Multi-Account helpers ────────────────────────────────────
function getActivePosts(){
  const posts=LOCAL.get('posts');
  if(!APP.currentAccountId)return posts;
  return posts.filter(p=>p.accountId===APP.currentAccountId);
}
function switchAccount(accountId){
  APP.currentAccountId=accountId;
  // II: Persist selected account across reload/logout
  if(accountId){localStorage.setItem('aha_activeAccount',accountId);}
  else{localStorage.removeItem('aha_activeAccount');}
  updateAccChip();
  updateBadges();
  renderPage(APP.currentPage);
  closeAccDropdown();
  // Show filter bar if account selected
  const fb=el('accFilterBar');
  if(fb){
    if(accountId){
      const acc=LOCAL.find('accounts',accountId);
      fb.classList.add('visible');
      setText('accFilterName',acc?acc.name:'');
    } else {
      fb.classList.remove('visible');
    }
  }
}
function updateAccChip(){
  const chip=el('accChip'),nameEl=el('accChipName'),subEl=el('accChipSub'),avatarEl=el('accChipAvatar');
  if(!chip)return;
  if(!APP.currentAccountId){
    if(nameEl)nameEl.textContent='Todas as Contas';
    if(subEl)subEl.textContent='Exibindo tudo';
    if(avatarEl){avatarEl.innerHTML='✦';avatarEl.style.background='linear-gradient(135deg,#F97316,#FBBF24)';}
    return;
  }
  const acc=LOCAL.find('accounts',APP.currentAccountId);
  if(!acc)return;
  const bgMap={ig:'radial-gradient(circle at 30% 107%,#fdf497,#fd5949 45%,#d6249f 60%,#285AEB)',fb:'#1877F2',yt:'#FF0000',tt:'#111',li:'#0A66C2',tw:'#1DA1F2'};
  if(nameEl)nameEl.textContent=acc.name;
  if(subEl)subEl.textContent=acc.handle;
  if(avatarEl){
    if(acc.photo){avatarEl.innerHTML=`<img src="${acc.photo}" style="width:100%;height:100%;object-fit:cover;">`;}
    else{avatarEl.textContent=(PSH[acc.platform]||acc.name[0]||'?');avatarEl.style.background=bgMap[acc.platform]||'#888';}
  }
}
function toggleAccDropdown(e){
  if(e)e.stopPropagation();
  const dd=el('accDropdown');if(!dd)return;
  if(dd.style.display==='none'||!dd.style.display){renderAccDropdown();dd.style.display='block';}
  else dd.style.display='none';
}
function closeAccDropdown(){const dd=el('accDropdown');if(dd)dd.style.display='none';}
function renderAccDropdown(){
  const dd=el('accDropdown');if(!dd)return;
  const accounts=LOCAL.get('accounts');
  const bgMap={ig:'radial-gradient(circle at 30% 107%,#fdf497,#fd5949 45%,#d6249f 60%,#285AEB)',fb:'#1877F2',yt:'#FF0000',tt:'#111',li:'#0A66C2',tw:'#1DA1F2'};
  const plat={ig:'Instagram',fb:'Facebook',yt:'YouTube',tt:'TikTok',li:'LinkedIn',tw:'Twitter'};
  let html=`<div class="acc-dropdown-header">Selecionar Conta</div>`;
  // "All accounts" option
  const isAll=!APP.currentAccountId;
  html+=`<div class="acc-dropdown-item${isAll?' active-account':''}" onclick="switchAccount(null)">
    <div class="adi-avatar" style="background:linear-gradient(135deg,#F97316,#FBBF24);">✦</div>
    <div class="adi-info"><div class="adi-name">Todas as Contas</div><div class="adi-handle">Exibindo tudo</div></div>
    ${isAll?'<span class="adi-check">✓</span>':''}
  </div>`;
  if(accounts.length){
    html+=`<div class="acc-dropdown-divider"></div><div class="acc-dropdown-header">Minhas Contas</div>`;
    html+=accounts.map(acc=>{
      const active=APP.currentAccountId===acc.id;
      const avatarContent=acc.photo?`<img src="${acc.photo}" style="width:100%;height:100%;object-fit:cover;">`:(PSH[acc.platform]||acc.name[0]);
      return `<div class="acc-dropdown-item${active?' active-account':''}" onclick="switchAccount('${acc.id}')">
        <div class="adi-avatar" style="background:${bgMap[acc.platform]||'#888'};color:#fff;">${avatarContent}</div>
        <div class="adi-info"><div class="adi-name">${acc.name}</div><div class="adi-handle">${acc.handle} · ${plat[acc.platform]||acc.platform}</div></div>
        ${active?'<span class="adi-check">✓</span>':''}
      </div>`;
    }).join('');
  }
  html+=`<div class="acc-dropdown-divider"></div><div style="padding:6px 6px 2px;"><button onclick="closeAccDropdown();showPage('contas',null)" style="width:100%;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:600;color:var(--text2);">⚙️ Gerenciar Contas</button></div>`;
  dd.innerHTML=html;
}
function setTopNavActive(page){
  document.querySelectorAll('.tbn-item').forEach(el2=>{
    el2.classList.toggle('active',el2.dataset.page===page);
  });
}
// Close dropdown on outside click
document.addEventListener('click',function(e){
  const sw=el('accSwitcher');
  if(sw&&!sw.contains(e.target))closeAccDropdown();
});

function goHome(){showPage('dashboard',document.querySelector('[onclick*="dashboard"]'));}
function toggleMobile(){el('sidebar').classList.toggle('mobile-open');}
function updateBadges(){
  const posts=getActivePosts(),accs=LOCAL.get('accounts');
  setSafe('badge-contas',accs.length);
  setSafe('badge-analise',posts.filter(p=>p.status==='pending').length);
  setSafe('badge-rejeitados',posts.filter(p=>p.status==='rejected').length);
  setSafe('badge-revisao',posts.filter(p=>p.status==='review').length);
  // Aprovados badge
  const aprovCount=posts.filter(p=>p.status==='approved').length;
  const aprovBadge=el('badge-aprovados');
  if(aprovBadge){aprovBadge.textContent=aprovCount||'';aprovBadge.style.display=aprovCount?'':'none';}
    // Update topbar nav badges
  setSafe('tbn-badge-contas',accs.length);
  setSafe('tbn-badge-analise',posts.filter(p=>p.status==='pending').length);
  setSafe('tbn-badge-rejeitados',posts.filter(p=>p.status==='rejected').length);
  setSafe('tbn-badge-revisao',posts.filter(p=>p.status==='review').length);
  const apTbn=el('tbn-badge-aprovados');
  if(apTbn){apTbn.textContent=aprovCount||'';apTbn.style.display=aprovCount?'':'none';}
  // Update acc chip in case accounts changed
  updateAccChip();
  // Sync topbar nav active state
  setTopNavActive(APP.currentPage);
  // Update selecionar button state
  const selBtn=el('btn-selecionar');
  if(selBtn){
    const pagesWithSel=['posts','agendamentos','analise','aprovados','rejeitados','revisao'];
    selBtn.style.display=pagesWithSel.includes(APP.currentPage)?'':'none';
    selBtn.style.background=APP.selMode?'var(--primary)':'';
    selBtn.style.color=APP.selMode?'#fff':'';
    selBtn.title=APP.selMode?'Cancelar seleção':'Selecionar posts';
  }
}

// ── Thumbnails ────────────────────────────────────────────────
function getFileUrl(p){
  if(!p||!p.fileUrl)return null;
  if(p.fileUrl.startsWith('{')){
    try{
      const d=JSON.parse(p.fileUrl);
      // Remote cloud URL takes priority (cross-device playback)
      if(d.url&&d.url.startsWith('http'))return d.url;
      return d.thumb||d.url||null;
    }catch{}
  }
  if(p.fileUrl.length>5)return p.fileUrl;
  return null;
}
function isVideo(p){
  if(p.fileType==='video')return true;
  if(!p.fileUrl)return false;
  if(p.fileUrl.startsWith('data:video')||p.fileUrl.startsWith('data:application/octet'))return true;
  // JSON ref with type video (cloud upload)
  if(p.fileUrl.startsWith('{')){try{const d=JSON.parse(p.fileUrl);return d.type==='video';}catch{}}
  return false;
}
function thumbBg(p){
  const url=getFileUrl(p);
  if(url){
    if(isVideo(p))return`<div style="position:absolute;inset:0;z-index:1;background:#000;display:flex;align-items:center;justify-content:center;font-size:32px;">▶️</div>`;
    // Use <img> for reliable rendering — works with both URLs and base64
    return`<img src="${url}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;" loading="lazy" onerror="this.style.display='none'"/>`;
  }
  return`<div style="position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;font-size:40px;background:linear-gradient(135deg,var(--surface2),var(--surface3));">${p.thumb||'📷'}</div>`;
}
// Carousel thumb: show first slide — uses <img> for reliable base64 rendering
function carouselThumbBg(p){
  if(!p.slides||!p.slides.length)return thumbBg(p);
  const first=p.slides[0];
  if(first.fileUrl){
    if(first.fileType==='video')
      return`<img src="${first.fileUrl.startsWith('data:video')?'':first.fileUrl}" style="display:none"/><div style="position:absolute;inset:0;background:#111;display:flex;align-items:center;justify-content:center;font-size:28px;">▶️</div>`;
    // Use <img> not background-image for reliable base64 display
    return`<img src="${first.fileUrl}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;" loading="lazy"/>`;
  }
  return`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:36px;background:linear-gradient(135deg,var(--surface2),var(--surface3));">🎠</div>`;
}

function thumbInline(p,size=36){
  // Carousel: show first slide thumbnail
  if(p.type==='carousel'&&p.slides?.length){
    const first=p.slides[0];
    if(first.fileUrl&&first.fileType!=='video'){
      return`<img src="${first.fileUrl}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:6px;vertical-align:middle;flex-shrink:0;position:relative;" loading="lazy" onerror="this.style.display='none'"/>`;
    }
    return`<span style="font-size:${Math.round(size*.7)}px;vertical-align:middle;flex-shrink:0;">${first.fileType==='video'?'🎬':'🎠'}</span>`;
  }
  const url=getFileUrl(p);
  if(url&&!isVideo(p))return`<img src="${url}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:6px;vertical-align:middle;flex-shrink:0;" loading="lazy" onerror="this.style.display='none'"/>`;
  return`<span style="font-size:${Math.round(size*.7)}px;vertical-align:middle;flex-shrink:0;">${isVideo(p)?'🎬':(p.thumb||'📷')}</span>`;
}
function thumbFull(p){
  const url=getFileUrl(p);
  // ── Video ──────────────────────────────────────────────────
  if(isVideo(p)){
    // Remote URL (Firebase Storage) → always playable cross-device
    if(p.fileUrl&&p.fileUrl.startsWith('http')){
      return`<video src="${p.fileUrl}" controls style="width:100%;max-height:280px;background:#000;border-radius:var(--radius);display:block;" preload="metadata"></video>`;
    }
    // IndexedDB key → try load from local IDB, fallback to thumbnail
    if(p.videoKey){
      const divId='vplay_'+p.id+'_'+Date.now();
      setTimeout(async()=>{
        const blob=await VDB.load(p.videoKey);
        const div=document.getElementById(divId);
        if(!div)return;
        if(blob){
          const src=URL.createObjectURL(blob);
          div.innerHTML=`<video src="${src}" controls style="width:100%;max-height:280px;background:#000;border-radius:var(--radius);display:block;" preload="metadata"></video>`;
        } else if(url){
          // Thumbnail visible, inform user video is local-only
          div.innerHTML=`<div style="position:relative;border-radius:var(--radius);overflow:hidden;"><img src="${url}" style="width:100%;max-height:280px;object-fit:cover;display:block;"/><div style="position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;"><span style="font-size:40px;">▶️</span><span style="font-size:11px;font-weight:700;color:#fff;background:rgba(0,0,0,.5);padding:4px 12px;border-radius:20px;">Vídeo disponível apenas no dispositivo original</span></div></div>`;
        } else {
          div.innerHTML=`<div style="height:140px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:36px;gap:8px;background:#111;border-radius:var(--radius);">🎬<div style="font-size:12px;color:#94A3B8;text-align:center;padding:0 16px;">Vídeo salvo localmente<br/>Faça upload via Firebase Storage para compartilhar</div></div>`;
        }
      },50);
      return`<div id="${divId}">${url?`<div style="position:relative;border-radius:var(--radius);overflow:hidden;"><img src="${url}" style="width:100%;max-height:280px;object-fit:cover;display:block;"/><div style="position:absolute;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;"><span style="font-size:52px;">▶️</span></div></div>`:`<div style="height:140px;display:flex;align-items:center;justify-content:center;font-size:48px;background:#111;border-radius:var(--radius);">🎬</div>`}</div>`;
    }
    // data:video URL in fileUrl
    if(url)return`<video src="${url}" controls style="width:100%;max-height:280px;background:#000;border-radius:var(--radius);display:block;" preload="metadata"></video>`;
    return`<div style="height:140px;display:flex;align-items:center;justify-content:center;font-size:64px;background:#111;border-radius:var(--radius);">🎬</div>`;
  }
  // ── Image ─────────────────────────────────────────────────
  if(url)return`<img src="${url}" style="width:100%;max-height:280px;object-fit:contain;border-radius:var(--radius);background:var(--surface2);display:block;" loading="lazy"/>`;
  return`<div style="height:140px;display:flex;align-items:center;justify-content:center;font-size:64px;background:var(--surface2);border-radius:var(--radius);">${p.thumb||'📷'}</div>`;
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard(){
  const posts=getActivePosts();
  setText('kpi-total',posts.length);setText('kpi-approved',posts.filter(p=>p.status==='approved').length);
  setText('kpi-pending',posts.filter(p=>p.status==='pending').length);setText('kpi-rejected',posts.filter(p=>p.status==='rejected').length);
  const kpiPlat=el('kpi-total-plat');if(kpiPlat)kpiPlat.textContent=posts.length;
  initCharts();renderRecentTable();
}
function renderRecentTable(){
  const tbody=el('recent-posts-tbody');if(!tbody)return;
  const posts=getActivePosts().slice(0,6);
  tbody.innerHTML=posts.map(p=>`<tr onclick="openPostDetail('${p.id}')" style="cursor:pointer;"><td style="display:flex;align-items:center;gap:10px;">${thumbInline(p,32)}<span class="td-primary">${esc(p.title)}</span></td><td><span class="si ${PSI[p.platform]||''}" style="width:22px;height:22px;font-size:9px;">${PSH[p.platform]||'?'}</span></td><td><span class="badge ${SB[p.status]||'badge-gray'}">${SL[p.status]||p.status}</span></td><td class="td-mono">${p.date||'—'}</td><td><button class="btn btn-xs btn-primary" onclick="event.stopPropagation();openShareModal('${p.id}')">📤 Enviar</button></td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3);">Nenhum post ainda.</td></tr>';
}
function initCharts(){
  Object.values(APP.charts).forEach(c=>{try{c.destroy();}catch{}});APP.charts={};
  const tip={enabled:true,backgroundColor:'#0F172A',titleColor:'#fff',bodyColor:'#94A3B8',padding:12,cornerRadius:8,titleFont:{family:"'Aileron',sans-serif",weight:'700',size:13},bodyFont:{family:"'Aileron',sans-serif",size:12},borderColor:'#1E293B',borderWidth:1,displayColors:true,boxPadding:4};
  const g='rgba(226,232,240,0.6)',tc={font:{family:"'Aileron',sans-serif",size:11},color:'#94A3B8'};
  const mo=['Jan','Fev','Mar','Abr','Mai','Jun','Jul'],posts=getActivePosts();
  mkC('chartEngajamento','line',{labels:mo,datasets:[{label:'Instagram',data:[4200,4800,5100,6300,5900,7200,8100],borderColor:'#F97316',backgroundColor:'rgba(249,115,22,.1)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5},{label:'Facebook',data:[2100,2400,2200,2800,2600,3100,3400],borderColor:'#1877F2',backgroundColor:'rgba(24,119,242,.07)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5},{label:'TikTok',data:[800,1200,2100,3400,2900,4100,5200],borderColor:'#555',backgroundColor:'rgba(0,0,0,.04)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5}]},{interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,position:'bottom',labels:{font:{family:"'Aileron',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip},scales:{x:{grid:{color:g},ticks:tc},y:{grid:{color:g},ticks:tc}}});
  mkC('chartPlatforms','doughnut',{labels:['Instagram','Facebook','YouTube','TikTok','LinkedIn'],datasets:[{data:[38,24,14,17,7],backgroundColor:['#F97316','#1877F2','#FF0000','#333','#0A66C2'],borderWidth:3,borderColor:'#fff',hoverBorderWidth:4}]},{cutout:'65%',plugins:{legend:{position:'right',labels:{font:{family:"'Aileron',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip}});
  mkC('chartPosts','bar',{labels:['Jan','Fev','Mar','Abr','Mai','Jun'],datasets:[{label:'Aprovados',data:[12,18,15,22,19,posts.filter(p=>p.status==='approved').length],backgroundColor:'#16A34A',borderRadius:4,borderSkipped:false},{label:'Pendentes',data:[3,5,4,7,3,posts.filter(p=>p.status==='pending').length],backgroundColor:'#D97706',borderRadius:4,borderSkipped:false},{label:'Rejeitados',data:[1,2,1,3,1,posts.filter(p=>p.status==='rejected').length],backgroundColor:'#DC2626',borderRadius:4,borderSkipped:false}]},{plugins:{legend:{position:'bottom',labels:{font:{family:"'Aileron',sans-serif",size:11},boxWidth:12}},tooltip:tip},scales:{x:{stacked:true,grid:{display:false},ticks:tc},y:{stacked:true,grid:{color:g},ticks:tc}}});
  mkC('chartReach','line',{labels:mo,datasets:[{label:'Alcance',data:[12000,15000,13500,18000,16500,21000,24500],borderColor:'#7C3AED',backgroundColor:'rgba(124,58,237,.1)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5},{label:'Impressões',data:[18000,22000,20000,27000,24000,31000,36000],borderColor:'#F97316',backgroundColor:'rgba(249,115,22,.06)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2}]},{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{family:"'Aileron',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip},scales:{x:{grid:{color:g},ticks:tc},y:{grid:{color:g},ticks:{...tc,callback:v=>v>=1000?(v/1000).toFixed(0)+'K':v}}}});
}
function mkC(id,type,data,options={}){const c=el(id);if(!c)return;APP.charts[id]=new Chart(c,{type,data,options:{responsive:true,maintainAspectRatio:false,...options}});}

// ── Grid de posts ─────────────────────────────────────────────
// ── Toolbar de seleção (dropdown) ─────────────────────────────
function selToolbarHTML(){
  // Show "Selecionar" button when not in selMode
  if(!APP.selMode) return `<div style="display:flex;justify-content:flex-end;margin-bottom:10px;"><button class="btn btn-sm btn-secondary" onclick="toggleSelMode()" style="gap:6px;"><svg viewBox='0 0 16 16' width='13' height='13' fill='currentColor'><rect x='1' y='1' width='5' height='5' rx='1'/><rect x='10' y='1' width='5' height='5' rx='1'/><rect x='1' y='10' width='5' height='5' rx='1'/><rect x='10' y='10' width='5' height='5' rx='1'/></svg> Selecionar</button></div>`;
  if(!APP.selection.size) return `<div style="display:flex;justify-content:flex-end;margin-bottom:10px;"><button class="btn btn-sm btn-secondary" onclick="toggleSelMode()" style="gap:6px;"><svg viewBox='0 0 16 16' width='13' height='13' fill='currentColor'><rect x='1' y='1' width='5' height='5' rx='1'/><rect x='10' y='1' width='5' height='5' rx='1'/><rect x='1' y='10' width='5' height='5' rx='1'/><rect x='10' y='10' width='5' height='5' rx='1'/></svg> Selecionar</button></div>`;
  const n=APP.selection.size;
  return`<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--primary-light);border:1.5px solid var(--primary-border);border-radius:var(--radius);margin-bottom:14px;flex-wrap:wrap;position:relative;z-index:10;">
    <div style="display:flex;align-items:center;gap:8px;min-width:0;">
      <span style="width:28px;height:28px;background:var(--primary);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800;flex-shrink:0;">${n}</span>
      <span style="font-size:13px;font-weight:700;color:var(--primary);white-space:nowrap;">selecionado${n>1?'s':''}</span>
    </div>
    <div style="display:flex;gap:6px;margin-left:auto;flex-wrap:wrap;align-items:center;">
      <button class="btn btn-sm btn-secondary" onclick="selAll()">☑ Todos</button>
      <div style="position:relative;display:inline-block;">
        <button class="btn btn-sm btn-primary" onclick="toggleSelMenu()" id="sel-menu-btn" style="gap:6px;">
          Ações <span style="font-size:10px;">▾</span>
        </button>
        <div id="sel-dropdown" style="display:none;position:absolute;right:0;top:calc(100% + 4px);background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-lg);min-width:200px;z-index:100;overflow:hidden;">
          <div onclick="selChangeStatus('approved');closeSelMenu()" style="padding:11px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:var(--green);transition:background .12s;" onmouseover="this.style.background='var(--green-bg)'" onmouseout="this.style.background=''">✅ Aprovar todos</div>
          <div onclick="selChangeStatus('review');closeSelMenu()" style="padding:11px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:var(--purple);transition:background .12s;" onmouseover="this.style.background='var(--purple-bg)'" onmouseout="this.style.background=''">👁 Enviar para Revisão</div>
          <div onclick="selChangeStatus('pending');closeSelMenu()" style="padding:11px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:var(--yellow);transition:background .12s;" onmouseover="this.style.background='var(--yellow-bg)'" onmouseout="this.style.background=''">⏳ Em Análise</div>
          <div onclick="selChangeStatus('approved');closeSelMenu()" style="display:none"></div>
          <div onclick="selChangeStatus('rejected');closeSelMenu()" style="padding:11px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:var(--red);transition:background .12s;" onmouseover="this.style.background='var(--red-bg)'" onmouseout="this.style.background=''">❌ Rejeitar todos</div>
          <div onclick="selShareAll();closeSelMenu()" style="padding:11px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:var(--blue);transition:background .12s;" onmouseover="this.style.background='var(--blue-bg)'" onmouseout="this.style.background=''">📤 Compartilhar selecionados</div>
          <div style="height:1px;background:var(--border);margin:4px 0;"></div>
          <div onclick="selDeleteAll();closeSelMenu()" style="padding:11px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:var(--red);transition:background .12s;" onmouseover="this.style.background='var(--red-bg)'" onmouseout="this.style.background=''">🗑️ Excluir selecionados</div>
        </div>
      </div>
      <button class="btn btn-sm btn-ghost" style="color:var(--text3);" onclick="APP.selMode=false;selClear();renderPage(APP.currentPage)">✕ Cancelar</button>
    </div>
  </div>`;
}
function toggleSelMenu(){
  const d=el('sel-dropdown');if(!d)return;
  const open=d.style.display==='block';
  d.style.display=open?'none':'block';
  if(!open){setTimeout(()=>{document.addEventListener('click',function h(e){if(!el('sel-menu-btn')?.contains(e.target)&&!el('sel-dropdown')?.contains(e.target)){d.style.display='none';document.removeEventListener('click',h);}});},100);}
}
function closeSelMenu(){const d=el('sel-dropdown');if(d)d.style.display='none';}
function selAll(){
  const posts=getActivePosts();
  posts.forEach(p=>APP.selection.add(p.id));
  renderPage(APP.currentPage);
}

function renderGrid(cid,posts){
  const g=el(cid);if(!g)return;
  // Note: container divs like revisao-grid already have cards-grid class
  if(!posts.length){g.innerHTML=emptyS('📭','Nenhum post aqui','Crie um novo agendamento.');return;}
  g.innerHTML=posts.map(p=>postCard(p)).join('');
}

// ── Posts Page — Grade / Lista / Calendário ───────────────────
function renderPostsPage(){
  const wrap=el('posts-page-wrap');if(!wrap)return;
  const posts=getActivePosts();
  const view=APP.postsView||'grade';

  // View toggle buttons
  const toggleBar=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:13px;font-weight:600;color:var(--text3);">${posts.length} post${posts.length!==1?'s':''}</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="view-toggle">
        <button class="vt-btn${view==='grade'?' active':''}" onclick="setPostsView('grade',this)" title="Grade">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
          Grade
        </button>
        <button class="vt-btn${view==='lista'?' active':''}" onclick="setPostsView('lista',this)" title="Lista">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="1" y="7" width="14" height="2" rx="1"/><rect x="1" y="12" width="14" height="2" rx="1"/></svg>
          Lista
        </button>
        <button class="vt-btn${view==='calendario'?' active':''}" onclick="setPostsView('calendario',this)" title="Calendário">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="2" y="4" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="5" y="1" width="1.5" height="5" rx=".75"/><rect x="9.5" y="1" width="1.5" height="5" rx=".75"/><rect x="2" y="7" width="12" height="1.5"/></svg>
          Calendário
        </button>
      </div>
    </div>
  </div>`;

  let content='';
  if(view==='grade'){
    content=(posts.length?'<div class="cards-grid">'+posts.map(p=>postCard(p)).join('')+'</div>':emptyS('📭','Nenhum post aqui','Crie um novo agendamento.'));
  } else if(view==='lista'){
    content=renderPostsList(posts);
  } else if(view==='calendario'){
    content='<div id="posts-cal"></div>';
  }
  wrap.innerHTML=toggleBar+content;
  if(view==='calendario') renderCalendar('posts-cal',posts);
}

function setPostsView(view,btn){
  APP.postsView=view;
  localStorage.setItem('aha_posts_view',view);
  APP.selection.clear();
  renderPostsPage();
}

function renderPostsList(posts){
  if(!posts.length) return emptyS('📭','Nenhum post','Crie um novo agendamento.');
  return`<div class="table-card"><div class="table-wrap"><table><thead><tr>
    <th style="width:36px;"><input type="checkbox" id="sel-all-chk" style="accent-color:var(--primary);cursor:pointer;" onclick="selAllToggle(this)" title="Selecionar todos"/></th>
    <th>Post</th><th>Plataforma</th><th>Status</th><th>Data</th><th>Campanha</th><th>Ações</th>
  </tr></thead><tbody>${posts.map(p=>{
    const isSel=APP.selection.has(p.id);
    return`<tr onclick="postListClick(event,'${p.id}')" style="cursor:pointer;${isSel?'background:var(--primary-light);':''}" class="${isSel?'row-selected':''}">
      <td onclick="event.stopPropagation()"><input type="checkbox" ${isSel?'checked':''} onchange="toggleSelect('${p.id}')" style="accent-color:var(--primary);cursor:pointer;width:15px;height:15px;"/></td>
      <td style="display:flex;align-items:center;gap:10px;min-width:0;">${thumbInline(p,38)}<div style="min-width:0;"><div class="td-primary" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.title)}</div>${p.campaign?`<div style="font-size:10px;color:var(--text3);">📋 ${esc(p.campaign)}</div>`:''}</div></td>
      <td><span class="si ${PSI[p.platform]||''}" style="width:22px;height:22px;font-size:9px;">${PSH[p.platform]||'?'}</span></td>
      <td><span class="badge ${SB[p.status]||'badge-gray'}">${SL[p.status]||p.status}</span></td>
      <td class="td-mono">${p.date||'—'}</td>
      <td style="color:var(--text3);font-size:12px;">${p.campaign?esc(p.campaign):'—'}</td>
      <td onclick="event.stopPropagation()" style="white-space:nowrap;">
        <button class="btn btn-xs btn-secondary" onclick="openPostEditor('${p.id}')">✏️</button>
        <button class="btn btn-xs btn-primary" onclick="openShareModal('${p.id}')" style="margin-left:3px;">📤</button>
        <button class="btn btn-xs btn-danger" onclick="doDeletePost('${p.id}')" style="margin-left:3px;">🗑️</button>
      </td>
    </tr>`;
  }).join('')}</tbody></table></div></div>`;
}
function postListClick(event,id){
  if(APP.selection.size>0){toggleSelect(id);return;}
  openPostDetail(id);
}
function selAllToggle(chk){
  if(chk.checked){APP.selMode=true;LOCAL.get('posts').forEach(p=>APP.selection.add(p.id));}
  else{APP.selection.clear();APP.selMode=false;}
  renderPostsPage();
}
function postCard(p){
  const hasComment=p.clientComment&&p.clientComment.trim().length>0;
  const isSel=APP.selection.has(p.id);
  return`<div class="post-card${isSel?' post-card-selected':''}" onclick="postCardClick(event,'${p.id}')">
    <div class="post-card-thumb">
      ${p.type==='carousel'&&p.slides?.length?carouselThumbBg(p):thumbBg(p)}
      <!-- Selection checkbox — visible only in selMode -->
      <span onclick="event.stopPropagation();toggleSelect('${p.id}')" style="position:absolute;top:7px;left:7px;z-index:3;width:22px;height:22px;border-radius:6px;background:${isSel?'var(--primary)':'rgba(255,255,255,.85)'};border:2px solid ${isSel?'var(--primary)':'rgba(255,255,255,.6)'};display:${APP.selMode?'flex':'none'};align-items:center;justify-content:center;cursor:pointer;transition:all .15s;box-shadow:0 1px 4px rgba(0,0,0,.2);font-size:12px;">${isSel?'✓':''}</span>
      <span class="si ${PSI[p.platform]||''}" style="position:absolute;top:7px;right:7px;z-index:2;width:22px;height:22px;font-size:9px;">${PSH[p.platform]||'?'}</span>
      <span class="badge ${SB[p.status]||'badge-gray'}" style="position:absolute;bottom:6px;right:6px;z-index:2;font-size:9px;padding:2px 7px;">${SL[p.status]||p.status}</span>
      ${p.type==='carousel'&&p.slides?.length?`<span style="position:absolute;bottom:6px;left:6px;z-index:2;background:rgba(0,0,0,.65);color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;">🎠 ${p.slides.length} slides</span>`:''}
      ${hasComment?`<span style="position:absolute;top:34px;right:7px;z-index:2;background:rgba(37,99,235,.85);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;">💬</span>`:''}
    </div>
    <div class="post-card-body"><div class="post-card-title">${esc(p.title)}</div><div class="post-card-meta">${p.date||'Sem data'} · ${PL[p.platform]||p.platform}</div>${p.campaign?`<div class="post-card-meta" style="margin-top:2px;">📋 ${esc(p.campaign)}</div>`:''}</div>
    <div class="post-card-footer">
      <div style="display:flex;gap:4px;">${p.status==='pending'?`<button class="btn btn-xs btn-primary" onclick="event.stopPropagation();doChangeStatus('${p.id}','approved')">✅</button><button class="btn btn-xs btn-danger" onclick="event.stopPropagation();doChangeStatus('${p.id}','rejected')">✕</button>`:''}${p.status==='rejected'?`<button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();doChangeStatus('${p.id}','pending')">↩</button>`:''}</div>
      <div style="display:flex;gap:4px;"><button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();openPostEditor('${p.id}')">✏️</button><button class="btn btn-xs btn-primary" onclick="event.stopPropagation();openShareModal('${p.id}')">📤</button><button class="btn btn-xs btn-danger" onclick="event.stopPropagation();doDeletePost('${p.id}')">🗑️</button></div>
    </div>
  </div>`;
}

// ── Seleção múltipla ─────────────────────────────────────────
function postCardClick(event, id){
  if(APP.selMode){toggleSelect(id);return;}
  openPostDetail(id);
}
function toggleSelect(id){
  if(APP.selection.has(id)) APP.selection.delete(id);
  else APP.selection.add(id);
  renderPage(APP.currentPage);
}
function selClear(){APP.selection.clear();APP.selMode=false;}
function toggleSelMode(){
  APP.selMode=!APP.selMode;
  if(!APP.selMode)APP.selection.clear();
  updateBadges();
  renderPage(APP.currentPage);
}
async function selDeleteAll(){
  if(!APP.selection.size)return;
  const count=APP.selection.size;
  if(!confirm(`Excluir ${count} post${count>1?'s':''}?`))return;
  for(const id of APP.selection){
    DB.remove('posts',id).catch(()=>{});
  }
  APP.selection.clear();
  updateBadges();
  toast(`🗑️ ${count} post${count>1?'s':''} excluído${count>1?'s':''}!`,'info');
  renderPage(APP.currentPage);
}
function selChangeStatus(ns){
  const ids=[...APP.selection];
  if(!ids.length)return;
  ids.forEach(id=>{
    DB.update('posts',id,{status:ns}).catch(()=>{});
  });
  APP.selection.clear();
  updateBadges();
  toast(`✅ ${ids.length} post${ids.length>1?'s':''} atualizados!`,'success');
  renderPage(APP.currentPage);
  updateCampaignCounts();
}
async function selShareAll(){
  const ids=[...APP.selection];
  if(!ids.length)return;
  // Build multi-link message
  const links=ids.map(id=>{const p=LOCAL.find('posts',id);if(!p)return null;const link=window.location.origin+window.location.pathname.replace(/\/[^/]*$/,'/')+'?approval='+id;return`• ${p.title}: ${link}`;}).filter(Boolean);
  const msg='Links para aprovação:\n\n'+links.join('\n');
  navigator.clipboard?.writeText(links.map(l=>l.split(': ')[1]).join('\n'))
    .then(()=>toast('📋 '+ids.length+' links copiados!','success'))
    .catch(()=>toast('Use o botão de compartilhar em cada post.','info'));
}

function openPostDetail(id){
  const p=LOCAL.find('posts',id);if(!p)return;
  APP.editingId=id;
  const thumbEl=el('detail-thumb');
  if(thumbEl){
    if(p.type==='carousel'&&p.slides?.length){
      window._detailSlides=p.slides;
      window._detailSlideIdx=0;
      thumbEl.innerHTML=`<div style="position:relative;">
        <!-- Slides -->
        <div id="carousel-preview" style="position:relative;overflow:hidden;border-radius:var(--radius);background:var(--surface2);">
          ${p.slides.map((s,i)=>`<div class="carousel-slide-preview" data-idx="${i}" style="display:${i===0?'block':'none'};">${s.fileUrl?(s.fileType==='video'?`<video src="${s.fileUrl}" controls style="width:100%;max-height:260px;display:block;background:#000;"></video>`:`<img src="${s.fileUrl}" style="width:100%;max-height:260px;object-fit:contain;display:block;"/>`):`<div style="height:200px;display:flex;align-items:center;justify-content:center;font-size:56px;">${s.thumb||'🖼️'}</div>`}</div>`).join('')}
          <!-- Prev/Next arrows -->
          <button onclick="detailCarouselNav(-1)" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;border:none;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;backdrop-filter:blur(4px);transition:background .15s;" onmouseover="this.style.background='rgba(0,0,0,.8)'" onmouseout="this.style.background='rgba(0,0,0,.55)'">‹</button>
          <button onclick="detailCarouselNav(1)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;border:none;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;backdrop-filter:blur(4px);transition:background .15s;" onmouseover="this.style.background='rgba(0,0,0,.8)'" onmouseout="this.style.background='rgba(0,0,0,.55)'">›</button>
          <!-- Counter badge -->
          <div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:12px;backdrop-filter:blur(4px);"><span id="carousel-current">1</span>/${p.slides.length}</div>
        </div>
        <!-- Dot indicators -->
        <div style="display:flex;justify-content:center;gap:6px;margin-top:10px;">
          ${p.slides.map((_,i)=>`<div onclick="showCarouselSlide(${i})" style="width:${i===0?10:7}px;height:${i===0?10:7}px;border-radius:50%;background:${i===0?'var(--primary)':'var(--border2)'};cursor:pointer;transition:all .2s;" id="dot-${i}"></div>`).join('')}
        </div>
        <div style="text-align:center;margin-top:6px;font-size:11px;color:var(--text3);font-weight:600;">🎠 Carrossel — ${p.slides.length} slides</div>
      </div>`;
    } else { thumbEl.innerHTML=thumbFull(p); }
  }
  setText('detail-title',p.title);setText('detail-platform',PL[p.platform]||p.platform);
  setText('detail-date',p.date||'—');setText('detail-campaign',p.campaign||'—');
  setText('detail-type',p.type||'—');setText('detail-caption',p.caption||'Sem legenda.');
  const stEl=el('detail-status');if(stEl){stEl.className='badge '+(SB[p.status]||'badge-gray');stEl.textContent=SL[p.status]||p.status;}
  const tagsEl=el('detail-tags');if(tagsEl)tagsEl.innerHTML=p.tags?p.tags.split(',').filter(Boolean).map(t=>`<span class="badge badge-gray" style="margin:2px;">#${esc(t.trim())}</span>`).join(''):'—';
  // FIX II: show client comment in post detail
  const commentBox=el('detail-client-comment');
  if(commentBox){
    if(p.clientComment&&p.clientComment.trim()){
      commentBox.style.display='block';
      commentBox.innerHTML=`<div style="background:var(--blue-bg);border:1px solid var(--blue-border);border-radius:var(--radius-sm);padding:14px;margin-top:12px;">
        <div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;">💬 Comentário do Cliente</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.6;">${esc(p.clientComment)}</div>
        ${p.reviewedAt?`<div style="font-size:10px;color:var(--text3);margin-top:6px;">📅 ${new Date(p.reviewedAt).toLocaleString('pt-BR')}</div>`:''}
        ${p.reviewAction?`<div style="font-size:11px;font-weight:700;margin-top:4px;color:${p.reviewAction==='approve'?'var(--green)':p.reviewAction==='reject'?'var(--red)':'var(--yellow)'};">Ação: ${{approve:'✅ Aprovado',reject:'❌ Rejeitado',correct:'⚠️ Correção solicitada'}[p.reviewAction]||p.reviewAction}</div>`:''}
      </div>`;
    } else {
      commentBox.style.display='none';
    }
  }
  openModal('modalPostDetail');
}

function showCarouselSlide(idx){
  const slides=window._detailSlides;if(!slides)return;
  idx=Math.max(0,Math.min(slides.length-1,idx));
  window._detailSlideIdx=idx;
  document.querySelectorAll('.carousel-slide-preview').forEach((s,i)=>{s.style.display=i===idx?'block':'none';});
  document.querySelectorAll('[id^="dot-"]').forEach((d,i)=>{
    d.style.background=i===idx?'var(--primary)':'var(--border2)';
    d.style.width=i===idx?'10px':'7px';
    d.style.height=i===idx?'10px':'7px';
  });
  const curr=el('carousel-current');if(curr)curr.textContent=idx+1;
}
function detailCarouselNav(dir){
  const slides=window._detailSlides;if(!slides)return;
  showCarouselSlide((window._detailSlideIdx||0)+dir);
}

// ── KANBAN WORKFLOW — Drag & Drop ─────────────────────────────
let _dragId=null,_dragCol=null;
function saveKanbanCols(){localStorage.setItem('aha_kanban_cols',JSON.stringify(APP.kanbanCols));}

function renderKanban(){
  const board=el('kanban-board');if(!board)return;
  const posts=getActivePosts();
  // Map each post to a column based on status
  const grouped={};
  APP.kanbanCols.forEach(c=>grouped[c.id]=[]);
  posts.forEach(p=>{
    const col=APP.kanbanCols.find(c=>c.status===p.status||c.id===p.status);
    const colId=col?col.id:(APP.kanbanCols[1]?.id||'content');
    if(!grouped[colId])grouped[colId]=[];
    grouped[colId].push(p);
  });
  board.innerHTML=APP.kanbanCols.map(col=>{
    const items=grouped[col.id]||[];
    return`<div class="kanban-col" id="kcol-${col.id}"
      ondragover="event.preventDefault();el('kcol-${col.id}').classList.add('drag-over')"
      ondragleave="el('kcol-${col.id}').classList.remove('drag-over')"
      ondrop="kanbanDrop(event,'${col.id}')">
      <div class="kanban-col-header" style="border-top:3px solid ${col.color};">
        <div class="kanban-col-title" style="color:${col.color};">
          ${col.icon}
          <span id="kcol-label-${col.id}" ondblclick="editKanbanColLabel('${col.id}')">${esc(col.label)}</span>
          <span class="kanban-col-count" style="background:${col.color}20;color:${col.color};">${items.length}</span>
        </div>
        <button onclick="editKanbanCol('${col.id}')" style="background:none;border:none;cursor:pointer;font-size:13px;opacity:.4;padding:2px 4px;" title="Editar coluna">⚙️</button>
      </div>
      <div class="kanban-col-body" id="kcol-body-${col.id}">
        ${items.length
          ? items.map(p=>kanbanCard(p,col)).join('')
          : `<div style="text-align:center;padding:24px 12px;color:var(--text4);font-size:11px;border:2px dashed var(--border);border-radius:8px;margin:8px;">Arraste posts aqui</div>`
        }
      </div>
    </div>`;
  }).join('');
}

function kanbanCard(p,col){
  const url=getFileUrl(p);
  const hasComment=p.clientComment&&p.clientComment.trim();
  return`<div class="kanban-card" draggable="true" id="kcard-${p.id}"
    ondragstart="kanbanDragStart(event,'${p.id}','${col.id}')"
    ondragend="kanbanDragEnd(event)"
    ondragover="event.preventDefault()"
    onclick="openPostDetail('${p.id}')">
    ${(()=>{
      const thumbUrl=p.type==='carousel'&&p.slides?.length?p.slides[0].fileUrl:url;
      const isVid=p.type==='carousel'&&p.slides?.length?(p.slides[0].fileType==='video'):isVideo(p);
      if(thumbUrl&&!isVid) return`<div class="kanban-card-thumb"><img src="${thumbUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy"/>${p.type==='carousel'?`<span style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,.65);color:#fff;font-size:8px;font-weight:700;padding:1px 5px;border-radius:6px;">🎠 ${p.slides.length}</span>`:''}</div>`;
      if(thumbUrl&&isVid) return`<div class="kanban-card-thumb"><div style="background:#000;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;">▶️</div></div>`;
      return`<div style="height:70px;background:linear-gradient(135deg,var(--surface2),var(--surface3));border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:8px;">${p.type==='carousel'?'🎠':(p.thumb||'📷')}</div>`;
    })()}
    <div class="kanban-card-title">${esc(p.title)}</div>
    <div class="kanban-card-meta">
      <span class="si ${PSI[p.platform]||''}" style="width:16px;height:16px;font-size:7px;">${PSH[p.platform]||'?'}</span>
      ${p.date?`<span>📅 ${p.date}</span>`:''}
      ${hasComment?`<span title="${esc(p.clientComment)}" style="color:var(--blue);font-weight:700;">💬</span>`:''}
    </div>
    ${hasComment?`<div style="font-size:10px;color:var(--text3);background:var(--blue-bg);border-radius:4px;padding:4px 7px;margin-top:6px;border-left:2px solid var(--blue);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">"${esc(p.clientComment)}"</div>`:''}
    <div class="kanban-card-actions" onclick="event.stopPropagation()">
      <button class="btn btn-xs btn-secondary" onclick="openPostEditor('${p.id}')">✏️</button>
      <button class="btn btn-xs btn-primary" onclick="openShareModal('${p.id}')">📤</button>
      <button class="btn btn-xs btn-danger" onclick="doDeletePost('${p.id}')">🗑️</button>
    </div>
  </div>`;
}

function kanbanDragStart(e,postId,colId){
  _dragId=postId;_dragCol=colId;
  e.dataTransfer.setData('text/plain',postId);
  e.dataTransfer.effectAllowed='move';
  setTimeout(()=>{const c=el('kcard-'+postId);if(c)c.classList.add('dragging');},0);
}
function kanbanDragEnd(e){
  if(_dragId){const c=el('kcard-'+_dragId);if(c)c.classList.remove('dragging');}
  document.querySelectorAll('.kanban-col').forEach(c=>c.classList.remove('drag-over'));
  _dragId=null;_dragCol=null;
}
function kanbanDrop(e,targetColId){
  e.preventDefault();e.stopPropagation();
  const col=el('kcol-'+targetColId);if(col)col.classList.remove('drag-over');
  const postId=e.dataTransfer.getData('text/plain')||_dragId;
  if(!postId||_dragCol===targetColId)return;
  const targetCol=APP.kanbanCols.find(c=>c.id===targetColId);
  if(!targetCol)return;
  const post=LOCAL.find('posts',postId);
  const newStatus=targetCol.status||targetColId;
  DB.update('posts',postId,{status:newStatus}).catch(()=>{});
  updateBadges();
  // Som de click
  try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=800;g.gain.setValueAtTime(0.2,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.12);o.start();o.stop(ctx.currentTime+0.12);}catch{}
  toast(`✅ "${post?.title||''}" → ${targetCol.label}`,'success');
  setTimeout(()=>renderKanban(),80);
}

function editKanbanColLabel(colId){
  const col=APP.kanbanCols.find(c=>c.id===colId);if(!col)return;
  const labelEl=el('kcol-label-'+colId);if(!labelEl)return;
  const input=document.createElement('input');
  input.value=col.label;
  input.style.cssText='font-size:12px;font-weight:700;border:1px solid var(--primary);border-radius:4px;padding:2px 6px;width:120px;font-family:inherit;';
  labelEl.replaceWith(input);input.focus();input.select();
  const save=()=>{col.label=input.value.trim()||col.label;saveKanbanCols();const span=document.createElement('span');span.id='kcol-label-'+colId;span.textContent=col.label;span.ondblclick=()=>editKanbanColLabel(colId);input.replaceWith(span);};
  input.addEventListener('blur',save);
  input.addEventListener('keydown',e=>{if(e.key==='Enter')save();if(e.key==='Escape'){input.value=col.label;save();}});
}

function editKanbanCol(colId){
  const col=APP.kanbanCols.find(c=>c.id===colId);if(!col)return;
  const colors=['#64748B','#2563EB','#7C3AED','#D97706','#16A34A','#EA580C','#DC2626','#0891B2','#DB2777'];
  const html=`<div style="padding:20px;">
    <div style="font-size:16px;font-weight:800;margin-bottom:16px;">⚙️ Editar Coluna</div>
    <div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);">Nome</label><input id="kcol-edit-name" value="${esc(col.label)}" style="width:100%;margin-top:6px;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;"/></div>
    <div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);">Ícone</label><input id="kcol-edit-icon" value="${col.icon}" style="width:100%;margin-top:6px;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:16px;"/></div>
    <div style="margin-bottom:16px;"><label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);">Cor</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">${colors.map(c=>`<div onclick="document.querySelectorAll('.col-color-opt').forEach(x=>x.style.outline='none');this.style.outline='3px solid #000';el('kcol-edit-color').value='${c}';" class="col-color-opt" style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;outline:${c===col.color?'3px solid #000':'none'};"></div>`).join('')}</div>
      <input type="hidden" id="kcol-edit-color" value="${col.color}"/>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button onclick="document.getElementById('modalKanbanEdit').classList.remove('open');document.body.style.overflow='';" class="btn btn-secondary">Cancelar</button>
      <button onclick="saveKanbanColEdit('${colId}')" class="btn btn-primary">Salvar</button>
    </div>
  </div>`;
  let overlay=el('modalKanbanEdit');
  if(!overlay){overlay=document.createElement('div');overlay.id='modalKanbanEdit';overlay.className='modal-overlay';overlay.innerHTML=`<div class="modal" style="max-width:360px;">${html}</div>`;overlay.onclick=e=>{if(e.target===overlay){overlay.classList.remove('open');document.body.style.overflow='';}};document.body.appendChild(overlay);}
  else{overlay.querySelector('.modal').innerHTML=html;}
  overlay.classList.add('open');document.body.style.overflow='hidden';
}
function saveKanbanColEdit(colId){
  const col=APP.kanbanCols.find(c=>c.id===colId);if(!col)return;
  col.label=v('kcol-edit-name').trim()||col.label;
  col.icon=v('kcol-edit-icon').trim()||col.icon;
  col.color=el('kcol-edit-color')?.value||col.color;
  saveKanbanCols();
  const overlay=el('modalKanbanEdit');if(overlay){overlay.classList.remove('open');document.body.style.overflow='';}
  renderKanban();toast('✅ Coluna atualizada!','success');
}

// ── AGENDAMENTOS ──────────────────────────────────────────────
function renderAgendamentos(){
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
  const posts=getActivePosts();
  if(view==='lista')renderAgendList(posts);
  if(view==='grade'){const g=el('agend-cards');if(g)g.innerHTML=posts.length?posts.map(p=>postCard(p)).join(''):emptyS('📅','Sem posts','Crie um agendamento.');}
  if(view==='calendario')renderCalendar('agend-cal',posts);
}
function renderAgendList(posts){
  const tbody=el('agend-list');if(!tbody)return;
  if(!posts.length){tbody.innerHTML=`<tr><td colspan="6">${emptyS('📅','Nenhum agendamento','Clique em "+ Novo Agendamento".')}</td></tr>`;return;}
  tbody.innerHTML=posts.map(p=>`<tr onclick="openPostDetail('${p.id}')" style="cursor:pointer;">
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

// ── CALENDÁRIO — estilo Hootsuite com miniaturas ──────────────
let _calYear=null,_calMonth=null;

function renderCalendar(cid,posts,yr,mo){
  const c=el(cid);if(!c)return;
  const now=new Date();
  const Y=yr!==undefined&&yr!==null?yr:(_calYear||now.getFullYear());
  const M=mo!==undefined&&mo!==null?mo:(_calMonth!==null&&_calMonth!==undefined?_calMonth:now.getMonth());
  _calYear=Y;_calMonth=M;
  const MN=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DN=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const fd=new Date(Y,M,1).getDay(),dim=new Date(Y,M+1,0).getDate();
  const td=now.getDate(),tm=now.getMonth(),ty=now.getFullYear();

  const monthBtn=`<div style="position:relative;display:inline-block;">
    <button onclick="toggleMonthDropdown('${cid}')" style="display:flex;align-items:center;gap:6px;padding:8px 16px;background:var(--surface);border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-weight:700;color:var(--text);cursor:pointer;font-family:inherit;">
      ${MN[M]} ${Y} <span style="font-size:11px;opacity:.5;">▾</span>
    </button>
    <div id="month-dropdown-${cid}" style="display:none;position:absolute;top:calc(100% + 4px);left:0;background:#fff;border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:300;width:240px;padding:10px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">
        ${MN.map((mn,i)=>`<div onclick="renderCalendar('${cid}',getActivePosts(),${Y},${i});toggleMonthDropdown('${cid}')" style="padding:8px;text-align:center;cursor:pointer;border-radius:7px;font-size:12px;font-weight:${i===M?'800':'500'};color:${i===M?'#fff':'var(--text2)'};background:${i===M?'var(--primary)':'transparent'};transition:all .12s;" onmouseover="if(${i}!==${M})this.style.background='var(--surface2)'" onmouseout="if(${i}!==${M})this.style.background='transparent'">${mn}</div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
        <button onclick="renderCalendar('${cid}',getActivePosts(),${Y-1},${M});toggleMonthDropdown('${cid}')" style="padding:5px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;">← ${Y-1}</button>
        <button onclick="renderCalendar('${cid}',getActivePosts(),${now.getFullYear()},${now.getMonth()});toggleMonthDropdown('${cid}')" style="padding:5px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;">Hoje</button>
        <button onclick="renderCalendar('${cid}',getActivePosts(),${Y+1},${M});toggleMonthDropdown('${cid}')" style="padding:5px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;">${Y+1} →</button>
      </div>
    </div>
  </div>`;

  let h=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow);">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;">
        <button onclick="renderCalendar('${cid}',getActivePosts(),${M===0?Y-1:Y},${M===0?11:M-1})" style="width:32px;height:32px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;">‹</button>
        ${monthBtn}
        <button onclick="renderCalendar('${cid}',getActivePosts(),${M===11?Y+1:Y},${M===11?0:M+1})" style="width:32px;height:32px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;">›</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:12px;color:var(--text3);">${posts.length} post${posts.length!==1?'s':''} no mês</span>
        <button onclick="renderCalendar('${cid}',getActivePosts(),${now.getFullYear()},${now.getMonth()})" style="padding:6px 14px;background:var(--primary);color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Hoje</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);background:var(--surface2);border-bottom:1px solid var(--border);">
      ${DN.map(d=>`<div style="padding:10px 0;text-align:center;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);">`;

  for(let i=0;i<fd;i++) h+=`<div style="min-height:120px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--surface2);opacity:.5;"></div>`;

  for(let d=1;d<=dim;d++){
    const isT=d===td&&M===tm&&Y===ty;
    const ds=`${Y}-${String(M+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dp=posts.filter(p=>p.date===ds);
    h+=`<div style="min-height:120px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:${isT?'var(--primary-light)':'var(--surface)'};cursor:pointer;transition:background .12s;position:relative;" onclick="calClick('${cid}','${ds}')" onmouseover="this.style.background='${isT?'var(--primary-light)':'var(--surface2)'}'" onmouseout="this.style.background='${isT?'var(--primary-light)':'var(--surface)'}'">
      <div style="padding:6px 8px 4px;display:flex;align-items:center;justify-content:space-between;">
        <span style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:${isT?'800':'500'};color:${isT?'#fff':'var(--text2)'};background:${isT?'var(--primary)':'transparent'};border-radius:50%;flex-shrink:0;">${d}</span>
        ${dp.length?`<span style="font-size:9px;font-weight:700;color:var(--primary);background:var(--primary-light);border-radius:10px;padding:1px 6px;">${dp.length}</span>`:''}
      </div>
      <div style="padding:0 4px 6px;display:flex;flex-direction:column;gap:3px;">
        ${dp.slice(0,3).map(p=>{
          const pUrl=getFileUrl(p);
          const statusColor=p.status==='approved'?'#16A34A':p.status==='rejected'?'#DC2626':p.status==='pending'?'#D97706':p.status==='review'?'#7C3AED':'#64748B';
          return`<div onclick="event.stopPropagation();openPostDetail('${p.id}')" style="cursor:pointer;border-radius:6px;overflow:hidden;border-left:3px solid ${statusColor};background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08);transition:transform .1s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'" title="${esc(p.title)}">
            ${(()=>{
              const calThumbUrl=p.type==='carousel'&&p.slides?.length?p.slides[0].fileUrl:pUrl;
              const calIsVid=p.type==='carousel'&&p.slides?.length?(p.slides[0].fileType==='video'):isVideo(p);
              if(calThumbUrl&&!calIsVid) return`<img src="${calThumbUrl}" style="width:100%;height:56px;object-fit:cover;object-position:center top;display:block;border-radius:4px 4px 0 0;" loading="lazy" onerror="this.style.display='none'"/>`;
              if(calIsVid) return`<div style="height:56px;background:#111;border-radius:4px 4px 0 0;display:flex;align-items:center;justify-content:center;font-size:18px;">▶️</div>`;
              return`<div style="height:40px;background:${statusColor}18;border-radius:4px 4px 0 0;display:flex;align-items:center;justify-content:center;font-size:18px;">${p.type==='carousel'?'🎠':(p.thumb||'📷')}</div>`;
            })()}
            <div style="padding:3px 6px 4px;background:#fff;">
              <div style="display:flex;align-items:center;gap:3px;">
                <span class="si ${PSI[p.platform]||''}" style="width:11px;height:11px;font-size:5px;border-radius:2px;flex-shrink:0;">${PSH[p.platform]||'?'}</span>
                <span style="font-size:9px;font-weight:600;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${esc(p.title)}</span>
                ${p.clientComment?`<span style="color:var(--blue);font-size:9px;" title="Tem comentário do cliente">💬</span>`:''}
              </div>
            </div>
          </div>`;
        }).join('')}
        ${dp.length>3?`<div onclick="event.stopPropagation();toast('${dp.length} posts em ${ds}','info')" style="font-size:9px;font-weight:700;color:var(--primary);text-align:center;padding:2px;cursor:pointer;">+${dp.length-3} mais</div>`:''}
      </div>
    </div>`;
  }
  h+=`</div></div>`;
  c.innerHTML=h;
}

function toggleMonthDropdown(cid){
  const dd=el('month-dropdown-'+cid);if(!dd)return;
  const open=dd.style.display!=='none';
  dd.style.display=open?'none':'block';
  if(!open){
    setTimeout(()=>{
      document.addEventListener('click',function close(e){
        if(!dd.contains(e.target)&&!e.target.closest('button')){dd.style.display='none';document.removeEventListener('click',close);}
      });
    },100);
  }
}
function calClick(cid,ds){if(cid==='agend-cal'){openNewAgendamento();setTimeout(()=>sv('ag-date',ds),60);}}

// ── Upload ────────────────────────────────────────────────────
function triggerFile(inputId){el(inputId)?.click();}
function onDragOver(e){e.preventDefault();e.currentTarget.classList.add('drag-over');}
function onDragLeave(e){e.currentTarget.classList.remove('drag-over');}
async function onDrop(e,previewId,dataId){e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('drag-over');const f=e.dataTransfer?.files[0];if(f)await processFile(f,previewId,dataId);}
async function onFileChange(inputId,previewId,dataId){const input=el(inputId);if(!input||!input.files[0])return;await processFile(input.files[0],previewId,dataId);input.value='';}
// ── Helper: store video in IndexedDB (local device only) ─────
async function _processVideoLocal(file,thumb,prev,dataEl){
  const objUrl=URL.createObjectURL(file);
  const vKey='vid_'+Date.now();
  try{await VDB.save(vKey,file);}catch(e){console.warn('IndexedDB:',e);}
  const ref=JSON.stringify({thumb,vKey,name:file.name,size:file.size,type:file.type});
  if(dataEl)dataEl.value=ref;
  if(prev)prev.innerHTML=`<div style="position:relative;border-radius:var(--radius);overflow:hidden;"><video src="${objUrl}" controls style="width:100%;height:160px;background:#000;display:block;" preload="metadata"></video><div style="padding:8px;background:var(--surface2);font-size:11px;color:var(--text3);">🎬 ${file.name} · ${(file.size/1024/1024).toFixed(1)}MB <span style="color:var(--yellow);">⚠️ Salvo localmente — link de aprovação não reproduzirá vídeo em outros devices</span></div></div>`;
  toast(`✅ Vídeo "${file.name}" pronto (local)!`,'success');
}

// ── IndexedDB for large video storage ────────────────────────
const VDB={
  db:null,
  open(){
    return new Promise((res,rej)=>{
      if(this.db){res(this.db);return;}
      const req=indexedDB.open('aha_videos',1);
      req.onupgradeneeded=e=>{e.target.result.createObjectStore('videos');};
      req.onsuccess=e=>{this.db=e.target.result;res(this.db);};
      req.onerror=()=>rej(req.error);
    });
  },
  async save(key,blob){
    const db=await this.open();
    return new Promise((res,rej)=>{
      const tx=db.transaction('videos','readwrite');
      tx.objectStore('videos').put(blob,key);
      tx.oncomplete=()=>res(key);
      tx.onerror=()=>rej(tx.error);
    });
  },
  async load(key){
    const db=await this.open();
    return new Promise((res,rej)=>{
      const tx=db.transaction('videos','readonly');
      const req=tx.objectStore('videos').get(key);
      req.onsuccess=()=>res(req.result||null);
      req.onerror=()=>res(null);
    });
  },
};

async function processFile(file,previewId,dataId){
  const isImg=file.type.startsWith('image/'),isVid=file.type.startsWith('video/');
  if(!isImg&&!isVid){toast('Formato não suportado. Use PNG, JPG, MP4, MOV.','warning');return;}
  const prev=el(previewId),dataEl=el(dataId);

  // ── Spinner inicial ─────────────────────────────────────────
  if(prev)prev.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:140px;gap:10px;background:var(--surface2);border-radius:var(--radius);"><div class="upload-spinner"></div><div style="font-size:12px;color:var(--text3);font-weight:600;">${isVid?'🎬 Processando vídeo...':'📸 Comprimindo imagem...'}</div></div>`;

  // ── Helper: checar se Storage está funcional (timeout 4s) ───
  async function storageOk(){
    if(!_firebaseReady||!_storage)return false;
    try{
      await Promise.race([
        _storage.ref('.keep').getMetadata().catch(()=>{}),
        new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),4000))
      ]);
      return true;
    }catch{return false;}
  }

  try{
    if(isImg){
      // 1. Comprime sempre
      const compressed=await compressImage(file);

      // 2. Tenta Storage (com timeout de 5s) — sem travar se offline
      const useStorage=await Promise.race([
        storageOk(),
        new Promise(r=>setTimeout(()=>r(false),5000))
      ]);

      if(useStorage){
        try{
          if(prev)prev.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:130px;gap:8px;background:var(--surface2);border-radius:var(--radius);"><div class="upload-spinner"></div><div style="font-size:11px;color:var(--text3);font-weight:600;">☁️ Enviando imagem...</div></div>`;
          const imgPath=`images/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
          const uploadTask=_storage.ref(imgPath).putString(compressed,'data_url');
          const snap=await Promise.race([
            uploadTask,
            new Promise((_,r)=>setTimeout(()=>r(new Error('upload timeout')),15000))
          ]);
          const cloudUrl=await snap.ref.getDownloadURL();
          if(dataEl)dataEl.value=cloudUrl;
          if(prev)prev.innerHTML=`<img src="${cloudUrl}" style="width:100%;height:130px;object-fit:cover;border-radius:var(--radius);display:block;"/>`;
          toast('✅ Imagem carregada!','success');
          return;
        }catch(e){
          console.warn('Storage falhou, usando base64:',e.message);
        }
      }

      // 3. Fallback base64 (sempre funciona)
      if(dataEl)dataEl.value=compressed;
      if(prev)prev.innerHTML=`<img src="${compressed}" style="width:100%;height:130px;object-fit:cover;border-radius:var(--radius);display:block;"/>`;
      toast('✅ Imagem carregada!','success');

    } else {
      // ── VÍDEO ──────────────────────────────────────────────
      if(file.size>100*1024*1024){
        toast('⚠️ Vídeo maior que 100MB.','warning');
        if(prev)prev.innerHTML=`<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Arquivo muito grande (máx. 100MB)</div>`;
        return;
      }
      const thumb=await videoThumbnail(file);
      const useStorage=await Promise.race([
        storageOk(),
        new Promise(r=>setTimeout(()=>r(false),5000))
      ]);

      if(useStorage){
        try{
          if(prev)prev.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:140px;gap:10px;background:var(--surface2);border-radius:var(--radius);padding:16px;"><div class="upload-spinner"></div><div style="font-size:12px;font-weight:700;color:var(--text3);">☁️ Enviando vídeo... <span id="vid-pct">0</span>%</div><div style="width:100%;height:6px;background:var(--border);border-radius:4px;overflow:hidden;margin-top:4px;"><div id="vid-bar" style="height:100%;width:0%;background:var(--primary);border-radius:4px;transition:width .3s;"></div></div><div style="font-size:11px;color:var(--text4);">${(file.size/1024/1024).toFixed(1)}MB</div></div>`;
          const uploadPath=`videos/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
          const task=_storage.ref(uploadPath).put(file);
          const cloudUrl=await new Promise((res,rej)=>{
            task.on('state_changed',snap=>{
              const pct=Math.round((snap.bytesTransferred/snap.totalBytes)*100);
              const bar=el('vid-bar'),pctEl=el('vid-pct');
              if(bar)bar.style.width=pct+'%';
              if(pctEl)pctEl.textContent=pct;
            },rej,async()=>res(await task.snapshot.ref.getDownloadURL()));
          });
          if(dataEl)dataEl.value=JSON.stringify({url:cloudUrl,thumb,type:'video',isRemote:true,name:file.name,size:file.size});
          if(prev)prev.innerHTML=`<div style="position:relative;border-radius:var(--radius);overflow:hidden;"><video src="${cloudUrl}" controls style="width:100%;height:160px;background:#000;display:block;" preload="metadata"></video><div style="padding:8px;background:var(--surface2);font-size:11px;color:var(--text3);">☁️ ${file.name} · ${(file.size/1024/1024).toFixed(1)}MB <span style="color:#16A34A;font-weight:700;">✅ Cloud</span></div></div>`;
          toast(`✅ Vídeo "${file.name}" enviado ao cloud!`,'success');
          return;
        }catch(e){
          console.warn('Storage falhou, usando IndexedDB:',e.message);
        }
      }
      // Fallback IndexedDB local
      await _processVideoLocal(file,thumb,prev,dataEl);
    }
  }catch(e){
    console.error('processFile erro:',e);
    toast('Erro ao processar arquivo: '+e.message,'error');
    if(prev)prev.innerHTML=`<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Erro — tente novamente</div>`;
  }
}

function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    if(file.size>100*1024*1024){reject(new Error('Máx. 100MB.'));return;}
    const reader=new FileReader();
    reader.onload=e=>resolve(e.target.result.split(',')[1]);
    reader.onerror=()=>reject(new Error('Erro ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}
function compressImage(file){
  return new Promise((resolve,reject)=>{
    if(file.size>15*1024*1024){reject(new Error('Máx. 15MB.'));return;}
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{const MAX=900;let w=img.width,h=img.height;if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',0.78));};
    img.onerror=()=>reject(new Error('Não foi possível ler.'));img.src=url;
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

// ── Carrossel ─────────────────────────────────────────────────
let _carouselSlides=[];
function initCarouselSlides(existing){_carouselSlides=existing||[];renderCarouselSlots();}
function renderCarouselSlots(){
  const cont=el('carousel-slots');if(!cont)return;
  const maxSlides=6;
  let html=`
  <div style="margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--primary);color:#fff;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;transition:all .15s;" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
      📂 Adicionar Imagens/Vídeos
      <input type="file" accept="image/*,video/*" multiple style="display:none;" onchange="addCarouselMultiple(event)"/>
    </label>
    <span style="font-size:11px;color:var(--text3);" id="carousel-count-label">${_carouselSlides.length}/${maxSlides} slides</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">`;

  // Show existing slides
  for(let i=0;i<_carouselSlides.length;i++){
    const s=_carouselSlides[i];
    const isVid=s.fileType==='video'||(s.fileUrl&&s.fileUrl.startsWith('data:video'));
    html+=`<div style="position:relative;border-radius:8px;overflow:hidden;border:2px solid var(--primary);box-shadow:0 2px 8px rgba(0,0,0,.08);">
      <div style="position:relative;height:90px;background:var(--surface2);">
        ${isVid
          ?`<video src="${s.fileUrl}" style="width:100%;height:90px;object-fit:cover;" muted></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><span style="font-size:20px;background:rgba(0,0,0,.5);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">▶️</span></div>`
          :`<img src="${s.fileUrl}" style="width:100%;height:90px;object-fit:cover;display:block;" loading="lazy"/>`
        }
        <button onclick="removeCarouselSlide(${i})" style="position:absolute;top:4px;right:4px;background:rgba(220,38,38,.9);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>
        <button onclick="moveCarouselSlide(${i},-1)" style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:4px;width:20px;height:18px;font-size:11px;cursor:pointer;${i===0?'opacity:.3;pointer-events:none;':''}">‹</button>
        <button onclick="moveCarouselSlide(${i},1)" style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:4px;width:20px;height:18px;font-size:11px;cursor:pointer;${i===_carouselSlides.length-1?'opacity:.3;pointer-events:none;':''}">›</button>
      </div>
      <div style="font-size:9px;font-weight:700;color:var(--primary);text-align:center;padding:3px 4px;background:var(--primary-light);">
        ${isVid?'🎬':'🖼️'} Slide ${i+1}
      </div>
    </div>`;
  }

  // Show empty slots
  for(let i=_carouselSlides.length;i<maxSlides;i++){
    html+=`<label style="height:110px;border:2px dashed var(--border2);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:4px;transition:all .15s;" onmouseover="this.style.borderColor='var(--primary)';this.style.background='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border2)';this.style.background=''">
      <span style="font-size:20px;">➕</span>
      <span style="font-size:10px;font-weight:600;color:var(--text3);">Slide ${i+1}</span>
      <input type="file" accept="image/*,video/*" style="display:none;" onchange="addCarouselSlide(event,${i})"/>
    </label>`;
  }
  html+='</div>';
  cont.innerHTML=html;
  const counter=el('carousel-count');if(counter)counter.textContent=`${_carouselSlides.length}/${maxSlides} slides`;
}

async function addCarouselMultiple(e){
  const files=Array.from(e.target.files||[]);
  if(!files.length)return;
  const maxSlides=6;
  const available=maxSlides-_carouselSlides.length;
  const toProcess=files.slice(0,available);
  if(files.length>available)toast(`⚠️ Máx. ${maxSlides} slides — ${files.length-available} ignorados`,'warning');
  toast('⏳ Processando '+toProcess.length+' arquivo(s)...','info');
  for(const file of toProcess){
    try{
      let fileUrl,fileType;
      if(file.type.startsWith('image/')){fileUrl=await compressImage(file);fileType='image';}
      else{fileUrl=await fileToBase64(file).then(b=>'data:'+file.type+';base64,'+b);fileType='video';}
      _carouselSlides.push({fileUrl,fileType,thumb:'🖼️',caption:''});
    }catch(err){toast('Erro em '+file.name+': '+err.message,'error');}
  }
  renderCarouselSlots();
  toast(`✅ ${toProcess.length} slide(s) adicionados!`,'success');
  e.target.value='';
}

async function addCarouselSlide(e,idx){
  const file=e.target.files[0];if(!file)return;
  try{
    let fileUrl,fileType;
    if(file.type.startsWith('image/')){fileUrl=await compressImage(file);fileType='image';}
    else{fileUrl=await fileToBase64(file).then(b=>'data:'+file.type+';base64,'+b);fileType='video';}
    if(idx<_carouselSlides.length){_carouselSlides[idx]={fileUrl,fileType,thumb:'🖼️',caption:''};}
    else{_carouselSlides.push({fileUrl,fileType,thumb:'🖼️',caption:''});}
    renderCarouselSlots();toast(`✅ Slide ${idx+1} adicionado!`,'success');
  }catch(err){toast('Erro: '+err.message,'error');}
  e.target.value='';
}

function removeCarouselSlide(idx){_carouselSlides.splice(idx,1);renderCarouselSlots();}

function moveCarouselSlide(idx,dir){
  const newIdx=idx+dir;
  if(newIdx<0||newIdx>=_carouselSlides.length)return;
  const tmp=_carouselSlides[idx];
  _carouselSlides[idx]=_carouselSlides[newIdx];
  _carouselSlides[newIdx]=tmp;
  renderCarouselSlots();
}

// ── Modal Agendamento ─────────────────────────────────────────
function openNewAgendamento(){
  APP.editingId=null;
  APP._saving=false; // always reset — prevents stuck flag from previous session
  ['ag-title','ag-date','ag-caption','ag-tags'].forEach(id=>sv(id,''));
  sv('ag-platform','ig');sv('ag-status','pending');sv('ag-campaign','');
  const prev=el('ag-file-preview');
  if(prev)prev.innerHTML=`<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Arraste ou clique para selecionar</div><div class="upload-zone-sub">PNG, JPG, MP4 — máx. 15MB</div>`;
  sv('ag-file-data','');
  resetTipoBtns();_carouselSlides=[];toggleCarouselSection('image');renderCarouselSlots();
  setText('modalAgendTitulo','📅 Novo Agendamento');openModal('modalAgendamento');
}
function openPostEditor(id){
  const p=LOCAL.find('posts',id);if(!p)return;
  APP.editingId=id;
  APP._saving=false; // always reset
  sv('ag-title',p.title||'');sv('ag-platform',p.platform||'ig');sv('ag-date',p.date||'');
  sv('ag-campaign',p.campaign||'');sv('ag-caption',p.caption||'');sv('ag-tags',p.tags||'');sv('ag-status',p.status||'pending');
  document.querySelectorAll('.tipo-btn').forEach(b=>{b.classList.remove('active');b.style.cssText='';if(b.dataset.tipo===(p.type||'image')){b.classList.add('active');b.style.cssText='border-color:var(--primary);background:var(--primary-light);color:var(--primary);';}});
  toggleCarouselSection(p.type||'image');
  if(p.type==='carousel'&&p.slides){_carouselSlides=[...p.slides];renderCarouselSlots();}else{_carouselSlides=[];}
  const prev=el('ag-file-preview'),url=getFileUrl(p);
  if(prev&&p.type!=='carousel'){
    if(isVideo(p)){
      if(p.videoKey){
        // Load from IndexedDB for preview
        VDB.load(p.videoKey).then(blob=>{
          if(blob){const src=URL.createObjectURL(blob);prev.innerHTML=`<video src="${src}" controls style="width:100%;height:160px;background:#000;border-radius:var(--radius);display:block;" preload="metadata"></video>`;}
          else if(url){prev.innerHTML=`<div style="position:relative;"><img src="${url}" style="width:100%;height:120px;object-fit:cover;border-radius:var(--radius);"/><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);border-radius:var(--radius);">▶️</div></div>`;}
        });
        sv('ag-file-data',JSON.stringify({vKey:p.videoKey,thumb:p.fileUrl||'',name:p.videoName||'video.mp4',type:p.videoType||'video/mp4'}));
      } else if(url){
        prev.innerHTML=`<video src="${url}" controls style="width:100%;height:160px;background:#000;border-radius:var(--radius);display:block;" preload="metadata"></video>`;
        sv('ag-file-data',p.fileUrl||'');
      } else {
        prev.innerHTML=`<div style="height:120px;background:#111;border-radius:var(--radius);display:flex;align-items:center;justify-content:center;font-size:36px;">🎬</div>`;
        sv('ag-file-data','');
      }
    } else if(url){
      prev.innerHTML=`<img src="${url}" style="width:100%;height:120px;object-fit:cover;border-radius:var(--radius);display:block;"/>`;
      sv('ag-file-data',p.fileUrl||'');
    } else {
      prev.innerHTML=`<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Sem arquivo</div>`;
      sv('ag-file-data','');
    }
  }else if(prev){prev.innerHTML=`<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Arraste ou clique para substituir</div>`;sv('ag-file-data','');}
  setText('modalAgendTitulo','✏️ Editar Post');closeModal('modalPostDetail');openModal('modalAgendamento');
}
function toggleCarouselSection(tipo){
  const cs=el('carousel-section'),fs=el('file-section');
  if(tipo==='carousel'){
    if(cs)cs.style.display='block';
    if(fs)fs.style.display='none';
    // Render slots every time carousel is shown
    renderCarouselSlots();
  } else {
    if(cs)cs.style.display='none';
    if(fs)fs.style.display='block';
  }
}
function resetTipoBtns(){
  document.querySelectorAll('.tipo-btn').forEach((b,i)=>{b.classList.remove('active');b.style.cssText='';if(i===0){b.classList.add('active');b.style.cssText='border-color:var(--primary);background:var(--primary-light);color:var(--primary);';}});
  toggleCarouselSection('image');
}
function selectTipo(btn){document.querySelectorAll('.tipo-btn').forEach(b=>{b.classList.remove('active');b.style.cssText='';});btn.classList.add('active');btn.style.cssText='border-color:var(--primary);background:var(--primary-light);color:var(--primary);';toggleCarouselSection(btn.dataset.tipo);}

async function saveAgendamento(){
  const title=v('ag-title')?.trim(),platform=v('ag-platform');
  if(!title){toast('Informe o título. ⚠️','warning');return;}
  if(APP._saving){toast('Aguarde...','info');return;}
  APP._saving=true;
  const editingId=APP.editingId||null;
  const tipo=document.querySelector('.tipo-btn.active')?.dataset.tipo||'image';
  const fileRaw=v('ag-file-data');
  let fileUrl=null,fileType='image',videoKey=null,videoName=null,videoType=null;

  if(fileRaw){
    if(fileRaw.startsWith('{')){
      try{
        const fd=JSON.parse(fileRaw);
        if(fd.vKey){
          // Video stored in IndexedDB (local only)
          fileUrl=fd.thumb||null;
          fileType='video';
          videoKey=fd.vKey;
          videoName=fd.name||'video.mp4';
          videoType=fd.type||'video/mp4';
        } else if(fd.url&&fd.url.startsWith('http')){
          // Video stored in Firebase Storage (cross-device)
          fileUrl=fd.url;
          fileType='video';
          videoName=fd.name||'video.mp4';
          videoType=fd.type||'video/mp4';
        } else {
          fileUrl=fd.url||fd.thumb||null;
          fileType=fd.type||'image';
        }
      }catch{fileUrl=fileRaw;}
    } else if(fileRaw.startsWith('data:')||fileRaw.startsWith('http')){
      fileUrl=fileRaw;
      fileType=fileRaw.startsWith('data:video')?'video':'image';
    }
  }
  if(editingId&&!fileRaw&&tipo!=='carousel'){
    const orig=LOCAL.find('posts',editingId);
    if(orig){fileUrl=orig.fileUrl;fileType=orig.fileType;videoKey=orig.videoKey||null;videoName=orig.videoName||null;videoType=orig.videoType||null;}
  }
  const data={accountId:APP.currentAccountId||null,
    title,platform,
    date:v('ag-date')||'',
    campaign:v('ag-campaign')?.trim()||'',
    caption:v('ag-caption')?.trim()||'',
    tags:v('ag-tags')?.trim()||'',
    status:v('ag-status')||'pending',
    type:tipo,fileUrl,fileType,
    thumb:fileUrl?null:(TEMO[tipo]||'📸'),
    slides:tipo==='carousel'?[..._carouselSlides]:undefined,
  };
  if(videoKey){data.videoKey=videoKey;data.videoName=videoName;data.videoType=videoType;}
  // Close modal FIRST — always, regardless of what happens next
  closeModal('modalAgendamento');

  // Helper: wrap Firebase with 8s timeout so it never hangs
  const safeDB=(promise)=>Promise.race([
    promise,
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),8000))
  ]);

  try{
    if(editingId){
      try{await safeDB(DB.update('posts',editingId,data));}
      catch(e){console.warn('Firebase update failed:',e.message);}
      toast('Post atualizado! ✅','success');
      APP.editingId=null;
    } else {
      // CREATE: single path
      // If Firebase ready: FS.add → onSnapshot updates LOCAL (no manual LOCAL touch)
      // If Firebase offline: DB.add falls back to LOCAL.add internally
      try{ await safeDB(DB.add('posts',data)); }
      catch(e){
        // Timeout or Firebase error: ensure data is in LOCAL
        console.warn('DB.add:',e.message);
      }
      toast('Agendamento criado! 🗓️','success');
    }
  }catch(err){
    toast('Erro ao salvar: '+err.message,'error');
  } finally {
    APP._saving=false;
  }
  updateBadges();
  if(APP.currentPage==='agendamentos')applyAgendView(APP.agendView);
  else renderPage(APP.currentPage);
  updateCampaignCounts();
}
async function saveDraft(){if(APP._saving)return;const t=v('ag-title')?.trim()||'Rascunho '+new Date().toLocaleDateString('pt-BR');sv('ag-title',t);sv('ag-status','draft');await saveAgendamento();}
async function doDeletePost(id){
  const p=LOCAL.find('posts',id);if(!p||!confirm('Excluir "'+p.title+'"?'))return;
  DB.remove('posts',id).catch(()=>{});
  updateBadges();toast('Post excluído.','info');
  if(APP.currentPage==='agendamentos')applyAgendView(APP.agendView);else renderPage(APP.currentPage);
}
function doChangeStatus(id,ns){
  DB.update('posts',id,{status:ns}).catch(()=>{});
  updateBadges();closeModal('modalPostDetail');
  toast('Post '+({approved:'Aprovado! ✅',rejected:'Rejeitado ❌',pending:'Enviado para análise ⏳',review:'Em revisão 👁️'}[ns]||ns),ns==='approved'?'success':ns==='rejected'?'error':'info');
  if(APP.currentPage==='agendamentos')applyAgendView(APP.agendView);else renderPage(APP.currentPage);
  updateCampaignCounts();
}
function updateCampaignCounts(){
  const posts=LOCAL.get('posts');
  LOCAL.get('campaigns').forEach(c=>{const cp=posts.filter(p=>p.campaign===c.name);const upd={posts:cp.length,approved:cp.filter(p=>p.status==='approved').length,pending:cp.filter(p=>p.status==='pending').length,rejected:cp.filter(p=>p.status==='rejected').length};DB.update('campaigns',c.id,upd);});
}

// ── Share ─────────────────────────────────────────────────────
function openShareModal(id){
  const p=LOCAL.find('posts',id);if(!p)return;
  const base=window.location.origin+'/';
  const link=base+'?approval='+id;
  sv('share-link-input',link);
  // Thumbnail preview in modal
  const thumbDiv=el('share-thumb-preview');
  if(thumbDiv){
    const thumbUrl=p.type==='carousel'&&p.slides?.length?p.slides[0].fileUrl:getFileUrl(p);
    const isVid=p.type==='carousel'&&p.slides?.length?(p.slides[0].fileType==='video'):isVideo(p);
    if(thumbUrl&&!isVid){
      thumbDiv.innerHTML=`<img src="${thumbUrl}" style="width:100%;height:140px;object-fit:cover;border-radius:var(--radius-sm);display:block;" loading="lazy"/>`;
    } else if(isVid){
      thumbDiv.innerHTML=`<div style="height:140px;background:#111;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:36px;">▶️</div>`;
    } else {
      thumbDiv.innerHTML=`<div style="height:100px;background:var(--surface2);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:40px;">${p.thumb||'📷'}</div>`;
    }
    // Title & status overlay
    thumbDiv.innerHTML+=`<div style="margin-top:8px;"><div style="font-size:13px;font-weight:800;color:var(--text);">${esc(p.title)}</div><div style="display:flex;align-items:center;gap:6px;margin-top:4px;"><span class="badge ${SB[p.status]||'badge-gray'}" style="font-size:10px;">${SL[p.status]||p.status}</span><span class="si ${PSI[p.platform]||''}" style="width:16px;height:16px;font-size:7px;">${PSH[p.platform]||'?'}</span><span style="font-size:11px;color:var(--text3);">${p.date||''}</span></div></div>`;
  }
  el('share-wa').href=`https://wa.me/?text=${encodeURIComponent('Olá! Segue o criativo para sua aprovação:\n\n*'+p.title+'*\n\nAcesse o link abaixo para visualizar e aprovar:\n'+link+'\n\nAguardo seu retorno! 🙏')}`;
  el('share-email').href=`mailto:?subject=Criativo para Aprovação — ${encodeURIComponent(p.title)}&body=${encodeURIComponent('Olá!\n\nSegue o link para aprovação do criativo "'+p.title+'":\n\n'+link+'\n\nPor favor, acesse e deixe seu feedback.\n\nAguardo seu retorno!')}`;
  openModal('modalShare');
}
function copyLink(){const val=v('share-link-input');if(!val)return;navigator.clipboard?.writeText(val).then(()=>toast('Link copiado! 📋','success'));}
function openApprovalTab(){const link=v('share-link-input');if(link)window.open(link,'_blank','noopener');}

// ── PÁGINA DE APROVAÇÃO — sem redirecionar para login ─────────
function setupApprovalPage(){
  const id=new URLSearchParams(window.location.search).get('approval');
  if(!id)return;
  const hideAll=()=>{
    const lp=el('loginPage');if(lp)lp.style.display='none';
    const ap2=el('app');if(ap2)ap2.style.display='none';
    const ap=el('approvalPage');if(ap){ap.style.display='block';}
  };
  // Run as soon as DOM is ready
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{hideAll();loadApprovalPost(id);});
  } else {
    hideAll();
    loadApprovalPost(id);
  }
}

async function loadApprovalPost(id){
  const appEl=el('approvalPage');
  const showSpinner=(msg='Carregando...')=>{
    const card=appEl?.querySelector('.approval-card');
    if(card)card.innerHTML=`<div style="padding:80px 40px;text-align:center;"><div style="width:44px;height:44px;border:4px solid #FED7AA;border-top-color:#F97316;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 20px;"></div><div style="font-size:15px;color:#64748B;font-weight:700;">${msg}</div></div>`;
  };
  showSpinner('Carregando criativo...');

  // Helper: timeout wrapper
  const withTimeout=(promise,ms,fallback=null)=>Promise.race([promise,new Promise(r=>setTimeout(()=>r(fallback),ms))]);

  // 1. Wait for Firebase SDK (max 5s)
  await withTimeout(new Promise(resolve=>{
    if(typeof firebase!=='undefined'){resolve();return;}
    const t=setInterval(()=>{if(typeof firebase!=='undefined'){clearInterval(t);resolve();}},150);
  }),5000);

  // 2. Init + anonymous sign-in (all in one go, max 4s)
  try{
    initFirebase();
    if(_firebaseReady&&_auth&&!_auth.currentUser){
      await withTimeout(_auth.signInAnonymously(),3000);
    }
  }catch(e){}

  // 3. Fetch — try Firestore directly (allow read:if true), fallback localStorage
  let p=null;
  if(_firebaseReady&&_db){
    try{
      // Direct Firestore REST — bypasses auth issues entirely
      const snap=await withTimeout(_db.collection('posts').doc(id).get(),8000);
      if(snap&&snap.exists) p={id:snap.id,...snap.data()};
    }catch(e){console.warn('Firestore fetch:',e.message);}
  }
  if(!p) p=LOCAL.find('posts',id);

  if(!p){
    if(appEl)appEl.innerHTML=`<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,#FFF7ED,#F8FAFC);"><div style="text-align:center;max-width:400px;background:#fff;border-radius:16px;padding:40px;box-shadow:0 20px 40px rgba(0,0,0,.1);"><div style="font-size:56px;margin-bottom:16px;">😕</div><h2 style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:8px;">Post não encontrado</h2><p style="color:#64748B;font-size:14px;line-height:1.7;">Este link pode ter expirado ou o post foi removido.<br/>Peça um novo link ao criativo.</p></div></div>`;
    return;
  }
  window._approvalId=id;window._approvalPost=p;

  const thumbEl=el('ap-thumb');
  if(thumbEl){
    const url=getFileUrl(p);
    if(p.type==='carousel'&&p.slides?.length){
      thumbEl.innerHTML=`<div><div id="ap-carousel" style="background:var(--surface2);border-radius:var(--radius);overflow:hidden;min-height:200px;">${p.slides.map((s,i)=>`<div class="ap-slide" style="display:${i===0?'block':'none'};">${s.fileUrl?(s.fileType==='video'?`<video src="${s.fileUrl}" controls style="width:100%;max-height:350px;display:block;background:#000;"></video>`:`<img src="${s.fileUrl}" style="width:100%;max-height:350px;object-fit:contain;display:block;"/>`):`<div style="height:200px;display:flex;align-items:center;justify-content:center;font-size:56px;">${s.thumb||'🖼️'}</div>`}</div>`).join('')}</div><div style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:12px;"><button onclick="apCarouselNav(-1)" class="btn btn-secondary btn-sm">‹ Anterior</button><span id="ap-carousel-counter" style="font-size:12px;font-weight:700;color:var(--text3);">1/${p.slides.length}</span><button onclick="apCarouselNav(1)" class="btn btn-secondary btn-sm">Próximo ›</button></div></div>`;
      window._apSlideIdx=0;window._apSlides=p.slides;
    }else if(url&&!isVideo(p)){thumbEl.innerHTML=`<img src="${url}" style="width:100%;max-height:400px;object-fit:contain;display:block;"/>`;}
    else if(isVideo(p)){
      const remoteUrl=p.fileUrl&&p.fileUrl.startsWith('http')?p.fileUrl:(p.fileUrl&&p.fileUrl.startsWith('{')?(()=>{try{const d=JSON.parse(p.fileUrl);return d.url&&d.url.startsWith('http')?d.url:null;}catch{return null;}})():null);
      if(remoteUrl){
        thumbEl.innerHTML=`<video src="${remoteUrl}" controls style="width:100%;max-height:400px;display:block;background:#000;border-radius:var(--radius);" preload="metadata"></video>`;
      } else if(url){
        thumbEl.innerHTML=`<div style="position:relative;"><img src="${url}" style="width:100%;max-height:400px;object-fit:contain;display:block;border-radius:var(--radius);"/><div style="position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:var(--radius);"><span style="font-size:48px;">▶️</span><span style="font-size:12px;font-weight:700;color:#fff;background:rgba(0,0,0,.6);padding:6px 16px;border-radius:20px;text-align:center;">Prévia do vídeo<br/><span style="font-weight:400;font-size:11px;">Vídeo disponível apenas no device de origem</span></span></div></div>`;
      } else {
        thumbEl.innerHTML=`<div style="height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#111;border-radius:var(--radius);"><span style="font-size:56px;">▶️</span><span style="font-size:12px;color:#94A3B8;text-align:center;">Vídeo enviado para aprovação</span></div>`;
      }
    }
    else{thumbEl.innerHTML=`<div style="font-size:80px;padding:40px;text-align:center;">${p.thumb||'📷'}</div>`;}
  }

  setText('ap-title',p.title);setText('ap-platform',PL[p.platform]||p.platform);
  setText('ap-date',p.date||'—');setText('ap-campaign',p.campaign||'—');
  setText('ap-caption',p.caption||'Sem legenda.');
  const stEl=el('ap-status');
  if(stEl){stEl.className='badge '+(SB[p.status]||'badge-gray');stEl.textContent=SL[p.status]||p.status;}

  // Restaura comentário anterior
  if(p.clientComment){const ce=el('ap-comment');if(ce)ce.value=p.clientComment;}

  // Preenche workflow selector — use APP.kanbanCols or default cols
  const wfSel=el('ap-workflow-select');
  if(wfSel){
    const cols=APP.kanbanCols&&APP.kanbanCols.length?APP.kanbanCols:[
      {id:'draft',label:'Rascunho',icon:'📝',status:'draft'},
      {id:'content',label:'Conteúdo',icon:'📋',status:'content'},
      {id:'review',label:'Revisão',icon:'👁',status:'review'},
      {id:'approval',label:'Aprovação Cliente',icon:'⏳',status:'approval'},
      {id:'approved',label:'Aprovado',icon:'✅',status:'approved'},
      {id:'rejected',label:'Rejeitados',icon:'❌',status:'rejected'},
      {id:'published',label:'Publicado',icon:'🚀',status:'published'},
    ];
    wfSel.innerHTML=`<option value="">— Selecionar coluna —</option>`+
      cols.map(c=>`<option value="${c.id}" ${(p.status===c.id||p.status===c.status)?'selected':''}>${c.icon} ${c.label}</option>`).join('');
  }

  // Histórico da última ação
  const prevDiv=el('ap-prev-action');
  if(prevDiv){
    if(p.reviewAction&&p.reviewedAt){
      const msgs={approve:'✅ Aprovado',reject:'❌ Rejeitado',correct:'⚠️ Correção solicitada'};
      prevDiv.style.display='block';
      prevDiv.innerHTML=`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text3);">Última ação: <strong style="color:var(--text)">${msgs[p.reviewAction]||p.reviewAction}</strong> em ${new Date(p.reviewedAt).toLocaleString('pt-BR')}</div>`;
      // Buttons remain active — client can change decision
    }else{prevDiv.style.display='none';}
  }
  if(p.status!=='pending'&&p.status!=='draft'){showApprovalResult(p.status);}
}

function apCarouselNav(dir){
  const slides=window._apSlides;if(!slides)return;
  const newIdx=Math.max(0,Math.min(slides.length-1,(window._apSlideIdx||0)+dir));
  window._apSlideIdx=newIdx;
  document.querySelectorAll('.ap-slide').forEach((s,i)=>s.style.display=i===newIdx?'block':'none');
  const counter=el('ap-carousel-counter');if(counter)counter.textContent=`${newIdx+1}/${slides.length}`;
}

function showApprovalResult(status){
  const resultDiv=el('ap-result');if(!resultDiv)return;
  const cfg={approved:{bg:'#F0FDF4',color:'#16A34A',icon:'✅',text:'Aprovado! Obrigado pelo feedback.'},rejected:{bg:'#FEF2F2',color:'#DC2626',icon:'❌',text:'Rejeitado. O time foi notificado.'},pending:{bg:'#FFFBEB',color:'#D97706',icon:'⚠️',text:'Correção solicitada. O time foi notificado.'}}[status]||{bg:'#F8FAFC',color:'#64748B',icon:'ℹ️',text:'Resposta registrada.'};
  resultDiv.style.cssText=`display:block;text-align:center;padding:20px;margin-top:16px;border-radius:10px;background:${cfg.bg};border:1px solid ${cfg.color}30;`;
  resultDiv.innerHTML=`<div style="font-size:36px;margin-bottom:8px;">${cfg.icon}</div><div style="font-size:15px;font-weight:700;color:${cfg.color};">${cfg.text}</div>`;
}

async function approvalAction(action){
  const id=window._approvalId;if(!id){toast('Erro: ID não encontrado','error');return;}
  const ns={approve:'approved',reject:'rejected',correct:'pending'}[action];
  const comment=v('ap-comment')||'';
  const wfSel=el('ap-workflow-select');
  const workflowId=wfSel?wfSel.value:'';
  const _cols=APP.kanbanCols&&APP.kanbanCols.length?APP.kanbanCols:[{id:'draft',label:'Rascunho',status:'draft'},{id:'content',label:'Conteúdo',status:'content'},{id:'review',label:'Revisão',status:'review'},{id:'approval',label:'Aprovação Cliente',status:'approval'},{id:'approved',label:'Aprovado',status:'approved'},{id:'rejected',label:'Rejeitados',status:'rejected'},{id:'published',label:'Publicado',status:'published'}];
  const targetCol=workflowId?_cols.find(c=>c.id===workflowId):null;
  const finalStatus=targetCol?(targetCol.status||targetCol.id):ns;

  const updateData={status:finalStatus,clientComment:comment,reviewedAt:new Date().toISOString(),reviewAction:action,clientWorkflow:workflowId};

  // FIX III: save locally AND Firebase, triggers real-time listener in app
  LOCAL.update('posts',id,updateData);
  try{
    await DB.update('posts',id,updateData);
    toast({approve:'✅ Aprovado! O time foi notificado.',reject:'❌ Rejeitado. O time foi notificado.',correct:'⚠️ Correção solicitada.'}[action]||'Registrado!',action==='approve'?'success':action==='reject'?'error':'warning');
  }catch(err){toast('⚠️ Salvo localmente. Verifique conexão.','warning');}

  const stEl=el('ap-status');
  if(stEl){stEl.className='badge '+(action==='approve'?'badge-green':action==='reject'?'badge-red':'badge-yellow');stEl.textContent=action==='approve'?'✅ Aprovado':action==='reject'?'❌ Rejeitado':'⚠️ Correção Solicitada';}
  showApprovalResult(finalStatus);
  const prevDiv=el('ap-prev-action');
  if(prevDiv){const msgs={approve:'✅ Aprovado',reject:'❌ Rejeitado',correct:'⚠️ Correção solicitada'};prevDiv.style.display='block';prevDiv.innerHTML=`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text3);">Última ação: <strong>${msgs[action]}</strong> em ${new Date().toLocaleString('pt-BR')}</div>`;}
  // Do NOT disable buttons — client must be able to change action
}

async function saveApprovalComment(){
  const id=window._approvalId;if(!id){toast('Erro: ID não encontrado','error');return;}
  const comment=v('ap-comment')||'';
  if(!comment.trim()){toast('Digite um comentário.','warning');return;}
  const wfSel=el('ap-workflow-select');
  const workflowId=wfSel?wfSel.value:'';
  const updateData={clientComment:comment,commentSavedAt:new Date().toISOString()};
  const _cols2=APP.kanbanCols&&APP.kanbanCols.length?APP.kanbanCols:[{id:'draft',status:'draft'},{id:'content',status:'content'},{id:'review',status:'review'},{id:'approval',status:'approval'},{id:'approved',status:'approved'},{id:'rejected',status:'rejected'},{id:'published',status:'published'}];
  if(workflowId){const col=_cols2.find(c=>c.id===workflowId);if(col){updateData.status=col.status||col.id;updateData.clientWorkflow=workflowId;}}
  LOCAL.update('posts',id,updateData);
  try{
    await DB.update('posts',id,updateData);
    toast('💬 Comentário salvo!','success');
  }catch(err){toast('⚠️ Salvo localmente.','warning');}
  const btn=event?.target;
  if(btn){const orig=btn.textContent;btn.textContent='✅ Salvo!';btn.style.background='var(--green)';btn.style.color='#fff';setTimeout(()=>{btn.textContent=orig;btn.style.background='';btn.style.color='';},2000);}
}

// ── Contas ────────────────────────────────────────────────────
function renderContas(){
  const accounts=LOCAL.get('accounts'),grid=el('accountsGrid');if(!grid)return;
  // Update selection toolbar
  const delBtn=el('btn-del-contas'),selBtn=el('btn-sel-contas'),countEl=el('conta-sel-count');
  if(selBtn){selBtn.style.background=APP.contaSelMode?'var(--primary)':'';selBtn.style.color=APP.contaSelMode?'#fff':'';selBtn.style.borderColor=APP.contaSelMode?'var(--primary)':'';}
  if(delBtn){delBtn.style.display=APP.contaSelMode&&APP.contaSelection.size>0?'flex':'none';}
  if(countEl)countEl.textContent=APP.contaSelection.size;
  if(!accounts.length){grid.innerHTML=emptyS('🔗','Nenhuma conta','Clique em "+ Nova Conta".');return;}
  const bgMap={ig:'radial-gradient(circle at 30% 107%,#fdf497,#fd5949 45%,#d6249f 60%,#285AEB)',fb:'#1877F2',yt:'#FF0000',tt:'#111',li:'#0A66C2',tw:'#1DA1F2'};
  const selMode=APP.contaSelMode;
  grid.innerHTML=accounts.map(acc=>{
    const sel=APP.contaSelection.has(acc.id);
    const selStyle=sel?'outline:2.5px solid var(--primary);outline-offset:2px;':'';
    const cbHtml=selMode?`<div onclick="toggleContaSel('${acc.id}',event)" style="position:absolute;top:10px;right:10px;z-index:2;width:20px;height:20px;border-radius:6px;border:2px solid ${sel?'var(--primary)':'var(--border2)'};background:${sel?'var(--primary)':'var(--surface)'};display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .12s;">${sel?'<svg width="12" height="12" viewBox="0 0 12 12" fill="#fff"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>':''}</div>`:'';
    const clickCard=selMode?`onclick="toggleContaSel('${acc.id}',event)"`:'';
    return `<div class="account-card" style="position:relative;${selStyle}" ${clickCard}>${cbHtml}<div class="account-card-head"><div class="account-avatar" style="background:${bgMap[acc.platform]||'#888'};color:#fff;font-size:14px;font-weight:800;">${PSH[acc.platform]||'?'}</div><div class="account-info"><div class="account-name">${esc(acc.name)}</div><div class="account-handle">${esc(acc.handle)}</div></div><span class="badge ${acc.status==='active'?'badge-green':'badge-gray'}">${acc.status==='active'?'Ativo':'Inativo'}</span></div><div class="account-stats"><div class="account-stat"><div class="account-stat-val">${acc.followers||'0'}</div><div class="account-stat-label">Seguidores</div></div><div class="account-stat"><div class="account-stat-val">${acc.engagement||'—'}</div><div class="account-stat-label">Engajamento</div></div><div class="account-stat"><div class="account-stat-val">${acc.posts||0}</div><div class="account-stat-label">Posts</div></div><div class="account-stat"><div class="account-stat-val">${PL[acc.platform]||acc.platform}</div><div class="account-stat-label">Plataforma</div></div></div>${acc.platform==='ig'?`<div style="padding:10px 20px;border-top:1px solid var(--border);">${acc.igConnected?`<div style="font-size:12px;color:var(--green);font-weight:600;">✅ Instagram conectado</div>`:`<button class="btn btn-sm btn-primary" style="width:100%;justify-content:center;" onclick="openModal('modalIgSetup')">🔗 Conectar Instagram via API</button>`}</div>`:''}<div class="account-card-footer"${selMode?' style="pointer-events:none;opacity:.5;"':''}><button class="btn btn-sm btn-danger" onclick="doRemoveAccount('${acc.id}')">🗑️ Remover</button><div style="display:flex;gap:6px;"><button class="btn btn-sm btn-secondary" onclick="editAccount('${acc.id}')">✏️ Editar</button><button class="btn btn-sm btn-primary" onclick="doSyncAccount('${acc.id}')">🔄 Sync</button></div></div></div>`;
  }).join('');
}
function toggleContaSelMode(){
  APP.contaSelMode=!APP.contaSelMode;
  APP.contaSelection.clear();
  renderContas();
}
function toggleContaSel(id,e){
  if(e){e.stopPropagation();}
  if(APP.contaSelection.has(id)){APP.contaSelection.delete(id);}else{APP.contaSelection.add(id);}
  renderContas();
}
async function deleteSelectedContas(){
  const ids=[...APP.contaSelection];
  if(!ids.length)return;
  if(!confirm(`Remover ${ids.length} conta(s) selecionada(s)? Esta ação não pode ser desfeita.`))return;
  for(const id of ids){
    DB.remove('accounts',id).catch(()=>{});
  }
  APP.contaSelection.clear();
  APP.contaSelMode=false;
  updateBadges();
  renderContas();
  toast(`🗑️ ${ids.length} conta(s) removida(s).`,'success');
}
async function doSyncAccount(id){const a=LOCAL.find('accounts',id);if(!a)return;toast('Sincronizando...','info');await new Promise(r=>setTimeout(r,1200));const upd={posts:(a.posts||0)+Math.floor(Math.random()*5)+1};LOCAL.update('accounts',id,upd);DB.update('accounts',id,upd);renderContas();toast(a.name+' sincronizado! ✅','success');}
async function doRemoveAccount(id){const a=LOCAL.find('accounts',id);if(!a||!confirm('Remover "'+a.name+'"?'))return;DB.remove('accounts',id);updateBadges();renderContas();toast('Conta removida.','info');}
function editAccount(id){const a=LOCAL.find('accounts',id);if(!a)return;APP.editingId=id;sv('acc-platform',a.platform);sv('acc-handle',a.handle.replace('@',''));sv('acc-name',a.name);sv('acc-followers',a.followersNum||0);sv('acc-engagement',a.engagement||'');setText('modalContaTitle','✏️ Editar Conta');openModal('modalConta');}
function openNewConta(){APP.editingId=null;['acc-handle','acc-name','acc-followers','acc-engagement'].forEach(id=>sv(id,''));sv('acc-platform','ig');setText('modalContaTitle','🔗 Conectar Nova Conta');openModal('modalConta');}
async function saveAccount(){
  const platform=v('acc-platform'),handle=v('acc-handle')?.trim();const name=v('acc-name')?.trim()||('AHA '+(PL[platform]||platform));const followersN=parseInt(v('acc-followers'))||0,engagement=v('acc-engagement')?.trim()||'0%';
  if(!platform||!handle){toast('Preencha plataforma e @usuário.','warning');return;}
  const data={name,handle:handle.startsWith('@')?handle:'@'+handle,platform,followers:followersN>=1000?(followersN/1000).toFixed(1)+'K':String(followersN),followersNum:followersN,engagement,posts:0,status:'active',igConnected:false};
  closeModal('modalConta');
  if(APP.editingId){
    LOCAL.update('accounts',APP.editingId,data);
    DB.update('accounts',APP.editingId,data).catch(()=>{});
    toast('Conta atualizada! ✅','success');
    APP.editingId=null;
  } else {
    await DB.add('accounts',data); // II: DB.add gerencia LOCAL+Firebase sem duplicar
    toast('Conta conectada! 🔗','success');
  }
  updateBadges();renderContas();
}

// ── Campanhas ─────────────────────────────────────────────────
function renderCampanhas(){
  const camps=LOCAL.get('campaigns'),cont=el('campanhas-list');if(!cont)return;
  const SLc={active:'Ativa',paused:'Pausada',ended:'Encerrada'},SBc={active:'badge-green',paused:'badge-yellow',ended:'badge-gray'};
  cont.innerHTML=camps.map(c=>{const prog=c.posts?Math.round((c.approved/c.posts)*100):0;const plats=(c.platforms||'').split(',').filter(Boolean);return`<div class="chart-card" style="margin-bottom:14px;"><div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;"><div><div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:3px;">${esc(c.name)}</div><div style="font-size:12px;color:var(--text3);">📅 ${c.start||'—'} → ${c.end||'—'}</div>${c.desc?`<div style="font-size:12px;color:var(--text3);margin-top:2px;">${esc(c.desc)}</div>`:''}</div><div style="display:flex;align-items:center;gap:8px;">${plats.map(pl=>`<span class="si ${PSI[pl]||''}" style="width:22px;height:22px;font-size:9px;">${PSH[pl]||'?'}</span>`).join('')}<span class="badge ${SBc[c.status]||'badge-gray'}">${SLc[c.status]||c.status}</span></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;"><div style="text-align:center;"><div style="font-size:22px;font-weight:800;">${c.posts}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-top:2px;">Posts</div></div><div style="text-align:center;"><div style="font-size:22px;font-weight:800;color:var(--green);">${c.approved}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-top:2px;">Aprovados</div></div><div style="text-align:center;"><div style="font-size:22px;font-weight:800;color:var(--yellow);">${c.pending}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-top:2px;">Pendentes</div></div><div style="text-align:center;"><div style="font-size:22px;font-weight:800;">${c.budget||'—'}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-top:2px;">Budget</div></div></div><div style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:11px;color:var(--text3);"><span>Progresso</span><span style="font-weight:700;color:${prog>=80?'var(--green)':prog>=50?'var(--yellow)':'var(--primary)'};">${prog}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${prog}%;background:${prog>=80?'var(--green)':prog>=50?'var(--yellow)':'var(--primary)'};"></div></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-sm btn-primary" onclick="editCampaign('${c.id}')">✏️ Editar</button><button class="btn btn-sm btn-secondary" onclick="exportCampReport('${c.id}')">📊 Relatório</button><button class="btn btn-sm btn-secondary" onclick="doToggleCamp('${c.id}','${c.status}')">${c.status==='active'?'⏸ Pausar':'▶ Ativar'}</button><button class="btn btn-sm btn-danger" onclick="doDeleteCamp('${c.id}')">🗑️</button></div></div>`;}).join('')||emptyS('📋','Nenhuma campanha','Crie sua primeira campanha.');
  const active=camps.filter(c=>c.status==='active').length;const tb=camps.reduce((s,c)=>{const n=parseFloat((c.budget||'0').replace(/[^\d.]/g,''));return s+n;},0);const tp=camps.reduce((s,c)=>s+c.posts,0),ta=camps.reduce((s,c)=>s+c.approved,0);
  setSafe('camp-metric-active',active);setSafe('camp-metric-budget','R$ '+(tb/1000).toFixed(0)+'K');setSafe('camp-metric-posts',tp);setSafe('camp-metric-rate',tp?Math.round((ta/tp)*100)+'%':'—');
}
function editCampaign(id){const c=LOCAL.find('campaigns',id);if(!c)return;APP.editingId=id;sv('camp-name',c.name);sv('camp-start',c.start);sv('camp-end',c.end);sv('camp-budget',c.budget);sv('camp-desc',c.desc||'');document.querySelectorAll('.camp-plat-check').forEach(cb=>cb.checked=false);(c.platforms||'').split(',').forEach(pl=>{const cb=document.querySelector('.camp-plat-check[value="'+pl+'"]');if(cb)cb.checked=true;});setText('modalCampanhaTitulo','✏️ Editar Campanha');openModal('modalCampanha');}
function openNewCampanha(){APP.editingId=null;['camp-name','camp-start','camp-end','camp-budget','camp-desc'].forEach(id=>sv(id,''));document.querySelectorAll('.camp-plat-check').forEach(c=>c.checked=false);setText('modalCampanhaTitulo','📋 Nova Campanha');openModal('modalCampanha');}
async function saveCampanha(){const name=v('camp-name')?.trim();if(!name){toast('Informe o nome.','warning');return;}const plats=[...document.querySelectorAll('.camp-plat-check:checked')].map(x=>x.value).join(',')||'ig';const data={name,start:v('camp-start'),end:v('camp-end'),budget:v('camp-budget')?.trim(),desc:v('camp-desc')?.trim(),platforms:plats,status:'active',posts:0,approved:0,pending:0,rejected:0};closeModal('modalCampanha');if(APP.editingId){
    LOCAL.update('campaigns',APP.editingId,data);
    DB.update('campaigns',APP.editingId,data).catch(()=>{});
    toast('Campanha atualizada! ✅','success');
    APP.editingId=null;
  }else{
    // DB.add gerencia LOCAL+Firebase sem duplicar
    DB.add('campaigns',data).catch(()=>{}); // async, onSnapshot will update LOCAL
    toast('Campanha criada! 🚀','success');
  }
  renderCampanhas();}
function doToggleCamp(id,cur){const ns=cur==='active'?'paused':'active';LOCAL.update('campaigns',id,{status:ns});DB.update('campaigns',id,{status:ns});renderCampanhas();toast('Campanha '+(ns==='active'?'ativada ▶':'pausada ⏸'),'info');}
function doDeleteCamp(id){const c=LOCAL.find('campaigns',id);if(!c||!confirm('Excluir "'+c.name+'"?'))return;DB.remove('campaigns',id);renderCampanhas();toast('Campanha excluída.','info');}
function exportCampReport(id){const c=LOCAL.find('campaigns',id);if(!c)return;const prog=c.posts?Math.round((c.approved/c.posts)*100):0;const txt=`RELATÓRIO — AHA Social Planning\n${'='.repeat(50)}\nCampanha: ${c.name}\nStatus: ${c.status}\nPeríodo: ${c.start||'—'} → ${c.end||'—'}\nBudget: ${c.budget||'—'}\nPosts: ${c.posts} | Aprovados: ${c.approved} | Pendentes: ${c.pending} | Rejeitados: ${c.rejected}\nTaxa: ${prog}%\n\nGerado: ${new Date().toLocaleString('pt-BR')}\nAHA Social Planning © 2026`;dlText(txt,c.name.replace(/\s+/g,'_')+'_relatorio.txt');toast('Relatório exportado! 📊','success');}

// ── Tráfego ───────────────────────────────────────────────────
function renderTrafego(){
  ['chartTrafego','chartInvest'].forEach(id=>{if(APP.charts[id]){try{APP.charts[id].destroy();}catch{}delete APP.charts[id];}});
  const tip={enabled:true,backgroundColor:'#0F172A',titleColor:'#fff',bodyColor:'#94A3B8',padding:12,cornerRadius:8};const tc={font:{family:"'Aileron',sans-serif",size:11},color:'#94A3B8'};
  mkC('chartTrafego','bar',{labels:['Instagram','Facebook','Google Ads','TikTok','YouTube'],datasets:[{label:'CPC (R$)',data:[1.20,0.85,2.10,0.65,1.80],backgroundColor:'#F97316',borderRadius:6,borderSkipped:false},{label:'CPM (R$)',data:[12,8,18,6,15],backgroundColor:'#7C3AED',borderRadius:6,borderSkipped:false}]},{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{family:"'Aileron',sans-serif",size:11},boxWidth:12}},tooltip:tip},scales:{x:{grid:{display:false},ticks:tc},y:{grid:{color:'rgba(226,232,240,.6)'},ticks:{...tc,callback:v=>'R$ '+v.toFixed(2)}}}});
  const ci=el('chartInvest');if(ci)APP.charts.chartInvest=new Chart(ci,{type:'doughnut',data:{labels:['Instagram','Facebook','Google','TikTok'],datasets:[{data:[34,23,28,15],backgroundColor:['#F97316','#1877F2','#4285F4','#333'],borderWidth:3,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{position:'right',labels:{font:{family:"'Aileron',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip}}});
}

// ── Modals ────────────────────────────────────────────────────
function openModal(id){const e=el(id);if(e){e.classList.add('open');document.body.style.overflow='hidden';}}
function closeModal(id){
  if(id){
    const e=el(id);if(e)e.classList.remove('open');
    // Reset editingId only when closing the agendamento modal (not post detail)
    if(id==='modalAgendamento')APP.editingId=null;
  } else {
    document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
    APP.editingId=null;
  }
  document.body.style.overflow='';
}

// ── Toast ─────────────────────────────────────────────────────
let _tq=[],_tr=false;
function toast(msg,type='info'){_tq.push({msg,type});if(!_tr)_pTQ();}
window.showToast=(m,t)=>toast(m,t);
function _pTQ(){if(!_tq.length){_tr=false;return;}_tr=true;const{msg,type}=_tq.shift(),t=el('toast');if(!t)return;t.querySelector('.toast-icon').textContent={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'}[type]||'ℹ️';t.querySelector('.toast-title').textContent=msg;t.className='toast show toast-'+type;const ln=t.querySelector('.toast-line');if(ln){ln.style.animation='none';setTimeout(()=>ln.style.animation='',10);}setTimeout(()=>{t.classList.remove('show');setTimeout(_pTQ,300);},3500);}

// ── Extras ────────────────────────────────────────────────────
function exportPostsCSV(){const ps=LOCAL.get('posts');if(!ps.length){toast('Nenhum post.','warning');return;}const h='Título,Plataforma,Status,Data,Campanha,Tipo';const rows=ps.map(p=>[p.title,p.platform,p.status,p.date,p.campaign,p.type].map(x=>'"'+(x||'').replace(/"/g,'""')+'"').join(','));const csv=[h,...rows].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download='aha_posts.csv';a.click();toast('CSV exportado! 📥','success');}

// ── Selection CSS injection ──────────────────────────────────
(function(){
  const s=document.createElement('style');
  s.textContent=`.post-card-selected{outline:2px solid var(--primary);outline-offset:1px;box-shadow:0 0 0 4px var(--primary-glow)!important;}.post-card-selected .post-card-thumb::after{content:'';position:absolute;inset:0;background:rgba(249,115,22,.08);z-index:1;}`;
  document.head.appendChild(s);
})();

// ── Utils ─────────────────────────────────────────────────────
const el=(id)=>document.getElementById(id);
const setText=(id,val)=>{const e=el(id);if(e)e.textContent=val;};
const setSafe=(id,val)=>{const e=el(id);if(e)e.textContent=val;};
const sv=(id,val)=>{const e=el(id);if(e&&val!==undefined&&val!==null)e.value=val;};
const v=(id)=>el(id)?.value||'';
const esc=(s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const emptyS=(icon,t,s)=>`<div class="empty-state"><div class="empty-state-icon">${icon}</div><div class="empty-state-title">${t}</div><div class="empty-state-sub">${s}</div></div>`;
const dlText=(txt,fn)=>{const a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);a.download=fn;a.click();};
