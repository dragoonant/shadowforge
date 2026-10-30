> **Copied from lorecannae on 2026-10-29** as shadowforge's knowledge base (PLAN D3). Everything
> below is lorecannae's kickoff text; read "Lorcana" as "the previous project". Paths like
> `../MANAFORGE/` are siblings of this repo's folder. Shadowverse: Evolve specifics are in
> `../PLAN.md` §3–§6.

# lorecannae knowledge base

Kickoff KB for the Disney Lorcana browser game, distilled 2026-10-24 from evilgouki's earlier
card and board games on this machine (EVILAEGIS). Read this file first; follow links for detail.

| File | What it holds |
|---|---|
| [LESSONS-DIGEST.md](LESSONS-DIGEST.md) | CARD-GAME-LESSONS 1–6, the three UI specs, MALLET-42K-LESSONS and the FAB/Magic handoffs, deduplicated by topic. **MUST** marks lessons learned painfully. Ends with "Applies to Lorcana". |
| [CROSS-PROJECT-LESSONS.md](CROSS-PROJECT-LESSONS.md) | Projects after Oct 3 (MythosForge, ChampionsForge, Mallet-42k, wh40k-murder-squad, Fell-in, …): project skeleton, owner feedback, overnight practice, IP posture, what changed since the card KB. |
| [ASSET-PIPELINE.md](ASSET-PIPELINE.md) | Local image (Flux Studio / FLUX.2 klein, SDXL fallback) and audio (Audio Studio: Stable Audio Open + ACE-Step) generation: commands, scripts to copy, overnight budget, risks. |
| [LORCANA-LESSONS.md](LORCANA-LESSONS.md) | What this project learned overnight: parallel agents, independent reviewers, CR 6.2.4/1.8.1/8.10.7/7.4.3 traps, rollout AI with common random numbers, the shared-GPU reservation lock. |
| [PRESENTATION-REFERENCE.md](PRESENTATION-REFERENCE.md) | Teardown of Starbound Legions' UI (owner's favourite presentation) and how it maps onto Lorcana's board. |

Canonical full-text originals: `../MANAFORGE/` (card KB, Oct 3), `../wh40k-murder-squad/docs/knowledge-base/` (newest cross-project digest, Oct 17).

## Decisions made at kickoff (owner, 2026-10-24)

- **Names / text:** real Lorcana card names and rules text are shown.
- **Art:** 100% original, painterly-storybook style. Never Disney character designs, logos or trade dress; no franchise names in prompts. Characters are drawn as original archetypes that fit the card's role.
- **Card pool:** every card in 20 championship decklists from the current meta (see below).
- **Modes:** vs AI, deck builder, hot-seat 2P, AI-vs-AI spectate, tutorial.
- **Deploy:** public GitHub Pages (`dragoonant/lorecannae`, Pages from `main` root, no build step, like fabforge).
- **Presentation:** emulate Starbound Legions where it makes sense.

## Card data

- Card data comes from the Lorcast API (`https://api.lorcast.com/v0/sets`, `/v0/sets/{code}/cards`). It has no key and covers sets 1–13+ with text, keywords, stats, ink, inkwell, move cost, classifications and legalities (`core` / `infinity`). Plain `curl` works.
- Decklists come from inkdecks.com (behind Cloudflare; `curl` and WebFetch get 403). Raw lists are in `../data/raw/nacc-decks.txt`, in the format `qty x <inkdecks set code><collector #>`.
- inkdecks set codes map to Lorcast sets as follows. All are **verified by name against Lorcast** except 5–8, which are unconfirmed and unused so far:

  | inkdecks code | Lorcast set |
  |---|---|
  | TFC | 1 |
  | ROTF | 2 |
  | ITI | 3 |
  | URSU | 4 |
  | FAB (Fabled) | 9 |
  | WSP (Whispers in the Well) | 10 |
  | WIN (Winterspell) | 11 |
  | WLD (Wilds Unknown) | 12 |
  | VINE (Attack of the Vine!) | 13 |

  Checked names: WLD62 = Luisa Madrigal – Pushing Through, ITI54 = Rafiki – Mystical Fighter, WIN13 = Grandmother Willow – Ancient Advisor, WSP60 = Cheshire Cat – Inexplicable, FAB46 = Dumbo – The Flying Elephant.
- Source event: Disney Lorcana Challenge North American Championship (DLC-NACC), Fanfinity, 2026-08-29, Set 13 Core, 136 players, 37 published lists. The 20 lists are picked for archetype spread: Midrange, Detectives ×4, Elinor ×2, Evasives ×2, Retro ×3, Songs ×2, Stitch, Steelsong, Actions, Amethyst Steel and ETB.
- Known data defects: inkdecks shows Rob Serpe's list as 50 cards and PandemoniumHeart's as 61. Re-check both, or swap in other lists.

## IP posture (summary; detail in CROSS-PROJECT-LESSONS §4)

- **Precedent:** Disney had the fan simulator Pixelborn shut down in June 2024. Pixelborn copied the card images, suggested affiliation and hosted cash-prize tournaments.
- **The live alternative:** Duels.ink still runs under Ravensburger's Fan Content Policy. It is free, carries a "not affiliated with, endorsed by, or sponsored by Disney or Ravensburger" disclaimer, and runs no paid events.
- **This project's rules:**
  - no official card images, logos or trade dress;
  - no monetization;
  - a clear unofficial / non-affiliation NOTICE;
  - `docs/takedown.md` describes the withdrawal lever: card names and text live in one generated data file.
- **Policy text not yet read:** the policy is in Ravensburger's Disney Lorcana Media Guide (public), `brand.ravensburger-group.com/d/e1vhRSQ7WeNy/overview#/policies/fan-content`. Its text sits behind a terms-acceptance dialog that Claude did not accept. evilgouki should read it.

## Open risks at kickoff

- **GPU contention:** a wh40k-murder-squad Hunyuan3D job was holding the RTX 5080 (99%, 11.3 GB) at kickoff. Rule: one GPU job at a time. Art and audio generation waits for it to finish.
- **Audio Studio not on main:** the Audio Studio exists only on an unmerged wh40k worktree branch. Don't let a worktree cleanup delete it.
- **Cloud keys dead:** the HF and ElevenLabs keys return 401, so all generation runs locally.
