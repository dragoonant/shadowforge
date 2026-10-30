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

  // ---------------------------------------------------------------- helpers for the tests below
  const F = (n) => Array(n).fill(AP);
  const NECK = 'PR-409EN';
  const neck = (s, k = 0) => T.findAll(s, 0, NECK).filter((i) => s.cards[i].zone === 'field' && !s.cards[i].engaged)[k];
  const useNeck = (s) => T.act(s, { type: 'activate', iid: neck(s), idx: 0 });
  const ids = (s, list) => list.map((i) => s.cards[i].id);

  // ================================================================ Departed / Wasteland

  test('BP03-076EN Odile, Black Swan: Fanfare deals 2 to each enemy; Necrocharge (20) gives it Storm', () => {
    let s = T.game({ p0: { hand: ['BP03-076EN', 'BP03-076EN'], cemetery: F(20) }, p1: { field: [AP, AP] } });
    const [a, b] = s.players[1].field;
    s = T.play(s, s.players[0].hand[0]);
    eq([T.def(s, a), T.def(s, b), s.players[1].defense], [1, 1, 18]);
    ok(SV.chars(s, s.players[0].field[0]).kw.Storm, 'NC 20: Storm');
    let s2 = T.game({ p0: { hand: ['BP03-076EN'], cemetery: F(19) } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    ok(!SV.chars(s2, s2.players[0].field[0]).kw.Storm, 'NC 19: no Storm');
  });

  test('BP03-076EN Odile, Black Swan: Strike deals 2 to each enemy before combat', () => {
    let s = T.game({ p0: { field: ['BP03-076EN'] }, p1: { field: [AP] } });
    s = T.attack(s, s.players[0].field[0], s.players[1].leader);
    eq(T.def(s, s.players[1].field[0]), 1); eq(s.players[1].defense, 20 - 2 - 6);
  });

  test('BP08-072EN Tartarus: costs 5 less with 15 Departed cards in the cemetery', () => {
    const s = T.game({ p0: { hand: ['BP08-072EN'], cemetery: Array(15).fill('BP09-105EN') } });
    eq(SV.costToPlay(s, s.players[0].hand[0]), 5);
    const s2 = T.game({ p0: { hand: ['BP08-072EN'], cemetery: Array(14).fill('BP09-105EN') } });
    eq(SV.costToPlay(s2, s2.players[0].hand[0]), 10);
  });

  test('BP08-072EN Tartarus: from hand into the EX area, take a Departed card from the top 2, bury the rest', () => {
    let s = T.game({ p0: { hand: ['BP08-072EN'], deck: ['BP09-105EN', AP, AP] } });
    const t = s.players[0].hand[0], top = s.players[0].deck.slice(0, 2);
    s = T.act(s, { type: 'activate', iid: t, idx: 0 });
    eq(s.ask.from, [top[0]]); eq(s.ask.seen, top);
    s = T.answer(s, [top[0]]);
    eq(T.zone(s, t), 'ex'); eq(T.zone(s, top[0]), 'hand'); eq(T.zone(s, top[1]), 'cemetery'); eq(s.players[0].pp, 9);
  });

  test('BP08-073EN Tartarus (evolved): On Evolve summons a Departed follower from the cemetery', () => {
    let s = T.game({ p0: { field: ['BP08-072EN'], evoDeck: ['BP08-073EN'], cemetery: ['BP09-091EN', AP] } });
    const arcus = T.find(s, 0, 'BP09-091EN');
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.from, [arcus], 'only the Departed follower');
    s = T.answer(s, [arcus]);
    eq(T.zone(s, arcus), 'field');
  });

  test('BP09-091EN Arcus: can\'t attack; Necrocharge (10) Ghost at the start of the main phase', () => {
    let s = T.game({ p0: { field: ['BP09-091EN'], cemetery: F(10) }, p1: { field: [{ id: AP, engaged: true }] } });
    ok(!T.legal(s, { type: 'attack', iid: s.players[0].field[0] }), 'no attack on leader or follower');
    s = T.endTurn(s); s = T.endTurn(s);
    eq(ids(s, s.players[0].field), ['BP09-091EN', 'BP09-T15EN']);
  });

  test('BP09-091EN Arcus: bury another follower, choose one (2 Ghosts); once per turn', () => {
    let s = T.game({ p0: { field: ['BP09-091EN', AP, AP] } });
    const [arcus, ap] = s.players[0].field;
    s = T.act(s, { type: 'activate', iid: arcus, idx: 0 });
    s = T.answer(s, [ap]);
    eq(s.ask.kind, 'modes'); s = T.answer(s, [1]);
    eq(T.zone(s, ap), 'cemetery'); eq(s.players[0].field.filter((i) => s.cards[i].id === 'BP09-T15EN').length, 2);
    ok(!T.legal(s, { type: 'activate', iid: arcus, idx: 0 }), 'once per turn');
  });

  test('BP09-105EN Poltergeist: buries the top 2 cards of your deck', () => {
    let s = T.game({ p0: { hand: ['BP09-105EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].cemetery.length, 3); eq(s.players[0].deck.length, 13);
  });

  test('BP09-T15EN Ghost: banished at the start of your end phase', () => {
    let s = T.game({ p0: { field: ['BP09-T15EN'] }, p1: { field: ['BP09-T15EN'] } });
    const [g0, g1] = [s.players[0].field[0], s.players[1].field[0]];
    s = T.endTurn(s);
    eq(T.zone(s, g0), 'gone', 'a banished token ceases to exist'); eq(T.zone(s, g1), 'field', 'not on the opponent\'s end phase');
  });

  test('BP11-069EN Iceschillendrig: Fanfare summons a Magitrain only if there is none', () => {
    let s = T.game({ p0: { hand: ['BP11-069EN', 'BP11-069EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.play(s, s.players[0].hand[0]);
    eq(ids(s, s.players[0].field).filter((i) => i === 'BP11-T02EN').length, 1);
  });

  test('BP11-069EN Iceschillendrig: becoming engaged (attacking) makes the opponent discard', () => {
    let s = T.game({ p0: { field: ['BP11-069EN'] }, p1: { hand: [AP, AP] } });
    s = T.act(s, { type: 'attack', iid: s.players[0].field[0], target: s.players[1].leader });
    eq(s.ask.who, 1, 'the opponent chooses the discard');
    const h = s.players[1].hand[0];
    s = T.answer(s, [h]);
    eq(T.zone(s, h), 'cemetery'); eq(s.players[1].hand.length, 1);
  });

  test('BP11-070EN Iceschillendrig (evolved): discard to take 2 followers back; the discard engages an enemy', () => {
    let s = T.game({ p0: { field: ['BP11-069EN'], evoDeck: ['BP11-070EN'], hand: ['BP09-105EN'], cemetery: [AP, AP] }, p1: { field: [AP] } });
    const cem = s.players[0].cemetery.slice(), h = s.players[0].hand[0], e = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.kind, 'yesno'); s = T.answer(s, true);
    s = T.answer(s, cem); // Q1524 selected before the cost
    s = T.answer(s, [h]);
    eq(T.zone(s, h), 'cemetery'); eq(cem.map((i) => T.zone(s, i)), ['hand', 'hand']);
    s = T.answer(s, [e]); // the discard trigger
    eq(s.cards[e].engaged, true);
  });

  test('BP11-071EN Illganeau: Necrocharge (10) summons a Wasteland follower and banishes itself', () => {
    let s = T.game({ p0: { hand: ['BP11-071EN'], cemetery: ['BP11-076EN', ...F(9)] } });
    const ill = s.players[0].hand[0], w = T.find(s, 0, 'BP11-076EN');
    s = T.play(s, ill);
    eq(s.ask.from, [w]); s = T.answer(s, [w]);
    s = T.answer(s, true);
    eq(T.zone(s, w), 'field'); eq(T.zone(s, ill), 'banished');
  });

  test('BP11-071EN Illganeau: Last Words puts it into the EX area and buries the top card', () => {
    let s = T.game({ p0: { field: ['BP11-071EN'], hand: ['BP01-116EN'] } });
    const ill = s.players[0].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [ill]);
    eq(T.zone(s, ill), 'ex'); eq(s.players[0].deck.length, 15 - 2 - 1);
  });

  test('BP11-076EN Wretch: can evolve only when put onto the field from the cemetery; Last Words', () => {
    let s = T.game({ p0: { field: ['BP11-076EN'], evoDeck: ['BP11-077EN'] } });
    ok(!T.legal(s, { type: 'evolve', iid: s.players[0].field[0] }), 'played/placed normally: no evolve');
    s = T.game({ p0: { hand: ['BP11-079EN', 'BP01-116EN'], evoDeck: ['BP11-077EN'], cemetery: ['BP11-076EN', 'BP11-076EN', ...F(8)] } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, T.findAll(s, 0, 'BP11-076EN'));
    const w = s.players[0].field[0];
    ok(T.legal(s, { type: 'evolve', iid: w }), 'summoned from the cemetery: evolve allowed');
    s = T.play(s, T.find(s, 0, 'BP01-116EN', 'hand'));
    s = T.answer(s, [w]);
    ok(ids(s, s.players[0].field).includes('BP11-T04EN'), 'Bullet Bike'); eq(T.zone(s, w), 'cemetery');
  });

  test('BP11-077EN Wretch (evolved): On Evolve deals 5 to an enemy follower; Last Words', () => {
    let s = T.game({ p0: { hand: ['BP11-079EN'], evoDeck: ['BP11-077EN'], cemetery: ['BP11-076EN', 'BP11-076EN', ...F(8)] }, p1: { field: [AP] } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, T.findAll(s, 0, 'BP11-076EN'));
    const w = s.players[0].field[0], e = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: w });
    s = T.answer(s, [e]);
    eq(T.zone(s, e), 'cemetery');
    ok(SV.chars(s, w).kw.Storm, 'evolved Wretch has Storm');
  });

  test('BP11-T02EN Magitrain: engage followers costing 5+ to Maneuver; Strike destroys an engaged enemy, +2', () => {
    let s = T.game({ p0: { field: ['BP11-T02EN', AP, AP] }, p1: { field: [{ id: AP, engaged: true }] } });
    const [m, a, b] = s.players[0].field, e = s.players[1].field[0];
    ok(!SV.isFollower(s, m));
    s = T.act(s, { type: 'activate', iid: m, idx: 0 });
    s = T.answer(s, [a]); s = T.answer(s, [b]);
    ok(SV.isFollower(s, m), 'maneuvered'); eq([T.atk(s, m), T.def(s, m)], [4, 5]); eq([s.cards[a].engaged, s.cards[b].engaged], [true, true]);
    eq(s.players[0].pp, 9);
    s = T.act(s, { type: 'attack', iid: m, target: s.players[1].leader });
    s = T.answer(s, [e]);
    eq(T.zone(s, e), 'cemetery'); eq(s.players[0].defense, 22);
  });

  test('BP11-T02EN Magitrain: the Maneuver cost needs reserved followers totalling 5', () => {
    const s = T.game({ p0: { field: ['BP11-T02EN', AP, { id: AP, engaged: true }] } });
    ok(!T.legal(s, { type: 'activate', iid: s.players[0].field[0], idx: 0 }));
  });

  test('BP13-076EN Kagero: NC 10 Rush and Bane; Soulstrike into the EX area costs 2 less with NC 20', () => {
    let s = T.game({ p0: { hand: ['BP13-076EN'], cemetery: ['BP13-081EN', ...F(19)] }, p1: { field: [AP] } });
    const k = s.players[0].hand[0], ss = T.find(s, 0, 'BP13-081EN');
    s = T.play(s, k);
    s = T.answer(s, [0]); s = T.answer(s, [ss]);
    eq(T.zone(s, ss), 'ex'); eq(SV.costToPlay(s, ss), 0);
    const c = SV.chars(s, k); ok(c.kw.Rush && c.kw.Bane, 'NC 10: Rush and Bane (19 cards left)');
  });

  test('BP13-077EN Chris: Necrocharge (10) summons an abysscraft follower from the cemetery with Ward', () => {
    let s = T.game({ p0: { hand: ['BP13-077EN'], cemetery: ['BP09-091EN', ...F(9)] } });
    const arcus = T.find(s, 0, 'BP09-091EN');
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.from, [arcus], 'forestcraft fillers are not candidates');
    s = T.answer(s, [arcus]);
    eq(T.zone(s, arcus), 'field'); ok(SV.chars(s, arcus).kw.Ward);
  });

  test('BP13-081EN Soulstrike: 4 to an enemy follower; NC 20 also 4 to its leader; needs a target', () => {
    let s = T.game({ p0: { hand: ['BP13-081EN'], cemetery: F(20) }, p1: { field: [AP] } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, s.players[1].field);
    eq(s.players[1].field.length, 0); eq(s.players[1].defense, 16);
    let s3 = T.game({ p0: { hand: ['BP13-081EN'], cemetery: F(19) }, p1: { field: [AP] } });
    s3 = T.play(s3, s3.players[0].hand[0]);
    s3 = T.answer(s3, s3.players[1].field);
    eq(s3.players[1].defense, 20, 'NC 19: no leader damage');
    const s2 = T.game({ p0: { hand: ['BP13-081EN'] } });
    ok(!T.legal(s2, { type: 'play', iid: s2.players[0].hand[0] }));
  });

  test('BP16-077EN Cerberus: Fanfare summons Mimi and Coco, NC 10 gives them Storm; act deals 2', () => {
    let s = T.game({ p0: { hand: ['BP16-077EN'], cemetery: F(10) }, p1: { field: [AP] } });
    s = T.play(s, s.players[0].hand[0]);
    const toks = s.players[0].field.slice(1);
    eq(ids(s, toks), ['BP16-T04EN', 'BP16-T05EN']); ok(toks.every((t) => SV.chars(s, t).kw.Storm));
    let s2 = T.game({ p0: { field: ['BP16-077EN', AP] }, p1: { field: [AP] } });
    const [c, ap] = s2.players[0].field;
    s2 = T.act(s2, { type: 'activate', iid: c, idx: 0 });
    s2 = T.answer(s2, [ap]); s2 = T.answer(s2, s2.players[1].field);
    eq(T.zone(s2, ap), 'cemetery'); eq(T.def(s2, s2.players[1].field[0]), 1); eq(s2.cards[c].engaged, true);
  });

  test('BP16-077EN Cerberus: room for one token, the player picks which (Q1998)', () => {
    let s = T.game({ p0: { hand: ['BP16-077EN'], field: [AP, AP, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.kind, 'mode'); s = T.answer(s, 1);
    eq(ids(s, s.players[0].field).slice(4), ['BP16-T05EN']);
  });

  test('BP16-T04EN Mimi: Last Words deals 2 to an enemy follower and buries the top card', () => {
    let s = T.game({ p0: { field: ['BP16-T04EN'], hand: ['BP01-116EN'] }, p1: { field: [AP] } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [s.players[0].field[0]]);
    s = T.answer(s, s.players[1].field);
    eq(T.def(s, s.players[1].field[0]), 1); eq(s.players[0].deck.length, 15 - 2 - 1);
  });

  test('BP16-T05EN Coco: Last Words gives +2 and buries the top card', () => {
    let s = T.game({ p0: { field: ['BP16-T05EN'], hand: ['BP01-116EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [s.players[0].field[0]]);
    eq(s.players[0].defense, 22); eq(s.players[0].deck.length, 15 - 2 - 1);
  });

  test('BP16-082EN Mukan (evolved): On Evolve summons a Departed follower; a Departed follower entering gives +1', () => {
    let s = T.game({ p0: { field: ['BP16-081EN'], evoDeck: ['BP16-082EN'], cemetery: ['BP09-091EN'] } });
    const arcus = T.find(s, 0, 'BP09-091EN');
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [arcus]);
    eq(T.zone(s, arcus), 'field'); eq(s.players[0].defense, 21);
  });

  test('BP16-082EN Mukan (evolved): On Super-Evolve summons with Assail (both abilities trigger)', () => {
    let s = T.game({ p0: { field: ['BP16-081EN'], evoDeck: ['BP16-082EN'], cemetery: ['BP09-091EN', 'BP09-091EN'], turnsPassed: 8 } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, true); // super-evolve
    eq(s.ask.kind, 'bag');
    s = T.answer(s, s.ask.options.find((o) => o.name === 'On Super-Evolve').id);
    const a = s.ask.from[0];
    s = T.answer(s, [a]);
    ok(SV.chars(s, a).kw.Assail);
    while (s.ask) s = T.answer(s, s.ask.kind === 'bag' ? s.ask.options[0].id : [s.ask.from[0]]);
    eq(s.players[0].field.length, 3); eq(s.players[0].defense, 22);
  });

  // ================================================================ Sanguine

  test('BP05-069EN Valnareik, Omen of Lust: Sanguine Storm; Strike deals X; at 7 defense +2/+2', () => {
    let s = T.game({ p0: { hand: ['BP05-069EN'], field: [NECK], defense: 8 } });
    s = T.play(s, s.players[0].hand[0]);
    const v = T.find(s, 0, 'BP05-069EN');
    ok(!T.legal(s, { type: 'attack', iid: v, target: s.players[1].leader }), 'no Sanguine yet');
    s = useNeck(s);
    ok(SV.chars(s, v).kw.Storm, 'Sanguine: Storm');
    s = T.attack(s, v, s.players[1].leader);
    eq(s.players[1].defense, 20 - 1 - 4, 'X = 1, then +2/+2 at 7 defense');
  });

  test('BP05-078EN Wings of Lust: up to 2 options; an option without a target is disabled', () => {
    let s = T.game({ p0: { hand: ['BP05-078EN'], field: [AP] }, p1: { field: [AP] } });
    const mine = s.players[0].field[0], e = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.max, 2);
    s = T.answer(s, [0, 1]);
    s = T.answer(s, [mine]); s = T.answer(s, [e]);
    ok(SV.chars(s, mine).kw.Rush); eq(T.def(s, e), 1); eq(s.players[0].defense, 18);
    let s2 = T.game({ p0: { hand: ['BP05-078EN'] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.ask.options.map((o) => o.enabled), [false, false, true]);
  });

  test('BP10-080EN Demonium: Sanguine Fanfare +1/+1 Rush Assail; Strike deals its attack (no Drain from it)', () => {
    let s = T.game({ p0: { hand: ['BP10-080EN'], field: [NECK] } });
    s = useNeck(s);
    s = T.play(s, s.players[0].hand[0]);
    const d = T.find(s, 0, 'BP10-080EN'); const c = SV.chars(s, d);
    eq([c.atk, c.def, !!c.kw.Rush, !!c.kw.Assail], [3, 4, true, true]);
    let s2 = T.game({ p0: { field: ['BP10-080EN'] } });
    s2 = T.attack(s2, s2.players[0].field[0], s2.players[1].leader);
    eq(s2.players[1].defense, 16); eq(s2.players[0].defense, 22, 'Drain from the attack only (Q1315)');
  });

  test('BP13-073EN Laura: each loss of defense, choose an option not chosen this turn', () => {
    let s = T.game({ p0: { field: ['BP13-073EN', NECK, NECK] }, p1: { field: [AP] } });
    const l = s.players[0].field[0], e = s.players[1].field[0];
    s = useNeck(s);
    s = T.answer(s, [1]);
    eq([T.atk(s, l), T.def(s, l)], [4, 3]);
    s = useNeck(s);
    eq(s.ask.options.map((o) => o.enabled), [true, false, true]);
    s = T.answer(s, [0]); s = T.answer(s, [e]);
    eq(T.def(s, e), 1, 'lost defense twice this turn: 2 damage');
  });

  test('BP15-076EN Valnareik, Lustful Desire: Fanfare +2/+2 at 7 defense; Sanguine Storm', () => {
    let s = T.game({ p0: { hand: ['BP15-076EN'], field: [NECK], defense: 8 } });
    s = useNeck(s);
    s = T.play(s, s.players[0].hand[0]);
    const v = T.find(s, 0, 'BP15-076EN');
    eq([T.atk(s, v), T.def(s, v)], [4, 4]); ok(SV.chars(s, v).kw.Storm);
  });

  test('BP15-077EN Valnareik (evolved): On Evolve puts a Wings of Desire token into the EX area', () => {
    let s = T.game({ p0: { field: ['BP15-076EN'], evoDeck: ['BP15-077EN'] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [0]);
    eq(ids(s, s.players[0].ex), ['BP15-PR14EN']);
  });

  test('BP15-PR14EN Wings of Desire: the given Strike deals each enemy follower X; 1 damage to your leader', () => {
    let s = T.game({ p0: { ex: ['BP15-PR14EN'], field: [AP, NECK] }, p1: { field: [AP, AP] } });
    const a = s.players[0].field[0];
    s = T.play(s, s.players[0].ex[0]);
    s = T.answer(s, [a]);
    eq(s.players[0].defense, 19);
    s = useNeck(s);
    s = T.attack(s, a, s.players[1].leader);
    eq(s.players[1].field.map((i) => T.def(s, i)), [1, 1], 'lost defense twice this turn');
  });

  test('BP15-PR14EN Wings of Desire: the Strike is not on a different follower and leaves with the card', () => {
    let s = T.game({ p0: { ex: ['BP15-PR14EN'], field: ['BP11-076EN', AP], hand: ['BP01-116EN', 'BP13-077EN'], cemetery: F(10) }, p1: { field: [{ id: AP, engaged: true }, AP] } });
    const [w, b] = s.players[0].field, [e1, e2] = s.players[1].field;
    s = T.play(s, s.players[0].ex[0]);
    s = T.answer(s, [w]);
    s = T.attack(s, b, s.players[1].leader);
    eq(T.def(s, e2), 3, 'the other follower has no Strike');
    s = T.play(s, T.find(s, 0, 'BP01-116EN', 'hand')); s = T.answer(s, [w]); // destroy the Wretch (Last Words: Bullet Bike, bury 2)
    s = T.play(s, T.find(s, 0, 'BP13-077EN', 'hand')); s = T.answer(s, [w]); // Chris brings it back: a new object
    eq(T.zone(s, w), 'field');
    s = T.attack(s, w, e1);
    eq(T.def(s, e2), 3, 'the Strike left with the card (CR 5.27)');
  });

  test('BP17-074EN Urias: Fanfare puts an A Horrible Night token into the EX area', () => {
    let s = T.game({ p0: { hand: ['BP17-074EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(ids(s, s.players[0].ex), ['BP17-T07EN']);
  });

  test('BP17-075EN Urias (evolved): choose up to 3, each option once', () => {
    let s = T.game({ p0: { field: ['BP17-074EN'], evoDeck: ['BP17-075EN'] }, p1: { field: [AP, AP] } });
    const [e1, e2] = s.players[1].field;
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.max, 3);
    s = T.answer(s, [0, 1, 2]);
    s = T.answer(s, [e1]);
    eq(T.zone(s, e1), 'cemetery'); eq(T.def(s, e2), 2); eq(s.players[0].defense, 17); eq(s.players[0].hand.length, 1);
  });

  test('BP17-T07EN A Horrible Night: for the rest of the turn each loss of defense pings and heals; one per turn', () => {
    let s = T.game({ p0: { ex: ['BP17-T07EN', 'BP17-T07EN'], field: [NECK, NECK] } });
    const [h1, h2] = s.players[0].ex;
    s = T.play(s, h1);
    ok(!T.legal(s, { type: 'play', iid: h2 }), 'another A Horrible Night this turn');
    s = useNeck(s);
    eq([s.players[0].defense, s.players[1].defense], [20, 19]);
    s = T.endTurn(s); s = T.endTurn(s);
    s = useNeck(s);
    eq([s.players[0].defense, s.players[1].defense], [19, 19], 'ended with the turn');
    ok(T.legal(s, { type: 'play', iid: h2 }), 'a new turn');
  });

  test('BP19-075EN Garodeth: Fanfare 1 to your leader; evolves itself at the 4th loss of defense', () => {
    let s = T.game({ p0: { hand: ['BP19-075EN'], field: [NECK, NECK, NECK], evoDeck: ['BP19-076EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    const g = T.find(s, 0, 'BP19-075EN');
    eq(s.players[0].defense, 19);
    s = useNeck(s); s = useNeck(s);
    ok(!s.cards[g].evo, '3 losses');
    s = useNeck(s);
    ok(s.cards[g].evo, '4 losses: evolved'); eq(s.ti.evolveUsed[0], false, 'not the evolve ability (Q2379)');
  });

  test('BP19-076EN Garodeth (evolved): On Evolve deals 8 to an enemy follower', () => {
    let s = T.game({ p0: { field: ['BP19-075EN'], evoDeck: ['BP19-076EN'] }, p1: { field: ['BP03-076EN'] } });
    const e = s.players[1].field[0];
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [e]);
    eq(T.zone(s, e), 'cemetery');
  });

  test('BP19-085EN Raging Commander: Garodeth costs 1 less; Fanfare; 4 pings per turn on losing defense', () => {
    let s = T.game({ p0: { hand: ['BP19-085EN', 'BP19-075EN'], field: [NECK, NECK, NECK] }, p1: { field: ['BP03-076EN'] } });
    const gar = s.players[0].hand[1], e = s.players[1].field[0];
    eq(SV.costToPlay(s, gar), 3);
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].defense, 19); eq(s.players[0].hand.length, 2);
    eq(SV.costToPlay(s, gar), 2);
    s = T.answer(s, [e]); // the Fanfare's own leader damage triggers it
    eq(T.def(s, e), 3);
    s = useNeck(s); s = T.answer(s, [e]); s = useNeck(s); s = T.answer(s, [e]); s = useNeck(s); s = T.answer(s, [e]);
    eq(T.zone(s, e), 'cemetery');
  });

  test('BP19-085EN Raging Commander: at most 4 triggers per turn', () => {
    let s = T.game({ p0: { hand: ['BP05-078EN'], field: ['BP19-085EN', NECK, NECK, NECK, NECK] }, p1: { field: ['BP08-072EN'] } });
    for (let k = 0; k < 4; k++) { s = useNeck(s); s = T.answer(s, s.players[1].field); }
    eq(T.def(s, s.players[1].field[0]), 3);
    s = T.play(s, T.find(s, 0, 'BP05-078EN', 'hand'));
    s = T.answer(s, [2]); // the 5th loss of defense this turn
    ok(/discard/.test(s.ask.prompt), 'no 5th trigger: straight to the discard');
    s = T.answer(s, [s.players[0].hand[0]]);
    eq(s.ask, null, 'no 5th trigger after the spell either');
    eq(T.def(s, s.players[1].field[0]), 3); eq(s.players[0].defense, 15);
  });

  test('BP19-086EN Vicious Blitzer: Fanfare 1 to your leader, evolves with a Garodeth on your field', () => {
    let s = T.game({ p0: { hand: ['BP19-086EN', 'BP19-086EN'], field: ['BP19-075EN'], evoDeck: ['BP19-087EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    const b = s.players[0].field[1];
    ok(s.cards[b].evo, 'evolved by its Fanfare'); eq(s.ti.evolveUsed[0], false);
  });

  test('BP19-087EN Vicious Blitzer (evolved): On Evolve deals 1 to each leader', () => {
    let s = T.game({ p0: { field: ['BP19-086EN'], evoDeck: ['BP19-087EN'] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq([s.players[0].defense, s.players[1].defense], [19, 19]);
  });

  test('BP19-089EN Steamrolling Tank: Fanfare 1 to your leader, then +1 (4 per turn)', () => {
    let s = T.game({ p0: { hand: ['BP19-089EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].defense, 20);
    ok(s.log.some((e) => e.type === 'heal' && e.amount === 1), 'healed after the damage');
  });

  test('BP19-090EN Howling Scream: each chosen option asks its 1-point cost; unpaid does nothing (Q2400)', () => {
    let s = T.game({ p0: { hand: ['BP19-090EN'] }, p1: { field: [AP] } });
    const e = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [0, 1]);
    s = T.answer(s, true); s = T.answer(s, [e]);
    s = T.answer(s, false);
    eq(T.def(s, e), 1); eq(s.players[0].defense, 19); eq(s.players[0].pp, 9); eq(s.players[0].hand.length, 0);
  });

  test('BP19-091EN Prison of Pain: Fanfare 2 pain counters and a draw; act removes one, deals 1, buries at 0', () => {
    let s = T.game({ p0: { hand: ['BP19-091EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    const p = s.players[0].field[0];
    eq(s.cards[p].counters.pain, 2); eq(s.players[0].hand.length, 1);
    s = T.act(s, { type: 'activate', iid: p, idx: 0 });
    eq(s.cards[p].counters.pain, 1); eq(s.players[0].defense, 19); eq(T.zone(s, p), 'field');
    let s2 = T.game({ p0: { field: [{ id: 'BP19-091EN', counters: { pain: 1 } }] } });
    s2 = T.act(s2, { type: 'activate', iid: s2.players[0].field[0], idx: 0 });
    eq(T.zone(s2, s2.players[0].cemetery[0]), 'cemetery'); eq(s2.players[0].field.length, 0);
  });

  test('PR-409EN Sanguine Necklace: engage, bury this: 1 to your leader, draw', () => {
    let s = T.game({ p0: { field: [NECK] } });
    const n = s.players[0].field[0];
    s = T.act(s, { type: 'activate', iid: n, idx: 0 });
    eq(T.zone(s, n), 'cemetery'); eq(s.players[0].defense, 19); eq(s.players[0].hand.length, 1); ok(SV.sanguine(s, 0));
  });

  // ================================================================ Omen / Entwining

  test('BP10-074EN Milteo: discard, reveal until 2 followers costing 3 or less, summon them, rest to the bottom', () => {
    let s = T.game({ p0: { hand: ['BP10-074EN', AP], deck: ['BP09-105EN', AP, 'BP09-105EN', AP, AP] } });
    const [m, h] = s.players[0].hand;
    s = T.play(s, m);
    s = T.answer(s, [h]);
    eq(T.zone(s, h), 'cemetery'); eq(s.players[0].field.length, 3);
    eq(ids(s, s.players[0].deck), [AP, 'BP09-105EN', 'BP09-105EN']);
  });

  test('BP10-074EN Milteo: Necrocharge (20) evolves it at the start of your end phase', () => {
    let s = T.game({ p0: { field: ['BP10-074EN'], evoDeck: ['BP10-075EN'], cemetery: F(20) }, p1: { field: [AP] } });
    const m = s.players[0].field[0];
    s = T.act(s, { type: 'end' });
    ok(s.cards[m].evo, 'evolved'); eq(s.ask.kind, 'yesno', 'its On Evolve asks for the [cost02]');
    s = T.answer(s, false);
    eq(s.players[1].field.length, 1);
  });

  test('BP10-075EN Milteo (evolved): pay 2: destroy each enemy follower, enemy leader to 6', () => {
    // Milteo has no evolve ability: it evolves through its end-phase Necrocharge (20).
    let s = T.game({ p0: { field: ['BP10-074EN'], evoDeck: ['BP10-075EN'], cemetery: F(20), pp: 2 }, p1: { field: [AP, AP] } });
    let s2 = s;
    s = T.act(s, { type: 'end' });
    s = T.answer(s, true);
    eq(s.players[1].field.length, 0); eq(s.players[1].defense, 6); eq(s.players[0].pp, 0);
    s2.players[1].defense = 4;
    s2 = T.act(s2, { type: 'end' });
    s2 = T.answer(s2, true);
    eq(s2.players[1].defense, 6, 'Q1304: raised to 6 too');
  });

  test('BP20-075EN Rulenye & Valnareik (evolved): Storm and +1 attack to each abysscraft Omen follower', () => {
    let s = T.game({ p0: { field: ['BP20-074EN', 'BP15-076EN', AP], evoDeck: ['BP20-075EN'] } });
    const [r, v, ap] = s.players[0].field;
    s = T.act(s, { type: 'evolve', iid: r });
    s = T.answer(s, [1]);
    ok(SV.chars(s, r).kw.Storm); eq([T.atk(s, r), T.atk(s, v), T.atk(s, ap)], [4, 3, 3], 'forestcraft Omen not included');
  });

  test('BP20-077EN Sham-Nacha (evolved): On Evolve puts the crest into the EX area', () => {
    let s = T.game({ p0: { field: ['BP20-076EN'], evoDeck: ['BP20-077EN'] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(ids(s, s.players[0].ex), ['BP20-T06EN']);
  });

  test('BP20-077EN Sham-Nacha (evolved): On Super-Evolve summons an abysscraft Omen follower and may evolve it', () => {
    let s = T.game({ p0: { field: ['BP20-076EN'], evoDeck: ['BP20-077EN', 'BP20-075EN'], cemetery: ['BP20-074EN', AP], turnsPassed: 8 } });
    const r = T.find(s, 0, 'BP20-074EN');
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, true);
    s = T.answer(s, s.ask.options.find((o) => o.name === 'On Super-Evolve').id);
    eq(s.ask.from, [r]); s = T.answer(s, [r]);
    s = T.answer(s, true); // evolve it (Q2432 optional)
    ok(s.cards[r].evo, 'evolved for free');
    eq(s.ask.kind, 'bag', "Rulenye's On Evolve and Sham-Nacha's On Evolve are both pending");
    s = T.answer(s, s.ask.options.find((o) => o.src === r).id);
    s = T.answer(s, [0]); // Rulenye's On Evolve: summon 2 tokens
    eq(s.players[0].field.length, 4);
    eq(ids(s, s.players[0].ex), ['BP20-T06EN'], 'the crest from the other On Evolve');
  });

  test('BP20-T06EN Crest: Sham-Nacha: a "Choose 1" becomes "choose any number"', () => {
    let s = T.game({ p0: { hand: ['BP20-081EN'], ex: ['BP20-T06EN'] }, p1: { field: [AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.max, 2);
    s = T.answer(s, [0, 1]);
    eq(s.players[1].field.length, 0, 'option 1 too'); eq(s.players[0].defense, 24);
  });

  test('BP20-080EN Congregant of Entwining (evolved): choose 1 — summon an abysscraft Omen follower costing 3 or less', () => {
    let s = T.game({ p0: { field: ['BP20-079EN'], evoDeck: ['BP20-080EN'], cemetery: ['BP20-079EN', 'BP15-076EN', AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.options.map((o) => o.enabled), [false, true, true]);
    s = T.answer(s, [1]);
    eq(s.ask.from, [T.find(s, 0, 'BP15-076EN')]);
    s = T.answer(s, s.ask.from);
    eq(s.players[0].field.length, 2);
  });

  test('BP20-081EN Hervör: choose 1 — +4 defense and draw 2', () => {
    let s = T.game({ p0: { hand: ['BP20-081EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.max, 1);
    s = T.answer(s, [1]);
    eq(s.players[0].defense, 24); eq(s.players[0].hand.length, 2);
  });

  test('BP20-082EN Screaming and Loathing: choose 1 — recover a play point; no enemy disables option 1', () => {
    let s = T.game({ p0: { hand: ['BP20-082EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.options.map((o) => o.enabled), [false, true, true, true]);
    s = T.answer(s, [3]);
    eq(s.players[0].pp, 9);
  });

  test('BP20-085EN Supplicant of Entwining: choose 1 — 2 damage to the enemy leader', () => {
    let s = T.game({ p0: { hand: ['BP20-085EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [1]);
    eq(s.players[1].defense, 18);
  });

  test('BP20-086EN Castle of Entwining: Fanfare takes an abysscraft Omen card from the top 3; act gives Assail', () => {
    let s = T.game({ p0: { hand: ['BP20-086EN'], deck: [AP, 'BP20-085EN', AP, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    const sup = T.find(s, 0, 'BP20-085EN');
    eq(s.ask.from, [sup], 'forestcraft Omen is not abysscraft'); s = T.answer(s, [sup]);
    s = T.answer(s, s.ask.from);
    eq(T.zone(s, sup), 'hand');
    let s2 = T.game({ p0: { field: ['BP20-086EN', AP] } });
    const [c, a] = s2.players[0].field;
    s2 = T.act(s2, { type: 'activate', iid: c, idx: 0 });
    s2 = T.answer(s2, [1]); s2 = T.answer(s2, [a]);
    ok(SV.chars(s2, a).kw.Assail); eq(T.zone(s2, c), 'cemetery'); eq(s2.players[0].pp, 9);
  });

  test('BP20-089EN Devotee of Entwining: choose 1 — 1 damage to the enemy leader and each enemy follower', () => {
    let s = T.game({ p0: { hand: ['BP20-089EN'] }, p1: { field: [AP] } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [1]);
    eq(s.players[1].defense, 19); eq(T.def(s, s.players[1].field[0]), 2);
  });
})();
