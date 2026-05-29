"""
REAL legacy EPA predictions (nfl_predictions_epa, 2025) x our best model — agreement test.
Pull the actual stored 2025 predictions, take the EARLIEST snapshot/game (pregame, leak-safe), join to our
2025 games. Validate the user's claims: primetime accuracy, the .40/.60 confidence buckets, OU. Then: does
filtering OUR picks to games where the legacy model AGREES & is confident sharpen the hit rate vs the OPENER?
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingClassifier
from fetch import fetch_table, cache
from forecast_harness import build, DATA
L=print
leg=cache("nfl_predictions_epa", lambda: fetch_table("nfl_predictions_epa"))
for c in ["home_away_spread_cover_prob","ou_result_prob","home_away_ml_prob"]: leg[c]=pd.to_numeric(leg[c],errors="coerce")
leg["as_of_ts"]=pd.to_datetime(leg["as_of_ts"],errors="coerce",utc=True)
leg=leg.sort_values("as_of_ts").groupby("unique_id",as_index=False).first()   # earliest pregame snapshot/game
leg=leg.rename(columns={"home_away_spread_cover_prob":"leg_spread","ou_result_prob":"leg_ou","home_away_ml_prob":"leg_ml"})
L(f"[legacy] {len(leg)} games (earliest snapshot). spread prob range {leg.leg_spread.min():.2f}-{leg.leg_spread.max():.2f}")

m,BASE=build(); m["actual_total"]=m.home_score+m.away_score; m["over_win"]=(m.actual_total>m.nv_total_line).astype(int); m["primetime_i"]=m.primetime.fillna(0).astype(int)
# our model: train <2025, predict 2025 (P home covers close)
tr=m[(m.season<2025)&(m.week>=4)].dropna(subset=["home_cover"]); te=m[(m.season==2025)&(m.week>=4)].copy()
clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[BASE],tr.home_cover)
te["our"]=clf.predict_proba(te[BASE])[:,1]
g=te.merge(leg[["unique_id","leg_spread","leg_ou","leg_ml"]],on="unique_id",how="inner")
L(f"[join] 2025 games matched to legacy: {len(g)} / our 2025 games {len(te)}  (join {len(g)/len(te)*100:.0f}%)")

# ---- validate LEGACY standalone (2025) ----
L("\n"+"="*82); L("LEGACY 2025 standalone (vs CLOSE): spread accuracy, primetime, .40/.60 buckets, OU"); L("="*82)
g["leg_home"]=g.leg_spread>=0.5; g["sp_correct"]=(g.leg_home==(g.home_cover==1))
gp=g[g.primetime_i==1]
L(f"  spread acc all: {g.sp_correct.mean()*100:.1f}% (n={len(g)})  | PRIMETIME: {gp.sp_correct.mean()*100:.1f}% (n={len(gp)})")
g["ou_over"]=g.leg_ou>=0.5; g["ou_correct"]=(g.ou_over==(g.over_win==1))
gpo=g[g.primetime_i==1]; L(f"  O/U acc all: {g.ou_correct.mean()*100:.1f}% (n={len(g)})  | PRIMETIME: {gpo.ou_correct.mean()*100:.1f}% (n={len(gpo)})")
L("  spread confidence buckets -> actual home-cover rate:")
for lo,hi in [(0,.4),(.4,.5),(.5,.6),(.6,1.01)]:
    s=g[(g.leg_spread>=lo)&(g.leg_spread<hi)]; L(f"    leg_spread[{lo:.1f}-{hi:.2f}): home covers {s.home_cover.mean()*100 if len(s) else 0:.1f}% (n={len(s)})")

# ---- AGREEMENT vs OPENER ----
L("\n"+"="*82); L("AGREEMENT — OUR pick filtered by LEGACY confident split, graded vs the OPENER (2025)"); L("="*82)
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet")); key=["season","home_ab","away_ab"]
d=g.merge(od[key+["open_spread"]],on=key,how="inner").dropna(subset=["open_spread"])
d["hco"]=(d.actual_margin+d.open_spread>0).astype(float); d=d[d.actual_margin+d.open_spread!=0]
CONF=0.03
def res(sub,pick_home_series,label):
    won=np.where(pick_home_series, sub.hco, 1-sub.hco); won=won[~np.isnan(won)]; n=len(won);k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else(0,0)
    L(f"  {label:42s}: n={n} hit={(k/n*100 if n else 0):.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
oh=d[d.our>=0.5+CONF]; oa=d[d.our<=0.5-CONF]; allour=pd.concat([oh,oa])
res(allour, allour.our>=0.5, "OUR model alone (2025)")
lh=d[d.leg_spread>=0.6]; la=d[d.leg_spread<=0.4]; alllg=pd.concat([lh,la])
res(alllg, alllg.leg_spread>=0.5, "LEGACY confident alone (>=.60/<=.40)")
ah=oh[oh.leg_spread>=0.60]; aa=oa[oa.leg_spread<=0.40]; agree=pd.concat([ah,aa])
res(agree, agree.our>=0.5, "OUR + LEGACY agree & confident")
res(agree[agree.primetime_i==1], agree[agree.primetime_i==1].our>=0.5, "  ^ primetime subset")
# disagreement (our pick, legacy opposes) for contrast
dis=pd.concat([oh[oh.leg_spread<=0.4], oa[oa.leg_spread>=0.6]]); res(dis, dis.our>=0.5, "OUR pick but LEGACY DISAGREES (fade check)")
L(f"\n  corr(legacy_spread, our) = {np.corrcoef(d.leg_spread,d.our)[0,1]:.3f}")
