"""
SHARP-CONSENSUS vs SOFT-CONSENSUS spread exploit (more robust than single-book WH-vs-Bovada).
SHARP blend = median close spread across {williamhill_us, twinspires, draftkings} present that game.
SOFT  blend = median close spread across {bovada, mybookieag} present that game.
When sharp_cons - soft_cons gap >= thresh, bet the SHARP-favored side AT THE SOFT number, grade @ soft.
Also grade @ BEST soft number (real-world: take the most favorable soft book on the side you bet).
Require >=2 sharp books + >=1 soft book per game (degrades gracefully).
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
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0

SHARP = ["williamhill_us", "twinspires", "draftkings"]
SOFT = ["bovada", "mybookieag"]
TS = [2021, 2022, 2023, 2024, 2025]

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0]); d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
od = pd.concat(parts, ignore_index=True)
od["home_c"] = od.home_team.map(to_cfbd); od["away_c"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home_c", "away_c", "hrs_to_kick"]); od = od[od.hrs_to_kick >= 0]
idx = od.groupby(["season", "game_id", "book"]).hrs_to_kick.idxmin()
close = od.loc[idx, ["season", "game_id", "home_c", "away_c", "book", "spread_home", "hrs_to_kick"]].copy()
close = close[(close.hrs_to_kick < 12)].dropna(subset=["spread_home"])
mg = gm[["season", "homeTeam", "awayTeam", "actual_margin"]].rename(columns={"homeTeam": "home_c", "awayTeam": "away_c"})

g = close.groupby(["season", "game_id", "home_c", "away_c"])
def blend(books):
    sub = close[close.book.isin(books)]
    return sub.groupby(["season", "game_id", "home_c", "away_c"]).agg(
        med=("spread_home", "median"), nb=("book", "nunique"),
        best_home=("spread_home", "max"), best_away=("spread_home", "min"))  # max home_spread = best for home bettor
sh = blend(SHARP).rename(columns={"med": "sharp", "nb": "n_sharp"})
sf = blend(SOFT).rename(columns={"med": "soft", "nb": "n_soft", "best_home": "soft_best_home", "best_away": "soft_best_away"})
m = sh.reset_index().merge(sf.reset_index(), on=["season", "game_id", "home_c", "away_c"]).merge(
    mg, on=["season", "home_c", "away_c"])
m = m[(m.n_sharp >= 2) & (m.n_soft >= 1)].copy()
m["gap"] = m.sharp - m.soft   # <0 sharp leans home
print(f"paired games (>=2 sharp, >=1 soft): {len(m)}  | sharp={SHARP} soft={SOFT}\n")

def report(label, soft_num_home, soft_num_away):
    print(f"=== {label} ===")
    print(f"{'gap':>7}{'n':>6}{'cover%':>8}{'roi':>7}   per-season")
    for thr in [0.5, 1.0, 1.5, 2.0]:
        d = m[m.gap.abs() >= thr].copy()
        if len(d) < 30: continue
        lean_home = d.gap < 0
        num = np.where(lean_home, soft_num_home[d.index], soft_num_away[d.index])
        res = np.where(lean_home, d.actual_margin + num, -(d.actual_margin + num))
        nz = res != 0; dd = d[nz]; r = res[nz]; n = len(dd); w = int((r > 0).sum())
        per = "/".join(f"{100*(r[dd.season.values==s]>0).mean():.0f}" if (dd.season.values==s).sum()>=8 else "--" for s in TS)
        print(f"{thr:>7}{n:>6}{100*w/n:>8.1f}{roi(w,n):>7.1f}   [{per}]")
    print()

report("Grade @ SOFT-CONSENSUS number (conservative)", m.soft, m.soft)
report("Grade @ BEST soft number on the side bet (real-world)", m.soft_best_home, m.soft_best_away)

# robustness: also show single sharpest (WH) vs soft-consensus, and how often a bet triggers per year
print("=== trigger frequency (gap>=1.0) per season ===")
d = m[m.gap.abs() >= 1.0]
print(d.groupby("season").size().to_string())
