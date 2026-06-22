"""
Materialize ncaaf_event_odds (DB) -> data/event_odds/events_<season>.parquet for build_odds_frame.

The NFL pattern: the DB table is the persistent source of truth (written hourly by
live_odds_cfb_1h.py), and this renders it to the parquet the CFB build already reads — so the
build is unchanged. Run in run_cfb_week.sh BEFORE build_odds_frame, in place of the historical
fetch_event_odds.py (which stays as the past-seasons backfill tool).

Run:  python3 fetch_event_odds_live.py [SEASON]
"""
import os
import sys
import datetime as dt
from pathlib import Path
import requests
import pandas as pd

HERE = Path(__file__).resolve().parent
OUTD = HERE / "data" / "event_odds"
OUTD.mkdir(parents=True, exist_ok=True)
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
_today = dt.date.today()
SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else (_today.year if _today.month >= 3 else _today.year - 1)


def key():
    if os.environ.get("SUPABASE_SERVICE_KEY"):
        return os.environ["SUPABASE_SERVICE_KEY"]
    for line in (HERE.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("SUPABASE_SERVICE_KEY not found")


def main():
    hdr = {"apikey": key(), "Authorization": f"Bearer {key()}"}
    rows, offset = [], 0
    while True:
        r = requests.get(f"{SUPA}/ncaaf_event_odds",
                         params={"select": "*", "season": f"eq.{SEASON}", "limit": 1000, "offset": offset},
                         headers=hdr, timeout=60)
        r.raise_for_status()
        batch = r.json()
        rows += batch
        if len(batch) < 1000:
            break
        offset += 1000

    df = pd.DataFrame(rows)
    if len(df):
        # match fetch_event_odds.py's parquet shape so build_odds_frame reads it unchanged
        df = df.rename(columns={"snap_ts": "snap"})
        df["snap_tag"] = "live"
        df = df[["season", "game_id", "home", "away", "snap_tag", "snap",
                 "book", "market", "name", "description", "price", "point"]]
    fp = OUTD / f"events_{SEASON}.parquet"
    df.to_parquet(fp, index=False)
    print(f"[fetch_event_odds_live] {len(df)} rows ({SEASON}) -> {fp}")


if __name__ == "__main__":
    main()
