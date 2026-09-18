#!/usr/bin/env python3
"""SIGNAL x POWER-RATINGS CONFLUENCE (owner 2026-09-17).
For every graded signal pick in the ledger (2023-25), does the power ratings model point the
SAME way (align), the OPPOSITE way (oppose), or have no strong view (neutral)? Graded by the
ledger's own win / roi_u. Split by market and by rule family: `sides_model` IS the old production
sides model, so that row is production-vs-power-ratings agreement; everything else is the
situational spot rules — the 'signals as direction motivators' question."""
import glob, io, contextlib, importlib.util as iu
import numpy as np, pandas as pd
spec=iu.spec_from_file_location("pm","power_ratings_modulators.py"); PM=iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(PM)
import os
# POWER_G=<parquet> swaps in a saved fit (power_ratings_anchor_check.py writes the close- and
# OPEN-anchored versions); the default PM.G is close-anchored and CLV-inflated vs the opener
G=pd.read_parquet(os.environ["POWER_G"]) if os.environ.get("POWER_G") else PM.G.copy()
print("G source:", os.environ.get("POWER_G","PM.G (close-anchored)"))
model=G[["season","week","team","opp","e","te"]].rename(columns={"team":"home_ab","opp":"away_ab","e":"sp_edge_home","te":"tot_edge"})
led=pd.concat([pd.read_csv(f) for f in glob.glob("out/forecast_ledger_202[345].csv")])
led=led[led.win.notna()&led.side.notna()].copy()
led=led.merge(model,on=["season","week","home_ab","away_ab"],how="inner")
print(f"graded signal picks joined to power ratings: {len(led)} of {sum(len(pd.read_csv(f)) for f in glob.glob('out/forecast_ledger_202[345].csv'))}")
def conf(r,thr_sp,thr_to):
    if r.market=="spread":
        sig_home=(r.bet_home==1); mh=r.sp_edge_home>0; strong=abs(r.sp_edge_home)>=thr_sp
    elif r.market=="total":
        sig_home=("OVER" in str(r.side).upper()); mh=r.tot_edge>0; strong=abs(r.tot_edge)>=thr_to
    else: return "n/a"
    return ("align" if sig_home==mh else "oppose") if strong else "neutral"
def wr(d):
    w=d.win.astype(float); z=(w.mean()-.5)*2*np.sqrt(len(w))
    return f"{int(w.sum()):3d}-{int(len(w)-w.sum()):3d} ({100*w.mean():5.1f}%)  z={z:+.2f}  {d.roi_u.sum():+6.1f}u  n={len(d)}"
led["fam"]=np.where(led.rule=="sides_model","PRODUCTION sides_model","SPOT RULES (situational)")
for thr_sp,thr_to,lab in ((2.0,3.0,"model thresholds (spread>=2, total>=3)"),(1.0,1.5,"loose (spread>=1, total>=1.5)")):
    led["conf"]=led.apply(lambda r: conf(r,thr_sp,thr_to),axis=1)
    print("\n"+"="*100); print(f"CONFLUENCE @ {lab}"); print("="*100)
    print(f"  ALL signal picks (baseline)             {wr(led)}")
    for fam in ("PRODUCTION sides_model","SPOT RULES (situational)"):
        for mkt in ("spread","total"):
            d=led[(led.fam==fam)&(led.market==mkt)]
            if len(d)<15: continue
            print(f"\n  {fam} — {mkt}   baseline {wr(d)}")
            for c in ("align","oppose","neutral"):
                dd=d[d.conf==c]
                if len(dd)>=12: print(f"      model {c:8s}  {wr(dd)}")
# by rule, at model thresholds
led["conf"]=led.apply(lambda r: conf(r,2.0,3.0),axis=1)
print("\n"+"="*100); print("BY RULE — align vs oppose (n>=8 each side shown)"); print("="*100)
print(f"  {'rule':28s} {'mkt':6s} {'baseline':>22s} | {'ALIGN':>22s} | {'OPPOSE':>22s}")
for (rule,mkt),d in led.groupby(["rule","market"]):
    if len(d)<20: continue
    a=d[d.conf=="align"]; o=d[d.conf=="oppose"]
    f=lambda x: f"{100*x.win.mean():5.1f}% ({len(x):3d})" if len(x)>=8 else f"{'--':>12s}"
    print(f"  {rule:28s} {mkt:6s} {100*d.win.mean():5.1f}% ({len(d):3d}) {d.roi_u.sum():+6.1f}u | {f(a):>22s} | {f(o):>22s}")
# the inverse question: does a spot rule firing change the MODEL's own hit rate?
print("\n"+"="*100); print("INVERSE — the model's own picks, split by whether a SPOT RULE agrees / opposes / is silent"); print("="*100)
spot=led[led.fam=="SPOT RULES (situational)"]
for mkt,col,thr,wcol,pcol in (("spread","e",2,"sp_won","sp_push"),("total","te",3,"to_won","to_push")):
    mp=G[(G[col].abs()>=thr)&~G[pcol]].copy()
    s=spot[spot.market==mkt].copy()
    s["sig_dir"]=np.where(mkt=="spread",np.where(s.bet_home==1,1,-1),np.where(s.side.str.upper().str.contains("OVER"),1,-1))
    s=s.groupby(["season","week","home_ab","away_ab"]).sig_dir.mean().reset_index()   # net signal direction per game
    mp=mp.merge(s,left_on=["season","week","team","opp"],right_on=["season","week","home_ab","away_ab"],how="left")
    mp["model_dir"]=np.sign(mp[col])
    mp["state"]=np.where(mp.sig_dir.isna(),"no spot rule",np.where(np.sign(mp.sig_dir)==mp.model_dir,"spot rule AGREES","spot rule OPPOSES"))
    print(f"\n  model {mkt} picks (|gap|>={thr}):")
    for st in ("spot rule AGREES","spot rule OPPOSES","no spot rule"):
        d=mp[mp.state==st]
        if len(d)>=10:
            w=d[wcol]; z=(w.mean()-.5)*2*np.sqrt(len(w))
            print(f"      {st:18s} {100*w.mean():5.1f}%  z={z:+.2f}  n={len(d)}   "+" ".join(f"{yr}:{100*d[d.season==yr][wcol].mean():.0f}" for yr in (2023,2024,2025) if (d.season==yr).sum()>=6))
