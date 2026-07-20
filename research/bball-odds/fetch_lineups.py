#!/usr/bin/env python3
"""CBBD per-game lineup stints (free). /lineups/game/{gameId} -> cached gz per
game -> data/parquet/lineups_ncaab.parquet (lineup-stint rows: 5 athlete ids,
seconds, pace, ratings). The raw material for player-impact (BPR-style) work.
"""
import glob
import gzip
import json
import os
import sys
import time

import pandas as pd
import requests

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(ROOT, "data", "lineups_raw")
OUT = os.path.join(ROOT, "data", "parquet")


def env(key):
    for line in open(os.path.join(ROOT, "..", "..", ".env.local")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"{key} missing")


def fetch_one(gid, hdrs):
    for attempt in range(3):
        try:
            r = requests.get(f"https://api.collegebasketballdata.com/lineups/game/{gid}",
                             headers=hdrs, timeout=60)
            if r.status_code == 200:
                with gzip.open(f"{RAW}/{gid}.json.gz", "wt") as f:
                    f.write(r.text)
                return True
            if r.status_code in (400, 404):
                with gzip.open(f"{RAW}/{gid}.json.gz", "wt") as f:
                    f.write("[]")
                return True
            if r.status_code == 429:
                time.sleep(20)
        except requests.RequestException:
            pass
        time.sleep(3 * (attempt + 1))
    return False


def fetch():
    # endpoint is ~2-4s/call — parallelize with a modest pool
    from concurrent.futures import ThreadPoolExecutor
    hdrs = {"Authorization": f"Bearer {env('CFBD_API_KEY')}"}
    tb = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet", columns=["gameId"])
    game_ids = sorted(tb["gameId"].unique())
    os.makedirs(RAW, exist_ok=True)
    done = {int(os.path.basename(p).split(".")[0]) for p in glob.glob(f"{RAW}/*.json.gz")}
    todo = [g for g in game_ids if g not in done]
    print(f"{len(todo):,} games to fetch ({len(done):,} cached)", flush=True)
    n_ok = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        for i, ok in enumerate(ex.map(lambda g: fetch_one(g, hdrs), todo)):
            n_ok += ok
            if i % 1000 == 0:
                print(f"  {i:,}/{len(todo):,} (ok {n_ok:,})", flush=True)


def slim():
    rows = []
    files = glob.glob(f"{RAW}/*.json.gz")
    for i, path in enumerate(sorted(files)):
        gid = int(os.path.basename(path).split(".")[0])
        with gzip.open(path, "rt") as f:
            for lu in json.load(f):
                a = [x["id"] for x in (lu.get("athletes") or [])]
                if len(a) != 5:
                    continue
                rows.append({
                    "game_id": gid, "team_id": lu["teamId"],
                    "p1": a[0], "p2": a[1], "p3": a[2], "p4": a[3], "p5": a[4],
                    "secs": lu.get("totalSeconds"), "pace": lu.get("pace"),
                    "off_rtg": lu.get("offenseRating"), "def_rtg": lu.get("defenseRating"),
                    "net_rtg": lu.get("netRating")})
        if i % 2000 == 0:
            print(f"  slim {i:,}/{len(files):,}", flush=True)
    df = pd.DataFrame(rows)
    df.to_parquet(f"{OUT}/lineups_ncaab.parquet", index=False)
    print(f"lineups_ncaab: {len(df):,} stints, {df['game_id'].nunique():,} games", flush=True)


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("fetch", "all"):
        fetch()
    if what in ("slim", "all"):
        slim()
    print("LINEUPS COMPLETE", flush=True)
