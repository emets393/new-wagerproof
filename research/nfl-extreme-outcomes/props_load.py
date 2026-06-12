"""Bulk-load parsed prop rows + game logs into Supabase via PostgREST.

Reads SUPABASE_SERVICE_KEY from repo-root .env.local. Batches of 5,000 rows
with on-conflict ignore semantics handled by pre-wiping (props) / merge-dupes
(logs). Resumable: tracks loaded batch offsets in data/props_load_state.json.

Usage:
  python3 props_load.py --logs     # load nfl_player_game_logs (11K rows)
  python3 props_load.py --props    # load nfl_player_props (~1M rows)
"""
import argparse, json, math, sys, time
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
STATE = ROOT / "data" / "props_load_state.json"
BATCH = 5000


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def headers(key):
    return {"apikey": key, "Authorization": f"Bearer {key}",
            "Content-Type": "application/json", "Prefer": "return=minimal"}


def post_batches(df, table, key, state_key):
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    start = state.get(state_key, 0)
    n_batches = math.ceil(len(df) / BATCH)
    # to_json handles numpy types + NaN->null; json.dumps on to_dict() does not
    recs = json.loads(df.to_json(orient="records"))
    for b in range(start, n_batches):
        chunk = recs[b * BATCH:(b + 1) * BATCH]
        for attempt in range(4):
            r = requests.post(f"{URL}/{table}", headers=headers(key),
                              data=json.dumps(chunk), timeout=120)
            if r.status_code in (200, 201):
                break
            if r.status_code >= 500 or r.status_code == 429:
                time.sleep(5 * (attempt + 1))
                continue
            sys.exit(f"batch {b} failed {r.status_code}: {r.text[:500]}")
        else:
            sys.exit(f"batch {b}: retries exhausted")
        state[state_key] = b + 1
        STATE.write_text(json.dumps(state))
        if (b + 1) % 10 == 0 or b + 1 == n_batches:
            print(f"{table}: {b + 1}/{n_batches} batches", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--logs", action="store_true")
    ap.add_argument("--props", action="store_true")
    args = ap.parse_args()
    key = load_key()

    if args.logs:
        df = pd.read_csv(ROOT / "data" / "game_logs_2024_2025.csv")
        # 311 CIN/BUF 2025 test rows already exist -> drop overlap client-side
        existing = requests.get(
            f"{URL}/nfl_player_game_logs?select=player_id,season,week&limit=20000",
            headers=headers(key), timeout=60).json()
        seen = {(e["player_id"], e["season"], e["week"]) for e in existing}
        before = len(df)
        df = df[~df.apply(lambda r: (r.player_id, r.season, r.week) in seen, axis=1)]
        print(f"logs: {before} -> {len(df)} after removing {before - len(df)} already-loaded")
        post_batches(df, "nfl_player_game_logs", key, "logs")

    if args.props:
        df = pd.read_parquet(ROOT / "data" / "props_rows.parquet")
        for c in ("season", "week", "over_odds", "under_odds"):
            df[c] = df[c].astype("Int64")
        print(f"props: {len(df):,} rows, {math.ceil(len(df) / BATCH)} batches")
        post_batches(df, "nfl_player_props", key, "props")


if __name__ == "__main__":
    main()
