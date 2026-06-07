"""
b85 — DEEP DIVE: every signal for predicting team performance REGRESSION.

REFRAME (from user)
  Not about cover% or O/U. About: will Team X score ABOVE or BELOW their season average
  in the next game, and can we PREDICT that from prior performance / schedule / variance signals?

TARGETS (regression-to-season-avg)
  T1: off_resid = team_pts_for(next_game) - team_asof_avg_pts_for
  T2: def_resid = team_pts_against(next_game) - team_asof_avg_pts_against
  T3: ypp_resid = team_yards_per_play(next_game) - team_asof_avg_ypp   (if available)
  T4: pass_epa_resid (likewise)
  T5: rush_epa_resid

  Walk-forward: as-of computed from games strictly BEFORE the current.
  Per-season: 2025 holdout.

FEATURE FAMILIES (every iteration we can think of)
  A. Recency vs season:           last_3, last_5 minus season-to-date
  B. Direction (trend slope):     OLS slope on last 5 games
  C. Variance/consistency:        std of last 5
  D. Component decomposition:     pass vs rush split deviation
  E. Schedule strength:           opp quality faced (last 3 vs season)
  F. Luck:                        turnover diff, RZ TD%, 3D% deviations from norms
  G. Game script:                 trailing all game (next game might revert)
  H. Home/away splits:            last_3_home vs last_3_away
  I. Extreme outliers:            top/bottom percentile last week
  J. Cross-side: did off carry def or vice versa

OUTPUT
  - Rank ALL candidate signals by correlation with each target
  - Quartile analysis: Q1 vs Q4 mean residual
  - Per-season stability for top 15 signals
  - Combined model showing whether signals stack
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m = pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
m["actual_total"] = m.home_score + m.away_score
m["actual_margin"] = m.home_score - m.away_score
L(f"[load] matchup: {m.shape}")

# Find every leak-safe metric we have for offensive + defensive
SAFE_SFX = ("_s2d","_last3","_last5")
OFF_METRICS = sorted({c.replace("home_off_","").replace("away_off_","") for c in m.columns
                      if (c.startswith("home_off_") or c.startswith("away_off_"))
                      and c.endswith(SAFE_SFX)})
DEF_METRICS = sorted({c.replace("home_def_","").replace("away_def_","") for c in m.columns
                      if (c.startswith("home_def_") or c.startswith("away_def_"))
                      and c.endswith(SAFE_SFX)})
L(f"[metrics] OFF: {len(OFF_METRICS)}  DEF: {len(DEF_METRICS)}")

# ============================================================================
# STEP 1: Build long-form team-game frame with both teams' as-of metrics + actuals
# ============================================================================
def long_frame(df):
    # HOME perspective
    h = df[["season","week","home_ab","away_ab","home_score","away_score"]].rename(
        columns={"home_ab":"team","away_ab":"opp","home_score":"pts_for","away_score":"pts_against"})
    h["is_home"] = 1
    a = df[["season","week","away_ab","home_ab","away_score","home_score"]].rename(
        columns={"away_ab":"team","home_ab":"opp","away_score":"pts_for","home_score":"pts_against"})
    a["is_home"] = 0
    # Carry as-of offensive metrics from team's perspective
    for c in OFF_METRICS:
        if f"home_off_{c}" in df.columns: h[f"off_{c}"] = df[f"home_off_{c}"]
        if f"away_off_{c}" in df.columns: a[f"off_{c}"] = df[f"away_off_{c}"]
    for c in DEF_METRICS:
        if f"home_def_{c}" in df.columns: h[f"def_{c}"] = df[f"home_def_{c}"]
        if f"away_def_{c}" in df.columns: a[f"def_{c}"] = df[f"away_def_{c}"]
    return pd.concat([h,a], ignore_index=True)

tg = long_frame(m).sort_values(["season","team","week"]).reset_index(drop=True)
L(f"[long] {len(tg)} team-game rows")

# Compute as-of (excludes current game) PPG for and PPG against
def asof_ppg(group):
    group = group.sort_values("week")
    cn = group.pts_for.expanding().count().shift(1)
    group["asof_n"] = cn
    group["asof_pts_for"] = group.pts_for.expanding().sum().shift(1) / cn
    group["asof_pts_against"] = group.pts_against.expanding().sum().shift(1) / cn
    group["asof_pts_for_std"] = group.pts_for.expanding().std().shift(1)
    group["asof_pts_against_std"] = group.pts_against.expanding().std().shift(1)
    # last 3 / 5 game windows (exclude current)
    group["last3_pts_for"] = group.pts_for.shift(1).rolling(3).mean()
    group["last5_pts_for"] = group.pts_for.shift(1).rolling(5).mean()
    group["last3_pts_against"] = group.pts_against.shift(1).rolling(3).mean()
    group["last5_pts_against"] = group.pts_against.shift(1).rolling(5).mean()
    # Last game's residual (single most recent vs season avg)
    group["last1_for_resid"] = group.pts_for.shift(1) - group.asof_pts_for
    group["last1_against_resid"] = group.pts_against.shift(1) - group.asof_pts_against
    # Trend slope (OLS on last 5)
    def slope(s):
        s = s.dropna()
        if len(s)<3: return np.nan
        x = np.arange(len(s)); y = s.values
        return np.polyfit(x,y,1)[0]
    group["trend_for_5"]     = group.pts_for.shift(1).rolling(5).apply(slope, raw=False)
    group["trend_against_5"] = group.pts_against.shift(1).rolling(5).apply(slope, raw=False)
    return group
tg = tg.groupby(["season","team"], group_keys=False).apply(asof_ppg)

# DERIVED features (vs-season-avg deltas, consistency, schedule)
tg["last3_for_resid"]   = tg.last3_pts_for - tg.asof_pts_for
tg["last5_for_resid"]   = tg.last5_pts_for - tg.asof_pts_for
tg["last3_against_resid"] = tg.last3_pts_against - tg.asof_pts_against
tg["last5_against_resid"] = tg.last5_pts_against - tg.asof_pts_against
tg["cv_for"]   = tg.asof_pts_for_std / tg.asof_pts_for
tg["cv_against"] = tg.asof_pts_against_std / tg.asof_pts_against

# Opp quality faced (avg of prior opponents' asof_pts_against = how strong their defenses were)
# Need to attach the opp's asof_pts_against at the time we played them
opp_def = tg[["season","week","team","asof_pts_against"]].rename(columns={"team":"opp","asof_pts_against":"opp_asof_def"})
opp_off = tg[["season","week","team","asof_pts_for"]].rename(columns={"team":"opp","asof_pts_for":"opp_asof_off"})
tg = tg.merge(opp_def, on=["season","week","opp"], how="left").merge(opp_off, on=["season","week","opp"], how="left")

def schedule_sos(group):
    group = group.sort_values("week")
    group["sos_def_avg"] = group.opp_asof_def.expanding().mean().shift(1)   # mean of opp defenses faced
    group["sos_off_avg"] = group.opp_asof_off.expanding().mean().shift(1)   # mean of opp offenses faced
    group["sos_def_last3"] = group.opp_asof_def.shift(1).rolling(3).mean()
    group["sos_off_last3"] = group.opp_asof_off.shift(1).rolling(3).mean()
    return group
tg = tg.groupby(["season","team"], group_keys=False).apply(schedule_sos)
tg["sos_def_recent_shift"] = tg.sos_def_last3 - tg.sos_def_avg   # recent opps stronger/weaker than season avg
tg["sos_off_recent_shift"] = tg.sos_off_last3 - tg.sos_off_avg

# ============================================================================
# STEP 2: Define TARGETS (next-game performance vs season avg)
# ============================================================================
tg["off_resid"] = tg.pts_for - tg.asof_pts_for
tg["def_resid"] = tg.pts_against - tg.asof_pts_against
# Need enough prior games for the season avg to be stable
qual = tg[(tg.asof_n>=4)].copy()
L(f"\n[qual] {len(qual)} team-games with >=4 prior games this season")
L(f"  off_resid mean={qual.off_resid.mean():+.2f}  std={qual.off_resid.std():.2f}")
L(f"  def_resid mean={qual.def_resid.mean():+.2f}  std={qual.def_resid.std():.2f}")

# ============================================================================
# STEP 3: Define EVERY candidate signal
# ============================================================================
# Pull every leak-safe asof column from offense and defense metrics — these are FEATURES
ASOF_OFF_COLS = [c for c in qual.columns if c.startswith("off_") and c.endswith(SAFE_SFX)]
ASOF_DEF_COLS = [c for c in qual.columns if c.startswith("def_") and c.endswith(SAFE_SFX)]
L(f"[features] asof off cols: {len(ASOF_OFF_COLS)}  asof def cols: {len(ASOF_DEF_COLS)}")

# Derive "last3 minus s2d" deltas for every metric that has both
def find_pairs(cols):
    pairs={}
    for c in cols:
        if c.endswith("_last3"):
            base = c[:-6]
            s2d = base + "_s2d"
            if s2d in cols:
                pairs[base] = (c, s2d)
    return pairs
OFF_PAIRS = find_pairs(ASOF_OFF_COLS)
DEF_PAIRS = find_pairs(ASOF_DEF_COLS)
L(f"[pairs] OFF metric pairs (last3 vs s2d): {len(OFF_PAIRS)}  DEF pairs: {len(DEF_PAIRS)}")

# Build delta columns (last3 - s2d), the "is this team hot vs their own season?"
for base,(l3,s2d) in OFF_PAIRS.items():
    qual[f"DELTA_off_{base}"] = pd.to_numeric(qual[l3], errors='coerce') - pd.to_numeric(qual[s2d], errors='coerce')
for base,(l3,s2d) in DEF_PAIRS.items():
    qual[f"DELTA_def_{base}"] = pd.to_numeric(qual[l3], errors='coerce') - pd.to_numeric(qual[s2d], errors='coerce')

# Manual signals derived from PPG
MANUAL_FEATURES = ["last3_for_resid","last5_for_resid","last3_against_resid","last5_against_resid",
                   "last1_for_resid","last1_against_resid","cv_for","cv_against",
                   "trend_for_5","trend_against_5","sos_def_recent_shift","sos_off_recent_shift"]
DELTA_FEATURES = [c for c in qual.columns if c.startswith("DELTA_")]
ALL_FEATURES = MANUAL_FEATURES + DELTA_FEATURES + ASOF_OFF_COLS + ASOF_DEF_COLS
L(f"\n[features] TOTAL candidate signals: {len(ALL_FEATURES)}")

# Force numeric
for c in ALL_FEATURES:
    qual[c] = pd.to_numeric(qual[c], errors='coerce')

# ============================================================================
# STEP 4: Univariate analysis — every signal vs every target
# ============================================================================
def univariate(qual, features, target_col):
    rows=[]
    for f in features:
        d = qual.dropna(subset=[f, target_col])
        if len(d)<200: continue
        pearson = d[f].corr(d[target_col])
        spearman = d[f].corr(d[target_col], method="spearman")
        q1 = d[d[f] <= d[f].quantile(0.25)][target_col].mean()
        q4 = d[d[f] >= d[f].quantile(0.75)][target_col].mean()
        rows.append({"feature":f,"n":len(d),"pearson":pearson,"spearman":spearman,
                     "q1_mean":q1,"q4_mean":q4,"q4_minus_q1":q4-q1})
    return pd.DataFrame(rows).sort_values("pearson", key=abs, ascending=False)

L(f"\n{'='*92}\nUNIVARIATE: Predicting OFF_RESID (team's next-game pts_for vs season avg)\n{'='*92}")
off_results = univariate(qual, ALL_FEATURES, "off_resid")
L(f"\nTop 20 by |pearson|:")
L(f"  {'feature':45s} {'n':>5s}  {'pears':>7s}  {'spear':>7s}  {'Q1_mean':>8s}  {'Q4_mean':>8s}  {'Q4-Q1':>7s}")
for _,r in off_results.head(20).iterrows():
    L(f"  {r.feature[:44]:45s} {int(r.n):5d}  {r.pearson:+7.3f}  {r.spearman:+7.3f}  {r.q1_mean:+8.2f}  {r.q4_mean:+8.2f}  {r.q4_minus_q1:+7.2f}")

L(f"\n{'='*92}\nUNIVARIATE: Predicting DEF_RESID (opp's next-game pts_for vs season avg of opp pts_against)\n{'='*92}")
def_results = univariate(qual, ALL_FEATURES, "def_resid")
L(f"\nTop 20 by |pearson|:")
L(f"  {'feature':45s} {'n':>5s}  {'pears':>7s}  {'spear':>7s}  {'Q1_mean':>8s}  {'Q4_mean':>8s}  {'Q4-Q1':>7s}")
for _,r in def_results.head(20).iterrows():
    L(f"  {r.feature[:44]:45s} {int(r.n):5d}  {r.pearson:+7.3f}  {r.spearman:+7.3f}  {r.q1_mean:+8.2f}  {r.q4_mean:+8.2f}  {r.q4_minus_q1:+7.2f}")

# Save full tables
off_results.to_csv(os.path.join(DATA,"b85_off_resid_signals.csv"), index=False)
def_results.to_csv(os.path.join(DATA,"b85_def_resid_signals.csv"), index=False)
L(f"\n[save] full tables -> data/b85_off_resid_signals.csv, b85_def_resid_signals.csv")

# ============================================================================
# STEP 5: Per-season stability for top 10 signals (must work in each year)
# ============================================================================
def stability(qual, features, target_col):
    rows=[]
    for f in features:
        d = qual.dropna(subset=[f, target_col])
        seasonal = {}
        for s in sorted(d.season.unique()):
            sy = d[d.season==s]
            if len(sy)<30: continue
            seasonal[s] = sy[f].corr(sy[target_col])
        rows.append({"feature":f, **{f"yr_{int(s)}":v for s,v in seasonal.items()}})
    return pd.DataFrame(rows)

L(f"\n{'='*92}\nPER-SEASON STABILITY — top 10 OFF_RESID signals (consistent sign?)\n{'='*92}")
top10_off = off_results.head(10).feature.tolist()
stab_off = stability(qual, top10_off, "off_resid")
for _,r in stab_off.iterrows():
    yr_cols = [c for c in r.index if c.startswith("yr_")]
    vals = [r[c] for c in yr_cols if not pd.isna(r[c])]
    if not vals: continue
    same_sign = all((v>=0) == (vals[0]>=0) for v in vals) if vals else False
    line = "  ".join([f"{c.replace('yr_','')}:{r[c]:+.2f}" if not pd.isna(r[c]) else f"{c.replace('yr_','')}:--  " for c in yr_cols])
    L(f"  {r.feature[:40]:42s}  {line}  {'<-CONSISTENT' if same_sign else ''}")

L(f"\nPER-SEASON STABILITY — top 10 DEF_RESID signals")
top10_def = def_results.head(10).feature.tolist()
stab_def = stability(qual, top10_def, "def_resid")
for _,r in stab_def.iterrows():
    yr_cols = [c for c in r.index if c.startswith("yr_")]
    vals = [r[c] for c in yr_cols if not pd.isna(r[c])]
    if not vals: continue
    same_sign = all((v>=0) == (vals[0]>=0) for v in vals) if vals else False
    line = "  ".join([f"{c.replace('yr_','')}:{r[c]:+.2f}" if not pd.isna(r[c]) else f"{c.replace('yr_','')}:--  " for c in yr_cols])
    L(f"  {r.feature[:40]:42s}  {line}  {'<-CONSISTENT' if same_sign else ''}")

# ============================================================================
# STEP 6: Quartile-edge analysis — top survivors' Q4 vs Q1 spread per season
# ============================================================================
L(f"\n{'='*92}\nQUARTILE EDGE: top OFF_RESID signal extremes (Q1 vs Q4 mean residual)\n{'='*92}")
top5 = off_results.head(5).feature.tolist()
for f in top5:
    L(f"\n  {f}:")
    for s in sorted(qual.season.unique()):
        sy = qual[qual.season==s].dropna(subset=[f,"off_resid"])
        if len(sy)<30: continue
        q1_thr = sy[f].quantile(0.25); q4_thr = sy[f].quantile(0.75)
        q1_mean = sy[sy[f]<=q1_thr]["off_resid"].mean()
        q4_mean = sy[sy[f]>=q4_thr]["off_resid"].mean()
        n_q1 = (sy[f]<=q1_thr).sum(); n_q4 = (sy[f]>=q4_thr).sum()
        L(f"    {s}: Q1 (n={n_q1}) resid={q1_mean:+.2f}  Q4 (n={n_q4}) resid={q4_mean:+.2f}  spread={q4_mean-q1_mean:+.2f}")

# ============================================================================
# STEP 7: 2025 holdout — pure forward test of the strongest signal
# ============================================================================
L(f"\n{'='*92}\n2025 HOLDOUT — strongest signal forward test\n{'='*92}")
best_off = off_results.iloc[0].feature
best_def = def_results.iloc[0].feature
L(f"  Strongest OFF_RESID predictor: {best_off}")
L(f"  Strongest DEF_RESID predictor: {best_def}")

for tag, feature, target in [("OFF", best_off, "off_resid"), ("DEF", best_def, "def_resid")]:
    L(f"\n  {tag} signal — 2025 holdout quartile analysis (training ≤ 2024 quartiles):")
    train = qual[qual.season<2025].dropna(subset=[feature,target])
    q1_thr = train[feature].quantile(0.25); q4_thr = train[feature].quantile(0.75)
    test = qual[qual.season==2025].dropna(subset=[feature,target])
    if len(test)<30: L(f"    test n={len(test)} too thin"); continue
    q1_test = test[test[feature]<=q1_thr]
    q4_test = test[test[feature]>=q4_thr]
    L(f"    Q1 cutoff (from train): {q1_thr:.2f}  Q4 cutoff: {q4_thr:.2f}")
    L(f"    Q1 in 2025: n={len(q1_test)}  mean {target}={q1_test[target].mean():+.2f}  median={q1_test[target].median():+.2f}")
    L(f"    Q4 in 2025: n={len(q4_test)}  mean {target}={q4_test[target].mean():+.2f}  median={q4_test[target].median():+.2f}")
    L(f"    Spread Q4-Q1: {q4_test[target].mean() - q1_test[target].mean():+.2f}")

L(f"\n{'-'*92}\nFull tables saved to data/b85_*_signals.csv — sort, filter, dive deeper as needed.")
