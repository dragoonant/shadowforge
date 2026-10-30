// Fetches the raw inputs for data/cards.js into the gitignored scratch/ folder. Zero dependencies.
//   node tools/fetch-cards.mjs              featured-deck pages + every card they list + related tokens
//   node tools/fetch-cards.mjs --force      re-download pages already in scratch/
// Sources and dates: docs/sources.md. Polite: one request at a time, 350 ms apart.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH = path.join(ROOT, 'scratch');
const SITE = 'https://en.shadowverse-evolve.com';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) shadowforge-fan-project' };
const FORCE = process.argv.includes('--force');
// The featured-deck pages that make up the pool (PLAN D5). Order = registration order.
export const FEATURED = ['bp1920-recommended-decks'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, file) {
  if (!FORCE && fs.existsSync(file) && fs.statSync(file).size > 1000) return fs.readFileSync(file, 'utf8');
  for (let tries = 0; ; tries++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) { const t = await r.text(); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, t); await sleep(350); return t; }
    if (tries >= 2) throw new Error(`${url}: HTTP ${r.status}`);
    await sleep(2000);
  }
}

const cardFile = (no) => path.join(SCRATCH, 'cards', `${no}.html`);
const queue = [];
const seen = new Set();
const want = (no) => { if (!seen.has(no)) { seen.add(no); queue.push(no); } };

for (const slug of FEATURED) {
  const html = await get(`${SITE}/decks/${slug}/`, path.join(SCRATCH, 'decks', `${slug}.html`));
  for (const m of html.matchAll(/cardno=([A-Z0-9-]+?EN)"/g)) want(m[1]);
}
// Decklists published by name (data/raw/tournament-decks.txt): resolve each printed name through
// the official search. The regular print wins over parallels (numbers like -SL22EN, -P01EN);
// a name in an "evolve:" section must resolve to an Evolved (or Advanced) card, any other section
// to a non-evolved one. Ambiguity throws: a guessed card is a wrong deck.
const slugName = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const decode = (s) => s.replace(/&#0?39;|&#8217;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#8220;|&#8221;/g, '"');
const resolved = [];
const raw = fs.readFileSync(path.join(ROOT, 'data/raw/tournament-decks.txt'), 'utf8').split(/\r?\n/);
let deck = null, sec = null;
for (const line of raw) {
  if (!line.trim() || line.startsWith('#')) continue;
  if (line.startsWith('deck|')) {
    const [, id, name, archetype, player, event, place, date] = line.split('|');
    deck = { id, name, archetype, player, event, place, date, leader: [], main: [], evolve: [] };
    resolved.push(deck); continue;
  }
  if (/^(leader|main|evolve):$/.test(line)) { sec = line.slice(0, -1); continue; }
  const m = line.match(/^(\d+) (.+)$/);
  if (!m) throw new Error(`bad line: ${line}`);
  const name = m[2].trim();
  const html = await get(`${SITE}/cards/searchresults/?card_name=${encodeURIComponent(name)}&view=text`,
    path.join(SCRATCH, 'search', `${slugName(name)}.html`));
  const hits = [];
  for (const li of html.split(/<li[ >]/).slice(1)) {
    const no = (li.match(/cardno=([A-Z0-9-]+?EN)/) || [])[1];
    if (!no) continue;
    const cells = li.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '$1').replace(/<[^>]+>/g, '|').split('|').map((c) => decode(c.trim())).filter(Boolean);
    const at = cells.indexOf(no);
    hits.push({ no, name: cells[at + 1], type: cells[at + 2] });
  }
  const regular = (h) => /-(\d+|LD\d+|T\d+)EN$/.test(h.no);
  const evo = (h) => /^(Evolved|Advanced)/.test(h.type || '');
  const ok = hits.filter((h) => h.name === name && regular(h) && (sec === 'evolve' ? evo(h) : !evo(h)));
  const uniq = [...new Set(ok.map((h) => h.no))];
  if (uniq.length !== 1) throw new Error(`${deck.id} ${sec} "${name}": ${uniq.length} matches ${JSON.stringify(hits.map((h) => h.no + ' ' + h.name + ' ' + h.type))}`);
  deck[sec].push([uniq[0], Number(m[1])]);
  want(uniq[0]);
}
fs.writeFileSync(path.join(SCRATCH, 'tournament-resolved.json'), JSON.stringify(resolved, null, 1));
console.log(`resolved ${resolved.length} published decklists`);

let n = 0;
while (queue.length) {
  const no = queue.shift();
  const html = await get(`${SITE}/cards/?cardno=${no}`, cardFile(no));
  // Related cards (tokens, the evolved side, cards named in text) are linked from the detail page.
  const rel = html.slice(html.indexOf('cardlist-Detail_Relation'));
  for (const m of rel.matchAll(/cardno=([A-Z0-9-]+?EN)/g)) if (/-(T\d+|\d+)EN$/.test(m[1]) && /-T\d+EN$/.test(m[1])) want(m[1]);
  if (++n % 25 === 0) console.log(`${n} fetched, ${queue.length} queued`);
}
console.log(`done: ${n} card pages in scratch/cards/`);
