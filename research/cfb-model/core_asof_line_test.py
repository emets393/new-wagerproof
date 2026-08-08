"""First test of the reconstructed as-of CORE archive: in-season rating vs the line.

Pre-registered: games weeks 5-15, seasons 2021-2025 (Odds-API line coverage);
rating = core_asof at thru_week = game_week - 1 (leak rule); implied margin =
overall diff + 2.5 HFA (0 at neutral sites); bet the side the rating favors at
edge rungs 2/4/6/8; graded vs close AND open; per-season + early(5-7)/late(8+)
phase split. Expectation from canon: naive rating-vs-line loses — this
establishes the baseline before conditional derivatives.
"""
import numpy as np
import pandas as pd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
HFA = 2.5

core = pd.read_parquet(DATA / "cfbd" / "core_asof.parquet")
C = core.set_index(["season", "thru_week", "team"]).overall

mg = pd.read_parquet(DATA / "model_games.parquet")
g = mg[(mg.week >= 5) & (mg.week <= 15) & mg.homePoints.notna()
       & (mg.season >= 2021) & (mg.season <= 2025)][
    ["season", "week", "homeTeam", "awayTeam", "homePoints", "awayPoints", "neutralSite"]].copy()
g["margin"] = g.homePoints - g.awayPoints
g["neutral"] = g.neutralSite.fillna(False).astype(bool)
ogf = pd.read_parquet(DATA / "odds_game_frame.parquet")[
    ["season", "home", "away", "open_spread", "close_spread"]]
g = g.merge(ogf, left_on=["season", "homeTeam", "awayTeam"],
            right_on=["season", "home", "away"], how="inner").dropna(subset=["close_spread"])
_fav = g[g.close_spread < 0]
assert 0.42 < ((_fav.margin + _fav.close_spread) > 0).mean() < 0.58, "sign guard"

def rate(s, w, t):
    try: return C.loc[(s, w - 1, t)]
    except KeyError: return np.nan

g["rh"] = [rate(s, w, t) for s, w, t in zip(g.season, g.week, g.homeTeam)]
g["ra"] = [rate(s, w, t) for s, w, t in zip(g.season, g.week, g.awayTeam)]
g = g.dropna(subset=["rh", "ra"])
g["implied"] = g.rh - g.ra + np.where(g.neutral, 0.0, HFA)
g["edge"] = g.implied - (-g.close_spread)

print(f"frame: {len(g)} games, weeks 5-15, 2021-2025")
for lc in ("close_spread", "open_spread"):
    print(f"\n--- graded vs {lc.split('_')[0]} ---")
    print(f"{'rung':>6s} {'ats%':>6s} {'n':>5s}  per-season")
    dd = g.dropna(subset=[lc])
    for rung in (2, 4, 6, 8):
        m = dd.edge.abs() >= rung
        d = dd[m]
        ch = d.margin + d[lc]
        win = np.where(d.edge > 0, ch > 0, ch < 0)
        push = ch == 0
        by = pd.Series(win[~push]).groupby(d.season.values[~push]).mean() * 100
        print(f"  >={rung:2d} {100*win[~push].mean():5.1f}% {int((~push).sum()):5d}  "
              + " ".join(f"{int(s)}:{v:.0f}" for s, v in by.items()))

print("\n--- phase split (>=4 edge, vs close) ---")
for lab, m in (("weeks 5-7", g.week <= 7), ("weeks 8+", g.week >= 8)):
    d = g[m & (g.edge.abs() >= 4)]
    ch = d.margin + d.close_spread
    win = np.where(d.edge > 0, ch > 0, ch < 0); push = ch == 0
    print(f"  {lab:10s} {100*win[~push].mean():5.1f}%  n={int((~push).sum())}")
