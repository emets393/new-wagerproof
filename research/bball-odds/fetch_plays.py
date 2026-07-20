#!/usr/bin/env python3
"""CBBD possession-level plays backfill (free, CFBD_API_KEY).

/plays/date?date=YYYY-MM-DD returns ALL plays for the day (~40k rows, ~50MB,
no truncation). Raw gz cached per day (reruns free), then slimmed to
data/parquet/plays_ncaab_{season}.parquet with the modeling-relevant fields:
shot range/location/made/assisted, win probability (garbage-time filter),
period/clock, scores.

~600 day-calls across 2022-23 → 2025-26. Run in background (~2-3h).
"""
import glob
import gzip
import json
import os
import sys
import time
from datetime import date, timedelta

import pandas as pd
import requests

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(ROOT, "data", "plays_raw")
OUT = os.path.join(ROOT, "data", "parquet")

SEASONS = {"2022-23": 2023, "2023-24": 2024, "2024-25": 2025, "2025-26": 2026}

KEEP = ["gameId", "id", "season", "playType", "isHomeTeam", "teamId",
        "homeScore", "awayScore", "homeWinProbability", "period",
        "secondsRemaining", "scoringPlay", "shootingPlay", "scoreValue"]


def env(key):
    for line in open(os.path.join(ROOT, "..", "..", ".env.local")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"{key} missing")


def season_dates(yr):
    d, end = date(yr - 1, 11, 1), date(yr, 4, 10)
    while d <= end:
        yield d
        d += timedelta(days=1)


def fetch():
    hdrs = {"Authorization": f"Bearer {env('CFBD_API_KEY')}"}
    for season, yr in SEASONS.items():
        n = 0
        for d in season_dates(yr):
            ds = d.isoformat()
            path = f"{RAW}/{ds}.json.gz"
            if os.path.exists(path):
                continue
            for attempt in range(4):
                try:
                    r = requests.get("https://api.collegebasketballdata.com/plays/date",
                                     params={"date": ds}, headers=hdrs, timeout=180)
                    if r.status_code == 200:
                        os.makedirs(RAW, exist_ok=True)
                        with gzip.open(path, "wt") as f:
                            f.write(r.text)
                        n += 1
                        time.sleep(0.3)
                        break
                    if r.status_code in (400, 404):
                        with gzip.open(path, "wt") as f:
                            f.write("[]")
                        break
                except requests.RequestException:
                    pass
                time.sleep(5 * (attempt + 1))
            else:
                print(f"  gave up {ds}", flush=True)
        print(f"[{season}] fetched {n} new days", flush=True)


def slim():
    files = sorted(glob.glob(f"{RAW}/*.json.gz"))
    by_season = {}
    for i, path in enumerate(files):
        with gzip.open(path, "rt") as f:
            plays = json.load(f)
        if not plays:
            continue
        rows = []
        for p in plays:
            r = {k: p.get(k) for k in KEEP}
            si = p.get("shotInfo") or {}
            r["shot_made"] = si.get("made")
            r["shot_range"] = si.get("range")
            r["shot_assisted"] = si.get("assisted")
            loc = si.get("location") or {}
            r["shot_x"], r["shot_y"] = loc.get("x"), loc.get("y")
            rows.append(r)
        df = pd.DataFrame(rows)
        yr = int(df["season"].iloc[0])
        by_season.setdefault(yr, []).append(df)
        if i % 100 == 0:
            print(f"  slimmed {i}/{len(files)}", flush=True)
    for yr, frames in by_season.items():
        season = f"{yr-1}-{str(yr)[2:]}"
        out = pd.concat(frames, ignore_index=True)
        out.to_parquet(f"{OUT}/plays_ncaab_{season}.parquet", index=False)
        print(f"plays_ncaab_{season}: {len(out):,} plays, "
              f"{out['gameId'].nunique():,} games", flush=True)


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("fetch", "all"):
        fetch()
    if what in ("slim", "all"):
        slim()
    print("PLAYS COMPLETE", flush=True)
