"""
Supabase data-pull layer for the CFB model rebuild.
Caches the existing CFB tables (project jpxnjuwglavsjbgbasnl) to parquet for fast iteration.
Mirrors the NFL research fetch pattern (paginated PostgREST + parquet cache).

Run: python3 fetch_supabase.py            (pulls + caches what's missing)
     python3 fetch_supabase.py --force    (re-pull everything)
"""
import os, sys, time
import requests
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
os.makedirs(DATA, exist_ok=True)

SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
# Anon key (read-only public). Same project the NFL research uses.
KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impw"
       "eG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0"
       ".BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo")
HDRS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

FORCE = "--force" in sys.argv

# table -> (order column for stable pagination, or None)
TABLES = {
    "cfb_api_training_data": "id",     # 4520 rows, 2016-2024 core training set
    "cfb_games": "api_id",             # results + lines (2025 present)
    "ncaaf_betting_lines": None,       # 2025 wk2-6, public handle/bets splits
    "cfb_weather_data": None,
    "cfb_stadium_info": None,
    "cfb_sec_per_play": None,          # pace
    "vsin_cfb_power_ratings": None,
    "cfb_inputs_archive": None,        # likely the purchased 2025 weekly inputs
    "cfb_team_mapping": None,          # name crosswalk for joins
}


def fetch_table(table, order=None, page=1000):
    rows, offset = [], 0
    while True:
        params = {"select": "*", "limit": page, "offset": offset}
        if order:
            params["order"] = order
        for attempt in range(4):
            try:
                r = requests.get(f"{SUPA}/{table}", headers=HDRS, params=params, timeout=120)
                r.raise_for_status()
                break
            except Exception as e:
                if attempt == 3:
                    raise
                time.sleep(1.5 * (attempt + 1))
        batch = r.json()
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return pd.DataFrame(rows)


def main():
    for table, order in TABLES.items():
        out = os.path.join(DATA, f"{table}.parquet")
        if os.path.exists(out) and not FORCE:
            n = len(pd.read_parquet(out))
            print(f"  skip {table:28s} cached ({n} rows)")
            continue
        try:
            df = fetch_table(table, order=order)
            df.to_parquet(out, index=False)
            print(f"  ok   {table:28s} {len(df):6d} rows -> {os.path.basename(out)}")
        except Exception as e:
            print(f"  FAIL {table:28s} {e}")


if __name__ == "__main__":
    main()
