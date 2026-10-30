# Rights — what the publishers permit, and what this project does about it

Checked 2026-10-29. Re-check before any change to visibility (PLAN.md D12).

## What was looked for, and found

- **Bushiroad (English):** https://en.bushiroad.com/ — the footer links only a Privacy Policy and a
  Cookie Policy. `https://en.bushiroad.com/terms-of-use/` returns 404. No fan-content, derivative
  work or IP guideline page was found on the site or by search.
- **Shadowverse: Evolve (English):** https://en.shadowverse-evolve.com/ — Privacy Policy and Cookie
  Policy only. Copyright line on every page: "© Cygames, Inc. ©bushiroad".
- **Cygames:** no fan-content policy covering Shadowverse: Evolve was found by search.

**Conclusion, stated once:** no published policy permits a rules-enforcing fan client, and none
forbids one. Rights are unknown, not granted.

## Precedent

- The English **Tabletop Simulator** mod for Shadowverse: Evolve (Steam Workshop item 2967696145)
  has been publicly updated since 2023, with English card names and a translated card spreadsheet.
  It does not enforce rules. Searched 2026-10-29; no report of a takedown was found.
- This is not permission; it is the current state of the world, dated.

## Crossover cards

Two decks in the pool (PLAN D5, D6) use crossover cards: Cardfight!! Vanguard (Bushiroad) and
Umamusume: Pretty Derby (Cygames). Their names and text are the respective owners' and are carried
in the same `data/cards.js`, so the same withdrawal lever covers them. Art for them follows the same
rules as every other card (CLAUDE.md rule 9).

## The owner's decision

**D12 (2026-10-29): public GitHub Pages**, the same posture as lorecannae. The concern above was
stated in `PLAN.md` §1 before the owner chose. See `docs/takedown.md` for the withdrawal commands.

## This project's posture regardless

- No official card images, icons, logos, frames or audio.
- No monetisation, no donations, no events.
- An unofficial / non-affiliation notice naming Cygames and Bushiroad (`NOTICE.md`, title screen).
- One generated file carries every name and text (`data/cards.js`); `--strip-text` withdraws them.
