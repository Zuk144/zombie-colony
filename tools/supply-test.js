// Headless acceptance test for the Supply Line slice (docs/studio/briefs/2026-09-29-supply-line-slice.md §10).
// Run in the dev page console:
//   const T = await import('/tools/supply-test.js');
//   T.compare([11, 12, 13], { count: 12 })        // A (all Fight) vs B (one survivor on Supply)
//   T.run(11, true, { count: 25, blade: 1 })        // one run; blade = survivors given a machete
// A fenced yard (x 54–76, y 42–62, gate at 65,62), a generator, two turrets with a 24-round
// magazine, 150 rounds in the yard, then a horde of `count` hunters from the east.

import * as S from '/src/sim.js';
import * as W from '/src/world.js';
import { TICKS_PER_DAY } from '/src/config.js';
import { makeZombie } from '/src/pawn.js';

const H = TICKS_PER_DAY / 24;

export function run(seed, supply, opts = {}) {
  const w = S.newGame(seed);
  const clear = (x, y) => { for (const t of [...W.thingsAt(w, x, y)]) W.despawn(w, t); };
  for (let x = 54; x <= 76; x++) for (let y = 42; y <= 62; y++) {
    if (x !== 54 && x !== 76 && y !== 42 && y !== 62) continue;
    clear(x, y);
    W.spawn(w, x === 65 && y === 62 ? 'gate' : 'fence', x, y);
  }
  const put = (def, x, y, props = {}) => {
    const [sw, sh] = W.defOf({ def }).size ?? [1, 1];
    for (let i = 0; i < sw; i++) for (let j = 0; j < sh; j++) clear(x + i, y + j);
    return W.spawn(w, def, x, y, props);
  };
  put('generator', 58, 49, { fuel: 60 });
  put('powerPole', 62, 50);
  put('powerPole', 68, 50);
  const turrets = opts.noTurrets ? [] : [put('autoTurret', 74, 48, { ammo: 24 }), put('autoTurret', 74, 52, { ammo: 24 })];
  clear(71, 50);
  W.spawnItem(w, 'ammo', 150, 71, 50);
  const cs = W.colonists(w);
  cs.forEach((p, i) => { p.x = 65 + (i % 2); p.y = 52 + (i >> 1); p.job = null; p.move = null; });
  if (supply) cs[0].response = 'supply';
  for (const p of cs.slice(supply ? 1 : 0, (supply ? 1 : 0) + (opts.blade ?? 0))) { p.weapon = { def: 'machete' }; p.ammo = 0; p.response = 'fight'; }
  w.fieldDirty = true;
  S.tickWorld(w);
  w.secureDirty = true;
  for (let i = 0; i < H; i++) S.tickWorld(w); // an hour to settle

  const outsideAtArrival = cs.filter((p) => !p.gone && !W.inYard(w, p)).length;
  const count = opts.count ?? 25;
  const spawnZombie = (k) => w.pawns.push(makeZombie(w, opts.fromX ?? 127, 42 + (k % 12), { state: 'hunt', horde: true }));
  if (!opts.trickle) for (let k = 0; k < count; k++) spawnZombie(k);
  w.story.hordeActive = true;
  w.story.hordeId = (w.story.hordeId ?? 0) + 1;
  w.fieldDirty = true;

  const last = turrets.map((t) => t.ammo), runner = supply ? cs[0] : null, hp0 = runner?.hp;
  const fences0 = W.allThings(w, (t, d) => d.fence).length, killed0 = w.stats.zombiesKilled;
  let refills = 0, fired = 0, dry = 0, runnerHurt = false, hackSwings = 0, breachAt = null;
  for (let i = 0; i < (opts.hours ?? 24) * H; i++) {
    if (opts.trickle && i % H === 0 && i / H < count) spawnZombie(i / H);
    S.tickWorld(w);
    if (breachAt == null && w.secureCount === 0) breachAt = +(i / H).toFixed(1);
    const hunting = w.pawns.some((z) => z.faction === 'zombie' && z.state === 'hunt');
    turrets.forEach((t, k) => {
      if (!W.isSpawned(w, t)) return;
      if (t.ammo > last[k] && hunting) refills++;
      if (t.ammo < last[k]) fired += last[k] - t.ammo;
      if (t.ammo <= 0 && hunting) dry++;
      last[k] = t.ammo;
    });
    for (const p of cs) if (p.job?.def === 'hack' && p.lunge === w.tick) hackSwings++;
    if (runner && !runner.gone && runner.hp < hp0) runnerHurt = true;
  }
  return {
    seed, supply, refills, fired, dryHours: +(dry / H).toFixed(2),
    alive: cs.filter((p) => !p.gone).length, runnerAlive: runner ? !runner.gone : null, runnerHurt,
    outsideAtArrival, breachAt, fenceLost: fences0 - W.allThings(w, (t, d) => d.fence).length,
    killed: w.stats.zombiesKilled - killed0, hackSwings,
  };
}

export function compare(seeds, opts = {}) {
  return seeds.flatMap((s) => [run(s, false, opts), run(s, true, opts)]).map((r) =>
    `seed ${r.seed} ${r.supply ? 'B runner' : 'A none  '} refills=${r.refills} fired=${r.fired} dry=${r.dryHours}h alive=${r.alive}/3`
    + ` runner=${r.runnerAlive ?? '-'} breach=${r.breachAt ?? 'never'} fenceLost=${r.fenceLost} killed=${r.killed} hack=${r.hackSwings}`);
}
