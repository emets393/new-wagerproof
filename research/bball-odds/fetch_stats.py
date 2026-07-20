#!/usr/bin/env python3
"""Fetch modeling stats: KenPom (NCAAB), CBBD boxscores (NCAAB), balldontlie (NBA).

Usage: fetch_stats.py {kenpom|cbbd|bdl|all}

Outputs to data/parquet/, raw responses cached under data/stats_raw/ (reruns free).

  KenPom  — archive?d= daily LEAK-SAFE dated ratings (AdjEM/OE/DE/Tempo asof date),
            fanmatch?d= KenPom's own game predictions (score preds + win prob),
            plus per-season four-factors/height/pointdist/misc-stats/teams/conf-ratings.
  CBBD    — games/teams weekly chunks (team boxscores), games/players daily
            (player boxscores, nested per team-game). Same key as CFB.
  BDL     — games, stats (player boxscores), stats/advanced — cursor-paginated,
            600 req/min tier.
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
RAW = os.path.join(ROOT, "data", "stats_raw")
OUT = os.path.join(ROOT, "data", "parquet")

SEASONS = {"2022-23": 2023, "2023-24": 2024, "2024-25": 2025, "2025-26": 2026}
# Nov 1 -> Apr 10 covers preseason tourneys through the natty
def season_dates(yr):
    d, end = date(yr - 1, 11, 1), date(yr, 4, 10)
    while d <= end:
        yield d
        d += timedelta(days=1)


def env(key):
    for line in open(os.path.join(ROOT, "..", "..", ".env.local")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"{key} not found in .env.local")


def cached_get(cache_path, url, params=None, headers=None, sleep=0.35):
    if os.path.exists(cache_path):
        with gzip.open(cache_path, "rt") as f:
            return json.load(f)
    for attempt in range(5):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=60)
            if r.status_code == 200:
                js = r.json()
                os.makedirs(os.path.dirname(cache_path), exist_ok=True)
                with gzip.open(cache_path, "wt") as f:
                    json.dump(js, f)
                time.sleep(sleep)
                return js
            if r.status_code in (404, 400):
                return None
            if r.status_code == 429:
                time.sleep(15 * (attempt + 1))
                continue
        except requests.RequestException:
            pass
        time.sleep(3 * (attempt + 1))
    print(f"  gave up: {url} {params}", flush=True)
    return None


def flat_write(rows, name):
    df = pd.json_normalize(rows)
    df.to_parquet(f"{OUT}/{name}.parquet", index=False)
    print(f"{name}: {len(df):,} rows", flush=True)


# ---------- KenPom ----------

def fetch_kenpom():
    hdrs = {"Authorization": f"Bearer {env('KENPOM_API_KEY')}"}
    kp = "https://kenpom.com/api.php"

    arch, fm = [], []
    for season, yr in SEASONS.items():
        n0, f0 = len(arch), len(fm)
        for d in season_dates(yr):
            ds = d.isoformat()
            js = cached_get(f"{RAW}/kenpom/archive/{ds}.json.gz", kp,
                            params={"endpoint": "archive", "d": ds}, headers=hdrs)
            for row in js or []:
                arch.append(row)
            js = cached_get(f"{RAW}/kenpom/fanmatch/{ds}.json.gz", kp,
                            params={"endpoint": "fanmatch", "d": ds}, headers=hdrs)
            for row in js or []:
                fm.append(row)
        print(f"[kenpom {season}] archive +{len(arch)-n0:,}, fanmatch +{len(fm)-f0:,}", flush=True)
    flat_write(arch, "kenpom_archive_daily")
    flat_write(fm, "kenpom_fanmatch")

    for ep in ("four-factors", "height", "pointdist", "misc-stats", "teams", "conf-ratings"):
        rows = []
        for season, yr in SEASONS.items():
            js = cached_get(f"{RAW}/kenpom/{ep}/{yr}.json.gz", kp,
                            params={"endpoint": ep, "y": yr}, headers=hdrs)
            for row in js or []:
                row["Season"] = row.get("Season", yr)
                rows.append(row)
        flat_write(rows, f"kenpom_{ep.replace('-', '_')}")


# ---------- CBBD ----------

def fetch_cbbd():
    hdrs = {"Authorization": f"Bearer {env('CFBD_API_KEY')}"}
    base = "https://api.collegebasketballdata.com"

    team_rows = []
    for season, yr in SEASONS.items():
        n0 = len(team_rows)
        for stype in ("regular", "postseason"):
            d, end = date(yr - 1, 10, 30), date(yr, 4, 12)
            while d <= end:
                nxt = d + timedelta(days=7)
                js = cached_get(f"{RAW}/cbbd/teams/{yr}_{stype}_{d.isoformat()}.json.gz",
                                f"{base}/games/teams",
                                params={"season": yr, "seasonType": stype,
                                        "startDateRange": f"{d.isoformat()}T00:00:00Z",
                                        "endDateRange": f"{nxt.isoformat()}T00:00:00Z"},
                                headers=hdrs, sleep=0.15)
                team_rows += js or []
                d = nxt
        print(f"[cbbd teams {season}] +{len(team_rows)-n0:,}", flush=True)
    flat_write(team_rows, "cbbd_team_box")

    player_rows = []
    for season, yr in SEASONS.items():
        n0 = len(player_rows)
        for stype in ("regular", "postseason"):
            for d in season_dates(yr):
                ds = d.isoformat()
                js = cached_get(f"{RAW}/cbbd/players/{yr}_{stype}_{ds}.json.gz",
                                f"{base}/games/players",
                                params={"season": yr, "seasonType": stype,
                                        "startDateRange": f"{ds}T00:00:00Z",
                                        "endDateRange": f"{(d+timedelta(days=1)).isoformat()}T00:00:00Z"},
                                headers=hdrs, sleep=0.15)
                # nested: one entry per team-game with players[] inside
                for tg in js or []:
                    head = {k: tg.get(k) for k in ("gameId", "season", "startDate", "team",
                                                   "teamId", "opponent", "isHome")}
                    for p in tg.get("players") or []:
                        player_rows.append({**head, **p})
        print(f"[cbbd players {season}] +{len(player_rows)-n0:,}", flush=True)
    flat_write(player_rows, "cbbd_player_box")


# ---------- balldontlie ----------

def bdl_paginate(endpoint, season, hdrs, extra=None):
    rows, cursor, page = [], None, 0
    while True:
        params = {"seasons[]": season, "per_page": 100, **(extra or {})}
        if cursor is not None:
            params["cursor"] = cursor
        js = cached_get(f"{RAW}/bdl/{endpoint.replace('/', '_')}/{season}_{page:05d}.json.gz",
                        f"https://api.balldontlie.io/v1/{endpoint}",
                        params=params, headers=hdrs, sleep=0.12)
        if js is None:
            break
        rows += js.get("data", [])
        cursor = (js.get("meta") or {}).get("next_cursor")
        page += 1
        if cursor is None:
            break
    return rows


def fetch_bdl():
    hdrs = {"Authorization": env("BALLDONTLIE_API_KEY")}
    for endpoint, name in (("games", "bdl_games"), ("stats", "bdl_player_box"),
                           ("stats/advanced", "bdl_player_advanced")):
        rows = []
        for season, yr in SEASONS.items():
            n0 = len(rows)
            rows += bdl_paginate(endpoint, yr - 1, hdrs)  # BDL season = start year
            print(f"[bdl {endpoint} {season}] +{len(rows)-n0:,}", flush=True)
        flat_write(rows, name)


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("kenpom", "all"):
        fetch_kenpom()
    if what in ("cbbd", "all"):
        fetch_cbbd()
    if what in ("bdl", "all"):
        fetch_bdl()
    print("STATS COMPLETE", flush=True)
