// Distinctness gate (PLAN D17; tabletop-kb README rule 21): shadowforge has its own look, so the
// interface must not drift back to lorecannae's skin or to this game's first, re-coloured skin.
// Static checks over styles.css, index.html and js/ui/*.js:
//   1. no lorecannae / old-shadowforge typefaces (book serifs, rounded sans);
//   2. no colour from either old palette (their most-used gold, parchment and violet values);
//   3. no rounded frames: a border-radius between 6px and 40px (or .4em-2em) is the old shape;
//      circles (50%) and hairline 1-3px corners are this game's;
//   4. the concept's own tokens exist (night, moonlight, cyan, the side colours).
// The visual half of the gate is the side-by-side sheet in docs/look/ (see docs/look/README.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['styles.css', 'index.html', ...fs.readdirSync(path.join(ROOT, 'js/ui')).filter((f) => f.endsWith('.js')).map((f) => 'js/ui/' + f)];

const FONTS = ['Cinzel', 'Palatino', 'Book Antiqua', 'Georgia', 'IM Fell', 'Nunito', 'Quicksand', 'Trajan', 'Trebuchet'];
const WORDS = ['filigree', 'parchment', 'storybook', 'forge iris', 'molten'];
// lorecannae's top colours, then the first shadowforge skin's (gold, violet, smoked steel).
const COLOURS = ['#e7c06a', '#ffe39a', '#b8913e', '#8a6420', '#8a5a10', '#6b4508', '#2a1a06', '#ffd36b', '#ffeeb5', '#e2b44d', '#4a2f08', '#0e0a26',
  '#ffd27a', '#ece6f2', '#fff1cf', '#d9d3c6', '#c9b4ff', '#8d8070', '#ff8a4a', '#c9902e', '#21150a', '#ffe2a4', '#ffd9a0', '#ffc27a', '#e8c27a', '#e8b65c', '#2c2436', '#17121f', '#0d0a12'];
const TOKENS = ['--night-0', '--moon', '--cyan', '--side-mine', '--side-theirs', '--font-display'];

const problems = [];
for (const rel of files) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const at = rel + ':' + (i + 1);
    for (const f of FONTS) if (line.includes(f)) problems.push(`${at} old typeface "${f}"`);
    for (const w of WORDS) if (new RegExp('\\b' + w + '\\b', 'i').test(line) && !/old skin|not .*(filigree|parchment)|never .*(filigree|parchment)|lorecannae/i.test(line)) problems.push(`${at} old ornament word "${w}"`);
    const low = line.toLowerCase();
    for (const c of COLOURS) if (low.includes(c)) problems.push(`${at} old palette colour ${c}`);
    if (rel.endsWith('.css')) {
      for (const m of line.matchAll(/border-radius:\s*([^;]+);/g)) {
        for (const v of m[1].trim().split(/\s+/)) {
          const px = /^(\d+(?:\.\d+)?)px$/.exec(v), em = /^(\d*\.?\d+)(em|rem)$/.exec(v);
          if ((px && +px[1] >= 6 && +px[1] <= 40) || (em && +em[1] >= 0.4 && +em[1] <= 2)) problems.push(`${at} rounded frame (border-radius ${v})`);
        }
      }
    }
  });
}
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
for (const t of TOKENS) if (!css.includes(t + ':')) problems.push(`styles.css is missing the concept token ${t}`);

if (problems.length) {
  for (const p of problems.slice(0, 40)) console.log('FAIL ' + p);
  console.log(`check-look: ${problems.length} problem(s) in ${files.length} files`);
  process.exit(1);
}
console.log(`check-look: ${files.length} files carry no old-skin font, colour or rounded frame; concept tokens present`);
