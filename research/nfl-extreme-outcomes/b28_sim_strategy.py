"""
SIMULATION STRATEGY — market-anchored, edge-adjusted TOTAL pricer.
Anchor on the opener (market mean), then reprice by the calibrated effect of our proven edges, COMBINED:
  repriced_total = open_total + SUM_k delta_k * flag_k
Adjustment magnitudes delta_k are calibrated vs the CLOSE on TRAIN seasons (2018-2023, all years have close),
then applied to the 2024-25 OPENER (held-out). Bet OVER/UNDER where |repriced - open| >= threshold.
Novel question vs the single-signal harness: does the COMPOSITE find more/better bets (incl. stacked small
adjustments) and beat the opener + get +CLV?
Flags: key-receiver-out (air>=35 -> OVER), wind>=15 (UNDER), dome (OVER), cold<=32 (UNDER).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet")); rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
m["actual_total"]=m.home_score+m.away_score
def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy(); df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates(); grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"]); grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
miss=inj[inj.report_status.isin(["Out","Doubtful"])].merge(air,on=["season","week","player_id"],how="left")
miss=miss[miss.position.astype(str).str.strip().isin(["WR","TE","RB","FB"])]; miss["airshare"]=miss.airshare.fillna(0)
ko=miss[miss.airshare>=35].groupby(["season","week","team"]).size().reset_index(name="n"); ko["ab"]=ko.team.replace({"LA":"LAR","SD":"LAC","STL":"LAR"})
for side,p in [("home","h_"),("away","a_")]:
    m=m.merge(ko.rename(columns={"ab":f"{side}_ab","n":f"{p}ko"})[["season","week",f"{side}_ab",f"{p}ko"]],on=["season","week",f"{side}_ab"],how="left")
m["recv_out"]=((m.h_ko.fillna(0)+m.a_ko.fillna(0))>0).astype(int)
m["wind_mph"]=pd.to_numeric(m.get("wind_mph"),errors="coerce").fillna(pd.to_numeric(m.get("wind_speed"),errors="coerce"))
m["temp_f"]=pd.to_numeric(m.get("temp_f"),errors="coerce").fillna(pd.to_numeric(m.get("temperature"),errors="coerce"))
m["wind15"]=(m.wind_mph>=15).astype(int); m["cold"]=(m.temp_f<=32).astype(int)
m["dome"]=(pd.to_numeric(m.get("dome_closed"),errors="coerce").fillna(0)>0).astype(int)
FLAGS=["recv_out","wind15","dome","cold"]
W=m[m.week>=4].dropna(subset=["actual_total","nv_total_line"]).copy()

# calibrate delta_k = mean(actual_total - close_total | flag) on TRAIN seasons 2018-2023
TR=W[W.season<=2023]; W["resid_close"]=W.actual_total-W.nv_total_line; TR=TR.assign(resid_close=TR.actual_total-TR.nv_total_line)
delta={}
base=TR.resid_close.mean()
for f in FLAGS:
    on=TR[TR[f]==1].resid_close.mean(); delta[f]=on-base
L("="*84); L("CALIBRATED total adjustments (pts vs close, train 2018-2023):"); L("="*84)
for f in FLAGS: L(f"  {f:10s} delta={delta[f]:+.2f} pts  (n_train={int((TR[f]==1).sum())})")
L(f"  baseline resid (no flag) = {base:+.2f}")

# apply to held-out 2024-25 OPENER
te=W[W.season.isin([2024,2025])].merge(od[["season","home_ab","away_ab","open_total","close_total"]],on=["season","home_ab","away_ab"],how="inner").dropna(subset=["open_total"])
te["adj"]=sum(delta[f]*te[f] for f in FLAGS)
te["repriced"]=te.open_total+te.adj
te["tdiv"]=te.repriced-te.open_total                 # = adj (divergence from opener)
L("\n"+"="*84); L("HELD-OUT 2024-25: bet OVER/UNDER where composite repriced diverges from OPENER"); L("="*84)
def grade(sub):
    s=sub.copy(); ov=(s.actual_total>s.open_total); push=s.actual_total==s.open_total
    bet_over=s["tdiv"]>0; won=np.where(bet_over,ov,~ov)[~push.values]; n=len(won); k=int(won.sum())
    clv=np.where(bet_over, s.close_total-s.open_total, s.open_total-s.close_total)[~push.values]
    return n,k,(np.mean(clv) if n else 0)
for thr in [0.75,1.5,2.5]:
    sub=te[te["tdiv"].abs()>=thr]; n,k,clv=grade(sub); lo,hi=wilson_ci(k,n) if n else (0,0)
    L(f"  |divergence|>={thr}: bets={n} hit={(k/n*100 if n else 0):.1f}% CI[{lo*100:.0f},{hi*100:.0f}] CLV={clv:+.2f}pts  (~{n/2:.0f}/yr)")
L("  per-season (|div|>=1.5):")
for yr in [2024,2025]:
    n,k,clv=grade(te[(te["tdiv"].abs()>=1.5)&(te.season==yr)]); L(f"    {yr}: {k}/{n}={(k/n*100 if n else 0):.0f}% CLV={clv:+.2f}")

# baseline: single-signal (recv_out OVER + wind15 UNDER) for comparison
L("\n"+"="*84); L("BASELINE single-signal (recv_out->OVER, wind15->UNDER) vs opener, same held-out"); L("="*84)
b=te[(te.recv_out==1)|(te.wind15==1)].copy(); b["bet_over"]=b.recv_out==1
ov=(b.actual_total>b.open_total); push=b.actual_total==b.open_total
won=np.where(b.bet_over,ov,~ov)[~push.values]; n=len(won); k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else (0,0)
L(f"  single-signal: bets={n} hit={(k/n*100 if n else 0):.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  (~{n/2:.0f}/yr)")
L(f"  -> composite adds bets from STACKED small adjustments (dome+cold etc.) the single flags miss; check if hit-rate holds.")
