// Zones: stockpiles (RimWorld's 5 priorities + item filter), growing zones, and shelter zones
// (where survivors set to Flee run when zombies show up).

import { THINGS } from './defs.js';
import { idx, inBounds, passable, terrainAt, itemAt, reachGroup, reservedByOther, ckey, dist } from './world.js';

export const STOCK_PRIORITIES = ['Low', 'Normal', 'Preferred', 'Important', 'Critical']; // index + 1
const ITEM_DEFS = Object.keys(THINGS).filter((k) => THINGS[k].kind === 'item');

// Stockpile presets. An ammo cache is a small, top-priority stockpile for rounds and fuel near
// the guns: haulers fill it in quiet times, runners grab from it in a fight.
const PRESETS = {
  cache: (n) => ({ label: `Ammo cache ${n}`, priority: 5, allow: new Set(['ammo', 'biofuel']) }),
};

function createZone(w, type, preset = null) {
  const n = preset ? (w.zoneCounter[preset] = (w.zoneCounter[preset] ?? 0) + 1) : ++w.zoneCounter[type];
  const z = { id: w.nextId++, type, cells: new Set() };
  if (preset) Object.assign(z, { preset }, PRESETS[preset](n));
  else if (type === 'stockpile') Object.assign(z, { label: `Stockpile ${n}`, priority: 2, allow: new Set(ITEM_DEFS.filter((k) => !THINGS[k].corpse)) });
  else if (type === 'grow') Object.assign(z, { label: `Growing zone ${n}`, crop: 'riceCrop' });
  else Object.assign(z, { label: `Shelter ${n}` });
  w.zones.push(z);
  return z;
}

function zoneable(w, type, x, y) {
  if (!inBounds(w, x, y) || w.zoneAt[idx(w, x, y)] || !passable(w, x, y)) return false;
  const terr = terrainAt(w, x, y);
  if (terr.noZone) return false;
  return type !== 'grow' || terr.fertility >= 0.5;
}

export function addZoneCells(w, type, cells, preset = null) {
  const valid = cells.filter(([x, y]) => zoneable(w, type, x, y));
  if (!valid.length) return null;
  let zone = null;
  outer: for (const [x, y] of valid) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const z = inBounds(w, x + dx, y + dy) && w.zoneAt[idx(w, x + dx, y + dy)];
      if (z && z.type === type && (z.preset ?? null) === preset) { zone = z; break outer; }
    }
  }
  zone ??= createZone(w, type, preset);
  for (const [x, y] of valid) {
    zone.cells.add(idx(w, x, y));
    w.zoneAt[idx(w, x, y)] = zone;
  }
  return zone;
}

export function removeZoneCells(w, cells) {
  for (const [x, y] of cells) {
    if (!inBounds(w, x, y)) continue;
    const i = idx(w, x, y);
    w.zoneAt[i]?.cells.delete(i);
    w.zoneAt[i] = null;
  }
  w.zones = w.zones.filter((z) => z.cells.size);
}

export function storagePriority(w, x, y, def) {
  const z = w.zoneAt[idx(w, x, y)];
  return z && z.type === 'stockpile' && z.allow.has(def) ? z.priority : 0;
}

// Best cell to haul `item` to: the highest-priority stockpile above where it sits now that
// accepts it and has room, nearest cell within that priority. (RW behavior.)
export function findStorageCell(w, p, item) {
  const cur = storagePriority(w, item.x, item.y, item.def);
  const g = reachGroup(w, p.x, p.y);
  const stack = THINGS[item.def].stack;
  let best = null, bestPri = cur, bestD = Infinity;
  for (const z of w.zones) {
    if (z.type !== 'stockpile' || !z.allow.has(item.def) || z.priority <= cur || z.priority < bestPri) continue;
    for (const i of z.cells) {
      const x = i % w.w, y = (i / w.w) | 0;
      if (w.reach[i] !== g || reservedByOther(w, ckey(w, x, y), p)) continue;
      const it = itemAt(w, x, y);
      if (it && (it.def !== item.def || it.count >= stack)) continue;
      const d = dist(item, { x, y });
      if (z.priority > bestPri || d < bestD) {
        best = { x, y, count: it ? stack - it.count : stack };
        bestPri = z.priority;
        bestD = d;
      }
    }
  }
  return best;
}
