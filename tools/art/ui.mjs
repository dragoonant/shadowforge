// UI plates (16:9, 2 MP) -> art/masters/ui/<name>.png masters, art/ui/<name>.webp delivery.
// Backdrops are "empty places": figures absent, calm open centre, detail fading toward the edges, so
// cards and panels can sit on top. Names match what js/ui expects (title, deck-chooser, board-1..4,
// victory, defeat).
// Concept "evolution rite" (2026-10-30 re-skin): two summoners duel on a floating circular stone dais
// under a night sky; cards are summoned and evolve in bursts of white-cyan light. Palette: midnight
// indigo, deep teal, moonlit silver, pale cyan-white light. The old warm gold / violet-and-gold /
// lava-and-sunset look is retired. Avoid text-magnet words (rune, glyph, sign...): say "geometric
// engraved patterns" or "concentric rings of light".
export const UI_EMPTY = 'an empty place with a calm open centre, soft muted tones, detail fading gently toward the edges, a cool night palette of midnight indigo, deep teal, moonlit silver and pale cyan-white light';
export const UI = {
  'title': { subject: 'a vast circular stone dais floating above a sea of moonlit clouds, glowing concentric rings of pale cyan light etched into its smooth surface, an enormous full moon low on the horizon, a deep starry sky', set: 'at night in cool silver moonlight', empty: true },
  'deck-chooser': { subject: 'an open-air gallery of tall pale stone pillars under the night sky, large faceted gemstone crystals floating in a wide ring above a round stone floor, each crystal glowing a different colour: green, amber, blue, orange, crimson and white', set: 'at night under a deep starry sky in cool moonlight', empty: true },
  'board-1': { subject: 'a calm sea of moonlit clouds stretching to the far horizon, a wide smooth open expanse of soft cloud tops', set: 'at night under a bright full moon and scattered stars', empty: true },
  'board-2': { subject: 'green and teal aurora curtains rippling over snowy mountain peaks above a wide frozen plain of smooth pale ice', set: 'on a clear cold night under the stars', empty: true },
  'board-3': { subject: 'a perfectly still mirror lake reflecting a vast starry nebula of teal and indigo, a wide calm surface of dark water', set: 'at night in deep silence', empty: true },
  'board-4': { subject: 'quiet ruins of pale weathered stone around a wide open flagstone floor, small chunks of stone hovering weightlessly in the air above the ruins, low silver mist drifting across the ground', set: 'at night in soft silver moonlight', empty: true },
  'victory': { subject: 'a circular stone dais with a vertical beam of pure white-cyan light shooting straight up from its centre into the starry sky, glowing motes of light spiralling upward around the beam', set: 'at night under a deep starry sky', empty: true },
  'defeat': { subject: 'a cracked and darkened circular stone dais with deep fissures and broken edges, grey mist drifting across it, a dim moon half covered by a thick bank of heavy dark storm clouds', set: 'on a cold gloomy overcast night, dim and desaturated', empty: true },
};
