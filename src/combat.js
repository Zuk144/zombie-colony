// Zombies, combat, injuries, and the dead rising. See docs/DESIGN.md §4–6.
//
// Zombies don't use the job system: there can be 100+ of them, so they run a tiny state
// machine (wander → investigate a noise → hunt) and hunting ones all share ONE flow field —
// a multi-source Dijkstra outward from every survivor, where walls and doors cost "bash time"
// proportional to their HP. Each zombie just steps downhill; if downhill is a wall, it bashes.

import { TICKS_PER_DAY, SURVIVOR, ZOMBIE, REANIMATE_DAYS, ZOMBIE_CORPSE_ROT_DAYS, MOVE_CELLS_PER_TICK, THREAT_SCAN, MEDICAL, FENCE, WIRE, DROPS } from './config.js';
import { THINGS } from './defs.js';
import { findPath, Heap } from './path.js';
import {
  idx, inBounds, DIRS, blocksSight, zombieCost, bashTargetAt, spawnItem, despawn, colonists, letter, dist,
  allThings, canReach, randomReachableCell, moveCost, isNight, reservedByOther, ckey, thingsAt, sizeOf, inYard, fencedOut, compass, buildingAt, passable,
} from './world.js';
import { isPowered, modeAllows } from './power.js';
import { isRunning, isLit, litByFloodlight } from './buildings.js';
import { makeZombie, traitMult, canFight, isGentle, isRunner, learn } from './pawn.js';
import { addMemory } from './mood.js';
import { endJob, removePawn, dropCarried, stepMove, face, goTo, wait, DONE, FAIL } from './jobs.js';
import { tempAt } from './rooms.js';
import { zombieTempFactor } from './climate.js';

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

// Anything loud pulls idle zombies within `radius` toward it. If the noise came from a
// machine, they remember it: arriving, they go after the machine itself (state 'wreck').
export function makeNoise(w, x, y, radius, source = null) {
  for (const z of w.pawns) {
    if (z.faction !== 'zombie' || z.state === 'hunt' || z.state === 'wreck') continue;
    if (Math.abs(z.x - x) > radius || Math.abs(z.y - y) > radius) continue;
    if (z.state === 'investigate' && z.noiseSource === source?.id) continue; // already on its way
    z.state = 'investigate';
    z.noiseSource = source?.id ?? null;
    z.goal = { x: clamp(x + w.rng.int(-2, 2), 0, w.w - 1), y: clamp(y + w.rng.int(-2, 2), 0, w.h - 1) };
    z.path = null;
  }
}

const machineActive = (w, t) => !!t && !t.broken && w.things.has(t.id) && (isRunning(w, t) || isLit(w, t));

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
  // Someone hacking at them through the wire is right there: grab back through it.
  const grab = wireVictim(w, z);
  if (grab) {
    face(z, grab);
    if (z.attackCd <= 0) zombieAttack(w, z, grab, WIRE.grabHit);
    return;
  }
  if (z.state === 'hunt') huntStep(w, z);
  else if (z.state === 'investigate') goalStep(w, z);
  else if (z.state === 'wreck') wreckStep(w, z);
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
  z.move.progress += (MOVE_CELLS_PER_TICK * z.speed * zombieTempFactor(tempAt(w, z.x, z.y))) / (moveCost(w, nx, ny) * (diag ? Math.SQRT2 : 1));
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
    // Arrived. If a machine made the noise and it's still going, go wreck it.
    const src = z.noiseSource != null ? w.things.get(z.noiseSource) : null;
    z.goal = z.path = null;
    if (machineActive(w, src)) { z.state = 'wreck'; z.wreckId = src.id; }
    else z.state = 'wander';
    return;
  }
  tryStep(w, z, next[0], next[1]);
}

function wreckStep(w, z) {
  const t = w.things.get(z.wreckId);
  if (!machineActive(w, t)) { z.state = 'wander'; z.wreckId = z.path = null; return; }
  if (dist(z, t) <= 1) {
    face(z, t);
    if (z.attackCd <= 0) bash(w, z, t);
    return;
  }
  if (!z.path || z.pathI >= z.path.length) {
    const [sw, sh] = sizeOf(t);
    z.path = findPath(w, z.x, z.y, { x: t.x, y: t.y, w: sw, h: sh, touch: true }, zombieCost);
    z.pathI = 0;
    if (!z.path || !z.path.length) { z.state = 'wander'; z.wreckId = z.path = null; return; }
  }
  while (z.pathI < z.path.length && z.path[z.pathI][0] === z.x && z.path[z.pathI][1] === z.y) z.pathI++;
  const next = z.path[z.pathI];
  if (!next || Math.abs(next[0] - z.x) > 1 || Math.abs(next[1] - z.y) > 1) { z.path = null; return; }
  tryStep(w, z, next[0], next[1]);
}

function wanderStep(w, z) {
  if (--z.idle > 0) return;
  z.idle = w.rng.int(90, 320);
  const [dx, dy] = w.rng.pick(DIRS);
  if (zWalkable(w, z.x + dx, z.y + dy) && diagOk(w, z.x, z.y, dx, dy)) tryStep(w, z, z.x + dx, z.y + dy);
}

function zombieAttack(w, z, victim, mult = 1) {
  z.attackCd = ZOMBIE.cooldown;
  z.lunge = w.tick;
  if (!w.rng.chance(ZOMBIE.hitChance * mult * (victim.downed ? 1.6 : 1))) return;
  hurtPawn(w, victim, w.rng.range(...ZOMBIE.damage), z);
}

function bash(w, z, b) {
  const d = THINGS[b.def];
  z.attackCd = ZOMBIE.cooldown;
  z.lunge = w.tick;
  let dmg = w.rng.range(...ZOMBIE.buildingDamage);
  // Fences: a lone straggler just rattles one; it takes a crowd pushing together.
  if (d.fence && w.pawns.filter((o) => o.faction === 'zombie' && dist(o, b) <= 1).length < FENCE.crowd) dmg *= FENCE.loneFactor;
  if (electrified(w, b)) {
    fx(w, { kind: 'zap', x: b.x, y: b.y });
    z.attackCd += d.electric.stagger;
    hurtPawn(w, z, w.rng.range(...d.electric.damage));
    if (z.gone) return;
  }
  b.hp -= dmg;
  b.lastHit = w.tick;
  if (w.tick % 3 === 0) makeNoise(w, b.x, b.y, 8); // banging on walls draws a crowd
  // Fighters nearby hear it and come out to deal with it.
  for (const p of w.pawns) if (p.faction === 'colony' && dist(p, b) <= 16) p.heard = { z, tick: w.tick };
  if (b.hp > 0) return;
  if (d.machine) { // machines break instead of vanishing; a builder can repair them
    b.hp = 0;
    b.broken = true;
    b.running = false;
    w.fieldDirty = true;
    letter(w, `Zombies wrecked the ${d.label.toLowerCase()}. A builder can repair it.`, 'bad', b);
    return;
  }
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
  // The dead carry things: a circuit board now and then, scrap more often. It drops where they
  // fall (usually outside the wire), and haulers bring it in once it's quiet.
  if (w.rng.chance(DROPS.componentChance)) {
    spawnItem(w, 'components', 1, z.x, z.y);
    if (w.story && !w.story.firstPartDrop) {
      w.story.firstPartDrop = true;
      letter(w, 'One of the dead was carrying a circuit board. Haulers will bring it in when it’s quiet.', 'good', { x: z.x, y: z.y });
    }
  }
  if (w.rng.chance(DROPS.scrapChance)) spawnItem(w, 'scrap', w.rng.int(...DROPS.scrap), z.x, z.y);
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
  // Inside the secure yard, the dead on the far side of the wire aren't a threat, only a target
  // for anyone who can hit them through it. People keep working; the fence does its job.
  const ignored = (z) => fencedOut(w, p, z) && !throughWire(w, p, z);
  let best = null, bestD = Infinity;
  for (const z of w.pawns) {
    if (z.faction !== 'zombie') continue;
    const d = dist(p, z);
    if (d >= bestD) continue;
    // At night, zombies standing in a floodlight's pool can be seen from much farther.
    if (d > sight && !(isNight(w.tick) && d <= 18 && litByFloodlight(w, z.x, z.y))) continue;
    if (d > 1 && !canSee(w, p.x, p.y, z.x, z.y)) continue;
    if (ignored(z)) continue;
    best = z;
    bestD = d;
  }
  if (!best && p.heard && w.tick - p.heard.tick < 300 && !p.heard.z.gone && !ignored(p.heard.z)) best = p.heard.z;
  return best;
}

// Can `p` hurt a fenced-out zombie from inside the yard? Shooters in range can, and so can a
// blade if there's a free spot to hack at it through the wire.
function throughWire(w, p, z) {
  if (!canFight(p) || p.hp < p.maxHp * SURVIVOR.fleeBelow) return false;
  if (canShoot(p)) return dist(p, z) <= weaponOf(p).range + postBonus(w, p, 'rangeBonus');
  return hasBlade(p) && !!hackSpot(w, p, z);
}

// ---- Hacking through the wire (DESIGN §4) -----------------------------------
// A blade reaches a zombie exactly 2 cells away in a straight line (orthogonal or diagonal)
// when the cell between is a see-through barrier. The dead grab back along the same line.

const hasBlade = (p) => !!p.weapon && !!THINGS[p.weapon.def].weapon.melee; // fists and empty guns can't reach
const electrified = (w, b) => !!THINGS[b.def].electric && isPowered(w, b) && modeAllows(w, b);
// A barrier you can reach through: chain-link, gates, barricades; an electric fence only when it's dead.
function reachThroughAt(w, x, y) {
  const b = buildingAt(w, x, y);
  return !!b && !!THINGS[b.def].reachThrough && !electrified(w, b);
}
// If a and b are 2 apart in a straight line with a reach-through barrier between, the barrier cell.
function wireBetween(w, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2 || (dx && Math.abs(dx) !== 2) || (dy && Math.abs(dy) !== 2)) return null;
  const m = { x: a.x + dx / 2, y: a.y + dy / 2 };
  return reachThroughAt(w, m.x, m.y) ? m : null;
}
function wireVictim(w, z) {
  for (const p of w.humans) if (!p.gone && !p.downed && wireBetween(w, z, p)) return p;
  return null;
}
// The nearest free cell inside the yard to hack `z` from (2 in line with it, across the barrier).
function hackSpot(w, p, z) {
  let best = null, bestD = Infinity;
  for (const [dx, dy] of DIRS) {
    const s = { x: z.x + 2 * dx, y: z.y + 2 * dy };
    if (!inBounds(w, s.x, s.y) || !inYard(w, s) || !passable(w, s.x, s.y) || !reachThroughAt(w, z.x + dx, z.y + dy)) continue;
    if ((s.x !== p.x || s.y !== p.y) && (reservedByOther(w, ckey(w, s.x, s.y), p) || w.pawns.some((o) => o !== p && o.x === s.x && o.y === s.y))) continue;
    const d = dist(p, s);
    if (d < bestD && canReach(w, p, s.x, s.y, false)) { best = s; bestD = d; }
  }
  return best;
}

// Go stand at the wire and hack at the dead through it. Quiet (melee noise only); the risk is
// the grab back, and a crowd at one section tears it down (the fence crowd rule).
export function hackJob(w, p, z, spot) {
  return {
    def: 'hack', kind: 'combat', report: 'hacking through the wire', target: z, cell: spot,
    reserve: [ckey(w, spot.x, spot.y)],
    toils: [goTo((j) => j.cell, false), {
      tick(w, p, j) {
        if (p.hp < p.maxHp * SURVIVOR.fleeBelow) return FAIL;
        if (!hasBlade(p)) return DONE;
        let z = j.target;
        if (z.gone || !wireBetween(w, p, z)) z = w.pawns.find((o) => o.faction === 'zombie' && wireBetween(w, p, o)) ?? null; // next one in reach
        if (!z) return (w.tick + p.id) % 90 === 0 ? DONE : undefined; // linger a moment, then rethink
        j.target = z;
        face(p, z);
        if (p.attackCd <= 0) meleeAttack(w, p, z, WIRE.reachHit);
      },
    }],
  };
}

// Alarm, for blades: take a spot on the wire, the nearest one to the dead if they're out there.
export function wireJob(w, p) {
  if (!hasBlade(p) || !inYard(w, p)) return null;
  const hunters = w.pawns.filter((z) => z.faction === 'zombie' && z.state === 'hunt');
  const toward = hunters.length ? hunters.reduce((a, b) => (dist(p, a) <= dist(p, b) ? a : b)) : p;
  let best = null, bestD = Infinity;
  for (let y = Math.max(0, p.y - 24); y <= Math.min(w.h - 1, p.y + 24); y++) for (let x = Math.max(0, p.x - 24); x <= Math.min(w.w - 1, p.x + 24); x++) {
    const c = { x, y };
    if (!inYard(w, c) || !passable(w, x, y) || reservedByOther(w, ckey(w, x, y), p)) continue;
    // One cell in from the wire: a reach-through barrier next to it, with open ground beyond.
    const faces = DIRS.some(([dx, dy]) => (!dx || !dy) && reachThroughAt(w, x + dx, y + dy) && inBounds(w, x + 2 * dx, y + 2 * dy) && !inYard(w, { x: x + 2 * dx, y: y + 2 * dy }));
    if (!faces) continue;
    const d = dist(toward, c) * 2 + dist(p, c);
    if (d < bestD && canReach(w, p, x, y, false)) { best = c; bestD = d; }
  }
  if (!best) return null;
  return {
    def: 'holdWire', kind: 'guard', report: 'holding the wire', cell: best, reserve: [ckey(w, best.x, best.y)],
    toils: [goTo((j) => j.cell, false), wait(900, (w) => (w.alarm ? undefined : DONE))],
  };
}

// A Supply runner only backs off from the dead that can actually reach them.
export const runnerDanger = (w, p) => w.pawns.find((z) => z.faction === 'zombie' && dist(z, p) <= 3 && !fencedOut(w, p, z)) ?? null;

function meleeAttack(w, a, target, mult = 1) {
  const wpn = weaponOf(a).melee ? weaponOf(a) : UNARMED; // a gun with no ammo is a club
  a.attackCd = wpn.cooldown;
  a.lunge = w.tick;
  const lvl = a.skills.melee?.level ?? 0;
  learn(a, 'melee', 25);
  makeNoise(w, a.x, a.y, 6);
  if (!w.rng.chance(Math.min(0.95, 0.62 + 0.017 * lvl) * mult)) return;
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

// Auto-turrets: powered, loaded, and in range with a clear line of sight. Loud.
export function tickTurrets(w) {
  for (const t of allThings(w, (t, d) => d.turret)) {
    const d = THINGS[t.def], tu = d.turret;
    t.cd = Math.max(0, (t.cd ?? 0) - THREAT_SCAN);
    if (t.cd > 0 || !(t.ammo > 0) || !isPowered(w, t)) continue;
    let best = null, bestD = Infinity;
    for (const z of w.pawns) {
      if (z.faction !== 'zombie') continue;
      const dd = dist(z, t);
      if (dd <= tu.range && dd < bestD && canSee(w, t.x, t.y, z.x, z.y)) { best = z; bestD = dd; }
    }
    if (!best) continue;
    t.cd = tu.cooldown;
    t.ammo--;
    // Out of rounds mid-horde: one letter per turret per horde, so runners (and you) know where.
    if (t.ammo <= 0 && w.story?.hordeActive && t.dryHorde !== w.story.hordeId) {
      t.dryHorde = w.story.hordeId;
      letter(w, `The ${compass(w, t)} turret is out of rounds.`, 'bad', t);
    }
    t.aim = Math.atan2(best.y - t.y, best.x - t.x);
    t.lastShot = w.tick;
    makeNoise(w, t.x, t.y, tu.noise);
    const hit = w.rng.chance(clamp(tu.accuracy * (1 - (0.3 * bestD) / (tu.range + 3)), 0.1, 0.95));
    fx(w, { kind: 'shot', x0: t.x, y0: t.y, x1: best.x + (hit ? 0 : w.rng.range(-1.2, 1.2)), y1: best.y + (hit ? 0 : w.rng.range(-1.2, 1.2)), hit });
    if (hit) hurtPawn(w, best, w.rng.range(...tu.damage));
  }
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
          if ((w.tick + p.id) % 60 === 0 && d <= 2 && !fencedOut(w, p, z) && outnumbered(w, p, z)) return FAIL;
        } else {
          if (d <= 1 && !p.move) {
            face(p, z);
            if (p.attackCd <= 0) meleeAttack(w, p, z);
            return;
          }
          if (d > SURVIVOR.sight + 4) return DONE;
          if ((w.tick + p.id) % 60 === 0 && outnumbered(w, p, z)) return FAIL; // more arrived: fall back
        }
        if (!p.move && fencedOut(w, p, z)) return DONE; // hold the wire: nobody opens the gate to chase
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
  // Behind the wire: shoot it if you can, otherwise let the fence hold it. Nobody flees a fence.
  if (fencedOut(w, p, z)) {
    if (!throughWire(w, p, z)) return null;
    if (canShoot(p)) return fightJob(w, p, z);
    const spot = hackSpot(w, p, z);
    return spot ? hackJob(w, p, z, spot) : null;
  }
  if (isRunner(p)) { const near = runnerDanger(w, p); return near ? fleeJob(w, p, near) : null; }
  if (canFight(p) && p.hp >= p.maxHp * SURVIVOR.fleeBelow) {
    if (canShoot(p)) {
      // Shooters hold at range even against a crowd; they only fall back when it gets close.
      if ((dist(p, z) > 4 || !outnumbered(w, p, z)) && (canSee(w, p.x, p.y, z.x, z.y) || canReach(w, p, z.x, z.y, true))) return fightJob(w, p, z);
    } else if (canReach(w, p, z.x, z.y, true) && !outnumbered(w, p, z)) return fightJob(w, p, z);
  }
  return dist(p, z) <= 8 || !canFight(p) ? fleeJob(w, p, z) : null;
}
