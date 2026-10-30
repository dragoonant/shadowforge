// Neutral card behaviour tests (see tests/cards-abysscraft.js for the conventions).
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok } = SV.T;
  const T = SV.T;
  const AP = T.FILLER;

  test('BP10-121EN Corruption Guardian: discarding an Angel gives +3 defense, a card and 2 play points', () => {
    let s = T.game({ p0: { hand: ['BP10-121EN', 'BP10-114EN'], pp: 6 } });
    s = T.play(s, s.players[0].hand[0]);
    const angel = T.find(s, 0, 'BP10-114EN', 'hand');
    eq(s.ask.kind, 'cards'); eq(s.ask.min, 0);
    s = T.answer(s, [angel]);
    eq(s.players[0].defense, 23); eq(s.players[0].pp, 3); eq(s.players[0].hand.length, 1);
  });

  test('BP10-121EN Corruption Guardian: declining the discard does nothing', () => {
    let s = T.game({ p0: { hand: ['BP10-121EN', 'BP10-114EN'], pp: 6 } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, []);
    eq(s.players[0].defense, 20); eq(s.players[0].pp, 1);
  });
})();
