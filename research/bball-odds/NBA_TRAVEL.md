# NBA travel & schedule conditions — does any of it move a game?

> **This is pass 1 and it is not the conclusion.** Read it for the diagnostic, then read the
> three files that resolve it:
> - `NBA_TRAVEL_SPREAD.md` — pass 1's spread fingerprint (7 columns over the noise floor)
>   **did not survive into a model**: z = −0.19 against a shuffle null. That lead is dead.
> - `NBA_TRAVEL_CONTROL.md` — the totals gain is **not** capacity (placebo z = +2.76), and it
>   splits the block: acute geography lands *below* base, cumulative load carries all of it.
> - `NBA_TRAVEL_LOAD.md` — **the result.** 16 cumulative-load columns, full gauntlet passed.
>
> The tail cuts in §4 below are pre-null and pre-season-split. Three of the four turn out to be
> 2-of-4 seasons and none clears |z| = 2 once the search is priced. Do not quote them from here.

The schedule block in rounds 1-2 was six counters of GAMES (rest, b2b, 3-in-4, games-last-7, road-run) and removing it *improved* the model. I read that as "schedule doesn't matter". It only ever tested those six counters. This adds real travel — great-circle distance, signed time-zone direction, DST-correct body-clock tip hour, altitude with an acclimatisation decay, cumulative trailing load — and tests it properly.

5,271 gradeable games, seasons [2022, 2023, 2024, 2025]. 54 travel columns after the leak screen.

## 1. Univariate scan vs a within-season label shuffle

Two statistics, because they diagnose different things: the best single |corr| asks *is there one predictor* (if not, trees are the wrong estimator), the count above 0.03 asks *are there many weak ones* (if so, a regularised linear model can sum them).

| target | best real | best null | count>0.03 real | count>0.03 null |
|---|---|---|---|---|
| total residual | 0.0299 (`sum_tv_venues_7d`) | 0.0275 | 0 | 1.0 |

Strongest travel columns vs the total residual: `sum_tv_venues_7d` +0.0299, `h_tv_km_per_rest` +0.0281, `h_tv_trav_km` +0.0275, `a_tv_venues_7d` +0.0258, `h_tv_east_km` +0.0241, `h_tv_alt_jump` +0.0223, `d_tv_days_since_home` +0.0221, `sum_tv_days_since_home` +0.0221

| spread residual | 0.0381 (`a_tv_trav_tz`) | 0.0298 | 7 | 0.9 |

Strongest travel columns vs the spread residual: `a_tv_trav_tz` +0.0381, `d_tv_body_tip_hour` +0.0331, `d_tv_bodyclock_off` +0.0331, `sum_tv_bodyclock_off` +0.0331, `a_tv_bodyclock_off` +0.0331, `d_tv_trav_tz` +0.0330, `d_tv_east_km` +0.0313, `h_tv_trav_km` +0.0295

## 2. Does it help the model?

Identical folds, identical target, identical alphas — the only change is the feature set. `edge` is win% minus the best blind side inside the same rows; breakeven at −110 is 52.4%.

| feature set | cols | oos corr | n @ k≥2 | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| base (round 2) | 383 | `+0.0672` | 2280 | 53.7 | 50.4 | **+3.3** | +2.5 |
| base + travel | 437 | `+0.0742` | 2290 | 53.5 | 50.3 | **+3.1** | +2.1 |
| travel only | 54 | `+0.0250` | 837 | 52.1 | 51.9 | **+0.2** | -0.5 |

## 3. Where it lands, phase by phase

Pooling all games hides seasonality, and this is exactly the split that has to run before anything is claimed.

| slice | n | base edge | +travel edge | base ROI | +travel ROI |
|---|---|---|---|---|---|
| EARLY | 362 | +5.6 | **+4.4** | +8.4 | +4.9 |
| MID | 861 | +2.5 | **+2.0** | +3.1 | +2.5 |
| LATE | 921 | -0.3 | **-0.7** | -0.9 | -0.1 |
| POST | 146 | -2.6 | **+4.1** | +4.9 | +7.2 |
| 2023 | 643 | -3.6 | **-1.1** | -5.0 | -2.3 |
| 2024 | 840 | +2.5 | **+1.7** | +4.1 | +2.3 |
| 2025 | 807 | +5.5 | **+4.5** | +6.9 | +5.5 |

## 4. The physical hypotheses, asked directly

The add-to-model test averages over 5,000 games, most of them two rested teams on a normal two-day gap. A real physical effect lives in the tail, so ask it there. `over%` is how often the game went OVER the T-60 close inside that cut; the comparison column is the same statistic on every other game.

| cut | n | over% | rest of slate over% | diff |
|---|---|---|---|---|
| visitor at altitude, unacclimatised (a_tv_alt_exposure > 1200) | 343 | 54.8 | 50.3 | **+4.5** |
| both teams flew 1500km+ (sum_tv_trav_km > 3000) | 702 | 47.9 | 51.0 | **-3.1** |
| visitor 3+ zones east of home (a_tv_bodyclock_off <= -3) | 268 | 50.7 | 50.6 | **+0.2** |
| visitor body clock past 10pm (a_tv_body_tip_hour >= 22) | 201 | 48.3 | 50.7 | **-2.4** |
| visitor body clock before 5pm (a_tv_body_tip_hour <= 17) | 1053 | 48.2 | 51.2 | **-2.9** |
| combined trailing load top decile (sum_tv_km_7d) | 523 | 50.3 | 50.6 | **-0.3** |
| visitor deep in a road trip (a_tv_days_since_home >= 8) | 751 | 49.8 | 50.7 | **-0.9** |

Nothing here is a bet until it survives a shuffle null and holds across seasons — these rows are a map of where to look, not a signal list.

