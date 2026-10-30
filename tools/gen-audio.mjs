// Generates SFX (Stable Audio Open 1.0) and music (ACE-Step 1.5 turbo, instrumental) through the local
// Audio Studio (PLAN.md D11; http://localhost:7890 or AUDIO_STUDIO_URL). Ported from
// wh40k-murder-squad/tools/gen-audio.ts, with ffmpeg doing every decode and the MP3 encode.
//   node tools/gen-audio.mjs [--kind sfx|music] [--only id[,id]] [--force] [--dry-run] [--batch N] [--list]
//                            [--repick]  (re-score the takes already in audio/masters; no studio)
//                            [--yield] [--lock] [--max-seconds S]   (GPU-sharing slice mode, tools/art/gpu.mjs)
// Per id: POST /api/jobs -> poll -> download every take (FLAC) into audio/masters/<kind>/<id>/ (gitignored)
// -> decode mono 44.1 kHz -> score takes -> keep the best -> trim leading (and trailing) silence ->
// fade-out 12% of the clip, 15-250 ms (SFX) / 120 ms (music) or a 1.5 s equal-power loop crossfade -> peak -1 dBFS ->
// MP3 128 kbps mono -> audio/<kind>/<id>.mp3. Playback gain toward RMS 0.16 (SFX) / 0.10 (music),
// capped at 1.0 so playback never clips, goes to audio/gains.json (read by write-manifest.mjs).
// Takes are chosen by numbers only (crest factor, length, silence); NOT VERIFIED BY EAR.
// Idempotent: an id whose MP3 exists is skipped. Wait caps: 3 min running, 10 min queued, one retry.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { otherGpuJobs, touchLock } from './art/gpu.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STUDIO = (process.env.AUDIO_STUDIO_URL || 'http://localhost:7890').replace(/\/$/, '');
const SR = 44100, PEAK = Math.pow(10, -1 / 20);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const dry = process.argv.includes('--dry-run'), force = process.argv.includes('--force');
const kindArg = arg('kind', null), only = arg('only', null), batchArg = +arg('batch', 4);
const yieldGpu = process.argv.includes('--yield'), useLock = process.argv.includes('--lock'), maxSec = +arg('max-seconds', 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- the list
const NEG = 'music, melody, voice, speech, talking, singing, crowd, reverb wash, hiss, static noise, distortion';
const NEG_MUSICAL = 'voice, speech, talking, lyrics, crowd, hiss, static noise, distortion, drums';
// [id, prompt, seconds, targetCrest, negative?, opts?]
const SFX = [
  ['card-draw', 'a single playing card slid quickly off the top of a deck, crisp dry paper swish and snap, close up', 1, 8, NEG, { len: 0.45 }],
  ['card-play', 'a stiff playing card slapped down firmly onto a stone table with a deep magical thrum, close up, dry', 1.5, 8, NEG, { len: 0.6 }],
  ['spell', 'a quick arcane spell cast, crackling energy gathering and a sharp bright magical release, short', 1.5, 5],
  ['amulet', 'a heavy enchanted stone talisman set down with a resonant low hum and a soft glow chime', 1.5, 6],
  ['evolve', 'a dramatic magical transformation, swirling rising energy surge ending in a bright powerful burst and crystal shimmer', 2.5, 4],
  ['super-evolve', 'an enormous magical power surge, roaring rising energy, thunderous crack and a radiant shimmering explosion', 3, 4],
  ['attack', 'a fast sword slash whoosh with a heavy swing, close up, dry', 1, 8, NEG, { len: 0.5 }],
  ['clash', 'two blades clashing hard with a ringing metallic impact, single heavy clang, close up', 1.5, 9],
  ['damage', 'a heavy dull punch impact thud with a short crunch, close up, dry', 1, 10, NEG, { len: 0.45 }],
  ['leader-hit', 'a deep heavy magical impact boom with a cracking shatter of a protective barrier, close up', 1.5, 8],
  ['destroy', 'a magical creature shattering into dark glass shards and dissolving into drifting embers, short', 2, 5],
  ['banish', 'a figure pulled into a void, a deep reversed whoosh imploding into silence with a faint sparkle', 2, 5],
  ['fanfare', 'a short bright brass and chime flourish announcing an arrival, magical, instrumental', 2, 4, NEG_MUSICAL],
  ['last-words', 'a soft ghostly sigh of wind with a fading mournful chime, eerie and brief', 2, 4, NEG_MUSICAL],
  ['quick', 'a sudden sharp magical interception, quick snapping zip and a bright crack, short', 1, 7],
  ['ward', 'a heavy magical shield barrier raised, solid low thrum and a crystalline ring', 1.5, 6],
  ['heal', 'a gentle warm holy healing shimmer, soft rising sparkles and a calm glowing tone', 2, 4],
  ['engage', 'a quick soft cloth swish of a card being turned sideways on felt, short dry', 1, 8, NEG, { len: 0.35 }],
  ['refresh', 'a bright soft rising sparkle shimmer, short magical twinkle', 1, 6],
  ['token', 'a small magical summoning pop with a puff of sparkles, light and short', 1, 6],
  ['evo-point', 'a bright crystal gem charged with energy, rising glassy ping and hum, short', 1.5, 5],
  ['shuffle', 'a deck of playing cards being riffle shuffled and bridged, crisp paper fluttering, close up', 2, 5],
  ['mulligan', 'a few playing cards swept back into a deck and tapped square on a table, short paper rustle', 1.5, 6],
  ['turn-start', 'a deep resonant gong-like bell announcing a new turn, magical shimmer tail', 2, 5, NEG_MUSICAL],
  ['discard', 'a playing card tossed onto a pile of cards, light paper flick and soft slide, close up', 1, 7, NEG, { len: 0.4 }],
  ['click', 'a single short soft wooden button click, ui sound, dry, very short', 1, 12, NEG, { len: 0.1 }],
  ['hover', 'a tiny soft high tick, very short and subtle ui sound, dry', 1, 10, NEG, { len: 0.08 }],
  ['error', 'a soft low muted wooden bonk, gentle error sound, short and dry', 1, 8, NEG, { len: 0.3 }],
  ['victory-sting', 'a short triumphant orchestral fanfare flourish with brass, choir-like synth pad and bells, heroic ending', 4, 4, NEG_MUSICAL.replace(', drums', '')],
  ['defeat-sting', 'a short dark descending orchestral phrase on low strings and a distant bell, somber ending', 4, 4, NEG_MUSICAL],
  ['ambience', 'calm ancient arena ambience at night, soft wind over stone, distant fire crackle, faint magical hum', 20, 3, 'music, melody, voice, speech, talking, singing, traffic, hiss', { loop: true }],
];
// One byte-identical musical brief across every track (LESSONS-DIGEST §6), then a short per-track mood.
const BRIEF = 'epic dark fantasy orchestral score for a magical card battle, strings, brass, choir-like synth pads, harp, taiko and orchestral percussion, sweeping and dramatic, Japanese game soundtrack style, cinematic, instrumental';
const MUSIC = [
  { id: 'menu', mood: 'majestic inviting main theme, noble and mysterious, a sense of grand adventure', duration: 60, bpm: 90, key: 'D minor', timesig: '4', loop: true },
  { id: 'battle-1', mood: 'poised and strategic, steady pulse, restrained tension', duration: 90, bpm: 100, key: 'A minor', timesig: '4', loop: true },
  { id: 'battle-2', mood: 'rising tension, driving rhythm, building momentum, heroic and dangerous', duration: 90, bpm: 120, key: 'E minor', timesig: '4', loop: true },
  { id: 'battle-3', mood: 'climactic final clash, full orchestra, pounding drums, urgent and overwhelming', duration: 90, bpm: 140, key: 'D minor', timesig: '4', loop: true },
  { id: 'victory', mood: 'triumphant glorious fanfare, bright brass and choir, celebratory ending', duration: 15, bpm: 120, key: 'D major', timesig: '4', loop: false },
  { id: 'defeat', mood: 'somber lament, slow strings, fading ending', duration: 15, bpm: 60, key: 'D minor', timesig: '4', loop: false },
];
const ITEMS = [
  ...SFX.map(([id, prompt, seconds, crest, negative, opts]) => ({ kind: 'sfx', id, prompt, seconds, crest, negative: negative || NEG, ...(opts || {}) })),
  ...MUSIC.map(m => ({ kind: 'music', ...m, prompt: BRIEF + ', ' + m.mood })),
];
function seedOf(id) { let h = 2166136261; for (const ch of 'audio:' + id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483647; }
function params(it) {
  if (it.kind === 'sfx') return { mode: 'sfx', prompt: it.prompt, negative: it.negative, seconds: Math.max(1, it.seconds + (it.loop ? 0 : 0.5)), steps: 50, guidance: 5, batch: Math.min(4, Math.max(1, batchArg)), seed: seedOf(it.id) };
  return { mode: 'music', prompt: it.prompt, lyrics: '[Instrumental]', duration: it.duration + (it.loop ? 4 : 2), steps: 8, bpm: it.bpm, key: it.key, timesig: it.timesig, language: 'en', batch: 2, seed: seedOf(it.id) };
}

// ---------------------------------------------------------------- studio
async function postJob(p) {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(STUDIO + '/api/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) });
    if ([409, 429, 503].includes(r.status)) { await sleep(5000); continue; }
    const j = await r.json(); if (!r.ok) throw new Error('POST /api/jobs ' + r.status + ' ' + (j.error || '')); return j;
  }
  throw new Error('studio stayed busy');
}
async function waitJob(id) {
  const q0 = Date.now(); let r0 = 0;
  for (;;) {
    await sleep(1500);
    const j = await (await fetch(STUDIO + '/api/jobs/' + id)).json();
    if (j.status === 'done') return j;
    if (j.status === 'failed' || j.status === 'cancelled') throw new Error('job ' + j.status + ': ' + (j.error || (j.log || []).slice(-2).join(' | ')));
    if (j.status === 'running') { if (!r0) r0 = Date.now(); if (Date.now() - r0 > 3 * 60 * 1000) { await fetch(STUDIO + '/api/jobs/' + id + '/cancel', { method: 'POST' }).catch(() => {}); throw new Error('running > 3 min, cancelled'); } }
    else if (Date.now() - q0 > 10 * 60 * 1000) { await fetch(STUDIO + '/api/jobs/' + id + '/cancel', { method: 'POST' }).catch(() => {}); throw new Error('queued > 10 min, cancelled'); }
  }
}
async function runJob(it) {
  for (let attempt = 1; ; attempt++) {
    try {
      const j = await waitJob((await postJob(params(it))).id);
      const files = [];
      for (const name of j.audios || []) { const r = await fetch(STUDIO + '/files/' + j.id + '/' + name); if (!r.ok) throw new Error('download ' + name + ' ' + r.status); files.push({ name, buf: Buffer.from(await r.arrayBuffer()) }); }
      if (!files.length) throw new Error('job returned no audio');
      return { job: j.id, files };
    } catch (e) { if (attempt >= 2) throw e; console.log('  ' + it.id + ': ' + e.message + '; retrying once'); await sleep(/restart/i.test(e.message) ? 15000 : 3000); }
  }
}

// ---------------------------------------------------------------- dsp
function ff(args, input) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-v', 'error', ...args]); const out = []; let err = '';
    p.stdout.on('data', c => out.push(c)); p.stderr.on('data', c => { err += c; }); p.on('error', rej);
    p.on('exit', code => code === 0 ? res(Buffer.concat(out)) : rej(new Error('ffmpeg ' + code + ' ' + err.slice(0, 200))));
    if (input) p.stdin.end(input); else p.stdin.end();
  });
}
async function decode(buf) { const b = await ff(['-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'], buf); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
async function encodeMp3(pcm, out) { await ff(['-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '128k', '-ac', '1', '-ar', String(SR), '-y', out], Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)); }
const peakOf = p => { let m = 0; for (const v of p) { const a = Math.abs(v); if (a > m) m = a; } return m; };
const rmsOf = p => { let s = 0; for (const v of p) s += v * v; return Math.sqrt(s / Math.max(1, p.length)); };
function trimLead(p) { const thr = Math.max(0.0015, peakOf(p) * 0.003); let i = 0; while (i < p.length && Math.abs(p[i]) < thr) i++; return p.subarray(Math.max(0, i - Math.round(SR * 0.005))); }
// Trailing trim on a short-window RMS envelope (-45 dB re peak), keeping 60 ms of tail.
function trimTail(p) { const w = Math.round(SR * 0.02), thr = Math.max(0.001, peakOf(p) * 0.0056); let end = p.length; for (let i = p.length - w; i > 0; i -= w) { if (rmsOf(p.subarray(i, i + w)) > thr) { end = i + w; break; } } return p.subarray(0, Math.min(p.length, end + Math.round(SR * 0.06))); }
// For loops: trim to the sustained body by RMS envelope (first/last 0.5 s window above -24 dB re median).
function body(p) { const w = Math.round(SR * 0.5), env = []; for (let i = 0; i + w <= p.length; i += w) env.push(rmsOf(p.subarray(i, i + w))); const med = [...env].sort((a, b) => a - b)[env.length >> 1] || 0, thr = med * 0.063; let a = 0, b = env.length - 1; while (a < b && env[a] < thr) a++; while (b > a && env[b] < thr) b--; return p.subarray(a * w, (b + 1) * w); }
function fadeOut(p, ms) { const o = Float32Array.from(p), n = Math.min(o.length, Math.round(SR * ms / 1000)); for (let i = 0; i < n; i++) o[o.length - 1 - i] *= i / n; return o; }
function fadeIn(p, ms) { const o = Float32Array.from(p), n = Math.min(o.length, Math.round(SR * ms / 1000)); for (let i = 0; i < n; i++) o[i] *= i / n; return o; }
function makeLoop(p, sec = 1.5) { const xf = Math.min(Math.round(SR * sec), Math.floor(p.length / 3)), n = p.length - xf, o = new Float32Array(n); o.set(p.subarray(0, n)); for (let i = 0; i < xf; i++) { const t = i / xf; o[i] = p[i] * Math.sin(t * Math.PI / 2) + p[n + i] * Math.cos(t * Math.PI / 2); } return o; }
function silentFrac(p) { const w = Math.round(SR * 0.25); let s = 0, n = 0; const pk = peakOf(p); for (let i = 0; i + w <= p.length; i += w, n++) if (rmsOf(p.subarray(i, i + w)) < pk * 0.01) s++; return n ? s / n : 1; }
function envVar(p) { const w = Math.round(SR * 1), env = []; for (let i = 0; i + w <= p.length; i += w) env.push(rmsOf(p.subarray(i, i + w))); const m = env.reduce((a, b) => a + b, 0) / Math.max(1, env.length); return m ? Math.sqrt(env.reduce((a, b) => a + (b - m) ** 2, 0) / env.length) / m : 9; }
function process1(pcm, it) {
  let p = trimLead(pcm);
  if (it.kind === 'sfx' && !it.loop) p = trimTail(p);
  if (it.loop) { p = body(p); p = makeLoop(p); }
  else p = fadeIn(fadeOut(p, it.kind === 'music' ? 120 : Math.max(15, Math.min(250, p.length / SR * 120))), 2);
  if (it.kind === 'music' && !it.loop) p = fadeOut(trimTail(p), 400);
  const pk = peakOf(p); if (pk > 0) { const g = PEAK / pk; p = p.map(v => v * g); }
  return p;
}
function score(p, it) {
  const pk = peakOf(p), r = rmsOf(p), crest = r ? pk / r : 99, len = p.length / SR;
  if (it.kind === 'sfx') {
    const target = it.loop ? it.seconds : it.seconds;
    let s = Math.abs(Math.log(crest / it.crest)) + 0.6 * Math.abs(Math.log(Math.max(0.03, len) / (it.len || Math.max(0.3, target * 0.7))));
    if (crest < 2.2) s += 3; if (len < Math.min(0.06, (it.len || 1) * 0.5)) s += 5; if (pk < 0.01) s += 9;
    return { s, crest, len };
  }
  return { s: silentFrac(p) * 4 + envVar(p) + Math.abs(len - it.duration) / it.duration, crest, len };
}

// ---------------------------------------------------------------- main
const gainsPath = path.join(ROOT, 'audio/gains.json'), logPath = path.join(ROOT, 'audio/masters/gen-log.json');
const gains = fs.existsSync(gainsPath) ? JSON.parse(fs.readFileSync(gainsPath, 'utf8')) : {};
const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : {};
let items = ITEMS.filter(it => !kindArg || it.kind === kindArg);
if (only) { const w = only.split(','); for (const x of w) if (!items.some(i => i.id === x)) { console.log('gen-audio: unknown id ' + x); process.exit(2); } items = items.filter(i => w.includes(i.id)); }
if (process.argv.includes('--list')) { for (const it of ITEMS) console.log(it.kind + '/' + it.id + ': ' + it.prompt); process.exit(0); }
const repick = process.argv.includes('--repick');
let made = 0, skipped = 0; const failed = []; const t0 = Date.now();
for (const it of items) {
  const outDir = path.join(ROOT, 'audio', it.kind), out = path.join(outDir, it.id + '.mp3');
  const mdirR = path.join(ROOT, 'audio/masters', it.kind, it.id);
  if (repick && !fs.existsSync(mdirR)) { skipped++; continue; }
  if (!repick && !force && fs.existsSync(out) && fs.statSync(out).size) { skipped++; continue; }
  if (maxSec && (Date.now() - t0) / 1000 > maxSec) { console.log('[gen-audio] slice time budget reached'); break; }
  if (!dry && yieldGpu && otherGpuJobs()) { console.log('[gen-audio] another session started a GPU job; yielding'); break; }
  if (useLock) touchLock();
  if (dry) { console.log('[dry-run] ' + it.kind + '/' + it.id + ' ' + JSON.stringify(params(it))); made++; continue; }
  const t1 = Date.now();
  try {
    const { job, files } = repick ? { job: (log[it.kind + '/' + it.id] || {}).job, files: fs.readdirSync(mdirR).filter(f => /^take-\d+\./.test(f)).sort().map(f => ({ name: f, buf: fs.readFileSync(path.join(mdirR, f)) })) } : await runJob(it);
    const mdir = path.join(ROOT, 'audio/masters', it.kind, it.id); fs.mkdirSync(mdir, { recursive: true });
    let best = null; const takes = [];
    for (const [i, f] of files.entries()) {
      if (!repick) fs.writeFileSync(path.join(mdir, 'take-' + i + path.extname(f.name)), f.buf);
      const p = process1(await decode(f.buf), it), sc = score(p, it);
      takes.push({ take: i, score: +sc.s.toFixed(3), crest: +sc.crest.toFixed(2), seconds: +sc.len.toFixed(2) });
      if (!best || sc.s < best.sc.s) best = { i, p, sc };
    }
    fs.mkdirSync(outDir, { recursive: true });
    await encodeMp3(best.p, out);
    const r = rmsOf(best.p), target = it.kind === 'sfx' ? 0.16 : 0.10;
    gains[it.kind + '/' + it.id] = { gain: +Math.min(1, Math.max(0.2, target / Math.max(1e-4, r))).toFixed(3), rms: +r.toFixed(4), loop: !!it.loop };
    log[it.kind + '/' + it.id] = { job, take: best.i, takes, seconds: +(best.p.length / SR).toFixed(2), wall: +((Date.now() - t1) / 1000).toFixed(1), seed: seedOf(it.id), at: new Date().toISOString() };
    fs.writeFileSync(gainsPath, JSON.stringify(gains, null, 1) + '\n');
    fs.mkdirSync(path.dirname(logPath), { recursive: true }); fs.writeFileSync(logPath, JSON.stringify(log, null, 1) + '\n');
    made++;
    console.log('[gen-audio] ' + it.kind + '/' + it.id + ': take ' + best.i + '/' + files.length + ', ' + (best.p.length / SR).toFixed(2) + ' s, crest ' + best.sc.crest.toFixed(1) + ', gain ' + gains[it.kind + '/' + it.id].gain + ', ' + ((Date.now() - t1) / 1000).toFixed(0) + ' s wall');
  } catch (e) { failed.push(it.id); console.log('[gen-audio] FAILED ' + it.id + ': ' + e.message); }
}
console.log('[gen-audio] ' + (dry ? 'dry-run: ' : '') + made + ' made, ' + skipped + ' present, ' + failed.length + ' failed' + (failed.length ? ' [' + failed.join(', ') + ']' : '') + ', ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s. Not verified by ear.');
console.log('REMAINING ' + items.filter(it => !fs.existsSync(path.join(ROOT, 'audio', it.kind, it.id + '.mp3'))).length);
if (failed.length) process.exitCode = 1;
