"""1H ML DOG-CONVERSION (last frontier): NOSTR margin model predicts the 1H ML DOG wins the half OUTRIGHT
-> bet dog ML at posted close (consensus + best price). Gates on predicted dog margin. Per-season, ROI at price."""
import numpy as np, pandas as pd, exp_shared as E
gm,FEATS=E.load()
nets=[c for c in [] ]
nl=[]
for b in [c[len("home_adj_"):-len("_allowed")] for c in gm.columns if c.startswith("home_adj_") and c.endswith("_allowed")]:
    gm[f"net_{b}"]=(gm[f"home_adj_{b}"]+gm[f"away_adj_{b}_allowed"])-(gm[f"away_adj_{b}"]+gm[f"home_adj_{b}_allowed"]); nl.append(f"net_{b}")
qs=[]
for y in [2016,2017,2018,2019,2021,2022,2023,2024,2025]:
    g=pd.read_parquet(f"data/cfbd/games_{y}.parquet")
    g["h1m"]=g.homeLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)-g.awayLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)
    qs.append(g[["id","h1m"]].rename(columns={"id":"game_id"}))
gm=gm.merge(pd.concat(qs),on="game_id",how="left")
STR={"elo_diff","talent_diff","net_rating_diff","home_elo","away_elo","home_talent","away_talent","home_net_rating","away_net_rating"}
FE=[f for f in FEATS if f not in STR]+nl
EV=pd.concat([pd.read_parquet(f"data/event_odds/events_{y}.parquet") for y in [2023,2024,2025]])
nm=sorted(set(gm.homeTeam)|set(gm.awayTeam))
def tdb(o):
    c=[x for x in nm if str(o).startswith(str(x)+" ") or o==x]; c.sort(key=len,reverse=True); return c[0] if c else None
ml=EV[(EV.market=="h2h_h1")&(EV.snap_tag=="h2")].copy(); ml["t"]=ml.name.map(tdb)
mh=ml[ml.t==ml.home].groupby(["season","game_id"]).price.agg(mlh="median",mlh_best="max").reset_index()
ma=ml[ml.t==ml.away].groupby(["season","game_id"]).price.agg(mla="median",mla_best="max").reset_index()
parts=[]
for S in [2023,2024,2025]:
    tr=gm[(gm.season<S)&gm.h1m.notna()]; te=gm[gm.season==S].copy()
    te["pm"]=np.mean([E.gbm(s).fit(tr[FE],tr.h1m).predict(te[FE]) for s in range(5)],axis=0); parts.append(te)
H=pd.concat(parts).merge(mh,on=["season","game_id"]).merge(ma,on=["season","game_id"])
H=H[H.h1m.notna()&(H.h1m!=0)].copy()
def run(lab,gate,best=False):
    # dog = positive ML side; condition: model predicts that side WINS 1H by >= gate
    ph=H[(H.mlh>0)&(H.pm>=gate)].copy(); ph["ml"]=ph.mlh_best if best else ph.mlh; ph["won"]=ph.h1m>0
    pa=H[(H.mla>0)&(H.pm<=-gate)].copy(); pa["ml"]=pa.mla_best if best else pa.mla; pa["won"]=pa.h1m<0
    b=pd.concat([ph,pa]); b=b[b.ml.between(100,1200)]
    if len(b)<20: print(f"  {lab:<36} n={len(b)} thin"); return
    pnl=np.where(b.won,b.ml/100,-1.0)
    per="/".join(f"{100*pd.Series(pnl)[(b.season==s).values].mean():+.0f}%({(b.season==s).sum()})" for s in [2023,2024,2025] if (b.season==s).sum()>=5)
    print(f"  {lab:<36} n={len(b)} win {100*b.won.mean():.1f}% avgML +{b.ml.mean():.0f} ROI {100*pnl.mean():+.1f}% [{per}]")
print("1H ML dog-conversion (NOSTR predicts ML-dog wins half outright):")
for g_ in [0.5,1,2]:
    run(f"pred dog-margin>={g_} @consensus",g_)
    run(f"pred dog-margin>={g_} @BEST price",g_,best=True)
