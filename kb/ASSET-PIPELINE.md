# Asset pipeline: how earlier projects made art, sound and music, and what to do for Lorecannae

Surveyed 2026-10-24 on EVILAEGIS. Paths under `~` mean the user's home folder (`%USERPROFILE%`).
Nothing outside `lorecannae\kb\` was changed. I checked token files by **name and HTTP status only**.
No key value was printed or copied.

---

## 0. The short version

| Asset | Use this | Status today |
|---|---|---|
| Card + UI art | **Flux Studio** (local, `http://localhost:7880`), **FLUX.2 klein 4B**, Apache-2.0, ComfyUI underneath | Installed. Weights present. Python/torch import OK. **Not running now; no image rendered in this survey** (the GPU is busy with another session's Hunyuan3D job). Last real use: MythosForge, 2026-10-17, 160 plates. |
| Art fallback | **SDXL base 1.0** via `MANAFORGE/tools/gen-art-sdxl.py` in the `~/Hunyuan3D-2` venv | Weights present. Venv imports OK (`torch 2.11+cu128`, CUDA available). `--dry-run` OK. |
| SFX | **Audio Studio** (local, `http://localhost:7890`), **Stable Audio Open 1.0** | Installed, but **only on an unmerged worktree branch** (see §5). Last real use: wh40k-murder-squad, 2026-10-17 (36 SFX). Not running now. |
| Music | **Audio Studio**, **ACE-Step 1.5 turbo** (Apache-2.0), instrumental | Same as SFX. 5 tracks made for wh40k. **Nobody has listened to them yet.** |
| Floor / fallback | Procedural Web Audio synth kit + procedural score in `js/audio.js` (the MarvelRivals `docs/sound.md` pattern) | Code pattern. Always ship it. |
| Cloud (old way) | FLUX.1-schnell through the HF router (`nscale`), ElevenLabs SFX/music | **Dead.** Every key checked returned **HTTP 401** (§7). Don't plan on cloud without a new key. |

GPU: **NVIDIA GeForce RTX 5080, 16 GB** (driver 617.42, CUDA 13.4). It's not AMD.
A second PC, **Alteisen** (RTX 3080 10 GB, `ssh alteisen`, `E:\AI`), was used for Hunyuan3D batches. It's not needed here.

---

## 1. What each earlier project did (chronological)

| Project (date) | Images | Audio | Delivery |
|---|---|---|---|
| MarvelRivalsCCG (2026-09-23) | FLUX.1-schnell via HF router `nscale`, 768×1024, 3 concurrent. `tools/lib/hf-image.mjs` cropped 8% off the bottom with **macOS `sips`** and encoded with `cwebp` q90, so it was built on the Mac. | **Procedural Web Audio score and SFX**, no files (`docs/sound.md`). | `art/cards/*.webp` (150, 15 MB) |
| FleshAndBloodTCG (2026-10-02) | FLUX.1-schnell via HF `nscale`, 768×1088 (5:7), about 15 s/card, 1.5 s pause between calls. | **ElevenLabs** `sound-generation` (17 SFX) and `music` `music_v1` (6 tracks, 20–110 s). The owner had rejected an earlier *procedural* score ("the music sucks"). | 560 px JPEG q86 (`shrink-art.ps1`, System.Drawing). 448 JPGs = 50 MB. PNG masters 578 MB (gitignored). Audio 6.9 MB MP3. |
| MANAFORGE (2026-10-03..07) | **Local SDXL base 1.0** (`gen-art-sdxl.py`, D13), 832×1216, 30 steps, CFG 7.5, fp16 VAE fix, seed = SHA-1 of the key. Fifteen styles (A–O, `art-styles.mjs`) assigned by FNV hash of the key (D17), picked after a five-style audition (`art-style-audition.mjs` + `audition-sheet.ps1`). `art-restyle.mjs` prunes images painted in a superseded style. HunyuanDiT tried once, then set aside. The HF `gen-art.mjs` was kept but not used. | No audio folder. | 560 px JPEG (343, 27 MB) |
| MythosForge (2026-10-16..18), **newest card game** | **Local Flux Studio, FLUX.2 klein 4B**, aspect `2:3` (832×1216), 1 MP, 4 steps, seed = FNV(id + `:` + seed-bump). `/api/settings {freeAfter:false}` keeps the model loaded for the run. `--backend hf` is kept as an alternative. | Procedural Web Audio placeholder. ElevenLabs `gen-sfx.mjs` / `gen-music.mjs` are written but **never ran** (no key). | `shrink-art.ps1`: crop the bottom 4%, 560 px JPEG q86 (≈150 KB each, 160 files). Masters 2.1 MB PNG each (327 MB). |
| wh40k-murder-squad (2026-10-17), not a card game | Figures: Gemini (Claude in Chrome), then Hunyuan3D. HF FLUX.1-dev and Qwen-Image were tried for concepts (`~/hf-tools`) and rejected. | **Local Audio Studio**: Stable Audio Open SFX (36), ACE-Step music (5), Qwen3-TTS narrator (12). `tools/gen-audio.ts`: FLAC → mono 44.1 kHz → trim → fade/crossfade → −1 dBFS → MP3 128 k (lamejs). `measure-audio.ts` writes `trims.json` gains. | 82 ids, 6.7 MB |

**MythosForge is the newest card pipeline and is the one to copy.** wh40k-murder-squad is the newest audio pipeline.

### `~/hf-tools` (not a card pipeline)
This is a small venv (`huggingface_hub 2.2`, pillow) plus prompt JSONs for the wh40k figure concepts. The `run_v2_*.bat` files `call E:\AI\...run_v2_alteisen.bat`, so they run on **Alteisen**, not here. `out/` holds FLUX.1-dev / Qwen-Image comparison renders (1024², `provider: auto`, seed 7) and Gemini bundles. The verdict was "FLUX ignores the head ratio, Qwen paints badges; Gemini stays the source". This doesn't apply to card art.

### `~/AudioStudio`
This holds the voice engines only: `chatterbox/.venv` (chatterbox-tts 0.1.7, torch 2.11 cu128, MIT, watermarked output) and `qwen-tts/.venv` (qwen_tts 0.1.1). Audio Studio starts them on ports 7891/7892 for voice jobs. Neither is needed unless Lorcana wants a narrator.

### `~/Hunyuan3D-2`, `~/Hunyuan3D-2.1`, `~/HunyuanVideo`
- `~/Hunyuan3D-2/.venv` (Python 3.11, torch 2.11+cu128, diffusers 0.32.2, transformers 4.48.3) runs SDXL. **Do not upgrade diffusers or transformers in it.** SDXL weights are at `~/.cache/hy3dgen/sdxl/{base,vae-fp16-fix,ip-adapter}`.
- `~/HunyuanVideo/ComfyUI_windows_portable` is **the** ComfyUI (v0.38.0, embedded torch 2.14+cu130). Every studio shares it on port 8188.
- Models in its `ComfyUI/models`: `diffusion_models/flux-2-klein-4b.safetensors`, `text_encoders/qwen_3_4b.safetensors`, `vae/flux2-vae.safetensors`, `checkpoints/flux1-dev-fp8` (non-commercial), `checkpoints/flux1-schnell-fp8`, **`checkpoints/ace_step_1.5_turbo_aio`**, **`checkpoints/stable_audio_open_1.0`**, `text_encoders/t5_base`, `foley/hunyuanvideo_foley_*` (non-commercial), and the HunyuanVideo 1.5 models.
- No MusicGen, AudioCraft or standalone Stable Diffusion WebUI is installed. ACE-Step and Stable Audio Open cover the same needs.

### CLI tools on PATH
`node` v24.19, `python` 3.12, `uv`, **`ffmpeg` 9.0.2 full build** (from winget; it has `libwebp`, `libmp3lame`, `libopus`, `libvorbis` and `aac`).
**Missing:** `cwebp`, `magick`, `sox`.
The wh40k doc says "no ffmpeg on this PC". That is now out of date: ffmpeg can do the WebP encode and the FLAC decode directly.

---

## 2. Measured speed

From 733 Flux Studio job logs (`3D Model Generation/flux-studio/outputs/*/job.json`):

| Job | n | median | worst |
|---|---|---|---|
| klein t2i 832×1216 (card portrait), 4 steps | 457 | **4 s** | 276 s (cold load or queue) |
| klein t2i 1216×832 (landscape) | 31 | 6 s | 18 s |
| klein t2i 1344×768 (16:9) | 21 | 3 s | 5 s |
| klein edit, 1 reference, 1024² | 164 | 4 s | 58 s (model swap) |
| FLUX.1 schnell 1344×768 | 1 | 19 s | |
| FLUX.1 dev 1024², 20 steps | 1 | 30 s | |

- The wall clock per plate in MythosForge's run, including client polling at 1.5 s, was about **15 s** between job folders. Budget **6–15 s per card**: 200 cards in about **20–50 min** per take.
- SDXL at 832×1216, 30 steps: timing was never logged. It is much slower than klein. Use it only as a fallback.
- Audio Studio (wh40k / Fell-in measurements): **two 6 s SFX in 5 s**. 2 s SFX: 6 s. **30 s music: 11 s cold, 40 s: 8 s warm.** Voice: 8–10 s per sentence plus 7–8 s load.
- HF FLUX-schnell (historical): about 15 s per card, paid.

---

## 3. Style-consistency tricks that worked

1. **One `STYLE` constant, byte-identical on every prompt.** The lint checks that it is present and unaltered. Changing one character starts a new set.
2. **An identity table, one clause per recurring character, written once** (`WHO` in FAB `art-identity.mjs`, `IDENTITY`/`NAMED` in MythosForge). Lorcana has many versions of the same character (several Elsas, Mickeys, and so on), so key it by character, not by card. A card with no entry **fails the build**. There is no generic fallback: MythosForge's template fallbacks gave nine skills the same portrait and every treachery the same man.
3. **Per-card scene clause** (MythosForge `SCENE` table, 92 entries). Each card gets its own setting. Don't use one backdrop per deck.
4. **Deterministic seed per key** (FNV or SHA-1 of the id). `--seed-bump N` re-rolls every plate at once.
5. **Prompt lint that refuses to write the JSON** (`build-art-prompts.mjs`):
   - counts above two (including "three-quarter" inside the style string)
   - text-magnet nouns: sign, banner, book, scroll, letter, label, logo, emblem, crest, map, screen
   - negations: no, not, without, never
   - franchise, artist, studio or game names (the list already contains **"disney"** and **"pixar"**)
   - prompts over 900 characters
   - cute words (MANAFORGE)
6. **Front-load the proportion or style anchor** right after the subject. Creatures drift to realism otherwise. SDXL reads only 77 tokens per encoder, so `gen-art-sdxl.py` sends `short + subject` to encoder 1 and `short + subject + setting + style` to encoder 2.
7. **Klein has no negative prompt.** Say it positively instead: "purely pictorial, wordless and untitled, full-bleed picture edge to edge". SDXL does have one: put text, watermark, frame and border there.
8. **A proper noun invites lettering.** In MythosForge, the town's name was painted as a banner on 7 story cards, and "magazine cover" produced a title banner. Describe the character visually and **never put the character's or card's name in the prompt.**
9. **Audition before committing.** Render the same 3 cards in about 5 candidate styles (MANAFORGE `art-style-audition.mjs`), then render a sample of three and look at it before any batch.
10. Optional, untested on cards: **klein edit mode** with a reference "identity plate" per character ("same character, now <scene>"). In Fell-in it kept the character but ignored a "no weapon" instruction.

---

## 4. Post-processing and budgets

- **Masters:** 832×1216 PNG, about 2.1 MB each (about 420 MB for 200), in `art/masters/` (gitignored). Superseded files go to `art/archive/` (gitignored). Never commit masters.
- **Delivery:** crop the **bottom 4–8%** (the model sometimes signs its work there; MarvelRivals needed 8% at 1024 px tall). Scale to **560 px wide**.
  - Old output: JPEG q86, about 150 KB.
  - Better now that ffmpeg is here: **WebP q85–90, about 45–60 KB** (lessons-3 measured 47 KB vs 363 KB). 200 cards come to about **10–12 MB**.
  ```
  ffmpeg -y -v error -i art/masters/<id>.png -vf "crop=iw:trunc(ih*0.95):0:0,scale=560:-2:flags=lanczos" -c:v libwebp -quality 88 art/cards/<id>.webp
  ```
- **Lorcana locations are landscape cards.** Render them at `aspect:'3:2'` (1216×832) and deliver them 784 px wide.
- **Board and backdrop art:** 16:9 at 2 MP (`megapixels:2`, about 1904×1088). Deliver at 1600 px WebP, about 200–300 KB. Ask for an **empty place**: no figures, muted, calm centre, detail fading to the edges. Draw it under the cards at low opacity (lessons-3 §8.4: 50% art / 55% scrim was too loud).
- **Draw geometry, don't generate it.** Card frames, ink-cost hexagons, the lore counter, the card back, icons and ink colour pips should be SVG/CSS. Generated emblems letter themselves.
- **Contact sheets:** `contact-sheet.ps1` (System.Drawing) reads PNG/JPG only, **not WebP**, so run it on masters. Use labelled sheets of 16–24 tiles and give them to a cheap-model subagent with the QC checklist (lettering, signature, extra limbs, melted face, off-style, wrong subject). Never view full-size renders in the main context.
- **Audio (wh40k recipe):**
  - mono 44.1 kHz
  - trim leading silence; 15 ms fade-out (120 ms for music); loops get a 1.5 s equal-power crossfade
  - peak −1 dBFS; MP3 128 kbps mono
  - per-id playback gain in `trims.json`: target RMS 0.16 for SFX, 0.10 for music
  - wh40k came to 82 ids / 7 min / 6.7 MB. Budget about **2–3 MB for 30 SFX** and about **6–9 MB for 5 music tracks**. If seamless looping matters more than size, add Opus-in-Ogg next to the MP3/AAC (lessons-4).
- **Manifests:** `write-manifest.mjs` writes `data/art-manifest.js` / `data/audio-manifest.js` from what is on disk. **Declare the manifest in `index.html` while it is still empty, and make a missing entry throw.** MANAFORGE-era project 5 silently drew placeholders over 59 paid renders through `X.artManifest || {}`.
- `check-art.mjs` gate: presence, zero-length, magic bytes, exact case, not in manifest.
- `stamp-assets.mjs` (MarvelRivals): `?v=<hash>` cache-busting for GitHub Pages' 10-minute cache.

---

## 5. Exact commands

### 5.1 Pre-flight (every time)
```powershell
nvidia-smi --query-gpu=name,memory.used,utilization.gpu --format=csv   # must be near idle
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | ? { $_.CommandLine -match 'Hunyuan3D|stage_' }   # another session's GPU job?
```
Rules: **one GPU job at a time**. Announce GPU work and wait for a go if the owner may be using the PC. **Never `taskkill /IM node.exe`**: it kills every studio and other sessions' servers.

### 5.2 Start the studios
```powershell
# Flux Studio (images). Starts ComfyUI on 8188 on the first job, or attaches to a running one.
node "C:\Claude Code Projects\3D Model Generation\flux-studio\server.js"
#   check: curl http://localhost:7880/api/status

# Audio Studio (SFX + music). Lives ONLY on branch claude/ai-audio-generation-packages-2714d8, in this worktree:
node "C:\Claude Code Projects\3D Model Generation\.claude\worktrees\ai-audio-generation-packages-2714d8\audio-studio\server.js"
#   check: curl http://localhost:7890/api/status   (want comfy: ready after the first job)
```
Run them as background processes. Both use the same ComfyUI, so run the art phase first, then the audio phase.

### 5.3 Flux Studio job API (as used by `MythosForge/tools/gen-art.mjs`)
```
POST /api/settings {freeAfter:false}                 # keep the model in VRAM for the batch
POST /api/jobs {model:'klein', prompt, aspect:'2:3', megapixels:1, batch:1, seed}  -> {id}
GET  /api/jobs/<id>  until status 'done' (or 'failed'/'cancelled')  -> {images:['image_0.png']}
GET  /files/<id>/image_0.png
POST /api/settings {freeAfter:true}                  # in a finally{}: give the VRAM back
```
Aspects: `1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9`; `megapixels` is 1 or 2. Klein uses 4 steps and guidance 1. **Don't use `dev`**: it is non-commercial.

### 5.4 Audio Studio job API (as used by `wh40k-murder-squad/tools/gen-audio.ts`)
```
POST /api/jobs {mode:'sfx',   prompt, negative, seconds:0.5-47, steps:50, guidance:5, batch:1-4, seed} -> audio_0..n.flac (44.1k stereo)
POST /api/jobs {mode:'music', prompt:'<style tags>', lyrics:'[Instrumental]', duration:10-240, steps:8, bpm, key:'D minor', timesig:'4', seed} -> audio_0.flac
GET  /api/jobs/<id>, GET /files/<id>/<file>, POST /api/jobs/<id>/cancel, POST /api/backend/free
```
wh40k caps each wait at 3 minutes, then cancels and retries once. It also retries once on 409 or "Server restarted".

### 5.5 Dry runs I ran today (no network, nothing generated)
```
node MythosForge/tools/gen-art.mjs --dry-run --limit 2            -> "0 planned, 160 already present, backend flux at http://localhost:7880 (klein)"
~/Hunyuan3D-2/.venv/Scripts/python.exe MANAFORGE/tools/gen-art-sdxl.py --dry-run --force <key>  -> prints prompt/prompt_2, OK
node FleshAndBloodTCG/tools/gen-sfx.mjs --dry-run                  -> OK
```

---

## 6. What to copy into `lorecannae/tools/` and how to adapt it

| Copy from | File | Adapt |
|---|---|---|
| MythosForge | `tools/gen-art.mjs` | Keep the flux backend and its seeding, `--seed-bump`, `freeAfter`, `--only/--limit/--force/--dry-run`. Add `aspect` per prompt entry (`2:3` for characters, actions and items; `3:2` for locations; `16:9` for UI). Add `--out` so UI art goes to its own folder. Remove or keep `--backend hf` (the key is dead). Add a `--prompts <file>` option for helper agents (FAB has one). |
| FAB + MythosForge | `tools/build-art-prompts.mjs` | Take FAB's structure (`WHO`, `CARDS`, plus `tools/art/<name>.mjs` per-illustrator files so several agents can work at once, and `--selftest`). Take MythosForge's `SCENE` override and object descriptions. Keep the lint and the ban on "disney"/"pixar". Add: card names and character names may not appear in a prompt. Add Lorcana text magnets ("storybook page", "glyph", "rune", "ink bottle label"). |
| FAB | `tools/art-identity.mjs` | Template for the identity table (`WHO` = one clause per character, `CARDS` = `{who, subject, setting}`). |
| MANAFORGE | `tools/art-style-audition.mjs`, `tools/audition-sheet.ps1` | Use for the style audition. Point it at the flux backend instead of SDXL. Use one seed per variant, not per card: the same seed made the five columns near-identical. |
| MANAFORGE | `tools/art-styles.mjs` + `tools/art-restyle.mjs` | Only if the owner wants a multi-style mix. For Lorcana, the better fit is **one STYLE plus a per-ink accent clause** (Amber, Amethyst, Emerald, Ruby, Sapphire, Steel), chosen by the card's ink, not by hash. |
| MANAFORGE | `tools/gen-art-sdxl.py` | Only as the offline fallback. It reads `{key, subject, setting, style, short}`. |
| MythosForge / FAB | `tools/shrink-art.ps1` | Replace the body with the ffmpeg WebP line in §4. Keep "skip if exists" and the crop. |
| FAB | `tools/write-manifest.mjs`, `tools/check-art.mjs` (+ MANAFORGE-era magic-byte/case checks), `tools/contact-sheet.ps1` | Rename the namespace (`window.FAB` → `window.LC` or similar). The contact sheet reads masters. |
| wh40k-murder-squad | `tools/gen-audio.ts`, `tools/measure-audio.ts`, the `tools/audio-manifest.json` shape | Port to `.mjs`. Swap the lamejs/Chromium decode for **ffmpeg** (decode FLAC, then encode `-c:a libmp3lame -b:a 128k -ac 1`). Keep idempotency, the wait caps, `gen-log.json`, the crossfade loop and `trims.json`. |
| MarvelRivalsCCG | `docs/sound.md` pattern → `js/audio.js` | One `AudioContext`; the audio rides the structured log; a synth voice per tag as the floor, with generated clips layered over it; a rate floor on frequent tags; mute persists; autoplay refusal means "wait". |
| MarvelRivalsCCG | `tools/stamp-assets.mjs` | Copy as-is. |
| — | **Don't copy** `MarvelRivalsCCG/tools/lib/hf-image.mjs` | It needs macOS `sips`. |

Token-file conventions (for cloud paths only):
- HF: env `HF_TOKEN`, else `hf_token.md` / `.hf_token` / `tokens.txt(.txt)` `HF=` line.
- ElevenLabs: env `ELEVENLABS_API_KEY`, else the `EL=` line or `elevenlabs.token.rtf` (OnePiece/BreachForge).
- MythosForge also reads `FLUX=` (studio URL). wh40k reads env `AUDIO_STUDIO_URL`.
- Keys come only from a gitignored file **inside this project folder**. Copy MythosForge's `.gitignore` secrets block into the very first commit.

---

## 7. Keys

Files exist (names only):
- `hf_token.md` in BreachForge, Final Fantasy TCG, MarvelRivalsCCG, OnePIeceTCG
- `.hf_token` in BreachForge, Final Fantasy TCG, OB64, SRWOG-TCG, Star wars unlimited
- `elevenlabs.token.rtf` in BreachForge, Mallet 42k, Mallet-42k, MarvelRivalsCCG, OnePIeceTCG
- `tokens.txt(.txt)` in FAB, MANAFORGE, WarMForge, WarMechForge, Dead-of-winner, Not-Enough-Minerals, StarCraft-TMG

Free read-only checks (HF `whoami-v2`, ElevenLabs `/v1/user/subscription`; no credits spent):
- **HF tokens from MANAFORGE, MarvelRivalsCCG and OnePIeceTCG: HTTP 401** (revoked or invalid).
- **The ElevenLabs key used by MANAFORGE/FAB, and the MarvelRivalsCCG key: HTTP 401 "Invalid API key".**
- I didn't test the other files: probing more keys was blocked by permissions, and I stopped there.

Conclusion: **treat cloud generation as unavailable.** If the owner wants ElevenLabs or HF, they need to put a fresh key in `lorecannae/tokens.txt` (gitignored).

---

## 8. Recommended overnight run: about 200 cards, UI, about 30 SFX, 3–5 tracks

**Before the owner sleeps (about 30 min with them):**
1. **Style audition.** 3 representative cards (a character, an action or item, a location) × 4–5 candidate STYLE strings on klein. That is about 15 renders in 2 minutes. Show one labelled contact sheet and get a pick.
   Suggested direction, in our own words, naming no studio or franchise: "storybook fantasy illustration, luminous painterly gouache and watercolour, soft glowing magic, swirling ink-splash flourishes, rich jewel colours, expressive character acting, full-bleed, purely pictorial, wordless and untitled".
2. **Owner decisions:** the Disney-likeness question (§9.1); one style vs per-ink accents; whether music is wanted at all (see §9.4).
3. **Sample three** in the chosen style, including the character with the most versions. Fix its `WHO` clause.
4. **Audio sample.** 2 SFX (card play, a quest/lore tick) × 4 variations, and one 30 s menu-music sketch (about 1 minute total). Get a thumbs-up or a correction.

**Unattended (the agent runs this sequence; budget about 3–4 hours including QC):**

| Step | Command (after porting) | Est. time |
|---|---|---|
| 0 | Pre-flight (§5.1). Keep the PC awake (`request_keep_awake`, or `powercfg /change standby-timeout-ac 0`, with the owner's OK). Start Flux Studio. | 2 min |
| 1 | `node tools/build-art-prompts.mjs` → "lint clean" | 1 min |
| 2 | `node tools/gen-art.mjs --dry-run`, then `node tools/gen-art.mjs` (idempotent; rerun until 0 outstanding) | about 40 min for 200 |
| 3 | Second take for all cards: `--seed-bump 1 --out art/take2` (optional, about 40 min). QC picks the better of the two per card. | 40 min |
| 4 | UI art: title backdrop, board/playmat zones, deck-select and result screens (8–12 plates, 16:9 at 2 MP, "empty place" style block) | 5 min |
| 5 | Contact sheets of 16, cheap-model QC subagents, `--force --only <key>` for failures (at most 2 retries each, archive first) | 45–60 min |
| 6 | `POST /api/settings {freeAfter:true}`. Stop Flux Studio's queue. Start Audio Studio. | 1 min |
| 7 | `node tools/gen-audio.mjs --kind sfx`: 30 ids × batch 4, keep the best by crest factor and length | 15 min |
| 8 | `node tools/gen-audio.mjs --kind music`: menu (60 s), 2 battle beds (90–120 s), victory and defeat stings (10–20 s). One shared musical brief so they read as one score, 2 takes each. | 10 min |
| 9 | Shrink to WebP, `measure-audio`, `write-manifest`, `check-art`, `stamp-assets`. Commit once, after QC. | 5 min |

Morning deliverable for the owner: contact sheets, a `sounds.html` audition page (wh40k has `public/sounds.html`), and a list of ids to redo. Say "**not verified by ear**" about every clip.

SFX starter list for Lorcana (about 30): card draw, card play, ink a card (into the inkwell), exert/ready, quest (lore gained), lore tick escalating toward 20, challenge declared, damage dealt, character banished, song sung, item played, location played, move to location, shift, Bodyguard/Evasive/Rush cues, shuffle, mulligan, turn start, button and hover clicks, victory sting, defeat sting, a glimmer shimmer, an ambience loop.

Prompt rules carried over from wh40k: describe the mechanism, not the brand. Say what to exclude ("no music, no voices") in `negative`. Use short dry transients for clicks.

---

## 9. Risks and known failure modes

1. **Disney IP.** Lorcana *is* Disney characters.
   - The lint bans the word "disney" and every earlier project's constant says no franchise names and no reproduction of official art. That conflicts directly with drawing recognisable Elsa or Mickey.
   - MANAFORGE D16 is the precedent: licensed characters were painted after the concern was stated once, and the site was public.
   - Disney is a far more aggressive rights holder than LSS or Wizards. **State the concern once, get the owner's call, and record it.** If public, the safer default is original characters, or "inspired-by" archetypes. Keep `docs/takedown.md` either way.
   - QC every render for "looks like a specific official illustration".
2. **The GPU is shared with other sessions.**
   - During this survey a wh40k Hunyuan3D `stage_shape.py` job held the RTX 5080 at **99% util and 11.3 GB VRAM**.
   - Flux Studio waits while a Hunyuan3D python process runs (the UI has a "Run anyway" button).
   - Hunyuan 2.1 shape needs about 40 GB of Windows commit charge, so free memory first and keep the pagefile large.
   - Plan the overnight window with the owner so no other session queues GPU work.
3. **Audio Studio is only on an unmerged worktree branch** (`claude/ai-audio-generation-packages-2714d8`, commit `d2e8af2`, also pushed to `origin`). A worktree cleanup would remove the checked-out copy. Ask the owner to merge it into `3D Model Generation` main, or start it from that path knowingly. **Don't modify that repo from Lorecannae.**
4. **Not confirmed working today.** Klein and Audio Studio were last used successfully on 2026-10-17. Nothing was rendered in this survey because the GPU was busy, and starting ComfyUI would have broken the one-GPU-job rule. **First action of the run: one klein plate and one 2 s SFX as a smoke test.**
5. **Windows Smart App Control** intermittently blocks ComfyUI's unsigned DLLs ("An Application Control policy has blocked this file"). Retry the start (backend dialog → Start ComfyUI). See `3D Model Generation/install/README.md` §Troubleshooting.
6. **Lettering:** from proper nouns, "cover", "title", "map", "book" and crowded public settings. The model also signs the bottom strip (crop it). About 1–2% of plates still need a forced regeneration.
7. **Wrong subjects from vague or trait-based clauses.** "Hunched creature" drew a bear or a wrestler; "cadaverous" drew a skull. Objects come out generic unless you describe the specific object. Lorcana items and actions need explicit scene clauses.
8. **Regeneration is not monotonic.** Regenerate only what failed, and archive first. `--only` must be an exact match: a substring filter once re-rendered a wide background at portrait size.
9. **Silent fallbacks** (`|| {}`) hide missing art. Wire the manifest empty and make a missing entry fail loudly. Add an in-app art-check screen.
10. **Music taste risk.** The owner rejected a procedural score once ("the music sucks"). ElevenLabs music was accepted on FAB. ACE-Step output (wh40k) has not been heard by anyone. Sample before batching, and keep the procedural score as the floor.
11. **Audio traps:** a sound tagged on a frequent mechanism (every ink, every lore point) drives players away, so rate-limit it and voice the picture, not the apply. On iPadOS, mixing `<audio>` elements with Web Audio parked the context silently: use one graph and a `wake()` (lessons-2).
12. **Licences:**
    - Klein, schnell and ACE-Step: Apache-2.0.
    - Stable Audio Open: Stability community licence, fine for a free fan project.
    - FLUX.1 dev and HunyuanVideo-Foley: **non-commercial, avoid.**
    - Hunyuan3D: Tencent non-commercial.
    - Chatterbox: output is watermarked.
13. **PowerShell 5.1 `Out-File` writes a UTF-8 BOM**, which breaks JSON readers. Write JSON from Node.
14. **Disk:** 200 masters × 2 takes is about 850 MB. MythosForge and FAB already hold about 1.2 GB of masters, so check free space.
