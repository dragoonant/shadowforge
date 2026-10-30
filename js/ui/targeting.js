// js/ui/targeting.js — how the game ASKS (PRESENTATION-REFERENCE A6). The question lives on
// the state (`s.ask`, docs/ENGINE-API.md "Ask"); this file decides how to show it and builds
// the answer value — it never answers by itself. No auto-pick, ever: one candidate or fifty,
// the player is asked (CLAUDE.md rule 4).
//
// Three interfaces, chosen in code from what the player can SEE:
//   candidates are cards the board draws face up -> highlight in place, click the real card
//   candidates the board does not draw            -> centred panel of real faces (all of
//                                                    `seen`, non-candidates dimmed)
//   not cards (yes/no, modes, number, bag)        -> buttons that say what they do
// Every prompt names and shows its source card (`ask.src`).
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;
  const el = U.el, $ = U.$;

  // ---- view-layer state (never game state) --------------------------------------------------
  let picks = [];          // iids (or option indices for 'modes') picked for the open ask
  let picksKey = null;     // the ask those picks belong to
  let peekedKey = null;    // the ask currently hidden by Peek

  function askKey(ask) {
    return [ask.kind, ask.who, ask.src, ask.prompt, (ask.from || []).join(','), ask.min, ask.max,
      (ask.options || []).map(function (o) { return o.id != null ? o.id : o.label; }).join('|')].join('#');
  }
  function syncPicks(ask) {
    const k = askKey(ask);
    if (k !== picksKey) { picksKey = k; picks = []; }
    return k;
  }
  function srcName(s, ask) {
    if (ask.src == null || !s.cards[ask.src]) return null;
    return SV.def(ask.src, s).name;
  }
  // Name the source card in front of the prompt unless the prompt already starts with it.
  function withSrc(src, prompt) {
    if (!src) return prompt;
    // Prompts often start with the card's short name ("Saito: ..."): don't say it twice.
    const short = src.split(/[,—-]/)[0].trim().split(' ')[0];
    if (prompt.indexOf(src) >= 0 || prompt.indexOf(short) === 0) return prompt;
    return src + ': ' + prompt;
  }
  function nameOf(s, iid) { const c = s.cards[iid]; return c ? SV.def(iid, s).name : '?'; }
  const ON_BOARD = { field: 1, leader: 1, ex: 1 };

  // Is every card this ask is about already drawn on the board, face up?
  function onBoard(s, ask) {
    const seen = (ask.seen && ask.seen.length) ? ask.seen : (ask.from || []);
    if (!seen.length) return false;
    return seen.every(function (iid) { const c = s.cards[iid]; return c && ON_BOARD[c.zone]; });
  }

  SV.asks = {
    // How this ask is shown: 'board' | 'panel' | 'buttons' | null (no ask)
    mode: function (s) {
      const a = s.ask;
      if (!a) return null;
      if (a.kind === 'yesno' || a.kind === 'mode' || a.kind === 'modes' || a.kind === 'number' || a.kind === 'bag') return 'buttons';
      if (a.kind === 'mulligan' || a.kind === 'order') return 'panel';
      return onBoard(s, a) ? 'board' : 'panel';
    },
    picks: function () { return picks.slice(); },
    isCandidate: function (s, iid) {
      return !!(s.ask && (s.ask.kind === 'cards' || s.ask.kind === 'order') && (s.ask.from || []).indexOf(iid) >= 0);
    },
    isSeen: function (s, iid) { return !!(s.ask && s.ask.seen && s.ask.seen.indexOf(iid) >= 0); },
    isPicked: function (iid) { return picks.indexOf(iid) >= 0; },
    // A click on a candidate (board or panel). A single pick with min 1 answers on the click
    // itself — the click IS the player's choice, nothing was assumed.
    toggle: function (s, iid, answer) {
      const a = s.ask;
      syncPicks(a);
      if (!SV.asks.isCandidate(s, iid)) return;
      const at = picks.indexOf(iid);
      if (at >= 0) { picks.splice(at, 1); SV.ui.render(); return; }
      if (a.kind === 'cards' && a.max === 1 && a.min === 1) { picks = []; peekedKey = null; answer([iid]); return; }
      const cap = a.kind === 'order' ? a.from.length : a.max;
      if (picks.length >= cap) {
        if (cap === 1) picks = [iid];      // swap the single pick rather than refuse
        else { flash('Already ' + cap + ' selected — click one to unselect it.'); return; }
      } else picks.push(iid);
      SV.ui.render();
    },
    // The prompt line: the card says WHAT (the engine's prompt), the UI appends HOW.
    promptLine: function (s, viewer, acting, names) {
      if (SV.isTerminal(s)) return { text: 'Game over.', cls: 'over' };
      const a = s.ask;
      if (acting !== viewer) {
        if (a) return { text: 'Waiting for ' + names[acting] + ' to choose…', cls: 'waiting' };
        if (s.window) return { text: 'Waiting for ' + names[acting] + ' to respond…', cls: 'waiting' };
        return { text: 'Waiting for ' + names[acting] + '…', cls: 'waiting' };
      }
      if (a) {
        let text = withSrc(srcName(s, a), a.prompt);
        const m = SV.asks.mode(s);
        if (m === 'board') text += a.max > 1 ? ' Click highlighted cards, then Confirm.' : ' Click a highlighted card.';
        else if (m === 'panel' && a.kind === 'order') text += ' Click the cards in order, first = topmost.';
        else if (m === 'panel' && a.kind === 'cards') text += a.max > 1 ? ' Pick from the cards shown, then Confirm.' : ' Pick one of the cards shown.';
        return { text: text, cls: 'asking' };
      }
      if (s.window) return { text: SV.ui.windowText(s) + ' Play a Quick card or ability, or choose No response.', cls: 'asking' };
      return { text: 'Drag a hand or EX card onto your field to play it, drag a follower onto an enemy to attack, drag your evolve deck onto a follower to evolve — or tap any card for its options.', cls: '' };
    },
    reset: function () { picks = []; picksKey = null; peekedKey = null; },
  };

  function flash(text) {
    const n = $('choice-flash');
    if (!n) return;
    n.textContent = text;
    n.classList.remove('show'); void n.offsetWidth; n.classList.add('show');
  }

  // ---- the panel and its peek ---------------------------------------------------------------
  // Anchored over the two fields, no scrim and no blur: the board must stay readable around a
  // question about it. Leaders, piles, trackers and the hand stay visible.
  function playBox() {
    const a = $('my-field'), b = $('enemy-field');
    if (!a || !b) return null;
    const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
    const left = Math.min(r1.left, r2.left), right = Math.max(r1.right, r2.right);
    const top = Math.min(r1.top, r2.top), bottom = Math.max(r1.bottom, r2.bottom);
    if (right <= left || bottom <= top) return null;
    return { left: left, right: right, top: top, bottom: bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 };
  }
  SV.asks.playBox = playBox;
  function position(modal) {
    const content = modal.querySelector('.choice-modal-content');
    if (!content) return;
    const box = playBox();
    content.style.left = box ? box.cx + 'px' : '';
    const h = content.offsetHeight, H = window.innerHeight;
    let cy = box ? box.cy : H / 2;
    cy = Math.max(h / 2 + 6, Math.min(cy, H - h / 2 - 6));
    if (h >= H - 12) cy = H / 2;
    content.style.top = cy + 'px';
  }
  window.addEventListener('resize', function () {
    const m = $('choice-modal');
    if (m && m.classList.contains('open')) position(m);
    const p = $('play-prompt');
    if (p && p.classList.contains('open')) { const b = playBox(); if (b) { p.style.left = b.cx + 'px'; p.style.top = b.cy + 'px'; } }
  });

  function setPeek(on) {
    const modal = $('choice-modal');
    if (!modal) return;
    modal.classList.toggle('peek', on);
    peekedKey = on ? modal.dataset.choiceKey : null;
    const echo = $('play-prompt');
    if (echo && echo.textContent) {
      const box = on ? playBox() : null;
      if (box) { echo.style.left = box.cx + 'px'; echo.style.top = box.cy + 'px'; }
      echo.classList.toggle('open', on && !!box);
    }
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const modal = $('choice-modal');
    if (!modal || !modal.classList.contains('open')) return;
    if (SV.zoneBrowser.isOpen()) return;          // Esc closes the browser first
    e.preventDefault();
    setPeek(!modal.classList.contains('peek'));
  });

  // The centre echo: the question, said where the player is already looking.
  SV.asks.renderEcho = function (text, show) {
    let node = $('play-prompt');
    if (!node) { node = el('div'); node.id = 'play-prompt'; document.body.appendChild(node); }
    if (text != null && node.textContent !== text) node.textContent = text;
    const box = show ? playBox() : null;
    if (!show || !box) { node.classList.remove('open'); return; }
    node.style.left = box.cx + 'px';
    node.style.top = box.cy + 'px';
    node.style.maxWidth = Math.max(180, (box.right - box.left) * 0.7) + 'px';
    node.classList.add('open');
  };

  function closeModal() {
    const modal = $('choice-modal');
    if (!modal) return;
    modal.classList.remove('open', 'peek');
    modal.dataset.choiceKey = '';
    modal.textContent = '';
  }
  SV.asks.closeModal = closeModal;

  function openModal(key, nodes, restoreLabel) {
    const modal = $('choice-modal');
    modal.textContent = '';
    modal.dataset.choiceKey = key;
    const content = el('div', 'choice-modal-content');
    nodes.forEach(function (n) { content.appendChild(n); });
    const hide = el('button', 'peek-btn', 'Hide — check the board');
    hide.onclick = function () { setPeek(true); };
    const ctl = el('div', 'choice-modal-controls choice-peek-row');
    ctl.appendChild(hide);
    content.appendChild(ctl);
    modal.appendChild(content);
    const restore = el('button', 'choice-peek-restore', restoreLabel || 'Show the choices');
    restore.onclick = function () { setPeek(false); };
    modal.appendChild(restore);
    modal.classList.add('open');
    position(modal);
    setPeek(peekedKey === key);
  }

  function faceFor(s, iid, size) {
    const c = s.cards[iid];
    const live = c.zone === 'field' || c.zone === 'ex' || c.zone === 'leader' || c.zone === 'hand';
    return SV.renderCard(live ? iid : (c.evo ? s.cards[c.evo].id : c.id), { size: size, state: live ? s : null });
  }
  function sourceFace(s, ask) {
    if (ask.src == null || !s.cards[ask.src]) return null;
    const wrap = el('div', 'choice-source');
    wrap.appendChild(el('div', 'choice-source-label', 'Asked by'));
    const face = faceFor(s, ask.src, 'board');
    face.classList.add('choice-source-card');
    wrap.appendChild(face);
    return wrap;
  }

  // Count line: "2 of 0–3 selected" — the numbers the player needs, nothing else.
  function countText(s, a) {
    if (a.kind === 'order') return picks.length + ' of ' + a.from.length + ' placed';
    const range = a.min === a.max ? String(a.max) : a.min + '–' + a.max;
    let t = picks.length + ' of ' + range + ' selected';
    if (a.sumCostMax != null) t += ' · total cost ' + sumCost(s) + ' of at most ' + a.sumCostMax;
    if (a.distinctNames) t += ' · different names';
    return t;
  }
  function sumCost(s) { return picks.reduce(function (n, i) { return n + (SV.CARDS[s.cards[i].id].cost || 0); }, 0); }
  function namesClash(s) {
    const names = picks.map(function (i) { return SV.CARDS[s.cards[i].id].name; });
    return new Set(names).size !== names.length;
  }

  // Confirm / Clear / Choose none controls for a multi-pick (and a single pick with min 0).
  function pickControls(s, a, answer, inBar) {
    const row = el('div', inBar ? 'choice-bar-controls' : 'choice-modal-controls');
    const order = a.kind === 'order';
    if (a.max > 1 || order) row.appendChild(el('span', 'choice-count', countText(s, a)));
    if (a.max > 1 || order || (a.max === 1 && a.min === 0 && picks.length)) {
      const ok = el('button', 'action-btn choice-confirm', order ? 'Confirm this order' : 'Confirm');
      let why = null;
      if (order && picks.length !== a.from.length) why = 'Place every card first.';
      else if (!order && picks.length < a.min) why = 'Choose at least ' + a.min + '.';
      else if (!order && a.sumCostMax != null && sumCost(s) > a.sumCostMax) why = 'Total cost must be ' + a.sumCostMax + ' or less.';
      else if (!order && a.distinctNames && namesClash(s)) why = 'Choose cards with different names.';
      ok.disabled = !!why;
      if (why) ok.setAttribute('data-tip', why);
      ok.onclick = function () { const v = picks.slice(); picks = []; peekedKey = null; answer(v); };
      if (!(a.min === 0 && picks.length === 0 && !order)) row.appendChild(ok);
      if (picks.length) {
        const clr = el('button', null, 'Clear');
        clr.onclick = function () { picks = []; SV.ui.render(); };
        row.appendChild(clr);
      }
    }
    if (!order && a.min === 0 && picks.length === 0) {
      const none = el('button', 'action-btn', 'Choose none');
      none.setAttribute('data-tip', 'Answer with no cards.');
      none.onclick = function () { picks = []; peekedKey = null; answer([]); };
      row.appendChild(none);
    }
    return row;
  }

  // ---- the renderers ------------------------------------------------------------------------
  // Called by js/ui/game.js on every render. Returns true when the modal owns input.
  SV.asks.render = function (s, viewer, acting, answer) {
    const a = s.ask;
    const bar = $('choice-bar');
    if (!a || acting !== viewer || SV.isTerminal(s)) {
      closeModal();
      if (bar && bar.dataset.owner === 'ask') { bar.textContent = ''; bar.classList.remove('open'); bar.dataset.owner = ''; }
      return false;
    }
    const key = syncPicks(a);
    const mode = SV.asks.mode(s);
    const src = srcName(s, a);

    if (mode === 'board') {
      closeModal();
      // Controls ride in the choice bar; the cards are the board's own.
      bar.textContent = '';
      bar.dataset.owner = 'ask';
      if (a.src != null && s.cards[a.src]) {
        const mini = faceFor(s, a.src, 'board');
        mini.classList.add('choice-bar-src');
        bar.appendChild(mini);
      }
      bar.appendChild(el('span', 'choice-bar-prompt', withSrc(src, a.prompt) +
        (a.max > 1 ? ' Click the highlighted cards, then Confirm.' : ' Click a highlighted card.')));
      if (a.max > 1 || a.min === 0) bar.appendChild(pickControls(s, a, answer, true));
      bar.appendChild(el('span', 'choice-flash', '')).id = 'choice-flash';
      bar.classList.add('open');
      return false;
    }
    if (bar && bar.dataset.owner === 'ask') { bar.textContent = ''; bar.classList.remove('open'); bar.dataset.owner = ''; }

    const nodes = [];
    nodes.push(el('div', 'choice-modal-prompt', withSrc(src, a.prompt)));
    if (mode === 'buttons') {
      const body = el('div', 'choice-body');
      const sf = sourceFace(s, a);
      if (sf) body.appendChild(sf);
      const btns = el('div', 'choice-modal-buttons');
      if (a.kind === 'yesno') {
        const y = el('button', 'action-btn', a.yes || 'Yes');
        y.onclick = function () { peekedKey = null; answer(true); };
        const n = el('button', 'action-btn is-secondary', a.no || 'No');
        n.onclick = function () { peekedKey = null; answer(false); };
        btns.appendChild(y); btns.appendChild(n);
      } else if (a.kind === 'mode') {
        (a.options || []).forEach(function (o, i) {
          const b = el('button', 'action-btn', o.label);
          b.disabled = o.enabled === false;
          if (b.disabled) b.setAttribute('data-tip', 'Not possible right now.');
          b.onclick = function () { peekedKey = null; answer(i); };
          btns.appendChild(b);
        });
      } else if (a.kind === 'modes') {
        // "Choose up to N": checkboxes, then Confirm with the indices in printed order.
        const range = a.min === a.max ? String(a.max) : a.min + '–' + a.max;
        btns.appendChild(el('div', 'choice-modal-hint', 'Choose ' + range + ' of these.'));
        (a.options || []).forEach(function (o, i) {
          const lab = el('label', 'mode-option' + (o.enabled === false ? ' is-disabled' : ''));
          const cb = el('input');
          cb.type = 'checkbox';
          cb.checked = picks.indexOf(i) >= 0;
          cb.disabled = o.enabled === false;
          cb.onchange = function () {
            const at = picks.indexOf(i);
            if (cb.checked && at < 0) {
              if (picks.length >= a.max) { cb.checked = false; flash('At most ' + a.max + '.'); return; }
              picks.push(i);
            } else if (!cb.checked && at >= 0) picks.splice(at, 1);
            SV.ui.render();
          };
          lab.appendChild(cb);
          lab.appendChild(el('span', null, o.label));
          if (o.enabled === false) lab.setAttribute('data-tip', 'Not possible right now.');
          btns.appendChild(lab);
        });
        const ok = el('button', 'action-btn choice-confirm', 'Confirm');
        ok.disabled = picks.length < a.min || picks.length > a.max;
        ok.onclick = function () { const v = picks.slice().sort(function (x, y) { return x - y; }); picks = []; peekedKey = null; answer(v); };
        btns.appendChild(ok);
        const fl = el('div', 'choice-flash'); fl.id = 'choice-flash';
        btns.appendChild(fl);
      } else if (a.kind === 'number') {
        const span = a.max - a.min;
        if (span <= 12) {
          const row = el('div', 'number-row');
          for (let n = a.min; n <= a.max; n++) {
            const b = el('button', 'action-btn number-btn', String(n));
            b.onclick = (function (k) { return function () { peekedKey = null; answer(k); }; })(n);
            row.appendChild(b);
          }
          btns.appendChild(row);
        } else {
          const inp = el('input', 'number-input');
          inp.type = 'number'; inp.min = String(a.min); inp.max = String(a.max); inp.value = String(a.min);
          const ok = el('button', 'action-btn', 'Confirm');
          ok.onclick = function () {
            const v = Math.round(Number(inp.value));
            if (!(v >= a.min && v <= a.max)) { flash('Choose a number from ' + a.min + ' to ' + a.max + '.'); return; }
            peekedKey = null; answer(v);
          };
          btns.appendChild(inp); btns.appendChild(ok);
          const fl = el('div', 'choice-flash'); fl.id = 'choice-flash';
          btns.appendChild(fl);
        }
      } else if (a.kind === 'bag') {
        nodes.push(el('div', 'choice-modal-hint', 'The one you pick resolves now; you choose again for the rest.'));
        (a.options || []).forEach(function (o) {
          const row = el('div', 'bag-option');
          if (o.src != null && s.cards[o.src]) {
            const face = faceFor(s, o.src, 'board');
            face.classList.add('bag-face');
            row.appendChild(face);
          }
          const b = el('button', 'action-btn', 'Resolve first: ' + (o.src != null ? nameOf(s, o.src) + ' — ' : '') + (o.name || 'ability'));
          b.onclick = function () { peekedKey = null; answer(o.id); };
          b.addEventListener('mouseenter', function () { SV.ui.hint(o.src); });
          b.addEventListener('mouseleave', function () { SV.ui.hint(null); });
          row.appendChild(b);
          btns.appendChild(row);
        });
      }
      body.appendChild(btns);
      nodes.push(body);
      openModal(key, nodes);
      return true;
    }

    // ---- panel of faces --------------------------------------------------------------------
    if (a.kind === 'mulligan') {
      // CR 6.2.1.8: keep the four, or put all four on the bottom and draw four.
      nodes.push(el('div', 'choice-modal-hint', 'Your opening hand. Keep it, or put all four on the bottom of your deck and draw four new cards (once).'));
      const cards = el('div', 'choice-modal-cards');
      (a.seen || []).forEach(function (iid) {
        if (!s.cards[iid]) return;
        const wrap = el('div', 'choice-option is-static');
        wrap.appendChild(SV.renderCard(iid, { size: 'hand', state: s }));
        cards.appendChild(wrap);
      });
      nodes.push(cards);
      const row = el('div', 'choice-modal-controls');
      const keep = el('button', 'action-btn', a.no || 'Keep');
      keep.onclick = function () { peekedKey = null; answer(false); };
      const redraw = el('button', 'action-btn is-secondary', a.yes || 'Redraw');
      redraw.onclick = function () { peekedKey = null; answer(true); };
      row.appendChild(keep); row.appendChild(redraw);
      nodes.push(row);
      openModal(key, nodes, 'Show the hand');
      return true;
    }
    const sf = sourceFace(s, a);
    const seen = (a.seen && a.seen.length) ? a.seen.slice() : (a.from || []).slice();
    (a.from || []).forEach(function (i) { if (seen.indexOf(i) < 0) seen.push(i); });
    if (seen.length > (a.from || []).length) {
      nodes.push(el('div', 'choice-modal-hint', 'You are looking at ' + seen.length + ' cards. Dimmed ones can’t be chosen.'));
    }
    const body = el('div', 'choice-body');
    if (sf) body.appendChild(sf);
    const cards = el('div', 'choice-modal-cards');
    seen.forEach(function (iid) {
      const c = s.cards[iid];
      if (!c) return;
      const ok = (a.from || []).indexOf(iid) >= 0;
      const wrap = el('div', 'choice-option' + (ok ? '' : ' is-dim'));
      const face = faceFor(s, iid, 'hand');
      face.dataset.iid = iid;
      if (ok) face.classList.add('role-target');
      const at = picks.indexOf(iid);
      if (at >= 0) {
        face.classList.add('role-picked');
        wrap.appendChild(el('div', 'pick-ordinal', a.kind === 'order' ? String(at + 1) : '✓'));
      }
      wrap.appendChild(face);
      const zoneName = { hand: 'hand', deck: 'deck', ex: 'EX area', field: 'field', cemetery: 'cemetery', banished: 'banished', evoDeck: 'evolve deck', leader: 'leader' }[c.zone] || c.zone;
      wrap.appendChild(el('div', 'choice-zone', (c.owner === viewer ? 'your ' : 'their ') + zoneName));
      if (ok) {
        wrap.tabIndex = 0;
        wrap.onclick = function () { SV.asks.toggle(s, iid, answer); };
        wrap.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); SV.asks.toggle(s, iid, answer); } };
      }
      cards.appendChild(wrap);
    });
    body.appendChild(cards);
    nodes.push(body);
    nodes.push(pickControls(s, a, answer, false));
    const fl = el('div', 'choice-flash'); fl.id = 'choice-flash';
    nodes.push(fl);
    openModal(key, nodes, 'Show the cards');
    return true;
  };

  // ---- the arrow (attack aim / declared) --------------------------------------------------
  const NS = 'http://www.w3.org/2000/svg';
  function layer() {
    let svg = $('arrow-layer');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg');
      svg.id = 'arrow-layer';
      document.body.appendChild(svg);
    }
    return svg;
  }
  // Bowed sideways on purpose: the board's dividers run horizontally and vertically, so a
  // straight arrow reads as one more line.
  function bowOf(from, to) { return Math.min(120, Math.abs(to.y - from.y) * 0.45) + 20; }
  SV.arrow = {
    // kind: 'aim' (pale, still a proposal) | 'declared' (red) | 'evolve' (violet)
    draw: function (from, to, kind) {
      const svg = layer();
      svg.textContent = '';
      svg.classList.add('open');
      const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2, bow = bowOf(from, to);
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('class', 'attack-arrow is-' + kind);
      p.setAttribute('d', 'M' + from.x + ',' + from.y + ' Q' + (midX + bow) + ',' + midY + ' ' + to.x + ',' + to.y);
      p.style.animationDelay = U.animationPhase(700);
      svg.appendChild(p);
      const head = document.createElementNS(NS, 'path');
      head.setAttribute('class', 'attack-arrow-head is-' + kind);
      const ang = Math.atan2(to.y - midY, to.x - (midX + bow));
      const size = 14;
      const pts = [[to.x, to.y],
        [to.x - size * Math.cos(ang - 0.42), to.y - size * Math.sin(ang - 0.42)],
        [to.x - size * Math.cos(ang + 0.42), to.y - size * Math.sin(ang + 0.42)]];
      head.setAttribute('d', 'M' + pts.map(function (q) { return q[0] + ',' + q[1]; }).join(' L') + ' z');
      svg.appendChild(head);
    },
    clear: function () { const svg = $('arrow-layer'); if (svg) { svg.textContent = ''; svg.classList.remove('open'); } },
    centreOf: function (node) { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  };
})();
