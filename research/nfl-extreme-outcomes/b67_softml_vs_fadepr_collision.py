"""
b67: Collision analysis between two tight-game signals:
  - tight_soft_ml_fade_home (b66): always picks AWAY when home ML is soft vs spread
  - fade_pr_in_tight_game (b65): picks AGAINST better-PR team

Finding: when both fire and DISAGREE, soft_ml wins 6/7 = 85.7% historically.
Soft ML pricing trumps PR-vs-spread disagreement.
Resolution: when both fire on opposite sides, take the soft_ml pick (skip fade_pr).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"]=m.home_score-m.away_score
m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr
g=m[["season","week","home_ab","away_ab","home_score","away_score","actual_margin","pr_diff","home_predictive_pr","away_predictive_pr"]].merge(
    od[["season","home_ab","away_ab","open_spread","close_spread","open_ml_home","open_ml_away"]],
    on=["season","home_ab","away_ab"],how="inner")
def ml_p(ml):
    if pd.isna(ml) or ml==0: return np.nan
    return -ml/(-ml+100) if ml<0 else 100/(ml+100)
g["ml_h_nv_open"]=g.open_ml_home.apply(ml_p)/(g.open_ml_home.apply(ml_p)+g.open_ml_away.apply(ml_p))
m["fav_won"]=((m.home_spread<0)&(m.actual_margin>0))|((m.home_spread>0)&(m.actual_margin<0))
m["sp_b"]=(m.home_spread.abs()/0.5).round()*0.5
sp_lookup=dict(zip(m.groupby("sp_b").fav_won.mean().index,m.groupby("sp_b").fav_won.mean().values))
def sp2(s): return sp_lookup.get(round(abs(s)/0.5)*0.5,0.5) if pd.notna(s) else np.nan
g["sp_imp_h"]=g.open_spread.apply(lambda s: sp2(s) if s<0 else (1-sp2(s)) if s>0 else 0.5)
g["div_h"]=g.ml_h_nv_open - g.sp_imp_h

g["fires_softml"]=(g.open_spread.abs()<=3)&(g.div_h<=-0.04)
g["fires_fadepr"]=(g.open_spread.abs()<=1.5)&(g.pr_diff.abs()>=3)
g["softml_pick"]="AWAY"
g["fadepr_pick"]=np.where(g.pr_diff>0, "AWAY", "HOME")

both=g[(g.fires_softml==1)&(g.fires_fadepr==1)].copy()
both["agree"]=both.softml_pick==both.fadepr_pick
both["away_won_open"]=(both.actual_margin+both.open_spread<0).astype(int)
both.loc[both.actual_margin+both.open_spread==0,"away_won_open"]=np.nan

L(f"\n{'='*92}\nb67: COLLISION analysis — tight_soft_ml vs fade_pr_in_tight_game\n{'='*92}")
L(f"Total collisions (both fire): n={len(both)}")
L(f"  Agree (both pick same side): {both.agree.sum()}/{len(both)}")
L(f"  Disagree (clash):            {(~both.agree).sum()}/{len(both)}\n")
clash=both[~both.agree].copy()
n=len(clash); k=int(clash.away_won_open.dropna().sum())
if n>=3:
    lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    L(f"CLASH games (soft_ml=AWAY, fade_pr=HOME): n={n}")
    L(f"  AWAY (soft_ml) won: {k}/{n} = {k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+.1f}%")
    L(f"  HOME (fade_pr) won: {n-k}/{n} = {(n-k)/n*100:.1f}%")
agree=both[both.agree].copy()
if len(agree)>=1:
    L(f"\nAGREE games (both pick AWAY): n={len(agree)}")
    n=len(agree); k=int(agree.away_won_open.dropna().sum())
    if n>=3:
        lo,hi=wilson_ci(k,n)
        L(f"  AWAY won: {k}/{n} = {k/n*100:.1f}%")
    else:
        L(f"  AWAY won: {k}/{n} (too small to draw conclusion)")

L(f"\n{'-'*92}\nResolution rule: when both fire AND clash, TAKE THE soft_ml pick (skip fade_pr).")
L(f"Mechanism: book's own ML inconsistency (soft_ml signal) is a stronger tell than our PR-vs-spread disagreement.")
