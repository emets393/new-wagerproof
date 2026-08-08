"""Regime-family rating-source horse race: TR preseason vs prior-season CORE.

Same registered rule as the live signals (weeks 1-3, |rating-implied minus
market-implied| >= 2, new-HC conditioning), graded vs the Odds-API close AND open,
2021-2025 (consistent line source; CORE S-1 available from 2017 but odds start 2021).

  fade cell   : rating leans on the NEW-HC team -> bet the other side
  follow cell : rating leans on a stable team vs a NEW-HC opponent -> ride it
  anti-control: betting the fade cell the WRONG way should be ~100-fade%
"""
import numpy as np
import pandas as pd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
HFA = 2.5

mg = pd.read_parquet(DATA / "model_games.parquet")
g = mg[(mg.week <= 3) & mg.homePoints.notna() & (mg.season >= 2021) & (mg.season <= 2025)][
    ["season", "week", "homeTeam", "awayTeam", "homePoints", "awayPoints"]].copy()
g["margin"] = g.homePoints - g.awayPoints
ogf = pd.read_parquet(DATA / "odds_game_frame.parquet")[
    ["season", "home", "away", "open_spread", "close_spread"]]
g = g.merge(ogf, left_on=["season", "homeTeam", "awayTeam"],
            right_on=["season", "home", "away"], how="inner")
g = g.dropna(subset=["close_spread"])
_fav = g[g.close_spread < 0]
assert 0.42 < ((_fav.margin + _fav.close_spread) > 0).mean() < 0.58, "sign guard"

# ratings
tr = pd.read_parquet(DATA / "cfbd" / "preseason_tr_mapped.parquet")
TR = tr.set_index(["season", "team"]).tr_rating
core = pd.read_parquet(DATA / "cfbd" / "core_ratings.parquet")
CORE = core.set_index(["year", "team"]).overall  # S-1 lookup below

# new-HC flags from coach history
cs = pd.read_parquet(DATA / "cfbd" / "coach_seasons.parquet")
cs = cs.sort_values("games", ascending=False).drop_duplicates(["year", "school"])
HC = cs.set_index(["year", "school"]).coach
def new_hc(season, team):
    a, b = HC.get((season, team)), HC.get((season - 1, team))
    return None if (a is None or b is None) else (a != b)

def run(name, get_rating):
    print(f"\n===== rating source: {name} =====")
    d = g.copy()
    d["rh"] = [get_rating(s, t) for s, t in zip(d.season, d.homeTeam)]
    d["ra"] = [get_rating(s, t) for s, t in zip(d.season, d.awayTeam)]
    d = d.dropna(subset=["rh", "ra"])
    d["gap"] = (d.rh - d.ra + HFA) - (-d.close_spread)
    d = d[d.gap.abs() >= 2].copy()
    d["rated_home"] = d.gap > 0
    d["rated_team"] = np.where(d.rated_home, d.homeTeam, d.awayTeam)
    d["opp_team"] = np.where(d.rated_home, d.awayTeam, d.homeTeam)
    d["rated_new"] = [new_hc(s, t) for s, t in zip(d.season, d.rated_team)]
    d["opp_new"] = [new_hc(s, t) for s, t in zip(d.season, d.opp_team)]
    d = d.dropna(subset=["rated_new", "opp_new"])

    for lc in ("close_spread", "open_spread"):
        dd = d.dropna(subset=[lc])
        ch = dd.margin + dd[lc]
        rated_covers = np.where(dd.rated_home, ch > 0, ch < 0)
        push = ch == 0
        cells = {
            "FADE (rated team new HC)": (dd.rated_new.values.astype(bool)
                                         & ~dd.opp_new.values.astype(bool), False),
            "FOLLOW (opp new HC)":      (~dd.rated_new.values.astype(bool)
                                         & dd.opp_new.values.astype(bool), True),
            "control (no new HC)":      (~dd.rated_new.values.astype(bool)
                                         & ~dd.opp_new.values.astype(bool), True),
        }
        print(f"  --- graded vs {lc.split('_')[0]} ---")
        for lab, (m, bet_rated) in cells.items():
            mm = m & ~push
            if mm.sum() < 5:
                print(f"  {lab:26s} n={int(mm.sum())} (thin)"); continue
            win = rated_covers[mm] if bet_rated else ~rated_covers[mm]
            by = pd.Series(win).groupby(dd.season.values[mm]).mean() * 100
            print(f"  {lab:26s} {100*win.mean():5.1f}%  n={int(mm.sum()):3d}  "
                  + " ".join(f"{int(s)}:{v:.0f}" for s, v in by.items()))

run("TR preseason (as-of Aug)", lambda s, t: TR.get((s, t), np.nan))
run("CORE prior-season final", lambda s, t: CORE.get((s - 1, t), np.nan))
