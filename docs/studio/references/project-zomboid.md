# Project Zomboid (The Indie Stone, 2013–, Build 42)

**Why it's here (owner):** one of the five named influences in the pitch. It's the zombie half
of the game: noise, night, scavenging, and bites.

**Genre:** an isometric, open-ended zombie survival sim. You control one survivor directly in a
huge, persistent county (Knox Country, Kentucky). The tagline sets the tone: "This is how you
died." The question is when, not whether.

## How it plays

You pick an occupation and traits, spawn in a town, and scavenge houses. You learn skills by
doing and reading, fortify a base, farm, and survive seasons. The world decays around you:
power and water shut off, food rots, and grass and trees creep over the roads.

## Noise (the system we borrowed most)

- **Everything has a volume**, and zombies path to what they hear:

  | Source | Volume |
  |---|---|
  | Sneaking / walking / sprinting | 3.5 / 7 / 14 |
  | Construction | 15 |
  | Zombie knocking on a door | 20 |
  | Fire | 20 |
  | Generator | 20–25 |
  | Shouting | 30 (whistle ×2, megaphone ×3) |
  | Firearm | 30–200 |
  | Unmuffled cough or sneeze | 40 |
  | Running vehicle | 55–220 |
  | Car alarm or horn | 150 |
  | Helicopter | 500 |
  | Burglar alarm | 600 |

- Walls, doors, and distance muffle noise. There's a subtle split between *radius* (how far it
  carries) and *volume* (how attractive it is): a police siren can lose out to a coughing
  survivor nearby.
- **The metagame moves hordes.** Random offscreen gunshots, dogs barking, and the **helicopter
  event** (a helicopter circles over the player for hours and drags every zombie in the region
  with it) redistribute zombies. The world pushes back on a base that got comfortable.

## Zombies

- They sense by **sight first, then sound** (even thunder). Shufflers are the default. Everything
  is a sandbox setting (sprinters, smell, memory, strength).
- **Hordes follow a leader** and migrate. Population peaks around day 30, and some towns (the city
  of Louisville) are death zones.
- Zombies **bash doors, windows, and player-built walls**. A crowd vaulting a fence at once
  damages it and eventually knocks it down. Crawlers can't vault, so they attack the fence
  instead.
- **Ambush spaces:** zombies spawn in closets and bathrooms. Crawlers "play dead" in tall crops.
- **Bites always infect.** Scratches infect 7% of the time and lacerations 25%. Infection shows up
  slowly through moodles (sick, anxious) before death and reanimation. Your dead character stays
  in the world as a zombie **wearing your stuff**.

## A world that runs down

- **Utilities shut off** at a random point in days 0–30. That brings darkness, fridges that rot,
  and water that has to be boiled. An emergency broadcast frequency can warn you first.
- **Generators** power a small radius, burn gasoline, and are loud (about 20 volume), a classic
  trade-off.
- **Erosion:** over months, grass, trees, and moss reclaim roads and buildings, and zombies visibly
  decompose. Time passing is *visible*.
- Loot doesn't respawn by default, so scavenging pushes you farther from home, into more
  dangerous towns.

## People

- **Moodles** are small icons for hungry, thirsty, panic, bored, stressed, unhappy, drunk, and
  heavy load. Panic worsens combat, and survivors slowly desensitize. Boredom leads to
  unhappiness. Reading, eating well, and smoking manage these.
- **Occupations and traits** (Burly, Cowardly, Smoker, and so on) shape a run from minute one.
  Skills grow by use and by reading skill books.

## Art and UX

- Muted, realistic isometric with photographic textures and heavy darkness at night. Blood and
  wear accumulate on everything.
- Dense, keyboard-and-mouse inventory UI. It's powerful but notoriously fiddly: context menus,
  drag-and-drop containers, and weight and encumbrance.

## Why it's fun

1. **Every action is a risk calculation about noise.** Breaking a window gets you in fast but
   loud; a gun is safety that summons more danger.
2. **The world visibly decays,** so the early days feel precious and the late game feels earned.
3. **Permanence and stories.** Your death is the headline, and your corpse (a zombie in your
   clothes) is a callback for your next character.
4. **Slow, grounded pacing** makes small wins (a working generator, a full pantry) feel huge.

## What to take (principles)

- **Volume as a universal currency.** Every machine, weapon, and action has a number, and the
  number summons consequences. Our Din is this, turned into colony-scale strategy.
- **The world pushes back on comfort:** metagame noise events and the helicopter. Our Director
  already does supply-drop noise; a "helicopter day" fits.
- **Infection that plays out in slow motion** through visible symptoms. We have the immunity
  race; the drama is in the waiting.
- **The dead keep who they were:** gear, clothes, names. This is the root of our "horde is the
  harvest" idea (DESIGN §8.2), since zombies drop what they carried.
- **Decay as a timer:** utilities off, food rotting, nature reclaiming. It's a reason to build
  toward self-sufficiency.
- **A crowd breaks the fence, one zombie doesn't.** We already use this rule (Phase 3).

## What to avoid

- **Inventory micro and context-menu depth.** It's death on touch, and it's direct control.
- **Sandbox-setting sprawl as a substitute for tuned design.** Ship good defaults; presets can
  come later.
- **Realistic grime** as the art direction. We're clean vector, and the tone comes from light,
  color, and motion, not texture.

## How it maps to us

Zomboid is one survivor's lived experience. We zoom out to *a colony's* experience of the same
world: noise becomes the Din, scavenging becomes expeditions and reclaiming districts, and
moodles become thoughts and mood. The feeling to keep is the "this is how you died" fatalism,
where the colony's story is worth telling because it can end.
