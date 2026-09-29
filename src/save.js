// Save / load. The world is plain data, so a save is JSON with a few conversions (Sets →
// arrays; derived structures like the grid index, reachability, and the zombie field are
// rebuilt on load; jobs are dropped and everyone simply re-thinks).
// Storage lives only in this module so an App Store wrapper can swap it out later.

import { createWorld, restoreThing, spawnItem } from './world.js';
import { outdoorTemp } from './climate.js';
import { rebuildRooms } from './rooms.js';

const VERSION = 1;
const KEYS = { auto: 'holdout.autosave', manual: 'holdout.save' };

export function serialize(w) {
  const pawns = w.pawns.map((p) => {
    const { job, move, threat, heard, interrupt, carryingPawn, carriedBy, lastOutcome, ...rest } = p;
    return {
      ...rest,
      incapable: p.incapable ? [...p.incapable] : undefined,
      asleep: false, lying: false, onPost: null,
      inBed: p.downed ? p.inBed : null,
    };
  });
  const zones = w.zones.map((z) => ({ ...z, cells: [...z.cells], allow: z.allow ? [...z.allow] : undefined }));
  return JSON.stringify({
    version: VERSION,
    savedAt: Date.now(),
    seed: w.seed, rng: w.rng.getState(), tick: w.tick, speed: w.speed,
    terrain: Array.from(w.terrain),
    things: [...w.things.values()],
    pawns, zones,
    zoneCounter: w.zoneCounter, roads: w.roads, nextId: w.nextId,
    log: w.log, logSerial: w.logSerial, wealth: w.wealth, story: w.story, stats: w.stats,
    alarm: w.alarm, autoAlarm: w.autoAlarm,
    roofs: sparse(w.roof), roofArea: sparse(w.roofArea), weather: w.weather,
    roomTemps: w.rooms.map((r) => [r.cells[0], Math.round(r.temp * 10) / 10]),
  });
}

// [[index, value], ...] for the non-zero cells of a per-cell array.
function sparse(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i++) if (arr[i]) out.push([i, arr[i]]);
  return out;
}

export function deserialize(json) {
  const d = JSON.parse(json);
  if (d.version !== VERSION) throw new Error(`Unsupported save version ${d.version}`);
  const w = createWorld(d.seed);
  w.rng.setState(d.rng);
  Object.assign(w, {
    tick: d.tick, speed: d.speed, zoneCounter: d.zoneCounter, roads: d.roads, nextId: d.nextId,
    log: d.log, logSerial: d.logSerial, wealth: d.wealth, story: d.story, stats: d.stats,
    alarm: d.alarm, autoAlarm: d.autoAlarm,
  });
  w.terrain.set(d.terrain);
  for (const [i, v] of d.roofs ?? []) w.roof[i] = v;
  for (const [i, v] of d.roofArea ?? []) w.roofArea[i] = v;
  w.weather = d.weather ?? null;
  w.outdoor = outdoorTemp(w);
  w.pendingRoomTemps = new Map(d.roomTemps ?? []);
  for (const t of d.things) restoreThing(w, t);
  for (const z of d.zones) {
    z.cells = new Set(z.cells);
    if (z.allow) z.allow = new Set(z.allow);
    for (const i of z.cells) w.zoneAt[i] = z;
    w.zones.push(z);
  }
  for (const p of d.pawns) {
    if (p.incapable) p.incapable = new Set(p.incapable);
    p.job = null;
    p.move = null;
    w.pawns.push(p);
    if (p.carrying) { spawnItem(w, p.carrying.def, p.carrying.count, p.x, p.y, p.carrying.props); p.carrying = null; }
  }
  w.reachDirty = true;
  w.fieldDirty = true;
  w.humans = [];
  rebuildRooms(w); // rooms (and their saved temperatures) exist from the first frame
  return w;
}

export function saveGame(w, slot = 'manual') {
  try {
    localStorage.setItem(KEYS[slot], serialize(w));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function loadGame(slot) {
  try {
    const json = localStorage.getItem(KEYS[slot]);
    return json ? deserialize(json) : null;
  } catch (e) {
    console.warn('Load failed', e);
    return null;
  }
}

// { savedAt, tick } without parsing the whole world, for the menu.
export function saveInfo(slot) {
  try {
    const json = localStorage.getItem(KEYS[slot]);
    if (!json) return null;
    const head = json.slice(0, 200);
    const savedAt = +(head.match(/"savedAt":(\d+)/)?.[1] ?? 0);
    const tick = +(json.match(/"tick":(\d+)/)?.[1] ?? 0);
    return { savedAt, tick };
  } catch {
    return null;
  }
}
