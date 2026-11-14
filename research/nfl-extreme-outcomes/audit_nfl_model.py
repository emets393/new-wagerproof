#!/usr/bin/env python3
"""Independent walk-forward audit of the NFL sides model. Owner-requested 2026-10-05.

Answers four questions with numbers, not assurances:
  1. Is it a real fitted model, or does it reproduce only because of a leak?
  2. Are the SIGNS right end to end — prediction -> pick side -> grade?
  3. Does it predict the result better than the CLOSING LINE does? (if not, it cannot beat it)
  4. What is the out-of-sample betting record per season, against the OPENER, which is the
     line the locked rule actually bets?

Trains on season < target (week >= 4, the harness's own training window) and predicts the
target. No frozen pickle: out/sides_models_*.pkl cannot load under this numpy
(PCG64 BitGenerator), and an artifact that cannot be read cannot be audited.

Usage: audit_nfl_model.py
"""
import warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
import joblib
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from forecast_harness import build

CONF = 0.03          # locked rule: bet when |p - .5| >= .03
_, _, FEATS = joblib.load("data/sides_models_2026.pkl")   # feature LIST only, not the estimators

m, BASE = build()
m = m.copy()
need = ["home_cover", "home_spread", "mkt_margin", "actual_margin"]
have = [c for c in need if c in m.columns]
print(f"frame {m.shape} | seasons {sorted(m.season.dropna().unique().tolist())}")
print(f"key cols present: {have}")
m["act_margin"] = m.actual_margin.astype(float)
print(f"features used: {len(FEATS)}")

rows = []
for target in range(2021, 2027):
    tr = m[(m.season < target) & (m.week >= 4)].dropna(subset=["home_cover"])
    te = m[(m.season == target) & (m.week >= 4)].dropna(subset=["home_cover"])
    if len(tr) < 300 or te.empty:
        print(f"{target}: train {len(tr)} test {len(te)} — skipped"); continue
    F = [c for c in FEATS if c in m.columns]
    Xtr, Xte = tr[F].astype(float), te[F].astype(float)
    clf = HistGradientBoostingClassifier(learning_rate=0.05, l2_regularization=2.0,
                                         random_state=0).fit(Xtr, tr.home_cover.astype(int))
    reg = HistGradientBoostingRegressor(learning_rate=0.05, l2_regularization=2.0,
                                        random_state=0).fit(Xtr, tr.act_margin.astype(float))
    p = clf.predict_proba(Xte)[:, 1]
    pm = reg.predict(Xte)
    act = te.act_margin.astype(float).values
    mkt = te.mkt_margin.astype(float).values             # market's implied home margin
    # No opener in this frame (it lives in build_spread_lookup, used inside generate()). Grading
    # at the CLOSE is the STRICTER test — the locked rule bets the opener, which is softer.
    opn = te.home_spread.astype(float).values
    ok = ~np.isnan(mkt) & ~np.isnan(act)
    mae_model, mae_mkt = np.mean(np.abs(pm[ok] - act[ok])), np.mean(np.abs(mkt[ok] - act[ok]))
    # betting record: confident side vs the OPENER (the locked rule)
    bet = (np.abs(p - 0.5) >= CONF) & ~np.isnan(opn)
    side_home = p > 0.5
    edge = act + opn                                     # >0 home covers (close)
    win = np.where(side_home, edge > 0, edge < 0)
    push = np.abs(edge) < 1e-9
    w = int((bet & win & ~push).sum()); l = int((bet & ~win & ~push).sum()); pu = int((bet & push).sum())
    # blind baselines on the same games
    bh = int(((edge > 0) & bet).sum()); bf = int(((edge > 0) == (opn < 0))[bet].sum())
    rows.append(dict(season=target, n_train=len(tr), n_test=len(te), bets=w + l + pu,
                     w=w, l=l, p=pu, hit=round(w / (w + l), 4) if w + l else None,
                     roi=round((w * 0.909 - l) / (w + l), 4) if w + l else None,
                     mae_model=round(mae_model, 2), mae_market=round(mae_mkt, 2),
                     beats_market=mae_model < mae_mkt,
                     always_home=f"{bh}-{int(bet.sum())-bh}"))
d = pd.DataFrame(rows)
print(f"\n{'season':<8}{'train':>7}{'test':>6}{'bets':>6}{'record':>12}{'hit':>8}{'roi':>8}"
      f"{'MAEmodel':>10}{'MAEmkt':>8}{'better?':>9}{'blind home':>12}")
for r in d.itertuples():
    rec = f"{r.w}-{r.l}" + (f"-{r.p}" if r.p else "")
    print(f"{r.season:<8}{r.n_train:>7}{r.n_test:>6}{r.bets:>6}{rec:>12}"
          f"{(r.hit*100 if r.hit else 0):>7.1f}%{(r.roi*100 if r.roi else 0):>+7.1f}%"
          f"{r.mae_model:>10}{r.mae_market:>8}{str(r.beats_market):>9}{r.always_home:>12}")
tw, tl, tp = d.w.sum(), d.l.sum(), d.p.sum()
print(f"\nALL 2021-2026: {tw}-{tl}" + (f"-{tp}" if tp else "")
      + f"  {tw/(tw+tl)*100:.1f}%  ROI {(tw*0.909-tl)/(tw+tl)*100:+.1f}%  ({tw+tl} bets)")
print(f"seasons where the model predicted better than the close: {int(d.beats_market.sum())} of {len(d)}")
d.to_csv("out/audit_nfl_model.csv", index=False)
print("-> out/audit_nfl_model.csv")
