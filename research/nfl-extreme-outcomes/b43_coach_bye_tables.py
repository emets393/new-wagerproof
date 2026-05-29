"""
Build two reference tables for Supabase:
 1) nfl_coach_bye_ats  — every CURRENT (active-2025) head coach's career ATS cover% pre-bye and post-bye (1999-2025).
 2) nfl_coach_bye_matchups — historical games where BOTH teams were in a bye-spot (pre/post), with each coach's
    spot ATS%, the result, and the spot-% gap (mismatch spots the user wants to target).
Emits CREATE+INSERT SQL to out/sql/ for the Supabase MCP to apply. n included so sample size travels with the data.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); SQL=os.path.join(os.path.dirname(os.path.abspath(__file__)),"out","sql"); os.makedirs(SQL,exist_ok=True); L=print
g=pd.read_parquet(os.path.join(DATA,"nflverse_games.parquet"))
g=g[(g.game_type=="REG")&(g.season.between(1999,2025))].dropna(subset=["home_score","away_score","spread_line"]).copy()
g["gameday"]=pd.to_datetime(g.gameday,errors="coerce")
# team-game long w/ spot + cover
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
byes=t.groupby(["season","team"]).week.apply(lambda s: bye_week(s.tolist())).rename("bye").reset_index()
t=t.merge(byes,on=["season","team"],how="left")
t["spot"]=np.where(t.week==t.bye-1,"pre",np.where(t.week==t.bye+1,"post",None))

# ---- (1) coach pre/post-bye ATS ----
def cstats(spot):
    s=t[(t.spot==spot)].dropna(subset=["cover"])
    a=s.groupby("coach").cover.agg(gms="size",cvr="sum").reset_index()
    a[f"{spot}_pct"]=(a["cvr"]/a["gms"]*100).round(1)
    return a.rename(columns={"gms":f"{spot}_n","cvr":f"{spot}_cov"})
pre=cstats("pre"); post=cstats("post")
span=t.groupby("coach").season.agg(first_season="min",last_season="max").reset_index()
cb=span.merge(pre,on="coach",how="left").merge(post,on="coach",how="left").fillna({"pre_n":0,"pre_cov":0,"post_n":0,"post_cov":0})
current=set(t[t.season==2025].coach.unique())
cb["active_2025"]=cb.coach.isin(current)
cur=cb[cb.active_2025].copy()
for c in ["pre_n","pre_cov","post_n","post_cov","first_season","last_season"]: cur[c]=cur[c].astype(int)
cur.to_parquet(os.path.join(DATA,"coach_bye_ats.parquet"),index=False)
L(f"[coach table] current (active-2025) coaches: {len(cur)}")
L(cur.sort_values("post_pct",ascending=False)[["coach","pre_n","pre_pct","post_n","post_pct"]].head(12).to_string(index=False))

# ---- (2) bye-spot collision matchups ----
look=t[["season","week","team","spot","coach"]].dropna(subset=["spot"])
pct={(r.coach,"pre"):r.pre_pct for _,r in cb.iterrows() if pd.notna(r.pre_pct)}
pct.update({(r.coach,"post"):r.post_pct for _,r in cb.iterrows() if pd.notna(r.post_pct)})
nlk={(r.coach,"pre"):int(r.pre_n) for _,r in cb.iterrows() if pd.notna(r.pre_pct)}
nlk.update({(r.coach,"post"):int(r.post_n) for _,r in cb.iterrows() if pd.notna(r.post_pct)})
gm=g.copy(); gm["home_margin"]=gm.home_score-gm.away_score; gm["home_cover"]=np.where(gm.home_margin>gm.spread_line,1,np.where(gm.home_margin<gm.spread_line,0,np.nan))
hs=look.rename(columns={"team":"home_team","spot":"home_spot","coach":"home_coach"})[["season","week","home_team","home_spot"]]
as_=look.rename(columns={"team":"away_team","spot":"away_spot","coach":"away_coach"})[["season","week","away_team","away_spot"]]
gm=gm.merge(hs,on=["season","week","home_team"],how="left").merge(as_,on=["season","week","away_team"],how="left")
col=gm.dropna(subset=["home_spot","away_spot","home_cover"]).copy()   # BOTH teams in a bye-spot
col["home_spot_pct"]=[pct.get((c,s),np.nan) for c,s in zip(col.home_coach,col.home_spot)]
col["away_spot_pct"]=[pct.get((c,s),np.nan) for c,s in zip(col.away_coach,col.away_spot)]
col["home_spot_n"]=[nlk.get((c,s),0) for c,s in zip(col.home_coach,col.home_spot)]
col["away_spot_n"]=[nlk.get((c,s),0) for c,s in zip(col.away_coach,col.away_spot)]
col=col.dropna(subset=["home_spot_pct","away_spot_pct"])
col["gap"]=(col.home_spot_pct-col.away_spot_pct).abs()
col["edge_team"]=np.where(col.home_spot_pct>=col.away_spot_pct,col.home_team,col.away_team)
col["edge_is_home"]=(col.home_spot_pct>=col.away_spot_pct).astype(int)
col["edge_covered"]=np.where(col.edge_is_home==1,col.home_cover,1-col.home_cover)
out=col[["season","week","gameday","away_team","away_coach","away_spot","away_spot_pct","away_spot_n","home_team","home_coach","home_spot","home_spot_pct","home_spot_n","spread_line","home_margin","home_cover","gap","edge_team","edge_is_home","edge_covered"]].rename(columns={"gameday":"game_date"})
out.to_parquet(os.path.join(DATA,"coach_bye_matchups.parquet"),index=False)
L(f"\n[matchups] bye-spot collision games (both teams pre/post-bye): {len(out)}")
mm=out[out.gap>=15].dropna(subset=["edge_covered"])
L(f"  ** IN-SAMPLE/CIRCULAR (coach% includes these games): gap>=15 edge covered {mm.edge_covered.mean()*100:.1f}% (n={len(mm)})")
mmn=out[(out.gap>=15)&(out.home_spot_n>=8)&(out.away_spot_n>=8)].dropna(subset=["edge_covered"])
L(f"  cleaner (both coaches n>=8, still in-sample): gap>=15 edge covered {mmn.edge_covered.mean()*100:.1f}% (n={len(mmn)})")
L("  recent mismatch examples (gap>=20):")
ex=out[out.gap>=20].sort_values("season",ascending=False).head(10)
for _,r in ex.iterrows():
    L(f"    {int(r.season)} wk{int(r.week)}: {r.away_coach}({r.away_spot} {r.away_spot_pct:.0f}%) @ {r.home_coach}({r.home_spot} {r.home_spot_pct:.0f}%) -> edge={r.edge_team} {'COVERED' if r.edge_covered==1 else 'no'}")

# ---- emit SQL ----
def esc(v): return "NULL" if pd.isna(v) else ("'"+str(v).replace("'","''")+"'" if isinstance(v,str) else (str(int(v)) if isinstance(v,(bool,np.bool_)) else str(v)))
def insert_sql(df, tbl, cols):
    vals=",\n".join("("+",".join(esc(r[c]) for c in cols)+")" for _,r in df.iterrows())
    return f"INSERT INTO public.{tbl} ({','.join(cols)}) VALUES\n{vals};"
ccols=["coach","first_season","last_season","pre_n","pre_pct","post_n","post_pct"]
open(os.path.join(SQL,"coach_bye_ats.sql"),"w").write(
 "CREATE TABLE IF NOT EXISTS public.nfl_coach_bye_ats (coach text PRIMARY KEY, first_season int, last_season int, pre_n int, pre_pct numeric, post_n int, post_pct numeric);\n"
 "ALTER TABLE public.nfl_coach_bye_ats ENABLE ROW LEVEL SECURITY;\n"
 "DROP POLICY IF EXISTS read_all ON public.nfl_coach_bye_ats; CREATE POLICY read_all ON public.nfl_coach_bye_ats FOR SELECT USING (true);\n"
 "TRUNCATE public.nfl_coach_bye_ats;\n"+insert_sql(cur[ccols].fillna(0),"nfl_coach_bye_ats",ccols))
mcols=["season","week","game_date","away_team","away_coach","away_spot","away_spot_pct","away_spot_n","home_team","home_coach","home_spot","home_spot_pct","home_spot_n","spread_line","home_margin","home_cover","gap","edge_team","edge_covered"]
out2=out[mcols].copy(); out2["game_date"]=out2.game_date.dt.strftime("%Y-%m-%d")
open(os.path.join(SQL,"coach_bye_matchups.sql"),"w").write(
 "CREATE TABLE IF NOT EXISTS public.nfl_coach_bye_matchups (id serial PRIMARY KEY, season int, week int, game_date date, away_team text, away_coach text, away_spot text, away_spot_pct numeric, away_spot_n int, home_team text, home_coach text, home_spot text, home_spot_pct numeric, home_spot_n int, spread_line numeric, home_margin int, home_cover int, gap numeric, edge_team text, edge_covered int);\n"
 "ALTER TABLE public.nfl_coach_bye_matchups ENABLE ROW LEVEL SECURITY;\n"
 "DROP POLICY IF EXISTS read_all ON public.nfl_coach_bye_matchups; CREATE POLICY read_all ON public.nfl_coach_bye_matchups FOR SELECT USING (true);\n"
 "TRUNCATE public.nfl_coach_bye_matchups;\n"+insert_sql(out2,"nfl_coach_bye_matchups",mcols))
L(f"\n[sql] wrote out/sql/coach_bye_ats.sql ({len(cur)} rows) + coach_bye_matchups.sql ({len(out2)} rows)")
