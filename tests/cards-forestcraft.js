// Forestcraft card behaviour tests (see tests/cards-abysscraft.js for the conventions).
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok } = SV.T;
  const T = SV.T;
  const AP = T.FILLER;

  test('BP17-001EN Arisa: Fanfare puts the chosen arrow token into the EX area', () => {
    let s = T.game({ p0: { hand: ['BP17-001EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.kind, 'modes');
    s = T.answer(s, [1]);
    eq(s.players[0].ex.map((i) => SV.CARDS[s.cards[i].id].name), ['Storm Arrow']);
  });

  test('BP17-001EN Arisa: the activated ability needs 5 cards played this turn', () => {
    let s = T.game({ p0: { field: ['BP17-001EN'], deck: [AP, AP, AP] } });
    const a = s.players[0].field[0];
    ok(!T.legal(s, { type: 'activate', iid: a, idx: 0 }));
    s.ti.played[0] = 5;
    ok(T.legal(s, { type: 'activate', iid: a, idx: 0 }));
  });

  test('BP19-009EN Budding Initiate: Combo (3) Fanfare evolves it for free', () => {
    let s = T.game({ p0: { hand: ['BP19-009EN'], evoDeck: ['BP19-010EN'], deck: [AP, AP, AP, AP, AP] } });
    s.ti.played[0] = 2;
    const b = s.players[0].hand[0];
    s = T.play(s, b);
    while (s.ask) s = T.answer(s, s.ask.kind === 'order' ? s.ask.from : []);
    ok(s.cards[b].evo, 'evolved'); eq(s.players[0].pp, 9, 'only the card cost was paid');
    eq(s.ti.evolveUsed[0], false, 'an effect evolve is not the once-per-turn evolve ability');
  });

  test('BP19-010EN Budding Initiate (evolved): On Evolve looks at 4 and may take a Condemned card', () => {
    let s = T.game({ p0: { field: ['BP19-009EN'], evoDeck: ['BP19-010EN'], deck: ['BP19-011EN', AP, AP, AP, AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.kind, 'cards'); eq(s.ask.seen.length, 4); eq(s.ask.from.length, 1);
    s = T.answer(s, s.ask.from);
    s = T.answer(s, s.ask.from); // the order of the rest
    eq(s.players[0].hand.map((i) => s.cards[i].id), ['BP19-011EN']);
    eq(s.players[0].deck.length, 4);
  });

  test('BP17-T02EN Gale Arrow: Combo (3) deals 2; below 3 cards played it deals nothing', () => {
    let s = T.game({ p0: { ex: ['BP17-T02EN'] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    let s2 = T.act(s, { type: 'play', iid: s.players[0].ex[0] });
    s2 = T.answer(s2, [t]);
    eq(T.def(s2, t), 3, 'combo 1: no damage');
    s.ti.played[0] = 2;
    s = T.act(s, { type: 'play', iid: s.players[0].ex[0] });
    s = T.answer(s, [t]);
    eq(T.def(s, t), 1);
    eq(s.cards[T.findAll(s, 0, 'BP17-T02EN')[0]].zone, 'gone', 'a token spell is eliminated after resolving (CR 9.1.4.3)');
  });
})();
