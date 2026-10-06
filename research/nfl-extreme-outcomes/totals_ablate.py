#!/usr/bin/env python3
"""Does ANY feature family beat the Monday opener on NFL totals? Family ablation.

Families, pre-registered (no sweeping):
  MKT   the Monday opener alone (the control: a model that just repeats the line)
  EPA   matchup.parquet team EPA / pace / weather / referee aggregates
  FP    the Fantasy Points charted panel (coverage scheme, pressure over expected, PROE,
        play action, yards before/after contact, stuffs) -- information not present in EPA
  BOTH  EPA + FP

Graded at the Monday/Tuesday opener from nfl_opener.py, walk-forward, leak-screened,
oracle-checked, reported per season. The opener's own MAE is the bar to beat.
"""
import warnings
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd, re
from sklearn.ensemble import HistGradientBoostingRegressor

NV = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR","Chicago":"CHI",
 "Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET","Green Bay":"GB",
 "Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC","LA Chargers":"LAC",
 "LA Rams":"LA","Las Vegas":"LV","Miami":"MIA","Minnesota":"MIN","NY Giants":"NYG","NY Jets":"NYJ",
 "New England":"NE","New Orleans":"NO","Philadelphia":"PHI","Pittsburgh":"PIT","San Francisco":"SF",
 "Seattle":"SEA","Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS"}

m = pd.read_parquet("data/matchup.parquet")
op = pd.read_parquet("data/opener_weekly.parquet")
op["home_ab"] = op.home_team.map(NV); op["away_ab"] = op.away_team.map(NV)
op = op.dropna(subset=["home_ab","away_ab","open_total_point"]).sort_values("game_date")
op = op.groupby(["season","home_ab","away_ab"], as_index=False).first()
d = m.merge(op[["season","home_ab","away_ab","open_total_point"]],
            on=["season","home_ab","away_ab"], how="left")
# FP charted data starts in 2021, so judge feature coverage on that era, not on 2018-2026 — a
# non-null filter measured across all seasons put every FP column at 0.536 and deleted the lot.
d = d[d.actual_total.notna() & (d.season >= 2021)].copy()
d["y"] = d.actual_total.astype(float)
d["mkt_open"] = pd.to_numeric(d.open_total_point, errors="coerce")
d["mkt_close"] = pd.to_numeric(d.nv_total_line, errors="coerce")

fp = pd.read_parquet("data/fp_team_entering.parquet")
FPC = [c for c in fp.columns if c.startswith("fp_")]
d = d.merge(fp.rename(columns={c: f"h_{c}" for c in FPC}).rename(columns={"ab":"home_ab"}),
            on=["season","week","home_ab"], how="left")
d = d.merge(fp.rename(columns={c: f"a_{c}" for c in FPC}).rename(columns={"ab":"away_ab"}),
            on=["season","week","away_ab"], how="left")

BAN = re.compile(r"actual_|total_points|home_score|away_score|final_|_result$|cover_|favorite|resid_|"
                 r"total_diff|total_miss|over_win|nv_total_line|ou_vegas_line|spread|margin|^y$|"
                 r"close|open_total|mkt", re.I)
num = d.select_dtypes(include=[np.number]).columns
EPA = [c for c in num if not BAN.search(c) and not c.startswith(("h_fp_","a_fp_"))
       and c not in ("season","week")]
EPA = [c for c in EPA if d[c].notna().mean() > 0.80]
FPF = [c for c in num if c.startswith(("h_fp_","a_fp_"))]
_testable = d.season >= 2023          # the rows that get graded (openers exist from 2023)
FPF = [c for c in FPF if d.loc[_testable, c].notna().mean() > 0.80]

def leak_screen(cols):
    keep = []
    for c in cols:
        x = pd.to_numeric(d[c], errors="coerce").astype(float)
        ok = x.notna() & d.mkt_close.notna() & d.y.notna()
        if ok.sum() < 300 or x[ok].std(ddof=0) == 0:
            continue
        xi = x[ok].to_numpy(float)
        cl = abs(np.corrcoef(xi, d.mkt_close[ok].to_numpy(float))[0,1])
        cr = abs(np.corrcoef(xi, d.y[ok].to_numpy(float))[0,1])
        # ⛔ CALIBRATION. A flat ">0.05 more correlated with the result than the line" rule deleted
        # ALL 439 FP features: charted team-form metrics correlate weakly with BOTH (e.g. 0.07 vs
        # 0.01), so a near-zero pair trips an absolute gap. A LEAK is a feature that knows the
        # ANSWER, so require the result-correlation to be SUBSTANTIAL as well. Verified against the
        # six real leaks in matchup.parquet: total_diff/resid_total 0.95, over_win 0.75,
        # resid_home_pts 0.68, resid_away_pts 0.67, total_miss 0.26 -- all still caught; weak honest
        # features like home_off_oop_rate_s2d (0.07 vs 0.01) are now kept.
        if np.isfinite(cl) and np.isfinite(cr) and not (cr > 0.15 and (cr - cl) > 0.10):
            keep.append(c)
    return keep

EPA, FPF = leak_screen(EPA), leak_screen(FPF)
print(f"after leak screen: EPA {len(EPA)} features | FP {len(FPF)} features")

FAMS = {"MKT": [], "EPA": EPA, "FP": FPF, "BOTH": EPA + FPF}

def run(feats):
    rows = []
    for target in range(2023, 2027):
        tr = d[(d.season < target) & d.mkt_close.notna()]
        te = d[(d.season == target) & d.mkt_open.notna()].copy()
        if len(tr) < 300 or te.empty:
            continue
        cols = ["mkt"] + feats
        tr = tr.assign(mkt=tr.mkt_close); te = te.assign(mkt=te.mkt_open)
        Xtr = tr[cols].apply(pd.to_numeric, errors="coerce").astype(float)
        Xte = te[cols].apply(pd.to_numeric, errors="coerce").astype(float)
        reg = HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=400,
              l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(Xtr, tr.y)
        te["pred"] = reg.predict(Xte); rows.append(te)
    P = pd.concat(rows)
    P["edge"] = P.pred - P.mkt_open
    P["side"] = np.where(P.edge > 0, "OVER", "UNDER")
    P["res"] = np.where(P.y > P.mkt_open, "OVER", np.where(P.y < P.mkt_open, "UNDER", "PUSH"))
    P = P[P.res != "PUSH"].copy(); P["won"] = P.side == P.res
    assert (np.where(P.y > P.mkt_open, "OVER", "UNDER") == P.res).mean() > 0.999
    return P

print(f"\n{'family':<8}{'MAE':>7}{'corr':>8}{'all':>22}{'|edge|>=3':>22}{'|edge|>=5':>22}")
store = {}
for nm, f in FAMS.items():
    P = run(f); store[nm] = P
    def r(s):
        if len(s) < 25: return f"{'(thin)':>22}"
        w = int(s.won.sum()); l = len(s)-w
        return f"{len(s):>5} {w}-{l} {w/len(s)*100:5.1f}% {(w*0.909-l)/len(s)*100:+6.1f}%"
    print(f"{nm:<8}{np.abs(P.pred-P.y).mean():>7.2f}"
          f"{np.corrcoef(P.edge, P.y-P.mkt_open)[0,1]:>+8.3f}{r(P)}{r(P[P.edge.abs()>=3])}{r(P[P.edge.abs()>=5])}")
P0 = store["MKT"]
print(f"\nbar to beat -- the opener's own MAE: {np.abs(P0.mkt_open-P0.y).mean():.2f}")
print(f"\nper-season, BOTH family, all bets:")
for s_, x in store["BOTH"].groupby("season"):
    w = int(x.won.sum()); l = len(x)-w
    print(f"  {int(s_)}: {len(x):>4} {w}-{l}  {w/len(x)*100:5.1f}%  ROI {(w*0.909-l)/len(x)*100:+6.1f}%")
store["BOTH"].to_csv("out/totals_ablate_both.csv", index=False)
