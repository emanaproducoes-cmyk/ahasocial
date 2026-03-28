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
  get(k) { try{ return JSON.parse(localStorage.getItem('aha_'+k))||[]; }catch{return[];} },
  set(k,d) { try{ localStorage.setItem('aha_'+k, JSON.stringify(d)); }catch{} },
  add(k,item) {
    const items = this.get(k);
    const newItem = { ...item, id: item.id || Date.now().toString() };
    items.unshift(newItem);
    this.set(k, items);
    return newItem.id;
  },
  update(k,id,d) {
    let items = this.get(k);
    const idx = items.findIndex(i => i.id === id);
    if(idx !== -1) {
      items[idx] = { ...items[idx], ...d, id };
      this.set(k, items);
      return true;
    }
    return false;
  },
  remove(k,id) {
    const items = this.get(k).filter(i => i.id !== id);
    this.set(k, items);
  }
};

const FS = {
  async add(col, d) { try { const r = await _db.collection(col).add(d); return r.id; } catch { return null; } },
  async update(col,id,d) { try { await _db.collection(col).doc(id).update(d); return true; } catch { return false; } },
  async delete(col,id) { try { await _db.collection(col).doc(id).delete(); return true; } catch { return false; } }
};

const DB = {
  async add(col, data) {
    if (_firebaseReady && _auth.currentUser) {
      const id = await FS.add(col, data);
      if (id) return LOCAL.add(col, { ...data, id });
    }
    return LOCAL.add(col, data);
  },
  async update(col, id, d) {
    // CORREÇÃO: Garante que atualiza ambos para manter sincronia imediata
    if (_firebaseReady && _auth.currentUser) {
      await FS.update(col, id, d);
    }
    return LOCAL.update(col, id, d);
  },
  async remove(col, id) {
    if (_firebaseReady && _auth.currentUser) await FS.delete(col, id);
    LOCAL.remove(col, id);
  },
  listen(col, cb) {
    if (_firebaseReady) return _db.collection(col).onSnapshot(s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => {};
  }
};

const AUTH = {
  onAuthChange(cb) { _auth?.onAuthStateChanged(cb); },
  loginGoogle() { return _auth?.signInWithPopup(new firebase.auth.GoogleAuthProvider()); },
  logout() { return _auth?.signOut(); }
};
