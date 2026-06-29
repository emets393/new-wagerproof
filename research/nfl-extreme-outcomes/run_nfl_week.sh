#!/usr/bin/env bash
# =============================================================================
# Weekly NFL production runner — the day-one orchestration the season runs on.
#
# Pulls live data, rebuilds the feature frame, scores the locked models, and writes
# the nfl_dryrun_* tables the app reads. Idempotent: the generators delete-then-insert
# per (season, week), so re-running a week is safe.
#
# Build order (each step's output feeds the next):
#   fetch (Supabase) + scheme (nflverse) -> master -> odds_consensus -> matchup
#   -> engineered frames -> totals + sides models -> dryrun slate + props.
#
# Usage:  ./run_nfl_week.sh 2026 1          (season week)
#     or  NFL_SEASON=2026 NFL_WEEK=1 ./run_nfl_week.sh
#
# OPEN ITEM (do NOT silently skip): the 1H model anchors to live 1H + team-total CLOSE lines.
#   Those markets are NOT yet captured by the live odds collector (only a one-time historical
#   backfill exists), so 1H predictions stay blank for upcoming games until the collector adds
#   1H/TT snapshots. See LOCKED_MODELS.md §8 ("must be added before Week 1 2026").
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

SEASON="${1:-${NFL_SEASON:-2026}}"
WEEK="${2:-${NFL_WEEK:-1}}"
export NFL_SEASON="$SEASON" NFL_WEEK="$WEEK"
echo "=== NFL weekly run :: season=$SEASON week=$WEEK ==="
step() { echo; echo ">>> $*"; }

# --- 1) DATA LAYER -------------------------------------------------------------
step "fetch Supabase tables (pregame, team_week, odds_hist, lines, mapping, training_epa)"
python3 fetch.py --force
step "pull play-by-play scheme priors (nflverse)"
python3 b46_pull_scheme.py "$SEASON" || true

# --- 2) FEATURE BUILD (order matters: each reads the prior output) --------------
step "master game frame";              python3 build.py
step "odds consensus + splits";        python3 build_odds.py
step "matchup feature matrix";         python3 build_matchup.py
step "engineered schedule/trend (tg)"; python3 b3_engineer.py
step "matchup archive (spot rules)";   python3 archetypes.py
step "offense-matchup frame";          python3 b23_matchup_build.py

# --- 3) MODELS (frozen-.pkl load+predict once task #13 lands) -------------------
step "totals model -> predictions csv"; python3 consensus_totals.py --season "$SEASON" --week "$WEEK"
step "sides model + spot ledger";       python3 forecast_harness.py --season "$SEASON" --week "$WEEK"

# --- 3b) 1H SUB-PIPELINE (market-anchored residual GBM; LOCKED_MODELS.md §8) ----
# quarter_scores -> h1tt frame (+ p1-p5 stages) -> h1tt context (+ p7-p8) -> h1m model.
# Produces data/h1m_preds.parquet, read by the slate generator for the 1H cards.
step "1H: quarter scores + frame";   python3 quarter_scores.py; python3 h1tt_frame.py
step "1H: frame stages p1-p5";       python3 h1tt_p1_baseline.py; python3 h1tt_p2_movement.py; python3 h1tt_p3_books.py; python3 h1tt_p4_teamtotals.py; python3 h1tt_p5_confluence.py
step "1H: context p6-p8";            python3 h1tt_p6_context.py; python3 h1tt_p7_situational.py; python3 h1tt_p8_coach.py
step "1H: model -> h1m_preds";       python3 h1m_models.py; python3 h1m_models2.py

# --- 4) WRITE THE APP DATA CONTRACT (idempotent per week) ----------------------
# (filenames say "wk12" for historical reasons but are season/week-parameterized via env)
step "dryrun slate: games + flags";  python3 dryrun_wk12_games.py
step "assign referees to slate";     python3 backfill_dryrun_referees.py
step "dryrun slate: player props";   python3 dryrun_wk12_props.py
step "team trends (Outliers tab)";    python3 dryrun_wk12_trends.py
step "coach trends (Outliers tab)";   python3 gen_nfl_coach_trends.py
step "referee trends (Outliers tab)"; python3 gen_nfl_referee_trends.py
step "player-prop trends (Outliers)"; python3 gen_nfl_player_prop_trends.py
step "outliers trend cards (weekly)"; python3 gen_nfl_outliers_trend_cards.py
step "outliers trend lines (live books)"; python3 refresh_nfl_outliers_trend_lines.py

echo
echo "=== DONE :: dryrun_* + nfl_{team,coach,referee,player_prop}_trends + outliers cards for $SEASON wk$WEEK ==="
