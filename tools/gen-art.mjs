// Renders tools/art/art-prompts.json through the local Flux Studio (PLAN.md D12; FLUX.2 klein 4B,
// Apache-2.0, ComfyUI underneath). Adapted from MythosForge/tools/gen-art.mjs.
//   POST /api/settings {freeAfter:false}; POST /api/jobs {model, prompt, aspect, megapixels, batch:1, seed} -> {id}
//   GET /api/jobs/<id> until 'done'; GET /files/<id>/<image>; finally POST /api/settings {freeAfter:true}.
// Studio URL: FLUX_URL env, the `FLUX=` line of tokens.txt, else http://localhost:7880.
//   node tools/gen-art.mjs [--set cards|ui] [--only id[,id]] [--limit N] [--force] [--seed-bump N]
//                          [--out <dir>] [--prompts <file>] [--keep-loaded] [--dry-run]
//                          [--yield] [--lock] [--max-seconds S]   (GPU-sharing slice mode, tools/art/gpu.mjs)
// Idempotent: an id that already has a master is skipped. --dry-run makes no network call.
// --only is an exact match. --force archives the old master to art/archive/ first.
// Seed = FNV-1a(id + ':' + seed-bump), so a rerun reproduces a plate and a bump re-rolls.
// Masters: art/masters/<id>.png (cards), art/masters/ui/<id>.png (UI). Both gitignored.
// Then: node tools/shrink-art.mjs && node tools/write-manifest.mjs && node tools/check-art.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { otherGpuJobs, touchLock } from './art/gpu.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const dry = process.argv.includes('--dry-run'), force = process.argv.includes('--force'), keepLoaded = process.argv.includes('--keep-loaded');
const yieldGpu = process.argv.includes('--yield'), useLock = process.argv.includes('--lock'), maxSec = +arg('max-seconds', 0);
const set = arg('set', 'cards'), limit = +arg('limit', 9999), only = arg('only', null), model = arg('model', 'klein'), bump = +arg('seed-bump', 0);
if (!['klein', 'schnell', 'dev'].includes(model)) { console.log('gen-art: unknown model ' + model); process.exit(2); }  // dev: non-commercial licence, allowed for this free fan project (PLAN.md D17)
const tokens = {};
for (const f of ['tokens.txt', 'tokens.txt.txt']) { const p = path.join(ROOT, f); if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) { const m = l.match(/^(\w+)=(.*)$/); if (m) tokens[m[1]] = m[2].trim(); } }
const FLUX_URL = (process.env.FLUX_URL || tokens.FLUX || 'http://localhost:7880').replace(/\/$/, '');
const planFile = path.resolve(ROOT, arg('prompts', 'tools/art/art-prompts.json'));
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const table = set === 'ui' ? plan.ui : plan.prompts;
if (!table) { console.log('gen-art: no "' + set + '" table in ' + planFile); process.exit(2); }
const masters = path.resolve(ROOT, arg('out', set === 'ui' ? 'art/masters/ui' : 'art/masters'));
const archive = path.join(ROOT, 'art/archive');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function seedOf(id) { let h = 2166136261; for (const ch of id + ':' + bump) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483647; }
async function settings(freeAfter) { await fetch(FLUX_URL + '/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ freeAfter }) }).catch(() => {}); }
async function flux(id, e) {
  const body = { model: e.model || model, prompt: e.prompt, aspect: e.aspect || '2:3', megapixels: e.megapixels || 1, batch: 1, seed: seedOf(id) };
  const r = await fetch(FLUX_URL + '/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const job = await r.json();
  if (!r.ok) throw new Error('flux ' + r.status + ' ' + (job.error || ''));
  const t0 = Date.now();
  for (;;) {
    await sleep(1500);
    const j = await (await fetch(FLUX_URL + '/api/jobs/' + job.id)).json();
    if (j.status === 'done') return Buffer.from(await (await fetch(FLUX_URL + '/files/' + j.id + '/' + j.images[0])).arrayBuffer());
    if (j.status === 'failed' || j.status === 'cancelled') throw new Error('flux job ' + j.status + ': ' + (j.error || ''));
    if (Date.now() - t0 > 15 * 60 * 1000) { await fetch(FLUX_URL + '/api/jobs/' + job.id + '/cancel', { method: 'POST' }).catch(() => {}); throw new Error('flux: timed out after 15 min'); }
  }
}
const wanted = only ? only.split(',') : null;
if (wanted) for (const w of wanted) if (!table[w]) { console.log('gen-art: unknown id ' + w + ' (--only is an exact match)'); process.exit(2); }
const ids = Object.keys(table).filter(id => !wanted || wanted.includes(id));
if (!dry) { fs.mkdirSync(masters, { recursive: true }); fs.mkdirSync(archive, { recursive: true }); }
let done = 0, skipped = 0; const failed = []; const rendered = new Set(); const tAll = Date.now();
if (!dry) await settings(false);
try {
  for (const id of ids) {
    if (done >= limit) break;
    if (maxSec && (Date.now() - tAll) / 1000 > maxSec) { console.log('gen-art: slice time budget reached'); break; }
    const out = path.join(masters, id + '.png');
    if (fs.existsSync(out) && !force) { skipped++; continue; }
    const e = table[id];
    if (dry) { console.log('[dry-run] ' + id + ' seed ' + seedOf(id) + ' ' + (e.aspect || '2:3') + ' ' + (e.megapixels || 1) + 'MP: ' + e.prompt.slice(0, 120) + '...'); done++; continue; }
    if (force && fs.existsSync(out)) fs.renameSync(out, path.join(archive, (set === 'ui' ? 'ui-' : '') + id + '-' + Date.now() + '.png'));
    if (yieldGpu && otherGpuJobs()) { console.log('gen-art: another session started a GPU job; yielding'); break; }
    if (useLock) touchLock();
    const t0 = Date.now(); let buf = null;
    for (let attempt = 1; attempt <= 3 && !buf; attempt++) {
      try { buf = await flux(id, e); }
      catch (err) { console.log('  retry ' + id + ' (' + attempt + '): ' + err.message.slice(0, 160)); await sleep(4000 * attempt); }
    }
    if (!buf) { failed.push(id); console.log('  FAILED ' + id + ' (rerun to retry)'); continue; }
    fs.writeFileSync(out, buf); done++; rendered.add(id);
    console.log('[' + done + '] ' + id + ' ' + Math.round((Date.now() - t0) / 1000) + 's (' + buf.length + ' bytes)');
  }
} finally {
  if (!dry && !keepLoaded) { await settings(true); await fetch(FLUX_URL + '/api/backend/free', { method: 'POST' }).catch(() => {}); }
}
console.log((dry ? 'dry-run: ' : '') + done + ' planned/rendered, ' + skipped + ' already present, set ' + set + ', ' + Math.round((Date.now() - tAll) / 1000) + 's, studio ' + FLUX_URL + ' (' + model + ', seed-bump ' + bump + ')' + (failed.length ? '; FAILED: ' + failed.join(', ') : ''));
// Under --force a re-run would redo everything, so REMAINING counts the ids this run did not render
// (a slice that hit its time budget must not report 0). Keep --force lists to one slice (~18 dev plates).
const remaining = force && !dry ? ids.filter(id => !rendered.has(id)).length : ids.filter(id => !fs.existsSync(path.join(masters, id + '.png'))).length;
console.log('REMAINING ' + remaining);
if (failed.length) process.exitCode = 1;
