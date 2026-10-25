import { useEffect, useState } from 'react';
import { api, gs } from '../api';

const CHIPS = [20000, 50000, 100000, 200000, 500000];

function Copy({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="text-xs font-semibold text-gold hover:underline"
      onClick={() => { navigator.clipboard?.writeText(String(text)); setOk(true); setTimeout(() => setOk(false), 1200); }}>
      {ok ? 'Copiado' : 'Copiar'}
    </button>
  );
}
const Row = ({ label, value, strong }) => (
  <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 last:border-0">
    <div><p className="text-xs text-zinc-500">{label}</p><p className={strong ? 'font-bold text-gold' : 'font-medium'}>{value}</p></div>
    <Copy text={value} />
  </div>
);

export default function DepositModal({ open, onClose, txs }) {
  const [amount, setAmount] = useState(50000);
  const [intent, setIntent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (!open) { setIntent(null); setErr(''); } }, [open]);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  if (!open) return null;

  // Estado en vivo: viene del servidor por SSE (lista `txs` del padre).
  const live = intent ? (txs.find((t) => t.id === intent.tx.id) ?? intent.tx) : null;

  async function run(fn) {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  const create = () => run(async () => setIntent(await api('/deposits', { method: 'POST', body: { amount } })));
  const claim = () => run(() => api(`/deposits/${intent.tx.id}/claim`, { method: 'POST' }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Depositar" onClick={(e) => e.stopPropagation()}
        className="card animate-rise max-h-[92vh] w-full overflow-y-auto rounded-b-none border-gold/30 p-6 shadow-[0_0_80px_#a855f733] sm:max-w-md sm:rounded-b-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="gold-text font-display text-2xl font-extrabold">Depositar</h2>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full bg-white/5 hover:bg-white/10">✕</button>
        </div>

        {/* Paso 1: monto */}
        {!intent && (
          <div className="space-y-4">
            <ol className="space-y-1 text-sm text-zinc-400">
              <li>1. Elegí el monto y te damos la cuenta y tu referencia.</li>
              <li>2. Transferí desde la app de tu banco.</li>
              <li>3. Tu saldo se acredita solo, en cuanto el banco confirma.</li>
            </ol>
            <label className="block text-sm text-zinc-400">Monto en guaraníes
              <input className="input mt-1 text-lg font-bold" type="number" min="10000" step="1000" value={amount}
                onChange={(e) => setAmount(Number(e.target.value))} />
            </label>
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => setAmount(c)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${amount === c ? 'border-gold bg-gold/15 text-gold' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                  {new Intl.NumberFormat('es-PY').format(c)}
                </button>
              ))}
            </div>
            {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
            <button className="btn-gold w-full py-3" disabled={busy || amount < 10000} onClick={create}>Continuar</button>
            <p className="text-center text-xs text-zinc-500">Mínimo 10.000 Gs.</p>
          </div>
        )}

        {/* Paso 2: datos de pago */}
        {intent && live.status !== 'completado' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 text-center">
              <p className="text-xs text-zinc-400">Transferí exactamente</p>
              <p className="gold-text font-display text-3xl font-extrabold">{gs(intent.tx.amount)}</p>
            </div>
            <div className="rounded-xl border border-white/10 px-4">
              <Row label="Banco" value={intent.bank.banco} />
              <Row label="Titular" value={intent.bank.titular} />
              <Row label="Cuenta" value={intent.bank.cuenta} />
              <Row label="Alias" value={intent.bank.alias} />
              <Row label="Tu referencia (ponela en el concepto)" value={intent.reference} strong />
            </div>
            {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
            {live.status === 'pendiente' ? (
              <button className="btn-gold w-full py-3" disabled={busy} onClick={claim}>Ya pagué</button>
            ) : (
              <div className="flex items-center justify-center gap-3 rounded-xl bg-neon-cyan/10 py-3 text-neon-cyan">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" />
                Esperando confirmación del banco…
              </div>
            )}
            <p className="text-center text-xs text-zinc-500">Podés cerrar esta ventana: el saldo se actualiza solo cuando llegue el pago.</p>
          </div>
        )}

        {/* Paso 3: acreditado */}
        {intent && live.status === 'completado' && (
          <div className="animate-pop space-y-4 py-4 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400/10 text-4xl text-emerald-400 ring-2 ring-emerald-400/40">✓</div>
            <p className="font-display text-xl font-bold">¡Depósito acreditado!</p>
            <p className="text-zinc-400">{gs(live.amount)} ya están en tu saldo.</p>
            <button className="btn-gold w-full py-3" onClick={onClose}>Ir a jugar</button>
          </div>
        )}
      </div>
    </div>
  );
}
