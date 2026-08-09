"""CORE test 3: OUR internal as-of ratings vs the CORE-proxy — disagreement study.

Two independent opponent-adjustment systems over the same games. Per game (wks 5-15,
2021-25), each system's implied home margin = slope*rating_diff + HFA, slope fit
walk-forward on seasons < S (leak-safe; ratings at thru_week = game_week - 1).
  A) agreement: corr of implied margins
  B) accuracy by disagreement decile: when the two systems disagree hardest, whose
     implied margin lands closer to the actual result?
  C) betting cell: in high-disagreement games, back OURS vs back CORE against the
     close where each has edge >= 3 — who wins?
"""
import numpy as np, pandas as pd
from pathlib import Path
DATA = Path(__file__).resolve().parent / "data"

ours = pd.read_parquet(DATA / "team_ratings_asof.parquet")
ours["net"] = ours["adj_epa"] - ours["adj_epa_allowed"]
O = ours.set_index(["season", "asof_week", "team"]).net
core = pd.read_parquet(DATA / "cfbd" / "core_asof.parquet")
C = core.set_index(["season", "thru_week", "team"]).overall

mg = pd.read_parquet(DATA / "model_games.parquet")
g = mg[(mg.week >= 5) & (mg.week <= 15) & mg.homePoints.notna()
       & (mg.season >= 2021) & (mg.season <= 2025)][
    ["season", "week", "homeTeam", "awayTeam", "homePoints", "awayPoints"]].copy()
g["margin"] = g.homePoints - g.awayPoints
ogf = pd.read_parquet(DATA / "odds_game_frame.parquet")[["season", "home", "away", "close_spread"]]
g = g.merge(ogf, left_on=["season", "homeTeam", "awayTeam"],
            right_on=["season", "home", "away"], how="inner").dropna(subset=["close_spread"])
_fav = g[g.close_spread < 0]
assert 0.42 < ((_fav.margin + _fav.close_spread) > 0).mean() < 0.58

def get(idx, s, w, t):
    try: return idx.loc[(s, w - 1, t)]
    except KeyError: return np.nan
g["od"] = [get(O, s, w, h) - get(O, s, w, a) for s, w, h, a in zip(g.season, g.week, g.homeTeam, g.awayTeam)]
g["cd"] = [get(C, s, w, h) - get(C, s, w, a) for s, w, h, a in zip(g.season, g.week, g.homeTeam, g.awayTeam)]
g = g.dropna(subset=["od", "cd"])

# walk-forward slope calibration to points for each system
for col, out in (("od", "ours_m"), ("cd", "core_m")):
    preds = pd.Series(np.nan, index=g.index)
    for S in sorted(g.season.unique()):
        tr = g[g.season < S]
        if len(tr) < 200:
            tr = g[g.season != S]  # first season: pooled-others fallback (calibration only)
        b1, b0 = np.polyfit(tr[col], tr.margin, 1)
        m = g.season == S
        preds[m] = b0 + b1 * g.loc[m, col]
    g[out] = preds

print(f"frame: {len(g)} games | A) corr(implied margins) = {np.corrcoef(g.ours_m, g.core_m)[0,1]:.3f}")
g["dis"] = g.ours_m - g.core_m
print(f"   disagreement sd = {g.dis.std():.2f} pts | mean |dis| = {g.dis.abs().mean():.2f}")

print("\nB) accuracy by |disagreement| bucket (MAE vs actual margin):")
g["bucket"] = pd.qcut(g.dis.abs(), [0, .5, .8, 1.0], labels=["low", "mid", "TOP20%"])
for b, d in g.groupby("bucket"):
    mo = (d.ours_m - d.margin).abs().mean(); mc = (d.core_m - d.margin).abs().mean()
    ml = (-d.close_spread - d.margin).abs().mean()
    print(f"   {b:7s} n={len(d):4d}  OURS {mo:5.2f} | CORE {mc:5.2f} | market {ml:5.2f}")

print("\nC) betting in TOP-20% disagreement games (edge >= 3 vs close):")
top = g[g.bucket == "TOP20%"].copy()
for name, mcol in (("back OURS", "ours_m"), ("back CORE", "core_m")):
    e = top[mcol] - (-top.close_spread)
    m = e.abs() >= 3
    d = top[m]; ch = d.margin + d.close_spread
    win = np.where(e[m] > 0, ch > 0, ch < 0); push = ch == 0
    by = pd.Series(win[~push]).groupby(d.season.values[~push]).mean() * 100
    print(f"   {name:10s} {100*win[~push].mean():5.1f}% n={int((~push).sum()):4d}  "
          + " ".join(f"{int(s)}:{v:.0f}" for s, v in by.items()))
