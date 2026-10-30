// havencraft card scripts (docs/ABILITIES.md). One SV.card per card number; printed text in the
// comment above each, verbatim from data/cards.js.
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;


  // ------------------------------------------------------------------ helpers (plain reads)
  const base = (s, i) => SV.CARDS[s.cards[i].id];
  const baseCost = (s, i) => base(s, i).cost || 0; // an evolved follower keeps its own cost (CR 5.16.1.2)
  const isCrest = (s, i) => SV.parsed(SV.CARDS[s.cards[i].id]).type === 'crest';
  const crests = (s, p) => s.players[p].ex.filter((i) => isCrest(s, i)).length;
  const traitsOf = (s, i) => (s.cards[i].zone === 'field' ? SV.chars(s, i).traits : SV.def(i, s).traits);
  const hasTraits = (s, i, ...ts) => { const tr = traitsOf(s, i); return ts.every((t) => tr.includes(t)); };
  // Enemy followers that the controller of `me` can select (Aura, CR 12.15).
  const selectableEnemies = (s, p) => SV.followers(s, 1 - p).filter((i) => !SV.chars(s, i).kw.Aura);
  const enemyFollower = (x, prompt) => x.selectOne(x.followers(x.opp), prompt);
  const onMyField = (s, p, name) => SV.field(s, p).some((i) => SV.nameHas(s, i, name));
  // "if your leader has gained [defense] this turn": the engine logs every increase (heal door).
  const gainedThisTurn = (s, p) => s.log.some((e) => e.type === 'heal' && e.turn === s.turn && e.p === p);
  // Final information of a card that left the field (CR 10.11), from its leave log entry.
  const lastInfo = (s, iid) => { for (let k = s.log.length - 1; k >= 0; k--) if (s.log[k].iid === iid && s.log[k].info) return s.log[k].info; return null; };
  const playBlocked = (s, iid, p) => SV.auraSources(s).some((src) => { const a = SV.abil(SV.faceId(s, src)); return a.blockPlay && a.blockPlay(s, src, iid, p); });
  // Put the rest of a looked-at group on the bottom of the deck in the order the player chooses.
  function restToBottom(x, rest) {
    const ordered = x.order(rest, 'Put the rest on the bottom of your deck: choose their order (first = topmost of them).');
    for (const i of ordered) SV.move(x.s, i, 'deck', { pos: 'bottom' });
  }
  const opponentsMainStart = (s, me, ev) => ev.p !== H.ctrl(s, me);
  const myLeaderHealed = (s, me, ev) => ev.p === H.ctrl(s, me);

  // "The next Togh Keyoh card you play this turn costs 2 less" (Unshakable Prayer): a cost effect
  // that stops applying once a card with the trait has been played after it was created. A pure
  // read of the play log (a named filter keeps s.effects plain data).
  SV.COST_FILTERS['havencraft:nextTrait'] = (s, iid, e) => {
    if (!base(s, iid).traits.includes(e.trait)) return false;
    for (let k = s.log.length - 1; k >= 0 && s.log[k].n >= e.since; k--) {
      const l = s.log[k];
      if (l.type === 'play' && l.who === e.p && base(s, l.iid).traits.includes(e.trait)) return false;
    }
    return true;
  };

  // BP01-127EN Jeanne d'Arc
  // [evolve][cost02]: Evolve this follower.            (engine-read)
  // [fanfare] Deal 2 damage to each enemy follower on the field.
  card('BP01-127EN', {
    fanfare(x) { x.damageMany(x.followers(x.opp), 2); },
  });

  // BP01-128EN Jeanne d'Arc (evolved)
  // On Evolve: Deal 2 damage to each enemy follower on the field. Give each other follower on your field [defense]+2.
  card('BP01-128EN', {
    onEvolve(x) {
      x.damageMany(x.followers(x.opp), 2);
      for (const f of x.followers(x.ctrl)) if (f !== x.me) x.buff(f, { def: 2 });
    },
  });

  // BP02-092EN Elana's Prayer
  // Once per turn, when your leader gains [defense], give each follower on your field [attack]+1/[defense]+1.
  card('BP02-092EN', {
    triggers: [{
      name: "Elana's Prayer", on: 'healed', limit: 1, // Q326: each copy once per turn; Q335: on either player's turn
      when: myLeaderHealed,
      run(x) { for (const f of x.followers(x.ctrl)) x.buff(f, { atk: 1, def: 1 }); },
    }],
  });

  // BP09-106EN Jeanne, Beacon of Salvation
  // [evolve] [cost01]: Evolve this follower.            (engine-read)
  // [fanfare] Draw a card. If there are at least 2 followers with "Jeanne" in their name in your cemetery, give this follower [attack]+1/[defense]+1 and Storm.
  card('BP09-106EN', {
    fanfare(x) {
      x.draw(1);
      const n = x.cemetery().filter((i) => x.isFollower(i) && x.named(i, 'Jeanne')).length;
      if (n >= 2) x.buff(x.me, { atk: 1, def: 1, kw: { Storm: true } });
    },
  });

  // BP09-107EN Jeanne, Beacon of Salvation (evolved)
  // On Evolve - You may summon a [havencraft] follower that costs 2 or less from your hand.
  // Strike - Select a [havencraft] follower that costs 2 or less on your field and give it [attack]+1.
  const haven2 = (s, i) => base(s, i).cls === 'havencraft' && SV.isFollower(s, i) && baseCost(s, i) <= 2;
  card('BP09-107EN', {
    onEvolve(x) {
      const pick = x.select({ from: x.hand().filter((i) => haven2(x.s, i)), min: 0, max: 1, prompt: 'Jeanne: you may summon a havencraft follower that costs 2 or less from your hand.' });
      if (pick.length) x.summon(pick[0]);
    },
    strike(x) {
      const t = x.selectOne(x.followers(x.ctrl).filter((i) => haven2(x.s, i)), 'Jeanne: select a havencraft follower that costs 2 or less on your field. Give it +1 attack.');
      if (t) x.buff(t, { atk: 1 });
    },
  });

  // BP09-115EN Whitefang Temple
  // At the start of your end phase, place a prayer counter on this card and give your leader [defense]+1.
  // At the start of your main phase, if this card has at least 3 prayer counters, bury it, then search your deck for a Faith follower that costs 4 or less, summon it, and shuffle your deck.
  card('BP09-115EN', {
    endStart(x) {
      if (x.onField(x.me)) x.counter(x.me, 'prayer', 1);
      x.heal(x.ctrl, 1);
    },
    mainStart(x) {
      if (!x.onField(x.me) || x.counters(x.me, 'prayer') < 3) return; // checked on resolution (CR 10.7)
      x.bury(x.me);
      const [f] = x.search({ filter: (i) => x.isFollower(i) && x.hasTrait(i, 'Faith') && baseCost(x.s, i) <= 4, prompt: 'Whitefang Temple: search your deck for a Faith follower that costs 4 or less to summon.' });
      if (f) x.summon(f);
      x.afterSearch();
    },
  });

  // BP10-107EN Stalwart Featherfolk
  // Ward.                                             (engine-read)
  // [fanfare] [cost02]: Give this follower [attack]+1/[defense]+1 and Storm.
  card('BP10-107EN', {
    fanfare(x) {
      if (x.mayPay({ pp: 2 }, 'Stalwart Featherfolk: pay 2 play points to give it +1/+1 and Storm?')) x.buff(x.me, { atk: 1, def: 1, kw: { Storm: true } });
    },
  });

  // BP11-086EN Selena, Sugarkiss Assassin
  // Storm.                                            (engine-read)
  // [fanfare] Look at the top 4 cards of your deck. From among them, you may put up to 1 Wasteland card and up to 1 follower that costs 2 or less into your EX area. Put the rest on the bottom of your deck in any order.
  // Strike - Recover 2 play points.
  card('BP11-086EN', {
    fanfare(x) {
      const top = x.deck().slice(0, 4);
      if (!top.length) return;
      // Q1542: each part is "up to 1", picked independently.
      const w = x.select({ from: top.filter((i) => x.hasTrait(i, 'Wasteland')), seen: top, min: 0, max: 1, prompt: 'Selena: you may put a Wasteland card into your EX area.', aura: false });
      const f = x.select({ from: top.filter((i) => !w.includes(i) && x.isFollower(i) && baseCost(x.s, i) <= 2), seen: top, min: 0, max: 1, prompt: 'Selena: you may put a follower that costs 2 or less into your EX area.', aura: false });
      for (const i of [...w, ...f]) x.toEx(i);
      restToBottom(x, top.filter((i) => x.s.cards[i].zone === 'deck'));
    },
    strike(x) { x.recoverPP(2); },
  });

  // BP11-096EN Haven Fire
  // This card costs 1 less to play if there's a Selena, Sugarkiss Assassin on your field.
  // ----------
  // Select an enemy follower on the field and deal it 4 damage. If there's a Wasteland card in your EX area, deal 1 damage to its leader.
  card('BP11-096EN', {
    selfCost: (s, iid, p) => (onMyField(s, p, 'Selena, Sugarkiss Assassin') ? -1 : 0),
    canPlay: (s, iid) => selectableEnemies(s, s.cards[iid].owner).length > 0, // CR 10.6.2.3.3
    spell(x) {
      const t = enemyFollower(x, 'Haven Fire: select an enemy follower. Deal it 4 damage.');
      if (!t) return;
      const p = x.s.cards[t].ctrl;
      x.damage(t, 4);
      if (x.ex().some((i) => x.hasTrait(i, 'Wasteland'))) x.damage(x.leader(p), 1);
    },
  });

  // BP11-099EN Revolver Eagle
  // Storm.                                            (engine-read)
  // [fanfare] Put a Bullet Bike token into your EX area.
  // [act] [cost06]: Give this follower [attack]+4/[defense]+4.
  card('BP11-099EN', {
    fanfare(x) { x.tokenToEx('Bullet Bike'); },
    activated: [{
      text: 'Give this follower +4/+4',
      cost: { pp: 6 },
      run(x) { x.buff(x.me, { atk: 4, def: 4 }); },
    }],
  });

  // BP12-086EN Rola, Inferno Dragoon
  // [evolve] [cost02]: Evolve this follower.            (engine-read)
  // [fanfare] Put a Repair Mode token into your EX area. If this card was put onto the field by an ability, evolve it.
  card('BP12-086EN', {
    fanfare(x, ev) {
      x.tokenToEx('Repair Mode');
      if (!ev.played) x.evolve(x.me); // Q1650 also on the opponent's turn; Q1649 not the evolve ability
    },
  });

  // BP12-087EN Rola, Inferno Dragoon (evolved)
  // On Evolve - Choose one. (1) Select an enemy follower on the field and deal it damage equal to the number of Machina followers on your field. (2) Give this follower Storm.
  card('BP12-087EN', {
    onEvolve(x) {
      const [k] = x.choose('Rola: choose one.', [
        { label: 'Deal an enemy follower damage equal to the number of Machina followers on your field.', can: selectableEnemies(x.s, x.ctrl).length > 0 }, // Q1651
        { label: 'Give this follower Storm.' },
      ]);
      if (k === 0) {
        const t = enemyFollower(x, 'Rola: select an enemy follower.');
        if (t) x.damage(t, x.followers(x.ctrl).filter((i) => x.hasTrait(i, 'Machina')).length);
      } else if (k === 1) x.give(x.me, 'Storm');
    },
  });

  // BP13-088EN Jeanne, Despair's Maiden
  // [evolve] [cost05]: Evolve this follower.            (engine-read)
  // [fanfare] Give your leader [defense]-2: Select an enemy follower that costs 2 or less on the field and destroy it.
  card('BP13-088EN', {
    fanfare(x) {
      // CR 10.4.7.5 optional cost, decided on resolution; 10.4.5.1 it can't take defense below 0.
      if (x.P().defense < 2 || !x.may("Jeanne, Despair's Maiden: give your leader -2 defense to destroy an enemy follower that costs 2 or less?", 'Pay 2 defense', "Don't")) return;
      x.loseDefense(x.ctrl, 2);
      const t = x.selectOne(x.followers(x.opp).filter((i) => baseCost(x.s, i) <= 2), "Jeanne, Despair's Maiden: select an enemy follower that costs 2 or less to destroy.");
      if (t) x.destroy(t);
    },
  });

  // BP13-089EN Jeanne, Despair's Maiden (evolved)
  // On Evolve - Deal 3 damage to each enemy leader and enemy follower on the field. Give your leader [defense]+3.
  card('BP13-089EN', {
    onEvolve(x) {
      x.damageMany([x.leader(x.opp), ...x.followers(x.opp)], 3);
      x.heal(x.ctrl, 3);
    },
  });

  // BP13-092EN Lunerian Paladin (evolved)
  // Ward.                                             (engine-read)
  // On Evolve - Look at the top 4 cards of your deck. You may summon a follower that costs 2 or less from among them. Put the rest on the bottom of your deck in any order. If you summoned a follower with Ward, give your leader [defense]+2.
  card('BP13-092EN', {
    onEvolve(x) {
      const [f] = x.lookPick({ n: 4, filter: (i) => x.isFollower(i) && baseCost(x.s, i) <= 2, to: 'field', prompt: 'Lunerian Paladin: you may summon a follower that costs 2 or less.' });
      if (f && x.onField(f) && x.chars(f).kw.Ward) x.heal(x.ctrl, 2);
    },
  });

  // BP15-094EN Marwynn, Repose of Despair
  // [evolve] [cost03]: Evolve this.                    (engine-read)
  // Ward.                                             (engine-read)
  // [fanfare] If there are at least 3 followers on an opponent's field, put a Torrent of Despair token into your EX area.
  // At the start of each opponent's main phase, give your leader [defense]+2.
  const marwynnHeal = { name: 'Give your leader +2 defense', on: 'mainStart', when: opponentsMainStart, run(x) { x.heal(x.ctrl, 2); } }; // Q1941, Q1942
  card('BP15-094EN', {
    fanfare(x) {
      if (x.followers(x.opp).length >= 3) x.tokenToEx('Torrent of Despair'); // checked on resolution
    },
    triggers: [marwynnHeal],
  });

  // BP15-PR16EN Torrent of Despair (token)
  // Select an enemy follower on the field and banish it.
  card('BP15-PR16EN', {
    canPlay: (s, iid) => selectableEnemies(s, s.cards[iid].owner).length > 0, // CR 10.6.2.3.3
    spell(x) {
      const t = enemyFollower(x, 'Torrent of Despair: select an enemy follower to banish.');
      if (t) x.banish(t);
    },
  });

  // BP15-095EN Marwynn, Repose of Despair (evolved)
  // Ward.                                             (engine-read)
  // On Evolve - Destroy each other follower on the field.
  // At the start of each opponent's main phase, give your leader [defense]+2.
  card('BP15-095EN', {
    onEvolve(x) { x.destroyAll(x.followers().filter((i) => i !== x.me)); }, // Q1943 your own too
    triggers: [marwynnHeal],
  });

  // BP15-097EN Sarissa, Luxflash Spear
  // Ward.                                             (engine-read)
  // While there are at least 3 cards on your field, this has Storm.
  // [fanfare] Select an enemy follower on the field and give it [attack]-1/[defense]-1.
  card('BP15-097EN', {
    auras: [(s, me, t, r) => { if (t === me && s.cards[me].zone === 'field' && s.players[s.cards[me].ctrl].field.length >= 3) r.kw.Storm = true; }],
    fanfare(x) {
      const t = enemyFollower(x, 'Sarissa: select an enemy follower. Give it -1/-1.');
      if (t) x.buff(t, { atk: -1, def: -1 });
    },
  });

  // BP15-101EN Perpetual Despair
  // Whenever a follower with "Marwynn" in its name is put onto your field, you may put this from your cemetery into your EX area. If you do, give your leader [defense]+1.
  // ----------
  // [act] [engage], bury this: Draw a card.
  card('BP15-101EN', {
    triggers: [{
      name: 'Perpetual Despair', on: 'enter', zone: 'cemetery', // Q1946: only while in the cemetery
      when: (s, me, ev) => ev.p === s.cards[me].owner && SV.isFollower(s, ev.iid) && SV.nameHas(s, ev.iid, 'Marwynn'),
      run(x) {
        if (x.s.cards[x.me].zone !== 'cemetery') return;
        if (!x.may('Perpetual Despair: put it from your cemetery into your EX area and give your leader +1 defense?')) return;
        if (x.toEx(x.me)) x.heal(x.ctrl, 1);
      },
    }],
    activated: [{
      text: 'Bury this: draw a card',
      cost: { engage: true },
      pay(x) { x.bury(x.me); },
      run(x) { x.draw(1); },
    }],
  });

  // BP15-108EN Hermit of Repose
  // [fanfare] [cost02]: Give this [attack]+2.
  // At the start of each opponent's main phase, deal each enemy follower on the field damage equal to this follower's attack.
  card('BP15-108EN', {
    fanfare(x) {
      if (x.mayPay({ pp: 2 }, 'Hermit of Repose: pay 2 play points to give it +2 attack?')) x.buff(x.me, { atk: 2 });
    },
    triggers: [{
      name: 'Damage each enemy follower', on: 'mainStart', when: opponentsMainStart, // Q1941
      run(x) {
        const info = x.onField(x.me) ? null : lastInfo(x.s, x.me); // left the field: its final information (CR 10.11)
        const atk = info ? info.atk : x.chars(x.me).atk;
        if (atk > 0) x.damageMany(x.followers(x.opp), atk);
      },
    }],
  });

  // BP18-097EN Seishiro, Admonishing Faith
  // [evolve] [cost01]: Evolve this.                    (engine-read)
  // Whenever your leader gains [defense], select an enemy follower on the field and deal it 2 damage.
  const seishiroPing = {
    name: 'Deal 2 damage', on: 'healed', when: myLeaderHealed, // Q2182 on either player's turn
    run(x) { const t = enemyFollower(x, 'Your leader gained defense: select an enemy follower. Deal it 2 damage.'); if (t) x.damage(t, 2); },
  };
  card('BP18-097EN', { triggers: [seishiroPing] });

  // BP18-098EN Seishiro, Admonishing Faith (evolved)
  // On Evolve - You may summon a Togh Keyoh follower that costs 3 or less or [havencraft] amulet that costs 3 or less from your hand.
  // On Super-Evolve - Put a Righteous Conviction token into your EX area.
  // Whenever your leader gains [defense], select an enemy follower on the field and deal it 2 damage.
  card('BP18-098EN', {
    onEvolve(x) {
      const ok = (i) => baseCost(x.s, i) <= 3 && ((x.isFollower(i) && x.hasTrait(i, 'Togh Keyoh')) || (x.isAmulet(i) && base(x.s, i).cls === 'havencraft'));
      const pick = x.select({ from: x.hand().filter(ok), min: 0, max: 1, prompt: 'Seishiro: you may summon a Togh Keyoh follower or havencraft amulet that costs 3 or less from your hand.' });
      if (pick.length) x.summon(pick[0]);
    },
    onSuperEvolve(x) { x.tokenToEx('Righteous Conviction'); }, // Q2151 the player orders it with On Evolve
    triggers: [seishiroPing],
  });

  // BP18-099EN Tenmei, Insatiable Adjudicator
  // Whenever your leader gains [defense], select an enemy follower on the field and deal it 2 damage.
  // [act] [cost00]: Deal damage to each enemy leader equal to the number of Togh Keyoh followers on your field. Give your leader [defense]+1. Activate only once per turn.
  const toghCount = (x) => x.followers(x.ctrl).filter((i) => x.hasTrait(i, 'Togh Keyoh')).length;
  card('BP18-099EN', {
    triggers: [seishiroPing],
    activated: [{
      text: 'Deal damage to the enemy leader equal to your Togh Keyoh followers; +1 defense',
      cost: { pp: 0 }, once: true,
      run(x) { x.damage(x.leader(x.opp), toghCount(x)); x.heal(x.ctrl, 1); },
    }],
  });

  // BP18-100EN Elana, Purest Prayer
  // Ward.                                             (engine-read)
  // [fanfare] Search your deck for an Elana's Prayer, reveal it, add it to your hand, then shuffle.
  // At the start of each opponent's main phase, if there's an Elana's Prayer on your field, give your leader [defense]+2.
  card('BP18-100EN', {
    fanfare(x) {
      const [c] = x.search({ filter: (i) => x.named(i, "Elana's Prayer"), prompt: "Elana: search your deck for an Elana's Prayer." });
      if (c) x.toHand(c);
      x.afterSearch();
    },
    triggers: [{
      name: 'Give your leader +2 defense', on: 'mainStart', when: opponentsMainStart,
      run(x) { if (onMyField(x.s, x.ctrl, "Elana's Prayer")) x.heal(x.ctrl, 2); }, // checked on resolution
    }],
  });

  // BP18-104EN Unshakable Prayer
  // [fanfare] Look at the top 4 cards of your deck. From among them, you may reveal up to 1 Togh Keyoh card not named Unshakable Prayer and up to 1 Seishiro, Admonishing Faith and add them to your hand. Put the rest on the bottom of your deck in any order. The next Togh Keyoh card you play this turn costs 2 less.
  // [act] [cost01], [engage], bury this: Give your leader [defense]+1.
  card('BP18-104EN', {
    fanfare(x) {
      const top = x.deck().slice(0, 4);
      if (top.length) {
        const a = x.select({ from: top.filter((i) => x.hasTrait(i, 'Togh Keyoh') && x.name(i) !== 'Unshakable Prayer'), seen: top, min: 0, max: 1, prompt: 'Unshakable Prayer: you may add a Togh Keyoh card not named Unshakable Prayer to your hand.', aura: false });
        const b = x.select({ from: top.filter((i) => !a.includes(i) && x.named(i, 'Seishiro, Admonishing Faith')), seen: top, min: 0, max: 1, prompt: 'Unshakable Prayer: you may add a Seishiro, Admonishing Faith to your hand.', aura: false });
        const pick = [...a, ...b];
        if (pick.length) { x.reveal(pick); for (const i of pick) x.toHand(i); }
        restToBottom(x, top.filter((i) => !pick.includes(i)));
      }
      x.effect({ costMod: -2, filter: 'havencraft:nextTrait', trait: 'Togh Keyoh', since: x.s.logN, ...x.until.eot() });
    },
    activated: [{
      text: 'Bury this: give your leader +1 defense',
      cost: { pp: 1, engage: true },
      pay(x) { x.bury(x.me); },
      run(x) { x.heal(x.ctrl, 1); },
    }],
  });

  // BP18-105EN Deliverer of Punishment
  // [evolve] [cost02]: Evolve this.                    (engine-read)
  // [fanfare] Give your leader [defense]+1. If there's a Seishiro, Admonishing Faith on your field, evolve this.
  card('BP18-105EN', {
    fanfare(x) {
      x.heal(x.ctrl, 1);
      if (onMyField(x.s, x.ctrl, 'Seishiro, Admonishing Faith')) x.evolve(x.me); // Q2157 not the evolve ability
    },
  });

  // BP18-106EN Deliverer of Punishment (evolved)
  // On Evolve - Give your leader [defense]+1.
  card('BP18-106EN', {
    onEvolve(x) { x.heal(x.ctrl, 1); },
  });

  // BP18-110EN Votary of Contemplation
  // [evolve] [cost01]: Evolve this.                    (engine-read)
  // [fanfare] If there's a Seishiro, Admonishing Faith on your field, give your leader [defense]+1 and draw a card.
  card('BP18-110EN', {
    fanfare(x) {
      if (onMyField(x.s, x.ctrl, 'Seishiro, Admonishing Faith')) { x.heal(x.ctrl, 1); x.draw(1); }
    },
  });

  // BP18-P47EN Votary of Contemplation (evolved)
  // On Evolve - Select an enemy follower on the field. Deal it 2 damage and, if your leader has gained [defense] this turn, deal 2 damage to its leader.
  card('BP18-P47EN', {
    onEvolve(x) {
      const t = enemyFollower(x, 'Votary: select an enemy follower. Deal it 2 damage.');
      if (!t) return;
      const p = x.s.cards[t].ctrl;
      x.damage(t, 2);
      if (gainedThisTurn(x.s, x.ctrl)) x.damage(x.leader(p), 2);
    },
  });

  // BP18-T08EN Righteous Conviction (token)
  // Deal damage to each enemy leader equal to the number of Togh Keyoh followers on your field. Give your leader [defense]+1.
  card('BP18-T08EN', {
    spell(x) { x.damage(x.leader(x.opp), toghCount(x)); x.heal(x.ctrl, 1); },
  });

  // BP19-092EN Erralde, Troth Convict
  // Abilities you control that trigger at the start of the end phase trigger an additional time.
  // At the start of your end phase, choose 1. If there's another Condemned follower on your field, choose up to 2 instead. (1) Select an enemy follower on the field and deal it 4 damage. (2) Give your leader [defense]+1. Refresh this. (3) Draw a card.
  card('BP19-092EN', {
    // Q2386 either player's end phase; Q2385 two copies: 3 times. Crests in the EX area count (you control them).
    extraTriggers: (s, me, iid, t, ev) => (ev.type === 'endStart' && s.cards[me].zone === 'field' && H.ctrl(s, iid) === s.cards[me].ctrl && !SV.chars(s, me).flags.loseAbilities ? 1 : 0),
    endStart(x) {
      const two = x.followers(x.ctrl).some((i) => i !== x.me && x.hasTrait(i, 'Condemned'));
      const pick = x.choose(two ? 'Erralde: choose up to 2.' : 'Erralde: choose 1.', [
        { label: 'Deal 4 damage to an enemy follower.', can: selectableEnemies(x.s, x.ctrl).length > 0 },
        { label: 'Give your leader +1 defense. Refresh this.' }, // Q2387 choosable when not engaged
        { label: 'Draw a card.' },
      ], 1, two ? 2 : 1); // Q2365 each option at most once
      if (pick.includes(0)) { const t = enemyFollower(x, 'Erralde: select an enemy follower. Deal it 4 damage.'); if (t) x.damage(t, 4); }
      if (pick.includes(1)) { x.heal(x.ctrl, 1); if (x.onField(x.me)) x.refresh(x.me); }
      if (pick.includes(2)) x.draw(1);
    },
  });

  // "When playing this, [engage] an Erralde, Troth Convict on your field: This costs 0 to play."
  // CR 10.4.7.3: an option taken when playing the card. Offered as its own action on the card in
  // your hand or EX area: engage a reserved Erralde (the cost), then play this without paying play
  // points. The ordinary play stays available.
  const reservedErraldes = (s, p) => s.players[p].field.filter((i) => !s.cards[i].engaged && SV.nameHas(s, i, 'Erralde, Troth Convict'));
  const erraldePlay = (zone) => ({
    text: 'Engage an Erralde, Troth Convict on your field: play this for 0',
    zone,
    can: (s, me) => {
      const p = s.cards[me].owner, P = s.players[p];
      return reservedErraldes(s, p).length > 0 && P.field.length < P.fieldLimit && !playBlocked(s, me, p);
    },
    why: (s, me) => (reservedErraldes(s, s.cards[me].owner).length ? "This can't be played right now." : 'You need a reserved Erralde, Troth Convict on your field.'),
    pay(x) {
      const e = x.selectOne(reservedErraldes(x.s, x.ctrl), 'Choose an Erralde, Troth Convict on your field to engage.');
      x.engage(e);
    },
    run(x) { x.playFree(x.me); },
  });

  // BP19-098EN Executor of the Oath
  // When playing this, [engage] an Erralde, Troth Convict on your field: This costs 0 to play.
  // ----------
  // [fanfare] Search your deck for an Agent of the Commandments or Follower of the Precepts, summon it, then shuffle.
  // At the start of your end phase, select an enemy follower on the field and deal it 2 damage.
  card('BP19-098EN', {
    activated: [erraldePlay('hand'), erraldePlay('ex')],
    fanfare(x) {
      const [f] = x.search({ filter: (i) => ['Agent of the Commandments', 'Follower of the Precepts'].some((n) => x.named(i, n)), prompt: 'Executor of the Oath: search your deck for an Agent of the Commandments or Follower of the Precepts to summon.' });
      if (f) x.summon(f);
      x.afterSearch();
    },
    endStart(x) { const t = enemyFollower(x, 'Executor of the Oath: select an enemy follower. Deal it 2 damage.'); if (t) x.damage(t, 2); },
  });

  // BP19-100EN Agent of the Commandments
  // When playing this, [engage] an Erralde, Troth Convict on your field: This costs 0 to play.
  // ----------
  // [evolve] [cost01]: Evolve this.                    (engine-read)
  // At the start of your end phase, give your leader [defense]+1.
  card('BP19-100EN', {
    activated: [erraldePlay('hand'), erraldePlay('ex')],
    endStart(x) { x.heal(x.ctrl, 1); },
  });

  // BP19-101EN Agent of the Commandments (evolved)
  // On Evolve - Search your deck for an Erralde, Troth Convict, reveal it, add it to your hand, then shuffle.
  // At the start of your end phase, give your leader [defense]+1.
  card('BP19-101EN', {
    onEvolve(x) {
      const [e] = x.search({ filter: (i) => x.named(i, 'Erralde, Troth Convict'), prompt: 'Agent of the Commandments: search your deck for an Erralde, Troth Convict.' });
      if (e) x.toHand(e);
      x.afterSearch();
    },
    endStart(x) { x.heal(x.ctrl, 1); },
  });

  // BP19-102EN Follower of the Precepts
  // When playing this, [engage] an Erralde, Troth Convict on your field: This costs 0 to play.
  // ----------
  // At the start of your end phase, select an enemy follower on the field and deal it 1 damage.
  card('BP19-102EN', {
    activated: [erraldePlay('hand'), erraldePlay('ex')],
    endStart(x) { const t = enemyFollower(x, 'Follower of the Precepts: select an enemy follower. Deal it 1 damage.'); if (t) x.damage(t, 1); },
  });

  // BP20-093EN Marwynn, Despair Manifest
  // [fanfare] Choose 1. (1) Select an enemy follower on the field. If there are at least 3 crests in your EX area, banish it and give your leader [defense]+2. (2) Put a Crest: Marwynn, Despair Manifest token into your EX area.
  const canCrest = (s, p, name) => s.players[p].ex.length < s.players[p].exLimit && !s.players[p].ex.some((i) => s.cards[i].id === SV.TOKENS[name]); // CR 9.1.5.1 unique by name
  card('BP20-093EN', {
    fanfare(x) {
      const [k] = x.choose('Marwynn: choose 1.', [
        { label: 'Select an enemy follower. With 3+ crests in your EX area, banish it and give your leader +2 defense.', can: selectableEnemies(x.s, x.ctrl).length > 0 },
        { label: 'Put a Crest: Marwynn, Despair Manifest token into your EX area.', can: canCrest(x.s, x.ctrl, 'Crest: Marwynn, Despair Manifest') },
      ]);
      if (k === 0) {
        const t = enemyFollower(x, 'Marwynn: select an enemy follower.');
        if (t && crests(x.s, x.ctrl) >= 3) { x.banish(t); x.heal(x.ctrl, 2); }
      } else if (k === 1) x.tokenToEx('Crest: Marwynn, Despair Manifest');
    },
  });

  // BP20-094EN Himeka, Heir to Repose
  // [evolve] [cost01]: Evolve this.                    (engine-read)
  // [fanfare] Put a Crest: Himeka, Heir to Repose token into your EX area.
  card('BP20-094EN', {
    fanfare(x) { x.tokenToEx('Crest: Himeka, Heir to Repose'); },
  });

  // BP20-095EN Himeka, Heir to Repose (evolved)
  // On Evolve - Search your deck for an Omen–Zealot card not named Himeka, Heir to Repose, reveal it, add it to your hand, then shuffle.
  // On Super-Evolve - [cost02]: Search your deck for an Omen–Zealot follower not named Himeka, Heir to Repose that costs 4 or less, summon it, then shuffle.
  // "Omen–Zealot": a card with both traits (Q2456).
  const omenZealot = (s, i) => hasTraits(s, i, 'Omen', 'Zealot');
  card('BP20-095EN', {
    onEvolve(x) {
      const [c] = x.search({ filter: (i) => omenZealot(x.s, i) && x.name(i) !== 'Himeka, Heir to Repose', prompt: 'Himeka: search your deck for an Omen–Zealot card not named Himeka, Heir to Repose.' });
      if (c) x.toHand(c);
      x.afterSearch();
    },
    onSuperEvolve(x) { // Q2404/Q2405 both trigger; the player orders them
      if (!x.mayPay({ pp: 2 }, 'Himeka: pay 2 play points to summon an Omen–Zealot follower that costs 4 or less from your deck?')) return;
      const [f] = x.search({ filter: (i) => omenZealot(x.s, i) && x.isFollower(i) && x.name(i) !== 'Himeka, Heir to Repose' && baseCost(x.s, i) <= 4, prompt: 'Himeka: search your deck for an Omen–Zealot follower that costs 4 or less to summon.' });
      if (f) x.summon(f);
      x.afterSearch();
    },
  });

  // BP20-097EN Congregant of Repose
  // [evolve] [cost01]: Evolve this.                    (engine-read)
  // [fanfare] Put a Crest: Congregant of Repose token into your EX area.
  card('BP20-097EN', {
    fanfare(x) { x.tokenToEx('Crest: Congregant of Repose'); },
  });

  // BP20-098EN Congregant of Repose (evolved)
  // On Evolve - Select an enemy follower on the field and deal it damage equal to 2 times the number of crests in your EX area.
  card('BP20-098EN', {
    onEvolve(x) {
      const t = enemyFollower(x, 'Congregant of Repose: select an enemy follower. Deal it 2 damage per crest in your EX area.');
      if (t) x.damage(t, 2 * crests(x.s, x.ctrl));
    },
  });

  // BP20-100EN Shining Disenchantment
  // [fanfare] Draw a card.
  // [act] [engage], bury this: Select an enemy follower on the field and deal it 4 damage. Activate only if there are at least 3 crests in your EX area.
  card('BP20-100EN', {
    fanfare(x) { x.draw(1); },
    activated: [{
      text: 'Bury this: deal 4 damage to an enemy follower',
      cost: { engage: true },
      can: (s, me) => crests(s, s.cards[me].ctrl) >= 3 && selectableEnemies(s, s.cards[me].ctrl).length > 0, // CR 10.6.2.3.3
      why: (s, me) => (crests(s, s.cards[me].ctrl) < 3 ? 'You need at least 3 crests in your EX area.' : 'There is no enemy follower to select.'),
      pay(x) { x.bury(x.me); },
      run(x) { const t = enemyFollower(x, 'Shining Disenchantment: select an enemy follower. Deal it 4 damage.'); if (t) x.damage(t, 4); },
    }],
  });

  // BP20-101EN Supplicant of Repose
  // [evolve] [cost01]: Evolve this.                    (engine-read)
  // [fanfare] If there are at least 3 crests in your EX area, give your leader [defense]+2.
  card('BP20-101EN', {
    fanfare(x) { if (crests(x.s, x.ctrl) >= 3) x.heal(x.ctrl, 2); },
  });

  // BP20-102EN Supplicant of Repose (evolved)
  // On Evolve - Put a Crest: Supplicant of Repose token into your EX area.
  card('BP20-102EN', {
    onEvolve(x) { x.tokenToEx('Crest: Supplicant of Repose'); },
  });

  // BP20-103EN Temple of Repose
  // [fanfare] Look at the top 3 cards of your deck. You may reveal an Omen–Zealot card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  // [q][act] [cost01], [engage], bury this: The next time your leader would take damage this turn, it takes that much -2 instead. Activate only if there are at least 3 crests in your EX area.
  card('BP20-103EN', {
    fanfare(x) { x.lookPick({ n: 3, filter: (i) => omenZealot(x.s, i), prompt: 'Temple of Repose: you may reveal an Omen–Zealot card and add it to your hand.' }); },
    activated: [{
      text: 'Bury this: the next damage to your leader this turn is reduced by 2',
      cost: { pp: 1, engage: true }, quick: true,
      can: (s, me) => crests(s, s.cards[me].ctrl) >= 3,
      why: () => 'You need at least 3 crests in your EX area.',
      pay(x) { x.bury(x.me); },
      run(x) { x.effect({ replaceDamage: 'leaderNextMinus', n: 2, ...x.until.eot() }); }, // Q2439 defense changes aren't damage
    }],
  });

  // BP20-107EN Devotee of Repose
  // Ward.                                             (engine-read)
  // [fanfare] Select an enemy follower on the field and deal it X damage. X equals the number of crests in your EX area.
  card('BP20-107EN', {
    fanfare(x) {
      const t = enemyFollower(x, 'Devotee of Repose: select an enemy follower. Deal it 1 damage per crest in your EX area.');
      if (t) x.damage(t, crests(x.s, x.ctrl));
    },
  });

  // Crest tokens: valid in the EX area (CR 9.1.5, 10.3.6); Q2444/Q2445 they can be selected, banished.
  // BP20-T07EN Crest: Marwynn, Despair Manifest (token)
  // At the start of your end phase, select an enemy leader or enemy follower on the field and deal it 1 damage. If there are at least 3 crests in your EX area, deal 2 damage instead. If there are 5, deal 4 damage instead.
  card('BP20-T07EN', {
    endStartZone: 'ex',
    endStart(x) {
      const t = x.selectOne(x.enemyTargets(), 'Crest: Marwynn: select an enemy leader or enemy follower to damage.');
      if (!t) return;
      const n = crests(x.s, x.ctrl);
      x.damage(t, n >= 5 ? 4 : n >= 3 ? 2 : 1);
    },
  });

  // BP20-T08EN Crest: Himeka, Heir to Repose (token)
  // At the start of your end phase, select an enemy follower on the field and, if there are at least 3 crests in your EX area, give it [attack]-2/[defense]-2. If there are 5, give [attack]-4/[defense]-4 instead.
  card('BP20-T08EN', {
    endStartZone: 'ex',
    endStart(x) {
      const t = enemyFollower(x, 'Crest: Himeka: select an enemy follower.');
      if (!t) return;
      const n = crests(x.s, x.ctrl);
      if (n >= 5) x.buff(t, { atk: -4, def: -4 }); else if (n >= 3) x.buff(t, { atk: -2, def: -2 }); // Q2403 attack may go negative
    },
  });

  // BP20-T09EN Crest: Congregant of Repose (token)
  // At the start of your end phase, select an Omen follower on your field and, if there are at least 3 crests in your EX area, give it [attack]+1/[defense]+1.
  card('BP20-T09EN', {
    endStartZone: 'ex',
    endStart(x) {
      const t = x.selectOne(x.followers(x.ctrl).filter((i) => x.hasTrait(i, 'Omen')), 'Crest: Congregant of Repose: select an Omen follower on your field.');
      if (t && crests(x.s, x.ctrl) >= 3) x.buff(t, { atk: 1, def: 1 });
    },
  });

  // BP20-T10EN Crest: Supplicant of Repose (token)
  // At the start of your end phase, if there are at least 3 crests in your EX area, give your leader [defense]+1.
  card('BP20-T10EN', {
    endStartZone: 'ex',
    endStart(x) { if (crests(x.s, x.ctrl) >= 3) x.heal(x.ctrl, 1); },
  });
})();
