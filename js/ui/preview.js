// js/ui/preview.js — the enlargements (PRESENTATION-REFERENCE A4): hover preview, inspector
// (tap / long-press), spotlight of every played card, and the zone browser. Deliberately not
// interchangeable: the preview follows the pointer, the inspector is a place you go, the
// spotlight is the game telling you something.
//
// The hover preview is ONE delegated listener on the document keyed on data-card-id:
// face-down cards never carry that attribute, so they can never be previewed, and every later
// modal, log line or browser gets hover for free.
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;
  const el = U.el;

  const OPEN_DELAY_MS = 300;      // 90 chased the pointer; 1000 felt like waiting
  const LONG_PRESS_MS = 450;
  const LONG_PRESS_SLOP_PX = 10;
  const GAP = 12;

  function ensure(id, cls) {
    let n = document.getElementById(id);
    if (!n) { n = el('div', cls || null); n.id = id; document.body.appendChild(n); }
    return n;
  }
  function liveState() { return SV.ui && SV.ui.state ? SV.ui.state : null; }
  function viewer() { return SV.ui ? SV.ui.viewerKey() : 0; }

  function side(title, cls) {
    const p = el('div', 'preview-side ' + (cls || ''));
    p.appendChild(el('div', 'preview-side-title', title));
    return p;
  }

  // The preview row: card at preview size, then side panels (why-not, right now, abilities,
  // evolved-from, keyword glossary). `iid` is resolved against the CURRENT state at open time.
  function buildRow(cardNo, iid, state) {
    const row = el('div', 'preview-row');
    const inst = (iid != null && state && state.cards[iid]) ? state.cards[iid] : null;
    const main = SV.renderCard(inst ? iid : cardNo, { size: 'preview', state: inst ? state : null });
    // The preview is ALWAYS upright (PLAN D10), whatever the board slot does.
    main.classList.remove('is-engaged');
    row.appendChild(main);
    const sides = el('div', 'preview-sides');

    // Why this hand / EX card can't be played right now — said before the first click.
    if (inst && state && (inst.zone === 'hand' || inst.zone === 'ex') && SV.ui && inst.owner === SV.ui.viewSeat &&
        !state.ask && SV.whoActs(state) === inst.owner && (state.phase === 'main' || state.window)) {
      const why = SV.whyNot(state, iid);
      if (why) {
        const p = side('Can’t play it now', 'preview-why');
        p.appendChild(el('div', 'why-text', why));
        sides.appendChild(p);
      }
    }
    if (inst && state && inst.zone === 'field') {
      const c = SV.chars(state, iid);
      const notes = [];
      if (inst.engaged) notes.push('Engaged: it can’t attack, and enemy followers can attack it. It refreshes at the start of its controller’s turn.');
      else if (c.type === 'follower') notes.push('Reserved (upright): it can attack, and enemies can attack it only with Assail.');
      if (c.type === 'follower' && inst.enteredTurn === state.turn && state.active === inst.ctrl && !SV.canAttackWith(state, iid) && !inst.engaged) {
        notes.push('Arrived this turn: it can attack from its controller’s next turn.');
      }
      if (inst.evo) notes.push(inst.superEvolved ? 'Super-evolved (+1/+1 on top of its evolved card).' : 'Evolved: it shows its evolved card.');
      const ev = SV.evolveInfo(state, iid);
      if (ev && inst.ctrl === viewer()) notes.push('Evolve cost: ' + ev.cost + ' play point' + (ev.cost === 1 ? '' : 's') + (SV.canEvolve(state, iid) ? ' — it can evolve now.' : '.'));
      if (c.flags.cantAttack) notes.push('It can’t attack.');
      if (c.flags.cantBeAttacked) notes.push('It can’t be attacked.');
      if (c.flags.loseAbilities) notes.push('It has lost its abilities.');
      if (notes.length) {
        const p = side('Right now', 'preview-state');
        notes.forEach(function (t) { p.appendChild(el('div', 'state-text', t)); });
        sides.appendChild(p);
      }
    }
    // Activated abilities, with the engine's reason when one can't be used.
    if (inst && state && inst.zone !== 'deck' && (inst.zone !== 'hand' || inst.owner === viewer() || viewer() === 'all')) {
      const acts = inst.zone === 'evoDeck' ? [] : SV.chars(state, iid).activated;
      if (acts.length) {
        const p = side('Abilities', 'preview-acts');
        acts.forEach(function (ab) {
          const r = el('div', 'act-row' + (ab.usable ? ' is-usable' : ''));
          r.appendChild(el('span', 'act-cost', ab.costText || 'free'));
          r.appendChild(el('span', 'act-text', ab.text + (ab.quick ? ' (Quick)' : '')));
          if (!ab.usable && ab.why) r.appendChild(el('div', 'act-why', ab.why));
          p.appendChild(r);
        });
        sides.appendChild(p);
      }
    }
    // An evolved follower: the card underneath.
    if (inst && inst.evo && state) {
      const p = side('Evolved from', 'preview-under');
      const stack = el('div', 'preview-under-stack');
      stack.appendChild(SV.renderCard(inst.id, { size: 'board' }));
      p.appendChild(stack);
      sides.appendChild(p);
    } else if (!inst && SV.CARDS[cardNo] && SV.CARDS[cardNo].base) {
      const p = side('Evolves from', 'preview-under');
      const stack = el('div', 'preview-under-stack');
      stack.appendChild(SV.renderCard(SV.CARDS[cardNo].base, { size: 'board' }));
      p.appendChild(stack);
      sides.appendChild(p);
    }
    const kw = inst && state && inst.zone === 'field' ? SV.chars(state, iid).kw : null;
    const gloss = SV.cardGlossary(cardNo, kw);
    if (gloss.length) {
      const p = side('Keywords', 'preview-glossary');
      gloss.forEach(function (g) {
        const r = el('div', 'kw-row');
        r.appendChild(el('span', 'kw-name', g.name));
        r.appendChild(el('span', 'kw-text', ' ' + g.text));
        p.appendChild(r);
      });
      sides.appendChild(p);
    }
    if (sides.childNodes.length) row.appendChild(sides);
    return { row: row, main: main };
  }

  // ---- A. hover preview ------------------------------------------------------------------
  let hoverTimer = null, previewFor = null, anchor = null;

  const Preview = SV.preview = {
    face: function (cardNo, iid, state) { return buildRow(cardNo, iid, state).row; },
    show: function (anchorEl, cardNo, iid) {
      const state = liveState();
      const key = (iid != null ? 'i' + iid : 'd') + '|' + cardNo;
      const box = ensure('preview');
      if (previewFor === key && box.classList.contains('open')) return;
      previewFor = key;
      box.textContent = '';
      const built = buildRow(cardNo, iid, state);
      box.appendChild(built.row);
      box.classList.add('open');
      box.classList.remove('grown');
      // Centre the MAIN card on the anchor, not the whole row; clamp to the viewport.
      const rect = anchorEl.getBoundingClientRect();
      const bw = box.offsetWidth, bh = box.offsetHeight;
      const mainMid = built.main.offsetLeft + built.main.offsetWidth / 2;
      let left = rect.left + rect.width / 2 - mainMid;
      left = Math.max(GAP, Math.min(left, window.innerWidth - bw - GAP));
      let top = rect.top + rect.height / 2 - bh / 2;
      top = Math.max(GAP, Math.min(top, window.innerHeight - bh - GAP));
      box.style.left = left + 'px';
      box.style.top = top + 'px';
      box.style.transformOrigin = mainMid + 'px 50%';
      // Two nested rAFs so the browser commits the start scale before growing; in a background
      // tab they never fire and the box stays invisible — harmless.
      requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('grown'); }); });
    },
    hide: function () {
      clearTimeout(hoverTimer);
      previewFor = null; anchor = null;
      const box = document.getElementById('preview');
      if (box) box.classList.remove('open', 'grown');
    },
    invalidate: function () { previewFor = null; },
  };

  function cardTarget(node) {
    if (!node || !node.closest) return null;
    if (node.closest('#preview')) return null;
    const t = node.closest('[data-card-id]');
    if (!t || t.closest('.no-preview')) return null;
    return t;
  }
  function iidOf(t) { return t.dataset.iid != null && t.dataset.iid !== 'undefined' ? t.dataset.iid : null; }
  function arm(t) {
    clearTimeout(hoverTimer);
    anchor = t;
    hoverTimer = setTimeout(function () {
      if (SV.drag && SV.drag.active()) return;          // never while dragging
      if (!t.isConnected) return;
      Preview.show(t, t.dataset.cardId, iidOf(t));
    }, OPEN_DELAY_MS);
  }
  document.addEventListener('mouseover', function (e) {
    const t = cardTarget(e.target);
    if (t === anchor) return;
    if (!t) { Preview.hide(); return; }
    arm(t);
  });
  document.addEventListener('mouseleave', function () { Preview.hide(); });
  document.addEventListener('focusin', function (e) { const t = cardTarget(e.target); if (t) arm(t); });
  document.addEventListener('focusout', function () { Preview.hide(); });
  // A press starts a gesture; the preview must not sit over the drop targets.
  document.addEventListener('pointerdown', function () { Preview.hide(); }, true);

  // ---- long press: the touch stand-in for hover -------------------------------------------
  let pressTimer = null;
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    const t = cardTarget(e.target);
    if (!t) return;
    clearTimeout(pressTimer);
    const sx = e.clientX, sy = e.clientY;
    function moved(ev) {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_SLOP_PX) end();
    }
    function end() {
      clearTimeout(pressTimer); pressTimer = null;
      document.removeEventListener('pointermove', moved, true);
      document.removeEventListener('pointerup', end, true);
      document.removeEventListener('pointercancel', end, true);
    }
    document.addEventListener('pointermove', moved, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    pressTimer = setTimeout(function () {
      end();
      // The finger is still down: take the gesture off the drag and swallow the click that
      // follows, so the release cannot also play the card that was being read.
      if (SV.drag) { SV.drag.cancel(); SV.drag.swallowClick(); }
      SV.inspector.open(t.dataset.cardId, iidOf(t));
    }, LONG_PRESS_MS);
  }, true);
  document.addEventListener('contextmenu', function (e) {
    // Every long-press target, not only .card: the menu would cover the inspector it opens.
    if (cardTarget(e.target) && e.pointerType && e.pointerType !== 'mouse') e.preventDefault();
  });

  // ---- B. inspector -----------------------------------------------------------------------
  function escClose(e) { if (e.key === 'Escape') { e.stopPropagation(); SV.inspector.close(); } }
  SV.inspector = {
    open: function (cardNo, iid, extra) {
      Preview.hide();
      const box = ensure('inspector');
      box.textContent = '';
      const body = el('div', 'inspect-body');
      body.addEventListener('click', function (e) { e.stopPropagation(); });
      body.appendChild(buildRow(cardNo, iid, liveState()).row);
      if (extra) body.appendChild(extra);
      const close = el('button', 'peek-btn inspect-close', 'Close');
      close.onclick = SV.inspector.close;
      body.appendChild(close);
      box.appendChild(body);
      box.classList.add('open');
      box.onclick = SV.inspector.close;
      document.addEventListener('keydown', escClose, true);
    },
    close: function () {
      const box = document.getElementById('inspector');
      if (box) box.classList.remove('open');
      document.removeEventListener('keydown', escClose, true);
    },
  };

  // ---- C. zone browser ----------------------------------------------------------------------
  // Read-only unless the caller hands an item an onClick (a cemetery card with a usable
  // ability). The information boundary is the CALLER's job: this renders what it is handed.
  function escBrowse(e) { if (e.key === 'Escape') { e.stopPropagation(); SV.zoneBrowser.close(); } }
  SV.zoneBrowser = {
    // items: [{cardNo, iid?, count?, hidden?, label?, actable?, onClick?}]
    open: function (title, items, note) {
      Preview.hide();
      const box = ensure('zone-browser', 'browse-overlay');
      box.textContent = '';
      const body = el('div', 'browse-body');
      body.addEventListener('click', function (e) { e.stopPropagation(); });
      const head = el('div', 'browse-head');
      const total = items.reduce(function (n, it) { return n + (it.count || 1); }, 0);
      head.appendChild(el('div', 'browse-title', title + ' (' + total + ')'));
      if (note) head.appendChild(el('div', 'browse-note', note));
      const closeBtn = el('button', 'browse-close', 'Close');
      closeBtn.onclick = SV.zoneBrowser.close;
      head.appendChild(closeBtn);
      body.appendChild(head);
      if (!items.length) body.appendChild(el('div', 'browse-empty', 'Nothing here.'));
      else {
        const grid = el('div', 'browse-grid');
        const state = liveState();
        items.forEach(function (it) {
          const node = it.hidden ? SV.renderCard(null, { size: 'hand', hidden: true })
            : SV.renderCard(it.iid != null && state && state.cards[it.iid] ? it.iid : it.cardNo,
              { size: 'hand', state: it.iid != null ? state : null });
          node.tabIndex = 0;
          if (it.actable) { node.classList.add('role-actable'); node.style.animationDelay = U.animationPhase(1700); }
          if (it.onClick) {
            node.style.cursor = 'pointer';
            node.onclick = function () { SV.zoneBrowser.close(); it.onClick(); };
          }
          const cell = el('div', 'browse-cell');
          cell.appendChild(node);
          if (it.count > 1) cell.appendChild(el('div', 'browse-count', '×' + it.count));
          if (it.label) cell.appendChild(el('div', 'browse-label', it.label));
          grid.appendChild(cell);
        });
        body.appendChild(grid);
      }
      box.appendChild(body);
      box.classList.add('open');
      box.onclick = SV.zoneBrowser.close;
      document.addEventListener('keydown', escBrowse, true);
      closeBtn.focus();
    },
    close: function () {
      const box = document.getElementById('zone-browser');
      if (box) box.classList.remove('open');
      Preview.hide();
      document.removeEventListener('keydown', escBrowse, true);
    },
    isOpen: function () { const b = document.getElementById('zone-browser'); return !!(b && b.classList.contains('open')); },
  };

  // ---- D. spotlight of every played card ------------------------------------------------------
  const TRAVEL_MS = 500, HOLD_MS = 1200, FADE_MS = 250;
  let spotTimer = null, fadeTimer = null;
  function finishSpot(box, immediate) {
    clearTimeout(spotTimer);
    if (!box || !box.isConnected) return;
    if (immediate) { box.remove(); return; }
    box.style.opacity = '0';
    fadeTimer = setTimeout(function () { box.remove(); }, FADE_MS);
  }
  // opts: {caption, fromEl, short}
  SV.spotlight = function (cardNo, opts) {
    opts = opts || {};
    const old = document.getElementById('spotlight');
    if (old) finishSpot(old, true);              // a second play finishes the first
    const box = el('div');
    box.id = 'spotlight';
    const k = SV.anim.rate();
    if (opts.caption) box.appendChild(el('div', 'spotlight-caption', opts.caption));
    box.appendChild(SV.renderCard(cardNo, { size: 'preview' }));
    let dx = 0, dy = 0;
    if (opts.fromEl && opts.fromEl.getBoundingClientRect) {
      const r = opts.fromEl.getBoundingClientRect();
      dx = r.left + r.width / 2 - window.innerWidth / 2;
      dy = r.top + r.height / 2 - window.innerHeight / 2;
    }
    box.style.transition = 'transform ' + Math.round(TRAVEL_MS * k) + 'ms cubic-bezier(.22,.72,.3,1), opacity ' + Math.round(300 * k) + 'ms ease-out';
    box.style.transform = 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) scale(.3)';
    box.style.opacity = '.35';
    box.onclick = function () { finishSpot(box, true); };
    document.body.appendChild(box);
    // Start state flushed with a forced LAYOUT READ, not rAF: rAF does not fire in a
    // background tab and would strand the card in the middle of the screen.
    void box.getBoundingClientRect();
    const fit = Math.min(1, (window.innerHeight - 24) / Math.max(1, box.offsetHeight), (window.innerWidth - 24) / Math.max(1, box.offsetWidth));
    box.style.transform = 'translate(-50%,-50%) scale(' + fit.toFixed(3) + ')';
    box.style.opacity = '1';
    clearTimeout(fadeTimer);
    spotTimer = setTimeout(function () { finishSpot(box, false); }, Math.round((TRAVEL_MS + (opts.short ? HOLD_MS * 0.5 : HOLD_MS)) * k));
    return box;
  };
  SV.spotlight.clear = function () { finishSpot(document.getElementById('spotlight'), true); };
})();
