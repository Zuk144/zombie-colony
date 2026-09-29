// World state: the grid, things on it, reservations, reachability, and time helpers.
// Everything is plain data on one `w` object so it can be serialized later for saves.

import { MAP_W, MAP_H, START_HOUR, TICKS_PER_HOUR, TICKS_PER_DAY, DAYS_PER_SEASON, SEASONS, ZOMBIE } from './config.js';
import { makeRng } from './rng.js';
import { THINGS, TERRAIN, buildingValue } from './defs.js';

export function createWorld(seed) {
  const n = MAP_W * MAP_H;
  return {
    seed,
    rng: makeRng(seed),
    tick: START_HOUR * TICKS_PER_HOUR,
    speed: 1, // index into SPEEDS
    w: MAP_W,
    h: MAP_H,
    terrain: new Uint8Array(n),
    cells: Array.from({ length: n }, () => []), // things per cell (multi-cell things appear in each)
    things: new Map(), // id -> thing
    pawns: [], // survivors, zombies, looters
    zones: [],
    zoneAt: new Array(n).fill(null),
    zoneCounter: { stockpile: 0, grow: 0, shelter: 0 },
    reservations: new Map(), // key -> pawn id
    reach: new Int32Array(n), // connected-area label per cell (survivor rules), -1 = blocked
    reachDirty: true,
    zfield: new Float32Array(n).fill(Infinity), // zombie flow field: bash-aware distance to survivors
    roof: new Uint8Array(n), // 0 open sky, 1 built roof, 2 natural rock roof (mined-out mountain)
    roofArea: new Int8Array(n), // player intent: 0 automatic, 1 always roof, -1 never roof
    roomAt: new Int32Array(n).fill(-1), // index into w.rooms, -1 = outdoors (or a door)
    rooms: [], // derived: { id, cells, size, temp, role, indoors, ... } — see rooms.js
    roomsDirty: true,
    support: new Uint8Array(n), // derived: 1 where a roof would be held up (within 6 of a wall)
    outdoor: 12, // °C, updated every rare tick by climate.js
    weather: null, // { kind, offset, until } — cold snaps and heat waves
    secure: new Uint8Array(n), // derived (perimeter.js): 1 = zombies can't get here without breaking something
    secureDirty: true,
    secureCount: 0,
    networks: [], // derived (power.js): power grids
    powerNet: new Map(), // derived: thing id → index into networks
    powerDirty: true,
    din: 0, // colony noise level this rare tick (buildings.js)
    terrainDirty: [], // cells whose terrain art must be redrawn (rock mined, etc.)
    roads: [],
    nextId: 1,
    log: [],
    logSerial: 0,
    wealth: 0,
    story: null,
    stats: { zombiesKilled: 0, deaths: 0, cured: 0 },
    alarm: false,
    autoAlarm: true,
    fx: [], // transient visual events (shots, trap snaps) for the renderer; not saved
  };
}

export const idx = (w, x, y) => y * w.w + x;
export const inBounds = (w, x, y) => x >= 0 && y >= 0 && x < w.w && y < w.h;
export const thingsAt = (w, x, y) => w.cells[y * w.w + x];
export const defOf = (t) => THINGS[t.def];
const kindAt = (w, x, y, kind) => thingsAt(w, x, y).find((t) => THINGS[t.def].kind === kind);
export const itemAt = (w, x, y) => kindAt(w, x, y, 'item');
export const plantAt = (w, x, y) => kindAt(w, x, y, 'plant');
export const buildingAt = (w, x, y) => kindAt(w, x, y, 'building');
export const blueprintAt = (w, x, y) => kindAt(w, x, y, 'blueprint');
export const terrainAt = (w, x, y) => TERRAIN[w.terrain[y * w.w + x]];

export const sizeOf = (t) => {
  const d = THINGS[t.def];
  return [t.sw ?? d.size?.[0] ?? 1, t.sh ?? d.size?.[1] ?? 1];
};
// Chebyshev distance from a point to a thing's footprint (0 = on it).
export function dist(a, b) {
  if (b.def) {
    const [bw, bh] = sizeOf(b);
    const dx = Math.max(b.x - a.x, 0, a.x - (b.x + bw - 1));
    const dy = Math.max(b.y - a.y, 0, a.y - (b.y + bh - 1));
    return Math.max(dx, dy);
  }
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function allThings(w, pred) {
  const out = [];
  for (const t of w.things.values()) if (pred(t, THINGS[t.def])) out.push(t);
  return out;
}

// ---- Spawning -------------------------------------------------------------

function forFootprint(t, fn) {
  const [sw, sh] = sizeOf(t);
  for (let y = t.y; y < t.y + sh; y++) for (let x = t.x; x < t.x + sw; x++) fn(x, y);
}

export function spawn(w, def, x, y, props = {}) {
  const t = { id: w.nextId++, def, x, y, ...props };
  const d = THINGS[def];
  if (d.hp && t.hp === undefined) t.hp = d.hp;
  w.things.set(t.id, t);
  forFootprint(t, (cx, cy) => thingsAt(w, cx, cy).push(t));
  cellChanged(w, t);
  return t;
}

// Put an existing thing (from a save) back on the grid, keeping its id.
export function restoreThing(w, t) {
  w.things.set(t.id, t);
  forFootprint(t, (cx, cy) => thingsAt(w, cx, cy).push(t));
}

export function despawn(w, t) {
  if (!w.things.delete(t.id)) return;
  forFootprint(t, (cx, cy) => {
    const list = thingsAt(w, cx, cy);
    list.splice(list.indexOf(t), 1);
  });
  w.reservations.delete(tkey(t));
  cellChanged(w, t);
}

export const isSpawned = (w, t) => !!t && w.things.has(t.id);

function cellChanged(w, t) {
  const d = THINGS[t.def];
  if (d.blocks) w.reachDirty = true;
  if ((d.blocks && !d.seeThrough) || d.door) w.roomsDirty = true;
  if (d.blocks || d.door) w.secureDirty = true;
  if (d.power || d.pole) w.powerDirty = true;
  if (d.natural) forFootprint(t, (x, y) => w.terrainDirty.push(x, y));
}

// Places `count` items at (x, y), merging into same-def stacks and spilling outward (BFS)
// when the cell is full or blocked. Stack-1 items (corpses) keep their `props`; for food,
// props.rot carries spoilage, and merged stacks average it (RW does the same).
export function spawnItem(w, def, count, x, y, props) {
  const stack = THINGS[def].stack;
  const rot = props?.rot ?? 0;
  const seen = new Set([idx(w, x, y)]);
  const queue = [[x, y]];
  while (count > 0 && queue.length) {
    const [cx, cy] = queue.shift();
    if (passable(w, cx, cy)) {
      const it = itemAt(w, cx, cy);
      if (!it) {
        const n = Math.min(count, stack);
        spawn(w, def, cx, cy, { ...props, count: n });
        count -= n;
      } else if (it.def === def && it.count < stack) {
        const n = Math.min(count, stack - it.count);
        if (THINGS[def].rotDays) it.rot = ((it.rot ?? 0) * it.count + rot * n) / (it.count + n);
        it.count += n;
        count -= n;
      }
    }
    for (const [dx, dy] of DIRS.slice(0, 4)) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(w, nx, ny) || seen.has(idx(w, nx, ny)) || !passable(w, nx, ny)) continue;
      seen.add(idx(w, nx, ny));
      queue.push([nx, ny]);
    }
  }
}

export function countOnMap(w, def) {
  let n = 0;
  for (const t of w.things.values()) if (t.def === def) n += t.count;
  return n;
}

// On the map plus what survivors carry or have equipped (for "do until you have X" bills).
export function countOwned(w, def) {
  let n = countOnMap(w, def);
  for (const p of w.pawns) {
    if (p.faction !== 'colony') continue;
    if (p.weapon?.def === def) n++;
    if (def === 'ammo') n += p.ammo ?? 0;
    if (p.carrying?.def === def) n += p.carrying.count;
  }
  return n;
}

// ---- Movement, cost & reachability ---------------------------------------

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Survivor rules: walls, rock, cars block; doors don't.
export function passable(w, x, y) {
  if (!inBounds(w, x, y)) return false;
  for (const t of w.cells[y * w.w + x]) if (THINGS[t.def].blocks) return false;
  return true;
}

export const moveCost = (w, x, y) => TERRAIN[w.terrain[y * w.w + x]].cost;

// Survivors know where the traps are: passable, but they'd rather go around.
export function survivorCost(w, x, y) {
  if (!inBounds(w, x, y)) return Infinity;
  let cost = moveCost(w, x, y);
  for (const t of w.cells[y * w.w + x]) {
    const d = THINGS[t.def];
    if (d.blocks) return Infinity;
    if (d.trap && t.armed) cost += 30;
  }
  return cost;
}

// Zombie rules: doors block them too, but anything with HP can be bashed through at a cost.
export function zombieCost(w, x, y) {
  if (!inBounds(w, x, y)) return Infinity;
  let cost = moveCost(w, x, y);
  for (const t of w.cells[y * w.w + x]) {
    const d = THINGS[t.def];
    if (!d.blocks && !d.door) continue;
    if (!d.hp || t.broken) return Infinity; // a wrecked machine is just a lump in the way
    cost += 2 + t.hp * ZOMBIE.bashCostPerHp;
  }
  return cost;
}

// The building a zombie would have to bash to enter (x, y), if any.
export function bashTargetAt(w, x, y) {
  return thingsAt(w, x, y).find((t) => { const d = THINGS[t.def]; return (d.blocks || d.door) && d.hp && !t.broken; }) ?? null;
}

export function blocksSight(w, x, y) {
  for (const t of w.cells[y * w.w + x]) { const d = THINGS[t.def]; if ((d.blocks && !d.seeThrough) || d.door) return true; }
  return false;
}

// No diagonal corner-cutting past blocked cells.
export function canStep(w, x, y, dx, dy, cost = survivorCost) {
  if (cost(w, x + dx, y + dy) === Infinity) return false;
  return !(dx && dy) || (cost(w, x + dx, y) !== Infinity && cost(w, x, y + dy) !== Infinity);
}

// Flood-fill connected areas (a simplified version of RimWorld's regions) so "can this pawn
// reach that?" is an O(1) label compare instead of a pathfind.
function rebuildReach(w) {
  w.reach.fill(-1);
  let group = 0;
  const stack = [];
  for (let i = 0; i < w.reach.length; i++) {
    if (w.reach[i] !== -1 || !passable(w, i % w.w, (i / w.w) | 0)) continue;
    w.reach[i] = group;
    stack.push(i);
    while (stack.length) {
      const c = stack.pop();
      const cx = c % w.w, cy = (c / w.w) | 0;
      for (const [dx, dy] of DIRS) {
        if (!canStep(w, cx, cy, dx, dy)) continue;
        const n = c + dy * w.w + dx;
        if (w.reach[n] === -1) {
          w.reach[n] = group;
          stack.push(n);
        }
      }
    }
    group++;
  }
  w.reachDirty = false;
}

export function reachGroup(w, x, y) {
  if (w.reachDirty) rebuildReach(w);
  return w.reach[idx(w, x, y)];
}

// touch = stand next to the target's footprint (needed for blocked targets like rock or walls).
export function canReach(w, p, x, y, touch, sw = 1, sh = 1) {
  const g = reachGroup(w, p.x, p.y);
  if (g < 0) return false;
  if (!touch) return inBounds(w, x, y) && w.reach[idx(w, x, y)] === g;
  for (let cy = y - 1; cy <= y + sh; cy++) for (let cx = x - 1; cx <= x + sw; cx++) {
    const inside = cx >= x && cx < x + sw && cy >= y && cy < y + sh;
    if (!inside && inBounds(w, cx, cy) && w.reach[idx(w, cx, cy)] === g) return true;
  }
  return false;
}
export const canReachThing = (w, p, t) => canReach(w, p, t.x, t.y, true, ...sizeOf(t));

export function randomReachableCell(w, p, radius, pred = () => true) {
  const g = reachGroup(w, p.x, p.y);
  for (let tries = 0; tries < 25; tries++) {
    const x = p.x + w.rng.int(-radius, radius), y = p.y + w.rng.int(-radius, radius);
    if (inBounds(w, x, y) && w.reach[idx(w, x, y)] === g && !buildingAt(w, x, y) && pred(x, y)) return { x, y };
  }
  return null;
}

export function findEdgeCell(w, p) {
  const seen = new Set([idx(w, p.x, p.y)]);
  const queue = [[p.x, p.y]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === 0 || y === 0 || x === w.w - 1 || y === w.h - 1) return { x, y };
    for (const [dx, dy] of DIRS) {
      if (!canStep(w, x, y, dx, dy)) continue;
      const k = idx(w, x + dx, y + dy);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return null;
}

// ---- Reservations ---------------------------------------------------------

export const tkey = (t) => 't' + t.id;
export const ckey = (w, x, y) => 'c' + idx(w, x, y);

export function reservedByOther(w, key, p) {
  const r = w.reservations.get(key);
  return r !== undefined && r !== p.id;
}
export const reserve = (w, p, key) => w.reservations.set(key, p.id);
export function releaseAll(w, p) {
  for (const [k, id] of w.reservations) if (id === p.id) w.reservations.delete(k);
}

// ---- Colony-level helpers -------------------------------------------------

export const colonists = (w) => w.pawns.filter((p) => p.faction === 'colony');
export const pawnById = (w, id) => w.pawns.find((p) => p.id === id) ?? null;
export const zombies = (w) => w.pawns.filter((p) => p.faction === 'zombie');

export function colonyWealth(w) {
  let v = 0;
  for (const t of w.things.values()) {
    const d = THINGS[t.def];
    if (d.kind === 'item') v += d.value * t.count;
    else if (d.kind === 'building' && d.cost) v += buildingValue(d);
  }
  return Math.round(v);
}

// `at` = {x, y} lets the player tap the letter to jump there.
export function letter(w, text, tone = 'neutral', at = null) {
  w.logSerial++;
  w.log.push({ id: w.logSerial, tick: w.tick, text, tone, at: at && { x: at.x, y: at.y } });
  if (w.log.length > 80) w.log.shift();
}

// ---- Time -----------------------------------------------------------------

export const dayOf = (tick) => Math.floor(tick / TICKS_PER_DAY);
export const hourOf = (tick) => Math.floor((tick % TICKS_PER_DAY) / TICKS_PER_HOUR);
export const hourFloat = (tick) => (tick % TICKS_PER_DAY) / TICKS_PER_HOUR;
export const isNight = (tick) => { const h = hourFloat(tick); return h >= 20 || h < 5; };

export function dateParts(tick) {
  const day = dayOf(tick);
  return {
    day: day + 1,
    time: `${String(hourOf(tick)).padStart(2, '0')}:00`,
    season: SEASONS[Math.floor(day / DAYS_PER_SEASON) % SEASONS.length],
    year: Math.floor(day / (DAYS_PER_SEASON * SEASONS.length)) + 1,
  };
}
export function dateString(tick) {
  const d = dateParts(tick);
  return `Day ${d.day} · ${d.time} · ${d.season}, year ${d.year}`;
}
