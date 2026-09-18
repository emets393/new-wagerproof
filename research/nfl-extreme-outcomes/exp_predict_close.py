#!/usr/bin/env python3
"""PREDICT THE CLOSING LINE (owner, 2026-09-18): "we see the opener, the model predicts the close, we bet
when our predicted close is far enough from the open."  Target = the MOVE (close − open, home spread).
Walk-forward by season. Feature stacks: (A) opener only, (B) + production model edge vs open,
(C) + fundamentals features the production model uses, (D) + FP team facets (NFL only).
Graded three ways at |predicted move| ≥ t:  share of games the line moved our way (CLV hit),
mean points of CLV captured, and the bet result vs the OPENER at -110.  Per season, both sports.
Sign: home spread; predicted move < 0 = we expect the close to favor HOME more -> bet HOME at the open."""
import sys, io, contextlib, numpy as np, pandas as pd, warnings
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
warnings.filterwarnings("ignore")
def grade(d, pm, thr, yr_col="season"):
    """d has open, close, actual_margin, pred move pm (Series). Bet home when pm<0."""
    x = d[pm.abs() >= thr].copy(); p = pm[x.index]; bet_home = p < 0
    mv = x.close - x.open                                   # <0 = moved toward home
    clv_hit = np.where(bet_home, mv < 0, mv > 0); clv_pts = np.where(bet_home, -mv, mv); moved = mv != 0
    res = x.actual_margin + x.open; push = res == 0; won = np.where(bet_home, res > 0, res < 0)
    return dict(n=len(x), clv_hit=100 * clv_hit[moved].mean() if moved.sum() else np.nan, clv_pts=clv_pts.mean(), win=100 * won[~push].mean() if (~push).sum() else np.nan, nbet=int((~push).sum()))
def run(name, D, stacks, years, thrs=(0.5, 1.0, 1.5, 2.0)):
    print("=" * 110); print(f"{name}: predict the MOVE (close − open).  {len(D)} games, seasons {years[0]}..{years[-1]}"); print("=" * 110)
    sd = (D.close - D.open).std(); print(f"  actual move: sd {sd:.2f} pts, |move|>=1 in {100*((D.close-D.open).abs()>=1).mean():.0f}% of games, ==0 in {100*((D.close-D.open)==0).mean():.0f}%")
    for sname, feats in stacks.items():
        feats = [f for f in feats if f in D.columns]; print(f"\n  --- stack {sname} ({len(feats)} features) ---")
        rows = []
        for yr in years:
            tr = D[(D.season < yr)].dropna(subset=["open","close"]); te = D[D.season == yr].dropna(subset=["open","close"]).copy()
            if len(tr) < 100 or len(te) < 30: continue
            y = tr.close - tr.open
            Xtr = tr[feats].astype(float); Xte = te[feats].astype(float); med = Xtr.median(); Xtr = Xtr.fillna(med); Xte = Xte.fillna(med)
            mdl = HistGradientBoostingRegressor(max_iter=200, learning_rate=0.05, max_depth=3, l2_regularization=2.0, min_samples_leaf=30, random_state=0).fit(Xtr, y)
            pm = pd.Series(mdl.predict(Xte), index=te.index); r = np.corrcoef(pm, te.close - te.open)[0, 1]
            line = f"    {yr}: r(pred move, actual move)={r:+.3f}"
            for t in thrs:
                g = grade(te, pm, t); line += f" | ≥{t}: n={g['n']:3d} line-our-way {g['clv_hit']:4.0f}% clv {g['clv_pts']:+.2f} win-vs-open {g['win']:4.1f}%"
            print(line); rows.append((yr, r, pm, te))
        # pooled at the two useful thresholds
        allp = pd.concat([x[2] for x in rows]); allt = pd.concat([x[3] for x in rows])
        for t in (1.0, 1.5):
            g = grade(allt, allp, t); print(f"    POOLED ≥{t}: n={g['n']} line-our-way {g['clv_hit']:.0f}% clv {g['clv_pts']:+.2f} win-vs-open {g['win']:.1f}% (n={g['nbet']})")
# ===================================================================== CFB (2016-2025 opens/closes, big sample)
sys.path.insert(0, "../cfb-model")
with contextlib.redirect_stdout(io.StringIO()):
    import os; os.chdir("../cfb-model"); import cfb_forecast as CF; gm, feats, nets = CF.load(); os.chdir("../nfl-extreme-outcomes")
C = gm[gm.spread_open.notna() & gm.spread_close.notna() & gm.actual_margin.notna()].copy()
C["open"] = C.spread_open; C["close"] = C.spread_close
# production model edge vs open, walk-forward (train < season) — the same recipe as cfb_forecast
pm = []
for yr in sorted(C.season.unique()):
    if yr < 2019: continue
    tr = gm[(gm.season < yr) & gm.actual_margin.notna()]; te = C[C.season == yr].copy()
    sm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[feats + nets], tr.actual_margin)
    te["model_edge"] = sm.predict(te[feats + nets]) + te.open; pm.append(te)
C = pd.concat(pm); C["abs_open"] = C.open.abs()
run("CFB", C, {"A: opener only": ["open","abs_open","week"], "B: + production model edge": ["open","abs_open","week","model_edge"], "C: + fundamentals": ["open","abs_open","week","model_edge"] + feats + nets}, [2021, 2022, 2023, 2024, 2025])
# ===================================================================== NFL (openers 2023-25 from odds_consensus)
with contextlib.redirect_stdout(io.StringIO()):
    import forecast_harness as FH; m, BASE = FH.build()
od = pd.read_parquet("data/odds_consensus.parquet")[["season","home_ab","away_ab","open_spread","close_spread"]]
N = m.merge(od, on=["season","home_ab","away_ab"], how="inner"); N = N[N.open_spread.notna() & N.close_spread.notna() & N.actual_margin.notna()].copy()
N["open"] = N.open_spread; N["close"] = N.close_spread; N["abs_open"] = N.open.abs()
pm = []
for yr in (2023, 2024, 2025):
    tr = m[(m.season < yr) & (m.week >= 4)].dropna(subset=["actual_margin"]); te = N[N.season == yr].copy()
    reg = HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=0).fit(tr[BASE], tr.actual_margin)
    te["model_edge"] = reg.predict(te[BASE]) + te.open; pm.append(te)
N = pd.concat(pm)
# FP team facets, entering-week (reuse the injury-context + FP blocks the prop engine builds at team level)
try:
    src = open("exp_prop_holdout.py").read().split('print("=" * 120)')[0]; ns = {}
    with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "ho", "exec"), ns)
    TB = ns["PE"].team_blocks() if hasattr(ns["PE"], "team_blocks") else None
except Exception as e:
    TB = None; print(f"[fp team blocks unavailable: {e}]")
fp_cols = []
if TB is not None:
    for side, p in (("home", "h_"), ("away", "a_")):
        N = N.merge(TB.rename(columns={c: p + c for c in TB.columns if c not in ("season","week","team")}).rename(columns={"team": f"{side}_ab"}), on=["season","week",f"{side}_ab"], how="left")
    fp_cols = [c for c in N.columns if c.startswith(("h_","a_")) and c not in BASE]
run("NFL", N, {"A: opener only": ["open","abs_open","week"], "B: + production model edge": ["open","abs_open","week","model_edge"], "C: + harness features": ["open","abs_open","week","model_edge"] + BASE, "D: + FP team facets": ["open","abs_open","week","model_edge"] + BASE + fp_cols}, [2023, 2024, 2025])
print("\nread: 'line-our-way' = share of games (that moved at all) where the close moved toward the side our predicted close implies. 50% = we can't predict the move.")
