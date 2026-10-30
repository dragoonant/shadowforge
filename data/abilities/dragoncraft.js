// Dragoncraft card scripts (docs/ABILITIES.md). One SV.card per card number; printed text in
// the comment above each, verbatim from data/cards.js.
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;

  // ---------------------------------------------------------------- defects
  // BP05-052EN Galmieux, Omen of Disdain (DEFECT, no script)
  // [evolve] [cost02]: Evolve this follower.
  // During your turn, whenever this follower takes ability damage, change its [evolve] cost to 0 for the rest of the turn.

  // ---------------------------------------------------------------- helpers
  const cdef = (s, i) => SV.CARDS[s.cards[i].id];               // printed base card (an evolved follower keeps its base cost, Q466)
  const ctrlOf = (s, me) => H.ctrl(s, me);
  // CR 12.15 Aura: an opponent's follower with Aura can't be selected by p's cards or abilities.
  const selectableBy = (s, p, i) => s.cards[i].ctrl === p || !SV.chars(s, i).kw.Aura;
  const enemyFollowersFor = (s, p) => SV.followers(s, 1 - p).filter((i) => selectableBy(s, p, i));
  const hasEnemyTarget = (s, iid) => enemyFollowersFor(s, s.cards[iid].owner).length > 0;
  const hasOwnFollower = (s, iid) => SV.followers(s, s.cards[iid].owner).length > 0;
  const notFromEx = { canPlay: (s, iid) => s.cards[iid].zone !== 'ex', cantPlayWhy: () => "This can't be played from the EX area." };
  // "[lastwords] Put this into its owner's EX area." (Q2371: with a full EX area it stays in the cemetery; x.toEx handles that.)
  const lwToEx = (x) => { if (x.s.cards[x.me].zone === 'cemetery') x.toEx(x.me); };
  // "During your turn, whenever this (follower) takes ability damage" (Q671/Q1922: everything but
  // combat damage and attack damage to a leader; Strike damage is ability damage). Q672/Q1923: it
  // still triggers when the damage destroys it (the ability resolves after the destruction).
  const abilityDamagedOnMyTurn = (s, me, ev) => ev.iid === me && ev.kind === 'ability' && s.active === s.cards[me].ctrl;
  const condemnedInEx = (x) => x.ex().filter((i) => x.hasTrait(i, 'Condemned'));
  // Optional cost "Bury N Condemned cards from your EX area: …" (CR 10.4.7, asked on resolution).
  function buryCondemnedFromEx(x, n, what) {
    const cand = condemnedInEx(x);
    if (cand.length < n) return false;
    if (n > 1 && !x.may(`Bury ${n} Condemned cards from your EX area to ${what}?`, `Bury ${n}`, "Don't")) return false;
    const pick = x.select({ from: cand, min: n > 1 ? n : 0, max: n, aura: false, prompt: n > 1 ? `Choose the ${n} Condemned cards to bury from your EX area.` : `You may bury a Condemned card from your EX area to ${what}.` });
    if (pick.length < n) return false;
    for (const i of pick) x.bury(i);
    return true;
  }
  const isMegalorca = (s, i) => SV.nameHas(s, i, 'Megalorca');

  // BP01-089EN Conflagration
  // Deal 5 damage to each follower on the field.
  card('BP01-089EN', {
    spell(x) { x.damageMany(x.followers(), 5); },
  });

  // BP01-098EN Blazing Breath
  // [quick]                                    (engine-read)
  // Select an enemy follower on the field and deal it 2 damage. If Overflow is active for you, deal 4 damage instead.
  card('BP01-098EN', {
    canPlay: hasEnemyTarget,
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), 'Blazing Breath: select an enemy follower. Deal it 2 damage (4 with Overflow).');
      if (t) x.damage(t, x.overflow() ? 4 : 2); // Q106: 4, not 6
    },
  });

  // BP03-055EN Jabberwock
  // [fanfare] Put another follower from your field into its owner's cemetery: Reveal the top card of your deck. Repeat until you reveal a follower that costs more than the follower you put into the cemetery and put it onto your field. Shuffle the remaining cards and put them on the bottom of your deck.
  card('BP03-055EN', {
    fanfare(x) {
      // CR 10.4.7 optional cost, asked on resolution. "Put into its owner's cemetery" = bury (CR 5.34.1).
      const cand = x.followers(x.ctrl).filter((i) => i !== x.me);
      const pick = x.select({ from: cand, min: 0, max: 1, prompt: 'Jabberwock: you may put another follower from your field into its cemetery to reveal cards until a follower that costs more.' });
      if (!pick.length) return;
      const cost = cdef(x.s, pick[0]).cost || 0; // Q466: the unevolved form's cost
      x.bury(pick[0]);
      const revealed = [];
      let hit = null;
      for (const i of x.deck()) {
        revealed.push(i);
        if (x.isFollower(i) && (cdef(x.s, i).cost || 0) > cost) { hit = i; break; }
      }
      x.reveal(revealed);
      if (hit) x.summon(hit);
      // Q465: with no hit every revealed card is shuffled and goes back to the deck area (bottom).
      const rest = revealed.filter((i) => i !== hit && x.s.cards[i].zone === 'deck');
      SV.shuffleInPlace(x.s, rest);
      for (const i of rest) x.toDeck(i, 'bottom');
    },
  });

  // BP05-053EN Galmieux, Omen of Disdain (evolved)
  // On Evolve: Select an Omen card that costs 2 play points or less in your cemetery and play it for 0 play points.
  // During your turn, whenever this follower takes ability damage, select an enemy leader or enemy follower on the field and deal it 3 damage.
  card('BP05-053EN', {
    onEvolve(x) {
      const P = x.P();
      const playable = (i) => {
        const d = cdef(x.s, i), t = SV.parsed(d).type;
        if (!d.traits.includes('Omen') || (d.cost || 0) > 2) return false;
        if (t === 'follower' || t === 'amulet') return P.field.length < P.fieldLimit; // CR 10.6.2.6
        if (t !== 'spell') return false;
        const a = SV.abil(d.no);
        return !a.canPlay || a.canPlay(x.s, i); // CR 10.6.2.3.3
      };
      const t = x.selectOne(x.cemetery().filter(playable), 'Galmieux: select an Omen card that costs 2 or less in your cemetery to play for 0 play points.', { aura: false });
      if (t) x.playFree(t);
    },
    triggers: [{
      name: 'Ability damage: deal 3', on: 'damaged', when: abilityDamagedOnMyTurn,
      run(x) {
        const t = x.selectOne(x.enemyTargets(), 'Galmieux: select an enemy leader or enemy follower. Deal it 3 damage.');
        if (t) x.damage(t, 3);
      },
    }],
  });

  // BP05-058EN Disdainful Rending
  // Select a follower on your field and an enemy follower on the field. Deal 1 damage to the first follower and 3 damage to the second.
  card('BP05-058EN', {
    canPlay: (s, iid) => hasOwnFollower(s, iid) && hasEnemyTarget(s, iid), // Q681
    spell(x) {
      const a = x.selectOne(x.followers(x.ctrl), 'Disdainful Rending: select a follower on your field (1 damage).');
      const b = x.selectOne(x.followers(x.opp), 'Disdainful Rending: select an enemy follower (3 damage).');
      x.damageMany([a, b].filter(Boolean), (t) => (t === a ? 1 : 3));
    },
  });

  // BP05-059EN Disciple of Disdain
  // [act] [cost00]: Select a follower on your field and deal it 1 damage. This ability can be activated once per turn.
  card('BP05-059EN', {
    activated: [{
      text: 'Deal 1 damage to a follower on your field', cost: {}, once: true,
      run(x) { const t = x.selectOne(x.followers(x.ctrl), 'Disciple of Disdain: select a follower on your field. Deal it 1 damage.'); if (t) x.damage(t, 1); },
    }],
  });

  // BP05-063EN Servant of Disdain
  // [fanfare] If Overflow is active for you, select another follower on the field. Deal 1 damage to it and this follower.
  // During your turn, whenever this follower takes ability damage, draw a card.
  card('BP05-063EN', {
    fanfare(x) {
      if (!x.overflow()) return;
      const t = x.selectOne(x.followers().filter((i) => i !== x.me), 'Servant of Disdain: select another follower on the field. Deal 1 damage to it and this follower.');
      if (!t) return; // Q687: no other follower, no damage to this either
      x.damageMany([t, x.me].filter((i) => x.onField(i)), 1);
    },
    triggers: [{ name: 'Ability damage: draw', on: 'damaged', when: abilityDamagedOnMyTurn, run(x) { x.draw(1); } }],
  });

  // BP06-054EN Filene, Whitefrost Dragonewt
  // [fanfare] Select an enemy follower on the field and engage it. It doesn't refresh during its controller's next start phase.
  // [fanfare] If Overflow is active for you, search your deck for a Whitefrost Whisper, put it into your EX area, then shuffle your deck.
  card('BP06-054EN', {
    fanfare: [
      (x) => {
        const t = x.selectOne(x.followers(x.opp), 'Filene: select an enemy follower to engage. It does not refresh during its controller\'s next start phase.');
        if (!t) return;
        x.engage(t); // Q818: an engaged one still gets the no-refresh effect
        x.buff(t, { flags: { noRefresh: true } }, x.until.noRefreshNext(x.s.cards[t].ctrl), "doesn't refresh next start phase"); // Q819: its controller now
      },
      (x) => {
        if (!x.overflow()) return;
        const [w] = x.search({ filter: (i) => x.name(i) === 'Whitefrost Whisper', prompt: 'Search your deck for a Whitefrost Whisper to put into your EX area.' });
        if (w) x.toEx(w);
        x.afterSearch(); // Q820: shuffled even when there is none
      },
    ],
  });

  // BP06-058EN Whitefrost Whisper
  // This card costs 1 less to play if Overflow is active for you.
  // ----------
  // Select an engaged enemy follower on the field and destroy it. If there's a Filene, Whitefrost Dragonewt on your field, deal 2 damage to the selected follower's leader.
  card('BP06-058EN', {
    selfCost: (s, iid, p) => (SV.overflow(s, p) ? -1 : 0),
    canPlay: (s, iid) => enemyFollowersFor(s, s.cards[iid].owner).some((i) => s.cards[i].engaged), // Q826
    cantPlayWhy: () => 'There is no engaged enemy follower to select.',
    spell(x) {
      const t = x.selectOne(x.followers(x.opp).filter((i) => x.engaged(i)), 'Whitefrost Whisper: select an engaged enemy follower to destroy.');
      if (!t) return;
      const leader = x.leader(x.s.cards[t].ctrl);
      x.destroy(t);
      if (x.field(x.ctrl).some((i) => x.named(i, 'Filene, Whitefrost Dragonewt'))) x.damage(leader, 2);
    },
  });

  // BP08-058EN Powerforge
  // Select an enemy follower on the field and a follower on your field or in your EX area. Deal the first follower damage equal to the second's attack.
  const powerforgeOwn = (s, p) => [...SV.followers(s, p), ...s.players[p].ex.filter((i) => SV.isFollower(s, i))];
  card('BP08-058EN', {
    canPlay: (s, iid) => hasEnemyTarget(s, iid) && powerforgeOwn(s, s.cards[iid].owner).length > 0, // Q1074
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), 'Powerforge: select an enemy follower (the first follower).');
      const src = x.selectOne(powerforgeOwn(x.s, x.ctrl), 'Powerforge: select a follower on your field or in your EX area (the second follower).', { aura: false });
      if (t && src) x.damage(t, x.chars(src).atk);
    },
  });

  // BP09-073EN Force of the Dragonewt
  // [quick]                                    (engine-read)
  // Select an enemy follower on the field. Deal it 3 damage, draw a card, then discard a card.
  card('BP09-073EN', {
    canPlay: hasEnemyTarget, // Q1173
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), 'Force of the Dragonewt: select an enemy follower. Deal it 3 damage.');
      if (!t) return;
      x.damage(t, 3); x.draw(1); x.chooseDiscard(1);
    },
  });

  // BP10-056EN Aiela, Devoted Knight
  // [fanfare] Choose one. (1) Increase your max play points by 1. Recover 2 play points. (2) If Overflow is active for you, summon a Devoted Dragon token and give your leader [defense]+2.
  card('BP10-056EN', {
    fanfare(x) {
      const [k] = x.choose('Aiela: choose one.', [
        { label: 'Increase your max play points by 1. Recover 2 play points.' },
        { label: 'If Overflow is active for you, summon a Devoted Dragon token and give your leader +2 defense.' }, // Q1288: choosable without Overflow
      ]);
      if (k === 0) { x.gainMaxPP(1); x.recoverPP(2); }
      else if (x.overflow()) { x.summonToken('Devoted Dragon'); x.heal(x.ctrl, 2); }
    },
  });

  // BP10-T02EN Devoted Dragon (token)
  // Ward.                                      (engine-read)
  // While there's an Aiela, Devoted Knight on your field, this follower doesn't take ability damage.
  card('BP10-T02EN', {
    replaceDamage: (s, me, ev) => (ev.target === me && ev.kind === 'ability' && SV.field(s, s.cards[me].ctrl).some((i) => SV.nameHas(s, i, 'Aiela, Devoted Knight')) ? 0 : ev.amount), // Q1242
  });

  // BP12-058EN Cursed Furor
  // While Overflow is active for you, this card has [quick].
  // ----------
  // Select an enemy follower on the field. Deal it 4 damage and summon a Naterran Great Tree token.
  card('BP12-058EN', {
    quickIf: (s, iid) => SV.overflow(s, s.cards[iid].owner),
    canPlay: hasEnemyTarget, // Q1630
    spell(x) {
      const t = x.selectOne(x.followers(x.opp), 'Cursed Furor: select an enemy follower. Deal it 4 damage.');
      if (!t) return;
      x.damage(t, 4);
      x.summonToken('Naterran Great Tree');
    },
  });

  // BP13-056EN Forte, Sovereign Supreme
  // Each Dragon on your field has Storm and Drain.
  // At the start of your end phase, select up to 2 enemy followers on the field. During their controller's next turn, they can't attack enemies.
  // [act] [cost00]: Summon a Dragon token. Activate only once per turn.
  card('BP13-056EN', {
    // CR 2.1.2: "Dragon" = a card whose name contains Dragon (the Dragon token, Devoted Dragon, Genesis Dragon …).
    auras: [(s, me, t, r) => {
      if (s.cards[t].zone === 'field' && s.cards[t].ctrl === s.cards[me].ctrl && SV.isFollower(s, t) && SV.nameHas(s, t, 'Dragon')) { r.kw.Storm = true; r.kw.Drain = true; }
    }],
    endStart(x) {
      const pick = x.select({ from: x.followers(x.opp), min: 0, max: 2, prompt: "Forte: select up to 2 enemy followers. During their controller's next turn, they can't attack enemies." });
      for (const t of pick) x.buff(t, { flags: { cantAttackEnemies: true } }, x.until.theirNextTurn(x.s.cards[t].ctrl), "can't attack enemies next turn");
    },
    activated: [{ text: 'Summon a Dragon token', cost: {}, once: true, run(x) { x.summonToken('Dragon'); } }],
  });

  // BP15-057EN Galmieux, Ardent Disdain
  // [fanfare] Put a Fangs of Ardent Destruction token into your EX area.
  // During your turn, whenever this takes ability damage, look at the top 2 cards of your deck. You may put one of them into your EX area. If it's an Omen card, it costs 3 less to play this turn. Bury the rest.
  card('BP15-057EN', {
    fanfare(x) { x.tokenToEx('Fangs of Ardent Destruction'); },
    triggers: [{
      name: 'Ability damage: look at 2', on: 'damaged', when: abilityDamagedOnMyTurn,
      run(x) {
        const top = x.deck().slice(0, 2);
        if (!top.length) return;
        const pick = x.select({ from: top, seen: top, min: 0, max: 1, aura: false, prompt: 'Galmieux: you may put one of these into your EX area (an Omen card costs 3 less to play this turn). The rest are buried.' });
        if (pick.length && x.toEx(pick[0]) && x.hasTrait(pick[0], 'Omen')) x.buff(pick[0], { cost: -3 }, x.until.eot(), 'costs 3 less to play this turn');
        for (const i of top) if (!pick.includes(i) || x.s.cards[i].zone === 'deck') x.bury(i);
      },
    }],
  });

  // BP15-PR13EN Fangs of Ardent Destruction (token spell)
  // Deal 1 damage to each follower on the field. If Overflow is active for you, give each Galmieux, Ardent Disdain on your field Storm.
  card('BP15-PR13EN', {
    spell(x) {
      x.damageMany(x.followers(), 1);
      if (x.overflow()) for (const g of x.followers(x.ctrl).filter((i) => x.named(i, 'Galmieux, Ardent Disdain'))) x.give(g, 'Storm');
    },
  });

  // BP15-058EN Filene, Blizzardous Heart
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // Bane.                                      (engine-read)
  // [fanfare] If Overflow is active for you, during each opponent's next turn, any card they play costs 1 more.
  card('BP15-058EN', {
    fanfare(x) {
      // Q1925 two of these stack; Q1926 it lasts after Filene leaves (a global effect, not an aura).
      if (x.overflow()) x.effect({ costMod: 1, filter: 'any', p: x.opp, ...x.until.theirNextTurn(x.opp) });
    },
  });
  // BP15-059EN Filene, Blizzardous Heart (evolved)
  // Bane.
  // On Evolve - Search your deck for a card with "Whitefrost" in its name, reveal it, add it to your hand, then shuffle.
  card('BP15-059EN', {
    onEvolve(x) {
      const [t] = x.search({ filter: (i) => x.name(i).includes('Whitefrost'), prompt: 'Filene: search your deck for a card with "Whitefrost" in its name.' });
      if (t) x.toHand(t);
      x.afterSearch();
    },
  });

  // BP15-065EN Whitefrost Blizzard
  // This costs 2 less to play if there's a follower on your field with "Filene" in its name.
  // ----------
  // Select any number of enemy followers on the field and deal X damage divided between them. X equals your max play points.
  card('BP15-065EN', {
    selfCost: (s, iid, p) => (SV.followers(s, p).some((i) => SV.nameHas(s, i, 'Filene')) ? -2 : 0),
    spell(x) {
      const X = x.P().maxPP;
      // CR 10.6.2.3.2 "any number" (0 or more); 10.6.2.4.2 each selected target gets at least 1.
      const pick = x.select({ from: x.followers(x.opp), min: 0, max: Math.min(X, 5), prompt: `Whitefrost Blizzard: select any number of enemy followers to divide ${X} damage between.` });
      if (!pick.length || X <= 0) return;
      const share = new Map();
      let left = X;
      pick.forEach((t, k) => {
        const others = pick.length - 1 - k;
        const n = k === pick.length - 1 ? left : x.number(`Whitefrost Blizzard: how much of the remaining ${left} damage goes to ${x.name(t)}?`, 1, left - others);
        share.set(t, n); left -= n;
      });
      x.damageMany(pick, (t) => share.get(t));
    },
  });

  // BP15-066EN Adherent of Ardor
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Select up to 2 followers on your field and, if Overflow is active for you, deal them 1 damage.
  // During your turn, whenever this takes ability damage, select an enemy follower on the field and deal it 3 damage.
  const adherentTrigger = {
    name: 'Ability damage: deal 3', on: 'damaged', when: abilityDamagedOnMyTurn,
    run(x) { const t = x.selectOne(x.followers(x.opp), 'Adherent of Ardor: select an enemy follower. Deal it 3 damage.'); if (t) x.damage(t, 3); },
  };
  card('BP15-066EN', {
    fanfare(x) {
      const pick = x.select({ from: x.followers(x.ctrl), min: 0, max: 2, prompt: 'Adherent of Ardor: select up to 2 followers on your field (1 damage each with Overflow).' });
      if (x.overflow()) x.damageMany(pick, 1);
    },
    triggers: [adherentTrigger],
  });
  // BP15-067EN Adherent of Ardor (evolved)
  // On Evolve - Select up to 2 followers on your field and deal them 1 damage.
  // During your turn, whenever this takes ability damage, select an enemy follower on the field and deal it 3 damage.
  card('BP15-067EN', {
    onEvolve(x) {
      const pick = x.select({ from: x.followers(x.ctrl), min: 0, max: 2, prompt: 'Adherent of Ardor: select up to 2 followers on your field. Deal them 1 damage.' });
      x.damageMany(pick, 1);
    },
    triggers: [adherentTrigger],
  });

  // BP15-072EN Hermit of Disdain
  // [fanfare] Select a follower on your field and, if Overflow is active for you, deal it 1 damage.
  // During your turn, whenever this takes ability damage, look at the top card of your deck. If it's an Omen card, you may reveal it and add it to your hand.
  card('BP15-072EN', {
    fanfare(x) {
      const t = x.selectOne(x.followers(x.ctrl), 'Hermit of Disdain: select a follower on your field (1 damage with Overflow).');
      if (t && x.overflow()) x.damage(t, 1);
    },
    triggers: [{
      name: 'Ability damage: look at the top card', on: 'damaged', when: abilityDamagedOnMyTurn,
      run(x) {
        const top = x.deck()[0];
        if (!top) return;
        const ok = x.hasTrait(top, 'Omen') ? [top] : [];
        // The player looks at it either way; only an Omen card can be taken (Q1932: optional, else it stays on top).
        const pick = ok.length ? x.select({ from: ok, seen: [top], min: 0, max: 1, aura: false, prompt: 'Hermit of Disdain: the top card is an Omen card. Reveal it and add it to your hand?' }) : [];
        if (pick.length) { x.reveal(pick); x.toHand(top); }
      },
    }],
  });

  // BP16-057EN Forte, Blackwing Dragoon
  // Storm. Intimidate.                         (engine-read)
  // [fanfare] If you have 10 max play points, give this [attack]+1 and Aura.
  card('BP16-057EN', {
    fanfare(x) { if (x.P().maxPP >= 10) x.buff(x.me, { atk: 1, kw: { Aura: true } }); },
  });

  // BP17-055EN Rowen, Dragon Lance
  // Rush. Assail.                              (engine-read)
  // [fanfare] Put a Curse of the Black Dragon token into your EX area.
  // Strike - Select an enemy follower on the field. Deal it 2 damage and, if Overflow is active for you, deal 1 damage to its leader.
  // [act] [cost04]: Select an enemy follower on the field. Deal 3 damage to it and 1 damage to its leader.
  card('BP17-055EN', {
    fanfare(x) { x.tokenToEx('Curse of the Black Dragon'); },
    strike(x) {
      const t = x.selectOne(x.followers(x.opp), 'Rowen: select an enemy follower. Deal it 2 damage (and 1 to its leader with Overflow).');
      if (!t) return;
      const leader = x.leader(x.s.cards[t].ctrl);
      x.damage(t, 2);
      if (x.overflow()) x.damage(leader, 1);
    },
    activated: [{
      text: 'Deal 3 damage to an enemy follower and 1 to its leader', cost: { pp: 4 },
      can: (s, me) => enemyFollowersFor(s, s.cards[me].ctrl).length > 0, // CR 10.6.2.3.3
      why: () => 'There is no enemy follower to select.',
      run(x) {
        const t = x.selectOne(x.followers(x.opp), 'Rowen: select an enemy follower. Deal it 3 damage and 1 to its leader.');
        if (!t) return;
        x.damageMany([t, x.leader(x.s.cards[t].ctrl)], (i) => (i === t ? 3 : 1));
      },
    }],
    // Granted by Curse of the Black Dragon: "If this would deal damage, it deals that much plus 1 instead" (Q2118: ability and attack damage).
    replaceDamage: (s, me, ev) => (ev.src === me && s.cards[me].zone === 'field' && SV.chars(s, me).flags.curseBlackDragon ? ev.amount + 1 : ev.amount),
  });

  // BP17-T06EN Curse of the Black Dragon (token spell)
  // This can't be played unless Overflow is active for you.
  // At the start of your end phase, if this is in your EX area and Overflow isn't active for you, deal 1 damage to your leader.
  // ----------
  // Select a Rowen, Dragon Lance on your field and give it "If this would deal damage, it deals that much plus 1 instead" for the rest of this turn.
  card('BP17-T06EN', {
    canPlay: (s, iid) => { const p = s.cards[iid].owner; return SV.overflow(s, p) && SV.followers(s, p).some((i) => SV.nameHas(s, i, 'Rowen, Dragon Lance')); },
    cantPlayWhy: (s, iid) => (SV.overflow(s, s.cards[iid].owner) ? 'There is no Rowen, Dragon Lance on your field to select.' : "This can't be played unless Overflow is active for you."),
    spell(x) {
      const t = x.selectOne(x.followers(x.ctrl).filter((i) => x.named(i, 'Rowen, Dragon Lance')), 'Curse of the Black Dragon: select a Rowen, Dragon Lance on your field.');
      if (t) x.buff(t, { flags: { curseBlackDragon: true } }, x.until.eot(), 'deals that much plus 1 damage this turn');
    },
    endStart(x) { if (x.s.cards[x.me].zone === 'ex' && !x.overflow()) x.damage(x.leader(x.ctrl), 1); },
    endStartZone: 'ex',
  });

  // BP18-061EN Fafnir, Cunning Wyrm
  // Ward.                                      (engine-read)
  // If an enemy follower would be put from the field into the cemetery, banish it instead.
  // [fanfare] Deal 8 damage to each enemy follower on the field. Deal 4 damage to each enemy leader.
  card('BP18-061EN', {
    // Replacement (CR 10.10): an enemy follower leaving the field for the cemetery is banished instead.
    // Q2170: its Last Words then don't trigger (they need to === 'cemetery').
    replaceLeave: (s, me, ev) => (ev.to === 'cemetery' && s.cards[ev.iid].zone === 'field' && s.cards[ev.iid].ctrl !== s.cards[me].ctrl && SV.isFollower(s, ev.iid) ? 'banished' : undefined),
    fanfare(x) {
      const L = x.leader(x.opp);
      x.damageMany([...x.followers(x.opp), L], (t) => (t === L ? 4 : 8));
    },
  });

  // BP19-056EN Antemaria, Huntress Convict
  // This can't be played from the EX area.
  // ----------
  // [fanfare] Bury 2 Condemned cards from your EX area: Give this Storm and Drain.
  // [lastwords] Put this into its owner's EX area.
  card('BP19-056EN', {
    ...notFromEx,
    fanfare(x) { if (buryCondemnedFromEx(x, 2, 'give Antemaria Storm and Drain') && x.onField(x.me)) x.buff(x.me, { kw: { Storm: true, Drain: true } }); },
    lastWords: lwToEx,
  });

  // BP19-057EN Drazael, Ravening Enforcer
  // This can't be played from the EX area.
  // ----------
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // Ward.                                      (engine-read)
  // This can't be destroyed by abilities.
  // [lastwords] Put this into its owner's EX area.
  const drazaelAura = (s, me, t, r) => { if (t === me) r.flags.cantBeDestroyedByAbilities = true; }; // Q2372: burying is not destroying
  card('BP19-057EN', {
    ...notFromEx,
    auras: [drazaelAura],
    lastWords: lwToEx,
  });
  // BP19-058EN Drazael, Ravening Enforcer (evolved)
  // Ward.
  // This can't be destroyed by abilities.
  // On Evolve - Bury two Condemned cards from your EX area: Give each enemy follower on the field [attack]-5/[defense]-5. Give your leader [defense]+5.
  // [lastwords] Put this into its owner's EX area.
  card('BP19-058EN', {
    auras: [drazaelAura],
    onEvolve(x) {
      if (!buryCondemnedFromEx(x, 2, 'give each enemy follower -5/-5 and your leader +5 defense')) return;
      for (const t of x.followers(x.opp)) x.buff(t, { atk: -5, def: -5 });
      x.heal(x.ctrl, 5);
    },
    lastWords: lwToEx,
  });

  // BP19-060EN Scorched-Earth Tyrant
  // This can't be played from the EX area.
  // ----------
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [fanfare] Bury a Condemned card from your EX area: Select an enemy follower on the field and deal it 4 damage.
  // [lastwords] Put this into its owner's EX area.
  card('BP19-060EN', {
    ...notFromEx,
    fanfare(x) {
      if (!buryCondemnedFromEx(x, 1, 'deal 4 damage to an enemy follower')) return;
      const t = x.selectOne(x.followers(x.opp), 'Scorched-Earth Tyrant: select an enemy follower. Deal it 4 damage.');
      if (t) x.damage(t, 4);
    },
    lastWords: lwToEx,
  });
  // BP19-061EN Scorched-Earth Tyrant (evolved)
  // On Evolve - Select an enemy follower on the field and deal it 4 damage.
  // [lastwords] Put this into its owner's EX area.
  card('BP19-061EN', {
    onEvolve(x) { const t = x.selectOne(x.followers(x.opp), 'Scorched-Earth Tyrant: select an enemy follower. Deal it 4 damage.'); if (t) x.damage(t, 4); },
    lastWords: lwToEx,
  });

  // BP19-062EN Neptune, Arbiter of Tides
  // [fanfare] Put a Megalorca token into your EX area. If Overflow is active for you, summon a Megalorca token.
  // Whenever a Megalorca is put onto your field, give it Storm and your leader [defense]+1.
  // [act] [cost00]: The next Marine card you play from the EX area this turn costs 1 less. Activate only once per turn.
  // The one-shot cost effect is consumed by the next Marine card played from the EX area: the filter
  // looks for such a play in the log after the effect was created (SV.COST_FILTERS key, data only).
  SV.COST_FILTERS['dragoncraft:nextMarineFromEx'] = (s, iid, e) => {
    if (s.cards[iid].zone !== 'ex' || !cdef(s, iid).traits.includes('Marine')) return false;
    return !s.log.some((l) => l.n >= e.sinceN && l.type === 'play' && l.who === e.p && l.from === 'ex' && SV.CARDS[s.cards[l.iid].id].traits.includes('Marine'));
  };
  card('BP19-062EN', {
    fanfare(x) {
      x.tokenToEx('Megalorca');
      if (x.overflow()) x.summonToken('Megalorca');
    },
    triggers: [{
      name: 'Megalorca: Storm and +1 defense', on: 'enter',
      when: (s, me, ev) => ev.p === s.cards[me].ctrl && isMegalorca(s, ev.iid), // Q2374 also on the opponent's turn; Q2373 each Neptune
      run(x, ev) {
        if (x.onField(ev.iid)) x.give(ev.iid, 'Storm');
        x.heal(x.ctrl, 1);
      },
    }],
    activated: [{
      text: 'The next Marine card you play from the EX area this turn costs 1 less', cost: {}, once: true,
      run(x) { x.effect({ costMod: -1, filter: 'dragoncraft:nextMarineFromEx', sinceN: x.s.logN, ...x.until.eot() }); },
    }],
  });

  // BP19-063EN Warden of the Adamant Claw
  // This can't be played from the EX area.
  // ----------
  // Ward.                                      (engine-read)
  // [fanfare] Look at the top 4 cards of your deck. You may reveal a Condemned card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  // [lastwords] Put this into its owner's EX area.
  card('BP19-063EN', {
    ...notFromEx,
    fanfare(x) { x.lookPick({ n: 4, filter: (i) => x.hasTrait(i, 'Condemned'), prompt: 'Warden of the Adamant Claw: you may reveal a Condemned card and add it to your hand.' }); },
    lastWords: lwToEx,
  });

  // BP19-064EN Hotheaded Marauder
  // This can't be played from the EX area.
  // ----------
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // [lastwords] Put this into its owner's EX area.
  card('BP19-064EN', { ...notFromEx, lastWords: lwToEx });
  // BP19-065EN Hotheaded Marauder (evolved)
  // On Evolve - Search your deck for a 1-cost Condemned follower, summon it, then shuffle.
  // [lastwords] Put this into its owner's EX area.
  card('BP19-065EN', {
    onEvolve(x) {
      const [t] = x.search({ filter: (i) => x.isFollower(i) && x.hasTrait(i, 'Condemned') && cdef(x.s, i).cost === 1, prompt: 'Hotheaded Marauder: search your deck for a 1-cost Condemned follower to summon.' });
      if (t) x.summon(t);
      x.afterSearch();
    },
    lastWords: lwToEx,
  });

  // BP19-066EN Razor-Clawed Thief
  // This can't be played from the EX area.
  // ----------
  // Rush. Assail.                              (engine-read)
  // [lastwords] Put this into its owner's EX area.
  card('BP19-066EN', { ...notFromEx, lastWords: lwToEx });

  // BP19-067EN Seasoned Merman
  // Each Megalorca on your field has Rush and Assail.
  // [fanfare] Summon 2 Megalorca tokens. Put the top card of your deck into your EX area.
  card('BP19-067EN', {
    auras: [(s, me, t, r) => { if (s.cards[t].zone === 'field' && s.cards[t].ctrl === s.cards[me].ctrl && isMegalorca(s, t)) { r.kw.Rush = true; r.kw.Assail = true; } }],
    fanfare(x) {
      x.summonToken('Megalorca', 2);
      const top = x.deck()[0];
      if (top) x.toEx(top);
    },
  });

  // BP19-073EN Call of the Megalorca
  // This costs 1 less to play from the EX area.
  // ----------
  // Summon a Megalorca token. Draw a card. If Overflow is active for you, summon a Megalorca token.
  card('BP19-073EN', {
    selfCost: (s, iid) => (s.cards[iid].zone === 'ex' ? -1 : 0),
    spell(x) {
      x.summonToken('Megalorca');
      x.draw(1);
      if (x.overflow()) x.summonToken('Megalorca');
    },
  });

  // BP20-056EN Galmieux, Ardor Manifest
  // While Overflow is active for you, this has Storm.
  // Once on each of your turns, when this takes ability damage, select an enemy follower on the field and deal it 2 damage.
  // [fanfare] Put a Crest: Galmieux, Ardor Manifest token into your EX area.
  card('BP20-056EN', {
    auras: [(s, me, t, r) => { if (t === me && SV.overflow(s, s.cards[me].ctrl)) r.kw.Storm = true; }],
    triggers: [{
      name: 'Ability damage: deal 2', on: 'damaged', limit: 1, when: abilityDamagedOnMyTurn, // Q2425
      run(x) { const t = x.selectOne(x.followers(x.opp), 'Galmieux: select an enemy follower. Deal it 2 damage.'); if (t) x.damage(t, 2); },
    }],
    fanfare(x) { x.tokenToEx('Crest: Galmieux, Ardor Manifest'); },
  });

  // BP20-T05EN Crest: Galmieux, Ardor Manifest (crest token)
  // [act] [cost00]: Select an Omen follower on your field and deal it 1 damage. Activate only once per turn.
  const omenFollowers = (s, p) => SV.followers(s, p).filter((i) => SV.chars(s, i).traits.includes('Omen'));
  card('BP20-T05EN', {
    activated: [{
      text: 'Deal 1 damage to an Omen follower on your field', cost: {}, once: true, zone: 'ex',
      can: (s, me) => omenFollowers(s, s.cards[me].owner).length > 0, // CR 10.6.2.3.3
      why: () => 'There is no Omen follower on your field.',
      run(x) { const t = x.selectOne(omenFollowers(x.s, x.ctrl), 'Crest: select an Omen follower on your field. Deal it 1 damage.'); if (t) x.damage(t, 1); },
    }],
  });

  // BP20-057EN Azurifrit, Heir to Disdain
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // Ward.                                      (engine-read)
  // [fanfare] If there's another Omen card on your field or in your EX area, deal 1 damage to each follower on the field.
  // During your turn, whenever this takes ability damage, deal 1 damage to each enemy follower on the field.
  const azurifritTrigger = { name: 'Ability damage: 1 to each enemy follower', on: 'damaged', when: abilityDamagedOnMyTurn, run(x) { x.damageMany(x.followers(x.opp), 1); } };
  card('BP20-057EN', {
    fanfare(x) {
      if ([...x.field(x.ctrl), ...x.ex()].some((i) => i !== x.me && x.hasTrait(i, 'Omen'))) x.damageMany(x.followers(), 1);
    },
    triggers: [azurifritTrigger],
  });
  // BP20-058EN Azurifrit, Heir to Disdain (evolved)
  // Ward.
  // On Evolve - Deal 1 damage to each follower on the field.
  // On Super-Evolve - Deal 1 damage to each follower on the field and 4 damage to each enemy leader. Change this follower's defense to 7.
  // During your turn, whenever this takes ability damage, deal 1 damage to each enemy follower on the field.
  card('BP20-058EN', {
    onEvolve(x) { x.damageMany(x.followers(), 1); },
    onSuperEvolve(x) {
      const L = x.leader(x.opp);
      x.damageMany([...x.followers(), L], (t) => (t === L ? 4 : 1));
      // Q2426/Q2427: on the field, its defense becomes 7 (even from 0) before the next Confirmation Timing.
      // Done as a defense change of (7 - current defense) so later buffs and damage still apply on top.
      if (x.onField(x.me)) { const d = x.chars(x.me).def; if (d !== 7) x.buff(x.me, { def: 7 - d }, null, 'defense changed to 7'); }
    },
    triggers: [azurifritTrigger],
  });

  // BP20-062EN Congregant of Disdain
  // [fanfare] If Overflow is active for you, deal 1 damage to each follower on the field.
  // Once on each of your turns, when this takes ability damage, increase your max play points by 1.
  card('BP20-062EN', {
    fanfare(x) { if (x.overflow()) x.damageMany(x.followers(), 1); },
    triggers: [{ name: 'Ability damage: +1 max play point', on: 'damaged', limit: 1, when: abilityDamagedOnMyTurn, run(x) { x.gainMaxPP(1); } }],
  });

  // BP20-063EN Ferocious Flame
  // Select a follower on your field and an enemy follower on the field. Deal 1 damage to the first follower and 4 damage to the second, draw a card, and if there's a follower on your field with "Galmieux" in its name, increase your max play points by 1.
  card('BP20-063EN', {
    canPlay: (s, iid) => hasOwnFollower(s, iid) && hasEnemyTarget(s, iid), // Q2429
    spell(x) {
      const a = x.selectOne(x.followers(x.ctrl), 'Ferocious Flame: select a follower on your field (1 damage).');
      const b = x.selectOne(x.followers(x.opp), 'Ferocious Flame: select an enemy follower (4 damage).');
      x.damageMany([a, b].filter(Boolean), (t) => (t === a ? 1 : 4));
      x.draw(1);
      if (x.followers(x.ctrl).some((i) => x.named(i, 'Galmieux'))) x.gainMaxPP(1);
    },
  });

  // BP20-064EN Supplicant of Disdain
  // [evolve] [cost01]: Evolve this.            (engine-read)
  // Ward.                                      (engine-read)
  // [fanfare] Select a follower on the field. If Overflow is active for you, deal it 1 damage and give your leader [defense]+2.
  card('BP20-064EN', {
    fanfare(x) {
      const t = x.selectOne(x.followers(), 'Supplicant of Disdain: select a follower on the field (with Overflow: 1 damage and +2 defense for your leader).'); // Q2430 any follower
      if (t && x.overflow()) { x.damage(t, 1); x.heal(x.ctrl, 2); }
    },
  });
  // BP20-065EN Supplicant of Disdain (evolved)
  // Ward.
  // On Evolve - Select an enemy follower on the field and deal it 2 damage.
  card('BP20-065EN', {
    onEvolve(x) { const t = x.selectOne(x.followers(x.opp), 'Supplicant of Disdain: select an enemy follower. Deal it 2 damage.'); if (t) x.damage(t, 2); },
  });

  // BP20-067EN Nation of Disdain
  // [fanfare] Look at the top 2 cards of your deck. You may reveal an Omen–Wyrmkin card from among them and add it to your hand. Put the rest on the bottom of your deck in any order.
  // [act] [engage], bury this: Select a follower on your field and deal it 1 damage.
  card('BP20-067EN', {
    fanfare(x) { x.lookPick({ n: 2, filter: (i) => x.hasTrait(i, 'Omen') && x.hasTrait(i, 'Wyrmkin'), prompt: 'Nation of Disdain: you may reveal an Omen–Wyrmkin card and add it to your hand.' }); }, // Q2456
    activated: [{
      text: 'Bury this: deal 1 damage to a follower on your field', cost: { engage: true, text: 'bury this' },
      can: (s, me) => SV.followers(s, s.cards[me].ctrl).length > 0, // CR 10.6.2.3.3
      why: () => 'There is no follower on your field to select.',
      pay(x) { x.bury(x.me); },
      run(x) { const t = x.selectOne(x.followers(x.ctrl), 'Nation of Disdain: select a follower on your field. Deal it 1 damage.'); if (t) x.damage(t, 1); },
    }],
  });

  // BP20-070EN Devotee of Disdain
  // [act] [cost00]: Select a follower on your field and deal it 1 damage. Activate only once per turn.
  card('BP20-070EN', {
    activated: [{
      text: 'Deal 1 damage to a follower on your field', cost: {}, once: true,
      run(x) { const t = x.selectOne(x.followers(x.ctrl), 'Devotee of Disdain: select a follower on your field. Deal it 1 damage.'); if (t) x.damage(t, 1); },
    }],
  });

  // SD04-002EN Dragon Oracle
  // Choose one of the following effects. (1) Increase your maximum play points by 1. (2) Draw a card.
  card('SD04-002EN', {
    spell(x) {
      const [k] = x.choose('Dragon Oracle: choose one.', [{ label: 'Increase your maximum play points by 1.' }, { label: 'Draw a card.' }]); // Q101: allowed at 10
      if (k === 0) x.gainMaxPP(1); else x.draw(1);
    },
  });

  // BP05-052EN Galmieux, Omen of Disdain
  // [evolve] [cost02]: Evolve this follower.   (engine-read)
  // During your turn, whenever this follower takes ability damage, change its [evolve] cost to 0 for the rest of the turn.
  card('BP05-052EN', {
    triggers: [{
      name: 'Evolve cost 0', on: 'damaged',
      when: (s, me, ev) => ev.iid === me && ev.kind === 'ability' && s.active === s.cards[me].ctrl,
      run(x) { if (x.onField(x.me)) x.buff(x.me, { evolveCost: 0 }, x.until.eot(), 'evolve cost 0 this turn'); },
    }],
  });
})();
