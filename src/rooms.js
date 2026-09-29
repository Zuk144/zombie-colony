// Rooms and roofs. See docs/RESEARCH.md "Rooms" and "Temperature".
//
// A room is a 4-connected area bounded by walls, doors, and rock (so corners don't need to be
// filled, as in RW). Anything touching the map edge, or bigger than ROOMS.maxCells, is
// outdoors. Rooms are rebuilt whenever a wall or door appears or disappears. Their contents
// (beds, tables...) are re-read every rare tick for role and impressiveness.
//
// Roofs: enclosed rooms get roofed automatically by builders (RW auto "build roof area"),
// and the player can mark cells "always roof" or "never roof". A built roof needs a wall
// within 6 cells (RW) and collapses without one. Mining deep into rock leaves a natural roof.

import { ROOMS } from './config.js';
import { THINGS, IMPRESSIVENESS, buildingValue } from './defs.js';
import { idx, inBounds, thingsAt, DIRS } from './world.js';

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Room boundary: walls, rock, cars (but not see-through barricades), and doors.
export function isBoundary(w, i) {
  for (const t of w.cells[i]) {
    const d = THINGS[t.def];
    if ((d.blocks && !d.seeThrough) || d.door) return true;
  }
  return false;
}
const holdsRoof = (w, i) => w.cells[i].some((t) => { const d = THINGS[t.def]; return d.blocks && !d.seeThrough; });

export const roomOf = (w, x, y) => { const r = w.roomAt[idx(w, x, y)]; return r >= 0 ? w.rooms[r] : null; };
export const tempAt = (w, x, y) => roomOf(w, x, y)?.temp ?? w.outdoor;
export const isRoofed = (w, x, y) => w.roof[idx(w, x, y)] > 0;

// Rebuild rooms and roof support. Temperatures carry over from whatever rooms the cells were
// in before (or from a save), so knocking down a wall doesn't reset a heated room.
// Returns the cells whose built roof just lost its support (the caller handles the collapse).
export function rebuildRooms(w) {
  const n = w.w * w.h;
  const prevAt = Int32Array.from(w.roomAt), prevRooms = w.rooms;
  const saved = w.pendingRoomTemps; // from a save: Map(one cell of each room → that room's temp)
  w.roomAt.fill(-1);
  w.rooms = [];
  const seen = new Uint8Array(n);
  const stack = [];
  for (let s = 0; s < n; s++) {
    if (seen[s] || isBoundary(w, s)) continue;
    const cells = [];
    let edge = false;
    seen[s] = 1;
    stack.push(s);
    while (stack.length) {
      const c = stack.pop();
      cells.push(c);
      const cx = c % w.w, cy = (c / w.w) | 0;
      if (cx === 0 || cy === 0 || cx === w.w - 1 || cy === w.h - 1) edge = true;
      for (const [dx, dy] of N4) {
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(w, nx, ny)) continue;
        const ni = ny * w.w + nx;
        if (!seen[ni] && !isBoundary(w, ni)) { seen[ni] = 1; stack.push(ni); }
      }
    }
    if (edge || cells.length > ROOMS.maxCells) continue;
    let temp = null, sum = 0;
    if (saved) for (const c of cells) if (saved.has(c)) { temp = saved.get(c); break; }
    for (const c of cells) sum += prevAt[c] >= 0 ? prevRooms[prevAt[c]].temp : w.outdoor;
    const room = { id: w.rooms.length, cells, size: cells.length, temp: temp ?? sum / cells.length };
    for (const c of cells) w.roomAt[c] = room.id;
    w.rooms.push(room);
  }
  w.pendingRoomTemps = null;

  // Roof support: Chebyshev distance ≤ supportRange from anything that holds a roof.
  w.support.fill(0);
  const dist = new Int16Array(n).fill(-1);
  const queue = [];
  for (let i = 0; i < n; i++) if (holdsRoof(w, i)) { dist[i] = 0; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q];
    w.support[c] = 1;
    if (dist[c] >= ROOMS.supportRange) continue;
    const cx = c % w.w, cy = (c / w.w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(w, nx, ny)) continue;
      const ni = ny * w.w + nx;
      if (dist[ni] === -1) { dist[ni] = dist[c] + 1; queue.push(ni); }
    }
  }
  const collapsed = [];
  for (let i = 0; i < n; i++) if (w.roof[i] === 1 && !w.support[i]) { w.roof[i] = 0; collapsed.push(i); }
  w.roomsDirty = false;
  for (const r of w.rooms) updateRoomStats(w, r);
  return collapsed;
}

// Role, impressiveness, and roof coverage from what's in the room right now.
export function updateRoomStats(w, r) {
  const inside = new Set(), walls = new Set();
  let roofed = 0;
  for (const c of r.cells) {
    if (w.roof[c]) roofed++;
    for (const t of w.cells[c]) if (THINGS[t.def].kind === 'building') inside.add(t);
    const cx = c % w.w, cy = (c / w.w) | 0;
    for (const [dx, dy] of N4) {
      if (!inBounds(w, cx + dx, cy + dy)) continue;
      for (const t of thingsAt(w, cx + dx, cy + dy)) if (THINGS[t.def].cost && (THINGS[t.def].wallLike || THINGS[t.def].door)) walls.add(t);
    }
  }
  const has = (flag) => [...inside].filter((t) => THINGS[t.def][flag]);
  const beds = has('bed').length;
  r.roofed = roofed / r.size;
  r.indoors = r.roofed >= ROOMS.enclosedRoofed;
  r.role = beds === 1 ? 'bedroom' : beds > 1 ? 'barracks' : has('table').length ? 'dining'
    : [...inside].some((t) => t.def === 'campfire' || t.def === 'woodStove') ? 'kitchen'
    : [...inside].some((t) => t.def === 'workbench') ? 'workshop' : 'room';
  // Impressiveness (simplified RW): space and wealth, weighted toward the weaker of the two.
  let wealth = 0;
  for (const t of inside) wealth += buildingValue(THINGS[t.def]);
  for (const t of walls) wealth += buildingValue(THINGS[t.def]) / 2;
  const space = Math.min(240, r.size * 2), rich = Math.min(300, wealth / 4);
  r.wealth = Math.round(wealth);
  r.impressiveness = Math.round(0.7 * Math.min(space, rich) + 0.3 * Math.max(space, rich));
  r.level = IMPRESSIVENESS.findLastIndex((l) => r.impressiveness >= l.min);
}

// ---- Roof work ----------------------------------------------------------------

export function roofWantedAt(w, i) {
  if (w.roof[i] || !w.support[i] || w.roofArea[i] === -1 || isBoundary(w, i)) return false;
  if (w.roofArea[i] === 1) return true;
  const r = w.roomAt[i];
  return r >= 0 && w.rooms[r].size <= ROOMS.maxAutoRoof;
}
export const unroofWantedAt = (w, i) => w.roof[i] === 1 && w.roofArea[i] === -1;

export function roofTargets(w) {
  const out = [];
  for (const r of w.rooms) if (r.size <= ROOMS.maxAutoRoof) for (const c of r.cells) if (roofWantedAt(w, c)) out.push(c);
  for (let i = 0; i < w.roofArea.length; i++) {
    if (w.roofArea[i] === 1 && w.roomAt[i] < 0 && roofWantedAt(w, i)) out.push(i);
    else if (unroofWantedAt(w, i)) out.push(i);
  }
  return out.map((i) => ({ x: i % w.w, y: (i / w.w) | 0, i, remove: w.roof[i] === 1 }));
}

// RW builds a 3×3 patch of roof per job.
export function applyRoofWork(w, x, y, remove) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!inBounds(w, x + dx, y + dy)) continue;
    const i = idx(w, x + dx, y + dy);
    if (remove ? unroofWantedAt(w, i) : roofWantedAt(w, i)) w.roof[i] = remove ? 0 : 1;
  }
  for (const r of w.rooms) updateRoomStats(w, r);
}

// A cell mined out of solid rock keeps a natural rock roof if it's mostly surrounded by rock.
export function roofAfterMining(w, x, y) {
  let rock = 0;
  for (const [dx, dy] of DIRS) if (inBounds(w, x + dx, y + dy) && thingsAt(w, x + dx, y + dy).some((t) => THINGS[t.def].natural)) rock++;
  if (rock >= 4) w.roof[idx(w, x, y)] = 2;
}
