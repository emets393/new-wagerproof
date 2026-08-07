# NBA spread — per-feature audit

Baseline out-of-sample corr **+0.0016**, edge **-1.42** on n=2669, over 719 columns.

`delta` is the change in out-of-sample correlation when that column alone is shuffled in the test matrix. **Negative delta = shuffling hurt = the feature helps.** Positive delta = the model is better off without it.

335 of 719 columns help; 384 hurt.

## The 25 features carrying the model

| feature | family | delta |
|---|---|---|
| `raw_twopct_l5_d_alwd` | possession raw | -0.01139 |
| `h_l3_top_min_share` | usage concentration | -0.00843 |
| `dm_exp_h_exp` | dims exp | -0.00792 |
| `d_l3_min_hhi` | usage concentration | -0.00777 |
| `raw_twopct_l10_sum_alwd` | possession raw | -0.00717 |
| `dm_arch_a_l3_def_eff` | dims arch | -0.00655 |
| `raw_oreb_l10_d_alwd` | possession raw | -0.00648 |
| `d_l10_margin` | other | -0.00564 |
| `h_l3_min_hhi` | usage concentration | -0.00536 |
| `dm_arch_d_l3_pace` | dims arch | -0.00443 |
| `a_l3_min_hhi` | usage concentration | -0.00411 |
| `raw_trate_l5_sum_off` | possession raw | -0.00376 |
| `dm_arch_a_l3_pace` | dims arch | -0.00340 |
| `dm_arch_a_l10_def_eff` | dims arch | -0.00334 |
| `sum_l5_adv_pace` | team form/efficiency | -0.00327 |
| `h_abs_fresh_n` | other | -0.00325 |
| `a_abs_ret_max_min` | other | -0.00325 |
| `d_l10_adv_rot_n` | usage concentration | -0.00314 |
| `d_l3_top_min_share` | usage concentration | -0.00304 |
| `h_l10_adv_usage_percentage` | usage concentration | -0.00300 |
| `dm_exp_d_exp` | dims exp | -0.00299 |
| `raw_twopct_s2d_sum_alwd` | possession raw | -0.00290 |
| `radj_sum_adj_tempo_pts` | adj ratings | -0.00278 |
| `a_l5_top_min_share` | usage concentration | -0.00276 |
| `sum_form_margin` | other | -0.00276 |

## The 25 features doing the most damage

| feature | family | delta |
|---|---|---|
| `raw_efg_l10_d_alwd` | possession raw | +0.00970 |
| `raw_eff_l5_sum_alwd` | possession raw | +0.00602 |
| `a_l3_top_min_share` | usage concentration | +0.00573 |
| `raw_twopct_l10_d_alwd` | possession raw | +0.00540 |
| `d_l5_pts_hhi` | usage concentration | +0.00511 |
| `raw_tpct_s2d_sum_alwd` | possession raw | +0.00501 |
| `raw_eff_l10_d_off` | possession raw | +0.00456 |
| `h_l10_adv_pace` | team form/efficiency | +0.00454 |
| `st_poss` | structural | +0.00419 |
| `sum_form3_adv_pace` | team form/efficiency | +0.00418 |
| `raw_efg_s2d_sum_off` | possession raw | +0.00413 |
| `a_l3_opp_score` | other | +0.00384 |
| `h_l10_total` | other | +0.00369 |
| `d_s_d_to_forced` | other | +0.00355 |
| `a_l10_top_min_share` | usage concentration | +0.00354 |
| `raw_efg_l5_d_alwd` | possession raw | +0.00342 |
| `a_form3_adv_pace` | team form/efficiency | +0.00337 |
| `raw_twopct_l5_sum_off` | possession raw | +0.00326 |
| `raw_efg_s2d_d_alwd` | possession raw | +0.00319 |
| `d_l10_top_min_share` | usage concentration | +0.00318 |
| `raw_oreb_s2d_d_off` | possession raw | +0.00313 |
| `net_efg_l10_sum` | matchup net | +0.00306 |
| `raw_eff_l10_d_alwd` | possession raw | +0.00305 |
| `dm_ix_exp_x_fatigue_a` | dims interaction | +0.00304 |
| `a_l3_margin` | other | +0.00277 |

## By family — `total` is the sum of deltas, i.e. the block's net contribution

| family | cols | helps | total delta | mean delta |
|---|---|---|---|---|
| dims arch | 16 | 12 | -0.0268 | -0.00167 |
| usage concentration | 96 | 44 | -0.0164 | -0.00017 |
| adj ratings | 17 | 13 | -0.0118 | -0.00069 |
| dims exp | 4 | 2 | -0.0095 | -0.00238 |
| team form/efficiency | 82 | 41 | -0.0087 | -0.00011 |
| adj matchup net | 36 | 19 | -0.0060 | -0.00017 |
| dims sched | 7 | 4 | -0.0003 | -0.00004 |
| dims trav | 20 | 9 | +0.0011 | +0.00005 |
| matchup net | 96 | 43 | +0.0042 | +0.00004 |
| dims interaction | 8 | 1 | +0.0061 | +0.00076 |
| structural | 4 | 1 | +0.0067 | +0.00168 |
| adj own levels | 36 | 14 | +0.0069 | +0.00019 |
| other | 201 | 92 | +0.0239 | +0.00012 |
| possession raw | 96 | 40 | +0.0345 | +0.00036 |

## Prune test — drop the hurters, honestly

Importance ranked on **[2022, 2023]** only, then the pruned model is evaluated on **[2024, 2025]**, which the ranking never saw. Ranking and scoring on the same seasons would guarantee an improvement and mean nothing.

348 of 719 columns survive the early-season ranking.

| feature set | cols | oos corr (late) | n | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| all columns | 719 | +0.0116 | 1726 | 49.9 | 51.3 | **-1.3** | -4.6 |
| pruned to early-season helpers | 348 | +0.0165 | 1601 | 49.3 | 51.8 | **-2.5** | -5.8 |
