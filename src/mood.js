// Thoughts → mood → mental breaks. See docs/RESEARCH.md "Mood and mental breaks".

import { BASE_MOOD, TICKS_PER_DAY, TICKS_PER_HOUR } from './config.js';
import { TRAITS } from './defs.js';
import { mtbChance } from './rng.js';
import { letter, allThings, dist } from './world.js';
import { FOOD_HUNGRY, FOOD_URGENT, REST_DROWSY, REST_TIRED, REST_EXHAUSTED, JOY_LOW } from './pawn.js';

// Memories have `days` (duration) and `stack` (max copies); situational thoughts have neither.
export const THOUGHTS = {
  hungry: { label: 'Hungry', mood: -6 },
  ravenous: { label: 'Ravenously hungry', mood: -12 },
  starving: { label: 'Starving', mood: -20 },
  drowsy: { label: 'Drowsy', mood: -6 },
  tired: { label: 'Tired', mood: -12 },
  exhausted: { label: 'Exhausted', mood: -18 },
  bored: { label: 'Needs recreation', mood: -5 },
  joyStarved: { label: 'Recreation-starved', mood: -15 },
  joyFull: { label: 'Recreation satisfied', mood: 5 },
  optimist: { label: 'Optimist', mood: 6 },
  pessimist: { label: 'Pessimist', mood: -6 },
  expect0: { label: 'Extremely low expectations', mood: 30 },
  expect1: { label: 'Very low expectations', mood: 24 },
  expect2: { label: 'Low expectations', mood: 18 },
  expect3: { label: 'Moderate expectations', mood: 12 },
  expect4: { label: 'High expectations', mood: 6 },
  infected: { label: "I've been bitten", mood: -20 },
  inPain: { label: 'In pain', mood: -8 },
  corpsesNear: { label: 'Bodies lying around', mood: -4 },

  ateRawFood: { label: 'Ate raw food', mood: -7, days: 1, stack: 1 },
  ateWithoutTable: { label: 'Ate without table', mood: -3, days: 1, stack: 1 },
  sleptOnGround: { label: 'Slept on the ground', mood: -4, days: 1, stack: 1 },
  catharsis: { label: 'Catharsis', mood: 40, days: 3, stack: 5 }, // (RW)
  screams: { label: 'Heard distant screams', mood: -10, days: 1.5, stack: 1 },
  starryNight: { label: 'A quiet, starry night', mood: 8, days: 0.5, stack: 1 },
  robbed: { label: 'We were robbed', mood: -5, days: 3, stack: 3 },
  colonistLeft: { label: 'Someone gave up on us', mood: -6, days: 4, stack: 3 },
  colonistDied: { label: 'A survivor died', mood: -8, days: 6, stack: 5 },
  sawTurn: { label: 'Watched a friend turn', mood: -12, days: 5, stack: 3 },
  survivedAttack: { label: 'We held them off', mood: 4, days: 1, stack: 1 },
  beatInfection: { label: 'Beat the infection', mood: 12, days: 4, stack: 1 },
  wasRescued: { label: 'Someone came back for me', mood: 6, days: 3, stack: 1 },
};

const STACK_MULT = 0.75; // (RW) each extra copy of a memory counts 75% of the previous

// Wealth → expectations. As the colony gets richer, this bonus shrinks (RW mechanic, our cutoffs).
const EXPECTATIONS = [[15000, 'expect0'], [40000, 'expect1'], [90000, 'expect2'], [175000, 'expect3'], [320000, 'expect4']];

export const MENTAL_BREAKS = [
  { key: 'sadWander', tier: 'minor', label: 'Sad wandering', days: [0.3, 0.5] },
  { key: 'foodBinge', tier: 'minor', label: 'Food binge', days: [0.2, 0.4] },
  { key: 'daze', tier: 'major', label: 'Dazed', days: [0.5, 1] },
  { key: 'tantrum', tier: 'major', label: 'Tantrum', days: [0.2, 0.4] },
  { key: 'catatonic', tier: 'extreme', label: 'Catatonic breakdown', days: [1, 1.5] },
  { key: 'giveUp', tier: 'extreme', label: 'Giving up and leaving', days: [1, 1] },
];
const BREAK_MTB_DAYS = { minor: 4, major: 0.8, extreme: 0.5 }; // (RW)

const ignores = (p, key) => p.traits.some((t) => TRAITS[t].ignores?.includes(key));

export function addMemory(p, key) {
  const def = THOUGHTS[key];
  if (!p.thoughts || ignores(p, key)) return;
  const same = p.thoughts.filter((t) => t.key === key);
  if (same.length >= def.stack) same[0].ticksLeft = def.days * TICKS_PER_DAY;
  else p.thoughts.push({ key, ticksLeft: def.days * TICKS_PER_DAY });
}

function situational(p, w) {
  const out = [];
  const { food, rest, joy } = p.needs;
  if (food <= 0) out.push('starving');
  else if (food < FOOD_URGENT) out.push('ravenous');
  else if (food < FOOD_HUNGRY) out.push('hungry');
  if (rest < REST_EXHAUSTED) out.push('exhausted');
  else if (rest < REST_TIRED) out.push('tired');
  else if (rest < REST_DROWSY) out.push('drowsy');
  if (joy < 0.05) out.push('joyStarved');
  else if (joy < JOY_LOW) out.push('bored');
  else if (joy > 0.9) out.push('joyFull');
  if (p.infection != null) out.push('infected');
  if (p.hp < p.maxHp * 0.5) out.push('inPain');
  if (allThings(w, (t, d) => d.corpse && dist(p, t) <= 6).length) out.push('corpsesNear');
  const exp = EXPECTATIONS.find(([cap]) => w.wealth < cap);
  if (exp) out.push(exp[1]);
  for (const t of p.traits) if (TRAITS[t].thought) out.push(TRAITS[t].thought);
  return out.filter((k) => !ignores(p, k));
}

// [{ label, mood, count }] — used for both the mood math and the inspector.
export function moodBreakdown(p, w) {
  const rows = situational(p, w).map((k) => ({ label: THOUGHTS[k].label, mood: THOUGHTS[k].mood, count: 1 }));
  const groups = new Map();
  for (const t of p.thoughts) groups.set(t.key, (groups.get(t.key) ?? 0) + 1);
  for (const [key, count] of groups) {
    let mood = 0;
    for (let i = 0; i < count; i++) mood += THOUGHTS[key].mood * STACK_MULT ** i;
    rows.push({ label: THOUGHTS[key].label, mood: Math.round(mood), count });
  }
  return rows.sort((a, b) => a.mood - b.mood);
}

export function breakThresholds(p) {
  const offset = p.traits.reduce((s, t) => s + (TRAITS[t].breakOffset ?? 0), 0);
  const minor = Math.min(50, Math.max(1, 35 + offset));
  return { minor, major: (minor * 4) / 7, extreme: minor / 7 }; // (RW)
}

export function tickMood(p, w, dt) {
  for (const t of p.thoughts) t.ticksLeft -= dt;
  p.thoughts = p.thoughts.filter((t) => t.ticksLeft > 0);

  const target = BASE_MOOD + moodBreakdown(p, w).reduce((s, r) => s + r.mood, 0);
  p.moodTarget = Math.max(0, Math.min(100, target));
  const hours = dt / TICKS_PER_HOUR;
  // (RW) mood drifts toward the target: +12/h up, -8/h down
  p.mood = p.mood < p.moodTarget ? Math.min(p.moodTarget, p.mood + 12 * hours) : Math.max(p.moodTarget, p.mood - 8 * hours);

  if (p.mental) {
    p.mental.ticksLeft -= dt;
    if (p.mental.ticksLeft <= 0) endMentalBreak(p, w);
  } else rollMentalBreak(p, w, dt);
}

function rollMentalBreak(p, w, dt) {
  const th = breakThresholds(p);
  const tier = p.mood < th.extreme ? 'extreme' : p.mood < th.major ? 'major' : p.mood < th.minor ? 'minor' : null;
  if (!tier || !w.rng.chance(mtbChance(BREAK_MTB_DAYS[tier] * TICKS_PER_DAY, dt))) return;
  const b = w.rng.pick(MENTAL_BREAKS.filter((m) => m.tier === tier));
  p.mental = { key: b.key, label: b.label, tier, ticksLeft: w.rng.range(...b.days) * TICKS_PER_DAY };
  p.interrupt = true;
  letter(w, `${p.name} is having a ${tier} mental break: ${b.label.toLowerCase()}.`, 'bad');
}

export function endMentalBreak(p, w) {
  if (!p.mental) return;
  p.mental = null;
  p.interrupt = true;
  addMemory(p, 'catharsis');
  letter(w, `${p.name} has recovered from their mental break.`, 'good');
}
