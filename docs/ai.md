# AI notes

`js/ai.js`: lorecannae's machine (PLAN D3). Each legal action is applied, our own follow-up
questions are settled greedily, and the result is scored by `evaluate()`; the AI ends its main phase
(or passes a Quick window) when nothing beats the current position. Normal and Hard also play their
top candidates and "end" through the opponent's whole reply on determinized copies (the opponent's
hand and deck and our deck reshuffled: the AI never reads hidden cards), with every candidate facing
the same worlds (common random numbers). The arena measures the AI; it is never a reason to change a
card (PLAN D1).

## Evaluation

| Term | Value | Reason |
|---|---|---|
| leader defense | `5·min(d,20) + 2·max(0,d−20) − 1.8·max(0,10−d)²`, −1e6 at 0 | the race; the last points end the game |
| follower | `1.5·atk + 1.2·def + 0.5·cost` + keyword bonuses (Ward 2, Bane 2.5, Drain 1.5, Aura 1.5, Intimidate 1.5, Assail 1, Storm/Rush 0.5, evolved 1, activated 1, Boxed −2) | board presence |
| exposure | an engaged follower the opponent can destroy next turn loses `threat` (0.6) of its value, for the side about to pass | the attack-back question |
| amulet | `1.5·cost + 1` | |
| hand / EX area | 3 per card up to 7 / 2.5 per EX card, 3 per crest | resources |
| points | 2 per EP, 3 per super-EP, 1.5 per max PP | |
| lethal | −60 if the opponent's board attack meets our defense with no Ward in the way, +40 the other way | |

## Measurements (2026-10-29, 15 registered decks)

| Run | Result |
|---|---|
| `tools/arena.mjs --a hard --b normal --games 20` (both seats, same deck pairs) | Hard won 13/20 (65%), 654 ms per decision |
| `tools/arena.mjs --a normal --b easy --games 20` | Normal won 17/20 (85%), 178 ms per decision |
| `tools/sim.mjs --games 10 --policy ai --level normal` | 0 errors; first player 6/10; 1.6 plays, 0.8 attacks, 0.3 evolves per turn |
| one Normal game timed decision by decision | mean 216 ms, worst 1.5 s |

20-game samples: treat 65% as "Hard is stronger", not as a precise number.

## Levels shipped

| Level | Search | ms/decision |
|---|---|---|
| easy | one ply, noise 12, 25% blunders | ~25 |
| normal | one ply + one opponent reply on 1 world, top 2 + end | ~180-220 |
| hard | the same on 3 worlds, top 4 + end | ~650 |
