// Procedural map: terrain from noise, then roads, ruined buildings with loot, wrecked cars,
// vegetation, and a few of the dead already wandering around.

import { TERRAIN, TERRAIN_INDEX } from './defs.js';
import { spawn, despawn, spawnItem, thingsAt, inBounds, idx, buildingAt, terrainAt } from './world.js';
import { makeZombie } from './pawn.js';

const smooth = (t) => t * t * (3 - 2 * t);

// Value noise, a few octaves, stretched to 0..1 over the whole map.
function noiseField(w, octaves) {
  const out = new Float32Array(w.w * w.h);
  for (const [size, amp] of octaves) {
    const gw = Math.ceil(w.w / size) + 2;
    const grid = Array.from({ length: gw * (Math.ceil(w.h / size) + 2) }, () => w.rng.next());
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      const fx = x / size, fy = y / size, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const sx = smooth(fx - x0), sy = smooth(fy - y0);
      const v = (i, j) => grid[(y0 + j) * gw + x0 + i];
      const top = v(0, 0) + (v(1, 0) - v(0, 0)) * sx;
      const bot = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
      out[y * w.w + x] += (top + (bot - top) * sy) * amp;
    }
  }
  let min = Infinity, max = -Infinity;
  for (const v of out) { min = Math.min(min, v); max = Math.max(max, v); }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / (max - min);
  return out;
}

const setTerrain = (w, x, y, key) => { w.terrain[idx(w, x, y)] = TERRAIN_INDEX[key]; };
function clearCell(w, x, y) { for (const t of [...thingsAt(w, x, y)]) despawn(w, t); }

export function generateMap(w) {
  const { rng } = w;
  const cx = w.w >> 1, cy = w.h >> 1;
  const elev = noiseField(w, [[28, 1], [12, 0.5], [5, 0.25]]);
  const moist = noiseField(w, [[20, 1], [8, 0.4]]);

  for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
    const i = y * w.w + x;
    const d = Math.hypot(x - cx, y - cy);
    let e = elev[i];
    if (d < 12) e = Math.min(Math.max(e, 0.35), 0.5 + d * 0.01); // keep the starting clearing open and dry
    const m = moist[i];
    setTerrain(w, x, y, e < 0.18 ? 'water' : e < 0.24 ? 'sand' : e > 0.64 ? 'gravel' : m > 0.6 ? 'richSoil' : 'soil');
    if (e > 0.7) spawn(w, 'rock', x, y);
  }

  const occupied = []; // rects that later features must avoid
  const roads = placeRoads(w, cx, cy);
  placeRuins(w, roads, occupied, cx, cy);
  placeCars(w, roads, occupied);

  // Vegetation last, only on open natural ground.
  for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
    const i = y * w.w + x;
    if (Math.hypot(x - cx, y - cy) < 5 || thingsAt(w, x, y).length || TERRAIN[w.terrain[i]].fertility < 0.5) continue;
    if (occupied.some((r) => x >= r.x0 - 1 && x <= r.x1 + 1 && y >= r.y0 - 1 && y <= r.y1 + 1)) continue;
    if (rng.chance(0.055 + moist[i] * 0.09)) spawn(w, 'tree', x, y, { growth: rng.range(0.5, 1) });
    else if (rng.chance(0.012)) spawn(w, 'berryBush', x, y, { growth: rng.range(0.3, 1) });
    else if (rng.chance(0.003)) spawn(w, 'herbPlant', x, y, { growth: rng.range(0.4, 1) });
  }

  // The dead are already out there.
  for (let n = 0, tries = 0; n < 5 && tries < 500; tries++) {
    const x = rng.int(0, w.w - 1), y = rng.int(0, w.h - 1);
    if (Math.hypot(x - cx, y - cy) < 38 || thingsAt(w, x, y).some((t) => t.def === 'rock' || t.def === 'ruinWall' || t.def === 'car')) continue;
    w.pawns.push(makeZombie(w, x, y));
    n++;
  }
}

// A 3-wide road across the map (plus sometimes a crossing one), gently meandering.
function placeRoads(w, cx, cy) {
  const { rng } = w;
  const roads = [];
  const make = (horizontal) => {
    const len = horizontal ? w.w : w.h;
    const base = (horizontal ? cy : cx) + rng.pick([-1, 1]) * rng.int(9, 18);
    const phase = rng.range(0, Math.PI * 2), amp = rng.range(1, 3), freq = rng.range(18, 30);
    const pts = [];
    for (let s = 0; s < len; s++) {
      const off = base + Math.round(Math.sin(s / freq + phase) * amp);
      for (let k = -1; k <= 1; k++) {
        const x = horizontal ? s : off + k, y = horizontal ? off + k : s;
        if (!inBounds(w, x, y)) continue;
        clearCell(w, x, y);
        setTerrain(w, x, y, 'asphalt');
      }
      pts.push(horizontal ? [s, off] : [off, s]);
    }
    const road = { horizontal, pts };
    roads.push(road);
    w.roads.push(road);
  };
  make(rng.chance(0.5));
  if (rng.chance(0.65)) make(!roads[0].horizontal);
  return roads;
}

// [def, min, max, weight]
const LOOT = [['cannedFood', 4, 10, 3], ['scrap', 8, 20, 3], ['wood', 10, 25, 2], ['berries', 10, 20, 1],
  ['medkit', 1, 3, 1], ['herbs', 2, 5, 1], ['ammo', 10, 25, 1], ['machete', 1, 1, 0.4], ['rifle', 1, 1, 0.15], ['components', 1, 3, 1.2]];

function placeRuins(w, roads, occupied, cx, cy) {
  const { rng } = w;
  const want = rng.int(4, 6);
  for (let tries = 0, made = 0; made < want && tries < 120; tries++) {
    const road = rng.pick(roads);
    const [px, py] = rng.pick(road.pts);
    const rw = rng.int(5, 9), rh = rng.int(4, 7);
    const side = rng.pick([-1, 1]), gap = rng.int(3, 5);
    const x0 = road.horizontal ? px - (rw >> 1) : side > 0 ? px + gap : px - gap - rw + 1;
    const y0 = road.horizontal ? (side > 0 ? py + gap : py - gap - rh + 1) : py - (rh >> 1);
    const r = { x0, y0, x1: x0 + rw - 1, y1: y0 + rh - 1 };
    if (!ruinFits(w, r, occupied, cx, cy)) continue;
    occupied.push(r);
    made++;

    // Door gap on the side facing the road.
    const doorAt = road.horizontal
      ? [x0 + rng.int(1, rw - 2), side > 0 ? r.y0 : r.y1]
      : [side > 0 ? r.x0 : r.x1, y0 + rng.int(1, rh - 2)];
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      clearCell(w, x, y);
      setTerrain(w, x, y, 'concrete');
      const edge = x === r.x0 || x === r.x1 || y === r.y0 || y === r.y1;
      const isDoor = x === doorAt[0] && y === doorAt[1];
      if (edge && !isDoor && rng.chance(0.78)) spawn(w, 'ruinWall', x, y, { hp: rng.int(120, 250) });
    }
    // Loot piles inside.
    const piles = rng.int(2, 4);
    for (let i = 0; i < piles; i++) {
      let roll = rng.next() * LOOT.reduce((s, l) => s + l[3], 0);
      const [def, a, b] = LOOT.find((l) => (roll -= l[3]) < 0);
      spawnItem(w, def, rng.int(a, b), rng.int(r.x0 + 1, r.x1 - 1), rng.int(r.y0 + 1, r.y1 - 1));
    }
    if (rng.chance(0.35)) w.pawns.push(makeZombie(w, rng.int(r.x0 + 1, r.x1 - 1), rng.int(r.y0 + 1, r.y1 - 1), { idle: 3000 }));
  }
}

function ruinFits(w, r, occupied, cx, cy) {
  if (r.x0 < 1 || r.y0 < 1 || r.x1 >= w.w - 1 || r.y1 >= w.h - 1) return false;
  if (Math.hypot((r.x0 + r.x1) / 2 - cx, (r.y0 + r.y1) / 2 - cy) < 16) return false;
  if (occupied.some((o) => r.x0 <= o.x1 + 2 && r.x1 >= o.x0 - 2 && r.y0 <= o.y1 + 2 && r.y1 >= o.y0 - 2)) return false;
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    const k = terrainAt(w, x, y).key;
    if (k === 'water' || k === 'asphalt') return false;
  }
  return true;
}

function placeCars(w, roads, occupied) {
  const { rng } = w;
  const n = rng.int(9, 13); // each strips for 25 scrap and 2 components
  for (let i = 0, tries = 0; i < n && tries < 100; tries++) {
    const road = rng.pick(roads);
    const [px, py] = rng.pick(road.pts);
    const lane = rng.pick([-1, 1]);
    const [x, y, sw, sh] = road.horizontal ? [px, py + lane, 2, 1] : [px + lane, py, 1, 2];
    let ok = true;
    for (let yy = y; yy < y + sh; yy++) for (let xx = x; xx < x + sw; xx++) if (!inBounds(w, xx, yy) || buildingAt(w, xx, yy)) ok = false;
    if (!ok) continue;
    for (let yy = y; yy < y + sh; yy++) for (let xx = x; xx < x + sw; xx++) clearCell(w, xx, yy);
    spawn(w, 'car', x, y, { sw, sh, tint: rng.pick(['#7b3b36', '#3e5a74', '#6b6f5a', '#8a7a4e', '#4f4f55', '#2f5d52']), hp: rng.int(350, 600) });
    occupied.push({ x0: x, y0: y, x1: x + sw - 1, y1: y + sh - 1 });
    i++;
  }
}
