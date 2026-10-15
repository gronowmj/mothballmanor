/* Mothball Manor - shared physics (used by the game AND the playability verifier).
   Fixed 60 Hz ticks. Spectrum-style fixed-arc jump: the vertical path is a lookup table and cannot be altered
   mid-air; the hero can still steer left/right in the air. Positions are in pixels in a 192x240 room. */
(function (root) {
  'use strict';
  const T = 8, RW = 24, RH = 30, W = 192, ROOM_H = 240;
  const HW = 8, HH = 15, SPEED = 2;
  const UP = [4, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1];   // 40 px rise over 16 ticks
  const DOWN = [1, 2, 2, 3, 3, 4];                                // falling speed ramps up, then stays at 4
  const PH_FALL = 19, PH_MAX = 24;                                // phase: 0 ground, 1-16 rising, 17-18 hang, 19-24 falling
  const CYC = 240;                                                // all guardian periods divide this
  const UP_ARRIVE_PH = 5, UP_ARRIVE_FEET = 232;

  const vyOf = ph => ph >= 1 && ph <= 16 ? -UP[ph - 1] : ph <= 18 ? 0 : DOWN[Math.min(ph - PH_FALL, 5)];

  // guardian sprite sizes (kept here so the verifier uses the same hit boxes as the game)
  const SPR = { bat: [14, 8], ghost: [12, 14], spider: [10, 14], skull: [12, 12], rat: [14, 8], flame: [8, 14], cog: [12, 12], moth: [12, 10], barrel: [12, 12] };

  function tileAt(room, c, r) {
    const ex = room.exits;
    if (c < 0) return ex.left ? '.' : '#';
    if (c >= RW) return ex.right ? '.' : '#';
    if (r < 0) return ex.up ? '.' : '#';
    if (r >= RH) return ex.down ? '.' : '#';
    return room.grid[r][c];
  }
  // does the box (x,y,w,h) overlap a solid block?
  function blocked(room, x, y) {
    const c0 = Math.floor(x / T), c1 = Math.ceil((x + HW) / T) - 1, r0 = Math.floor(y / T), r1 = Math.ceil((y + HH) / T) - 1;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(room, c, r) === '#') return true;
    return false;
  }
  // is there something to stand on directly under the feet? (solid block or one-way plank)
  function support(room, x, y) {
    const feet = y + HH;
    if (feet % T !== 0) return false;
    const r = feet / T, c0 = Math.floor(x / T), c1 = Math.ceil((x + HW) / T) - 1;
    for (let c = c0; c <= c1; c++) { const t = tileAt(room, c, r); if (t === '#' || t === '=') return true; }
    return false;
  }

  /* One physics tick. s = {x,y,ph}; inp = bit0 left, bit1 right, bit2 jump. Mutates s.
     Returns 0, or 'L','R','U','D' when the hero leaves the room (s already holds the arrival state in the new room). */
  function step(room, s, inp) {
    const dir = ((inp & 2) ? 1 : 0) - ((inp & 1) ? 1 : 0);
    let x = s.x, y = s.y, ph = s.ph;
    for (let i = 0; i < SPEED && dir; i++) { if (blocked(room, x + dir, y)) break; x += dir; }
    if (ph === 0) {
      if (inp & 4) ph = 1;
      else if (!support(room, x, y)) ph = PH_FALL;
    }
    if (ph !== 0) {
      const vy = vyOf(ph);
      let landed = false, bumped = false;
      if (vy > 0) {
        for (let i = 0; i < vy; i++) {
          y++;
          if (support(room, x, y)) { landed = true; break; }
        }
      } else if (vy < 0) {
        for (let i = 0; i < -vy; i++) {
          if (blocked(room, x, y - 1)) { bumped = true; break; }
          y--;
        }
      } else if (support(room, x, y)) landed = true;
      ph = landed ? 0 : bumped ? PH_FALL : Math.min(ph + 1, PH_MAX);
    }
    s.x = x; s.y = y; s.ph = ph;
    const ex = room.exits;
    if (ex.left && x + HW / 2 < 0) { s.x = W - HW; return 'L'; }
    if (ex.right && x + HW / 2 > W) { s.x = 0; return 'R'; }
    if (ex.up && y + HH <= 0) { s.y = UP_ARRIVE_FEET - HH; s.ph = UP_ARRIVE_PH; return 'U'; }
    if (ex.down && y + HH > ROOM_H) { s.y = -HH; s.ph = PH_FALL; return 'D'; }
    return 0;
  }

  // ---- hazards ----
  function guardianPos(g, t) {
    const u = ((t + g.ph) % g.per) / g.per, tri = u < 0.5 ? 2 * u : 2 - 2 * u;
    return g.t === 'h' ? { x: Math.round(g.x0 + (g.x1 - g.x0) * tri), y: g.y } : { x: g.x, y: Math.round(g.y0 + (g.y1 - g.y0) * tri) };
  }
  // direction of travel (+1 / -1) along its path, for sprite facing
  function guardianDir(g, t) { const u = ((t + g.ph) % g.per) / g.per; const fwd = u < 0.5; return (g.t === 'h' ? (g.x1 >= g.x0) : (g.y1 >= g.y0)) === fwd ? 1 : -1; }
  function guardianRect(g, t) {
    const p = guardianPos(g, t), sz = SPR[g.spr];
    return { x: p.x + 2, y: p.y + 1, w: sz[0] - 4, h: sz[1] - 2 };
  }
  const overlap = (ax, ay, aw, ah, b) => ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
  // is the hero (at x,y) touching a guardian or spike at room-time t?
  function hurt(room, x, y, t) {
    const hx = x + 1, hy = y + 1, hw = HW - 2, hh = HH - 1;
    for (const g of room.guardians) if (overlap(hx, hy, hw, hh, guardianRect(g, t))) return true;
    const c0 = Math.floor(hx / T), c1 = Math.ceil((hx + hw) / T) - 1, r0 = Math.floor(hy / T), r1 = Math.ceil((hy + hh) / T) - 1;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const ch = tileAt(room, c, r);
      if (ch === 'S' && overlap(hx, hy, hw, hh, { x: c * T + 1, y: r * T + 3, w: 6, h: 5 })) return true;
      if (ch === 'T' && overlap(hx, hy, hw, hh, { x: c * T + 1, y: r * T, w: 6, h: 5 })) return true;
    }
    return false;
  }
  const touchesItem = (x, y, it) => overlap(x, y, HW, HH, { x: it.c * T, y: it.r * T, w: T, h: T });
  const touchesDoor = (x, y, d) => overlap(x, y, HW, HH, { x: d.c * T, y: d.r * T, w: d.w * T, h: d.h * T });

  const api = { T, RW, RH, W, ROOM_H, HW, HH, SPEED, UP, DOWN, PH_FALL, PH_MAX, CYC, SPR, vyOf, tileAt, blocked, support, step,
    guardianPos, guardianDir, guardianRect, hurt, touchesItem, touchesDoor, overlap, UP_ARRIVE_PH, UP_ARRIVE_FEET };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MMPhys = api;
})(typeof window !== 'undefined' ? window : globalThis);
