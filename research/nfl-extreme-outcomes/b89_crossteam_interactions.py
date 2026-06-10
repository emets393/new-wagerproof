"""
b89 — MODEL IMPROVEMENT 2: cross-team AGGREGATED / INTERACTION features.

IDEA (user): the locked BASE treats each team's stats separately (plus a few diffs).
Build true MATCHUP features: home offense vs away defense (and mirror), net mismatch,
game-quality sums — let the model see the interaction directly.

CANDIDATES (auto-discovered from matchup.parquet home_off_*/away_def_* as-of columns)
  For each metric X with suffix in {_s2d,_last3,_last5}:
    hX_vs_aD = home_off_X - away_def_X       (home attack edge; def metrics are what they ALLOW)
    aX_vs_hD = away_off_X - home_def_X       (away attack edge)
    net_X    = hX_vs_aD - aX_vs_hD           (net home edge in this dimension)
    sum_X    = hX_vs_aD + aX_vs_hD           (game-level production environment)
  Hand-crafted aggregates:
    quality_sum  = home_predictive_pr + away_predictive_pr
    quality_gap  = |pr_diff|
    consistency_gap = home_consistency_pr - away_consistency_pr
    form_x_quality = last5_diff * pr_diff  (hot AND good vs hot-but-bad)

WALK-FORWARD: identical folds to b88/locked (train <Y, week>=4). Per-fold feature
selection for W2 uses TRAIN data only (corr with home_cover in train) — no test leakage.

VARIANTS
  W0 = locked BASE (control)
  W1 = BASE + ALL net_X features (HistGBM regularizes)
  W2 = BASE + top-12 per-fold train-selected interactions
  W3 = BASE + hand-crafted aggregates only
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score, log_loss
from stats_helpers import wilson_ci
from forecast_harness import build
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"); L = print

m, BASE = build()
L(f"[build] {m.shape}, BASE={len(BASE)}")

# off stem -> def "allowed" stem (def metrics measure what the defense ALLOWS/forces, so the
# matchup expectation is off_X + opp_def_allowed_X, not a difference)
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
INTER, NETS = [], []
for x, dx in PAIRS.items():
    ho, ad = f"home_off_{x}", f"away_def_{dx}"
    ao, hd = f"away_off_{x}", f"home_def_{dx}"
    if not all(c in m.columns for c in (ho, ad, ao, hd)): continue
    hexp = pd.to_numeric(m[ho], errors="coerce") + pd.to_numeric(m[ad], errors="coerce")
    aexp = pd.to_numeric(m[ao], errors="coerce") + pd.to_numeric(m[hd], errors="coerce")
    m[f"hexp_{x}"] = hexp; m[f"aexp_{x}"] = aexp
    m[f"net_{x}"] = hexp - aexp
    m[f"sum_{x}"] = hexp + aexp
    INTER += [f"hexp_{x}", f"aexp_{x}", f"net_{x}", f"sum_{x}"]
    NETS.append(f"net_{x}")
L(f"[features] built {len(INTER)} interaction cols ({len(NETS)} nets)")
assert NETS, "pair mapping built nothing — column names changed?"

m["quality_sum"] = m.home_predictive_pr + m.away_predictive_pr
m["quality_gap"] = m.pr_diff.abs()
m["consistency_gap"] = m.home_consistency_pr - m.away_consistency_pr
m["form_x_quality"] = m.last5_diff * m.pr_diff
HAND = ["quality_sum", "quality_gap", "consistency_gap", "form_x_quality"]

def run_fold(target, variant):
    tr = m[(m.season < target) & (m.week >= 4)].dropna(subset=["home_cover"])
    te = m[m.season == target].dropna(subset=["home_cover"]).copy()
    if len(tr) < 300 or len(te) == 0: return None
    if variant == "W0": feats = BASE
    elif variant == "W1": feats = BASE + NETS
    elif variant == "W2":
        cors = {}
        for f in INTER:
            v = pd.to_numeric(tr[f], errors="coerce")
            if v.notna().sum() < 200: continue
            c = np.corrcoef(v.fillna(v.median()), tr.home_cover)[0, 1]
            if np.isfinite(c): cors[f] = abs(c)
        top = sorted(cors, key=cors.get, reverse=True)[:12]
        feats = BASE + top
    else: feats = BASE + HAND
    clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300,
                                         l2_regularization=2.0, min_samples_leaf=40, random_state=0)
    clf.fit(tr[feats].apply(pd.to_numeric, errors="coerce"), tr.home_cover)
    te["ph"] = clf.predict_proba(te[feats].apply(pd.to_numeric, errors="coerce"))[:, 1]
    return te

def eval_te(te):
    y = te.home_cover.values; p = te.ph.values
    out = dict(auc=roc_auc_score(y, p) if len(set(y)) > 1 else np.nan,
               logloss=log_loss(y, p, labels=[0, 1]))
    push = (te.actual_margin + te.home_spread) == 0
    for tag, cut in [("c03", 0.03), ("c06", 0.06), ("c10", 0.10)]:
        pick = (np.abs(p - 0.5) >= cut) & (~push.values)
        sub_y = y[pick]; sub_p = p[pick]
        wins = int(((sub_p >= 0.5) == (sub_y == 1)).sum())
        out[f"{tag}_n"] = int(pick.sum()); out[f"{tag}_w"] = wins
        out[f"{tag}_hit"] = wins / pick.sum() * 100 if pick.sum() else np.nan
    return out

YEARS = list(range(2019, 2026)); VARS = ["W0", "W1", "W2", "W3"]
res = {v: [] for v in VARS}
for v in VARS:
    for y in YEARS:
        te = run_fold(y, v)
        if te is None: continue
        e = eval_te(te); e["season"] = y; res[v].append(e)
    res[v] = pd.DataFrame(res[v])

L("\n" + "=" * 96)
L("PER-SEASON c03 picks hit% vs CLOSE")
L("=" * 96)
L(f"{'season':7s}" + "".join(f"{v:>20s}" for v in VARS))
for y in YEARS:
    line = f"{y:<7d}"
    for v in VARS:
        r = res[v][res[v].season == y]
        line += f"{'--':>20s}" if len(r) == 0 else f"{r.iloc[0].c03_w:>5.0f}/{r.iloc[0].c03_n:<4.0f}={r.iloc[0].c03_hit:5.1f}%   "
    L(line)
L("\nPOOLED:")
for v in VARS:
    df = res[v]
    for tag in ["c03", "c06", "c10"]:
        w = df[f"{tag}_w"].sum(); n = df[f"{tag}_n"].sum()
        if n == 0: continue
        lo, hi = wilson_ci(int(w), int(n))
        h = df[df.season == 2025]
        hs = f"  2025: {h.iloc[0][f'{tag}_w']:.0f}/{h.iloc[0][f'{tag}_n']:.0f}={h.iloc[0][f'{tag}_hit']:.1f}%" if len(h) and h.iloc[0][f"{tag}_n"] > 0 else ""
        L(f"  {v} {tag}: {w:4.0f}/{n:4.0f}={w/n*100:5.2f}% CI[{lo*100:.1f},{hi*100:.1f}]{hs}")
    L(f"  {v} mean AUC={df.auc.mean():.4f}  logloss={df.logloss.mean():.4f}")
L("\n[done] b89")
