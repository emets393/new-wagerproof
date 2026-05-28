"""
Parallel TOTALS model — same iterative discipline as the sides model.
Predict actual_total walk-forward; grade held-out 2024-25 O/U vs the OPENING total (open_total) + CLV.
Feature groups added cumulatively: env (pace/ppd/epa) -> +weather -> +proven flags (key-receiver-out OVER,
wind UNDER, dome, cold, primetime). Proven totals edges we already established: wind->UNDER, key-WR-out->OVER.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet")); rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy(); df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates(); grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"]); grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]
# key-receiver-out OVER flag: a team has a WR/TE/RB w/ prior air-share>=35% listed Out/Doubtful
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
miss=inj[inj.report_status.isin(["Out","Doubtful"])].merge(air,on=["season","week","player_id"],how="left")
miss=miss[miss.position.isin({"WR","TE","RB","FB"})]
keyout=miss.groupby(["season","week","team"]).airshare.max().reset_index().rename(columns={"airshare":"max_air_out"})
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}; keyout["ab"]=keyout.team.replace(nv2our)
for side,p in [("home","h_"),("away","a_")]:
    m=m.merge(keyout.rename(columns={"ab":f"{side}_ab","max_air_out":f"{p}max_air_out"})[["season","week",f"{side}_ab",f"{p}max_air_out"]],on=["season","week",f"{side}_ab"],how="left")
m["h_max_air_out"]=m.h_max_air_out.fillna(0); m["a_max_air_out"]=m.a_max_air_out.fillna(0)
m["key_recv_out"]=(((m.h_max_air_out>=35)|(m.a_max_air_out>=35))).astype(int)   # proven OVER signal

# ---- engineer total features ----
m["actual_total"]=m.home_score+m.away_score
m["wind_mph"]=pd.to_numeric(m.wind_mph,errors="coerce").fillna(pd.to_numeric(m.wind_speed,errors="coerce"))
m["temp_f"]=pd.to_numeric(m.temp_f,errors="coerce").fillna(pd.to_numeric(m.temperature,errors="coerce"))
m["dome"]=(m.dome_closed.fillna(0).astype(float)>0).astype(int) if "dome_closed" in m else 0
m["wind_under"]=(m.wind_mph>=15).astype(int)            # proven UNDER signal
m["cold"]=(m.temp_f<=32).astype(int)
m["primetime_i"]=m.primetime.fillna(0).astype(int)
# offensive/defensive scoring environment (sum of both teams = total pressure)
def s(c): return pd.to_numeric(m[c],errors="coerce") if c in m.columns else np.nan
m["off_ppd_sum"]=s("home_off_ppd_s2d")+s("away_off_ppd_s2d")
m["def_ppd_sum"]=s("home_def_ppd_allowed_s2d")+s("away_def_ppd_allowed_s2d")
m["pace_sum"]=s("home_off_pace_s2d")+s("away_off_pace_s2d")
m["pass_epa_sum"]=s("home_off_pass_epa_neutral_s2d")+s("away_off_pass_epa_neutral_s2d")
m["rush_epa_sum"]=s("home_off_rush_epa_neutral_s2d")+s("away_off_rush_epa_neutral_s2d")
m["def_pass_allowed_sum"]=s("home_def_pass_epa_allowed_neutral_s2d")+s("away_def_pass_epa_allowed_neutral_s2d")
m["def_rush_allowed_sum"]=s("home_def_rush_epa_allowed_neutral_s2d")+s("away_def_rush_epa_allowed_neutral_s2d")
m["expl_pass_sum"]=s("home_off_explosive_pass_rate_s2d")+s("away_off_explosive_pass_rate_s2d")
m["td_per_drive_sum"]=s("home_off_td_per_drive_s2d")+s("away_off_td_per_drive_s2d")
m["last_pts_sum"]=s("home_last_points")+s("away_last_points")+s("home_last_allowed_points")+s("away_last_allowed_points")
m["no_huddle_sum"]=s("home_off_no_huddle_rate_s2d")+s("away_off_no_huddle_rate_s2d")

ENV=["off_ppd_sum","def_ppd_sum","pace_sum","pass_epa_sum","rush_epa_sum","def_pass_allowed_sum",
     "def_rush_allowed_sum","expl_pass_sum","td_per_drive_sum","last_pts_sum","no_huddle_sum"]
WEATHER=["wind_mph","temp_f","dome"]
FLAGS=["key_recv_out","wind_under","cold","primetime_i","h_max_air_out","a_max_air_out"]
ENV=[c for c in ENV if c in m.columns and pd.to_numeric(m[c],errors="coerce").notna().mean()>0.5]
for c in ENV+WEATHER+FLAGS: m[c]=pd.to_numeric(m[c],errors="coerce")
W=m[m.week>=4].copy(); key=["season","home_ab","away_ab"]; OT=od[key+["open_total","close_total"]]

def evaluate(feats,label):
    W["pt"]=np.nan
    for Y in range(2021,2026):
        trn=W[W.season<Y].dropna(subset=["actual_total"]); te=W[W.season==Y]
        gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=350,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(trn[feats],trn.actual_total)
        W.loc[te.index,"pt"]=gb.predict(te[feats])
    d=W[W.season.isin([2024,2025])].merge(OT,on=key,how="inner").dropna(subset=["pt","open_total","actual_total"])
    d["edge"]=d.pt-d.open_total                     # +ve => model says OVER the opener
    d["over_hit"]=(d.actual_total>d.open_total).astype(float); d.loc[d.actual_total==d.open_total,"over_hit"]=np.nan
    d["clv"]=np.where(d.edge>0, d.close_total-d.open_total, -(d.close_total-d.open_total))  # line moves toward our O/U side
    rows=[]
    for thr in [1.0,2.0,3.0]:
        bo=d[d.edge>=thr]; bu=d[d.edge<=-thr]
        won=pd.concat([bo.over_hit, 1-bu.over_hit]).dropna(); k=int((won==1).sum()); n=int(won.isin([0,1]).sum())
        clv=pd.concat([bo.clv, bu.clv]).mean() if (len(bo)+len(bu)) else np.nan
        rows.append((thr,k,n,clv))
    thr,k,n,clv=rows[1]; lo,hi=wilson_ci(k,n)
    L(f"  {label:24s} f={len(feats):2d} | edge>=2: n={n} OU={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] roi={(k*100/110-(n-k))/n*100:+.1f}% CLV={clv:+.2f}")
    for yr in [2024,2025]:
        dy=d[d.season==yr]; bo=dy[dy.edge>=2]; bu=dy[dy.edge<=-2]; won=pd.concat([bo.over_hit,1-bu.over_hit]).dropna(); kk=int((won==1).sum()); nn=int(won.isin([0,1]).sum())
        L(f"        {yr}: n={nn} OU={ (kk/nn*100 if nn else 0):.1f}%")

L("="*100); L("TOTALS MODEL: held-out 2024-25 O/U vs OPENING total (edge>=2 pts), iterative groups"); L("="*100)
evaluate(ENV,"env (pace/ppd/epa)")
evaluate(ENV+WEATHER,"+weather")
evaluate(ENV+WEATHER+FLAGS,"+proven flags (FULL)")

# standalone proven totals spots vs the OPENER
L("\n"+"="*100); L("STANDALONE proven totals spots vs the OPENING total"); L("="*100)
d=W[W.season.isin([2024,2025])].merge(OT,on=key,how="inner").dropna(subset=["open_total","actual_total"])
for lab,mask,side in [("wind>=15 -> UNDER", d.wind_mph>=15, "under"),
                      ("key WR/TE out -> OVER", d.key_recv_out==1, "over"),
                      ("dome -> OVER", d.dome==1, "over"),
                      ("cold<=32 -> UNDER", d.cold==1, "under")]:
    sub=d[mask]; oh=(sub.actual_total>sub.open_total); push=(sub.actual_total==sub.open_total)
    won=(oh if side=="over" else ~oh)[~push]; n=int(won.notna().sum()); k=int(won.sum())
    if n>=10: lo,hi=wilson_ci(k,n); L(f"  {lab:26s} n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
