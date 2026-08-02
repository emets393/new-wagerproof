# NBA team totals — one row per TEAM-GAME

`NBA_TT_FULL.md` fit home and away team totals as two separate models on a frame of one row per game. That estimates the same relationship twice from disjoint columns, so the two sides disagree for no basketball reason and neither prediction is consistent with the other. This rebuilds the target as a team-game panel: **10,216 rows from 5,108 games**, `own_*`/`opp_*` by perspective, `is_home` as a feature, **one** model.

433 features survive the leak screen. Out-of-sample correlation with the posted-line residual **+0.0530** (two-model version: +0.083 home / +0.057 away, which are not comparable to each other and were the symptom).

## Ladder — one model, both sides, null shuffled at game level

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1.25 | 4603 | 53.6 | 50.6 | **+3.0** | +1.1 | -0.43 | 0.70 | **+4.88** |
| ≥2 | 3151 | 53.8 | 50.3 | **+3.5** | +1.2 | -0.66 | 1.02 | **+4.03** |
| ≥3 | 1738 | 53.0 | 52.1 | **+0.9** | -0.6 | -0.88 | 1.24 | **+1.45** |
| ≥4 | 849 | 50.5 | 53.5 | **-2.9** | -5.9 | -0.47 | 2.68 | **-0.92** |
| ≥5 | 427 | 52.9 | 54.8 | **-1.9** | -2.4 | -0.51 | 3.61 | **-0.38** |

## Home vs away, at the 4-point cut

Two fits made these look like different bets. One fit should make them look like the same bet seen from two sides.

| perspective | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| home team total | 435 | 51.0 | 55.4 | **-4.4** | -5.1 |
| away team total | 414 | 50.0 | 51.4 | **-1.4** | -6.7 |

## By season, at the 4-point cut

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 452 | 48.7 | 55.5 | **-6.9** | -10.9 |
| 2024 | 240 | 52.1 | 52.1 | **+0.0** | -1.2 |
| 2025 | 157 | 53.5 | 50.3 | **+3.2** | +1.6 |

## By phase, at the 4-point cut

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 393 | 52.4 | 52.2 | **+0.3** | -4.1 |
| MID | 206 | 48.5 | 55.8 | **-7.3** | -8.1 |
| LATE | 214 | 50.0 | 57.5 | **-7.5** | -5.3 |
| POST | 36 | 44.4 | 69.4 | **-25.0** | -15.4 |

## Derived full-game markets — the point of one coherent model

Team predictions summed and differenced, compared with the posted full-game lines. No new fit: these are the same numbers rearranged.

| market | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| full-game total | 2724 | 52.9 | 50.8 | **+2.2** | +1.1 |
| full-game spread | 1833 | 50.5 | 50.2 | **+0.3** | -3.6 |
