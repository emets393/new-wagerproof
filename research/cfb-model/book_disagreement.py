"""
CROSS-BOOK exploit: when a SHARP book (William Hill) and a SOFT book (MyBookie / Bovada) disagree on the
CLOSE spread, bet the SHARP-favored side AT THE SOFT BOOK'S number, grade at the SOFT number (what you'd
actually bet). If the sharp book leads, this wins AND you got the better number.

sharp leans HOME if sharp_home_spread < soft_home_spread (sharp has home as bigger fav).
Bet that side at the SOFT number:
  lean home -> cover if actual_margin + soft_spread > 0
  lean away -> cover if -(actual_margin + soft_spread) > 0
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

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0]); d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
od = pd.concat(parts, ignore_index=True)
od["home_c"] = od.home_team.map(to_cfbd); od["away_c"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home_c", "away_c", "hrs_to_kick"]); od = od[od.hrs_to_kick >= 0]
idx = od.groupby(["season", "game_id", "book"]).hrs_to_kick.idxmin()
close = od.loc[idx, ["season", "game_id", "home_c", "away_c", "book", "spread_home", "hrs_to_kick"]].copy()
close = close[close.hrs_to_kick < 12].dropna(subset=["spread_home"])
mg = gm[["season", "homeTeam", "awayTeam", "actual_margin"]].rename(columns={"homeTeam": "home_c", "awayTeam": "away_c"})

def pivot(book):
    b = close[close.book == book][["season", "game_id", "home_c", "away_c", "spread_home"]]
    return b.rename(columns={"spread_home": book})

wh = pivot("williamhill_us")
TS = [2021, 2022, 2023, 2024, 2025]
def run(softbook, sharp="williamhill_us", sharpf=wh):
    sb = pivot(softbook)
    m = sharpf.merge(sb, on=["season", "game_id", "home_c", "away_c"], how="inner").merge(
        mg.rename(columns={"homeTeam": "home_c", "awayTeam": "away_c"}), on=["season", "home_c", "away_c"], how="inner")
    m["gap"] = m[sharp] - m[softbook]   # sharp - soft ; <0 sharp leans home
    print(f"\n=== SHARP={sharp}  vs  SOFT={softbook}  (n_paired={len(m)}) ===")
    for thr in [0.5, 1.0, 1.5, 2.0]:
        d = m[m.gap.abs() >= thr].copy()
        if len(d) < 30: continue
        lean_home = d.gap < 0
        # grade at SOFT number
        res = np.where(lean_home, d.actual_margin + d[softbook], -(d.actual_margin + d[softbook]))
        nz = res != 0; dd = d[nz]; r = res[nz]; n = len(dd); w = int((r > 0).sum())
        per = "/".join(f"{100*(r[dd.season.values==s]>0).mean():.0f}" if (dd.season.values==s).sum()>=8 else "--" for s in TS)
        print(f"  gap>={thr}: n={n:<4} bet-sharp-side@soft covers {100*w/n:.1f}% roi {roi(w,n):+.1f} [{per}]")

run("mybookieag")
run("bovada")
# also: combine both soft books — bet when sharp disagrees with EITHER, take whichever soft number
