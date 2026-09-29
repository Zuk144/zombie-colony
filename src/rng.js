// Seeded RNG (mulberry32) so a map seed reproduces the same world. State is a single number
// exposed via getState/setState so saves resume the exact same random stream.
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    getState: () => s,
    setState: (v) => { s = v >>> 0; },
  };
}

// Chance that an event with a mean time between occurrences of `mtb` fires during one check
// spanning `interval` (same units). This is how RimWorld rolls breaks and incidents.
export const mtbChance = (mtb, interval) => 1 - Math.exp(-interval / mtb);

// Piecewise-linear curve lookup: points = [[x, y], ...] sorted by x.
export function curve(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}
