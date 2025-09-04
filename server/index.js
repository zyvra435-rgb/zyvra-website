// Zyvra server (Express) — Vercel-ready
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();

// ---- ENV
const PORT = process.env.PORT || 8080;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev_admin_token';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const JWT_DAYS = parseInt(process.env.JWT_DAYS || '365', 10);

// ---- FS helpers
const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TICKER_FILE = path.join(DATA_DIR, 'ticker.json');

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function ensureFile(f, fallback) {
  ensureDir(path.dirname(f));
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(fallback, null, 2));
}
function readJson(f, fb = {}) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8') || ''); } catch { return fb; }
}
function writeJson(f, obj) {
  ensureDir(path.dirname(f));
  fs.writeFileSync(f, JSON.stringify(obj, null, 2));
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function newid() { return `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`; }

// ---- init data files
ensureDir(DATA_DIR);
ensureFile(NEWS_FILE, { articles: [] });
ensureFile(USERS_FILE, { users: [] });
ensureFile(TICKER_FILE, { text: "", url: "/", active: false, speedSec: 16 });

// ---- middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
// local dev static. On Vercel, static served via vercel.json rewrite.
app.use(express.static(PUBLIC_DIR, { etag: true, maxAge: '1h' }));

// ---- auth utils
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const h = crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}$${h}`;
}
function verifyPassword(pw, packed) {
  const [salt, h] = String(packed || '').split('$');
  if (!salt || !h) return false;
  const calc = crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
  try { return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(h, 'hex')); }
  catch { return false; }
}
function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: `${JWT_DAYS}d` });
}
function requireAdmin(req, res, next) {
  const tok = req.headers['x-admin-token'] || req.query.admin_token;
  if (tok !== ADMIN_TOKEN) return res.status(401).json({ error: 'admin_forbidden' });
  next();
}
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer (.+)$/i);
  if (!m) return res.status(401).json({ error: 'no_token' });
  try { req.user = jwt.verify(m[1], JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'bad_token' }); }
}

// ================= NEWS =================
app.get('/api/news', (req, res) => {
  const db = readJson(NEWS_FILE, { articles: [] });
  const cat = (req.query.category || '').toLowerCase();
  let items = Array.isArray(db.articles) ? db.articles.slice() : [];
  if (cat && cat !== 'latest') items = items.filter(a => String(a.category || '').toLowerCase() === cat);
  items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  res.json({ items });
});

app.get('/api/news/:id', (req, res) => {
  const db = readJson(NEWS_FILE, { articles: [] });
  const a = db.articles.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'not_found' });
  res.json(a);
});

// create
app.post('/api/admin/news', requireAdmin, (req, res) => {
  const b = req.body || {};
  const db = readJson(NEWS_FILE, { articles: [] });
  const art = {
    id: b.id || newid(),
    title: String(b.title || '').trim(),
    description: String(b.description || '').trim(),
    url: String(b.url || '').trim(),
    imageUrl: String(b.imageUrl || '').trim(),
    source: String(b.source || 'Zyvra').trim(),
    category: String(b.category || 'world').trim().toLowerCase(),
    publishedAt: b.publishedAt || new Date().toISOString(),
    content: String(b.content || '').trim()
  };
  if (!art.title) return res.status(400).json({ error: 'title_required' });
  db.articles.push(art);
  writeJson(NEWS_FILE, db);
  res.json({ ok: true, item: art });
});

// update
app.put('/api/admin/news/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const b = req.body || {};
  const db = readJson(NEWS_FILE, { articles: [] });
  const i = db.articles.findIndex(x => x.id === id);
  if (i < 0) return res.status(404).json({ error: 'not_found' });
  db.articles[i] = { ...db.articles[i], ...b, id };
  writeJson(NEWS_FILE, db);
  res.json({ ok: true, item: db.articles[i] });
});

// delete
app.delete('/api/admin/news/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const db = readJson(NEWS_FILE, { articles: [] });
  const n = db.articles.length;
  db.articles = db.articles.filter(x => x.id !== id);
  writeJson(NEWS_FILE, db);
  res.json({ ok: true, deleted: n - db.articles.length });
});

// ================= SEARCH =================
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const db = readJson(NEWS_FILE, { articles: [] });
  if (!q) return res.json({ items: [] });
  const hit = (s) => String(s || '').toLowerCase().includes(q);
  const items = db.articles.filter(a =>
    hit(a.title) || hit(a.description) || hit(a.content) || hit(a.source) || hit(a.category)
  ).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  res.json({ items });
});

// ================= TICKER =================
app.get('/api/ticker', (req, res) => {
  const t = readJson(TICKER_FILE, { text: "", url: "/", active: false, speedSec: 16 });
  res.json(t);
});
app.post('/api/admin/ticker', requireAdmin, (req, res) => {
  const b = req.body || {};
  const t = {
    text: String(b.text || '').trim(),
    url: String(b.url || '/'),
    active: !!b.active,
    speedSec: Math.max(6, parseInt(b.speedSec || 16, 10))
  };
  writeJson(TICKER_FILE, t);
  res.json({ ok: true, ticker: t });
});

// ================= AUTH (file-based) =================
app.post('/api/auth/signup', (req, res) => {
  const { name = '', email = '', password = '' } = req.body || {};
  const nm = String(name).trim();
  const em = String(email).trim().toLowerCase();
  const pw = String(password);
  if (!nm || !em || pw.length < 6) return res.status(400).json({ error: 'bad_input' });

  const db = readJson(USERS_FILE, { users: [] });
  if (db.users.find(u => u.email === em)) return res.status(409).json({ error: 'email_exists' });

  const user = { id: newid(), name: nm, email: em, pass: hashPassword(pw), createdAt: new Date().toISOString() };
  db.users.push(user);
  writeJson(USERS_FILE, db);

  const token = signToken(user);
  res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/login', (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const em = String(email).trim().toLowerCase();
  const pw = String(password);
  const db = readJson(USERS_FILE, { users: [] });
  const user = db.users.find(u => u.email === em);
  if (!user || !verifyPassword(pw, user.pass)) return res.status(401).json({ error: 'bad_credentials' });
  const token = signToken(user);
  res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ================= CRICKET (static empty feed as requested) =================
app.get('/api/cricket/raw', (req, res) => {
  res.json({ ok: true, mode: 'static-empty' });
});
app.get('/api/cricket/diag', (req, res) => {
  res.json({ ok: true, mode: 'static-empty', counts: { currentTotal: 0, scheduleTotal: 0 } });
});
app.get('/api/cricket/feed', (req, res) => {
  const now = new Date();
  const pk = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  res.json({ live: [], results: [], upcoming: [], meta: { tz: 'Asia/Karachi', day: pk, cachedAt: now.toISOString() } });
});

// ================= HEALTH =================
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ================= SSR ARTICLE =================
app.get('/a/:id', (req, res) => {
  const db = readJson(NEWS_FILE, { articles: [] });
  const a = db.articles.find(x => x.id === req.params.id);
  if (!a) return res.status(404).send('Not found');

  const url = `${SITE_URL}/a/${encodeURIComponent(a.id)}`;
  const desc = a.description || (a.content || '').slice(0, 150);
  const img = a.imageUrl ? (a.imageUrl.startsWith('http') ? a.imageUrl : `${SITE_URL}${a.imageUrl}`) : `${SITE_URL}/logo.png`;
  const when = a.publishedAt || new Date().toISOString();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(a.title)} | Zyvra</title>
<meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(a.title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${esc(url)}"><link rel="stylesheet" href="/style.css"></head>
<body>
<header class="glass" style="padding:12px 20px"><a href="/" style="color:#0ff;text-decoration:none;font-weight:bold">← Zyvra Home</a></header>
<main class="article" style="max-width:860px;margin:32px auto;padding:0 16px">
<h1 style="color:#0ff">${esc(a.title)}</h1>
<div style="color:#8aa;font-size:.9rem;margin-bottom:12px">${esc(a.source || 'Zyvra')} · ${new Date(when).toLocaleString()}</div>
${a.imageUrl ? `<img src="${esc(a.imageUrl)}" alt="" style="width:100%;border-radius:12px;margin:12px 0" loading="eager">` : ''}
<article style="color:#ddd;line-height:1.7;white-space:pre-wrap">${esc(a.content || '')}</article>
${a.url ? `<p style="margin-top:16px"><a href="${esc(a.url)}" target="_blank" class="neon-btn" style="text-decoration:none">Original source</a></p>` : ''}
</main></body></html>`);
});

// ------------ start / export ------------
if (process.env.VERCEL) {
  module.exports = app; // serverless export for Vercel
} else {
  app.listen(PORT, () => console.log(`Zyvra server: ${SITE_URL}`));
}
