// ═══════════════════════════════════════════════════════════════
// firebase-config.js — AHA Social Planning
// ═══════════════════════════════════════════════════════════════

// ── SUBSTITUA com seus dados do Firebase Console ──────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",           // sua chave
  authDomain:        "aha-social.firebaseapp.com",
  projectId:         "aha-social",
  storageBucket:     "aha-social.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};

// ── Instagram API (preencha depois) ───────────────────────────
const INSTAGRAM_CONFIG = {
  appId:       "SEU_INSTAGRAM_APP_ID",
  redirectUri: window.location.origin + "/instagram-callback.html",
  scope:       "instagram_basic,instagram_content_publish,instagram_manage_insights"
};

// ═══════════════════════════════════════════════════════════════
// NÃO EDITE ABAIXO DESTA LINHA
// ═══════════════════════════════════════════════════════════════

let _db = null, _auth = null, _storage = null, _firebaseReady = false;

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK não carregado. Usando modo offline.');
      return false;
    }
    // Verifica se as credenciais foram preenchidas
    if (FIREBASE_CONFIG.apiKey.includes('COLE_SUA') || FIREBASE_CONFIG.apiKey === '') {
      console.warn('Firebase não configurado. Usando modo offline.');
      return false;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _db      = firebase.firestore();
    _auth    = firebase.auth();
    _storage = firebase.storage();
    _firebaseReady = true;

    _db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    console.log('✅ Firebase conectado!');
    return true;
  } catch(e) {
    console.error('Firebase erro:', e.message);
    return false;
  }
}

// ── Firestore helpers ─────────────────────────────────────────
const FS = {
  async get(col, id) {
    if (!_db) return null;
    try {
      const doc = await _db.collection(col).doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch(e) { return null; }
  },
  async add(col, data) {
    if (!_db) return null;
    try {
      const payload = { ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
      const ref = await _db.collection(col).add(payload);
      return { id: ref.id, ...payload };
    } catch(e) { return null; }
  },
  async update(col, id, data) {
    if (!_db) return null;
    try {
      await _db.collection(col).doc(id).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return { id, ...data };
    } catch(e) { return null; }
  },
  async delete(col, id) {
    if (!_db) return false;
    try { await _db.collection(col).doc(id).delete(); return true; } catch(e) { return false; }
  },
  onSnapshot(col, callback) {
    if (!_db) return () => {};
    try {
      return _db.collection(col)
        .orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
          callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, () => {});
    } catch(e) { return () => {}; }
  }
};

// ── Auth helpers ──────────────────────────────────────────────
const AUTH = {
  async loginGoogle() {
    if (!_auth) return null;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result   = await _auth.signInWithPopup(provider);
      return result.user;
    } catch(e) { console.error('Google login:', e.message); return null; }
  },
  async loginEmail(email, password) {
    if (!_auth) return null;
    try {
      const r = await _auth.signInWithEmailAndPassword(email, password);
      return r.user;
    } catch(e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        try {
          const r2 = await _auth.createUserWithEmailAndPassword(email, password);
          return r2.user;
        } catch(e2) { return null; }
      }
      return null;
    }
  },
  logout() { if (_auth) return _auth.signOut(); },
  onAuthChange(callback) {
    if (!_auth) { callback(null); return () => {}; }
    return _auth.onAuthStateChanged(callback);
  }
};

// ── Instagram OAuth ───────────────────────────────────────────
const INSTAGRAM = {
  startOAuth() {
    if (!INSTAGRAM_CONFIG.appId || INSTAGRAM_CONFIG.appId === 'SEU_INSTAGRAM_APP_ID') {
      return false;
    }
    const params = new URLSearchParams({
      client_id:     INSTAGRAM_CONFIG.appId,
      redirect_uri:  INSTAGRAM_CONFIG.redirectUri,
      scope:         INSTAGRAM_CONFIG.scope,
      response_type: 'code',
      state:         'aha_' + Date.now()
    });
    window.open('https://api.instagram.com/oauth/authorize?' + params.toString(), 'ig_oauth', 'width=600,height=700');
    return true;
  }
};

// ── Upload helper ─────────────────────────────────────────────
const UPLOAD = {
  async file(file, folder, onProgress) {
    if (_storage) {
      try {
        const ext  = file.name.split('.').pop();
        const path = `${folder}/${Date.now()}.${ext}`;
        const ref  = _storage.ref(path);
        const task = ref.put(file);
        return new Promise((resolve, reject) => {
          task.on('state_changed',
            snap => { if (onProgress) onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)); },
            reject,
            async () => {
              const url = await task.snapshot.ref.getDownloadURL();
              resolve({ url, type: file.type.startsWith('video') ? 'video' : 'image', isRemote: true });
            }
          );
        });
      } catch(e) { console.warn('Storage upload falhou, usando base64:', e); }
    }
    // Fallback base64
    return new Promise((resolve, reject) => {
      if (file.size > 8 * 1024 * 1024) { reject(new Error('Arquivo muito grande para modo offline (máx. 8MB).')); return; }
      const reader = new FileReader();
      reader.onload  = e => resolve({ url: e.target.result, type: file.type.startsWith('video') ? 'video' : 'image', isRemote: false });
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      reader.readAsDataURL(file);
    });
  }
};

// ── DB abstrato ───────────────────────────────────────────────
const DB = {
  async add(col, data)    { if (_firebaseReady) { const r = await FS.add(col, data);    if (r) return r; } return LOCAL.add(col, data); },
  async update(col, id, d){ if (_firebaseReady) { const r = await FS.update(col, id, d); if (r) { LOCAL.update(col, id, d); return r; } } return LOCAL.update(col, id, d); },
  async remove(col, id)   { if (_firebaseReady) await FS.delete(col, id); LOCAL.remove(col, id); },
  async find(col, id)     { if (_firebaseReady) { const r = await FS.get(col, id); if (r) return r; } return LOCAL.find(col, id); },
  listen(col, cb) {
    if (_firebaseReady) {
      return FS.onSnapshot(col, docs => { LOCAL.set(col, docs); cb(docs); });
    }
    cb(LOCAL.get(col));
    const t = setInterval(() => cb(LOCAL.get(col)), 3000);
    return () => clearInterval(t);
  }
};
