// js/ui/core.js — shared UI plumbing: DOM helpers, the shared animation phase, class colours,
// the original inline glyphs for the printed icon tokens ([fanfare], [cost02], [forestcraft]…),
// persisted settings, URL flags and the ONE shared tooltip. Everything under js/ui/ is view
// layer; the engine never loads it.
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U = {};

  U.$ = function (id) { return document.getElementById(id); };
  U.el = function (tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  U.svgEl = function (tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  // ---- Hide / Show: every box the game puts over the board (kb/LESSONS-DIGEST §4.1) ---------
  // A box that asks or tells the player something is never the only thing they can look at:
  // Hide collapses it to one restore pill, the pill brings back the SAME box. Hidden-ness is
  // remembered per overlay against a key, so a re-render of the same question stays hidden and
  // a new question opens shown. Boxes the player opened themselves (inspector, zone browser,
  // action popover, How to play) only need Close: the gesture that opened them reopens them.
  // The hot-seat curtain is the one box that must NOT hide (it guards a hand). CSS: `.peek`.
  const peekedKey = {}, peekHooks = {};
  U.peekable = function (overlay, key, into, opts) {
    const hide = U.el('button', 'peek-btn', opts.hide || 'Hide — check the board');
    hide.onclick = function (e) { e.stopPropagation(); U.setPeek(overlay, true); };
    into.appendChild(hide);
    const restore = U.el('button', 'peek-restore', opts.restore);
    restore.onclick = function (e) { e.stopPropagation(); U.setPeek(overlay, false); };
    overlay.appendChild(restore);
    overlay.dataset.peekKey = key;
    peekHooks[overlay.id] = opts.onToggle || null;
    U.setPeek(overlay, peekedKey[overlay.id] === key);
  };
  U.setPeek = function (overlay, on) {
    overlay.classList.toggle('peek', on);
    peekedKey[overlay.id] = on ? overlay.dataset.peekKey : null;
    if (peekHooks[overlay.id]) peekHooks[overlay.id](on);
  };
  U.isPeeked = function (overlay) { return overlay.classList.contains('peek'); };
  U.forgetPeek = function (id) { peekedKey[id] = null; };

  // ---- URL flags (dev only; never on the default path) ----------------------------------
  //   ?lenient=1   SV.LENIENT: an unscripted spell resolves as nothing, and decks whose card
  //                scripts are still being written can be picked (they say "not ready yet").
  const Q = new URLSearchParams(location.search);
  U.flags = { lenient: Q.get('lenient') === '1' };
  if (U.flags.lenient) SV.LENIENT = true;

  // A rebuilt node restarts its CSS animation; every pulse starts at the SAME wall-clock phase
  // instead, so a board redrawn after every action keeps breathing (PRESENTATION-REFERENCE A6).
  U.animationPhase = function (periodMs) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    return '-' + ((now % periodMs) / 1000).toFixed(3) + 's';
  };
  U.reducedMotion = function () {
    return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  // ---- the six classes + neutral (PLAN §4.12) ---------------------------------------------
  // dot: the jewel on a card corner; text: the lighter word colour that reads over a scrim;
  // hue: the fallback art's colour field; tint: the HUD wash while that class's player acts.
  U.CLASS = {
    forestcraft: { name: 'Forestcraft', dot: '#3fae68', text: '#86e0a4', hue: 140, tint: '61,170,104' },
    swordcraft:  { name: 'Swordcraft',  dot: '#cfa94a', text: '#f2d687', hue: 44,  tint: '214,178,92' },
    runecraft:   { name: 'Runecraft',   dot: '#7f5ce0', text: '#bea6ff', hue: 262, tint: '138,104,230' },
    dragoncraft: { name: 'Dragoncraft', dot: '#e2762c', text: '#ffb27a', hue: 22,  tint: '226,118,44' },
    abysscraft:  { name: 'Abysscraft',  dot: '#b8243c', text: '#ff8293', hue: 350, tint: '184,36,60' },
    havencraft:  { name: 'Havencraft',  dot: '#eadfae', text: '#fff2c8', hue: 48,  tint: '234,223,174' },
    neutral:     { name: 'Neutral',     dot: '#aab6c4', text: '#dfe6ee', hue: 215, tint: '170,182,196' },
  };
  U.classOf = function (cls) {
    const c = U.CLASS[cls];
    if (!c) throw new Error('unknown class ' + cls);
    return c;
  };
  U.TYPE_LABEL = { follower: 'Follower', amulet: 'Amulet', spell: 'Spell', leader: 'Leader', crest: 'Crest', equipment: 'Equipment' };
  U.typeOf = function (cardNo) { return SV.parsed(SV.CARDS[cardNo]).type; };

  // Deterministic PRNG from a string (cosmetic only: fallback art, sparkle jitter).
  U.rand = function (seedStr) {
    let a = SV.hashSeed(String(seedStr)) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // ---- persisted settings -------------------------------------------------------------------
  // localStorage can throw (private mode, blocked storage): every access is wrapped, and a
  // failure only loses the convenience, never the game.
  U.store = {
    get: function (key, dflt) {
      try {
        const v = localStorage.getItem('sv.' + key);
        return v == null ? dflt : JSON.parse(v);
      } catch (e) { return dflt; }
    },
    set: function (key, value) {
      try { localStorage.setItem('sv.' + key, JSON.stringify(value)); } catch (e) { /* convenience only */ }
    },
  };

  // ---- the glyphs ----------------------------------------------------------------------------
  // ORIGINAL drawings for the printed icon tokens (CLAUDE.md: never the official icon images).
  // 16x16, currentColor, sized in em so they ride the text. Each has a spoken name for the
  // tooltip and the glossary.
  const G = {
    // Fanfare: a herald's horn, bell to the right.
    fanfare: '<path d="M1.5 6.4 L6 6 L13.6 2 Q15 1.6 15 3 L15 13 Q15 14.4 13.6 14 L6 10 L1.5 9.6 Z" fill="currentColor"/><path d="M3.4 10.2 L5.6 10.4 L6.4 14.2 L4.4 14.2 Z" fill="currentColor" opacity=".8"/>',
    // Last Words: a gravestone with an engraved cross.
    lastwords: '<path d="M3 15 V6.5 A5 5 0 0 1 13 6.5 V15 Z" fill="currentColor"/><path d="M8 5 V11 M5.6 7.4 H10.4" stroke="rgba(0,0,0,.55)" stroke-width="1.5" stroke-linecap="round"/><rect x="1.5" y="14" width="13" height="1.6" rx=".6" fill="currentColor"/>',
    // Act: a downward press onto a plate.
    act: '<path d="M8 1 L8 9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M3.6 6.2 L8 10.8 L12.4 6.2 Z" fill="currentColor"/><rect x="2" y="12.2" width="12" height="2.6" rx="1.2" fill="currentColor"/>',
    // Engage: a card turning a quarter, with the turning arrow.
    engage: '<rect x="1.6" y="5.4" width="9.4" height="6.6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 2.2 A5.2 5.2 0 0 1 14.2 7.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M15.6 6 L14.2 9.4 L11.8 6.8 Z" fill="currentColor"/>',
    // Evolve: two rising chevrons over a seed of light.
    evolve: '<path d="M2.4 8.6 L8 3 L13.6 8.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M3.6 13.2 L8 8.8 L12.4 13.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".75"/><circle cx="8" cy="14.6" r="1.1" fill="currentColor"/>',
    // Quick: a lightning stroke.
    quick: '<path d="M9.6 .8 L3 9.2 L7.4 9.2 L6.2 15.2 L13 6.4 L8.6 6.4 Z" fill="currentColor"/>',
    // Attack: a blade on the diagonal.
    attack: '<path d="M14.6 1.4 L13.8 5 L6.2 12.6 L3.4 9.8 L11 2.2 Z" fill="currentColor"/><path d="M2.2 9.6 L6.4 13.8 M1.4 14.6 L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    // Defense: a kite shield.
    defense: '<path d="M8 .9 L14.2 3 L13.6 8.4 Q12.8 12.6 8 15.2 Q3.2 12.6 2.4 8.4 L1.8 3 Z" fill="currentColor"/><path d="M8 3.4 V12.4" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>',
    // Feed (serve): a horseshoe.
    feed: '<path d="M3.4 2 V8.4 A4.6 4.6 0 0 0 12.6 8.4 V2" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><circle cx="4.6" cy="9.6" r=".7" fill="rgba(0,0,0,.5)"/><circle cx="11.4" cy="9.6" r=".7" fill="rgba(0,0,0,.5)"/>',
    // Union Burst: an eight-point burst.
    UB: '<path d="M8 .4 L9.4 5 L13.4 2.6 L11 6.6 L15.6 8 L11 9.4 L13.4 13.4 L9.4 11 L8 15.6 L6.6 11 L2.6 13.4 L5 9.4 L.4 8 L5 6.6 L2.6 2.6 L6.6 5 Z" fill="currentColor"/>',
    // Class emblems.
    forestcraft: '<path d="M8 .8 C13.6 3.6 14.4 9.4 8 15.2 C1.6 9.4 2.4 3.6 8 .8 Z" fill="currentColor"/><path d="M8 3.4 V14 M8 7 L5.4 5.2 M8 9.6 L10.8 7.6" stroke="rgba(0,0,0,.45)" stroke-width="1" fill="none" stroke-linecap="round"/>',
    swordcraft: '<path d="M8 .6 L9.6 3 L9.6 9.6 L6.4 9.6 L6.4 3 Z" fill="currentColor"/><rect x="3" y="9.6" width="10" height="1.8" rx=".6" fill="currentColor"/><rect x="7" y="11.4" width="2" height="2.6" fill="currentColor"/><circle cx="8" cy="14.6" r="1.1" fill="currentColor"/>',
    runecraft: '<circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 2.6 L12.6 10.6 L3.4 10.6 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8.4" r="1.5" fill="currentColor"/>',
    dragoncraft: '<path d="M8 .6 C10 4 13.4 5.4 12.8 10 C12.4 13.4 10 15.4 8 15.4 C5.4 15.4 3.2 13.2 3.4 10.2 C3.6 7.8 5.2 7 5.6 4.8 C6.8 6.2 7 7.6 6.8 9 C8.4 7.4 8.8 4.4 8 .6 Z" fill="currentColor"/>',
    abysscraft: '<path d="M10.6 1.4 A7 7 0 1 0 14.8 11 A5.6 5.6 0 0 1 10.6 1.4 Z" fill="currentColor"/><path d="M5.2 9.6 L6.2 12.6 L7.2 9.8 Z" fill="rgba(0,0,0,.5)"/>',
    havencraft: '<path d="M8 .4 L9.2 6.8 L15.6 8 L9.2 9.2 L8 15.6 L6.8 9.2 L.4 8 L6.8 6.8 Z" fill="currentColor"/><circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    neutral: '<path d="M8 1 L14.6 8 L8 15 L1.4 8 Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 5 L11 8 L8 11 L5 8 Z" fill="currentColor"/>',
    // UI-only marks (not printed tokens): the play point, the evolution point, the super star.
    pp: '<path d="M8 1 L13.6 4.6 L13.6 11.4 L8 15 L2.4 11.4 L2.4 4.6 Z" fill="currentColor"/>',
    ep: '<circle cx="8" cy="8" r="6.4" fill="currentColor"/><path d="M4.8 9 L8 5.4 L11.2 9 M5.8 11.8 L8 9.4 L10.2 11.8" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    sep: '<path d="M8 .6 L10 5.6 L15.4 6 L11.2 9.4 L12.6 14.8 L8 11.8 L3.4 14.8 L4.8 9.4 L.6 6 L6 5.6 Z" fill="currentColor"/>',
  };
  G.q = G.quick;
  const GLYPH_NAME = { fanfare: 'Fanfare', lastwords: 'Last Words', act: 'Act (activated ability)', engage: 'Engage', evolve: 'Evolve',
    quick: 'Quick', q: 'Quick', attack: 'Attack', defense: 'Defense', feed: 'Serve / race (Umamusume)', UB: 'Union Burst',
    forestcraft: 'Forestcraft', swordcraft: 'Swordcraft', runecraft: 'Runecraft', dragoncraft: 'Dragoncraft',
    abysscraft: 'Abysscraft', havencraft: 'Havencraft', neutral: 'Neutral',
    pp: 'Play point', ep: 'Evolution point', sep: 'Super-evolution point' };
  U.GLYPH_NAME = GLYPH_NAME;
  U.glyphSVG = function (k) {
    if (!G[k]) throw new Error('no glyph ' + k);
    return '<svg viewBox="0 0 16 16" class="ico ico-' + k + '" aria-hidden="true">' + G[k] + '</svg>';
  };
  U.glyph = function (k) {
    const span = U.el('span', 'glyph glyph-' + k);
    span.innerHTML = U.glyphSVG(k);
    span.setAttribute('data-tip', GLYPH_NAME[k] || k);
    if (U.CLASS[k]) span.style.color = U.CLASS[k].text;
    return span;
  };
  U.hasGlyph = function (k) { return !!G[k]; };
  // [costNN]: a small cost jewel with the number in it (a round gem; never the printed frame).
  U.costChip = function (n) {
    const span = U.el('span', 'glyph glyph-cost');
    span.appendChild(U.el('span', 'glyph-cost-n', String(n)));
    span.setAttribute('data-tip', 'Cost: ' + n + ' play point' + (n === 1 ? '' : 's'));
    return span;
  };

  // Appends printed text with every [token] drawn as its glyph. The words are verbatim.
  U.appendText = function (node, text) {
    const re = /\[([A-Za-z]+?)(\d\d)?\]/g;
    let at = 0, m;
    while ((m = re.exec(text)) !== null) {
      const key = m[1], num = m[2];
      if (m.index > at) node.appendChild(document.createTextNode(text.slice(at, m.index)));
      if (key === 'cost' && num != null) node.appendChild(U.costChip(Number(num)));
      else if (G[key]) node.appendChild(U.glyph(key));
      else node.appendChild(document.createTextNode(m[0]));   // an unknown token stays as printed
      at = m.index + m[0].length;
    }
    if (at < text.length) node.appendChild(document.createTextNode(text.slice(at)));
  };

  // The play-point cost: a faceted jewel in the card's class colour with a silver rim. A
  // hexagonal gem of our own; the printed card frame is never imitated.
  U.costGem = function (cost, cls, extraCls) {
    const wrap = U.el('span', 'cost-gem' + (extraCls ? ' ' + extraCls : ''));
    const c = U.classOf(cls).dot;
    const gid = 'gm' + Math.random().toString(36).slice(2, 8);
    wrap.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><defs><radialGradient id="' + gid + '" cx="38%" cy="30%" r="72%">' +
      '<stop offset="0" stop-color="#ffffff" stop-opacity=".8"/><stop offset=".3" stop-color="' + c + '"/>' +
      '<stop offset="1" stop-color="#0a0710"/></radialGradient></defs>' +
      '<path class="gem-rim" d="M20 2.6 L35.4 11.8 L35.4 28.2 L20 37.4 L4.6 28.2 L4.6 11.8 Z"/><path d="M20 6 L32.5 13.5 L32.5 26.5 L20 34 L7.5 26.5 L7.5 13.5 Z" fill="url(#' + gid + ')"/></svg>';
    wrap.appendChild(U.el('span', 'cost-num', cost == null ? '–' : String(cost)));
    return wrap;
  };

  // ---- the one shared tooltip ------------------------------------------------------------------
  // No native title= tooltips anywhere: any node carrying data-tip gets this bubble, from ONE
  // delegated listener.
  let tipNode = null, tipFor = null;
  function tip() {
    if (!tipNode) { tipNode = U.el('div'); tipNode.id = 'tooltip'; document.body.appendChild(tipNode); }
    return tipNode;
  }
  function showTip(target) {
    const text = target.getAttribute('data-tip');
    if (!text) return;
    const t = tip();
    t.textContent = text;
    t.classList.add('open');
    const r = target.getBoundingClientRect();
    const w = t.offsetWidth, h = t.offsetHeight;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.top - h - 8;
    if (top < 8) top = r.bottom + 8;
    t.style.left = left + 'px';
    t.style.top = top + 'px';
    tipFor = target;
  }
  function hideTip() { tipFor = null; if (tipNode) tipNode.classList.remove('open'); }
  U.hideTip = hideTip;
  document.addEventListener('mouseover', function (e) {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t === tipFor) return;
    if (t) showTip(t); else hideTip();
  });
  document.addEventListener('focusin', function (e) {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) showTip(t);
  });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('pointerdown', hideTip, true);
})();
