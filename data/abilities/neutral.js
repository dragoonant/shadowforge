// Neutral card scripts (docs/ABILITIES.md).
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;

  // ------------------------------------------------------------ shared helpers
  const base = (s, i) => SV.CARDS[s.cards[i].id]; // the printed card (in the cemetery/deck/evolve deck)
  const isFollowerCard = (s, i) => SV.parsed(base(s, i)).type === 'follower';
  // What p's cards/abilities can select among `list` (Aura, CR 12.15: an opposing Aura card can't be selected).
  const selectable = (s, p, list) => list.filter((i) => s.cards[i].ctrl === p || !SV.chars(s, i).kw.Aura);
  const enemyFollowers = (s, p) => selectable(s, p, SV.followers(s, 1 - p));
  // Cost of a card on the field: an evolved follower keeps its unevolved cost (Q1204, Q1586, Q1659).
  const costOf = (s, i) => SV.chars(s, i).cost || 0;
  const angelish = (x, i) => x.hasTrait(i, 'Angel') || x.hasTrait(i, 'Fallen Angel');
  const angelsInCemetery = (x) => x.cemetery().filter((i) => x.hasTrait(i, 'Angel')).length;
  // "If there's a follower on your field or in your cemetery with "Cutthroat" in its name" (CR 2.1.2).
  const cutthroat = (x) => x.followers(x.ctrl).some((i) => x.named(i, 'Cutthroat'))
    || x.cemetery().some((i) => isFollowerCard(x.s, i) && x.named(i, 'Cutthroat'));
  const followersInCemetery = (s, p) => s.players[p].cemetery.filter((i) => isFollowerCard(s, i)).length;
  // "Select a follower on your field. Give it <kw> and, if it's a Wasteland follower, <buff>." (Mount tokens)
  const mount = (kw, mod) => ({
    run(x) {
      const t = x.selectOne(x.followers(x.ctrl), `Select a follower on your field to give ${kw}.`);
      if (!t) return;
      x.give(t, kw);
      if (x.hasTrait(t, 'Wasteland')) x.buff(t, mod);
    },
  });
  // Advanced cards may be summoned / moved from the evolve deck faceup or facedown (CR 9.2.2 returns
  // them faceup; nothing makes a faceup advanced card unusable).
  const inEvoDeck = (x, name) => x.P().evoDeck.filter((i) => x.name(i) === name);

  // BP10-121EN Corruption Guardian
  // Ward.                                      (engine-read)
  // [fanfare] Discard an Angel or Fallen Angel card: Give your leader [defense]+3. Draw a card. Recover 2 play points.
  card('BP10-121EN', {
    fanfare(x) {
      // CR 10.4.7.4 "[process]: [effect]" on an automatic ability: optional, decided on resolution.
      const cand = x.hand().filter((i) => x.hasTrait(i, 'Angel') || x.hasTrait(i, 'Fallen Angel'));
      if (!cand.length) return;
      const pick = x.select({ from: cand, min: 0, max: 1, prompt: 'Corruption Guardian: you may discard an Angel or Fallen Angel card to give your leader +3 defense, draw a card and recover 2 play points.' });
      if (!pick.length) return;
      x.discard(pick[0]);
      x.heal(x.ctrl, 3); x.draw(1); x.recoverPP(2);
    },
  });

  // BP01-159EN Bellringer Angel
  // [evolve][cost02]: Evolve this follower.     (engine-read)
  // Ward.                                      (engine-read)
  // [lastwords] Draw a card.
  card('BP01-159EN', { lastWords(x) { x.draw(1); } });
  // BP01-160EN Bellringer Angel (evolved)
  // Ward.
  // On Evolve: Select an enemy follower on the field and deal it 2 damage.
  // [lastwords] Draw a card.
  // (A leaving card's Last Words are read from the face it had on the field, CR 10.7.4.1.2.)
  card('BP01-160EN', {
    onEvolve(x) { const t = x.selectOne(x.followers(x.opp), 'Bellringer Angel: select an enemy follower. Deal it 2 damage.'); if (t) x.damage(t, 2); },
    lastWords(x) { x.draw(1); },
  });

  // BP03-117EN Winged Inversion
  // Choose one of the following. (1) Discard an Angel follower: Select an enemy follower on the field and destroy it. (2) Discard a Fallen Angel follower: Give your leader [defense]+3. Draw a card.
  card('BP03-117EN', {
    spell(x) {
      const hasTarget = enemyFollowers(x.s, x.ctrl).length > 0;
      const [m] = x.choose('Winged Inversion: choose one.', [
        { label: 'Discard an Angel follower: destroy an enemy follower.', can: hasTarget },
        { label: 'Discard a Fallen Angel follower: give your leader +3 defense and draw a card.' },
      ]);
      const trait = m === 0 ? 'Angel' : 'Fallen Angel';
      if (m == null) return;
      // Q532: the discard is optional; choosing an option and not paying does nothing.
      const cand = x.hand().filter((i) => isFollowerCard(x.s, i) && x.hasTrait(i, trait));
      const pick = x.select({ from: cand, min: 0, max: 1, prompt: `Winged Inversion: you may discard a ${trait} follower.` });
      if (!pick.length) return;
      x.discard(pick[0]);
      if (m === 0) { const t = x.selectOne(x.followers(x.opp), 'Select an enemy follower to destroy.'); if (t) x.destroy(t); }
      else { x.heal(x.ctrl, 3); x.draw(1); }
    },
  });

  // BP04-124EN Goblin Princess
  // [evolve][cost01]: Evolve this follower.     (engine-read)
  // [fanfare] Search your deck for a [neutral] follower that costs 1 play point and put it onto your field.
  card('BP04-124EN', {
    fanfare(x) {
      const [t] = x.search({ filter: (i) => { const d = base(x.s, i); return d.cls === 'neutral' && isFollowerCard(x.s, i) && d.cost === 1; }, prompt: 'Goblin Princess: search your deck for a neutral follower that costs 1.' });
      if (t) x.summon(t);
      x.afterSearch();
    },
  });

  // BP05-103EN Mjerrabaine, Omen of One
  // [evolve] [cost01]: Evolve this follower.    (engine-read)
  // Rush.                                      (engine-read)
  // At the start of your end phase, if there are 2 cards or less in your hand, deal 3 damage to each enemy leader. If there are 0 cards in your hand, deal 3 damage to each enemy follower on the field.
  card('BP05-103EN', {
    endStart(x) { // conditions checked on resolution (CR 10.7); Q724 both can apply
      if (x.hand().length <= 2) x.damage(x.leader(x.opp), 3);
      if (x.hand().length === 0) x.damageMany(x.followers(x.opp), 3);
    },
  });

  // BP09-126EN Paradise Vanguard
  // [evolve] [cost01]: Evolve this follower.    (engine-read)
  // [fanfare] If there are at least 5 Angel cards in your cemetery, select an enemy follower on the field and banish it.
  card('BP09-126EN', {
    fanfare(x) {
      if (angelsInCemetery(x) < 5) return;
      const t = x.selectOne(x.followers(x.opp), 'Paradise Vanguard: select an enemy follower to banish.');
      if (t) x.banish(t);
    },
  });
  // BP09-127EN Paradise Vanguard (evolved)
  // On Evolve - Select an enemy follower that costs 4 or less on the field and banish it.
  card('BP09-127EN', {
    onEvolve(x) {
      const t = x.selectOne(x.followers(x.opp).filter((i) => costOf(x.s, i) <= 4), 'Paradise Vanguard: select an enemy follower that costs 4 or less to banish.');
      if (t) x.banish(t);
    },
  });

  // BP09-137EN Fount of Angels
  // [fanfare] Look at the top 3 cards of your deck. You may reveal an Angel or Fallen Angel card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  // [act] [engage], bury this card: Give your leader [defense]+1. Activate only if there are at least 2 Angel and/or Fallen Angel followers on your field.
  card('BP09-137EN', {
    fanfare(x) { x.lookPick({ n: 3, filter: (i) => angelish(x, i), prompt: 'Fount of Angels: you may reveal an Angel or Fallen Angel card and add it to your hand.' }); },
    activated: [{
      text: 'Engage and bury this: give your leader +1 defense',
      cost: { engage: true },
      // Q1211: a follower with both traits counts once.
      can: (s, me) => SV.followers(s, s.cards[me].ctrl).filter((i) => { const t = SV.chars(s, i).traits; return t.includes('Angel') || t.includes('Fallen Angel'); }).length >= 2,
      why: () => 'You need at least 2 Angel and/or Fallen Angel followers on your field.',
      pay(x) { x.bury(x.me); },
      run(x) { x.heal(x.ctrl, 1); },
    }],
  });

  // BP10-109EN XXI. Zelgenea, The World
  // [fanfare] Select an enemy follower on the field. If there are no other followers on your field, destroy it and draw a card.
  // [fanfare] If your leader's defense is 10 or less, give it [defense]+5.
  // [act] [cost10], banish this card from your cemetery: You may put a XXI. Zelgenea, O Great World from your evolve deck into your EX area.
  card('BP10-109EN', {
    fanfare: [ // two Fanfares: the player orders them (Q1328, Q1330)
      (x) => {
        const t = x.selectOne(x.followers(x.opp), 'XXI. Zelgenea: select an enemy follower.');
        if (!t) return; // Q1327: no target, no draw
        if (x.followers(x.ctrl).every((i) => i === x.me)) { x.destroy(t); x.draw(1); } // Q1341: draw even if it isn't destroyed
      },
      (x) => { if (x.P().defense <= 10) x.heal(x.ctrl, 5); },
    ],
    activated: [{
      text: 'Banish this from your cemetery: you may put a XXI. Zelgenea, O Great World into your EX area',
      zone: 'cemetery', // Q1329
      cost: { pp: 10 },
      pay(x) { x.banish(x.me); },
      run(x) {
        const pick = x.select({ from: inEvoDeck(x, 'XXI. Zelgenea, O Great World'), min: 0, max: 1, aura: false, prompt: 'You may put a XXI. Zelgenea, O Great World from your evolve deck into your EX area.' });
        if (pick.length) x.toEx(pick[0]);
      },
    }],
  });
  // BP10-110EN XXI. Zelgenea, O Great World (advanced)
  // At the start of your end phase, if this card is in your EX area, deal 4 damage to each enemy leader and enemy follower on the field.
  // ----------
  // [fanfare] Deal 10 damage to each enemy leader and enemy follower on the field.
  card('BP10-110EN', {
    endStart(x) { x.damageMany([x.leader(x.opp), ...x.followers(x.opp)], 4); }, endStartZone: 'ex', // Q1331 only from the EX area
    fanfare(x) { x.damageMany([x.leader(x.opp), ...x.followers(x.opp)], 10); },
  });

  // BP10-114EN Fallen Shot
  // Select an Angel follower in your cemetery and enemy follower on the field. Put them into their owners' EX areas.
  const angelFollowersInCemetery = (s, p) => s.players[p].cemetery.filter((i) => isFollowerCard(s, i) && base(s, i).traits.includes('Angel'));
  card('BP10-114EN', {
    // Q1333: playable only if both can be selected.
    canPlay: (s, iid) => { const p = s.cards[iid].owner; return angelFollowersInCemetery(s, p).length > 0 && enemyFollowers(s, p).length > 0; },
    spell(x) {
      const a = x.selectOne(angelFollowersInCemetery(x.s, x.ctrl), 'Fallen Shot: select an Angel follower in your cemetery.', { aura: false });
      const t = x.selectOne(x.followers(x.opp), 'Fallen Shot: select an enemy follower on the field.');
      if (a) x.toEx(a); // Q1334: a full EX area leaves the card where it is
      if (t) x.toEx(t);
    },
  });

  // BP11-T04EN Bullet Bike (token amulet)
  // [act] Bury this card: Select a follower on your field. Give it Rush and, if it's a Wasteland follower, [attack]+1.
  card('BP11-T04EN', {
    activated: [{
      text: 'Bury this: give a follower on your field Rush (Wasteland: +1 attack)',
      can: (s, me) => SV.followers(s, s.cards[me].ctrl).length > 0, // CR 10.6.2.3.3 a target is required
      why: () => 'There is no follower on your field.',
      pay(x) { x.bury(x.me); },
      ...mount('Rush', { atk: 1 }),
    }],
  });

  // BP12-106EN Seraphic Blade
  // Choose one. (1) Select an enemy card that costs 2 or less on the field and destroy it. (2) [cost02]: Select an enemy card that costs 6 or less on the field and destroy it.
  const enemyCards = (s, p, max) => selectable(s, p, SV.field(s, 1 - p)).filter((i) => costOf(s, i) <= max);
  card('BP12-106EN', {
    // "(2) [cost02]: ..." is an optional cost paid on resolution (CR 10.4.7.2, 10.4.7.5; Q532 and
    // Q665/Q666 rule the same wording that way), so it is not part of the cost of playing the spell.
    canPlay: (s, iid) => enemyCards(s, s.cards[iid].owner, 6).length > 0,
    spell(x) {
      const low = enemyCards(x.s, x.ctrl, 2), high = enemyCards(x.s, x.ctrl, 6);
      const [m] = x.choose('Seraphic Blade: choose one.', [
        { label: 'Destroy an enemy card that costs 2 or less.', can: low.length > 0 },
        { label: '[2 play points]: destroy an enemy card that costs 6 or less.', can: high.length > 0 },
      ]);
      if (m == null) return;
      if (m === 1 && !x.mayPay({ pp: 2 }, 'Seraphic Blade: pay 2 play points to destroy an enemy card that costs 6 or less?')) return;
      const t = x.selectOne(m === 0 ? low : high, `Seraphic Blade: select an enemy card that costs ${m === 0 ? 2 : 6} or less to destroy.`);
      if (t) x.destroy(t);
    },
  });

  // BP12-T11EN Repair Mode (token spell)
  // [quick]                                    (engine-read)
  // Give your leader [defense]+1.
  card('BP12-T11EN', { spell(x) { x.heal(x.ctrl, 1); } });

  // BP12-T12EN Naterran Great Tree (token amulet)
  // When this card leaves the field, draw a card, then discard a card.
  // [act] [cost01]: Bury this card.
  card('BP12-T12EN', {
    triggers: [{ name: 'Leaves the field', on: 'leave', when: H.self, run(x) { x.draw(1); x.chooseDiscard(1); } }],
    activated: [{ text: 'Bury this', cost: { pp: 1 }, run(x) { x.bury(x.me); } }],
  });

  // BP13-107EN Planetary Fracture
  // Banish each card on the field and in the EX area. Each player banishes the top 10 cards of their deck.
  card('BP13-107EN', {
    spell(x) {
      // "Each" is simultaneous (CR 10.7.4.2). There is no simultaneous-banish door; no card in the pool
      // reacts to ANOTHER card leaving the field or being banished (only Naterran Great Tree, to itself),
      // so banishing one at a time is observably the same. Q1740: both players' fields and EX areas.
      for (const p of [x.ctrl, x.opp]) for (const i of x.field(p)) x.banish(i);
      for (const p of [x.ctrl, x.opp]) for (const i of x.ex(p)) x.banish(i);
      for (const p of [x.ctrl, x.opp]) for (const i of x.deck(p).slice(0, 10)) x.banish(i);
    },
  });

  // BP14-108EN Glistering Angel
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // Ward.                                      (engine-read)
  // [fanfare] If there are at least 5 Angel cards in your cemetery, give your leader [defense]+2.
  card('BP14-108EN', { fanfare(x) { if (angelsInCemetery(x) >= 5) x.heal(x.ctrl, 2); } });
  // BP14-109EN Glistering Angel (evolved)
  // Ward.
  // On Evolve - Look at the top 4 cards of your deck. You may reveal an Angel or Fallen Angel card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  card('BP14-109EN', {
    onEvolve(x) { x.lookPick({ n: 4, filter: (i) => angelish(x, i), prompt: 'Glistering Angel: you may reveal an Angel or Fallen Angel card and add it to your hand.' }); },
  });

  // BP14-110EN Angel's Blessing
  // [quick]                                    (engine-read)
  // Give your leader [defense]+2. Draw 2 cards.
  card('BP14-110EN', { spell(x) { x.heal(x.ctrl, 2); x.draw(2); } });

  // BP15-112EN Mjerrabaine, Great One
  // [fanfare] Discard 3 cards: Put a Great Testimony token into your EX area.
  // [act] Banish a Mjerrabaine, Omen of One from your cemetery: Deal 2 damage to each enemy leader. Draw 2 cards. Activate only once per turn.
  const OMEN = 'Mjerrabaine, Omen of One';
  card('BP15-112EN', {
    fanfare(x) {
      // CR 10.4.7.4: the discard is an optional cost, decided on resolution; it can't be paid with fewer than 3 cards.
      if (x.hand().length < 3) return;
      if (!x.may('Mjerrabaine, Great One: discard 3 cards to put a Great Testimony token into your EX area?', 'Discard 3', "Don't")) return;
      x.chooseDiscard(3);
      x.tokenToEx('Great Testimony');
    },
    activated: [{
      text: 'Banish a Mjerrabaine, Omen of One from your cemetery: 2 damage to the enemy leader, draw 2',
      once: true,
      can: (s, me) => H.inCemetery(s, s.cards[me].ctrl, (i) => base(s, i).name === OMEN),
      why: () => 'You need a Mjerrabaine, Omen of One in your cemetery.',
      pay(x) { const o = x.selectOne(x.cemetery().filter((i) => x.name(i) === OMEN), 'Choose a Mjerrabaine, Omen of One to banish.', { aura: false }); if (o) x.banish(o); },
      run(x) { x.damage(x.leader(x.opp), 2); x.draw(2); },
    }],
  });

  // BP15-PR17EN Great Testimony (token spell)
  // Select an enemy follower on the field. Destroy it and, if there's a Mjerrabaine, Great One on your field, deal 2 damage to its leader.
  card('BP15-PR17EN', {
    canPlay: (s, iid) => enemyFollowers(s, s.cards[iid].owner).length > 0, // CR 10.6.2.3.3 a target is required
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), 'Great Testimony: select an enemy follower to destroy.');
      if (!t) return;
      const lead = x.leader(x.s.cards[t].ctrl);
      x.destroy(t);
      if (x.followers(x.ctrl).some((i) => x.name(i) === 'Mjerrabaine, Great One')) x.damage(lead, 2);
    },
  });

  // BP15-113EN Gilnelise, Ravenous Craving
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // While your leader's defense is 10 or less, this has Drain.
  const lowDrain = (s, me, t, r) => { if (t === me && s.players[s.cards[me].ctrl].defense <= 10) r.kw.Drain = true; };
  card('BP15-113EN', { auras: [lowDrain] });
  // BP15-114EN Gilnelise, Ravenous Craving (evolved)
  // While your leader's defense is 10 or less, this has Drain.
  // On Evolve - Choose 1. (1) Select another follower on the field and give it [attack]+2/[defense]-2. (2) Put a Ravenous Sweetness token into your EX area.
  card('BP15-114EN', {
    auras: [lowDrain],
    onEvolve(x) {
      const others = selectable(x.s, x.ctrl, SV.field(x.s).filter((i) => i !== x.me && x.isFollower(i)));
      const [m] = x.choose('Gilnelise: choose 1.', [
        { label: 'Give another follower +2/-2.', can: others.length > 0 },
        { label: 'Put a Ravenous Sweetness token into your EX area.', can: x.ex().length < x.P().exLimit },
      ]);
      if (m === 0) { const t = x.selectOne(others, 'Gilnelise: select another follower. Give it +2/-2.'); if (t) x.buff(t, { atk: 2, def: -2 }); }
      else if (m === 1) x.tokenToEx('Ravenous Sweetness');
    },
  });

  // BP16-113EN Olivia, Heroic Dark Angel
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // Ward.                                      (engine-read)
  // [fanfare] Draw a card.
  card('BP16-113EN', { fanfare(x) { x.draw(1); } });
  // BP16-114EN Olivia, Heroic Dark Angel (evolved)
  // Ward.
  // On Evolve - Select an enemy follower on the field and deal it 5 damage.
  // On Super-Evolve - Give your leader [defense]+3. Recover 3 play points.
  card('BP16-114EN', {
    onEvolve(x) { const t = x.selectOne(x.followers(x.opp), 'Olivia: select an enemy follower. Deal it 5 damage.'); if (t) x.damage(t, 5); },
    onSuperEvolve(x) { x.heal(x.ctrl, 3); x.recoverPP(3); }, // Q1974/Q1973: both trigger, player orders them
  });

  // BP16-119EN Leah, Bellringer Angel
  // Ward.                                      (engine-read)
  // [lastwords] Give your leader [defense]+1. Draw a card.
  card('BP16-119EN', { lastWords(x) { x.heal(x.ctrl, 1); x.draw(1); } });

  // BP16-T22EN Arcane Personnel Carrier (token amulet)
  // [act] Bury this: Select a follower on your field. Give it Ward and, if it's a Wasteland follower, [defense]+1.
  card('BP16-T22EN', {
    activated: [{
      text: 'Bury this: give a follower on your field Ward (Wasteland: +1 defense)',
      can: (s, me) => SV.followers(s, s.cards[me].ctrl).length > 0,
      why: () => 'There is no follower on your field.',
      pay(x) { x.bury(x.me); },
      ...mount('Ward', { def: 1 }),
    }],
  });

  // BP17-111EN Maisha, Purgation's Vessel (evolved)
  // While there are at least 10 followers in your cemetery, this has Storm.
  // On Evolve - Draw a card.
  // [act] [cost00]: Select an enemy follower on the field and deal it 4 damage for every 5 followers in your cemetery. Activate only once per turn.
  card('BP17-111EN', {
    auras: [(s, me, t, r) => { if (t === me && followersInCemetery(s, s.cards[me].ctrl) >= 10) r.kw.Storm = true; }],
    onEvolve(x) { x.draw(1); },
    activated: [{
      text: 'Deal an enemy follower 4 damage for every 5 followers in your cemetery',
      once: true,
      can: (s, me) => enemyFollowers(s, s.cards[me].ctrl).length > 0,
      why: () => 'There is no enemy follower to select.',
      run(x) {
        const t = x.selectOne(x.followers(x.opp), 'Maisha: select an enemy follower.');
        if (t) x.damage(t, 4 * Math.floor(followersInCemetery(x.s, x.ctrl) / 5));
      },
    }],
  });

  // BP18-117EN Saito, Mao Ward Officer
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Look at the top 3 cards of your deck. You may reveal a Togh Keyoh card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  card('BP18-117EN', {
    fanfare(x) { x.lookPick({ n: 3, filter: (i) => x.hasTrait(i, 'Togh Keyoh'), prompt: 'Saito: you may reveal a Togh Keyoh card and add it to your hand.' }); },
  });
  // BP18-118EN Saito, Mao Ward Officer (evolved)
  // On Evolve - Choose 1. (1) Select an A-Class Pyromancy in your cemetery and put it into your EX area. It costs 1 less to play this turn. (2) Give your leader [defense]+1. Bury the top card of your deck. (3) Banish a card from your hand: Draw a card.
  card('BP18-118EN', {
    onEvolve(x) {
      const pyro = x.cemetery().filter((i) => x.name(i) === 'A-Class Pyromancy');
      const [m] = x.choose('Saito: choose 1.', [
        { label: 'Put an A-Class Pyromancy from your cemetery into your EX area; it costs 1 less this turn.', can: pyro.length > 0 && x.ex().length < x.P().exLimit },
        { label: 'Give your leader +1 defense. Bury the top card of your deck.' },
        { label: 'Banish a card from your hand: draw a card.', can: x.hand().length > 0 },
      ]);
      if (m === 0) {
        const t = x.selectOne(pyro, 'Saito: select an A-Class Pyromancy in your cemetery.', { aura: false });
        if (t && x.toEx(t)) x.buff(t, { cost: -1 }, x.until.eot(), 'costs 1 less to play this turn');
      } else if (m === 1) {
        x.heal(x.ctrl, 1);
        const top = x.deck()[0];
        if (top) x.bury(top);
      } else if (m === 2) {
        // CR 10.4.7.4: the banish is an optional cost, decided on resolution.
        const pick = x.select({ from: x.hand(), min: 0, max: 1, prompt: 'Saito: you may banish a card from your hand to draw a card.' });
        if (pick.length) { x.banish(pick[0]); x.draw(1); }
      }
    },
  });

  // BP18-120EN Togh Keyoh, Neometropolis
  // [fanfare] Look at the top 3 cards of your deck. You may reveal a Togh Keyoh card not named Togh Keyoh, Neometropolis from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  // [act] [cost01], [engage], banish this: Select a Togh Keyoh follower on your field. Give it [attack]+1/[defense]+1 and your leader [defense]+1.
  const NEO = 'Togh Keyoh, Neometropolis';
  card('BP18-120EN', {
    fanfare(x) { x.lookPick({ n: 3, filter: (i) => x.hasTrait(i, 'Togh Keyoh') && x.name(i) !== NEO, prompt: 'Togh Keyoh: you may reveal a Togh Keyoh card not named Togh Keyoh, Neometropolis and add it to your hand.' }); },
    activated: [{
      text: 'Banish this: give a Togh Keyoh follower +1/+1 and your leader +1 defense',
      cost: { pp: 1, engage: true },
      can: (s, me) => SV.followers(s, s.cards[me].ctrl).some((i) => SV.chars(s, i).traits.includes('Togh Keyoh')),
      why: () => 'There is no Togh Keyoh follower on your field.',
      pay(x) { x.banish(x.me); },
      run(x) {
        const t = x.selectOne(x.followers(x.ctrl).filter((i) => x.hasTrait(i, 'Togh Keyoh')), 'Select a Togh Keyoh follower on your field. Give it +1/+1.');
        if (!t) return;
        x.buff(t, { atk: 1, def: 1 });
        x.heal(x.ctrl, 1);
      },
    }],
  });

  // BP19-110EN Cutthroat, Discord Convict
  // [evolve] [cost04]: Evolve this.            (engine-read)
  // [fanfare] Look at the top 8 cards of your deck. Add one of them to your hand. Shuffle the rest and put them on the bottom of your deck.
  // ----------
  // Your main deck and evolve deck may only contain 1 copy of any card without "Cutthroat" in its name.   (deck building, SV.deckProblems)
  card('BP19-110EN', {
    fanfare(x) {
      const top = x.deck().slice(0, 8);
      if (!top.length) return;
      const pick = x.select({ from: top, min: 1, max: 1, aura: false, prompt: 'Cutthroat: add one of the top 8 cards of your deck to your hand.' });
      for (const i of pick) x.toHand(i);
      const rest = top.filter((i) => !pick.includes(i));
      SV.shuffleInPlace(x.s, rest);
      for (const i of rest) x.toDeck(i, 'bottom');
    },
  });
  // BP19-111EN Cutthroat, Discord Convict (evolved)
  // On Evolve - Select up to 2 enemy followers on the field and deal 4 damage divided between them.
  // On Super-Evolve - Select an enemy follower on the field. Deal 8 damage to it and its leader.
  card('BP19-111EN', {
    onEvolve(x) {
      const ts = x.select({ from: x.followers(x.opp), min: 0, max: 2, prompt: 'Cutthroat: select up to 2 enemy followers to divide 4 damage between.' });
      if (ts.length === 1) x.damage(ts[0], 4);
      else if (ts.length === 2) { // CR 10.6.2.4 each selected follower gets at least 1
        const n = x.number(`Cutthroat: how much of the 4 damage goes to ${x.name(ts[0])}? The rest goes to ${x.name(ts[1])}.`, 1, 3);
        x.damageMany(ts, (t) => (t === ts[0] ? n : 4 - n));
      }
    },
    onSuperEvolve(x) {
      const t = x.selectOne(x.followers(x.opp), 'Cutthroat: select an enemy follower. Deal 8 damage to it and its leader.');
      if (!t) return;
      const lead = x.leader(x.s.cards[t].ctrl);
      x.damageMany([t, lead], 8);
    },
  });

  // BP19-112EN Eudie, Maiden Reborn
  // Ward.                                      (engine-read)
  // [fanfare] Draw a card. If you have 0 Super-Evolution Points, give this [attack]+2/[defense]+2 and your leader [defense]+2.
  card('BP19-112EN', {
    fanfare(x) {
      x.draw(1);
      if (x.P().sep === 0) { x.buff(x.me, { atk: 2, def: 2 }); x.heal(x.ctrl, 2); } // Q2352
    },
  });

  // BP19-113EN Zerael, Regent of Rebirth
  // [fanfare] Reveal the top 9 cards of your deck. Shuffle them and put them on the bottom of your deck. If you revealed 9 cards with different names this way, bury this, and you may summon a Zerael, Regent of Transmigration from your evolve deck.
  card('BP19-113EN', {
    fanfare(x) {
      const top = x.deck().slice(0, 9);
      x.reveal(top);
      const distinct = top.length === 9 && new Set(top.map((i) => x.name(i))).size === 9;
      const order = top.slice();
      SV.shuffleInPlace(x.s, order);
      for (const i of order) x.toDeck(i, 'bottom');
      if (!distinct) return;
      if (x.onField(x.me)) x.bury(x.me);
      const pick = x.select({ from: inEvoDeck(x, 'Zerael, Regent of Transmigration'), min: 0, max: 1, aura: false, prompt: 'You may summon a Zerael, Regent of Transmigration from your evolve deck.' });
      if (pick.length) x.summon(pick[0]);
    },
  });
  // BP19-114EN Zerael, Regent of Transmigration (advanced)
  // Ward. Aura.                                (engine-read)
  // [fanfare] Destroy each enemy follower on the field.
  card('BP19-114EN', { fanfare(x) { x.destroyAll(x.followers(x.opp)); } });

  // BP19-115EN Ironforged Right Hand
  // [fanfare] Draw a card. If there's a follower on your field or in your cemetery with "Cutthroat" in its name, recover 2 play points.
  card('BP19-115EN', { fanfare(x) { x.draw(1); if (cutthroat(x)) x.recoverPP(2); } });

  // BP19-116EN Azvaldt
  // [fanfare] Look at the top 4 cards of your deck. You may reveal a Condemned follower from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  // [act] [engage], bury this: If this is your 8th turn or later, draw a card.
  card('BP19-116EN', {
    fanfare(x) { x.lookPick({ n: 4, filter: (i) => isFollowerCard(x.s, i) && x.hasTrait(i, 'Condemned'), prompt: 'Azvaldt: you may reveal a Condemned follower and add it to your hand.' }); },
    activated: [{
      text: 'Engage and bury this: draw a card if this is your 8th turn or later',
      cost: { engage: true }, // Q2393: usable before turn 8 too
      pay(x) { x.bury(x.me); },
      run(x) { if (x.P().turnsPassed >= 8) x.draw(1); },
    }],
  });

  // BP19-117EN Smeltwork Bodyguard
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // Ward.                                      (engine-read)
  // [fanfare] Draw a card.
  card('BP19-117EN', { fanfare(x) { x.draw(1); } });
  // BP19-118EN Smeltwork Bodyguard (evolved)
  // Ward.
  // On Evolve - Select an enemy follower on the field. If there's a follower on your field or in your cemetery with "Cutthroat" in its name, deal the selected follower 4 damage and give your leader [defense]+4.
  card('BP19-118EN', {
    onEvolve(x) {
      const t = x.selectOne(x.followers(x.opp), 'Smeltwork Bodyguard: select an enemy follower.');
      if (!t) return; // as Q1327 (same wording): nothing happens without a selected follower
      if (cutthroat(x)) { x.damage(t, 4); x.heal(x.ctrl, 4); }
    },
  });

  // BP19-119EN Warden of Recurrence
  // Ward.                                      (engine-read)
  // [fanfare] Choose 1. (1) Search your deck for a Zerael, Regent of Rebirth, summon it, then shuffle. (2) Recover 8 play points.
  card('BP19-119EN', {
    fanfare(x) {
      const [m] = x.choose('Warden of Recurrence: choose 1.', [
        { label: 'Search your deck for a Zerael, Regent of Rebirth and summon it.' },
        { label: 'Recover 8 play points.' },
      ]);
      if (m === 0) {
        const [z] = x.search({ filter: (i) => x.name(i) === 'Zerael, Regent of Rebirth', prompt: 'Search your deck for a Zerael, Regent of Rebirth.' });
        if (z) x.summon(z);
        x.afterSearch();
      } else if (m === 1) x.recoverPP(8);
    },
  });

  // BP19-120EN Blackrust Underling
  // Storm.                                     (engine-read)
  // Strike - Select an enemy follower on the field and, if there's a follower on your field or in your cemetery with "Cutthroat" in its name, deal the selected follower 4 damage.
  card('BP19-120EN', {
    strike(x) {
      const t = x.selectOne(x.followers(x.opp), 'Blackrust Underling: select an enemy follower.');
      if (t && cutthroat(x)) x.damage(t, 4);
    },
  });

  // BP20-111EN Mjerrabaine, Great Manifest
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Discard your hand.
  card('BP20-111EN', { fanfare(x) { for (const h of x.hand()) x.discard(h); } });
  // BP20-112EN Mjerrabaine, Great Manifest (evolved)
  // On Evolve - Put a Crest: Mjerrabaine, Great Manifest token into your EX area.
  // On Super-Evolve - Select an enemy follower on the field. Destroy it and deal 2 damage to its leader.
  // At the start of your end phase, select an enemy follower on the field and, if there's 1 card or less in your hand, destroy it.
  card('BP20-112EN', {
    onEvolve(x) { x.tokenToEx('Crest: Mjerrabaine, Great Manifest'); }, // Q2404/Q2405: also on super-evolve, player orders
    onSuperEvolve(x) {
      const t = x.selectOne(x.followers(x.opp), 'Mjerrabaine: select an enemy follower. Destroy it and deal 2 damage to its leader.');
      if (!t) return;
      const lead = x.leader(x.s.cards[t].ctrl);
      x.destroy(t);
      x.damage(lead, 2);
    },
    endStart(x) {
      const t = x.selectOne(x.followers(x.opp), 'Mjerrabaine: select an enemy follower (destroyed if you have 1 card or less in hand).');
      if (t && x.hand().length <= 1) x.destroy(t);
    },
  });

  // BP20-113EN Gilnelise, Voracity Manifest
  // Drain.                                     (engine-read)
  // [fanfare] Select another follower on the field. Give it [attack]+3/[defense]-3 and, if you have 0 Super-Evolution Points, put a Ravenous Sweetness token into your EX area.
  // Whenever you play a Ravenous Sweetness, select an enemy follower on the field and deal it 5 damage.
  card('BP20-113EN', {
    fanfare(x) {
      const t = x.selectOne(SV.field(x.s).filter((i) => i !== x.me && x.isFollower(i)), 'Gilnelise: select another follower. Give it +3/-3.');
      if (!t) return; // as Q1327: the rest of the sentence needs the selected follower
      x.buff(t, { atk: 3, def: -3 });
      if (x.P().sep === 0) x.tokenToEx('Ravenous Sweetness'); // Q2441
    },
    triggers: [{
      name: 'Ravenous Sweetness played', on: 'played',
      when: (s, me, ev) => ev.p === s.cards[me].ctrl && base(s, ev.iid).name === 'Ravenous Sweetness',
      run(x) { const t = x.selectOne(x.followers(x.opp), 'Gilnelise: select an enemy follower. Deal it 5 damage.'); if (t) x.damage(t, 5); },
    }],
  });

  // BP20-T11EN Crest: Mjerrabaine, Great Manifest (crest token: valid in the EX area, CR 10.3.6)
  // At the start of your end phase, if there's 1 card or less in your hand, draw a card.
  card('BP20-T11EN', { endStart(x) { if (x.hand().length <= 1) x.draw(1); }, endStartZone: 'ex' });

  // BP20-T18EN Ravenous Sweetness (token spell)
  // Deal 2 damage to each enemy leader. Give your leader [defense]+2. Draw 2 cards. Each opponent discards 2 random cards.
  card('BP20-T18EN', {
    spell(x) {
      x.damage(x.leader(x.opp), 2);
      x.heal(x.ctrl, 2);
      x.draw(2);
      const hand = x.hand(x.opp);
      const pick = [];
      while (pick.length < 2 && hand.length) pick.push(hand.splice(SV.rngInt(x.s, hand.length), 1)[0]); // random, seeded (replays identically)
      for (const h of pick) x.discard(h);
    },
  });

  // SP01-045EN Alice, Golden Afternoon
  // [fanfare] Draw a card.
  // [fanfare] Select an enemy follower that costs 4 or less on the field. If this card wasn't put onto the field from hand, put the selected follower into its owner's EX area.
  card('SP01-045EN', {
    fanfare: [ // Q1581: the player orders the two Fanfares
      (x) => { x.draw(1); },
      (x, ev) => {
        const t = x.selectOne(x.followers(x.opp).filter((i) => costOf(x.s, i) <= 4), 'Alice: select an enemy follower that costs 4 or less.');
        if (t && ev.from !== 'hand') x.toEx(t); // Q1582: a full EX area leaves it on the field
      },
    ],
  });
})();
