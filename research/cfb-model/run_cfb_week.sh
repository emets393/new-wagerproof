#!/usr/bin/env bash
# =============================================================================
# Weekly CFB production runner — the day-one orchestration the season runs on.
#
# Pulls live CFBD + odds, rebuilds the opponent-adjusted feature frame, then runs
# the locked model + writes the `cfb_dryrun_*` tables the app reads. Idempotent:
# the generators delete-then-insert per (season, week), so re-running a week is safe.
#
# Build order is authoritative per LOCKED_MODELS.md §5:
#   model_games.parquet  <-  build_features  <-  build_ratings + data/cfbd/*
#   market spots (STACK/SB/KEY)  <-  odds archive (fetch_odds_history)
#   TT / 1H spots                <-  event-odds (fetch_event_odds)
#
# Requires data/../../.env.local with CFBD + Odds API keys + SUPABASE_SERVICE_KEY.
#
# Usage:  ./run_cfb_week.sh 2026 6        (season week)
#     or  CFB_SEASON=2026 CFB_WEEK=6 ./run_cfb_week.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

# Season/week: explicit args win, then CFB_SEASON/CFB_WEEK env, else auto-resolve the CURRENT week from the
# CFBD /calendar (so the weekly cron runs unattended — no static-week edits each week).
if [ -n "${1:-}" ]; then
  SEASON="$1"; WEEK="${2:?usage: run_cfb_week.sh <season> <week>}"
elif [ -n "${CFB_SEASON:-}" ]; then
  SEASON="$CFB_SEASON"; WEEK="${CFB_WEEK:?set CFB_WEEK alongside CFB_SEASON}"
else
  read -r SEASON WEEK < <(python3 resolve_cfb_week.py)
fi
export CFB_SEASON="$SEASON" CFB_WEEK="$WEEK"
echo "=== CFB weekly run :: season=$SEASON week=$WEEK ==="
step() { echo; echo ">>> $*"; }

# --- 1) LIVE DATA PULLS --------------------------------------------------------
# CFBD core (games/lines/advanced) + extras (elo/talent/rankings/teams). The
# extras are best-effort: if a feed is empty early in the week the model degrades
# gracefully (build_features existence-checks the optional frames).
step "fetch CFBD core ($SEASON)";                 python3 fetch_cfbd.py "$SEASON"
step "fetch CFBD extras (elo/talent/rankings)";   python3 fetch_cfbd_extra.py "$SEASON"  || true
step "fetch CFBD extras2";                         python3 fetch_cfbd_extra2.py "$SEASON" || true
step "fetch CFBD teams";                           python3 fetch_cfbd_teams.py            || true
# returning production + transfer portal (feed the wk1-3 early-roster signals; returning loads ~August)
step "fetch CFBD returning-production + portal";    python3 fetch_cfbd_roster.py "$SEASON"  || true
# player-level roster layer (rosters/recruits/player-PPA -> roster_scores) — feeds the early-week
# blend's ROSTER_FEATS; no-ops gracefully until CFBD posts current-season rosters (~Aug)
step "player roster layer + reconstruction";        (python3 fetch_roster_layer.py && python3 -W ignore build_roster_scores.py) || true
# TRUE preseason SP+/FPI for the current season (cfbtxt) — replaces stale prior-year finals
step "current-season preseason power ratings";      python3 fetch_preseason_ratings.py "$SEASON" || true
step "materialize 1H/TT odds (ncaaf_event_odds DB -> parquet; live_odds_cfb_1h writes the DB hourly)"
python3 fetch_event_odds_live.py "$SEASON"
step "fetch per-book odds history (STACK/SB/KEY)"; python3 fetch_odds_history.py --year "$SEASON" --go
# Refresh weather from the live cfb_weather_data table (Render cfb-weather cron writes it).
# Drop just the weather cache so fetch_supabase re-pulls it fresh without re-pulling everything.
step "refresh weather + ref cache";  rm -f data/cfb_weather_data.parquet; python3 fetch_supabase.py

# --- 2) BUILD THE FEATURE FRAME (LOCKED_MODELS.md §5) ---------------------------
step "build opponent-adjusted ratings (as-of, leak-safe)"; python3 build_ratings.py
step "build box-score tendencies (as-of)";                 python3 build_tendencies.py || true
step "build per-game model frame -> model_games.parquet";  python3 build_features.py
# team style profiles + opp DEF archetype + off_ppa (feeds the S-CFB1 style-delta UNDER flag)
step "build team style profiles (archetypes, leak-safe)";  python3 build_football_profiles.py || true
# Weeks 1-3: the early display blend (preseason priors + roster + CORE) -> out/cfb_early_preds CSV.
# gen_cfb_dryrun_games/picks REQUIRE this CSV early. Best-effort: on an ephemeral disk without
# training history the committed CSV (frozen weekly from the last local run) stays in place.
if [ "$WEEK" -le 3 ]; then
  step "early-week display model (wk1-3, best-effort)"; python3 cfb_early_week.py || true
fi
# run the LOCKED model AS A SCRIPT so it WRITES out/cfb_{predictions,bets,team_totals,h1_model}_$SEASON.csv —
# the slate generators (gen_cfb_dryrun_games/picks/flags) read these; harness_week() alone does NOT write them.
step "run locked CFB model -> prediction/spot/TT/1H CSVs (frozen ${SEASON} .pkl)"
python3 cfb_forecast.py --season "$SEASON" --week "$WEEK"

# --- 3) WRITE THE APP DATA CONTRACT --------------------------------------------
# Reference loads (static/idempotent — cheap, keeps the slate's FK refs present).
step "reference: signal defs / teams / sportsbooks"
python3 gen_cfb_signal_defs.py
python3 gen_cfb_teams.py
python3 gen_cfb_sportsbooks.py
# Weekly slate (order matters: games first; picks writes conviction onto games;
# flags back-fills n_flags counts onto games; trends are independent).
step "slate: dryrun games";  python3 gen_cfb_dryrun_games.py
step "slate: pick cards";    python3 gen_cfb_picks.py
step "slate: bet flags";     python3 gen_cfb_dryrun_flags.py
step "slate: team trends";   python3 gen_cfb_team_trends.py
# Outliers trends (team splits/matchups + coach career trends). Both no-op safely if the
# Outliers DDL (cfb_outliers_trends.sql) hasn't been applied to the data project yet.
step "outliers: coach trends"; python3 gen_cfb_coach_trends.py
step "outliers: trend cards";  python3 gen_cfb_outliers_trend_cards.py

echo
echo "=== DONE :: cfb_dryrun_games/_picks/_flags + cfb_team_trends/_coach_trends/_outliers_trend_cards loaded for $SEASON wk$WEEK ==="
