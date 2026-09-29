# Design doc (untitled; "Holdout" is only a placeholder label)

> **A touch-first colony sim about keeping a handful of survivors alive, and sane, through the
> zombie apocalypse. You plan; they live it.**

The engine and systems thinking come from RimWorld (see `RESEARCH.md`). The world, the threat,
and the feel are our own: post-apocalyptic, zombie-driven, readable, and made for a tablet.

---

## 1. Pillars

Every feature should serve at least one of these. If it fights one, it needs a very good reason.

1. **Plan, don't puppet.** You never steer a survivor. You shape the world they decide in:
   walls, zones, priorities, schedules, machines. The drama lives in the gap between your plan
   and what tired, scared, bitten people actually do.
2. **The dead are a tide, not a raid.** Zombies are constant environmental pressure. There are
   always a few shambling around, they're drawn by **noise** and **sight**, they're worse at
   **night**, and they build into **hordes**. They don't take cover or reason; they push on the
   weakest point of your walls.
3. **Every system tells a story.** The Director paces events. Needs, mood, and mental breaks
   make survivors crack. Bites mean infection and a countdown. The dead come back. None of it
   is scripted; stories emerge from systems colliding.
4. **Build a machine that keeps you alive.** In the Factorio layer, belts and machines free up
   scarce survivors for the jobs only people can do. But machines need power and fuel, break
   down, and make noise, and noise brings the dead.
5. **Touch-native and readable at any zoom.** Built for fingers first: big targets, clear
   modes, gestures that feel like a maps app. Clean vector art, so it's crisp zoomed all the
   way in on an iPad Pro and readable zoomed all the way out.

## 2. What we take from each influence

| Game | We take | We leave |
|---|---|---|
| **RimWorld** | Indirect control; work priority grid; needs → mood → mental breaks; blueprints → hauling → building; stockpiles; bills; storyteller pacing; traits and skills | Drafting (direct combat control), sci-fi lore |
| **Project Zomboid** | Noise and sight attract zombies; night is dangerous; scavenging ruins and wrecks; barricades; bites → infection | First-person survival micro, a single character |
| **The Walking Dead** | Survivors as people with bonds; **everyone who dies turns** unless you deal with the body; other humans as a second threat; hard choices in events | Main-character plot armor |
| **Prison Architect** | Clean top-down vector look; drawing rooms and zones on a grid; regimes and schedules; the planner's-eye camera | Management-sim distance from the people |
| **Factorio** | Belts, arms (inserters), machines, and power; production chains; throughput thinking; automated defense fed by supply lines | Scale-for-scale's-sake megabases, and combat as the reason to automate at all |

## 3. The loops

- **Moment to moment (seconds):** notice something (an alert, an idle survivor, a zombie at
  the fence), respond with a *plan* (designate, build, re-prioritize), then watch it play out.
- **Daily (≈17 real minutes at 1×):** daylight is for scavenging ruins, farming, and building.
  Dusk is for pulling in and closing the doors. **Night** means more zombies, sight is short,
  and light and noise carry.
- **Arc (weeks):** hordes scale with your wealth, your noise, and time. You grow from a
  campfire in a clearing to a walled compound with farms, a workshop, and a humming,
  belt-fed defense line. The better you do, the harder the Director pushes.

## 4. Indirect defense: how you fight without controlling anyone

This is the key design problem: zombies attack, and the player can't draft. The answer is
**defense by design + policy**:

- **Response policy** per survivor (Work tab column): **Fight** or **Flee**. Fighters engage
  zombies they can see and reach. Fleers run to a **Shelter zone** (or away from the threat).
  Badly hurt fighters flee automatically. "Gentle" survivors can never fight.
- **Walls and doors are the real weapon.** Zombies can't open doors. They **bash** through
  whatever route is cheapest (walls and doors have HP), so layout matters: layered walls,
  chokepoints, doors on the far side. Survivors repair damage between attacks.
- **Weapons are a noise trade-off** (next phase). Melee is quiet but risks bites. Guns are
  safe at range but loud, and a gunshot pulls every zombie within earshot.
- **Later levers, still indirect:** guard posts and a "guard" schedule slot for night watch; an
  alarm bell that switches the whole colony to its threat policy; traps, spike walls, and
  electric fences; turrets fed by ammo belts; floodlights (light draws zombies but lets you
  see them).
- **No drafting.** At most a "rally flag" someday: a place fighters *prefer* to hold, never a
  unit command.

## 5. Zombies

- **Senses:** sight (cone-free radius, blocked by walls and closed doors) and hearing (noise
  events with a radius). They smell survivors within a couple of cells.
- **States:** *wander* (shuffle, drift across the map) → *investigate* (walk to a noise) →
  *hunt* (follow the colony flow field to the nearest survivor, bashing through obstacles).
  A horde spawns already hunting.
- **Movement at scale:** hunting zombies share **one flow field**, a multi-source Dijkstra
  from every survivor where walls and doors cost HP-based "bash time". That makes 100+
  zombies cheap, and they naturally find the weakest point.
- **Types (roadmap):** Walker (baseline), Runner (fast and fragile, appears at night), Brute
  (tanky, bashes quickly), Bloater (bursts into toxic gas), Crawler (slow, hides in grass).
- **Night:** more strays and larger night hordes. Light sources are visible from far away.

## 6. Health, infection, and the dead

- Survivors have HP. They go down at low HP and die at 0. **Wounds bleed** until a doctor
  tends them. Downed survivors bleed out unless someone **rescues** them to a bed.
- **Bites are treatable (owner decision).** A bite starts an infection that races against
  the survivor's immunity, the same shape as RimWorld's diseases. Two bars: **Infection**
  (rising) and **Immunity** (rising). If immunity reaches 100% first, they recover. If the
  infection does, they die and turn.
  - Untreated, the infection wins in about 1.7 days.
  - Treatment every half day slows the infection, scaled by the doctor's skill and the medicine
    (a medical kit beats herbal medicine, and anything beats none). Bed rest speeds immunity.
  - A good doctor with medicine and a bed usually saves them. A bad one might not.
  - The drama is a visible race you can influence but not guarantee.
- **Everyone who dies turns** after a few hours unless the body is dealt with. A **burn pit**
  destroys corpses permanently (haulers carry bodies there). Zombie corpses rot away, and
  bodies lying around hurt mood.

## 7. Survivors

Needs, mood, breaks, skills, traits, and the work grid come from the RimWorld layer.
Survivor-specific additions:
- Melee skill now. Shooting, medical, crafting, and mechanics come with their systems.
- Traits: Gentle (no violence), Brawler, Tough, and more to come (Paranoid, Night owl,
  Scavenger).
- Future: relationships (friend, rival, lover). Watching a friend turn is the worst thought
  in the game.
- Future: other human groups (traders, raiders, people asking to join) with events that force
  choices, like taking in a stranger with a bite on their arm.

## 8. The world

- A procedural map of **grass, forest, water, rock outcrops, roads, ruined buildings, and
  wrecked cars**. Ruins hold loot (canned food, scrap, wood). Cars and ruins can be
  **salvaged** for scrap metal.
- Future: expeditions to off-map locations (like Walking Dead supply runs or RimWorld
  caravans) for rare loot, survivors, and stories.

## 9. Automation (the Factorio layer): planned, a handful of machines

**Owner decision: keep it small, a handful of machines rather than production chains.**
The goal is to *free survivors*, not replace them. Every machine creates new people-work
(refuel, repair) and new risk (noise draws zombies, fuel runs out).

Candidate set (about 6–8 pieces total):

| Piece | What it does | Tension |
|---|---|---|
| Generator | Burns wood or fuel for power | **Loud**, needs refueling |
| Solar panel | Quiet power, daytime only | Expensive (scrap) |
| Conveyor belt | Moves items. Draw it with a finger | Layout space inside walls |
| Loader arm | Moves items between belts, stockpiles, and machines | Needs power |
| Ammo press | Scrap in, ammo out, with no survivor needed | Needs power, makes noise |
| Electric stove | Raw food in, meals out | Needs power |
| Auto-turret | Shoots zombies, fed by an ammo belt | Needs ammo supply and power. Loud |
| Floodlight | Lights the killing zone at night | Light attracts attention |

Touch design: **drag to draw a belt path** (direction follows your finger), tap a machine to
set what it makes.

### Phase 3 spec (ready to build)

**Power, designed for touch.** No wire drawing. **Power poles** join anything within a 6-cell
radius (Factorio-style), and poles within 8 cells of each other link up on their own. Networks
are recomputed only when something is built or destroyed, the same way rooms are.
- Generators and solar panels supply watts. Machines draw watts only while working.
- Batteries soak up any surplus and cover shortfalls.
- If demand exceeds supply and the batteries are empty, it's a **brownout**: machines stop, and
  a letter says which network and why.
- A power overlay (the layers button cycles Rooms → Power → Off) colors each network and shows
  its supply against its demand.

**The pieces** (the core eight, then four optional extras that tie into systems that already exist):

| Piece | Size | Power | Behavior | Hooks it uses |
|---|---|---|---|---|
| Fuel generator | 2×2 | +1000 W | Burns wood; **noise radius 18** while running | fuel system, building tick, `makeNoise` |
| Solar panel | 2×2 | +400 W by day | Silent. Doesn't work under a roof | roofs, time of day |
| Battery | 1×2, rotatable | stores 1000 Wd | Charges from surplus, drains on shortfall | building tick |
| Power pole | 1×1 | — | Connects everything within 6 cells | union-find like rooms |
| Conveyor belt | 1×1, directional | — | Moves an item one cell every ~30 ticks | new item-on-belt layer |
| Loader arm | 1×1, directional | 150 W | Takes from the cell behind (stockpile, belt, machine output), puts to the cell in front | bench `stock` as input buffer |
| Ammo press | 2×2 | 300 W | 5 scrap → 15 ammo with nobody working it; small noise | recipes, bills |
| Auto-turret | 1×1 | 200 W | Shoots zombies within 14 cells, fed with ammo (by arm or by hand); **loud** | combat `shoot`, noise |
| *Electric stove* | 2×1 | 350 W | Cooks meals, no fuel, and it's a kitchen | recipes, rooms |
| *Freezer (cooler)* | 1×1 | 250 W | Pulls its room toward −5°C, so food keeps | room temperature, spoilage |
| *Grow lamp* | 1×1 | 200 W | Plants within 3 cells grow under a roof | roofs block sunlight (2b) |
| *Floodlight* | 1×1 | 100 W | Light radius 12 at night; zombies are drawn to it | lighting, noise |

**What Phase 2b already put in place:**
- **Fuel:** `buildings.js` burning plus refuel jobs. Generators reuse it as is.
- **A per-building tick hook** (`tickBuildings`) where power, production, and noise will go.
- **Multi-cell, rotatable placement** (the ↻ button, footprint preview, `sw`/`sh` on blueprints
  and buildings). Machines are 2×2 and arms are directional.
- **Room temperature and heat sources** for the freezer and electric stove, and **roofs that
  block sunlight** for the grow lamp and solar panels.
- **Spoilage**, which is what makes the freezer worth having.

**Engine work still to do in Phase 3:**
1. Direction as data (`t.dir` 0–3) and a drag gesture that sets it for belts.
2. A belt item layer: items riding belts, separate from ground stacks, drawn sliding.
3. Machine input and output buffers, generalizing bench `stock`.
4. Power networks: union-find and a supply/demand solve every rare tick.
5. The power overlay, and machine inspectors (power status, buffers, recipe).
6. **Performance:** `findWork` costs about 5 ms per call because every WorkGiver scans all
   things. Before machines add more, add per-kind indexes (items, blueprints, designated things)
   updated in `spawn`/`despawn`.

**Milestones:** 3a power (poles, generator, solar, battery, overlay, brownouts, generator
noise), then 3b production (ammo press, then the optional electric stove, freezer, and grow
lamp), then 3c logistics (belts drawn by finger, loader arms), then 3d defense (auto-turret fed
by belts, floodlight).

## 10. The Director (storyteller)

Left 4 Dead's AI Director × RimWorld's Cassandra:
- **Rhythm:** tension → peak → relief. Threat cycles (on/off days) with minimum spacing,
  scaled by wealth, population, days survived, and later your **noise footprint**.
- **Threat points → horde size** (≈12 points per walker). Early: a lone walker on day 1, a
  small pack on day 3. Hordes start on day 7.
- **Background pressure:** strays wander in all day, and more at night.
- **Events:** supply crates (a helicopter drop is loud), survivors asking to join, blight,
  bumper harvests, distant screams, clear nights, looters. Later: events with choices.
- **Presets (later):** *The Warden* (steady ramp), *The Mercy* (long quiet stretches), *The
  Chaos* (random).

## 11. Touch UX principles

- **Gestures:** one finger pans (with inertia) and tap selects. In a tool, one finger
  **paints** and tap applies once. **Two fingers always pan and pinch-zoom**, and a second
  finger landing cancels any paint in progress. Mouse, trackpad, and keyboard all work as
  extras.
- **Modes are explicit:** the active tool shows as a chip with a hint and a big **Done**.
- **Thumb-reach layout:** a tool dock at the bottom center, time controls and alerts at the
  top, the inspector on the right (a bottom sheet in portrait).
- **Targets ≥ 44 pt.** Nothing important lives only in a hover tooltip.
- **Alerts are tappable** and jump the camera to the event.
- **Pause is king:** one big pause button. Later: optional auto-pause on hordes and bites.
- **Distribution (owner decision):** a web app / PWA for now (Add to Home Screen, full screen,
  safe areas, autosave), **App Store later** through a native wrapper (Capacitor). So: no
  browser-only APIs we can't replace, saves go behind one small module (`save.js`), and
  everything stays touch-first.

## 12. Art direction

- **Flat vector**, drawn entirely from code (Canvas paths). Nothing is a bitmap, so it stays
  crisp at any zoom and costs no asset pipeline.
- **Terrain as soft shapes:** marching-squares contours give each region clean 45° chamfered
  edges. Natural things are soft-edged; man-made things (roads, concrete, walls) are
  crisp-edged.
- **Hairline outlines** at a constant screen width. One light direction, so shadows fall
  down-right.
- **People, top down:** shoulders and head rotated to face their movement. Survivors wear warm
  clothing colors. Zombies are desaturated grey-green with **arms reaching forward**, readable
  from any zoom.
- **Walls connect** to their neighbors like Prison Architect's.
- **Night lighting:** the map darkens and fires and torches cut warm pools of light.
- **Level of detail:** fine details drop out when zoomed far out so the map stays readable.
- UI icons are SVG in the same stroke style as the world.

## 13. Tech

- Vanilla JS modules, no build step or dependencies (house style). Canvas 2D.
- Sim, render, and UI are separate. The sim is plain data and can run headless for testing.
- Performance budget: 60 fps on iPad with ~150 zombies. Zombies share one flow field.
  Terrain is cached as per-chunk vector paths. Only visible things are drawn.
- If Canvas 2D ever becomes the bottleneck, the renderer is isolated enough to swap in WebGL.

## 14. Roadmap

**Phase 1: pivot foundation (done)**
Zombie theme; roads, ruins, cars, and loot; salvage; zombie AI (senses, flow-field hunting,
bashing); melee combat; HP, downed, and death; infection and turning; the Director with
hordes and strays; fight/flee policy and shelter zones; repair; the vector renderer with
night lighting; touch gestures and the touch UI (dock, tool chip, tappable alerts); PWA shell.

**Phase 2: survival depth (done)**
Medical (doctors, bleeding and tending, rescue, medicine, treatable infection); a workbench with
weapons and ammo, where guns mean noise; barricades, spike traps, and watchtowers; a guard
schedule and alarm; a burn pit; save/load with autosave.
**Phase 2b: rooms and climate (done)**
Rooms (walls, doors, and rock bound them; roles; impressiveness), auto-roofing plus roof areas,
roof support and collapse, natural rock roofs; seasons, day/night temperature, cold snaps and
heat waves; room heating (wood stove, campfire) with thermostats; hypothermia and heatstroke;
crops need warmth and open sky, frost kills them, and sowing follows the season; food spoils
unless kept cold; zombies slow down in the cold; fuel and refueling; multi-cell rotatable
placement (the 2×1 table). The rooms/roofs/temperature overlay.

**Phase 3: automation (next)**
A handful of machines. The full spec, what's already prepared, and the milestones are in §9.

**Phase 4: people and the world**
Relationships, human factions, choice events, expeditions, and more zombie types.

**Phase 5: ship it**
Tutorial, settings, Director presets, audio, and PWA/Capacitor packaging.

## 15. Decisions and open questions

**Decided:**
- Bites are **treatable** (the infection-vs-immunity race, §6). Everyone who dies still
  turns.
- Automation is **a handful of machines** (§9).
- **Web app now, App Store later** (§11).

**Still open:**
1. **Name.** Undecided. "Holdout" is just the working label in code and UI.
2. **Scope of the world.** One map, or a map plus expeditions?
