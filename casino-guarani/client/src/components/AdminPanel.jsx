import { useCallback, useEffect, useState } from 'react';
import { api, gs } from '../api';

export default function AdminPanel({ notify }) {
  const [q, setQ] = useState({ items: [], unmatched: [] });
  const load = useCallback(() => api('/admin/queue').then(setQ).catch((e) => notify(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const act = async (id, action) => {
    try { await api(`/admin/${id}/${action}`, { method: 'POST' }); load(); } catch (e) { notify(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Pagos por revisar</h2>
        <button className="btn-ghost" onClick={load}>Actualizar</button>
      </div>
      {!q.items.length && <div className="card p-8 text-center text-zinc-400">No hay nada pendiente.</div>}
      <ul className="space-y-3">
        {q.items.map((t) => {
          const dep = t.type === 'deposito';
          return (
            <li key={t.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{dep ? 'Depósito' : 'Retiro'} · {gs(Math.abs(t.amount))}</p>
                <p className="text-xs text-zinc-500">{new Date(t.createdAt).toLocaleString('es-PY')}</p>
              </div>
              <p className="text-sm text-zinc-300">{t.user.name} · CI {t.user.document} · ref {t.user.ref}</p>
              {!dep && <p className="text-sm text-zinc-400">Pagar a: {t.meta.destino} · titular {t.meta.titular}</p>}
              <div className="flex gap-2">
                <button className="btn-gold py-2 text-sm"
                  onClick={() => confirm(dep ? 'Confirmá que el dinero ya figura en el extracto del banco.' : 'Confirmá que ya transferiste el pago.') && act(t.id, dep ? 'aprobar' : 'pagar')}>
                  {dep ? 'Aprobar: ya está en el banco' : 'Marcar como pagado'}
                </button>
                <button className="btn-ghost" onClick={() => confirm('¿Rechazar?') && act(t.id, 'rechazar')}>Rechazar{!dep && ' y devolver saldo'}</button>
              </div>
            </li>
          );
        })}
      </ul>
      {q.unmatched.length > 0 && (
        <div>
          <h3 className="mb-2 font-medium text-zinc-300">Avisos del banco sin acreditar</h3>
          <ul className="card divide-y divide-white/5 text-xs text-zinc-400">
            {q.unmatched.map((u) => <li key={u.id} className="break-all p-3">{new Date(u.at).toLocaleString('es-PY')} · {u.result} · {u.payload}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
