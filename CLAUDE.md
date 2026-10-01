# colony/ — untitled touch-first zombie colony sim ("Holdout" is only a placeholder label)

## Vision

**Build a fortress that runs on people. Someone has to carry every bullet, and the dead you
kill pay for the next ones. You plan; they live it.** The base is the body; the people are the
blood. Pillars (DESIGN §1): the base runs on people, noise is the dial, everything the dead
carried is worth something. It mixes RimWorld (indirect control, needs, mood, storyteller),
Project Zomboid (noise, scavenging, bites), The Walking Dead (everyone who dies turns), They Are
Billions (walls, hordes, announced waves), Cosmoteer (visible logistics fixed by layout), Prison
Architect (clean top-down vector look), and Factorio (your output feeds your enemy). It's built
for iPad first.

- **`docs/DESIGN.md`** is the design bible: pillars, influences, the indirect-defense model,
  zombies, infection, the Director, touch UX, art direction, roadmap, and open questions.
  Read it before adding features.
- **`docs/RESEARCH.md`** has RimWorld's real numbers and sources. Values in code marked
  `(RW)` come from there.

**Design rules (non-negotiable without discussion):**
1. **Never add a tool that orders a specific survivor to do a specific thing.** Every lever
   changes the *conditions* they decide under: designations, blueprints, zones, priorities,
   the Fight/Supply/Flee response, bills, and schedules.
2. **Touch first.** Every action must work with one finger (tap or drag) plus two-finger
   pan and zoom. Targets are ≥ 44 pt. Nothing important lives in a hover tooltip. Keyboard and
   mouse are extras.
3. **Vector only.** Everything is drawn from code with Canvas paths in world units, so it's
   crisp at any zoom. No bitmaps or sprite sheets.

## Tech approach

- Vanilla JS **ES modules**, Canvas 2D, no build step, no dependencies.
- **Dev server:** `ruby tools/serve.rb` (port 8125, **no-cache headers**). The root
  `.claude/launch.json` entry `colony` runs it. Don't go back to plain `ruby -run -e httpd`:
  browsers heuristically cache ES modules, and edits silently don't load (this happened).
  `ruby tools/serve.rb --lan` makes it reachable from an iPad on the same Wi-Fi and prints
  the URL. Add to Home Screen for full-screen PWA mode.
- **Git + hosting:** this folder is its own git repo, pushed to **github.com/Zuk144/zombie-colony**
  (public, over SSH like `pet-game`). **GitHub Pages serves `main` at
  https://zuk144.github.io/zombie-colony/**, so every `git push` to `main` redeploys (about a
  minute). `.nojekyll` makes Pages serve the files as-is. Pages caches files for about 10 minutes,
  so right after a deploy a device can briefly mix old and new modules. If the iPad acts
  strangely after an update, wait a few minutes and reload. Commit or push only when the user
  asks.
- **Hosted test build (claude.ai, secondary):** also published as a private claude.ai Artifact at
  https://claude.ai/artifact/FFNUUrWf83Hhwz8ybhZN9y. To update it, run
  `python3 tools/artifact_page.py <scratchpad>/index.html` (this strips the doc wrapper, since
  Artifacts supply their own), then publish that file with `root` = this folder, `files` =
  `style.css` plus every `src/*.js` at the same paths, and `url` = the link above to keep it.
  Inside the artifact frame the query string never arrives, so `?seed=` doesn't work there,
  and storage can throw, so every storage call is wrapped.
- **Sim, render, and UI are separate.** The sim modules never touch the DOM. Test AI and balance
  headless in the page console: `const S = await import('/src/sim.js'); const w =
  S.newGame(1); for (…) S.tickWorld(w)`. 15 in-game days take ≈ 4 s. Node isn't installed on
  this machine.
- All state is plain data on one world object `w` (no classes), so save/load can serialize
  it later. Keep it that way.
- **Boot rules (`main.js`):** `?seed=123` always starts a fresh game with that seed (use this
  for testing). A plain URL **resumes the autosave** if there is one. The menu's Load and New
  game buttons set `sessionStorage['holdout.boot']` and reload.
- `window.holdout` exposes `w`, `ui`, `renderer`, and `debug.*` (`holdout.debug.horde()`,
  `.bigHorde()`, `.strays()`, `.survivor()`, `.supplyDrop()`, `.looters()`, …). The same
  triggers are in the in-game menu under "Sandbox".

## Studio (design agents)

Design thinking is delegated; the main session is the **lead engineer** who builds, measures,
and relays the owner's words.

- **`colony-cdo`** (Chief Design Officer): `../.claude/agents/colony-cdo.md`, in the workspace
  root, outside this repo. It runs on Opus at extra-high effort with **persistent memory**
  (`../.claude/agent-memory/colony-cdo/`: owner taste, verdicts, lessons; the gitignored
  `.claude/agent-memory/colony-cdo` here is a symlink to it, so runs from either folder share one memory). It can play
  the dev build in its own browser tab and run short headless sims. It writes only in `docs/`.
- **The studio's craft lives in `docs/studio/`:**
  - `handbook.md`: the seven-step method and the toolkit.
  - `rubric.md`: the quality bar, 16/20 with no zeros.
  - `brief-template.md`: the brief format.
  - `ideas.md`: the reservoir of every unbuilt idea.
  - `references/`: the owner's eleven games, plus a synthesis README.
  - `briefs/`: the CDO's output.

**The loop:**
1. **Owner problem → CDO brief.** Pass the owner's words verbatim and name the mode (brief,
   review, vision audit, or quick take).
2. **Lead checks the brief** against `rubric.md`. For big features, spawn a *second, fresh* CDO
   in review mode to attack it adversarially before the owner sees it.
3. **Owner decides.** Tell the CDO the verdict *and the why* (resume it with SendMessage, or
   note it for the next run) so it lands in its memory.
4. **Fold the approved design into `docs/DESIGN.md`,** then build the smallest slice first.
5. **CDO reviews the build** by playing it against the brief's acceptance criteria. The owner's
   playtest feedback goes back to step 1.

When the owner shares a game to learn from, file it in `references/` (from `_template.md`) and
update the README synthesis.

## Architecture (file map)

**Simulation**
| File | Owns |
|---|---|
| `config.js` | Time constants, map size, **combat, zombie, medical, and infection tuning** (`SURVIVOR`, `ZOMBIE`, `MEDICAL`, `INFECTION`) |
| `defs.js` | **Data-driven content**: terrain; items (incl. `weapon`, `medicine`); plants; buildings (`hp`, `blocks`, `seeThrough`, `door`, `trap`, `guardPost`, `bench` + `recipes`, `size`, `wallLike`, `light`, `salvage`); `RECIPES` (multi-ingredient, `workType`, `product: null` destroys input); skills; work types; schedule slots; crops; traits |
| `world.js` | World object, grid, **multi-cell footprints** (`sizeOf`), spawn/despawn, `spawnItem` (merge and spill, keeps corpse props), **survivor vs zombie cost functions**, reachability labels, reservations, letters, time |
| `path.js` | A* with a pluggable cost function and rect goals (`touch` = end adjacent to a footprint) |
| `mapgen.js` | Terrain noise, roads, ruined buildings with loot, wrecked cars, vegetation, starting zombies |
| `zones.js` | Stockpiles (5 priorities and a filter; corpses excluded by default; presets such as the **Ammo cache**), grow zones, **shelter zones** |
| `rooms.js` | **Rooms and roofs**: 4-connected rooms bounded by walls, doors, and rock (not barricades); roles; impressiveness; roof support (6 cells) and collapse; auto-roof targets and roof areas; natural roofs from mining; `tempAt` |
| `climate.js` | **Seasons and temperature**: outdoor curve plus day/night plus weather; room heat loss and heating; hypothermia and heatstroke (RW formulas); spoilage; frost; `growingSeason`; zombie cold slowdown |
| `buildings.js` | **Per-building tick hook**: supplies (`supplies(t)`: fuel and ammo slots haulers fill), fuel burn, lit/heat state, heat per room, **self-running machine benches** (press, vat), and **the Din** (running machines pulse `makeNoise` with themselves as the source; `w.din`) |
| `power.js` | **Power grids**: poles link within 8 squares (Chebyshev) and power things within 6; union-find rebuild on `w.powerDirty`; per-grid supply/demand/battery balance each rare tick; brownouts; machine modes (`t.mode`: on / day / off) |
| `perimeter.js` | **Secure yard**: flood fill from the map edge over zombie-walkable cells; unreached pockets bounded by something built are `w.secure`. `w.breach` = zombies inside, with a letter. Helpers in `world.js`: `inYard` (a building counts if you can stand next to it from inside), `fencedOut`, `compass` |
| `pawn.js` | Survivor, zombie, and looter factories; needs; skills; `canFight`, `traitMult` |
| `mood.js` | Thoughts (situational and memory, stacking), mood drift, break thresholds and rolls, catharsis |
| `jobs.js` | **Job runner and job drivers** (toils + reserve + failIf): haul, deliver, build, repair, rearm, salvage, mine, cut, sow, bill (any recipe), equip, ammo, guard, shelter, eat, sleep, joy, mental states, leave or steal. Also carrying a downed pawn (`carryingPawn`/`carriedBy`) and `claimBed` |
| `work.js` | WorkGivers per work type: Doctor (rescue, tend), bill givers per `workType` (cooking, crafting, hauling → burn pit), construction (repair, rearm, deliver, build, salvage), and more. **Emergency pass:** bodies about to rise get carried to a burn pit first. Then `findWork` (priority 1→4, left column first, then nearest target) |
| `think.js` | Survivor think tree: downed → mental → **threat response** → urgent needs → **alarm** → **patient** (go to bed for treatment) → **guard shift** → sleep time → needs → **arm up** (better weapon, ammo) → joy → work → wander. Also `setAlarm` and `shouldInterrupt` |
| `combat.js` | **Zombies and combat** (+ Phase 3: fence crowd rule, electric shocks, `wreck` state for noise-drawn zombies, broken machines, `tickTurrets`): line of sight (barricades see-through), noise, the **shared zombie flow field**, zombie state machine (wander / investigate / hunt, bashing, **traps**), weapons (`weaponOf`, melee, **shooting = noise**), damage and bleeding, bites, going down, death, reanimation, fight and flee jobs, `fx` events |
| `medical.js` | **Health over time** (bleeding, healing, the **infection-vs-immunity race**), tend quality (skill × medicine), patient, tend, and rescue jobs |
| `save.js` | Serialize and deserialize the world (JSON, Sets → arrays, derived state rebuilt, jobs dropped), localStorage slots (`auto`, `manual`) |
| `director.js` | The Director: scripted intro (walker day 1, pack day 3), Cassandra threat cycle → hordes, strays (more at night), misc events, survivors joining |
| `sim.js` | `tickWorld` (field rebuild, zombies and pawns each tick; every rare tick climate, buildings, plants, frost, rot, and corpses; Director every 1,000) and the starting scenario |

**Presentation**
| File | Owns |
|---|---|
| `terrainArt.js` | Terrain as vector: **marching-squares** regions with 45° chamfers, cached per 16×16 chunk, merged per frame with `addPath` (no seams). Rock is "extruded" |
| `art.js` | Every sprite as vector paths: people (facing, lunge, zombie arms), trees, crops, items, corpses, **connected walls**, doors, cars, furniture, badges, bars, labels. `lod` drops detail when zoomed out |
| `render.js` | Camera transform, draw order, visible-cell culling, **night lighting** (half-res darkness mask with light sources punched out, plus a warm additive glow), overlays |
| `input.js` | Gestures: one-finger pan (with inertia) or paint, pinch zoom, tap, mouse, trackpad, keys, animated camera jumps |
| `ui.js` | HUD (clock, speed, **roster**, threat chip, **Alarm**, **secure-yard chip**, **Din**), layers button cycling Rooms → Yard → Power, bottom **dock (Orders / Build / Machines / Furnish / Zones / Work) → tray → tool chip (Done)**, contextual inspector (bills with add/remove, crop picker, weapon, bleeding, infection race), Work sheet (**Priorities** and a finger-painted **Schedule**), menu (save, load, new game, auto-alarm, log, sandbox), tappable letters |
| `icons.js` | SVG line icons in the same stroke style as the world |
| `main.js` | Boot (seed, load, or resume), autosave (every 6 in-game hours and on `visibilitychange`/`pagehide`), the fixed-timestep loop |

### How a survivor decides (core loop)

1. With no job, `think()` walks the tree and the first node that yields a job wins.
2. `startJob` takes reservations and runs toils (goTo, pickUp, work, wait, instant).
   `failIf` is checked every tick. An end with FAIL releases reservations and drops what the
   survivor carries.
3. Every **20 ticks** each survivor scans for zombies (sight, blocked by walls and doors but not
   barricades; a watchtower adds sight). A sighting interrupts non-combat jobs.
   **Inside the secure yard, zombies on the far side of the wire are ignored** (`scanThreat`)
   unless you can hit them through it: shooters in range, or a blade **hacking through the
   wire** (2 cells in line across a fence, gate, or barricade; zombies grab back at half odds).
   `threatResponse`: **cornered → fight**. **Supply** runners only flee zombies that can reach
   them, and otherwise keep the guns fed (`supplyWork`, emptiest first, ignoring Haul priority).
   **During a horde the wire is home:** work and items stay inside the yard, and anyone outside
   heads back in. **Shooters** (a gun with ammo) engage anything they
   can see or reach unless it's within 4 cells and they're outnumbered, and on a watchtower
   they never leave it. **Melee** fighters engage only if they can reach the zombie and aren't
   **outnumbered** (more than 2 zombies per nearby fighter + 1). Anyone else flees to a
   Shelter zone, or away.
4. Every **250 ticks**: needs, mood, health (`medical.tickHealth`: bleed, heal, infection
   race), and interrupts (urgent needs, sleep time, guard shift start and end).

### How zombies work

- No job system; `tickZombie` is a small state machine. **Hunting zombies share one flow
  field** (`w.zfield`), a multi-source Dijkstra from all survivors that costs walls and doors by
  HP ("bash time"). It's rebuilt every 45 ticks or when `w.fieldDirty` is set. Each zombie steps
  downhill. If downhill is a wall or door, it bashes it (walls and doors have HP; ruins and cars
  too).
- **Doors stop zombies** (`zombieCost`), but survivors walk through (`passable`).
- Noise (`makeNoise`) pulls non-hunting zombies within a radius. Melee, bashing, and supply
  drops all make noise.
- Hunt state comes from sight or smell (2 cells). Zombies lose interest after 1,800 ticks
  without a sighting, unless they're part of a horde.

### Adding things

- **Machine:** `machine: true` plus `power: { draw }` (consumer), `{ output }` (+ `fuel` = generator,
  `solar: true`), or `{ storage }` (battery); `noise` adds to the Din. A machine with `bench` +
  `recipes` of `workType: 'machine'` runs its bills itself while powered; haulers stock it.
  `ammoFeed` gives a loadable magazine. Draw it in `art.js` `drawMachine`, add it to the
  Machines tray in `ui.js`, and give it an icon.
- **Building:** a `THINGS` entry (`cost`, `work`, `hp`, flags) → a toolbar entry in the
  `CATEGORIES` Build or Furnish list in `ui.js` (plus a hint in `BUILD_HINTS`, and an icon in
  `icons.js` keyed by the def name) → a draw case in `render.js` (the `furniture` loop) and a
  function in `art.js`. Anything with `hp` is automatically bashable, repairable, and
  salvageable.
- **Recipe or bench:** add to `RECIPES` (`workType` picks the Work column that does it) and
  list it in a bench's `recipes`. `defaultBill` auto-adds it when the bench is built.
- **Heater or fuel user:** `fuel: { capacity, perDay }` gets refueling, lit state, and fuel UI
  automatically. `heat` + `heatTarget` warm its room. `idleWhenWarm` saves fuel.
- **Multi-cell or rotatable building:** `size: [w, h]` (+ `rotatable: true`). The Build tool
  switches to footprint placement with the ↻ button; blueprints and the built thing carry
  `sw`/`sh`.
- **Weapon:** an item with `stack: 1` and `weapon: { melee | ranged, damage, cooldown, rank,
  range?, accuracy?, noise? }`. Survivors auto-equip higher `rank`s (ranged only counts if
  ammo exists).
- **Multi-cell thing:** set `size: [w, h]` (or `t.sw`/`t.sh` per instance). Spawn, despawn,
  reach, paths, and selection all handle footprints.
- **Work:** a `WORK_TYPES` column (order matters) → `GIVERS[key]` in `work.js` → a job
  factory in `jobs.js`.
- **Thought:** `THOUGHTS` in `mood.js`. Memories need `days` and `stack`. Call `addMemory`.
- **Incident:** `MISC` in `director.js` (with `weight` and optional `canFire`), or a new
  scripted beat in `tickDirector`.

## Gotchas

- **Stale modules:** if a change "doesn't work", make sure the no-cache server is the one
  running (see Tech approach). When unsure in the console, compare
  `(await import('/src/config.js'))` against the file.
- **Reachability** (`w.reach`) rebuilds lazily when a `blocks` thing spawns or despawns. Go
  through `reachGroup` / `canReach` / `canReachThing`. Read `w.reach` directly only right after
  one of those.
- `dist(a, b)` is Chebyshev distance *to b's footprint* when b is a thing. Pass things, not
  `{x, y}` copies, when size matters.
- `touch` path goals never end *on* the target. `completeBlueprint` still moves pawns and
  items out of a newly blocked cell.
- Corpses are stack-1 items whose props (`name`, `look`, `reanimateAt`, `rotAt`) survive
  hauling via `p.carrying.props`. Only *spawned* corpses reanimate, not carried ones. Anything
  delivered into a bench's `stock` is gone from the map, which is how the burn pit works.
- **`work()` toils always return DONE** after `onDone`; don't make them return `onDone`'s
  value (sowing's `onDone` returns the new plant, which once caused an infinite spawn).
- `p.inBed` (a bed id) means "lying in a bed" for healing and immunity. It's cleared by
  `startJob`/`endJob`. A rescued downed pawn keeps it because they have no job.
- **Rooms rebuild** (`w.roomsDirty`) whenever something with `blocks && !seeThrough` or a
  `door` spawns or despawns. Room objects are replaced on rebuild, so don't hold onto them; the
  UI re-finds a selected room by its first cell. Room temperatures carry over through rebuilds
  and saves.
- **Plants grow only under open sky** and when it's warm (`plantGrowthFactor`). **Sowing waits for
  the growing season** (`growingSeason` uses the day's average, not the hour, or growers sow on
  mild winter afternoons and frost kills everything that night).
- **Spoilage** (`t.rot`, in days at full rate) rides through hauling via `p.carrying.props.rot`
  and averages when stacks merge. Refueling moves **whole logs** only (fractional fuel once
  leaked fractional wood counts).
- **Saves drop object references:** `job`, `move`, `threat`, `heard`, `carryingPawn`, and
  `carriedBy` aren't saved (everyone re-thinks on load), and `w.fx` is transient. Anything new
  that points at another object needs an id instead, or it won't survive a save.
- Renderer: `draw` collects visible things once per frame with a `Set` (multi-cell things
  appear in several cells). Don't mutate sim data from render code.
- iOS: canvas has `touch-action: none`, and `gesturestart`/`dblclick` are prevented so Safari's
  own zoom doesn't fight the game's. The page uses `viewport-fit=cover` and safe-area insets
  (`--sat`/`--sab` in CSS). `[hidden]` must stay `display:none !important`, because several
  panels set `display: flex`.
- **Machines only make noise while running** (`isRunning`). Benches draw power only while they have
  a stocked, wanted bill (`t.working`); turrets only with ammo; generators only when the grid
  needs them. Broken machines (`t.broken`) are skipped by zombies' bash targeting and power.
- **Fences** are `wallLike` + `seeThrough`, so they don't make rooms and don't block sight. One
  attacker does `FENCE.loneFactor` damage; `FENCE.crowd` attackers do full damage.
- At 1× an in-game hour is 42 real seconds (RimWorld pace). Test at 3×/6× or headless.

## Status

**Phase 1 (done):** zombie pivot. Roads, ruins, cars, and loot; salvage and repair;
zombie senses, noise, flow-field hunting, and bashing; melee; HP, downed, and death; bites →
infection → turning; the dead rise; Fight/Flee policy with outnumbered and cornered logic;
shelter zones; the Director (intro beats, hordes, strays, events, newcomers); the vector renderer
with night lighting; touch gestures and the touch UI; PWA shell; the no-cache/LAN dev server.

**Phase 2 (done):** medical (Doctor column, bleeding and tending, rescue to bed, medkits
from loot, herbal medicine you can grow, and the **treatable infection** race); a workbench
with ammo, machete, pistol, and rifle (guns are loud); auto-equip and ammo top-up; barricades
(see and shoot through), spike traps (builders re-arm them), watchtowers (+7 sight, +3
range); a guard schedule slot and the Alarm (manual or automatic on hordes); a burn pit with
emergency body hauling; save/load and autosave. Starting kit: pistol, 30 ammo, 3 medkits.

**Balance snapshot** (headless): 3 melee survivors in a walled camp reliably beat 3 zombies,
usually beat 8, and lose to 16+. With the Phase 2 base (barricade line, traps, tower, pistol),
colonies routinely reach day 16 against the Director's real hordes (3–6 by day 10). A debug
horde of 50 on day 10 still wipes 4–5 survivors. Infection: untreated, 4 of 4 died; with a
doctor, medkits, and a bed, 4 of 4 recovered.

**Phase 2b (done):** rooms and roofs (auto-roofing, roof areas, support and collapse, rock
roofs), seasons and day/night temperature, cold snaps and heat waves, heating (wood stove,
campfire) and fuel, hypothermia and heatstroke, seasonal crops and frost, spoilage, zombie cold
slowdown, room thoughts (bedroom, dining, barracks, slept outside or in the cold, cramped),
multi-cell rotatable placement, and the rooms overlay. Sim cost is about 0.5 s of CPU per game
day for a 4-survivor defended base.

**Phase 3 "The Hum" (done, first pass):** see `docs/DESIGN.md` §9. Noise is the price of power
(the Din feeds horde size and strays, and noise-drawn zombies wreck the machine). Fences with
the crowd rule, gates, electric fences, secure yard and breach alerts. Power grids with
generator, solar, batteries and brownouts. Floodlight, siren lure, auto-turret, ammo press,
render vat (corpse → biofuel). Components from cars and loot. Headless: one grid of 3 poles ran
10 machines on 1000 W + solar; a lone zombie barely dents a fence; the siren pulled zombies from
40 squares and they wrecked it; 6 corpses → 48 biofuel.

**Supply Line slice 1 (done, first pass):** the core direction the owner approved (DESIGN §1,
`docs/studio/briefs/2026-09-29-vision-one-pager.md`). Fight/Supply/Flee; the wire is home;
hacking through the wire; 24-round turret magazines refilled at half; the Ammo cache zone;
visible loads, fill rings, and a dry-turret letter. **Test harness:** `tools/supply-test.js`
(in the page console: `(await import('/tools/supply-test.js')).compare([11, 12, 13], { count: 12 })`).
Against 12 hunters, a runner makes 1–3 mid-horde refills (none without one) and the fence holds.
Against 25 at once, a fence section falls in about 40 minutes whatever you do; wave size is
slice 1b's job.

**Component economy (done):** the dead carry parts (`DROPS` in config: 12% a component, 35%
2–6 scrap, dropped where they fall), 9–13 wrecked cars, your own machines refund every
component when taken apart, and electric fences cost scrap only. The Machines tray shows
your stock and what each machine is short of. About 26 components per map plus the field
(`docs/studio/briefs/2026-09-30-component-economy.md`).

**Next:** base defense (CDO brief in progress: nobody answers zombies at the fence unless
armed and in range, and destroyed fence sections are never rebuilt), then slice 1b (announced
waves, steeper Din, after-wave tally), then "What the dead
carried" (item depth), then reclaim. `findWork` per-kind indexes (≈ 5 ms per call now). Name
still undecided.
