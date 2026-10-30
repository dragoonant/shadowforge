// Abysscraft card scripts (docs/ABILITIES.md).
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;

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
})();
