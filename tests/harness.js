// Test harness: a tiny runner plus position builders. Tests build an exact position, act only
// through SV.apply, and assert the SIDE EFFECT (KB LESSONS §2.3).
(function () {
  const SV = globalThis.SV;
  const T = (SV.T = { tests: [] });
  T.test = (name, fn) => T.tests.push({ name, fn });
  T.eq = (a, b, msg) => {
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) throw new Error(`${msg || 'eq'}: expected ${sb}, got ${sa}`);
  };
  T.ok = (v, msg) => { if (!v) throw new Error(msg || 'expected truthy'); };
  T.throws = (fn, msg) => { let threw = false; try { fn(); } catch (e) { threw = true; } if (!threw) throw new Error(msg || 'expected a throw'); };

  // Fillers with no text but an evolve line (Apostle of Unkilling 3/3/3, evolve 1) and with Ward
  // (Lunerian Paladin 2/1/1, evolve 1), Storm (Dark Dragoon Forte 5/1, cost 4; Genesis Dragon 9: 10/12).
  T.FILLER = 'BP05-004EN';
  T.WARD = 'BP13-091EN';
  T.STORM = 'BP01-076EN';
  T.LEADER = 'BP01-LD10EN';

  // T.game(layout) -> a main-phase state with exactly the given cards.
  // layout = { active:0, first:0, turn:5, p0:{ hand:[id], field:[id|{id, engaged, dmg, fresh, evo, mods}],
  //   ex:[id], cemetery:[id], banished:[id], evoDeck:[id], deck:[id] (top first; default 15 fillers),
  //   pp, maxPP, ep, sep, defense, turnsPassed }, p1:{...} }
  // A field card is "on the field since the start of the turn" unless {fresh:true}.
  T.game = function (layout = {}) {
    const empty = { name: 'T', leader: T.LEADER, main: [], evolve: [] };
    let s = SV.newGame({ decks: [empty, empty], seed: layout.seed || 1, first: 0 });
    s = SV.clone(s);
    s.ask = null; s.pendingJob = null; s.pendingSnap = null; s.queue = []; s.bag = []; s.window = null; s.attack = null; s.winner = null; s.endReason = null;
    s.phase = 'main';
    s.active = layout.active || 0;
    s.first = layout.first == null ? 0 : layout.first;
    s.turn = layout.turn || 9;
    s.ti = SV._internal.freshTurnInfo();
    s.log = [];
    for (const p of [0, 1]) {
      const L = layout['p' + p] || {};
      const P = s.players[p];
      P.maxPP = L.maxPP == null ? 10 : L.maxPP;
      P.pp = L.pp == null ? P.maxPP : L.pp;
      P.ep = L.ep || 0; P.sep = L.sep == null ? 1 : L.sep; P.drewFromEmpty = false;
      P.defense = L.defense == null ? 20 : L.defense;
      P.turnsPassed = L.turnsPassed == null ? 4 : L.turnsPassed;
      const mk = (id, zone, extra = {}) => {
        if (!SV.CARDS[id]) throw new Error(`T.game: unknown card ${id}`);
        return SV.newCard(s, id, p, zone, extra);
      };
      P.hand = (L.hand || []).map((id) => mk(id, 'hand'));
      P.ex = (L.ex || []).map((id) => mk(id, 'ex', { faceup: true }));
      P.field = (L.field || []).map((e) => {
        const o = typeof e === 'string' ? { id: e } : e;
        const iid = mk(o.id, 'field', { engaged: !!o.engaged, dmg: o.dmg || 0, enteredTurn: o.fresh ? s.turn : 1, faceup: true, mods: o.mods || [], counters: o.counters || {} });
        if (o.evo) {
          const e2 = mk(o.evo, 'evolve', { faceup: true, evoOf: iid });
          s.cards[iid].evo = e2; s.cards[iid].evolvedTurn = 1;
        }
        return iid;
      });
      P.cemetery = (L.cemetery || []).map((id) => mk(id, 'cemetery', { faceup: true }));
      P.banished = (L.banished || []).map((id) => mk(id, 'banished', { faceup: true }));
      P.evoDeck = (L.evoDeck || []).map((id) => mk(id, 'evoDeck'));
      P.deck = (L.deck || Array(15).fill(T.FILLER)).map((id) => mk(id, 'deck'));
    }
    return s;
  };

  // Find the instance id of a card by definition id (first match) for a player, optionally in a zone.
  T.find = (s, p, id, zone) => {
    for (const c of Object.values(s.cards)) if (c.owner === p && c.id === id && (!zone || c.zone === zone)) return c.iid;
    throw new Error(`T.find: ${id} not found for p${p}${zone ? ' in ' + zone : ''}`);
  };
  T.findAll = (s, p, id) => Object.values(s.cards).filter((c) => c.owner === p && c.id === id).map((c) => c.iid);

  // Apply the first legal action matching `m` (partial object). On failure, list what was legal.
  T.act = (s, m) => {
    const legal = SV.legalActions(s);
    const a = legal.find((l) => Object.entries(m).every(([k, v]) => l[k] === v));
    if (!a) throw new Error(`T.act: no legal action matching ${JSON.stringify(m)}; legal: ${JSON.stringify(legal).slice(0, 600)}; ask: ${JSON.stringify(s.ask)}`);
    return SV.apply(s, a);
  };
  T.answer = (s, value) => {
    if (!s.ask) throw new Error(`T.answer: no pending ask (wanted to answer ${JSON.stringify(value)})`);
    return SV.apply(s, { type: 'answer', value });
  };
  // Answer every pending question with `value` while the ask's prompt matches `re`.
  T.answerWhile = (s, re, value) => { while (s.ask && re.test(s.ask.prompt)) s = T.answer(s, value); return s; };
  T.pass = (s) => SV.apply(s, { type: 'pass' });
  T.legal = (s, m) => SV.legalActions(s).some((l) => Object.entries(m).every(([k, v]) => l[k] === v));
  T.zone = (s, iid) => s.cards[iid].zone;
  T.def = (s, iid) => SV.chars(s, iid).def;
  T.atk = (s, iid) => SV.chars(s, iid).atk;
  // Play a card from hand/EX; answers the Ward "enter engaged?" question with `engaged` if asked.
  T.play = (s, iid, o = {}) => {
    s = T.act(s, { type: 'play', iid });
    if (s.ask && /has Ward/.test(s.ask.prompt)) s = T.answer(s, !!o.engaged);
    return s;
  };
  // Attack and let the opponent pass any Quick window; returns the state after the attack ends.
  T.attack = (s, iid, target) => {
    s = T.act(s, { type: 'attack', iid, target });
    while (s.window && s.window.kind === 'attack') s = T.pass(s);
    return s;
  };
  T.endTurn = (s) => {
    s = T.act(s, { type: 'end' });
    while (s.ask && /Ward followers to engage/.test(s.ask.prompt)) s = T.answer(s, []);
    while (s.window) s = T.pass(s);
    return s;
  };

  T.runAll = function (filter) {
    let pass = 0, fail = 0;
    const fails = [];
    for (const t of T.tests) {
      if (filter && !t.name.includes(filter)) continue;
      try { t.fn(); pass++; } catch (e) { fail++; fails.push(`FAIL ${t.name}: ${e.message}`); }
    }
    return { pass, fail, fails };
  };
})();
