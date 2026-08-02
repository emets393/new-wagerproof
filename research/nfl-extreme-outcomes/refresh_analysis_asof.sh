#!/usr/bin/env bash
# =============================================================================
# Stage 2 of the historical-trends warehouse refresh (NFL + CFB).
#
# Stage 1 (refresh_{nfl,cfb}_analysis_base RPCs, called from run_grade_rpcs.py) has already
# appended the completed games' per-game FACTS. This recomputes the season-to-date / streak /
# h2h / opponent / prev-year feature family LEAK-SAFELY (reads the base, writes derived cols
# back) so the Systems workbench + advanced trend filters see the new games too.
#
# Per sport: asof_features_*.py (reads base -> asof_*.parquet) then deploy_asof.py (merges the
# parquet back via the Management API). deploy_asof.py needs SUPABASE_PAT; asof_features needs
# SUPABASE_SERVICE_KEY (both from the Render env group / .env.local). NON-FATAL + skips cleanly
# if SUPABASE_PAT is absent, so a missing token never fails the grade run.
#
# Note: the asof scripts recompute the WHOLE base (all seasons) — idempotent + leak-tested.
# =============================================================================
set -uo pipefail   # deliberately NOT -e: Stage 2 is best-effort, never fails the grade run
HERE="$(cd "$(dirname "$0")" && pwd)"
RESEARCH="$(cd "$HERE/.." && pwd)"

if [ -z "${SUPABASE_PAT:-}" ]; then
  echo "  [skip] SUPABASE_PAT unset — asof Stage 2 (derived trend features) not run."
  echo "         Set SUPABASE_PAT (Management-API token) in the env group to enable."
  exit 0
fi

echo ">>> asof Stage 2: NFL"
( cd "$HERE"            && python3 asof/asof_features_nfl.py ) \
  && ( cd "$RESEARCH/systems_deploy" && python3 deploy_asof.py nfl ) \
  || echo "  [warn] NFL asof Stage 2 failed (non-fatal)"

echo ">>> asof Stage 2: CFB"
( cd "$RESEARCH/cfb-model" && python3 asof/asof_features_cfb.py ) \
  && ( cd "$RESEARCH/systems_deploy" && python3 deploy_asof.py cfb ) \
  || echo "  [warn] CFB asof Stage 2 failed (non-fatal)"
