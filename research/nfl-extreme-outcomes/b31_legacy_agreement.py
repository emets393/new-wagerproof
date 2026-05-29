"""
LEGACY EPA model (reconstructed) x OUR best model — agreement test.
The real stored predictions (nfl_predictions_epa / _history) are EMPTY (offseason). So reconstruct the legacy
binary classifier from its own training table (nfl_training_data_epa = matchup.parquet): EPA features + spread
-> P(home covers close). Validate the user's claims (primetime, per-season 'needs dense data', .40/.60 buckets),
then test: when OUR model agrees with the legacy model's CONFIDENT split (>=.60 home / <=.40 away), do picks
sharpen? Graded held-out 2024-25 vs the OPENER (+ primetime + per-season).
NOTE: reconstruction ~ the production model in behavior, not byte-identical.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingClassifier
from forecast_harness import build, DATA
L=print
m,BASE=build()                       # m has all features + home_cover (vs close); BASE = our model features
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["primetime_i"]=m.primetime.fillna(0).astype(int)
m["over_win"]=(m.actual_total>m.nv_total_line).astype(int) if "actual_total" in m else None
m["actual_total"]=m.home_score+m.away_score; m["over_win"]=(m.actual_total>m.nv_total_line).astype(int)
# ---- LEGACY EPA feature set (leak-safe: pregame EPA/efficiency + ratings + the line) ----
pat=("_off_pass_epa_neutral_s2d","_off_rush_epa_neutral_s2d","_def_pass_epa_allowed_neutral_s2d",
     "_def_rush_epa_allowed_neutral_s2d","_off_explosive_pass_rate_s2d","_off_ppd_s2d","_def_ppd_allowed_s2d",
     "_off_success","_off_pass_sr","_pass_edge_s2d","_rush_edge_s2d","_off_cpoe_s2d")
LEG=[c for c in m.columns for s in pat if c.endswith(s) or s in c]
LEG=sorted(set([c for c in LEG if m[c].notna().mean()>0.7]))
for extra in ["edge_home_s2d","home_predictive_pr","away_predictive_pr","home_spread"]:
    if extra in m.columns and extra not in LEG: LEG.append(extra)
BAN=("cover","_win","spread_diff","spread_miss","favorite_","underdog_","actual_","score")
LEG=[c for c in LEG if not any(b in c for b in BAN)]
for c in LEG+BASE: m[c]=pd.to_numeric(m[c],errors="coerce")
L(f"[legacy] reconstructed from {len(LEG)} EPA features; target=home_away_spread_cover (home covers close)")

def walkfwd(feats,target):
    p=pd.Series(np.nan,index=m.index)
    for Y in range(2021,2026):
        tr=m[(m.season<Y)&(m.week>=4)].dropna(subset=[target]); te=m[(m.season==Y)&(m.week>=4)]
        if len(tr)<300: continue
        clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr[target])
        p.loc[te.index]=clf.predict_proba(te[feats])[:,1]
    return p
m["leg"]=walkfwd(LEG,"home_cover")        # legacy P(home covers)
m["our"]=walkfwd(BASE,"home_cover")       # our P(home covers)

# ---- validate LEGACY standalone (vs close) ----
L("\n"+"="*84); L("LEGACY standalone — accuracy vs CLOSE (predict home covers), per season + primetime"); L("="*84)
v=m.dropna(subset=["leg","home_cover"]).copy(); v["leg_pick_home"]=v.leg>=0.5; v["correct"]=(v.leg_pick_home==(v.home_cover==1))
for yr in range(2021,2026):
    s=v[v.season==yr]; sp=s[s.primetime_i==1]
    L(f"  {yr}: all {s.correct.mean()*100:4.1f}% (n={len(s)})  | primetime {sp.correct.mean()*100 if len(sp) else 0:4.1f}% (n={len(sp)})")
L("  confidence buckets (legacy prob) -> home-cover rate (the .40/.60 idea):")
for lo,hi in [(0,.4),(.4,.5),(.5,.6),(.6,1.01)]:
    s=v[(v.leg>=lo)&(v.leg<hi)]; L(f"    leg[{lo:.1f}-{hi:.2f}): home covers {s.home_cover.mean()*100:.1f}% (n={len(s)})  -> {'confident AWAY' if hi<=.4 else 'confident HOME' if lo>=.6 else 'lean'}")

# ---- AGREEMENT test vs OPENER (held-out 2024-25) ----
L("\n"+"="*84); L("AGREEMENT — OUR pick filtered by LEGACY confident split (>=.60 home / <=.40 away) vs OPENER"); L("="*84)
key=["season","home_ab","away_ab"]; d=m[m.season.isin([2024,2025])].merge(od[key+["open_spread"]],on=key,how="inner").dropna(subset=["leg","our","open_spread"])
d["hco"]=(d.actual_margin+d.open_spread>0).astype(float); d.loc[d.actual_margin+d.open_spread==0,"hco"]=np.nan
def hit(sub,pick_home):
    won=np.where(pick_home, sub.hco, 1-sub.hco); won=won[~np.isnan(won)]; n=len(won);k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else(0,0); return n,(k/n*100 if n else 0),lo*100,hi*100
CONF=0.03
our_home=d[d.our>=0.5+CONF]; our_away=d[d.our<=0.5-CONF]
n,h,lo,hi=hit(pd.concat([our_home,our_away]), pd.concat([our_home,our_away]).our>=0.5); L(f"  OUR model alone: n={n} hit={h:.1f}% CI[{lo:.0f},{hi:.0f}]")
# agreement: our home pick AND legacy>=.60 ; our away pick AND legacy<=.40
ah=our_home[our_home.leg>=0.60]; aa=our_away[our_away.leg<=0.40]
won=np.concatenate([np.where(True,ah.hco,np.nan), np.where(True,1-aa.hco,np.nan)]); won=won[~np.isnan(won)]; n=len(won);k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else(0,0)
L(f"  OUR + LEGACY agree & confident: n={n} hit={(k/n*100 if n else 0):.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  (~{n/2:.0f}/yr)")
# primetime subset of agreement
ahp=ah[ah.primetime_i==1]; aap=aa[aa.primetime_i==1]
won=np.concatenate([ahp.hco.values, (1-aap.hco).values]); won=won[~np.isnan(won)]; n=len(won);k=int(won.sum())
L(f"     of which PRIMETIME: n={n} hit={(k/n*100 if n else 0):.1f}%")
# per-season agreement
for yr in [2024,2025]:
    ahy=ah[ah.season==yr]; aay=aa[aa.season==yr]; won=np.concatenate([ahy.hco.values,(1-aay.hco).values]); won=won[~np.isnan(won)]; n=len(won);k=int(won.sum())
    L(f"     {yr}: n={n} hit={(k/n*100 if n else 0):.1f}%")
# correlation of the two models
cc=m.dropna(subset=["leg","our"]); L(f"\n  corr(legacy, our) = {np.corrcoef(cc.leg,cc.our)[0,1]:.3f}  (high => agreement is near-redundant, not independent)")
