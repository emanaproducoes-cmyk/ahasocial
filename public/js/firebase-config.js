// ═══════════════════════════════════════════════════════════════
// firebase-config.js — AHA Social Planning v3
// Multi-usuário real via Firebase Firestore + Storage
// Instagram Graph API OAuth integrado
// ═══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────
// 🔧 CONFIGURAÇÃO — preencha com seus dados do Firebase Console
//    console.firebase.google.com → Seu Projeto → Project Settings
// ──────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "COLE_SUA_API_KEY_AQUI",
  authDomain:        "seu-projeto.firebaseapp.com",
  projectId:         "seu-projeto",
  storageBucket:     "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef123456"
};

// ──────────────────────────────────────────────────────────────
// 🔧 INSTAGRAM API — preencha com seus dados do Meta Developers
//    developers.facebook.com → Seu App → Instagram Basic Display
// ──────────────────────────────────────────────────────────────
const INSTAGRAM_CONFIG = {
  appId:       "SEU_INSTAGRAM_APP_ID",       // ID do App no Meta Developers
  redirectUri: window.location.origin + "/instagram-callback.html",
  scope:       "instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list,pages_read_engagement"
};

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO FIREBASE
// ═══════════════════════════════════════════════════════════════
let _db = null, _auth = null, _storage = null, _firebaseReady = false;

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('⚠️ Firebase SDK não carregado. Usando modo offline (localStorage).');
      return false;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _db      = firebase.firestore();
    _auth    = firebase.auth();
    _storage = firebase.storage();
    _firebaseReady = true;

    // Habilita persistência offline (dados disponíveis mesmo sem internet)
    _db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      if (err.code === 'failed-precondition') {
        console.warn('Persistência offline: múltiplas abas abertas.');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistência offline não suportada neste browser.');
      }
    });

    console.log('✅ Firebase conectado — dados sincronizados entre todos os usuários!');
    return true;
  } catch(e) {
    console.error('Firebase init error:', e.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// FIRESTORE — operações de banco de dados
// ═══════════════════════════════════════════════════════════════
const FS = {
  // Busca todos os docs de uma coleção (com filtros opcionais)
  async getAll(col, filters = [], orderBy = 'createdAt', limit = 100) {
    if (!_db) return null; // null = usar localStorage fallback
    try {
      let ref = _db.collection(col);
      filters.forEach(([f, op, v]) => { ref = ref.where(f, op, v); });
      try { ref = ref.orderBy(orderBy, 'desc'); } catch(e) {}
      const snap = await ref.limit(limit).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error('FS.getAll:', e); return null; }
  },

  // Busca um doc específico
  async get(col, id) {
    if (!_db) return null;
    try {
      const doc = await _db.collection(col).doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch(e) { console.error('FS.get:', e); return null; }
  },

  // Cria ou atualiza (merge)
  async set(col, id, data) {
    if (!_db) return null;
    try {
      const payload = {
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await _db.collection(col).doc(id).set(payload, { merge: true });
      return { id, ...payload };
    } catch(e) { console.error('FS.set:', e); return null; }
  },

  // Adiciona novo doc com ID automático
  async add(col, data) {
    if (!_db) return null;
    try {
      const payload = {
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      const ref = await _db.collection(col).add(payload);
      return { id: ref.id, ...payload };
    } catch(e) { console.error('FS.add:', e); return null; }
  },

  // Atualiza campos específicos
  async update(col, id, data) {
    if (!_db) return null;
    try {
      const payload = {
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await _db.collection(col).doc(id).update(payload);
      return { id, ...payload };
    } catch(e) { console.error('FS.update:', e); return null; }
  },

  // Deleta um doc
  async delete(col, id) {
    if (!_db) return false;
    try {
      await _db.collection(col).doc(id).delete();
      return true;
    } catch(e) { console.error('FS.delete:', e); return false; }
  },

  // Listener em tempo real — chama callback toda vez que os dados mudam
  // Retorna função para cancelar o listener (use em cleanup)
  onSnapshot(col, callback, filters = [], orderBy = 'createdAt') {
    if (!_db) return () => {};
    try {
      let ref = _db.collection(col);
      filters.forEach(([f, op, v]) => { ref = ref.where(f, op, v); });
      try { ref = ref.orderBy(orderBy, 'desc'); } catch(e) {}
      return ref.onSnapshot(snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(docs);
      }, err => console.error('onSnapshot error:', err));
    } catch(e) { console.error('FS.onSnapshot:', e); return () => {}; }
  }
};

// ═══════════════════════════════════════════════════════════════
// FIREBASE STORAGE — upload de arquivos reais
// ═══════════════════════════════════════════════════════════════
const STORAGE = {
  // Upload de arquivo → retorna URL pública permanente
  async upload(file, path, onProgress) {
    if (!_storage) return null;
    try {
      const ref    = _storage.ref(path);
      const task   = ref.put(file);

      return new Promise((resolve, reject) => {
        task.on('state_changed',
          snap => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            if (onProgress) onProgress(pct);
          },
          err => reject(err),
          async () => {
            const url = await task.snapshot.ref.getDownloadURL();
            resolve(url);
          }
        );
      });
    } catch(e) {
      console.error('Storage.upload:', e);
      return null;
    }
  },

  // Deleta um arquivo do storage
  async delete(url) {
    if (!_storage || !url) return;
    try {
      await _storage.refFromURL(url).delete();
    } catch(e) { console.warn('Storage.delete:', e); }
  }
};

// ═══════════════════════════════════════════════════════════════
// AUTH — Login Google + Email
// ═══════════════════════════════════════════════════════════════
const AUTH = {
  async loginGoogle() {
    if (!_auth) return null;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result   = await _auth.signInWithPopup(provider);
      return result.user;
    } catch(e) {
      console.error('Google login:', e);
      return null;
    }
  },

  async loginEmail(email, password) {
    if (!_auth) return null;
    try {
      const result = await _auth.signInWithEmailAndPassword(email, password);
      return result.user;
    } catch(e) {
      if (e.code === 'auth/user-not-found') {
        // Cria conta automaticamente no primeiro acesso
        const result2 = await _auth.createUserWithEmailAndPassword(email, password);
        return result2.user;
      }
      console.error('Email login:', e);
      return null;
    }
  },

  logout() {
    if (_auth) return _auth.signOut();
  },

  onAuthChange(callback) {
    if (!_auth) { callback(null); return () => {}; }
    return _auth.onAuthStateChanged(callback);
  }
};

// ═══════════════════════════════════════════════════════════════
// INSTAGRAM GRAPH API
// ═══════════════════════════════════════════════════════════════
const INSTAGRAM = {
  // Inicia o fluxo OAuth do Instagram
  startOAuth() {
    const params = new URLSearchParams({
      client_id:     INSTAGRAM_CONFIG.appId,
      redirect_uri:  INSTAGRAM_CONFIG.redirectUri,
      scope:         INSTAGRAM_CONFIG.scope,
      response_type: 'code',
      state:         'aha_ig_' + Date.now()
    });
    window.open(
      'https://api.instagram.com/oauth/authorize?' + params.toString(),
      'instagram_oauth',
      'width=600,height=700,scrollbars=yes'
    );
  },

  // Troca o código por token (chamado no callback — precisa de backend)
  // O backend faz a chamada para não expor o client_secret no frontend
  async exchangeCode(code) {
    try {
      const resp = await fetch('/api/instagram/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri: INSTAGRAM_CONFIG.redirectUri })
      });
      return await resp.json(); // { access_token, user_id }
    } catch(e) {
      console.error('Instagram token exchange:', e);
      return null;
    }
  },

  // Busca perfil do Instagram com o token
  async getProfile(accessToken) {
    try {
      const url = `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${accessToken}`;
      const resp = await fetch(url);
      return await resp.json();
    } catch(e) {
      console.error('Instagram profile:', e);
      return null;
    }
  },

  // Busca insights de uma conta Business (requer permissão instagram_manage_insights)
  async getInsights(igUserId, accessToken) {
    try {
      const url = `https://graph.instagram.com/${igUserId}/insights?metric=impressions,reach,follower_count,profile_views&period=day&access_token=${accessToken}`;
      const resp = await fetch(url);
      return await resp.json();
    } catch(e) {
      console.error('Instagram insights:', e);
      return null;
    }
  },

  // Publica um post no Instagram (requer conta Business + permissão)
  async publishPost(igUserId, accessToken, imageUrl, caption) {
    try {
      // Passo 1: cria o container de mídia
      const createResp = await fetch(`https://graph.instagram.com/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken })
      });
      const { id: containerId } = await createResp.json();

      // Passo 2: publica o container
      const publishResp = await fetch(`https://graph.instagram.com/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerId, access_token: accessToken })
      });
      return await publishResp.json();
    } catch(e) {
      console.error('Instagram publish:', e);
      return null;
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// LOCAL STORAGE FALLBACK — quando Firebase não está configurado
// Garante que o app funcione offline / sem Firebase
// ═══════════════════════════════════════════════════════════════
const LOCAL = {
  get(k)       { try { return JSON.parse(localStorage.getItem('aha_'+k)) || []; } catch { return []; } },
  set(k, d)    { try { localStorage.setItem('aha_'+k, JSON.stringify(d)); } catch(e) { console.warn('localStorage cheio:', e); } },
  add(k, item) {
    const arr = this.get(k);
    const n = { ...item, id: 'loc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), createdAt: new Date().toISOString() };
    arr.unshift(n); this.set(k, arr); return n;
  },
  update(k, id, d) {
    const arr = this.get(k);
    const i = arr.findIndex(x => x.id === id);
    if (i !== -1) { arr[i] = { ...arr[i], ...d, updatedAt: new Date().toISOString() }; this.set(k, arr); return arr[i]; }
    return null;
  },
  remove(k, id) { const arr = this.get(k).filter(x => x.id !== id); this.set(k, arr); },
  find(k, id)   { return this.get(k).find(x => x.id === id) || null; },
};

// ═══════════════════════════════════════════════════════════════
// DATA LAYER — abstração que usa Firebase OU localStorage
// O resto do app chama DB.* e não precisa saber qual backend está ativo
// ═══════════════════════════════════════════════════════════════
const DB = {
  async getAll(col) {
    if (_firebaseReady) {
      const docs = await FS.getAll(col);
      if (docs !== null) return docs;
    }
    return LOCAL.get(col);
  },

  async add(col, data) {
    if (_firebaseReady) {
      const doc = await FS.add(col, data);
      if (doc) return doc;
    }
    return LOCAL.add(col, data);
  },

  async update(col, id, data) {
    if (_firebaseReady) {
      const doc = await FS.update(col, id, data);
      if (doc) return doc;
    }
    return LOCAL.update(col, id, data);
  },

  async remove(col, id) {
    if (_firebaseReady) await FS.delete(col, id);
    LOCAL.remove(col, id);
  },

  async find(col, id) {
    if (_firebaseReady) {
      const doc = await FS.get(col, id);
      if (doc) return doc;
    }
    return LOCAL.find(col, id);
  },

  // Listener tempo real — retorna unsubscribe()
  listen(col, callback) {
    if (_firebaseReady) {
      return FS.onSnapshot(col, docs => {
        LOCAL.set(col, docs); // mantém cache local sempre atualizado
        callback(docs);
      });
    }
    // Sem Firebase: retorna dados locais uma vez e um unsubscribe vazio
    callback(LOCAL.get(col));
    return () => {};
  },

  // Sync local → Firebase (útil ao reconectar)
  async syncToFirebase(col) {
    if (!_firebaseReady) return;
    const localData = LOCAL.get(col);
    for (const item of localData) {
      const { id, ...data } = item;
      if (id.startsWith('loc_')) {
        // Item criado offline — adiciona ao Firebase
        await FS.add(col, data);
        LOCAL.remove(col, id);
      }
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// UPLOAD de arquivos — Firebase Storage OU base64 local
// ═══════════════════════════════════════════════════════════════
const UPLOAD = {
  async file(file, folder, onProgress) {
    // Com Firebase Storage: faz upload real e retorna URL pública
    if (_firebaseReady && _storage) {
      const ext  = file.name.split('.').pop();
      const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const url  = await STORAGE.upload(file, path, onProgress);
      if (url) return { url, type: file.type.startsWith('video') ? 'video' : 'image', isRemote: true };
    }

    // Sem Firebase: converte para base64 (funciona mas limitado a ~5MB)
    return new Promise((resolve, reject) => {
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error('Arquivo muito grande para modo offline (máx. 8MB). Configure o Firebase Storage para uploads maiores.'));
        return;
      }
      const reader = new FileReader();
      reader.onload  = e => resolve({ url: e.target.result, type: file.type.startsWith('video') ? 'video' : 'image', isRemote: false });
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      reader.readAsDataURL(file);
    });
  }
};
