// Neutral card behaviour tests (see tests/cards-abysscraft.js for the conventions).
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok } = SV.T;
  const T = SV.T;
  const AP = T.FILLER;            // Apostle of Unkilling 3/3/3
  const GD = 'BP01-080EN';        // Genesis Dragon 9: 10/12
  const SUKUNA = 'BP04-010EN';    // forestcraft follower, cost 1
  const BELL = 'BP01-159EN';      // Bellringer Angel: neutral Angel follower, cost 1
  const OLIVIA = 'BP16-113EN';    // Fallen Angel follower
  const CUT = 'BP19-110EN';       // Cutthroat, Discord Convict
  const WASTE = 'BP11-018EN';     // Nahtnaught: a Wasteland follower 3/5
  const names = (s, list) => list.map((i) => SV.CARDS[s.cards[i].id].name);
  const bagPick = (s, name, nth = 0) => T.answer(s, s.ask.options.filter((o) => o.name === name)[nth].id);
  // p1's follower attacks p0's (engaged) follower; returns the state after the attack.
  const killedBy = (field0) => {
    let s = T.game({ active: 1, p0: { field: [field0] }, p1: { field: [GD] } });
    return T.attack(s, s.players[1].field[0], s.players[0].field[0]);
  };

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

  test('BP01-159EN Bellringer Angel: Last Words draws a card', () => {
    const s = killedBy({ id: BELL, engaged: true });
    eq(T.zone(s, T.find(s, 0, BELL)), 'cemetery'); eq(s.players[0].hand.length, 1);
  });

  test('BP01-160EN Bellringer Angel (evolved): On Evolve deals 2 to an enemy follower; Last Words draws exactly one card', () => {
    let s = T.game({ p0: { field: [BELL], evoDeck: ['BP01-160EN'] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.kind, 'cards');
    s = T.answer(s, [t]);
    eq(T.def(s, t), 1);
    const s2 = killedBy({ id: BELL, evo: 'BP01-160EN', engaged: true });
    eq(s2.players[0].hand.length, 1);
  });

  test('BP03-117EN Winged Inversion: (1) discard an Angel follower to destroy an enemy follower', () => {
    let s = T.game({ p0: { hand: ['BP03-117EN', BELL] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.play(s, T.find(s, 0, 'BP03-117EN'));
    eq(s.ask.kind, 'modes');
    s = T.answer(s, [0]);
    s = T.answer(s, [T.find(s, 0, BELL)]);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'cemetery'); eq(T.zone(s, T.find(s, 0, BELL)), 'cemetery');
  });

  test('BP03-117EN Winged Inversion: (2) discard a Fallen Angel follower for +3 defense and a card; declining does nothing (Q532)', () => {
    let s = T.game({ p0: { hand: ['BP03-117EN', OLIVIA] } });
    s = T.play(s, T.find(s, 0, 'BP03-117EN'));
    eq(s.ask.options[0].enabled, false, 'no enemy follower: option 1 cannot be chosen');
    s = T.answer(s, [1]);
    let s2 = T.answer(s, []);
    eq(s2.players[0].defense, 20); eq(s2.players[0].hand.length, 1);
    s = T.answer(s, [T.find(s, 0, OLIVIA)]);
    eq(s.players[0].defense, 23); eq(s.players[0].hand.length, 1);
  });

  test('BP04-124EN Goblin Princess: searches only a neutral 1-cost follower and puts it onto the field', () => {
    let s = T.game({ p0: { hand: ['BP04-124EN'], deck: [SUKUNA, BELL, AP, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.ask.from), ['Bellringer Angel']);
    s = T.answer(s, s.ask.from);
    eq(T.zone(s, T.find(s, 0, BELL)), 'field'); eq(s.players[0].deck.length, 3);
  });

  test('BP05-103EN Mjerrabaine, Omen of One: empty hand at the end phase hits the leader and each enemy follower', () => {
    let s = T.game({ p0: { field: ['BP05-103EN'] }, p1: { field: [AP, AP] } });
    s = T.endTurn(s);
    eq(s.players[1].defense, 17); eq(s.players[1].field.length, 0);
  });

  test('BP05-103EN Mjerrabaine, Omen of One: with 2 cards in hand only the leader takes 3', () => {
    let s = T.game({ p0: { field: ['BP05-103EN'], hand: [AP, AP] }, p1: { field: [AP] } });
    s = T.endTurn(s);
    eq(s.players[1].defense, 17); eq(s.players[1].field.length, 1);
  });

  test('BP09-126EN Paradise Vanguard: banishes an enemy follower with 5 Angels in the cemetery, not with 4', () => {
    let s = T.game({ p0: { hand: ['BP09-126EN'], cemetery: Array(5).fill(BELL) }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'banished');
    let s2 = T.game({ p0: { hand: ['BP09-126EN'], cemetery: Array(4).fill(BELL) }, p1: { field: [AP] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    ok(!s2.ask); eq(s2.players[1].field.length, 1);
  });

  test('BP09-127EN Paradise Vanguard (evolved): On Evolve banishes an enemy follower that costs 4 or less', () => {
    let s = T.game({ p0: { field: ['BP09-126EN'], evoDeck: ['BP09-127EN'] }, p1: { field: [AP, GD] } });
    const [ap, gd] = s.players[1].field;
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.from, [ap]);
    s = T.answer(s, [ap]);
    eq(T.zone(s, ap), 'banished'); eq(T.zone(s, gd), 'field');
  });

  test('BP09-137EN Fount of Angels: Fanfare takes an Angel from the top 3; the activated ability needs 2 Angel/Fallen Angel followers', () => {
    let s = T.game({ p0: { hand: ['BP09-137EN'], deck: [AP, BELL, AP, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.seen.length, 3); eq(s.ask.from.length, 1);
    s = T.answer(s, s.ask.from);
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ['Bellringer Angel']);
    let a = T.game({ p0: { field: ['BP09-137EN', BELL] } });
    ok(!T.legal(a, { type: 'activate', iid: a.players[0].field[0], idx: 0 }), 'one Angel follower is not enough');
    a = T.game({ p0: { field: ['BP09-137EN', BELL, OLIVIA] } });
    const f = a.players[0].field[0];
    a = T.act(a, { type: 'activate', iid: f, idx: 0 });
    eq(a.players[0].defense, 21); eq(T.zone(a, f), 'cemetery');
  });

  test('BP10-109EN XXI. Zelgenea, The World: alone on the field it destroys and draws; low defense gets +5', () => {
    let s = T.game({ p0: { hand: ['BP10-109EN'], defense: 8 }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.kind, 'bag');
    s = T.answer(s, s.ask.options[0].id);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'cemetery'); eq(s.players[0].hand.length, 1); eq(s.players[0].defense, 13);
  });

  test('BP10-109EN XXI. Zelgenea, The World: with another follower of yours nothing is destroyed', () => {
    let s = T.game({ p0: { hand: ['BP10-109EN'], field: [AP] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, s.ask.options[0].id);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'field'); eq(s.players[0].hand.length, 0); eq(s.players[0].defense, 20);
  });

  test('BP10-109EN XXI. Zelgenea, The World: from the cemetery, pay 10 and banish it to put O Great World into the EX area', () => {
    let s = T.game({ p0: { cemetery: ['BP10-109EN'], evoDeck: ['BP10-110EN'] } });
    const z = s.players[0].cemetery[0];
    s = T.act(s, { type: 'activate', iid: z, idx: 0 });
    eq(s.ask.min, 0);
    s = T.answer(s, s.ask.from);
    eq(T.zone(s, z), 'banished'); eq(names(s, s.players[0].ex), ['XXI. Zelgenea, O Great World']); eq(s.players[0].pp, 0);
  });

  test('BP10-110EN XXI. Zelgenea, O Great World: 4 to each enemy at your end phase from the EX area; Fanfare deals 10 to each enemy', () => {
    let s = T.game({ p0: { ex: ['BP10-110EN'] }, p1: { field: [AP] } });
    s = T.endTurn(s);
    eq(s.players[1].defense, 16); eq(s.players[1].field.length, 0);
    let s2 = T.game({ p0: { ex: ['BP10-110EN'] }, p1: { field: [GD] } });
    s2 = T.play(s2, s2.players[0].ex[0]);
    eq(s2.players[1].defense, 10); eq(T.def(s2, s2.players[1].field[0]), 2);
  });

  test('BP10-114EN Fallen Shot: needs both targets; puts the Angel and the enemy follower into their EX areas', () => {
    const n = T.game({ p0: { hand: ['BP10-114EN'] }, p1: { field: [AP] } });
    ok(!T.legal(n, { type: 'play', iid: n.players[0].hand[0] }));
    let s = T.game({ p0: { hand: ['BP10-114EN'], cemetery: [BELL] }, p1: { field: [AP] } });
    const t = s.players[1].field[0], a = s.players[0].cemetery[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [a]);
    s = T.answer(s, [t]);
    eq(T.zone(s, a), 'ex'); eq(T.zone(s, t), 'ex'); eq(s.players[1].ex, [t]);
  });

  test('BP11-T04EN Bullet Bike: bury it to give a Wasteland follower Rush and +1 attack', () => {
    let s = T.game({ p0: { field: ['BP11-T04EN', WASTE] } });
    const [bike, w] = s.players[0].field;
    s = T.act(s, { type: 'activate', iid: bike, idx: 0 });
    s = T.answer(s, [w]);
    ok(SV.chars(s, w).kw.Rush); eq(T.atk(s, w), 4); eq(T.zone(s, bike), 'gone');
  });

  test('BP12-106EN Seraphic Blade: (1) destroys an enemy card costing 2 or less; (2) pays 2 more for one costing 6 or less', () => {
    let s = T.game({ p0: { hand: ['BP12-106EN'] }, p1: { field: [AP, SUKUNA] } });
    const [ap, suk] = s.players[1].field;
    let s1 = T.play(s, s.players[0].hand[0]);
    s1 = T.answer(s1, [0]);
    eq(s1.ask.from, [suk]);
    s1 = T.answer(s1, [suk]);
    eq(T.zone(s1, suk), 'cemetery'); eq(s1.players[0].pp, 8);
    let s2 = T.play(s, s.players[0].hand[0]);
    s2 = T.answer(s2, [1]);
    s2 = T.answer(s2, [ap]);
    eq(T.zone(s2, ap), 'cemetery'); eq(s2.players[0].pp, 6);
    const n = T.game({ p0: { hand: ['BP12-106EN'], pp: 3 }, p1: { field: [AP] } });
    ok(!T.legal(n, { type: 'play', iid: n.players[0].hand[0] }), 'mode 2 needs 4 play points in all');
  });

  test('BP12-T11EN Repair Mode: gives your leader +1 defense', () => {
    let s = T.game({ p0: { ex: ['BP12-T11EN'] } });
    s = T.play(s, s.players[0].ex[0]);
    eq(s.players[0].defense, 21);
  });

  test('BP12-T12EN Naterran Great Tree: [cost01] bury it; leaving the field draws then discards', () => {
    let s = T.game({ p0: { field: ['BP12-T12EN'], hand: [AP] } });
    const tree = s.players[0].field[0];
    s = T.act(s, { type: 'activate', iid: tree, idx: 0 });
    eq(s.ask.kind, 'cards'); eq(s.ask.from.length, 2, 'drew first');
    s = T.answer(s, [s.ask.from[0]]);
    eq(s.players[0].hand.length, 1); eq(s.players[0].cemetery.length, 1); eq(s.players[0].pp, 9);
  });

  test('BP13-107EN Planetary Fracture: banishes every field and EX card and the top 10 of each deck', () => {
    let s = T.game({ p0: { hand: ['BP13-107EN'], field: [AP], ex: [AP] }, p1: { field: [AP, { id: BELL, evo: 'BP01-160EN' }], ex: [AP, 'BP20-T18EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    for (const p of [0, 1]) { eq(s.players[p].field.length, 0); eq(s.players[p].ex.length, 0); eq(s.players[p].deck.length, 5); }
    eq(s.players[0].banished.length, 12); eq(s.players[1].banished.length, 13, 'the token is eliminated');
    eq(s.players[1].evoDeck.length, 1, 'the evolved card returns to the evolve deck');
  });

  test('BP14-108EN Glistering Angel: +2 defense with 5 Angels in the cemetery', () => {
    let s = T.game({ p0: { hand: ['BP14-108EN'], cemetery: Array(5).fill(BELL) } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].defense, 22);
    let s2 = T.game({ p0: { hand: ['BP14-108EN'], cemetery: Array(4).fill(BELL) } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.players[0].defense, 20);
  });

  test('BP14-109EN Glistering Angel (evolved): On Evolve takes a Fallen Angel from the top 4', () => {
    let s = T.game({ p0: { field: ['BP14-108EN'], evoDeck: ['BP14-109EN'], deck: [AP, AP, OLIVIA, AP, AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.seen.length, 4); eq(s.ask.from.length, 1);
    s = T.answer(s, s.ask.from);
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ['Olivia, Heroic Dark Angel']);
  });

  test("BP14-110EN Angel's Blessing: +2 defense and 2 cards", () => {
    let s = T.game({ p0: { hand: ['BP14-110EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].defense, 22); eq(s.players[0].hand.length, 2);
  });

  test('BP15-112EN Mjerrabaine, Great One: banish an Omen of One from the cemetery for 2 to the enemy leader and 2 cards, once per turn', () => {
    let s = T.game({ p0: { field: ['BP15-112EN'], cemetery: ['BP05-103EN', 'BP05-103EN'] } });
    const m = s.players[0].field[0];
    s = T.act(s, { type: 'activate', iid: m, idx: 0 });
    s = T.answer(s, [s.ask.from[0]]);
    eq(s.players[1].defense, 18); eq(s.players[0].hand.length, 2); eq(s.players[0].banished.length, 1);
    ok(!T.legal(s, { type: 'activate', iid: m, idx: 0 }), 'once per turn');
  });

  test('BP15-112EN Mjerrabaine, Great One: Fanfare may discard 3 cards for a Great Testimony token', () => {
    let s = T.game({ p0: { hand: ['BP15-112EN', AP, AP, GD, SUKUNA] } });
    s = T.play(s, T.find(s, 0, 'BP15-112EN'));
    eq(s.ask.kind, 'yesno');
    const no = T.answer(s, false);
    eq(no.players[0].hand.length, 4); eq(no.players[0].ex.length, 0);
    s = T.answer(s, true);
    eq(s.ask.min, 3);
    s = T.answer(s, s.ask.from.slice(0, 3));
    eq(s.players[0].hand.length, 1); eq(s.players[0].cemetery.length, 3); eq(names(s, s.players[0].ex), ['Great Testimony']);
    let s2 = T.game({ p0: { hand: ['BP15-112EN', AP, AP] } });
    s2 = T.play(s2, T.find(s2, 0, 'BP15-112EN'));
    ok(!s2.ask, 'fewer than 3 cards: not asked');
  });

  test('BP15-PR17EN Great Testimony: destroys an enemy follower; 2 to its leader only with a Mjerrabaine, Great One on your field', () => {
    const n = T.game({ p0: { ex: ['BP15-PR17EN'] } });
    ok(!T.legal(n, { type: 'play', iid: n.players[0].ex[0] }), 'needs a target');
    let s = T.game({ p0: { ex: ['BP15-PR17EN'], field: ['BP15-112EN'] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].ex[0]);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'cemetery'); eq(s.players[1].defense, 18);
    let s2 = T.game({ p0: { ex: ['BP15-PR17EN'] }, p1: { field: [AP] } });
    s2 = T.play(s2, s2.players[0].ex[0]);
    s2 = T.answer(s2, [s2.players[1].field[0]]);
    eq(s2.players[1].cemetery.length, 1); eq(s2.players[1].defense, 20);
  });

  test('BP15-113EN Gilnelise, Ravenous Craving: Drain only while your leader has 10 defense or less', () => {
    const s = T.game({ p0: { field: ['BP15-113EN'], defense: 10 } });
    ok(SV.chars(s, s.players[0].field[0]).kw.Drain);
    const s2 = T.game({ p0: { field: ['BP15-113EN'], defense: 11 } });
    ok(!SV.chars(s2, s2.players[0].field[0]).kw.Drain);
  });

  test('BP15-114EN Gilnelise, Ravenous Craving (evolved): On Evolve +2/-2 to another follower or a Ravenous Sweetness; Drain at 10 or less', () => {
    let s = T.game({ p0: { field: ['BP15-113EN'], evoDeck: ['BP15-114EN'], defense: 9 }, p1: { field: [AP] } });
    const g = s.players[0].field[0], t = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: g });
    let s2 = T.answer(s, [1]);
    eq(names(s2, s2.players[0].ex), ['Ravenous Sweetness']);
    s = T.answer(s, [0]);
    s = T.answer(s, [t]);
    eq([T.atk(s, t), T.def(s, t)], [5, 1]);
    ok(SV.chars(s, g).kw.Drain);
  });

  test('BP16-113EN Olivia, Heroic Dark Angel: Fanfare draws a card', () => {
    let s = T.game({ p0: { hand: [OLIVIA] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].hand.length, 1);
  });

  test('BP16-114EN Olivia, Heroic Dark Angel (evolved): super-evolve deals 5, gives +3 defense and recovers 3', () => {
    let s = T.game({ p0: { field: [OLIVIA], evoDeck: ['BP16-114EN'], turnsPassed: 7, pp: 5 }, p1: { field: [GD] } });
    const t = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, true); // super-evolve
    s = bagPick(s, 'On Evolve');
    s = T.answer(s, [t]);
    eq(T.def(s, t), 7); eq(s.players[0].defense, 23); eq(s.players[0].pp, 7);
  });

  test('BP16-119EN Leah, Bellringer Angel: Last Words gives +1 defense and draws', () => {
    const s = killedBy({ id: 'BP16-119EN', engaged: true });
    eq(s.players[0].defense, 21); eq(s.players[0].hand.length, 1);
  });

  test('BP16-T22EN Arcane Personnel Carrier: bury it to give a Wasteland follower Ward and +1 defense', () => {
    let s = T.game({ p0: { field: ['BP16-T22EN', WASTE, AP] } });
    const [apc, w, ap] = s.players[0].field;
    s = T.act(s, { type: 'activate', iid: apc, idx: 0 });
    eq(s.ask.from.length, 2);
    let s2 = T.answer(s, [ap]);
    ok(SV.chars(s2, ap).kw.Ward); eq(T.def(s2, ap), 3, 'not Wasteland: no +1');
    s = T.answer(s, [w]);
    ok(SV.chars(s, w).kw.Ward); eq(T.def(s, w), 6);
  });

  test("BP17-111EN Maisha, Purgation's Vessel (evolved): draws on evolve, Storm and 8 damage with 10 followers in the cemetery", () => {
    let s = T.game({ p0: { field: ['BP17-110EN'], evoDeck: ['BP17-111EN'], cemetery: Array(10).fill(AP) }, p1: { field: [GD] } });
    const m = s.players[0].field[0], t = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: m });
    eq(s.players[0].hand.length, 1); ok(SV.chars(s, m).kw.Storm);
    s = T.act(s, { type: 'activate', iid: m, idx: 0 });
    s = T.answer(s, [t]);
    eq(T.def(s, t), 4);
    ok(!T.legal(s, { type: 'activate', iid: m, idx: 0 }), 'once per turn');
    const s9 = T.game({ p0: { field: [{ id: 'BP17-110EN', evo: 'BP17-111EN' }], cemetery: Array(9).fill(AP) } });
    ok(!SV.chars(s9, s9.players[0].field[0]).kw.Storm);
  });

  test('BP18-117EN Saito, Mao Ward Officer: Fanfare takes a Togh Keyoh card from the top 3', () => {
    let s = T.game({ p0: { hand: ['BP18-117EN'], deck: [AP, 'BP18-120EN', AP, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.from.length, 1);
    s = T.answer(s, s.ask.from);
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ['Togh Keyoh, Neometropolis']);
  });

  test('BP18-118EN Saito, Mao Ward Officer (evolved): (2) +1 defense and bury the top card; (3) banish a hand card to draw', () => {
    let s = T.game({ p0: { field: ['BP18-117EN'], evoDeck: ['BP18-118EN'], hand: [GD] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.options[0].enabled, false, 'no A-Class Pyromancy in the cemetery');
    let s2 = T.answer(s, [1]);
    eq(s2.players[0].defense, 21); eq(s2.players[0].cemetery.length, 1); eq(s2.players[0].deck.length, 14);
    s = T.answer(s, [2]);
    s = T.answer(s, [T.find(s, 0, GD)]);
    eq(T.zone(s, T.find(s, 0, GD)), 'banished'); eq(s.players[0].hand.length, 1);
  });

  test('BP18-120EN Togh Keyoh, Neometropolis: Fanfare skips other Neometropolis; act gives a Togh Keyoh follower +1/+1 and the leader +1', () => {
    let s = T.game({ p0: { hand: ['BP18-120EN'], deck: ['BP18-120EN', 'BP18-117EN', AP, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.ask.from), ['Saito, Mao Ward Officer']);
    let a = T.game({ p0: { field: ['BP18-120EN', 'BP18-117EN'] } });
    const [neo, saito] = a.players[0].field;
    a = T.act(a, { type: 'activate', iid: neo, idx: 0 });
    a = T.answer(a, [saito]);
    eq([T.atk(a, saito), T.def(a, saito)], [3, 3]); eq(a.players[0].defense, 21); eq(T.zone(a, neo), 'banished'); eq(a.players[0].pp, 9);
  });

  test('BP19-110EN Cutthroat, Discord Convict: Fanfare adds one of the top 8 and puts the other 7 on the bottom', () => {
    let s = T.game({ p0: { hand: [CUT], deck: [...Array(8).fill(AP), GD, SUKUNA] } });
    const [nine, ten] = s.players[0].deck.slice(8);
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.from.length, 8); eq(s.ask.min, 1);
    s = T.answer(s, [s.ask.from[3]]);
    eq(s.players[0].hand.length, 1); eq(s.players[0].deck.length, 9); eq(s.players[0].deck.slice(0, 2), [nine, ten]);
  });

  test('BP19-111EN Cutthroat, Discord Convict (evolved): On Evolve divides 4 damage between 2 enemy followers', () => {
    let s = T.game({ p0: { field: [CUT], evoDeck: ['BP19-111EN'] }, p1: { field: [AP, AP] } });
    const [a, b] = s.players[1].field;
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [a, b]);
    eq(s.ask.kind, 'number'); eq([s.ask.min, s.ask.max], [1, 3]);
    s = T.answer(s, 1);
    eq(T.def(s, a), 2); eq(T.zone(s, b), 'cemetery');
  });

  test('BP19-111EN Cutthroat, Discord Convict (evolved): On Super-Evolve deals 8 to a follower and its leader', () => {
    let s = T.game({ p0: { field: [CUT], evoDeck: ['BP19-111EN'], turnsPassed: 7 }, p1: { field: [GD] } });
    const t = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, true);
    s = bagPick(s, 'On Super-Evolve');
    s = T.answer(s, [t]);
    eq(T.def(s, t), 4); eq(s.players[1].defense, 12);
  });

  test('BP19-112EN Eudie, Maiden Reborn: draws; with 0 super-evolution points +2/+2 and +2 defense', () => {
    let s = T.game({ p0: { hand: ['BP19-112EN'], sep: 0 } });
    const e = s.players[0].hand[0];
    s = T.play(s, e);
    eq(s.players[0].hand.length, 1); eq([T.atk(s, e), T.def(s, e)], [4, 5]); eq(s.players[0].defense, 22);
    let s2 = T.game({ p0: { hand: ['BP19-112EN'] } });
    const e2 = s2.players[0].hand[0];
    s2 = T.play(s2, e2);
    eq([T.atk(s2, e2), T.def(s2, e2)], [2, 3]); eq(s2.players[0].defense, 20);
  });

  const NINE = [AP, SUKUNA, 'BP13-091EN', 'BP16-081EN', 'BP17-110EN', 'BP19-001EN', 'BP20-040EN', 'BP20-074EN', 'BP20-076EN'];
  test('BP19-113EN Zerael, Regent of Rebirth: 9 different names buries it and may summon Transmigration', () => {
    let s = T.game({ p0: { hand: ['BP19-113EN'], deck: NINE, evoDeck: ['BP19-114EN'] }, p1: { field: [AP] } });
    const z = s.players[0].hand[0];
    s = T.play(s, z);
    eq(s.ask.min, 0);
    s = T.answer(s, s.ask.from);
    eq(T.zone(s, z), 'cemetery'); eq(names(s, s.players[0].field), ['Zerael, Regent of Transmigration']);
    eq(s.players[1].field.length, 0, "Transmigration's Fanfare"); eq(s.players[0].deck.length, 9);
  });

  test('BP19-113EN Zerael, Regent of Rebirth: repeated names keep it on the field', () => {
    let s = T.game({ p0: { hand: ['BP19-113EN'], evoDeck: ['BP19-114EN'] } });
    const z = s.players[0].hand[0];
    s = T.play(s, z);
    ok(!s.ask); eq(T.zone(s, z), 'field'); eq(s.players[0].deck.length, 15);
  });

  test('BP19-114EN Zerael, Regent of Transmigration: Fanfare destroys each enemy follower', () => {
    let s = T.game({ p0: { ex: ['BP19-114EN'] }, p1: { field: [AP, GD] } });
    s = T.play(s, s.players[0].ex[0]);
    eq(s.players[1].field.length, 0); eq(s.players[1].cemetery.length, 2);
  });

  test('BP19-115EN Ironforged Right Hand: draws; recovers 2 only with a Cutthroat follower on the field or in the cemetery', () => {
    let s = T.game({ p0: { hand: ['BP19-115EN'], cemetery: [CUT], pp: 5 } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].hand.length, 1); eq(s.players[0].pp, 5);
    let s2 = T.game({ p0: { hand: ['BP19-115EN'], pp: 5 } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.players[0].pp, 3);
  });

  test('BP19-116EN Azvaldt: Fanfare takes a Condemned follower; the act draws only from your 8th turn', () => {
    let s = T.game({ p0: { hand: ['BP19-116EN'], deck: ['BP19-001EN', AP, AP, AP, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.ask.from), ['Magachiyo, Barbed Convict']);
    let a = T.game({ p0: { field: ['BP19-116EN'], turnsPassed: 8 } });
    const az = a.players[0].field[0];
    a = T.act(a, { type: 'activate', iid: az, idx: 0 });
    eq(a.players[0].hand.length, 1); eq(T.zone(a, az), 'cemetery');
    let b = T.game({ p0: { field: ['BP19-116EN'], turnsPassed: 7 } });
    b = T.act(b, { type: 'activate', iid: b.players[0].field[0], idx: 0 });
    eq(b.players[0].hand.length, 0); eq(b.players[0].cemetery.length, 1, 'Q2393: usable before turn 8');
  });

  test('BP19-117EN Smeltwork Bodyguard: Fanfare draws a card', () => {
    let s = T.game({ p0: { hand: ['BP19-117EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].hand.length, 1);
  });

  test('BP19-118EN Smeltwork Bodyguard (evolved): with a Cutthroat, 4 damage and +4 defense; without, nothing', () => {
    let s = T.game({ p0: { field: ['BP19-117EN'], evoDeck: ['BP19-118EN'], cemetery: [CUT] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'cemetery'); eq(s.players[0].defense, 24);
    let s2 = T.game({ p0: { field: ['BP19-117EN'], evoDeck: ['BP19-118EN'] }, p1: { field: [AP] } });
    s2 = T.act(s2, { type: 'evolve', iid: s2.players[0].field[0] });
    s2 = T.answer(s2, [s2.players[1].field[0]]);
    eq(T.def(s2, s2.players[1].field[0]), 3); eq(s2.players[0].defense, 20);
  });

  test('BP19-119EN Warden of Recurrence: (1) summons a Zerael, Regent of Rebirth from the deck; (2) recovers 8', () => {
    let s = T.game({ p0: { hand: ['BP19-119EN'], deck: [AP, 'BP19-113EN', AP] } });
    s = T.play(s, s.players[0].hand[0]);
    let s2 = T.answer(s, [1]);
    eq(s2.players[0].pp, 10);
    s = T.answer(s, [0]);
    s = T.answer(s, s.ask.from);
    ok(names(s, s.players[0].field).includes('Zerael, Regent of Rebirth'));
  });

  test('BP19-120EN Blackrust Underling: Strike deals 4 to an enemy follower with a Cutthroat around', () => {
    let s = T.game({ p0: { field: ['BP19-120EN', CUT] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.act(s, { type: 'attack', iid: s.players[0].field[0], target: s.players[1].leader });
    s = T.answer(s, [t]);
    while (s.window) s = T.pass(s);
    eq(T.zone(s, t), 'cemetery'); eq(s.players[1].defense, 17);
  });

  test('BP20-111EN Mjerrabaine, Great Manifest: Fanfare discards your hand', () => {
    let s = T.game({ p0: { hand: ['BP20-111EN', AP, GD] } });
    s = T.play(s, T.find(s, 0, 'BP20-111EN'));
    eq(s.players[0].hand.length, 0); eq(s.players[0].cemetery.length, 2);
  });

  test('BP20-112EN Mjerrabaine, Great Manifest (evolved): crest on evolve; super-evolve destroys and hits the leader for 2', () => {
    let s = T.game({ p0: { field: ['BP20-111EN'], evoDeck: ['BP20-112EN'], turnsPassed: 7 }, p1: { field: [GD] } });
    const t = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, true);
    s = bagPick(s, 'On Super-Evolve');
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'cemetery'); eq(s.players[1].defense, 18);
    eq(names(s, s.players[0].ex), ['Crest: Mjerrabaine, Great Manifest']);
  });

  test('BP20-112EN Mjerrabaine, Great Manifest (evolved): end phase destroys the selected follower only with 1 card or less in hand', () => {
    let s = T.game({ p0: { field: [{ id: 'BP20-111EN', evo: 'BP20-112EN' }], hand: [AP] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.act(s, { type: 'end' });
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'cemetery');
    let s2 = T.game({ p0: { field: [{ id: 'BP20-111EN', evo: 'BP20-112EN' }], hand: [AP, AP] }, p1: { field: [AP] } });
    s2 = T.act(s2, { type: 'end' });
    s2 = T.answer(s2, [s2.players[1].field[0]]);
    eq(T.zone(s2, s2.players[1].field[0]), 'field');
  });

  test('BP20-113EN Gilnelise, Voracity Manifest: +3/-3, a Ravenous Sweetness at 0 SEP, and 5 damage when you play it', () => {
    let s = T.game({ p0: { hand: ['BP20-113EN'], field: [GD], sep: 0 }, p1: { field: [GD], hand: [AP, AP, AP] } });
    const mine = s.players[0].field[0], t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [mine]);
    eq([T.atk(s, mine), T.def(s, mine)], [13, 9]);
    const rs = s.players[0].ex[0];
    eq(names(s, [rs]), ['Ravenous Sweetness']);
    s = T.play(s, rs);
    s = T.answer(s, [t]);
    eq(T.def(s, t), 7);
  });

  test('BP20-T11EN Crest: Mjerrabaine, Great Manifest: draws at your end phase with 1 card or less in hand', () => {
    let s = T.game({ p0: { ex: ['BP20-T11EN'], hand: [AP] } });
    s = T.endTurn(s);
    eq(s.players[0].hand.length, 2);
    let s2 = T.game({ p0: { ex: ['BP20-T11EN'], hand: [AP, AP] } });
    s2 = T.endTurn(s2);
    eq(s2.players[0].hand.length, 2);
  });

  test('BP20-T18EN Ravenous Sweetness: 2 to the enemy leader, +2 defense, draw 2, the opponent discards 2 at random', () => {
    let s = T.game({ p0: { ex: ['BP20-T18EN'] }, p1: { hand: [AP, GD, SUKUNA] } });
    s = T.play(s, s.players[0].ex[0]);
    eq(s.players[1].defense, 18); eq(s.players[0].defense, 22); eq(s.players[0].hand.length, 2);
    eq(s.players[1].hand.length, 1); eq(s.players[1].cemetery.length, 2);
  });

  test('SP01-045EN Alice, Golden Afternoon: draws; from the EX area it puts a 4-cost-or-less enemy follower into its EX area, from hand not', () => {
    let s = T.game({ p0: { hand: ['SP01-045EN'] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, s.ask.options[1].id);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'field'); eq(s.players[0].hand.length, 1);
    let e = T.game({ p0: { ex: ['SP01-045EN'] }, p1: { field: [AP, GD] } });
    const [ap, gd] = e.players[1].field;
    e = T.play(e, e.players[0].ex[0]);
    e = T.answer(e, e.ask.options[1].id);
    eq(e.ask.from, [ap]);
    e = T.answer(e, [ap]);
    eq(T.zone(e, ap), 'ex'); eq(e.players[0].hand.length, 1);
  });
})();
