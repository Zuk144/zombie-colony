// Tuning knobs. (RW) marks RimWorld's own values — see docs/RESEARCH.md.

export const TICKS_PER_SECOND = 60; // (RW) at 1x
export const TICKS_PER_HOUR = 2500; // (RW)
export const TICKS_PER_DAY = 60000; // (RW)
export const DAYS_PER_SEASON = 15; // (RW) a "quadrum"
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const SPEEDS = [0, 1, 3, 6]; // (RW) pause, 1x, 3x, 6x
export const START_HOUR = 7;

export const RARE_TICK = 250; // needs, mood, break rolls and job interrupts run this often
export const STORY_INTERVAL = 1000; // Director + wealth recount
export const THREAT_SCAN = 20; // survivors look around for zombies this often
export const FIELD_INTERVAL = 45; // zombie flow field rebuild

export const MAP_W = 128;
export const MAP_H = 96;
export const TILE = 16; // world units per cell
export const CHUNK = 16; // cells per terrain-art chunk

export const MOVE_CELLS_PER_TICK = 4.6 / TICKS_PER_SECOND; // (RW) human move speed 4.6 cells/s
export const CARRY_CAPACITY = 75;
export const BASE_MOOD = 32; // (RW) ~Strive to Survive; expectations lift a new colony well above this

export const SURVIVOR = {
  hp: 100,
  downedBelow: 15,
  sight: 12,
  meleeCooldown: 80,
  meleeDamage: [12, 18],
  healPerDay: 25, // awake; asleep heals 3x
  fleeBelow: 0.35, // fighters flee under this fraction of max hp
};

export const ZOMBIE = {
  hp: 45,
  speed: [0.42, 0.58], // fraction of human speed
  sight: 11,
  smell: 2, // notice survivors this close even without line of sight
  cooldown: 120,
  hitChance: 0.45,
  damage: [4, 8],
  buildingDamage: [8, 14],
  biteChance: 0.02, // per damaging hit → infection
  loseInterestTicks: 1800,
  bashCostPerHp: 1 / 12, // flow-field cost of pushing through a wall/door
};

// Medical. Bleeding is HP lost per day; tending stops it and boosts healing.
export const MEDICAL = {
  bleedPerDamage: 0.9, // each point of damage adds this much HP/day of bleeding
  bleedDecayPerDay: 0.5, // untended scratches clot on their own; deep wounds don't in time
  tendNeededBleed: 4, // HP/day; lighter scratches clot on their own
  tendDuration: 0.5, // days a tend lasts (infections need re-tending twice a day)
  tendWork: 300,
  bedHealMult: 2,
};

// Infection vs immunity race (RW disease model; see docs/DESIGN.md §6). Per day, 0..1.
export const INFECTION = {
  severityPerDay: 0.6, // untreated: dead in ~1.7 days
  immunityPerDay: 0.45,
  bedImmunityMult: 1.3,
  tendSlows: 0.6, // tended severity gain × (1 − tendSlows × quality)
  tendImmunityBoost: 0.5, // tended immunity gain × (1 + boost × quality)
};
// Climate (temperate). Outdoor °C = mean + season sine + day/night sine + weather.
export const CLIMATE = {
  mean: 11,
  seasonAmp: 15, // summer afternoons up to ~32°C, winter nights down to ~−10°C
  dayAmp: 6, // afternoons warmer, 3am coldest
  phaseDays: 3, // shifts the year so day 1 starts in a mild early spring
  leakRoofed: 0.15, // per hour: how fast a roofed room drifts toward outdoor temperature
  leakOpen: 1.2, // a room under 75% roofed is basically outdoors (RW)
};
// Survivors wear ordinary clothes, so a little wider than RW's naked 16–26°C.
export const COMFORT = { min: 8, max: 28 };
// (RW) exposure severity per 60 ticks, once 10°C past the comfortable range.
export const EXPOSURE = { onset: 10, base: 0.00075, perDegree: 0.0000645, recoverMin: 0.0015, recoverMax: 0.015, recoverMul: 0.027 };
export const ROOMS = { maxCells: 400, maxAutoRoof: 160, supportRange: 6, enclosedRoofed: 0.75, roofWork: 65 }; // (RW) 6-tile support, 75% roofed, 65 ticks

export const REANIMATE_DAYS = [0.08, 0.2]; // the dead rise again after this long
export const ZOMBIE_CORPSE_ROT_DAYS = 2.5;
export const MAX_ZOMBIES = 160;
