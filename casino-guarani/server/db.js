// Capa de datos: SQLite (node:sqlite). Todo movimiento de dinero ocurre dentro de una transacción.
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cfg } from './config.js';
import { BETS, playSlots } from './slots.js';

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

fs.mkdirSync(path.dirname(cfg.dbPath), { recursive: true });
export const db = new DatabaseSync(cfg.dbPath);
db.exec(`
PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, pass TEXT NOT NULL,
  document TEXT NOT NULL UNIQUE, birthdate TEXT NOT NULL, ref TEXT NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  deposited INTEGER NOT NULL DEFAULT 0, wagered INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0, deposit_limit INTEGER, excluded_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS txs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL, amount INTEGER NOT NULL,
  status TEXT NOT NULL, bank_tx_id TEXT UNIQUE, meta TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS txs_user ON txs(user_id, created_at);
CREATE TABLE IF NOT EXISTS webhook_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, payload TEXT, result TEXT);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, admin_id TEXT, action TEXT, tx_id TEXT);
`);
for (const e of cfg.adminEmails) db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run(e);

const q = (sql) => db.prepare(sql);
const now = () => Date.now();
const uid = () => crypto.randomUUID();
const DAY = 864e5;

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

/* ---------- usuarios y sesiones ---------- */
const scrypt = (p, salt) => crypto.scryptSync(p, salt, 32).toString('hex');
export const getUser = (id) => q('SELECT * FROM users WHERE id = ?').get(id);
export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, balance: u.balance, ref: u.ref, isAdmin: !!u.is_admin,
  depositLimit: u.deposit_limit ?? cfg.maxDailyDeposit, excludedUntil: u.excluded_until,
});

export function createUser({ name, email, password, document, birthdate }) {
  const salt = crypto.randomBytes(16).toString('hex');
  const id = uid();
  try {
    q(`INSERT INTO users (id,name,email,pass,document,birthdate,ref,is_admin,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      id, name, email, `${salt}:${scrypt(password, salt)}`, document, birthdate,
      'CG-' + crypto.randomBytes(3).toString('hex').toUpperCase(), cfg.adminEmails.includes(email) ? 1 : 0, now());
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new AppError('Ya existe una cuenta con ese email o cédula.', 409);
    throw e;
  }
  return getUser(id);
}
export function checkLogin(email, password) {
  const u = q('SELECT * FROM users WHERE email = ?').get(email);
  const [salt, h] = (u?.pass || ':').split(':');
  const ok = u && crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(scrypt(password, salt), 'hex'));
  if (!ok) throw new AppError('Email o contraseña incorrectos.', 401);
  return u;
}
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  q('INSERT INTO sessions VALUES (?,?,?)').run(sha(token), userId, now() + 30 * DAY);
  return token;
}
export const userFromToken = (token) => token
  ? q('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ? AND s.expires_at > ?').get(sha(token), now())
  : null;
export const deleteSession = (token) => q('DELETE FROM sessions WHERE hash = ?').run(sha(token));
export const purgeSessions = () => q('DELETE FROM sessions WHERE expires_at < ?').run(now());

/* ---------- movimientos ---------- */
const toTx = (r) => r && ({ id: r.id, userId: r.user_id, type: r.type, amount: r.amount, status: r.status, createdAt: r.created_at, meta: r.meta ? JSON.parse(r.meta) : undefined });
export const getTx = (id) => toTx(q('SELECT * FROM txs WHERE id = ?').get(id));
export const userTxs = (userId) => q('SELECT * FROM txs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(userId).map(toTx);
const insertTx = (userId, type, amount, status, meta, bankTxId = null) => {
  const id = uid(), t = now();
  q('INSERT INTO txs (id,user_id,type,amount,status,bank_tx_id,meta,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, userId, type, amount, status, bankTxId, meta ? JSON.stringify(meta) : null, t, t);
  return id;
};
const isExcluded = (u) => u.excluded_until > now();

/* ---------- depósitos ---------- */
export function createDepositIntent(userId, amount) {
  return transaction(() => {
    const u = getUser(userId);
    if (isExcluded(u)) throw new AppError('Tu cuenta está en pausa por autoexclusión.', 403);
    if (!(amount >= cfg.minDeposit && amount <= cfg.maxDeposit))
      throw new AppError(`El monto debe estar entre ${cfg.minDeposit.toLocaleString('es-PY')} y ${cfg.maxDeposit.toLocaleString('es-PY')} Gs.`);
    const open = q(`SELECT COUNT(*) n FROM txs WHERE user_id=? AND type='deposito' AND status='pendiente'`).get(userId).n;
    if (open >= 5) throw new AppError('Tenés demasiados depósitos pendientes. Completá o esperá a que venzan.');
    const limit = u.deposit_limit ?? cfg.maxDailyDeposit;
    const used = q(`SELECT COALESCE(SUM(amount),0) s FROM txs WHERE user_id=? AND type='deposito' AND status IN ('pendiente','verificando','completado') AND created_at>?`).get(userId, now() - DAY).s;
    if (used + amount > limit) throw new AppError(`Superás tu límite diario de depósito (${limit.toLocaleString('es-PY')} Gs.).`);
    return getTx(insertTx(userId, 'deposito', amount, 'pendiente'));
  });
}
export function markVerifying(userId, txId) {
  q(`UPDATE txs SET status='verificando', updated_at=? WHERE id=? AND user_id=? AND type='deposito' AND status='pendiente'`).run(now(), txId, userId);
  const t = getTx(txId);
  if (!t || t.userId !== userId) throw new AppError('Depósito no encontrado.', 404);
  return t;
}

// Acredita un pago confirmado (webhook del banco o aprobación manual). Idempotente por bankTxId.
export function creditDeposit({ reference, amount, bankTxId, txId = null }) {
  return transaction(() => {
    if (!bankTxId) return { ok: false, error: 'Falta bankTxId' };
    if (q('SELECT 1 FROM txs WHERE bank_tx_id = ?').get(bankTxId)) return { ok: true, duplicate: true };
    let user, row;
    if (txId) {
      row = q(`SELECT * FROM txs WHERE id=? AND type='deposito' AND status IN ('pendiente','verificando')`).get(txId);
      if (!row) throw new AppError('Ese depósito ya no está pendiente.', 404);
      user = getUser(row.user_id); amount = row.amount;
    } else {
      amount = Math.round(Number(amount));
      user = q('SELECT * FROM users WHERE ref = ?').get(String(reference));
      if (!user || !(amount > 0)) return { ok: false, error: 'Referencia o monto inválido' };
      row = q(`SELECT * FROM txs WHERE user_id=? AND type='deposito' AND status IN ('pendiente','verificando') AND amount=? ORDER BY created_at LIMIT 1`).get(user.id, amount);
    }
    let id;
    if (row) { id = row.id; q(`UPDATE txs SET status='completado', bank_tx_id=?, updated_at=? WHERE id=?`).run(bankTxId, now(), id); }
    else id = insertTx(user.id, 'deposito', amount, 'completado', null, bankTxId);
    q('UPDATE users SET balance = balance + ?, deposited = deposited + ? WHERE id = ?').run(amount, amount, user.id);
    return { ok: true, userId: user.id, txId: id };
  });
}

/* ---------- juego ---------- */
export function spinSlots(userId, bet) {
  return transaction(() => {
    const u = getUser(userId);
    if (isExcluded(u)) throw new AppError('Tu cuenta está en pausa por autoexclusión.', 403);
    if (!BETS.includes(bet)) throw new AppError('Apuesta no válida.');
    if (u.balance < bet) throw new AppError('Saldo insuficiente.', 402);
    const r = playSlots(bet), net = r.win - bet;
    q('UPDATE users SET balance = balance + ?, wagered = wagered + ? WHERE id = ?').run(net, bet, u.id);
    const id = insertTx(u.id, 'juego', net, 'completado', { game: 'slots', bet, win: r.win, mult: r.mult, reels: r.reels });
    return { ...r, balance: u.balance + net, tx: getTx(id) };
  });
}

/* ---------- retiros ---------- */
export function withdrawalInfo(userId) {
  const u = getUser(userId);
  return { balance: u.balance, min: cfg.minWithdrawal, wagerLeft: Math.max(0, Math.ceil(u.deposited * cfg.wagerMultiplier - u.wagered)) };
}
export function requestWithdrawal(userId, amount, { destino, titular }) {
  return transaction(() => {
    const u = getUser(userId), info = withdrawalInfo(userId);
    if (!(amount >= cfg.minWithdrawal)) throw new AppError(`El retiro mínimo es ${cfg.minWithdrawal.toLocaleString('es-PY')} Gs.`);
    if (amount > u.balance) throw new AppError('Saldo insuficiente.', 402);
    if (info.wagerLeft > 0) throw new AppError(`Para retirar tenés que jugar ${info.wagerLeft.toLocaleString('es-PY')} Gs. más en apuestas.`);
    if (q(`SELECT COUNT(*) n FROM txs WHERE user_id=? AND type='retiro' AND status='pendiente'`).get(userId).n >= 3)
      throw new AppError('Ya tenés retiros en revisión. Esperá a que se procesen.');
    q('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, userId); // fondos retenidos
    return getTx(insertTx(userId, 'retiro', -amount, 'pendiente', { destino, titular }));
  });
}

/* ---------- juego responsable ---------- */
export function setDepositLimit(userId, limit) {
  if (!(limit >= cfg.minDeposit && limit <= cfg.maxDailyDeposit)) throw new AppError(`El límite debe estar entre ${cfg.minDeposit.toLocaleString('es-PY')} y ${cfg.maxDailyDeposit.toLocaleString('es-PY')} Gs.`);
  q('UPDATE users SET deposit_limit = ? WHERE id = ?').run(limit, userId);
  return getUser(userId);
}
export function excludeUser(userId, days) {
  if (![7, 30, 90].includes(days)) throw new AppError('Período no válido.');
  q('UPDATE users SET excluded_until = ? WHERE id = ?').run(now() + days * DAY, userId);
  return getUser(userId);
}

/* ---------- administración ---------- */
export const adminQueue = () => ({
  items: q(`SELECT t.*, u.name, u.email, u.ref, u.document FROM txs t JOIN users u ON u.id = t.user_id
            WHERE (t.type='deposito' AND t.status='verificando') OR (t.type='retiro' AND t.status='pendiente') ORDER BY t.created_at`)
    .all().map((r) => ({ ...toTx(r), user: { name: r.name, email: r.email, ref: r.ref, document: r.document } })),
  unmatched: q(`SELECT id, at, payload, result FROM webhook_log WHERE result != 'ok' ORDER BY id DESC LIMIT 20`).all(),
});
const audit = (adminId, action, txId) => q('INSERT INTO audit (at,admin_id,action,tx_id) VALUES (?,?,?,?)').run(now(), adminId, action, txId);

export function adminResolve(adminId, txId, action) {
  return transaction(() => {
    const r = q('SELECT * FROM txs WHERE id = ?').get(txId);
    if (!r) throw new AppError('No encontrado.', 404);
    if (r.type === 'deposito' && r.status === 'verificando' && action === 'rechazar') {
      q(`UPDATE txs SET status='rechazado', updated_at=? WHERE id=?`).run(now(), txId);
    } else if (r.type === 'retiro' && r.status === 'pendiente' && action === 'pagar') {
      q(`UPDATE txs SET status='pagado', updated_at=? WHERE id=?`).run(now(), txId);
    } else if (r.type === 'retiro' && r.status === 'pendiente' && action === 'rechazar') {
      q(`UPDATE txs SET status='rechazado', updated_at=? WHERE id=?`).run(now(), txId);
      q('UPDATE users SET balance = balance - ? WHERE id = ?').run(r.amount, r.user_id); // r.amount es negativo → devuelve los fondos
    } else throw new AppError('Acción no válida para este movimiento.');
    audit(adminId, `${r.type}:${action}`, txId);
    return { tx: getTx(txId), userId: r.user_id, balance: getUser(r.user_id).balance };
  });
}
export const logAdminApproval = (adminId, txId) => audit(adminId, 'deposito:aprobar', txId);
export const logWebhook = (payload, result) => q('INSERT INTO webhook_log (at,payload,result) VALUES (?,?,?)').run(now(), String(payload).slice(0, 2000), result);

export function backupTo(file) { db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); }
