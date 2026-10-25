import crypto from 'node:crypto';

export const SYMBOLS = [ // w = peso (suma 100), pay = multiplicador por 3 iguales
  { s: '🍒', w: 30, pay: 6 }, { s: '🍋', w: 25, pay: 10 }, { s: '🔔', w: 18, pay: 18 },
  { s: '🧉', w: 14, pay: 30 }, { s: '💎', w: 9, pay: 60 }, { s: '7️⃣', w: 4, pay: 150 },
];
export const BETS = [1000, 5000, 10000, 20000, 50000, 100000];

const draw = () => {
  let r = crypto.randomInt(100);
  for (const x of SYMBOLS) if ((r -= x.w) < 0) return x.s;
};
export function multiplier(reels) {
  if (reels.every((s) => s === reels[0])) return SYMBOLS.find((x) => x.s === reels[0]).pay;
  if (reels.filter((s) => s === '🍒').length === 2) return 2;
  return 0;
}
export function playSlots(bet) {
  const reels = [draw(), draw(), draw()];
  const mult = multiplier(reels);
  return { reels, mult, win: bet * mult };
}
