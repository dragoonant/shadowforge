// universe card behaviour tests (see tests/cards-abysscraft.js for the conventions).
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok } = SV.T;
  const T = SV.T;
  const AP = T.FILLER;
  const GEN = 'BP01-080EN'; // Genesis Dragon 10/12, cost 9
  const PALADIN = T.WARD; // Lunerian Paladin 1/1, cost 2
  const CARROT = 'CP01-085EN';
  const names = (s, list) => list.map((i) => SV.def(i, s).name);
  const hand0 = (s) => s.players[0].hand;

  test('CP01-085EN Carrot: serving one races the follower (Carrot to the race zone, Rush)', () => {
    let s = T.game({ p0: { field: [{ id: 'ECP01-048EN', fresh: true }], evoDeck: [CARROT, CARROT] }, p1: { field: [{ id: AP, engaged: true }] } });
    const r = s.players[0].field[0];
    ok(!SV.canAttackWith(s, r), 'summoning sick before racing');
    s = T.act(s, { type: 'activate', iid: r, idx: 0 });
    eq(s.cards[r].links.map((l) => s.cards[l].zone), ['race']);
    eq(s.players[0].evoDeck.length, 1); ok(SV.canAttackWith(s, r), 'racing: Rush');
    eq(s.players[0].pp, 9);
  });

  test('ECP01-019EN Cheval Grand: Fanfare turns a faceup Carrot facedown with 10 Umamusume cards in the cemetery', () => {
    let s = T.game({ p0: { hand: ['ECP01-019EN'], evoDeck: [CARROT], cemetery: Array(10).fill('ECP01-019EN') } });
    const c = s.players[0].evoDeck[0];
    s.cards[c].faceup = true; // a Carrot whose follower left the field
    s = T.play(s, hand0(s)[0]);
    eq(s.ask.from, [c]);
    s = T.answer(s, [c]);
    eq(s.cards[c].faceup, false); eq(T.zone(s, c), 'evoDeck');
    let s2 = T.game({ p0: { hand: ['ECP01-019EN'], evoDeck: [CARROT], cemetery: Array(9).fill('ECP01-019EN') } });
    const c2 = s2.players[0].evoDeck[0];
    s2.cards[c2].faceup = true;
    s2 = T.play(s2, s2.players[0].hand[0]);
    s2 = T.answer(s2, [c2]);
    eq(s2.cards[c2].faceup, true, '9 Umamusume cards: stays faceup');
  });

  test('ECP01-020EN Cheval Grand (evolved): On Evolve deals 2 (4 with 10 Umamusume in the cemetery)', () => {
    let s = T.game({ p0: { field: ['ECP01-019EN'], evoDeck: ['ECP01-020EN'] }, p1: { field: [GEN] } });
    const t = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [t]);
    eq(T.def(s, t), 10);
    let s2 = T.game({ p0: { field: ['ECP01-019EN'], evoDeck: ['ECP01-020EN'], cemetery: Array(10).fill('ECP01-019EN') }, p1: { field: [GEN] } });
    const t2 = s2.players[1].field[0];
    s2 = T.act(s2, { type: 'evolve', iid: s2.players[0].field[0] });
    s2 = T.answer(s2, [t2]);
    eq(T.def(s2, t2), 8);
  });

  test('ECP01-020EN Cheval Grand (evolved): an enemy follower it damaged dies -> draw, then discard (twice per turn)', () => {
    let s = T.game({ p0: { field: [{ id: 'ECP01-019EN', evo: 'ECP01-020EN' }], hand: [AP] }, p1: { field: [{ id: PALADIN, engaged: true }] } });
    const ch = s.players[0].field[0], t = s.players[1].field[0];
    s = T.attack(s, ch, t);
    eq(T.zone(s, t), 'cemetery');
    eq(s.ask && s.ask.kind, 'cards', 'draw, then discard');
    eq(hand0(s).length, 2);
    s = T.answer(s, [hand0(s)[0]]);
    eq(hand0(s).length, 1);
    // An enemy follower that died without Umamusume damage does not trigger it.
    let s2 = T.game({ p0: { field: [{ id: 'ECP01-019EN', evo: 'ECP01-020EN' }, AP], hand: [AP] }, p1: { field: [{ id: PALADIN, engaged: true }] } });
    s2 = T.attack(s2, s2.players[0].field[1], s2.players[1].field[0]);
    ok(!s2.ask); eq(s2.players[0].hand.length, 1);
  });

  test('ECP01-048EN Mejiro Ramonu: choose up to X (Mejiro Family cards): banish + defense and a card', () => {
    let s = T.game({ p0: { hand: ['ECP01-048EN'], field: ['ECP01-053EN'] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.play(s, hand0(s)[0]);
    eq(s.ask.kind, 'modes'); eq(s.ask.max, 2);
    s = T.answer(s, [0, 2]);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'banished'); eq(s.players[0].defense, 22); eq(hand0(s).length, 1);
    let s2 = T.game({ p0: { hand: ['ECP01-048EN'] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.ask.max, 1); eq(s2.ask.options[0].enabled, false, 'Q1793: no target, option 1 disabled');
    s2 = T.answer(s2, [1]);
    ok(SV.chars(s2, s2.players[0].field[0]).kw.Storm);
  });

  test('ECP01-051EN Mejiro Ardan: On Race gets +1/+1 and summons Mejiro Family cards costing 6 in total', () => {
    let s = T.game({ p0: { field: ['ECP01-051EN'], evoDeck: [CARROT], deck: [AP, 'ECP01-053EN', 'ECP01-048EN', 'ECP01-051EN'] } });
    const a = s.players[0].field[0];
    s = T.act(s, { type: 'activate', iid: a, idx: 0 });
    eq([T.atk(s, a), T.def(s, a)], [4, 4]);
    eq(s.ask.sumCostMax, 6); eq(s.ask.max, 2);
    T.throws(() => T.answer(s, [T.find(s, 0, 'ECP01-048EN'), T.find(s, 0, 'ECP01-051EN')]), 'over 6 in total');
    s = T.answer(s, [T.find(s, 0, 'ECP01-053EN'), T.find(s, 0, 'ECP01-048EN')]);
    s = T.answerWhile(s, /Mejiro Ramonu/, [2]); // Ramonu's Fanfare
    eq(names(s, s.players[0].field).length, 3);
  });

  test("ECP01-053EN Mejiro Palmer: doesn't refresh in your start phase; pay 1 at main phase start to refresh", () => {
    let s = T.game({ p0: { field: [{ id: 'ECP01-053EN', engaged: true }] } });
    const m = s.players[0].field[0];
    s = T.endTurn(s); s = T.endTurn(s);
    eq(s.ask && s.ask.kind, 'yesno');
    ok(s.cards[m].engaged, 'still engaged after the start phase');
    const declined = T.answer(s, false);
    ok(declined.cards[m].engaged); eq(declined.players[0].pp, declined.players[0].maxPP);
    s = T.answer(s, true);
    ok(!s.cards[m].engaged); eq(s.players[0].pp, s.players[0].maxPP - 1);
  });

  test('CP02-062EN Unbound Emotion: costs 1 more per follower on the field; 7 damage to each follower', () => {
    let s = T.game({ p0: { hand: ['CP02-062EN'], field: [AP] }, p1: { field: [AP, GEN] } });
    const ue = hand0(s)[0];
    eq(SV.costToPlay(s, ue), 5);
    const [a, b] = s.players[1].field, mine = s.players[0].field[0];
    s = T.play(s, ue);
    eq(T.zone(s, a), 'cemetery'); eq(T.zone(s, mine), 'cemetery', 'your own followers too'); eq(T.def(s, b), 5);
    eq(s.players[0].pp, 5);
  });

  test('CP02-075EN Whispers of a Dream: destroys an enemy follower that costs 3 or less and buries your top card', () => {
    let s = T.game({ p0: { hand: ['CP02-075EN'], deck: [AP, AP] }, p1: { field: [AP, GEN] } });
    const [a, g] = s.players[1].field;
    s = T.play(s, hand0(s)[0]);
    eq(s.ask.from, [a]);
    s = T.answer(s, [a]);
    eq(T.zone(s, a), 'cemetery'); eq(s.players[0].deck.length, 1); eq(s.players[0].cemetery.length, 2);
    const s2 = T.game({ p0: { hand: ['CP02-075EN'] }, p1: { field: [GEN] } });
    ok(!T.legal(s2, { type: 'play', iid: s2.players[0].hand[0] }), 'no enemy follower costing 3 or less');
  });

  test('CP03-115EN Tsukuyomi: Fanfare keeps chosen cards on top in order, the rest to the bottom; [act] reveals the top card', () => {
    let s = T.game({ p0: { hand: ['CP03-115EN'], deck: ['BP19-048EN', GEN, 'BP19-046EN', AP, AP] } });
    const v = T.find(s, 0, 'BP19-048EN'), g = T.find(s, 0, GEN), r = T.find(s, 0, 'BP19-046EN');
    s = T.play(s, hand0(s)[0]);
    eq(s.ask.min, 0); eq(s.ask.max, 3);
    s = T.answer(s, [v, r]);
    s = T.answer(s, [r, v]); // top order (r topmost)
    const d = s.players[0].deck;
    eq([d[0], d[1], d[d.length - 1]], [r, v, g]);
    const ts = s.players[0].field[0];
    s = T.endTurn(s); s = T.endTurn(s); // draws r
    s = T.act(s, { type: 'activate', iid: ts, idx: 0 });
    ok(s.cards[ts].engaged); eq(s.players[0].deck[0], v, 'not a Goddess of the Half Moon: stays on top');
    ok(s.log.some((e) => e.type === 'reveal' && e.iids[0] === v));
  });

  test('CP03-126EN Powers Converged: choose one (no Drive Points): +4 defense', () => {
    let s = T.game({ p0: { hand: ['CP03-126EN'] } });
    s = T.play(s, hand0(s)[0]);
    eq(s.ask.max, 1); eq(s.ask.options[0].enabled, false); eq(s.ask.options[1].enabled, false);
    s = T.answer(s, [2]);
    eq(s.players[0].defense, 24);
    let s2 = T.game({ p0: { hand: ['CP03-126EN'], cemetery: [AP] }, p1: { field: [AP] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    s2 = T.answer(s2, [1]);
    s2 = T.answer(s2, s2.ask.from);
    eq(names(s2, s2.players[0].hand), ['Apostle of Unkilling']);
  });

  test('CP04-055EN Sheffy: with Overflow it equips an Eisdrache (engage an enemy follower, +2/+2)', () => {
    let s = T.game({ p0: { hand: ['CP04-055EN'], maxPP: 7 }, p1: { field: [AP] } });
    const sh = hand0(s)[0], t = s.players[1].field[0];
    s = T.play(s, sh);
    s = T.answer(s, [t]);
    ok(s.cards[t].engaged); eq([T.atk(s, sh), T.def(s, sh)], [4, 4]);
    eq(s.cards[sh].links.map((l) => SV.def(l, s).name), ['Eisdrache']);
    let s2 = T.game({ p0: { hand: ['CP04-055EN'], maxPP: 6 }, p1: { field: [AP] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    ok(!s2.ask); eq(s2.cards[s2.players[0].field[0]].links.length, 0, 'no Overflow: no equipment');
  });

  test('CP04-056EN Sheffy (evolved): On Evolve divides 2 damage over up to 2 followers; On Super-Evolve 3 to each', () => {
    let s = T.game({ p0: { field: ['CP04-055EN'], evoDeck: ['CP04-056EN'] }, p1: { field: [AP, AP, AP] } });
    const [a, b, c] = s.players[1].field;
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.min, 0); eq(s.ask.max, 2);
    s = T.answer(s, [a, b]);
    eq([T.def(s, a), T.def(s, b), T.def(s, c)], [2, 2, 3]);
    let s2 = T.game({ p0: { field: ['CP04-055EN'], evoDeck: ['CP04-056EN'], turnsPassed: 7, sep: 1 }, p1: { field: [GEN, AP] } });
    const [g, a2] = s2.players[1].field;
    s2 = T.act(s2, { type: 'evolve', iid: s2.players[0].field[0] });
    s2 = T.answer(s2, true);
    s2 = T.answer(s2, s2.ask.options.find((o) => o.name === 'On Super-Evolve').id);
    s2 = T.answer(s2, [g]);
    eq(T.def(s2, g), 7, '3 + 2'); eq(T.zone(s2, a2), 'cemetery');
  });

  test('CP04-062EN Until We Meet Again: (1) +1 max PP and +1 defense; (2) at 10 max PP summons a 2-cost PriConne follower', () => {
    let s = T.game({ p0: { hand: ['CP04-062EN'], maxPP: 8 } });
    s = T.play(s, hand0(s)[0]);
    s = T.answer(s, [0]);
    eq(s.players[0].maxPP, 9); eq(s.players[0].defense, 21);
    let s2 = T.game({ p0: { hand: ['CP04-062EN'], deck: [AP, 'CP04-055EN', AP] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    s2 = T.answer(s2, [1]);
    s2 = T.answer(s2, s2.ask.from);
    eq(names(s2, s2.players[0].field), ['Sheffy']);
    let s3 = T.game({ p0: { hand: ['CP04-062EN'], maxPP: 9, deck: ['CP04-055EN'] } });
    s3 = T.play(s3, s3.players[0].hand[0]);
    s3 = T.answer(s3, [1]);
    ok(!s3.ask); eq(s3.players[0].field.length, 0, 'Q2249: below 10 nothing happens');
  });

  test('CP04-T08EN Eisdrache: with no enemy follower to select the ability does nothing', () => {
    let s = T.game({ p0: { hand: ['CP04-055EN'], maxPP: 7 } });
    const sh = hand0(s)[0];
    s = T.play(s, sh);
    eq(s.cards[sh].links.length, 1, 'equipped'); eq([T.atk(s, sh), T.def(s, sh)], [2, 2]);
  });
})();
