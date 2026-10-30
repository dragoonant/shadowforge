// js/ui/boardart.js — the play surface, DRAWN rather than photographed (PRESENTATION-REFERENCE
// A2), dressed as this game's own scene (PLAN D17, "the evolution rite"): a floating stone dais
// under the night sky, cut at the corners, its edge catching the moonlight; a slowly turning
// circle of light across the middle with the six class gems on its points; every zone a socket
// with cut corners and two bright notches; each leader in a gabled obelisk. ONE geometry table in
// a fixed 2048x1280 board space is used twice: to draw every slot and to place every DOM zone by
// percentage, so a drawn outline and the hitbox inside it are the same numbers by construction.
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

  // A rectangle with its four corners cut at 45 degrees: the one shape of this board.
  function cutPath(x, y, w, h, c) {
    return 'M' + (x + c) + ' ' + y + ' H' + (x + w - c) + ' L' + (x + w) + ' ' + (y + c) + ' V' + (y + h - c) +
      ' L' + (x + w - c) + ' ' + (y + h) + ' H' + (x + c) + ' L' + x + ' ' + (y + h - c) + ' V' + (y + c) + ' Z';
  }
  // A socket: the cut shape filled with night, a glowing line, a faint inner line, and two
  // bright notches centred on the long edges.
  function socket(rect, cls) {
    const g = svgEl('g', { class: 'bz ' + cls });
    const c = Math.min(22, rect.w / 7, rect.h / 7);
    g.appendChild(svgEl('path', { d: cutPath(rect.x, rect.y, rect.w, rect.h, c), class: 'bz-fill' }));
    g.appendChild(svgEl('path', { d: cutPath(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, c), class: 'bz-line' }));
    g.appendChild(svgEl('path', { d: cutPath(rect.x + 9, rect.y + 9, rect.w - 18, rect.h - 18, Math.max(4, c - 6)), class: 'bz-inner' }));
    const n = Math.min(46, rect.w / 5), mx = rect.x + rect.w / 2;
    g.appendChild(svgEl('path', { class: 'bz-notch', d: 'M' + (mx - n / 2) + ' ' + (rect.y - 3) + ' H' + (mx + n / 2) + ' M' + (mx - n / 2) + ' ' + (rect.y + rect.h + 3) + ' H' + (mx + n / 2) }));
    return g;
  }
  // The leader's obelisk: a gable pointing toward the centre line, cut corners at the base.
  function obelisk(rect, side) {
    const g = svgEl('g', { class: 'bz bz-slot bz-obelisk' });
    const x = rect.x, y = rect.y, w = rect.w, h = rect.h, peak = 64, c = 20;
    const shape = function (i) {
      return 'M' + (x + i) + ' ' + (y + peak + i * 0.4) + ' L' + (x + w / 2) + ' ' + (y + i * 1.2) + ' L' + (x + w - i) + ' ' + (y + peak + i * 0.4) +
        ' V' + (y + h - c - i * 0.4) + ' L' + (x + w - c - i * 0.4) + ' ' + (y + h - i) + ' H' + (x + c + i * 0.4) + ' L' + (x + i) + ' ' + (y + h - c - i * 0.4) + ' Z';
    };
    g.appendChild(svgEl('path', { d: shape(0), class: 'bz-fill' }));
    g.appendChild(svgEl('path', { d: shape(1), class: 'bz-line' }));
    g.appendChild(svgEl('path', { d: shape(10), class: 'bz-inner' }));
    // a small diamond at the gable's peak
    const px = x + w / 2, py = y + 34;
    g.appendChild(svgEl('path', { class: 'bz-notch', d: 'M' + px + ' ' + (py - 9) + ' L' + (px + 9) + ' ' + py + ' L' + px + ' ' + (py + 9) + ' L' + (px - 9) + ' ' + py + ' Z', fill: 'none' }));
    if (side === 'theirs') g.setAttribute('transform', 'rotate(180 ' + (x + w / 2) + ' ' + (y + h / 2) + ')');
    return g;
  }

  function artLayer(d, id) {
    const g = svgEl('g', { class: 'bz-artlayer' });
    const clipId = 'bz-clip-' + id;
    const cp = svgEl('clipPath', { id: clipId });
    cp.appendChild(svgEl('path', { d: d.path }));
    g.appendChild(cp);
    g.appendChild(svgEl('image', { id: id, x: d.x, y: d.y, width: d.w, height: d.h,
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
    // Stars over the stone: a tile of points at a few sizes. A pattern costs a few nodes
    // whatever size the board renders at.
    const p = svgEl('pattern', { id: 'bz-stars', width: 260, height: 260, patternUnits: 'userSpaceOnUse' });
    const rnd = U.rand('board-stars');
    for (let i = 0; i < 26; i++) {
      p.appendChild(svgEl('circle', { cx: (rnd() * 260).toFixed(1), cy: (rnd() * 260).toFixed(1), r: (0.5 + rnd() * 1.4).toFixed(2), class: 'bz-star', opacity: (0.08 + rnd() * 0.35).toFixed(2) }));
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
    grad(d, 'bz-night', 'radialGradient', { cx: '50%', cy: '50%', r: '75%' },
      [['0%', '#173356'], ['55%', '#0b1a31'], ['100%', '#040a15']]);
    grad(d, 'bz-moon-edge', 'linearGradient', { x1: '0', y1: '0', x2: '1', y2: '1' },
      [['0%', '#f2f9ff'], ['30%', '#7f9cbc'], ['55%', '#2c4566'], ['80%', '#9fbbd8'], ['100%', '#eef7ff']]);
    grad(d, 'bz-socket', 'radialGradient', { cx: '50%', cy: '50%', r: '70%' },
      [['0%', '#12294a', 0.45], ['100%', '#030914', 0.7]]);
    grad(d, 'bz-moonglow', 'radialGradient', { cx: '50%', cy: '50%', r: '50%' },
      [['0%', '#9fd4ff', 0.2], ['100%', '#9fd4ff', 0]]);
    grad(d, 'bz-roseglow', 'radialGradient', { cx: '50%', cy: '50%', r: '50%' },
      [['0%', '#ff6f91', 0.12], ['100%', '#ff6f91', 0]]);
    grad(d, 'bz-seam', 'linearGradient', { x1: '0', y1: '0', x2: '1', y2: '0' },
      [['0%', '#7fe6ff', 0], ['22%', '#7fe6ff', 0.7], ['50%', '#ffffff', 1], ['78%', '#ff8fab', 0.7], ['100%', '#ff8fab', 0]]);
    return d;
  }

  // The circle of light across the middle of the dais: two rings, tick marks, a hexagram whose
  // six points carry the six class gems, turning slowly. The two fields sit inside its arcs.
  function riteCircle() {
    const g = svgEl('g', { class: 'bz-rite' });
    const cx = W / 2, cy = H / 2;
    g.appendChild(svgEl('circle', { cx: cx, cy: cy, r: 440, fill: 'url(#bz-moonglow)' }));
    g.appendChild(svgEl('circle', { cx: cx, cy: cy, r: 430, class: 'bz-ring' }));
    g.appendChild(svgEl('circle', { cx: cx, cy: cy, r: 400, class: 'bz-ring is-thin' }));
    const outer = svgEl('g', { class: 'bz-spin-rev' });
    let ticks = '';
    for (let i = 0; i < 96; i++) {
      const a = i * Math.PI * 2 / 96, r1 = 404, r2 = i % 8 === 0 ? 428 : 414;
      ticks += 'M' + (cx + Math.cos(a) * r1).toFixed(1) + ' ' + (cy + Math.sin(a) * r1).toFixed(1) + ' L' + (cx + Math.cos(a) * r2).toFixed(1) + ' ' + (cy + Math.sin(a) * r2).toFixed(1) + ' ';
    }
    outer.appendChild(svgEl('path', { d: ticks, class: 'bz-ticks' }));
    g.appendChild(outer);
    const spin = svgEl('g', { class: 'bz-spin' });
    const R = 372;
    const tri = function (off) {
      let s = '';
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + off + i * Math.PI * 2 / 3;
        s += (i ? ' L' : 'M') + (cx + Math.cos(a) * R).toFixed(1) + ' ' + (cy + Math.sin(a) * R).toFixed(1);
      }
      return s + ' Z';
    };
    spin.appendChild(svgEl('path', { d: tri(0) + ' ' + tri(Math.PI / 3), class: 'bz-hex' }));
    spin.appendChild(svgEl('circle', { cx: cx, cy: cy, r: R * 0.5, class: 'bz-ring is-thin' }));
    ['forestcraft', 'swordcraft', 'runecraft', 'dragoncraft', 'abysscraft', 'havencraft'].forEach(function (k, i) {
      const a = -Math.PI / 2 + i * Math.PI / 3, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, s = 13;
      spin.appendChild(svgEl('path', { class: 'bz-gem', fill: U.CLASS[k].dot, filter: 'url(#bz-glow-soft)',
        d: 'M' + x + ' ' + (y - s) + ' L' + (x + s) + ' ' + y + ' L' + x + ' ' + (y + s) + ' L' + (x - s) + ' ' + y + ' Z' }));
    });
    g.appendChild(spin);
    return g;
  }

  function build() {
    const svg = svgEl('svg', { id: 'board-svg', viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(defs());
    const C = 64, P = 14;
    const slab = cutPath(0, 0, W, H, C);
    const inner = cutPath(P, P, W - P * 2, H - P * 2, C - 6);
    svg.appendChild(svgEl('path', { d: slab, class: 'bz-slab' }));
    // The painted sky, very low: a place, not a picture competing with cards.
    svg.appendChild(artLayer({ path: inner, x: P, y: P, w: W - P * 2, h: H - P * 2 }, 'board-art'));
    svg.appendChild(svgEl('ellipse', { cx: 600, cy: 960, rx: 700, ry: 360, fill: 'url(#bz-moonglow)' }));
    svg.appendChild(svgEl('ellipse', { cx: 1450, cy: 320, rx: 700, ry: 360, fill: 'url(#bz-roseglow)' }));
    svg.appendChild(svgEl('path', { d: inner, class: 'bz-starfill' }));
    svg.appendChild(svgEl('path', { d: slab, class: 'bz-edge' }));
    svg.appendChild(svgEl('path', { d: inner, class: 'bz-edge-inner' }));
    svg.appendChild(riteCircle());
    // The centre line: a drawn line of light, cyan at your end and rose at theirs, with an
    // open diamond where the halves meet.
    const seam = svgEl('g', { class: 'bz-seam-g' });
    seam.appendChild(svgEl('rect', { x: 160, y: H / 2 - 1.5, width: W - 320, height: 3, fill: 'url(#bz-seam)', class: 'bz-seam-line' }));
    seam.appendChild(svgEl('path', { class: 'bz-seam-sigil', filter: 'url(#bz-glow-soft)', d: 'M' + (W / 2) + ' ' + (H / 2 - 26) + ' L' + (W / 2 + 26) + ' ' + (H / 2) + ' L' + (W / 2) + ' ' + (H / 2 + 26) + ' L' + (W / 2 - 26) + ' ' + (H / 2) + ' Z' }));
    seam.appendChild(svgEl('circle', { cx: W / 2, cy: H / 2, r: 5, class: 'bz-seam-core' }));
    svg.appendChild(seam);

    [['mine', MINE], ['theirs', THEIRS]].forEach(function (pair) {
      const side = pair[0], R = pair[1];
      const g = svgEl('g', { class: 'bz-row bz-row-' + side });
      const f = R.field;
      g.appendChild(artLayer({ path: cutPath(f.x, f.y, f.w, f.h, 22), x: f.x, y: f.y, w: f.w, h: f.h }, 'field-art-' + side));
      g.appendChild(socket(R.field, 'bz-slot bz-field'));
      g.appendChild(socket(R.ex, 'bz-slot bz-ex'));
      g.appendChild(socket(R.deck, 'bz-slot'));
      g.appendChild(socket(R.evo, 'bz-slot bz-evo'));
      g.appendChild(socket(R.cemetery, 'bz-slot'));
      g.appendChild(socket(R.banished, 'bz-slot bz-banished'));
      g.appendChild(socket(R.points, 'bz-slot bz-points'));
      g.appendChild(obelisk(R.leader, side));
      // Watermarks in the lanes (visible while a lane is empty), upright for the viewer.
      [['field', 56], ['ex', 40]].forEach(function (z) {
        const r = R[z[0]];
        const t = label(LABELS[z[0]], r.x + r.w / 2, r.y + r.h / 2 + z[1] * 0.35, 'bz-watermark');
        t.style.fontSize = z[1] + 'px';
        g.appendChild(t);
      });
      // Pile captions ride in the gap between the rows (a card covers the slot), so no two
      // captions share a line.
      ['deck', 'evo', 'cemetery', 'banished'].forEach(function (k) {
        const r = R[k];
        const y = side === 'mine' ? r.y - 8 : r.y + r.h + 21;
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
    cutPath: cutPath,
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
