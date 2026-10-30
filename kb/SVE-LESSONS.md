# Lessons from shadowforge (Shadowverse: Evolve), 2026-10-29

What this project learned on top of lorecannae's `LORCANA-LESSONS.md`. Each line cost or saved time.

## Data

- **The official English site is the card database.** `/cards/?cardno=<NO>` has every field, the
  icons as `<img alt="[fanfare]">` tokens and the dated Q&A; `/cards/searchresults/?card_name=...`
  resolves a printed name. Tokens are left out of search unless `card_kind[]=Token` is sent, and some
  tokens are numbered `-PR<n>` instead of `-T<n>`.
- **Bushiroad Decklog has a JSON API:** `POST /system/app/api/view/<code>` with the view page as
  `Referer`. Any list with a code imports exactly.
- **Featured-deck pages are complete; tournament pages are standings only.** A list published by
  name (an article) needs spelling fixes (a dropped music note, a doubled letter) recorded next to
  the line.
- **Reprints differ in wording** ("this" vs "this card"): fold by name + type, compare text with the
  wording normalised.
- **The ruled line on a card separates ability groups** (a cemetery ability above a Quick spell),
  not just reminders. Don't stop parsing at it.
- **Fetch the cards' related tokens, then check every token name the text mentions** — five were
  linked from nowhere.

## Engine

- lorecannae's job / Ask / replay spine carried over unchanged; the new parts were three resource
  counters, the EX area, the evolve stack and the opponent's Quick window as a queue step.
- **A Quick window sits inside the queue**, so "nothing queued" can't be the test for "may act now".
  A reviewer found Quick activated abilities could never be used in the window.
- **A card leaving the field triggers from the face it had there** (an evolved follower's Last
  Words). Snapshot the face id before the move.
- **Doors added on request during the card work:** set/lose leader defense, Maneuver, effect-hosted
  triggers, choose-any-number, leave replacements, an evolve-cost mod, a deck-to-cemetery event,
  win the game, zero-cost plays that keep cost increases. Asking agents to mark "needs engine: X"
  and adding X centrally kept six writers off the engine file.
- **AI search copies the whole state per candidate.** Trimming the log in the search copy keeps
  Normal near 0.2 s a decision.

## Process

- **Six card agents in parallel, one class each, each owning two files,** finished 348 cards in
  about 30 minutes; the lead answered engine requests as they came.
- **Independent reviewers found 14 real bugs after every self-test passed** (Aura ignored in
  `canPlay`, a cost loop that stopped early, a crest counting the wrong card in a Fuse). Run them
  as soon as content lands; ask for CONFIRMED-by-script findings only.
- **The auditor lied in both directions:** 318 FAILs were false (the card sugar wrapped ability
  functions in closures, hiding their source). Keep the authored spec and audit that.
- **Prove each regression test bites** by restoring the old file and watching it fail; two tests
  passed on the broken code until rewritten.
- **Shell quoting corrupts JavaScript** written through Python heredocs (`\r?\n`, apostrophes in
  strings). Use the editor for code containing backslashes or quotes.

## Assets

- FLUX.1 dev on the local GPU: about 20 s a card plate, 37 s a 2 MP backdrop; 348 plates in ~2 h,
  rendered in 10-minute slices under the shared GPU lock.
- Backdrops still sign their corners; crop 7% off the bottom and 1.5% off the sides on delivery.
- Audio Studio made 31 effects and 6 tracks in under 4 minutes.

## Presentation (owner, 2026-10-30)

- **"The look and feel is too much like Lorecannae."** PLAN §4.12 set only a palette ("dark-fantasy
  card-arena"), so the interface shipped as lorecannae re-coloured: the same menu dialog, filigree
  frames, star card backs, serif type and board frame. Every game gets its own presentation concept
  drawn from its own world; the template gives structure, never the skin. Xross Forge (an esports
  broadcast for a streamer card game) is the model. Canonical rule: `dragoonant/tabletop-kb`
  README rule 21.
