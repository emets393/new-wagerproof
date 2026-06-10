"""
b90 — MODEL IMPROVEMENT 3: ML architecture shootout on IDENTICAL walk-forward folds.

Same features (locked BASE), same folds (train <Y week>=4, test Y), 2019-2025.
Contestants:
  M0 HistGBM (locked control, exact locked hyperparams)
  M1 HistGBM seed-ensemble (5 seeds averaged — cheap variance reduction)
  M2 XGBoost (if installed)
  M3 LightGBM (if installed)
  M4 RandomForest (500 trees, depth-limited)
  M5 Logistic regression (median-impute + standardize)
  M6 Calibrated HistGBM (isotonic, 3-fold CV inside TRAIN only)
  M7 Soft-vote stack: mean(HistGBM, RF, LogReg) probabilities
Metrics: AUC, logloss, hit% vs CLOSE at c03/c06/c10, plus CALIBRATION table for the
c06+ bucket (predicted vs realized) — mammoth detection needs trustworthy probabilities.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, log_loss
from stats_helpers import wilson_ci
from forecast_harness import build
L = print

try: from xgboost import XGBClassifier; HAS_XGB = True
except Exception: HAS_XGB = False
try: from lightgbm import LGBMClassifier; HAS_LGB = True
except Exception: HAS_LGB = False
L(f"[env] xgboost={HAS_XGB} lightgbm={HAS_LGB}")

m, BASE = build()

def hist(seed=0):
    return HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300,
                                          l2_regularization=2.0, min_samples_leaf=40, random_state=seed)

def fit_predict(model_key, X_tr, y_tr, X_te):
    if model_key == "M0_histgbm":
        return hist().fit(X_tr, y_tr).predict_proba(X_te)[:, 1]
    if model_key == "M1_hist_seeds":
        return np.mean([hist(s).fit(X_tr, y_tr).predict_proba(X_te)[:, 1] for s in range(5)], axis=0)
    if model_key == "M2_xgboost":
        mdl = XGBClassifier(max_depth=3, learning_rate=0.05, n_estimators=300, reg_lambda=2.0,
                            min_child_weight=40, subsample=0.9, colsample_bytree=0.9,
                            eval_metric="logloss", random_state=0, verbosity=0)
        return mdl.fit(X_tr, y_tr).predict_proba(X_te)[:, 1]
    if model_key == "M3_lightgbm":
        mdl = LGBMClassifier(max_depth=3, learning_rate=0.05, n_estimators=300, reg_lambda=2.0,
                             min_child_samples=40, subsample=0.9, colsample_bytree=0.9,
                             random_state=0, verbosity=-1)
        return mdl.fit(X_tr, y_tr).predict_proba(X_te)[:, 1]
    if model_key == "M4_rf":
        pipe = make_pipeline(SimpleImputer(strategy="median"),
                             RandomForestClassifier(n_estimators=500, max_depth=6, min_samples_leaf=20,
                                                    random_state=0, n_jobs=-1))
        return pipe.fit(X_tr, y_tr).predict_proba(X_te)[:, 1]
    if model_key == "M5_logreg":
        pipe = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                             LogisticRegression(C=0.5, max_iter=2000))
        return pipe.fit(X_tr, y_tr).predict_proba(X_te)[:, 1]
    if model_key == "M6_calibrated":
        mdl = CalibratedClassifierCV(hist(), method="isotonic", cv=3)
        return mdl.fit(X_tr, y_tr).predict_proba(X_te)[:, 1]
    if model_key == "M7_stack":
        p1 = hist().fit(X_tr, y_tr).predict_proba(X_te)[:, 1]
        p2 = fit_predict("M4_rf", X_tr, y_tr, X_te)
        p3 = fit_predict("M5_logreg", X_tr, y_tr, X_te)
        return (p1 + p2 + p3) / 3
    raise ValueError(model_key)

MODELS = ["M0_histgbm", "M1_hist_seeds"] + (["M2_xgboost"] if HAS_XGB else []) + \
         (["M3_lightgbm"] if HAS_LGB else []) + ["M4_rf", "M5_logreg", "M6_calibrated", "M7_stack"]
YEARS = list(range(2019, 2026))

def eval_fold(te, p):
    y = te.home_cover.values
    out = dict(auc=roc_auc_score(y, p) if len(set(y)) > 1 else np.nan, logloss=log_loss(y, p, labels=[0, 1]))
    push = (te.actual_margin + te.home_spread) == 0
    for tag, cut in [("c03", 0.03), ("c06", 0.06), ("c10", 0.10)]:
        pick = (np.abs(p - 0.5) >= cut) & (~push.values)
        wins = int(((p[pick] >= 0.5) == (y[pick] == 1)).sum())
        out[f"{tag}_n"] = int(pick.sum()); out[f"{tag}_w"] = wins
        out[f"{tag}_hit"] = wins / pick.sum() * 100 if pick.sum() else np.nan
    return out

res = {k: [] for k in MODELS}; preds = {k: [] for k in MODELS}
for y in YEARS:
    tr = m[(m.season < y) & (m.week >= 4)].dropna(subset=["home_cover"])
    te = m[m.season == y].dropna(subset=["home_cover"]).copy()
    X_tr = tr[BASE].apply(pd.to_numeric, errors="coerce"); X_te = te[BASE].apply(pd.to_numeric, errors="coerce")
    for k in MODELS:
        p = fit_predict(k, X_tr, tr.home_cover, X_te)
        e = eval_fold(te, p); e["season"] = y; res[k].append(e)
        d = te[["season", "week", "home_ab", "away_ab", "home_cover", "actual_margin", "home_spread"]].copy()
        d["ph"] = p; preds[k].append(d)

L("\n" + "=" * 100)
L("ARCHITECTURE SHOOTOUT — pooled 2019-2025, hit% vs CLOSE")
L("=" * 100)
for k in MODELS:
    df = pd.DataFrame(res[k])
    line = f"{k:16s} AUC={df.auc.mean():.4f} LL={df.logloss.mean():.4f}"
    for tag in ["c03", "c06", "c10"]:
        w = df[f"{tag}_w"].sum(); n = df[f"{tag}_n"].sum()
        if n: lo, hi = wilson_ci(int(w), int(n)); line += f"  {tag}:{w:.0f}/{n:.0f}={w/n*100:.1f}%[{lo*100:.0f},{hi*100:.0f}]"
    L(line)
L("\nPER-SEASON c03 hit%:")
L(f"{'season':7s}" + "".join(f"{k.split('_')[0]:>10s}" for k in MODELS))
for y in YEARS:
    line = f"{y:<7d}"
    for k in MODELS:
        df = pd.DataFrame(res[k]); r = df[df.season == y]
        line += f"{'--':>10s}" if len(r) == 0 or r.iloc[0].c03_n == 0 else f"{r.iloc[0].c03_hit:>9.1f}%"
    L(line)

L("\nCALIBRATION (pooled, bucket by predicted favorite-side prob):")
for k in MODELS:
    d = pd.concat(preds[k], ignore_index=True)
    d["pmax"] = np.maximum(d.ph, 1 - d.ph)
    d["correct"] = ((d.ph >= 0.5) == (d.home_cover == 1)).astype(float)
    push = (d.actual_margin + d.home_spread) == 0
    d = d[~push]
    d["bucket"] = pd.cut(d.pmax, [0.5, 0.53, 0.56, 0.60, 0.65, 1.0])
    g = d.groupby("bucket").agg(n=("correct", "size"), pred=("pmax", "mean"), real=("correct", "mean"))
    line = f"{k:16s} " + " | ".join(f"{str(b)[1:-1]}: n={r.n} pred={r.pred*100:.0f}% real={r.real*100:.0f}%" for b, r in g.iterrows() if r.n > 0)
    L(line)
L("\n[done] b90")
