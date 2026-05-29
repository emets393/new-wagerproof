"""
WALK-FORWARD coach pre/post-bye edge. The b43 matchup table scored games with each coach's FULL-career spot%
(circular — includes the game itself + future). Here: for each bye-spot game, each coach's spot cover% uses
ONLY their PRIOR games in that spot (chronological, shift+expanding). Then the 'edge' (which coach had the
better track record GOING IN) is out-of-sample. Report edge-covered% at min-prior-n thresholds + per-era,
and regenerate the Supabase matchups table with walk-forward columns.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); SQL=os.path.join(os.path.dirname(os.path.abspath(__file__)),"out","sql"); L=print
g=pd.read_parquet(os.path.join(DATA,"nflverse_games.parquet"))
g=g[(g.game_type=="REG")&(g.season.between(1999,2025))].dropna(subset=["home_score","away_score","spread_line"]).copy()
g["gameday"]=pd.to_datetime(g.gameday,errors="coerce")
rows=[]
for _,r in g.iterrows():
    rows.append((r.season,r.week,r.gameday,r.home_team,r.home_coach,r.home_score-r.away_score,r.spread_line,1))
    rows.append((r.season,r.week,r.gameday,r.away_team,r.away_coach,r.away_score-r.home_score,-r.spread_line,0))
t=pd.DataFrame(rows,columns=["season","week","gameday","team","coach","margin","line","is_home"])
t["cover"]=np.where(t.margin>t.line,1.0,np.where(t.margin<t.line,0.0,np.nan))
def bye_week(wk):
    wk=set(wk)
    for w in range(min(wk),max(wk)+1):
        if w not in wk: return w
    return None
byes=t.groupby(["season","team"]).week.apply(lambda s:bye_week(s.tolist())).rename("bye").reset_index()
t=t.merge(byes,on=["season","team"],how="left")
t["spot"]=np.where(t.week==t.bye-1,"pre",np.where(t.week==t.bye+1,"post",None))
# WALK-FORWARD prior cover% per (coach,spot), chronological, EXCLUDING the current game
sg=t[t.spot.notna()].dropna(subset=["cover"]).sort_values("gameday").copy()
gb=sg.groupby(["coach","spot"]).cover
sg["prior_pct"]=gb.transform(lambda s:s.shift().expanding().mean())*100
sg["prior_n"]=gb.transform(lambda s:s.shift().expanding().count())
L(f"[build] bye-spot team-games {len(sg)} | with >=1 prior in-spot game {int(sg.prior_n.fillna(0).ge(1).sum())}")
# collisions: join each REAL game's home & away team to its walk-forward spot priors
g["home_margin"]=g.home_score-g.away_score
g["home_cover"]=np.where(g.home_margin>g.spread_line,1.0,np.where(g.home_margin<g.spread_line,0.0,np.nan))
hsp=sg[["season","week","team","spot","prior_pct","prior_n"]].rename(columns={"team":"home_team","spot":"home_spot","prior_pct":"home_prior_pct","prior_n":"home_prior_n"})
asp=sg[["season","week","team","spot","prior_pct","prior_n"]].rename(columns={"team":"away_team","spot":"away_spot","prior_pct":"away_prior_pct","prior_n":"away_prior_n"})
m=g.merge(hsp,on=["season","week","home_team"],how="inner").merge(asp,on=["season","week","away_team"],how="inner")
m["home_line"]=m.spread_line
m=m[["season","week","gameday","home_team","home_coach","home_spot","home_prior_pct","home_prior_n","away_team","away_coach","away_spot","away_prior_pct","away_prior_n","home_line","home_margin","home_cover"]]
L(f"[build] bye-spot COLLISION games (real matchups): {len(m)}")

def wf_edge(df):
    d=df.dropna(subset=["home_prior_pct","away_prior_pct","home_cover"]).copy()
    d["edge_home"]=d.home_prior_pct>=d.away_prior_pct
    d["edge_covered"]=np.where(d.edge_home,d.home_cover,1-d.home_cover)
    return d
L("\n"+"="*78); L("WALK-FORWARD: bet the coach with the better PRIOR bye-spot record (out-of-sample)"); L("="*78)
for mn in [1,3,5,8]:
    d=wf_edge(m); d=d[(d.home_prior_n>=mn)&(d.away_prior_n>=mn)]
    d=d[d.home_prior_pct!=d.away_prior_pct]  # drop ties (no edge)
    n=len(d); k=int(d.edge_covered.sum()); lo,hi=wilson_ci(k,n) if n else (0,0)
    L(f"  both coaches prior_n>={mn}: edge covered {(k/n*100 if n else 0):.1f}%  n={n}  CI[{lo*100:.0f},{hi*100:.0f}]")
# mismatch (prior gap large) + per-era at min_n=3
d=wf_edge(m); d=d[(d.home_prior_n>=3)&(d.away_prior_n>=3)&(d.home_prior_pct!=d.away_prior_pct)]; d["gap"]=(d.home_prior_pct-d.away_prior_pct).abs()
big=d[d.gap>=20]; k=int(big.edge_covered.sum()); n=len(big); lo,hi=wilson_ci(k,n) if n else (0,0)
L(f"  prior-gap>=20 (clear mismatch, n>=3): edge covered {(k/n*100 if n else 0):.1f}%  n={n}  CI[{lo*100:.0f},{hi*100:.0f}]")
L("  per-era (prior_n>=3, any gap):")
for lo_y,hi_y in [(1999,2012),(2013,2019),(2020,2025)]:
    e=d[(d.season>=lo_y)&(d.season<=hi_y)]; k=int(e.edge_covered.sum()); n=len(e)
    L(f"    {lo_y}-{hi_y}: {(k/n*100 if n else 0):.1f}% (n={n})")

# regenerate Supabase matchups SQL with walk-forward columns
def esc(v): return "NULL" if pd.isna(v) else ("'"+str(v).replace("'","''")+"'" if isinstance(v,str) else str(round(v,1) if isinstance(v,float) else v))
o=wf_edge(m).copy(); o["edge_team"]=np.where(o.edge_home,o.home_team,o.away_team); o["game_date"]=o.gameday.dt.strftime("%Y-%m-%d")
o["edge_covered"]=o.edge_covered.astype(int); o["valid_wf"]=((o.home_prior_n>=3)&(o.away_prior_n>=3)&(o.home_prior_pct!=o.away_prior_pct)).astype(int)
mcols=["season","week","game_date","away_team","away_coach","away_spot","away_prior_pct","away_prior_n","home_team","home_coach","home_spot","home_prior_pct","home_prior_n","home_line","home_cover","edge_team","edge_covered","valid_wf"]
o=o.dropna(subset=["home_cover"])
vals=",\n".join("("+",".join(esc(r[c]) for c in mcols)+")" for _,r in o[mcols].iterrows())
ddl=("DROP TABLE IF EXISTS public.nfl_coach_bye_matchups;\n"
 "CREATE TABLE public.nfl_coach_bye_matchups (id serial PRIMARY KEY, season int, week int, game_date date, away_team text, away_coach text, away_spot text, away_prior_pct numeric, away_prior_n int, home_team text, home_coach text, home_spot text, home_prior_pct numeric, home_prior_n int, home_line numeric, home_cover int, edge_team text, edge_covered int, valid_wf int);\n"
 "ALTER TABLE public.nfl_coach_bye_matchups ENABLE ROW LEVEL SECURITY;\n"
 "CREATE POLICY read_all ON public.nfl_coach_bye_matchups FOR SELECT USING (true);\n"
 f"INSERT INTO public.nfl_coach_bye_matchups ({','.join(mcols)}) VALUES\n{vals};")
open(os.path.join(SQL,"coach_bye_matchups_wf.sql"),"w").write(ddl)
L(f"\n[sql] wrote out/sql/coach_bye_matchups_wf.sql ({len(o)} rows, walk-forward priors; valid_wf flags both prior_n>=3 & non-tie)")
