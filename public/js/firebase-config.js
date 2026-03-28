const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBI37N7zGJB6OL5ISLHjLeCvTOmh0avUBo",
  authDomain: "ahasocialplanning.firebaseapp.com",
  projectId: "ahasocialplanning",
  storageBucket: "ahasocialplanning.firebasestorage.app",
  messagingSenderId: "196747989859",
  appId: "1:196747989859:web:0766d3bec205219e66f956",
  measurementId: "G-6X9MM77R3V"
};

let _db = null, _auth = null, _storage = null, _firebaseReady = false;

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') return false;
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();
    _auth = firebase.auth();
    _storage = firebase.storage();
    _firebaseReady = true;
    _db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    return true;
  } catch (e) {
    console.error("Erro Firebase:", e);
    return false;
  }
}

const LOCAL = {
  get(col) { return JSON.parse(localStorage.getItem(`aha_${col}`) || '[]'); },
  set(col, data) { localStorage.setItem(`aha_${col}`, JSON.stringify(data)); },
  add(col, item) {
    const items = this.get(col);
    const newItem = { ...item, id: item.id || Date.now().toString() };
    items.unshift(newItem);
    this.set(col, items);
    return newItem.id;
  },
  update(col, id, data) {
    let items = this.get(col);
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      items[idx] = { ...items[idx], ...data, id };
      this.set(col, items);
      return true;
    }
    return false;
  },
  remove(col, id) {
    const items = this.get(col).filter(i => i.id !== id);
    this.set(col, items);
  }
};

const FS = {
  async add(col, d) { return (await _db.collection(col).add(d)).id; },
  async update(col, id, d) { await _db.collection(col).doc(id).update(d); return true; },
  async delete(col, id) { await _db.collection(col).doc(id).delete(); }
};

const DB = {
  async add(col, data) { 
    if (_firebaseReady && _auth.currentUser) {
      const id = await FS.add(col, data);
      return LOCAL.add(col, { ...data, id });
    }
    return LOCAL.add(col, data);
  },
  async update(col, id, data) {
    if (_firebaseReady && _auth.currentUser) {
      await FS.update(col, id, data);
    }
    return LOCAL.update(col, id, data);
  },
  async remove(col, id) {
    if (_firebaseReady && _auth.currentUser) await FS.delete(col, id);
    LOCAL.remove(col, id);
  }
};

const AUTH = {
  onAuthChange(cb) { _auth?.onAuthStateChanged(cb); },
  logout() { return _auth?.signOut(); }
};
