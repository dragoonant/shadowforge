// js/ui/title.js — the entry point (PRESENTATION-REFERENCE A1): title splash -> wipe -> picker
// (two pre-picked deck slots with dice, mode, opponent skill, Start) -> deck chooser with hover
// peek -> match. The Start click is the first real gesture, so it also unlocks audio. Nothing
// here touches game state; SV.ui.start begins a match.
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;
  const el = U.el, $ = U.$;

  const HOLD_MS = 3000, WIPE_MS = 900, PEEK_MS = 600;
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
      head.appendChild(el('div', 'peek-meta', U.classOf(d.cls).name + ' · leader ' + (SV.CARDS[d.leader] ? SV.CARDS[d.leader].name : '?') + ' · ' + deckCount(d)));
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

  // ---- screens ---------------------------------------------------------------------------------
  function screen() { return $('title-screen'); }
  function setBg(name) {
    const url = SV.uiArtUrl(name) || SV.uiArtUrl('title');
    screen().style.backgroundImage = url ? 'url("' + url + '")' : '';
  }

  function splash() {
    const wrap = el('div', 'title-splash');
    wrap.appendChild(el('div', 'title-once', 'The arena awaits'));
    wrap.appendChild(el('h1', 'title-name', 'Shadowforge'));
    wrap.appendChild(el('div', 'title-flourish'));
    wrap.appendChild(el('div', 'title-tagline', 'followers, spells and evolution — bring the enemy leader from 20 defense to 0'));
    wrap.appendChild(el('div', 'title-hint', 'Click to continue'));
    return wrap;
  }
  function disclaimer() { return el('div', 'title-disclaimer', DISCLAIMER); }

  const SLOT_LABEL = {
    ai: ['Your deck', 'Opponent’s deck'], tutorial: ['Your deck', 'Opponent’s deck'],
    hotseat: ['Player 1’s deck', 'Player 2’s deck'], spectate: ['Bot A’s deck', 'Bot B’s deck'],
  };

  function deckSlot(side, label) {
    const row = el('div', 'title-field');
    row.appendChild(el('span', 'title-field-label', label));
    const line = el('div', 'title-deck-line');
    const btn = el('button', 'title-deck-btn');
    const d = deckById(chosen[side]);
    if (!d) btn.appendChild(el('span', null, 'No deck is ready yet'));
    else if (secret[side]) { btn.appendChild(el('span', null, '? A random deck')); btn.classList.add('is-hidden-deck'); }
    else {
      btn.appendChild(clsDot(d.cls));
      btn.appendChild(el('span', null, ' ' + d.name));
    }
    attachPeek(btn, function () { return secret[side] ? null : chosen[side]; });
    btn.onclick = function () { openChooser(side, function (k) { chosen[side] = k; secret[side] = false; }); };
    line.appendChild(btn);
    const dice = el('button', 'title-deck-dice', '⚄');
    dice.setAttribute('data-tip', 'Roll a random ready deck (kept secret until the game starts)');
    dice.setAttribute('aria-label', 'Roll a random deck');
    dice.onclick = function () { clearPeek(); chosen[side] = randomDeck(chosen[side === 'a' ? 'b' : 'a']); secret[side] = true; rebuild(); };
    line.appendChild(dice);
    row.appendChild(line);
    return row;
  }

  function select(label, value, options, onChange) {
    const row = el('label', 'title-field');
    row.appendChild(el('span', 'title-field-label', label));
    const s = el('select', 'title-select');
    options.forEach(function (o) {
      const op = document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      if (o[0] === value) op.selected = true;
      s.appendChild(op);
    });
    s.onchange = function () { onChange(s.value); };
    row.appendChild(s);
    return row;
  }

  function tutorialDecks() {
    const keys = readyKeys().filter(function (k) { return k.indexOf('custom:') < 0; });
    if (!keys.length) return null;
    const a = keys[0];
    const b = keys.find(function (k) { return deckById(k).cls !== deckById(a).cls; }) || keys[keys.length > 1 ? 1 : 0];
    return [a, b];
  }

  function picker() {
    if (!deckById(chosen.a)) { chosen.a = randomDeck(null); secret.a = true; }
    if (!deckById(chosen.b)) { chosen.b = randomDeck(chosen.a); secret.b = true; }
    const box = el('div', 'title-picker');
    box.appendChild(el('h1', 'title-name title-name-small', 'Shadowforge'));
    box.appendChild(select('Mode', mode, [['ai', 'Play vs the computer'], ['hotseat', 'Two players, one device (hot-seat)'],
      ['spectate', 'Watch the computer play itself'], ['tutorial', 'Tutorial (guided game vs an easy computer)']], function (v) {
      mode = v; U.store.set('mode', v); rebuild();
    }));
    const ready = readyKeys();
    if (mode !== 'tutorial') {
      box.appendChild(deckSlot('a', SLOT_LABEL[mode][0]));
      box.appendChild(deckSlot('b', SLOT_LABEL[mode][1]));
    } else {
      box.appendChild(el('div', 'title-note', 'The tutorial uses two fixed decks and an Easy opponent. Coach bubbles explain each idea the first time it comes up; you can skip them at any time.'));
    }
    if (mode === 'ai' || mode === 'spectate') {
      box.appendChild(select(mode === 'spectate' ? 'Bot skill' : 'Opponent skill', level,
        [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], function (v) { level = v; U.store.set('level', v); }));
    }
    if (!ready.length) {
      box.appendChild(el('div', 'title-note is-warn', 'No deck is ready yet: the card scripts for every deck are still being written. Open the deck chooser to see what each deck is waiting for.'));
    }
    if (U.flags.lenient) box.appendChild(el('div', 'title-note is-warn', 'Lenient mode (?lenient=1, dev only): unscripted cards do nothing when played.'));
    const start = el('button', 'title-start action-btn', mode === 'tutorial' ? 'Start the tutorial' : 'Start');
    const canStart = mode === 'tutorial' ? !!tutorialDecks() : (deckById(chosen.a) && deckById(chosen.b));
    start.disabled = !canStart;
    start.onclick = function () { begin(); };
    box.appendChild(start);
    const row = el('div', 'title-row');
    const db = el('button', 'title-select-btn', 'Deck builder');
    db.onclick = function () { SV.deckBuilder.open(); };
    const help = el('button', 'title-select-btn', 'How to play');
    help.onclick = function () { SV.hud.openHelp(); };
    row.appendChild(db); row.appendChild(help);
    box.appendChild(row);
    return box;
  }
  function rebuild() {
    const sc = screen();
    sc.textContent = '';
    sc.appendChild(picker());
    sc.appendChild(disclaimer());
  }
  SV.title = SV.title || {};
  SV.title.rebuild = rebuild;

  function openChooser(side, done) {
    const sc = screen();
    const box = el('div', 'title-picker deck-chooser');
    box.appendChild(el('h1', 'title-name title-name-small', 'Choose ' + SLOT_LABEL[mode][side === 'a' ? 0 : 1].toLowerCase()));
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
        const top = el('span', 'deck-choice-name');
        top.appendChild(clsDot(d.cls));
        top.appendChild(document.createTextNode(' ' + d.name));
        b.appendChild(top);
        b.appendChild(el('span', 'deck-choice-meta', U.classOf(d.cls).name + ' · leader ' + (SV.CARDS[d.leader] ? SV.CARDS[d.leader].name : '?') + ' · ' + deckCount(d)));
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
    rnd.onclick = function () { clearPeek(); chosen[side] = randomDeck(null); secret[side] = true; rebuild(); };
    const back = el('button', 'title-select-btn', 'Back');
    back.onclick = function () { closeIt(null); };
    row.appendChild(rnd); row.appendChild(back);
    box.appendChild(row);
    sc.textContent = '';
    sc.appendChild(box);
  }

  // The scene change: a forge iris. A dark disc with a molten rim closes over the screen from
  // the centre, the screen is swapped while it covers everything, then it opens again. Lives on
  // <body> so emptying the title screen cannot take it down.
  function wipe(then) {
    const iris = el('div', 'title-wipe');
    const rim = el('div', 'title-wipe-rim');
    for (let i = 0; i < 16; i++) {
      const sp = el('span', 'wipe-spark');
      sp.style.setProperty('--a', (i * 22.5) + 'deg');
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
    sc.textContent = '';
    sc.appendChild(splash());
    sc.appendChild(disclaimer());
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
