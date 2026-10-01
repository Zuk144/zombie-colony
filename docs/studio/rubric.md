# Brief quality rubric

The CDO scores every brief against this before returning it (handbook step 7). The lead
engineer and owner use the same rubric to review. There are ten criteria worth 0–2 each.

**The bar: 16/20 or more, with no zeros.** Below that, revise before shipping. Record the score
on the brief's last line, e.g. `Rubric: 17/20 (lowest: Perception 1, needs a HUD mock)`.

| # | Criterion | 0: missing | 1: weak | 2: strong |
|---|---|---|---|---|
| 1 | **Player problem** | A feature request with no problem stated | A problem, but in designer terms | The problem in the player's words, with its root cause separated from its symptom |
| 2 | **Target feeling** | Adjectives only ("fun, tense") | Aesthetic named, no moment | MDA aesthetic plus a concrete moment the player will have |
| 3 | **Ours, not a port** | Recognizable RimWorld or mod mechanic | Zombie-flavored reskin | Only makes sense in *this* world (noise, the dead, scarcity, people) |
| 4 | **Real decision** | No choice, or a dominant option | Choice exists, cost unclear | The choice and its cost are named; two good players would choose differently |
| 5 | **Loop and economy** | No loop | Loop without sources and sinks, or without a brake | Verbs, sources and sinks, reinforcing plus balancing loops, nested in time |
| 6 | **Stories** | None | Stories that are all the same | Three distinct retellable moments, including a loss *and* a recovery |
| 7 | **Perception and touch** | Hidden state, or mouse-thinking | Visible but vague, or tap count unknown | Every key state is readable on screen, and the touch walkthrough is counted and ≤ 4 taps for frequent actions |
| 8 | **Robustness** | No edge cases | Some edge cases | Degenerate strategies hunted, boundary values checked, and a pre-mortem with fixes |
| 9 | **Buildable** | Vague, or needs new engine work it doesn't mention | Buildable but big, or the reuse is unclear | Names the systems it reuses and the new data, with a smallest playable slice first and a cost (S/M/L) |
| 10 | **Testable** | No acceptance criteria | Criteria like "feels good" | Measurable criteria, the sims to run, and what result proves the design wrong |

## Automatic fails (regardless of score)

- It breaks a non-negotiable (indirect control, touch-first, vector only) without flagging it as
  an owner question.
- It contradicts a settled owner decision (DESIGN §15) without saying so.
- It has no recommendation.
