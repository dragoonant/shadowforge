// Abysscraft card behaviour tests: one per scripted card, named "<number> <name>: what it asserts".
// Build an exact position, act only through SV.apply (T.act / T.answer), assert the side effect.
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok } = SV.T;
  const T = SV.T;
  const AP = T.FILLER;

  test('BP16-080EN Gold Rush Ghost: from hand, choose 1 — token + 1 defense', () => {
    let s = T.game({ p0: { hand: ['BP16-080EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.kind, 'modes'); eq(s.ask.max, 1);
    s = T.answer(s, [0]);
    eq(s.players[0].field.length, 2, 'ghost + Arcane Personnel Carrier');
    eq(s.players[0].defense, 21);
  });

  test('BP16-080EN Gold Rush Ghost: put onto the field from the cemetery, choose up to 2', () => {
    // Summon it from the cemetery with Wretched Tryst (NC 10) to reach the "from the cemetery" branch.
    let s = T.game({ p0: { hand: ['BP11-079EN'], cemetery: ['BP16-080EN', 'BP16-080EN', ...Array(8).fill(AP)] } });
    s = T.play(s, s.players[0].hand[0]);
    const ghosts = T.findAll(s, 0, 'BP16-080EN');
    s = T.answer(s, ghosts);
    eq(s.ask.kind, 'bag', 'two Fanfares pending: the player orders them');
    s = T.answer(s, s.ask.options[0].id);
    eq(s.ask.kind, 'modes'); eq(s.ask.max, 2);
    s = T.answer(s, [0, 1]);
    eq(s.players[0].defense, 21);
  });

  test('BP16-080EN Gold Rush Ghost: buried at the start of each opponent\'s end phase, not its own', () => {
    let s = T.game({ p0: { field: ['BP16-080EN'] } });
    const g = s.players[0].field[0];
    s = T.endTurn(s);
    eq(T.zone(s, g), 'field', 'own end phase: stays');
    s = T.endTurn(s);
    eq(T.zone(s, g), 'cemetery', "opponent's end phase: buried");
  });

  test('BP01-116EN Soul Conversion: Quick — playable in the attack window; destroys your follower, draws 2', () => {
    let s = T.game({ p0: { field: [AP] }, p1: { hand: ['BP01-116EN'], field: [AP] } });
    s = T.act(s, { type: 'attack', iid: s.players[0].field[0], target: s.players[1].leader });
    ok(s.window && s.window.who === 1, 'the defender gets a Quick window');
    const sc = s.players[1].hand[0], mine = s.players[1].field[0];
    s = T.act(s, { type: 'play', iid: sc });
    s = T.answer(s, [mine]);
    eq(T.zone(s, mine), 'cemetery'); eq(s.players[1].hand.length, 2);
  });

  test('BP01-116EN Soul Conversion: not playable without a follower of your own', () => {
    const s = T.game({ p0: { hand: ['BP01-116EN'] }, p1: { field: [AP] } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].hand[0] }));
  });

  test('BP11-075EN Dead to Rights: the spell gives an enemy follower -2/-2', () => {
    let s = T.game({ p0: { hand: ['BP11-075EN'] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [t]);
    eq([T.atk(s, t), T.def(s, t)], [1, 1]);
  });

  test('BP11-075EN Dead to Rights: from the cemetery, banish it and an Iceschillendrig to engage an enemy follower', () => {
    let s = T.game({ p0: { cemetery: ['BP11-075EN', 'BP11-069EN'] }, p1: { field: [AP] } });
    const dtr = T.find(s, 0, 'BP11-075EN'), ice = T.find(s, 0, 'BP11-069EN'), t = s.players[1].field[0];
    s = T.act(s, { type: 'activate', iid: dtr, idx: 0 });
    s = T.answer(s, [ice]);
    s = T.answer(s, [t]);
    eq(T.zone(s, dtr), 'banished'); eq(T.zone(s, ice), 'banished'); eq(s.cards[t].engaged, true);
  });

  test('BP11-079EN Wretched Tryst: without Necrocharge 10 the followers are selected but not summoned', () => {
    let s = T.game({ p0: { hand: ['BP11-079EN'], cemetery: ['BP16-080EN', 'BP16-080EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, T.findAll(s, 0, 'BP16-080EN'));
    eq(s.players[0].field.length, 0);
  });
})();
