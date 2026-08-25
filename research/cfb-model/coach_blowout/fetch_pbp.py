"""Fetch raw CFBD play-by-play + drives for the coach blowout-management study.

GARBAGE TIME INCLUDED — this extract deliberately keeps every play. The model
pipeline's gt-filtered features are useless here: the study IS about what
coaches do in garbage time.

Seasons 2021-2025 regular season (2020 COVID excluded). One parquet per
season per endpoint under data/cfbd/: plays_YYYY.parquet, drives_YYYY.parquet.
Idempotent — skips seasons already on disk. ~2 calls x ~16 weeks x season.
"""
import os, sys
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import cfbd

DATA = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "cfbd"))
SEASONS = [2021, 2022, 2023, 2024, 2025]


def clock_sec(c):
    if not isinstance(c, dict):
        return None
    return int(c.get("minutes") or 0) * 60 + int(c.get("seconds") or 0)


def fetch_season(year):
    games = pd.read_parquet(os.path.join(DATA, f"games_{year}.parquet"))
    weeks = sorted(games[games.seasonType == "regular"].week.dropna().unique())
    plays_all, drives_all = [], []
    for wk in weeks:
        wk = int(wk)
        p = cfbd.get("/plays", year=year, week=wk, seasonType="regular", classification="fbs")
        d = cfbd.get("/drives", year=year, week=wk, seasonType="regular", classification="fbs")
        for row in p:
            row["clock_sec"] = clock_sec(row.pop("clock", None))
        for row in d:
            row["start_sec"] = clock_sec(row.pop("startTime", None))
            row["end_sec"] = clock_sec(row.pop("endTime", None))
            el = row.pop("elapsed", None)
            row["elapsed_sec"] = clock_sec(el)
        pdf, ddf = pd.DataFrame(p), pd.DataFrame(d)
        pdf["week"], ddf["week"] = wk, wk
        plays_all.append(pdf)
        drives_all.append(ddf)
        print(f"  {year} wk{wk}: {len(pdf)} plays, {len(ddf)} drives", flush=True)
    pl = pd.concat(plays_all, ignore_index=True)
    dr = pd.concat(drives_all, ignore_index=True)
    pl["season"], dr["season"] = year, year
    pl.to_parquet(os.path.join(DATA, f"plays_{year}.parquet"))
    dr.to_parquet(os.path.join(DATA, f"drives_{year}.parquet"))
    print(f"{year}: saved {len(pl)} plays, {len(dr)} drives", flush=True)


if __name__ == "__main__":
    for year in SEASONS:
        if os.path.exists(os.path.join(DATA, f"plays_{year}.parquet")):
            print(f"{year}: cached, skip", flush=True)
            continue
        fetch_season(year)
    print("done", flush=True)
