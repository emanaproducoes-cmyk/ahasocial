// ═══════════════════════════════════════════════════════════════
// app.js — AHA Social Planning v3
// Multi-usuário Firebase + Instagram API + Upload real
// ═══════════════════════════════════════════════════════════════

const APP = {
  user:        null,
  currentPage: 'dashboard',
  charts:      {},
  editingId:   null,
  unsubs:      [], // listeners Firebase ativos
};

// ─── Constantes ──────────────────────────────────────────────
const PL   = { ig:'Instagram', fb:'Facebook', yt:'YouTube', tt:'TikTok', li:'LinkedIn', tw:'Twitter/X' };
const PSI  = { ig:'si-ig', fb:'si-fb', yt:'si-yt', tt:'si-tt', li:'si-li' };
const PSH  = { ig:'IG', fb:'FB', yt:'YT', tt:'TT', li:'IN', tw:'X' };
const SL   = { pending:'Em Análise', approved:'Aprovado', rejected:'Rejeitado', scheduled:'Agendado', draft:'Rascunho' };
const SB   = { pending:'badge-yellow', approved:'badge-green', rejected:'badge-red', scheduled:'badge-blue', draft:'badge-gray' };
const TEMO = { image:'📸', video:'🎬', story:'📱', reel:'🎵', carousel:'🎠' };

// ─── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  checkApprovalMode();
  initFirebase(); // tenta conectar Firebase

  // Ouve mudança de autenticação
  AUTH.onAuthChange(async firebaseUser => {
    if (firebaseUser) {
      const name   = firebaseUser.displayName || firebaseUser.email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const avatar = name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
      APP.user = { uid: firebaseUser.uid, email: firebaseUser.email, name, avatar, photo: firebaseUser.photoURL, role:'Gerente de Conteúdo' };
      localStorage.setItem('aha_user', JSON.stringify(APP.user));
      showApp();
    } else {
      // Sem Firebase auth, tenta localStorage
      const saved = getSavedUser();
      if (saved) { APP.user = saved; showApp(); }
    }
  });
});

function getSavedUser() {
  try { return JSON.parse(localStorage.getItem('aha_user')); } catch { return null; }
}

// ─── Auth ────────────────────────────────────────────────────
async function doLogin() {
  const email = v('loginEmail')?.trim();
  const pass  = v('loginPass');
  if (!email) { toast('Informe seu e-mail.', 'warning'); return; }
  if (!pass || pass.length < 6) { toast('Senha com 6+ caracteres.', 'warning'); return; }

  showLoadingBtn('btn-login-email', 'Entrando...');
  if (_firebaseReady) {
    const user = await AUTH.loginEmail(email, pass);
    if (!user) { toast('E-mail ou senha incorretos.', 'error'); resetBtn('btn-login-email', 'Entrar na plataforma →'); return; }
    // onAuthChange cuida do resto
  } else {
    // Modo offline
    const name   = email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    const avatar = name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
    APP.user = { email, name, avatar, role:'Gerente de Conteúdo' };
    localStorage.setItem('aha_user', JSON.stringify(APP.user));
    toast('Bem-vindo! (modo offline — dados só neste dispositivo)', 'warning');
    showApp();
  }
}

async function doGoogleLogin() {
  showLoadingBtn('btn-google', 'Conectando...');
  if (_firebaseReady) {
    const user = await AUTH.loginGoogle();
    if (!user) { toast('Erro no login com Google.', 'error'); resetBtn('btn-google', 'Continuar com Google'); }
    // onAuthChange cuida do resto
  } else {
    APP.user = { email:'usuario@gmail.com', name:'Usuário Google', avatar:'UG', role:'Gerente de Conteúdo' };
    localStorage.setItem('aha_user', JSON.stringify(APP.user));
    toast('Login simulado (Firebase não configurado)', 'warning');
    showApp();
  }
}

function doLogout() {
  APP.unsubs.forEach(u => { try { u(); } catch {} });
  APP.unsubs = [];
  localStorage.removeItem('aha_user');
  APP.user = null;
  el('loginPage').style.display = 'flex';
  el('app').style.display = 'none';
  AUTH.logout();
}

function showApp() {
  el('loginPage').style.display = 'none';
  el('app').style.display = 'block';
  const u = APP.user;
  setText('topAvatar',    u.avatar || 'U');
  setText('sideAvatar',   u.avatar || 'U');
  setText('sideUserName', u.name   || 'Usuário');
  if (u.photo) {
    ['topAvatar','sideAvatar'].forEach(id => {
      const e = el(id);
      if (e) { e.style.backgroundImage = `url(${u.photo})`; e.style.backgroundSize = 'cover'; e.textContent = ''; }
    });
  }
  // Avisa se sem Firebase
  if (!_firebaseReady) {
    setTimeout(() => toast('⚠️ Firebase não configurado — dados salvos só neste dispositivo. Configure o Firebase para multi-usuário.', 'warning'), 1500);
  }
  if (!LOCAL.get('posts').length) seed();
  startListeners();
  initApp();
}

// ─── Seed (apenas se banco vazio) ────────────────────────────
function seed() {
  LOCAL.set('posts', [
    {id:'p1',title:'Black Friday 2026 — Instagram',status:'approved',platform:'ig',type:'image',date:'2026-03-25',caption:'A maior promoção! Até 60% OFF. 🛒🔥 #blackfriday',campaign:'Black Friday 2026',tags:'promoção,oferta',thumb:'🛒',fileUrl:null,fileType:'image',createdAt:'2026-03-25T10:00:00Z'},
    {id:'p2',title:'Stories — Lançamento Produto X',status:'pending',platform:'ig',type:'story',date:'2026-03-27',caption:'Algo novo está chegando! 👀✨',campaign:'Lançamento X',tags:'novo,teaser',thumb:'👀',fileUrl:null,fileType:'image',createdAt:'2026-03-27T09:00:00Z'},
    {id:'p3',title:'YouTube — Tutorial Completo',status:'approved',platform:'yt',type:'video',date:'2026-03-20',caption:'Do zero ao avançado em 20 minutos.',campaign:'Conteúdo Orgânico',tags:'tutorial,dicas',thumb:'🎬',fileUrl:null,fileType:'image',createdAt:'2026-03-20T14:00:00Z'},
    {id:'p4',title:'Facebook — Campanha Awareness',status:'rejected',platform:'fb',type:'image',date:'2026-03-18',caption:'Conecte-se com quem importa. #família',campaign:'Awareness Q1',tags:'awareness',thumb:'💙',fileUrl:null,fileType:'image',createdAt:'2026-03-18T11:00:00Z'},
    {id:'p5',title:'TikTok — Trend Dance',status:'pending',platform:'tt',type:'video',date:'2026-03-29',caption:'A trend mais quente da semana! 🕺🎵',campaign:'TikTok Orgânico',tags:'trend,viral',thumb:'🕺',fileUrl:null,fileType:'image',createdAt:'2026-03-29T16:00:00Z'},
  ]);
  LOCAL.set('accounts', [
    {id:'a1',name:'AHA Publicità',handle:'@ahapublicita',platform:'ig',followers:'48.2K',followersNum:48200,engagement:'4.8%',posts:342,status:'active',igConnected:false,createdAt:'2026-01-01T00:00:00Z'},
    {id:'a2',name:'AHA Publicità',handle:'AHA Publicità',platform:'fb',followers:'32.1K',followersNum:32100,engagement:'2.3%',posts:285,status:'active',igConnected:false,createdAt:'2026-01-01T00:00:00Z'},
  ]);
  LOCAL.set('campaigns', [
    {id:'c1',name:'Black Friday 2026',status:'active',start:'2026-03-01',end:'2026-03-31',budget:'R$ 15.000',posts:24,approved:18,pending:4,rejected:2,platforms:'ig,fb,tt',desc:'Foco em conversão com 60% OFF.',createdAt:'2026-03-01T00:00:00Z'},
    {id:'c2',name:'Lançamento Produto X',status:'active',start:'2026-03-20',end:'2026-04-15',budget:'R$ 8.500',posts:12,approved:7,pending:3,rejected:2,platforms:'ig,yt',desc:'Teaser e reveal do novo produto.',createdAt:'2026-03-20T00:00:00Z'},
  ]);
}

// ─── Listeners tempo real ─────────────────────────────────────
function startListeners() {
  APP.unsubs.forEach(u => { try { u(); } catch {} });
  APP.unsubs = [];
  // Listeners para cada coleção — atualizam UI automaticamente quando outro usuário muda algo
  APP.unsubs.push(DB.listen('posts', posts => {
    LOCAL.set('posts', posts);
    updateBadges();
    if (['posts','analise','aprovados','rejeitados','agendamentos','dashboard'].includes(APP.currentPage)) {
      renderPage(APP.currentPage);
    }
  }));
  APP.unsubs.push(DB.listen('accounts', accounts => {
    LOCAL.set('accounts', accounts);
    updateBadges();
    if (APP.currentPage === 'contas') renderContas();
  }));
  APP.unsubs.push(DB.listen('campaigns', campaigns => {
    LOCAL.set('campaigns', campaigns);
    if (APP.currentPage === 'campanhas') renderCampanhas();
  }));
}

function initApp() { updateBadges(); renderDashboard(); }

// ─── Navegação ────────────────────────────────────────────────
function showPage(page, btn) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const sec = el('sec-' + page);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');
  APP.currentPage = page;
  const titles = { dashboard:'Dashboard', contas:'Contas', agendamentos:'Agendamentos', posts:'Posts', analise:'Em Análise', aprovados:'Aprovados', rejeitados:'Rejeitados', campanhas:'Campanhas', trafego:'Tráfego Pago' };
  setText('pageTitle', titles[page] || page);
  if (window.innerWidth < 960) el('sidebar').classList.remove('mobile-open');
  renderPage(page);
}
function renderPage(page) {
  const r = {
    dashboard:    renderDashboard,
    contas:       renderContas,
    agendamentos: renderAgendamentos,
    posts:        () => renderGrid('posts-grid',    LOCAL.get('posts')),
    analise:      () => renderGrid('analise-grid',  LOCAL.get('posts').filter(p=>p.status==='pending')),
    aprovados:    () => renderGrid('aprovados-grid',LOCAL.get('posts').filter(p=>p.status==='approved')),
    rejeitados:   () => renderGrid('rejeitados-grid',LOCAL.get('posts').filter(p=>p.status==='rejected')),
    campanhas:    renderCampanhas,
    trafego:      renderTrafego,
  };
  if (r[page]) r[page]();
}
function toggleMobile() { el('sidebar').classList.toggle('mobile-open'); }
function updateBadges() {
  const posts = LOCAL.get('posts'), accs = LOCAL.get('accounts');
  setSafe('badge-contas',    accs.length);
  setSafe('badge-analise',   posts.filter(p=>p.status==='pending').length);
  setSafe('badge-rejeitados',posts.filter(p=>p.status==='rejected').length);
}

// ─── Thumbnail helper ─────────────────────────────────────────
function thumb(p, size=36, full=false) {
  const url = p.fileUrl;
  if (url) {
    const isVid = p.fileType === 'video' || url.match(/\.(mp4|webm|mov)/i);
    if (full) {
      return isVid
        ? `<video src="${url}" controls style="width:100%;max-height:280px;object-fit:contain;background:#000;"></video>`
        : `<img src="${url}" style="width:100%;max-height:280px;object-fit:contain;background:var(--surface2);" loading="lazy"/>`;
    }
    return isVid
      ? `<div style="width:${size}px;height:${size}px;background:#000;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:${size*.5}px;vertical-align:middle;">🎬</div>`
      : `<img src="${url}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:6px;vertical-align:middle;" loading="lazy"/>`;
  }
  const emoji = p.thumb || '📷';
  if (full) return `<div style="font-size:72px;display:flex;align-items:center;justify-content:center;height:200px;background:var(--surface2);">${emoji}</div>`;
  return `<span style="font-size:${size*.7}px;vertical-align:middle;">${emoji}</span>`;
}

// ─── Thumbnail para card (fundo da área) ─────────────────────
function thumbBg(p) {
  if (p.fileUrl) {
    const isVid = p.fileType === 'video' || p.fileUrl.match(/\.(mp4|webm|mov)/i);
    if (isVid) return `<div style="position:absolute;inset:0;background:#000;display:flex;align-items:center;justify-content:center;font-size:40px;">🎬</div>`;
    return `<div style="position:absolute;inset:0;background-image:url('${p.fileUrl}');background-size:cover;background-position:center;"></div>`;
  }
  return `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:40px;background:linear-gradient(135deg,var(--surface2),var(--surface3));">${p.thumb||'📷'}</div>`;
}

// ─── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  const posts = LOCAL.get('posts');
  setText('kpi-total',    posts.length);
  setText('kpi-approved', posts.filter(p=>p.status==='approved').length);
  setText('kpi-pending',  posts.filter(p=>p.status==='pending').length);
  setText('kpi-rejected', posts.filter(p=>p.status==='rejected').length);
  initCharts();
  renderRecentTable();
}
function renderRecentTable() {
  const tbody = el('recent-posts-tbody'); if (!tbody) return;
  const posts = LOCAL.get('posts').slice(0, 6);
  tbody.innerHTML = posts.map(p => `
  <tr onclick="openPostDetail('${p.id}')" style="cursor:pointer;">
    <td style="display:flex;align-items:center;gap:10px;">${thumb(p,32)} <span class="td-primary">${esc(p.title)}</span></td>
    <td><span class="si ${PSI[p.platform]||''}" style="width:22px;height:22px;font-size:9px;">${PSH[p.platform]||'?'}</span></td>
    <td><span class="badge ${SB[p.status]||'badge-gray'}">${SL[p.status]||p.status}</span></td>
    <td class="td-mono">${p.date||'—'}</td>
    <td><button class="btn btn-xs btn-primary" onclick="event.stopPropagation();openShareModal('${p.id}')">📤 Link</button></td>
  </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3);">Nenhum post ainda.</td></tr>';
}
function initCharts() {
  Object.values(APP.charts).forEach(c => { try { c.destroy(); } catch {} }); APP.charts = {};
  const tip = { enabled:true, backgroundColor:'#0F172A', titleColor:'#fff', bodyColor:'#94A3B8', padding:12, cornerRadius:8, titleFont:{family:"'DM Sans',sans-serif",weight:'700',size:13}, bodyFont:{family:"'DM Sans',sans-serif",size:12}, borderColor:'#1E293B', borderWidth:1, displayColors:true, boxPadding:4 };
  const g = 'rgba(226,232,240,0.6)', tc = { font:{family:"'DM Sans',sans-serif",size:11}, color:'#94A3B8' };
  const mo = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul'], posts = LOCAL.get('posts');
  mkC('chartEngajamento','line',{labels:mo,datasets:[
    {label:'Instagram',data:[4200,4800,5100,6300,5900,7200,8100],borderColor:'#F97316',backgroundColor:'rgba(249,115,22,.1)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5},
    {label:'Facebook', data:[2100,2400,2200,2800,2600,3100,3400],borderColor:'#1877F2',backgroundColor:'rgba(24,119,242,.07)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5},
    {label:'TikTok',   data:[800,1200,2100,3400,2900,4100,5200], borderColor:'#555',  backgroundColor:'rgba(0,0,0,.04)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5},
  ]},{interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,position:'bottom',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip},scales:{x:{grid:{color:g},ticks:tc},y:{grid:{color:g},ticks:tc}}});
  mkC('chartPlatforms','doughnut',{labels:['Instagram','Facebook','YouTube','TikTok','LinkedIn'],datasets:[{data:[38,24,14,17,7],backgroundColor:['#F97316','#1877F2','#FF0000','#333','#0A66C2'],borderWidth:3,borderColor:'#fff',hoverBorderWidth:4}]},{cutout:'65%',plugins:{legend:{position:'right',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip}});
  mkC('chartPosts','bar',{labels:['Jan','Fev','Mar','Abr','Mai','Jun'],datasets:[
    {label:'Aprovados', data:[12,18,15,22,19,posts.filter(p=>p.status==='approved').length],backgroundColor:'#16A34A',borderRadius:4,borderSkipped:false},
    {label:'Pendentes', data:[3,5,4,7,3,posts.filter(p=>p.status==='pending').length],      backgroundColor:'#D97706',borderRadius:4,borderSkipped:false},
    {label:'Rejeitados',data:[1,2,1,3,1,posts.filter(p=>p.status==='rejected').length],     backgroundColor:'#DC2626',borderRadius:4,borderSkipped:false},
  ]},{plugins:{legend:{position:'bottom',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12}},tooltip:tip},scales:{x:{stacked:true,grid:{display:false},ticks:tc},y:{stacked:true,grid:{color:g},ticks:tc}}});
  mkC('chartReach','line',{labels:mo,datasets:[
    {label:'Alcance',   data:[12000,15000,13500,18000,16500,21000,24500],borderColor:'#7C3AED',backgroundColor:'rgba(124,58,237,.1)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2.5},
    {label:'Impressões',data:[18000,22000,20000,27000,24000,31000,36000],borderColor:'#F97316',backgroundColor:'rgba(249,115,22,.06)',tension:.4,fill:true,pointRadius:4,pointHoverRadius:8,borderWidth:2},
  ]},{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip},scales:{x:{grid:{color:g},ticks:tc},y:{grid:{color:g},ticks:{...tc,callback:v=>v>=1000?(v/1000).toFixed(0)+'K':v}}}});
}
function mkC(id,type,data,options={}){const c=el(id);if(!c)return;APP.charts[id]=new Chart(c,{type,data,options:{responsive:true,maintainAspectRatio:false,...options}});}

// ─── Grid de posts ────────────────────────────────────────────
function renderGrid(cid, posts) {
  const g = el(cid); if (!g) return;
  if (!posts.length) { g.innerHTML = emptyS('📭','Nenhum post aqui','Crie um novo agendamento para começar.'); return; }
  g.innerHTML = posts.map(p => postCard(p)).join('');
}
function postCard(p) {
  return `<div class="post-card" onclick="openPostDetail('${p.id}')">
    <div class="post-card-thumb" style="position:relative;overflow:hidden;">
      ${thumbBg(p)}
      <div style="position:absolute;top:8px;left:8px;"><span class="si ${PSI[p.platform]||''}" style="width:22px;height:22px;font-size:9px;">${PSH[p.platform]||'?'}</span></div>
      <div style="position:absolute;top:8px;right:8px;"><span class="badge ${SB[p.status]||'badge-gray'}" style="font-size:9px;padding:2px 7px;">${SL[p.status]||p.status}</span></div>
      ${p.fileUrl ? `<div style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.6);color:#fff;font-size:9px;padding:2px 6px;border-radius:4px;">${p.fileType==='video'?'🎬 Vídeo':'🖼️ Imagem'}</div>` : ''}
    </div>
    <div class="post-card-body">
      <div class="post-card-title">${esc(p.title)}</div>
      <div class="post-card-meta">${p.date||'Sem data'} · ${PL[p.platform]||p.platform} · ${p.type||'post'}</div>
      ${p.campaign ? `<div class="post-card-meta" style="margin-top:2px;">📋 ${esc(p.campaign)}</div>` : ''}
    </div>
    <div class="post-card-footer">
      <div style="display:flex;gap:4px;">
        ${p.status==='pending'  ? `<button class="btn btn-xs btn-primary" onclick="event.stopPropagation();doChangeStatus('${p.id}','approved')">✅</button><button class="btn btn-xs btn-danger" onclick="event.stopPropagation();doChangeStatus('${p.id}','rejected')">✕</button>` : ''}
        ${p.status==='rejected' ? `<button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();doChangeStatus('${p.id}','pending')">↩ Revisar</button>` : ''}
      </div>
      <div style="display:flex;gap:4px;">
        <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();openPostEditor('${p.id}')">✏️</button>
        <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();openShareModal('${p.id}')">📤</button>
        <button class="btn btn-xs btn-danger"    onclick="event.stopPropagation();doDeletePost('${p.id}')">🗑️</button>
      </div>
    </div>
  </div>`;
}
function openPostDetail(id) {
  const p = LOCAL.find('posts', id); if (!p) return;
  APP.editingId = id;
  el('detail-thumb').innerHTML = thumb(p, 48, true);
  setText('detail-title',    p.title);
  setText('detail-platform', PL[p.platform] || p.platform);
  setText('detail-date',     p.date || '—');
  setText('detail-campaign', p.campaign || '—');
  setText('detail-type',     p.type || '—');
  setText('detail-caption',  p.caption || 'Sem legenda.');
  const stEl = el('detail-status');
  if (stEl) { stEl.className = 'badge ' + (SB[p.status]||'badge-gray'); stEl.textContent = SL[p.status]||p.status; }
  el('detail-tags').innerHTML = p.tags ? p.tags.split(',').filter(Boolean).map(t=>`<span class="badge badge-gray" style="margin:2px;">#${esc(t.trim())}</span>`).join('') : '—';
  openModal('modalPostDetail');
}

// ─── Agendamentos ─────────────────────────────────────────────
let _agendView = 'lista';
function renderAgendamentos() { setAgendView(_agendView, null, true); }
function setAgendView(view, btn, silent) {
  _agendView = view;
  if (!silent && btn) { btn.closest('.view-toggle').querySelectorAll('.vt-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); }
  ['lista','grade','calendario'].forEach(vi => { const e2 = el('agend-'+vi); if (e2) e2.style.display = vi===view?'block':'none'; });
  const posts = LOCAL.get('posts');
  if (view === 'lista')      renderAgendList(posts);
  if (view === 'grade')      { const g=el('agend-cards'); if(g) g.innerHTML=posts.length?posts.map(p=>postCard(p)).join(''):emptyS('📅','Sem posts','Crie um agendamento.'); }
  if (view === 'calendario') renderCalendar('agend-cal', posts);
}
function renderAgendList(posts) {
  const tbody = el('agend-list'); if (!tbody) return;
  tbody.innerHTML = posts.map(p => `
  <tr onclick="openPostDetail('${p.id}')" style="cursor:pointer;">
    <td style="display:flex;align-items:center;gap:10px;min-width:0;">${thumb(p,36)} <span class="td-primary" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.title)}</span></td>
    <td><span class="badge ${SB[p.status]||'badge-gray'}">${SL[p.status]||p.status}</span></td>
    <td><span class="si ${PSI[p.platform]||''}" style="width:22px;height:22px;font-size:9px;">${PSH[p.platform]||'?'}</span></td>
    <td class="td-mono">${p.date||'—'}</td>
    <td>${p.campaign?esc(p.campaign):'—'}</td>
    <td onclick="event.stopPropagation();" style="white-space:nowrap;">
      <button class="btn btn-xs btn-primary"   onclick="openShareModal('${p.id}')">📤 Link</button>
      <button class="btn btn-xs btn-secondary" onclick="openPostEditor('${p.id}')"  style="margin-left:3px;">✏️</button>
      <button class="btn btn-xs btn-danger"    onclick="doDeletePost('${p.id}')"    style="margin-left:3px;">🗑️</button>
    </td>
  </tr>`).join('') || `<tr><td colspan="6">${emptyS('📅','Nenhum agendamento','Clique em "+ Novo Agendamento".')}</td></tr>`;
}

// ─── Calendário ───────────────────────────────────────────────
function renderCalendar(cid, posts, yr, mo) {
  const c = el(cid); if (!c) return;
  const now=new Date(), Y=yr??now.getFullYear(), M=mo??now.getMonth();
  const MN=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DN=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const fd=new Date(Y,M,1).getDay(), dim=new Date(Y,M+1,0).getDate();
  const td=now.getDate(), tm=now.getMonth(), ty=now.getFullYear();
  let h = `<div class="calendar-wrap"><div class="cal-header">
    <button class="btn btn-secondary btn-sm" onclick="renderCalendar('${cid}',LOCAL.get('posts'),${M===0?Y-1:Y},${M===0?11:M-1})">‹</button>
    <div class="cal-month">${MN[M]} ${Y}</div>
    <button class="btn btn-secondary btn-sm" onclick="renderCalendar('${cid}',LOCAL.get('posts'),${M===11?Y+1:Y},${M===11?0:M+1})">›</button>
  </div><div class="cal-grid">${DN.map(d=>`<div class="cal-day-name">${d}</div>`).join('')}`;
  for (let i=0;i<fd;i++) h += `<div class="cal-day other-month"></div>`;
  for (let d=1;d<=dim;d++) {
    const isT=d===td&&M===tm&&Y===ty;
    const ds=`${Y}-${String(M+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dp=posts.filter(p=>p.date===ds);
    h += `<div class="cal-day${isT?' today':''}" onclick="calClick('${cid}','${ds}')">
      <div class="cal-day-num">${d}</div>
      ${dp.map(p=>{
        const hasPic = p.fileUrl && p.fileType!=='video';
        return `<div class="cal-event ${p.status==='approved'?'green':p.status==='rejected'?'red':''}" onclick="event.stopPropagation();openPostDetail('${p.id}')" title="${esc(p.title)}" style="${hasPic?`background-image:url('${p.fileUrl}');background-size:cover;background-position:center;color:transparent;min-height:24px;`:''}">${hasPic?'':esc(p.title.slice(0,16))+(p.title.length>16?'..':'')}</div>`;
      }).join('')}
    </div>`;
  }
  h += `</div></div>`;
  c.innerHTML = h;
}
function calClick(cid, ds) {
  if (cid === 'agend-cal') { openNewAgendamento(); setTimeout(() => sv('ag-date', ds), 60); }
}

// ─── Upload de arquivo (Firebase Storage ou base64) ───────────
function triggerFile(inputId) { el(inputId)?.click(); }
function onDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
async function onDrop(e, previewId, dataId) {
  e.preventDefault(); e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
  const f = e.dataTransfer?.files[0];
  if (f) await processFile(f, previewId, dataId);
}
async function onFileChange(inputId, previewId, dataId) {
  const input = el(inputId);
  if (!input || !input.files[0]) return;
  await processFile(input.files[0], previewId, dataId);
}

async function processFile(file, previewId, dataId) {
  const isImg = file.type.startsWith('image/');
  const isVid = file.type.startsWith('video/');
  if (!isImg && !isVid) { toast('Use PNG, JPG, GIF ou MP4/WebM.', 'warning'); return; }

  const prev = el(previewId);
  const dataEl = el(dataId);

  // Mostra preview local imediato (enquanto faz upload)
  const localUrl = URL.createObjectURL(file);
  if (prev) {
    prev.innerHTML = isImg
      ? `<div style="position:relative;"><img src="${localUrl}" style="width:100%;height:180px;object-fit:cover;border-radius:var(--radius);display:block;"/><div id="upload-progress-bar" style="position:absolute;bottom:0;left:0;height:4px;background:var(--primary);width:0%;border-radius:0 0 var(--radius) var(--radius);transition:width .3s;"></div><div id="upload-progress-label" style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;padding:2px 8px;border-radius:4px;">Carregando...</div></div>`
      : `<video src="${localUrl}" controls style="width:100%;height:180px;border-radius:var(--radius);display:block;"></video>`;
  }

  try {
    const result = await UPLOAD.file(file, 'creatives', pct => {
      const bar   = el('upload-progress-bar');
      const label = el('upload-progress-label');
      if (bar)   bar.style.width = pct + '%';
      if (label) label.textContent = pct + '%';
    });

    // Armazena URL e tipo
    if (dataEl) {
      dataEl.value = JSON.stringify({ url: result.url, type: result.type, isRemote: result.isRemote });
    }

    // Remove barra de progresso
    const bar   = el('upload-progress-bar');
    const label = el('upload-progress-label');
    if (bar)   bar.remove();
    if (label) label.remove();

    if (!result.isRemote) {
      toast('📁 ' + file.name + ' carregado localmente (configure Firebase para salvar na nuvem)', 'warning');
    } else {
      toast('✅ ' + file.name + ' enviado para nuvem!', 'success');
    }
  } catch(e) {
    toast('Erro no upload: ' + e.message, 'error');
    if (prev) prev.innerHTML = `<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Arraste ou clique para selecionar</div><div class="upload-zone-sub">PNG, JPG, MP4 — máx. 500MB (com Firebase)</div>`;
  }
}

// ─── Salvar Post ──────────────────────────────────────────────
function openNewAgendamento() {
  APP.editingId = null;
  clearF('formAgendamento');
  el('ag-file-preview').innerHTML = `<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Arraste ou clique para selecionar</div><div class="upload-zone-sub">PNG, JPG, MP4, WebM — Sem limite com Firebase Storage</div>`;
  sv('ag-file-data', '');
  resetTipoBtns();
  setText('modalAgendTitulo', '📅 Novo Agendamento');
  openModal('modalAgendamento');
}

function openPostEditor(id) {
  const p = LOCAL.find('posts', id); if (!p) return;
  APP.editingId = id;
  sv('ag-title', p.title); sv('ag-platform', p.platform); sv('ag-date', p.date);
  sv('ag-campaign', p.campaign); sv('ag-caption', p.caption);
  sv('ag-tags', p.tags || ''); sv('ag-status', p.status || 'pending');
  // Tipo
  document.querySelectorAll('.tipo-btn').forEach(b => {
    const active = b.dataset.tipo === p.type;
    b.classList.toggle('active', active);
    b.style.cssText = active ? 'border-color:var(--primary);background:var(--primary-light);color:var(--primary);' : '';
  });
  // Preview arquivo
  if (p.fileUrl) {
    const isVid = p.fileType === 'video';
    el('ag-file-preview').innerHTML = isVid
      ? `<video src="${p.fileUrl}" controls style="width:100%;height:180px;border-radius:var(--radius);"></video>`
      : `<img src="${p.fileUrl}" style="width:100%;height:180px;object-fit:cover;border-radius:var(--radius);"/>`;
    // Mantém dados existentes
    sv('ag-file-data', JSON.stringify({ url: p.fileUrl, type: p.fileType, isRemote: true }));
  } else {
    el('ag-file-preview').innerHTML = `<div class="upload-zone-icon">☁️</div><div class="upload-zone-text">Arraste ou clique para selecionar</div><div class="upload-zone-sub">PNG, JPG, MP4 — Sem limite com Firebase Storage</div>`;
    sv('ag-file-data', '');
  }
  setText('modalAgendTitulo', '✏️ Editar Post');
  openModal('modalAgendamento');
}

function resetTipoBtns() {
  document.querySelectorAll('.tipo-btn').forEach((b, i) => {
    b.classList.remove('active'); b.style.cssText = '';
    if (i === 0) { b.classList.add('active'); b.style.cssText = 'border-color:var(--primary);background:var(--primary-light);color:var(--primary);'; }
  });
}

function selectTipo(btn) {
  document.querySelectorAll('.tipo-btn').forEach(b => { b.classList.remove('active'); b.style.cssText = ''; });
  btn.classList.add('active');
  btn.style.cssText = 'border-color:var(--primary);background:var(--primary-light);color:var(--primary);';
}

async function saveAgendamento() {
  const title    = v('ag-title')?.trim();
  const platform = v('ag-platform');
  if (!title)    { toast('Informe o título do post. ⚠️', 'warning'); return; }
  if (!platform) { toast('Selecione a plataforma.', 'warning'); return; }

  const tipo      = document.querySelector('.tipo-btn.active')?.dataset.tipo || 'image';
  const fileRaw   = v('ag-file-data');
  let fileUrl  = null, fileType = null;
  if (fileRaw) {
    try {
      const fd  = JSON.parse(fileRaw);
      fileUrl   = fd.url;
      fileType  = fd.type;
    } catch { fileUrl = fileRaw; fileType = 'image'; } // base64 legacy
  }

  const data = {
    title, platform,
    date:     v('ag-date'),
    campaign: v('ag-campaign')?.trim(),
    caption:  v('ag-caption')?.trim(),
    tags:     v('ag-tags')?.trim(),
    status:   v('ag-status') || 'pending',
    type:     tipo,
    fileUrl,
    fileType,
    thumb:    fileUrl ? null : (TEMO[tipo] || '📸'),
  };

  showLoadingBtn('btn-save-agend', 'Salvando...');
  try {
    if (APP.editingId) {
      await DB.update('posts', APP.editingId, data);
      toast('Post atualizado! ✅', 'success');
      APP.editingId = null;
    } else {
      await DB.add('posts', data);
      toast(_firebaseReady ? 'Agendamento criado e sincronizado! 🗓️ Todos os usuários já podem ver.' : 'Agendamento criado! 🗓️', 'success');
    }
    updateBadges();
    closeModal('modalAgendamento');
    renderPage(APP.currentPage);
    updateCampaignCounts();
  } catch(e) {
    toast('Erro ao salvar: ' + e.message, 'error');
  } finally {
    resetBtn('btn-save-agend', 'Salvar ✓');
  }
}

async function saveDraft() {
  const t = v('ag-title')?.trim() || 'Rascunho ' + new Date().toLocaleDateString('pt-BR');
  sv('ag-title', t); sv('ag-status', 'draft');
  await saveAgendamento();
}

async function doDeletePost(id) {
  const p = LOCAL.find('posts', id);
  if (!p || !confirm('Excluir "' + p.title + '"?')) return;
  await DB.remove('posts', id);
  updateBadges(); renderPage(APP.currentPage);
  toast('Post excluído.', 'info');
}

// ─── Status ───────────────────────────────────────────────────
async function doChangeStatus(id, ns) {
  await DB.update('posts', id, { status: ns });
  LOCAL.update('posts', id, { status: ns });
  updateBadges(); renderPage(APP.currentPage);
  const msgs  = { approved:'Aprovado! ✅', rejected:'Rejeitado ❌', pending:'Enviado p/ análise ⏳', scheduled:'Agendado 📅' };
  const types = { approved:'success', rejected:'error', pending:'info', scheduled:'info' };
  toast('Post ' + (msgs[ns]||ns), types[ns]||'info');
  updateCampaignCounts();
}

async function updateCampaignCounts() {
  const posts = LOCAL.get('posts');
  for (const c of LOCAL.get('campaigns')) {
    const cp = posts.filter(p => p.campaign === c.name);
    await DB.update('campaigns', c.id, {
      posts:    cp.length,
      approved: cp.filter(p=>p.status==='approved').length,
      pending:  cp.filter(p=>p.status==='pending').length,
      rejected: cp.filter(p=>p.status==='rejected').length,
    });
  }
}

// ─── Contas ───────────────────────────────────────────────────
function renderContas() {
  const accounts = LOCAL.get('accounts');
  const grid = el('accountsGrid'); if (!grid) return;
  if (!accounts.length) { grid.innerHTML = emptyS('🔗','Nenhuma conta','Clique em "+ Nova Conta".'); return; }
  const bgMap = { ig:'radial-gradient(circle at 30% 107%,#fdf497,#fd5949 45%,#d6249f 60%,#285AEB)', fb:'#1877F2', yt:'#FF0000', tt:'#111', li:'#0A66C2', tw:'#1DA1F2' };
  grid.innerHTML = accounts.map(acc => `
  <div class="account-card">
    <div class="account-card-head">
      <div class="account-avatar" style="background:${bgMap[acc.platform]||'#888'};color:#fff;font-size:14px;font-weight:800;">${PSH[acc.platform]||'?'}</div>
      <div class="account-info">
        <div class="account-name">${esc(acc.name)}</div>
        <div class="account-handle">${esc(acc.handle)}</div>
      </div>
      <span class="badge ${acc.status==='active'?'badge-green':'badge-gray'}">${acc.status==='active'?'Ativo':'Inativo'}</span>
    </div>
    <div class="account-stats">
      <div class="account-stat"><div class="account-stat-val">${acc.followers||'0'}</div><div class="account-stat-label">Seguidores</div></div>
      <div class="account-stat"><div class="account-stat-val">${acc.engagement||'—'}</div><div class="account-stat-label">Engajamento</div></div>
      <div class="account-stat"><div class="account-stat-val">${acc.posts||0}</div><div class="account-stat-label">Posts</div></div>
      <div class="account-stat"><div class="account-stat-val">${PL[acc.platform]||acc.platform}</div><div class="account-stat-label">Plataforma</div></div>
    </div>
    ${acc.platform === 'ig' ? `
    <div style="padding:10px 20px;border-top:1px solid var(--border);">
      ${acc.igConnected
        ? `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--green);font-weight:600;"><span>✅ Instagram conectado via API</span><button class="btn btn-xs btn-secondary" onclick="syncIgInsights('${acc.id}')">📊 Insights</button></div>`
        : `<button class="btn btn-sm btn-primary" style="width:100%;justify-content:center;" onclick="connectInstagram('${acc.id}')">🔗 Conectar Instagram via API</button>`
      }
    </div>` : ''}
    <div class="account-card-footer">
      <button class="btn btn-sm btn-danger"    onclick="doRemoveAccount('${acc.id}')">🗑️ Remover</button>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-secondary" onclick="editAccount('${acc.id}')">✏️ Editar</button>
        <button class="btn btn-sm btn-primary"   onclick="doSyncAccount('${acc.id}')">🔄 Sync</button>
      </div>
    </div>
  </div>`).join('');
}

function connectInstagram(accountId) {
  if (!INSTAGRAM_CONFIG.appId || INSTAGRAM_CONFIG.appId === 'SEU_INSTAGRAM_APP_ID') {
    // Mostra modal de instrução
    openModal('modalIgSetup');
    return;
  }
  // Salva o accountId para depois do OAuth callback
  localStorage.setItem('aha_ig_connecting', accountId);
  INSTAGRAM.startOAuth();
}

async function syncIgInsights(accountId) {
  const acc = LOCAL.find('accounts', accountId); if (!acc) return;
  toast('Buscando insights do Instagram...', 'info');
  try {
    const insights = await INSTAGRAM.getInsights(acc.igUserId, acc.igToken);
    if (insights && insights.data) {
      const reach      = insights.data.find(m=>m.name==='reach')?.values?.[0]?.value || 0;
      const impressions= insights.data.find(m=>m.name==='impressions')?.values?.[0]?.value || 0;
      toast(`📊 Alcance: ${reach.toLocaleString('pt-BR')} | Impressões: ${impressions.toLocaleString('pt-BR')}`, 'success');
    } else {
      toast('Não foi possível buscar insights. Verifique as permissões.', 'warning');
    }
  } catch(e) {
    toast('Erro ao buscar insights: ' + e.message, 'error');
  }
}

async function doSyncAccount(id) {
  const a = LOCAL.find('accounts', id); if (!a) return;
  toast('Sincronizando ' + a.name + '...', 'info');
  await new Promise(r => setTimeout(r, 1200));
  const updated = { posts: a.posts + Math.floor(Math.random()*5) + 1 };
  await DB.update('accounts', id, updated);
  LOCAL.update('accounts', id, updated);
  renderContas();
  toast(a.name + ' sincronizado! ✅', 'success');
}

async function doRemoveAccount(id) {
  const a = LOCAL.find('accounts', id);
  if (!a || !confirm('Remover "' + a.name + '"?')) return;
  await DB.remove('accounts', id);
  LOCAL.remove('accounts', id);
  updateBadges(); renderContas();
  toast('Conta removida.', 'info');
}

function editAccount(id) {
  const a = LOCAL.find('accounts', id); if (!a) return;
  APP.editingId = id;
  sv('acc-platform', a.platform); sv('acc-handle', a.handle.replace('@',''));
  sv('acc-name', a.name); sv('acc-followers', a.followersNum || 0);
  sv('acc-engagement', a.engagement);
  setText('modalContaTitle', '✏️ Editar Conta');
  openModal('modalConta');
}
function openNewConta() {
  APP.editingId = null; clearF('formConta');
  setText('modalContaTitle', '🔗 Conectar Nova Conta');
  openModal('modalConta');
}
async function saveAccount() {
  const platform    = v('acc-platform'), handle = v('acc-handle')?.trim();
  const name        = v('acc-name')?.trim() || ('AHA '+(PL[platform]||platform));
  const followersN  = parseInt(v('acc-followers')) || 0;
  const engagement  = v('acc-engagement')?.trim() || '0%';
  if (!platform || !handle) { toast('Preencha plataforma e @usuário.', 'warning'); return; }
  const data = {
    name, handle: handle.startsWith('@')?handle:'@'+handle, platform,
    followers: followersN >= 1000 ? (followersN/1000).toFixed(1)+'K' : String(followersN),
    followersNum: followersN, engagement, posts:0, status:'active', igConnected:false
  };
  if (APP.editingId) {
    await DB.update('accounts', APP.editingId, data);
    LOCAL.update('accounts', APP.editingId, data);
    toast('Conta atualizada! ✅', 'success'); APP.editingId = null;
  } else {
    const added = await DB.add('accounts', data);
    if (!_firebaseReady) LOCAL.add('accounts', data);
    toast('Conta conectada! 🔗', 'success');
  }
  updateBadges(); renderContas(); closeModal('modalConta');
}

// ─── Campanhas ────────────────────────────────────────────────
function renderCampanhas() {
  const camps = LOCAL.get('campaigns'), cont = el('campanhas-list'); if (!cont) return;
  const SLc={active:'Ativa',paused:'Pausada',ended:'Encerrada'}, SBc={active:'badge-green',paused:'badge-yellow',ended:'badge-gray'};
  cont.innerHTML = camps.map(c => {
    const prog  = c.posts ? Math.round((c.approved/c.posts)*100) : 0;
    const plats = (c.platforms||'').split(',').filter(Boolean);
    return `<div class="chart-card" style="margin-bottom:14px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:3px;">${esc(c.name)}</div>
          <div style="font-size:12px;color:var(--text3);">📅 ${c.start||'—'} → ${c.end||'—'}</div>
          ${c.desc ? `<div style="font-size:12px;color:var(--text3);margin-top:2px;">${esc(c.desc)}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${plats.map(pl=>`<span class="si ${PSI[pl]||''}" style="width:22px;height:22px;font-size:9px;">${PSH[pl]||'?'}</span>`).join('')}
          <span class="badge ${SBc[c.status]||'badge-gray'}">${SLc[c.status]||c.status}</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;">
        <div style="text-align:center;"><div style="font-size:22px;font-weight:800;font-family:'Space Grotesk',sans-serif;">${c.posts}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">Posts</div></div>
        <div style="text-align:center;"><div style="font-size:22px;font-weight:800;color:var(--green);font-family:'Space Grotesk',sans-serif;">${c.approved}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">Aprovados</div></div>
        <div style="text-align:center;"><div style="font-size:22px;font-weight:800;color:var(--yellow);font-family:'Space Grotesk',sans-serif;">${c.pending}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">Pendentes</div></div>
        <div style="text-align:center;"><div style="font-size:22px;font-weight:800;font-family:'Space Grotesk',sans-serif;">${c.budget||'—'}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-top:2px;">Budget</div></div>
      </div>
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:11px;color:var(--text3);">
          <span>Progresso de aprovação</span>
          <span style="font-weight:700;color:${prog>=80?'var(--green)':prog>=50?'var(--yellow)':'var(--primary)'};">${prog}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${prog}%;background:${prog>=80?'var(--green)':prog>=50?'var(--yellow)':'var(--primary)'};"></div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-primary"   onclick="editCampaign('${c.id}')">✏️ Editar</button>
        <button class="btn btn-sm btn-secondary" onclick="exportCampReport('${c.id}')">📊 Relatório</button>
        <button class="btn btn-sm btn-secondary" onclick="doToggleCamp('${c.id}','${c.status}')">${c.status==='active'?'⏸ Pausar':'▶ Ativar'}</button>
        <button class="btn btn-sm btn-danger"    onclick="doDeleteCamp('${c.id}')">🗑️ Excluir</button>
      </div>
    </div>`;
  }).join('') || emptyS('📋','Nenhuma campanha','Crie sua primeira campanha.');

  const active = camps.filter(c=>c.status==='active').length;
  const tb = camps.reduce((s,c)=>{ const n=parseFloat((c.budget||'0').replace(/[^\d.]/g,'')); return s+n; }, 0);
  const tp = camps.reduce((s,c)=>s+c.posts, 0);
  const ta = camps.reduce((s,c)=>s+c.approved, 0);
  setSafe('camp-metric-active', active);
  setSafe('camp-metric-budget', 'R$ '+(tb/1000).toFixed(0)+'K');
  setSafe('camp-metric-posts',  tp);
  setSafe('camp-metric-rate',   tp ? Math.round((ta/tp)*100)+'%' : '—');
}
function editCampaign(id) {
  const c=LOCAL.find('campaigns',id); if(!c) return;
  APP.editingId=id; sv('camp-name',c.name); sv('camp-start',c.start); sv('camp-end',c.end); sv('camp-budget',c.budget); sv('camp-desc',c.desc||'');
  document.querySelectorAll('.camp-plat-check').forEach(cb=>cb.checked=false);
  (c.platforms||'').split(',').forEach(pl=>{ const cb=document.querySelector('.camp-plat-check[value="'+pl+'"]'); if(cb)cb.checked=true; });
  setText('modalCampanhaTitulo','✏️ Editar Campanha'); openModal('modalCampanha');
}
function openNewCampanha() {
  APP.editingId=null; clearF('formCampanha');
  document.querySelectorAll('.camp-plat-check').forEach(c=>c.checked=false);
  setText('modalCampanhaTitulo','📋 Nova Campanha'); openModal('modalCampanha');
}
async function saveCampanha() {
  const name=v('camp-name')?.trim(); if(!name){toast('Informe o nome.','warning');return;}
  const plats=[...document.querySelectorAll('.camp-plat-check:checked')].map(x=>x.value).join(',')||'ig';
  const data={name,start:v('camp-start'),end:v('camp-end'),budget:v('camp-budget')?.trim(),desc:v('camp-desc')?.trim(),platforms:plats,status:'active',posts:0,approved:0,pending:0,rejected:0};
  if(APP.editingId){ await DB.update('campaigns',APP.editingId,data); LOCAL.update('campaigns',APP.editingId,data); toast('Campanha atualizada! ✅','success'); APP.editingId=null; }
  else             { await DB.add('campaigns',data); if(!_firebaseReady)LOCAL.add('campaigns',data); toast('Campanha criada! 🚀','success'); }
  closeModal('modalCampanha'); renderCampanhas();
}
async function doToggleCamp(id,cur){ const ns=cur==='active'?'paused':'active'; await DB.update('campaigns',id,{status:ns}); LOCAL.update('campaigns',id,{status:ns}); renderCampanhas(); toast('Campanha '+(ns==='active'?'ativada ▶':'pausada ⏸'),'info'); }
async function doDeleteCamp(id){ const c=LOCAL.find('campaigns',id); if(!c||!confirm('Excluir "'+c.name+'"?'))return; await DB.remove('campaigns',id); LOCAL.remove('campaigns',id); renderCampanhas(); toast('Campanha excluída.','info'); }
function exportCampReport(id){
  const c=LOCAL.find('campaigns',id); if(!c) return;
  const prog=c.posts?Math.round((c.approved/c.posts)*100):0;
  const txt=`RELATÓRIO — AHA Social Planning\n${'='.repeat(50)}\nCampanha: ${c.name}\nStatus: ${c.status}\nPeríodo: ${c.start||'—'} → ${c.end||'—'}\nBudget: ${c.budget||'—'}\nPosts: ${c.posts} | Aprovados: ${c.approved} | Pendentes: ${c.pending} | Rejeitados: ${c.rejected}\nTaxa: ${prog}%\nDescrição: ${c.desc||'—'}\n\nGerado: ${new Date().toLocaleString('pt-BR')}\nAHA Social Planning © 2026`;
  dlText(txt,c.name.replace(/\s+/g,'_')+'_relatorio.txt'); toast('Relatório exportado! 📊','success');
}

// ─── Tráfego Pago ─────────────────────────────────────────────
function renderTrafego() {
  ['chartTrafego','chartInvest'].forEach(id=>{if(APP.charts[id]){try{APP.charts[id].destroy();}catch{}delete APP.charts[id];}});
  const tip={enabled:true,backgroundColor:'#0F172A',titleColor:'#fff',bodyColor:'#94A3B8',padding:12,cornerRadius:8,titleFont:{family:"'DM Sans',sans-serif",weight:'700',size:12},bodyFont:{family:"'DM Sans',sans-serif",size:12}};
  const tc={font:{family:"'DM Sans',sans-serif",size:11},color:'#94A3B8'};
  mkC('chartTrafego','bar',{labels:['Instagram','Facebook','Google Ads','TikTok','YouTube'],datasets:[{label:'CPC (R$)',data:[1.20,0.85,2.10,0.65,1.80],backgroundColor:'#F97316',borderRadius:6,borderSkipped:false},{label:'CPM (R$)',data:[12,8,18,6,15],backgroundColor:'#7C3AED',borderRadius:6,borderSkipped:false}]},{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12}},tooltip:tip},scales:{x:{grid:{display:false},ticks:tc},y:{grid:{color:'rgba(226,232,240,.6)'},ticks:{...tc,callback:v=>'R$ '+v.toFixed(2)}}}});
  const ci=el('chartInvest');
  if(ci) APP.charts.chartInvest=new Chart(ci,{type:'doughnut',data:{labels:['Instagram','Facebook','Google','TikTok'],datasets:[{data:[34,23,28,15],backgroundColor:['#F97316','#1877F2','#4285F4','#333'],borderWidth:3,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{position:'right',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:12,usePointStyle:true}},tooltip:tip}}});
}

// ─── Share ────────────────────────────────────────────────────
function openShareModal(id) {
  const p=LOCAL.find('posts',id); if(!p) return;
  const link=window.location.origin+window.location.pathname+'?approval='+id;
  sv('share-link-input',link);
  el('share-wa').href=`https://wa.me/?text=${encodeURIComponent('Olá! Link de aprovação:\n\n*'+p.title+'*\n\n'+link)}`;
  el('share-email').href=`mailto:?subject=Aprovação — ${encodeURIComponent(p.title)}&body=${encodeURIComponent('Acesse: '+link)}`;
  openModal('modalShare');
}
function copyLink(){
  const val=v('share-link-input'); if(!val) return;
  navigator.clipboard?.writeText(val).then(()=>toast('Link copiado! 📋','success')) || (() => { const i=el('share-link-input'); i.select(); document.execCommand('copy'); toast('Link copiado! 📋','success'); })();
}

// ─── Página de aprovação pública ──────────────────────────────
function checkApprovalMode() {
  const id=new URLSearchParams(window.location.search).get('approval'); if(!id) return;
  window.addEventListener('load', async () => {
    let p = LOCAL.find('posts', id);
    if (!p && _firebaseReady) p = await FS.get('posts', id);
    if (!p) { document.body.innerHTML='<div style="padding:40px;text-align:center;font-family:sans-serif;max-width:500px;margin:auto;"><h2 style="color:#F97316;">Post não encontrado</h2><p>Este link expirou ou foi removido.</p></div>'; return; }
    el('loginPage').style.display='none'; el('app').style.display='none';
    el('approvalPage').style.display='block';
    el('ap-thumb').innerHTML = thumb(p,48,true);
    setText('ap-title',p.title); setText('ap-platform',PL[p.platform]||p.platform);
    setText('ap-date',p.date||'—'); setText('ap-campaign',p.campaign||'—');
    setText('ap-caption',p.caption||'Sem legenda.');
    const stEl=el('ap-status'); if(stEl){stEl.className='badge '+(SB[p.status]||'badge-gray');stEl.textContent=SL[p.status]||p.status;}
    window._approvalId=id;
  });
}
async function approvalAction(action) {
  const id=window._approvalId; if(!id) return;
  const sm={approve:'approved',reject:'rejected',correct:'pending'};
  const ns=sm[action];
  await DB.update('posts',id,{status:ns,clientComment:v('ap-comment'),reviewedAt:new Date().toISOString()});
  LOCAL.update('posts',id,{status:ns});
  const stEl=el('ap-status');
  if(stEl){stEl.className='badge '+(action==='approve'?'badge-green':action==='reject'?'badge-red':'badge-yellow');stEl.textContent=action==='approve'?'Aprovado':action==='reject'?'Rejeitado':'Correção Solicitada';}
  toast({approve:'✅ Criativo aprovado!',reject:'❌ Criativo rejeitado.',correct:'⚠️ Correção solicitada.'}[action]||'Registrado!',action==='approve'?'success':action==='reject'?'error':'warning');
  document.querySelectorAll('.approval-actions button').forEach(b=>{b.disabled=true;b.style.opacity='.5';});
}

// ─── Modals ───────────────────────────────────────────────────
function openModal(id){ const e=el(id); if(e){e.classList.add('open');document.body.style.overflow='hidden';} }
function closeModal(id){
  if(id){const e=el(id);if(e)e.classList.remove('open');}
  else document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
  document.body.style.overflow=''; APP.editingId=null;
}

// ─── Toast ────────────────────────────────────────────────────
let _tq=[],_tr=false;
function toast(msg,type='info'){ _tq.push({msg,type}); if(!_tr) _pTQ(); }
window.showToast=(m,t)=>toast(m,t);
function _pTQ(){
  if(!_tq.length){_tr=false;return;} _tr=true;
  const{msg,type}=_tq.shift(), t=el('toast'); if(!t)return;
  t.querySelector('.toast-icon').textContent={'success':'✅','error':'❌','warning':'⚠️','info':'ℹ️'}[type]||'ℹ️';
  t.querySelector('.toast-title').textContent=msg;
  t.className='toast show toast-'+type;
  const ln=t.querySelector('.toast-line');if(ln){ln.style.animation='none';setTimeout(()=>ln.style.animation='',10);}
  setTimeout(()=>{t.classList.remove('show');setTimeout(_pTQ,300);},3500);
}

// ─── Botões de loading ────────────────────────────────────────
function showLoadingBtn(id,msg){ const b=el(id); if(b){b.disabled=true;b._orig=b.textContent;b.textContent=msg;} }
function resetBtn(id,msg)      { const b=el(id); if(b){b.disabled=false;b.textContent=msg||(b._orig||'');} }

// ─── Extras ──────────────────────────────────────────────────
function exportPostsCSV(){
  const ps=LOCAL.get('posts'); if(!ps.length){toast('Nenhum post.','warning');return;}
  const h='Título,Plataforma,Status,Data,Campanha,Tipo,Tags';
  const rows=ps.map(p=>[p.title,p.platform,p.status,p.date,p.campaign,p.type,p.tags].map(x=>'"'+(x||'').replace(/"/g,'""')+'"').join(','));
  const csv=[h,...rows].join('\n');
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv); a.download='aha_posts.csv'; a.click();
  toast('CSV exportado! 📥','success');
}

// ─── Utils ────────────────────────────────────────────────────
const el      = id => document.getElementById(id);
const setText = (id,val) => { const e=el(id); if(e) e.textContent=val; };
const setSafe = (id,val) => { const e=el(id); if(e) e.textContent=val; };
const sv      = (id,val) => { const e=el(id); if(e&&val!==undefined&&val!==null) e.value=val; };
const v       = id => el(id)?.value || '';
const esc     = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const emptyS  = (icon,t,s) => `<div class="empty-state"><div class="empty-state-icon">${icon}</div><div class="empty-state-title">${t}</div><div class="empty-state-sub">${s}</div></div>`;
const dlText  = (txt,fn) => { const a=document.createElement('a'); a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt); a.download=fn; a.click(); };
function clearF(fid){ const f=el(fid); if(!f)return; f.querySelectorAll('input:not([type=checkbox]):not([type=radio]),textarea,select').forEach(e=>e.value=''); }
