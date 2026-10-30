// Neutral card scripts (docs/ABILITIES.md).
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;

  // BP10-121EN Corruption Guardian
  // Ward.                                      (engine-read)
  // [fanfare] Discard an Angel or Fallen Angel card: Give your leader [defense]+3. Draw a card. Recover 2 play points.
  card('BP10-121EN', {
    fanfare(x) {
      // CR 10.4.7.4 "[process]: [effect]" on an automatic ability: optional, decided on resolution.
      const cand = x.hand().filter((i) => x.hasTrait(i, 'Angel') || x.hasTrait(i, 'Fallen Angel'));
      if (!cand.length) return;
      const pick = x.select({ from: cand, min: 0, max: 1, prompt: 'Corruption Guardian: you may discard an Angel or Fallen Angel card to give your leader +3 defense, draw a card and recover 2 play points.' });
      if (!pick.length) return;
      x.discard(pick[0]);
      x.heal(x.ctrl, 3); x.draw(1); x.recoverPP(2);
    },
  });
})();
