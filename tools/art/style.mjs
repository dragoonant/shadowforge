// The one style block (PLAN.md D16: audition row B, FLUX.1 dev, name + description). Byte-identical
// on every card prompt; changing a single character starts a new set. It describes the look without
// naming a studio or game (a name invites its logo). build-art-prompts.mjs lints it like any prompt.
export const STYLE = 'super-deformed chibi figure with MGSD proportions, about two and a half heads tall, oversized head with big glossy anime eyes, short stubby limbs, richly detailed costume and textures, Japanese fantasy card game illustration, crisp anime line art, vivid colours, glossy cel shading with soft glow, dynamic lighting and sparkling effects, full-bleed scene edge to edge, purely pictorial, wordless and untitled, vertical portrait composition';

// Spells, amulets and other object/scene cards: the same direction; the chibi clause applies to any
// figures present.
// UI backdrops ("empty places", no figures): the same look as a background painting.
export const UI_STYLE = 'Japanese fantasy card game background painting, crisp anime line art, vivid colours, glossy cel shading with soft glow, dramatic lighting and sparkling effects, full-bleed scene edge to edge, purely pictorial, wordless and untitled, wide panoramic landscape composition';

// The model chosen in the audition (non-commercial licence; free fan project, docs/sources.md).
export const MODEL = 'dev';

// Per-class accent clause, appended so each class reads at a glance on the board.
export const CLASS_ACCENT = {
  forestcraft: 'verdant green and gold accents',
  swordcraft: 'steel and royal gold accents',
  runecraft: 'arcane violet and blue accents',
  dragoncraft: 'ember orange and crimson accents',
  abysscraft: 'blood crimson and shadow black accents',
  havencraft: 'holy ivory and radiant gold accents',
  neutral: 'silver and pearl accents',
};
