// Swordcraft card scripts (docs/ABILITIES.md).
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;

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
})();
