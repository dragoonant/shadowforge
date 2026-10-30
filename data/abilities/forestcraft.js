// Forestcraft card scripts (docs/ABILITIES.md). One SV.card per card number; printed text in
// the comment above each, verbatim from data/cards.js.
(function () {
  const SV = globalThis.SV;
  const { card, H } = SV;

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
})();
