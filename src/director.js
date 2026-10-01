// The Director: decides when things happen and how big the hordes are.
// Left 4 Dead's AI Director rhythm on top of RimWorld's Cassandra numbers (docs/DESIGN.md §10).

import { TICKS_PER_DAY, STORY_INTERVAL, MAX_ZOMBIES, DIN } from './config.js';
import { THINGS } from './defs.js';
import { mtbChance, curve } from './rng.js';
import { allThings, colonists, spawnItem, despawn, letter, idx, inBounds, zombieCost, bashTargetAt, isNight, reachGroup } from './world.js';
import { makeColonist, makeZombie, makeLooter } from './pawn.js';
import { addMemory } from './mood.js';
import { makeNoise } from './combat.js';
import { setAlarm } from './think.js';
import { seasonOf } from './climate.js';

export const DIRECTOR = {
  firstWalkerDay: 0.4, // a lone walker the first afternoon
  firstPackDay: 3.4, // a small pack a few days in
  minDaysPassed: 7, // (RW Cassandra: 11) hordes begin
  onDays: 4.6, // (RW)
  offDays: 6, // (RW)
  minSpacingDays: 1.9, // (RW)
  threatsPerOn: [1, 2], // (RW)
  strayMtbDays: 0.9, // background zombies wandering in
  nightStrayMult: 3,
  miscMtbDays: 4.8, // (RW)
  popMtbDays: 10,
  pointsPerZombie: 12,
};
export const DIFFICULTY = { threatScale: 1 };

// (RW) raid-point curves, reused as horde points
const WEALTH_POINTS = [[0, 0], [14000, 0], [400000, 2400], [700000, 3600], [1000000, 4200]];
const POINTS_PER_SURVIVOR = [[0, 15], [10000, 15], [400000, 140], [1000000, 200]];
const START_FACTOR = [[10, 0.7], [40, 1]];
// Newcomers show up often when the group is tiny, rarely once it's big (RW "population intent").
const POP_INTENT = [[0, 8], [1, 3], [3, 1.2], [5, 0.8], [8, 0.3], [12, 0]];

export function createDirector() {
  return { phase: -1, planned: 0, fired: 0, lastThreatDay: -1e9, walkerDone: false, packDone: false, adaptation: 0.8, hordeActive: false };
}

export function threatPoints(w) {
  const day = w.tick / TICKS_PER_DAY;
  const pts = (curve(WEALTH_POINTS, w.wealth) + colonists(w).length * curve(POINTS_PER_SURVIVOR, w.wealth))
    * DIFFICULTY.threatScale * curve(START_FACTOR, day) * w.story.adaptation * (isNight(w.tick) ? 1.3 : 1)
    * (1 + Math.min(DIN.hordeMax, (w.din ?? 0) * DIN.hordePer)); // a loud colony draws bigger hordes
  return Math.max(36, Math.min(10000, Math.round(pts)));
}

export function tickDirector(w) {
  const s = w.story, rng = w.rng, D = DIRECTOR;
  const day = w.tick / TICKS_PER_DAY;

  if (!s.walkerDone && day >= D.firstWalkerDay) { s.walkerDone = true; horde(w, 12, 'A lone walker is shambling toward camp.'); }
  if (!s.packDone && day >= D.firstPackDay) { s.packDone = true; horde(w, 36, 'A small pack of the dead has caught your scent.'); }

  if (day >= D.minDaysPassed) {
    const cycle = D.onDays + D.offDays;
    const t = day - D.minDaysPassed;
    const phase = Math.floor(t / cycle);
    const inCycle = t - phase * cycle;
    if (phase !== s.phase) {
      s.phase = phase;
      s.planned = rng.int(...D.threatsPerOn);
      s.fired = 0;
    }
    if (inCycle < D.onDays && s.fired < s.planned && day - s.lastThreatDay >= D.minSpacingDays) {
      // Spread remaining threats across the rest of the "on" window, favoring nightfall.
      const checksLeft = Math.max(1, ((D.onDays - inCycle) * TICKS_PER_DAY) / STORY_INTERVAL);
      if (rng.chance(((s.planned - s.fired) / checksLeft) * (isNight(w.tick) ? 2.5 : 0.6))) {
        s.fired++;
        s.lastThreatDay = day;
        horde(w, threatPoints(w));
      }
    }
  }

  if (w.weather && w.tick >= w.weather.until) {
    letter(w, w.weather.kind === 'coldSnap' ? 'The cold snap has broken.' : 'The heat wave has passed.', 'good');
    w.weather = null;
  }

  // The horde is over when no zombie is hunting any more.
  const hunting = w.pawns.some((z) => z.faction === 'zombie' && z.state === 'hunt');
  if (s.hordeActive && !hunting && colonists(w).length) {
    s.hordeActive = false;
    if (w.autoAlarm) setAlarm(w, false);
    letter(w, 'The attack is over. The camp is quiet again, for now.', 'good');
    for (const p of colonists(w)) addMemory(p, 'survivedAttack');
  }

  const winter = seasonOf(w.tick) === 'Winter';
  const strayMtb = (D.strayMtbDays / (isNight(w.tick) ? D.nightStrayMult : 1)) * (winter ? 2 : 1) // the cold keeps them sluggish
    / (1 + (w.din ?? 0) * DIN.strayPer); // noise carries: more strays find a loud colony
  if (rng.chance(mtbChance(strayMtb * TICKS_PER_DAY, STORY_INTERVAL))) strays(w, rng.int(1, 2));

  if (rng.chance(mtbChance(D.miscMtbDays * TICKS_PER_DAY, STORY_INTERVAL))) {
    const options = MISC.filter((i) => !i.canFire || i.canFire(w));
    let roll = rng.next() * options.reduce((sum, i) => sum + i.weight, 0);
    options.find((i) => (roll -= i.weight) < 0)?.fire(w);
  }

  const intent = curve(POP_INTENT, colonists(w).length);
  if (intent > 0 && rng.chance(mtbChance((D.popMtbDays * TICKS_PER_DAY) / intent, STORY_INTERVAL))) survivorJoins(w);
}

// ---- Spawning -------------------------------------------------------------

export function colonyCenter(w) {
  const cs = colonists(w);
  if (!cs.length) return { x: w.w >> 1, y: w.h >> 1 };
  return {
    x: Math.round(cs.reduce((s, p) => s + p.x, 0) / cs.length),
    y: Math.round(cs.reduce((s, p) => s + p.y, 0) / cs.length),
  };
}

const zombieCount = (w) => w.pawns.reduce((n, p) => n + (p.faction === 'zombie'), 0);
const walkable = (w, x, y) => inBounds(w, x, y) && zombieCost(w, x, y) !== Infinity && !bashTargetAt(w, x, y);

// A random walkable map-edge cell; `side` 0..3 = W, E, N, S.
function edgeCell(w, side = w.rng.int(0, 3)) {
  for (let tries = 0; tries < 200; tries++) {
    const x = side === 0 ? 0 : side === 1 ? w.w - 1 : w.rng.int(0, w.w - 1);
    const y = side === 2 ? 0 : side === 3 ? w.h - 1 : w.rng.int(0, w.h - 1);
    if (walkable(w, x, y)) return { x, y };
  }
  return null;
}

function horde(w, points, text) {
  const room = Math.max(0, 150 - zombieCount(w));
  const count = Math.min(room, Math.max(1, Math.round(points / DIRECTOR.pointsPerZombie)));
  const origin = edgeCell(w);
  if (!origin || !count) return;
  let placed = 0;
  for (let r = 0; placed < count && r < 8; r++) {
    for (let dy = -r; dy <= r && placed < count; dy++) for (let dx = -r; dx <= r && placed < count; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !walkable(w, origin.x + dx, origin.y + dy)) continue;
      w.pawns.push(makeZombie(w, origin.x + dx, origin.y + dy, { state: 'hunt', horde: true }));
      placed++;
    }
  }
  w.fieldDirty = true;
  if (placed >= 3) {
    w.story.hordeActive = true;
    w.story.hordeId = (w.story.hordeId ?? 0) + 1;
    if (w.autoAlarm) setAlarm(w, true);
  }
  const side = origin.x === 0 ? 'west' : origin.x === w.w - 1 ? 'east' : origin.y === 0 ? 'north' : 'south';
  letter(w, text ?? `A horde of ${placed} is coming from the ${side}!`, 'bad', origin);
}

function strays(w, n) {
  if (zombieCount(w) >= MAX_ZOMBIES) return;
  const c = colonyCenter(w);
  for (let i = 0; i < n; i++) {
    const cell = edgeCell(w);
    if (!cell) continue;
    const z = makeZombie(w, cell.x, cell.y, { state: 'investigate' });
    z.goal = { x: Math.max(0, Math.min(w.w - 1, c.x + w.rng.int(-25, 25))), y: Math.max(0, Math.min(w.h - 1, c.y + w.rng.int(-25, 25))) };
    w.pawns.push(z);
  }
}

// An edge cell survivors can actually walk in from.
function arrivalCell(w) {
  const c = colonyCenter(w);
  const g = reachGroup(w, c.x, c.y);
  for (let tries = 0; tries < 200; tries++) {
    const cell = edgeCell(w);
    if (cell && (g < 0 || w.reach[idx(w, cell.x, cell.y)] === g)) return cell;
  }
  return null;
}

function survivorJoins(w) {
  const cell = arrivalCell(w);
  if (!cell) return;
  const p = makeColonist(w, cell.x, cell.y);
  w.pawns.push(p);
  letter(w, `${p.name}, a survivor on their own, has asked to join you.`, 'good', cell);
}

function looters(w) {
  const cell = arrivalCell(w);
  if (!cell) return;
  const n = w.rng.int(1, 3);
  for (let i = 0; i < n; i++) w.pawns.push(makeLooter(w, cell.x, cell.y, w.tick + 0.4 * TICKS_PER_DAY));
  letter(w, `${n} looter${n > 1 ? 's are' : ' is'} sneaking in to raid your supplies.`, 'bad', cell);
}

const MISC = [
  {
    key: 'supplyDrop', weight: 3,
    fire(w) {
      const def = w.rng.pick(['cannedFood', 'scrap', 'wood', 'meal', 'medkit', 'ammo']);
      const count = { meal: w.rng.int(8, 16), cannedFood: w.rng.int(8, 16), medkit: w.rng.int(2, 5), ammo: w.rng.int(30, 60) }[def] ?? w.rng.int(30, 60);
      const c = colonyCenter(w);
      const at = { x: c.x + w.rng.int(-8, 8), y: c.y + w.rng.int(-8, 8) };
      spawnItem(w, def, count, at.x, at.y);
      makeNoise(w, at.x, at.y, 25); // a helicopter isn't subtle
      letter(w, `A helicopter dropped a supply crate: ${count} ${THINGS[def].label.toLowerCase()}. The noise carried.`, 'good', at);
    },
  },
  {
    key: 'screams', weight: 1,
    fire(w) {
      for (const p of colonists(w)) addMemory(p, 'screams');
      letter(w, 'Screams echo from somewhere past the trees, then stop.', 'bad');
    },
  },
  {
    key: 'starryNight', weight: 1,
    fire(w) {
      for (const p of colonists(w)) addMemory(p, 'starryNight');
      letter(w, 'The sky is perfectly clear tonight. For a moment it feels like before.', 'good');
    },
  },
  {
    key: 'blight', weight: 1,
    canFire: (w) => allThings(w, (t, d) => d.sowable).length >= 4,
    fire(w) {
      let n = 0;
      for (const c of allThings(w, (t, d) => d.sowable)) if (w.rng.chance(0.5)) { despawn(w, c); n++; }
      letter(w, `Blight! ${n} crops withered.`, 'bad');
    },
  },
  {
    key: 'bumperBerries', weight: 1,
    canFire: (w) => allThings(w, (t) => t.def === 'berryBush').length > 0,
    fire(w) {
      for (const b of allThings(w, (t) => t.def === 'berryBush')) b.growth = 1;
      letter(w, 'The wild berry bushes are suddenly heavy with fruit.', 'good');
    },
  },
  { key: 'looters', weight: 1, canFire: (w) => w.tick > 6 * TICKS_PER_DAY, fire: looters },
  {
    key: 'coldSnap', weight: 1.5,
    canFire: (w) => !w.weather && seasonOf(w.tick) !== 'Summer',
    fire(w) {
      w.weather = { kind: 'coldSnap', offset: -w.rng.range(12, 18), until: w.tick + w.rng.range(1, 2) * TICKS_PER_DAY };
      letter(w, 'A cold snap is coming. Temperatures will plunge for a day or two. Get everyone somewhere warm.', 'bad');
    },
  },
  {
    key: 'heatWave', weight: 1.5,
    canFire: (w) => !w.weather && seasonOf(w.tick) === 'Summer',
    fire(w) {
      w.weather = { kind: 'heatWave', offset: w.rng.range(10, 14), until: w.tick + w.rng.range(1, 2) * TICKS_PER_DAY };
      letter(w, 'A heat wave has settled in. The dead are restless, and so is everyone else.', 'bad');
    },
  },
];

export const debugIncidents = {
  horde: (w) => horde(w, threatPoints(w)),
  bigHorde: (w) => horde(w, 600),
  strays: (w) => strays(w, 3),
  survivor: survivorJoins,
  looters,
  ...Object.fromEntries(MISC.map((i) => [i.key, i.fire])),
};
