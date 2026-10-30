// js/ui/logtext.js — human-readable log lines from structured log entries (PRESENTATION-
// REFERENCE A7). Display only: the engine never writes prose, and sound/animation read the
// structured data, never this text.
//
// A line is a list of SEGMENTS — strings and {iid, cardNo, name} card references — so the log
// panel can make every card name a hover doorway without string matching. Second person
// ("You draw") is applied here, at render time, for the human seat in vs-AI mode; hot-seat
// and spectate use player names. Hidden information (draws, cards moved out of a hidden zone)
// is named only to its owner.
(function () {
  'use strict';
  const SV = globalThis.SV;

  // Every entry type in docs/ENGINE-API.md "Log entries", plus the leave verbs and the two the
  // ability runtime writes (toHand, fuse). tools/check-pages.mjs fails on any type the engine
  // can write without a phrase here, so a new type cannot ship mute.
  const CONTRACT_TYPES = ['start', 'mulligan', 'turn', 'endPhase', 'draw', 'play', 'evolve', 'ability', 'attack',
    'pass', 'damage', 'fought', 'heal', 'destroy', 'bury', 'banish', 'return', 'toEx', 'toDeck', 'toHand', 'leave',
    'discard', 'engage', 'refresh', 'wardEngage', 'summon', 'token', 'eliminate', 'buff', 'reveal', 'recover',
    'maxPP', 'ep', 'counter', 'stackSave', 'serve', 'race', 'equip', 'noRoom', 'fizzle', 'shuffle', 'fuse', 'win',
    'setDefense', 'maneuver'];

  // ---- perspective ---------------------------------------------------------------------
  // persp = {you: seat|null (second person for this seat), sees: seat|'all'|null, names}
  let persp = { you: 0, sees: 0, names: ['You', 'The opponent'] };
  function setPerspective(p) { persp = p; }

  function isYou(seat) { return persp.you != null && seat === persp.you; }
  function P(seat) {                          // subject form
    if (seat == null) return 'Someone';
    return isYou(seat) ? 'You' : persp.names[seat];
  }
  function mid(seat) { const n = persp.names[seat]; return /^The /.test(n) ? 'the' + n.slice(3) : n; }
  function poss(seat) { return isYou(seat) ? 'your' : mid(seat) + '’s'; }
  function their(seat) { return isYou(seat) ? 'your' : 'their'; }
  function v(seat, bare, third) { return isYou(seat) ? bare : (third || bare + 's'); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function sees(seat) { return persp.sees === 'all' || (persp.sees != null && persp.sees === seat); }

  function C(state, iid) {
    const c = state && state.cards ? state.cards[iid] : null;
    if (!c) return 'a card';
    const no = c.evo && state.cards[c.evo] && c.zone === 'field' ? state.cards[c.evo].id : c.id;
    const d = SV.CARDS[no];
    return { iid: iid, cardNo: no, name: d ? d.name : no };
  }
  function ownerOf(state, iid) { const c = state && state.cards[iid]; return c ? c.owner : null; }
  // A card whose identity the viewer may not know (from a hidden zone, not theirs, not revealed).
  function maybeC(state, iid, hidden) {
    const o = ownerOf(state, iid);
    if (hidden && !sees(o) && state.phase !== 'over') return 'a card';
    return C(state, iid);
  }
  function isLeader(state, iid) { const c = state.cards[iid]; return !!c && c.zone === 'leader'; }
  // A target that may be a leader: "your leader" reads better than the leader card's name.
  function T(state, iid) {
    if (isLeader(state, iid)) return poss(ownerOf(state, iid)) + ' leader';
    return C(state, iid);
  }
  function list(segs, items) {
    items.forEach(function (it, i) {
      if (i > 0) segs.push(i === items.length - 1 ? ' and ' : ', ');
      segs.push(it);
    });
    return segs;
  }
  const ZONE = { deck: 'deck', hand: 'hand', ex: 'EX area', field: 'field', cemetery: 'cemetery', banished: 'banished zone',
    evoDeck: 'evolve deck', resolution: 'resolution zone', gone: 'nowhere', leader: 'leader area', equip: 'equipment' };
  const HIDDEN_ZONES = { deck: 1, hand: 1 };
  const WINDOW = { attack: 'the attack', end: 'the end phase' };
  function by(segs, s, l) {
    if (l.by != null && s.cards[l.by] && l.by !== l.iid) segs.push(' by ', C(s, l.by));
    return segs;
  }

  const D = {
    start: function (l) { return ['The game begins. ', P(l.first), ' ', v(l.first, 'go', 'goes'), ' first.']; },
    mulligan: function (l) {
      if (!l.redraw) return [P(l.who), ' ', v(l.who, 'keep'), ' ', their(l.who), ' opening hand.'];
      return [P(l.who), ' ', v(l.who, 'put'), ' ', their(l.who), ' opening hand on the bottom and ', v(l.who, 'draw'), ' four new cards.'];
    },
    turn: function (l) { return ['Turn ' + l.turn + ' · ' + (isYou(l.who) ? 'Your turn' : persp.names[l.who] + '’s turn')]; },
    endPhase: function (l) { return [poss(l.who).charAt(0).toUpperCase() + poss(l.who).slice(1), ' end phase.']; },
    draw: function (l, s) {
      if (sees(l.who) || s.phase === 'over') return [P(l.who), ' ', v(l.who, 'draw'), ' ', C(s, l.iid), '.'];
      return [P(l.who), ' ', v(l.who, 'draw'), ' a card.'];
    },
    play: function (l, s) {
      const segs = [P(l.who), ' ', v(l.who, 'play'), ' ', C(s, l.iid)];
      if (l.from === 'ex') segs.push(' from ', their(l.who), ' EX area');
      else if (l.from && l.from !== 'hand') segs.push(' from ', their(l.who), ' ' + (ZONE[l.from] || l.from));
      if (l.quick) segs.push(' (Quick)');
      segs.push('.');
      return segs;
    },
    evolve: function (l, s) {
      const segs = [C(s, l.iid), l.sup ? ' super-evolves' : ' evolves'];
      if (l.ep) segs.push(' (using an evolution point)');
      segs.push('.');
      return segs;
    },
    ability: function (l, s) {
      if (l.text) return [C(s, l.iid), ' activates: ' + l.text + (/[.!?]$/.test(l.text) ? '' : '.') + (l.quick ? ' (Quick)' : '')];
      const n = l.name || 'ability';
      return [C(s, l.iid), ': ' + n + (/[.!?]$/.test(n) ? '' : '.')];
    },
    attack: function (l, s) { return [C(s, l.iid), ' attacks ', T(s, l.target), '.']; },
    pass: function (l) { return [P(l.who), ' ', v(l.who, 'do', 'does'), ' not respond to ' + (WINDOW[l.window] || 'it') + '.']; },
    damage: function (l, s) {
      const segs = [T(s, l.iid)];
      if (!l.amount) segs.push(' takes no damage');
      else segs.push(' takes ' + l.amount + ' damage');
      if (l.src != null && s.cards[l.src] && l.src !== l.iid && l.kind === 'ability') segs.push(' from ', C(s, l.src));
      if (l.kind === 'combat') segs.push(' in the fight');
      segs.push('.');
      return segs;
    },
    fought: function (l, s) { return [C(s, l.a), ' and ', C(s, l.t), ' fought.']; },
    heal: function (l) {
      const who = poss(l.p);
      return [who.charAt(0).toUpperCase() + who.slice(1) + ' leader gains ' + l.amount + ' defense' + (l.total != null ? ' (now ' + l.total + ')' : '') + '.'];
    },
    setDefense: function (l) {
      const who = poss(l.p);
      return [who.charAt(0).toUpperCase() + who.slice(1) + ' leader’s defense becomes ' + l.total + ' (was ' + l.from + ').'];
    },
    maneuver: function (l, s) { return [C(s, l.iid), ' maneuvers: it is also a follower until the end of the turn.']; },
    destroy: function (l, s) { return by([C(s, l.iid), ' is destroyed'], s, l).concat(['.']); },
    bury: function (l, s) { return by([C(s, l.iid), ' is buried'], s, l).concat([l.from && l.from !== 'field' ? ' from ' + their(ownerOf(s, l.iid)) + ' ' + (ZONE[l.from] || l.from) + '.' : '.']); },
    banish: function (l, s) { return by([C(s, l.iid), ' is banished'], s, l).concat([l.from && l.from !== 'field' ? ' from ' + their(ownerOf(s, l.iid)) + ' ' + (ZONE[l.from] || l.from) + '.' : '.']); },
    return: function (l, s) { return by([C(s, l.iid), ' returns to ', poss(ownerOf(s, l.iid)), ' hand'], s, l).concat(['.']); },
    toEx: function (l, s) {
      const o = ownerOf(s, l.iid);
      return [C(s, l.iid), ' goes to ', poss(o), ' EX area' + (l.from && l.from !== 'field' ? ' from ' + their(o) + ' ' + (ZONE[l.from] || l.from) : '') + '.'];
    },
    toDeck: function (l, s) {
      const o = ownerOf(s, l.iid);
      return [maybeC(s, l.iid, HIDDEN_ZONES[l.from]), ' goes ' + (l.pos === 'top' ? 'on top of ' : 'to the bottom of '), poss(o), ' deck.'];
    },
    toHand: function (l, s) {
      const o = ownerOf(s, l.iid);
      return [maybeC(s, l.iid, HIDDEN_ZONES[l.from]), ' goes to ', poss(o), ' hand' + (l.from ? ' from ' + their(o) + ' ' + (ZONE[l.from] || l.from) : '') + '.'];
    },
    leave: function (l, s) { return by([C(s, l.iid), ' leaves the field for the ' + (ZONE[l.to] || l.to || 'cemetery')], s, l).concat(['.']); },
    discard: function (l, s) { const o = ownerOf(s, l.iid); return [P(o), ' ', v(o, 'discard'), ' ', C(s, l.iid), '.']; },
    engage: function (l, s) { return [C(s, l.iid), l.ward ? ' enters the field engaged (Ward).' : ' is engaged.']; },
    refresh: function (l, s) { return [C(s, l.iid), ' is refreshed.']; },
    wardEngage: function (l, s) { return list([], (l.iids || []).map(function (i) { return C(s, i); })).concat([(l.iids || []).length === 1 ? ' is engaged (Ward).' : ' are engaged (Ward).']); },
    summon: function (l, s) { return [C(s, l.iid), ' is put onto ', poss(l.who), ' field' + (l.from && l.from !== 'gone' ? ' from ' + their(l.who) + ' ' + (ZONE[l.from] || l.from) : '') + '.']; },
    token: function (l, s) { return ['A ', C(s, l.iid), ' token is created in ', poss(l.who), ' ' + (ZONE[l.zone] || l.zone) + '.']; },
    eliminate: function (l, s) { return [C(s, l.iid), ' (a token) ceases to exist.']; },
    buff: function (l, s) { return [C(s, l.iid), ' gets ' + (l.text || 'modified') + '.']; },
    reveal: function (l, s) { return list([P(l.who), ' ', v(l.who, 'reveal'), ' '], (l.iids || []).map(function (i) { return C(s, i); })).concat(['.']); },
    recover: function (l) { return [P(l.who), ' ', v(l.who, 'recover'), ' ' + plural(l.amount, 'play point') + '.']; },
    maxPP: function (l) { return [P(l.who), ' ', v(l.who, 'gain'), ' ' + plural(l.amount, 'maximum play point') + (l.total != null ? ' (now ' + l.total + ')' : '') + '.']; },
    ep: function (l) {
      if (l.amount < 0) return [P(l.who), ' ', v(l.who, 'lose'), ' ' + plural(-l.amount, 'evolution point') + ' (now ' + l.total + ').'];
      return [P(l.who), ' ', v(l.who, 'gain'), ' ' + plural(l.amount, 'evolution point') + ' (now ' + l.total + ').'];
    },
    counter: function (l, s) {
      const n = Math.abs(l.amount);
      return [C(s, l.iid), (l.amount >= 0 ? ' gets ' : ' loses ') + plural(n, l.counter + ' counter') + ' (now ' + l.total + ').'];
    },
    stackSave: function (l, s) { return [C(s, l.iid), ' loses a Stack counter instead of leaving (' + l.left + ' left).']; },
    serve: function (l, s) { return ['A Carrot is served to ', C(s, l.iid), '.']; },
    race: function (l, s) { return [C(s, l.iid), ' races.']; },
    equip: function (l, s) { return [C(s, l.iid), ' is equipped with ', C(s, l.token), '.']; },
    noRoom: function (l, s) {
      const what = l.iid != null ? C(s, l.iid) : (l.name || 'A card');
      return [what, ' doesn’t fit: ', poss(l.who), ' ' + (ZONE[l.zone] || l.zone || 'zone') + ' is full.'];
    },
    fizzle: function (l, s) { return [l.iid != null ? C(s, l.iid) : 'An effect', ': ' + (l.text || 'it did nothing') + '.']; },
    shuffle: function (l) { return [P(l.who), ' ', v(l.who, 'shuffle'), ' ', their(l.who), ' deck.']; },
    fuse: function (l, s) { return list([C(s, l.iid), ' fuses with '], (l.fused || []).map(function (i) { return C(s, i); })).concat([' and goes to the EX area.']); },
    win: function (l) {
      if (l.draw) return ['The game is a draw: both leaders fell at once.'];
      const why = { defense: 'bringing the other leader’s defense to 0', deckout: 'the other player having to draw from an empty deck',
        concede: 'concession', effect: 'a card’s effect', both: 'both conditions' }[l.reason] || l.reason;
      return [P(l.who), ' ', v(l.who, 'win'), (why ? ' by ' + why : ''), '!'];
    },
  };

  const missing = CONTRACT_TYPES.filter(function (t) { return typeof D[t] !== 'function'; });
  if (missing.length) console.error('[logtext] contract log types with no phrase: ' + missing.join(', '));
  const warned = {};

  function cap(segs) {
    if (typeof segs[0] === 'string' && segs[0].length) segs[0] = segs[0].charAt(0).toUpperCase() + segs[0].slice(1);
    return segs;
  }

  SV.logText = {
    CONTRACT_TYPES: CONTRACT_TYPES,
    missing: missing,
    setPerspective: setPerspective,
    perspective: function () { return persp; },
    // -> array of segments, or null for a type with no describer (logged once).
    segments: function (entry, state) {
      const fn = D[entry.type];
      if (!fn) {
        if (!warned[entry.type]) { warned[entry.type] = true; console.error('[logtext] no phrase for log type "' + entry.type + '"'); }
        return null;
      }
      return cap(fn(entry, state));
    },
    plain: function (entry, state) {
      const segs = SV.logText.segments(entry, state);
      if (!segs) return '(' + entry.type + ')';
      return segs.map(function (x) { return typeof x === 'string' ? x : x.name; }).join('');
    },
    isDivider: function (l) { return l.type === 'turn' || l.type === 'start' || l.type === 'win'; },
    hasPhrase: function (type) { return typeof D[type] === 'function'; },
  };
})();
