# NBA 1H spread, signal space — validation

3,928 games, seasons [2023, 2024, 2025], 120 signal features. Rolling-origin every 14D, 5 seeds x 3 classifiers. BE 52.4%.

## Observed

| cut | n | win% | ROI | per-season |
|---|---|---|---|---|
| top100% | 3219 | 51.2 | -2.3 | 53/49/53 |
| top50% | 1610 | 52.2 | -0.5 | 54/51/52 |
| top25% | 805 | 53.9 | +2.8 | 57/52/51 |
| top10% | 322 | 55.3 | +5.5 | 59/52/52 |
| top5% | 161 | 54.7 | +4.2 | 54/56/53 |

## A — label-shuffle null (the multiple-comparisons check)

12 reps, outcome permuted within season, identical pipeline.

| cut | observed | null mean | null sd | null max | z |
|---|---|---|---|---|---|
| top100% | 51.2 | 50.4 | 1.2 | 52.2 | +0.72 |
| top50% | 52.2 | 50.1 | 1.7 | 52.4 | +1.22 |
| top25% | 53.9 | 50.0 | 1.8 | 53.3 | +2.15 |
| top10% | 55.3 | 49.9 | 2.3 | 52.8 | +2.33 |
| top5% | 54.7 | 50.2 | 2.2 | 52.8 | +2.04 |

## B — direction bias vs naive baselines

| bet | n | win% | ROI |
|---|---|---|---|
| model, top25% | 805 | 53.9 | +2.8 |
| always HOME | 3219 | 49.1 | -6.3 |
| always AWAY | 3219 | 50.9 | -2.9 |
| (model picks HOME on 48% of its top25%) | | | |

## C — is it just S8 rediscovered?

| population | cut | n | win% | ROI |
|---|---|---|---|---|
| S8 games only | top100% | 186 | 56.5 | +7.7 |
| S8 games only | top25% | 47 | 61.7 | +17.7 |
| S8 games only | top10% | 19 | 57.9 | +10.4 |
| NON-S8 games | top100% | 3033 | 50.9 | -2.9 |
| NON-S8 games | top25% | 759 | 53.4 | +1.8 |
| NON-S8 games | top10% | 304 | 53.9 | +2.9 |

## D — drop-one-season (top25%)

| dropped | n | win% | ROI |
|---|---|---|---|
| 2023 | 633 | 52.1 | -0.5 |
| 2024 | 490 | 55.1 | +5.1 |
| 2025 | 488 | 54.3 | +3.6 |

## E — absolute confidence ladder

| P(home) dist from .5 >= | n | win% | ROI |
|---|---|---|---|
| 0.00 | 3219 | 51.2 | -2.3 |
| 0.02 | 2703 | 51.2 | -2.3 |
| 0.04 | 2212 | 51.4 | -1.9 |
| 0.06 | 1787 | 51.7 | -1.5 |
| 0.08 | 1417 | 52.2 | -0.5 |

## F — top features (full-sample fit, descriptive only)

| feature | gain-split importance |
|---|---|
| h1ats_pct_diff | 59 |
| p_sum_s2d_h1_tot_share | 55 |
| mk_move_total | 51 |
| ats_pct_diff | 49 |
| p_d_l5_h1_tot_share | 49 |
| f_d_form_total | 48 |
| p_sum_s_p3a_rate | 46 |
| p_d_s_p3a_rate | 46 |
| q_sum_adj_tempo_pts | 46 |
| p_sum_l5_total | 45 |
| p_d_s2d_h1_tot_share | 43 |
| q_sum_adj_net | 43 |
| f_sum_form_margin | 42 |
| q_d_adj_tempo_pts | 42 |
| f_d_form_margin | 41 |
