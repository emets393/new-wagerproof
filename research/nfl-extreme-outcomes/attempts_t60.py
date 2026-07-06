"""T-60 validation of the attempts/completions 'fade the steam -> UNDER' signal.

The earlier close-line grade used the LAST snapshot (~T-10), which is NOT bettable under
our actionable-close policy (need >=60 min before kickoff to place the bet). Here the
'close' is redefined as the last snapshot at or before T-60, the steam is measured
open -> T-60, and the bet is priced at the T-60 line/odds. If the edge survives this cut
it is genuinely playable; if it collapses it was CLV-inflated by late (unbettable) movement.
Read-only.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from stats_helpers import wilson_ci

DATA = Path(__file__).resolve().parent / "data"
MKT = {"player_pass_attempts": "attempts", "player_rush_attempts": "carries",
       "player_pass_completions": "completions"}
T60 = 60.0   # minutes before kickoff = last actionable line


def amer_profit(o):
    o = pd.to_numeric(pd.Series(o), errors="coerce").values.astype(float)
    o = np.where(np.abs(o) < 100, np.nan, o)
    return np.where(np.isnan(o) | (o == 0), np.nan, np.where(o > 0, o/100.0, 100.0/np.abs(np.where(o == 0, 1, o))))


def frame(cut=T60):
    ex = pd.read_parquet(DATA / "props_rows_extra.parquet")
    ex = ex[ex.market.isin(MKT)].copy()
    ex["snap"] = pd.to_datetime(ex.snapshot_time, utc=True, format="ISO8601")
    ex["comm"] = pd.to_datetime(ex.commence_time, utc=True, format="ISO8601")
    ex["mins"] = (ex.comm - ex.snap).dt.total_seconds() / 60.0
    keys = ["season", "week", "player_id", "position", "team", "market"]
    c = ex.groupby(keys + ["snap", "mins"]).agg(line=("line", "median"),
        over=("over_odds", "median"), under=("under_odds", "median")).reset_index().sort_values(keys + ["snap"])
    # OPEN = first snapshot; CLOSE(actionable) = last snapshot still >= cut minutes to kickoff
    op = c.groupby(keys).first().reset_index()[keys + ["line"]].rename(columns={"line": "open_line"})
    act = c[c.mins >= cut]
    cl = act.groupby(keys).last().reset_index()[keys + ["line", "over", "under", "mins"]].rename(
        columns={"line": "close_line", "over": "over_px", "under": "under_px", "mins": "close_mins"})
    d = op.merge(cl, on=keys)
    po = pd.read_parquet(DATA / "player_offense.parquet")[["season", "week", "player_id", "attempts", "carries", "completions"]]
    d = d.merge(po, on=["season", "week", "player_id"], how="left")
    d["actual"] = np.select(
        [d.market == "player_pass_attempts", d.market == "player_rush_attempts"],
        [d.attempts, d.carries], default=d.completions)
    d = d.dropna(subset=["actual", "close_line"])
    d["move"] = d.close_line - d.open_line
    d = d[d.actual != d.close_line]
    d["over"] = d.actual > d.close_line
    return d


def rep(label, sub, over_side, base):
    if len(sub) < 12:
        print(f"    {label:30s} n={len(sub):4d} (thin)"); return
    win = sub.over.values if over_side else (~sub.over.values)
    px = sub.over_px if over_side else sub.under_px
    roi = np.nanmean(np.where(win, amer_profit(px.values), -1.0)) * 100
    k, n = int(win.sum()), len(sub)
    lo, hi = wilson_ci(k, n)
    per = " ".join(f"{y}:{(sub[sub.season==y].over.mean() if over_side else (~sub[sub.season==y].over).mean())*100:.0f}%"
                   for y in (2024, 2025) if len(sub[sub.season == y]))
    print(f"    {label:30s} n={n:4d} hit={k/n*100:5.1f}% ROI={roi:+6.1f}% base={base:4.1f}% [{per}] CI[{lo*100:.0f},{hi*100:.0f}]")


def main():
    d = frame()
    print(f"actionable 'close' timing (mins before kick): "
          f"median={d.close_mins.median():.0f}  p25={d.close_mins.quantile(.25):.0f}  p90={d.close_mins.quantile(.9):.0f}\n")
    for mkt in MKT:
        m = d[d.market == mkt]
        base_o = m.over.mean() * 100
        up = m[m.move >= 1]
        dn = m[m.move <= -1]
        print(f"===== {mkt} (n={len(m)}, base UNDER={100-base_o:.1f}%) — steam measured open->T-60 =====")
        rep("steam UP (>=1) -> UNDER", up, False, 100 - base_o)
        rep("steam UP (>=1) -> OVER", up, True, base_o)
        rep("dropped (<=-1) -> UNDER", dn, False, 100 - base_o)
        # stronger steam
        up2 = m[m.move >= 2]
        rep("strong steam UP (>=2) -> UNDER", up2, False, 100 - base_o)
        print()


if __name__ == "__main__":
    main()
