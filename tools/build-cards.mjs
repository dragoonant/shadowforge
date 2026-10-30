// Builds data/cards.js, data/decks.js and data/raw/decks.json from the pages that
// tools/fetch-cards.mjs saved in scratch/. Zero dependencies. Sources: docs/sources.md.
//   node tools/build-cards.mjs                 normal build
//   node tools/build-cards.mjs --strip-text    withdrawal lever (docs/takedown.md): placeholders
//                                              for every name, trait and text; numbers stay
// Writes scratch/qa.json (official Q&A per card, for card-script authors; never committed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURED } from './fetch-cards-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH = path.join(ROOT, 'scratch');
const STRIP = process.argv.includes('--strip-text');

const ent = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
  .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&hellip;/g, '…');
// Icons become their alt token ("[fanfare]"); <br> becomes a newline; everything else is text.
const rich = (h) => ent(h.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '$1').replace(/<br\s*\/?>/g, '\n')
  .replace(/<[^>]+>/g, '')).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');

function parseCard(no, t) {
  const box = t.slice(t.indexOf('cardlist-Detail_Box'), t.indexOf('detail-Pagenavi'));
  const name = rich((box.match(/<h1 class="ttl[^"]*">([\s\S]*?)<\/h1>/) || [])[1] || '');
  const info = {};
  for (const m of box.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)) info[rich(m[1])] = rich(m[2]);
  const stat = (k) => { const m = box.match(new RegExp(`heading-${k}">[^<]*</span>([^<]*)<`)); const v = m && m[1].trim(); return v && v !== '-' ? Number(v) : null; };
  const text = rich((box.match(/<div class="detail">([\s\S]*?)<\/div>/) || [])[1] || '');
  const speech = rich((box.match(/<div class="speech">([\s\S]*?)<\/div>/) || [])[1] || '');
  const typeLine = info['Card Type'] || '';
  const parts = typeLine.split('/').map((s) => s.trim().toLowerCase());
  const qa = [];
  for (const m of t.matchAll(/qa-List_Ttl[^>]*>(Q\d+) \(([^)]*)\)<\/div>\s*<p[^>]*qa-List_Txt-Q[^>]*><span[^>]*>Q<\/span>([\s\S]*?)<\/p>\s*<p[^>]*qa-List_Txt-A[^>]*><span[^>]*>A<\/span>([\s\S]*?)<\/p>/g))
    qa.push({ q: m[1], date: m[2], question: rich(m[3]), answer: rich(m[4]) });
  if (!name || !typeLine) throw new Error(`${no}: could not parse name/type`);
  return {
    no, name,
    cls: (info.Class || '').toLowerCase() || null,
    universe: info.Universe || null,
    type: parts[0],                         // follower | spell | amulet | leader
    evolved: parts.includes('evolved'),
    advanced: parts.includes('advanced'),
    token: parts.includes('token'),
    typeLine,
    traits: (info.Trait || '-') === '-' ? [] : info.Trait.split('/').map((s) => s.trim()),
    rarity: info.Rarity === '-' ? null : info.Rarity || null,
    set: info['Card Set'] || null,
    format: info.Format || null,
    cost: stat('Cost'), atk: stat('Power'), def: stat('Hp'),
    text, related: speech ? speech.split('\n') : [],
    qa,
  };
}

// ---- cards ----
const files = fs.readdirSync(path.join(SCRATCH, 'cards')).filter((f) => f.endsWith('.html'));
const all = {};
for (const f of files) {
  const no = f.slice(0, -5);
  all[no] = parseCard(no, fs.readFileSync(path.join(SCRATCH, 'cards', f), 'utf8'));
}

// ---- decks ----
const decks = [];
for (const slug of FEATURED) {
  const t = fs.readFileSync(path.join(SCRATCH, 'decks', `${slug}.html`), 'utf8');
  const re = /<p class="detail-Ttl icon-class (\w+)" id="deck_(\d+)">[\s\S]*?<\/span>([\s\S]*?)<\/p>([\s\S]*?)(?=<p class="detail-Ttl|$)/g;
  for (const m of t.matchAll(re)) {
    const [, cls, id, name, body] = m;
    const d = { id: `${slug.split('-')[0]}-${id}`, name: rich(name), cls, leader: null, main: [], evolve: [],
      source: { kind: 'featured', page: `https://en.shadowverse-evolve.com/decks/${slug}/`, fetched: '2026-10-29' } };
    const code = [...t.slice(0, m.index).matchAll(/decklog-en\.bushiroad\.com\/view\/(\w+)/g)].pop();
    if (code) d.source.decklog = code[1];
    for (const sec of body.split('<div class="detail-Heading">').slice(1)) {
      const key = /^Main/.test(sec) ? 'main' : /^Evolve/.test(sec) ? 'evolve' : /^Leader/.test(sec) ? 'leader' : null;
      if (!key) continue;
      for (const c of sec.matchAll(/cardno=([A-Z0-9-]+?EN)"[\s\S]*?<\/a>/g)) {
        const q = Number((c[0].match(/<span class="sheet">\D*(\d+)<\/span>/) || [])[1] || 1);
        if (key === 'leader') d.leader = c[1]; else d[key].push([c[1], q]);
      }
    }
    decks.push(d);
  }
}
for (const r of JSON.parse(fs.readFileSync(path.join(SCRATCH, 'tournament-resolved.json'), 'utf8'))) {
  decks.push({ id: r.id, name: r.name, cls: all[r.leader[0][0]].cls, leader: r.leader[0][0], main: r.main, evolve: r.evolve,
    source: { kind: 'tournament', event: r.event, place: r.place, date: r.date, player: r.player, archetype: r.archetype,
      page: 'https://www.tcgplayer.com/content/article/Shadowverse-Evolve-s-Best-Competitive-Decks-The-Grand-Showdown-2026-Winners/1ff7c7a5-1e26-4e58-b841-8a545b4557d8/',
      fetched: '2026-10-29' } });
}

// ---- reprints: one canonical card per (name, type line) ----
const rank = (no) => (/^BP/.test(no) ? 1 : /^(SD|SS)/.test(no) ? 2 : /^PR/.test(no) ? 4 : 3);
const used = new Set(decks.flatMap((d) => [d.leader, ...d.main.map((x) => x[0]), ...d.evolve.map((x) => x[0])]));
const groups = {};
for (const c of Object.values(all)) (groups[`${c.name}|${c.typeLine}`] ||= []).push(c.no);
const alias = {};
const problems = [];
for (const nos of Object.values(groups)) {
  nos.sort((a, b) => (used.has(b) - used.has(a)) || rank(a) - rank(b) || a.localeCompare(b));
  const canon = all[nos[0]];
  canon.prints = nos.slice();
  for (const o of nos.slice(1)) {
    const c = all[o];
    const norm = (s) => s.replace(/this card/g, 'this');
    if (norm(c.text) !== norm(canon.text) || c.cost !== canon.cost || c.atk !== canon.atk || c.def !== canon.def)
      problems.push(`reprint ${o} differs from ${canon.no} (${canon.name}); using ${canon.no}`);
    alias[o] = canon.no;
    delete all[o];
  }
}
const canon = (no) => alias[no] || no;
for (const d of decks) {
  d.leader = canon(d.leader);
  for (const k of ['main', 'evolve']) {
    const m = new Map();
    for (const [no, q] of d[k]) m.set(canon(no), (m.get(canon(no)) || 0) + q);
    d[k] = [...m];
  }
}

// ---- link evolved cards to their base (same name, a non-evolved follower in the pool) ----
const byName = {};
for (const c of Object.values(all)) (byName[c.name] ||= []).push(c.no);
for (const c of Object.values(all)) {
  if (!c.evolved) continue;
  const base = (byName[c.name] || []).filter((n) => !all[n].evolved && all[n].type === c.type);
  if (base.length === 1) c.base = base[0];
  else if (c.type === 'follower') problems.push(`evolved ${c.no} ${c.name}: ${base.length} base followers in the pool`);
}

// ---- validation (CR 6.1 deck construction; PLAN §5) ----
for (const d of decks) {
  const n = (k) => d[k].reduce((a, [, q]) => a + q, 0);
  const L = all[d.leader];
  if (!L || L.type !== 'leader') problems.push(`${d.id}: leader ${d.leader} is not a leader card`);
  if (n('main') < 40 || n('main') > 50) problems.push(`${d.id}: main deck ${n('main')} cards`);
  if (n('evolve') > 10) problems.push(`${d.id}: evolve deck ${n('evolve')} cards`);
  for (const k of ['main', 'evolve']) for (const [no, q] of d[k]) {
    const c = all[no];
    if (!c) { problems.push(`${d.id}: ${no} missing from scratch/cards`); continue; }
    if (q > 3 && !/any number of/i.test(c.text)) problems.push(`${d.id}: ${q}x ${c.name}`);
    const evoCard = c.evolved || c.advanced;
    if (k === 'main' && (evoCard || c.token || c.type === 'leader')) problems.push(`${d.id}: ${no} ${c.typeLine} in main deck`);
    if (k === 'evolve' && !evoCard) problems.push(`${d.id}: ${no} ${c.typeLine} in evolve deck`);
    if (L && c.cls !== 'neutral' && c.cls !== L.cls && !(c.universe && c.universe === L.universe))
      problems.push(`${d.id}: ${no} ${c.name} is ${c.cls}${c.universe ? '/' + c.universe : ''}, leader is ${L.cls}`);
  }
}

// ---- tokens by name, so scripts can say SV.token('Fairy') ----
const tokens = {};
for (const c of Object.values(all)) if (c.token) {
  if (tokens[c.name] && tokens[c.name] !== c.no) problems.push(`two tokens named ${c.name}: ${tokens[c.name]}, ${c.no}`);
  tokens[c.name] = c.no;
}

// ---- write ----
const qa = {};
for (const c of Object.values(all)) { if (c.qa.length) qa[c.no] = c.qa; delete c.qa; }
fs.writeFileSync(path.join(SCRATCH, 'qa.json'), JSON.stringify(qa, null, 1));
if (STRIP) for (const c of Object.values(all)) {
  c.name = `${c.type} ${c.no}`; c.text = c.text ? '(text withdrawn)' : ''; c.traits = []; c.related = [];
}
const stamp = `// GENERATED by tools/build-cards.mjs on ${new Date().toISOString().slice(0, 10)} — do not edit.\n` +
  `// Card names and text: Cygames, Inc. / Bushiroad (NOTICE.md). Withdrawal lever: docs/takedown.md.\n`;
const sorted = Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(ROOT, 'data/cards.js'), stamp +
  `(function (SV) {\n  SV.CARDS = ${JSON.stringify(sorted, null, 0).replace(/},"/g, '},\n"')};\n` +
  `  SV.CARD_ALIAS = ${JSON.stringify(alias)};\n  SV.TOKENS = ${JSON.stringify(tokens)};\n})(globalThis.SV);\n`);
fs.writeFileSync(path.join(ROOT, 'data/decks.js'), stamp +
  `(function (SV) {\n  SV.DECKS = ${JSON.stringify(decks, null, 1)};\n})(globalThis.SV);\n`);
fs.mkdirSync(path.join(ROOT, 'data/raw'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/raw/decks.json'), JSON.stringify(decks, null, 1));

const count = Object.values(all);
console.log(`${count.length} cards (${count.filter((c) => c.token).length} tokens, ${count.filter((c) => c.evolved).length} evolved, ` +
  `${count.filter((c) => c.type === 'leader').length} leaders), ${Object.keys(alias).length} reprints folded, ${decks.length} decks`);
for (const p of problems) console.log('PROBLEM ' + p);
process.exitCode = problems.some((p) => !p.startsWith('reprint')) ? 1 : 0;
