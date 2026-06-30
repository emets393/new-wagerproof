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

SEASON="${1:-${CFB_SEASON:-2026}}"
WEEK="${2:-${CFB_WEEK:-6}}"
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
