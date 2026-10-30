// js/ui/cardview.js — THE card renderer (PRESENTATION-REFERENCE A3): one function, three sizes
// (board / hand / preview). Art is the card: the illustration fills the face and the text
// floats on a measured scrim. The only content difference between sizes is the printed text,
// shown verbatim at preview size with every [token] drawn as an original glyph. Every live
// number comes from the engine (SV.chars / SV.costToPlay), never the client.
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;
  const el = U.el;

  // ---- art cache: one decoded prototype per file, cloned per render ----------------------
  // A fresh <img> paints a frame late and the whole board flickers on every redraw; a clone
  // of an already-decoded image paints in the same frame (A3 "Art loading").
  const artProtos = {};   // cardNo -> HTMLImageElement | 'failed'
  const svgProtos = {};   // cardNo -> SVG prototype

  // The ONLY place a card-art path is resolved. A card with no manifest entry is a normal
  // state while art is being generated (procedural art); a missing MANIFEST is a broken
  // build, and main.js throws for that before anything renders.
  SV.artUrl = function (cardNo) { return SV.ART.cards[cardNo] || null; };
  SV.uiArtUrl = function (name) { return SV.ART.ui[name] || null; };

  function paintedProto(cardNo, url) {
    if (artProtos[cardNo]) return artProtos[cardNo];
    const proto = new Image();
    proto.className = 'art art-painted';
    proto.alt = '';
    proto.draggable = false;               // load-bearing: native image drag cancels pointer drags
    proto.setAttribute('aria-hidden', 'true');
    proto.decoding = 'sync';               // NOT lazy/async: those defer paint past the clone frame
    proto.src = url;
    artProtos[cardNo] = proto;
    return proto;
  }

  // The card back: drawn, never an official back. A dark field, a silver double frame and a
  // forge sigil (an anvil-star) in the middle.
  let backSvg = null;
  function cardBack() {
    if (!backSvg) {
      backSvg = U.svgEl('svg', { viewBox: '0 0 50 70', class: 'art card-back-art', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid slice' });
      backSvg.innerHTML = '<defs><radialGradient id="cb-g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#3a1f4e"/>' +
        '<stop offset=".6" stop-color="#1a0f26"/><stop offset="1" stop-color="#0a060f"/></radialGradient>' +
        '<pattern id="cb-p" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 3 H6" stroke="#ffffff" stroke-opacity=".05" stroke-width="1"/></pattern></defs>' +
        '<rect width="50" height="70" fill="url(#cb-g)"/><rect width="50" height="70" fill="url(#cb-p)"/>' +
        '<rect x="3" y="3" width="44" height="64" rx="3" fill="none" stroke="#b9c2d6" stroke-opacity=".55" stroke-width=".8"/>' +
        '<rect x="5.5" y="5.5" width="39" height="59" rx="2" fill="none" stroke="#b9c2d6" stroke-opacity=".25" stroke-width=".5"/>' +
        '<path d="M25 18 L28.6 30.4 L41 35 L28.6 39.6 L25 52 L21.4 39.6 L9 35 L21.4 30.4 Z" fill="#d8c48a" fill-opacity=".75"/>' +
        '<circle cx="25" cy="35" r="5" fill="#1a0f26" stroke="#e8d9a8" stroke-width=".8"/><circle cx="25" cy="35" r="2" fill="#ff8a5c"/>';
    }
    return backSvg.cloneNode(true);
  }

  // Type glyphs for the procedural art: drawn here, larger than the inline text glyphs.
  const TYPE_ART = {
    follower: '<path d="M25 16 L28.6 21 L28.6 39 L21.4 39 L21.4 21 Z"/><rect x="15" y="39" width="20" height="3.6" rx="1.2"/><rect x="23.2" y="42.6" width="3.6" height="6"/><circle cx="25" cy="50.6" r="2.4"/>',
    spell: '<circle cx="25" cy="33" r="13" fill="none" stroke-width="2.2"/><path d="M25 20 L28 30 L38 33 L28 36 L25 46 L22 36 L12 33 L22 30 Z"/>',
    amulet: '<circle cx="25" cy="21" r="3.2" fill="none" stroke-width="1.8"/><path d="M25 24.5 L35 34 L25 49 L15 34 Z"/><circle cx="25" cy="35" r="3.6" fill="#0b0712"/>',
    leader: '<path d="M12 42 L14 24 L20 32 L25 20 L30 32 L36 24 L38 42 Z"/><rect x="12" y="43.5" width="26" height="3.4" rx="1"/>',
    crest: '<path d="M25 17 L37 21.4 L36 33 Q34 43 25 49 Q16 43 14 33 L13 21.4 Z"/><path d="M25 23 L28 31 L25 41 L22 31 Z" fill="#0b0712"/>',
    equipment: '<path d="M16 22 H34 V30 Q34 42 25 48 Q16 42 16 30 Z"/><path d="M20 26 H30" stroke="#0b0712" stroke-width="2"/>',
  };

  // Procedural art: the card's class colour field, a seeded pattern of light, the type glyph
  // and the name engraved across the top. Consistent across runs, distinct between
  // neighbours, deliberately a design rather than a hole.
  function svgFallback(cardNo) {
    if (svgProtos[cardNo]) return svgProtos[cardNo].cloneNode(true);
    const rand = U.rand('art|' + cardNo);
    const d = SV.CARDS[cardNo];
    const cl = U.classOf(d.cls);
    const t = SV.parsed(d).type;
    const hue = (cl.hue + Math.floor(rand() * 24) - 12 + 360) % 360;
    const sat = d.cls === 'neutral' || d.cls === 'havencraft' ? 18 : 48;
    const svg = U.svgEl('svg', { viewBox: '0 0 50 70', class: 'art art-fallback', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid slice' });
    const gid = 'fg' + Math.floor(rand() * 1e9);
    let inner = '<defs><radialGradient id="' + gid + '" cx="50%" cy="38%" r="75%">' +
      '<stop offset="0" stop-color="hsl(' + hue + ',' + sat + '%,40%)"/>' +
      '<stop offset=".55" stop-color="hsl(' + ((hue + 12) % 360) + ',' + (sat - 6) + '%,20%)"/>' +
      '<stop offset="1" stop-color="hsl(' + ((hue + 24) % 360) + ',' + Math.max(8, sat - 20) + '%,7%)"/></radialGradient></defs>' +
      '<rect width="50" height="70" fill="url(#' + gid + ')"/>';
    // rays of light from behind the glyph
    const rays = 7 + Math.floor(rand() * 5), rot = rand() * 360;
    for (let i = 0; i < rays; i++) {
      const a = (rot + i * 360 / rays) * Math.PI / 180, w = 0.08 + rand() * 0.08;
      const x1 = 25 + Math.cos(a - w) * 60, y1 = 33 + Math.sin(a - w) * 60, x2 = 25 + Math.cos(a + w) * 60, y2 = 33 + Math.sin(a + w) * 60;
      inner += '<path d="M25 33 L' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' L' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' Z" fill="hsl(' + hue + ',70%,80%)" opacity="' + (0.04 + rand() * 0.06).toFixed(2) + '"/>';
    }
    for (let i = 0; i < 9; i++) {
      inner += '<circle cx="' + (rand() * 50).toFixed(1) + '" cy="' + (rand() * 58).toFixed(1) + '" r="' + (0.3 + rand() * 0.9).toFixed(2) +
        '" fill="hsl(' + hue + ',80%,88%)" opacity="' + (0.25 + rand() * 0.5).toFixed(2) + '"/>';
    }
    inner += '<circle cx="25" cy="33" r="15.5" fill="none" stroke="hsl(' + hue + ',60%,75%)" stroke-opacity=".28" stroke-width=".6"/>';
    inner += '<g fill="hsl(' + hue + ',55%,84%)" stroke="hsl(' + hue + ',55%,84%)" opacity=".82">' + TYPE_ART[t] + '</g>';
    svg.innerHTML = inner;
    // The name, engraved: an SVG text node, so any card name is set safely.
    const name = U.svgEl('text', { x: 25, y: 12.4, 'text-anchor': 'middle', class: 'art-name' });
    name.textContent = d.name.length > 26 ? d.name.slice(0, 25) + '…' : d.name;
    name.setAttribute('textLength', String(Math.min(42, d.name.length * 1.7)));
    name.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    svg.appendChild(name);
    svgProtos[cardNo] = svg;
    return svg.cloneNode(true);
  }

  // ---- keywords, in our own words (never the printed reminder text) ----------------------
  const KW_HELP = {
    Ward: 'While an enemy follower could attack an engaged follower with Ward, it must attack one of those. Ward followers may enter the field engaged, and may be engaged at the end of their controller’s turn.',
    Storm: 'Can attack the turn it is put onto the field, including the enemy leader.',
    Rush: 'Can attack enemy followers the turn it is put onto the field (not the leader).',
    Bane: 'When it fights a follower, that follower is destroyed afterwards — no damage needed.',
    Drain: 'When it deals attack damage, its controller’s leader gains that much defense.',
    Assail: 'Can attack reserved (upright) enemy followers too, not only engaged ones.',
    Intimidate: 'Can’t be attacked.',
    Aura: 'Can’t be selected by the opponent’s cards and abilities.',
    Quick: 'Can be played or used during the opponent’s turn: after they declare an attack, or in their end phase.',
    Fanfare: 'Happens when this card is put onto the field from somewhere else.',
    'Last Words': 'Happens when this card goes from the field to the cemetery.',
    Evolve: 'Once per turn you may evolve one follower: pay the cost (you may spend 1 evolution point in place of 1 play point) and put the matching evolved card from your evolve deck on top of it.',
    'Super-Evolve': 'From your 7th turn (6th if you went second), evolving can also spend your one super-evolution point: +1/+1 and its On Super-Evolve abilities.',
    'On Evolve': 'Happens when this follower evolves.',
    Engage: 'Turn the card sideways. Engaged followers can’t attack, and enemy followers can attack them.',
    Act: 'An activated ability: you choose to use it by paying its cost.',
    Strike: 'Happens when this follower attacks.',
    'Leader Strike': 'Happens when this follower attacks a leader.',
    'Follower Strike': 'Happens when this follower attacks a follower.',
    Overflow: 'Active while you have 7 or more maximum play points.',
    Sanguine: 'Active during your turn once your leader has taken damage this turn.',
    Combo: 'Counts the cards you have played this turn.',
    Spellchain: 'Counts the spells in your cemetery.',
    Necrocharge: 'Counts the cards in your cemetery.',
    Stack: 'Stack counters: when this would leave the field, it loses a counter instead; with none left it goes to the cemetery.',
    Fuse: 'Discard the named cards from your hand (or bury them from your EX area) to put this into your EX area.',
    Crest: 'A token that lives in the EX area. It is never played; its abilities work from there.',
    'Union Burst': 'A Princess Connect universe mark on an ability.',
  };
  SV.U.KW_HELP = KW_HELP;
  const TOKEN_KW = { fanfare: 'Fanfare', lastwords: 'Last Words', evolve: 'Evolve', engage: 'Engage', act: 'Act', quick: 'Quick', q: 'Quick', UB: 'Union Burst' };

  // The glossary walks the WHOLE printed text (so a card that grants Ward still explains it)
  // plus the keywords this instance has right now.
  SV.cardGlossary = function (cardNo, liveKw) {
    const d = SV.CARDS[cardNo];
    const found = [];
    const add = function (k) { if (KW_HELP[k] && found.indexOf(k) < 0) found.push(k); };
    Object.keys(liveKw || {}).forEach(function (k) { if (liveKw[k]) add(k); });
    const text = d.text || '';
    for (const m of text.matchAll(/\[([A-Za-z]+)\]/g)) if (TOKEN_KW[m[1]]) add(TOKEN_KW[m[1]]);
    Object.keys(KW_HELP).forEach(function (k) {
      if (TOKEN_KW[k]) return;
      if (new RegExp('\\b' + k.replace(/[-]/g, '\\-') + '\\b', 'i').test(text)) add(k);
    });
    if (/super-evol/i.test(text)) add('Super-Evolve');
    if (SV.parsed(d).type === 'crest') add('Crest');
    return found.map(function (k) { return { name: k, text: KW_HELP[k] }; });
  };

  // ---- who may see a card -------------------------------------------------------------------
  // viewer: a seat, or 'all' (spectating). Deck order and the other seat's hand are hidden; an
  // evolve deck's facedown cards are visible to their owner only (CR 4.6.2).
  SV.canSee = function (state, iid, viewer) {
    const c = state.cards[iid];
    if (!c) return false;
    if (state.phase === 'over') return true;           // post-mortem: nothing left to protect
    if (viewer === 'all') return c.zone !== 'deck';     // a spectator sees both hands, never deck order
    if (c.zone === 'deck') return false;
    if (c.zone === 'hand') {
      if (c.owner === viewer) return true;
      const rev = state.revealed && state.revealed[c.owner];
      return !!(rev && rev.indexOf(iid) >= 0);
    }
    if (c.zone === 'evoDeck') return c.faceup || c.owner === viewer;
    return true;
  };

  // ---- the renderer ----------------------------------------------------------------------------
  // ref: an instance id present in opts.state.cards, or a card number.
  // opts: {size:'board'|'hand'|'preview', state?, hidden?}
  function liveZone(inst) { return inst && (inst.zone === 'field' || inst.zone === 'ex' || inst.zone === 'leader'); }

  SV.renderCard = function (ref, opts) {
    opts = opts || {};
    const size = opts.size || 'board';
    const state = opts.state || null;
    const inst = (state && state.cards && state.cards[ref]) ? state.cards[ref] : null;
    const root = el('div', 'card card-' + size);
    if (opts.hidden) {
      // Face-down: no data-card-id, so the document-level hover preview ignores it.
      root.classList.add('card-back');
      root.appendChild(cardBack());
      return root;
    }
    const faceNo = inst ? (inst.evo ? state.cards[inst.evo].id : inst.id) : ref;
    const d = SV.CARDS[faceNo];
    if (!d) {                      // defensive render: never throw out of a board redraw
      root.classList.add('card-missing');
      root.appendChild(el('div', 'card-name', '—'));
      return root;
    }
    const type = SV.parsed(d).type;
    root.dataset.cardId = faceNo;
    if (inst) root.dataset.iid = inst.iid;
    root.classList.add('type-' + type, 'cls-' + d.cls);
    if (d.evolved || (inst && inst.evo)) root.classList.add('is-evolved');
    if (d.token) root.classList.add('is-token');
    const live = liveZone(inst) ? SV.chars(state, inst.iid) : null;

    // Layer 0: art + scrim (::after in CSS).
    const artWrap = el('div', 'card-art');
    const url = SV.artUrl(faceNo);
    const failed = !url || artProtos[faceNo] === 'failed';
    const img = failed ? null : paintedProto(faceNo, url).cloneNode(false);
    if (img) {
      img.onerror = function () {
        artProtos[faceNo] = 'failed';
        if (img.parentNode) img.parentNode.replaceChild(svgFallback(faceNo), img);
      };
    }
    artWrap.appendChild(img || svgFallback(faceNo));
    root.appendChild(artWrap);

    // Layer 3: corners — the play-point cost jewel and the class emblem.
    const corners = el('div', 'card-corners');
    if (type === 'follower' || type === 'amulet' || type === 'spell') {
      const base = inst ? SV.CARDS[inst.id] : d;
      let cost = base.cost, cls = '';
      if (inst && state && (inst.zone === 'hand' || inst.zone === 'ex') && !d.evolved) {
        const now = SV.costToPlay(state, inst.iid);
        if (base.cost != null && now < base.cost) cls = 'is-cheaper';
        else if (base.cost != null && now > base.cost) cls = 'is-dearer';
        cost = now;
      }
      if (cost != null) {
        const gem = U.costGem(cost, d.cls, cls);
        gem.setAttribute('data-tip', 'Costs ' + cost + ' play point' + (cost === 1 ? '' : 's') + (cls ? ' right now (printed ' + base.cost + ')' : ''));
        corners.appendChild(gem);
      } else {
        const ev = el('span', 'evo-mark');
        ev.innerHTML = U.glyphSVG('evolve');
        ev.setAttribute('data-tip', d.advanced ? 'Advanced card (lives in the evolve deck)' : 'Evolved card: goes on top of its follower when it evolves');
        corners.appendChild(ev);
      }
    } else corners.appendChild(el('span'));
    const emb = U.glyph(d.cls);
    emb.classList.add('cls-emblem');
    corners.appendChild(emb);
    root.appendChild(corners);

    // Layer 2: the text plate (in flow, hugs the bottom, grows upward).
    const plate = el('div', 'card-plate');
    plate.appendChild(el('div', 'card-name', d.name));
    const typeLine = el('div', 'card-type');
    typeLine.appendChild(el('span', 'type-tag', d.typeLine));
    const traits = live ? live.traits : d.traits;
    if (traits && traits.length) typeLine.appendChild(el('span', 'traits', traits.join(' / ')));
    plate.appendChild(typeLine);

    // The face never claims a keyword the card doesn't have right now: live keywords on the
    // field and in the EX area, printed ones elsewhere.
    const kwSrc = live ? live.kw : SV.parsed(d).kw;
    const kws = Object.keys(kwSrc).filter(function (k) { return kwSrc[k]; });
    if ((live ? live.quick : SV.parsed(d).quick)) kws.push('Quick');
    if (kws.length) plate.appendChild(el('div', 'card-kw', kws.join(' · ')));

    if (size === 'preview') {
      const detail = el('div', 'card-detail');
      (d.text || '').split('\n').forEach(function (line) {
        if (/^-{3,}$/.test(line)) { detail.appendChild(el('div', 'rule-line')); return; }
        if (!line.trim()) return;
        const row = el('div', 'ability');
        U.appendText(row, line);
        detail.appendChild(row);
      });
      if (d.text) plate.appendChild(detail);
    }

    if (type === 'follower') {
      const row = el('div', 'card-stats');
      let atk = d.atk, def = d.def, maxDef = d.def, dmg = 0;
      if (live) { atk = live.atk; def = live.def; maxDef = live.maxDef; dmg = live.dmg; }
      const a = el('span', 'stat atk');
      a.appendChild(U.glyph('attack')); a.appendChild(el('span', 'n', String(atk)));
      if (d.atk != null && atk !== d.atk) a.classList.add(atk > d.atk ? 'is-up' : 'is-down');
      a.setAttribute('data-tip', 'Attack ' + atk + (d.atk != null && atk !== d.atk ? ' (printed ' + d.atk + ')' : ''));
      row.appendChild(a);
      row.appendChild(el('span', 'stat-gap'));
      const w = el('span', 'stat def' + (dmg > 0 ? ' damaged' : ''));
      w.appendChild(U.glyph('defense')); w.appendChild(el('span', 'n', String(def)));
      if (d.def != null && maxDef !== d.def && !dmg) w.classList.add(maxDef > d.def ? 'is-up' : 'is-down');
      w.setAttribute('data-tip', dmg > 0 ? def + ' defense left of ' + maxDef + ' (' + dmg + ' damage)' : 'Defense ' + def);
      row.appendChild(w);
      plate.appendChild(row);
    }
    root.appendChild(plate);

    if (inst && state && inst.zone === 'field') decorate(root, inst, state, live);
    return root;
  };

  function decorate(root, inst, state, live) {
    if (inst.engaged) root.classList.add('is-engaged');
    if (inst.superEvolved) root.classList.add('is-super');
    if (live && live.type === 'follower' && inst.enteredTurn === state.turn && !SV.canAttackWith(state, inst.iid) && state.active === inst.ctrl) root.classList.add('is-fresh');
    if (live && live.dmg > 0) {
      const m = el('div', 'damage-marker', '−' + live.dmg);
      m.setAttribute('data-tip', live.dmg + ' damage on it');
      root.appendChild(m);
    }
    const badges = [];
    Object.keys(inst.counters || {}).forEach(function (k) {
      if (inst.counters[k] > 0) badges.push({ t: k.charAt(0).toUpperCase() + k.slice(1) + ' ' + inst.counters[k], tip: inst.counters[k] + ' ' + k + ' counter' + (inst.counters[k] === 1 ? '' : 's') });
    });
    (inst.links || []).forEach(function (l) {
      const lc = state.cards[l];
      if (lc && lc.zone !== 'gone') badges.push({ t: SV.CARDS[lc.id].name, tip: 'Linked: ' + SV.CARDS[lc.id].name });
    });
    if (badges.length) {
      const b = el('div', 'counter-badges');
      badges.forEach(function (x) { const n = el('span', 'counter-badge', x.t); n.setAttribute('data-tip', x.tip); b.appendChild(n); });
      root.appendChild(b);
    }
  }
})();
