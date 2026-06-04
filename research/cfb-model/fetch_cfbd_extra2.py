"""
Pull (1) historical weather and (2) season-to-date havoc/PPO/pace/field-position.

weather: /games/weather per year -> data/cfbd/weather_<year>.parquet
season_advanced_asof: /stats/season/advanced per (year, endWeek=W) = stats THROUGH week W
  (leak-safe for games in week W+1). Extract havoc/PPO/fieldpos/plays/drives off+def.
  -> data/season_advanced_asof.parquet
"""
import os
import pandas as pd
import cfbd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
WEEKS = range(1, 16)


def pull_weather():
    for y in YEARS:
        out = os.path.join(DATA, f"weather_{y}.parquet")
        if os.path.exists(out):
            print(f"  weather {y}: cached"); continue
        rows = cfbd.get("/games/weather", year=y)  # year-only returns all weeks
        df = pd.json_normalize(rows)
        df.to_parquet(out, index=False)
        print(f"  weather {y}: {len(df)} games")


def g(d, *path, default=None):
    for p in path:
        d = d.get(p) if isinstance(d, dict) else None
        if d is None:
            return default
    return d


def pull_season_asof():
    out = os.path.join(HERE, "data", "season_advanced_asof.parquet")
    if os.path.exists(out):
        print("  season_advanced_asof: cached"); return
    rows = []
    for y in YEARS:
        for w in WEEKS:
            try:
                res = cfbd.get("/stats/season/advanced", year=y, startWeek=1, endWeek=w)
            except Exception:
                continue
            for r in res:
                o, d = r.get("offense", {}), r.get("defense", {})
                rows.append({
                    "season": y, "asof_week": w, "team": r.get("team"),
                    "off_plays": o.get("plays"), "off_drives": o.get("drives"),
                    "off_ppo": o.get("pointsPerOpportunity"),
                    "off_start": g(o, "fieldPosition", "averageStart"),
                    "off_havoc": g(o, "havoc", "total"),
                    "off_havoc_f7": g(o, "havoc", "frontSeven"),
                    "off_havoc_db": g(o, "havoc", "db"),
                    "def_plays": d.get("plays"), "def_drives": d.get("drives"),
                    "def_ppo": d.get("pointsPerOpportunity"),
                    "def_start": g(d, "fieldPosition", "averageStart"),
                    "def_havoc": g(d, "havoc", "total"),
                    "def_havoc_f7": g(d, "havoc", "frontSeven"),
                    "def_havoc_db": g(d, "havoc", "db"),
                })
        print(f"  season_asof {y}: done")
    pd.DataFrame(rows).to_parquet(out, index=False)
    print(f"season_advanced_asof: {len(rows)} rows -> {out}")


if __name__ == "__main__":
    print("== weather ==")
    pull_weather()
    print("== season_advanced_asof ==")
    pull_season_asof()
