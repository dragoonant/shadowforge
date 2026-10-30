// js/ui/sound.js — every audio decision (PRESENTATION-REFERENCE A9), ported from lorecannae.
//
//  * SFX ride the structured log: an entry's `sound` tag, else a mapping from its type. One
//    clip per tag per action; frequent tags are rate-limited. Tags the animation owns (attack,
//    hit, destroy, evolve, heal...) are voiced by js/ui/anim.js at the moment of the picture.
//  * ONE AudioContext for everything, plus the iPadOS survival kit (silent looping media
//    element held from a gesture, unlock on any gesture, wake on every state change, rebuild a
//    context parked for good).
//  * Music: menu track on the title screens; in a match three tiers keyed to the LOWEST leader
//    defense on the table (>12 / >6 / <=6) — tension rises as a leader falls; victory/defeat.
//  * A clip missing from SV.AUDIO is never silence: each tag has a procedural Web Audio voice
//    (forged steel, low drums, bright chimes). A missing SV.AUDIO MODULE is a broken build
//    (main.js throws).
//
// Ids looked up in SV.AUDIO (data/audio-manifest.js):
//   sfx:   reached from UI tags through CLIP below (card-play, spell-cast, evolve, damage, ...)
//   music: menu, battle-1, battle-2, battle-3, victory, defeat  (see MUSIC_IDS)
(function () {
  'use strict';
  const SV = globalThis.SV;
  const U = SV.U;

  const TYPE_TAG = { play: 'play', evolve: 'evolve', attack: 'attack', damage: 'hit', destroy: 'destroy',
    bury: 'banish', banish: 'banish', leave: 'banish', heal: 'heal', draw: 'draw', shuffle: 'shuffle', engage: 'engage',
    wardEngage: 'engage', refresh: 'ready', ability: 'ability', turn: 'turn', discard: 'discard', fizzle: 'fizzle',
    noRoom: 'fizzle', reveal: 'reveal', win: 'win', toHand: 'draw', return: 'draw', toEx: 'draw', mulligan: 'mulligan',
    token: 'summon', summon: 'summon', pass: 'pass', buff: 'buff', counter: 'tick', recover: 'pp', maxPP: 'pp', ep: 'pp',
    fuse: 'ability', setDefense: 'heal', maneuver: 'buff', equip: 'buff', serve: 'buff', race: 'buff', stackSave: 'tick', eliminate: 'banish' };
  // Every log type either maps to a tag above or is silent on purpose (listed here).
  const SILENT = { start: 1, endPhase: 1, fought: 1, toDeck: 1 };
  SV.U.SOUND_TYPES = { tagged: TYPE_TAG, silent: SILENT };
  const ANIM_OWNED = { attack: 1, hit: 1, destroy: 1, banish: 1, heal: 1, discard: 1, win: 1, evolve: 1 };
  const MIN_GAP_MS = { draw: 120, hit: 80, engage: 90, ready: 200, turn: 600, click: 40, tick: 120, pp: 200, buff: 120 };
  const MUSIC_IDS = {
    menu: ['menu', 'title', 'music-menu'],
    tier1: ['battle-1', 'tier1', 'tier-1', 'music-1'],
    tier2: ['battle-2', 'tier2', 'tier-2', 'music-2'],
    tier3: ['battle-3', 'tier3', 'tier-3', 'music-3'],
    victory: ['victory', 'win', 'end-win'],
    defeat: ['defeat', 'loss', 'lose', 'end-loss'],
  };

  // UI tag -> clip id in SV.AUDIO.sfx (the ids the audio pipeline will render).
  const CLIP = { play: 'card-play', spell: 'spell-cast', amulet: 'amulet-play', evolve: 'evolve', super: 'super-evolve',
    attack: 'attack', hit: 'damage', leaderHit: 'leader-hit', destroy: 'destroy', draw: 'card-draw', ability: 'ability',
    turn: 'turn-start', win: 'victory-sting', lose: 'defeat-sting', fizzle: 'error', reveal: 'reveal', heal: 'heal' };

  let muted = !!U.store.get('muted', false);
  let volume = Number(U.store.get('volume', 0.8));
  if (!(volume >= 0 && volume <= 1)) volume = 0.8;

  // ---- the context and the iPad kit -------------------------------------------------
  let ctx = null, master = null, stuck = 0, poll = null;
  function actx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
      ctx.onstatechange = wake;
      if (poll == null) poll = setInterval(wake, 1000);
    }
    return ctx;
  }
  function wake() {
    if (!ctx) return;
    if (ctx.state === 'running') { stuck = 0; return; }
    if (ctx.state === 'closed' || (ctx.state === 'interrupted' && ++stuck > 3)) { rebuild(); return; }
    try { ctx.resume(); } catch (e) { /* resumes on the next gesture */ }
  }
  function rebuild() {
    const old = ctx;
    stuck = 0; ctx = null; master = null;
    Music.current = null;
    try { if (old && old.state !== 'closed') old.close(); } catch (e) { /* already gone */ }
    if (actx() && Music.want) playTrack(Music.want, true);
  }
  let holder = null;
  function silentWavUrl() {
    const sr = 8000, n = sr / 2;
    const bytes = new Uint8Array(44 + n);
    const dv = new DataView(bytes.buffer);
    function tag(off, s) { for (let i = 0; i < s.length; i++) bytes[off + i] = s.charCodeAt(i); }
    tag(0, 'RIFF'); dv.setUint32(4, 36 + n, true); tag(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    tag(36, 'data'); dv.setUint32(40, n, true);
    for (let i = 0; i < n; i++) bytes[44 + i] = 128;
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return 'data:audio/wav;base64,' + btoa(s);
  }
  // A page whose only output is Web Audio rides the iPad RINGER and Silent mode; holding
  // one silent media element open promotes it to the media session. Never stopped: it was
  // elements starting and stopping that parked contexts.
  function holdSession() {
    try {
      if (!holder) { holder = new Audio(silentWavUrl()); holder.loop = true; holder.volume = 0.001; holder.setAttribute('playsinline', ''); }
      if (holder.paused) { const p = holder.play(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { /* no media support */ }
  }
  let unlocked = false;
  function unlock() {
    const c = actx();
    holdSession();
    if (!c) return;
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, c.sampleRate);
      src.connect(c.destination);
      src.start(0);
    } catch (e) { /* torn down */ }
    wake();
    if (!unlocked) { unlocked = true; if (Music.want) playTrack(Music.want, true); }
  }
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(function (ev) { document.addEventListener(ev, unlock, true); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { wake(); holdSession(); } });
  window.addEventListener('focus', function () { wake(); });
  window.addEventListener('pageshow', function () { wake(); });

  function decode(c, ab) {
    return new Promise(function (resolve, reject) {
      const p = c.decodeAudioData(ab, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }
  const buffers = {}, loading = {}, failed = {};
  function load(src) {
    const c = actx();
    if (!c || !src) return Promise.resolve(null);
    if (buffers[src]) return Promise.resolve(buffers[src]);
    if (failed[src]) return Promise.resolve(null);
    if (!loading[src]) {
      loading[src] = fetch(src).then(function (r) { if (!r.ok) throw new Error(src + ' ' + r.status); return r.arrayBuffer(); })
        .then(function (ab) { return decode(c, ab); })
        .then(function (b) { buffers[src] = b; return b; })
        .catch(function (e) { failed[src] = true; console.warn('[sound] ' + e.message); return null; });
    }
    return loading[src];
  }

  // ---- SFX ------------------------------------------------------------------------------
  const lastAt = {};
  function sfx(tag) {
    if (muted) return;
    const now = performance.now();
    if (lastAt[tag] && now - lastAt[tag] < (MIN_GAP_MS[tag] || 60)) return;
    lastAt[tag] = now;
    const c = actx();
    if (!c || !master) return;
    const entry = SV.AUDIO.sfx[CLIP[tag] || tag] || SV.AUDIO.sfx[tag];
    if (entry && entry.src && !failed[entry.src]) {
      const buf = buffers[entry.src];
      if (buf) {
        const src = c.createBufferSource(); src.buffer = buf;
        const g = c.createGain(); g.gain.value = entry.gain != null ? entry.gain : 0.5;
        src.connect(g).connect(master); src.start();
        return;
      }
      load(entry.src);           // decode for next time; voice it procedurally now
    }
    synth(tag);
  }

  // Oscillator and noise helpers for the procedural voices below.
  function tone(freq, t0, dur, type, gain, glideTo) {
    const c = ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, gain, lp) {
    const c = ctx;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 2000;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }
  // Procedural voices: short, dark, metallic — the arena's floor so a missing clip is never
  // silence. Not a substitute for the real kit.
  const SYNTH = {
    play: function (t) { tone(196, t, 0.22, 'triangle', 0.14); tone(392, t + 0.05, 0.28, 'triangle', 0.08); noise(t, 0.08, 0.06, 3000); },
    spell: function (t) { [440, 554, 659, 880].forEach(function (f, i) { tone(f, t + i * 0.05, 0.35, 'sine', 0.07); }); noise(t, 0.3, 0.05, 6000); },
    amulet: function (t) { tone(330, t, 0.4, 'sine', 0.1); tone(495, t + 0.08, 0.5, 'sine', 0.06); },
    evolve: function (t) { tone(220, t, 0.6, 'sawtooth', 0.05, 880); [523, 659, 784].forEach(function (f, i) { tone(f, t + 0.25 + i * 0.07, 0.5, 'triangle', 0.08); }); },
    super: function (t) { tone(165, t, 0.8, 'sawtooth', 0.06, 990); [587, 740, 880, 1175].forEach(function (f, i) { tone(f, t + 0.3 + i * 0.07, 0.7, 'triangle', 0.08); }); },
    attack: function (t) { noise(t, 0.22, 0.16, 1800); tone(150, t, 0.2, 'sawtooth', 0.07, 70); },
    hit: function (t) { noise(t, 0.14, 0.25, 2600); tone(110, t, 0.16, 'sine', 0.22, 50); },
    leaderHit: function (t) { noise(t, 0.3, 0.3, 1400); tone(70, t, 0.45, 'sine', 0.3, 35); tone(55, t + 0.05, 0.5, 'triangle', 0.12); },
    destroy: function (t) { noise(t, 0.5, 0.14, 900); tone(330, t, 0.6, 'sawtooth', 0.05, 60); },
    banish: function (t) { tone(880, t, 0.6, 'sine', 0.08, 110); noise(t, 0.5, 0.05, 4000); },
    draw: function (t) { noise(t, 0.09, 0.08, 5000); },
    shuffle: function (t) { for (let i = 0; i < 5; i++) noise(t + i * 0.05, 0.05, 0.06, 4500); },
    heal: function (t) { tone(523, t, 0.4, 'sine', 0.1, 784); tone(784, t + 0.1, 0.4, 'sine', 0.06); },
    engage: function (t) { noise(t, 0.07, 0.07, 1600); },
    ready: function (t) { tone(392, t, 0.08, 'triangle', 0.04); },
    ability: function (t) { tone(622, t, 0.22, 'triangle', 0.09, 932); },
    turn: function (t) { tone(98, t, 0.5, 'sine', 0.18); tone(147, t + 0.12, 0.6, 'triangle', 0.08); noise(t, 0.2, 0.05, 800); },
    click: function (t) { tone(1200, t, 0.04, 'square', 0.03); },
    win: function (t) { [392, 494, 587, 784, 988].forEach(function (f, i) { tone(f, t + i * 0.12, 1, 'triangle', 0.1); }); },
    lose: function (t) { [349, 311, 262, 196].forEach(function (f, i) { tone(f, t + i * 0.2, 0.9, 'sine', 0.1); }); },
    discard: function (t) { noise(t, 0.16, 0.08, 1500); },
    mulligan: function (t) { for (let i = 0; i < 3; i++) noise(t + i * 0.06, 0.06, 0.06, 4000); },
    fizzle: function (t) { tone(280, t, 0.3, 'sawtooth', 0.04, 140); },
    reveal: function (t) { tone(880, t, 0.25, 'sine', 0.08); },
    summon: function (t) { tone(262, t, 0.25, 'triangle', 0.09, 392); },
    pass: function (t) { tone(330, t, 0.12, 'sine', 0.04); },
    buff: function (t) { tone(494, t, 0.18, 'triangle', 0.07, 740); },
    tick: function (t) { tone(988, t, 0.06, 'square', 0.025); },
    pp: function (t) { tone(659, t, 0.12, 'sine', 0.06); tone(988, t + 0.05, 0.14, 'sine', 0.05); },
    quick: function (t) { tone(1319, t, 0.1, 'square', 0.03); tone(1760, t + 0.06, 0.12, 'square', 0.025); },
  };
  function synth(tag) {
    const fn = SYNTH[tag];
    if (!fn || !ctx || ctx.state !== 'running') return;
    try { fn(ctx.currentTime + 0.005); } catch (e) { /* context torn down mid-call */ }
  }

  // ---- music ------------------------------------------------------------------------------
  const Music = { want: null, current: null };
  function musicEntry(role) {
    const ids = MUSIC_IDS[role] || [role];
    for (let i = 0; i < ids.length; i++) if (SV.AUDIO.music[ids[i]]) return SV.AUDIO.music[ids[i]];
    return null;
  }
  const warnedMusic = {};
  // RMS-envelope loop span: the sustained body, not the fade-in or closing decrescendo.
  const spanCache = new WeakMap();
  function loopSpan(buf) {
    if (spanCache.has(buf)) return spanCache.get(buf);
    const d = buf.getChannelData(0), sr = buf.sampleRate, win = Math.max(1, Math.round(sr * 0.05));
    const env = [];
    for (let i = 0; i + win <= d.length; i += win) {
      let sum = 0;
      for (let j = i; j < i + win; j++) sum += d[j] * d[j];
      env.push(Math.sqrt(sum / win));
    }
    let span = { start: 0, end: buf.duration };
    const loud = env.filter(function (v) { return v > 0.004; }).sort(function (a, b) { return a - b; });
    if (loud.length) {
      const thr = Math.max(0.004, loud[Math.floor(loud.length / 2)] * 0.8);
      let lo = 0, hi = env.length - 1;
      while (lo < env.length && env[lo] < thr) lo++;
      while (hi > lo && env[hi] < thr) hi--;
      const start = Math.min(lo + 1, hi) * win / sr, end = Math.min(d.length, (hi + 1) * win) / sr;
      if (end - start > 1) span = { start: start, end: end };
    }
    spanCache.set(buf, span);
    return span;
  }
  function fadeOut(cur, t) {
    if (!cur || !ctx) return;
    try {
      cur.gain.gain.cancelScheduledValues(ctx.currentTime);
      cur.gain.gain.setValueAtTime(cur.gain.gain.value, ctx.currentTime);
      cur.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + t);
      cur.src.stop(ctx.currentTime + t + 0.05);
    } catch (e) { /* already stopped */ }
  }
  const ROLE_GAIN = { menu: 0.22, tier1: 0.16, tier2: 0.21, tier3: 0.26, victory: 0.3, defeat: 0.3 };
  function playTrack(role, force) {
    Music.want = role;
    if (!force && Music.current && Music.current.role === role) return;
    const entry = musicEntry(role);
    if (!entry) {
      if (!warnedMusic[role]) { warnedMusic[role] = true; console.warn('[sound] no music for "' + role + '" in SV.AUDIO.music'); }
      fadeOut(Music.current, 0.9); Music.current = null;
      return;
    }
    const c = actx();
    if (!c || !unlocked) return;
    load(entry.src).then(function (buf) {
      if (!buf || Music.want !== role || !ctx) return;
      if (Music.current && Music.current.role === role && !force) return;
      const once = role === 'victory' || role === 'defeat';
      const src = ctx.createBufferSource(); src.buffer = buf;
      if (!once) { const sp = loopSpan(buf); src.loop = true; src.loopStart = sp.start; src.loopEnd = sp.end; }
      const g = ctx.createGain();
      const level = (entry.gain != null ? entry.gain : 1) * (ROLE_GAIN[role] || 0.2);
      // The new tier comes in at full level; only the old one ducks out under it.
      g.gain.setValueAtTime(level, ctx.currentTime);
      src.connect(g).connect(master);
      src.start(0, once ? 0 : loopSpan(buf).start);
      fadeOut(Music.current, 1.6);
      Music.current = { role: role, src: src, gain: g };
    });
  }
  function stopMusic() { Music.want = null; fadeOut(Music.current, 0.9); Music.current = null; }

  function tierFor(s) {
    const lo = Math.min(s.players[0].defense, s.players[1].defense);
    return lo > 12 ? 'tier1' : lo > 6 ? 'tier2' : 'tier3';
  }

  SV.sound = {
    sfx: sfx,
    // Voice the fresh entries of one apply. `animated`: anim.js will voice its own tags.
    play: function (fresh, animated) {
      if (muted) return;
      const seen = {};
      const s = SV.ui.state;
      fresh.forEach(function (l) {
        let tag = l.sound || TYPE_TAG[l.type];
        if (l.type === 'play' && s.cards[l.iid]) {
          const t = U.typeOf(s.cards[l.iid].id);
          if (t === 'spell') tag = 'spell';
          else if (t === 'amulet') tag = 'amulet';
        }
        if (l.type === 'evolve' && l.sup) tag = 'super';
        if ((l.type === 'play' || l.type === 'ability') && l.quick) tag = 'quick';
        if (!tag || seen[tag]) return;
        if (animated && ANIM_OWNED[tag === 'super' ? 'evolve' : tag]) return;
        seen[tag] = true;
        sfx(tag);
      });
    },
    menu: function () { playTrack('menu'); },
    match: function (s) { if (!SV.isTerminal(s)) playTrack(tierFor(s)); },
    ending: function (win) { playTrack(win ? 'victory' : 'defeat'); if (!musicEntry(win ? 'victory' : 'defeat')) sfx(win ? 'win' : 'lose'); },
    stop: stopMusic,
    isMuted: function () { return muted; },
    toggleMute: function () {
      muted = !muted;
      U.store.set('muted', muted);
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
      return muted;
    },
    volume: function () { return volume; },
    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, v));
      U.store.set('volume', volume);
      if (master && ctx && !muted) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    },
    prewarm: function () {
      const c = actx();
      if (!c) return;
      Object.keys(SV.AUDIO.sfx).forEach(function (k) { const e = SV.AUDIO.sfx[k]; if (e && e.src) load(e.src); });
    },
    tags: function () { return Object.keys(SYNTH); },
    _debug: function () { return { ctx: ctx ? ctx.state : 'none', muted: muted, volume: volume, music: Music.current ? Music.current.role : null, want: Music.want, unlocked: unlocked }; },
  };
})();
