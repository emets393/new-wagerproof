"""
Extend the soft-book exploit to TOTALS and MONEYLINE.
TOTALS: when sharp (WilliamHill) total != soft total, bet sharp-direction at SOFT total, grade @ soft total.
  sharp leans OVER if sharp_total > soft_total (sharp sees more scoring than soft book posts).
  bet over at soft total -> cover if actual_total > soft_total.
MONEYLINE: when sharp no-vig home prob diverges from soft, bet sharp-favored side; grade by SU win at SOFT price.
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
def am2p(o):   # american odds -> implied prob
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o < 0, -o / (-o + 100), 100 / (o + 100))

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0]); d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
od = pd.concat(parts, ignore_index=True)
od["home_c"] = od.home_team.map(to_cfbd); od["away_c"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home_c", "away_c", "hrs_to_kick"]); od = od[od.hrs_to_kick >= 0]
idx = od.groupby(["season", "game_id", "book"]).hrs_to_kick.idxmin()
cols = ["season", "game_id", "home_c", "away_c", "book", "total", "home_ml", "away_ml", "hrs_to_kick"]
close = od.loc[idx, cols].copy()
close = close[close.hrs_to_kick < 12]
mg = gm[["season", "homeTeam", "awayTeam", "actual_margin", "actual_total"]].rename(columns={"homeTeam": "home_c", "awayTeam": "away_c"})
TS = [2021, 2022, 2023, 2024, 2025]

def pv(book, val):
    b = close[close.book == book][["season", "game_id", "home_c", "away_c", val]]
    return b.rename(columns={val: f"{val}_{book}"})

# ---------- TOTALS ----------
print("=========== TOTALS: sharp(WilliamHill) vs soft, bet sharp dir @ soft total ===========")
wh_t = pv("williamhill_us", "total")
for soft in ["mybookieag", "bovada"]:
    m = wh_t.merge(pv(soft, "total"), on=["season", "game_id", "home_c", "away_c"]).merge(
        mg, on=["season", "home_c", "away_c"]).dropna(subset=[f"total_williamhill_us", f"total_{soft}", "actual_total"])
    m["gap"] = m["total_williamhill_us"] - m[f"total_{soft}"]   # >0 sharp sees MORE -> bet over @ soft
    print(f"\n  WH vs {soft} (n_paired={len(m)})")
    for thr in [0.5, 1.0, 1.5, 2.0]:
        d = m[m.gap.abs() >= thr].copy()
        if len(d) < 30: continue
        over_lean = d.gap > 0
        res = np.where(over_lean, d.actual_total - d[f"total_{soft}"], d[f"total_{soft}"] - d.actual_total)
        nz = res != 0; dd = d[nz]; r = res[nz]; n = len(dd); w = int((r > 0).sum())
        per = "/".join(f"{100*(r[dd.season.values==s]>0).mean():.0f}" if (dd.season.values==s).sum()>=8 else "--" for s in TS)
        print(f"    gap>={thr}: n={n:<4} cover {100*w/n:.1f}% roi {roi(w,n):+.1f} [{per}]")

# ---------- MONEYLINE ----------
print("\n=========== MONEYLINE: sharp vs soft no-vig prob divergence ===========")
def ml_frame(book):
    b = close[close.book == book][["season", "game_id", "home_c", "away_c", "home_ml", "away_ml"]].copy()
    ph, pa = am2p(b.home_ml), am2p(b.away_ml)
    s = ph + pa
    b[f"p_{book}"] = ph / s   # no-vig home prob
    b[f"mlh_{book}"] = b.home_ml
    return b[["season", "game_id", "home_c", "away_c", f"p_{book}", f"mlh_{book}", "away_ml"]].rename(columns={"away_ml": f"mla_{book}"})

wh_m = ml_frame("williamhill_us")
for soft in ["mybookieag", "bovada"]:
    sm = ml_frame(soft)
    m = wh_m.merge(sm, on=["season", "game_id", "home_c", "away_c"]).merge(mg, on=["season", "home_c", "away_c"])
    m = m.dropna(subset=["p_williamhill_us", f"p_{soft}", "actual_margin"])
    m = m[(m.actual_margin != 0)]
    m["gap"] = m["p_williamhill_us"] - m[f"p_{soft}"]   # >0 sharp likes home more than soft
    print(f"\n  WH vs {soft} (n_paired={len(m)})")
    for thr in [0.03, 0.05, 0.08]:
        d = m[m.gap.abs() >= thr].copy()
        if len(d) < 30: continue
        bet_home = d.gap > 0
        win = np.where(bet_home, d.actual_margin > 0, d.actual_margin < 0)
        # ROI at SOFT price for the side we bet
        price = np.where(bet_home, pd.to_numeric(d[f"mlh_{soft}"], errors="coerce"), pd.to_numeric(d[f"mla_{soft}"], errors="coerce"))
        dec = np.where(price < 0, 1 + 100 / -price, 1 + price / 100)
        pnl = np.where(win, dec - 1, -1)
        n = len(d); w = int(win.sum())
        per = "/".join(f"{100*win[d.season.values==s].mean():.0f}" if (d.season.values==s).sum()>=8 else "--" for s in TS)
        print(f"    gap>={thr}: n={n:<4} SU-win {100*w/n:.1f}% ML-roi {100*pnl.mean():+.1f}% [{per}]")
