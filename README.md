# Shadowforge

Shadowverse: Evolve in the browser: an unofficial, non-commercial fan reproduction of the card
game's rules, played against the computer, two players on one device, or computer against computer.
Real card names and printed rules text; original generated art and sound.

**Please read `NOTICE.md` first.** This project is not affiliated with Cygames, Inc. or Bushiroad.

## Run it locally

No build step and no dependencies. You need Node.

```
node tools/serve.mjs
```

Then open http://localhost:8241

## Modes

- **Vs the computer** at Easy, Normal or Hard.
- **Hot-seat:** two players on one screen, with a pass-the-device curtain that hides each hand.
- **Spectate:** watch two computer players.
- **Tutorial:** a guided first game.
- **Deck builder:** edit a deck under the deck-construction rules (40-50 main, up to 10 evolve, 3 copies,
  leader class plus Neutral); decks are saved in your browser.

## The decks

Fifteen decks, 348 cards, every card scripted and tested:

- the twelve **official featured decks** for Combined Set "Eightfold Retribution & Omens and Heirs"
  (October 2026), each with its Bushiroad Decklog code;
- the three **Grand Showdown 2026 winners** (Europe, Asia & Oceania, North & Latin America).

Sources and dates are in `docs/sources.md`.

## Rules

The engine follows the Comprehensive Rules v1.26.1. `docs/rules.md` indexes them by section,
`DEVIATIONS.md` lists what the engine does not yet keep, and every card's official rulings were read
when its script was written.

## Gates

```
node tools/gate.mjs     # tests, page checks, asset stamps, card audit, art, replay, random and AI games
```

## Credits

Built by **evilgouki**.
