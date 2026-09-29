// Pawn creation (survivors, zombies, looters), needs, and skills.

import { TICKS_PER_DAY, TICKS_PER_HOUR, SURVIVOR, ZOMBIE } from './config.js';
import { SKILLS, WORK_TYPES, TRAITS, TRAIT_CLASHES } from './defs.js';

// Need thresholds (see docs/RESEARCH.md).
export const FOOD_HUNGRY = 0.3;
export const FOOD_URGENT = 0.15;
export const REST_DROWSY = 0.28; // (RW)
export const REST_TIRED = 0.14; // (RW)
export const REST_EXHAUSTED = 0.01; // (RW)
export const JOY_LOW = 0.3;

const FOOD_FALL = 1.6 / TICKS_PER_DAY; // (RW) nutrition per tick
const JOY_FALL = 0.6 / TICKS_PER_DAY;
export const REST_GAIN = 1 / (10.5 * TICKS_PER_HOUR); // (RW) 0→100% in 10.5h at effectiveness 1
export const JOY_GAIN = 0.00025;

// (RW) rest falls slower as you get more tired, except when fully exhausted.
const restFall = (r) =>
  (r >= REST_DROWSY ? 0.95 : r >= REST_TIRED ? 0.66 : r >= REST_EXHAUSTED ? 0.28 : 0.57) / TICKS_PER_DAY;

const NAMES = ['Ada', 'Bram', 'Cora', 'Dex', 'Esme', 'Finn', 'Greta', 'Hale', 'Iris', 'Jory', 'Kit', 'Lena',
  'Milo', 'Nadia', 'Otto', 'Pia', 'Quill', 'Rosa', 'Sven', 'Tova', 'Ugo', 'Vera', 'Wren', 'Yara', 'Zeke',
  'Abe', 'Bea', 'Cal', 'Dot', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'June', 'Knox', 'Lou', 'Mae', 'Ned'];
// Clothing colors: warm and saturated so survivors pop against grass and zombies.
const CLOTHES = ['#d9824b', '#4f8fd6', '#d4b341', '#c4577f', '#57b08a', '#8a6fd1', '#e0664f', '#3fa7b8'];
const SKIN = ['#f1d0b0', '#e2b48c', '#c68e63', '#9c6a44', '#6e4a30'];
const HAIR = ['#2b2118', '#5a3a22', '#a8743c', '#d8b36a', '#8c8c8c', '#1a1a1a', '#7a2e1c'];
const ZOMBIE_SKIN = ['#9fae8e', '#8fa38b', '#a8a992', '#95a592'];
const ZOMBIE_CLOTHES = ['#5b6152', '#4e5a63', '#6a5a4c', '#5d4e58', '#4f5946'];

// Default day: sleep 22:00–06:00, anything otherwise. Values: 'sleep' | 'work' | 'joy' | 'any'.
const defaultSchedule = () => Array.from({ length: 24 }, (_, h) => (h >= 22 || h < 6 ? 'sleep' : 'any'));

export function makeColonist(w, x, y) {
  const { rng } = w;
  const used = new Set(w.pawns.map((p) => p.name));
  const name = rng.pick(NAMES.filter((n) => !used.has(n))) ?? `Survivor ${w.pawns.length + 1}`;

  const skills = {};
  for (const s of SKILLS) skills[s] = { level: rng.int(0, 8), xp: 0, xpToday: 0, passion: rng.pick([0, 0, 0, 1, 1, 2]) };

  const incapable = new Set();
  if (rng.chance(0.25)) incapable.add(rng.pick(WORK_TYPES.filter((t) => t.key !== 'hauling')).key);

  const priorities = {};
  for (const t of WORK_TYPES) priorities[t.key] = incapable.has(t.key) ? 0 : 3;

  const traitKeys = Object.keys(TRAITS);
  const traits = [];
  const count = rng.int(1, 2);
  while (traits.length < count) {
    const t = rng.pick(traitKeys);
    const clash = TRAIT_CLASHES.some((pair) => pair.includes(t) && pair.some((o) => o !== t && traits.includes(o)));
    if (!traits.includes(t) && !clash) traits.push(t);
  }
  const gentle = traits.some((t) => TRAITS[t].noViolence);

  return {
    id: w.nextId++,
    name,
    faction: 'colony',
    look: { clothes: rng.pick(CLOTHES), skin: rng.pick(SKIN), hair: rng.pick(HAIR) },
    x, y,
    facing: rng.range(0, Math.PI * 2),
    move: null,
    job: null,
    carrying: null,
    cooldown: 0,
    attackCd: 0,
    hp: SURVIVOR.hp,
    maxHp: SURVIVOR.hp,
    downed: false,
    bleed: 0, // HP lost per day until tended
    infection: null, // { severity, immunity } 0..1 each — whichever reaches 1 first wins
    tendedUntil: 0, // tick; while tended, wounds heal faster and infection slows
    tendQuality: 0,
    inBed: null, // bed thing id while lying in one (sleep, treatment, rescued)
    weapon: null, // { def } of an equipped weapon item; null = improvised club
    ammo: 0,
    response: gentle ? 'flee' : 'fight',
    needs: { food: rng.range(0.6, 0.9), rest: rng.range(0.6, 0.95), joy: rng.range(0.5, 0.8) },
    mood: 60,
    moodTarget: 60,
    thoughts: [], // memories: { key, ticksLeft }
    mental: null, // { key, label, ticksLeft }
    skills,
    priorities,
    incapable,
    traits,
    schedule: defaultSchedule(),
    bedId: null,
    asleep: false,
  };
}

export function makeZombie(w, x, y, props = {}) {
  const { rng } = w;
  return {
    id: w.nextId++,
    name: props.turnedFrom ? `${props.turnedFrom} (turned)` : 'Zombie',
    faction: 'zombie',
    look: { clothes: props.clothes ?? rng.pick(ZOMBIE_CLOTHES), skin: rng.pick(ZOMBIE_SKIN), hair: rng.pick(HAIR) },
    x, y,
    facing: rng.range(0, Math.PI * 2),
    move: null,
    hp: ZOMBIE.hp,
    maxHp: ZOMBIE.hp,
    speed: rng.range(...ZOMBIE.speed),
    state: 'wander', // wander | investigate | hunt
    goal: null,
    path: null,
    lastSeen: 0,
    attackCd: rng.int(0, ZOMBIE.cooldown),
    idle: rng.int(0, 200),
    jitter: [rng.range(-0.22, 0.22), rng.range(-0.22, 0.22)], // so crowds don't stack perfectly
    ...props,
  };
}

export function makeLooter(w, x, y, leaveAt) {
  return { id: w.nextId++, name: 'Looter', faction: 'looter', look: { clothes: '#3b3b44', skin: w.rng.pick(SKIN), hair: '#1a1a1a' },
    x, y, facing: 0, move: null, job: null, carrying: null, cooldown: 0, leaveAt, hp: 80, maxHp: 80, skills: {}, traits: [] };
}

export function tickNeeds(p, dt) {
  const n = p.needs;
  n.food = Math.max(0, n.food - FOOD_FALL * dt);
  if (!p.asleep) n.rest = Math.max(0, n.rest - restFall(n.rest) * dt);
  if (p.job?.kind !== 'joy') n.joy = Math.max(0, n.joy - JOY_FALL * dt);
}

// ---- Skills ---------------------------------------------------------------

// (RW) ~1,000 XP for level 0→1 rising to ~32,000 for 19→20.
export const xpToNext = (level) => 1000 + Math.round(level * level * 85);
const PASSION_MULT = [0.35, 1, 1.5]; // (RW)
const DAILY_SOFT_CAP = 4000; // (RW)

export function learn(p, skill, xp) {
  const s = p.skills[skill];
  if (!s) return;
  const gained = xp * PASSION_MULT[s.passion] * (s.xpToday > DAILY_SOFT_CAP ? 0.2 : 1);
  s.xp += gained;
  s.xpToday += gained;
  while (s.level < 20 && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
  }
}

export function workSpeed(p, skill) {
  let speed = skill && p.skills[skill] ? 0.5 + 0.1 * p.skills[skill].level : 1;
  for (const t of p.traits) speed *= TRAITS[t].workSpeed ?? 1;
  // Hurt people work slower.
  if (p.maxHp) speed *= 0.5 + 0.5 * Math.min(1, p.hp / p.maxHp);
  return speed;
}

export const traitMult = (p, field) => p.traits.reduce((m, t) => m * (TRAITS[t][field] ?? 1), 1);
export const isGentle = (p) => p.traits.some((t) => TRAITS[t].noViolence);
export const canFight = (p) => p.response === 'fight' && !isGentle(p);
