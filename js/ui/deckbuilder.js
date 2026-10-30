// js/ui/deckbuilder.js — browse the card pool and build decks (PLAN §5.1, D7). Legality is the
// engine's: SV.deckProblems (one leader; main deck 40–50; evolve deck at most 10; at most 3 of
// a name unless the card says otherwise; leader's class plus Neutral). Saved in localStorage
// (wrapped; a blocked store loses the convenience, never the game) and listed in the chooser
// under "Your decks".
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;
  const el = U.el, $ = U.$;

  let deck = null;          // {id, name, leader, main: {no: qty}, evolve: {no: qty}}
  const filt = { cls: 'deck', type: 'all', cost: 'all', q: '' };

  function leaders() {
    return Object.keys(SV.CARDS).map(function (k) { return SV.CARDS[k]; })
      .filter(function (d) { return d.type === 'leader'; })
      .sort(function (a, b) { return a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name); });
  }
  function blank() {
    const L = leaders()[0];
    return { id: 'd' + Date.now().toString(36), name: 'My deck', leader: L ? L.no : null, main: {}, evolve: {} };
  }
  function isEvoCard(d) { return !!(d.evolved || d.advanced); }
  function asList(map) { return Object.keys(map).filter(function (k) { return map[k] > 0; }).map(function (k) { return [k, map[k]]; }); }
  function total(map) { return asList(map).reduce(function (n, c) { return n + c[1]; }, 0); }
  function engineShape(d) { return { name: d.name, leader: d.leader, main: asList(d.main), evolve: asList(d.evolve) }; }
  function capOf(def) { const m = (def.text || '').match(/put up to (\d+) of this card into your evolve deck/i); return m ? +m[1] : 3; }
  function copiesOfName(map, name) { return asList(map).reduce(function (n, c) { return SV.CARDS[c[0]].name === name ? n + c[1] : n; }, 0); }

  function add(no, n) {
    const d = SV.CARDS[no];
    const map = isEvoCard(d) ? deck.evolve : deck.main;
    const cur = map[no] || 0;
    if (n > 0) {
      if (copiesOfName(map, d.name) >= capOf(d)) { say('At most ' + capOf(d) + ' copies of ' + d.name + '.'); return; }
      if (isEvoCard(d) && total(deck.evolve) >= 10) { say('The evolve deck holds at most 10 cards.'); return; }
      if (!isEvoCard(d) && total(deck.main) >= 50) { say('The main deck holds at most 50 cards.'); return; }
    }
    map[no] = Math.max(0, cur + n);
    if (!map[no]) delete map[no];
    draw();
  }
  function say(t) { const n = $('db-msg'); if (n) { n.textContent = t; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); } }

  function leaderCls() { const L = SV.CARDS[deck.leader]; return L ? L.cls : null; }
  function pool() {
    const q = filt.q.trim().toLowerCase();
    const L = SV.CARDS[deck.leader];
    return Object.keys(SV.CARDS).map(function (k) { return SV.CARDS[k]; }).filter(function (d) {
      if (d.token || d.type === 'leader' || SV.DEFECTS[d.no]) return false;
      if (SV.CARD_ALIAS && SV.CARD_ALIAS[d.no]) return false;           // reprints: the canonical id only
      if (filt.cls === 'deck' && L && d.cls !== 'neutral' && d.cls !== L.cls && !(d.universe && d.universe === L.universe)) return false;
      if (filt.cls !== 'deck' && filt.cls !== 'all' && d.cls !== filt.cls) return false;
      const t = SV.parsed(d).type;
      if (filt.type === 'evolve' ? !isEvoCard(d) : (filt.type !== 'all' && (t !== filt.type || isEvoCard(d)))) return false;
      if (filt.cost !== 'all') { const c = Number(filt.cost); const dc = d.cost == null ? -1 : d.cost; if (c === 7 ? dc < 7 : dc !== c) return false; }
      if (q && (d.name + ' ' + d.text + ' ' + d.traits.join(' ')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return (isEvoCard(a) - isEvoCard(b)) || (a.cost || 0) - (b.cost || 0) || a.name.localeCompare(b.name); });
  }

  function filters() {
    const bar = el('div', 'db-filters');
    const cls = el('select', 'title-select db-type');
    [['deck', 'Leader’s class + Neutral'], ['all', 'Every class']].concat(SV.CLASSES.map(function (c) { return [c, U.classOf(c).name]; })).forEach(function (o) {
      const op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (filt.cls === o[0]) op.selected = true; cls.appendChild(op);
    });
    cls.onchange = function () { filt.cls = cls.value; draw(); };
    bar.appendChild(cls);
    const type = el('select', 'title-select db-type');
    [['all', 'All types'], ['follower', 'Followers'], ['spell', 'Spells'], ['amulet', 'Amulets'], ['evolve', 'Evolved / advanced']].forEach(function (o) {
      const op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (filt.type === o[0]) op.selected = true; type.appendChild(op);
    });
    type.onchange = function () { filt.type = type.value; draw(); };
    bar.appendChild(type);
    const costs = el('div', 'db-costs');
    ['all', 0, 1, 2, 3, 4, 5, 6, 7].forEach(function (c) {
      const b = el('button', 'db-cost' + (String(filt.cost) === String(c) ? ' is-on' : ''), c === 'all' ? 'Any' : (c === 7 ? '7+' : String(c)));
      b.onclick = function () { filt.cost = String(c); draw(); };
      costs.appendChild(b);
    });
    bar.appendChild(costs);
    const search = el('input', 'db-search');
    search.type = 'search'; search.placeholder = 'Search name, text, trait…'; search.value = filt.q;
    search.oninput = function () { filt.q = search.value; drawGrid(); };
    bar.appendChild(search);
    return bar;
  }

  function drawGrid() {
    const grid = $('db-grid');
    if (!grid) return;
    grid.textContent = '';
    const list = pool();
    list.forEach(function (d) {
      const cell = el('div', 'db-cell');
      const face = SV.renderCard(d.no, { size: 'hand' });
      face.onclick = function () { add(d.no, 1); };
      face.oncontextmenu = function (e) { e.preventDefault(); add(d.no, -1); };
      cell.appendChild(face);
      const n = (isEvoCard(d) ? deck.evolve : deck.main)[d.no] || 0;
      const ctl = el('div', 'db-cell-ctl');
      const minus = el('button', null, '−'); minus.disabled = !n; minus.onclick = function () { add(d.no, -1); };
      const plus = el('button', null, '+'); plus.onclick = function () { add(d.no, 1); };
      ctl.appendChild(minus); ctl.appendChild(el('span', 'db-qty' + (n ? ' is-in' : ''), String(n))); ctl.appendChild(plus);
      if (SV.needsScript(d.no) && !SV.ABIL[d.no]) ctl.appendChild(el('span', 'db-unscripted', 'not scripted yet'));
      cell.appendChild(ctl);
      grid.appendChild(cell);
    });
    $('db-count').textContent = list.length + ' cards';
  }

  function curve(list) {
    const bins = [0, 0, 0, 0, 0, 0, 0, 0];
    list.forEach(function (c) { bins[Math.min(7, SV.CARDS[c[0]].cost || 0)] += c[1]; });
    const max = Math.max(1, Math.max.apply(null, bins));
    const wrap = el('div', 'db-curve');
    bins.forEach(function (n, i) {
      const col = el('div', 'db-bar-col');
      const bar = el('div', 'db-bar'); bar.style.height = (n / max * 100) + '%';
      bar.setAttribute('data-tip', n + ' card' + (n === 1 ? '' : 's') + ' costing ' + (i === 7 ? '7+' : i));
      col.appendChild(el('div', 'db-bar-n', n ? String(n) : ''));
      col.appendChild(bar);
      col.appendChild(el('div', 'db-bar-x', i === 7 ? '7+' : String(i)));
      wrap.appendChild(col);
    });
    return wrap;
  }

  function listRows(map, rows) {
    asList(map).sort(function (a, b) { const A = SV.CARDS[a[0]], B = SV.CARDS[b[0]]; return (A.cost || 0) - (B.cost || 0) || A.name.localeCompare(B.name); })
      .forEach(function (c) {
        const d = SV.CARDS[c[0]];
        const r = el('div', 'db-row');
        r.appendChild(d.cost != null ? U.costGem(d.cost, d.cls) : U.glyph('evolve'));
        const n = el('span', 'db-row-name card-ref', d.name);
        n.dataset.cardId = d.no;
        r.appendChild(n);
        const minus = el('button', null, '−'); minus.onclick = function () { add(d.no, -1); };
        const plus = el('button', null, '+'); plus.onclick = function () { add(d.no, 1); };
        r.appendChild(minus); r.appendChild(el('span', 'db-qty is-in', String(c[1]))); r.appendChild(plus);
        rows.appendChild(r);
      });
  }

  function side() {
    const panel = el('div', 'db-side');
    const name = el('input', 'db-name');
    name.value = deck.name; name.maxLength = 40;
    name.oninput = function () { deck.name = name.value || 'My deck'; };
    panel.appendChild(name);
    const lead = el('select', 'title-select');
    leaders().forEach(function (L) {
      const op = document.createElement('option'); op.value = L.no; op.textContent = 'Leader: ' + L.name + ' (' + U.classOf(L.cls).name + ')';
      if (L.no === deck.leader) op.selected = true;
      lead.appendChild(op);
    });
    lead.onchange = function () { deck.leader = lead.value; draw(); };
    panel.appendChild(lead);
    const shape = engineShape(deck);
    const probs = SV.deckProblems(shape);
    const ok = !probs.length;
    const nm = total(deck.main), ne = total(deck.evolve);
    const head = el('div', 'db-total' + (ok ? ' is-ok' : ''));
    head.textContent = nm + ' main (40–50) · ' + ne + ' evolve (≤10)';
    panel.appendChild(head);
    if (leaderCls()) {
      const c = el('div', 'db-inks');
      c.appendChild(U.glyph(leaderCls()));
      c.appendChild(document.createTextNode(' ' + U.classOf(leaderCls()).name + ' + Neutral'));
      panel.appendChild(c);
    }
    panel.appendChild(curve(asList(deck.main)));
    const miss = SV.scriptCoverage(shape).missing;
    panel.appendChild(el('div', 'db-valid' + (ok ? ' is-ok' : ''), ok ? 'Legal deck.' + (miss.length ? ' ' + miss.length + ' of its cards are not scripted yet, so it can’t be played until they are.' : ' Ready to play.') : 'Not legal yet: ' + probs.join(' ')));
    const rows = el('div', 'db-list');
    rows.appendChild(el('div', 'db-list-head', 'Main deck'));
    listRows(deck.main, rows);
    rows.appendChild(el('div', 'db-list-head', 'Evolve deck'));
    listRows(deck.evolve, rows);
    if (!nm && !ne) rows.appendChild(el('div', 'title-note', 'Click a card on the left to add it (right-click removes). Evolved cards go to the evolve deck by themselves.'));
    panel.appendChild(rows);
    panel.appendChild(el('div', 'db-msg', '')).id = 'db-msg';
    const btns = el('div', 'db-buttons');
    const save = el('button', 'action-btn', 'Save deck');
    save.onclick = function () {
      const all = SV.savedDecks().filter(function (x) { return x.id !== deck.id; });
      all.push({ id: deck.id, name: deck.name, leader: deck.leader, main: asList(deck.main), evolve: asList(deck.evolve) });
      U.store.set('decks', all);
      say(ok ? 'Saved. It is in the deck chooser under "Your decks".' : 'Saved (not legal yet, so it can’t be picked until it is).');
    };
    const load = el('select', 'title-select');
    const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Open…'; load.appendChild(o0);
    SV.savedDecks().forEach(function (d) { const o = document.createElement('option'); o.value = 'c:' + d.id; o.textContent = d.name; load.appendChild(o); });
    SV.DECKS.forEach(function (d) { const o = document.createElement('option'); o.value = 'n:' + d.id; o.textContent = 'Copy of ' + d.name; load.appendChild(o); });
    load.onchange = function () {
      const v = load.value;
      if (!v) return;
      let src;
      if (v.indexOf('c:') === 0) { src = SV.savedDecks().find(function (d) { return d.id === v.slice(2); }); deck = { id: src.id, name: src.name, leader: src.leader, main: {}, evolve: {} }; }
      else { src = SV.DECKS.find(function (d) { return d.id === v.slice(2); }); deck = blank(); deck.name = src.name + ' (copy)'; deck.leader = src.leader; }
      src.main.forEach(function (c) { deck.main[c[0]] = (deck.main[c[0]] || 0) + c[1]; });
      (src.evolve || []).forEach(function (c) { deck.evolve[c[0]] = (deck.evolve[c[0]] || 0) + c[1]; });
      draw();
    };
    const fresh = el('button', null, 'New');
    fresh.onclick = function () { deck = blank(); draw(); };
    const del = el('button', null, 'Delete');
    del.onclick = function () {
      U.store.set('decks', SV.savedDecks().filter(function (x) { return x.id !== deck.id; }));
      deck = blank(); draw(); say('Deleted.');
    };
    const back = el('button', null, 'Back');
    back.onclick = function () { SV.title.rebuild(); };
    [save, load, fresh, del, back].forEach(function (b) { btns.appendChild(b); });
    panel.appendChild(btns);
    return panel;
  }

  function draw() {
    const sc = $('title-screen');
    const keepSearchFocus = document.activeElement && document.activeElement.classList.contains('db-search');
    sc.textContent = '';
    const box = el('div', 'title-picker deck-builder');
    const left = el('div', 'db-left');
    const top = el('div', 'db-top');
    top.appendChild(el('h1', 'title-name title-name-small', 'Deck builder'));
    top.appendChild(el('span', 'db-count', '')).id = 'db-count';
    left.appendChild(top);
    left.appendChild(filters());
    const grid = el('div', 'db-grid'); grid.id = 'db-grid';
    left.appendChild(grid);
    box.appendChild(left);
    box.appendChild(side());
    sc.appendChild(box);
    drawGrid();
    if (keepSearchFocus) { const s = sc.querySelector('.db-search'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
  }

  SV.deckBuilder = {
    open: function () { if (!deck) deck = blank(); draw(); },
  };
})();
