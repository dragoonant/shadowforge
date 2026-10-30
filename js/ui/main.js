// js/ui/main.js — boot. Loaded last. A missing module is a broken build and throws loudly
// (CLAUDE.md rule 5: no `if (!SV.x)` fallbacks); a missing art or audio ENTRY is a normal state
// while assets are generated and falls back per card / per sound.
(function () {
  'use strict';
  const SV = globalThis.SV;

  function fail(msg) {
    const box = document.createElement('div');
    box.id = 'boot-error';
    box.textContent = 'shadowforge could not start: ' + msg;
    document.body.appendChild(box);
    throw new Error(msg);
  }
  const NEED = ['newGame', 'legalActions', 'apply', 'whoActs', 'isTerminal', 'chars', 'costToPlay', 'whyNot',
    'def', 'actionsFor', 'evolveInfo', 'canEvolve', 'evolveCandidates', 'canAttackWith', 'canAttackTarget',
    'quickOptions', 'overflow', 'sanguine', 'combo', 'superEvolveOK', 'endBlocker', 'deckProblems', 'playableDecks',
    'scriptCoverage', 'needsScript', 'parsed', 'makeTrace', 'isFollower', 'followers', 'faceId'];
  NEED.forEach(function (k) { if (typeof SV[k] !== 'function') fail('engine function SV.' + k + ' is missing (check the <!-- engine --> block).'); });
  if (!SV.ai || typeof SV.ai.choose !== 'function') fail('SV.ai.choose is missing (js/ai.js).');
  if (!SV.CARDS || !SV.DECKS || !SV.DEFECTS) fail('card data (data/cards.js, data/decks.js, data/defects.js) did not load.');
  if (!SV.ART || !SV.ART.cards || !SV.ART.ui) fail('data/art-manifest.js did not define SV.ART = {cards, ui}.');
  if (!SV.AUDIO || !SV.AUDIO.sfx || !SV.AUDIO.music) fail('data/audio-manifest.js did not define SV.AUDIO = {sfx, music}.');
  if (SV.logText.missing.length) console.error('[boot] log types without a phrase: ' + SV.logText.missing.join(', '));

  // A card with no art entry renders procedural art; say how many, once, so a thin manifest is
  // visible in the console rather than silently papered over.
  const noArt = Object.keys(SV.CARDS).filter(function (id) { return !SV.ART.cards[id]; });
  if (noArt.length) console.info('[boot] ' + noArt.length + ' of ' + Object.keys(SV.CARDS).length + ' cards have no art entry yet (procedural art shown).');
  if (SV.U.flags.lenient) console.warn('[boot] ?lenient=1: SV.LENIENT is on — unscripted spells resolve as nothing (dev only).');

  SV.boardArt.init(document.getElementById('mat'));
  SV.hud.init();
  if (SV.devFixture) SV.devFixture.boot();
  else SV.title.init();
})();
