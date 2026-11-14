#!/usr/bin/env python3
"""KenPom FanMatch backfill: one call per game day, six seasons -> data/parquet/kenpom_fanmatch.parquet.
Fields per game: Season, GameID (KenPom's), DateOfGame, Visitor, Home, HomeRank, VisitorRank, HomePred, VisitorPred, HomeWP, PredTempo,
ThrillScore. These are KenPom's pregame predictions as published the morning of the game (FanMatch); the leak test lives in the study."""
import os, sys, time, json
from datetime import date, timedelta
import pandas as pd, requests
KEY = os.environ["KENPOM_API_KEY"]; OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "parquet", "kenpom_fanmatch.parquet")
have = pd.read_parquet(OUT) if os.path.exists(OUT) else pd.DataFrame()
done = set(have.DateOfGame) if len(have) else set()
rows, empty = [], []
for season in range(2021, 2027):
    d, end = date(season - 1, 11, 1), date(season, 4, 10)
    while d <= end:
        ds = d.isoformat()
        if ds not in done:
            r = requests.get("https://kenpom.com/api.php", params={"endpoint": "fanmatch", "d": ds}, headers={"Authorization": f"Bearer {KEY}"}, timeout=60)
            try:
                js = r.json()
            except Exception:
                js = []
            if isinstance(js, list) and js:
                rows += js
            else:
                empty.append(ds)
            time.sleep(0.25)
        d += timedelta(days=1)
new = pd.DataFrame(rows)
allr = pd.concat([have, new], ignore_index=True).drop_duplicates(["Season", "GameID"]) if len(have) else new
allr.to_parquet(OUT, index=False)
print(f"fanmatch rows {len(allr):,}; new {len(new):,}; empty days {len(empty)} (e.g. {empty[:5]})")
print(allr.groupby("Season").agg(games=("GameID", "size"), days=("DateOfGame", "nunique"), thrill=("ThrillScore", "mean")).round(1).to_string())
