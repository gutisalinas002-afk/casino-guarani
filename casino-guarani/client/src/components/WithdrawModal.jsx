import { useEffect, useState } from 'react';
import { api, gs } from '../api';

export default function WithdrawModal({ open, onClose, notify }) {
  const [info, setInfo] = useState(null);
  const [f, setF] = useState({ amount: '', destino: '', titular: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { if (open) { setErr(''); api('/withdrawals/info').then(setInfo).catch((e) => setErr(e.message)); } }, [open]);
  if (!open) return null;

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await api('/withdrawals', { method: 'POST', body: { ...f, amount: Number(f.amount) } });
      notify('Solicitud de retiro enviada. La vas a ver en tus movimientos.');
      onClose();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card animate-rise max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-b-none border-gold/30 p-6 sm:max-w-md sm:rounded-b-2xl">
        <div className="flex items-center justify-between">
          <h2 className="gold-text font-display text-2xl font-extrabold">Retirar</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full bg-white/5">✕</button>
        </div>
        {info && (
          <p className="text-sm text-zinc-400">
            Disponible: <b className="text-gold">{gs(info.balance)}</b> · mínimo {gs(info.min)}.
            {info.wagerLeft > 0 && <span className="mt-2 block rounded-lg bg-neon-cyan/10 p-3 text-neon-cyan">Te faltan {gs(info.wagerLeft)} en apuestas para poder retirar.</span>}
          </p>
        )}
        <input className="input" type="number" min="50000" placeholder="Monto a retirar (Gs.)" value={f.amount} onChange={set('amount')} required />
        <input className="input" placeholder="Banco y cuenta, o alias" value={f.destino} onChange={set('destino')} required />
        <input className="input" placeholder="Titular de la cuenta" value={f.titular} onChange={set('titular')} required />
        <p className="text-xs text-zinc-500">La cuenta tiene que estar a tu nombre. Revisamos cada retiro a mano antes de pagarlo.</p>
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
        <button className="btn-gold w-full py-3" disabled={busy || (info && info.wagerLeft > 0)}>Solicitar retiro</button>
      </form>
    </div>
  );
}
