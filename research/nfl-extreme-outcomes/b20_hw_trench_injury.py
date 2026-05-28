"""
H/W tests 1 & 2.
T1 size-conditional injury: does the OUT player's position/size change the receiver-OUT total effect?
    WR/TE out -> OVER is proven; a big bell-cow RB out might cut the run/ball-control game differently.
    Split the air-share>=35 OVER rule by out-player position (WR/TE vs RB) and by weight tercile.
T2 trench size mismatch: a big OL vs a light opposing DL -> run-game control -> ball control -> UNDER,
    and that team controls the game ATS. Distinct from the (priced) symmetric physicality test.
All vs CLOSE 2018-2025 + per-season for anything with a pulse.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
A=pd.read_parquet(os.path.join(DATA,"madden_attributes.parquet"))
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet")); rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet"))
m["actual_total"]=m.home_score+m.away_score; m["actual_margin"]=m.home_score-m.away_score
m["home_cover"]=(m.actual_margin+m.home_spread>0).astype(int)
NICK={'49ers':'SF','cardinals':'ARI','falcons':'ATL','ravens':'BAL','bills':'BUF','panthers':'CAR','bears':'CHI',
 'bengals':'CIN','browns':'CLE','cowboys':'DAL','broncos':'DEN','lions':'DET','packers':'GB','texans':'HOU',
 'colts':'IND','jaguars':'JAX','chiefs':'KC','chargers':'LAC','rams':'LAR','dolphins':'MIA','vikings':'MIN',
 'patriots':'NE','saints':'NO','giants':'NYG','jets':'NYJ','eagles':'PHI','steelers':'PIT','seahawks':'SEA',
 'buccaneers':'TB','titans':'TEN','commanders':'WAS','redskins':'WAS','team':'WAS'}
def to_ab(t,s):
    last=str(t).split()[-1].lower() if str(t).split() else ''
    return ('OAK' if s<=2019 else 'LV') if last=='raiders' else NICK.get(last)
A["ab"]=[to_ab(t,s) for t,s in zip(A.team,A.season)]; A=A.dropna(subset=["ab"])
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}

def under(sub):
    s=sub.dropna(subset=["nv_total_line","actual_total"]); u=s.actual_total<s.nv_total_line; push=s.actual_total==s.nv_total_line; u=u[~push]
    n=len(u);k=int(u.sum()); lo,hi=wilson_ci(k,n) if n else (0,0); return k,n,(k/n*100 if n else 0),lo*100,hi*100
def over(sub):
    s=sub.dropna(subset=["nv_total_line","actual_total"]); o=s.actual_total>s.nv_total_line; push=s.actual_total==s.nv_total_line; o=o[~push]
    n=len(o);k=int(o.sum()); lo,hi=wilson_ci(k,n) if n else (0,0); return k,n,(k/n*100 if n else 0),lo*100,hi*100

# ---------------- T1: size-conditional injury ----------------
def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy(); df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates(); grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"]); grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
g2w=dict(zip(px.gsis_id,pd.to_numeric(px.weight,errors="coerce")))
miss=inj[inj.report_status.isin(["Out","Doubtful"])].copy(); miss["posg"]=miss.position.astype(str).str.strip()
miss=miss[miss.posg.isin(["WR","TE","RB","FB"])].merge(air,on=["season","week","player_id"],how="left")
miss["airshare"]=miss.airshare.fillna(0); miss["wt"]=miss.player_id.map(g2w)
miss=miss[miss.airshare>=35]                                  # the proven trigger
miss["grp"]=np.where(miss.posg=="RB","RB-out","WRTE-out")
# trigger team-week with the position + weight of the max-air out player
miss=miss.sort_values("airshare",ascending=False).groupby(["season","week","team"]).head(1)
miss["ab"]=miss.team.replace(nv2our)
trg=miss[["season","week","ab","grp","wt","airshare"]]
# attach to games: a game is triggered if home OR away has a trigger; tag with that player's grp/wt
rows=[]
for side in ["home","away"]:
    t=trg.rename(columns={"ab":f"{side}_ab"}).merge(m[["season","week","home_ab","away_ab","nv_total_line","actual_total"]],on=["season","week",f"{side}_ab"],how="inner")
    rows.append(t)
G=pd.concat(rows).drop_duplicates(["season","week","home_ab","away_ab","grp"])
L("="*92); L("T1  receiver-OUT OVER split by OUT-player POSITION (vs CLOSE, air-share>=35)"); L("="*92)
for grp in ["WRTE-out","RB-out"]:
    k,n,h,lo,hi=over(G[G.grp==grp]); L(f"  {grp:10s} -> OVER: {h:.1f}% (n={n}) CI[{lo:.0f},{hi:.0f}]")
L("  WR/TE-out by out-player WEIGHT tercile (does a bigger skill player matter more?):")
wr=G[G.grp=="WRTE-out"].dropna(subset=["wt"])
if len(wr):
    q1,q2=wr.wt.quantile([.33,.66])
    for lab,sub in [("light WR/TE",wr[wr.wt<=q1]),("mid",wr[(wr.wt>q1)&(wr.wt<q2)]),("heavy WR/TE",wr[wr.wt>=q2])]:
        k,n,h,lo,hi=over(sub); L(f"    {lab:14s}(wt) OVER: {h:.1f}% (n={n}) CI[{lo:.0f},{hi:.0f}]")
L("  RB-out by weight (bell-cow vs scatback):")
rb=G[G.grp=="RB-out"].dropna(subset=["wt"])
if len(rb)>=10:
    med=rb.wt.median()
    for lab,sub in [("light RB(scat)",rb[rb.wt<med]),("heavy RB(bell-cow)",rb[rb.wt>=med])]:
        ku,nu,hu,lou,hiu=under(sub); ko,no,ho,loo,hio=over(sub)
        L(f"    {lab:18s} OVER {ho:.0f}% / UNDER {hu:.0f}% (n={no})")

# ---------------- T2: trench size mismatch ----------------
OLp={'LT','LG','C','RG','RT'}; DLp={'LE','RE','DT','NT'}
ol=A[A.pos.isin(OLp)].sort_values("ovr",ascending=False).groupby(["season","ab"]).head(5).groupby(["season","ab"]).wt.mean().rename("ol_wt")
dl=A[A.pos.isin(DLp)].sort_values("ovr",ascending=False).groupby(["season","ab"]).head(4).groupby(["season","ab"]).wt.mean().rename("dl_wt")
tw=pd.concat([ol,dl],axis=1).reset_index()
for side,p in [("home","h_"),("away","a_")]:
    m=m.merge(tw.rename(columns={"ab":f"{side}_ab","ol_wt":f"{p}ol_wt","dl_wt":f"{p}dl_wt"}),on=["season",f"{side}_ab"],how="left")
m["h_run_adv"]=m.h_ol_wt-m.a_dl_wt; m["a_run_adv"]=m.a_ol_wt-m.h_dl_wt
m["mismatch_max"]=m[["h_run_adv","a_run_adv"]].max(axis=1); m["both_heavy_ol"]=(m.h_ol_wt+m.a_ol_wt)
W=m[m.h_run_adv.notna()].copy()
L("\n"+"="*92); L("T2  TRENCH SIZE MISMATCH (big OL vs light opp DL -> run control)"); L("="*92)
q=W.mismatch_max.quantile(.75)
big=W[W.mismatch_max>=q]
ku,nu,hu,lou,hiu=under(big); L(f"  top-25% trench mismatch -> UNDER: {hu:.1f}% (n={nu}) CI[{lou:.0f},{hiu:.0f}]")
# does the team with the bigger run advantage cover ATS?
s=big.dropna(subset=["home_cover"]); home_bigger=s.h_run_adv>=s.a_run_adv
won=np.where(home_bigger,s.home_cover,1-s.home_cover); n=len(won);k=int(won.sum()); lo,hi=wilson_ci(k,n)
L(f"  bigger-trench team ATS (in top-25% mismatch): {k/n*100:.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")
L("  per-season top-25% mismatch UNDER:")
line=[]
for yr in range(2018,2026):
    ku,nu,hu,lo,hi=under(big[big.season==yr]); line.append(f"{yr}:{hu:.0f}%(n{nu})")
L("    "+" ".join(line))
