// Printed-vs-scripted auditor (KB LESSONS §2.3; lorecannae's, adapted). For every scripted card:
//   FAIL - a number in the printed ability text (outside reminder text and engine-read lines) does
//          not appear anywhere in the card's script source (a dropped clause or a wrong amount).
//          Icons count: [cost02] must show up as 2, "[attack]+1/[defense]+1" as 1.
//   MISSING - a card that needs a script (SV.needsScript) has none and is not in SV.DEFECTS.
// A script may carry `audit: '<n>: why'` where a printed number lives in a shared helper or is
// implicit; the note is part of the scanned source. --selftest proves FAIL fires on a bad script.
import { loadPage } from './test.mjs';
const SV = loadPage('tests.html').SV;
const ENGINE_LINE = /^(((Ward|Storm|Rush|Bane|Drain|Assail|Intimidate|Aura)\. ?)+|\[quick\]|\[evolve\] ?\[cost\d+\]: Evolve this( follower)?\.|\[feed\] ?\[cost\d+\]: Race this follower\.)$/;
const src = (v) => (typeof v === 'function' ? v.toString() : Array.isArray(v) ? v.map(src).join(' ') : v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => k + ':' + src(x)).join(' ') : String(v));
function audit(d, script) {
  const fails = [];
  const code = src(script);
  for (const raw of (d.text || '').split('\n')) {
    if (/^-{3,}$/.test(raw) || /^\[UB\]/.test(raw)) continue; // Union Burst is invalid in class decks (CR 14.5.1.2)
    if (/^You can put up to \d+ of this card|^Your main deck and evolve deck may only/.test(raw)) continue;
    let line = raw.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    if (!line || ENGINE_LINE.test(line)) continue;
    line = line.replace(/\[cost00\]/g, ' ').replace(/\[cost(\d+)\]/g, (_, n) => ' ' + Number(n) + ' '); // [cost00]: nothing to pay
    for (const m of line.matchAll(/(?<![A-Za-z\d])(\d+)(?![\d])/g)) {
      const n = m[1];
      if (!new RegExp(`(?<![\\w.])${n}(?![\\w])`).test(code)) fails.push(`printed number ${n} absent ("${line.slice(Math.max(0, m.index - 30), m.index + 25).trim()}")`);
    }
  }
  return fails;
}
if (process.argv.includes('--selftest')) {
  const d = SV.CARDS['BP16-080EN'];
  const bad = { triggers: [{ name: 'x', run(x) { x.heal(x.ctrl, 3); } }] };
  const r = audit(d, bad);
  console.log(r.length ? 'audit selftest: ok (bad script flagged)' : 'audit selftest: FAILED to flag a bad script');
  process.exit(r.length ? 0 : 1);
}
let F = 0, M = 0;
for (const d of Object.values(SV.CARDS)) {
  const script = SV.ABIL[d.no] && (SV.ABIL[d.no].__spec || SV.ABIL[d.no]);
  if (!script) {
    if (SV.needsScript(d.no) && !SV.DEFECTS[d.no]) { M++; if (process.argv.includes('--missing')) console.log(`MISSING ${d.no} ${d.name}`); }
    continue;
  }
  for (const f of audit(d, script)) { F++; console.log(`FAIL ${d.no} ${d.name}: ${f}`); }
}
console.log(`audit: ${F} FAIL, ${M} unscripted (not in defects), ${Object.keys(SV.DEFECTS).length} defects, over ${Object.keys(SV.ABIL).length} scripts`);
process.exit(F || M ? 1 : 0);
