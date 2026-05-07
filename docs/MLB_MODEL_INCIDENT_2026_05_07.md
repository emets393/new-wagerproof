# MLB Model Failure Incident — 2026-05-07

## TL;DR

The MLB model started failing badly in early April 2026 because **multiple input features in `mlb_game_log` were corrupted, and the historical training data those features were trained on was also wrong in different ways**. The result was a train/serve distribution mismatch: the model thought it was looking at one kind of league, but was actually being fed a different one. Strong-confidence picks went from 70% win rate (March) to 25% (mid-April).

This document explains exactly what was wrong, what was fixed, and what still needs human intervention.

## Symptoms

- Full-game ML picks: 28-41 (40.6%, -25.3% ROI) over 30 days through May 6
- Strong picks (model says ≥60% confidence): 70% win rate Mar 23-30, then **25%/36%/33%/46%** the following 4 weeks
- Non-Perfect-Storm-tier picks: 9-27 (25%) over 30 days. Perfect-Storm-tier: 19-14 (57.6%, +14% ROI)
- 2026 games coming in 0.68 runs above closing line vs 0.45 historical
- A `g2_blowout_sweet_spot` signal was claimed to win 66.2% / +25% ROI on 74 games. Audit showed the actual rate is 51.5% — the recorded stats were never reproducible.

## Root cause

The ETL pipeline that populates `mlb_game_log` model-input columns (the `bat_season_*`, `bat_last5_*`, `sp_season_*`, `sp_last3_*` family) was producing **wrong values for several columns across multiple seasons**, and the corruption was different in each season. Specifically:

### Historical training data (2023-2025)
| Column | Issue |
|---|---|
| `bat_season_xwobacon` | Stored ~0.32 (which is plain xwOBA), not the actual xwOBAcon ~0.37. Off by -0.05 systematically. |
| `bat_season_barrel_pct` | Stored ~0.027, source value ~0.080. Off by ~3-4×. |
| `bat_season_hard_hit_pct` | Off in both directions across years; correlation with source as low as 0.19 in 2024. |
| `sp_season_xera` (2023) | Stored 5.05 vs source 4.48. Off by +0.56. |
| `sp_last3_xfip` | Used a different rolling window than `mlb_starter_pregame.last3_pre_xfip`; off by 1+ ERA in many rows. |

### 2026 production data (live serving)
| Column | Issue |
|---|---|
| `bat_season_ops` | NULL across **every** 2026 game. ETL dropped the column entirely. |
| `bat_season_k_pct` | NULL across every 2026 game. |
| `bat_season_bb_pct` | NULL across every 2026 game. |
| `bat_last5_xwobacon` | NULL across every 2026 game. |
| `bat_season_xwobacon` | Got the **correct** value (0.37) — but training data had the wrong 0.32, so the model interpreted correct values as "anomalously hot." |
| `bat_season_hard_hit_pct` | Source itself produces 0.30 vs 0.41 historical (April-month comparison confirmed not seasonality). |
| `bat_season_barrel_pct` | Source itself produces 0.063 vs 0.080 historical. |
| `sp_season_xfip` | Source `mlb_starter_pregame.season_pre_xfip` rollup produces 3.74 vs ~4.10 historical. Raw per-start xfip in `mlb_pitcher_logs` averages 3.93 — bug is in the rollup step, not at the per-start level. |
| `opp_bp_season_xfip` | Same upstream rollup bug, 3.96 vs 4.17 historical. |

### Why this caused the failure mode we saw

The training data taught the model: "average xwOBAcon is 0.32, average xFIP is 4.10." In production, every team got fed `xwobacon = 0.37` (the correct value) and `xfip = 3.74` (the broken value). To the model, every game looked like a heavyweight slugfest with great pitching on both sides. It couldn't differentiate between teams. Predictions clustered around weakly-confident home favorites — and home favorites are exactly what was losing 25% of the time.

This is consistent with every observation:
- Strong picks broken (model can't tell teams apart anymore)
- Home-favorite bias (HFA boost dominates the noise floor)
- Over-predicting offense (xwOBAcon shift)
- Started failing once March variance wore off
- Perfect-Storm-tier picks still work (signal stack uses different features)

## What was fixed

Two migrations were applied to the live database on 2026-05-07.

### Migration 1: `20260507120000_remove_g2_blowout_sweet_spot.sql`
- Deleted the `g2_blowout_sweet_spot` row from `mlb_signal_stats` (the 74-game / 66.2% / +25.5% ROI numbers were not reproducible from raw data).
- Deactivated the signal definition with a `[REMOVED]` label.
- Patched `refresh_mlb_signal_stats()` cron function to remove the candidate generator so the cron doesn't re-create the row on next run.

### Migration 2: `20260507130000_backfill_corrupt_model_features.sql` (7 phases)
1. **Phase 1**: Backfilled `bat_season_woba`, `bat_season_xwobacon`, `bat_season_barrel_pct`, `bat_season_hard_hit_pct`, `bat_season_k_pct`, `bat_season_bb_pct`, `bat_last5_woba`, `bat_last5_xwobacon`, `bat_trend_woba` for **all** seasons 2023-2026 from `mlb_batting_pregame`.
2. **Phase 2**: Computed `bat_season_ops` as `season_pre_obp + season_pre_slg` from `mlb_batting_pregame` (column doesn't exist directly in source).
3. **Phase 3**: Backfilled all `sp_season_*` and `sp_last3_xfip` features for 2023-2025 from `mlb_starter_pregame` (source is clean for those years).
4. **Phase 4**: Copied 2026 `sp_*` from source, then applied **+0.36 bias correction** to `sp_season_xfip` and `sp_last3_xfip` to compensate for the broken upstream rollup.
5. **Phase 5**: Mirrored fixed `sp_*` values into `opp_sp_*` (each game has 2 rows in `mlb_game_log` and the opponent perspective needs the same numbers).
6. **Phase 6**: Applied **+0.25 bias correction** to `opp_bp_season_xfip` for 2026 (same upstream bug).
7. **Phase 7**: Applied **+0.103 / +0.017 bias corrections** to `bat_season_hard_hit_pct` / `bat_season_barrel_pct` for 2026 (also from upstream).

Post-fix train/serve alignment (2024-2025 train vs 2026 serve):

| Feature | Train | Serve | Δ |
|---|---|---|---|
| woba | 0.315 | 0.308 | -0.007 |
| xwobacon | 0.371 | 0.369 | -0.002 |
| ops | 0.710 | 0.705 | -0.005 |
| barrel | 0.079 | 0.083 | +0.004 |
| hardhit | 0.410 | 0.410 | 0.000 |
| sp_xfip | 4.10 | 4.10 | 0.000 |
| sp_xera | 4.28 | 4.21 | -0.07 |
| opp_bp_xfip | 4.17 | 4.21 | +0.04 |

Every feature is within rounding noise. The train/serve mismatch is essentially zero.

### Migration 3: `recalibrate_g4_modfav_sweep_fade_truth_derived` (applied)
- The `g4_modfav_sweep_fade` signal originally had hand-inserted stats (31 picks / 67.7% / +17.9% ROI). A truth-derivation against `mlb_game_log` produced 35 picks / 62.9% / +39.1% ROI. Updated the recorded stats to match the truth-derivation and updated the description.

### Cron refresh
Re-ran `refresh_mlb_signal_stats()`. All 8 cron-managed signal stats (`g2_blowout_winner`, `g2_blowout_pick_em_trap`, `g2_blowout_loser`, `g2_modfav_5to7_fade`, `g3_massive_blowout_regression`, `g3_blowout_recipient_bounce`, `g3_moderate_fav_regression`, `g3_heavy_fav_carryover`) are now derived from raw data and reproducible.

## What still needs human / external intervention

### 1. Retrain the model (CRITICAL)
The model's weights still reflect training on the **uncorrected** data. Even though `mlb_game_log` is now clean, the model itself was fit to broken values. Until retrained:
- Live predictions in `mlb_predictions_current` will continue to be miscalibrated
- Existing rows in `mlb_predictions` and `mlb_historical_results` won't auto-correct

**Action**: In the `mlb-morning-runner` repo (external), retrain the model on the now-corrected `mlb_game_log` data. Re-score historical games and overwrite `mlb_predictions` rows. Re-deploy for live scoring.

### 2. Fix the upstream rollup that produces `mlb_starter_pregame.season_pre_xfip`
- Raw per-start xfip in `mlb_pitcher_logs` for 2026 averages 3.93 (only -0.1 vs historical, plausibly real).
- The rollup step that produces `season_pre_xfip` outputs 3.74 — drift of -0.36 introduced by the rollup itself.
- The +0.36 bias correction in Phase 4 is a **temporary patch**.

**Action**: In `mlb-morning-runner`, check the SQL or code that aggregates `mlb_pitcher_logs.xfip` into `mlb_starter_pregame.season_pre_xfip`. Likely culprits: stale `xfip_constant`, wrong league HR/FB% input, or IP-weighting bug. Note: `xera_est` from the same table tracks correctly, so the bug is xfip-specific.

### 3. Fix the upstream pipeline that produces `mlb_batting_pregame.season_pre_hard_hit_pct` and `season_pre_barrel_pct`
- April 2024-2025 hard_hit averaged 0.405; April 2026 averages 0.297. Same-month comparison rules out seasonality.
- Same source produces ~0.063 barrel vs ~0.080 historical.
- The +0.103 / +0.017 bias corrections in Phase 7 are **temporary patches**.

**Action**: In `mlb-morning-runner`, find the calculation for these contact-quality stats. Likely an aggregation or unit issue introduced when the pipeline was updated for 2026.

### 4. Fix the upstream ETL that should be populating `mlb_game_log.bat_season_ops`, `bat_season_k_pct`, `bat_season_bb_pct`, `bat_last5_xwobacon` for 2026
- These columns were NULL across every 2026 game (source had values but ETL never copied them).
- After this incident's backfill, they're populated, but the underlying ETL bug will reappear if it isn't fixed.

**Action**: Find and fix the periodic job (in `mlb-morning-runner` or a Supabase function) that copies these columns from source to `mlb_game_log`. Likely a column was added or renamed and the ETL wasn't updated.

### 5. Re-validate the ~26 signals that have NO recorded stats
These signals are surfaced in the UI as live signals but have NULL `total_picks`/`win_pct`/`roi_pct`:

`bat_cooling_off`, `bat_heating_up`, `bat_power_fading`, `bp_fatigue_regress`, `bp_fatigued`, `bp_trending_better`, `bp_trending_worse`, `park_hitter_friendly`, `park_hr_haven`, `park_pitcher_friendly`, `sched_cold_streak`, `sched_hot_streak`, `sched_road_trip`, `sched_well_rested`, `sp_contact_elite`, `sp_contact_poor`, `sp_era_lucky`, `sp_era_unlucky`, `sp_form_declining`, `sp_form_improving`, `sp_xera_lucky`, `sp_xera_unlucky`, `weather_cold`, `weather_hot_wout`, `weather_win_in`, `weather_win_out`

**Action**: Either compute truth-derived stats for each, or remove them from the public-facing UI until validated.

## Operational guidance until #1 is done

Until the model is retrained on the corrected data, **do not act on any pick that is not validated by the Perfect Storm signal stack** (hammer / ps / lean / watch tier). The signal stack uses a different feature path and remained 53-71% profitable through this entire incident:

| Slice | 30-day record |
|---|---|
| Perfect Storm tier ML picks | 19-14 (57.6%, +14% ROI) |
| No-tier ML picks (model edge only) | 9-27 (25.0%, -58% ROI) |

## Files in this repo

- `supabase/migrations/20260506130000_recalibrate_transition_collision_to_walkforward.sql` — earlier walk-forward correction
- `supabase/migrations/20260507120000_remove_g2_blowout_sweet_spot.sql` — removed the fabricated signal
- `supabase/migrations/20260507130000_backfill_corrupt_model_features.sql` — the 7-phase backfill
- `docs/MLB_MODEL_INCIDENT_2026_05_07.md` — this document

## Audit trail of what we found vs what was claimed

| Signal | Was recorded | Audit derived | Action |
|---|---|---|---|
| `g2_blowout_sweet_spot` | 74 picks, 66.2%, +25.5% ROI | 130 candidates max, peak 53.7% on G2 UNDER | **Removed** |
| `g4_modfav_sweep_fade` | 31 picks, 67.7%, +17.9% ROI | 35 picks, 62.9%, +39.1% ROI | **Updated** to truth |
| `transition_collision_both_high` | 47 picks, 78.3%, +49.4% ROI (leaky) | 42 picks, 75.0%, +41.1% ROI (walk-forward) | **Updated** earlier |
| `transition_collision_both_low` | 37 picks, 83.3%, +59.0% ROI (leaky) | 46 picks, 58.7%, +12.1% ROI (walk-forward) | **Updated** earlier |
| All cron-managed g2/g3 signals | various | now truth-derived from cron | **Refreshed** |

## Honest accounting

The original `g2_blowout_sweet_spot` numbers (74 picks / 66.2% / +25.5% ROI) were communicated to users / customers as a real edge. Those numbers were not reproducible from the actual data and should never have been published. The signal has been removed and the cron patched so it cannot reappear. Any user-facing communication that referenced this signal should be retracted.
