import { useEffect, useRef, useState } from 'react';
import { api, gs } from './api';
import AuthScreen from './components/AuthScreen';
import DepositModal from './components/DepositModal';
import SlotMachine from './components/SlotMachine';
import TransactionList from './components/TransactionList';
import WithdrawModal from './components/WithdrawModal';
import SafetyModal from './components/SafetyModal';
import AdminPanel from './components/AdminPanel';

// Número que se anima al cambiar (el saldo "corre" hasta su nuevo valor).
function Money({ value }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const t0 = performance.now(), a = from.current;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 700);
      from.current = Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3)));
      setShown(from.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{gs(shown)}</>;
}

const GAMES = [
  { id: 'slots', name: 'Tragamonedas', note: 'Mega Guaraní · 3 rodillos', icon: '🎰', active: true },
  { id: 'ruleta', name: 'Ruleta', note: 'Próximamente', icon: '🎡' },
  { id: 'blackjack', name: 'Blackjack', note: 'Próximamente', icon: '🃏' },
  { id: 'poker', name: 'Póker', note: 'Próximamente', icon: '♠️' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState([]);
  const [view, setView] = useState('lobby');
  const [depositOpen, setDepositOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [cfg, setCfg] = useState({ demo: true, licenseId: '' });
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };
  const onAuth = ({ user }) => { setUser(user); setBalance(user.balance); };
  const logout = async () => { await api('/logout', { method: 'POST' }).catch(() => {}); setUser(null); setTxs([]); setView('lobby'); setMenu(false); };

  // Restaurar sesión
  useEffect(() => {
    api('/config').then(setCfg).catch(() => {});
    api('/me').then(onAuth).catch(() => {}).finally(() => setBooting(false));
  }, []);

  // Historial + tiempo real: el servidor empuja saldo y movimientos por SSE (sin recargar).
  useEffect(() => {
    if (!user) return;
    api('/transactions').then((d) => setTxs(d.transactions));
    const es = new EventSource('/api/events');
    es.addEventListener('balance', (e) => setBalance(JSON.parse(e.data).balance));
    es.addEventListener('transaction', (e) => {
      const tx = JSON.parse(e.data);
      setTxs((p) => [tx, ...p.filter((t) => t.id !== tx.id)]);
      if (tx.type === 'deposito' && tx.status === 'completado') notify(`+${gs(tx.amount)} acreditados en tu cuenta`);
      if (tx.type === 'retiro' && tx.status === 'pagado') notify(`Tu retiro de ${gs(-tx.amount)} fue pagado`);
    });
    return () => es.close();
  }, [user?.id]);

  if (booting) return <div className="bg-casino min-h-screen" />;
  if (!user) return <AuthScreen onAuth={onAuth} />;

  return (
    <div className="bg-casino min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button onClick={() => setView('lobby')} className="flex items-center gap-2">
            <span className="text-2xl">🧉</span>
            <span className="gold-text hidden font-display text-xl font-extrabold tracking-wider sm:block">Casino Guaraní</span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <div className="rounded-xl border border-gold/40 bg-gold/5 px-3 py-1.5 text-right shadow-[0_0_20px_#f5c54222]">
              <p className="text-[10px] leading-none text-zinc-400">Saldo</p>
              <p className="font-bold tabular-nums text-gold"><Money value={balance} /></p>
            </div>
            <button className="btn-gold py-2 text-sm" onClick={() => setDepositOpen(true)}>Depositar</button>
            <div className="relative">
              <button className="btn-ghost" onClick={() => setMenu(!menu)} aria-label="Menú de cuenta" aria-expanded={menu}>☰</button>
              {menu && (
                <div className="card absolute right-0 top-12 w-52 space-y-1 p-2 text-sm shadow-xl" onClick={() => setMenu(false)}>
                  <button className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5" onClick={() => setWithdrawOpen(true)}>Retirar</button>
                  <button className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5" onClick={() => setSafetyOpen(true)}>Juego responsable</button>
                  {user.isAdmin && <button className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5" onClick={() => setView('admin')}>Administración</button>}
                  <button className="block w-full rounded-lg px-3 py-2 text-left text-zinc-400 hover:bg-white/5" onClick={logout}>Salir</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {cfg.demo && <div className="bg-neon-cyan/15 py-1.5 text-center text-xs font-medium text-neon-cyan">Modo demostración: no se usa dinero real.</div>}
      {user.excludedUntil > Date.now() && <div className="bg-red-500/15 py-1.5 text-center text-xs font-medium text-red-300">Tu cuenta está en pausa hasta el {new Date(user.excludedUntil).toLocaleDateString('es-PY')}.</div>}

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {view === 'admin' ? (
          <>
            <button className="btn-ghost" onClick={() => setView('lobby')}>← Volver</button>
            <AdminPanel notify={notify} />
          </>
        ) : view === 'lobby' ? (
          <>
            <div>
              <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Hola, <span className="gold-text">{user.name.split(' ')[0]}</span></h1>
              <p className="mt-1 text-zinc-400">Elegí un juego. Tus depósitos llegan solos al saldo.</p>
            </div>

            <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {GAMES.map((g) => (
                <button key={g.id} disabled={!g.active} onClick={() => setView(g.id)}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition ${g.active
                    ? 'border-gold/50 bg-gradient-to-br from-neon-violet/25 via-ink-800 to-neon-pink/20 shadow-[0_0_40px_#a855f733] hover:-translate-y-1 hover:shadow-[0_0_60px_#f5c54255] md:col-span-2 md:row-span-1'
                    : 'cursor-not-allowed border-white/5 bg-ink-800/40 opacity-50'}`}>
                  <div className={`text-4xl ${g.active ? 'sm:text-6xl' : 'grayscale'}`}>{g.icon}</div>
                  <p className="mt-3 font-display text-lg font-bold">{g.name}</p>
                  <p className="text-xs text-zinc-400">{g.note}</p>
                  {g.active && <span className="btn-gold mt-4 inline-block py-1.5 text-sm">Jugar ahora</span>}
                </button>
              ))}
            </section>

            <section>
              <h2 className="mb-3 font-display text-xl font-bold">Movimientos</h2>
              <TransactionList txs={txs} />
            </section>
          </>
        ) : (
          <>
            <button className="btn-ghost" onClick={() => setView('lobby')}>← Volver a juegos</button>
            <SlotMachine balance={balance} setBalance={setBalance} onDeposit={() => setDepositOpen(true)} notify={notify}
              onTx={(tx) => setTxs((p) => [tx, ...p])} />
            <section>
              <h2 className="mb-3 font-display text-xl font-bold">Últimos movimientos</h2>
              <TransactionList txs={txs.slice(0, 6)} />
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-zinc-500">
        +18 · Jugá con responsabilidad{cfg.licenseId && ` · Habilitación ${cfg.licenseId}`}
      </footer>

      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} txs={txs} />
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} notify={notify} />
      <SafetyModal open={safetyOpen} onClose={() => setSafetyOpen(false)} user={user} onUser={setUser} />

      {toast && (
        <div role="status" className="animate-rise fixed left-1/2 top-20 z-[80] -translate-x-1/2 rounded-xl border border-gold/40 bg-ink-800 px-5 py-3 text-sm font-medium shadow-[0_0_40px_#f5c54244]">
          {toast}
        </div>
      )}
    </div>
  );
}
