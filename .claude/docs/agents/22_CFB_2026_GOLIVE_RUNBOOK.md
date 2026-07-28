# 22 — CFB 2026 Go-Live Runbook

**Status:** The CFB dry-run model pipeline (`research/cfb-model/run_cfb_week.sh` → `cfb_dryrun_*`) is now
**code-ready to run a fresh 2026 week** (fixed 2026-07-28). Remaining work is CONFIG + an owner decision +
August data availability — enumerated below. Pairs with [14_SEASON_2026_PIPELINE_READINESS.md](14_SEASON_2026_PIPELINE_READINESS.md).

## The one decision that gates everything
The live web `/games` CFB page (`src/features/games/api/cfbGames.ts`) reads in two modes:
- **"regular" (production users) → LEGACY `cfb_live_weekly_inputs` + `cfb_api_predictions`** (the old model, cfb_automation cron).
- **"dry-run" (admin only) → NEW `cfb_dryrun_games`** (the self-sufficient GBM + every signal we built).

**Choose the launch path:**
- **Path A — legacy floor:** set `SEASON=2026` in Render (below) and users get working CFB predictions Day 1
  from the old model. Zero app change. **None of the new signals reach users** (they live in `cfb_dryrun_flags`).
- **Path B — new model:** schedule the dry-run pipeline (below) + cut `cfbGames.ts`/`liveScoresService.ts`
  "regular" mode to read `cfb_dryrun_games`/`_flags` + build the production signal-flag UI + retire
  `cfb_model.py`. Delivers the new model + G5 spots + style-under + weather/dome + (August) returning-production.

**Recommended:** ship **A** as the floor now, run **B** in parallel and cut over by ~Week 3–4 once validated on
live 2026 data (mirrors the NFL shadow-then-flip in doc 14).

## ✅ Done this session (code-ready — verified)
- **All 14 hardcoded `*_2025.*` paths parametrized** to `{SEASON}` in `gen_cfb_dryrun_games/picks/flags/team_trends.py`.
- **Pipeline-order fix:** `run_cfb_week.sh` now runs `cfb_forecast.py --season $SEASON --week $WEEK` (writes the
  `out/cfb_{predictions,bets,team_totals,h1_model}_$SEASON.csv` the generators read) **before** the generators —
  previously it relied on stale CSVs and a fresh 2026 run would have failed.
- **Resilient model load:** `cfb_forecast.py` frozen-`.pkl` loads are wrapped in try/except → deterministic
  retrain-and-warn on failure (a numpy-version drift that breaks the pickle can no longer take the run down).
  Smoke-tested: `cfb_forecast.py --season 2025 --week 7` retrains + writes all CSVs, exit 0.
- **Unattended-week resolver:** `resolve_cfb_week.py` (from CFBD `/calendar`) → `run_cfb_week.sh` auto-resolves
  the current week when no args/env given (explicit `./run_cfb_week.sh 2026 1` or `CFB_SEASON/CFB_WEEK` still win).
- **Frozen 2026 models present:** `out/cfb_models_2026.pkl` + `cfb_confirm_2026.pkl`; `--season 2026` loads them.
- **`build_features/build_ratings` auto-advance** (`_seasons_in_cache`, not hardcoded) — 2026 auto-included once
  `games_2026.parquet` exists (it does).
- New signals already wired: `build_football_profiles.py` runs before flags; G5 spots + `style_offense_under` fire.

## 🔴 P0 — must happen before/at Week 1 (config + owner)
1. **Set `SEASON=2026` in Render** for `cfb-schedule-and-model` + `cfb-weather` (env group `cfb-automation-secrets`
   or per-service). `games_schedule_snapshot.py:27` defaults to 2025 → without this it fetches 2025 games. **Hard blocker for Path A.**
2. **Confirm CFBD has the 2026 schedule/rosters** (~mid-Aug): `curl -H "Authorization: Bearer $CFBD_API_KEY"
   "https://api.collegefootballdata.com/games?year=2026&week=1&seasonType=regular&classification=fbs"` returns games.
3. **Path A only:** confirm the `cfb_live_weekly_inputs` view populates for 2026 with `api_spread`/`api_over_line`
   (else `cfb_model.py` crashes).

## 🔴 P1 — Path B (schedule the new pipeline)
4. **Confirm live 2026 odds capture:** `fetch_event_odds_live.py` + `fetch_odds_history.py` must produce
   `data/event_odds/events_2026.parquet` + `data/odds_history/odds_2026.parquet` in-season (team totals + all 1H).
   Without them, TT + 1H + STACK spots silently don't fire. The `live_odds_cfb_1h.py` DB writer must be running.
5. **Schedule `run_cfb_week.sh`** (it's currently hand-run, scheduled nowhere). Two options — **owner decision**:
   - **A) GitHub Actions in `new-wagerproof`** (pipeline lives here) — template below.
   - **B) Render cron in `cfb_automation`** (cron home) — requires sourcing the `research/cfb-model` code there.
   Either way it needs `.env.local` secrets (`CFBD_API_KEY`, Odds API, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`).
6. **App cutover:** point `cfbGames.ts`/`liveScoresService.ts` "regular" mode at `cfb_dryrun_games`/`_flags`; build
   the production signal-flag UI; then **retire `cfb_model.py` → `cfb_api_predictions`**.

## 🟡 Weeks 1–3 display predictor (`cfb_early_week.py`) — separate from the betting model
The opponent-adjusted GBM (`cfb_forecast.py`) is COLD in weeks 1–3 (no games → null adjusted
ratings), yet the product promise is "every game gets a number." `research/cfb-model/cfb_early_week.py`
fills that window: it blends **preseason priors** (prior-year SP+ overall/off/def + FPI + 3yr recruiting)
into a per-game predicted margin+total via Ridge. **DISPLAY ONLY** — priors are deliberately EXCLUDED
from the betting model (they improve raw prediction but kill the LEAN edge, per [[cfb-model-rebuild]] /
`FOOTBALL_PROFILES.md`), so `cfb_forecast.py` still owns all betting edges from ~week 4 on. Implements the
README TODO "Early-week prior (weeks 1-3)". Walk-forward MAE ~13.5 margin / ~12.9 total.

**Reproducibility (do at season, ~August — NOT now):** the script reads two gitignored artifacts that the
CURRENTLY-COMMITTED generators do NOT rebuild for an unplayed 2026 slate. Both edits were intentionally left
out of the committed generators because running them now yields provisional numbers off partial inputs
(CFBD publishes 2026 SP+/talent/ELO/rankings only in August) that August overwrites anyway. When real 2026
data lands, apply these two surgical changes, regenerate, and the script runs:
1. **`build_priors.py`** — add `2026` to `YEARS` (line ~11) and extend the recruiting/SP+/FPI pull ranges
   through 2026 so a 2026 prior row is emitted. Needs 2026 recruiting + prior-year (2025) SP+/FPI.
2. **`build_features.py`** — the completed-games filter (`homePoints/awayPoints .notna()`, line ~60) drops
   unplayed games; add an upcoming-week branch that keeps `homePoints.isna()` rows for the target week so the
   2026 Week-1 slate reaches `model_games.parquet` (the in-season model correctly wants completed games only —
   this branch is display-path-specific).
The provisional 2026 artifacts built this session (priors `season==2026` n≈221, `model_games` 2026 wk1 ≈51
games) exist on the research box's local disk only (gitignored) — treat them as throwaway; August regenerates.

## ⚙️ Cross-cutting
- **Env/numpy:** the frozen `.pkl` locks model output; a numpy mismatch triggers the (now-safe) retrain, which can
  differ slightly. To keep output byte-locked, run the cron on the **numpy the `.pkl` was frozen with**, or
  re-freeze once in the cron env (`cfb_forecast.py --season 2026 --week 1 --train`). (Memory warns numpy is
  unpinned because pinning caused OU divergence — decide per that tradeoff.)
- **Grading** (built): `signal_performance` + `fill_finals.py` + `refresh_all_signal_performance` +
  `nfl-cfb-grade-daily` cron grade the dryrun picks. Op-harden: ensure `psql`/`DATABASE_URL` on the runner.
- **Agent-pick grading** still walls out CFB (`grade-avatar-picks`, PR #15) — needed if CFB agents grade in 2026.
- **S-CFB2 returning-production** + `/player/returning`,`/roster` fetches + Week-1 starter proxy: **August** (rosters
  not loaded until then). See [[football-profile-archetype-research]].
- **`cfb_analysis` "this week's matches"** RPC reads `cfb_dryrun_games` (kickoff>now) → even Path A needs
  `gen_cfb_dryrun_games` running for 2026 for that page's upcoming feature.

## GitHub Actions template (Path B, option A) — drop into `.github/workflows/`, add secrets, enable
```yaml
name: cfb-weekly
on:
  schedule: [{ cron: "0 14 * 8,9,10,11,12 2,3,4,5,6" }]   # Tue–Sat 10a ET, Aug–Dec
  workflow_dispatch: { inputs: { season: {}, week: {} } }
jobs:
  run:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: research/cfb-model } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r requirements.txt   # ensure this exists / pin numpy to the .pkl's version
      - run: |
          printf 'CFBD_API_KEY=%s\nODDS_API_KEY=%s\nSUPABASE_SERVICE_KEY=%s\nDATABASE_URL=%s\n' \
            "${{ secrets.CFBD_API_KEY }}" "${{ secrets.ODDS_API_KEY }}" \
            "${{ secrets.SUPABASE_SERVICE_KEY }}" "${{ secrets.DATABASE_URL }}" > ../../.env.local
      - run: ./run_cfb_week.sh ${{ inputs.season }} ${{ inputs.week }}   # blank args → auto-resolves current week
```
(Confirm `research/cfb-model` has a `requirements.txt`; if not, list: pandas, numpy, scikit-learn, requests,
pyarrow, joblib. Pin numpy to match the frozen `.pkl` to avoid the retrain path.)
