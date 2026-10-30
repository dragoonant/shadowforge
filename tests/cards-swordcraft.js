// Swordcraft card behaviour tests (see tests/cards-abysscraft.js for the conventions).
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok } = SV.T;
  const T = SV.T;
  const AP = T.FILLER;
  const MK = 'BP16-081EN'; // Mukan, Shadowcrypt Ward 3/3/3
  const BIG = 'BP01-080EN'; // Genesis Dragon 10/12
  const SCOUT = 'BP19-030EN'; // Deep-Sea Scout, Condemned/Thief 2/2
  const LUPIN = 'BP15-024EN'; // Arsène Lupin, Officer/Thief 2/1
  const UH = 'BP15-026EN'; // Ultimate Hollow, Loot spell, cost 1, Quick
  const RS = 'BP20-026EN'; // Returning Slash, Loot spell, cost 2
  const FLAG = 'BP19-T01EN';
  const ten = () => Array(10).fill(AP);
  const names = (s, list) => list.map((i) => SV.CARDS[s.cards[i].id].name);
  const auto = (s) => {
    for (let g = 0; s.ask && g < 50; g++) {
      const a = s.ask;
      let v;
      if (a.kind === 'bag') v = a.options[0].id;
      else if (a.kind === 'cards') v = a.from.slice(0, Math.max(a.min, Math.min(1, a.max)));
      else if (a.kind === 'order') v = a.from.slice();
      else if (a.kind === 'modes') v = [a.options.findIndex((o) => o.enabled !== false)];
      else if (a.kind === 'number') v = a.min;
      else v = false;
      s = T.answer(s, v);
    }
    return s;
  };

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

  test("BP05-029EN Servant of Usurpation: Fanfare mills the opponent's top card; each card milled from their deck in your turn gives +1 attack", () => {
    let s = T.game({ p0: { hand: ['BP05-029EN', LUPIN] }, p1: { deck: [MK, AP, AP] } });
    const top = s.players[1].deck[0], sv = T.find(s, 0, 'BP05-029EN');
    s = T.play(s, sv);
    eq(T.zone(s, top), 'cemetery'); eq(s.players[1].deck.length, 2);
    eq(T.atk(s, sv), 2, 'its own Fanfare milled 1');
    s = T.play(s, T.find(s, 0, LUPIN));
    eq(T.atk(s, sv), 3, "Arsène Lupin's bury counts too");
    let s2 = T.game({ p0: { hand: ['BP05-029EN'] }, p1: { deck: [] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.winner, null, 'Q663: an empty deck is not a loss');
    eq(T.atk(s2, s2.players[0].field[0]), 1);
  });

  test('BP05-034EN Avaritia: looks at 4 and may take a Thief card', () => {
    let s = T.game({ p0: { hand: ['BP05-034EN'], deck: [MK, LUPIN, MK, MK, MK] } });
    const av = s.players[0].hand[0];
    s = T.play(s, av);
    eq(s.ask.seen.length, 4); eq(names(s, s.ask.from), ['Arsène Lupin']);
    s = auto(T.answer(s, s.ask.from));
    eq(names(s, s.players[0].hand), ['Arsène Lupin']); eq(T.zone(s, av), 'cemetery', 'no Octrice revealed: not returned');
    eq(s.players[0].deck.length, 4);
  });

  test('BP07-034EN Elegance in Action: engages and draws; when discarded (hand limit, Q986) it engages an enemy follower', () => {
    let s = T.game({ p0: { hand: ['BP07-034EN'] }, p1: { field: [MK] } });
    const t = s.players[1].field[0];
    s = T.answer(T.play(s, s.players[0].hand[0]), [t]);
    ok(s.cards[t].engaged); eq(s.players[0].hand.length, 1);
    let s2 = T.game({ p0: { hand: ['BP07-034EN', AP, AP, AP, AP, AP, AP, AP] }, p1: { field: [MK] } });
    const e = T.find(s2, 0, 'BP07-034EN'), t2 = s2.players[1].field[0];
    s2 = T.act(s2, { type: 'end' });
    eq(s2.ask.min, 1, 'hand limit: discard 1');
    s2 = T.answer(s2, [e]);
    eq(s2.ask.from, [t2], 'its discard ability selects an enemy follower');
    s2 = T.answer(s2, [t2]);
    ok(s2.log.some((l) => l.type === 'engage' && l.iid === t2 && l.via === e), 'engaged (it refreshes again in its own start phase right after)');
  });

  test('BP09-020EN Spartacus: start of end phase discards any number, draws that many +1, wins at 1 card or less in the deck', () => {
    let s = T.game({ p0: { field: ['BP09-020EN'], hand: [AP, AP], deck: [AP, AP, AP] } });
    s = T.act(s, { type: 'end' });
    eq(s.ask.min, 0); eq(s.ask.max, 2);
    s = T.answer(s, s.players[0].hand.slice());
    eq(s.winner, 0, 'drew 3 from a 3-card deck: 0 left, wins (Q1146)');
    let s2 = T.game({ p0: { field: ['BP09-020EN'], hand: [AP, AP] } });
    s2 = T.act(s2, { type: 'end' });
    s2 = T.answer(s2, []);
    eq(s2.winner, null); eq(s2.players[0].deck.length, 14, 'Q1145: discard 0, draw 1');
  });

  test('BP11-018EN Nahtnaught: Fanfare puts a 1-cost Swordcraft card from the deck into the EX area', () => {
    let s = T.game({ p0: { hand: ['BP11-018EN'], deck: [MK, RS, UH, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.ask.from), ['Ultimate Hollow']);
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].ex), ['Ultimate Hollow']);
  });

  test('BP11-018EN Nahtnaught: [act] engages an enemy follower and Boxes it until the end of its controller\'s next turn', () => {
    let s = T.game({ p0: { field: ['BP11-018EN'] }, p1: { field: [T.WARD] } });
    const n = s.players[0].field[0], t = s.players[1].field[0];
    s = T.act(s, { type: 'activate', iid: n, idx: 0 });
    s = T.answer(s, [t]);
    ok(s.cards[t].engaged); ok(!SV.chars(s, t).kw.Ward, 'Boxed: loses Ward');
    ok(!T.legal(s, { type: 'activate', iid: n, idx: 0 }), 'once per turn');
    s = T.endTurn(s);
    eq(s.active, 1); ok(s.cards[t].engaged, "doesn't refresh in its controller's start phase"); ok(!SV.chars(s, t).kw.Ward);
    s = T.endTurn(s);
    ok(SV.chars(s, t).kw.Ward, 'no longer Boxed after its controller\'s turn (Q1564)');
  });

  test('BP15-020EN Octrice, Hollow Usurpation: Fanfare makes a Remnant of Hollowness', () => {
    let s = T.game({ p0: { hand: ['BP15-020EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.players[0].ex), ['Remnant of Hollowness']);
  });

  test('BP15-020EN Octrice, Hollow Usurpation: [act] twice per turn, the next Loot card costs 4 less (Q1908), then normal', () => {
    let s = T.game({ p0: { field: ['BP15-020EN'], hand: [RS, UH, MK] }, p1: { field: [BIG] } });
    const o = s.players[0].field[0], rs = T.find(s, 0, RS), uh = T.find(s, 0, UH);
    s = T.act(s, { type: 'activate', iid: o, idx: 0 });
    eq(SV.costToPlay(s, rs), 0);
    s = T.act(s, { type: 'activate', iid: o, idx: 0 });
    ok(!T.legal(s, { type: 'activate', iid: o, idx: 0 }), 'only twice per turn');
    s = auto(T.play(s, uh));
    eq(s.players[0].pp, 10); eq(SV.costToPlay(s, rs), 2, 'both used up by the next Loot card');
  });

  test('BP15-PR10EN Remnant of Hollowness: with 10 in the opponent\'s cemetery choose up to 2: 8 damage, then look at 3', () => {
    let s = T.game({ p0: { ex: ['BP15-PR10EN'], deck: [MK, LUPIN, MK, MK] }, p1: { field: [BIG], cemetery: ten() } });
    const t = s.players[1].field[0];
    s = T.act(s, { type: 'play', iid: s.players[0].ex[0] });
    eq(s.ask.kind, 'modes'); eq(s.ask.max, 2);
    s = T.answer(s, [0, 1]);
    s = T.answer(s, [t]);
    eq(T.def(s, t), 4);
    eq(s.ask.seen.length, 3); s = auto(T.answer(s, s.ask.from));
    eq(names(s, s.players[0].hand), ['Arsène Lupin']);
    let s2 = T.game({ p0: { ex: ['BP15-PR10EN'] }, p1: { field: [MK] } });
    s2 = T.act(s2, { type: 'play', iid: s2.players[0].ex[0] });
    eq(s2.ask.max, 1);
    s2 = T.answer(T.answer(s2, [0]), [s2.players[1].field[0]]);
    eq(T.zone(s2, T.find(s2, 1, MK)), 'cemetery', '3 damage');
    let s3 = T.game({ p0: { ex: ['BP15-PR10EN'] } });
    s3 = T.act(s3, { type: 'play', iid: s3.players[0].ex[0] });
    eq(s3.ask.options[0].enabled, false, 'no enemy follower: option 1 cannot be chosen');
  });

  test('BP15-024EN Arsène Lupin: buries the opponent\'s top card; a follower gives a Gilded Blade, a spell a Gilded Goblet', () => {
    let s = T.game({ p0: { hand: [LUPIN] }, p1: { deck: [MK, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[1].cemetery.length, 1); eq(names(s, s.players[0].ex), ['Gilded Blade']);
    let s2 = T.game({ p0: { hand: [LUPIN] }, p1: { deck: [UH, AP] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(names(s2, s2.players[0].ex), ['Gilded Goblet']);
  });

  test('BP15-025EN Arsène Lupin (evolved): On Evolve looks at 4 and may take a Thief card', () => {
    let s = T.game({ p0: { field: [LUPIN], evoDeck: ['BP15-025EN'], deck: [MK, SCOUT, MK, MK, MK] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(names(s, s.ask.from), ['Deep-Sea Scout']);
    s = auto(T.answer(s, s.ask.from));
    eq(names(s, s.players[0].hand), ['Deep-Sea Scout']);
  });

  test('BP15-026EN Ultimate Hollow: Quick, 2 damage and a Gilded Goblet', () => {
    let s = T.game({ active: 1, p0: { hand: [UH] }, p1: { field: [MK, MK] } });
    const [a, b] = s.players[1].field;
    s = T.act(s, { type: 'attack', iid: a, target: s.players[0].leader });
    s = T.act(s, { type: 'play', iid: s.players[0].hand[0] });
    s = T.answer(s, [b]);
    eq(T.def(s, b), 1); eq(names(s, s.players[0].ex), ['Gilded Goblet']);
  });

  test('BP15-028EN Adherent of Hollowness: Fanfare evolves it with 10 cards in the opponent\'s cemetery', () => {
    let s = T.game({ p0: { hand: ['BP15-028EN'], evoDeck: ['BP15-029EN'] }, p1: { cemetery: ten() } });
    const a = s.players[0].hand[0];
    s = auto(T.play(s, a));
    ok(s.cards[a].evo); eq(names(s, s.players[0].ex), ['Gilded Blade'], 'its On Evolve');
    let s2 = T.game({ p0: { hand: ['BP15-028EN'], evoDeck: ['BP15-029EN'] }, p1: { cemetery: Array(9).fill(AP) } });
    s2 = auto(T.play(s2, s2.players[0].hand[0]));
    ok(!s2.cards[T.find(s2, 0, 'BP15-028EN')].evo);
  });

  test('BP15-029EN Adherent of Hollowness (evolved): once per turn, playing a Loot card makes Gilded Boots', () => {
    let s = T.game({ p0: { field: [{ id: 'BP15-028EN', evo: 'BP15-029EN' }], hand: [UH, UH] }, p1: { field: [BIG] } });
    const [u1, u2] = T.findAll(s, 0, UH);
    s = auto(T.play(s, u1));
    s = auto(T.play(s, u2));
    eq(names(s, s.players[0].ex).filter((n) => n === 'Gilded Boots').length, 1);
  });

  test('BP15-T01EN Gilded Blade: 2 damage, and 2 to its leader with 10 in the opponent\'s cemetery', () => {
    let s = T.game({ p0: { ex: ['BP15-T01EN'] }, p1: { field: [MK], cemetery: ten() } });
    s = T.answer(T.act(s, { type: 'play', iid: s.players[0].ex[0] }), [s.players[1].field[0]]);
    eq(T.def(s, s.players[1].field[0]), 1); eq(s.players[1].defense, 18);
    let s2 = T.game({ p0: { ex: ['BP15-T01EN'] }, p1: { field: [MK] } });
    s2 = T.answer(T.act(s2, { type: 'play', iid: s2.players[0].ex[0] }), [s2.players[1].field[0]]);
    eq(s2.players[1].defense, 20);
  });

  test('BP15-T02EN Gilded Goblet: +1, or +2 with 10 in the opponent\'s cemetery', () => {
    let s = T.game({ p0: { ex: ['BP15-T02EN'] } });
    s = T.act(s, { type: 'play', iid: s.players[0].ex[0] });
    eq(s.players[0].defense, 21);
    let s2 = T.game({ p0: { ex: ['BP15-T02EN'] }, p1: { cemetery: ten() } });
    s2 = T.act(s2, { type: 'play', iid: s2.players[0].ex[0] });
    eq(s2.players[0].defense, 22);
  });

  test('BP15-T03EN Gilded Boots: Rush to a Thief follower, Storm with 10; needs a Thief follower', () => {
    let s = T.game({ p0: { ex: ['BP15-T03EN'], field: [{ id: SCOUT, fresh: true }] } });
    const k = s.players[0].field[0];
    s = T.answer(T.act(s, { type: 'play', iid: s.players[0].ex[0] }), [k]);
    ok(SV.chars(s, k).kw.Rush); ok(!SV.chars(s, k).kw.Storm);
    let s2 = T.game({ p0: { ex: ['BP15-T03EN'], field: [{ id: SCOUT, fresh: true }] }, p1: { cemetery: ten() } });
    s2 = T.answer(T.act(s2, { type: 'play', iid: s2.players[0].ex[0] }), [s2.players[0].field[0]]);
    ok(SV.chars(s2, s2.players[0].field[0]).kw.Storm);
    const s3 = T.game({ p0: { ex: ['BP15-T03EN'], field: [MK] } });
    ok(!T.legal(s3, { type: 'play', iid: s3.players[0].ex[0] }));
  });

  test('BP19-019EN Barbaros: Fanfare makes a Flag; Loot cards from the EX area cost 1 less during your turn only', () => {
    let s = T.game({ p0: { hand: ['BP19-019EN', UH] } });
    s = T.play(s, T.find(s, 0, 'BP19-019EN'));
    const f = s.players[0].ex[0];
    eq(names(s, [f]), ["Dread Pirate's Flag"]);
    eq(SV.costToPlay(s, f), 0); eq(SV.costToPlay(s, T.find(s, 0, UH)), 1, 'from the hand: unchanged');
    s = T.endTurn(s);
    eq(SV.costToPlay(s, f), 1, "opponent's turn: unchanged");
  });

  test('BP19-020EN Barbaros (evolved): each Loot card played chooses an option not chosen this turn', () => {
    let s = T.game({ p0: { field: [{ id: 'BP19-019EN', evo: 'BP19-020EN' }, SCOUT], ex: [FLAG, FLAG], pp: 5 }, p1: { field: [MK, MK] } });
    const [f1, f2] = s.players[0].ex, k = s.players[0].field[1], t = s.players[1].field[0];
    s = T.act(s, { type: 'play', iid: f1 });
    s = T.answer(s, [k]); // the Flag's own target
    eq(s.ask.kind, 'modes');
    s = T.answer(s, [0]);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'cemetery');
    s = T.act(s, { type: 'play', iid: f2 });
    s = T.answer(s, [k]);
    eq(s.ask.options.map((o) => o.enabled), [false, true, true], 'option 1 already chosen this turn (an enemy follower is still there)');
    s = T.answer(s, [2]);
    eq(s.players[0].pp, 7, 'Flags cost 0 from the EX area; recovered 2');
  });

  test('BP19-026EN Tidal Gunner: Fanfare makes a Flag; playing a Flag deals 1 to a chosen enemy', () => {
    let s = T.game({ p0: { hand: ['BP19-026EN'], field: [SCOUT] } });
    s = T.play(s, s.players[0].hand[0]);
    const f = s.players[0].ex[0];
    s = T.act(s, { type: 'play', iid: f });
    s = T.answer(s, [T.find(s, 0, SCOUT)]);
    eq(s.players[1].defense, 19, "the Flag's own damage (Condemned–Thief)");
    s = T.answer(s, [s.players[1].leader]);
    eq(s.players[1].defense, 18, "Tidal Gunner's damage");
  });

  test('BP19-028EN Storm-Wracked First Mate: Fanfare makes a Flag', () => {
    let s = T.game({ p0: { hand: ['BP19-028EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.players[0].ex), ["Dread Pirate's Flag"]);
  });

  test('BP19-029EN Storm-Wracked First Mate (evolved): On Evolve searches a Condemned–Thief follower', () => {
    let s = T.game({ p0: { field: ['BP19-028EN'], evoDeck: ['BP19-029EN'], deck: [MK, LUPIN, SCOUT] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(names(s, s.ask.from), ['Deep-Sea Scout'], 'Lupin is not Condemned');
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ['Deep-Sea Scout']);
  });

  test('BP19-030EN Deep-Sea Scout: Fanfare makes a Flag', () => {
    let s = T.game({ p0: { hand: [SCOUT] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.players[0].ex), ["Dread Pirate's Flag"]);
  });

  test("BP19-T01EN Dread Pirate's Flag: +1 attack to a Thief follower; 1 to the leader only for a Condemned–Thief", () => {
    let s = T.game({ p0: { ex: [FLAG], field: [SCOUT, LUPIN] } });
    const [sc, lu] = s.players[0].field;
    let a = T.answer(T.act(s, { type: 'play', iid: s.players[0].ex[0] }), [lu]);
    eq(T.atk(a, lu), 3); eq(a.players[1].defense, 20);
    a = T.answer(T.act(s, { type: 'play', iid: s.players[0].ex[0] }), [sc]);
    eq(T.atk(a, sc), 3); eq(a.players[1].defense, 19);
    const s2 = T.game({ p0: { ex: [FLAG], field: [MK] } });
    ok(!T.legal(s2, { type: 'play', iid: s2.players[0].ex[0] }), 'needs a Thief follower');
  });

  test('BP20-019EN Octrice, Hollowness Manifest: Fanfare choose 1 (crest or Returning Slash); playing or fusing Loot gives Storm', () => {
    let s = T.game({ p0: { hand: ['BP20-019EN'], deck: [MK, RS, MK] } });
    let a = T.answer(T.play(s, s.players[0].hand[0]), [0]);
    eq(names(a, a.players[0].ex), ['Crest: Octrice, Hollowness Manifest']);
    a = T.answer(T.play(s, s.players[0].hand[0]), [1]);
    a = T.answer(a, a.ask.from);
    eq(names(a, a.players[0].hand), ['Returning Slash']);
    let s2 = T.game({ p0: { field: [{ id: 'BP20-019EN', fresh: true }], hand: [UH] }, p1: { field: [BIG] } });
    const o = s2.players[0].field[0];
    ok(!SV.chars(s2, o).kw.Storm);
    s2 = auto(T.play(s2, s2.players[0].hand[0]));
    ok(SV.chars(s2, o).kw.Storm, 'played a Loot card');
    let s3 = T.game({ p0: { field: [{ id: 'BP20-019EN', fresh: true }], hand: [RS, UH] } });
    s3 = T.act(s3, { type: 'activate', iid: T.find(s3, 0, RS), idx: 0 });
    s3 = T.answer(s3, [T.find(s3, 0, UH)]);
    ok(SV.chars(s3, s3.players[0].field[0]).kw.Storm, 'fused a Loot card');
  });

  test('BP20-020EN Sinciro: Fuse up to 2 Loot cards for fusion counters; Fanfare draws with a counter, else a Gilded Blade', () => {
    let s = T.game({ p0: { hand: ['BP20-020EN', UH, RS] } });
    const k = T.find(s, 0, 'BP20-020EN');
    s = T.act(s, { type: 'activate', iid: k, idx: 0 });
    eq(s.ask.max, 2);
    s = T.answer(s, [T.find(s, 0, UH), T.find(s, 0, RS)]);
    eq(T.zone(s, k), 'ex'); eq(s.cards[k].counters.fusion, 2);
    s = T.play(s, k);
    eq(s.cards[k].counters.fusion, 2, 'counters stay on the field'); eq(s.players[0].hand.length, 1, 'drew');
    let s2 = T.game({ p0: { hand: ['BP20-020EN'] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(names(s2, s2.players[0].ex), ['Gilded Blade']);
  });

  test('BP20-021EN Sinciro (evolved): ability damage +2 per fusion counter (On Evolve 3 -> 5)', () => {
    let s = T.game({ p0: { field: [{ id: 'BP20-020EN', counters: { fusion: 1 } }], evoDeck: ['BP20-021EN'] }, p1: { field: [BIG] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [s.players[1].field[0]]);
    eq(T.def(s, s.players[1].field[0]), 7);
    let s2 = T.game({ p0: { field: ['BP20-020EN'], evoDeck: ['BP20-021EN'], turnsPassed: 7 }, p1: { field: [MK] } });
    s2 = T.answer(T.act(s2, { type: 'evolve', iid: s2.players[0].field[0] }), true);
    s2 = auto(s2);
    eq(s2.players[1].defense, 19, 'On Super-Evolve: 1 to the leader');
    eq(T.zone(s2, T.find(s2, 1, MK)), 'cemetery', '3 + 1');
  });

  test('BP20-033EN Devotee of Usurpation: playing Loot gives Assail; Last Words makes a Gilded Goblet and Gilded Boots', () => {
    let s = T.game({ p0: { field: ['BP20-033EN'], hand: [UH] }, p1: { field: [BIG, { id: MK, engaged: true }] } });
    const d = s.players[0].field[0];
    s = T.answer(T.play(s, s.players[0].hand[0]), [T.find(s, 1, BIG)]);
    ok(SV.chars(s, d).kw.Assail);
    s = T.attack(s, d, T.find(s, 1, MK));
    eq(T.zone(s, d), 'cemetery');
    eq(names(s, s.players[0].ex).slice(1), ['Gilded Goblet', 'Gilded Boots']);
  });

  test('review: BP20-T02EN Crest: Octrice counts a fused Loot card even when the fusing card is not Loot (CR 12.18.4.1, Q2449)', () => {
    let s = T.game({ p0: { ex: ['BP20-T02EN'], hand: ['BP20-020EN', 'BP15-026EN'] } });
    const crest = s.players[0].ex[0];
    const sinciro = T.find(s, 0, 'BP20-020EN');
    const idx = SV.chars(s, sinciro).activated.findIndex((a) => a.usable && a.zone === 'hand');
    s = T.act(s, { type: 'activate', iid: sinciro, idx });
    for (let g = 0; s.ask && g < 10; g++) s = T.answer(s, s.ask.kind === 'cards' ? s.ask.from.filter((i) => s.cards[i].id === 'BP15-026EN').slice(0, Math.max(1, s.ask.min)) : s.ask.kind === 'bag' ? s.ask.options[0].id : s.ask.kind === 'order' ? s.ask.from : false);
    eq(s.cards[crest].counters.reversal, 1);
  });

  test('review: BP20-026EN Returning Slash is not playable when the only enemy follower has Aura (CR 12.15, 10.6.2.3.3)', () => {
    const s = T.game({ p0: { hand: ['BP20-026EN'] }, p1: { field: ['BP19-114EN'] } });
    ok(!T.legal(s, { type: 'play', iid: s.players[0].hand[0] }));
  });
})();
