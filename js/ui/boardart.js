// js/ui/boardart.js — the play surface, DRAWN rather than photographed (PRESENTATION-REFERENCE
// A2), dressed as a dark-fantasy card arena: an obsidian slab inside a forged silver rule, a
// rune circle across the middle, every zone framed with angular forged corners, the leader in
// a pointed arch. ONE geometry table in a fixed 2048x1280 board space is used twice: to draw
// every slot and to place every DOM zone by percentage, so a drawn outline and the hitbox
// inside it are the same numbers by construction.
//
// Per side, centre line outward:   leader | field (5)          | deck | evolve deck
//                                  leader | EX area (5) | cemetery | banished | points
// The opponent's half is yours rotated 180 degrees about the board centre, so each player
// reads their own side in the same order and the halves cannot drift apart.
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;
  const W = 2048, H = 1280;

  // YOUR half. Wider gaps between groups (leader | field | piles) than within them is what
  // makes the row read as groups rather than equal boxes.
  // field: five followers all engaged need 5 x 230 units (card height) plus gaps.
  const MINE = {
    leader:   { x: 40,   y: 660, w: 250,  h: 580 },
    field:    { x: 316,  y: 660, w: 1240, h: 300 },
    deck:     { x: 1582, y: 660, w: 204,  h: 300 },
    evo:      { x: 1804, y: 660, w: 204,  h: 300 },
    ex:       { x: 316,  y: 986, w: 924,  h: 254 },
    cemetery: { x: 1266, y: 986, w: 180,  h: 254 },
    banished: { x: 1462, y: 986, w: 180,  h: 254 },
    points:   { x: 1668, y: 986, w: 340,  h: 254 },
  };
  function mirror(r) { return { x: W - r.x - r.w, y: H - r.y - r.h, w: r.w, h: r.h }; }
  const THEIRS = {};
  Object.keys(MINE).forEach(function (k) { THEIRS[k] = mirror(MINE[k]); });
  SV.boardLayout = { w: W, h: H, mine: MINE, theirs: THEIRS };

  const LABELS = { field: 'Field', ex: 'EX Area', deck: 'Deck', evo: 'Evolve deck', cemetery: 'Cemetery', banished: 'Banished' };
  const pct = function (v, total) { return (v / total * 100) + '%'; };
  const svgEl = U.svgEl;

  // A forged corner: an angular bracket with a notch, drawn for the top-left corner and
  // mirrored into the other three. Hardware, not filigree.
  function corner(len) {
    return 'M ' + len + ' 2 L 14 2 L 2 14 L 2 ' + len + ' M ' + (len * 0.55) + ' 9 L 18 9 L 9 18 L 9 ' + (len * 0.55);
  }
  function frame(rect, cls, radius) {
    const g = svgEl('g', { class: 'bz ' + cls });
    const r = radius == null ? 14 : radius;
    g.appendChild(svgEl('rect', { x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: r, ry: r, class: 'bz-fill' }));
    g.appendChild(svgEl('rect', { x: rect.x + 1, y: rect.y + 1, width: rect.w - 2, height: rect.h - 2, rx: r, ry: r, class: 'bz-line' }));
    g.appendChild(svgEl('rect', { x: rect.x + 8, y: rect.y + 8, width: rect.w - 16, height: rect.h - 16,
      rx: Math.max(3, r - 7), ry: Math.max(3, r - 7), class: 'bz-inner' }));
    const len = Math.min(64, rect.w / 3.2, rect.h / 3.2);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (sg) {
      const cx = sg[0] > 0 ? rect.x - 4 : rect.x + rect.w + 4;
      const cy = sg[1] > 0 ? rect.y - 4 : rect.y + rect.h + 4;
      g.appendChild(svgEl('path', { class: 'bz-corner', d: corner(len),
        transform: 'translate(' + cx + ' ' + cy + ') scale(' + sg[0] + ' ' + sg[1] + ')' }));
    });
    return g;
  }
  // The leader's niche: a pointed arch (the side's "throne"), opening toward the centre line.
  function arch(rect, side) {
    const g = svgEl('g', { class: 'bz bz-slot bz-arch' });
    const x = rect.x, y = rect.y, w = rect.w, h = rect.h, peak = 70;
    const d = 'M' + x + ' ' + (y + h) + ' V' + (y + peak) + ' Q' + x + ' ' + (y + 18) + ' ' + (x + w / 2) + ' ' + y +
      ' Q' + (x + w) + ' ' + (y + 18) + ' ' + (x + w) + ' ' + (y + peak) + ' V' + (y + h) + ' Z';
    g.appendChild(svgEl('path', { d: d, class: 'bz-fill' }));
    g.appendChild(svgEl('path', { d: d, class: 'bz-line' }));
    const i = 9;
    const d2 = 'M' + (x + i) + ' ' + (y + h - i) + ' V' + (y + peak + 4) + ' Q' + (x + i) + ' ' + (y + 26) + ' ' + (x + w / 2) + ' ' + (y + i + 2) +
      ' Q' + (x + w - i) + ' ' + (y + 26) + ' ' + (x + w - i) + ' ' + (y + peak + 4) + ' V' + (y + h - i) + ' Z';
    g.appendChild(svgEl('path', { d: d2, class: 'bz-inner' }));
    if (side === 'theirs') g.setAttribute('transform', 'rotate(180 ' + (x + w / 2) + ' ' + (y + h / 2) + ')');
    return g;
  }

  function artLayer(rect, id, radius) {
    const g = svgEl('g', { class: 'bz-artlayer' });
    const clipId = 'bz-clip-' + id;
    const cp = svgEl('clipPath', { id: clipId });
    cp.appendChild(svgEl('rect', { x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: radius, ry: radius }));
    g.appendChild(cp);
    g.appendChild(svgEl('image', { id: id, x: rect.x, y: rect.y, width: rect.w, height: rect.h,
      preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#' + clipId + ')', class: 'bz-zone-art' }));
    return g;
  }
  function label(text, x, y, cls) {
    const t = svgEl('text', { x: x, y: y, class: 'bz-label ' + (cls || ''), 'text-anchor': 'middle' });
    t.textContent = String(text).toUpperCase();
    return t;
  }
  function grad(d, id, kind, attrs, stops) {
    const gr = svgEl(kind, Object.assign({ id: id }, attrs));
    stops.forEach(function (st) {
      const o = svgEl('stop', { offset: st[0], 'stop-color': st[1] });
      if (st[2] != null) o.setAttribute('stop-opacity', st[2]);
      gr.appendChild(o);
    });
    d.appendChild(gr);
  }

  function defs() {
    const d = svgEl('defs', {});
    // Obsidian grain: a tile of faint hairline cracks and specks. A pattern costs a few nodes
    // whatever size the board renders at.
    const p = svgEl('pattern', { id: 'bz-grain', width: 240, height: 240, patternUnits: 'userSpaceOnUse' });
    const rnd = U.rand('board-grain');
    for (let i = 0; i < 14; i++) {
      let x = rnd() * 240, y = rnd() * 240, path = 'M' + x.toFixed(1) + ' ' + y.toFixed(1);
      for (let k = 0; k < 3; k++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; path += ' L' + x.toFixed(1) + ' ' + y.toFixed(1); }
      p.appendChild(svgEl('path', { d: path, class: 'bz-crack' }));
    }
    for (let i = 0; i < 30; i++) {
      p.appendChild(svgEl('circle', { cx: (rnd() * 240).toFixed(1), cy: (rnd() * 240).toFixed(1), r: (0.5 + rnd() * 1.3).toFixed(2), class: 'bz-speck', opacity: (0.15 + rnd() * 0.4).toFixed(2) }));
    }
    d.appendChild(p);
    [['bz-glow', 12], ['bz-glow-soft', 5]].forEach(function (g) {
      const f = svgEl('filter', { id: g[0], x: '-40%', y: '-40%', width: '180%', height: '180%' });
      f.appendChild(svgEl('feGaussianBlur', { stdDeviation: g[1], result: 'b' }));
      const m = svgEl('feMerge', {});
      m.appendChild(svgEl('feMergeNode', { in: 'b' }));
      m.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
      f.appendChild(m);
      d.appendChild(f);
    });
    grad(d, 'bz-slab', 'radialGradient', { cx: '50%', cy: '50%', r: '78%' },
      [['0%', '#221a2c'], ['55%', '#140f1c'], ['100%', '#07050b']]);
    grad(d, 'bz-iron', 'linearGradient', { x1: '0', y1: '0', x2: '1', y2: '1' },
      [['0%', '#2a2430'], ['50%', '#120e17'], ['100%', '#2a2430']]);
    grad(d, 'bz-silver', 'linearGradient', { x1: '0', y1: '0', x2: '1', y2: '1' },
      [['0%', '#f4f1ea'], ['35%', '#b9b2a4'], ['70%', '#6d6659'], ['100%', '#d9d2c2']]);
    grad(d, 'bz-zone', 'radialGradient', { cx: '50%', cy: '50%', r: '70%' },
      [['0%', '#2a2034', 0.42], ['100%', '#0b0810', 0.62]]);
    grad(d, 'bz-ember-a', 'radialGradient', { cx: '50%', cy: '50%', r: '50%' },
      [['0%', '#b5482c', 0.22], ['100%', '#b5482c', 0]]);
    grad(d, 'bz-ember-b', 'radialGradient', { cx: '50%', cy: '50%', r: '50%' },
      [['0%', '#6a4cc8', 0.2], ['100%', '#6a4cc8', 0]]);
    grad(d, 'bz-seam', 'linearGradient', { x1: '0', y1: '0', x2: '1', y2: '0' },
      [['0%', '#d7c08a', 0], ['20%', '#d7c08a', 0.75], ['50%', '#fff4d6', 1], ['80%', '#a99ad8', 0.75], ['100%', '#a99ad8', 0]]);
    return d;
  }

  // The rune circle across the middle of the table: two rings, tick marks and a sigil. It is
  // the arena; the two fields sit inside its upper and lower arcs.
  function runeCircle() {
    const g = svgEl('g', { class: 'bz-rune' });
    const cx = W / 2, cy = H / 2;
    g.appendChild(svgEl('circle', { cx: cx, cy: cy, r: 420, class: 'bz-rune-ring' }));
    g.appendChild(svgEl('circle', { cx: cx, cy: cy, r: 388, class: 'bz-rune-ring is-thin' }));
    let ticks = '';
    for (let i = 0; i < 72; i++) {
      const a = i * Math.PI * 2 / 72, r1 = 392, r2 = i % 6 === 0 ? 418 : 406;
      ticks += 'M' + (cx + Math.cos(a) * r1).toFixed(1) + ' ' + (cy + Math.sin(a) * r1).toFixed(1) + ' L' + (cx + Math.cos(a) * r2).toFixed(1) + ' ' + (cy + Math.sin(a) * r2).toFixed(1) + ' ';
    }
    g.appendChild(svgEl('path', { d: ticks, class: 'bz-rune-ticks' }));
    const spin = svgEl('g', { class: 'bz-rune-spin' });
    let star = '';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 * 3 / 7;
      star += (i ? ' L' : 'M') + (cx + Math.cos(a) * 360).toFixed(1) + ' ' + (cy + Math.sin(a) * 360).toFixed(1);
    }
    spin.appendChild(svgEl('path', { d: star + ' Z', class: 'bz-rune-star' }));
    g.appendChild(spin);
    return g;
  }

  function build() {
    const svg = svgEl('svg', { id: 'board-svg', viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(defs());
    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, rx: 30, class: 'bz-table' }));
    svg.appendChild(svgEl('rect', { x: 10, y: 10, width: W - 20, height: H - 20, rx: 24, class: 'bz-rule' }));
    const P = 24;
    svg.appendChild(svgEl('rect', { x: P, y: P, width: W - P * 2, height: H - P * 2, rx: 16, class: 'bz-panel' }));
    // The painted scene, very low: a place, not a picture competing with cards.
    svg.appendChild(artLayer({ x: P, y: P, w: W - P * 2, h: H - P * 2 }, 'board-art', 16));
    svg.appendChild(svgEl('ellipse', { cx: 1500, cy: 330, rx: 640, ry: 340, fill: 'url(#bz-ember-b)' }));
    svg.appendChild(svgEl('ellipse', { cx: 560, cy: 950, rx: 640, ry: 360, fill: 'url(#bz-ember-a)' }));
    svg.appendChild(svgEl('rect', { x: P, y: P, width: W - P * 2, height: H - P * 2, rx: 16, class: 'bz-grain-fill' }));
    svg.appendChild(svgEl('rect', { x: P, y: P, width: W - P * 2, height: H - P * 2, rx: 16, class: 'bz-rule-inner' }));
    svg.appendChild(runeCircle());
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (sg) {
      svg.appendChild(svgEl('path', { class: 'bz-corner bz-cover-corner', d: corner(120),
        transform: 'translate(' + (sg[0] > 0 ? P - 8 : W - P + 8) + ' ' + (sg[1] > 0 ? P - 8 : H - P + 8) + ') scale(' + sg[0] + ' ' + sg[1] + ')' }));
    });
    // The centre line: a forged bar with a sigil where the halves meet, warm at your end and
    // cool at theirs, so it reads as the middle of the table.
    const seam = svgEl('g', { class: 'bz-seam-g' });
    seam.appendChild(svgEl('rect', { x: 200, y: H / 2 - 2, width: W - 400, height: 4, rx: 2, fill: 'url(#bz-seam)' }));
    seam.appendChild(svgEl('path', { class: 'bz-seam-sigil', d: 'M' + (W / 2) + ' ' + (H / 2 - 30) + ' L' + (W / 2 + 22) + ' ' + (H / 2) + ' L' + (W / 2) + ' ' + (H / 2 + 30) + ' L' + (W / 2 - 22) + ' ' + (H / 2) + ' Z', filter: 'url(#bz-glow-soft)' }));
    seam.appendChild(svgEl('circle', { cx: W / 2, cy: H / 2, r: 7, class: 'bz-seam-core' }));
    svg.appendChild(seam);

    [['mine', MINE], ['theirs', THEIRS]].forEach(function (pair) {
      const side = pair[0], R = pair[1];
      const g = svgEl('g', { class: 'bz-row bz-row-' + side });
      g.appendChild(artLayer(R.field, 'field-art-' + side, 14));
      g.appendChild(frame(R.field, 'bz-slot bz-field', 14));
      g.appendChild(frame(R.ex, 'bz-slot bz-ex', 12));
      g.appendChild(frame(R.deck, 'bz-slot', 12));
      g.appendChild(frame(R.evo, 'bz-slot bz-evo', 12));
      g.appendChild(frame(R.cemetery, 'bz-slot', 12));
      g.appendChild(frame(R.banished, 'bz-slot bz-banished', 12));
      g.appendChild(frame(R.points, 'bz-slot bz-points', 12));
      g.appendChild(arch(R.leader, side));
      // Watermarks in the lanes (visible while a lane is empty), upright for the viewer.
      [['field', 60], ['ex', 44]].forEach(function (z) {
        const r = R[z[0]];
        const t = label(LABELS[z[0]], r.x + r.w / 2, r.y + r.h / 2 + z[1] * 0.35, 'bz-watermark');
        t.style.fontSize = z[1] + 'px';
        g.appendChild(t);
      });
      // Pile captions ride in the gap between the rows (a card covers the slot).
      ['deck', 'evo', 'cemetery', 'banished'].forEach(function (k) {
        const r = R[k];
        const inner = k === 'deck' || k === 'evo';
        // Inner piles caption on the centre-line side, outer piles in the gap between the rows,
        // so no two captions share a line.
        const y = side === 'mine' ? r.y - 6 : r.y + r.h + 19;
        g.appendChild(label(LABELS[k], r.x + r.w / 2, y, 'bz-caption'));
      });
      svg.appendChild(g);
    });
    return svg;
  }

  // ---- scenery: rolled per game, never the same as last game ----------------------------
  let lastScene = null;
  function sceneUrls() {
    // Every ui art entry named board-* (board-1 ... board-4).
    return Object.keys(SV.ART.ui).filter(function (k) { return k.indexOf('board-') === 0; }).sort()
      .map(function (k) { return SV.ART.ui[k]; });
  }

  const ZONES = ['leader', 'field', 'deck', 'evo', 'ex', 'cemetery', 'banished', 'points'];
  SV.boardArt = {
    ZONES: ZONES,
    init: function (mat) {
      if (mat.querySelector('#board-svg')) return;
      mat.insertBefore(build(), mat.firstChild);
      ['mine', 'theirs'].forEach(function (side) {
        const prefix = side === 'mine' ? 'my-' : 'enemy-';
        ZONES.forEach(function (k) {
          const node = U.$(prefix + k);
          if (!node) throw new Error('index.html is missing zone #' + prefix + k);
          const r = SV.boardLayout[side][k];
          node.style.left = pct(r.x, W); node.style.top = pct(r.y, H);
          node.style.width = pct(r.w, W); node.style.height = pct(r.h, H);
        });
      });
      this.rollScenes();
    },
    rollScenes: function () {
      const urls = sceneUrls();
      const set = function (id, href) {
        const n = document.getElementById(id);
        if (!n) return;
        if (href) n.setAttribute('href', href); else n.removeAttribute('href');
      };
      if (!urls.length) { set('board-art', null); set('field-art-mine', null); set('field-art-theirs', null); return; }
      let i = Math.floor(Math.random() * urls.length);
      if (urls.length > 1 && urls[i] === lastScene) i = (i + 1) % urls.length;
      lastScene = urls[i];
      set('board-art', urls[i]);
      const a = (i + 1) % urls.length, b = (i + 2) % urls.length;
      set('field-art-mine', urls[a]);
      set('field-art-theirs', urls[urls.length > 2 ? b : a]);
    },
  };
})();
