// Zombies, combat, injuries, and the dead rising. See docs/DESIGN.md §4–6.
//
// Zombies don't use the job system: there can be 100+ of them, so they run a tiny state
// machine (wander → investigate a noise → hunt) and hunting ones all share ONE flow field —
// a multi-source Dijkstra outward from every survivor, where walls and doors cost "bash time"
// proportional to their HP. Each zombie just steps downhill; if downhill is a wall, it bashes.

import { TICKS_PER_DAY, SURVIVOR, ZOMBIE, REANIMATE_DAYS, ZOMBIE_CORPSE_ROT_DAYS, MOVE_CELLS_PER_TICK, THREAT_SCAN, MEDICAL } from './config.js';
import { THINGS } from './defs.js';
import { findPath, Heap } from './path.js';
import {
  idx, inBounds, DIRS, blocksSight, zombieCost, bashTargetAt, spawnItem, despawn, colonists, letter, dist,
  allThings, canReach, randomReachableCell, moveCost, isNight, reservedByOther, ckey, thingsAt,
} from './world.js';
import { makeZombie, traitMult, canFight, isGentle, learn } from './pawn.js';
import { addMemory } from './mood.js';
import { endJob, removePawn, dropCarried, stepMove, face, goTo, wait, DONE, FAIL } from './jobs.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Visual-only events for the renderer (tracers, trap snaps). Never read by the sim.
export function fx(w, e) {
  w.fx.push({ ...e, tick: w.tick, id: (w.fxSerial = (w.fxSerial ?? 0) + 1) });
  if (w.fx.length > 80) w.fx.shift();
}

// ---- Weapons --------------------------------------------------------------

export const UNARMED = { melee: true, damage: SURVIVOR.meleeDamage, cooldown: SURVIVOR.meleeCooldown, rank: 1 };
export const weaponOf = (p) => (p.weapon ? THINGS[p.weapon.def].weapon : UNARMED);
export const canShoot = (p) => !!weaponOf(p).ranged && p.ammo > 0;
// Standing on a watchtower adds sight and range.
export const postAt = (w, p) => thingsAt(w, p.x, p.y).find((t) => THINGS[t.def].guardPost) ?? null;
const postBonus = (w, p, field) => { const t = postAt(w, p); return t ? THINGS[t.def][field] : 0; };

// ---- Sight & noise --------------------------------------------------------

// Bresenham line of sight; walls and closed doors block it (barricades don't).
export function canSee(w, ax, ay, bx, by) {
  let x = ax, y = ay;
  const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  let err = dx + dy;
  while (x !== bx || y !== by) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if (x === bx && y === by) return true;
    if (blocksSight(w, x, y)) return false;
  }
  return true;
}

// Anything loud pulls idle zombies within `radius` toward it.
export function makeNoise(w, x, y, radius) {
  for (const z of w.pawns) {
    if (z.faction !== 'zombie' || z.state === 'hunt') continue;
    if (Math.abs(z.x - x) > radius || Math.abs(z.y - y) > radius) continue;
    z.state = 'investigate';
    z.goal = { x: clamp(x + w.rng.int(-2, 2), 0, w.w - 1), y: clamp(y + w.rng.int(-2, 2), 0, w.h - 1) };
    z.path = null;
  }
}

// ---- Zombie flow field ----------------------------------------------------

// Cells a zombie can stand in right now (no bashing needed).
const zWalkable = (w, x, y) => zombieCost(w, x, y) !== Infinity && !bashTargetAt(w, x, y);
const diagOk = (w, x, y, dx, dy) => !(dx && dy) || (zWalkable(w, x + dx, y) && zWalkable(w, x, y + dy));

export function updateZombieField(w) {
  const f = w.zfield;
  f.fill(Infinity);
  const closed = new Uint8Array(f.length);
  const heap = new Heap();
  for (const p of w.pawns) {
    if (p.faction !== 'colony') continue;
    const i = idx(w, p.x, p.y);
    f[i] = 0;
    heap.push(i, 0);
  }
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % w.w, cy = (cur / w.w) | 0;
    const enter = zombieCost(w, cx, cy); // what a zombie pays to step INTO cur
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(w, nx, ny)) continue;
      const ni = ny * w.w + nx;
      if (closed[ni] || zombieCost(w, nx, ny) === Infinity || !diagOk(w, nx, ny, -dx, -dy)) continue;
      const v = f[cur] + enter * (dx && dy ? Math.SQRT2 : 1);
      if (v < f[ni]) {
        f[ni] = v;
        heap.push(ni, v);
      }
    }
  }
}

// ---- Zombie behavior ------------------------------------------------------

export function tickZombie(w, z) {
  if (z.attackCd > 0) z.attackCd--;
  if (z.move) return advanceStep(w, z);
  if ((w.tick + z.id) % THREAT_SCAN === 0) perceive(w, z);

  const victim = adjacentHuman(w, z);
  if (victim) {
    face(z, victim);
    if (z.attackCd <= 0) zombieAttack(w, z, victim);
    return;
  }
  if (z.state === 'hunt') huntStep(w, z);
  else if (z.state === 'investigate') goalStep(w, z);
  else wanderStep(w, z);
}

function perceive(w, z) {
  const sight = isNight(w.tick) ? ZOMBIE.sight + 3 : ZOMBIE.sight; // they're worse at night
  let seen = false;
  for (const p of w.humans) {
    if (p.faction !== 'colony') continue;
    const d = dist(z, p);
    if (d <= ZOMBIE.smell || (d <= sight && canSee(w, z.x, z.y, p.x, p.y))) { seen = true; break; }
  }
  if (seen) {
    z.lastSeen = w.tick;
    if (z.state !== 'hunt') { z.state = 'hunt'; w.fieldDirty = true; }
  } else if (z.state === 'hunt' && !z.horde && w.tick - z.lastSeen > ZOMBIE.loseInterestTicks) {
    z.state = 'wander';
  }
}

function adjacentHuman(w, z) {
  for (const p of w.humans) {
    if (p.gone || Math.abs(p.x - z.x) > 1 || Math.abs(p.y - z.y) > 1) continue;
    const dx = p.x - z.x, dy = p.y - z.y;
    if (dx && dy && !zWalkable(w, z.x + dx, z.y) && !zWalkable(w, z.x, z.y + dy)) continue; // no biting through wall corners
    return p;
  }
  return null;
}

// Step toward (nx, ny), or bash whatever's in the way.
function tryStep(w, z, nx, ny) {
  const dx = nx - z.x, dy = ny - z.y;
  if (dx && dy && !diagOk(w, z.x, z.y, dx, dy)) {
    // Squeezing past a wall corner isn't allowed; hit the orthogonal obstacle instead.
    const a = [z.x + dx, z.y], b = [z.x, z.y + dy];
    const alt = bashTargetAt(w, ...a) ? a : bashTargetAt(w, ...b) ? b : null;
    return alt ? tryStep(w, z, alt[0], alt[1]) : false;
  }
  z.facing = Math.atan2(dy, dx);
  const b = bashTargetAt(w, nx, ny);
  if (b) {
    if (z.attackCd <= 0) bash(w, z, b);
    return;
  }
  if (zombieCost(w, nx, ny) === Infinity) return false;
  z.move = { path: [[nx, ny]], i: 0, progress: 0 };
  return true;
}

function advanceStep(w, z) {
  const [nx, ny] = z.move.path[0];
  if (!zWalkable(w, nx, ny)) { z.move = null; return; } // something got built there
  const diag = nx !== z.x && ny !== z.y;
  z.move.progress += (MOVE_CELLS_PER_TICK * z.speed) / (moveCost(w, nx, ny) * (diag ? Math.SQRT2 : 1));
  if (z.move.progress >= 1) {
    z.x = nx;
    z.y = ny;
    z.move = null;
    triggerTrap(w, z);
  }
}

function triggerTrap(w, z) {
  const trap = thingsAt(w, z.x, z.y).find((t) => THINGS[t.def].trap && t.armed);
  if (!trap) return;
  trap.armed = false;
  fx(w, { kind: 'trap', x: z.x, y: z.y });
  hurtPawn(w, z, w.rng.range(...THINGS[trap.def].trap.damage));
}

function huntStep(w, z) {
  const here = w.zfield[idx(w, z.x, z.y)];
  if (here === Infinity) { z.state = 'wander'; return; } // nobody reachable, even by bashing
  let best = null, bestV = here;
  for (const [dx, dy] of DIRS) {
    const nx = z.x + dx, ny = z.y + dy;
    if (!inBounds(w, nx, ny) || !diagOk(w, z.x, z.y, dx, dy)) continue;
    const v = w.zfield[idx(w, nx, ny)] + (dx && dy ? 0.01 : 0);
    if (v < bestV) { bestV = v; best = [nx, ny]; }
  }
  if (best) tryStep(w, z, best[0], best[1]);
}

function goalStep(w, z) {
  if (!z.path) {
    z.path = findPath(w, z.x, z.y, { x: z.goal.x, y: z.goal.y }, zombieCost);
    z.pathI = 0;
    if (!z.path) { z.state = 'wander'; z.goal = null; return; }
  }
  while (z.pathI < z.path.length && z.path[z.pathI][0] === z.x && z.path[z.pathI][1] === z.y) z.pathI++;
  const next = z.path[z.pathI];
  if (!next || Math.abs(next[0] - z.x) > 1 || Math.abs(next[1] - z.y) > 1) {
    z.state = 'wander';
    z.goal = z.path = null;
    return;
  }
  tryStep(w, z, next[0], next[1]);
}

function wanderStep(w, z) {
  if (--z.idle > 0) return;
  z.idle = w.rng.int(90, 320);
  const [dx, dy] = w.rng.pick(DIRS);
  if (zWalkable(w, z.x + dx, z.y + dy) && diagOk(w, z.x, z.y, dx, dy)) tryStep(w, z, z.x + dx, z.y + dy);
}

function zombieAttack(w, z, victim) {
  z.attackCd = ZOMBIE.cooldown;
  z.lunge = w.tick;
  if (!w.rng.chance(ZOMBIE.hitChance * (victim.downed ? 1.6 : 1))) return;
  hurtPawn(w, victim, w.rng.range(...ZOMBIE.damage), z);
}

function bash(w, z, b) {
  z.attackCd = ZOMBIE.cooldown;
  z.lunge = w.tick;
  b.hp -= w.rng.range(...ZOMBIE.buildingDamage);
  b.lastHit = w.tick;
  if (w.tick % 3 === 0) makeNoise(w, b.x, b.y, 8); // banging on walls draws a crowd
  // Fighters nearby hear it and come out to deal with it.
  for (const p of w.pawns) if (p.faction === 'colony' && dist(p, b) <= 16) p.heard = { z, tick: w.tick };
  if (b.hp > 0) return;
  despawn(w, b);
  w.fieldDirty = true;
  if (THINGS[b.def].cost && w.tick - (w.lastBreachLetter ?? -1e9) > 2500) { // only your buildings are news
    w.lastBreachLetter = w.tick;
    letter(w, `Zombies broke through a ${THINGS[b.def].label.toLowerCase()}!`, 'bad', b);
  }
}

// ---- Damage & death ---------------------------------------------------------

export function goDown(w, p) {
  p.downed = true;
  p.move = null;
  endJob(w, p, FAIL);
  if (p.faction === 'colony') letter(w, `${p.name} is down and needs rescuing!`, 'bad', p);
}

export function hurtPawn(w, p, dmg, attacker) {
  if (p.gone) return;
  p.lastHurt = w.tick;
  if (p.faction === 'zombie') {
    p.hp -= dmg;
    if (p.state !== 'hunt') { p.state = 'hunt'; p.lastSeen = w.tick; w.fieldDirty = true; }
    if (p.hp <= 0) killZombie(w, p);
    return;
  }
  const taken = dmg * traitMult(p, 'damageTaken');
  p.hp -= taken;
  if (p.faction === 'colony') p.bleed = (p.bleed ?? 0) + taken * MEDICAL.bleedPerDamage;
  if (attacker?.faction === 'zombie' && p.faction === 'colony' && !p.infection && w.rng.chance(ZOMBIE.biteChance)) {
    p.infection = { severity: w.rng.range(0.05, 0.15), immunity: 0 };
    letter(w, `${p.name} was bitten! Get them into a bed with a doctor. It's a race against the infection.`, 'bad', p);
  }
  if (p.hp <= 0) return killHuman(w, p, attacker ? 'was killed by zombies' : 'died');
  if (!p.downed && p.hp < SURVIVOR.downedBelow) goDown(w, p);
}

function killZombie(w, z) {
  removePawn(w, z);
  w.stats.zombiesKilled++;
  spawnItem(w, 'corpse', 1, z.x, z.y, { name: z.name, zombie: true, look: z.look, rotAt: w.tick + ZOMBIE_CORPSE_ROT_DAYS * TICKS_PER_DAY });
}

export function killHuman(w, p, cause, riseInDays = w.rng.range(...REANIMATE_DAYS)) {
  dropCarried(w, p);
  if (p.weapon) spawnItem(w, p.weapon.def, 1, p.x, p.y);
  if (p.ammo > 0) spawnItem(w, 'ammo', p.ammo, p.x, p.y);
  p.weapon = null;
  p.ammo = 0;
  removePawn(w, p);
  spawnItem(w, 'corpse', 1, p.x, p.y, { name: p.name, look: p.look, reanimateAt: w.tick + riseInDays * TICKS_PER_DAY });
  if (p.faction !== 'colony') return;
  w.stats.deaths++;
  letter(w, `${p.name} ${cause}. Burn the body, or they'll rise again.`, 'bad', p);
  for (const c of colonists(w)) addMemory(c, 'colonistDied');
}

// Called every rare tick: corpses rot away or get back up.
export function tickCorpses(w) {
  for (const c of allThings(w, (t, d) => d.corpse)) {
    if (c.rotAt && w.tick >= c.rotAt) despawn(w, c);
    else if (c.reanimateAt && w.tick >= c.reanimateAt) {
      despawn(w, c);
      const z = makeZombie(w, c.x, c.y, { turnedFrom: c.name, clothes: c.look?.clothes });
      w.pawns.push(z);
      letter(w, `${c.name} has risen as one of them.`, 'bad', c);
      for (const p of colonists(w)) if (dist(p, c) <= 14 && canSee(w, p.x, p.y, c.x, c.y)) addMemory(p, 'sawTurn');
    }
  }
}

// ---- Survivor combat ------------------------------------------------------

export function scanThreat(w, p) {
  const sight = (isNight(w.tick) ? 8 : SURVIVOR.sight) + postBonus(w, p, 'sightBonus');
  let best = null, bestD = Infinity;
  for (const z of w.pawns) {
    if (z.faction !== 'zombie') continue;
    const d = dist(p, z);
    if (d > sight || d >= bestD) continue;
    if (d > 1 && !canSee(w, p.x, p.y, z.x, z.y)) continue;
    best = z;
    bestD = d;
  }
  if (!best && p.heard && w.tick - p.heard.tick < 300 && !p.heard.z.gone) best = p.heard.z;
  return best;
}

function meleeAttack(w, a, target) {
  const wpn = weaponOf(a).melee ? weaponOf(a) : UNARMED; // a gun with no ammo is a club
  a.attackCd = wpn.cooldown;
  a.lunge = w.tick;
  const lvl = a.skills.melee?.level ?? 0;
  learn(a, 'melee', 25);
  makeNoise(w, a.x, a.y, 6);
  if (!w.rng.chance(Math.min(0.95, 0.62 + 0.017 * lvl))) return;
  hurtPawn(w, target, w.rng.range(...wpn.damage) * (1 + 0.04 * lvl) * traitMult(a, 'meleeDamage'), a);
}

function shoot(w, a, target, wpn) {
  a.attackCd = wpn.cooldown;
  a.lunge = w.tick;
  a.ammo--;
  learn(a, 'shooting', 30);
  makeNoise(w, a.x, a.y, wpn.noise); // the price of guns
  const lvl = a.skills.shooting?.level ?? 0;
  const d = dist(a, target);
  const p = clamp(wpn.accuracy * (0.7 + 0.03 * lvl) * traitMult(a, 'accuracy') * (1 - (0.3 * d) / (wpn.range + 3)), 0.1, 0.97);
  const hit = w.rng.chance(p);
  fx(w, { kind: 'shot', x0: a.x, y0: a.y, x1: target.x + (hit ? 0 : w.rng.range(-1.2, 1.2)), y1: target.y + (hit ? 0 : w.rng.range(-1.2, 1.2)), hit });
  if (hit) hurtPawn(w, target, w.rng.range(...wpn.damage) * (1 + 0.03 * lvl), a);
}

// Fighters only take fights they can win: more than ~2 zombies per nearby fighter means fall back.
function outnumbered(w, p, z) {
  let foes = 0, friends = 0;
  for (const o of w.pawns) {
    if (o.faction === 'zombie') { if (dist(o, z) <= 4) foes++; }
    else if (o.faction === 'colony' && !o.downed && canFight(o) && dist(o, p) <= 10) friends++;
  }
  return foes > friends * 2 + 1;
}

export function fightJob(w, p, z) {
  return {
    def: 'fight', kind: 'combat', report: canShoot(p) ? 'shooting zombies' : 'fighting a zombie', target: z,
    toils: [{
      tick(w, p, j) {
        const z = j.target;
        if (z.gone) return DONE;
        if (p.hp < p.maxHp * SURVIVOR.fleeBelow && dist(p, z) > 1) return FAIL;
        const d = dist(p, z);
        const wpn = weaponOf(p);
        const post = postAt(w, p);
        if (canShoot(p)) {
          const range = wpn.range + (post ? THINGS[post.def].rangeBonus : 0);
          if (!p.move && d <= range && canSee(w, p.x, p.y, z.x, z.y)) {
            face(p, z);
            if (p.attackCd <= 0) shoot(w, p, z, wpn);
            return;
          }
          if (post && !p.move) return DONE; // hold the tower; don't chase
          if (d > range + 10) return DONE;
          if ((w.tick + p.id) % 60 === 0 && d <= 2 && outnumbered(w, p, z)) return FAIL;
        } else {
          if (d <= 1 && !p.move) {
            face(p, z);
            if (p.attackCd <= 0) meleeAttack(w, p, z);
            return;
          }
          if (d > SURVIVOR.sight + 4) return DONE;
          if ((w.tick + p.id) % 60 === 0 && outnumbered(w, p, z)) return FAIL; // more arrived: fall back
        }
        if (!p.move) {
          const path = findPath(w, p.x, p.y, { x: z.x, y: z.y, touch: true });
          if (!path) return FAIL;
          if (!path.length) return;
          p.move = { path: path.slice(0, 2), i: 0, progress: 0 }; // short hops; the target moves
        }
        if (stepMove(w, p) === FAIL) p.move = null;
      },
    }],
  };
}

export function fleeJob(w, p, threat) {
  let dest = null, shelter = false;
  for (const z of w.zones) {
    if (z.type !== 'shelter') continue;
    for (const i of z.cells) {
      const c = { x: i % w.w, y: (i / w.w) | 0 };
      if (dist(c, threat) < 4 || reservedByOther(w, ckey(w, c.x, c.y), p) || !canReach(w, p, c.x, c.y, false)) continue;
      if (!dest || dist(p, c) < dist(p, dest)) dest = c;
    }
  }
  if (dest) shelter = true;
  else {
    let bestScore = -Infinity;
    for (let i = 0; i < 16; i++) {
      const c = randomReachableCell(w, p, 14);
      if (!c) continue;
      const score = dist(c, threat) - 0.3 * dist(p, c);
      if (score > bestScore) { bestScore = score; dest = c; }
    }
  }
  if (!dest) return null;
  return {
    def: 'flee', kind: 'combat', report: shelter ? 'fleeing to shelter' : 'running from zombies', cell: dest,
    reserve: shelter ? [ckey(w, dest.x, dest.y)] : [],
    toils: [goTo((j) => j.cell, false), wait(400, (w, p) => {
      if (w.pawns.some((o) => o.faction === 'zombie' && dist(o, p) <= 1)) return FAIL; // caught: rethink (fight back)
      return scanThreat(w, p) ? undefined : DONE;
    })],
  };
}

export function threatResponse(w, p, z) {
  // Cornered: anyone willing to fight swings back at whatever is on them, odds be damned.
  const onMe = !isGentle(p) && w.pawns.find((o) => o.faction === 'zombie' && dist(o, p) <= 1);
  if (onMe) return fightJob(w, p, onMe);
  if (canFight(p) && p.hp >= p.maxHp * SURVIVOR.fleeBelow) {
    if (canShoot(p)) {
      // Shooters hold at range even against a crowd; they only fall back when it gets close.
      if ((dist(p, z) > 4 || !outnumbered(w, p, z)) && (canSee(w, p.x, p.y, z.x, z.y) || canReach(w, p, z.x, z.y, true))) return fightJob(w, p, z);
    } else if (canReach(w, p, z.x, z.y, true) && !outnumbered(w, p, z)) return fightJob(w, p, z);
  }
  return dist(p, z) <= 8 || !canFight(p) ? fleeJob(w, p, z) : null;
}
