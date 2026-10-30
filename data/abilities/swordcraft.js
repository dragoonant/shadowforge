// Swordcraft card scripts (docs/ABILITIES.md).
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;

  // ------------------------------------------------------------------ shared helpers
  const traitsOf = (s, i) => SV.CARDS[s.cards[i].id].traits;
  const isLoot = (s, i) => traitsOf(s, i).includes('Loot');
  // Enemy followers p's effects can select (CR 12.15 Aura).
  const selectableEnemies = (s, p) => SV.followers(s, 1 - p).filter((i) => !SV.chars(s, i).kw.Aura);
  const hasEnemyTarget = (s, iid) => selectableEnemies(s, H.ctrl(s, iid)).length > 0; // CR 10.6.2.3.3
  const oppCemetery = (s, p) => s.players[1 - p].cemetery.length; // "cards in opponents' cemeteries"
  const hollow = (x) => oppCemetery(x.s, x.ctrl) >= 10;
  const myThieves = (s, p) => SV.followers(s, p).filter((i) => SV.hasTrait(s, i, 'Thief'));
  const enemyFollowerPrompt = (name, what) => `${name}: select an enemy follower on the field.${what ? ' ' + what : ''}`;
  // "Whenever you play a Loot card" / "whenever you play or fuse a Loot card". Fusing a Loot card
  // means a Loot card was discarded or buried as a Fuse cost (CR 12.18.4.1).
  const playedLoot = (s, me, ev) => ev.p === H.ctrl(s, me) && isLoot(s, ev.iid);
  const playedOrFusedLoot = (s, me, ev) => ev.p === H.ctrl(s, me) && (ev.type === 'played' ? isLoot(s, ev.iid) : (ev.fused || []).some((i) => isLoot(s, i)));
  // Each opponent buries the top N cards of their deck (an empty deck: nothing happens, Q663).
  const millOpp = (x, n) => { const out = x.deck(x.opp).slice(0, n); for (const i of out) x.bury(i); return out; };

  // "The next [traits] card you play this turn costs N less": a cost filter matching cards with
  // every listed trait until one such card has been played since the effect began (the 'play'
  // log entries; s.log is append-only). The effect itself lasts until the end of the turn.
  SV.COST_FILTERS.swordNext = (s, iid, e) => {
    const ok = (i) => { const t = traitsOf(s, i); return e.traits.every((k) => t.includes(k)); };
    if (!ok(iid)) return false;
    for (let k = s.log.length - 1; k >= 0 && s.log[k].n >= e.since; k--) {
      const l = s.log[k];
      if (l.type === 'play' && l.who === e.p && ok(l.iid)) return false;
    }
    return true;
  };

  // BP20-026EN Returning Slash
  // Select an enemy follower on the field. Deal it 4 damage and, if there's a follower on your field with "Octrice" in its name, put a Gilded Blade token into your EX area.
  // [act] Fuse a Loot card that costs 1 or more: Give this "This costs 1 less to play."
  const loot1 = (s) => (i) => SV.CARDS[s.cards[i].id].traits.includes('Loot') && (SV.CARDS[s.cards[i].id].cost || 0) >= 1;
  card('BP20-026EN', {
    canPlay: (s, iid) => SV.followers(s, 1 - s.cards[iid].owner).length > 0,
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), 'Returning Slash: select an enemy follower. Deal it 4 damage.');
      if (!t) return;
      x.damage(t, 4);
      if (x.followers(x.ctrl).some((i) => x.name(i).includes('Octrice'))) x.tokenToEx('Gilded Blade');
    },
    activated: [{
      text: 'Fuse a Loot card that costs 1 or more: this costs 1 less to play',
      zone: 'hand',
      can: (s, me) => H.canFuse(s, me, loot1(s)),
      why: () => 'No Loot card that costs 1 or more to fuse.',
      run(x) { if (x.fuse({ filter: loot1(x.s) }).length) x.buff(x.me, { cost: -1 }, null, 'costs 1 less to play'); },
    }],
  });

  // BP20-T02EN Crest: Octrice, Hollowness Manifest (crest token: valid in the EX area, CR 10.3.6)
  // At the start of your main phase or whenever you play or fuse a Loot card, place a reversal counter on this. Then, if this has at least 8 reversal counters, banish it, search your deck for a Thief card, reveal it, add it to your hand, then shuffle.
  function octrice(x) {
    x.counter(x.me, 'reversal', 1);
    if (x.counters(x.me, 'reversal') >= 8) {
      x.banish(x.me);
      const [t] = x.search({ filter: (i) => x.hasTrait(i, 'Thief'), prompt: 'Search your deck for a Thief card.' });
      if (t) x.toHand(t);
      x.afterSearch();
    }
  }
  card('BP20-T02EN', {
    mainStart: octrice, mainStartZone: 'ex',
    triggers: [{
      name: 'Reversal counter', on: ['played', 'fused'], zone: 'ex',
      when: (s, me, ev) => ev.p === s.cards[me].owner && SV.CARDS[s.cards[ev.iid].id].traits.includes('Loot'),
      run: octrice,
    }],
  });

  // BP05-029EN Servant of Usurpation
  // [fanfare] Each opponent puts the top card of their deck into their cemetery.
  // During your turn, whenever a card is put from an opponent's deck into the cemetery, give this follower [attack]+1.
  card('BP05-029EN', {
    fanfare(x) { millOpp(x, 1); },
    triggers: [{
      name: 'Servant of Usurpation', on: 'deckToCemetery', // Q661: once per card
      when: (s, me, ev) => s.active === H.ctrl(s, me) && ev.p !== H.ctrl(s, me),
      run(x) { if (x.onField(x.me)) x.buff(x.me, { atk: 1 }); },
    }],
  });

  // BP05-034EN Avaritia
  // Look at the top 4 cards of your deck. You may reveal a Thief card from among them and add it to your hand. Put the remaining cards on the bottom of your deck in any order. If you revealed an Octrice, Omen of Usurpation, return this card to its owner's hand.
  card('BP05-034EN', {
    spell(x) {
      const pick = x.lookPick({ n: 4, filter: (i) => x.hasTrait(i, 'Thief'), prompt: 'Avaritia: you may reveal a Thief card and add it to your hand.' });
      // Q662: only an Octrice revealed by this card's own effect counts.
      if (pick.some((i) => x.named(i, 'Octrice, Omen of Usurpation'))) x.toHand(x.me);
    },
  });

  // BP07-034EN Elegance in Action
  // When this card is discarded, select an enemy follower on the field and engage it.
  // ----------
  // Select an enemy follower on the field. Engage it and draw a card.
  card('BP07-034EN', {
    canPlay: hasEnemyTarget,
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Elegance in Action', 'Engage it and draw a card.'));
      if (!t) return;
      x.engage(t); // Q987: already engaged, you still draw
      x.draw(1);
    },
    triggers: [{
      // Q986: also when discarded for the hand limit in the end phase.
      name: 'Elegance in Action', on: 'discarded', zone: 'cemetery', when: (s, me, ev) => ev.iid === me,
      run(x) {
        const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Elegance in Action', 'Engage it.'));
        if (t) x.engage(t);
      },
    }],
  });

  // BP09-020EN Spartacus
  // Ward.                                      (engine-read)
  // At the start of your end phase, discard any number of cards and draw that many cards plus 1. Then, if there's 1 card or less in your deck, you win the game.
  card('BP09-020EN', {
    endStart(x) {
      const hand = x.hand();
      const pick = hand.length ? x.select({ from: hand, min: 0, max: hand.length, aura: false, prompt: 'Spartacus: discard any number of cards, then draw that many plus 1.' }) : []; // Q1145 0 is allowed
      for (const i of pick) x.discard(i);
      x.draw(pick.length + 1);
      if (x.deck().length <= 1) x.winGame(); // Q1146 resolves before the empty-deck loss is checked
    },
  });

  // BP11-018EN Nahtnaught, Cursed Queen
  // [fanfare] Search your deck for a 1-cost [swordcraft] card, put it into your EX area, then shuffle.
  // [act] [cost00]: Select an enemy follower on the field and engage it. It becomes Boxed until the end of its controller's next turn. Activate only once per turn. (Boxed followers lose all abilities and don't refresh during the start phase.)
  card('BP11-018EN', {
    fanfare(x) {
      const [c] = x.search({ filter: (i) => x.cost(i) === 1 && x.def(i).cls === 'swordcraft', prompt: 'Nahtnaught: search your deck for a 1-cost Swordcraft card to put into your EX area.' });
      if (c) x.toEx(c);
      x.afterSearch();
    },
    activated: [{
      text: 'Engage an enemy follower; it becomes Boxed',
      cost: { pp: 0 },
      once: true,
      can: hasEnemyTarget,
      why: () => 'There is no enemy follower to select.',
      run(x) {
        const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Nahtnaught', 'Engage it; it becomes Boxed.'));
        if (!t) return;
        x.engage(t);
        // Q1489: Boxed even if it was already engaged. CR 5.31: loses all abilities, doesn't refresh.
        x.buff(t, { flags: { loseAbilities: true, noRefresh: true } }, { end: { at: 'endOf', p: x.s.cards[t].ctrl } }, 'Boxed');
      },
    }],
  });

  // BP15-020EN Octrice, Hollow Usurpation
  // [fanfare] Put a Remnant of Hollowness token into your EX area.
  // [act] [cost00]: The next Loot card you play this turn costs 2 less. Activate only twice per turn.
  // [act] Banish an Octrice, Omen of Usurpation from your cemetery: Put a Gilded Blade, Gilded Goblet, or Gilded Boots token into your EX area.
  const OCTRICE_OMEN = 'Octrice, Omen of Usurpation';
  card('BP15-020EN', {
    fanfare(x) { x.tokenToEx('Remnant of Hollowness'); },
    activated: [{
      text: 'The next Loot card you play this turn costs 2 less',
      cost: { pp: 0 },
      can: (s, me) => !(s.ti.once[`once:${me}:twice1`] && s.ti.once[`once:${me}:twice2`]),
      why: () => 'Already used twice this turn.',
      run(x) {
        if (!x.once('twice1')) x.once('twice2');
        x.effect({ costMod: -2, filter: 'swordNext', traits: ['Loot'], since: x.s.logN, ...x.until.eot() }); // Q1908 twice: 4 less
      },
    }, {
      text: 'Banish an Octrice, Omen of Usurpation from your cemetery: a Gilded token',
      can: (s, me) => H.inCemetery(s, H.ctrl(s, me), (i) => SV.nameHas(s, i, OCTRICE_OMEN)),
      why: () => 'You need an Octrice, Omen of Usurpation in your cemetery.',
      pay(x) {
        const o = x.selectOne(x.cemetery().filter((i) => x.named(i, OCTRICE_OMEN)), 'Choose an Octrice, Omen of Usurpation to banish.', { aura: false });
        if (o) x.banish(o);
      },
      run(x) {
        const names = ['Gilded Blade', 'Gilded Goblet', 'Gilded Boots'];
        const [k] = x.choose('Octrice: put which token into your EX area?', names.map((label) => ({ label })));
        x.tokenToEx(names[k]);
      },
    }],
  });

  // BP15-PR10EN Remnant of Hollowness (token spell)
  // Choose 1. If there are at least 10 cards in opponents' cemeteries, choose up to 2 instead. (1) Select an enemy follower on the field and deal it 3 damage. If there are at least 10 cards in opponents' cemeteries, deal 8 damage instead. (2) Look at the top 3 cards of your deck. You may reveal a Thief card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  card('BP15-PR10EN', {
    spell(x) {
      const big = hollow(x);
      const pick = x.choose(big ? 'Remnant of Hollowness: choose up to 2.' : 'Remnant of Hollowness: choose 1.', [
        { label: `Deal ${big ? 8 : 3} damage to an enemy follower.`, can: hasEnemyTarget(x.s, x.me) }, // CR 5.18.3.1.2
        { label: 'Look at the top 3 cards of your deck; you may add a Thief card to your hand.' },
      ], 1, big ? 2 : 1);
      // Q1948: the target is selected first, then (1) resolves, then (2).
      const t = pick.includes(0) ? x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Remnant of Hollowness', `Deal it ${big ? 8 : 3} damage.`)) : null;
      if (t) x.damage(t, big ? 8 : 3);
      if (pick.includes(1)) x.lookPick({ n: 3, filter: (i) => x.hasTrait(i, 'Thief'), prompt: 'Remnant of Hollowness: you may reveal a Thief card and add it to your hand.' });
    },
  });

  // BP15-024EN Arsène Lupin
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Each opponent buries the top card of their deck. If a follower was buried this way, put a Gilded Blade token into your EX area. If a spell or amulet was buried this way, put a Gilded Goblet token into your EX area.
  card('BP15-024EN', {
    fanfare(x) {
      for (const i of millOpp(x, 1)) {
        const t = x.type(i);
        if (t === 'follower') x.tokenToEx('Gilded Blade');
        else if (t === 'spell' || t === 'amulet') x.tokenToEx('Gilded Goblet');
      }
    },
  });
  // BP15-025EN Arsène Lupin (evolved)
  // On Evolve - Look at the top 4 cards of your deck. You may reveal a Thief card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  card('BP15-025EN', {
    onEvolve(x) { x.lookPick({ n: 4, filter: (i) => x.hasTrait(i, 'Thief'), prompt: 'Arsène Lupin: you may reveal a Thief card and add it to your hand.' }); },
  });

  // BP15-026EN Ultimate Hollow
  // [quick]                                    (engine-read)
  // Select an enemy follower on the field. Deal it 2 damage and put a Gilded Goblet token into your EX area.
  card('BP15-026EN', {
    canPlay: hasEnemyTarget,
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Ultimate Hollow', 'Deal it 2 damage.'));
      if (!t) return;
      x.damage(t, 2);
      x.tokenToEx('Gilded Goblet');
    },
  });

  // BP15-028EN Adherent of Hollowness
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] If there are at least 10 cards in opponents' cemeteries, evolve this.
  card('BP15-028EN', {
    fanfare(x) { if (hollow(x)) x.evolve(x.me); },
  });
  // BP15-029EN Adherent of Hollowness (evolved)
  // On Evolve - Put a Gilded Blade token into your EX area.
  // Once per turn, when you play a Loot card, put a Gilded Boots token into your EX area.
  card('BP15-029EN', {
    onEvolve(x) { x.tokenToEx('Gilded Blade'); },
    triggers: [{ name: 'Gilded Boots', on: 'played', limit: 1, when: playedLoot, run(x) { x.tokenToEx('Gilded Boots'); } }], // Q1913 either turn
  });

  // BP15-T01EN Gilded Blade (token spell)
  // Select an enemy follower on the field. Deal it 2 damage and, if there are at least 10 cards in opponents' cemeteries, deal 2 damage to its leader.
  card('BP15-T01EN', {
    canPlay: hasEnemyTarget,
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Gilded Blade', 'Deal it 2 damage.'));
      if (!t) return;
      const owner = x.s.cards[t].ctrl;
      x.damage(t, 2);
      if (hollow(x)) x.damage(x.leader(owner), 2);
    },
  });
  // BP15-T02EN Gilded Goblet (token spell)
  // Give your leader [defense]+1. If there are at least 10 cards in opponents' cemeteries, give [defense]+2 instead.
  card('BP15-T02EN', {
    spell(x) { x.heal(x.ctrl, hollow(x) ? 2 : 1); },
  });
  // BP15-T03EN Gilded Boots (token spell)
  // Select a Thief follower on your field and give it Rush. If there are at least 10 cards in opponents' cemeteries, give Storm instead.
  card('BP15-T03EN', {
    canPlay: (s, iid) => myThieves(s, s.cards[iid].owner).length > 0,
    spell(x) {
      const t = x.selectOne(myThieves(x.s, x.ctrl), 'Gilded Boots: select a Thief follower on your field.');
      if (t) x.give(t, hollow(x) ? 'Storm' : 'Rush');
    },
  });

  // BP19-019EN Barbaros, Briny Convict
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // During your turn, any Loot card you play from the EX area costs 1 less.
  // [fanfare] Put a Dread Pirate's Flag token into your EX area.
  // Q2359: two copies, 2 less.
  const barbarosCost = (s, me, iid, p) => {
    const ctrl = s.cards[me].ctrl;
    return p === ctrl && s.active === ctrl && s.cards[iid].zone === 'ex' && isLoot(s, iid) ? -1 : 0;
  };
  card('BP19-019EN', {
    costAura: barbarosCost,
    fanfare(x) { x.tokenToEx("Dread Pirate's Flag"); },
  });
  // BP19-020EN Barbaros, Briny Convict (evolved)
  // During your turn, any Loot card you play from the EX area costs 1 less.
  // During your turn, whenever you play a Loot card, choose 1 that you haven't chosen this turn. (1) Select an enemy follower on the field and destroy it. (2) Each opponent buries the top 2 cards of their deck. (3) Recover 2 play points.
  card('BP19-020EN', {
    costAura: barbarosCost,
    triggers: [{
      name: 'Barbaros, Briny Convict', on: 'played',
      when: (s, me, ev) => s.active === H.ctrl(s, me) && playedLoot(s, me, ev),
      run(x) {
        // "That you haven't chosen this turn" is remembered per copy (Q2360, Q1726). An option
        // whose effect would change nothing can still be chosen (Q1288); one with no target can't.
        const used = (k) => !!x.s.ti.once[`once:${x.me}:barbaros${k}`];
        const [k] = x.choose("Barbaros: choose 1 that you haven't chosen this turn.", [
          { label: 'Destroy an enemy follower.', can: !used(0) && hasEnemyTarget(x.s, x.me) },
          { label: 'Each opponent buries the top 2 cards of their deck.', can: !used(1) },
          { label: 'Recover 2 play points.', can: !used(2) },
        ]);
        if (k == null) return;
        x.once(`barbaros${k}`);
        if (k === 0) { const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Barbaros', 'Destroy it.')); if (t) x.destroy(t); }
        else if (k === 1) millOpp(x, 2);
        else x.recoverPP(2);
      },
    }],
  });

  // BP19-026EN Tidal Gunner
  // [fanfare] Put a Dread Pirate's Flag token into your EX area.
  // Whenever you play a Dread Pirate's Flag, select an enemy leader or enemy follower on the field and deal it 1 damage.
  card('BP19-026EN', {
    fanfare(x) { x.tokenToEx("Dread Pirate's Flag"); },
    triggers: [{
      name: 'Tidal Gunner', on: 'played',
      when: (s, me, ev) => ev.p === H.ctrl(s, me) && SV.nameHas(s, ev.iid, "Dread Pirate's Flag"),
      run(x) {
        const t = x.selectOne(x.enemyTargets(), 'Tidal Gunner: select an enemy leader or enemy follower on the field. Deal it 1 damage.');
        if (t) x.damage(t, 1);
      },
    }],
  });

  // BP19-028EN Storm-Wracked First Mate
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Put a Dread Pirate's Flag token into your EX area.
  card('BP19-028EN', {
    fanfare(x) { x.tokenToEx("Dread Pirate's Flag"); },
  });
  // BP19-029EN Storm-Wracked First Mate (evolved)
  // On Evolve - Search your deck for a Condemned–Thief follower, reveal it, add it to your hand, then shuffle.
  card('BP19-029EN', {
    onEvolve(x) {
      const [c] = x.search({ filter: (i) => x.isFollower(i) && x.hasTrait(i, 'Condemned') && x.hasTrait(i, 'Thief'), prompt: 'Storm-Wracked First Mate: search your deck for a Condemned–Thief follower.' });
      if (c) x.toHand(c);
      x.afterSearch();
    },
  });

  // BP19-030EN Deep-Sea Scout
  // [fanfare] Put a Dread Pirate's Flag token into your EX area.
  card('BP19-030EN', {
    fanfare(x) { x.tokenToEx("Dread Pirate's Flag"); },
  });

  // BP19-T01EN Dread Pirate's Flag (token spell)
  // Select a Thief follower on your field. Give it [attack]+1 and, if it's a Condemned–Thief follower, deal 1 damage to each enemy leader.
  card('BP19-T01EN', {
    canPlay: (s, iid) => myThieves(s, s.cards[iid].owner).length > 0,
    spell(x) {
      const t = x.selectOne(myThieves(x.s, x.ctrl), "Dread Pirate's Flag: select a Thief follower on your field.");
      if (!t) return;
      x.buff(t, { atk: 1 });
      if (x.hasTrait(t, 'Condemned') && x.hasTrait(t, 'Thief')) x.damage(x.leader(x.opp), 1);
    },
  });

  // BP20-019EN Octrice, Hollowness Manifest
  // Whenever you play or fuse a Loot card, give this Storm.
  // [fanfare] Choose 1. (1) Put a Crest: Octrice, Hollowness Manifest token into your EX area. (2) Search your deck for a Returning Slash, reveal it, add it to your hand, then shuffle.
  card('BP20-019EN', {
    triggers: [{ name: 'Octrice, Hollowness Manifest', on: ['played', 'fused'], when: playedOrFusedLoot, run(x) { if (x.onField(x.me)) x.give(x.me, 'Storm'); } }],
    fanfare(x) {
      const P = x.P();
      const crest = SV.TOKENS['Crest: Octrice, Hollowness Manifest'];
      const canCrest = P.ex.length < P.exLimit && !P.ex.some((i) => x.s.cards[i].id === crest); // a crest is unique (CR 9.1.5.1)
      const [k] = x.choose('Octrice: choose 1.', [
        { label: 'Put a Crest: Octrice, Hollowness Manifest token into your EX area.', can: canCrest },
        { label: 'Search your deck for a Returning Slash.' },
      ]);
      if (k === 0) x.tokenToEx('Crest: Octrice, Hollowness Manifest');
      else if (k === 1) {
        const [c] = x.search({ filter: (i) => x.name(i) === 'Returning Slash', prompt: 'Search your deck for a Returning Slash.' });
        if (c) x.toHand(c);
        x.afterSearch();
      }
    },
  });

  // BP20-020EN Sinciro, Heir to Usurpation
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] If this has a fusion counter, draw a card. If not, put a Gilded Blade token into your EX area.
  // [act] Fuse X Loot cards that cost 1 or more: Place X fusion counters on this. X must be 2 or less.
  card('BP20-020EN', {
    fanfare(x) { if (x.counters(x.me, 'fusion') > 0) x.draw(1); else x.tokenToEx('Gilded Blade'); },
    activated: [{
      text: 'Fuse 1 or 2 Loot cards that cost 1 or more: place that many fusion counters',
      zone: 'hand', // Q2410
      can: (s, me) => H.canFuse(s, me, loot1(s)),
      why: () => 'No Loot card that costs 1 or more to fuse.',
      run(x) {
        // Q2411: hand and EX area may be mixed. CR 12.18.2.2.1: X is at least 1 when possible.
        const f = x.fuse({ filter: loot1(x.s), min: 1, max: 2, prompt: 'Sinciro: fuse 1 or 2 Loot cards that cost 1 or more (from your hand they are discarded, from your EX area they are buried).' });
        if (f.length && x.s.cards[x.me].zone === 'ex') x.counter(x.me, 'fusion', f.length);
      },
    }],
  });
  // BP20-021EN Sinciro, Heir to Usurpation (evolved)
  // If this would deal ability damage, it deals that much +2 for every fusion counter on it instead.
  // On Evolve - Select an enemy follower on the field and deal it 3 damage.
  // On Super-Evolve - Deal 1 damage to each enemy leader and enemy follower on the field.
  card('BP20-021EN', {
    // Q2412 ability damage = all but attack/combat damage. Q2413/Q2414 (the receiver orders several
    // modifiers) are not asked: modifiers apply in source order.
    replaceDamage: (s, me, ev) => (ev.src === me && ev.kind === 'ability' ? ev.amount + 2 * (s.cards[me].counters.fusion || 0) : ev.amount),
    onEvolve(x) {
      const t = x.selectOne(x.followers(x.opp), enemyFollowerPrompt('Sinciro', 'Deal it 3 damage.'));
      if (t) x.damage(t, 3);
    },
    onSuperEvolve(x) { x.damageMany([x.leader(x.opp), ...x.followers(x.opp)], 1); },
  });

  // BP20-033EN Devotee of Usurpation
  // Rush.                                      (engine-read)
  // Whenever you play or fuse a Loot card, give this Assail.
  // [lastwords] Put a Gilded Goblet and Gilded Boots token into your EX area.
  card('BP20-033EN', {
    triggers: [{ name: 'Devotee of Usurpation', on: ['played', 'fused'], when: playedOrFusedLoot, run(x) { if (x.onField(x.me)) x.give(x.me, 'Assail'); } }], // Q2419 either turn
    lastWords(x) { x.tokenToEx('Gilded Goblet'); x.tokenToEx('Gilded Boots'); },
  });
})();
