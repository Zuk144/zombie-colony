// One simulation tick, plus the starting scenario.

import { RARE_TICK, STORY_INTERVAL, TICKS_PER_DAY, THREAT_SCAN, FIELD_INTERVAL } from './config.js';
import { THINGS, TERRAIN } from './defs.js';
import { createWorld, spawnItem, colonyWealth, letter, idx } from './world.js';
import { makeColonist, tickNeeds } from './pawn.js';
import { tickMood } from './mood.js';
import { startJob, tickJob, endJob, FAIL } from './jobs.js';
import { think, shouldInterrupt } from './think.js';
import { tickZombie, updateZombieField, scanThreat, tickCorpses } from './combat.js';
import { tickHealth } from './medical.js';
import { tickClimate, tickExposure, tickRot, tickFrost, outdoorTemp, plantGrowthFactor } from './climate.js';
import { tickBuildings } from './buildings.js';
import { createDirector, tickDirector } from './director.js';
import { generateMap } from './mapgen.js';

export function newGame(seed) {
  const w = createWorld(seed);
  generateMap(w);
  const cx = w.w >> 1, cy = w.h >> 1;
  for (let i = 0; i < 3; i++) w.pawns.push(makeColonist(w, cx - 1 + i, cy));
  spawnItem(w, 'wood', 180, cx - 3, cy + 3);
  spawnItem(w, 'cannedFood', 24, cx + 3, cy + 3);
  spawnItem(w, 'berries', 30, cx + 4, cy + 3);
  spawnItem(w, 'medkit', 3, cx + 5, cy + 3);
  spawnItem(w, 'pistol', 1, cx - 5, cy + 3);
  spawnItem(w, 'ammo', 30, cx - 5, cy + 4);
  w.story = createDirector();
  w.wealth = colonyWealth(w);
  w.humans = [];
  w.outdoor = outdoorTemp(w);
  letter(w, 'Three survivors made camp in a clearing. The dead are out there. Plan well.', 'neutral', { x: cx, y: cy });
  return w;
}

export function tickWorld(w) {
  w.tick++;
  w.humans = w.pawns.filter((p) => p.faction !== 'zombie');
  if (w.fieldDirty || (w.tick % FIELD_INTERVAL === 0 && w.pawns.some((z) => z.state === 'hunt'))) {
    updateZombieField(w);
    w.fieldDirty = false;
  }
  for (const p of w.pawns.slice()) {
    if (p.gone) continue;
    if (p.faction === 'zombie') tickZombie(w, p);
    else tickPawn(w, p);
  }
  if (w.tick % RARE_TICK === 0) {
    tickClimate(w, RARE_TICK);
    tickBuildings(w, RARE_TICK);
    growPlants(w, RARE_TICK);
    tickFrost(w, RARE_TICK);
    tickRot(w, RARE_TICK);
    tickCorpses(w);
  }
  if (w.tick % STORY_INTERVAL === 0) {
    w.wealth = colonyWealth(w);
    tickDirector(w);
  }
  if (w.tick % TICKS_PER_DAY === 0) for (const p of w.pawns) for (const s of Object.values(p.skills ?? {})) s.xpToday = 0;
}

function tickPawn(w, p) {
  if (p.attackCd > 0) p.attackCd--;
  if (p.faction === 'colony' && (w.tick + p.id) % THREAT_SCAN === 0) {
    p.threat = scanThreat(w, p);
    const busy = p.job && (p.job.kind === 'combat' || p.job.kind === 'mental');
    if (p.threat && !p.downed && p.job && !busy) p.interrupt = true;
  }
  if (p.interrupt) {
    p.interrupt = false;
    if (p.job) endJob(w, p, FAIL);
    p.cooldown = 0;
  }
  if (p.downed || p.carriedBy) {
    // Lying on the ground (or being carried): no thinking, just healing (or dying).
  } else if (p.job) tickJob(w, p);
  else if (p.cooldown > 0) p.cooldown--;
  else {
    const job = think(w, p);
    if (job) startJob(w, p, job);
    // Back off briefly after an instant failure so an unreachable target isn't retried every tick.
    if (!p.job && p.lastOutcome === FAIL) p.cooldown = 30;
  }
  if (p.gone || (w.tick + p.id) % RARE_TICK !== 0) return;
  if (p.faction === 'colony') {
    tickNeeds(p, RARE_TICK);
    tickMood(p, w, RARE_TICK);
    tickHealth(w, p, RARE_TICK);
    if (!p.gone) tickExposure(w, p, RARE_TICK);
    if (!p.gone && shouldInterrupt(w, p)) p.interrupt = true;
  } else if (p.faction === 'looter' && w.tick > p.leaveAt && p.job?.def !== 'leave') p.interrupt = true;
}

// Plants need warmth and open sky (grow lamps for indoor farms are a Phase 3 machine).
function growPlants(w, dt) {
  const warmth = plantGrowthFactor(w.outdoor);
  if (warmth <= 0) return;
  for (const t of w.things.values()) {
    const d = THINGS[t.def];
    if (d.kind !== 'plant' || t.growth >= 1) continue;
    const i = idx(w, t.x, t.y);
    if (w.roof[i]) continue;
    const fert = TERRAIN[w.terrain[i]].fertility;
    t.growth = Math.min(1, t.growth + (dt / (d.growDays * TICKS_PER_DAY)) * fert * warmth);
    t.frost = 0;
  }
}
