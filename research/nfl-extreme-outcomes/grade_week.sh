#!/usr/bin/env bash
# =============================================================================
# Post-game GRADING runner (tasks #10 / #11 / #12 / #14) — run AFTER games complete (daily).
#
# SEASON-SCOPED + idempotent: grades whatever is now gradeable, so it doesn't matter which
# day it runs or where the week boundary falls. The slate runner writes picks/flags/props
# PRE-game; this fills finals + player stats and grades them POST-game. Sequence:
#   1) finals       -> {nfl,cfb}_dryrun_games.final_home/away   (fill_finals.py)
#   2) player logs  -> nfl_player_game_logs (nflverse, all weeks)  (ingest_player_logs.py)
#   3) grade props  -> nfl_player_props.actual_value/result, all weeks (grade_nfl_props)
#   4) grade picks + roll up signals (refresh_all_signal_performance: game AND prop signals)
#      + append completed games -> {nfl,cfb}_analysis_base (historical-trends warehouse, Stage 1)
#   5) asof Stage 2: recompute season-to-date/streak/h2h trend features (refresh_analysis_asof.sh)
#
# Steps 3-4 run the grading RPCs, which scan large prop tables and exceed PostgREST's 8s
# statement timeout — so they go over a DIRECT connection (psycopg2 over DATABASE_URL =
# Supabase pooler URI, provided by Render's grade job). run_grade_rpcs.py uses psycopg2
# (a pip dep) — NO psql binary needed. Without DATABASE_URL it skips with a note.
#
# NOT here: agent picks (grade-avatar-picks edge fn, deploy = task #12); 1H finals h1_*
# (PBP / CFBD line scores, tracking-tier = task #4).
#
# Usage:  ./grade_week.sh 2026        (season)   or   NFL_SEASON=2026 ./grade_week.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

SEASON="${1:-${NFL_SEASON:-2026}}"
echo "=== grade run :: season=$SEASON ==="

echo; echo ">>> 1) finals (NFL nflverse + CFB cfb_games)"
python3 fill_finals.py --write

echo; echo ">>> 2) NFL player game logs (nflverse), whole season (idempotent upsert)"
python3 ingest_player_logs.py "$SEASON" --write

echo; echo ">>> 3-4) grade NFL props + grade picks + refresh signal_performance"
# psycopg2 over DATABASE_URL (no psql binary). Idempotent; skips with a note if DATABASE_URL unset.
# This ALSO appends completed games into {nfl,cfb}_analysis_base (Stage 1 of the historical-
# trends warehouse refresh) via the refresh_{nfl,cfb}_analysis_base RPCs.
python3 run_grade_rpcs.py "$SEASON"

echo; echo ">>> 5) historical-trends warehouse: asof derived features (Stage 2, non-fatal)"
# Recomputes the season-to-date/streak/h2h feature family for the newly-appended games.
# Skips cleanly if SUPABASE_PAT is unset; never fails the grade run.
bash refresh_analysis_asof.sh "$SEASON"

echo; echo "=== grade run done :: season=$SEASON ==="
