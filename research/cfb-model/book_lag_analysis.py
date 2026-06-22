"""
LAG / STALE-NUMBER analysis. Does the SOFT book lag the SHARP book intraday? If so we can snipe the soft book's
stale number HOURS before close (not just at close).

Snapshots: get each book's spread at T=24h pre-kick (nearest snap in [16,34]h) and at CLOSE (<12h, last).
SHARP = median{williamhill_us,twinspires,draftkings}; SOFT = median{bovada,mybookieag}.

Three tests:
  A. LAG CONFIRM: between T24 and close, does SOFT move TOWARD where SHARP already was at T24?
     catch_up = (soft_close - soft_T24) vs target (sharp_T24 - soft_T24). If soft chases sharp -> lag.
  B. TRADABLE@24h: at T24, gap = sharp_T24 - soft_T24. Bet SHARP-favored side AT soft_T24 number,
     grade at OUTCOME (covers ATS). = can we bet 24h early at the stale soft number and win.
  C. CLV: does the soft number at T24 beat the soft CLOSING number (we got a better price by being early)?
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
od = od.dropna(subset=["home_c", "away_c", "hrs_to_kick", "spread_home"]); od = od[od.hrs_to_kick >= 0]

def at_window(df, lo, hi, target):
    w = df[(df.hrs_to_kick >= lo) & (df.hrs_to_kick <= hi)].copy()
    w["d"] = (w.hrs_to_kick - target).abs()
    i = w.groupby(["season", "game_id", "book"]).d.idxmin()
    return w.loc[i, ["season", "game_id", "home_c", "away_c", "book", "spread_home", "hrs_to_kick"]]

t24 = at_window(od, 16, 34, 24).rename(columns={"spread_home": "sp24"})
# close = last snapshot < 12h
cl = od[od.hrs_to_kick < 12].copy()
ci = cl.groupby(["season", "game_id", "book"]).hrs_to_kick.idxmin()
clz = cl.loc[ci, ["season", "game_id", "home_c", "away_c", "book", "spread_home"]].rename(columns={"spread_home": "spC"})

j = t24.merge(clz, on=["season", "game_id", "home_c", "away_c", "book"], how="inner")

def blend(df, col, books):
    sub = df[df.book.isin(books)]
    return sub.groupby(["season", "game_id", "home_c", "away_c"]).agg(
        v=(col, "median"), nb=("book", "nunique"),
        best_home=(col, "max"), best_away=(col, "min"))

sh24 = blend(j, "sp24", SHARP).rename(columns={"v": "sharp24", "nb": "ns24"})
sf24 = blend(j, "sp24", SOFT).rename(columns={"v": "soft24", "nb": "nf24", "best_home": "soft24_bh", "best_away": "soft24_ba"})
sfC = blend(j, "spC", SOFT).rename(columns={"v": "softC", "nb": "nfC"})
shC = blend(j, "spC", SHARP).rename(columns={"v": "sharpC"})

m = (sh24.reset_index().merge(sf24.reset_index(), on=["season", "game_id", "home_c", "away_c"])
     .merge(sfC.reset_index()[["season", "game_id", "home_c", "away_c", "softC"]], on=["season", "game_id", "home_c", "away_c"])
     .merge(shC.reset_index()[["season", "game_id", "home_c", "away_c", "sharpC"]], on=["season", "game_id", "home_c", "away_c"])
     .merge(gm[["season", "homeTeam", "awayTeam", "actual_margin"]].rename(columns={"homeTeam": "home_c", "awayTeam": "away_c"}),
            on=["season", "home_c", "away_c"]))
m = m[(m.ns24 >= 2) & (m.nf24 >= 1)].copy()
m["gap24"] = m.sharp24 - m.soft24       # at 24h: sharp - soft (<0 sharp leans home)
print(f"paired games (24h, >=2 sharp >=1 soft): {len(m)}\n")

# ---- A. LAG CONFIRM ----
print("=== A. LAG: when sharp & soft disagree @24h, does SOFT chase sharp by close? ===")
d = m[m.gap24.abs() >= 0.5].copy()
target = d.sharp24 - d.soft24            # how far soft must move to reach where sharp was @24h
actual_move = d.softC - d.soft24         # how far soft actually moved by close
chase = actual_move * np.sign(target)    # >0 = soft moved toward sharp's @24h position
print(f"  n(gap>=0.5)={len(d)} | soft moved TOWARD sharp's 24h line {100*(chase>0).mean():.1f}% of the time")
print(f"  avg soft catch-up = {chase.mean():.2f} pts (of {target.abs().mean():.2f} needed) | sharp also moved {(d.sharpC-d.sharp24).abs().mean():.2f}")

# ---- B. TRADABLE @ 24h ----
def trade(label, num_home, num_away, frame):
    print(f"\n=== {label} ===")
    print(f"{'gap24':>7}{'n':>6}{'cover%':>8}{'roi':>7}   per-season")
    for thr in [0.5, 1.0, 1.5]:
        d = frame[frame.gap24.abs() >= thr].copy()
        if len(d) < 30: continue
        lean_home = d.gap24 < 0
        num = np.where(lean_home, num_home[d.index], num_away[d.index])
        res = np.where(lean_home, d.actual_margin + num, -(d.actual_margin + num))
        nz = res != 0; dd = d[nz]; r = res[nz]; n = len(dd); w = int((r > 0).sum())
        per = "/".join(f"{100*(r[dd.season.values==s]>0).mean():.0f}" if (dd.season.values==s).sum()>=8 else "--" for s in TS)
        print(f"{thr:>7}{n:>6}{100*w/n:>8.1f}{roi(w,n):>7.1f}   [{per}]")

trade("B. BET @24h at soft-24h MEDIAN number, grade @ outcome", m.soft24, m.soft24, m)
trade("B2. BET @24h at BEST soft-24h number (line-shop), grade @ outcome", m.soft24_bh, m.soft24_ba, m)

# ---- C. CLV: did betting @24h beat the soft CLOSE number? ----
print("\n=== C. CLV: soft-24h number vs soft-CLOSE number on the side we bet (gap>=1.0) ===")
d = m[m.gap24.abs() >= 1.0].copy()
lean_home = d.gap24 < 0
# home bet: better = more positive home spread (we want soft24 >= softC). away bet: better = more negative.
clv = np.where(lean_home, d.soft24 - d.softC, d.softC - d.soft24)
print(f"  n={len(d)} | bet @24h gave better number than soft close {100*(clv>0).mean():.1f}% of time, avg {clv.mean():+.2f} pts")
