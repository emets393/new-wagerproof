#!/usr/bin/env python3
"""Consolidate Fantasy Points Data pull files (~/Downloads/fp_*.json) into parquet.

One parquet per tool-view under data/fpdata/: rows are per player-GAME (player
tools) or per team-GAME (team tools), all seasons stacked. Also moves the raw
JSONs into data/fpdata/raw/ so Downloads stays clean. Idempotent — re-run any
time; newest file wins per (tool, season).
"""
import glob
import json
import os
import shutil
import sys

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "fpdata")
RAW = os.path.join(OUT, "raw")


def main():
    os.makedirs(RAW, exist_ok=True)
    src = sorted(glob.glob(os.path.expanduser("~/Downloads/fp_*.json")))
    # keep newest per basename (Chrome " (1)" duplicates lose)
    moved = 0
    for f in src:
        base = os.path.basename(f).replace(" (1)", "").replace(" (2)", "")
        if base.endswith("_TEST.json"):
            os.remove(f)
            continue
        shutil.move(f, os.path.join(RAW, base))
        moved += 1
    print(f"moved {moved} files from Downloads")

    by_tool = {}
    for f in sorted(glob.glob(os.path.join(RAW, "fp_*.json"))):
        d = json.load(open(f))
        by_tool.setdefault(d["tool"], []).append((d["season"], d.get("nrows", 0), d["rows"], d.get("errs", [])))

    for tool, parts in sorted(by_tool.items()):
        frames = [pd.DataFrame(rows) for _, _, rows, _ in parts if rows]
        if not frames:
            print(f"{tool:45s} EMPTY")
            continue
        df = pd.concat(frames, ignore_index=True)
        # drop heavy nested cols that duplicate scalar fields
        for c in ("teamsPlayedFor", "opponentsPlayed"):
            if c in df.columns:
                df = df.drop(columns=[c])
        dest = os.path.join(OUT, f"{tool}.parquet")
        df.to_parquet(dest)
        errs = [e for *_, ee in parts for e in ee]
        seasons = sorted(set(df["__season"]))
        print(f"{tool:45s} {len(df):7d} rows | {len(df.columns):3d} cols | seasons {seasons[0]}-{seasons[-1]}"
              + (f" | ERRS {len(errs)}" if errs else ""))


if __name__ == "__main__":
    main()
