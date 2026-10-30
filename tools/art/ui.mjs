// UI plates (16:9, 2 MP) -> art/masters/ui/<name>.png masters, art/ui/<name>.webp delivery.
// Backdrops are "empty places": figures absent, calm open centre, detail fading toward the edges, so
// cards and panels can sit on top. Names match what js/ui expects (title, deck-chooser, board-1..4,
// victory, defeat).
export const UI_EMPTY = 'an empty place with a calm open centre, soft muted tones, detail fading gently toward the edges';
export const UI = {
  'title': { subject: 'a vast twilight sky over a floating island of ancient ruins, two great beams of light, one violet and one golden, spiralling upward and crossing high above', set: 'at dusk with the first stars', empty: true },
  'deck-chooser': { subject: 'a grand arcane hall of tall arched windows and marble columns, floating motes of light in six colours drifting through the air', set: 'in warm lantern light', empty: true },
  'board-1': { subject: 'an ancient forest arena of mossy standing stones around a broad open clearing of soft grass', set: 'at night under silver moonlight and drifting fireflies', empty: true },
  'board-2': { subject: 'a ruined sky-colosseum of pale stone arches around a wide smooth arena floor', set: 'under a sunset sky of orange and violet clouds', empty: true },
  'board-3': { subject: 'a crystal cavern with glowing violet gem clusters along the walls around a smooth still floor', set: 'lit by soft inner crystal light', empty: true },
  'board-4': { subject: 'a volcanic plateau of dark basalt around a wide flat floor, rivers of glowing lava far away at the edges', set: 'under a smouldering red sky', empty: true },
  'victory': { subject: 'a triumphant golden sunrise over a sea of clouds, beams of light and sparkling motes rising into the sky', set: 'in the early morning', empty: true },
  'defeat': { subject: 'a lonely rain-swept battlefield of broken stone pillars under heavy grey clouds, the last embers fading into drifting fog', set: 'at dusk', empty: true },
};
