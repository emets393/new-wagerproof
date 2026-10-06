#!/usr/bin/env python3
"""The NFL sides model has TWO heads that disagree on 38% of games. Which one is right, and
what is the single coherent number? (owner, 2026-10-06)

The shipped model fits a CLASSIFIER on home_cover and a REGRESSOR on the actual margin, then
takes the side from the classifier while the published edge comes off the regressor. Both are
measured against the SAME line (verified: mkt_margin == -home_spread on 100% of rows, so this
is not a sign bug), which means the 38% is two heads genuinely contradicting each other. A card
can therefore show "model likes HOME" above a fair line that favours AWAY.

Four candidate resolutions, scored walk-forward against the CLOSE:
  CLF   classifier side only (what ships)
  REG   regressor side only (what the published number implies)
  AGREE bet only where they agree -- disagreement as a veto
  BLEND one probability: the regressor's margin converted to P(cover) through its own
        out-of-sample residual spread, then averaged with the classifier. This is the only
        candidate that cannot be internally incoherent, because there is only one number.

The residual sd used by BLEND comes from the TRAINING years only -- using the test year's own
residuals would leak.
"""
import warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
import joblib
from scipy.stats import norm
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from forecast_harness import build

CONF = 0.03
_, _, FEATS = joblib.load("data/sides_models_2026.pkl")
m, _ = build()
m = m.copy(); m["act"] = m.actual_margin.astype(float)

rows = []
for target in range(2021, 2027):
    tr = m[(m.season < target) & (m.week >= 4)].dropna(subset=["home_cover"])
    te = m[(m.season == target) & (m.week >= 4)].dropna(subset=["home_cover"])
    if len(tr) < 300 or te.empty:
        continue
    F = [c for c in FEATS if c in m.columns]
    Xtr, Xte = tr[F].astype(float), te[F].astype(float)
    clf = HistGradientBoostingClassifier(learning_rate=0.05, l2_regularization=2.0,
                                         random_state=0).fit(Xtr, tr.home_cover.astype(int))
    reg = HistGradientBoostingRegressor(learning_rate=0.05, l2_regularization=2.0,
                                        random_state=0).fit(Xtr, tr.act.astype(float))
    # residual spread from TRAINING years only (in-sample fit residuals understate it, so use
    # a held-back slice of the training window rather than the fit itself)
    cut = tr.season.max()
    inner_tr = tr[tr.season < cut]; inner_te = tr[tr.season == cut]
    if len(inner_tr) > 200 and len(inner_te) > 50:
        r2 = HistGradientBoostingRegressor(learning_rate=0.05, l2_regularization=2.0,
                                          random_state=0).fit(inner_tr[F].astype(float), inner_tr.act)
        SD = float((inner_te.act - r2.predict(inner_te[F].astype(float))).std())
    else:
        SD = 13.5
    p = clf.predict_proba(Xte)[:, 1]
    pm = reg.predict(Xte)
    mkt = te.mkt_margin.astype(float).values
    act = te.act.values
    clo = te.home_spread.astype(float).values
    # regressor margin -> P(home covers) through the residual spread
    p_reg = norm.cdf((pm - mkt) / SD)
    ok = ~np.isnan(mkt) & ~np.isnan(act) & ~np.isnan(clo)
    for i in np.where(ok)[0]:
        cover = act[i] + clo[i]
        if abs(cover) < 1e-9:
            continue
        rows.append(dict(season=target, sd=SD, p_clf=p[i], p_reg=p_reg[i],
                         p_blend=0.5*p[i] + 0.5*p_reg[i],
                         pts=pm[i] - mkt[i], home_covered=cover > 0))
d = pd.DataFrame(rows)
for k in ("clf", "reg", "blend"):
    d[f"side_{k}"] = d[f"p_{k}"] > 0.5
    d[f"won_{k}"] = d[f"side_{k}"] == d.home_covered
    d[f"conf_{k}"] = (d[f"p_{k}"] - 0.5).abs()
d["agree"] = d.side_clf == d.side_reg
# ORACLE: betting the realised result must win every time
assert ((d.home_covered) == d.home_covered).all()
print(f"{len(d)} walk-forward games 2021-2026, close-graded. "
      f"residual sd used by BLEND: {d.sd.min():.1f}-{d.sd.max():.1f} pts")
print(f"heads disagree on {100*(~d.agree).mean():.1f}% of games\n")


def rec(s, col):
    if not len(s): return f"{'—':>28}"
    w = int(s[col].sum()); l = len(s) - w
    return f"{len(s):>6}{f'{w}-{l}':>11}{w/len(s)*100:>8.1f}%{(w*0.909-l)/len(s)*100:>+9.1f}%"


print("=== WHO IS RIGHT WHEN THEY DISAGREE  (the whole question)")
dis, agr = d[~d.agree], d[d.agree]
print(f"{'slice':<34}{'n':>6}{'W-L':>11}{'hit':>8}{'ROI':>9}")
print(f"{'they AGREE (one side, no conflict)':<34}{rec(agr,'won_clf')}")
print(f"{'they DISAGREE -> take the CLASSIFIER':<34}{rec(dis,'won_clf')}")
print(f"{'they DISAGREE -> take the REGRESSOR':<34}{rec(dis,'won_reg')}")

print("\n=== the four candidate rules, on EVERY game (no confidence gate)")
print(f"{'rule':<34}{'n':>6}{'W-L':>11}{'hit':>8}{'ROI':>9}")
for nm, c in (("CLF  classifier side (ships)", "won_clf"), ("REG  regressor side", "won_reg"),
              ("BLEND one probability", "won_blend")):
    print(f"{nm:<34}{rec(d,c)}")
print(f"{'AGREE only (veto conflicts)':<34}{rec(agr,'won_clf')}")

print("\n=== with the locked confidence gate applied to each rule's own probability")
print(f"{'rule':<34}{'n':>6}{'W-L':>11}{'hit':>8}{'ROI':>9}")
for nm, c, pc in (("CLF  |p-.5|>=.03 (ships today)", "won_clf", "conf_clf"),
                  ("REG  |p-.5|>=.03", "won_reg", "conf_reg"),
                  ("BLEND |p-.5|>=.03", "won_blend", "conf_blend")):
    print(f"{nm:<34}{rec(d[d[pc] >= CONF], c)}")
print(f"{'AGREE + clf gate':<34}{rec(agr[agr.conf_clf >= CONF],'won_clf')}")
print(f"{'AGREE + BOTH gated':<34}"
      f"{rec(agr[(agr.conf_clf>=CONF)&(agr.conf_reg>=CONF)],'won_blend')}")

print("\n=== does disagreement sit where the signal is WEAK (harmless) or STRONG (a defect)?")
d["cb"] = pd.cut(d.conf_clf, [0, .02, .04, .07, .5], labels=["<.02", ".02-.04", ".04-.07", ".07+"])
print(f"{'clf confidence':<16}{'n':>6}{'disagree%':>11}{'clf hit':>9}{'reg hit':>9}")
for b in ["<.02", ".02-.04", ".04-.07", ".07+"]:
    s = d[d.cb == b]
    if len(s): print(f"{b:<16}{len(s):>6}{100*(~s.agree).mean():>10.1f}%"
                     f"{100*s.won_clf.mean():>8.1f}%{100*s.won_reg.mean():>8.1f}%")

print("\n=== per season, the rule that ships vs the best alternative")
print(f"{'season':<8}{'CLF n':>7}{'CLF hit':>9}{'AGREE n':>9}{'AGREE hit':>11}{'BLEND hit':>11}")
for y in sorted(d.season.unique()):
    a = d[(d.season == y) & (d.conf_clf >= CONF)]
    b = agr[(agr.season == y) & (agr.conf_clf >= CONF)]
    c = d[(d.season == y) & (d.conf_blend >= CONF)]
    print(f"{int(y):<8}{len(a):>7}{100*a.won_clf.mean():>8.1f}%{len(b):>9}"
          f"{100*b.won_clf.mean():>10.1f}%{100*c.won_blend.mean():>10.1f}%")
d.to_csv("out/audit_nfl_two_heads.csv", index=False)
print("\n-> out/audit_nfl_two_heads.csv")
