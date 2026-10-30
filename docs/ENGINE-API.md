# Engine API contract (frozen shape; additions allowed, renames not)

Everything lives on one global namespace `SV` (`globalThis.SV`). Plain browser JS, no build
step; every file is an IIFE. The engine never touches the DOM and never writes prose: it emits
structured log entries and the UI phrases them. CR = Shadowverse: Evolve Comprehensive Rules
v1.26.1; see `docs/rules.md`.

## Surface

| Function | Returns |
|---|---|
| `SV.newGame({decks:[a, b], seed, first, names})` | a fresh state at the first mulligan question. A deck is an id from `SV.DECKS` or `{name, cls, leader, main:[[cardNo, qty]…], evolve:[[cardNo, qty]…]}`. `first`: 0, 1, or omitted (seeded random). |
| `SV.legalActions(s)` | actions for `SV.whoActs(s)`. Never empty while the game is not over. |
| `SV.apply(s, action)` | a NEW state (deep copy; `s` is never mutated). Throws `SV.Illegal` on an illegal action. |
| `SV.whoActs(s)` | `0`, `1`, or `null` when the game is over. During a Quick window this is the window's seat. |
| `SV.isTerminal(s)` | `s.winner !== null`. |
| `SV.chars(s, iid)` | live characteristics (below). Every number the UI shows about a card comes from here. |
| `SV.costToPlay(s, iid)` | play points the card costs right now (after cost changes). |
| `SV.whyNot(s, iid)` | `null`, or one sentence why a hand/EX card can't be played now. |
| `SV.actionsFor(s, iid)` | the legal actions whose `iid` or `target` is this card. |
| `SV.def(iidOrNo, s?)` | the card definition shown (an evolved follower shows its evolved card). |
| `SV.canAttackWith(s, iid)` / `SV.canAttackTarget(s, a, t)` | the attack-legality predicates (CR 8.4.2-8.4.3, Ward, Storm, Rush, Assail, Intimidate). |
| `SV.evolveInfo(s, iid)` / `SV.canEvolve(s, iid)` | `{cost}` of the evolve ability / whether it can be used now. |
| `SV.quickOptions(s, p)` | the Quick plays available to p right now. |
| `SV.overflow / sanguine / combo / spellchain / necrocharge (s, p)` | class conditions (CR 13). |
| `SV.deckProblems(deck)` | sentences saying why a deck is illegal (CR 6.1.1); `[]` when legal. |
| `SV.makeTrace(opts)` / `SV.replay(trace, upTo?)` | the black box: newGame options + actions reproduce a game. |

## State (read-only for the UI)

```js
s = {
  turn: 7,                 // +1 every turn (both players' turns count)
  active: 0, first: 0,     // seat indices
  phase: 'mulligan' | 'start' | 'main' | 'end' | 'over',
  winner: null | 0 | 1 | 'draw', endReason: null | 'defense' | 'deckout' | 'concede' | 'both',
  players: [{
    name, deckName, deckId, cls,
    leader: iid,           // the leader card (zone 'leader'); its defense is `defense` below
    defense: 20,           // leader defense (CR 2.8.3); no upper limit
    pp, maxPP,             // play points / maximum play points (0..10)
    ep, sep,               // evolution points, super-evolution points
    turnsPassed,           // CR 3.3 (super-evolve needs 7 first / 6 second)
    deck: [iid],           // index 0 is the TOP. Hidden: counts only.
    hand: [iid],           // hidden from the other seat
    ex: [iid],             // EX area: public, a second hand (limit exLimit, 5)
    field: [iid],          // followers and amulets this player CONTROLS (limit fieldLimit, 5)
    cemetery: [iid],       // public; index 0 is the most recent
    banished: [iid],       // public
    evoDeck: [iid],        // evolve deck area. card.faceup === true means used/removed (public);
                           // facedown cards are visible to their owner only (CR 4.6.2)
    fieldLimit: 5, exLimit: 5, handLimit: 7,
  }, {...}],
  cards: { [iid]: {
    iid, id,               // id = card number (SV.CARDS key), the printed base card
    owner, ctrl,           // ctrl differs from owner only on the field
    zone: 'leader'|'deck'|'hand'|'ex'|'field'|'cemetery'|'banished'|'evoDeck'|'evolve'|'resolution'|'race'|'equip'|'gone',
    engaged: false,        // false = reserved (upright)
    dmg: 0,                // damage on a follower (defense = printed + buffs - dmg)
    evo: null | iid,       // the linked evolve-zone card of an evolved follower (zone 'evolve')
    evoOf: null | iid,     // on an evolve-zone card: the follower it is linked to
    superEvolved: false,
    counters: {},          // named counters: {stack: 2, reversal: 3}
    links: [iid],          // linked race-zone Carrots and equipment tokens
    enteredTurn, evolvedTurn,
    faceup, token,
  }},
  ask: null | Ask,         // a pending decision; when set, only answers are legal
  window: null | {kind: 'attack' | 'end', who},  // the opponent's Quick window (CR 8.4.7, 7.4.5)
  attack: null | {a, t, combat, leader},         // the attack in progress
  resolving: [iid],        // the resolution zone (a spell being resolved)
  log: [LogEntry],         // append-only, oldest first
  revealed: {0: [iid], 1: [iid]},  // hidden cards currently revealed to the other player
}
```

## Actions

```js
{type:'answer', value}            // answers s.ask (see Ask)
{type:'play', iid}                // play a card from hand or EX area (also a Quick play in a window)
{type:'evolve', iid}              // the evolve ability of a follower on the field; EP use and
                                  // super-evolution are asked next when they are choices
{type:'activate', iid, idx}       // idx into SV.chars(s, iid).activated
{type:'attack', iid, target}      // target = an enemy follower iid or the enemy leader iid
{type:'end'}                      // end the main phase (the end phase runs, then the turn passes)
{type:'pass'}                     // decline in a Quick window
{type:'concede', who}             // either seat, any time (CR 1.2.3); not in legalActions
```

## Ask (pending decision)

```js
{
  kind: 'cards' | 'yesno' | 'mulligan' | 'mode' | 'modes' | 'number' | 'bag' | 'order',
  who: 0 | 1,              // the seat that must answer
  src: iid | null,         // the card whose effect is asking (show it!)
  prompt: 'Select an enemy follower on the field. Deal it 3 damage.',
  // 'cards': value = array of iids, length in [min, max]
  from: [iid], seen: [iid], min, max,   // `seen` = everything the asker is looking at; `from` ⊆ seen
  sumCostMax?, distinctNames?,          // extra constraints, checked by apply
  // 'yesno' / 'mulligan': value = true | false; `yes`/`no` are button labels
  // 'mode':  value = option index; options = [{label, enabled}]
  // 'modes': value = sorted array of option indices, length in [min, max] ("Choose up to 2")
  // 'number': value = integer in [min, max]
  // 'bag':   value = pending-ability id; options = [{id, src, name}] (order your automatic abilities)
  // 'order': value = a permutation of `from` (first = topmost)
}
```

`legalActions` returns a representative sample of answers for multi-picks (the AI uses it); the
UI builds its own picker from `from/min/max` and lets `apply` validate.

## SV.chars(s, iid)

```js
{
  iid, id, owner, ctrl, name, cls, universe,
  type: 'follower' | 'amulet' | 'spell' | 'leader' | 'crest' | 'equipment',
  evolved, superEvolved, advanced, token,
  traits: ['Elf', 'Condemned'],
  cost,                    // printed cost of the base card (an evolved card keeps it)
  atk, def, maxDef, dmg,   // live values; for a leader, def = players[p].defense
  engaged,
  kw: { Ward, Storm, Rush, Bane, Drain, Assail, Intimidate, Aura },   // true when present
  quick,                   // the card has a standalone Quick (CR 12.3.2)
  flags: { cantAttack, cantAttackLeader, cantBeAttacked, noRefresh, loseAbilities,
           mustAttack, cantBeDestroyedByAbilities, ... },
  activated: [{ idx, text, quick, usable, why, costText, zone }],
}
```

## Log entries

`{n, turn, who, type, ...data, via?}`; `via` is the iid of the card whose ability produced the
entry (indent it under that card). Types the engine writes:

| type | data |
|---|---|
| `start` | `{first}` |
| `mulligan` | `{redraw}` |
| `turn` | `{turnsPassed}` a turn begins for `who` |
| `endPhase` | `{}` |
| `draw` | `{iid}` (face shown to its owner only) |
| `play` | `{iid, from, cost, quick?}` |
| `evolve` | `{iid, evo, sup, ep}` |
| `ability` | `{iid, text?|name?, auto?, quick?}` an activated or automatic ability starts resolving |
| `attack` | `{iid, target, leader}` |
| `pass` | `{window}` the opponent declined a Quick window |
| `damage` | `{iid, amount, src, kind:'attack'|'combat'|'ability', leader?}` |
| `fought` | `{a, t}` |
| `heal` | `{p, amount, total}` leader defense increased |
| `destroy` / `bury` / `banish` / `return` / `toEx` / `toDeck` / `leave` | `{iid, to?, by?, info?, from?}` |
| `discard` | `{iid}` |
| `engage` / `refresh` | `{iid, ward?}` (only when caused by an effect or Ward) |
| `wardEngage` | `{iids}` |
| `summon` / `token` | `{iid, from?|zone?}` |
| `eliminate` | `{iid}` a token ceased to exist |
| `buff` | `{iid, text, atk?, def?}` |
| `reveal` | `{iids}` |
| `recover` / `maxPP` / `ep` | `{amount, total?}` |
| `counter` | `{iid, counter, amount, total}` |
| `stackSave` | `{iid, left}` |
| `serve` / `race` / `equip` | `{iid, n?|token?}` |
| `noRoom` | `{iid?|name?, zone}` a card or token didn't fit (CR 4.4.4.2, 4.8.3.2) |
| `fizzle` | `{iid, text, notice:true}` |
| `shuffle` | `{}` |
| `win` | `{reason, draw}` |
