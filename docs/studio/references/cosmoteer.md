# Cosmoteer: Starship Architect & Commander (Walternate Realities; on Steam since 2022)

**Why it's here (owner):** "I like this game personally when I get time to play it." It's a
personal favorite, so its *feel* matters as much as its systems.

**Genre:** ship design plus real-time space combat plus a light trading and mission career. You
design a ship tile by tile (reactors, weapons, thrusters, shields, corridors, crew quarters),
then fly it into battles where **the ship physically breaks apart** where it's hit, and your
tiny crew runs around keeping it alive.

## How it plays

You build in a grid designer (a sandbox, or a career with credits and fame), fly, fight,
salvage, trade, take missions, upgrade or redesign, and repeat. Your ship is your base, your
army, and your character all at once. Losing half of it in a fight and limping home is a story.

## Systems worth knowing

- **Crew are the logistics.** Crew carry **power (as batteries)** from reactors to every part that
  needs it, carry resources between storage and factories, **load ammo into guns,** and man
  stations. Nothing works without someone walking to it.
- **Walking matters:** crew move 3.2 tiles/s in corridors, 50% slower through other parts, 200%
  on moving walkways. Crowding halves speed (down to a 30% floor), and fire cuts it to a fifth.
  **Distance from reactor to gun is a design decision.**
- **Refill thresholds:** most parts ask for a battery when they've lost half a battery's worth,
  and the nearest crew fetches one from the nearest reactor. If too many parts pull from one
  reactor, it "flatlines" (the out-of-power icon). You fix it by layout, not by command.
- **Crew roles:** you can assign crew to jobs to stop them abandoning a post to fetch batteries,
  a light priority layer on top of autonomous behavior.
- **Reactors are power and risk:** bigger reactors make far more (small 90 batteries/min, large
  810) but devastate a large area when destroyed. Every ship balances output against where the
  bomb sits.
- **Damage is spatial and physical:** hits destroy specific tiles, and fires spread and slow crew.
  Cut the corridor between reactor and guns and the guns starve. Split a ship and the pieces
  drift apart. Crew can space-walk on oxygen to repair from outside.
- **Derelicts:** wrecked ships can be salvaged or even boarded and taken over.
- **Career:** fame limits crew count and lowers hiring costs, so reputation is a resource.

## Art and UX

- **Clean, crisp, top-down 2D.** Parts are chunky, readable modules with clear silhouettes;
  lasers, shields, and explosions are bright and satisfying. It's legible at every zoom, and a
  battle reads like a live diagram.
- **The designer is a joy:** grid snapping, symmetry, instant stats (thrust, power, DPS), and
  immediate testing. Building and seeing it work is the whole reward.
- Tiny crew dots rushing along corridors: you can *see* your logistics working or failing.

## Why it's fun

1. **Design, test, redesign:** a tight creative loop where your cleverness shows up on screen
   within seconds.
2. **Logistics you can see and fix by layout:** a starving gun is visible, the cause is visible,
   and the fix is spatial.
3. **Glorious, readable failure:** watching your ship get carved up piece by piece, crew
   scrambling, is tense and funny.
4. **Your creation is your identity:** players share ships the way DF players share fortresses.

## What to take (principles)

- **People are the logistics, and it's visible.** Our haulers already carry fuel and ammo to
  machines; Cosmoteer proves this is fun when you can *see* the chain and fix it by **layout**
  (put the ammo stockpile near the turret), not orders. It's our answer to "no belts."
- **Distance is a design decision:** the walk from stockpile to generator to turret should matter
  and be visible. A layout overlay showing supply routes could make it readable.
- **Power sources as a liability:** a generator that **draws zombies** is our version of the
  reactor that explodes. Where you put your power is a risk decision.
- **Spatial damage with consequences:** a broken fence *section* or a wrecked machine should cut
  specific supply lines (the power pole down means the turrets go dark).
- **Instant stats while designing:** show a yard's secure area, the Din, grid supply and demand,
  and turret coverage *while* you place things. That's the fun of Cosmoteer's designer.
- **A crew role layer** on autonomous behavior is basically our work priorities. It confirms the
  model.

## What to avoid

- **Direct piloting and real-time combat control.** We're indirect.
- **Grid-min-maxing to the point of meta builds.** Keep layouts readable and forgiving on touch.
- **Pure-sandbox design mode** as the main game. Our building serves survival and story.

## How it maps to us

Cosmoteer is closest to us in **feel:** clean top-down vector-like art, little people keeping a
machine alive, and failure you can watch happen. Its biggest lesson for Phase 3 and beyond is
**visible logistics fixed by layout.** A base should work like a well-designed ship: you can
see why the turret ran dry, and moving one stockpile fixes it.
