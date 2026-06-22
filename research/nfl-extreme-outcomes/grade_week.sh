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
#
# Steps 3-4 run the grading RPCs, which scan large prop tables and exceed PostgREST's 8s
# statement timeout — so they go over a DIRECT connection. Set DATABASE_URL = Supabase
# pooler URI (Render's grade job provides it). Without it, steps 3-4 are skipped with a note.
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

SQL() {  # run a statement over a direct DB connection; skip (with a note) if unavailable
  if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$1"
  else
    echo "  [skip] no DATABASE_URL/psql -> '$1'"
    echo "         (set DATABASE_URL = Supabase pooler URI in production; PostgREST's 8s"
    echo "          timeout is too short for the prop-table scan)"
  fi
}

echo; echo ">>> 1) finals (NFL nflverse + CFB cfb_games)"
python3 fill_finals.py --write

echo; echo ">>> 2) NFL player game logs (nflverse), whole season (idempotent upsert)"
python3 ingest_player_logs.py "$SEASON" --write

echo; echo ">>> 3) grade NFL props, all weeks (idempotent; only grades result IS NULL)"
SQL "select gs.w as week, grade_nfl_props($SEASON, gs.w) as graded from generate_series(1,22) gs(w);"

echo; echo ">>> 4) grade picks + refresh signal_performance (NFL+CFB game + prop signals)"
SQL "select * from refresh_all_signal_performance($SEASON);"

echo; echo "=== grade run done :: season=$SEASON ==="
