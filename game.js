/* Mothball Manor - an original single-screen platformer in the spirit of 1980s home-computer mansion games.
   All code, art, layouts, names and text are original. */
(function () {
  'use strict';
  const P = window.MMPhys, { rooms, order, START } = window.MMRooms, M = window.MM;
  const { PAL, ART, ITEMS, TILES, LIFE, sprite, text, textW } = M;
  const W = 192, H = 272, PY = 16, STEP = 1000 / 60, T = P.T;
  const params = new URLSearchParams(location.search);
  const TEST = params.get('test') === '1';
  const TOTAL = order.reduce((n, id) => n + rooms[id].items.length, 0);
  const LIVES = 5;

  let best = 0, bestTime = 0, muted = false;
  try { best = parseInt(localStorage.getItem('mothball.best') || '0', 10) || 0; bestTime = parseInt(localStorage.getItem('mothball.time') || '0', 10) || 0; muted = localStorage.getItem('mothball.mute') === '1'; } catch (e) { }

  const G = { mode: 'title', t: 0, modeT: 0, paused: false, frozen: false, tune: false, override: null };

  // ---------- input ----------
  const keys = { left: false, right: false, jump: false }, touch = { left: false, right: false, jump: false };
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', KeyZ: 'left', ArrowRight: 'right', KeyD: 'right', KeyX: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyK: 'jump' };
  const held = k => keys[k] || touch[k];
  let jumpBuf = 0;
  function jumpPress() { jumpBuf = 9; }
  addEventListener('keydown', e => {
    unlockAudio();
    const k = KEYMAP[e.code];
    if (k || e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Enter') e.preventDefault();
    if (e.code === 'KeyM') { toggleMute(); return; }
    if (e.code === 'KeyP') { if (G.mode === 'play') togglePause(); return; }
    if (e.repeat) return;
    if (k) { keys[k] = true; if (k === 'jump') jumpPress(); }
    anyPress();
  });
  addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) { keys[k] = false; e.preventDefault(); } });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const ptrs = new Map();
  function btnAt(x, y) { const el = document.elementFromPoint(x, y); const b = el && el.closest && el.closest('[data-k]'); return b ? b.dataset.k : null; }
  function syncTouch() {
    for (const k in touch) touch[k] = false;
    for (const k of ptrs.values()) if (k) touch[k] = true;
    for (const el of document.querySelectorAll('[data-k]')) el.classList.toggle('on', touch[el.dataset.k]);
  }
  addEventListener('pointerdown', e => {
    unlockAudio();
    const sys = e.target.closest && e.target.closest('.sys');
    if (sys) { e.preventDefault(); if (sys.id === 'bMute') toggleMute(); else if (G.mode === 'play') togglePause(); return; }
    const k = btnAt(e.clientX, e.clientY);
    ptrs.set(e.pointerId, k);
    if (k === 'jump') jumpPress();
    syncTouch();
    anyPress();
    e.preventDefault();
  }, { passive: false });
  addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const k = btnAt(e.clientX, e.clientY);
    if (k === 'jump' && ptrs.get(e.pointerId) !== 'jump') jumpPress();
    ptrs.set(e.pointerId, k); syncTouch();
  });
  const ptrEnd = e => { if (ptrs.delete(e.pointerId)) syncTouch(); };
  addEventListener('pointerup', ptrEnd); addEventListener('pointercancel', ptrEnd);
  addEventListener('touchstart', e => { if (e.touches.length > 1 || e.target.closest('.btn,.sys,#view')) e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  addEventListener('touchend', () => unlockAudio());
  addEventListener('pointerup', () => unlockAudio());
  addEventListener('gesturestart', e => e.preventDefault());
  addEventListener('dblclick', e => e.preventDefault());
  addEventListener('contextmenu', e => e.preventDefault());

  function anyPress() {
    if (G.mode === 'title' && G.modeT > 15) {
      // first tap switches the music on (iOS needs a tap for audio); the next one starts the game
      if (!G.tune && !muted && AC) { G.tune = true; startTune(); return; }
      newGame();
    } else if ((G.mode === 'over' || G.mode === 'win') && G.modeT > 90) toTitle();
    else if (G.mode === 'play' && G.paused) togglePause();
  }
  function toTitle() { G.mode = 'title'; G.modeT = 0; if (G.tune && !muted) startTune(); }
  function togglePause() { G.paused = !G.paused; document.getElementById('bPause').classList.toggle('on', G.paused); if (G.paused) stopTune(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play' && !G.paused) togglePause(); if (document.hidden) stopTune(); else if (G.mode === 'title' && G.tune && !muted) startTune(); });

  // ---------- audio: a beeper-style square wave synth ----------
  let AC = null, master = null, noiseBuf = null, tuneTimer = 0, tuneNodes = [];
  function unlockAudio() {
    try {
      if (!AC) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        AC = new C();
        master = AC.createGain(); master.gain.value = muted ? 0 : 0.2; master.connect(AC.destination);
        const b = AC.createBuffer(1, 1, 22050), s = AC.createBufferSource(); s.buffer = b; s.connect(master); s.start(0);
        noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
        const d = noiseBuf.getChannelData(0); let v = 0;
        for (let i = 0; i < d.length; i++) { if (i % 4 === 0) v = Math.random() < 0.5 ? -1 : 1; d[i] = v; }
      }
      if (AC.state === 'suspended') AC.resume();
    } catch (e) { }
  }
  function tone(f0, f1, dur, vol, delay, keep) {
    if (!AC || muted) return;
    const t = AC.currentTime + (delay || 0);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
    if (keep) tuneNodes.push(o);
  }
  function noise(dur, vol, f0, f1, delay) {
    if (!AC || muted) return;
    const t = AC.currentTime + (delay || 0);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass';
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const sfx = {
    jump: () => tone(300, 640, 0.13, 0.11),
    collect: () => { tone(988, 988, 0.05, 0.12); tone(1319, 1319, 0.09, 0.12, 0.055); },
    die: () => { for (let i = 0; i < 6; i++) tone(700 - i * 100, 560 - i * 100, 0.1, 0.13, i * 0.1); noise(0.5, 0.25, 3000, 100, 0.1); },
    room: () => tone(520, 700, 0.04, 0.07),
    open: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, f, 0.09, 0.12, i * 0.09)),
    win: () => [523, 659, 784, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, f, 0.12, 0.12, i * 0.12)),
    over: () => [392, 349, 330, 294, 262, 196].forEach((f, i) => tone(f, f, 0.18, 0.12, i * 0.2)),
    start: () => [262, 330, 392, 523].forEach((f, i) => tone(f, f, 0.07, 0.12, i * 0.07))
  };
  // title tune: an original eight-bar minor-key arpeggio piece, two voices (arpeggio + bass)
  const BARS = [
    [57, 64, 69, 64, 72, 71, 69, 64], [53, 60, 65, 60, 69, 67, 65, 60], [55, 62, 67, 62, 71, 69, 67, 62], [52, 59, 64, 59, 67, 66, 64, 59],
    [57, 64, 69, 64, 72, 76, 74, 72], [53, 60, 65, 60, 69, 72, 71, 69], [50, 57, 62, 57, 65, 64, 62, 57], [52, 59, 64, 56, 68, 64, 59, 56]
  ];
  const BASS = [45, 41, 43, 40, 45, 41, 38, 40], EIGHTH = 0.2;
  function startTune() {
    stopTune();
    if (!AC || muted || G.mode !== 'title') return;
    const loopLen = BARS.length * 8 * EIGHTH;
    BARS.forEach((bar, b) => bar.forEach((m, i) => {
      const t0 = 0.08 + (b * 8 + i) * EIGHTH;
      tone(hz(m + 12), hz(m + 12), EIGHTH * 0.9, 0.06, t0, true);
      if (i % 4 === 0) tone(hz(BASS[b]), hz(BASS[b]), EIGHTH * 3.6, 0.075, t0, true);
    }));
    tuneTimer = setTimeout(() => { if (G.mode === 'title' && !muted && !document.hidden) startTune(); }, loopLen * 1000);
  }
  function stopTune() {
    clearTimeout(tuneTimer);
    for (const o of tuneNodes) { try { o.stop(); } catch (e) { } }
    tuneNodes = [];
  }
  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('mothball.mute', muted ? '1' : '0'); } catch (e) { }
    if (master) master.gain.value = muted ? 0 : 0.2;
    document.getElementById('bMute').classList.toggle('muted', muted);
    if (muted) stopTune(); else if (G.mode === 'title' && G.tune) startTune();
  }

  // ---------- game state ----------
  function newGame() {
    stopTune();
    Object.assign(G, { mode: 'play', modeT: 0, room: START, lives: LIVES, got: {}, count: 0, ticks: 0, dying: 0, inv: 60, roomT: 0, banner: 0, bannerText: '', open: false, anim: 0, face: 1 });
    for (const id of order) G.got[id] = new Set();
    G.paused = false; document.getElementById('bPause').classList.remove('on');
    respawn(false);
    sfx.start();
    G.banner = 110; G.bannerText = 'COLLECT EVERYTHING!';
  }
  function respawn(loseTime) {
    const r = rooms[G.room];
    G.h = { x: r.spawn.x, y: r.spawn.y, ph: 0 };
    G.roomT = 0; G.inv = 60; jumpBuf = 0; G.dying = 0;
  }
  function die() {
    G.dying = 70; G.lives--; sfx.die(); jumpBuf = 0;
  }
  function collect(id, idx) {
    G.got[id].add(idx); G.count = order.reduce((n, r) => n + G.got[r].size, 0);
    best = Math.max(best, G.count);
    try { localStorage.setItem('mothball.best', String(best)); } catch (e) { }
    if (G.count === TOTAL) { G.open = true; G.banner = 240; G.bannerText = 'ALL FOUND! RUN TO THE DOOR!'; sfx.open(); }
    else sfx.collect();
  }
  function update() {
    G.t++; G.modeT++;
    if (G.mode === 'over' && G.modeT > 900) toTitle();
    if (G.mode === 'win' && G.modeT > 1500) toTitle();
    if (G.mode !== 'play') return;
    G.anim++;
    if (G.banner > 0) G.banner--;
    G.roomT++;
    if (G.dying > 0) {
      if (--G.dying === 0) {
        if (G.lives <= 0) { G.mode = 'over'; G.modeT = 0; sfx.over(); } else respawn();
      }
      return;
    }
    G.ticks++;
    const room = rooms[G.room], h = G.h;
    let bits;
    if (G.override !== null) bits = G.override;
    else {
      const d = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      bits = d < 0 ? 1 : d > 0 ? 2 : 0;
      if (jumpBuf > 0 && h.ph === 0) bits |= 4;
    }
    const wasGround = h.ph === 0;
    if (bits & 1) G.face = -1; else if (bits & 2) G.face = 1;
    const ev = P.step(room, h, bits);
    if (wasGround && h.ph === 1) { sfx.jump(); jumpBuf = 0; }
    else if (jumpBuf > 0) jumpBuf--;
    if (ev) {
      const to = room.exits[{ L: 'left', R: 'right', U: 'up', D: 'down' }[ev]].room;
      G.room = to; G.roomT = 0; G.inv = Math.max(G.inv, 24); sfx.room();
    }
    const rm = rooms[G.room];
    // pick up items
    rm.items.forEach((it, i) => { if (!G.got[rm.id].has(i) && P.touchesItem(h.x, h.y, it)) collect(rm.id, i); });
    if (G.inv > 0) G.inv--;
    else if (P.hurt(rm, h.x, h.y, G.roomT)) { die(); return; }
    if (rm.door && G.open && P.touchesDoor(h.x, h.y, rm.door)) {
      G.mode = 'win'; G.modeT = 0; sfx.win();
      const secs = Math.round(G.ticks / 60);
      if (!bestTime || secs < bestTime) { bestTime = secs; try { localStorage.setItem('mothball.time', String(secs)); } catch (e) { } }
    }
  }

  // ---------- rendering ----------
  const low = document.createElement('canvas'); low.width = W; low.height = H;
  const c = low.getContext('2d');
  const screen = document.getElementById('screen'), sctx = screen.getContext('2d');
  const view = document.getElementById('view');
  const rect = (x, y, w, h, col) => { c.fillStyle = PAL[col] || col; c.fillRect(x, y, w, h); };
  const centre = (str, y, col, sc) => text(c, str, Math.round((W - textW(str, sc)) / 2), y, col, sc);

  const cellCache = new Map();
  function cellCanvas(rows, paper, ink, key) {
    const ck = key + paper + ink;
    let cv = cellCache.get(ck);
    if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = cv.height = 8;
    const x = cv.getContext('2d');
    x.fillStyle = PAL[paper]; x.fillRect(0, 0, 8, 8);
    x.fillStyle = PAL[ink];
    if (rows) for (let y = 0; y < 8; y++) for (let q = 0; q < 8; q++) if (rows[y][q] === '#') x.fillRect(q, y, 1, 1);
    cellCache.set(ck, cv);
    return cv;
  }
  const decoInk = (room, ch) => room.th.dec;
  const tileInk = (room, ch) => ch === '#' ? room.th.wall : ch === '=' ? room.th.plank : (ch === 'S' || ch === 'T') ? room.th.spike : decoInk(room, ch);
  const bgCache = {};
  function roomBg(room) {
    if (bgCache[room.id]) return bgCache[room.id];
    const cv = document.createElement('canvas'); cv.width = W; cv.height = P.ROOM_H;
    const x = cv.getContext('2d');
    for (let r = 0; r < P.RH; r++) for (let q = 0; q < P.RW; q++) {
      const ch = room.grid[r][q];
      x.drawImage(cellCanvas(TILES[ch], room.th.paper, ch === '.' ? room.th.paper : tileInk(room, ch), ch), q * T, r * T);
    }
    return (bgCache[room.id] = cv);
  }
  const FLASH = ['W', 'Y', 'C', 'G', 'M', 'R'];
  const GUARD_ANIM = { bat: 6, ghost: 12, spider: 10, skull: 14, rat: 6, flame: 5, cog: 8, moth: 5, barrel: 12 };

  function drawRoom() {
    const room = rooms[G.room], th = room.th, t = G.roomT;
    c.drawImage(roomBg(room), 0, PY);
    // sprites: hero + guardians. Each one stamps its ink onto every 8x8 cell it touches (attribute clash).
    const sprites = [];
    for (const g of room.guardians) {
      const p = P.guardianPos(g, t), f = ART[g.spr], fr = Math.floor(t / GUARD_ANIM[g.spr]) % f.length;
      sprites.push({ x: p.x, y: p.y, w: P.SPR[g.spr][0], h: P.SPR[g.spr][1], rows: f[fr], flip: g.t === 'h' ? P.guardianDir(g, t) < 0 : false, col: g.col, key: g.spr + fr, thread: g.spr === 'spider' ? g : null });
    }
    const h = G.h;
    if (h) {
      const air = h.ph !== 0, moving = !air && (held('left') !== held('right')) && G.mode === 'play' && !G.dying;
      let fk = 'stand';
      if (air) fk = h.ph < 19 ? 'jump' : 'fall';
      else if (moving) fk = ['a', 'b', 'c', 'b'][Math.floor(G.anim / 5) % 4];
      let col = th.hero;
      if (G.dying) col = (G.dying >> 2) % 2 ? 'R' : 'W';
      const blink = G.inv > 0 && !G.dying && (G.inv >> 2) % 2 === 0;
      if (!(blink && G.mode === 'play')) sprites.push({ x: h.x - 2, y: h.y - 1, w: 12, h: 16, rows: ART.hero[fk], flip: G.face < 0, col, key: 'hero' + fk });
    }
    const attr = new Map();
    for (const s of sprites) {
      const c0 = Math.floor(s.x / T), c1 = Math.floor((s.x + s.w - 1) / T), r0 = Math.floor(s.y / T), r1 = Math.floor((s.y + s.h - 1) / T);
      for (let r = r0; r <= r1; r++) for (let q = c0; q <= c1; q++) if (r >= 0 && r < P.RH && q >= 0 && q < P.RW) attr.set(r * 100 + q, s.col);
    }
    for (const [k, ink] of attr) {
      const r = Math.floor(k / 100), q = k % 100, ch = room.grid[r][q];
      c.drawImage(cellCanvas(TILES[ch], th.paper, ink, ch), q * T, PY + r * T);
    }
    // door (Hall)
    if (room.door) drawDoor(room.door);
    // items
    const ik = ITEMS[th.item];
    room.items.forEach((it, i) => {
      if (G.got[room.id] && G.got[room.id].has(i)) return;
      const col = attr.get(it.r * 100 + it.c) || FLASH[(Math.floor(G.t / 6) + i) % FLASH.length];
      const f = FLASH.indexOf(col) < 0 && col === th.paper ? 'W' : col;
      c.drawImage(sprite('item' + th.item, ik, false, f), it.c * T, PY + it.r * T);
    });
    // spider threads, then sprites
    for (const s of sprites) {
      if (s.thread) { c.fillStyle = PAL.w; c.fillRect(s.x + 4, PY + 8, 1, s.y - 8); }
      c.drawImage(sprite(s.key, s.rows, s.flip, s.col), s.x, PY + s.y);
    }
  }
  function drawDoor(d) {
    const x = d.c * T, y = PY + d.r * T, w = d.w * T, hh = d.h * T, open = G.open;
    rect(x, y, w, hh, 'k');
    rect(x, y, w, 2, 'y'); rect(x, y, 2, hh, 'y'); rect(x + w - 2, y, 2, hh, 'y');
    if (!open) {
      rect(x + 2, y + 2, w - 4, hh - 2, 'r');
      rect(x + 4, y + 5, 3, 7, 'R'); rect(x + w - 7, y + 5, 3, 7, 'R'); rect(x + 4, y + 14, 3, 8, 'R'); rect(x + w - 7, y + 14, 3, 8, 'R');
      rect(x + w - 5, y + 13, 2, 2, 'Y');
    } else {
      const f = (G.t >> 3) % 2;
      rect(x + 2, y + 2, w - 4, hh - 2, f ? 'Y' : 'W');
      rect(x + 5, y + 5, w - 10, hh - 5, 'W');
      for (let i = 0; i < 3; i++) rect(x + 6 + i * 3, y + 8 + ((G.t >> 2) + i * 2) % 12, 1, 3, 'y');
    }
  }
  function drawHud() {
    rect(0, 0, W, PY, 'k');
    text(c, 'ITEMS', 3, 4, 'C'); text(c, String(G.count || 0).padStart(2, '0') + '/' + TOTAL, 38, 4, 'Y');
    for (let i = 0; i < Math.max(0, G.lives); i++) c.drawImage(sprite('life', LIFE, false, 'R'), W - 4 - (i + 1) * 9, 4);
    text(c, 'LIVES', W - 4 - LIVES * 9 - 36, 4, 'C');
    const th = rooms[G.room].th, dark = ['r', 'b', 'B', 'm', 'k', 'g'].includes(th.wall);
    rect(0, H - 16, W, 16, th.wall === 'k' ? 'w' : th.wall);
    const name = rooms[G.room].name;
    text(c, name, Math.round((W - textW(name)) / 2), H - 12, dark || th.wall === 'k' ? 'W' : 'k');
    if (th.wall === 'k') rect(0, H - 16, W, 16, 'w'), text(c, name, Math.round((W - textW(name)) / 2), H - 12, 'k');
  }
  function drawBanner() {
    if (G.banner <= 0 || G.paused) return;
    const s = G.bannerText, w = textW(s) + 12, x = Math.round((W - w) / 2), y = PY + 100;
    rect(x - 1, y - 1, w + 2, 20, 'W'); rect(x, y, w, 18, 'k');
    text(c, s, x + 6, y + 6, (G.banner >> 3) % 2 ? 'Y' : 'W');
  }
  function drawPlay() {
    rect(0, 0, W, H, 'k');
    drawRoom(); drawHud(); drawBanner();
    if (G.paused) { rect(40, PY + 100, 112, 24, 'k'); rect(40, PY + 100, 112, 1, 'W'); rect(40, PY + 123, 112, 1, 'W'); centre('PAUSED', PY + 108, 'Y', 1); text(c, 'TAP TO RESUME', Math.round((W - textW('TAP TO RESUME')) / 2), PY + 130, 'w'); }
  }

  // ---------- title ----------
  const LOGO_COLS = ['R', 'Y', 'G', 'C', 'M', 'W'];
  function logo(str, y, sc) {
    const x0 = Math.round((W - textW(str, sc)) / 2);
    for (let i = 0; i < str.length; i++) {
      const g = M.F[str[i]];
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) {
        if (g[r][q] !== '#') continue;
        const bx = x0 + (i * 6 + q) * sc, by = y + r * sc, band = Math.floor((i * 6 + q + r - (G.t >> 2)) / 5);
        const col = LOGO_COLS[((band % 6) + 6) % 6];
        rect(bx + 1, by + 1, sc, sc, 'b'); rect(bx, by, sc, sc, col.toLowerCase()); rect(bx, by, sc - 1, sc - 1, col);
      }
    }
  }
  const STARS = (() => { const a = []; let s = 91; const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x80000000; for (let i = 0; i < 40; i++) a.push({ x: Math.floor(r() * W), y: Math.floor(r() * 150) + 4, p: Math.floor(r() * 300) }); return a; })();
  function drawHouse(y0) {
    // moon, then a haunted mansion silhouette with flickering windows
    rect(150, y0 - 4, 14, 14, 'W'); rect(155, y0 - 4, 9, 14, 'y'); rect(153, y0 - 2, 3, 3, 'w'); rect(158, y0 + 4, 2, 2, 'w');
    const bx = 36, by = y0 + 18;
    rect(bx, by + 14, 120, 40, 'm'); rect(bx + 40, by, 40, 54, 'm');
    for (let i = 0; i < 6; i++) rect(bx + 40 + i * 4 - 2 + (i > 2 ? 0 : 0), by - 10 + Math.abs(i - 2.5) * 3.2 | 0, 4, 12, 'm');
    rect(bx + 4, by + 2, 6, 14, 'm'); rect(bx + 98, by + 4, 6, 14, 'm');
    rect(bx + 54, by - 16, 12, 18, 'm'); rect(bx + 58, by - 22, 4, 8, 'm');
    for (let r = 0; r < 3; r++) for (let q = 0; q < 8; q++) {
      const x = bx + 8 + q * 14 + (q > 3 ? 12 : 0), y = by + 20 + r * 12 - (q === 3 || q === 4 ? 0 : 0);
      if (q === 3 && r === 2) continue;
      const lit = (Math.floor((G.t + q * 37 + r * 91) / 40) * 7 + q * 3 + r) % 5 > 1;
      rect(x, y, 6, 7, 'k'); if (lit) { rect(x + 1, y + 1, 4, 5, (q + r) % 2 ? 'Y' : 'y'); rect(x + 3, y + 1, 1, 5, 'k'); }
    }
    rect(bx + 55, by + 36, 10, 18, 'k'); rect(bx + 56, by + 37, 8, 17, 'r');
    rect(bx - 4, by + 54, 128, 8, 'g'); rect(bx - 4, by + 54, 128, 2, 'G');
  }
  function drawTitle() {
    rect(0, 0, W, H, 'k');
    for (const s of STARS) if (((G.t + s.p) >> 5) % 4) rect(s.x, s.y, 1, 1, (s.p & 1) ? 'W' : 'c');
    logo('MOTHBALL', 8, 3); logo('MANOR', 34, 4);
    centre('A NINE-ROOM PLATFORM ADVENTURE', 66, 'C');
    drawHouse(86);
    // cast
    const bob = Math.round(Math.sin(G.t / 18) * 2);
    c.drawImage(sprite('t-hero', ART.hero[['a', 'b', 'c', 'b'][(G.t >> 3) % 4]], false, 'W'), 16, 150);
    c.drawImage(sprite('t-bat' + ((G.t >> 3) % 2), ART.bat[(G.t >> 3) % 2], false, 'M'), 140 + Math.round(Math.sin(G.t / 25) * 8), 118 + bob);
    c.drawImage(sprite('t-ghost' + ((G.t >> 4) % 2), ART.ghost[(G.t >> 4) % 2], false, 'C'), 168, 144 + bob);
    const lines = [['COLLECT EVERY GLINTING ITEM', 'W'], ['IN ALL 9 ROOMS, THEN ESCAPE', 'W'], ['BY THE FRONT DOOR.', 'W'], ['GHOSTS, BATS AND SPIKES', 'Y'], ['COST A LIFE. YOU HAVE FIVE.', 'Y'], ['JUMPS ARE FIXED: PLAN AHEAD!', 'G']];
    lines.forEach((l, i) => centre(l[0], 170 + i * 9, l[1]));
    centre('KEYS: ARROWS/ZX + SPACE', 238, 'c');
    centre('BEST ' + String(best).padStart(2, '0') + '/' + TOTAL + ' ITEMS', 226, 'M');
    const prompt = (G.tune || muted || !AC) ? 'TAP TO PLAY' : 'TAP FOR MUSIC';
    if ((G.t >> 4) % 2 === 0) centre(prompt, 253, 'Y', 1);
    rect(0, H - 2, W, 2, 'b');
  }
  function drawEnd(win) {
    rect(0, 0, W, H, 'k');
    for (const s of STARS) if (((G.t + s.p) >> 5) % 4) rect(s.x, s.y, 1, 1, 'W');
    if (win) {
      logo('YOU', 30, 4); logo('ESCAPED', 62, 3);
      drawHouse(110);
      centre('ALL ' + TOTAL + ' ITEMS COLLECTED', 196, 'Y');
      const s = Math.round(G.ticks / 60);
      centre('TIME ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '  LIVES LEFT ' + G.lives, 210, 'C');
      if (bestTime) centre('BEST TIME ' + Math.floor(bestTime / 60) + ':' + String(bestTime % 60).padStart(2, '0'), 222, 'M');
    } else {
      logo('GAME', 40, 5); logo('OVER', 82, 5);
      c.drawImage(sprite('o-ghost', ART.ghost[(G.t >> 4) % 2], false, 'W'), 90, 140 + Math.round(Math.sin(G.t / 14) * 3));
      centre('YOU FOUND ' + G.count + ' OF ' + TOTAL + ' ITEMS', 180, 'Y');
      centre('BEST ' + best + '/' + TOTAL, 194, 'C');
    }
    if (G.modeT > 90 && (G.t >> 4) % 2 === 0) centre('TAP TO CONTINUE', 250, 'W');
  }
  function render() {
    if (G.mode === 'title') drawTitle(); else if (G.mode === 'play') drawPlay(); else drawEnd(G.mode === 'win');
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(low, 0, 0, screen.width, screen.height);
  }

  // ---------- layout ----------
  function safe() {
    const s = getComputedStyle(document.getElementById('safe'));
    return { t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0, b: parseFloat(s.paddingBottom) || 0, l: parseFloat(s.paddingLeft) || 0 };
  }
  function place(el, x, y, w, h) { Object.assign(el.style, { left: Math.round(x) + 'px', top: Math.round(y) + 'px', width: Math.round(w) + 'px', height: Math.round(h) + 'px' }); }
  let LAYOUT = {};
  function layout() {
    const vw = innerWidth, vh = innerHeight, s = safe(), $ = id => document.getElementById(id);
    let gw, gh, gx, gy;
    const portrait = vh >= vw * 0.9;
    document.body.classList.toggle('land', !portrait);
    if (portrait) {
      const sysS = 34, gapA = 8, side = 10, gap = 10;
      const top = s.t, bottom = vh - Math.max(s.b, 10) - 6;
      const bh = Math.max(88, Math.min(Math.round(vh * 0.2), 190));
      const availH = bottom - top - (sysS + gapA + bh + gapA);
      const sc = Math.min((vw - s.l - s.r) / W, availH / H);
      gw = W * sc; gh = H * sc; gx = (vw - gw) / 2; gy = top + Math.max(0, (availH - gh) / 2);
      const by = bottom - bh, sysY = by - gapA - sysS;
      place($('bPause'), s.l + side, sysY, sysS, sysS);
      place($('bMute'), vw - s.r - side - sysS, sysY, sysS, sysS);
      const tw = vw - s.l - s.r - 2 * side, sm = Math.round(tw * 0.26);
      place($('bLeft'), s.l + side, by, sm, bh);
      place($('bRight'), s.l + side + sm + gap, by, sm, bh);
      place($('bJump'), s.l + side + 2 * sm + 2 * gap, by, tw - 2 * sm - 2 * gap, bh);
    } else {
      const top = Math.max(s.t, 6), bot = vh - Math.max(s.b, 6);
      gh = bot - top; gw = gh * W / H;
      const sideW = (vw - s.l - s.r - gw) / 2 - 12;
      if (sideW < 100) { gw = vw - s.l - s.r - 2 * 112; gh = gw * H / W; }
      gx = (vw - gw) / 2; gy = top + (bot - top - gh) / 2;
      const lx = s.l + 8, lw = gx - 8 - lx, rx = gx + gw + 8, rw = vw - s.r - 8 - rx, bw = (lw - 8) / 2, bh = Math.min(vh * 0.5, 170);
      place($('bLeft'), lx, bot - bh, bw, bh); place($('bRight'), lx + bw + 8, bot - bh, bw, bh);
      place($('bJump'), rx, bot - bh, rw, bh);
      place($('bPause'), rx + rw - 34, top, 34, 34); place($('bMute'), lx, top, 34, 34);
    }
    place(view, gx, gy, gw, gh);
    LAYOUT = { portrait, gx, gy, gw, gh };
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    screen.width = Math.round(gw * dpr); screen.height = Math.round(gh * dpr);
    render();
  }
  addEventListener('resize', layout);
  addEventListener('orientationchange', () => setTimeout(layout, 120));
  document.getElementById('bMute').classList.toggle('muted', muted);

  // ---------- main loop: fixed 60 Hz timestep ----------
  let acc = 0, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(now - last, 250); last = now;
    if (!G.paused && !G.frozen) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 6) { update(); acc -= STEP; n++; }
      if (n === 6) acc = 0;
    } else acc = 0;
    render();
  }
  layout();
  requestAnimationFrame(frame);

  // ---------- test hooks ----------
  if (TEST) {
    window.__game = {
      G, keys, touch, TOTAL, rooms, order,
      layout: () => LAYOUT,
      snapshot: () => ({ mode: G.mode, room: G.room, lives: G.lives, count: G.count, open: G.open, paused: G.paused, muted, dying: G.dying, inv: G.inv, roomT: G.roomT, tune: G.tune,
        h: G.h && { x: G.h.x, y: G.h.y, ph: G.h.ph }, audio: AC ? AC.state : 'none', got: G.got ? Object.fromEntries(Object.entries(G.got).map(([k, v]) => [k, v.size])) : null }),
      start: () => { if (G.mode !== 'play') newGame(); },
      fresh: () => { newGame(); G.banner = 0; },
      freeze: on => { G.frozen = on !== false; },
      step: (n, bits) => { G.override = bits === undefined ? null : bits; for (let i = 0; i < (n || 1); i++) update(); G.override = null; render(); },
      setRoom: (id, x, y, ph) => { G.room = id; G.roomT = 0; G.inv = 0; G.h = { x: x === undefined ? rooms[id].spawn.x : x, y: y === undefined ? rooms[id].spawn.y : y, ph: ph || 0 }; render(); },
      respawnRoom: () => respawn(),
      setLives: n => { G.lives = n; },
      grab: (id, idx) => { if (!G.got[id].has(idx)) collect(id, idx); },
      grabAllBut: (id, idx) => { for (const rid of order) rooms[rid].items.forEach((it, i) => { if (!(rid === id && i === idx)) G.got[rid].add(i); }); G.count = order.reduce((n, r) => n + G.got[r].size, 0); },
      noInv: () => { G.inv = 0; },
      render
    };
  }
})();
