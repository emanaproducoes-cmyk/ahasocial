// AHA Social Planning — app.js v3.2 — ORIGINAL RECUPERADO
const APP = { user:null, currentPage:'dashboard', charts:{}, editingId:null, unsubs:[] };

const PL  = {ig:'Instagram',fb:'Facebook',yt:'YouTube',tt:'TikTok',li:'LinkedIn',tw:'Twitter/X'};
const PSI = {ig:'si-ig',fb:'si-fb',yt:'si-yt',tt:'si-tt',li:'si-li'};
const PSH = {ig:'IG',fb:'FB',yt:'YT',tt:'TT',li:'IN',tw:'X'};\
const SL  = {pending:'Em Análise',approved:'Aprovado',rejected:'Rejeitado',scheduled:'Agendado',draft:'Rascunho'};\
const SB  = {pending:'badge-yellow',approved:'badge-green',rejected:'badge-red',scheduled:'badge-blue',draft:'badge-gray'};\
const TEMO= {image:'📸',video:'🎬',story:'📱',reel:'🎵',carousel:'🎠'};\

document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  AUTH.onAuthChange(fbUser => {
    if (fbUser) {
      const name = fbUser.displayName || fbUser.email.split('@')[0];
      APP.user = { uid:fbUser.uid, email:fbUser.email, name, avatar: name.substring(0,2).toUpperCase() };
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
}

function startListeners() {
  DB.listen('posts', posts => {
    LOCAL.set('posts', posts);
    renderPage(APP.currentPage);
  });
}

// FUNÇÃO ORIGINAL DE ABRIR MODAL COM FIX PARA EDIÇÃO
function openPostModal(id = null) {
  APP.editingId = id;
  const modal = el('modalAgend');
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
      // Aqui você pode adicionar a lógica de seleção de plataforma/tipo original
    }
  } else {
    el('modalTitle').textContent = 'Novo Agendamento';
  }
  modal.classList.add('show');
}

async function savePost() {
  const data = {
    title: v('ag-title'),
    date: v('ag-date'),
    caption: v('ag-caption'),
    campaign: v('ag-campaign'),
    updatedAt: new Date().toISOString()
  };

  if (APP.editingId) {
    await DB.update('posts', APP.editingId, data);
    toast('Post atualizado!', 'success');
  } else {
    data.status = 'pending';
    data.createdAt = new Date().toISOString();
    await DB.add('posts', data);
    toast('Post criado!', 'success');
  }
  closeModal('modalAgend');
}

// Helpers que estavam no seu app.js
const el=(id)=>document.getElementById(id);
const sv=(id,val)=>{const e=el(id);if(e)e.value=val;};
const v=(id)=>el(id)?.value||'';
const setText=(id,val)=>{const e=el(id);if(e)e.textContent=val;};
function closeModal(id){ el(id)?.classList.remove('show'); APP.editingId = null;
