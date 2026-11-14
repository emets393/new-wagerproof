#!/usr/bin/env python3
"""Matched T-60 prop prices. The panel's over_px/under_px were MEDIANS OF AMERICAN ODDS across
books (a +105/-115 split medians to -5), and books posting different lines were pooled. Here:
last snapshot >= 60 min pre-kick, consensus line = median line, prices = median IMPLIED
PROBABILITY across the books posting exactly that line, returned as decimal payout multipliers."""
import numpy as np, pandas as pd
from pathlib import Path
DATA = Path("data")
def imp(a):
    a = pd.to_numeric(a, errors="coerce"); return np.where(a > 0, 100 / (a + 100), -a / (-a + 100))
cols = ["season", "week", "player_id", "market", "line", "over_odds", "under_odds", "commence_time", "snapshot_time", "book"] 
fr = []
for f in ("props_rows.parquet", "props_rows_extra.parquet"):
    d = pd.read_parquet(DATA / f); fr.append(d[[c for c in cols if c in d.columns]])
ex = pd.concat(fr, ignore_index=True)
ex["snap"] = pd.to_datetime(ex.snapshot_time, utc=True); ex["comm"] = pd.to_datetime(ex.commence_time, utc=True)
ex["mins"] = (ex.comm - ex.snap).dt.total_seconds() / 60
ex = ex[(ex.mins >= 60) & ex.line.notna() & (ex.over_odds.abs() >= 100) & (ex.under_odds.abs() >= 100)]
keys = ["season", "week", "player_id", "market"]
last = ex.groupby(keys).snap.transform("max"); ex = ex[ex.snap == last]
cons = ex.groupby(keys).line.median().rename("close_line").reset_index()
ex = ex.merge(cons, on=keys); ex = ex[ex.line == ex.close_line]
ex["po"], ex["pu"] = imp(ex.over_odds), imp(ex.under_odds)
out = ex.groupby(keys).agg(close_line=("close_line", "first"), po=("po", "median"), pu=("pu", "median"), n_books=("po", "size")).reset_index()
out["over_dec"], out["under_dec"] = 1 / out.po - 1, 1 / out.pu - 1     # profit per 1u on a win
out.to_parquet(DATA / "fpdata" / "_prop_close_prices_matched.parquet", index=False)
print(len(out), "player-game-markets with matched prices; median vig-free? avg (po+pu) =", round((out.po + out.pu).mean(), 3))
print(out.groupby("market")[["over_dec", "under_dec", "n_books"]].median().round(3))
