"""1H SPREAD/ML grid: feature families x anchoring x recalibration. Families: P15 (pruned), NETS, NOSTR
(strength features REMOVED - force non-elo signal), ANCH (line as feature -> predict line error), ANCH+NETS.
Recal: isotonic edge->cover prob on train seasons, gate on recal prob>=0.55. Grade @ posted 1H close.
DISCIPLINE: grid = exploration; any winner needs pre-registered confirm before wiring."""
import numpy as np, pandas as pd, exp_shared as E
from sklearn.isotonic import IsotonicRegression
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
P15=['elo_diff','talent_diff','net_rating_diff','home_talent','home_adj_rush_explosiveness_allowed','away_travel_miles','away_last_margin','home_off_havoc_db','home_win_streak','home_adj_epa','away_adj_epa','home_adj_explosiveness','away_adj_explosiveness','expected_plays','home_poss_secs_pg']
FAMS={"P15":P15,"NETS":nets+["elo_diff","spread_close"],"NOSTR":[f for f in FEATS if f not in STR]+nets,
      "ANCH":FEATS+["hs","spread_close"],"ANCH+NETS":FEATS+nets+["hs","spread_close"]}
def rep(lab,b,w):
    if len(b)<25: print(f"  {lab:<34} n={len(b)} thin"); return
    n=len(b);ww=int(w.sum());roi=(ww*.909-(n-ww))/n*100
    per="/".join(f"{100*w[b.season==s].mean():.0f}" for s in [2023,2024,2025] if (b.season==s).sum())
    print(f"  {lab:<34} n={n:<4} {100*ww/n:5.1f}% roi{roi:+6.1f} [{per}]")
for fam,fe in FAMS.items():
    parts=[]
    for S in [2023,2024,2025]:
        trn=gm[(gm.season<S)&gm.h1m.notna()].copy()
        # hs unavailable pre-2023 -> for ANCH train target on half full spread proxy
        if "hs" in fe: trn["hs"]=trn["hs"].fillna(trn.spread_close/2)
        te=gm[gm.season==S].copy()
        if "hs" in fe: te["hs"]=te["hs"].fillna(te.spread_close/2)
        te["pm"]=E.gbm().fit(trn[fe],trn.h1m).predict(te[fe]); parts.append(te)
    H=pd.concat(parts); H=H[H.h1m.notna()&H.hs.notna()].copy()
    H["e"]=H.pm+H.hs; H=H[(H.h1m+H.hs)!=0]
    hc=(H.h1m+H.hs)>0
    H["win"]=np.where(H.e>0,hc,~hc)
    b=H[H.e.abs()>=3]; rep(f"{fam} |edge|>=3",b,b.win)
    # recalibration: isotonic on 2023 (train-adjacent) edge->win, gate recal>=0.55 on 2024-25
    cal=H[H.season==2023]
    if len(cal)>200:
        iso=IsotonicRegression(out_of_bounds="clip").fit(cal.e.abs(),cal.win)
        t2=H[H.season>=2024].copy(); t2["rp"]=iso.predict(t2.e.abs())
        b=t2[t2.rp>=0.55]; rep(f"{fam} RECAL p>=.55 (24-25)",b,b.win)
