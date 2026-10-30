// js/ui/title.js — the entry point (PRESENTATION-REFERENCE A1), dressed as this game's own scene
// (PLAN D17, "the evolution rite"): a splash where the wordmark is drawn in light over a turning
// circle -> the ring wipe -> the rite (modes down the left, the two summoners facing each other
// as leader medallions, the skill, the blade that begins the duel) -> "choose a leader", a
// gallery of every deck with hover peek -> match. The Start click is the first real gesture, so
// it also unlocks audio. Nothing here touches game state; SV.ui.start begins a match.
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;
  const el = U.el, $ = U.$;

  const HOLD_MS = 3200, WIPE_MS = 900, PEEK_MS = 600;
  // Verbatim from NOTICE.md "In-game disclaimer" (same-commit maintenance: change both).
  const DISCLAIMER = 'This is an unofficial, non-commercial fan project and is not affiliated with, endorsed, sponsored or approved by Cygames, Inc. or Bushiroad. Shadowverse: Evolve and its card names and rules text belong to Cygames, Inc. and Bushiroad and are reproduced here for personal play. This game contains no official card images, logos or artwork; all art and sound are original and generated locally. Nothing here is for sale.';
  SV.DISCLAIMER = DISCLAIMER;

  let phase = 'idle', holdTimer = null;
  const chosen = { a: null, b: null };
  const secret = { a: true, b: true };
  let mode = U.store.get('mode', 'ai');
  let level = U.store.get('level', 'normal');
  if (['ai', 'hotseat', 'spectate', 'tutorial'].indexOf(mode) < 0) mode = 'ai';
  if (['easy', 'normal', 'hard'].indexOf(level) < 0) level = 'normal';

  // ---- decks --------------------------------------------------------------------------------
  // A deck is offered when the engine can play it as printed: no card in data/defects.js
  // (SV.playableDecks) and every card that needs a script has one (SV.scriptCoverage). Decks
  // still waiting on scripts are LISTED as "not ready yet", never silently dropped; ?lenient=1
  // (dev) lets them be picked anyway.
  SV.savedDecks = function () {
    const list = U.store.get('decks', []);
    return Array.isArray(list) ? list.filter(function (d) { return d && d.leader && Array.isArray(d.main); }) : [];
  };
  function missingOf(d) { return SV.scriptCoverage(d).missing; }
  function status(d) {
    if (d.custom) {
      const probs = SV.deckProblems(d);
      if (probs.length) return { ok: false, why: 'Not legal: ' + probs.join(' ') };
    }
    const miss = missingOf(d);
    if (miss.length && !U.flags.lenient) return { ok: false, notReady: true, why: 'Not ready yet — ' + miss.length + ' card script' + (miss.length === 1 ? '' : 's') + ' still being written.' };
    if (miss.length) return { ok: true, why: 'Lenient (dev): ' + miss.length + ' card script' + (miss.length === 1 ? '' : 's') + ' missing — those effects do nothing.' };
    return { ok: true, why: null };
  }
  function deckById(key) {
    if (!key) return null;
    if (key.indexOf('custom:') === 0) {
      const d = SV.savedDecks().find(function (x) { return 'custom:' + x.id === key; });
      return d ? { key: key, id: null, name: d.name, cls: SV.CARDS[d.leader] ? SV.CARDS[d.leader].cls : 'neutral', leader: d.leader, main: d.main, evolve: d.evolve || [], custom: true } : null;
    }
    const d = SV.DECKS.find(function (x) { return x.id === key; });
    return d ? Object.assign({ key: key }, d) : null;
  }
  function engineDeck(key) {
    const d = deckById(key);
    if (!d) throw new Error('unknown deck ' + key);
    return d.custom ? { name: d.name, cls: d.cls, leader: d.leader, main: d.main, evolve: d.evolve } : d.id;
  }
  const playable = function () { return SV.playableDecks(); };
  function hiddenByDefects() { return SV.DECKS.length - playable().length; }
  function readyKeys() {
    const keys = playable().filter(function (d) { return status(d).ok; }).map(function (d) { return d.id; });
    SV.savedDecks().forEach(function (d) { const x = deckById('custom:' + d.id); if (status(x).ok) keys.push(x.key); });
    return keys;
  }
  function randomDeck(notThis) {
    const pool = playable().filter(function (d) { return status(d).ok; }).map(function (d) { return d.id; });
    const alt = pool.filter(function (k) { return k !== notThis; });
    const from = alt.length ? alt : pool;
    return from.length ? from[Math.floor(Math.random() * from.length)] : null;
  }
  function sourceLine(d) {
    if (d.custom) return 'Your deck';
    const s = d.source || {};
    if (s.kind === 'featured') return 'Official featured deck' + (s.decklog ? ' · Decklog ' + s.decklog : '');
    if (s.kind === 'tournament') return [s.event, s.place, s.player, s.date].filter(Boolean).join(' · ');
    return '';
  }
  function deckCount(d) {
    const n = function (list) { return (list || []).reduce(function (a, x) { return a + x[1]; }, 0); };
    return n(d.main) + ' + ' + n(d.evolve) + ' evolve';
  }
  function clsDot(cls) {
    const g = U.glyph(cls);
    g.classList.add('deck-cls');
    return g;
  }
  function leaderName(d) { return SV.CARDS[d.leader] ? SV.CARDS[d.leader].name : '?'; }
  // A leader's portrait: the leader card's own art plate, or nothing (the caller draws a mark).
  function portrait(d) {
    const url = d && SV.artUrl(d.leader);
    if (!url) return null;
    const img = document.createElement('img');
    img.src = url; img.alt = ''; img.draggable = false;
    return img;
  }

  // ---- the peek -----------------------------------------------------------------------------
  function clearPeek() { const o = document.querySelector('.deck-peek'); if (o) o.remove(); }
  function keyCards(d) {
    return (d.main || []).map(function (c) { return SV.CARDS[c[0]]; }).filter(function (x) { return x && SV.parsed(x).type === 'follower'; })
      .sort(function (a, b) { return (b.cost || 0) - (a.cost || 0); }).slice(0, 2);
  }
  function attachPeek(btn, keyOf) {
    let t = null;
    function show() {
      clearPeek();
      const d = deckById(keyOf());
      if (!d) return;
      const panel = el('div', 'deck-peek no-preview');
      const head = el('div', 'peek-head');
      const nm = el('div', 'peek-name');
      nm.appendChild(clsDot(d.cls));
      nm.appendChild(document.createTextNode(' ' + d.name));
      head.appendChild(nm);
      head.appendChild(el('div', 'peek-meta', U.classOf(d.cls).name + ' · leader ' + leaderName(d) + ' · ' + deckCount(d)));
      const src = sourceLine(d);
      if (src) head.appendChild(el('div', 'peek-src', src));
      const st = status(d);
      if (st.why) head.appendChild(el('div', 'peek-src is-warn', st.why));
      panel.appendChild(head);
      const row = el('div', 'peek-cards');
      if (SV.CARDS[d.leader]) row.appendChild(SV.renderCard(d.leader, { size: 'preview' }));
      keyCards(d).forEach(function (def) { row.appendChild(SV.renderCard(def.no, { size: 'preview' })); });
      panel.appendChild(row);
      document.body.appendChild(panel);
      // Scale to fit rather than clip: a peek nobody can scroll must show everything.
      const r = btn.getBoundingClientRect();
      const w = panel.offsetWidth, h = panel.offsetHeight;
      const k = Math.min(1, (window.innerHeight - 16) / h, (window.innerWidth - 16) / w);
      if (k < 1) { panel.style.transform = 'scale(' + k + ')'; panel.style.transformOrigin = '0 0'; }
      const sw = w * k, sh = h * k;
      let left = r.right + 12;
      if (left + sw > window.innerWidth - 8) left = r.left - sw - 12;
      if (left < 8) left = Math.max(8, (window.innerWidth - sw) / 2);
      panel.style.left = left + 'px';
      panel.style.top = Math.max(8, Math.min(r.top + r.height / 2 - sh / 2, window.innerHeight - sh - 8)) + 'px';
    }
    function arm() { clearTimeout(t); t = setTimeout(show, PEEK_MS); }
    function disarm() { clearTimeout(t); clearPeek(); }
    btn.addEventListener('mouseenter', arm);
    btn.addEventListener('mouseleave', disarm);
    btn.addEventListener('focus', arm);
    btn.addEventListener('blur', disarm);
    btn.addEventListener('click', disarm);
  }

  // ---- drawn marks: the wordmark and the turning circle ---------------------------------------
  // The wordmark is original geometric lettering: each letter a stroke path on a 10 x 14 grid
  // with cut corners, drawn by light on the splash (stroke-dashoffset). No typeface, no logo.
  const LETTERS = {
    S: 'M10 2 L8 0 L2 0 L0 2 L0 5 L2 7 L8 7 L10 9 L10 12 L8 14 L2 14 L0 12',
    H: 'M0 0 L0 14 M10 0 L10 14 M0 7 L10 7',
    A: 'M0 14 L0 4 L4 0 L6 0 L10 4 L10 14 M0 8 L10 8',
    D: 'M0 0 L0 14 L7 14 L10 11 L10 3 L7 0 Z',
    O: 'M3 0 L7 0 L10 3 L10 11 L7 14 L3 14 L0 11 L0 3 Z M5 5 L7 7 L5 9 L3 7 Z',
    W: 'M0 0 L0 14 L5 9 L10 14 L10 0',
    F: 'M10 0 L0 0 L0 14 M0 7 L7 7',
    R: 'M0 14 L0 0 L8 0 L10 2 L10 5 L8 7 L0 7 M5 7 L10 14',
    G: 'M10 2 L8 0 L2 0 L0 2 L0 12 L2 14 L8 14 L10 12 L10 8 L5 8',
    E: 'M10 0 L0 0 L0 14 L10 14 M0 7 L7 7',
  };
  let markSeq = 0;
  function wordmark(small, draw) {
    const word = 'SHADOWFORGE', step = 15, w = word.length * step - 5;
    const id = 'wm-grad' + (++markSeq);
    const svg = U.svgEl('svg', { class: 'wordmark' + (small ? ' wordmark-small' : '') + (draw ? ' is-drawn' : ''), viewBox: '-2 -2 ' + (w + 4) + ' 18', role: 'img', 'aria-label': 'Shadowforge' });
    let html = '<defs><linearGradient id="' + id + '" x1="0" x2="1"><stop offset="0" stop-color="#bfefff"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#9fdcff"/></linearGradient></defs>';
    word.split('').forEach(function (ch, i) {
      html += '<path pathLength="100" style="stroke:url(#' + id + ');animation-delay:' + (i * 90) + 'ms" transform="translate(' + (i * step) + ' 0)" d="' + LETTERS[ch] + '"/>';
    });
    svg.innerHTML = html;
    return svg;
  }
  function titleRing() {
    const svg = U.svgEl('svg', { class: 'title-ring', viewBox: '-500 -500 1000 1000', 'aria-hidden': 'true' });
    let ticks = '';
    for (let i = 0; i < 120; i++) {
      const a = i * Math.PI * 2 / 120, r1 = 452, r2 = i % 10 === 0 ? 482 : 466;
      ticks += 'M' + (Math.cos(a) * r1).toFixed(1) + ' ' + (Math.sin(a) * r1).toFixed(1) + ' L' + (Math.cos(a) * r2).toFixed(1) + ' ' + (Math.sin(a) * r2).toFixed(1) + ' ';
    }
    const tri = function (off, r) {
      return [0, 1, 2].map(function (i) { const a = -Math.PI / 2 + off + i * Math.PI * 2 / 3; return (Math.cos(a) * r).toFixed(1) + ',' + (Math.sin(a) * r).toFixed(1); }).join(' ');
    };
    let gems = '';
    ['forestcraft', 'swordcraft', 'runecraft', 'dragoncraft', 'abysscraft', 'havencraft'].forEach(function (k, i) {
      const a = -Math.PI / 2 + i * Math.PI / 3, x = Math.cos(a) * 420, y = Math.sin(a) * 420, s = 12;
      gems += '<path d="M' + x + ' ' + (y - s) + ' L' + (x + s) + ' ' + y + ' L' + x + ' ' + (y + s) + ' L' + (x - s) + ' ' + y + ' Z" fill="' + U.CLASS[k].dot + '" style="filter:drop-shadow(0 0 6px ' + U.CLASS[k].dot + ')"/>';
    });
    svg.innerHTML = '<circle class="tr-ring" r="486"/><circle class="tr-ring is-thin" r="448"/>' +
      '<g class="tr-spin-rev"><path class="tr-ticks" d="' + ticks + '"/></g>' +
      '<g class="tr-spin"><polygon class="tr-hex" points="' + tri(0, 420) + '"/><polygon class="tr-hex" points="' + tri(Math.PI / 3, 420) + '"/>' + gems + '</g>' +
      '<circle class="tr-ring is-thin" r="300"/><circle class="tr-ring is-thin" r="210"/>';
    return svg;
  }

  // ---- screens ---------------------------------------------------------------------------------
  function screen() { return $('title-screen'); }
  function setBg(name) {
    const url = SV.uiArtUrl(name) || SV.uiArtUrl('title');
    screen().style.backgroundImage = url ? 'url("' + url + '")' : '';
  }
  function fill(nodes) {
    const sc = screen();
    sc.textContent = '';
    sc.appendChild(titleRing());
    nodes.forEach(function (n) { sc.appendChild(n); });
    sc.appendChild(disclaimer());
  }

  function splash() {
    const wrap = el('div', 'title-splash');
    wrap.appendChild(el('div', 'title-once', 'Two summoners · one dais'));
    wrap.appendChild(wordmark(false, true));
    wrap.appendChild(el('div', 'title-tagline', 'Followers · spells · evolution'));
    wrap.appendChild(el('div', 'title-hint', 'Click to continue'));
    return wrap;
  }
  function disclaimer() { return el('div', 'title-disclaimer', DISCLAIMER); }

  const SLOT_LABEL = {
    ai: ['You', 'Opponent'], tutorial: ['You', 'Opponent'],
    hotseat: ['Player 1', 'Player 2'], spectate: ['Bot A', 'Bot B'],
  };
  const MODES = [['ai', 'Vs computer'], ['hotseat', 'Two players'], ['spectate', 'Watch'], ['tutorial', 'Tutorial']];
  const MODE_HELP = {
    ai: 'Play against the computer', hotseat: 'Two players take turns on one device',
    spectate: 'Watch the computer play itself', tutorial: 'A guided game against an easy computer',
  };

  // A summoner: the leader medallion (click to choose a deck), the name, and two small controls.
  function medal(side) {
    const d = deckById(chosen[side]);
    const wrap = el('div', 'medal' + (side === 'b' ? ' is-foe' : ''));
    const pick = el('button', 'medal-pick');
    pick.type = 'button';
    const ring = el('div', 'medal-ring');
    const face = el('div', 'medal-face');
    const img = (!d || secret[side]) ? null : portrait(d);
    if (img) face.appendChild(img);
    else face.appendChild(el('span', 'medal-secret', d ? '?' : '–'));
    ring.appendChild(face);
    if (d && !secret[side]) {
      const gem = el('span', 'medal-gem');
      gem.appendChild(U.glyph(d.cls));
      ring.appendChild(gem);
    }
    pick.appendChild(ring);
    pick.appendChild(el('span', 'medal-who', SLOT_LABEL[mode][side === 'a' ? 0 : 1]));
    if (!d) pick.appendChild(el('span', 'medal-name', 'No deck is ready yet'));
    else if (secret[side]) {
      pick.appendChild(el('span', 'medal-name', 'A random deck'));
      pick.appendChild(el('span', 'medal-meta', 'Hidden until the duel begins'));
    } else {
      pick.appendChild(el('span', 'medal-name', d.name));
      pick.appendChild(el('span', 'medal-meta', U.classOf(d.cls).name + ' · ' + leaderName(d)));
    }
    pick.setAttribute('aria-label', 'Choose ' + SLOT_LABEL[mode][side === 'a' ? 0 : 1].toLowerCase() + ' deck');
    attachPeek(pick, function () { return secret[side] ? null : chosen[side]; });
    pick.onclick = function () { openChooser(side, function (k) { chosen[side] = k; secret[side] = false; }); };
    wrap.appendChild(pick);
    const ctl = el('div', 'medal-ctl');
    const choose = el('button', null, 'Choose');
    choose.type = 'button';
    choose.onclick = pick.onclick;
    const dice = el('button', null, 'Random');
    dice.type = 'button';
    dice.setAttribute('data-tip', 'Roll a random ready deck (kept secret until the duel begins)');
    dice.onclick = function () { clearPeek(); chosen[side] = randomDeck(chosen[side === 'a' ? 'b' : 'a']); secret[side] = true; rebuild(); };
    ctl.appendChild(choose); ctl.appendChild(dice);
    wrap.appendChild(ctl);
    return wrap;
  }

  function tutorialDecks() {
    const keys = readyKeys().filter(function (k) { return k.indexOf('custom:') < 0; });
    if (!keys.length) return null;
    const a = keys[0];
    const b = keys.find(function (k) { return deckById(k).cls !== deckById(a).cls; }) || keys[keys.length > 1 ? 1 : 0];
    return [a, b];
  }

  function rite() {
    if (!deckById(chosen.a)) { chosen.a = randomDeck(null); secret.a = true; }
    if (!deckById(chosen.b)) { chosen.b = randomDeck(chosen.a); secret.b = true; }
    const box = el('div', 'rite');
    const head = el('div', 'rite-head');
    head.appendChild(wordmark(true, false));
    head.appendChild(el('div', 'title-tagline', MODE_HELP[mode]));
    box.appendChild(head);

    const modes = el('nav', 'rite-modes');
    MODES.forEach(function (m) {
      const b = el('button', 'rite-mode' + (m[0] === mode ? ' is-on' : ''), m[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', m[0] === mode ? 'true' : 'false');
      b.onclick = function () { mode = m[0]; U.store.set('mode', mode); rebuild(); };
      modes.appendChild(b);
    });
    modes.appendChild(el('div', 'rite-mode-sep'));
    const db = el('button', 'rite-mode is-link', 'Deck builder');
    db.type = 'button';
    db.onclick = function () { SV.deckBuilder.open(); };
    const help = el('button', 'rite-mode is-link', 'How to play');
    help.type = 'button';
    help.onclick = function () { SV.hud.openHelp(); };
    modes.appendChild(db); modes.appendChild(help);
    box.appendChild(modes);

    const main = el('div', 'rite-main');
    const ready = readyKeys();
    if (mode !== 'tutorial') {
      const face = el('div', 'faceoff');
      face.appendChild(medal('a'));
      const vs = el('div', 'vs-gem');
      vs.appendChild(el('span', null, 'VS'));
      face.appendChild(vs);
      face.appendChild(medal('b'));
      main.appendChild(face);
    } else {
      main.appendChild(el('div', 'rite-tutorial', 'The tutorial uses two fixed decks and an Easy opponent. Coach bubbles explain each idea the first time it comes up; you can skip them at any time.'));
    }
    if (mode === 'ai' || mode === 'spectate') {
      const row = el('div', 'rite-skill');
      row.appendChild(el('span', 'rite-skill-label', mode === 'spectate' ? 'Bot skill' : 'Opponent skill'));
      const seg = el('div', 'seg');
      seg.setAttribute('role', 'group');
      [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']].forEach(function (o) {
        const b = el('button', o[0] === level ? 'is-on' : '', o[1]);
        b.type = 'button';
        b.setAttribute('aria-pressed', o[0] === level ? 'true' : 'false');
        b.onclick = function () { level = o[0]; U.store.set('level', level); rebuild(); };
        seg.appendChild(b);
      });
      row.appendChild(seg);
      main.appendChild(row);
    }
    const start = el('button', 'title-start action-btn', mode === 'tutorial' ? 'Begin the tutorial' : 'Begin the duel');
    start.type = 'button';
    const canStart = mode === 'tutorial' ? !!tutorialDecks() : (deckById(chosen.a) && deckById(chosen.b));
    start.disabled = !canStart;
    start.onclick = function () { begin(); };
    main.appendChild(start);
    const notes = el('div', 'rite-notes');
    if (!ready.length) {
      notes.appendChild(el('div', 'title-note is-warn', 'No deck is ready yet: the card scripts for every deck are still being written. Open the deck chooser to see what each deck is waiting for.'));
    }
    if (U.flags.lenient) notes.appendChild(el('div', 'title-note is-warn', 'Lenient mode (?lenient=1, dev only): unscripted cards do nothing when played.'));
    if (notes.childNodes.length) main.appendChild(notes);
    box.appendChild(main);
    return box;
  }
  function rebuild() {
    clearPeek();
    fill([rite()]);
  }
  SV.title = SV.title || {};
  SV.title.rebuild = rebuild;

  // Choose a leader: every deck as a portrait tile, grouped by where the list comes from.
  function openChooser(side, done) {
    const box = el('div', 'title-picker deck-chooser');
    box.appendChild(el('h1', 'title-name title-name-small', 'Choose a leader · ' + SLOT_LABEL[mode][side === 'a' ? 0 : 1]));
    function closeIt(k) { clearPeek(); if (k) done(k); rebuild(); }
    const decks = playable();
    const groups = [
      ['Official featured decks · Combined Set “Eightfold Retribution & Omens and Heirs”', decks.filter(function (d) { return d.source && d.source.kind === 'featured'; }).map(function (d) { return d.id; })],
      ['Tournament winners · Grand Showdown 2026', decks.filter(function (d) { return d.source && d.source.kind === 'tournament'; }).map(function (d) { return d.id; })],
      ['Other decks', decks.filter(function (d) { return !d.source || (d.source.kind !== 'featured' && d.source.kind !== 'tournament'); }).map(function (d) { return d.id; })],
      ['Your decks', SV.savedDecks().map(function (d) { return 'custom:' + d.id; })],
    ];
    groups.forEach(function (g) {
      if (!g[1].length && g[0] !== 'Your decks') return;
      box.appendChild(el('div', 'deck-group-label', g[0]));
      if (!g[1].length) { box.appendChild(el('div', 'title-note', 'No saved decks yet — build one in the Deck builder.')); return; }
      const grid = el('div', 'deck-grid');
      g[1].forEach(function (k) {
        const d = deckById(k);
        const st = status(d);
        const b = el('button', 'deck-choice' + (k === chosen[side] && !secret[side] ? ' is-chosen' : '') + (st.ok ? '' : ' is-unready'));
        b.type = 'button';
        const face = el('span', 'deck-face');
        face.style.setProperty('--cls', U.classOf(d.cls).dot);
        const img = portrait(d);
        if (img) face.appendChild(img);
        b.appendChild(face);
        const top = el('span', 'deck-choice-name');
        top.appendChild(clsDot(d.cls));
        top.appendChild(document.createTextNode(' ' + d.name));
        b.appendChild(top);
        b.appendChild(el('span', 'deck-choice-meta', U.classOf(d.cls).name + ' · leader ' + leaderName(d) + ' · ' + deckCount(d)));
        const src = sourceLine(d);
        if (src) b.appendChild(el('span', 'deck-choice-meta', src));
        if (st.why) b.appendChild(el('span', 'deck-choice-meta ' + (st.ok ? 'is-note' : 'is-warn'), st.why));
        b.disabled = !st.ok;
        b.onclick = function () { closeIt(k); };
        attachPeek(b, function () { return k; });
        grid.appendChild(b);
      });
      box.appendChild(grid);
    });
    const hidden = hiddenByDefects();
    if (hidden) box.appendChild(el('div', 'title-note', hidden + ' deck' + (hidden === 1 ? ' is' : 's are') + ' not listed: ' + (hidden === 1 ? 'it contains' : 'they contain') + ' a card that does not play as printed yet (data/defects.js).'));
    const row = el('div', 'deck-chooser-actions');
    const rnd = el('button', 'title-select-btn', 'Surprise me');
    rnd.type = 'button';
    rnd.onclick = function () { clearPeek(); chosen[side] = randomDeck(null); secret[side] = true; rebuild(); };
    const back = el('button', 'title-select-btn', 'Back');
    back.type = 'button';
    back.onclick = function () { closeIt(null); };
    row.appendChild(rnd); row.appendChild(back);
    box.appendChild(row);
    const sc = screen();
    sc.textContent = '';
    sc.appendChild(titleRing());
    sc.appendChild(box);
  }

  // The scene change: a ring of light. A night disc with a bright rim swells from the centre
  // while the rim turns, the screen is swapped while it covers everything, then it closes. Lives
  // on <body> so emptying the title screen cannot take it down.
  function wipe(then) {
    const iris = el('div', 'title-wipe');
    const rim = el('div', 'title-wipe-rim');
    for (let i = 0; i < 24; i++) {
      const sp = el('span', 'wipe-spark');
      sp.style.setProperty('--a', (i * 15) + 'deg');
      sp.style.animationDelay = (i % 4) * 40 + 'ms';
      rim.appendChild(sp);
    }
    document.body.appendChild(iris);
    document.body.appendChild(rim);
    void iris.offsetWidth;
    iris.classList.add('run'); rim.classList.add('run');
    setTimeout(then, WIPE_MS * 0.45);
    setTimeout(function () { iris.remove(); rim.remove(); }, WIPE_MS + 60);
  }
  SV.title.wipe = wipe;

  function toPicker() {
    if (phase !== 'splash') return;
    phase = 'picker';
    clearTimeout(holdTimer);
    SV.sound.menu();
    wipe(function () {
      const sc = screen();
      sc.classList.remove('is-splash');
      sc.classList.add('is-picker');
      setBg('deck-chooser');
      rebuild();
    });
  }

  function begin() {
    SV.sound.prewarm();
    let decks;
    if (mode === 'tutorial') decks = tutorialDecks();
    else decks = [engineDeck(chosen.a), engineDeck(chosen.b)];
    if (!decks) return;
    const m = mode;
    // Secret picks are spent: the next picker re-rolls rather than repeating them.
    if (secret.a) chosen.a = null;
    if (secret.b) chosen.b = null;
    clearPeek();
    wipe(function () {
      const sc = screen();
      sc.className = '';
      sc.textContent = '';
      phase = 'idle';
      SV.ui.start({ mode: m, decks: decks, level: level });
    });
  }

  SV.title.init = function () {
    const sc = screen();
    phase = 'splash';
    sc.className = 'open is-splash';
    setBg('title');
    fill([splash()]);
    holdTimer = setTimeout(toPicker, HOLD_MS);
    sc.addEventListener('click', function () { if (phase === 'splash') toPicker(); });
    document.addEventListener('keydown', function (e) { if (phase === 'splash') { e.preventDefault(); toPicker(); } });
  };
  SV.title.openPicker = function () {
    const sc = screen();
    phase = 'picker';
    SV.anim.skip();
    SV.sound.menu();
    sc.className = 'open';
    wipe(function () { sc.classList.add('is-picker'); setBg('deck-chooser'); rebuild(); });
  };
  SV.title.engineDeck = engineDeck;
  SV.title.deckById = deckById;
  SV.title.status = status;
})();
