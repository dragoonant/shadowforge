// Forestcraft card behaviour tests (see tests/cards-abysscraft.js for the conventions).
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok } = SV.T;
  const T = SV.T;
  const AP = T.FILLER; // Apostle of Unkilling 3/3, Omen/Hunter: a Hunter card in the cemetery
  const MK = 'BP16-081EN'; // Mukan, Shadowcrypt Ward 3/3/3 (no Hunter trait)
  const MA = 'BP17-110EN'; // Maisha, Purgation's Vessel 2/2/2 (neutral)
  const BIG = 'BP01-080EN'; // Genesis Dragon 9: 10/12
  const SUKUNA = 'BP04-010EN'; // Hunter, Forestcraft, cost 1
  const MAGA = 'BP19-001EN'; // Magachiyo, Condemned, cost 2
  const HERMIT = 'BP15-014EN'; // Omen/Hunter follower, cost 2
  const hunters = (n) => Array(n).fill(AP);
  // Answer the remaining questions with the first legal choice (bag: first pending ability).
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
  const names = (s, list) => list.map((i) => SV.CARDS[s.cards[i].id].name);

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

  test('BP04-011EN Sukuna (evolved): On Evolve gives +3/+3 at Combo 5, +1/+1 at Combo 3, nothing below', () => {
    const run = (played) => {
      let s = T.game({ p0: { field: [SUKUNA], evoDeck: ['BP04-011EN'] } });
      s.ti.played[0] = played;
      const k = s.players[0].field[0];
      s = auto(T.act(s, { type: 'evolve', iid: k }));
      return [T.atk(s, k), T.def(s, k)];
    };
    eq(run(5), [5, 5]); eq(run(3), [3, 3]); eq(run(2), [2, 2]);
  });

  test('BP05-005EN Apostle of Unkilling (evolved): On Evolve puts a Hunter follower costing 2 or less from the deck onto the field', () => {
    let s = T.game({ p0: { field: [AP], evoDeck: ['BP05-005EN'], deck: [MK, SUKUNA, AP, MK] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.kind, 'cards'); eq(names(s, s.ask.from), ['Sukuna, Brave and Small'], 'only Hunter followers costing 2 or less');
    s = T.answer(s, s.ask.from);
    eq(s.players[0].field.length, 2);
    eq(T.zone(s, T.find(s, 0, SUKUNA)), 'field');
  });

  test('BP05-017EN Mark of the Six: Quick; the next damage to your leader this turn is prevented, later damage is not', () => {
    let s = T.game({ active: 1, p0: { hand: ['BP05-017EN'] }, p1: { field: [MK, MK] } });
    const [a, b] = s.players[1].field;
    s = T.act(s, { type: 'attack', iid: a, target: s.players[0].leader });
    ok(s.window && s.window.who === 0);
    s = T.act(s, { type: 'play', iid: s.players[0].hand[0] });
    while (s.window) s = T.pass(s);
    eq(s.players[0].defense, 20, 'first attack prevented');
    s = T.attack(s, b, s.players[0].leader);
    eq(s.players[0].defense, 17, 'used up');
  });

  test('BP06-013EN Crossbow Sniper: discarding a Hunter card deals 1 to the chosen enemy and draws; declining does nothing', () => {
    let s = T.game({ p0: { hand: ['BP06-013EN', SUKUNA] }, p1: { field: [MA] } });
    const k = T.find(s, 0, SUKUNA);
    s = T.play(s, T.find(s, 0, 'BP06-013EN'));
    let d = T.answer(s, []);
    eq(d.players[1].defense, 20); eq(d.players[0].hand.length, 1);
    s = T.answer(s, [k]);
    eq(T.zone(s, k), 'cemetery');
    eq(s.ask.from.length, 2, 'enemy leader or enemy follower');
    s = T.answer(s, [s.players[1].leader]);
    eq(s.players[1].defense, 19); eq(s.players[0].hand.length, 1, 'drew a card');
  });

  test('BP11-003EN Shamu & Shama: Combo (5) Fanfare deals 3; Strike at Combo (3) gives +1/+1', () => {
    let s = T.game({ p0: { hand: ['BP11-003EN'] }, p1: { field: [MK] } });
    const t = s.players[1].field[0];
    s.ti.played[0] = 4;
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'cemetery');
    let s2 = T.game({ p0: { field: ['BP11-003EN'] } });
    s2.ti.played[0] = 3;
    s2 = T.attack(s2, s2.players[0].field[0], s2.players[1].leader);
    eq(s2.players[1].defense, 18, '1/1 attacks as 2/2');
    let s3 = T.game({ p0: { field: ['BP11-003EN'] } });
    s3.ti.played[0] = 2;
    s3 = T.attack(s3, s3.players[0].field[0], s3.players[1].leader);
    eq(s3.players[1].defense, 19, 'combo 2: no buff');
  });

  test('BP15-001EN Izudia, Unkilling Annihilation: [act] 1 damage; each use makes an Annihilating Onslaught when it dies this turn (Q1893)', () => {
    let s = T.game({ p0: { field: ['BP15-001EN', AP] }, p1: { field: [{ id: MK, engaged: true }] } });
    const [iz, ap] = s.players[0].field, t = s.players[1].field[0];
    s = T.act(s, { type: 'activate', iid: iz, idx: 0 });
    s = T.answer(s, [t]);
    eq(T.def(s, t), 2); ok(s.cards[iz].engaged);
    s.cards[iz].engaged = false; // position: let it act a second time
    s = T.act(s, { type: 'activate', iid: iz, idx: 0 });
    s = T.answer(s, [t]);
    eq(s.players[0].ex.length, 0, 'nothing until it is put into the cemetery');
    s = T.attack(s, ap, t);
    eq(T.zone(s, t), 'cemetery');
    s = auto(s);
    eq(names(s, s.players[0].ex), ['Annihilating Onslaught', 'Annihilating Onslaught']);
  });

  test('BP15-001EN Izudia, Unkilling Annihilation: [act] needs an enemy follower to select', () => {
    const s = T.game({ p0: { field: ['BP15-001EN'] } });
    ok(!T.legal(s, { type: 'activate', iid: s.players[0].field[0], idx: 0 }));
  });

  test('BP15-004EN Piercye: Fanfare evolves it with 3 faceup evolved followers in the evolve deck; the evolve deals 1/2 and gives +1', () => {
    let s = T.game({ p0: { hand: ['BP15-004EN'], evoDeck: ['BP04-011EN', 'BP19-002EN', 'BP20-003EN', 'BP15-005EN'] }, p1: { field: [MA] } });
    for (const e of s.players[0].evoDeck.slice(0, 3)) s.cards[e].faceup = true;
    const p = s.players[0].hand[0];
    s = auto(T.play(s, p));
    ok(s.cards[p].evo, 'evolved');
    eq(s.players[1].defense, 19); eq(T.zone(s, T.find(s, 1, MA)), 'cemetery'); eq(s.players[0].defense, 21);
    let s2 = T.game({ p0: { hand: ['BP15-004EN'], evoDeck: ['BP04-011EN', 'BP19-002EN', 'BP15-005EN'] } });
    for (const e of s2.players[0].evoDeck.slice(0, 2)) s2.cards[e].faceup = true;
    s2 = auto(T.play(s2, s2.players[0].hand[0]));
    ok(!s2.cards[T.find(s2, 0, 'BP15-004EN')].evo, 'only 2 faceup: not evolved');
  });

  test('BP15-005EN Piercye (evolved): another follower of yours evolving deals 1 to the leader, 2 to each enemy follower, +1 defense', () => {
    let s = T.game({ p0: { field: [{ id: 'BP15-004EN', evo: 'BP15-005EN' }, AP], evoDeck: ['BP05-005EN'] }, p1: { field: [MA, BIG] } });
    s = auto(T.act(s, { type: 'evolve', iid: s.players[0].field[1] }));
    eq(s.players[1].defense, 19); eq(T.zone(s, T.find(s, 1, MA)), 'cemetery'); eq(T.def(s, T.find(s, 1, BIG)), 10);
    eq(s.players[0].defense, 21);
  });

  test('BP15-005EN Piercye (evolved): On Evolve searches a follower costing 2 or less into the hand', () => {
    let s = T.game({ p0: { field: ['BP15-004EN'], evoDeck: ['BP15-005EN'], deck: [MK, SUKUNA, MK] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    while (s.ask && s.ask.kind === 'bag') s = T.answer(s, s.ask.options.find((o) => o.name === 'On Evolve').id);
    eq(names(s, s.ask.from), ['Sukuna, Brave and Small']);
    s = auto(T.answer(s, s.ask.from));
    eq(s.players[0].hand.map((i) => s.cards[i].id), [SUKUNA]);
  });

  test('BP15-008EN Erosive Annihilation: costs 1 less with an Izudia; 1 damage, draws when that follower dies this turn', () => {
    const c = T.game({ p0: { hand: ['BP15-008EN'], field: ['BP15-001EN'] }, p1: { field: [MK] } });
    eq(SV.costToPlay(c, c.players[0].hand[0]), 0);
    let s = T.game({ p0: { hand: ['BP15-008EN'], field: [AP] }, p1: { field: [{ id: MK, engaged: true }] } });
    eq(SV.costToPlay(s, s.players[0].hand[0]), 1);
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [t]);
    eq(T.def(s, t), 2); eq(s.players[0].hand.length, 0);
    s = T.attack(s, s.players[0].field[0], t);
    eq(T.zone(s, t), 'cemetery'); eq(s.players[0].hand.length, 1, 'drew when it was put into the cemetery');
  });

  test('BP15-012EN Adherent of Annihilation: with 3 Hunter cards deals 2; +2 defense when that follower dies this turn', () => {
    let s = T.game({ p0: { hand: ['BP15-012EN'], field: [AP], cemetery: hunters(3) }, p1: { field: [{ id: MK, engaged: true }] } });
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [t]);
    eq(T.def(s, t), 1); eq(s.players[0].defense, 20);
    s = T.attack(s, s.players[0].field[0], t);
    eq(s.players[0].defense, 22);
    let s2 = T.game({ p0: { hand: ['BP15-012EN'], cemetery: hunters(2) }, p1: { field: [MK] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    s2 = T.answer(s2, [s2.players[1].field[0]]);
    eq(T.def(s2, s2.players[1].field[0]), 3, '2 Hunter cards: no damage');
  });

  test('BP15-014EN Hermit of Unkilling: with 3 Hunter cards changes the enemy follower\'s defense to 1', () => {
    let s = T.game({ p0: { hand: [HERMIT], cemetery: hunters(3) }, p1: { field: [{ id: BIG, dmg: 2 }] } });
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [t]);
    eq(T.def(s, t), 1); eq(T.atk(s, t), 10);
    let s2 = T.game({ p0: { hand: [HERMIT], cemetery: hunters(2) }, p1: { field: [BIG] } });
    s2 = T.answer(T.play(s2, s2.players[0].hand[0]), [s2.players[1].field[0]]);
    eq(T.def(s2, s2.players[1].field[0]), 12);
  });

  test('BP15-015EN Hermit of Unkilling (evolved): On Evolve searches a follower with "Izudia" in its name', () => {
    let s = T.game({ p0: { field: [HERMIT], evoDeck: ['BP15-015EN'], deck: [MK, 'BP20-001EN', 'BP15-008EN'] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(names(s, s.ask.from), ['Izudia, Annihilation Manifest']);
    s = T.answer(s, s.ask.from);
    eq(s.players[0].hand.map((i) => s.cards[i].id), ['BP20-001EN']);
  });

  test('BP18-019EN Airbound Barrage: returns your Forestcraft card and deals 3; needs both targets (Q2149)', () => {
    let s = T.game({ p0: { hand: ['BP18-019EN'], field: [SUKUNA] }, p1: { field: [MK] } });
    const k = s.players[0].field[0], t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [k]);
    s = T.answer(s, [t]);
    eq(T.zone(s, k), 'hand'); eq(T.zone(s, t), 'cemetery');
    const s2 = T.game({ p0: { hand: ['BP18-019EN'], field: [MA] }, p1: { field: [MK] } });
    ok(!T.legal(s2, { type: 'play', iid: s2.players[0].hand[0] }), 'no Forestcraft card on your field');
  });

  test('BP19-002EN Magachiyo (evolved): Combo (3) On Evolve deals 4; On Super-Evolve gives the other Condemned followers Storm', () => {
    let s = T.game({ p0: { field: [MAGA, 'BP19-011EN', SUKUNA], evoDeck: ['BP19-002EN'], turnsPassed: 7 }, p1: { field: [BIG] } });
    s.ti.played[0] = 3;
    const [m, leaf, suk] = s.players[0].field;
    s = T.act(s, { type: 'evolve', iid: m });
    eq(s.ask.kind, 'yesno'); s = T.answer(s, true); // super-evolve
    s = auto(s);
    eq(T.def(s, T.find(s, 1, BIG)), 12 - 4 - 3, 'On Evolve 4 + Leafshade 3');
    ok(SV.chars(s, leaf).kw.Storm, 'other Condemned follower: Storm'); ok(!SV.chars(s, suk).kw.Storm, 'not Condemned');
  });

  test('BP19-003EN Wimael: Fanfare deals 4; Last Words puts it back onto the field', () => {
    let s = T.game({ p0: { hand: ['BP19-003EN'] }, p1: { field: [MK] } });
    s = T.answer(T.play(s, s.players[0].hand[0]), [s.players[1].field[0]]);
    eq(T.zone(s, T.find(s, 1, MK)), 'cemetery');
    let s2 = T.game({ p0: { hand: ['BP19-007EN'], field: ['BP19-003EN'] } });
    const w = s2.players[0].field[0];
    s2 = T.act(s2, { type: 'activate', iid: s2.players[0].hand[0], idx: 0 });
    s2 = auto(T.answer(s2, [w]));
    eq(T.zone(s2, w), 'field', 'destroyed, then put back by its Last Words');
  });

  test('BP19-005EN Verdant Lieutenant: a Condemned follower of yours evolving draws at Combo (3)', () => {
    const run = (played) => {
      let s = T.game({ p0: { field: ['BP19-005EN', MAGA], evoDeck: ['BP19-002EN'] } });
      s.ti.played[0] = played;
      s = auto(T.act(s, { type: 'evolve', iid: s.players[0].field[1] }));
      return s.players[0].hand.length;
    };
    eq(run(3), 1); eq(run(2), 0);
  });

  test('BP19-006EN Verdant Lieutenant (evolved): On Evolve deals 2 to an enemy follower', () => {
    let s = T.game({ p0: { field: ['BP19-005EN'], evoDeck: ['BP19-006EN'] }, p1: { field: [MA] } });
    s = auto(T.act(s, { type: 'evolve', iid: s.players[0].field[0] }));
    eq(T.zone(s, T.find(s, 1, MA)), 'cemetery');
    eq(s.players[0].hand.length, 0, 'combo 0: no draw from its own evolve');
  });

  test('BP19-007EN Warden of Balms: Fanfare and Last Words deal 3 to the enemy leader; [act] from hand destroys a Condemned follower', () => {
    let s = T.game({ p0: { hand: ['BP19-007EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[1].defense, 17);
    let s2 = T.game({ p0: { hand: ['BP19-007EN'], field: [MAGA, 'BP19-007EN'] } });
    const [m, w] = s2.players[0].field;
    ok(T.legal(s2, { type: 'activate', iid: s2.players[0].hand[0], idx: 0 }));
    s2 = T.act(s2, { type: 'activate', iid: s2.players[0].hand[0], idx: 0 });
    eq(s2.ask.from.slice().sort(), [m, w].sort(), 'Condemned followers on your field');
    s2 = T.answer(s2, [w]);
    eq(T.zone(s2, w), 'cemetery'); eq(T.zone(s2, T.find(s2, 0, 'BP19-007EN', 'cemetery')), 'cemetery');
    eq(s2.players[1].defense, 20 - 1 - 3, '1 from the act, 3 from the Last Words'); eq(s2.players[0].hand.length, 1);
    const s3 = T.game({ p0: { hand: ['BP19-007EN'], field: [MA] } });
    ok(!T.legal(s3, { type: 'activate', iid: s3.players[0].hand[0], idx: 0 }), 'no Condemned follower');
  });

  test('BP19-011EN Leafshade Assassin: the next Condemned card this turn costs 1 less, only the next one', () => {
    let s = T.game({ p0: { hand: ['BP19-011EN', SUKUNA, MAGA, MAGA] } });
    s = T.play(s, T.find(s, 0, 'BP19-011EN'));
    const [m1, m2] = T.findAll(s, 0, MAGA);
    eq(SV.costToPlay(s, m1), 1); eq(SV.costToPlay(s, T.find(s, 0, SUKUNA)), 1, 'not Condemned: unchanged');
    s = T.play(s, T.find(s, 0, SUKUNA));
    eq(SV.costToPlay(s, m1), 1, 'still waiting for a Condemned card');
    s = T.play(s, m1);
    eq(s.players[0].pp, 10 - 2 - 1 - 1); eq(SV.costToPlay(s, m2), 2, 'used up');
  });

  test('BP20-001EN Izudia, Annihilation Manifest: Fanfare searches an Omen–Hunter spell and, with 6 Hunter cards, makes Annihilating Onslaught', () => {
    let s = T.game({ p0: { hand: ['BP20-001EN'], deck: [MK, 'BP15-008EN', 'BP18-019EN'], cemetery: hunters(6) } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.ask.from), ['Erosive Annihilation'], 'Airbound Barrage is Elf/Hunter, not Omen');
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ['Erosive Annihilation']); eq(names(s, s.players[0].ex), ['Annihilating Onslaught']);
  });

  test('BP20-001EN Izudia, Annihilation Manifest: [act] the next Omen–Hunter card costs 2 less, once per turn', () => {
    let s = T.game({ p0: { field: ['BP20-001EN'], hand: [HERMIT, HERMIT, SUKUNA] } });
    const iz = s.players[0].field[0];
    const [h1, h2] = T.findAll(s, 0, HERMIT);
    s = T.act(s, { type: 'activate', iid: iz, idx: 0 });
    eq(SV.costToPlay(s, h1), 0); eq(SV.costToPlay(s, T.find(s, 0, SUKUNA)), 1, 'Hunter only: unchanged');
    ok(!T.legal(s, { type: 'activate', iid: iz, idx: 0 }), 'once per turn');
    s = auto(T.play(s, h1));
    eq(s.players[0].pp, 10); eq(SV.costToPlay(s, h2), 2);
  });

  test('BP20-002EN Krulle: with 6 Hunter cards, the crest goes to the EX area and the leader gets +2', () => {
    let s = T.game({ p0: { hand: ['BP20-002EN'], cemetery: hunters(6) } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.players[0].ex), ['Crest: Krulle, Heir to Unkilling']); eq(s.players[0].defense, 22);
    let s2 = T.game({ p0: { hand: ['BP20-002EN'], cemetery: hunters(5) } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.players[0].ex.length, 0); eq(s2.players[0].defense, 20);
  });

  test('BP20-003EN Krulle (evolved): On Evolve -3/-3 to one; On Super-Evolve -3/-3 to each enemy follower', () => {
    let s = T.game({ p0: { field: ['BP20-002EN'], evoDeck: ['BP20-003EN'], turnsPassed: 7 }, p1: { field: [BIG, MK] } });
    const [big, mk] = s.players[1].field;
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, true); // super-evolve
    while (s.ask) {
      if (s.ask.kind === 'bag') s = T.answer(s, s.ask.options[0].id);
      else s = T.answer(s, [big]);
    }
    eq([T.atk(s, big), T.def(s, big)], [4, 6]); eq(T.zone(s, mk), 'cemetery');
  });

  test('BP20-007EN Congregant of Unkilling: Fanfare summons an Omen–Hunter follower costing 3 or less from the deck', () => {
    let s = T.game({ p0: { hand: ['BP20-007EN'], deck: [MK, HERMIT, SUKUNA] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.ask.from), ['Hermit of Unkilling']);
    s = auto(T.answer(s, s.ask.from));
    eq(T.zone(s, T.find(s, 0, HERMIT)), 'field');
  });

  test('BP20-008EN Eradicating Arrow: up to 2 followers take 2; with 6 Hunter cards 3 each and 2 to the leader, even with 0 selected', () => {
    let s = T.game({ p0: { hand: ['BP20-008EN'] }, p1: { field: [MK, MK, MK] } });
    const [a, b, c] = s.players[1].field;
    s = T.answer(T.play(s, s.players[0].hand[0]), [a, b]);
    eq([T.def(s, a), T.def(s, b), T.def(s, c)], [1, 1, 3]); eq(s.players[1].defense, 20);
    let s2 = T.game({ p0: { hand: ['BP20-008EN'], cemetery: hunters(6) }, p1: { field: [MK, MK] } });
    s2 = T.answer(T.play(s2, s2.players[0].hand[0]), s2.players[1].field.slice());
    eq(s2.players[1].field.length, 0); eq(s2.players[1].defense, 18);
    let s3 = T.game({ p0: { hand: ['BP20-008EN'], cemetery: hunters(6) }, p1: { field: [MK] } });
    s3 = T.answer(T.play(s3, s3.players[0].hand[0]), []);
    eq(s3.players[1].defense, 18, 'Q2409');
  });

  test('BP20-009EN Supplicant of Unkilling: Fanfare draws only if an enemy follower has 1 defense', () => {
    let s = T.game({ p0: { hand: ['BP20-009EN'] }, p1: { field: [{ id: MK, dmg: 2 }] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].hand.length, 1);
    let s2 = T.game({ p0: { hand: ['BP20-009EN'] }, p1: { field: [{ id: MK, dmg: 1 }] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.players[0].hand.length, 0);
  });

  test('BP20-010EN Supplicant of Unkilling (evolved): On Evolve gives +2 if an enemy follower has 1 defense', () => {
    let s = T.game({ p0: { field: ['BP20-009EN'], evoDeck: ['BP20-010EN'] }, p1: { field: [{ id: MK, dmg: 2 }] } });
    s = auto(T.act(s, { type: 'evolve', iid: s.players[0].field[0] }));
    eq(s.players[0].defense, 22);
    let s2 = T.game({ p0: { field: ['BP20-009EN'], evoDeck: ['BP20-010EN'] }, p1: { field: [MK] } });
    s2 = auto(T.act(s2, { type: 'evolve', iid: s2.players[0].field[0] }));
    eq(s2.players[0].defense, 20);
  });

  test('BP20-012EN Hamlet of Unkilling: Fanfare may take an Omen–Hunter card from the top 2; [act] bury it for +1 with 3 Hunter cards', () => {
    let s = T.game({ p0: { hand: ['BP20-012EN'], deck: [MK, HERMIT, SUKUNA] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.seen.length, 2); eq(names(s, s.ask.from), ['Hermit of Unkilling']);
    s = auto(T.answer(s, s.ask.from));
    eq(s.players[0].hand.map((i) => s.cards[i].id), [HERMIT]);
    eq(s.players[0].deck.map((i) => s.cards[i].id), [SUKUNA, MK], 'the rest to the bottom');
    let s2 = T.game({ p0: { field: ['BP20-012EN'], cemetery: hunters(3) } });
    const h = s2.players[0].field[0];
    s2 = T.act(s2, { type: 'activate', iid: h, idx: 0 });
    eq(T.zone(s2, h), 'cemetery'); eq(s2.players[0].defense, 21);
    const s3 = T.game({ p0: { field: ['BP20-012EN'], cemetery: hunters(2) } });
    ok(!T.legal(s3, { type: 'activate', iid: s3.players[0].field[0], idx: 0 }));
  });

  test('BP20-015EN Devotee of Unkilling: discarding an Omen–Hunter card draws 2', () => {
    let s = T.game({ p0: { hand: ['BP20-015EN', HERMIT, SUKUNA] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.ask.from), ['Hermit of Unkilling'], 'Sukuna is not Omen');
    s = T.answer(s, s.ask.from);
    eq(T.zone(s, T.find(s, 0, HERMIT)), 'cemetery'); eq(s.players[0].hand.length, 3);
  });

  test('BP20-T01EN Crest: Krulle: [act] from the EX area changes an enemy follower\'s defense to 1, once per turn', () => {
    let s = T.game({ p0: { ex: ['BP20-T01EN'] }, p1: { field: [BIG] } });
    const c = s.players[0].ex[0], t = s.players[1].field[0];
    s = T.act(s, { type: 'activate', iid: c, idx: 0 });
    s = T.answer(s, [t]);
    eq(T.def(s, t), 1);
    ok(!T.legal(s, { type: 'activate', iid: c, idx: 0 }), 'once per turn');
  });

  test('BP20-T12EN Annihilating Onslaught: 6 to the enemy leader with 6 Hunter cards in the cemetery', () => {
    let s = T.game({ p0: { ex: ['BP20-T12EN'], cemetery: hunters(6) } });
    s = T.act(s, { type: 'play', iid: s.players[0].ex[0] });
    eq(s.players[1].defense, 14);
    let s2 = T.game({ p0: { ex: ['BP20-T12EN'], cemetery: hunters(5) } });
    s2 = T.act(s2, { type: 'play', iid: s2.players[0].ex[0] });
    eq(s2.players[1].defense, 20);
  });

  test('SP01-001EN Spinaria: Fanfare puts a cheap Forestcraft follower from the cemetery into the EX area at 2 less; evolves give +2', () => {
    let s = T.game({ p0: { hand: ['SP01-001EN'], cemetery: [MAGA, AP, MA] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.ask.from), ['Magachiyo, Barbed Convict'], 'Forestcraft and cost 2 or less');
    s = T.answer(s, s.ask.from);
    const m = T.find(s, 0, MAGA);
    eq(T.zone(s, m), 'ex'); eq(SV.costToPlay(s, m), 0);
    let s2 = T.game({ p0: { field: ['SP01-001EN', AP], evoDeck: ['BP05-005EN'] } });
    s2 = auto(T.act(s2, { type: 'evolve', iid: s2.players[0].field[1] }));
    eq(s2.players[0].defense, 22);
  });
})();
