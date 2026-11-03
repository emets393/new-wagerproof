# Zig-zag ATS

Back the team that did **not** cover its last game, against a team that **did**.

Run it: `python3 zigzag_ats.py` — grades the season to date, prints the dimension
table, then scores the next ungraded week. `--week N` for a specific week,
`--grade-only` to skip the board. Code and every caveat live in `zigzag_ats.py`'s
docstring; this file is the standing record.

## The spot

In a game where exactly one team covered its last game and the other did not, back the
non-coverer. "Last game" is each team's most recent **played** game, so a team off a bye
carries its pre-bye result forward. Pushes are excluded on both the prior and the graded
game — a team whose last game pushed uses the most recent non-push result.

It fires on roughly **half the slate**, about 6 bets a week.

## The record

| season | W-L | win% | units @ -110 |
|---|---|---|---|
| 2023 | 55-61 | 47.4% | −12.1 |
| 2024 | 55-56 | 49.5% | −6.6 |
| 2025 | 69-60 | 53.5% | +3.0 |
| **2026** (thru wk8) | **32-20** | **61.5%** | **+10.0** |
| 2023-25 | 179-177 | 50.3% | −15.7 |

Break-even is 52.4%. **2023-25 is a coin flip that loses to the vig. 2026 is the outlier.**

Lines are `fg_spread_close` on `nfl_slate_games` (The Odds API) for 2026, and
`odds_consensus.close_spread` (also Odds API) for 2023-25. Scores come from the schedule;
**lines never do**. There is no Odds-API history before 2023, which is why the table starts
there.

## 2026 dimensions (52 bets, base 61.5%)

| cell | W-L | win% | vs base |
|---|---|---|---|
| current model disagreed | 22-7 | 75.9% | +14.3pp |
| underdog | 19-7 | 73.1% | +11.5pp |
| not divisional | 23-11 | 67.6% | +6.1pp |
| legacy model agreed | 18-9 | 66.7% | +5.1pp |
| not primetime | 25-14 | 64.1% | +2.6pp |
| home | 15-9 | 62.5% | +1.0pp |
| road | 17-11 | 60.7% | −0.8pp |
| legacy model disagreed | 14-11 | 56.0% | −5.5pp |
| primetime | 7-6 | 53.8% | −7.7pp |
| favorite | 13-12 | 52.0% | −9.5pp |
| divisional | 9-9 | 50.0% | −11.5pp |
| **current model agreed** | **10-13** | **43.5%** | **−18.1pp** |

## ⛔ The model dimension is two dimensions and they contradict

| | disagreed | agreed |
|---|---|---|
| current (`fg_home_cover_prob`) | **75.9%** | 43.5% |
| legacy (`nfl_predictions_epa`) | 56.0% | **66.7%** |

The current model wants to **disagree** with the bet. The legacy model wants to **agree**.
Both cannot be a mechanism. The two make the same call on only 23 of 48 shared bets — they
are near-independent of each other. Report both; treat neither as the truth.

The legacy probability must go through `apply_pregame_cutoff`. `nfl_predictions_epa` is
append-only with several runs per game, and the newest row for a finished game can post-date
kickoff — grading off that reads the answer.

## ⛔ What did NOT survive out of sample

Only **home/road** pointed the same way on 2023-25. Everything else vanished or flipped:

| dimension | 2026 | 2023-25 |
|---|---|---|
| primetime vs not | 53.8% / 64.1% | 48.7% / 50.7% — gone |
| favorite vs underdog | 52.0% / 73.1% | 50.9% / 50.0% — gone |
| divisional vs not | 50.0% / 67.6% | **52.4% / 49.4% — REVERSED** |
| home vs road | 62.5% / 60.7% | 54.4% / 46.0% — same sign |

The 2026 "best filter" (skip primetime, skip divisional) goes **93-97 (48.9%, −13.7u)** on
2023-25. It does not transfer.

**Home-only across all four seasons: 113-90 (55.7%), +14.0u**, above break-even in 3 of 4
seasons (2025 missed at 51.5%). That is the only cut with a consistent sign, and it is the
modest one. The road half (96-105, 47.8%, −19.5u) is what drags the base to 50%.

The model dimension **cannot** be checked out of sample: `nfl_slate_games` holds 2026 only
and `nfl_predictions_epa` starts at 2025, so no stored cover probability exists for 2023-24.

## Read the cells carefully

52 bets split five binary ways is 32 cells, so a 12-2 cell is expected from luck alone. Two
differently-defined "best" cells — current-disagreed + plain, and legacy-agreed +
current-disagreed — were **both 12-2 and shared 8 of their 14 games**. That is one lucky
cluster found twice, not two effects.

Owner's position (2026-11-03), recorded because it is a live disagreement and not settled
by anything above: the season record is the thing that matters and the small-sample caveat
is overweighted. The numbers are here either way.

## Week 9 2026, as scored on the day

7 of 15 games qualified, all of them home bets. `BAL +9.25` was the only spot in a winning
cell on **both** model readings (both disagreed, 8-4); the other six sat in the 43.5%
current-agreed cell. Baltimore's line had moved **11.75 points** (BAL −2.5 → +9.25) against
a board where nothing else moved more than 1.5 — news the dimensions do not capture.
