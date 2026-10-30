// Every gate, one line each. Exit non-zero if any fails. A step whose tool does not exist yet
// is reported as "skip" (never silently dropped), so the list says what is still missing.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const steps = [
  ['tests', ['tools/test.mjs', '--quiet']],
  ['check-pages', ['tools/check-pages.mjs']],
  ['stamp-assets', ['tools/stamp-assets.mjs', '--check']],
  ['audit', ['tools/audit-cards.mjs']],
  ['check-art', ['tools/check-art.mjs']],
  ['check-look', ['tools/check-look.mjs']],
  ['replay selftest', ['tools/replay-report.mjs', '--selftest']],
  ['sim random', ['tools/sim.mjs', '--games', '30', '--policy', 'random']],
  ['sim ai', ['tools/sim.mjs', '--games', '10']],
];
let bad = 0;
for (const [name, args] of steps) {
  if (!fs.existsSync(path.join(ROOT, args[0]))) { console.log(`skip ${name}: ${args[0]} does not exist yet`); continue; }
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: ROOT });
  const out = ((r.stdout || '') + (r.stderr || '')).trim().split('\n');
  const last = out.filter((l) => !l.startsWith('FAIL') && !l.includes('ERROR')).slice(-1)[0] || '';
  console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} ${name}: ${last}`);
  if (r.status !== 0) { bad++; for (const l of out.filter((l) => l.startsWith('FAIL') || l.includes('ERROR')).slice(0, 8)) console.log('     ' + l); }
}
process.exit(bad ? 1 : 0);
