// The rules engine. Surface (docs/ENGINE-API.md): newGame, legalActions, apply, whoActs,
// isTerminal, chars, costToPlay, whyNot, actionsFor. CR = Comprehensive Rules v1.26.1.
//
// Control flow (lorecannae's spine, PLAN D9): apply() copies the state and performs the action
// as a JOB; settle() then runs Confirmation Timing (CR 10.5: rules handling, then pending
// automatic abilities, active player first) and the queued jobs until a player must act. A job
// that needs a decision throws an Ask: the partly-resolved state stays on screen, the pre-job
// snapshot is kept, and the answer re-runs the job from the snapshot with every answer so far.
// The opponent's Quick windows (CR 7.4.5, 8.4.7) are queue steps whose controller is the other
// seat: s.window is set and only that seat acts until it passes.
(function () {
  const SV = globalThis.SV;
  const { Illegal } = SV;

  // ---------------------------------------------------------------- card definitions
  const EMPTY = Object.freeze({});
  const ABIL = (id) => (SV.ABIL && SV.ABIL[id]) || EMPTY;
  SV.abil = ABIL;
  // The face a card shows: an evolved follower reads its evolve-zone card (CR 5.16.1.2).
  const faceId = (s, iid) => { const c = s.cards[iid]; return c.evo ? s.cards[c.evo].id : c.id; };
  SV.faceId = faceId;
  const def = (s, iid) => SV.CARDS[faceId(s, iid)];
  SV.def = function (iidOrId, s) {
    if (s && s.cards[iidOrId]) return def(s, iidOrId);
    return SV.CARDS[iidOrId];
  };
  const baseDef = (s, iid) => SV.CARDS[s.cards[iid].id];

  // Printed keywords and engine-read abilities, parsed once per card definition.
  const PARSED = {};
  SV.parsed = function (d) {
    if (PARSED[d.no]) return PARSED[d.no];
    const kw = {};
    let quick = false, evolveCost = null, serveCost = null;
    for (const raw of (d.text || '').split('\n')) {
      if (/^-{3,}$/.test(raw)) continue; // the ruled line separates ability groups (Dead to Rights, Sheffy); both are read
      const l = raw.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      if (/^((Ward|Storm|Rush|Bane|Drain|Assail|Intimidate|Aura)\. ?)+$/.test(l)) for (const m of l.matchAll(/(\w+)\./g)) kw[m[1]] = true;
      else if (l === '[quick]') quick = true; // CR 12.3.2 a standalone Quick icon
      let m;
      if ((m = l.match(/^\[evolve\] ?\[cost(\d+)\]: Evolve this( follower)?\.$/))) evolveCost = +m[1];
      if ((m = l.match(/^\[feed\] ?\[cost(\d+)\]: Race this follower\.$/))) serveCost = +m[1];
    }
    const type = d.typeLine.toLowerCase().includes('crest') ? 'crest' : d.typeLine.toLowerCase().includes('equipment') ? 'equipment' : d.type;
    return (PARSED[d.no] = { kw, quick, evolveCost, serveCost, type });
  };

  // ---------------------------------------------------------------- logging
  function log(s, who, type, data = {}) {
    const e = { n: s.logN++, turn: s.turn, who, type, ...data };
    if (s._via != null && e.via === undefined) e.via = s._via;
    s.log.push(e);
    return e;
  }
  SV.log = log;

  // ---------------------------------------------------------------- new game (CR 6.2)
  const ZONES = ['deck', 'hand', 'ex', 'field', 'cemetery', 'banished', 'evoDeck'];
  SV.ZONES = ZONES;
  function newCard(s, id, owner, zone, extra = {}) {
    const iid = 'c' + s.nextIid++;
    s.cards[iid] = {
      iid, id, owner, ctrl: owner, zone, engaged: false, dmg: 0, mods: [], counters: {},
      evo: null, evoOf: null, superEvolved: false, enteredTurn: null, evolvedTurn: null,
      faceup: false, token: !!SV.CARDS[id].token, links: [], linkedTo: null, gaveDrive: false, ...extra,
    };
    return iid;
  }
  SV.newCard = newCard;

  SV.newGame = function (opts) {
    const seed = opts.seed == null ? (Date.now() & 0x7fffffff) : (typeof opts.seed === 'number' ? opts.seed : SV.hashSeed(opts.seed));
    const s = {
      seed, rng: seed | 0, turn: 0, active: 0, first: 0, phase: 'setup',
      winner: null, endReason: null,
      players: [], cards: {}, nextIid: 1,
      ask: null, pendingJob: null, pendingSnap: null, queue: [], bag: [], bagSeq: 1,
      window: null, attack: null, resolving: [],
      effects: [], ti: null, log: [], logN: 0, revealed: { 0: [], 1: [] }, _via: null,
      names: opts.names || ['Player 1', 'Player 2'],
    };
    for (let p = 0; p < 2; p++) {
      const deck = resolveDeck(opts.decks[p]);
      const P = {
        name: s.names[p], deckName: deck.name, deckId: deck.id || null, cls: deck.cls || null,
        leader: null, defense: 20, pp: 0, maxPP: 0, ep: 0, sep: 0, turnsPassed: 0,
        deck: [], hand: [], ex: [], field: [], cemetery: [], banished: [], evoDeck: [],
        fieldLimit: 5, exLimit: 5, handLimit: 7, drewFromEmpty: false,
      };
      s.players.push(P);
      if (deck.leader) P.leader = newCard(s, deck.leader, p, 'leader', { faceup: true });
      for (const [id, qty] of deck.main) {
        if (!SV.CARDS[id]) throw new Error(`unknown card ${id}`);
        for (let i = 0; i < qty; i++) P.deck.push(newCard(s, id, p, 'deck'));
      }
      for (const [id, qty] of deck.evolve || []) {
        if (!SV.CARDS[id]) throw new Error(`unknown card ${id}`);
        for (let i = 0; i < qty; i++) P.evoDeck.push(newCard(s, id, p, 'evoDeck'));
      }
      SV.shuffleInPlace(s, P.deck); // CR 6.2.1.4
    }
    // CR 6.2.1.6 a random player decides; this engine lets the caller fix `first` (default random).
    s.first = opts.first === 0 || opts.first === 1 ? opts.first : SV.rngInt(s, 2);
    s.active = s.first;
    s.ti = freshTurnInfo();
    log(s, s.first, 'start', { first: s.first });
    for (let p = 0; p < 2; p++) for (let i = 0; i < 4; i++) drawCard(s, p, true); // CR 6.2.1.7
    s.phase = 'mulligan';
    s.queue.push({ k: 'mulligan', p: s.first, answers: [] }, { k: 'mulligan', p: 1 - s.first, answers: [] },
      { k: 'setupPoints', answers: [] }, { k: 'beginTurn', p: s.first, answers: [] });
    settle(s);
    return s;
  };

  function resolveDeck(d) {
    if (typeof d === 'string') {
      const found = SV.DECKS.find((x) => x.id === d);
      if (!found) throw new Error(`unknown deck ${d}`);
      return found;
    }
    return d;
  }

  function freshTurnInfo() {
    return { played: [0, 0], evolveUsed: [false, false], lostDef: [false, false], once: {}, attacks: {}, trig: {}, spells: [0, 0], destroyedEnemies: [0, 0] };
  }

  // ---------------------------------------------------------------- characteristics (one door)
  // chars() is the only reader of attack/defense/keywords/flags (CR 10.9.1: printed or evolved
  // face, then ability changes, then other persistent effects, then numbers). Auras must read
  // definitions and plain state, never chars(), so evaluation order is fixed and cannot recurse.
  SV.chars = function (s, iid) {
    const c = s.cards[iid];
    if (c.zone === 'leader') {
      const P = s.players[c.owner];
      const r = { iid, id: c.id, owner: c.owner, ctrl: c.owner, name: SV.CARDS[c.id].name, type: 'leader', cls: SV.CARDS[c.id].cls, def: P.defense, atk: 0, kw: {}, flags: {}, traits: [], activated: [], evolved: false };
      for (const x of auraSources(s)) { const ax = ABIL(faceId(s, x)); if (ax.leaderAuras) for (const fn of ax.leaderAuras) fn(s, x, c.owner, r); }
      return r;
    }
    const d = def(s, iid);
    const pd = SV.parsed(d);
    const kw = { ...pd.kw };
    const base = baseDef(s, iid);
    const r = {
      iid, id: d.no, owner: c.owner, ctrl: c.ctrl, name: d.name, cls: d.cls, universe: d.universe,
      type: pd.type, evolved: !!c.evo || d.evolved, superEvolved: c.superEvolved, advanced: !!d.advanced, token: !!d.token,
      traits: d.traits.slice(), cost: base.cost, // CR 5.16.1.2 an evolved card keeps its own cost
      atk: d.atk || 0, maxDef: d.def || 0, dmg: c.dmg, engaged: c.engaged,
      kw, quick: pd.quick, flags: {}, activated: [],
    };
    if (c.zone === 'field' || c.zone === 'ex' || c.zone === 'equip') {
      for (const x of auraSources(s)) {
        const ax = ABIL(faceId(s, x));
        if (ax.auras) for (const fn of ax.auras) fn(s, x, iid, r);
      }
      // Boxed (CR 5.31.2): loses every ability it had when Boxed; abilities given after it are kept (Q1487).
      for (const m of c.mods) if (m.on !== false) { if (m.flags && m.flags.loseAbilities) { r.kw = {}; r.quick = false; } applyMod(r, m); }
      for (const e of s.effects) if (e.mod && e.on !== false && e.applies && SV.EFFECT_FILTERS[e.applies](s, e, iid)) applyMod(r, e.mod);
      for (const x of auraSources(s)) {
        const ax = ABIL(faceId(s, x));
        if (ax.lateAuras) for (const fn of ax.lateAuras) fn(s, x, iid, r);
      }
    }
    if (c.mods.some((m) => m.maneuver && m.on !== false)) r.type = 'follower';
    if (r.flags.setAtk != null) r.atk = r.flags.setAtk;
    if (r.flags.setDef != null) r.maxDef = r.flags.setDef;
    r.def = r.maxDef - c.dmg;
    // Activated abilities (engine-read evolve/serve plus scripted ones).
    if (c.zone !== 'deck') r.activated = describeActivated(s, iid, r);
    return r;
  };

  // Cards whose passive abilities are valid right now (CR 10.3.5, 10.3.6, 14.5.2.1.2).
  function auraSources(s) {
    const out = [];
    for (const p of [s.active, 1 - s.active]) {
      const P = s.players[p];
      for (const i of P.field) out.push(i);
      for (const i of P.ex) if (abilZoneOk(s, i, 'ex')) out.push(i);
      for (const i of Object.values(s.cards)) if (i.zone === 'equip' && i.owner === p) out.push(i.iid);
    }
    return out;
  }
  SV.auraSources = auraSources;
  function abilZoneOk(s, iid, zone) {
    const d = def(s, iid);
    const t = SV.parsed(d).type;
    if (zone === 'field') return t === 'follower' || t === 'amulet';
    if (zone === 'ex') return t === 'crest' || !!ABIL(d.no).exAuras;
    if (zone === 'equip') return t === 'equipment';
    return false;
  }

  function applyMod(r, m) {
    if (m.atk) r.atk += m.atk;
    if (m.def) r.maxDef += m.def;
    if (m.kw) for (const [k, v] of Object.entries(m.kw)) { if (v === false) delete r.kw[k]; else r.kw[k] = v; }
    if (m.flags) Object.assign(r.flags, m.flags);
    if (m.traits) for (const t of m.traits) if (!r.traits.includes(t)) r.traits.push(t);
    if (m.setAtk != null) r.flags.setAtk = m.setAtk;
    if (m.setDef != null) r.flags.setDef = m.setDef;
  }
  SV.applyMod = applyMod;

  // Filters for global effects (s.effects[].applies), named so state stays plain data.
  SV.EFFECT_FILTERS = {
    allFollowers: (s, e, iid) => s.cards[iid].zone === 'field' && SV.isFollower(s, iid),
    playerFollowers: (s, e, iid) => s.cards[iid].zone === 'field' && s.cards[iid].ctrl === e.p && SV.isFollower(s, iid),
    enemyFollowers: (s, e, iid) => s.cards[iid].zone === 'field' && s.cards[iid].ctrl !== e.p && SV.isFollower(s, iid),
    listed: (s, e, iid) => e.iids.includes(iid),
  };

  // ---------------------------------------------------------------- small readers
  // CR 5.32 Maneuver: an amulet with attack and defense is a follower for the rest of the turn.
  SV.isFollower = (s, iid) => SV.parsed(def(s, iid)).type === 'follower' || s.cards[iid].mods.some((m) => m.maneuver && m.on !== false);
  SV.isAmulet = (s, iid) => SV.parsed(def(s, iid)).type === 'amulet';
  SV.isSpell = (s, iid) => SV.parsed(def(s, iid)).type === 'spell';
  SV.field = (s, p) => (p == null ? [...s.players[s.active].field, ...s.players[1 - s.active].field] : s.players[p].field.slice());
  SV.followers = (s, p) => SV.field(s, p).filter((i) => SV.isFollower(s, i));
  SV.amulets = (s, p) => SV.field(s, p).filter((i) => SV.isAmulet(s, i));
  SV.leaderOf = (s, p) => s.players[p].leader;
  SV.cardName = (s, iid) => def(s, iid).name;
  // CR 2.1.2 "[name]" refers to any card with that name or whose name contains it.
  SV.nameHas = (s, iid, name) => def(s, iid).name.includes(name);
  SV.hasTrait = (s, iid, t) => SV.chars(s, iid).traits.includes(t);
  SV.overflow = (s, p) => s.players[p].maxPP >= 7; // CR 13.4.1.2
  SV.sanguine = (s, p) => s.active === p && s.ti.lostDef[p]; // CR 13.5.2.2
  SV.combo = (s, p) => s.ti.played[p]; // CR 13.2.1.2
  SV.spellchain = (s, p) => s.players[p].cemetery.filter((i) => SV.parsed(baseDef(s, i)).type === 'spell').length; // CR 13.3.1
  SV.necrocharge = (s, p) => s.players[p].cemetery.length; // CR 13.5.1
  SV.superEvolveOK = (s, p) => s.players[p].turnsPassed >= (p === s.first ? 7 : 6) && s.players[p].sep > 0; // CR 12.2.4

  // ---------------------------------------------------------------- zone moves (one door)
  function zoneArr(s, c) {
    const P = s.players[c.owner];
    return { deck: P.deck, hand: P.hand, ex: P.ex, field: s.players[c.ctrl].field, cemetery: P.cemetery, banished: P.banished, evoDeck: P.evoDeck }[c.zone] || null;
  }
  function removeFromZone(s, iid) {
    const c = s.cards[iid];
    const arr = zoneArr(s, c);
    if (arr) { const k = arr.indexOf(iid); if (k >= 0) arr.splice(k, 1); }
    const k = s.resolving.indexOf(iid);
    if (k >= 0) s.resolving.splice(k, 1);
  }
  SV._removeFromZone = removeFromZone;

  // Where a token, advanced card or linked card may exist (CR 9.1.4, 9.2.2, 14.5.2.1.1).
  function tokenMayExist(d, to) {
    const t = SV.parsed(d).type;
    if (t === 'crest') return to === 'ex';
    if (t === 'equipment') return to === 'equip';
    if (t === 'spell') return to === 'ex' || to === 'resolution';
    return to === 'ex' || to === 'field' || to === 'resolution';
  }

  // move(): every zone change goes through here. Leaving the field strips per-field state and
  // breaks links: the evolve-zone card goes faceup to the evolve deck area (CR 11.6.1), Carrots
  // and Drive Points likewise (11.8, 11.10), equipment tokens are eliminated (11.11). Tokens
  // moved where they may not exist are eliminated (9.1.4.4); advanced cards go back to the
  // evolve deck faceup (9.2.2). Returns the zone the card came from.
  function move(s, iid, to, opt = {}) {
    const c = s.cards[iid];
    const from = c.zone;
    const fromCtrl = c.ctrl;
    removeFromZone(s, iid);
    if (from === 'field' && to !== 'field') {
      if (c.evo) { const e = s.cards[c.evo]; e.zone = 'evoDeck'; e.faceup = true; e.evoOf = null; s.players[e.owner].evoDeck.push(e.iid); c.evo = null; }
      for (const l of c.links) {
        const lc = s.cards[l];
        if (!lc) continue;
        if (lc.zone === 'equip') { lc.zone = 'gone'; lc.linkedTo = null; log(s, lc.owner, 'eliminate', { iid: l }); }
        else if (lc.zone === 'race' || lc.zone === 'drive') { lc.zone = 'evoDeck'; lc.faceup = true; lc.linkedTo = null; s.players[lc.owner].evoDeck.push(l); }
      }
      c.links = [];
      c.engaged = false; c.dmg = 0; c.mods = []; c.counters = {}; c.superEvolved = false;
      c.enteredTurn = null; c.evolvedTurn = null; c.gaveDrive = false; c.ctrl = c.owner;
      if (s.ti) for (const k of Object.keys(s.ti.once)) if (k.includes(`:${iid}:`)) delete s.ti.once[k];
    }
    if (from === 'ex' && to !== 'field' && to !== 'resolution') { c.mods = []; c.counters = {}; }
    const d = SV.CARDS[c.id];
    if (d.token && !tokenMayExist(d, to)) { c.zone = 'gone'; log(s, c.owner, 'eliminate', { iid }); return from; }
    if (d.advanced && !['field', 'ex', 'resolution', 'evoDeck'].includes(to)) { placeIn(s, iid, 'evoDeck', { faceup: true }); return from; }
    placeIn(s, iid, to, opt);
    // "whenever a card is put from a deck into the cemetery" (bury the top card, discard from the deck …)
    if (from === 'deck' && to === 'cemetery') emit(s, { type: 'deckToCemetery', iid, p: c.owner });
    if (to === 'field' && from !== 'field') { c.ctrl = opt.ctrl == null ? (from === 'resolution' || from === 'hand' || from === 'ex' ? fromCtrl : c.owner) : opt.ctrl; }
    return from;
  }
  function placeIn(s, iid, to, opt = {}) {
    const c = s.cards[iid];
    const P = s.players[c.owner];
    c.zone = to;
    c.faceup = to === 'evoDeck' ? !!opt.faceup : !['deck', 'hand'].includes(to);
    if (to === 'deck') {
      if (opt.pos === 'top') P.deck.unshift(iid);
      else if (typeof opt.pos === 'number') P.deck.splice(Math.min(opt.pos, P.deck.length), 0, iid); // CR 4.1.3.1
      else P.deck.push(iid);
    } else if (to === 'hand') P.hand.push(iid);
    else if (to === 'ex') P.ex.push(iid);
    else if (to === 'cemetery') P.cemetery.unshift(iid);
    else if (to === 'banished') P.banished.unshift(iid);
    else if (to === 'evoDeck') P.evoDeck.push(iid);
    else if (to === 'field') { const ctrl = opt.ctrl == null ? c.ctrl : opt.ctrl; s.players[ctrl].field.push(iid); c.ctrl = ctrl; }
    else if (to === 'resolution') s.resolving.push(iid);
  }
  SV.move = move;
  SV._placeIn = placeIn;

  function drawCard(s, p, silent) {
    const P = s.players[p];
    if (!P.deck.length) { P.drewFromEmpty = true; return null; } // CR 5.10.1.1 loses at the next rules handling
    const iid = P.deck[0];
    move(s, iid, 'hand');
    if (!silent) { log(s, p, 'draw', { iid }); emit(s, { type: 'drawn', iid, p }); }
    return iid;
  }
  SV.drawCard = drawCard;

  // ---------------------------------------------------------------- damage, defense (doors)
  // CR 5.14: deal damage = reduce defense. Replacement effects that change the amount (5.14.2,
  // 10.2.1.3.2) are applied by every valid source's replaceDamage hook, then s.effects with
  // `replaceDamage`. 0 or less damage is not dealt at all (1.3.2.2).
  function dealDamage(s, target, amount, o = {}) {
    const c = s.cards[target];
    const isLeader = c.zone === 'leader';
    if (!isLeader && (c.zone !== 'field' || !SV.isFollower(s, target))) return 0; // CR 5.14.1.2
    // Q1537: 0 or less damage is not dealt, so "deals that much plus 1 instead" never applies to it.
    if (!(amount > 0)) return 0;
    const ev = { target, amount, src: o.src ?? null, kind: o.kind || 'ability', leader: isLeader, p: c.owner };
    for (const x of auraSources(s)) {
      const ax = ABIL(faceId(s, x));
      if (ax.replaceDamage) ev.amount = ax.replaceDamage(s, x, ev);
    }
    for (const e of s.effects.slice()) if (e.replaceDamage && e.on !== false) {
      const fn = SV.REPLACERS[e.replaceDamage];
      if (fn) { const r = fn(s, e, ev); if (r !== undefined) ev.amount = r; }
    }
    s.effects = s.effects.filter((e) => !e.spent);
    const n = Math.max(0, ev.amount | 0);
    if (n <= 0) { log(s, o.src != null ? s.cards[o.src].ctrl : s.active, 'damage', { iid: target, amount: 0, src: ev.src, kind: ev.kind }); return 0; }
    if (isLeader) {
      const P = s.players[c.owner];
      P.defense -= n;
      if (s.active === c.owner) s.ti.lostDef[c.owner] = true; // CR 13.5.2.2
    } else c.dmg += n;
    log(s, o.src != null ? s.cards[o.src].ctrl : s.active, 'damage', { iid: target, amount: n, src: ev.src, kind: ev.kind, leader: isLeader });
    emit(s, { type: 'damaged', iid: target, amount: n, src: ev.src, kind: ev.kind, leader: isLeader, p: c.owner });
    if (isLeader) emit(s, { type: 'defenseLost', p: c.owner, amount: n, src: ev.src });
    // CR 12.13 Drain: attack damage dealt by a Drain follower is an automatic ability.
    if (ev.kind === 'attack' && ev.src != null && s.cards[ev.src].zone === 'field' && SV.chars(s, ev.src).kw.Drain) {
      addToBag(s, s.cards[ev.src].ctrl, ev.src, faceId(s, ev.src), 'drain', 'Drain', { amount: n });
    }
    return n;
  }
  SV.dealDamage = dealDamage;
  SV.REPLACERS = {
    // "The next time your leader would take damage this turn, it takes that much -N instead."
    leaderNextMinus: (s, e, ev) => { if (ev.leader && ev.p === e.p && ev.amount > 0) { e.spent = true; return ev.amount - e.n; } return undefined; },
  };

  // Increase a leader's defense ("give your leader [defense]+N", Drain). No upper limit (CR 2.8.3).
  function heal(s, p, n, o = {}) {
    if (n <= 0) return 0;
    s.players[p].defense += n;
    log(s, p, 'heal', { p, amount: n, total: s.players[p].defense, src: o.src ?? null });
    emit(s, { type: 'healed', p, amount: n });
    return n;
  }
  SV.heal = heal;
  // "Change a leader's defense to N" (CR 5.27.2): not damage and not a heal; a decrease counts as
  // lost defense for Sanguine (13.5.2.2).
  function setDefense(s, p, v, o = {}) {
    const P = s.players[p];
    const before = P.defense;
    if (v === before) return 0;
    P.defense = v;
    if (v < before && s.active === p) s.ti.lostDef[p] = true;
    log(s, p, 'setDefense', { p, from: before, total: v, src: o.src ?? null });
    if (v < before) emit(s, { type: 'defenseLost', p, amount: before - v, src: o.src ?? null, set: true });
    else emit(s, { type: 'healed', p, amount: v - before, set: true });
    return v - before;
  }
  SV.setDefense = setDefense;

  function engage(s, iid, cause) {
    const c = s.cards[iid];
    if (c.engaged) return false; // CR 1.3.2.1
    c.engaged = true;
    if (cause === 'effect') log(s, c.ctrl, 'engage', { iid });
    if (c.zone === 'field') emit(s, { type: 'engaged', iid, cause });
    return true;
  }
  function refresh(s, iid, cause) {
    const c = s.cards[iid];
    if (!c.engaged) return false;
    c.engaged = false;
    if (cause === 'effect') log(s, c.ctrl, 'refresh', { iid });
    return true;
  }
  SV.engage = engage;
  SV.refresh = refresh;

  // Final card information (CR 10.11, 10.7.4.1.2): what a leaving card looked like on the field.
  function snapshot(s, iid) {
    const r = SV.chars(s, iid);
    return { name: r.name, id: r.id, cls: r.cls, type: r.type, atk: r.atk, def: r.def, cost: r.cost, traits: r.traits, kw: r.kw, evolved: r.evolved, superEvolved: r.superEvolved, token: r.token, owner: r.owner, ctrl: r.ctrl, boxed: !!r.flags.loseAbilities };
  }
  SV.snapshot = snapshot;

  // leaveField(): destroy / bury / banish / return all route here so leave triggers fire once.
  // Stack (CR 13.3.2.2): a card with Stack counters loses one instead of leaving.
  function leaveField(s, iid, to, o = {}) {
    const c = s.cards[iid];
    if (c.zone !== 'field') return false;
    if (SV.hasStack(s, iid) && (c.counters.stack || 0) > 0 && !o.noStackSave) {
      c.counters.stack--;
      log(s, c.ctrl, 'stackSave', { iid, left: c.counters.stack });
      return false;
    }
    const info = snapshot(s, iid);
    const owner = c.owner;
    const by = o.by ?? null;
    to = replaceLeaveTo(s, iid, to, o.verb || 'leave');
    move(s, iid, to, o);
    log(s, owner, o.verb || 'leave', { iid, to, by, info });
    emitLeave(s, [{ iid, to, by, info, verb: o.verb, ctrl: info.ctrl }]);
    return true;
  }
  // CR 10.7.4.2: cards leaving together all move first; then each leave event is seen by the
  // whole group (Last Words of every card in the group, "whenever another follower is destroyed").
  function emitLeave(s, list) {
    const extra = list.map((e) => e.iid);
    // CR 10.7.4.1.2: a card that left the field is read as it was there (an evolved follower's
    // Last Words are its evolved face's).
    const faces = Object.fromEntries(list.map((e) => [e.iid, e.info.id]));
    for (const e of list) {
      const ev = { type: 'leave', iid: e.iid, to: e.to, by: e.by, info: e.info, verb: e.verb || 'leave', p: e.info.owner, ctrl: e.ctrl };
      emit(s, ev, extra, faces);
      if (e.verb === 'destroy') emit(s, { ...ev, type: 'destroyed' }, extra, faces);
    }
  }
  // "This can't be destroyed by abilities" (flag cantBeDestroyedByAbilities). Rules-handling
  // destruction at 0 defense is not by an ability; Bane destruction is (CR 11.3.2.1).
  function destroy(s, iid, o = {}) {
    if (s.cards[iid].zone === 'field' && SV.chars(s, iid).flags.cantBeDestroyedByAbilities) { log(s, s.cards[iid].ctrl, 'fizzle', { iid, text: "can't be destroyed by abilities", notice: true }); return false; }
    return leaveField(s, iid, 'cemetery', { ...o, verb: 'destroy' });
  }
  // CR 11.3 / 11.7: simultaneous destruction by rules handling.
  function destroyMany(s, list) {
    const moved = [];
    for (const e of list) {
      const c = s.cards[e.iid];
      if (c.zone !== 'field') continue;
      if (e.stackEmpty) { const info = snapshot(s, e.iid); move(s, e.iid, 'cemetery'); log(s, info.owner, 'leave', { iid: e.iid, to: 'cemetery', info }); moved.push({ iid: e.iid, to: 'cemetery', info, ctrl: info.ctrl }); continue; }
      if ((e.byAbility || e.bane) && SV.chars(s, e.iid).flags.cantBeDestroyedByAbilities) continue;
      if (SV.hasStack(s, e.iid) && (c.counters.stack || 0) > 0) { c.counters.stack--; log(s, c.ctrl, 'stackSave', { iid: e.iid, left: c.counters.stack }); continue; }
      const info = snapshot(s, e.iid);
      const to = replaceLeaveTo(s, e.iid, 'cemetery', 'destroy');
      move(s, e.iid, to);
      log(s, info.owner, 'destroy', { iid: e.iid, by: e.by ?? null, info, to });
      moved.push({ iid: e.iid, to, by: e.by ?? null, info, verb: 'destroy', ctrl: info.ctrl });
    }
    emitLeave(s, moved);
  }
  // Replacement effects on where a card leaving the field goes ("banish it instead", CR 10.10):
  // every valid source's replaceLeave(s, me, {iid, to, verb}) may return a new zone.
  function replaceLeaveTo(s, iid, to, verb) {
    for (const x of auraSources(s)) { const ax = ABIL(faceId(s, x)); if (ax.replaceLeave) { const r = ax.replaceLeave(s, x, { iid, to, verb }); if (r) to = r; } }
    return to;
  }
  SV.leaveField = leaveField;
  SV.destroy = destroy;
  SV.destroyMany = destroyMany;
  SV.hasStack = (s, iid) => !!ABIL(faceId(s, iid)).stack; // CR 13.3.2 (scripts declare `stack: true`)

  // Create a token (CR 9.1.2) in `zone` for player p. Field and EX limits (4.4.4.2, 4.8.3.2):
  // a token that does not fit is not created. Crests are unique by name (9.1.5.1).
  function createToken(s, p, name, zone, o = {}) {
    const id = SV.TOKENS[name];
    if (!id) throw new Error(`unknown token "${name}"`);
    const P = s.players[p];
    if (zone === 'field' && P.field.length >= P.fieldLimit) { log(s, p, 'noRoom', { name, zone }); return null; }
    if (zone === 'ex' && P.ex.length >= P.exLimit) { log(s, p, 'noRoom', { name, zone }); return null; }
    if (SV.parsed(SV.CARDS[id]).type === 'crest' && P.ex.some((i) => s.cards[i].id === id)) return null;
    const iid = newCard(s, id, p, 'gone');
    if (zone === 'equip') { s.cards[iid].zone = 'equip'; s.cards[iid].faceup = true; }
    else placeIn(s, iid, zone, { ctrl: p });
    log(s, p, 'token', { iid, zone });
    if (zone === 'field') enterField(s, iid, { from: 'gone', engaged: o.engaged });
    return iid;
  }
  SV.createToken = createToken;

  // Common tail of every "put onto the field" (play, summon, effects): state + Fanfare event.
  function enterField(s, iid, o = {}) {
    const c = s.cards[iid];
    c.enteredTurn = s.turn;
    c.engaged = !!o.engaged;
    if (SV.hasStack(s, iid)) c.counters.stack = (c.counters.stack || 0) + 1; // CR 13.3.2.2
    emit(s, { type: 'enter', iid, from: o.from || null, p: c.ctrl, played: !!o.played });
  }
  SV.enterField = enterField;

  // ---------------------------------------------------------------- triggers (CR 10.7)
  // emit(): every card whose ability is valid in its zone (plus `extra` cards that just left the
  // field, for Last Words and "whenever another ... is destroyed") and listens for this event.
  const TRIG_ZONES = { field: true };
  function emit(s, ev, extra = [], faces = {}) {
    const seen = new Set();
    const P = s.players;
    const scan = [...P[s.active].field, ...P[1 - s.active].field, ...P[s.active].ex, ...P[1 - s.active].ex,
      ...P[s.active].cemetery, ...P[1 - s.active].cemetery, ...P[s.active].hand, ...P[1 - s.active].hand, ...extra];
    for (const c of Object.values(s.cards)) if (c.zone === 'equip' || c.zone === 'evolve') scan.push(c.iid);
    // Automatic abilities created by an effect for a duration ("For the rest of this turn, whenever
    // ..."): s.effects entries {etrig: {card, idx}, p, src} name an entry in that card's
    // `effectTriggers` list; they trigger wherever the source card is (CR 10.7.5 delayed triggers).
    for (const e of s.effects) if (e.etrig && e.on !== false) {
      const t = (ABIL(e.etrig.card).effectTriggers || [])[e.etrig.idx];
      if (!t) continue;
      const ons = Array.isArray(t.on) ? t.on : [t.on];
      if (!ons.includes(ev.type) || (t.when && !t.when(s, e, ev))) continue;
      addToBag(s, e.p, e.src, e.etrig.card, 'eff:' + e.etrig.idx, t.name, ev);
    }
    for (const iid of scan) {
      if (seen.has(iid)) continue;
      seen.add(iid);
      const c = s.cards[iid];
      const left = extra.includes(iid);
      const id = left && faces[iid] ? faces[iid] : faceId(s, iid);
      const a = ABIL(id);
      if (!a.triggers) continue;
      a.triggers.forEach((t, ti) => {
        const ons = Array.isArray(t.on) ? t.on : [t.on];
        if (!ons.includes(ev.type)) return;
        const zone = t.zone || 'field';
        // A card that just left the field still "sees" its own leave event (Last Words).
        const zoneOk = left ? zone === 'field' || zone === 'any' || zone === c.zone : zone === 'any' || zone === c.zone;
        if (!zoneOk) return;
        if (c.zone === 'field' && SV.chars(s, iid).flags.loseAbilities && !left) return;
        if (left && ev.info && ev.iid === iid && ev.info.boxed) return; // Q1485: a Boxed card's Last Words don't trigger
        if (t.when && !t.when(s, iid, ev)) return;
        let times = 1;
        if (t.limit) { // CR 10.7.2.2 "[N] per turn"
          const key = `${iid}:${ti}`;
          const used = s.ti.trig[key] || 0;
          if (used >= t.limit) return;
          s.ti.trig[key] = used + 1;
        }
        for (const x of auraSources(s)) { const ax = ABIL(faceId(s, x)); if (ax.extraTriggers) times += ax.extraTriggers(s, x, iid, t, ev) || 0; }
        for (let k = 0; k < times; k++) addToBag(s, left ? (ev.ctrl ?? c.ctrl) : c.ctrl, iid, id, ti, t.name, ev);
      });
    }
  }
  SV.emit = emit;

  function addToBag(s, owner, src, cardId, ti, name, ev) {
    s.bag.push({ id: s.bagSeq++, owner, src, cardId, ti, name, ev });
  }
  SV._addToBag = addToBag;

  // CR 10.5.2.2-3: the active player plays one of their pending abilities (their choice), then
  // rules handling again; only when they have none does the non-active player play theirs.
  function resolveBagStep(s) {
    let p = s.active;
    let mine = s.bag.filter((e) => e.owner === p);
    if (!mine.length) { p = 1 - p; mine = s.bag.filter((e) => e.owner === p); }
    const distinct = new Set(mine.map((e) => `${e.cardId}|${e.ti}|${JSON.stringify(e.ev)}`));
    if (mine.length > 1 && distinct.size > 1) {
      s.ask = {
        kind: 'bag', who: p, src: null,
        prompt: 'Several of your automatic abilities are waiting. Choose which one to play first.',
        options: mine.map((e) => ({ id: e.id, src: e.src, name: e.name })),
      };
      s.pendingSnap = SV.clone({ ...s, ask: null });
      s.pendingJob = { k: 'bagPick', answers: [] };
      return;
    }
    runJob(s, { k: 'trigger', entryId: mine[0].id, answers: [] });
  }

  // ---------------------------------------------------------------- rules handling (CR 11)
  function rulesHandling(s) {
    for (let guard = 0; guard < 50; guard++) {
      if (s.winner !== null) return;
      // CR 11.2 losses (simultaneous losses are a draw, 1.2.2).
      const lost = [0, 1].filter((p) => s.players[p].defense <= 0 || s.players[p].drewFromEmpty);
      if (lost.length === 2) return endGame(s, 'draw', 'both');
      if (lost.length === 1) return endGame(s, 1 - lost[0], s.players[lost[0]].defense <= 0 ? 'defense' : 'deckout');
      // CR 11.9 play points above the maximum.
      for (const P of s.players) if (P.pp > P.maxPP) P.pp = P.maxPP;
      // CR 11.3 / 11.7 destruction.
      const doomed = [];
      for (const i of SV.field(s)) {
        const c = s.cards[i];
        if (SV.isFollower(s, i) && SV.chars(s, i).def <= 0) doomed.push({ iid: i, by: c.lastHitBy ?? null });
        else if (c.baneMark) doomed.push({ iid: i, by: c.baneMark, bane: true });
        else if (SV.hasStack(s, i) && !(c.counters.stack > 0)) doomed.push({ iid: i, stackEmpty: true });
      }
      for (const i of SV.field(s)) delete s.cards[i].baneMark;
      if (doomed.length) { destroyMany(s, doomed); continue; }
      // CR 11.4 / 11.5 field and EX area over their limits: the player chooses what stays.
      for (const p of [s.active, 1 - s.active]) {
        const P = s.players[p];
        if (P.field.length > P.fieldLimit || P.ex.length > P.exLimit) { s.queue.unshift({ k: 'overLimit', p, answers: [] }); return; }
      }
      return;
    }
  }
  function endGame(s, winner, reason) {
    if (s.winner !== null) return;
    s.winner = winner; s.endReason = reason; s.phase = 'over'; s.ask = null; s.pendingJob = null; s.pendingSnap = null; s.window = null;
    log(s, winner === 'draw' ? s.active : winner, 'win', { reason, draw: winner === 'draw' });
  }
  SV._endGame = endGame;

  // ---------------------------------------------------------------- settle loop (CR 10.5)
  function settle(s) {
    for (let guard = 0; guard < 5000; guard++) {
      if (s.winner !== null) return;
      if (s.ask || s.window) return;
      rulesHandling(s);
      if (s.winner !== null || s.ask) return;
      if (s.queue.length && s.queue[0].k === 'overLimit') { runJob(s, s.queue.shift()); continue; }
      if (s.bag.length) { resolveBagStep(s); continue; }
      if (s.queue.length) { runJob(s, s.queue.shift()); continue; }
      return;
    }
    throw new Error('settle: loop guard tripped');
  }

  function runJob(s, job) {
    const snap = SV.clone(s);
    try {
      execJob(s, job);
      s.revealed = { 0: [], 1: [] }; // CR 5.21.1.1 revealed cards stop being revealed after the effect
    } catch (e) {
      if (!e || !e.__ask) throw e;
      s.ask = e.__ask;
      s.pendingJob = job;
      s.pendingSnap = snap;
    } finally {
      s._via = null;
    }
  }

  // ---------------------------------------------------------------- jobs
  function execJob(s, job) {
    const x = SV.makeCtx(s, job);
    switch (job.k) {
      case 'mulligan': return jobMulligan(s, job, x);
      case 'setupPoints': return jobSetupPoints(s);
      case 'beginTurn': return jobBeginTurn(s, job);
      case 'mainStart': return jobMainStart(s, job);
      case 'endPhase': return jobEndPhase(s);
      case 'wardEngage': return jobWardEngage(s, job, x);
      case 'quickWindow': return jobQuickWindow(s, job);
      case 'handLimit': return jobHandLimit(s, job, x);
      case 'cleanup': return jobCleanup(s);
      case 'trigger': return jobTrigger(s, job, x);
      case 'bagPick': {
        const id = job.answers[0];
        x.job = { k: 'trigger', entryId: id, answers: job.answers.slice(1) };
        x.ai = 0;
        return jobTriggerAnswers(s, job, x, id);
      }
      case 'play': return jobPlay(s, job, x);
      case 'evolve': return jobEvolve(s, job, x);
      case 'activate': return jobActivate(s, job, x);
      case 'attack': return jobAttack(s, job, x);
      case 'attackDamage': return jobAttackDamage(s, job);
      case 'attackEnd': s.attack = null; return;
      case 'overLimit': return jobOverLimit(s, job, x);
      default: throw new Error(`unknown job ${job.k}`);
    }
  }
  // A bag pick answer leads straight into the trigger it picked, inside the same job, so the
  // trigger's own questions append to the same answer list (answers[0] is the pick).
  function jobTriggerAnswers(s, job, x, id) {
    x.job = job; x.ai = 1;
    return jobTrigger(s, { k: 'trigger', entryId: id }, x);
  }

  function jobMulligan(s, job, x) {
    // CR 6.2.1.8: the whole hand to the bottom in any order, then redraw four; once each.
    const P = s.players[job.p];
    const yes = x.ask({ kind: 'mulligan', who: job.p, src: null, seen: P.hand.slice(), prompt: 'Keep this opening hand, or put all four cards on the bottom of your deck and draw four new ones?', yes: 'Redraw', no: 'Keep' });
    if (yes) {
      // "in any order": the order of four cards that will not be drawn again this game is not
      // asked (the deck would have to be drawn through 36+ cards first). DEVIATIONS.md.
      for (const i of P.hand.slice()) move(s, i, 'deck', { pos: 'bottom' });
      for (let k = 0; k < 4; k++) drawCard(s, job.p, true);
    }
    log(s, job.p, 'mulligan', { redraw: !!yes });
  }

  function jobSetupPoints(s) {
    for (const P of s.players) { P.pp = 0; P.maxPP = 0; } // CR 6.2.1.9
    s.players[s.first].ep = 0; s.players[1 - s.first].ep = 3; // 6.2.1.10
    for (const P of s.players) { P.sep = 1; P.defense = 20; } // 6.2.1.11-12
  }

  function jobBeginTurn(s, job) {
    const p = job.p;
    const P = s.players[p];
    s.turn++;
    s.active = p;
    s.phase = 'start';
    s.ti = freshTurnInfo();
    P.turnsPassed++; // CR 3.3.2
    log(s, p, 'turn', { turnsPassed: P.turnsPassed });
    tickDurations(s, 'startOf', p);
    P.maxPP = Math.min(10, P.maxPP + 1); // CR 7.2.1
    P.pp = P.maxPP; // 7.2.2
    for (const i of P.field) { // 7.2.3 (Boxed and "doesn't refresh" cards excepted, 5.31.3)
      if (SV.chars(s, i).flags.noRefresh) continue;
      s.cards[i].engaged = false;
    }
    tickDurations(s, 'afterRefresh', p);
    if (!(P.turnsPassed === 1 && p === s.first)) drawCard(s, p); // 7.2.4, 7.2.4.1
    emit(s, { type: 'turnStart', p });
    s.queue.unshift({ k: 'mainStart', p, answers: [] }); // 7.2.5 Confirmation Timing runs first
  }

  function jobMainStart(s, job) {
    s.phase = 'main';
    emit(s, { type: 'mainStart', p: job.p }); // CR 7.3.1, then 7.3.2 Confirmation Timing
  }

  function jobEndPhase(s) {
    s.phase = 'end';
    log(s, s.active, 'endPhase', {});
    emit(s, { type: 'endStart', p: s.active }); // CR 7.4.1
    s.queue.unshift({ k: 'wardEngage', answers: [] }, { k: 'quickWindow', kind: 'end', answers: [] },
      { k: 'handLimit', answers: [] }, { k: 'cleanup', answers: [] });
  }

  function jobWardEngage(s, job, x) {
    // CR 7.4.3 the active player may engage any number of their reserved Ward followers.
    const p = s.active;
    const cand = SV.followers(s, p).filter((i) => !s.cards[i].engaged && SV.chars(s, i).kw.Ward);
    if (!cand.length) return;
    const pick = x.ask({ kind: 'cards', who: p, src: null, from: cand, seen: cand, min: 0, max: cand.length, prompt: 'End phase: choose Ward followers to engage (engaged Ward followers must be attacked first).' });
    for (const i of pick) engage(s, i, 'ward');
    if (pick.length) log(s, p, 'wardEngage', { iids: pick });
  }

  function jobQuickWindow(s, job) {
    // CR 7.4.5 / 8.4.7: the non-active player may play Quick cards or abilities, or do nothing.
    // A window with nothing legal in it is not a choice (never assume a choice — but nothing to choose).
    const who = 1 - s.active;
    if (job.kind === 'attack' && !s.attack) return;
    s.window = { kind: job.kind, who };
    if (!quickOptions(s, who).length) { s.window = null; return; }
  }

  function jobHandLimit(s, job, x) {
    const p = s.active;
    const P = s.players[p];
    const over = P.hand.length - P.handLimit; // CR 7.4.7
    if (over <= 0) return;
    const pick = x.ask({ kind: 'cards', who: p, src: null, from: P.hand.slice(), seen: P.hand.slice(), min: over, max: over, prompt: `End phase: your hand is over the limit of ${P.handLimit}. Choose ${over === 1 ? 'a card' : over + ' cards'} to discard.` });
    for (const h of pick) discard(s, h);
    s.queue.unshift({ k: 'handLimit', answers: [] }); // repeated after Confirmation Timing
  }

  function jobCleanup(s) {
    const p = s.active;
    tickDurations(s, 'endOf', p); // CR 7.4.8
    s.queue.push({ k: 'beginTurn', p: 1 - p, answers: [] }); // 7.4.9
  }

  function jobOverLimit(s, job, x) {
    const P = s.players[job.p];
    for (const z of ['field', 'ex']) {
      const lim = z === 'field' ? P.fieldLimit : P.exLimit;
      if (P[z].length <= lim) continue;
      const keep = x.ask({ kind: 'cards', who: job.p, src: null, from: P[z].slice(), seen: P[z].slice(), min: lim, max: lim, prompt: `Your ${z === 'field' ? 'field' : 'EX area'} holds at most ${lim} cards. Choose the ${lim} to keep; the rest go to the cemetery.` });
      for (const i of P[z].slice()) if (!keep.includes(i)) { if (z === 'field') { const info = snapshot(s, i); move(s, i, 'cemetery'); emitLeave(s, [{ iid: i, to: 'cemetery', info, ctrl: info.ctrl }]); } else move(s, i, 'cemetery'); }
    }
  }

  // Durations: a mod/effect carries `end: {at, p}` and optionally `start: {at, p}`:
  //   'eot'          until the end of the turn (CR 7.4.8)
  //   'startOf' p    until the start of p's next turn
  //   'endOf' p      ends at the end of p's turn (with start: "during their next turn")
  //   'afterRefresh' p  "doesn't refresh during its controller's next start phase"
  function tickDurations(s, phase, p) {
    const keep = (m) => {
      if (m.start && m.start.at === phase && m.start.p === p) { m.on = true; delete m.start; }
      if (!m.end) return true;
      if (phase === 'startOf' && m.end.at === 'startOf' && m.end.p === p) return false;
      if (phase === 'afterRefresh' && m.end.at === 'afterRefresh' && m.end.p === p) return false;
      if (phase === 'endOf' && m.end.at === 'eot') return false;
      if (phase === 'endOf' && m.end.at === 'endOf' && m.end.p === p && m.on !== false) return false;
      return true;
    };
    for (const c of Object.values(s.cards)) if (c.mods.length) c.mods = c.mods.filter(keep);
    s.effects = s.effects.filter(keep);
  }
  SV.tickDurations = tickDurations;

  function discard(s, h) {
    const c = s.cards[h];
    move(s, h, 'cemetery');
    log(s, c.owner, 'discard', { iid: h });
    emit(s, { type: 'discarded', iid: h, p: c.owner });
  }
  SV.discard = discard;

  // ---------------------------------------------------------------- costs (one door: pay)
  // costToPlay(): play points to play a card now (CR 10.4.4.1: cost changes change the payment,
  // not the card). Self cost hooks, cost auras of valid sources, then s.effects cost mods.
  SV.costToPlay = function (s, iid) {
    const c = s.cards[iid];
    const d = baseDef(s, iid);
    let cost = d.cost || 0;
    const a = ABIL(d.no);
    if (a.selfCost) cost += a.selfCost(s, iid, c.owner) || 0;
    for (const m of c.mods) if (m.cost && m.on !== false) cost += m.cost; // e.g. Fuse: 'Give this "This costs 1 less to play."' (CR 4.8.3.3)
    for (const x of auraSources(s)) { const ax = ABIL(faceId(s, x)); if (ax.costAura) cost += ax.costAura(s, x, iid, c.owner) || 0; }
    for (const e of s.effects) if (e.costMod && e.on !== false && e.p === c.owner && (!e.filter || SV.COST_FILTERS[e.filter](s, iid, e))) cost += e.costMod;
    if (a.setCost) { const v = a.setCost(s, iid, c.owner); if (v != null) cost = v; }
    return Math.max(0, cost); // CR 1.3.2.2.1
  };
  SV.COST_FILTERS = {
    any: () => true,
    follower: (s, iid) => SV.parsed(baseDef(s, iid)).type === 'follower',
    spell: (s, iid) => SV.parsed(baseDef(s, iid)).type === 'spell',
    trait: (s, iid, e) => baseDef(s, iid).traits.includes(e.trait),
  };
  // pay(): the one cost door. cost = {pp, ep:bool (use 1 evolution point in lieu of 1 play point)}.
  function pay(s, p, cost) {
    const P = s.players[p];
    let pp = cost.pp || 0;
    if (cost.ep) { if (P.ep < 1 || pp < 1) throw new Illegal('no evolution point to use'); P.ep--; pp--; }
    if (P.pp < pp) throw new Illegal(`needs ${pp} play points`);
    P.pp -= pp;
    if (cost.sep) { if (P.sep < 1) throw new Illegal('no super-evolution point'); P.sep--; }
  }
  SV.pay = pay;
  const canPayPP = (s, p, n, epOk) => s.players[p].pp >= n || (epOk && n >= 1 && s.players[p].ep >= 1 && s.players[p].pp >= n - 1);

  // ---------------------------------------------------------------- playing cards (CR 8.2, 10.6)
  function cardPlayableType(s, iid) {
    const t = SV.parsed(baseDef(s, iid)).type;
    return t === 'follower' || t === 'amulet' || t === 'spell';
  }
  // The one "can this card be played right now by p" predicate (main phase or a Quick window).
  function canPlayCard(s, iid, p, inWindow) {
    const c = s.cards[iid];
    if (c.owner !== p || (c.zone !== 'hand' && c.zone !== 'ex')) return false;
    if (!cardPlayableType(s, iid)) return false;
    const d = baseDef(s, iid);
    if (d.evolved && !d.advanced) return false;
    const a = ABIL(d.no);
    if (inWindow && !SV.parsed(d).quick && !(a.quickIf && a.quickIf(s, iid))) return false;
    if (SV.costToPlay(s, iid) > s.players[p].pp) return false;
    const t = SV.parsed(d).type;
    if ((t === 'follower' || t === 'amulet') && s.players[p].field.length >= s.players[p].fieldLimit) return false; // CR 10.6.2.6
    if (a.canPlay && !a.canPlay(s, iid)) return false; // CR 10.6.2.3.3 target availability, other conditions
    if (playBlocked(s, iid, p)) return false;
    return true;
  }
  SV.canPlayCard = canPlayCard;
  function playBlocked(s, iid, p) {
    for (const x of auraSources(s)) { const ax = ABIL(faceId(s, x)); if (ax.blockPlay && ax.blockPlay(s, x, iid, p)) return true; }
    return false;
  }

  function jobPlay(s, job, x) {
    const { iid } = job;
    const c = s.cards[iid];
    const p = c.owner;
    pay(s, p, { pp: SV.costToPlay(s, iid) });
    playCard(s, x, iid, { from: c.zone });
  }

  // playCard(): the shared tail of every play (turn action, Quick play, "play ... for free").
  function playCard(s, x, iid, o = {}) {
    const c = s.cards[iid];
    const p = c.owner;
    const d = baseDef(s, iid);
    const a = ABIL(d.no);
    const t = SV.parsed(d).type;
    const from = o.from || c.zone;
    move(s, iid, 'resolution'); // CR 10.6.2.1
    s.ti.played[p]++; // CR 13.2.1.3 Combo counts every card played
    if (t === 'spell') s.ti.spells[p]++;
    log(s, p, 'play', { iid, from, cost: d.cost, quick: s.window ? true : undefined });
    emit(s, { type: 'played', iid, p, from, kind: t });
    if (t === 'spell') {
      const prevVia = s._via;
      s._via = iid;
      if (!a.spell && !SV.LENIENT) throw new Error(`no spell script for ${d.no} ${d.name}`); // SV.LENIENT: tools/sim.mjs --all only
      if (a.spell) x.withSource(iid, () => a.spell(x));
      s._via = prevVia;
      if (c.zone === 'resolution') move(s, iid, o.spellTo || 'cemetery'); // 10.6.2.8.2.3
      return;
    }
    // Followers and amulets (10.6.2.8.1). Ward: may enter engaged (CR 12.8.2 (i)); never assumed.
    const P = s.players[p];
    if (P.field.length >= P.fieldLimit) { move(s, iid, 'cemetery'); log(s, p, 'noRoom', { iid }); return; }
    let engaged = false;
    if (t === 'follower' && SV.parsed(d).kw.Ward) {
      engaged = x.withSource(iid, () => x.ask({ kind: 'yesno', who: p, src: iid, prompt: `${d.name} has Ward. Put it onto the field engaged, so enemy attacks must target it?`, yes: 'Engaged', no: 'Reserved' }));
    }
    move(s, iid, 'field', { ctrl: p });
    enterField(s, iid, { from, played: true, engaged });
    if (engaged) log(s, p, 'engage', { iid, ward: true });
  }
  SV.playCard = playCard;

  // ---------------------------------------------------------------- evolve (CR 12.2, 5.16)
  // Corresponding evolved cards: facedown cards in the evolve deck with the same name (5.16.1.1.1).
  function evolveCandidates(s, iid, nameOverride) {
    const c = s.cards[iid];
    const name = nameOverride || baseDef(s, iid).name;
    return s.players[c.ctrl].evoDeck.filter((e) => {
      const ec = s.cards[e];
      const d = SV.CARDS[ec.id];
      return !ec.faceup && d.evolved && d.name === name && d.type === baseDef(s, iid).type;
    });
  }
  SV.evolveCandidates = evolveCandidates;
  function evolveInfo(s, iid) {
    const c = s.cards[iid];
    if (c.zone !== 'field' || c.evo) return null;
    const d = baseDef(s, iid);
    const a = ABIL(d.no);
    let cost = a.evolveCost != null ? a.evolveCost : SV.parsed(d).evolveCost;
    if (cost == null) return null;
    // "change its [evolve] cost to N for the rest of the turn": a mod {evolveCost: N} (latest wins).
    for (const m of c.mods) if (m.evolveCost != null && m.on !== false) cost = m.evolveCost;
    if (SV.chars(s, iid).flags.loseAbilities) return null;
    return { cost };
  }
  SV.evolveInfo = evolveInfo;
  function canEvolve(s, iid) {
    const info = evolveInfo(s, iid);
    if (!info) return false;
    const p = s.cards[iid].ctrl;
    if (p !== s.active || s.ti.evolveUsed[p]) return false; // CR 8.3.2.1 once per turn
    if (!evolveCandidates(s, iid).length) return false; // 12.2.2 must reveal one as part of the cost
    const a = ABIL(baseDef(s, iid).no);
    if (a.evolveIf && !a.evolveIf(s, iid)) return false;
    return canPayPP(s, p, info.cost, true);
  }
  SV.canEvolve = canEvolve;

  function jobEvolve(s, job, x) {
    const { iid } = job;
    const p = s.cards[iid].ctrl;
    const P = s.players[p];
    const info = evolveInfo(s, iid);
    const name = baseDef(s, iid).name;
    // 12.2.3 one evolution point in lieu of one play point: asked when both ways are payable.
    let useEP = false;
    if (info.cost >= 1 && P.ep >= 1) {
      if (P.pp >= info.cost) useEP = x.ask({ kind: 'yesno', who: p, src: iid, prompt: `Evolve ${name}: use 1 evolution point in place of 1 play point? (${P.ep} evolution point${P.ep === 1 ? '' : 's'} left)`, yes: 'Use an evolution point', no: `Pay ${info.cost} play point${info.cost === 1 ? '' : 's'}` });
      else useEP = true;
    }
    // 12.2.4 super-evolution, asked when available.
    let sup = false;
    if (SV.superEvolveOK(s, p)) sup = x.ask({ kind: 'yesno', who: p, src: iid, prompt: `Also spend your super-evolution point to super-evolve ${name}? (+1/+1, On Super-Evolve abilities)`, yes: 'Super-evolve', no: 'Just evolve' });
    pay(s, p, { pp: info.cost, ep: useEP, sep: sup });
    s.ti.evolveUsed[p] = true;
    doEvolve(s, iid, { sup, paid: true, usedEP: useEP });
  }

  // The evolve process (CR 5.16) shared by the evolve ability and "evolve it" effects.
  function doEvolve(s, iid, o = {}) {
    const c = s.cards[iid];
    if (c.zone !== 'field' || c.evo) return false; // 5.16.4
    const cand = evolveCandidates(s, iid, o.name);
    if (!cand.length) { log(s, c.ctrl, 'fizzle', { iid, text: 'no corresponding card in the evolve deck', notice: true }); return false; }
    const e = cand[0]; // identical copies are indistinguishable: not a choice
    const ec = s.cards[e];
    removeFromZone(s, e);
    ec.zone = 'evolve'; ec.faceup = true; ec.evoOf = iid;
    c.evo = e;
    c.evolvedTurn = s.turn;
    log(s, c.ctrl, 'evolve', { iid, evo: e, sup: !!o.sup, ep: !!o.usedEP });
    if (o.sup) {
      c.superEvolved = true;
      c.mods.push({ atk: 1, def: 1, src: iid, superEvolve: true }); // 12.2.4.1
    }
    emit(s, { type: 'evolve', iid, p: c.ctrl, sup: !!o.sup });
    if (o.sup) emit(s, { type: 'superEvolve', iid, p: c.ctrl });
    return true;
  }
  SV.doEvolve = doEvolve;

  // ---------------------------------------------------------------- activated abilities (CR 8.3)
  // Engine-read abilities first (evolve is its own action; serve is index -1 below), then the
  // card script's `activated` list. Each entry: {text, cost:{pp, engage, ep}, quick, once,
  // zone, can(s, me), why(s, me), pay(x), run(x), evolveLike}.
  function scriptedActivated(s, iid) {
    const a = ABIL(faceId(s, iid));
    const list = [];
    const pd = SV.parsed(def(s, iid));
    if (pd.serveCost != null && s.cards[iid].zone === 'field') list.push({ serve: true, text: `Race this follower (serve a Carrot)`, cost: { pp: pd.serveCost }, epOk: true, evolveLike: true });
    if (a.activated) for (const ab of a.activated) list.push(ab);
    return list;
  }
  function describeActivated(s, iid, r) {
    const c = s.cards[iid];
    const list = scriptedActivated(s, iid);
    return list.map((ab, idx) => {
      const why = whyNotActivate(s, iid, ab, r);
      return { idx, text: ab.text || '', quick: !!ab.quick, usable: !why, why, costText: costText(ab.cost || {}), zone: ab.zone || 'field' };
    });
  }
  function whyNotActivate(s, iid, ab, r) {
    const c = s.cards[iid];
    const p = c.zone === 'field' ? c.ctrl : c.owner;
    const zone = ab.zone || 'field';
    if (c.zone !== zone) return zone === 'field' ? 'Only on the field.' : `Only from your ${zone === 'ex' ? 'EX area' : zone}.`;
    if (s.winner !== null) return 'The game is over.';
    // A Quick window sits inside the queue (the attack's damage step waits behind it), so the queue
    // only blocks activation outside a window.
    if (s.ask || (!s.window && (s.queue.length || s.bag.length))) return 'Not now.';
    if (s.window) { if (s.window.who !== p || !ab.quick) return 'Not now.'; }
    else if (s.phase !== 'main' || s.active !== p) return "It isn't your main phase.";
    if (r && r.flags.loseAbilities) return 'It has lost its abilities.';
    const cost = ab.cost || {};
    if (cost.engage && c.engaged) return 'Already engaged.';
    if (cost.pp && !canPayPP(s, p, cost.pp, !!(ab.epOk || ab.evolveLike && ab.epOk !== false && ab.serve))) return `Needs ${cost.pp} play point${cost.pp === 1 ? '' : 's'}.`;
    if (ab.evolveLike && s.ti.evolveUsed[p]) return 'You already evolved (or used an evolve-like ability) this turn.';
    if (ab.serve) {
      if (c.links.some((l) => s.cards[l] && s.cards[l].zone === 'race')) return 'It is already racing.';
      if (!s.players[p].evoDeck.some((e) => !s.cards[e].faceup && SV.CARDS[s.cards[e].id].name === 'Carrot')) return 'No Carrot left in your evolve deck.';
    }
    if (ab.once && s.ti.once[`act:${iid}:${ab.text}`]) return 'Already used this turn.';
    if (ab.onceGame && s.cards[iid][`used:${ab.text}`]) return 'Already used this game.';
    if (ab.can && !ab.can(s, iid)) return ab.why ? ab.why(s, iid) : 'Its condition is not met.';
    return null;
  }
  function costText(cost) {
    const parts = [];
    if (cost.pp) parts.push(`${cost.pp} play point${cost.pp === 1 ? '' : 's'}`);
    if (cost.engage) parts.push('engage');
    if (cost.text) parts.push(cost.text);
    return parts.join(', ');
  }

  function jobActivate(s, job, x) {
    const { iid, idx } = job;
    const c = s.cards[iid];
    const p = c.zone === 'field' ? c.ctrl : c.owner;
    const ab = scriptedActivated(s, iid)[idx];
    log(s, p, 'ability', { iid, text: ab.text, quick: s.window ? true : undefined });
    if (ab.once) s.ti.once[`act:${iid}:${ab.text}`] = true;
    if (ab.onceGame) c[`used:${ab.text}`] = true;
    if (ab.evolveLike) s.ti.evolveUsed[p] = true;
    const cost = ab.cost || {};
    let useEP = false;
    if (cost.pp && (ab.epOk || ab.serve) && s.players[p].ep >= 1) {
      if (s.players[p].pp >= cost.pp) useEP = x.ask({ kind: 'yesno', who: p, src: iid, prompt: `Use 1 evolution point in place of 1 play point? (${s.players[p].ep} left)`, yes: 'Use an evolution point', no: `Pay ${cost.pp} play point${cost.pp === 1 ? '' : 's'}` });
      else useEP = true;
    }
    if (cost.pp) pay(s, p, { pp: cost.pp, ep: useEP });
    if (cost.engage) engage(s, iid, 'cost');
    s._via = iid;
    x.withSource(iid, () => {
      if (ab.pay) ab.pay(x); // other costs in printed order (CR 10.4.2.1): bury this, discard, banish from cemetery …
      if (ab.serve) { serve(s, iid, 1); race(s, iid, 1); return; }
      ab.run(x);
    });
  }

  // CR 14.2.1 serve / 14.2.3 race (Umamusume: Pretty Derby).
  function serve(s, iid, n = 1) {
    const c = s.cards[iid];
    if (c.links.some((l) => s.cards[l] && s.cards[l].zone === 'race')) return false; // 14.2.1.2
    const P = s.players[c.ctrl];
    for (let k = 0; k < n; k++) {
      const e = P.evoDeck.find((i) => !s.cards[i].faceup && SV.CARDS[s.cards[i].id].name === 'Carrot');
      if (!e) break;
      removeFromZone(s, e);
      s.cards[e].zone = 'race'; s.cards[e].faceup = true; s.cards[e].linkedTo = iid;
      c.links.push(e);
    }
    log(s, c.ctrl, 'serve', { iid, n });
    return true;
  }
  function race(s, iid, n = 1) {
    const c = s.cards[iid];
    if (!c.links.some((l) => s.cards[l] && s.cards[l].zone === 'race')) return false; // 14.2.3.1 only while linked
    c.raced = (c.raced || 0) + n;
    log(s, c.ctrl, 'race', { iid, n });
    emit(s, { type: 'raced', iid, p: c.ctrl, n });
    return true;
  }
  SV.serve = serve;
  SV.race = race;
  SV.isRacing = (s, iid) => s.cards[iid].links.some((l) => s.cards[l] && s.cards[l].zone === 'race');

  // CR 14.5.2.2 equip a follower with an equipment token.
  function equip(s, iid, name) {
    const c = s.cards[iid];
    if (c.zone !== 'field') return null;
    const t = createToken(s, c.ctrl, name, 'equip');
    if (!t) return null;
    s.cards[t].linkedTo = iid;
    c.links.push(t);
    log(s, c.ctrl, 'equip', { iid, token: t });
    emit(s, { type: 'equipped', iid, token: t, p: c.ctrl });
    return t;
  }
  SV.equip = equip;

  // ---------------------------------------------------------------- attack (CR 8.4)
  // The one attack-legality predicate: legalActions, the UI and the AI all use it.
  SV.canAttackWith = function (s, a) {
    const c = s.cards[a];
    if (c.zone !== 'field' || c.ctrl !== s.active || c.engaged) return false;
    if (!SV.isFollower(s, a)) return false;
    const A = SV.chars(s, a);
    if (A.flags.cantAttack) return false;
    const stayed = c.enteredTurn != null && c.enteredTurn < s.turn; // 8.4.2.1 on the field since the start of the turn
    const evolvedNow = c.evolvedTurn === s.turn;
    return stayed || evolvedNow || !!A.kw.Storm || !!A.kw.Rush || SV.isRacing(s, a);
  };
  SV.canAttackTarget = function (s, a, t) {
    if (!SV.canAttackWith(s, a)) return false;
    const c = s.cards[a];
    const tc = s.cards[t];
    if (tc.ctrl === c.ctrl || tc.owner === c.ctrl && tc.zone === 'leader') return false;
    const A = SV.chars(s, a);
    const stayed = c.enteredTurn != null && c.enteredTurn < s.turn;
    if (A.flags.cantAttackEnemies) return false; // 8.4.3.2.1
    let ok;
    if (tc.zone === 'leader') {
      if (tc.owner === c.ctrl) return false;
      ok = (stayed || A.kw.Storm) && !A.flags.cantAttackLeader; // 8.4.3.1, 12.9
    } else {
      if (tc.zone !== 'field' || !SV.isFollower(s, t)) return false;
      const T = SV.chars(s, t);
      if (T.kw.Intimidate) return false; // 12.12
      if (T.flags.cantBeAttacked) return false;
      ok = tc.engaged || !!A.kw.Assail; // 8.4.3.1, 12.11
    }
    if (!ok) return false;
    // 12.8.2 (iii) Ward: if the opponent has an engaged Ward follower that can be selected, the target must be one.
    const wards = SV.followers(s, 1 - c.ctrl).filter((w) => s.cards[w].engaged && SV.chars(s, w).kw.Ward && !SV.chars(s, w).kw.Intimidate && !SV.chars(s, w).flags.cantBeAttacked);
    if (wards.length && !wards.includes(t)) return false;
    return true;
  };

  function jobAttack(s, job) {
    const { iid: a, target: t } = job;
    const p = s.cards[a].ctrl;
    engage(s, a, 'attack'); // 8.4.4
    s.ti.attacks[a] = (s.ti.attacks[a] || 0) + 1; // 8.4.5
    const combat = s.cards[t].zone === 'field';
    s.attack = { a, t, combat, leader: !combat };
    log(s, p, 'attack', { iid: a, target: t, leader: !combat });
    emit(s, { type: 'attack', iid: a, target: t, p, leader: !combat }); // Strike (12.7)
    s.queue.unshift({ k: 'quickWindow', kind: 'attack', answers: [] }, { k: 'attackDamage', answers: [] }, { k: 'attackEnd', answers: [] });
  }

  function jobAttackDamage(s) {
    const at = s.attack;
    if (!at) return;
    const { a, t } = at;
    if (s.cards[a].zone !== 'field') return; // 8.4.9
    const A = SV.chars(s, a);
    const tc = s.cards[t];
    if (tc.zone === 'leader') { dealDamage(s, t, Math.max(0, A.atk), { src: a, kind: 'attack' }); return; }
    if (tc.zone !== 'field') return;
    const T = SV.chars(s, t);
    // 8.4.9.1 simultaneous. Each instance is computed before either is dealt.
    const atkA = Math.max(0, A.atk), atkT = Math.max(0, T.atk);
    const inCombat = s.cards[a].zone === 'field' && tc.zone === 'field';
    dealDamage(s, t, atkA, { src: a, kind: 'attack' });
    dealDamage(s, a, atkT, { src: t, kind: 'combat' });
    if (inCombat) { // 8.4.9.2 fought; 12.14 Bane
      log(s, s.cards[a].ctrl, 'fought', { a, t });
      if (A.kw.Bane) tc.baneMark = a;
      if (T.kw.Bane) s.cards[a].baneMark = t;
      s.cards[a].lastHitBy = t; tc.lastHitBy = a;
      emit(s, { type: 'fought', a, t });
    }
  }

  // ---------------------------------------------------------------- automatic abilities
  function jobTrigger(s, job, x) {
    const k = s.bag.findIndex((e) => e.id === job.entryId);
    if (k < 0) throw new Illegal('no such pending ability');
    const entry = s.bag.splice(k, 1)[0];
    s._via = entry.src;
    log(s, entry.owner, 'ability', { iid: entry.src, name: entry.name, auto: true });
    if (entry.ti === 'drain') return heal(s, entry.owner, entry.ev.amount, { src: entry.src }); // 12.13.2
    const t = typeof entry.ti === 'string' && entry.ti.startsWith('eff:') ? ABIL(entry.cardId).effectTriggers[+entry.ti.slice(4)] : ABIL(entry.cardId).triggers[entry.ti];
    x.withSource(entry.src, () => t.run(x, entry.ev), entry.owner);
  }

  // ---------------------------------------------------------------- legal actions
  SV.whoActs = function (s) {
    if (s.winner !== null) return null;
    if (s.ask) return s.ask.who;
    if (s.window) return s.window.who;
    return s.active;
  };
  SV.isTerminal = (s) => s.winner !== null;

  function quickOptions(s, p) {
    const out = [];
    const P = s.players[p];
    for (const h of [...P.hand, ...P.ex]) if (canPlayCard(s, h, p, true)) out.push({ type: 'play', iid: h });
    for (const c of [...P.field, ...P.ex, ...P.cemetery, ...P.hand]) {
      const r = SV.chars(s, c);
      r.activated.forEach((ab) => { if (ab.usable && ab.quick) out.push({ type: 'activate', iid: c, idx: ab.idx }); });
    }
    return out;
  }
  SV.quickOptions = quickOptions;

  SV.legalActions = function (s) {
    if (s.winner !== null) return [];
    if (s.ask) return askAnswers(s, s.ask);
    if (s.window) return [...quickOptions(s, s.window.who), { type: 'pass' }];
    const out = [];
    const p = s.active;
    const P = s.players[p];
    if (s.phase !== 'main' || s.queue.length || s.bag.length) return out;
    for (const h of [...P.hand, ...P.ex]) if (canPlayCard(s, h, p, false)) out.push({ type: 'play', iid: h });
    for (const c of P.field) if (canEvolve(s, c)) out.push({ type: 'evolve', iid: c });
    for (const c of [...P.field, ...P.ex, ...P.cemetery, ...P.hand]) {
      const r = SV.chars(s, c);
      r.activated.forEach((ab) => { if (ab.usable) out.push({ type: 'activate', iid: c, idx: ab.idx }); });
    }
    for (const c of P.field) {
      if (!SV.canAttackWith(s, c)) continue;
      const targets = [s.players[1 - p].leader, ...SV.followers(s, 1 - p)];
      for (const t of targets) if (t && SV.canAttackTarget(s, c, t)) out.push({ type: 'attack', iid: c, target: t });
    }
    if (canEndMain(s)) out.push({ type: 'end' });
    return out;
  };

  // CR 7.3.3.1: can't end the main phase while a "must attack if able" follower can attack.
  function canEndMain(s) { return endBlocker(s) == null; }
  function endBlocker(s) {
    const p = s.active;
    for (const c of SV.followers(s, p)) {
      if (!SV.chars(s, c).flags.mustAttack || s.ti.attacks[c]) continue;
      const targets = [s.players[1 - p].leader, ...SV.followers(s, 1 - p)];
      if (targets.some((t) => t && SV.canAttackTarget(s, c, t))) return c;
    }
    return null;
  }
  SV.endBlocker = endBlocker;

  function askAnswers(s, a) {
    switch (a.kind) {
      case 'yesno': case 'mulligan': return [{ type: 'answer', value: true }, { type: 'answer', value: false }];
      case 'mode': return a.options.map((o, i) => (o.enabled === false ? null : { type: 'answer', value: i })).filter(Boolean);
      case 'modes': return sampleModes(a).map((v) => ({ type: 'answer', value: v }));
      case 'number': { const out = []; for (let n = a.min; n <= a.max; n++) out.push({ type: 'answer', value: n }); return out; }
      case 'bag': return a.options.map((o) => ({ type: 'answer', value: o.id }));
      case 'order': return [{ type: 'answer', value: a.from.slice() }, { type: 'answer', value: a.from.slice().reverse() }];
      case 'cards': return sampleSelections(s, a).map((v) => ({ type: 'answer', value: v }));
      default: throw new Error(`unknown ask kind ${a.kind}`);
    }
  }
  function sampleModes(a) {
    const n = a.options.length, out = [];
    for (let mask = 1; mask < 1 << n; mask++) {
      const sel = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) sel.push(i);
      if (validModes(a, sel)) out.push(sel);
    }
    return out;
  }
  function validModes(a, sel) {
    if (!Array.isArray(sel) || new Set(sel).size !== sel.length) return false;
    if (sel.length < a.min || sel.length > a.max) return false;
    return sel.every((i, k) => Number.isInteger(i) && i >= 0 && i < a.options.length && a.options[i].enabled !== false && (k === 0 || sel[k - 1] < i));
  }
  // Representative answers for multi-picks (the AI uses these; the UI builds its own picker).
  function sampleSelections(s, a) {
    const from = a.from, out = [];
    const ok = (sel) => validSelection(s, a, sel);
    if (a.max <= 1 || from.length <= 1) {
      if (ok([])) out.push([]);
      for (const f of from) if (ok([f])) out.push([f]);
      return out;
    }
    if (from.length <= 8) {
      const n = from.length;
      for (let mask = 0; mask < 1 << n; mask++) {
        const sel = from.filter((_, i) => mask & (1 << i));
        if (ok(sel)) out.push(sel);
        if (out.length >= 256) break;
      }
      return out;
    }
    if (ok([])) out.push([]);
    for (const f of from) if (ok([f])) out.push([f]);
    for (let i = 0; i < from.length; i++) for (let j = i + 1; j < from.length; j++) if (ok([from[i], from[j]])) out.push([from[i], from[j]]);
    const firstMax = from.slice(0, a.max);
    if (ok(firstMax)) out.push(firstMax);
    if (ok(from.slice(0, a.min))) out.push(from.slice(0, a.min));
    return out;
  }
  function validSelection(s, a, sel) {
    if (!Array.isArray(sel)) return false;
    if (new Set(sel).size !== sel.length) return false;
    if (sel.length < a.min || sel.length > a.max) return false;
    if (!sel.every((i) => a.from.includes(i))) return false;
    if (a.sumCostMax != null) {
      const tot = sel.reduce((n, i) => n + (SV.CARDS[s.cards[i].id].cost || 0), 0);
      if (tot > a.sumCostMax) return false;
    }
    if (a.distinctNames) { const names = sel.map((i) => SV.CARDS[s.cards[i].id].name); if (new Set(names).size !== names.length) return false; }
    return true;
  }

  // ---------------------------------------------------------------- apply
  SV.apply = function (prev, action) {
    if (prev.winner !== null) throw new Illegal('game is over');
    const s = SV.clone(prev);
    if (action.type === 'concede') { // CR 1.2.3: any time, not offered by legalActions
      if (action.who !== 0 && action.who !== 1) throw new Illegal('concede needs who');
      s.ask = null; s.pendingJob = null; s.pendingSnap = null; s.queue = []; s.bag = []; s.window = null;
      endGame(s, 1 - action.who, 'concede');
      return s;
    }
    if (s.ask) {
      if (action.type !== 'answer') throw new Illegal('a decision is pending');
      const a = s.ask;
      if (!validAnswer(s, a, action.value)) throw new Illegal('invalid answer');
      const job = s.pendingJob;
      const snap = s.pendingSnap;
      for (const k of Object.keys(s)) delete s[k];
      Object.assign(s, snap);
      s.ask = null; s.pendingJob = null; s.pendingSnap = null;
      job.answers.push(action.value);
      runJob(s, job);
      settle(s);
      return s;
    }
    if (action.type === 'answer') throw new Illegal('nothing to answer');
    const legal = SV.legalActions(prev).some((l) => sameAction(l, action));
    if (!legal) throw new Illegal(`illegal action ${JSON.stringify(action)}`);
    if (s.window) {
      if (action.type === 'pass') { log(s, s.window.who, 'pass', { window: s.window.kind }); s.window = null; settle(s); return s; }
      const kind = s.window.kind;
      s.window = null;
      // CR 7.4.6 / 8.4.8: after a Quick play, Confirmation Timing, then the window repeats.
      s.queue.unshift({ k: 'quickWindow', kind, answers: [] });
    }
    const job = { ...action, k: action.type === 'end' ? 'endPhase' : action.type, answers: [] };
    delete job.type;
    runJob(s, job);
    settle(s);
    return s;
  };
  function sameAction(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if ((a[k] ?? null) !== (b[k] ?? null)) return false;
    return true;
  }
  function validAnswer(s, a, v) {
    switch (a.kind) {
      case 'yesno': case 'mulligan': return v === true || v === false;
      case 'mode': return Number.isInteger(v) && v >= 0 && v < a.options.length && a.options[v].enabled !== false;
      case 'modes': return validModes(a, v);
      case 'number': return Number.isInteger(v) && v >= a.min && v <= a.max;
      case 'bag': return a.options.some((o) => o.id === v);
      case 'order': return Array.isArray(v) && v.length === a.from.length && a.from.every((i) => v.includes(i));
      default: return validSelection(s, a, v);
    }
  }

  // ---------------------------------------------------------------- UI helpers
  SV.whyNot = function (s, iid) {
    const c = s.cards[iid];
    if (!c || (c.zone !== 'hand' && c.zone !== 'ex')) return null;
    const p = c.owner;
    if (s.winner !== null) return 'The game is over.';
    if (s.ask) return 'Finish the current decision first.';
    const inWindow = !!s.window;
    if (inWindow && s.window.who !== p) return "It isn't your turn.";
    if (!inWindow && p !== s.active) return "It isn't your turn.";
    if (canPlayCard(s, iid, p, inWindow)) return null;
    const d = baseDef(s, iid);
    const t = SV.parsed(d).type;
    if (t === 'crest') return 'Crests stay in the EX area; they are not played.';
    if (!cardPlayableType(s, iid)) return 'This card is not played.';
    if (inWindow && !SV.parsed(d).quick) return 'Only Quick cards can be played now.';
    if (!inWindow && s.phase !== 'main') return 'Not now.';
    const need = SV.costToPlay(s, iid);
    if (need > s.players[p].pp) return `Needs ${need} play point${need === 1 ? '' : 's'}, you have ${s.players[p].pp}.`;
    if ((t === 'follower' || t === 'amulet') && s.players[p].field.length >= s.players[p].fieldLimit) return `Your field is full (${s.players[p].fieldLimit} cards).`;
    const a = ABIL(d.no);
    if (a.canPlay && !a.canPlay(s, iid)) return a.cantPlayWhy ? a.cantPlayWhy(s, iid) : 'It has nothing to target right now.';
    return "Can't be played right now.";
  };
  SV.actionsFor = function (s, iid) {
    return SV.legalActions(s).filter((a) => a.iid === iid || a.target === iid);
  };

  // Expose internals the ability runtime and tests use.
  SV._internal = { settle, runJob, rulesHandling, emit, move, placeIn, removeFromZone, playCard, freshTurnInfo, validSelection, enterField, doEvolve, pay, canPayPP, emitLeave, addToBag };
})();

// Black box (KB LESSONS §7): a game is fully described by its newGame options and the actions
// applied. SV.replay re-runs a trace and reports the first ILLEGAL/THREW/DIVERGED step.
(function () {
  const SV = globalThis.SV;
  SV.makeTrace = (opts) => ({ v: 1, opts: { decks: opts.decks, seed: opts.seed, first: opts.first, names: opts.names }, actions: [], marks: [] });
  SV.replay = function (trace, upTo) {
    let s = SV.newGame(trace.opts);
    const n = upTo == null ? trace.actions.length : upTo;
    for (let k = 0; k < n; k++) {
      const a = trace.actions[k];
      const legal = SV.legalActions(s);
      const isAnswer = a.type === 'answer';
      if (!isAnswer && !legal.some((l) => JSON.stringify(l) === JSON.stringify(a))) return { ok: false, at: k, kind: 'ILLEGAL', action: a, state: s };
      try { s = SV.apply(s, a); } catch (e) { return { ok: false, at: k, kind: e instanceof SV.Illegal ? 'ILLEGAL' : 'THREW', error: String(e && e.stack || e), action: a, state: s }; }
      if (trace.logN && trace.logN[k] != null && trace.logN[k] !== s.logN) return { ok: false, at: k, kind: 'DIVERGED', action: a, state: s };
    }
    return { ok: true, state: s };
  };
})();

// Deck legality (CR 6.1.1) and the defects gate (CLAUDE.md rule 7).
(function () {
  const SV = globalThis.SV;
  SV.deckProblems = function (deck) {
    const out = [];
    const L = SV.CARDS[deck.leader];
    if (!L || L.type !== 'leader') out.push('A deck needs one leader card.');
    const n = (list) => list.reduce((a, [, q]) => a + q, 0);
    const main = n(deck.main), evo = n(deck.evolve || []);
    if (main < 40 || main > 50) out.push(`The main deck has ${main} cards; it needs 40 to 50.`); // 6.1.1.2
    if (evo > 10) out.push(`The evolve deck has ${evo} cards; at most 10.`); // 6.1.1.3
    for (const [k, list] of [['main deck', deck.main], ['evolve deck', deck.evolve || []]]) {
      const byName = {};
      for (const [id, q] of list) {
        const d = SV.CARDS[id];
        if (!d) { out.push(`Unknown card ${id}.`); continue; }
        byName[d.name] = (byName[d.name] || 0) + q;
        if (SV.DEFECTS[id]) out.push(`${d.name} doesn't play as printed yet (${SV.DEFECTS[id]}).`);
        const evoCard = d.evolved || d.advanced;
        if (k === 'main deck' && (evoCard || d.token || d.type === 'leader')) out.push(`${d.name} can't be in the main deck.`);
        if (k === 'evolve deck' && !evoCard) out.push(`${d.name} can't be in the evolve deck.`);
        if (L && d.cls !== 'neutral' && d.cls !== L.cls && !(d.universe && d.universe === L.universe)) out.push(`${d.name} is not ${L.cls} or Neutral.`); // 6.1.1.5.1
      }
      for (const [name, q] of Object.entries(byName)) {
        const any = (SV.CARDS[list.find(([id]) => SV.CARDS[id] && SV.CARDS[id].name === name)[0]].text || '').match(/put up to (\d+) of this card into your evolve deck/i);
        const cap = any ? +any[1] : 3; // 6.1.1.4 and card text that overrides it (6.1.2)
        if (q > cap) out.push(`${q} copies of ${name} in the ${k}; at most ${cap}.`);
      }
    }
    return out;
  };
  SV.playableDecks = () => SV.DECKS.filter((d) => ![d.leader, ...d.main.map((x) => x[0]), ...(d.evolve || []).map((x) => x[0])].some((id) => SV.DEFECTS[id]));
})();
