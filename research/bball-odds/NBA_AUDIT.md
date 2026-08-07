# NBA data audit

`data/parquet/_nba_wide_cache.parquet` — **5,279 games, 1,632 columns**, seasons 2022-2025.

Regenerate with `python3 nba_data_audit.py`; rebuild the frame it reads with `python3 nba_build_cache.py`. **All 34 checks pass.**

Written after two construction bugs shipped tables that read as fine (a first-half spread anchor with the sign flipped, and team totals fit as two independent models on one row per game) and then extended after a third round found the outcome column itself was wrong for six games. The frame is checked against arithmetic it must satisfy and against the market's own behaviour — never against whether the output looks plausible.

## What the 2026-08-01 round found

Four independent defects, cutting in both directions. Two score sources exist — **ESPN** (`results_nba.parquet` → `games_nba.parquet`, the signal-grading spine) and **balldontlie** (`bdl_*`, the model cache's feature source) — and disagreement between them is what exposed all four.

| # | defect | scope | who was right |
|---|---|---|---|
| 1 | wrong-leg score join: `fetch_results.py` truncated a UTC tip timestamp to a date, so an evening game was filed a night late and `nearest_match` picked the adjacent night's game between the same two teams | 5 games (CLE/NYK 2023-10-31, CHA/BOS 2024-11-01, MIA/CHI 2026-02-01, +2) | bdl |
| 2 | the bdl join key carried no opponent, so "DET hosted POR" matched DET-vs-WAS | 1 game | ESPN |
| 3 | bdl's game-score field disagrees with its own quarter detail | 2 games (2024-10-23, 2025-11-07) | ESPN |
| 4 | `"LA Clippers"` never normalised to `"Los Angeles Clippers"`, silently dropping every Clippers **home** game | ~172 games, all four seasons | neither — pure loss |

**5,107 → 5,279 games; match rate 99.3% → 99.7%.** Two structural changes came out of it: model targets now come from **ESPN only** (bdl is feature-only, and its scores ride along renamed to `y_bdl_*` so the leak screen does not flag the final score as a feature), and `nba_build_cache.py` now exists — the cache had been assembled once interactively, with no producer, and six modelling rounds had run on a file nobody could rebuild.

## A. Identity and joins

| check | result |
|---|---|
| cache `event_id` unique | PASS — 5,279 rows, 5,279 ids |
| raw games `event_id` unique | PASS — 5,368 rows |
| phantom duplicates dropped | PASS — raw 5,368 → cache 5,279 (89 removed) |
| dropped rows look like phantoms, not real games | PASS — kept on :10/:40 81.8% vs dropped 25.8% |
| standings join coverage | PASS — 98.8% of cache games |
| standings join is not season-specific | PASS — 99% every season |

The Odds API lists some games twice, minutes apart. The tell is the clock: real NBA tips sit on **:10 and :40**; phantoms sit on rounded times and carry fewer snapshot fields. `drop_phantom_events()` in `build_nba_features.py`.

## B. Outcomes rebuilt from the raw scores

Not "does the stored column look sane" — recompute it from `games_nba.parquet` and diff.

| check | result |
|---|---|
| `y_home_pts` == raw `home_score` | PASS — 5,279 comparable, 0 disagree |
| `y_away_pts` == raw `away_score` | PASS — 5,279 comparable, 0 disagree |
| `y_fg_margin` == home − away | PASS — 0 disagree |
| `y_fg_total` == home + away | PASS — 0 disagree |
| `y_h1_margin` == 1H home − 1H away | PASS — 0 disagree |
| `y_fg_marg_resid` == margin + T-60 spread | PASS — 0 disagree |
| `y_fg_tot_resid` == total − T-60 total | PASS — 0 disagree |

## C. Prices

| check | result |
|---|---|
| spread book overround | PASS — median 1.0476 |
| spread prices decimal and in range | PASS — [1.87, 1.95] |
| total book overround | PASS — median 1.0476 |
| total prices decimal and in range | PASS — [1.87, 1.94] |
| moneyline book overround | PASS — median 1.0417 |
| moneyline prices decimal and in range | PASS — [1.01, 14.00] |
| **moneyline calibration: win rate rises with implied probability** | PASS — corr **+0.415**, implied span 82 pts |
| spread calibration | n/a — implied span only 1.3 pts, no power |
| total calibration | n/a — implied span only 0.5 pts, no power |

The calibration check is the price-format oracle: a decimal price read as American (or a sign flip) makes the win rate *fall* as the implied probability rises. It only has power where prices vary, which at flat −110 they do not — hence the two `n/a` rows. See the `grading-sign-oracle-check` note.

## D. As-of correctness

| check | result |
|---|---|
| no column predicts the RESULT better than the LINE | PASS — 1,548 screened, 0 suspicious |
| rolling features carry over between a team's games | PASS — 104 sampled, 0 with lag-1 autocorr < 0.05 |
| standings games-played is as-of, not after | PASS — 93.3% exact, ahead 1.0% vs behind 5.8% |

Three things this round taught about how to run these:

- **A column must be grouped by the team it DESCRIBES.** The first version threaded every `a_*` column through the *home* team's season — an unrelated series, autocorr ~0 by construction — and reported the entire away half of the frame as leaking.
- **Per-game properties legitimately do not persist.** Rest days, this game's line movement, its derivative prices and the team ids all look nothing like the same team's last game (rest in fact *anti*-correlates: a back-to-back is followed by a break). None can carry a box score, so excluding them costs the check nothing.
- **A leak is ONE-SIDED.** If the standings block counted tonight's game, `st_h_gp` would sit *above* the prior-game count, always. What is actually present is a symmetric few-percent tail in both directions — snapshot drift, plus games the odds feed never listed. So the test is the **sign balance**, not the raw span.

## E. Coverage by season

Counted, not assumed — the earlier claim that team totals covered two seasons was a coverage question answered by guessing.

| block | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|
| motivation (`st_*`) | 99% | 99% | 99% | 99% |
| travel (`dm_trav_*`) | 100% | 100% | 100% | 100% |
| schedule (`*_sched_*`) | 99% | 99% | 99% | 99% |
| absences (`*_abs_*`) | 100% | 100% | 100% | 100% |
| adjusted (`adj*`/`radj*`) | 97% | 97% | 97% | 98% |

The hard wall on the derivative markets is unchanged: `event_backfill.py` can only reach 2023-05-03, so team totals and 1H are capped at **three seasons at any price**. Only live T-60 capture before opening night (~late Oct 2026) adds a fourth.

## F. Does the market behave like a market

The last line of defence: even a frame that is internally consistent can be wired to the wrong games. A correctly-joined NBA book has a known shape.

| check | observed | expected |
|---|---|---|
| posted spread correlates with the margin | **+0.486** | NBA sits near +0.45 |
| home teams cover | **50.5%** | ~50% |
| overs hit | **50.7%** | ~50% |
| home teams win outright | **55.7%** | ~55% |
| favourites cover | **50.0%** | ~50% |
| posted home-field advantage | **2.13 pts** | 2-3 pts |

margin sd 15.49 pts | residual sd 13.54 pts | line sd 7.41 pts.

## Verdict

**All 34 checks pass.** Scores reconcile with totals and margins, every stored residual matches result-minus-line under the stated convention, the spread sign is oriented correctly, prices are in the right format and calibrate against outcomes, no impossible values or duplicate listings survive, no feature knows the result better than the line does, and the market's aggregate behaviour is what an NBA book looks like.
