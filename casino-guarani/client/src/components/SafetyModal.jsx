import { useState } from 'react';
import { api, gs } from '../api';

export default function SafetyModal({ open, onClose, user, onUser }) {
  const [limit, setLimit] = useState(user.depositLimit);
  const [msg, setMsg] = useState('');
  if (!open) return null;

  async function call(path, body, ok) {
    setMsg('');
    try { onUser((await api(path, { method: 'POST', body })).user); setMsg(ok); } catch (e) { setMsg(e.message); }
  }
  const paused = user.excludedUntil > Date.now();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card animate-rise w-full space-y-5 rounded-b-none border-gold/30 p-6 sm:max-w-md sm:rounded-b-2xl">
        <div className="flex items-center justify-between">
          <h2 className="gold-text font-display text-2xl font-extrabold">Juego responsable</h2>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full bg-white/5">✕</button>
        </div>

        <div className="space-y-2">
          <p className="font-medium">Límite de depósito por día</p>
          <div className="flex gap-2">
            <input className="input" type="number" step="10000" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
            <button className="btn-gold" onClick={() => call('/safety/limit', { limit }, 'Límite actualizado.')}>Guardar</button>
          </div>
          <p className="text-xs text-zinc-500">Hoy: {gs(user.depositLimit)}.</p>
        </div>

        <div className="space-y-2 border-t border-white/10 pt-4">
          <p className="font-medium">Pausar mi cuenta</p>
          <p className="text-xs text-zinc-500">Durante la pausa no podés jugar ni depositar. No se puede deshacer antes de tiempo.</p>
          {paused
            ? <p className="rounded-lg bg-neon-cyan/10 p-3 text-sm text-neon-cyan">Cuenta en pausa hasta el {new Date(user.excludedUntil).toLocaleDateString('es-PY')}.</p>
            : <div className="flex gap-2">{[7, 30, 90].map((d) => (
                <button key={d} className="btn-ghost flex-1" onClick={() => confirm(`¿Pausar tu cuenta ${d} días?`) && call('/safety/exclude', { days: d }, 'Cuenta en pausa.')}>{d} días</button>
              ))}</div>}
        </div>
        {msg && <p role="status" className="text-sm text-gold">{msg}</p>}
        <p className="text-xs text-zinc-500">Si sentís que el juego te está afectando, hablá con alguien de confianza o con un profesional de salud.</p>
      </div>
    </div>
  );
}
