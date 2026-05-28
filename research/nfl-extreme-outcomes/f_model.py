"""
Avenue J — walk-forward gradient boosting to surface non-linear interactions and test
out-of-sample exploitability. Targets:
  (1) blow-up (spread_miss>=21)  -> expect AUC ~0.5 (unpredictable variance)
  (2) over/under (over_win)      -> can a model beat 52.4% ATS out-of-sample?
  (3) big_under                  -> can we flag extreme unders pre-game?
Walk-forward: train seasons < S, test season S. Permutation importances on the totals model.
"""
import os, sys, warnings
import numpy as np
import pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import roc_auc_score

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "master.parquet"))
L = print

# ---- targets ----
m["over_win"] = np.where(m["total_diff"] > 0, 1, np.where(m["total_diff"] < 0, 0, np.nan))
m["under_win"] = 1 - m["over_win"]
m["home_cover"] = np.where(m["spread_diff"] > 0, 1, np.where(m["spread_diff"] < 0, 0, np.nan))
m["blowup"] = (m["spread_miss"] >= 21).astype(int)
m["big_under"] = (m["total_diff"] <= -21).astype(int)
m["big_over"] = (m["total_diff"] >= 21).astype(int)

# ---- engineered leak-safe features ----
m["is_outdoor"] = m["roof"].isin(["outdoors", "open"]).astype(int)
m["pr_diff"] = m["home_predictive_pr"] - m["away_predictive_pr"]
m["pr_sum"] = m["home_predictive_pr"] + m["away_predictive_pr"]
m["abs_spread"] = m["home_spread"].abs()
m["pace_sum"] = m["home_off_plays_per_game_s2d"] + m["away_off_plays_per_game_s2d"]
m["ppd_sum"] = m["home_off_ppd_s2d"] + m["away_off_ppd_s2d"]
m["wind_out"] = np.where(m["is_outdoor"] == 1, m["wind_mph"], 0.0)  # 0 wind effect indoors

FEATURES = [
    "ou_vegas_line", "home_spread", "abs_spread", "home_fav", "pr_diff", "pr_sum",
    "wind_mph", "wind_out", "temp_f", "precipitation_pct", "is_outdoor", "dome_closed",
    "primetime", "kick_hour_et", "is_thu", "is_mon", "div_game", "week", "home_rest", "away_rest",
    "ref_total_pts_avg", "pace_sum", "ppd_sum", "any_backup_qb",
    "home_off_explosive_pass_s2d", "away_off_explosive_pass_s2d",
    "home_off_proe_s2d", "away_off_proe_s2d", "home_off_no_huddle_s2d", "away_off_no_huddle_s2d",
    "home_off_ed_pass_epa_s2d", "away_off_ed_pass_epa_s2d",
    "home_def_ed_pass_epa_allowed_s2d", "away_def_ed_pass_epa_allowed_s2d",
    "home_consistency_pr", "away_consistency_pr", "home_last5_pr", "away_last5_pr",
]
FEATURES = [f for f in FEATURES if f in m.columns]
for f in FEATURES:
    m[f] = pd.to_numeric(m[f], errors="coerce")


def walk_forward(target, test_seasons, label, conf_grid=(0.0, 0.04, 0.08, 0.12)):
    """Train on prior seasons, predict each test season. Returns oof predictions."""
    oof = []
    aucs = []
    for S in test_seasons:
        tr = m[(m["season"] < S) & m[target].notna()]
        te = m[(m["season"] == S) & m[target].notna()]
        if len(tr) < 300 or len(te) < 20:
            continue
        clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300,
                                             l2_regularization=1.0, min_samples_leaf=40,
                                             random_state=0)
        clf.fit(tr[FEATURES], tr[target].astype(int))
        p = clf.predict_proba(te[FEATURES])[:, 1]
        try:
            auc = roc_auc_score(te[target].astype(int), p)
        except Exception:
            auc = np.nan
        aucs.append((S, auc, len(te)))
        t = te[[target, "season"]].copy(); t["p"] = p
        oof.append(t)
    oof = pd.concat(oof) if oof else pd.DataFrame()
    L(f"\n== {label}: walk-forward AUC by test season ==")
    for S, a, n in aucs:
        L(f"   {S}: AUC={a:.3f} (n={n})")
    if len(aucs):
        L(f"   mean AUC={np.nanmean([a for _,a,_ in aucs]):.3f}")
    return oof


L("="*90); L("AVENUE J — WALK-FORWARD MODELS"); L("="*90)
L(f"features used: {len(FEATURES)}")

# (1) Blow-up: expect unpredictable
oof = walk_forward("blowup", range(2020, 2026), "SPREAD BLOW-UP (>=21)")

# (2) home cover: expect ~0.5 / unbeatable
oof_sp = walk_forward("home_cover", range(2020, 2026), "HOME ATS COVER")
if len(oof_sp):
    for c in [0.0, 0.05, 0.10]:
        pick_home = oof_sp[oof_sp["p"] >= 0.5 + c]
        pick_away = oof_sp[oof_sp["p"] <= 0.5 - c]
        out = pd.concat([pick_home["home_cover"], 1 - pick_away["home_cover"]]).dropna()
        wins = int((out == 1).sum()); n = int(out.isin([0, 1]).sum())
        L("   ATS confident pick conf>=%.2f: " % c + fmt(bet_summary(wins, n, f"c{c}", -110)))

# (3) over/under: can model beat the vig?
oof_ou = walk_forward("over_win", range(2020, 2026), "TOTAL OVER/UNDER")
if len(oof_ou):
    L("\n  -- O/U model: bet the confident side, per confidence threshold --")
    for c in [0.0, 0.04, 0.08, 0.12]:
        pick_over = oof_ou[oof_ou["p"] >= 0.5 + c]
        pick_under = oof_ou[oof_ou["p"] <= 0.5 - c]
        out = pd.concat([pick_over["over_win"], 1 - pick_under["over_win"]]).dropna()
        wins = int((out == 1).sum()); n = int(out.isin([0, 1]).sum())
        L("   O/U confident pick conf>=%.2f: " % c + fmt(bet_summary(wins, n, f"c{c}", -110)))
    # per-season at conf>=0.08
    L("\n  -- O/U model conf>=0.08, per season --")
    for S in sorted(oof_ou["season"].unique()):
        ss = oof_ou[oof_ou["season"] == S]
        po = ss[ss["p"] >= 0.58]; pu = ss[ss["p"] <= 0.42]
        out = pd.concat([po["over_win"], 1 - pu["over_win"]]).dropna()
        wins = int((out == 1).sum()); n = int(out.isin([0, 1]).sum())
        L("     " + fmt(bet_summary(wins, n, str(int(S)), -110)))

# (4) big_under flag
oof_bu = walk_forward("big_under", range(2020, 2026), "BIG UNDER (<=-21)")

# ---- permutation importance on a full-sample O/U model (descriptive) ----
L("\n== Permutation importance (O/U model, train<=2024 test=2025) ==")
tr = m[(m["season"] <= 2024) & m["over_win"].notna()]
te = m[(m["season"] == 2025) & m["over_win"].notna()]
clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300,
                                     l2_regularization=1.0, min_samples_leaf=40, random_state=0)
clf.fit(tr[FEATURES], tr["over_win"].astype(int))
pi = permutation_importance(clf, te[FEATURES], te["over_win"].astype(int), n_repeats=20,
                            random_state=0, scoring="roc_auc")
imp = pd.DataFrame({"feature": FEATURES, "imp": pi.importances_mean}).sort_values("imp", ascending=False)
for _, r in imp.head(15).iterrows():
    L(f"   {r['feature']:34s} {r['imp']:+.4f}")
