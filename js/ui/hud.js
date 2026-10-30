// js/ui/hud.js — the chrome around the board (PRESENTATION-REFERENCE A7): the log drawer and
// its controls, the turn banner (every turn — Evolve's turns alternate cleanly, so per-turn
// does not strobe), the card action popover, the hot-seat curtain, How to play and the results
// panel. None of it is game state.
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;
  const el = U.el, $ = U.$;

  let drawerOpen = false;
  let bannerKey = null;
  let popoverFor = null;
  let curtainFor = null, curtainCb = null;
  let finished = false;

  function setDrawer(on) {
    drawerOpen = on;
    document.body.classList.toggle('drawer-open', on);
    $('log-handle').setAttribute('aria-expanded', String(on));
  }

  function syncControls() {
    const m = $('mute-btn');
    m.textContent = SV.sound.isMuted() ? 'Sound: off' : 'Sound: on';
    m.classList.toggle('is-muted', SV.sound.isMuted());
    const a = $('anim-btn');
    const mode = SV.anim.mode();
    a.textContent = 'Animations: ' + mode;
    $('volume').value = String(Math.round(SV.sound.volume() * 100));
    const ui = SV.ui;
    const live = ui.state && !SV.isTerminal(ui.state) && ui.humanSeatForConcede() != null;
    $('concede-btn').disabled = !live;
    $('new-game-btn').textContent = live ? 'New game (concedes)' : 'New game';
  }

  // ---- banner -------------------------------------------------------------------------------
  // A forged blade of light across the middle: "Your turn · Turn 4".
  function showBanner(main, sub) {
    const node = $('turn-banner');
    node.textContent = '';
    const band = el('div', 'banner-band');
    band.appendChild(el('span', 'turn-banner-main', main));
    if (sub) band.appendChild(el('span', 'turn-banner-sub', sub));
    node.appendChild(band);
    node.classList.remove('show');
    void node.offsetWidth;                  // restart the keyframes on a node mid-fade
    node.classList.add('show');
  }
  function maybeBanner(s) {
    if (SV.isTerminal(s) || s.phase !== 'main') return;
    const key = s.turn + ':' + s.active;
    if (key === bannerKey) return;
    bannerKey = key;
    const ui = SV.ui;
    const main = ui.vsAI() ? (s.active === 0 ? 'Your turn' : 'Opponent’s turn') : ui.names[s.active] + '’s turn';
    const P = s.players[s.active];
    showBanner(main, 'Turn ' + s.turn + ' · ' + P.maxPP + ' play point' + (P.maxPP === 1 ? '' : 's'));
    SV.sound.sfx('turn');
  }

  // ---- the action popover ---------------------------------------------------------------------
  // A tap on your own card asks what to do with it ON that card, enlarged, one button per legal
  // action, each saying what it does with its numbers. The engine's reasons are shown too, so a
  // card that can't act explains itself instead of looking broken.
  function reasons(s, iid) {
    const out = [];
    const c = s.cards[iid];
    if (c.zone === 'hand' || c.zone === 'ex') {
      const why = SV.whyNot(s, iid);
      if (why) out.push('Play: ' + why);
    }
    if (c.zone === 'field' && SV.isFollower(s, iid) && c.ctrl === s.active && !s.window) {
      const ch = SV.chars(s, iid);
      if (c.engaged) out.push('Engaged: it can’t attack until it refreshes at the start of your next turn.');
      else if (ch.flags.cantAttack) out.push('It can’t attack.');
      else if (!SV.canAttackWith(s, iid)) out.push('Arrived this turn: it can attack from your next turn (Storm or Rush would let it attack now).');
      else if (!SV.legalActions(s).some(function (a) { return a.type === 'attack' && a.iid === iid; })) {
        out.push('No target: only engaged enemy followers can be attacked (reserved ones need Assail), an engaged Ward follower must be attacked first, and a follower that arrived this turn can’t attack the leader.');
      }
      const info = SV.evolveInfo(s, iid);
      if (info && !SV.canEvolve(s, iid)) {
        // Read off the engine's own state; the engine has no whyNotEvolve (docs/UI.md).
        const p = c.ctrl;
        if (s.ti.evolveUsed[p]) out.push('Evolve: you already evolved (or used an evolve-like ability) this turn.');
        else if (!SV.evolveCandidates(s, iid).length) out.push('Evolve: no matching evolved card is left in your evolve deck.');
        else out.push('Evolve: needs ' + info.cost + ' play point' + (info.cost === 1 ? '' : 's') + ' (an evolution point can pay 1).');
      }
    }
    if (c.zone !== 'deck' && c.zone !== 'evoDeck') {
      SV.chars(s, iid).activated.forEach(function (ab) {
        if (!ab.usable && ab.why) out.push((ab.text.length > 60 ? ab.text.slice(0, 57) + '…' : ab.text) + ' — ' + ab.why);
      });
    }
    return out;
  }
  function openActions(iid) {
    const ui = SV.ui, s = ui.state;
    SV.preview.hide();
    const acts = SV.legalActions(s).filter(function (a) { return a.iid === iid && a.type !== 'end' && a.type !== 'pass'; });
    const node = $('action-popover');
    node.textContent = '';
    const box = el('div', 'pop-box');
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    const c = s.cards[iid];
    box.appendChild(el('div', 'pop-title', SV.def(iid, s).name));
    const body = el('div', 'pop-body');
    body.appendChild(SV.preview.face(c.evo ? s.cards[c.evo].id : c.id, iid, s));
    const btns = el('div', 'pop-buttons');
    const order = { play: 1, evolve: 2, activate: 3, attack: 4 };
    acts.sort(function (a, b) { return (order[a.type] || 9) - (order[b.type] || 9); });
    acts.forEach(function (a) {
      const b = el('button', 'action-btn', ui.actionLabel(s, a));
      b.onclick = function () { close(); ui.doAction(a); };
      ui.hintOn(b, a.target != null ? a.target : null);
      btns.appendChild(b);
    });
    if (!acts.length) btns.appendChild(el('div', 'pop-empty', 'Nothing to do with this card right now.'));
    const why = reasons(s, iid);
    if (why.length) {
      const w = el('div', 'pop-why');
      why.forEach(function (t) { w.appendChild(el('div', null, t)); });
      btns.appendChild(w);
    }
    if (acts.some(function (a) { return a.type === 'attack'; })) {
      btns.appendChild(el('div', 'pop-tip', 'Tip: drag this follower onto a glowing enemy follower or the enemy leader to attack.'));
    } else if ((c.zone === 'hand' || c.zone === 'ex') && acts.some(function (a) { return a.type === 'play'; })) {
      btns.appendChild(el('div', 'pop-tip', 'Tip: drag the card onto your field to play it.'));
    }
    const cl = el('button', 'peek-btn', 'Close');
    cl.onclick = close;
    btns.appendChild(cl);
    body.appendChild(btns);
    box.appendChild(body);
    node.appendChild(box);
    node.classList.add('open');
    node.onclick = close;
    popoverFor = iid;
  }
  function close() {
    popoverFor = null;
    const node = $('action-popover');
    node.classList.remove('open');
    node.textContent = '';
    SV.ui.hint(null);
  }

  // ---- hot-seat curtain ------------------------------------------------------------------------
  function curtain(seat, cb) {
    const node = $('curtain');
    if (seat == null) { curtainFor = null; node.classList.remove('open'); return; }
    if (curtainFor === seat && node.classList.contains('open')) { curtainCb = cb; return; }
    curtainFor = seat; curtainCb = cb;
    node.textContent = '';
    const box = el('div', 'curtain-box');
    const s = SV.ui.state;
    box.appendChild(el('div', 'curtain-title', 'Pass the device to ' + SV.ui.names[seat]));
    // Before the deal (no 'start' entry yet) the only question is who goes first (CR 6.2.1.6).
    const dealt = s.log.some(function (l) { return l.type === 'start'; });
    const what = s.ask ? (!dealt ? 'to decide who goes first' : s.ask.kind === 'mulligan' ? 'to choose their opening hand' : 'to answer a choice')
      : s.window ? 'to respond (Quick): ' + SV.ui.windowText(s) : 'for their turn';
    box.appendChild(el('div', 'curtain-sub', SV.ui.names[seat] + ', click when you are ready ' + what + (/[.!?]$/.test(what) ? '' : '.') + ' Your hand is hidden until then.'));
    const b = el('button', 'action-btn', 'I’m ' + SV.ui.names[seat] + ' — show my hand');
    b.onclick = function () { node.classList.remove('open'); curtainFor = null; const f = curtainCb; curtainCb = null; if (f) f(); };
    box.appendChild(b);
    node.appendChild(box);
    node.classList.add('open');
    b.focus();
  }

  // ---- results -----------------------------------------------------------------------------------
  function stats(s) {
    const out = [0, 1].map(function (p) { return { def: s.players[p].defense, dealt: 0, played: 0, evolved: 0, best: null, by: {} }; });
    s.log.forEach(function (l) {
      if (l.type === 'damage' && l.leader && l.amount > 0 && s.cards[l.iid]) {
        const victim = s.cards[l.iid].owner, dealer = 1 - victim;
        out[dealer].dealt += l.amount;
        if (l.src != null && s.cards[l.src] && s.cards[l.src].owner === dealer) out[dealer].by[l.src] = (out[dealer].by[l.src] || 0) + l.amount;
      }
      if (l.type === 'play' && l.who != null) out[l.who].played++;
      if (l.type === 'evolve' && l.who != null) out[l.who].evolved++;
    });
    out.forEach(function (o) {
      Object.keys(o.by).forEach(function (iid) { if (!o.best || o.by[iid] > o.best.n) o.best = { iid: iid, n: o.by[iid] }; });
    });
    return out;
  }
  function showResults(s) {
    const node = $('results');
    node.textContent = '';
    const ui = SV.ui;
    const vs = ui.vsAI();
    const box = el('div', 'results-box');
    const won = s.winner;
    const draw = won === 'draw';
    const title = draw ? 'Stalemate' : vs ? (won === 0 ? 'Victory' : 'Defeat') : ui.names[won] + ' wins';
    const art = SV.uiArtUrl(draw ? 'defeat' : vs ? (won === 0 ? 'victory' : 'defeat') : 'victory');
    if (art) box.style.setProperty('--results-art', 'url("' + art + '")');
    box.appendChild(el('div', 'results-kicker', draw ? 'both leaders fell' : vs && won !== 0 ? 'the arena falls silent' : 'the arena is yours'));
    box.appendChild(el('div', 'results-title' + (vs && won !== 0 ? ' is-loss' : ''), title));
    const why = { defense: 'brought the other leader’s defense to 0', deckout: 'won when the other player had to draw from an empty deck',
      concede: 'won by concession', effect: 'won by a card’s effect', both: 'tied' }[s.endReason] || '';
    if (!draw) box.appendChild(el('div', 'results-sub', (vs ? (won === 0 ? 'You ' : 'The opponent ') : ui.names[won] + ' ') + why + ' on turn ' + s.turn + '.'));
    const st = stats(s);
    const table = el('div', 'results-table');
    [0, 1].forEach(function (p) {
      const col = el('div', 'results-col' + (p === won ? ' is-winner' : ''));
      col.appendChild(el('div', 'results-name', (vs ? (p === 0 ? 'You' : 'Opponent') : ui.names[p]) + ' · ' + s.players[p].deckName));
      col.appendChild(el('div', 'results-def', String(st[p].def)));
      col.appendChild(el('div', 'results-meta', 'defense left · dealt ' + st[p].dealt + ' to the leader · ' + st[p].played + ' cards played · ' + st[p].evolved + ' evolved'));
      if (st[p].best && s.cards[st[p].best.iid]) {
        const b = el('div', 'results-best');
        b.appendChild(document.createTextNode('Top striker: '));
        const r = el('span', 'card-ref', SV.CARDS[s.cards[st[p].best.iid].id].name);
        r.dataset.cardId = s.cards[st[p].best.iid].id;
        b.appendChild(r);
        b.appendChild(document.createTextNode(' (' + st[p].best.n + ' to the leader)'));
        col.appendChild(b);
      }
      table.appendChild(col);
    });
    box.appendChild(table);
    box.appendChild(el('div', 'results-note', 'Every hand and evolve deck is now face up — close this to read the board back.'));
    const row = el('div', 'results-buttons');
    const re = el('button', 'action-btn', 'Rematch (same decks)');
    re.onclick = function () { node.classList.remove('open'); ui.rematch(); };
    const ng = el('button', 'action-btn', 'New game');
    ng.onclick = function () { node.classList.remove('open'); SV.title.openPicker(); };
    const lk = el('button', null, 'Look at the board');
    lk.onclick = function () { node.classList.remove('open'); };
    row.appendChild(re); row.appendChild(ng); row.appendChild(lk);
    box.appendChild(row);
    node.appendChild(box);
    node.classList.add('open');
  }

  // ---- how to play --------------------------------------------------------------------------------
  const HELP = [
    ['Goal', 'Bring the enemy leader’s defense from 20 to 0. You also lose if you must draw from an empty deck.'],
    ['Your turn', 'Your maximum play points grow by 1 (up to 10) and refill, your engaged cards refresh, and you draw a card (the first player skips the very first draw). Then act in any order and click End turn.'],
    ['Playing cards', 'Drag a card from your hand — or from your EX area, a second, public hand — onto your field (or tap it and pick Play). It costs the play points on its jewel. Your field holds 5 followers and amulets; spells resolve and go to the cemetery.'],
    ['Attacking', 'Drag a follower onto a target. It must have been on the field since the start of your turn (Storm and Rush excepted). It can attack the enemy leader, or an ENGAGED (sideways) enemy follower; Assail reaches upright ones. Attacking engages your follower. Followers fight simultaneously: each deals its attack to the other’s defense.'],
    ['Ward', 'If the opponent has an engaged Ward follower, your attacks must target one of those first. A Ward follower may enter engaged, and may engage at the end of its controller’s turn.'],
    ['Evolving', 'Once per turn, drag your evolve deck onto a glowing follower (or tap it and pick Evolve). Pay its evolve cost; an evolution point (the second player starts with 3) can pay 1 of it. The evolved card goes on top: bigger stats and On Evolve abilities. A follower that evolves the turn it arrives may attack engaged followers at once. From your 7th turn (6th going second) your one super-evolution point can super-evolve: +1/+1 more.'],
    ['Quick', 'Cards and abilities with the lightning mark can be used on the opponent’s turn: right after they declare an attack, or in their end phase. When you get that chance a panel says what is happening; play a glowing Quick card, or choose No response.'],
    ['Reading the table', 'Hover any face-up card for its full text, keyword help and the engine’s reasons it can’t act. Click a cemetery, banished zone, your deck or an evolve deck to look through it. The log drawer on the right edge says everything that happened.'],
  ];
  function openHelp() {
    const node = $('help');
    node.textContent = '';
    const box = el('div', 'help-box');
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    const head = el('div', 'help-head');
    head.appendChild(el('h2', null, 'How to play'));
    const x = el('button', null, 'Close');
    x.onclick = function () { node.classList.remove('open'); };
    head.appendChild(x);
    box.appendChild(head);
    const body = el('div', 'help-body');
    HELP.forEach(function (h) { body.appendChild(el('h3', null, h[0])); body.appendChild(el('p', null, h[1])); });
    box.appendChild(body);
    node.appendChild(box);
    node.onclick = function () { node.classList.remove('open'); };
    node.classList.add('open');
  }

  function saveReport() {
    const ui = SV.ui;
    if (!ui.trace) return;
    const t = Object.assign({}, ui.trace, { saved: new Date().toISOString(), log: ui.state ? ui.state.log : [] });
    // The file carries ids only (safe to paste anywhere).
    const blob = new Blob([JSON.stringify(t, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'shadowforge-trace-' + Date.now() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  SV.hud = {
    init: function () {
      $('log-handle').onclick = function () { setDrawer(!drawerOpen); };
      $('side-close').onclick = function () { setDrawer(false); };
      $('mute-btn').onclick = function () { SV.sound.toggleMute(); syncControls(); };
      $('volume').oninput = function () { SV.sound.setVolume(Number(this.value) / 100); };
      $('anim-btn').onclick = function () { SV.anim.cycleMode(); syncControls(); };
      $('new-game-btn').onclick = function () {
        setDrawer(false);
        const ui = SV.ui;
        if (ui.state && !SV.isTerminal(ui.state)) {
          const seat = ui.humanSeatForConcede();
          if (seat != null) ui.concede(seat);
        }
        $('results').classList.remove('open');
        SV.title.openPicker();
      };
      $('concede-btn').onclick = function () {
        const ui = SV.ui;
        const seat = ui.humanSeatForConcede();
        if (seat == null || !ui.state || SV.isTerminal(ui.state)) return;
        setDrawer(false);
        ui.concede(seat);
      };
      $('help-btn').onclick = openHelp;
      $('report-btn').onclick = saveReport;
      $('turn-banner').onclick = function () { this.classList.remove('show'); };
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        const modal = $('choice-modal');
        if (modal && modal.classList.contains('open')) return;   // Esc is the modal's peek
        if (popoverFor != null) { close(); return; }
        if ($('help').classList.contains('open')) { $('help').classList.remove('open'); return; }
        if (drawerOpen) setDrawer(false);
      });
      syncControls();
      setDrawer(false);
    },
    reset: function () { bannerKey = null; finished = false; close(); $('results').classList.remove('open'); setDrawer(false); },
    render: function (s) {
      maybeBanner(s);
      if (popoverFor != null && (!s.cards[popoverFor] || SV.whoActs(s) !== SV.ui.viewSeat)) close();
      syncControls();
      SV.sound.match(s);
    },
    openActions: openActions,
    closeActions: close,
    curtain: curtain,
    showResults: showResults,
    openHelp: openHelp,
    // The match just ended (after its finale played): music, then the results panel.
    finish: function (s) {
      if (finished) return;
      finished = true;
      const ui = SV.ui;
      SV.sound.ending(ui.vsAI() ? s.winner === 0 : true);
      setTimeout(function () { if (SV.ui.state === s) showResults(s); }, 700);
    },
    setDrawer: setDrawer,
  };
})();
