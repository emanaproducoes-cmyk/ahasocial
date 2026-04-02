// ── AHA Social Planning — firebase-config.js v7.0 ──
// ARQUITETURA: Firestore é a fonte única da verdade.
// LOCAL é apenas um espelho/cache do Firestore.
// Reads vão para LOCAL (que é sempre igual ao Firestore).
// Writes vão para Firestore → onSnapshot atualiza LOCAL → re-render.
// ──────────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBI37N7zGJB6OL5ISLHjLeCvTOmh0avUBo",
  authDomain:        "ahasocialplanning.firebaseapp.com",
  projectId:         "ahasocialplanning",
  storageBucket:     "ahasocialplanning.firebasestorage.app",
  messagingSenderId: "196747989859",
  appId:             "1:196747989859:web:0766d3bec205219e66f956",
  measurementId:     "G-6X9MM77R3V"
};

const INSTAGRAM_CONFIG = {
  appId:       "SEU_INSTAGRAM_APP_ID",
  redirectUri: window.location.origin + "/instagram-callback.html",
  scope:       "instagram_basic,instagram_content_publish,instagram_manage_insights"
};

// ── Estado interno ────────────────────────────────────────────────
let _db = null, _auth = null, _storage = null;
let _firebaseReady = false;

// Promise que resolve após o PRIMEIRO sync do Firestore chegar
// (usada para garantir que o primeiro render usa dados reais)
let _firstSyncResolvers = {};
let _firstSyncPromises = {};
['posts','accounts','campaigns'].forEach(col => {
  _firstSyncPromises[col] = new Promise(resolve => { _firstSyncResolvers[col] = resolve; });
});

// ── Init Firebase ─────────────────────────────────────────────────
// Promise que resolve quando o Firebase Auth estiver pronto com sessão válida
let _authReadyResolve;
const _authReady = new Promise(r => { _authReadyResolve = r; });

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('[AHA] Firebase SDK não carregado.');
      _authReadyResolve(false);
      return false;
    }
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db      = firebase.firestore();
    _auth    = firebase.auth();
    _storage = firebase.storage();

    // Persistência offline
    _db.enablePersistence({ synchronizeTabs: true })
      .catch(e => { /* failed-precondition = múltiplas abas, normal */ });

    // ── AUTH GARANTIDO ───────────────────────────────────────────
    // Aguarda o Firebase Auth resolver o estado (pode ter sessão existente).
    // Se não houver sessão nenhuma, faz login anônimo automaticamente.
    // Isso garante que TODOS os dispositivos sempre têm request.auth != null
    // e portanto têm acesso ao Firestore.
    _auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Já tem sessão (email/google/anônimo) — Firestore liberado
        console.log('[AHA] ✅ Auth OK:', user.isAnonymous ? 'anônimo' : user.email);
        _firebaseReady = true;
        _authReadyResolve(true);
      } else {
        // Sem sessão → login anônimo silencioso para liberar Firestore
        console.log('[AHA] 🔄 Sem sessão, fazendo login anônimo...');
        try {
          await _auth.signInAnonymously();
          // onAuthStateChanged vai disparar novamente com o usuário anônimo
        } catch(e) {
          console.error('[AHA] ❌ Login anônimo falhou:', e.message);
          // Se o login anônimo falhou, tenta continuar mesmo assim
          _firebaseReady = true;
          _authReadyResolve(false);
        }
      }
    });

    console.log('[AHA] Firebase inicializado. Aguardando auth...');
    return true;
  } catch(e) {
    console.error('[AHA] Firebase erro:', e.message);
    _authReadyResolve(false);
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────
function _nowISO() { return new Date().toISOString(); }

function _fsTimestampToISO(val) {
  if (!val) return _nowISO();
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return _nowISO();
}

function _cleanDoc(docSnapshot) {
  // Converte FieldValues (Timestamps etc) para ISO string
  const data = docSnapshot.data();
  const clean = { id: docSnapshot.id };
  Object.entries(data || {}).forEach(([k, v]) => {
    clean[k] = (v && typeof v.toDate === 'function') ? v.toDate().toISOString() : v;
  });
  return clean;
}

function _sortByDate(docs) {
  // Ordena client-side por createdAt desc (evita índice no Firestore)
  return [...docs].sort((a, b) => {
    const ta = a.createdAt || '0';
    const tb = b.createdAt || '0';
    return tb.localeCompare(ta);
  });
}

// ── LOCAL: cache localStorage (espelho do Firestore) ─────────────
// APENAS para leitura pelo app.js. Escrita feita aqui via onSnapshot.
const LOCAL = {
  get(k)        { try{return JSON.parse(localStorage.getItem('aha_'+k))||[];}catch{return[];} },
  set(k,d)      { try{localStorage.setItem('aha_'+k,JSON.stringify(d));}catch(e){console.warn('[AHA] localStorage:',e);} },
  add(k,item)   {
    const id = 'loc_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    const n = {...item, id, createdAt: _nowISO()};
    const a = this.get(k); a.unshift(n); this.set(k,a); return n;
  },
  update(k,id,d){
    const a = this.get(k); const i = a.findIndex(x=>x.id===id);
    if(i!==-1){a[i]={...a[i],...d,updatedAt:_nowISO()};this.set(k,a);return a[i];}
    return null;
  },
  remove(k,id)  { this.set(k, this.get(k).filter(x=>x.id!==id)); },
  find(k,id)    { return this.get(k).find(x=>x.id===id)||null; },
};

// ── Firestore: operações diretas ──────────────────────────────────
const FS = {
  // ⚠️ NÃO usa orderBy() — evita necessidade de índice.
  // Ordenação é feita client-side em _sortByDate().

  async getAll(col) {
    if (!_db) return null;
    try {
      const snap = await _db.collection(col).get();
      return _sortByDate(snap.docs.map(_cleanDoc));
    } catch(e) {
      _logFSError('getAll', col, e);
      return null;
    }
  },

  async get(col, id) {
    if (!_db) return null;
    try {
      const d = await _db.collection(col).doc(id).get();
      return d.exists ? _cleanDoc(d) : null;
    } catch(e) {
      _logFSError('get', col, e);
      return null;
    }
  },

  async add(col, data) {
    if (!_db) return null;
    // Usa ISO string para createdAt — NÃO usa serverTimestamp() (que é null no cliente)
    const now = _nowISO();
    const clean = _cleanPayload(data);
    try {
      const ref = await _db.collection(col).add({ ...clean, createdAt: now, updatedAt: now });
      const result = { id: ref.id, ...clean, createdAt: now, updatedAt: now };
      console.log(`[AHA] ✅ Firestore add: ${col}/${ref.id}`);
      return result;
    } catch(e) {
      _logFSError('add', col, e);
      return null;
    }
  },

  async update(col, id, data) {
    if (!_db) return null;
    const clean = _cleanPayload(data);
    try {
      await _db.collection(col).doc(id).update({ ...clean, updatedAt: _nowISO() });
      return { id, ...clean };
    } catch(e) {
      _logFSError('update', col, e);
      return null;
    }
  },

  async delete(col, id) {
    if (!_db) return false;
    try { await _db.collection(col).doc(id).delete(); return true; }
    catch(e) { _logFSError('delete', col, e); return false; }
  },

  // ⚠️ NÃO usa orderBy() — evita necessidade de índice Firestore.
  onSnapshot(col, onData, onErr) {
    if (!_db) return () => {};
    console.log(`[AHA] 📡 Iniciando listener: ${col}`);
    return _db.collection(col).onSnapshot(
      { includeMetadataChanges: false },
      snap => {
        const docs = _sortByDate(snap.docs.map(_cleanDoc));
        console.log(`[AHA] 🔄 Snapshot ${col}: ${docs.length} docs`);
        onData(docs);
      },
      err => {
        _logFSError('onSnapshot', col, err);
        if (onErr) onErr(err);
      }
    );
  }
};

function _cleanPayload(data) {
  // Remove undefined, id temporários, campos não serializáveis
  const clean = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined) return;
    if (k === 'id') return; // id é gerenciado pelo Firestore
    // Converte null para string vazia em campos de texto
    clean[k] = v;
  });
  return clean;
}

function _logFSError(op, col, e) {
  console.error(`[AHA] ❌ Firestore ${op}(${col}):`, e.code, e.message);
  if (e.code === 'permission-denied') {
    const msg = '🔴 Firebase: sem permissão de acesso. Configure as Regras do Firestore:\n\nrules_version = \'2\';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}';
    console.error(msg);
    if (typeof toast === 'function') {
      toast('🔴 Firestore: permissão negada. Verifique as Regras no Console Firebase.', 'error');
    }
  }
  if (e.code === 'failed-precondition' && e.message.includes('index')) {
    console.error('[AHA] ⚠️ Índice Firestore necessário. Usando listener sem orderBy para evitar isso.');
  }
}

// ── AUTH ──────────────────────────────────────────────────────────
const AUTH = {
  async loginGoogle() {
    if (!_auth) return null;
    try {
      const r = await _auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      return r.user;
    } catch(e) { console.error('[AHA] Google login:', e.message); return null; }
  },
  async loginEmail(email, password) {
    if (!_auth) return null;
    try {
      return (await _auth.signInWithEmailAndPassword(email, password)).user;
    } catch(e) {
      if (['auth/user-not-found','auth/invalid-credential','auth/invalid-email'].includes(e.code)) {
        try { return (await _auth.createUserWithEmailAndPassword(email, password)).user; } catch { return null; }
      }
      return null;
    }
  },
  logout() { if (_auth) return _auth.signOut(); },
  onAuthChange(cb) {
    if (!_auth) { cb(null); return () => {}; }
    return _auth.onAuthStateChanged(cb);
  }
};

// ── INSTAGRAM ─────────────────────────────────────────────────────
const INSTAGRAM = {
  startOAuth() {
    if (!INSTAGRAM_CONFIG.appId || INSTAGRAM_CONFIG.appId === 'SEU_INSTAGRAM_APP_ID') return false;
    const p = new URLSearchParams({ client_id: INSTAGRAM_CONFIG.appId, redirect_uri: INSTAGRAM_CONFIG.redirectUri, scope: INSTAGRAM_CONFIG.scope, response_type: 'code', state: 'aha_'+Date.now() });
    window.open('https://api.instagram.com/oauth/authorize?'+p.toString(), 'ig_oauth', 'width=600,height=700');
    return true;
  }
};

// ── UPLOAD ────────────────────────────────────────────────────────
const UPLOAD = {
  async file(file, folder, onProgress) {
    if (_storage) {
      try {
        const path = `${folder}/${Date.now()}.${file.name.split('.').pop()}`;
        const task = _storage.ref(path).put(file);
        return new Promise((resolve, reject) => {
          task.on('state_changed',
            s => { if (onProgress) onProgress(Math.round((s.bytesTransferred/s.totalBytes)*100)); },
            reject,
            async () => resolve({ url: await task.snapshot.ref.getDownloadURL(), type: file.type.startsWith('video')?'video':'image', isRemote: true })
          );
        });
      } catch(e) { console.warn('[AHA] Storage falhou, usando base64'); }
    }
    return new Promise((resolve, reject) => {
      if (file.size > 8*1024*1024) { reject(new Error('Máx. 8MB no modo offline.')); return; }
      const r = new FileReader();
      r.onload  = e => resolve({ url: e.target.result, type: file.type.startsWith('video')?'video':'image', isRemote: false });
      r.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      r.readAsDataURL(file);
    });
  }
};

// ── DB: API pública — Firestore + LOCAL em sincronia ─────────────
//
// REGRAS FUNDAMENTAIS:
// 1. Writes → sempre vão para Firestore (se disponível)
// 2. onSnapshot → atualiza LOCAL imediatamente
// 3. Reads (LOCAL.get/find) → sempre retornam dados do Firestore (via mirror)
// 4. SEM orderBy no Firestore — sort feito client-side
//
const DB = {
  _syncing: {},           // col → Set de ids sendo migrados
  _listeners: {},         // col → unsubscribe fn
  _initialDataReady: {},  // col → boolean (primeiro snapshot recebido)

  // ── CRUD ────────────────────────────────────────────────────
  async add(col, data) {
    if (_firebaseReady) {
      const result = await FS.add(col, data);
      if (result) {
        // Atualiza LOCAL com o ID real do Firestore (antes do onSnapshot chegar)
        const arr = LOCAL.get(col);
        if (!arr.find(i => i.id === result.id)) {
          arr.unshift(result);
          LOCAL.set(col, arr);
        }
        return result;
      }
    }
    // Fallback offline: id temporário loc_
    const item = LOCAL.add(col, data);
    console.warn(`[AHA] ⚠️ Offline: ${col} salvo localmente (${item.id})`);
    return item;
  },

  async update(col, id, d) {
    // Atualiza LOCAL imediatamente para UI responsiva
    LOCAL.update(col, id, d);
    if (_firebaseReady) {
      const r = await FS.update(col, id, d);
      if (r) return r;
    }
    return LOCAL.find(col, id);
  },

  async remove(col, id) {
    LOCAL.remove(col, id);
    if (_firebaseReady) await FS.delete(col, id);
  },

  async find(col, id) {
    if (_firebaseReady) {
      const r = await FS.get(col, id);
      if (r) return r;
    }
    return LOCAL.find(col, id);
  },

  async getAll(col) {
    if (_firebaseReady) {
      const docs = await FS.getAll(col);
      if (docs !== null) { LOCAL.set(col, docs); return docs; }
    }
    return LOCAL.get(col);
  },

  // ── listen: escuta em tempo real o Firestore ─────────────────
  // REGRA CRÍTICA: o onSnapshot SÓ é iniciado APÓS _authReady resolver.
  // Isso garante que request.auth != null quando o Firestore verifica as regras.
  // Sem isso, o snapshot falha com permission-denied em abas anônimas/novas.
  listen(col, cb) {
    if (!this._syncing[col]) this._syncing[col] = new Set();

    // Chama cb imediatamente com cache LOCAL (UI responsiva enquanto aguarda)
    cb(LOCAL.get(col));

    // Modo sem Firebase: polling no localStorage
    if (!_db && !_auth) {
      console.warn(`[AHA] ⚠️ Modo offline puro — ${col} usa localStorage`);
      const t = setInterval(() => cb(LOCAL.get(col)), 2000);
      return () => clearInterval(t);
    }

    // Variáveis de controle do listener assíncrono
    let _unsubFirestore = null;
    let _cancelled = false;

    // ── Aguarda auth PRONTA antes de abrir o onSnapshot ──────────
    // Isso é o ponto crítico: sem auth, Firestore nega acesso.
    _authReady.then(authOk => {
      if (_cancelled) return;
      if (!_db) { cb(LOCAL.get(col)); return; }

      console.log(`[AHA] 🔓 Auth pronta (${authOk?'OK':'falhou'}), iniciando listener: ${col}`);

      const unsub = FS.onSnapshot(
        col,
        async (fsDocs) => {
          // Firestore é a fonte da verdade: substitui LOCAL completamente
          // mas preserva itens loc_ (offline, ainda não sincronizados)
          const localItems = LOCAL.get(col);
          const fsIds = new Set(fsDocs.map(d => d.id));
          const offlineItems = localItems.filter(i => i.id && i.id.startsWith('loc_') && !fsIds.has(i.id));

          // Merge: dados Firestore + pendentes offline
          const merged = _sortByDate([...fsDocs, ...offlineItems]);
          LOCAL.set(col, merged);

          // Marca primeiro sync como pronto
          if (!this._initialDataReady[col]) {
            this._initialDataReady[col] = true;
            if (_firstSyncResolvers[col]) _firstSyncResolvers[col](merged);
            console.log(`[AHA] ✅ Primeiro sync ${col}: ${fsDocs.length} docs`);
          }

          // Notifica app.js
          cb(merged);

          // Migra itens offline para Firestore
          for (const item of offlineItems) {
            if (this._syncing[col].has(item.id)) continue;
            this._syncing[col].add(item.id);
            const { id: locId, createdAt, updatedAt, ...data } = item;
            const result = await FS.add(col, { ...data, createdAt });
            if (result) {
              LOCAL.remove(col, locId);
              const arr = LOCAL.get(col);
              if (!arr.find(i => i.id === result.id)) arr.unshift(result);
              LOCAL.set(col, arr);
              console.log(`[AHA] ✅ Migrado offline: ${col}/${locId} → ${result.id}`);
              // Disparar re-render
              cb(LOCAL.get(col));
            }
            this._syncing[col].delete(item.id);
          }
        },
        (err) => {
          console.error(`[AHA] ❌ Listener ${col} falhou:`, err.message);
          // Resolve o firstSync para não bloquear waitForFirstSync indefinidamente
          if (!DB._initialDataReady[col]) {
            DB._initialDataReady[col] = true;
            if (_firstSyncResolvers[col]) _firstSyncResolvers[col]([]);
          }
          // Usa cache LOCAL (pode estar desatualizado, mas melhor que nada)
          cb(LOCAL.get(col));
          // Tenta reconectar após 3s em caso de falha temporária
          if (!_cancelled) {
            setTimeout(() => {
              if (!_cancelled && _db) {
                console.log(`[AHA] 🔄 Tentando reconectar listener: ${col}`);
                if (_unsubFirestore) { try { _unsubFirestore(); } catch(e) {} }
                _unsubFirestore = FS.onSnapshot(col, async (fsDocs) => {
                  const localItems = LOCAL.get(col);
                  const fsIds = new Set(fsDocs.map(d => d.id));
                  const offlineItems = localItems.filter(i => i.id && i.id.startsWith('loc_') && !fsIds.has(i.id));
                  const merged = _sortByDate([...fsDocs, ...offlineItems]);
                  LOCAL.set(col, merged);
                  if (!DB._initialDataReady[col]) {
                    DB._initialDataReady[col] = true;
                    if (_firstSyncResolvers[col]) _firstSyncResolvers[col](merged);
                  }
                  cb(merged);
                }, (retryErr) => {
                  console.error(`[AHA] ❌ Reconexão ${col} também falhou:`, retryErr.message);
                });
              }
            }, 3000);
          }
        }
      );

      _unsubFirestore = unsub;
      this._listeners[col] = unsub;
    }).catch(e => {
      console.error(`[AHA] ❌ _authReady falhou para ${col}:`, e.message);
      cb(LOCAL.get(col));
    });

    // Retorna função de cleanup que cancela o listener quando o app se desconectar
    return () => {
      _cancelled = true;
      if (_unsubFirestore) { _unsubFirestore(); _unsubFirestore = null; }
    };
  },

  // ── Aguarda primeiro sync de todas as coleções ────────────
  // Retorna depois de no máximo `timeoutMs` ms para não travar o app
  async waitForFirstSync(timeoutMs = 5000) {
    if (!_firebaseReady) return false;
    const cols = ['posts', 'accounts', 'campaigns'];
    try {
      await Promise.race([
        Promise.all(cols.map(c => _firstSyncPromises[c])),
        new Promise(r => setTimeout(r, timeoutMs))
      ]);
      return true;
    } catch(e) {
      return false;
    }
  }
};
