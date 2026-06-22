"""
Spread<->ML relationship via QUANTILE buckets (not fixed thresholds) so every bucket is populated even
though CFB divergence is small. Two framings:
  A. residual = p_ml - p_spread  (ML-implied fav prob minus spread-implied fav prob).
     <0 = ML softer on fav than spread (dog-live theory). Split into quintiles -> trend in dog cover?
  B. ML -> FAIR SPREAD: invert the spread->winprob curve to get the spread the ML implies; diff_pts =
     fav_spread - ml_spread. Correlate with cover; bucket.
  C. 2D QUADRANTS: spread magnitude (small/big) x ML residual (soft/hard fav ML).
DK close. Grade ATS @ DK close fav spread, pushes excl, per-season. Also run OPEN as a check.
"""
import os, glob
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

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
def ml_p(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o < 0, -o / (-o + 100), 100 / (o + 100))
TS = [2021, 2022, 2023, 2024, 2025]
def per(b, w): return "/".join(f"{100*w[b.season==x].mean():.0f}" if (b.season==x).sum()>=8 else "--" for x in TS)

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0]); d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
od = pd.concat(parts, ignore_index=True)
od = od[od.book == "draftkings"].copy()
od["home"] = od.home_team.map(to_cfbd); od["away"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home", "away", "hrs_to_kick", "spread_home", "home_ml", "away_ml"])
od = od[od.hrs_to_kick >= 0]
mg = gm[["season", "homeTeam", "awayTeam", "actual_margin"]].rename(columns={"homeTeam": "home", "awayTeam": "away"})

def build(idx):
    c = od.loc[idx].copy()
    c = c.merge(mg, on=["season", "home", "away"], how="inner")
    c = c[c.spread_home != 0]
    hf = (c.spread_home < 0).values
    c["fav_ml"] = pd.to_numeric(pd.Series(np.where(hf, c.home_ml, c.away_ml), index=c.index), errors="coerce")
    c["dog_ml"] = pd.to_numeric(pd.Series(np.where(hf, c.away_ml, c.home_ml), index=c.index), errors="coerce")
    c["fav_spread"] = -c.spread_home.abs()
    c["fav_margin"] = np.where(hf, c.actual_margin, -c.actual_margin)
    c = c[(c.fav_ml.between(-10000, 0)) & (c.dog_ml.between(-10000, 10000))]
    pf = ml_p(c.fav_ml); pdg = ml_p(c.dog_ml); s = pf + pdg
    c["p_ml"] = pf / s
    c = c[(c.p_ml > 0.5) & (c.p_ml < 0.995)]
    c["fav_won"] = (c.fav_margin > 0).astype(int)
    c["ats"] = c.fav_margin + c.fav_spread
    c = c[c.ats != 0]
    lr = LogisticRegression().fit(c[["fav_spread"]], c.fav_won)
    b0, b1 = lr.intercept_[0], lr.coef_[0][0]
    c["p_spread"] = lr.predict_proba(c[["fav_spread"]])[:, 1]
    c["residual"] = c.p_ml - c.p_spread                                   # <0 = ML soft on fav (dog live)
    logit = np.log(c.p_ml / (1 - c.p_ml))
    c["ml_spread"] = (logit - b0) / b1                                    # spread the ML implies (negative)
    c["diff_pts"] = c.fav_spread - c.ml_spread                            # <0 = spread bigger than ML justifies
    return c

def report(tag, c):
    print(f"\n{'='*78}\n{tag}: n={len(c)} | residual std {c.residual.std():.3f} | diff_pts std {c.diff_pts.std():.2f}")
    print(f"baseline DOG cover {100*(c.ats<0).mean():.1f}% | fav SU {100*c.fav_won.mean():.1f}%\n{'='*78}")
    # A. residual quintiles
    c = c.copy(); c["qa"] = pd.qcut(c.residual, 5, labels=False, duplicates="drop")
    print("A. residual (p_ml - p_spread) QUINTILES  [low=ML soft on fav=dog-live theory]")
    print(f"   {'q':>3}{'resid_mid':>10}{'n':>6}{'DOGcov%':>9}{'favSU%':>8}{'dogML_roi':>10}   per-season DOGcov")
    for q in sorted(c.qa.dropna().unique()):
        b = c[c.qa == q]; dc = b.ats < 0
        dec = np.where(b.dog_ml < 0, 1 + 100 / -b.dog_ml, 1 + b.dog_ml / 100)
        pnl = np.where(b.fav_won == 0, dec - 1, -1)
        print(f"   {int(q):>3}{b.residual.median():>10.3f}{len(b):>6}{100*dc.mean():>9.1f}{100*b.fav_won.mean():>8.1f}{100*pnl.mean():>10.1f}   [{per(b,dc)}]")
    # B. diff_pts correlation + quintiles
    cc = np.corrcoef(c.diff_pts, (c.ats < 0).astype(int))[0, 1]
    print(f"\nB. ML->fair-spread diff_pts (fav_spread - ml_spread): corr with DOG-cover = {cc:+.3f}")
    c["qb"] = pd.qcut(c.diff_pts, 5, labels=False, duplicates="drop")
    for q in sorted(c.qb.dropna().unique()):
        b = c[c.qb == q]; dc = b.ats < 0
        print(f"   diff q{int(q)} (mid {b.diff_pts.median():+.2f} pts): n={len(b)} DOG cover {100*dc.mean():.1f}% [{per(b,dc)}]")
    # C. 2D quadrants: spread mag (small/big) x residual (soft/hard)
    print("\nC. QUADRANTS: spread |fav| (small/big median split) x ML residual (soft/hard median split)")
    ms = c.fav_spread.abs().median(); mr = c.residual.median()
    for sp_lab, sp_m in [("small-fav", c.fav_spread.abs() <= ms), ("big-fav", c.fav_spread.abs() > ms)]:
        for r_lab, r_m in [("softML(doglive)", c.residual <= mr), ("hardML", c.residual > mr)]:
            b = c[sp_m & r_m]; dc = b.ats < 0
            print(f"   {sp_lab:<10} {r_lab:<16} n={len(b):<4} DOG cover {100*dc.mean():.1f}%  fav SU {100*b.fav_won.mean():.1f}%")

report("DK CLOSE", build(od[od.hrs_to_kick < 12].groupby(["season", "game_id"]).hrs_to_kick.idxmin()))
report("DK OPEN", build(od.groupby(["season", "game_id"]).hrs_to_kick.idxmax()))
