"""
H/W test 4 — attributes as MODEL features (not standalone spots).
Add team speed + trench size/strength differentials to the locked sides model (on top of OVR/injury/schedule)
and measure the marginal held-out-vs-opener lift via ablation. Reuses b17's base+Madden frame & harness.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b17_madden_features as B   # builds B.m, B.BASE, B.MAD, B.walkfwd, B.grade, B.OD, B.key
DATA=B.DATA; L=print
A=pd.read_parquet(os.path.join(DATA,"madden_attributes.parquet"))
A["ab"]=[B.to_ab(t,s) for t,s in zip(A.team,A.season)]; A=A.dropna(subset=["ab"])
OLp={'LT','LG','C','RG','RT'}; DLp={'LE','RE','DT','NT'}; SKp={'WR','HB','RB','TE','FB'}
def top(positions,n,col): return A[A.pos.isin(positions)].sort_values("ovr",ascending=False).groupby(["season","ab"]).head(n).groupby(["season","ab"])[col].mean()
team=pd.DataFrame({"ol_wt":top(OLp,5,"wt"),"dl_wt":top(DLp,4,"wt"),"ol_str":top(OLp,5,"strength"),
                   "dl_str":top(DLp,4,"strength"),"sk_speed":top(SKp,5,"speed")}).reset_index()
team["trench_wt"]=(team.ol_wt+team.dl_wt)/2; team["trench_str"]=(team.ol_str+team.dl_str)/2
m=B.m
for side,p in [("home","h_"),("away","a_")]:
    m=m.merge(team.rename(columns={"ab":f"{side}_ab","sk_speed":f"{p}sk_speed","trench_wt":f"{p}trench_wt","trench_str":f"{p}trench_str"})[["season",f"{side}_ab",f"{p}sk_speed",f"{p}trench_wt",f"{p}trench_str"]],on=["season",f"{side}_ab"],how="left")
m["speed_diff"]=m.h_sk_speed-m.a_sk_speed; m["trench_wt_diff"]=m.h_trench_wt-m.a_trench_wt; m["trench_str_diff"]=m.h_trench_str-m.a_trench_str
ATTR=["speed_diff","trench_wt_diff","trench_str_diff"]
for c in ATTR: m[c]=pd.to_numeric(m[c],errors="coerce")
B.m=m; W4=m[m.week>=4].copy()
def show(label,feats):
    n,h,lo,hi,roi=B.grade(B.walkfwd(W4,feats)); L(f"  {label:28s}: n={n} hit={h:.1f}% CI[{lo:.0f},{hi:.0f}] roi={roi:+.1f}%")
L("\n"+"="*92); L("T4  ATTRIBUTES as sides-model features (held-out 2024-25 vs opener, conf>=.03)"); L("="*92)
show("base (locked b14)",B.BASE)
show("base + Madden OVR/injury",B.BASE+B.MAD)
show("base + Madden + attributes",B.BASE+B.MAD+ATTR)
show("base + attributes only",B.BASE+ATTR)
