import { useEffect, useRef } from 'react';

// Confeti en canvas, sin dependencias. `run` es un contador: cada incremento lanza una ráfaga.
export default function Confetti({ run }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!run) return;
    const c = ref.current, ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const colors = ['#f5c542', '#ffe08a', '#ff2e9a', '#22d3ee', '#a855f7', '#ffffff'];
    const ps = Array.from({ length: 170 }, () => ({
      x: innerWidth / 2, y: innerHeight * 0.5,
      vx: (Math.random() - 0.5) * 18, vy: -Math.random() * 17 - 4,
      s: 5 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    let raf, t = 0;
    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.36; p.vx *= 0.99; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6);
        ctx.restore();
      });
      if (++t < 200) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [run]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[70]" aria-hidden />;
}
