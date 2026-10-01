// Per-building behavior over time: fuel, heat, machines, and the Din. Data-driven from defs:
//   fuel: { capacity, perDay, items? }  burns while working; haulers refill it (items: what it accepts)
//   ammoFeed: { capacity }                 turret magazine; haulers load it
//   heat, heatTarget, idleWhenWarm         room heating with a thermostat
//   light                                  shines while fueled / powered
//   power, machine, noise, lure            see power.js and docs/DESIGN.md §9
// Machines with `bench` run their own bills while powered; haulers only keep them stocked.

import { TICKS_PER_DAY, DIN } from './config.js';
import { THINGS, RECIPES, ingKey } from './defs.js';
import { allThings, letter, countOnMap, countOwned, spawnItem, isNight, dist } from './world.js';
import { roomOf } from './rooms.js';
import { isPowered, wantsPower, modeAllows, machineCenter } from './power.js';
import { makeNoise } from './combat.js';

// ---- Supplies: fuel and ammo, loaded by haulers ------------------------------------

// Every refillable slot on a building: { field, items, capacity, refillAt }. A slot asks for a
// top-up once it drops below `refillAt` of capacity (guns earlier, so they're fed mid-fight).
export function supplies(t) {
  const d = THINGS[t.def], out = [];
  if (d.fuel) out.push({ field: 'fuel', items: d.fuel.items ?? ['wood'], capacity: d.fuel.capacity, refillAt: d.fuel.refillAt ?? 0.4 });
  if (d.ammoFeed) out.push({ field: 'ammo', items: ['ammo'], capacity: d.ammoFeed.capacity, refillAt: d.ammoFeed.refillAt ?? 0.5 });
  return out;
}
export const hasFuel = (t) => !THINGS[t.def].fuel || t.fuel > 0;
export const needsSupply = (t) => supplies(t).find((s) => (t[s.field] ?? 0) < s.capacity * s.refillAt) ?? null;
// How full a building's emptiest slot is (0..1), or null if it has none.
export const supplyFrac = (t) => { const s = supplies(t); return s.length ? Math.min(...s.map((sl) => Math.min(1, (t[sl.field] ?? 0) / sl.capacity))) : null; };
export const needsRefuel = (t) => !!needsSupply(t);

export function isLit(w, t) {
  const d = THINGS[t.def];
  if (!d.light || !hasFuel(t)) return false;
  return d.power ? isPowered(w, t) && wantsPower(w, t) : true;
}

// Guards can see zombies standing in a lit floodlight's pool, even at night.
export const litByFloodlight = (w, x, y) =>
  allThings(w, (t, d) => d.power && d.light).some((t) => isLit(w, t) && dist({ x, y }, t) <= THINGS[t.def].light);

// Is this heater currently trying to heat (fueled, and its room is below the thermostat)?
function heating(w, t) {
  const d = THINGS[t.def];
  if (!d.heat || !hasFuel(t)) return false;
  const room = roomOf(w, t.x, t.y);
  return !room || room.temp < d.heatTarget;
}

// Is this machine making noise right now?
export function isRunning(w, t) {
  const d = THINGS[t.def];
  if (!d.machine || t.broken) return false;
  if (d.power?.output && d.fuel) return !!t.running;
  if (d.power?.draw) return isPowered(w, t) && wantsPower(w, t);
  return false;
}

export const dinLabel = (din) => DIN.levels.filter(([min]) => din >= min).pop()[1];

export function machineBillWanted(w, b) {
  const r = RECIPES[b.recipe];
  return b.mode === 'forever' || !r.product || countOwned(w, r.product.def) < b.target;
}

export function tickBuildings(w, dt) {
  const days = dt / TICKS_PER_DAY;

  // Fuel
  for (const t of allThings(w, (t, d) => d.fuel)) {
    const d = THINGS[t.def];
    if (!(t.fuel > 0)) continue;
    if (d.idleWhenWarm && !heating(w, t)) continue; // stoves idle in a warm room
    if (d.power?.output && !t.running) continue; // generators idle when nothing needs power
    t.fuel = Math.max(0, t.fuel - d.fuel.perDay * days);
    if (t.fuel === 0 && w.tick - (w.lastFuelLetter ?? -1e9) > 5000) {
      w.lastFuelLetter = w.tick;
      letter(w, `The ${d.label.toLowerCase()} ran out of fuel.`, 'neutral', t);
    }
  }
  const cold = allThings(w, (t, d) => d.fuel && !d.power && !(t.fuel > 0));
  if (cold.length && countOnMap(w, 'wood') === 0 && w.tick - (w.lastNoWoodLetter ?? -1e9) > TICKS_PER_DAY) {
    w.lastNoWoodLetter = w.tick;
    letter(w, 'No wood left to keep the fires going. Mark some trees to chop.', 'bad', cold[0]);
  }

  // Self-running machines (ammo press, render vat): work the first bill that's wanted and stocked.
  for (const t of allThings(w, (t, d) => d.machine && d.bench)) {
    const bill = t.bills.find((b) => !b.paused && machineBillWanted(w, b) && RECIPES[b.recipe].ingredients.every((i) => (t.stock[ingKey(i)] ?? 0) >= i.count));
    t.working = !!bill && !t.broken && modeAllows(w, t);
    if (!t.working || !isPowered(w, t)) continue;
    const r = RECIPES[bill.recipe];
    t.progress = (t.progress ?? 0) + dt;
    if (t.progress < r.work) continue;
    t.progress = 0;
    for (const i of r.ingredients) t.stock[ingKey(i)] -= i.count;
    const c = machineCenter(t);
    spawnItem(w, r.product.def, r.product.count, Math.round(c.x), Math.round(c.y) + 1);
  }

  // The Din: running machines pulse noise (and floodlights draw them at night).
  let din = 0;
  for (const t of allThings(w, (t, d) => d.machine)) {
    const d = THINGS[t.def];
    const c = machineCenter(t);
    if (d.noise && isRunning(w, t)) { din += d.noise; makeNoise(w, Math.round(c.x), Math.round(c.y), d.noise, t); }
    if (d.lure && isLit(w, t) && isNight(w.tick)) makeNoise(w, t.x, t.y, d.lure, t);
  }
  w.din = din;
}

// Heat output per room this tick: Map(roomId → { power, target }) summed over heaters.
export function heatByRoom(w) {
  const out = new Map();
  for (const t of allThings(w, (t, d) => d.heat)) {
    const room = roomOf(w, t.x, t.y);
    if (!room || !hasFuel(t)) continue;
    const d = THINGS[t.def];
    const cur = out.get(room.id) ?? { power: 0, target: -Infinity };
    cur.power += d.heat;
    cur.target = Math.max(cur.target, d.heatTarget);
    out.set(room.id, cur);
  }
  return out;
}
