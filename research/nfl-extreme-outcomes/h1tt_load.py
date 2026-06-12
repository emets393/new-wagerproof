"""Load parsed 1H/team-total rows into Supabase and merge into nfl_historical_odds.

Steps: wipe h1tt_stage -> PostgREST bulk insert data/h1tt_rows.parquet ->
call merge_h1tt_stage(season, month) per chunk (MCP/PostgREST time out on
full-table UPDATEs). Resumable via data/h1tt_load_state.json.

Usage:
  python3 h1tt_load.py --stage     # wipe + bulk-insert staging table
  python3 h1tt_load.py --merge     # run chunked merges into nfl_historical_odds
"""
import argparse, json, math, sys, time
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
STATE = ROOT / "data" / "h1tt_load_state.json"
BATCH = 5000

INT_COLS = ["h1_spread_home_price", "h1_spread_away_price", "h1_total_over_price",
            "h1_total_under_price", "h1_ml_home", "h1_ml_away",
            "tt_home_over_price", "tt_home_under_price",
            "tt_away_over_price", "tt_away_under_price"]


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def headers(key):
    return {"apikey": key, "Authorization": f"Bearer {key}",
            "Content-Type": "application/json", "Prefer": "return=minimal"}


def stage(key):
    df = pd.read_parquet(ROOT / "data" / "h1tt_rows.parquet")
    df["season"] = df.season.astype("Int64")
    for c in INT_COLS:
        df[c] = df[c].astype("Int64")
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    if state.get("stage", 0) == 0:
        r = requests.delete(f"{URL}/h1tt_stage?season=gte.0", headers=headers(key), timeout=120)
        if r.status_code not in (200, 204):
            sys.exit(f"stage wipe failed {r.status_code}: {r.text[:300]}")
        print("stage wiped")
    recs = json.loads(df.to_json(orient="records"))
    n_batches = math.ceil(len(recs) / BATCH)
    print(f"staging {len(recs):,} rows in {n_batches} batches")
    for b in range(state.get("stage", 0), n_batches):
        chunk = recs[b * BATCH:(b + 1) * BATCH]
        for attempt in range(4):
            r = requests.post(f"{URL}/h1tt_stage", headers=headers(key),
                              data=json.dumps(chunk), timeout=120)
            if r.status_code in (200, 201):
                break
            if r.status_code >= 500 or r.status_code == 429:
                time.sleep(5 * (attempt + 1))
                continue
            sys.exit(f"batch {b} failed {r.status_code}: {r.text[:500]}")
        else:
            sys.exit(f"batch {b}: retries exhausted")
        state["stage"] = b + 1
        STATE.write_text(json.dumps(state))
        if (b + 1) % 10 == 0 or b + 1 == n_batches:
            print(f"stage: {b + 1}/{n_batches} batches", flush=True)


def merge(key):
    df = pd.read_parquet(ROOT / "data" / "h1tt_rows.parquet")
    snap = pd.to_datetime(df.snap_ts, utc=True, format="ISO8601")
    chunks = sorted(set(zip(df.season.astype(int), snap.dt.month)))
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    done = set(map(tuple, state.get("merged", [])))
    total = 0
    for season, month in chunks:
        if (season, month) in done:
            continue
        r = requests.post(f"{URL}/rpc/merge_h1tt_stage", headers=headers(key),
                          data=json.dumps({"p_season": season, "p_month": month}),
                          timeout=600)
        if r.status_code != 200:
            sys.exit(f"merge {season}-{month:02d} failed {r.status_code}: {r.text[:300]}")
        n = r.json()
        total += n
        done.add((season, month))
        state["merged"] = sorted(done)
        STATE.write_text(json.dumps(state))
        print(f"merged {season} month {month:02d}: {n:,} rows updated", flush=True)
    print(f"TOTAL rows updated: {total:,}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", action="store_true")
    ap.add_argument("--merge", action="store_true")
    args = ap.parse_args()
    key = load_key()
    if args.stage:
        stage(key)
    if args.merge:
        merge(key)


if __name__ == "__main__":
    main()
