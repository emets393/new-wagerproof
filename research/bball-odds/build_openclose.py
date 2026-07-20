#!/usr/bin/env python3
"""Derive per-game opener / T-60 close / movement from the parsed grid tables.

Reads data/parquet/grid_{sport}_{season}.parquet, writes
data/parquet/openclose_{sport}_{season}.parquet: one row per event x book with
open/close values per market, plus consensus (cross-book median) columns and
movement deltas. Opener = book's first grid sighting per market; close = last
snapshot at-or-before T-60 (closing-line policy, see memory: closing-line-definition).
"""
import glob
import os

import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

MARKET_COLS = {
    "ml": ["ml_home_price", "ml_away_price"],
    "spread": ["spread_home_point", "spread_home_price", "spread_away_price"],
    "total": ["total_point", "total_over_price", "total_under_price"],
}


def build(path):
    name = os.path.basename(path).replace("grid_", "openclose_")
    df = pd.read_parquet(path)
    df["snap_ts"] = pd.to_datetime(df["snap_ts"])
    df["commence_time"] = pd.to_datetime(df["commence_time"])
    df = df.sort_values("snap_ts")

    meta = df.groupby("event_id").agg(
        commence_time=("commence_time", "last"),  # tip times shift; last sighting wins
        home_team=("home_team", "last"),
        away_team=("away_team", "last"),
    )

    pieces = []
    for mkt, cols in MARKET_COLS.items():
        anchor = cols[0]
        has = df[df[anchor].notna()]
        first = has.groupby(["event_id", "book"])[cols].first()
        first.columns = [f"open_{c}" for c in cols]
        first[f"open_{mkt}_ts"] = has.groupby(["event_id", "book"])["snap_ts"].first()

        # T-60 close: last snapshot at-or-before commence - 60min
        pre = has[has["snap_ts"] <= has["commence_time"] - pd.Timedelta(minutes=60)]
        last = pre.groupby(["event_id", "book"])[cols].last()
        last.columns = [f"close_{c}" for c in cols]
        last[f"close_{mkt}_ts"] = pre.groupby(["event_id", "book"])["snap_ts"].last()

        both = first.join(last, how="outer")
        pieces.append(both)

    oc = pieces[0].join(pieces[1:], how="outer")
    oc = oc.join(meta, on="event_id").reset_index()

    oc["spread_move"] = oc["close_spread_home_point"] - oc["open_spread_home_point"]
    oc["total_move"] = oc["close_total_point"] - oc["open_total_point"]

    # Cross-book consensus at open/close (median), joined back per event
    cons = oc.groupby("event_id").agg(
        cons_open_spread=("open_spread_home_point", "median"),
        cons_close_spread=("close_spread_home_point", "median"),
        cons_open_total=("open_total_point", "median"),
        cons_close_total=("close_total_point", "median"),
        n_books=("book", "nunique"),
    )
    oc = oc.join(cons, on="event_id")

    out = os.path.join(OUT, f"{name}")
    oc.to_parquet(out, index=False)
    print(f"  {name}: {len(oc):,} rows ({oc.event_id.nunique():,} games) -> {out}", flush=True)


def main():
    for path in sorted(glob.glob(os.path.join(OUT, "grid_*.parquet"))):
        print(f"[{os.path.basename(path)}]", flush=True)
        build(path)
    print("OPENCLOSE COMPLETE", flush=True)


if __name__ == "__main__":
    main()
