"""
Materialize the Odds-API CFB FG line warehouse (Supabase `ncaaf_odds_history`, written by the
odds-capture cron) -> data/odds_history/odds_<season>.parquet, the schema build_odds_frame.py reads.

WHY: The Odds API is the SINGLE source for every displayed/graded betting line (owner rule). For
in-season/upcoming weeks the live odds capture writes `ncaaf_odds_history`; this renders it to the
parquet the CFB build already consumes, so build_odds_frame -> odds_game_frame is unchanged. Mirrors
the fetch_event_odds_live.py pattern (DB is source of truth, materialize to parquet for the build).
For past seasons, fetch_odds_history.py (Odds API historical endpoint) writes the same file directly.

Usage:  python3 materialize_odds_history.py 2026
"""
import os
import sys
import requests
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
OUTD = os.path.join(HERE, "data", "odds_history")
os.makedirs(OUTD, exist_ok=True)
SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else 2026

SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impw"
       "eG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0"
       ".BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo")
HDRS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
# columns build_odds_frame.py consumes (raw per-book snapshots; it does its own median consensus)
COLS = ["season", "game_id", "snapshot", "commence_time", "home_team", "away_team", "book",
        "home_ml", "away_ml", "spread_home", "spread_home_price", "spread_away_price",
        "total", "over_price", "under_price", "hrs_to_kick"]


def main():
    rows, page = [], 0
    while True:
        r = requests.get(f"{SUPA}/ncaaf_odds_history",
                         headers={**HDRS, "Range-Unit": "items",
                                  "Range": f"{page*1000}-{page*1000+999}"},
                         params={"season": f"eq.{SEASON}", "select": ",".join(COLS)}, timeout=60)
        r.raise_for_status()
        batch = r.json()
        rows += batch
        if len(batch) < 1000:
            break
        page += 1
    df = pd.DataFrame(rows)
    if df.empty:
        sys.exit(f"ncaaf_odds_history has no {SEASON} rows")
    out = os.path.join(OUTD, f"odds_{SEASON}.parquet")
    df.to_parquet(out, index=False)
    print(f"[materialize] {len(df)} rows, {df.game_id.nunique()} games, {df.book.nunique()} books, "
          f"snap {df.snapshot.min()[:10]} -> {out}")


if __name__ == "__main__":
    main()
