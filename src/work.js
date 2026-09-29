// Work types → WorkGivers → jobs. A WorkGiver lists candidate targets and can turn one into
// a job (or refuse: reserved, unreachable, missing materials...).
//
// Selection (RW JobGiver_Work): priority 1 first, then 2, 3, 4. Within a priority the
// leftmost work type wins. Within a work type the closest valid target wins.

import { CARRY_CAPACITY } from './config.js';
import { THINGS, RECIPES, WORK_TYPES, ingKey, ingMatches } from './defs.js';
import { allThings, canReach, canReachThing, reservedByOther, tkey, ckey, dist, countOwned, plantAt, buildingAt, blueprintAt, itemAt, colonists } from './world.js';
import { findStorageCell } from './zones.js';
import { haulJob, deliverJob, buildJob, repairJob, rearmJob, salvageJob, mineJob, cutJob, sowJob, billJob } from './jobs.js';
import { needsTending, rescueJob, tendJob, bestMedicine, pkey } from './medical.js';

const free = (w, p, t) => !reservedByOther(w, tkey(t), p) && canReachThing(w, p, t);

// Nearest usable item; `urgency(t)` (in cells) lets important items jump the queue.
function nearestItem(w, p, pred, urgency = () => 0) {
  return allThings(w, (t, d) => d.kind === 'item' && pred(t, d))
    .sort((a, b) => dist(p, a) - urgency(a) - (dist(p, b) - urgency(b)))
    .find((t) => free(w, p, t)) ?? null;
}

function missingMaterials(bp) {
  const cost = THINGS[bp.builds].cost;
  const out = Object.entries(cost).map(([def, n]) => [def, n - (bp.stock[def] ?? 0)]).filter(([, n]) => n > 0);
  return out.length ? out : null;
}

function billWanted(w, bill) {
  if (bill.paused) return false;
  const r = RECIPES[bill.recipe];
  if (bill.mode === 'forever' || !r.product) return true;
  return countOwned(w, r.product.def) < bill.target;
}

// Don't send people out to patch a wall (or grab a body) while zombies are right there.
const zombieNear = (w, t, r = 3) => w.pawns.some((z) => z.faction === 'zombie' && dist(z, t) <= r);

// One giver per work type that handles every bench bill of that type: stock the ingredients,
// then do the work. Bodies bound to rise again get hauled to the burn pit first.
const billGiver = (workType) => ({
  targets: (w) => allThings(w, (t, d) => d.bench && t.bills.some((b) => RECIPES[b.recipe].workType === workType && billWanted(w, b))),
  job(w, p, bench) {
    if (!free(w, p, bench)) return null;
    for (const bill of bench.bills) {
      const r = RECIPES[bill.recipe];
      if (r.workType !== workType || !billWanted(w, bill)) continue;
      const missing = r.ingredients.find((ing) => (bench.stock[ingKey(ing)] ?? 0) < ing.count);
      if (!missing) return billJob(w, bench, bill);
      const item = nearestItem(w, p, (t) => ingMatches(missing, t) && !zombieNear(w, t), (t) => (t.reanimateAt ? 60 : 0));
      if (item) return deliverJob(w, item, bench, ingKey(missing), missing.count - (bench.stock[ingKey(missing)] ?? 0));
    }
    return null;
  },
});

export const GIVERS = {
  doctor: [
    {
      targets: (w) => colonists(w).filter((d) => d.downed && d.inBed == null && !d.carriedBy),
      job: (w, r, d) => (d !== r && !reservedByOther(w, pkey(d), r) && canReach(w, r, d.x, d.y, true) && !zombieNear(w, d, 5) ? rescueJob(w, r, d) : null),
    },
    {
      targets: (w) => colonists(w).filter((pt) => (pt.downed || pt.lying) && !pt.carriedBy && needsTending(w, pt)),
      job(w, doc, pt) {
        if (pt === doc || reservedByOther(w, pkey(pt), doc) || !canReach(w, doc, pt.x, pt.y, true) || zombieNear(w, pt, 4)) return null;
        return tendJob(w, doc, pt, bestMedicine(w, doc));
      },
    },
  ],

  cooking: [billGiver('cooking')],

  construction: [
    {
      targets: (w) => allThings(w, (t, d) => d.kind === 'building' && d.cost && t.hp < d.hp * 0.999),
      job: (w, p, b) => (free(w, p, b) && !zombieNear(w, b) ? repairJob(w, b) : null),
    },
    {
      targets: (w) => allThings(w, (t, d) => d.trap && !t.armed),
      job: (w, p, t) => (free(w, p, t) && !zombieNear(w, t) ? rearmJob(w, t) : null),
    },
    {
      targets: (w) => allThings(w, (t, d) => d.kind === 'blueprint' && missingMaterials(t)),
      job(w, p, bp) {
        if (!free(w, p, bp)) return null;
        for (const [def, need] of missingMaterials(bp)) {
          const item = nearestItem(w, p, (t) => t.def === def);
          if (item) return deliverJob(w, item, bp, def, Math.min(need, CARRY_CAPACITY));
        }
        return null;
      },
    },
    {
      targets: (w) => allThings(w, (t, d) => d.kind === 'blueprint' && !missingMaterials(t)),
      job: (w, p, bp) => (free(w, p, bp) ? buildJob(w, bp) : null),
    },
    {
      targets: (w) => allThings(w, (t) => t.designation === 'salvage'),
      job: (w, p, b) => (free(w, p, b) ? salvageJob(w, b) : null),
    },
  ],

  growing: [
    {
      targets: (w) => allThings(w, (t, d) => d.sowable && t.growth >= 1 && w.zoneAt[t.y * w.w + t.x]?.type === 'grow'),
      job: (w, p, plant) => (free(w, p, plant) ? cutJob(w, plant, 'crop') : null),
    },
    {
      targets(w) {
        const out = [];
        for (const z of w.zones) {
          if (z.type !== 'grow') continue;
          for (const i of z.cells) {
            const x = i % w.w, y = (i / w.w) | 0;
            if (!plantAt(w, x, y) && !buildingAt(w, x, y) && !blueprintAt(w, x, y) && !itemAt(w, x, y)) out.push({ x, y, crop: z.crop });
          }
        }
        return out;
      },
      job: (w, p, c) => (!reservedByOther(w, ckey(w, c.x, c.y), p) && canReach(w, p, c.x, c.y, false) ? sowJob(w, c.x, c.y, c.crop) : null),
    },
  ],

  mining: [{
    targets: (w) => allThings(w, (t) => t.designation === 'mine'),
    job: (w, p, rock) => (free(w, p, rock) ? mineJob(w, rock) : null),
  }],

  plantCutting: [{
    targets: (w) => allThings(w, (t) => t.designation === 'chop' || (t.designation === 'harvest' && t.growth >= 1)),
    job: (w, p, plant) => (free(w, p, plant) ? cutJob(w, plant, plant.designation) : null),
  }],

  crafting: [billGiver('crafting')],

  hauling: [
    billGiver('hauling'), // burn pit
    {
      targets: (w) => allThings(w, (t, d) => d.kind === 'item'),
      job(w, p, item) {
        if (!free(w, p, item)) return null;
        const dest = findStorageCell(w, p, item);
        return dest && haulJob(w, item, dest);
      },
    },
  ],
};

// Emergency work (RW has the same idea): a body that's about to rise gets carried to a burn
// pit before anything else, by anyone who hauls.
function emergencyWork(w, p) {
  if (!(p.priorities.hauling > 0) || p.incapable.has('hauling')) return null;
  const risers = allThings(w, (t, d) => d.corpse && t.reanimateAt && !zombieNear(w, t));
  if (!risers.length) return null;
  const pit = allThings(w, (t, d) => d.bench && t.bills.some((b) => !b.paused && RECIPES[b.recipe].ingredients.some((i) => i.def === 'corpse')))
    .sort((a, b) => dist(p, a) - dist(p, b)).find((t) => free(w, p, t));
  const body = pit && risers.sort((a, b) => a.reanimateAt - b.reanimateAt).find((t) => free(w, p, t));
  return body ? deliverJob(w, body, pit, 'corpse', 1) : null;
}

export function findWork(w, p) {
  const urgent = emergencyWork(w, p);
  if (urgent) return urgent;
  for (let prio = 1; prio <= 4; prio++) {
    for (const wt of WORK_TYPES) {
      if (p.priorities[wt.key] !== prio || p.incapable.has(wt.key)) continue;
      let best = null, bestD = Infinity;
      for (const giver of GIVERS[wt.key]) {
        const cands = giver.targets(w, p).map((t) => ({ t, d: dist(p, t) })).sort((a, b) => a.d - b.d);
        for (const { t, d } of cands) {
          if (d >= bestD) break;
          const job = giver.job(w, p, t);
          if (job) { best = job; bestD = d; break; }
        }
      }
      if (best) return best;
    }
  }
  return null;
}
