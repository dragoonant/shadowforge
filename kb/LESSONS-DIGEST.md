# LESSONS DIGEST — nine games of evidence, distilled for Lorecannae (Disney Lorcana)

Compiled 2026-10-24 from the canonical knowledge base in `MANAFORGE/`. Every line below is a
lesson that cost a previous project something. **MUST** marks lessons that were learned
painfully: repeated across several files, the subject of an owner complaint, or a bug that
shipped green. Where two sources disagree, **the later source wins** (the series' own rule);
conflicts are called out in §0.

The owner is referred to as **evilgouki**. Home paths are written `~`.

## Source key

| Tag | File (all in `MANAFORGE/` unless noted) | Project it came from |
|---|---|---|
| L1 | `CARD-GAME-LESSONS.md` | 1 MegaRobotWar (original design) |
| L2 | `CARD-GAME-LESSONS-2.md` | 2 Starbound Legions (Star Wars: Unlimited) |
| L3 | `CARD-GAME-LESSONS-3.md` | 3 Crystal Wars (FFTCG) — stack, priority, payment solver |
| L4 | `CARD-GAME-LESSONS-4.md` | 4 BreachForge (Riftbound) — battlefields, score race, arena |
| L5 | `CARD-GAME-LESSONS-5.md` | RIVALFORGE (Marvel Rivals, original design, first human playtest) |
| L6 | `CARD-GAME-LESSONS-6.md` | GRAND LINE (One Piece) — compiler, per-card audit, owner's favourite |
| MAL | `MALLET-42K-LESSONS.md` | Mallet-42k (3D 40k; method control group) |
| PB | `OVERNIGHT-BUILD-PLAYBOOK.md` | the overnight method |
| HF | `HANDOFF-FAB.md` | handoff into Flesh and Blood |
| HN | `FleshAndBloodTCG/HANDOFF-NEXT.md` | FABFORGE open work |
| HM | `HANDOFF.md` | handoff into Magic (MANAFORGE), newest; FABFORGE lessons |
| PRES | `CARD-PRESENTATION-SPEC.md` | binding UI spec |
| LOG | `CARD-LOG-AND-TARGETING-SPEC.md` | binding UI spec |
| FAN | `CARD-FANNING-SPEC.md` | binding UI spec |

---

## 0. Conflicts resolved (later evidence wins)

| Question | Earlier said | Latest word | Lorcana answer |
|---|---|---|---|
| Card face text | Generated from effect data (L1 §1, L2 §2.3) | Regime-dependent: reproduction → **printed text verbatim**, generator becomes the auditor (L3 §3.1, L5 §1, HF §2, HM §3) | Reproduction → printed text verbatim |
| Deck matrix / fuzzer | Balance readout (L1 §4) | Crash gate only for a reproduction; balance instrument only for an original design (L2 §1, L4 §7.4, L5 §1, L5 §7.5) | Crash gate + behaviour counters; **no BALANCE.md** |
| Sole forced target | Engine auto-resolves + `autoTarget` notice log (L2 §3.1) | **The choice door has no auto-take path** (L6 §9.1a, HF §7.9, HM §8.9); LOG §4 already said never auto-resolve silently | Always ask |
| Music | CC0 (L3 §9) → procedural generated score (L5 §7.7, L6 §7) | **Owner rejected the generated score ("the music sucks"); ElevenLabs music + SFX with a synthesised fallback voice** (HM §8.18, HN §6) | ElevenLabs |
| Helper agents | Cheap model for bulk (L2 §11, L3 §5) | Helpers run on **Sonnet, not Haiku**; each owns a file list and does not commit; lead reviews and re-runs gates (HM §5.6, HN §6) | Single agent by default |
| Keys | From previous project folders (HF §13) | **Only from a gitignored tokens file inside this project folder** (`HF=` / `EL=` lines); never another project's folder; never printed (HM §8.19, HN §6) | Ask owner to drop one in; ignore it in commit zero |
| Deployment | Public GitHub Pages (L2 §10, HF §1.9, FABFORGE deployed) | Decided per rights holder; MANAFORGE is **private and local** because the publisher's policy does not permit it (HM §2); publication is a separate late decision (L3 §10.2, L4 §7.2) | Read Ravensburger/Disney policy first; default private/local |
| Which engine to copy | BreachForge (HF §3.3) | **FABFORGE's engine** (`FleshAndBloodTCG/js/engine.js`, <900 lines) — invocation queue, `ask`, cost and damage doors (HM §0.3) | FABFORGE engine, minus stack/priority (Lorcana has none) |
| Hand layout | Flat centred row (L2 §7) | Fan only if FAN §15 checklist passes; two failures → flat row (FAN §1, §15) | Decide with checklist |

---

## 1. Architecture and engine

### 1.1 The shape (held for nine projects — do not redesign)

- **MUST** No build step: plain browser JS, IIFEs on one global namespace, script order declared in `index.html`, runs from `file://` and a tiny no-cache dev server (L1 §1, L2 §3, L3 §4, L4 §3, L5 §4, HF §3.1, HM §4.1). A `<!-- ui -->` marker lets a Node loader load the engine half (HM §4.1).
- **MUST** Engine surface is exactly `legalActions(s)` / `apply(s, action)` (immutable, deep-copy) / `isTerminal(s)`, plus `whoActs(s)` as the single answer to "whose input is needed" (L1 §1, L2 §3.1, L3 §4, L4 §3, L5 §4, HF §3.1). Deep copy measured at 0.71 ms/apply, 13.6 ms/AI decision — do not optimise immutability away (L5 §4); re-measure on a busier board on day one (HM §4.2).
- **MUST** Every UI affordance derives from `legalActions`; drag path and button path cannot disagree (L1 §1, LOG §15, every later file). Extended by Mallet: **every number the UI displays comes from the engine** — the client never re-derives a rule (MAL §3, HF §7.15, HM §8.15).
- **MUST** One resolution queue is the whole control flow (mulligan, setup, targeting, payment, combat, nested triggers). A pending head owns the turn; only its choices are legal; `legalActions` **throws** on a head that offers nothing; steps with no candidates auto-skip (L2 §3.1, L3 §4, L4 §3, HF §3.1, HM §4.1).
- **MUST** `whoActs` is one function: queue step's `forcedBy` beats step's `player` beats `state.active`. A second copy in AI/UI hung the game when "opponent picks from your revealed hand" fired (L2 §3.1, L3 PR #1).
- The invocation model: an effect `{src, ctrl, ops, answers}` runs on a **copy**; needing a decision throws `Ask`, the copy is discarded, the question parks with answers so far; answering re-runs from pre-effect state. Effects are atomic; **RNG advances only on the run that survives**; an `Illegal` exception drops the invocation and logs `undone` (L5 §9, HF §3.2, HM §1.2, §4.2). FABFORGE `run()` is 22 lines.
- **MUST** Activation/additional costs compile to ops at the **front of the same invocation** — a question asked while paying replays like any other; no second mechanism (L6 §5, L6 §9.2, HF §3.2).
- Seeded deterministic RNG; **every shuffle, reveal, coin inside `apply`**; reproducibility test (L1 §1, L3 §12, HF §3.7, HM §4.1).
- Cards are pure data; abilities are data `{trigger, condition?, effects}`, op `{op, target?, amount?|amountRef?, condition?, saveTargetAs?, useTarget?, then?, else?}`; `else` runs when op fizzled (L1 §1, L2 §3.2).
- New vocabulary goes in extension files wired through hook tables (`extraConditions`, `extraAmounts`, `extraSelector`), never by editing the core; per-group files so parallel slices never touch one file (L2 §3.2, L3 §3.4, L4 §4.1).
- **MUST** New op = handler + describer + test; validation rejects an op with no handler; the describer throws on an op with no prose (L1 §1, L2 §3.2, L4 §3, L5 §4, HM §4.4).
- Per-invocation shared data lives in `state.efx[inv]`, not on context objects (cloned apart by `apply`) (L2 §3.1).
- Nested triggers insert at the front of the queue (newest first) (L2 §3.1).
- **MUST** Simultaneous triggers are ordered by their controller as an in-game choice (turn player first); push-order resolution was wrong in L2 and left as FABFORGE D-1, which blocked a card (L2 §3.1, HN §3a, HM §11.2).
- Saved targets stamp derived facts at save time; any selector referring back to a chosen thing must survive that thing being gone (L2 §3.2).
- **MUST** Write turn history into state from day one (`history` record every op appends to): "if you played X this turn", "the last attack", "a character was banished this turn". Reconstructing from the log is a bug farm (HF §10.1, HM §11.7).
- Scope combat as an object parameterised by its location/participants, not a global `state.combat`; emptying a global mid-resolution produced impossible phases (L3 §11.2.5).
- Locations/battlefields are a zone list, not geometry; "control" is a derived predicate with **one home** (`controllerOf`) (L3 §11.2.1).
- `whyNot(s, who, iid)` returns in words why a card cannot be played — answered "why can't I click this" before it was asked (HM §1.3, L3 §7, L4 §4.7).
- A zone change makes a new object with a new id so stale targets fail naturally; `move` strips mods/counters (HM §11.7).
- Targets chosen on announcement/cast, re-checked on resolution (HM §11.2). Cancel is legal only while a play is being announced, never inside resolution — a Cancel inside a resolving effect stranded its layer (HM §1).
- The AI searches on a **determinized copy** — cannot read deck order or opponent's hand (HM §1.5, §11.8).

### 1.2 One door per rule (the most repeated engine bug in the series)

- **MUST** Every rule has exactly one entry point; extract on the **first** duplication, not the second. Damage, targeting/choice (`ask`/`offerChoice`), cost/payment, stat/characteristics, zone-move, gain-life/lose-life, "an attack gains power" (L2 §3.3, L3 §4, L4 §4.3, L6 §9.2, HF §3.4, HM §4.3, HN §1a Flourish).
  - Evidence: attach legality had 4 copies; `card.cost` read in 5 places (`costOf`); damage written to the object in 11 places skipping prevention; costs paid in 3 places and missed in 4 more (every auto-ability cost was free); target pools sliced per pack skipping Ward-like protection (L2 §3.3, L4 §4.3, L6 §5, L6 §9.2).
- **MUST** A convention a tool can check is a rule; a convention in a doc is a suggestion. **Add a grep to the gate the first time a bypass costs an hour** (paid off 4+ times) (L4 §4.3, L5 §5.3, PB §4, HF §3.6). Strip comments before grepping or the gate fails on its own docs (L5 §9).
- **MUST** When a card fix touches a shared helper, stop and ask which other cards ride it; grep, fix the helper not the card (L3 §3.5, L4 §4.3). Systemic examples: filtered costs unpayable for every card; `chooser:'opponent'` ignored at every call site; a cost counting the paying card itself.
- **MUST** Design the static/continuous-effect layer with an **explicit evaluation order** on day one; a static whose condition queries another object's stats recursed and blew the stack; the reentrancy guard was "a patch, not a model" (L3 §3.5, L4 §7.3, HF §10.5, HM §11.5). One characteristics door (`charsOf`) every reader calls, with a per-state cache.
- Prevention/replacement live inside the damage door and zone-move door with an explicit cited ordering; affected player chooses order when several apply (HF §10.5, HN §3b, HM §11.6).
- State-based checks (lethal damage → banish/destroy, zero-life style losses, tokens outside play) run every time before a player would act, simultaneously, repeated until none apply, then triggers (HM §11.2).
- A pack wrapper around a core door that drops a newly added argument breaks the whole project; wrappers must forward everything (L4 §4.3).
- Two numbers describing one distance drift (log tab slid 19rem, drawer 12rem) — same class as one-door (L4 §4.7).
- Duplicate copies of a filter between core and a pack wrapper should be removed (HN §7).

### 1.3 Validation that refuses to run

- **MUST** Validate content at load: throw on unknown ids, types, keywords, triggers, ops, duplicates (L1 §1, L2 §3.2).
- **MUST** An ability the grammar cannot express is `{ unimplemented: 'why' }`, which validation rejects from any registered deck — never a partial card that plays wrong quietly. "Single biggest quality lever in the series and it cost nothing" (L3 §3.5, L4 §3, L5 §4, HF §3.5, HM §4.4).
- **MUST** A skeleton default that a real value would replace must fail validation when it survives to play (deploy cost defaulting to 5; costs pulled as 0 making 19 cards free; "attach to friendly" stamped on everything) (L2 §2.6, L3 §3.5, L4 §3, L5 §4).
- An empty ability list is structurally valid and silently wrong: invariant "no leader/identity card a registered deck uses has an empty ability" (L2 §4).
- A table keyed by content (art identity, sound flavour, keyword help) fails when content is added without an entry (MAL §5, HF §3.5).
- Deck-construction legality in validation on day one — cheapest fidelity check (L5 §7.4, HF §3.5).
- **MUST** `data/defects.js` + deck-picker filter: content that doesn't play as it reads cannot reach the player; built on day one, empty and wired; deleting the entry restores it (L3 §2.2, L4 §2, L5 §3, HF §4.4). Caveat: it cannot hide a Leader/Hero/required identity card — those must actually be fixed (L6 §3.4, HF §5.1).
- Refusal (`unimplemented`) is not a deviation; DEVIATIONS.md gets a "Not deviations, recorded so they are not mistaken for one" heading (L6 §3.3, HF §4.4).
- **MUST** No defensive fallbacks in UI code — neither `if (!NS.x) {…}` nor `NS.x || {}`. A missing module throws on the first frame. Silent fallbacks shipped: no abilities rendered for two days (text.js not loaded), AI never loaded (opponent played random legal moves, difficulty selector did nothing), 59 paid renders replaced by placeholders. The gate greps both forms (L3 §3.2, L5 §5.3, PB §7, HF §8, HM §4.1).
- **MUST** Script-list equality check: a tool parses `index.html` and `tests.html` and asserts the shared engine script list is identical and in order (L1 §1 "forget the second and tests silently miss it", L3 §3.2, L4 §3).

### 1.4 Names, text and the IP-safe data layout

- **MUST** All display text in one names file from commit one; stable internal ids everywhere else. Retrofitting is miserable (L1 §1, L2 §2.3).
- A `terms` table holds every franchise vocabulary word generated prose would contain; read at render time so a name pack swaps them (L2 §2.3, L3 §11.3, L4 §7.8, L5 §7.8). Decide the list once — renaming later touches every describer.
- Both name sets stay in memory; toggle is a display mode in `localStorage`; ids the pack misses fall back; without the file the game is unchanged and the toggle hidden — the one-commit withdrawal lever (L2 §2.3, L3 §10.3).
- Published words live in exactly two places: gitignored `scratch/` and one generated pack. The pack is loaded by `index.html` only and **a test asserts it is absent under test**, or text tests silently check printed text (L2 §2.2, L3 §10.3). A `nameId` slug is allowed in card data because rules text refers to cards by name (L3 §10.3).
- Card name = `[Short Name], [Subtitle]` for every rules purpose; two versions are two names. Subtitle is never dropped at small size, wraps not truncates; `fullName(card)` for running text (PRES §6).
- Text-quality day-one test: render every card's generated text; fail on empty, doubled spaces, lowercase start, `undefined`, raw boolean leaks (L1 §2, L2 §5). Every describer carries a comment naming its engine counterpart — the failure mode is silent (L1 §2, L2 §2.6, L3 §3.1).
- Inline markup in a dump is data: known tags translate (icons render as icons, meanings confirmed against a card that uses them); **an unknown tag fails the build** / keeps literal text so the gap is visible (L2 §4, L3 §7).

---

## 2. Rules fidelity, content compilation, keyword implementation

### 2.1 Regime

- **MUST** Decide the regime on commit one and write it into `CLAUDE.md` ("decided, not to be re-litigated"): reproduction → fidelity is the product; a divergence from printed behaviour is a defect, never a design choice; never tune a printed number; printed text verbatim on the face (L3 §2.1, L5 §1, HF §1.2, §2, HM §3). Lorcana is a reproduction.
- `docs/rules.md` is a citation index into the publisher's Comprehensive Rules by rule number; every engine rule names its section in a comment; tests named for the rule they assert (L3 §10.4, L5 §7.2, PB §3, HF §14.4, HM §3). When a card and the engine disagree, read the rule and the Q&A, then fix the engine — do not decide (L5 §7.2).
- Record the set and rules version you built against at the top of the printed pack (errata and CR revisions) (L5 §7.4, L4 §7.5 "season rot").
- **MUST** Reproduce the publisher's first-player answer exactly; do not invent a correction. Bandai's answer landed ~50% with zero tuning; a home-made correction needed a sweep (L5 §5.5, L6 §1, HF §6.9, HM §7.9).
- Digital simplifications are allowed only when logged in DEVIATIONS.md with the reason and the CR section; retire the entry in the commit that makes it untrue (L2 §2.8, L3 §6, HF §4.4).

### 2.2 Importing and compiling printed cards

- **MUST** Reproduction at scale is a compiler problem: parse printed text into the effect grammar. **The unit of work is a deck that compiles in full**; set-wide coverage is a vanity number (L6 §3, HF §5.1, HF §10.8, HM §6).
- Treat coverage as a **queue, not a score**: print failing clause shapes largest-first on every run, **weighted by inclusion in registered/candidate decks** (L6 §3.1, HF §10.8, HM §6).
- **MUST** Every pattern anchored `^…$`; a tail group is anchored to what it may be, never tested for what it contains. A greedy group spanning a sentence silently swallowed a second sentence on 67 cards. **A coverage number that goes DOWN after a fix is good news** (L6 §3.2, HF §5.1, HM §6).
- Write a **grammar, not per-card regexes** (FABFORGE's 413 lines of card-shaped regexes compiled 28.8%) — trigger frames, cost-colon frames, keyword frames, a shared filter grammar (HM §1, §6).
- Pattern files load alphabetically, first match wins; before adding a pattern grep every pattern file for the sentence — parallel groups implemented one sentence three times and both copies ran (effect applied twice) (HN §0).
- **MUST** When the compiler emits something new, grep the engine for its consumer; a token only the describer reads is a token nothing executes (one finding unwound into 4 bugs ending "every auto cost was free") (L6 §5, HF §5.1, HM §6).
- When two phrasings compile to one op, the describer is right for only one; the auditor needs a check that each op's prose is unique ("if you have" vs "if there is") (L6 §9.3, HF §5.1).
- Keywords are the cheap half: implement fixed keyword vocabulary as keyword ops first (data sources often carry a structured keywords array), then attack free text (HF §10.8, HM §6).
- One printed text shared by several card ids: compile once with number slots; report coverage per unique text and per printed card (HF §10.8).
- Import specifics: dumps to gitignored `scratch/`, only mechanical fields cross; browser user-agent for sites that 403 (L2 §2.5, HF §11, HM §9). Same slot can mean different things by card type (split at import). A printed 0 may render as "-" — verify against the card image. Fold alt-art printings into the base number (L6 §6).
- Trait/class maps are append-only, read from a map file, never re-derived (a re-derived sorted union shifted every trait one slot) (L2 §2.5).
- Two importers by lifecycle: a full regenerator that must never run after hand-authoring, and an incremental appender below a marker (L2 §2.5).
- Printed numbers over inferred ones; when a number cannot be read, state the inference rule in DEVIATIONS and add a test that fails when the real number arrives (L2 §2.6, L4 §5.4).
- A card can reference another printing/version of the same character — conditions naming a character must name every printing; dedupe rendered names (L2 §4).
- A community meta site is a source for *which* decks, not *what is in* them; mark every deck slot `measured` or `inferred` and show the split; deck provenance (URL, fetch date, choice sentence) on the menu (L6 §6, HF §5.3, HM §1.7).
- Author/compile only what a registered deck needs; the deck registry decides the pool (L2 §2.5, L5 §7.4).
- Approximations stronger or weaker than print are the wrong card ("look at top N" vs "reveal until"; "reveal whole hand" vs "three at random"; forced vs "up to") (L3 §3.5).
- Layout variants (two-faced/split cards): decide per layout compile-or-`un`; never compile one half (HM §6).

### 2.3 The auditor and per-card tests

- **MUST** Build the printed-vs-generated auditor early (diff by id, offline, from the committed pack). It is the only automated way to catch a clause silently dropped for want of a primitive — both sides of a unit test come from the same ability data. First runs found 65 (L3), 7 (L5), 7 (L6) real defects on green builds; FABFORGE never built it and HM lists that as the top thing left undone (L2 §2.6, L3 §3.5, L5 §6.1, L6 §4, HM §1).
- **MUST** Severity split: FAIL = a printed number, keyword tag or named zone absent from the compiled ability; WARN = wording. "An auditor that cries wolf is worse than no auditor" (40 → 0 FAIL / 27 WARN) (L5 §6.1, L6 §4.2, HF §8).
- **MUST** After loosening a gate, prove it still fails on a known-bad case — the auditor started matching printed text against itself and silently passed (L6 §4.1, HF §6.7).
- **MUST** One behaviour test per printed card in a registered deck: put it on a board, play through `apply()`, **assert the side effect, not the resolution** ("cost left the cost area", not "effect resolved"). 22 of the first 78 failed on a build with green suite, auditor and page gate; 8 were engine bugs touching every deck (L6 §5, §9, HF §1.5, HM §6).
- Per-card test findings to expect again: a "play this card" trigger put the card in two places; on-banish/KO triggers never fired because the engine asked where the card was after it left; counter-events resolved after damage (queue order); a permanent type skipped by every timing loop; "all of" stripped as filler; two alternative identities parsed as one selector; a qualifier dropped from a cost (L6 §9.4).
- Coverage tool: random games with a recorder on the op dispatcher; cards PLAYED whose ability never fired are "suspects" each getting a deterministic scenario test (found a dead trigger with a context field never passed) (L2 §4).
- Re-run the audit after every authoring pass — it found the same class three times (L2 §2.6, L3 §12).

---

## 3. AI opponent

- All difficulties are one machine: enumerate `legalActions`, apply, settle forced choices, score `sideValue(me) − sideValue(them)`, pick best. Easy = noise + human-looking blunder rate; Hard = noiseless + reply search (L1 §3, L2 §6).
- `docs/ai.md` weight table with a cited reason per weight: "cite a reason or don't change it"; every weight carries a comment recording its sweep, including the neighbours that measured worse; peak vs plateau noted (L1 §3, L2 §6, L4 §4.4, PB §5).
- **MUST** Score every candidate against the **do-nothing baseline at the same horizon; `pass` is the fallback, not a candidate**. Passing resolves end-of-turn/round (scoring, draw, untap), a windfall no single action matches; the AI held the objective 18–0 with 7 resource and passed; empty turns 9% → 2%. Reappeared in GRAND LINE's counter step exactly as predicted; predicted again for FaB end phase and Magic untap (L5 §5.1, L6 §1, HF §6.5, HF §10.6, HM §7.5). Owner complaint: the AI "didn't play correctly… rounds where nothing was played".
- **MUST** Measure behaviour, not only win rate. Day-one counters: fraction of turns with zero actions; reactive windows declined that it could use; plus game-specific ones (power blocked, hand entering own turn, signature mechanic used per deck — a zero signature count = a deck the AI cannot play). Win rate is blind when both sides share the bug (L5 §5.1, PB §10.3, HF §6.4, HN §4, HM §7.4). Build counters *with* the AI, not two commits later (HM §1).
- **MUST** An evaluator blind to a rule measures itself: a new mechanic measured 19.6% → 19.7% until the evaluator got a term (35.9%); 0 block windows in 32 games until a Blocker term (0 → 59, empty turns 5.5% → 0%). Before measuring any rule ask whether the evaluator can perceive it (L5 §5.2, L6 §1, HF §6.6, HN §4).
- Wasted-play penalty is counter-intuitively large (passing gives the opponent tempo); wasted incidental trigger penalty deliberately small; scope penalties precisely or the AI stops attacking (L1 §3). Read `notice:true` fizzles structurally to tell spent from wasted (LOG §4).
- Evaluator must cost one-shot resources and pitched/spent cards that bought nothing (FABFORGE AI wasted free activations because a spent resource looked free) (HN §4).
- `usableAp()`: ignore temporary stat deltas a unit cannot spend before expiry (L1 §3).
- **MUST** Ties are where stupid moves come from (a fifth of play decided by list order); a "sensible" tiebreaker can measure worse than random — only systematic choices that are right beat random (L1 §3, L2 §6.3).
- One extra ply of search beat four argued weight terms (62.1% vs ~50%): setup-then-payoff lines with an opponent action in between don't exist at one ply. In a score race "can they retake/remove it before I score" is the central question and needs reply search (L2 §6.8, L3 §11.2.3, L4 §7.3).
- Score race evaluation is superlinear near the threshold and values **expected position at your next scoring moment**, not now (L3 §11.2.3).
- A compounding advantage cannot be fixed by a one-off correction (L5 §5.5) — relevant for diagnosing, not tuning, in a reproduction.
- Large action phases: cap/sample `legalActions` for search with deterministic even-stride sampling, never front truncation (L3 §11.2.4). Prune combinatorial attack/block search (HM §11.8.3).
- Cap turns in the arena; report capped games separately (HF §10.6, HM §11.8).
- `legalActions` must return at least one concrete answer for every decision kind (continuous choices need generated candidates) or AI/autoplay cannot drive a game (MAL §5).
- A sim policy never picks `cancel` (it looped play → cancel) (HM §1).
- Do not let a random-play fuzzer stand in for the AI; two harnesses, both before a human sees it (PB §10.4).
- Bot waits for presentation to be idle before acting; watchdog force-answers a bot decision after ~5 s with no progress (MAL §4).
- AI must be loaded in the live page — it wasn't for days and the suite stayed green (L3 §3.2).

### 3.1 Measuring the AI without fooling yourself

- **MUST** Play every pairing in both seats; report only decisive results. The first arena measured pure first-player bias with a p-value (L4 §4.4, PB §5, HF §6.1). Seat-1 win rate is the one number that must be ~50% (L2 §6.2).
- **MUST** Hold every change to a holdout; a textbook proxy-metric peak measured exactly 50.0% head-to-head over 128 games — label such a change "feel, not strength" in the comment (L4 §4.4, L5 §5.4, HF §6.2).
- Random play is the control for any deck spread (AI nearly doubled the apparent imbalance) (L2 §6.1).
- Profile vs profile, both seats, is how you tell whether the AI improved; deck-vs-deck mean is 50% by construction (L2 §6.6).
- A 38-game row invites a story; aggregate first, chase deck-specific effects at 6+ games per pairing (L2 §6.7).
- Count a mechanic's frequency before expecting win rate from it (L2 §6.5).
- **MUST** Commit negative results ("do not re-run this sweep") (L2 §6.11, L4 §4.4, PB §5, HN §4). "Reverted" in a doc is not a revert — check the diff (L2 §6.4).
- A fix that changes nothing is information: the problem is structural (L5 §5.6, PB §5, HF §6.8).
- Run sweeps in a sandbox copy of the repo; in-place sweeps corrupted concurrent test runs and a tidy-up checkout reverted unrelated work (L5 §5.7, HF §6.10).
- Never measure against a tree someone else is fixing; run the matrix on a quiet machine (L3 §3.4).
- In a reproduction the arena is a behaviour check and AI tuner, **never** a reason to change a card (L5 §7.5, HN §4, HM §3).
- Instrument the fuzzer with "never happens" counters (a game that never ends, a life/score that never moves, a window that never fires) — the fuzzer found a rule implemented too permissively (84/96 games capped with zero combat) (L5 §7.5, PB §5).

---

## 4. UI: card presentation, hand, targeting, log, open information

### 4.1 The owner's interface rules (raised on every project)

- **MUST OPEN INFORMATION IS A RULE.** Before the first playable build, walk the rules' zone list and give every public zone a viewer: both discard piles openable any time even mid-prompt; counts for every zone both sides; "look at N" shows **all N** with non-qualifying ones dimmed; everything revealed, discarded, banished or used as a cost is named in the log and findable afterwards; opponent's hidden zones show counts only; any face-up card anywhere hover-zooms (L6 §9.1, HF §1.8, §7.8, §10.7, HM §8.8, §11.10). Gate: an effect that says "look at"/"reveal"/"opponent's hand" must render its cards; fail a question whose `seen` list the UI ignores.
- **MUST** The hover zoom is **one delegated listener on the document**, keyed on a card-id attribute face-down cards don't carry. Opt-in per node meant every later modal (starting with the opening hand) had none (L6 §9.1, HF §8, HM §9).
- **MUST NEVER ASSUME A CHOICE** — not a target, not a payment, not an order. The choice door has **no auto-take path**: one option or fifty, the player is asked. Not asked: "this card", "all of", indistinguishable objects, a window with zero legal options. Write it into PLAN.md as a day-one decision and test it with a **single-target case**, because every other test passes either way (L6 §9.1a, HF §1.7, §7.9, HM §0.6, §8.9). A payment solver may pre-select a suggestion; the player confirms in one click (L3 §11.2, HF §10.3, HM §11.3).
- **MUST** Show what the opponent chose: a gate fails any logged event with no player-facing line; an always-visible feed of the last few events under the prompt (L6 §9.1a, HF §7.9, HM §1.4).
- **MUST EVERY PROMPT SAYS WHAT IT IS ABOUT**: the source card, the target, the numbers, what declining does; numbers on the buttons; binary/peek/arrange buttons say what they do, never "OK". Owner complaints: "a choice of keeping or re-rolling without knowing what for" (Mallet), "Pay exhaust me?" (BreachForge) (MAL §3, L3 §7, L4 §4.7, HF §7.14, HM §8.14). One door writes every "may" prompt: a question about a named card with its text beneath; modal options are the card's own clauses in printed order, never "0"/"1"; a modal that can select more than one must allow it (L3 §7, L4 §4.7).
- **MUST** Never draw a result behind the prompt that asks about it; hovering an option highlights the exact object it means (MAL §3, HF §7.17).
- Show the opponent's relevant numbers inside your prompt (MAL §3).
- Read prompt context from **state**, not from the newest log event (a window opened before its event was emitted showed a stale target) (MAL §3, HF §8, HM §9).
- **MUST** Say why a card cannot be played / a control is disabled, next to it, before the first click (L3 §7, L4 §4.7, HM §1.3 `whyNot`).
- **MUST** Pacing is a feature: turn/phase hand-overs hold a beat (≈2.4 s / 1.6 s), any click skips, a timer always bounds; the opponent's turn plays at a speed a person can follow (MAL §3, HF §7.16).
- Spotlight the card the opponent just played at preview size, held long enough to read (L4 §4.7, PRES §7C: travel 500 ms, hold 1200, fade 250; second play finishes the first; click skips).
- The stack/chain (if any) is visible and foldable; any overlay over the play area needs a fold, not just a close (L4 §4.7).
- The log is a drawer whose card names are hover doorways (L4 §4.7).
- Deck and discard are cards on the board with an inspector; card back is a printed back (L4 §4.7).
- Read rules text **beside** the card, never under it: two columns, stacking only below 560px (L3 §7).

### 4.2 Screen and board

- The board is the whole window; everything else is a title screen, an overlaying drawer, or a centred panel; opening a drawer never moves the board (L2 §7).
- Draw the board as SVG from one geometry table: painted outline and DOM hitbox are the same numbers by construction. "Generate art for things that are pictures; draw things that are geometry." A photographed board drifted twice (L2 §7, §8, L3 §8.4, L4 §7.6). Opponent's row mirrors yours.
- Board zone paintings ask for an empty place (no figures, no text, muted, calm centre); two CSS knobs per zone (art opacity, scrim) kept low (L3 §8.4).
- **MUST** Layout is a headless geometry test suite across real viewport sizes: zones never overlap, nothing escapes its mat, size floors hold; make the new assertion fail on the old code first. A green layout test encoded the bug through five owner reports of overflowing cards (L3 §3.3, §4).
- Reserves answer to the dimension they consume (hand reserve as a fraction of width made the hand taller than the board) (L3 §7).
- Never let a layout input depend on content that changes mid-game (prompt height resized the board); overlays may cover cards, layout inputs may not breathe (L3 §7).
- Card size must not depend on how many cards are out; solve size from fixed geometry, then overlap (L3 §7).
- **MUST** One redraw path (`paintBoard()`) that always repaints roles and re-wires drag — a bare re-render stripped both ("drag stops working in Main 1 but not Main 2" looked like a rules bug) (L3 §7).
- Scrollbars suppressed; fix overflow by making content fit (L2 §7).
- Opponent's hand on screen as card backs, one per card (L2 §7); FAN §11: clipped row showing only the top sliver, no hover lift.
- Deck choice is a screen with peek of the identity cards, one seat at a time; "Surprise me"; pre-pick a starting deck from the displayed seed so Start is never greyed (L2 §7, L3 §7).
- A turn banner is `pointer-events: none` (L2 §7).

### 4.3 Card rendering (PRES)

- Five principles: art is the whole card face; text floats on art with scrim + multi-stop shadow, no plate; small card shows identity, big view shows everything; **one renderer, three sizes** (board/hand/preview), typography in `em`, detail block only at preview size; tap inspects, drag commits (PRES §0).
- DOM: art layer (abs, inset 0) + scrim `::after` (`pointer-events:none`) + corners + in-flow plate with `margin-top:auto` in a flex column (PRES §1). Separate `decorate()` for state classes.
- Aspect 5:7 for board/hand; **preview has no aspect ratio**, `min-height` instead (PRES §2).
- `object-fit: cover; object-position: 50% 25%` keeps faces in frame (PRES §3). Always ship a deterministic procedural SVG fallback seeded from card id (PRES §3, HF §9).
- **MUST** Scrim and legibility numbers come from sampling luminance under text across the whole art set (47/169 cards too bright); "raise the scrim, never lighten the art" (L1 §9, L2 §7, PRES §4).
- Four-stop text shadow tight→wide; corner pips get heavier shadow (PRES §5).
- `em` cascades from font-size, not width — each size class must set its own base or every card renders at body size (L5 §6.3, HF §8).
- **MUST** No faction/ink-colour border tint: players read a coloured edge as "playable"; borders carry interaction rings; identity goes in corner pips and coloured words (L2 §7, PRES §6).
- Unaffordable hand cards dimmed (~.58) with the cost pip in damage red, only on your own turn with no prompt, only when the engine confirms cost is the limiting reason; hover restores (L2 §7, PRES §6).
- Exerted/rested/dulled cards **tilt ~4–8°, never 90°** — a quarter-turn laid text on its side exactly when zoomed (L3 §7, PRES §6).
- Four role colours from `legalActions` + pending choice only: actable `#f5c34d` (pulse 1.7 s), selected `#5b9dff`, target `#ff6bcb`, picked `#45c98b`; actable is marked, destinations are not; shared `animationPhase()` negative delay so redraws don't restart pulses (PRES §6, LOG §11).
- Keyword names on the face; explanations in a glossary panel beside the preview; glossary walker is exhaustive (granted keywords, keywords referenced at any depth, triggers); substitute numbers into reminder text; name fallback chain never renders an empty label (PRES §8).
- Token preview: walk the whole definition for token-creating ops; render with a scratch instance in a shallow state copy so printed stats show (PRES §9).
- Hover preview: 300 ms delay (90 chases the pointer, 1000 feels like waiting), fixed overlay, centre the main card not the row, two nested rAFs before `.grown`, abort if dragging, cache by instance id with `invalidate()` (PRES §7A).
- Inspector modal for touch: card → tokens → glossary → actions, `94dvh` (PRES §7B). Spotlight below preview in z-order (PRES §7).
- Responsive: remove secondary content below ~900px rather than shrink; design art for the smallest render (~34px) (PRES §12).
- Accessibility: art `alt=""` + `aria-hidden`; `tabindex=0`; preview on focus/blur; reduced motion honoured (PRES §13).

### 4.4 Interaction and browser traps

- Gesture vocabulary: drag commits, tap inspects, hover previews, right-click secondary, **no long-press**; Pointer Events only; tap vs drag by **distance (8px), never time**; `setPointerCapture` (L1 §7, PRES §10).
- **MUST** `<img>` art needs `draggable="false"` + `-webkit-user-drag:none` — native image drag cancels pointer drags only when grabbed over art (L1 §7, PRES §11).
- **MUST** Suppress the synthetic click after a drop by timestamp AND a capture-phase swallow (350 ms) — you need both (L1 §7, PRES §10).
- **MUST** Every decorative layer and overlay `pointer-events: none` by default; three overlays ate clicks simultaneously in L3 (L1 §7, L3 §7, PRES §10, FAN §7).
- A fresh `pointerdown` finishes a stale gesture whose `pointerup` never arrived (L1 §7, PRES §10). Undraggable cards stay tappable.
- `touch-action: none` on draggables is the one line that makes phone drag work (L2 §7, PRES §10); `@media (hover:none)` disables hover preview.
- Hand drag clones into a drag layer; an attacker stays put and draws an arrow (PRES §10). Drop feedback `.drop-ok` dashed amber / `.drop-hot` solid green; release over nothing is a silent cancel (LOG §15).
- **MUST** `requestAnimationFrame` doesn't fire in background tabs — flush with a forced layout read (`void el.getBoundingClientRect()`) for spotlight/FLIP or animations strand (L1 §7, L5 §6.4, PRES §7C, FAN §6, HF §8).
- Image flicker on full redraw: cache one decoded prototype `<img>` per file and clone, `decoding='sync'` (L2 §7, PRES §11).
- Keyframes touching `transform` outrank inline transforms; stacking order in a `--z` custom property, not inline z-index (L2 §7).
- CSS `background` shorthand wipes `background-image`; grids without explicit width collapse to one column; `grid-row: 1 / -1` doesn't span implicit rows (L1 §7, L3 §7, PRES §14).
- `dvh` not `vh` (L2 §7). Handler closures take the id as a parameter (PRES §14). Clear transient UI state before drawing (PRES §14).
- Plan for keyed reconciliation of card nodes; full redraw eventually flickers (L1 §7).

### 4.5 Hand fanning (FAN)

- Decide first with the six-item checklist (hand ≤8 typical/≤12 max, pointer-primary, cards identified by art/name, container can be `overflow:visible` + ~40px headroom, preview exists, hover owned in JS); two failures → ship the flat centred row (FAN §1, §15, L2 §7).
- The fan is transforms over DOM order = hand order; never the source of truth (FAN §1, §13).
- Model B (overlap, ≤±6° rotation) is the safer default; arc via far-below `transform-origin` (FAN §2–3). Compression: fixed `stepX` until it doesn't fit, `minStepX` ≥ ~20% card width / ≥26px (FAN §4, §7).
- Hover: lift along own axis, straighten to ~0.35×angle, neighbours pushed 1/distance, hover index owned in JS not `:hover`, don't recompute during push (FAN §5).
- FLIP reflow with forced-layout flush; skip FLIP and fade if >6 cards move (FAN §6).
- Never widen hit areas with invisible overlays (steals neighbour clicks) (FAN §7). Drag clone un-rotated, source fades in place, fan doesn't reflow during drag (FAN §8).
- Roled cards raise z-index; consider a top-edge marker for actable in a fan (FAN §10). Touch/narrow falls back to the flat scrolling row (FAN §12).
- Covered cards in an overlapped row hide their text plates (L2 §7).

### 4.6 Targeting (LOG Part Two)

- **MUST** Targeting is a `pendingChoice` (queue step) on state with `min`/`max`, answered by a `{type:'choose', selection}` legal action — AI answers through the same path; undo/replay work mid-prompt; tests need no DOM (LOG §9, L2 §3.1). Design the step with `min`/`max` from the start, never a single `n` (L4 §4.5, L5 §7.3).
- **MUST** Build the one targeting door (`offerChoice`/`ask`) **before the first ability pack**, and make validation/the gate reject an op that picks without it. The targeting retrofit happened twice, both from player reports of cards that "did nothing" (looked at three, showed none, kept one itself) — invisible in the suite because tests supply the choice (L4 §4.5, HF §14.7).
- Three UIs chosen automatically by visibility: board highlight for visible cards; centre modal with real card faces for unseen cards; buttons for non-card options; a yes/no about a hidden card shows that card at preview size (LOG §10, L2 §7).
- Multi-pick: click toggles, refuse past max silently, Confirm disabled (not hidden) until min, "2 of 1–3 selected", Clear, match by set equality, reset picks on undo/new game/every committed action (LOG §12).
- **MUST** The choice modal can be peeked past without answering ("Hide — check the board" + floating "Show the cards" pill, Escape toggles, view-layer state keyed to choice identity) — "the feature everyone forgets" (LOG §13, L2 §7).
- Attack arrow: same picture for aiming (amber) and declared (red), curved, dash-crawl with shared phase, z 45, `pointer-events:none`, recompute on resize (LOG §14).
- While a prompt is open, drag is disabled (LOG §15). Buttons only for non-card actions; hovering a button highlights its card; Decline only when `min===0`, found as the legal empty selection (LOG §17).
- Prompt line always says what the game is waiting for; card says *what*, UI appends *how*; every effect has a default prompt; auto-pass windows show a countdown with tabular numerals (LOG §16).

### 4.7 The log (LOG Part One)

- **MUST** Log entries are structured: `{turn, phase, step, message, data}` with `iid`, `sound`, `notice`, `silent`, `via`. Log panel, audio and AI all read `data`; retrofitting touches every call site (L1 §1, LOG §1, L2 §3.4).
- One `log()` entry point (never `state.log.push`) that stamps `cardId` so lines stay nameable after the card dies, `side` when both seats field the same name, and `via` automatically while a triggered ability drains — a trigger's consequences printed flat read as "the AI took three turns" and were reported as cheating (L2 §3.4, LOG §1).
- Log by player index; humanise to second person at render time with sentinel characters, bare-verb table (`has→have`…), re-capitalise every sentence (LOG §2).
- Card names are live hover targets; whole-line fallback when the name didn't survive rewriting; subject must still exist in state (LOG §3).
- **MUST** The fizzle notice: a card paid for that does nothing says so (`notice:true`), checked before any "affects everything" shortcut (LOG §4).
- Newest first, 60-entry window, skip `silent`; turn dividers styled (LOG §5). Recently-played strip of 5 real card faces, recorded separately from the spotlight (LOG §7). A battle/challenge line of current state with destroyed-unit fallbacks (LOG §8).
- A gate: every engine log type has a player-facing line; every question kind has a prompt; every mapped sound has a voice (HM §1.4, HN §0).

---

## 5. Animation and feel

- **MUST** Build the animation layer — deferred by six card games ("D-7, third time"), closed in about an hour when someone decided to (L3 §12, L4 §5.2, L5 §6.4, L6 §8, HF §9, HM §1, §10). Budget it as a stage, not a TODO.
- Pattern: separate **presented** state from live state; a presentation director plays each batch of log events in order; UI shows presented state while the engine is ahead; the bot waits for idle; every wait bounded by a watchdog; a pause holds the watchdog clock (MAL §4, HF §9).
- `plan(prev, next, log)` pure and headless-tested, `run(steps)` DOM; play on the **old** board so a defeated card is still there to die, then redraw (L2 §5, §7).
- FLIP because the board rebuilds each frame; forced layout read, not rAF (L5 §6.4).
- Input locked under an overlay during playback; any click/key skips; speed setting full/quick/off (or `instant`; tests that must *see* an animation run at `fast`) (L2 §7, MAL §4).
- Defeats shrink into the owner's discard; events fly from spotlight to pile (L2 §7). Batch large rolls into a summary row (MAL §4).
- Escalate the clock audibly and visibly as the game nears its end (score/life) (L3 §9, L4 §7.7, L5 §7.7, HF §9).

---

## 6. Audio

- One module owns every audio decision; the audio layer rides the structured log (`data.sound`); unknown tags ignored so the engine may tag sounds that don't exist; dedupe per batch (LOG §6, L2 §9, L4 §7.7, L5 §7.7).
- **MUST** Voice the sound at the moment of the **picture**, not at apply time; rate-limit frequent tags (max concurrent, min retrigger gap). The rune "siren" fired on every payment and drove the player out of the room (L2 §7, L4 §7.7, L5 §7.7, MAL §4, HF §9).
- SFX were "a day's work and the single largest perceived quality gain" (L3 §9) — do them early.
- **MUST** One `AudioContext` for everything; iPadOS left a mixed `<audio>`/Web Audio context silently parked; `wake()` on state change, gesture, visibility, 1 s poll; test on the device (L2 §7, §9, L3 §9).
- Measure generated audio: crest factor (gunshot 8–20; a clipped asset at 2.2 sounded like a silenced pistol), RMS across the kit within ~±15%, a sound per distinct source; **say "not verified by ear"** when nobody listened (MAL §3, HF §9, HM §10).
- Loops trimmed to the sustained body by RMS envelope, not silence detection; crossfade tiers; one byte-identical musical brief across tier prompts (L2 §9, L3 §9).
- Per-track looping; a finished one-shot must be rewound; a draw keeps the battle track; autoplay refusal = wait for first gesture; mute persists and a muted reload creates no audio element (L3 §9, L4 §7.7).
- Two encodes when looping matters (Opus-in-Ogg gapless + AAC) (L3 §9).
- Lookahead scheduler on the audio clock, never `setTimeout`, if anything is synthesised (L5 §7.7). Owner now wants ElevenLabs music and SFX (HM §8.18).

---

## 7. Testing and verification

- **MUST** Verify in the real browser on the real code path; every UI commit message says what was checked. "Green tests plus a broken page is the most common failure in this series" (L3 §2.4, §3.2, L4 §2.5, L5 §6.3, PB §7, HM §8.5). Read the DOM when screenshots are unavailable; several "bugs" were test artifacts (L1 §9, L3 §5).
- Two entry points, one source: `tests.html` self-runs in the browser; the Node runner parses its `<script src>` tags and runs them under `node:vm` with a bare `window` shim; `--quiet` (two lines), `--filter`, `--full` for slow suites (L1 §4, L2 §5, L3 §4, L4 §6).
- Hand-rolled harness with position helpers (`putOnBoard`, `putInHand`, `giveResources`, `act(state, matcher)` printing every available action on failure); each test states its premise in 2–3 lines (L1 §4).
- **MUST** Prove a test bites: revert the fix and watch it fail. Pair every negative with a positive (a fix that refuses illegal X needs a test that legal X still works) (L2 §5, L3 §3.3).
- **MUST** When a report contradicts a green test, suspect the test; test names state the rule, not current behaviour (L3 §3.3).
- Headless simulator with invariants after **every** step: no NaN, no negative resource, phase order never backwards, every pending decision has ≥1 legal answer that is accepted, every game ends; 200 random games + deck matrix (L1 §4, MAL §5, HF §3.7, HM §4.5). Zero legal actions is a failure.
- Budget the deck matrix (36 decks ≈ 1,400 games blew the runner) (L2 §5).
- **MUST** The black box: every match records seed, deck ids, difficulty, every action and its log entries; "Flag a bug" pins the action index; dev server takes the trace into `traces/`; `replay-report --selftest` reports ILLEGAL / THREW / DIVERGED; replays AI moves rather than re-choosing them. Build it **before the first playtest** (L2 §5.1, L3 §4, L4 §3, L5 §4, HF §3.7). A deck/loadout override must be carried in the trace or replays diverge (HN §2a).
- Content-integrity gates: every deck legal; every card has a display name; names slug to unique art filenames (L1 §4).
- **MUST** Gate the **commit**, not the working tree: a tree showed 81 green while the commit alone was dead on the first `legalActions` (someone else's uncommitted engine) (L4 §4.1).
- CI on push and PR running the headless suite + script-list check + asset-stamp check (L2 §10, L3 §12, L4 §4.2).
- All gates runnable in one command printing a few lines (L4 §6, PB §11).
- A fast full-game end-to-end browser test is the one browser test worth keeping (MAL §5).
- Some UI code becomes headless-testable by splitting pure planning from DOM (L2 §5).
- Do not build heavy spec-first machinery (402-item checklist, adversarial verify loops) before something is playable — 4.8M tokens before the first playable build; aim adversarial verification only at the one dense ordering subsystem (MAL §1, HF §4.5).

---

## 8. Asset pipeline (art)

- **MUST** Three constants under any art direction: **no text rendered in an image**; no reproduction of a specific official illustration (never "the art of X", never an artist, studio, franchise or game name in a prompt); one original rendering style (L3 §8.1, L4 §7.6, L5 §7.6, HF §9, HM §10).
- **MUST** Run a style audition: one representative card in ~ten styles, owner picks, recorded in PLAN.md, not re-litigated. Owner's pick on GRAND LINE and FABFORGE was "E": anime trading-card illustration, polished cel shading, thick ink outlines (HF §1.6, HM §10).
- **MUST** One `STYLE` constant, byte-identical on every generation — what makes hundreds of renders read as one set; pasted back into the art-rules doc when it changes (L1 §5, L2 §8, L3 §8.2).
- **MUST** An identity table: one visual clause per named character written once so repeats match; a subject and **a setting per card** (not one backdrop per colour); a card with no entry fails the build. The anonymous-figure / flat-sky-per-colour first pass was what the owner rejected (HF §1.6, §9, L5 §7.6, L6 §7).
- Prompt rules: never name the card; avoid text-magnet nouns (sign, banner, flag, insignia, label, nameplate; crowded public settings are the biggest text source); never negate (summons ghost lettering); exact counts above two unreliable ("a group of"); front-load the proportion anchor immediately after the name (creatures drifted realistic otherwise); full-bleed environment always (first render was a white-background sticker); genre-lock vocabulary from the first twenty renders; short common words are highest leak risk (L2 §8, L3 §8.3).
- **MUST** A prompt lint that refuses to write the prompts file — and it must lint the STYLE constant too ("three-quarter" tripped the count rule: 160 violations before 147 paid renders) (L5 §7.6, L6 §7, HF §9).
- **MUST** Sample three, look, then batch. Idempotent; `--dry-run` makes zero network calls and prints the whole plan; `--only` exact-match (substring matched the wrong asset); `--force` archives first; `--limit` caps a paid run; 429 back-off; key resolution flag → env → gitignored file (L1 §5, L2 §8, L3 §8.5, PB §6). Budget agreed in advance ($40 on GRAND LINE) (HF §12).
- Crop ~4% off the bottom (model signs its work); still expect QC regenerations. Regeneration is not monotonic — only regenerate failures, archive first (L2 §8, L3 §8.3).
- QC at scale with 16-tile contact sheets and a checklist; never view full-size renders in the main context; borderline tiles get one native-size look (L2 §8, L3 §5). Look at every named character against its identity clause before the batch (the model would not draw a one-armed hero) (HM §1, HN §5). Generic cards show no hero (decide once) (HN §5).
- Hugging Face routes per provider: `router.huggingface.co/{provider}/v1/images/generations`; find a live provider via `/api/models/{id}?expand=inferenceProviderMapping`; FLUX.1-schnell via nscale at 768×1088 = 5:7, ~15 s/card (L6 §7, HF §9).
- Masters never enter the repo; delivery encodes only (WebP q90 ~47 KB/card, or 560px JPEG); decide format before the first asset commit (353 MB → 41 MB); commit an art batch once, after QC (L1 §5, L2 §10, L3 §8.5, HM §10). Check encoding quality before downscaling (PRES §11).
- **MUST** Wire every asset pipeline **empty and failing loudly** before filling it: declare the manifest on the page while it is `{}` (L5 §5.3, PB §10.1, HF §8).
- **MUST** Build the self-diagnostic with the feature: `check-art.mjs` (presence, zero-length, magic bytes, truncation, exact case, root-relative, git-tracked) plus an in-app Art check screen probing every declared image (L5 §5.3, PB §7).
- **MUST** Every declared script/stylesheet URL carries `?v=<hash of contents>`; `stamp-assets --check` in CI — per-file cache ageing shipped a verified fix that rendered broken (L4 §4.2).
- `artUrl(cardId)` is the only place an image path is built (L2 §10).
- Card back is a hand-supplied master shipped in the repo (L2 §7).
- Never run the shrink step while another process is rendering (HN §5).

---

## 9. IP posture and sources

- **MUST** Day one, before code: read the rights holders' published policies from primary pages and record what they say with date and URL in `docs/rights.md`/`docs/sources.md`; "searched on <date>, found none" is a finding. Settles the argument once instead of every session (L3 §10.2, L4 §7.2, L5 §7.1, HF §11.1, HM §2).
- **MUST** State a concern once, in writing, in the file that holds it (NOTICE.md, DEVIATIONS.md, art-rules header), then build what was asked in full. Never deliver a quietly narrowed version; scaling down is the owner's call. Fixed limits: no official art/audio in the repo, nothing sold or monetised, nothing presented as official, no circumvention of technical measures (L3 §2.8, §10.1, L4 §2.9, L5 §3.9, HF §7.11).
- NOTICE.md names the published game once, states non-affiliation and non-commercial, credits third-party audio, gives a takedown contact; same-commit maintenance rule; the disclaimer also renders on a screen the player sees; copy any publisher-required disclaimer verbatim (L1 §6, L2 §2.4, L3 §10.3, HF §11.1).
- `docs/takedown.md` with the real commands that end a deployment (L4 §7.2).
- Check the working title and faction names against the source vocabulary and existing licensed products before they reach a filename, URL or repo name (a rename touched eight files, a repo and a non-redirecting URL) (L2 §2.4, L3 §10.3, L4 §7.2, HM §2.5).
- Licensed crossovers add a second rights holder; avoid them in deck choice when possible (HM §2.4).
- `.gitignore` committed alone before the first tool: `scratch/`, key/token files, masters, archives, traces, rules PDFs, lock files (L1 §10, L2 §12, L3 §12, L5 §8). Sweep history for secrets and scratch paths before any visibility flip; a grep for the key's shape is part of verification (L2 §2.4, MAL §5).
- Never read a generated text pack with `cat`/Read — query one id via `node -e` (L3 §5, L4 §6).
- Bug traces carry ids only so they are safe to paste anywhere; commit messages and docs use ids and mechanical descriptions, never a card name or printed sentence (L2 §2.2, §11, L3 §6).

---

## 10. Process and overnight-autonomy lessons (and mistakes)

- **MUST** Playable first, not endless tests: get something evilgouki can open, click and play as early as possible; every stage ends in something visible; GRAND LINE had a clickable board vs AI before art, sound or a second deck; FABFORGE was playable 33 minutes after `.gitignore` (L4 §2.1, L5 §3.1, L6 epilogue, MAL §1, HF §0.7, HM §1).
- **MUST** The owner's playtest is the specification; one playtest changed four core rules on RIVALFORGE; a small first pool makes that affordable — ship two preconstructed decks and play a real game before importing a set (L5 §2, §5.8, L6 §8, HF §5.2, HN §8.1).
- **MUST** The question round: only questions where a wrong guess costs rework; two rounds of ≤4; **one question about feel**; every other decision stated as a default list correctable in one word; never ask obvious or repo-answerable questions or for permission to proceed (PB §1, §10.5, L5 §3.11, HF §4.1).
- Stage order: `.gitignore` alone → rights recorded → CLAUDE.md with regime → `docs/rules.md` → engine spine + sim → two precons compile in full → AI + behaviour counters → INTERFACE (playable) → auditor → more decks by compile rate → per-card tests → art → sound → registers, handoff (PB §2, HF §4.2, HM §5). The handoff's predictions become the first engine commit (HM §1.1).
- **MUST** Say up front what gets cut if the night runs short: "deck count, never quality" (PB §2, HF §4.2, HM §5.3). Make scheduling trades explicit in PLAN.md (project 3 traded deploy/SFX/animation/AI measurement for fidelity without saying so) (L3 §1).
- **MUST** Commit at checkpoints; a long autonomous run that hits a context or usage wall loses everything uncommitted (two `WIP (agents stopped)` commits; Mallet landed a dead stage by hand) (L2 §11, L3 §5.7, L4 §6.4, MAL §1, PB §8).
- **MUST** Commit messages describe the mechanism, by id — the history becomes a bug diary that makes handoffs writable (L2 §11, L3 §2.6, L4 §2.7, PB §8).
- **MUST** One file owns each decision (PLAN.md with a dated Status rewritten every session); others point at it. BreachForge shipped three files disagreeing about deployment within three days; PLAN.md went stale on day two of six (L3 §6, L4 §5.1, PB §9, HF §4.4). When a decision moves, grep the repo for every file restating it.
- **MUST** `ls` every path a document claims exists before committing it — an auditor documented as existing wasn't written for two days; an architecture doc described a nonexistent `anim.js` (L3 §6, L4 §6.3, L5 §6.1, HF §8).
- Registers, each with a header saying it is not the others: DEVIATIONS.md (rules not yet kept, standing bugs naming CR sections), TODO.md (improvements to correct things; format: what exists today / constraints / done when), `data/defects.js`; BALANCE.md only for an original design (L4 §4.6, L4 §7.4, PB §9, HF §4.4). Handoff work items use "what exists / what will bite / done when" (L4 §9, HN).
- A gate is not discoverable from a commit message: anything that must run after every change goes in CLAUDE.md as a hard rule *and* in CI (L4 §4.2).
- **MUST** One agent per worktree by default; single agent unless the owner sets up several. Shared-tree hazards observed: `git add` stages the other agent's half-finished hunk; `--amend` swallows their staged files; `reset` orphans their commit; `update-ref` on a checked-out branch stages the merge in reverse; `preview_start` serves the primary checkout's config whatever directory you're in; worktrees inside OneDrive defeat the purpose (use a path outside the synced tree); `main`'s checkout is the integration tree nobody works in, landing with `merge --ff-only` and gating there (L3 §3.4, L4 §4.1, HF §4.5, HM §5.6).
- If multi-agent: one stage at a time, commit after each; after a dead run `git status`, gates, commit by hand, rerun; explicit file list per agent; agents never edit the status file, never commit, never install packages; route findings to the owning loop; foreground commands only with capped runtime; cap research ("fetch at most 3 pages") and name spec sections not files; slice by disjoint id ranges with disjoint files; a hard merge gets a second agent plus a reconciliation pass (MAL §2, HN §6, L3 §3.4).
- A branch older than a day is a list of findings to re-verify, not a diff to merge; merge commits say which side won each overlap; hand a shared surface to whichever branch owns it (L2 §5.2, L3 §6).
- **MUST** Token economy (owner is cost-sensitive, was on a metered plan): don't re-read what you know; read large files by range/grep; `--quiet` everything; tools print findings not material (reports to scratch); contact sheets not full renders; don't spawn agents for what one agent can do; if a helper underperforms fix its brief and rerun rather than taking over (L2 §11, L3 §5, L4 §6, MAL §5, HF §4.5, HM §5.7).
- Measure instead of arguing — luminance sampling, pixel geometry and arena counts each ended a debate (L1 §9, L3 §5.10, PB §5).
- A user's diagnosis is a symptom report, not a root cause; also say when the reported thing is not a bug (L1 §9, L3 §2.5).
- Comment the WHY on every weight, penalty and non-obvious branch — "the most valuable habit to carry over" (L1 §9).
- Handoff checklist: all gates green in one command; dated Status true; restated decisions grepped; say plainly what was cut, unmeasured or not reproduced; name the two or three things the owner should form an opinion on first (PB §11).
- Windows machine traps: Git Bash eats backslashes in `sed -i`/`node -e` regex; heredocs containing apostrophes or `\n` mangle — use the Write tool or a `.cjs` script in scratch; Git Bash `/tmp` is not Node's `/tmp`; PowerShell 5.1 has no `&&`, `Get-Content` misreads BOM-less UTF-8 (em dashes as mojibake), `Out-File -Encoding utf8` writes a BOM into commit subjects; PS variable names are case-insensitive (a local `$key` overwrote the `$Key` parameter API key); `-match` replaces `$Matches`; read failed HTTP bodies from `$_.ErrorDetails.Message`; use `git commit -F <file>`; `gh` is not installed (plain `git push`); shell cwd resets — use absolute paths; OneDrive placeholders can make files unreadable — set "Always keep on this device"; locked worktree folders need `git worktree prune` and manual deletion (L1 §8, L2 §11, HF §8, HN §7, HM §9).
- A cached script during a fix pass cost a session — dev server with cache disabled (L2 §10).

---

## 11. evilgouki's taste and recurring complaints

- **He has been right about the shape of these projects every time, including the times he was argued with**; his design instincts beat measurements twice on RIVALFORGE — when he says a rule feels wrong, measure that rule first (L3 epilogue, L4 epilogue, L5 §3.12, HF §7.13).
- Fidelity is the product; "make absolutely sure the cards read and play exactly like the real game"; "I don't want anything playable that contains content that doesn't work correctly" (L3 §2.1–2.2).
- Chooses the real thing: real names, printed text verbatim, recognisable characters; rejected anonymous figures and flat per-colour backdrops; wanted characters' signature features in an original style (L3 §8.1, L5 §7.1, HF §1.3, §1.6).
- Art style pick "E" (anime trading-card illustration, polished cel shading, thick ink outlines) on two games; still ask whether a new game keeps it (HF §1.6, HM §10).
- Rejected the generated procedural score: "the music sucks" → ElevenLabs (HM §8.18).
- Wants the interface beautiful and explained: painted art everywhere, music on every screen, How-to-play, opening video behind the title, readable log, visible chain/stack, zoom with text beside the card (L3 §2.5, L4 §2.6, HF §7.6).
- Recurring complaints (each raised on every project): hidden open information (trash as a bare count, "look at 5" showing only takeable cards); the game making his choices (auto-target, auto-trash, auto-pay); prompts that don't say what they're about; the opponent's turn too fast or unreadable; the AI doing nothing on some turns; cards overflowing the mat; drag only failing over artwork; phases announced where nothing happens (L6 §9.1, MAL §3, L5 §5.1, L3 §3.3, HF §7).
- Wants it playable without a terminal when the rights allow (GRAND LINE/FABFORGE deployed) (HF §1.9); MANAFORGE private/local by his decision.
- Cost-sensitive: hates wasted tokens and paid renders done twice (MAL §5, PB §6).
- Doesn't want to be asked questions with obvious answers or for permission to proceed; wants defaults he can correct in one word (PB §1).
- Does not want concerns repeated or work silently scaled down (L3 §10.1).
- Liked: pre-picked starting deck, deck choice as a screen with peek, no scrollbars, board as the whole window, opponent's hand as card backs, deck provenance shown, `whyNot` explanations (L2 §7, L3 §7, HM §1).
- Favourite project: GRAND LINE ("fantastic") — copy its reasons (HF §1).

---

## 12. Applies to Lorcana

Rules claims below are from general knowledge and **must be checked against Ravensburger's Disney Lorcana Comprehensive Rules** and recorded in `docs/rules.md` by rule number before code relies on them.

**Regime and rights.**
- Lorcana is a **reproduction**: fidelity is the product, printed text verbatim on the face, generator as auditor, no BALANCE.md, deck matrix = crash gate (§0, §2.1).
- Two rights holders: **Ravensburger** (the game) and **Disney** (characters, art) — the most enforced character IP in the series. Day one: read Ravensburger's and Disney's published fan-content/community positions from primary pages, record date and URL; "found none" is a finding. Default **private and local** until evilgouki decides otherwise (HM §2 pattern; L5 §7.1 "both levers": printed text + names). Confirm the working title "Lorecannae" against Lorcana vocabulary and existing products (§9).
- Art: Disney's house style is exactly the imitation risk; never name a studio/film/artist in a prompt; run the style audition; identity table per character ("Name - Version" shares one identity clause, different settings) (§8).

**Engine shape — what Lorcana changes.**
- **No stack, no priority, no instant-speed responses** (confirm): closer to SWU's strict alternation (L2) than FFTCG/FaB. Copy FABFORGE's invocation queue, `ask`, cost and damage doors, but not its stack/priority. `legalActions` for the non-active player is empty except for queue steps with `ctrl` on them (L5 §7.3, L6 §1).
- **Triggered abilities go into "the bag"** (confirm): resolve in an order the controller chooses, active player's first — this is exactly the simultaneous-trigger ordering lesson; build it on day one, never board order (L2 §3.1, HN §3a, HM §11.2). Indistinguishable triggers are not a choice.
- **Damage counters persist** on characters and locations; banish when damage ≥ Willpower as a state-based check before each action (HM §11.2). One damage door with **Resist** inside it (§1.2).
- **Turn structure** (confirm): Ready → Set (start-of-turn effects, location lore) → Draw → Main. The first player skips the turn-1 draw — reproduce the publisher's first-player answer exactly and measure ~50% in both seats; do not tune (L5 §5.5, L6 §1). Mulligan ("alter hand": any number to bottom, redraw) is a real day-one choice with no auto-take (HM §11.1).
- **Deck legality** in validation day one: ≥60 cards, ≤4 copies by full name, one or two ink colours (confirm) (§1.3).

**Ink and the inkwell.**
- Once per turn you may put an inkable card (inkwell symbol) from hand face down into the inkwell — a **choice of which card**, never automatic; it is the analogue of FFTCG's "which card to burn for CP", the decision the AI will tie on (L2 §13.2, L1 §3 ties). Evaluator needs a term for the value of a card kept vs inked; behaviour counter "ink played per turn through turn 5" (HM §11.8.2).
- Paying ink = exerting ink cards; identical ready ink is indistinguishable (not asked card-by-card) (HM §11.3). The ready-ink count is state the UI shows, from the engine.
- **Open information**: inkwell is face-down — show counts (ready/exerted) for both sides; confirm whether the owner may look at their own inkwell. Discard piles public, openable mid-prompt (§4.1).
- Unaffordable-card dim keyed to ready ink, only when the engine says cost is the reason (PRES §6). `whyNot` explains ("needs 4 ink, you have 3 ready"; "not inkable"; "already inked this turn").

**Questing for lore to 20.**
- A **score race**, like Riftbound/RIVALFORGE: evaluator superlinear near 20; value "expected lore before the opponent can respond", not current lore (L3 §11.2.3). Locations generate lore at the start of your turn — value expected control at your next Set step.
- Questing **exerts** the character, exposing it to challenges on the opponent's turn. "Can they challenge and banish it before it quests again" is the central AI question and needs the one-ply reply search (L2 §6.8, L4 §7.3). Score quest vs challenge vs hold against the do-nothing baseline at the same horizon; ending the turn readies everything — the windfall that makes `pass` look best (L5 §5.1, HM §11.8.1).
- Sound and visuals: a distinct escalating cue per lore gained, music tension keyed to the lore line (match point on either side) (L3 §9, L4 §7.7).
- Behaviour counters: turns with zero actions, quests per available ready character, challenges per legal challenge, characters left exerted into a lethal challenge.

**Exerting / ready / drying.**
- Exerted = rested/dull: render with a **small tilt (~4–8°), never 90°** (L3 §7, PRES §6). "Drying" (played this turn, can't quest/challenge/exert to sing unless Rush) is engine-published state the UI shows; both from the engine, never client-derived (MAL §3).

**Challenging.**
- Challenge an **exerted** opposing character (or a location) with a ready, dry character; both deal Strength as damage simultaneously (confirm). Model as a scoped sub-procedure on the queue, not a global combat object (L3 §11.2.5).
- Draw it with the attack arrow (amber aiming, red declared) by dragging challenger onto target; drop targets come from `legalActions` so Bodyguard/Evasive restrictions are never re-derived in the UI (LOG §14–15).
- Prompt/preview shows the numbers from the engine: Strength incl. Challenger, damage after Resist, "this banishes X" (HF §7.15, MAL §3 "show the opponent's numbers").
- Animation: play the damage on the old board so a banished card is still there to die, then shrink into its owner's discard (L2 §7).

**Singing songs.**
- A song is an action that can be paid **either with ink or by exerting a ready, dry character with cost ≥ the song's cost** (Singer N counts as cost N for singing). That is an alternative cost — it lives in the **one cost door**, as ops at the front of the invocation (L6 §5, §9.2). **Never assume which character sings**: if two can, ask; the payment solver may pre-select, player confirms (HF §10.3, HM §11.3). Single-singer case is still a confirm-able choice if ink payment is also possible.
- Newer "Sing Together" (combined cost from several singers) is a variable-count selection — `min`/`max` on the step from day one (L4 §4.5).
- Prompt: "Pay for <Song>: 3 ink, or exert <Character> to sing" with the numbers on the buttons (MAL §3).

**Shift.**
- Shift N: play a character for its Shift cost on top of one of your characters with the **same name** — a target choice through the one door; the new character inherits the base's state (exerted/ready, damage, dry status — confirm) and the stack of cards under it goes to discard together when banished (confirm). Name matching uses the `[Name], [Version]` split: same Name, different Version (PRES §6 subtitle rule; L2 §4 "every printing of the character").
- Cost display: the cost door publishes both normal and Shift cost; never compute in the client.
- Zone-move door handles the "card underneath" pile; state-based banish moves the whole pile; open information shows what's under a shifted character.

**Items and locations.**
- Items are persistent permanents with activated abilities (often exert or banish as cost) — costs through the cost door; one-shot uses need evaluator value (HN §4 wasted activations).
- Locations: a Riftbound-style **zone list**, not geometry — each location has Willpower, lore at start of its controller's turn, a move cost; characters **move** to a location (an action with a cost: enumerate destinations, not paths) (L3 §11.2.1). Location control/occupancy is a derived predicate with one home. Locations can be challenged (damage door, Willpower).
- Board geometry: draw locations as SVG slots from one geometry table, characters placed at them; painted backdrop art per location kept low-opacity (L3 §8.4).

**Keywords — one door each, compiled as keyword ops first (HF §10.8).**
- **Bodyguard**: may enter exerted (a "may" — ask, never assume); opponents must challenge a Bodyguard if able — a restriction inside the one challenge-legality predicate that both `legalActions` and the AI's attack term use (L2 §3.3 "extract the predicate legalActions already uses").
- **Evasive**: only Evasive characters can challenge it — same challenge-legality predicate.
- **Rush**: can challenge the turn it's played (ignores drying for challenges only) — a drying-state exception in one place.
- **Ward**: opponents can't **choose** it except to challenge — lives in the one targeting door (BreachForge's per-pack target slicing skipped Deflect, the same keyword shape; L4 §4.3). Gate: grep for target pools built outside the door.
- **Reckless**: can't quest and must challenge if able (confirm timing — end of turn restriction). Forced action → `legalActions` must still offer at least one concrete answer and must not let the player end the turn while a Reckless challenge is available (MAL §5).
- **Resist +N**: damage reduction inside the damage door, every damage source routed through it (11 bypasses in L4).
- **Challenger +N**: Strength bonus while challenging — part of the stat/characteristics door, displayed from the engine.
- **Support**: when this quests, you **may** add its Strength to another chosen character this turn — a "may" plus a target through the door, asked even with one candidate (L6 §9.1a).
- **Singer N**: modifies sing eligibility in the cost door.
- Glossary panel beside the preview explains every keyword the card has, grants or references at any depth, with N substituted (PRES §8). Keyword help table keyed by content fails the build when a keyword lacks an entry (MAL §5).

**Content pipeline for Lorcana.**
- Import mechanical fields from a community dataset into gitignored `scratch/`, cross-check numbers against a second source; record source, set and rules version (§2.2). Compile printed text with an anchored grammar; the work order is the failing-clause queue weighted by registered decks (§2.2).
- First playable milestone: **two starter decks** (designed to play against each other, small, exercise characters, actions, songs, items, ink, questing, challenging) before importing a set (L5 §7.4, HF §5.2).
- Then the auditor (FAIL/WARN) and one behaviour test per card in a registered deck, asserting side effects (§2.3).
- "Name - Version" cards: the copy limit is believed to count the full name (Name + Version), so two versions of one character are separate cards for deckbuilding but the same Name for Shift. Confirm against the CR and make validation match it exactly.
