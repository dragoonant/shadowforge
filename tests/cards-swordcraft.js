// Swordcraft card behaviour tests (see tests/cards-abysscraft.js for the conventions).
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok } = SV.T;
  const T = SV.T;
  const AP = T.FILLER;

  test('BP20-026EN Returning Slash: deals 4 to the selected enemy follower', () => {
    let s = T.game({ p0: { hand: ['BP20-026EN'] }, p1: { field: [{ id: 'BP01-080EN' }] } });
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [t]);
    eq(T.def(s, t), 8);
  });

  test('BP20-026EN Returning Slash: Fuse from hand puts it in the EX area costing 1 less', () => {
    let s = T.game({ p0: { hand: ['BP20-026EN', 'BP20-026EN'] } });
    const [a, b] = s.players[0].hand;
    s = T.act(s, { type: 'activate', iid: a, idx: 0 });
    s = T.answer(s, [b]);
    eq(T.zone(s, a), 'ex'); eq(T.zone(s, b), 'cemetery');
    eq(SV.costToPlay(s, a), 1);
  });

  test('BP20-T02EN Crest: Octrice: a reversal counter at the start of your main phase and on each Loot card played', () => {
    let s = T.game({ p0: { ex: ['BP20-T02EN'], hand: ['BP20-026EN'] }, p1: { field: [AP] } });
    const crest = s.players[0].ex[0];
    s = T.play(s, T.find(s, 0, 'BP20-026EN', 'hand'));
    s = T.answer(s, [s.players[1].field[0]]);
    eq(s.cards[crest].counters.reversal, 1, 'Loot card played');
    s = T.endTurn(s); s = T.endTurn(s);
    eq(s.cards[crest].counters.reversal, 2, 'start of main phase');
  });
})();
