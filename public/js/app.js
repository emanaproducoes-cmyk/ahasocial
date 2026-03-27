// ═══════════════════════════════════════════════════════════════
// app.js — AHA Social Planning — Main Application Logic
// ═══════════════════════════════════════════════════════════════

// ─── State global ──────────────────────────────────────────────
const APP = {
  user: null,
  firebaseReady: false,
  currentPage: 'dashboard',
  charts: {},
  data: {
    posts: [], accounts: [], campaigns: [], schedules: []
  }
};

// ─── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  APP.firebaseReady = typeof initFirebase === 'function' && initFirebase();
  const savedUser = getSavedUser();
  if (savedUser) {
    APP.user = savedUser;
    showApp();
  }
});

function getSavedUser() {
  try { return JSON.parse(localStorage.getItem('aha_user')); } catch { return null; }
}

// ─── Auth ──────────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('loginEmail')?.value;
  const name  = email ? email.split('@')[0].replace(/\./g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : 'Usuário';
  const avatar= name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
  APP.user = { email, name, avatar, role: 'Gerente de Conteúdo' };
  localStorage.setItem('aha_user', JSON.stringify(APP.user));
  showToast('Bem-vindo, ' + name + '!', 'success');
  showApp();
}

async function doGoogleLogin() {
  if (APP.firebaseReady) {
    const user = await loginWithGoogle();
    if (user) {
      APP.user = {
        email: user.email,
        name: user.displayName,
        avatar: (user.displayName||'U').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(),
        photo: user.photoURL,
        role: 'Gerente de Conteúdo'
      };
      localStorage.setItem('aha_user', JSON.stringify(APP.user));
      showApp();
      return;
    }
  }
  doLogin();
}

function doLogout() {
  localStorage.removeItem('aha_user');
  APP.user = null;
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  if (APP.firebaseReady && auth) auth.signOut();
}

function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const u = APP.user;
  document.getElementById('topAvatar').textContent  = u.avatar || 'U';
  document.getElementById('sideAvatar').textContent = u.avatar || 'U';
  document.getElementById('sideUserName').textContent = u.name || 'Usuário';
  seedData();
  initApp();
}

// ─── Seed Demo Data ─────────────────────────────────────────────
function seedData() {
  if (LOCAL.get('posts').length) return; // já existe
  const posts = [
    { id:'p1', title:'Black Friday 2026 — Instagram', status:'approved', platform:'ig', type:'image', date:'2026-03-25', caption:'A maior promoção do ano chegou! Até 60% OFF em todos os produtos. 🛒🔥 #blackfriday #oferta', campaign:'Black Friday', tags:['promoção','oferta'], thumb:'🛒' },
    { id:'p2', title:'Stories — Lançamento Produto X', status:'pending', platform:'ig', type:'story', date:'2026-03-27', caption:'Algo novo está chegando... Fique ligado! 👀✨', campaign:'Lançamento X', tags:['novo','teaser'], thumb:'👀' },
    { id:'p3', title:'YouTube — Tutorial Completo', status:'approved', platform:'yt', type:'video', date:'2026-03-20', caption:'Aprenda do zero ao avançado em menos de 20 minutos.', campaign:'Conteúdo Orgânico', tags:['tutorial','youtube'], thumb:'🎬' },
    { id:'p4', title:'Facebook — Campanha Awareness', status:'rejected', platform:'fb', type:'image', date:'2026-03-18', caption:'Conecte-se com quem importa. #família #momentos', campaign:'Awareness Q1', tags:['awareness'], thumb:'💙' },
    { id:'p5', title:'TikTok — Trend Dance', status:'pending', platform:'tt', type:'video', date:'2026-03-29', caption:'Pulamos na trend mais quente da semana! 🕺🎵', campaign:'TikTok Orgânico', tags:['trend','tiktok'], thumb:'🕺' },
    { id:'p6', title:'LinkedIn — Case de Sucesso', status:'approved', platform:'li', type:'image', date:'2026-03-22', caption:'Como ajudamos nosso cliente a crescer 300% em 6 meses.', campaign:'B2B Content', tags:['case','linkedin'], thumb:'💼' },
  ];
  LOCAL.set('posts', posts);

  const accounts = [
    { id:'a1', name:'AHA Publicità', handle:'@ahapublicita', platform:'ig', followers:'48.2K', engagement:'4.8%', posts:342, status:'active', color:'#fd5949', emoji:'IG' },
    { id:'a2', name:'AHA Publicità', handle:'AHA Publicità', platform:'fb', followers:'32.1K', engagement:'2.3%', posts:285, status:'active', color:'#1877F2', emoji:'FB' },
    { id:'a3', name:'AHA Canal', handle:'AHA Publicità', platform:'yt', followers:'12.5K', engagement:'6.1%', posts:87, status:'active', color:'#FF0000', emoji:'YT' },
  ];
  LOCAL.set('accounts', accounts);

  const campaigns = [
    { id:'c1', name:'Black Friday 2026', status:'active', start:'2026-03-01', end:'2026-03-31', budget:'R$ 15.000', posts:24, approved:18, pending:4, rejected:2, platforms:['ig','fb','tt'] },
    { id:'c2', name:'Lançamento Produto X', status:'active', start:'2026-03-20', end:'2026-04-15', budget:'R$ 8.500', posts:12, approved:7, pending:3, rejected:2, platforms:['ig','yt'] },
    { id:'c3', name:'Awareness Q1', status:'paused', start:'2026-01-01', end:'2026-03-31', budget:'R$ 22.000', posts:48, approved:40, pending:2, rejected:6, platforms:['ig','fb','li'] },
  ];
  LOCAL.set('campaigns', campaigns);
}

// ─── Navigation ────────────────────────────────────────────────
function showPage(page, el) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const sec = document.getElementById('sec-' + page);
  if (sec) sec.classList.add('active');
  if (el)  el.classList.add('active');
  APP.currentPage = page;
  const titles = {
    dashboard:'Dashboard', contas:'Contas', agendamentos:'Agendamentos',
    posts:'Posts', analise:'Em Análise', aprovados:'Aprovados',
    rejeitados:'Rejeitados', campanhas:'Campanhas', trafego:'Tráfego Pago'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  if (window.innerWidth < 960) closeMobile();
  renderPage(page);
}

function renderPage(page) {
  const renders = {
    dashboard:     renderDashboard,
    contas:        renderContas,
    agendamentos:  renderAgendamentos,
    posts:         renderPosts,
    analise:       () => renderPostsByStatus('analise','pending'),
    aprovados:     () => renderPostsByStatus('aprovados','approved'),
    rejeitados:    () => renderPostsByStatus('rejeitados','rejected'),
    campanhas:     renderCampanhas,
    trafego:       renderTrafego,
  };
  if (renders[page]) renders[page]();
}

function initApp() {
  renderDashboard();
  updateBadges();
}

function toggleMobile() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}
function closeMobile() {
  document.getElementById('sidebar').classList.remove('mobile-open');
}

// ─── Badges ───────────────────────────────────────────────────
function updateBadges() {
  const posts    = LOCAL.get('posts');
  const accounts = LOCAL.get('accounts');
  const pending  = posts.filter(p=>p.status==='pending').length;
  const rejected = posts.filter(p=>p.status==='rejected').length;
  const el = id => document.getElementById(id);
  if(el('badge-contas'))    el('badge-contas').textContent    = accounts.length;
  if(el('badge-analise'))   el('badge-analise').textContent   = pending;
  if(el('badge-rejeitados'))el('badge-rejeitados').textContent = rejected;
}

// ─── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  const posts = LOCAL.get('posts');
  const total    = posts.length;
  const approved = posts.filter(p=>p.status==='approved').length;
  const pending  = posts.filter(p=>p.status==='pending').length;
  const rejected = posts.filter(p=>p.status==='rejected').length;

  setEl('kpi-total',    total);
  setEl('kpi-approved', approved);
  setEl('kpi-pending',  pending);
  setEl('kpi-rejected', rejected);

  initCharts();
}

function initCharts() {
  if (APP.charts.engajamento) { Object.values(APP.charts).forEach(c=>c.destroy?.()); APP.charts = {}; }

  // Shared tooltip config
  const tooltipCfg = {
    enabled: true,
    backgroundColor: '#0F172A',
    titleColor: '#fff',
    bodyColor: '#94A3B8',
    padding: 12,
    cornerRadius: 8,
    titleFont: { family: "'DM Sans', sans-serif", weight: '700', size: 13 },
    bodyFont: { family: "'DM Sans', sans-serif", size: 12 },
    displayColors: true,
    boxPadding: 4,
    borderColor: '#1E293B',
    borderWidth: 1,
  };

  const gridColor = 'rgba(226,232,240,0.6)';
  const months    = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul'];

  // ── Linha: Engajamento
  const ctxEng = document.getElementById('chartEngajamento');
  if (ctxEng) {
    APP.charts.engajamento = new Chart(ctxEng, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          { label:'Instagram', data:[4200,4800,5100,6300,5900,7200,8100], borderColor:'#F97316', backgroundColor:'rgba(249,115,22,.1)', tension:.4, fill:true, pointRadius:4, pointHoverRadius:7, pointBackgroundColor:'#F97316', borderWidth:2.5 },
          { label:'Facebook',  data:[2100,2400,2200,2800,2600,3100,3400], borderColor:'#1877F2', backgroundColor:'rgba(24,119,242,.06)', tension:.4, fill:true, pointRadius:4, pointHoverRadius:7, pointBackgroundColor:'#1877F2', borderWidth:2.5 },
          { label:'TikTok',    data:[800,1200,2100,3400,2900,4100,5200],  borderColor:'#010101', backgroundColor:'rgba(1,1,1,.04)',       tension:.4, fill:true, pointRadius:4, pointHoverRadius:7, pointBackgroundColor:'#010101', borderWidth:2.5 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode:'index', intersect:false },
        plugins: { legend:{ display:true, position:'bottom', labels:{ font:{ family:"'DM Sans', sans-serif", size:11 }, boxWidth:12, usePointStyle:true, pointStyle:'circle' }}, tooltip: tooltipCfg },
        scales: {
          x: { grid:{ color:gridColor }, ticks:{ font:{ family:"'DM Sans', sans-serif", size:11 }, color:'#94A3B8' } },
          y: { grid:{ color:gridColor }, ticks:{ font:{ family:"'DM Sans', sans-serif", size:11 }, color:'#94A3B8' } }
        }
      }
    });
  }

  // ── Pizza: Mix de Plataformas
  const ctxPie = document.getElementById('chartPlatforms');
  if (ctxPie) {
    APP.charts.platforms = new Chart(ctxPie, {
      type: 'doughnut',
      data: {
        labels: ['Instagram','Facebook','YouTube','TikTok','LinkedIn'],
        datasets: [{ data:[38,24,14,17,7], backgroundColor:['#F97316','#1877F2','#FF0000','#010101','#0A66C2'], borderWidth:3, borderColor:'#fff', hoverBorderWidth:4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position:'right', labels:{ font:{ family:"'DM Sans', sans-serif", size:11 }, boxWidth:12, usePointStyle:true } },
          tooltip: tooltipCfg
        }
      }
    });
  }

  // ── Barras: Posts por Status
  const ctxBar = document.getElementById('chartPosts');
  if (ctxBar) {
    const posts = LOCAL.get('posts');
    const labels = ['Jan','Fev','Mar','Abr','Mai','Jun'];
    APP.charts.posts = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'Aprovados', data:[12,18,15,22,19,approved(posts,0)], backgroundColor:'#16A34A', borderRadius:4, borderSkipped:false },
          { label:'Pendentes', data:[3,5,4,7,3,pending(posts,0)],  backgroundColor:'#D97706', borderRadius:4, borderSkipped:false },
          { label:'Rejeitados',data:[1,2,1,3,1,rejected(posts,0)], backgroundColor:'#DC2626', borderRadius:4, borderSkipped:false },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ position:'bottom', labels:{ font:{ family:"'DM Sans', sans-serif", size:11 }, boxWidth:12 }}, tooltip: tooltipCfg },
        scales: {
          x: { stacked:true, grid:{ display:false }, ticks:{ font:{ family:"'DM Sans', sans-serif", size:11 }, color:'#94A3B8' } },
          y: { stacked:true, grid:{ color:gridColor }, ticks:{ font:{ family:"'DM Sans', sans-serif", size:11 }, color:'#94A3B8' } }
        }
      }
    });
  }

  // ── Linha: Alcance
  const ctxReach = document.getElementById('chartReach');
  if (ctxReach) {
    APP.charts.reach = new Chart(ctxReach, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          { label:'Alcance', data:[12000,15000,13500,18000,16500,21000,24500], borderColor:'#7C3AED', backgroundColor:'rgba(124,58,237,.1)', tension:.4, fill:true, pointRadius:4, pointHoverRadius:7, pointBackgroundColor:'#7C3AED', borderWidth:2.5 },
          { label:'Impressões', data:[18000,22000,20000,27000,24000,31000,36000], borderColor:'#F97316', backgroundColor:'rgba(249,115,22,.06)', tension:.4, fill:true, pointRadius:4, pointHoverRadius:7, pointBackgroundColor:'#F97316', borderWidth:2 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode:'index', intersect:false },
        plugins: { legend:{ position:'bottom', labels:{ font:{ family:"'DM Sans', sans-serif", size:11 }, boxWidth:12, usePointStyle:true }}, tooltip: tooltipCfg },
        scales: {
          x: { grid:{ color:gridColor }, ticks:{ font:{ family:"'DM Sans', sans-serif", size:11 }, color:'#94A3B8' } },
          y: { grid:{ color:gridColor }, ticks:{ font:{ family:"'DM Sans', sans-serif", size:11 }, color:'#94A3B8', callback: v => v >= 1000 ? (v/1000).toFixed(0)+'K' : v } }
        }
      }
    });
  }
}
const approved = (posts,_) => posts.filter(p=>p.status==='approved').length;
const pending  = (posts,_) => posts.filter(p=>p.status==='pending').length;
const rejected = (posts,_) => posts.filter(p=>p.status==='rejected').length;

// ─── Contas ────────────────────────────────────────────────────
function renderContas() {
  const accounts = LOCAL.get('accounts');
  const grid = document.getElementById('accountsGrid');
  if (!grid) return;

  const platformMeta = {
    ig:{ label:'Instagram', color:'#fd5949', icon:'IG', class:'si-ig' },
    fb:{ label:'Facebook',  color:'#1877F2', icon:'FB', class:'si-fb' },
    yt:{ label:'YouTube',   color:'#FF0000', icon:'YT', class:'si-yt' },
    tt:{ label:'TikTok',    color:'#010101', icon:'TT', class:'si-tt' },
    li:{ label:'LinkedIn',  color:'#0A66C2', icon:'IN', class:'si-li' },
  };

  if (!accounts.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔗</div><div class="empty-state-title">Nenhuma conta conectada</div><div class="empty-state-sub">Clique em "+ Nova Conta" para começar.</div></div>`;
    return;
  }

  grid.innerHTML = accounts.map(acc => {
    const meta = platformMeta[acc.platform] || { label:acc.platform, color:'#94A3B8', icon:'?', class:'' };
    return `
    <div class="account-card" onclick="showAccountDetail('${acc.id}')">
      <div class="account-card-head">
        <div class="account-avatar si ${meta.class}">${meta.icon}</div>
        <div class="account-info">
          <div class="account-name">${acc.name}</div>
          <div class="account-handle">${acc.handle}</div>
        </div>
        <span class="badge badge-green">Ativo</span>
      </div>
      <div class="account-stats">
        <div class="account-stat"><div class="account-stat-val">${acc.followers}</div><div class="account-stat-label">Seguidores</div></div>
        <div class="account-stat"><div class="account-stat-val">${acc.engagement}</div><div class="account-stat-label">Engajamento</div></div>
        <div class="account-stat"><div class="account-stat-val">${acc.posts}</div><div class="account-stat-label">Posts</div></div>
        <div class="account-stat"><div class="account-stat-val">${meta.label}</div><div class="account-stat-label">Plataforma</div></div>
      </div>
      <div class="account-card-footer">
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();showToast('Abrindo ${meta.label}...','info')">Ver Perfil</button>
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();showToast('Sincronizando ${acc.name}...','info')">Sincronizar</button>
      </div>
    </div>`;
  }).join('');
}

function showAccountDetail(id) {
  const acc = LOCAL.get('accounts').find(a=>a.id===id);
  if (!acc) return;
  showToast('Abrindo ' + acc.name + ' (' + acc.platform.toUpperCase() + ')', 'info');
}

function addAccount(data) {
  const acc = LOCAL.add('accounts', data);
  updateBadges();
  renderContas();
  showToast('Conta ' + data.name + ' adicionada!', 'success');
  closeModal('modalConta');
  return acc;
}

// ─── Posts helpers ────────────────────────────────────────────
const STATUS_MAP = {
  approved:'Aprovado', pending:'Em Análise', rejected:'Rejeitado', scheduled:'Agendado'
};
const STATUS_BADGE = {
  approved:'badge-green', pending:'badge-yellow', rejected:'badge-red', scheduled:'badge-blue'
};
const PLATFORM_LABEL = { ig:'Instagram', fb:'Facebook', yt:'YouTube', tt:'TikTok', li:'LinkedIn' };

function renderPostsByStatus(secId, status) {
  const posts = LOCAL.get('posts').filter(p => p.status === status);
  const grid  = document.getElementById(secId + '-grid');
  if (!grid) return;
  if (!posts.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${status==='pending'?'⏳':status==='approved'?'✅':'❌'}</div><div class="empty-state-title">Nenhum post aqui</div><div class="empty-state-sub">Os posts com status "${STATUS_MAP[status]}" aparecerão aqui.</div></div>`;
    return;
  }
  grid.innerHTML = posts.map(p => renderPostCard(p)).join('');
}

function renderPosts() {
  const posts = LOCAL.get('posts');
  const grid  = document.getElementById('posts-grid');
  if (!grid) return;
  grid.innerHTML = posts.map(p => renderPostCard(p)).join('');
}

function renderPostCard(p) {
  const platformSi = { ig:'si-ig', fb:'si-fb', yt:'si-yt', tt:'si-tt', li:'si-li' };
  return `
  <div class="post-card" onclick="showPostDetail('${p.id}')">
    <div class="post-card-thumb">${p.thumb||'📷'}
      <div style="position:absolute;top:8px;left:8px;">
        <span class="si ${platformSi[p.platform]||''}" style="width:22px;height:22px;font-size:9px;">${p.platform?.toUpperCase().slice(0,2)||'?'}</span>
      </div>
    </div>
    <div class="post-card-body">
      <div class="post-card-title">${p.title}</div>
      <div class="post-card-meta">${p.date} · ${PLATFORM_LABEL[p.platform]||p.platform}</div>
    </div>
    <div class="post-card-footer">
      <span class="badge ${STATUS_BADGE[p.status]||'badge-gray'}">${STATUS_MAP[p.status]||p.status}</span>
      <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();generateApprovalLink('${p.id}')">Compartilhar</button>
    </div>
  </div>`;
}

function showPostDetail(id) {
  const p = LOCAL.get('posts').find(x=>x.id===id);
  if (!p) return;
  const modal = document.getElementById('modalPostDetail');
  if (!modal) return;
  document.getElementById('detail-title').textContent    = p.title;
  document.getElementById('detail-thumb').textContent    = p.thumb || '📷';
  document.getElementById('detail-status').className     = 'badge ' + (STATUS_BADGE[p.status]||'badge-gray');
  document.getElementById('detail-status').textContent   = STATUS_MAP[p.status]||p.status;
  document.getElementById('detail-platform').textContent = PLATFORM_LABEL[p.platform]||p.platform;
  document.getElementById('detail-date').textContent     = p.date;
  document.getElementById('detail-caption').textContent  = p.caption||'Sem legenda.';
  document.getElementById('detail-campaign').textContent = p.campaign||'—';
  openModal('modalPostDetail');
}

// ─── Agendamentos ─────────────────────────────────────────────
function renderAgendamentos() {
  const posts = LOCAL.get('posts');
  const list  = document.getElementById('agend-list');
  if (!list) return;
  list.innerHTML = posts.map(p => `
  <tr onclick="showPostDetail('${p.id}')" style="cursor:pointer;">
    <td><span style="font-size:20px;margin-right:8px;">${p.thumb||'📷'}</span><span class="td-primary">${p.title}</span></td>
    <td><span class="badge ${STATUS_BADGE[p.status]||'badge-gray'}">${STATUS_MAP[p.status]||p.status}</span></td>
    <td>${PLATFORM_LABEL[p.platform]||p.platform}</td>
    <td class="td-mono">${p.date}</td>
    <td>${p.campaign||'—'}</td>
    <td>
      <button class="btn btn-xs btn-primary" onclick="event.stopPropagation();generateApprovalLink('${p.id}')">Aprovar</button>
      <button class="btn btn-xs btn-secondary" style="margin-left:4px;" onclick="event.stopPropagation();changeStatus('${p.id}','approved')">✓</button>
    </td>
  </tr>`).join('');
}

function renderCampanhas() {
  const campaigns = LOCAL.get('campaigns');
  const list = document.getElementById('campanhas-list');
  if (!list) return;

  const statusMap = { active:'badge-green', paused:'badge-yellow', ended:'badge-gray' };
  const statusLabel = { active:'Ativa', paused:'Pausada', ended:'Encerrada' };

  list.innerHTML = campaigns.map(c => {
    const prog = c.posts ? Math.round((c.approved/c.posts)*100) : 0;
    return `
    <div class="chart-card" style="margin-bottom:14px;cursor:pointer;" onclick="showCampaignDetail('${c.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px;">${c.name}</div>
          <div style="font-size:12px;color:var(--text3);">${c.start} → ${c.end}</div>
        </div>
        <span class="badge ${statusMap[c.status]||'badge-gray'}">${statusLabel[c.status]||c.status}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;">
        <div style="text-align:center;"><div style="font-size:20px;font-weight:800;font-family:'Space Grotesk',sans-serif;">${c.posts}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;">Total Posts</div></div>
        <div style="text-align:center;"><div style="font-size:20px;font-weight:800;color:var(--green);font-family:'Space Grotesk',sans-serif;">${c.approved}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;">Aprovados</div></div>
        <div style="text-align:center;"><div style="font-size:20px;font-weight:800;color:var(--yellow);font-family:'Space Grotesk',sans-serif;">${c.pending}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;">Pendentes</div></div>
        <div style="text-align:center;"><div style="font-size:20px;font-weight:800;font-family:'Space Grotesk',sans-serif;">${c.budget}</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;">Budget</div></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px;color:var(--text3);">
          <span>Progresso de aprovação</span><span>${prog}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${prog}%;background:${prog>=80?'var(--green)':prog>=50?'var(--yellow)':'var(--primary)'};"></div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();openModal('modalCampanha')">Editar Campanha</button>
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();showToast('Relatório gerado!','success')">📊 Relatório</button>
      </div>
    </div>`;
  }).join('') || '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Nenhuma campanha</div><div class="empty-state-sub">Crie sua primeira campanha.</div></div>';
}

function showCampaignDetail(id) {
  const c = LOCAL.get('campaigns').find(x=>x.id===id);
  if (!c) return;
  showToast('Abrindo campanha: ' + c.name, 'info');
}

function renderTrafego() {
  // Chart de Tráfego Pago
  if (APP.charts.trafego) { APP.charts.trafego.destroy(); delete APP.charts.trafego; }
  const ctx = document.getElementById('chartTrafego');
  if (!ctx) return;
  const tooltipCfg = { enabled:true, backgroundColor:'#0F172A', titleColor:'#fff', bodyColor:'#94A3B8', padding:12, cornerRadius:8 };
  APP.charts.trafego = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Instagram','Facebook','Google Ads','TikTok','YouTube'],
      datasets: [
        { label:'CPC (R$)', data:[1.20,0.85,2.10,0.65,1.80], backgroundColor:'#F97316', borderRadius:6, borderSkipped:false },
        { label:'CPM (R$)', data:[12,8,18,6,15], backgroundColor:'#7C3AED', borderRadius:6, borderSkipped:false },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ position:'bottom', labels:{ font:{ family:"'DM Sans', sans-serif", size:11 }, boxWidth:12 }}, tooltip: tooltipCfg },
      scales: {
        x:{ grid:{ display:false }, ticks:{ font:{ family:"'DM Sans', sans-serif", size:11 }, color:'#94A3B8' } },
        y:{ grid:{ color:'rgba(226,232,240,.6)' }, ticks:{ font:{ family:"'DM Sans', sans-serif", size:11 }, color:'#94A3B8', callback:v=>'R$ '+v.toFixed(2) } }
      }
    }
  });
}

// ─── Status changes ──────────────────────────────────────────
function changeStatus(id, newStatus) {
  LOCAL.update('posts', id, { status: newStatus });
  updateBadges();
  renderPage(APP.currentPage);
  const labels = { approved:'aprovado ✅', pending:'enviado para análise ⏳', rejected:'rejeitado ❌' };
  showToast('Post ' + (labels[newStatus]||newStatus), newStatus==='approved'?'success':newStatus==='rejected'?'error':'info');
}

// ─── Approval link ───────────────────────────────────────────
function generateApprovalLink(id) {
  const link = `${window.location.origin}${window.location.pathname}?approval=${id}`;
  const modal = document.getElementById('modalShare');
  if (modal) {
    document.getElementById('share-link-input').value = link;
    document.getElementById('share-wa').href = `https://wa.me/?text=${encodeURIComponent('Olá! Segue o link para aprovação do criativo:\n' + link)}`;
    document.getElementById('share-email').href = `mailto:?subject=Aprovação de Criativo - AHA Social Planning&body=${encodeURIComponent('Olá!\n\nPor favor, acesse o link abaixo para revisar e aprovar o criativo:\n\n' + link + '\n\nAguardo seu retorno.\n\nAHA Social Planning')}`;
    openModal('modalShare');
  } else {
    navigator.clipboard?.writeText(link).then(() => showToast('Link copiado!', 'success'));
  }
}

function copyLink() {
  const input = document.getElementById('share-link-input');
  if (input) {
    navigator.clipboard?.writeText(input.value).then(() => showToast('Link copiado!', 'success'));
  }
}

// ─── Approval page (public) ───────────────────────────────────
function checkApprovalMode() {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get('approval');
  if (!postId) return;
  const p = LOCAL.get('posts').find(x=>x.id===postId);
  if (!p) { showToast('Post não encontrado.', 'error'); return; }
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('app').style.display       = 'none';
  const ap = document.getElementById('approvalPage');
  ap.style.display = 'block';
  document.getElementById('ap-thumb').textContent   = p.thumb || '📷';
  document.getElementById('ap-title').textContent   = p.title;
  document.getElementById('ap-platform').textContent= PLATFORM_LABEL[p.platform]||p.platform;
  document.getElementById('ap-date').textContent    = p.date;
  document.getElementById('ap-campaign').textContent= p.campaign||'—';
  document.getElementById('ap-caption').textContent = p.caption||'Sem legenda.';
  document.getElementById('ap-status').className    = 'badge ' + (STATUS_BADGE[p.status]||'badge-gray');
  document.getElementById('ap-status').textContent  = STATUS_MAP[p.status]||p.status;
  window._approvalPostId = postId;
}

function approvalAction(action) {
  const id = window._approvalPostId;
  if (!id) return;
  changeStatus(id, action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending');
  const msgs = { approve:'✅ Aprovado com sucesso!', reject:'❌ Criativo rejeitado.', correct:'⚠️ Correção solicitada!' };
  document.getElementById('ap-status').textContent = { approve:'Aprovado', reject:'Rejeitado', correct:'Correção Solicitada' }[action];
  showToast(msgs[action]||'Ação registrada!', action==='approve'?'success':action==='reject'?'error':'warning');
}

// ─── Modals ──────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = id ? document.getElementById(id) : null;
  if (el) { el.classList.remove('open'); return; }
  document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
}

// ─── Save new post/schedule ──────────────────────────────────
function saveAgendamento() {
  const data = {
    title:    document.getElementById('ag-title')?.value,
    platform: document.getElementById('ag-platform')?.value,
    date:     document.getElementById('ag-date')?.value,
    campaign: document.getElementById('ag-campaign')?.value,
    caption:  document.getElementById('ag-caption')?.value,
    status:   'pending',
    thumb:    ['📷','🎬','🎵','📊','🖼️'][Math.floor(Math.random()*5)],
    type:     'image'
  };
  if (!data.title) { showToast('Informe o título do post.', 'warning'); return; }
  LOCAL.add('posts', data);
  updateBadges();
  renderPage(APP.currentPage);
  closeModal('modalAgendamento');
  showToast('Agendamento criado com sucesso!', 'success');
}

function saveCampanha() {
  const data = {
    name:    document.getElementById('camp-name')?.value,
    start:   document.getElementById('camp-start')?.value,
    end:     document.getElementById('camp-end')?.value,
    budget:  document.getElementById('camp-budget')?.value,
    status:  'active', posts:0, approved:0, pending:0, rejected:0, platforms:['ig']
  };
  if (!data.name) { showToast('Informe o nome da campanha.', 'warning'); return; }
  LOCAL.add('campaigns', data);
  renderCampanhas();
  closeModal('modalCampanha');
  showToast('Campanha criada!', 'success');
}

function saveNewAccount() {
  const platform = document.getElementById('acc-platform')?.value;
  const handle   = document.getElementById('acc-handle')?.value;
  if (!platform || !handle) { showToast('Preencha plataforma e usuário.', 'warning'); return; }
  const names = { ig:'Instagram', fb:'Facebook', yt:'YouTube', tt:'TikTok', li:'LinkedIn' };
  addAccount({ name:'AHA ' + (names[platform]||platform), handle:'@'+handle, platform, followers:'0', engagement:'0%', posts:0, status:'active' });
}

// ─── Toast ───────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type='info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  toast.className = 'toast show toast-' + type;
  toast.querySelector('.toast-title').textContent = msg;
  toast.querySelector('.toast-line').style.animation = 'none';
  setTimeout(() => toast.querySelector('.toast-line').style.animation = '', 10);
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ─── Utils ───────────────────────────────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── Init approval check ─────────────────────────────────────
checkApprovalMode();
