# Takedown

These are commands, not intentions. If Cygames, Bushiroad or anyone acting for them asks, run
the first level at once and the others as asked, without argument. Deployment status itself is
recorded in `PLAN.md` (D12); this file holds the commands that match it. If D12 changes, rewrite
this file in the same commit.

Current deployment (per PLAN D12): public GitHub Pages for `dragoonant/shadowforge`, served from
`main` at the repo root.

## Level 1: end the hosted copy

Stop serving the site:

```
gh api -X DELETE repos/dragoonant/shadowforge/pages
```

Make the repository private so the source is no longer public:

```
gh repo edit dragoonant/shadowforge --visibility private --accept-visibility-change-consequences
```

Or delete the repository outright (this cannot be undone; it needs the `delete_repo` scope, which
you add with `gh auth refresh -h github.com -s delete_repo`):

```
gh repo delete dragoonant/shadowforge --yes
```

Without `gh`: GitHub, repository Settings, Pages, "Unpublish site"; then Settings, General,
Danger Zone, "Change visibility" or "Delete this repository".

Making a repo private does not remove forks or cached copies. Ask GitHub support for those if a
holder requires it.

## Level 2: withdraw the names and text

All published card names and rules text sit in one generated file, `data/cards.js`; the deck
lists, which carry tournament players' handles and card numbers, are in `data/decks.js` and
`data/raw/decks.json`.

```
node tools/build-cards.mjs --strip-text
git commit -am "Withdraw card names and text on request"
git push
```

`--strip-text` regenerates `data/cards.js` with every `name`, `text`, `trait` and token text
replaced by a generic placeholder built from the card number and type. Numbers, stats and ids stay,
so the game still loads and saved decks keep working; the per-card tests that assert printed text
are expected to fail.

## Level 3: make the game unplayable from the repository

Remove the data files; load-time validation throws on the first frame:

```
git rm data/cards.js data/decks.js data/raw/decks.json
git commit -m "Withdraw card data on request"
git push
```

## Level 4: remove everything derived

When the project holds generated art and audio folders, remove them too:

```
git rm -r data art audio
git commit -m "Withdraw derived material on request"
git push
```

Removing files from the tip of `main` leaves them in git history. If a holder requires history to
be cleared, rewrite history or delete the repository (Level 1) and recreate it empty.

## After any level

Check that the deployed URL returns 404, then reply to the requester in the issue or message
that raised it.
