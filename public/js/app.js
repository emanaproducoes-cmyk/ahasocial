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

const LOCAL = {
  get(k)        { try{return JSON.parse(localStorage.getItem('aha_'+k))||[];}catch{return[];} },
  set(k,d)      { try{localStorage.setItem('aha_'+k,JSON.stringify(d));}catch(e){console.warn('Storage:',e);} },
  add(k,item)   { const a=this.get(k); const n={...item,id:'id_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),createdAt:new Date().toISOString()}; a.unshift(n); this.set(k,a); return n; },
  update(k,id,d){ const a=this.get(k); const i=a.findIndex(x=>x.id===id); if(i!==-1){a[i]={...a[i],...d,updatedAt:new Date().toISOString()};this.set(k,a);return a[i];}return null; },
  remove(k,id)  { const a=this.get(k).filter(x=>x.id!==id); this.set(k,a); },
  find(k,id)    { return this.get(k).find(x=>x.id===id)||null; },
};

const FS = {
  async getAll(col) {
    if (!_db) return null;
    try { const snap = await _db.collection(col).orderBy('createdAt','desc').get(); return snap.docs.map(d=>({id:d.id,...d.data()})); } catch { return null; }
  },
  async get(col, id) {
    if (!_db) return null;
    try { const d = await _db.collection(col).doc(id).get(); return d.exists ? { id: d.id, ...d.data() } : null; } catch { return null; }
  },
  async add(col, data) {
    if (!_db) return null;
    try { const r = await _db.collection(col).add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); return { id: r.id, ...data }; } catch { return null; }
  },
  async update(col, id, data) {
    if (!_db) return null;
    try { await _db.collection(col).doc(id).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); return { id, ...data }; } catch { return null; }
  },
  async delete(col, id) {
    if (!_db) return false;
    try { await _db.collection(col).doc(id).delete(); return true; } catch { return false; }
  },
  onSnapshot(col, callback) {
    if (!_db) return () => {};
    try {
      return _db.collection(col).orderBy('createdAt', 'desc').onSnapshot(
        snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        () => {}
      );
    } catch { return () => {}; }
  }
};

const AUTH = {
  async signInAnonymous() {
    if (!_auth) return null;
    try { const r = await _auth.signInAnonymously(); return r.user; } catch(e) { return null; }
  },
  async loginGoogle() {
    if (!_auth) return null;
    try { const r = await _auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); return r.user; } catch(e) { console.error('Google login:', e.message); return null; }
  },
  async loginEmail(email, password) {
    if (!_auth) return null;
    try { return (await _auth.signInWithEmailAndPassword(email, password)).user; }
    catch(e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
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

const INSTAGRAM = {
  startOAuth() {
    if (!INSTAGRAM_CONFIG.appId || INSTAGRAM_CONFIG.appId === 'SEU_INSTAGRAM_APP_ID') return false;
    const p = new URLSearchParams({ client_id: INSTAGRAM_CONFIG.appId, redirect_uri: INSTAGRAM_CONFIG.redirectUri, scope: INSTAGRAM_CONFIG.scope, response_type: 'code', state: 'aha_' + Date.now() });
    window.open('https://api.instagram.com/oauth/authorize?' + p.toString(), 'ig_oauth', 'width=600,height=700');
    return true;
  }
};

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

const DB = {
  async add(col, data)     { if (_firebaseReady) { const r = await FS.add(col, data);     if (r) return r; } return LOCAL.add(col, data); },
  async update(col, id, d) { if (_firebaseReady) { const r = await FS.update(col, id, d); if (r) { LOCAL.update(col, id, d); return r; } } return LOCAL.update(col, id, d); },
  async remove(col, id)    { if (_firebaseReady) await FS.delete(col, id); LOCAL.remove(col, id); },
  async find(col, id)      { if (_firebaseReady) { const r = await FS.get(col, id); if (r) { return r; } } return LOCAL.find(col, id); },
  async getAll(col)        { if (_firebaseReady) { const docs = await FS.getAll(col); if (docs) { LOCAL.set(col, docs); return docs; } } return LOCAL.get(col); },
  listen(col, cb) {
    if (_firebaseReady) {
      return FS.onSnapshot(col, snap => {
        const docs = snap.docs ? snap.docs.map(d=>({id:d.id,...d.data()})) : snap;
        // Preserve offline-only items (id_ prefix) not yet in Firebase
        const localOnly = LOCAL.get(col).filter(i => i.id && i.id.startsWith('id_'));
        // Deduplicate by id
        const seen = new Set(docs.map(d=>d.id));
        const extras = localOnly.filter(lo => !seen.has(lo.id));
        const merged = [...docs, ...extras];
        LOCAL.set(col, merged);
        cb(merged);
        // Auto-sync offline items to Firebase
        extras.forEach(async item => {
          const {id: localId, ...data} = item;
          try {
            const r = await FS.add(col, data);
            if (r) LOCAL.remove(col, localId);
          } catch(e) {}
        });
      });
    }
    // Offline mode
    cb(LOCAL.get(col));
    const t = setInterval(() => cb(LOCAL.get(col)), 3000);
    return () => clearInterval(t);
  }
};
