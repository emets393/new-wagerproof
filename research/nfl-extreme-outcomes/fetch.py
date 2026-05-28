"""
Data-pull layer for the NFL extreme-outcomes research.
Pulls from Supabase REST (paginated) + nflverse, caches everything to parquet.
Run: python3 fetch.py            (pulls + caches what's missing)
     python3 fetch.py --force    (re-pull everything)
"""
import os, sys, time, json, io
import requests
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
os.makedirs(DATA, exist_ok=True)

SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impw"
       "eG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0"
       ".BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo")
HDRS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def supa_count(table):
    r = requests.get(f"{SUPA}/{table}", headers={**HDRS, "Prefer": "count=exact", "Range-Unit": "items",
                                                  "Range": "0-0"}, params={"select": "*"}, timeout=60)
    cr = r.headers.get("content-range", "")
    return cr


def fetch_table(table, select="*", page=1000, order=None, extra=None, max_rows=None):
    """Paginate a Supabase table/view into a DataFrame."""
    rows, offset = [], 0
    while True:
        params = {"select": select, "limit": page, "offset": offset}
        if order:
            params["order"] = order
        if extra:
            params.update(extra)
        for attempt in range(4):
            try:
                r = requests.get(f"{SUPA}/{table}", headers=HDRS, params=params, timeout=120)
                if r.status_code != 200:
                    print(f"  ! {table} HTTP {r.status_code}: {r.text[:200]}")
                    time.sleep(2 * (attempt + 1)); continue
                break
            except Exception as e:
                print(f"  ! {table} err {e}; retry"); time.sleep(2 * (attempt + 1))
        batch = r.json()
        if not batch:
            break
        rows.extend(batch)
        offset += page
        if len(batch) < page:
            break
        if max_rows and len(rows) >= max_rows:
            break
        if offset % 20000 == 0:
            print(f"    {table}: {len(rows)} rows...")
    return pd.DataFrame(rows)


def cache(name, loader, force=False):
    path = os.path.join(DATA, f"{name}.parquet")
    if os.path.exists(path) and not force:
        df = pd.read_parquet(path)
        print(f"[cache] {name}: {df.shape} (loaded)")
        return df
    print(f"[pull ] {name} ...")
    df = loader()
    df.to_parquet(path, index=False)
    print(f"[saved] {name}: {df.shape} -> {path}")
    return df


def nflverse_games():
    url = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"
    r = requests.get(url, timeout=120)
    return pd.read_csv(io.StringIO(r.text))


def main():
    force = "--force" in sys.argv

    # Row-count sanity for the big tables
    for t in ["v_nfl_pregame_features_full", "nfl_training_data_epa", "nfl_historical_odds",
              "nfl_betting_lines", "nfl_team_mapping"]:
        print(f"count {t}: {supa_count(t)}")

    cache("pregame", lambda: fetch_table("v_nfl_pregame_features_full",
          order="season,week"), force=force)
    cache("training_epa", lambda: fetch_table("nfl_training_data_epa"), force=force)
    cache("team_mapping", lambda: fetch_table("nfl_team_mapping"), force=force)
    cache("odds_hist", lambda: fetch_table("nfl_historical_odds",
          order="snap_ts"), force=force)
    cache("betting_lines_2025", lambda: fetch_table("nfl_betting_lines"), force=force)
    cache("nflverse_games", nflverse_games, force=force)


if __name__ == "__main__":
    main()
