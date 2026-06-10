"""
b90b — CONFIRMATION RUN: cross b89's winner (BASE + net matchup features) with b90's
winner (linear model / blend), and grade like the REAL PRODUCT (pick at conf>=0.03,
bet the OPENER, grade vs the opener) so numbers are comparable to the locked sides
model's honest ~53.5%.

MULTIPLICITY WARNING (honesty): b88-b90 explored many variants on the same folds; this
run is the pre-registered confirmation of the two specific winners. If the lift shrinks
here, the locked model stands.

GRID: features {BASE, BASE+NETS} x models {histgbm(locked hp), logreg, 50/50 blend}
EVAL:
  A) vs CLOSE, c03/c06, per-season 2019-2025 (full history)
  B) vs OPENER (product-style), per-season 2023-2025 (odds_consensus coverage), with CLV
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score
from stats_helpers import wilson_ci
from forecast_harness import build
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"); L = print

m, BASE = build()
PAIRS = {
    "pass_epa_neutral_s2d": "pass_epa_allowed_neutral_s2d",
    "rush_epa_neutral_s2d": "rush_epa_allowed_neutral_s2d",
    "ed_pass_epa_s2d": "ed_pass_epa_allowed_s2d",
    "ed_rush_epa_s2d": "ed_rush_epa_allowed_s2d",
    "early_down_pass_epa_s2d": "early_down_pass_epa_allowed_s2d",
    "early_down_rush_epa_s2d": "early_down_rush_epa_allowed_s2d",
    "explosive_pass_s2d": "explosive_pass_allowed_s2d",
    "explosive_rush_s2d": "explosive_rush_allowed_s2d",
    "pa_epa_s2d": "pa_epa_allowed_s2d",
    "motion_epa_s2d": "motion_epa_allowed_s2d",
    "ppd_s2d": "ppd_allowed_s2d",
    "pts_per_drive_s2d": "pts_per_drive_allowed_s2d",
    "pass_sr_s2d": "pass_sr_allowed_s2d",
    "rush_sr_s2d": "rush_sr_allowed_s2d",
    "pass_success_rate_s2d": "pass_success_allowed_s2d",
    "rush_success_rate_s2d": "rush_success_allowed_s2d",
    "rz_td_rate_s2d": "rz_td_rate_allowed_s2d",
    "td_pct_per_drive_s2d": "td_pct_per_drive_allowed_s2d",
    "td_per_drive_s2d": "td_per_drive_allowed_s2d",
    "three_and_out_rate_s2d": "three_and_out_forced_s2d",
    "3andout_s2d": "3andout_forced_s2d",
}
NETS = []
for x, dx in PAIRS.items():
    ho, ad, ao, hd = f"home_off_{x}", f"away_def_{dx}", f"away_off_{x}", f"home_def_{dx}"
    if not all(c in m.columns for c in (ho, ad, ao, hd)): continue
    hexp = pd.to_numeric(m[ho], errors="coerce") + pd.to_numeric(m[ad], errors="coerce")
    aexp = pd.to_numeric(m[ao], errors="coerce") + pd.to_numeric(m[hd], errors="coerce")
    m[f"net_{x}"] = hexp - aexp; NETS.append(f"net_{x}")
L(f"[nets] {len(NETS)}")

od = pd.read_parquet(os.path.join(DATA, "odds_consensus.parquet"))
m = m.merge(od[["season", "home_ab", "away_ab", "open_spread", "close_spread"]],
            on=["season", "home_ab", "away_ab"], how="left")

def hist():
    return HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300,
                                          l2_regularization=2.0, min_samples_leaf=40, random_state=0)
def logreg():
    return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                         LogisticRegression(C=0.5, max_iter=2000))

GRID = {
    "hist_BASE":   ("hist", BASE),
    "hist_NETS":   ("hist", BASE + NETS),
    "lr_BASE":     ("lr", BASE),
    "lr_NETS":     ("lr", BASE + NETS),
    "blend_BASE":  ("blend", BASE),
    "blend_NETS":  ("blend", BASE + NETS),
}
YEARS = list(range(2019, 2026))
preds = {k: [] for k in GRID}
for y in YEARS:
    tr = m[(m.season < y) & (m.week >= 4)].dropna(subset=["home_cover"])
    te = m[m.season == y].dropna(subset=["home_cover"]).copy()
    if len(tr) < 300 or len(te) == 0: continue
    for k, (mod, feats) in GRID.items():
        X_tr = tr[feats].apply(pd.to_numeric, errors="coerce"); X_te = te[feats].apply(pd.to_numeric, errors="coerce")
        if mod == "hist": p = hist().fit(X_tr, tr.home_cover).predict_proba(X_te)[:, 1]
        elif mod == "lr": p = logreg().fit(X_tr, tr.home_cover).predict_proba(X_te)[:, 1]
        else:
            p = (hist().fit(X_tr, tr.home_cover).predict_proba(X_te)[:, 1] +
                 logreg().fit(X_tr, tr.home_cover).predict_proba(X_te)[:, 1]) / 2
        d = te[["season", "week", "home_ab", "away_ab", "home_cover", "actual_margin",
                "home_spread", "open_spread", "close_spread"]].copy()
        d["ph"] = p; preds[k].append(d)

L("\n" + "=" * 96)
L("A) vs CLOSE — pooled 2019-2025 and per-season c03")
L("=" * 96)
for k in GRID:
    d = pd.concat(preds[k], ignore_index=True)
    d = d[(d.actual_margin + d.home_spread) != 0]
    auc = roc_auc_score(d.home_cover, d.ph)
    line = f"{k:12s} AUC={auc:.4f}"
    for tag, cut in [("c03", 0.03), ("c06", 0.06)]:
        pick = d[np.abs(d.ph - 0.5) >= cut]
        w = int(((pick.ph >= 0.5) == (pick.home_cover == 1)).sum()); n = len(pick)
        lo, hi = wilson_ci(w, n)
        line += f"  {tag}:{w}/{n}={w/n*100:.1f}%[{lo*100:.0f},{hi*100:.0f}]"
    h = d[(d.season == 2025) & (np.abs(d.ph - 0.5) >= 0.03)]
    w = int(((h.ph >= 0.5) == (h.home_cover == 1)).sum())
    line += f"  2025c03:{w}/{len(h)}={w/len(h)*100:.1f}%"
    L(line)
L("\nper-season c03 vs CLOSE:")
L(f"{'season':7s}" + "".join(f"{k:>13s}" for k in GRID))
for y in YEARS:
    line = f"{y:<7d}"
    for k in GRID:
        d = pd.concat(preds[k], ignore_index=True)
        d = d[(d.season == y) & ((d.actual_margin + d.home_spread) != 0) & (np.abs(d.ph - 0.5) >= 0.03)]
        if len(d) == 0: line += f"{'--':>13s}"; continue
        w = int(((d.ph >= 0.5) == (d.home_cover == 1)).sum())
        line += f"{w/len(d)*100:>12.1f}%"
    L(line)

L("\n" + "=" * 96)
L("B) PRODUCT-STYLE — pick at c03, bet + grade at the OPENER, per-season (locked honest ~53.5%)")
L("=" * 96)
for k in GRID:
    d = pd.concat(preds[k], ignore_index=True).dropna(subset=["open_spread"])
    d["bet_home"] = d.ph >= 0.5
    d = d[np.abs(d.ph - 0.5) >= 0.03]
    d["mgn"] = np.where(d.bet_home, d.actual_margin + d.open_spread, -(d.actual_margin + d.open_spread))
    d = d[d.mgn != 0]
    d["win"] = (d.mgn > 0).astype(float)
    d["clv"] = np.where(d.bet_home, d.open_spread - d.close_spread, d.close_spread - d.open_spread)
    w = int(d.win.sum()); n = len(d); lo, hi = wilson_ci(w, n)
    roi = (w * (100 / 110) - (n - w)) / n * 100
    line = f"{k:12s} ALL:{w}/{n}={w/n*100:.1f}%[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}% CLV={d.clv.mean():+.2f} | "
    for y in [2023, 2024, 2025]:
        s = d[d.season == y]
        if len(s) == 0: continue
        ws = int(s.win.sum())
        line += f"{y}:{ws}/{len(s)}={ws/len(s)*100:.1f}% "
    L(line)
L("\n[done] b90b")
