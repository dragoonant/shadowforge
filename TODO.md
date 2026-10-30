# TODO

Improvements to things that already work. Missing rules go in `DEVIATIONS.md`; cards that don't
play as printed go in `SV.DEFECTS`. Each entry has three parts: what exists, constraints, done when.

## Open

### Owner listening pass on the audio
- **What exists:** 31 effects and 6 music tracks generated locally (`tools/gen-audio.mjs`); takes were
  chosen by numbers (crest factor, length), not by ear. `sounds.html` plays every clip.
- **Constraints:** every take is kept in `audio/masters/` (gitignored); re-picking needs no studio.
- **Done when:** the owner has listened and named the clips to redo; `node tools/gen-audio.mjs --repick`
  or a regeneration of those ids has run.

### "The next X card you play this turn costs N less" lives in three group files
- **What exists:** `SV.COST_FILTERS.forestNext`, `swordNext`, `havencraft:nextTrait` and
  `dragoncraft:nextMarineFromEx` each read the play log to end the discount after one matching play.
- **Constraints:** behaviour must not change; the per-card tests cover it.
- **Done when:** one engine door (an `s.effects` cost mod with `next: true` consumed in `playCard`)
  replaces the four, and the four cards' tests still pass.

### "Times your leader lost defense this turn" is read from the log
- **What exists:** abysscraft scripts count `damage`/`setDefense` log entries for the current turn.
- **Done when:** `s.ti.lostDefN[p]` is kept by `dealDamage`/`setDefense` and the scripts read it.

### `SV.whyNotEvolve`
- **What exists:** the UI explains a refused evolve from `s.ti.evolveUsed` and `SV.evolveCandidates`.
- **Done when:** the engine exposes one `whyNotEvolve(s, iid)` sentence and the UI uses it.

### Amulet attack/defense read as 0
- **What exists:** `SV.chars` reports `atk: 0, maxDef: 0` for cards without printed values (CR 1.3.6
  says the information doesn't exist). No pool card compares an amulet's attack or defense.
- **Done when:** `chars` returns `null` for missing values and every reader handles it.

### Phone-sized screens
- **What exists:** the board scales down; held upright it is small (as in lorecannae).
- **Done when:** an upright phone layout exists or the page asks to rotate.
