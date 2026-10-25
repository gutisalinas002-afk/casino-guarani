import { useLayoutEffect, useRef, useState } from 'react';
import { api, gs } from '../api';
import { sfx, setMuted } from '../sounds';
import Confetti from './Confetti';

const SYMS = ['🍒', '🍋', '🔔', '🧉', '💎', '7️⃣'];
const BETS = [1000, 5000, 10000, 20000, 50000, 100000];
const PAYTABLE = [['7️⃣', 150], ['💎', 60], ['🧉', 30], ['🔔', 18], ['🍋', 10], ['🍒', 6]]; // igual que el servidor
const rnd = () => SYMS[(Math.random() * SYMS.length) | 0];
const REEL_MS = (i) => 1300 + i * 500;

// Cada rodillo es una tira vertical de símbolos que se desliza con una transición CSS.
// strip = [relleno, símbolo anterior, ...aleatorios, resultado, relleno]; el resultado queda en la fila central.
function Reel({ strip, spinId, i }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!spinId) return;
    const el = ref.current;
    el.style.transition = 'none';
    el.style.transform = 'translateY(0)';
    void el.offsetHeight; // fuerza reflow para reiniciar la animación
    el.style.transition = `transform ${REEL_MS(i)}ms cubic-bezier(.2,.8,.25,1.04)`; // leve rebote al frenar
    el.style.transform = `translateY(calc(var(--sym) * -${strip.length - 3}))`;
  }, [spinId]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 ring-1 ring-gold/30"
      style={{ width: 'var(--sym)', height: 'calc(var(--sym) * 3)' }}>
      <div ref={ref} className="will-change-transform">
        {strip.map((s, k) => (
          <div key={k} className="grid place-items-center leading-none" style={{ height: 'var(--sym)', fontSize: 'calc(var(--sym) * .55)' }}>{s}</div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/75" />
    </div>
  );
}

const Marquee = () => (
  <div className="flex justify-between px-1" aria-hidden>
    {Array.from({ length: 14 }, (_, i) => (
      <span key={i} className="h-2 w-2 animate-twinkle rounded-full bg-gold shadow-[0_0_8px_#f5c542]" style={{ animationDelay: `${(i % 2) * 0.6}s` }} />
    ))}
  </div>
);

export default function SlotMachine({ balance, setBalance, onTx, notify, onDeposit }) {
  const [bet, setBet] = useState(5000);
  const [reels, setReels] = useState(() => [0, 1, 2].map(() => [rnd(), rnd(), rnd()]));
  const [spinId, setSpinId] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [confetti, setConfetti] = useState(0);
  const [mute, setMute] = useState(false);

  async function spin() {
    if (spinning || balance < bet) return;
    setSpinning(true); setResult(null);
    setBalance((b) => b - bet); // descuento optimista de la apuesta
    let data;
    try {
      data = await api('/slots/spin', { method: 'POST', body: { bet } });
    } catch (e) {
      setBalance((b) => b + bet); setSpinning(false); notify(e.message); return;
    }
    setReels((rs) => rs.map((strip, i) => [rnd(), strip[strip.length - 2], ...Array.from({ length: 12 + i * 6 }, rnd), data.reels[i], rnd()]));
    setSpinId((n) => n + 1);
    sfx.spin();
    [0, 1, 2].forEach((i) => setTimeout(sfx.stop, REEL_MS(i)));

    setTimeout(() => { // termina el último rodillo: recién ahí se revela el premio
      setSpinning(false); setBalance(data.balance); onTx(data.tx); setResult(data);
      if (data.win > 0) {
        sfx.win(data.mult >= 18);
        if (data.mult >= 6) setConfetti((c) => c + 1);
      }
    }, REEL_MS(2) + 150);
  }

  const win = result?.win > 0;
  const big = win && result.mult >= 18;
  const short = balance < bet && !spinning;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_17rem]">
      <Confetti run={confetti} />

      <section className={`relative rounded-3xl border border-gold/40 bg-gradient-to-b from-ink-700 to-ink-900 p-4 sm:p-6 ${win ? 'animate-glow' : 'shadow-[0_0_60px_#a855f722]'}`}>
        <Marquee />
        <button onClick={() => { setMute(!mute); setMuted(!mute); }} aria-label={mute ? 'Activar sonido' : 'Silenciar'}
          className="absolute right-3 top-8 grid h-8 w-8 place-items-center rounded-full bg-white/5 text-sm hover:bg-white/10">{mute ? '🔇' : '🔊'}</button>
        <h2 className="gold-text my-3 text-center font-display text-2xl font-extrabold tracking-widest">Mega Guaraní</h2>

        <div className="relative mx-auto flex w-fit gap-2 rounded-2xl bg-black/60 p-3 ring-2 ring-gold/50 [--sym:4.4rem] sm:[--sym:6rem]">
          {reels.map((s, i) => <Reel key={i} strip={s} spinId={spinId} i={i} />)}
          <div className={`pointer-events-none absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 bg-neon-pink shadow-[0_0_14px_#ff2e9a] ${win ? 'animate-twinkle' : 'opacity-60'}`} />
        </div>

        <div className="my-4 grid h-16 place-items-center text-center" aria-live="polite">
          {spinning ? <span className="animate-pulse text-zinc-400">Girando…</span>
            : win ? (
              <div key={spinId} className="animate-pop">
                <div className={`font-display font-extrabold ${big ? 'gold-text text-3xl' : 'text-2xl text-gold'}`}>{big ? '¡Gran premio!' : '¡Ganaste!'}</div>
                <div className="text-xl font-bold">+{gs(result.win)}</div>
              </div>
            ) : result ? <span className="text-zinc-400">Sin premio esta vez. Probá de nuevo.</span>
            : <span className="text-zinc-400">Elegí tu apuesta y girá.</span>}
        </div>

        <p className="mb-2 text-center text-xs text-zinc-500">Apuesta por giro</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {BETS.map((b) => (
            <button key={b} disabled={spinning} onClick={() => setBet(b)}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold transition sm:text-sm ${bet === b ? 'border-gold bg-gold/15 text-gold' : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'}`}>
              {new Intl.NumberFormat('es-PY').format(b)}
            </button>
          ))}
        </div>

        {short
          ? <button className="btn-gold mt-4 w-full py-4 text-lg" onClick={onDeposit}>Saldo insuficiente · Depositar</button>
          : <button className="btn-gold mt-4 w-full py-4 font-display text-xl tracking-[0.3em]" disabled={spinning} onClick={spin}>{spinning ? '…' : 'GIRAR'}</button>}
      </section>

      <aside className="card h-fit p-5">
        <h3 className="mb-3 font-display text-lg font-bold text-gold">Premios</h3>
        <ul className="space-y-2 text-sm">
          {PAYTABLE.map(([s, m]) => (
            <li key={s} className="flex items-center justify-between"><span className="text-xl tracking-widest">{s}{s}{s}</span><b>×{m}</b></li>
          ))}
          <li className="flex items-center justify-between border-t border-white/10 pt-2"><span className="text-xl">🍒🍒</span><b>×2</b></li>
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">Los premios multiplican tu apuesta. Cada giro se resuelve en el servidor. Retorno teórico ≈ 93,7 %.</p>
      </aside>
    </div>
  );
}
