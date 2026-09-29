// Temperature and seasons. See docs/RESEARCH.md "Temperature".
//
// Outdoors follows the season and the time of day (plus cold snaps / heat waves). A room that
// is at least 75% roofed keeps its own temperature: it drifts toward outdoors through walls and
// roof, and heaters push it back toward their thermostat. Hotter or colder than comfortable,
// survivors build up hypothermia or heatstroke (RW formulas). Temperature also drives plant
// growth, food spoilage, and how fast zombies move.

import { TICKS_PER_DAY, TICKS_PER_HOUR, DAYS_PER_SEASON, SEASONS, CLIMATE, COMFORT, EXPOSURE } from './config.js';
import { THINGS } from './defs.js';
import { hourFloat, dayOf, allThings, despawn, letter } from './world.js';
import { rebuildRooms, tempAt } from './rooms.js';
import { heatByRoom } from './buildings.js';
import { hurtPawn, killHuman, goDown } from './combat.js';

export { tempAt };
const YEAR = DAYS_PER_SEASON * SEASONS.length;

// The day's average (no day/night swing): what decides whether it's growing season.
export function seasonalTemp(w, tick = w.tick) {
  const day = tick / TICKS_PER_DAY;
  const weather = w.weather && tick < w.weather.until ? w.weather.offset : 0;
  return CLIMATE.mean + CLIMATE.seasonAmp * Math.sin((2 * Math.PI * (day - CLIMATE.phaseDays)) / YEAR) + weather;
}
export const growingSeason = (w) => seasonalTemp(w) >= 6; // (RW) plants grow fully above 6°C

export function outdoorTemp(w, tick = w.tick) {
  const day = tick / TICKS_PER_DAY;
  const season = CLIMATE.mean + CLIMATE.seasonAmp * Math.sin((2 * Math.PI * (day - CLIMATE.phaseDays)) / YEAR);
  const daily = CLIMATE.dayAmp * Math.sin((2 * Math.PI * (hourFloat(tick) - 9)) / 24);
  const weather = w.weather && tick < w.weather.until ? w.weather.offset : 0;
  return season + daily + weather;
}

export const seasonOf = (tick) => SEASONS[Math.floor(dayOf(tick) / DAYS_PER_SEASON) % SEASONS.length];

// (RW) plants grow fully above 6°C, stop at 0°C, slow above 42°C, and stop again at 58°C.
export const plantGrowthFactor = (t) => (t <= 0 ? 0 : t < 6 ? t / 6 : t <= 42 ? 1 : t < 58 ? (58 - t) / 16 : 0);
// (RW) food is frozen at or below 0°C and rots at full speed from 10°C up.
export const rotFactor = (t) => (t <= 0 ? 0 : t >= 10 ? 1 : t / 10);
// Cold stiffens the dead; heat makes them a little livelier.
export const zombieTempFactor = (t) => (t < -5 ? 0.6 : t < 5 ? 0.8 : t > 32 ? 1.15 : 1);

export function tickClimate(w, dt) {
  w.outdoor = outdoorTemp(w);
  if (w.roomsDirty) {
    const collapsed = rebuildRooms(w);
    if (collapsed.length) roofCollapse(w, collapsed);
  }
  const hours = dt / TICKS_PER_HOUR;
  const heat = heatByRoom(w);
  for (const r of w.rooms) {
    const leak = r.indoors ? CLIMATE.leakRoofed : CLIMATE.leakOpen;
    r.temp += (w.outdoor - r.temp) * Math.min(1, leak * hours);
    const h = heat.get(r.id);
    if (h && r.temp < h.target) r.temp = Math.min(h.target, r.temp + (h.power * hours) / r.size);
  }
}

function roofCollapse(w, cells) {
  const set = new Set(cells);
  for (const p of w.pawns) {
    if (!set.has(p.y * w.w + p.x)) continue;
    hurtPawn(w, p, w.rng.range(15, 30)); // (RW) 15–30 damage from a thin roof
  }
  const i = cells[0];
  letter(w, `A roof caved in: nothing was holding it up.`, 'bad', { x: i % w.w, y: (i / w.w) | 0 });
}

// ---- Survivors: hypothermia & heatstroke (RW formulas, per 60 ticks) ------------

function exposureStep(sev, beyond, steps) {
  if (beyond > EXPOSURE.onset) return Math.min(1, sev + Math.max(EXPOSURE.base, (beyond - EXPOSURE.onset) * EXPOSURE.perDegree) * steps);
  return Math.max(0, sev - Math.max(EXPOSURE.recoverMin, Math.min(EXPOSURE.recoverMax, EXPOSURE.recoverMul * sev)) * steps);
}

export function tickExposure(w, p, dt) {
  const t = tempAt(w, p.x, p.y), steps = dt / 60;
  p.hypothermia = exposureStep(p.hypothermia ?? 0, COMFORT.min - t, steps);
  p.heatstroke = exposureStep(p.heatstroke ?? 0, t - COMFORT.max, steps);
  if (p.hypothermia >= 1) return killHuman(w, p, 'froze to death');
  if (p.heatstroke >= 1) return killHuman(w, p, 'died of heatstroke');
  if (!p.downed && (p.hypothermia > 0.62 || p.heatstroke > 0.62)) goDown(w, p); // (RW) "extreme"
}

// (RW) stages: minor > 0.2, serious > 0.35, extreme > 0.62.
export const exposureStage = (sev) => (sev > 0.62 ? 'extreme' : sev > 0.35 ? 'serious' : sev > 0.2 ? 'minor' : sev > 0.04 ? 'mild' : null);

// ---- Spoilage ----------------------------------------------------------------------

export function tickRot(w, dt) {
  const days = dt / TICKS_PER_DAY;
  let spoiled = 0, where = null;
  for (const t of allThings(w, (t, d) => d.rotDays)) {
    t.rot = (t.rot ?? 0) + days * rotFactor(tempAt(w, t.x, t.y));
    if (t.rot < THINGS[t.def].rotDays) continue;
    spoiled += t.count;
    where ??= t;
    despawn(w, t);
  }
  if (spoiled && w.tick - (w.lastRotLetter ?? -1e9) > TICKS_PER_DAY / 2) {
    w.lastRotLetter = w.tick;
    letter(w, `${spoiled} food spoiled. Cold storage (below 10°C, frozen below 0°C) keeps it longer.`, 'bad', where);
  }
}

// Cold nights kill crops (and wild herbs) left out in the open. Only your fields are news.
export function tickFrost(w, dt) {
  if (w.outdoor >= -3) return;
  let killed = 0, where = null;
  for (const t of allThings(w, (t, d) => d.sowable)) {
    const i = t.y * w.w + t.x;
    if (w.roof[i]) continue;
    t.frost = (t.frost ?? 0) + dt;
    if (t.frost < 2 * TICKS_PER_HOUR) continue;
    if (w.zoneAt[i]?.type === 'grow') { killed++; where ??= t; }
    despawn(w, t);
  }
  if (killed) letter(w, `Frost killed ${killed} crops. Harvest before the cold, or wait for spring to sow again.`, 'bad', where);
}

export const comfortable = (t) => t >= COMFORT.min && t <= COMFORT.max;
// Indoor rooms at a comfortable temperature, for survivors who need to warm up or cool off.
export const comfortableRooms = (w) => w.rooms.filter((r) => r.indoors && comfortable(r.temp));
