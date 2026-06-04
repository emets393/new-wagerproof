"""
Book SHARPNESS per year. For each book: coverage, closing-line predictiveness (MAE of close spread vs
actual margin; close total vs actual total), and deviation from the cross-book consensus close.
Soft book = worse predictiveness AND/OR larger deviation from consensus (= exploitable off-numbers).
"""
import os, glob
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
cfbd = sorted(set(gm.homeTeam) | set(gm.awayTeam))
ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
         "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
         "Southern Miss Golden Eagles": "Southern Miss"}
def to_cfbd(o):
    if o in ALIAS: return ALIAS[o]
    c = [x for x in cfbd if o.startswith(x + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0]); d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
od = pd.concat(parts, ignore_index=True)
od["home_c"] = od.home_team.map(to_cfbd); od["away_c"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home_c", "away_c", "hrs_to_kick"])
od = od[od.hrs_to_kick >= 0]

# per book per game: CLOSE spread/total (last pre-kick snapshot for that book)
idx = od.groupby(["season", "game_id", "book"]).hrs_to_kick.idxmin()
close = od.loc[idx, ["season", "game_id", "home_c", "away_c", "book", "spread_home", "total", "hrs_to_kick"]].copy()
# join outcomes
mg = gm[["season", "homeTeam", "awayTeam", "actual_margin", "actual_total"]].rename(columns={"homeTeam": "home_c", "awayTeam": "away_c"})
close = close.merge(mg, on=["season", "home_c", "away_c"], how="inner")
close = close[close.hrs_to_kick < 12]
# consensus per game (median across books)
cons = close.groupby(["season", "game_id"]).agg(cons_sp=("spread_home", "median"), cons_tot=("total", "median")).reset_index()
close = close.merge(cons, on=["season", "game_id"])
close["sp_dev"] = (close.spread_home - close.cons_sp).abs()
close["tot_dev"] = (close.total - close.cons_tot).abs()
close["sp_err"] = (-close.spread_home - close.actual_margin).abs()    # close-spread predictiveness
close["tot_err"] = (close.total - close.actual_total).abs()

print("=== BOOK SHARPNESS by year (coverage, spread MAE vs outcome, dev from consensus) ===")
for yr in [2021, 2022, 2023, 2024, 2025]:
    y = close[close.season == yr]
    g = y.groupby("book").agg(n=("game_id", "nunique"), sp_mae=("sp_err", "mean"), sp_dev=("sp_dev", "mean"),
                              tot_mae=("tot_err", "mean"), tot_dev=("tot_dev", "mean")).reset_index()
    g = g[g.n >= 100].sort_values("sp_dev", ascending=False)
    print(f"\n-- {yr} (books with >=100 games) --  [higher sp_dev / sp_mae = softer]")
    print(f"{'book':<16}{'n':>6}{'sp_MAE':>8}{'sp_dev':>8}{'tot_MAE':>9}{'tot_dev':>8}")
    for _, r in g.iterrows():
        print(f"{r.book:<16}{int(r.n):>6}{r.sp_mae:>8.2f}{r.sp_dev:>8.2f}{r.tot_mae:>9.2f}{r.tot_dev:>8.2f}")
