"""
b86 — Composite regression model: combine top b85 signals into a predictive model.

GOAL
  Take the top signals from b85 and build a unified predictor of next-game
  off_resid and def_resid (residual from season avg). Then identify which games
  in 2025 had the strongest regression signals and verify whether those teams
  actually regressed.

PIPELINE
  1. Use top 12 OFF signals + top 12 DEF signals from b85 as feature set
  2. Walk-forward train HistGradientBoostingRegressor on each target
  3. Per-game: predict each team's off_resid and def_resid
  4. Test predictive power on 2025 holdout
  5. Identify "high conviction" regression spots (top/bottom decile predictions)
  6. Test: do those spots actually regress as predicted?

  Then betting application:
  7. Predicted game total = (team_a_asof_avg + team_a_pred_off_resid) +
                           (team_b_asof_avg + team_b_pred_off_resid)... etc
  8. Compare to market implied total, identify edge
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m = pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_total"] = m.home_score + m.away_score
m["actual_margin"] = m.home_score - m.away_score
L(f"[load] matchup: {m.shape}")

SAFE_SFX = ("_s2d","_last3","_last5")
OFF_METRICS = sorted({c.replace("home_off_","").replace("away_off_","") for c in m.columns
                      if (c.startswith("home_off_") or c.startswith("away_off_"))
                      and c.endswith(SAFE_SFX)})
DEF_METRICS = sorted({c.replace("home_def_","").replace("away_def_","") for c in m.columns
                      if (c.startswith("home_def_") or c.startswith("away_def_"))
                      and c.endswith(SAFE_SFX)})

def long_frame(df):
    h = df[["season","week","home_ab","away_ab","home_score","away_score"]].rename(
        columns={"home_ab":"team","away_ab":"opp","home_score":"pts_for","away_score":"pts_against"})
    h["is_home"]=1
    a = df[["season","week","away_ab","home_ab","away_score","home_score"]].rename(
        columns={"away_ab":"team","home_ab":"opp","away_score":"pts_for","home_score":"pts_against"})
    a["is_home"]=0
    for c in OFF_METRICS:
        if f"home_off_{c}" in df.columns: h[f"off_{c}"] = df[f"home_off_{c}"]
        if f"away_off_{c}" in df.columns: a[f"off_{c}"] = df[f"away_off_{c}"]
    for c in DEF_METRICS:
        if f"home_def_{c}" in df.columns: h[f"def_{c}"] = df[f"home_def_{c}"]
        if f"away_def_{c}" in df.columns: a[f"def_{c}"] = df[f"away_def_{c}"]
    return pd.concat([h,a], ignore_index=True)

tg = long_frame(m).sort_values(["season","team","week"]).reset_index(drop=True)

def asof_ppg(group):
    group = group.sort_values("week")
    cn = group.pts_for.expanding().count().shift(1)
    group["asof_n"] = cn
    group["asof_pts_for"] = group.pts_for.expanding().sum().shift(1) / cn
    group["asof_pts_against"] = group.pts_against.expanding().sum().shift(1) / cn
    group["asof_pts_for_std"] = group.pts_for.expanding().std().shift(1)
    group["asof_pts_against_std"] = group.pts_against.expanding().std().shift(1)
    group["last3_pts_for"] = group.pts_for.shift(1).rolling(3).mean()
    group["last3_pts_against"] = group.pts_against.shift(1).rolling(3).mean()
    return group
tg = tg.groupby(["season","team"], group_keys=False).apply(asof_ppg)
tg["last3_for_resid"]   = tg.last3_pts_for - tg.asof_pts_for
tg["last3_against_resid"]= tg.last3_pts_against - tg.asof_pts_against
tg["cv_for"]   = tg.asof_pts_for_std / tg.asof_pts_for
tg["cv_against"] = tg.asof_pts_against_std / tg.asof_pts_against
# Targets
tg["off_resid"] = tg.pts_for - tg.asof_pts_for
tg["def_resid"] = tg.pts_against - tg.asof_pts_against
qual = tg[tg.asof_n>=4].copy()
L(f"[qual] {len(qual)} team-games")

# ============================================================================
# FEATURES — top 12 from b85 + derived helpers
# ============================================================================
OFF_FEATS = ["cv_for", "last3_for_resid",
             "off_non_pa_epa_s2d", "off_td_pct_per_drive_s2d", "off_pts_per_drive_s2d",
             "off_ppd_s2d", "off_non_motion_epa_s2d", "off_motion_epa_s2d",
             "off_pass_success_rate_last3", "off_pass_sr_last3",
             "off_explosive_pass_rate_s2d", "off_pass_epa_neutral_s2d"]
DEF_FEATS = ["cv_against", "last3_against_resid",
             "def_pass_epa_s2d", "def_pass_epa_last3", "def_motion_epa_allowed_s2d",
             "def_pts_per_drive_allowed_s2d", "def_ppd_allowed_s2d",
             "def_td_pct_per_drive_allowed_s2d", "def_pass_sr_allowed_s2d",
             "def_explosive_pass_allowed_s2d", "def_pass_epa_allowed_neutral_s2d",
             "def_rush_epa_s2d"]
OFF_FEATS = [c for c in OFF_FEATS if c in qual.columns]
DEF_FEATS = [c for c in DEF_FEATS if c in qual.columns]
L(f"[features] OFF: {len(OFF_FEATS)}  DEF: {len(DEF_FEATS)}")

for c in OFF_FEATS + DEF_FEATS:
    qual[c] = pd.to_numeric(qual[c], errors='coerce')

# ============================================================================
# WALK-FORWARD MODEL TRAINING
# ============================================================================
def walk_forward_predict(qual, feats, target):
    out = qual.copy()
    out[f"pred_{target}"] = np.nan
    for target_year in sorted(qual.season.unique()):
        train = qual[qual.season<target_year].dropna(subset=[target]+feats)
        if len(train)<200: continue
        test_idx = qual[qual.season==target_year].index
        test = qual.loc[test_idx]
        # Numericize + drop high-NaN features per fold
        keep = [f for f in feats if train[f].notna().sum()/len(train)>=0.5]
        reg = HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05, max_iter=400,
            l2_regularization=2.0, min_samples_leaf=30, random_state=0).fit(train[keep], train[target])
        out.loc[test_idx, f"pred_{target}"] = reg.predict(test[keep])
    return out

L(f"\n[train] OFF model...")
qual2 = walk_forward_predict(qual, OFF_FEATS, "off_resid")
L(f"[train] DEF model...")
qual2 = walk_forward_predict(qual2, DEF_FEATS, "def_resid")

# ============================================================================
# Predictive power: model correlation with actuals
# ============================================================================
L(f"\n{'='*92}\nMODEL PREDICTIVE POWER (composite model vs single best signal)\n{'='*92}")
for target, single_best in [("off_resid","cv_for"), ("def_resid","def_pass_epa_s2d")]:
    L(f"\n  Target = {target}")
    for s in sorted(qual2.season.unique()):
        sy = qual2[qual2.season==s].dropna(subset=[target, f"pred_{target}"])
        if len(sy)<30: continue
        model_r = sy[target].corr(sy[f"pred_{target}"])
        single_r = sy[target].corr(sy[single_best]) if single_best in sy.columns else np.nan
        L(f"    {s}: n={len(sy):4d}  model_pearson={model_r:+.3f}  single({single_best})={single_r:+.3f}")

# ============================================================================
# Quartile analysis on PREDICTIONS — does the model's high/low predictions actually
# correspond to high/low actual residuals?
# ============================================================================
L(f"\n{'='*92}\nQUARTILE ANALYSIS on model PREDICTIONS (2025 holdout)\n{'='*92}")
for target in ["off_resid","def_resid"]:
    test = qual2[qual2.season==2025].dropna(subset=[target,f"pred_{target}"])
    if len(test)<50: continue
    q10 = test[f"pred_{target}"].quantile(0.10); q25 = test[f"pred_{target}"].quantile(0.25)
    q75 = test[f"pred_{target}"].quantile(0.75); q90 = test[f"pred_{target}"].quantile(0.90)
    L(f"\n  {target} — 2025 holdout:")
    for name, mask in [("Bottom 10% pred", test[f"pred_{target}"]<=q10),
                       ("Bottom 25% pred", test[f"pred_{target}"]<=q25),
                       ("Top 25% pred",    test[f"pred_{target}"]>=q75),
                       ("Top 10% pred",    test[f"pred_{target}"]>=q90)]:
        sub = test[mask]
        if len(sub)==0: continue
        L(f"    {name:18s} n={len(sub):3d}  pred_mean={sub[f'pred_{target}'].mean():+.2f}  actual_mean={sub[target].mean():+.2f}  median={sub[target].median():+.2f}")

# ============================================================================
# IDENTIFY HIGH-CONVICTION REGRESSION SPOTS in 2025
# ============================================================================
L(f"\n{'='*92}\nHIGH-CONVICTION REGRESSION SPOTS in 2025 (extremes of model predictions)\n{'='*92}")
test = qual2[qual2.season==2025].dropna(subset=["off_resid","pred_off_resid","def_resid","pred_def_resid"]).copy()
# Hot teams DUE TO REGRESS DOWN (pred_off_resid << 0)
hot_off = test.nsmallest(10, "pred_off_resid")
L(f"\n  Top 10 'due for negative offensive regression' (lowest pred_off_resid):")
L(f"  {'season':>6s} {'wk':>3s} {'team':>5s} {'asof_avg':>8s} {'pred':>8s} {'actual':>8s} {'hit?':>5s}")
for _,r in hot_off.iterrows():
    hit = "YES" if (r.off_resid * r.pred_off_resid) > 0 else "no"
    L(f"  {int(r.season):6d} {int(r.week):3d} {r.team:>5s} {r.asof_pts_for:8.2f} {r.pred_off_resid:+8.2f} {r.off_resid:+8.2f} {hit:>5s}")
n_dir_correct = (hot_off.off_resid * hot_off.pred_off_resid > 0).sum()
L(f"  Direction correct: {n_dir_correct}/10")

# Cold teams DUE FOR POSITIVE REGRESSION
cold_off = test.nlargest(10, "pred_off_resid")
L(f"\n  Top 10 'due for positive offensive regression' (highest pred_off_resid):")
L(f"  {'season':>6s} {'wk':>3s} {'team':>5s} {'asof_avg':>8s} {'pred':>8s} {'actual':>8s} {'hit?':>5s}")
for _,r in cold_off.iterrows():
    hit = "YES" if (r.off_resid * r.pred_off_resid) > 0 else "no"
    L(f"  {int(r.season):6d} {int(r.week):3d} {r.team:>5s} {r.asof_pts_for:8.2f} {r.pred_off_resid:+8.2f} {r.off_resid:+8.2f} {hit:>5s}")
n_dir_correct = (cold_off.off_resid * cold_off.pred_off_resid > 0).sum()
L(f"  Direction correct: {n_dir_correct}/10")

# Stingy defenses DUE TO BLEED POINTS (def_resid > 0 means opp scored MORE)
stingy_def = test.nlargest(10, "pred_def_resid")
L(f"\n  Top 10 'elite defenses due to bleed points' (highest pred_def_resid):")
L(f"  {'season':>6s} {'wk':>3s} {'team':>5s} {'asof_def':>8s} {'pred':>8s} {'actual':>8s} {'hit?':>5s}")
for _,r in stingy_def.iterrows():
    hit = "YES" if (r.def_resid * r.pred_def_resid) > 0 else "no"
    L(f"  {int(r.season):6d} {int(r.week):3d} {r.team:>5s} {r.asof_pts_against:8.2f} {r.pred_def_resid:+8.2f} {r.def_resid:+8.2f} {hit:>5s}")
n_dir_correct = (stingy_def.def_resid * stingy_def.pred_def_resid > 0).sum()
L(f"  Direction correct: {n_dir_correct}/10")

# ============================================================================
# BETTING APPLICATION — combine team predictions into a game-total prediction
# ============================================================================
L(f"\n{'='*92}\nBETTING APPLICATION — model prediction vs market total (2025)\n{'='*92}")
# Per game: combine HOME team's pred_pts_for + AWAY team's pred_pts_for (both contribute scoring)
test2 = qual2[qual2.season==2025].copy()
# Each row in test2 is a team-game; merge back to per-game frame
home_pred = test2[test2.is_home==1][["season","week","team","opp","asof_pts_for","pred_off_resid"]].rename(
    columns={"team":"home_ab","opp":"away_ab","asof_pts_for":"h_asof_for","pred_off_resid":"h_pred_for"})
away_pred = test2[test2.is_home==0][["season","week","team","asof_pts_for","pred_off_resid"]].rename(
    columns={"team":"away_ab","asof_pts_for":"a_asof_for","pred_off_resid":"a_pred_for"})
gp = home_pred.merge(away_pred, on=["season","week","away_ab"], how="inner")
# Attach market total + actual
gp = gp.merge(m[["season","week","home_ab","away_ab","home_score","away_score"]],
              on=["season","week","home_ab","away_ab"], how="left")
gp["actual_total"] = gp.home_score + gp.away_score
gp = gp.merge(od[["season","home_ab","away_ab","open_total"]], on=["season","home_ab","away_ab"], how="left")
gp = gp.dropna(subset=["open_total","h_pred_for","a_pred_for","actual_total"]).copy()

# Naive baseline: just sum asof pts_for
gp["naive_total"] = gp.h_asof_for + gp.a_asof_for
# Model-adjusted: incorporate predicted residuals
gp["model_total"] = (gp.h_asof_for + gp.h_pred_for) + (gp.a_asof_for + gp.a_pred_for)
# Edge vs market
gp["naive_edge"] = gp.naive_total - gp.open_total
gp["model_edge"] = gp.model_total - gp.open_total

L(f"\n2025 games eligible: {len(gp)}")
L(f"  Mean naive_edge: {gp.naive_edge.mean():+.2f} pts")
L(f"  Mean model_edge: {gp.model_edge.mean():+.2f} pts")

# OVER/UNDER bet test
gp["went_over"] = (gp.actual_total > gp.open_total).astype(float)
gp.loc[gp.actual_total==gp.open_total, "went_over"] = np.nan

L(f"\nBET OVER when model_edge > threshold:")
for thr in [2, 3, 4, 5]:
    sub = gp[gp.model_edge >= thr]
    w = sub.went_over.dropna(); n=len(w); k=int(w.sum())
    if n<5: L(f"  edge>={thr}: n={n} (too thin)"); continue
    lo,hi = wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    L(f"  edge>=+{thr}:  n={n:3d}  hit={k}/{n}={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+.1f}%")

L(f"\nBET UNDER when model_edge < -threshold:")
for thr in [2, 3, 4, 5]:
    sub = gp[gp.model_edge <= -thr]
    w = 1 - sub.went_over.dropna(); n=len(w); k=int(w.sum())
    if n<5: L(f"  edge<=-{thr}: n={n} (too thin)"); continue
    lo,hi = wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    L(f"  edge<=-{thr}:  n={n:3d}  hit={k}/{n}={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+.1f}%")

# Compare to NAIVE baseline (just sum of season averages without regression model)
L(f"\nNAIVE (sum-of-season-avgs) baseline at same thresholds:")
for thr in [2,3,4,5]:
    sub_o = gp[gp.naive_edge >= thr]; w_o = sub_o.went_over.dropna()
    sub_u = gp[gp.naive_edge <= -thr]; w_u = 1 - sub_u.went_over.dropna()
    n_o=len(w_o); k_o=int(w_o.sum()) if n_o>0 else 0
    n_u=len(w_u); k_u=int(w_u.sum()) if n_u>0 else 0
    L(f"  thr={thr}:  OVER n={n_o} hit={k_o/n_o*100 if n_o else 0:.1f}%   UNDER n={n_u} hit={k_u/n_u*100 if n_u else 0:.1f}%")

# Save predictions
qual2[["season","week","team","opp","is_home","asof_pts_for","asof_pts_against",
       "off_resid","pred_off_resid","def_resid","pred_def_resid"]].to_csv(
    os.path.join(DATA,"b86_regression_predictions.csv"), index=False)
L(f"\n[save] all walk-forward predictions -> data/b86_regression_predictions.csv")
