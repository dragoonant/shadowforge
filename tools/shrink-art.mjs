// Delivery encodes with ffmpeg (libwebp), kb/ASSET-PIPELINE.md §4:
//   cards: art/masters/<id>.png    -> art/cards/<id>.webp  bottom 5% cropped (the model signs there), 560 px wide, q88
//   ui:    art/masters/ui/<id>.png -> art/ui/<id>.webp     1600 px wide, q85
// Skips a delivery file newer than its master (use --force to redo all). Masters never enter the repo.
// Never run this while gen-art is rendering the same ids (LESSONS-DIGEST §8).
//   node tools/shrink-art.mjs [--force] [--only id[,id]]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const oi = process.argv.indexOf('--only'); const only = oi < 0 ? null : process.argv[oi + 1].split(',');
const jobs = [
  { src: 'art/masters', dst: 'art/cards', vf: 'crop=iw:trunc(ih*0.95/2)*2:0:0,scale=560:-2:flags=lanczos', q: '88' },
  { src: 'art/masters/ui', dst: 'art/ui', vf: 'scale=1600:-2:flags=lanczos', q: '85' },
];
let n = 0, kept = 0, bytes = 0;
for (const j of jobs) {
  const src = path.join(ROOT, j.src), dst = path.join(ROOT, j.dst);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src).filter(f => f.endsWith('.png')).sort()) {
    const id = f.slice(0, -4); if (only && !only.includes(id)) continue;
    const inF = path.join(src, f), outF = path.join(dst, id + '.webp');
    if (!force && fs.existsSync(outF) && fs.statSync(outF).mtimeMs >= fs.statSync(inF).mtimeMs) { kept++; bytes += fs.statSync(outF).size; continue; }
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', inF, '-vf', j.vf, '-c:v', 'libwebp', '-quality', j.q, '-compression_level', '6', outF]);
    n++; bytes += fs.statSync(outF).size;
  }
}
console.log('shrink-art: ' + n + ' written, ' + kept + ' up to date, ' + (bytes / 1048576).toFixed(1) + ' MB delivered');
