# The dead carry parts: fixing the component bottleneck

**Status:** draft for owner approval · **Cost:** S (one session) · **Serves pillars:** 2, noise is
the dial; 3, everything the dead carried is worth something · **Strains:** none, but watch that
components stay precious (pillar 3).

**Scope call:** this is its own short brief, not folded into "What the dead carried". The owner
needs to build in the next session. This brief sets the **economy** (how many parts per kill on
average, and the sources and sinks). "What the dead carried" will then decide **who** carries what
(uniforms, your own dead's gear, appliances in ruins) without changing these averages.

## 1. The problem

**The owner's words:** *"i felt good being able to have the supplies and build out a little fort
but then i hit a huge bottle neck of no compents. if we have solar panels and turrent but not
enough components to build a system then whats the point."*

**The root cause:** components are a **finite deposit with no faucet**, and the deposit is smaller
than the dream. It's a ceiling, not scarcity.

| | Components |
|---|---|
| **The whole map** (measured, 20 seeds) | **19.5 on average**, ranging 12–27: about 8 cars × 2, plus about 3.4 loose |
| The owner's "system": 1 solar + 1 battery + 2 turrets | 25 |
| The Phase 3 kit: generator, solar, battery, floodlight, siren, 2 turrets, press, vat | 34 |

**Two sinks you can't see adding up:**
- **Electric fences cost 1 component per section.** A 12-section line costs as much as two
  turrets.
- **Taking apart your own machine refunds half.** Moving a turret burns 3 components, which
  punishes the redesign loop we want.

**Perception:** nothing shows how many components you have, or where more come from. You find
out when a blueprint stalls.

## 2. The idea

**About one in eight of the dead carries a component. The map's wrecks get you to your first
machines, and after that the louder you are, the faster the system comes.** It's the approved
"horde is the harvest", turned on now at its simplest.

**Target feeling:** Challenge and Discovery. **The moment:** dawn after a loud night. A runner
walks the killing field outside the wire and comes back with a green circuit board in her arms,
and the second turret's blueprint starts building.

## 3. The loop

**Verbs:** salvage the wrecks → build the first machines → kill the trickle and the waves → bodies
drop parts outside the wire → haul them in once it's quiet → build or rebuild → louder → more
dead.

**Economy:**
- **Sources:**
  - **The map's wrecks** are finite and front-loaded. With more cars it's about 25.4 on average.
  - **Drops** are renewable: the rate × kills, and kills rise with the Din.
- **Sinks:** machines. That's still permanent, but your own machines now refund **every**
  component when you take them apart.
- **No converter, on purpose.** A "scrap → component" bench recipe fails pillar 2's test: it's
  income with no noise and no risk.
- **Reinforcing loop:** more turrets mean more kills, more parts, and more turrets.
- **Brakes:**
  - **The Din:** louder brings more strays and bigger waves, and the noise-drawn dead wreck
    machines.
  - **Ammo:** about 3 rounds per kill, roughly 1 scrap.
  - **Drops land outside the wire,** so collecting them is a risk.
  - **About ten machines is all a colony wants** (an anti-pillar), so demand saturates.

**Pacing target** (estimated from measured arrivals; the sims in §10 confirm it):

| By | Quiet colony (≈3.5 dead/day, measured) | Loud colony (Din ~30, slice 1b) |
|---|---|---|
| Day 5 | about 15 (wrecks, if salvaged) → generator + turret + press | about 16 |
| Day 15 | about 33 → **the system** (25), by about day 10–12 | about 41 → the system by about day 8, plus extras |
| Day 30 | about 39 | about 54 |

**At each timescale:**
- **Moment:** a body drops a board.
- **Day:** collecting at dawn.
- **Wave:** the big haul comes after a wave.
- **Run:** wrecks carry you to the first system, then drops carry the rest. Districts and
  expeditions come later.

## 4. Three stories

1. **The dinner bell:** "Seed 13 had six cars, and I was stuck one battery short. I ran the
   generator all night on purpose. Thirty of them came to the wire. At dawn Nell walked the field
   and came back with four boards, and the battery went up that afternoon."
2. **Loss and recovery:** "Gus went out for the boards in the kill zone before the stragglers had
   cleared. He didn't come back. Kit finished the run the next morning, and the second turret got
   built with the parts Gus died for."
3. **Redesign:** "Both turrets were facing the wrong way; the dead kept coming through the gate.
   I took them apart, got every board back, and rebuilt them at the gate. Next wave, the gate
   held."

## 5. Mechanics (the smallest fix)

**A. The dead carry parts** (`combat.js`, where a zombie dies):
- **The roll on death:**
  - **12%** chance of **1 component** (curve knob, 8–20%);
  - **35%** chance of **2–6 scrap** (curve knob, 25–50%).
- **Where it lands:** `spawnItem` at the death cell, next to the corpse.
- **Who it applies to:** every zombie for now. The item-depth brief gives turned survivors their
  own gear later.
- **Collection is plain hauling.** During a horde, "the wire is home" keeps people in. Afterwards,
  haulers walk the field, so the dawn salvage emerges with no new code. Hauling keeps its
  3-cell `zombieNear` safety.

**B. More wrecks** (`mapgen.js` `placeCars`): `rng.int(6, 10)` → **`rng.int(9, 13)`** (gate knob).
The map's components go from about 19.5 to about 25.4 (the minimum from about 12 to about 18),
plus about 75 more scrap. The town also looks fuller, which partly answers "the map is small" (§12).

**C. Full refund on your own machines** (`defs.js` `salvageYield`): a building with `cost` and
`machine` (or `electric`) returns **all of its components** and half its scrap (floored), whether
it's working or broken.

**D. Electric fence:** `cost: { scrap: 3, components: 1 }` → **`{ scrap: 4 }`**. Its real price
stays power: 15 W per section, so a 20-section line draws a whole solar panel's daytime output. And
in a brownout it's just a fence.

**E. Show the stock** (`ui.js`):
- **The Machines tray header:** "Components 7 · Scrap 112", the colony-owned counts from
  `countOwned`. A tile you can't afford shows its cost in amber, with "need 2 more".
- **The hint under the header:** "More parts: strip wrecked cars. The dead sometimes carry them."
- **A stalled blueprint's inspector:** "Waiting for 2 components".
- **A one-time teaching letter** on the first component drop: "One of the dead was carrying a
  circuit board. Haulers will bring it in when it's quiet." It's tappable and jumps to the drop.

## 6. UX (touch)

- **Seeing the stock:** open Machines (1 tap). It's on the tray you're already in when you want
  to build.
- **Seeing drops:** the existing `components` sprite (a green circuit board) and the scrap sprite
  lie in the field. At night they're as dark as anything else, which is part of the dawn rhythm.
- **Learning where parts come from:** the first-drop letter (0 taps; 1 to jump to it).
- No new verbs. Collecting uses stockpiles and hauling, as today.

## 7. Robustness

**Degenerate strategies:**
- **A siren farm:** each kill nets about +0.12 components and +1.4 scrap, against about 1 scrap of
  ammo. So 10 components takes about 80 kills and about 250 rounds, with the drops lying in the
  kill zone, the siren getting wrecked, and waves growing with the Din. **Worth it, not free.
  Accept it.**
- **Build and tear down for profit:** the refund equals the cost, so there's nothing to gain.
- **The quiet turtle:** slower but never stuck (about 25 from the map, plus about 0.4 a day).
  Accept it.

**Boundaries:**
- **A worst-case seed** now has at least 9 cars, so at least about 18 components before drops.
- **The 160-zombie cap** limits kills at Deafening, so drops can't run away.
- **Late game:** components may inflate once the ten machines are built. The real late sink is
  the radio tower's stages (DESIGN §8.5), which aren't designed yet. **This is the weakest
  point;** watch the day-30 loud number.

**Pre-mortem:**
1. **"Now parts are everywhere, nothing matters."** The cap: loud play must stay at or under about
   70 by day 30. If it's over, drop the rate to 8%.
2. **"I never see the drops, they just vanish."** Make sure haulers clear the field within a day of
   a horde ending (§10, criterion 4), and keep the teaching letter.
3. **"Going loud is mandatory."** Quiet play still reaches the system by about day 12–15. If it
   doesn't, add +1 car.

## 8. Not doing

- **A scrap → component recipe:** it fails pillar 2 (income with no noise or risk).
- **Cutting every machine's price:** solar costing more than the generator *is* the price of
  silence. Keep that gap.
- **Research or trading for parts:** no source in this world for either.

**Runner-up: only raise car yield** (2 → 4). It's one number, but it just moves the wall from
about day 10 to about day 18 and never touches the noise dial.

## 9. Build order

1. **This fix,** A–E, in one session.
2. **Slice 1b** (announced waves, a steeper Din). Louder kills then feed more drops.
3. **"What the dead carried":**
   - uniforms re-skin the drop table at the same average (overalls carry parts more often);
   - your own dead drop their own gear;
   - appliances in ruins to strip;
   - component uses beyond machines, including the radio tower.
4. **"Reclaim the town" plus the bigger map** (§12).

## 10. Measure and accept

**Sim** (lead): seeds 11–15, 30 days, the slice harness base. Count components the colony
acquires (owned plus spent) at days 5, 15, and 30, quiet against loud (a generator kept running).

**Pass:**
1. **Quiet, by day 15:** at least 25 in 4 of 5 seeds.
2. **Loud against quiet, by day 30:** loud collects at least 1.4× quiet's drops.
3. **Loud, by day 30:** at most 70 in total. Components stay precious.
4. **The drop rate and collection:** 10–14% of zombie deaths drop a component, and at least 80% of
   field drops are hauled in within 1 in-game day of a horde ending.
5. **The owner:** builds solar + battery + 2 turrets in their next session.

**It's wrong if:**
- quiet colonies still stall under 25 by day 15;
- loud ones pass about 70 by day 30; or
- drops pile up uncollected outside the wire.

## 11. Owner questions

1. **Electric fences cost no components, and power is their price?** I recommend **yes**.
2. **When should your first full system (solar, battery, 2 turrets) be affordable?** I recommend
   **about day 10–12 playing quiet, and about day 7–8 playing loud.** The drop rate is the knob.
3. **The map: denser now, bigger later with districts** (§12)? I recommend **yes**.

## 12. The map: denser before bigger

**What space is for in this game:**
- **a gradient of risk and reward,** with near, middle, and far places to strip and later
  reclaim;
- **directions for waves to come from;**
- **a frontier to push your line toward.**

The fun lives near the wire, so empty walking room isn't the point.

**The lead's numbers** (Mac, headless):

| Map | CPU per game day | Field rebuild |
|---|---|---|
| 128×96 | 0.5–0.8 s | 3.5 ms |
| 192×144 | 1.1–1.3 s | 8.5 ms |
| 256×192 | 2.4–2.6 s | 13.4 ms |

256×192 needs the field and `findWork` optimizations first. **Today's mapgen uses fixed counts,
so a bigger map is just emptier.** The same parts get spread thinner across longer walks, which
would make the bottleneck *worse*.

**My recommendation:**
- **Now:** keep 128×96 and make it denser. This brief adds 3 cars.
- **With "Reclaim the town":** grow to **192×144** (2.25×, safe today), with mapgen scaling
  content by area and placing **districts in three distance bands** from camp: near at about 20
  cells (gas station), middle at about 40 (pharmacy, hardware), far at about 60+ (police
  station). Keep the 4:3 shape, which suits an iPad in either orientation.
- **"Beyond" belongs to expeditions** (off-map runs, Phase 4), which cost no cells. Go to 256×192
  only if the reclaim arc proves it needs a fourth band, and only after the optimizations.

---
Rubric: 19/20. Lowest score:
- **Robustness, 1:** late-game component inflation depends on a sink (the radio tower) that isn't
  designed yet. It's accepted knowingly, with a day-30 cap to watch.
