"""
PLAYER-SPECIFIC birthday analysis: does any individual player consistently beat their OWN season baseline on
their birthday — across receiving yards, targets, receptions, rush yards, total yards, anytime TD?
Show the actual players (esp. those with multiple birthday games), raw + relative, and an honest
multiple-comparisons check (how many 'birthday performers' would chance produce?).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
o=pd.read_parquet(os.path.join(DATA,"player_offense.parquet"))
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet"))[["gsis_id","birth_date","display_name"]]
g=pd.read_parquet(os.path.join(DATA,"nflverse_games.parquet"))
num=lambda c: pd.to_numeric(o.get(c),errors="coerce").fillna(0)
o["rec_yds"]=num("receiving_yards"); o["rush_yds"]=num("rushing_yards"); o["tgt"]=num("targets")
o["rec"]=num("receptions"); o["car"]=num("carries")
o["tot_yds"]=o.rec_yds+o.rush_yds; o["any_td"]=((num("rushing_tds")+num("receiving_tds"))>0).astype(int)
gg=g[["season","week","gameday","home_team","away_team"]]
gd=pd.concat([gg.rename(columns={"home_team":"team"})[["season","week","gameday","team"]],
              gg.rename(columns={"away_team":"team"})[["season","week","gameday","team"]]],ignore_index=True)
o=o.merge(gd,on=["season","week","team"],how="left").merge(px,left_on="player_id",right_on="gsis_id",how="left")
o["gameday"]=pd.to_datetime(o.gameday,errors="coerce"); o["bd"]=pd.to_datetime(o.birth_date,errors="coerce")
o=o.dropna(subset=["gameday","bd"])
o["is_bday"]=(o.gameday.dt.strftime("%m-%d")==o.bd.dt.strftime("%m-%d")).astype(int)
o["name"]=o.display_name.fillna(o.player_name)
STATS=["tot_yds","rec_yds","rush_yds","tgt","rec","car"]
# season baseline (ex-birthday) per player-season
nb=o[o.is_bday==0]
base=nb.groupby(["player_id","season"])[STATS+["any_td"]].mean().add_suffix("_base").reset_index()
b=o[o.is_bday==1].merge(base,on=["player_id","season"],how="left")
b=b.dropna(subset=["tot_yds_base"])  # need a same-season baseline to compare
L(f"[build] birthday games with a same-season baseline: {len(b)} across {b.player_id.nunique()} players\n")

# per-player record across their birthday games
b["beat_yds"]=(b.tot_yds>b.tot_yds_base).astype(int); b["beat_tgt"]=(b.tgt>b.tgt_base).astype(int)
agg=b.groupby(["player_id","name"]).agg(
    bdays=("is_bday","size"), bd_totyds=("tot_yds","mean"), base_totyds=("tot_yds_base","mean"),
    bd_tgt=("tgt","mean"), base_tgt=("tgt_base","mean"), bd_td=("any_td","sum"),
    beat_yds=("beat_yds","sum"), beat_tgt=("beat_tgt","sum")).reset_index()
agg["yds_ratio"]=agg.bd_totyds/agg.base_totyds.replace(0,np.nan)

L("="*92); L("PLAYERS WITH MULTIPLE BIRTHDAY GAMES (where a 'tendency' is even measurable), by yds-vs-baseline"); L("="*92)
multi=agg[agg.bdays>=2].sort_values("yds_ratio",ascending=False)
L(f"  {len(multi)} players have >=2 birthday games. Top & bottom by birthday total-yds / their season avg:")
L(f"  {'player':22s} {'#bd':>3s} {'bdYds':>6s} {'avgYds':>6s} {'ratio':>5s} {'beatYds':>7s} {'bdTDs':>5s}")
for _,r in pd.concat([multi.head(10),multi.tail(3)]).iterrows():
    L(f"  {r['name']:22s} {int(r.bdays):3d} {r.bd_totyds:6.1f} {r.base_totyds:6.1f} {r.yds_ratio:5.2f} {int(r.beat_yds)}/{int(r.bdays):<5d} {int(r.bd_td):3d}")

L("\n"+"="*92); L("TOP SINGLE BIRTHDAY PERFORMANCES (biggest games on a birthday, raw)"); L("="*92)
top=b.sort_values("tot_yds",ascending=False).head(12)
L(f"  {'player':22s} {'season':>6s} {'totYds':>6s} {'seasAvg':>7s} {'tgt':>3s} {'rec':>3s} {'TD':>2s}")
for _,r in top.iterrows():
    L(f"  {r['name']:22s} {int(r.season):6d} {r.tot_yds:6.0f} {r.tot_yds_base:7.1f} {int(r.tgt):3d} {int(r.rec):3d} {int(r.any_td):2d}")

L("\n"+"="*92); L("HONEST multiple-comparisons check"); L("="*92)
m3=agg[agg.bdays>=3]
perfect=m3[(m3.beat_yds==m3.bdays)]
L(f"  players with >=3 birthday games: {len(m3)}")
L(f"  ...who beat their season-avg YARDS in ALL of them: {len(perfect)}  -> {list(perfect.name)}")
exp_perfect=sum(0.5**int(n) for n in m3.bdays)   # chance expectation (P=0.5 beat-avg each game)
L(f"  expected by CHANCE (P=.5 each game): {exp_perfect:.1f}  -> {'more than chance' if len(perfect)>exp_perfect else 'in line with chance'}")
# aggregate beat-rate
L(f"  overall: birthday games beating season-avg yards = {b.beat_yds.mean()*100:.1f}% (chance=50%), targets={b.beat_tgt.mean()*100:.1f}%")
