# 16 — Agent Type Fork & Parlay Agents

**Status:** Design spec — V3 prep, ships with V3 (NOT live yet). Source of truth for the
agent-creation fork and the parlay-agent product. To be reconciled with
[15_V3_PERSONALITY_QUESTIONS.md](15_V3_PERSONALITY_QUESTIONS.md) (question set now branches by
type) and [13_CROSS_SPORT_AND_PARLAYS.md](13_CROSS_SPORT_AND_PARLAYS.md) (parlay plumbing —
submit/grade/correlation — still valid; this doc adds the product shape on top). Locked 2026-06-23.

## Why a fork

Parlays and straights are different products with opposite slate needs:
- **Straight agent** wants today's best individual spots — narrow slate, can run daily, value = each pick's edge.
- **Parlay agent** needs enough good legs to *combine*, and its value is the *combined ticket* — wider slate, on-demand, different grading.

Bolting parlays onto a straight flow (the old `parlay_appetite` dial) made agents either ignore
or over-reach for parlays, and thin daily slates often couldn't build one. So agent **type is an
explicit, mutually-exclusive choice at creation.**

## The two types

| | Straight agent | Parlay agent |
|---|---|---|
| Makes | straight picks only | parlays only |
| Trigger | auto (scheduled) or manual | **manual only** — never auto |
| Slate | that run's date | **per-trigger window** (day or week) |
| Questions | markets, per-pick odds limits, trust dials | leg count, combined-odds floor, correlation tolerance, sports |

A user who wants both makes two agents. `parlay_appetite` is **retired** from the shared set.

## Parlay agent — trigger flow

Manual trigger only. The scheduled/cron enqueue path **skips parlay-type agents entirely.** Each
trigger the user chooses a **window**:

### Window: Day
- That calendar day's games, **any in-season sport** the agent covers.
- Genuinely cross-sport on busy days (e.g., an October Sunday = NFL + playoff MLB + early NBA).

### Window: Week (of football)
- **NFL/CFB only** (the only multi-day sports — Thu/Sun NFL + Sat CFB combine into one ticket).
- **Only offered when the agent's sports include NFL or CFB.** A pure-MLB/NBA parlay agent is day-only.
- Definition: **now → the end of the current football week (Monday night).**

### Hard rule: never pick a game that has already started
- Exclude any game whose kickoff/first-pitch is in the past **relative to the trigger time**.
- Example: a Saturday-morning "week" trigger → Thursday's NFL game is gone; only remaining Sat/Sun/Mon games are eligible.
- Timezone-correct (game time ET vs now ET) + a **~10-minute buffer** (don't serve a ticket the user can't physically place in time).

## Slate / thin-slate handling

A parlay needs **≥2 legs**. Thin windows are handled, not fatal:
- **Cross-sport fills the gap** — a multi-sport agent on a busy night has plenty (1 NFL + 2 MLB, etc.).
- **A single game can still parlay** — side + same-game props (SGP, see below). So an NFL-only agent on a 1-game Monday isn't dead.
- If the window genuinely can't yield a ≥2-leg ticket → return **"not enough games to parlay right now,"** never a forced 1-leg ticket.

## Parlay construction & pricing — two tiers

Legs are drawn only from the agent's allowed markets (incl. signal-gated props). The same-game
correlation guard still holds: **≤1 non-prop leg per game; props exempt.** So a single-game ticket
= one side + N same-game props.

**Volume-market exception (solo-per-game).** The three volume markets — `player_pass_attempts`,
`player_rush_attempts`, `player_pass_completions` — are the game-script *latent factor*: they move
with everything else in the game (validated in the prop-model deep-dive — a team's whole passing
tree and its script all price off the same volume signal). So they are **NOT** covered by the
"props exempt" rule. **A volume-market leg must be the ONLY leg from its game** — it cannot be
combined with any other pick from that game (not a side, total, team total, 1H, or another prop,
including another volume market). In a parlay a volume-market pick is always solo for its game;
to add more from that game, use a different (non-volume) prop instead. Enforced server-side in
`submit_parlay` (`volume_market_solo_only`), described in the leg schema, and stated in the V3
prompt so the agent never proposes it.

| | Cross-game parlay (incl. cross-sport) | Same-game parlay (SGP) |
|---|---|---|
| Legs | different games → **independent** | one game → **correlated** |
| Pricing | exact (multiply leg odds) | **estimate only** — books discount correlation; we don't have their SGP models |
| Combined-odds floor | **hard-enforced** | **best-effort** (informational) |
| Display | confirmed price | estimate **+ disclaimer**: *"Books price correlated same-game parlays differently — this is an estimate, not a confirmed price."* |

The agent is **cross-game-first**: it reaches for independent legs (clean pricing + the odds floor
is meaningful) and only drops to an SGP when the window can't support cross-game (e.g., an
NFL-only Monday).

## Odds parameter (vs straights)

- Per-leg odds caps (`max_favorite_odds` / `min_underdog_odds`) **do NOT apply to legs** — a -1200 chalk leg is fine inside a parlay (chalk legs multiply *up* toward plus money).
- The **combined ticket price** must satisfy the agent's odds limit — hard for cross-game, best-effort for SGP.

## Grading / UX

- A **week parlay sits pending for days** — a Saturday ticket spanning Sat/Sun/Mon can't settle until Monday night. The leg-by-leg grader (drop-and-reprice on pushes, see `13_…`) already handles this; the UX just sets the expectation ("pending until the last leg finishes" is normal).

## Leaderboard

Parlay agents and straight agents have very different variance profiles (parlay hit-rate vs
straight ROI). **Segment them** in any ranking/leaderboard rather than comparing directly.

## Implementation checklist (V3 prep — none live yet)

- **Question set** (`15_…`): split into a type fork → straight branch (current set) + parlay branch (leg count, combined-odds floor, correlation tolerance, sports). Drop `parlay_appetite`.
- **Creation** (web/mobile/iOS): the type fork as the first question; branch the form.
- **Engine — slate**: a **window mode** (`day` | `week`) on the slate fetch; the **not-started filter** vs trigger time (+ buffer, ET); `week` = football-only + "now → Mon night."
- **Engine — pricing**: cross-game (exact, hard floor) vs SGP (estimate + disclaimer, soft floor) tiers in `submit_parlay`; the combined-odds check.
- **Trigger**: the manual-trigger flow carries `{ window, triggeredAt }`; the cron enqueue **excludes** parlay agents.
- **Testing**: dryrun football is 2025-dated → the not-started filter excludes everything → add a **dry-run override** (treat dryrun games as upcoming) so the window/filter is testable before live.
- **Prereq**: the MLB game-id fix (day parlay agents that include MLB depend on it — the slate must surface real MLB game_pks, not let the agent guess NFL-pattern ids).
