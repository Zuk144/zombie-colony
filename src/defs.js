// Data-driven definitions ("Defs", like RimWorld's XML). Adding content should mostly mean
// adding an entry here; systems read these fields rather than special-casing keys.

// `blob`: drawn as a soft marching-squares region (natural). Otherwise crisp cell rects (man-made).
export const TERRAIN = [
  { key: 'soil', label: 'Grass', color: '#71904f', fertility: 1, cost: 1 },
  { key: 'richSoil', label: 'Rich soil', color: '#5d7f42', fertility: 1.4, cost: 1, blob: true },
  { key: 'sand', label: 'Sand', color: '#cfbd8f', fertility: 0.1, cost: 1.4, blob: true },
  { key: 'gravel', label: 'Gravel', color: '#9c9786', fertility: 0.7, cost: 1, blob: true },
  { key: 'water', label: 'Shallow water', color: '#4d86a8', fertility: 0, cost: 3, noZone: true, blob: true },
  { key: 'asphalt', label: 'Road', color: '#4b4f55', fertility: 0, cost: 0.8 },
  { key: 'concrete', label: 'Concrete floor', color: '#a9a69c', fertility: 0, cost: 0.9 },
];
export const TERRAIN_INDEX = Object.fromEntries(TERRAIN.map((t, i) => [t.key, i]));

// kind: item | plant | building | blueprint
// Buildings: `hp` makes them bashable by zombies; `blocks` stops survivors and zombies;
// `seeThrough` lets sight and bullets pass anyway (barricades); `door` lets survivors through
// but not zombies; `size` = [w, h] footprint (default 1x1).
// Weapons (stack-1 items): `weapon.rank` orders what survivors prefer; ranged ones need ammo.
export const THINGS = {
  // Items
  wood: { kind: 'item', label: 'Wood', color: '#b07a45', stack: 75, value: 1.2 },
  stone: { kind: 'item', label: 'Stone blocks', color: '#b5b2aa', stack: 75, value: 0.9 },
  scrap: { kind: 'item', label: 'Scrap metal', color: '#8b98a6', stack: 50, value: 2.5 },
  // rotDays (RW): days until spoiled at 10°C or warmer; slower when cool, frozen below 0°C.
  berries: { kind: 'item', label: 'Berries', color: '#c0405e', stack: 75, value: 1.5, nutrition: 0.05, foodPref: 40, rotDays: 14, tags: ['rawFood'] },
  rice: { kind: 'item', label: 'Rice', color: '#e8e0c0', stack: 75, value: 1.1, nutrition: 0.05, foodPref: 40, rotDays: 40, tags: ['rawFood'] },
  cannedFood: { kind: 'item', label: 'Canned food', color: '#c9523a', stack: 20, value: 6, nutrition: 0.35, foodPref: 12, tags: ['preserved'] },
  meal: { kind: 'item', label: 'Simple meal', color: '#e6b24c', stack: 10, value: 15, nutrition: 0.9, foodPref: 0, rotDays: 4, tags: ['meal'] },
  medkit: { kind: 'item', label: 'Medical kit', color: '#e9e7e2', stack: 10, value: 30, medicine: 1 },
  herbs: { kind: 'item', label: 'Herbal medicine', color: '#7fb069', stack: 20, value: 10, medicine: 0.6 },
  ammo: { kind: 'item', label: 'Ammo', color: '#d6ad45', stack: 100, value: 1.5 },
  components: { kind: 'item', label: 'Components', color: '#5fb3a1', stack: 20, value: 14 },
  biofuel: { kind: 'item', label: 'Biofuel', color: '#8fae3a', stack: 50, value: 2 },
  machete: { kind: 'item', label: 'Machete', color: '#b9c2c9', stack: 1, value: 35, weapon: { melee: true, damage: [17, 25], cooldown: 75, rank: 2 } },
  pistol: { kind: 'item', label: 'Pistol', color: '#3a3d42', stack: 1, value: 120, weapon: { ranged: true, damage: [20, 28], cooldown: 65, range: 11, accuracy: 0.72, noise: 22, rank: 3 } },
  rifle: { kind: 'item', label: 'Hunting rifle', color: '#6b4a2e', stack: 1, value: 220, weapon: { ranged: true, damage: [32, 44], cooldown: 120, range: 19, accuracy: 0.84, noise: 32, rank: 4 } },
  corpse: { kind: 'item', label: 'Corpse', color: '#6b6f5e', stack: 1, value: 0, corpse: true },

  // Plants. growth 0..1; grows at fertility / growDays per day.
  tree: { kind: 'plant', label: 'Tree', growDays: 15, woody: true, harvestWork: 500, yield: { def: 'wood', count: 25 } },
  berryBush: { kind: 'plant', label: 'Berry bush', growDays: 4, harvestWork: 200, regrowTo: 0.3, yield: { def: 'berries', count: 10 } },
  riceCrop: { kind: 'plant', label: 'Rice plant', growDays: 3, sowable: true, sowWork: 100, harvestWork: 150, yield: { def: 'rice', count: 6 } },
  herbPlant: { kind: 'plant', label: 'Medicinal herbs', growDays: 5, sowable: true, sowWork: 140, harvestWork: 200, yield: { def: 'herbs', count: 1 } },

  // Natural / pre-apocalypse structures
  rock: { kind: 'building', label: 'Rock', natural: true, blocks: true, mineWork: 900, yield: { def: 'stone', count: 10 } },
  ruinWall: { kind: 'building', label: 'Ruined wall', ruin: true, wallLike: true, blocks: true, hp: 250, salvage: { work: 400, yield: [['stone', 4], ['scrap', 1]] } },
  car: { kind: 'building', label: 'Wrecked car', ruin: true, blocks: true, hp: 600, size: [2, 1], salvage: { work: 900, yield: [['scrap', 25], ['components', 2]] } },

  // Player buildings. `work` is ticks at work speed 1.0.
  wall: { kind: 'building', label: 'Wood wall', wallLike: true, blocks: true, hp: 300, cost: { wood: 5 }, work: 135 },
  stoneWall: { kind: 'building', label: 'Stone wall', wallLike: true, blocks: true, hp: 700, cost: { stone: 5 }, work: 300 },
  scrapWall: { kind: 'building', label: 'Scrap wall', wallLike: true, blocks: true, hp: 500, cost: { scrap: 4 }, work: 220 },
  barricade: { kind: 'building', label: 'Barricade', wallLike: true, seeThrough: true, reachThrough: true, blocks: true, hp: 260, cost: { wood: 10 }, work: 200 },
  door: { kind: 'building', label: 'Door', door: true, hp: 260, cost: { wood: 25 }, work: 500 },
  spikeTrap: { kind: 'building', label: 'Spike trap', trap: { damage: [35, 55] }, hp: 60, cost: { wood: 15 }, work: 250, rearmWork: 150 },
  guardPost: { kind: 'building', label: 'Watchtower', guardPost: true, sightBonus: 7, rangeBonus: 3, hp: 200, cost: { wood: 35 }, work: 700 },
  bed: { kind: 'building', label: 'Bed', bed: true, restEffect: 1, hp: 120, cost: { wood: 45 }, work: 800 },
  table: { kind: 'building', label: 'Table', table: true, size: [2, 1], rotatable: true, hp: 120, cost: { wood: 30 }, work: 400 },
  // Fuel: burns `perDay` wood while active; haulers (or the cook) refill it. heat: °C·cells per hour
  // added to the room until `heatTarget` (a thermostat).
  campfire: { kind: 'building', label: 'Campfire', bench: true, light: 7, recipes: ['simpleMeal'], fuel: { capacity: 25, perDay: 10 }, heat: 40, heatTarget: 28, hp: 80, cost: { wood: 20 }, work: 300 },
  woodStove: { kind: 'building', label: 'Wood stove', light: 3, fuel: { capacity: 40, perDay: 16 }, heat: 90, heatTarget: 21, idleWhenWarm: true, hp: 160, cost: { wood: 10, scrap: 20 }, work: 700 },
  workbench: { kind: 'building', label: 'Workbench', bench: true, recipes: ['ammo', 'machete', 'pistol', 'rifle'], hp: 150, cost: { wood: 40, scrap: 10 }, work: 900 },
  burnPit: { kind: 'building', label: 'Burn pit', bench: true, light: 4, recipes: ['burnCorpses'], hp: 120, cost: { wood: 25 }, work: 300 },
  torch: { kind: 'building', label: 'Torch', light: 5, hp: 40, cost: { wood: 4 }, work: 80 },

  // ---- Phase 3 "The Hum" ----
  // Fences: see-through, stop zombies; a lone attacker barely dents one (FENCE.loneFactor).
  fence: { kind: 'building', label: 'Chain-link fence', wallLike: true, fence: true, seeThrough: true, reachThrough: true, blocks: true, hp: 200, cost: { scrap: 2 }, work: 90 },
  electricFence: { kind: 'building', label: 'Electric fence', wallLike: true, fence: true, seeThrough: true, reachThrough: true, blocks: true, hp: 240, cost: { scrap: 3, components: 1 }, work: 160,
    power: { draw: 15 }, electric: { damage: [8, 14], stagger: 150 } },
  gate: { kind: 'building', label: 'Gate', door: true, gate: true, reachThrough: true, hp: 200, cost: { scrap: 6 }, work: 200 },
  // Machines. power.output / power.draw in W, power.storage in Wd; noise = Din pulse radius.
  powerPole: { kind: 'building', label: 'Power pole', pole: true, hp: 60, cost: { wood: 6, scrap: 2 }, work: 120 },
  generator: { kind: 'building', label: 'Fuel generator', machine: true, size: [2, 2], blocks: true, hp: 300, cost: { scrap: 40, components: 4 }, work: 1500,
    power: { output: 1000 }, fuel: { capacity: 60, perDay: 30, items: ['biofuel', 'wood'] }, noise: 18 },
  solarPanel: { kind: 'building', label: 'Solar panel', machine: true, size: [2, 2], blocks: true, hp: 150, cost: { scrap: 25, components: 6 }, work: 1200,
    power: { output: 400, solar: true } },
  battery: { kind: 'building', label: 'Battery', machine: true, size: [1, 2], rotatable: true, blocks: true, hp: 150, cost: { scrap: 20, components: 3 }, work: 800,
    power: { storage: 1500 } },
  floodlight: { kind: 'building', label: 'Floodlight', machine: true, nightOnly: true, light: 11, lure: 14, hp: 80, cost: { scrap: 10, components: 2 }, work: 400,
    power: { draw: 100 } },
  siren: { kind: 'building', label: 'Siren', machine: true, hp: 120, cost: { scrap: 15, components: 3 }, work: 500, power: { draw: 150 }, noise: 40 },
  autoTurret: { kind: 'building', label: 'Auto-turret', machine: true, blocks: true, hp: 220, cost: { scrap: 30, components: 5 }, work: 1400, power: { draw: 150 },
    ammoFeed: { capacity: 24, refillAt: 0.5 }, turret: { range: 13, damage: [18, 26], cooldown: 70, accuracy: 0.7, noise: 22 } },
  ammoPress: { kind: 'building', label: 'Ammo press', machine: true, bench: true, size: [2, 2], blocks: true, hp: 200, cost: { scrap: 35, components: 4 }, work: 1300,
    recipes: ['pressAmmo'], power: { draw: 300 }, noise: 9 },
  renderVat: { kind: 'building', label: 'Render vat', machine: true, bench: true, size: [2, 1], rotatable: true, blocks: true, hp: 180, cost: { scrap: 25, components: 2 }, work: 1000,
    recipes: ['renderCorpse'], power: { draw: 150 }, noise: 7 },

  blueprint: { kind: 'blueprint', label: 'Blueprint' },
};

// Bills at benches. `workType` decides who does them (Work tab column). An ingredient is
// { def } (exact item) or { tag } (any item carrying that tag). product: null destroys the input.
export const RECIPES = {
  // (RW) a simple meal takes 0.5 nutrition of raw food and gives 0.9, so cooking is worth it.
  simpleMeal: { label: 'Cook simple meal', workType: 'cooking', skill: 'cooking', ingredients: [{ tag: 'rawFood', count: 10 }], product: { def: 'meal', count: 1 }, work: 300, defaultBill: { mode: 'until', target: 10 } },
  ammo: { label: 'Press ammo', workType: 'crafting', skill: 'crafting', ingredients: [{ def: 'scrap', count: 5 }], product: { def: 'ammo', count: 15 }, work: 350 },
  machete: { label: 'Forge machete', workType: 'crafting', skill: 'crafting', ingredients: [{ def: 'scrap', count: 12 }], product: { def: 'machete', count: 1 }, work: 900 },
  pistol: { label: 'Build pistol', workType: 'crafting', skill: 'crafting', ingredients: [{ def: 'scrap', count: 35 }, { def: 'wood', count: 5 }], product: { def: 'pistol', count: 1 }, work: 2000 },
  rifle: { label: 'Build hunting rifle', workType: 'crafting', skill: 'crafting', ingredients: [{ def: 'scrap', count: 55 }, { def: 'wood', count: 15 }], product: { def: 'rifle', count: 1 }, work: 3000 },
  burnCorpses: { label: 'Burn corpses', workType: 'hauling', skill: null, ingredients: [{ def: 'corpse', count: 1 }], product: null, work: 180, defaultBill: { mode: 'forever', target: 1 } },
  // Machine recipes run on their own while powered; haulers only keep them stocked.
  pressAmmo: { label: 'Press ammo', workType: 'machine', skill: null, ingredients: [{ def: 'scrap', count: 5 }], product: { def: 'ammo', count: 15 }, work: 600, defaultBill: { mode: 'until', target: 120 } },
  renderCorpse: { label: 'Render corpses into biofuel', workType: 'machine', skill: null, ingredients: [{ def: 'corpse', count: 1 }], product: { def: 'biofuel', count: 8 }, work: 900, defaultBill: { mode: 'forever', target: 1 } },
};
export const ingKey = (ing) => ing.def ?? ing.tag;
export const ingMatches = (ing, t) => (ing.def ? t.def === ing.def : !!THINGS[t.def].tags?.includes(ing.tag));

export const SKILLS = ['construction', 'mining', 'cooking', 'plants', 'crafting', 'medical', 'melee', 'shooting'];

// Column order matters: at equal priority the leftmost work type wins (RW).
export const WORK_TYPES = [
  { key: 'doctor', label: 'Doctor', skill: 'medical' },
  { key: 'cooking', label: 'Cook', skill: 'cooking' },
  { key: 'construction', label: 'Build', skill: 'construction' },
  { key: 'growing', label: 'Grow', skill: 'plants' },
  { key: 'mining', label: 'Mine', skill: 'mining' },
  { key: 'plantCutting', label: 'Cut', skill: 'plants' },
  { key: 'crafting', label: 'Craft', skill: 'crafting' },
  { key: 'hauling', label: 'Haul', skill: null },
];

// Hour-by-hour schedule slots (RW "restrict" tab, plus our Guard slot).
export const SCHEDULE_SLOTS = [
  { key: 'any', label: 'Anything', color: '#5b6573' },
  { key: 'work', label: 'Work', color: '#4f8f5a' },
  { key: 'sleep', label: 'Sleep', color: '#3b5b9a' },
  { key: 'joy', label: 'Recreation', color: '#9a5ba0' },
  { key: 'guard', label: 'Guard', color: '#b0563a' },
];

export const CROPS = ['riceCrop', 'herbPlant'];

// (RW) room impressiveness levels and the mood for sleeping in a bedroom / eating in a dining room of that level.
export const IMPRESSIVENESS = [
  { min: -Infinity, label: 'Awful', mood: -2 },
  { min: 20, label: 'Dull', mood: 0 },
  { min: 30, label: 'Mediocre', mood: 1 },
  { min: 40, label: 'Decent', mood: 2 },
  { min: 50, label: 'Slightly impressive', mood: 3 },
  { min: 65, label: 'Somewhat impressive', mood: 4 },
  { min: 85, label: 'Very impressive', mood: 5 },
  { min: 120, label: 'Extremely impressive', mood: 6 },
  { min: 170, label: 'Unbelievably impressive', mood: 7 },
  { min: 240, label: 'Wondrously impressive', mood: 8 },
];
export const ROOM_ROLES = { bedroom: 'Bedroom', barracks: 'Barracks', dining: 'Dining room', kitchen: 'Kitchen', workshop: 'Workshop', room: 'Room' };

export const TRAITS = {
  steadfast: { label: 'Steadfast', breakOffset: -9 },
  nervous: { label: 'Nervous', breakOffset: 8 },
  industrious: { label: 'Industrious', workSpeed: 1.35 },
  lazy: { label: 'Lazy', workSpeed: 0.8 },
  ascetic: { label: 'Ascetic', ignores: ['ateWithoutTable', 'sleptOnGround', 'ateRawFood'] },
  optimist: { label: 'Optimist', thought: 'optimist' },
  pessimist: { label: 'Pessimist', thought: 'pessimist' },
  gentle: { label: 'Gentle', noViolence: true },
  brawler: { label: 'Brawler', meleeDamage: 1.35 },
  tough: { label: 'Tough', damageTaken: 0.7 },
  deadeye: { label: 'Deadeye', accuracy: 1.2 },
};
export const TRAIT_CLASHES = [['optimist', 'pessimist'], ['industrious', 'lazy'], ['steadfast', 'nervous'], ['gentle', 'brawler'], ['gentle', 'deadeye']];

export const buildingValue = (def) =>
  Object.entries(def.cost ?? {}).reduce((v, [k, n]) => v + THINGS[k].value * n, 0);

// What deconstructing/salvaging a building gives back.
export function salvageYield(def) {
  if (def.salvage) return def.salvage.yield;
  return Object.entries(def.cost ?? {}).map(([k, n]) => [k, Math.floor(n / 2)]).filter(([, n]) => n > 0);
}
export const salvageWork = (def) => def.salvage?.work ?? Math.max(60, (def.work ?? 100) * 0.5);
export const canSalvage = (def) => def.kind === 'building' && !def.natural && (def.salvage || def.cost);
