// Ability runtime: the context object (`x`) card scripts in data/abilities/*.js receive.
// Every effect goes through these helpers, which call the engine's doors. Authoring guide:
// docs/ABILITIES.md. CR = Comprehensive Rules v1.26.1.
(function () {
  const SV = globalThis.SV;
  const def = (s, iid) => SV.def(iid, s);

  SV.ABIL = SV.ABIL || {};

  SV.makeCtx = function (s, job) {
    const x = { s, job, ai: 0, me: null, ctrl: null, opp: null };

    // Run fn with `me` = iid. Controller: the card's controller on the field, its owner elsewhere,
    // or an explicit one (a Last Words resolves for whoever controlled the card when it left).
    x.withSource = (iid, fn, ctrl) => {
      const pm = x.me, pc = x.ctrl;
      const c = s.cards[iid];
      x.me = iid; x.ctrl = ctrl != null ? ctrl : (c.zone === 'field' ? c.ctrl : c.owner); x.opp = 1 - x.ctrl;
      try { return fn(); } finally { x.me = pm; x.ctrl = pc; x.opp = pc == null ? null : 1 - pc; }
    };

    // ------------------------------------------------------------ questions (PLAN D9)
    x.ask = (q) => {
      if (x.job.answers.length > x.ai) return x.job.answers[x.ai++];
      x.ai++;
      const who = q.who == null ? x.ctrl : q.who;
      throw { __ask: { ...q, who, src: q.src === undefined ? x.me : q.src } };
    };
    // select(): "Select [n] [cards]". Aura (CR 12.15): an opponent's card with Aura can't be
    // selected by your cards or abilities. Zero candidates resolves with no effect (1.3.2);
    // otherwise the player is ALWAYS asked, even with a single candidate (CLAUDE.md rule 4).
    x.select = (o) => {
      const who = o.who == null ? x.ctrl : o.who;
      let from = o.from.slice();
      if (o.aura !== false) from = from.filter((i) => !isAuraProtected(i, who));
      const max = Math.min(o.max == null ? 1 : o.max, from.length);
      const min = Math.min(o.min == null ? 1 : o.min, max);
      if (max === 0) return [];
      return x.ask({ kind: 'cards', who, from, seen: o.seen || from, min, max, prompt: o.prompt, src: o.src, sumCostMax: o.sumCostMax, distinctNames: o.distinctNames });
    };
    function isAuraProtected(i, who) {
      const c = s.cards[i];
      if (c.zone !== 'field' || c.ctrl === who) return false;
      return !!SV.chars(s, i).kw.Aura;
    }
    x.selectOne = (from, prompt, o = {}) => x.select({ ...o, from, prompt, min: o.optional ? 0 : 1, max: 1 })[0] ?? null;
    x.may = (prompt, yes = 'Yes', no = 'No', who) => x.ask({ kind: 'yesno', who, prompt, yes, no });
    // "Choose N" (CR 5.18): options = [{label, can}]; returns the chosen indices in printed order.
    // Options that cannot be performed cannot be chosen (5.18.3.1.2).
    x.choose = (prompt, options, min = 1, max = 1) => {
      const opts = options.map((o) => ({ label: o.label, enabled: o.can !== false }));
      const nEnabled = opts.filter((o) => o.enabled).length;
      max = Math.min(max, nEnabled); min = Math.min(min, max);
      if (max === 0) return [];
      const v = x.ask({ kind: 'modes', prompt, options: opts, min, max });
      return v;
    };
    x.number = (prompt, min, max) => (min === max ? min : x.ask({ kind: 'number', prompt, min, max }));
    // Put cards in an order the player chooses (top first). One card is not a choice.
    x.order = (iids, prompt) => (iids.length <= 1 ? iids.slice() : x.ask({ kind: 'order', from: iids.slice(), seen: iids.slice(), prompt }));

    // ------------------------------------------------------------ readers
    x.def = (i) => def(s, i);
    x.chars = (i) => SV.chars(s, i);
    x.name = (i) => def(s, i).name;
    x.P = (p = x.ctrl) => s.players[p];
    x.leader = (p) => s.players[p].leader;
    x.followers = (p) => SV.followers(s, p);
    x.amulets = (p) => SV.amulets(s, p);
    x.field = (p) => SV.field(s, p);
    x.hand = (p = x.ctrl) => s.players[p].hand.slice();
    x.ex = (p = x.ctrl) => s.players[p].ex.slice();
    x.cemetery = (p = x.ctrl) => s.players[p].cemetery.slice();
    x.deck = (p = x.ctrl) => s.players[p].deck.slice();
    x.banished = (p = x.ctrl) => s.players[p].banished.slice();
    x.isFollower = (i) => SV.isFollower(s, i);
    x.isAmulet = (i) => SV.isAmulet(s, i);
    x.isSpell = (i) => SV.isSpell(s, i);
    x.type = (i) => SV.parsed(def(s, i)).type;
    x.hasTrait = (i, t) => (s.cards[i].zone === 'field' ? SV.chars(s, i).traits : def(s, i).traits).includes(t);
    x.named = (i, name) => SV.nameHas(s, i, name);
    x.cost = (i) => def(s, i).cost;
    x.myTurn = () => s.active === x.ctrl;
    x.overflow = (p = x.ctrl) => SV.overflow(s, p);
    x.sanguine = (p = x.ctrl) => SV.sanguine(s, p);
    x.combo = (p = x.ctrl) => SV.combo(s, p);
    x.spellchain = (p = x.ctrl) => SV.spellchain(s, p);
    x.necrocharge = (p = x.ctrl) => SV.necrocharge(s, p);
    x.evolved = (i) => !!s.cards[i].evo;
    x.engaged = (i) => s.cards[i].engaged;
    x.onField = (i) => s.cards[i].zone === 'field';
    x.counters = (i, k) => s.cards[i].counters[k] || 0;
    x.enemyTargets = () => [s.players[x.opp].leader, ...SV.followers(s, x.opp)];

    // ------------------------------------------------------------ effects (doors)
    const src = () => x.me;
    x.damage = (t, n, o = {}) => SV.dealDamage(s, t, n, { src: src(), kind: 'ability', ...o });
    x.damageMany = (list, n) => { for (const t of list) SV.dealDamage(s, t, typeof n === 'function' ? n(t) : n, { src: src(), kind: 'ability' }); };
    x.heal = (p, n) => SV.heal(s, p, n, { src: src() }); // "give your leader [defense]+N"
    x.destroy = (t) => SV.destroy(s, t, { by: src() });
    // "Destroy each ..." is simultaneous (CR 10.7.4.2): every leave event sees the whole group.
    x.destroyAll = (list) => SV.destroyMany(s, list.map((iid) => ({ iid, by: src(), byAbility: true })));
    x.bury = (t) => { // CR 5.34 (not a destroy)
      const c = s.cards[t];
      if (c.zone === 'field') return SV.leaveField(s, t, 'cemetery', { by: src(), verb: 'bury' });
      const from = SV.move(s, t, 'cemetery');
      SV.log(s, x.ctrl, 'bury', { iid: t, from });
      return true;
    };
    x.banish = (t, o = {}) => {
      const c = s.cards[t];
      if (c.zone === 'field') return SV.leaveField(s, t, 'banished', { by: src(), verb: 'banish' });
      const from = SV.move(s, t, 'banished', o);
      SV.log(s, x.ctrl, 'banish', { iid: t, from });
      SV.emit(s, { type: 'banished', iid: t, from, p: c.owner });
      return true;
    };
    x.toHand = (t) => {
      const c = s.cards[t];
      const from = c.zone;
      if (from === 'field') SV.leaveField(s, t, 'hand', { by: src(), verb: 'return' });
      else { SV.move(s, t, 'hand'); SV.log(s, c.owner, 'toHand', { iid: t, from }); }
      SV.emit(s, { type: 'toHand', iid: t, from, p: c.owner });
    };
    x.toEx = (t) => {
      const c = s.cards[t];
      const P = s.players[c.owner];
      if (P.ex.length >= P.exLimit) { SV.log(s, c.owner, 'noRoom', { iid: t, zone: 'ex' }); return false; } // CR 4.8.3.2
      const from = c.zone;
      if (from === 'field') SV.leaveField(s, t, 'ex', { by: src(), verb: 'toEx' });
      else { SV.move(s, t, 'ex'); SV.log(s, c.owner, 'toEx', { iid: t, from }); }
      SV.emit(s, { type: 'toEx', iid: t, from, p: c.owner });
      return true;
    };
    x.toDeck = (t, pos = 'bottom') => {
      const c = s.cards[t];
      const from = c.zone;
      if (from === 'field') SV.leaveField(s, t, 'deck', { by: src(), verb: 'toDeck', pos });
      else { SV.move(s, t, 'deck', { pos }); SV.log(s, c.owner, 'toDeck', { iid: t, from, pos }); }
    };
    x.shuffle = (p = x.ctrl) => { SV.shuffleInPlace(s, s.players[p].deck); SV.log(s, p, 'shuffle', {}); };
    x.draw = (n = 1, p = x.ctrl) => { let k = 0; for (let i = 0; i < n; i++) if (SV.drawCard(s, p)) k++; return k; };
    x.discard = (h) => SV.discard(s, h);
    // "discard N cards": the discarding player chooses (CR 5.12.1).
    x.chooseDiscard = (n = 1, p = x.ctrl, prompt) => {
      const hand = s.players[p].hand.slice();
      if (!hand.length) return [];
      const k = Math.min(n, hand.length);
      const pick = x.ask({ kind: 'cards', who: p, from: hand, seen: hand, min: k, max: k, prompt: prompt || `Choose ${k === 1 ? 'a card' : k + ' cards'} to discard.` });
      for (const h of pick) x.discard(h);
      return pick;
    };
    x.engage = (t) => SV.engage(s, t, 'effect');
    x.refresh = (t) => SV.refresh(s, t, 'effect');
    x.reveal = (iids, p) => {
      if (!iids.length) return;
      const who = p == null ? x.ctrl : p;
      for (const i of iids) if (['hand', 'deck'].includes(s.cards[i].zone) && !s.revealed[s.cards[i].owner].includes(i)) s.revealed[s.cards[i].owner].push(i);
      SV.log(s, who, 'reveal', { iids: iids.slice() });
    };
    x.recoverPP = (n, p = x.ctrl) => { const P = s.players[p]; const k = Math.max(0, Math.min(n, P.maxPP - P.pp)); P.pp += k; SV.log(s, p, 'recover', { amount: k }); return k; }; // CR 5.15
    x.gainMaxPP = (n, p = x.ctrl) => { const P = s.players[p]; const before = P.maxPP; P.maxPP = Math.max(0, Math.min(10, P.maxPP + n)); SV.log(s, p, 'maxPP', { amount: P.maxPP - before, total: P.maxPP }); return P.maxPP - before; };
    x.gainEP = (n, p = x.ctrl) => { s.players[p].ep = Math.max(0, s.players[p].ep + n); SV.log(s, p, 'ep', { amount: n, total: s.players[p].ep }); };
    x.counter = (t, k, n) => { const c = s.cards[t]; c.counters[k] = Math.max(0, (c.counters[k] || 0) + n); SV.log(s, x.ctrl, 'counter', { iid: t, counter: k, amount: n, total: c.counters[k] }); };

    // Put onto the field / summon (CR 5.5). A card from another zone, or a token by name.
    x.summon = (t, o = {}) => {
      const c = s.cards[t];
      const p = o.ctrl == null ? x.ctrl : o.ctrl;
      const P = s.players[p];
      if (P.field.length >= P.fieldLimit) { SV.log(s, p, 'noRoom', { iid: t, zone: 'field' }); return false; } // CR 4.4.4.2
      const from = SV.move(s, t, 'field', { ctrl: p });
      SV.log(s, p, 'summon', { iid: t, from });
      SV.enterField(s, t, { from, engaged: !!o.engaged });
      return true;
    };
    x.summonToken = (name, n = 1, o = {}) => {
      const out = [];
      for (let k = 0; k < n; k++) { const t = SV.createToken(s, o.p == null ? x.ctrl : o.p, name, 'field', o); if (t) out.push(t); }
      return out;
    };
    x.tokenToEx = (name, n = 1, p = x.ctrl) => {
      const out = [];
      for (let k = 0; k < n; k++) { const t = SV.createToken(s, p, name, 'ex'); if (t) out.push(t); }
      return out;
    };
    // CR 5.17 transform: banish the target, create the token in the same zone.
    x.transform = (t, name) => {
      const c = s.cards[t];
      const zone = c.zone, p = c.zone === 'field' ? c.ctrl : c.owner;
      x.banish(t);
      return SV.createToken(s, p, name, zone);
    };
    x.evolve = (t, o = {}) => SV.doEvolve(s, t, o); // "evolve it" (CR 5.16): no cost
    x.equip = (t, name) => SV.equip(s, t, name);
    x.serve = (t, n = 1) => SV.serve(s, t, n);
    x.race = (t, n = 1) => SV.race(s, t, n);
    // Optional costs at resolution ("[cost02]: ...", CR 10.4.7.4): asked, never assumed.
    x.mayPay = (cost, prompt) => {
      const P = s.players[x.ctrl];
      if (cost.pp && P.pp < cost.pp) return false;
      const yes = x.ask({ kind: 'yesno', prompt: prompt || `Pay ${cost.pp} play point${cost.pp === 1 ? '' : 's'}?`, yes: `Pay ${cost.pp}`, no: "Don't" });
      if (yes) SV.pay(s, x.ctrl, cost);
      return yes;
    };

    // Durations for buffs (see tickDurations in engine.js).
    x.until = {
      eot: () => ({ end: { at: 'eot' } }),
      myNextTurn: () => ({ end: { at: 'startOf', p: x.ctrl } }),
      theirNextTurn: (p) => ({ on: false, start: { at: 'startOf', p }, end: { at: 'endOf', p } }),
      noRefreshNext: (p) => ({ end: { at: 'afterRefresh', p } }),
      forever: () => ({}),
    };
    // "give +X/+Y" (CR 5.27). dur defaults to permanent (while on the field).
    x.buff = (t, mod, dur, text) => {
      const c = s.cards[t];
      if (!['field', 'ex', 'resolution'].includes(c.zone)) return;
      c.mods.push({ ...mod, ...(dur || {}), src: x.me });
      SV.log(s, x.ctrl, 'buff', { iid: t, text: text || buffText(mod), atk: mod.atk, def: mod.def });
    };
    function buffText(m) {
      const parts = [];
      if (m.atk || m.def) parts.push(`${m.atk >= 0 ? '+' : ''}${m.atk || 0}/${m.def >= 0 ? '+' : ''}${m.def || 0}`);
      if (m.kw) parts.push(...Object.keys(m.kw).filter((k) => m.kw[k]));
      return parts.join(' ');
    }
    x.give = (t, kw, dur) => x.buff(t, { kw: { [kw]: true } }, dur, kw);
    x.effect = (e) => s.effects.push({ ...e, src: x.me, p: e.p == null ? x.ctrl : e.p });
    x.once = (key) => {
      const k = `once:${x.me}:${key}`;
      if (s.ti.once[k]) return false;
      s.ti.once[k] = true;
      return true;
    };

    // CR 12.18 Fuse, as the `pay` of an activated ability with zone:'hand': discard from hand or
    // bury from the EX area the specified cards (other than this), then put this into the EX area.
    // Returns the fused cards; [] means nothing was fused and the effect text does not happen (12.18.3).
    x.fuse = ({ filter, min = 1, max = 1, prompt }) => {
      const me = x.me;
      const P = s.players[x.ctrl];
      const cand = [...P.hand, ...P.ex].filter((i) => i !== me && filter(i));
      if (!cand.length) return [];
      const k = Math.min(max, cand.length);
      const pick = x.ask({ kind: 'cards', from: cand, seen: cand, min: Math.min(Math.max(min, 1), k), max: k, prompt: prompt || 'Fuse: choose the card(s) to fuse (from your hand they are discarded, from your EX area they are buried).' });
      for (const i of pick) { if (s.cards[i].zone === 'hand') x.discard(i); else x.bury(i); }
      if (!x.toEx(me)) return pick;
      SV.log(s, x.ctrl, 'fuse', { iid: me, fused: pick.slice() });
      SV.emit(s, { type: 'fused', iid: me, fused: pick.slice(), p: x.ctrl });
      return pick;
    };
    x.canFuse = (filter) => { const P = s.players[x.ctrl]; return [...P.hand, ...P.ex].some((i) => i !== x.me && filter(i)); };

    // CR 1.2.4 / 5.23: an effect that makes a player win ends the game at once (no Confirmation Timing).
    x.winGame = (p = x.ctrl) => SV._endGame(s, p, 'effect');

    // Play a card without paying its cost ("for free"; CR 10.6 with the cost replaced).
    x.playFree = (iid, o = {}) => SV.playCard(s, x, iid, { from: s.cards[iid].zone, ...o });

    // "Search your deck for [filter], [verb] it, then shuffle" (CR 5.8). Returns the found cards.
    x.search = ({ p = x.ctrl, filter = () => true, max = 1, min = 0, prompt, reveal = true, sumCostMax }) => {
      const deck = s.players[p].deck.slice();
      const cand = deck.filter(filter);
      let pick = [];
      if (cand.length) {
        const mx = Math.min(max, cand.length);
        pick = x.ask({ kind: 'cards', who: p, from: cand, seen: cand, min: Math.min(min, mx), max: mx, prompt: prompt || 'Search your deck: choose a card.', sumCostMax });
      }
      if (pick.length && reveal) x.reveal(pick, p);
      return pick;
    };
    x.afterSearch = (p = x.ctrl) => x.shuffle(p); // 5.8.2 always shuffle after searching

    // "Look at the top N cards of your deck. You may reveal [F] among them and add it to your
    // hand. Put the rest on the bottom of your deck in any order." The rest go to the bottom in
    // the order the player chooses (x.order).
    x.lookPick = ({ p = x.ctrl, n, filter = () => true, max = 1, prompt, to = 'hand', restTo = 'bottom' }) => {
      const top = s.players[p].deck.slice(0, n);
      if (!top.length) return [];
      const cand = top.filter(filter);
      const pick = cand.length ? x.ask({ kind: 'cards', who: p, from: cand, seen: top, min: 0, max: Math.min(max, cand.length), prompt }) : [];
      if (pick.length) x.reveal(pick, p);
      for (const i of pick) { if (to === 'hand') x.toHand(i); else if (to === 'ex') x.toEx(i); else if (to === 'field') x.summon(i); }
      const rest = top.filter((i) => !pick.includes(i));
      const ordered = x.order(rest, `Put the rest on the ${restTo} of your deck: choose their order (first = topmost of them).`);
      for (const i of ordered) SV.move(s, i, 'deck', { pos: restTo === 'top' ? undefined : 'bottom' });
      if (restTo === 'top') for (const i of ordered.slice().reverse()) { SV._removeFromZone(s, i); SV._placeIn(s, i, 'deck', { pos: 'top' }); }
      return pick;
    };

    return x;
  };
})();

// Shared helpers for card scripts (H.*): event filters and common predicates.
(function () {
  const SV = globalThis.SV;
  const H = (SV.H = {});
  H.self = (s, me, ev) => ev.iid === me;
  H.mine = (s, me, ev) => ev.p === s.cards[me].ctrl;
  H.myTurn = (s, me) => s.active === s.cards[me].ctrl;
  H.canFuse = (s, me, filter) => { const P = s.players[s.cards[me].owner]; return [...P.hand, ...P.ex].some((i) => i !== me && filter(i)); };
  H.inCemetery = (s, p, filter) => s.players[p].cemetery.some(filter);
  H.ctrl = (s, me) => (s.cards[me].zone === 'field' ? s.cards[me].ctrl : s.cards[me].owner);
  // Sugar that expands to triggers: SV.card(id, {fanfare, lastWords, onEvolve, onSuperEvolve,
  // strike, followerStrike, leaderStrike, mainStart, endStart, ...rest}).
  SV.card = function (id, spec) {
    if (!SV.CARDS[id]) throw new Error(`SV.card: unknown card ${id}`);
    if (SV.ABIL[id]) throw new Error(`SV.card: ${id} defined twice`);
    const a = { ...spec };
    const trig = (a.triggers = (a.triggers || []).slice());
    const add = (name, on, when, run, extra = {}) => trig.push({ name, on, when, run, ...extra });
    const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
    // CR 12.4.3 Fanfare: put onto the field from a zone other than the field.
    for (const f of list(spec.fanfare)) add('Fanfare', 'enter', (s, me, ev) => ev.iid === me && ev.from !== 'field', (x, ev) => f(x, ev));
    // CR 12.5.3 Last Words: put into the cemetery from the field (final information in ev.info).
    for (const f of list(spec.lastWords)) add('Last Words', 'leave', (s, me, ev) => ev.iid === me && ev.to === 'cemetery', (x, ev) => f(x, ev));
    for (const f of list(spec.onEvolve)) add('On Evolve', 'evolve', (s, me, ev) => ev.iid === me, (x, ev) => f(x, ev));
    for (const f of list(spec.onSuperEvolve)) add('On Super-Evolve', 'superEvolve', (s, me, ev) => ev.iid === me, (x, ev) => f(x, ev));
    // CR 12.7 Strike (any target), Follower Strike, Leader Strike.
    for (const f of list(spec.strike)) add('Strike', 'attack', (s, me, ev) => ev.iid === me, (x, ev) => f(x, ev));
    for (const f of list(spec.followerStrike)) add('Follower Strike', 'attack', (s, me, ev) => ev.iid === me && !ev.leader, (x, ev) => f(x, ev));
    for (const f of list(spec.leaderStrike)) add('Leader Strike', 'attack', (s, me, ev) => ev.iid === me && ev.leader, (x, ev) => f(x, ev));
    // "At the start of your main phase" / "At the start of your end phase" (CR 7.3.1, 7.4.1).
    for (const f of list(spec.mainStart)) add('Start of main phase', 'mainStart', (s, me, ev) => ev.p === H.ctrl(s, me), (x, ev) => f(x, ev), spec.mainStartZone ? { zone: spec.mainStartZone } : {});
    for (const f of list(spec.endStart)) add('Start of end phase', 'endStart', (s, me, ev) => ev.p === H.ctrl(s, me), (x, ev) => f(x, ev), spec.endStartZone ? { zone: spec.endStartZone } : {});
    for (const k of ['fanfare', 'lastWords', 'onEvolve', 'onSuperEvolve', 'strike', 'followerStrike', 'leaderStrike', 'mainStart', 'endStart', 'mainStartZone', 'endStartZone']) delete a[k];
    SV.ABIL[id] = a;
    return a;
  };
  // Scripts for reprints are registered under the canonical id only (data/cards.js SV.CARD_ALIAS).
})();

// Script coverage: which cards in a deck have printed text the engine does not read by itself
// and no script. Engine-read lines: keyword lines, the evolve line, the serve line, a lone
// [quick], and everything under a ruled line (deck-building notes, reminders).
(function () {
  const SV = globalThis.SV;
  const ENGINE_LINE = /^(((Ward|Storm|Rush|Bane|Drain|Assail|Intimidate|Aura)\. ?)+|\[quick\]|\[evolve\] ?\[cost\d+\]: Evolve this( follower)?\.|\[feed\] ?\[cost\d+\]: Race this follower\.)$/;
  SV.needsScript = function (id) {
    const d = SV.CARDS[id];
    for (const raw of (d.text || '').split('\n')) {
      if (/^-{3,}$/.test(raw)) continue;
      if (/^You can put up to \d+ of this card into your evolve deck\.$|^Your main deck and evolve deck may only contain/.test(raw)) continue; // deck construction (CR 6.1.2), read by SV.deckProblems
      const l = raw.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      if (l && !ENGINE_LINE.test(l)) return true;
    }
    return false;
  };
  SV.scriptCoverage = function (deck) {
    const ids = [deck.leader, ...deck.main.map((x) => x[0]), ...(deck.evolve || []).map((x) => x[0])];
    const missing = [...new Set(ids)].filter((id) => SV.needsScript(id) && !SV.ABIL[id]);
    return { missing };
  };
})();
