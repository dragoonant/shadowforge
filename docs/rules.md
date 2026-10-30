# Comprehensive Rules citation index

- **Source:** Shadowverse: Evolve Comprehensive Rules,
  https://en.shadowverse-evolve.com/wordpress/wp-content/uploads/2026/08/20105457/SVEE-Comprehensive-Rules_v1.26.1_260805.pdf
- **Version:** 1.26.1 (file dated 2026-08-05; the PDF's own header says "Last Updated: August 7,
  2026"). PLAN D4.
- **Fetched:** 2026-10-29. The PDF and its `pdftotext` extraction (`cr.txt`, one subsection
  paragraph per line) live in the gitignored `scratch/rules/`. Neither is committed or published.

This is an index, not a copy. Each entry gives the section number, what the section says in
our own words, and an *Engine* note: what the code has to do about it. Short quoted phrases are
the rules' own terms where the exact wording matters. Read the PDF for the authoritative text.
Engine comments cite sections as `CR 8.4.3`; card rulings as `Q147`.

Notation: the PDF's icons (evolve, fanfare, last words, act, engage, quick, serve, ride, the
advanced-ability icon, play-point circles) do not survive text extraction. This index spells them
out and uses the card-text tokens from `CLAUDE.md` (`[evolve]`, `[act]`, `[engage]`, `[feed]` for
Serve, `[cost01]` …). Engine terms follow `CLAUDE.md`: one door per rule (`dealDamage`, `ask`,
`pay`, `move`, `chars`, `heal`). The `Ask` kinds named below (`target`, `orderTriggers`, `quick`,
`keep`, `discard`, `mulligan`, `chooseFirst`, `modes`, `chooseX`, `divide`, `optionalCost`,
`yesNo`, `pickCard`, `wardEngage`, `replacementOrder`, `driveTrigger`) are proposals for
`docs/ENGINE-API.md`.

---

## Numbers the engine needs exactly

| Fact | Value | CR |
|---|---|---|
| Players | 2 (more is unsupported) | 1.1.1 |
| Leader defense at start | 20; no upper limit; may go negative | 2.8.3.1, 6.2.1.12, 1.3.2.4, 5.14.1.1 |
| Who chooses first/second | a randomly picked player decides | 6.2.1.6 |
| Opening hand | 4 | 6.2.1.7 |
| Mulligan | once per player, whole hand to deck bottom (any order), draw 4; first player decides first | 6.2.1.8 |
| First-turn draw | the first player skips the draw on their first turn only | 7.2.4.1 |
| Play points / max PP at start | 0 / 0 | 6.2.1.9 |
| Max PP growth | +1 at each own start phase; range 0..10 | 7.2.1, 3.2.4.1 |
| Play points | range 0..current max PP; refilled to max at own start phase; not emptied at end of turn | 3.2.4.2, 7.2.2, 11.9 |
| Evolution points (EP) | first player 0, second player 3; floor 0; 1 EP may stand in for 1 PP in an evolve or evolve-equivalent cost | 6.2.1.10, 3.2.5, 12.2.3 |
| Super-evolution points (SEP) | 1 each; floor 0 | 6.2.1.11, 3.2.6.1 |
| Super-evolve threshold | **turns passed** ≥ 7 if you went first, ≥ 6 if second (not max PP: Open questions 1) | 12.2.4, 3.3 |
| Super-evolve bonus | +1 attack and +1 defense on top of the evolved card | 12.2.4.1 |
| Evolves per turn | 1, shared with every evolve-equivalent ability (Advanced, Serve, Ride) | 8.3.2.1 |
| Field limit | 5 cards (followers and amulets together) | 4.4.4.1 |
| EX area limit | 5 cards | 4.8.3.1 |
| Hand limit | 7; enforced only in the end phase (discard down if over) | 4.7.3.1, 7.4.7 |
| Main deck | 40–50 cards; no leaders, evolved, advanced or tokens | 6.1.1.2 |
| Evolve deck | 0–10 cards; evolved and advanced cards only | 6.1.1.3 |
| Leader | exactly 1 | 6.1.1.1 |
| Copy limit | 3 per name in the main deck and 3 in the evolve deck (6 total); card text may override (Carrot: up to 10; Cutthroat, Discord Convict: 1) | 6.1.1.4, 6.1.2 |
| Overflow | max PP ≥ 7 | 13.4.1.2 |
| "Half" | rounds up | 5.30.1 |
| Vanguard Critical / Heal triggers | +2 attack to one of your followers / leader defense +3 | 14.4.5.1.3 |

---

## 1. Game Overview

### 1.1 Players
- **1.1.1** Two players only. *Engine:* two seats; the opponent is the other seat (PLAN D13).

### 1.2 Outcomes
- **1.2.1, 1.2.1.1, 1.2.1.2** The game ends when someone loses; the other player wins. Two loss
  conditions: leader defense 0 or less, and having to draw from an empty deck. *Engine:* both are
  applied only by rules handling (11.2), never inline. `endReason` values: `defense`, `deckout`,
  `concede`, `effect`, `draw`.
- **1.2.2** Both players losing at once is a draw. *Engine:* 11.2 checks both seats in one pass
  and may return `winner: null`.
- **1.2.3, 1.2.3.1** Conceding ends the game at once, with no Confirmation Timing; no card can
  force it or replace it. *Engine:* a `concede` action legal for either seat at any time,
  bypassing the job queue.
- **1.2.4** An effect that makes a player win or lose ends the game the moment it is processed,
  again without Confirmation Timing. *Engine:* the door that applies it sets the result and
  aborts the queue; it does not wait for 11.2.

### 1.3 General rules
- **1.3.1** Card text beats these rules. *Engine:* rules are defaults that ability scripts may
  override through named hooks.
- **1.3.2** Impossible actions are skipped; do as much of a multi-part effect as possible.
  *Engine:* effect helpers return partial results (draw 3 from a 2-card deck draws 2, then
  5.10.1.1 applies) instead of throwing.
- **1.3.2.1** Putting something into a state it is already in does nothing. *Engine:* engaging an
  engaged card or refreshing a reserved one emits no event and fires no trigger.
- **1.3.2.2, 1.3.2.2.1** An action based on zero or a negative number does not happen ("deal 0
  damage" is not damage dealt); a negative value never reverses an action; a negative cost is paid
  as 0. *Engine:* `dealDamage` with amount ≤ 0 returns before emitting any event; `costToPlay`
  clamps at 0 only when paying, not when comparing.
- **1.3.2.3** If simultaneous mandatory effects can't all be done, the player picks as many as
  possible. *Engine:* `ask` the affected player which to perform.
- **1.3.2.4, 1.3.2.4.1** Numbers may be zero or negative unless a limit says otherwise; a value
  pushed past a limit becomes the limit. *Engine:* clamps live in the doors that own each value
  (PP, max PP, EP, SEP); attack and defense on cards are unclamped in `chars`.
- **1.3.3** A prohibition beats an instruction. *Engine:* run "can't" checks after "may" and
  "must" in every legality function.
- **1.3.4, 1.3.4.1** Simultaneous selections: before the game in turn order; during the game the
  active player chooses first and the non-active player chooses after seeing it. Non-choosing
  parts of a both-players effect happen together; choosing parts go active player first.
  *Engine:* both-players effects split into a simultaneous phase and sequential `ask`s, active
  seat first.
- **1.3.5, 1.3.5.1** Chosen numbers are non-negative integers; "up to X" allows 0 unless a
  minimum is stated. *Engine:* `chooseX` offers 0..X.
- **1.3.6–1.3.6.3** Missing information (e.g. a spell's attack): the card isn't counted and a
  comparison against it never succeeds. *Engine:* `chars` returns `null` for absent stats and
  every comparison helper treats `null` as false (see Open questions 13).

---

## 2. Card Information

- **2.1.2** A bold-italic name in text means any card with that name or, by context, any card whose
  name contains it. *Engine:* name filters in scripts say `exact` or `contains` explicitly; the
  author decides which, from the print.
- **2.1.2.1, 2.13** An alternate name is matched only when quoted in full, and then it means the
  card's real name. *Engine:* cards carry `altName`; name matching checks it only for a full match.
- **2.3.2, 2.3.3** Types: leader, follower, amulet, spell, crest. Special types: evolved and
  advanced. *Engine:* `type` and `special` are separate fields (Carrot is "Spell / Evolved").
- **2.5.1** Cost is the printed number of play points. *Engine:* printed cost and amount paid are
  different values (10.4.4.1).
- **2.6.2** Reminder text in parentheses has no rules force. *Engine:* never derive behaviour
  from reminder text.
- **2.7, 2.8.1, 2.8.2** Attack is the damage a card deals when it attacks; defense is how much
  damage destroys it; damage lowers defense by the same amount. *Engine:* `chars` gives current
  defense as base defense + modifiers − damage (see 15.1).
- **2.8.3, 2.8.3.1** Leaders have defense, 20 unless stated. *Engine:* `seat.defense`, changed
  only by `dealDamage` and `heal` (and set by 6.2.1.12).
- **2.9** Token information printed on a card is reference only. *Engine:* token stats come from
  the token's own entry (9.1.2.3), not from the referencing card.
- **2.12.2** Universe information matters for deck building; collector numbers tell the faces of
  a double-faced card apart. *Engine:* cards carry `universe`.
- **2.14** Double-faced cards: the front face (with the collector number) counts everywhere except
  on the field, in the evolve zone and in the evolve deck area, where the visible face counts.
  *Engine:* `faceShown` per card in those zones; elsewhere `chars` reads the front. Only relevant
  if a pool card is double-faced (audit).

---

## 3. Player Information

- **3.1.1, 3.1.2** Owner = whose deck the card started in; controller = who is using it, normally
  the player whose zone it is in. **3.1.2.1–3.1.2.4.1** Passive and automatic abilities belong to
  the card's controller; an activated ability to whoever played it; an effect to its ability's
  controller, who also performs any action whose player is unspecified. *Engine:* every effect
  context carries `controller`, fixed when the ability is played; cards carry `owner` and derive
  controller from their zone (5.22 changes it).
- **3.2.1–3.2.4.2** Play points, max play points and EP are per-player numbers. PP pay costs; max
  PP is what PP refills to. Max PP is 0..10; PP is 0..current max. *Engine:* `seat.pp`,
  `seat.maxPp`, clamped by `pay` and the PP-gain door; 11.9 re-clamps PP when max PP drops.
- **3.2.5, 3.2.5.1** EP are counted with "Evolution Point" cards and can replace 1 PP in an
  evolve ability. Floor 0. *Engine:* `seat.ep`; the UI shows a count, not cards.
- **3.2.6, 3.2.6.1** SEP are counted with "Super-Evolution Point" cards and pay for
  super-evolving. Floor 0. *Engine:* `seat.sep`.
- **3.3.1–3.3.2.2** "Turns passed" counts how many of your own turns have begun (skipped turns
  don't count; extra turns do). *Engine:* `seat.turnsPassed`, incremented as the start phase
  begins (before 7.2.1). It, not max PP, gates super-evolution (12.2.4).

---

## 4. Zones

- **4.1.1** One of each zone per player, except the shared resolution zone (4.11.1).
- **4.1.2, 4.1.2.1** Zones are public or non-public; the number of cards in any zone is always
  public. *Engine:* the UI receives ids only for public zones and its own hand and evolve deck;
  otherwise counts.
- **4.1.2.2** A card in a hidden zone can't be guaranteed to meet a condition unless revealed to
  all; a player may treat a qualifying hidden card as absent. *Engine:* "search for X" and "a card
  in your hand that …" effects always offer "find nothing".
- **4.1.3, 4.1.3.1** Order is tracked only where needed; "put Nth from the top" with too few cards
  goes to the far end. *Engine:* deck is an ordered array; positional inserts clamp.
- **4.1.4, 4.1.4.1** A card that changes zones is a new card; effects from the old zone drop off,
  but text that refers to a card it just moved means the moved card. *Engine:* `move` gives a
  new instance id and strips modifiers, except the listed exceptions (4.8.3.3, 10.6.2.1.3,
  10.6.2.8.1.1, 5.22.4); the script gets the new id back from `move`.
- **4.1.5, 4.1.5.1** When several cards enter a zone together, its player orders them; into a
  hidden zone, without showing the order. *Engine:* `ask` (`pickCard` ordering) only for ordered
  zones (the deck); the cemetery is unordered (4.9.2), so no ask there.
- **4.1.6** "Put into [zone]" without a player means the owner's zone. *Engine:* `move` defaults
  to the owner's zone.
- **4.2.2, 4.2.2.3** Cards are reserved (upright) or engaged (sideways), and arrive reserved unless
  told otherwise. *Engine:* `card.engaged`, false on arrival.
- **4.2.3** Faceup or facedown; generally faceup in public zones. *Engine:* `card.faceUp`, used in
  the banished zone and the evolve deck area.
- **4.3** Leader area: public, holds the leader. A "leader" with no zone named means this one.
- **4.4.1–4.4.3.1** Field: followers and amulets, public, unordered, with placement states. A bare
  "follower", "amulet" or "card" in text means one on the field, except cost-changing effects,
  which cover cards played from any zone.
- **4.4.4, 4.4.4.1, 4.4.4.2** Field limit 5. When cards would move to or be created on a field
  past the limit, the effect's controller picks which ones fit; the rest stay where they were (or
  are never created). *Engine:* `move` and token creation check the limit and `ask` the effect's
  controller (`keep`) when more arrive than fit; never auto-pick.
- **4.5** Deck: hidden, ordered; players look or reorder only when a rule or effect says so.
- **4.6.1, 4.6.2** Evolve deck area: hidden from the opponent, open to its owner, unordered.
  *Engine:* the owner's UI lists it; the opponent sees a count plus the faceup cards.
- **4.6.3** Faceup cards in the evolve deck area (spent evolved cards, Carrots, Drive Points,
  advanced cards) are not "in the evolve deck" unless named explicitly. *Engine:* two lists,
  `evolveDeck` (facedown, usable) and `evolveFaceUp`. Q1897–Q1899: faceup Carrot, Drive Point and
  advanced cards are not "faceup evolved followers".
- **4.6.4** A double-faced card may show whichever face matches the evolution being revealed.
- **4.7** Hand: private, unordered; limit 7 (4.7.3.1), enforced only at 7.4.7.
- **4.8.1–4.8.3.2** EX area: a public second hand for unplayed cards, unordered, limit 5, with the
  same "the effect's controller picks what fits" rule as the field. *Engine:* `seat.ex`; cards in
  it are playable (8.2.1) and visible to both seats.
- **4.8.3.3** An effect applied to a card in the EX area stays with it if it moves straight to the
  field. *Engine:* `move` EX → field (and EX → resolution, 10.6.2.1.3) keeps modifiers and counters
  (fusion counters, Fuse buffs).
- **4.9** Cemetery: public, faceup, unordered. *Engine:* viewer for both seats; its counts feed
  Necrocharge and Spellchain.
- **4.10** Banished zone: public, faceup unless an effect says facedown, unordered.
- **4.11** Resolution zone: one, shared, public, ordered (newest on top). *Engine:* `s.resolving`
  stack of cards and abilities being played; a played card sits here while it resolves (13.3.1.3
  and 13.5.1.3.1 depend on it).
- **4.12** Evolve zone: public; holds evolved cards linked to field cards. *Engine:* the link is
  `card.evolvedInto` plus a zone list so 11.6 can find orphans.
- **4.13** Race zone (Umamusume, 14.2): public; Carrot cards linked to a field card.
- **4.14** Drive zone (Vanguard, 14.4.9): public; Drive Point cards linked to a field card.
- **4.15** Trigger zone (Vanguard, 14.4.5): public; holds a card during a drive check.
- **4.16** Equipment zone (Princess Connect, 14.5.2): not in the pool.

---

## 5. Key Notations

- **5.2** X is fixed by the text when possible; otherwise chosen when the card or ability is
  played. *Engine:* `chooseX` at play time (10.6.2.2), stored on the effect context.
- **5.3** A play-point icon is an amount of PP; several X icons multiply. *Engine:* the card
  builder turns `[costNN]` tokens into numbers.
- **5.4** Refresh = make reserved; engage = turn sideways.
- **5.5.1–5.5.2.2** "Put" moves; "summon" puts onto your field; putting a token by name means
  creating it. *Engine:* `summon(seat, tokenName, n)` creates through `move`'s field-limit check.
- **5.5.3** "Put onto the field from [zone]" covers both a direct move and playing it from that
  zone. *Engine:* every arrival records `fromZone` and `viaPlay`, so "from your hand" conditions
  hold for played cards too.
- **5.6** Destroy = from the field to the owner's cemetery. *Engine:* `move(field→cemetery)` with
  `cause: 'destroy'` (Last Words keys off the move, 12.5; "destroyed" triggers key off the cause).
- **5.7** Banish = to the owner's banished zone.
- **5.8** Search: only the searcher looks; when a count is the only condition, that many must be
  found; with other conditions the found cards are revealed; shuffle afterwards whatever happened.
  *Engine:* the search helper always shuffles inside `apply` (seeded) and offers "find nothing"
  when conditions beyond a count apply (4.1.2.2).
- **5.9** Shuffle; a deck of 0–1 cards still counts as shuffled.
- **5.10.1, 5.10.1.1, 11.2.2** Draw = top card to hand. Drawing from an empty deck doesn't end the
  game on the spot: that player loses at the next rules handling. *Engine:* `draw` sets
  `seat.drewFromEmpty`; 11.2.2 reads it.
- **5.10.2, 5.10.3** "Draw X" repeats; "draw up to X" asks before each draw whether to stop.
  *Engine:* `yesNo` before each optional draw.
- **5.11** Look at the top X; "up to X" asks before each card, the same way as 5.10.3.
- **5.12** Discard = chosen cards from hand to cemetery. *Engine:* `ask` (`discard`) of the
  discarding player.
- **5.13** Swap: both moves happen together, or neither does.
- **5.14.1–5.14.1.2** Damage lowers a follower's or leader's defense, possibly below 0; damage to
  anything else does nothing. *Engine:* `dealDamage` ignores amulets and spells.
- **5.14.2** "Deals N more/less damage" effects are replacement effects on the amount. *Engine:*
  damage modifiers inside `dealDamage` (10.10).
- **5.14.3** Kinds of damage: attack damage (attacker to target, 8.4.9), combat damage (both ways
  in a follower fight), ability damage (everything else); unqualified "damage" means all of them.
  *Engine:* `dealDamage(source, targets, n, kind)` with `kind` one of `attack`, `counter`,
  `ability`; "combat" = `attack` or `counter`.
- **5.15** Recover PP: add, capped at max PP. *Engine:* the PP-gain door clamps.
- **5.16.1–5.16.1.4** "Evolve" (by effect or by ability): link a matching card from the evolve
  deck to the field card; the field card then uses the evolved card's information except cost,
  and its type. Outside an evolve ability the player picks a facedown card with the same name and
  reveals it. *Engine:* `evolve(card, evoCard)` sets the link; `chars` reads the evolved card's
  stats, text and type but the base card's cost. An effect-evolve asks (`pickCard`) among matching
  facedown evolve-deck cards; with none, nothing happens.
- **5.16.2–5.16.2.2.1** Evolving keeps identity, engaged state and every applied effect, including
  gained or lost stats; the unevolved card's printed abilities are lost and the evolved card's
  gained, even if worded the same. *Engine:* `evolve` is not a zone change: same instance id,
  modifiers and damage kept; the ability set is swapped (Open questions 9).
- **5.16.3** When the field card leaves the field, the link breaks right after the move.
  *Engine:* `move` from the field unlinks; the orphaned evolved card waits for 11.6.1.
- **5.16.4** Evolving an already-evolved card does nothing.
- **5.17** Transform = banish the targets and create the named token in that zone, one per card
  banished. *Engine:* banish, then create via `move` (field-limit check applies).
- **5.18** "Choose N": pick options, executed in printed order. "Up to N" means 1..N; N = 0 does
  nothing; N above the option count is capped. The choice is made when playing, not on
  resolution, with Spellchain and Necrocharge values taken at play time; only performable
  options may be picked; unpicked options don't exist (their targets need not exist). *Engine:*
  `modes` at play time (10.6.2.2.3); an option with no legal target is not offered; Q1455: an
  option can't be picked twice.
- **5.19** Random selection. *Engine:* seeded RNG inside `apply`.
- **5.20** Dice: a d6; a reroll replaces the last result. *Engine:* seeded RNG; log the roll.
- **5.21** Reveal shows a card without moving it; it stops being revealed when it moves within or
  between hidden zones, or when the effect ends. *Engine:* `revealed` flag cleared by `move` and
  at effect end; the UI shows revealed cards to both seats.
- **5.22** Steal / give control: move to the other field; the controller changes, the owner
  doesn't; it is not a new arrival and keeps everything; if it later leaves the field it goes to
  the owner's zone. *Engine:* `move(field→field)` keeps the instance id and modifiers and emits no
  "put onto the field" event (10.7.4.3).
- **5.23** "Win the game" makes every other player lose (1.2.4).
- **5.24** "Original" / "base" = printed information. *Engine:* `chars(card, {base: true})`.
- **5.25** Changing a card's type removes its other types and keeps its information, but stats
  can't be read on a non-follower; abilities stay; "this [type]" text stops applying except
  "evolve this follower"; non-followers may evolve. *Engine:* a type override applied as a
  non-numeric persistent effect (10.9.1.3).
- **5.26** Skip a turn: it doesn't begin; repeated "skip next turn" skips once. *Engine:*
  `seat.skipNext` boolean.
- **5.27** "+N" / "−N" increase or decrease; setting a value counts as an increase or decrease by
  comparison. *Engine:* "increased" and "reduced" events from `chars` diffs, for triggers that
  care.
- **5.28** An extra turn goes directly before the turn that would have come next; several nest
  newest first. *Engine:* `s.extraTurns` stack.
- **5.29** "For every N …" is computed once from the total (12 cards, every 5 → 2 damage once).
  *Engine:* scripts compute `Math.floor(count / N)` and call the door once.
- **5.30** Half rounds up; the "top half" of a zone is that many cards from the top.
- **5.31** Boxed: loses the abilities it had (keeps ones granted later); doesn't refresh in its
  controller's start phase, but effects can still refresh it. *Engine:* `card.boxed`; 7.2.3 skips
  it; `chars` drops earlier abilities.
- **5.32** Maneuver: an amulet with printed attack and defense becomes a follower for the turn;
  otherwise nothing. *Engine:* an end-of-turn type override (expires at 7.4.8).
- **5.33** Declaring a card name: any real card or token name, never an alternate name.
  *Engine:* `ask` with a name list from `data/cards.js` plus tokens.
- **5.34** Bury: put a card you control into its owner's cemetery; it is not destroyed; with no
  zone named it comes from your field. *Engine:* `move(field→cemetery)` with `cause: 'bury'`
  (Last Words still fires, 12.5; "destroyed" triggers don't).

---

## 6. Game Preparation

- **6.1.1–6.1.1.3** Each player brings one leader, a 40–50 card main deck (no leaders, evolved,
  advanced cards or tokens) and a 0–10 card evolve deck (evolved and advanced cards only).
  *Engine/deck builder:* validate all three counts and the type split.
- **6.1.1.4, 6.1.1.4.1** Up to three copies per name in each deck (six across both); a
  double-faced card counts by its front name. *Engine:* count per deck, per name.
- **6.1.1.5–6.1.1.5.2.1** Each deck has one basis. A **class** basis allows only the leader's class
  and Neutral; a **universe** basis requires the leader and every card to share that universe
  (6.1.1.5.2 sets no class restriction, but see 14.4.2.1.2). *Engine:* each deck record carries
  `basis: {class}` or `basis: {universe}`; the validator branches on it.
- **6.1.2** Deck-building text on cards (Carrot "up to 10"; Cutthroat, Discord Convict "only 1
  copy of any card without Cutthroat in its name", Q2390–Q2392) overrides the defaults and stops
  mattering once the game starts. *Engine:* per-card `deckRule` hooks, read by the validator only.
- **6.2.1.1–6.2.1.5** Present the decks (saying so if there is no evolve deck), place leaders,
  declare the basis for a leader that has both a class and a universe, shuffle main decks, place
  evolve decks. *Engine:* `newGame` does these with the seeded RNG; a dual leader's basis comes
  from the deck record.
- **6.2.1.6** A randomly picked player decides who goes first. *Engine:* seeded pick, then `ask`
  (`chooseFirst`) of that seat; `newGame({first})` may preset it for tests.
- **6.2.1.7, 6.2.1.8** Draw 4. The first player may put the whole hand on the bottom of the deck in
  any order and draw 4 new cards; then the second player may. Once each, all or nothing, no
  reshuffle. *Engine:* a `mulligan` phase with one `yesNo` per seat in order; returned cards go to
  the bottom in an order the player may set (default: hand order, logged), then draw 4.
- **6.2.1.9–6.2.1.12** PP and max PP to 0; EP 0 for the first player and 3 for the second; 1 SEP
  each; leader defense 20.
- **6.2.1.13** Then abilities that work "after redrawing at the start of the game" resolve for
  cards in the deck or on the field. *Engine:* a `gameStart` hook run after mulligans; none known
  in the pool yet (audit).
- **6.2.1.14** The first player becomes active and the game starts (turn 1, start phase).

---

## 7. Game Progression

- **7.1** Turns alternate between an active and a non-active player; each turn runs start, main
  and end phase in order. *Engine:* `s.active`, `s.phase` (`start`, `main`, `end`), `s.step` for
  the end-phase substeps.

### 7.2 Start phase
- **7.2.1** Max PP +1 unless already 10.
- **7.2.2** PP set equal to max PP. *Engine:* PP is **not** emptied at end of turn, so unspent PP
  stays available for Quick plays in the opponent's turn (12.3.4).
- **7.2.3** Refresh all your field cards (Boxed cards stay engaged, 5.31.3).
- **7.2.4, 7.2.4.1** Draw 1; the first player skips this on their first turn.
- **7.2.5** Confirmation Timing, then the main phase.
  *Engine:* one job `startPhase(seat)`: `turnsPassed++` (3.3), max PP, PP, refresh, draw, then
  `confirm()` (10.5). "Until the start of your next turn" durations end as the phase begins.

### 7.3 Main phase
- **7.3.1, 7.3.2** "At the start of (your / each player's) main phase" triggers, then Confirmation
  Timing.
- **7.3.3** Loop: play a card from hand or EX area (8.2), play an activated ability (8.3), attack
  (8.4), or end the main phase. *Engine:* main-phase `legalActions` = `play`, `activate`
  (includes evolve), `attack`, `endMain`.
- **7.3.3.1** Ending is illegal while an effect still demands something this main phase (e.g.
  "must attack once per turn if able" with an able attacker). *Engine:* `endMain` is absent while
  any forcing condition is unmet and still satisfiable.
- **7.3.4** After every action other than ending, Confirmation Timing, then back to 7.3.3.

### 7.4 End phase
- **7.4.1, 7.4.2** "At the start of the end phase" triggers (including EX-area ones such as crests
  and some advanced cards), then Confirmation Timing.
- **7.4.3** The active player may engage any of their Ward followers. *Engine:* `ask`
  (`wardEngage`, multi-select, empty allowed) only if a reserved Ward follower exists.
- **7.4.4** Confirmation Timing.
- **7.4.5, 7.4.6** Quick window: the non-active player may play a Quick card from hand or EX area
  or a Quick activated ability, or do nothing; after each play, Confirmation Timing and the window
  reopens. *Engine:* the `quick` step, acting seat = the non-active player (`SV.whoActs`);
  actions = legal Quick plays plus `pass`. When no Quick play is legal the step is skipped.
- **7.4.7** If the active player's hand is over the limit (7), discard down to it; Confirmation
  Timing; repeat. *Engine:* `ask` (`discard`, exactly hand size − limit cards).
- **7.4.8** "Until end of turn", "this turn" and "during your turn" effects end. *Engine:* expire
  durations keyed `endOfTurn`; reset per-turn counters (Combo, Sanguine, evolve used, "N times per
  turn") here, after 7.4.7, so they still read correctly during the Quick window in 7.4.5.
- **7.4.9** The turn ends; the other player becomes active (skips and extra turns per 5.26, 5.28).

---

## 8. Main Phase Processes

- **8.1.2** An action that can't be fully performed can't be chosen. *Engine:* `legalActions`
  lists only actions whose every part (targets, cost, field space) is possible; `SV.whyNot`
  explains the missing ones.
- **8.2.1** Play a card from hand or EX area by paying its cost in PP (procedure 10.6).
  *Engine:* `play` actions from both zones; EP never pays card costs.
- **8.3.1** Play an activated ability of a card you control (procedure 10.6). *Engine:*
  `activate {iid, ability}`; Fuse abilities activate from hand (12.18, Q2364).
- **8.3.2, 8.3.2.1, 8.3.2.2** Some activated abilities count as evolve abilities (Advanced 12.16,
  Serve 14.2.2.5, Ride 14.4.9.5). Only one evolve or equivalent per turn, unless an effect lets
  that ability be played any number of times. *Engine:* `seat.evolveUsedThisTurn`; evolve,
  advanced, serve and ride actions are absent while it is set (unless the card's exemption
  applies). Evolving by an effect (5.16) does not set it.

### 8.4 Attacking
- **8.4.1** The active player attacks an enemy leader or enemy follower with a follower.
- **8.4.2, 8.4.2.1** Attacker: a **reserved** follower you control that has been on your field
  since the turn began, or that evolved this turn. *Engine:* `card.enteredTurn` (set by `move`
  and by stealing) and `card.evolvedTurn`; Storm, Rush (12.9, 12.10) and racing (14.2.3) waive the
  first condition.
- **8.4.3, 8.4.3.1** Target: an **engaged** enemy follower, or the enemy leader only if the
  attacker has been on your field since the turn began. So a follower that arrived and evolved
  this turn may attack engaged followers only. *Engine:* the target list per attacker is built in
  `legalActions`, never in the UI. Modifiers: Assail (reserved followers too), Intimidate (can't
  be picked), Ward (must pick an engaged Ward follower if possible), Rush (followers only), Storm
  (Open questions 2), "can't attack enemies" (no targets).
- **8.4.3.2, 8.4.3.2.1** No legal target means no attack. *Engine:* attackers with an empty
  target list are not offered.
- **8.4.4, 8.4.5, 8.4.5.1** Engage the attacker; it has now "attacked"; a follower target and the
  attacker are "in combat" while both stay on the field. *Engine:* `s.attack = {attacker,
  target}`; Strike, Leader Strike and Follower Strike become pending here (12.7).
- **8.4.6** Confirmation Timing (Strike and other "when this attacks" triggers resolve).
- **8.4.7, 8.4.8** Quick window for the non-active player, reopening after each play with
  Confirmation Timing.
- **8.4.9, 8.4.9.1** If the attacker is still on the field, it deals damage equal to its attack to
  the target; a follower target deals its attack back at the same moment. *Engine:* one
  `dealDamage` call carrying both instances so they land together (`kind: 'attack'` and
  `'counter'`); nothing if the attacker left. Target gone: Open questions 4.
- **8.4.9.2** If both are still in combat, they have "fought" (Bane, 11.3.2).
- **8.4.10, 8.4.11** Confirmation Timing (destruction, Drain, after-attack triggers), then the
  attack and the combat end. *Engine:* clear `s.attack` after that confirm.

### 8.5 Granting Rush — Sealed only
- **Appendix B-1 8.5, 8.5.1, 8.5.1.1** The main rules have no 8.5. The Sealed appendix adds one:
  once in a main phase, if no evolve or equivalent was used that turn, pay 1 PP (1 EP may stand in)
  and flip a facedown evolve-deck card faceup to give a follower Rush; that also uses up the turn's
  evolve. *Engine:* not implemented; Constructed only (Open questions 3).

---

## 9. Handling Special Card Types

### 9.1 Tokens
- **9.1.1, 9.1.1.1** Tokens are treated as cards for counting and effects. *Engine:* tokens are
  cards with `token: true`; every count includes them.
- **9.1.2–9.1.2.3** Creating a token puts it into that zone; owner and controller are that zone's
  player; its information comes from its name (Appendix A). *Engine:* create through `move`, so
  arrival events fire (a summoned token's Fanfare triggers). Token definitions come from the card
  site's token text, cross-checked against Appendix A (whose table extracts jumbled).
- **9.1.3** Eliminating a token removes it from existence; it has left its zone. *Engine:*
  `move(…→null)` emits a leave event.
- **9.1.4–9.1.4.3** Follower and amulet tokens can exist only in the EX area, the field and the
  resolution zone; crest tokens only in the EX area; spell tokens only in the EX area and the
  resolution zone.
- **9.1.4.4** A token moved anywhere else is eliminated right after the move, with no Confirmation
  Timing and before the rest of the effect. *Engine:* `move` performs the move (so leave and
  arrival triggers such as Last Words still see it), then eliminates it inline.
- **9.1.5** Crests: at most one crest of a given name per EX area; a duplicate is not created or
  not moved. *Engine:* the creation helper checks the name; crest abilities work only in the EX
  area (10.3.6).
- **9.1.6** Physical stand-ins for tokens. No engine impact.

### 9.2 Advanced cards
- **9.2.1, 9.2.2** An advanced card moved anywhere other than the field, EX area, resolution zone
  or evolve deck area goes faceup into the evolve deck area at once, before the rest of the
  process. *Engine:* `move` redirects advanced cards inline (unlike evolved cards, which wait for
  11.6.1). Q1251, Q1252: advanced followers are not "evolved" followers. How an advanced card gets
  out of the evolve deck is card text (12.16); audit the pool's advanced cards before scripting.

---

## 10. Playing and Resolving Cards and Abilities

### 10.1 Ability types
- **10.1.1.1, 10.1.1.1.1** Activated: "[cost]: [effect]", played by choice when allowed.
- **10.1.1.2–10.1.1.2.2** Automatic: "when(ever) …" or "at the start of …", played when the event
  happens; some carry a cost. *Engine:* trigger hooks per event (`fanfare`, `lastWords`,
  `onEvolve`, `onSuperEvolve`, `strike`, `startMain`, `startEnd`, …).
- **10.1.1.3, 10.1.1.3.1** Passive: always on while valid; anything not written as the other
  kinds. *Engine:* `auras`, read by `chars` and by legality checks.
- **10.1.1.4** Spell ability: the text of a spell.

### 10.2 Effect types
- **10.2.1.1–10.2.1.3.3** One-shot, persistent (fixed or open duration), replacement ("instead").
  Damage increases and decreases, and changes to how a card is played (including its cost), are
  replacement effects. *Engine:* three shapes: inline door calls, `auras` / timed modifiers with
  an expiry, and `replace` hooks.

### 10.3 Valid and invalid
- **10.3.2, 10.3.3** "Invalid while …" switches part of an ability off (and skips its
  selections); "valid while …" switches it on only then. *Engine:* condition predicates per
  ability.
- **10.3.4–10.3.6** Abilities work only in the zone they clearly belong to; follower and amulet
  abilities only on the field unless stated (e.g. "if this card is in your EX area"); crest
  abilities only in the EX area. *Engine:* each script declares `zones`, default `['field']`.

### 10.4 Costs and payment
- **10.4.1–10.4.2.2** Paying a cost = doing its actions in the listed order; partial payment is
  impossible. *Engine:* `pay` is all-or-nothing; an unpayable action is absent from
  `legalActions`.
- **10.4.3** A cost with no player named belongs to the ability's controller.
- **10.4.4, 10.4.4.1** A PP icon in a cost means "have at least N PP and subtract N"; cost changes
  alter the PP paid, not the printed cost. *Engine:* `SV.costToPlay(card)` versus printed `cost`.
- **10.4.5, 10.4.5.1** A cost that lowers or raises a value needs at least that much, and may not
  push it past a rules limit or below zero. *Engine:* "remove 2 counters" needs 2; a "pay N
  defense" style cost needs leader defense ≥ N.
- **10.4.6, 10.4.6.1** An engage icon in a cost engages this reserved field card (or the named
  one), even on the turn it arrived. *Engine:* no summoning sickness on `[engage]` costs.
- **10.4.7–10.4.7.5** "[cost]: [effect]" inside non-activated abilities is an optional payment:
  for "when playing … :" the choice is made at play time; in automatic abilities and elsewhere, at
  resolution. A keyword before a colon is not itself a cost, except Earth Rite. *Engine:*
  `optionalCost` asked at play time or at resolution per these rules, offered only if payable.

### 10.5 Confirmation Timing
- **10.5.1, 10.5.1.1** The only moments at which rules handling happens and pending automatic
  abilities are played.
- **10.5.2.1–10.5.2.4** Loop: apply all rules handling simultaneously until none remains; then, if
  the active player has pending automatic abilities, they pick one, play and resolve it, and the
  loop restarts; otherwise the non-active player does the same; when neither has any, it ends.
  *Engine:* `confirm()` is lorecannae's `settle()` reshaped: `rulesHandling()` to a fixpoint, then
  one pending ability of the active seat (else the non-active seat), then loop. With two or more
  pending for the deciding seat, `ask` (`orderTriggers`); never auto-pick. It runs exactly where
  the turn structure says (7.2.5, 7.3.2, 7.3.4, 7.4.2, 7.4.4, 7.4.6, 7.4.7, 8.4.6, 8.4.8, 8.4.10),
  not after every effect.

### 10.6 Playing and resolving
- **10.6.1** Cards and activated and automatic abilities are played and then resolve; passive
  abilities simply apply.
- **10.6.2.1, 10.6.2.1.1** Name the card or ability; a card is revealed and goes to the resolution
  zone; an ability of a card in a hidden zone (Fuse, from hand) reveals that card until it
  resolves.
- **10.6.2.1.2** Something that can't be played (no legal target, unpayable cost) can't be named.
  *Engine:* absent from `legalActions`.
- **10.6.2.1.3** Effects and counters on an EX-area card follow it into the resolution zone.
- **10.6.2.2–10.6.2.2.4** Prerequisite choices, in order: X where an optional cost or mode count
  needs it, optional additional costs (Earth Rite, "when playing … :"), modes (5.18), then any X
  still open. *Engine:* `ask`s in exactly this order inside the `play` job.
- **10.6.2.3–10.6.2.3.3** Then **targets**: anything selected other than a card in a hidden zone.
  A fixed number must be filled as far as possible; "up to N" allows 0; if a required target is
  missing, the play is illegal and rewinds. *Engine:* targets are chosen at play time (unlike
  lorecannae's resolve-time choices); choices of hidden cards (hand, deck) happen at resolution.
  A play needing a target with none available is absent from `legalActions`. Aura (12.15) filters
  opposing targets here.
- **10.6.2.4–10.6.2.4.3** Dividing a number (e.g. split damage): each chosen target gets at least
  1, or the targeting is illegal; with nothing to divide among, the step is skipped. *Engine:*
  `divide` ask.
- **10.6.2.5–10.6.2.5.4** Work out the cost (base, then an alternate cost if chosen, then
  set-to-value effects, then additions) and pay all of it; a part changed by a replacement effect
  still counts as done; a zero part counts as done; if unpayable, rewind. *Engine:* `pay(seat,
  costSpec)`; EP substitution is a separate payment route for evolve-type abilities.
- **10.6.2.6** A follower or amulet can't be played if the field is already at its limit.
  *Engine:* follower and amulet `play` actions are absent with 5 cards on the field.
- **10.6.2.7** Now it has been "played". *Engine:* emit `played` (Combo counter, "when you play"
  triggers) here, after costs.
- **10.6.2.8–10.6.2.8.2.3** Resolve: a follower or amulet goes to the field (keeping effects it got
  in the resolution zone); a spell or ability carries out its text in order (an ability resolves
  even if its source moved; modes in printed order); cards left in the resolution zone then go to
  the cemetery. *Engine:* a spell `move`s to the cemetery after its text, which is why it doesn't
  count itself (13.3.1.3).

### 10.7 Automatic abilities
- **10.7.1, 10.7.2, 10.7.2.1** A met trigger condition makes the ability pending, once per
  occurrence; it is played at the next Confirmation Timing. *Engine:* `s.pending`, a list of
  `{seat, iid, ability, payload}`.
- **10.7.2.2** An "N times per turn" ability can become pending at most N times a turn; when more
  triggers happen together than the cap allows, the controller picks which. *Engine:* per-ability
  turn counter; `ask` when the cap cuts a simultaneous batch.
- **10.7.3–10.7.3.2** Pending abilities must be played; their controller picks the order; one that
  can't be played (e.g. no legal target) is dropped. *Engine:* "may" lives only inside effect
  text; an ability itself is never skipped by choice.
- **10.7.4–10.7.4.1.3** Zone-change triggers read card information on the public side of a
  public/hidden move, on the field side when leaving the field, and otherwise after the move.
  *Engine:* `move` snapshots `chars` before moving and passes it in the payload (10.11).
- **10.7.4.2** A card moving together with others sees their moves (two followers leaving at once
  each see the other leave). *Engine:* batch moves gather triggers against the pre-move state of
  the whole batch.
- **10.7.4.3** Moving between fields is not entering a field. See 5.22.
- **10.7.5, 10.7.5.1** Delayed triggers fire once unless a time frame is given.
- **10.7.6, 10.7.6.1** State triggers ("when you have no cards in hand") go pending once each time
  the state is reached; after resolving, they can go pending again if it still holds. *Engine:*
  checked in `confirm()` with a per-ability "already pending" flag.
- **10.7.7** A pending ability is still played even if its card has changed zones.

### 10.8 One-shot effects
- **10.8.1** Done once.

### 10.9 Persistent effects (layers)
- **10.9.1–10.9.1.6.2** Order for computing a card's information: printed (or the linked evolved
  card's, minus cost) → abilities given, removed, validated or invalidated → other non-numeric
  changes → numeric changes; a dependent effect goes after what it depends on; otherwise by
  timestamp (passives by when their card entered its zone, the rest by when played). *Engine:*
  this is `chars()`'s algorithm.
- **10.9.2** A persistent effect from a non-passive ability affects only the cards it found when
  played, not later arrivals (field-to-field moves keep it). *Engine:* timed modifiers store the
  affected instance ids; passive `auras` are recomputed live.
- **10.9.3, 10.9.3.1** Zone-wide changes apply as a card enters; arrival triggers see the changed
  card. *Engine:* `move` computes `chars` with auras before emitting arrival events.

### 10.10 Replacement effects
- **10.10.1, 10.10.1.1** The replaced event never happened (nothing triggers on it).
- **10.10.2–10.10.2.3** Several replacements for one event: the affected player orders them (for a
  card or ability, its controller; for a game action, the player performing it or the controller
  of the card it affects); each applies at most once. *Engine:* `replace` hooks run in a loop with
  `ask` (`replacementOrder`) when two or more apply.
- **10.10.2.4** Cost replacements: set-to-value first, then increases and decreases.
- **10.10.2.5, 10.10.2.5.1** A card's own "instead" (self-replacement) applies before others.
- **10.10.3** For cards arriving on the field or in the EX area, replacements see the card as
  changed by that zone's persistent effects. (Stack's "remove a counter instead", 13.3.2.2, is a
  replacement.)

### 10.11 Final card information
- **10.11.1** If an effect needs a card's information or placement in a zone it has since left
  (other than field to field), use how it last was there. *Engine:* `move` keeps a
  `lastKnown[iid]` snapshot; scripts read `ctx.lki(iid)` for sources that left (Last Words,
  Strike after the attacker died).

### 10.12 Source
- **10.12.1–10.12.1.3** An ability's effect comes from its card; rules handling has no source; a
  delayed trigger's source is its creator's. **10.12.2–10.12.2.3** An attacking follower is the
  source of its attack damage; ability damage comes from the ability's card unless stated;
  "this deals more damage" modifies damage whose source is this. *Engine:* `dealDamage` takes a
  `source` iid (null for rules); modifiers match on it.

---

## 11. Rules Handling

- **11.1.1–11.1.3** Automatic rules, applied only at Confirmation Timing; a condition that came
  and went before then is ignored; everything applicable happens simultaneously. *Engine:*
  `rulesHandling()` collects every applicable item below, applies them together, and repeats until
  none apply. Never destroy eagerly inside an effect.
- **11.2.1** Leader defense ≤ 0 loses. **11.2.2** A player who had to draw from an empty deck since
  the last rules handling loses. *Engine:* both seats checked together (1.2.2 draw).
- **11.3.1** A follower with defense ≤ 0 is destroyed. **11.3.2, 11.3.2.1** A follower that fought
  a Bane follower since the last rules handling is destroyed, and that counts as destruction by an
  ability. *Engine:* `card.foughtBane` set at 8.4.9.2; destruction via `move` with
  `cause: 'destroy', byAbility: true` for Bane.
- **11.4.1** Too many cards on a field: its player keeps a limit's worth and the rest go to the
  cemetery. *Engine:* `ask` (`keep`); arises only when the limit itself drops, since arrivals are
  already capped (4.4.4.2).
- **11.5.1** The same for the EX area.
- **11.6.1** An evolve-zone card no longer linked to a field card goes faceup to the evolve deck
  area. *Engine:* this is when a destroyed evolved follower's evolved card becomes a faceup
  evolve-deck card (it counts for "faceup evolved" effects only from then).
- **11.6.2, 11.6.3** If a link becomes one-to-many, the controller keeps the most recent (or picks
  among simultaneous ones); the others unlink (and then fall under 11.6.1).
- **11.7.1** An amulet with Stack and no Stack counters goes to the cemetery.
- **11.8.1** (Umamusume) An unlinked Carrot in the race zone goes faceup to the evolve deck area.
- **11.9.1** PP above max PP drops to max PP.
- **11.10.1** (Vanguard) An unlinked Drive Point in the drive zone goes faceup to the evolve deck
  area.
- **11.11.1, 11.11.2** (Princess Connect) Unlinked equipment tokens are eliminated; equipment
  follows its follower's controller. Not in the pool.

---

## 12. Keywords and Keyword Abilities

- **12.1.1, 12.1.2, 12.1.2.1** Several trigger keywords sharing one effect may be printed as
  consecutive icons or with slashes; each is a separate ability (e.g. Fanfare / Last Words: X).
  *Engine:* the card builder splits them into one hook per keyword sharing an effect function.

| CR | Keyword | What it does (our words) | Engine |
|---|---|---|---|
| 12.2 | Evolve | Activated ability `[evolve] [costNN]: Evolve this` printed on the base follower. As part of the cost, reveal a same-named facedown card from your evolve deck, then evolve (5.16). 1 EP may replace 1 PP (12.2.3). An evolved card's own evolve ability can't be played (12.2.5). | `activate` routes: PP only, or EP plus the remaining PP; one per turn (8.3.2.1); `pickCard` if several matching evolved cards differ. Sets `evolvedTurn` (8.4.2.1). |
| 12.2.4 | Super-evolve | When evolving with the ability, if your turns passed is ≥ 7 (went first) or ≥ 6 (went second), you may also pay 1 SEP: after linking, +1 attack and +1 defense; the card has both "evolved" and "super-evolved". | A separate payment route on the evolve action carrying `sep: 1`; the +1/+1 is a permanent modifier on the instance; fires On Evolve **and** On Super-Evolve. |
| 12.3 | Quick | A Quick card or Quick activated ability may be played in the opponent's turn after one of their followers attacks (8.4.7) and in their end phase (7.4.5), as well as in your own main phase. | `quick` steps owned by the non-active seat; Quick-granting text is valid in the zones the card can be played from (12.3.6). |
| 12.4 | Fanfare | Triggers when this card is put onto the field from any zone other than a field. | Arrival hook with `fromZone !== 'field'`: plays, summons, returns from the cemetery; not steals (10.7.4.3). |
| 12.5 | Last Words | Triggers when this card goes from the field to the cemetery (destroyed, buried, rules handling). | Leave hook `field→cemetery` reading last-known information (10.7.4.1.2), so an evolved follower uses its evolved Last Words. |
| 12.6 | On Evolve | Triggers when this card evolves (by ability or by effect). | `onEvolve` hook fired by `evolve`. |
| 12.7 | Strike / Leader Strike / Follower Strike | Triggers when this attacks; the Leader and Follower versions only for that kind of target. | Pending at 8.4.5, resolved at 8.4.6. |
| 12.8 | Ward | (i) May enter the field engaged; (ii) may be engaged in your end phase (7.4.3); (iii) an attacker must pick an engaged Ward follower of yours if possible. | (i) `yesNo` on arrival; (ii) `wardEngage`; (iii) target filter in `legalActions`. Assail interplay: Open questions 5. |
| 12.9 | Storm | May attack the turn it arrived. | Waives 8.4.2.1's "since the turn began"; leader targeting: Open questions 2. |
| 12.10 | Rush | May attack the turn it arrived, but only an engaged follower. | Waives 8.4.2.1; that turn its targets are followers only. |
| 12.11 | Assail | May target reserved enemy followers as if they were engaged. | Widens the follower target set. |
| 12.12 | Intimidate | Opponents can't pick it as an attack target (cards and abilities still can). | Removed from attack target lists only. |
| 12.13 | Drain | Whenever it deals attack damage, its leader gains that much defense. Not for damage it deals back as an attack target or by abilities; extra instances count as one. | Automatic: goes pending on the attack-damage instance and resolves at 8.4.10's Confirmation Timing through `heal`; boolean keyword in `chars`. |
| 12.14 | Bane | Any follower that fought it is destroyed at the next rules handling, even with 0 damage taken. | `foughtBane` flag (11.3.2), whether the Bane follower attacked or defended. |
| 12.15 | Aura | Opponents' cards and abilities can't select it; it can still be attacked. | Filter in target selection (10.6.2.3) for opposing controllers; "each" / "all" effects still hit it. |
| 12.16 | Advanced activated ability | A special activated ability; 1 EP may replace 1 PP in its cost; counts as an evolve ability. | Shares the evolve-per-turn flag; EP payment route. Icon lost in extraction (Open questions 6). |
| 12.17 | On Super-Evolve | Triggers when this card super-evolves. | `onSuperEvolve` hook. |
| 12.18 | Fuse | From hand, `[act] Fuse [cards]: [text]`: as the cost, discard (from hand) or bury (from your EX area) the named cards other than this one, and put this card from hand into your EX area; then the text. Discards and burials may be mixed; a variable number must be at least 1 if possible; the card has undergone "fusion" and the spent cards were "fused". | `activate` from hand (Q2364), main phase only unless Quick; cost picks by `ask`; the card keeps fusion counters and buffs from the EX area onto the field (4.8.3.3). 12.18.3 vs 10.4.2.2: Open questions 7. |

---

## 13. Class-Specific Information and Keywords

Only Forestcraft, Runecraft, Dragoncraft and Abysscraft have class keywords in the CR. Swordcraft
and Havencraft have none (their mechanics are card text).

- **13.2.1 Combo (Forestcraft)** "Combo (X)": you have played at least X cards this turn, this one
  included; cards and tokens played from any zone count. *Engine:* `seat.cardsPlayedThisTurn`,
  incremented at 10.6.2.7 for cards only (not abilities), reset at 7.4.8.
- **13.3.1 Spellchain (Runecraft)** "Spellchain (X)" / "SC (X)": at least X spells in your
  cemetery. The resolving card is in the resolution zone, so it doesn't count itself; the number
  is fixed when the effect starts resolving; for a "choose" count, use the number at play time.
  *Engine:* `ctx.spellchain`, a snapshot taken at resolution start (at play for modes).
- **13.3.2 Stack (Runecraft)** Three abilities: the amulet enters with 1 Stack counter; if it
  would leave the field while it has counters, one counter is removed instead and it stays; an
  activated ability moves all its counters to another Stack amulet you control. 13.3.2.3: with
  no counters it goes to the cemetery (11.7); 13.3.2.4: "add X to a Stack" puts X counters on one.
  *Engine:* counter `stack`; the stay-on-field part is a `replace` hook on every leave-field move;
  the transfer is an `activate` whose cost icon is lost in extraction (Open questions 6).
- **13.3.3 Earth Rite (Runecraft)** "Earth Rite (X)": an optional additional cost when playing the
  card or ability: remove X Stack counters from one of your Stack amulets; if that took its last
  counter, it goes to the cemetery straight away; if paid, the text happens. X defaults to 1.
  *Engine:* `optionalCost` at play time (10.6.2.2.2), offered only if some amulet has at least X;
  the emptied amulet `move`s inline (Last Words fires), not through 11.7.
- **13.4.1 Overflow (Dragoncraft)** Active when your max PP is at least 7. *Engine:* a predicate on
  `seat.maxPp`.
- **13.5.1 Necrocharge (Abysscraft)** "Necrocharge (X)" / "NC (X)": at least X cards in your
  cemetery; the same self-exclusion and snapshot rules as Spellchain. *Engine:* `ctx.necrocharge`.
- **13.5.2 Sanguine (Abysscraft)** Active if it is your turn and your leader has lost defense this
  turn. *Engine:* `seat.lostDefenseThisTurn`, set by `dealDamage` (and any other decrease, Open
  questions 8) during that seat's own turn; reset at 7.4.8.

---

## 14. Universe-Specific Information and Keywords

- **14.1** Universes may add information and keywords. Universe rules apply to the cards that
  carry them, not only in universe-based decks, unless the rule says otherwise (14.4.5.1.2,
  14.5.1.2). Crossover cards such as Mejiro Ramonu (Havencraft, Umamusume universe) can sit in a
  class-based deck.

### 14.2 Umamusume: Pretty Derby (pool: Mejiro Ramonu and others, Carrot)
- **14.2.1.1, 14.2.1.1.1** Serve X: if the card has no linked race-zone card, its controller puts
  X Carrot cards from their evolve deck into the race zone, linked to it. X defaults to 1.
  *Engine:* `serve(card, x)` moves X facedown Carrots from `evolveDeck` to `raceZone` with
  `linkedTo = card.iid`; with fewer than X Carrots it isn't payable as a cost (10.4.2.2).
- **14.2.1.2, 14.2.1.2.1** Serving a card that already has a linked Carrot does nothing, and then
  can't serve as a cost. *Engine:* the Serve action is absent for an already-served follower.
- **14.2.1.3** The link breaks right after the card leaves the field; 11.8.1 then sends the Carrot
  faceup to the evolve deck area. *Engine:* handled like evolve links (5.16.3, 11.6.1); faceup
  Carrots are what cards like Cheval Grand turn facedown again.
- **14.2.2.1–14.2.2.3** Serve as a keyword ability: an activated ability printed as X `[feed]`
  icons and a cost, meaning "serve this follower X times, plus [cost]: [effect]". The pool's form
  is `[feed] [cost01]: Race this follower.` *Engine:* `activate` whose cost is `serve(self, X)`
  plus PP.
- **14.2.2.4** 1 EP may replace 1 PP in a Serve cost. *Engine:* EP payment route, as for evolve.
- **14.2.2.5** Serve is equivalent to evolve: it uses the turn's single evolve (8.3.2.1).
- **14.2.3.1, 14.2.3.1.1** Race X: while linked to a race-zone card, the card has Rush and counts
  as having "raced" X times (X defaults to 1). *Engine:* Rush granted in `chars` while
  `raceLinked(card)`; `card.raced` count (cumulation: Open questions 10).
- **14.2.4** On Race: triggers when this card races. *Engine:* `onRace` hook fired by the race
  effect.
- **Carrot** (card text, not CR) is "Spell / Evolved" and says up to 10 copies may go in the evolve
  deck (a 6.1.2 override of 6.1.1.4). It is never played or evolved into; only Serve spends it.
  *Engine:* `deckRule` max 10; never a "corresponding" card for an evolve (5.16.1.1.1). Q1898: a
  faceup Carrot is not a faceup evolved follower.
- **Deck basis.** The pool's Umamusume cards carry a class, so a Mejiro deck may be class-based;
  14.2 sets no basis requirement, so Serve and Race work either way.

### 14.3 THE IDOLM@STER CINDERELLA GIRLS — not in the pool
A deck based on this universe starts with five Magical Item tokens (which have alternate names)
in its EX area, placed during preparation before the first player is chosen; "Lesson (X)"
banishes X Magical Items from the EX area. *Engine:* not implemented.

### 14.4 Cardfight!! Vanguard (pool: an Aichi Sendou leader)
- **14.4.1.1** Vanguard cards may carry one of four Trigger icons: Critical, Draw, Stand, Heal.
  *Engine:* `card.trigger` (`critical`, `draw`, `stand`, `heal` or null) from the card builder.
- **14.4.2.1.1, 14.4.2.1.2** A Vanguard-based deck must include at least one Starting Amulet card,
  and every Trigger card in it must be of the leader's class. *Engine:* validator rules when the
  deck's basis is this universe. The Aichi Sendou leaders list under Swordcraft on the card search
  (confirm in the card data), so the 6.2.1.3 class-or-universe declaration applies.
- **14.4.3.1, 14.4.3.2** In setup, before the main deck goes into the deck area, the player puts a
  Starting Amulet from it onto the field facedown; after mulligans it turns faceup. The game
  therefore starts with 39–49 cards in that deck. *Engine:* `newGame` moves one Starting Amulet
  (copies share a name, 14.4.4.1.1, so no ask), then flips it after 6.2.1.8. Its Fanfare: Open
  questions 11.
- **14.4.4.1, 14.4.4.1.1** Starting Amulet is a deck-building passive: every Starting Amulet card in
  your decks must have the same name. *Engine:* validator.
- **14.4.5.1–14.4.5.1.5** Drive check: move the top card of the deck to the trigger zone. If your
  deck isn't based on this universe, put it on the bottom and stop. If it has a Trigger icon you
  may resolve it: Critical gives a follower on your field +2 attack; Draw draws a card; Stand
  refreshes a follower on your field, which then can't attack the enemy leader this turn; Heal
  raises your leader's defense by 3. Resolving one satisfies "when you drive check a Trigger"; a
  resolved Trigger card goes to the cemetery; a declined or non-Trigger card goes to the bottom of
  the deck. *Engine:* `driveCheck(seat)` job: `move` top → trigger zone (empty deck: nothing
  happens, and no loss, since it is not a draw); `ask` (`driveTrigger`, resolve or not); `target`
  among your followers for Critical and Stand; Heal through `heal`; emit `driveCheckedTrigger`;
  then `move` to the cemetery or the deck bottom. Critical's duration: Open questions 12.
- **14.4.6** Single Drive = "Strike: perform a drive check"; Twin Drive = "Strike: perform 2".
  *Engine:* `strike` hooks granted through `chars`.
- **14.4.7.1–14.4.7.3.2** Drive is a marker keyword that does nothing by itself. Giving Drive to a
  follower that has ever been given it does nothing; otherwise it gains Drive, Single Drive and
  Rush. *Engine:* `card.everDriven` on the instance (a new instance after a zone change starts
  clean, 4.1.4; Open questions 14).
- **14.4.8** On Drive: triggers when this card is given Drive. *Engine:* `onDrive` hook.
- **14.4.9.1–14.4.9.3** Ride: an activated ability that gives this follower Drive. Its cost adds
  putting a Drive Point card from your evolve deck into the drive zone, linked to this card; 1 EP
  may replace 1 PP; usable only if it hasn't been used for this card this game. *Engine:*
  `activate` guarded by `rideUsed` on the instance; the effect gives Drive (14.4.7.3), then runs
  the text. The opening icon of 14.4.9.2 is lost in extraction (Open questions 6).
- **14.4.9.4** The Drive Point link breaks when the card leaves the field; 11.10.1 sends the Drive
  Point faceup to the evolve deck area. Q1454: linked Drive Points are not faceup evolve-deck
  cards.
- **14.4.9.5** Ride is equivalent to evolve (one per turn, 8.3.2.1).

### 14.5 Princess Connect! Re: Dive — not in the pool
Union Burst abilities are invalid everywhere unless the deck is based on this universe;
"executed" means played and resolved; executing one "without paying its cost" ignores its original
cost (and an automatic one's trigger condition), with any player-chosen X as 0. Equipment tokens
live in the equipment zone, are linked to a follower ("equip"), may stack several per follower,
and are eliminated when unlinked (11.11). *Engine:* not implemented; if a PriConne-universe card
ever enters a class deck, its Union Burst text is inert (14.5.1.2).

---

## 15. Miscellaneous

- **15.1.1–15.1.4** Counters are named ("[qualifier] counter"); counters with the same name are
  identical whatever put them there. *Engine:* `card.counters`, a map by name (`stack`, `fusion`,
  …), changed only through doors. Damage is a number on the card (2.8.2), not a named counter;
  both vanish when the card changes zone (4.1.4) unless an exception keeps them (4.8.3.3,
  10.6.2.1.3).
- **15.2.1, 15.2.1.1** Perpetual cycles: the active player proposes a sequence and a repeat count;
  the non-active player accepts or cuts it short by naming an action to insert. *Engine:* not
  modelled interactively; a loop guard in `apply` caps repeats of an identical state-and-action
  pair and the sim reports it.
- **15.2.1.2** An action that leaves the state exactly as it was may not be repeated. *Engine:*
  enforced by the same guard.
- **15.2.1.3** A cycle neither player can stop is a draw. *Engine:* the guard ends the game with
  `endReason: 'draw'`.

---

## Appendices

- **Appendix A — Token List.** Name, class, trait, cost, attack, defense and text of every
  follower, amulet, spell, equipment and crest token (the crests include the Omen sets' "Crest: …"
  tokens). *Engine:* the extraction jumbles this table; the builder takes token data from the card
  site and a test compares names and stats against a hand-checked subset of Appendix A.
- **Appendix B-1 — Sealed.** Decks of 30+ cards from opened packs, no copy or class limits,
  leader optional, plus 8.5 Granting Rush. **Appendix B-2 — Cross Craft.** Two leaders of
  different classes; both classes plus Neutral; at least one card of each class. *Engine:* neither
  format is offered.

---

## Open questions

Places where the CR is silent, ambiguous or inconsistent, or where PLAN disagrees with it. Each
states what the engine does until a ruling or card Q&A says otherwise.

1. **12.2.4 vs PLAN §4.1 (super-evolve gate).** PLAN says SEP is usable from max PP ≥ 7 / 6; the
   CR gates it on **turns passed** ≥ 7 / 6 (3.3). They diverge whenever max PP is ramped or
   reduced, or a turn is skipped or extra. The engine follows the CR; PLAN §4.1 needs correcting.
2. **12.9 vs 8.4.3.1 (Storm and the leader).** Storm only waives the attacker condition
   (8.4.2.1); 8.4.3.1 still allows the leader as a target only for a follower on the field since
   the turn began. Read literally, Storm could never hit the leader on arrival, which defeats the
   keyword and Rush's contrasting "only if an engaged follower is selected". Ruling: Storm also
   waives the 8.4.3.1 leader condition.
3. **8.5 is Sealed-only.** PLAN §4.5 cites 8.5, but the main rules stop at 8.4.11; 8.5 (Granting
   Rush) exists only in Appendix B-1. Not implemented for Constructed.
4. **8.4.9 (target leaves).** The CR covers the attacker leaving but not the target leaving during
   the Quick window. Ruling: no damage, no "fought", no Drain; the attacker stays engaged and has
   still "attacked".
5. **12.8 (iii) with 12.11 (Ward vs Assail).** Assail treats reserved followers "as if they were
   engaged"; it is unclear whether a **reserved** Ward follower then becomes a forced target.
   Ruling: Ward forces only actually engaged Ward followers.
6. **Icons lost in extraction** at 13.3.2.2 (Stack's transfer ability cost), 12.16.2–12.16.3 (the
   advanced activated icon), 12.18.2 (the "()" before Fuse), 14.2.2.3 (Serve), 14.4.9.2 (Ride's
   leading icon) and 12.1.2's example. No PDF renderer is installed here. Card text shows `[act]`
   for Fuse and `[feed]` for Serve; confirm Stack's transfer cost and the advanced icon visually
   before scripting those cards.
7. **12.18.3 vs 10.4.2.2 (Fuse with nothing to fuse).** 10.4.2.2 says an unpayable cost isn't paid
   at all; 12.18.3 implies the ability can still be played with nothing to discard or bury, the
   text then not happening. Ruling: Fuse is offered only when at least one eligible card exists
   (12.18.2.2's "more than zero if possible"); 12.18.3 covers only odd cases (X forced to 0).
8. **13.5.2.2 (Sanguine).** "Lost defense" isn't defined: damage only, or also "−N defense" effects
   and defense paid as a cost? Ruling: any decrease of the leader's defense during its own turn.
9. **5.16.2.2 (per-turn limits across evolution).** Evolving swaps printed abilities; the CR
   doesn't say whether an "N times per turn" count on the unevolved ability carries over to an
   identically worded evolved one. Ruling: different abilities, so the count does not carry; check
   card Q&A per card.
10. **14.2.3.1 (race count).** "Considered to have raced X times": unclear whether a second race
    adds to the count or replaces it, and whether the count resets when the Carrot link is lost.
    Ruling: counts add; reset to 0 when unlinked.
11. **14.4.3 (Starting Amulet and Fanfare).** The Starting Amulet is put onto the field during
    setup, facedown, before any Confirmation Timing, then flipped faceup. Unclear whether its
    Fanfare triggers, and when. Ruling: no Fanfare (it entered facedown, with no information);
    only 6.2.1.13 "after redrawing" abilities apply.
12. **14.4.5.1.3.1 (Critical duration).** "+2 attack" has no duration, unlike Stand's "rest of the
    turn". Ruling pending a Q&A: until end of turn. Also open: a Critical or Stand with no follower
    on your field. Ruling: it may still be resolved (cemetery, trigger condition met) for no
    effect, since resolving is optional anyway (14.4.5.1.5).
13. **1.3.6.2 = 1.3.6.3.** The two subsections are word for word the same; one was probably meant
    to say something else. The engine treats missing values as failing every comparison.
14. **14.4.9.2 / 14.4.7.3.1 ("this card", "this game").** Ride's once-per-game and Drive's "ever
    given" are tied to "this card", but a card that changes zones is a new card (4.1.4). Ruling:
    tracked on the instance, so a follower that leaves and returns may ride again.
15. **13.2.1 (Combo and Quick).** Cards the non-active player plays during the active player's turn
    count as "played this turn" for that player; the CR doesn't say so for Combo explicitly.
    Ruling: counted per seat per turn, reset at 7.4.8.
16. **10.6.2.3 (targets fixed at play, checked when?).** Targets are chosen when the card is played,
    but the CR doesn't say what happens if a target is gone or no longer legal at resolution.
    Ruling: 1.3.2 applies: do what can still be done and skip the rest.
