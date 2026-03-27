// ═══════════════════════════════════════════════════════════════
// firebase-config.js — AHA Social Planning
// INSTRUÇÕES: Substitua os valores abaixo com as credenciais
// do seu projeto Firebase (console.firebase.google.com)
// ═══════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            "SUA_API_KEY_AQUI",
  authDomain:        "seu-projeto.firebaseapp.com",
  projectId:         "seu-projeto",
  storageBucket:     "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef"
};

// ─── Inicializa Firebase ─────────────────────────────────────
let db, auth, storage;

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK não carregado. Usando modo offline.');
      return false;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    db      = firebase.firestore();
    auth    = firebase.auth();
    storage = firebase.storage();
    console.log('✅ Firebase conectado');
    return true;
  } catch(e) {
    console.warn('Firebase init error:', e.message);
    return false;
  }
}

// ─── Auth: Login com Google ──────────────────────────────────
async function loginWithGoogle() {
  if (!auth) return null;
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    return result.user;
  } catch(e) {
    console.error('Google login error:', e);
    return null;
  }
}

// ─── Firestore helpers ───────────────────────────────────────
const FS = {
  async get(collection, id) {
    if (!db) return null;
    const doc = await db.collection(collection).doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async getAll(collection, filters = []) {
    if (!db) return [];
    let ref = db.collection(collection);
    filters.forEach(([field, op, val]) => { ref = ref.where(field, op, val); });
    const snap = await ref.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async set(collection, id, data) {
    if (!db) return null;
    const payload = { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    await db.collection(collection).doc(id).set(payload, { merge: true });
    return payload;
  },

  async add(collection, data) {
    if (!db) return null;
    const payload = { ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    const ref = await db.collection(collection).add(payload);
    return { id: ref.id, ...payload };
  },

  async delete(collection, id) {
    if (!db) return;
    await db.collection(collection).doc(id).delete();
  },

  onSnapshot(collection, callback, filters = []) {
    if (!db) return () => {};
    let ref = db.collection(collection);
    filters.forEach(([field, op, val]) => { ref = ref.where(field, op, val); });
    return ref.onSnapshot(snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(docs);
    });
  }
};

// ─── Local Storage fallback (quando Firebase não disponível) ─
const LOCAL = {
  get(key) {
    try { return JSON.parse(localStorage.getItem('aha_' + key)) || []; }
    catch { return []; }
  },
  set(key, data) {
    try { localStorage.setItem('aha_' + key, JSON.stringify(data)); }
    catch {}
  },
  add(key, item) {
    const arr = this.get(key);
    const newItem = { ...item, id: 'local_' + Date.now(), createdAt: new Date().toISOString() };
    arr.unshift(newItem);
    this.set(key, arr);
    return newItem;
  },
  update(key, id, data) {
    const arr = this.get(key);
    const idx = arr.findIndex(x => x.id === id);
    if (idx !== -1) { arr[idx] = { ...arr[idx], ...data }; this.set(key, arr); }
  },
  remove(key, id) {
    const arr = this.get(key).filter(x => x.id !== id);
    this.set(key, arr);
  }
};
