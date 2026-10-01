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

// Canopy colors [base, highlight] by season. About a third of trees are evergreens and stay green.
const EVERGREEN = ['#2f6440', '#40805a'];
const DECIDUOUS = {
  Spring: [['#3e763b', '#5a9a4c'], ['#366c38', '#4f8f45']],
  Summer: [['#366c38', '#4a8a45'], ['#3e763b', '#539248']],
  Autumn: [['#b8652a', '#d88a3c'], ['#a8792c', '#d0a445']],
  Winter: [['#6e6356', '#857a6c'], ['#645a4f', '#7a7064']],
};

export function drawTree(ctx, t, px, lod, season = 'Summer') {
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  const h = hash(t.id);
  const bare = season === 'Winter' && h >= 0.33;
  const r = 7.6 * (0.45 + 0.55 * t.growth) * (bare ? 0.8 : 1);
  const ox = (h - 0.5) * 2.4, oy = (hash(t.id + 7) - 0.5) * 2.4; // break up the grid
  const [base, light] = h < 0.33 ? EVERGREEN : DECIDUOUS[season][h < 0.66 ? 0 : 1];
  ctx.fillStyle = SHADOW;
  ellipse(ctx, cx + ox + 2.6, cy + oy + 3.3, r * 1.02, r * 0.86);
  ctx.fillStyle = base;
  circle(ctx, cx + ox, cy + oy, r);
  if (bare && lod > 0) { // winter branches instead of leaves
    ctx.strokeStyle = '#4a3f35'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + h * 3; ctx.moveTo(cx + ox, cy + oy); ctx.lineTo(cx + ox + Math.cos(a) * r * 0.85, cy + oy + Math.sin(a) * r * 0.85); }
    ctx.stroke();
  } else if (lod > 0) {
    ctx.fillStyle = light;
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
    case 'ammo': // an olive ammo box with brass showing
      ctx.fillStyle = '#5d6b3a'; rrect(ctx, cx - 5, cy - 3.2, 10, 7, 1.2); ctx.fill(); outline(ctx, px, '#343d20');
      ctx.fillStyle = '#48532c'; ctx.fillRect(cx - 5, cy - 3.2, 10, 1.8);
      ctx.fillStyle = d.color;
      for (let k = 0; k < 4; k++) circle(ctx, cx - 3 + k * 2, cy + 1, 0.8);
      break;
    case 'biofuel': // a jerry can
      ctx.fillStyle = '#6f8f2e'; rrect(ctx, cx - 3.6, cy - 4, 7.2, 8.6, 1.2); ctx.fill(); outline(ctx, px, '#3c5018');
      ctx.strokeStyle = '#3c5018'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx - 2.4, cy - 2.6); ctx.lineTo(cx + 2.4, cy + 3); ctx.moveTo(cx + 2.4, cy - 2.6); ctx.lineTo(cx - 2.4, cy + 3); ctx.stroke();
      ctx.fillStyle = '#c9b24a'; ctx.fillRect(cx + 1.2, cy - 5.4, 1.8, 1.6);
      break;
    case 'components': // a salvaged circuit board
      ctx.fillStyle = '#2f6f63'; rrect(ctx, cx - 4.6, cy - 3.6, 9.2, 7.2, 1); ctx.fill(); outline(ctx, px, '#1c4038');
      ctx.fillStyle = '#1f2326'; ctx.fillRect(cx - 1.6, cy - 1.6, 3.2, 3.2);
      ctx.fillStyle = '#d8b25a';
      for (const [dx, dy] of [[-3.4, -2.4], [-3.4, 2], [3, -2.4], [3, 2]]) circle(ctx, cx + dx, cy + dy, 0.6);
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
  fence: ['#8f99a3', '#3e454c'],
  electricFence: ['#a7a07a', '#4a452c'],
};
const WALL_W = 0.66 * T;
const isFence = (k) => k === 'fence' || k === 'electricFence';
const wallWidth = (k) => (k === 'barricade' ? 0.4 * T : isFence(k) ? 0.1 * T : WALL_W);

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
  // Fences are see-through: a faint mesh band under the wire instead of a solid shadow.
  for (const k in groups) {
    if (!isFence(k)) continue;
    ctx.strokeStyle = 'rgba(190, 200, 210, 0.22)';
    ctx.lineWidth = 0.34 * T;
    ctx.stroke(groups[k]);
  }
  ctx.save();
  ctx.translate(2, 3);
  ctx.strokeStyle = SHADOW;
  for (const k in groups) { if (isFence(k)) continue; ctx.lineWidth = wallWidth(k); ctx.stroke(groups[k]); }
  ctx.restore();
  for (const k in groups) { ctx.strokeStyle = WALL_COLORS[k][1]; ctx.lineWidth = wallWidth(k) + 2.2 * px; ctx.stroke(groups[k]); }
  for (const k in groups) { ctx.strokeStyle = WALL_COLORS[k][0]; ctx.lineWidth = wallWidth(k); ctx.stroke(groups[k]); }
  if (lod > 0) {
    ctx.save();
    ctx.translate(-0.8, -1);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
    for (const k in groups) { if (k === 'barricade' || isFence(k)) continue; ctx.lineWidth = WALL_W * 0.34; ctx.stroke(groups[k]); }
    ctx.restore();
    if (groups.barricade) { // plank seams read as "low fence", not "wall"
      ctx.strokeStyle = 'rgba(40, 26, 12, 0.55)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2.2, 2.2]);
      ctx.stroke(groups.barricade);
      ctx.setLineDash([]);
    }
  }
  // Fence posts (and yellow insulators on electric fences).
  for (const t of walls) {
    if (!isFence(t.def)) continue;
    const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
    ctx.fillStyle = '#3e454c';
    circle(ctx, cx, cy, 1.5);
    if (t.def === 'electricFence') { ctx.fillStyle = '#f2d24a'; circle(ctx, cx, cy, 0.8); }
  }
  ctx.lineCap = 'butt';
}

export function drawDoor(ctx, t, horizontal, open, px) {
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  ctx.save();
  ctx.translate(cx, cy);
  if (!horizontal) ctx.rotate(Math.PI / 2);
  if (t.def === 'gate') { // steel frame with bars; swings aside when open
    ctx.strokeStyle = '#3e454c'; ctx.lineWidth = 1.4;
    ctx.fillStyle = '#3e454c';
    ctx.fillRect(-T / 2, -1.8, 1.8, 3.6); ctx.fillRect(T / 2 - 1.8, -1.8, 1.8, 3.6);
    ctx.strokeStyle = '#a7b0b8'; ctx.lineWidth = 1.1;
    ctx.beginPath();
    if (open) { ctx.moveTo(-T / 2 + 1.8, 0); ctx.lineTo(-T / 2 + 1.8 + (T - 4) * 0.35, -(T - 4) * 0.9); }
    else { ctx.moveTo(-T / 2 + 1.8, 0); ctx.lineTo(T / 2 - 1.8, 0); for (let k = 1; k < 4; k++) { const x = -T / 2 + 1.8 + k * (T - 3.6) / 4; ctx.moveTo(x, -1.6); ctx.lineTo(x, 1.6); } }
    ctx.stroke();
    ctx.restore();
    return;
  }
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

// Footprint-aware (2×1, rotatable). sw/sh in cells.
export function drawTable(ctx, t, px, lod, sw = 1, sh = 1) {
  const x = t.x * T, y = t.y * T, W = sw * T, H = sh * T;
  ctx.fillStyle = SHADOW; rrect(ctx, x + 3, y + 4, W - 2, H - 4, 2); ctx.fill();
  ctx.fillStyle = '#a57a4c'; rrect(ctx, x + 1, y + 1.5, W - 2, H - 3, 2); ctx.fill(); outline(ctx, px, '#5b3d24');
  if (lod > 1) { // planks run the long way
    ctx.strokeStyle = 'rgba(80, 50, 25, 0.35)'; ctx.lineWidth = px;
    ctx.beginPath();
    if (W >= H) for (const k of [1 / 3, 2 / 3]) { ctx.moveTo(x + 2, y + H * k); ctx.lineTo(x + W - 2, y + H * k); }
    else for (const k of [1 / 3, 2 / 3]) { ctx.moveTo(x + W * k, y + 2); ctx.lineTo(x + W * k, y + H - 2); }
    ctx.stroke();
  }
}

export function drawCampfire(ctx, t, now, px, lit = true) {
  const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
  ctx.fillStyle = '#3b3530'; circle(ctx, cx, cy, 5.2);
  ctx.fillStyle = '#8d8a84';
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; circle(ctx, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 1.6); }
  ctx.strokeStyle = lit ? '#5e3c22' : '#2e2622'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 3.5, cy - 2.5); ctx.lineTo(cx + 3.5, cy + 2.5); ctx.moveTo(cx - 3.5, cy + 2.5); ctx.lineTo(cx + 3.5, cy - 2.5); ctx.stroke();
  if (lit) drawFlame(ctx, cx, cy, 1, now + t.id * 100);
}

// Squat iron stove with a glowing window and a flue pipe.
export function drawStove(ctx, t, now, px, lit = true) {
  const x = t.x * T, y = t.y * T;
  ctx.fillStyle = SHADOW; rrect(ctx, x + 3.5, y + 4, T - 4, T - 4, 2); ctx.fill();
  ctx.fillStyle = '#3d3f44'; rrect(ctx, x + 2, y + 2, T - 4, T - 4, 2); ctx.fill(); outline(ctx, px, '#17181b');
  ctx.fillStyle = lit ? `rgba(255, ${150 + Math.sin(now / 90 + t.id) * 20 | 0}, 60, 0.95)` : '#232427';
  rrect(ctx, x + 4.5, y + 7.5, T - 9, 4.5, 1); ctx.fill();
  ctx.fillStyle = '#5a5d63'; circle(ctx, x + T - 5, y + 5, 1.8);
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

// ---- Machines (Phase 3) ----------------------------------------------------------------
// state: { on (powered & wanted), running, broken, powered }
export function drawMachine(ctx, t, now, px, lod, sw, sh, state) {
  const x = t.x * T, y = t.y * T, W = sw * T, H = sh * T, cx = x + W / 2, cy = y + H / 2;
  const box = (fill, edge = '#1d2024', r = 2) => { rrect(ctx, x + 1.5, y + 1.5, W - 3, H - 3, r); ctx.fillStyle = fill; ctx.fill(); outline(ctx, px, edge, 1.2); };
  const shadow = () => { ctx.fillStyle = SHADOW; rrect(ctx, x + 3, y + 4, W - 3, H - 3, 2); ctx.fill(); };
  const shake = state.running ? Math.sin(now / 35 + t.id) * 0.35 : 0;
  switch (t.def) {
    case 'powerPole': {
      ctx.fillStyle = SHADOW; circle(ctx, cx + 1.5, cy + 2, 2.4);
      ctx.fillStyle = '#6b4a2e'; circle(ctx, cx, cy, 2);
      ctx.strokeStyle = '#4a3520'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - 4.5, cy); ctx.lineTo(cx + 4.5, cy); ctx.stroke();
      ctx.fillStyle = state.powered ? '#f2d24a' : '#6d6f73'; circle(ctx, cx - 4.5, cy, 0.9); circle(ctx, cx + 4.5, cy, 0.9);
      break;
    }
    case 'generator': {
      shadow();
      ctx.save(); ctx.translate(shake, 0);
      box('#8a5a2e', '#2f2014');
      ctx.fillStyle = '#3a3d42'; rrect(ctx, x + 5, y + 5, W - 14, H - 10, 2); ctx.fill();
      ctx.fillStyle = '#2a2c30'; circle(ctx, x + W - 6, y + 6, 2.6); // exhaust
      ctx.restore();
      if (state.running) for (let i = 0; i < 3; i++) { const k = (now / 900 + i / 3) % 1; ctx.fillStyle = `rgba(90,90,90,${0.35 * (1 - k)})`; circle(ctx, x + W - 6 + k * 4, y + 6 - k * 12, 1.5 + k * 3); }
      break;
    }
    case 'solarPanel': {
      shadow(); box('#1f3552', '#0f1a29', 1);
      ctx.strokeStyle = 'rgba(160, 200, 240, 0.35)'; ctx.lineWidth = 0.7; ctx.beginPath();
      for (let k = 1; k < 4; k++) { ctx.moveTo(x + 1.5 + (W - 3) * k / 4, y + 2); ctx.lineTo(x + 1.5 + (W - 3) * k / 4, y + H - 2); ctx.moveTo(x + 2, y + 1.5 + (H - 3) * k / 4); ctx.lineTo(x + W - 2, y + 1.5 + (H - 3) * k / 4); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + W * 0.45, y + 3); ctx.lineTo(x + 3, y + H * 0.45); ctx.fill();
      break;
    }
    case 'battery': {
      shadow(); box('#2f3a33', '#141a16');
      const f = Math.max(0, Math.min(1, (t.charge ?? 0) / 1500));
      const vertical = H > W;
      ctx.fillStyle = '#1a1f1b'; vertical ? ctx.fillRect(cx - 2.5, y + 4, 5, H - 8) : ctx.fillRect(x + 4, cy - 2.5, W - 8, 5);
      ctx.fillStyle = f > 0.2 ? '#7ed957' : '#e0a23a';
      vertical ? ctx.fillRect(cx - 2.5, y + 4 + (H - 8) * (1 - f), 5, (H - 8) * f) : ctx.fillRect(x + 4, cy - 2.5, (W - 8) * f, 5);
      break;
    }
    case 'floodlight': {
      ctx.fillStyle = SHADOW; circle(ctx, cx + 1.5, cy + 2, 3);
      ctx.fillStyle = '#3a3d42'; circle(ctx, cx, cy, 2.6);
      ctx.fillStyle = state.on ? '#fff3c4' : '#6d6f73'; rrect(ctx, cx - 3.5, cy - 5.5, 7, 3.5, 1); ctx.fill();
      break;
    }
    case 'siren': {
      ctx.fillStyle = SHADOW; circle(ctx, cx + 1.5, cy + 2, 3.5);
      ctx.fillStyle = '#b8453a'; circle(ctx, cx, cy, 3.4);
      ctx.fillStyle = '#e8e2d4'; circle(ctx, cx, cy, 1.4);
      if (state.running) for (let i = 0; i < 2; i++) { const k = (now / 700 + i / 2) % 1; ctx.strokeStyle = `rgba(255, 110, 90, ${0.7 * (1 - k)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, 4 + k * 14, 0, TAU); ctx.stroke(); }
      break;
    }
    case 'autoTurret': {
      ctx.fillStyle = SHADOW; circle(ctx, cx + 1.8, cy + 2.4, 6);
      ctx.fillStyle = '#4b5057'; circle(ctx, cx, cy, 5.6);
      ctx.beginPath(); ctx.arc(cx, cy, 5.6, 0, TAU); outline(ctx, px, '#1d2024', 1.2);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t.aim ?? -Math.PI / 2);
      ctx.fillStyle = '#2a2d31'; rrect(ctx, -2.6, -2.6, 5.2, 5.2, 1); ctx.fill();
      ctx.strokeStyle = '#1d2024'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(8.5, -1); ctx.moveTo(2, 1); ctx.lineTo(8.5, 1); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = state.on ? '#7ed957' : '#e05a4a'; circle(ctx, cx - 3.2, cy + 3.2, 0.9);
      break;
    }
    case 'ammoPress': {
      shadow();
      ctx.save(); ctx.translate(0, state.running ? Math.abs(Math.sin(now / 160)) * -0.8 : 0);
      box('#6e7479', '#26292c');
      ctx.fillStyle = '#3a3d42'; rrect(ctx, cx - 5, cy - 5, 10, 10, 1.5); ctx.fill();
      ctx.fillStyle = '#d6ad45'; for (let k = 0; k < 3; k++) circle(ctx, x + 5 + k * 3, y + H - 5, 1.1);
      ctx.restore();
      break;
    }
    case 'renderVat': {
      shadow(); box('#50614a', '#1e261c', 4);
      const vertical = H > W;
      ctx.fillStyle = state.running ? `rgba(150, 190, 60, ${0.75 + Math.sin(now / 300) * 0.1})` : 'rgba(110, 130, 70, 0.7)';
      vertical ? ellipse(ctx, cx, cy, 4, H / 2 - 5) : ellipse(ctx, cx, cy, W / 2 - 5, 4);
      if (state.running) { ctx.fillStyle = 'rgba(210, 240, 140, 0.6)'; circle(ctx, cx + Math.sin(now / 200) * 3, cy, 0.9); }
      break;
    }
  }
  if (state.broken) { // wrecked: dark wash and a red cross
    ctx.fillStyle = 'rgba(20, 10, 10, 0.45)'; rrect(ctx, x + 1, y + 1, W - 2, H - 2, 2); ctx.fill();
    ctx.strokeStyle = '#e05a4a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx - 3, cy - 3); ctx.lineTo(cx + 3, cy + 3); ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx - 3, cy + 3); ctx.stroke();
  } else if (state.unpowered && lod > 0) { // wants power but has none: small crossed-bolt badge
    const bx = x + W - 3.5, by = y + 3.5;
    ctx.fillStyle = 'rgba(20, 22, 26, 0.85)'; circle(ctx, bx, by, 2.8);
    ctx.fillStyle = '#e0a23a'; ctx.beginPath(); ctx.moveTo(bx + 0.4, by - 2); ctx.lineTo(bx - 1.2, by + 0.3); ctx.lineTo(bx, by + 0.3); ctx.lineTo(bx - 0.4, by + 2); ctx.lineTo(bx + 1.2, by - 0.3); ctx.lineTo(bx, by - 0.3); ctx.closePath(); ctx.fill();
  }
}

export function drawBlueprint(ctx, t, px, fraction, sw = 1, sh = 1) {
  const x = t.x * T, y = t.y * T, W = sw * T, H = sh * T;
  ctx.fillStyle = 'rgba(96, 164, 255, 0.2)';
  ctx.fillRect(x + 1.5, y + 1.5, W - 3, H - 3);
  ctx.strokeStyle = 'rgba(140, 195, 255, 0.95)';
  ctx.lineWidth = 1.3 * px;
  ctx.setLineDash([3 * px, 2.5 * px]);
  ctx.strokeRect(x + 1.5, y + 1.5, W - 3, H - 3);
  ctx.setLineDash([]);
  if (fraction > 0) {
    ctx.fillStyle = 'rgba(140, 195, 255, 0.95)';
    ctx.fillRect(x + 3, y + H - 4.5, (W - 6) * fraction, 1.6);
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

// What a survivor is carrying, held in front of them: the item's own sprite at about half size,
// or a colored dot when zoomed far out (brass = rounds, red = fuel, brown = wood).
const CARRY_DOT = { ammo: '#d6ad45', biofuel: '#e0573d', wood: '#9a6a3a' };
export function drawCarried(ctx, carrying, x, y, facing, px, lod) {
  const hx = x + Math.cos(facing) * T * 0.35, hy = y + Math.sin(facing) * T * 0.35 + 1.5;
  if (lod === 0) {
    ctx.fillStyle = CARRY_DOT[carrying.def] ?? '#b9bcc2';
    circle(ctx, hx, hy, Math.max(1.6, 2.2 * px));
    return;
  }
  const s = 0.55;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.scale(s, s);
  drawItem(ctx, { id: 0, def: carrying.def, count: 1, x: -0.5, y: -0.5, ...(carrying.props ?? {}) }, px / s, lod);
  ctx.restore();
}

// A fill ring around anything haulers keep supplied (turret rounds, generator or stove fuel):
// green above half, amber below, and a slow red pulse when empty.
export function drawSupplyRing(ctx, t, frac, now, px, sw = 1, sh = 1) {
  const cx = (t.x + sw / 2) * T, cy = (t.y + sh / 2) * T;
  const r = (Math.max(sw, sh) * T) / 2 + 1.8;
  const lw = Math.max(1.3, 2 * px);
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = 'rgba(10, 12, 16, 0.3)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  if (frac <= 0) {
    ctx.strokeStyle = `rgba(239, 91, 75, ${0.55 + 0.45 * Math.sin((now / 1000) * TAU)})`; // 1 Hz pulse
    ctx.lineWidth = lw * 1.3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    return;
  }
  ctx.strokeStyle = frac > 0.5 ? '#8fdc6a' : '#f0c14b';
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, frac)); ctx.stroke();
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
