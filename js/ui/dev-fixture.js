// js/ui/dev-fixture.js — DEV ONLY, loaded by index.html only when the URL has ?fixture. Skips
// the title screens and starts a match straight away so layout and interaction can be checked
// quickly. Not on the default path.
//   ?fixture                vs AI, two vanilla decks (only cards that need no script: keyword
//                           followers and their evolved cards), Forestcraft vs Dragoncraft
//   ?fixture=decks&a=ID&b=ID  vs AI, two decks from SV.DECKS (add &lenient=1 for unready ones)
//   &mode=ai|hotseat|spectate|tutorial   &level=easy|normal|hard   &seed=N   &first=0|1
//   &anim=off|quick|full    &turns=N (bots play N actions first)
(function () {
  'use strict';
  const SV = globalThis.SV;

  // A vanilla deck for one class: every follower (and its evolved card) whose printed text the
  // engine reads by itself, three copies each, padded to 40.
  function vanilla(cls) {
    const pool = Object.keys(SV.CARDS).map(function (k) { return SV.CARDS[k]; }).filter(function (d) {
      return (d.cls === cls || d.cls === 'neutral') && d.type === 'follower' && !d.token && !d.evolved && !d.advanced && !d.universe && !SV.needsScript(d.no);
    });
    if (!pool.length) throw new Error('no vanilla followers for ' + cls);
    const main = [];
    let n = 0;
    for (let i = 0; n < 40; i++) { const d = pool[i % pool.length]; const q = Math.min(3, 40 - n); main.push([d.no, q]); n += q; }
    const evo = Object.keys(SV.CARDS).map(function (k) { return SV.CARDS[k]; })
      .filter(function (d) { return d.evolved && d.base && pool.some(function (p) { return p.no === d.base; }) && !SV.needsScript(d.no); })
      .slice(0, 5).map(function (d) { return [d.no, 2]; });
    const leader = Object.keys(SV.CARDS).find(function (k) { return SV.CARDS[k].type === 'leader' && SV.CARDS[k].cls === cls; });
    return { name: 'Vanilla ' + cls, cls: cls, leader: leader, main: main, evolve: evo };
  }

  SV.devFixture = {
    vanilla: vanilla,
    boot: function () {
      const q = new URLSearchParams(location.search);
      const kind = q.get('fixture');
      const mode = q.get('mode') || 'ai';
      if (q.get('anim')) SV.anim.setMode(q.get('anim'));
      let decks;
      if (kind === 'decks') decks = [q.get('a') || SV.DECKS[0].id, q.get('b') || SV.DECKS[1].id];
      else decks = [vanilla(q.get('ca') || 'forestcraft'), vanilla(q.get('cb') || 'dragoncraft')];
      document.getElementById('title-screen').className = '';
      SV.ui.start({ mode: mode, decks: decks, level: q.get('level') || 'easy', seed: q.get('seed') || undefined,
        first: q.get('first') != null ? Number(q.get('first')) : undefined });
      const turns = Number(q.get('turns') || 0);
      if (turns) {
        // Fast-forward: both seats played by the bot, no animation, then hand back.
        let s = SV.ui.state;
        for (let i = 0; i < turns && !SV.isTerminal(s); i++) s = SV.apply(s, SV.ai.choose(s, SV.whoActs(s), 'easy'));
        SV.ui.state = s;
        SV.ui.lastN = s.log.length ? s.log[s.log.length - 1].n : -1;
        SV.ui.render();
        SV.ui.schedule();
      }
    },
  };
})();
