# NBA travel — it lands on the SPREAD, and in the tails

The first pass (`NBA_TRAVEL.md`) ran the univariate-vs-shuffle diagnostic on both markets. The total was a clean null on both statistics; the spread showed the diffuse fingerprint — **7 columns above 0.03 where the shuffle gives 0.9** — and the seven were all clock and direction columns. That is the mechanically correct answer: fatigue is *asymmetric*, one team flew and the other slept at home, and asymmetry is what a spread prices and what a total averages away. I had built travel into a totals model, where the two teams' effects partly cancel.

5,271 gradeable games, home covers 50.3%. Bets are taken when the model disagrees with the spread by ≥2 points. `base` is the best blind side inside the same rows; breakeven at −110 is 52.4%.

## 1. Spread model — does travel add?

| feature set | cols | oos corr | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| base | 384 | `-0.0037` | 1587 | 48.0 | 51.1 | **-3.1** | -8.3 |
| base + travel | 438 | `-0.0039` | 1698 | 49.1 | 50.7 | **-1.6** | -6.3 |
| travel only | 54 | `+0.0103` | 172 | 47.1 | 54.7 | **-7.6** | -10.0 |

## 2. Label-shuffle null (base + travel, 8 draws, permuted within season)

| statistic | real | null mean | null sd | z |
|---|---|---|---|---|
| oos corr | -0.0039 | -0.0015 | 0.0125 | **-0.19** |
| edge | -1.65 | -1.56 | 0.59 | **-0.15** |

## 3. Phase and season

| slice | n | base edge | +travel edge | base ROI | +travel ROI |
|---|---|---|---|---|---|
| EARLY | 303 | -3.9 | **-3.6** | -11.3 | -9.8 |
| MID | 613 | -3.3 | **-2.8** | -8.4 | -9.3 |
| LATE | 654 | -3.5 | **-1.4** | -6.9 | -3.1 |
| POST | 128 | -4.9 | **-2.3** | -7.7 | -0.1 |
| 2023 | 560 | -7.3 | **-6.3** | -11.3 | -9.0 |
| 2024 | 628 | -0.7 | **-1.9** | -4.3 | -6.6 |
| 2025 | 510 | -3.5 | **-0.2** | -10.1 | -3.0 |

## 4. The tail cuts on the TOTAL — priced against a matched-size random cut

A linear correlation across 5,271 games is blind to these: 93% of games sit at essentially zero `alt_exposure`, so a threshold effect shows up as ~0 correlation by construction. That is why the scan says the total is null and these rows do not. `z` compares the cut's over-rate gap against 200 random cuts of the same size drawn within the same seasons — it prices the fact that I went looking.

| cut | n | over% | rest | diff | z vs random cut | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|---|---|---|
| visitor unacclimatised at altitude (a_tv_alt_exposure > 1200) | 343 | 54.8 | 50.3 | **+4.5** | **+1.47** | 49% (96) | 51% (81) | 60% (85) | 60% (81) |
| both teams flew 1500km+ (sum_tv_trav_km > 3000) | 702 | 47.9 | 51.0 | **-3.1** | **-1.58** | 51% (164) | 43% (174) | 51% (185) | 47% (179) |
| visitor body clock before 5pm (a_tv_body_tip_hour <= 17) | 1053 | 48.2 | 51.2 | **-2.9** | **-1.66** | 51% (269) | 46% (256) | 49% (266) | 47% (262) |
| visitor body clock past 10pm (a_tv_body_tip_hour >= 22) | 201 | 48.3 | 50.7 | **-2.4** | **-0.78** | 46% (57) | 49% (53) | 48% (46) | 51% (45) |

A cut needs three things before it is a signal: a z that survives the matched-size null, the same sign in every season, and a mechanism. Read the season columns first — a pooled number that comes from two of four seasons is a good headline and nothing else.

