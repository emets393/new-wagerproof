"""CFB TOTALS MAMMOTH dig (owner request): stack INDEPENDENT total mechanisms and
measure the dose-response — the mammoth recipe (confluence, not filter-mining).

Layers (each independently motivated, all as-of/leak-safe, wks 5-15 2021-25):
  L1  CORE-implied total >=4 off the close (validated today: 54.1% alone)
  L2  STEAM AGREES: open->close moved >=0.5 in the SAME direction as L1's side
      (market microstructure — independent of ratings; the prop-confluence law)
  L3  EXTREMITY: closing total in the seasonal top/bottom decile AND L1 fades the
      extreme (bet under high lines / over low lines — mean-reversion family)
Ladder: L1 -> L1+L2 -> L1+L2+L3 (and L1+L3). Per-season + ROI."""
import numpy as np, pandas as pd
from pathlib import Path
DATA = Path(__file__).resolve().parent / "data"

core = pd.read_parquet(DATA / "cfbd" / "core_asof.parquet").set_index(["season", "thru_week", "team"])
mg = pd.read_parquet(DATA / "model_games.parquet")
g = mg[(mg.week >= 5) & (mg.week <= 15) & mg.homePoints.notna()
       & (mg.season >= 2021) & (mg.season <= 2025)][
    ["season", "week", "homeTeam", "awayTeam", "homePoints", "awayPoints"]].copy()
g["atotal"] = g.homePoints + g.awayPoints
ogf = pd.read_parquet(DATA / "odds_game_frame.parquet")[
    ["season", "home", "away", "open_total", "close_total"]]
g = g.merge(ogf, left_on=["season", "homeTeam", "awayTeam"],
            right_on=["season", "home", "away"], how="inner").dropna(subset=["close_total", "open_total"])
assert 0.42 < (g.atotal > g.close_total).mean() < 0.58

def cval(s, w, t, col):
    try: return core.loc[(s, w - 1, t), col]
    except KeyError: return np.nan
g["c_off"] = [cval(s,w,h,"off")+cval(s,w,a,"off") for s,w,h,a in zip(g.season,g.week,g.homeTeam,g.awayTeam)]
g["c_def"] = [cval(s,w,h,"dfn")+cval(s,w,a,"dfn") for s,w,h,a in zip(g.season,g.week,g.homeTeam,g.awayTeam)]
g = g.dropna(subset=["c_off", "c_def"])
# frozen calibration (same betas as the live signal)
g["hat"] = 0.2285*g.c_off + 0.2547*g.c_def + 53.95
g["edge"] = g.hat - g.close_total
g["side_over"] = g.edge > 0
g["move"] = g.close_total - g.open_total          # + = market moved the total UP
g["steam_agree"] = np.where(g.side_over, g.move >= 0.5, g.move <= -0.5)
# extremity deciles within season
g["hi_dec"] = g.groupby("season").close_total.transform(lambda s: s.quantile(0.90))
g["lo_dec"] = g.groupby("season").close_total.transform(lambda s: s.quantile(0.10))
g["extreme_fade"] = np.where(g.side_over, g.close_total <= g.lo_dec, g.close_total >= g.hi_dec)

def grade(d, lab):
    res = d.atotal - d.close_total
    win = np.where(d.side_over, res > 0, res < 0); push = res == 0
    w = win[~push]; n = len(w)
    if n < 8:
        print(f"  {lab:34s} n={n} (thin)"); return
    by = pd.Series(w).groupby(d.season.values[~push]).mean() * 100
    roi = (w.mean()*(100/110+1)-1)*100
    print(f"  {lab:34s} {100*w.mean():5.1f}%  n={n:4d}  ROI {roi:+5.1f}%  "
          + " ".join(f"{int(s)}:{v:.0f}" for s, v in by.items()))

base = g[g.edge.abs() >= 4]
print("CFB TOTALS mammoth ladder (wks 5-15, 2021-25):")
grade(base, "L1  CORE edge >=4")
grade(base[base.edge.abs() >= 7], "L1+ CORE edge >=7")
grade(base[base.steam_agree], "L1+L2 steam agrees")
grade(base[base.steam_agree & (base.edge.abs() >= 7)], "L1(>=7)+L2 steam")
grade(base[base.extreme_fade], "L1+L3 extreme fade")
grade(base[base.steam_agree & base.extreme_fade], "L1+L2+L3 (full stack)")
grade(base[(base.edge.abs() >= 7) & base.steam_agree & base.extreme_fade], "MAX stack (>=7 + steam + extreme)")
