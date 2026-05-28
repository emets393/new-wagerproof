"""
Compound conditions on the key-receiver-out OVER: does it strengthen/weaken/flip with environment?
- indoor vs outdoor (is it weather-confounded?), wind (does the under-signal offset it?),
  total level, pace, primetime, fav/dog. Disciplined: report n + per-season; flag small-n.
"""
import os, sys
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
inj = pd.read_parquet(os.path.join(DATA, "injuries_raw.parquet"))
rec = pd.read_parquet(os.path.join(DATA, "ngs_receiving.parquet"))
g = pd.read_parquet(os.path.join(DATA, "games_enriched.parquet"))
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))

def carry(df, col, out):
    df = df.sort_values(["player_id","season","week"]).copy()
    df["_c"]=df.groupby(["player_id","season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season","player_id"]].drop_duplicates()
    grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season","player_id","week","_c"]],on=["season","player_id","week"],how="left").sort_values(["season","player_id","week"])
    grid[out]=grid.groupby(["season","player_id"])["_c"].ffill(); return grid[["season","week","player_id",out]]
air=carry(rec,"percent_share_of_intended_air_yards","airshare")
miss=inj[inj.report_status.isin(["Out","Doubtful"])].merge(air,on=["season","week","player_id"],how="left")
miss["kr"]=(miss.position.isin(["WR","TE","RB","FB"])&(miss.airshare>=35)).astype(int)
ti=miss.groupby(["season","week","team"]).kr.max().reset_index()
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}; ti["ab"]=ti.team.replace(nv2our)
m=m.merge(ti.rename(columns={"ab":"home_ab","kr":"h_kr"})[["season","week","home_ab","h_kr"]],on=["season","week","home_ab"],how="left")
m=m.merge(ti.rename(columns={"ab":"away_ab","kr":"a_kr"})[["season","week","away_ab","a_kr"]],on=["season","week","away_ab"],how="left")
m["kr_game"]=((m.h_kr==1)|(m.a_kr==1)).fillna(False).astype(int)
m["over"]=np.where(m.total_diff>0,1.0,np.where(m.total_diff<0,0.0,np.nan))
m["is_outdoor"]=(~m.dome_closed.astype("boolean").fillna(False)).astype(int)
m["pace_sum"]=m.home_off_plays_per_game_s2d+m.away_off_plays_per_game_s2d
K=m[(m.kr_game==1)].dropna(subset=["over"]); L(f"key-receiver-out games (wk any): n={len(K)}")

def cell(label, sub):
    n=len(sub);
    if n<12: L(f"  {label:34s} n={n} (small)"); return
    k=int(sub.over.sum()); lo,hi=wilson_ci(k,n)
    parts=" ".join(f"{int(s)}:{sub[sub.season==s].over.mean()*100:.0f}%(n{len(sub[sub.season==s])})" for s in sorted(sub.season.unique()) if len(sub[sub.season==s])>=4)
    L(f"  {label:34s} n={n:3d} OVER={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  {parts}")

L("\n[A] key-rec-out OVER by ENVIRONMENT (is it weather-confounded?):")
cell("ALL key-rec-out", K)
cell("  indoor (dome/closed)", K[K.is_outdoor==0])
cell("  outdoor", K[K.is_outdoor==1])
L("\n[B] does WIND (under-signal) offset the injury OVER?")
cell("  outdoor, calm (wind<10)", K[(K.is_outdoor==1)&(K.wind_mph<10)])
cell("  outdoor, breezy (10-15)", K[(K.is_outdoor==1)&(K.wind_mph>=10)&(K.wind_mph<15)])
cell("  outdoor, windy (>=15)", K[(K.is_outdoor==1)&(K.wind_mph>=15)])
L("\n[C] by TOTAL level:")
cell("  low total (<=43)", K[K.ou_vegas_line<=43])
cell("  mid total (43.5-48)", K[(K.ou_vegas_line>43)&(K.ou_vegas_line<=48)])
cell("  high total (>=48.5)", K[K.ou_vegas_line>=48.5])
L("\n[D] by PACE / primetime / week:")
cell("  fast pace (top half)", K[K.pace_sum>=K.pace_sum.median()])
cell("  slow pace (bot half)", K[K.pace_sum<K.pace_sum.median()])
cell("  primetime", K[K.primetime==1])
cell("  non-primetime", K[K.primetime==0])
cell("  week<=9", K[K.week<=9])
cell("  week>=10", K[K.week>=10])
