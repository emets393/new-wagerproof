"""Hunt for edges IN the attempts markets themselves (2024-25).
player_pass_attempts (actual = pass attempts), player_rush_attempts (actual = carries).
Clean prices (median -114). Batteries: line-vs-form, line movement, form-trend.
Each side (over/under) graded vs base rate + ROI, both seasons. Read-only.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from stats_helpers import wilson_ci

DATA = Path(__file__).resolve().parent / "data"
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "OAK": "LV", "SD": "LAC", "STL": "LA"}
MKT = {"player_pass_attempts": "attempts", "player_rush_attempts": "carries",
       "player_pass_completions": "completions"}


def amer_profit(o):
    o = pd.to_numeric(pd.Series(o), errors="coerce").values.astype(float)
    o = np.where(np.abs(o) < 100, np.nan, o)      # real American odds are always |o|>=100; smaller = corrupt
    return np.where(np.isnan(o) | (o == 0), np.nan, np.where(o > 0, o/100.0, 100.0/np.abs(np.where(o == 0, 1, o))))


def frame():
    ex = pd.read_parquet(DATA / "props_rows_extra.parquet")
    ex = ex[ex.market.isin(MKT)].copy()
    ex["snap"] = pd.to_datetime(ex.snapshot_time, utc=True, format="ISO8601")
    keys = ["season", "week", "player_id", "position", "team", "market"]
    c = ex.groupby(keys + ["snap"]).agg(line=("line", "median"),
        over=("over_odds", "median"), under=("under_odds", "median")).reset_index().sort_values(keys + ["snap"])
    op = c.groupby(keys).first().reset_index()[keys + ["line"]].rename(columns={"line": "open_line"})
    cl = c.groupby(keys).last().reset_index()[keys + ["line", "over", "under"]].rename(
        columns={"line": "close_line", "over": "over_px", "under": "under_px"})
    d = op.merge(cl, on=keys)
    # actuals
    po = pd.read_parquet(DATA / "player_offense.parquet")[["season", "week", "player_id", "attempts", "carries", "completions"]]
    d = d.merge(po, on=["season", "week", "player_id"], how="left")
    d["actual"] = np.select(
        [d.market == "player_pass_attempts", d.market == "player_rush_attempts"],
        [d.attempts, d.carries], default=d.completions)
    d = d.dropna(subset=["actual", "close_line"])
    # entering form (shifted) per (player, market)
    d = d.sort_values(["player_id", "market", "season", "week"])
    g = d.groupby(["player_id", "market"])
    d["l5"] = g.actual.transform(lambda s: s.shift(1).rolling(5, min_periods=2).mean())
    d["l3"] = g.actual.transform(lambda s: s.shift(1).rolling(3, min_periods=2).mean())
    d["szn"] = g.actual.transform(lambda s: s.shift(1).expanding(min_periods=3).mean())
    d["dev"] = (d.close_line - d.l5) / d.l5                 # line vs recent form
    d["move"] = d.close_line - d.open_line                  # open->close movement
    d = d[d.actual != d.close_line]
    d["over"] = d.actual > d.close_line
    return d


def rep(label, sub, over_side, base):
    if len(sub) < 12:
        print(f"    {label:34s} n={len(sub):4d} (thin)"); return
    win = sub.over.values if over_side else (~sub.over.values)
    px = sub.over_px if over_side else sub.under_px
    roi = np.nanmean(np.where(win, amer_profit(px.values), -1.0)) * 100
    k, n = int(win.sum()), len(sub)
    lo, hi = wilson_ci(k, n)
    per = " ".join(f"{y}:{(sub[sub.season==y].over.mean() if over_side else (~sub[sub.season==y].over).mean())*100:.0f}%"
                   for y in (2024, 2025) if len(sub[sub.season == y]))
    print(f"    {label:34s} n={n:4d} hit={k/n*100:5.1f}% ROI={roi:+6.1f}% base={base:4.1f}% [{per}] CI[{lo*100:.0f},{hi*100:.0f}]")


def main():
    d = frame()
    for mkt in MKT:
        m = d[d.market == mkt].dropna(subset=["l5"])
        base_o = m.over.mean() * 100
        print(f"\n===== {mkt} (n={len(m)}, base OVER={base_o:.1f}%, base UNDER={100-base_o:.1f}%) =====")
        print("  LINE vs FORM (dev = (line - L5)/L5):")
        rep("line ABOVE form (dev>+5%) -> UNDER", m[m.dev > 0.05], False, 100 - base_o)
        rep("line ABOVE form (dev>+5%) -> OVER", m[m.dev > 0.05], True, base_o)
        rep("line BELOW form (dev<-5%) -> OVER", m[m.dev < -0.05], True, base_o)
        rep("line BELOW form (dev<-5%) -> UNDER", m[m.dev < -0.05], False, 100 - base_o)
        rep("line WELL below (dev<-15%) -> OVER", m[m.dev < -0.15], True, base_o)
        print("  LINE MOVEMENT (open->close):")
        rep("steamed UP (move>=1) -> OVER", m[m.move >= 1], True, base_o)
        rep("steamed UP (move>=1) -> UNDER", m[m.move >= 1], False, 100 - base_o)
        rep("dropped (move<=-1) -> UNDER", m[m.move <= -1], False, 100 - base_o)
        rep("dropped (move<=-1) -> OVER", m[m.move <= -1], True, base_o)
        print("  FORM TREND (L3 vs season):")
        rep("usage rising (L3>szn) -> OVER", m[m.l3 > m.szn], True, base_o)
        rep("usage falling (L3<szn) -> UNDER", m[m.l3 < m.szn], False, 100 - base_o)


if __name__ == "__main__":
    main()
