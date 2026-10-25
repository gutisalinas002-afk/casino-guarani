// Casino Guaraní — API + servidor del frontend compilado.
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cfg } from './config.js';
import * as D from './db.js';

const app = express();
app.disable('x-powered-by');
if (cfg.prod) app.set('trust proxy', 1); // detrás de Caddy: IP real del cliente

/* ---------- seguridad ---------- */
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
    ...(cfg.prod ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  });
  next();
});
app.use(express.json({ limit: '20kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

// Anti-CSRF: en producción toda escritura desde un navegador debe venir de nuestro propio origen.
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (cfg.prod && req.method !== 'GET' && origin && origin !== new URL(cfg.appUrl).origin)
    return res.status(403).json({ error: 'Origen no permitido.' });
  next();
});

const hits = new Map();
const limit = (name, max, ms) => (req, res, next) => {
  const key = `${name}:${req.ip}`, t = Date.now();
  const h = (hits.get(key) || []).filter((x) => t - x < ms);
  if (h.length >= max) return res.status(429).json({ error: 'Demasiados intentos. Esperá un momento.' });
  h.push(t); hits.set(key, h); next();
};
setInterval(() => { hits.clear(); D.purgeSessions(); }, 10 * 60 * 1000).unref();

/* ---------- helpers ---------- */
const COOKIE = 'cg_session';
const cookieToken = (req) => /(?:^|;\s*)cg_session=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
const setCookie = (res, token, maxAge = 30 * 86400) =>
  res.append('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${cfg.prod ? '; Secure' : ''}`);

const h = (fn) => (req, res) => {
  try { fn(req, res); } catch (e) {
    if (e instanceof D.AppError) return res.status(e.status).json({ error: e.message });
    console.error(e); res.status(500).json({ error: 'Error interno. Probá de nuevo.' });
  }
};
const auth = (req, res, next) => {
  const user = D.userFromToken(cookieToken(req));
  if (!user) return res.status(401).json({ error: 'Sesión vencida. Ingresá de nuevo.' });
  req.user = user; next();
};
const admin = (req, res, next) => (req.user.is_admin ? next() : res.status(403).json({ error: 'Solo administración.' }));

const streams = new Map(); // userId -> Set<res>
const emit = (userId, event, data) => {
  for (const res of streams.get(userId) ?? []) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};
const pushUser = (userId, tx) => {
  if (tx) emit(userId, 'transaction', tx);
  emit(userId, 'balance', { balance: D.getUser(userId).balance });
};

/* ---------- cuenta ---------- */
app.get('/api/config', (_req, res) => res.json({ demo: cfg.demoMode, licenseId: cfg.licenseId, minWithdrawal: cfg.minWithdrawal }));

const startSession = (res, user) => { setCookie(res, D.createSession(user.id)); res.json({ user: D.publicUser(user) }); };

app.post('/api/register', limit('reg', 5, 3600e3), h((req, res) => {
  const { name = '', email = '', password = '', document = '', birthdate = '' } = req.body;
  const born = new Date(birthdate);
  if (name.trim().length < 2) throw new D.AppError('Ingresá tu nombre completo.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new D.AppError('Email inválido.');
  if (password.length < 8) throw new D.AppError('La contraseña necesita 8 caracteres o más.');
  if (!/^\d{5,10}$/.test(document)) throw new D.AppError('Ingresá tu cédula sin puntos.');
  if (isNaN(born) || (Date.now() - born) / (365.25 * 864e5) < 18) throw new D.AppError('Tenés que ser mayor de 18 años.');
  startSession(res, D.createUser({ name: name.trim(), email: email.toLowerCase(), password, document, birthdate }));
}));

app.post('/api/login', limit('login', 10, 15 * 60e3), h((req, res) =>
  startSession(res, D.checkLogin(String(req.body.email || '').toLowerCase(), String(req.body.password || '')))));

app.post('/api/logout', h((req, res) => { D.deleteSession(cookieToken(req)); setCookie(res, '', 0); res.json({ ok: true }); }));
app.get('/api/me', auth, (req, res) => res.json({ user: D.publicUser(req.user) }));
app.get('/api/transactions', auth, (req, res) => res.json({ transactions: D.userTxs(req.user.id) }));

app.get('/api/events', auth, (req, res) => { // tiempo real (SSE); la sesión viaja en la cookie
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const id = req.user.id;
  if (!streams.has(id)) streams.set(id, new Set());
  streams.get(id).add(res);
  res.write(`event: balance\ndata: ${JSON.stringify({ balance: req.user.balance })}\n\n`);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); streams.get(id)?.delete(res); });
});

/* ---------- depósitos ---------- */
app.post('/api/deposits', auth, limit('dep', 20, 3600e3), h((req, res) => {
  const tx = D.createDepositIntent(req.user.id, Math.round(Number(req.body.amount)));
  res.json({ tx, bank: cfg.bank, reference: req.user.ref });
}));

app.post('/api/deposits/:id/claim', auth, h((req, res) => {
  const tx = D.markVerifying(req.user.id, req.params.id);
  emit(req.user.id, 'transaction', tx);
  if (cfg.demoMode) // solo DEMO: simula el aviso del banco
    setTimeout(() => settle(D.creditDeposit({ txId: tx.id, bankTxId: 'MOCK-' + crypto.randomUUID() })), 3000);
  res.json({ tx });
}));

function settle(result) {
  if (result.ok && result.userId) pushUser(result.userId, D.getTx(result.txId));
  return result;
}

// Webhook del banco/proveedor: firma HMAC-SHA256 del cuerpo en x-signature. Adaptar al proveedor real.
app.post('/api/webhooks/bank', limit('hook', 120, 60e3), h((req, res) => {
  const expected = crypto.createHmac('sha256', cfg.webhookSecret).update(req.rawBody ?? '').digest('hex');
  const got = String(req.headers['x-signature'] || '');
  if (got.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected)))
    return res.status(401).json({ error: 'Firma inválida' });
  const out = settle(D.creditDeposit({ reference: req.body.reference, amount: req.body.amount, bankTxId: req.body.bankTxId }));
  D.logWebhook(req.rawBody, out.ok ? 'ok' : out.error);
  res.status(out.ok ? 200 : 422).json(out);
}));

/* ---------- juego ---------- */
app.post('/api/slots/spin', auth, limit('spin', 120, 60e3), h((req, res) => res.json(D.spinSlots(req.user.id, Number(req.body.bet)))));

/* ---------- retiros ---------- */
app.get('/api/withdrawals/info', auth, (req, res) => res.json(D.withdrawalInfo(req.user.id)));
app.post('/api/withdrawals', auth, limit('wd', 10, 3600e3), h((req, res) => {
  const destino = String(req.body.destino || '').trim().slice(0, 120), titular = String(req.body.titular || '').trim().slice(0, 80);
  if (destino.length < 5 || titular.length < 3) throw new D.AppError('Completá la cuenta o alias y el titular.');
  const tx = D.requestWithdrawal(req.user.id, Math.round(Number(req.body.amount)), { destino, titular });
  pushUser(req.user.id, tx);
  res.json({ tx });
}));

/* ---------- juego responsable ---------- */
app.post('/api/safety/limit', auth, h((req, res) => res.json({ user: D.publicUser(D.setDepositLimit(req.user.id, Math.round(Number(req.body.limit)))) })));
app.post('/api/safety/exclude', auth, h((req, res) => res.json({ user: D.publicUser(D.excludeUser(req.user.id, Number(req.body.days))) })));

/* ---------- administración ---------- */
app.get('/api/admin/queue', auth, admin, (_req, res) => res.json(D.adminQueue()));
app.post('/api/admin/:id/:action', auth, admin, h((req, res) => {
  const { id, action } = req.params;
  if (action === 'aprobar') { // depósito verificado manualmente en el extracto del banco
    const out = D.creditDeposit({ txId: id, bankTxId: 'ADMIN-' + id });
    D.logAdminApproval(req.user.id, id);
    return res.json(settle(out));
  }
  const r = D.adminResolve(req.user.id, id, action);
  pushUser(r.userId, r.tx);
  res.json({ ok: true });
}));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'No encontrado' }));
app.use((err, _req, res, _next) => res.status(400).json({ error: 'Solicitud inválida' }));

/* ---------- frontend compilado ---------- */
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(cfg.port, () => console.log(`Casino Guaraní en :${cfg.port} · ${cfg.demoMode ? 'MODO DEMO (sin dinero real)' : 'DINERO REAL'}`));
