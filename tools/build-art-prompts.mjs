// Builds tools/art/art-prompts.json: one prompt per card in data/cards.js plus the UI plates.
// PLAN.md D16 (audition row B). Card prompt = [name + desc | subject] + act + set + class accent +
// STYLE. The per-card table lives in tools/art/cards-*.mjs (one file per writer, merged here; an id
// defined twice fails). A card with no entry fails: there is no generic fallback (KB §3.2).
//   card entry: { desc, act, set }            a character: desc = who they are and how they look
//               { like: '<card no>', act, set }  same character as another card (evolved forms)
//               { subject, set }              a spell/amulet/object/scene
//               optional: name (the character's name to lead the prompt; never the card's title
//               with its epithet), allow: [text-magnet words the subject can't avoid]
// The lint REFUSES to write the file on any violation (kb/LESSONS-DIGEST.md §8) and lints STYLE too:
// text-magnet nouns, negations, counts above two, franchise/studio/game names, > 900 chars.
//   node tools/build-art-prompts.mjs            # lint + write
//   node tools/build-art-prompts.mjs --selftest # prove the lint bites
//   node tools/build-art-prompts.mjs --show <id>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STYLE, UI_STYLE, MODEL, CLASS_ACCENT } from './art/style.mjs';
import { UI, UI_EMPTY } from './art/ui.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools/art/art-prompts.json');
globalThis.SV = globalThis.SV || {};
await import(pathToFileURL(path.join(ROOT, 'data/cards.js')).href);
const C = globalThis.SV.CARDS;

const CARDS = {};
const dupes = [];
for (const f of fs.readdirSync(path.join(ROOT, 'tools/art')).filter((f) => /^cards-.*\.mjs$/.test(f)).sort()) {
  const m = await import(pathToFileURL(path.join(ROOT, 'tools/art', f)).href);
  for (const [id, e] of Object.entries(m.CARDS)) { if (CARDS[id]) dupes.push(`${id} defined in two files`); CARDS[id] = e; }
}

const MAGNETS = ['sign', 'signs', 'signpost', 'banner', 'banners', 'book', 'books', 'spellbook', 'tome', 'tomes', 'grimoire', 'scroll', 'scrolls', 'letter', 'letters', 'lettering', 'label', 'labels', 'logo', 'logos', 'emblem', 'emblems', 'crest', 'crests', 'map', 'maps', 'screen', 'screens', 'monitor', 'poster', 'posters', 'cover', 'title', 'titles', 'page', 'pages', 'flag', 'flags', 'insignia', 'text', 'word', 'words', 'newspaper', 'glyph', 'glyphs', 'rune', 'runes', 'runic', 'plaque', 'inscription', 'inscribed', 'writing', 'written', 'calligraphy', 'card', 'cards', 'frame', 'library', 'menu', 'caption', 'signature', 'chalkboard', 'note', 'notes', 'contract', 'manuscript', 'parchment', 'alphabet', 'typography', 'font', 'watermark', 'clock', 'billboard', 'tarot', 'hologram', 'interface', 'hud', 'number', 'numbers', 'numeral', 'numerals'];
const NEGATIONS = ['no', 'not', 'never', 'without', 'lack', 'lacking', 'none', 'nothing', 'nobody', 'nor', 'neither', 'cannot', 'cant', 'dont', 'isnt', 'doesnt', 'wont'];
const COUNTS = ['three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'twenty', 'thirty', 'hundred', 'hundreds', 'thousand', 'dozen', 'dozens', 'trio', 'triple', 'quartet', 'third', 'quarter'];
const TITLES = ['shadowverse', 'cygames', 'bushiroad', 'evolve', 'umamusume', 'vanguard', 'cardfight', 'idolmaster', 'priconne', 'granblue', 'rage', 'artstation', 'pixiv', 'disney', 'pixar', 'ghibli', 'marvel', 'pokemon'];
const TITLE_PHRASES = ['pretty derby', 'princess connect', 'cinderella girls', 'worlds beyond', 'card frame', 'three quarter'];
// "card game illustration" in STYLE was auditioned (art/audition.jpg row B): no frames or lettering.
const STYLE_ALLOW = ['card'];
const norm = (s) => ' ' + s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
const BANNED = new Map();
for (const w of MAGNETS) BANNED.set(w, 'text magnet');
for (const w of NEGATIONS) BANNED.set(w, 'negation');
for (const w of COUNTS) BANNED.set(w, 'count above two');
for (const w of TITLES) BANNED.set(w, 'franchise/studio/game name');
function lintText(what, text, problems, allow = []) {
  const n = norm(text);
  for (const w of n.trim().split(' ')) {
    if (BANNED.has(w) && !allow.includes(w)) problems.push(`${what}: "${w}" (${BANNED.get(w)})`);
    if (/^\d+$/.test(w) && +w > 2) problems.push(`${what}: "${w}" (count above two)`);
  }
  for (const p of TITLE_PHRASES) if (n.includes(' ' + p + ' ')) problems.push(`${what}: "${p}" (title phrase)`);
  if (/\bn['’]t\b/i.test(text)) problems.push(`${what}: contraction negation`);
}

export function buildAll() {
  const problems = [...dupes];
  lintText('STYLE', STYLE, problems, STYLE_ALLOW); lintText('UI_STYLE', UI_STYLE, problems, STYLE_ALLOW); lintText('UI_EMPTY', UI_EMPTY, problems);
  const prompts = {};
  const resolve = (id, seen = []) => {
    const e = CARDS[id];
    if (!e) return null;
    if (e.like) { if (seen.includes(id)) return null; const b = resolve(e.like, [...seen, id]); return b ? { ...b, ...e, desc: b.desc, name: e.name || b.name } : null; }
    return e;
  };
  for (const id of Object.keys(C).sort()) {
    const c = C[id];
    if (c.type === 'leader' && !CARDS[id]) { problems.push(id + ': leader needs an entry (the portrait)'); continue; }
    const e = resolve(id);
    if (!e) { problems.push(id + ' ' + c.name + ': no entry (or a broken `like`) in tools/art/cards-*.mjs'); continue; }
    const allow = e.allow || [];
    let lead;
    if (e.desc) {
      if (!e.act || !e.set) { problems.push(id + ': a character needs act + set'); continue; }
      lead = (e.name ? e.name + ', ' : '') + e.desc + ', ' + e.act + ', ' + e.set;
    } else if (e.subject && e.set) lead = e.subject + ', ' + e.set;
    else { problems.push(id + ': needs desc+act+set or subject+set'); continue; }
    if (e.name && c.name.includes(',') && e.name === c.name) problems.push(id + ': `name` must be the character, not the card title with its epithet');
    const accent = CLASS_ACCENT[c.cls] || CLASS_ACCENT.neutral;
    const prompt = lead + ', ' + accent + ', ' + STYLE;
    lintText(id, lead, problems, allow);
    if (prompt.length > 900) problems.push(id + ': prompt ' + prompt.length + ' chars (> 900)');
    prompts[id] = { name: c.name, model: MODEL, aspect: '2:3', megapixels: 1, prompt, ...(allow.length ? { allow } : {}) };
  }
  for (const id of Object.keys(CARDS)) if (!C[id]) problems.push(id + ': entry for an id that is not in data/cards.js');
  const ui = {};
  for (const [id, e] of Object.entries(UI)) {
    lintText('ui ' + id, e.subject + ' ' + e.set, problems);
    const prompt = e.subject + ', ' + e.set + ', ' + (e.empty ? UI_EMPTY + ', ' : '') + UI_STYLE;
    if (prompt.length > 900) problems.push('ui ' + id + ': prompt too long');
    ui[id] = { name: id, model: MODEL, aspect: '16:9', megapixels: 2, prompt };
  }
  return { problems, prompts, ui };
}

if (process.argv.includes('--selftest')) {
  const bad = ['a sign over the door', 'there is no light', 'three wolves', 'a girl in the style of shadowverse', 'a spellbook', 'it isn\'t here', '7 stars', 'a glowing rune circle', 'a tarot card', 'princess connect heroine'];
  let ok = true;
  for (const t of bad) { const p = []; lintText('t', t, p); if (!p.length) { ok = false; console.log('selftest: lint MISSED "' + t + '"'); } }
  { const p = []; lintText('t', 'a red tome', p, ['tome']); if (p.length) { ok = false; console.log('selftest: allow list ignored'); } }
  for (const t of ['Arisa, a young elf archer with long blonde hair drawing a longbow', STYLE, UI_STYLE]) { const p = []; lintText('t', t, p, STYLE_ALLOW); if (p.length) { ok = false; console.log('selftest: false positive ' + p.join('; ')); } }
  console.log(ok ? `selftest: lint bites (${bad.length} bad strings refused, allow list and clean strings pass)` : 'selftest: FAILED');
  process.exit(ok ? 0 : 1);
}

const { problems, prompts, ui } = buildAll();
const show = process.argv.indexOf('--show');
if (show >= 0) { const id = process.argv[show + 1]; console.log((prompts[id] || ui[id] || {}).prompt || 'no such id'); }
if (problems.length) { console.log('art-prompts: REFUSED to write - ' + problems.length + ' problem(s)\n  ' + problems.slice(0, 60).join('\n  ')); process.exit(1); }
fs.writeFileSync(OUT, JSON.stringify({ style: STYLE, uiStyle: UI_STYLE, model: MODEL, prompts, ui }, null, 1));
const lens = Object.values(prompts).map((p) => p.prompt.length);
console.log('art-prompts: lint clean; ' + Object.keys(prompts).length + ' card prompts + ' + Object.keys(ui).length + ' UI prompts (model ' + MODEL + '; length ' + Math.min(...lens) + '-' + Math.max(...lens) + ')');
