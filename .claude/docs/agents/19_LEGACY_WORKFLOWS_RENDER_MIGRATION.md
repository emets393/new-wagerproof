# Legacy NFL/CFB Workflows — what we keep, what we retire, and the Render rebuild

> Owner asked (2026-07-26) for the documentation of what we still need from the legacy
> `cfb_automation` GitHub Actions workflows before rebuilding them as Render cron services.
> This is that audit. Source of truth = `cfb_automation/.github/workflows/*.yml` +
> `cfb_automation/scripts/cfb/*.py`. Related: [[season-2026-pipeline-readiness]],
> [[nfl-legacy-model-sourcing]], [[render-cron-migration]].

## Why we keep ANY legacy NFL jobs

The new frozen model writes the `nfl_slate_*` tables (agents already read them). But **two
consumers still depend on the legacy NFL prediction chain**, so it must keep running until the
final app-switchover:

1. **The web games feed** — `src/features/games/api/nflGames.ts` reads `v_input_values_with_epa`
   + `nfl_predictions_epa` + `nfl_betting_lines` + `production_weather` (the LEGACY model is what
   users see on web today).
2. **The new model's dual-feed** — `legacy_primetime` + `legacy_fade` signals consume
   `nfl_predictions_epa.home_away_spread_cover_prob` via `forecast_harness.load_legacy()`.

CFB has almost no legacy coupling: the new CFB model regenerates everything itself from CFBD.
Only the schedule/finals table and the weather table are shared inputs.

## NFL — KEEP & rebuild in Render (the legacy prediction pipeline)

| Workflow | Runs | Output | Why keep |
|---|---|---|---|
| `nfl-schedule-updater` | Mon/Tue/Fri 10am ET | `nfl_tr_scrape_nfl_schedules.py` → schedule | feeds the whole chain |
| `nfl-epa-weekly` | Tue | `epa_upsert_current_week.py` → EPA features | model input |
| `nfl-team-stats-weekly` | Tue | `nfl_tr_scrape_team_stats.py` → `nfl_team_stats` (TeamRankings predictive/SOS) | power ratings for BOTH models |
| `nfl-pregame-weekly` | Tue | `pregame_advanced_pbp_upsert_current_week.py` + `pregame_injuries_upsert_current_week.py` | advanced + injuries features |
| `nfl-betting-lines` | Mon–Thu (multiple) | betting lines → `nfl_betting_lines` | model input + web feed |
| `nfl-weather` | daily | `fetch_nfl_weather.py` → `production_weather` | web feed + model |
| `nfl-predictions` | chained after features (Tue) | `nfl_predict_with_epa.py` → `nfl_predictions_epa` | **THE legacy model that predicts games** — web feed + dual-feed column |

Build order (each feeds the next): schedule → epa + team-stats + pregame → betting-lines +
weather → **predictions**. In Render, schedule these Tue morning in that order (predictions last).

## CFB — KEEP & rebuild in Render

| Workflow | Runs | Output | Why keep |
|---|---|---|---|
| `cfb-games-schedule` | 4×/day | `cfb_games` (schedule + finals) | `fill_finals.py` reads finals here; schedule |
| `cfb_weather` | hourly (soft-gated 10am ET) | `cfb_weather_snapshot.py` → `cfb_weather_data` | **the NEW CFB model reads this** (`run_cfb_week.sh` → `fetch_supabase`) |

There is no live CFB legacy *prediction* workflow to keep — `cfb_api_predictions` is retired
(app told to stop reading it), and the new model regenerates CFB features in-process.

## RETIRE (do NOT make these recurring Render crons)

| Workflow | Why |
|---|---|
| `nfl-pregame-backfill` | manual `workflow_dispatch` historical backfill (seasons input) — one-off tool, keep the script for manual use only |
| `nfl-training-data-epa-backfill-2025` | one-time 2025 backfill, already done |

## Rebuild plan (into the `cfb_automation` "WagerProof" Render blueprint)

**UPDATE 2026-07-26 — the rebuild was ALREADY done in a prior session** (my earlier "kept on
GitHub" note was stale). `cfb_automation/render.yaml` already defines the legacy jobs as
`type: cron` services, season-scoped (NFL `9-12,1,2`; CFB `8-12,1`), on the `cfb-automation-secrets`
env group: `nfl-schedule-updater`, `nfl-epa-weekly`, `nfl-pregame-weekly`, `nfl-predictions`,
`nfl-weather`, `nfl-betting-lines-weekdays`, `nfl-betting-lines-gameday`, `nfl-team-stats-weekly`,
`cfb-schedule-and-model`, `cfb-weather`. All deployed in the WagerProof blueprint.

Remaining to finish the cutover:
1. **Dep fix (blocking, DONE via PR):** `nfl_data_py` was missing from `requirements.txt` — the
   `nfl-epa-weekly` cron (`epa_upsert_current_week.py`) would `ModuleNotFoundError` when it fires
   ~Sep. Fixed in **cfb_automation PR #32** (merge before season). This is why NFL "stayed on
   GitHub" — the Render NFL jobs would have crashed on this dep.
2. **Verify** a Render NFL job runs clean after PR #32 syncs (best done pre-season with data).
3. **Disable the GitHub Actions twins** ONLY after step 2 — until then the GitHub `.yml` files are
   the working fallback for the NFL/CFB feeds. Don't delete them yet (double-run risk is nil while
   NFL is season-gated off; CFB `cfb-weather`/`cfb-schedule` fire Aug on both sides — dedupe those
   two first if we let August run).

## Status (2026-07-26)
- **Documented:** ✅ (this file).
- **Legacy jobs in Render:** ✅ already defined + deployed in `cfb_automation/render.yaml` (10 season-gated crons).
- **nfl_data_py dep:** ⏳ PR #32 open (merge before Sep).
- **GitHub twins:** still active (working fallback) — retire after Render NFL verified.
- **Manual run done:** `nfl_tr_scrape_team_stats.py` run by hand 2026-07-25 → 2026 power ratings already in `nfl_team_stats`.
- **New pipeline (WagerProof-NFL/CFB blueprint):** deployed on merge `a4eda3cf`, all 6 crons SUSPENDED 2026-07-26 (season not started).
