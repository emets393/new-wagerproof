"""PRE-REGISTERED CONFIRM: NOSTR 1H-spread model (strength features removed), 5-seed avg.
PASS = pooled>=52.4% at gates 2,3,4 AND 2025>=52% at gate 3. Else: no product."""
import numpy as np, pandas as pd, exp_shared as E
gm,FEATS=E.load()
nets=[]
for b in [c[len("home_adj_"):-len("_allowed")] for c in gm.columns if c.startswith("home_adj_") and c.endswith("_allowed")]:
    gm[f"net_{b}"]=(gm[f"home_adj_{b}"]+gm[f"away_adj_{b}_allowed"])-(gm[f"away_adj_{b}"]+gm[f"home_adj_{b}_allowed"]); nets.append(f"net_{b}")
qs=[]
for y in [2016,2017,2018,2019,2021,2022,2023,2024,2025]:
    g=pd.read_parquet(f"data/cfbd/games_{y}.parquet")
    g["h1m"]=g.homeLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)-g.awayLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)
    qs.append(g[["id","h1m"]].rename(columns={"id":"game_id"}))
gm=gm.merge(pd.concat(qs),on="game_id",how="left")
EV=pd.concat([pd.read_parquet(f"data/event_odds/events_{y}.parquet") for y in [2023,2024,2025]])
nm=sorted(set(gm.homeTeam)|set(gm.awayTeam))
def tdb(o):
    c=[x for x in nm if str(o).startswith(str(x)+" ") or o==x]; c.sort(key=len,reverse=True); return c[0] if c else None
s1=EV[(EV.market=="spreads_h1")&(EV.snap_tag=="h2")].copy(); s1["t"]=s1.name.map(tdb); s1=s1[s1.t==s1.home]
sc=s1.groupby(["season","game_id"]).point.median().rename("hs").reset_index()
gm=gm.merge(sc,on=["season","game_id"],how="left")
STR={"elo_diff","talent_diff","net_rating_diff","home_elo","away_elo","home_talent","away_talent","home_net_rating","away_net_rating"}
FE=[f for f in FEATS if f not in STR]+nets
parts=[]
for S in [2023,2024,2025]:
    trn=gm[(gm.season<S)&gm.h1m.notna()]; te=gm[gm.season==S].copy()
    te["pm"]=np.mean([E.gbm(sd).fit(trn[FE],trn.h1m).predict(te[FE]) for sd in range(5)],axis=0); parts.append(te)
H=pd.concat(parts); H=H[H.h1m.notna()&H.hs.notna()].copy()
H["e"]=H.pm+H.hs; H=H[(H.h1m+H.hs)!=0]; hc=(H.h1m+H.hs)>0; H["win"]=np.where(H.e>0,hc,~hc)
ok=True
for gate in [2,3,4]:
    b=H[H.e.abs()>=gate]; hit=100*b.win.mean()
    per="/".join(f"{100*b.win[b.season==s].mean():.0f}({(b.season==s).sum()})" for s in [2023,2024,2025])
    print(f"gate>={gate}: n={len(b)} {hit:.1f}% [{per}]")
    if hit<52.4: ok=False
h25=H[(H.season==2025)&(H.e.abs()>=3)].win.mean()
print(f"2025 @gate3: {100*h25:.1f}%")
print("VERDICT:", "CONFIRMED" if ok and h25>=0.52 else "FAILED — no 1H spread product")
