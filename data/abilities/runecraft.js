// runecraft card scripts (docs/ABILITIES.md). One SV.card per card number; printed text in the
// comment above each, verbatim from data/cards.js.
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;

  // ------------------------------------------------------------ shared helpers
  // These read definitions and plain state, never SV.chars: chars() computes activated abilities,
  // whose `can` predicates call these helpers, so reading chars here would recurse.
  const baseD = (s, i) => SV.CARDS[s.cards[i].id];
  const modsHave = (s, i, f) => s.cards[i].mods.some((m) => m.on !== false && f(m));
  const hasT = (s, i, t) => SV.def(i, s).traits.includes(t) || modsHave(s, i, (m) => m.traits && m.traits.includes(t));
  const isIdol = (s, i) => hasT(s, i, 'Idolatry');
  // Idolatry cards (followers and amulets) on player p's field.
  const idolsOn = (s, p) => SV.field(s, p).filter((i) => isIdol(s, i));
  // Enemy followers player p can select (Aura, CR 12.15; printed or given by an effect on the card).
  // x.select re-applies the full Aura check when the selection is made.
  const hasAura = (s, i) => !!SV.parsed(SV.def(i, s)).kw.Aura || modsHave(s, i, (m) => m.kw && m.kw.Aura);
  const selectableEnemies = (s, p) => SV.followers(s, 1 - p).filter((i) => !hasAura(s, i));
  // "Condemned followers in your cemetery" (printed traits of cards in the cemetery).
  const condemnedInCemetery = (s, p) => s.players[p].cemetery.filter((i) => { const d = baseD(s, i); return d.traits.includes('Condemned') && SV.parsed(d).type === 'follower'; }).length;
  const isTestSubject = (s, i) => ['Volunteer Test Subject', 'Chimera Test Subject'].includes(SV.def(i, s).name);
  // A Machina follower on p's field that costs 6 or more (an evolved follower keeps its cost, CR 5.16.1.2).
  const machina6 = (s, p) => SV.followers(s, p).some((i) => hasT(s, i, 'Machina') && (baseD(s, i).cost || 0) >= 6);
  const ctrlOfT = (x, t) => x.s.cards[t].ctrl;

  // "Select an enemy follower on the field": ask (even with one candidate); null when none.
  const pickEnemy = (x, prompt) => x.selectOne(x.followers(x.opp), prompt);
  // "Bury another Idolatry card" as an optional cost of an automatic ability (CR 10.4.7.4):
  // asked on resolution; returns true if paid.
  function mayBuryAnotherIdol(x, what) {
    const cand = idolsOn(x.s, x.ctrl).filter((i) => i !== x.me);
    if (!cand.length) return false;
    const pick = x.select({ from: cand, min: 0, max: 1, prompt: `You may bury another Idolatry card on your field: ${what}` });
    if (!pick.length) return false;
    x.bury(pick[0]);
    return true;
  }

  // ------------------------------------------------------------ Omen of Destruction (Lishenna)

  // BP05-037EN Lishenna, Omen of Destruction
  // [fanfare] Put a Destruction in White and Destruction in Black token into your EX area.
  card('BP05-037EN', {
    fanfare(x) {
      const P = x.P();
      const room = P.exLimit - P.ex.length;
      if (room !== 1) { x.tokenToEx('Destruction in White'); x.tokenToEx('Destruction in Black'); return; } // both fit, or neither (the door logs noRoom)
      // Q664: with room for only one, the player chooses which token.
      const [k] = x.choose('Lishenna: your EX area has room for one token. Which one?', [{ label: 'Destruction in White' }, { label: 'Destruction in Black' }]);
      x.tokenToEx(k === 0 ? 'Destruction in White' : 'Destruction in Black');
    },
  });

  // BP05-T01EN Destruction in White (amulet token)
  // At the start of your main phase, give your leader [defense]+2.
  card('BP05-T01EN', {
    mainStart(x) { x.heal(x.ctrl, 2); },
  });

  // BP05-T02EN Destruction in Black (amulet token)
  // At the start of your main phase, deal 2 damage to each enemy leader.
  card('BP05-T02EN', {
    mainStart(x) { x.damage(x.leader(x.opp), 2); },
  });

  // BP05-041EN Destructive Refrain
  // Choose one of the following. (1) Search your deck for a Lishenna, Omen of Destruction, reveal it, add it to your hand, then shuffle your deck. (2) [cost02]: Deal X damage to each enemy follower on the field. X equals the number of Idolatry cards on your field.
  card('BP05-041EN', {
    spell(x) {
      const [k] = x.choose('Destructive Refrain: choose one.', [
        { label: 'Search your deck for a Lishenna, Omen of Destruction and add it to your hand.' },
        { label: 'Pay 2 play points: deal X damage to each enemy follower (X = Idolatry cards on your field).' },
      ]);
      if (k === 0) {
        // Q666: you may choose not to find it and simply shuffle.
        const [l] = x.search({ filter: (i) => x.name(i) === 'Lishenna, Omen of Destruction', max: 1, prompt: 'Search your deck for a Lishenna, Omen of Destruction.' });
        if (l) x.toHand(l);
        x.afterSearch();
      } else if (k === 1) {
        // Q665/Q666: the [cost02] is optional and paid on resolution, even if the spell cost 0.
        if (!x.mayPay({ pp: 2 }, 'Destructive Refrain: pay 2 play points to deal X damage to each enemy follower?')) return;
        const n = idolsOn(x.s, x.ctrl).length;
        x.damageMany(x.followers(x.opp), n);
      }
    },
  });

  // BP05-045EN Monochromatic Destruction
  // [quick]
  // Select an enemy follower on the field. Deal it 2 damage and, if there are at least 2 Idolatry cards on your field, deal 2 damage to its leader and give your leader [defense]+2.
  card('BP05-045EN', {
    canPlay: (s, iid) => selectableEnemies(s, s.cards[iid].owner).length > 0, // Q667
    spell(x) {
      const t = pickEnemy(x, 'Monochromatic Destruction: select an enemy follower. Deal it 2 damage.');
      if (!t) return;
      const foe = ctrlOfT(x, t);
      x.damage(t, 2);
      if (idolsOn(x.s, x.ctrl).length >= 2) { x.damage(x.leader(foe), 2); x.heal(x.ctrl, 2); }
    },
  });

  // BP05-048EN Servant of Destruction
  // [evolve] [cost02]: Evolve this follower.   (engine-read)
  // [fanfare] If there are at least 3 Idolatry cards on your field, change this card's [evolve] cost to 0 for the rest of this turn.
  // The engine reads the evolve cost as a constant, so the 0-cost evolve ability is offered as an
  // activated ability "equivalent to an evolve ability" (shares the once-per-turn evolve, CR 8.3.2.1)
  // while the flag is on, and the printed 2-cost one is hidden (evolveIf) for that turn. It is the
  // same evolve process (CR 12.2): reveal the evolved card, optional super-evolution.
  const zeroEvo = (s, me) => modsHave(s, me, (m) => m.flags && m.flags.servantZeroEvolve);
  card('BP05-048EN', {
    fanfare(x) {
      if (idolsOn(x.s, x.ctrl).length >= 3) x.buff(x.me, { flags: { servantZeroEvolve: true } }, x.until.eot(), 'evolve cost 0 this turn');
    },
    evolveIf: (s, iid) => !zeroEvo(s, iid),
    activated: [{
      text: 'Evolve this follower (evolve cost 0 this turn)',
      cost: {},
      evolveLike: true,
      can: (s, me) => zeroEvo(s, me) && !s.cards[me].evo && s.cards[me].ctrl === s.active && SV.evolveCandidates(s, me).length > 0,
      why: () => 'Its evolve cost is not 0 this turn, or there is no Servant of Destruction in your evolve deck.',
      run(x) {
        let sup = false;
        if (SV.superEvolveOK(x.s, x.ctrl)) sup = x.may('Also spend your super-evolution point to super-evolve Servant of Destruction?', 'Super-evolve', 'Just evolve');
        if (sup) SV.pay(x.s, x.ctrl, { sep: true });
        x.evolve(x.me, { sup });
      },
    }],
  });
  // BP05-049EN Servant of Destruction (evolved)
  // On Evolve: Select an enemy follower on the field. Deal 2 damage to it and its leader.
  card('BP05-049EN', {
    onEvolve(x) {
      const t = pickEnemy(x, 'Servant of Destruction: select an enemy follower. Deal 2 damage to it and its leader.');
      if (!t) return; // Q669: no target, no leader damage
      x.damageMany([t, x.leader(ctrlOfT(x, t))], 2);
    },
  });

  // BP08-050EN Zealot of Destruction
  // [fanfare] If there are at least 3 Idolatry cards on your field, select an enemy follower on the field. Destroy it, deal 2 damage to its leader, and give your leader [defense]+2.
  card('BP08-050EN', {
    fanfare(x) {
      if (idolsOn(x.s, x.ctrl).length < 3) return;
      const t = pickEnemy(x, 'Zealot of Destruction: select an enemy follower. Destroy it, deal 2 damage to its leader, and give your leader +2 defense.');
      if (!t) return; // CR 10.6.2.3.3: no target, the ability is not played
      const foe = ctrlOfT(x, t);
      x.destroy(t); x.damage(x.leader(foe), 2); x.heal(x.ctrl, 2);
    },
  });

  // BP08-051EN Joy of Destruction
  // If there's an Idolatry card on your field, recover 1 play point. If there's a Lishenna, Omen of Destruction on your field, draw a card.
  card('BP08-051EN', {
    spell(x) {
      if (idolsOn(x.s, x.ctrl).length) x.recoverPP(1);
      if (x.field(x.ctrl).some((i) => x.named(i, 'Lishenna, Omen of Destruction'))) x.draw(1); // Q1069 both
    },
  });

  // ------------------------------------------------------------ Melodious Destruction

  // BP15-039EN Lishenna, Melodious Destruction
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] If there are at least 3 Idolatry cards on your field, put a Melodious Monody token into your EX area.
  card('BP15-039EN', {
    fanfare(x) { if (idolsOn(x.s, x.ctrl).length >= 3) x.tokenToEx('Melodious Monody'); },
  });
  // BP15-040EN Lishenna, Melodious Destruction (evolved)
  // On Evolve - Look at the top 4 cards of your deck. You may put up to 2 Idolatry cards from among them into your EX area. Put the rest on the bottom of your deck in any order.
  card('BP15-040EN', {
    onEvolve(x) {
      x.lookPick({ n: 4, max: 2, to: 'ex', filter: (i) => baseD(x.s, i).traits.includes('Idolatry'), prompt: 'Lishenna: you may put up to 2 Idolatry cards into your EX area.' });
    },
  });

  // BP15-045EN Melody's Return
  // As an additional cost to play this, banish a follower with "Lishenna" in its name from your cemetery.
  // ----------
  // If there are at least 2 Idolatry cards on your field, search your deck for a follower with "Lishenna" in its name, summon it, then shuffle.
  const lishFollower = (s, i) => { const d = baseD(s, i); return d.name.includes('Lishenna') && SV.parsed(d).type === 'follower'; };
  card('BP15-045EN', {
    // The additional cost is mandatory: without a Lishenna follower in the cemetery it can't be played (CR 10.4.2.2).
    canPlay: (s, iid) => s.players[s.cards[iid].owner].cemetery.some((i) => lishFollower(s, i)),
    cantPlayWhy: () => 'Its additional cost needs a follower with "Lishenna" in its name in your cemetery.',
    spell(x) {
      // Additional cost (paid as the card is played, before anything else resolves).
      const c = x.selectOne(x.cemetery().filter((i) => lishFollower(x.s, i)), 'Melody\'s Return: banish a follower with "Lishenna" in its name from your cemetery (additional cost).', { aura: false });
      if (c) x.banish(c);
      if (idolsOn(x.s, x.ctrl).length < 2) return;
      const [f] = x.search({ filter: (i) => lishFollower(x.s, i), max: 1, prompt: 'Search your deck for a follower with "Lishenna" in its name to summon.' });
      if (f) x.summon(f);
      x.afterSearch();
    },
  });

  // BP15-054EN Hermit of Destruction
  // [fanfare] Select an enemy follower on the field and, if there are at least 3 Idolatry cards on your field, deal it 3 damage.
  card('BP15-054EN', {
    fanfare(x) {
      const t = pickEnemy(x, 'Hermit of Destruction: select an enemy follower (3 damage if you have at least 3 Idolatry cards on your field).');
      if (t && idolsOn(x.s, x.ctrl).length >= 3) x.damage(t, 3);
    },
  });

  // BP20-T13EN Melodious Monody (spell token)
  // As an additional cost to play this, you may engage any number of Idolatry cards on your field.
  // ----------
  // Select an enemy follower on the field and deal it damage equal to 2 times the number of Idolatry cards you engaged as the additional cost to play this.
  card('BP20-T13EN', {
    canPlay: (s, iid) => selectableEnemies(s, s.cards[iid].owner).length > 0, // CR 10.6.2.3.3
    spell(x) {
      // CR 10.6.2.2.2 the optional additional cost is decided first, then the target (10.6.2.3), then paid.
      const reserved = idolsOn(x.s, x.ctrl).filter((i) => !x.engaged(i));
      const eng = x.select({ from: reserved, min: 0, max: reserved.length, prompt: 'Melodious Monody: engage any number of reserved Idolatry cards on your field (additional cost; 2 damage each).' });
      const t = pickEnemy(x, 'Melodious Monody: select an enemy follower.');
      for (const i of eng) x.engage(i);
      if (t) x.damage(t, 2 * eng.length);
    },
  });

  // ------------------------------------------------------------ New Revelation (BP20)

  // BP20-037EN Lishenna, Melody Manifest
  // [fanfare] Choose 1. (1) Select another Idolatry card on your field. Destroy it and put a Melodious Monody token into your EX area. (2) Summon a White Psalm, New Revelation token.
  card('BP20-037EN', {
    fanfare(x) {
      const others = idolsOn(x.s, x.ctrl).filter((i) => i !== x.me);
      const [k] = x.choose('Lishenna, Melody Manifest: choose 1.', [
        { label: 'Destroy another Idolatry card on your field and put a Melodious Monody token into your EX area.', can: others.length > 0 },
        { label: 'Summon a White Psalm, New Revelation token.' },
      ]);
      if (k === 0) {
        const t = x.selectOne(others, 'Select another Idolatry card on your field to destroy.');
        if (t) { x.destroy(t); x.tokenToEx('Melodious Monody'); }
      } else if (k === 1) x.summonToken('White Psalm, New Revelation');
    },
  });

  // BP20-041EN Axia, Heir to Destruction (evolved)
  // On Evolve - Bury another Idolatry card: Search your deck for a follower with "Lishenna" in its name, reveal it, add it to your hand, then shuffle.
  // On Super-Evolve - Deal each enemy leader damage equal to the number of Idolatry cards on your field.
  // Once per turn, when an Idolatry amulet is put onto your field, select an enemy follower on the field and deal it 2 damage.
  card('BP20-041EN', {
    onEvolve(x) {
      if (!mayBuryAnotherIdol(x, 'search your deck for a follower with "Lishenna" in its name and add it to your hand.')) return;
      const [f] = x.search({ filter: (i) => lishFollower(x.s, i), max: 1, prompt: 'Search your deck for a follower with "Lishenna" in its name.' });
      if (f) x.toHand(f);
      x.afterSearch();
    },
    onSuperEvolve(x) { x.damage(x.leader(x.opp), idolsOn(x.s, x.ctrl).length); },
    triggers: [{
      name: 'Idolatry amulet: 2 damage', on: 'enter', limit: 1, // Q2421: on either player's turn
      when: (s, me, ev) => ev.p === s.cards[me].ctrl && SV.isAmulet(s, ev.iid) && isIdol(s, ev.iid),
      run(x) {
        const t = pickEnemy(x, 'Axia: select an enemy follower. Deal it 2 damage.');
        if (t) x.damage(t, 2);
      },
    }],
  });

  // BP20-044EN Congregant of Destruction
  // [fanfare] Bury another Idolatry card: Select an enemy follower on the field. Destroy it and deal 2 damage to its leader.
  // [act] Bury another Idolatry card: Select an enemy follower on the field. Destroy it and deal 2 damage to its leader. Activate only once per turn.
  function congregantHit(x) {
    const t = pickEnemy(x, 'Congregant of Destruction: select an enemy follower. Destroy it and deal 2 damage to its leader.');
    if (!t) return;
    const foe = ctrlOfT(x, t);
    x.destroy(t); x.damage(x.leader(foe), 2);
  }
  card('BP20-044EN', {
    fanfare(x) {
      // No selectable enemy follower: the ability can't be played (CR 10.6.2.3.3), so no cost is asked.
      if (!selectableEnemies(x.s, x.ctrl).length) return;
      if (mayBuryAnotherIdol(x, 'destroy an enemy follower and deal 2 damage to its leader.')) congregantHit(x);
    },
    activated: [{
      text: 'Bury another Idolatry card: destroy an enemy follower, 2 damage to its leader',
      once: true,
      can: (s, me) => idolsOn(s, s.cards[me].ctrl).some((i) => i !== me) && selectableEnemies(s, s.cards[me].ctrl).length > 0,
      why: () => 'Needs another Idolatry card on your field and an enemy follower to select.',
      pay(x) {
        const c = x.selectOne(idolsOn(x.s, x.ctrl).filter((i) => i !== x.me), 'Bury another Idolatry card on your field (cost).');
        if (c) x.bury(c);
      },
      run: congregantHit,
    }],
  });

  // BP20-045EN Devastating Soprano
  // Choose 1. (1) Select an Idolatry card on your field. Destroy it and draw a card. (2) Summon a White Psalm, New Revelation token.
  card('BP20-045EN', {
    spell(x) {
      const idols = idolsOn(x.s, x.ctrl);
      const [k] = x.choose('Devastating Soprano: choose 1.', [
        { label: 'Destroy an Idolatry card on your field and draw a card.', can: idols.length > 0 },
        { label: 'Summon a White Psalm, New Revelation token.' },
      ]);
      if (k === 0) {
        const t = x.selectOne(idols, 'Select an Idolatry card on your field. Destroy it and draw a card.');
        if (t) { x.destroy(t); x.draw(1); }
      } else if (k === 1) x.summonToken('White Psalm, New Revelation');
    },
  });

  // BP20-048EN Supplicant of Destruction
  // [act] [engage], bury another Idolatry card: Select an enemy leader or enemy follower on the field and deal it 2 damage.
  card('BP20-048EN', {
    activated: [{
      text: 'Engage, bury another Idolatry card: 2 damage to an enemy leader or follower',
      cost: { engage: true },
      can: (s, me) => idolsOn(s, s.cards[me].ctrl).some((i) => i !== me),
      why: () => 'Needs another Idolatry card on your field to bury.',
      pay(x) {
        const c = x.selectOne(idolsOn(x.s, x.ctrl).filter((i) => i !== x.me), 'Bury another Idolatry card on your field (cost).');
        if (c) x.bury(c);
      },
      run(x) {
        const t = x.selectOne(x.enemyTargets(), 'Supplicant of Destruction: select an enemy leader or enemy follower. Deal it 2 damage.');
        if (t) x.damage(t, 2);
      },
    }],
  });

  // BP20-051EN Devotee of Destruction (evolved)
  // Assail.                                    (engine-read)
  // On Evolve - Bury another Idolatry card: Draw a card.
  card('BP20-051EN', {
    onEvolve(x) { if (mayBuryAnotherIdol(x, 'draw a card.')) x.draw(1); },
  });

  // BP20-055EN Wasteland of Destruction
  // [fanfare] Look at the top 2 cards of your deck. You may reveal an Omen–Idolatry card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  // [act] Bury this: Bury another Idolatry card.
  card('BP20-055EN', {
    fanfare(x) {
      x.lookPick({ n: 2, max: 1, filter: (i) => { const t = baseD(x.s, i).traits; return t.includes('Omen') && t.includes('Idolatry'); }, prompt: 'Wasteland of Destruction: you may reveal an Omen–Idolatry card and add it to your hand.' });
    },
    activated: [{
      text: 'Bury this: bury another Idolatry card',
      pay(x) { x.bury(x.me); },
      run(x) { // Q2424: usable with no other Idolatry card (only this is buried)
        const t = x.selectOne(idolsOn(x.s, x.ctrl).filter((i) => i !== x.me), 'Bury another Idolatry card on your field.');
        if (t) x.bury(t);
      },
    }],
  });

  // BP20-T03EN White Psalm, New Revelation (amulet token)
  // [act] [engage] 3 Idolatry cards on your field: Bury this.
  // [lastwords] Summon a Black Psalm, New Revelation token. Give your leader [defense]+1.
  // BP20-T04EN Black Psalm, New Revelation (amulet token)
  // [act] [engage] 3 Idolatry cards on your field: Bury this.
  // [lastwords] Summon a White Psalm, New Revelation token. Deal 1 damage to each enemy leader.
  // Judgement: the cost says "3 Idolatry cards on your field" (not "other"), so this Psalm itself
  // may be one of the three it engages.
  const psalmAct = {
    text: 'Engage 3 Idolatry cards on your field: bury this',
    can: (s, me) => idolsOn(s, s.cards[me].ctrl).filter((i) => !s.cards[i].engaged).length >= 3,
    why: () => 'Needs 3 reserved Idolatry cards on your field.',
    pay(x) {
      const cand = idolsOn(x.s, x.ctrl).filter((i) => !x.engaged(i));
      const pick = x.select({ from: cand, min: 3, max: 3, prompt: 'Engage 3 Idolatry cards on your field (cost).' });
      for (const i of pick) x.engage(i);
    },
    run(x) { if (x.onField(x.me)) x.bury(x.me); },
  };
  card('BP20-T03EN', {
    activated: [psalmAct],
    lastWords(x) { x.summonToken('Black Psalm, New Revelation'); x.heal(x.ctrl, 1); },
  });
  card('BP20-T04EN', {
    activated: [psalmAct],
    lastWords(x) { x.summonToken('White Psalm, New Revelation'); x.damage(x.leader(x.opp), 1); },
  });

  // ------------------------------------------------------------ Machina / Condemned

  // BP17-040EN Belphomet, Ultimate Creator
  // This costs 5 less to play if there's a Machina follower on your field that costs 6 or more.
  // ----------
  // [fanfare] Bury each Machina follower that costs 6 or more. If you buried a 6-cost Machina follower, summon an Assault Tentacle token. If you buried a 7-cost Machina follower, deal 4 damage to each enemy follower on the field and give each other Machina follower on your field [attack]+2/[defense]+2.
  card('BP17-040EN', {
    selfCost: (s, iid, p) => (machina6(s, p) ? -5 : 0),
    fanfare(x) {
      // CR 5.34.1.1 bury acts on your own field. No simultaneous-bury door exists; each is buried in turn
      // (their Last Words still wait for the next Confirmation Timing).
      const list = x.followers(x.ctrl).filter((i) => x.hasTrait(i, 'Machina') && (baseD(x.s, i).cost || 0) >= 6);
      let six = false, seven = false;
      for (const i of list) {
        const cost = baseD(x.s, i).cost;
        if (x.bury(i)) { if (cost === 6) six = true; if (cost === 7) seven = true; }
      }
      if (six) x.summonToken('Assault Tentacle');
      if (seven) {
        x.damageMany(x.followers(x.opp), 4);
        for (const i of x.followers(x.ctrl)) if (i !== x.me && x.hasTrait(i, 'Machina')) x.buff(i, { atk: 2, def: 2 });
      }
    },
  });

  // BP17-T15EN Assault Tentacle (follower token)
  // Storm.                                     (engine-read)
  // [lastwords] Select an enemy follower on the field and deal it 4 damage.
  card('BP17-T15EN', {
    lastWords(x) {
      const t = pickEnemy(x, 'Assault Tentacle: select an enemy follower. Deal it 4 damage.');
      if (t) x.damage(t, 4);
    },
  });

  // Fuse a non-token follower (Sephie, Devoted Researcher, Obsessive Scholar). CR 12.18.
  const nonTokenFollower = (s) => (i) => { const d = baseD(s, i); return SV.parsed(d).type === 'follower' && !d.token; };
  // "[fanfare] Remove a fusion counter from this: Summon a Chimera Test Subject token." (CR 10.4.7.4: optional, on resolution)
  function fusionFanfare(x) {
    if (x.counters(x.me, 'fusion') < 1) return;
    if (!x.may('Remove a fusion counter from this to summon a Chimera Test Subject token?', 'Remove a counter', "Don't")) return;
    x.counter(x.me, 'fusion', -1);
    x.summonToken('Chimera Test Subject');
  }
  const fuseAct = (extra) => ({
    text: 'Fuse a non-token follower: place a fusion counter on this',
    zone: 'hand', // Q2364/Q2366/Q2368: Fuse is activated from hand only
    can: (s, me) => H.canFuse(s, me, nonTokenFollower(s)),
    why: () => 'No non-token follower to fuse.',
    run(x) {
      const fused = x.fuse({ filter: nonTokenFollower(x.s), prompt: 'Fuse: choose a non-token follower (from your hand it is discarded, from your EX area it is buried).' });
      if (!fused.length) return;
      x.counter(x.me, 'fusion', 1);
      if (extra) extra(x, fused);
    },
  });

  // BP19-038EN Sephie, Depraved Convict
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Remove a fusion counter from this: Summon a Chimera Test Subject token.
  // [act] Fuse a non-token follower: Place a fusion counter on this. If you fused a Condemned follower, draw a card.
  card('BP19-038EN', {
    fanfare: fusionFanfare,
    activated: [fuseAct((x, fused) => { if (fused.some((i) => baseD(x.s, i).traits.includes('Condemned'))) x.draw(1); })],
  });
  // BP19-039EN Sephie, Depraved Convict (evolved)
  // On Evolve - Choose 1. If there are at least 10 Condemned followers in your cemetery, choose up to 2 instead. (1) Select an enemy follower on the field and deal it 5 damage. (2) Summon a Chimera Test Subject token.
  // On Super-Evolve - Select up to 2 cards on your field named Volunteer Test Subject and/or Chimera Test Subject and give them Storm.
  card('BP19-039EN', {
    onEvolve(x) {
      const max = condemnedInCemetery(x.s, x.ctrl) >= 10 ? 2 : 1; // fixed when the ability is played (CR 5.18.3.1)
      const pick = x.choose(max === 2 ? 'Sephie: choose up to 2.' : 'Sephie: choose 1.', [
        { label: 'Select an enemy follower and deal it 5 damage.', can: selectableEnemies(x.s, x.ctrl).length > 0 },
        { label: 'Summon a Chimera Test Subject token.' },
      ], 1, max); // Q2365: each option once
      if (pick.includes(0)) { const t = pickEnemy(x, 'Sephie: select an enemy follower. Deal it 5 damage.'); if (t) x.damage(t, 5); }
      if (pick.includes(1)) x.summonToken('Chimera Test Subject');
    },
    onSuperEvolve(x) {
      const cand = x.field(x.ctrl).filter((i) => isTestSubject(x.s, i));
      const pick = x.select({ from: cand, min: 0, max: 2, prompt: 'Sephie: select up to 2 Volunteer Test Subjects and/or Chimera Test Subjects on your field to give Storm.' });
      for (const i of pick) x.give(i, 'Storm');
    },
  });

  // BP19-041EN Kyrzael, Killshot Enforcer
  // Storm.                                     (engine-read)
  // [fanfare] Search your deck for a Warden of the Trigger, summon it, then shuffle.
  // Strike - Give each other Machina follower on your field [attack]+1/[defense]+1.
  card('BP19-041EN', {
    fanfare(x) {
      const [w] = x.search({ filter: (i) => x.name(i) === 'Warden of the Trigger', max: 1, prompt: 'Search your deck for a Warden of the Trigger to summon.' });
      if (w) x.summon(w);
      x.afterSearch();
    },
    strike(x) {
      for (const i of x.followers(x.ctrl)) if (i !== x.me && x.hasTrait(i, 'Machina')) x.buff(i, { atk: 1, def: 1 });
    },
  });

  // BP19-P11EN Obsessive Scholar
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Remove a fusion counter from this: Summon a Chimera Test Subject token.
  // [act] Fuse a non-token follower: Place a fusion counter on this. (To fuse a card, discard it or bury it from your EX area, and put this from your hand into your EX area.)
  card('BP19-P11EN', { fanfare: fusionFanfare, activated: [fuseAct()] });
  // BP19-043EN Obsessive Scholar (evolved)
  // On Evolve - Select an enemy follower on the field and deal it 3 damage.
  // [act] [engage]: Select a Volunteer Test Subject or Chimera Test Subject on your field and give it Drain.
  card('BP19-043EN', {
    onEvolve(x) { const t = pickEnemy(x, 'Obsessive Scholar: select an enemy follower. Deal it 3 damage.'); if (t) x.damage(t, 3); },
    activated: [{
      text: 'Engage: give a Volunteer or Chimera Test Subject Drain',
      cost: { engage: true },
      can: (s, me) => SV.followers(s, s.cards[me].ctrl).some((i) => isTestSubject(s, i)),
      why: () => 'No Volunteer Test Subject or Chimera Test Subject on your field.',
      run(x) {
        const t = x.selectOne(x.followers(x.ctrl).filter((i) => isTestSubject(x.s, i)), 'Select a Volunteer Test Subject or Chimera Test Subject on your field to give Drain.');
        if (t) x.give(t, 'Drain');
      },
    }],
  });

  // BP19-044EN Warden of the Trigger
  // [fanfare] Look at the top card of your deck. If it's a Machina card, you may put into your EX area.
  // [act] [engage]: Select an enemy follower on the field and destroy it. Activate only if there's a Machina follower on your field that costs at least 6.
  card('BP19-044EN', {
    fanfare(x) {
      // Q2367: declining leaves it unrevealed on top of the deck.
      x.lookPick({ n: 1, max: 1, to: 'ex', restTo: 'top', filter: (i) => baseD(x.s, i).traits.includes('Machina'), prompt: 'Warden of the Trigger: the top card is a Machina card. You may put it into your EX area.' });
    },
    activated: [{
      text: 'Engage: destroy an enemy follower',
      cost: { engage: true },
      can: (s, me) => machina6(s, s.cards[me].ctrl) && selectableEnemies(s, s.cards[me].ctrl).length > 0,
      why: (s, me) => (machina6(s, s.cards[me].ctrl) ? 'No enemy follower to select.' : 'Needs a Machina follower on your field that costs at least 6.'),
      run(x) { const t = pickEnemy(x, 'Warden of the Trigger: select an enemy follower to destroy.'); if (t) x.destroy(t); },
    }],
  });

  // BP19-046EN Devoted Researcher
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Remove a fusion counter from this: Summon a Chimera Test Subject token.
  // [act] Fuse a non-token follower: Place a fusion counter on this. (To fuse a card, discard it or bury it from your EX area, and put this from your hand into your EX area.)
  card('BP19-046EN', { fanfare: fusionFanfare, activated: [fuseAct()] });
  // BP19-047EN Devoted Researcher (evolved)
  // On Evolve - Search your deck for a Volunteer Test Subject, put it into your EX area, then shuffle.
  // [act] [engage], bury a Volunteer Test Subject or Chimera Test Subject: Select an enemy follower on the field and deal it damage equal to the buried follower's attack.
  card('BP19-047EN', {
    onEvolve(x) {
      const [v] = x.search({ filter: (i) => x.name(i) === 'Volunteer Test Subject', max: 1, prompt: 'Search your deck for a Volunteer Test Subject to put into your EX area.' });
      if (v) x.toEx(v);
      x.afterSearch();
    },
    activated: [{
      text: 'Engage, bury a Test Subject: damage equal to its attack to an enemy follower',
      cost: { engage: true },
      can: (s, me) => SV.followers(s, s.cards[me].ctrl).some((i) => isTestSubject(s, i)) && selectableEnemies(s, s.cards[me].ctrl).length > 0,
      why: () => 'Needs a Volunteer or Chimera Test Subject on your field and an enemy follower to select.',
      pay(x) {
        const t = x.selectOne(x.followers(x.ctrl).filter((i) => isTestSubject(x.s, i)), 'Bury a Volunteer Test Subject or Chimera Test Subject on your field (cost).');
        x._buriedAtk = 0;
        if (t) { x._buriedAtk = Math.max(0, x.chars(t).atk); x.bury(t); } // its attack as it last existed on the field (CR 10.11)
      },
      run(x) {
        const t = pickEnemy(x, `Devoted Researcher: select an enemy follower. Deal it ${x._buriedAtk} damage.`);
        if (t) x.damage(t, x._buriedAtk);
      },
    }],
  });

  // BP19-048EN Volunteer Test Subject
  // When this is fused by an ability of a Condemned follower you control, draw a card, then discard a card.
  // [fanfare] If there are at least 5 Condemned followers in your cemetery, give this [attack]+2/[defense]+2 and Rush. If there are at least 10, give it Assail and Bane.
  // [lastwords] Draw a card.
  // BP19-T02EN Chimera Test Subject (follower token)
  // [fanfare] If there are at least 5 Condemned followers in your cemetery, give this [attack]+2/[defense]+2 and Rush. If there are at least 10, give it Assail and Bane.
  // [lastwords] Draw a card.
  function testSubjectFanfare(x) {
    const n = condemnedInCemetery(x.s, x.ctrl);
    if (n >= 5) x.buff(x.me, { atk: 2, def: 2, kw: { Rush: true } });
    if (n >= 10) x.buff(x.me, { kw: { Assail: true, Bane: true } });
  }
  card('BP19-048EN', {
    fanfare: testSubjectFanfare,
    lastWords(x) { x.draw(1); },
    triggers: [{
      name: 'Fused: draw, then discard', on: 'fused', zone: 'cemetery',
      when: (s, me, ev) => ev.fused.includes(me) && ev.p === s.cards[me].owner && (() => { const d = baseD(s, ev.iid); return d.traits.includes('Condemned') && SV.parsed(d).type === 'follower'; })(),
      run(x) { x.draw(1); x.chooseDiscard(1); },
    }],
  });
  card('BP19-T02EN', {
    fanfare: testSubjectFanfare,
    lastWords(x) { x.draw(1); },
  });
})();
