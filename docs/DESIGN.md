# Design doc (untitled; "Holdout" is only a placeholder label)

> **A touch-first colony sim where your fortress runs on people: someone carries every bullet,
> and the dead you kill pay for the next ones. You plan; they live it.**

The engine and systems thinking come from RimWorld (see `RESEARCH.md`). The world, the threat,
and the feel are our own: post-apocalyptic, zombie-driven, readable, and made for a tablet.

The vision was approved by the owner on 2026-09-29. The full reasoning is in
`studio/briefs/2026-09-29-vision-one-pager.md`.

---

## 1. Pillars

**The heart: the base is the body, and the people are the blood.** Building is the half you can
see. The core fun is the test the building exists to pass:
- **A fortress problem is solved by a person going somewhere dangerous.** When the east gun runs
  dry, somebody runs it a crate.
- **A people problem shows up as a fortress problem.** A bitten runner is a gun that goes quiet.

Every feature should serve at least one pillar. Each pillar comes with a test that a feature can
fail. A feature that fights a pillar needs a very good reason.

| Pillar | What it means | A feature fails it if… | Pulls against |
|---|---|---|---|
| **1. The base runs on people.** | Guns, machines, and fires work only while survivors walk supplies to them. You fix shortages with layout and policy, never with orders. The drama lives in the gap between your plan and what tired, scared, bitten people actually do. | A machine runs without anyone ever walking to it, or a tool tells a named survivor to do a named thing. | 2: more people and machines means more noise. |
| **2. Noise is the dial.** | Every machine, gunshot, and generator has a volume. Louder brings more of the dead all the time, bigger waves, and more to harvest. | A new source of income costs no noise and no risk, or the player can't see a noise cost before choosing it. | 3: the harvest pays best when you're loudest. |
| **3. Everything the dead carried is worth something.** | Items come from bodies, buildings, and cars, and each has more than one use. Your own dead come back carrying their things. | An item has only one use, or it comes from nowhere in this world (a research unlock, a shop). | 1: collecting means sending people past the wire. |

**Non-negotiables** (constraints, not pillars):
- **Indirect control:** you never steer a survivor.
- **Touch first:** big targets, clear modes, and gestures that feel like a maps app.
- **Vector only:** everything drawn from code.
- **Readable at any zoom:** crisp zoomed all the way in on an iPad Pro, and readable zoomed all
  the way out.

### Anti-pillars: what we are not

- **Not a tower defense:** no fixed waves, no upgrade shop, and no lanes drawn for you.
- **Not a factory:** no belts or inserters, and no ratio math. About ten machines.
- **Not a puppet show:** no drafting, no "go here", and no crew posted to a specific gun.
- **Not a drama you only watch:** no scripted plots. Stories come from systems colliding: the
  Director paces events, mood breaks people, bites start a countdown, and the dead come back.
- **Not a loot treadmill:** no rarity colors or gear scores. Items are things with uses, not
  numbers going up.
- **Not an army:** a colony peaks at around 10–15 people you know by name. Growth is earned, and
  sustainability is the cap.

## 2. What we take from each influence

| Game | We take | We leave |
|---|---|---|
| **RimWorld** | Indirect control; work priority grid; needs → mood → mental breaks; blueprints → hauling → building; stockpiles; bills; storyteller pacing; traits and skills; deep, useful items (re-sourced from the dead and the town, not RimWorld's list) | Drafting (direct combat control), sci-fi lore |
| **Project Zomboid** | Noise and sight attract zombies; night is dangerous; scavenging ruins and wrecks; barricades; bites → infection | First-person survival micro, a single character |
| **The Walking Dead** | Survivors as people with bonds; **everyone who dies turns** unless you deal with the body; other humans as a second threat; hard choices in events | Main-character plot armor |
| **Prison Architect** | Clean top-down vector look; drawing rooms and zones on a grid; regimes and schedules; the planner's-eye camera | Management-sim distance from the people |
| **Factorio** | Machines and power; your output feeds your enemy (pollution → the Din); turrets that must be fed; status readable at a glance | Belts and inserters, ratio math, and scale for its own sake |
| **Cosmoteer** | People are the logistics, visible and fixed by layout; design, test, redesign | Piloting, and crew posted to stations |
| **They Are Billions** | Announced waves with a direction and a countdown; clearing pays twice; the finale is everything left alive | Unit command, and one leak ending a run |

## 3. The loops

```
build and scavenge ──► the TRICKLE tests your routine (guards, turrets, runners)
      ▲                    costs ammo and repairs, pays in drops
      │                                  │
      │                    a WAVE is announced (direction, size, countdown)
      │                                  │
  louder, richer          prepare: stock caches, top up guns, pull in, pick your noise
      ▲                                  │
      │                    the wave hits: runners feed the line, fighters hold the wire
      │                                  │
      └──── the MORNING AFTER: salvage what the dead carried, repair, redesign
```

**The threat rhythm is a sawtooth, not a horde every night:**
- **Always:** the dead trickle in, more at night. The Din sets how many. The trickle tests your
  routine, and it's your upkeep and your income at once.
- **Every few days:** a wave, announced about half a day ahead with its direction, size, and a
  countdown. Its size comes from your average noise since the last wave, and it locks when
  announced. The wave tests your design.
- **After:** salvage, repair, redesign. The trickle comes back a little stronger.

**Guard duty is a cost, not a click.** You set a guard shift and place posts, and your noise
decides how many guards you need. Posts need ammo and light, and runners bring them.

**At each timescale:**
- **Moment to moment (seconds):** notice something (a fill ring draining, a runner crossing the
  yard, a zombie at the fence). Respond with a *plan*: designate, build, re-prioritize, or move a
  cache. Then watch it play out.
- **Daily (≈17 real minutes at 1×):** daylight is for scavenging ruins, farming, and building.
  Guard shifts hold the trickle, which is heavier at night, when sight is short and light and
  noise carry.
- **Wave (every 4–7 days):** announcement, preparation, the stand, and the morning after.
- **Arc (weeks):** the trickle and the waves scale with your noise, your wealth, and time. You
  grow from a campfire in a clearing to a walled compound with farms, a workshop, and a humming
  defense line fed by runners. The line pushes outward into reclaimed districts, and the run ends
  at the radio-tower siege.

**What the player should feel, in priority order (MDA):**
1. **Challenge:** the wave tests your design. This is the core fun.
2. **Narrative:** the people make it a story. The owner has said it can sit second or third,
   behind the challenge.
3. **Discovery:** what the dead carried, and what the town held.
4. **Expression:** your compound, your lanes, your caches.
5. **Sensation:** loads moving and guns barking, in clean vector.
6. **Fantasy:** leading survivors through the end.
7. **Submission:** the calm routine of the trickle.

Fellowship is out of scope.

**Where item depth lives:**
- **The dead keep what they had,** and they dress for what they carry: police blue means rounds,
  scrubs mean medicine, and overalls mean tools.
- **Each district holds its own goods.**
- **Every item has a source you can point to and at least two uses.**
- **Luxuries are mood levers.**
- **Your own dead drop their own gear.**

The details are the next brief, "What the dead carried".

## 4. Indirect defense: how you fight without controlling anyone

This is the key design problem: zombies attack, and the player can't draft. The answer is
**defense by design + policy**:

- **Response policy** per survivor (Work tab column): **Fight**, **Supply**, or **Flee**.
  - **Fighters** engage zombies they can see and reach.
  - **Supply** survivors keep the guns fed and the generator running during an attack, and back
    off only from a zombie that can actually reach them.
  - **Fleers** run to a **Shelter zone** (or away from the threat).
  - Badly hurt fighters flee automatically. "Gentle" survivors can never fight, but they can be
    runners.
  - *(Supply was approved 2026-09-29 and is being built in the Supply Line slice 1; see
    `studio/briefs/2026-09-29-supply-line-slice.md`.)*
- **The wire is home.** Inside the secure yard, idle survivors stay inside it, and fighters don't
  go out through the gate to fight.
- **Hacking through the wire** (the owner's idea, approved 2026-09-29):
  - Fighters with a melee weapon go to the fence line when the dead arrive, and hack at zombies
    through chain-link, gates, and barricades. It's quiet, so it thins the horde without feeding
    the Din.
  - It isn't free. The dead grab back through the wire (at half their open-melee hit rate, with
    the same bite chance). The hacker is bait: the crowd gathers at their section, and 3 or more
    tear it down.
  - You can't reach through a powered electric fence. Switch that line Off to make it a hack line.
  - The full spec is the slice brief's addendum.
- **Walls and doors are the real weapon.** Zombies can't open doors. They **bash** through
  whatever route is cheapest (walls and doors have HP), so layout matters: layered walls,
  chokepoints, doors on the far side. Survivors repair damage between attacks.
- **Weapons are a noise trade-off** (next phase). Melee is quiet but risks bites. Guns are
  safe at range but loud, and a gunshot pulls every zombie within earshot.
- **Later levers, still indirect:** guard posts and a "guard" schedule slot for night watch; an
  alarm bell that switches the whole colony to its threat policy; traps, spike walls, and
  electric fences; turrets fed by runners; floodlights (light draws zombies but lets you
  see them).
- **No drafting.** At most a "rally flag" someday: a place fighters *prefer* to hold, never a
  unit command.

## 5. Zombies

**The dead are a tide, not a raid.** Zombies are constant environmental pressure. There are
always a few shambling around, they're drawn by **noise** and **sight**, they're worse at
**night**, and they build into **hordes**. They don't take cover or reason; they push on the
weakest point of your walls.

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

### The resource loop: "the dead are the mine, the town is the frontier"

**The problem (owner playtest, after Phase 3):** almost everything on the map is a one-time
deposit. Trees never regrow, scrap and components come only from finite ruins and cars, and
stone from finite rock. By about day 20 the map is stripped and there's no reason to build
bigger. Approved direction, in build order:

1. **A renewable floor.** Survivors can plant tree plots, and wild trees slowly re-seed near
   other trees. Not exciting, but running out of wood forever feels bad.
2. **The horde is the harvest.** Zombies were people and carry things: scrap, cloth, ammo,
   and sometimes medicine or components. With the render vat's biofuel, every kill pays. This
   turns the Din into a dial the player controls: quiet when weak, loud when you want
   resources. A siren kill zone becomes a farm; you ring the dinner bell on purpose.
3. **Reclaim the town.** The map holds named districts (pharmacy, police station, hardware
   store, gas station), each infested, with its loot locked behind clearing it. Clear and fence
   one and it becomes territory with a lasting perk (medicine, guns, components, fuel).
   Building bigger literally means pushing the fence outward; more territory means a longer
   perimeter to hold.
4. **Runs beyond the map** (Phase 4): send a team off-map for days to places on a world map.
   Near places run dry, so you go farther. Teams come back with loot, strangers, or bites.
5. **A long goal:** a radio tower built in stages that needs parts from every district type.
   Each stage is louder and draws bigger hordes; the broadcast brings survivors, and finishing
   it triggers a final siege. The arc of a whole game.

## 9. Phase 3: "The Hum" (machines, fences, and noise)

**Owner direction:** a handful of machines, fences that keep zombies out so machines are safe,
and **make it ours**, not RimWorld power plus a zombie mod.

The question that decides it: what does a machine mean in a zombie world? In RimWorld it's
convenience. Here **every machine is a trade between labor and noise**, and noise is what the
dead follow. Automation is a way of managing the horde, not just producing more stuff.

### The five ideas

1. **The Din (noise is the price of power).** Every running machine emits noise pulses, and the
   colony's total shows as a meter: Quiet → Humming → Loud → Deafening. A louder colony draws
   more strays and bigger hordes. Zombies drawn by a noise go for **the machine making it**.
   Machines have a mode (On / Day only / Off), so running a generator only by day and staying
   quiet at night is a real choice.
2. **Yards, not rooms.** Chain-link **fences** are cheap, see-through, and fast to drag out,
   with **gates** for people. The rule is easy to read: **a lone straggler just rattles a
   fence; it takes a crowd (3+) pushing together to tear it down.** The game computes your
   **secure yard** (cells zombies can't reach without breaking something), shows it in the
   overlay and HUD, and alerts on a **breach** the moment one gets inside. **Electric fences**
   shock and stagger whatever touches them.
3. **Herd the dead.** A **siren** is a powered lure that pulls zombies from far away. Put it
   outside the fence, ring it with spike traps and an auto-turret, and noise becomes a weapon:
   a kill zone.
4. **The dead fuel the living.** A **render vat** turns zombie corpses into **biofuel** for
   generators. Kill → render → power → turrets → kill: the colony's machine loop runs on the
   horde.
5. **Components send you outside.** Machines need **components** salvaged from wrecked cars and
   ruins beyond the fence. Automation is the reason to take risks.

Plus two rules that keep it touch-friendly and human:
- **No conveyor belts.** Machines run themselves as long as haulers keep them stocked (ammo
  press, render vat) or fueled (generator) or loaded (turret). People become supply crews, not
  machine operators.
- **Machines break.** Zombies wreck noisy machines and brownouts stop them. A broken machine
  stops until a builder repairs it. Machines inside the fence are the safe ones.

### The pieces

| Piece | Power | What it does | Tension |
|---|---|---|---|
| Chain-link fence / gate | — | Cheap scrap barrier; stragglers can't break it alone | Hordes push it over; see-through, so no shelter |
| Electric fence | 15 W each | Shocks and staggers attackers | Needs power, so it fails in a brownout |
| Power pole | — | Connects everything within 6 cells; poles within 8 link up | Layout |
| Fuel generator (2×2) | +1000 W | Burns wood or biofuel, only when there's demand | **Loud**; the Din's main source |
| Solar panel (2×2) | +400 W by day | Silent. Dead at night and under a roof | Needs components; needs batteries for nights |
| Battery (1×2) | stores 1500 Wd | Covers nights and brownouts | Components |
| Floodlight | 100 W | Lights 11 cells at night; guards see zombies in the light | The light draws them |
| Siren | 150 W | Lure: pulls idle zombies within 40 cells | That's the point: use it away from home |
| Auto-turret | 150 W | Shoots zombies within 13 cells; loaded with ammo by haulers | Loud; eats ammo |
| Ammo press (2×2) | 300 W | Scrap → ammo, nobody working it | Hum; haulers feed scrap |
| Render vat (2×1) | 150 W | Zombie corpses → biofuel | Hum; also disposes of bodies (they can't rise) |

### How it plays (a session sketch)
Day 12, the scrap fence is up around the fields, and a straggler rattles it at 3am. The tower
guard shoots it, and the render vat turns the body into fuel by morning. Day 20, the generator
runs the ammo press through the day, and the Din reads "Loud". A horde arrives from the north,
drawn by it. They mob the generator yard, three at a time push over the fence, and the electric
section holds long enough for the turret. Day 30, you build a siren two hundred meters out, ring
it with traps, and switch it on at dusk.

### Engine notes
- **Power** (`power.js`): union-find over poles, rebuilt when anything powered is built or
  destroyed. Every rare tick each network balances supply and demand through its batteries,
  and a shortfall is a brownout with a letter.
- **Secure yard** (`perimeter.js`): a flood fill from the map edge over cells zombies can enter
  without bashing. Unreached pockets people can stand on are secure **if something the colony
  built bounds them** (a sealed room in a ruin doesn't count). It's rebuilt when any blocking
  building changes.
- **Din**: running machines pulse `makeNoise` every rare tick. `w.din` feeds the Director's
  threat points and stray rate. Zombies investigating a noise remember its source and **wreck**
  it (state `wreck`).
- Machines reuse bench bills (`workType: 'machine'`, haulers stock them) and the fuel/supply
  system (generator fuel, turret ammo).
- Later, if wanted: electric stove, freezer, grow lamp (the hooks already exist: rooms,
  spoilage, and roofs blocking sunlight), and `findWork` per-kind indexes for performance.

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

**Phase 3: "The Hum" (done, first pass)**
Fences, gates and electric fences with the crowd rule; secure yard and breach alerts; power
poles, grids, generator, solar, batteries, brownouts; the Din and machine-wrecking zombies;
floodlight, siren, auto-turret, ammo press, render vat; components from cars and loot; machine
modes (Always / Day only / Off); Machines dock tray, machine inspector, yard and Din HUD chips,
and a layers button that cycles Rooms → Yard → Power. See §9. Still open: balance passes on the
Din and horde scaling with real play, and the "later" machines in §9.

**Supply Line, slice 1 (done, first pass):** the Supply response, "the wire is home", hacking
through the wire, 24-round magazines with a refill point, the Ammo cache zone, visible loads,
fill rings, and the dry-turret letter (`docs/studio/briefs/2026-09-29-supply-line-slice.md`).

**Supply Line, slice 1b (next):** announced waves with a size lock and a countdown chip, a
steeper Din, and the after-wave tally. Then the **"What the dead carried"** brief (item depth,
drops outside the wire, the dawn salvage), then **reclaim** (districts and territory, §8).

**Phase 4: people and the world**
Relationships, human factions, choice events, expeditions (§8 item 4), the radio tower (§8
item 5), and more zombie types.

**Phase 5: ship it**
Tutorial, settings, Director presets, audio, and PWA/Capacitor packaging.

## 15. Decisions and open questions

**Decided:**
- Bites are **treatable** (the infection-vs-immunity race, §6). Everyone who dies still
  turns.
- Automation is **a handful of machines** (§9).
- **Web app now, App Store later** (§11).
- The resource loop is **"the dead are the mine, the town is the frontier"** (§8).
- **The core direction is the Supply Line** (2026-09-29): the base is the body, and the people
  are the blood (§1). The hook, three pillars, and anti-pillars are approved as written in
  `studio/briefs/2026-09-29-vision-one-pager.md`.
- **The threat rhythm is a noise-driven trickle plus announced waves,** not a horde every night
  (§3). A wave's size locks when it's announced.
- **The aesthetic priority is Challenge first.** Story ranks second or third (§3).
- **A colony peaks at 10–15,** capped by sustainability, not by a hard number.
- **Drops are worth going loud for,** and item depth is core. It's sourced from what the dead
  carried and what the town held (§3; the next brief is "What the dead carried").
- **Supply response and hacking through the wire:**
  - Supply is a third Response.
  - Gentle survivors can be runners.
  - The wire is home: fighters don't go out through the gate.
  - Melee fighters can hack through the wire (§4).
  - Waves come with a 12-hour warning, and the day-3 pack is the first announced wave.

**Still open:**
1. **Name.** Undecided. "Holdout" is just the working label in code and UI.
2. **Scope of the world.** One map, or a map plus expeditions?
