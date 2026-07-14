#!/usr/bin/env python3
"""Backfill cfb_analysis_base weather + dome from CFBD weather parquets (2016–2025).

Reads research/cfb-model/data/cfbd/weather_*.parquet, buckets weatherCondition into
clear|cloudy|rain|snow, stages into cfb_wx_backfill, then UPDATEs cfb_analysis_base.

Requires:
  - SUPABASE_SERVICE_KEY in repo-root .env.local (warehouse service role for
    jpxnjuwglavsjbgbasnl — same key dry_common uses; never printed).
  - Staging table created once via Management API / apply_migration:

      CREATE TABLE IF NOT EXISTS cfb_wx_backfill (
        game_id bigint PRIMARY KEY,
        temperature numeric,
        wind_speed numeric,
        precipitation numeric,
        weather_condition text,
        dome boolean
      );

  - After a successful run you may DROP TABLE cfb_wx_backfill;

Usage (from research/cfb-model/):
  python3 cab_builder/load_cfb_weather_dome.py

Safe to re-run: wipe + insert staging, then UPDATE join on game_id.
"""
from __future__ import annotations

import glob
import os
import sys

import pandas as pd

# research/cfb-model on path for dry_common
HERE = os.path.dirname(os.path.abspath(__file__))
CFB_ROOT = os.path.dirname(HERE)
sys.path.insert(0, CFB_ROOT)

import dry_common as C  # noqa: E402


def bucket(c):
    if not isinstance(c, str):
        return None
    s = c.lower()
    if s in ("none", ""):
        return None
    if "snow" in s or "sleet" in s:
        return "snow"
    if "rain" in s or "shower" in s or "thunder" in s or s == "storm":
        return "rain"
    if "clear" in s or "fair" in s:
        return "clear"
    if "cloud" in s or "overcast" in s or "fog" in s:
        return "cloudy"
    return None


def build_frame() -> pd.DataFrame:
    pattern = os.path.join(CFB_ROOT, "data", "cfbd", "weather_*.parquet")
    files = sorted(glob.glob(pattern))
    if not files:
        raise SystemExit(f"no weather parquets at {pattern}")
    df = pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)
    df["weather_condition"] = df["weatherCondition"].map(bucket)
    df = df.sort_values("id").drop_duplicates("id", keep="first")
    frame = (
        df[["id", "temperature", "windSpeed", "precipitation", "weather_condition", "gameIndoors"]]
        .rename(
            columns={
                "id": "game_id",
                "windSpeed": "wind_speed",
                "gameIndoors": "dome",
            }
        )
    )
    frame["game_id"] = frame["game_id"].astype("int64")
    return frame


BACKFILL_SQL = """
UPDATE cfb_analysis_base b SET
  temperature       = w.temperature,
  wind_speed        = w.wind_speed,
  precipitation     = w.precipitation,
  weather_condition = w.weather_condition,
  dome              = w.dome,
  has_weather       = (w.temperature IS NOT NULL)
FROM cfb_wx_backfill w
WHERE w.game_id = b.game_id;
"""


def main():
    frame = build_frame()
    print(f"staged rows: {len(frame):,}  (weather_condition non-null: {frame['weather_condition'].notna().sum():,})")
    print("1) wipe + insert cfb_wx_backfill via PostgREST…")
    C.wipe("cfb_wx_backfill", "game_id=gte.0")
    C.insert("cfb_wx_backfill", frame)
    print("2) Apply the UPDATE via Supabase SQL / Management API (service key cannot run DDL/DML joins):")
    print(BACKFILL_SQL)
    print("3) Optional: DROP TABLE cfb_wx_backfill;")
    print("Done staging. Run the UPDATE in the SQL editor, then re-check the probe in README.md.")


if __name__ == "__main__":
    main()
