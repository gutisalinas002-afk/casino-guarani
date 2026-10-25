import { gs } from '../api';

const STATUS = {
  pendiente: ['Pendiente', 'bg-white/5 text-zinc-400'],
  verificando: ['Verificando pago', 'bg-neon-cyan/10 text-neon-cyan'],
  completado: ['Acreditado', 'bg-emerald-400/10 text-emerald-400'],
  pagado: ['Pagado', 'bg-emerald-400/10 text-emerald-400'],
  rechazado: ['Rechazado', 'bg-red-500/10 text-red-300'],
};
const fmt = (ts) => new Date(ts).toLocaleString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function TransactionList({ txs }) {
  if (!txs.length)
    return <div className="card p-8 text-center text-zinc-400">Todavía no hay movimientos. Hacé tu primer depósito para empezar a jugar.</div>;

  return (
    <ul className="card divide-y divide-white/5 overflow-hidden">
      {txs.map((t) => {
        const dep = t.type !== 'juego'; const wd = t.type === 'retiro';
        const done = t.status === 'completado' || t.status === 'pagado';
        const [label, cls] = wd && t.status === 'pendiente' ? ['En revisión', STATUS.verificando[1]] : STATUS[t.status] || STATUS.completado;
        const color = t.status === 'rechazado' ? 'text-zinc-500 line-through' : !done && !wd ? 'text-zinc-500' : t.amount >= 0 ? 'text-emerald-400' : 'text-zinc-300';
        return (
          <li key={t.id} className="animate-rise flex items-center gap-3 p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${dep ? 'bg-neon-cyan/10' : 'bg-gold/10'}`}>{wd ? '💸' : dep ? '🏦' : '🎰'}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{wd ? 'Retiro' : dep ? 'Depósito bancario' : 'Tragamonedas'}</p>
              <p className="truncate text-xs text-zinc-500">
                {fmt(t.createdAt)}{!dep && ` · ${t.meta.reels.join(' ')} · apuesta ${gs(t.meta.bet)}`}
              </p>
            </div>
            <div className="text-right">
              <p className={`font-bold tabular-nums ${color}`}>{t.amount >= 0 ? '+' : '−'}{gs(Math.abs(t.amount))}</p>
              {dep && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${cls}`}>{label}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
