// The think tree: an ordered list of "should I do this?" checks. First one that yields a job
// wins (RW ThinkTree, flattened). Survivors are never ordered directly — this is the only
// place their behavior comes from.

import { THINGS } from './defs.js';
import { hourOf, allThings, reservedByOther, tkey, ckey, colonists, letter, dist, canReachThing, canReach, inYard, buildingAt } from './world.js';
import { FOOD_HUNGRY, FOOD_URGENT, REST_DROWSY, REST_EXHAUSTED, JOY_LOW, canFight, isGentle, isRunner } from './pawn.js';
import { addMemory } from './mood.js';
import { findWork, supplyWork } from './work.js';
import { threatResponse, weaponOf, canShoot, wireJob } from './combat.js';
import { needsTending, patientJob } from './medical.js';
import { comfortableRooms } from './climate.js';
import { findFood, eatJob, sleepJob, joyJob, wanderJob, tantrumJob, leaveMapJob, stealJob, equipJob, ammoJob, guardJob, shelterJob, warmUpJob, homeJob } from './jobs.js';

const eat = (w, p) => { const f = findFood(w, p); return f && eatJob(w, p, f); };

export function think(w, p) {
  if (p.faction === 'looter') return looterThink(w, p);
  if (p.downed || p.carriedBy) return null;
  if (p.mental) return mentalThink(w, p);
  const threat = p.threat && !p.threat.gone ? threatResponse(w, p, p.threat) : null;
  if (threat) return threat;
  const slot = p.schedule[hourOf(w.tick)];
  const { food, rest, joy } = p.needs;
  return (
    (outsideDuringHorde(w, p) && goHome(w, p)) ||
    (food < FOOD_URGENT && eat(w, p)) ||
    (rest < REST_EXHAUSTED && sleepJob(w, p)) ||
    comfortJob(w, p) ||
    (isRunner(p) && (w.story?.hordeActive || w.alarm || p.threat) && supplyWork(w, p)) ||
    (w.alarm && alarmJob(w, p)) ||
    (needsTending(w, p) && patientJob(w, p)) ||
    (slot === 'guard' && canFight(p) && postJob(w, p)) ||
    (slot === 'sleep' && rest < 0.95 && !w.alarm && sleepJob(w, p)) ||
    (food < FOOD_HUNGRY && eat(w, p)) ||
    (rest < REST_DROWSY && sleepJob(w, p)) ||
    armJob(w, p) ||
    ((slot === 'joy' || (joy < JOY_LOW && slot !== 'work')) && joyJob(w, p)) ||
    (slot !== 'sleep' && slot !== 'joy' && findWork(w, p)) ||
    wanderJob(w, p)
  );
}

const hasFood = (w, p) => allThings(w, (t, d) => d.nutrition && !reservedByOther(w, tkey(t), p)).length > 0;

// Checked every rare tick: should the current job be dropped for something more pressing?
// (Zombie sightings interrupt separately, every THREAT_SCAN ticks — see sim.js.)
export function shouldInterrupt(w, p) {
  const j = p.job;
  if (!j || p.faction !== 'colony') return false;
  if (j.kind === 'need' || j.kind === 'mental' || j.kind === 'combat') return false;
  const { food, rest } = p.needs;
  if (food < FOOD_URGENT && hasFood(w, p)) return true;
  if (rest < REST_EXHAUSTED) return true;
  const slot = p.schedule[hourOf(w.tick)];
  if (j.kind === 'guard') return !w.alarm && slot !== 'guard'; // shift over
  if (slot === 'sleep' && rest < 0.95 && !w.alarm) return true;
  if (slot === 'guard' && canFight(p) && freePost(w, p)) return true;
  if (j.def !== 'goHome' && outsideDuringHorde(w, p)) return true; // the wire is home
  return false;
}

// ---- The wire is home ----------------------------------------------------------

const outsideDuringHorde = (w, p) => !!w.story?.hordeActive && w.secureCount > 0 && !inYard(w, p);

// The nearest open cell inside the secure yard you can walk to.
function goHome(w, p) {
  const cells = [];
  for (let i = 0; i < w.secure.length; i++) {
    if (!w.secure[i]) continue;
    const c = { x: i % w.w, y: (i / w.w) | 0 };
    if (!buildingAt(w, c.x, c.y)) cells.push({ c, d: dist(p, c) });
  }
  cells.sort((a, b) => a.d - b.d);
  const home = cells.slice(0, 40).find(({ c }) => canReach(w, p, c.x, c.y, false));
  return home ? homeJob(w, home.c) : null;
}

// ---- Alarm, guard duty, arming ------------------------------------------------

function freePost(w, p) {
  return allThings(w, (t, d) => d.guardPost && !reservedByOther(w, tkey(t), p))
    .sort((a, b) => dist(p, a) - dist(p, b))
    .find((t) => canReach(w, p, t.x, t.y, false)) ?? null;
}
function postJob(w, p) {
  const post = freePost(w, p);
  return post && guardJob(w, post);
}

// Alarm: shooters man the watchtowers, blades hold the wire, runners keep the guns fed (think()
// tried that first), and everyone else waits in a Shelter zone.
function alarmJob(w, p) {
  if (canFight(p)) return canShoot(p) ? postJob(w, p) || wireJob(w, p) : wireJob(w, p) || postJob(w, p); // guns up the towers, blades to the wire
  for (const z of w.zones) {
    if (z.type !== 'shelter') continue;
    for (const i of z.cells) {
      const c = { x: i % w.w, y: (i / w.w) | 0 };
      if (!reservedByOther(w, ckey(w, c.x, c.y), p) && canReach(w, p, c.x, c.y, false)) return shelterJob(w, c);
    }
  }
  return null;
}

// Getting hypothermia or heatstroke: head for the nearest comfortable indoor room.
function comfortJob(w, p) {
  const cold = (p.hypothermia ?? 0) > 0.15, hot = (p.heatstroke ?? 0) > 0.15;
  if (!cold && !hot) return null;
  let best = null, bestD = Infinity;
  for (const r of comfortableRooms(w)) {
    for (const i of r.cells) {
      const c = { x: i % w.w, y: (i / w.w) | 0 };
      const d = dist(p, c);
      if (d < bestD && canReach(w, p, c.x, c.y, false)) { best = c; bestD = d; }
      if (bestD === 0) break;
    }
  }
  return best && warmUpJob(w, p, best, cold);
}

// Pick up a better weapon, or top up ammo for the one you have.
function armJob(w, p) {
  if (isGentle(p)) return null;
  const ammoItems = allThings(w, (t) => t.def === 'ammo' && !reservedByOther(w, tkey(t), p));
  const hasAmmo = p.ammo > 0 || ammoItems.length > 0;
  const rankOf = (wpn) => (wpn.ranged && !hasAmmo ? 0 : wpn.rank);
  const current = rankOf(weaponOf(p));
  const better = allThings(w, (t, d) => d.weapon && rankOf(d.weapon) > current && !reservedByOther(w, tkey(t), p))
    .sort((a, b) => THINGS[b.def].weapon.rank - THINGS[a.def].weapon.rank || dist(p, a) - dist(p, b))
    .find((t) => canReachThing(w, p, t));
  if (better) return equipJob(w, better);
  if (weaponOf(p).ranged && p.ammo < 12) {
    const a = ammoItems.sort((x, y) => dist(p, x) - dist(p, y)).find((t) => canReachThing(w, p, t));
    if (a) return ammoJob(w, a, 40 - p.ammo);
  }
  return null;
}

// Wake sleepers and pull workers off the job when the alarm sounds (or stand down after).
export function setAlarm(w, on) {
  if (w.alarm === on) return;
  w.alarm = on;
  for (const p of colonists(w)) {
    const j = p.job;
    if (!j || j.kind === 'combat' || j.kind === 'mental') continue;
    if (on ? j.kind !== 'need' || j.def === 'sleep' : j.def === 'shelter') p.interrupt = true;
  }
}

// ---- Mental states & looters ----------------------------------------------

function mentalThink(w, p) {
  switch (p.mental.key) {
    case 'sadWander': return wanderJob(w, p, { report: 'wandering sadly', kind: 'mental', radius: 12, ticks: [300, 900] });
    case 'daze': return wanderJob(w, p, { report: 'dazed', kind: 'mental', radius: 3, ticks: [800, 1600] });
    case 'foodBinge': { const f = findFood(w, p); return f ? eatJob(w, p, f, true) : wanderJob(w, p, { report: 'looking for food to binge', kind: 'mental' }); }
    case 'tantrum': return tantrumJob(w, p);
    case 'catatonic': return wanderJob(w, p, { report: 'catatonic', kind: 'mental', radius: 0, ticks: [2500, 2500] });
    case 'giveUp': return leaveMapJob(w, p, 'giving up and walking away', (w, p) => {
      letter(w, `${p.name} walked out into the wasteland and didn't come back.`, 'bad');
      for (const c of colonists(w)) addMemory(c, 'colonistLeft');
    });
  }
}

function looterThink(w, p) {
  if (w.tick < p.leaveAt) {
    const j = stealJob(w, p);
    if (j) return j;
  }
  return leaveMapJob(w, p, 'leaving');
}
