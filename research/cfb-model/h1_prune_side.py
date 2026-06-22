"""Pruned 1H MARGIN model -> graded vs posted 1H SPREAD and 1H ML (close). Same protocol as h1_prune."""
import numpy as np, pandas as pd, exp_shared as E
from sklearn.inspection import permutation_importance
gm,FEATS=E.load()
qs=[]
for y in [2016,2017,2018,2019,2021,2022,2023,2024,2025]:
    g=pd.read_parquet(f"data/cfbd/games_{y}.parquet")
    g["h1m"]=g.homeLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)-g.awayLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)
    qs.append(g[["id","h1m"]].rename(columns={"id":"game_id"}))
gm=gm.merge(pd.concat(qs),on="game_id",how="left")
tr=gm[(gm.season<2023)&gm.h1m.notna()]; va=gm[(gm.season==2023)&gm.h1m.notna()]
m=E.gbm().fit(tr[FEATS],tr.h1m)
pi=permutation_importance(m,va[FEATS].fillna(va[FEATS].median()),va.h1m,n_repeats=3,random_state=0,n_jobs=-1)
rank=pd.Series(pi.importances_mean,index=FEATS).sort_values(ascending=False)
print("TOP-10 for 1H margin:"); print(rank.head(10).round(4).to_string())
top=list(rank.head(15).index)
EV=pd.concat([pd.read_parquet(f"data/event_odds/events_{y}.parquet") for y in [2023,2024,2025]])
nm=sorted(set(gm.homeTeam)|set(gm.awayTeam))
def tdb(o):
    c=[x for x in nm if str(o).startswith(str(x)+" ") or o==x]; c.sort(key=len,reverse=True); return c[0] if c else None
s1=EV[(EV.market=="spreads_h1")&(EV.snap_tag=="h2")].copy(); s1["t"]=s1.name.map(tdb); s1=s1[s1.t==s1.home]
sc=s1.groupby(["season","game_id"]).point.agg(hs="median",hs_hi="max",hs_lo="min").reset_index()
ml=EV[(EV.market=="h2h_h1")&(EV.snap_tag=="h2")].copy(); ml["t"]=ml.name.map(tdb)
mlh=ml[ml.t==ml.home].groupby(["season","game_id"]).price.median().rename("mlh").reset_index()
mla=ml[ml.t==ml.away].groupby(["season","game_id"]).price.median().rename("mla").reset_index()
parts=[]
for S in [2023,2024,2025]:
    trn=gm[(gm.season<S)&gm.h1m.notna()]; te=gm[gm.season==S].copy()
    te["pm"]=E.gbm().fit(trn[top],trn.h1m).predict(te[top]); parts.append(te)
H=pd.concat(parts).merge(sc,on=["season","game_id"],how="left").merge(mlh,on=["season","game_id"],how="left").merge(mla,on=["season","game_id"],how="left")
H=H[H.h1m.notna()]
def rep(lab,b,w):
    if len(b)<25: print(f"  {lab:<40} n={len(b)} thin"); return
    n=len(b);ww=int(w.sum());lo,hi=E.wilson(ww,n);roi=(ww*.909-(n-ww))/n*100
    per="/".join(f"{100*w[b.season==s].mean():.0f}({(b.season==s).sum()})" for s in [2023,2024,2025] if (b.season==s).sum())
    print(f"  {lab:<40} n={n:<4} {100*ww/n:5.1f}% CI[{lo:.0f},{hi:.0f}] roi{roi:+6.1f} [{per}]")
print("--- 1H SPREAD (pruned-15) ---")
for gate in [2,3]:
    b=H[H.hs.notna()].copy(); b["e"]=b.pm+b.hs; b=b[(b.e.abs()>=gate)&((b.h1m+b.hs)!=0)]
    hc=(b.h1m+b.hs)>0; rep(f"|edge|>={gate} @cons",b,pd.Series(np.where(b.e>0,hc,~hc),index=b.index))
print("--- 1H MONEYLINE (pruned-15, dog-side only @ posted price) ---")
b=H[H.mlh.notna()&H.mla.notna()&(H.h1m!=0)].copy()
b["pick_home"]=b.pm>0
b["dogpick"]=np.where(b.pick_home,b.mlh>0,b.mla>0)
b["ml"]=np.where(b.pick_home,b.mlh,b.mla)
for gate in [2,3]:
    d=b[(b.pm.abs()>=gate)&b.dogpick]
    won=np.where(d.pick_home,d.h1m>0,d.h1m<0)
    pnl=np.where(won,d.ml/100,-1.0)
    per="/".join(f"{100*pd.Series(pnl)[ (d.season==s).values ].mean():+.0f}%" for s in [2023,2024,2025] if (d.season==s).sum()>=5)
    print(f"  dog ML |pred|>={gate}: n={len(d)} win {100*won.mean():.1f}% avgML +{d.ml.mean():.0f} ROI {100*pnl.mean():+.1f}% [{per}]")
