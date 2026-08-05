# NBA total — per-feature audit

Baseline out-of-sample corr **+0.0692**, edge **+1.99** on n=2461, over 719 columns.

`delta` is the change in out-of-sample correlation when that column alone is shuffled in the test matrix. **Negative delta = shuffling hurt = the feature helps.** Positive delta = the model is better off without it.

360 of 719 columns help; 359 hurt.

## The 25 features carrying the model

| feature | family | delta |
|---|---|---|
| `sum_s_d_ftr` | team form/efficiency | -0.01304 |
| `a_l5_top_min_share` | usage concentration | -0.01017 |
| `h_s_d_ftr` | team form/efficiency | -0.00986 |
| `sum_l5_adv_usg_max` | usage concentration | -0.00748 |
| `d_l5_adv_rot_n` | usage concentration | -0.00704 |
| `d_s2d_efg` | team form/efficiency | -0.00697 |
| `sum_l10_min_hhi` | usage concentration | -0.00655 |
| `h_l5_adv_usg_max` | usage concentration | -0.00615 |
| `a_l10_pts_hhi` | usage concentration | -0.00613 |
| `d_l10_adv_rot_n` | usage concentration | -0.00590 |
| `d_l5_top_min_share` | usage concentration | -0.00578 |
| `raw_eff_s2d_d_alwd` | possession raw | -0.00558 |
| `sum_l5_own_score` | other | -0.00539 |
| `h_s2d_pts_hhi` | usage concentration | -0.00450 |
| `raw_efg_s2d_sum_alwd` | possession raw | -0.00448 |
| `sum_s2d_adv_usage_percentage` | usage concentration | -0.00446 |
| `sum_l5_top_min_share` | usage concentration | -0.00444 |
| `a_l5_adv_rot_n` | usage concentration | -0.00441 |
| `raw_ftr_l10_d_off` | possession raw | -0.00433 |
| `raw_tov_s2d_d_off` | possession raw | -0.00414 |
| `h_l5_margin` | other | -0.00409 |
| `h_l10_min_hhi` | usage concentration | -0.00393 |
| `sum_form_margin` | other | -0.00381 |
| `h_l5_own_score` | other | -0.00373 |
| `a_abs_ret_max_min` | other | -0.00367 |

## The 25 features doing the most damage

| feature | family | delta |
|---|---|---|
| `a_l10_top_min_share` | usage concentration | +0.00552 |
| `h_s_d_p3a_rate` | other | +0.00540 |
| `sum_l10_top_min_share` | usage concentration | +0.00462 |
| `raw_ftr_s2d_sum_alwd` | possession raw | +0.00399 |
| `a_abs_ret_max_ppg` | other | +0.00380 |
| `raw_eff_s2d_sum_off` | possession raw | +0.00372 |
| `h_s2d_adv_usage_percentage` | usage concentration | +0.00293 |
| `h_s2d_ortg` | team form/efficiency | +0.00293 |
| `a_abs_stale_sum_ppg` | other | +0.00293 |
| `sum_abs_ret_max_ppg` | other | +0.00291 |
| `sum_sched_g_last7` | team form/efficiency | +0.00282 |
| `a_l10_min_hhi` | usage concentration | +0.00276 |
| `raw_trate_s2d_sum_alwd` | possession raw | +0.00275 |
| `a_l5_min_hhi` | usage concentration | +0.00274 |
| `sum_s_d_to_forced` | other | +0.00261 |
| `net_ftr_s2d_d` | matchup net | +0.00259 |
| `net_eff_l5_sum` | matchup net | +0.00253 |
| `sum_l5_min_hhi` | usage concentration | +0.00246 |
| `adj_own_poss_sum_def` | adj own levels | +0.00244 |
| `raw_trate_l10_sum_off` | possession raw | +0.00243 |
| `a_s2d_ortg` | team form/efficiency | +0.00241 |
| `sum_s2d_adv_usg_max` | usage concentration | +0.00240 |
| `h_form_p3_pct` | other | +0.00234 |
| `sum_abs_fresh_sum_ppg` | other | +0.00225 |
| `h_l3_efg` | team form/efficiency | +0.00219 |

## By family — `total` is the sum of deltas, i.e. the block's net contribution

| family | cols | helps | total delta | mean delta |
|---|---|---|---|---|
| usage concentration | 96 | 49 | -0.0595 | -0.00062 |
| other | 201 | 100 | -0.0289 | -0.00014 |
| possession raw | 96 | 58 | -0.0261 | -0.00027 |
| team form/efficiency | 82 | 39 | -0.0215 | -0.00026 |
| adj ratings | 17 | 15 | -0.0187 | -0.00110 |
| matchup net | 96 | 47 | -0.0124 | -0.00013 |
| dims arch | 16 | 8 | -0.0046 | -0.00029 |
| adj own levels | 36 | 17 | -0.0022 | -0.00006 |
| dims trav | 20 | 10 | -0.0013 | -0.00007 |
| dims exp | 4 | 2 | +0.0002 | +0.00004 |
| adj matchup net | 36 | 13 | +0.0020 | +0.00005 |
| structural | 4 | 0 | +0.0021 | +0.00052 |
| dims sched | 7 | 0 | +0.0025 | +0.00035 |
| dims interaction | 8 | 2 | +0.0038 | +0.00048 |

## Prune test — drop the hurters, honestly

Importance ranked on **[2022, 2023]** only, then the pruned model is evaluated on **[2024, 2025]**, which the ranking never saw. Ranking and scoring on the same seasons would guarantee an improvement and mean nothing.

351 of 719 columns survive the early-season ranking.

| feature set | cols | oos corr (late) | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| all columns | 719 | +0.0780 | 1756 | 54.3 | 51.7 | **+2.6** | +3.6 |
| pruned to early-season helpers | 351 | +0.0748 | 1659 | 54.4 | 51.1 | **+3.3** | +3.8 |
