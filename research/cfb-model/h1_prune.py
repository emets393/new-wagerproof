"""1H feature PRUNING: permutation importance on h1_total (train<2023, perm on 2023), then compact
walk-forward models on top-K features, graded vs posted 1H close (consensus + shop). Compare to v1 kitchen-sink."""
import numpy as np, pandas as pd, exp_shared as E
from sklearn.inspection import permutation_importance
gm,FEATS=E.load()
qs=[]
for y in [2016,2017,2018,2019,2021,2022,2023,2024,2025]:
    g=pd.read_parquet(f"data/cfbd/games_{y}.parquet")
    g["h1t"]=g.homeLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)+g.awayLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)
    qs.append(g[["id","h1t"]].rename(columns={"id":"game_id"}))
gm=gm.merge(pd.concat(qs),on="game_id",how="left")
tr=gm[(gm.season<2023)&gm.h1t.notna()]; va=gm[(gm.season==2023)&gm.h1t.notna()]
m=E.gbm().fit(tr[FEATS],tr.h1t)
pi=permutation_importance(m,va[FEATS].fillna(va[FEATS].median()),va.h1t,n_repeats=3,random_state=0,n_jobs=-1)
rank=pd.Series(pi.importances_mean,index=FEATS).sort_values(ascending=False)
print("TOP-15 features for 1H total:"); print(rank.head(15).round(4).to_string())
EV=pd.concat([pd.read_parquet(f"data/event_odds/events_{y}.parquet") for y in [2023,2024,2025]])
t1=EV[(EV.market=="totals_h1")&(EV.snap_tag=="h2")&(EV.name=="Over")].groupby(["season","game_id"]).point.agg(line="median",hi="max",lo="min").reset_index()
def rep(lab,b,w):
    if len(b)<25: print(f"  {lab:<40} n={len(b)} thin"); return
    n=len(b);ww=int(w.sum());lo,hi=E.wilson(ww,n);roi=(ww*.909-(n-ww))/n*100
    per="/".join(f"{100*w[b.season==s].mean():.0f}({(b.season==s).sum()})" for s in [2023,2024,2025] if (b.season==s).sum())
    print(f"  {lab:<40} n={n:<4} {100*ww/n:5.1f}% CI[{lo:.0f},{hi:.0f}] roi{roi:+6.1f} [{per}]")
for K in [15,30]:
    top=list(rank.head(K).index); parts=[]
    for S in [2023,2024,2025]:
        trn=gm[(gm.season<S)&gm.h1t.notna()]; te=gm[gm.season==S].copy()
        te["p"]=E.gbm().fit(trn[top],trn.h1t).predict(te[top]); parts.append(te)
    H=pd.concat(parts).merge(t1,on=["season","game_id"]).dropna(subset=["h1t","line"])
    print(f"--- top-{K} pruned model ---")
    b=H[((H.p-H.line).abs()>=2)&(H.h1t!=H.line)]; w=pd.Series(np.where(b.p>b.line,b.h1t>b.line,b.h1t<b.line),index=b.index)
    rep(f"|edge|>=2 @cons",b,w)
    b=H[(H.p<=H.hi-2)&(H.h1t!=H.hi)]; rep("UNDER @best-2",b,pd.Series((b.h1t<b.hi).values,index=b.index))
    b=H[(H.p>=H.lo+2)&(H.h1t!=H.lo)]; rep("OVER @best+2",b,pd.Series((b.h1t>b.lo).values,index=b.index))
