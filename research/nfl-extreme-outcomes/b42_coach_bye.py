"""
COACH-specific pre-bye / post-bye ATS (archive the cross-thread finding here).
Build team-game ATS cover (vs close spread_line) + each team-season's bye week from the schedule; flag the
game BEFORE the bye (pre-bye) and AFTER (post-bye). Rank head coaches by pre-bye and post-bye cover%, with n,
CIs, and a permutation-null check (scanning ~50 coaches surfaces chance extremes). 2018-2025, REG only.
spread_line convention: positive = home favored by that many; team covers if team_margin > team_line.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
g=pd.read_parquet(os.path.join(DATA,"nflverse_games.parquet"))
g=g[(g.game_type=="REG")&(g.season.between(1999,2025))].dropna(subset=["home_score","away_score","spread_line"]).copy()
# team-game long
rows=[]
for _,r in g.iterrows():
    rows.append((r.season,r.week,r.home_team,r.home_coach,r.home_score-r.away_score, r.spread_line))
    rows.append((r.season,r.week,r.away_team,r.away_coach,r.away_score-r.home_score,-r.spread_line))
t=pd.DataFrame(rows,columns=["season","week","team","coach","margin","line"])
t["cover"]=np.where(t.margin>t.line,1.0,np.where(t.margin<t.line,0.0,np.nan))   # push=NaN
# bye week per team-season = the missing week between first & last game
def bye_week(wk):
    wk=set(wk);
    for w in range(min(wk),max(wk)+1):
        if w not in wk: return w
    return None
byes=t.groupby(["season","team"]).week.apply(lambda s: bye_week(s.tolist())).rename("bye").reset_index()
t=t.merge(byes,on=["season","team"],how="left")
t["pre_bye"]=(t.week==t.bye-1).astype(int); t["post_bye"]=(t.week==t.bye+1).astype(int)
L(f"[build] team-games {len(t)} | teams w/ detected bye {t.bye.notna().mean()*100:.0f}% | pre-bye games {int(t.pre_bye.sum())} | post-bye {int(t.post_bye.sum())}")
L(f"[sanity] overall ATS cover {t.cover.mean()*100:.1f}% | pre-bye (all) {t[t.pre_bye==1].cover.mean()*100:.1f}% | post-bye (all) {t[t.post_bye==1].cover.mean()*100:.1f}%")

def rank(flag,label,nmin=6):
    sub=t[t[flag]==1].dropna(subset=["cover"])
    c=sub.groupby("coach").cover.agg(["mean","size"]).reset_index().rename(columns={"mean":"cvr","size":"ng"})
    c=c[c["ng"]>=nmin].sort_values("cvr",ascending=False)
    L(f"\n{'='*72}\n{label} ATS by coach (n>={nmin}); baseline {sub.cover.mean()*100:.1f}%\n{'='*72}")
    L(f"  {'coach':22s} {'cover%':>6s} {'n':>3s} {'CI':>10s}")
    for _,r in pd.concat([c.head(10),c.tail(5)]).iterrows():
        lo,hi=wilson_ci(int(r["cvr"]*r["ng"]),int(r["ng"])); L(f"  {r['coach']:22s} {r['cvr']*100:5.1f}% {int(r['ng']):3d}  [{lo*100:.0f},{hi*100:.0f}]")
    # permutation null: shuffle cover among pre/post-bye games, recount coaches >=65% (n>=nmin)
    obs=int((c["cvr"]>=0.65).sum()); rng=np.random.default_rng(0); nc=[]
    for _ in range(2000):
        s=sub.copy(); s["cover"]=rng.permutation(s.cover.values)
        cc=s.groupby("coach").cover.agg(["mean","size"]); nc.append(int(((cc["mean"]>=0.65)&(cc["size"]>=nmin)).sum()))
    nc=np.array(nc); L(f"  coaches >=65%: observed={obs} vs null mean={nc.mean():.1f} (95th={np.quantile(nc,.95):.0f}) -> {'ENRICHED' if obs>np.quantile(nc,.95) else 'within chance'}")
rank("pre_bye","PRE-BYE",nmin=10)
rank("post_bye","POST-BYE",nmin=10)
