// Efectos de sonido sintetizados con WebAudio (sin archivos externos).
let ctx, muted = false;
const ac = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)());

function tone(freq, start, dur, type = 'sine', vol = 0.08) {
  const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur);
}

export const setMuted = (m) => { muted = m; };
export const sfx = {
  spin() { if (!muted) for (let i = 0; i < 15; i++) tone(260 + i * 22, i * 0.15, 0.07, 'square', 0.025); },
  stop() { if (!muted) tone(160, 0, 0.14, 'triangle', 0.12); },
  win(big) {
    if (muted) return;
    (big ? [523, 659, 784, 1047, 1319, 1568, 2093] : [523, 659, 784]).forEach((f, i) => tone(f, i * 0.1, 0.28, 'triangle', 0.1));
  },
};
