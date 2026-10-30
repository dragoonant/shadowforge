// The AI (lorecannae's machine, PLAN D3). One machine for every level: enumerate legalActions,
// apply each, settle our own follow-up questions greedily, score the result with evaluate(),
// and compare against the do-nothing baseline (ending the main phase / passing a Quick window).
// Weights carry their reason (KB LESSONS §3: "cite a reason or don't change it"); measurements
// in docs/ai.md. The AI never reads hidden cards: look-ahead runs on determinized copies.
(function () {
  const SV = globalThis.SV;
  const AI = (SV.ai = SV.ai || {});

  const LEVELS = {
    easy: { noise: 12, blunder: 0.25, threat: 0.3, sample: 10 },
    onePly: { noise: 2, blunder: 0, threat: 0.6, sample: 18 },
    normal: { noise: 1, blunder: 0, threat: 0.6, sample: 18, reply: 2, worlds: 1 },
    hard: { noise: 0, blunder: 0, threat: 0.6, sample: 28, reply: 4, worlds: 3 },
  };

  // Leader defense is the race. Each point matters more as it nears 0 (the last points end the
  // game); points far above 20 matter less.
  const defValue = (d) => (d <= 0 ? -1e6 : Math.min(d, 20) * 5 + Math.max(0, d - 20) * 2 - Math.max(0, 10 - d) ** 2 * 1.8);

  function followerValue(s, i) {
    const r = SV.chars(s, i);
    let v = Math.max(0, r.atk) * 1.5 + Math.max(0, r.def) * 1.2 + (r.cost || 0) * 0.5;
    if (r.kw.Ward) v += 2;
    if (r.kw.Bane) v += 2.5;
    if (r.kw.Drain) v += 1.5;
    if (r.kw.Aura) v += 1.5;
    if (r.kw.Intimidate) v += 1.5;
    if (r.kw.Assail) v += 1;
    if (r.kw.Storm || r.kw.Rush) v += 0.5;
    if (r.evolved) v += 1;
    if (r.flags.loseAbilities) v -= 2;
    if (r.activated.length) v += 1;
    return v;
  }

  // Can the side `by` destroy follower t on its coming turn by attacking it? Only engaged
  // followers (or any, with Assail) can be attacked; Intimidate can't be.
  function exposed(s, t, by) {
    const T = SV.chars(s, t);
    if (T.kw.Intimidate) return false;
    for (const a of SV.followers(s, by)) {
      const A = SV.chars(s, a);
      if (A.flags.cantAttack) continue;
      if (!s.cards[t].engaged && !A.kw.Assail) continue;
      if (A.kw.Bane || A.atk >= T.def) return true;
    }
    return false;
  }

  // Damage `by` could push into p's leader next turn with followers already on the field.
  function leaderThreat(s, p, by) {
    const wards = SV.followers(s, p).some((w) => SV.chars(s, w).kw.Ward);
    if (wards) return 0;
    let n = 0;
    for (const a of SV.followers(s, by)) { const A = SV.chars(s, a); if (!A.flags.cantAttack && !A.flags.cantAttackLeader) n += Math.max(0, A.atk); }
    return n;
  }

  AI.evaluate = function (s, me, w = LEVELS.normal) {
    if (s.winner !== null) return s.winner === me ? 1e7 : s.winner === 'draw' ? 0 : -1e7;
    const op = 1 - me;
    let v = defValue(s.players[me].defense) - defValue(s.players[op].defense);
    for (const side of [me, op]) {
      const sign = side === me ? 1 : -1;
      const P = s.players[side];
      let board = 0;
      for (const i of P.field) {
        if (SV.isFollower(s, i)) {
          let fv = followerValue(s, i);
          // The side about to pass the turn leaves its engaged followers open to attack.
          if (side === s.active && exposed(s, i, 1 - side)) fv -= fv * w.threat;
          board += fv;
        } else board += (SV.def(i, s).cost || 0) * 1.5 + 1;
      }
      const handV = Math.min(P.hand.length, 7) * 3 + Math.max(0, P.hand.length - 7) * 0.5;
      const exV = P.ex.reduce((n, i) => n + (SV.parsed(SV.def(i, s)).type === 'crest' ? 3 : 2.5), 0);
      const pointsV = P.ep * 2 + P.sep * 3 + P.maxPP * 1.5;
      const deckV = P.deck.length < 6 ? -(6 - P.deck.length) * 4 : 0;
      v += sign * (board + handV + exV + pointsV + deckV);
    }
    // Lethal pressure: what's on board against what's left.
    const threatOnMe = leaderThreat(s, me, op), threatOnOp = leaderThreat(s, op, me);
    if (threatOnMe >= s.players[me].defense) v -= 60;
    if (threatOnOp >= s.players[op].defense) v += 40;
    return v;
  };

  function settleOwn(s, me, w, depth = 0) {
    while (s.ask && s.ask.who === me && depth < 6) { s = bestAnswer(s, me, w, depth + 1).state; depth++; }
    return s;
  }

  function bestAnswer(s, me, w, depth = 0) {
    const ask = s.ask;
    if (ask.kind === 'mulligan') { const a = { type: 'answer', value: mulliganPick(s, me) }; return { action: a, state: SV.apply(s, a) }; }
    let opts = SV.legalActions(s);
    if (opts.length > w.sample * 3) opts = stride(opts, w.sample * 3);
    let best = null;
    for (const a of opts) {
      let s2;
      try { s2 = SV.apply(s, a); } catch (e) { continue; }
      if (depth < 3) { let g = 0; while (s2.ask && s2.ask.who === me && g++ < 4) s2 = bestAnswer(s2, me, w, depth + 1).state; }
      const sc = AI.evaluate(s2, me, w);
      if (!best || sc > best.score) best = { action: a, state: s2, score: sc };
    }
    if (!best) throw new Error('AI: no answer applies');
    return best;
  }

  function stride(arr, n) {
    if (arr.length <= n) return arr;
    const out = [];
    const step = arr.length / n;
    for (let k = 0; k < n; k++) out.push(arr[Math.floor(k * step)]);
    return out;
  }

  // Mulligan (CR 6.2.1.8 is all-or-nothing): redraw a hand with nothing to play by turn 3.
  function mulliganPick(s, me) {
    const costs = s.players[me].hand.map((i) => SV.def(i, s).cost || 0);
    return !costs.some((c) => c <= 2) || costs.filter((c) => c <= 3).length < 2;
  }

  // Choose an action for `seat`. Synchronous; deterministic for a given state and level.
  AI.choose = function (s, seat, level = 'normal') {
    const w = LEVELS[level] || LEVELS.normal;
    if (SV.whoActs(s) !== seat) throw new Error('AI.choose: not this seat to act');
    let rnd = (SV.hashSeed(String(s.logN) + ':' + s.seed) >>> 0) / 4294967296;
    const noise = () => { rnd = (rnd * 9301 + 0.49297) % 1; return (rnd - 0.5) * 2 * w.noise; };
    if (s.ask) {
      if (s.ask.kind === 'mulligan') return { type: 'answer', value: mulliganPick(s, seat) };
      return bestAnswer(s, seat, w).action;
    }
    const acts = SV.legalActions(s);
    const baseline = acts.find((a) => a.type === 'end' || a.type === 'pass');
    const here = AI.evaluate(s, seat, w);
    const scored = [];
    for (const a of acts) {
      if (a === baseline) continue;
      let s2;
      try { s2 = SV.apply(s, a); } catch (e) { continue; }
      s2 = settleOwn(s2, seat, w);
      scored.push({ a, sc: AI.evaluate(s2, seat, w) + noise() });
    }
    scored.sort((x, y) => y.sc - x.sc);
    // normal/hard (main phase only): play the top candidates and "end" through the rest of our
    // turn and the opponent's whole reply on determinized copies; judge at our next turn.
    if (w.reply && scored.length && !s.window) {
      const cands = scored.slice(0, w.reply).map((x) => x.a);
      if (baseline) cands.push(baseline);
      // Common random numbers: every candidate faces the SAME hidden-card worlds.
      const worlds = Array.from({ length: w.worlds || 1 }, (_, k) => 'det:' + s.logN + ':' + s.seed + ':' + k);
      let best = null;
      for (const a of cands) {
        let s2;
        try { s2 = settleOwn(SV.apply(s, a), seat, w); } catch (e) { continue; }
        let sc = 0;
        for (const key of worlds) sc += rollout(determinize(s2, seat, key), seat);
        sc /= worlds.length;
        if (!best || sc > best.sc) best = { a, sc };
      }
      if (best) return best.a;
    }
    if (!scored.length || scored[0].sc <= here + 0.25) return baseline || acts[0];
    if (w.blunder && rnd < w.blunder && scored.length > 2) return scored[1 + Math.floor(rnd * 2)].a;
    return scored[0].a;
  };

  // Reshuffle what the AI can't see: the opponent's hand+deck and our own deck order.
  function determinize(s, me, key) {
    const t = SV.clone(s);
    let r = (SV.hashSeed(key) >>> 0) || 1;
    const rand = (n) => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r % n; };
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const op = t.players[1 - me];
    const revealed = new Set(t.revealed[1 - me] || []);
    const keep = op.hand.filter((i) => revealed.has(i));
    const pool = shuffle([...op.hand.filter((i) => !revealed.has(i)), ...op.deck]);
    const nHidden = op.hand.length - keep.length;
    op.hand = [...keep, ...pool.slice(0, nHidden)];
    op.deck = pool.slice(nHidden);
    for (const i of op.hand) t.cards[i].zone = 'hand';
    for (const i of op.deck) t.cards[i].zone = 'deck';
    shuffle(t.players[me].deck);
    return t;
  }

  // Play both sides with the one-ply policy until it is our main phase again.
  function rollout(s, me) {
    const w = { ...LEVELS.onePly, noise: 0, sample: 10 };
    const stopTurn = s.turn + (s.active === me ? 2 : 1);
    let t = s;
    for (let n = 0; n < 80 && !SV.isTerminal(t); n++) {
      const who = SV.whoActs(t);
      if (t.turn >= stopTurn && who === me && !t.ask && !t.window && t.phase === 'main') break;
      t = SV.apply(t, fastChoose(t, who, w));
    }
    return AI.evaluate(t, me, w);
  }
  function fastChoose(s, seat, w) {
    if (s.ask) return s.ask.kind === 'mulligan' ? { type: 'answer', value: false } : bestAnswer(s, seat, w, 2).action;
    const acts = SV.legalActions(s);
    const baseline = acts.find((a) => a.type === 'end' || a.type === 'pass');
    const here = AI.evaluate(s, seat, w);
    let best = null;
    for (const a of stride(acts.filter((x) => x !== baseline), 14)) {
      let s2;
      try { s2 = SV.apply(s, a); } catch (e) { continue; }
      let g = 0;
      while (s2.ask && s2.ask.who === seat && g++ < 4) s2 = bestAnswer(s2, seat, w, 3).state;
      const sc = AI.evaluate(s2, seat, w);
      if (!best || sc > best.sc) best = { a, sc };
    }
    return !best || best.sc <= here + 0.25 ? baseline || acts[0] : best.a;
  }

  AI.LEVELS = LEVELS;
})();
