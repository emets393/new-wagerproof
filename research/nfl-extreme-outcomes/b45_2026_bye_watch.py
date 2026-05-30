"""
2026 pre-bye / post-bye WATCH LIST based on coach ATS records (through 2025).
Uses freshest nflverse games.csv (2026 schedule + current coaches, refreshed in cache).
Outputs: (1) new/limited-record 2026 coaches, (2) bye-COLLISION games to watch (both teams in a bye-spot),
(3) notable single-coach pre/post-bye spots. Coach %s are career 1999-2025 (the forward signal).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
g=pd.read_parquet(os.path.join(DATA,"nflverse_games.parquet")); g=g[g.game_type=="REG"].copy()
def teamgames(df,cover):
    h=df[["season","week","home_team","home_coach"]].rename(columns={"home_team":"team","home_coach":"coach"}); h["line"]=df.spread_line; h["margin"]=(df.home_score-df.away_score) if cover else np.nan
    a=df[["season","week","away_team","away_coach"]].rename(columns={"away_team":"team","away_coach":"coach"}); a["line"]=-df.spread_line; a["margin"]=(df.away_score-df.home_score) if cover else np.nan
    return pd.concat([h,a],ignore_index=True)
def add_spot(t):
    def bw(wk):
        wk=set(wk)
        for w in range(min(wk),max(wk)+1):
            if w not in wk: return w
        return None
    bye=t.groupby(["season","team"]).week.apply(lambda s:bw(s.tolist())).rename("bye").reset_index()
    t=t.merge(bye,on=["season","team"],how="left"); t["spot"]=np.where(t.week==t.bye-1,"pre",np.where(t.week==t.bye+1,"post",None)); return t
# coach career pre/post-bye % through 2025
pri=g[g.season.between(1999,2025)].dropna(subset=["home_score","away_score","spread_line"])
pt=add_spot(teamgames(pri,True)); pt["cover"]=np.where(pt.margin>pt.line,1.0,np.where(pt.margin<pt.line,0.0,np.nan))
ps=pt[pt.spot.notna()].dropna(subset=["cover"]); a=ps.groupby(["coach","spot"]).cover.agg(p="mean",c="size")
pct={i:(round(r.p*100,1),int(r.c)) for i,r in a.iterrows()}
def rec(coach,spot):
    v=pct.get((coach,spot)); return v if v else (None,0)
# 2026 schedule -> byes, spots, coaches
s26=add_spot(teamgames(g[g.season==2026],False))
byes26=s26[["team","bye"]].drop_duplicates().dropna()
coach26=g[g.season==2026][["home_team","home_coach"]].drop_duplicates().rename(columns={"home_team":"team","home_coach":"coach"})
coach26=pd.concat([coach26, g[g.season==2026][["away_team","away_coach"]].drop_duplicates().rename(columns={"away_team":"team","away_coach":"coach"})]).drop_duplicates("team")
tm=coach26.merge(byes26,on="team",how="left")
tm["pre_pct"],tm["pre_n"]=zip(*tm.coach.map(lambda c:rec(c,"pre")))
tm["post_pct"],tm["post_n"]=zip(*tm.coach.map(lambda c:rec(c,"post")))

L("="*80); L("(1) 2026 COACHES with LITTLE/NO bye record (treat their bye spots as unknown)"); L("="*80)
newc=tm[(tm.pre_n<5)&(tm.post_n<5)].sort_values("team")
for _,r in newc.iterrows(): L(f"  {r.team:4s} {r.coach:22s} pre n={int(r.pre_n)} post n={int(r.post_n)}")
L(f"  ({len(newc)} teams w/ thin bye record — new/recent HCs)")

# spot lookup per 2026 team-week
spotmap={(int(r.week),r.team):r.spot for _,r in s26.iterrows() if r.spot is not None}
g26=g[g.season==2026][["week","home_team","home_coach","away_team","away_coach"]].copy()
rows=[]
for _,r in g26.iterrows():
    hs=spotmap.get((int(r.week),r.home_team)); az=spotmap.get((int(r.week),r.away_team))
    if hs and az:
        hp=rec(r.home_coach,hs); ap=rec(r.away_coach,az)
        rows.append(dict(week=int(r.week),away=r.away_team,away_coach=r.away_coach,away_spot=az,away_pct=ap[0],away_n=ap[1],
                         home=r.home_team,home_coach=r.home_coach,home_spot=hs,home_pct=hp[0],home_n=hp[1]))
col=pd.DataFrame(rows)
L("\n"+"="*80); L("(2) 2026 BYE-COLLISION games (BOTH teams in a pre/post-bye spot)"); L("="*80)
def gap(r): return abs((r.home_pct or 50)-(r.away_pct or 50))
col["gap"]=col.apply(gap,axis=1); col=col.sort_values("gap",ascending=False)
L(f"  {len(col)} collision games. (* = both coaches established n>=5, the bye_collision rule's targets)")
for _,r in col.iterrows():
    star="*" if (r.away_n>=5 and r.home_n>=5 and r.gap>=15) else " "
    L(f" {star}W{r.week:<2d} {r.away} {r.away_coach.split()[-1]}({r.away_spot} {r.away_pct if r.away_pct is not None else '?'}%/n{r.away_n}) @ {r.home} {r.home_coach.split()[-1]}({r.home_spot} {r.home_pct if r.home_pct is not None else '?'}%/n{r.home_n})  gap={r.gap:.0f}")

L("\n"+"="*80); L("(3) NOTABLE single-coach pre/post-bye spots in 2026 (established n>=10, pct>=62 or <=40)"); L("="*80)
note=[]
for _,r in g26.iterrows():
    for team,coach,opp,site in [(r.home_team,r.home_coach,r.away_team,"vs"),(r.away_team,r.away_coach,r.home_team,"@")]:
        sp=spotmap.get((int(r.week),team))
        if not sp: continue
        p,n=rec(coach,sp)
        if n>=10 and (p>=62 or p<=40): note.append((int(r.week),team,coach,sp,p,n,site,opp))
for w,team,coach,sp,p,n,site,opp in sorted(set(note)):
    lean="BACK" if p>=62 else "FADE"
    L(f"  W{w:<2d} {team} ({coach.split()[-1]}) {sp}-bye {p}% n={n} -> {lean}  [{site} {opp}]")
