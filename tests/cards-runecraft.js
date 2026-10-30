// runecraft card behaviour tests (see tests/cards-abysscraft.js for the conventions).
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok } = SV.T;
  const T = SV.T;
  const AP = T.FILLER;
  const W = 'BP05-T01EN'; // Destruction in White: an Idolatry amulet used as a field filler
  const GEN = 'BP01-080EN'; // Genesis Dragon 10/12
  const names = (s, list) => list.map((i) => SV.def(i, s).name);
  const hand0 = (s) => s.players[0].hand;

  test('BP05-037EN Lishenna, Omen of Destruction: Fanfare puts both Destruction tokens into the EX area', () => {
    let s = T.game({ p0: { hand: ['BP05-037EN'] } });
    s = T.play(s, hand0(s)[0]);
    eq(names(s, s.players[0].ex), ['Destruction in White', 'Destruction in Black']);
  });

  test('BP05-037EN Lishenna, Omen of Destruction: with room for one token the player chooses which (Q664)', () => {
    let s = T.game({ p0: { hand: ['BP05-037EN'], ex: [AP, AP, AP, AP] } });
    s = T.play(s, hand0(s)[0]);
    eq(s.ask.kind, 'modes');
    s = T.answer(s, [1]);
    eq(names(s, s.players[0].ex).slice(4), ['Destruction in Black']);
  });

  test('BP05-T01EN Destruction in White: +2 defense at the start of your main phase', () => {
    let s = T.game({ p0: { field: [W] } });
    s = T.endTurn(s); s = T.endTurn(s);
    eq(s.players[0].defense, 22);
  });

  test('BP05-T02EN Destruction in Black: 2 damage to the enemy leader at the start of your main phase', () => {
    let s = T.game({ p0: { field: ['BP05-T02EN'] } });
    s = T.endTurn(s);
    eq(s.players[1].defense, 20, 'not on the opponent\'s turn');
    s = T.endTurn(s);
    eq(s.players[1].defense, 18);
  });

  test('BP05-041EN Destructive Refrain: option 1 searches for Lishenna, Omen of Destruction', () => {
    let s = T.game({ p0: { hand: ['BP05-041EN'], deck: [AP, 'BP05-037EN', AP] } });
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, [0]);
    s = T.answer(s, s.ask.from);
    eq(names(s, hand0(s)), ['Lishenna, Omen of Destruction']);
  });

  test('BP05-041EN Destructive Refrain: option 2 pays 2 to deal X (Idolatry cards) to each enemy follower', () => {
    let s = T.game({ p0: { hand: ['BP05-041EN'], field: [W, W] }, p1: { field: [AP, AP] } });
    const [a, b] = s.players[1].field;
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, [1]);
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq([T.def(s, a), T.def(s, b)], [1, 1]); eq(s.players[0].pp, 7);
  });

  test('BP05-045EN Monochromatic Destruction: 2 to the follower, 2 to its leader and +2 with 2 Idolatry cards', () => {
    let s = T.game({ p0: { hand: ['BP05-045EN'], field: [W, W] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, [t]);
    eq(T.def(s, t), 1); eq(s.players[1].defense, 18); eq(s.players[0].defense, 22);
    const s2 = T.game({ p0: { hand: ['BP05-045EN'], field: [W, W] } });
    ok(!T.legal(s2, { type: 'play', iid: s2.players[0].hand[0] }), 'Q667: no enemy follower, not playable');
  });

  test('BP05-048EN Servant of Destruction: with 3 Idolatry cards its evolve costs 0 this turn', () => {
    let s = T.game({ p0: { hand: ['BP05-048EN'], field: [W, W], evoDeck: ['BP05-049EN'] }, p1: { field: [AP] } });
    const sv = hand0(s)[0];
    s = T.play(s, sv);
    eq(s.players[0].pp, 8);
    ok(!T.legal(s, { type: 'evolve', iid: sv }), 'the 2-cost evolve is replaced');
    s = T.act(s, { type: 'activate', iid: sv, idx: 0 });
    s = T.answer(s, [s.players[1].field[0]]); // On Evolve target
    ok(s.cards[sv].evo, 'evolved'); eq(s.players[0].pp, 8, 'evolved for 0'); eq(s.ti.evolveUsed[0], true);
    let s3 = T.game({ p0: { hand: ['BP05-048EN'], field: [W], evoDeck: ['BP05-049EN'] } });
    const sv3 = s3.players[0].hand[0];
    s3 = T.play(s3, sv3);
    ok(T.legal(s3, { type: 'evolve', iid: sv3 }) && !T.legal(s3, { type: 'activate', iid: sv3, idx: 0 }), 'only 2 Idolatry cards: normal evolve');
  });

  test('BP05-049EN Servant of Destruction (evolved): On Evolve deals 2 to an enemy follower and its leader', () => {
    let s = T.game({ p0: { field: ['BP05-048EN'], evoDeck: ['BP05-049EN'] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [t]);
    eq(T.def(s, t), 1); eq(s.players[1].defense, 18); eq(s.players[0].pp, 8);
  });

  test('BP08-050EN Zealot of Destruction: with 3 Idolatry cards destroys, 2 to its leader, +2 to yours', () => {
    let s = T.game({ p0: { hand: ['BP08-050EN'], field: [W, W] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'cemetery'); eq(s.players[1].defense, 18); eq(s.players[0].defense, 22);
    let s2 = T.game({ p0: { hand: ['BP08-050EN'], field: [W] }, p1: { field: [AP] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    ok(!s2.ask, 'only 2 Idolatry cards: nothing'); eq(T.zone(s2, s2.players[1].field[0]), 'field');
  });

  test('BP08-051EN Joy of Destruction: recovers 1 play point and draws with Lishenna, Omen of Destruction', () => {
    let s = T.game({ p0: { hand: ['BP08-051EN'], field: ['BP05-037EN'], pp: 5 } });
    s = T.play(s, hand0(s)[0]);
    eq(s.players[0].pp, 6); eq(hand0(s).length, 1);
  });

  test('BP15-039EN Lishenna, Melodious Destruction: Fanfare with 3 Idolatry cards gives a Melodious Monody', () => {
    let s = T.game({ p0: { hand: ['BP15-039EN', 'BP15-039EN'], field: [W] } });
    s = T.play(s, hand0(s)[0]);
    eq(s.players[0].ex.length, 0, '2 Idolatry cards: no token');
    s = T.play(s, hand0(s)[0]);
    eq(names(s, s.players[0].ex), ['Melodious Monody']);
  });

  test('BP15-040EN Lishenna, Melodious Destruction (evolved): puts up to 2 Idolatry cards from the top 4 into the EX area', () => {
    let s = T.game({ p0: { field: ['BP15-039EN'], evoDeck: ['BP15-040EN'], deck: ['BP05-045EN', AP, 'BP08-051EN', AP, AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.from.length, 2); eq(s.ask.max, 2); eq(s.ask.seen.length, 4);
    s = T.answer(s, s.ask.from);
    s = T.answer(s, s.ask.from); // order of the rest
    eq(names(s, s.players[0].ex).sort(), ['Joy of Destruction', 'Monochromatic Destruction']);
    eq(s.players[0].deck.length, 3);
  });

  test("BP15-045EN Melody's Return: banishes a Lishenna from the cemetery and summons one from the deck", () => {
    let s = T.game({ p0: { hand: ['BP15-045EN'], cemetery: ['BP15-039EN'], field: [W, W], deck: [AP, 'BP05-037EN', AP] } });
    const cem = T.find(s, 0, 'BP15-039EN');
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, [cem]);
    s = T.answer(s, s.ask.from);
    eq(T.zone(s, cem), 'banished'); eq(T.zone(s, T.find(s, 0, 'BP05-037EN')), 'field');
    const s2 = T.game({ p0: { hand: ['BP15-045EN'], field: [W, W], deck: ['BP05-037EN'] } });
    ok(!T.legal(s2, { type: 'play', iid: s2.players[0].hand[0] }), 'the additional cost cannot be paid');
  });

  test('BP15-054EN Hermit of Destruction: 3 damage to the selected follower with 3 Idolatry cards', () => {
    let s = T.game({ p0: { hand: ['BP15-054EN'], field: [W, W] }, p1: { field: [GEN] } });
    const t = s.players[1].field[0];
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, [t]);
    eq(T.def(s, t), 9);
  });

  test('BP20-T13EN Melodious Monody: 2 damage per Idolatry card engaged as its additional cost', () => {
    let s = T.game({ p0: { ex: ['BP20-T13EN'], field: ['BP15-054EN', 'BP15-054EN', W] }, p1: { field: [GEN] } });
    const [h1, h2] = s.players[0].field;
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].ex[0]);
    eq(s.ask.min, 0); eq(s.ask.max, 3);
    s = T.answer(s, [h1, h2]);
    s = T.answer(s, [t]);
    eq(T.def(s, t), 8); ok(s.cards[h1].engaged && s.cards[h2].engaged);
  });

  test('BP20-037EN Lishenna, Melody Manifest: (1) destroys another Idolatry card for a Melodious Monody; (2) summons White Psalm', () => {
    let s = T.game({ p0: { hand: ['BP20-037EN'], field: [W] } });
    const w = s.players[0].field[0];
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, [0]);
    s = T.answer(s, [w]);
    eq(T.zone(s, w), 'gone', 'the token was destroyed'); eq(names(s, s.players[0].ex), ['Melodious Monody']);
    let s2 = T.game({ p0: { hand: ['BP20-037EN'] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.ask.options[0].enabled, false, 'no other Idolatry card: option 1 disabled');
    s2 = T.answer(s2, [1]);
    eq(names(s2, s2.players[0].field), ['Lishenna, Melody Manifest', 'White Psalm, New Revelation']);
  });

  test('BP20-041EN Axia, Heir to Destruction (evolved): On Evolve buries another Idolatry card to tutor a Lishenna', () => {
    let s = T.game({ p0: { field: ['BP20-040EN', W], evoDeck: ['BP20-041EN'], deck: [AP, 'BP15-039EN', AP] } });
    const w = s.players[0].field[1];
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.min, 0);
    s = T.answer(s, [w]);
    s = T.answer(s, s.ask.from);
    eq(T.zone(s, w), 'gone'); eq(names(s, hand0(s)), ['Lishenna, Melodious Destruction']);
  });

  test('BP20-041EN Axia (evolved): once per turn, an Idolatry amulet entering your field deals 2 to an enemy follower', () => {
    let s = T.game({ p0: { field: [{ id: 'BP20-040EN', evo: 'BP20-041EN' }], hand: ['BP20-045EN', 'BP20-045EN'] }, p1: { field: [GEN] } });
    const t = s.players[1].field[0];
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, [1]); // summon White Psalm
    s = T.answer(s, [t]);
    eq(T.def(s, t), 10);
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, [1]);
    ok(!s.ask, 'second amulet this turn: no trigger'); eq(T.def(s, t), 10);
  });

  test('BP20-044EN Congregant of Destruction: [act] buries another Idolatry card to destroy and hit the leader, once per turn', () => {
    let s = T.game({ p0: { field: ['BP20-044EN', W, W] }, p1: { field: [AP, AP] } });
    const c = s.players[0].field[0], w = s.players[0].field[1];
    const t = s.players[1].field[0];
    s = T.act(s, { type: 'activate', iid: c, idx: 0 });
    s = T.answer(s, [w]);
    s = T.answer(s, [t]);
    eq(T.zone(s, w), 'gone'); eq(T.zone(s, t), 'cemetery'); eq(s.players[1].defense, 18);
    ok(!T.legal(s, { type: 'activate', iid: c, idx: 0 }), 'once per turn');
  });

  test('BP20-044EN Congregant of Destruction: Fanfare cost is optional', () => {
    let s = T.game({ p0: { hand: ['BP20-044EN'], field: [W] }, p1: { field: [AP] } });
    s = T.play(s, hand0(s)[0]);
    eq(s.ask.min, 0);
    s = T.answer(s, []);
    eq(T.zone(s, s.players[1].field[0]), 'field'); eq(s.players[1].defense, 20);
  });

  test('BP20-045EN Devastating Soprano: (1) destroys an Idolatry card on your field and draws', () => {
    let s = T.game({ p0: { hand: ['BP20-045EN'], field: [W] } });
    const w = s.players[0].field[0];
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, [0]);
    s = T.answer(s, [w]);
    eq(T.zone(s, w), 'gone'); eq(hand0(s).length, 1);
  });

  test('BP20-048EN Supplicant of Destruction: engage and bury another Idolatry card to deal 2 to the enemy leader', () => {
    let s = T.game({ p0: { field: ['BP20-048EN', W] } });
    const [sp, w] = s.players[0].field;
    s = T.act(s, { type: 'activate', iid: sp, idx: 0 });
    s = T.answer(s, [w]);
    s = T.answer(s, [s.players[1].leader]);
    eq(s.players[1].defense, 18); ok(s.cards[sp].engaged); eq(T.zone(s, w), 'gone');
  });

  test('BP20-051EN Devotee of Destruction (evolved): On Evolve may bury another Idolatry card to draw', () => {
    let s = T.game({ p0: { field: ['BP20-050EN', W], evoDeck: ['BP20-051EN'] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [s.players[0].field[1]]);
    eq(hand0(s).length, 1); eq(s.players[0].field.length, 1);
  });

  test('BP20-055EN Wasteland of Destruction: Fanfare takes an Omen–Idolatry card from the top 2; [act] buries this and another', () => {
    let s = T.game({ p0: { hand: ['BP20-055EN'], deck: [AP, 'BP15-054EN', AP] } });
    s = T.play(s, hand0(s)[0]);
    eq(s.ask.seen.length, 2); eq(s.ask.from.length, 1);
    s = T.answer(s, s.ask.from);
    eq(names(s, hand0(s)), ['Hermit of Destruction']);
    let s2 = T.game({ p0: { field: ['BP20-055EN', W] } });
    const [wl, w] = s2.players[0].field;
    s2 = T.act(s2, { type: 'activate', iid: wl, idx: 0 });
    s2 = T.answer(s2, [w]);
    eq(T.zone(s2, wl), 'cemetery'); eq(T.zone(s2, w), 'gone');
  });

  test('BP20-T03EN White Psalm: engage 3 Idolatry cards to bury it; Last Words summons Black Psalm and +1 defense', () => {
    let s = T.game({ p0: { field: ['BP20-T03EN', W, W] } });
    const ps = s.players[0].field[0];
    s = T.act(s, { type: 'activate', iid: ps, idx: 0 });
    eq(s.ask.min, 3);
    s = T.answer(s, s.ask.from);
    eq(T.zone(s, ps), 'gone'); eq(s.players[0].defense, 21);
    ok(names(s, s.players[0].field).includes('Black Psalm, New Revelation'));
    const s2 = T.game({ p0: { field: ['BP20-T03EN', W] } });
    ok(!T.legal(s2, { type: 'activate', iid: s2.players[0].field[0], idx: 0 }), 'needs 3 Idolatry cards');
  });

  test('BP20-T04EN Black Psalm: Last Words summons White Psalm and deals 1 to the enemy leader', () => {
    let s = T.game({ p0: { field: ['BP20-T04EN', W, W] } });
    s = T.act(s, { type: 'activate', iid: s.players[0].field[0], idx: 0 });
    s = T.answer(s, s.ask.from);
    eq(s.players[1].defense, 19);
    ok(names(s, s.players[0].field).includes('White Psalm, New Revelation'));
  });

  test('BP17-040EN Belphomet: costs 0 with a 6-cost Machina; buries it and summons an Assault Tentacle', () => {
    let s = T.game({ p0: { hand: ['BP17-040EN'], field: ['BP19-041EN'] } });
    const b = hand0(s)[0], k = s.players[0].field[0];
    eq(SV.costToPlay(s, b), 0);
    s = T.play(s, b);
    eq(T.zone(s, k), 'cemetery'); eq(names(s, s.players[0].field), ['Belphomet, Ultimate Creator', 'Assault Tentacle']);
    eq(s.players[0].pp, 10);
    const s2 = T.game({ p0: { hand: ['BP17-040EN'] } });
    eq(SV.costToPlay(s2, s2.players[0].hand[0]), 5);
  });

  test('BP17-T15EN Assault Tentacle: Last Words deals 4 to a selected enemy follower', () => {
    let s = T.game({ p0: { field: ['BP17-T15EN'] }, p1: { field: [{ id: AP, engaged: true }, GEN] } });
    const [ap, gen] = s.players[1].field;
    s = T.attack(s, s.players[0].field[0], ap);
    eq(s.ask.from, [gen]);
    s = T.answer(s, [gen]);
    eq(T.def(s, gen), 8);
  });

  test('BP19-038EN Sephie: Fuse a Condemned follower places a fusion counter and draws; Fanfare spends it on a Chimera', () => {
    let s = T.game({ p0: { hand: ['BP19-038EN', 'BP19-048EN'] } });
    const se = T.find(s, 0, 'BP19-038EN'), vo = T.find(s, 0, 'BP19-048EN');
    s = T.act(s, { type: 'activate', iid: se, idx: 0 });
    s = T.answer(s, [vo]);
    eq(T.zone(s, se), 'ex'); eq(s.cards[se].counters.fusion, 1);
    eq(s.ask && s.ask.kind, 'cards', 'Volunteer Test Subject: draw, then discard');
    s = T.answer(s, [hand0(s)[0]]);
    eq(hand0(s).length, 1, 'Sephie drew 1, Volunteer drew 1 and discarded 1');
    s = T.play(s, se);
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(names(s, s.players[0].field), ['Sephie, Depraved Convict', 'Chimera Test Subject']);
    eq(s.cards[se].counters.fusion, 0);
  });

  test('BP19-039EN Sephie (evolved): On Evolve choose 1 (Chimera); On Super-Evolve gives Test Subjects Storm', () => {
    let s = T.game({ p0: { field: ['BP19-038EN', 'BP19-048EN', 'BP19-048EN', 'BP19-048EN'], evoDeck: ['BP19-039EN'], turnsPassed: 7, sep: 1 } });
    const [se, vo] = s.players[0].field;
    s = T.act(s, { type: 'evolve', iid: se });
    s = T.answer(s, true); // super-evolve
    eq(s.ask.kind, 'bag');
    s = T.answer(s, s.ask.options.find((o) => o.name === 'On Super-Evolve').id);
    eq(s.ask.max, 2); eq(s.ask.min, 0);
    s = T.answer(s, [vo]);
    ok(SV.chars(s, vo).kw.Storm, 'Storm');
    eq(s.ask.kind, 'modes'); eq(s.ask.max, 1, 'fewer than 10 Condemned followers in the cemetery: choose 1');
    eq(s.ask.options[0].enabled, false, 'no enemy follower: option 1 disabled');
    s = T.answer(s, [1]);
    ok(names(s, s.players[0].field).includes('Chimera Test Subject'));
  });

  test('BP19-041EN Kyrzael: Fanfare summons a Warden of the Trigger; Strike gives other Machina +1/+1', () => {
    let s = T.game({ p0: { hand: ['BP19-041EN'], deck: [AP, 'BP19-044EN', AP] } });
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].field), ['Kyrzael, Killshot Enforcer', 'Warden of the Trigger']);
    let s2 = T.game({ p0: { field: ['BP19-041EN', 'BP19-044EN', AP] } });
    const [k, w, a] = s2.players[0].field;
    s2 = T.attack(s2, k, s2.players[1].leader);
    eq([T.atk(s2, w), T.def(s2, w)], [4, 3]); eq(T.atk(s2, a), 3, 'non-Machina unchanged'); eq(T.atk(s2, k), 4, 'not itself');
  });

  test('BP19-043EN Obsessive Scholar (evolved): [act] engage gives a Test Subject Drain; On Evolve deals 3', () => {
    let s = T.game({ p0: { field: [{ id: 'BP19-P11EN', evo: 'BP19-043EN' }, 'BP19-048EN'] } });
    const [sc, vo] = s.players[0].field;
    s = T.act(s, { type: 'activate', iid: sc, idx: 0 });
    s = T.answer(s, [vo]);
    ok(SV.chars(s, vo).kw.Drain); ok(s.cards[sc].engaged);
    let s2 = T.game({ p0: { field: ['BP19-P11EN'], evoDeck: ['BP19-043EN'] }, p1: { field: [AP] } });
    const t2 = s2.players[1].field[0];
    s2 = T.act(s2, { type: 'evolve', iid: s2.players[0].field[0] });
    s2 = T.answer(s2, [t2]);
    eq(T.zone(s2, t2), 'cemetery');
  });

  test('BP19-044EN Warden of the Trigger: Fanfare may put a Machina top card into the EX area; [act] destroys with a 6-cost Machina', () => {
    let s = T.game({ p0: { hand: ['BP19-044EN'], deck: ['BP19-041EN', AP] } });
    s = T.play(s, hand0(s)[0]);
    eq(s.ask.min, 0);
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].ex), ['Kyrzael, Killshot Enforcer']);
    let s2 = T.game({ p0: { field: ['BP19-044EN', 'BP19-041EN'] }, p1: { field: [AP] } });
    const t = s2.players[1].field[0];
    s2 = T.act(s2, { type: 'activate', iid: s2.players[0].field[0], idx: 0 });
    s2 = T.answer(s2, [t]);
    eq(T.zone(s2, t), 'cemetery');
    const s3 = T.game({ p0: { field: ['BP19-044EN'] }, p1: { field: [AP] } });
    ok(!T.legal(s3, { type: 'activate', iid: s3.players[0].field[0], idx: 0 }), 'no 6-cost Machina');
  });

  test('BP19-046EN Devoted Researcher: Fuse a non-token follower places a fusion counter', () => {
    let s = T.game({ p0: { hand: ['BP19-046EN', AP] } });
    const r = T.find(s, 0, 'BP19-046EN');
    s = T.act(s, { type: 'activate', iid: r, idx: 0 });
    s = T.answer(s, [T.find(s, 0, AP)]);
    eq(T.zone(s, r), 'ex'); eq(s.cards[r].counters.fusion, 1);
    s = T.play(s, r);
    s = T.answer(s, true);
    ok(names(s, s.players[0].field).includes('Chimera Test Subject'));
  });

  test('BP19-047EN Devoted Researcher (evolved): On Evolve tutors a Volunteer to the EX area; [act] buries it for damage equal to its attack', () => {
    let s = T.game({ p0: { field: ['BP19-046EN'], evoDeck: ['BP19-047EN'], deck: [AP, 'BP19-048EN', AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].ex), ['Volunteer Test Subject']);
    let s2 = T.game({ p0: { field: [{ id: 'BP19-046EN', evo: 'BP19-047EN' }, { id: 'BP19-048EN', mods: [{ atk: 1 }] }] }, p1: { field: [GEN] } });
    const [r, vo] = s2.players[0].field;
    const t = s2.players[1].field[0];
    s2 = T.act(s2, { type: 'activate', iid: r, idx: 0 });
    s2 = T.answer(s2, [vo]);
    s2 = T.answer(s2, [t]);
    eq(T.def(s2, t), 9, 'damage = its attack (2+1)'); eq(T.zone(s2, vo), 'cemetery');
  });

  test('BP19-048EN Volunteer Test Subject: Fanfare with 5 Condemned followers in the cemetery; Last Words draws; fused by a Condemned follower draws then discards', () => {
    let s = T.game({ p0: { hand: ['BP19-048EN'], cemetery: Array(5).fill('BP19-048EN') } });
    const v = hand0(s)[0];
    s = T.play(s, v);
    eq([T.atk(s, v), T.def(s, v)], [4, 4]); ok(SV.chars(s, v).kw.Rush); ok(!SV.chars(s, v).kw.Bane);
    let s2 = T.game({ p0: { hand: ['BP19-046EN', 'BP19-048EN', AP] } });
    s2 = T.act(s2, { type: 'activate', iid: T.find(s2, 0, 'BP19-046EN'), idx: 0 });
    s2 = T.answer(s2, [T.find(s2, 0, 'BP19-048EN')]);
    eq(s2.ask.kind, 'cards'); eq(s2.ask.min, 1);
    s2 = T.answer(s2, [T.find(s2, 0, AP, 'hand')]);
    eq(hand0(s2).length, 1); eq(s2.players[0].cemetery.length, 2);
    let s3 = T.game({ p0: { field: ['BP19-048EN'] }, p1: { field: [{ id: GEN, engaged: true }] } });
    s3 = T.attack(s3, s3.players[0].field[0], s3.players[1].field[0]);
    eq(hand0(s3).length, 1, 'Last Words: draw');
  });

  test('BP19-P11EN Obsessive Scholar: Fuse places a fusion counter; Fanfare may remove it for a Chimera', () => {
    let s = T.game({ p0: { hand: ['BP19-P11EN', AP] } });
    const o = T.find(s, 0, 'BP19-P11EN');
    s = T.act(s, { type: 'activate', iid: o, idx: 0 });
    s = T.answer(s, [T.find(s, 0, AP)]);
    eq(s.cards[o].counters.fusion, 1);
    s = T.play(s, o);
    s = T.answer(s, false);
    eq(s.players[0].field.length, 1, 'declined'); eq(s.cards[o].counters.fusion, 1);
  });

  test('BP19-T02EN Chimera Test Subject: with 10 Condemned followers in the cemetery it gets +2/+2, Rush, Assail and Bane', () => {
    let s = T.game({ p0: { hand: ['BP19-P11EN', AP], cemetery: Array(10).fill('BP19-048EN') } });
    const o = T.find(s, 0, 'BP19-P11EN');
    s = T.act(s, { type: 'activate', iid: o, idx: 0 });
    s = T.answer(s, [T.find(s, 0, AP)]);
    s = T.play(s, o);
    s = T.answer(s, true);
    const c = s.players[0].field.find((i) => SV.def(i, s).name === 'Chimera Test Subject');
    const r = SV.chars(s, c);
    eq([r.atk, r.def], [4, 4]); ok(r.kw.Rush && r.kw.Assail && r.kw.Bane);
  });
})();
