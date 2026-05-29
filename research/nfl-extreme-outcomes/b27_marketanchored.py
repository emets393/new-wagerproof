"""
STEP 2 — the job a sim CAN do: a MARKET-ANCHORED distribution engine.
The raw sim can't beat the line (b26: predicts actual margin 0.30 vs market 0.458 -> GIGO). So instead
trust the market's MEAN (spread/total) and use a calibrated distribution for DERIVATIVE pricing.
Test the one derivative market we actually have odds for: MONEYLINE vs the spread-implied win prob.
  - convert market spread -> P(home win) via Normal(margin=-spread, sd=13.5)
  - de-vig the moneyline -> market's win prob
  - bet ML where the spread-implied prob disagrees; grade vs CLOSE ML + OPEN ML, held-out 2024-25 (ROI at price)
Also demonstrate the engine: shift the total distribution for our PROVEN edges (key-receiver-out / wind).
"""
import os, sys, warnings, math
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"]=m.home_score-m.away_score
def ncdf(x): return 0.5*(1+math.erf(x/math.sqrt(2)))
def ml_prob(ml): return (-ml)/(-ml+100) if ml<0 else 100/(ml+100)     # implied prob (w/ vig)
def ml_payout(ml): return (ml/100) if ml>0 else (100/(-ml))           # profit per 1u on win
SD=13.5
d=m[m.week>=4].merge(od[["season","home_ab","away_ab","open_spread","close_spread","open_ml_home","close_ml_home","open_ml_away","close_ml_away"]],on=["season","home_ab","away_ab"],how="inner")
d=d[d.season.isin([2024,2025])].dropna(subset=["close_spread","close_ml_home","close_ml_away","actual_margin"]).copy()
d["spread_pwin"]=d.close_spread.apply(lambda s: ncdf((-s)/SD))        # spread-implied P(home win)
# de-vig the close moneyline
ph=d.close_ml_home.apply(ml_prob); pa=d.close_ml_away.apply(ml_prob); d["ml_pwin"]=ph/(ph+pa)
d["edge"]=d.spread_pwin-d.ml_pwin
d["home_won"]=(d.actual_margin>0).astype(int); d=d[d.actual_margin!=0]
L("="*88); L("MARKET-ANCHORED SIM: spread-implied win prob vs the MONEYLINE (derivative-market edge?)"); L("="*88)
L(f"  n={len(d)}  mean |spread_pwin - ml_pwin| = {d.edge.abs().mean()*100:.2f}%  (small = ML already consistent w/ spread)")
for thr in [0.02,0.03,0.05]:
    bh=d[d.edge>=thr]; ba=d[d.edge<=-thr]
    # bet home ML when spread says home more likely than ML implies; away ML opposite. ROI at the price.
    roi=[]; w=0; n=0
    for _,r in bh.iterrows(): n+=1; w+= (r.home_won); roi.append(ml_payout(r.close_ml_home) if r.home_won else -1)
    for _,r in ba.iterrows(): n+=1; w+= (1-r.home_won); roi.append(ml_payout(r.close_ml_away) if not r.home_won else -1)
    if n: lo,hi=wilson_ci(w,n); L(f"  |edge|>={thr*100:.0f}%: bets={n} win%={w/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={np.mean(roi)*100:+.1f}%")
    else: L(f"  |edge|>={thr*100:.0f}%: no bets")

# DEMONSTRATE the engine value: reprice the TOTAL distribution when a proven edge fires
L("\n"+"="*88); L("ENGINE DEMO — coherent derivative pricing around the market (what the sim is FOR)"); L("="*88)
L("  Given market total T and sd~10, the sim yields any derivative price coherently. Examples:")
for T in [44.0, 47.5, 51.0]:
    p_over_3 = 1-ncdf((T+3-T)/10.0); p_team28 = 1-ncdf((28-T/2)/7.5)
    L(f"    total={T}: P(OVER by 3+ alt)={p_over_3*100:.0f}%  P(a team scores 28+)={p_team28*100:.0f}%")
L("  When key-receiver-out fires (proven OVER edge ~+1.7 exp pts the market under-prices), shift T up ->")
L("  the sim reprices OVER, team-totals, and alt-overs together; bet where the book's derivative lags.")
L("  (NOTE: monetizing alt-lines/team-totals needs those ODDS, which we don't currently have.)")
