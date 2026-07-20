#!/bin/bash
# Full NBA/NCAAB odds backfill, value-first order. Every phase is resumable
# (cached responses are skipped), so rerunning this script after any failure
# only fetches what's missing. Expected total spend ~2.2M credits.
cd "$(dirname "$0")"
set -o pipefail

run() {
  echo "=== $(date '+%F %T') START: $*"
  python3 "$@" || echo "!!! FAILED (continuing): $*"
  echo "=== $(date '+%F %T') END: $*"
}

# Phase 1: movement grid, most recent season first
run grid_backfill.py --sport nba   --season 2025-26
run grid_backfill.py --sport ncaab --season 2025-26

# Phase 2: NBA props T-60 close (3 seasons)
run event_backfill.py --sport nba --set props

# Phase 3: 1H + team totals T-60 close (3 seasons each)
run event_backfill.py --sport nba   --set h1tt
run event_backfill.py --sport ncaab --set h1tt

# Phase 4: movement grid, older seasons
for season in 2024-25 2023-24 2022-23; do
  run grid_backfill.py --sport nba   --season "$season"
  run grid_backfill.py --sport ncaab --season "$season"
done

echo "=== $(date '+%F %T') ALL PHASES COMPLETE"
