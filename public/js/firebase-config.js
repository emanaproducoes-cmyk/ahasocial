// ── AHA Social Planning — firebase-config.js v6.0 (Multi-device sync) ──
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

let _db = null, _auth = null, _storage = null, _firebaseReady = false;

// ── Init Firebase ─────────────────────────────────────────────
function initFirebase() {
  try {
    if (typeof firebase === 'undefined') { console.warn('Firebase SDK não carregado.'); return false; }
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db      = firebase.firestore();
    _auth    = firebase.auth();
    _storage = firebase.storage();
    _firebaseReady = true;
    _db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    console.log('✅ Firebase conectado!');
    return true;
  } catch(e) { console.error('Firebase erro:', e.message); return false; }
}

// ── LOCAL cache (fallback / cache only) ──────────────────────
const LOCAL = {
  get(k)        { try{return JSON.parse(localStorage.getItem('aha_'+k))||[];}catch{return[];} },
  set(k,d)      { try{localStorage.setItem('aha_'+k,JSON.stringify(d));}catch(e){} },
  add(k,item)   { const a=this.get(k); const n={...item,id:'loc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),createdAt:new Date().toISOString()}; a.unshift(n); this.set(k,a); return n; },
  update(k,id,d){ const a=this.get(k); const i=a.findIndex(x=>x.id===id); if(i!==-1){a[i]={...a[i],...d,updatedAt:new Date().toISOString()};this.set(k,a);return a[i];}return null; },
  remove(k,id)  { const a=this.get(k).filter(x=>x.id!==id); this.set(k,a); },
  find(k,id)    { return this.get(k).find(x=>x.id===id)||null; },
};

// ── Firestore operations ──────────────────────────────────────
const FS = {
  col(name) {
    // Dados globais compartilhados entre todos os usuários do mesmo projeto
    return _db.collection(name);
  },
  async getAll(col) {
    if (!_db) return null;
    try {
      const snap = await this.col(col).orderBy('createdAt','desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      console.error(`FS.getAll(${col}):`, e.message);
      return null;
    }
  },
  async get(col, id) {
    if (!_db) return null;
    try { const d = await this.col(col).doc(id).get(); return d.exists ? { id: d.id, ...d.data() } : null; }
    catch(e) { console.error(`FS.get:`, e.message); return null; }
  },
  async add(col, data) {
    if (!_db) return null;
    // Remove campos undefined e id temporário
    const clean = {};
    Object.entries(data).forEach(([k,v]) => { if(v !== undefined && k !== 'id') clean[k] = v; });
    try {
      const ref = await this.col(col).add({
        ...clean,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { id: ref.id, ...clean };
    } catch(e) {
      console.error(`FS.add(${col}):`, e.message);
      // Verifica se é erro de permissão
      if (e.code === 'permission-denied') {
        DB._showPermissionError();
      }
      return null;
    }
  },
  async update(col, id, data) {
    if (!_db) return null;
    const clean = {};
    Object.entries(data).forEach(([k,v]) => { if(v !== undefined && k !== 'id') clean[k] = v; });
    try {
      await this.col(col).doc(id).update({
        ...clean,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { id, ...clean };
    } catch(e) {
      console.error(`FS.update(${col}, ${id}):`, e.message);
      return null;
    }
  },
  async delete(col, id) {
    if (!_db) return false;
    try { await this.col(col).doc(id).delete(); return true; }
    catch(e) { console.error(`FS.delete:`, e.message); return false; }
  },
  onSnapshot(col, callback, onError) {
    if (!_db) return () => {};
    try {
      return this.col(col)
        .orderBy('createdAt', 'desc')
        .onSnapshot(
          snap => {
            const docs = snap.docs.map(d => {
              const data = d.data();
              // Converte Firestore Timestamps para ISO strings
              const clean = { id: d.id };
              Object.entries(data).forEach(([k, v]) => {
                if (v && typeof v.toDate === 'function') {
                  clean[k] = v.toDate().toISOString();
                } else {
                  clean[k] = v;
                }
              });
              return clean;
            });
            callback(docs);
          },
          err => {
            console.error(`FS.onSnapshot(${col}):`, err.message);
            if (err.code === 'permission-denied') DB._showPermissionError();
            if (onError) onError(err);
          }
        );
    } catch(e) { console.error('onSnapshot setup:', e.message); return () => {}; }
  }
};

// ── AUTH ──────────────────────────────────────────────────────
const AUTH = {
  async signInAnonymous() {
    if (!_auth) return null;
    try { const r = await _auth.signInAnonymously(); return r.user; } catch(e) { return null; }
  },
  async loginGoogle() {
    if (!_auth) return null;
    try { const r = await _auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); return r.user; }
    catch(e) { console.error('Google login:', e.message); return null; }
  },
  async loginEmail(email, password) {
    if (!_auth) return null;
    try { return (await _auth.signInWithEmailAndPassword(email, password)).user; }
    catch(e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-email') {
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

// ── INSTAGRAM ────────────────────────────────────────────────
const INSTAGRAM = {
  startOAuth() {
    if (!INSTAGRAM_CONFIG.appId || INSTAGRAM_CONFIG.appId === 'SEU_INSTAGRAM_APP_ID') return false;
    const p = new URLSearchParams({ client_id: INSTAGRAM_CONFIG.appId, redirect_uri: INSTAGRAM_CONFIG.redirectUri, scope: INSTAGRAM_CONFIG.scope, response_type: 'code', state: 'aha_' + Date.now() });
    window.open('https://api.instagram.com/oauth/authorize?' + p.toString(), 'ig_oauth', 'width=600,height=700');
    return true;
  }
};

// ── UPLOAD ───────────────────────────────────────────────────
const UPLOAD = {
  async file(file, folder, onProgress) {
    if (_storage) {
      try {
        const path = `${folder}/${Date.now()}.${file.name.split('.').pop()}`;
        const task = _storage.ref(path).put(file);
        return new Promise((resolve, reject) => {
          task.on('state_changed',
            s => { if (onProgress) onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)); },
            reject,
            async () => resolve({ url: await task.snapshot.ref.getDownloadURL(), type: file.type.startsWith('video') ? 'video' : 'image', isRemote: true })
          );
        });
      } catch(e) { console.warn('Storage falhou, usando base64'); }
    }
    return new Promise((resolve, reject) => {
      if (file.size > 8 * 1024 * 1024) { reject(new Error('Máx. 8MB no modo offline.')); return; }
      const r = new FileReader();
      r.onload  = e => resolve({ url: e.target.result, type: file.type.startsWith('video') ? 'video' : 'image', isRemote: false });
      r.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      r.readAsDataURL(file);
    });
  }
};

// ── DB: camada unificada (Firestore primeiro, localStorage como cache) ─
const DB = {
  _permissionErrorShown: false,
  _listeners: {},   // col → unsubscribe function
  _cache: {},       // col → docs[]
  _pendingMigration: false,

  _showPermissionError() {
    if (this._permissionErrorShown) return;
    this._permissionErrorShown = true;
    console.error('🔴 FIRESTORE: Permissão negada. Configure as regras no Console Firebase.');
    // Tenta mostrar toast se disponível
    if (typeof toast === 'function') {
      toast('⚠️ Configure as Regras do Firestore no Console Firebase para sincronizar entre dispositivos.', 'error', 8000);
    }
  },

  // ── Verifica se Firestore está realmente acessível ────────
  async testAccess() {
    if (!_firebaseReady || !_db) return false;
    try {
      // Tenta ler a coleção de posts
      await FS.col('posts').limit(1).get();
      console.log('✅ Firestore: acesso OK');
      return true;
    } catch(e) {
      console.error('❌ Firestore: acesso negado —', e.message);
      if (e.code === 'permission-denied') this._showPermissionError();
      return false;
    }
  },

  // ── Migra dados do localStorage para o Firestore ─────────
  async migrateLocalToFirestore() {
    if (!_firebaseReady || this._pendingMigration) return;
    this._pendingMigration = true;

    const COLS = ['posts', 'accounts', 'campaigns'];
    let migrated = 0;

    for (const col of COLS) {
      const localItems = LOCAL.get(col);
      // Apenas migra itens com id_ temporário (criados offline)
      const offlineItems = localItems.filter(i => i.id && (i.id.startsWith('id_') || i.id.startsWith('loc_')));

      for (const item of offlineItems) {
        const { id: localId, ...data } = item;
        // Remove timestamps do servidor Firestore que não são serializáveis
        const clean = { ...data };
        delete clean.createdAt;
        delete clean.updatedAt;

        const result = await FS.add(col, clean);
        if (result) {
          LOCAL.remove(col, localId);
          const arr = LOCAL.get(col);
          if (!arr.find(i => i.id === result.id)) {
            arr.unshift(result);
            LOCAL.set(col, arr);
          }
          migrated++;
          console.log(`✅ Migrado: ${col}/${localId} → ${result.id}`);
        }
      }
    }

    if (migrated > 0) {
      console.log(`✅ ${migrated} item(s) migrado(s) para o Firestore.`);
      if (typeof toast === 'function') toast(`✅ ${migrated} item(s) sincronizado(s) com Firebase.`, 'success');
    }

    this._pendingMigration = false;
    return migrated;
  },

  // ── CRUD ─────────────────────────────────────────────────
  async add(col, data) {
    if (_firebaseReady) {
      const result = await FS.add(col, data);
      if (result) {
        // Garante que está no cache LOCAL com o ID real do Firebase
        const arr = LOCAL.get(col);
        if (!arr.find(i => i.id === result.id)) {
          arr.unshift(result);
          LOCAL.set(col, arr);
        }
        return result;
      }
    }
    // Fallback offline
    return LOCAL.add(col, data);
  },

  async update(col, id, d) {
    LOCAL.update(col, id, d); // atualiza cache imediatamente
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
    if (_firebaseReady) { const r = await FS.get(col, id); if (r) return r; }
    return LOCAL.find(col, id);
  },

  async getAll(col) {
    if (_firebaseReady) {
      const docs = await FS.getAll(col);
      if (docs !== null) {
        LOCAL.set(col, docs);
        this._cache[col] = docs;
        return docs;
      }
    }
    return LOCAL.get(col);
  },

  // ── Listener em tempo real ────────────────────────────────
  listen(col, cb) {
    if (_firebaseReady) {
      const unsub = FS.onSnapshot(
        col,
        docs => {
          // Atualiza cache LOCAL com dados do Firestore (fonte da verdade)
          LOCAL.set(col, docs);
          this._cache[col] = docs;
          cb(docs);
        },
        err => {
          // Se o snapshot falhar, cai para o localStorage
          console.warn(`Listener ${col} falhou, usando cache local:`, err.message);
          cb(LOCAL.get(col));
        }
      );
      return unsub;
    }

    // Modo completamente offline: usa localStorage
    cb(LOCAL.get(col));
    const t = setInterval(() => cb(LOCAL.get(col)), 3000);
    return () => clearInterval(t);
  },

  // ── Inicialização: testa acesso e migra dados ─────────────
  async init() {
    if (!_firebaseReady) {
      console.warn('Firebase não disponível — modo offline.');
      return false;
    }

    const hasAccess = await this.testAccess();
    if (!hasAccess) return false;

    // Migra dados offline para Firestore
    await this.migrateLocalToFirestore();
    return true;
  }
};
