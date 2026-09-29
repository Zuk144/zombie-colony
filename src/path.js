// A* on the cell grid, 8 directions, octile heuristic, pluggable cost function
// (survivors vs zombies see walls and doors differently).

import { DIRS, canStep, survivorCost } from './world.js';

const MAX_EXPANSIONS = 15000;

// goal = { x, y, w?, h?, touch? }. Returns cells to walk (excluding start), [] if already
// there, or null. touch = end on a cell next to the goal rect, never inside it — used for
// work on blocked targets and for building, so a pawn never stands in the wall it finishes.
export function findPath(w, sx, sy, goal, cost = survivorCost) {
  const gx0 = goal.x, gy0 = goal.y, gx1 = goal.x + (goal.w ?? 1) - 1, gy1 = goal.y + (goal.h ?? 1) - 1;
  const rectDist = (x, y) => Math.max(gx0 - x, 0, x - gx1, gy0 - y, 0, y - gy1);
  const isGoal = goal.touch
    ? (x, y) => rectDist(x, y) === 1
    : (x, y) => x === goal.x && y === goal.y;
  if (isGoal(sx, sy)) return [];

  const n = w.w * w.h;
  const g = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = new Heap();
  const h = (x, y) => {
    const dx = Math.max(gx0 - x, 0, x - gx1), dy = Math.max(gy0 - y, 0, y - gy1);
    return Math.max(0, Math.max(dx, dy) + 0.4142 * Math.min(dx, dy) - (goal.touch ? 1 : 0));
  };

  const start = sy * w.w + sx;
  g[start] = 0;
  heap.push(start, h(sx, sy));
  let expansions = 0;

  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % w.w, cy = (cur / w.w) | 0;
    if (isGoal(cx, cy)) {
      const path = [];
      for (let c = cur; c !== start; c = came[c]) path.push([c % w.w, (c / w.w) | 0]);
      return path.reverse();
    }
    if (++expansions > MAX_EXPANSIONS) return null;
    for (const [dx, dy] of DIRS) {
      if (!canStep(w, cx, cy, dx, dy, cost)) continue;
      const nx = cx + dx, ny = cy + dy, ni = ny * w.w + nx;
      if (closed[ni]) continue;
      const c = g[cur] + (dx && dy ? Math.SQRT2 : 1) * cost(w, nx, ny);
      if (c < g[ni]) {
        g[ni] = c;
        came[ni] = cur;
        heap.push(ni, c + h(nx, ny));
      }
    }
  }
  return null;
}

export class Heap {
  constructor() { this.items = []; this.prios = []; }
  get size() { return this.items.length; }
  push(item, prio) {
    const { items, prios } = this;
    let i = items.length;
    items.push(item); prios.push(prio);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (prios[parent] <= prio) break;
      items[i] = items[parent]; prios[i] = prios[parent];
      i = parent;
    }
    items[i] = item; prios[i] = prio;
  }
  pop() {
    const { items, prios } = this;
    const top = items[0];
    const lastItem = items.pop(), lastPrio = prios.pop();
    if (items.length) {
      let i = 0;
      const len = items.length;
      while (true) {
        let c = 2 * i + 1;
        if (c >= len) break;
        if (c + 1 < len && prios[c + 1] < prios[c]) c++;
        if (prios[c] >= lastPrio) break;
        items[i] = items[c]; prios[i] = prios[c];
        i = c;
      }
      items[i] = lastItem; prios[i] = lastPrio;
    }
    return top;
  }
}
