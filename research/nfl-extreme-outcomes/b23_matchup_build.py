"""
Build an OFFENSE-PERSPECTIVE matchup table (2 rows/game) to test attribute/physical matchups:
  Madden unit profiles (WR corps, OL, CB, secondary, pass-rush) + the opposing defense's profiles
  -> mismatch features (the user's hypotheses + a battery of others)
  + leak-safe team s2d pass quality (off vs opp-def)
  + per-game passing OUTPUT (NGS QB pass_yards / CPOE) = the football MECHANISM check
  + betting outcomes (offense covers vs close/open; game over vs close/open).
Saved to data/offense_matchup.parquet for the mining step (b24).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
A=pd.read_parquet(os.path.join(DATA,"madden_attributes.parquet"))
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); pas=pd.read_parquet(os.path.join(DATA,"ngs_passing.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}
NICK={'49ers':'SF','cardinals':'ARI','falcons':'ATL','ravens':'BAL','bills':'BUF','panthers':'CAR','bears':'CHI',
 'bengals':'CIN','browns':'CLE','cowboys':'DAL','broncos':'DEN','lions':'DET','packers':'GB','texans':'HOU',
 'colts':'IND','jaguars':'JAX','chiefs':'KC','chargers':'LAC','rams':'LAR','dolphins':'MIA','vikings':'MIN',
 'patriots':'NE','saints':'NO','giants':'NYG','jets':'NYJ','eagles':'PHI','steelers':'PIT','seahawks':'SEA',
 'buccaneers':'TB','titans':'TEN','commanders':'WAS','redskins':'WAS','team':'WAS'}
def to_ab(t,s):
    last=str(t).split()[-1].lower() if str(t).split() else ''
    return ('OAK' if s<=2019 else 'LV') if last=='raiders' else NICK.get(last)
A["ab"]=[to_ab(t,s) for t,s in zip(A.team,A.season)]; A=A.dropna(subset=["ab"])

# ---- Madden unit profiles per (season, ab) ----
def topmean(positions,n,cols):
    s=A[A.pos.isin(positions)].sort_values("ovr",ascending=False).groupby(["season","ab"]).head(n)
    return s.groupby(["season","ab"])[cols].mean()
WR=topmean({"WR"},3,["speed","ht","wt","agility","acceleration","catching","awareness"]).add_prefix("wr_")
OL=topmean({"LT","LG","C","RG","RT"},5,["strength","awareness","wt"]).add_prefix("ol_")
CB=topmean({"CB"},3,["speed","ht","wt","agility","awareness"]).add_prefix("cb_")
DB=topmean({"CB","FS","SS"},4,["speed","ht","wt","agility","awareness"]).add_prefix("db_")
PR=topmean({"LE","RE","DT","LOLB","ROLB"},4,["strength","speed","acceleration"]).add_prefix("pr_")
prof=pd.concat([WR,OL,CB,DB,PR],axis=1).reset_index()
off_prof=prof[["season","ab"]+[c for c in prof if c.startswith(("wr_","ol_"))]]
def_prof=prof[["season","ab"]+[c for c in prof if c.startswith(("cb_","db_","pr_"))]]

# ---- per-game passing OUTPUT (primary QB by attempts) ----
pas=pas.copy(); pas["ab"]=pas.team.replace(nv2our)
qb=pas.sort_values("attempts",ascending=False).groupby(["season","week","ab"]).head(1)[["season","week","ab","pass_yards","completion_percentage_above_expectation","avg_time_to_throw","avg_intended_air_yards"]]
qb=qb.rename(columns={"completion_percentage_above_expectation":"cpoe","pass_yards":"qb_pass_yards","avg_time_to_throw":"ttt_game","avg_intended_air_yards":"iay_game"})

# ---- game base (s2d, lines, scores) ----
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score
OFFS=["off_time_to_throw_s2d","off_explosive_pass_rate_s2d","off_intended_ay_s2d","off_cpoe_s2d"]  # NB: off_pass_epa_s2d lives in training_epa, not matchup
DEFS=["def_pass_epa_allowed_neutral_s2d","def_pressure_rate_s2d","def_explosive_pass_allowed_s2d","def_pass_sr_allowed_s2d"]
keep=["season","week","unique_id","home_ab","away_ab","home_score","away_score","home_spread","nv_total_line","actual_margin","actual_total"]
keep=[c for c in keep+["home_"+c for c in OFFS]+["away_"+c for c in OFFS]+["home_"+c for c in DEFS]+["away_"+c for c in DEFS] if c in m.columns]
g=m[keep].merge(od[["season","home_ab","away_ab","open_spread","open_total","close_total"]],on=["season","home_ab","away_ab"],how="left")

rows=[]
for off_side,def_side in [("home","away"),("away","home")]:
    r=pd.DataFrame()
    r["season"]=g.season; r["week"]=g.week; r["unique_id"]=g.unique_id
    r["off_ab"]=g[f"{off_side}_ab"]; r["def_ab"]=g[f"{def_side}_ab"]; r["is_home"]=int(off_side=="home")
    off_score=g[f"{off_side}_score"]; def_score=g[f"{def_side}_score"]
    r["off_spread"]=g.home_spread if off_side=="home" else -g.home_spread
    r["off_spread_open"]=g.open_spread if off_side=="home" else -g.open_spread
    r["off_cover"]=((off_score-def_score)+r.off_spread>0).astype(float); r.loc[(off_score-def_score)+r.off_spread==0,"off_cover"]=np.nan
    r["off_cover_open"]=((off_score-def_score)+r.off_spread_open>0).astype(float); r.loc[(off_score-def_score)+r.off_spread_open==0,"off_cover_open"]=np.nan
    r.loc[r.off_spread_open.isna(),"off_cover_open"]=np.nan   # no opener (pre-2023) -> NaN, not 0
    r["over_close"]=(g.actual_total>g.nv_total_line).astype(float); r.loc[g.actual_total==g.nv_total_line,"over_close"]=np.nan
    r["over_open"]=(g.actual_total>g.open_total).astype(float); r.loc[g.actual_total==g.open_total,"over_open"]=np.nan
    r.loc[g.open_total.isna(),"over_open"]=np.nan
    for c in OFFS: r["off_"+c]=g.get(f"{off_side}_{c}")
    for c in DEFS: r["opp_"+c]=g.get(f"{def_side}_{c}")
    rows.append(r)
T=pd.concat(rows,ignore_index=True)
T=T.merge(off_prof.rename(columns={"ab":"off_ab"}),on=["season","off_ab"],how="left")
T=T.merge(def_prof.rename(columns={"ab":"def_ab"}),on=["season","def_ab"],how="left")
T=T.merge(qb.rename(columns={"ab":"off_ab"}),on=["season","week","off_ab"],how="left")

# ---- MISMATCH FEATURES (offense unit vs opponent defense unit) ----
T["m_wr_db_speed"]=T.wr_speed-T.db_speed                 # fast WR corps vs secondary speed
T["m_wr_cb_speed"]=T.wr_speed-T.cb_speed
T["m_wr_cb_wt"]=T.wr_wt-T.cb_wt                          # big WR vs small CB (size)
T["m_wr_cb_ht"]=T.wr_ht-T.cb_ht
T["m_wr_db_agility"]=T.wr_agility-T.db_agility           # quickness/separation
T["m_ol_pr_str"]=T.ol_strength-T.pr_strength            # protection vs pass-rush strength
T["m_wr_acc"]=T.wr_acceleration-T.db_speed
# the USER'S explicit combos (z-scored interactions):
def z(s): return (s-s.mean())/s.std(ddof=0)
T["H1_fastWR_protect_vs_slowbigD"]= z(T.m_wr_db_speed) + z(T["off_off_time_to_throw_s2d"].fillna(T["off_off_time_to_throw_s2d"].median())) + z(-T.db_speed) + z(T.db_wt)
T["H2_bigWR_vs_smallCB"]= z(T.m_wr_cb_wt) + z(T.m_wr_cb_ht) - z(T.wr_agility)   # big, not shifty, vs small CB
# market-known passing-matchup quality (control): offense CPOE + opp pass-EPA-allowed (both higher => better for offense)
T["off_pass_quality_diff"]=z(T["off_off_cpoe_s2d"].fillna(T["off_off_cpoe_s2d"].median()))+z(T["opp_def_pass_epa_allowed_neutral_s2d"].fillna(T["opp_def_pass_epa_allowed_neutral_s2d"].median()))
T.to_parquet(os.path.join(DATA,"offense_matchup.parquet"))
feat=[c for c in T.columns if c.startswith(("m_","H1","H2")) or c in ("off_pass_quality_diff",)]
L(f"[build] offense_matchup.parquet: {len(T)} team-games. mismatch features: {feat}")
L(f"[coverage] wr_speed {T.wr_speed.notna().mean()*100:.0f}%, cb_wt {T.cb_wt.notna().mean()*100:.0f}%, qb_pass_yards {T.qb_pass_yards.notna().mean()*100:.0f}%, off_cover {T.off_cover.notna().mean()*100:.0f}%")
L(f"[sanity] m_wr_cb_wt mean {T.m_wr_cb_wt.mean():.1f}lb (WR heavier than CB), m_wr_db_speed mean {T.m_wr_db_speed.mean():.1f}")
