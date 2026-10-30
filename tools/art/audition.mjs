// Art-style audition (PLAN.md §1 Q4): 3 pool characters x 4 styles, FLUX.1 dev (the model the
// owner picked in lorecannae, D17), character name + description in our own words. Official card
// images were viewed (scratch/ref, gitignored) only to identify hair, costume and colours; they
// are never image inputs and the compositions are our own.
//   node tools/art/audition.mjs
//   node tools/gen-art.mjs --prompts tools/art/audition-prompts.json --out art/masters/audition
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TAIL = 'full-bleed scene edge to edge, purely pictorial, wordless and untitled, vertical portrait composition';
export const STYLES = {
  A: 'super-deformed chibi figure with MGSD proportions, about two and a half heads tall, oversized head with big expressive eyes, short stubby limbs, richly detailed costume and textures, classic feature-animation art direction, clean appealing shapes, bright saturated colours, polished soft cel shading, cinematic lighting, ' + TAIL,
  B: 'super-deformed chibi figure with MGSD proportions, about two and a half heads tall, oversized head with big glossy anime eyes, short stubby limbs, richly detailed costume and textures, Japanese fantasy card game illustration, crisp anime line art, vivid colours, glossy cel shading with soft glow, dynamic lighting and sparkling effects, ' + TAIL,
  C: 'full-figure Japanese fantasy card game key art, slender anime proportions, detailed expressive anime face, intricately detailed costume, painterly rendered background, dramatic lighting with glowing magical effects, rich colours, high-detail digital painting, ' + TAIL,
  D: 'dark-fantasy painterly illustration, realistic heroic proportions, moody atmospheric lighting, rich oil-paint texture, deep shadows with warm highlights, epic composition, ' + TAIL,
};
const CHARS = {
  arisa: { name: 'Arisa', desc: 'a young elf archer woman with long wavy blonde hair, green eyes, pointed ears and a small red ribbon in her hair, wearing a black corset bodice over a white blouse and short white skirt, brown leather belts and arm bracers and a flowing red cape, drawing a tall wooden longbow', set: 'in a sunlit ancient forest with drifting green leaves' },
  lishenna: { name: 'Lishenna', desc: 'a cheerful girl with very long pink hair, a black hairband and bright blue eyes, wearing a white frilled blouse with a black bow, a black corset vest, a layered magenta ruffled skirt, black thigh-high stockings and long black gloves, reaching out with a playful smile while two round machine orbs glowing cyan float behind her', set: 'above a futuristic city of floating ruins at dusk' },
  galmieux: { name: 'Galmieux', desc: 'a fierce young woman with long wild brown hair and red eyes, wearing crimson dragon-scale armour with a golden clawed gauntlet on one arm and a red outfit trimmed with white fur, wreathed in swirling flames', set: 'on a volcanic crag under a burning sky' },
};
const BAD = /\b(sign|banner|book|scroll|letter|label|logo|emblem|crest|map|screen|poster|cover|title|page|card frame|text|word|no|not|never|without|three|four|five|six|seven|eight|nine|ten|dozen|cygames|bushiroad|shadowverse)s?\b/i;
const prompts = {};
const problems = [];
for (const [v, style] of Object.entries(STYLES)) for (const [k, c] of Object.entries(CHARS)) {
  const lead = c.name + ', ' + c.desc + ', ' + c.set;
  const m = lead.match(BAD) || style.replace('card game', '').match(BAD); if (m) problems.push(v + k + ': ' + m[0]);
  prompts[v + '-' + k] = { name: v + ' ' + k, model: 'dev', aspect: '2:3', megapixels: 1, prompt: lead + ', ' + style };
}
if (problems.length) { console.log('audition: refused - ' + problems.join('; ')); process.exit(1); }
fs.writeFileSync(path.join(HERE, 'audition-prompts.json'), JSON.stringify({ styles: STYLES, prompts }, null, 1));
console.log('audition: ' + Object.keys(prompts).length + ' prompts written to tools/art/audition-prompts.json');
