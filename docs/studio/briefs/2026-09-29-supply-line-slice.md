# Feed the guns: the Supply Line, slice 1

**Status:** approved by the owner, 2026-09-29; slice 1 in build · **Cost:** S (one session) for slice 1, then S for slice 1b ·
**Serves pillar:** 1, the base runs on people (plus 2, noise is the dial, in 1b) · **Strains
pillar:** none. It's the first slice of the direction in `2026-09-29-vision-one-pager.md`.

## 1. The problem

**The owner's words:** *"i dunno what the core game is overall or what is fun or anything just
buiding and what we see now is kind of my 50%."* **What a player feels in the build today** (from
my tests): *"The horde comes, the turret goes quiet, and nobody does anything about it. I can't
even tell it's empty. My people just wander off."*

**The root cause, separated from the symptom:** during a fight, the fortress and the people don't
touch.
- **The supply chain stops.** The alarm sends everyone to a tower or to shelter. A sighting
  interrupts all work. The refill giver also refuses any turret with a zombie within 3 cells,
  which is every turret on the line.
- **The wire doesn't hold people.** Idle wandering and melee fighters both walk out through the
  gate.
- **Nothing shows the chain.** Carried loads and magazine levels aren't drawn.

**Measured today** (headless; seeds 11, 12, 13; a fence ring with a gate, two powered turrets, and
150 rounds three cells inside the east fence; 3 survivors; 25 hunting zombies):
- **Refills:** zero mid-horde refills in 6 of 6 runs (magazine 60 or 24).
- **Deaths:** the first death came at 0.6–1.6 in-game hours. Everyone was dead within 24 h in 5
  of 6 runs.
- **Dry guns:** with a 24-round magazine, the turrets sat empty for up to 3.7 turret-hours
  mid-horde, with the ammo three steps away.
- **Wandering:** in seed 12, all three survivors had wandered out of the gate before the horde
  arrived.

## 2. The idea

**When the dead come, the survivors you set to Supply keep the guns fed and the generator running,
and you watch every crate cross the yard. The wire becomes home: nobody idles outside it, and
fighters hold it instead of opening the gate.**

**Target feeling:** Challenge (the design is being tested), Narrative (it's Gus who's running), and
Sensation (you can see the chain work).

**The moment:** the ring on the east turret goes amber, then red, and it stops barking. A small
figure with an olive crate in her arms comes out of the cache corner, crosses twelve squares of
open yard while the fence shakes, and the gun starts again.

## 3. The loop

**Verbs:**
1. Set a Response and paint a cache.
2. Haulers stock the cache.
3. The dead arrive, and the rings drain.
4. Runners fetch from the nearest ammo and feed the gun.
5. The guns keep firing and the dead fall.
6. Quiet returns, and you fix the layout: move the cache, add a lane, add a runner.

**Economy:**
- **Sources:** rounds from the press, the workbench, and loot. Fuel is wood or biofuel.
- **Sinks:** rounds fired (about 3 per kill), fuel burned, and runner risk (bites, and time not
  spent building).
- **Converter:** the runner turns a walk into gun uptime.
- **Reinforcing loop:** a short run keeps the gun firing, which leaves fewer dead at the wire and
  makes the next run safer.
- **Brakes:**
  - **Magazine size:** each gun needs feeding mid-fight.
  - **Turret noise:** 22 per shot, which feeds the trickle.
  - **The crowd rule:** a broken fence makes every run deadly.
  - **Distance:** the walk is set by your layout.

**The decision, and its cost:** *who runs, and where the ammo sits.*
- **Each runner is a fighter you lose on the wall,** and a person you put in the open.
- **Your best shot as a runner** means fewer guns on the wire.
- **Your only doctor as a runner** risks the person who treats bites.
- **A Gentle runner** costs nothing in firepower, but can't fight back when cornered.
- **A cache near the line** shortens runs, but it's where the fence breaks first.

Two good players will split differently.

**At each timescale:**
- **Moment:** a run is 10–20 seconds you watch.
- **Day:** the trickle means small top-ups, and a pre-wave "stock the caches".
- **Wave:** runners decide whether the line holds.
- **Run:** lanes, caches, and runners are redesigned as the line grows outward.

## 4. Three stories

1. **Loss and recovery:** Gus is the retold moment from the one-pager. The gun holds, he's bitten
   on the way back, two days of the infection race follow, and he never runs again.
2. **Someone finds a role:** "Nell is Gentle, so in every horde she just hid. I set her to Supply
   and painted a cache by the east gate. She kept both guns fed all night and woke up with *Kept
   the guns fed*. Now she's the first name I check when the warning comes."
3. **A layout loss:** "One runner, two needs. Both turrets were fine, but the generator ran out
   of fuel mid-wave, the turrets went dark, and the north fence went down. Next day I moved the
   biofuel cache next to the generator and made Rosa a second runner."

## 5. Mechanics

**Slice 1, "Feed the guns" (one session):**

**A. The Supply response.**
- **The data:** `p.response` gains `'supply'`. The Response button cycles Fight → Supply → Flee.
  Gentle survivors cycle Supply ↔ Flee. Defaults are unchanged. `canFight` stays Fight-only.
- **Under threat** (`threatResponse` in `combat.js`):
  - A Supply survivor who is cornered follows today's rule (they fight back unless Gentle).
  - Otherwise, if a **reachable** zombie is within 3 cells, they flee to shelter.
  - Otherwise they carry on, returning null. "Reachable" means the zombie isn't fenced out: if the
    survivor is in the secure yard, only zombies inside the yard count.
- **Sighting interrupts:** don't interrupt a Supply survivor's supply job under the same rule.
- **Under alarm** (`alarmJob` in `think.js`): Supply survivors take **supply work first**, then
  go to shelter if there's none. During a threat or alarm, they run only the refill giver (fuel
  and ammo slots) plus the emergency body haul. This ignores their Haul priority. Outside threats
  they work normally.
- **The near-zombie rule for supply** (`zombieNear` in `work.js`, for the refill giver and the
  item it fetches): when the target or item is inside the secure yard, count only zombies inside
  the yard. Every other giver keeps today's 3-cell rule. Guns outside the wire stay risky on
  purpose.
- **Reuse:** `supplies()`, `needsSupply`, `refuelJob`, the hauling refill giver, shelter zones,
  `setAlarm`, and the emergency pass.
- **A new thought:** "Kept the guns fed", mood +6 for 2 days, stack 1. It's granted when a Supply
  survivor completes a refill while `story.hordeActive`. (Feel knob; range +3 to +10.)

**B. The wire is home.**
- **Idle wandering:** a survivor standing in the secure yard wanders only to cells inside it
  (filter in `randomReachableCell`).
- **Melee fighters** in the yard don't engage zombies outside it, unless cornered. So they don't
  open the gate.
- **Shooters** in the yard fire through the wire but never path out of the yard to engage.
- **Reuse:** `isSecure` and `w.secure` from `perimeter.js`.

**C. Visible loads, and fill rings.**
- **Loads:** a survivor with `p.carrying` draws that item's own sprite (the art is already in
  `art.js`) at about 55% size, held about 0.35 cells ahead of the body along their facing. A
  carried corpse uses the existing `drawLying`, as `carryingPawn` does. At far zoom (`lod` 0) it's
  a 3 px dot: brass for ammo, red for fuel, brown for wood, grey for anything else.
- **Fill rings:** every building with a `supplies()` slot draws a thin ring around its footprint.
  The track is dark at 30% opacity, and the fill arc runs clockwise from 12 o'clock. The colors
  reuse the health bar's: green above 50%, amber from 1 to 50%, and red with a slow 1 Hz pulse at
  0.
- **When rings show:** always on turrets and generators at `lod` ≥ 1. On stoves and campfires only
  at 50% or below. Red always shows, at every zoom.
- **The dry letter:** when a turret hits 0 during an active horde, one letter per turret per
  horde: "The east turret is out of rounds." It's tappable, and the direction is from the colony
  center.

**D. Magazines and caches.**
- **The magazine:** `autoTurret.ammoFeed.capacity` goes from 60 to 24 (feel knob; range 16–48).
  24 rounds is about 8 kills, or about 28 s of continuous fire at 1×.
- **The refill point:** add a per-slot `refillAt` (default 0.4; ammo slots 0.5), so a gun is
  topped up at 12 rounds.
- **The Ammo cache zone preset:** in the Zones tray, "Ammo cache" is a stockpile preset with
  `allow = {ammo, biofuel}` and the highest priority. The runner already fetches the nearest ammo,
  so a cache by the line shortens every run.

**Slice 1b, "The rhythm" (the next session):**

**E. Announced waves.**
- **When** the Director's cycle decides a horde (same logic as today), it announces instead of
  spawning.
- **What it locks at announcement:**
  - the side (`edgeCell`) and origin;
  - `count`, from `threatPoints`, using the **average Din since the last announcement** in place
    of the current Din;
  - arrival in 12 ± 2 in-game hours (gate knob; range 6–18). That's about 8 minutes at 1× and
    about 3 at 3×.
- **The data:** `w.story.wave = {at, x, y, side, count}`, plain data, so it's saved. At `at`,
  spawn exactly `count` there, unless the 150 cap binds.
- **The Din average:** `w.story.dinAcc` and `dinN` accumulate every rare tick, and reset at each
  announcement.
- **The first announced wave:** the scripted day-3 pack is announced 6 h ahead, as the tutorial.
  The day-1 walker stays a surprise.
- **HUD:** while a wave is pending, the threat chip shows a direction arrow plus "25 · 11h". Tap
  it to jump to the origin. On arrival it switches back to the hunting count.

**F. A steeper Din** (config only; curve knobs). Strays per day are computed from the Director's
numbers:

| Setting | Old | New | Range |
|---|---|---|---|
| `DIN.strayPer` | 1/40 | 1/20 | 1/40–1/10 |
| `DIN.hordePer` | 1/100 | 1/50 | — |
| `DIN.hordeMax` | 0.6 | 1.2 | — |

| Din | Old strays/day | New strays/day |
|---|---|---|
| Quiet (0) | 2.9 | 2.9 |
| Loud (30) | 5.1 | 7.3 |
| Deafening (60) | 7.3 | 11.6 |

At Deafening, a wave comes out at ×2.2.

**G. Stretch: the after-wave tally.** Extend the existing "The attack is over" letter with
counters kept during `hordeActive`: kills, rounds fired, dry events per turret, fence sections
lost, and survivors hurt.

## 6. UX (touch)

**Where it lives:**
- the Response button (the Work sheet and the survivor inspector);
- the Zones tray (Ammo cache);
- rings and loads on the map;
- the letters;
- in 1b, the threat chip.

**Touch walkthrough:**
- **Make someone a runner:** tap their roster chip (1), then tap "When the dead come" until it
  reads Supply (1–2). **2–3 taps.** From the Work sheet it's 3–4.
- **Place a cache:** Zones (1), Ammo cache (1), drag a 2×2 near the guns (1), Done (1). **4
  taps.** You do this occasionally, not often.
- **Notice a dry gun:** a red ring, **0 taps**; or tap the letter (1) and the camera jumps.
- **See who's running:** the crate in their arms, **0 taps**; tap them (1) for "running rounds to
  the east turret".
- **React to a warning** (1b): tap the letter or chip (1), and the camera shows the gathering
  point.

**Copy, in the game's voice:**
- **Work sheet help:** "Response: what a survivor does when the dead come. **Fight** them.
  **Supply**: keep the guns fed and the generator running. **Flee** to a Shelter zone."
- **Inspector:** "When the dead come: Supply" (a crate icon). Job report: "running rounds to the
  east turret".
- **Cache hint:** "A small stockpile for rounds and fuel. Put it near the guns: haulers fill it
  in quiet times, runners grab from it in a fight."
- **Warning (1b):** "A horde is gathering to the east, about 25 of them. They'll be here in about
  12 hours. Stock the caches."
- **Tally (1b, stretch):** "The horde is broken. 23 dead at the wire, 71 rounds fired. The east
  turret ran dry twice. Gus was bitten."

## 7. Robustness

**Degenerate strategies:**
- **Everyone on Supply:** the turrets do all the killing, and a breach has no fighters. It's a
  valid, fragile build; accept it.
- **A cache hugging every turret:** runs become trivial. The counter is scarcity: turrets cost 5
  components (about 17 on a map), and every shot is noise. A good layout *should* be rewarded
  (Cosmoteer). Accept it knowingly.
- **Go loud right after an announcement:** the wave is locked, but that noise counts toward the
  next wave's average, and it swells the trickle now. No exploit.
- **Stay silent forever:** waves still come, at the 36-point floor (about 3 zombies), and the
  harvest (next brief) stays thin. That's a valid, poor strategy.

**Boundaries:**
- **No Supply survivors:** behavior is exactly as today, plus "the wire is home".
- **No ammo on the map:** runners find nothing, the ring goes red, and the letter fires once.
- **Power out:** the turrets go dark, and runners feed the generator first if it's the nearest
  need.
- **A turret outside the wire:** today's 3-cell rule applies, so it starves in a fight. That's
  intended; outside guns are the gamble.
- **No secure yard at all:** the relaxed rule never applies, and Supply acts like a braver Flee.
- **Day 200:** wave size is capped by `threatPoints` (10,000) and the 150-zombie room.

**Pre-mortem:**
1. **"Supply is a death sentence."** Only unfenced zombies within 3 cells scare runners off, and
   a fence is safe to stand behind (biting needs adjacency). A broken fence changes that, which is
   the drama. The acceptance test measures runner death.
2. **"Runners shuttle all day, even in peace."** In peace, refills stay ordinary hauling, as
   today. The 50% refill point on a 24-round magazine means a top-up every ~4 stragglers. If it's
   too busy, raise the magazine to 32.
3. **"I can't read any of it on the iPad."** Rings and loads are drawn at every zoom (as dots
   when far out), red always wins, and a dry gun sends a letter. The owner tests this on the iPad.
4. **(1b) "The countdown is dead time, so I fast-forward."** The warning says what to do ("Stock
   the caches"), and the trickle keeps running. If the owner still skips it, cut the lead time to
   6–8 h.

## 8. Not doing

**Deferred to later layers:**
- **Zombie drops and the dawn salvage:** the next brief, "What the dead carried". Drops need the
  item-depth design first.
- **Guard posts with an ammo box and a lamp.**
- **Repairs under fire.**
- **A horde you can see gathering during the countdown.**
- **A per-turret refill setting.**

**Never:** crew posted to specific guns, and belts.

**Runner-up slice: "waves plus drops first".** It lost because without the supply line, a wave is
still something you watch. It also needs the item-depth design first.

## 9. Build order

1. **Slice 1, one session:**
   - A, Supply response;
   - B, the wire is home;
   - C, loads, rings, and the dry letter;
   - D, magazine, refill point, and the cache preset.

   The owner plays it with Sandbox → horde.
2. **Slice 1b, one session:**
   - E, announced waves plus the countdown chip;
   - F, the Din knobs;
   - G, the after-wave tally, if there's time.
3. **Next brief:** "What the dead carried" (item depth, drops outside the wire, the dawn salvage).
4. **Then:** guard posts supplied by runners, and repairs under fire.
5. **Then:** bonds between survivors (the people layer).

## 10. Measure and accept

**Slice 1 A/B test** (headless; seeds 11, 12, 13; 24 in-game hours after the horde spawns).

**Setup:**
- `newGame(seed)`.
- A fence ring from x 54–76 by y 42–62, with a gate at (65, 62).
- A generator at (58, 49) with 60 fuel, and poles at (62, 50) and (68, 50).
- Turrets at (74, 48) and (74, 52), full.
- 150 rounds at (71, 50).
- Survivors placed at (65, 52), then 1 hour to settle.
- 25 hunting zombies at x=127, y 42–53.

**The two runs:** A has everyone on Fight. B is the same, but the first survivor is on Supply.

**Pass** (averaged over the seeds):
1. **Refills:** B has **at least 2 mid-horde refills** per run (turret ammo rises while any
   zombie is hunting). Today's baseline is 0.
2. **Rounds fired:** B's turrets fire **at least 1.5× their combined magazine** (at least 72
   rounds).
3. **Dry time:** B's dry turret-time mid-horde is **at most half of A's**.
4. **Survivors:** B has **more survivors alive at 24 h** than A in at least 2 of 3 seeds.
5. **The runner:** survives in **at least 2 of 3** seeds, and takes damage in **at least 1 of 3**.
   The risk has to be real.
6. **The wire:** in both runs, **no survivor is outside the wire** when the horde arrives.

**Slice 1b checks:**
- **Announcements:** over 30 simulated days on seeds 1–3, every Director horde after day 3 is
  announced 6–18 in-game hours ahead.
- **Size lock:** the arriving count equals the announced count, unless the cap binds.
- **Strays:** with the Din held at 0, 30, and 60 for 10 days, strays per day come to about 2.9,
  7.3, and 11.6 (±25%).

**Owner iPad test:** set one survivor to Supply, paint a cache, and trigger a horde from Sandbox.
It passes if the owner can say, **without tapping**, which gun is low and who's carrying rounds,
and wants to try another layout. For 1b: they do at least one prep action during a countdown.

**This design is wrong if:**
- the runner dies on the first trip in 2 of 3 seeds;
- B makes zero mid-horde refills;
- B isn't better than A on criteria 3 and 4, meaning Supply doesn't matter; or
- the owner watches a horde and still says "I just watch".

## 11. Owner questions (all answered: yes, 2026-09-29)

1. **Can Gentle survivors be Supply?** I recommend **yes**. It gives the people who can't fight a
   heroic job. **Approved.**
2. **"The wire is home": fighters don't go out through the gate to fight.** I recommend **yes**,
   as the default. A "sally out" policy could come later, if you want it. **Approved.**
3. **A 12-hour warning, with the day-3 pack as the first announced wave (the tutorial)?** I
   recommend **yes to both**. **Approved.**

## Addendum: hacking through the wire (the owner's idea, approved 2026-09-29, built with B)

**The owner's words:** *"melee through fence to thin the horde without much noise… hordes comes
and pawns can go to fence line to start hacking them through the fence when they arrive."* This
changes B: melee fighters still never go out through the gate, but they now fight **through** the
wire.

**The rule:**
- **The geometry:** a survivor with a **melee weapon** can hit a zombie exactly **2 cells away in
  a straight line** (orthogonal or diagonal) when the cell between them has `reachThrough`. The
  zombie can grab back along the same line.
- **What has `reachThrough`** (a new def flag): `fence`, `gate`, and `barricade` (stabbing over
  the top), plus `electricFence` **only while it's unpowered or switched Off.** A live wire shocks
  the hand that reaches through.
- **Never:** walls, scrap walls, doors, or rock.

**The numbers** (feel knobs in `config.js`, `WIRE`):
- **`reachHit: 0.8`:** the survivor's melee hit chance through the wire is ×0.8, because the wire
  gets in the way. Range 0.6–1.
- **`grabHit: 0.5`:** the zombie's hit chance is ×0.5 (0.45 becomes 0.225), with the same 4–8
  damage and the same **2% bite per damaging hit.** Range 0.3–0.7. Grabs hit *anyone* standing in
  reach, including runners hugging the fence. The wire is not armor.
- **The weapon must be `weapon.melee`** (today, the machete). Fists and empty guns can't reach
  through chain-link. That gives the machete a second use (pillar 3).
- **Noise:** unchanged melee noise, 6, against 22 for a pistol shot or a turret. The loud part
  stays the crowd banging on the fence.
- **Paper math** (machete, melee skill 0): about 3 hits per kill at about 50%, so a kill every
  ~8 s at 1×. Each zombie facing the hacker deals ~4–5 HP per kill, and the bite risk is about 2%
  per kill per facing zombie. **A hacker who takes 10 through the wire runs roughly a 1-in-5
  chance of being bitten.** The risk is real, and the infection race is the recovery.

**How fighters decide** (the Fight response; never an order):
- A Fight survivor with a melee weapon, **inside the yard,** who sees a zombie **at the wire**
  (within 1 cell of a `reachThrough` cell) walks to the nearest free **hack spot**: a secure cell
  2 in line with the zombie, across the barrier. They reserve it so two hackers don't share, and
  keep fighting the next zombie in reach.
- **At a hack spot, skip `outnumbered`.** The wire is the equalizer: at most 3 zombies can reach
  one spot. Keep `fleeBelow` (at 35% HP they back off).
- **With no hack spot, melee fighters hold,** because the wire is home. If the section breaks,
  today's rules resume (cornered means fight, outnumbered means fall back).
- **Under the Alarm:** shooters go to towers, **melee fighters to the wire,** Supply to the guns,
  and everyone else to shelter. Update the alarm letter to say so.

**How it interacts with the rest:**
- **The crowd rule is the brake.** The flow field pulls hunters to the nearest survivor, so **a
  hacker is bait:** the crowd gathers at *their* section. Each kill takes one zombie off that
  fence cell's count. Keep it under 3 and the wire holds. Fall behind and it tears right where
  your fighter stands.
- **Electric fence:**
  - **Switched on,** it defends itself (shock, stagger) but nobody can reach through it.
  - **Switched Off** (the machine mode that already exists), it's a hack line, and it saves 15 W.
  - That's a real choice per line.
- **Gates and barricades:** you can reach through both, but neither has the crowd rule (full bash
  damage), so hacking there is a race.
- **Turrets:** the hacker's section is where the crowd forms, so a hack spot inside turret range
  is the combo.
- **What the player sees:**
  - the job report "hacking through the wire";
  - the survivor's lunge drawn across the fence cell;
  - zombie arms reaching through on a grab.

**Acceptance check** (headless, seeds 11–13, the §10 ring with no turrets): one Fight survivor
with a machete inside, the others removed.
- **(a) The trickle:** 4 zombies arrive at the east wire about an hour apart. At least 3 die
  through the wire, the fence stays intact, and no shots are fired, in 2 of 3 seeds.
- **(b) A pack:** 10 zombies arrive at once. The hacker's section breaks, or the hacker falls back
  below 35% HP, in 2 of 3 seeds. The wire isn't a free win.
- **(c) Quiet pays:** 10 zombies against 2 hackers plus one 24-round turret. The turret fires
  **fewer rounds** than it does with no hackers (§10 setup, same seeds).

**It's wrong if** (a) fails (hacking doesn't work), (b) never happens (it's dominant), or (c)
saves no rounds (it's not worth the risk).

---
Rubric: 18/20. Lowest scores:
- **Ours, 1:** runners and announced waves are borrowed shapes (Cosmoteer, They Are Billions).
  What's ours is the noise-locked wave, fenced-out dead not counting, and the bite on the run.
  The harvest brief is where it becomes fully ours.
- **Buildable, 1:** slice 1 touches seven files, so one session is tight. If it runs long, D's
  cache preset and C's far-zoom dots slip to 1b.
