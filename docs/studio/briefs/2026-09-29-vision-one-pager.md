# Vision one-pager: the Supply Line

**Status:** approved by the owner, 2026-09-29, as written. Folded into DESIGN.md (items 1–6
and 8; item 7 waits for slice 1b). The owner added: story may rank second *or third* behind
Challenge · **Mode:** vision audit · **Date:** 2026-09-29 ·
**Builds on:** `2026-09-29-direction-brainstorm.md` (direction D, the owner's idea) and the
owner's answers on threat rhythm, colony size, and drops. Nothing in `DESIGN.md` changes until the
owner approves; the exact edits are in §10.

## 1. The hook

> **Build a fortress that runs on people. Someone has to carry every bullet, and the dead you
> kill pay for the next ones.** You plan; they live it.

It's like Cosmoteer, and also the enemy is your own noise coming back for you, with your own dead
among it.

## 2. The heart: the base is the body, the people are the blood

The owner has the building half: the colony, walls, and machines. The missing half was **the test
the building exists to pass.** Here it is: every gun, machine, and fire works only while someone
carries supplies to it.
- **A fortress problem is solved by a person going somewhere dangerous.** When the east gun runs
  dry, somebody has to run it a crate.
- **A people problem shows up as a fortress problem.** A bitten runner is a gun that goes quiet.

You play the base. The stories are about the people.

## 3. Three pillars

Each pillar comes with a test that a feature can fail.

| Pillar | What it means | A feature fails it if… | Pulls against |
|---|---|---|---|
| **1. The base runs on people.** | Guns, machines, and fires work only while survivors walk supplies to them. You fix shortages with layout and policy, never with orders. | A machine runs without anyone ever walking to it, or a tool tells a named survivor to do a named thing. | 2: more people and machines means more noise. |
| **2. Noise is the dial.** | Every machine, gunshot, and generator has a volume. Louder brings more of the dead all the time, bigger waves, and more to harvest. | A new source of income costs no noise and no risk, or the player can't see a noise cost before choosing it. | 3: the harvest pays best when you're loudest. |
| **3. Everything the dead carried is worth something.** | Items come from bodies, buildings, and cars, and each has more than one use. Your own dead come back carrying their things. | An item has only one use, or it comes from nowhere in this world (a research unlock, a shop). | 1: collecting means sending people past the wire. |

**Non-negotiables** (constraints, not pillars): indirect control, touch first, vector only, and
readable at any zoom.

## 4. Anti-pillars: what we are not

- **Not a tower defense:** no fixed waves, no upgrade shop, and no lanes drawn for you.
- **Not a factory:** no belts or inserters, and no ratio math. About ten machines.
- **Not a puppet show:** no drafting, no "go here", and no crew posted to a specific gun.
- **Not a drama you only watch:** no scripted plots. Stories come from systems colliding.
- **Not a loot treadmill:** no rarity colors or gear scores. Items are things with uses, not
  numbers going up.
- **Not an army:** a colony peaks at around 10–15 people you know by name.

## 5. The core loop and the threat rhythm

```
build and scavenge ──► the TRICKLE tests your routine (guards, turrets, runners)
      ▲                    costs ammo and repairs, pays in drops
      │                                  │
      │                    a WAVE is announced (direction, size, countdown)
      │                                  │
  louder, richer          prepare: stock caches, top up guns, pull in, pick your noise
      ▲                                  │
      │                    the wave hits: runners feed the line
      │                                  │
      └──── the MORNING AFTER: salvage what the dead carried, repair, redesign
```

**The threat rhythm is a sawtooth, not a horde every night:**
- **Always:** the dead trickle in, more at night. The Din sets how many. This tests your routine,
  and it's your upkeep and your income at once.
- **Every few days:** a wave, announced about half a day ahead with its direction, size, and a
  countdown. Its size comes from your average noise since the last wave, and it **locks when
  announced**. This tests your design.
- **After:** salvage, repair, redesign. The trickle comes back a little stronger.

**Guard duty is a cost, not a click.** You set a guard shift and place posts, and your noise
decides how many guards you need. Posts need ammo and light, and runners bring them (a later
layer).

**How it plays at each timescale:**
- **Moment (10–20 s):** a fill ring drains, a runner crosses the yard, and the gun barks again.
- **Day (about 17 minutes at 1×):** building and scavenging, guard shifts, and the trickle.
- **Wave (every 4–7 days):** announcement, preparation, the stand, and the morning after.
- **Run:** the line pushes outward into reclaimed districts, the colony gets louder, and it ends
  at the radio-tower siege.

## 6. Where item depth lives

The owner, in their words: *"the best mechanic in rimworld is just how deep and useful all the
items you could collect were."* We want that depth, **sourced from this world rather than copied
from RimWorld's list:**
- **The dead keep what they had** (Zomboid's rule), and **the dead dress for what they carry.**
  You can read their uniforms at a glance: police blue means rounds, scrubs mean medicine, and
  overalls mean tools and components. You pick your noise by who's coming. A horde drawn out of
  the police station is rich in ammo.
- **The town held things.** Each district (pharmacy, police station, hardware store, gas station)
  has its own goods, which is why you reclaim different ones.
- **Every item has a source you can point to and at least two uses.** A crowbar is a weapon and a
  faster salvage tool. Cloth is bandages or winter clothes. A car battery powers a floodlight or
  gets stripped for components.
- **Luxuries** (coffee, cigarettes, liquor) are mood levers, and a reason to go out.
- **Your own dead drop their own gear:** "We got Zeke's pistol back."

This needs its own design, and it's the **next brief: "What the dead carried"** (the loot table,
drops outside the wire, the dawn salvage, and uses).

## 7. Colony size

**Growth is earned, and sustainability is the cap.** You start with 3. A thriving colony reaches
10–15, if it can feed, house, and defend them. Each person eats, needs a bed, and raises the
threat, and each is one more pair of hands to carry. Past about 15, names blur and stories die
(Songs of Syx's warning), so newcomers taper off. The existing arrival curve already stops at 12;
extend it to about 15.

## 8. The moment players retell

> "At 2am the east turret clicked empty with twenty of them on the wire. Gus, our only runner,
> took a crate from the cache and crossed the open yard. The gun started barking again and I
> actually cheered. On the way back one squeezed through the gate and bit him. For two days we
> watched his infection bar while that turret held the east side. He pulled through. He never ran
> again, and I didn't ask him to."

## 9. MDA ranking (proposed; this changes the handbook's draft)

1. **Challenge:** the wave tests your design. It's why you play tonight.
2. **Narrative:** the people make it a story. It's why you remember it.
3. **Discovery:** what the dead carried, and what the town held.
4. **Expression:** your compound, your lanes, your caches.
5. **Sensation:** loads moving and guns barking, in clean vector.
6. **Fantasy:** leading survivors through the end.
7. **Submission:** the calm routine of the trickle.
8. **Fellowship:** out of scope.

**What changed from the handbook:** Challenge moves above Narrative (the missing half was the
test), and Discovery rises to 3 (the owner's item-depth taste).

## 10. Proposed DESIGN.md edits (not made; they need owner approval)

1. **Tagline** (top of file): replace it with *"A touch-first colony sim where your fortress runs
   on people: someone carries every bullet, and the dead you kill pay for the next ones. You plan;
   they live it."*
2. **§1 Pillars:** replace the five pillars with the three in §3 above, including the design
   tests, and add a **Non-negotiables** line (indirect control, touch first, vector only,
   readable at any zoom). Where each old pillar goes:
   - "Plan, don't puppet" becomes new pillar 1 plus the non-negotiables.
   - "The dead are a tide" moves into §5 Zombies, since it describes behavior.
   - "Every system tells a story" becomes the note on MDA #2.
   - "Build a machine that keeps you alive" becomes new pillar 1.
   - "Touch-native" moves to the non-negotiables.
3. **§1:** add the anti-pillars from §4 above.
4. **Remove the belts contradiction.** §9 settles "No conveyor belts", but four places still
   promise them:
   - **§1 pillar 4** "belts and machines free up scarce survivors": delete "belts and".
   - **§2 Factorio row:**
     - *We take* becomes "Machines and power; your output feeds your enemy (pollution → the Din);
       turrets that must be fed; status readable at a glance".
     - *We leave* becomes "Belts and inserters, ratio math, and scale for its own sake".
   - **§3 Arc** "a humming, belt-fed defense line" becomes "a humming defense line fed by
     runners".
   - **§4** "turrets fed by ammo belts" becomes "turrets fed by runners".
5. **§2 table:** add two rows, and extend the RimWorld row.
   - **Cosmoteer:**
     - *We take:* people are the logistics, visible and fixed by layout; design, test, redesign.
     - *We leave:* piloting, and crew posted to stations.
   - **They Are Billions:**
     - *We take:* announced waves with a direction and countdown; clearing pays twice; the finale
       is everything left alive.
     - *We leave:* unit command, and one leak ending a run.
   - **RimWorld,** *We take:* add "deep, useful items, re-sourced from the dead and the town".
6. **§3 The loops:** rewrite as §5 above (moment, day with the trickle, wave, run). This replaces
   "Dusk is for pulling in… Night means more zombies" with the trickle-and-wave rhythm.
7. **§10 Director:** add announced waves whose locked size comes from the average Din since the
   last wave. Make this edit only after slice 1b ships.
8. **§15 Decided:** add:
   - Core direction: the Supply Line (the base is the body, the people are the blood).
   - Threat rhythm: a noise-driven trickle plus announced waves.
   - Colony peaks at 10–15, capped by sustainability.
   - Drops worth going loud for.

   "Still open" keeps the name and the scope of the world.
9. **Outside `docs/` (the lead's file):** `colony/CLAUDE.md`'s Vision line ("Factorio
   (automation, planned for Phase 3)") needs the new hook too.

## 11. What the owner needs to approve

1. The hook, the three pillars, and the anti-pillars.
2. The MDA reorder (Challenge first, Discovery third).
3. Folding it into `DESIGN.md` as listed in §10.
