// js/ui/tutorial.js — a guided vs-AI game (PLAN D7). Coach bubbles are triggered by game
// SITUATIONS (not by a script of turns), each shown once, pointing at the part of the table it
// explains. Skippable at any time; never blocks a click on the board. Every predicate reads
// legalActions or the engine's own readers, so a bubble only appears when the move is real.
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;
  const el = U.el, $ = U.$;

  let on = false, shown = {}, current = null;

  function mine(s) { return s.active === 0 && s.phase === 'main' && !s.ask && !s.window; }
  function has(acts, pred) { return acts.some(pred); }
  function typeOf(s, iid) { return U.typeOf(s.cards[iid].id); }

  // Order matters: the first unshown step whose predicate holds is the one shown.
  const STEPS = [
    { id: 'mulligan', anchor: 'hand-bar',
      when: function (s) { return s.ask && s.ask.kind === 'mulligan' && s.ask.who === 0; },
      text: 'Welcome to the arena! This is your opening hand of four. Keep it, or put all four on the bottom of your deck and draw four new ones (once). Cheap followers (cost 1–3) make a good start.' },
    { id: 'points', anchor: 'my-points',
      when: function (s) { return mine(s); },
      text: 'Play points pay for cards. You start at 1 maximum and gain 1 more every turn, up to 10; they refill at the start of each of your turns. The cost is the jewel in a card’s corner.' },
    { id: 'play', anchor: 'my-field',
      when: function (s, acts) { return mine(s) && has(acts, function (a) { return a.type === 'play' && typeOf(s, a.iid) === 'follower'; }); },
      text: 'Play a follower: drag a glowing card from your hand onto your field. Your field holds five followers and amulets.' },
    { id: 'fresh', anchor: 'my-field',
      when: function (s) { return mine(s) && s.players[0].field.some(function (i) { return s.cards[i].enteredTurn === s.turn && SV.isFollower(s, i) && !SV.canAttackWith(s, i); }); },
      text: 'A follower can’t attack the turn it arrives (Storm and Rush are the exceptions). When you have nothing else to do, click End turn.' },
    { id: 'opponent', anchor: 'log-handle',
      when: function (s) { return s.active === 1 && s.phase === 'main'; },
      text: 'The opponent’s turn. Everything they play is spotlighted and written in the log — open the drawer on the right edge any time. Hover any card to read it.' },
    { id: 'quick', anchor: 'hand-bar',
      when: function (s) { return s.window && s.window.who === 0 && !s.ask; },
      text: 'A Quick window! The opponent declared an attack (or reached their end phase) and you hold a Quick card or ability. Use it now, or choose No response.' },
    { id: 'attack', anchor: 'enemy-leader',
      when: function (s, acts) { return mine(s) && has(acts, function (a) { return a.type === 'attack'; }); },
      text: 'Attack! Drag a glowing follower onto the enemy leader to deal its attack to their defense — or onto an ENGAGED (sideways) enemy follower: both deal damage to each other at once, and a follower whose defense reaches 0 is destroyed.' },
    { id: 'evolve', anchor: 'my-evo',
      when: function (s, acts) { return mine(s) && has(acts, function (a) { return a.type === 'evolve'; }); },
      text: 'You can evolve! Drag your evolve deck onto a glowing follower (or tap the follower). Pay its evolve cost — an evolution point can pay 1 — and it becomes its evolved card: bigger, with On Evolve abilities. Once per turn.' },
    { id: 'ward', anchor: 'enemy-field',
      when: function (s) { return mine(s) && SV.followers(s, 1).some(function (i) { return s.cards[i].engaged && SV.chars(s, i).kw.Ward; }); },
      text: 'Ward: the opponent has an engaged Ward follower, so your attacks must target it first. Clear it to reach the leader.' },
    { id: 'exposed', anchor: 'my-field',
      when: function (s) { return s.active === 1 && s.phase === 'main' && s.players[0].field.some(function (i) { return s.cards[i].engaged && SV.isFollower(s, i); }); },
      text: 'Attacking engaged your followers, and engaged followers can be attacked. They refresh at the start of your next turn — attacking is a trade between damage now and safety.' },
    { id: 'ex', anchor: 'my-ex',
      when: function (s, acts) { return mine(s) && has(acts, function (a) { return a.type === 'play' && s.cards[a.iid].zone === 'ex'; }); },
      text: 'Your EX area is a second, public hand: cards there are played just like hand cards (drag them onto your field).' },
    { id: 'super', anchor: 'my-points',
      when: function (s) { return mine(s) && SV.superEvolveOK(s, 0); },
      text: 'Your super-evolution point is ready. The next time you evolve you will be asked whether to super-evolve: +1/+1 and On Super-Evolve abilities.' },
    { id: 'race', anchor: 'enemy-leader',
      when: function (s) { return Math.min(s.players[0].defense, s.players[1].defense) <= 10; },
      text: 'A leader is down to 10 defense or less — the music rises as leaders fall. Count the attack on the board each turn: lethal is attack total against defense.' },
  ];

  function bubble(step) {
    const b = $('coach');
    b.textContent = '';
    b.appendChild(el('div', 'coach-title', 'Tutorial'));
    b.appendChild(el('div', 'coach-text', step.text));
    const row = el('div', 'coach-buttons');
    const ok = el('button', 'action-btn', 'Got it');
    ok.onclick = function () { hide(); };
    const skip = el('button', null, 'Skip tutorial');
    skip.onclick = function () { SV.tutorial.end(); };
    row.appendChild(ok); row.appendChild(skip);
    b.appendChild(row);
    b.classList.add('open');
    const a = $(step.anchor);
    const r = a && a.getBoundingClientRect();
    const bw = b.offsetWidth, bh = b.offsetHeight;
    let left = window.innerWidth / 2 - bw / 2, top = window.innerHeight * 0.3;
    if (r && r.width) {
      left = Math.max(10, Math.min(r.left + r.width / 2 - bw / 2, window.innerWidth - bw - 10));
      top = r.top - bh - 14;
      if (top < 10) top = Math.min(window.innerHeight - bh - 10, r.bottom + 14);
    }
    top = Math.max(10, Math.min(top, window.innerHeight - bh - 10));
    b.style.left = left + 'px'; b.style.top = top + 'px';
    current = step.id;
  }
  function hide() { const b = $('coach'); if (b) b.classList.remove('open'); current = null; SV.ui.render(); }

  SV.tutorial = {
    begin: function () { on = true; shown = {}; current = null; },
    end: function () { on = false; current = null; const b = $('coach'); if (b) b.classList.remove('open'); },
    active: function () { return on; },
    onRender: function (s, acts) {
      if (!on || SV.isTerminal(s)) { if (SV.isTerminal(s)) SV.tutorial.end(); return; }
      if (current) return;                     // one bubble at a time; it waits for "Got it"
      for (let i = 0; i < STEPS.length; i++) {
        const st = STEPS[i];
        if (shown[st.id]) continue;
        // A predicate that throws is a bug in this file: let it surface (CLAUDE.md rule 5).
        if (st.when(s, acts)) {
          shown[st.id] = true;
          current = st.id;                       // reserve the slot; the bubble lands a beat later
          setTimeout(function () { if (on && current === st.id) bubble(st); }, 450);
          return;
        }
      }
    },
  };
})();
