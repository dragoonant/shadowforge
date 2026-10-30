// js/ui/anim.js — the animation layer (PRESENTATION-REFERENCE A8). Two halves:
//
//   plan(prev, next, fresh) — PURE. Turns the log entries one apply added into steps. No DOM,
//     no clock; safe to run headless.
//   run(steps, next, ctx, done) — DOM. Plays the steps on the OLD board (the caller has not
//     rendered `next` yet, so a destroyed follower is still on screen to leave), patches the
//     numbers in place at each impact so the later redraw changes nothing, then hands control
//     back. Input is locked under #fx-lock meanwhile; any click or key skips.
//
// Evolve's fights are simultaneous (CR 8.4.9.1): the attacker lunges and BOTH damage numbers
// land on one impact beat. An attack that opens a Quick window is drawn in two halves: the
// declaration (engage + the red arrow, which stays up while the window is open), then the
// clash once the window closes. Ability damage is a bolt in the source's class colour; a leader
// hit shakes the arch and floats a big number; a follower leaving dissolves into embers that
// fly to where it went; evolving is a burst of light; a leader at 0 shatters.
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;
  const el = U.el, $ = U.$;

  const D = {
    engage: 200,     // the quarter-turn before the attack it pays for
    lunge: 480, recoil: 380,
    travel: 520,     // a bolt in the air
    impact: 460,
    evolve: 760,
    beatGap: 180,
    leaveHold: 320, leaveFly: 850,
    discardFly: 650,
    spotWait: 700,   // let a spotlight land before anything fires from it
    finaleCharge: 600, finaleBoom: 1500, finaleHold: 1000,
  };
  const RATE = { full: 1, quick: 0.45, off: 0 };
  const LEAVE = { destroy: 'cemetery', bury: 'cemetery', banish: 'banished', leave: null, return: 'hand', toEx: 'ex', toDeck: 'deck' };

  // ======================= planning (pure) =======================
  function cardOf(prev, next, iid) { return (prev.cards && prev.cards[iid]) || (next.cards && next.cards[iid]) || null; }
  function clsColor(prev, next, iid) {
    const c = iid != null ? cardOf(prev, next, iid) : null;
    const d = c && SV.CARDS[c.id];
    return d ? U.classOf(d.cls).text : '#ffd9a0';
  }
  function wasOnField(prev, iid) { const c = prev.cards[iid]; return !!(c && c.zone === 'field'); }
  function isHit(l) { return l.type === 'damage' && (l.kind === 'attack' || l.kind === 'combat'); }
  function onBoard(prev, next, iid) {
    const a = prev.cards[iid], b = next.cards[iid];
    return !!((a && (a.zone === 'field' || a.zone === 'leader')) || (b && (b.zone === 'field' || b.zone === 'leader')));
  }

  SV.anim = SV.anim || {};
  SV.anim.plan = function (prev, next, fresh) {
    const steps = [];
    let spotted = false;
    for (let i = 0; i < fresh.length; i++) {
      const l = fresh[i];
      switch (l.type) {
        case 'play': spotted = true; break;
        case 'evolve':
          if (wasOnField(prev, l.iid) || (next.cards[l.iid] && next.cards[l.iid].zone === 'field')) steps.push({ kind: 'evolve', iid: l.iid, sup: !!l.sup });
          break;
        case 'attack': {
          const st = { kind: 'clash', a: l.iid, t: l.target, leader: !!l.leader, hits: [], declared: true };
          while (i + 1 < fresh.length && isHit(fresh[i + 1])) { i++; st.hits.push({ iid: fresh[i].iid, amount: fresh[i].amount, leader: !!fresh[i].leader }); }
          if (!st.hits.length) st.kind = 'declare';
          steps.push(st);
          break;
        }
        case 'damage': {
          if (isHit(l) && prev.attack) {
            const st = { kind: 'clash', a: prev.attack.a, t: prev.attack.t, leader: !!prev.attack.leader, hits: [{ iid: l.iid, amount: l.amount, leader: !!l.leader }], declared: false };
            while (i + 1 < fresh.length && isHit(fresh[i + 1])) { i++; st.hits.push({ iid: fresh[i].iid, amount: fresh[i].amount, leader: !!fresh[i].leader }); }
            steps.push(st);
            break;
          }
          if (!onBoard(prev, next, l.iid)) break;
          const from = l.src != null ? l.src : (l.via != null ? l.via : null);
          steps.push({ kind: 'bolt', from: from, to: l.iid, amount: l.amount, leader: !!l.leader, color: clsColor(prev, next, from) });
          break;
        }
        case 'heal':
          steps.push({ kind: 'heal', p: l.p, amount: l.amount });
          break;
        case 'setDefense':
          steps.push({ kind: 'heal', p: l.p, amount: l.total - l.from });
          break;
        case 'destroy': case 'bury': case 'banish': case 'leave': case 'return': case 'toEx': case 'toDeck':
          if (wasOnField(prev, l.iid)) steps.push({ kind: 'leave', iid: l.iid, owner: prev.cards[l.iid].owner, to: LEAVE[l.type] || l.to || 'cemetery', verb: l.type });
          break;
        case 'discard':
          steps.push({ kind: 'handDiscard', iid: l.iid, owner: cardOf(prev, next, l.iid) ? cardOf(prev, next, l.iid).owner : l.who });
          break;
        case 'win':
          // The shatter is for a leader brought to 0; a concession or a deck-out ends quietly.
          if (l.reason === 'defense' || l.reason === 'both' || l.draw) steps.push({ kind: 'finale', losers: l.draw ? [0, 1] : [1 - l.who] });
          break;
      }
    }
    if (steps.length && spotted) steps.unshift({ kind: 'wait', ms: D.spotWait });
    return steps;
  };

  // ======================= playback (DOM) =======================
  let mode = null;
  let speedMul = 1;           // spectate slider: >1 slower, <1 faster
  let job = null;

  function readMode() {
    if (mode) return mode;
    const saved = U.store.get('anim', null);
    mode = (saved === 'full' || saved === 'quick' || saved === 'off') ? saved : (U.reducedMotion() ? 'off' : 'full');
    return mode;
  }
  SV.anim.mode = readMode;
  SV.anim.setMode = function (m) { mode = m; U.store.set('anim', m); if (m === 'off') SV.anim.skip(); };
  SV.anim.cycleMode = function () {
    const order = ['full', 'quick', 'off'];
    SV.anim.setMode(order[(order.indexOf(readMode()) + 1) % order.length]);
    return mode;
  };
  SV.anim.setSpeed = function (k) { speedMul = k; };
  // Duration multiplier used by the spotlight and AI pacing too (near 0 when off).
  SV.anim.rate = function () { return (RATE[readMode()] || 0.0001) * speedMul; };
  SV.anim.busy = function () { return !!job; };
  SV.anim.willAnimate = function (steps) { return !!(steps && steps.length) && readMode() !== 'off'; };

  function ms(n) { return Math.round(n * RATE[readMode()] * speedMul); }
  function sfx(tag) { SV.sound.sfx(tag); }

  function layer() {
    let n = $('fx-layer');
    if (!n) { n = el('div'); n.id = 'fx-layer'; document.body.appendChild(n); }
    return n;
  }
  function lock(on) {
    let n = $('fx-lock');
    if (!n) {
      n = el('div'); n.id = 'fx-lock';
      n.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); SV.anim.skip(); });
      document.body.appendChild(n);
    }
    n.classList.toggle('open', !!on);
    document.body.classList.toggle('is-animating', !!on);
  }
  function onKey(e) {
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); SV.anim.skip(); }
  }

  function cardNode(iid) { return document.querySelector('#mat .card[data-iid="' + iid + '"]'); }
  function slotNode(iid) { const c = cardNode(iid); return c ? c.closest('.field-slot') : null; }
  function sideOf(seat) { return seat === job.ctx.viewSeat ? 'my-' : 'enemy-'; }
  function zone(seat, what) { return $(sideOf(seat) + what); }
  // A target node: a follower's card, or the leader's whole arch.
  function targetNode(iid) {
    const c = job.next.cards[iid];
    if (c && c.zone === 'leader') return zone(c.owner, 'leader');
    return cardNode(iid);
  }
  function centre(node) {
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, r: r };
  }
  function later(delay, fn) {
    if (!job) return;
    const t = setTimeout(function () {
      if (!job) return;
      const i = job.timers.indexOf(t); if (i >= 0) job.timers.splice(i, 1);
      fn();
    }, delay);
    job.timers.push(t);
  }

  // ---- in-place patching from the NEXT state ----------------------------------------------
  function patchCard(iid, next) {
    const c = next.cards[iid];
    if (c && c.zone === 'leader') { patchLeader(c.owner, next); return; }
    const node = cardNode(iid);
    if (!node) return;
    if (!c || c.zone !== 'field') {
      const n = node.querySelector('.stat.def .n'); if (n) n.textContent = '0';
      return;
    }
    const ch = SV.chars(next, iid);
    const w = node.querySelector('.stat.def');
    if (w) { w.querySelector('.n').textContent = String(ch.def); w.classList.toggle('damaged', ch.dmg > 0); }
    let m = node.querySelector('.damage-marker');
    if (ch.dmg > 0) { if (!m) { m = el('div', 'damage-marker'); node.appendChild(m); } m.textContent = '−' + ch.dmg; }
    else if (m) m.remove();
  }
  function patchLeader(seat, next) {
    const z = zone(seat, 'leader');
    if (z) SV.ui.placeDefense(z, next.players[seat].defense);
  }

  function floatText(node, text, cls) {
    const c = centre(node);
    const n = el('div', 'fx-number ' + (cls || ''));
    n.textContent = text;
    n.style.left = c.x + 'px'; n.style.top = (c.y - c.h * 0.15) + 'px';
    n.style.setProperty('--dur', ms(900) + 'ms');
    layer().appendChild(n);
    job.trash.push(n);
    later(ms(950), function () { n.remove(); });
  }
  function shake(node) {
    node.classList.remove('fx-hit'); void node.offsetWidth; node.classList.add('fx-hit');
    job.unhide.push(node);
    later(ms(420), function () { node.classList.remove('fx-hit'); });
  }
  function burst(node, color, cls, scale) {
    const c = centre(node);
    const size = Math.max(c.w, c.h) * (scale || 1.5);
    const s = el('div', 'fx-impact ' + (cls || ''));
    s.style.left = (c.x - size / 2) + 'px'; s.style.top = (c.y - size / 2) + 'px';
    s.style.width = size + 'px'; s.style.height = size + 'px';
    s.style.setProperty('--fx', color || '#ffd9a0');
    s.style.setProperty('--dur', ms(D.impact) + 'ms');
    layer().appendChild(s);
    job.trash.push(s);
    later(ms(D.impact) + 40, function () { s.remove(); });
  }
  // Embers: n particles from (x, y) flung by (spread) with a drift. opts: {colors, spread, up, size, dur}.
  function embers(x, y, n, opts) {
    opts = opts || {};
    const cols = opts.colors || ['#ffb27a', '#fff1d6'];
    const spread = opts.spread || 60, up = opts.up || 0, size = opts.size || 8, dur = opts.dur || 800;
    for (let i = 0; i < n; i++) {
      const shard = i % 3 === 0;
      const m = el('div', 'fx-mote' + (shard ? ' is-shard' : ''));
      const a = Math.random() * Math.PI * 2, r = spread * (0.35 + Math.random() * 0.65);
      m.style.left = x + 'px'; m.style.top = y + 'px';
      m.style.setProperty('--dx', (Math.cos(a) * r).toFixed(1) + 'px');
      m.style.setProperty('--dy', (Math.sin(a) * r - up).toFixed(1) + 'px');
      m.style.setProperty('--c', cols[i % cols.length]);
      m.style.setProperty('--sz', (size * (0.6 + Math.random() * 0.8)).toFixed(1) + 'px');
      m.style.setProperty('--dur', ms(dur * (0.75 + Math.random() * 0.5)) + 'ms');
      layer().appendChild(m);
      job.trash.push(m);
    }
  }
  // A curved flight from a to b (Web Animations, linear, sampled from the same curve the
  // trail uses so the sparks are always laid down under the flyer).
  function arcPath(a, b, lift) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - lift;
    return { at: function (t) { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * mx + t * t * b.x, y: u * u * a.y + 2 * u * t * my + t * t * b.y }; } };
  }
  function flyer(node, a, b, lift, dur, trailColors, cb) {
    const path = arcPath(a, b, lift);
    node.style.left = '0px'; node.style.top = '0px';
    const frames = [];
    for (let k = 0; k <= 16; k++) {
      const q = path.at(k / 16);
      frames.push({ transform: 'translate(' + q.x.toFixed(1) + 'px,' + q.y.toFixed(1) + 'px) translate(-50%,-50%) rotate(' + (k * 22) + 'deg)' });
    }
    node.style.transform = frames[0].transform;
    layer().appendChild(node);
    job.trash.push(node);
    if (node.animate) node.animate(frames, { duration: Math.max(1, dur), easing: 'linear', fill: 'forwards' });
    const n = Math.max(4, Math.round(dur / 45));
    for (let k = 1; k <= n; k++) {
      later(Math.round(dur * k / (n + 1)), function () {
        const q = path.at(k / (n + 1));
        embers(q.x, q.y, 2, { colors: trailColors, spread: 14, up: -10, size: 6, dur: 600 });
      });
    }
    later(dur, function () { node.remove(); cb(); });
  }
  // The clash: a steel starburst over a slash ring.
  function clashFx(node, color) {
    const c = centre(node);
    const size = Math.max(c.w, c.h) * 1.2;
    const ring = el('div', 'fx-slashring');
    const star = el('div', 'fx-pow');
    [ring, star].forEach(function (n, i) {
      const sz = i ? size : size * 1.3;
      n.style.left = (c.x - sz / 2) + 'px'; n.style.top = (c.y - sz / 2) + 'px';
      n.style.width = sz + 'px'; n.style.height = sz + 'px';
      n.style.setProperty('--fx', color || '#ffd9a0');
      n.style.setProperty('--dur', ms(D.impact + 160) + 'ms');
      layer().appendChild(n);
      job.trash.push(n);
    });
    embers(c.x, c.y, 14, { colors: ['#fff1d6', '#ffb27a', color || '#ffd9a0'], spread: size * 0.7, size: 8, dur: 700 });
    later(ms(D.impact + 200), function () { ring.remove(); star.remove(); });
  }
  // The quarter-turn: the slot widens and the card turns, exactly as the redraw will show it,
  // so the attack that engaged it reads as one continuous motion.
  function engageNow(iid) {
    const slot = slotNode(iid);
    if (slot && !slot.classList.contains('is-engaged')) { slot.classList.add('is-engaged'); sfx('engage'); return true; }
    return false;
  }

  function hitLand(hit, next) {
    const node = targetNode(hit.iid);
    if (!node) return;
    shake(node);
    if (hit.leader) {
      sfx('leaderHit');
      burst(node, '#ff5a4a', 'fx-leaderhit', 1.1);
      floatText(node, hit.amount > 0 ? '−' + hit.amount : '0', 'is-leader');
    } else if (hit.amount > 0) floatText(node, '−' + hit.amount, '');
    else floatText(node, '0', 'is-zero');
    patchCard(hit.iid, next);
  }

  function playDeclare(step, next, cb) {
    const from = cardNode(step.a), to = targetNode(step.t);
    if (!from || !to) { cb(); return; }
    const engaged = engageNow(step.a);
    sfx('attack');
    later(engaged ? ms(D.engage) + 40 : 0, function () {
      SV.arrow.draw(SV.arrow.centreOf(from), SV.arrow.centreOf(to), 'declared');
      later(ms(420), cb);
    });
  }

  function playClash(step, next, cb) {
    const from = cardNode(step.a), to = targetNode(step.t);
    if (!from || !to) { step.hits.forEach(function (h) { hitLand(h, next); }); later(ms(D.impact), cb); return; }
    const engaged = engageNow(step.a);
    if (step.declared) sfx('attack');
    later(engaged ? ms(D.engage) + 40 : 0, function () {
      const a = centre(from), b = centre(to);
      SV.arrow.draw({ x: a.x, y: a.y }, { x: b.x, y: b.y }, 'declared');
      const clone = from.cloneNode(true);
      clone.className = from.className.replace(/\b(role-\S+|drop-\S+)\b/g, '') + ' fx-clone';
      clone.removeAttribute('data-iid'); clone.removeAttribute('data-card-id');
      const rot = from.closest('.field-slot.is-engaged') ? ' rotate(90deg)' : '';
      clone.style.width = from.offsetWidth + 'px'; clone.style.height = from.offsetHeight + 'px';
      clone.style.left = (a.x - from.offsetWidth / 2) + 'px'; clone.style.top = (a.y - from.offsetHeight / 2) + 'px';
      clone.style.transform = rot;
      layer().appendChild(clone);
      from.classList.add('fx-hidden');
      job.trash.push(clone); job.unhide.push(from);
      void clone.getBoundingClientRect();
      const dx = b.x - a.x, dy = b.y - a.y;
      const k = 1 - Math.min(0.35, (Math.min(b.w, b.h) * 0.45) / Math.max(1, Math.sqrt(dx * dx + dy * dy)));
      clone.style.transition = 'transform ' + ms(D.lunge) + 'ms cubic-bezier(.6,-.1,.9,.5)';
      clone.style.transform = 'translate(' + (dx * k) + 'px,' + (dy * k) + 'px)' + rot + ' scale(1.08)';
      later(ms(D.lunge), function () {
        // ONE impact beat: both sides' damage lands together (simultaneous, CR 8.4.9.1).
        sfx('hit');
        clashFx(to, '#ffd9a0');
        step.hits.forEach(function (h) { hitLand(h, next); });
        SV.arrow.clear();
        clone.style.transition = 'transform ' + ms(D.recoil) + 'ms cubic-bezier(.2,.7,.4,1)';
        clone.style.transform = 'translate(0,0)' + rot + ' scale(1)';
        later(ms(D.recoil) + 20, function () { clone.remove(); from.classList.remove('fx-hidden'); cb(); });
      });
    });
  }

  // Ability damage: a bolt in the source's class colour, arcing from the card (or the spotlit
  // spell) to its target.
  function playBolt(step, next, cb) {
    const toNode = targetNode(step.to);
    if (!toNode) { cb(); return; }
    const fromNode = step.from != null ? (cardNode(step.from) || $('spotlight')) : $('spotlight');
    const land = function () {
      sfx(step.leader ? 'leaderHit' : 'hit');
      const c = centre(toNode);
      burst(toNode, step.color, 'fx-magic', step.leader ? 1.1 : 1.5);
      embers(c.x, c.y, 12, { colors: [step.color, '#ffffff'], spread: Math.min(c.w, 160) * 0.8, size: 8, dur: 700 });
      hitLand({ iid: step.to, amount: step.amount, leader: step.leader }, next);
      later(ms(D.impact), cb);
    };
    if (!fromNode || fromNode === toNode) { land(); return; }
    const a = centre(fromNode), b = centre(toNode);
    const orb = el('div', 'fx-orb');
    orb.style.setProperty('--fx', step.color);
    sfx('ability');
    flyer(orb, a, b, Math.min(160, Math.abs(b.x - a.x) * 0.3 + 60), ms(D.travel), [step.color, '#ffffff'], land);
  }

  // Evolving: a column of light over the follower and a rising word.
  function playEvolve(step, next, cb) {
    const node = cardNode(step.iid);
    if (!node) { cb(); return; }
    sfx(step.sup ? 'super' : 'evolve');
    const c = centre(node);
    const col = el('div', 'fx-evolve' + (step.sup ? ' is-super' : ''));
    col.style.left = (c.x - c.w) + 'px'; col.style.top = (c.y - c.h * 1.1) + 'px';
    col.style.width = (c.w * 2) + 'px'; col.style.height = (c.h * 2.2) + 'px';
    col.style.setProperty('--dur', ms(D.evolve) + 'ms');
    layer().appendChild(col);
    job.trash.push(col);
    burst(node, step.sup ? '#ffe58a' : '#c9b4ff', 'fx-magic', 1.7);
    embers(c.x, c.y, 18, { colors: step.sup ? ['#ffe58a', '#ffffff', '#ffb27a'] : ['#c9b4ff', '#ffffff', '#86e0ff'], spread: c.w, up: 50, size: 9, dur: 900 });
    floatText(node, step.sup ? 'Super-evolve!' : 'Evolve!', 'is-evolve');
    later(ms(D.evolve), function () { col.remove(); cb(); });
  }

  function flyTo(node, rect, destNode, dur, cb) {
    const clone = node.cloneNode(true);
    clone.className = node.className.replace(/\b(role-\S+|drop-\S+|fx-hidden)\b/g, '') + ' fx-clone fx-flyer';
    clone.removeAttribute('data-iid'); clone.removeAttribute('data-card-id');
    clone.style.left = rect.left + 'px'; clone.style.top = rect.top + 'px';
    clone.style.width = rect.width + 'px'; clone.style.height = rect.height + 'px';
    layer().appendChild(clone);
    job.trash.push(clone);
    void clone.getBoundingClientRect();
    let tx = 0, ty = -rect.height * 0.3, sc = 0.05;
    if (destNode) {
      const d = destNode.getBoundingClientRect();
      tx = (d.left + d.width / 2) - (rect.left + rect.width / 2);
      ty = (d.top + d.height / 2) - (rect.top + rect.height / 2);
      sc = Math.max(0.12, (d.height / rect.height) * 0.7);
    }
    clone.style.transition = 'transform ' + dur + 'ms cubic-bezier(.4,0,.8,.3), opacity ' + dur + 'ms ease-in';
    clone.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ') rotate(' + (tx > 0 ? 18 : -18) + 'deg)';
    clone.style.opacity = '0.15';
    later(dur, function () {
      clone.remove();
      if (destNode) { destNode.classList.remove('fx-received'); void destNode.offsetWidth; destNode.classList.add('fx-received'); }
      cb();
    });
  }

  // Leaving the field: destroyed cards crumble into embers that drift to the cemetery; banished
  // ones flare white; returned ones simply fly to where they went.
  function playLeave(step, next, cb) {
    const node = cardNode(step.iid);
    if (!node) { cb(); return; }
    const dest = step.to === 'hand' ? (step.owner === job.ctx.viewSeat ? $('hand') : $('enemy-hand'))
      : step.to === 'ex' ? zone(step.owner, 'ex') : step.to === 'deck' ? zone(step.owner, 'deck') : zone(step.owner, step.to === 'banished' ? 'banished' : 'cemetery');
    const r = node.getBoundingClientRect();
    if (step.verb === 'return' || step.verb === 'toEx' || step.verb === 'toDeck') {
      sfx('draw');
      node.classList.add('fx-hidden'); job.unhide.push(node);
      flyTo(node, r, dest, ms(D.discardFly), cb);
      return;
    }
    const banish = step.to === 'banished';
    sfx(banish ? 'banish' : 'destroy');
    shake(node);
    later(ms(D.leaveHold), function () {
      node.classList.add(banish ? 'fx-banish' : 'fx-crumble');
      node.style.setProperty('--dur', ms(D.leaveFly * 0.7) + 'ms');
      job.unhide.push(node);
      const cols = banish ? ['#ffffff', '#d8e6ff', '#b7c6ff'] : ['#ff8a4a', '#ffd27a', '#7a2a1a', '#3a1a12'];
      for (let k = 0; k < 4; k++) {
        later(ms(k * 110), function () {
          embers(r.left + Math.random() * r.width, r.top + Math.random() * r.height, 6, { colors: cols, spread: r.width * 0.5, up: banish ? 60 : 20, size: 8, dur: 900 });
        });
      }
      later(ms(D.leaveFly * 0.45), function () {
        node.classList.add('fx-hidden');
        if (!dest) { later(ms(300), cb); return; }
        const a = { x: r.left + r.width / 2, y: r.top + r.height / 2 }, b = centre(dest);
        const orb = el('div', 'fx-orb is-ember');
        orb.style.setProperty('--fx', banish ? '#dfe8ff' : '#ff8a4a');
        flyer(orb, a, b, 60, ms(D.leaveFly * 0.55), cols.slice(0, 2), function () {
          dest.classList.remove('fx-received'); void dest.offsetWidth; dest.classList.add('fx-received');
          cb();
        });
      });
    });
  }

  function playHandDiscard(step, next, cb) {
    const bar = step.owner === job.ctx.viewSeat ? $('hand') : $('enemy-hand');
    const c = next.cards[step.iid];
    if (!bar || !c) { cb(); return; }
    const h = bar.getBoundingClientRect();
    const face = SV.renderCard(c.id, { size: 'hand' });
    face.style.position = 'fixed';
    const w = 90, hh = 126;
    sfx('discard');
    flyTo(face, { left: h.left + h.width / 2 - w / 2, top: h.top, width: w, height: hh }, zone(step.owner, 'cemetery'), ms(D.discardFly), cb);
  }

  function playHeal(step, next, cb) {
    const node = zone(step.p, 'leader');
    if (!node) { cb(); return; }
    // A defense set lower (CR 5.27.2) is not damage, but it reads as a loss.
    const up = step.amount >= 0;
    floatText(node, (up ? '+' : '−') + Math.abs(step.amount), up ? 'is-heal' : 'is-leader');
    burst(node, up ? '#8ee0ac' : '#ff5a4a', up ? 'fx-heal' : 'fx-leaderhit', 1.1);
    sfx(up ? 'heal' : 'leaderHit');
    patchLeader(step.p, next);
    later(ms(D.impact), cb);
  }

  // A leader at 0: the arch cracks with light, shards fly, then a second of quiet before the
  // results panel. The hold is NOT scaled by speed: a pause to let the picture land.
  function playFinale(step, next, cb) {
    const charge = ms(D.finaleCharge), boom = ms(D.finaleBoom);
    const after = charge + boom + D.finaleHold;
    step.losers.forEach(function (seat) {
      const z = zone(seat, 'leader');
      if (!z) return;
      patchLeader(seat, next);
      const g = centre(z);
      const glow = el('div', 'fx-finale-glow');
      const gs = Math.max(g.w, g.h) * 2.4;
      glow.style.left = (g.x - gs / 2) + 'px'; glow.style.top = (g.y - gs / 2) + 'px';
      glow.style.width = gs + 'px'; glow.style.height = gs + 'px';
      glow.style.setProperty('--dur', (charge + boom) + 'ms');
      layer().appendChild(glow);
      job.trash.push(glow);
      z.classList.add('fx-shatter');
      job.unhide.push(z);
      later(charge, function () {
        sfx('leaderHit');
        for (let k = 0; k < 5; k++) {
          later(Math.round(boom * k / 6), function () {
            embers(g.x + (Math.random() - 0.5) * g.w, g.y + (Math.random() - 0.5) * g.h, 22,
              { colors: ['#ffffff', '#ffd27a', '#ff6a4a', '#9aa6c4'], spread: Math.min(260, g.h * 0.6), up: -20, size: 11, dur: 1300 });
          });
        }
      });
    });
    later(after, function () { cb(); });
  }

  function finish() {
    if (!job) return;
    const j = job;
    job = null;
    j.timers.forEach(clearTimeout);
    j.trash.forEach(function (n) { if (n && n.parentNode) n.remove(); });
    j.unhide.forEach(function (n) { n.classList.remove('fx-hidden', 'fx-hit', 'fx-crumble', 'fx-banish', 'fx-shatter'); });
    const l = $('fx-layer'); if (l) l.textContent = '';
    SV.arrow.clear();
    lock(false);
    document.removeEventListener('keydown', onKey, true);
    j.done();
  }
  SV.anim.skip = function () { finish(); };

  // ctx: {viewSeat}
  SV.anim.run = function (steps, next, ctx, done) {
    if (job) finish();
    if (!SV.anim.willAnimate(steps)) { done(); return; }
    job = { timers: [], trash: [], unhide: [], done: done, ctx: ctx, next: next, started: Date.now() };
    lock(true);
    document.addEventListener('keydown', onKey, true);
    let i = 0;
    function step() {
      if (!job) return;
      if (i >= steps.length) { finish(); return; }
      const s = steps[i++];
      const nxt = function () { later(ms(D.beatGap), step); };
      switch (s.kind) {
        case 'wait': later(ms(s.ms), step); break;
        case 'declare': playDeclare(s, next, nxt); break;
        case 'clash': playClash(s, next, nxt); break;
        case 'bolt': playBolt(s, next, nxt); break;
        case 'evolve': playEvolve(s, next, nxt); break;
        case 'leave': playLeave(s, next, nxt); break;
        case 'handDiscard': playHandDiscard(s, next, nxt); break;
        case 'heal': playHeal(s, next, nxt); break;
        case 'finale': playFinale(s, next, step); break;
        default: step();
      }
    }
    step();
  };
  // How long the current job has run (the bot's watchdog reads this).
  SV.anim.age = function () { return job ? Date.now() - job.started : 0; };
})();
