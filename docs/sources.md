# Sources

Where each input to this project came from, when, and how to get it again. Raw downloads live in
the gitignored `scratch/`; only generated files and the decklist text are committed.

## Rules

- **Source:** Shadowverse: Evolve Comprehensive Rules **v1.26.1**, dated 2026-08-05,
  https://en.shadowverse-evolve.com/wordpress/wp-content/uploads/2026/08/20105457/SVEE-Comprehensive-Rules_v1.26.1_260805.pdf
- **Fetched:** 2026-10-29 with plain `curl` (HTTP 200, 35 pages). PDF and `pdftotext` extraction in
  `scratch/rules/` (not committed).
- **Used for:** behaviour of every rule; indexed by section number in `docs/rules.md`.
- **Plain-language guide:** https://en.shadowverse-evolve.com/rules/play-guide (tutorial wording
  only, never engine behaviour).
- **Rulings:** each official card page carries dated Q&A entries (`Q146`, `Q147` …). They are
  saved with the card page and cited by number.

## Card data

- **Source:** the official English card list, one detail page per card:
  `https://en.shadowverse-evolve.com/cards/?cardno=<NUMBER>`. Related tokens are linked from each
  page and fetched too. A set's list is also available 15 cards at a time from
  `/cards/searchresults/?expansion=<SET>&view=text` and `/cards/searchresults_ex?...&page=<N>`.
- **Fetched:** 2026-10-29 by `node tools/fetch-cards.mjs` into `scratch/cards/` (one request at a
  time, 350 ms apart, browser user-agent).
- **Used for:** names, class, type, traits, rarity, set, cost, attack, defense, printed text with
  its icons as bracketed tokens (`[fanfare]`, `[act]`, `[engage]` …, from each icon's `alt` text),
  token text, format, and Q&A.
- **Pipeline:** `node tools/build-cards.mjs` reads `scratch/` and writes `data/cards.js` and
  `data/decks.js`. `--strip-text` is the withdrawal lever (`docs/takedown.md`).
- **What it carries:** names and text are Cygames' and Bushiroad's (`docs/rights.md`).
  `data/cards.js` is the one file that carries them.

## Decklists

1. **Official Featured Decks** — Combined Set "Eightfold Retribution & Omens and Heirs"
   Recommended Decks, 2026-10-09, https://en.shadowverse-evolve.com/decks/bp1920-recommended-decks/
   12 decks; each lists Main Deck (40) with `×N`, Evolve Deck (10) and Leader Card by card
   number, plus its Bushiroad Decklog code. Saved as `scratch/decks/bp1920-recommended-decks.html`.
2. **Grand Showdown 2026 winners** — TCGplayer, "Shadowverse: Evolve's Best Competitive Decks: The
   Grand Showdown 2026 Winners", Drew Knapp, 2026-04-13,
   https://www.tcgplayer.com/content/article/Shadowverse-Evolve-s-Best-Competitive-Decks-The-Grand-Showdown-2026-Winners/1ff7c7a5-1e26-4e58-b841-8a545b4557d8/
   Three lists by card name (the page renders client-side; read in a browser on 2026-10-29). Copied
   into `data/raw/tournament-decks.txt` and resolved to card numbers through the official search
   (`/cards/searchresults/?card_name=<NAME>&view=text`). The player handles are the public
   tournament names from the article. The Europe and Asia & Oceania event dates are not stated in
   the article; North & Latin America was 2026-04-04.
- **Bushiroad Decklog** — `POST https://decklog-en.bushiroad.com/system/app/api/view/<CODE>` (with
  a `Referer` of the view page) returns a deck as JSON with card numbers and counts. Verified on
  `3YU1H` on 2026-10-29. Any future list that has a Decklog code can be imported from it.
- **Not usable:** shadowverse.gg's tier list is for Shadowverse: Worlds Beyond, the digital game
  (PLAN D5). The official Tournament Decks pages list rank, class and player only. shadowversecodex.com
  indexes Japanese events on BP22, which is not released in English.

## Asset tools

Generated locally on the owner's machine; no cloud service is called (PLAN D11). Tools and model
licences are as recorded in `kb/ASSET-PIPELINE.md`; this section is filled in when the assets are
made.
