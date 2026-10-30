// Abysscraft card scripts (docs/ABILITIES.md). One SV.card per card number; printed text in the
// comment above each, verbatim from data/cards.js.
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;

  // ---------------------------------------------------------------- shared helpers
  const base = (s, i) => SV.CARDS[s.cards[i].id];
  const buryTop = (x, n) => { for (const c of x.deck().slice(0, n)) x.bury(c); };
  // Enemy followers the controller's abilities can select (Aura, CR 12.15).
  const selEnemies = (s, p) => SV.followers(s, 1 - p).filter((i) => !SV.chars(s, i).kw.Aura);
  const isOmenAbyss = (s, i) => { const d = SV.def(i, s); return d.cls === 'abysscraft' && (s.cards[i].zone === 'field' ? SV.chars(s, i).traits : d.traits).includes('Omen'); };
  // "The number of times your leader has lost defense this turn" (Q695, Q1725): every instance of
  // damage to the leader, and every "change its defense to a lower value" (x.setDefense), this
  // turn. Both doors log each instance; this reads the log (no state is written).
  const lostTimes = (s, p) => s.log.filter((e) => e.turn === s.turn && (
    (e.type === 'damage' && e.leader && e.amount > 0 && e.iid === s.players[p].leader) ||
    (e.type === 'setDefense' && e.p === p && e.total < e.from))).length;
  // Whether a card on the field was last put there from the cemetery (the summon log entry).
  const enteredFromCemetery = (s, iid) => {
    for (let k = s.log.length - 1; k >= 0; k--) {
      const e = s.log[k];
      if (e.iid === iid && (e.type === 'summon' || e.type === 'play')) return e.from === 'cemetery';
    }
    return false;
  };
  // A myTurn "whenever your leader loses defense" trigger condition.
  const myLeaderLostOnMyTurn = (s, me, ev) => ev.p === s.cards[me].ctrl && s.active === ev.p;

  // BP16-080EN Gold Rush Ghost
  // Storm.                                     (engine-read)
  // [fanfare] Choose 1. If this was put onto the field from the cemetery, choose up to 2 instead. (1) Summon an Arcane Personnel Carrier token. Give your leader [defense]+1. (2) Bury the top 2 cards of your deck.
  // At the start of each opponent's end phase, bury this.
  card('BP16-080EN', {
    fanfare(x, ev) {
      const max = ev.from === 'cemetery' ? 2 : 1;
      const pick = x.choose(max === 2 ? 'Gold Rush Ghost: choose up to 2.' : 'Gold Rush Ghost: choose 1.', [
        { label: 'Summon an Arcane Personnel Carrier token. Give your leader +1 defense.' },
        { label: 'Bury the top 2 cards of your deck.' },
      ], 1, max);
      if (pick.includes(0)) { x.summonToken('Arcane Personnel Carrier'); x.heal(x.ctrl, 1); }
      if (pick.includes(1)) for (const c of x.deck().slice(0, 2)) x.bury(c);
    },
    triggers: [{
      name: 'Bury this', on: 'endStart',
      when: (s, me, ev) => ev.p !== s.cards[me].ctrl, // each opponent's end phase
      run(x) { if (x.onField(x.me)) x.bury(x.me); },
    }],
  });

  // BP01-116EN Soul Conversion
  // [quick]                                    (engine-read)
  // Select a follower on your field. Destroy it and draw 2 cards.
  card('BP01-116EN', {
    canPlay: (s, iid) => SV.followers(s, s.cards[iid].owner).length > 0,
    spell(x) {
      const t = x.selectOne(x.followers(x.ctrl), 'Soul Conversion: select a follower on your field to destroy.');
      if (t) { x.destroy(t); x.draw(2); }
    },
  });

  // BP11-075EN Dead to Rights
  // [act] Banish this card and an Iceschillendrig, Gilded Autocrat from your cemetery: Select an enemy follower on the field and engage it.
  // ----------
  // [quick]
  // Select an enemy follower on the field and give it [attack]-2/[defense]-2.
  const ICE = 'Iceschillendrig, Gilded Autocrat';
  card('BP11-075EN', {
    canPlay: (s, iid) => SV.followers(s, 1 - s.cards[iid].owner).length > 0,
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), 'Dead to Rights: select an enemy follower to give -2/-2.');
      if (t) x.buff(t, { atk: -2, def: -2 });
    },
    activated: [{
      text: 'Banish this and an Iceschillendrig from your cemetery: engage an enemy follower',
      zone: 'cemetery', // Q1535: only from the cemetery
      can: (s, me) => H.inCemetery(s, s.cards[me].owner, (i) => SV.CARDS[s.cards[i].id].name === ICE),
      why: () => 'You need an Iceschillendrig, Gilded Autocrat in your cemetery.',
      pay(x) {
        const ice = x.selectOne(x.cemetery().filter((i) => x.name(i) === ICE), 'Choose an Iceschillendrig to banish.', { aura: false });
        x.banish(x.me); x.banish(ice);
      },
      run(x) {
        const t = x.selectOne(x.followers(x.opp), 'Select an enemy follower to engage.');
        if (t) x.engage(t);
      },
    }],
  });

  // BP11-079EN Wretched Tryst
  // Select 2 Wasteland followers that cost 3 or less in your cemetery. Necrocharge (10) - Summon them.
  const trystOk = (s, i) => { const d = SV.CARDS[s.cards[i].id]; return d.traits.includes('Wasteland') && SV.parsed(d).type === 'follower' && (d.cost || 0) <= 3; };
  card('BP11-079EN', {
    canPlay: (s, iid) => s.players[s.cards[iid].owner].cemetery.filter((i) => trystOk(s, i)).length >= 2,
    spell(x) {
      const nc = x.necrocharge(); // fixed when the effect starts resolving (CR 13.5.1.3.2); this spell is in the resolution zone
      const pick = x.select({ from: x.cemetery().filter((i) => trystOk(x.s, i)), min: 2, max: 2, prompt: 'Wretched Tryst: select 2 Wasteland followers that cost 3 or less in your cemetery.' });
      if (nc >= 10) for (const i of pick) x.summon(i);
    },
  });

  // ================================================================ Departed / Wasteland

  // BP03-076EN Odile, Black Swan
  // [fanfare] Deal 2 damage to each enemy leader and enemy follower on the field. Necrocharge (20): Give this follower Storm.
  // Strike: Deal 2 damage to each enemy leader and enemy follower on the field.
  card('BP03-076EN', {
    fanfare(x) {
      const nc = x.necrocharge(); // CR 13.5.1.3.2 fixed at the start of resolution
      x.damageMany([x.leader(x.opp), ...x.followers(x.opp)], 2);
      if (nc >= 20 && x.onField(x.me)) x.give(x.me, 'Storm');
    },
    strike(x) { x.damageMany([x.leader(x.opp), ...x.followers(x.opp)], 2); },
  });

  // BP08-072EN Tartarus, the Tormentor
  // This card costs 5 less to play if there are at least 15 Departed cards in your cemetery.
  // ----------
  // [evolve] [cost01]: Evolve this follower.   (engine-read)
  // [act] [cost01], put this card from your hand into your EX area: Look at the top 2 cards of your deck. You may reveal a Departed card from among them and add it to your hand. Bury the rest.
  card('BP08-072EN', {
    // Q1092: also when played from the EX area.
    selfCost: (s, iid, p) => (s.players[p].cemetery.filter((i) => base(s, i).traits.includes('Departed')).length >= 15 ? -5 : 0),
    activated: [{
      text: 'Put this from your hand into your EX area: look at the top 2, take a Departed card, bury the rest',
      zone: 'hand', // Q1091: only from the hand
      cost: { pp: 1 },
      can: (s, me) => { const P = s.players[s.cards[me].owner]; return P.ex.length < P.exLimit; },
      why: () => 'Your EX area is full.',
      pay(x) { x.toEx(x.me); },
      run(x) {
        const top = x.deck().slice(0, 2);
        if (!top.length) return;
        const cand = top.filter((i) => x.hasTrait(i, 'Departed'));
        const pick = cand.length ? x.select({ from: cand, seen: top, min: 0, max: 1, aura: false, prompt: 'Tartarus: you may reveal a Departed card and add it to your hand. The rest are buried.' }) : [];
        if (pick.length) { x.reveal(pick); x.toHand(pick[0]); }
        for (const i of top) if (!pick.includes(i)) x.bury(i);
      },
    }],
  });
  // BP08-073EN Tartarus, the Tormentor (evolved)
  // On Evolve - Select a Departed follower in your cemetery and summon it.
  card('BP08-073EN', {
    onEvolve(x) {
      const t = x.selectOne(x.cemetery().filter((i) => x.isFollower(i) && x.hasTrait(i, 'Departed')), 'Tartarus: select a Departed follower in your cemetery to summon.', { aura: false });
      if (t) x.summon(t);
    },
  });

  // BP09-091EN Arcus, Spirited Manager
  // This follower can't attack enemies.
  // At the start of your main phase, Necrocharge (10) - Summon a Ghost token.
  // [act] Bury another follower: Choose one of the following. Activate only once per turn. (1) Draw a card. (2) Summon 2 Ghost tokens. (3) Bury the top 2 cards of your deck.
  card('BP09-091EN', {
    auras: [(s, me, t, r) => { if (t === me) r.flags.cantAttackEnemies = true; }], // Q1183: leaders and followers (CR 8.4.3.2.1)
    mainStart(x) { if (x.necrocharge() >= 10) x.summonToken('Ghost'); },
    activated: [{
      text: 'Bury another follower: choose one',
      once: true,
      can: (s, me) => SV.followers(s, s.cards[me].ctrl).some((i) => i !== me),
      why: () => 'You have no other follower to bury.',
      pay(x) {
        const t = x.selectOne(x.followers(x.ctrl).filter((i) => i !== x.me), 'Arcus: choose another follower on your field to bury.', { aura: false });
        if (t) x.bury(t);
      },
      run(x) {
        const pick = x.choose('Arcus: choose one.', [{ label: 'Draw a card.' }, { label: 'Summon 2 Ghost tokens.' }, { label: 'Bury the top 2 cards of your deck.' }]);
        if (pick.includes(0)) x.draw(1);
        if (pick.includes(1)) x.summonToken('Ghost', 2);
        if (pick.includes(2)) buryTop(x, 2);
      },
    }],
  });

  // BP09-105EN Poltergeist
  // [quick]                                    (engine-read)
  // Bury the top 2 cards of your deck.
  card('BP09-105EN', { spell(x) { buryTop(x, 2); } });

  // BP09-T15EN Ghost (token)
  // Storm.                                     (engine-read)
  // At the start of your end phase, banish this card.
  card('BP09-T15EN', { endStart(x) { if (x.onField(x.me)) x.banish(x.me); } });

  // BP11-069EN Iceschillendrig, Gilded Autocrat
  // [evolve] [cost01]: Evolve this follower.   (engine-read)
  // [fanfare] If there's no Magitrain on your field, summon one.
  // Whenever this card becomes engaged, each opponent discards a card.
  const iceEngaged = { name: 'Each opponent discards', on: 'engaged', when: (s, me, ev) => ev.iid === me, run(x) { x.chooseDiscard(1, x.opp); } };
  card('BP11-069EN', {
    fanfare(x) { if (!x.field(x.ctrl).some((i) => x.name(i) === 'Magitrain')) x.summonToken('Magitrain'); },
    triggers: [iceEngaged],
  });
  // BP11-070EN Iceschillendrig, Gilded Autocrat (evolved)
  // On Evolve - Discard a card: Select 2 followers in your cemetery and add them to your hand.
  // Whenever this card becomes engaged, each opponent discards a card.
  // During your turn, whenever a player discards a card, select an enemy follower on the field and engage it.
  card('BP11-070EN', {
    onEvolve(x) {
      const fol = x.cemetery().filter((i) => x.isFollower(i));
      if (fol.length < 2 || !x.hand().length) return; // Q1523: needs 2 followers to select; the cost needs a card to discard
      if (!x.may('Iceschillendrig: discard a card to add 2 followers from your cemetery to your hand?', 'Discard a card', "Don't")) return;
      // Q1524: the followers are selected before the cost is paid.
      const pick = x.select({ from: fol, min: 2, max: 2, aura: false, prompt: 'Iceschillendrig: select 2 followers in your cemetery to add to your hand.' });
      x.chooseDiscard(1, x.ctrl, 'Iceschillendrig: choose a card to discard.');
      for (const i of pick) x.toHand(i);
    },
    triggers: [iceEngaged, {
      name: 'Engage an enemy follower', on: 'discarded',
      when: (s, me) => s.active === s.cards[me].ctrl, // Q1525: once per discarded card
      run(x) { const t = x.selectOne(x.followers(x.opp), 'Iceschillendrig: select an enemy follower to engage.'); if (t) x.engage(t); },
    }],
  });

  // BP11-071EN Illganeau, Horror Astray
  // [fanfare] Select a Wasteland follower that costs 3 or less in your cemetery. Necrocharge (10) - You may summon it. If you do, banish this card.
  // [lastwords] Put this card into its owner's EX area. Bury the top card of your deck.
  card('BP11-071EN', {
    fanfare(x) {
      const nc = x.necrocharge(); // CR 13.5.1.3.2
      const t = x.selectOne(x.cemetery().filter((i) => trystOk(x.s, i)), 'Illganeau: select a Wasteland follower that costs 3 or less in your cemetery.', { aura: false });
      if (!t || nc < 10) return;
      if (!x.may('Illganeau: summon it (and banish Illganeau)?', 'Summon', "Don't")) return;
      const wasOnField = x.onField(x.me) && t !== x.me; // Q1528 not on the field: no banish; Q1529 it summoned itself: no banish
      if (x.summon(t) && wasOnField && x.onField(x.me)) x.banish(x.me);
    },
    lastWords(x) {
      if (x.s.cards[x.me].zone === 'cemetery') x.toEx(x.me); // Q1526 EX full: stays; Q1529 already summoned: not moved
      buryTop(x, 1);
    },
  });

  // BP11-076EN Wretch
  // [evolve] [cost01]: Evolve this follower. Activate only if this follower was put onto the field from the cemetery.
  // Rush.                                      (engine-read)
  // [lastwords] Summon a Bullet Bike token. Bury the top 2 cards of your deck.
  const wretchLW = (x) => { x.summonToken('Bullet Bike'); buryTop(x, 2); };
  card('BP11-076EN', {
    evolveCost: 1, // the line carries a condition, so the engine does not read it
    evolveIf: (s, iid) => enteredFromCemetery(s, iid),
    lastWords: wretchLW,
  });
  // BP11-077EN Wretch (evolved)
  // Storm.                                     (engine-read)
  // On Evolve - Select an enemy follower on the field and deal it 5 damage.
  // [lastwords] Summon a Bullet Bike token. Bury the top 2 cards of your deck.
  card('BP11-077EN', {
    onEvolve(x) { const t = x.selectOne(x.followers(x.opp), 'Wretch: select an enemy follower. Deal it 5 damage.'); if (t) x.damage(t, 5); },
    lastWords: wretchLW,
  });

  // BP11-T02EN Magitrain (token)
  // [act] [cost01], [engage] any number of followers that cost a total of 5 or more on your field: Maneuver this card. (For the rest of this turn, it becomes a follower with [attack]4/[defense]5.)
  // Rush.                                      (engine-read)
  // Strike - Select an engaged enemy follower on the field. Destroy it and give your leader [defense]+2.
  // Engaging is a cost, so only reserved followers can pay it (CR 1.3.2.1); the follower's cost is its printed cost.
  const trainPayers = (s, me) => SV.followers(s, s.cards[me].ctrl).filter((i) => i !== me && !s.cards[i].engaged);
  const costOf = (s, i) => base(s, i).cost || 0;
  card('BP11-T02EN', {
    activated: [{
      text: 'Engage followers costing a total of 5 or more: Maneuver this (a 4/5 follower this turn)',
      cost: { pp: 1 },
      can: (s, me) => trainPayers(s, me).reduce((n, i) => n + costOf(s, i), 0) >= 5,
      why: () => 'You need reserved followers that cost a total of 5 or more on your field.',
      pay(x) {
        // The player picks the followers one at a time until the total reaches 5 (every order gets there:
        // can() checked that all of them together cost 5 or more).
        let total = 0;
        const picked = [];
        while (total < 5) {
          const t = x.selectOne(trainPayers(x.s, x.me).filter((i) => !picked.includes(i)), `Magitrain: choose a follower to engage (total cost so far ${total}; 5 or more needed).`, { aura: false });
          if (!t) break;
          picked.push(t); total += costOf(x.s, t);
        }
        for (const t of picked) x.engage(t);
      },
      run(x) { if (x.onField(x.me)) x.maneuver(x.me); }, // Q1559/Q1561: 4/5 as printed
    }],
    strike(x) {
      const t = x.selectOne(x.followers(x.opp).filter((i) => x.engaged(i)), 'Magitrain: select an engaged enemy follower. Destroy it and give your leader +2 defense.');
      if (t) { x.destroy(t); x.heal(x.ctrl, 2); } // Q1562: no target, no defense
    },
  });

  // BP13-076EN Kagero, Swordbound Soul
  // Necrocharge (10) - This follower has Rush and Bane.
  // [fanfare] Choose one. (1) Select a Soulstrike in your cemetery and put it into your EX area. NC (20) - It costs 2 less to play this turn. (2) Bury the top 2 cards of your deck.
  card('BP13-076EN', {
    auras: [(s, me, t, r) => { if (t === me && s.players[s.cards[me].ctrl].cemetery.length >= 10) { r.kw.Rush = true; r.kw.Bane = true; } }], // Q1727 passive
    fanfare(x) {
      const nc = x.necrocharge(); // CR 13.5.1.3.2
      const ss = x.cemetery().filter((i) => x.name(i) === 'Soulstrike');
      const pick = x.choose('Kagero: choose one.', [
        { label: 'Put a Soulstrike from your cemetery into your EX area (NC 20: it costs 2 less this turn).', can: ss.length > 0 },
        { label: 'Bury the top 2 cards of your deck.' },
      ]);
      if (pick.includes(0)) {
        const t = x.selectOne(ss, 'Kagero: select a Soulstrike in your cemetery.', { aura: false });
        if (t && x.toEx(t) && nc >= 20) x.buff(t, { cost: -2 }, x.until.eot(), 'costs 2 less to play this turn');
      }
      if (pick.includes(1)) buryTop(x, 2);
    },
  });

  // BP13-077EN Chris, Beyond the Patch
  // [fanfare] Select an [abysscraft] follower not named Chris, Beyond the Patch that costs 5 or less in your cemetery. Necrocharge (10) - Summon it and give it Ward.
  card('BP13-077EN', {
    fanfare(x) {
      const nc = x.necrocharge(); // Q1728 fixed when the effect starts resolving
      const cand = x.cemetery().filter((i) => { const d = x.def(i); return d.cls === 'abysscraft' && x.isFollower(i) && d.name !== 'Chris, Beyond the Patch' && (d.cost || 0) <= 5; });
      const t = x.selectOne(cand, 'Chris: select an abysscraft follower that costs 5 or less in your cemetery.', { aura: false });
      if (t && nc >= 10 && x.summon(t)) x.give(t, 'Ward');
    },
  });

  // BP13-081EN Soulstrike
  // Select an enemy follower on the field and deal it 4 damage. Necrocharge (20) - Deal 4 damage to its leader.
  card('BP13-081EN', {
    canPlay: (s, iid) => selEnemies(s, s.cards[iid].owner).length > 0,
    spell(x) {
      const nc = x.necrocharge(); // this spell is in the resolution zone (CR 13.5.1.3.1)
      const t = x.selectOne(x.followers(x.opp), 'Soulstrike: select an enemy follower. Deal it 4 damage.');
      if (!t) return;
      const owner = x.s.cards[t].ctrl;
      x.damage(t, 4);
      if (nc >= 20) x.damage(x.leader(owner), 4);
    },
  });

  // BP16-077EN Cerberus, Hellfire Unleashed
  // [fanfare] Summon a Mimi, Right Paw Hellhound and Coco, Left Paw Hellhound token. Necrocharge (10) - Give them Storm.
  // [act] [engage], bury another follower: Select an enemy follower on the field and deal it 2 damage.
  const MIMI = 'Mimi, Right Paw Hellhound', COCO = 'Coco, Left Paw Hellhound';
  card('BP16-077EN', {
    fanfare(x) {
      const nc = x.necrocharge();
      const P = x.P();
      let names = [MIMI, COCO];
      if (P.fieldLimit - P.field.length === 1) { // Q1998: room for one, the player picks which
        // Not a "Choose" of options (the crest must not widen it): a plain one-of-two question.
        const k = x.ask({ kind: 'mode', prompt: 'Cerberus: there is room for one token. Summon which?', options: [{ label: MIMI, enabled: true }, { label: COCO, enabled: true }] });
        names = [names[k]];
      }
      const toks = names.flatMap((n) => x.summonToken(n));
      if (nc >= 10) for (const t of toks) x.give(t, 'Storm');
    },
    activated: [{
      text: 'Engage, bury another follower: deal 2 damage to an enemy follower',
      cost: { engage: true },
      can: (s, me) => SV.followers(s, s.cards[me].ctrl).some((i) => i !== me),
      why: () => 'You have no other follower to bury.',
      pay(x) {
        const t = x.selectOne(x.followers(x.ctrl).filter((i) => i !== x.me), 'Cerberus: choose another follower on your field to bury.', { aura: false });
        if (t) x.bury(t);
      },
      run(x) { const t = x.selectOne(x.followers(x.opp), 'Cerberus: select an enemy follower. Deal it 2 damage.'); if (t) x.damage(t, 2); },
    }],
  });
  // BP16-T04EN Mimi, Right Paw Hellhound (token)
  // [lastwords] Select an enemy follower on the field. Deal it 2 damage and bury the top card of your deck.
  card('BP16-T04EN', {
    lastWords(x) { const t = x.selectOne(x.followers(x.opp), 'Mimi: select an enemy follower. Deal it 2 damage.'); if (t) { x.damage(t, 2); buryTop(x, 1); } },
  });
  // BP16-T05EN Coco, Left Paw Hellhound (token)
  // [lastwords] Give your leader [defense]+2. Bury the top card of your deck.
  card('BP16-T05EN', { lastWords(x) { x.heal(x.ctrl, 2); buryTop(x, 1); } });

  // BP16-082EN Mukan, Shadowcrypt Ward (evolved)
  // Whenever a Departed follower is put onto your field, give your leader [defense]+1.
  // On Evolve - Select a Departed follower in your cemetery that costs 3 or less and summon it.
  // On Super-Evolve - Select a Departed follower in your cemetery that costs 3 or less. Summon it and give it Assail.
  const mukanCand = (x) => x.cemetery().filter((i) => x.isFollower(i) && x.hasTrait(i, 'Departed') && (x.cost(i) || 0) <= 3);
  card('BP16-082EN', {
    triggers: [{
      name: 'Departed follower: +1 defense', on: 'enter',
      when: (s, me, ev) => ev.p === s.cards[me].ctrl && s.cards[ev.iid].zone === 'field' && SV.isFollower(s, ev.iid) && SV.chars(s, ev.iid).traits.includes('Departed'), // Q1999/Q2000
      run(x) { x.heal(x.ctrl, 1); },
    }],
    onEvolve(x) { const t = x.selectOne(mukanCand(x), 'Mukan: select a Departed follower that costs 3 or less in your cemetery to summon.', { aura: false }); if (t) x.summon(t); },
    onSuperEvolve(x) { const t = x.selectOne(mukanCand(x), 'Mukan: select a Departed follower that costs 3 or less in your cemetery. Summon it and give it Assail.', { aura: false }); if (t && x.summon(t)) x.give(t, 'Assail'); },
  });

  // ================================================================ Sanguine

  // BP05-069EN Valnareik, Omen of Lust
  // While Sanguine is active for you, this follower has Storm.
  // Strike: Deal X damage to each enemy leader. X equals the number of times your leader has lost defense this turn. If your leader's defense is 7, give this follower [attack]+2/[defense]+2.
  const sanguineStorm = (s, me, t, r) => { if (t === me && SV.sanguine(s, s.cards[me].ctrl)) r.kw.Storm = true; };
  card('BP05-069EN', {
    auras: [sanguineStorm],
    strike(x) {
      x.damage(x.leader(x.opp), lostTimes(x.s, x.ctrl)); // Q694/Q695
      if (x.P().defense === 7 && x.onField(x.me)) x.buff(x.me, { atk: 2, def: 2 }); // Q693
    },
  });

  // BP05-078EN Wings of Lust
  // Choose up to 2 of the following. (1) Select a follower on your field. Give it Rush and deal 1 damage to your leader. (2) Select an enemy follower on the field. Deal 2 damage to it and 1 damage to your leader. (3) Deal 1 damage to your leader. Draw a card. Discard a card.
  card('BP05-078EN', {
    spell(x) {
      const mine = x.followers(x.ctrl), en = selEnemies(x.s, x.ctrl);
      // Q704: an option whose target can't be selected can't be chosen (CR 5.18.3.1.2).
      const pick = x.choose('Wings of Lust: choose up to 2.', [
        { label: 'Give a follower on your field Rush and deal 1 damage to your leader.', can: mine.length > 0 },
        { label: 'Deal 2 damage to an enemy follower and 1 damage to your leader.', can: en.length > 0 },
        { label: 'Deal 1 damage to your leader. Draw a card. Discard a card.' },
      ], 1, 2);
      if (pick.includes(0)) { const t = x.selectOne(x.followers(x.ctrl), 'Wings of Lust: select a follower on your field. Give it Rush.'); if (t) { x.give(t, 'Rush'); x.damage(x.leader(x.ctrl), 1); } }
      if (pick.includes(1)) { const t = x.selectOne(x.followers(x.opp), 'Wings of Lust: select an enemy follower. Deal it 2 damage.'); if (t) { x.damage(t, 2); x.damage(x.leader(x.ctrl), 1); } }
      if (pick.includes(2)) { x.damage(x.leader(x.ctrl), 1); x.draw(1); x.chooseDiscard(1); }
    },
  });

  // BP10-080EN Demonium, Clash Devil
  // Bane. Drain.                               (engine-read)
  // [fanfare] If Sanguine is active for you, give this follower [attack]+1/[defense]+1, Rush, and Assail.
  // Strike - Deal each enemy leader damage equal to this follower's attack.
  card('BP10-080EN', {
    fanfare(x) { if (x.sanguine() && x.onField(x.me)) x.buff(x.me, { atk: 1, def: 1, kw: { Rush: true, Assail: true } }); },
    strike(x) { if (x.onField(x.me)) x.damage(x.leader(x.opp), x.chars(x.me).atk); }, // Q1315: ability damage, no Drain
  });

  // BP13-073EN Laura, Crimson Strife
  // During your turn, whenever your leader loses defense, choose one that you haven't chosen this turn. (1) Select an enemy follower on the field and deal it damage equal to the number of times your leader has lost defense this turn. (2) Give this follower [attack]+1/[defense]+1. (3) Give this follower Storm.
  card('BP13-073EN', {
    triggers: [{
      name: 'Leader lost defense', on: 'defenseLost', when: myLeaderLostOnMyTurn,
      run(x) {
        const used = (k) => !!x.s.ti.once[`once:${x.me}:laura${k}`]; // per copy, per turn (Q1726)
        const en = selEnemies(x.s, x.ctrl);
        const pick = x.choose("Laura: choose one you haven't chosen this turn.", [
          { label: 'Deal an enemy follower damage equal to the times your leader lost defense this turn.', can: !used(0) && en.length > 0 }, // Q1724
          { label: 'Give this follower +1/+1.', can: !used(1) },
          { label: 'Give this follower Storm.', can: !used(2) },
        ]);
        for (const k of pick) x.once(`laura${k}`);
        if (pick.includes(0)) { const t = x.selectOne(x.followers(x.opp), 'Laura: select an enemy follower.'); if (t) x.damage(t, lostTimes(x.s, x.ctrl)); }
        if (pick.includes(1) && x.onField(x.me)) x.buff(x.me, { atk: 1, def: 1 });
        if (pick.includes(2) && x.onField(x.me)) x.give(x.me, 'Storm');
      },
    }],
  });

  // BP15-076EN Valnareik, Lustful Desire
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // While Sanguine is active for you, this has Storm.
  // [fanfare] If your leader's defense is 7, give this [attack]+2/[defense]+2.
  card('BP15-076EN', {
    auras: [sanguineStorm],
    fanfare(x) { if (x.P().defense === 7 && x.onField(x.me)) x.buff(x.me, { atk: 2, def: 2 }); },
  });
  // BP15-077EN Valnareik, Lustful Desire (evolved)
  // While Sanguine is active for you, this has Storm.
  // On Evolve - Choose 1. (1) Put a Wings of Desire token into your EX area. (2) Draw a card.
  card('BP15-077EN', {
    auras: [sanguineStorm],
    onEvolve(x) {
      const pick = x.choose('Valnareik: choose 1.', [{ label: 'Put a Wings of Desire token into your EX area.' }, { label: 'Draw a card.' }]);
      if (pick.includes(0)) x.tokenToEx('Wings of Desire');
      if (pick.includes(1)) x.draw(1);
    },
  });
  // BP15-PR14EN Wings of Desire (token spell)
  // Select a follower on your field. Give it "Strike - Deal each enemy follower on the field damage equal to the number of times your leader has lost defense this turn" and deal 1 damage to your leader.
  // The granted Strike (CR 10.7) is hosted in s.effects by x.addTrigger, since this token is gone after
  // resolving. It belongs to that follower only while it stays on the field (CR 5.27): the follower gets a
  // marker mod (mods are cleared when it leaves the field), and the trigger checks the marker, so a card
  // that leaves and comes back is a new object without the Strike. Two grants are two Strikes.
  card('BP15-PR14EN', {
    canPlay: (s, iid) => SV.followers(s, s.cards[iid].owner).length > 0, // CR 10.6.2.3.3
    spell(x) {
      const t = x.selectOne(x.followers(x.ctrl), 'Wings of Desire: select a follower on your field. Give it the Strike and deal 1 damage to your leader.');
      if (!t) return;
      const gid = `wings${x.s.logN}`;
      x.buff(t, { wingsGrant: gid }, null, 'Strike - deal each enemy follower damage equal to the times your leader lost defense this turn');
      x.addTrigger(0, null, { target: t, gid });
      x.damage(x.leader(x.ctrl), 1);
    },
    effectTriggers: [{
      name: 'Strike (Wings of Desire)', on: 'attack',
      when: (s, e, ev) => ev.iid === e.target && s.cards[e.target].zone === 'field' && s.cards[e.target].mods.some((m) => m.wingsGrant === e.gid),
      run(x, ev) { const p = x.s.cards[ev.iid].ctrl; x.damageMany(SV.followers(x.s, 1 - p), lostTimes(x.s, p)); },
    }],
  });

  // BP17-074EN Urias, Final Vampire
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Put an A Horrible Night token into your EX area.
  card('BP17-074EN', { fanfare(x) { x.tokenToEx('A Horrible Night'); } });
  // BP17-075EN Urias, Final Vampire (evolved)
  // On Evolve - Choose up to 3. (1) Select an enemy follower on the field. Deal 3 damage to it and 1 damage to your leader. (2) Deal 1 damage to your leader and each enemy follower on the field. (3) Deal 1 damage to your leader. Draw a card.
  card('BP17-075EN', {
    onEvolve(x) {
      const pick = x.choose('Urias: choose up to 3.', [ // Q2099: each option once
        { label: 'Deal 3 damage to an enemy follower and 1 damage to your leader.', can: selEnemies(x.s, x.ctrl).length > 0 },
        { label: 'Deal 1 damage to your leader and each enemy follower.' },
        { label: 'Deal 1 damage to your leader. Draw a card.' },
      ], 1, 3);
      if (pick.includes(0)) { const t = x.selectOne(x.followers(x.opp), 'Urias: select an enemy follower. Deal it 3 damage.'); if (t) { x.damage(t, 3); x.damage(x.leader(x.ctrl), 1); } }
      if (pick.includes(1)) x.damageMany([x.leader(x.ctrl), ...x.followers(x.opp)], 1);
      if (pick.includes(2)) { x.damage(x.leader(x.ctrl), 1); x.draw(1); }
    },
  });
  // BP17-T07EN A Horrible Night (token spell)
  // This can't be played if you've played another A Horrible Night this turn.
  // ----------
  // For the rest of this turn, whenever your leader loses defense, deal 1 damage to each enemy leader and give your leader [defense]+1.
  const playedThisTurn = (s, p, name) => s.log.some((e) => e.turn === s.turn && e.type === 'play' && e.who === p && base(s, e.iid).name === name);
  card('BP17-T07EN', {
    canPlay: (s, iid) => !playedThisTurn(s, s.cards[iid].owner, 'A Horrible Night'),
    cantPlayWhy: () => "You've already played an A Horrible Night this turn.",
    spell(x) { x.addTrigger(0, x.until.eot()); },
    // Q2119: once per instance of lost defense; Q2120: you can lose at 0 defense before it resolves.
    effectTriggers: [{
      name: 'A Horrible Night', on: 'defenseLost', when: (s, e, ev) => ev.p === e.p,
      run(x) { x.damage(x.leader(x.opp), 1); x.heal(x.ctrl, 1); },
    }],
  });

  // BP19-075EN Garodeth, Insurgent Convict
  // [evolve] [cost05]: Evolve this.            (engine-read)
  // During your turn, whenever your leader loses defense, if your leader has lost defense at least 4 times this turn, evolve this.
  // [fanfare] Deal 1 damage to your leader.
  card('BP19-075EN', {
    fanfare(x) { x.damage(x.leader(x.ctrl), 1); },
    triggers: [{
      name: 'Evolve this', on: 'defenseLost',
      when: (s, me, ev) => myLeaderLostOnMyTurn(s, me, ev) && lostTimes(s, ev.p) >= 4, // intervening "if": checked again on resolution
      run(x) { if (lostTimes(x.s, x.ctrl) >= 4 && x.onField(x.me)) x.evolve(x.me); }, // Q2379: not the evolve ability
    }],
  });
  // BP19-076EN Garodeth, Insurgent Convict (evolved)
  // Storm.                                     (engine-read)
  // On Evolve - Select an enemy follower on the field and deal it 8 damage.
  card('BP19-076EN', {
    onEvolve(x) { const t = x.selectOne(x.followers(x.opp), 'Garodeth: select an enemy follower. Deal it 8 damage.'); if (t) x.damage(t, 8); },
  });

  // BP19-085EN Raging Commander
  // Any Garodeth, Insurgent Convict you play costs 1 less.
  // [fanfare] Deal 1 damage to your leader. Draw a card.
  // 4 times on each of your turns, when your leader loses defense, select an enemy follower on the field and deal it 1 damage.
  const GARODETH = 'Garodeth, Insurgent Convict';
  card('BP19-085EN', {
    costAura: (s, me, iid, p) => (p === s.cards[me].ctrl && base(s, iid).name === GARODETH ? -1 : 0), // Q2382: each copy
    fanfare(x) { x.damage(x.leader(x.ctrl), 1); x.draw(1); },
    triggers: [{
      name: 'Deal 1 damage', on: 'defenseLost', when: myLeaderLostOnMyTurn, limit: 4, // Q2383: per copy
      run(x) { const t = x.selectOne(x.followers(x.opp), 'Raging Commander: select an enemy follower. Deal it 1 damage.'); if (t) x.damage(t, 1); },
    }],
  });

  // BP19-086EN Vicious Blitzer
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Deal 1 damage to your leader. If there's a Garodeth, Insurgent Convict on your field, evolve this.
  card('BP19-086EN', {
    fanfare(x) {
      x.damage(x.leader(x.ctrl), 1);
      if (x.field(x.ctrl).some((i) => x.named(i, GARODETH)) && x.onField(x.me)) x.evolve(x.me); // Q2356
    },
  });
  // BP19-087EN Vicious Blitzer (evolved)
  // On Evolve - Deal 1 damage to each leader.
  card('BP19-087EN', { onEvolve(x) { x.damageMany([x.leader(x.ctrl), x.leader(x.opp)], 1); } });

  // BP19-089EN Steamrolling Tank
  // Ward.                                      (engine-read)
  // [fanfare] Deal 1 damage to your leader.
  // 4 times on each of your turns, when your leader loses defense, give your leader [defense]+1.
  card('BP19-089EN', {
    fanfare(x) { x.damage(x.leader(x.ctrl), 1); }, // Q2384: at 1 defense you lose before the trigger resolves
    triggers: [{ name: 'Give your leader +1', on: 'defenseLost', when: myLeaderLostOnMyTurn, limit: 4, run(x) { x.heal(x.ctrl, 1); } }],
  });

  // BP19-090EN Howling Scream
  // Choose up to 2. (1) [cost01]: Select an enemy follower on the field. Deal 2 damage to it and 1 damage to your leader. (2) [cost01]: Deal 1 damage to your leader. Draw a card.
  card('BP19-090EN', {
    spell(x) {
      const pick = x.choose('Howling Scream: choose up to 2.', [ // Q2399 at least 1; Q2365 each once
        { label: '[1 play point]: deal 2 damage to an enemy follower and 1 damage to your leader.', can: selEnemies(x.s, x.ctrl).length > 0 },
        { label: '[1 play point]: deal 1 damage to your leader. Draw a card.' },
      ], 1, 2);
      // Q2400: each chosen option's cost may be left unpaid, and then nothing happens for it.
      if (pick.includes(0) && x.mayPay({ pp: 1 }, 'Howling Scream (1): pay 1 play point to deal 2 damage to an enemy follower and 1 to your leader?')) {
        const t = x.selectOne(x.followers(x.opp), 'Howling Scream: select an enemy follower. Deal it 2 damage.');
        if (t) { x.damage(t, 2); x.damage(x.leader(x.ctrl), 1); }
      }
      if (pick.includes(1) && x.mayPay({ pp: 1 }, 'Howling Scream (2): pay 1 play point to deal 1 damage to your leader and draw a card?')) { x.damage(x.leader(x.ctrl), 1); x.draw(1); }
    },
  });

  // BP19-091EN Prison of Pain
  // [fanfare] Place 2 pain counters on this. Draw a card.
  // [act] [engage], remove a pain counter from this: Deal 1 damage to your leader. If this has no pain counters, bury it.
  card('BP19-091EN', {
    fanfare(x) { if (x.onField(x.me)) x.counter(x.me, 'pain', 2); x.draw(1); },
    activated: [{
      text: 'Engage, remove a pain counter: deal 1 damage to your leader',
      cost: { engage: true },
      can: (s, me) => (s.cards[me].counters.pain || 0) > 0,
      why: () => 'It has no pain counters.',
      pay(x) { x.counter(x.me, 'pain', -1); },
      run(x) { x.damage(x.leader(x.ctrl), 1); if (x.onField(x.me) && x.counters(x.me, 'pain') === 0) x.bury(x.me); },
    }],
  });

  // PR-409EN Sanguine Necklace
  // [act] [engage], bury this: Deal 1 damage to your leader. Draw a card.
  card('PR-409EN', {
    activated: [{
      text: 'Engage, bury this: deal 1 damage to your leader, draw a card',
      cost: { engage: true },
      pay(x) { x.bury(x.me); },
      run(x) { x.damage(x.leader(x.ctrl), 1); x.draw(1); },
    }],
  });

  // ================================================================ Omen / Entwining

  // BP10-074EN VI. Milteo, The Lovers
  // [fanfare] Discard a card: Reveal cards from the top of your deck until you reveal 2 followers that cost 3 or less. Summon them. Shuffle the rest and put them on the bottom of your deck.
  // At the start of your end phase, Necrocharge (20) - Evolve this follower.
  card('BP10-074EN', {
    fanfare(x) {
      if (!x.hand().length) return;
      const d = x.select({ from: x.hand(), min: 0, max: 1, aura: false, prompt: 'Milteo: you may discard a card to reveal cards until 2 followers that cost 3 or less, and summon them.' });
      if (!d.length) return;
      x.discard(d[0]);
      const revealed = [], found = [];
      for (const c of x.deck()) {
        revealed.push(c);
        if (x.isFollower(c) && (x.cost(c) || 0) <= 3) { found.push(c); if (found.length === 2) break; }
      }
      x.reveal(revealed);
      const P = x.P(), room = P.fieldLimit - P.field.length;
      // Q1303: room for fewer than the revealed followers: the player chooses which to summon.
      const summon = found.length > room ? (room > 0 ? x.select({ from: found, min: room, max: room, aura: false, prompt: 'Milteo: not enough room. Choose the follower(s) to summon.' }) : []) : found;
      for (const c of summon) x.summon(c);
      const rest = revealed.filter((i) => !summon.includes(i)); // Q1301/Q1302
      SV.shuffleInPlace(x.s, rest);
      for (const c of rest) x.toDeck(c, 'bottom');
    },
    endStart(x) { if (x.necrocharge() >= 20 && x.onField(x.me)) x.evolve(x.me); }, // Q1300: not the evolve ability
  });
  // BP10-075EN VI. Milteo, The Lovers (evolved)
  // On Evolve - [cost02]: Destroy each enemy follower on the field. Change each enemy leader's defense to 6.
  card('BP10-075EN', {
    onEvolve(x) {
      if (!x.mayPay({ pp: 2 }, 'Milteo: pay 2 play points to destroy each enemy follower and change the enemy leader\'s defense to 6?')) return;
      x.destroyAll(x.followers(x.opp));
      x.setDefense(x.opp, 6); // Q1304: also when it is 5 or less
    },
  });

  // BP20-075EN Rulenye & Valnareik (evolved)
  // On Evolve - Choose 1. (1) Summon 2 Rulenye, Echoing Scream tokens. (2) Give this Storm. Give each [abysscraft] Omen follower on your field [attack]+1.
  card('BP20-075EN', {
    onEvolve(x) {
      const pick = x.choose('Rulenye & Valnareik: choose 1.', [
        { label: 'Summon 2 Rulenye, Echoing Scream tokens.' },
        { label: 'Give this Storm. Give each abysscraft Omen follower on your field +1 attack.' },
      ]);
      if (pick.includes(0)) x.summonToken('Rulenye, Echoing Scream', 2);
      if (pick.includes(1)) {
        if (x.onField(x.me)) x.give(x.me, 'Storm');
        for (const f of x.followers(x.ctrl).filter((i) => isOmenAbyss(x.s, i))) x.buff(f, { atk: 1 });
      }
    },
  });

  // BP20-077EN Sham-Nacha, Heir to Entwining (evolved)
  // On Evolve - Put a Crest: Sham-Nacha, Heir to Entwining token into your EX area.
  // On Super-Evolve - Select an [abysscraft] Omen follower in your cemetery. Summon it and evolve it.
  card('BP20-077EN', {
    onEvolve(x) { x.tokenToEx('Crest: Sham-Nacha, Heir to Entwining'); },
    onSuperEvolve(x) {
      const t = x.selectOne(x.cemetery().filter((i) => x.isFollower(i) && isOmenAbyss(x.s, i)), 'Sham-Nacha: select an abysscraft Omen follower in your cemetery. Summon it and evolve it.', { aura: false });
      if (!t || !x.summon(t) || !x.onField(t)) return;
      // Q2431 no evolve cost; Q2432 the player may choose not to evolve it.
      if (SV.evolveCandidates(x.s, t).length && x.may(`Sham-Nacha: evolve ${x.name(t)}?`, 'Evolve', "Don't")) x.evolve(t);
    },
  });
  // BP20-T06EN Crest: Sham-Nacha, Heir to Entwining (crest token: valid in the EX area, CR 10.3.6)
  // If you would choose 1 or more options, choose any number instead.
  // x.choose reads `chooseAnyNumber` for every card (Q2451 at least 1, Q2450 each once, Q2452 printed order).
  card('BP20-T06EN', {
    audit: '1: choose 1 or more is the min >= 1 check in x.choose (chooseAnyNumber)', chooseAnyNumber: true });

  // BP20-080EN Congregant of Entwining (evolved)
  // On Evolve - Choose 1. (1) Select an enemy follower on the field and deal it 5 damage. (2) Select an [abysscraft] Omen follower in your cemetery that costs 3 or less and summon it. (3) Give each [abysscraft] Omen follower on your field [attack]+1/[defense]+1.
  card('BP20-080EN', {
    onEvolve(x) {
      const omen3 = x.cemetery().filter((i) => x.isFollower(i) && isOmenAbyss(x.s, i) && (x.cost(i) || 0) <= 3);
      const pick = x.choose('Congregant of Entwining: choose 1.', [
        { label: 'Deal 5 damage to an enemy follower.', can: selEnemies(x.s, x.ctrl).length > 0 },
        { label: 'Summon an abysscraft Omen follower that costs 3 or less from your cemetery.', can: omen3.length > 0 },
        { label: 'Give each abysscraft Omen follower on your field +1/+1.' },
      ]);
      if (pick.includes(0)) { const t = x.selectOne(x.followers(x.opp), 'Congregant: select an enemy follower. Deal it 5 damage.'); if (t) x.damage(t, 5); }
      if (pick.includes(1)) { const t = x.selectOne(x.cemetery().filter((i) => omen3.includes(i)), 'Congregant: select an abysscraft Omen follower that costs 3 or less in your cemetery to summon.', { aura: false }); if (t) x.summon(t); }
      if (pick.includes(2)) for (const f of x.followers(x.ctrl).filter((i) => isOmenAbyss(x.s, i))) x.buff(f, { atk: 1, def: 1 });
    },
  });

  // BP20-081EN Hervör
  // [fanfare] Choose 1. (1) Deal 4 damage to each enemy follower on the field. (2) Give your leader [defense]+4. Draw 2 cards.
  card('BP20-081EN', {
    fanfare(x) {
      const pick = x.choose('Hervör: choose 1.', [{ label: 'Deal 4 damage to each enemy follower.' }, { label: 'Give your leader +4 defense. Draw 2 cards.' }]);
      if (pick.includes(0)) x.damageMany(x.followers(x.opp), 4);
      if (pick.includes(1)) { x.heal(x.ctrl, 4); x.draw(2); }
    },
  });

  // BP20-082EN Screaming and Loathing
  // Choose 1. (1) Select an enemy follower on the field and deal it 3 damage. (2) Deal 2 damage to each enemy leader. (3) Draw a card. Discard a card. (4) Recover 1 play point.
  card('BP20-082EN', {
    spell(x) {
      const pick = x.choose('Screaming and Loathing: choose 1.', [
        { label: 'Deal 3 damage to an enemy follower.', can: selEnemies(x.s, x.ctrl).length > 0 },
        { label: 'Deal 2 damage to the enemy leader.' },
        { label: 'Draw a card. Discard a card.' },
        { label: 'Recover 1 play point.' },
      ]);
      if (pick.includes(0)) { const t = x.selectOne(x.followers(x.opp), 'Screaming and Loathing: select an enemy follower. Deal it 3 damage.'); if (t) x.damage(t, 3); }
      if (pick.includes(1)) x.damage(x.leader(x.opp), 2);
      if (pick.includes(2)) { x.draw(1); x.chooseDiscard(1); }
      if (pick.includes(3)) x.recoverPP(1);
    },
  });

  // BP20-085EN Supplicant of Entwining
  // [fanfare] Choose 1. (1) Select an enemy follower on the field and deal it 1 damage. (2) Deal 2 damage to each enemy leader. (3) Give your leader [defense]+2.
  card('BP20-085EN', {
    fanfare(x) {
      const pick = x.choose('Supplicant of Entwining: choose 1.', [
        { label: 'Deal 1 damage to an enemy follower.', can: selEnemies(x.s, x.ctrl).length > 0 },
        { label: 'Deal 2 damage to the enemy leader.' },
        { label: 'Give your leader +2 defense.' },
      ]);
      if (pick.includes(0)) { const t = x.selectOne(x.followers(x.opp), 'Supplicant: select an enemy follower. Deal it 1 damage.'); if (t) x.damage(t, 1); }
      if (pick.includes(1)) x.damage(x.leader(x.opp), 2);
      if (pick.includes(2)) x.heal(x.ctrl, 2);
    },
  });

  // BP20-086EN Castle of Entwining
  // [fanfare] Look at the top 3 cards of your deck. You may reveal an [abysscraft] Omen card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  // [act] [cost01], [engage], bury this: Choose 1. (1) Select a follower on your field and give it Rush. (2) Select a follower on your field and give it Assail.
  card('BP20-086EN', {
    fanfare(x) { x.lookPick({ n: 3, filter: (i) => isOmenAbyss(x.s, i), prompt: 'Castle of Entwining: you may reveal an abysscraft Omen card and add it to your hand.' }); },
    activated: [{
      text: 'Engage, bury this: give a follower on your field Rush or Assail',
      cost: { pp: 1, engage: true },
      pay(x) { x.bury(x.me); },
      run(x) {
        const has = x.followers(x.ctrl).length > 0;
        const pick = x.choose('Castle of Entwining: choose 1.', [{ label: 'Give a follower on your field Rush.', can: has }, { label: 'Give a follower on your field Assail.', can: has }]);
        if (pick.includes(0)) { const t = x.selectOne(x.followers(x.ctrl), 'Castle: select a follower on your field. Give it Rush.'); if (t) x.give(t, 'Rush'); }
        if (pick.includes(1)) { const t = x.selectOne(x.followers(x.ctrl), 'Castle: select a follower on your field. Give it Assail.'); if (t) x.give(t, 'Assail'); }
      },
    }],
  });

  // BP20-089EN Devotee of Entwining
  // [fanfare] Choose 1. (1) Select an enemy follower on the field and deal it 3 damage. (2) Deal 1 damage to each enemy leader and enemy follower on the field. (3) Draw a card.
  card('BP20-089EN', {
    fanfare(x) {
      const pick = x.choose('Devotee of Entwining: choose 1.', [
        { label: 'Deal 3 damage to an enemy follower.', can: selEnemies(x.s, x.ctrl).length > 0 },
        { label: 'Deal 1 damage to the enemy leader and each enemy follower.' },
        { label: 'Draw a card.' },
      ]);
      if (pick.includes(0)) { const t = x.selectOne(x.followers(x.opp), 'Devotee: select an enemy follower. Deal it 3 damage.'); if (t) x.damage(t, 3); }
      if (pick.includes(1)) x.damageMany([x.leader(x.opp), ...x.followers(x.opp)], 1);
      if (pick.includes(2)) x.draw(1);
    },
  });
})();
