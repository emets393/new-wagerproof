"""1H MODEL v2: as-of 1H team profiles (pts for/against, 1H share = front-runner trait) + nets +
anchored(under)/unanchored(over) split. Graded vs posted 1H close consensus + best-shop. 2023-25."""
import numpy as np, pandas as pd, exp_shared as E
gm,FEATS=E.load()
nets=[]
for b in [c[len("home_adj_"):-len("_allowed")] for c in gm.columns if c.startswith("home_adj_") and c.endswith("_allowed")]:
    gm[f"net_{b}"]=(gm[f"home_adj_{b}"]+gm[f"away_adj_{b}_allowed"])-(gm[f"away_adj_{b}"]+gm[f"home_adj_{b}_allowed"]); nets.append(f"net_{b}")
qs=[]
for y in [2016,2017,2018,2019,2021,2022,2023,2024,2025]:
    g=pd.read_parquet(f"data/cfbd/games_{y}.parquet")
    g["h1h"]=g.homeLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)
    g["h1a"]=g.awayLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)
    qs.append(g[["id","season","week","homeTeam","awayTeam","h1h","h1a","homePoints","awayPoints"]].rename(columns={"id":"game_id"}))
Q=pd.concat(qs)
# as-of team 1H profiles
L=[]
for _,r in Q.iterrows():
    if pd.isna(r.h1h): continue
    L.append({"season":r.season,"week":r.week,"game_id":r.game_id,"team":r.homeTeam,"f":r.h1h,"ag":r.h1a,"sh":r.h1h/max(r.homePoints,1)})
    L.append({"season":r.season,"week":r.week,"game_id":r.game_id,"team":r.awayTeam,"f":r.h1a,"ag":r.h1h,"sh":r.h1a/max(r.awayPoints,1)})
L=pd.DataFrame(L).sort_values(["team","season","week"])
gb=L.groupby(["team","season"],group_keys=False)
for c in ["f","ag","sh"]: L[f"p_{c}"]=gb[c].apply(lambda s:s.shift().expanding().mean())
prof=L[["season","game_id","team","p_f","p_ag","p_sh"]]
gm=gm.merge(Q[["game_id","h1h","h1a"]],on="game_id",how="left")
gm["h1_total"]=gm.h1h+gm.h1a; gm["h1_margin"]=gm.h1h-gm.h1a
for w in ["home","away"]:
    gm=gm.merge(prof.rename(columns={"team":f"{w}Team","p_f":f"{w}_h1f","p_ag":f"{w}_h1ag","p_sh":f"{w}_h1sh"}),on=["season","game_id",f"{w}Team"],how="left")
H1F=["home_h1f","home_h1ag","home_h1sh","away_h1f","away_h1ag","away_h1sh"]
UN=FEATS+nets+H1F; AN=UN+["total_open","spread_open"]
# posted 1H close (consensus + best)
EV=pd.concat([pd.read_parquet(f"data/event_odds/events_{y}.parquet") for y in [2023,2024,2025]])
t1=EV[(EV.market=="totals_h1")&(EV.snap_tag=="h2")&(EV.name=="Over")].groupby(["season","game_id"]).point.agg(line="median",hi="max",lo="min").reset_index()
parts=[]
for S in [2023,2024,2025]:
    tr=gm[(gm.season<S)&gm.h1_total.notna()]; te=gm[gm.season==S].copy()
    te["pu"]=E.gbm().fit(tr[UN],tr.h1_total).predict(te[UN])
    te["pa"]=E.gbm().fit(tr[AN],tr.h1_total).predict(te[AN])
    te["pm"]=E.gbm().fit(tr[UN],tr.h1_margin).predict(te[UN]); parts.append(te)
H=pd.concat(parts).merge(t1,on=["season","game_id"]).dropna(subset=["h1_total","line"])
def rep(lab,b,w):
    if len(b)<25: print(f"  {lab:<42} n={len(b)} thin"); return
    n=len(b);ww=int(w.sum());lo,hi=E.wilson(ww,n);roi=(ww*.909-(n-ww))/n*100
    per="/".join(f"{100*w[b.season==s].mean():.0f}({(b.season==s).sum()})" for s in [2023,2024,2025] if (b.season==s).sum())
    print(f"  {lab:<42} n={n:<4} {100*ww/n:5.1f}% CI[{lo:.0f},{hi:.0f}] roi{roi:+6.1f} [{per}]")
print("1H TOTALS v2 (anchored UNDER / unanchored OVER):")
for gate in [2,3]:
    b=H[(H.pa<=H.line-gate)&(H.h1_total!=H.line)]; rep(f"ANCH under<=line-{gate} @cons",b,pd.Series((b.h1_total<b.line).values,index=b.index))
    b=H[(H.pu>=H.line+gate)&(H.h1_total!=H.line)]; rep(f"UNANCH over>=line+{gate} @cons",b,pd.Series((b.h1_total>b.line).values,index=b.index))
b=H[(H.pa<=H.hi-2)&(H.h1_total!=H.hi)]; rep("ANCH under @BEST(hi)-2",b,pd.Series((b.h1_total<b.hi).values,index=b.index))
b=H[(H.pu>=H.lo+2)&(H.h1_total!=H.lo)]; rep("UNANCH over @BEST(lo)+2",b,pd.Series((b.h1_total>b.lo).values,index=b.index))
# 1H spread v2
s1=EV[(EV.market=="spreads_h1")&(EV.snap_tag=="h2")].copy()
nm=sorted(set(gm.homeTeam)|set(gm.awayTeam))
def tdb(o):
    c=[x for x in nm if str(o).startswith(x+" ") or o==x]; c.sort(key=len,reverse=True); return c[0] if c else None
s1["t"]=s1.name.map(tdb); s1=s1[s1.t==s1.home]
s1=s1.groupby(["season","game_id"]).point.median().rename("hs").reset_index()
H2=pd.concat(parts).merge(s1,on=["season","game_id"]).dropna(subset=["h1_margin","hs"])
print("1H SPREAD v2 (margin model + h1 profiles + nets):")
for gate in [2,3]:
    b=H2[((H2.pm+H2.hs).abs()>=gate)&((H2.h1_margin+H2.hs)!=0)].copy()
    hc=(b.h1_margin+b.hs)>0; w=pd.Series(np.where(b.pm+b.hs>0,hc,~hc),index=b.index)
    rep(f"|edge|>={gate} @cons",b,w)
