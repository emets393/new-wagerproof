# 14 — NFL & CFB 2026-Season Data-Pipeline Readiness Audit

**Status:** Audit (2026-06-21). What the 2026 NFL/CFB pipelines need so live data flows into the same contract the V3 agents + website read. Pairs with [13_CROSS_SPORT_AND_PARLAYS.md](13_CROSS_SPORT_AND_PARLAYS.md). Decision driving this: build the live data foundation *first*, then flip on V3. Dryrun/dummy data stays (test bed).

## TL;DR

- **Two pipelines per sport:** *legacy* (live on cron, produces today's prediction tables) and *new* (the locked dryrun models — hand-run prototypes, **not** on cron).
- **The NFL "dual-feed" constraint is real but NARROW.** The new model is self-sufficient **except one legacy column**: `nfl_predictions_epa.home_away_spread_cover_prob`, consumed by exactly **2 signals** (`legacy_primetime`, `legacy_fade`). Keep the legacy cron alive for that one column; everything else the new model computes itself from nflverse PBP.
- **CFB has NO legacy coupling.** The new CFB model re-runs in-process (no join to a stored legacy prediction). The legacy `cfb_api_predictions` is dead and should be retired.
- **Umbrella gap:** both new models are hand-run, hardcoded to 2025 (wk12 NFL / wk7 CFB), read backfill parquet, and live in `new-wagerproof/research/` — the wrong repo for cron. **Productionizing them is job #1.**
- **Finals/grading:** CFB finals already land live (CFBD → `cfb_games`); NFL has **no** live finals writer (the existing scrape writes an incompatible schema). `signal_performance` and NFL/CFB agent-pick grading are unbuilt.

## Current DB snapshot (offseason, 2026-06-21, project `jpxnjuwglavsjbgbasnl`)

- **Legacy outputs EMPTY** (expected in June): `nfl_predictions_epa` 0, `nfl_betting_lines` 0, `nfl_epa_data` 0, `nfl_team_stats` 0, all 32 `nfl_<team>_games` 0, `nfl_week_ranges` 0; CFB legacy `cfb_api_predictions` 0, `cfb_weather_data` 0.
- **Dryrun DUMMY data present:** `nfl_dryrun_games` 14 / `_picks` 112 / `_flags` 64 / `_props` 942; `cfb_dryrun_games` 56 / `_picks` 448 / `_flags` 196. `signal_performance` 56 rows (hand-loaded — **no automated writer**).
- **Historical/static intact:** `nfl_historical_odds` 323K, `nfl_player_props` 915K, `nfl_player_game_logs` 11K, `cfb_games` 1688, `cfb_training` 1595, `cfb_team_mapping` 265.

---

## NFL

### A. Legacy pipeline — KEEP RUNNING (cfb_automation, Render cron)

The legacy NFL pipeline runs on **BOTH GitHub Actions (`.github/workflows/`, 9 files) and Render (`render.yaml`, 8 services)** — the same jobs are duplicated. **Confirm which is authoritative before 2026** (the migration note says NFL stayed on GitHub → the Render copies should be paused, else double-writes). Complete set cross-checked 2026-06-21: **7 scheduled jobs + 2 manual backfills** (`nfl-pregame-backfill`, `nfl-training-data-epa-backfill-2025`). All write the **main** Supabase project (`jpxnjuwglavsjbgbasnl`).

**Reuse for the new model:** the `nfl-pregame-weekly` pipeline (`nfl_pregame/{advanced_pbp,ngs,ftn,injuries,officials}.py`) already pulls the nflverse NGS/FTN/injuries/advanced-PBP the new matchup builder consumes, and `nfl_pregame/common.py` is already season/week-parametrized (`NFL_OVERRIDE_SEASON`/`NFL_OVERRIDE_WEEK`, reads `nfl_week_ranges`) — so the new NFL data layer largely **reuses** it. **No automated results→training refresh exists** (`nfl_training_data`/`_epa` only via the manual 2025 backfill).

| Job (render.yaml) | Script | Schedule (ET) | Writes | Source | Role |
|---|---|---|---|---|---|
| nfl-betting-lines (×2) | `vsin_nfl_week_to_supabase.py` | Mon–Fri + gameday | `nfl_betting_lines` | VSiN | shared input |
| nfl-predictions | `nfl_predict_with_epa.py` | Thu/Sun/Mon | **`nfl_predictions_epa`** | XGBoost on `v_input_values_with_epa` | **legacy model** |
| nfl-weather | `fetch_nfl_weather.py` | daily | `production_weather` | Visual Crossing | input |
| nfl-schedule-updater | `nfl_tr_scrape_nfl_schedules.py` | Mon/Tue/Fri | `nfl_<team>_games` | TeamRankings | schedule/results |
| nfl-epa-weekly | `epa_upsert_current_week.py` | Tue | `nfl_epa_data` | nfl_data_py PBP | input |
| nfl-pregame-weekly | `nfl_pregame/*.py` | Tue | `nfl_pregame_*` | nfl_data_py | **built but unused** by live model |
| nfl-team-stats-weekly | `nfl_tr_scrape_team_stats.py` | Tue | `nfl_team_stats` | TeamRankings | input |

**Why keep it:** `forecast_harness.py:load_legacy()` (lines 94–106) pulls `nfl_predictions_epa.home_away_spread_cover_prob` → `leg_sp`, feeding `legacy_primetime` + `legacy_fade` (lines 781–790) — both ACTIVE high-conviction flags (+ 2 mammoth spots + 2 teaser rules). If `nfl_predictions_epa` goes stale, those 2 signals silently stop; the core sides/totals/props models are unaffected. **That single column is the entire NFL dual-feed obligation.**

> Supporting refs that must be current for 2026: `nfl_week_ranges` (2026 week windows — no cron writes it, manual load), `nfl_team_mapping`, and the DB views `v_input_values_with_epa` / `v_current_nfl_week`. Also: `nfl_training_data` (the results/outcomes table feeding the training set) has **no in-repo writer** — refreshed externally/manually; no automated in-season training refresh exists.

### A-bis. Legacy-model recreation recipe (verified 2026-06-23) — every feature → exact source

The legacy spread model (`nfl_predict_with_epa.py`, XGBoost on `v_input_values_with_epa` → `nfl_predictions_epa.home_away_spread_cover_prob`) needs ~106 features. **All are STATIC within the week (scraped Tuesday) except Vegas lines + weather, which are joined latest each run.** Verified: `v_nfl_pregame_features_full` carries every feature with values **100% identical** to `nfl_training_data_epa` (2,226 games, maxdiff 0.000000) — so the model can read its full input from the pregame view; the standalone training table is redundant.

**STATIC — scraped Tuesday** (`nfl-epa-weekly` Tue 10am, `nfl-team-stats-weekly` Tue, `nfl-pregame-weekly` Tue, `nfl-schedule-updater`):
- **EPA (16 cols)** — `epa_upsert_current_week.py` / `nfl_training_data_epa_backfill_2025.py`, from `nfl_data_py.import_pbp_data`. **Exact filter (verified reproducible to 6 decimals):** PASS = `pass_attempt==1 OR qb_scramble==1`; RUSH = `rush_attempt==1`; exclude `qb_kneel` + `two_point_attempt`. Per-team-week mean → `s2d` = `expanding().mean()` of the weekly means (shift 1 for pre-game, ffill through byes); `last3` = `rolling(3).mean()`. Edges = team off-EPA − opponent matching def-EPA (`home_pass_edge = home_pass_epa − away_def_pass_epa`, …; `edge_home = Σ home edges − Σ away edges`).
- **Power ratings (4) + L3 efficiency** — `nfl_tr_scrape_team_stats.py`, scraped from **teamrankings.com**: `future_sos_rating`→`sos_pr`, `predictive_rating`→`predictive_pr`, `consistency_rating`→`consistency_pr`, `last5_games_rating`→`last5_pr`; plus L3 efficiency (3rd-down %, opp 3rd-down, scoring margin, seconds/play, turnover margin, opp points/play, (opp) red-zone %, points/play). **← these power ratings are also a feature in the NEW model.**
- **Streaks / last-game / advanced-PBP / NGS / injuries / officials** — `nfl_pregame/{advanced_pbp,ngs,ftn,injuries,officials}.py` + `nfl_tr_scrape_nfl_schedules.py`.

**DYNAMIC — joined latest each run:** Vegas lines (`vsin_nfl_week_to_supabase.py` → `nfl_betting_lines`, Mon–Fri + gameday) · weather (`fetch_nfl_weather.py` → `production_weather`, daily).

**Recreate the model:** Tuesday static scrape → assemble `v_nfl_pregame_features_full` → join latest lines + weather → score `nfl_predict_with_epa.py`. `unique_id` (`homeCity+awayCity+season+week`) ↔ nflverse `game_id` via `nflverse_games`.

> **⚠️ Correction to the TL;DR / §A** ("the new model computes EPA itself from nflverse PBP"): it does **not** compute EPA in-pipeline — `research/nfl-extreme-outcomes/fetch.py` PULLS `training_epa`/`pregame` from the cfb_automation Supabase tables. The EPA *is* reproducible from nflverse (verified above), but today it's sourced from the cron's output. The cfb_automation code is a **sibling repo**: `~/Documents/cfb_automation/scripts/cfb/`. To make the new pipeline self-sufficient, port the EPA filter (above) + the TeamRankings scrape into it.

### A-ter. Unify legacy + new model onto ONE feature table (verified 2026-06-23)

**Goal (per owner):** both models read the *same* table; drop the redundant `nfl_training_data_epa` + `v_input_values_with_epa`. **Verified feasible as a pure CONFIG change — zero model code.**

- The legacy model (`nfl_predict_with_epa.py`) is **view-agnostic**: it reads `NFL_TRAIN_TABLE` (default `nfl_training_data_epa`) + `NFL_INPUT_VIEW` (default `v_input_values_with_epa`) from env, **builds `unique_id` itself** from home/away/season/week (code comment: *"NO dependency on home_away_unique"*), and selects features from `GROUPS`. `ID_KEEP` carries `unique_id`/`training_key`, never `home_away_unique`.
- The new model's views are a **verified superset**: `v_nfl_pregame_features_full` (TRAIN, 249 cols — has the `home_away_spread_cover` target + every GROUPS feature; values **100% identical** to `nfl_training_data_epa` across 2,226 games) and `v_nfl_slate_inputs` (SCORE, 249 cols — **0 model feature columns missing**). The only legacy-view column absent from the pregame view is `home_away_unique`, which the model doesn't use.

**The unification = set two env vars on the `nfl-predictions` job** (GitHub Actions), no code:
- `NFL_TRAIN_TABLE = v_nfl_pregame_features_full`
- `NFL_INPUT_VIEW  = v_nfl_slate_inputs`

Then retire `nfl_training_data_epa` + `v_input_values_with_epa`. (The TeamRankings power ratings in these views are *also* a new-model feature, so one table genuinely serves both.)

**Shadow first (the one open check):** the TRAIN side is value-verified identical; the SLATE side is only **column**-verified (both views empty offseason, can't value-compare). So before flipping production, run the model with the unified env vars + `NFL_PRED_TABLE=nfl_predictions_epa_shadow` on the first live 2026 week, leaving production on the old vars, then compare:
```sql
SELECT s.unique_id, s.home_away_spread_cover_prob AS shadow, p.home_away_spread_cover_prob AS prod,
       abs(s.home_away_spread_cover_prob - p.home_away_spread_cover_prob) AS diff
FROM nfl_predictions_epa_shadow s JOIN nfl_predictions_epa p USING (unique_id) ORDER BY diff DESC;
```
If `diff ≈ 0` across the slate, flip the production env vars + retire the old view/table. If not, it's a same-name-different-definition column in the slate view to reconcile first.

**Timing (comfortable, low-stakes):** the s2d / last-3 features need ~2 weeks of games, so the legacy model first produces meaningful output around **Week 3** — making **Weeks 1–2 the natural shadow-validation window** to confirm the slate-view data flows correctly before the first real run. And the legacy model feeds **only the 2 signals (`legacy_fade` / `legacy_primetime`), never a displayed prediction** — so a not-yet-running or still-validating legacy model has **zero** user-facing impact (shown predictions come from the new model + other feeds). No rush to flip; validate through Weeks 1–2, cut over by Week 3.

### B. New model — PRODUCTIONIZE (research/nfl-extreme-outcomes, hand-run)

Locked models and their **live weekly inputs**: TOTALS (`consensus_totals.py`, b15+b55 ensemble) ← `matchup.parquet` (own EPA-s2d features) + `scheme_plays.parquet` + `odds_consensus.parquet`; SIDES (`forecast_harness.py`, BASE+21 matchup-nets) ← `matchup.parquet` (power ratings + EPA nets) + odds + NGS/def; 1H model (tracking tier) ← `h1m_preds.parquet` + `h1tt_frame.parquet`; PROPS P11/P12/P13 ← `props_frame.parquet` + NGS. Build = `dryrun_wk12_games.py` + `dryrun_wk12_props.py` → `nfl_dryrun_*`.

**Gaps:** hand-run, hardcoded `SEASON,WEEK=2025,12`, reads backfill parquet (not live). **Missing builders** (not in repo): the `matchup.parquet` builder, the NFL 1H-model builder, and `fetch.py` (the harness's live Supabase pull). Plus `DRYRUN_WK12_SPEC.md §5`: live 1H/TT/team-total odds collector (backfill-only today), K4 offshore polling, weather not joined, no calibrated ML model (`fg_home_win_prob` is a Φ stand-in).

### C. Finals + grading — BUILD

NFL finals (`nfl_dryrun_games.final_*`/`h1_*`) have **no live writer** — populated only by the hand-run script from `h1tt_frame.parquet`. The production scrape writes a **different schema** (`nfl_<team>_games.primary_points/opponent_points`, id `unique_id`=`BuffaloBillsHoustonTexans202512`) — **no bridge** to the nflverse `game_id` (`2025_12_BUF_HOU`), and **no first-half source**. Build an NFL fill-results job (mirror MLB's `mlb_fill_results.py`) using `nfl_data_py import_schedules()` for finals (nflverse `game_id`, `home_score`, `away_score`) + ESPN for the H1 split.

---

## CFB

### A. Legacy — RETIRE

`cfb-schedule-and-model` cron runs `games_schedule_snapshot.py` (KEEP — produces `cfb_games`, self-sufficient CFBD) then `cfb_model.py` → `cfb_api_predictions` (**dead** — depends on `cfb_live_weekly_inputs`, which nothing populates; app is told to stop reading it per `CURSOR_CFB_PROMPT.md`). Retire the `cfb_model.py` half once the app cuts to dryrun tables. Keep `cfb-weather` (the new model needs `cfb_weather_data`).

### B. New model — PRODUCTIONIZE (research/cfb-model, hand-run, SELF-SUFFICIENT)

Fully in-house: `build_ratings.py` → `build_features.py` → `model_games.parquet`; `cfb_forecast.build_season()` runs the locked GBM **in-process** (no legacy join). Live inputs: **CFBD API** (`fetch_cfbd*.py`), **The Odds API** (`odds_history` + `event_odds` for team-totals + all 1H), and the live **`cfb_weather_data`** table. Produces `cfb_dryrun_*`.

**★ Zero legacy-model references** (grep-confirmed: no `cfb_api_predictions`/`cfb_live_weekly_inputs` reads). The only shared dependency is the weather *table* (data input, not a model output).

**Gaps:** hand-run, hardcoded `SEASON,WEEK=2025,7`; `build_features.py:25`/`build_ratings.py:17` hardcode `YEARS=[2016..2025]` (no 2026); **no orchestration runner**; lives in `new-wagerproof/research/` not `cfb_automation`; 2026 odds-feed capture not confirmed (without it, team-totals + 1H + STACK spots silently don't fire).

### C. Finals + grading — BUILD (lighter than NFL)

CFBD finals **already land live**: `games_schedule_snapshot.py` writes `cfb_games.home_points/away_points` on cron. Build a job that joins `cfb_games` → `cfb_dryrun_games.final_*` by `game_id` (+ derive H1 from CFBD `homeLineScores[:2]`). `gen_cfb_picks.py` does **not** populate the `result` column (confirmed) — but the agent grader computes from raw finals anyway.

---

## Cross-cutting gaps (both sports)

1. **`signal_performance` has no automated writer.** The Swift client expects an RPC `refresh_all_signal_performance(season)` that doesn't exist. Build: DDL + an aggregation RPC that grades each flag against its `grade_line`-selected line (`grade_play` math) and rolls up `n/wins/losses/pushes/hit_rate/units/roi` per `(sport, signal_key, season)`. **Units convention: flat −110** (`pnl_110 = won ? 100/110 : −1.0`, push 0) per `forecast_harness.py:653`.
2. **`grade-avatar-picks` walls out NFL/CFB** ([index.ts:751](../../supabase/functions/grade-avatar-picks/index.ts)). Per doc 13: drop the filter, add a dryrun `final_*` source keyed by `game_id`, apply `grade_play` math, emit the `won/lost/push` enum (note dryrun uses `win/loss`).
3. **Repo location.** The new models live in `new-wagerproof/research/`; the cron infra is in `cfb_automation/`. Decide where the productionized weekly pipelines live (and how the parquet-builder chain is sourced live).
4. **GitHub-vs-Render ownership** of NFL/CFB crons is ambiguous (per the render-cron-migration note, NFL/CFB stayed on GitHub while others moved to Render). Confirm the authoritative owner and un-pause for Aug/Sep 2026.

---

## Prioritized build checklist (2026 readiness)

**P0 — keep the lights on**
- [ ] Load `nfl_week_ranges` for 2026; confirm legacy NFL cron (lines/EPA/team-stats/weather/predictions) un-paused for Sept → keeps `nfl_predictions_epa` (the 2-signal dual-feed) alive.
- [ ] Confirm CFB `games_schedule_snapshot.py` + `cfb-weather` un-paused for Aug.

**P1 — productionize the new models** (umbrella prerequisite for everything)
- [ ] Locate or rebuild the missing NFL builders (`matchup.parquet`, 1H model, `fetch.py`).
- [ ] Parametrize both generators by season/week (kill the 2025 hardcodes); advance CFB `YEARS` to 2026.
- [ ] Live-source the weekly inputs currently faked by backfill parquet (NFL: matchup/odds_consensus/h1tt/props; CFB: CFBD + Odds API + event-odds).
- [ ] Orchestration runners (fetch → build → forecast → generators), wired onto Render cron, season-scoped.

**P2 — finals + grading**
- [ ] NFL fill-results job (nfl_data_py finals + H1) → `nfl_dryrun_games.final_*`.
- [ ] CFB join job `cfb_games` → `cfb_dryrun_games.final_*`.
- [ ] `signal_performance` DDL + `refresh_all_signal_performance(season)` aggregation RPC.
- [ ] Extend `grade-avatar-picks` to NFL/CFB (doc 13).
- [ ] New Render fill+grade runners (mirror `mlb-morning-runner`): NFL Tue/Wed, CFB Sun/Mon, season-scoped.

## Needs your confirmation
- **The missing NFL builders** (`matchup.parquet` builder, the 1H-model trainer, `fetch.py`) — do these exist in another thread / elsewhere on disk, or do we rebuild them?
- **Where the productionized new-model pipelines should live** — inside `cfb_automation` (with the cron infra) or a new home.
- **Cron ownership** — GitHub Actions vs Render for NFL/CFB going into 2026.
