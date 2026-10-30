// Dragoncraft card behaviour tests (see tests/cards-abysscraft.js for the conventions).
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok } = SV.T;
  const T = SV.T;
  const AP = T.FILLER;          // Apostle of Unkilling 3/3/3 (Omen/Hunter)
  const GEN = 'BP01-080EN';     // Genesis Dragon 10/12
  const DDF = T.STORM;          // Dark Dragoon Forte, cost 4
  const DISCIPLE = 'BP05-059EN'; // Omen/Wyrmkin follower, cost 1
  const THIEF = 'BP19-066EN';   // Razor-Clawed Thief, Condemned, cost 1
  const names = (s, list) => list.map((i) => SV.CARDS[s.cards[i].id].name);
  const bagFirst = (s) => { while (s.ask && s.ask.kind === 'bag') s = T.answer(s, s.ask.options[0].id); return s; };
  const hand0 = (s, id) => T.find(s, 0, id, 'hand');

  test('BP01-089EN Conflagration: 5 damage to each follower on both fields', () => {
    let s = T.game({ p0: { hand: ['BP01-089EN'], field: [AP] }, p1: { field: [AP, GEN] } });
    const [a] = s.players[0].field, [b, g] = s.players[1].field;
    s = T.play(s, s.players[0].hand[0]);
    eq([T.zone(s, a), T.zone(s, b)], ['cemetery', 'cemetery']); eq(T.def(s, g), 7);
  });

  test('BP01-098EN Blazing Breath: 2 damage, 4 with Overflow; needs an enemy follower', () => {
    let s = T.game({ p0: { hand: ['BP01-098EN'], maxPP: 6 }, p1: { field: [GEN] } });
    const g = s.players[1].field[0];
    let s2 = T.answer(T.play(s, s.players[0].hand[0]), [g]);
    eq(T.def(s2, g), 10);
    s = T.game({ p0: { hand: ['BP01-098EN'], maxPP: 7 }, p1: { field: [GEN] } });
    s2 = T.answer(T.play(s, s.players[0].hand[0]), [s.players[1].field[0]]);
    eq(T.def(s2, s.players[1].field[0]), 8);
    s = T.game({ p0: { hand: ['BP01-098EN'] } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].hand[0] }));
  });

  test('BP03-055EN Jabberwock: bury a 3-cost follower, reveal until a follower costing more and summon it', () => {
    let s = T.game({ p0: { hand: ['BP03-055EN'], field: [AP], deck: [AP, DDF, AP, AP] } });
    const fodder = s.players[0].field[0], ddf = T.find(s, 0, DDF);
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.min, 0, 'optional cost');
    s = T.answer(s, [fodder]);
    eq(T.zone(s, fodder), 'cemetery');
    eq(T.zone(s, ddf), 'field');
    eq(s.players[0].deck.length, 3, 'the revealed 3-cost card went to the bottom');
  });

  test('BP03-055EN Jabberwock: declining the cost does nothing', () => {
    let s = T.game({ p0: { hand: ['BP03-055EN'], field: [AP], deck: [DDF] } });
    s = T.answer(T.play(s, s.players[0].hand[0]), []);
    eq(s.players[0].field.length, 2); eq(s.players[0].deck.length, 1);
  });

  test('BP05-053EN Galmieux (evolved): On Evolve plays an Omen card costing 2 or less from the cemetery for 0', () => {
    let s = T.game({ p0: { field: ['BP05-052EN'], evoDeck: ['BP05-053EN'], cemetery: [DISCIPLE, AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    const d = T.find(s, 0, DISCIPLE);
    eq(s.ask.from, [d], 'only the Omen card is a candidate');
    s = T.answer(s, [d]);
    eq(T.zone(s, d), 'field'); eq(s.players[0].pp, 8, 'only the evolve cost was paid');
  });

  test('BP05-053EN Galmieux (evolved): ability damage on your turn deals 3 to an enemy leader or follower', () => {
    let s = T.game({ p0: { field: [{ id: 'BP05-052EN', evo: 'BP05-053EN' }, DISCIPLE] }, p1: { field: [AP] } });
    const [g, d] = s.players[0].field;
    s = T.act(s, { type: 'activate', iid: d, idx: 0 });
    s = T.answer(s, [g]);
    ok(s.ask.from.includes(s.players[1].leader), 'the enemy leader is a candidate');
    s = T.answer(s, [s.players[1].leader]);
    eq(s.players[1].defense, 17);
  });

  test('BP05-058EN Disdainful Rending: 1 to your follower, 3 to the enemy; needs both', () => {
    let s = T.game({ p0: { hand: ['BP05-058EN'], field: [AP] }, p1: { field: [GEN] } });
    const a = s.players[0].field[0], g = s.players[1].field[0];
    s = T.answer(T.answer(T.play(s, s.players[0].hand[0]), [a]), [g]);
    eq([T.def(s, a), T.def(s, g)], [2, 9]);
    s = T.game({ p0: { hand: ['BP05-058EN'] }, p1: { field: [GEN] } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].hand[0] }), 'Q681');
  });

  test('BP05-059EN Disciple of Disdain: 1 damage to your follower, once per turn', () => {
    let s = T.game({ p0: { field: [DISCIPLE, AP] } });
    const [d, a] = s.players[0].field;
    s = T.answer(T.act(s, { type: 'activate', iid: d, idx: 0 }), [a]);
    eq(T.def(s, a), 2);
    ok(!T.legal(s, { type: 'activate', iid: d, idx: 0 }));
  });

  test('BP05-063EN Servant of Disdain: Overflow Fanfare damages another follower and itself, then it draws', () => {
    let s = T.game({ p0: { hand: ['BP05-063EN'] }, p1: { field: [AP] } });
    const sv = s.players[0].hand[0], e = s.players[1].field[0];
    s = T.play(s, sv);
    eq(s.ask.from, [e], 'another follower only');
    s = T.answer(s, [e]);
    eq([T.def(s, e), T.def(s, sv)], [2, 2]);
    eq(s.players[0].hand.length, 1, 'drew a card for taking ability damage on its turn');
    s = T.game({ p0: { hand: ['BP05-063EN'], maxPP: 6 }, p1: { field: [AP] } });
    s = T.play(s, s.players[0].hand[0]);
    ok(!s.ask); eq(s.players[0].hand.length, 0);
    s = T.game({ active: 1, p0: { field: ['BP05-063EN'] }, p1: { hand: ['BP01-098EN'], maxPP: 6 } });
    s = T.answer(T.play(s, s.players[1].hand[0]), [s.players[0].field[0]]);
    eq(T.def(s, s.players[0].field[0]), 1); eq(s.players[0].hand.length, 0, "not on the opponent's turn");
  });

  test("BP06-054EN Filene, Whitefrost Dragonewt: engages an enemy follower that stays engaged through its controller's next start phase", () => {
    let s = T.game({ p0: { hand: ['BP06-054EN'], maxPP: 6 }, p1: { field: [AP] } });
    const e = s.players[1].field[0];
    s = bagFirst(T.play(s, s.players[0].hand[0]));
    if (s.ask && s.ask.from && s.ask.from.includes(e)) s = T.answer(s, [e]);
    s = bagFirst(s);
    eq(s.cards[e].engaged, true);
    s = T.endTurn(s);
    eq(s.active, 1); eq(s.cards[e].engaged, true, 'did not refresh');
  });

  test('BP06-054EN Filene, Whitefrost Dragonewt: with Overflow searches a Whitefrost Whisper into the EX area', () => {
    let s = T.game({ p0: { hand: ['BP06-054EN'], deck: [AP, 'BP06-058EN', AP] } });
    s = T.play(s, s.players[0].hand[0]);
    for (let k = 0; k < 4 && s.ask; k++) s = s.ask.kind === 'bag' ? T.answer(s, s.ask.options[s.ask.options.length - 1].id) : T.answer(s, s.ask.from.slice(0, 1));
    eq(names(s, s.players[0].ex), ['Whitefrost Whisper']);
  });

  test('BP06-058EN Whitefrost Whisper: costs 1 with Overflow, destroys an engaged enemy, 2 to its leader with Filene', () => {
    let s = T.game({ p0: { hand: ['BP06-058EN'], field: ['BP06-054EN'] }, p1: { field: [{ id: AP, engaged: true }, AP] } });
    const w = s.players[0].hand[0], [e, r] = s.players[1].field;
    eq(SV.costToPlay(s, w), 1);
    s = T.play(s, w);
    eq(s.ask.from, [e], 'engaged followers only');
    s = T.answer(s, [e]);
    eq(T.zone(s, e), 'cemetery'); eq(s.players[1].defense, 18); eq(T.zone(s, r), 'field');
    s = T.game({ p0: { hand: ['BP06-058EN'], maxPP: 5 }, p1: { field: [AP] } });
    eq(SV.costToPlay(s, s.players[0].hand[0]), 2);
    ok(!T.legal(s, { type: 'play', iid: s.players[0].hand[0] }), 'Q826: no engaged enemy follower');
  });

  test('BP08-058EN Powerforge: damage equal to the attack of a follower in your EX area', () => {
    let s = T.game({ p0: { hand: ['BP08-058EN'], ex: [GEN] }, p1: { field: [GEN] } });
    const g = s.players[1].field[0];
    s = T.answer(T.answer(T.play(s, s.players[0].hand[0]), [g]), [s.players[0].ex[0]]);
    eq(T.def(s, g), 2);
    s = T.game({ p0: { hand: ['BP08-058EN'] }, p1: { field: [GEN] } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].hand[0] }), 'Q1074');
  });

  test('BP09-073EN Force of the Dragonewt: 3 damage, draw, then discard a card', () => {
    let s = T.game({ p0: { hand: ['BP09-073EN', AP] }, p1: { field: [GEN] } });
    const g = s.players[1].field[0], keep = hand0(s, AP);
    s = T.answer(T.play(s, s.players[0].hand[0]), [g]);
    eq(T.def(s, g), 9); eq(s.ask.min, 1); eq(s.players[0].hand.length, 2);
    s = T.answer(s, [keep]);
    eq(T.zone(s, keep), 'cemetery'); eq(s.players[0].hand.length, 1);
  });

  test('BP10-056EN Aiela: (1) +1 max play point and recover 2; (2) with Overflow a Devoted Dragon and +2 defense', () => {
    let s = T.game({ p0: { hand: ['BP10-056EN'], maxPP: 6, pp: 5 } });
    s = T.answer(T.play(s, s.players[0].hand[0]), [0]);
    eq([s.players[0].maxPP, s.players[0].pp], [7, 2]);
    s = T.game({ p0: { hand: ['BP10-056EN'] } });
    s = T.answer(T.play(s, s.players[0].hand[0]), [1]);
    s = T.answerWhile(s, /has Ward/, false);
    eq(names(s, s.players[0].field), ['Aiela, Devoted Knight', 'Devoted Dragon']); eq(s.players[0].defense, 22);
  });

  test('BP10-T02EN Devoted Dragon: no ability damage while an Aiela is on your field', () => {
    let s = T.game({ p0: { hand: ['BP01-089EN'], field: ['BP10-056EN', 'BP10-T02EN'] } });
    const dd = s.players[0].field[1];
    s = T.play(s, s.players[0].hand[0]);
    eq(T.def(s, dd), 6);
    s = T.game({ p0: { hand: ['BP01-089EN'], field: ['BP10-T02EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(T.def(s, s.players[0].field[0]), 1);
  });

  test("BP12-058EN Cursed Furor: Quick with Overflow in the opponent's attack window; 4 damage and a Naterran Great Tree", () => {
    let s = T.game({ p0: { field: [AP] }, p1: { hand: ['BP12-058EN'], maxPP: 7 } });
    const a = s.players[0].field[0];
    s = T.act(s, { type: 'attack', iid: a, target: s.players[1].leader });
    ok(s.window && s.window.who === 1);
    s = T.answer(T.act(s, { type: 'play', iid: s.players[1].hand[0] }), [a]);
    eq(T.zone(s, a), 'cemetery'); eq(names(s, s.players[1].field), ['Naterran Great Tree']);
    s = T.game({ p0: { field: [AP] }, p1: { hand: ['BP12-058EN'], maxPP: 6 } });
    s = T.act(s, { type: 'attack', iid: s.players[0].field[0], target: s.players[1].leader });
    ok(!s.window, 'no Quick without Overflow');
  });

  test('BP13-056EN Forte, Sovereign Supreme: Dragons get Storm and Drain; summons a Dragon once per turn', () => {
    let s = T.game({ p0: { field: ['BP13-056EN'] } });
    const f = s.players[0].field[0];
    s = T.act(s, { type: 'activate', iid: f, idx: 0 });
    const d = s.players[0].field[1];
    eq(names(s, [d]), ['Dragon']);
    ok(SV.chars(s, d).kw.Storm && SV.chars(s, d).kw.Drain); ok(!SV.chars(s, f).kw.Storm, 'Forte is not a Dragon');
    ok(T.legal(s, { type: 'attack', iid: d, target: s.players[1].leader }));
    ok(!T.legal(s, { type: 'activate', iid: f, idx: 0 }));
    s = T.attack(s, d, s.players[1].leader);
    eq([s.players[1].defense, s.players[0].defense], [15, 25]);
  });

  test("BP13-056EN Forte, Sovereign Supreme: end phase — selected enemy followers can't attack during their next turn", () => {
    let s = T.game({ p0: { field: ['BP13-056EN'] }, p1: { field: [AP, AP] } });
    const [e1, e2] = s.players[1].field;
    s = T.act(s, { type: 'end' });
    eq(s.ask.max, 2); eq(s.ask.min, 0);
    s = T.answer(s, [e1]);
    while (s.window) s = T.pass(s);
    eq(s.active, 1);
    ok(!T.legal(s, { type: 'attack', iid: e1, target: s.players[0].leader }));
    ok(T.legal(s, { type: 'attack', iid: e2, target: s.players[0].leader }));
  });

  test('BP15-057EN Galmieux, Ardent Disdain: ability damage — an Omen card from the top 2 into the EX area costs 3 less; the rest is buried', () => {
    let s = T.game({ p0: { field: ['BP15-057EN', DISCIPLE], deck: ['BP20-064EN', AP, AP] } });
    const [g, d] = s.players[0].field;
    s = T.answer(T.act(s, { type: 'activate', iid: d, idx: 0 }), [g]);
    eq(s.ask.seen.length, 2);
    const sup = T.find(s, 0, 'BP20-064EN');
    s = T.answer(s, [sup]);
    eq(T.zone(s, sup), 'ex'); eq(SV.costToPlay(s, sup), 0);
    eq(s.players[0].cemetery.length, 1); eq(s.players[0].deck.length, 1);
  });

  test('BP15-057EN Galmieux, Ardent Disdain: Fanfare puts a Fangs of Ardent Destruction token into the EX area', () => {
    let s = T.game({ p0: { hand: ['BP15-057EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.players[0].ex), ['Fangs of Ardent Destruction']);
  });

  test('BP15-PR13EN Fangs of Ardent Destruction: 1 damage to each follower; Storm for Galmieux, Ardent Disdain with Overflow', () => {
    let s = T.game({ p0: { ex: ['BP15-PR13EN'], field: [{ id: 'BP15-057EN', fresh: true }], deck: [GEN, GEN, GEN] }, p1: { field: [AP] } });
    const g = s.players[0].field[0], e = s.players[1].field[0];
    s = T.play(s, s.players[0].ex[0]);
    s = T.answerWhile(s, /Galmieux: you may put/, []); // its own ability-damage trigger: take nothing
    eq([T.def(s, g), T.def(s, e)], [4, 2]); ok(SV.chars(s, g).kw.Storm);
    ok(T.legal(s, { type: 'attack', iid: g, target: s.players[1].leader }));
    s = T.game({ p0: { ex: ['BP15-PR13EN'], field: ['BP15-057EN'], maxPP: 6, deck: [GEN, GEN, GEN] } });
    s = T.answerWhile(T.play(s, s.players[0].ex[0]), /Galmieux: you may put/, []);
    ok(!SV.chars(s, s.players[0].field[0]).kw.Storm);
  });

  test("BP15-058EN Filene, Blizzardous Heart: with Overflow, cards cost 1 more during the opponent's next turn only", () => {
    let s = T.game({ p0: { hand: ['BP15-058EN'], maxPP: 7 }, p1: { hand: [AP] } });
    const h = s.players[1].hand[0];
    s = T.play(s, s.players[0].hand[0]);
    eq(SV.costToPlay(s, h), 3, 'not yet');
    s = T.endTurn(s);
    eq(SV.costToPlay(s, h), 4);
    s = T.endTurn(s);
    eq(SV.costToPlay(s, h), 3, 'over');
  });

  test('BP15-059EN Filene, Blizzardous Heart (evolved): On Evolve searches a Whitefrost card', () => {
    let s = T.game({ p0: { field: ['BP15-058EN'], evoDeck: ['BP15-059EN'], deck: [AP, 'BP15-065EN', AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ['Whitefrost Blizzard']);
  });

  test('BP15-065EN Whitefrost Blizzard: costs 2 less with Filene; divides X = max PP damage', () => {
    let s = T.game({ p0: { hand: ['BP15-065EN'], field: ['BP15-058EN'], maxPP: 7 }, p1: { field: [GEN, AP] } });
    const w = s.players[0].hand[0], [g, a] = s.players[1].field;
    eq(SV.costToPlay(s, w), 2);
    s = T.answer(T.play(s, w), [g, a]);
    eq([s.ask.kind, s.ask.min, s.ask.max], ['number', 1, 6]);
    s = T.answer(s, 4);
    eq(T.def(s, g), 8); eq(T.zone(s, a), 'cemetery');
  });

  test('BP15-066EN Adherent of Ardor: Overflow Fanfare damages your followers; its own ability damage deals 3 to an enemy', () => {
    let s = T.game({ p0: { hand: ['BP15-066EN'], field: [AP] }, p1: { field: [GEN] } });
    const ad = s.players[0].hand[0], a = s.players[0].field[0], g = s.players[1].field[0];
    s = T.answer(T.play(s, ad), [a, ad]);
    eq([T.def(s, a), T.def(s, ad)], [2, 2]);
    s = T.answer(s, [g]);
    eq(T.def(s, g), 9);
  });

  test('BP15-067EN Adherent of Ardor (evolved): On Evolve damages your followers, then the trigger deals 3', () => {
    let s = T.game({ p0: { field: ['BP15-066EN'], evoDeck: ['BP15-067EN'] }, p1: { field: [GEN] } });
    const ad = s.players[0].field[0], g = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: ad });
    eq(s.ask.max, 1, 'up to 2, one follower');
    s = T.answer(T.answer(s, [ad]), [g]);
    eq([T.def(s, ad), T.def(s, g)], [3, 9]);
  });

  test('BP15-072EN Hermit of Disdain: Overflow 1 damage; then an Omen top card may be added to hand', () => {
    let s = T.game({ p0: { hand: ['BP15-072EN'], deck: [DISCIPLE, AP] } });
    const h = s.players[0].hand[0];
    s = T.answer(T.play(s, h), [h]);
    eq(T.def(s, h), 1);
    eq(s.ask.min, 0, 'Q1932 optional');
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ['Disciple of Disdain']);
    s = T.game({ p0: { hand: ['BP15-072EN'], deck: [GEN, DISCIPLE] } });
    s = T.answer(T.play(s, s.players[0].hand[0]), [s.players[0].hand[0]]);
    ok(!s.ask); eq(s.players[0].hand.length, 0); eq(s.players[0].deck.length, 2);
  });

  test('BP16-057EN Forte, Blackwing Dragoon: +1 attack and Aura at 10 max play points only', () => {
    let s = T.game({ p0: { hand: ['BP16-057EN'] } });
    const f = s.players[0].hand[0];
    s = T.play(s, f);
    eq(T.atk(s, f), 7); ok(SV.chars(s, f).kw.Aura);
    s = T.game({ p0: { hand: ['BP16-057EN'], maxPP: 9 } });
    s = T.play(s, s.players[0].hand[0]);
    eq(T.atk(s, s.players[0].field[0]), 6);
  });

  test('BP17-055EN Rowen: Fanfare token; Strike 2 + 1 to the leader with Overflow; [act] 3 + 1', () => {
    let s = T.game({ p0: { hand: ['BP17-055EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.players[0].ex), ['Curse of the Black Dragon']);
    s = T.game({ p0: { field: ['BP17-055EN'] }, p1: { field: [GEN] } });
    const r = s.players[0].field[0], g = s.players[1].field[0];
    s = T.act(s, { type: 'attack', iid: r, target: s.players[1].leader });
    s = T.answer(s, [g]);
    while (s.window) s = T.pass(s);
    eq(T.def(s, g), 10); eq(s.players[1].defense, 15, '1 from Strike, 4 from the attack');
    s = T.game({ p0: { field: ['BP17-055EN'] }, p1: { field: [GEN] } });
    s = T.answer(T.act(s, { type: 'activate', iid: s.players[0].field[0], idx: 0 }), [s.players[1].field[0]]);
    eq(T.def(s, s.players[1].field[0]), 9); eq(s.players[1].defense, 19); eq(s.players[0].pp, 6);
    s = T.game({ p0: { field: ['BP17-055EN'] } });
    ok(!T.legal(s, { type: 'activate', iid: s.players[0].field[0], idx: 0 }), 'no target');
  });

  test('BP17-T06EN Curse of the Black Dragon: Rowen deals that much plus 1 this turn; needs Overflow', () => {
    let s = T.game({ p0: { field: ['BP17-055EN'], ex: ['BP17-T06EN'] }, p1: { field: [GEN] } });
    const r = s.players[0].field[0];
    s = T.answer(T.play(s, s.players[0].ex[0]), [r]);
    s = T.answer(T.act(s, { type: 'activate', iid: r, idx: 0 }), [s.players[1].field[0]]);
    eq(T.def(s, s.players[1].field[0]), 8); eq(s.players[1].defense, 18);
    s = T.game({ p0: { field: ['BP17-055EN'], ex: ['BP17-T06EN'], maxPP: 6 } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].ex[0] }));
  });

  test('BP17-T06EN Curse of the Black Dragon: in the EX area without Overflow it deals 1 to your leader at your end phase', () => {
    let s = T.game({ p0: { ex: ['BP17-T06EN'], maxPP: 6 } });
    s = T.endTurn(s);
    eq(s.players[0].defense, 19);
    s = T.game({ p0: { ex: ['BP17-T06EN'], maxPP: 7 } });
    s = T.endTurn(s);
    eq(s.players[0].defense, 20);
  });

  test('BP18-061EN Fafnir: Fanfare deals 8 to each enemy follower and 4 to the enemy leader; the destroyed one is banished', () => {
    let s = T.game({ p0: { hand: ['BP18-061EN'] }, p1: { field: [AP, GEN] } });
    const [a, g] = s.players[1].field;
    s = T.play(s, s.players[0].hand[0]);
    eq(T.zone(s, a), 'banished'); eq(T.def(s, g), 4); eq(s.players[1].defense, 16);
  });

  test('BP18-061EN Fafnir: enemy followers going to the cemetery are banished, Last Words do not trigger (Q2170); yours still go to the cemetery', () => {
    let s = T.game({ p0: { hand: ['BP01-089EN'], field: ['BP18-061EN', AP] }, p1: { field: [THIEF, AP] } });
    const mine = s.players[0].field[1], [th, e] = s.players[1].field;
    s = T.play(s, s.players[0].hand[0]);
    eq([T.zone(s, th), T.zone(s, e)], ['banished', 'banished'], 'Razor-Clawed Thief is not put into the EX area');
    eq(s.players[1].ex.length, 0); eq(T.zone(s, mine), 'cemetery');
    s = T.game({ p0: { hand: ['BP06-058EN'], field: ['BP18-061EN'] }, p1: { field: [{ id: AP, engaged: true }] } });
    const t2 = s.players[1].field[0];
    s = T.answer(T.play(s, s.players[0].hand[0]), [t2]);
    eq(T.zone(s, t2), 'banished', 'destroyed by an ability');
  });

  test('BP19-056EN Antemaria: not from the EX area; bury 2 Condemned for Storm and Drain', () => {
    let s = T.game({ p0: { ex: ['BP19-056EN'] } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].ex[0] }));
    s = T.game({ p0: { hand: ['BP19-056EN'], ex: [THIEF, THIEF] } });
    const an = s.players[0].hand[0];
    s = T.play(s, an);
    eq(s.ask.kind, 'yesno');
    s = T.answer(T.answer(s, true), s.players[0].ex.slice());
    eq(s.players[0].ex.length, 0); ok(SV.chars(s, an).kw.Storm && SV.chars(s, an).kw.Drain);
  });

  test('BP19-056EN Antemaria: Last Words puts it into the EX area', () => {
    let s = T.game({ p0: { hand: ['BP01-089EN'], field: ['BP19-056EN'] } });
    const an = s.players[0].field[0];
    s = T.play(s, s.players[0].hand[0]);
    eq(T.zone(s, an), 'ex');
  });

  test("BP19-057EN Drazael: can't be destroyed by abilities; damage kills it and Last Words returns it to the EX area", () => {
    let s = T.game({ active: 1, p0: { field: [{ id: 'BP19-057EN', engaged: true }] }, p1: { hand: ['BP06-058EN'] } });
    const dz = s.players[0].field[0];
    s = T.answer(T.play(s, s.players[1].hand[0]), [dz]);
    eq(T.zone(s, dz), 'field');
    s = T.game({ p0: { hand: ['BP01-089EN'], field: ['BP19-057EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(T.zone(s, s.players[0].ex[0]), 'ex'); eq(names(s, s.players[0].ex), ['Drazael, Ravening Enforcer']);
    s = T.game({ p0: { ex: ['BP19-057EN'] } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].ex[0] }));
  });

  test('BP19-058EN Drazael (evolved): bury 2 Condemned — each enemy follower -5/-5, leader +5', () => {
    let s = T.game({ p0: { field: ['BP19-057EN'], evoDeck: ['BP19-058EN'], ex: [THIEF, THIEF] }, p1: { field: [GEN, AP] } });
    const [g, a] = s.players[1].field;
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(T.answer(s, true), s.players[0].ex.slice());
    eq([T.atk(s, g), T.def(s, g)], [5, 7]); eq(T.zone(s, a), 'cemetery'); eq(s.players[0].defense, 25);
    ok(SV.chars(s, s.players[0].field[0]).flags.cantBeDestroyedByAbilities);
  });

  test('BP19-060EN Scorched-Earth Tyrant: bury a Condemned card from the EX area for 4 damage', () => {
    let s = T.game({ p0: { hand: ['BP19-060EN'], ex: [THIEF] }, p1: { field: [GEN] } });
    const th = s.players[0].ex[0], g = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.min, 0);
    s = T.answer(T.answer(s, [th]), [g]);
    eq(T.zone(s, th), 'cemetery'); eq(T.def(s, g), 8);
    s = T.game({ p0: { ex: ['BP19-060EN'] } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].ex[0] }));
  });

  test('BP19-061EN Scorched-Earth Tyrant (evolved): On Evolve 4 damage; Last Words to the EX area', () => {
    let s = T.game({ p0: { field: ['BP19-060EN'], evoDeck: ['BP19-061EN'] }, p1: { field: [GEN] } });
    const t = s.players[0].field[0], g = s.players[1].field[0];
    s = T.answer(T.act(s, { type: 'evolve', iid: t }), [g]);
    eq(T.def(s, g), 8);
    s = T.game({ p0: { hand: ['BP01-089EN'], field: [{ id: 'BP19-060EN', evo: 'BP19-061EN' }] } });
    const t2 = s.players[0].field[0];
    s = T.play(s, s.players[0].hand[0]);
    eq(T.zone(s, t2), 'ex');
  });

  test('BP19-062EN Neptune: Megalorca to EX, another summoned with Overflow; it gets Storm and the leader +1', () => {
    let s = T.game({ p0: { hand: ['BP19-062EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.players[0].ex), ['Megalorca']);
    const m = s.players[0].field[1];
    eq(names(s, [m]), ['Megalorca']); ok(SV.chars(s, m).kw.Storm); eq(s.players[0].defense, 21);
  });

  test('BP19-062EN Neptune: [act] the next Marine card played from the EX area costs 1 less, once', () => {
    let s = T.game({ p0: { field: ['BP19-062EN'], ex: ['BP19-073EN', 'BP19-073EN'], hand: ['BP19-073EN'] } });
    const [c1, c2] = s.players[0].ex, h = s.players[0].hand[0];
    s = T.act(s, { type: 'activate', iid: s.players[0].field[0], idx: 0 });
    eq([SV.costToPlay(s, c1), SV.costToPlay(s, h)], [0, 2], 'from the EX area only');
    s = T.play(s, c1);
    eq(SV.costToPlay(s, c2), 1, 'used up');
    ok(!T.legal(s, { type: 'activate', iid: s.players[0].field[0], idx: 0 }));
  });

  test('BP19-063EN Warden of the Adamant Claw: look at 4, take a Condemned card; Last Words to the EX area', () => {
    let s = T.game({ p0: { hand: ['BP19-063EN', 'BP01-089EN'], deck: [AP, THIEF, AP, AP, AP] } });
    const w = hand0(s, 'BP19-063EN');
    s = T.play(s, w);
    eq(s.ask.seen.length, 4);
    s = T.answer(s, s.ask.from);
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand).sort(), ['Conflagration', 'Razor-Clawed Thief']);
    s = T.play(s, hand0(s, 'BP01-089EN'));
    eq(T.zone(s, w), 'ex');
  });

  test('BP19-064EN Hotheaded Marauder: not playable from the EX area; Last Words to the EX area', () => {
    let s = T.game({ p0: { ex: ['BP19-064EN'], hand: ['BP19-064EN'] } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].ex[0] })); ok(T.legal(s, { type: 'play', iid: s.players[0].hand[0] }));
    s = T.game({ p0: { hand: ['BP01-089EN'], field: ['BP19-064EN'] } });
    const m = s.players[0].field[0];
    s = T.play(s, s.players[0].hand[0]);
    eq(T.zone(s, m), 'ex');
  });

  test('BP19-065EN Hotheaded Marauder (evolved): On Evolve summons a 1-cost Condemned follower from the deck', () => {
    let s = T.game({ p0: { field: ['BP19-064EN'], evoDeck: ['BP19-065EN'], deck: [AP, 'BP19-064EN', THIEF, AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    const th = T.find(s, 0, THIEF);
    eq(s.ask.from, [th]);
    s = T.answer(s, [th]);
    eq(T.zone(s, th), 'field');
  });

  test('BP19-066EN Razor-Clawed Thief: not playable from the EX area; Last Words to the EX area', () => {
    let s = T.game({ p0: { ex: [THIEF] } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].ex[0] }));
    s = T.game({ p0: { hand: ['BP01-089EN'], field: [THIEF] } });
    const th = s.players[0].field[0];
    s = T.play(s, s.players[0].hand[0]);
    eq(T.zone(s, th), 'ex');
  });

  test('BP19-067EN Seasoned Merman: 2 Megalorcas with Rush and Assail; the top card goes to the EX area', () => {
    let s = T.game({ p0: { hand: ['BP19-067EN'], deck: [DDF, AP] }, p1: { field: [AP] } });
    s = T.play(s, s.players[0].hand[0]);
    const ms = s.players[0].field.slice(1);
    eq(names(s, ms), ['Megalorca', 'Megalorca']);
    ok(SV.chars(s, ms[0]).kw.Rush && SV.chars(s, ms[0]).kw.Assail);
    ok(T.legal(s, { type: 'attack', iid: ms[0], target: s.players[1].field[0] }));
    eq(names(s, s.players[0].ex), ['Dark Dragoon Forte']);
  });

  test('BP19-073EN Call of the Megalorca: costs 1 from the EX area; Megalorca, draw, a second with Overflow', () => {
    let s = T.game({ p0: { ex: ['BP19-073EN'], hand: ['BP19-073EN'], maxPP: 6 } });
    eq([SV.costToPlay(s, s.players[0].ex[0]), SV.costToPlay(s, s.players[0].hand[0])], [1, 2]);
    s = T.play(s, s.players[0].ex[0]);
    eq(s.players[0].field.length, 1); eq(s.players[0].hand.length, 2);
    s = T.game({ p0: { hand: ['BP19-073EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.players[0].field), ['Megalorca', 'Megalorca']);
  });

  test('BP20-056EN Galmieux, Ardor Manifest: Storm with Overflow; crest; 2 damage once per turn on ability damage', () => {
    let s = T.game({ p0: { hand: ['BP20-056EN'], field: [DISCIPLE] }, p1: { field: [GEN] } });
    const g = s.players[0].hand[0], d = s.players[0].field[0], e = s.players[1].field[0];
    s = T.play(s, g);
    ok(SV.chars(s, g).kw.Storm);
    eq(names(s, s.players[0].ex), ['Crest: Galmieux, Ardor Manifest']);
    s = T.answer(T.act(s, { type: 'activate', iid: s.players[0].ex[0], idx: 0 }), [g]);
    s = T.answer(s, [e]);
    eq(T.def(s, e), 10);
    s = T.answer(T.act(s, { type: 'activate', iid: d, idx: 0 }), [g]);
    ok(!s.ask, 'once per turn'); eq(T.def(s, e), 10);
    s = T.game({ p0: { field: ['BP20-056EN'], maxPP: 6 } });
    ok(!SV.chars(s, s.players[0].field[0]).kw.Storm);
  });

  test('BP20-T05EN Crest: Galmieux, Ardor Manifest: 1 damage to an Omen follower of yours, once per turn', () => {
    let s = T.game({ p0: { ex: ['BP20-T05EN'], field: [GEN] } }); // (Apostle of Unkilling is an Omen follower)
    ok(!T.legal(s, { type: 'activate', iid: s.players[0].ex[0], idx: 0 }), 'no Omen follower');
    s = T.game({ p0: { ex: ['BP20-T05EN'], field: [GEN, DISCIPLE] } });
    const d = s.players[0].field[1];
    s = T.act(s, { type: 'activate', iid: s.players[0].ex[0], idx: 0 });
    eq(s.ask.from, [d]);
    s = T.answer(s, [d]);
    eq(T.def(s, d), 1);
    ok(!T.legal(s, { type: 'activate', iid: s.players[0].ex[0], idx: 0 }));
  });

  test('BP20-057EN Azurifrit: with another Omen card, 1 to each follower; its ability damage hits each enemy follower again', () => {
    let s = T.game({ p0: { hand: ['BP20-057EN'], field: [DISCIPLE] }, p1: { field: [AP] } });
    const az = s.players[0].hand[0], e = s.players[1].field[0];
    s = T.play(s, az);
    eq([T.def(s, az), T.def(s, e)], [4, 1]);
    s = T.game({ p0: { hand: ['BP20-057EN'] }, p1: { field: [AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(T.def(s, s.players[1].field[0]), 3, 'no other Omen card');
  });

  test('BP20-058EN Azurifrit (evolved): On Super-Evolve 1 to each follower, 4 to the enemy leader, defense becomes 7', () => {
    let s = T.game({ p0: { field: ['BP20-057EN'], evoDeck: ['BP20-058EN'], turnsPassed: 8 }, p1: { field: [GEN] } });
    const az = s.players[0].field[0], g = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: az });
    s = T.answer(s, true); // super-evolve
    s = bagFirst(s); s = bagFirst(s);
    eq(T.def(s, az), 7); eq(s.players[1].defense, 16);
    eq(T.def(s, g), 12 - 1 - 1 - 1 - 1, 'On Evolve, On Super-Evolve and two ability-damage triggers');
  });

  test('BP20-062EN Congregant of Disdain: Overflow 1 to each follower; +1 max play point once per turn', () => {
    let s = T.game({ p0: { hand: ['BP20-062EN'], field: [DISCIPLE], maxPP: 8 }, p1: { field: [AP] } });
    const c = s.players[0].hand[0], d = s.players[0].field[0];
    s = T.play(s, c);
    eq(T.def(s, c), 3); eq(s.players[0].maxPP, 9);
    s = T.answer(T.act(s, { type: 'activate', iid: d, idx: 0 }), [c]);
    eq(s.players[0].maxPP, 9, 'once per turn');
  });

  test('BP20-063EN Ferocious Flame: 1 and 4 damage, draw, +1 max play point with a Galmieux', () => {
    let s = T.game({ p0: { hand: ['BP20-063EN'], field: ['BP20-056EN'], maxPP: 8 }, p1: { field: [GEN] } });
    const g = s.players[0].field[0], e = s.players[1].field[0];
    s = T.answer(T.answer(T.play(s, s.players[0].hand[0]), [g]), [e]);
    s = T.answerWhile(s, /Galmieux: select an enemy/, [e]);
    eq(T.def(s, g), 2); eq(T.def(s, e), 12 - 4 - 2); eq(s.players[0].hand.length, 1); eq(s.players[0].maxPP, 9);
  });

  test('BP20-064EN Supplicant of Disdain: Overflow 1 damage to any follower and +2 defense', () => {
    let s = T.game({ p0: { hand: ['BP20-064EN'] }, p1: { field: [AP] } });
    const e = s.players[1].field[0];
    s = T.answer(T.play(s, s.players[0].hand[0]), [e]);
    eq(T.def(s, e), 2); eq(s.players[0].defense, 22);
  });

  test('BP20-065EN Supplicant of Disdain (evolved): On Evolve 2 damage to an enemy follower', () => {
    let s = T.game({ p0: { field: ['BP20-064EN'], evoDeck: ['BP20-065EN'] }, p1: { field: [GEN] } });
    s = T.answer(T.act(s, { type: 'evolve', iid: s.players[0].field[0] }), [s.players[1].field[0]]);
    eq(T.def(s, s.players[1].field[0]), 10);
  });

  test('BP20-067EN Nation of Disdain: look at 2 for an Omen–Wyrmkin card; [engage], bury this: 1 damage', () => {
    let s = T.game({ p0: { hand: ['BP20-067EN'], field: [AP], deck: [AP, DISCIPLE, AP] } });
    const n = s.players[0].hand[0], a = s.players[0].field[0];
    s = T.play(s, n);
    eq(s.ask.seen.length, 2);
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ['Disciple of Disdain']);
    s = T.answer(T.act(s, { type: 'activate', iid: n, idx: 0 }), [a]);
    eq(T.zone(s, n), 'cemetery'); eq(T.def(s, a), 2);
  });

  test('BP20-070EN Devotee of Disdain: 1 damage to your follower, once per turn', () => {
    let s = T.game({ p0: { field: ['BP20-070EN'] } });
    const d = s.players[0].field[0];
    s = T.answer(T.act(s, { type: 'activate', iid: d, idx: 0 }), [d]);
    eq(T.def(s, d), 2);
    ok(!T.legal(s, { type: 'activate', iid: d, idx: 0 }));
  });

  test('SD04-002EN Dragon Oracle: +1 max play point (not play points) or draw', () => {
    let s = T.game({ p0: { hand: ['SD04-002EN'], maxPP: 5 } });
    s = T.answer(T.play(s, s.players[0].hand[0]), [0]);
    eq([s.players[0].maxPP, s.players[0].pp], [6, 3]);
    s = T.game({ p0: { hand: ['SD04-002EN'] } });
    s = T.answer(T.play(s, s.players[0].hand[0]), [1]);
    eq(s.players[0].hand.length, 1); eq(s.players[0].maxPP, 10);
  });

  test('BP05-052EN Galmieux, Omen of Disdain: ability damage on your turn makes its evolve cost 0 this turn; next turn it is 2 again', () => {
    let s = SV.T.game({ p0: { field: ['BP05-052EN'], hand: ['BP15-PR13EN'], evoDeck: ['BP05-053EN'] } });
    const g = s.players[0].field[0];
    SV.T.eq(SV.evolveInfo(s, g).cost, 2);
    s = SV.T.play(s, s.players[0].hand[0]); // Fangs of Ardent Destruction: 1 damage to each follower
    while (s.ask && s.ask.kind === 'bag') s = SV.T.answer(s, s.ask.options[0].id);
    SV.T.eq(SV.evolveInfo(s, g).cost, 0);
    s = SV.T.endTurn(s); s = SV.T.endTurn(s);
    SV.T.eq(SV.evolveInfo(s, g).cost, 2);
  });
})();
