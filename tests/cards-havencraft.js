// havencraft card behaviour tests (see tests/cards-abysscraft.js for the conventions).
(function () {
  const SV = globalThis.SV;
  const { test, eq, ok } = SV.T;
  const T = SV.T;
  const AP = T.FILLER; // Apostle of Unkilling 3/3/3, Omen/Hunter

  const STALWART = 'BP10-107EN', EAGLE = 'BP11-099EN', HAVENFIRE = 'BP11-096EN', SELENA = 'BP11-086EN';
  const SEISHIRO = 'BP18-097EN', DELIVERER = 'BP18-105EN', UNSHAKABLE = 'BP18-104EN', TENMEI = 'BP18-099EN';
  const ERRALDE = 'BP19-092EN', AGENT = 'BP19-100EN', PRECEPTS = 'BP19-102EN', EXECUTOR = 'BP19-098EN';
  const SUPPLICANT = 'BP20-101EN', DEVOTEE = 'BP20-107EN';
  const CR_MARWYNN = 'BP20-T07EN', CR_HIMEKA = 'BP20-T08EN', CR_CONGREGANT = 'BP20-T09EN', CR_SUPPLICANT = 'BP20-T10EN';
  const names = (s, list) => list.map((i) => SV.CARDS[s.cards[i].id].name);

  // Answer pending questions with simple defaults (or the overrides in `ans`) until none is left.
  function drain(s, ans = {}) {
    for (let g = 0; s.ask && g < 60; g++) {
      const a = s.ask;
      let v;
      if (/Ward followers to engage/.test(a.prompt)) v = [];
      else if (/has Ward/.test(a.prompt)) v = false;
      else if (a.kind === 'bag') v = ans.bag ? ans.bag(s, a) : a.options[0].id;
      else if (a.kind === 'order') v = a.from.slice();
      else if (a.kind === 'yesno') v = ans.yes != null ? ans.yes : false;
      else if (a.kind === 'modes') v = ans.modes ? ans.modes(s, a) : [a.options.findIndex((o) => o.enabled)];
      else if (a.kind === 'cards') v = ans.cards ? ans.cards(s, a) : a.from.slice(0, Math.max(a.min, Math.min(a.max, 1)));
      else throw new Error('drain: unexpected ask ' + a.kind);
      s = T.answer(s, v);
    }
    return s;
  }
  // End the turn, answering every question along the way, until the next player can act.
  function endTurn(s, ans) {
    s = T.act(s, { type: 'end' });
    for (let g = 0; (s.ask || s.window) && g < 60; g++) s = s.ask ? drain(s, ans) : T.pass(s);
    return s;
  }

  test("BP01-127EN Jeanne d'Arc: Fanfare deals 2 to each enemy follower", () => {
    let s = T.game({ p0: { hand: ['BP01-127EN'] }, p1: { field: [AP, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[1].field.map((i) => T.def(s, i)), [1, 1]);
  });

  test("BP01-128EN Jeanne d'Arc (evolved): 2 to each enemy follower, +0/+2 to each other follower of yours", () => {
    let s = T.game({ p0: { field: ['BP01-127EN', AP], evoDeck: ['BP01-128EN'] }, p1: { field: [AP] } });
    const [j, mine] = s.players[0].field;
    s = T.act(s, { type: 'evolve', iid: j });
    eq(T.def(s, s.players[1].field[0]), 1);
    eq(T.def(s, mine), 5);
    eq(T.def(s, j), 5, 'Jeanne herself is not given +2');
  });

  test("BP02-092EN Elana's Prayer: once per turn, when your leader gains defense, your followers get +1/+1", () => {
    let s = T.game({ p0: { field: ['BP02-092EN', AP, UNSHAKABLE], hand: [DELIVERER] } });
    const ap = s.players[0].field[1];
    s = T.act(s, { type: 'activate', iid: s.players[0].field[2], idx: 0 });
    eq(s.players[0].defense, 21);
    eq([T.atk(s, ap), T.def(s, ap)], [4, 4]);
    s = T.play(s, s.players[0].hand[0]); // Deliverer: +1 defense again, same turn
    eq(s.players[0].defense, 22);
    eq([T.atk(s, ap), T.def(s, ap)], [4, 4], 'only once per turn');
  });

  test('BP09-106EN Jeanne, Beacon of Salvation: draws; with 2 Jeanne followers in the cemetery gets +1/+1 and Storm', () => {
    let s = T.game({ p0: { hand: ['BP09-106EN'], cemetery: ['BP01-127EN', 'BP13-088EN'] }, p1: { field: [AP] } });
    const j = s.players[0].hand[0];
    s = T.play(s, j);
    eq(s.players[0].hand.length, 1);
    eq([T.atk(s, j), T.def(s, j)], [3, 4]);
    ok(T.legal(s, { type: 'attack', iid: j, target: s.players[1].leader }), 'Storm');
    let s2 = T.game({ p0: { hand: ['BP09-106EN'], cemetery: ['BP01-127EN'] } });
    const j2 = s2.players[0].hand[0];
    s2 = T.play(s2, j2);
    eq([T.atk(s2, j2), T.def(s2, j2)], [2, 3], 'only 1 Jeanne: no buff');
  });

  test('BP09-107EN Jeanne, Beacon of Salvation (evolved): On Evolve may summon a havencraft 2-cost; Strike gives one +1 attack', () => {
    let s = T.game({ p0: { field: ['BP09-106EN'], evoDeck: ['BP09-107EN'], hand: [STALWART, AP] } });
    const j = s.players[0].field[0];
    const st = T.find(s, 0, STALWART, 'hand');
    s = T.act(s, { type: 'evolve', iid: j });
    eq(s.ask.min, 0); eq(s.ask.from, [st], 'only the havencraft follower that costs 2 or less');
    s = T.answer(s, [st]);
    s = T.answerWhile(s, /has Ward/, false); // CR 12.8.2 (i): summon asks the Ward question
    s = T.answer(s, false); // Stalwart's own Fanfare cost: decline
    eq(T.zone(s, st), 'field');
    s = T.act(s, { type: 'attack', iid: j, target: s.players[1].leader });
    eq(s.ask.from, [st]);
    s = T.answer(s, [st]);
    while (s.window) s = T.pass(s);
    eq(T.atk(s, st), 3);
  });

  test('BP09-115EN Whitefang Temple: end phase adds a prayer counter and +1 defense', () => {
    let s = T.game({ p0: { field: ['BP09-115EN'] } });
    const w = s.players[0].field[0];
    s = endTurn(s);
    eq(s.cards[w].counters.prayer, 1); eq(s.players[0].defense, 21);
  });

  test('BP09-115EN Whitefang Temple: with 3 prayer counters at main start, buries itself and summons a Faith follower', () => {
    let s = T.game({ p0: { field: [{ id: 'BP09-115EN', counters: { prayer: 2 } }], deck: [AP, STALWART, AP, AP] } });
    const w = s.players[0].field[0];
    s = endTurn(s); // counter 3
    s = T.act(s, { type: 'end' });
    while (s.window) s = T.pass(s);
    eq(s.ask.kind, 'cards'); eq(names(s, s.ask.from), ['Stalwart Featherfolk']);
    s = T.answer(s, s.ask.from);
    s = drain(s);
    eq(T.zone(s, w), 'cemetery');
    eq(T.zone(s, T.find(s, 0, STALWART)), 'field');
  });

  test('BP10-107EN Stalwart Featherfolk: paying 2 gives it +1/+1 and Storm', () => {
    let s = T.game({ p0: { hand: [STALWART] } });
    const f = s.players[0].hand[0];
    s = T.play(s, f);
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(s.players[0].pp, 7); eq([T.atk(s, f), T.def(s, f)], [3, 3]);
    ok(T.legal(s, { type: 'attack', iid: f, target: s.players[1].leader }));
  });

  test('BP11-086EN Selena: Fanfare puts up to 1 Wasteland and up to 1 cheap follower into the EX area; Strike recovers 2', () => {
    let s = T.game({ p0: { hand: [SELENA], pp: 6, deck: [EAGLE, HAVENFIRE, STALWART, AP, AP] } });
    const sel = s.players[0].hand[0];
    s = T.play(s, sel);
    eq(names(s, s.ask.from), ['Revolver Eagle', 'Haven Fire']);
    s = T.answer(s, [T.find(s, 0, HAVENFIRE)]);
    eq(names(s, s.ask.from), ['Revolver Eagle', 'Stalwart Featherfolk']);
    s = T.answer(s, [T.find(s, 0, STALWART)]);
    s = T.answer(s, s.ask.from); // order of the rest
    eq(names(s, s.players[0].ex), ['Haven Fire', 'Stalwart Featherfolk']);
    eq(names(s, s.players[0].deck), ['Apostle of Unkilling', 'Revolver Eagle', 'Apostle of Unkilling']);
    eq(s.players[0].pp, 2);
    s = T.attack(s, sel, s.players[1].leader);
    eq(s.players[0].pp, 4);
  });

  test('BP11-096EN Haven Fire: costs 1 less with Selena; 4 damage, and 1 to its leader with a Wasteland card in your EX area', () => {
    let s = T.game({ p0: { hand: [HAVENFIRE], ex: [EAGLE] }, p1: { field: [AP] } });
    const hf = s.players[0].hand[0];
    eq(SV.costToPlay(s, hf), 2);
    s = T.play(s, hf);
    s = T.answer(s, [s.players[1].field[0]]);
    eq(s.players[1].field.length, 0); eq(s.players[1].defense, 19);
    const s2 = T.game({ p0: { hand: [HAVENFIRE], field: [SELENA] } });
    eq(SV.costToPlay(s2, s2.players[0].hand[0]), 1);
    ok(!T.legal(s2, { type: 'play', iid: s2.players[0].hand[0] }), 'no enemy follower to select');
  });

  test('BP11-099EN Revolver Eagle: Fanfare makes a Bullet Bike; [act] 6 gives +4/+4', () => {
    let s = T.game({ p0: { hand: [EAGLE] } });
    const e = s.players[0].hand[0];
    s = T.play(s, e);
    eq(names(s, s.players[0].ex), ['Bullet Bike']);
    s = T.act(s, { type: 'activate', iid: e, idx: 0 });
    eq(s.players[0].pp, 2); eq([T.atk(s, e), T.def(s, e)], [6, 5]);
  });

  test('BP12-086EN Rola: played, only the Repair Mode; put onto the field by an ability, it also evolves', () => {
    let s = T.game({ p0: { hand: ['BP12-086EN'], evoDeck: ['BP12-087EN'] } });
    const r = s.players[0].hand[0];
    s = T.play(s, r);
    eq(names(s, s.players[0].ex), ['Repair Mode']); ok(!s.cards[r].evo, 'played: not evolved');
    let s2 = T.game({ p0: { field: ['BP09-106EN'], hand: ['BP12-086EN'], evoDeck: ['BP09-107EN', 'BP12-087EN'] } });
    const r2 = s2.players[0].hand[0];
    s2 = T.act(s2, { type: 'evolve', iid: s2.players[0].field[0] });
    s2 = T.answer(s2, [r2]); // Jeanne summons Rola
    s2 = drain(s2, { modes: () => [1] });
    ok(s2.cards[r2].evo, 'summoned: evolved'); ok(SV.chars(s2, r2).kw.Storm);
    eq(names(s2, s2.players[0].ex), ['Repair Mode']);
  });

  test('BP12-087EN Rola (evolved): option 1 deals damage equal to your Machina followers; disabled without a target', () => {
    let s = T.game({ p0: { field: ['BP12-086EN', 'BP12-086EN'], evoDeck: ['BP12-087EN'] }, p1: { field: [AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [0]);
    s = T.answer(s, [s.players[1].field[0]]);
    eq(T.def(s, s.players[1].field[0]), 1);
    let s2 = T.game({ p0: { field: ['BP12-086EN'], evoDeck: ['BP12-087EN'] } });
    s2 = T.act(s2, { type: 'evolve', iid: s2.players[0].field[0] });
    eq(s2.ask.options[0].enabled, false, 'Q1651');
  });

  test("BP13-088EN Jeanne, Despair's Maiden: pay 2 defense to destroy an enemy follower that costs 2 or less", () => {
    let s = T.game({ p0: { hand: ['BP13-088EN'] }, p1: { field: ['BP13-091EN', AP] } });
    const cheap = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.kind, 'yesno');
    s = T.answer(s, true);
    eq(s.players[0].defense, 18);
    eq(s.ask.from, [cheap], 'only the 2-cost follower');
    s = T.answer(s, [cheap]);
    eq(T.zone(s, cheap), 'cemetery');
    ok(s.ti.lostDef[0], 'lost defense (Sanguine)');
    let s2 = T.game({ p0: { hand: ['BP13-088EN'] }, p1: { field: ['BP13-091EN'] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    s2 = T.answer(s2, false);
    eq(s2.players[0].defense, 20); eq(s2.players[1].field.length, 1);
  });

  test("BP13-089EN Jeanne, Despair's Maiden (evolved): 3 to the enemy leader and each enemy follower, +3 defense", () => {
    let s = T.game({ p0: { field: ['BP13-088EN'], evoDeck: ['BP13-089EN'] }, p1: { field: [AP, 'BP01-076EN'] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.players[1].defense, 17); eq(s.players[1].field.length, 0); eq(s.players[0].defense, 23);
  });

  test('BP13-092EN Lunerian Paladin (evolved): summons a 2-cost from the top 4; Ward follower gives +2 defense', () => {
    let s = T.game({ p0: { field: ['BP13-091EN'], evoDeck: ['BP13-092EN'], deck: [AP, STALWART, AP, AP, AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.seen.length, 4); eq(names(s, s.ask.from), ['Stalwart Featherfolk']);
    s = T.answer(s, s.ask.from);
    s = drain(s);
    eq(T.zone(s, T.find(s, 0, STALWART)), 'field'); eq(s.players[0].defense, 22);
    eq(s.players[0].deck.length, 4);
  });

  test('BP15-094EN Marwynn, Repose of Despair: Fanfare makes a Torrent of Despair with 3+ enemy followers; +2 defense on the opponent main start', () => {
    let s = T.game({ p0: { hand: ['BP15-094EN'] }, p1: { field: [AP, AP, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.players[0].ex), ['Torrent of Despair']);
    let s2 = T.game({ p0: { hand: ['BP15-094EN'] }, p1: { field: [AP, AP] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.players[0].ex.length, 0, '2 enemy followers: no token');
    s2 = endTurn(s2);
    eq(s2.players[0].defense, 22); eq(s2.active, 1);
  });

  test('BP15-PR16EN Torrent of Despair: banishes the selected enemy follower; not playable without one', () => {
    let s = T.game({ p0: { ex: ['BP15-PR16EN'] }, p1: { field: [AP] } });
    const t = s.players[1].field[0], tod = s.players[0].ex[0];
    s = T.play(s, tod);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'banished'); eq(T.zone(s, tod), 'gone');
    const s2 = T.game({ p0: { ex: ['BP15-PR16EN'] } });
    ok(!T.legal(s2, { type: 'play', iid: s2.players[0].ex[0] }));
  });

  test('BP15-095EN Marwynn (evolved): destroys every other follower, yours too; still heals on the opponent main phase', () => {
    let s = T.game({ p0: { field: ['BP15-094EN', AP], evoDeck: ['BP15-095EN'] }, p1: { field: [AP, AP] } });
    const m = s.players[0].field[0];
    s = T.act(s, { type: 'evolve', iid: m });
    eq(s.players[0].field, [m]); eq(s.players[1].field.length, 0);
    s = endTurn(s);
    eq(s.players[0].defense, 22);
  });

  test('BP15-097EN Sarissa: Fanfare gives -1/-1; Storm while you have 3 cards on the field', () => {
    let s = T.game({ p0: { hand: ['BP15-097EN'], field: [AP] }, p1: { field: [AP] } });
    const sa = s.players[0].hand[0], t = s.players[1].field[0];
    s = T.play(s, sa);
    s = T.answer(s, [t]);
    eq([T.atk(s, t), T.def(s, t)], [2, 2]);
    ok(!SV.chars(s, sa).kw.Storm, '2 cards: no Storm');
    let s2 = T.game({ p0: { hand: ['BP15-097EN'], field: [AP, AP] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    ok(T.legal(s2, { type: 'attack', iid: T.find(s2, 0, 'BP15-097EN'), target: s2.players[1].leader }), '3 cards: Storm');
  });

  test('BP15-101EN Perpetual Despair: from the cemetery to the EX area (+1 defense) when a Marwynn enters your field', () => {
    let s = T.game({ p0: { hand: ['BP15-094EN'], cemetery: ['BP15-101EN'] } });
    const pd = T.find(s, 0, 'BP15-101EN');
    s = T.play(s, s.players[0].hand[0]);
    s = drain(s, { bag: (st, a) => a.options.find((o) => o.src === pd).id, yes: true });
    eq(T.zone(s, pd), 'ex'); eq(s.players[0].defense, 21);
  });

  test('BP15-101EN Perpetual Despair: [act] engage, bury this: draw a card', () => {
    let s = T.game({ p0: { field: ['BP15-101EN'] } });
    const pd = s.players[0].field[0];
    s = T.act(s, { type: 'activate', iid: pd, idx: 0 });
    eq(T.zone(s, pd), 'cemetery'); eq(s.players[0].hand.length, 1);
  });

  test("BP15-108EN Hermit of Repose: paid Fanfare +2 attack; at the opponent's main start deals its attack to each enemy follower", () => {
    let s = T.game({ p0: { hand: ['BP15-108EN'] }, p1: { field: [AP, AP, 'BP13-091EN'] } });
    const h = s.players[0].hand[0];
    s = T.play(s, h);
    s = T.answer(s, true);
    eq(T.atk(s, h), 3);
    s = endTurn(s);
    eq(s.players[1].field.length, 0);
  });

  test('BP18-097EN Seishiro: whenever your leader gains defense, 2 damage to a selected enemy follower', () => {
    let s = T.game({ p0: { field: [SEISHIRO], hand: [DELIVERER] }, p1: { field: [AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.kind, 'cards');
    s = T.answer(s, [s.players[1].field[0]]);
    eq(T.def(s, s.players[1].field[0]), 1);
  });

  test('BP18-098EN Seishiro (evolved): On Evolve may summon a Togh Keyoh follower from hand', () => {
    let s = T.game({ p0: { field: [SEISHIRO], evoDeck: ['BP18-098EN'], hand: [DELIVERER, AP] } });
    const d = T.find(s, 0, DELIVERER, 'hand');
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.ask.from, [d], 'the Apostle (forestcraft, not Togh Keyoh) is not offered');
    s = T.answer(s, [d]);
    s = drain(s);
    eq(T.zone(s, d), 'field'); eq(s.players[0].defense, 21);
  });

  test('BP18-098EN Seishiro (evolved): On Super-Evolve puts a Righteous Conviction token into the EX area', () => {
    let s = T.game({ p0: { field: [SEISHIRO], evoDeck: ['BP18-098EN'], turnsPassed: 7 } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, true); // super-evolve
    s = drain(s);
    eq(names(s, s.players[0].ex), ['Righteous Conviction']);
  });

  test('BP18-099EN Tenmei: [act] damages the enemy leader per Togh Keyoh follower, +1 defense, once per turn', () => {
    let s = T.game({ p0: { field: [TENMEI, SEISHIRO] } });
    const t = s.players[0].field[0];
    s = T.act(s, { type: 'activate', iid: t, idx: 0 });
    eq(s.players[1].defense, 18); eq(s.players[0].defense, 21);
    ok(!T.legal(s, { type: 'activate', iid: t, idx: 0 }), 'once per turn');
  });

  test('BP18-099EN Tenmei: its own leader-gains-defense trigger pings an enemy follower', () => {
    let s = T.game({ p0: { field: [TENMEI] }, p1: { field: [AP] } });
    s = T.act(s, { type: 'activate', iid: s.players[0].field[0], idx: 0 });
    s = T.answer(s, [s.players[1].field[0]]);
    eq(T.def(s, s.players[1].field[0]), 1);
  });

  test("BP18-100EN Elana, Purest Prayer: searches Elana's Prayer; +2 at the opponent's main start while it's on your field", () => {
    let s = T.game({ p0: { hand: ['BP18-100EN'], deck: [AP, 'BP02-092EN', AP] } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ["Elana's Prayer"]);
    let s2 = T.game({ p0: { field: ['BP18-100EN', 'BP02-092EN'] } });
    s2 = endTurn(s2);
    eq(s2.players[0].defense, 22);
    let s3 = T.game({ p0: { field: ['BP18-100EN'] } });
    s3 = endTurn(s3);
    eq(s3.players[0].defense, 20, "no Elana's Prayer: nothing");
  });

  test('BP18-104EN Unshakable Prayer: adds a Togh Keyoh card and a Seishiro; the next Togh Keyoh card costs 2 less', () => {
    let s = T.game({ p0: { hand: [UNSHAKABLE], deck: [SEISHIRO, DELIVERER, UNSHAKABLE, AP, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.ask.from), ['Seishiro, Admonishing Faith', 'Deliverer of Punishment']);
    s = T.answer(s, [T.find(s, 0, DELIVERER, 'deck')]);
    s = T.answer(s, [T.find(s, 0, SEISHIRO, 'deck')]);
    s = T.answer(s, s.ask.from);
    const se = T.find(s, 0, SEISHIRO, 'hand'), de = T.find(s, 0, DELIVERER, 'hand');
    eq(SV.costToPlay(s, se), 1); eq(SV.costToPlay(s, de), 0);
    s = T.play(s, de);
    eq(s.players[0].pp, 7, 'Deliverer cost 0');
    eq(SV.costToPlay(s, se), 3, 'only the next one');
  });

  test('BP18-104EN Unshakable Prayer: [act] 1, engage, bury this: +1 defense', () => {
    let s = T.game({ p0: { field: [UNSHAKABLE] } });
    const u = s.players[0].field[0];
    s = T.act(s, { type: 'activate', iid: u, idx: 0 });
    eq(T.zone(s, u), 'cemetery'); eq(s.players[0].pp, 9); eq(s.players[0].defense, 21);
  });

  test('BP18-105EN Deliverer of Punishment: +1 defense and evolves itself with a Seishiro on your field', () => {
    let s = T.game({ p0: { hand: [DELIVERER], field: [SEISHIRO], evoDeck: ['BP18-106EN'] } });
    const d = s.players[0].hand[0];
    s = T.play(s, d);
    s = drain(s);
    ok(s.cards[d].evo, 'evolved'); eq(s.players[0].defense, 22, 'Fanfare +1 and On Evolve +1');
    eq(s.ti.evolveUsed[0], false);
  });

  test('BP18-106EN Deliverer of Punishment (evolved): On Evolve +1 defense', () => {
    let s = T.game({ p0: { field: [DELIVERER], evoDeck: ['BP18-106EN'] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(s.players[0].defense, 21);
  });

  test('BP18-110EN Votary of Contemplation: with a Seishiro, +1 defense and a card', () => {
    let s = T.game({ p0: { hand: ['BP18-110EN'], field: [SEISHIRO] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].defense, 21); eq(s.players[0].hand.length, 1);
    let s2 = T.game({ p0: { hand: ['BP18-110EN'] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.players[0].defense, 20); eq(s2.players[0].hand.length, 0);
  });

  test('BP18-P47EN Votary (evolved): 2 to a follower, and 2 to its leader if your leader gained defense this turn', () => {
    const mk = () => T.game({ p0: { field: ['BP18-110EN', UNSHAKABLE], evoDeck: ['BP18-P47EN'] }, p1: { field: [AP] } });
    let s = mk();
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [s.players[1].field[0]]);
    eq(T.def(s, s.players[1].field[0]), 1); eq(s.players[1].defense, 20);
    s = mk();
    s = T.act(s, { type: 'activate', iid: s.players[0].field[1], idx: 0 });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [s.players[1].field[0]]);
    eq(s.players[1].defense, 18);
  });

  test('BP18-T08EN Righteous Conviction: damage per Togh Keyoh follower, +1 defense', () => {
    let s = T.game({ p0: { ex: ['BP18-T08EN'], field: [SEISHIRO, DELIVERER, AP] } });
    s = T.play(s, s.players[0].ex[0]);
    eq(s.players[1].defense, 18); eq(s.players[0].defense, 21);
  });

  test("BP19-092EN Erralde: your end-phase abilities trigger twice; up to 2 options with another Condemned follower", () => {
    let s = T.game({ p0: { field: [ERRALDE, AGENT] } });
    let maxes = [];
    s = endTurn(s, { modes: (st, a) => { maxes.push(a.max); return [1, 2]; } });
    eq(maxes, [2, 2], 'Erralde resolves twice, choosing up to 2');
    eq(s.players[0].defense, 24, 'Agent +1 twice, Erralde +1 twice');
    eq(s.players[0].hand.length, 2);
  });

  test('BP19-092EN Erralde: alone, choose 1; option 1 deals 4 to an enemy follower', () => {
    let s = T.game({ p0: { field: [ERRALDE] }, p1: { field: [AP, 'BP01-076EN'] } });
    let maxes = [];
    s = endTurn(s, { modes: (st, a) => { maxes.push(a.max); return [0]; } });
    eq(maxes, [1, 1]); eq(s.players[1].field.length, 0);
  });

  test('BP19-098EN Executor of the Oath: engage an Erralde to play it for 0; Fanfare summons an Agent; end phase 2 damage', () => {
    let s = T.game({ p0: { hand: [EXECUTOR], field: [ERRALDE], deck: [AP, AGENT, AP] }, p1: { field: ['BP01-076EN', 'BP01-076EN'] } });
    const ex = s.players[0].hand[0], er = s.players[0].field[0];
    s = T.act(s, { type: 'activate', iid: ex, idx: 0 });
    eq(s.ask.from, [er]);
    s = T.answer(s, [er]);
    ok(s.cards[er].engaged); eq(T.zone(s, ex), 'field'); eq(s.players[0].pp, 10); eq(s.ti.played[0], 1);
    s = T.answer(s, [T.find(s, 0, AGENT, 'deck')]);
    eq(T.zone(s, T.find(s, 0, AGENT)), 'field');
    ok(!T.legal(s, { type: 'activate', iid: ex, idx: 0 }));
    const s2 = T.game({ p0: { hand: [EXECUTOR], field: [{ id: ERRALDE, engaged: true }] } });
    ok(!T.legal(s2, { type: 'activate', iid: s2.players[0].hand[0], idx: 0 }), 'needs a reserved Erralde');
    let s3 = T.game({ p0: { field: [EXECUTOR] }, p1: { field: [AP] } });
    s3 = endTurn(s3);
    eq(T.def(s3, s3.players[1].field[0]), 1);
  });

  test('BP19-100EN Agent of the Commandments: Erralde play for 0 from the EX area; +1 defense at your end phase', () => {
    let s = T.game({ p0: { ex: [AGENT], field: [ERRALDE] } });
    const a = s.players[0].ex[0];
    s = T.act(s, { type: 'activate', iid: a, idx: 1 });
    s = T.answer(s, [s.players[0].field[0]]);
    eq(T.zone(s, a), 'field'); eq(s.players[0].pp, 10);
    let s2 = T.game({ p0: { field: [AGENT] } });
    s2 = endTurn(s2);
    eq(s2.players[0].defense, 21);
  });

  test('BP19-101EN Agent (evolved): On Evolve searches an Erralde', () => {
    let s = T.game({ p0: { field: [AGENT], evoDeck: ['BP19-101EN'], deck: [AP, ERRALDE, AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ['Erralde, Troth Convict']);
  });

  test('BP19-102EN Follower of the Precepts: end phase 1 damage; Erralde play for 0', () => {
    let s = T.game({ p0: { field: [PRECEPTS] }, p1: { field: [AP] } });
    s = endTurn(s);
    eq(T.def(s, s.players[1].field[0]), 2);
    let s2 = T.game({ p0: { hand: [PRECEPTS], field: [ERRALDE] } });
    s2 = T.act(s2, { type: 'activate', iid: s2.players[0].hand[0], idx: 0 });
    s2 = T.answer(s2, [s2.players[0].field[0]]);
    eq(s2.players[0].field.length, 2); eq(s2.players[0].pp, 10);
  });

  test('BP20-093EN Marwynn, Despair Manifest: with 3 crests banishes the selected follower and +2; else a crest', () => {
    let s = T.game({ p0: { hand: ['BP20-093EN'], ex: [CR_HIMEKA, CR_CONGREGANT, CR_SUPPLICANT] }, p1: { field: [AP] } });
    const t = s.players[1].field[0];
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [0]);
    s = T.answer(s, [t]);
    eq(T.zone(s, t), 'banished'); eq(s.players[0].defense, 22);
    let s2 = T.game({ p0: { hand: ['BP20-093EN'] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.ask.options.map((o) => o.enabled), [false, true]);
    s2 = T.answer(s2, [1]);
    eq(names(s2, s2.players[0].ex), ['Crest: Marwynn, Despair Manifest']);
  });

  test('BP20-094EN Himeka: Fanfare puts its crest into the EX area', () => {
    let s = T.game({ p0: { hand: ['BP20-094EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.players[0].ex), ['Crest: Himeka, Heir to Repose']);
  });

  test('BP20-095EN Himeka (evolved): On Evolve searches an Omen–Zealot card; On Super-Evolve pays 2 to summon one', () => {
    let s = T.game({ p0: { field: ['BP20-094EN'], evoDeck: ['BP20-095EN'], deck: [AP, DEVOTEE, 'BP20-094EN', AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(names(s, s.ask.from), ['Devotee of Repose'], 'Himeka and the Omen/Hunter Apostle excluded');
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ['Devotee of Repose']);
    let s2 = T.game({ p0: { field: ['BP20-094EN'], evoDeck: ['BP20-095EN'], turnsPassed: 7, deck: [AP, SUPPLICANT, AP] } });
    s2 = T.act(s2, { type: 'evolve', iid: s2.players[0].field[0] });
    s2 = T.answer(s2, true); // super-evolve
    eq(s2.ask.kind, 'bag');
    s2 = T.answer(s2, s2.ask.options.find((o) => o.name === 'On Super-Evolve').id);
    s2 = T.answer(s2, true); // pay 2
    s2 = T.answer(s2, s2.ask.from);
    s2 = drain(s2);
    eq(T.zone(s2, T.find(s2, 0, SUPPLICANT)), 'field'); eq(s2.players[0].pp, 7);
  });

  test('BP20-097EN Congregant of Repose: Fanfare puts its crest into the EX area', () => {
    let s = T.game({ p0: { hand: ['BP20-097EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(names(s, s.players[0].ex), ['Crest: Congregant of Repose']);
  });

  test('BP20-098EN Congregant (evolved): 2 damage per crest in your EX area', () => {
    let s = T.game({ p0: { field: ['BP20-097EN'], evoDeck: ['BP20-098EN'], ex: [CR_MARWYNN] }, p1: { field: [AP] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [s.players[1].field[0]]);
    eq(T.def(s, s.players[1].field[0]), 1);
  });

  test('BP20-100EN Shining Disenchantment: draws; with 3 crests, engage + bury deals 4', () => {
    let s = T.game({ p0: { hand: ['BP20-100EN'] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].hand.length, 1);
    ok(!T.legal(s, { type: 'activate', iid: s.players[0].field[0], idx: 0 }), 'no crests');
    let s2 = T.game({ p0: { field: ['BP20-100EN'], ex: [CR_HIMEKA, CR_CONGREGANT, CR_SUPPLICANT] }, p1: { field: [AP] } });
    const sd = s2.players[0].field[0];
    s2 = T.act(s2, { type: 'activate', iid: sd, idx: 0 });
    s2 = T.answer(s2, [s2.players[1].field[0]]);
    eq(T.zone(s2, sd), 'cemetery'); eq(s2.players[1].field.length, 0);
  });

  test('BP20-101EN Supplicant of Repose: with 3 crests, +2 defense', () => {
    let s = T.game({ p0: { hand: [SUPPLICANT], ex: [CR_HIMEKA, CR_CONGREGANT, CR_MARWYNN] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.players[0].defense, 22);
    let s2 = T.game({ p0: { hand: [SUPPLICANT], ex: [CR_HIMEKA, CR_CONGREGANT] } });
    s2 = T.play(s2, s2.players[0].hand[0]);
    eq(s2.players[0].defense, 20);
  });

  test('BP20-102EN Supplicant (evolved): On Evolve puts its crest into the EX area', () => {
    let s = T.game({ p0: { field: [SUPPLICANT], evoDeck: ['BP20-102EN'] } });
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    eq(names(s, s.players[0].ex), ['Crest: Supplicant of Repose']);
  });

  test('BP20-103EN Temple of Repose: Fanfare may take an Omen–Zealot card from the top 3', () => {
    let s = T.game({ p0: { hand: ['BP20-103EN'], deck: [AP, DEVOTEE, AP, AP] } });
    s = T.play(s, s.players[0].hand[0]);
    eq(s.ask.seen.length, 3); eq(names(s, s.ask.from), ['Devotee of Repose']);
    s = T.answer(s, s.ask.from);
    s = T.answer(s, s.ask.from);
    eq(names(s, s.players[0].hand), ['Devotee of Repose']);
  });

  test('BP20-103EN Temple of Repose: [act] with 3 crests (pay 1, engage, bury): the next leader damage this turn is 2 less', () => {
    let s = T.game({ p0: { field: ['BP20-103EN'], ex: [CR_HIMEKA, CR_CONGREGANT, CR_SUPPLICANT] } });
    const tm = s.players[0].field[0];
    s = T.act(s, { type: 'activate', iid: tm, idx: 0 });
    eq(T.zone(s, tm), 'cemetery'); eq(s.players[0].pp, 9);
    // The engine's damage door applies the replacement: 3 becomes 1, then it is spent.
    SV.dealDamage(s, s.players[0].leader, 3, { kind: 'ability' });
    eq(s.players[0].defense, 19);
    SV.dealDamage(s, s.players[0].leader, 3, { kind: 'ability' });
    eq(s.players[0].defense, 16, 'only the next time');
    const s2 = T.game({ p0: { field: ['BP20-103EN'], ex: [CR_HIMEKA, CR_CONGREGANT] } });
    ok(!T.legal(s2, { type: 'activate', iid: s2.players[0].field[0], idx: 0 }), 'needs 3 crests');
  });

  test('BP20-107EN Devotee of Repose: X damage, X = crests in your EX area', () => {
    let s = T.game({ p0: { hand: [DEVOTEE], ex: [CR_HIMEKA, CR_CONGREGANT] }, p1: { field: [AP] } });
    s = T.play(s, s.players[0].hand[0]);
    s = T.answer(s, [s.players[1].field[0]]);
    eq(T.def(s, s.players[1].field[0]), 1);
  });

  test('BP20-T07EN Crest: Marwynn: end phase 1 damage to the enemy leader (2 with 3 crests)', () => {
    let s = T.game({ p0: { ex: [CR_MARWYNN] } });
    s = endTurn(s);
    eq(s.players[1].defense, 19);
    let s2 = T.game({ p0: { ex: [CR_MARWYNN, CR_CONGREGANT, CR_SUPPLICANT] } });
    s2 = endTurn(s2, { bag: (st, a) => (a.options.find((o) => st.cards[o.src].id === CR_MARWYNN) || a.options[0]).id });
    eq(s2.players[1].defense, 18);
  });

  test('BP20-T08EN Crest: Himeka: with 3 crests, -2/-2 to the selected enemy follower', () => {
    let s = T.game({ p0: { ex: [CR_HIMEKA, CR_SUPPLICANT, CR_CONGREGANT] }, p1: { field: ['BP01-076EN', AP] } });
    const t = s.players[1].field[1];
    s = endTurn(s, { cards: (st, a) => (a.from.includes(t) ? [t] : a.from.slice(0, a.min)) });
    eq(T.atk(s, t), 1); eq(T.def(s, t), 1);
  });

  test('BP20-T09EN Crest: Congregant: with 3 crests, +1/+1 to an Omen follower on your field', () => {
    let s = T.game({ p0: { ex: [CR_CONGREGANT, CR_SUPPLICANT, CR_HIMEKA], field: [SUPPLICANT] } });
    const f = s.players[0].field[0];
    s = endTurn(s);
    eq([T.atk(s, f), T.def(s, f)], [3, 3]);
  });

  test('BP20-T10EN Crest: Supplicant: +1 defense at your end phase only with 3 crests', () => {
    let s = T.game({ p0: { ex: [CR_SUPPLICANT] } });
    s = endTurn(s);
    eq(s.players[0].defense, 20);
    let s2 = T.game({ p0: { ex: [CR_SUPPLICANT, CR_CONGREGANT, CR_HIMEKA] } });
    s2 = endTurn(s2);
    eq(s2.players[0].defense, 21);
  });

  test('review: 5 BP18-P47EN Votary (evolved): a defense change that raised your leader counts as gaining defense; a lowering one does not', () => {
    const mk = () => T.game({ p0: { field: ['BP18-110EN'], evoDeck: ['BP18-P47EN'], defense: 15 }, p1: { field: [AP] } });
    let s = mk();
    SV.setDefense(s, 0, 18); // "change your leader's defense to 18" earlier this turn (engine door, logged as setDefense)
    s = T.act(s, { type: 'evolve', iid: s.players[0].field[0] });
    s = T.answer(s, [s.players[1].field[0]]);
    eq(s.players[1].defense, 18, 'raised: 2 to the enemy leader');
    let s2 = mk();
    SV.setDefense(s2, 0, 10);
    s2 = T.act(s2, { type: 'evolve', iid: s2.players[0].field[0] });
    s2 = T.answer(s2, [s2.players[1].field[0]]);
    eq(s2.players[1].defense, 20, 'lowered: no leader damage');
  });

  test('review: x.playFree zeroCost: Filene (BP15-058EN) makes the Erralde "costs 0" play of Executor cost 1 (Q1927/Q1928)', () => {
    let s = T.game({ active: 1, p0: { hand: [EXECUTOR], field: [ERRALDE] }, p1: { hand: ['BP15-058EN'], maxPP: 7 } });
    s = T.play(s, s.players[1].hand[0]); // Overflow: during p0's next turn any card p0 plays costs 1 more
    s = T.endTurn(s);
    eq(s.active, 0); const pp = s.players[0].pp;
    const ex = T.find(s, 0, EXECUTOR, 'hand');
    const broke = SV.clone(s); broke.players[0].pp = 0;
    ok(!T.legal(broke, { type: 'activate', iid: ex, idx: 0 }), 'the +1 must be payable');
    s = T.act(s, { type: 'activate', iid: ex, idx: 0 });
    s = T.answer(s, [T.find(s, 0, ERRALDE)]);
    s = drain(s);
    eq(T.zone(s, ex), 'field'); eq(s.players[0].pp, pp - 1, 'paid the cost increase');
  });
})();
