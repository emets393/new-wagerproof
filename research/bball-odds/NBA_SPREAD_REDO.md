# NBA full-game spread — rebuilt under the corrected sign

Every spread number published before 2026-08-01 was graded with an inverted sign (`-(pred_home − pred_away) − line` against an outcome built as `margin + line`), so every bet went on the wrong side. The sign is fixed and asserted. This is the rebuild that correction earns: the same four things that took the full-game total from worthless to +4.5% ROI — team-game panel, phantom events dropped, leak screen, and a **swept** recency half-life — applied to the margin, plus the question of whether the margin should be its own target at all.

Frame: **10,216 team-games from 5,108 games**, four seasons, graded at the T-60 close. Oracle check passes at 100.0%; favourites cover 50.0% and home teams cover 50.4%, both of which are impossible under an inversion.

## Study 1 — how the points model's skill splits

The total and the spread are the SUM and the DIFFERENCE of the same two predicted team scores. Split each game's pair of predicted residuals into the part that moves both teams together (their sum — this *is* the total) and the part that separates them (their difference — this *is* the margin), then correlate each against the matching actual. This is measured before any variant is fitted, so it is a diagnosis and not a rationalisation of whatever comes out below.

| component | what it is | sd of the prediction | corr with actual |
|---|---|---|---|
| symmetric (home + away) | the game total | 4.88 pts | **+0.0681** |
| antisymmetric (home − away) | the margin | 3.26 pts | **+0.0202** |

The points model spreads **3.26 points** of opinion across the margin against **4.88** across the total, correlating **+0.0202** and **+0.0681** respectively.

## Study 2 — three routes to a margin

Same panel, same rows, same T-60 close, same 20 game-level shuffles re-measured at every rung. Variant A is the current derived route in its corrected orientation, kept as the baseline so the rebuild is scored against what it replaces rather than against zero.

### A — derived from the points model (current route, corrected sign)

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 2,806 | 52.0 | 50.5 | **+1.5** | **-0.8** | -0.66 | 1.27 | **+1.67** |
| ≥2 | 1,927 | 52.3 | 50.2 | **+2.0** | **-0.2** | -0.88 | 1.36 | **+2.14** |
| ≥3 | 1,271 | 52.0 | 51.1 | **+0.9** | **-0.7** | -1.34 | 1.66 | **+1.37** |
| ≥4 | 802 | 52.7 | 51.2 | **+1.5** | **+0.7** | -1.74 | 2.38 | **+1.36** |
| ≥5 | 455 | 52.1 | 53.4 | **-1.3** | **-0.5** | -2.54 | 2.55 | **+0.48** |

### B — direct margin target, full feature stack

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 2,815 | 52.0 | 50.4 | **+1.5** | **-0.8** | -0.66 | 1.33 | **+1.64** |
| ≥2 | 1,930 | 52.1 | 50.2 | **+2.0** | **-0.5** | -0.90 | 1.34 | **+2.14** |
| ≥3 | 1,275 | 51.7 | 51.2 | **+0.5** | **-1.3** | -1.34 | 1.72 | **+1.05** |
| ≥4 | 801 | 52.6 | 51.3 | **+1.2** | **+0.3** | -1.80 | 2.43 | **+1.26** |
| ≥5 | 462 | 51.9 | 53.7 | **-1.7** | **-0.8** | -2.50 | 2.63 | **+0.29** |

### C — direct margin target, antisymmetric subspace

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 2,878 | 51.5 | 50.3 | **+1.2** | **-1.7** | -0.67 | 1.15 | **+1.61** |
| ≥2 | 1,985 | 51.8 | 50.2 | **+1.7** | **-1.0** | -1.04 | 1.40 | **+1.94** |
| ≥3 | 1,338 | 52.4 | 50.7 | **+1.7** | **+0.0** | -1.28 | 1.36 | **+2.20** |
| ≥4 | 856 | 52.8 | 52.5 | **+0.4** | **+0.8** | -2.07 | 2.04 | **+1.19** |
| ≥5 | 517 | 52.8 | 53.2 | **-0.4** | **+0.8** | -1.94 | 2.64 | **+0.59** |

## Study 3 — how much history to train on

The total's edge did not exist until the training window was made recent: pooled history graded +0.3% ROI and a 180-day half-life graded +4.5% on identical rows. Whether the margin wants the same memory is a separate question, so it is swept rather than inherited. **Read the shape, not the argmax** — a smooth hill with a broad top means the preference is real; a single spiking cell is a selection this table has not paid for.

| half-life (days) | B bets | B win% | B ROI | C bets | C win% | C ROI |
|---|---|---|---|---|---|---|
| 60 | 2,642 | 50.2 | **-4.2** | 2,708 | 50.5 | **-3.6** |
| 90 | 2,393 | 51.6 | **-1.5** | 2,447 | 51.0 | **-2.5** |
| 120 | 2,206 | 51.6 | **-1.4** | 2,237 | 51.8 | **-1.1** |
| 180 | 1,930 | 52.1 | **-0.5** | 1,985 | 51.8 | **-1.0** |
| 240 | 1,803 | 52.2 | **-0.3** | 1,856 | 51.5 | **-1.7** |
| 365 | 1,658 | 52.2 | **-0.4** | 1,739 | 51.9 | **-0.9** |
| **None (pooled)** | 1,492 | 50.2 | **-4.1** | 1,574 | 49.3 | **-5.8** |

## Study 4 — C (direct margin target, antisymmetric subspace) broken out at the ≥5-point cut

Pooled numbers hide a signal that decays or that lives in one season, so these always run alongside the ladder. Every win% is next to the base rate of ITS OWN slice.

### by season

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 180 | 51.7 | 51.7 | **+0.0** | **-1.3** |
| 2024 | 156 | 56.4 | 57.7 | **-1.3** | **+7.7** |
| 2025 | 181 | 50.8 | 54.1 | **-3.3** | **-3.0** |

### by phase

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 115 | 50.4 | 53.9 | **-3.5** | **-3.6** |
| MID | 152 | 52.0 | 52.6 | **-0.7** | **-0.8** |
| LATE | 220 | 54.5 | 51.8 | **+2.7** | **+4.1** |
| POST | 30 | 53.3 | 63.3 | **-10.0** | **+1.9** |

### which side

Baseline is the league rate for that same side, not the majority side inside the cell — the latter is self-referential once you have conditioned on the side the model took.

| model side | bets | win% | league same-side% | edge | ROI |
|---|---|---|---|---|---|
| home covers | 265 | 55.8 | 50.4 | **+5.4** | **+6.6** |
| away covers | 252 | 49.6 | 49.6 | **+0.0** | **-5.3** |

### favourites vs dogs

A margin model that only reproduces the market's favourite/dog split is not a model. Splitting the same cut by which side the market made the favourite says whether the opinion is about teams or about price.

| market side taken | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| model on the favourite | 300 | 53.3 | 57.0 | **-3.7** | **+1.8** |
| model on the dog | 217 | 52.1 | 52.1 | **-0.0** | **-0.5** |

