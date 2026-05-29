"""
WEEK 1 Madden starting-lineup ratings — does talent (offense / defense / overall) predict W1 outcomes?
Build, per team-season, the avg Madden OVR of who ACTUALLY started Week 1 (snap_counts: offense_pct>=.5 =>
offensive starter, defense_pct>=.5 => defensive starter), joined via pfr->gsis crosswalk to Madden OVR.
Then Week-1 splits vs the CLOSE (8 seasons, ~128 games -> thin, CIs shown):
  better OFFENSE / DEFENSE / OVERALL team -> win (ML) & cover (ATS)?  talent mismatch -> favorite cover?
  combined offense/defense & "weak O vs strong D" -> OVER/UNDER?
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
sc=pd.read_parquet(os.path.join(DATA,"snap_counts.parquet"))
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet")); mad=pd.read_parquet(os.path.join(DATA,"madden_ratings.parquet"))
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}
p2g=dict(zip(px.pfr_id,px.gsis_id))
ov=mad[mad.status=="matched"][["season","gsis_id","ovr"]].dropna(subset=["gsis_id"]).drop_duplicates(["season","gsis_id"])
sc=sc[(sc.week==1)].copy()
for c in ["offense_pct","defense_pct"]: sc[c]=pd.to_numeric(sc.get(c),errors="coerce").fillna(0)
sc["gsis_id"]=sc.pfr_player_id.map(p2g)
sc=sc.merge(ov,on=["season","gsis_id"],how="left")
sc["ab"]=sc.team.replace(nv2our)
L(f"[build] W1 snap rows {len(sc)}; with Madden OVR {sc.ovr.notna().mean()*100:.0f}%")
def team_rating(mask,name):
    s=sc[mask].dropna(subset=["ovr"]); return s.groupby(["season","ab"]).ovr.mean().rename(name)
off=team_rating(sc.offense_pct>=0.5,"off_rtg"); deff=team_rating(sc.defense_pct>=0.5,"def_rtg")
alls=team_rating((sc.offense_pct>=0.5)|(sc.defense_pct>=0.5),"team_rtg")
R=pd.concat([off,deff,alls],axis=1).reset_index()
L(f"[build] team-season W1 ratings: {len(R)}  off {R.off_rtg.mean():.1f} def {R.def_rtg.mean():.1f} team {R.team_rtg.mean():.1f}")

w1=m[m.week==1].copy(); w1["actual_margin"]=w1.home_score-w1.away_score; w1["actual_total"]=w1.home_score+w1.away_score
w1["home_cover"]=(w1.actual_margin+w1.home_spread>0).astype(float); w1.loc[w1.actual_margin+w1.home_spread==0,"home_cover"]=np.nan
w1["over"]=(w1.actual_total>w1.nv_total_line).astype(float); w1.loc[w1.actual_total==w1.nv_total_line,"over"]=np.nan
w1["home_win"]=(w1.actual_margin>0).astype(float)
for side in ["home","away"]:
    w1=w1.merge(R.rename(columns={"ab":f"{side}_ab","off_rtg":f"{side}_off","def_rtg":f"{side}_def","team_rtg":f"{side}_teamrtg"}),on=["season",f"{side}_ab"],how="left")
g=w1.dropna(subset=["home_off","away_off","home_def","away_def"]).copy()
L(f"[build] W1 games with both teams rated: {len(g)} (over {int(g.season.min())}-{int(g.season.max())})\n")

def split(df, hcol, acol, outcol, label):
    s=df.dropna(subset=[outcol]); bh=s[hcol]>=s[acol]
    won=np.where(bh, s[outcol], 1-s[outcol]); won=won[~np.isnan(won)]; n=len(won);k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else(0,0)
    flag=" (thin)" if n<30 else ""; L(f"    {label:36s} {(k/n*100 if n else 0):5.1f}%  n={n:3d}  CI[{lo*100:.0f},{hi*100:.0f}]{flag}")

L("="*78); L("BETTER TEAM by rating -> WIN (ML) and COVER (ATS vs close), Week 1"); L("="*78)
for dim,hc,ac in [("OVERALL","home_teamrtg","away_teamrtg"),("OFFENSE","home_off","away_off"),("DEFENSE","home_def","away_def")]:
    L(f"  better {dim}:")
    split(g, hc, ac, "home_win", "  wins (ML)")
    split(g, hc, ac, "home_cover", "  covers (ATS)")
L("  talent MISMATCH (|team rating diff|>=3) -> does the better team cover?")
gg=g[(g.home_teamrtg-g.away_teamrtg).abs()>=3];
won=np.where(gg.home_teamrtg>=gg.away_teamrtg, gg.home_cover,1-gg.home_cover); won=won[~np.isnan(won)]; n=len(won);k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else(0,0)
L(f"    big talent gap -> better team ATS    {(k/n*100 if n else 0):5.1f}%  n={n}  CI[{lo*100:.0f},{hi*100:.0f}]")

L("\n"+"="*78); L("TOTALS — offense/defense talent -> OVER/UNDER (vs close), Week 1"); L("="*78)
g["off_sum"]=g.home_off+g.away_off; g["def_sum"]=g.home_def+g.away_def
g["o_minus_d"]=(g.home_off-g.away_def)+(g.away_off-g.home_def)   # offenses vs opposing defenses; high=>shootout
def tsplit(mask,label,want_over=True):
    s=g[mask].dropna(subset=["over"]); n=len(s);k=int(s.over.sum()); lo,hi=wilson_ci(k,n) if n else(0,0)
    flag=" (thin)" if n<30 else ""; L(f"    {label:40s} OVER {(k/n*100 if n else 0):5.1f}%  n={n:3d}  CI[{lo*100:.0f},{hi*100:.0f}]{flag}")
qo=g.off_sum.quantile([.33,.67]); qd=g.def_sum.quantile([.33,.67]); qm=g.o_minus_d.quantile([.33,.67])
tsplit(g.off_sum>=qo.iloc[1],"top-third combined OFFENSE")
tsplit(g.off_sum<=qo.iloc[0],"bottom-third combined OFFENSE")
tsplit(g.def_sum>=qd.iloc[1],"top-third combined DEFENSE")
tsplit(g.def_sum<=qd.iloc[0],"bottom-third combined DEFENSE")
tsplit(g.o_minus_d>=qm.iloc[1],"offenses >> defenses (shootout setup)")
tsplit(g.o_minus_d<=qm.iloc[0],"defenses >> offenses (weak O vs strong D)")
# the specific 'bad offense vs good defense' single-matchup view
g["worst_mismatch"]=np.minimum(g.home_off-g.away_def, g.away_off-g.home_def)
tsplit(g.worst_mismatch<=g.worst_mismatch.quantile(.25),"one O badly outmatched by opp D")
