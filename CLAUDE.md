# shadowforge — Shadowverse: Evolve in the browser

Unofficial, non-commercial fan reproduction of the **Shadowverse: Evolve** trading card game
(Cygames / Bushiroad, English edition), played vs AI, hot-seat or AI-vs-AI in the browser.
Decisions live in `PLAN.md` (read it first). The template is lorecannae (`../lorecannae`), the
owner's pick as the best-presented game in the series; knowledge base from earlier projects:
`kb/README.md`.

## Hard rules

1. Plain browser JS, no build step, no dependencies. Every file is an IIFE on `globalThis.SV`.
   `index.html`'s script list is the load order; `tests.html` loads the same engine files in
   the same order (checked by `tools/check-pages.mjs`).
2. Engine surface: `SV.legalActions` / `SV.apply` (never mutates) / `SV.isTerminal` /
   `SV.whoActs` — contract in `docs/ENGINE-API.md`. Every UI affordance derives from
   `legalActions`; every number the UI shows comes from an engine function (`SV.chars`,
   `SV.costToPlay`, `SV.whyNot`).
3. One door per rule: damage (`dealDamage`), choices (`ask`), costs (`pay`), zone moves (`move`),
   characteristics (`chars`), defense gain (`heal`). Never write to a card's counters, zone or a
   leader's defense directly outside the door.
4. Never assume a choice. No auto-pick for a single candidate.
5. No silent fallbacks: no `if (!SV.x)` and no `SV.x || {}` in UI code; a missing module throws.
6. Seeded RNG; every shuffle happens inside `apply`.
7. A card that doesn't play as printed goes in `data/defects.js`, never quietly into a deck.
8. Cite the Comprehensive Rules section (`CR 8.4.3`) in engine comments and card Q&A as `Q147`;
   tests are named for the rule or card number they assert.
9. Art prompts never contain card names, character names, franchise/studio/game/artist names,
   or text-magnet words (`tools/build-art-prompts.mjs` lints them). Never an official
   illustration, frame, icon or logo; never img2img or tracing of one.
10. Commit messages describe the mechanism by card number or CR section. UI commits say what was
    checked in the real page.
11. Never put the owner's real name or home path in any file; credit **evilgouki**.
12. Before committing a document, `ls` every path it claims exists.

## Commands

```
node tools/serve.mjs            # http://localhost:8241 (no-store cache)
node tools/test.mjs --quiet     # headless tests (runs tests.html's script list under node:vm)
node tools/sim.mjs --games 50   # AI-vs-AI / random games with invariants after every step
node tools/fetch-cards.mjs      # download deck pages, card pages and decklog lists into scratch/
node tools/build-cards.mjs      # regenerate data/cards.js + data/decks.js from scratch/
node tools/gate.mjs             # every gate, one line each
node tools/stamp-assets.mjs     # re-stamp index.html ?v= hashes before every deploy commit
```

## Layout

```
index.html / tests.html   entry points
js/                       engine (ns, engine, abilities runtime, ai), then UI in js/ui/
data/cards.js             GENERATED card data (names + printed text) — never hand-edit
data/decks.js             GENERATED decks (official featured decks + tournament winners)
data/abilities/*.js       per-card ability scripts, one file per class + neutral + universes
data/defects.js           cards that don't play as printed (kept out of decks)
tools/*.mjs               serve, test, sim, fetch/build cards, gate, art/audio pipelines
tests/*.js                behaviour tests (loaded by tests.html)
docs/                     rules.md (CR citation index), ENGINE-API.md, ABILITIES.md, sources.md, rights.md, takedown.md
kb/                       knowledge base distilled from earlier projects
scratch/                  gitignored: CR PDF/text, card pages, decklog dumps
```

## Card text notation

Printed icons are kept as bracketed tokens from the official site's `alt` text: `[fanfare]`,
`[lastwords]`, `[act]`, `[engage]`, `[evolve]`, `[attack]`, `[defense]`, `[cost02]`,
`[forestcraft]` and so on. The UI draws its own original glyph for each token; the official icon
images are never used.
