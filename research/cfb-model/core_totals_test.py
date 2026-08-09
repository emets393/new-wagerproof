"""CORE test 5 (owner push): the O/D split's REAL in-season market is TOTALS.
As-of off/def sums -> implied total (walk-forward linear calibration, seasons < S),
edge vs close AND open at rungs 2/4/6, weeks 5-15, 2021-25, per-season.
Head-to-head: CORE components vs OUR components (adj_epa / adj_epa_allowed) on the
same games — if either beats the total line anywhere, it's a real finding."""
import numpy as np, pandas as pd
from pathlib import Path
DATA = Path(__file__).resolve().parent / "data"

core = pd.read_parquet(DATA / "cfbd" / "core_asof.parquet").set_index(["season", "thru_week", "team"])
ours = pd.read_parquet(DATA / "team_ratings_asof.parquet")
ours = ours.set_index(["season", "asof_week", "team"])

mg = pd.read_parquet(DATA / "model_games.parquet")
g = mg[(mg.week >= 5) & (mg.week <= 15) & mg.homePoints.notna()
       & (mg.season >= 2021) & (mg.season <= 2025)][
    ["season", "week", "homeTeam", "awayTeam", "homePoints", "awayPoints"]].copy()
g["atotal"] = g.homePoints + g.awayPoints
ogf = pd.read_parquet(DATA / "odds_game_frame.parquet")[
    ["season", "home", "away", "open_total", "close_total"]]
g = g.merge(ogf, left_on=["season", "homeTeam", "awayTeam"],
            right_on=["season", "home", "away"], how="inner").dropna(subset=["close_total"])
_ov = (g.atotal > g.close_total).mean()
assert 0.42 < _ov < 0.58, f"total sign guard {_ov:.3f}"

def cval(s, w, t, col):
    try: return core.loc[(s, w - 1, t), col]
    except KeyError: return np.nan
def oval(s, w, t, col):
    try: return ours.loc[(s, w - 1, t), col]
    except KeyError: return np.nan

g["c_off"] = [cval(s,w,h,"off") + cval(s,w,a,"off") for s,w,h,a in zip(g.season,g.week,g.homeTeam,g.awayTeam)]
g["c_def"] = [cval(s,w,h,"dfn") + cval(s,w,a,"dfn") for s,w,h,a in zip(g.season,g.week,g.homeTeam,g.awayTeam)]
g["o_off"] = [oval(s,w,h,"adj_epa") + oval(s,w,a,"adj_epa") for s,w,h,a in zip(g.season,g.week,g.homeTeam,g.awayTeam)]
g["o_def"] = [oval(s,w,h,"adj_epa_allowed") + oval(s,w,a,"adj_epa_allowed") for s,w,h,a in zip(g.season,g.week,g.homeTeam,g.awayTeam)]
g = g.dropna(subset=["c_off", "c_def", "o_off", "o_def"])
print(f"frame: {len(g)} games")

def run(name, f1, f2):
    preds = pd.Series(np.nan, index=g.index)
    for S in sorted(g.season.unique()):
        tr = g[g.season < S]
        if len(tr) < 200: tr = g[g.season != S]
        X = np.column_stack([tr[f1], tr[f2], np.ones(len(tr))])
        beta, *_ = np.linalg.lstsq(X, tr.atotal, rcond=None)
        m = g.season == S
        preds[m] = beta[0]*g.loc[m,f1] + beta[1]*g.loc[m,f2] + beta[2]
    g[f"{name}_hat"] = preds
    print(f"\n===== {name} implied total (MAE {np.abs(preds - g.atotal).mean():.2f} "
          f"vs market {np.abs(g.close_total - g.atotal).mean():.2f}) =====")
    for lc in ("close_total", "open_total"):
        dd = g.dropna(subset=[lc])
        e = dd[f"{name}_hat"] - dd[lc]
        line = f"  vs {lc.split('_')[0]:5s}: "
        for rung in (2, 4, 6):
            m = e.abs() >= rung
            d = dd[m]; res = d.atotal - d[lc]
            win = np.where(e[m] > 0, res > 0, res < 0); push = res == 0
            by = pd.Series(win[~push]).groupby(d.season.values[~push]).mean()*100
            line += f"| >={rung}: {100*win[~push].mean():.1f}% n={int((~push).sum())} "
        print(line)
        if lc == "close_total":
            m = e.abs() >= 4
            d = dd[m]; res = d.atotal - d[lc]
            win = np.where(e[m] > 0, res > 0, res < 0); push = res == 0
            by = pd.Series(win[~push]).groupby(d.season.values[~push]).mean()*100
            print("    >=4 by season: " + " ".join(f"{int(s)}:{v:.0f}" for s,v in by.items()))

run("CORE", "c_off", "c_def")
run("OURS", "o_off", "o_def")
