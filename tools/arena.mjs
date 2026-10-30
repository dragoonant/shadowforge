// Head-to-head between two AI levels, both seats, decisive outcomes only (a measurement, never a
// reason to change a card — PLAN D1). Random registered decks, same deck pair played both ways.
//   node tools/arena.mjs --a hard --b normal --games 20 [--seed 5000]
import { loadPage } from './test.mjs';
const SV = loadPage('tests.html').SV;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const A = arg('a', 'hard'), B = arg('b', 'normal'), N = +arg('games', 20), SEED = +arg('seed', 5000);
let aWins = 0, decisive = 0, ms = 0, decisions = 0;
const decks = SV.playableDecks();
for (let g = 0; g < N; g++) {
  const pair = Math.floor(g / 2);
  const d0 = decks[(pair * 7) % decks.length].id, d1 = decks[(pair * 11 + 3) % decks.length].id;
  const aSeat = g % 2; // A plays seat 0 in even games, seat 1 in odd games, same decks and seed per pair
  let s = SV.newGame({ decks: [d0, d1], seed: SEED + pair, first: pair % 2 });
  for (let k = 0; k < 3000 && !SV.isTerminal(s); k++) {
    const who = SV.whoActs(s);
    const t0 = Date.now();
    s = SV.apply(s, SV.ai.choose(s, who, who === aSeat ? A : B));
    ms += Date.now() - t0; decisions++;
  }
  if (s.winner === 0 || s.winner === 1) { decisive++; if (s.winner === aSeat) aWins++; }
  console.log(`game ${g}: ${d0} vs ${d1}, ${A} in seat ${aSeat}, winner ${s.winner} (${s.endReason}) turn ${s.turn}`);
}
console.log(`arena ${A} vs ${B}: ${A} won ${aWins}/${decisive} decisive (${(100 * aWins / Math.max(1, decisive)).toFixed(1)}%), ${(ms / Math.max(1, decisions)).toFixed(0)} ms/decision`);
