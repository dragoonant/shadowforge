// Renders every card plate in GPU-sharing slices (kb/LORCANA-LESSONS.md "GPU reservation lock"):
// take the lock, render for at most 10 minutes (yielding if another session's GPU job appears),
// release, pause briefly so another session can claim the GPU, repeat until nothing remains.
//   node tools/art/render-slices.mjs [--set cards] [--slice 600]
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { otherGpuJobs, takeLock, releaseLock, lockHeldByOther } from './gpu.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const set = arg('set', 'cards'), slice = arg('slice', '600');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let n = 1; ; n++) {
  if (lockHeldByOther() || otherGpuJobs()) { console.log('render-slices: GPU busy elsewhere; waiting 60 s'); await sleep(60000); continue; }
  takeLock();
  let out = '';
  try { out = execFileSync(process.execPath, ['tools/gen-art.mjs', '--set', set, '--yield', '--lock', '--max-seconds', slice], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  finally { releaseLock(); }
  const rem = +((out.match(/REMAINING (\d+)/) || [])[1] ?? -1);
  console.log(`slice ${n}: ${(out.match(/(\d+) planned\/rendered/) || [])[1] || 0} rendered, remaining ${rem}`);
  if (rem === 0) break;
  if (rem < 0) { console.log(out.slice(-800)); break; }
  await sleep(20000);
}
