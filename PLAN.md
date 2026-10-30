# PLAN — Shadowforge (Shadowverse: Evolve in the browser)

This file owns every decision. Other files point here; none restates a decision.
Drafted 2026-10-29 before the first commit, from the lorecannae template (the owner's pick as
the best-presented game in the series) and from sources checked the same day (§6).

**What this is.** An unofficial, non-commercial browser reproduction of **Shadowverse: Evolve**,
the physical trading card game by Cygames and Bushiroad (English edition, 2023–). Played against
an AI, hot-seat, or AI-vs-AI. Real card names and printed text; original generated art and sound.
Same regime as lorecannae: **fidelity is the product**; a divergence from the printed card or the
Comprehensive Rules is a defect, never a design choice.

---

## 1. Questions for the owner — a wrong guess on each costs rework

Each has a default so a one-word answer ("go") is enough.

1. **Rights and visibility.** Neither Bushiroad nor the official Evolve site publishes a fan-content
   policy (§6.5): nothing permits a rules-enforcing client, nothing forbids one. The English
   Tabletop Simulator mod has run publicly since 2023. *Default: public GitHub Pages like
   lorecannae (`dragoonant/shadowforge`), with the NOTICE, no official images, and the one-file
   takedown lever.*
2. **Card pool.** The official site publishes complete "Featured Decks" per set (main 40 with
   quantities, evolve 10, leader, deck code). Tournament pages show standings only, no lists.
   *Default: every deck on the newest Featured Decks page (Combined Set "Eightfold Retribution &
   Omens and Heirs", 2026-10-09, Standard), then the previous two pages (Neometropolis, Princess
   Connect) as time allows.* Alternative: the six Showdown Decks (one per class, 2026-03-20,
   about 20 unique cards each) — the smallest first playable, but seven months behind Standard.
3. **Universes.** Crossover cards (Umamusume, IDOLM@STER, Cardfight!! Vanguard, Princess Connect)
   carry third-party IP and their own rules (CR 14: Serve, Magical Item, Trigger Icons / Drive
   Check, Union Burst). *Default: class decks only; universe cards stay out of the pool and CR 14
   is not implemented.*
4. **Art direction.** lorecannae ended on recognisable characters in MGSD chibi proportions with
   an animation look (its D17). Shadowverse's own look is Cygames' painted anime illustration.
   *Default: an audition — one card in four styles (MGSD chibi + anime cel, MGSD chibi + painted,
   full-proportion anime cel, painterly) — then the owner picks, recorded as D-art.* Never an
   official illustration, frame, logo, or img2img of one.

Round two, only if needed: the display name (default **Shadowforge**, matching the folder), and
whether the leader portrait is a character or an emblem.

---

## 2. Decisions

| # | Date | Decision | By |
|---|---|---|---|
| D1 | 2026-10-29 | **Regime: reproduction.** Rules fidelity is the product; printed rules text is shown verbatim; divergence is a defect. No BALANCE.md. | default (series) |
| D2 | 2026-10-29 | **Names and text:** real card names and printed English text, from one generated file `data/cards.js`, the withdrawal lever (`docs/takedown.md`). | default (lorecannae D2) |
| D3 | 2026-10-29 | **Template: lorecannae.** Copy its architecture, UI, audio, AI, tools and gates; adapt, don't redesign (§3). | owner |
| D4 | 2026-10-29 | **Rules source:** Comprehensive Rules **v1.26.1 (2026-08-05)**, cited by section in `docs/rules.md` and engine comments as `CR 8.4.3`. Rulings from the card Q&A on each official card page, cited as `Q147`. | default |
| D5 | 2026-10-29 | **Card pool = 15 decks.** (a) All 12 decks on the official Featured Decks page for Combined Set "Eightfold Retribution & Omens and Heirs" (2026-10-09). (b) The three English competitive winners of the **Grand Showdown 2026** (Europe, Asia & Oceania, North & Latin America), published by TCGplayer 2026-04-13. Owner asked for "the latest competitive decks from shadowverse.gg/tier-list"; that page is **Shadowverse: Worlds Beyond** (the digital game: different cards, a Portalcraft class Evolve doesn't have), so its decks can't be played under Evolve rules. (b) is the nearest Evolve equivalent with full lists; shadowversecodex.com's Japanese lists use BP22, not released in English. | owner + default |
| D6 | 2026-10-29 | **Universes: only what a registered deck needs.** Cardfight!! Vanguard (CR 14.4, the Angelic Swordcraft leader) and Umamusume: Pretty Derby (CR 14.2, the Jeanne Havencraft list) are implemented for the cards in the pool; IDOLM@STER (14.3) and Princess Connect (14.5) are not. Supersedes the kickoff default "no universes" because D5(b) needs them. | default (after D5) |
| D7 | 2026-10-29 | **Modes:** vs AI (easy / normal / hard), hot-seat, AI-vs-AI spectate, tutorial, deck builder enforcing deck construction (§5.1). | default (lorecannae D5) |
| D8 | 2026-10-29 | **Abilities are authored per card** as small JS functions over engine doors (`data/abilities/<class>.js`), one behaviour test each, auditor checks every printed keyword and number appears in the authored data. A card that can't play as printed goes in `data/defects.js` and out of every deck. | default (lorecannae D9) |
| D9 | 2026-10-29 | **Choices use the replay model** (job throws `Ask`, partial state stays on screen, answer re-runs from the snapshot). Never assume a choice. | default (lorecannae D10) |
| D10 | 2026-10-29 | **Engaged cards turn 90°** on the board in a slot that widens, the hover preview upright — lorecannae's D11 read, which is exactly Evolve's engage. | default |
| D11 | 2026-10-29 | **Assets generated locally:** Flux Studio (FLUX.2 klein 4B) for art, Audio Studio (Stable Audio Open SFX, ACE-Step music), procedural Web Audio kit as the floor. Cloud keys are dead. GPU lock etiquette from `kb/`. | default (lorecannae D12) |
| D12 | 2026-10-29 | **Deploy:** public GitHub Pages, `dragoonant/shadowforge`, served from `main` root, no build step. Dev server port **8241**. Owner: "Let's move" on the defaults. | owner |
| D13 | 2026-10-29 | **1v1 only.** CR 1.1.1: the rules do not support more than two players. | default |
| D14 | 2026-10-29 | **Format: Standard.** Deck legality follows the official card list's Standard flag at fetch date; Gloryfinder cards are out of the pool. | default |
| D15 | 2026-10-29 | **Every file is an IIFE on `globalThis.SV`.** No build step, no dependencies. | default |

---

## 3. What carries over from lorecannae, and what changes

lorecannae is the template because its presentation, sound, music and mechanics are the best
in the series (owner, 2026-10-29). Copy, rename `LC` → `SV`, then adapt.

### 3.1 Copied as-is (rename only)

| lorecannae | Role here |
|---|---|
| `CLAUDE.md` hard rules 1–12, `kb/` (all five files) + `kb/LORCANA-LESSONS.md` | The regime and the knowledge base. Add `kb/SVE-KICKOFF.md` = this file's §5–§6. |
| `js/ns.js`, `js/engine.js` **shape**: seeded RNG, state copy, jobs queue, `Ask` + replay, `settle()` (game state check → bag → next job), doors (`ask`, `pay`, `move`, `dealDamage`, `chars`) | The spine. Lorcana's bag (active player orders simultaneous triggers) is Evolve's Confirmation Timing (CR 10.5, 10.7) under another name. |
| `js/abilities.js` ctx helpers, `docs/ABILITIES.md` shape | Card-script authoring guide; hooks renamed to Evolve's events (§4.9). |
| `js/ai.js` (one-ply + one opponent ply on determinized copies, common random numbers), `docs/ai.md` method | Scoring terms change (§4.10); the search does not. |
| `js/ui/*` (16 modules), `styles.css`, `sounds.html` | The board, cards, drag, targeting, preview, log drawer, HUD, anim, sound, title, tutorial, deck builder. Re-themed and re-zoned (§4.11). |
| `tools/`: `serve`, `test`, `sim`, `gate`, `check-pages`, `check-art`, `stamp-assets`, `replay-report`, `audit-cards`, `gen-art`, `build-art-prompts`, `gen-audio`, `shrink-art`, `write-manifest`, `contact-sheet.ps1` | Unchanged except the auditor's keyword table and the art-prompt lint word list. |
| `docs/takedown.md`, `NOTICE.md`, `DEVIATIONS.md`, `TODO.md` formats, `.claude/launch.json`, `.nojekyll` | Reworded for Cygames / Bushiroad. |

### 3.2 Rewritten

- `tools/build-cards.mjs` — new source (§6.2): the official card list, not an API.
- `docs/rules.md` — a new citation index over CR v1.26.1 sections 1–15.
- `docs/ENGINE-API.md` — the same contract shape with Evolve's state, actions and `Ask` kinds (§4).
- `data/abilities/*.js`, `tests/cards-*.js` — all new, one file per class plus neutral.
- The art prompt identity table and the UI theme (§4.11, §4.12).

---

## 4. What Shadowverse: Evolve does to the lorecannae engine

Predicted before the first line, the way the series' handoffs do it. CR numbers were read in the
v1.26.1 text on 2026-10-29. Each is a day-one build, not a deviation to carry.

### 4.1 Resources: play points, evolution points, super-evolution points (CR 3, 6, 7.2)
- Max play points start at 0, +1 each start phase up to 10; play points reset to max (7.2.1–2).
  First player gets 0 EP, second gets 3; each gets 1 super-EP; leader defense set to 20 (6.x).
  First player skips the turn-1 draw. **New:** three numeric resources per seat, EP spendable only
  as 1 PP inside an evolve cost (12.2), super-EP only from max PP ≥ 7 (first) / 6 (second).
  Play-point limit handling (11.9).

### 4.2 No stack, but one reactive window: Quick (CR 10.6, 12.3)
Cards and abilities resolve on play. Automatic abilities wait for the next Confirmation Timing
(10.5, 10.7) — lorecannae's bag. **New:** the non-active player may play **Quick** cards and
abilities at defined timings — after an attack is declared and Strike resolves, and in the
opponent's end phase (7.4). Build it as a queue step whose controller is the other seat (the FAB
reactive-window pattern); there is no second control-flow mechanism.

### 4.3 Turn structure (CR 7)
Start phase (7.2: PP, refresh engaged cards, draw) → main phase (7.3: loop of play card from hand
**or EX area** / activated ability / attack / end, Confirmation Timing after each) → end phase
(7.4: triggers, engage Ward followers, Quick window, discard to 7 from 8+). 7.3.3.1: cannot end
the main phase while a forced action is unmet.

### 4.4 Zones (CR 4) and limits (CR 11)
Leader area, deck, evolve deck, cemetery, **field (limit 5)**, **EX area (limit 5, public,
a second hand that tokens live in)**, banished, evolve zone (the evolved card on top of its
follower), plus universe-only zones that stay unimplemented under D6. Rules handling 11.2–11.9 is
the game state check: loss at 0 defense, destruction at 0 defense, field and EX overflow, illegal
evolutions, Stack at 0 counters, PP limit.

### 4.5 Attack (CR 8.4, 8.5) and the attack keywords (CR 12.8–12.15)
Declare and engage the attacker → Strike / Leader Strike / Follower Strike (12.7) → Quick window
→ simultaneous damage both ways (follower) or to the leader. Legality: only reserved followers
attack; targets are the enemy leader or **engaged** enemy followers; **Ward** forces the target
(12.8); **Storm** attacks anything the turn it enters, **Rush** only followers (12.9–10);
**Assail** reaches reserved followers unless **Intimidate** (12.11–12); **Drain** heals the
leader (12.13); **Bane** destroys after combat with no damage needed (12.14); **Aura** blocks
ability targeting (12.15). A follower played and evolved this turn may attack engaged followers
only (play guide). One `attack` job with these as checks in `legalActions`, never in the UI.

### 4.6 Damage and counters (CR 15.1)
Follower damage persists as status counters; attack / defense changes are counters too. Leader
defense is a number that can exceed 20. `dealDamage` is the one door; `chars()` reads counters.

### 4.7 Evolve, super-evolve, the evolve deck (CR 12.2, 12.6, 12.17, 9.2, 11.6)
Evolve is an **activated ability**, once per turn, paid in PP with up to 1 EP in lieu: the matching
evolved card leaves the evolve deck and stacks on top; the stack keeps counters and moves together
(lorecannae's Shift stack code applies). **On Evolve** / **On Super-Evolve** triggers. When the
stack leaves the field the evolved card goes face-up on top of the evolve deck, removed from the
game. **Advanced** cards (9.2) also live in the evolve deck. **Fuse** (12.18) moves a card from
hand or EX area under another.

### 4.8 Class conditions (CR 13) and tokens (CR 9.1)
Combo X (cards played this turn), Spellchain X (spells in cemetery), Stack / Earth Rite
(counters on amulets), Overflow (max PP ≥ 7), Necrocharge X (cemetery size), Sanguine (leader
lost defense this turn, sticky). Each is one engine predicate the scripts call. Tokens are created
into the EX area or field and cease to exist when they leave either (9.1).

### 4.9 Card-script hooks (`docs/ABILITIES.md`)
`fanfare`, `lastWords`, `onEvolve`, `onSuperEvolve`, `strike` / `leaderStrike` / `followerStrike`,
`quick`, `activated` (cost: PP, engage, cemetery, counters), `auras` for persistent effects
(10.9) read by `chars()`, `replace` for replacement effects (10.10), `startMain`, `startEnd`,
`whenPlayed` (for Combo), `enterField`, `leaveField`, `destroyed`, `damaged`. Final card
information (10.11) for triggers whose source left — lorecannae's open item, built in here.

### 4.10 AI
Keep the search; change the evaluation: leader defense difference, board attack and defense,
hand plus EX area, EP and super-EP in hand, Ward walls, lethal detection (sum of Storm and
reserved attackers against defense). Measure the first player's win rate; it is Cygames' number.

### 4.11 Board (`kb/PRESENTATION-REFERENCE.md` A0 still holds)
Per seat: leader portrait with the defense counter, field of 5 (engaged = 90°), EX area of 5
(face-up, drop target), hand, deck + evolve deck + cemetery + banished piles with viewers, PP /
EP / super-EP trackers. Drags: hand or EX → field (play), follower → leader or engaged follower
(attack), evolve deck → follower (evolve). The Quick window is a prompt with a "No response"
button that says what is being responded to. Music tiers keyed to the lowest leader defense.

### 4.12 Theme
Replace the storybook theme: dark-fantasy card-arena. Palette from the six classes (verdant,
crimson, violet, amber, obsidian, gold) plus neutral silver; the active class tints the HUD.

---

## 5. Deck construction and formats (for the deck builder and the pool gate)
### 5.1
Main deck 40–50 cards (followers, spells, amulets); evolve deck ≤ 10 (evolved and advanced
cards); one leader; cards of the leader's class plus Neutral (or the leader's universe, excluded
under D6); at most 3 copies of a name in each of main and evolve unless the card says otherwise;
Standard legality from the card list (D14). Opening hand 4, one full mulligan each, first player
decides first.

---

## 6. Sources — checked 2026-10-29 (copy into `docs/sources.md` and `docs/rights.md` on commit two)

### 6.1 Rules
- **Comprehensive Rules v1.26.1 (2026-08-05)**, 35-page PDF:
  `https://en.shadowverse-evolve.com/wordpress/wp-content/uploads/2026/08/20105457/SVEE-Comprehensive-Rules_v1.26.1_260805.pdf`.
  Plain `curl` works. `pdftotext` extracts 1,374 lines cleanly; `pypdf` is not installed. The
  extraction has a usable section index (1 Overview, 2 Card Information, 3 Player Information,
  4 Zones, 5 Key Notations, 6 Game Preparation, 7 Game Progression, 8 Main Phase Processes,
  9 Special Card Types, 10 Playing and Resolving, 11 Rules Handling, 12 Keywords, 13 Class
  Keywords, 14 Universe Keywords, 15 Miscellaneous). Keep PDF and text in gitignored `scratch/rules/`.
- **Play guide**: `https://en.shadowverse-evolve.com/rules/play-guide` — the plain-language
  version; useful for the tutorial's wording, never for the engine.
- **Rulings**: every official card page has a Q&A list (`Q146`, `Q147` …) with dates.

### 6.2 Card data (official site, no API)
- Set browser: `https://en.shadowverse-evolve.com/cards/` lists every set code (BP01–BP21-22,
  SD01–SD06, SDD01–SDD06, CP01–CP05, PCS01, GB01, promos, …).
- **List endpoint, 15 cards per page, text view carries everything:**
  `https://en.shadowverse-evolve.com/cards/searchresults_ex?expansion=<SET>&view=text&page=<N>`
  returns `<li>` entries with card number, name, type, traits, rarity, cost, attack, defense, the
  full printed text, and token text (e.g. `Fairy (Follower - Pixie) 1/1`). Page 1 is
  `/cards/searchresults/?expansion=<SET>&view=text`; pages past the end return nothing. Plain
  `curl` with a browser user-agent works (HTTP 200). Verified on BP01 and SDD01 (23 entries: 20
  cards, 1 leader, 2 tokens).
- **Detail page**: `/cards/?cardno=<NUMBER>&expansion=<SET>` adds set, release date, illustrator,
  format, and the Q&A. Fetch only for cards in the pool.
- Keyword icons come out as `|+1/|+1|` style fragments in the text view; the builder normalises
  them. The exact glyph mapping is the first thing the builder's tests pin down.
- Pipeline: `node tools/build-cards.mjs --fetch` → `scratch/cards/<SET>-<page>.html` →
  `data/cards.js` (ids = card numbers, e.g. `BP19-001EN`) and `data/decks.js`.

### 6.3 Decklists
- **Featured Decks** (official, complete): `https://en.shadowverse-evolve.com/decks/<slug>/`,
  e.g. `bp1920-recommended-decks` (2026-10-09), `bp18-recommended-decks` (2026-07-25),
  `cp04-recommended-decks` (2026-09-03). Each deck: name, deck code, **Main Deck (40 Cards)** as
  card images with `×N`, **Evolve Deck (10 Cards)**, **Leader Card**, comments. The card numbers
  are in the image links (262 on the newest page). Record slug, deck code and fetch date per deck;
  show them on the deck screen.
- **Tournament Decks** pages (BCS 25/26 World Finals, Bushiroad Summer Festival 2026 ×5) list
  rank, class and player only — **no card lists**. Not a source.
- Showdown Decks (SDD01–SDD06, 2026-03-20): card list from the set code; **quantities not yet
  found** (`/products/sdd01` is 404; look under `/products/category/starter-decks/`).

### 6.4 Assets
As `kb/ASSET-PIPELINE.md`: Flux Studio on :7880, Audio Studio on :7890, ComfyUI on :8188, the
GPU lock file in `C:\Claude Code Projects\.gpu-lock`. Nothing re-verified today.

### 6.5 Rights (owner's question 1)
- `https://en.bushiroad.com/` footer: Privacy Policy and Cookie Policy only; no terms, no
  fan-content or IP guideline link. `https://en.bushiroad.com/terms-of-use/` is 404.
- `https://en.shadowverse-evolve.com/`: same two policies; copyright line `© Cygames, Inc.
  © bushiroad`. No fan-content policy found by search either.
- Precedent: the English Tabletop Simulator mod (Steam Workshop 2967696145) has been updated
  publicly since 2023 with card names and a translated card spreadsheet.
- This project's posture regardless: no official images, logos or frames; no monetisation; an
  unofficial / non-affiliation NOTICE naming Cygames and Bushiroad; one-file takedown lever.

---

## 7. Build order — every stage ends in something that runs and is committed

| # | Stage | Done when |
|---|---|---|
| 0 | `.gitignore` alone (scratch/, tokens, masters); then `CLAUDE.md` (regime + hard rules, `SV`), `kb/` copied, `NOTICE.md`, `docs/rights.md`, `docs/sources.md` from §6 | `ls` every path the docs claim |
| 1 | **Rules first:** CR into `scratch/rules/`; `docs/rules.md` citation index for sections 3–15 with an *Engine* note per entry | every §4 item above has a cited section |
| 2 | **Data:** `tools/build-cards.mjs` scraper + featured-deck importer; `data/cards.js`, `data/decks.js`; glyph normalisation tests; auditor keyword table | every pool card has number, stats, text; every deck is 40/10/1 and 3-copy legal |
| 3 | **Engine spine:** copy lorecannae's engine, rename, replace the Lorcana turn with §4.1–4.8; `docs/ENGINE-API.md` frozen; `tests/01-rules.js` named by CR section | a scripted game of two pool decks runs headless under `tools/sim.mjs --policy random` with invariants |
| 4 | **Card scripts** per class in parallel agents with disjoint files, one behaviour test each, `data/defects.js` for refusals; two independent read-only reviews (scripts vs print, engine vs CR) as soon as content lands | 0 FAIL in the auditor; every deck playable or its missing cards named |
| 5 | **AI** (`js/ai.js` evaluation terms, §4.10), `docs/ai.md` measurements on holdout seeds | hard beats normal, normal beats one-ply, measured |
| 6 | **Interface:** copy `js/ui/*`, re-zone (§4.11), re-theme (§4.12), drags, Quick prompt, viewers for every public zone, log, modes, deck builder, tutorial | **playable in the browser against the AI** — the milestone that matters; checked on the real page from both seats |
| 7 | **Art:** audition (Q4) → identity table → cards + plates via Flux Studio under the GPU lock; prompt lint; contact-sheet IP check | `check-art` green; owner has seen the contact sheet |
| 8 | **Sound:** Audio Studio SFX + ACE-Step music, defense-keyed tiers, `sounds.html` | every log type has a sound or an explicit silence |
| 9 | **Ship:** `stamp-assets`, Pages deploy (Q1), `HANDOFF.md` morning summary, `kb/SVE-LESSONS.md` | `node tools/gate.mjs` green; deployed URL opens and plays |

Hedge: the safe milestone is stage 6 with **two** decks; the brief is every deck on the newest
Featured Decks page.

## 8. Gates (one command, copied from lorecannae)

```
node tools/gate.mjs     # tests, check-pages, stamp-assets --check, audit, replay selftest, random + AI sims
```

## 9. Cut order if time runs short

Tutorial depth → AI-vs-AI controls → deck-builder polish → animation beyond spotlight / lunge /
destroy → music tiers → art for cards outside the first two decks.
**Never cut:** per-card behaviour tests, the defects gate, open-information viewers (EX area,
cemetery, banished, evolve deck tops), the log, prompts that say what they are about, the Quick
window.

## 10. Risks

- **Rights are unknown, not permitted** (§6.5). Owner's call; re-check before any visibility change.
- **The scraper depends on the official site's HTML.** Keep the raw pages in `scratch/`, pin the
  fetch date, and make the builder fail loudly on a shape change.
- **Keyword glyphs in the text view** are icons; a wrong mapping corrupts every card's text. Pin
  with tests on day one.
- **Super-evolve and Advanced cards** are the newest mechanics; the CR has them but the play
  guide does not. Read 12.16, 12.17, 9.2 before scripting any deck that uses them (the newest
  Featured Decks all do).
- **Art IP:** Cygames' characters are as distinctive as Disney's. Same rules as lorecannae D17:
  recognisable by design language, never a copy; contact-sheet check; ban words in prompts.
- **GPU contention and unheard audio**, as before. Budget the lock; ask the owner to listen.

## 11. Status

**2026-10-29.** Owner: "Let's move" — every §1 default accepted, then D5 widened to the Grand
Showdown 2026 winners (and D6 with it). Build started; see git log.
