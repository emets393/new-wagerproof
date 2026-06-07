"""
b80 — Team totals model: ANCHORED vs UNANCHORED (NFL replication of CFB Signal #5).

CFB FINDING
  Implied team total = (game_total - team_spread) / 2 [conventional algebra]
  ANCHORED model (includes market features) ≤ -3 vs implied → team UNDER (~54-56%)
  UNANCHORED model (no market features) ≥ +6 vs implied → team OVER (~54-56%)
  Mutually exclusive, both confound-survived.

NFL ADAPTATION
  Use existing s2d (season-to-date) and last3 stats from matchup.parquet — these are leak-safe
  (point-in-time rolling, no current-game stats). Long-form: 2 rows per game (home + away
  perspectives).

  Target: team_points = home_score (for home rows) or away_score (for away rows)
  Implied team total: home_imp = (open_total - open_spread)/2, away_imp = (open_total + open_spread)/2

FRAMEWORK RULES
  - Walk-forward: train on seasons<target, predict target
  - Per-season + 2025 holdout
  - Anchored vs unanchored separation strictly enforced (rule #4)
  - Confound check by team total band
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
m = m.merge(od[["season","home_ab","away_ab","open_spread","open_total"]],
            on=["season","home_ab","away_ab"], how="left")
m["spread_use"] = m.open_spread.fillna(m.home_spread)
m["total_use"]  = m.open_total.fillna(m.nv_total_line if "nv_total_line" in m.columns else m.ou_vegas_line)
m = m.dropna(subset=["home_score","away_score","spread_use","total_use"]).copy()
m["home_imp_tt"] = (m.total_use - m.spread_use)/2
m["away_imp_tt"] = (m.total_use + m.spread_use)/2
L(f"[load] {len(m)} games with all needed cols")

# Build long-form team-perspective frame
def long_frame(df):
    h = df[["season","week","home_ab","away_ab","home_score","total_use","spread_use","home_imp_tt",
            "home_predictive_pr","away_predictive_pr"]].rename(columns={
        "home_ab":"team","away_ab":"opp","home_score":"team_pts","home_imp_tt":"imp_tt",
        "home_predictive_pr":"team_pr","away_predictive_pr":"opp_pr"})
    h["is_home"]=1; h["spread_team"] = df.spread_use   # neg = team(home) favored
    a = df[["season","week","away_ab","home_ab","away_score","total_use","spread_use","away_imp_tt",
            "away_predictive_pr","home_predictive_pr"]].rename(columns={
        "away_ab":"team","home_ab":"opp","away_score":"team_pts","away_imp_tt":"imp_tt",
        "away_predictive_pr":"team_pr","home_predictive_pr":"opp_pr"})
    a["is_home"]=0; a["spread_team"] = -df.spread_use   # flip for away
    # Attach team-perspective offensive stats from m, and opp's defensive stats
    off_cols_h = [c for c in df.columns if c.startswith("home_off_")]
    def_cols_a = [c for c in df.columns if c.startswith("away_def_")]
    off_cols_a = [c for c in df.columns if c.startswith("away_off_")]
    def_cols_h = [c for c in df.columns if c.startswith("home_def_")]
    for c in off_cols_h:
        h[c.replace("home_off_","off_")] = df[c]
    for c in def_cols_a:
        h[c.replace("away_def_","opp_def_")] = df[c]
    for c in off_cols_a:
        a[c.replace("away_off_","off_")] = df[c]
    for c in def_cols_h:
        a[c.replace("home_def_","opp_def_")] = df[c]
    return pd.concat([h,a], ignore_index=True)

tg = long_frame(m)
L(f"[long] {len(tg)} team-game rows")

# Feature lists
SAFE_SFX = ("_s2d","_last3","_last5","_pr","_rate","_pct","_per_game","_per_play","_per_drive")
def is_safe(c):
    cl = c.lower()
    if any(k in cl for k in ['actual','final','_won','cover','spread_miss','total_miss','resid','exp_','team_pts','imp_tt']):
        return False
    return c.endswith(SAFE_SFX) or c in ("is_home","team_pr","opp_pr","week")

UNANCH_FEATS = [c for c in tg.columns if is_safe(c)]
ANCH_FEATS   = UNANCH_FEATS + ["total_use","spread_team","imp_tt"]
L(f"[features] unanchored={len(UNANCH_FEATS)}  anchored={len(ANCH_FEATS)}")

# Walk-forward train + predict
def walkforward(tg, feats, target_year):
    tr = tg[tg.season<target_year].dropna(subset=["team_pts"]).copy()
    te = tg[tg.season==target_year].copy()
    tr_feats = tr[feats].copy()
    te_feats = te[feats].copy()
    # Numericize
    for c in feats:
        if tr_feats[c].dtype == "object":
            tr_feats[c] = pd.to_numeric(tr_feats[c], errors="coerce")
            te_feats[c] = pd.to_numeric(te_feats[c], errors="coerce")
    # Drop features with too many NaN in train
    keep = [c for c in feats if tr_feats[c].notna().sum()/len(tr_feats) >= 0.5]
    reg = HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05, max_iter=400,
        l2_regularization=2.0, min_samples_leaf=30, random_state=0).fit(tr_feats[keep], tr.team_pts)
    te["pred_pts"] = reg.predict(te_feats[keep])
    te["edge"] = te.pred_pts - te.imp_tt
    return te

L(f"\n{'='*92}\nANCHORED MODEL — predict team_pts WITH market features; target UNDERS (CFB Signal #5)\n{'='*92}")

for target in [2024, 2025]:
    te = walkforward(tg, ANCH_FEATS, target)
    te["went_under"] = (te.team_pts < te.imp_tt).astype(int)
    te.loc[te.team_pts == te.imp_tt, "went_under"] = np.nan   # push
    for thr in [-2, -3, -4, -5]:
        sub = te[te.edge <= thr]
        w = sub.went_under.dropna(); n=len(w); k=int(w.sum())
        if n<5: L(f"  {target}  edge<={thr}: n={n} (too thin)"); continue
        lo,hi = wilson_ci(k,n); roi = (k*100/110 - (n-k))/n*100
        L(f"  {target}  edge<={thr}:  n={n:3d}  team_UNDER hit={k}/{n}={k/n*100:5.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+.1f}%")

L(f"\n{'='*92}\nUNANCHORED MODEL — predict team_pts WITHOUT market features; target OVERS\n{'='*92}")
for target in [2024, 2025]:
    te = walkforward(tg, UNANCH_FEATS, target)
    te["went_over"] = (te.team_pts > te.imp_tt).astype(int)
    te.loc[te.team_pts == te.imp_tt, "went_over"] = np.nan
    for thr in [4, 5, 6, 7]:
        sub = te[te.edge >= thr]
        w = sub.went_over.dropna(); n=len(w); k=int(w.sum())
        if n<5: L(f"  {target}  edge>={thr}: n={n} (too thin)"); continue
        lo,hi = wilson_ci(k,n); roi = (k*100/110 - (n-k))/n*100
        L(f"  {target}  edge>={thr}:  n={n:3d}  team_OVER hit={k}/{n}={k/n*100:5.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+.1f}%")

# Per-season breakdown at the strongest threshold from each variant
L(f"\n{'='*92}\nPER-SEASON BREAKDOWN — both variants at their CFB-anchor thresholds\n{'='*92}")
# Train walk-forward all years
all_anch=[]; all_unanch=[]
for target in sorted(tg.season.unique()):
    if target == tg.season.min(): continue
    try:
        ta = walkforward(tg, ANCH_FEATS, target);    ta["model"]="anchored"
        tu = walkforward(tg, UNANCH_FEATS, target);  tu["model"]="unanchored"
        all_anch.append(ta); all_unanch.append(tu)
    except Exception as e:
        L(f"  {target}: skip ({e})")

A = pd.concat(all_anch, ignore_index=True)
U = pd.concat(all_unanch, ignore_index=True)
A["went_under"] = (A.team_pts < A.imp_tt).astype(int); A.loc[A.team_pts==A.imp_tt,"went_under"]=np.nan
U["went_over"]  = (U.team_pts > U.imp_tt).astype(int); U.loc[U.team_pts==U.imp_tt,"went_over"]=np.nan

L(f"\nANCHORED edge<=-3 → team_UNDER  (per season):")
for s in sorted(A.season.unique()):
    sub = A[(A.season==s) & (A.edge<=-3)]
    w = sub.went_under.dropna(); n=len(w); k=int(w.sum())
    if n<5: L(f"  {s}:  n={n}"); continue
    lo,hi = wilson_ci(k,n); L(f"  {s}:  n={n:3d}  hit={k/n*100:5.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
sub = A[A.edge<=-3]; w=sub.went_under.dropna(); n,k=len(w),int(w.sum())
lo,hi=wilson_ci(k,n); L(f"  POOLED:  n={n}  hit={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")

L(f"\nUNANCHORED edge>=+6 → team_OVER  (per season):")
for s in sorted(U.season.unique()):
    sub = U[(U.season==s) & (U.edge>=6)]
    w = sub.went_over.dropna(); n=len(w); k=int(w.sum())
    if n<5: L(f"  {s}:  n={n}"); continue
    lo,hi = wilson_ci(k,n); L(f"  {s}:  n={n:3d}  hit={k/n*100:5.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
sub = U[U.edge>=6]; w=sub.went_over.dropna(); n,k=len(w),int(w.sum())
lo,hi=wilson_ci(k,n); L(f"  POOLED:  n={n}  hit={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")

# Confound check: within implied-team-total bands
L(f"\n{'='*92}\nCONFOUND CHECK — does edge survive WITHIN implied-team-total bands?\n{'='*92}")
A2 = A.dropna(subset=["went_under"]); U2 = U.dropna(subset=["went_over"])
L(f"\nANCHORED  (edge<=-3, team_UNDER):")
for lo_t, hi_t, name in [(0,18,"low_tt"),(18,22,"mid_tt"),(22,99,"high_tt")]:
    base = A2[(A2.imp_tt>=lo_t)&(A2.imp_tt<hi_t)]
    if len(base)<10: continue
    bp = (1-base.went_under).mean()*100 if False else base.went_under.mean()*100   # baseline under%
    sig = base[base.edge<=-3]
    sn = len(sig); sk = int(sig.went_under.sum())
    if sn<5: L(f"  {name:8s} n_base={len(base):4d}  base_under={bp:.1f}%  signal n={sn} (thin)"); continue
    sp = sk/sn*100
    L(f"  {name:8s} n_base={len(base):4d}  base_under={bp:.1f}%  signal n={sn:3d}  hit={sp:.1f}%  delta={sp-bp:+.1f}pp")

L(f"\nUNANCHORED  (edge>=+6, team_OVER):")
for lo_t, hi_t, name in [(0,18,"low_tt"),(18,22,"mid_tt"),(22,99,"high_tt")]:
    base = U2[(U2.imp_tt>=lo_t)&(U2.imp_tt<hi_t)]
    if len(base)<10: continue
    bp = base.went_over.mean()*100
    sig = base[base.edge>=6]
    sn = len(sig); sk = int(sig.went_over.sum())
    if sn<5: L(f"  {name:8s} n_base={len(base):4d}  base_over={bp:.1f}%  signal n={sn} (thin)"); continue
    sp = sk/sn*100
    L(f"  {name:8s} n_base={len(base):4d}  base_over={bp:.1f}%  signal n={sn:3d}  hit={sp:.1f}%  delta={sp-bp:+.1f}pp")

L(f"\n{'-'*92}\nVerdict pending — see per-season pattern and confound deltas above.")
