// js/ui/game.js — the match controller: modes, the one apply funnel, the bot loop, the board
// redraw and the drag manager. Tap inspects (or opens a card's actions), drag commits. EVERY
// affordance here is a filter over SV.legalActions; the UI cannot invent a rule
// (PRESENTATION-REFERENCE A0.3, CLAUDE.md rule 2). Every number shown comes from the engine.
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;
  const el = U.el, $ = U.$;

  const DRAG_THRESHOLD_PX = 8;
  const CLICK_GRACE_MS = 350;
  const AI_GAP_MS = 820;          // between bot actions at full speed: followable, not slow
  const TURN_HOLD_MS = 1100;      // extra beat when the turn changes hands (banner)
  const WATCHDOG_MS = 5000;       // the bot never waits longer than this for a picture

  const UI = SV.ui = {
    state: null, mode: 'ai', seats: ['human', 'ai'], levels: [null, 'normal'],
    viewSeat: 0, names: ['You', 'Opponent'], decks: null, lastN: -1, paused: false,
    trace: null, lastTurnSeen: null, speed: 1,
  };

  // ---------------------------------------------------------------- setup
  UI.start = function (opts) {
    SV.anim.skip();
    SV.spotlight.clear();
    SV.asks.reset();
    SV.hud.reset();
    UI.mode = opts.mode || 'ai';
    UI.decks = opts.decks.slice();
    const lvl = opts.level || 'normal';
    if (UI.mode === 'ai' || UI.mode === 'tutorial') {
      UI.seats = ['human', 'ai'];
      UI.levels = [null, UI.mode === 'tutorial' ? 'easy' : lvl];
      UI.names = ['You', 'Opponent'];
    } else if (UI.mode === 'hotseat') {
      UI.seats = ['human', 'human'];
      UI.levels = [null, null];
      UI.names = ['Player 1', 'Player 2'];
    } else {
      UI.seats = ['ai', 'ai'];
      UI.levels = [opts.levels ? opts.levels[0] : lvl, opts.levels ? opts.levels[1] : lvl];
      UI.names = ['Bot A', 'Bot B'];
    }
    SV.logText.setPerspective(UI.mode === 'hotseat' ? { you: null, sees: null, names: UI.names }
      : UI.mode === 'spectate' ? { you: null, sees: 'all', names: UI.names }
      : { you: 0, sees: 0, names: ['You', 'The opponent'] });
    const seed = opts.seed != null ? opts.seed : ('g' + Math.floor(Math.random() * 1e9));
    const first = opts.first === 0 || opts.first === 1 ? opts.first : undefined;
    UI.state = SV.newGame({ decks: UI.decks, seed: seed, first: first, names: UI.names });
    UI.lastN = UI.state.log.length ? UI.state.log[UI.state.log.length - 1].n : -1;
    // The black box: the engine's trace shape (SV.replay re-runs it), plus the view's own
    // notes under `ui` (mode, levels, who played each action).
    UI.trace = SV.makeTrace({ decks: UI.decks, seed: seed, first: first, names: UI.names });
    UI.trace.ui = { app: 'shadowforge', at: new Date().toISOString(), mode: UI.mode, levels: UI.levels, lenient: !!SV.LENIENT, sources: [] };
    UI.paused = false;
    UI.lastTurnSeen = null;
    UI.viewSeat = UI.mode === 'hotseat' ? null : 0;
    SV.boardArt.rollScenes();
    if (UI.mode === 'tutorial') SV.tutorial.begin(); else SV.tutorial.end();
    UI.render();
    schedule();
  };

  UI.rematch = function () {
    UI.start({ mode: UI.mode, decks: UI.decks, level: UI.levels[1] || UI.levels[0] || 'normal', levels: UI.levels.slice() });
  };
  UI.isHuman = function (seat) { return UI.seats[seat] === 'human'; };
  // Who the board is drawn for: a seat, or 'all' while spectating.
  UI.viewerKey = function () { return UI.mode === 'spectate' ? 'all' : (UI.viewSeat == null ? 0 : UI.viewSeat); };
  UI.vsAI = function () { return UI.mode === 'ai' || UI.mode === 'tutorial'; };
  // "Your" / "Opponent's" / "Player 2's"
  UI.whose = function (seat) { return UI.vsAI() ? (seat === 0 ? 'Your' : 'Opponent’s') : UI.names[seat] + '’s'; };

  // Concede (CR 1.2.3): either seat, any time, not in legalActions.
  UI.concede = function (seat) {
    const s = UI.state;
    if (!s || SV.isTerminal(s)) return;
    SV.anim.skip();
    applyFrom(seat, { type: 'concede', who: seat }, 'human');
  };
  UI.humanSeatForConcede = function () {
    if (UI.mode === 'spectate') return null;
    if (UI.mode === 'hotseat') return UI.viewSeat == null ? 0 : UI.viewSeat;
    return 0;
  };

  // ---------------------------------------------------------------- the one apply funnel
  function toast(text, cls) {
    let t = $('toast');
    if (!t) { t = el('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = text;
    t.className = 'show ' + (cls || '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.className = ''; }, 3800);
  }
  UI.toast = toast;

  function applyFrom(seat, action, source) {
    const prev = UI.state;
    let next;
    try {
      next = SV.apply(prev, action);
    } catch (err) {
      if (err instanceof SV.Illegal) {
        console.warn('[ui] illegal', action, err.message);
        toast('That isn’t allowed right now (' + err.message + ').', 'is-warn');
        UI.render();
        return false;
      }
      UI.trace.ui.error = { at: UI.trace.actions.length, action: action, message: String(err && err.message), stack: String(err && err.stack) };
      console.error('[ui] apply threw', action, err);
      toast('Engine error: ' + (err && err.message) + ' — the drawer’s "Save bug report" button saves the trace.', 'is-error');
      UI.render();
      throw err;
    }
    UI.trace.actions.push(action);
    UI.trace.ui.sources.push(source + ':' + seat);
    UI.state = next;
    if (action.type !== 'answer') SV.asks.reset();
    // Animate only entries newer than the last one shown: an answered ask re-runs its job from
    // the snapshot and re-emits identical entries with the same n.
    const fresh = next.log.filter(function (e) { return e.n > UI.lastN; });
    if (fresh.length) UI.lastN = fresh[fresh.length - 1].n;
    settle(prev, next, fresh);
    return true;
  }

  UI.doAction = function (action) {
    if (SV.anim.busy()) return;
    const seat = SV.whoActs(UI.state);
    if (seat == null || !UI.isHuman(seat) || seat !== UI.viewSeat) return;
    SV.sound.sfx('click');
    applyFrom(seat, action, 'human');
  };
  UI.answer = function (value) { UI.doAction({ type: 'answer', value: value }); };

  function settle(prev, next, fresh) {
    const steps = SV.anim.plan(prev, next, fresh);
    const animated = SV.anim.willAnimate(steps);
    SV.sound.play(fresh, animated);
    if (SV.anim.mode() !== 'off') spotlightPlays(prev, next, fresh);
    if (!animated) { UI.render(); schedule(); return; }
    SV.anim.run(steps, next, { viewSeat: UI.viewSeat == null ? 0 : UI.viewSeat }, function () {
      UI.render();
      schedule();
    });
  }

  function spotlightPlays(prev, next, fresh) {
    fresh.forEach(function (l) {
      // The turn order was just decided (CR 6.2.1.6), possibly by the other seat: say it.
      if (l.type === 'start') { toast(SV.logText.plain(l, next)); return; }
      if (l.type !== 'play') return;
      const c = next.cards[l.iid] || prev.cards[l.iid];
      if (!c) return;
      const who = UI.vsAI() ? (l.who === 0 ? 'You play' : 'The opponent plays') : UI.names[l.who] + ' plays';
      const mine = l.who === (UI.viewSeat == null ? 0 : UI.viewSeat);
      const from = l.from === 'ex' ? $(mine ? 'my-ex' : 'enemy-ex') : $(mine ? 'hand' : 'enemy-hand');
      SV.spotlight(c.id, { caption: who + (l.from === 'ex' ? ' from the EX area' : '') + (l.quick ? ' · Quick' : ''), fromEl: from });
    });
  }

  // ---------------------------------------------------------------- the bot loop
  let botTimer = null;
  function schedule() {
    clearTimeout(botTimer);
    const s = UI.state;
    if (!s) return;
    if (SV.isTerminal(s)) { SV.hud.finish(s); return; }
    const acting = SV.whoActs(s);
    if (UI.seats[acting] !== 'ai') return;
    if (UI.paused) return;
    const k = SV.anim.mode() === 'off' ? 0.15 : SV.anim.rate();
    let delay = Math.max(120, AI_GAP_MS * k);
    // A Quick window the bot holds is decided quickly: it is a beat, not a turn.
    if (s.window && !s.ask) delay = Math.max(80, delay * 0.4);
    if (UI.lastTurnSeen !== s.turn) delay += TURN_HOLD_MS * Math.max(0.3, k);
    UI.lastTurnSeen = s.turn;
    botTimer = setTimeout(function () { botStep(Date.now()); }, delay);
  }
  UI.schedule = schedule;

  function botStep(since) {
    const s = UI.state;
    if (!s || SV.isTerminal(s) || UI.paused) return;
    const acting = SV.whoActs(s);
    if (UI.seats[acting] !== 'ai') return;
    if (SV.anim.busy()) {
      if (Date.now() - since > WATCHDOG_MS || SV.anim.age() > WATCHDOG_MS) SV.anim.skip();
      else { botTimer = setTimeout(function () { botStep(since); }, 120); return; }
    }
    // No fallback move: an AI that throws is a bug to see, not to paper over (CLAUDE.md rule 5).
    let action;
    try {
      action = SV.ai.choose(s, acting, UI.levels[acting] || 'normal');
    } catch (err) {
      console.error('[ui] SV.ai.choose threw', err);
      UI.trace.ui.error = { at: UI.trace.actions.length, ai: true, message: String(err && err.message), stack: String(err && err.stack) };
      toast('The AI failed to choose (' + (err && err.message) + '). The game is paused; "Save bug report" in the drawer keeps the trace.', 'is-error');
      UI.paused = true;
      UI.render();
      return;
    }
    applyFrom(acting, action, 'ai');
  }

  UI.setPaused = function (p) { UI.paused = p; if (!p) schedule(); else clearTimeout(botTimer); UI.render(); };
  UI.stepOnce = function () {
    if (!UI.paused) return;
    const s = UI.state;
    if (!s || SV.isTerminal(s)) return;
    if (SV.anim.busy()) SV.anim.skip();
    const acting = SV.whoActs(s);
    if (UI.seats[acting] !== 'ai') return;
    applyFrom(acting, SV.ai.choose(s, acting, UI.levels[acting] || 'normal'), 'ai');
  };

  // ---------------------------------------------------------------- labels
  function nm(s, iid) { return s.cards[iid] ? SV.def(iid, s).name : '?'; }
  UI.cardName = nm;
  function targetName(s, t) {
    const c = s.cards[t];
    if (c && c.zone === 'leader') return (UI.vsAI() ? (c.owner === 0 ? 'your' : 'the enemy') : UI.names[c.owner] + '’s') + ' leader';
    return nm(s, t);
  }
  function pts(n) { return n + ' play point' + (n === 1 ? '' : 's'); }
  // Buttons say what they do, with the numbers (kb/LESSONS-DIGEST §4.1).
  UI.actionLabel = function (s, a) {
    switch (a.type) {
      case 'play': {
        const c = s.cards[a.iid];
        return 'Play ' + nm(s, a.iid) + (c.zone === 'ex' ? ' from the EX area' : '') + ' (' + pts(SV.costToPlay(s, a.iid)) + ')' + (s.window ? ' — Quick' : '');
      }
      case 'evolve': {
        const info = SV.evolveInfo(s, a.iid);
        const P = s.players[s.cards[a.iid].ctrl];
        return 'Evolve ' + nm(s, a.iid) + ' (' + pts(info.cost) + (P.ep > 0 && info.cost > 0 ? '; 1 evolution point can pay 1' : '') + ')';
      }
      case 'activate': {
        const ab = SV.chars(s, a.iid).activated[a.idx];
        return (ab.costText ? '[' + ab.costText + '] ' : '') + ab.text + (s.window ? ' — Quick' : '');
      }
      case 'attack': {
        const A = SV.chars(s, a.iid);
        const tc = s.cards[a.target];
        if (tc.zone === 'leader') return 'Attack ' + targetName(s, a.target) + ' — deal ' + Math.max(0, A.atk) + ' (defense ' + s.players[tc.owner].defense + ')';
        const T = SV.chars(s, a.target);
        return 'Attack ' + nm(s, a.target) + ' — deal ' + Math.max(0, A.atk) + ' (it has ' + T.def + '), take ' + Math.max(0, T.atk) + ' (you have ' + A.def + ')';
      }
      case 'end': return 'End turn';
      case 'pass': return 'No response';
      default: return a.type;
    }
  };

  // What a Quick window is about: "Their Dark Dragoon Forte attacks your leader."
  UI.windowText = function (s) {
    const w = s.window;
    if (!w) return '';
    const viewer = UI.viewSeat == null ? w.who : UI.viewSeat;
    const owner = function (seat, cap) {
      if (UI.vsAI() || UI.mode === 'hotseat') return seat === viewer ? (cap ? 'Your' : 'your') : (cap ? 'Their' : 'their');
      return UI.names[seat] + '’s';
    };
    if (w.kind === 'attack' && s.attack) {
      const a = s.cards[s.attack.a], t = s.cards[s.attack.t];
      const tgt = t.zone === 'leader' ? owner(t.owner, false) + ' leader' : owner(t.owner, false) + ' ' + nm(s, s.attack.t);
      return owner(a.ctrl, true) + ' ' + nm(s, s.attack.a) + ' attacks ' + tgt + '.';
    }
    if (w.kind === 'end') return 'It is ' + owner(s.active, false) + ' end phase.';
    return 'A Quick window is open.';
  };

  // ---------------------------------------------------------------- hover hints
  UI.hint = function (iid) {
    document.querySelectorAll('.role-hinted').forEach(function (n) { n.classList.remove('role-hinted'); });
    if (iid == null) return;
    const n = document.querySelector('#mat .card[data-iid="' + iid + '"]') || document.querySelector('#hand .card[data-iid="' + iid + '"]');
    if (n) n.classList.add('role-hinted');
  };
  function hintOn(btn, iid) {
    if (iid == null) return;
    btn.addEventListener('mouseenter', function () { UI.hint(iid); });
    btn.addEventListener('mouseleave', function () { UI.hint(null); });
    btn.addEventListener('focus', function () { UI.hint(iid); });
    btn.addEventListener('blur', function () { UI.hint(null); });
  }
  UI.hintOn = hintOn;

  // ---------------------------------------------------------------- drag manager
  const Drag = SV.drag = (function () {
    let live = null, lastDragEnd = 0;
    function justDragged() { return Date.now() - lastDragEnd < CLICK_GRACE_MS; }
    function begin(node, e, spec) {
      if (live) finish(false);            // a fresh press proves the old gesture is over
      live = { node: node, spec: spec, startX: e.clientX, startY: e.clientY, moved: false };
      // Set at PRESS time: by the 8px threshold the browser has already begun selecting.
      document.documentElement.classList.add('is-dragging');
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) sel.removeAllRanges();
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      node.addEventListener('pointermove', onMove);
      node.addEventListener('pointerup', onUp);
      node.addEventListener('pointercancel', onCancel);
    }
    function onMove(e) {
      if (!live) return;
      const dx = e.clientX - live.startX, dy = e.clientY - live.startY;
      if (!live.moved) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return;
        live.moved = true;
        SV.preview.hide();
        if (!live.spec.targets.length) return;           // undraggable stays tappable
        markTargets(true);
        if (live.spec.kind === 'hand') {
          const clone = live.node.cloneNode(true);
          clone.classList.add('drag-clone');
          clone.removeAttribute('data-card-id');
          clone.style.width = live.node.offsetWidth + 'px';
          document.body.appendChild(clone);
          live.clone = clone;
          live.node.classList.add('is-dragging-source');
        } else live.arrow = true;
      }
      if (!live.spec.targets.length) return;
      if (live.clone) {
        live.clone.style.left = (e.clientX - live.clone.offsetWidth / 2) + 'px';
        live.clone.style.top = (e.clientY - live.clone.offsetHeight * 0.85) + 'px';
      }
      hotTarget(e.clientX, e.clientY);
      if (live.arrow) SV.arrow.draw(SV.arrow.centreOf(live.node), { x: e.clientX, y: e.clientY }, live.spec.kind === 'evolve' ? 'evolve' : 'aim');
    }
    function onUp(e) {
      if (!live) return;
      const wasDrag = live.moved;
      if (wasDrag && live.spec.targets.length) {
        const drop = findDrop(e.clientX, e.clientY);
        lastDragEnd = Date.now();
        armClickSwallow();
        finish(false);
        if (drop) UI.doAction(drop.action);
        else UI.render();                              // released over nothing: silent cancel
        return;
      }
      if (wasDrag) { lastDragEnd = Date.now(); armClickSwallow(); }
      finish(!wasDrag);
    }
    function onCancel() { finish(false); }
    function finish(wasTap) {
      if (!live) return;
      const L = live;
      live = null;
      L.node.removeEventListener('pointermove', onMove);
      L.node.removeEventListener('pointerup', onUp);
      L.node.removeEventListener('pointercancel', onCancel);
      L.node.classList.remove('is-dragging-source');
      document.documentElement.classList.remove('is-dragging');
      if (L.clone) L.clone.remove();
      if (L.arrow) SV.arrow.clear();
      document.querySelectorAll('.drop-ok, .drop-hot').forEach(function (n) { n.classList.remove('drop-ok', 'drop-hot'); });
      if (wasTap && !L.moved && L.spec.onTap) L.spec.onTap(L.node);
    }
    function markTargets(on) {
      document.querySelectorAll('.drop-ok, .drop-hot').forEach(function (n) { n.classList.remove('drop-ok', 'drop-hot'); });
      if (!on || !live) return;
      live.spec.targets.forEach(function (t) { const n = t.el(); if (n) n.classList.add('drop-ok'); });
    }
    function hotTarget(x, y) {
      document.querySelectorAll('.drop-hot').forEach(function (n) { n.classList.remove('drop-hot'); });
      const d = findDrop(x, y);
      if (d) { const n = d.el(); if (n) n.classList.add('drop-hot'); }
      return d;
    }
    function findDrop(x, y) {
      const under = document.elementFromPoint(x, y);
      if (!under || !live) return null;
      // Most specific first: a card target beats the zone it sits in.
      let best = null, bestDepth = -1;
      live.spec.targets.forEach(function (t) {
        const n = t.el();
        if (!n || !(n === under || n.contains(under))) return;
        let depth = 0, p = n; while (p) { depth++; p = p.parentElement; }
        if (depth > bestDepth) { best = t; bestDepth = depth; }
      });
      return best;
    }
    function armClickSwallow() {
      function swallow(e) { e.stopPropagation(); e.preventDefault(); document.removeEventListener('click', swallow, true); }
      document.addEventListener('click', swallow, true);
      setTimeout(function () { document.removeEventListener('click', swallow, true); }, CLICK_GRACE_MS);
    }
    return { begin: begin, active: function () { return !!(live && live.moved); }, justDragged: justDragged,
      cancel: function () { finish(false); }, swallowClick: armClickSwallow };
  })();

  // ---------------------------------------------------------------- rendering
  function markActable(node) {
    node.classList.add('role-actable', 'is-draggable');
    node.style.animationDelay = U.animationPhase(1700);
  }
  function acting(s) { return SV.whoActs(s); }
  function iidSel(iid) { return '[data-iid="' + iid + '"]'; }

  UI.render = function () {
    const s = UI.state;
    if (!s) return;
    if (SV.anim.busy()) return;           // mid-animation the board is deliberately stale
    // Hot-seat: the device is passed between turns, and a question or Quick window for the
    // other seat passes it too. The curtain hides both hands until the right person says ready.
    const who = acting(s);
    if (UI.mode === 'hotseat' && who != null && who !== UI.viewSeat) {
      SV.hud.curtain(who, function () { UI.viewSeat = who; SV.asks.reset(); UI.render(); });
      if (UI.viewSeat == null) return;
    } else SV.hud.curtain(null);
    const viewer = UI.viewSeat == null ? 0 : UI.viewSeat;
    const other = 1 - viewer;
    const mine = who === viewer && UI.isHuman(viewer) && !SV.isTerminal(s);
    const acts = mine && !s.ask ? SV.legalActions(s) : [];
    SV.preview.invalidate();
    tint(s, viewer);
    renderSide(s, viewer, acts, true);
    renderSide(s, other, acts, false);
    renderHand(s, viewer, acts);
    renderEnemyHand(s, other);
    renderTurnBar(s, acts, mine);
    renderWindow(s, acts, mine);
    SV.asks.render(s, viewer, who, UI.answer);
    const p = SV.asks.promptLine(s, viewer, who, promptNames());
    const m = $('choice-modal');
    const panelShowing = !!m && m.classList.contains('open') && !m.classList.contains('peek');
    SV.asks.renderEcho(p.text, p.cls === 'asking' && !!s.ask && !panelShowing && SV.asks.mode(s) !== 'board' && !!m && m.classList.contains('peek'));
    SV.logPanel.render(s, p);
    SV.hud.render(s, viewer);
    drawDeclaredArrow(s);
    if (UI.mode === 'tutorial') SV.tutorial.onRender(s, acts);
  };
  function promptNames() {
    if (UI.vsAI()) return ['you', 'the opponent'];
    return UI.names;
  }

  // The active player's class tints the HUD (PLAN §4.12); each side's class tints its zones.
  function tint(s, viewer) {
    const b = $('board');
    const cl = function (p) { return U.classOf(s.players[p].cls || 'neutral').tint; };
    b.style.setProperty('--tint-active', cl(s.active));
    b.style.setProperty('--tint-mine', cl(viewer));
    b.style.setProperty('--tint-theirs', cl(1 - viewer));
    b.classList.toggle('is-my-turn', s.active === viewer && !SV.isTerminal(s));
  }

  // While an attack is in progress (its Quick window open), its red arrow stays up.
  function drawDeclaredArrow(s) {
    if (Drag.active()) return;
    if (!s.attack || SV.isTerminal(s)) { SV.arrow.clear(); return; }
    const a = document.querySelector('#mat .card' + iidSel(s.attack.a));
    const tc = s.cards[s.attack.t];
    const t = tc && tc.zone === 'leader' ? $(sidePrefix(tc.owner) + 'leader') : document.querySelector('#mat .card' + iidSel(s.attack.t));
    if (a && t) SV.arrow.draw(SV.arrow.centreOf(a), SV.arrow.centreOf(t), 'declared');
    else SV.arrow.clear();
  }
  function sidePrefix(seat) { return seat === (UI.viewSeat == null ? 0 : UI.viewSeat) ? 'my-' : 'enemy-'; }
  UI.sidePrefix = sidePrefix;

  function asking(s) { return !!s.ask && acting(s) === UI.viewSeat && UI.isHuman(UI.viewSeat); }
  // Ask roles on a card node that the board draws (field, EX, leader).
  function askRole(s, node, iid) {
    if (!asking(s)) return false;
    if (SV.asks.isCandidate(s, iid)) { node.classList.add(SV.asks.isPicked(iid) ? 'role-picked' : 'role-target'); return true; }
    if (SV.asks.isSeen(s, iid) && SV.asks.mode(s) === 'board') node.classList.add('is-dim');
    return false;
  }

  function renderSide(s, seat, acts, isMine) {
    const pre = isMine ? 'my-' : 'enemy-';
    renderLeader($(pre + 'leader'), s, seat, isMine, acts);
    renderField($(pre + 'field'), s, seat, isMine, acts);
    renderEx($(pre + 'ex'), s, seat, isMine, acts);
    renderDeck($(pre + 'deck'), s, seat);
    renderEvo($(pre + 'evo'), s, seat, isMine, acts);
    renderPile($(pre + 'cemetery'), s, seat, 'cemetery', acts);
    renderPile($(pre + 'banished'), s, seat, 'banished', acts);
    renderPoints($(pre + 'points'), s, seat, isMine);
  }

  // ---- the leader: the defense number is the dominant read ----------------------------------
  UI.placeDefense = function (zoneNode, def) {
    const n = zoneNode.querySelector('.leader-def-num');
    if (!n) return;
    n.textContent = String(def);
    const box = zoneNode.querySelector('.leader-def');
    box.classList.toggle('is-low', def <= 6);
    box.classList.toggle('is-high', def > 20);
  };
  function renderLeader(node, s, seat, isMine, acts) {
    node.textContent = '';
    const P = s.players[seat];
    const active = !SV.isTerminal(s) && s.active === seat && s.phase !== 'mulligan';
    node.classList.toggle('is-active', active);
    node.classList.toggle('is-low', P.defense <= 6);
    node.style.setProperty('--tint', U.classOf(P.cls || 'neutral').tint);
    const holder = el('div', 'leader-card');
    if (P.leader != null) {
      const card = SV.renderCard(P.leader, { size: 'board', state: s });
      card.tabIndex = 0;
      askRole(s, card, P.leader);
      if (s.ask && s.ask.src === P.leader) card.classList.add('is-asker');
      card.addEventListener('click', function () {
        if (Drag.justDragged()) return;
        if (asking(UI.state) && SV.asks.isCandidate(UI.state, P.leader)) { SV.asks.toggle(UI.state, P.leader, UI.answer); return; }
        SV.inspector.open(UI.state.cards[P.leader].id, P.leader);
      });
      holder.appendChild(card);
    }
    node.appendChild(holder);
    const def = el('div', 'leader-def');
    const shield = el('span', 'leader-def-shield');
    // The defense crystal: an elongated hexagon with a light top facet and a dark base facet;
    // the number sits in the band between. The crack path is drawn only while a hit lands.
    shield.innerHTML = '<svg viewBox="0 0 40 48" aria-hidden="true"><path class="cr-body" d="M20 1 L37 11 L37 37 L20 47 L3 37 L3 11 Z"/>' +
      '<path class="cr-hi" d="M20 1 L37 11 L20 16 L3 11 Z"/><path class="cr-lo" d="M3 37 L20 32 L37 37 L20 47 Z"/>' +
      '<path class="cr-edge" d="M20 1 L37 11 L37 37 L20 47 L3 37 L3 11 Z M3 11 L20 16 L37 11 M3 37 L20 32 L37 37"/>' +
      '<path class="cr-crack" d="M15 5 L19 14 L13 21 L20 29 L16 38 L19 44 M19 14 L25 17 M20 29 L27 31"/></svg>';
    def.appendChild(shield);
    def.appendChild(el('span', 'leader-def-num', String(P.defense)));
    def.appendChild(el('span', 'leader-def-label', 'defense'));
    node.appendChild(def);
    const nameRow = el('div', 'leader-name', (UI.vsAI() ? (seat === 0 ? 'You' : 'Opponent') : UI.names[seat]) + (P.cls ? ' · ' + U.classOf(P.cls).name : ''));
    node.appendChild(nameRow);
    if (active) {
      const t = el('div', 'leader-turn', UI.vsAI() ? (seat === 0 ? 'your turn' : 'their turn') : 'turn');
      t.style.animationDelay = U.animationPhase(1900);
      node.appendChild(t);
    }
    node.setAttribute('data-tip', UI.whose(seat) + ' leader: ' + P.defense + ' defense. At 0 the game is lost.' +
      (!isMine ? ' Drag one of your followers here to attack it.' : ''));
    UI.placeDefense(node, P.defense);
  }

  // ---- the field: five slots; an engaged card turns 90 degrees in a slot that widens ---------
  function sourceActs(acts, iid) {
    return acts.filter(function (a) { return a.iid === iid && (a.type === 'attack' || a.type === 'evolve' || a.type === 'activate'); });
  }
  function attackTargets(acts, iid) {
    const out = [];
    acts.forEach(function (a) {
      if (a.type !== 'attack' || a.iid !== iid) return;
      out.push({ action: a, el: function () {
        const tc = UI.state.cards[a.target];
        if (tc.zone === 'leader') return $(sidePrefix(tc.owner) + 'leader');
        return document.querySelector('#mat .card' + iidSel(a.target));
      } });
    });
    return out;
  }

  function renderField(node, s, seat, isMine, acts) {
    node.textContent = '';
    const row = el('div', 'field-row');
    const P = s.players[seat];
    let en = 0;
    P.field.forEach(function (iid, i) {
      const c = s.cards[iid];
      const slot = el('div', 'field-slot');
      if (c.engaged) { slot.classList.add('is-engaged'); en++; }
      if (c.evo) slot.classList.add('has-evo');
      slot.style.setProperty('--z', String(10 + i));
      const card = SV.renderCard(iid, { size: 'board', state: s });
      card.tabIndex = 0;
      const mineActs = isMine ? sourceActs(acts, iid) : [];
      if (mineActs.length) markActable(card);
      askRole(s, card, iid);
      if (s.ask && s.ask.src === iid) card.classList.add('is-asker');
      if (s.attack && (s.attack.a === iid)) card.classList.add('is-attacking');
      const targets = attackTargets(acts, iid);
      card.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        Drag.begin(card, e, {
          kind: 'field', iid: iid, targets: targets,
          onTap: function () { tapBoardCard(iid); },
        });
      });
      card.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        tapBoardCard(iid);
      });
      slot.appendChild(card);
      row.appendChild(slot);
    });
    row.style.setProperty('--n', String(Math.max(1, P.field.length)));
    row.style.setProperty('--en', String(en));
    node.appendChild(row);
    node.classList.toggle('is-empty', P.field.length === 0);
    node.appendChild(el('div', 'zone-badge zone-badge-corner', P.field.length + '/' + P.fieldLimit));
  }
  // A tap on a board card: answer the ask, open your card's actions, or inspect.
  function tapBoardCard(iid) {
    const s = UI.state;
    if (asking(s) && SV.asks.isCandidate(s, iid)) { SV.asks.toggle(s, iid, UI.answer); return; }
    const c = s.cards[iid];
    const own = (c.zone === 'field' ? c.ctrl : c.owner) === UI.viewSeat;
    if (own && UI.isHuman(UI.viewSeat) && acting(s) === UI.viewSeat && !s.ask) { SV.hud.openActions(iid); return; }
    SV.inspector.open(c.evo ? s.cards[c.evo].id : c.id, iid);
  }
  UI.tapCard = tapBoardCard;

  // ---- the EX area: a public second hand ----------------------------------------------------
  function handSpec(s, iid, acts) {
    const plays = acts.filter(function (a) { return a.type === 'play' && a.iid === iid; });
    const others = acts.filter(function (a) { return a.type === 'activate' && a.iid === iid; });
    const targets = plays.map(function (a) { return { action: a, el: function () { return $('my-field'); } }; });
    return { targets: targets, plays: plays, others: others };
  }
  function renderEx(node, s, seat, isMine, acts) {
    node.textContent = '';
    const row = el('div', 'ex-row');
    const P = s.players[seat];
    P.ex.forEach(function (iid, i) {
      const card = SV.renderCard(iid, { size: 'board', state: s });
      card.tabIndex = 0;
      card.style.setProperty('--z', String(10 + i));
      const spec = isMine ? handSpec(s, iid, acts) : { targets: [], plays: [], others: [] };
      if (spec.plays.length || spec.others.length) markActable(card);
      askRole(s, card, iid);
      if (s.ask && s.ask.src === iid) card.classList.add('is-asker');
      card.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        Drag.begin(card, e, { kind: 'hand', iid: iid, targets: spec.targets, onTap: function () { tapBoardCard(iid); } });
      });
      card.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        tapBoardCard(iid);
      });
      row.appendChild(card);
    });
    row.style.setProperty('--n', String(Math.max(1, P.ex.length)));
    node.appendChild(row);
    node.classList.toggle('is-empty', P.ex.length === 0);
    node.appendChild(el('div', 'zone-badge zone-badge-corner', P.ex.length + '/' + P.exLimit));
  }

  // ---- hands --------------------------------------------------------------------------------
  function renderHand(s, viewer, acts) {
    const node = $('hand');
    node.textContent = '';
    const P = s.players[viewer];
    const myMove = acting(s) === viewer && UI.isHuman(viewer) && !s.ask && !SV.isTerminal(s);
    const myMain = myMove && s.phase === 'main' && s.active === viewer && !s.window;
    P.hand.forEach(function (iid, i) {
      const card = SV.renderCard(iid, { size: 'hand', state: s });
      card.tabIndex = 0;
      const spec = handSpec(s, iid, acts);
      if (spec.plays.length || spec.others.length) markActable(card);
      if (!spec.plays.length && myMain && SV.whyNot(s, iid)) card.classList.add('is-unaffordable');
      if (asking(s) && SV.asks.isCandidate(s, iid)) card.classList.add(SV.asks.isPicked(iid) ? 'role-picked' : 'role-target');
      if (s.ask && s.ask.src === iid) card.classList.add('is-asker');
      card.style.setProperty('--z', String(10 + i));
      card.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        Drag.begin(card, e, {
          kind: 'hand', iid: iid, targets: myMove ? spec.targets : [],
          onTap: function () {
            const st = UI.state;
            if (asking(st) && SV.asks.isCandidate(st, iid)) { SV.asks.toggle(st, iid, UI.answer); return; }
            if (myMove) { SV.hud.openActions(iid); return; }
            SV.inspector.open(st.cards[iid].id, iid);
          },
        });
      });
      card.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (myMove) SV.hud.openActions(iid); else SV.inspector.open(UI.state.cards[iid].id, iid);
      });
      node.appendChild(card);
    });
    node.style.setProperty('--n', String(P.hand.length));
    // Whether the row actually overlaps is a layout outcome: measured once, with a forced
    // synchronous read (never rAF, which stalls in a background tab).
    const cards = node.children;
    const over = cards.length > 1 && cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left <
      cards[0].getBoundingClientRect().width - 1;
    node.classList.toggle('is-fanned', over);
  }

  function renderEnemyHand(s, seat) {
    const node = $('enemy-hand');
    node.textContent = '';
    const hand = s.players[seat].hand;
    let anyOpen = false;
    hand.forEach(function (iid, i) {
      const open = SV.canSee(s, iid, UI.viewerKey());
      const card = open ? SV.renderCard(iid, { size: 'hand', state: s }) : SV.renderCard(null, { size: 'hand', hidden: true });
      if (open) { card.classList.add('is-revealed'); card.tabIndex = 0; anyOpen = true; }
      if (asking(s) && SV.asks.isCandidate(s, iid)) card.classList.add('role-target');
      card.style.setProperty('--z', String(10 + i));
      node.appendChild(card);
    });
    node.style.setProperty('--n', String(hand.length));
    $('enemy-hand-bar').classList.toggle('has-revealed', anyOpen);
    $('enemy-hand-bar').setAttribute('data-tip', UI.whose(seat) + ' hand: ' + hand.length + ' card' + (hand.length === 1 ? '' : 's'));
    $('enemy-hand-count').textContent = hand.length + ' in hand';
  }

  // ---- piles --------------------------------------------------------------------------------
  function pileStack(n, topNode) {
    const stack = el('div', 'pile-stack');
    const layers = Math.min(5, Math.floor(n / 6));
    for (let i = layers; i >= 1; i--) {
      const lay = el('div', 'pile-layer');
      lay.style.transform = 'translate(' + (i * -0.22) + 'cqw, ' + (i * -0.22) + 'cqw)';
      stack.appendChild(lay);
    }
    if (topNode) stack.appendChild(topNode);
    return stack;
  }
  function browsable(node, open) {
    node.classList.toggle('is-browsable', !!open);
    node.onclick = open ? function () { if (!Drag.justDragged()) open(); } : null;
    node.onkeydown = open ? function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : null;
    if (open) { node.tabIndex = 0; node.setAttribute('role', 'button'); } else { node.removeAttribute('tabindex'); node.removeAttribute('role'); }
  }
  function canLookAt(s, seat) {
    if (SV.isTerminal(s) || UI.mode === 'spectate') return true;
    return seat === (UI.viewSeat == null ? 0 : UI.viewSeat);
  }
  // A deck browses as a LIST sorted by cost then name with copies collapsed — never in deck
  // order, so looking through it cannot leak what you draw next.
  function deckList(s, iids) {
    const byId = {};
    iids.forEach(function (i) { const id = s.cards[i].id; byId[id] = (byId[id] || 0) + 1; });
    return Object.keys(byId).sort(function (a, b) {
      const A = SV.CARDS[a], B = SV.CARDS[b];
      return (A.cost || 0) - (B.cost || 0) || A.name.localeCompare(B.name);
    }).map(function (id) { return { cardNo: id, count: byId[id] }; });
  }

  function renderDeck(node, s, seat) {
    node.textContent = '';
    const P = s.players[seat];
    if (P.deck.length) node.appendChild(pileStack(P.deck.length, SV.renderCard(null, { size: 'board', hidden: true })));
    node.appendChild(el('div', 'zone-badge', String(P.deck.length)));
    node.setAttribute('data-tip', UI.whose(seat) + ' deck: ' + P.deck.length + ' cards' + (P.deck.length <= 5 ? ' — running low! Drawing from an empty deck loses.' : ''));
    node.classList.toggle('is-low', P.deck.length <= 5);
    browsable(node, canLookAt(s, seat) && P.deck.length ? function () {
      SV.zoneBrowser.open(UI.whose(seat) + ' deck', deckList(s, P.deck), 'Sorted by cost, copies collapsed — never in deck order.');
    } : null);
  }

  // The evolve deck: facedown cards are known to their owner only; used (faceup) ones are
  // public. Dragging your evolve deck onto a follower evolves it.
  function renderEvo(node, s, seat, isMine, acts) {
    node.textContent = '';
    const P = s.players[seat];
    const down = P.evoDeck.filter(function (i) { return !s.cards[i].faceup; });
    const up = P.evoDeck.filter(function (i) { return s.cards[i].faceup; });
    const top = down.length ? SV.renderCard(null, { size: 'board', hidden: true }) : (up.length ? SV.renderCard(up[up.length - 1], { size: 'board', state: s }) : null);
    if (top) node.appendChild(pileStack(P.evoDeck.length, top));
    const badge = el('div', 'zone-badge');
    badge.appendChild(U.glyph('evolve'));
    badge.appendChild(document.createTextNode(' ' + down.length + (up.length ? ' · ' + up.length + ' used' : '')));
    node.appendChild(badge);
    node.setAttribute('data-tip', UI.whose(seat) + ' evolve deck: ' + down.length + ' facedown, ' + up.length + ' used (faceup).' +
      (isMine ? ' Drag it onto a glowing follower to evolve that follower.' : ''));
    const evolves = isMine ? acts.filter(function (a) { return a.type === 'evolve'; }) : [];
    node.classList.toggle('role-actable', evolves.length > 0);
    if (evolves.length) node.style.animationDelay = U.animationPhase(1700);
    node.classList.toggle('is-draggable', evolves.length > 0);
    node.onpointerdown = evolves.length ? function (e) {
      if (e.button !== 0) return;
      Drag.begin(node, e, {
        kind: 'evolve', targets: evolves.map(function (a) { return { action: a, el: function () { return document.querySelector('#my-field .card' + iidSel(a.iid)); } }; }),
        onTap: function () { openEvo(); },
      });
    } : null;
    const viewer = UI.viewerKey();
    function openEvo() {
      const items = P.evoDeck.map(function (i) {
        const see = SV.canSee(s, i, viewer);
        return see ? { cardNo: s.cards[i].id, iid: i, label: s.cards[i].faceup ? 'used (faceup)' : 'facedown' } : null;
      }).filter(Boolean);
      const hidden = P.evoDeck.length - items.length;
      SV.zoneBrowser.open(UI.whose(seat) + ' evolve deck', items,
        hidden ? hidden + ' facedown card' + (hidden === 1 ? ' is' : 's are') + ' hidden from you.' : 'Facedown cards are known to their owner; used cards are public.');
    }
    browsable(node, P.evoDeck.length ? openEvo : null);
    if (evolves.length) node.onclick = null;       // the drag manager's tap opens the browser
  }

  function renderPile(node, s, seat, zone, acts) {
    node.textContent = '';
    const P = s.players[seat];
    const list = P[zone];
    if (list.length) node.appendChild(pileStack(list.length, SV.renderCard(list[0], { size: 'board', state: s })));
    node.appendChild(el('div', 'zone-badge', String(list.length)));
    const label = zone === 'cemetery' ? 'cemetery' : 'banished zone';
    node.setAttribute('data-tip', UI.whose(seat) + ' ' + label + ': ' + list.length + ' card' + (list.length === 1 ? '' : 's') + '.');
    // Activated abilities that work from the cemetery: the pile glows; its browser offers them.
    const usable = acts.filter(function (a) { return a.type === 'activate' && s.cards[a.iid] && s.cards[a.iid].zone === zone && s.cards[a.iid].owner === seat; });
    node.classList.toggle('role-actable', usable.length > 0);
    if (usable.length) node.style.animationDelay = U.animationPhase(1700);
    browsable(node, list.length ? function () {
      SV.zoneBrowser.open(UI.whose(seat) + ' ' + label, list.map(function (i) {
        const has = usable.some(function (a) { return a.iid === i; });
        return { cardNo: s.cards[i].id, iid: i, actable: has, onClick: has ? function () { SV.hud.openActions(i); } : null };
      }), 'Newest first.' + (usable.length ? ' Glowing cards have an ability you can use now.' : ''));
    } : null);
  }

  // ---- play points, evolution points, the super-evolution point ---------------------------
  function renderPoints(node, s, seat, isMine) {
    node.textContent = '';
    const P = s.players[seat];
    const pp = el('div', 'pts-pp');
    const head = el('div', 'pts-head');
    head.appendChild(el('span', 'pts-big', String(P.pp)));
    head.appendChild(el('span', 'pts-of', '/' + P.maxPP));
    head.appendChild(el('span', 'pts-label', 'play points'));
    pp.appendChild(head);
    const pips = el('div', 'pts-pips');
    for (let i = 1; i <= 10; i++) {
      const g = el('span', 'pip' + (i <= P.pp ? ' is-full' : i <= P.maxPP ? ' is-spent' : ' is-locked'));
      g.innerHTML = U.glyphSVG('pp');
      pips.appendChild(g);
    }
    pp.appendChild(pips);
    pp.setAttribute('data-tip', P.pp + ' of ' + P.maxPP + ' play points left this turn. The maximum grows by 1 each turn, up to 10.');
    node.appendChild(pp);
    const row = el('div', 'pts-row');
    const ep = el('div', 'pts-ep');
    ep.appendChild(el('span', 'pts-sub', 'Evolve'));
    const orbs = el('span', 'pts-orbs');
    for (let i = 0; i < Math.max(P.ep, 0); i++) { const o = el('span', 'orb'); o.innerHTML = U.glyphSVG('ep'); orbs.appendChild(o); }
    if (!P.ep) orbs.appendChild(el('span', 'pts-none', '0'));
    ep.appendChild(orbs);
    ep.setAttribute('data-tip', P.ep + ' evolution point' + (P.ep === 1 ? '' : 's') + ': each can pay 1 play point of an evolve cost.');
    row.appendChild(ep);
    const sep = el('div', 'pts-sep' + (P.sep > 0 ? ' is-held' : ' is-spent') + (SV.superEvolveOK(s, seat) ? ' is-ready' : ''));
    const star = el('span', 'sep-star');
    star.innerHTML = U.glyphSVG('sep');
    sep.appendChild(star);
    const need = seat === s.first ? 7 : 6;
    sep.appendChild(el('span', 'pts-sub', SV.superEvolveOK(s, seat) ? 'Super ready' : P.sep > 0 ? 'Super · turn ' + need : 'Super used'));
    sep.setAttribute('data-tip', P.sep > 0 ? 'Super-evolution point: usable from this player’s ' + need + 'th turn (' + P.turnsPassed + ' so far) when evolving.' : 'The super-evolution point has been spent.');
    row.appendChild(sep);
    node.appendChild(row);
    // Class conditions, read from the engine's predicates (CR 13).
    const chips = el('div', 'pts-chips');
    if (SV.overflow(s, seat)) chips.appendChild(el('span', 'chip', 'Overflow'));
    if (SV.sanguine(s, seat)) chips.appendChild(el('span', 'chip is-blood', 'Sanguine'));
    if (s.active === seat && SV.combo(s, seat)) chips.appendChild(el('span', 'chip', 'Combo ' + SV.combo(s, seat)));
    if (chips.childNodes.length) node.appendChild(chips);
  }

  // ---- the turn bar and the Quick window ------------------------------------------------------
  function renderTurnBar(s, acts, mine) {
    const bar = $('turn-bar');
    bar.textContent = '';
    const left = el('div', 'turn-left');
    if (SV.isTerminal(s)) {
      const won = s.winner;
      left.appendChild(el('span', 'turn-result', won === 'draw' ? 'A draw.' : UI.vsAI() ? (won === 0 ? 'Victory!' : 'Defeat.') : UI.names[won] + ' wins!'));
      bar.appendChild(left);
      const r = el('button', 'action-btn', 'Results');
      r.onclick = function () { SV.hud.showResults(UI.state); };
      bar.appendChild(r);
      return;
    }
    const who = s.active;
    const phase = { mulligan: 'Opening hands', start: 'start phase', main: 'main phase', end: 'end phase' }[s.phase] || s.phase;
    const dealt = s.log.some(function (l) { return l.type === 'start'; });
    const label = s.phase === 'mulligan' ? (dealt ? 'Opening hands' : 'Deciding who goes first') :
      'Turn ' + s.turn + ' · ' + (UI.vsAI() ? (who === 0 ? 'Your turn' : 'Opponent’s turn') : UI.names[who] + '’s turn') + ' · ' + phase;
    left.appendChild(el('span', 'turn-label', label));
    bar.appendChild(left);

    const mid = el('div', 'turn-mid');
    if (mine && !s.ask && s.window) {
      const pass = acts.find(function (a) { return a.type === 'pass'; });
      const b = el('button', 'action-btn end-turn', 'No response');
      b.onclick = function () { UI.doAction(pass); };
      mid.appendChild(b);
    } else if (mine && !s.ask && s.phase === 'main') {
      const end = acts.find(function (a) { return a.type === 'end'; });
      const btn = el('button', 'action-btn end-turn', 'End turn');
      if (end) {
        btn.onclick = function () { UI.doAction(end); };
        const actable = {};
        acts.forEach(function (a) { if (a.type !== 'end') actable[a.iid] = 1; });
        const n = Object.keys(actable).length;
        if (n) mid.appendChild(el('span', 'turn-hint', n + ' card' + (n === 1 ? '' : 's') + ' can still act'));
      } else {
        btn.disabled = true;
        const blocker = SV.endBlocker(s);
        const why = blocker != null ? nm(s, blocker) + ' must attack before you can end your turn.' : 'You can’t end your turn yet.';
        btn.setAttribute('data-tip', why);
        mid.appendChild(el('span', 'turn-why', why));
      }
      mid.insertBefore(btn, mid.firstChild);
    } else if (!mine && !SV.isTerminal(s)) {
      const w = acting(s);
      if (UI.seats[w] === 'ai') mid.appendChild(el('span', 'turn-wait', (UI.mode === 'spectate' ? UI.names[w] : 'The opponent') + ' is ' + (s.ask ? 'choosing' : s.window ? 'deciding whether to respond' : 'playing') + '…'));
    }
    bar.appendChild(mid);

    const right = el('div', 'turn-right');
    if (UI.mode === 'spectate') {
      const pause = el('button', null, UI.paused ? 'Resume' : 'Pause');
      pause.onclick = function () { UI.setPaused(!UI.paused); };
      right.appendChild(pause);
      const step = el('button', null, 'Step');
      step.disabled = !UI.paused;
      step.setAttribute('data-tip', 'Play the next bot action (while paused).');
      step.onclick = UI.stepOnce;
      right.appendChild(step);
      const lab = el('label', 'speed');
      lab.appendChild(document.createTextNode('Speed '));
      const r = el('input');
      r.type = 'range'; r.min = '0'; r.max = '4'; r.step = '1';
      const SPEEDS = [2.2, 1.5, 1, 0.6, 0.3];
      r.value = String(Math.max(0, SPEEDS.indexOf(UI.speed)));
      r.oninput = function () { UI.speed = SPEEDS[Number(r.value)]; SV.anim.setSpeed(UI.speed); };
      lab.appendChild(r);
      right.appendChild(lab);
    } else if (UI.paused && !SV.isTerminal(s)) {
      const res = el('button', null, 'Resume the AI');
      res.onclick = function () { UI.setPaused(false); };
      right.appendChild(res);
    }
    bar.appendChild(right);
  }

  // The Quick window prompt: what is happening, what you can answer with, and No response.
  function renderWindow(s, acts, mine) {
    const node = $('window-prompt');
    if (!s.window || s.ask || !mine || SV.isTerminal(s)) { node.classList.remove('open'); node.textContent = ''; return; }
    node.textContent = '';
    const box = el('div', 'window-box');
    const head = el('div', 'window-head');
    head.appendChild(U.glyph('quick'));
    head.appendChild(el('span', null, s.window.kind === 'attack' ? 'Quick — respond to the attack?' : 'Quick — respond in their end phase?'));
    box.appendChild(head);
    box.appendChild(el('div', 'window-text', UI.windowText(s)));
    const opts = acts.filter(function (a) { return a.type !== 'pass'; });
    const list = el('div', 'window-opts');
    opts.forEach(function (a) {
      const b = el('button', 'action-btn', UI.actionLabel(s, a));
      b.onclick = function () { UI.doAction(a); };
      hintOn(b, a.iid);
      list.appendChild(b);
    });
    if (opts.length) box.appendChild(list);
    const pass = acts.find(function (a) { return a.type === 'pass'; });
    const no = el('button', 'action-btn is-secondary window-pass', 'No response');
    no.onclick = function () { UI.doAction(pass); };
    box.appendChild(no);
    node.appendChild(box);
    node.classList.add('open');
    const b = SV.asks.playBox();
    if (b) { box.style.left = b.cx + 'px'; box.style.top = b.cy + 'px'; }
  }

  // Re-anchor overlays and re-measure the fan when the window changes size.
  let resizeT = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (UI.state && !SV.anim.busy()) UI.render(); }, 120);
  });
})();
