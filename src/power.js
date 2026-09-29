// Power grids (docs/DESIGN.md §9). No wires to draw: a power pole connects every powered
// building within POWER.poleRange of it, and poles within POWER.poleLink of each other join
// the same grid. Grids are rebuilt only when something powered is built or destroyed.
//
// Every rare tick each grid balances: generators and solar supply watts, running machines draw
// them, and batteries (in watt-days, Wd) soak up the surplus or cover the shortfall. Not enough
// even with the batteries means a brownout: nothing on that grid runs until it recovers.

import { TICKS_PER_DAY, POWER } from './config.js';
import { THINGS } from './defs.js';
import { allThings, dist, hourFloat, letter } from './world.js';

const center = (t) => { const d = THINGS[t.def]; const [sw, sh] = [t.sw ?? d.size?.[0] ?? 1, t.sh ?? d.size?.[1] ?? 1]; return { x: t.x + (sw - 1) / 2, y: t.y + (sh - 1) / 2 }; };

export const isDaytime = (w) => { const h = hourFloat(w.tick); return h >= POWER.dayStart && h < POWER.dayEnd; };

// Mode set by the player in the inspector: 'on' (default), 'day' (only in daylight), 'off'.
export function modeAllows(w, t) {
  const mode = t.mode ?? 'on';
  if (mode === 'off') return false;
  if (mode === 'day' && !isDaytime(w)) return false;
  if (THINGS[t.def].nightOnly && isDaytime(w)) return false;
  return true;
}

export const netOf = (w, t) => { const i = w.powerNet.get(t.id); return i === undefined ? null : w.networks[i]; };
export const isPowered = (w, t) => !!netOf(w, t)?.powered && !t.broken;

function rebuild(w) {
  const poles = allThings(w, (t, d) => d.pole);
  const parent = poles.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a, b) => { parent[find(a)] = find(b); };
  for (let i = 0; i < poles.length; i++) for (let j = i + 1; j < poles.length; j++) {
    if (Math.max(Math.abs(poles[i].x - poles[j].x), Math.abs(poles[i].y - poles[j].y)) <= POWER.poleLink) join(i, j); // squares, diagonals included
  }
  // A machine in reach of poles from two grids bridges them.
  const members = allThings(w, (t, d) => d.power);
  const reach = new Map();
  for (const m of members) {
    const near = poles.map((p, i) => [p, i]).filter(([p]) => dist(p, m) <= POWER.poleRange).map(([, i]) => i);
    for (let k = 1; k < near.length; k++) join(near[0], near[k]);
    reach.set(m, near);
  }
  const byRoot = new Map();
  w.networks = [];
  w.powerNet = new Map();
  const netFor = (i) => {
    const root = find(i);
    if (!byRoot.has(root)) { byRoot.set(root, w.networks.length); w.networks.push({ id: w.networks.length, poles: [], members: [], powered: true, supply: 0, demand: 0, stored: 0, capacity: 0 }); }
    return byRoot.get(root);
  };
  poles.forEach((p, i) => { const n = netFor(i); w.networks[n].poles.push(p); w.powerNet.set(p.id, n); });
  for (const m of members) {
    const near = reach.get(m);
    if (!near.length) continue;
    const n = netFor(near[0]);
    w.networks[n].members.push(m);
    w.powerNet.set(m.id, n);
  }
  w.powerDirty = false;
}

// Does this machine want power right now? (Mode, broken, and per-machine conditions.)
export function wantsPower(w, t) {
  const d = THINGS[t.def];
  if (!d.power?.draw || t.broken || !modeAllows(w, t)) return false;
  if (d.bench) return !!t.working; // presses and vats draw only while they have work
  if (d.turret) return (t.ammo ?? 0) > 0;
  return true;
}

// Solar output by time of day: a smooth arc from dawn to dusk.
function solarFactor(w) {
  const h = hourFloat(w.tick);
  return h <= POWER.dayStart || h >= POWER.dayEnd ? 0 : Math.sin((Math.PI * (h - POWER.dayStart)) / (POWER.dayEnd - POWER.dayStart));
}

export function tickPower(w, dt) {
  if (w.powerDirty) rebuild(w);
  const days = dt / TICKS_PER_DAY;
  for (const net of w.networks) {
    let demand = 0, capacity = 0, stored = 0, solar = 0;
    const gens = [], batteries = [];
    for (const m of net.members) {
      const d = THINGS[m.def];
      if (wantsPower(w, m)) demand += d.power.draw;
      if (d.power.storage && !m.broken) { batteries.push(m); capacity += d.power.storage; stored += m.charge ?? 0; }
      if (d.power.solar && !m.broken && !w.roof[m.y * w.w + m.x]) solar += d.power.output * solarFactor(w);
      if (d.power.output && d.fuel) gens.push(m);
    }
    // Generators only run (burn fuel, make noise) when something needs the power.
    const needGen = demand > solar || stored < capacity * 0.95;
    let supply = solar;
    for (const g of gens) {
      g.running = needGen && !g.broken && g.fuel > 0 && modeAllows(w, g);
      if (g.running) supply += THINGS[g.def].power.output;
    }
    const balance = (supply - demand) * days; // Wd this tick
    const wasPowered = net.powered;
    if (balance >= 0) {
      net.powered = true;
      let surplus = balance;
      for (const b of batteries) { const room = THINGS[b.def].power.storage - (b.charge ?? 0); const add = Math.min(room, surplus); b.charge = (b.charge ?? 0) + add; surplus -= add; }
    } else {
      let need = -balance;
      for (const b of batteries) { const take = Math.min(b.charge ?? 0, need); b.charge = (b.charge ?? 0) - take; need -= take; }
      net.powered = need <= 1e-9;
    }
    Object.assign(net, { supply: Math.round(supply), demand, capacity, stored: batteries.reduce((s, b) => s + (b.charge ?? 0), 0) });
    if (wasPowered && !net.powered && demand > 0 && w.tick - (w.lastBrownout ?? -1e9) > 2500) {
      w.lastBrownout = w.tick;
      letter(w, `Brownout: a grid needs ${demand} W but has ${Math.round(supply)} W and empty batteries. Its machines stopped.`, 'bad', net.poles[0] ?? net.members[0]);
    }
  }
}

export { center as machineCenter };
