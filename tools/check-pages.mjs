// Page gates:
//  (1) index.html and tests.html load the identical engine script list in the same order
//      (CLAUDE.md rule 1; the query string of a stamped URL is ignored);
//  (2) every script or stylesheet a page references exists;
//  (3) no silent fallbacks in UI code — `if (!SV.x)` / `SV.x || {}` (CLAUDE.md rule 5);
//  (4) every log type the engine can write has a phrase in js/ui/logtext.js, and a sound tag
//      or an explicit silence in js/ui/sound.js. Types come from docs/ENGINE-API.md's "Log
//      entries" table AND from every log call / leave verb in js/*.js and data/abilities/*.js;
//  (5) every [token] in the printed card text has an original glyph in js/ui/core.js.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fails = [];

// ---- (1) + (2)
const block = (f) => {
  const html = read(f);
  if (!html.includes('<!-- engine -->')) { fails.push(`${f}: no <!-- engine --> block`); return []; }
  const b = html.split('<!-- engine -->')[1].split('<!-- /engine -->')[0];
  return [...b.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
};
const refs = (f) => [...read(f).matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"?#]+)/g)].map((m) => m[1]).filter((u) => !/^https?:/.test(u));
const a = block('index.html'), b = block('tests.html');
if (JSON.stringify(a) !== JSON.stringify(b)) fails.push(`engine script lists differ:\n  index: ${a.join(' ')}\n  tests: ${b.join(' ')}`);
for (const f of ['index.html', 'tests.html', 'sounds.html']) for (const u of refs(f)) if (!fs.existsSync(path.join(ROOT, u))) fails.push(`${f}: missing ${u}`);
// The dev fixture is written by an inline script; it must exist too.
if (!fs.existsSync(path.join(ROOT, 'js/ui/dev-fixture.js'))) fails.push('index.html: missing js/ui/dev-fixture.js');

// ---- (3)
const uiDir = path.join(ROOT, 'js/ui');
const uiFiles = fs.existsSync(uiDir) ? fs.readdirSync(uiDir).filter((f) => f.endsWith('.js')) : [];
for (const f of uiFiles) {
  const code = fs.readFileSync(path.join(uiDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  if (/if\s*\(\s*!\s*SV\.[A-Za-z_$][\w$]*\s*\)/.test(code)) fails.push(`js/ui/${f}: silent-fallback guard "if (!SV.x)"`);
  // A module creating its own namespace (`SV.anim = SV.anim || {}`) is fine; a read that
  // substitutes {} for a missing module is not.
  const reads = code.replace(/(SV\.[A-Za-z_.$]+)\s*=\s*\1\s*\|\|\s*\{\s*\}/g, '');
  if (/SV\.[A-Za-z_.$]+\s*\|\|\s*\{\s*\}/.test(reads)) fails.push(`js/ui/${f}: silent fallback "SV.x || {}"`);
}

// ---- (4)
const types = new Set();
const api = read('docs/ENGINE-API.md');
const logSection = api.split('## Log entries')[1] || '';
for (const line of logSection.split('\n')) {
  if (!line.startsWith('|') || /^\|\s*-/.test(line) || /^\|\s*type\s*\|/.test(line)) continue;
  const cell = line.split('|')[1];
  for (const m of cell.matchAll(/`([A-Za-z]+)`/g)) types.add(m[1]);
}
const codeFiles = [...fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f),
  ...fs.readdirSync(path.join(ROOT, 'data/abilities')).filter((f) => f.endsWith('.js')).map((f) => 'data/abilities/' + f)];
for (const f of codeFiles) {
  const code = read(f);
  for (const m of code.matchAll(/\blog\(\s*s\s*,[^,]+,\s*'([A-Za-z]+)'/g)) types.add(m[1]);
  for (const m of code.matchAll(/\bverb:\s*'([A-Za-z]+)'/g)) types.add(m[1]);
}
const ctx = { console: { error() {}, log() {}, warn() {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(read('js/ns.js'), ctx, { filename: 'js/ns.js' });
vm.runInContext(read('js/ui/logtext.js'), ctx, { filename: 'js/ui/logtext.js' });
const LT = ctx.SV.logText;
const soundSrc = read('js/ui/sound.js');
const tagBlock = (soundSrc.match(/const TYPE_TAG = \{([\s\S]*?)\};/) || [])[1] || '';
const silentBlock = (soundSrc.match(/const SILENT = \{([\s\S]*?)\};/) || [])[1] || '';
const keyIn = (blk, t) => new RegExp('(^|[\\s{,])' + t + '\\s*:').test(blk);
for (const t of [...types].sort()) {
  if (!LT.hasPhrase(t)) fails.push(`log type "${t}" has no phrase in js/ui/logtext.js`);
  if (!keyIn(tagBlock, t) && !keyIn(silentBlock, t)) fails.push(`log type "${t}" has neither a sound tag nor an explicit silence in js/ui/sound.js`);
}

// ---- (5)
const cctx = { console };
cctx.globalThis = cctx;
vm.createContext(cctx);
vm.runInContext(read('js/ns.js'), cctx);
vm.runInContext(read('data/cards.js'), cctx);
const coreSrc = read('js/ui/core.js');
const glyphKeys = new Set([...coreSrc.split('const G = {')[1].split('\n  };')[0].matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]));
glyphKeys.add('q');
const tokens = new Set();
for (const d of Object.values(cctx.SV.CARDS)) for (const m of (d.text || '').matchAll(/\[([A-Za-z]+?)(\d\d)?\]/g)) if (!(m[1] === 'cost' && m[2])) tokens.add(m[1]);
for (const t of tokens) if (!glyphKeys.has(t)) fails.push(`card text token [${t}] has no glyph in js/ui/core.js`);

for (const f of fails) console.log('FAIL ' + f);
console.log(`check-pages: ${fails.length ? fails.length + ' failure(s)' : 'ok'} (${a.length} engine scripts, ${uiFiles.length} UI files, ${types.size} log types, ${tokens.size} card-text tokens)`);
process.exit(fails.length ? 1 : 0);
