"""
Dig deeper into Madden: extract per-player ATTRIBUTES (speed/strength/agility/...) + height/weight across
all 8 years (3 different column-naming schemes), build TEAM physical & speed profiles, and test hypotheses
tied to our proven edges:
  T1 physicality ATS — does the heavier/stronger team cover? (overall + interacted with WIND/COLD)
  T2 physicality TOTALS — do two big physical teams -> UNDER, amplified in wind?
  T3 speed TOTALS — do fast skill units -> OVER, esp. in domes (track meets)?
All vs the CLOSE 2018-2025 (broad bar), per-season for anything with a pulse. Expectation set up front:
team style/size is usually PRICED for sides; the hope is a weather INTERACTION the market underprices.
"""
import os, sys, re, glob, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); MD=os.path.join(DATA,"madden"); L=print

def nrm(c): return re.sub(r"[^a-z0-9]","",str(c).lower())
ATTRS=["speed","acceleration","agility","strength","awareness","jumping","catching"]
def getcol(cols, base):
    pats={base, base+"rating", "stats"+base+"value"}
    for c in cols:
        if nrm(c) in pats: return c
    return None
def find(cols,*subs):
    for c in cols:
        if nrm(c) in {nrm(s) for s in subs}: return c
    return None
def parse(f,season,sheet=0):
    df=pd.read_excel(f,sheet_name=sheet); cols=list(df.columns)
    fn,ln,nm=find(cols,"firstname"),find(cols,"lastname"),find(cols,"full name","name")
    name=(df[fn].astype(str)+" "+df[ln].astype(str)) if (fn and ln) else df[nm].astype(str)
    out=pd.DataFrame({"season":season,"name":name,"team":df[find(cols,"team")],"pos":df[find(cols,"position")],
        "ovr":pd.to_numeric(df[find(cols,"overall rating","overallrating","overall")],errors="coerce"),
        "ht":pd.to_numeric(df[find(cols,"height")],errors="coerce"),
        "wt":pd.to_numeric(df[find(cols,"weight")],errors="coerce")})
    for a in ATTRS:
        c=getcol(cols,a); out[a]=pd.to_numeric(df[c],errors="coerce") if c else np.nan
    return out
files={2018:("madden_2018.xlsx",0),2019:("madden_2019.xlsx",0),2020:("madden_2020.xlsx",0),
       2021:("madden_2021.xlsx",0),2022:("madden_2022.xlsx",0),2023:("madden_2023.xlsx",0),
       2024:("madden_2024.xlsx",0),2025:("madden_2025.xlsx","Launch Ratings")}
A=pd.concat([parse(os.path.join(MD,fn),yr,sh) for yr,(fn,sh) in files.items()],ignore_index=True)
A.to_parquet(os.path.join(DATA,"madden_attributes.parquet"))
L(f"[build] madden_attributes.parquet: {len(A)} rows. attr coverage: "+", ".join(f"{a}={A[a].notna().mean()*100:.0f}%" for a in ATTRS+["ht","wt"]))

NICK={'49ers':'SF','cardinals':'ARI','falcons':'ATL','ravens':'BAL','bills':'BUF','panthers':'CAR','bears':'CHI',
 'bengals':'CIN','browns':'CLE','cowboys':'DAL','broncos':'DEN','lions':'DET','packers':'GB','texans':'HOU',
 'colts':'IND','jaguars':'JAX','chiefs':'KC','chargers':'LAC','rams':'LAR','dolphins':'MIA','vikings':'MIN',
 'patriots':'NE','saints':'NO','giants':'NYG','jets':'NYJ','eagles':'PHI','steelers':'PIT','seahawks':'SEA',
 'buccaneers':'TB','titans':'TEN','commanders':'WAS','redskins':'WAS','team':'WAS'}
def to_ab(t,s):
    last=str(t).split()[-1].lower() if str(t).split() else ''
    return ('OAK' if s<=2019 else 'LV') if last=='raiders' else NICK.get(last)
A["ab"]=[to_ab(t,s) for t,s in zip(A.team,A.season)]; A=A.dropna(subset=["ab"])
OLp={'LT','LG','C','RG','RT'}; DLp={'LE','RE','DT','NT'}; SKp={'WR','HB','RB','TE','FB'}
def topn(df,positions,n,col):
    s=df[df.pos.isin(positions)].sort_values("ovr",ascending=False).groupby(["season","ab"]).head(n)
    return s.groupby(["season","ab"])[col].mean()
team=pd.DataFrame({
 "ol_wt":topn(A,OLp,5,"wt"), "dl_wt":topn(A,DLp,4,"wt"),
 "ol_str":topn(A,OLp,5,"strength"), "dl_str":topn(A,DLp,4,"strength"),
 "sk_speed":topn(A,SKp,5,"speed"), "sk_speed_top":A[A.pos.isin(SKp)].sort_values("ovr",ascending=False).groupby(["season","ab"]).head(3).groupby(["season","ab"]).speed.max(),
}).reset_index()
team["trench_wt"]=(team.ol_wt+team.dl_wt)/2; team["trench_str"]=(team.ol_str+team.dl_str)/2

# attach to games + weather
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
m["actual_total"]=m.home_score+m.away_score; m["actual_margin"]=m.home_score-m.away_score
m["home_cover"]=(m.actual_margin+m.home_spread>0).astype(int)
m["wind_mph"]=pd.to_numeric(m.get("wind_mph"),errors="coerce").fillna(pd.to_numeric(m.get("wind_speed"),errors="coerce"))
m["temp_f"]=pd.to_numeric(m.get("temp_f"),errors="coerce").fillna(pd.to_numeric(m.get("temperature"),errors="coerce"))
m["dome"]=(pd.to_numeric(m.get("dome_closed"),errors="coerce").fillna(0)>0).astype(int)
for side,p in [("home","h_"),("away","a_")]:
    m=m.merge(team.rename(columns={"ab":f"{side}_ab",**{c:f"{p}{c}" for c in ["trench_wt","trench_str","sk_speed","sk_speed_top","ol_wt","dl_wt"]}})[["season",f"{side}_ab"]+[f"{p}{c}" for c in ["trench_wt","trench_str","sk_speed","sk_speed_top","ol_wt","dl_wt"]]],on=["season",f"{side}_ab"],how="left")
m["phys_diff"]=(m.h_trench_wt-m.a_trench_wt)+(m.h_trench_str-m.a_trench_str)  # home more physical (size+strength)
m["phys_sum"]=m.h_trench_str+m.a_trench_str
m["speed_sum"]=m.h_sk_speed+m.a_sk_speed; m["speed_diff"]=m.h_sk_speed-m.a_sk_speed
W=m[(m.week>=1)&m.phys_diff.notna()].copy()

def ats(sub,label):
    s=sub.dropna(subset=["home_cover"]);
    # bet the MORE physical team: home if phys_diff>0 else away
    won=np.where(s.phys_diff>0, s.home_cover, 1-s.home_cover); n=len(won); k=int(won.sum()); lo,hi=wilson_ci(k,n) if n else (0,0)
    L(f"  {label:38s} more-physical-team ATS: {(k/n*100 if n else 0):.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")
def under(sub,label,col,thr,hi_is):
    s=sub.dropna(subset=["nv_total_line","actual_total"]);
    u=s.actual_total<s.nv_total_line; push=s.actual_total==s.nv_total_line; u=u[~push]
    n=len(u); k=int(u.sum()); lo,hi=wilson_ci(k,n) if n else (0,0)
    L(f"  {label:38s} UNDER: {(k/n*100 if n else 0):.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")
def over(sub,label):
    s=sub.dropna(subset=["nv_total_line","actual_total"]); o=s.actual_total>s.nv_total_line; push=s.actual_total==s.nv_total_line; o=o[~push]
    n=len(o); k=int(o.sum()); lo,hi=wilson_ci(k,n) if n else (0,0)
    L(f"  {label:38s} OVER: {(k/n*100 if n else 0):.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")

L("\n"+"="*92); L("T1 PHYSICALITY -> ATS (does the bigger/stronger team cover? overall + in bad weather)"); L("="*92)
ats(W,"all games"); ats(W[W.wind_mph>=15],"wind>=15"); ats(W[W.temp_f<=35],"cold<=35"); ats(W[(W.wind_mph>=12)|(W.temp_f<=35)],"wind>=12 OR cold<=35")
L("\n"+"="*92); L("T2 PHYSICALITY -> TOTALS (two big physical teams -> UNDER? amplified in wind?)"); L("="*92)
hi_phys=W[W.phys_sum>=W.phys_sum.quantile(.75)];
under(hi_phys,"top-25% physical games","",0,True); under(hi_phys[hi_phys.wind_mph>=12],"top-25% physical AND wind>=12","",0,True)
L("\n"+"="*92); L("T3 SPEED -> TOTALS (fast skill units -> OVER, esp domes)"); L("="*92)
hi_spd=W[W.speed_sum>=W.speed_sum.quantile(.75)]
over(hi_spd,"top-25% team speed"); over(hi_spd[hi_spd.dome==1],"top-25% speed AND dome"); over(W[(W.speed_sum>=W.speed_sum.quantile(.6))&(W.dome==1)],"fast(top40%) AND dome")
