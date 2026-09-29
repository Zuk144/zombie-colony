# RimWorld research notes

What RimWorld actually does, system by system, and what we're taking from it. Numbers marked
**(RW)** are RimWorld's own values; the code uses them as starting points in `src/config.js`,
`src/defs.js`, `src/pawn.js`, `src/mood.js`, and `src/director.js`. (The game has since
pivoted to a zombie setting, described in `DESIGN.md`. This file stays the reference for the
underlying colony-sim mechanics.)

## The core idea: indirect control

RimWorld is a "story generator" more than a builder. The player never controls a colonist
directly in normal play — they **designate** things (chop this, mine that, build here, store
there), set **work priorities**, **schedules**, and **bills**, and colonists decide for
themselves what to do next. (RimWorld does let you "draft" pawns for combat; we're leaving that
out for now to keep control indirect.) The drama comes from colonists not doing what you want,
because they're hungry, tired, upset, or bad at the job.

What the player controls:

| Lever | RimWorld | Us |
|---|---|---|
| Designations | Chop, mine, harvest, cut, hunt, deconstruct… | Chop, harvest, mine, cancel |
| Architect | Blueprints → materials delivered → built | Same pipeline (walls, doors, beds, tables, campfire) |
| Zones | Stockpile, growing, dumping, home area, allowed areas | Stockpile, growing |
| Work priorities | Grid of pawn × work type, 1–4 or off | Same |
| Bills | "Do X times / until you have X / forever" on workbenches | "Until you have X" and "forever" |
| Schedule | 24 hourly slots: sleep / work / recreation / anything | Stored on each pawn, used by the AI; no UI yet |

## Time **(RW)**

- 60 ticks per real second at 1× speed; speeds are 1×, 3×, 6×.
- 2,500 ticks per in-game hour, 60,000 per day (16m40s real time at 1×).
- 15-day "quadrums" (seasons), 4 per year, so a year is 60 days.
- Expensive checks run on a slower "rare tick". We use every 250 ticks for needs, mood,
  mental break rolls, and job interrupts.

## Pawn AI architecture (from modding docs and decompiled source)

- **ThinkTree**: an ordered list of nodes checked top-down. The first node that returns a job
  wins. For humans the order is roughly: downed → mental state → drafted orders → urgent needs
  (starving, exhausted) → scheduled sleep → satisfy needs → recreation → **work** → idle.
- **Job**: a small plan ("haul this wood to that cell") run by a **JobDriver**, which is a list
  of **Toils** (small steps): go to the thing, pick it up, go to the cell, drop it. Each job has
  fail conditions checked every tick, like "target was destroyed" or "designation was removed".
- **Reservations**: a pawn reserves its targets (the item, the destination cell, the
  workbench) so two pawns never chase the same thing.
- **WorkTypes / WorkGivers**: each work type in the priority grid has a list of WorkGivers.
  Each giver scans the map for targets and can build a job for one.
- **Picking work** (`JobGiver_Work.TryIssueJobPackage`): work types are checked from priority
  1 to 4. Within the same priority, **the column further left wins** ("tasks on the left will
  be performed first"). Within one work type, the **closest** valid target wins. A pawn
  finishes *all* reachable work at one priority before moving to the next, which is why
  setting hauling to 1 makes colonists haul across the whole map.
- **Reachability**: RimWorld splits the map into regions so "can I reach this?" is cheap. We
  do the same idea more simply: a flood fill labels connected areas, and it re-runs when a
  wall is built or removed.

## Needs

| Need | Numbers used | Source |
|---|---|---|
| Food | Falls 1.6 nutrition/day (about 2 meals). Hungry < 30% (−6), ravenous < 15% (−12), starving at 0 (−20) | Food fall rate is from the game's defs. The thresholds are approximate |
| Rest | Falls 95%/day while rested, 66% drowsy, 28% tired, 57% exhausted. Drowsy < 28% (−6), tired < 14% (−12), exhausted < 1% (−18). 0→100% takes 10.5 h in bed. Effectiveness: ground 0.8, bed 1.0 | **(RW)** wiki: Rest |
| Recreation | −5 to −20 when low. Satisfied by activities like skygazing | **(RW)** wiki: Needs, rates approximate |
| Beauty, comfort, outdoors, chemical | Not implemented yet (they need rooms and furniture quality) | wiki: Needs |

## Mood and mental breaks

- **Mood** = base mood + the sum of all current **thoughts**. Base mood depends on difficulty
  (Strive to Survive ≈ 32; the peaceful setting is +10).
- The mood bar **drifts** toward that target instead of jumping: **+12 per hour going up,
  −8 per hour going down (RW)**.
- **Situational thoughts** last only while their condition holds (hungry, tired,
  expectations). **Memory thoughts** expire after a set time (ate raw food: 1 day; catharsis:
  3 days).
- **Stacking**: repeated memories each count less, using a **0.75 multiplier per extra
  copy**, up to a stack limit.
- **Expectations**: a large positive thought based on colony wealth. A poor new colony gets up
  to +30 ("extremely low expectations"). As the colony gets richer the bonus shrinks, so
  getting wealthy makes colonists harder to keep happy. This matters for the difficulty curve.
- **Mental break thresholds (RW)**: minor 35%, major 20% (4/7 of minor), extreme 5% (1/7 of
  minor). Traits shift the minor threshold (clamped 1–50%).
- **Break frequency (RW)**: a break is rolled randomly with a mean time between breaks of
  4 days (minor), 0.8 days (major), and 0.5 days (extreme) while mood stays below the
  threshold.
- Break examples: *minor* sad wandering, food binge; *major* daze, tantrum; *extreme*
  catatonic, giving up and leaving the colony. (Berserk and fire-starting need combat and fire
  systems first.)
- **Catharsis (RW)**: +40 mood for 3 days after a break ends, stacking up to 5 with
  diminishing effect. This stops back-to-back break spirals.

## Skills **(RW)**

- 12 skills in RimWorld; we start with 4: construction, mining, cooking, plants.
- Levels 0–20. XP needed per level rises from 1,000 (level 0) to about 32,000 (level 19).
- Passion multiplies XP gain: none 35%, minor 100%, major 150%.
- Daily soft cap: XP past 4,000 per day per skill is multiplied by 20%.
- Skills above level 10 decay over time. Not implemented yet.
- Work speed rises with skill level (the wiki gives construction as 50% + 15%/level). We use
  one general formula for now.

## Rooms (not implemented; roadmap)

A room is any area fully enclosed by walls, doors, or rock. Its stats are wealth, beauty,
space, and cleanliness, which combine into **impressiveness** (the lowest stat counts most).
Impressiveness gives mood thoughts: bedroom, dining room, barracks, −2 up to +8. Room roles
come from the furniture inside.

## Storyteller

RimWorld's director AI. It decides *when* things happen and *how big* threats are.

- **Cassandra Classic (RW)**: big threats start on day 11 and run in cycles of **4.6 "on"
  days / 6.0 "off" days**. Each "on" phase has 1–2 big threats, at least **1.9 days apart**.
  The first raid (a single raider) comes around day 5. Miscellaneous events come on average
  every **4.8 days**.
- **Phoebe**: same system with long quiet periods. **Randy**: ignores the cycle.
- **Raid points (RW)**: `(wealthPoints + pawnPoints × colonists) × threatScale × startFactor ×
  adaptation`, capped at 10,000.
  - Wealth → points curve: 0 until $14k, then 2,400 at $400k, 3,600 at $700k, 4,200 at $1M.
  - Points per colonist: 15 up to $10k wealth, 140 at $400k, 200 at $1M.
  - Starting factor ramps from 0.7 (day ≤ 10) to 1.0 (day 40).
  - Adaptation starts at 0.8 and ranges 0.4–1.47. It rises while things go well and drops
    after colonist deaths or downs.
- **Population intent**: how likely "a wanderer joins" events are. It goes down as the colony
  grows.
- **Difficulty** mainly scales threats (10% on peaceful to 220%+) and colonist mood (±10).

## Other systems worth copying later

- **Bills**: ingredient search radius, allowed skill range, paused bills. Bills run top to
  bottom and a pawn skips any it can't do.
- **Stockpile priorities (RW)**: Low / Normal / Preferred / Important / Critical. Haulers move
  items *up* priority, even out of a lower stockpile. Filters work by item type, quality, and
  condition. *Implemented, except quality and condition.*
- **Temperature, roofs, and lighting**: the basis for rooms, heatstroke and hypothermia, and
  the "slept outside" and darkness thoughts.
- **Health**: per-body-part injuries, bleeding, infections, being downed, and doctoring.
  Needed before combat.
- **Social**: opinion between pawns, relationships, conversations, insults. This is a big
  source of stories.
- **Research**: unlocks buildings and recipes.
- **Inspirations**: the positive counterpart to mental breaks when mood is high.

## Sources

- [RimWorld Wiki – Work](https://rimworldwiki.com/wiki/Work)
- [RimWorld Wiki – AI Storytellers](https://rimworldwiki.com/wiki/AI_Storytellers)
- [RimWorld Wiki – Cassandra Classic](https://rimworldwiki.com/wiki/Cassandra_Classic)
- [RimWorld Wiki – Raid points](https://rimworldwiki.com/wiki/Raid_points)
- [RimWorld Wiki – Mood](https://rimworldwiki.com/wiki/Mood)
- [RimWorld Wiki – Mental break](https://rimworldwiki.com/wiki/Mental_break)
- [RimWorld Wiki – Needs](https://rimworldwiki.com/wiki/Needs)
- [RimWorld Wiki – Rest](https://rimworldwiki.com/wiki/Rest)
- [RimWorld Wiki – Nutrition](https://rimworldwiki.com/wiki/Nutrition)
- [RimWorld Wiki – Time](https://rimworldwiki.com/wiki/Time)
- [RimWorld Wiki – Skills](https://rimworldwiki.com/wiki/Skills)
- [RimWorld Wiki – Thoughts](https://rimworldwiki.com/wiki/Thoughts)
- [RimWorld Wiki – Room stats](https://rimworldwiki.com/wiki/Room_stats)
- [RimWorld Wiki – Stockpile zone](https://rimworldwiki.com/wiki/Stockpile_zone)
- [RimWorld Wiki – Bills](https://rimworldwiki.com/wiki/Bills)
- [Decompiled `JobGiver_Work.cs`](https://github.com/josh-m/RW-Decompile/blob/master/RimWorld/JobGiver_Work.cs)
- [RimWorldModGuide – How Pawns Think](https://github.com/roxxploxx/RimWorldModGuide/wiki/SHORTTUTORIAL:-How-Pawns-Think)
- [Steam discussion – Storyteller XML (Cassandra comps)](https://steamcommunity.com/app/294100/discussions/0/2217311444334859233/)
