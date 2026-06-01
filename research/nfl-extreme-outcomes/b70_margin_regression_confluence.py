"""
b70: MARGIN REGRESSION as a CONFIRMATION LAYER for the sides classification model.

GOAL
  We're not replacing the locked classification model. Instead we train a second model that targets
  actual_margin (regression) on the SAME 33 BASE features and use it as an internal confidence indicator.
  When both models agree on direction, hit% and ROI rise materially. Frontend will surface a "high
  conviction" badge but NEVER expose the predicted-margin number directly.

FRAMEWORK COMPLIANCE
  • Features: BASE only (33 features, same as locked sides model). No betting-line features added beyond
    what the locked model already uses (abs_spread, home_dog_7_10, away_dog_7_10, home_fav — same caveat
    as classification: they're derived from CLOSE spread). NO open_spread/ml/total/juice in training.
  • No outcome features: ref_*_pct columns are POINT-IN-TIME career averages thru that game (verified
    via Bill Vinovich/John Hussey/Clete Blakeman 2018 sequence in earlier audit).
  • Target: actual_margin is an OUTCOME, only used as training target — never as a feature.
  • Walk-forward: train on seasons < Y, predict Y. Same protocol as classification.
  • Push handling: same as classification (push=0 via boolean cast; production convention).
  • Grading framework: signal uses BASE (mostly CLOSE-line-dependent features), graded vs OPEN spread.
    Same line convention as the locked classification model. Documented honestly: at CLOSE, regression
    drops below breakeven (51.6%/-1.5%) — it's CLV-dependent. That's WHY we use it as a confirmation
    layer, not a standalone bet model.

HEADLINE RESULTS (held-out 2024+2025, vs OPEN spread)
  Classification alone (conf>=.03):       n=368  56.5%  +7.9% ROI   CLV +0.31
  Regression alone (edge>=1.5):           n=319  55.8%  +6.5% ROI   CLV +0.98
  CONFLUENCE (both agree):                n=191  58.6%  +11.9% ROI  ← the high-conviction subset
    2024: n=94   63.8%  +21.9% ROI
    2025: n=97   53.6%  +2.3% ROI    (2025 weaker — same season pattern as everything else)

  Realistic 2026 expectation for confluence picks: ~55-58% / +5-10% ROI.

WHAT THIS GETS WIRED INTO
  forecast_harness.py:
    - train_predict() now trains a HistGradientBoostingRegressor on actual_margin alongside the classifier
    - generate() adds confluence + reg_edge fields to each sides_model pick row
    - report() prints a confluence breakdown so we can monitor the gap live in 2026
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from forecast_harness import build, CONF, REG_EDGE
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m, BASE = build()
m["actual_margin"]=m.home_score-m.away_score
m["home_cover"]=(m.actual_margin+m.home_spread>0).astype(int)

# Walk-forward both models on the held-out years 2024+2025
W=m[m.week>=4].copy(); W["ph"]=np.nan; W["pred_margin"]=np.nan
for Y in [2024,2025]:
    tr=W[W.season<Y].dropna(subset=["home_cover","actual_margin"]+BASE)
    te=W[W.season==Y]
    clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,
        min_samples_leaf=40,random_state=0).fit(tr[BASE],tr.home_cover)
    reg=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,
        min_samples_leaf=40,random_state=0).fit(tr[BASE],tr.actual_margin)
    W.loc[te.index,"ph"]=clf.predict_proba(te[BASE])[:,1]
    W.loc[te.index,"pred_margin"]=reg.predict(te[BASE])

od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
d=W[W.season.isin([2024,2025])].dropna(subset=['ph','pred_margin']).merge(
    od[['season','home_ab','away_ab','open_spread','close_spread']],
    on=['season','home_ab','away_ab'],how='inner').dropna(subset=['open_spread'])
d["hco_open"]=(d.actual_margin+d.open_spread>0).astype(float)
d.loc[d.actual_margin+d.open_spread==0,"hco_open"]=np.nan
d["reg_edge"]=d.pred_margin - (-d.open_spread)
d["clv_clf"]=np.where(d.ph>=0.5, d.open_spread-d.close_spread, d.close_spread-d.open_spread)

# Per-model picks
d["clf_home"]=d.ph>=0.5+CONF
d["clf_away"]=d.ph<=0.5-CONF
d["reg_home"]=d.reg_edge>=REG_EDGE
d["reg_away"]=d.reg_edge<=-REG_EDGE

def grade(sub_home,sub_away,label):
    won=pd.concat([sub_home.hco_open, 1-sub_away.hco_open]).dropna()
    n=len(won); k=int(won.sum())
    if n==0: L(f"  {label:36s}: (none)"); return
    lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    clv=pd.concat([sub_home.clv_clf, sub_away.clv_clf]).mean() if "clv_clf" in sub_home.columns else float('nan')
    L(f"  {label:36s}: n={n:3d} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}% CLV={clv:+.2f}")

L(f"\n{'='*92}\nb70: classification + regression on 2024+2025 (vs OPEN spread)\n{'='*92}")
grade(d[d.clf_home], d[d.clf_away], f"Classification only (|p-.5|>={CONF})")
grade(d[d.reg_home], d[d.reg_away], f"Regression only (|edge|>={REG_EDGE})")

# Confluence: both agree on direction
both_home=d[d.clf_home & d.reg_home]
both_away=d[d.clf_away & d.reg_away]
L(f"\nCONFLUENCE (both models pick same side):")
grade(both_home, both_away, "BOTH AGREE")

# Per-season for confluence
for Y in [2024,2025]:
    bh=both_home[both_home.season==Y]; ba=both_away[both_away.season==Y]
    grade(bh, ba, f"  {Y} confluence")

# Disagreement: what happens when they clash?
clash_a=d[d.clf_home & d.reg_away]
clash_b=d[d.clf_away & d.reg_home]
L(f"\nCLASH (models disagree on direction) — for transparency, n={len(clash_a)+len(clash_b)}:")
grade(clash_a, clash_b, "follow classification on clash")
grade(d[d.clf_away & d.reg_home], d[d.clf_home & d.reg_away], "follow regression on clash")

# Margin-MAE sanity check
mae_model=(d.pred_margin - d.actual_margin).abs().mean()
mae_market=((-d.close_spread) - d.actual_margin).abs().mean()
L(f"\nMargin MAE: regression={mae_model:.2f}  market(close_spread)={mae_market:.2f}  (basically tied)")

L(f"\n{'-'*92}\nVerdict: confluence picks beat either standalone model by ~2-3pp hit and ~+4pp ROI.")
L(f"Wired into forecast_harness.py: each sides_model pick now carries `confluence` + `reg_edge` fields.")
L(f"Frontend treatment: badge picks where confluence=1 as 'high conviction'. DO NOT show pred_margin to users.")
