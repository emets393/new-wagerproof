# NBA totals: cumulative travel load

The travel block was built as 54 columns and split into two hypotheses, because lumping them lets one carry the other. **Acute geography** — tonight's flight distance, direction, altitude, body-clock hour — lands *below* base on its own. **Cumulative load** — how far the team has been dragged around over one to two weeks — carries the whole gain, and improves the betting layer as well as the prediction layer.

That is worth saying plainly, because the acute version is the story everyone tells: red-eye flights, three time zones, Denver's thin air. It is not what is in this data.

Why the frame missed it: `h_sched_g_last7` counts GAMES in the last seven days, so a four-game homestand and a four-city road swing are the same number. `km_7d` is the first column that can tell them apart.

5,271 gradeable games, seasons [2022, 2023, 2024, 2025]. 16 load columns on top of the 383-column round-2 set.

## 1. Threshold ladder

Bets are taken when the model disagrees with the T-60 close by ≥k points. `base%` is the best blind side inside those same rows; breakeven at −110 is 52.4%.

| k (pts) | n | base edge | +load edge | base ROI | +load ROI |
|---|---|---|---|---|---|
| ≥0 | 3488 | +2.4 | **+2.4** | +0.5 | +0.5 |
| ≥1 | 2860 | +3.1 | **+3.1** | +2.1 | +1.7 |
| ≥2 | 2313 | +3.3 | **+3.5** | +2.5 | +3.1 |
| ≥3 | 1740 | +3.0 | **+3.3** | +1.9 | +3.0 |
| ≥4 | 1266 | +2.6 | **+4.5** | +1.7 | +5.1 |
| ≥5 | 917 | +3.9 | **+3.7** | +4.6 | +3.3 |

## 2. Label-shuffle null (8 draws, permuted within season)

| statistic | real | null mean | null sd | z |
|---|---|---|---|---|
| oos corr | +0.0726 | +0.0015 | 0.0152 | **+4.68** |
| edge @ k≥2 | +3.46 | -0.86 | 1.34 | **+3.22** |

## 3. Placebo — same columns, wrong games

Permuting which game each load row attaches to, within season, keeps the columns' distributions, internal correlations and count and breaks only the link to the game they describe. This separates *information* from *capacity*.

| real | placebo mean | placebo sd | z |
|---|---|---|---|
| +0.0726 | +0.0658 | 0.0019 | **+3.66** |

## 4. Leave-one-family-out — is one column carrying it?

| dropped | cols | oos corr | edge @ k≥2 | ROI |
|---|---|---|---|---|
| `km_7d` | 395 | `+0.0729` | +3.5 | +2.6 |
| `km_14d` | 395 | `+0.0736` | +3.1 | +2.7 |
| `venues_7d` | 395 | `+0.0714` | +3.3 | +2.7 |
| `days_since_home` | 395 | `+0.0690` | +2.8 | +1.7 |
| *nothing (full)* | 399 | `+0.0726` | +3.5 | +3.1 |

## 5. Phase and season

Pooling hides seasonality and this split runs before anything is claimed.

| slice | n | base edge | +load edge | base ROI | +load ROI |
|---|---|---|---|---|---|
| EARLY | 369 | +5.6 | **+3.0** | +8.4 | +7.6 |
| MID | 866 | +2.5 | **+1.7** | +3.1 | +1.9 |
| LATE | 930 | -0.3 | **+1.2** | -0.9 | +1.6 |
| POST | 148 | -2.6 | **+3.4** | +4.9 | +8.4 |
| 2023 | 652 | -3.6 | **-2.3** | -5.0 | -2.2 |
| 2024 | 860 | +2.5 | **+2.3** | +4.1 | +3.2 |
| 2025 | 801 | +5.5 | **+5.6** | +6.9 | +7.3 |

## 6. Where the ridge puts its weight (load columns only)

Signs inside a collinear block are not readable on their own — the ablation above is the evidence. This is here to show the weight is spread, not parked on one column.

| column | weight |
|---|---|
| `sum_tv_days_since_home` | -0.465 |
| `a_tv_days_since_home` | -0.465 |
| `d_tv_days_since_home` | +0.465 |
| `sum_tv_venues_7d` | +0.361 |
| `d_tv_km_7d` | +0.343 |
| `a_tv_venues_7d` | +0.341 |
| `h_tv_km_7d` | +0.240 |
| `d_tv_km_14d` | -0.235 |
| `h_tv_km_14d` | -0.233 |
| `h_tv_venues_7d` | +0.227 |
| `a_tv_km_7d` | -0.194 |
| `sum_tv_km_14d` | -0.124 |
| `d_tv_venues_7d` | -0.080 |
| `a_tv_km_14d` | +0.042 |
| `sum_tv_km_7d` | +0.042 |
| `h_tv_days_since_home` | +0.000 |

