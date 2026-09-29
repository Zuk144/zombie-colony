// Vector sprites. Everything is drawn in world units (1 cell = TILE) with Canvas paths, so it
// stays crisp at any zoom. `px` = world units per screen pixel (for constant-width hairlines);
// `lod` = level of detail (0 far out … 2 close up) to drop fine details when zoomed out.
//
// Style rules (docs/DESIGN.md §12): flat fills, one light direction (shadows fall down-right),
// dark hairline outlines, warm survivors, grey-green zombies with arms reaching forward.

import { TILE } from './config.js';
import { THINGS } from './defs.js';

const T = TILE;
const TAU = Math.PI * 2;
export const SHADOW = 'rgba(18, 22, 14, 0.24)';
const OUTLINE = 'rgba(16, 18, 20, 0.55)';

export function hash(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.05, r), 0, TAU);
  ctx.fill();
}
function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.05, rx), Math.max(0.05, ry), rot, 0, TAU);
  ctx.fill();
}
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function outline(ctx, px, color = OUTLINE, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width * px;
  ctx.stroke();
}

// ---- Plants ---------------------------------------------------------------

export function drawTree(ctx, t, px, lod) {
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  const r = 7.6 * (0.45 + 0.55 * t.growth);
  const h = hash(t.id);
  const ox = (h - 0.5) * 2.4, oy = (hash(t.id + 7) - 0.5) * 2.4; // break up the grid
  ctx.fillStyle = SHADOW;
  ellipse(ctx, cx + ox + 2.6, cy + oy + 3.3, r * 1.02, r * 0.86);
  ctx.fillStyle = h < 0.33 ? '#366c38' : h < 0.66 ? '#3e763b' : '#2f6440';
  circle(ctx, cx + ox, cy + oy, r);
  if (lod > 0) {
    ctx.fillStyle = h < 0.33 ? '#4a8a45' : h < 0.66 ? '#539248' : '#40805a';
    circle(ctx, cx + ox - r * 0.2, cy + oy - r * 0.24, r * 0.64);
    ctx.fillStyle = 'rgba(255, 255, 225, 0.13)';
    circle(ctx, cx + ox - r * 0.36, cy + oy - r * 0.4, r * 0.28);
  }
  if (lod > 1) {
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, r, 0, TAU);
    outline(ctx, px, 'rgba(18, 40, 20, 0.6)');
  }
}

export function drawBush(ctx, t, px, lod) {
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  const g = 0.4 + 0.6 * t.growth;
  ctx.fillStyle = SHADOW;
  ellipse(ctx, cx + 1.4, cy + 2, 5 * g, 4 * g);
  ctx.fillStyle = '#4b8646';
  for (const [dx, dy, r] of [[-2, -1, 3.2], [2, -1.5, 3], [0, 2, 3.2]]) circle(ctx, cx + dx * g, cy + dy * g, r * g);
  if (t.growth >= 1) {
    ctx.fillStyle = '#d23d5e';
    for (const [dx, dy] of [[-2.5, -1.5], [1.8, -2.2], [0.5, 1.2], [-1, 2.8], [2.8, 1]]) circle(ctx, cx + dx, cy + dy, 1);
  }
}

export function drawCrop(ctx, t, px, lod) {
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  const g = 0.3 + 0.7 * t.growth;
  const ripe = t.growth >= 1;
  ctx.fillStyle = ripe ? '#d8bf57' : '#86b94d';
  for (const [dx, dy] of [[-3.5, -3], [3, -3.5], [-3, 3.2], [3.5, 3]]) {
    ellipse(ctx, cx + dx, cy + dy - 1 * g, 1.1 * g, 2.6 * g, 0.3);
    ellipse(ctx, cx + dx + 1 * g, cy + dy, 1.1 * g, 2.4 * g, -0.6);
  }
}

// ---- Items ----------------------------------------------------------------

export function drawItem(ctx, t, px, lod) {
  const d = THINGS[t.def];
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  if (d.corpse) return drawCorpse(ctx, t, px, lod);
  ctx.fillStyle = SHADOW;
  ellipse(ctx, cx + 1, cy + 1.8, 5.6, 4.4);
  ctx.lineCap = 'round';
  switch (t.def) {
    case 'wood':
      for (let k = 0; k < 3; k++) {
        const y = cy - 3.4 + k * 3.4;
        ctx.strokeStyle = '#8c5b32';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx - 4.6, y); ctx.lineTo(cx + 4.2, y); ctx.stroke();
        ctx.fillStyle = '#e0bb85';
        circle(ctx, cx + 4.4, y, 1.2);
      }
      break;
    case 'stone':
      ctx.fillStyle = '#bab7af';
      for (const [dx, dy] of [[-5, -5], [0.3, -5], [-5, 0.3], [0.3, 0.3]]) {
        rrect(ctx, cx + dx, cy + dy, 4.7, 4.7, 1);
        ctx.fill();
        outline(ctx, px, '#6f6c66');
      }
      break;
    case 'scrap':
      ctx.fillStyle = '#7f8c99';
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 2); ctx.lineTo(cx - 1, cy - 5); ctx.lineTo(cx + 4.5, cy - 3.5);
      ctx.lineTo(cx + 5, cy + 1); ctx.lineTo(cx + 1, cy + 4.5); ctx.lineTo(cx - 4, cy + 3.5);
      ctx.closePath(); ctx.fill(); outline(ctx, px, '#4c5660');
      ctx.fillStyle = '#a6b2bd';
      ctx.beginPath(); ctx.moveTo(cx - 2, cy - 1); ctx.lineTo(cx + 3, cy - 2.5); ctx.lineTo(cx + 2, cy + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4c5660';
      circle(ctx, cx - 3, cy + 1.5, 0.7); circle(ctx, cx + 2.8, cy - 0.5, 0.7);
      break;
    case 'berries':
    case 'rice':
      if (t.def === 'berries') {
        ctx.fillStyle = '#4c8a45'; ellipse(ctx, cx, cy, 5, 3.2, -0.4);
        ctx.fillStyle = d.color;
        for (const [dx, dy] of [[-2.4, -0.8], [0, -1.8], [2.2, 0.2], [-0.6, 1.4], [1.4, -2.6]]) circle(ctx, cx + dx, cy + dy, 1.35);
      } else {
        ctx.fillStyle = '#e4d8b2'; ellipse(ctx, cx, cy + 0.6, 4.6, 4.1); ctx.beginPath(); ctx.ellipse(cx, cy + 0.6, 4.6, 4.1, 0, 0, TAU); outline(ctx, px, '#9c8f68');
        ctx.fillStyle = '#b5a473'; ctx.fillRect(cx - 1.6, cy - 4, 3.2, 1.4);
      }
      break;
    case 'cannedFood':
      for (const [dx, dy] of [[-2.6, -2.2], [2.6, -2.2], [0, 2.3]]) {
        ctx.fillStyle = d.color; circle(ctx, cx + dx, cy + dy, 2.7);
        ctx.fillStyle = '#d9d9d6'; circle(ctx, cx + dx, cy + dy, 1.8);
        ctx.fillStyle = '#b9b9b5'; circle(ctx, cx + dx + 0.3, cy + dy + 0.3, 0.9);
      }
      break;
    case 'meal':
      ctx.fillStyle = '#f2efe6'; circle(ctx, cx, cy, 5);
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); outline(ctx, px, '#a9a497');
      ctx.fillStyle = '#b8743a'; ellipse(ctx, cx - 0.8, cy + 0.4, 2.6, 2);
      ctx.fillStyle = '#7fae4a'; circle(ctx, cx + 1.9, cy - 1.3, 1.3);
      ctx.fillStyle = '#e6c25a'; circle(ctx, cx + 1.4, cy + 1.9, 1.1);
      break;
    default:
      ctx.fillStyle = d.color; rrect(ctx, cx - 4, cy - 4, 8, 8, 1.5); ctx.fill();
  }
  if (lod > 0 && t.count > 1) {
    const s = String(t.count);
    ctx.font = '600 5px system-ui, sans-serif';
    const tw = ctx.measureText(s).width;
    ctx.fillStyle = 'rgba(16, 18, 22, 0.78)';
    rrect(ctx, cx + 7.4 - tw - 2.4, cy + 2.6, tw + 2.4, 5.6, 2.2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, cx + 6.2, cy + 5.5);
  }
}

function drawCorpse(ctx, t, px, lod) {
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  const look = t.look ?? { clothes: '#555', skin: '#9fae8e', hair: '#222' };
  ctx.fillStyle = 'rgba(96, 18, 18, 0.55)';
  ellipse(ctx, cx + 1, cy + 1, 6.5, 4.2, hash(t.id) * 3);
  drawLying(ctx, look, cx, cy, hash(t.id + 3) * TAU, px, { dead: true, zombie: t.zombie });
}

// ---- People ---------------------------------------------------------------

// Standing person, facing +x after rotation. Survivors: warm clothes, hair on the back of the
// head. Zombies: grey-green skin, arms reaching forward, a slow sway.
export function drawPerson(ctx, p, x, y, now, tick, px, lod, selected) {
  const L = p.look;
  const zombie = p.faction === 'zombie';
  if (selected) {
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 1.6 * px;
    ctx.beginPath(); ctx.arc(x, y, 7.8, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = SHADOW;
  ellipse(ctx, x + 1.4, y + 2.5, 5.2, 4.4);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.facing ?? 0);
  const lunge = p.lunge != null && tick - p.lunge < 14 ? 1 - (tick - p.lunge) / 14 : 0;
  ctx.lineCap = 'round';
  if (zombie) {
    const sway = Math.sin(now / 320 + p.id) * 0.9;
    const reach = 6.4 + lunge * 2.8;
    ctx.strokeStyle = shade(L.clothes, -0.1);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0.4, -3.8); ctx.lineTo(reach - 2.2, -2.9 + sway);
    ctx.moveTo(0.4, 3.8); ctx.lineTo(reach - 2.2, 2.9 - sway);
    ctx.stroke();
    ctx.fillStyle = L.skin;
    circle(ctx, reach, -2.7 + sway, 1.35);
    circle(ctx, reach, 2.7 - sway, 1.35);
  } else {
    const wdef = p.weapon?.def;
    ctx.fillStyle = L.skin;
    if (wdef === 'pistol' || wdef === 'rifle') {
      // Gun held forward in both hands; a little kick when firing.
      const len = wdef === 'rifle' ? 10 : 5.5, k = lunge * 1.4;
      ctx.strokeStyle = '#26282c';
      ctx.lineWidth = wdef === 'rifle' ? 1.5 : 2;
      ctx.beginPath(); ctx.moveTo(2 - k, 1.6); ctx.lineTo(2 + len - k, 0.8); ctx.stroke();
      if (wdef === 'rifle') {
        ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(0.5 - k, 1.8); ctx.lineTo(4 - k, 1.5); ctx.stroke();
      }
      circle(ctx, 2.2 - k, 2.4, 1.2);
      circle(ctx, 2 + len * 0.55 - k, -0.6, 1.15);
    } else {
      circle(ctx, 1.3, -4.7, 1.2);
      const hx = 1.3 + lunge * 4, hy = 4.7 - lunge * 2.2;
      if (wdef === 'machete' || lunge > 0) {
        ctx.strokeStyle = wdef === 'machete' ? '#c9d2d9' : '#6b4a2e';
        ctx.lineWidth = wdef === 'machete' ? 1.3 : 1.5;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 5.5, hy - (lunge > 0 ? 3.5 : 1)); ctx.stroke();
      }
      circle(ctx, hx, hy, 1.2);
    }
  }
  // Shoulders
  ctx.fillStyle = L.clothes;
  ellipse(ctx, 0, 0, 3.6, 5.3);
  if (lod > 0) { ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 5.3, 0, 0, TAU); outline(ctx, px); }
  if (zombie && lod > 1) {
    ctx.fillStyle = 'rgba(90, 20, 20, 0.55)';
    circle(ctx, -1 + hash(p.id) * 2, (hash(p.id + 1) - 0.5) * 6, 1.3);
  }
  // Head + hair on the back half
  ctx.fillStyle = L.skin;
  circle(ctx, 0.7, 0, 3);
  ctx.fillStyle = L.hair;
  ctx.beginPath();
  ctx.arc(0.7, 0, 3.05, Math.PI * (zombie ? 0.65 : 0.5), Math.PI * (zombie ? 1.3 : 1.5));
  ctx.closePath();
  ctx.fill();
  if (lod > 0) { ctx.beginPath(); ctx.arc(0.7, 0, 3, 0, TAU); outline(ctx, px); }
  ctx.restore();
}

// Lying down: asleep, downed, or dead.
export function drawLying(ctx, look, x, y, angle, px, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (!opts.dead) { ctx.fillStyle = SHADOW; ellipse(ctx, 1, 1.5, 7.5, 4); }
  ctx.fillStyle = opts.dead ? shade(look.clothes, -0.25) : look.clothes;
  ellipse(ctx, -1.6, 0, 5.4, 3.4);
  ctx.beginPath(); ctx.ellipse(-1.6, 0, 5.4, 3.4, 0, 0, TAU); outline(ctx, px);
  ctx.fillStyle = look.skin;
  circle(ctx, -0.5, -4, 1.2);
  circle(ctx, -0.5, 4, 1.2);
  circle(ctx, 5, 0, 2.8);
  ctx.fillStyle = look.hair;
  ctx.beginPath(); ctx.arc(5, 0, 2.85, Math.PI * 0.5, Math.PI * 1.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---- Buildings ------------------------------------------------------------

const WALL_COLORS = {
  wall: ['#a2744a', '#5b3d24'],
  stoneWall: ['#a3a09a', '#57554f'],
  scrapWall: ['#7f8c98', '#434c55'],
  ruinWall: ['#bdb8ac', '#6f6a60'],
  barricade: ['#9c7a4c', '#4a3520'],
};
const WALL_W = 0.66 * T;
const wallWidth = (k) => (k === 'barricade' ? 0.4 * T : WALL_W);

// Walls are drawn as thick strokes between neighbor centers so they read as one connected
// structure (Prison Architect style). Three passes so different wall types join cleanly.
export function drawWalls(ctx, walls, connects, px, lod) {
  const groups = {};
  for (const t of walls) {
    const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
    const path = (groups[t.def] ??= new Path2D());
    let linked = false;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const c = connects(t.x + dx, t.y + dy);
      // Link each wall pair once (right/down); always link into doors.
      if (c === 'wall' && (dx > 0 || dy > 0)) { path.moveTo(cx, cy); path.lineTo(cx + dx * T, cy + dy * T); }
      if (c === 'door') { path.moveTo(cx, cy); path.lineTo(cx + dx * T * 0.5, cy + dy * T * 0.5); }
      if (c) linked = true;
    }
    if (!linked) { path.moveTo(cx - 0.01, cy); path.lineTo(cx + 0.01, cy); }
  }
  ctx.lineCap = 'square';
  ctx.save();
  ctx.translate(2, 3);
  ctx.strokeStyle = SHADOW;
  for (const k in groups) { ctx.lineWidth = wallWidth(k); ctx.stroke(groups[k]); }
  ctx.restore();
  for (const k in groups) { ctx.strokeStyle = WALL_COLORS[k][1]; ctx.lineWidth = wallWidth(k) + 2.2 * px; ctx.stroke(groups[k]); }
  for (const k in groups) { ctx.strokeStyle = WALL_COLORS[k][0]; ctx.lineWidth = wallWidth(k); ctx.stroke(groups[k]); }
  if (lod > 0) {
    ctx.save();
    ctx.translate(-0.8, -1);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
    for (const k in groups) { if (k === 'barricade') continue; ctx.lineWidth = WALL_W * 0.34; ctx.stroke(groups[k]); }
    ctx.restore();
    if (groups.barricade) { // plank seams read as "low fence", not "wall"
      ctx.strokeStyle = 'rgba(40, 26, 12, 0.55)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2.2, 2.2]);
      ctx.stroke(groups.barricade);
      ctx.setLineDash([]);
    }
  }
  ctx.lineCap = 'butt';
}

export function drawDoor(ctx, t, horizontal, open, px) {
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  ctx.save();
  ctx.translate(cx, cy);
  if (!horizontal) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = SHADOW;
  ctx.fillRect(-T / 2 + 2, -2, T, 5.5);
  ctx.fillStyle = '#5b3d24';
  ctx.fillRect(-T / 2, -3.2, 2.2, 6.4);
  ctx.fillRect(T / 2 - 2.2, -3.2, 2.2, 6.4);
  ctx.fillStyle = '#c28f58';
  if (open) {
    ctx.save();
    ctx.translate(-T / 2 + 2.2, -2);
    ctx.rotate(-1.2);
    ctx.fillRect(0, -1.2, T - 4.4, 2.4);
    ctx.restore();
  } else {
    rrect(ctx, -T / 2 + 2, -2.4, T - 4, 4.8, 0.8);
    ctx.fill();
    outline(ctx, px, '#5b3d24');
    ctx.fillStyle = '#e8d7a8';
    circle(ctx, T / 2 - 4.5, 0, 0.8);
  }
  ctx.restore();
}

export function drawCar(ctx, t, px, lod) {
  const horizontal = (t.sw ?? 2) >= (t.sh ?? 1);
  const cx = (t.x + (t.sw ?? 2) / 2) * T, cy = (t.y + (t.sh ?? 1) / 2) * T;
  const len = 2 * T - 2.5, wid = T - 3.2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((horizontal ? 0 : Math.PI / 2) + (hash(t.id) < 0.5 ? Math.PI : 0));
  ctx.fillStyle = SHADOW;
  rrect(ctx, -len / 2 + 2, -wid / 2 + 3, len, wid, 4);
  ctx.fill();
  ctx.fillStyle = '#1f2124';
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) ctx.fillRect(sx * len * 0.3 - 2.2, sy * (wid / 2) - 1.2 + (sy > 0 ? 0 : 0), 4.4, 2.4);
  ctx.fillStyle = t.tint ?? '#666';
  rrect(ctx, -len / 2, -wid / 2, len, wid, 4);
  ctx.fill();
  outline(ctx, px, 'rgba(10, 10, 12, 0.7)', 1.2);
  ctx.fillStyle = 'rgba(150, 175, 190, 0.85)';
  ctx.beginPath(); // windshield (front = +x)
  ctx.moveTo(len * 0.12, -wid / 2 + 2); ctx.lineTo(len * 0.26, -wid / 2 + 1.2); ctx.lineTo(len * 0.26, wid / 2 - 1.2); ctx.lineTo(len * 0.12, wid / 2 - 2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  rrect(ctx, -len * 0.22, -wid / 2 + 2.2, len * 0.34, wid - 4.4, 2);
  ctx.fill();
  if (lod > 1) {
    ctx.fillStyle = 'rgba(120, 72, 36, 0.5)';
    circle(ctx, -len * 0.35, wid * 0.15, 1.6);
    circle(ctx, len * 0.38, -wid * 0.2, 1.1);
  }
  ctx.restore();
}

export function drawBed(ctx, t, px) {
  const x = t.x * T, y = t.y * T;
  ctx.fillStyle = SHADOW; ctx.fillRect(x + 3, y + 3, T - 3, T - 2);
  ctx.fillStyle = '#7a5434'; rrect(ctx, x + 1.2, y + 0.8, T - 2.4, T - 1.6, 1.5); ctx.fill(); outline(ctx, px);
  ctx.fillStyle = '#e8e2d4'; rrect(ctx, x + 2.4, y + 2, T - 4.8, T - 4, 1); ctx.fill();
  ctx.fillStyle = '#5f86b3'; rrect(ctx, x + 2.4, y + 6.2, T - 4.8, T - 8.2, 1); ctx.fill();
  ctx.fillStyle = '#fbfaf5'; rrect(ctx, x + 3.4, y + 2.4, T - 6.8, 3, 1.2); ctx.fill();
}

export function drawTable(ctx, t, px, lod) {
  const x = t.x * T, y = t.y * T;
  ctx.fillStyle = SHADOW; rrect(ctx, x + 3, y + 4, T - 2, T - 4, 2); ctx.fill();
  ctx.fillStyle = '#a57a4c'; rrect(ctx, x + 1, y + 1.5, T - 2, T - 3, 2); ctx.fill(); outline(ctx, px, '#5b3d24');
  if (lod > 1) {
    ctx.strokeStyle = 'rgba(80, 50, 25, 0.35)'; ctx.lineWidth = px;
    ctx.beginPath(); ctx.moveTo(x + 1.5, y + 6); ctx.lineTo(x + T - 1.5, y + 6); ctx.moveTo(x + 1.5, y + 10); ctx.lineTo(x + T - 1.5, y + 10); ctx.stroke();
  }
}

export function drawCampfire(ctx, t, now, px) {
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  ctx.fillStyle = '#3b3530'; circle(ctx, cx, cy, 5.2);
  ctx.fillStyle = '#8d8a84';
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; circle(ctx, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 1.6); }
  ctx.strokeStyle = '#5e3c22'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 3.5, cy - 2.5); ctx.lineTo(cx + 3.5, cy + 2.5); ctx.moveTo(cx - 3.5, cy + 2.5); ctx.lineTo(cx + 3.5, cy - 2.5); ctx.stroke();
  drawFlame(ctx, cx, cy, 1, now + t.id * 100);
}

export function drawTorch(ctx, t, now, px) {
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  ctx.fillStyle = SHADOW; circle(ctx, cx + 1.5, cy + 2, 2.4);
  ctx.fillStyle = '#5e3c22'; circle(ctx, cx, cy, 1.8);
  drawFlame(ctx, cx, cy - 0.5, 0.6, now + t.id * 100);
}

function drawFlame(ctx, x, y, s, now) {
  const f = Math.sin(now / 90) * 0.35 + Math.sin(now / 53) * 0.25;
  ctx.fillStyle = '#e8672a'; ellipse(ctx, x, y - 0.6 * s, (3.4 + f) * s, (4.2 + f) * s);
  ctx.fillStyle = '#f5a53a'; ellipse(ctx, x, y - 0.3 * s, (2.2 + f * 0.6) * s, (2.8 + f * 0.6) * s);
  ctx.fillStyle = '#ffe28a'; ellipse(ctx, x, y, 1.1 * s, 1.5 * s);
}

export function drawTrap(ctx, t, px, lod) {
  const x = t.x * T, y = t.y * T;
  ctx.fillStyle = 'rgba(40, 30, 20, 0.35)';
  rrect(ctx, x + 2, y + 2, T - 4, T - 4, 1.5); ctx.fill();
  ctx.strokeStyle = '#5a4128'; ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 2.5, y + 2.5, T - 5, T - 5);
  ctx.fillStyle = t.armed ? '#c8ccd0' : 'rgba(150, 60, 50, 0.8)';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const cx = x + 4.5 + i * 3.5, cy = y + 4.5 + j * 3.5;
    ctx.beginPath();
    if (t.armed) { ctx.moveTo(cx, cy - 1.6); ctx.lineTo(cx + 1.2, cy + 1.2); ctx.lineTo(cx - 1.2, cy + 1.2); }
    else { ctx.ellipse(cx, cy, 1.2, 0.6, 0.6, 0, TAU); }
    ctx.fill();
  }
}

export function drawWorkbench(ctx, t, px, lod) {
  const x = t.x * T, y = t.y * T;
  ctx.fillStyle = SHADOW; rrect(ctx, x + 3, y + 4, T - 2, T - 4, 2); ctx.fill();
  ctx.fillStyle = '#7c6a55'; rrect(ctx, x + 1, y + 2, T - 2, T - 4, 1.5); ctx.fill(); outline(ctx, px, '#3e3326');
  ctx.fillStyle = '#9aa3ab'; ctx.fillRect(x + 2.5, y + 3.5, 4, 3); // vise
  ctx.strokeStyle = '#c9d2d9'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + 9, y + 5); ctx.lineTo(x + 13.5, y + 9); ctx.stroke(); // tool
  ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x + 9, y + 9.5, 4.5, 2);
}

export function drawBurnPit(ctx, t, now, px) {
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  ctx.fillStyle = '#5b5750'; circle(ctx, cx, cy, 7.2);
  ctx.fillStyle = '#2a2622'; circle(ctx, cx, cy, 5.2);
  ctx.fillStyle = '#4a3a30'; circle(ctx, cx - 1, cy + 1, 2.4);
  drawFlame(ctx, cx, cy, 0.8, now + t.id * 100);
  // Smoke drifting up and fading.
  for (let i = 0; i < 3; i++) {
    const k = ((now / 1800 + i / 3) % 1);
    ctx.fillStyle = `rgba(120, 120, 120, ${0.28 * (1 - k)})`;
    circle(ctx, cx + Math.sin(k * 5 + i) * 2 + k * 3, cy - 3 - k * 12, 2 + k * 4);
  }
}

export function drawGuardPost(ctx, t, px, lod) {
  const x = t.x * T, y = t.y * T;
  ctx.fillStyle = SHADOW; ctx.fillRect(x + 3, y + 4, T, T);
  ctx.fillStyle = '#8a6a44'; ctx.fillRect(x - 0.5, y - 0.5, T + 1, T + 1);
  ctx.strokeStyle = 'rgba(50, 32, 16, 0.45)'; ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) { ctx.moveTo(x, y + i * 4); ctx.lineTo(x + T, y + i * 4); }
  ctx.stroke();
  ctx.strokeStyle = '#4a3520'; ctx.lineWidth = 1.4;
  ctx.strokeRect(x - 0.5, y - 0.5, T + 1, T + 1);
  ctx.fillStyle = '#4a3520';
  for (const [dx, dy] of [[0, 0], [T, 0], [0, T], [T, T]]) circle(ctx, x + dx - (dx ? 0.5 : -0.5), y + dy - (dy ? 0.5 : -0.5), 1.4);
}

export function drawBlueprint(ctx, t, px, fraction) {
  const x = t.x * T, y = t.y * T;
  ctx.fillStyle = 'rgba(96, 164, 255, 0.2)';
  ctx.fillRect(x + 1.5, y + 1.5, T - 3, T - 3);
  ctx.strokeStyle = 'rgba(140, 195, 255, 0.95)';
  ctx.lineWidth = 1.3 * px;
  ctx.setLineDash([3 * px, 2.5 * px]);
  ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
  ctx.setLineDash([]);
  if (fraction > 0) {
    ctx.fillStyle = 'rgba(140, 195, 255, 0.95)';
    ctx.fillRect(x + 3, y + T - 4.5, (T - 6) * fraction, 1.6);
  }
}

// Little round badges marking designations.
const BADGES = { chop: '#e0553f', mine: '#e8b33b', harvest: '#62b845', salvage: '#e8893b' };
export function drawBadge(ctx, t, kind, px) {
  const x = (t.x + 0.82) * T, y = (t.y + 0.2) * T;
  ctx.fillStyle = BADGES[kind] ?? '#fff';
  circle(ctx, x, y, 3.3);
  ctx.beginPath(); ctx.arc(x, y, 3.3, 0, TAU); outline(ctx, px, '#fff', 1.2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'chop') { ctx.moveTo(x - 1.6, y + 1.6); ctx.lineTo(x + 1.2, y - 1.2); ctx.moveTo(x + 0.2, y - 1.9); ctx.lineTo(x + 1.9, y - 0.2); }
  else if (kind === 'mine') { ctx.arc(x, y + 1.6, 2.2, Math.PI * 1.2, Math.PI * 1.8); ctx.moveTo(x, y - 0.6); ctx.lineTo(x, y + 2); }
  else if (kind === 'harvest') { ctx.ellipse(x, y, 1.1, 2, 0.7, 0, TAU); }
  else { ctx.arc(x - 0.6, y - 0.6, 1.1, 0, TAU); ctx.moveTo(x, y); ctx.lineTo(x + 1.7, y + 1.7); }
  ctx.stroke();
}

export function drawBar(ctx, x, y, width, frac, color, px) {
  ctx.fillStyle = 'rgba(12, 14, 18, 0.75)';
  rrect(ctx, x - width / 2 - px, y - px, width + 2 * px, 2.2 + 2 * px, 1.2);
  ctx.fill();
  ctx.fillStyle = color;
  rrect(ctx, x - width / 2, y, Math.max(0.1, width * Math.max(0, Math.min(1, frac))), 2.2, 1);
  ctx.fill();
}

export function drawLabel(ctx, text, x, y, color = '#fff') {
  ctx.font = '600 5.2px system-ui, sans-serif';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(14, 16, 20, 0.62)';
  rrect(ctx, x - tw / 2 - 2, y - 3.4, tw + 4, 6.6, 3.2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.1);
}

// Lighten (+) / darken (-) a #rrggbb color.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
