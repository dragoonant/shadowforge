# Presentation Reference — what Starbound Legions got right, and how to carry it to Lorcana

Source: `dragoonant/starbound-legions` (public; live at https://dragoonant.github.io/starbound-legions/),
`main` as of the 2026-10-07 push (merge `b6642bb`). Read from a partial clone in the session
scratchpad (`<scratchpad>/starbound-legions`). Every `file:line` below is relative to that repo root.
The older local `Star wars unlimited` checkout is the same project before the rename/UI overhaul; nothing
in it beats `main`, so it is not cited.

How to use this file: Part A is a teardown, organised by subsystem, with the values and techniques worth
copying verbatim. Part B maps each piece to Lorcana (transfer / adapt / drop). The SWU repo's own four
specs (`CARD-PRESENTATION-SPEC.md`, `CARD-FANNING-SPEC.md`, `CARD-LOG-AND-TARGETING-SPEC.md`,
`UI-OVERHAUL-PLAN.md`) are the long-form rationale; this file is the short, implementation-ready
distillation plus what the shipped code did differently from those specs.

---

## A0. The six ideas that make it work

1. **The board is the whole window.** No top bar, no permanent side column. Everything that is not
   the board is a title screen, an edge drawer that *overlays* (never reflows), or a centred panel.
   (`UI-OVERHAUL-PLAN.md`, commit `d4d2488` "Give the board the whole screen".)
2. **Art is the card.** Full-bleed illustration, text floats on it with a measured scrim + a 4-stop
   text shadow; no text plate, no frame window. One renderer, three sizes. (`js/cardview.js:121`.)
3. **Every affordance is a filter over `legalActions`.** Glow = "has a legal action"; drop targets =
   "actions that land here"; buttons only for actions with no card. The UI cannot invent a rule.
   (`js/ui.js:1-4`, `js/ui.js:353`, `js/ui.js:578`.)
4. **Tap inspects, drag commits.** Pointer Events only, 8px distance threshold, never a timer
   (except the 450ms touch long-press that opens the inspector). (`js/ui.js:146-290`, `js/preview.js:127`.)
5. **The log is structured data; sound, animation and narration all read it.** The engine never
   writes prose. Animation is *planned* purely from fresh log entries and *played* on the OLD board
   before the redraw. (`js/anim.js:71`, `js/sound.js:475`, `js/logtext.js`.)
6. **Nothing visual is game state.** Drawer open, peek, banner shown, animation mode — all view-layer,
   never in undo history. (`js/hud.js:11-12`, `js/targeting.js:80-82`.)

---

## A1. Screen flow

| Screen | What happens | Where |
|---|---|---|
| **Splash** | Full-bleed title art (`art/title-duel.webp`, 1536x864), game title + tagline + pulsing "click to continue" hint + disclaimer line. Holds 3000 ms; any click/key skips. | `js/title.js:13`, `:104-111`, `:271-284`; CSS `styles.css:1046-1083` |
| **Wipe** | One opaque curtain on `<body>` (not inside the screen being swapped), animating `inset` from `0 100% 0 0` → `0` → `0 0 0 100%` over 900 ms `cubic-bezier(.7,0,.3,1)`; the screen swap happens at 45% while the curtain covers everything. Trailing edge is a gold gradient stop (`#ffd166` at 92-100%). | `js/title.js:233-240`; `styles.css:1156-1166` |
| **Picker** | Same art, dimmed (`rgba(5,7,13,.72)` + `blur(2px)` pseudo-element). Panel: two deck-slot buttons (yours / theirs), each with a dice reroll button; difficulty select; big Start. Both slots open on a **random competitive list**, hidden as "?" until played, so Start is live immediately. | `js/title.js:199-226`, `:114-150`; `styles.css:1085-1152` |
| **Deck chooser** | Replaces the picker (never floats over it): grouped grid of large deck buttons (`repeat(auto-fill, minmax(13.5rem,1fr))`), format + card count meta, current pick outlined in accent. **Hover 600 ms → peek panel** showing the deck's leader and base at full preview size with glossary, scaled to fit the window (`k = min(1, (innerH-16)/h, (innerW-16)/w)`), flipped left if it would overflow right. | `js/title.js:154-197`, `:46-90`; `styles.css:1113-1146` |
| **Start** | The Start click is the first real gesture, so it unlocks audio (`SB.sound.startAmbience()`), rerolls board scenery, resets the HUD, then wipes into the match. | `js/title.js:255-269` |
| **Match** | Board only. Round banner, log drawer handle on the right edge, turn bar under the hand. | §A2-A9 |
| **End** | Killing blow animates (planet blast, 750 ms charge + 1300 ms boom) → 1000 ms of quiet → end-of-match MP4 (win/loss, click or Skip to dismiss) → music finale after the video. Hidden info (their hand, both inkwell-equivalents) flips face up for a post-mortem read. Turn bar shows "You win / You lose". | `js/anim.js:532-560`; `js/endvideo.js`; `js/ui.js:412-417`, `:330-340` |
| **New game** | From the drawer: straight to the picker, no splash (`openPicker`). | `js/title.js:287-296` |

Gap worth noting: there is **no dedicated results screen** (stats, turn count, rematch). The end is the
video plus a post-mortem board. Lorcana should add a small results panel (see B5).

---

## A2. Board layout and zones

**The board is drawn, not photographed** (`js/boardart.js`, commit `3a389a0`). A generated table photo
was tried first (de-keystoning, hand-measured zones in CSS) and drifted twice; the replacement is:

- **One geometry table** in a fixed **2048x1280 board space** (`js/boardart.js:14-73`). It is used
  twice: to draw each slot as SVG and to position each DOM zone as percentages
  (`js/boardart.js:308-321`: `left = x/W*100%` etc.). Outline and hitbox are the same numbers by
  construction.
- **The opponent's row is your row reflected** about the centre line, computed from the single
  `SLOT` array (`js/boardart.js:39-62`), so each player reads their own row in the same order and the
  rows cannot drift.
- **Wider gaps between groups than within them** (`gapAfter: 24` within, `90` between groups,
  `js/boardart.js:24-30`) is what makes "cards | piles | resources" read as groups.
- **Side colour = ownership**: your outlines `--bz-mine #58b8ff`, theirs `--bz-theirs #ff5a5a`; the
  shared arenas take a neutral warm/cool pair (`#d9a441` / `#9a7ad9`) precisely so they do not read as
  one side's territory (`styles.css:113-121`, `:137-140`).
- **SVG furniture**: rounded frame + four open-path corner brackets (reads as hardware, not double
  border, `js/boardart.js:147-162`); a repeating 256px circuit-trace `<pattern>` (cost independent of
  board size, `:191-199`); two glow filters (blur 14 / 6 + feMerge, `:210-219`); a glowing rail
  between a warm "wood" gradient band and the panel (`:252-259`); faint 96-unit grid in arenas.
- **Scenery per game**: arenas and the two pile slots each get one of 5 painted scenes, rolled per
  game, never the same as last game and never the same as the opposite side (`js/boardart.js:85-132`).
  Art sits in an SVG `<image preserveAspectRatio="xMidYMid slice">` clipped to the rounded rect.
- **Labels are SVG text from `names.js`**, uppercased at draw time, 30px / 700 / letter-spacing 4px;
  arena watermarks 54px at 34% opacity (`styles.css:132-143`). No label DOM in the zones.

**The mat scales as one thing** (`styles.css:66-94`, commit `7083424`):

```css
#board { container-type: size; }                 /* cq units resolve against the board */
#mat {
  flex: 1 1 0; min-height: 0; align-self: center; /* the ONE yielding row in the column */
  width: auto; max-height: calc(100cqw * 1280 / 2048);
  aspect-ratio: 2048 / 1280;                      /* matches the viewBox: no letterbox */
  container-type: size;
  --card-board-w: 7.2cqw;                         /* card size is a share of the mat */
  isolation: isolate;                             /* contain z-index 10..200 of units */
}
.mat-zone { position: absolute; font-size: 1.5cqw; overflow: hidden; }
```

Height comes from whatever the two hands and turn bar leave; width follows through `aspect-ratio`.
A fixed `62cqh` share left a black band on wide windows — the fix was making it the flex row that yields.

**Vertical column** (`index.html:12-49`): `#enemy-hand-bar` (clipped quarter of each card back,
upside down) → `#mat` → `#choice-bar` (drop-variant buttons only) → `#hand-bar` → `#turn-bar`
(Pass / Take initiative: turn actions with no card). Drawer `#side` is `position: fixed` on the right.

**Zone contents are real card faces, never text summaries** (`js/ui.js:363-365`):

- Single-card slots size the card by **height** (`height:100%; width:auto; aspect-ratio:5/7`) because
  slots are wider than 5:7 (`styles.css:154-156`).
- **Piles are stacks**: up to 5 backing layers, one per 6 cards, offset `-0.28cqw` each, so the deck
  visibly thins (`js/ui.js:457-476`, `styles.css:175-180`). Count in a bottom-anchored `.zone-badge`.
- **Resource row** = face-down card backs in a **self-adjusting CSS overlap** (no JS measuring):

  ```css
  .res-fan > .card + .card {
    margin-left: min(var(--gap), (var(--row-w) - var(--card-w) * var(--n)) / (var(--n) - 1));
  }
  .res-fan > .card.is-spent { transform: rotate(7deg); filter: brightness(.72); }
  ```
  (`styles.css:192-203`). JS only sets `--n`. Spent = 7° tilt, not 90°, because twenty overlapping
  cards cannot afford the width. Badge shows `ready/total`.
- **Arena rows**: one line per side, never wrapping, same `min()` overlap; per-card `--z` custom
  property for stacking; hover/focus raises to 200 (`styles.css:209-231`, `js/ui.js:556-576`).
- **Zone badges** (`styles.css:165-171`): `rgba(5,8,14,.82)` pill, `1px solid #3a4a68`, `1.5cqw`/700.
- **Browsable piles**: discard (both), your deck (sorted by cost then name, copies collapsed to one
  face with ×N — never deck order, so browsing cannot leak the shuffle), your resources; theirs open
  only after the game. Glow on the zone, not a filter on cards (`js/ui.js:662-744`,
  `styles.css:498-503`).
- **Token socket** (the "Current"): its own circle drawn in the gap between leader and deck, held =
  radial gold gradient + 2.6s breathing glow, spent = dashed empty socket ("an absent token cannot say
  it is spent") (`styles.css:549-571`, `js/ui.js:445-452`).

---

## A3. Card rendering

One function, `SB.renderCard(ref, {size, state, costFor, basePlayer})` (`js/cardview.js:121-242`).
`size ∈ board | hand | preview`. The only content difference between sizes is the rules-text block,
rendered at preview size only (`:217-233`).

**DOM** (3 layers + badges):

```
div.card.card-{size} [data-def-id] [data-iid]     flex column, justify-content: flex-end
├─ div.card-art            z0  absolute inset 0; img (cloned proto) or SVG fallback; ::after = scrim
├─ div.card-corners        z3  cost pip (left) + aspect dots (right), pointer-events none
├─ div.card-plate          z2  in flow, margin-top:auto → hugs bottom, grows upward
│   name / type+traits / keyword names / [detail @preview] / stats
└─ badges: shield ◈, xp +N, advantage ▲N, attached-upgrade strip, centred damage pill
```

**Key values** (`styles.css:236-394`):

| Thing | Value |
|---|---|
| Card | `border-radius: 9px; border: 2px solid #33415e; background: #0b0f18`; transition `transform/box-shadow/border-color .12s` |
| Sizes | board `7.2cqw` (on mat), hand `clamp(4.5rem, 11.5vh, 8rem)`, preview `19rem` + `min-height: 26rem` and **no aspect-ratio** |
| Art crop | `object-fit: cover; object-position: 50% 25%` (generative art crowds the top; bias up to keep faces clear of the plate) |
| Scrim (small) | bottom `rgba(5,8,14,.94) 0% / .86 12% / .55 26% / 0 44%`; top `.80 0% / .45 8% / 0 17%` |
| Scrim (preview) | bottom `.94 0% / .88 22% / .60 38% / 0 56%`; top `.78 0% / .42 6% / 0 14%` |
| Plate shadow | `0 1px 2px .95, 0 0 4px .9, 0 0 10px .8, 0 0 18px .6` (black) — tight to wide |
| Pip shadow | heavier: `0 1px 2px .95, 0 0 4px .9, 0 0 9px .75`; cost colour `#ffd9a0` |
| Text sizes (em) | name `.74` / 700 / lh 1.2; type-tag `.58` uppercase ls `.1em` muted; traits `.6`; keywords `.61` / 700 `#a9c6ff`; stats `.8` / 700 |
| Preview overrides | name `1.05rem`; type/traits `.72em`; kw `.78em`; stats `1rem`; detail `.82em #d6dbe6` |
| Stats | attack `#ff9f87`, health `#8ee0ac`, damaged health `#ffcf6b`; hairline `border-top: 1px solid rgba(255,255,255,.1)` |
| Chips | keyword `#a9c6ff` on 12% of itself; trigger `#ffd9a0` on 12% of itself; `padding .05rem .32rem; radius 3px` |
| Damage pill | centred, `1.7rem` circle, `rgba(140,32,32,.9)`, `2px solid rgba(255,255,255,.35)` |
| Unaffordable (hand) | `opacity .58`, hover → 1; cost pip `#ff9f87` on 18% tint + inset ring. Only on your main-phase turn, no prompt open, **and** the engine offers no play (`js/ui.js:606-616`) |
| Rested/exhausted | `rotate(4deg); opacity .72` (`styles.css:362-363`) — see B2, Lorcana needs real 90° |

Decisions with a story behind them:

- **No faction-coloured border** (commit `2eb3406`). The border is where actable/target rings live;
  the yellow faction read as "playable". Faction lives in corner dots and in **coloured faction words
  inside rules text** (`js/cardview.js:79-108`, `styles.css:303-309`), built from `names.js` with a
  case-sensitive regex.
- **The face never claims a keyword the unit does not have right now.** Badge line = live keywords
  (printed + upgrades + auras); the hover glossary walks the *whole* definition so a card that grants
  a keyword still explains it (`js/cardview.js:311-351`; commit `07cbc79`).
- **Undeployed leader / upgrade cards still print their stats**; upgrades show signed `+3/+1`
  (`js/cardview.js:251-270`).
- **Defensive render**: unknown id → `.card-missing` with "—", never throw (`:143-147`).
- **Covered fan cards hide their plate** (`#hand.is-fanned .card:not(:last-child):not(:hover) .card-plate
  { visibility: hidden }`, `styles.css:752-754`) — a dozen truncated names read as one card's words
  spilling onto the next. Toggled with no transition (background-tab safety).

**Art loading** (`js/cardview.js:7-66`):

```js
proto.draggable = false;            // native image drag cancels pointer drags (grab-over-art bug)
proto.decoding = 'sync';            // NOT lazy/async: a fresh <img> paints a frame late → flicker
proto.src = SB.artUrl(cardId);      // the ONLY place an art path is built (index.html:146)
return proto.cloneNode(false);      // a clone of a decoded image paints in the same frame
```

404 → `'failed'` sentinel and a deterministic seeded SVG fallback (hue + 5 circles + a diamond),
cached per id. Card back gets the same proto treatment (dozens per render). Art is 512x704 WebP q90
(~60 KB); the move from PNG cut the deploy from 353 MB to 41 MB (commit `f2e87e6`).

---

## A4. Enlargements: hover preview, inspector, spotlight, zone browser

All in `js/preview.js`. Three distinct enlargements, deliberately not interchangeable.

**Hover preview** (`:69-120`): 300 ms delay (90 ms chased the pointer, 1000 ms felt like waiting),
aborts if a drag is live, opens on `focus` too (keyboard parity). Fixed overlay at z 60,
`pointer-events: none`, `drop-shadow(0 12px 32px rgba(0,0,0,.65))`. Row = card at preview size +
side panels (tokens created, keyword glossary; 15rem wide, `rgba(10,14,22,.95)`). **Centres the main
card on the anchor, not the whole row**, clamped 12px from viewport edges; `transform-origin` at the
card's midpoint so panels unfold outward. Animation `scale(.35)→1`, opacity, `.13s ease-out`, `.grown`
added after two nested rAFs. Cached by instance id. `@media (hover:none)` disables it entirely.

**Inspector** (`:170-189`): tap or long-press. Full-screen `rgba(4,7,13,.72)` + `blur(2px)`,
`max-height: 94dvh` scroll, backdrop click / Esc closes. Below 420px the card shrinks to 11rem.

**Long press** (`:127-164`, commit `505e601`): touch/pen only, 450 ms, cancelled by >10px drift so the
drag always wins; on fire it cancels the live drag *and* swallows the next click so release cannot also
play the card. `.card { -webkit-touch-callout: none; user-select: none }` stops the iOS callout.

**Spotlight** (`:254-286`): every played card (either player) flies to screen centre at preview size:
`translate(-50%,-50%) scale(.3) opacity .35` → `scale(1) opacity 1`, `500ms cubic-bezier(.22,.72,.3,1)`,
hold 1200 ms, fade 250 ms. **Start state flushed with `void el.getBoundingClientRect()`, not rAF** —
rAF does not fire in a background tab and would strand the card. A second play finishes the first.
Click to skip. A voice bubble (`js/voice.js`) may ride beside it (~50% of unit plays, deterministic by
log index).

**Zone browser** (`:199-250`): same overlay idiom, a grid of hand-size faces, read-only (never offers
an action, so it cannot be confused with the choice modal). The information boundary lives at the call
site, not in the browser.

**Z-order stack** (worth copying as a table in the new CSS):

| z | Layer |
|---|---|
| 0-200 | board / hand internals (each `isolation: isolate`) |
| 45 | attack arrow SVG |
| 50 | inspector |
| 52 | zone browser |
| 54 | turn banner (`pointer-events: none`) |
| 55 | spotlight, drag clone, log handle |
| 56 | drawer, voice bubble |
| 57 | arena prompt echo |
| 58 | choice modal |
| 59 | leader popover |
| 60 | hover preview |
| 65 / 66 | fx-lock (input swallow, click = skip) / fx-layer |
| 70 / 72 | help / bug dialogs |
| 80 | title screen |
| 90 | end video |
| 95 | wipe |
| 120 | deck peek |

---

## A5. Hand

The shipped hand is **Model B: a flat, centred, overlapping row** — not the arc fan the
`CARD-FANNING-SPEC.md` describes. The spec's own checklist (§15) said two failures → ship the row, and
rotation would have cost the drag clone, the preview anchor and hit testing (commit `40ad755`).

```css
#hand {
  --gap: 6px;
  display: flex; flex-wrap: nowrap; justify-content: center; overflow: hidden;
  padding-top: 6px;               /* headroom for the hover lift */
  flex: 1 1 auto; min-width: 0;   /* LOAD-BEARING: width from the bar, not content */
  isolation: isolate;             /* else a hovered card (z 200) paints over every overlay */
}
#hand .card { flex: none; position: relative; z-index: var(--z, 10); }
#hand .card + .card {
  margin-left: min(var(--gap), (100% - var(--card-hand-w) * var(--n)) / (var(--n) - 1));
}
#hand .card:hover, #hand .card:focus { z-index: 200; }
@media (max-width: 620px), (hover: none) { #hand .card + .card { margin-left: 0; } }
```
(`styles.css:709-761`, `js/ui.js:596-657`.)

- `--z` is a **custom property, not inline z-index**, so the stylesheet's hover raise still wins.
- Width-from-content would make overlap tighten → row narrows → overlap tightens: always collapses.
- **No minimum overlap**: scrollbars are hidden game-wide (`styles.css:5-11`), so a floor would strand
  the newest cards; the fan always fits and hover reveals the rest.
- Whether it actually overlaps is measured once per render by a forced sync rect read
  (`js/ui.js:645-649`) and set as `.is-fanned`.

**Opponent hand** (`styles.css:671-698`): same size as yours (a half-size row read as a different kind
of object), `rotate(180deg)`, the bar clipped to `card-h * .25` — the near quarter, the way a hand held
across the table shows. A revealed card un-rotates and the bar opens to full height via
`#enemy-hand-bar:has(.is-revealed)`. No hover lift on backs.

---

## A6. Targeting, drag, arrows, choices

**Roles** (`styles.css:31-34`, `:397-408`): four colours, derived only from `legalActions` + the open
choice.

```css
--role-actable:  #f5c34d;  /* pulse 0 0 8px .3 ↔ 0 0 20px .7, 1.7s ease-in-out infinite */
--role-selected: #5b9dff;  /* also the "hinted" ring when hovering an action button */
--role-target:   #ff6bcb;  /* legal answer to the open question */
--role-picked:   #45c98b;  /* drop-ok (2px) / drop-hot (3px + 16px glow) */
```

**Shared animation phase** — the trick that makes pulses survive a full rebuild every action:

```js
SB.animationPhase = p => '-' + ((performance.now() % p) / 1000).toFixed(3) + 's';
node.style.animationDelay = SB.animationPhase(1700);   // js/targeting.js:24, js/ui.js:353
```

Used for actable pulse, initiative ring (1900), token breathe (2600), arrow dash crawl (700).

**Drag manager** (`js/ui.js:146-290`): `begin` on pointerdown with `setPointerCapture`; a fresh press
while a gesture is live finishes the old one; adds `.is-dragging` (user-select none) at *press* time
(by the 8px threshold the browser has already started selecting, commit `0986feb`). Hand cards clone
into a fixed drag layer at 0.85 of card height above the pointer; units stay put and draw the
**amber aiming arrow**. Drop targets come from `handSpec`/`attackSpec`: each target is
`{actions:[...], el: () => node}` resolved lazily. Multiple actions at one drop → `#choice-bar`
variant buttons. Released over nothing = silent cancel. Belt-and-braces click suppression: timestamp
(`CLICK_GRACE_MS = 350`) **and** a self-removing capture-phase click swallower.

**Attack arrow** (`js/targeting.js:299-367`, `styles.css:419-434`): fixed SVG at z 45, quadratic
bezier bowed sideways (`bow = min(120, |dy| * .45) + 20`) so it never runs parallel to the board's
horizontal dividers; `stroke-dasharray: 10 7` crawling at 700 ms; **amber while aiming, danger red
`#e5484d` once declared**, same shape. A declared battle that pauses for a question redraws its arrow
on every render.

**Choices — three UIs, chosen in code** (`js/targeting.js:46-54`, `:93-103`):

| Options are… | UI |
|---|---|
| cards the board already draws | highlight in place (`role-target`), click the real card |
| cards the board does not draw (deck top, discard, revealed hand) | centred panel of real faces at `1.55 x` board width |
| not cards (modes, yes/no) | button list in the same panel; buttons say what they do ("Deal 2 damage to it"), never "Option 1" |

The panel (`styles.css:959-1018`, commit `904d305`) is anchored **over the arenas**, not the window,
with **no scrim and no blur** — the arenas are the one region a decision rarely needs, and piles, hand,
leader and base stay readable. **Peek**: "Hide — check the board" button + a "Show the cards" pill
outside the panel; Esc toggles; toggled on the DOM with no redraw; peek state keyed to the choice's
identity so a new question is never hidden on arrival (`js/targeting.js:85-91`, `:178-202`).

**Prompt line + arena echo** (`js/targeting.js:60-76`, `:147-164`, commit `b1fe785`): the card says
*what* (generated text), the UI appends *how* ("Click a highlighted card."). When the game is asking,
the same sentence is echoed as an italic pill in the middle of the arenas (`rgba(9,14,26,.82)`, radius
999px), suppressed while the panel shows, restored on peek. Hovering an action button lights the card
it concerns (`js/ui.js:885-905`).

---

## A7. Turn / phase presentation, HUD, log drawer

- **Banner once per ROUND**, never per action — SWU's action phase alternates every move, so a per-turn
  banner would strobe (`js/hud.js:61-89`). Fixed, `pointer-events: none`, z 54, click dismisses.
  Keyframes `2.3s`: `0% opacity 0 scale .94 → 12% 1 → 70% 1 → 100% 0 scale 1.03`. Main line
  `clamp(1.6rem, 4.4vw, 3rem)` / 800 / `#fff` with `0 3px 22px rgba(0,0,0,.95), 0 0 40px rgba(0,0,0,.8)`;
  sub line uppercase, ls `.18em`, accent gold (`styles.css:596-624`). Restart trick:
  `remove('show'); void node.offsetWidth; add('show')`.
- **Persistent marker** for who holds initiative: pulsing gold ring on the leader slot + an uppercase
  pill *inside* the slot (a caption above the top row would fall off the board) (`js/hud.js:95-110`,
  `styles.css:577-594`).
- **Leader popover**: leader actions are asked for *on the leader card*, enlarged, one button per legal
  action; theirs opens read-only (`js/hud.js:134-173`).
- **Turn bar**: only Pass / Take initiative / base epic / smuggle — actions with no card to hang on
  (`js/ui.js:330-349`).
- **Drawer** (`styles.css:776-814`): `min(21rem, 86vw)`, `translateX(100%)` → 0 over `.28s`, overlays
  the board, closed at the start of every game, vertical-text handle on the right edge that hides while
  open. Header: Undo, Mute, Animations (full/quick/off), Names toggle, New game, How to play, Flag bug,
  Save report. Body order is "how far back it looks": prompt → battle line → recently played faces
  (5, newest first, 2.6rem) → log.
- **Log** (`js/logpanel.js`): newest first, last 60 entries, `silent` skipped; card names are hover
  targets (`.card-ref`, dotted underline, `cursor: help`), whole-line fallback if the name did not
  survive phrasing; fizzle lines (`notice`) in actable gold with a left rule; **triggered-ability lines
  indented and prefixed with the source card** (`via`) so a trigger never reads as an extra turn
  (commit `2b493c5`); same-name cards on both sides get "your/the opponent's" stamped (commit
  `572ec3e`). Second-person prose is generated at render time in `js/logtext.js`, never stored.

---

## A8. Combat / VFX (`js/anim.js`)

**Architecture** (commit `a3caeb2`): `plan(prev, next, fromLog, human)` is **pure** and headless-tested
(`tests/test-anim.js`); it turns one apply's fresh log entries into steps. `run(steps, next, seat, done)`
plays them **on the old board** (a defeated card is still there to die), patches HP/damage in place
at each impact so the later redraw changes nothing, then calls `UI.render()` (`js/ui.js:69-84`).
`UI.render` refuses to draw while `anim.busy()`. Input is locked by a transparent `#fx-lock`; any click,
Esc, Space or Enter skips to the end.

**Timing table** (`js/anim.js:29-44`; `quick` = ×0.45; `off` default under reduced motion):

| Beat | ms |
|---|---|
| bolt travel | 520 (`cubic-bezier(.5,0,.9,.6)`) |
| impact | 460 |
| melee lunge / recoil | 480 (`cubic-bezier(.6,-.1,.9,.5)`) / 380 |
| volley stagger / gap between steps | 150 / 180 |
| defeat smoke hold / fly to discard | 320 / 850 |
| event or discard flying to pile | 650 |
| wait for spotlight to land before firing from it | 700 |
| final blast charge / boom / quiet hold (hold not scaled) | 750 / 1300 / 1000 |

**Step kinds**: `strike` (one source, several hits = one volley; ranged bolt sprite rotated by
`atan2`, coloured by alignment red/blue/gold, muzzle flash; or melee lunge of a card clone that stops
short of the target so the slash lands *on* it), `defeat` (smoke sprite + shake, then clone shrinks and
rotates ±18° into the owner's discard, which pulses `fx-received`), `upgradeGone`, `eventToDiscard`
(takes over from the spotlight), `handDiscard`, `baseBlast` (pure-CSS planet: core, molten glow,
flash, tilted shockwave ring `rotate(-14deg) scaleX(.25→3.3)`, 10 debris shards on `--a` angles),
`wait`.

**Feedback at the moment of impact** (`js/anim.js:330-342`): sfx → impact sprite (`mix-blend-mode:
screen`, `scale(.35)→1.05→1.25`) → card shake (`fx-hit`: ±5px, ±2°, `brightness(2.2)` flash, 420 ms)
→ floating damage number (`−N`, 1.7rem / 900 / `#ff5a4a`, rises to −190% over 900 ms; base hits 2.2rem;
shield pops say "SHIELD" in `#7cd4ff`) → patch the numbers.

Self-damage is drawn as three small off-centre detonations *inside* the card, not a zero-length bolt
(commit `38a6231`). Every sprite has a CSS-drawn fallback (`.no-sprite` gradients), so a fresh clone
with no `art/fx/` still animates. Melee-vs-ranged is derived from traits (the data has no such field).

Cleanup discipline: every timer, clone and hidden node is registered on the job (`timers`, `trash`,
`unhide`) and `finish()` clears all of them in one place (`js/anim.js:563-584`).

---

## A9. Audio (`js/sound.js`)

- **SFX ride the log**: each entry may carry `sound: 'deploy'`; `SB.sound.play(state, animated)`
  voices fresh entries, **one clip per tag per action**, unknown tags ignored (the engine can tag
  sounds that do not exist yet) (`:475-488`). Tags the animation owns (attack/hit/destroy) are skipped
  when animating and voiced by `anim.js` at the moment of the picture instead (`:33`, `:482`).
- **One AudioContext for everything.** Clips decoded once into buffers and fired as buffer sources at
  gain 0.5; 16 clips prewarmed on Start (`:47-86`). Mixing `<audio>` clips with a Web Audio score broke
  music on iPadOS (commit `9c0f939`).
- **iPadOS survival kit** (`:119-241`, commit `2bd65cf`): a silent looping 8-bit WAV `<audio>` element
  started from a gesture and never stopped (promotes the page to the media session so the ring switch
  does not mute it); unlock on the first pointerdown/touchend/keydown/click anywhere; `wake()` on
  statechange, visibilitychange, focus, pageshow and a 1 s poll; rebuild the context when it is
  `closed` or stuck `interrupted` for >3 polls.
- **Adaptive score**: three loop tiers keyed to the **lowest remaining base HP** (>20 / >10 / ≤10)
  (`:360-369`). Tier gain `[0.13, 0.20, 0.27]`, lowpass `[1500, 4500, 14000] Hz` — the opening tier is
  quieter and darker so it reads as tension (`:112-117`). New tier starts at full level, old one ducks
  out over 0.9 s. **Gapless loop inside the sustained body**: a 50 ms-window RMS envelope; loop from the
  first to the last window ≥ 0.8 × median loud level, nudged one window inward (`:256-288`). Silence
  trimming alone failed because a generated fade-out passes a silence test. All tier prompts shared one
  byte-identical musical brief so they read as one piece intensifying.
- **Finale**: deferred until the killing-blow animation ends; the end video claims the finale while it
  plays and hands it back after; fallback is a synthesized D-major / D-minor chord swell
  (`:372-429`, `js/endvideo.js`).
- Single-track fallback fetched only if tier tracks are missing (it was the largest file).

---

## A10. Typography and palette tokens

Font: `'Segoe UI', system-ui, sans-serif` everywhere (no webfont — zero load cost). Hierarchy is done
with weight, case and tracking, not families:

| Role | Spec |
|---|---|
| Game title | `clamp(2.2rem, 7vw, 5rem)` / 900 / uppercase / ls `.12em` / `#ffd166` / `0 4px 30px rgba(0,0,0,.95), 0 0 60px rgba(255,180,60,.35)` |
| Banner | `clamp(1.6rem, 4.4vw, 3rem)` / 800 / ls `.04em` |
| Section labels | `.6–.68rem` / 700 / uppercase / ls `.14–.16em` / muted |
| Body UI | `.74–.8rem`; log `.74rem` muted |
| Countdown / numbers | `font-variant-numeric: tabular-nums` |

```css
:root {
  --line: #2a3446;  --muted: #93a3bd;  --panel: #1a2030;
  --accent: #ffd166; --danger: #e5484d;
  --role-actable: #f5c34d; --role-selected: #5b9dff; --role-target: #ff6bcb; --role-picked: #45c98b;
}
body   { background: #10141c; color: #dfe6f0; }
button { background: #223049; border: 1px solid #3a4a68; border-radius: 6px; }  /* hover #2c3e5f */
.action-btn { background: #35558a; }
/* panels: #131824 drawer, #171d29 dialogs, var(--panel) choice; radius 12px;
   shadow 0 20px 80px rgba(0,0,0,.6); scrim colour family rgba(5,8,14,x) */
```

Aspect dots (`styles.css:290-297`) and lighter text variants (`:303-309`) are a 6-colour faction set;
the text variant is ~20% lighter than the dot so it reads over the plate.

---

## A11. Responsive behaviour

- **Remove content, don't shrink it** (`styles.css:876-887`): <900px hides traits, keyword line and the
  attachment strip on non-preview cards and tightens type; <620px drops preview side panels and the
  hand overlap (row of full cards); <420px shrinks the inspector card to 11rem.
- Hand width from **window height** (`clamp(4.5rem, 11.5vh, 8rem)`) because two hands share the height.
- All mat typography in `cqw`; padding in `cqw`, **never %** (percentage padding resolves against
  width, eating a quarter of a wide slot's height, `styles.css:157-160`).
- `dvh` for overlays, `min(21rem, 86vw)` drawer, `min(92vw, 46rem)` choice panel.
- `@media (hover: none)` disables the hover preview; long-press replaces it; `touch-action: none` on
  draggables is the one line that makes drag work on a phone.
- `prefers-reduced-motion`: no preview transition, spotlight opacity only, no pulses (initiative ring
  becomes a static ring), animations default to `off`, arrow dash stops.
- Measured, not eyeballed: mat aspect verified at 375x812, 1000x900, 1920x1000, 2000x731
  (commit `7083424`).

---

## A12. Performance tricks

1. Decoded-prototype `<img>` per file, cloned per render, `decoding='sync'` (flicker fix).
2. Forced layout read (`void el.getBoundingClientRect()` / `offsetWidth`) instead of rAF for every
   start-state flush — rAF stalls in background tabs.
3. Negative `animation-delay` from the wall clock so rebuilt nodes keep their pulse phase.
4. CSS-only overlap via `min()` + `--n`; JS supplies a count, never positions.
5. `isolation: isolate` on hand, enemy hand and mat to keep z 10..200 out of the root stacking context.
6. Full rebuild per render is fine (≈ a few hundred nodes); log windowed to 60; recent strip 5.
7. WebP q90 art (~60 KB), shrunk MP4s, music fallback fetched lazily, SFX prewarmed after the
   unlocking gesture.
8. Animate only `transform`/`opacity`; `will-change` only on in-flight clones and bolts.
9. Board is one SVG with a 2048x1280 viewBox: vector at every size, pattern tiles for texture.

---

## A13. Module structure (why it stayed maintainable)

No build step; plain IIFEs on one `SB` namespace, scripts in commented dependency order in
`index.html:91-142` (data/engine files mirrored in `tests.html`; UI files index-only).

| Layer | Files | Rule |
|---|---|---|
| Engine | `util.js` (`SB.log`, `:84`), `rules.js`, `state.js`, `effects.js`, `engine.js`, `ops*.js` | Surface is exactly `SB.legalActions`, `SB.apply` (never mutates), `SB.isTerminal`, plus `SB.whoActs` (`engine.js:9-15`, `:1309`). Log entries are objects with `type`, ids, `sound`, `notice`, `via`, `source`, `combat`. No prose, no DOM. |
| Text | `names.js`, `data/names-*.js`, `text.js`, `logtext.js` | All display strings in names files; rules text, prompts and log lines **generated** at render time. |
| Card view | `cardview.js` | The one renderer + glossary/token walkers. |
| Interaction | `preview.js`, `targeting.js`, `ui.js` | Every affordance derived from `legalActions`; one `applyRecorded` funnel for both seats (`ui.js:41-59`). |
| Chrome | `hud.js`, `title.js`, `help.js`, `logpanel.js` | View state only; never in undo history. |
| Presentation | `boardart.js`, `anim.js`, `sound.js`, `voice.js`, `endvideo.js` | Read the log/state; pure halves (`anim.plan`, `voice.lineFor`) tested headless. |
| Tooling | `bugreport.js` + `tools/replay-report.mjs` | Every match recorded (seed, decks, actions, log); a crash auto-saves; replay headless. |

Things that kept it honest: tests fail on any log type without a describer, on a face claiming a
keyword the engine would not honour, on unreachable voice pools; every non-obvious CSS rule carries a
comment saying *why* (the CSS reads as a decision log — worth imitating).

---

# Part B — Mapping to Lorcana

Lorcana's table, for reference: per player a **deck**, **discard**, **inkwell** (face-down cards; each
exerts to pay 1 ink; one card per turn may be inked if it is inkable), a **play area** holding
**characters, items and locations**, and a **lore** total racing to **20**. Characters **exert** (turn
90°) to quest, challenge or sing; new characters are "drying" (cannot quest/challenge the turn they
arrive, unless Rush). **Songs** are actions that can be paid by exerting a character of enough cost.
**Locations** are landscape cards with willpower, a move cost and per-turn lore; characters move to
them. Damage stays on cards until banished. Turns strictly alternate (Ready → Set → Draw → Main → End).

## B1. Transfers directly (copy the code/CSS, rename)

| SWU piece | Lorcana use | Notes |
|---|---|---|
| Engine boundary (`legalActions` / `apply` / `isTerminal` / `whoActs`), structured log, `via`, `notice`, `sound` tags | same | Decide this before the second log call. |
| Card renderer, 3 sizes, scrim values, text shadow, pip shadow, `em` typography, defensive render, proto-clone art cache, SVG fallback | same | Re-run the luminance sampling on the new art before trusting the scrim stops. |
| Keyword-glossary walker + "face shows only live keywords" rule | Evasive, Ward, Bodyguard, Rush, Reckless, Resist N, Challenger +N, Support, Singer N, Shift N | Substitute N into reminder text exactly as `cardview.js:365`. |
| Hover preview / inspector / long-press / zone browser / spotlight | same | Spotlight every played card and every **song**. |
| Flat overlapping hand (Model B) + `--n` / `--z` / `isolation` / `.is-fanned` plate hiding | same | Lorcana hands are 7 and rarely >10: Model B is still the right call. |
| Opponent hand as upside-down card backs clipped to the near quarter | same | |
| Face-down resource fan with `min()` overlap, small spent tilt, `ready/total` badge | **Inkwell** | Exerted ink = the 7° tilt + `brightness(.72)`, *not* 90° (twenty cards cannot afford the width). Inking = drag a hand card onto the inkwell (drop target derived from the `ink` action); show an inkable mark on hand cards that can be inked this turn. |
| Pile stacks with backing layers + count badge; deck list sorted, copies collapsed; discard browsable both sides | Deck, discard | |
| Four role colours, shared animation phase, drop-ok/drop-hot, 8px drag threshold, click-swallow, `touch-action:none` | same | |
| Curved, dash-crawling arrow (amber aiming → red declared) | **Challenge** declaration; reuse in teal/gold for **move to location** and for **singer → song** | Only exerted opposing characters are legal challenge targets — the drop targets enforce it for free. |
| Three choice UIs, panel over the play area with no scrim, peek + Esc, prompt line + centre echo, buttons that say what they do | same | Lorcana needs **multi-pick** (mulligan "put any number on the bottom", "choose up to 2"): implement the spec's `multiPicks` + Confirm/Clear + "2 of 0–7 selected", which SWU never built (`DEVIATIONS.md`). |
| Log drawer (overlay, edge handle, newest first, 60 window, card-ref hovers, trigger attribution, same-name side stamping), recently-played strip | same | |
| `anim.plan` / `anim.run` split, timing table, impact → shake → float number → patch, defeat → fly to discard, full/quick/off | Challenge damage, banishment, ability damage | |
| Audio: log-driven SFX, one AudioContext, iPad kit, RMS loop trim, tier crossfades, deferred finale | same | Re-key tiers (B2). |
| Board drawn as SVG from one geometry table, mirrored rows, side colours, per-game scenery | same | New geometry (B2). |
| Title splash → wipe → picker → chooser with hover peek; Start unlocks audio | same | Peek shows a deck's 2-3 signature cards (Lorcana has no leader/base) — e.g. the deck's highest-cost character and its two ink colours. |
| Responsive rules (remove content, hand from `vh`, cqw, dvh, hover:none, reduced motion) | same | |
| Post-mortem reveal (hand + inkwell face up at game end) | same | |
| Bug black box + headless replay | same | Cheap insurance; it paid for itself repeatedly. |

## B2. Needs adapting

**Board geometry.** Replace the SWU layout (5 slots per row + two arenas) with, per side:
`deck | discard | inkwell` along the outer edge, a **lore tracker** at one end, and a **play area**
split into two lanes — characters (front, toward the centre line) and items + locations (back). Keep
the mirrored-row construction and the "wider gap between groups" rule. The play area is shared-ground
in neither sense: it belongs to one side, so it takes that side's colour; the centre seam between the
two players' play areas can keep the warm/cool glow treatment.

**Exerted = 90°.** SWU's `rotate(4deg)` will not do. A transform does not change layout, so a rotated
5:7 card overlaps its neighbours. Put each in-play character in a slot whose **width animates from
`card-w` to `card-h`** when exerted, and rotate the card inside it about its centre:

```css
.char-slot { width: var(--card-board-w); transition: width .18s ease-out; }
.char-slot.is-exerted { width: calc(var(--card-board-w) * 7 / 5); }
.char-slot.is-exerted > .card { transform: rotate(90deg); }   /* origin 50% 50% */
```
Feed the `min()` overlap math the *slot* width (`--slot-w` per card, or count exerted cards into the
row width). Keep the plate legible when exerted — the rotated card is read sideways, so lean on the
hover preview (which always shows it upright) rather than counter-rotating text.

**Landscape location cards.** One renderer, add an orientation: `.card-landscape { aspect-ratio: 7/5 }`,
art generated at 704x512, `object-position: 50% 40%` (landscape scenes have no head to protect, tune
after ~20 renders), preview width ~26rem with `min-height` from the shorter side. Stats on a location:
move cost (corner), willpower, lore-per-turn. Characters *at* a location render in a small row docked
under it (reuse the attachment-strip idea, or a mini overlap row), and a move is the third arrow colour.

**Stat badges.** Lorcana faces carry: ink cost in a hexagon (top-left; draw an "inkable" ring around it
when the card can be inked), **strength** and **willpower** (bottom), **lore value** as 1-4 diamonds,
classifications (Storyborn / Hero / Villain / Princess …) in the trait line, ink colour as a corner dot.
Map SWU colours: strength `#ff9f87`, willpower `#8ee0ac` (damaged `#ffcf6b`), lore diamonds the accent
gold `#ffd166`. Six ink-colour dots + matching lighter text words, same pattern as SWU aspects
(Amber, Amethyst, Emerald, Ruby, Sapphire, Steel).

**Lore tracker instead of base HP.** A vertical 0-20 track per player beside their row (SVG, from the
geometry table), current value as a large tabular-nums number, the last 4 steps (16-19) warming toward
gold. Questing = a gold diamond flying from the character to the tracker with a floating `+N` (reuse
`flyTo` + `floatNumber`, gold variant), then the tracker ticks. Music tiers key on the **highest lore**
on the table (e.g. <10 / <16 / ≥16) instead of the lowest base HP. The planet blast becomes a
**lore-20 finale** over the winner's tracker (a burst of light / glimmer particles, same layered-CSS
construction, charge → boom → 1 s quiet → result).

**Turn banner.** Lorcana turns alternate cleanly, so announce **every turn** ("Your turn · Turn 4"),
which SWU could not (it would have strobed). Keep `pointer-events:none`, the 2.3 s curve and the
restart trick. The initiative ring becomes an **active-player** marker on that side's lore tracker.
Phases (Ready/Set/Draw) are automatic and should not get banners; log them as dividers.

**Challenge animation.** Lorcana challenge damage is simultaneous and all of it is "melee": use the
lunge for every challenge, land *both* damage numbers at the same impact beat (one beat, not SWU's two),
then banish whoever reached 0 willpower. Ability damage keeps the bolt (recolour by ink colour, not
alignment). Exerting is itself an animated beat (rotate over ~180 ms) before the lunge.

**Songs.** Spotlight the song; if sung, draw the singer exerting with a note/sparkle impact sprite and
log the song with `via` = singer. Drop targets: dragging a song onto an eligible ready character = sing
it (variant buttons if it could also be paid with ink); onto the play area = pay ink.

**Drying ink.** Characters that arrived this turn get a subtle "wet" treatment that does not hide the
art (a slow sheen sweep or a desaturated ring, not opacity) and no actable glow until dry — the glow is
already derived from `legalActions`, so it comes for free; the sheen is the explanation.

**Shift.** A shifted character sits on top of the card it shifted onto: draw it as a 2-layer stack with
the pile-layer offset, and show the underneath card in the preview's side panel (the slot SWU used for
"linked pilot").

**Leader popover → character action popover.** No leaders, but a character can quest, challenge, sing,
move or use an activated ability. Keep drag as the primary gesture (drag to opponent's exerted
character = challenge, to own location = move, **to your own lore tracker = quest**), and let a tap on a
ready character with several no-target actions open the popover (enlarged card + one button per legal
action), exactly as `hud.js:134-173` does for leaders.

**Results.** Add a small results panel after the finale video/animation: winner, final lore, turns,
cards inked, biggest quester; Rematch (same decks) and New game buttons. SWU only had "You win" in the
turn bar.

**Music/art briefs.** Keep the byte-identical style block and byte-identical musical brief trick; the
genre vocabulary list (`docs/ART-PROMPT-RULES.md` rule 7 analogue) has to be rebuilt for a storybook /
fairy-tale register from the first twenty renders.

**IP posture.** SWU shipped its own AI art and an original theme, with real names in one generated,
switchable pack. Lorcana's cards are Disney characters, so the art and naming decisions are larger than
in SWU; settle them (see SWU `CARD-GAME-LESSONS-2.md` §2 and `PAGES-PLAN.md`) before the first asset
commit, not after.

## B3. Drop

- **Two arenas, ground/space split, arena watermarks** — one play area per side.
- **Bases, base HP, base epic actions, the planet blast as-is** — replaced by the lore tracker and its finale.
- **Leader slot, deploy, leader-as-pilot, initiative claim and its ring/flag** — no equivalents (the
  ring idea survives as the active-player marker).
- **The Current token socket, credits badge, shields/experience/advantage badges** — no Lorcana analogue
  (damage counters remain; add a "drying" mark instead).
- **Smuggle/plot/exploit variant flows** — the variant-button bar itself stays for song/ink payment choice.
- **Per-round-only banner rule** — Lorcana announces per turn.
- **Melee-from-traits heuristic** — every challenge lunges.
- **Voice bubbles** — optional; cheap but cosmetic, and Disney character lines are an IP question. Park
  until the IP posture is settled.
- **End-of-match MP4** — optional; keep the hook (`endvideo.claim`) but the finale animation + results
  panel is enough for v1.
- **Names-source toggle** — only if the IP posture calls for a switchable pack.

## B4. Build order for the Lorcana UI (suggested)

1. Engine boundary + structured log with `sound`/`notice`/`via` from the first commit.
2. `renderCard` (portrait + landscape), scrim, stats/lore/ink pips, proto cache, fallback.
3. SVG board from one geometry table; zones placed by percentage; mat as the yielding flex row.
4. Hand (Model B), opponent hand, inkwell fan, piles, lore tracker.
5. Roles from `legalActions`; drag manager; drop targets (ink, play, challenge, move, quest, sing).
6. Exerted slot-width + 90° rotation; drying mark; shift stack.
7. Preview / inspector / long-press / spotlight; glossary + side panels.
8. Choice panel (incl. multi-pick), peek, prompt line + echo; arrows.
9. Log drawer, recent strip, banner per turn, active-player marker.
10. `anim.plan` (pure, tested) → `anim.run`: quest flight, challenge lunge, banish, song.
11. Audio (one context, iPad kit, lore-keyed tiers, finale); title → wipe → picker → chooser.
12. Results panel; responsive + reduced-motion pass; bug black box.
