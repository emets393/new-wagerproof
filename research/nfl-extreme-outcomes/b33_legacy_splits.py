"""
Legacy EPA model (real 2025 preds) — full SPLITS: confidence bands, home/away pick, favorite/underdog pick,
and the same for over/under. Pick-accuracy vs CLOSE (the model's native target) + a bettable lens vs OPENER.
2025 only (n~236) -> small cells, Wilson CIs shown, flag thin n.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from fetch import cache, fetch_table
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
leg=cache("nfl_predictions_epa", lambda: fetch_table("nfl_predictions_epa"))
for c in ["home_away_spread_cover_prob","ou_result_prob","home_away_ml_prob"]: leg[c]=pd.to_numeric(leg[c],errors="coerce")
leg["as_of_ts"]=pd.to_datetime(leg["as_of_ts"],errors="coerce",utc=True)
leg=leg.sort_values("as_of_ts").groupby("unique_id",as_index=False).first().rename(
    columns={"home_away_spread_cover_prob":"p_sp","ou_result_prob":"p_ou"})
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score
m["over_win"]=(m.actual_total>m.nv_total_line).astype(float); m.loc[m.actual_total==m.nv_total_line,"over_win"]=np.nan
m["primetime_i"]=m.primetime.fillna(0).astype(int)
g=m[m.season==2025].merge(leg[["unique_id","p_sp","p_ou"]],on="unique_id",how="inner")
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
g=g.merge(od[["season","home_ab","away_ab","open_spread","open_total"]],on=["season","home_ab","away_ab"],how="left")
g["home_cover_open"]=(g.actual_margin+g.open_spread>0).astype(float); g.loc[g.actual_margin+g.open_spread==0,"home_cover_open"]=np.nan
g["over_open"]=(g.actual_total>g.open_total).astype(float); g.loc[g.actual_total==g.open_total,"over_open"]=np.nan
L(f"[data] 2025 games w/ legacy preds: {len(g)}  (home_cover vs close avail: {g.home_cover.notna().sum()}, openers: {g.open_spread.notna().sum()})")

def row(label, correct_series):
    c=correct_series.dropna(); n=len(c); k=int(c.sum()); lo,hi=wilson_ci(k,n) if n else (0,0)
    flag=" (thin)" if n<25 else ""
    L(f"    {label:30s} {(k/n*100 if n else 0):5.1f}%  n={n:3d}  CI[{lo*100:.0f},{hi*100:.0f}]{flag}")

# ---------------- SPREAD ----------------
g["pick_home"]=g.p_sp>=0.5
g["sp_correct"]=np.where(g.pick_home, g.home_cover, 1-g.home_cover)          # pick correct vs CLOSE
g["conf"]=np.where(g.p_sp>=0.5, g.p_sp, 1-g.p_sp)                            # confidence magnitude
g["home_is_fav"]=g.home_spread<0
g["pick_on_fav"]=(g.pick_home & g.home_is_fav)|(~g.pick_home & ~g.home_is_fav)
L("\n"+"="*78); L("SPREAD — pick accuracy vs CLOSE"); L("="*78)
L("  by RAW probability band (p_sp; <.5 => picks AWAY, >.5 => picks HOME):")
for lo,hi in [(0,.3),(.3,.4),(.4,.5),(.5,.6),(.6,.7),(.7,1.01)]:
    s=g[(g.p_sp>=lo)&(g.p_sp<hi)]; row(f"p_sp[{lo:.1f}-{hi:.2f}) acc", s.sp_correct)
L("  by CONFIDENCE magnitude (calibration — higher should = more accurate):")
for lo,hi in [(.5,.6),(.6,.7),(.7,.8),(.8,1.01)]:
    s=g[(g.conf>=lo)&(g.conf<hi)]; row(f"conf[{lo:.1f}-{hi:.2f}) acc", s.sp_correct)
L("  HOME pick vs AWAY pick:")
row("picked HOME", g[g.pick_home].sp_correct); row("picked AWAY", g[~g.pick_home].sp_correct)
L("  FAVORITE pick vs UNDERDOG pick:")
row("picked FAVORITE", g[g.pick_on_fav].sp_correct); row("picked UNDERDOG", g[~g.pick_on_fav].sp_correct)
L("  PRIMETIME vs non-primetime:")
row("primetime", g[g.primetime_i==1].sp_correct); row("non-primetime", g[g.primetime_i==0].sp_correct)
L("  bettable lens — high-confidence (conf>=.6) ATS vs OPENER:")
hc=g[g.conf>=.6]; won=np.where(hc.pick_home, hc.home_cover_open, 1-hc.home_cover_open); row("conf>=.6 ATS vs open", pd.Series(won))

# ---------------- OVER/UNDER ----------------
g["pick_over"]=g.p_ou>=0.5
g["ou_correct"]=np.where(g.pick_over, g.over_win, 1-g.over_win)
g["conf_ou"]=np.where(g.p_ou>=0.5, g.p_ou, 1-g.p_ou)
L("\n"+"="*78); L("OVER/UNDER — pick accuracy vs CLOSE"); L("="*78)
L("  by RAW probability band (p_ou; <.5 => picks UNDER, >.5 => picks OVER):")
for lo,hi in [(0,.3),(.3,.4),(.4,.5),(.5,.6),(.6,.7),(.7,1.01)]:
    s=g[(g.p_ou>=lo)&(g.p_ou<hi)]; row(f"p_ou[{lo:.1f}-{hi:.2f}) acc", s.ou_correct)
L("  by CONFIDENCE magnitude:")
for lo,hi in [(.5,.6),(.6,.7),(.7,1.01)]:
    s=g[(g.conf_ou>=lo)&(g.conf_ou<hi)]; row(f"conf[{lo:.1f}-{hi:.2f}) acc", s.ou_correct)
L("  OVER pick vs UNDER pick:")
row("picked OVER", g[g.pick_over].ou_correct); row("picked UNDER", g[~g.pick_over].ou_correct)
L("  PRIMETIME O/U:")
row("primetime O/U", g[g.primetime_i==1].ou_correct)
L("  bettable lens — high-confidence (conf>=.6) O/U vs OPENER:")
ho=g[g.conf_ou>=.6]; won=np.where(ho.pick_over, ho.over_open, 1-ho.over_open); row("conf>=.6 O/U vs open", pd.Series(won))
