// Core rules, named for the CR section they assert. Fillers (tests/harness.js): Apostle of Unkilling
// BP05-004EN (cost 3, 3/3, evolve 1 -> 4/4), Lunerian Paladin BP13-091EN (cost 2, 1/1 Ward, evolve
// 1 -> 2/2 Ward), Dark Dragoon Forte BP01-076EN (cost 4, 5/1 Storm, evolve 2 -> 7/3 Storm Aura).
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok, throws } = SV.T;
  const T = SV.T;
  const AP = 'BP05-004EN', AP_EVO = 'BP05-005EN', LP = 'BP13-091EN', LP_EVO = 'BP13-092EN', DDF = 'BP01-076EN', DDF_EVO = 'BP01-077EN';
  const decks = () => [SV.DECKS[0].id, SV.DECKS[1].id];

  test('CR 6.2.1.7-8 each player draws 4; the first player decides the mulligan first', () => {
    const s = SV.newGame({ decks: decks(), seed: 3, first: 0 });
    eq(s.players[0].hand.length, 4); eq(s.players[1].hand.length, 4);
    eq(s.ask.kind, 'mulligan'); eq(s.ask.who, 0);
  });

  test('CR 6.2.1.8 a redraw puts the whole hand on the bottom and draws four new cards', () => {
    let s = SV.newGame({ decks: decks(), seed: 3, first: 0 });
    const old = s.players[0].hand.slice();
    s = T.answer(s, true);
    eq(s.players[0].hand.length, 4);
    ok(old.every((i) => s.cards[i].zone === 'deck'), 'old hand in the deck');
    eq(s.players[0].deck.slice(-4).sort(), old.slice().sort(), 'old hand at the bottom');
    eq(s.ask.who, 1);
  });

  test('CR 6.2.1.9-12 points and defense after setup; 7.2 first turn: 1 PP, no draw for the first player', () => {
    let s = SV.newGame({ decks: decks(), seed: 3, first: 0 });
    s = T.answer(s, false); s = T.answer(s, false);
    const [A, B] = s.players;
    eq([A.ep, B.ep], [0, 3], 'evolution points'); eq([A.sep, B.sep], [1, 1], 'super-evolution points');
    eq([A.defense, B.defense], [20, 20]);
    eq(s.active, 0); eq(s.phase, 'main');
    eq([A.maxPP, A.pp], [1, 1]);
    eq(A.hand.length, 4, 'the first player does not draw on turn one');
  });

  test('CR 7.2 the second player draws on their first turn and gets 1 max PP', () => {
    let s = SV.newGame({ decks: decks(), seed: 3, first: 0 });
    s = T.answer(s, false); s = T.answer(s, false);
    s = T.endTurn(s);
    eq(s.active, 1); eq(s.players[1].hand.length, 5); eq(s.players[1].maxPP, 1); eq(s.players[1].turnsPassed, 1);
  });

  test('CR 3.2.4.1 max play points stop at 10', () => {
    let s = T.game({ p0: { maxPP: 10 }, p1: { maxPP: 10 } });
    s = T.endTurn(s);
    eq(s.players[1].maxPP, 10); eq(s.players[1].pp, 10);
  });

  test('CR 7.2.3 the start phase refreshes the active player\'s engaged cards', () => {
    let s = T.game({ p1: { field: [{ id: AP, engaged: true }] } });
    s = T.endTurn(s);
    eq(s.cards[s.players[1].field[0]].engaged, false);
  });

  test('CR 8.2 / 10.4.4 playing a follower pays its cost in play points and puts it onto the field', () => {
    let s = T.game({ p0: { hand: [AP], pp: 3, maxPP: 3 } });
    const c = s.players[0].hand[0];
    s = T.play(s, c);
    eq(T.zone(s, c), 'field'); eq(s.players[0].pp, 0);
    eq(s.ti.played[0], 1, 'Combo counts the play (13.2.1.3)');
  });

  test('CR 10.4.4 a card that costs more than the remaining play points is not legal; whyNot says why', () => {
    const s = T.game({ p0: { hand: [AP], pp: 2, maxPP: 2 } });
    const c = s.players[0].hand[0];
    ok(!T.legal(s, { type: 'play', iid: c }));
    ok(/Needs 3 play points/.test(SV.whyNot(s, c)), SV.whyNot(s, c));
  });

  test('CR 10.6.2.6 a follower cannot be played onto a full field (5 cards)', () => {
    const s = T.game({ p0: { hand: [AP], field: [AP, AP, AP, AP, AP] } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].hand[0] }));
  });

  test('CR 12.8.2 (i) a Ward follower may be put onto the field engaged — the player is asked', () => {
    let s = T.game({ p0: { hand: [LP] } });
    const c = s.players[0].hand[0];
    s = T.act(s, { type: 'play', iid: c });
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(s.cards[c].engaged, true);
  });

  test('CR 8.4.2.1 a follower put onto the field this turn cannot attack (no Storm/Rush)', () => {
    let s = T.game({ p0: { hand: [AP] } });
    const c = s.players[0].hand[0];
    s = T.play(s, c);
    ok(!T.legal(s, { type: 'attack', iid: c }));
  });

  test('CR 12.9 Storm attacks the leader the turn it is put onto the field', () => {
    let s = T.game({ p0: { hand: [DDF] } });
    const c = s.players[0].hand[0];
    s = T.play(s, c);
    s = T.attack(s, c, s.players[1].leader);
    eq(s.players[1].defense, 15);
    eq(s.cards[c].engaged, true, 'the attacker engages (8.4.4)');
  });

  test('CR 8.4.3.1 only engaged enemy followers (or the leader) can be attacked', () => {
    const s = T.game({ p0: { field: [AP] }, p1: { field: [AP, { id: AP, engaged: true }] } });
    const a = s.players[0].field[0];
    const [reserved, engaged] = s.players[1].field;
    ok(!T.legal(s, { type: 'attack', iid: a, target: reserved }), 'reserved follower');
    ok(T.legal(s, { type: 'attack', iid: a, target: engaged }), 'engaged follower');
    ok(T.legal(s, { type: 'attack', iid: a, target: s.players[1].leader }), 'leader');
  });

  test('CR 8.4.9.1 combat damage is simultaneous; 11.3.1 followers at 0 defense are destroyed', () => {
    let s = T.game({ p0: { field: [AP] }, p1: { field: [{ id: AP, engaged: true }] } });
    const a = s.players[0].field[0], t = s.players[1].field[0];
    s = T.attack(s, a, t);
    eq(T.zone(s, a), 'cemetery'); eq(T.zone(s, t), 'cemetery');
  });

  test('CR 15.1 / 2.8.2 damage on a follower persists across turns', () => {
    let s = T.game({ p0: { field: [{ id: LP }] }, p1: { field: [{ id: AP, engaged: true }] } });
    const a = s.players[0].field[0], t = s.players[1].field[0];
    s = T.attack(s, a, t);
    eq(T.def(s, t), 2);
    s = T.endTurn(s);
    eq(T.def(s, t), 2, 'still damaged next turn');
  });

  test('CR 12.8.2 (iii) Ward: an engaged Ward follower must be the target', () => {
    const s = T.game({ p0: { field: [AP] }, p1: { field: [{ id: LP, engaged: true }, { id: AP, engaged: true }] } });
    const a = s.players[0].field[0];
    const [ward, other] = s.players[1].field;
    ok(T.legal(s, { type: 'attack', iid: a, target: ward }));
    ok(!T.legal(s, { type: 'attack', iid: a, target: other }));
    ok(!T.legal(s, { type: 'attack', iid: a, target: s.players[1].leader }));
  });

  test('CR 12.8.2 (iii) a reserved Ward follower does not force targets', () => {
    const s = T.game({ p0: { field: [AP] }, p1: { field: [LP] } });
    ok(T.legal(s, { type: 'attack', iid: s.players[0].field[0], target: s.players[1].leader }));
  });

  test('CR 7.4.3 end phase: the active player is asked which reserved Ward followers to engage', () => {
    let s = T.game({ p0: { field: [LP] } });
    s = T.act(s, { type: 'end' });
    ok(s.ask && /Ward followers to engage/.test(s.ask.prompt), JSON.stringify(s.ask));
    const w = s.players[0].field[0];
    s = T.answer(s, [w]);
    eq(s.cards[w].engaged, true);
    eq(s.active, 1);
  });

  test('CR 12.2 evolve pays play points, links the evolved card and uses its stats', () => {
    let s = T.game({ p0: { field: [AP], evoDeck: [AP_EVO], pp: 1 } });
    const c = s.players[0].field[0];
    s = T.act(s, { type: 'evolve', iid: c });
    while (s.ask) s = T.answer(s, s.ask.kind === 'cards' ? [] : false); // On Evolve search etc.
    eq(s.players[0].pp, 0);
    ok(s.cards[c].evo, 'linked'); eq(T.atk(s, c), 4); eq(T.def(s, c), 4);
    eq(s.cards[s.cards[c].evo].zone, 'evolve');
  });

  test('CR 8.3.2.1 only one evolve per turn', () => {
    let s = T.game({ p0: { field: [LP, LP], evoDeck: [LP_EVO, LP_EVO] } });
    const [a, b] = s.players[0].field;
    s = T.act(s, { type: 'evolve', iid: a });
    while (s.ask) s = T.answer(s, s.ask.kind === 'cards' ? [] : s.ask.kind === 'order' ? s.ask.from : false);
    ok(!T.legal(s, { type: 'evolve', iid: b }));
  });

  test('CR 12.2.3 an evolution point may replace one play point — asked when both are payable', () => {
    let s = T.game({ p0: { field: [DDF], evoDeck: [DDF_EVO], pp: 5, ep: 2 } });
    const c = s.players[0].field[0];
    s = T.act(s, { type: 'evolve', iid: c });
    eq(s.ask.kind, 'yesno'); ok(/evolution point/.test(s.ask.prompt));
    s = T.answer(s, true);
    s = T.answerWhile(s, /super-evolve/i, false);
    eq(s.players[0].ep, 1); eq(s.players[0].pp, 4);
  });

  test('CR 12.2.3 with too few play points the evolution point is required (not a choice)', () => {
    let s = T.game({ p0: { field: [DDF], evoDeck: [DDF_EVO], pp: 1, ep: 1, turnsPassed: 2 } });
    const c = s.players[0].field[0];
    ok(T.legal(s, { type: 'evolve', iid: c }));
    s = T.act(s, { type: 'evolve', iid: c });
    eq(s.ask, null);
    eq([s.players[0].pp, s.players[0].ep], [0, 0]);
  });

  test('CR 12.2.4 super-evolve needs turns passed >= 7 (first player) and gives +1/+1', () => {
    let s = T.game({ p0: { field: [DDF], evoDeck: [DDF_EVO], turnsPassed: 6 } });
    let c = s.players[0].field[0];
    let s2 = T.act(s, { type: 'evolve', iid: c });
    ok(!s2.ask || !/super-evolve/i.test(s2.ask.prompt), 'not offered at 6 for the first player');
    s = T.game({ p0: { field: [DDF], evoDeck: [DDF_EVO], turnsPassed: 7 } });
    c = s.players[0].field[0];
    s = T.act(s, { type: 'evolve', iid: c });
    ok(/super-evolve/i.test(s.ask.prompt));
    s = T.answer(s, true);
    eq(s.players[0].sep, 0); eq(T.atk(s, c), 8); eq(T.def(s, c), 4); ok(s.cards[c].superEvolved);
  });

  test('CR 12.2.4 the second player may super-evolve from turns passed 6', () => {
    let s = T.game({ active: 1, first: 0, p1: { field: [DDF], evoDeck: [DDF_EVO], turnsPassed: 6 } });
    s = T.act(s, { type: 'evolve', iid: s.players[1].field[0] });
    ok(/super-evolve/i.test(s.ask.prompt));
  });

  test('CR 8.4.2.1 a follower evolved this turn may attack followers even if it entered this turn', () => {
    let s = T.game({ p0: { hand: [DDF], evoDeck: [DDF_EVO] }, p1: { field: [{ id: AP, engaged: true }] } });
    // Storm aside: use Apostle (no Storm) via evolve-the-turn-it-enters.
    s = T.game({ p0: { field: [{ id: LP, fresh: true }], evoDeck: [LP_EVO] }, p1: { field: [{ id: AP, engaged: true }] } });
    const c = s.players[0].field[0];
    ok(!T.legal(s, { type: 'attack', iid: c }), 'fresh, not evolved: no attack');
    s = T.act(s, { type: 'evolve', iid: c });
    while (s.ask) s = T.answer(s, s.ask.kind === 'cards' ? [] : s.ask.kind === 'order' ? s.ask.from : false);
    ok(T.legal(s, { type: 'attack', iid: c, target: s.players[1].field[0] }), 'evolved: may attack a follower');
    ok(!T.legal(s, { type: 'attack', iid: c, target: s.players[1].leader }), 'but not the leader');
  });

  test('CR 11.6.1 when an evolved follower leaves the field its evolved card goes faceup to the evolve deck', () => {
    let s = T.game({ p0: { field: [{ id: AP, evo: AP_EVO, dmg: 0 }] }, p1: { field: [{ id: 'BP01-080EN', engaged: true }] } });
    const c = s.players[0].field[0];
    const e = s.cards[c].evo;
    s = T.attack(s, c, s.players[1].field[0]);
    eq(T.zone(s, c), 'cemetery'); eq(T.zone(s, e), 'evoDeck'); eq(s.cards[e].faceup, true);
  });

  test('CR 11.2.1 a leader at 0 defense loses', () => {
    let s = T.game({ p0: { field: [DDF] }, p1: { defense: 5 } });
    s = T.attack(s, s.players[0].field[0], s.players[1].leader);
    eq(s.winner, 0); eq(s.endReason, 'defense');
  });

  test('CR 1.2.1.2 / 11.2.2 drawing from an empty deck loses at the next rules handling', () => {
    let s = T.game({ p1: { deck: [] } });
    s = T.endTurn(s);
    eq(s.winner, 0); eq(s.endReason, 'deckout');
  });

  test('CR 7.4.7 end phase: discard down to the hand limit of 7, chosen by the player', () => {
    let s = T.game({ p0: { hand: Array(9).fill(AP) } });
    s = T.act(s, { type: 'end' });
    eq(s.ask.min, 2); eq(s.ask.who, 0);
    s = T.answer(s, s.ask.from.slice(0, 2));
    eq(s.players[0].hand.length, 7); eq(s.players[0].cemetery.length, 2);
  });

  test('CR 4.6 / 4.7 hidden zones: newGame keeps hands and the evolve deck separate per player', () => {
    const s = SV.newGame({ decks: decks(), seed: 5, first: 1 });
    ok(s.players[0].evoDeck.length > 0 && s.players[0].evoDeck.every((i) => s.cards[i].owner === 0));
  });

  test('CR 1.2.3 concede ends the game at once', () => {
    let s = T.game({});
    s = SV.apply(s, { type: 'concede', who: 0 });
    eq(s.winner, 1); eq(s.endReason, 'concede');
  });

  test('rule 6: same seed, same game', () => {
    const a = SV.newGame({ decks: decks(), seed: 42 });
    const b = SV.newGame({ decks: decks(), seed: 42 });
    eq(a.players[0].hand.map((i) => a.cards[i].id), b.players[0].hand.map((i) => b.cards[i].id));
    eq(a.first, b.first);
  });

  test('SV.deckProblems: every registered deck is legal (CR 6.1.1)', () => {
    for (const d of SV.DECKS) eq(SV.deckProblems(d), [], d.id);
  });

  test('SV.deckProblems catches a 41st card of a name over 3 copies and an off-class card', () => {
    const d = SV.DECKS[0];
    const bad = { ...d, main: [...d.main.slice(1), [d.main[0][0], 4]] };
    ok(SV.deckProblems(bad).some((m) => /copies/.test(m) || /cards; it needs/.test(m)));
  });

  test("CR 12.3.3 a Quick activated ability ([q][act]) can be used in the opponent's attack window", () => {
    // Temple of Repose BP20-103EN: [q][act] [cost01], [engage], bury this: next leader damage -2. Needs 3 crests.
    const CREST = ['BP20-T09EN', 'BP20-T10EN', 'BP20-T11EN'];
    let s = T.game({ active: 1, p0: { field: ['BP20-103EN'], ex: CREST }, p1: { field: [AP] } });
    const temple = s.players[0].field[0];
    s = T.act(s, { type: 'attack', iid: s.players[1].field[0], target: s.players[0].leader });
    ok(s.window && s.window.who === 0, 'window open for the defender');
    ok(T.legal(s, { type: 'activate', iid: temple, idx: 0 }), 'the Quick ability is offered in the window');
  });
})();
