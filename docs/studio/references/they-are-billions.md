# They Are Billions (Numantian Games, 2019)

**Why it's here (owner):** walls and hordes as the whole economy.

**Genre:** real-time colony builder plus tower defense, with a steampunk-Victorian setting. You
place buildings directly and command soldiers directly. Pause is unlimited (in survival mode;
it matters).

## How it plays

You start with a Command Center and a few units on a map full of thousands of sleeping
infected. You expand outward: housing for workers and gold, then food, wood, stone, iron, and
energy. You clear zombie pockets, wall off chokepoints, and survive 10 scheduled swarms. The
last one, "They are billions!", comes from every direction at once.

## The economy (the part the owner named)

- **Two kinds of resources.** *Supply resources* (workers, food, energy) are **occupied, not
  spent**: a building holds them while it's on, and switching it off or losing it frees them.
  *Stockpile resources* (gold, wood, stone, iron, oil) are spent.
- **Housing is the engine.** Tents and houses make workers *and* gold (taxes) but eat food.
  Almost every building needs workers and energy, so every expansion means more housing,
  which means more food, which means more land.
- **Land is the currency.** Gatherers (sawmill, quarry, hunter, farm) earn from the tiles in their
  radius: each resource tile in range adds about 0.5 income, and ranges of the same building
  type can't overlap. The best spots are out in the open, so **the economy physically pulls you
  past your walls.**
- **Upkeep in gold.** Nearly everything except passive defenses costs gold per turn. Out of gold,
  soldiers desert. Short on food or oil, upkeep doubles.
- **Loot on the map:** caches (500 gold or 10 of a material) and "Villages of Doom," which are
  dense infected nests guarding big drops (1,000 gold or 20 of a material). Clearing them also
  shrinks the final swarm, because everything alive on the map joins it.

## The threat

- **Infection spreads through buildings.** If one infected hits an occupied building, it turns,
  and its workers pour out as new zombies. One leak becomes a cascade. A single zombie inside
  the walls is an emergency, and that's the game's signature tension.
- **Noise.** Units attack with noise values: a walker's attack noise is 1, a Behemoth's is 200.
  Infected hear gunfire and each other. The Harpy is very noise-sensitive and jumps walls; the
  Behemoth has extremely sensitive hearing; the Giant is deaf and reacts only to sight or damage.
  Fighting loudly at a wall pulls the dangerous ones.
- **Swarm schedule** (100-day map): waves on days 13, 23, 33, 43, 50, 57, 64, 71, 78, and the
  final wave on 91. Each is announced 8 game hours ahead (24 for the final) with a direction and
  a music change, though terrain can bend the approach. Unannounced **raider** packs start
  around day 20, which punishes any unwalled side.
- **Enemy tiers:** walkers (35 HP, slow, thousands of them), runners (45–80 HP, fast), and
  specials (Chubby 500 HP; Harpy jumps walls; Venom fights at range; Behemoth and Giant have
  thousands of HP).

## Walls and defense

Wood walls lead to stone walls, then to layered stone walls, with stakes and wire traps in front
and towers (ballistas, then shocking towers) behind. Gates let units through. Sound defense
means **layers and chokepoints**, not a ring: most losses come from one breach turning
buildings.

## Art and UX

- A dense, painterly, dark-Victorian look. Thousands of small units read as a *mass*: a swarm is
  a texture creeping across the map.
- The HUD is resource numbers along the top, with supply resources shown as used/total.
- **Placement previews show the income** a spot would give before you build. That's why the
  land-pulls-you-out loop is readable.
- A swarm warning shows its direction and a countdown, with music that changes. The dread is
  scheduled, and you get time to prepare.

## Why it's fun

1. **Every economic choice is a spatial choice,** and space outside the wall is dangerous. Greed
   and safety are the same lever.
2. **A single failure cascades.** Because infection spreads, you feel the tiny leak, not just
   the big fight.
3. **Scheduled dread.** You know the wave is coming and roughly when. The whole game is a
   build-up to a climax you can see coming.
4. **Clearing the map is investment.** Every nest you clear now is fewer zombies in the finale.

## What to take (principles)

- **Supply vs stockpile:** "occupied, not spent" resources make switching things off
  meaningful. That fits our machine modes and the Din.
- **Show the value of a spot while you're placing it.**
- **Clearing nests pays twice:** loot now, and a smaller threat later. This is our "Reclaim the
  town" (DESIGN §8.3).
- **Swarm warnings with a direction, a countdown, and a music change,** so the tension is
  scheduled.
- **The finale is made of everything you left alive.** That's a great fit for our radio-tower
  siege (DESIGN §8.5).

## What to avoid

- **Direct unit command and APM-heavy micro.** We're indirect control.
- **Ironman single-save frustration:** one leak ending a 3-hour run is a known player
  complaint. Our cascades should hurt, not delete the game.
- **Pure numbers-optimization of gatherer placement.** Keep the spatial idea, but on touch it has
  to be readable at a glance.

## How it maps to us

Our Din is their noise, and our secure yard and breach alerts are their "a zombie is inside"
emergency. "Reclaim the town" is their Villages of Doom with territory attached. Our twist:
**survivors are people, not workers.** A breach doesn't just convert a building; it means Lou
gets bitten, and the colony has to decide what to do about Lou.
