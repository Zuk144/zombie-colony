// Terrain as vector shapes, crisp at any zoom.
//
// Natural regions (rich soil, gravel, sand, water, rock) are traced with marching squares over
// cell centers, which gives clean 45° chamfered corners while straight edges still land exactly
// on cell boundaries (roads use this too, so their bends read as smooth diagonals). Building
// floors (concrete) stay as crisp cell rects.
// Paths are built per CHUNK and cached; each frame the visible chunks are merged with addPath
// and filled once per layer (one fill = no seams between chunks).

import { TILE, CHUNK } from './config.js';
import { TERRAIN, TERRAIN_INDEX as TI, THINGS } from './defs.js';

const T = TILE;
// Marching-squares walk, clockwise: corner, edge midpoint, corner, ... (unit square coords).
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]]; // TL TR BR BL
const MIDS = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]; // between corner k and k+1

export function createTerrainArt(w) {
  const isRock = (i) => w.cells[i].some((t) => THINGS[t.def].natural);
  const ter = (key) => (i) => w.terrain[i] === TI[key];
  const LAYERS = [
    { fill: TERRAIN[TI.richSoil].color, test: ter('richSoil') },
    { fill: TERRAIN[TI.gravel].color, test: ter('gravel') },
    { fill: TERRAIN[TI.sand].color, test: (i) => w.terrain[i] === TI.sand || w.terrain[i] === TI.water }, // beaches under water
    { fill: TERRAIN[TI.water].color, test: ter('water'), edge: 'rgba(210, 238, 250, 0.7)', edgeWidth: 1.6 },
    { fill: TERRAIN[TI.concrete].color, test: ter('concrete'), crisp: true, grid: 'rgba(0,0,0,0.07)' },
    { fill: TERRAIN[TI.asphalt].color, test: ter('asphalt'), edge: 'rgba(255,255,255,0.10)', edgeWidth: 1 },
    { fill: '#7f7c75', side: '#55534e', test: isRock, edge: '#3b3a36', edgeWidth: 1.2, raised: 4 },
  ];

  // Square (sx, sy) spans cell centers (sx-1, sy-1)..(sx, sy); sx ∈ [0, w], sy ∈ [0, h].
  const cw = Math.ceil((w.w + 1) / CHUNK), ch = Math.ceil((w.h + 1) / CHUNK);
  const chunks = new Array(cw * ch).fill(null);

  const at = (test, x, y) => test(Math.min(w.h - 1, Math.max(0, y)) * w.w + Math.min(w.w - 1, Math.max(0, x)));

  function buildChunk(ci) {
    const cx = ci % cw, cy = (ci / cw) | 0;
    const sx0 = cx * CHUNK, sy0 = cy * CHUNK;
    const sx1 = Math.min(sx0 + CHUNK, w.w + 1), sy1 = Math.min(sy0 + CHUNK, w.h + 1);
    return LAYERS.map((L) => {
      const fill = new Path2D(), edge = new Path2D(), grid = L.grid ? new Path2D() : null;
      for (let sy = sy0; sy < sy1; sy++) {
        let runStart = -1;
        const flushRun = (end) => {
          if (runStart < 0) return;
          if (L.crisp) fill.rect((runStart - 1) * T, (sy - 1) * T, (end - runStart) * T, T);
          else fill.rect((runStart - 0.5) * T, (sy - 0.5) * T, (end - runStart) * T, T);
          runStart = -1;
        };
        for (let sx = sx0; sx < sx1; sx++) {
          if (L.crisp) {
            // Crisp layers are per cell; cell (sx-1, sy-1) belongs to this square index.
            const x = sx - 1, y = sy - 1;
            const on = x >= 0 && y >= 0 && x < w.w && y < w.h && L.test(y * w.w + x);
            if (on && runStart < 0) runStart = sx;
            if (!on) flushRun(sx);
            if (on && grid) grid.rect(x * T, y * T, T, T);
            continue;
          }
          const inside = [at(L.test, sx - 1, sy - 1), at(L.test, sx, sy - 1), at(L.test, sx, sy), at(L.test, sx - 1, sy)];
          const n = inside[0] + inside[1] + inside[2] + inside[3];
          if (n === 4) { if (runStart < 0) runStart = sx; continue; }
          flushRun(sx);
          if (n === 0) continue;
          const ox = (sx - 0.5) * T, oy = (sy - 0.5) * T;
          const verts = [];
          for (let k = 0; k < 4; k++) {
            if (inside[k]) verts.push([CORNERS[k], false]);
            if (inside[k] !== inside[(k + 1) % 4]) verts.push([MIDS[k], true]);
          }
          verts.forEach(([[u, v]], i) => (i ? fill.lineTo(ox + u * T, oy + v * T) : fill.moveTo(ox + u * T, oy + v * T)));
          fill.closePath();
          // Contour = consecutive midpoints (the boundary), never the square's own sides.
          for (let i = 0; i < verts.length; i++) {
            const a = verts[i], b = verts[(i + 1) % verts.length];
            if (!a[1] || !b[1]) continue;
            edge.moveTo(ox + a[0][0] * T, oy + a[0][1] * T);
            edge.lineTo(ox + b[0][0] * T, oy + b[0][1] * T);
          }
        }
        flushRun(sx1);
      }
      return { fill, edge, grid };
    });
  }

  function markDirty() {
    const d = w.terrainDirty;
    for (let i = 0; i < d.length; i += 2) {
      const x = d[i], y = d[i + 1];
      // A cell touches squares (x..x+1, y..y+1).
      for (const [sx, sy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) {
        chunks[Math.floor(sy / CHUNK) * cw + Math.floor(sx / CHUNK)] = null;
      }
    }
    d.length = 0;
  }

  // view = world-space rect { x0, y0, x1, y1 }; px = world units per screen pixel.
  function draw(ctx, view, px, zoom) {
    if (w.terrainDirty.length) markDirty();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w.w * T, w.h * T);
    ctx.clip();
    ctx.fillStyle = TERRAIN[TI.soil].color;
    ctx.fillRect(0, 0, w.w * T, w.h * T);

    const c0x = Math.max(0, Math.floor((view.x0 / T + 0.5) / CHUNK)), c1x = Math.min(cw - 1, Math.floor((view.x1 / T + 1.5) / CHUNK));
    const c0y = Math.max(0, Math.floor((view.y0 / T + 0.5) / CHUNK)), c1y = Math.min(ch - 1, Math.floor((view.y1 / T + 1.5) / CHUNK));
    const visible = [];
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      const ci = cy * cw + cx;
      chunks[ci] ??= buildChunk(ci);
      visible.push(chunks[ci]);
    }

    LAYERS.forEach((L, li) => {
      const fill = new Path2D(), edge = new Path2D();
      for (const c of visible) {
        fill.addPath(c[li].fill);
        if (L.edge) edge.addPath(c[li].edge);
      }
      if (L.raised) {
        // Rock is "extruded": a darker side face peeks out below the top.
        ctx.save();
        ctx.translate(0, L.raised);
        ctx.fillStyle = L.side;
        ctx.fill(fill);
        ctx.restore();
      }
      ctx.fillStyle = L.fill;
      ctx.fill(fill);
      if (L.grid && zoom >= 1.6) {
        ctx.strokeStyle = L.grid;
        ctx.lineWidth = px;
        for (const c of visible) ctx.stroke(c[li].grid);
      }
      if (L.edge) {
        ctx.strokeStyle = L.edge;
        ctx.lineWidth = L.edgeWidth * px;
        ctx.lineCap = 'round';
        ctx.stroke(edge);
      }
    });

    // Road center markings.
    if (zoom >= 0.7) {
      ctx.strokeStyle = 'rgba(226, 196, 92, 0.85)';
      ctx.lineWidth = 0.9;
      ctx.setLineDash([5, 6]);
      for (const r of w.roads) {
        ctx.beginPath();
        r.pts.forEach(([x, y], i) => (i ? ctx.lineTo((x + 0.5) * T, (y + 0.5) * T) : ctx.moveTo((x + 0.5) * T, (y + 0.5) * T)));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  return { draw };
}
