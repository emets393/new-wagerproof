"""CORE movers (test 2 of the as-of archive): does the market lag fast in-season
rating CHANGES? Pre-registered: delta = overall[thru W-1] - overall[thru W-4]
(3-week change); matchup edge = home_delta - away_delta; bet the faster-improving
side at rungs 3/5/8; weeks 8-15 (need W-4 >= 4), 2021-2025; graded vs close AND
open; per-season; sign guard. Levels are priced (test 1) — this isolates the
change component."""
import numpy as np, pandas as pd
from pathlib import Path
DATA = Path(__file__).resolve().parent / "data"

core = pd.read_parquet(DATA / "cfbd" / "core_asof.parquet")
C = core.set_index(["season", "thru_week", "team"]).overall
mg = pd.read_parquet(DATA / "model_games.parquet")
g = mg[(mg.week >= 8) & (mg.week <= 15) & mg.homePoints.notna()
       & (mg.season >= 2021) & (mg.season <= 2025)][
    ["season", "week", "homeTeam", "awayTeam", "homePoints", "awayPoints"]].copy()
g["margin"] = g.homePoints - g.awayPoints
ogf = pd.read_parquet(DATA / "odds_game_frame.parquet")[
    ["season", "home", "away", "open_spread", "close_spread"]]
g = g.merge(ogf, left_on=["season", "homeTeam", "awayTeam"],
            right_on=["season", "home", "away"], how="inner").dropna(subset=["close_spread"])
_fav = g[g.close_spread < 0]
assert 0.42 < ((_fav.margin + _fav.close_spread) > 0).mean() < 0.58

def delta(s, w, t):
    try: return C.loc[(s, w - 1, t)] - C.loc[(s, w - 4, t)]
    except KeyError: return np.nan

g["dh"] = [delta(s, w, t) for s, w, t in zip(g.season, g.week, g.homeTeam)]
g["da"] = [delta(s, w, t) for s, w, t in zip(g.season, g.week, g.awayTeam)]
g = g.dropna(subset=["dh", "da"])
g["edge"] = g.dh - g.da
print(f"frame: {len(g)} games (wks 8-15, 2021-25) | edge sd {g.edge.std():.1f}")
for lc in ("close_spread", "open_spread"):
    print(f"--- vs {lc.split('_')[0]} ---")
    dd = g.dropna(subset=[lc])
    for rung in (3, 5, 8):
        m = dd.edge.abs() >= rung
        d = dd[m]; ch = d.margin + d[lc]
        win = np.where(d.edge > 0, ch > 0, ch < 0); push = ch == 0
        by = pd.Series(win[~push]).groupby(d.season.values[~push]).mean() * 100
        print(f"  >={rung} riser-side {100*win[~push].mean():5.1f}% n={int((~push).sum()):4d}  "
              + " ".join(f"{int(s)}:{v:.0f}" for s, v in by.items()))
