// The secure yard (docs/DESIGN.md §9): every cell a zombie can't reach from the map edge
// without breaking something (a fence, wall, door or gate). Only pockets the colony closed off
// count: a sealed room inside a ruin isn't your yard. Rebuilt whenever a blocking building
// appears or disappears. A zombie standing inside it is a breach.

import { THINGS } from './defs.js';
import { DIRS, inBounds, passable, zombieCost, bashTargetAt, buildingAt, letter } from './world.js';

const zWalkable = (w, x, y) => zombieCost(w, x, y) !== Infinity && !bashTargetAt(w, x, y);

function rebuild(w) {
  const n = w.w * w.h;
  const reached = new Uint8Array(n);
  const queue = [];
  for (let x = 0; x < w.w; x++) for (const y of [0, w.h - 1]) if (zWalkable(w, x, y)) { reached[y * w.w + x] = 1; queue.push(y * w.w + x); }
  for (let y = 0; y < w.h; y++) for (const x of [0, w.w - 1]) if (zWalkable(w, x, y) && !reached[y * w.w + x]) { reached[y * w.w + x] = 1; queue.push(y * w.w + x); }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q], cx = c % w.w, cy = (c / w.w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(w, nx, ny) || reached[ny * w.w + nx] || !zWalkable(w, nx, ny)) continue;
      // Same no-corner-squeezing rule zombies move by.
      if (dx && dy && !(zWalkable(w, cx + dx, cy) && zWalkable(w, cx, cy + dy))) continue;
      reached[ny * w.w + nx] = 1;
      queue.push(ny * w.w + nx);
    }
  }
  // Group the unreached open cells into pockets; keep a pocket if anything bounding it was built.
  w.secure.fill(0);
  const seen = new Uint8Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (reached[i] || seen[i] || !passable(w, i % w.w, (i / w.w) | 0)) continue;
    const pocket = [i];
    let built = false;
    seen[i] = 1;
    for (let q = 0; q < pocket.length; q++) {
      const c = pocket[q], cx = c % w.w, cy = (c / w.w) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy, ni = ny * w.w + nx;
        if (!inBounds(w, nx, ny) || seen[ni] || reached[ni]) continue;
        if (passable(w, nx, ny) && zWalkable(w, nx, ny)) { seen[ni] = 1; pocket.push(ni); continue; }
        const b = buildingAt(w, nx, ny);
        if (b && THINGS[b.def].cost) built = true;
        if (passable(w, nx, ny)) { seen[ni] = 1; pocket.push(ni); } // doors and gates are part of the yard
      }
    }
    if (!built) continue;
    for (const c of pocket) w.secure[c] = 1;
    count += pocket.length;
  }
  w.secureCount = count;
  w.secureDirty = false;
}

export function tickPerimeter(w) {
  if (w.secureDirty) rebuild(w);
  const inside = w.pawns.filter((z) => z.faction === 'zombie' && w.secure[z.y * w.w + z.x]);
  w.breach = inside.length;
  if (inside.length && w.tick - (w.lastBreachAlert ?? -1e9) > 3000) {
    w.lastBreachAlert = w.tick;
    letter(w, `Breach! ${inside.length > 1 ? `${inside.length} zombies are` : 'A zombie is'} inside the fence.`, 'bad', inside[0]);
  }
}

export const isSecure = (w, x, y) => w.secure[y * w.w + x] === 1;
