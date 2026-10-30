# Writing card abilities

Every card whose printed text does more than the engine reads by itself needs a script:
`SV.card('<card number>', {...})` in `data/abilities/<group>.js` (groups: forestcraft,
swordcraft, runecraft, dragoncraft, abysscraft, havencraft, neutral, universe). `SV.needsScript(id)`
says whether a card needs one; `SV.scriptCoverage(deck).missing` lists what a deck still lacks.

**Read first:** `docs/ENGINE-API.md`, `js/engine.js` (skim), `js/abilities.js` (all of it: the ctx
doors below are the ONLY way a script changes the game), the worked examples already in
`data/abilities/{forestcraft,abysscraft,neutral,swordcraft}.js` with their tests in
`tests/cards-*.js`, and `docs/rules.md` for any keyword you script. Card rulings (official Q&A) for
every pool card are in `scratch/qa.json` (`{ "<card number>": [{q, date, question, answer}] }`):
**read the Q&A of each card before you script it** and cite a ruling in a comment (`// Q1535`)
when it decides how you wrote it.

## What the engine reads by itself (don't script these)

- Keyword lines: `Ward.` `Storm.` `Rush.` `Bane.` `Drain.` `Assail.` `Intimidate.` `Aura.` (any
  combination on one line). Scripts GIVE keywords with `x.give(t, 'Storm', dur)` or `kw` in a mod.
- A standalone `[quick]` line (the card is Quick, CR 12.3.2).
- `[evolve] [costNN]: Evolve this.` / `Evolve this follower.` (the evolve ability, CR 12.2).
- `[feed] [costNN]: Race this follower.` (Umamusume serve + race, CR 14.2).
- Text below/above a `----------` line is read like any other text (the line only groups abilities).
- Deck-building lines ("You can put up to 10 of this card into your evolve deck.").

Everything else is yours. A card with BOTH an engine line and other text gets a script for the
other text only.

## Shape

```js
card('BP16-080EN', {
  // Sugar (js/abilities.js SV.card) — each becomes an automatic ability (CR 10.7):
  fanfare(x, ev) {},          // [fanfare]: put onto the field from another zone (ev.from: 'hand'|'ex'|'cemetery'|'deck'|'gone' (token)|…)
  lastWords(x, ev) {},        // [lastwords]: put into the cemetery from the field (ev.info = final information, CR 10.11)
  onEvolve(x, ev) {},         // "On Evolve -" — put this on the EVOLVED card's number
  onSuperEvolve(x, ev) {},    // "On Super-Evolve -" — on the evolved card's number
  strike(x, ev) {},           // "Strike -" (ev.target, ev.leader); followerStrike / leaderStrike likewise
  mainStart(x, ev) {},        // "At the start of your main phase"; mainStartZone: 'ex' for a crest
  endStart(x, ev) {},         // "At the start of your end phase";  endStartZone: 'ex'
  // Raw automatic abilities (anything else: "whenever …", "at the start of each opponent's …"):
  triggers: [{ name, on: 'event' | ['a', 'b'], zone: 'field'|'ex'|'cemetery'|'hand'|'equip'|'any',
               when: (s, me, ev) => bool,   // trigger condition, checked when the event happens
               limit: 1,                    // "[N] per turn" / "Once on each of your turns" (CR 10.7.2.2)
               run(x, ev) {} }],
  // Activated abilities (CR 10.1.1.1): "[act] [cost]: effect"
  activated: [{ text: 'short label shown on the button',
                cost: { pp: 2, engage: true },   // play points / [engage]; other costs go in pay(x)
                quick: true,                     // [q][act] — usable in the opponent's Quick windows too
                zone: 'field'|'ex'|'cemetery'|'hand',   // where it can be activated (default field)
                once: true,                      // "Activate only once per turn"
                onceGame: true,                  // "once per game" for this card
                epOk: true,                      // "you may use 1 evolution point in lieu of 1 play point" (advanced activated, CR 12.16)
                evolveLike: true,                // "equivalent to an evolve ability" (CR 8.3.2.1: shares the once-per-turn evolve)
                can: (s, me) => bool, why: (s, me) => 'sentence',   // "Activate only if …" + the reason shown when not
                pay(x) {},                       // non-PP costs in printed order: bury this, discard, banish from cemetery, Fuse …
                run(x) {} }],
  spell(x) {},                // a spell's text (resolves from the resolution zone)
  canPlay: (s, iid) => bool,  // CR 10.6.2.3.3: a spell/card that must select ≥1 target can't be played without one;
  cantPlayWhy: (s, iid) => 'sentence',   //   also any "can only be played if …"
  quickIf: (s, iid) => bool,  // "This card has Quick while …"
  // Passive abilities (CR 10.1.1.3), applied by SV.chars for EVERY card t that is on a field / in an EX area:
  auras: [(s, me, t, r) => { if (t === me && cond) r.atk += 1; }],   // r: {atk, maxDef, kw, flags, traits, type …}
  lateAuras: [...],           // same, run after mods/effects (read r.kw finished)
  leaderAuras: [(s, me, p, r) => {}],    // characteristics of leader p (r.flags …)
  exAuras: true,              // this card's auras/triggers are valid in the EX area (advanced cards, rare)
  selfCost: (s, iid, p) => -2,           // "This costs N less/more to play …" (delta)
  setCost: (s, iid, p) => 0 | null,      // "This costs 0 to play if …"
  costAura: (s, me, iid, p) => -1,       // "Your <X> cards cost 1 less to play" (delta for card iid of player p)
  blockPlay: (s, me, iid, p) => bool,    // "Your opponent can't play …"
  replaceDamage: (s, me, ev) => ev.amount + 1,   // damage modifiers (CR 5.14.2): ev {target, amount, src, kind, leader, p}
  extraTriggers: (s, me, iid, t, ev) => 0,       // "Abilities you control that … trigger an additional time"
  replaceLeave: (s, me, ev) => 'banished' | undefined,  // "would be put into the cemetery … banish it instead" (ev {iid, to, verb})
  chooseAnyNumber: true,      // "If you would choose 1 or more options, choose any number instead" (x.choose honours it)
  effectTriggers: [{ name, on, when: (s, e, ev) => bool, run(x, ev) }],  // abilities an effect creates for a duration, hosted by x.addTrigger(idx, dur)
  stack: true,                // the amulet has Stack (CR 13.3.2): engine handles counters and leaving
  evolveCost: 1, evolveIf: (s, iid) => bool,    // override / condition for the engine-read evolve line
});
```

Put each script's printed text in a comment above it, **verbatim** from `data/cards.js` (copy it).

## Events (`on`) and their `ev`

| on | ev | notes |
|---|---|---|
| `enter` | `{iid, from, p, played}` | put onto a field (Fanfare uses `from !== 'field'`) |
| `leave` | `{iid, to, by, info, verb, p, ctrl}` | left the field; `verb`: destroy/bury/banish/return/toEx/toDeck/leave; `info` = final info |
| `destroyed` | same as leave | only when `verb === 'destroy'` (by an ability, by damage or by Bane) |
| `played` | `{iid, p, from, kind}` | a card was played (kind follower/amulet/spell); fires before it resolves |
| `evolve` / `superEvolve` | `{iid, p, sup}` | |
| `attack` | `{iid, target, p, leader}` | Strike timing (CR 12.7) |
| `fought` | `{a, t}` | after combat damage while both were on the field |
| `damaged` | `{iid, amount, src, kind, leader, p}` | follower or leader took damage |
| `defenseLost` | `{p, amount, src}` | a leader took damage |
| `healed` | `{p, amount}` | a leader's defense increased |
| `engaged` | `{iid, cause}` | cause: attack / cost / effect / ward |
| `discarded` | `{iid, p}` | |
| `drawn` | `{iid, p}` | |
| `banished` | `{iid, from, p}` | banished from a zone other than the field (the field case is `leave` verb banish) |
| `toHand` / `toEx` | `{iid, from, p}` | |
| `fused` | `{iid, fused, p}` | |
| `raced` | `{iid, p, n}` | Umamusume |
| `equipped` | `{iid, token, p}` | Princess Connect equipment |
| `turnStart` | `{p}` | after the start-phase draw |
| `mainStart` / `endStart` | `{p}` | p = the active player |

Who is "you": `s.cards[me].ctrl` on the field, `.owner` elsewhere (`SV.H.ctrl(s, me)`).
"Each opponent's end phase" = `endStart` with `ev.p !== ctrl`.

## The ctx (`x`) — read js/abilities.js for the full list

- **Who/what:** `x.me`, `x.ctrl`, `x.opp`, `x.s`; `x.followers(p)`, `x.amulets(p)`, `x.field(p)`,
  `x.hand()`, `x.ex()`, `x.cemetery()`, `x.deck()`, `x.banished()`, `x.leader(p)`,
  `x.enemyTargets()` (enemy leader + enemy followers), `x.name(i)`, `x.named(i, 'Octrice')`
  (name contains, CR 2.1.2), `x.hasTrait(i, t)`, `x.cost(i)`, `x.type(i)`, `x.isFollower(i)`,
  `x.chars(i)`, `x.evolved(i)`, `x.engaged(i)`, `x.onField(i)`, `x.counters(i, k)`, `x.myTurn()`.
- **Class conditions:** `x.combo()`, `x.spellchain()`, `x.necrocharge()`, `x.overflow()`, `x.sanguine()`.
  Spellchain/Necrocharge are fixed when the effect starts resolving: read them FIRST into a const.
- **Selecting (never assume a choice):** `x.select({from, min, max, prompt})` → iids;
  `x.selectOne(from, prompt, {optional})`; Aura is applied automatically to enemy field cards
  (pass `aura: false` for your own zones/cemetery). The player is asked even with one candidate.
  `x.choose(prompt, [{label, can}], min, max)` → indices ("Choose 1", "choose up to 2").
  `x.may(prompt)` → bool; `x.number(prompt, min, max)`; `x.order(iids, prompt)`.
- **Doors:** `x.damage(t, n)`, `x.damageMany(list, n)`, `x.heal(p, n)` (leader +defense),
  `x.destroy(t)`, `x.destroyAll(list)` (simultaneous), `x.bury(t)`, `x.banish(t)`, `x.toHand(t)`,
  `x.toEx(t)`, `x.toDeck(t, 'top'|'bottom')`, `x.draw(n)`, `x.discard(h)`, `x.chooseDiscard(n, p)`,
  `x.engage(t)`, `x.refresh(t)`, `x.reveal(iids)`, `x.recoverPP(n)`, `x.gainMaxPP(n)`, `x.gainEP(n)`,
  `x.counter(t, 'reversal', +1)`, `x.summon(iid)`, `x.summonToken('Name', n)`, `x.tokenToEx('Name', n)`,
  `x.transform(t, 'Name')`, `x.evolve(t)` (free evolve; not the once-per-turn ability),
  `x.equip(t, 'Name')`, `x.serve(t)`, `x.race(t)`, `x.playFree(iid)`, `x.mayPay({pp})`.
- **More doors (added during the build):** `x.setDefense(p, v)` ("change a leader's defense to N";
  a decrease is lost defense), `x.maneuver(t)` (CR 5.32: an amulet with attack/defense is a follower
  this turn), `x.addTrigger(idx, dur, extra)` (host `effectTriggers[idx]` of this card in s.effects:
  "For the rest of this turn, whenever …"; its `when(s, e, ev)` receives the effect record `e`, which
  carries `extra`), `x.winGame(p)`.
- **Buffs and durations:** `x.buff(t, {atk, def, kw:{Storm:true}, flags:{…}, cost}, dur, text)`;
  `x.give(t, 'Ward', dur)`. `dur` = `x.until.eot()` ("until the end of the turn"),
  `x.until.myNextTurn()`, `x.until.theirNextTurn(p)` ("during their next turn"),
  `x.until.noRefreshNext(p)`; omit for "permanent while on the field". Flags in use:
  `cantAttack`, `cantAttackLeader`, `cantBeAttacked`, `noRefresh`, `loseAbilities` (Boxed),
  `mustAttack`, `cantBeDestroyedByAbilities`, `setAtk`/`setDef` (change to a value).
- **Global effects:** `x.effect({mod, applies:'playerFollowers'|'enemyFollowers'|'allFollowers'|'listed', iids, end})`,
  `x.effect({costMod: -1, filter:'follower'|'spell'|'trait', trait, end})`,
  `x.effect({replaceDamage: 'leaderNextMinus', n: 2, end})`.
- **Searching / looking:** `x.search({filter, max, min, prompt})` → found (revealed), then
  `x.afterSearch()` (always shuffle, CR 5.8.2). `x.lookPick({n, filter, max, prompt, to:'hand'|'ex'|'field', restTo:'bottom'|'top'})`.
- **Fuse:** activated ability with `zone: 'hand'`, `can: (s, me) => SV.H.canFuse(s, me, filter)`,
  and `run(x) { if (x.fuse({filter}).length) { …effect… } }` (CR 12.18).

## Rules that bite (each cost a bug in an earlier game)

1. **Targets.** "Select an enemy follower …" with no candidate: a spell can't be played
   (`canPlay`); a Fanfare/automatic ability just does nothing for that part. Never pick for the
   player. "Select up to N" → `min: 0`.
2. **"If" conditions in automatic abilities are checked on resolution** unless the text puts them in
   the trigger ("When … if …" read carefully; CR 10.7). Put trigger conditions in `when`, the rest in `run`.
3. **Optional costs** "[cost02]: …" or "Discard a card: …" on Fanfare/automatic abilities are
   asked when resolving (CR 10.4.7.4) — `x.mayPay`, or a `select` with `min: 0`.
4. **Simultaneous**: "destroy each …" uses `x.destroyAll`; "deal N to each …" uses `x.damageMany`.
5. **Choose**: options that can't be performed are disabled (`can: false`), CR 5.18.3.1.2.
6. **"This"** on an evolved follower: the script is on the evolved card's number, but `x.me` is the
   follower instance — it works.
7. **Tokens** are created by name (`SV.TOKENS` lists every name). A token that doesn't fit (field 5,
   EX 5) is not created — the door handles it.
8. **Union Burst** (`[UB]` lines) is invalid in every deck we run (class-based decks, CR 14.5.1.2):
   don't script `[UB]` abilities; add a comment saying so.
9. A card you **cannot** implement faithfully: at the top of YOUR group file write
   `SV.DEFECTS['<number>'] = 'one sentence why';` and say so in your report. Never ship an
   approximation silently. (`data/defects.js` itself is the lead's; group files add to it.)
10. **Never edit** `js/engine.js`, `js/abilities.js` or another group's files. If a card needs an
    engine change, implement everything else, mark it `SV.DEFECTS['<number>'] = 'needs engine: <what>'`,
    and report it.

## Tests

One behaviour test per scripted card in `tests/cards-<group>.js`, named
`'<number> <name>: <what it asserts>'`. Build the position with `T.game`, act through
`T.act`/`T.play`/`T.answer`/`T.attack`/`T.endTurn`, assert the side effect (zones, defense,
counters, hand size), not that a function was called. A test that only proves "no throw" is not a
test. `node tools/test.mjs --quiet --filter BP16` runs a subset.
