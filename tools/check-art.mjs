// Asset gate (LESSONS-DIGEST §8): every card id in data/cards.js must have a manifest entry whose file
// exists with the exact case, is non-empty, is a real WebP (RIFF....WEBP) of a sane size, and every
// manifest entry must point at a known card. Also checks UI plates and the audio manifest (MP3 magic).
// Exit 1 on any problem.   node tools/check-art.mjs [--allow-missing]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowMissing = process.argv.includes('--allow-missing');
globalThis.LC = globalThis.LC || {};
await import(pathToFileURL(path.join(ROOT, 'data/cards.js')).href);
await import(pathToFileURL(path.join(ROOT, 'data/art-manifest.js')).href);
const audioMan = path.join(ROOT, 'data/audio-manifest.js');
if (fs.existsSync(audioMan)) await import(pathToFileURL(audioMan).href);
const { CARDS, ART, AUDIO } = globalThis.LC;
const bad = [];
const UI_EXPECTED = ['title', 'board-forest', 'board-courtyard', 'board-cavern', 'board-harbour', 'deck-chooser', 'victory', 'defeat'];
function head(f, n) { const b = Buffer.alloc(n); const fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, n, 0); fs.closeSync(fd); return b; }
function checkFile(label, rel, kind, minB, maxB) {
  if (typeof rel !== 'string' || rel.startsWith('/') || rel.includes('\\')) return bad.push(label + ': bad path ' + rel);
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) return bad.push(label + ': missing ' + rel);
  if (!fs.readdirSync(path.dirname(f)).includes(path.basename(f))) return bad.push(label + ': case mismatch ' + rel);
  const sz = fs.statSync(f).size;
  if (!sz) return bad.push(label + ': empty ' + rel);
  if (sz < minB || sz > maxB) bad.push(label + ': size ' + sz + ' B outside ' + minB + '..' + maxB + ' ' + rel);
  const h = head(f, 12);
  if (kind === 'webp' && !(h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WEBP')) bad.push(label + ': not a WebP ' + rel);
  if (kind === 'mp3' && !(h.toString('ascii', 0, 3) === 'ID3' || (h[0] === 0xFF && (h[1] & 0xE0) === 0xE0))) bad.push(label + ': not an MP3 ' + rel);
}
if (!ART || !ART.cards || !ART.ui) bad.push('data/art-manifest.js does not define LC.ART.cards / LC.ART.ui');
else {
  for (const id of Object.keys(CARDS)) {
    if (!ART.cards[id]) { if (!allowMissing) bad.push(id + ': no art in manifest'); continue; }
    if (ART.cards[id] !== 'art/cards/' + id + '.webp') bad.push(id + ': unexpected path ' + ART.cards[id]);
    checkFile(id, ART.cards[id], 'webp', 8000, 400000);
  }
  for (const id of Object.keys(ART.cards)) if (!CARDS[id]) bad.push(id + ': manifest entry for unknown card');
  for (const u of UI_EXPECTED) if (!ART.ui[u]) { if (!allowMissing) bad.push('ui ' + u + ': missing'); } else checkFile('ui ' + u, ART.ui[u], 'webp', 20000, 1500000);
}
let nA = 0;
if (AUDIO) for (const kind of ['sfx', 'music']) for (const [id, e] of Object.entries(AUDIO[kind] || {})) {
  nA++; checkFile(kind + ' ' + id, e.src, 'mp3', 1000, kind === 'sfx' ? 600000 : 4000000);
  if (!(e.gain > 0 && e.gain <= 4)) bad.push(kind + ' ' + id + ': gain ' + e.gain);
}
if (bad.length) { console.log('check-art: ' + bad.length + ' problem(s)\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('check-art: clean (' + Object.keys(ART.cards).length + '/' + Object.keys(CARDS).length + ' cards, ' + Object.keys(ART.ui).length + ' ui, ' + nA + ' audio)');
