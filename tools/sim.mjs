// Headless games with invariants after every step: a crash gate and a behaviour readout, never
// a balance instrument (PLAN D1). Usage:
//   node tools/sim.mjs --games 20 [--policy ai|random] [--level normal] [--seed 1] [--all]
// By default only decks whose every card is scripted (or needs no script) and not in
// data/defects.js play. --all plays every registered deck, unscripted text doing nothing: an
// engine fuzz, not a game.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const GAMES = +arg('games', 20), POLICY = arg('policy', 'ai'), LEVEL = arg('level', 'normal'), SEED = +arg('seed', 1);
const ALL = process.argv.includes('--all');
const MAX_STEPS = 6000;

const html = fs.readFileSync(path.join(ROOT, 'tests.html'), 'utf8');
const block = html.split('<!-- engine -->')[1].split('<!-- /engine -->')[0];
const srcs = [...block.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
const ctx = { console, structuredClone, performance };
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
for (const s of srcs) vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s });
const SV = ctx.SV;
if (ALL) SV.LENIENT = true;
if (POLICY === 'ai' && !SV.ai) { console.log('sim: no AI loaded (js/ai.js); use --policy random'); process.exit(1); }

const pool = ALL ? SV.DECKS : SV.DECKS.filter((d) => SV.scriptCoverage(d).missing.length === 0 && SV.playableDecks().includes(d));
if (!pool.length) { console.log('sim: no playable decks (scripts missing); use --all for an engine fuzz'); process.exit(ALL ? 1 : 0); }

function invariants(s) {
  const seen = new Map();
  for (const p of [0, 1]) for (const z of SV.ZONES) for (const i of s.players[p][z]) {
    if (seen.has(i)) throw new Error(`card ${i} in two zones (${seen.get(i)}, ${z})`);
    seen.set(i, z);
    const c = s.cards[i];
    if (c.zone !== z) throw new Error(`card ${i} zone mismatch ${c.zone} vs ${z}`);
    if (z !== 'field' && c.owner !== p) throw new Error(`card ${i} in the wrong player's ${z}`);
    if (z === 'field' && c.ctrl !== p) throw new Error(`card ${i} on p${p}'s field but controlled by p${c.ctrl}`);
  }
  for (const c of Object.values(s.cards)) {
    if (c.dmg < 0 || Number.isNaN(c.dmg)) throw new Error(`bad damage on ${c.iid}`);
    if (c.zone === 'evolve' && (!c.evoOf || s.cards[c.evoOf].evo !== c.iid || s.cards[c.evoOf].zone !== 'field')) throw new Error(`orphan evolve card ${c.iid}`);
    if (c.evo && s.cards[c.evo].zone !== 'evolve') throw new Error(`broken evolve link on ${c.iid}`);
    if (['field', 'ex', 'hand', 'deck', 'cemetery', 'banished', 'evoDeck'].includes(c.zone) && !seen.has(c.iid) && !s.resolving.includes(c.iid)) throw new Error(`card ${c.iid} in ${c.zone} but in no zone list`);
  }
  for (const P of s.players) {
    if (P.field.length > P.fieldLimit && !s.ask && !s.queue.some((j) => j.k === 'overLimit')) throw new Error('field over its limit');
    if (P.pp < 0 || P.pp > P.maxPP || P.maxPP > 10 || P.ep < 0 || P.sep < 0) throw new Error(`bad points ${JSON.stringify([P.pp, P.maxPP, P.ep, P.sep])}`);
    if (Number.isNaN(P.defense)) throw new Error('bad defense');
  }
  if (!SV.isTerminal(s) && !SV.legalActions(s).length) throw new Error(`no legal actions (phase ${s.phase}, window ${JSON.stringify(s.window)}, queue ${s.queue.map((j) => j.k)})`);
}

const stats = { games: 0, errors: 0, capped: 0, firstWins: 0, decisive: 0, draws: 0, turns: 0, attacks: 0, plays: 0, evolves: 0, quick: 0, ownTurns: 0, reasons: {}, ms: 0 };
const t0 = Date.now();
let rng = SEED;
const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
for (let g = 0; g < GAMES; g++) {
  const da = pool[Math.floor(rnd() * pool.length)], db = pool[Math.floor(rnd() * pool.length)];
  let s;
  try {
    s = SV.newGame({ decks: [da.id, db.id], seed: SEED * 1000 + g });
    let steps = 0;
    while (!SV.isTerminal(s) && steps < MAX_STEPS) {
      const who = SV.whoActs(s);
      let a;
      if (POLICY === 'random') {
        const L = SV.legalActions(s);
        // Bias a little toward ending the main phase so random games finish.
        const end = L.find((x) => x.type === 'end');
        a = end && rnd() < 0.15 ? end : L[Math.floor(rnd() * L.length)];
      } else a = SV.ai.choose(s, who, LEVEL);
      if (!s.ask) {
        if (a.type === 'end') stats.ownTurns++;
        if (a.type === 'attack') stats.attacks++;
        if (a.type === 'play') { stats.plays++; if (s.window) stats.quick++; }
        if (a.type === 'evolve') stats.evolves++;
      }
      s = SV.apply(s, a);
      invariants(s);
      steps++;
    }
    if (!SV.isTerminal(s)) stats.capped++;
    else if (s.winner === 'draw') stats.draws++;
    else { stats.decisive++; if (s.winner === s.first) stats.firstWins++; stats.reasons[s.endReason] = (stats.reasons[s.endReason] || 0) + 1; }
    stats.turns += s.turn;
  } catch (e) {
    stats.errors++;
    console.log(`game ${g} (${da.id} vs ${db.id}) ERROR: ${e.message}\n  ${String(e.stack).split('\n').slice(1, 5).join('\n  ')}`);
  }
  stats.games++;
}
stats.ms = Date.now() - t0;
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
const per = (n) => (n / Math.max(1, stats.ownTurns)).toFixed(2);
console.log(`sim ${POLICY}${POLICY === 'ai' ? '/' + LEVEL : ''} ${stats.games} games over ${pool.length} decks${ALL ? ' (--all)' : ''}: ${stats.errors} errors, ${stats.capped} capped, ${stats.draws} draws, decisive ${stats.decisive} ${JSON.stringify(stats.reasons)}`);
console.log(`  first-player wins ${pct(stats.firstWins, stats.decisive)}, mean turns ${(stats.turns / Math.max(1, stats.games)).toFixed(1)}; per turn: plays ${per(stats.plays)} attacks ${per(stats.attacks)} evolves ${per(stats.evolves)}; quick plays ${stats.quick}; ${(stats.ms / Math.max(1, stats.games) / 1000).toFixed(2)} s/game`);
process.exit(stats.errors ? 1 : 0);
