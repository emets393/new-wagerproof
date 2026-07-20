#!/usr/bin/env python3
"""Fetch final + halftime scores for NBA (ESPN scoreboard) and NCAAB (CBBD).

Outputs data/parquet/results_nba.parquet and results_ncaab.parquet with
full-game and 1H scores per team — everything needed to grade FG/1H/team-total
markets. ESPN needs no key; CBBD uses CFBD_API_KEY from repo-root .env.local
(same key works for both CFB and CBB APIs).

Responses are cached under data/results_raw/ so reruns are free, mirroring the
odds backfill scripts.
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
RAW = os.path.join(ROOT, "data", "results_raw")
OUT = os.path.join(ROOT, "data", "parquet")

# season label -> (start, end) date window for ESPN day-by-day sweep
NBA_SEASONS = {
    "2022-23": (date(2022, 10, 18), date(2023, 6, 15)),
    "2023-24": (date(2023, 10, 24), date(2024, 6, 20)),
    "2024-25": (date(2024, 10, 22), date(2025, 6, 25)),
    "2025-26": (date(2025, 10, 21), date(2026, 6, 25)),
}
NCAAB_SEASONS = {"2022-23": 2023, "2023-24": 2024, "2024-25": 2025, "2025-26": 2026}

ESPN_NBA = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
CBBD = "https://api.collegebasketballdata.com/games"


def cached_get(cache_path, url, params=None, headers=None):
    if os.path.exists(cache_path):
        with gzip.open(cache_path, "rt") as f:
            return json.load(f)
    for attempt in range(4):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=60)
            if r.status_code == 200:
                js = r.json()
                os.makedirs(os.path.dirname(cache_path), exist_ok=True)
                with gzip.open(cache_path, "wt") as f:
                    json.dump(js, f)
                time.sleep(0.2)
                return js
            if r.status_code in (404, 400):
                return None
        except requests.RequestException:
            pass
        time.sleep(2 * (attempt + 1))
    print(f"  gave up: {url} {params}", flush=True)
    return None


def fetch_nba():
    rows = []
    for season, (start, end) in NBA_SEASONS.items():
        d, n_days = start, 0
        while d <= end:
            ymd = d.strftime("%Y%m%d")
            js = cached_get(f"{RAW}/nba/{ymd}.json.gz", ESPN_NBA,
                            params={"dates": ymd, "limit": "100"})
            d += timedelta(days=1)
            n_days += 1
            if not js:
                continue
            for ev in js.get("events", []):
                comp = ev["competitions"][0]
                if comp.get("status", {}).get("type", {}).get("name") != "STATUS_FINAL":
                    continue
                rec = {"season": season, "date_et": ev["date"][:10], "espn_id": ev["id"]}
                ok = True
                for c in comp["competitors"]:
                    side = c["homeAway"]  # 'home'/'away'
                    lines = [float(x.get("value", 0) or 0) for x in c.get("linescores", [])]
                    if len(lines) < 4:
                        ok = False
                        break
                    rec[f"{side}_team"] = c["team"]["displayName"]
                    rec[f"{side}_score"] = float(c["score"])
                    rec[f"{side}_h1"] = lines[0] + lines[1]
                if ok:
                    rows.append(rec)
        print(f"[nba {season}] swept {n_days} days, cumulative games={len(rows)}", flush=True)
    df = pd.DataFrame(rows).drop_duplicates("espn_id")
    df.to_parquet(f"{OUT}/results_nba.parquet", index=False)
    print(f"results_nba: {len(df):,} games -> {OUT}/results_nba.parquet", flush=True)


def fetch_ncaab():
    key = None
    for line in open(os.path.join(ROOT, "..", "..", ".env.local")):
        if line.startswith("CFBD_API_KEY="):
            key = line.split("=", 1)[1].strip()
    if not key:
        sys.exit("CFBD_API_KEY not found in .env.local")
    hdrs = {"Authorization": f"Bearer {key}"}

    rows = []
    for season, yr in NCAAB_SEASONS.items():
        # Season-level calls silently truncate (~3.1k of ~5.8k games) — chunk by month
        games, seen = [], set()
        months = [(yr - 1, m) for m in (10, 11, 12)] + [(yr, m) for m in (1, 2, 3, 4)]
        for (y, m) in months:
            nxt = (y + 1, 1) if m == 12 else (y, m + 1)
            for stype in ("regular", "postseason"):
                js = cached_get(f"{RAW}/ncaab/{yr}_{stype}_{y}-{m:02d}.json.gz", CBBD,
                                params={"season": yr, "seasonType": stype,
                                        "startDateRange": f"{y}-{m:02d}-01T00:00:00Z",
                                        "endDateRange": f"{nxt[0]}-{nxt[1]:02d}-01T00:00:00Z"},
                                headers=hdrs)
                for g in js or []:
                    if g["id"] not in seen:
                        seen.add(g["id"])
                        games.append(g)
        for g in games:
            if g.get("status") != "final" or g.get("homePoints") is None:
                continue
            hp, ap = g.get("homePeriodPoints") or [], g.get("awayPeriodPoints") or []
            rows.append({
                "season": season,
                "start_utc": g["startDate"],
                "cbbd_id": g["id"],
                "home_team": g["homeTeam"],
                "away_team": g["awayTeam"],
                "home_score": float(g["homePoints"]),
                "away_score": float(g["awayPoints"]),
                # periodPoints = [1H, 2H, OT...] for NCAAB's two-half format
                "home_h1": float(hp[0]) if hp else None,
                "away_h1": float(ap[0]) if ap else None,
                "neutral_site": g.get("neutralSite"),
                "game_type": g.get("gameType"),
            })
        print(f"[ncaab {season}] {len(games)} fetched, cumulative finals={len(rows)}", flush=True)
    df = pd.DataFrame(rows).drop_duplicates("cbbd_id")
    df.to_parquet(f"{OUT}/results_ncaab.parquet", index=False)
    print(f"results_ncaab: {len(df):,} games -> {OUT}/results_ncaab.parquet", flush=True)


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("nba", "all"):
        fetch_nba()
    if what in ("ncaab", "all"):
        fetch_ncaab()
    print("RESULTS COMPLETE", flush=True)
