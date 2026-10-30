// Fetches the raw inputs for data/cards.js into the gitignored scratch/ folder. Zero dependencies.
//   node tools/fetch-cards.mjs              featured-deck pages + every card they list + related tokens
//   node tools/fetch-cards.mjs --force      re-download pages already in scratch/
// Sources and dates: docs/sources.md. Polite: one request at a time, 350 ms apart.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH = path.join(ROOT, 'scratch');
const SITE = 'https://en.shadowverse-evolve.com';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) shadowforge-fan-project' };
const FORCE = process.argv.includes('--force');

import { FEATURED } from './fetch-cards-config.mjs';

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
const lines = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/);
const raw = lines('data/raw/tournament-decks.txt');
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
    path.join(SCRATCH, 'search', `${slugName(name)}-${createHash('sha1').update(name).digest('hex').slice(0, 6)}.html`));
  const hits = [];
  for (const li of html.split(/<li[ >]/).slice(1)) {
    const no = (li.match(/cardno=([A-Z0-9-]+?EN)/) || [])[1];
    if (!no) continue;
    const cells = li.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '$1').replace(/<[^>]+>/g, '|').split('|').map((c) => decode(c.trim())).filter(Boolean);
    const at = cells.indexOf(no);
    hits.push({ no, name: cells[at + 1], type: cells[at + 2] });
  }
  const regular = (h) => /-(\d+|LD\d+|T\d+)EN$/.test(h.no);
  const evo = (h) => /Evolved|Advanced/.test(h.type || '');
  const ok = hits.filter((h) => h.name === name && regular(h) && (sec === 'evolve' ? evo(h) : !evo(h)));
  // Reprints: same printed name, different numbers. Prefer a print already in the pool, then
  // booster (BP), starter (SD/SDD/SS), other sets, promo (PR). build-cards.mjs collapses reprints.
  const rank = (no) => (seen.has(no) ? 0 : /^BP/.test(no) ? 1 : /^(SD|SS)/.test(no) ? 2 : /^PR/.test(no) ? 4 : 3);
  const uniq = [...new Set(ok.map((h) => h.no))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, 1);
  if (uniq.length !== 1) throw new Error(`${deck.id} ${sec} "${name}": ${uniq.length} matches ${JSON.stringify(hits.map((h) => h.no + ' ' + h.name + ' ' + h.type))}`);
  deck[sec].push([uniq[0], Number(m[1])]);
  want(uniq[0]);
}
// Tokens named in card text but not linked from any page (data/raw/extra-tokens.txt).
for (const name of lines('data/raw/extra-tokens.txt').filter((l) => l.trim() && !l.startsWith('#'))) {
  // card_kind[]=Token: the search leaves tokens out otherwise. Token numbers are -T<n> or -PR<n>.
  const html = await get(`${SITE}/cards/searchresults/?card_name=${encodeURIComponent(name)}&card_kind%5B%5D=Token&view=text`,
    path.join(SCRATCH, 'search', `token-${slugName(name)}.html`));
  const nos = [...new Set([...html.matchAll(/cardno=([A-Z0-9]+-(?:T|PR)[0-9]+EN)/g)].map((m) => m[1]))].sort();
  if (!nos.length) throw new Error(`extra token "${name}": not found`);
  want(nos[0]); // reprints of one token are identical; build-cards folds them
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
