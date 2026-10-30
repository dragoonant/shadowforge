# The look (PLAN D17)

shadowforge's presentation concept is **"the evolution rite"**: two summoners duel on a floating
stone dais under the moon, and evolving a follower is the moment the light comes. It replaced the
first skin, which was lorecannae re-coloured; the owner rejected that on 2026-10-30 ("too much like
Lorecannae ... unique look and feel for each game"). The rule behind it is tabletop-kb README rule 21.

| File | What it shows |
|---|---|
| `audition.jpg` | The three concepts offered (A the evolution rite, B academy duel, C tournament table), under lorecannae, Xross Forge and the rejected first skin. A was built as the default; the owner may pick another. |
| `compare.jpg` | The gate's visual half: title and board for lorecannae, Xross Forge, the first skin and the current skin. Nothing in the last row may read as a row above it. |

## The concept, as rules

- **Colour:** midnight indigo and night blue, moonlit silver, white-cyan evolution light. Your side is
  cyan, the opponent's rose (`--side-mine`, `--side-theirs`). Class colours live in gems only: the
  cost diamond, the six gems on the dais circle, portrait rims. No gold, parchment or violet frames.
- **Shape:** cut corners at 45 degrees, hairlines, and bright corner brackets. Buttons that move the
  game are pointed blades. Circles are for the medallions and the circle of light. No rounded frames.
- **Type:** an engineered sans (Bahnschrift, then DIN-like fallbacks) set in capitals with wide
  tracking for headings, Segoe for running text. The wordmark is original geometric lettering drawn
  as SVG strokes (`js/ui/title.js`), never a font or a logo.
- **Signature moments:** the wordmark drawn in light on the splash; the ring wipe between screens; the
  turn banner's expanding ring; the evolve rite (a turning circle with a hexagram opens under the
  follower, a white flash; super-evolving adds rays from the screen edges); a hit cracks the leader's
  defense crystal.
- **Backdrops:** cool night scenes with an empty centre (`tools/art/ui.mjs`).

## Redoing the sheets

The screenshots come from a Playwright copy in a sibling project, so the scripts live in the
gitignored `scratch/look/` (`shoot.mjs`, `compare.html`). The static half of the gate runs everywhere:

```bash
node tools/check-look.mjs
```
