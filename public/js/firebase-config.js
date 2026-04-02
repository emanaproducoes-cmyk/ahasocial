// ── AHA Social Planning — firebase-config.js v8.0 ──────────────
// ARQUITETURA DE PERSISTÊNCIA TOTAL NA NUVEM:
//
// Collections Firestore:
//   posts/          → posts globais (compartilhados entre usuários)
//   accounts/       → contas globais (compartilhadas)
//   campaigns/      → campanhas globais (compartilhadas)
//   userPrefs/{uid} → preferências PRIVADAS por usuário:
//                      - currentAccountId  (conta selecionada)
//                      - currentPage       (última página visitada)
//                      - postsView         (grade|lista|calendario)
//                      - agendView         (lista|grade|calendario)
//                      - kanbanCols        (colunas customizadas do kanban)
//                      - theme             (dark|light)
//
// REGRAS DE SINCRONIZAÇÃO:
//   Reads  → LOCAL (espelho do Firestore, atualizado via onSnapshot)
//   Writes → Firestore → onSnapshot atualiza LOCAL → re-render
//   Prefs  → Firestore/userPrefs (onSnapshot em tempo real)
//             Writes com DEBOUNCE de 400ms (evita spam no Firestore)
//
// CROSS-DEVICE:
//   Usuário autenticado (email/Google) → preferências sincronizadas em todos devices
//   Usuário anônimo → localStorage apenas (sem persistência cross-device)
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

// Promise que resolve após auth estar pronta
let _authReadyResolve;
const _authReady = new Promise(r => { _authReadyResolve = r; });

// Promises do primeiro sync por collection
let _firstSyncResolvers = {};
let _firstSyncPromises = {};
['posts','accounts','campaigns'].forEach(col => {
  _firstSyncPromises[col] = new Promise(resolve => { _firstSyncResolvers[col] = resolve; });
});

// ── PREFERÊNCIAS DO USUÁRIO — sincronizadas no Firestore ──────────
//
// PREFS: objeto local que espelha userPrefs/{uid} do Firestore.
// Nunca use localStorage diretamente para preferências — use PREFS.set().
// PREFS.set() faz debounce de 400ms antes de escrever no Firestore.
//
const PREFS = {
  _data: {},           // cache local das preferências
  _unsub: null,        // unsubscribe do listener de prefs
  _debounceTimer: null,
  _pendingWrites: {},  // acumula writes pendentes para o debounce
  _uid: null,          // uid do usuário atual

  // Inicializa o listener de preferências para o usuário
  init(uid) {
    if (!uid || !_db) return;
    this._uid = uid;

    // Cancela listener anterior se existir
    if (this._unsub) { this._unsub(); this._unsub = null; }

    console.log('[PREFS] 📡 Iniciando listener de preferências:', uid);

    this._unsub = _db.collection('userPrefs').doc(uid).onSnapshot(
      snap => {
        if (snap.exists) {
          const remote = snap.data();
          // Merge: remoto tem prioridade sobre cache local
          this._data = { ...this._data, ...remote };
          console.log('[PREFS] 🔄 Preferências sincronizadas:', Object.keys(remote).join(', '));
          // Notifica o app para aplicar as preferências recebidas
          if (typeof window._onPrefsLoaded === 'function') {
            window._onPrefsLoaded(this._data);
          }
        } else {
          // Documento não existe ainda — cria com defaults
          console.log('[PREFS] 📝 Criando documento de preferências inicial');
          this._saveNow({});
        }
      },
      err => {
        console.warn('[PREFS] ⚠️ Listener falhou:', err.message);
      }
    );
  },

  // Retorna valor de uma preferência (com fallback)
  get(key, fallback = null) {
    if (key in this._data) return this._data[key];
    // Fallback: tenta localStorage para usuários anônimos
    const lsKey = 'aha_' + key;
    try {
      const val = localStorage.getItem(lsKey);
      if (val !== null) return JSON.parse(val);
    } catch {}
    return fallback;
  },

  // Define uma preferência — debounce de 400ms antes de escrever no Firestore
  set(key, value) {
    this._data[key] = value;
    // Sempre persiste no localStorage como fallback (anônimos e offline)
    try { localStorage.setItem('aha_' + key, JSON.stringify(value)); } catch {}

    if (!_db || !this._uid) return; // anônimo: só localStorage

    // Acumula no buffer de writes pendentes
    this._pendingWrites[key] = value;

    // Debounce: cancela timer anterior e agenda novo
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._flushWrites();
    }, 400);
  },

  // Escreve IMEDIATAMENTE no Firestore (sem debounce) — use para eventos críticos
  setNow(key, value) {
    this._data[key] = value;
    try { localStorage.setItem('aha_' + key, JSON.stringify(value)); } catch {}
    if (!_db || !this._uid) return;
    this._pendingWrites[key] = value;
    this._flushWrites();
  },

  // Flush: escreve todos os writes pendentes de uma vez (merge: true)
  _flushWrites() {
    if (!_db || !this._uid || !Object.keys(this._pendingWrites).length) return;
    const writes = { ...this._pendingWrites, updatedAt: new Date().toISOString() };
    this._pendingWrites = {};
    _db.collection('userPrefs').doc(this._uid).set(writes, { merge: true })
      .then(() => console.log('[PREFS] ✅ Preferências salvas:', Object.keys(writes).filter(k=>k!=='updatedAt').join(', ')))
      .catch(e => console.warn('[PREFS] ❌ Erro ao salvar preferências:', e.message));
  },

  // Salva objeto completo imediatamente (sem debounce)
  _saveNow(data) {
    if (!_db || !this._uid) return;
    _db.collection('userPrefs').doc(this._uid).set(
      { ...data, createdAt: new Date().toISOString() },
      { merge: true }
    ).catch(e => console.warn('[PREFS] ❌ saveNow falhou:', e.message));
  },

  // Cancela listener e limpa estado (chamado no logout)
  destroy() {
    if (this._debounceTimer) { clearTimeout(this._debounceTimer); this._debounceTimer = null; }
    if (this._pendingWrites && Object.keys(this._pendingWrites).length) {
      this._flushWrites(); // flush final antes de destruir
    }
    if (this._unsub) { this._unsub(); this._unsub = null; }
    this._data = {};
    this._uid = null;
    this._pendingWrites = {};
    console.log('[PREFS] 🔴 Listener de preferências destruído');
  }
};

// ── Init Firebase ─────────────────────────────────────────────────
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

    // Persistência offline (múltiplas abas tolerado)
    _db.enablePersistence({ synchronizeTabs: true })
      .catch(e => { /* failed-precondition = múltiplas abas, normal */ });

    // ── AUTH STATE ────────────────────────────────────────────────
    _auth.onAuthStateChanged(async (user) => {
      if (user) {
        console.log('[AHA] ✅ Auth OK:', user.isAnonymous ? 'anônimo' : user.email);
        _firebaseReady = true;

        // Inicia listener de preferências apenas para usuários autenticados reais
        if (!user.isAnonymous) {
          PREFS.init(user.uid);
        }

        _authReadyResolve(true);
      } else {
        console.log('[AHA] 🔄 Sem sessão, fazendo login anônimo...');
        try {
          await _auth.signInAnonymously();
          // onAuthStateChanged disparará novamente com usuário anônimo
        } catch(e) {
          console.error('[AHA] ❌ Login anônimo falhou:', e.message);
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
  const data = docSnapshot.data();
  const clean = { id: docSnapshot.id };
  Object.entries(data || {}).forEach(([k, v]) => {
    clean[k] = (v && typeof v.toDate === 'function') ? v.toDate().toISOString() : v;
  });
  return clean;
}

function _sortByDate(docs) {
  return [...docs].sort((a, b) => {
    const ta = a.createdAt || '0';
    const tb = b.createdAt || '0';
    return tb.localeCompare(ta);
  });
}

// ── LOCAL: cache localStorage (espelho do Firestore) ─────────────
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
  const clean = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined) return;
    if (k === 'id') return;
    clean[k] = v;
  });
  return clean;
}

function _logFSError(op, col, e) {
  console.error(`[AHA] ❌ Firestore ${op}(${col}):`, e.code, e.message);
  if (e.code === 'permission-denied') {
    const msg = '🔴 Firebase: sem permissão de acesso. Configure as Regras do Firestore:\n\nrules_version = \'2\';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /userPrefs/{userId} {\n      allow read, write: if request.auth != null && request.auth.uid == userId;\n    }\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}';
    console.error(msg);
    if (typeof toast === 'function') {
      toast('🔴 Firestore: permissão negada. Verifique as Regras no Console Firebase.', 'error');
    }
  }
}

// ── AUTH ──────────────────────────────────────────────────────────
const AUTH = {
  async loginGoogle() {
    if (!_auth) return null;
    try {
      // Se havia sessão anônima, faz upgrade (preserva dados)
      const current = _auth.currentUser;
      const provider = new firebase.auth.GoogleAuthProvider();
      let result;
      if (current && current.isAnonymous) {
        try {
          result = await current.linkWithPopup(provider);
        } catch(linkErr) {
          // Se já existe conta Google, faz signin normal
          result = await _auth.signInWithPopup(provider);
        }
      } else {
        result = await _auth.signInWithPopup(provider);
      }
      return result.user;
    } catch(e) { console.error('[AHA] Google login:', e.message); return null; }
  },

  async loginEmail(email, password) {
    if (!_auth) return null;
    try {
      const current = _auth.currentUser;
      // Tenta login primeiro
      try {
        const result = await _auth.signInWithEmailAndPassword(email, password);
        return result.user;
      } catch(loginErr) {
        if (['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-email'].includes(loginErr.code)) {
          // Cria nova conta
          const result = await _auth.createUserWithEmailAndPassword(email, password);
          return result.user;
        }
        throw loginErr;
      }
    } catch(e) {
      console.error('[AHA] Email login:', e.message);
      return null;
    }
  },

  logout() {
    PREFS.destroy();
    if (_auth) return _auth.signOut();
  },

  onAuthChange(cb) {
    if (!_auth) { cb(null); return () => {}; }
    return _auth.onAuthStateChanged(cb);
  },

  // Retorna true se usuário atual é autenticado real (não anônimo)
  isAuthenticated() {
    return _auth && _auth.currentUser && !_auth.currentUser.isAnonymous;
  },

  // UID atual
  uid() {
    return _auth?.currentUser?.uid || null;
  }
};

// ── INSTAGRAM ─────────────────────────────────────────────────────
const INSTAGRAM = {
  startOAuth() {
    if (!INSTAGRAM_CONFIG.appId || INSTAGRAM_CONFIG.appId === 'SEU_INSTAGRAM_APP_ID') return false;
    const p = new URLSearchParams({
      client_id: INSTAGRAM_CONFIG.appId,
      redirect_uri: INSTAGRAM_CONFIG.redirectUri,
      scope: INSTAGRAM_CONFIG.scope,
      response_type: 'code',
      state: 'aha_'+Date.now()
    });
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
            async () => resolve({
              url: await task.snapshot.ref.getDownloadURL(),
              type: file.type.startsWith('video') ? 'video' : 'image',
              isRemote: true
            })
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
const DB = {
  _syncing: {},
  _listeners: {},
  _initialDataReady: {},

  async add(col, data) {
    if (_firebaseReady) {
      const result = await FS.add(col, data);
      if (result) {
        const arr = LOCAL.get(col);
        if (!arr.find(i => i.id === result.id)) {
          arr.unshift(result);
          LOCAL.set(col, arr);
        }
        return result;
      }
    }
    const item = LOCAL.add(col, data);
    console.warn(`[AHA] ⚠️ Offline: ${col} salvo localmente (${item.id})`);
    return item;
  },

  async update(col, id, d) {
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

  // ── listen: escuta em tempo real o Firestore ───────────────────
  // REGRA CRÍTICA: iniciado APENAS após _authReady resolver.
  listen(col, cb) {
    if (!this._syncing[col]) this._syncing[col] = new Set();

    cb(LOCAL.get(col));

    if (!_db && !_auth) {
      console.warn(`[AHA] ⚠️ Modo offline puro — ${col} usa localStorage`);
      const t = setInterval(() => cb(LOCAL.get(col)), 2000);
      return () => clearInterval(t);
    }

    let _unsubFirestore = null;
    let _cancelled = false;

    _authReady.then(authOk => {
      if (_cancelled) return;
      if (!_db) { cb(LOCAL.get(col)); return; }

      console.log(`[AHA] 🔓 Auth pronta (${authOk?'OK':'falhou'}), iniciando listener: ${col}`);

      const unsub = FS.onSnapshot(
        col,
        async (fsDocs) => {
          const localItems = LOCAL.get(col);
          const fsIds = new Set(fsDocs.map(d => d.id));
          const offlineItems = localItems.filter(i => i.id && i.id.startsWith('loc_') && !fsIds.has(i.id));
          const merged = _sortByDate([...fsDocs, ...offlineItems]);
          LOCAL.set(col, merged);

          if (!this._initialDataReady[col]) {
            this._initialDataReady[col] = true;
            if (_firstSyncResolvers[col]) _firstSyncResolvers[col](merged);
            console.log(`[AHA] ✅ Primeiro sync ${col}: ${fsDocs.length} docs`);
          }

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
              cb(LOCAL.get(col));
            }
            this._syncing[col].delete(item.id);
          }
        },
        (err) => {
          console.error(`[AHA] ❌ Listener ${col} falhou:`, err.message);
          cb(LOCAL.get(col));
        }
      );

      _unsubFirestore = unsub;
      this._listeners[col] = unsub;
    }).catch(e => {
      console.error(`[AHA] ❌ _authReady falhou para ${col}:`, e.message);
      cb(LOCAL.get(col));
    });

    return () => {
      _cancelled = true;
      if (_unsubFirestore) { _unsubFirestore(); _unsubFirestore = null; }
    };
  },

  // Aguarda primeiro sync de todas as coleções
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
