# RimWorld (Ludeon Studios, 2018; DLCs Royalty, Ideology, Biotech, Anomaly, Odyssey)

**Why it's here (owner):** the starting point of the whole project ("RimWorld influence, top-down
colony builder where you can't really direct the pawns directly"), and the thing we must **not
become a clone of.**

**Deep mechanics live in `colony/docs/RESEARCH.md`:** real numbers for time, the pawn AI (think
tree, job givers, toils, reservations), needs, mood and breaks, skills, rooms, temperature and
spoilage, and the storytellers. This file covers the *design* view.

**Genre:** a sci-fi colony sim billed by its creator as **a story generator.** A few crash-landed
colonists on a rim world; you designate, zone, prioritize, and schedule, and they decide.

## Why it works

1. **A storyteller, not a difficulty curve.** Cassandra (a rising cycle), Phoebe (gentle), and
   Randy (chaos) pace threats against your wealth and population. Tension and release are
   designed; the specific events are random. Every colony has a plot.
2. **Colonists are characters.** Traits, backstories, relationships, mood thoughts ("ate without a
   table," "my wife died"), and mental breaks. Players remember names.
3. **Indirect control through priorities.** The Work tab (1–4 priorities, left-to-right tiebreak)
   is the core lever. Drafting is the one direct-control exception, for combat.
4. **Wealth draws raids.** The richer you get, the bigger the threat, so growth is never free.
5. **Failure is a story.** Losing a colonist is a plot beat, not a reload. The "Losing is fun"
   lineage from Dwarf Fortress, made approachable.
6. **Readable, modest art.** Simple top-down sprites (heads on bodies, no animation to speak of)
   let the simulation carry the imagination, the way Prison Architect does.
7. **Modding** multiplied its life: thousands of mods, including dozens of zombie mods, which is
   exactly what we must not look like.

## What we've already taken

The think tree, work priorities, the job and toil system, needs, mood and breaks, skills, rooms,
temperature and hypothermia formulas, spoilage, and a Cassandra-style Director. The engine is
deliberately RimWorld-shaped, because that part is proven.

## The clone trap: where RimWorld's answers are wrong for us

| RimWorld | Why it's wrong for us | Our answer |
|---|---|---|
| **Drafting** (direct combat control) | Breaks indirect control and is awkward on touch | Fight/Flee policy, Alarm, guard posts, schedules |
| **Wealth draws raids** | Abstract; the player can't see "wealth" | **The Din:** noise draws the dead, and you can see and turn it down |
| **Raiders are people with guns** | Generic sci-fi | The horde: dumb, many, persistent, and your own dead among them |
| **Power grids with conduits** | Wiring puzzle | Poles with reach; every machine costs noise |
| **Research bench and tech tree** | Generic progression | Components and district perks (reclaim the town), found not researched |
| **Caravans and a world map** | Heavy, slow UI | Light expeditions (Phase 4) |
| **Space-ship ending** | Escape from the world | Radio tower: call others *to* you, a stand, not an escape |
| **Hover tooltips and dense tabs** | Mouse UI | Touch dock, inspector, big targets, and letters you tap |

## What to avoid (beyond the table)

- **Recognizable UI.** No RimWorld-style bottom tab bar with Architect, Work, Schedule, Assign,
  Animals, Wildlife, Research, Quests, World, Factions, History, and Menu. Ours is a dock of
  five or six verbs.
- **Copying its content lists** (materials, crops, drugs, animals). Every item should have a
  zombie-world reason to exist.
- **Solving problems the way RimWorld mods do** ("zombies are raiders that bite"). Our zombies are
  the *environment*, like weather with teeth.

## How it maps to us

RimWorld is our engine and our cautionary tale. We keep its proven bones (indirect control,
characters, storyteller, failure-as-story) and replace every *answer* with one that is about the
dead, noise, scarcity, or people. When in doubt, ask: "Would a RimWorld player recognize this as a
straight port?" If yes, twist it or cut it.
