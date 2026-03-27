// ═══════════════════════════════════════════════════════════════
// server.js — AHA Social Planning Backend
// Node.js + Express + Firebase Admin SDK
// ═══════════════════════════════════════════════════════════════
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 100, message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' } }));

// ─── Firebase Admin ────────────────────────────────────────────
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:    process.env.FIREBASE_PROJECT_ID,
      clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();

// ─── Auth Middleware ───────────────────────────────────────────
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// ─── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0', time: new Date() }));

// ─── POSTS ─────────────────────────────────────────────────────
app.get('/api/posts', authMiddleware, async (req, res) => {
  try {
    const { status, platform, campaign } = req.query;
    let ref = db.collection('posts');
    if (status)   ref = ref.where('status',   '==', status);
    if (platform) ref = ref.where('platform', '==', platform);
    if (campaign) ref = ref.where('campaign', '==', campaign);
    const snap = await ref.orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts', authMiddleware, async (req, res) => {
  try {
    const { v4: uuidv4 } = require('uuid');
    const post = {
      ...req.body,
      id:        uuidv4(),
      status:    req.body.status || 'pending',
      createdBy: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection('posts').add(post);
    res.status(201).json({ id: ref.id, ...post });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/posts/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('posts').doc(id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.uid,
    });
    res.json({ id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/posts/:id', authMiddleware, async (req, res) => {
  try {
    await db.collection('posts').doc(id).delete();
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── CONTAS ────────────────────────────────────────────────────
app.get('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const snap = await db.collection('accounts').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const account = { ...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: req.user.uid };
    const ref = await db.collection('accounts').add(account);
    res.status(201).json({ id: ref.id, ...account });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/accounts/:id', authMiddleware, async (req, res) => {
  try {
    await db.collection('accounts').doc(req.params.id).delete();
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── CAMPANHAS ─────────────────────────────────────────────────
app.get('/api/campaigns', authMiddleware, async (req, res) => {
  try {
    const snap = await db.collection('campaigns').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/campaigns', authMiddleware, async (req, res) => {
  try {
    const campaign = { ...req.body, status: 'active', posts:0, approved:0, pending:0, rejected:0, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: req.user.uid };
    const ref = await db.collection('campaigns').add(campaign);
    res.status(201).json({ id: ref.id, ...campaign });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/campaigns/:id', authMiddleware, async (req, res) => {
  try {
    await db.collection('campaigns').doc(req.params.id).update({ ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ id: req.params.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── APROVAÇÃO (pública — sem auth) ───────────────────────────
app.get('/api/approval/:id', async (req, res) => {
  try {
    const doc = await db.collection('posts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Post não encontrado.' });
    const post = { id: doc.id, ...doc.data() };
    // Retorna apenas campos seguros para o público
    res.json({ id: post.id, title: post.title, platform: post.platform, date: post.date, caption: post.caption, status: post.status, campaign: post.campaign, thumb: post.thumb });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/approval/:id', async (req, res) => {
  try {
    const { action, comment, clientName } = req.body;
    const statusMap = { approve: 'approved', reject: 'rejected', correct: 'pending' };
    const newStatus = statusMap[action];
    if (!newStatus) return res.status(400).json({ error: 'Ação inválida.' });
    await db.collection('posts').doc(req.params.id).update({
      status:       newStatus,
      clientReview: { action, comment, clientName, reviewedAt: admin.firestore.FieldValue.serverTimestamp() }
    });
    res.json({ success: true, newStatus });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TRÁFEGO PAGO ─────────────────────────────────────────────
app.get('/api/traffic', authMiddleware, async (req, res) => {
  try {
    const snap = await db.collection('traffic').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/traffic', authMiddleware, async (req, res) => {
  try {
    const entry = { ...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: req.user.uid };
    const ref = await db.collection('traffic').add(entry);
    res.status(201).json({ id: ref.id, ...entry });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// ─── Error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ─── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 AHA Social Planning API rodando em http://localhost:${PORT}`));
module.exports = app;
