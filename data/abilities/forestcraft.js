// Forestcraft card scripts (docs/ABILITIES.md). One SV.card per card number; printed text in
// the comment above each, verbatim from data/cards.js.
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;

  // ------------------------------------------------------------------ shared helpers
  // Enemy followers p's effects can select (CR 12.15: Aura cards can't be selected by enemy effects).
  const selectableEnemies = (s, p) => SV.followers(s, 1 - p).filter((i) => !SV.chars(s, i).kw.Aura);
  // CR 10.6.2.3.3: a card or activated ability that must select a target can't be played without one.
  const hasEnemyTarget = (s, iid) => selectableEnemies(s, H.ctrl(s, iid)).length > 0;
  const traitsOf = (s, i) => SV.CARDS[s.cards[i].id].traits;
  const omenHunter = (s, i) => { const t = traitsOf(s, i); return t.includes('Omen') && t.includes('Hunter'); }; // "Omen–Hunter": both traits
  const huntersIn = (s, p) => s.players[p].cemetery.filter((i) => traitsOf(s, i).includes('Hunter')).length;
  const hunters = (x) => huntersIn(x.s, x.ctrl);
  // "Change its defense to 1" (CR 5.27.2): a change by the difference, so it stays a difference
  // when the follower evolves (Q1906) and later +/- effects apply on top.
  const setDefTo1 = (x, t) => x.buff(t, { def: 1 - x.chars(t).def }, null, 'defense changed to 1');
  const enemyFollowerPrompt = (name, what) => `${name}: select an enemy follower on the field.${what ? ' ' + what : ''}`;

  // "The next [traits] card you play this turn costs N less": a cost filter matching cards with
  // every listed trait until one such card has been played since the effect began (the 'play'
  // log entries; s.log is append-only). The effect itself lasts until the end of the turn.
  SV.COST_FILTERS.forestNext = (s, iid, e) => {
    const ok = (i) => { const t = traitsOf(s, i); return e.traits.every((k) => t.includes(k)); };
    if (!ok(iid)) return false;
    for (let k = s.log.length - 1; k >= 0 && s.log[k].n >= e.since; k--) {
      const l = s.log[k];
      if (l.type === 'play' && l.who === e.p && ok(l.iid)) return false;
    }
    return true;
  };
  const nextCardCosts = (x, traits, n) => x.effect({ costMod: -n, filter: 'forestNext', traits, since: x.s.logN, ...x.until.eot() });

  // Delayed abilities "When it's put from the field into the cemetery this turn, [effect]" made by
  // an effect (Izudia, Erosive Annihilation, Adherent of Annihilation): x.addTrigger hosts the
  // card's effectTriggers[0] in s.effects until the end of the turn, so it triggers wherever the
  // card that made it is (Q1894/Q1902), and each use is its own trigger (Q1893/Q1900/Q1901). A
  // record is used up when its target leaves the field by any route (a card that comes back is a
  // new card).
  const delay = (x, t) => x.addTrigger(0, x.until.eot(), { target: t });
  const leaveToCemetery = (name, run) => [{
    name, on: 'leave',
    when: (s, e, ev) => {
      if (ev.iid !== e.target) return false;
      e.on = false;
      return ev.to === 'cemetery';
    },
    run,
  }];
  // "Whenever a [Condemned] follower on your field evolves" (also super-evolves, Q2357; in either
  // player's turn, Q1566/Q1895/Q2358).
  const myFollowerEvolves = (trait) => (s, me, ev) => {
    const c = s.cards[ev.iid];
    return c.zone === 'field' && c.ctrl === H.ctrl(s, me) && SV.isFollower(s, ev.iid) && (!trait || SV.hasTrait(s, ev.iid, trait));
  };

  // BP17-001EN Arisa, Evergreen Arrow
  // [fanfare] Put a Gale Arrow or Storm Arrow token into your EX area.
  // [act] [engage]: Search your deck for a Forest Guardian's Bow, summon it, then shuffle. Activate only if you've played at least 5 cards this turn.
  card('BP17-001EN', {
    fanfare(x) {
      const [k] = x.choose('Arisa: put which token into your EX area?', [{ label: 'Gale Arrow' }, { label: 'Storm Arrow' }]);
      x.tokenToEx(k === 0 ? 'Gale Arrow' : 'Storm Arrow');
    },
    activated: [{
      text: "Search your deck for a Forest Guardian's Bow and summon it",
      cost: { engage: true },
      can: (s, me) => SV.combo(s, s.cards[me].ctrl) >= 5,
      why: () => "You haven't played 5 cards this turn.",
      run(x) {
        const [b] = x.search({ filter: (i) => x.name(i) === "Forest Guardian's Bow", max: 1, prompt: "Search your deck for a Forest Guardian's Bow." });
        if (b) x.summon(b);
        x.afterSearch();
      },
    }],
  });

  // BP19-009EN Budding Initiate
  // [evolve] [cost02]: Evolve this.            (engine-read)
  // [fanfare] Combo (3) - Evolve this.
  card('BP19-009EN', {
    fanfare(x) { if (x.combo() >= 3) x.evolve(x.me); },
  });
  // BP19-010EN Budding Initiate (evolved)
  // On Evolve - Look at the top 4 cards of your deck. You may reveal a Condemned card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  card('BP19-010EN', {
    onEvolve(x) { x.lookPick({ n: 4, filter: (i) => x.hasTrait(i, 'Condemned'), prompt: 'You may reveal a Condemned card and add it to your hand.' }); },
  });

  // BP17-T02EN Gale Arrow (token spell)
  // Select an enemy follower on the field. Combo (3) - Deal it 2 damage.
  card('BP17-T02EN', {
    canPlay: (s, iid) => SV.followers(s, 1 - s.cards[iid].owner).length > 0, // CR 10.6.2.3.3 a target is required
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), 'Gale Arrow: select an enemy follower.');
      if (t && x.combo() >= 3) x.damage(t, 2); // Combo counts this card (CR 13.2.1.2)
    },
  });
  // BP17-T03EN Storm Arrow (token spell)
  // Combo (5) - Deal 2 damage to each enemy leader.
  card('BP17-T03EN', {
    spell(x) { if (x.combo() >= 5) x.damage(x.leader(x.opp), 2); },
  });

  // BP04-011EN Sukuna, Brave and Small (evolved)
  // Storm.                                     (engine-read)
  // On Evolve: Combo (3) - Give this follower [attack]+1/[defense]+1. Combo (5) - Give [attack]+3/[defense]+3 instead.
  card('BP04-011EN', {
    onEvolve(x) {
      const n = x.combo(); // Q544: evolving is not playing a card
      if (n >= 5) x.buff(x.me, { atk: 3, def: 3 });
      else if (n >= 3) x.buff(x.me, { atk: 1, def: 1 });
    },
  });

  // BP05-005EN Apostle of Unkilling (evolved)
  // On Evolve: Search your deck for a Hunter follower that costs 2 play points or less, put it onto your field, then shuffle your deck.
  card('BP05-005EN', {
    onEvolve(x) {
      const [c] = x.search({ filter: (i) => x.isFollower(i) && x.hasTrait(i, 'Hunter') && (x.cost(i) || 0) <= 2, prompt: 'Apostle of Unkilling: search your deck for a Hunter follower that costs 2 or less to put onto your field.' });
      if (c) x.summon(c);
      x.afterSearch();
    },
  });

  // BP05-017EN Mark of the Six
  // [quick]                                    (engine-read)
  // The next time your leader would take damage this turn, it doesn't take damage.
  card('BP05-017EN', {
    // Q652: 0 damage is not damage (dealDamage never reaches the replacers), so it is not used up.
    spell(x) { x.effect({ replaceDamage: 'leaderNextMinus', n: 1e9, ...x.until.eot() }); },
  });

  // BP06-013EN Crossbow Sniper
  // [fanfare] Discard a Hunter card: Select an enemy leader or enemy follower on the field. Deal it 1 damage and draw a card.
  card('BP06-013EN', {
    fanfare(x) {
      const cand = x.hand().filter((i) => x.hasTrait(i, 'Hunter'));
      if (!cand.length) return;
      // CR 10.4.7.4: the cost of an automatic ability is optional, decided on resolution.
      const pick = x.select({ from: cand, min: 0, max: 1, aura: false, prompt: 'Crossbow Sniper: you may discard a Hunter card to deal 1 damage to an enemy leader or follower and draw a card.' });
      if (!pick.length) return;
      x.discard(pick[0]);
      const t = x.selectOne(x.enemyTargets(), 'Crossbow Sniper: select an enemy leader or enemy follower on the field. Deal it 1 damage.');
      if (t) x.damage(t, 1);
      x.draw(1);
    },
  });

  // BP11-003EN Shamu & Shama, Posh Felines
  // Storm.                                     (engine-read)
  // [fanfare] Select an enemy follower on the field. Combo (5) - Deal it 3 damage.
  // Strike, Combo (3) - Give this follower [attack]+1/[defense]+1.
  card('BP11-003EN', {
    fanfare(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Shamu & Shama', 'Combo (5): deal it 3 damage.'));
      if (t && x.combo() >= 5) x.damage(t, 3);
    },
    strike(x) { if (x.combo() >= 3) x.buff(x.me, { atk: 1, def: 1 }); },
  });

  // BP15-001EN Izudia, Unkilling Annihilation
  // [fanfare] Banish an Izudia, Omen of Unkilling from your cemetery: Select an enemy follower on the field and change its defense to 1.
  // [act] [engage]: Select an enemy follower on the field and deal it 1 damage. When it's put from the field into the cemetery this turn, put an Annihilating Onslaught token into your EX area.
  card('BP15-001EN', {
    fanfare(x) {
      const cand = x.cemetery().filter((i) => x.named(i, 'Izudia, Omen of Unkilling'));
      if (!cand.length) return;
      const pick = x.select({ from: cand, min: 0, max: 1, aura: false, prompt: 'Izudia: you may banish an Izudia, Omen of Unkilling from your cemetery to change an enemy follower\'s defense to 1.' });
      if (!pick.length) return;
      x.banish(pick[0]);
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Izudia', 'Change its defense to 1.'));
      if (t) setDefTo1(x, t);
    },
    activated: [{
      text: 'Deal 1 damage to an enemy follower (Annihilating Onslaught if it goes to the cemetery this turn)',
      cost: { engage: true },
      can: hasEnemyTarget,
      why: () => 'There is no enemy follower to select.',
      run(x) {
        const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Izudia', 'Deal it 1 damage.'));
        if (!t) return;
        x.damage(t, 1);
        delay(x, t);
      },
    }],
    effectTriggers: leaveToCemetery('Annihilating Onslaught', (x) => { x.tokenToEx('Annihilating Onslaught'); }),
  });

  // BP15-004EN Piercye, Queen of Frost
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] If there are at least 3 faceup evolved followers in your evolve deck, evolve this.
  // Whenever a follower on your field evolves, deal 1 damage to each enemy leader and 2 damage to each enemy follower on the field, and give your leader [defense]+1.
  // Q1897-Q1899: advanced followers, Carrots and Drive Points are not evolved followers.
  const faceupEvolved = (s, p) => s.players[p].evoDeck.filter((e) => {
    const c = s.cards[e], d = SV.CARDS[c.id];
    return c.faceup && d.evolved && !d.advanced && SV.parsed(d).type === 'follower';
  }).length;
  const piercye = {
    name: 'Piercye, Queen of Frost', on: 'evolve', when: myFollowerEvolves(null),
    run(x) {
      const L = x.leader(x.opp);
      x.damageMany([L, ...x.followers(x.opp)], (t) => (t === L ? 1 : 2));
      x.heal(x.ctrl, 1);
    },
  };
  card('BP15-004EN', {
    fanfare(x) { if (faceupEvolved(x.s, x.ctrl) >= 3) x.evolve(x.me); },
    triggers: [piercye],
  });
  // BP15-005EN Piercye, Queen of Frost (evolved)
  // On Evolve - Search your deck for a follower that costs 2 or less, reveal it, add it to your hand, then shuffle.
  // Whenever a follower on your field evolves, deal 1 damage to each enemy leader and 2 damage to each enemy follower on the field, and give your leader [defense]+1.
  card('BP15-005EN', {
    onEvolve(x) {
      const [c] = x.search({ filter: (i) => x.isFollower(i) && (x.cost(i) || 0) <= 2, prompt: 'Piercye: search your deck for a follower that costs 2 or less.' });
      if (c) x.toHand(c);
      x.afterSearch();
    },
    triggers: [piercye],
  });

  // BP15-008EN Erosive Annihilation
  // [quick]                                    (engine-read)
  // This costs 1 less to play if there's a follower on your field with "Izudia" in its name.
  // ----------
  // Select an enemy follower on the field and deal it 1 damage. When it's put from the field into the cemetery this turn, draw a card.
  card('BP15-008EN', {
    selfCost: (s, iid, p) => (SV.followers(s, p).some((i) => SV.nameHas(s, i, 'Izudia')) ? -1 : 0),
    canPlay: hasEnemyTarget,
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Erosive Annihilation', 'Deal it 1 damage.'));
      if (!t) return;
      x.damage(t, 1);
      delay(x, t);
    },
    effectTriggers: leaveToCemetery('Erosive Annihilation', (x) => { x.draw(1); }),
  });

  // BP15-012EN Adherent of Annihilation
  // [fanfare] Select an enemy follower on the field and, if there are at least 3 Hunter cards in your cemetery, deal it 2 damage. When it's put from the field into the cemetery this turn, give your leader [defense]+2.
  card('BP15-012EN', {
    fanfare(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Adherent of Annihilation'));
      if (!t) return;
      if (hunters(x) >= 3) x.damage(t, 2);
      delay(x, t); // the "when" applies to the selected follower whether or not it was damaged
    },
    effectTriggers: leaveToCemetery('Adherent of Annihilation', (x) => { x.heal(x.ctrl, 2); }),
  });

  // BP15-014EN Hermit of Unkilling
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Select an enemy follower on the field and, if there are at least 3 Hunter cards in your cemetery, change its defense to 1.
  card('BP15-014EN', {
    fanfare(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Hermit of Unkilling'));
      if (t && hunters(x) >= 3) setDefTo1(x, t);
    },
  });
  // BP15-015EN Hermit of Unkilling (evolved)
  // On Evolve - Search your deck for a follower with "Izudia" in its name, reveal it, add it to your hand, then shuffle.
  card('BP15-015EN', {
    onEvolve(x) {
      const [c] = x.search({ filter: (i) => x.isFollower(i) && x.named(i, 'Izudia'), prompt: 'Hermit of Unkilling: search your deck for a follower with "Izudia" in its name.' });
      if (c) x.toHand(c);
      x.afterSearch();
    },
  });

  // BP18-019EN Airbound Barrage
  // Select a [forestcraft] card on your field and an enemy follower on the field. Return the first card to its owner's hand and deal 3 damage to the second.
  const forestOnField = (s, p) => SV.field(s, p).filter((i) => SV.chars(s, i).cls === 'forestcraft');
  card('BP18-019EN', {
    canPlay: (s, iid) => forestOnField(s, s.cards[iid].owner).length > 0 && hasEnemyTarget(s, iid), // Q2149 both are required
    spell(x) {
      const a = x.selectOne(forestOnField(x.s, x.ctrl), "Airbound Barrage: select a Forestcraft card on your field to return to its owner's hand.");
      const b = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Airbound Barrage', 'Deal it 3 damage.'));
      if (a) x.toHand(a);
      if (b) x.damage(b, 3);
    },
  });

  // BP19-002EN Magachiyo, Barbed Convict (evolved)
  // Storm.                                     (engine-read)
  // On Evolve - Select an enemy follower on the field. Combo (3) - Deal it 4 damage.
  // On Super-Evolve - Give each other Condemned follower on your field Storm.
  card('BP19-002EN', {
    onEvolve(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Magachiyo', 'Combo (3): deal it 4 damage.'));
      if (t && x.combo() >= 3) x.damage(t, 4);
    },
    onSuperEvolve(x) {
      for (const i of x.followers(x.ctrl)) if (i !== x.me && x.hasTrait(i, 'Condemned')) x.give(i, 'Storm');
    },
  });

  // BP19-003EN Wimael, Redolent Enforcer
  // [fanfare] Select an enemy follower on the field and deal it 4 damage.
  // [lastwords] Put this onto its owner's field.
  card('BP19-003EN', {
    fanfare(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Wimael', 'Deal it 4 damage.'));
      if (t) x.damage(t, 4);
    },
    lastWords(x) {
      const c = x.s.cards[x.me];
      if (c.zone === 'cemetery') x.summon(x.me, { ctrl: c.owner });
    },
  });

  // BP19-005EN Verdant Lieutenant
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // Whenever a Condemned follower on your field evolves, Combo (3) - Draw a card.
  const lieutenant = {
    name: 'Verdant Lieutenant', on: 'evolve', when: myFollowerEvolves('Condemned'),
    run(x) { if (x.combo() >= 3) x.draw(1); },
  };
  card('BP19-005EN', { triggers: [lieutenant] });
  // BP19-006EN Verdant Lieutenant (evolved)
  // On Evolve - Select an enemy follower on the field and deal it 2 damage.
  // Whenever a Condemned follower on your field evolves, Combo (3) - Draw a card.
  card('BP19-006EN', {
    onEvolve(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Verdant Lieutenant', 'Deal it 2 damage.'));
      if (t) x.damage(t, 2);
    },
    triggers: [lieutenant],
  });

  // BP19-007EN Warden of Balms
  // Ward.                                      (engine-read)
  // [fanfare]/[lastwords] Deal 3 damage to each enemy leader.
  // [act] Discard this: Select a Condemned follower on your field. Destroy it, deal 1 damage to each enemy leader, and draw a card.
  const myCondemned = (s, p) => SV.followers(s, p).filter((i) => SV.hasTrait(s, i, 'Condemned'));
  card('BP19-007EN', {
    fanfare(x) { x.damage(x.leader(x.opp), 3); },
    lastWords(x) { x.damage(x.leader(x.opp), 3); },
    activated: [{
      text: 'Discard this: destroy a Condemned follower on your field, 1 damage to the enemy leader, draw a card',
      zone: 'hand',
      can: (s, me) => myCondemned(s, s.cards[me].owner).length > 0,
      why: () => 'There is no Condemned follower on your field to select.',
      pay(x) { x.discard(x.me); },
      run(x) {
        const t = x.selectOne(myCondemned(x.s, x.ctrl), 'Warden of Balms: select a Condemned follower on your field to destroy.');
        if (t) x.destroy(t);
        x.damage(x.leader(x.opp), 1);
        x.draw(1);
      },
    }],
  });

  // BP19-011EN Leafshade Assassin
  // Whenever a Condemned follower on your field evolves, Combo (3) - Select an enemy follower on the field and deal it 3 damage.
  // [fanfare] The next Condemned card you play this turn costs 1 less.
  card('BP19-011EN', {
    triggers: [{
      name: 'Leafshade Assassin', on: 'evolve', when: myFollowerEvolves('Condemned'),
      run(x) {
        if (x.combo() < 3) return;
        const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Leafshade Assassin', 'Deal it 3 damage.'));
        if (t) x.damage(t, 3);
      },
    }],
    fanfare(x) { nextCardCosts(x, ['Condemned'], 1); },
  });

  // BP20-001EN Izudia, Annihilation Manifest
  // [fanfare] Search your deck for an Omen–Hunter spell that costs 2 or less, reveal it, add it to your hand, then shuffle. If there are at least 6 Hunter cards in your cemetery, put an Annihilating Onslaught token into your EX area.
  // [act] [cost00]: The next Omen–Hunter card you play this turn costs 2 less. Activate only once per turn.
  card('BP20-001EN', {
    fanfare(x) {
      const [c] = x.search({ filter: (i) => omenHunter(x.s, i) && x.isSpell(i) && (x.cost(i) || 0) <= 2, prompt: 'Izudia: search your deck for an Omen–Hunter spell that costs 2 or less.' });
      if (c) x.toHand(c);
      x.afterSearch();
      if (hunters(x) >= 6) x.tokenToEx('Annihilating Onslaught');
    },
    activated: [{
      text: 'The next Omen–Hunter card you play this turn costs 2 less',
      cost: { pp: 0 },
      once: true,
      run(x) { nextCardCosts(x, ['Omen', 'Hunter'], 2); }, // Q2402: two copies stack (4 less)
    }],
  });

  // BP20-002EN Krulle, Heir to Unkilling
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] If there are at least 6 Hunter cards in your cemetery, put a Crest: Krulle, Heir to Unkilling token into your EX area and give your leader [defense]+2.
  card('BP20-002EN', {
    fanfare(x) {
      if (hunters(x) < 6) return;
      x.tokenToEx('Crest: Krulle, Heir to Unkilling');
      x.heal(x.ctrl, 2);
    },
  });
  // BP20-003EN Krulle, Heir to Unkilling (evolved)
  // On Evolve - Select an enemy follower on the field and give it [attack]-3/[defense]-3.
  // On Super-Evolve - Give each enemy follower on the field [attack]-3/[defense]-3.
  card('BP20-003EN', {
    onEvolve(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Krulle', 'Give it -3/-3.'));
      if (t) x.buff(t, { atk: -3, def: -3 });
    },
    onSuperEvolve(x) { for (const t of x.followers(x.opp)) x.buff(t, { atk: -3, def: -3 }); },
  });

  // BP20-007EN Congregant of Unkilling
  // Ward.                                      (engine-read)
  // [fanfare] Search your deck for an Omen–Hunter follower that costs 3 or less, summon it, then shuffle.
  card('BP20-007EN', {
    fanfare(x) {
      const [c] = x.search({ filter: (i) => omenHunter(x.s, i) && x.isFollower(i) && (x.cost(i) || 0) <= 3, prompt: 'Congregant of Unkilling: search your deck for an Omen–Hunter follower that costs 3 or less to summon.' });
      if (c) x.summon(c);
      x.afterSearch();
    },
  });

  // BP20-008EN Eradicating Arrow
  // Select up to 2 enemy followers on the field and deal them 2 damage. If there are at least 6 Hunter cards in your cemetery, deal 3 damage instead and deal 2 damage to each enemy leader.
  card('BP20-008EN', {
    spell(x) {
      const big = hunters(x) >= 6; // this spell is in the resolution zone, not the cemetery
      const ts = x.select({ from: x.followers(x.opp), min: 0, max: 2, prompt: 'Eradicating Arrow: select up to 2 enemy followers on the field.' }); // Q2409 0 is allowed
      const L = x.leader(x.opp);
      x.damageMany(big ? [...ts, L] : ts, (t) => (t === L ? 2 : big ? 3 : 2));
    },
  });

  // BP20-009EN Supplicant of Unkilling
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] If there's an enemy follower on the field with 1 defense, draw a card.
  const enemyAt1 = (x) => x.followers(x.opp).some((i) => x.chars(i).def === 1);
  card('BP20-009EN', {
    fanfare(x) { if (enemyAt1(x)) x.draw(1); },
  });
  // BP20-010EN Supplicant of Unkilling (evolved)
  // On Evolve - If there's an enemy follower on the field with 1 defense, give your leader [defense]+2.
  card('BP20-010EN', {
    onEvolve(x) { if (enemyAt1(x)) x.heal(x.ctrl, 2); },
  });

  // BP20-012EN Hamlet of Unkilling
  // [fanfare] Look at the top 2 cards of your deck. You may reveal an Omen–Hunter card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  // [act] [engage], bury this: Give your leader [defense]+1. Activate only if there are at least 3 Hunter cards in your cemetery.
  card('BP20-012EN', {
    fanfare(x) { x.lookPick({ n: 2, filter: (i) => omenHunter(x.s, i), prompt: 'Hamlet of Unkilling: you may reveal an Omen–Hunter card and add it to your hand.' }); },
    activated: [{
      text: 'Bury this: give your leader +1 defense',
      cost: { engage: true },
      can: (s, me) => huntersIn(s, H.ctrl(s, me)) >= 3,
      why: () => 'You need at least 3 Hunter cards in your cemetery.',
      pay(x) { x.bury(x.me); },
      run(x) { x.heal(x.ctrl, 1); },
    }],
  });

  // BP20-015EN Devotee of Unkilling
  // [fanfare] Discard an Omen–Hunter card: Draw 2 cards.
  card('BP20-015EN', {
    fanfare(x) {
      const cand = x.hand().filter((i) => omenHunter(x.s, i));
      if (!cand.length) return;
      const pick = x.select({ from: cand, min: 0, max: 1, aura: false, prompt: 'Devotee of Unkilling: you may discard an Omen–Hunter card to draw 2 cards.' });
      if (!pick.length) return;
      x.discard(pick[0]);
      x.draw(2);
    },
  });

  // BP20-T01EN Crest: Krulle, Heir to Unkilling (crest token)
  // [act] [cost00]: Select an enemy follower on the field and change its defense to 1. Activate only once per turn.
  card('BP20-T01EN', {
    activated: [{
      text: "Change an enemy follower's defense to 1",
      zone: 'ex',
      cost: { pp: 0 },
      once: true,
      can: hasEnemyTarget,
      why: () => 'There is no enemy follower to select.',
      run(x) {
        const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Crest: Krulle', 'Change its defense to 1.'));
        if (t) setDefTo1(x, t);
      },
    }],
  });

  // BP20-T12EN Annihilating Onslaught (token spell)
  // If there are at least 6 Hunter cards in your cemetery, deal 6 damage to each enemy leader.
  card('BP20-T12EN', {
    spell(x) { if (hunters(x) >= 6) x.damage(x.leader(x.opp), 6); },
  });

  // SP01-001EN Spinaria, Wavering Will
  // Whenever a follower on your field evolves, give your leader [defense]+2.
  // [fanfare] Select a [forestcraft] follower that costs 2 or less in your cemetery and put it into your EX area. It costs 2 less to play this turn.
  card('SP01-001EN', {
    triggers: [{ name: 'Spinaria, Wavering Will', on: 'evolve', when: myFollowerEvolves(null), run(x) { x.heal(x.ctrl, 2); } }],
    fanfare(x) {
      const cand = x.cemetery().filter((i) => x.isFollower(i) && x.def(i).cls === 'forestcraft' && (x.cost(i) || 0) <= 2);
      const t = x.selectOne(cand, 'Spinaria: select a Forestcraft follower that costs 2 or less in your cemetery to put into your EX area.', { aura: false });
      if (t && x.toEx(t)) x.buff(t, { cost: -2 }, x.until.eot(), 'costs 2 less to play this turn');
    },
  });
})();
