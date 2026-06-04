"""
CFBD bulk puller -> parquet, one file per (endpoint, year).
Pulls the raw inputs we need to recreate the opponent-adjusted feature suite.

Usage:
  python3 fetch_cfbd.py 2025                 # one year
  python3 fetch_cfbd.py 2016 2017 ... 2024   # many years
  python3 fetch_cfbd.py all                  # 2016-2019, 2021-2025 (skip 2020 COVID)
"""
import os, sys
import pandas as pd
import cfbd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
os.makedirs(DATA, exist_ok=True)

ALL_YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]


def flat(df):
    """json_normalize nested offense/defense dicts into flat columns."""
    return pd.json_normalize(df)


def pull_year(year):
    # 1) per-game raw advanced stats (the adjustment backbone)
    out = os.path.join(DATA, f"game_advanced_{year}.parquet")
    if not os.path.exists(out):
        rows = cfbd.get("/stats/game/advanced", year=year)
        df = flat(rows)
        df.to_parquet(out, index=False)
        print(f"  game_advanced {year}: {len(df)} rows, {df.shape[1]} cols")
    else:
        print(f"  game_advanced {year}: cached")

    # 2) games (schedule, scores, neutral site, conference, dates)
    out = os.path.join(DATA, f"games_{year}.parquet")
    if not os.path.exists(out):
        rows = cfbd.get("/games", year=year, seasonType="both")
        df = flat(rows)
        df.to_parquet(out, index=False)
        print(f"  games {year}: {len(df)} rows")
    else:
        print(f"  games {year}: cached")

    # 3) betting lines (we'll pick a provider/consensus later)
    out = os.path.join(DATA, f"lines_{year}.parquet")
    if not os.path.exists(out):
        rows = cfbd.get("/lines", year=year)
        # lines come nested: each game has a 'lines' list of provider quotes
        df = pd.json_normalize(rows, record_path="lines",
                               meta=["id", "season", "week", "seasonType", "homeTeam",
                                     "awayTeam", "homeScore", "awayScore"],
                               errors="ignore")
        df.to_parquet(out, index=False)
        print(f"  lines {year}: {len(df)} provider-rows")
    else:
        print(f"  lines {year}: cached")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); return
    years = ALL_YEARS if args == ["all"] else [int(a) for a in args]
    for y in years:
        print(f"== {y} ==")
        pull_year(y)


if __name__ == "__main__":
    main()
