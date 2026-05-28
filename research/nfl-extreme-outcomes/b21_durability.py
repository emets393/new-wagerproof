"""
H/W test 3 — size as a durability / injury-risk prior.
Within position, do lighter (or taller-for-weight) players accumulate more 'Out' weeks?
Player-season weeks-listed-Out (from injuries_raw) vs weight z-score within position_group.
Restricted to player-seasons that appear on an injury report at least once (rostered proxy).
EXPLORATORY + correlational (confounded by role/age) — payoff is a fragility prior, not a bet.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet"))
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet"))
px["wt"]=pd.to_numeric(px.weight,errors="coerce"); px["ht"]=pd.to_numeric(px.height,errors="coerce")
# games (weeks) missed = distinct weeks with report_status == 'Out' per (gsis, season)
out=inj[inj.report_status=="Out"].groupby(["season","player_id"]).week.nunique().rename("wks_out").reset_index()
# rostered-proxy denominator: any injury-report appearance that season
seen=inj.groupby(["season","player_id"]).size().rename("rep_rows").reset_index()
d=seen.merge(out,on=["season","player_id"],how="left"); d["wks_out"]=d.wks_out.fillna(0)
d=d.merge(px[["gsis_id","position_group","wt","ht"]].rename(columns={"gsis_id":"player_id"}),on="player_id",how="left")
d=d.dropna(subset=["wt","position_group"]); d=d[d.position_group.isin(["QB","RB","WR","TE","OL","DL","LB","DB","SPEC"])]
# weight z within position_group (per season to control era)
d["wt_z"]=d.groupby(["season","position_group"]).wt.transform(lambda s:(s-s.mean())/s.std(ddof=0))
d["ht_z"]=d.groupby(["season","position_group"]).ht.transform(lambda s:(s-s.mean())/s.std(ddof=0))
d=d.dropna(subset=["wt_z"])
L(f"[build] player-seasons (rostered proxy): {len(d)}  mean wks_out={d.wks_out.mean():.2f}")
# pooled within-position correlation: does lighter-for-position -> more Out weeks?
from numpy import corrcoef
r_wt=corrcoef(d.wt_z,d.wks_out)[0,1]; r_ht=corrcoef(d.ht_z.fillna(0),d.wks_out)[0,1]
L(f"[corr] weight_z vs wks_out (within pos): r={r_wt:+.3f}   height_z vs wks_out: r={r_ht:+.3f}")
L("  (negative r = lighter players miss MORE -> fragility signal)")
L("\n[by weight tercile within position] mean weeks-Out:")
d["wt_terc"]=d.groupby(["season","position_group"]).wt_z.transform(lambda s:pd.qcut(s.rank(method="first"),3,labels=["light","mid","heavy"]))
tab=d.groupby(["position_group","wt_terc"]).wks_out.mean().unstack()
L(tab.round(2).to_string())
L("\n[per-position corr] weight_z vs wks_out:")
for pg,grp in d.groupby("position_group"):
    if len(grp)>=100:
        r=corrcoef(grp.wt_z,grp.wks_out)[0,1]; L(f"  {pg:5s}: r={r:+.3f} (n={len(grp)}, mean Out={grp.wks_out.mean():.2f})")
