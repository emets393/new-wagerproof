"""
Can Madden OVR sharpen the PROVEN key-receiver-out OVER rule?
Current rule (locked b7c): bet OVER when a team has a WR/TE/RB w/ prior NGS air-share>=35% Out/Doubtful.
Madden angle: OVR is a preseason TALENT prior — available even when air-share is thin (early weeks) or
when a star has low usage. Test rule variants vs CLOSE (proven bar, 2018-2025) + OPEN (2023-25):
  R1 air>=35 (current) | R2 Madden OVR>=T | R3 air>=35 AND ovr>=80 (filter scrubs) |
  R4 air>=35 OR ovr>=88 (catch misses) | R5 early-weeks: ovr>=85 in wks<=4 (where air-share is unreliable)
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet")); rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
mad=pd.read_parquet(os.path.join(DATA,"madden_ratings.parquet"))
m["actual_total"]=m.home_score+m.away_score
def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy(); df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates(); grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"]); grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
mov=mad[mad.status=="matched"][["season","gsis_id","ovr"]].dropna(subset=["gsis_id"]).drop_duplicates(["season","gsis_id"])
# out skill players w/ air-share + Madden OVR
miss=inj[inj.report_status.isin(["Out","Doubtful"])].copy(); miss=miss[miss.position.astype(str).str.strip().isin(["WR","TE","RB","FB"])]
miss=miss.merge(air,on=["season","week","player_id"],how="left").merge(mov.rename(columns={"gsis_id":"player_id"}),on=["season","player_id"],how="left")
miss["airshare"]=miss.airshare.fillna(0); miss["ovr"]=miss.ovr.fillna(0)
ti=miss.groupby(["season","week","team"]).agg(max_air=("airshare","max"),max_ovr=("ovr","max")).reset_index()
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}; ti["ab"]=ti.team.replace(nv2our)
for side,p in [("home","h_"),("away","a_")]:
    m=m.merge(ti.rename(columns={"ab":f"{side}_ab","max_air":f"{p}max_air","max_ovr":f"{p}max_ovr"})[["season","week",f"{side}_ab",f"{p}max_air",f"{p}max_ovr"]],on=["season","week",f"{side}_ab"],how="left")
for c in ["h_max_air","a_max_air","h_max_ovr","a_max_ovr"]: m[c]=m[c].fillna(0)

def trig(df, air_thr=None, ovr_thr=None, mode="or", wk=None):
    """game triggers if EITHER team meets the per-team condition."""
    def team_cond(a,o):
        ca = a>=air_thr if air_thr is not None else None
        co = o>=ovr_thr if ovr_thr is not None else None
        if ca is None: return co
        if co is None: return ca
        return (ca & co) if mode=="and" else (ca | co)
    cond=team_cond(df.h_max_air,df.h_max_ovr) | team_cond(df.a_max_air,df.a_max_ovr)
    sub=df[cond]
    if wk is not None: sub=sub[sub.week.isin(wk)]
    return sub
def over_close(sub):
    s=sub.dropna(subset=["nv_total_line","actual_total"]); o=s.actual_total>s.nv_total_line; push=s.actual_total==s.nv_total_line
    o=o[~push]; return int(o.sum()),len(o)
def over_open(sub):
    s=sub.merge(od[["season","home_ab","away_ab","open_total"]],on=["season","home_ab","away_ab"],how="inner").dropna(subset=["open_total","actual_total"])
    o=s.actual_total>s.open_total; push=s.actual_total==s.open_total; o=o[~push]; return int(o.sum()),len(o)
def report(label, sub):
    k,n=over_close(sub); lo,hi=wilson_ci(k,n) if n else (0,0)
    ko,no=over_open(sub); lo2,hi2=wilson_ci(ko,no) if no else (0,0)
    L(f"  {label:34s} CLOSE: {(k/n*100 if n else 0):.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]  | OPEN: {(ko/no*100 if no else 0):.1f}% (n={no})")

W=m[m.week>=1].copy()
L("="*100); L("RECEIVER-OUT OVER: can Madden OVR sharpen it? (OVER vs CLOSE 2018-25, proven bar)"); L("="*100)
report("R1 air>=35 (CURRENT rule)", trig(W,air_thr=35))
report("R2 Madden OVR>=85 (talent trigger)", trig(W,ovr_thr=85))
report("R2b Madden OVR>=88", trig(W,ovr_thr=88))
report("R3 air>=35 AND ovr>=80 (filter scrubs)", trig(W,air_thr=35,ovr_thr=80,mode="and"))
report("R3b air>=35 AND ovr>=85", trig(W,air_thr=35,ovr_thr=85,mode="and"))
report("R4 air>=35 OR ovr>=88 (catch misses)", trig(W,air_thr=35,ovr_thr=88,mode="or"))

L("\nEARLY WEEKS (1-4) where air-share is thin — does Madden trigger work when air-share can't?")
report("R1 air>=35  (wks1-4)", trig(W,air_thr=35,wk=[1,2,3,4]))
report("R2 ovr>=85  (wks1-4)", trig(W,ovr_thr=85,wk=[1,2,3,4]))
report("R4 air>=35 OR ovr>=88 (wks1-4)", trig(W,air_thr=35,ovr_thr=88,mode="or",wk=[1,2,3,4]))

L("\nPER-SEASON (the credibility check) for the CURRENT rule vs the best Madden variant, vs CLOSE:")
for label,sub in [("R1 air>=35",trig(W,air_thr=35)),("R4 air>=35 OR ovr>=88",trig(W,air_thr=35,ovr_thr=88,mode="or"))]:
    line=[]
    for yr in range(2018,2026):
        s=sub[sub.season==yr].dropna(subset=["nv_total_line","actual_total"]); o=s.actual_total>s.nv_total_line; push=s.actual_total==s.nv_total_line; o=o[~push]
        line.append(f"{yr}:{(o.mean()*100 if len(o) else 0):.0f}%(n{len(o)})")
    L(f"  {label:24s} "+" ".join(line))
