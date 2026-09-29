// Boot + fixed-timestep loop. The sim runs in whole ticks (60/s at 1x); rendering is
// decoupled and interpolates pawn movement.
//
// Boot order: ?seed=N → fresh game with that seed. Otherwise a "boot" request from the menu
// (load a slot / start new), otherwise resume the autosave, otherwise a fresh random game.

import { TICKS_PER_SECOND, TICKS_PER_HOUR, SPEEDS, TILE } from './config.js';
import { newGame, tickWorld } from './sim.js';
import { loadGame, saveGame } from './save.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { icon } from './icons.js';
import { colonists, letter } from './world.js';

const params = new URLSearchParams(location.search);
// Storage can be blocked (private browsing, embedded frames); the game still boots without it.
let boot = null;
try {
  boot = sessionStorage.getItem('holdout.boot');
  sessionStorage.removeItem('holdout.boot');
} catch { /* no session storage */ }
const randomSeed = () => Math.floor(Math.random() * 1e9);

let w = null;
if (params.has('seed')) w = newGame(+params.get('seed') || randomSeed());
else if (boot === 'new') w = newGame(randomSeed());
else w = loadGame(boot ?? 'auto');
if (!w) w = newGame(randomSeed());
else if (!params.has('seed') && boot !== 'new') letter(w, 'Welcome back.', 'neutral');

const renderer = createRenderer(document.getElementById('view'), w);
const ui = createUI(w, renderer);
document.getElementById('menuBtn').innerHTML = icon('help');

// Start centered on camp, ~34 cells across (closer on small screens).
const { W } = renderer.size();
const home = colonists(w)[0] ?? { x: w.w / 2, y: w.h / 2 };
renderer.cam.zoom = Math.min(3, Math.max(1.3, W / (34 * TILE)));
renderer.cam.x = (home.x + 0.5) * TILE;
renderer.cam.y = (home.y + 1) * TILE;

// Autosave every few in-game hours, and whenever the app goes to the background
// (iPad may kill a backgrounded page without warning).
const AUTOSAVE_EVERY = 6 * TICKS_PER_HOUR;
let lastAutosave = w.tick;
const autosave = () => { if (colonists(w).length) saveGame(w, 'auto'); lastAutosave = w.tick; };
document.addEventListener('visibilitychange', () => { if (document.hidden) autosave(); });
window.addEventListener('pagehide', autosave);

const MAX_TICKS_PER_FRAME = 60; // on a slow frame at 6x, drop time rather than spiral
let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += dt * TICKS_PER_SECOND * SPEEDS[w.speed];
  let n = 0;
  while (acc >= 1 && n < MAX_TICKS_PER_FRAME) {
    tickWorld(w);
    acc -= 1;
    n++;
  }
  if (n === MAX_TICKS_PER_FRAME) acc = 0;
  if (w.tick - lastAutosave >= AUTOSAVE_EVERY) autosave();
  ui.update(dt, now);
  renderer.draw(ui, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Console access for debugging: holdout.w, holdout.debug.horde(), ?seed=123 in the URL.
window.holdout = { w, ui, renderer, debug: ui.debug, seed: w.seed };
