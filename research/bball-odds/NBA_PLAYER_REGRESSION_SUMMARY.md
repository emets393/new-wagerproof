# NBA player-level regression from play-by-play — the adjudication

**This file is the verdict. Where the intermediate briefs disagree with it, they are wrong**
(`NBA_PLAYER_REGRESSION_BRIEF.md`, `NBA_CONC_CONTROLS_BRIEF.md`, `NBA_XEFG_PHASE_BRIEF.md`,
`NBA_SIDES_MODEL_BRIEF.md` — each reports one stage and none of them is the answer alone).

## Why this work exists

The first use of the 2.5M-event play-by-play pull was absence valuation, and that answered a
narrow question (`NBA_ABSENCE_SUMMARY.md`: real vs the opener, worth nothing at the close).
The point of play-by-play was individual-player regression to the mean feeding a team side —
which player is currently producing above what he can sustain — and that had not been built.
Team-level aggregates cannot answer it, because averaging over a roster is precisely what
destroys the information.

## The result, in one line

**Fade a team whose recent shooting above each player's OWN career finishing rate is
CONCENTRATED in one or two high-volume players.** Walk-forward, thresholds chosen only from
prior seasons and applied blind:

| grading | bets | win % | slice base % | edge | ROI % | seasons |
|---|---|---|---|---|---|---|
| vs OPENER | 433 | 55.4 | 52.2 | +3.2 | **+5.8** | +6.8 / +0.4 / +10.2 |
| vs **T-60 close** | 446 | 54.0 | 50.4 | +3.6 | **+3.2** | +3.1 / −0.5 / +7.4 |

Breakeven at −110 is 52.4%. It clears it at the close, which is the bar that matters —
unlike the absence signal, this is not a news-latency edge.

**Honest bounds.** n = 446 gives 1 SE ≈ 2.4pp, so 54.0% is thin. One of the three
out-of-sample seasons (2024) is a wash at −0.5%. Call it ~150 bets a season at roughly +3%,
not a printing press, and do not quote the in-sample +5.5%.

## What is actually being measured

Per player, leak-safe (expanding, shifted; `nba_player_regression.py`):

- `own_finish` — his **own** long-run points-above-expectation per shot, from the shot-location
  model. This is skill. Good finishers beat a location model every year, and measuring them
  against a league-average expectation would flag them as permanently lucky.
- `heat` = trailing-10 finishing − `own_finish`. Points per shot above **his own** sustainable
  rate. Aggregated over the projected-available rotation weighted by *shot volume*, not
  minutes — a hot player only regresses to the extent he keeps shooting.
- `conc_drv` — HHI of that heat on the side carrying it. **A moderator, not a signal.**

## The controls, which are the reason to believe any of it

| control | question | result |
|---|---|---|
| **C3** | does the team aggregate `d_luck_net` work in the same cell? | **−3.7 edge, p=.77, −1.7% ROI — fails** |
| **C4** | does the raw hottest player, with NO own-baseline subtraction, work? | **−2.5 edge, −7.9% ROI — fails** |
| nested | does player heat survive projecting out the team aggregate? | **yes, −1.74 / −2.07**; the mirror is **+0.19 / +1.13**, wrong sign |
| C5 | is concentration a disguised favourite/talent rule? | no — corr with spread −0.9, with talent +0.0 |

C3 and C4 are the load-bearing ones. Fading the guy who is simply scoring a lot **loses
money**; subtracting each player's own career finishing rate is what converts it into a
signal. The team aggregate fails in the very cell where the player version works, and once
player heat is projected out of it, the team aggregate flips to the wrong sign. Player
granularity is doing the work — the aggregate was destroying it.

## What did NOT work, stated as failures

- **The pooled ML model does not beat the line.** Walk-forward R² vs the market residual is
  negative in 15 of 16 (feature set × model) cells and never exceeds +0.08, across ridge,
  GBM, shallow GBM and random forest. At 1,000 bets it returns −1.3%. A +4.5 correlation
  against a residual with ~13-point spread is worth ~0.6 points; squared-error regression
  over all 4,400 games averages a sparse conditional edge into nothing. **The rule beats the
  model here.** See `NBA_SIDES_MODEL_BRIEF.md`.
- **P2 (concentration) confirmed in direction, not in shape.** Predicted monotone
  diffuse → concentrated. Got diffuse **+1.45** (heat does not regress at all when spread
  across a roster), middle −4.54, concentrated −3.51. The middle tercile is as strong as the
  top, so the real claim is "not diffuse", not "maximally concentrated".
- **The HHI threshold sweep is not monotone** — p50 +2.8, p60 +1.8, **p70 +6.2**, p80 +3.2.
  That spike is the fingerprint of a cut chosen after seeing the answer, and it is why the
  walk-forward re-test above exists and why its lower number is the one to quote.
- **`d_p_top` (single hottest player, uncorrected) is worthless**, corr −1.05 / −0.57.
- **The xEFG phase prediction was wrong in shape.** Predicted a monotone decay from early
  season. Got strong early (+6.66), a collapse mid (+1.12), strong again late (+6.25) and in
  the playoffs (+6.79) — and the playoffs cell with the *highest* correlation has the *worst*
  bet result (−4.5 edge, −5.5% ROI), which is what n=349 instability looks like.

## The one genuinely new team-level fact

`d_xefg_net` — expected eFG from shot coordinates — correlates **+4.65** with the T-60 spread
residual while **actual** eFG correlates **+0.05**. The market fully prices shooting results
and does not fully price shooting process. That is impossible to compute from box scores and
it is the single most useful thing the play-by-play pull produced. It is a **feature**: on its
own the best phase cell is late season at +2.5 edge / p=.052 / +2.1% ROI, carried by one
season.

## Convergence worth noting

Two independent tests put their strength in the **same place**: xEFG is strongest late
(+6.25 corr, best bet cell) and concentrated heat is strongest late (+8.5 edge, +15.5% ROI
in-sample; mid-season is −5.0). Late-season is when trailing team results are most stale
relative to the current rotation. That is a hypothesis the two results share, not two
findings, so it should not be double-counted.

## Files

| file | role |
|---|---|
| `nba_player_regression.py` | builds player heat / own-baseline / concentration → `data/parquet/nba_player_regression.parquet` |
| `nba_player_model.py` | pre-registered P1/P2/P3 + the nested test vs the team aggregate |
| `nba_conc_controls.py` | C1–C6, the kill attempts |
| `nba_conc_walkforward.py` | blind parameter selection — **the number to quote** |
| `nba_sides_model.py` | the pooled ML model, which does not beat the line |
| `nba_xefg_phase.py` | xEFG by season phase |
| `nba_regression_build.py` | team-level shot quality + RAPM talent (shared expected-points table) |

## To go live

Needs a daily hoopR play-by-play pull (6.3s for four seasons, see the
`nba-granular-data-source` memory), the expected-points table rebuilt expanding, and the
previous game's rotation — all strictly pregame. No injury feed required, which is the
practical advantage over the absence signal.
