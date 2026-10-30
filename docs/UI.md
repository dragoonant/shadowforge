# The browser interface

lorecannae's interface architecture, ported (PLAN D3, §4.11) and re-zoned for Shadowverse: Evolve,
with this game's own look (PLAN D17, "the evolution rite"): a floating stone dais under the moon,
midnight indigo and moonlit silver with white-cyan evolution light, your side cyan and the
opponent's rose, cut corners and corner brackets, a wide-tracked engineered sans. The structure is
shared with the series; the skin is not (`tools/check-look.mjs` fails on the old skin's fonts,
colours and rounded frames; `docs/look/` holds the side-by-side sheet). The why of each structural
piece is in `kb/PRESENTATION-REFERENCE.md`; this file says where things are and what differs.

## Files

| File | Role |
|---|---|
| `index.html` | the page; the `<!-- engine -->` block is identical to `tests.html` (`tools/check-pages.mjs`) |
| `styles.css` | every style; non-obvious rules say why |
| `sounds.html` | listening page: manifest clips, then every procedural voice |
| `data/art-manifest.js` | `SV.ART = {cards: {<card no>: path}, ui: {title, deck-chooser, board-1..4, victory, defeat}}` — empty until the art run |
| `data/audio-manifest.js` | `SV.AUDIO = {sfx: {id: {src, gain}}, music: {id: {src, gain, loop}}}` — empty until the audio run |
| `js/ui/core.js` | DOM helpers, class palette, the original glyphs for the printed `[tokens]`, settings, URL flags, the one tooltip |
| `js/ui/cardview.js` | `SV.renderCard` (board / hand / preview), procedural art, glossary, `SV.canSee` |
| `js/ui/boardart.js` | the drawn dais (sockets, obelisks, the turning circle of light); one geometry table places every zone |
| `js/ui/preview.js` | hover preview, inspector, zone browser, spotlight |
| `js/ui/logtext.js`, `logpanel.js` | a phrase for every log type; the drawer |
| `js/ui/targeting.js` | every Ask kind; the attack / evolve arrow |
| `js/ui/sound.js`, `anim.js` | log-driven sound and animation (`anim.plan` is pure) |
| `js/ui/hud.js` | banner, action popover, hot-seat curtain, results, help |
| `js/ui/game.js` | modes, the one apply funnel, bot loop, board render, drag manager, Quick window prompt |
| `js/ui/title.js`, `deckbuilder.js`, `tutorial.js` | splash (drawn wordmark), the rite menu (leader medallions), the leader gallery, ring wipe; deck builder; guided game |
| `js/ui/main.js` | boot: a missing engine function or manifest throws |
| `js/ui/dev-fixture.js` | dev quick start (`?fixture`) |

## The board (per seat, centre line outward)

leader (arch, defense number dominant) · field of 5 (engaged = 90° in a widening slot) · deck ·
evolve deck — then EX area of 5 (public second hand) · cemetery · banished · points (play points
with 10 pips, evolution points, the super-evolution star, Overflow / Sanguine / Combo chips). The
opponent's half is yours rotated 180°.

## Gestures (every one a filter over `SV.legalActions`)

- hand or EX card → your field: `play` (a Quick play inside a window too);
- follower → enemy follower or enemy leader: `attack` (legal targets light up while dragging);
- your evolve deck → a follower: `evolve`;
- tap any of your cards: popover with one button per legal action plus the engine's reasons
  (`SV.whyNot`, `activated[].why`); cemetery abilities glow on the pile and are offered in its browser;
- End turn / No response in the turn bar; the Quick window also gets a centred prompt saying
  what is happening (`s.attack`, `s.window`).

## Asks

`cards` on cards the board draws (field, EX, leader) → highlight in place; otherwise a panel of
all of `seen` with non-`from` dimmed (count line shows `sumCostMax`, `distinctNames`).
`yesno`, `mode`, `modes` (checkboxes), `number`, `bag` → buttons. `mulligan` → the four cards with
Keep / Redraw. `order` → click in order, first = topmost. Every prompt shows `ask.src`. Nothing is
ever answered for the human. The opening turn-order choice (CR 6.2.1.6) is a `mode` ask before
the deal; a toast says who goes first when the other seat chose.

## URL flags (dev only)

- `?lenient=1` — sets `SV.LENIENT` (an unscripted spell resolves as nothing) and lets decks with
  missing card scripts be picked (they are otherwise listed as "not ready yet").
- `?fixture` — skip the title: vanilla Forestcraft vs Dragoncraft (`&ca=`, `&cb=` other classes);
  `?fixture=decks&a=<deck id>&b=<deck id>` — two registered decks. Extras: `&mode=ai|hotseat|spectate|tutorial`,
  `&level=easy|normal|hard`, `&seed=`, `&first=0|1`, `&anim=off|quick|full`, `&turns=N` (bots play N actions first).

## Engine API gaps met

- No `whyNotEvolve`: the popover reads `s.ti.evolveUsed` and `SV.evolveCandidates` to explain an
  unusable evolve.
- `bag` options carry `{id, src, name}` only: two abilities of one card with the same name (two
  Fanfares) render as identical buttons. An ability text or index in the option would tell them apart.
