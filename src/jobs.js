// Jobs = a list of Toils (small steps) plus fail conditions and reservations — RimWorld's
// Job / JobDriver / Toil split. A toil is { init?(w,p,j), tick?(w,p,j) }; either may return
// DONE (advance) or FAIL (abort the job). Toils without `tick` finish instantly.
//
// Job fields: def, kind ('need'|'work'|'joy'|'idle'|'mental'|'combat'|'guard'), report (UI
// text), toils, reserve (keys taken on start), failIf(w,p,j) every tick, onEnd(w,p,j,outcome).

import { MOVE_CELLS_PER_TICK, CARRY_CAPACITY, TICKS_PER_HOUR, COMFORT, ROOMS } from './config.js';
import { THINGS, RECIPES, salvageYield, salvageWork, ingKey } from './defs.js';
import { findPath } from './path.js';
import {
  passable, moveCost, isSpawned, spawn, despawn, spawnItem, reserve, releaseAll, reservedByOther,
  tkey, ckey, plantAt, buildingAt, blueprintAt, itemAt, canReach, canReachThing, allThings, dist, letter,
  randomReachableCell, findEdgeCell, colonists, sizeOf, pawnById, DIRS,
} from './world.js';
import { learn, workSpeed, exposureSlow, REST_GAIN, JOY_GAIN } from './pawn.js';
import { addMemory } from './mood.js';
import { roomOf, tempAt, isRoofed, applyRoofWork, roofAfterMining } from './rooms.js';

export const DONE = 'done';
export const FAIL = 'fail';
const label = (def) => THINGS[def].label.toLowerCase();

// ---- Runner ---------------------------------------------------------------

export function startJob(w, p, job) {
  p.job = job;
  p.inBed = null;
  job.toil = -1;
  for (const key of job.reserve ?? []) reserve(w, p, key);
  nextToil(w, p);
}

function nextToil(w, p) {
  const job = p.job;
  while (p.job === job) {
    job.toil++;
    if (job.toil >= job.toils.length) return endJob(w, p, DONE);
    const t = job.toils[job.toil];
    const r = t.init ? t.init(w, p, job) : undefined;
    if (r === FAIL) return endJob(w, p, FAIL);
    if (t.tick && r !== DONE) return;
  }
}

export function tickJob(w, p) {
  const job = p.job;
  if (job.failIf?.(w, p, job)) return endJob(w, p, FAIL);
  const r = job.toils[job.toil].tick(w, p, job);
  if (r === DONE) nextToil(w, p);
  else if (r === FAIL) endJob(w, p, FAIL);
}

export function endJob(w, p, outcome) {
  const job = p.job;
  if (!job) return;
  p.job = null;
  p.move = null;
  p.asleep = false;
  p.lying = false;
  p.onPost = null;
  p.inBed = null;
  p.lastOutcome = outcome;
  releaseAll(w, p);
  job.onEnd?.(w, p, job, outcome);
  dropCarried(w, p);
  releaseCarriedPawn(p);
}

export function dropCarried(w, p) {
  if (!p.carrying) return;
  spawnItem(w, p.carrying.def, p.carrying.count, p.x, p.y, p.carrying.props);
  p.carrying = null;
}

function releaseCarriedPawn(p) {
  const c = p.carryingPawn;
  if (!c) return;
  c.carriedBy = null;
  c.x = p.x;
  c.y = p.y;
  p.carryingPawn = null;
}

// ---- Toils ----------------------------------------------------------------

// A goal for findPath from a thing (uses its footprint) or a plain {x, y} cell.
export const goalOf = (t, touch) => {
  const [gw, gh] = t.def ? sizeOf(t) : [1, 1];
  return { x: t.x, y: t.y, w: gw, h: gh, touch };
};

// getTarget(j, w, p) -> thing or {x, y}
export const goTo = (getTarget, touch) => ({
  init(w, p, j) {
    const t = getTarget(j, w, p);
    if (!t) return FAIL;
    const path = findPath(w, p.x, p.y, goalOf(t, touch));
    if (!path) return FAIL;
    if (!path.length) return DONE;
    p.move = { path, i: 0, progress: 0 };
  },
  tick: (w, p) => stepMove(w, p),
});

export function stepMove(w, p) {
  const m = p.move;
  if (!m) return DONE;
  const [nx, ny] = m.path[m.i];
  if (!passable(w, nx, ny)) {
    p.move = null;
    return FAIL;
  }
  p.facing = Math.atan2(ny - p.y, nx - p.x);
  const diag = nx !== p.x && ny !== p.y;
  const hurt = p.maxHp ? 0.6 + 0.4 * Math.min(1, p.hp / p.maxHp) : 1;
  const burden = p.carryingPawn ? 0.7 : 1;
  m.progress += (MOVE_CELLS_PER_TICK * (p.speed ?? 1) * hurt * burden * exposureSlow(p)) / (moveCost(w, nx, ny) * (diag ? Math.SQRT2 : 1));
  if (m.progress < 1) return;
  m.progress = 0;
  p.x = nx;
  p.y = ny;
  if (p.carryingPawn) { p.carryingPawn.x = nx; p.carryingPawn.y = ny; }
  if (++m.i >= m.path.length) {
    p.move = null;
    return DONE;
  }
}

export const face = (p, t) => { if (t.x !== p.x || t.y !== p.y) p.facing = Math.atan2(t.y - p.y, t.x - p.x); };

export const instant = (fn) => ({ init: fn });

export const wait = (ticks, onTick) => ({
  init(w, p, j) { j.waitLeft = typeof ticks === 'function' ? ticks(w, p, j) : ticks; },
  tick(w, p, j) {
    const r = onTick?.(w, p, j);
    if (r) return r;
    if (--j.waitLeft <= 0) return DONE;
  },
});

// Progress-bar work, sped up by skill, granting XP each tick.
export const work = ({ amount, skill, onDone, target }) => ({
  init(w, p, j) {
    j.workTotal = j.workLeft = amount(w, p, j);
    if (target) face(p, target(j));
  },
  tick(w, p, j) {
    j.workLeft -= workSpeed(p, skill);
    if (skill) learn(p, skill, 0.1);
    if (j.workLeft > 0) return;
    j.workTotal = 0;
    onDone(w, p, j);
    return DONE;
  },
});

export const pickUp = (key, max) => instant((w, p, j) => {
  const item = j[key];
  if (!isSpawned(w, item) || (p.carrying && p.carrying.def !== item.def)) return FAIL;
  const n = Math.min(item.count, max(w, p, j), CARRY_CAPACITY - (p.carrying?.count ?? 0));
  if (n <= 0) return FAIL;
  item.count -= n;
  const { id, def, x, y, count, ...props } = item;
  if (item.count <= 0) despawn(w, item);
  const had = p.carrying?.count ?? 0;
  const rot = THINGS[def].rotDays ? ((p.carrying?.props?.rot ?? 0) * had + (item.rot ?? 0) * n) / (had + n) : undefined;
  p.carrying = { def: item.def, count: had + n, props: THINGS[def].stack === 1 ? props : rot !== undefined ? { rot } : undefined };
});

const dropAt = (key) => instant((w, p, j) => {
  spawnItem(w, p.carrying.def, p.carrying.count, j[key].x, j[key].y, p.carrying.props);
  p.carrying = null;
});

const carryingNothingAnd = (cond) => (w, p, j) => !p.carrying && cond(w, p, j);

// ---- Work jobs ------------------------------------------------------------

export function haulJob(w, item, dest) {
  return {
    def: 'haul', kind: 'work', report: `hauling ${label(item.def)}`, item, dest,
    reserve: [tkey(item), ckey(w, dest.x, dest.y)],
    failIf: carryingNothingAnd((w, p, j) => !isSpawned(w, j.item)),
    toils: [goTo((j) => j.item, true), pickUp('item', (w, p, j) => j.dest.count), goTo((j) => j.dest, false), dropAt('dest')],
  };
}

// Carry materials into a blueprint or ingredients into a workbench (`target.stock`).
// Whatever goes into stock is gone from the map (that's how corpses get burned).
export function deliverJob(w, item, target, stockKey, count) {
  return {
    def: 'deliver', kind: 'work', report: `${THINGS[item.def].corpse ? 'carrying a body to' : `delivering ${label(item.def)} to`} ${label(target.builds ?? target.def)}`,
    item, target,
    reserve: [tkey(item), tkey(target)],
    failIf: (w, p, j) => !isSpawned(w, j.target) || (!p.carrying && !isSpawned(w, j.item)),
    toils: [
      goTo((j) => j.item, true),
      pickUp('item', () => count),
      goTo((j) => j.target, true),
      instant((w, p, j) => {
        j.target.stock[stockKey] = (j.target.stock[stockKey] ?? 0) + p.carrying.count;
        p.carrying = null;
      }),
    ],
  };
}

export function buildJob(w, bp) {
  const def = THINGS[bp.builds];
  return {
    def: 'build', kind: 'work', report: `building ${def.label.toLowerCase()}`, target: bp,
    reserve: [tkey(bp)],
    failIf: (w, p, j) => !isSpawned(w, j.target),
    toils: [goTo((j) => j.target, true), work({ amount: () => def.work, skill: 'construction', target: (j) => j.target, onDone: (w) => completeBlueprint(w, bp) })],
  };
}

export function newBills(def) {
  return (def.recipes ?? []).filter((r) => RECIPES[r].defaultBill).map((r) => ({ recipe: r, paused: false, ...RECIPES[r].defaultBill }));
}

export function completeBlueprint(w, bp) {
  const { x, y } = bp;
  const def = THINGS[bp.builds];
  const [sw, sh] = sizeOf(bp);
  despawn(w, bp);
  const cells = [];
  for (let cy = y; cy < y + sh; cy++) for (let cx = x; cx < x + sw; cx++) cells.push([cx, cy]);
  for (const [cx, cy] of cells) { const plant = plantAt(w, cx, cy); if (plant) despawn(w, plant); }
  const props = { ...(def.bench ? { stock: {}, bills: newBills(def) } : {}), ...(def.trap ? { armed: true } : {}), ...(def.fuel ? { fuel: 0 } : {}) };
  if (sw !== (def.size?.[0] ?? 1) || sh !== (def.size?.[1] ?? 1)) Object.assign(props, { sw, sh }); // rotated
  spawn(w, bp.builds, x, y, props);
  if (!def.blocks) return;
  for (const [cx, cy] of cells) {
    const item = itemAt(w, cx, cy);
    if (item) {
      const { id, def: d, x: ix, y: iy, count, ...rest } = item;
      despawn(w, item);
      spawnItem(w, d, count, cx, cy, rest);
    }
    for (const p of w.pawns) {
      if (p.x !== cx || p.y !== cy) continue;
      const free = DIRS.map(([dx, dy]) => [cx + dx, cy + dy]).find(([nx, ny]) => passable(w, nx, ny));
      if (free) [p.x, p.y] = free;
      p.move = null;
      p.interrupt = true;
    }
  }
}

export function repairJob(w, b) {
  const def = THINGS[b.def];
  return {
    def: 'repair', kind: 'work', report: `repairing ${def.label.toLowerCase()}`, target: b, reserve: [tkey(b)],
    failIf: (w, p, j) => !isSpawned(w, j.target),
    toils: [goTo((j) => j.target, true), work({ amount: () => (def.hp - b.hp) * 0.6, skill: 'construction', target: (j) => j.target, onDone: () => { b.hp = def.hp; } })],
  };
}

export function rearmJob(w, trap) {
  return {
    def: 'rearm', kind: 'work', report: 'resetting a spike trap', target: trap, reserve: [tkey(trap)],
    failIf: (w, p, j) => !isSpawned(w, j.target) || j.target.armed,
    toils: [goTo((j) => j.target, true), work({ amount: () => THINGS[trap.def].rearmWork, skill: 'construction', target: (j) => j.target, onDone: () => { trap.armed = true; } })],
  };
}

export function salvageJob(w, b) {
  const def = THINGS[b.def];
  return {
    def: 'salvage', kind: 'work', report: `${def.cost ? 'deconstructing' : 'salvaging'} ${def.label.toLowerCase()}`, target: b, reserve: [tkey(b)],
    failIf: (w, p, j) => !isSpawned(w, j.target) || j.target.designation !== 'salvage',
    toils: [goTo((j) => j.target, true), work({ amount: () => salvageWork(def), skill: 'construction', target: (j) => j.target, onDone: (w) => {
      despawn(w, b);
      for (const [item, n] of salvageYield(def)) spawnItem(w, item, n, b.x, b.y);
      for (const [k, n] of Object.entries(b.stock ?? {})) if (n > 0 && THINGS[k]) spawnItem(w, k, n, b.x, b.y); // benches return undelivered stock
    } })],
  };
}

export function mineJob(w, rock) {
  const def = THINGS[rock.def];
  return {
    def: 'mine', kind: 'work', report: 'mining', target: rock, reserve: [tkey(rock)],
    failIf: (w, p, j) => !isSpawned(w, j.target) || j.target.designation !== 'mine',
    toils: [goTo((j) => j.target, true), work({ amount: () => def.mineWork, skill: 'mining', target: (j) => j.target, onDone: (w) => {
      despawn(w, rock);
      roofAfterMining(w, rock.x, rock.y);
      spawnItem(w, def.yield.def, def.yield.count, rock.x, rock.y);
    } })],
  };
}

// mode: 'chop' / 'harvest' (player designations) or 'crop' (grow-zone harvest, no designation)
export function cutJob(w, plant, mode) {
  const def = THINGS[plant.def];
  const harvesting = mode !== 'chop';
  return {
    def: 'cut', kind: 'work', report: `${harvesting ? 'harvesting' : 'cutting'} ${def.label.toLowerCase()}`, target: plant,
    reserve: [tkey(plant)],
    failIf: (w, p, j) => !isSpawned(w, j.target) || (mode !== 'crop' && j.target.designation !== mode),
    toils: [goTo((j) => j.target, true), work({ amount: () => def.harvestWork, skill: 'plants', target: (j) => j.target, onDone: (w) => {
      const count = def.woody ? Math.floor(def.yield.count * plant.growth) : plant.growth >= 1 ? def.yield.count : 0;
      if (count) spawnItem(w, def.yield.def, count, plant.x, plant.y);
      if (harvesting && def.regrowTo != null) {
        plant.growth = def.regrowTo;
        plant.designation = null;
      } else despawn(w, plant);
    } })],
  };
}

export function sowJob(w, x, y, crop) {
  const cell = { x, y };
  return {
    def: 'sow', kind: 'work', report: `sowing ${label(crop)}`, cell, reserve: [ckey(w, x, y)],
    failIf: (w) => !!(plantAt(w, x, y) || buildingAt(w, x, y) || blueprintAt(w, x, y)),
    toils: [goTo((j) => j.cell, false), work({ amount: () => THINGS[crop].sowWork, skill: 'plants', onDone: (w) => spawn(w, crop, x, y, { growth: 0.05 }) })],
  };
}

// Do one bill at a bench once every ingredient is stocked.
export function billJob(w, bench, bill) {
  const r = RECIPES[bill.recipe];
  const stocked = () => r.ingredients.every((ing) => (bench.stock[ingKey(ing)] ?? 0) >= ing.count);
  return {
    def: 'bill', kind: 'work', report: r.label.toLowerCase(), target: bench, reserve: [tkey(bench)],
    failIf: (w) => !isSpawned(w, bench) || !stocked(),
    toils: [goTo((j) => j.target, true), work({ amount: () => r.work, skill: r.skill, target: (j) => j.target, onDone: (w) => {
      for (const ing of r.ingredients) bench.stock[ingKey(ing)] -= ing.count;
      if (r.product) spawnItem(w, r.product.def, r.product.count, bench.x, bench.y);
    } })],
  };
}

// ---- Arming ---------------------------------------------------------------

export function equipJob(w, item) {
  return {
    def: 'equip', kind: 'work', report: `picking up a ${label(item.def)}`, item, reserve: [tkey(item)],
    failIf: (w, p, j) => !isSpawned(w, j.item),
    toils: [goTo((j) => j.item, true), instant((w, p, j) => {
      const it = j.item;
      if (p.weapon) spawnItem(w, p.weapon.def, 1, p.x, p.y);
      despawn(w, it);
      p.weapon = { def: it.def };
    })],
  };
}

export function ammoJob(w, item, want) {
  return {
    def: 'ammo', kind: 'work', report: 'grabbing ammo', item, reserve: [tkey(item)],
    failIf: (w, p, j) => !isSpawned(w, j.item),
    toils: [goTo((j) => j.item, true), instant((w, p, j) => {
      const n = Math.min(want, j.item.count);
      j.item.count -= n;
      if (j.item.count <= 0) despawn(w, j.item);
      p.ammo = (p.ammo ?? 0) + n;
    })],
  };
}

// ---- Guarding & alarm -----------------------------------------------------

export function guardJob(w, post) {
  return {
    def: 'guard', kind: 'guard', report: 'standing watch', target: post, reserve: [tkey(post)],
    failIf: (w, p, j) => !isSpawned(w, j.target),
    toils: [goTo((j) => j.target, false), wait(900, (w, p, j) => { p.onPost = j.target.id; })],
  };
}

export function shelterJob(w, cell) {
  return {
    def: 'shelter', kind: 'guard', report: 'sheltering (alarm)', cell, reserve: [ckey(w, cell.x, cell.y)],
    toils: [goTo((j) => j.cell, false), wait(900, (w) => (w.alarm ? undefined : DONE))],
  };
}

// ---- Roofs, fuel, warmth ----------------------------------------------------

export function roofJob(w, x, y, remove) {
  const cell = { x, y };
  return {
    def: remove ? 'unroof' : 'roof', kind: 'work', report: remove ? 'taking down a roof' : 'building a roof', cell,
    reserve: ['r' + (y * w.w + x)],
    toils: [goTo((j) => j.cell, true), work({ amount: () => ROOMS.roofWork, skill: 'construction', target: (j) => j.cell, onDone: (w) => applyRoofWork(w, x, y, remove) })],
  };
}

// Fill a campfire or stove with wood.
export function refuelJob(w, item, target, count) {
  return {
    def: 'refuel', kind: 'work', report: `refueling the ${label(target.def)}`, item, target,
    reserve: [tkey(item), tkey(target)],
    failIf: (w, p, j) => !isSpawned(w, j.target) || (!p.carrying && !isSpawned(w, j.item)),
    toils: [
      goTo((j) => j.item, true),
      pickUp('item', () => count),
      goTo((j) => j.target, true),
      instant((w, p, j) => {
        const cap = THINGS[j.target.def].fuel.capacity;
        const used = Math.max(0, Math.min(p.carrying.count, Math.floor(cap - (j.target.fuel ?? 0)))); // whole logs only
        j.target.fuel = (j.target.fuel ?? 0) + used;
        p.carrying.count -= used;
        if (p.carrying.count <= 0) p.carrying = null;
      }),
    ],
  };
}

// Too cold or too hot: go somewhere comfortable and wait it out.
export function warmUpJob(w, p, cell, cold) {
  return {
    def: 'warmUp', kind: 'need', report: cold ? 'warming up' : 'cooling off', cell,
    toils: [goTo((j) => j.cell, false), wait(1200, (w, p) => ((cold ? p.hypothermia : p.heatstroke) < 0.05 ? DONE : undefined))],
  };
}

// Waking up: the bedroom (or lack of one) leaves a memory.
function sleepThoughts(w, p, bed) {
  if (!bed) addMemory(p, 'sleptOnGround');
  const t = tempAt(w, p.x, p.y);
  if (!isRoofed(w, p.x, p.y)) addMemory(p, 'sleptOutside');
  if (t < COMFORT.min) addMemory(p, 'sleptCold');
  else if (t > COMFORT.max) addMemory(p, 'sleptHot');
  const room = bed && roomOf(w, bed.x, bed.y);
  if (room?.role === 'bedroom') addMemory(p, `bedroom${room.level}`);
  else if (room?.role === 'barracks') addMemory(p, 'sleptInBarracks');
}

// ---- Need jobs ------------------------------------------------------------

// Best food it can reach: meals, then canned, then raw — unless the worse food is much closer.
export function findFood(w, p) {
  const foods = allThings(w, (t, d) => d.nutrition && !reservedByOther(w, tkey(t), p))
    .map((t) => ({ t, score: dist(p, t) + THINGS[t.def].foodPref }))
    .sort((a, b) => a.score - b.score);
  return foods.find(({ t }) => canReachThing(w, p, t))?.t ?? null;
}

function findTable(w, p, near) {
  return allThings(w, (t, d) => d.table && dist(near, t) <= 30)
    .sort((a, b) => dist(near, a) - dist(near, b))
    .find((t) => canReachThing(w, p, t)) ?? null;
}

export function eatJob(w, p, food, binge = false) {
  const def = THINGS[food.def];
  const need = Math.max(1, Math.ceil((1 - p.needs.food) / def.nutrition));
  const want = binge ? need * 2 + 2 : need;
  const table = findTable(w, p, food);
  return {
    def: 'eat', kind: binge ? 'mental' : 'need', report: binge ? 'binge eating' : `eating ${label(food.def)}`,
    item: food, table, reserve: [tkey(food)],
    failIf: carryingNothingAnd((w, p, j) => !isSpawned(w, j.item)),
    toils: [
      goTo((j) => j.item, true),
      pickUp('item', () => want),
      ...(table ? [goTo((j) => j.table, true)] : []),
      wait(400),
      instant((w, p, j) => {
        const c = p.carrying;
        p.needs.food = Math.min(1, p.needs.food + THINGS[c.def].nutrition * c.count);
        p.carrying = null;
        if (THINGS[c.def].tags.includes('rawFood')) addMemory(p, 'ateRawFood');
        if (!j.table) addMemory(p, 'ateWithoutTable');
        else { const room = roomOf(w, j.table.x, j.table.y); if (room?.role === 'dining' && room.level >= 2) addMemory(p, `dining${room.level}`); }
      }),
    ],
  };
}

// A bed for `p`: their own, else the nearest free one (claimed for them). `from` = who walks there.
export function claimBed(w, p, from = p) {
  let bed = p.bedId != null ? w.things.get(p.bedId) : null;
  if (bed && canReach(w, from, bed.x, bed.y, false) && !bedOccupied(w, bed, p)) return bed;
  bed = allThings(w, (t, d) => d.bed && (t.owner == null || t.owner === p.id || !pawnById(w, t.owner)) && !bedOccupied(w, t, p))
    .sort((a, b) => dist(from, a) - dist(from, b))
    .find((t) => canReach(w, from, t.x, t.y, false));
  if (!bed) return null;
  bed.owner = p.id;
  p.bedId = bed.id;
  return bed;
}
const bedOccupied = (w, bed, except) => w.pawns.some((o) => o !== except && o.inBed === bed.id);

export function sleepJob(w, p) {
  const bed = claimBed(w, p);
  const effect = bed ? THINGS[bed.def].restEffect : 0.8; // (RW) ground = 0.8
  return {
    def: 'sleep', kind: 'need', report: bed ? 'sleeping' : 'sleeping on the ground', bed,
    failIf: (w, p, j) => !!j.bed && !isSpawned(w, j.bed),
    toils: [
      ...(bed ? [goTo((j) => j.bed, false)] : []),
      {
        init(w, p, j) { j.slept = 0; },
        tick(w, p, j) {
          p.asleep = true;
          if (j.bed) p.inBed = j.bed.id;
          j.slept++;
          p.needs.rest = Math.min(1, p.needs.rest + REST_GAIN * effect);
          if (p.needs.rest >= 1) return DONE;
        },
      },
    ],
    onEnd: (w, p, j) => { if (j.slept > TICKS_PER_HOUR) sleepThoughts(w, p, j.bed); },
  };
}

export function joyJob(w, p) {
  const cell = randomReachableCell(w, p, 10);
  if (!cell) return null;
  return {
    def: 'joy', kind: 'joy', report: 'watching the sky', cell,
    toils: [goTo((j) => j.cell, false), wait(2000, (w, p) => {
      p.needs.joy = Math.min(1, p.needs.joy + JOY_GAIN);
      if (p.needs.joy >= 1) return DONE;
    })],
  };
}

export function wanderJob(w, p, { report = 'wandering', kind = 'idle', radius = 5, ticks = [200, 600] } = {}) {
  const cell = randomReachableCell(w, p, radius);
  return {
    def: 'wander', kind, report, cell,
    toils: [...(cell ? [goTo((j) => j.cell, false)] : []), wait(() => w.rng.int(...ticks))],
  };
}

// ---- Mental-state jobs ----------------------------------------------------

export function tantrumJob(w, p) {
  const item = allThings(w, (t, d) => d.kind === 'item' && !d.corpse && dist(p, t) < 25 && !reservedByOther(w, tkey(t), p))
    .find((t) => canReachThing(w, p, t));
  if (!item) return wanderJob(w, p, { report: 'throwing a tantrum', kind: 'mental' });
  return {
    def: 'tantrum', kind: 'mental', report: 'smashing things in a tantrum', item, reserve: [tkey(item)],
    failIf: (w, p, j) => !isSpawned(w, j.item),
    toils: [goTo((j) => j.item, true), work({ amount: () => 300, target: (j) => j.item, onDone: (w) => {
      const n = Math.max(1, Math.round(item.count * w.rng.range(0.3, 0.6)));
      item.count -= n;
      if (item.count <= 0) despawn(w, item);
      letter(w, `${p.name} destroyed ${n} ${label(item.def)} in a tantrum.`, 'bad', p);
    } })],
  };
}

export function leaveMapJob(w, p, report, onExit) {
  const edge = findEdgeCell(w, p);
  if (!edge) return wanderJob(w, p, { report, kind: p.faction === 'colony' ? 'mental' : 'work' });
  return {
    def: 'leave', kind: p.faction === 'colony' ? 'mental' : 'work', report, edge,
    toils: [goTo((j) => j.edge, false), instant((w, p) => onExit?.(w, p, exitMap(w, p)))],
  };
}

// Remove a pawn from the map; returns whatever it was carrying (loot leaves with it).
export function exitMap(w, p) {
  const carried = p.carrying;
  p.carrying = null;
  removePawn(w, p);
  return carried;
}

export function removePawn(w, p) {
  endJob(w, p, DONE);
  p.gone = true;
  const i = w.pawns.indexOf(p);
  if (i >= 0) w.pawns.splice(i, 1);
  const bed = p.bedId != null && w.things.get(p.bedId);
  if (bed && bed.owner === p.id) bed.owner = null;
  if (p.carriedBy) { p.carriedBy.carryingPawn = null; p.carriedBy = null; }
}

export function stealJob(w, p) {
  const item = allThings(w, (t, d) => d.kind === 'item' && !d.corpse && !reservedByOther(w, tkey(t), p))
    .sort((a, b) => THINGS[b.def].value * b.count - THINGS[a.def].value * a.count || dist(p, a) - dist(p, b))
    .slice(0, 8)
    .sort((a, b) => dist(p, a) - dist(p, b))
    .find((t) => canReachThing(w, p, t));
  if (!item) return null;
  return {
    def: 'steal', kind: 'work', report: `stealing ${label(item.def)}`, item, reserve: [tkey(item)],
    failIf: carryingNothingAnd((w, p, j) => !isSpawned(w, j.item)),
    toils: [
      goTo((j) => j.item, true),
      pickUp('item', () => CARRY_CAPACITY),
      goTo((j, w, p) => findEdgeCell(w, p), false),
      instant((w, p) => {
        const loot = exitMap(w, p);
        if (!loot) return;
        letter(w, `A looter escaped with ${loot.count} ${label(loot.def)}.`, 'bad');
        for (const c of colonists(w)) addMemory(c, 'robbed');
      }),
    ],
  };
}
