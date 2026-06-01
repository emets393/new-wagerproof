"""
b68: SIDES MODEL feature expansion. Mirror b54's approach (totals) on sides:
  - Throw all matchup features (~400) at predicting home_cover
  - Strict leak filter (betting lines, outcomes, residuals, etc.)
  - Walk-forward train, permutation importance, compare to locked 33-feature baseline.

Goal: see if there's predictive juice in features we haven't included. If MAE/hit improves
materially and CLV is consistent or better, consider expanding the sides model.
"""
import os, sys, warnings, time
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"]=m.home_score-m.away_score
m["actual_total"]=m.home_score+m.away_score
m["home_cover"]=(m.actual_margin+m.home_spread>0).astype(int)
L(f"[load] matchup: {m.shape}")

# Leak filter (mirror b54)
BL=['spread','total_line','_line','odds','money','juice','implied','vegas','book','ml_','_ml','open_','close_']
BL_KEEP=['oline','dline']
OUTCOME=['cover','spread_miss','spread_diff','away_favorite','total_points','actual_','_actual','resid_',
         'fav_margin','fav_won','_won','_final','total_score','winning_','losing_','final_',
         'points_scored','points_allowed_actual','upset','outright','total_diff','total_miss',
         'total_won','margin_won','margin_loss','underdog_covered','favorite_covered','_outcome',
         '_result','over_win','under_win','ats_win','ml_win','mkt_','exp_margin','exp_total','exp_pts']
SAFE_SFX=('_s2d','_last3','_last5','_pr','_rate','_pct','_streak','_per_game','_per_play','_per_drive')
def is_bet(c):
    cl=c.lower()
    if any(k in cl for k in BL_KEEP): return False
    return any(t in cl for t in BL)
def is_outc(c):
    cl=c.lower()
    if cl.endswith(SAFE_SFX): return False
    if '_s2d_' in cl or '_last3_' in cl or '_last5_' in cl: return False
    return any(t in cl for t in OUTCOME)
betting=[c for c in m.columns if is_bet(c)]
outc=[c for c in m.columns if is_outc(c)]
ID={'season','week','home_ab','away_ab','game_id','gameday','game_date','date','home_coach','away_coach',
    'home_score','away_score','home_cover','actual_margin','actual_total'}
exclude=set(betting)|set(outc)|ID
L(f"[exclude] {len(betting)} betting + {len(outc)} outcome cols\n")

feats=[c for c in m.columns if c not in exclude]
for c in feats:
    if m[c].dtype=='object': m[c]=pd.to_numeric(m[c],errors='coerce')
feats=[c for c in feats if m[c].notna().sum()/len(m)>=0.5]
L(f"[features] candidates after coverage filter: {len(feats)}")

# Leak scan: corr with home_cover
suspect=[]
ht=m.home_cover.astype(float)
for c in feats:
    cc=m[c].corr(ht)
    if pd.notna(cc) and abs(cc)>0.5: suspect.append((c,cc))
L(f"\n[leak scan] cols with |corr|>0.5 vs home_cover (auto-exclude):")
for c,cc in sorted(suspect,key=lambda x:abs(x[1]),reverse=True): L(f"  {c}: corr={cc:+.3f}")
feats=[f for f in feats if f not in set([s[0] for s in suspect])]
L(f"\n[features] FINAL count: {len(feats)}")

# Walk-forward train, test on 2024+2025
W=m[m.week>=4].copy()
W["ph"]=np.nan
for Y in [2024,2025]:
    tr=W[W.season<Y].dropna(subset=['home_cover']+feats)
    te=W[W.season==Y]
    clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.home_cover)
    W.loc[te.index,"ph"]=clf.predict_proba(te[feats])[:,1]

# Grade vs opener
d=W[W.season.isin([2024,2025])].merge(od[['season','home_ab','away_ab','open_spread','close_spread']],on=['season','home_ab','away_ab'],how='inner').dropna(subset=['ph','open_spread'])
d["hco"]=(d.actual_margin+d.open_spread>0).astype(float)
d.loc[d.actual_margin+d.open_spread==0,"hco"]=np.nan
d["clv"]=np.where(d.ph>=0.5, d.open_spread-d.close_spread, d.close_spread-d.open_spread)

def grade(d, label, conf):
    bh=d[d.ph>=0.5+conf]; ba=d[d.ph<=0.5-conf]
    won=pd.concat([bh.hco,1-ba.hco]).dropna(); k=int(won.sum()); n=len(won)
    if n==0: return
    clv=pd.concat([bh.clv,ba.clv]).mean()
    lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    L(f"  {label} conf>=.{int(conf*100):02d}: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}% CLV={clv:+.3f}")

L(f"\n{'='*84}\nEXPANDED SIDES MODEL ({len(feats)} features) — held-out 2024+2025\n{'='*84}")
for conf in [0.02,0.03,0.05,0.07]: grade(d, f"EXP({len(feats)}f)", conf)

# Per-season
L(f"\nPer-season:")
for Y in [2024,2025]:
    dy=d[d.season==Y].copy()
    for conf in [0.03]:
        bh=dy[dy.ph>=0.5+conf]; ba=dy[dy.ph<=0.5-conf]
        won=pd.concat([bh.hco,1-ba.hco]).dropna(); k=int(won.sum()); n=len(won)
        if n>0:
            roi=(k*100/110-(n-k))/n*100; clv=pd.concat([bh.clv,ba.clv]).mean()
            L(f"  {Y}: n={n} hit={k/n*100:.1f}% ROI={roi:+.1f}% CLV={clv:+.3f}")

# Compare to current locked 33-feature model
L(f"\n{'='*84}\nCOMPARE: Current locked 33-feature sides model (same train/test split)\n{'='*84}")
from forecast_harness import build
m2,BASE=build()
W2=m2[m2.week>=4].copy()
W2["actual_margin"]=W2.home_score-W2.away_score
W2["home_cover"]=(W2.actual_margin+W2.home_spread>0).astype(int)
W2["ph"]=np.nan
for Y in [2024,2025]:
    tr=W2[W2.season<Y].dropna(subset=['home_cover']+BASE)
    te=W2[W2.season==Y]
    clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[BASE],tr.home_cover)
    W2.loc[te.index,"ph"]=clf.predict_proba(te[BASE])[:,1]
d2=W2[W2.season.isin([2024,2025])].merge(od[['season','home_ab','away_ab','open_spread','close_spread']],on=['season','home_ab','away_ab'],how='inner').dropna(subset=['ph','open_spread'])
d2["hco"]=(d2.actual_margin+d2.open_spread>0).astype(float)
d2.loc[d2.actual_margin+d2.open_spread==0,"hco"]=np.nan
d2["clv"]=np.where(d2.ph>=0.5, d2.open_spread-d2.close_spread, d2.close_spread-d2.open_spread)
for conf in [0.02,0.03,0.05,0.07]: grade(d2, f"LOCKED(33f)", conf)

# Permutation importance on the wide model
L(f"\n{'='*84}\nTOP-30 features by permutation importance (test=2025)\n{'='*84}")
Y=2025
tr=W[W.season<Y].dropna(subset=['home_cover']+feats)
te=W[W.season==Y].dropna(subset=['home_cover']+feats)
clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.home_cover)
t0=time.time()
imp=permutation_importance(clf,te[feats],te.home_cover,n_repeats=5,random_state=0,n_jobs=-1)
L(f"  done in {time.time()-t0:.0f}s\n")
idf=pd.DataFrame({'feature':feats,'imp':imp.importances_mean,'std':imp.importances_std}).sort_values('imp',ascending=False)
for _,r in idf.head(30).iterrows():
    in_locked = "✓ in locked" if r.feature in BASE else "  new"
    L(f"  {r.feature:50s} {r.imp:+.4f} ± {r['std']:.4f}  {in_locked}")
idf.to_csv(os.path.join(DATA,"b68_sides_importance.csv"),index=False)
L(f"\n[save] full importance ranking -> data/b68_sides_importance.csv")
