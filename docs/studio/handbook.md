# The design handbook: how this studio thinks

This is the craft behind the CDO's work: a method, a toolkit, and the traps to avoid. It's
distilled from professional practice (sources at the end) and tuned for this game: a small
team, a touch-first colony sim, and an owner who plays the builds and decides.

The one-sentence job: **turn a problem the player feels into the smallest design that makes a
better story, and prove it on paper before anyone builds it.**

---

## 1. The method (every brief goes through all seven steps)

### 1. Frame
Before any idea, write down:
- **The player problem,** in the player's words ("once the trees are gone there's nothing to
  do"). Not a feature request. Owner feedback is usually a symptom; find the cause (§4).
- **The target feeling:** which MDA aesthetics (§2.1) this should deliver, and the specific
  *moment* the player should have. Use moments, not adjectives: "the fence holds until the
  generator coughs out" beats "tense".
- **The pillar** it serves (DESIGN §1), and any pillar it strains.
- **Constraints:** what exists that it must reuse (the Din, flow field, bills and supplies,
  Director, rooms, secure yard), and the budget (S = one session, M = two or three, L = a phase).
- **The failure condition:** what would make this design wrong? Write it now, so you can't
  quietly move the goalposts later.

### 2. Diverge
Generate **6–10 raw directions** before choosing. Force variety:
- at least one that **removes** something instead of adding (Rosewater #17: "you don't have to
  change much to change everything");
- at least one **contrarian** option (Sylvester: find value in what everyone assumes is wrong);
- at least one stolen **principle** from a reference game (`references/README.md`), and one
  from outside games entirely (film, history, real disaster response);
- one "what would the zombie-world version of this be?" twist.

Keep the losers. Every idea that doesn't win goes to `docs/studio/ideas.md` (§5).

### 3. Converge
Score the directions against the **make-it-ours tests** (the agent prompt) plus:
- **The ship-necessary razor** (Sylvester): is it *actually impossible* to ship without it?
  If not, is it the cheapest way to fix the player's problem?
- **Perceived value per unit of build cost.** Complexity the player never perceives is waste
  (§2.4).
- **Does the fun part become the correct strategy?** (Rosewater #13). If the optimal play is
  boring, players will do the boring thing.

Pick one. Name the runner-up and why it lost; it's the fallback if playtest disagrees.

### 4. Develop
- **Map the loop:** verbs in order, and where it feeds back. Mark every **source** (things
  enter), **sink** (things leave), **converter**, and each **reinforcing loop** (success breeds
  success, which needs a brake) and **balancing loop** (the brake) (§2.3).
- **Nest it in time:** what happens in the moment (seconds), across a day (about 17 minutes),
  across a season, and across a run? A mechanic with no role at one of these scales is
  probably decoration.
- **Name the decision and its cost.** A game is a series of interesting choices (Meier). If you
  can't name the choice, you have a chore.
- **Write three story moments** it generates, as the player would retell them. If they're all
  the same story, the design is too narrow.
- **Check perception** (§2.4): every important state must be *visible* on a tablet. Hidden
  depth is only worth it if it surfaces as a readable signal.
- **Hunt degenerate strategies:** "Given the opportunity, players will optimize the fun out of a
  game" (Soren Johnson). Ask how a min-maxer breaks it: an infinite farm, a no-risk exploit, a
  turtle strategy. Design the counter or accept it knowingly.
- **Push numbers to their boundaries:** zero survivors, forty zombies, day 200, no power.
  Anything degenerate at the edges?

### 5. Stress-test
- **Pre-mortem:** "It's two months later and players hate this. Why?" Write the three most
  likely reasons and fix or accept each.
- **Touch walkthrough:** narrate every tap, from noticing the need to seeing the result. Count
  them. Anything that needs precision, a hover, or more than about four taps for a frequent
  action gets redesigned.
- **Failure and recovery:** Sylvester's rule for story generators is that **loss is part of
  the story, not its end,** so mechanics must include loss *and* recovery. What does losing at
  this feel like, and how does the colony come back?
- **RimWorld check:** would a RimWorld player recognize this as a straight port? If yes, twist
  it or cut it.

### 6. Write
Use `brief-template.md`. It's about two pages, closer to Librande's one-page ideal (§2.7) than
a design bible: the implementer and the owner should grasp it in five minutes. Recommend one
option. Numbers are starting values with a "measure" plan, never claimed balance.

### 7. Self-review
Score the draft against `rubric.md` and fix anything below 2 before returning it. Put the score
at the bottom of the brief. Be honest; an inflated score gets caught in the owner's review.

---

## 2. The toolkit

### 2.1 MDA (Hunicke, LeBlanc, Zubek, 2004)
Players experience a game from **Aesthetics** (what they feel) back through **Dynamics** (the
behavior that emerges) to **Mechanics** (the rules). Designers build the other way, so *start
from the feeling.* The eight aesthetics, with our working priority for this game:
1. **Narrative** (drama): the story generator. Our core.
2. **Challenge** (mastery): surviving the tide.
3. **Fantasy** (make-believe): leading survivors through the end of the world.
4. **Expression** (creativity): building *your* compound.
5. **Discovery** (exploration): scavenging, reclaiming the town.
6. **Sensation** (sensory pleasure): clean art, satisfying feedback.
7. **Submission** (pastime): the calm of a working colony between hordes. It matters in a
   long-session tablet game, so don't design it out.
8. **Fellowship** (social): out of scope; single-player.

This ranking is the CDO's proposal, pending owner sign-off in a vision audit.

### 2.2 Self-determination theory (Deci and Ryan)
Engagement comes from **autonomy** (real choices), **competence** (visible growth, and knowing
*why* you failed), and **relatedness** (caring about someone). Our survivors are the
relatedness engine; indirect control has to still feel like autonomy. If the player can't
explain why a survivor died, competence breaks.

### 2.3 Loops, economies, and feedback
- **Loops vs arcs** (Daniel Cook): *loops* are repeated action → feedback → a better mental
  model, which builds mastery; *arcs* are consumed once (a story beat, a scripted event).
  Loops last and arcs burn out, so use arcs as seasoning on loops (the Director's intro beats
  are arcs).
- **Sources, sinks, converters** (Machinations, Joris Dormans): every resource needs a way in
  and a way out. An economy with sources but no sinks inflates into boredom; sinks with no
  sources starve. The owner's "trees run out" complaint is a source problem.
- **Reinforcing loops need brakes.** The Din is our model: growth → noise → hordes. Every new
  engine of growth should come with its own balancing loop, ideally a *visible* one.
- **Tension should be a sawtooth:** build, release at a milestone, then re-engage at a higher
  baseline. Flat is boring; a vertical spike is unfair.
- **Failure cost scales with frequency:** frequent failures (a lost fence section) must be
  cheap to recover from; rare ones (losing a survivor) can hurt.

### 2.4 Story-generator rules (Tynan Sylvester, RimWorld GDC 2017, and *Designing Games*)
- **A story generator, not a game.** A game assumes a skill test; a story needs its protagonist
  to get unexpected, disproportionate pushback. We are a story generator.
- **Loss and recovery:** threaten loss of something *in the story* (a survivor, the generator,
  the east field), not a real-life game over.
- **Apophenia:** the player's mind builds stories from sparse signals.

  | | Perceived by player | Not perceived |
  |---|---|---|
  | **In the game** | normal | **unperceived complexity (wasted work)** |
  | **Not in the game** | **apophenia (free story)** | normal |

  How to get apophenia: **abstracted feedback** (a thought like "saw a friend turn", not a
  simulated grief model) plus **long-term relevance** (it still matters a week later).
- **Graphics like a novel has a typeface:** not ugly, easily identifiable, minimal noise, a
  clear intensity hierarchy, fast to make, and **room for interpretation.** That's our vector
  style.
- **Design for character emotion:** make mechanics that create varied emotions *from the
  survivor's point of view,* not just interesting puzzles for the player.
- **The ideas reservoir** (the Ludeon method): keep every idea, re-sort regularly, and let ideas
  fight their way to the top. Don't lock long plans that throw away new inspiration and test
  learning.

### 2.5 Hard-won lessons (Mark Rosewater, *Twenty Years, Twenty Lessons*, GDC 2016)
The ones that apply most here:
- **#1 Fighting against human nature is a losing battle.** Design for how players actually
  behave.
- **#5 Don't confuse "interesting" with "fun."** Feelings beat clever systems.
- **#6 Understand what emotion your game is trying to evoke.** Cut what doesn't serve it.
- **#8 The details are where players fall in love** (a survivor's name, the last jar of
  coffee).
- **#10 Leave room for the player to explore.** They value what they discover.
- **#11 If everyone likes it but no one loves it, it will fail.** Design for the player who'll
  *love* it.
- **#13 Make the fun part also the correct strategy to win.**
- **#16 Be more afraid of boring your players than challenging them.**
- **#17 You don't have to change much to change everything.**
- **#18 Restrictions breed creativity.** Touch-first and indirect control are gifts, not
  limits.
- **#19 Your audience is good at recognizing problems and bad at solving them.** This one
  shapes how we handle owner feedback (§4).

### 2.6 Tuning
- Every number is a **knob** with a category: **feel** (moment to moment; tuned by play),
  **curve** (progression shape; tuned by modeling), or **gate** (pacing; tuned against session
  length). State the category and the intended range, and why the default.
- **Double it or halve it** (Sid Meier's advice): when unsure, try a big change first. Small
  nudges hide whether a knob matters at all.
- The engine can measure: the lead engineer runs headless sims (15 game days in about 4 s).
  Always say *what to measure* and *what result would prove you wrong.*

### 2.7 Communicating design
- **One-page designs** (Stone Librande, GDC 2010): nobody reads page two. Diagrams over prose.
  Lead with the idea.
- Write for two readers: the **owner** (feel, story, and choices, in plain words) and the
  **lead engineer** (data, systems reused, edge cases, acceptance criteria).
- **Acceptance criteria must be testable.** "Feels balanced" isn't a criterion; "a 4-survivor
  colony that farms the siren kill zone for 5 days nets more scrap than it spends on ammo, but
  loses the fence at least once" is.

### 2.8 Touch UX
- Targets ≥ 44 pt; the thumbs rest at the lower corners on an iPad held in two hands, so
  frequent actions go there (our dock).
- No hover. Anything important is on screen or one tap away.
- Direct manipulation: drag to draw (fences, zones), pinch to see more. Modes must be obvious
  and escapable (the Done chip).
- Show consequences *while placing* (yard size, noise, turret coverage), the way Cosmoteer's
  designer and They Are Billions' income preview do.

---

## 3. Anti-patterns (reject a draft that does these)

1. **Feature lists without a loop.** "Add X, Y, Z" with no verbs and no feedback.
2. **Adjectives instead of moments.** "Tense, exciting, deep" means nothing to an implementer.
3. **A menu of options with no recommendation.** Decide, then show the runner-up.
4. **RimWorld ports and zombie-mod thinking.** See the clone-trap table in
   `references/rimworld.md`.
5. **Unperceived complexity.** Simulation the player can't see or feel.
6. **Growth engines without brakes.**
7. **Untestable acceptance criteria.**
8. **Designing to prove you can** (Rosewater #12): cleverness that serves the designer, not the
   player.
9. **Scope creep in disguise:** a "small" brief that needs three new systems. Split it.
10. **Mouse-thinking:** hover tooltips, right-click menus, precise drags, tiny targets.

---

## 4. Working with the owner

- The owner is the creative director and plays the builds on an iPad. Their feedback is the
  most valuable signal we have, and **Rosewater #19 applies:** treat *the problem they feel* as
  ground truth, and treat *the solution they suggest* as a strong hint, not a spec. Restate the
  problem back before solving it.
- Record what they approve, reject, and love in the CDO's memory, so their taste compounds
  across sessions (the agent prompt covers memory).
- Bring decisions, not homework: one recommendation, the trade-off in a sentence, and what
  we'd learn from trying it.

## 5. The ideas reservoir

`docs/studio/ideas.md` holds every idea that isn't being built yet, one line each, grouped by
theme and marked with a rough score (★ to ★★★). New briefs pull from it first; losers from
the diverge step go back into it. Re-sort it when a phase finishes.

---

## Sources

- Tynan Sylvester, *RimWorld: Contrarian, Ridiculous, and Impossible Game Design Methods*,
  GDC 2017 (slides: media.gdcvault.com/gdc2017/Presentations/Sylvester_Tynan_RimWorld_Contrarian_Ridiculous.pdf);
  *Designing Games* (O'Reilly, 2013).
- Mark Rosewater, *Twenty Years, Twenty Lessons*, GDC 2016, and the three-part write-up on
  magic.wizards.com.
- Hunicke, LeBlanc and Zubek, *MDA: A Formal Approach to Game Design and Game Research* (2004).
- Daniel Cook, *Loops and Arcs* (lostgarden.com, 2012) and *The Chemistry of Game Design*.
- Joris Dormans, Machinations (sources, drains, converters, feedback loops).
- Soren Johnson, *Water Finds a Crack* (Game Developer, 2011).
- Stone Librande, *One-Page Designs*, GDC 2010.
- Sid Meier on interesting choices and "double it or cut it in half."
- Deci and Ryan, self-determination theory; Csikszentmihalyi, flow.
- Process ideas (options with trade-offs, falsifiable pillars, adversarial reviews, testable
  acceptance criteria) adapted from the open-source Claude-Code-Game-Studios project
  (github.com/Donchitos/Claude-Code-Game-Studios).
