// Touch-first HUD and panels. The player never commands a survivor: every tool here only
// designates, places blueprints, draws zones, or tweaks priorities, policies and bills.
//
// Layout (docs/DESIGN.md §11): time + roster + alerts on top, tool dock bottom-center,
// inspector on the right (bottom sheet on narrow screens), letters top-left (tap to jump).

import { TILE, MEDICAL } from './config.js';
import { THINGS, WORK_TYPES, SKILLS, TRAITS, RECIPES, SCHEDULE_SLOTS, CROPS, canSalvage, ingKey } from './defs.js';
import {
  inBounds, idx, thingsAt, plantAt, buildingAt, blueprintAt, itemAt, passable, terrainAt, spawn, despawn, spawnItem,
  dateParts, colonists, dayOf, hourOf, countOwned, isNight, letter,
} from './world.js';
import { addZoneCells, removeZoneCells, STOCK_PRIORITIES } from './zones.js';
import { moodBreakdown, breakThresholds } from './mood.js';
import { xpToNext, isGentle } from './pawn.js';
import { weaponOf } from './combat.js';
import { isTended } from './medical.js';
import { setAlarm } from './think.js';
import { threatPoints, debugIncidents, colonyCenter } from './director.js';
import { saveGame, saveInfo } from './save.js';
import { createInput } from './input.js';
import { icon } from './icons.js';

const T = TILE;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pct = (v) => Math.round(v * 100);
const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v * 100))}%"></i></div>`;
const costText = (cost) => Object.entries(cost).map(([k, n]) => `${n} ${THINGS[k].label.toLowerCase()}`).join(', ');
const ingText = (r) => r.ingredients.map((i) => `${i.count} ${i.def ? THINGS[i.def].label.toLowerCase() : i.tag === 'rawFood' ? 'raw food' : i.tag}`).join(' + ');

const BUILD_HINTS = {
  wall: 'Drag a rectangle; walls go around the edge. Zombies must bash through.',
  stoneWall: 'Drag a rectangle. Tough walls; needs mined stone.',
  scrapWall: 'Drag a rectangle. Sturdy walls from salvaged scrap.',
  barricade: 'Drag a line. Blocks zombies, but survivors can see and shoot over it.',
  door: 'Survivors walk through doors. Zombies can’t; they bash them.',
  spikeTrap: 'Hurts the first zombie that steps on it. Builders re-arm it. Survivors avoid them.',
  guardPost: 'A survivor on watch here sees and shoots farther. Guard shifts and the alarm send fighters here.',
  torch: 'Light for the night. Tap to place, or drag a row.',
  bed: 'Sleep, healing, and treatment. Tap to place, or drag a row.',
  table: 'Eating at a table keeps spirits up.',
  campfire: 'Cooks raw food into meals. Set bills in the inspector.',
  workbench: 'Makes ammo, machetes, and guns from scrap. Add bills in the inspector.',
  burnPit: 'Burns bodies so they can never rise. Haulers bring the dead here.',
};

export function createUI(w, r) {
  const $ = (id) => document.getElementById(id);
  const ui = { tool: null, selected: null, drag: null, hover: null, ripples: [], openCat: null, workTab: 'priorities', paintSlot: 'guard' };

  // ---- Tools ----------------------------------------------------------------

  const canPlace = (x, y) => inBounds(w, x, y) && passable(w, x, y) && !terrainAt(w, x, y).noZone && !buildingAt(w, x, y) && !blueprintAt(w, x, y);
  const designate = (kind, pick) => ({
    shape: 'rect',
    ok: (x, y) => !!pick(x, y),
    apply: (cells) => { for (const [x, y] of cells) { const t = pick(x, y); if (t) t.designation = kind; } },
  });
  const plantPick = (x, y) => plantAt(w, x, y);
  const harvestPick = (x, y) => { const p = plantAt(w, x, y); return p && !THINGS[p.def].woody && THINGS[p.def].yield ? p : null; };
  const minePick = (x, y) => { const b = buildingAt(w, x, y); return b && THINGS[b.def].mineWork ? b : null; };
  const salvagePick = (x, y) => { const b = buildingAt(w, x, y); return b && canSalvage(THINGS[b.def]) ? b : null; };
  const build = (def) => ({
    key: `build:${def}`, label: THINGS[def].label, icon: iconFor(def), cost: costText(THINGS[def].cost), hint: BUILD_HINTS[def],
    shape: THINGS[def].wallLike && def !== 'barricade' ? 'outline' : 'line',
    ok: canPlace,
    apply: (cells) => { for (const [x, y] of cells) if (canPlace(x, y)) spawn(w, 'blueprint', x, y, { builds: def, stock: {} }); },
  });
  const zone = (type) => ({
    shape: 'rect',
    ok: (x, y) => inBounds(w, x, y) && !w.zoneAt[idx(w, x, y)] && passable(w, x, y) && !terrainAt(w, x, y).noZone && (type !== 'grow' || terrainAt(w, x, y).fertility >= 0.5),
    apply: (cells) => { const z = addZoneCells(w, type, cells); if (z) ui.selected = { zone: z }; },
  });

  const CATEGORIES = [
    { key: 'orders', label: 'Orders', icon: 'orders', tools: [
      { key: 'chop', label: 'Chop', icon: 'axe', hotkey: 'c', hint: 'Drag over trees and plants to cut them down.', ...designate('chop', plantPick) },
      { key: 'harvest', label: 'Harvest', icon: 'basket', hotkey: 'h', hint: 'Drag over bushes and herbs; they’re picked when ripe.', ...designate('harvest', harvestPick) },
      { key: 'mine', label: 'Mine', icon: 'pick', hotkey: 'm', hint: 'Drag over rock to quarry stone blocks.', ...designate('mine', minePick) },
      { key: 'salvage', label: 'Salvage', icon: 'wrench', hotkey: 'v', hint: 'Drag over wrecks, ruins, or your own buildings to take them apart.', ...designate('salvage', salvagePick) },
      { key: 'cancel', label: 'Cancel', icon: 'cancel', hotkey: 'x', hint: 'Drag to clear orders and blueprints.', shape: 'rect',
        ok: (x, y) => inBounds(w, x, y) && thingsAt(w, x, y).some((t) => t.designation || THINGS[t.def].kind === 'blueprint'),
        apply: (cells) => cells.forEach(([x, y]) => cancelAt(x, y)) },
    ] },
    { key: 'build', label: 'Build', icon: 'build', tools: ['wall', 'stoneWall', 'scrapWall', 'barricade', 'door', 'spikeTrap', 'guardPost', 'torch'].map(build) },
    { key: 'furnish', label: 'Furnish', icon: 'bed', tools: ['bed', 'table', 'campfire', 'workbench', 'burnPit'].map(build) },
    { key: 'zones', label: 'Zones', icon: 'zones', tools: [
      { key: 'zone:stockpile', label: 'Stockpile', icon: 'stockpile', hotkey: 'z', hint: 'Drag an area. Haulers bring items here.', ...zone('stockpile') },
      { key: 'zone:grow', label: 'Grow', icon: 'grow', hotkey: 'g', hint: 'Drag over soil. Growers sow and harvest here. Pick the crop in the inspector.', ...zone('grow') },
      { key: 'zone:shelter', label: 'Shelter', icon: 'shelter', hint: 'Where survivors set to Flee run when zombies appear or the alarm sounds. Put it behind walls.', ...zone('shelter') },
      { key: 'zone:remove', label: 'Remove', icon: 'eraser', hint: 'Drag to erase zones.', shape: 'rect', ok: (x, y) => inBounds(w, x, y) && !!w.zoneAt[idx(w, x, y)], apply: (cells) => removeZoneCells(w, cells) },
    ] },
  ];
  const TOOL = Object.fromEntries(CATEGORIES.flatMap((c) => c.tools.map((t) => [t.key, t])));

  function iconFor(def) {
    return { wall: 'wall', stoneWall: 'stoneWall', scrapWall: 'scrapWall', door: 'door', bed: 'bed', table: 'table', campfire: 'campfire', torch: 'torch' }[def] ?? def;
  }

  function cancelAt(x, y) {
    for (const t of [...thingsAt(w, x, y)]) {
      t.designation = null;
      if (THINGS[t.def].kind !== 'blueprint') continue;
      despawn(w, t);
      for (const [def, n] of Object.entries(t.stock)) if (n > 0) spawnItem(w, def, n, x, y);
    }
  }

  function toolCells(tool, d) {
    const rect = { x0: Math.min(d.x0, d.x1), y0: Math.min(d.y0, d.y1), x1: Math.max(d.x0, d.x1), y1: Math.max(d.y0, d.y1) };
    const cells = [];
    if (tool.shape === 'line') {
      // Bresenham from start to finger.
      let x = d.x0, y = d.y0;
      const dx = Math.abs(d.x1 - x), dy = -Math.abs(d.y1 - y), sx = x < d.x1 ? 1 : -1, sy = y < d.y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        cells.push([x, y]);
        if (x === d.x1 && y === d.y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
    } else {
      for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) {
        if (tool.shape !== 'outline' || y === rect.y0 || y === rect.y1 || x === rect.x0 || x === rect.x1) cells.push([x, y]);
      }
    }
    return { rect, cells: cells.filter(([x, y]) => inBounds(w, x, y)) };
  }

  ui.preview = () => {
    const tool = TOOL[ui.tool];
    if (!tool) return null;
    const d = ui.drag ?? (ui.hover && { x0: ui.hover.x, y0: ui.hover.y, x1: ui.hover.x, y1: ui.hover.y });
    if (!d) return null;
    const { rect, cells } = toolCells(tool, d);
    return { cells: cells.map(([x, y]) => ({ x, y, ok: tool.ok(x, y) })), rect: ui.drag && tool.shape !== 'line' ? rect : null };
  };

  function applyTool(d) {
    const tool = TOOL[ui.tool];
    if (tool) tool.apply(toolCells(tool, d).cells);
  }

  function setTool(key) {
    ui.tool = key && TOOL[key] ? key : null;
    ui.drag = null;
    const tool = TOOL[ui.tool];
    $('toolChip').hidden = !tool;
    if (tool) {
      $('toolChip').querySelector('.tc-icon').innerHTML = icon(tool.icon);
      $('toolName').textContent = tool.label;
      $('toolHint').textContent = tool.hint;
      closeTray();
    }
    renderTray();
  }

  // ---- Dock & tray ------------------------------------------------------------

  const dock = $('dock');
  dock.innerHTML = CATEGORIES.map((c) => `<button data-cat="${c.key}">${icon(c.icon)}<span>${c.label}</span></button>`).join('')
    + `<span class="dock-sep"></span><button data-open="work">${icon('people')}<span>Work</span></button>`;
  dock.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cat) ui.openCat === b.dataset.cat ? closeTray() : openTray(b.dataset.cat);
    if (b.dataset.open === 'work') toggleSheet('workSheet');
  });
  function openTray(cat) { ui.openCat = cat; renderTray(); }
  function closeTray() { ui.openCat = null; renderTray(); }
  function renderTray() {
    const tray = $('tray');
    const cat = CATEGORIES.find((c) => c.key === ui.openCat);
    tray.hidden = !cat;
    const toolCat = CATEGORIES.find((c) => c.tools.includes(TOOL[ui.tool]))?.key;
    for (const b of dock.querySelectorAll('[data-cat]')) b.classList.toggle('active', b.dataset.cat === (ui.openCat ?? toolCat));
    if (!cat) return;
    tray.innerHTML = cat.tools.map((t) => `<button data-tool="${t.key}" class="${ui.tool === t.key ? 'active' : ''}">${icon(t.icon)}<b>${esc(t.label)}</b>${t.cost ? `<small>${esc(t.cost)}</small>` : t.hotkey ? `<small><kbd>${t.hotkey.toUpperCase()}</kbd></small>` : ''}</button>`).join('');
  }
  $('tray').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tool]');
    if (b) setTool(b.dataset.tool);
  });
  $('toolDone').addEventListener('click', () => setTool(null));
  $('toolChip').querySelector('.tc-icon').addEventListener('click', () => openTray(CATEGORIES.find((c) => c.tools.includes(TOOL[ui.tool]))?.key));

  // ---- Map gestures -------------------------------------------------------

  const input = createInput(r.canvas, r, {
    isPainting: () => !!ui.tool,
    tap(sx, sy) {
      const wp = r.screenToWorld(sx, sy);
      ui.ripples.push({ x: wp.x, y: wp.y, at: performance.now() });
      if (ui.ripples.length > 6) ui.ripples.shift();
      const c = r.screenToCell(sx, sy);
      if (ui.tool) return applyTool({ x0: c.x, y0: c.y, x1: c.x, y1: c.y });
      if (ui.openCat) closeTray();
      selectAt(wp, c);
    },
    secondaryTap: () => setTool(null),
    paintStart(c) { ui.drag = { x0: c.x, y0: c.y, x1: c.x, y1: c.y }; },
    paintMove(c) { if (ui.drag) Object.assign(ui.drag, { x1: c.x, y1: c.y }); },
    paintEnd() { if (ui.drag) applyTool(ui.drag); ui.drag = null; },
    paintCancel() { ui.drag = null; },
    hover(c) { ui.hover = c; },
  });

  // Tapping cycles through everything under your finger: pawn → building → item → plant → zone.
  let lastPick = null;
  function selectAt(wp, c) {
    const reach = Math.max(0.9 * T, 26 / r.cam.zoom);
    const cands = w.pawns
      .map((p) => { const pos = r.pawnPos(p); return { p, d: Math.hypot(pos.x - wp.x, pos.y - wp.y) }; })
      .filter((e) => e.d < reach).sort((a, b) => a.d - b.d).map((e) => ({ pawn: e.p }));
    if (inBounds(w, c.x, c.y)) {
      for (const pick of [buildingAt, blueprintAt, itemAt, plantAt]) { const t = pick(w, c.x, c.y); if (t) cands.push({ thing: t }); }
      const z = w.zoneAt[idx(w, c.x, c.y)];
      if (z) cands.push({ zone: z });
    }
    const same = lastPick && lastPick.x === c.x && lastPick.y === c.y && lastPick.n === cands.length;
    const i = same ? (lastPick.i + 1) % Math.max(1, cands.length) : 0;
    lastPick = { x: c.x, y: c.y, n: cands.length, i };
    ui.selected = cands[i] ?? null;
    lastInspector = '';
  }

  function jumpTo(x, y, zoom) {
    r.cam.target = { x: (x + 0.5) * T, y: (y + 0.5) * T, zoom: zoom ?? Math.max(r.cam.zoom, 1.8) };
  }

  // ---- Keyboard (optional extras) ------------------------------------------

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); togglePause(); }
    else if (k === '1' || k === '2' || k === '3') setSpeed(+k);
    else if (k === 'escape') { setTool(null); closeTray(); closeSheets(); ui.selected = null; }
    else if (k === 'tab') { e.preventDefault(); toggleSheet('workSheet'); }
    else if (k === 'b') toggleAlarm();
    else {
      const tool = Object.values(TOOL).find((t) => t.hotkey === k);
      if (tool) setTool(tool.key);
    }
  });

  // ---- Time & alarm -------------------------------------------------------------

  let lastSpeed = 1;
  function setSpeed(i) { if (i > 0) lastSpeed = i; w.speed = i; }
  function togglePause() { setSpeed(w.speed === 0 ? lastSpeed : 0); }
  $('speeds').innerHTML = ['pause', 'play', 'fast', 'faster'].map((n, i) => `<button data-speed="${i}" aria-label="${n}">${icon(n)}</button>`).join('');
  $('speeds').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setSpeed(+b.dataset.speed); });

  function toggleAlarm() {
    setAlarm(w, !w.alarm);
    letter(w, w.alarm ? 'Alarm raised: fighters to the watchtowers, everyone else to shelter.' : 'Alarm lifted. Back to work.', w.alarm ? 'bad' : 'neutral');
  }
  $('alarm').addEventListener('click', toggleAlarm);

  // ---- Roster, alerts, letters -------------------------------------------------

  $('roster').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-pawn]');
    const p = b && w.pawns.find((p) => p.id === +b.dataset.pawn);
    if (!p) return;
    ui.selected = { pawn: p };
    lastInspector = '';
    jumpTo(p.x, p.y);
  });
  $('threat').addEventListener('click', () => {
    const c = colonyCenter(w);
    const z = w.pawns.filter((p) => p.faction === 'zombie' && p.state === 'hunt').sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    if (z) jumpTo(z.x, z.y);
  });
  const seenLetters = new Map(); // letter id → real time first shown
  $('letters').addEventListener('click', (e) => {
    const el = e.target.closest('[data-letter]');
    if (!el) return;
    const l = w.log.find((l) => l.id === +el.dataset.letter);
    if (l?.at) jumpTo(l.at.x, l.at.y);
    seenLetters.set(l?.id, -Infinity); // dismiss
    lastLetters = '';
  });

  // ---- Sheets (Work, Menu) ----------------------------------------------------

  function toggleSheet(id) {
    const el = $(id);
    const show = el.hidden;
    closeSheets();
    el.hidden = !show;
    if (show) (id === 'workSheet' ? renderWork : renderMenu)();
  }
  function closeSheets() { for (const id of ['workSheet', 'menuSheet']) $(id).hidden = true; }
  $('menuBtn').addEventListener('click', () => toggleSheet('menuSheet'));
  for (const id of ['workSheet', 'menuSheet']) {
    $(id).addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target === $(id)) closeSheets();
    });
  }

  function renderWork() {
    const tabs = `<div class="tabs">${[['priorities', 'Priorities', 'people'], ['schedule', 'Schedule', 'schedule']].map(([k, l, ic]) =>
      `<button data-tab="${k}" class="${ui.workTab === k ? 'on' : ''}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>`;
    const head = `<header>${tabs}<button class="round" data-close aria-label="Close">${icon('close')}</button></header>`;
    $('workSheet').innerHTML = `<div class="sheet-card">${head}${ui.workTab === 'schedule' ? scheduleHTML() : prioritiesHTML()}</div>`;
  }

  function prioritiesHTML() {
    const rows = colonists(w).map((p) => {
      const gentle = isGentle(p);
      const resp = `<td><button class="resp ${p.response}" data-resp="${p.id}" ${gentle ? 'disabled title="Gentle: never fights"' : ''}>${icon(p.response === 'fight' ? 'sword' : 'run')}<span>${p.response === 'fight' ? 'Fight' : 'Flee'}</span></button></td>`;
      const cells = WORK_TYPES.map((t) => {
        if (p.incapable.has(t.key)) return '<td class="incapable">—</td>';
        const v = p.priorities[t.key];
        const sk = t.skill ? p.skills[t.skill] : null;
        return `<td><button class="prio p${v}" data-pawn="${p.id}" data-work="${t.key}">${v || ''}</button>${sk ? `<small>${sk.level}${'•'.repeat(sk.passion)}</small>` : ''}</td>`;
      }).join('');
      return `<tr><th>${esc(p.name)}</th>${resp}${cells}</tr>`;
    }).join('');
    return `<p class="hint">Tap a number to cycle 1 → 4 → off. 1 is done first; at equal priority the leftmost column wins.
      <b>Response</b> decides what a survivor does when they see zombies: Fight, or Flee to a Shelter zone.</p>
      <div class="table-wrap"><table><thead><tr><th></th><th>Response</th>${WORK_TYPES.map((t) => `<th>${t.label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function scheduleHTML() {
    const slot = (k) => SCHEDULE_SLOTS.find((s) => s.key === k);
    const palette = SCHEDULE_SLOTS.map((s) => `<button data-slot="${s.key}" class="${ui.paintSlot === s.key ? 'on' : ''}"><i style="background:${s.color}"></i>${s.label}</button>`).join('');
    const hours = Array.from({ length: 24 }, (_, h) => `<span>${h % 3 === 0 ? h : ''}</span>`).join('');
    const rows = colonists(w).map((p) => `<div class="sched-row"><b>${esc(p.name)}</b><div class="sched-cells">${p.schedule.map((k, h) =>
      `<i data-pawn="${p.id}" data-hour="${h}" style="background:${slot(k).color}"></i>`).join('')}</div></div>`).join('');
    return `<p class="hint">Pick a slot, then tap or <b>drag across hours</b> to paint. <b>Guard</b>: fighters stand watch on a watchtower
      (sleep during the day instead). <b>Work</b>: no recreation. <b>Anything</b>: they decide.</p>
      <div class="chips palette">${palette}</div>
      <div class="sched"><div class="sched-row head"><b></b><div class="sched-cells hours">${hours}</div></div>${rows}</div>`;
  }

  // Schedule painting: finger-drag across cells (touch-action: none on the grid).
  let painting = false;
  function paintCell(el) {
    const p = el && w.pawns.find((p) => p.id === +el.dataset.pawn);
    if (!p) return;
    const h = +el.dataset.hour;
    if (p.schedule[h] === ui.paintSlot) return;
    p.schedule[h] = ui.paintSlot;
    el.style.background = SCHEDULE_SLOTS.find((s) => s.key === ui.paintSlot).color;
  }
  $('workSheet').addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('[data-hour]');
    if (!cell) return;
    painting = true;
    e.preventDefault();
    paintCell(cell);
  });
  window.addEventListener('pointermove', (e) => {
    if (!painting) return;
    paintCell(document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-hour]'));
  });
  window.addEventListener('pointerup', () => { painting = false; });

  $('workSheet').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { ui.workTab = tab.dataset.tab; return renderWork(); }
    const sl = e.target.closest('[data-slot]');
    if (sl) { ui.paintSlot = sl.dataset.slot; return renderWork(); }
    const b = e.target.closest('button[data-work], button[data-resp]');
    if (!b) return;
    const p = w.pawns.find((p) => p.id === +(b.dataset.pawn ?? b.dataset.resp));
    if (!p) return;
    if (b.dataset.resp) p.response = p.response === 'fight' ? 'flee' : 'fight';
    else p.priorities[b.dataset.work] = (p.priorities[b.dataset.work] + 1) % 5;
    renderWork();
  });

  // Load / New game hand main.js a boot request and reload the page.
  function bootInto(slot) {
    try { sessionStorage.setItem('holdout.boot', slot); } catch { /* storage blocked: reload resumes the autosave */ }
    location.reload();
  }

  let confirmNew = false;
  function renderMenu() {
    const info = saveInfo('manual'), auto = saveInfo('auto');
    const when = (i) => (i ? `Day ${dayOf(i.tick) + 1}, saved ${new Date(i.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'none');
    $('menuSheet').innerHTML = `<div class="sheet-card">
      <header><h2>Menu</h2><button class="round" data-close aria-label="Close">${icon('close')}</button></header>
      <h4>Game</h4>
      <div class="actions">
        <button data-menu="save">${icon('save')}<span>Save game</span></button>
        <button data-menu="load" ${info ? '' : 'disabled'}>${icon('play')}<span>Load save</span></button>
        <button data-menu="new" class="${confirmNew ? 'danger' : ''}">${icon('warn')}<span>${confirmNew ? 'Tap again to start over' : 'New game'}</span></button>
        <button data-menu="autoAlarm" class="${w.autoAlarm ? 'on' : ''}">${icon('bell')}<span>Auto-alarm on hordes: ${w.autoAlarm ? 'On' : 'Off'}</span></button>
      </div>
      <p class="hint">Save slot: ${when(info)}. Autosave: ${when(auto)} (every few in-game hours, and whenever you leave the app).</p>
      <h4>How to survive</h4>
      <ul class="howto">
        <li>You don't control survivors. You <b>plan</b>: mark work, place blueprints, draw zones, set priorities and schedules. They decide the rest.</li>
        <li><b>One finger</b> pans. <b>Pinch</b> zooms. <b>Tap</b> selects; tap again to cycle through what's under your finger. With a tool, <b>drag to paint</b>; two fingers still move the map.</li>
        <li><b>Zombies can't open doors</b>; they bash the weakest point. <b>Barricades</b> stop them but let you shoot over. <b>Spike traps</b> thin them out.</li>
        <li><b>Guns are loud.</b> Every shot draws more zombies. Melee is quiet but risks bites.</li>
        <li>Wounds <b>bleed</b> until a <b>doctor</b> treats them. A <b>bite</b> starts a race between infection and immunity: a bed, a doctor, and medicine usually win it.</li>
        <li><b>Everyone who dies rises again.</b> Build a <b>burn pit</b>; haulers rush bodies there.</li>
        <li>The <b>alarm</b> (bell) sends fighters to watchtowers and everyone else to shelter. The <b>Schedule</b> tab sets night watches.</li>
        <li>Keyboard: Space pause · 1/2/3 speed · Tab work · B alarm · C chop · H harvest · M mine · V salvage · X cancel · Z stockpile · G grow · WASD pan.</li>
      </ul>
      <h4>Log</h4>
      <div class="full-log">${w.log.slice().reverse().map((l) => `<div class="letter ${l.tone}"><time>D${dayOf(l.tick) + 1} ${String(hourOf(l.tick)).padStart(2, '0')}h</time>${esc(l.text)}</div>`).join('')}</div>
      <h4>Sandbox</h4>
      <div class="chips">${Object.keys(debugIncidents).map((k) => `<button data-debug="${k}">${esc(k)}</button>`).join('')}</div>
    </div>`;
  }
  $('menuSheet').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-debug], button[data-menu]');
    if (!b) return;
    if (b.dataset.debug) { debugIncidents[b.dataset.debug](w); closeSheets(); return; }
    const act = b.dataset.menu;
    if (act === 'save') { letter(w, saveGame(w, 'manual') ? 'Game saved.' : 'Saving failed (storage full or blocked).', 'neutral'); closeSheets(); }
    else if (act === 'load') { bootInto('manual'); }
    else if (act === 'new') {
      if (!confirmNew) { confirmNew = true; return renderMenu(); }
      bootInto('new');
    } else if (act === 'autoAlarm') { w.autoAlarm = !w.autoAlarm; renderMenu(); }
  });

  // ---- Inspector --------------------------------------------------------------

  const inspector = $('inspector');
  let lastInspector = '', pressing = false;
  inspector.addEventListener('pointerdown', () => { pressing = true; });
  window.addEventListener('pointerup', () => { pressing = false; });
  inspector.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const s = ui.selected, act = b.dataset.act;
    const t = s?.thing;
    if (act === 'close') ui.selected = null;
    else if (act === 'jump' && s) { const o = s.pawn ?? s.thing; if (o) jumpTo(o.x, o.y); }
    else if (act === 'resp' && s?.pawn) s.pawn.response = s.pawn.response === 'fight' ? 'flee' : 'fight';
    else if (act === 'designate' && t) t.designation = b.dataset.kind;
    else if (act === 'clear' && t) t.designation = null;
    else if (act === 'cancelBp' && t) cancelAt(t.x, t.y);
    else if (s?.zone) {
      const z = s.zone;
      if (act === 'prio') z.priority = Math.min(5, Math.max(1, z.priority + +b.dataset.dir));
      if (act === 'allow') z.allow.has(b.dataset.def) ? z.allow.delete(b.dataset.def) : z.allow.add(b.dataset.def);
      if (act === 'crop') z.crop = b.dataset.def;
    } else if (t?.bills) {
      const i = +b.dataset.bill, bill = t.bills[i];
      if (act === 'target') bill.target = Math.max(1, bill.target + +b.dataset.dir * (bill.recipe === 'ammo' ? 15 : 1));
      if (act === 'mode') bill.mode = bill.mode === 'until' ? 'forever' : 'until';
      if (act === 'pause') bill.paused = !bill.paused;
      if (act === 'removeBill') t.bills.splice(i, 1);
      if (act === 'addBill') t.bills.push({ recipe: b.dataset.recipe, paused: false, mode: 'until', target: b.dataset.recipe === 'ammo' ? 60 : 1, ...RECIPES[b.dataset.recipe].defaultBill });
    }
    lastInspector = '';
  });

  const head = (title, sub = '', jump = false) => `<header><div><h2>${esc(title)}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    <div class="head-btns">${jump ? `<button class="round" data-act="jump" aria-label="Center">${icon('target')}</button>` : ''}<button class="round" data-act="close" aria-label="Close">${icon('close')}</button></div></header>`;

  function inspectorHTML() {
    const s = ui.selected;
    if (!s) return '';
    if (s.pawn) return w.pawns.includes(s.pawn) ? pawnHTML(s.pawn) : ((ui.selected = null), '');
    if (s.zone) return w.zones.includes(s.zone) ? zoneHTML(s.zone) : ((ui.selected = null), '');
    if (s.thing) return w.things.has(s.thing.id) ? thingHTML(s.thing) : ((ui.selected = null), '');
    return '';
  }

  function pawnHTML(p) {
    const hp = `<div class="need"><span>Health</span>${bar(p.hp / p.maxHp, p.hp / p.maxHp < 0.35 ? 'low' : '')}<em>${Math.round(p.hp)}</em></div>`;
    if (p.faction === 'zombie') {
      const state = { wander: 'Shambling aimlessly', investigate: 'Drawn by a noise', hunt: 'Hunting survivors' }[p.state];
      return head(p.name, p.turnedFrom ? 'Once one of yours' : 'The walking dead', true) + `<p class="doing">${state}</p>${hp}`;
    }
    if (p.faction === 'looter') return head('Looter', 'Hostile scavenger', true) + `<p class="doing">${esc(p.job?.report ?? 'arriving')}</p>${hp}`;
    const th = breakThresholds(p);
    const traits = p.traits.map((t) => TRAITS[t].label).join(' · ');
    const marks = [th.minor, th.major, th.extreme].map((v) => `<b style="left:${v}%"></b>`).join('');
    const thoughts = moodBreakdown(p, w).map((t) =>
      `<li class="${t.mood >= 0 ? 'good' : 'bad'}"><span>${esc(t.label)}${t.count > 1 ? ` ×${t.count}` : ''}</span><span>${t.mood > 0 ? '+' : ''}${t.mood}</span></li>`).join('');
    const skills = SKILLS.map((k) => {
      const s = p.skills[k];
      return `<li><span>${k}</span><span class="skill">${bar(s.xp / xpToNext(s.level), 'xp')}<b>${s.level}</b><i class="passion">${'●'.repeat(s.passion)}</i></span></li>`;
    }).join('');
    const gentle = isGentle(p);
    const wpn = p.weapon ? THINGS[p.weapon.def] : null;
    const weapon = gentle ? 'Won’t carry a weapon'
      : wpn ? `${wpn.label}${wpn.weapon.ranged ? ` · ${p.ammo} ammo${p.ammo ? '' : ' (swings it like a club)'}` : ''}` : 'Improvised club';
    const tended = isTended(w, p);
    const status = [
      p.downed && `<p class="alert-line">Down${p.inBed != null ? ', resting in bed' : ' on the ground; needs rescuing'}</p>`,
      p.carriedBy && `<p class="alert-line">Being carried to a bed by ${esc(p.carriedBy.name)}</p>`,
      p.mental && `<p class="alert-line mental">Mental break: ${esc(p.mental.label)}</p>`,
    ].filter(Boolean).join('');
    const medical = [
      p.bleed > 0.5 && `<div class="need"><span>Bleeding</span><span class="bleed">${icon('drop')} ${Math.round(p.bleed)} HP/day${p.bleed > MEDICAL.tendNeededBleed ? ', needs a doctor' : ''}</span></div>`,
      tended && `<div class="need"><span>Treated</span><span class="tended">${icon('cross')} quality ${pct(p.tendQuality)}%</span></div>`,
      p.infection && `<div class="infection"><b>${icon('warn')} Bitten: infection vs immunity</b>
        <div class="need"><span>Infection</span>${bar(p.infection.severity, 'low')}<em>${pct(p.infection.severity)}</em></div>
        <div class="need"><span>Immunity</span>${bar(p.infection.immunity, 'immune')}<em>${pct(p.infection.immunity)}</em></div>
        <small>${p.infection.immunity > p.infection.severity ? 'Winning. Keep them resting.' : 'Losing. A bed, a doctor, and medicine help immunity win.'}</small></div>`,
    ].filter(Boolean).join('');
    return head(p.name, esc(traits), true) + status + `
      <p class="doing">${esc(p.downed ? 'lying on the ground' : p.job?.report ?? 'thinking')}${p.carrying ? ` <span class="carry">· carrying ${p.carrying.count} ${THINGS[p.carrying.def].label.toLowerCase()}</span>` : ''}</p>
      ${hp}${medical}
      <div class="need"><span>Mood</span><div class="bar mood">${marks}<i style="width:${p.mood}%"></i><u style="left:${p.moodTarget}%"></u></div><em>${Math.round(p.mood)}</em></div>
      <div class="need"><span>Food</span>${bar(p.needs.food)}<em>${pct(p.needs.food)}</em></div>
      <div class="need"><span>Rest</span>${bar(p.needs.rest)}<em>${pct(p.needs.rest)}</em></div>
      <div class="need"><span>Recreation</span>${bar(p.needs.joy)}<em>${pct(p.needs.joy)}</em></div>
      <div class="row"><span>${icon(wpn?.weapon.ranged ? 'gun' : 'blade')} ${esc(weapon)}</span></div>
      <div class="row"><span>When zombies appear</span><button class="resp ${p.response}" data-act="resp" ${gentle ? 'disabled' : ''}>${icon(p.response === 'fight' ? 'sword' : 'run')}<span>${p.response === 'fight' ? 'Fight' : 'Flee'}</span></button></div>
      <h4>Thoughts</h4><ul class="thoughts">${thoughts}</ul>
      <h4>Skills</h4><ul class="skills">${skills}</ul>
      ${p.incapable.size ? `<p class="warn">Won’t do: ${[...p.incapable].map((k) => WORK_TYPES.find((t) => t.key === k).label).join(', ')}</p>` : ''}`;
  }

  function zoneHTML(z) {
    if (z.type === 'grow') {
      const crops = CROPS.map((c) => `<button data-act="crop" data-def="${c}" class="${z.crop === c ? 'on' : ''}">${THINGS[c].label}</button>`).join('');
      return head(z.label, `${z.cells.size} cells`) + `<h4>Crop</h4><div class="chips">${crops}</div>
        <p class="hint">Rice is food (cook it into meals). Medicinal herbs become herbal medicine for your doctors.</p>`;
    }
    if (z.type === 'shelter') return head(z.label, `${z.cells.size} cells`) + `<p class="hint">Survivors set to <b>Flee</b> (and anyone badly hurt) run here when zombies show up, and everyone who isn't fighting waits here during an alarm. Keep it behind walls.</p>`;
    const items = Object.keys(THINGS).filter((k) => THINGS[k].kind === 'item');
    return head(z.label, `${z.cells.size} cells`) + `
      <div class="row"><span>Priority</span><button class="round" data-act="prio" data-dir="-1">‹</button><b class="prio-label">${STOCK_PRIORITIES[z.priority - 1]}</b><button class="round" data-act="prio" data-dir="1">›</button></div>
      <h4>Allowed</h4><div class="chips">${items.map((k) => `<button data-act="allow" data-def="${k}" class="${z.allow.has(k) ? 'on' : ''}">${THINGS[k].label}</button>`).join('')}</div>
      <p class="hint">Haulers move items up to higher-priority stockpiles. Bodies go to a burn pit if you have one.</p>`;
  }

  function actions(t) {
    const d = THINGS[t.def], btns = [];
    if (d.kind === 'plant') btns.push(['designate', 'chop', 'axe', 'Chop']);
    if (d.kind === 'plant' && !d.woody && d.yield) btns.push(['designate', 'harvest', 'basket', 'Harvest']);
    if (d.mineWork) btns.push(['designate', 'mine', 'pick', 'Mine']);
    if (d.kind === 'building' && canSalvage(d)) btns.push(['designate', 'salvage', 'wrench', d.cost ? 'Deconstruct' : 'Salvage']);
    if (d.kind === 'blueprint') btns.push(['cancelBp', '', 'cancel', 'Cancel']);
    if (t.designation) btns.push(['clear', '', 'cancel', `Clear “${t.designation}”`]);
    return btns.length ? `<div class="actions">${btns.filter(([, k]) => !k || k !== t.designation).map(([act, kind, ic, label]) => `<button data-act="${act}" data-kind="${kind}">${icon(ic)}<span>${label}</span></button>`).join('')}</div>` : '';
  }

  function billsHTML(t, d) {
    const bills = t.bills.map((b, i) => {
      const rc = RECIPES[b.recipe];
      const stocked = rc.ingredients.map((ing) => `${t.stock[ingKey(ing)] ?? 0}/${ing.count}`).join(' · ');
      const mode = !rc.product ? 'every body brought here'
        : b.mode === 'until'
          ? `until you have <button class="round sm" data-act="target" data-bill="${i}" data-dir="-1">−</button><b>${b.target}</b><button class="round sm" data-act="target" data-bill="${i}" data-dir="1">+</button> <small>(${countOwned(w, rc.product.def)} now)</small>`
          : 'forever';
      return `<div class="bill ${b.paused ? 'paused' : ''}"><div class="bill-row"><b>${rc.label}</b><button class="round sm" data-act="removeBill" data-bill="${i}" aria-label="Remove">${icon('close')}</button></div>
        <div class="bill-row">${rc.product ? `Do <button data-act="mode" data-bill="${i}">${b.mode === 'until' ? 'until X' : 'forever'}</button> ` : ''}${mode}</div>
        <div class="bill-row"><button data-act="pause" data-bill="${i}">${b.paused ? 'Resume' : 'Pause'}</button><small>Needs ${ingText(rc)} · stocked ${stocked}</small></div></div>`;
    }).join('') || '<p class="hint">No bills. Add one below.</p>';
    const add = d.recipes.map((k) => `<button data-act="addBill" data-recipe="${k}">+ ${RECIPES[k].label}</button>`).join('');
    return `<h4>Bills</h4>${bills}<h4>Add bill</h4><div class="chips add">${add}</div>`;
  }

  function thingHTML(t) {
    const d = THINGS[t.def];
    const hp = d.hp ? `<div class="need"><span>Integrity</span>${bar(t.hp / d.hp, t.hp / d.hp < 0.35 ? 'low' : '')}<em>${Math.round(t.hp)}</em></div>` : '';
    if (d.corpse) return head(t.zombie ? 'Zombie corpse' : `${t.name}'s body`, t.zombie ? 'Rots away in a few days' : 'Will rise again unless burned') + `<p class="hint">${t.zombie ? 'Bodies lying around upset survivors. A burn pit gets rid of them.' : 'Everyone who dies turns. With a burn pit, haulers rush the body there first.'}</p>`;
    if (d.weapon) return head(d.label, d.weapon.ranged ? `Range ${d.weapon.range} · loud` : 'Melee · quiet') + `<p class="hint">Survivors pick up the best weapon they can use. ${d.weapon.ranged ? 'Needs ammo; every shot draws zombies.' : ''}</p>`;
    if (d.kind === 'item') return head(`${d.label} ×${t.count}`, d.medicine ? `Medicine, potency ${pct(d.medicine)}%` : `$${Math.round(d.value * t.count)}`);
    if (d.kind === 'plant') return head(d.label, `Growth ${pct(t.growth)}%`) + actions(t);
    if (d.kind === 'blueprint') {
      const bd = THINGS[t.builds];
      const mats = Object.entries(bd.cost).map(([k, n]) => `<li><span>${THINGS[k].label}</span><span>${t.stock[k] ?? 0} / ${n}</span></li>`).join('');
      return head(`${bd.label}`, 'Blueprint') + `<ul class="thoughts">${mats}</ul><p class="hint">Builders deliver materials, then construct.</p>` + actions(t);
    }
    if (d.bench) return head(d.label, BUILD_HINTS[t.def] ?? '') + hp + billsHTML(t, d) + actions(t);
    if (d.trap) return head(d.label, t.armed ? 'Armed' : 'Sprung, waiting to be reset') + hp + actions(t);
    if (d.bed) {
      const owner = w.pawns.find((p) => p.id === t.owner);
      return head(d.label, owner ? `Owner: ${esc(owner.name)}` : 'Unclaimed') + hp + actions(t);
    }
    const sub = d.ruin ? 'From before' : d.natural ? 'Natural' : BUILD_HINTS[t.def] ?? '';
    return head(d.label, sub) + hp + actions(t);
  }

  // The HUD wraps onto extra rows on narrow screens (and when the threat chip appears);
  // letters and the inspector sit just below it.
  new ResizeObserver(() => document.documentElement.style.setProperty('--hud-h', `${$('hud').offsetHeight}px`)).observe($('hud'));

  // ---- Per-frame update -------------------------------------------------------

  let lastPanel = 0, lastLetters = '', lastRoster = '';
  ui.update = (dt, now) => {
    input.update(dt, w.w * T, w.h * T);
    if (now - lastPanel < 200) return;
    lastPanel = now;

    const d = dateParts(w.tick);
    $('clock').innerHTML = `${icon(isNight(w.tick) ? 'moon' : 'sun')}<b>Day ${d.day}</b><span>${d.time}</span><small>${d.season}</small>`;
    for (const b of $('speeds').querySelectorAll('button')) b.classList.toggle('active', +b.dataset.speed === w.speed);

    const hunting = w.pawns.filter((p) => p.faction === 'zombie' && p.state === 'hunt').length;
    $('threat').hidden = !hunting;
    $('threat').innerHTML = `${icon('warn')}<b>${hunting}</b><span>hunting</span>`;
    $('alarm').classList.toggle('on', w.alarm);
    $('alarm').innerHTML = `${icon('bell')}<span>${w.alarm ? 'Alarm on' : 'Alarm'}</span>`;
    const zCount = w.pawns.filter((p) => p.faction === 'zombie').length;
    $('stats').innerHTML = `${icon('zombie')}<b>${zCount}</b><span class="dim">· $${w.wealth.toLocaleString()} · threat ${threatPoints(w)}</span>`;

    const roster = colonists(w).map((p) => {
      const st = p.downed ? 'down' : p.infection ? 'infected' : p.mental ? 'mental' : p.asleep ? 'asleep' : p.job?.kind === 'combat' ? 'combat' : '';
      const sel = ui.selected?.pawn === p ? 'sel' : '';
      return `<button data-pawn="${p.id}" class="${st} ${sel}" style="--c:${p.look.clothes}"><i></i><span>${esc(p.name)}</span><em style="width:${pct(p.hp / p.maxHp)}%"></em></button>`;
    }).join('');
    if (roster !== lastRoster) { $('roster').innerHTML = roster; lastRoster = roster; }

    const nowReal = performance.now();
    const recent = w.log.slice(-5).filter((l) => {
      if (!seenLetters.has(l.id)) seenLetters.set(l.id, nowReal);
      return nowReal - seenLetters.get(l.id) < 22000;
    }).reverse();
    const letters = recent.map((l) => `<button class="letter ${l.tone}" data-letter="${l.id}"><time>D${dayOf(l.tick) + 1} ${String(hourOf(l.tick)).padStart(2, '0')}h</time>${esc(l.text)}${l.at ? icon('target', 'go') : ''}</button>`).join('');
    if (letters !== lastLetters) { $('letters').innerHTML = letters; lastLetters = letters; }

    if (!pressing) {
      const html = inspectorHTML();
      inspector.hidden = !html;
      if (html !== lastInspector) { inspector.innerHTML = html; lastInspector = html; }
    }
    ui.ripples = ui.ripples.filter((t) => now - t.at < 400);
  };

  ui.jumpTo = jumpTo;
  ui.setTool = setTool;
  ui.debug = Object.fromEntries(Object.entries(debugIncidents).map(([k, fn]) => [k, () => fn(w)]));
  return ui;
}
