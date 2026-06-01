"""
b72b — HONEST OUT-OF-SAMPLE teaser backtest.

The b72 results looked great but had selection bias: bucket eligibility was chosen on the
SAME 2018-2025 sample that we then tested 2024+2025 against. This script fixes that:
  - Buckets are calibrated on 2018-2023 ONLY
  - Eligibility rules are frozen at that point
  - 2024+2025 are pure held-out test

If the OOS performance still clears -120, the strategy is real. If it collapses, the b72
result was just selection bias.

Also adds:
  - Realistic TOP-N teaser selection per week (operational sizing)
  - Push handling (demote 2-team to 1-team at original odds)
  - 6.5-pt teaser at -130 comparison
"""
import os, sys, warnings
from itertools import combinations
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor
from forecast_harness import build
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

# ---------- STEP 1: calibrate buckets on 2018-2023 ONLY ------------------------
ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
ma["actual_margin"] = ma.home_score - ma.away_score
ma_calib = ma[(ma.season<=2023) & (ma.week>=4)].copy()
# In 2018-2022 we use CLOSE spread; in 2023 we use OPEN. Same merge pattern as b71b.
g_c = ma_calib.merge(od[["season","home_ab","away_ab","open_spread"]], on=["season","home_ab","away_ab"], how="left")
g_c["bet_spread"] = g_c.open_spread.fillna(g_c.home_spread)
g_c["home_t6"] = (g_c.actual_margin + g_c.bet_spread + 6 > 0).astype(float)
g_c.loc[g_c.actual_margin+g_c.bet_spread+6==0,"home_t6"]=np.nan
g_c["away_t6"] = (g_c.actual_margin + g_c.bet_spread - 6 < 0).astype(float)
g_c.loc[g_c.actual_margin+g_c.bet_spread-6==0,"away_t6"]=np.nan

# All candidate buckets (broad — we'll discover which ones qualify on 2018-2023 alone)
candidate_buckets = [
    (-14,-10.5,"HOME"),(-14,-10.5,"AWAY"),
    (-10,-9,"HOME"),(-10,-9,"AWAY"),
    (-8.5,-7.5,"HOME"),(-8.5,-7.5,"AWAY"),
    (-7,-6,"HOME"),(-7,-6,"AWAY"),
    (-5.5,-4,"HOME"),(-5.5,-4,"AWAY"),
    (-3.5,-3,"HOME"),(-3.5,-3,"AWAY"),
    (-2.5,-1.5,"HOME"),(-2.5,-1.5,"AWAY"),
    (-1,1,"HOME"),(-1,1,"AWAY"),
    (1.5,2.5,"HOME"),(1.5,2.5,"AWAY"),
    (3,3.5,"HOME"),(3,3.5,"AWAY"),
    (4,5.5,"HOME"),(4,5.5,"AWAY"),
    (6,7,"HOME"),(6,7,"AWAY"),
    (7.5,8.5,"HOME"),(7.5,8.5,"AWAY"),
    (9,10,"HOME"),(9,10,"AWAY"),
    (10.5,14,"HOME"),(10.5,14,"AWAY"),
]
rows=[]
for lo,hi,side in candidate_buckets:
    sub = g_c[(g_c.bet_spread>=lo)&(g_c.bet_spread<=hi)]
    col = "home_t6" if side=="HOME" else "away_t6"
    won = sub[col].dropna(); n=len(won); k=int(won.sum())
    if n<30: continue
    lo_ci,hi_ci = wilson_ci(k,n)
    rows.append({"sp_lo":lo,"sp_hi":hi,"side":side,"n":n,"hit":k/n,"lo_ci":lo_ci,"hi_ci":hi_ci})
calib = pd.DataFrame(rows).sort_values("hit", ascending=False)

L(f"\n{'='*92}\nSTEP 1: Bucket calibration on 2018-2023 (training fold for eligibility decisions)\n{'='*92}")
L(f"{'bucket':18s} {'side':>5s} {'n':>4s} {'hit%':>6s} {'lo_ci':>7s} {'eligibility':>14s}")
for _,r in calib.iterrows():
    if r.lo_ci>=0.7385: tier=1; tag="TIER1 @-120"
    elif r.lo_ci>=0.724: tier=2; tag="TIER2 @-110"
    elif r.hit>=0.7385 and r.lo_ci>=0.65: tier=3; tag="TIER3 pool@-120"
    else: tier=99; tag="reject"
    L(f"  {r.sp_lo:+5.1f}..{r.sp_hi:+5.1f}  {r.side:>5s}  {int(r.n):4d}  {r.hit*100:5.1f}%  {r.lo_ci*100:5.1f}%   {tag}")

# Define ELIGIBLE = anything with lo_ci >= 0.72 (clears -110 conservatively) OR hit >= 0.74 with lo_ci >= 0.65
def get_eligible(calib):
    out=[]
    for _,r in calib.iterrows():
        if r.lo_ci>=0.7385:   tier=1
        elif r.lo_ci>=0.724:  tier=2
        elif r.hit>=0.7385 and r.lo_ci>=0.65:  tier=3
        else: continue
        out.append({"sp_lo":r.sp_lo,"sp_hi":r.sp_hi,"side":r.side,"tier":tier,"p_cal":r.hit,"n":int(r.n)})
    return out
ELIGIBLE = get_eligible(calib)
L(f"\nFinal eligibility list (T1/T2/T3): {len(ELIGIBLE)} buckets")
for e in ELIGIBLE:
    L(f"  T{e['tier']}: open_spread {e['sp_lo']:+.1f}..{e['sp_hi']:+.1f}  {e['side']:>4s} tease  cal_p={e['p_cal']*100:.1f}%  n={e['n']}")

# ---------- STEP 2: walk-forward b70 regression for 2024/2025 test ------------
m, BASE = build()
m["actual_margin"] = m.home_score - m.away_score
W = m[m.week>=4].copy(); W["pred_margin"]=np.nan
for Y in [2024,2025]:
    tr = W[W.season<Y].dropna(subset=["actual_margin"]+BASE)
    reg = HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=300,
        l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[BASE], tr.actual_margin)
    W.loc[W.season==Y,"pred_margin"] = reg.predict(W[W.season==Y][BASE])

g = W[W.season.isin([2024,2025])].merge(
    od[["season","home_ab","away_ab","open_spread","close_spread"]],
    on=["season","home_ab","away_ab"], how="inner").dropna(subset=["pred_margin","open_spread"])

# ---------- STEP 3: leg generation ---------------------------------------------
def classify(open_spread):
    out=[]
    for e in ELIGIBLE:
        if e["sp_lo"]<=open_spread<=e["sp_hi"]:
            out.append(e)
    return out

legs=[]
for _,r in g.iterrows():
    for e in classify(r.open_spread):
        market_margin = -r.open_spread
        if e["side"]=="HOME":
            agrees = r.pred_margin > market_margin
            teased = r.open_spread + 6
            win = r.actual_margin + teased > 0
            push = r.actual_margin + teased == 0
            # 6.5-pt variant
            teased65 = r.open_spread + 6.5
            win65 = r.actual_margin + teased65 > 0
            push65 = r.actual_margin + teased65 == 0
        else:
            agrees = r.pred_margin < market_margin
            teased = r.open_spread - 6
            win = r.actual_margin + teased < 0
            push = r.actual_margin + teased == 0
            teased65 = r.open_spread - 6.5
            win65 = r.actual_margin + teased65 < 0
            push65 = r.actual_margin + teased65 == 0
        legs.append({"season":int(r.season),"week":int(r.week),"home_ab":r.home_ab,"away_ab":r.away_ab,
                     "open_spread":r.open_spread,"side":e["side"],"tier":e["tier"],"p_cal":e["p_cal"],
                     "model_agrees":bool(agrees),"pred_margin":r.pred_margin,
                     "win6":(np.nan if push else int(win)),"push6":push,
                     "win65":(np.nan if push65 else int(win65)),"push65":push65})
ldf = pd.DataFrame(legs)
L(f"\n{'='*92}\nSTEP 2-3: OOS leg generation (2024+2025, eligibility frozen at 2018-2023 calibration)\n{'='*92}")
L(f"[legs] {len(ldf)} total candidate legs in OOS sample")
L(f"  by tier: {ldf.tier.value_counts().sort_index().to_dict()}")
L(f"  model_agrees: {ldf.model_agrees.sum()}/{len(ldf)} = {ldf.model_agrees.mean()*100:.1f}%")

# ---------- STEP 4: single-leg performance OOS ---------------------------------
L(f"\nSingle-leg hit % OOS by tier (the honest validation):")
for tier in sorted(ldf.tier.unique()):
    sub = ldf[ldf.tier==tier]; w = sub.win6.dropna(); n=len(w); k=int(w.sum())
    if n>0:
        lo,hi = wilson_ci(k,n)
        L(f"  TIER {tier} (all):       n={n:3d}  hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
    subm = sub[sub.model_agrees]; wm = subm.win6.dropna(); nm=len(wm); km=int(wm.sum())
    if nm>0:
        lom,him = wilson_ci(km,nm)
        L(f"  TIER {tier} (+ model):   n={nm:3d}  hit={km}/{nm}={km/nm*100:.1f}% CI[{lom*100:.0f},{him*100:.0f}]")

# Per-season
L(f"\nPer-season OOS (all eligible legs):")
for Y in [2024,2025]:
    sy = ldf[ldf.season==Y]; w = sy.win6.dropna()
    if len(w)>0:
        n,k=len(w),int(w.sum()); lo,hi=wilson_ci(k,n)
        L(f"  {Y}: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")

# ---------- STEP 5: 2-team teaser backtest with push handling ----------------
def grade_2team(df, win_col, push_col, payoff, label):
    """Push handling: 2-team teaser with one push becomes a single bet at original odds.
       Conservative: assume the single-leg portion grades at -110 (single-bet, NOT teased)."""
    pairs=[]
    for (season,week), grp in df.groupby(["season","week"]):
        for i,j in combinations(grp.index, 2):
            l1,l2 = grp.loc[i], grp.loc[j]
            if (l1.home_ab==l2.home_ab) and (l1.away_ab==l2.away_ab): continue   # same game
            w1, p1 = (l1[win_col], l1[push_col])
            w2, p2 = (l2[win_col], l2[push_col])
            if p1 and p2: pnl=0; both=None
            elif p1:
                # leg2 alone graded at standard tease single -110 (no leverage)
                pnl = (100/110 if w2==1 else (-1 if w2==0 else 0)); both=None
            elif p2:
                pnl = (100/110 if w1==1 else (-1 if w1==0 else 0)); both=None
            else:
                both = int(w1==1 and w2==1)
                pnl = payoff if both==1 else -1.0
            pairs.append({"season":season,"week":week,"both":both,"pnl":pnl,
                          "tier1":int(l1.tier),"tier2":int(l2.tier),
                          "m1":bool(l1.model_agrees),"m2":bool(l2.model_agrees)})
    return pd.DataFrame(pairs)

L(f"\n{'='*92}\nSTEP 5: 2-TEAM TEASER BACKTEST (OOS, push-handled)\n{'='*92}")

configs = [
    ("ALL eligible legs",            ldf),
    ("ALL + model agreement",        ldf[ldf.model_agrees]),
    ("TIER 1 only",                  ldf[ldf.tier==1]),
    ("TIER 1 + model agreement",     ldf[(ldf.tier==1)&(ldf.model_agrees)]),
    ("TIER 1+2",                     ldf[ldf.tier.isin([1,2])]),
    ("TIER 1+2 + model agreement",   ldf[(ldf.tier.isin([1,2]))&(ldf.model_agrees)]),
]

L(f"\nPricing: -120 (payoff $0.833 per $1; joint breakeven 54.5%)\n")
L(f"{'config':40s} {'pairs':>6s} {'both_hit':>10s} {'CI':>11s} {'ROI':>7s} {'units':>8s}")
results={}
for label, sub in configs:
    if len(sub)<2: continue
    p = grade_2team(sub, "win6", "push6", 100/120, label)
    both = p.dropna(subset=["both"]); n=len(both); k=int(both.both.sum()) if n>0 else 0
    if n>0:
        lo,hi = wilson_ci(k,n)
        roi = p.pnl.mean()*100
        L(f"  {label:40s} {n:6d}  {k}/{n}={k/n*100:.1f}%  [{lo*100:.0f},{hi*100:.0f}]  {roi:+5.1f}%  {p.pnl.sum():+7.1f}")
        results[label]=p

# Per-season for top config
top_label="TIER 1 + model agreement"
if top_label in results:
    L(f"\nPer-season for '{top_label}' @ -120:")
    p = results[top_label]
    for Y in [2024,2025]:
        sy = p[p.season==Y]
        n=len(sy.dropna(subset=["both"])); k=int(sy.both.sum()) if n>0 else 0
        roi = sy.pnl.mean()*100 if len(sy)>0 else 0
        L(f"  {Y}: n={n} both_hit={k}/{n}={k/n*100 if n>0 else 0:.1f}% ROI={roi:+.1f}%")

# 6.5-pt @ -130 comparison
L(f"\nPricing: -130 6.5-pt teaser (payoff $0.769 per $1; joint breakeven 56.5%)\n")
L(f"{'config':40s} {'pairs':>6s} {'both_hit':>10s} {'CI':>11s} {'ROI':>7s} {'units':>8s}")
for label, sub in configs:
    if len(sub)<2: continue
    p = grade_2team(sub, "win65", "push65", 100/130, label)
    both = p.dropna(subset=["both"]); n=len(both); k=int(both.both.sum()) if n>0 else 0
    if n>0:
        lo,hi = wilson_ci(k,n)
        roi = p.pnl.mean()*100
        L(f"  {label:40s} {n:6d}  {k}/{n}={k/n*100:.1f}%  [{lo*100:.0f},{hi*100:.0f}]  {roi:+5.1f}%  {p.pnl.sum():+7.1f}")

# ---------- STEP 6: TOP-N realistic operational sizing -----------------------
L(f"\n{'='*92}\nSTEP 6: REALISTIC OPERATIONAL SIZING (top-N per week, not all combos)\n{'='*92}")
L(f"\nStrategy: each week, rank candidate legs by (tier, model_agrees, p_cal). Pair top 2.")

def rank_key(row):
    # lower tier number = stronger; model_agrees=True is better
    return (row.tier, not row.model_agrees, -row.p_cal)

records=[]
for (season,week), grp in ldf.groupby(["season","week"]):
    grp = grp.copy()
    grp["_rk"] = grp.apply(rank_key, axis=1)
    grp = grp.sort_values("_rk")
    if len(grp)<2: continue
    top2 = grp.head(2)
    # avoid same-matchup
    if top2.iloc[0].home_ab==top2.iloc[1].home_ab and top2.iloc[0].away_ab==top2.iloc[1].away_ab:
        if len(grp)>=3: top2 = grp.iloc[[0,2]]
        else: continue
    l1,l2 = top2.iloc[0], top2.iloc[1]
    w1,p1 = l1.win6, l1.push6; w2,p2 = l2.win6, l2.push6
    if p1 and p2: pnl=0; both=None
    elif p1: pnl=(100/110 if w2==1 else (-1 if w2==0 else 0)); both=None
    elif p2: pnl=(100/110 if w1==1 else (-1 if w1==0 else 0)); both=None
    else:
        both = int(w1==1 and w2==1)
        pnl = (100/120) if both==1 else -1.0
    records.append({"season":season,"week":week,
                    "leg1":f"T{l1.tier}/{l1.side}/{l1.open_spread:+g}",
                    "leg2":f"T{l2.tier}/{l2.side}/{l2.open_spread:+g}",
                    "both":both,"pnl":pnl,
                    "model1":bool(l1.model_agrees),"model2":bool(l2.model_agrees)})
opx = pd.DataFrame(records)
both = opx.dropna(subset=["both"]); n=len(both); k=int(both.both.sum()) if n>0 else 0
roi = opx.pnl.mean()*100
lo,hi = wilson_ci(k,n) if n>0 else (0,0)
L(f"\nTop-2 per week (one teaser/week), @ -120:")
L(f"  weeks: {len(opx)}  both_hit: {k}/{n}={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+.1f}%  units={opx.pnl.sum():+.1f}")
L(f"\nPer-season:")
for Y in [2024,2025]:
    sy = opx[opx.season==Y]; sb = sy.dropna(subset=["both"])
    if len(sb)>0:
        n,k = len(sb), int(sb.both.sum())
        L(f"  {Y}: {len(sy)} weeks, hit={k}/{n}={k/n*100:.1f}% ROI={sy.pnl.mean()*100:+.1f}% units={sy.pnl.sum():+.1f}")

L(f"\nSample top-2 per week (first 12 weeks):")
for _,r in opx.head(12).iterrows():
    res = "WIN" if r.both==1 else ("PUSH" if r.both is None else "loss")
    L(f"  {r.season} W{int(r.week):2d}: {r.leg1:18s} + {r.leg2:18s}  -> {res:5s}  pnl={r.pnl:+.2f}")

L(f"\n{'-'*92}\nHONEST OOS verdict:")
L(f"  Eligibility frozen at 2018-2023 calibration. 2024+2025 are pure held-out test.")
L(f"  Top-2-per-week operational ROI tells the realistic story.")
