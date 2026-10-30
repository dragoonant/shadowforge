# Deviations

Rules the engine does not yet keep. Under PLAN D1 a divergence from the printed card or the
Comprehensive Rules (v1.26.1, `docs/rules.md`) is a defect, never a design choice, so each entry
here is a debt, not a decision. Each entry names its CR section, says what the engine does
instead, and says what would close it. When one is fixed, delete the entry in the same commit.
Cards that cannot play as printed at all are kept out of decks through `SV.DEFECTS`.

## Open deviations

### Several damage modifiers on one event are applied in board order
- **CR:** 10.10.2 (the affected player orders replacement effects), Q2413.
- **Engine does:** applies every valid `replaceDamage` hook in board order, then `s.effects`.
- **Why it matters:** only when two modifiers that don't commute (a "+1" and a "-2 to 0") hit the same
  damage; rare in the pool.
- **Closes when:** `dealDamage` asks the affected player (an `order`-kind Ask) when two or more
  modifiers apply and their order changes the result.

### The mulligan's "in any order" is not asked
- **CR:** 6.2.1.8 (the whole hand goes to the bottom "in any order").
- **Engine does:** puts the four cards on the bottom in hand order.
- **Why it matters:** those cards are only drawn again after the rest of a 36+ card deck.
- **Closes when:** the mulligan asks an `order` after Redraw.
