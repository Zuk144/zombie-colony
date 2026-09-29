// Per-building behavior that runs over time: fuel burning and heat today; Phase 3 machines
// (power, production, noise) plug in here too. Everything is data-driven from defs:
//   fuel: { capacity, perDay }  burns wood while the building is working; refilled by haulers
//   heat, heatTarget            adds heat to its room until the room reaches heatTarget
//   idleWhenWarm                stops burning fuel while its room is at the target
//   light                       only shines while it has fuel (if it takes fuel at all)

import { TICKS_PER_DAY } from './config.js';
import { THINGS } from './defs.js';
import { allThings, letter, countOnMap } from './world.js';
import { roomOf } from './rooms.js';

export const hasFuel = (t) => !THINGS[t.def].fuel || t.fuel > 0;
export const needsRefuel = (t) => { const f = THINGS[t.def].fuel; return !!f && (t.fuel ?? 0) < f.capacity * 0.4; };
export const isLit = (t) => !!THINGS[t.def].light && hasFuel(t);

// Is this heater currently trying to heat (fueled, and its room is below the thermostat)?
function heating(w, t) {
  const d = THINGS[t.def];
  if (!d.heat || !hasFuel(t)) return false;
  const room = roomOf(w, t.x, t.y);
  return !room || room.temp < d.heatTarget;
}

export function tickBuildings(w, dt) {
  const days = dt / TICKS_PER_DAY;
  for (const t of allThings(w, (t, d) => d.fuel)) {
    const d = THINGS[t.def];
    if (!(t.fuel > 0)) continue;
    if (d.idleWhenWarm && !heating(w, t)) continue; // stoves idle in a warm room; campfires always burn
    t.fuel = Math.max(0, t.fuel - d.fuel.perDay * days);
    if (t.fuel === 0 && w.tick - (w.lastFuelLetter ?? -1e9) > 5000) {
      w.lastFuelLetter = w.tick;
      letter(w, `The ${d.label.toLowerCase()} ran out of wood.`, 'neutral', t);
    }
  }
  // Nudge the player once a day if fires are out and there's no wood left to feed them.
  const cold = allThings(w, (t, d) => d.fuel && !(t.fuel > 0));
  if (cold.length && countOnMap(w, 'wood') === 0 && w.tick - (w.lastNoWoodLetter ?? -1e9) > TICKS_PER_DAY) {
    w.lastNoWoodLetter = w.tick;
    letter(w, 'No wood left to keep the fires going. Mark some trees to chop.', 'bad', cold[0]);
  }
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
