// Frame rendering: camera transform, draw order, and night lighting. Terrain comes from
// terrainArt.js (cached vector chunks); every sprite comes from art.js (vector paths).

import { TILE } from './config.js';
import { THINGS } from './defs.js';
import { hourFloat, inBounds, thingsAt, sizeOf, allThings } from './world.js';
import { createTerrainArt } from './terrainArt.js';
import * as A from './art.js';

const T = TILE;
const ZONE_STYLE = {
  stockpile: ['rgba(240, 214, 110, 0.18)', 'rgba(250, 225, 120, 0.75)'],
  grow: ['rgba(150, 236, 110, 0.16)', 'rgba(165, 245, 125, 0.7)'],
  shelter: ['rgba(110, 175, 255, 0.16)', 'rgba(130, 190, 255, 0.8)'],
};

export function createRenderer(canvas, w) {
  const ctx = canvas.getContext('2d');
  const terrain = createTerrainArt(w);
  const cam = { x: (w.w * T) / 2, y: (w.h * T) / 2, zoom: 2.2, minZoom: 0.45, maxZoom: 7 };
  const light = document.createElement('canvas');
  const lctx = light.getContext('2d');
  let dpr = 1, W = 1, H = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth || 1;
    H = canvas.clientHeight || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    light.width = Math.ceil(W / 2);
    light.height = Math.ceil(H / 2);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  const screenToWorld = (sx, sy) => ({ x: (sx - W / 2) / cam.zoom + cam.x, y: (sy - H / 2) / cam.zoom + cam.y });
  const worldToScreen = (wx, wy) => ({ x: (wx - cam.x) * cam.zoom + W / 2, y: (wy - cam.y) * cam.zoom + H / 2 });
  const screenToCell = (sx, sy) => {
    const p = screenToWorld(sx, sy);
    return { x: Math.floor(p.x / T), y: Math.floor(p.y / T) };
  };

  // Pawn center in world units, interpolated between cells while moving.
  function pawnPos(p) {
    let x = p.x, y = p.y;
    if (p.move) {
      const [nx, ny] = p.move.path[p.move.i];
      x += (nx - p.x) * p.move.progress;
      y += (ny - p.y) * p.move.progress;
    }
    const j = p.jitter ?? [0, 0];
    return { x: (x + 0.5 + j[0]) * T, y: (y + 0.5 + j[1]) * T };
  }

  function darkness() {
    const h = hourFloat(w.tick);
    return h >= 21 || h < 4 ? 1 : h >= 18 ? (h - 18) / 3 : h < 7 ? 1 - (h - 4) / 3 : 0;
  }

  const connects = (x, y) => {
    if (!inBounds(w, x, y)) return null;
    for (const t of thingsAt(w, x, y)) {
      const d = THINGS[t.def];
      if (d.wallLike) return 'wall';
      if (d.door) return 'door';
    }
    return null;
  };

  function draw(ui, now) {
    const z = cam.zoom, px = 1 / z;
    const lod = z >= 1.7 ? 2 : z >= 0.85 ? 1 : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16181c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const worldTransform = () => ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z));
    worldTransform();

    const view = { x0: cam.x - W / 2 / z, y0: cam.y - H / 2 / z, x1: cam.x + W / 2 / z, y1: cam.y + H / 2 / z };
    terrain.draw(ctx, view, px, z);

    const x0 = Math.max(0, Math.floor(view.x0 / T) - 2), x1 = Math.min(w.w - 1, Math.ceil(view.x1 / T) + 1);
    const y0 = Math.max(0, Math.floor(view.y0 / T) - 2), y1 = Math.min(w.h - 1, Math.ceil(view.y1 / T) + 1);

    // Zones
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const zone = w.zoneAt[y * w.w + x];
      if (!zone) continue;
      const [fill, edge] = ZONE_STYLE[zone.type];
      ctx.fillStyle = fill;
      ctx.fillRect(x * T, y * T, T, T);
      ctx.fillStyle = edge;
      const other = (dx, dy) => !inBounds(w, x + dx, y + dy) || w.zoneAt[(y + dy) * w.w + x + dx] !== zone;
      const e = 1.4 * px;
      if (other(0, -1)) ctx.fillRect(x * T, y * T, T, e);
      if (other(0, 1)) ctx.fillRect(x * T, (y + 1) * T - e, T, e);
      if (other(-1, 0)) ctx.fillRect(x * T, y * T, e, T);
      if (other(1, 0)) ctx.fillRect((x + 1) * T - e, y * T, e, T);
    }

    // Collect visible things once (multi-cell things appear in several cells).
    const seen = new Set();
    const items = [], low = [], trees = [], walls = [], doors = [], furniture = [], blueprints = [], badges = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      for (const t of w.cells[y * w.w + x]) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        const d = THINGS[t.def];
        if (t.designation) badges.push(t);
        if (d.kind === 'item') items.push(t);
        else if (d.kind === 'plant') (t.def === 'tree' ? trees : low).push(t);
        else if (d.kind === 'blueprint') blueprints.push(t);
        else if (d.natural) continue;
        else if (d.wallLike) walls.push(t);
        else if (d.door) doors.push(t);
        else furniture.push(t);
      }
    }

    for (const t of items) A.drawItem(ctx, t, px, lod);
    for (const t of low) (t.def === 'berryBush' ? A.drawBush : A.drawCrop)(ctx, t, px, lod);
    for (const t of furniture) {
      if (t.def === 'car') A.drawCar(ctx, t, px, lod);
      else if (t.def === 'bed') A.drawBed(ctx, t, px);
      else if (t.def === 'table') A.drawTable(ctx, t, px, lod);
      else if (t.def === 'campfire') A.drawCampfire(ctx, t, now, px);
      else if (t.def === 'torch') A.drawTorch(ctx, t, now, px);
      else if (t.def === 'spikeTrap') A.drawTrap(ctx, t, px, lod);
      else if (t.def === 'workbench') A.drawWorkbench(ctx, t, px, lod);
      else if (t.def === 'burnPit') A.drawBurnPit(ctx, t, now, px);
      else if (t.def === 'guardPost') A.drawGuardPost(ctx, t, px, lod);
    }
    if (walls.length) A.drawWalls(ctx, walls, connects, px, lod);
    for (const t of doors) {
      const horizontal = connects(t.x - 1, t.y) === 'wall' || connects(t.x + 1, t.y) === 'wall';
      const open = w.pawns.some((p) => p.faction !== 'zombie' && ((p.x === t.x && p.y === t.y) || (p.move && p.move.path[p.move.i][0] === t.x && p.move.path[p.move.i][1] === t.y)));
      A.drawDoor(ctx, t, horizontal, open, px);
    }
    for (const t of blueprints) {
      const cost = THINGS[t.builds].cost;
      const need = Object.values(cost).reduce((a, b) => a + b, 0);
      const have = Object.values(t.stock).reduce((a, b) => a + b, 0);
      A.drawBlueprint(ctx, t, px, have / need);
    }
    for (const t of trees) A.drawTree(ctx, t, px, lod);
    for (const t of badges) A.drawBadge(ctx, t, t.designation, px);

    // Pawns: lying first, then standing sorted by y so overlaps read naturally.
    const visible = w.pawns.filter((p) => p.x >= x0 - 1 && p.x <= x1 + 1 && p.y >= y0 - 1 && p.y <= y1 + 1);
    const sel = ui.selected?.pawn;
    const lyingDown = (p) => p.asleep || p.downed || p.lying;
    for (const p of visible) {
      if (!lyingDown(p) || p.carriedBy) continue;
      const pos = pawnPos(p);
      const bed = p.inBed != null;
      A.drawLying(ctx, p.look, pos.x, pos.y, bed ? -Math.PI / 2 : p.facing ?? 0, px);
      if (bed) {
        ctx.fillStyle = '#5f86b3';
        ctx.fillRect(p.x * T + 2.4, p.y * T + 6.2, T - 4.8, T - 8.2);
      }
      if (p === sel) { ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 1.6 * px; ctx.beginPath(); ctx.arc(pos.x, pos.y, 8.5, 0, Math.PI * 2); ctx.stroke(); }
    }
    const standing = visible.filter((p) => !lyingDown(p) && !p.carriedBy).map((p) => ({ p, pos: pawnPos(p) })).sort((a, b) => a.pos.y - b.pos.y);
    for (const { p, pos } of standing) {
      A.drawPerson(ctx, p, pos.x, pos.y, now, w.tick, px, lod, p === sel);
      // Carried over the shoulder: drawn lying across the carrier.
      if (p.carryingPawn) A.drawLying(ctx, p.carryingPawn.look, pos.x, pos.y - 1, (p.facing ?? 0) + Math.PI / 2, px);
    }
    drawFx(now);

    // Pawn overlays: bars, names, status.
    for (const p of visible) {
      const pos = pawnPos(p);
      const zombie = p.faction === 'zombie';
      if (p.hp < p.maxHp && (!zombie || w.tick - (p.lastHurt ?? -1e9) < 600)) {
        const f = p.hp / p.maxHp;
        A.drawBar(ctx, pos.x, pos.y - 11, 12, f, zombie ? '#b7c48f' : f > 0.6 ? '#8fdc6a' : f > 0.3 ? '#f0c14b' : '#ef5b4b', px);
      }
      if (p.job?.workTotal) A.drawBar(ctx, pos.x, pos.y - (p.hp < p.maxHp ? 14.5 : 11), 12, 1 - p.job.workLeft / p.job.workTotal, '#7fc8ff', px);
      if (p.bleed > 4 && p.faction === 'colony' && lod > 0) {
        ctx.fillStyle = '#d83a3a';
        ctx.beginPath(); ctx.ellipse(pos.x - 6.5, pos.y - 6, 1.5, 2.1, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (p.infection) {
        ctx.fillStyle = '#86e04a';
        ctx.beginPath(); ctx.arc(pos.x + 6.5, pos.y - 6.5, 2.1 + Math.sin(now / 250) * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1e3a10'; ctx.lineWidth = px; ctx.stroke();
      }
      if (p.mental && !zombie) { ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 1.4 * px; ctx.beginPath(); ctx.arc(pos.x, pos.y, 7.2, 0, Math.PI * 2); ctx.stroke(); }
      if (p.asleep && lod > 0) {
        ctx.fillStyle = '#d7e7ff';
        ctx.font = '700 5px system-ui, sans-serif';
        ctx.textAlign = 'left';
        const k = (now / 700) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.fillText('z', pos.x + 4 + k * 3, pos.y - 5 - k * 5);
        ctx.globalAlpha = 1;
      }
      if (lod > 0 && (!zombie || (p.turnedFrom && lod > 1) || p === sel)) {
        A.drawLabel(ctx, p.name, pos.x, pos.y + 10.5, zombie ? '#c9d6b2' : p.faction === 'looter' ? '#ffb4a8' : '#fff');
      }
    }

    drawLighting(now, x0, x1, y0, y1);
    worldTransform();
    drawOverlay(ui, px, now);
  }

  function drawLighting(now, x0, x1, y0, y1) {
    const dark = darkness();
    if (dark < 0.02) return;
    const z = cam.zoom;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, light.width, light.height);
    lctx.fillStyle = `rgba(6, 10, 30, ${0.8 * dark})`;
    lctx.fillRect(0, 0, light.width, light.height);
    lctx.globalCompositeOperation = 'destination-out';
    const lights = [];
    for (const t of allThings(w, (t, d) => d.light)) {
      const r = THINGS[t.def].light;
      if (t.x < x0 - r || t.x > x1 + r || t.y < y0 - r || t.y > y1 + r) continue;
      const flicker = 1 + Math.sin(now / 110 + t.id) * 0.03 + Math.sin(now / 47 + t.id * 3) * 0.02;
      lights.push({ x: (t.x + 0.5) * T, y: (t.y + 0.5) * T, r: r * T * flicker, a: 1, warm: true });
    }
    // Survivors carry a faint light so you can find them at night.
    for (const p of w.pawns) if (p.faction === 'colony') { const pos = pawnPos(p); lights.push({ x: pos.x, y: pos.y, r: 2.6 * T, a: 0.55 }); }
    for (const L of lights) {
      const s = worldToScreen(L.x, L.y);
      const sx = s.x / 2, sy = s.y / 2, r = (L.r * z) / 2;
      if (sx < -r || sy < -r || sx > light.width + r || sy > light.height + r) continue;
      const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(0,0,0,${L.a})`);
      g.addColorStop(0.55, `rgba(0,0,0,${L.a * 0.7})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(light, 0, 0, canvas.width, canvas.height);
    // Warm glow on top.
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (!L.warm) continue;
      const s = worldToScreen(L.x, L.y);
      const r = L.r * z * dpr * 0.8, sx = s.x * dpr, sy = s.y * dpr;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(255, 150, 60, ${0.26 * dark})`);
      g.addColorStop(1, 'rgba(255, 150, 60, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Tracers, muzzle flashes, trap snaps. Each event is stamped with real time the first frame
  // it's seen, so effects read the same at any game speed.
  function drawFx(now) {
    for (const e of w.fx) {
      e.seenAt ??= now;
      const k = (now - e.seenAt) / (e.kind === 'shot' ? 160 : 400);
      if (k > 1) continue;
      if (e.kind === 'shot') {
        const x0 = (e.x0 + 0.5) * T, y0 = (e.y0 + 0.5) * T, x1 = (e.x1 + 0.5) * T, y1 = (e.y1 + 0.5) * T;
        ctx.strokeStyle = `rgba(255, 232, 150, ${0.9 * (1 - k)})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.fillStyle = `rgba(255, 210, 90, ${1 - k})`;
        ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * 0.06, y0 + (y1 - y0) * 0.06, 3 * (1 - k) + 0.5, 0, Math.PI * 2); ctx.fill();
        if (e.hit) { ctx.fillStyle = `rgba(120, 20, 20, ${0.8 * (1 - k)})`; ctx.beginPath(); ctx.arc(x1, y1, 2 + 3 * k, 0, Math.PI * 2); ctx.fill(); }
      } else if (e.kind === 'trap') {
        const cx = (e.x + 0.5) * T, cy = (e.y + 0.5) * T;
        ctx.strokeStyle = `rgba(220, 60, 50, ${1 - k})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, 4 + 10 * k, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  function drawOverlay(ui, px, now) {
    const s = ui.selected;
    if (s?.thing) {
      const [sw, sh] = sizeOf(s.thing);
      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = 2 * px;
      ctx.strokeRect(s.thing.x * T - 1, s.thing.y * T - 1, sw * T + 2, sh * T + 2);
    }
    const prev = ui.preview?.();
    if (prev) {
      for (const c of prev.cells) {
        ctx.fillStyle = c.ok ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 80, 70, 0.28)';
        ctx.fillRect(c.x * T, c.y * T, T, T);
      }
      if (prev.rect) {
        const r = prev.rect;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 1.5 * px;
        ctx.strokeRect(r.x0 * T, r.y0 * T, (r.x1 - r.x0 + 1) * T, (r.y1 - r.y0 + 1) * T);
      }
    }
    // Tap ripples: instant feedback for touches.
    for (const t of ui.ripples ?? []) {
      const k = (now - t.at) / 350;
      if (k > 1) continue;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * (1 - k)})`;
      ctx.lineWidth = 2 * px;
      ctx.beginPath();
      ctx.arc(t.x, t.y, (6 + 14 * k) * px * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  return { cam, draw, screenToWorld, worldToScreen, screenToCell, pawnPos, canvas, size: () => ({ W, H }) };
}
