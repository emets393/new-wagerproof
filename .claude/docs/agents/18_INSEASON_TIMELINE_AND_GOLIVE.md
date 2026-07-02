# 18 — In-season data-availability timeline + NFL/CFB go-live runbook

Two things: (1) when each piece of data is ready during a game week (for the in-app
"data ready" messaging), and (2) the exact one-command switch from dry-run to live 2026.

---

## Weekly data-availability timeline (in-season)

| When (ET) | Trigger | What becomes available |
|---|---|---|
| **Tue ~7am** | `nfl-slate-weekly` cron → `run_nfl_week.sh` | Slate + model picks (sides Wk1+, **totals Wk4+** by design), player props, team/coach/player trends, H2H matchups, opening odds, weather forecast |
| **Mon ~7am** (CFB) | `cfb-slate-weekly` cron → `run_cfb_week.sh` | Same for CFB (team + coach trends; no refs/props) |
| **Hourly, all week** | `nfl-live-odds-hourly`, `nfl-live-props-hourly`, `cfb-live-odds-*` | Odds (FG+1H+TT) + props refresh; lines move, weather forecast sharpens |
| **Wed** | NFL announces officiating crews → `nfl-cfb-grade-daily` step 5 backfills them | **Referee assignments + ref trend cards** (the last piece) |
| **Daily ~9am** | `nfl-cfb-grade-daily` → `grade_week.sh` | Post-game grading (finals, player logs, props, signal_performance); + refreshes refs/cards/lines |

**Message to users:** *most* data lands **Tuesday** (Monday for CFB); the slate is **complete —
including referees — by Wednesday.** Weather is a forecast that refreshes daily toward kickoff.

Why refs are last: NFL crews are announced **Wednesday**, after the Tuesday slate build. nflverse
(our source) only fills the `referee` field once the league posts it; `backfill_dryrun_referees.py`
in the daily grade job catches it mid-week.

---

## GO-LIVE runbook — switch NFL + CFB from dry-run to real 2026 data

### Trigger phrase
Tell Claude: **"go live 2026"** (also accepts "switch NFL/CFB to live data"). That runs the
CODE steps below and re-lists the ops/dashboard steps only you can do.

Note: the Render crons ALREADY target 2026 (`run_nfl_week.sh 2026 $(current_week.py nfl 2026)`),
so once the code is ready and the ops items are done, the season-gated crons auto-start in
Aug/Sep — no per-week toggling. The dry-run 2025 data coexists (tables are season-keyed) and
stays as history.

### CODE steps (Claude executes on the trigger)
1. **Bump season caps** so 2026 games get input features: `build.py` (`ng.season.between(2018,2025)`)
   and `b3_engineer.py` (same) → `2026`. Verify `archetypes.py` assigns 2026 games.
2. **1H-frame upcoming-games path**: `quarter_scores.py` / `h1tt_frame.py` / `h1tt_p1_baseline.py` /
   `h1tt_p8_coach.py` hardcode `(2023,2024,2025)` and inner-join to *played* results, so unplayed
   2026 games drop → `h1m_preds.parquet` has no 2026 slate rows → 1H cards blank. Add 2026 + an
   unplayed-game path so 1H predictions generate for upcoming games.
3. **Train + commit frozen 2026 models** (trained on 2020–2025 only — never on 2026):
   `fetch.py --train` → build chain → `consensus_totals.py --train`, `forecast_harness.py --train`
   → commit `data/{sides_models_2026,totals_b15_2026,totals_b55_2026}.pkl`; CFB `cfb_forecast --train`
   → `out/cfb_models_2026.pkl` + `cfb_confirm_2026.pkl`.
4. **Verify** a 2026 slate build produces picks (sides Wk1, totals Wk4+) and the trends/cards generate.

### OPS / dashboard steps (owner does — Claude can't)
- **Un-pause the legacy `cfb_automation` NFL crons** (EPA / power-ratings / pregame-NGS / injuries /
  weather / betting-lines / schedule / `nfl-predictions`) for Sep 2026, and settle **GitHub-Actions-
  vs-Render ownership** so exactly one copy runs (double-write risk). These feed the new model's
  `fetch.py` views AND the 2 legacy signals.
- **Load `nfl_week_ranges` for 2026** (no cron writes it; the legacy slate view needs it).
- **Fill the Render env group** `wagerproof-model-secrets`: `DATABASE_URL` (grading skips silently
  without it), `SUPABASE_SERVICE_KEY`, `ODDS_API_KEY`, `CFBD_API_KEY`, `WEATHER_API_KEY`.
- **Confirm the `new-wagerproof` Blueprint is connected** in Render and deploys from the branch
  holding this code (merge the feature branch → `main` if that's what Render watches).
- **CFB**: confirm CFBD + Odds-API feeds land for 2026 and the `cfb-weather` / schedule crons are
  un-paused for August (the CFB builder then auto-detects the 2026 season — no code change).
- At go-live, set `NFL_WEEK=$(python3 current_week.py nfl "$SEASON")` for the daily ref/cards step in
  `grade_week.sh` (currently defaults to the dry-run week).
