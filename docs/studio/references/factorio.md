# Factorio (Wube Software, 2020; Space Age expansion 2024)

**Why it's here (owner):** one of the five named influences in the pitch. It's the automation
half: "a handful of machines," not a factory game.

**Genre:** a factory-building and automation game. You crash on an alien planet and build an
ever-growing factory to launch a rocket. The design motto the wiki opens with: the goal is to
build machines that do your work for you.

## How it plays

You hand-mine and hand-craft. Then you automate one thing (a burner drill feeding a furnace),
then chain it: belts, inserters, assemblers. Research, driven by automated **science packs**,
unlocks the next tier. The factory grows until launching a rocket is possible, and in Space Age
it spreads across planets.

## The core loop

1. **Bottleneck:** something is slow (iron plates, circuits, power).
2. **Automate it,** which reveals the next bottleneck upstream or downstream.
3. **Research** with automated science packs. Each pack color needs a deeper production chain,
   so **progression is gated by how much you've automated, not by time.**
4. **Scale:** the factory's appetite grows, which pushes you outward to new ore patches.

"The factory must grow." It's endlessly satisfying because every fix creates a new, slightly
bigger problem, and the player always knows the next small goal.

## The threat: pollution (the part closest to our Din)

- **Machines emit pollution per minute,** scaled by energy use: a stone furnace makes 2/min, a
  heating tower 100/min. Speed modules raise it; efficiency modules lower it.
- **It spreads as a cloud** over 32×32 chunks. Once a chunk passes 15 it bleeds 2% per update
  to its neighbors. Trees and terrain absorb it, and trees visibly die from it.
- **Enemy nests absorb the cloud and spend it on attackers:** a small biter costs 4 pollution, a
  behemoth 400. **Your factory's exhaust literally pays for the army that attacks you.**
- **Evolution** (0 → 1) makes enemies bigger over time (about 0.000004/s), with pollution
  produced (0.0000009 per unit) and nests destroyed (+0.002 each). Diminishing returns keep late
  game from running away.
- **Expansion:** biters send parties to settle new nests every few minutes, so ignored land fills
  up with enemies.
- **Defense:** walls, gun turrets (which must be supplied with ammo, by hand or by belt), laser
  turrets (which drain power), flamethrowers. Clearing nests near your pollution cloud is the
  proactive answer.

## Art and UX

- Industrial, readable top-down pixel art. Every machine **animates when working and goes still
  when starved,** so you can read the factory's health at a glance.
- Alt-mode overlays show what's in every machine. Hover shows production stats. There are
  production graphs, and blueprints you can copy, paste, and share.
- Clear status icons: a no-power bolt, a missing-ingredient icon, output-full.
- Satisfying feedback everywhere: machine hum, belt clatter, a rocket launch as the finale.

## Why it's fun

1. **Always a next bottleneck.** The loop never dead-ends; solving one problem reveals the next.
2. **Visible cause and effect.** You watch items move, so you can *see* the problem.
3. **Pollution closes the loop:** growth creates the threat, so defense is part of the economy,
   not a separate minigame.
4. **Mastery through redesign.** Tearing down a working spaghetti setup to build a clean one
   is its own reward.

## What to take (principles)

- **Your output feeds your enemy.** Pollution buys biters; our Din draws zombies. Keep that link
  explicit and readable. It's the soul of Phase 3.
- **Status you can read at a glance:** machines animate when running, and show a bolt when
  unpowered, a missing-item icon, or broken. We have a start; keep pushing.
- **Progression gated by what you've built,** not by a timer. Components and district perks
  (DESIGN §8.3) can do what science packs do.
- **Clearing nests is a proactive answer** to a growing threat. That's "Reclaim the town."
- **Turrets need feeding:** ammo supply makes logistics part of defense. We already do this with
  haulers.

## What to avoid

- **Belts and inserter puzzles.** Owner decision: a handful of machines, and haulers are the
  logistics. Touch plus belts is a UX swamp.
- **An infinite-scale factory as the goal.** Our survivors are people. The factory serves
  survival, not the reverse.
- **Heavy numerical optimization** (ratios, throughput). A few meaningful choices per machine
  beats spreadsheets.

## How it maps to us

We take Factorio's *spirit* (build machines so people don't have to, and watch the colony come
alive) at a scale of about 10 machines. The genuinely Factorio part of our game is **the Din as
pollution**: the busier and more automated you are, the more the dead come. That makes "turn it
down at night" a real choice, just as "build efficiency modules" is in Factorio.
