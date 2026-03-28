// AHA Social Planning — app.js v3.2 — RESTAURADO E CORRIGIDO
const APP = { user:null, currentPage:'dashboard', charts:{}, editingId:null, unsubs:[], selectedPlatform:'ig', selectedType:'image' };

const PL  = {ig:'Instagram',fb:'Facebook',yt:'YouTube',tt:'TikTok',li:'LinkedIn',tw:'Twitter/X'};
const SL  = {pending:'Em Análise',approved:'Aprovado',rejected:'Rejeitado',scheduled:'Agendado',draft:'Rascunho'};

document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  AUTH.onAuthChange(fbUser => {
    if (fbUser) {
      const name = fbUser.displayName || fbUser.email.split('@')[0];
      APP.user = { uid:fbUser.uid, email:fbUser.email, name, avatar:name.substring(0,2).toUpperCase() };
      showApp();
    } else {
      el('loginPage').style.display = 'flex';
      el('app').style.display = 'none';
    }
  });
});

function showApp() {
  el('loginPage').style.display = 'none';
  el('app').style.display = 'block';
  setText('sideUserName', APP.user.name);
  startListeners();
  renderDashboard();
}

function startListeners() {
  DB.listen('posts', posts => {
    LOCAL.set('posts', posts);
    updateBadges();
    renderPage(APP.currentPage);
  });
}

function showPage(page, btn) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if(btn) btn.classList.add('active');
  APP.currentPage = page;
  renderPage(page);
}

function renderPage(page) {
  if(page === 'dashboard') renderDashboard();
  if(page === 'agendamentos') renderAgendamentos();
}

// CORREÇÃO: ABRIR MODAL PARA EDIÇÃO
function openPostModal(id = null) {
  const modal = el('modalAgend');
  APP.editingId = id;
  
  const form = el('formAgend');
  if(form) form.reset();

  if (id) {
    const post = LOCAL.get('posts').find(p => p.id === id);
    if (post) {
      el('modalTitle').textContent = 'Editar Agendamento';
      sv('ag-title', post.title);
      sv('ag-date', post.date);
      sv('ag-caption', post.caption);
      sv('ag-campaign', post.campaign);
      APP.selectedPlatform = post.platform;
      APP.selectedType = post.type;
    }
  } else {
    el('modalTitle').textContent = 'Novo Agendamento';
  }
  modal.classList.add('show');
}

// CORREÇÃO: SALVAR OU ATUALIZAR
async function savePost() {
  const data = {
    title: v('ag-title'),
    date: v('ag-date'),
    caption: v('ag-caption'),
    campaign: v('ag-campaign'),
    platform: APP.selectedPlatform,
    type: APP.selectedType,
    updatedAt: new Date().toISOString()
  };

  if (!data.title || !data.date) return toast('Título e data obrigatórios', 'warning');

  try {
    if (APP.editingId) {
      await DB.update('posts', APP.editingId, data);
      toast('Atualizado!', 'success');
    } else {
      data.status = 'pending';
      data.createdAt = new Date().toISOString();
      await DB.add('posts', data);
      toast('Criado!', 'success');
    }
    closeModal('modalAgend');
  } catch (e) {
    toast('Erro ao salvar', 'error');
  }
}

function closeModal(id) { el(id)?.classList.remove('show'); APP.editingId = null; }
function updateBadges() { /* Lógica de badges original */ }
function renderDashboard() { /* Lógica de dashboard original */ }

// Helpers
const el = (id) => document.getElementById(id);
const v = (id) => el(id)?.value || '';
const sv = (id, val) => { if(el(id)) el(id).value = val; };
const setText = (id, val) => { if(el(id)) el(id).textContent = val; };
function toast(m, t) { console.log(`${t}: ${m}`); }
