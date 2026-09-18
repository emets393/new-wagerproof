#!/usr/bin/env python3
"""Refresh nflverse play-by-play for the current season AND the prior season into
data/pbp_cache/_pbp<season>.parquet.

Feeds build_team_week_seasonal.py, which builds the TRUE season-to-date team features the sides
model uses (the prod nfl_pregame_advanced_team_week `_s2d` columns never reset by season — see
memory nfl-team-week-cumulative-defect). The prior season is needed because every entering value
is K=4 seeded from last year's mean. Render's cron disk is EPHEMERAL, so both files are pulled on
every run (~60 MB); locally the prior season is skipped once a full-season file is on disk.
Fails soft per file: a download hiccup keeps whatever is cached (the builder carries state forward).
Usage: python3 refresh_pbp_current.py <season>
"""
import os
import sys
import requests
import pandas as pd

SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else int(pd.Timestamp.utcnow().year)
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "pbp_cache")
os.makedirs(CACHE, exist_ok=True)


def pull(season, skip_if_full=False):
    out = os.path.join(CACHE, f"_pbp{season}.parquet"); tmp = out + ".tmp"
    if skip_if_full and os.path.exists(out):
        try:
            if len(pd.read_parquet(out, columns=["week"])) >= 40000:      # a full regular season is ~45-50k plays
                print(f"[pbp] {season}: full-season cache present, skipping"); return
        except Exception:
            pass
    url = f"https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.parquet"
    try:
        r = requests.get(url, timeout=300); r.raise_for_status()
        open(tmp, "wb").write(r.content)
        d = pd.read_parquet(tmp)
        if len(d) < 100:
            raise RuntimeError(f"only {len(d)} plays")
        os.replace(tmp, out)
        print(f"[pbp] {season}: {len(d)} plays, weeks {int(d.week.min())}-{int(d.week.max())} -> {out}")
    except Exception as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        print(f"[pbp] {season}: refresh failed ({type(e).__name__}: {e}); keeping existing cache")


pull(SEASON - 1, skip_if_full=True)
pull(SEASON)
