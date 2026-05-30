"""
b61: ROLLING TEAM-vs-LINE MISS features + TRAP FLAGS.

Per team-game, compute:
  team_total_miss  = actual_team_pts - implied_team_total (implied = (total ± spread) / 2)
  team_margin_miss = actual_margin_for_this_team + team's_spread  (positive = covered)

Roll per-team PRE-GAME (shifted): season-to-date + last 3. Week 1 = NaN, Week 2 = W1 only,
Week 3 = W1+W2, Week 4+ = both s2d and last3 fully populated.

Then derive TRAP FLAGS:
  - total_over_trap: both teams' last3 over_miss >= 3 AND game's line is BELOW league avg
  - total_under_trap: both teams' last3 under_miss AND line ABOVE league avg
  - home_cover_trap: home dog covering vs away fav not covering (home_spread > 0, big miss gap)
  - away_cover_trap: away dog covering vs home fav not covering (home_spread < 0, big miss gap)

Test 1: Add features to baseline models (totals + sides) — does it improve?
Test 2: Standalone hit rate of trap flags vs OPENER.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score

# ============ Step 1: compute miss values per team-game ============
# Implied team totals using closing line (what teams actually played against historically)
m["h_implied"]=(m.nv_total_line - m.home_spread)/2  # home_spread negative when home favored
m["a_implied"]=(m.nv_total_line + m.home_spread)/2
m["h_total_miss"]=m.home_score - m.h_implied        # + = beat expectation
m["a_total_miss"]=m.away_score - m.a_implied
# Margin miss (cover-or-not relative to spread)
m["h_margin_miss"]=m.actual_margin + m.home_spread  # + = home covered
m["a_margin_miss"]=-(m.actual_margin + m.home_spread)  # + = away covered

# ============ Step 2: team-game frame for rolling ============
h=m[["season","week","home_ab","h_total_miss","h_margin_miss"]].rename(columns={"home_ab":"team","h_total_miss":"total_miss","h_margin_miss":"margin_miss"})
a=m[["season","week","away_ab","a_total_miss","a_margin_miss"]].rename(columns={"away_ab":"team","a_total_miss":"total_miss","a_margin_miss":"margin_miss"})
tg=pd.concat([h,a],ignore_index=True).sort_values(["team","season","week"]).reset_index(drop=True)

# Pre-game rolling (shift first, then aggregate)
def shift_expand(s): return s.shift(1).expanding().mean()
def shift_roll3(s): return s.shift(1).rolling(3, min_periods=1).mean()
for col in ["total_miss","margin_miss"]:
    tg[f"{col}_s2d"]=tg.groupby(["team","season"])[col].transform(shift_expand)
    tg[f"{col}_last3"]=tg.groupby(["team","season"])[col].transform(shift_roll3)

L(f"[rolling] team-game records: {len(tg)}")
L(f"[rolling] s2d notna by week: " + ", ".join([f"W{w}={int(tg[tg.week==w].total_miss_s2d.notna().sum())}" for w in [1,2,3,4,5]]))

# ============ Step 3: merge back to games ============
roll_cols=["total_miss_s2d","total_miss_last3","margin_miss_s2d","margin_miss_last3"]
mm=m.copy()
for side,p in [("home","h_"),("away","a_")]:
    sub=tg[["season","week","team"]+roll_cols].rename(columns={"team":f"{side}_ab", **{c:f"{p}{c}" for c in roll_cols}})
    mm=mm.merge(sub,on=["season","week",f"{side}_ab"],how="left")

# Game-level derived features
mm["total_miss_sum_s2d"]=mm.h_total_miss_s2d + mm.a_total_miss_s2d
mm["total_miss_sum_last3"]=mm.h_total_miss_last3 + mm.a_total_miss_last3
mm["margin_miss_diff_s2d"]=mm.h_margin_miss_s2d - mm.a_margin_miss_s2d   # + = home covers vs away
mm["margin_miss_diff_last3"]=mm.h_margin_miss_last3 - mm.a_margin_miss_last3

# League-avg-total per season (for trap detection)
league_tot=mm.groupby("season").nv_total_line.mean().to_dict()
mm["line_vs_league"]=mm.nv_total_line - mm.season.map(league_tot)

# ============ Step 4: TRAP FLAGS ============
# Total traps: both teams systematically over/under-perform, but line points the other way
mm["total_over_trap"]=((mm.total_miss_sum_last3>=6) & (mm.line_vs_league<=-2)).astype(int)
mm["total_under_trap"]=((mm.total_miss_sum_last3<=-6) & (mm.line_vs_league>=2)).astype(int)
# Spread traps: covering team is the dog vs non-covering fav
mm["home_cover_trap"]=((mm.h_margin_miss_s2d>=3) & (mm.a_margin_miss_s2d<=-3) & (mm.home_spread>0)).astype(int)
mm["away_cover_trap"]=((mm.a_margin_miss_s2d>=3) & (mm.h_margin_miss_s2d<=-3) & (mm.home_spread<0)).astype(int)

# Fire rates 2024-25
test=mm[mm.season.isin([2024,2025])&(mm.week>=4)]
L(f"\n[trap fire rates 2024-25, W4+]")
L(f"  total_over_trap:   {int(test.total_over_trap.sum())} games")
L(f"  total_under_trap:  {int(test.total_under_trap.sum())} games")
L(f"  home_cover_trap:   {int(test.home_cover_trap.sum())} games")
L(f"  away_cover_trap:   {int(test.away_cover_trap.sum())} games")

# ============ Step 5: feature ablation on baseline models ============
NEW_TOT=["h_total_miss_s2d","a_total_miss_s2d","h_total_miss_last3","a_total_miss_last3",
         "total_miss_sum_s2d","total_miss_sum_last3"]
NEW_SIDES=["h_margin_miss_s2d","a_margin_miss_s2d","h_margin_miss_last3","a_margin_miss_last3",
           "margin_miss_diff_s2d","margin_miss_diff_last3"]
PR_BASE=["home_predictive_pr","away_predictive_pr","abs_spread","week"]
mm["abs_spread"]=mm.home_spread.abs()
mm["home_cover"]=(mm.actual_margin+mm.home_spread>0).astype(int)
for c in PR_BASE+NEW_TOT+NEW_SIDES: mm[c]=pd.to_numeric(mm[c],errors="coerce")
W=mm[mm.week>=4].copy()

def grade_tot(feats,label):
    W["pt"]=np.nan
    for Y in [2024,2025]:
        tr=W[W.season<Y].dropna(subset=["actual_total"]+feats); te=W[W.season==Y]
        gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.actual_total)
        W.loc[te.index,"pt"]=gb.predict(te[feats])
    d=W[W.season.isin([2024,2025])].merge(od[["season","home_ab","away_ab","open_total"]],on=["season","home_ab","away_ab"],how="inner").dropna(subset=["pt","open_total","actual_total"])
    d["edge"]=d.pt - d.open_total
    bo=d[d.edge>=2]; bu=d[d.edge<=-2]
    won=pd.concat([(bo.actual_total>bo.open_total).astype(float),(bu.actual_total<bu.open_total).astype(float)]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    mae=(d.pt - d.actual_total).abs().mean()
    L(f"  {label:38s} MAE={mae:.2f}  edge>=2: n={n} hit={(k/n*100 if n else 0):.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

def grade_sides(feats,label):
    W["ph"]=np.nan
    for Y in [2024,2025]:
        tr=W[W.season<Y].dropna(subset=["home_cover"]+feats); te=W[W.season==Y]
        clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.home_cover)
        W.loc[te.index,"ph"]=clf.predict_proba(te[feats])[:,1]
    d=W[W.season.isin([2024,2025])].merge(od[["season","home_ab","away_ab","open_spread"]],on=["season","home_ab","away_ab"],how="inner").dropna(subset=["ph","open_spread"])
    d["hco"]=(d.actual_margin+d.open_spread>0).astype(float)
    bh=d[d.ph>=0.53]; ba=d[d.ph<=0.47]
    won=pd.concat([bh.hco, 1-ba.hco]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  {label:38s} conf>=.03: n={n} hit={(k/n*100 if n else 0):.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

L("\n"+"="*92); L("TOTALS — does rolling total_miss add signal?"); L("="*92)
grade_tot(PR_BASE, "PR baseline")
grade_tot(PR_BASE+NEW_TOT, "PR + rolling_total_miss (6 new)")

L("\n"+"="*92); L("SIDES — does rolling margin_miss add signal?"); L("="*92)
grade_sides(PR_BASE, "PR baseline")
grade_sides(PR_BASE+NEW_SIDES, "PR + rolling_margin_miss (6 new)")

# ============ Step 6: standalone trap-flag spot tests ============
L("\n"+"="*92); L("TRAP FLAGS — standalone hit rate vs OPENER (2024-25 W4+)"); L("="*92)
d=mm[(mm.season.isin([2024,2025]))&(mm.week>=4)].merge(od[["season","home_ab","away_ab","open_total","open_spread"]],on=["season","home_ab","away_ab"],how="inner")
def spot(mask, label, side):
    sub=d[mask]
    if len(sub)<3: L(f"  {label:50s} n={len(sub)} (too few)"); return
    if side=="over":
        hit=(sub.actual_total>sub.open_total).astype(float)[sub.actual_total!=sub.open_total]
    elif side=="under":
        hit=(sub.actual_total<sub.open_total).astype(float)[sub.actual_total!=sub.open_total]
    elif side=="home":
        hit=(sub.actual_margin+sub.open_spread>0).astype(float)
    elif side=="away":
        hit=(sub.actual_margin+sub.open_spread<0).astype(float)
    k=int(hit.sum()); n=len(hit); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  {label:50s} n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
spot(d.total_over_trap==1, "TOTAL OVER trap (both teams +6 miss, line <-2 vs avg)", "over")
spot(d.total_under_trap==1, "TOTAL UNDER trap (both teams -6 miss, line >+2 vs avg)", "under")
spot(d.home_cover_trap==1, "HOME COVER trap (home dog covering vs away non-covering fav)", "home")
spot(d.away_cover_trap==1, "AWAY COVER trap (away dog covering vs home non-covering fav)", "away")

# ============ Sensitivity sweeps for trap thresholds ============
L("\n"+"="*92); L("TRAP threshold sensitivity (total OVER variant)"); L("="*92)
for sum_thr in [4,5,6,8]:
    for line_thr in [-1,-2,-3,-4]:
        mask=(d.total_miss_sum_last3>=sum_thr)&(d.line_vs_league<=line_thr)
        sub=d[mask]
        if len(sub)<10: continue
        hit=(sub.actual_total>sub.open_total).astype(float)[sub.actual_total!=sub.open_total]
        k=int(hit.sum()); n=len(hit); lo,hi=wilson_ci(k,n) if n else (0,0)
        L(f"  sum>={sum_thr}, line_vs_league<={line_thr}: n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
L("\nTRAP threshold sensitivity (HOME cover variant)")
for h_thr in [2,3,5]:
    for a_thr in [-2,-3,-5]:
        mask=(d.h_margin_miss_s2d>=h_thr)&(d.a_margin_miss_s2d<=a_thr)&(d.home_spread>0)
        sub=d[mask]
        if len(sub)<10: continue
        hit=(sub.actual_margin+sub.open_spread>0).astype(float)
        k=int(hit.sum()); n=len(hit); lo,hi=wilson_ci(k,n) if n else (0,0)
        L(f"  h_miss>={h_thr}, a_miss<={a_thr}, home_dog: n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
