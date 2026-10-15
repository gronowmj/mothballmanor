/* Mothball Manor - the nine rooms. Built from a few drawing helpers so the layouts stay readable.
   Tiles (8x8):  # solid brick   = one-way plank (jump up through it, land on top)   S floor spikes   T ceiling spikes
                 . empty    w window   b bookshelf   | pillar   * star / sparkle (decoration only)
   Rooms are 24 x 30 tiles (192 x 240 px). */
(function (root) {
  'use strict';
  const P = (root.MMPhys || (typeof require !== 'undefined' ? require('./physics.js') : null));
  const RW = P.RW, RH = P.RH;

  function mk(id, name, th) {
    const g = Array.from({ length: RH }, () => Array(RW).fill('.'));
    for (let c = 0; c < RW; c++) { g[0][c] = '#'; g[RH - 1][c] = '#'; }
    for (let r = 0; r < RH; r++) { g[r][0] = '#'; g[r][RW - 1] = '#'; }
    const room = { id, name, th, g, exits: {}, items: [], guardians: [], spawn: null, door: null };
    room.fill = (r0, c0, r1, c1, ch) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch; return room; };
    room.plank = (r, c0, c1) => room.fill(r, c0, r, c1, '=');
    room.block = (r0, c0, r1, c1) => room.fill(r0, c0, r1, c1, '#');
    room.spikes = (r, c0, c1) => room.fill(r, c0, r, c1, 'S');
    room.drips = (r, c0, c1) => room.fill(r, c0, r, c1, 'T');
    room.deco = (r, c0, c1, ch) => room.fill(r, c0, r, c1, ch || 'w');
    room.item = (c, r) => { room.items.push({ c, r }); return room; };
    room.h = (spr, y, x0, x1, per, ph, col) => { room.guardians.push({ t: 'h', spr, y, x0, x1, per, ph: ph || 0, col }); return room; };
    room.v = (spr, x, y0, y1, per, ph, col) => { room.guardians.push({ t: 'v', spr, x, y0, y1, per, ph: ph || 0, col }); return room; };
    room.at = (c, r) => { room.spawn = { x: c * 8, y: r * 8 - P.HH }; return room; };   // spawn standing with feet on top of row r
    return room;
  }

  const rooms = {};
  const add = r => { rooms[r.id] = r; return r; };
  const gy = spr => 232 - P.SPR[spr][1];   // sprite top y when walking on the ground

  /* ---------------- 1 ---------------- */
  add(mk(1, 'THE WINE CELLAR', { paper: 'k', wall: 'r', plank: 'Y', dec: 'y', hero: 'W', item: 'bottle', spike: 'W' }))
    .plank(25, 13, 19).plank(22, 4, 10).plank(19, 13, 20).plank(16, 3, 9).plank(13, 12, 18).plank(10, 3, 9).plank(7, 12, 20)
    .block(27, 2, 28, 3).block(26, 17, 28, 18).spikes(28, 8, 11).spikes(21, 6, 7)
    .deco(5, 14, 17, 'b').deco(6, 14, 17, 'b').deco(14, 2, 5, 'b').deco(15, 2, 5, 'b')
    .item(2, 26).item(15, 24).item(5, 21).item(17, 18).item(4, 15).item(14, 12).item(16, 6).item(4, 9)
    .h('rat', gy('rat'), 28, 66, 240, 0, 'w').h('bat', 124, 24, 150, 240, 90, 'M').v('spider', 120, 70, 140, 240, 0, 'G')
    .at(21, 29);

  /* ---------------- 2 ---------------- */
  add(mk(2, 'THE FRONT HALL', { paper: 'b', wall: 'C', plank: 'Y', dec: 'W', hero: 'W', item: 'key', spike: 'R' }))
    .plank(25, 2, 7).plank(21, 8, 13).plank(17, 15, 21).plank(13, 8, 13).plank(9, 2, 7).plank(25, 17, 21)
    .block(26, 14, 28, 15).drips(1, 3, 8).drips(1, 16, 20).spikes(24, 5, 6)
    .deco(8, 3, 4, 'w').deco(8, 18, 19, 'w').deco(14, 17, 18, 'w').deco(4, 3, 4, 'w').deco(19, 2, 2, '|').deco(20, 2, 2, '|').deco(21, 2, 2, '|')
    .item(3, 24).item(19, 24).item(10, 20).item(18, 16).item(10, 12).item(4, 8).item(11, 4)
    .h('ghost', gy('ghost'), 26, 100, 240, 0, 'W').h('bat', 140, 20, 150, 240, 120, 'M').v('moth', 130, 70, 150, 240, 60, 'Y')
    .at(2, 29);
  rooms[2].door = { c: 19, r: 26, w: 2, h: 3 };

  /* ---------------- 3 ---------------- */
  add(mk(3, 'THE CONSERVATORY', { paper: 'g', wall: 'k', plank: 'Y', dec: 'C', hero: 'W', item: 'gem', spike: 'R' }))
    .plank(25, 3, 8).plank(21, 12, 18).plank(17, 4, 10).plank(13, 13, 19).plank(9, 3, 9).plank(25, 17, 21).plank(5, 12, 19)
    .block(26, 12, 28, 12).spikes(28, 9, 11).spikes(28, 13, 15).spikes(20, 14, 15)
    .deco(5, 3, 5, 'w').deco(6, 3, 5, 'w').deco(14, 15, 17, 'w').deco(15, 15, 17, 'w')
    .item(5, 24).item(20, 24).item(17, 20).item(6, 16).item(16, 12).item(5, 8).item(15, 4)
    .h('moth', 140, 20, 150, 120, 0, 'Y').h('flame', gy('flame'), 112, 160, 240, 0, 'R').v('moth', 100, 150, 200, 120, 60, 'W')
    .at(2, 29);

  /* ---------------- 4 ---------------- */
  add(mk(4, 'THE LIBRARY', { paper: 'r', wall: 'Y', plank: 'W', dec: 'G', hero: 'W', item: 'book', spike: 'K' }))
    .plank(25, 3, 8).plank(21, 10, 15).plank(17, 3, 8).plank(13, 10, 14).plank(9, 3, 9).plank(25, 17, 21)
    .block(26, 4, 28, 5).drips(3, 3, 7).drips(10, 15, 19).spikes(16, 5, 6)
    .deco(14, 2, 6, 'b').deco(15, 2, 6, 'b').deco(22, 18, 21, 'b').deco(23, 18, 21, 'b').deco(18, 15, 19, 'b').deco(19, 15, 19, 'b')
    .item(5, 24).item(19, 24).item(12, 20).item(4, 16).item(12, 12).item(6, 8).item(16, 4)
    .h('skull', gy('skull'), 56, 150, 240, 0, 'C').h('bat', 150, 24, 150, 240, 100, 'W').v('spider', 88, 40, 120, 240, 0, 'K')
    .at(2, 29);

  /* ---------------- 5 ---------------- */
  add(mk(5, 'THE BALLROOM', { paper: 'm', wall: 'W', plank: 'Y', dec: 'C', hero: 'W', item: 'bell', spike: 'K' }))
    .plank(25, 2, 7).plank(21, 15, 21).plank(17, 3, 9).plank(13, 14, 20).plank(9, 3, 9).plank(5, 14, 20)
    .block(25, 18, 28, 19).drips(1, 5, 18).spikes(20, 17, 18)
    .deco(10, 2, 2, '|').deco(11, 2, 2, '|').deco(12, 2, 2, '|').deco(10, 21, 21, '|').deco(11, 21, 21, '|').deco(12, 21, 21, '|')
    .item(4, 24).item(20, 20).item(6, 16).item(17, 12).item(6, 8).item(17, 4).item(21, 28)
    .h('ghost', gy('ghost'), 36, 90, 240, 0, 'C').h('ghost', gy('ghost'), 130, 170, 240, 0, 'Y').v('bat', 100, 60, 140, 240, 0, 'K')
    .at(20, 29);

  /* ---------------- 6 ---------------- */
  add(mk(6, 'THE PORTRAIT GALLERY', { paper: 'k', wall: 'M', plank: 'C', dec: 'Y', hero: 'W', item: 'coin', spike: 'W' }))
    .plank(25, 3, 9).plank(21, 12, 18).plank(17, 4, 10).plank(13, 12, 18).plank(9, 15, 21).plank(25, 17, 21)
    .block(26, 12, 28, 13).spikes(28, 5, 8).spikes(20, 15, 16)
    .deco(8, 3, 5, 'w').deco(9, 3, 5, 'w').deco(8, 8, 10, 'w').deco(9, 8, 10, 'w').deco(18, 3, 5, 'w').deco(19, 3, 5, 'w')
    .item(5, 24).item(14, 20).item(6, 16).item(15, 12).item(18, 8).item(19, 4).item(20, 24)
    .h('skull', gy('skull'), 30, 100, 240, 0, 'Y').h('moth', 140, 20, 150, 240, 60, 'G').v('ghost', 40, 90, 170, 240, 0, 'C')
    .at(2, 29);

  /* ---------------- 7 ---------------- */
  add(mk(7, 'THE DUSTY ATTIC', { paper: 'k', wall: 'w', plank: 'y', dec: 'M', hero: 'W', item: 'cup', spike: 'R' }))
    .plank(25, 3, 9).plank(21, 10, 16).plank(17, 3, 9).plank(13, 11, 17).plank(9, 3, 9).plank(25, 18, 21)
    .block(25, 6, 28, 7).spikes(28, 9, 12).spikes(24, 4, 5).drips(1, 4, 9)
    .deco(6, 14, 18, 'w').deco(7, 14, 18, 'w').deco(16, 16, 20, 'b').deco(17, 16, 20, 'b')
    .item(8, 24).item(12, 20).item(5, 16).item(14, 12).item(5, 8).item(19, 24).item(8, 8)
    .h('rat', gy('rat'), 24, 40, 240, 0, 'M').v('spider', 100, 60, 150, 240, 0, 'G').h('bat', 100, 24, 100, 120, 30, 'R')
    .at(2, 29);

  /* ---------------- 8 ---------------- */
  add(mk(8, 'THE OBSERVATORY', { paper: 'k', wall: 'B', plank: 'G', dec: 'W', hero: 'W', item: 'star', spike: 'R' }))
    .plank(25, 3, 9).plank(21, 12, 18).plank(17, 3, 9).plank(13, 12, 18).plank(9, 3, 9).plank(5, 12, 19)
    .block(26, 20, 28, 21).drips(1, 8, 14).spikes(20, 14, 15).spikes(28, 11, 14)
    .deco(3, 4, 4, '*').deco(5, 17, 17, '*').deco(8, 14, 14, '*').deco(11, 21, 21, '*').deco(15, 20, 20, '*').deco(19, 8, 8, '*').deco(23, 12, 12, '*')
    .item(5, 24).item(17, 20).item(5, 16).item(15, 12).item(5, 8).item(14, 4).item(21, 25)
    .h('moth', 120, 20, 150, 240, 0, 'Y').h('moth', 60, 20, 150, 120, 60, 'C').v('flame', 160, 130, 218, 240, 0, 'R')
    .at(2, 29);

  /* ---------------- 9 ---------------- */
  add(mk(9, 'THE CLOCK TOWER', { paper: 'b', wall: 'Y', plank: 'W', dec: 'C', hero: 'W', item: 'cog', spike: 'R' }))
    .plank(25, 3, 9).plank(21, 12, 18).plank(17, 3, 9).plank(13, 12, 18).plank(9, 3, 9).plank(5, 10, 14)
    .block(26, 6, 28, 7).spikes(28, 9, 11).spikes(12, 14, 15).drips(1, 4, 8)
    .deco(14, 20, 21, '|').deco(15, 20, 21, '|').deco(16, 20, 21, '|').deco(17, 20, 21, '|').deco(18, 20, 21, '|')
    .item(5, 24).item(15, 20).item(5, 16).item(17, 12).item(5, 8).item(12, 4).item(21, 28)
    .h('cog', gy('cog'), 24, 110, 240, 0, 'R').v('cog', 100, 90, 190, 240, 60, 'Y').h('bat', 150, 20, 150, 120, 0, 'C')
    .at(2, 29);

  // ---------------- links ----------------
  const L = (a, b, r0, r1) => {                 // a's right wall <-> b's left wall
    rooms[a].exits.right = { room: b }; rooms[b].exits.left = { room: a };
    rooms[a].fill(r0, RW - 1, r1, RW - 1, '.'); rooms[b].fill(r0, 0, r1, 0, '.');
  };
  const V = (lo, up, c0, c1, side) => {         // lo's ceiling <-> up's floor
    rooms[lo].exits.up = { room: up }; rooms[up].exits.down = { room: lo };
    rooms[lo].fill(0, c0, 0, c1, '.'); rooms[up].fill(RH - 1, c0, RH - 1, c1, '.');
    rooms[lo].plank(5, c0 - 1, c1 + 1);
    if (side === 'L') rooms[up].plank(28, c0, c0 + 1); else rooms[up].plank(28, c1 - 1, c1);
  };
  L(1, 2, 26, 28); L(2, 3, 26, 28); L(4, 5, 26, 28); L(5, 6, 26, 28); L(7, 8, 26, 28); L(8, 9, 26, 28);
  V(2, 5, 10, 13, 'L'); V(4, 7, 15, 18, 'L'); V(6, 9, 17, 20, 'L');

  for (const id in rooms) {
    const r = rooms[id];
    r.grid = r.g.map(row => row.join(''));
    for (const k of ['fill', 'plank', 'block', 'spikes', 'drips', 'deco', 'item', 'h', 'v', 'at']) delete r[k];
    delete r.g;
  }
  const out = { rooms, order: [1, 2, 3, 4, 5, 6, 7, 8, 9], START: 2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.MMRooms = out;
})(typeof window !== 'undefined' ? window : globalThis);
