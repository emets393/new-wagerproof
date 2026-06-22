"""
FULL DERIVATIVE-MARKET TEST BATTERY (event-odds archive 2023-25, close snap):
A. TT soft-book gap: per book, when its main TT deviates >=1 from consensus-of-others, fade its lean AT ITS line.
B. 1H MODELS: targets from quarter line scores (Q1+Q2), walk-forward GBM (FEATS), graded vs posted 1H close.
C. 1H structural: blanket under; fade high 1H totals.
D. TT movement: T-72h -> T-2h follow/fade.
Per-season [23/24/25] is the consistency filter (no extra holdout exists for these markets).
"""
import numpy as np
import pandas as pd
import exp_shared as E

gm, FEATS = E.load()
cfbd = sorted(set(gm.homeTeam) | set(gm.awayTeam))
AL = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
      "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
      "Southern Miss Golden Eagles": "Southern Miss"}
def tdb(o):
    if pd.isna(o): return None
    if o in AL: return AL[o]
    c = [x for x in cfbd if o.startswith(x + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None

EV = pd.concat([pd.read_parquet(f"data/event_odds/events_{y}.parquet") for y in [2023, 2024, 2025]])
def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}({(b.season==s).sum()})" for s in [2023,2024,2025] if (b.season==s).sum())
def rep(lab, b, w):
    n=len(b); ww=int(w.sum()); lo,hi=E.wilson(ww,n); roi=(ww*0.909-(n-ww))/n*100 if n else 0
    print(f"  {lab:<46} n={n:<4} hit {100*ww/n if n else 0:5.1f}% CI[{lo:.0f},{hi:.0f}] roi{roi:+6.1f} [{per(b,w)}]")

# ---------- A. TT soft-book ----------
print("="*78); print("A. TT SOFT-BOOK: fade a book's deviant main TT at its own line")
tt = EV[(EV.market=="team_totals")&(EV.snap_tag=="h2")&(EV.name=="Over")].copy()
tt["team"]=tt.description.map(tdb); tt=tt.dropna(subset=["team","point"])
tt["vig"]=(tt.price+110).abs()
tt=tt.sort_values("vig").drop_duplicates(["season","game_id","team","book"],keep="first")
pts_map={}
for _,r in gm[gm.season>=2023].iterrows():
    pts_map[(r.season,r.game_id,r.homeTeam)]=r.homePoints; pts_map[(r.season,r.game_id,r.awayTeam)]=r.awayPoints
tt["pts"]=[pts_map.get((s,g,t)) for s,g,t in zip(tt.season,tt.game_id,tt.team)]
tt=tt.dropna(subset=["pts"])
g_=tt.groupby(["season","game_id","team"]); tt["csum"]=g_.point.transform("sum"); tt["cn"]=g_.point.transform("count")
tt["cons_others"]=(tt.csum-tt.point)/(tt.cn-1); tt=tt[tt.cn>=3]
tt["dev"]=tt.point-tt.cons_others
for bk in tt.book.unique():
    hi_=tt[(tt.book==bk)&(tt.dev>=1)&(tt.pts!=tt.point)]   # book posts HIGH -> bet UNDER at its line
    lo_=tt[(tt.book==bk)&(tt.dev<=-1)&(tt.pts!=tt.point)]  # book posts LOW -> bet OVER at its line
    both=pd.concat([hi_,lo_]); w=pd.concat([hi_.pts<hi_.point, lo_.pts>lo_.point])
    if len(both)>=30: rep(f"{bk}: fade its deviant TT (>=1 off others)", both, w)

# ---------- B. 1H models ----------
print("\n"+"="*78); print("B. 1H MODELS (targets = Q1+Q2 from line scores, walk-forward, graded @ posted close)")
qs=[]
for y in [2016,2017,2018,2019,2021,2022,2023,2024,2025]:
    g2=pd.read_parquet(f"data/cfbd/games_{y}.parquet")
    g2=g2[g2.homeLineScores.notna()&g2.awayLineScores.notna()].copy()
    g2["h1_home"]=g2.homeLineScores.apply(lambda a: sum(a[:2]) if a is not None and len(a)>=2 else np.nan)
    g2["h1_away"]=g2.awayLineScores.apply(lambda a: sum(a[:2]) if a is not None and len(a)>=2 else np.nan)
    qs.append(g2[["id","h1_home","h1_away"]].rename(columns={"id":"game_id"}))
Q=pd.concat(qs)
gm2=gm.merge(Q,on="game_id",how="left")
gm2["h1_total"]=gm2.h1_home+gm2.h1_away; gm2["h1_margin"]=gm2.h1_home-gm2.h1_away
# posted 1H close consensus
def posted(market, name_filter=None):
    p=EV[(EV.market==market)&(EV.snap_tag=="h2")].copy()
    if name_filter=="over": p=p[p.name=="Over"]
    if name_filter=="home": p["nm"]=p.name.map(tdb); p=p[p.nm==p.home]
    return p.groupby(["season","game_id"]).agg(line=("point","median"),
        best_hi=("point","max"), best_lo=("point","min")).reset_index()
t1=posted("totals_h1","over").rename(columns={"line":"h1t","best_hi":"h1t_hi","best_lo":"h1t_lo"})
s1=posted("spreads_h1","home").rename(columns={"line":"h1s","best_hi":"h1s_hi","best_lo":"h1s_lo"})
parts=[]
for S in [2023,2024,2025]:
    tr=gm2[(gm2.season<S)&gm2.h1_total.notna()]; te=gm2[gm2.season==S].copy()
    mt=E.gbm().fit(tr[FEATS],tr.h1_total); mm=E.gbm().fit(tr[FEATS],tr.h1_margin)
    te["p_h1t"]=mt.predict(te[FEATS]); te["p_h1m"]=mm.predict(te[FEATS]); parts.append(te)
H=pd.concat(parts).merge(t1,on=["season","game_id"],how="left").merge(s1,on=["season","game_id"],how="left")
H=H[H.h1_total.notna()]
print("1H TOTALS (model edge = pred - posted):")
for gate in [1.5,2,3]:
    b=H[(H.p_h1t-H.h1t).abs()>=gate].copy(); b=b[b.h1_total!=b.h1t]
    w=np.where(b.p_h1t>b.h1t, b.h1_total>b.h1t, b.h1_total<b.h1t); rep(f"|edge|>={gate} @consensus", b, pd.Series(w,index=b.index))
b=H[(H.p_h1t<=H.h1t_hi-2)].copy(); b=b[b.h1_total!=b.h1t_hi]
rep("UNDER shop: pred<=best_hi-2 @best", b, pd.Series((b.h1_total<b.h1t_hi).values,index=b.index))
b=H[(H.p_h1t>=H.h1t_lo+2)].copy(); b=b[b.h1_total!=b.h1t_lo]
rep("OVER shop: pred>=best_lo+2 @best", b, pd.Series((b.h1_total>b.h1t_lo).values,index=b.index))
print("1H SPREADS (model edge = pred_margin + posted_home_line):")
for gate in [2,3]:
    b=H[H.h1s.notna()].copy(); b["e"]=b.p_h1m+b.h1s; b=b[b.e.abs()>=gate]; b=b[(b.h1_margin+b.h1s)!=0]
    hc=(b.h1_margin+b.h1s)>0; w=np.where(b.e>0,hc,~hc); rep(f"|edge|>={gate} @consensus", b, pd.Series(w,index=b.index))
print("C. 1H structural:")
b=H[H.h1t.notna()&(H.h1_total!=H.h1t)]; rep("blanket 1H UNDER @consensus", b, pd.Series((b.h1_total<b.h1t).values,index=b.index))
b2=b[b.h1t>=31]; rep("1H total>=31 -> UNDER", b2, pd.Series((b2.h1_total<b2.h1t).values,index=b2.index))

# ---------- D. TT movement ----------
print("\n"+"="*78); print("D. TT MOVEMENT (T-72 -> close consensus): follow the move?")
m72=EV[(EV.market=="team_totals")&(EV.snap_tag=="h72")&(EV.name=="Over")].copy()
m72["team"]=m72.description.map(tdb); m72=m72.dropna(subset=["team","point"])
m72["vig"]=(m72.price+110).abs(); m72=m72.sort_values("vig").drop_duplicates(["season","game_id","team","book"],keep="first")
c72=m72.groupby(["season","game_id","team"]).point.median().rename("tt72").reset_index()
cC=tt.groupby(["season","game_id","team"]).agg(ttC=("point","median"),pts=("pts","first")).reset_index()
MV=cC.merge(c72,on=["season","game_id","team"]); MV["mv"]=MV.ttC-MV.tt72; MV=MV[MV.pts!=MV.ttC]
b=MV[MV.mv>=1.5]; rep("TT moved UP>=1.5 -> follow OVER @close", b, pd.Series((b.pts>b.ttC).values,index=b.index))
b=MV[MV.mv<=-1.5]; rep("TT moved DOWN>=1.5 -> follow UNDER @close", b, pd.Series((b.pts<b.ttC).values,index=b.index))
