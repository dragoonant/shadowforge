// universe card scripts (docs/ABILITIES.md): crossover cards (Umamusume: Pretty Derby, Cardfight!!
// Vanguard, Princess Connect! Re: Dive, THE IDOLM@STER CINDERELLA GIRLS). Printed text in the
// comment above each script, verbatim from data/cards.js.
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;

  // ------------------------------------------------------------ shared helpers
  // Definition/plain-state readers only (SV.chars computes activated abilities, whose `can`
  // predicates may call these, so reading chars here could recurse).
  const baseD = (s, i) => SV.CARDS[s.cards[i].id];
  const modsHave = (s, i, f) => s.cards[i].mods.some((m) => m.on !== false && f(m));
  const hasAura = (s, i) => !!SV.parsed(SV.def(i, s)).kw.Aura || modsHave(s, i, (m) => m.kw && m.kw.Aura);
  const selectableEnemies = (s, p) => SV.followers(s, 1 - p).filter((i) => !hasAura(s, i));
  const umaInCemetery = (s, p) => s.players[p].cemetery.filter((i) => baseD(s, i).traits.includes('Umamusume')).length;
  const pickEnemy = (x, prompt) => x.selectOne(x.followers(x.opp), prompt);

  // ------------------------------------------------------------ Umamusume: Pretty Derby

  // CP01-085EN Carrot (evolve-deck card)
  // You can serve a Carrot to an Umamusume follower to race it. (Racing followers have Rush.)
  // ----------
  // You can put up to 10 of this card into your evolve deck.
  // Reminder text only: serving, racing and the Rush of a racing follower are engine rules (CR 14.2,
  // engine serve/race), and the 10-copy limit is read by SV.deckProblems. No behaviour of its own.
  card('CP01-085EN', {});

  // ECP01-019EN Cheval Grand
  // [evolve] [cost01]: Evolve this follower.   (engine-read)
  // [feed] [cost01]: Race this follower.       (engine-read)
  // [fanfare] Select a faceup Carrot in your evolve deck and, if there are at least 10 Umamusume cards in your cemetery, turn it facedown.
  card('ECP01-019EN', {
    fanfare(x) {
      const carrots = x.P().evoDeck.filter((i) => x.s.cards[i].faceup && baseD(x.s, i).name === 'Carrot');
      const c = x.selectOne(carrots, 'Cheval Grand: select a faceup Carrot in your evolve deck (turned facedown if you have at least 10 Umamusume cards in your cemetery).', { aura: false });
      if (!c || umaInCemetery(x.s, x.ctrl) < 10) return;
      // No ctx door turns a card facedown; re-placing it in the evolve deck area facedown is the
      // engine's own zone door (SV.move -> placeIn sets faceup from opt.faceup for 'evoDeck').
      SV.move(x.s, c, 'evoDeck', { faceup: false });
    },
  });
  // ECP01-020EN Cheval Grand (evolved)
  // On Evolve - Select an enemy follower on the field and deal it 2 damage. If there are at least 10 Umamusume cards in your cemetery, deal 4 damage instead.
  // Twice on each of your turns, when an enemy follower that took damage this turn from an Umamusume card you control is put from the field into the cemetery, draw a card, then discard a card.
  // "Took damage this turn from an Umamusume card you control" is read from the game log's damage
  // entries of this turn (the dealing card's controller at that time and its printed traits), so
  // damage dealt before this Cheval Grand reached the field counts too.
  const tookUmaDamage = (s, iid, p) => s.log.some((e) => e.type === 'damage' && e.turn === s.turn && e.iid === iid && e.amount > 0 && e.src != null && e.who === p && baseD(s, e.src).traits.includes('Umamusume'));
  card('ECP01-020EN', {
    onEvolve(x) {
      const t = pickEnemy(x, 'Cheval Grand: select an enemy follower. Deal it 2 damage (4 with at least 10 Umamusume cards in your cemetery).');
      if (t) x.damage(t, umaInCemetery(x.s, x.ctrl) >= 10 ? 4 : 2);
    },
    triggers: [{
      name: 'Draw, then discard', on: 'leave', limit: 2,
      when: (s, me, ev) => {
        const p = s.cards[me].ctrl;
        return s.active === p && ev.to === 'cemetery' && ev.ctrl !== p && ev.info && ev.info.type === 'follower' && tookUmaDamage(s, ev.iid, p); // Q1772: buried counts too
      },
      run(x) { x.draw(1); x.chooseDiscard(1); },
    }],
  });

  // ECP01-048EN Mejiro Ramonu
  // [feed] [cost01]: Race this follower.       (engine-read)
  // [fanfare] Choose up to X, where X equals the number of Mejiro Family cards on your field. (1) Select an enemy follower on the field and banish it. (2) Give this follower Storm. (3) Give your leader [defense]+2. Draw a card.
  card('ECP01-048EN', {
    fanfare(x) {
      const X = x.field(x.ctrl).filter((i) => x.hasTrait(i, 'Mejiro Family')).length;
      if (X < 1) return; // 5.18.2.2
      const pick = x.choose(`Mejiro Ramonu: choose up to ${X}.`, [
        { label: 'Select an enemy follower and banish it.', can: selectableEnemies(x.s, x.ctrl).length > 0 }, // Q1793
        { label: 'Give this follower Storm.', can: x.onField(x.me) },
        { label: 'Give your leader +2 defense. Draw a card.' },
      ], 1, X); // Q1761/Q1791: each option at most once
      // Q1792: the target is selected first.
      if (pick.includes(0)) { const t = pickEnemy(x, 'Mejiro Ramonu: select an enemy follower to banish.'); if (t) x.banish(t); }
      if (pick.includes(1)) x.give(x.me, 'Storm');
      if (pick.includes(2)) { x.heal(x.ctrl, 2); x.draw(1); }
    },
  });

  // ECP01-051EN Mejiro Ardan [Hopeful Petals Dancing in the Night]
  // [feed] [cost01]: Race this follower.       (engine-read)
  // On Race - Give this follower [attack]+1/[defense]+1. Search your deck for up to 2 Mejiro Family followers and/or Mejiro Family amulets that cost a total of 6 or less, summon them, then shuffle.
  card('ECP01-051EN', {
    triggers: [{
      name: 'On Race', on: 'raced',
      when: (s, me, ev) => ev.iid === me, // CR 14.2.4.2
      run(x) {
        if (x.onField(x.me)) x.buff(x.me, { atk: 1, def: 1 });
        const ok = (i) => { const d = baseD(x.s, i); const t = SV.parsed(d).type; return d.traits.includes('Mejiro Family') && (t === 'follower' || t === 'amulet'); };
        const found = x.search({ filter: ok, min: 0, max: 2, sumCostMax: 6, prompt: 'Mejiro Ardan: search your deck for up to 2 Mejiro Family followers and/or amulets that cost a total of 6 or less.' });
        for (const i of found) x.summon(i);
        x.afterSearch();
      },
    }],
  });

  // ECP01-053EN Mejiro Palmer [Moonlit Devil ♪]
  // [feed] [cost01]: Race this follower.       (engine-read)
  // Storm.                                     (engine-read)
  // This card doesn't refresh during your start phase.
  // At the start of your main phase, [cost01]: Refresh this card.
  card('ECP01-053EN', {
    auras: [(s, me, t, r) => { if (t === me && s.cards[me].zone === 'field') r.flags.noRefresh = true; }],
    mainStart(x) {
      // Q1798: the cost is optional. Refreshing a reserved card does nothing (CR 1.3.2.1), so it's
      // only offered while this is engaged.
      if (!x.onField(x.me) || !x.engaged(x.me)) return;
      if (x.mayPay({ pp: 1 }, 'Mejiro Palmer: pay 1 play point to refresh it?')) x.refresh(x.me);
    },
  });

  // ------------------------------------------------------------ THE IDOLM@STER CINDERELLA GIRLS

  // CP02-062EN Unbound Emotion
  // This card costs 1 more to play for every follower on the field.
  // ----------
  // Deal 7 damage to each follower on the field.
  card('CP02-062EN', {
    selfCost: (s) => SV.followers(s).length,
    spell(x) { x.damageMany(x.followers(), 7); },
  });

  // CP02-075EN Whispers of a Dream
  // [quick]                                    (engine-read)
  // Select an enemy follower that costs 3 or less on the field. Destroy it and bury the top card of your deck.
  const cost3 = (s, i) => (baseD(s, i).cost || 0) <= 3; // Q946: an evolved follower keeps its cost
  card('CP02-075EN', {
    canPlay: (s, iid) => selectableEnemies(s, s.cards[iid].owner).some((i) => cost3(s, i)),
    spell(x) {
      const t = x.selectOne(x.followers(x.opp).filter((i) => cost3(x.s, i)), 'Whispers of a Dream: select an enemy follower that costs 3 or less. Destroy it.');
      if (!t) return;
      x.destroy(t);
      const top = x.deck()[0];
      if (top) x.bury(top);
    },
  });

  // ------------------------------------------------------------ Cardfight!! Vanguard

  // CP03-115EN Goddess of the Crescent Moon, Tsukuyomi
  // [fanfare] Look at the top 3 cards of your deck. Put any number of them on the top of your deck in any order. Put the rest on the bottom in any order.
  // [act] [engage]: Reveal the top card of your deck. If you revealed a Goddess of the Half Moon, Tsukuyomi, add it to your hand.
  card('CP03-115EN', {
    fanfare(x) {
      const top = x.deck().slice(0, 3);
      if (!top.length) return;
      const keep = x.select({ from: top, seen: top, min: 0, max: top.length, aura: false, prompt: 'Tsukuyomi: choose any number of these to put back on top of your deck (the rest go to the bottom).' });
      const topOrder = x.order(keep, 'Order the cards for the top of your deck (first = topmost).');
      const botOrder = x.order(top.filter((i) => !keep.includes(i)), 'Order the cards for the bottom of your deck (first = topmost of them).');
      // Same moves as x.lookPick (hidden-zone reordering is not logged card by card).
      for (const i of botOrder) SV.move(x.s, i, 'deck', { pos: 'bottom' });
      for (const i of topOrder.slice().reverse()) SV.move(x.s, i, 'deck', { pos: 'top' });
    },
    activated: [{
      text: 'Engage: reveal the top card of your deck',
      cost: { engage: true },
      run(x) {
        const top = x.deck()[0];
        if (!top) return;
        x.reveal([top]);
        if (x.name(top) === 'Goddess of the Half Moon, Tsukuyomi') x.toHand(top);
      },
    }],
  });

  // CP03-126EN Powers Converged
  // Choose one. If there are at least 3 faceup cards named Drive Point in your evolve deck, choose up to 3 instead. (1) Select an enemy follower on the field and deal it 4 damage. (2) Select a follower in your cemetery and add it to your hand. (3) Give your leader [defense]+4.
  card('CP03-126EN', {
    spell(x) {
      // Q1454: Drive Points linked to followers are in the drive zone, not faceup in the evolve deck.
      const dp = x.P().evoDeck.filter((i) => x.s.cards[i].faceup && baseD(x.s, i).name === 'Drive Point').length;
      const max = dp >= 3 ? 3 : 1;
      const cemF = x.cemetery().filter((i) => SV.parsed(baseD(x.s, i)).type === 'follower');
      const pick = x.choose(max === 3 ? 'Powers Converged: choose up to 3.' : 'Powers Converged: choose one.', [
        { label: 'Select an enemy follower and deal it 4 damage.', can: selectableEnemies(x.s, x.ctrl).length > 0 },
        { label: 'Select a follower in your cemetery and add it to your hand.', can: cemF.length > 0 },
        { label: 'Give your leader +4 defense.' },
      ], 1, max); // Q1455: each option once
      if (pick.includes(0)) { const t = pickEnemy(x, 'Powers Converged: select an enemy follower. Deal it 4 damage.'); if (t) x.damage(t, 4); }
      if (pick.includes(1)) { const c = x.selectOne(cemF, 'Powers Converged: select a follower in your cemetery to add to your hand.', { aura: false }); if (c) x.toHand(c); }
      if (pick.includes(2)) x.heal(x.ctrl, 4);
    },
  });

  // ------------------------------------------------------------ Princess Connect! Re: Dive

  // CP04-055EN Sheffy
  // [UB][fanfare] Select an enemy follower on the field. It doesn't refresh during its controller's next start phase.
  // ----------
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] If Overflow is active for you, equip this with an Eisdrache token.
  // The [UB] Fanfare is not scripted: every registered deck is class-based, and Union Burst
  // abilities are invalid in a deck not based on Princess Connect! Re: Dive (CR 14.5.1.2).
  card('CP04-055EN', {
    fanfare(x) { if (x.overflow() && x.onField(x.me)) x.equip(x.me, 'Eisdrache'); },
  });
  // CP04-056EN Sheffy (evolved)
  // On Evolve - Select up to 2 enemy followers on the field and deal 2 damage divided between them.
  // On Super-Evolve - Deal 3 damage to each enemy follower on the field.
  card('CP04-056EN', {
    onEvolve(x) {
      const ts = x.select({ from: x.followers(x.opp), min: 0, max: 2, prompt: 'Sheffy: select up to 2 enemy followers. Deal 2 damage divided between them.' });
      // CR 10.6.2.4.2: each selected target gets at least 1, so two targets take 1 each (no choice left).
      if (ts.length) x.damageMany(ts, ts.length === 1 ? 2 : 1);
    },
    onSuperEvolve(x) { x.damageMany(x.followers(x.opp), 3); },
  });

  // CP04-062EN Until We Meet Again
  // Choose 1. (1) Increase your max play points by 1. Give your leader [defense]+1. (2) If you have 10 max play points, search your deck for a 2-cost PriConne follower, summon it, then shuffle.
  card('CP04-062EN', {
    spell(x) {
      const [k] = x.choose('Until We Meet Again: choose 1.', [
        { label: 'Increase your max play points by 1. Give your leader +1 defense.' },
        { label: 'If you have 10 max play points, search your deck for a 2-cost PriConne follower and summon it.' }, // Q2249: choosable below 10
      ]);
      if (k === 0) { x.gainMaxPP(1); x.heal(x.ctrl, 1); return; }
      if (k !== 1 || x.P().maxPP < 10) return;
      const [f] = x.search({ filter: (i) => { const d = baseD(x.s, i); return d.cost === 2 && d.traits.includes('PriConne') && SV.parsed(d).type === 'follower'; }, max: 1, prompt: 'Search your deck for a 2-cost PriConne follower to summon.' });
      if (f) x.summon(f);
      x.afterSearch();
    },
  });

  // CP04-T08EN Eisdrache (equipment token)
  // When a follower equips this, select an enemy follower on the field. Engage it and give the equipped follower [attack]+2/[defense]+2.
  // ----------
  // (Place this beneath the equipped follower.)
  card('CP04-T08EN', {
    triggers: [{
      name: 'Equipped', on: 'equipped', zone: 'equip',
      when: (s, me, ev) => ev.token === me, // CR 14.5.2.2.2
      run(x, ev) {
        const t = pickEnemy(x, 'Eisdrache: select an enemy follower. Engage it and give the equipped follower +2/+2.');
        if (!t) return; // CR 10.6.2.3.3: no target, the ability is not played
        x.engage(t);
        // Q2340: the buff is on the follower and stays even if it later loses its abilities.
        if (x.onField(ev.iid)) x.buff(ev.iid, { atk: 2, def: 2 });
      },
    }],
  });
})();
