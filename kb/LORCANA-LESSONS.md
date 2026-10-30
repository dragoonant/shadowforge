# Lessons from lorecannae (Disney Lorcana), overnight 2026-10-24

What this project learned on top of `LESSONS-DIGEST.md` and `CROSS-PROJECT-LESSONS.md`. Each line
is something that cost or saved real time tonight.

## Process

- **KB first, then parallel workers with disjoint files.** Four readers distilled the earlier
  projects in ~10 minutes; then assets, docs, UI and three card-script agents ran at once, each
  owning an explicit file list and never committing. The lead committed after reviewing. No
  overwrite incidents.
- **Freeze the engine contract before the UI starts.** `docs/ENGINE-API.md` let the UI agent build
  ~4,300 lines against an engine that didn't exist yet; integration found no engine bugs.
- **An authoring guide with worked examples in the real files** made 112 card scripts across three
  agents read as one hand. Examples covered every hook (trigger, activated, aura, late aura,
  selfCost, song action, global restriction).
- **Independent reviewers beat self-tests.** Agents' own per-card tests all passed; two fresh
  read-only reviewers (cards vs print, engine vs CR) still found 3 + 4 WRONG behaviours. Run them
  as soon as content lands.
- **Prove each regression test bites** by reverting the fix: the first banish-credit test passed on
  the buggy code (the trigger had no target, so it resolved silently). Add a second target.
- **Auditor false positives get explained, not loosened**: an `audit: '<n>: why'` note on the
  script, kept in the scanned source.

## Rules engine (Lorcana specifics)

- **CR 6.2.4**: "[trigger], if [condition]" is checked only on resolution. Five cards were first
  written with the check at trigger time; it matters when another trigger resolves first.
- **Banish credit (CR 1.8.1)**: only damage since the last game state check counts. Clear the
  record after each check, and let any damage overwrite it.
- **Stacks (CR 8.10.7, 5.1.1.7)**: the whole Shift/Boost stack goes to the top card's new zone, not
  the discard; a shifted character keeps effects on its base (8.10.5).
- **Simultaneous leave (CR 7.4.3)**: "banish all" and the state check move the group first, then
  every trigger sees the group.
- **Show the partly-resolved state while asking.** The replay model is correct, but showing the
  pre-job state hid paid costs (the singer still looked ready) — keep the partial state on screen
  and the snapshot for the replay.
- Lorcast's `keywords` array misses some keywords (Alert); read keyword lines from the text.

## AI

- **One opponent ply beat every weight change.** Weight sweeps (lore value, exposure) measured
  nothing; a rollout of our turn + the opponent's reply on determinized copies beat one-ply play
  80%.
- **Common random numbers are mandatory** when comparing candidates by rollout: give every
  candidate the same reshuffled worlds, or luck decides. Before that fix Hard skipped early inks
  (3.7% empty turns); after, 0.6% and +13 points head-to-head.
- Measure on holdout seeds: a "56.7%" weight change was 45% on fresh seeds.

## Assets and the shared GPU

- **A GPU reservation lock** (`C:\Claude Code Projects\.gpu-lock`) agreed with the other session
  turned a blocked night into done-by-3am: reserve while their run is busy, start after 2 min of
  idle, render ≤10 min, free VRAM+RAM, release, leave them a run, give up a reservation after
  25 min. "Wait for 2 min of idle" alone never fired — their runs were back to back.
- **IP check on a contact sheet** caught designs that drifted toward famous ones even with the
  identity table (the alien's gills read as big ears; toys came out human; a castle title evoked a
  studio logo). Ban the words, re-roll, look again.
- Painterly art compresses worse than cel art: ~140 KB per 560px WebP at q88.
