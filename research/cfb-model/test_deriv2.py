"""
DERIVATIVES ROUND 2: (1) line movement windows on TT + 1H lines (72->24->2h snaps), follow AND fade;
(2) matchup conditions crossed with the flagship TT line-shop edges; (3) P5/G5 splits everywhere.
"""
import numpy as np
import pandas as pd
import exp_shared as E
import team_total_signals as TT
import form_signals

gm, FEATS = E.load()
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
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
    if len(b) < 25: print(f"  {lab:<48} n={len(b)} (thin)"); return
    n=len(b); ww=int(w.sum()); lo,hi=E.wilson(ww,n); roi=(ww*0.909-(n-ww))/n*100
    print(f"  {lab:<48} n={n:<4} hit {100*ww/n:5.1f}% CI[{lo:.0f},{hi:.0f}] roi{roi:+6.1f} [{per(b,w)}]")

# consensus per snap for TT (team level) and 1H totals/spreads (game level)
def snap_cons(market, tag, by_team=False, name=None, home_side=False):
    p = EV[(EV.market == market) & (EV.snap_tag == tag)].copy()
    if name: p = p[p.name == name]
    if home_side: p["nm"] = p.name.map(tdb); p = p[p.nm == p.home]
    if by_team:
        p["team"] = p.description.map(tdb); p = p.dropna(subset=["team", "point"])
        p["vig"] = (p.price + 110).abs()
        p = p.sort_values("vig").drop_duplicates(["season", "game_id", "team", "book"], keep="first")
        return p.groupby(["season", "game_id", "team"]).point.median().rename(f"{market[:3]}_{tag}").reset_index()
    return p.groupby(["season", "game_id"]).point.median().rename(f"{market[:4]}_{tag}").reset_index()

# ---------- 1. MOVEMENT WINDOWS ----------
print("=" * 78); print("1. MOVEMENT WINDOWS (72->24->2), follow & fade")
# TT (team level) w/ pts + conference of the TEAM
tt72 = snap_cons("team_totals", "h72", by_team=True, name="Over")
tt24 = snap_cons("team_totals", "h24", by_team=True, name="Over")
tt2 = snap_cons("team_totals", "h2", by_team=True, name="Over")
T = tt2.merge(tt24, on=["season","game_id","team"], how="left").merge(tt72, on=["season","game_id","team"], how="left")
pm, cm = {}, {}
for _, r in gm[gm.season >= 2023].iterrows():
    pm[(r.season,r.game_id,r.homeTeam)]=r.homePoints; pm[(r.season,r.game_id,r.awayTeam)]=r.awayPoints
    cm[(r.season,r.game_id,r.homeTeam)]=r.homeConference; cm[(r.season,r.game_id,r.awayTeam)]=r.awayConference
T["pts"]=[pm.get(k) for k in zip(T.season,T.game_id,T.team)]
T["p5"]=[cm.get(k) in P5 for k in zip(T.season,T.game_id,T.team)]
T=T.dropna(subset=["pts","tea_h2"]); T=T[T.pts!=T.tea_h2]
for wlab, a, bcol in [("early(72->24)","tea_h72","tea_h24"), ("late(24->2)","tea_h24","tea_h2"), ("full(72->2)","tea_h72","tea_h2")]:
    d=T.dropna(subset=[a,bcol]).copy(); d["mv"]=d[bcol]-d[a]; d=d[d.mv.abs()>=1]
    w=pd.Series(np.where(d.mv>0, d.pts>d.tea_h2, d.pts<d.tea_h2), index=d.index)
    rep(f"TT {wlab} |mv|>=1 FOLLOW @close", d, w)
    rep(f"TT {wlab} FADE", d, 1-w)
# 1H totals movement
h1t={t: snap_cons("totals_h1", t, name="Over") for t in ["h72","h24","h2"]}
G=h1t["h2"].merge(h1t["h24"],on=["season","game_id"],how="left").merge(h1t["h72"],on=["season","game_id"],how="left")
qs=[]
for y in [2023,2024,2025]:
    g2=pd.read_parquet(f"data/cfbd/games_{y}.parquet")
    g2["h1"]=g2.homeLineScores.apply(lambda x: sum(x[:2]) if x is not None and len(x)>=2 else np.nan)+ \
             g2.awayLineScores.apply(lambda x: sum(x[:2]) if x is not None and len(x)>=2 else np.nan)
    qs.append(g2[["id","h1"]].rename(columns={"id":"game_id"}))
G=G.merge(pd.concat(qs),on="game_id",how="left").merge(gm[["season","game_id","homeConference","awayConference"]],on=["season","game_id"])
G["bothp5"]=G.homeConference.isin(P5)&G.awayConference.isin(P5); G["bothg5"]=(~G.homeConference.isin(P5))&(~G.awayConference.isin(P5))
G=G.dropna(subset=["h1","tota_h2"]); G=G[G.h1!=G.tota_h2]
for wlab,a,bcol in [("late(24->2)","tota_h24","tota_h2"),("full(72->2)","tota_h72","tota_h2")]:
    d=G.dropna(subset=[a,bcol]).copy(); d["mv"]=d[bcol]-d[a]; d=d[d.mv.abs()>=0.5]
    w=pd.Series(np.where(d.mv>0,d.h1>d.tota_h2,d.h1<d.tota_h2),index=d.index)
    rep(f"1Htot {wlab} |mv|>=0.5 FOLLOW @close", d, w); rep(f"1Htot {wlab} FADE", d, 1-w)

# ---------- 2. FLAGSHIP TT EDGE x P5/G5 + MATCHUP CONDITIONS ----------
print("\n" + "=" * 78); print("2. TT LINE-SHOP EDGES x P5/G5 x matchup conditions")
rows=[]
for y in [2023,2024,2025]:
    t=TT.build(gm,y); t["pred_anch"]=t.implied+t.anch_edge; t["pred_fund"]=t.implied+t.fund_edge; rows.append(t)
M=pd.concat(rows)
ttbest = EV[(EV.market=="team_totals")&(EV.snap_tag=="h2")&(EV.name=="Over")].copy()
ttbest["team"]=ttbest.description.map(tdb); ttbest=ttbest.dropna(subset=["team","point"])
ttbest["vig"]=(ttbest.price+110).abs(); ttbest=ttbest.sort_values("vig").drop_duplicates(["season","game_id","team","book"],keep="first")
bb=ttbest.groupby(["season","game_id","team"]).agg(best_u=("point","max"),best_o=("point","min")).reset_index()
M=M.merge(bb,on=["season","game_id","team"],how="inner")
M["p5"]=[cm.get(k) in P5 for k in zip(M.season,M.game_id,M.team)]
fs=form_signals.build(gm)
M=M.merge(fs,on=["season","game_id","team"],how="left")
U=M[(M.pred_anch<=M.best_u-3)&M.pts.notna()].copy(); U=U[U.pts!=U.best_u]; U["w"]=U.pts<U.best_u
O=M[(M.pred_fund>=M.best_o+6)&M.pts.notna()].copy(); O=O[O.pts!=O.best_o]; O["w"]=O.pts>O.best_o
rep("TT UNDER shop — P5 teams", U[U.p5], U[U.p5].w); rep("TT UNDER shop — G5 teams", U[~U.p5], U[~U.p5].w)
rep("TT OVER shop — P5 teams", O[O.p5], O[O.p5].w); rep("TT OVER shop — G5 teams", O[~O.p5], O[~O.p5].w)
print("  matchup conditions on TT UNDER:")
rep("  + team over-hot (form over_rate>=.6)", U[U.over_rate>=.6], U[U.over_rate>=.6].w)
rep("  + TT line high (>=30.5)", U[U.best_u>=30.5], U[U.best_u>=30.5].w)
rep("  + TT line low (<24)", U[U.best_u<24], U[U.best_u<24].w)
print("  matchup conditions on TT OVER:")
rep("  + team over-cold (over_rate<=.4)", O[O.over_rate<=.4], O[O.over_rate<=.4].w)
rep("  + TT line low (<21)", O[O.best_o<21], O[O.best_o<21].w)
# 1H fade-high x P5/G5
print("\n  1H total>=31 UNDER split:")
b=G[(G.tota_h2>=31)]; rep("  both-P5", b[b.bothp5], pd.Series((b[b.bothp5].h1<b[b.bothp5].tota_h2).values,index=b[b.bothp5].index))
rep("  both-G5", b[b.bothg5], pd.Series((b[b.bothg5].h1<b[b.bothg5].tota_h2).values,index=b[b.bothg5].index))
