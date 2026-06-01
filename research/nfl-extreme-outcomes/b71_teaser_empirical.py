"""
b71 — TEASER MODEL Phase 1: empirical foundation (2018-2025).

GOAL
  Before building any model, establish the empirical ground truth for 6-pt NFL teasers:
    1) margin distribution — do key numbers (3, 7) still cluster?
    2) per-spread-bucket teaser leg hit % — where are the structural edges?
    3) Wong-spot validation — do classic -7.5/-8.5 favorites and +1.5/+2.5 dogs still hit 73%+?
    4) totals distribution + per-total-bucket teaser leg hit %
    5) residual std from b70 regression (validates the normal approximation we'll use in Phase 2)
    6) per-season breakdown (no hiding 2025 decay)

PAYOUT MATH (so we know breakevens)
  2-team 6pt @ -120  -> per-leg breakeven = sqrt(120/220) = 73.85%
  3-team 6pt @ +160  -> per-leg breakeven = (100/260)^(1/3) = 72.04%
  2-team 6.5pt @-130 -> per-leg breakeven = sqrt(130/230) = 75.16%

FRAMEWORK COMPLIANCE
  • Signal is the OPENING line. Grade vs OPENING line + 6.
  • Walk-forward for the b70 residual estimate (train Y<2024, residuals from 2024+2025 out-of-sample).
  • Push handling: tie at teased line counts as a push (excluded from hit %, treated as
    push in 2-team teaser grading per standard book rules).
  • Per-season breakdown alongside pooled.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor
from forecast_harness import build
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m, BASE = build()
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"] = m.home_score - m.away_score
m["actual_total"]  = m.home_score + m.away_score

# Merge OPENING lines (signal source for teasers)
g = m.merge(od[["season","home_ab","away_ab","open_spread","open_total","close_spread","close_total"]],
            on=["season","home_ab","away_ab"], how="inner")
g = g[(g.week>=4) & g.open_spread.notna() & g.open_total.notna()].copy()
L(f"\n[load] {len(g)} games {g.season.min()}-{g.season.max()}, week>=4 only")

# =================================================================================
# PART 1 — MARGIN DISTRIBUTION (validate key-number premise still holds)
# =================================================================================
L(f"\n{'='*92}\nPART 1: NFL margin distribution (do key numbers still cluster?)\n{'='*92}")
margins = g.actual_margin.abs()
total_n = len(margins)
L(f"All games (n={total_n}): % ending with abs margin = X")
for k in [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,17,21]:
    pct = (margins==k).mean()*100
    bar = "#"*int(pct/0.4)
    L(f"  |margin|={k:2d}: {pct:5.2f}%  {bar}")
# Key number aggregate
key_3 = (margins==3).sum(); key_7 = (margins==7).sum()
L(f"\nKey number presence:")
L(f"  margin = 3:  {key_3}/{total_n} = {key_3/total_n*100:.2f}%")
L(f"  margin = 7:  {key_7}/{total_n} = {key_7/total_n*100:.2f}%")
L(f"  Combined 3+7: {(key_3+key_7)/total_n*100:.2f}% of games")

# Per-season key-number rate (decay check)
L(f"\nKey number rate by season (variance check):")
for Y in sorted(g.season.unique()):
    sy = g[g.season==Y]
    k3 = (sy.actual_margin.abs()==3).sum()
    k7 = (sy.actual_margin.abs()==7).sum()
    L(f"  {Y}: n={len(sy):3d}  margin=3: {k3/len(sy)*100:4.1f}%  margin=7: {k7/len(sy)*100:4.1f}%  combined: {(k3+k7)/len(sy)*100:4.1f}%")

# =================================================================================
# PART 2 — TEASER LEG HIT % BY SPREAD BUCKET (the Wong analysis, modernized)
# =================================================================================
L(f"\n{'='*92}\nPART 2: 6-pt teaser leg hit % by opening spread bucket\n{'='*92}")
L("Reading: HOME -7.5 means home is favored by 7.5. HOME tease moves -7.5 -> -1.5.")
L("'HOME_TEASE' = bet home -spread, teased +6 (favorable). Wins if margin + open_spread + 6 > 0.")
L("'AWAY_TEASE' = bet away (+spread), teased +6.  Wins if -(margin + open_spread) + 6 > 0, i.e. margin + open_spread - 6 < 0.\n")

# Bucket the OPENING spread
g["home_tease_cover"] = (g.actual_margin + g.open_spread + 6 > 0).astype(float)
g.loc[g.actual_margin + g.open_spread + 6 == 0, "home_tease_cover"] = np.nan   # push
g["away_tease_cover"] = (g.actual_margin + g.open_spread - 6 < 0).astype(float)
g.loc[g.actual_margin + g.open_spread - 6 == 0, "away_tease_cover"] = np.nan

# Buckets (half-point granularity)
buckets = [(-14,-10.5),(-10,-9),(-8.5,-7.5),(-7,-6),(-5.5,-4),(-3.5,-3),(-2.5,-1.5),(-1,1),
           (1.5,2.5),(3,3.5),(4,5.5),(6,7),(7.5,8.5),(9,10),(10.5,14)]
L(f"{'spread bucket':18s} {'n':>4s}  {'HOME tease win%':>16s}  {'AWAY tease win%':>16s}  WONG")
L("-"*92)
for lo,hi in buckets:
    sub = g[(g.open_spread>=lo) & (g.open_spread<=hi)]
    if len(sub)<5: continue
    h_won = sub.home_tease_cover.dropna()
    a_won = sub.away_tease_cover.dropna()
    h_pct = h_won.mean()*100 if len(h_won) else np.nan
    a_pct = a_won.mean()*100 if len(a_won) else np.nan
    h_lo,h_hi = wilson_ci(int(h_won.sum()), len(h_won)) if len(h_won) else (0,0)
    a_lo,a_hi = wilson_ci(int(a_won.sum()), len(a_won)) if len(a_won) else (0,0)
    # Wong: HOME -7.5 to -8.5 (teased to -1.5/-2.5 crosses 3 AND 7); HOME +1.5 to +2.5 (teased to +7.5/+8.5)
    is_wong_home = (lo<=-7.5 and hi>=-8.5) or (lo>=1.5 and hi<=2.5)
    is_wong_away = (lo>=7.5 and hi<=8.5) or (lo<=-1.5 and hi>=-2.5)
    wong_tag = ""
    if is_wong_home: wong_tag = "<- WONG (home)"
    if is_wong_away: wong_tag = "<- WONG (away)"
    L(f"  {lo:+5.1f} to {hi:+5.1f}   {len(sub):4d}  {h_pct:5.1f}% [{h_lo*100:.0f},{h_hi*100:.0f}]   {a_pct:5.1f}% [{a_lo*100:.0f},{a_hi*100:.0f}]   {wong_tag}")

# Sharp focus on Wong-favorite range (-7.5 to -8.5)
L(f"\nWONG SPOT A — HOME favorites in -7.5 to -8.5 range, teased to -1.5/-2.5 (crosses 3 AND 7):")
wong_a = g[(g.open_spread>=-8.5) & (g.open_spread<=-7.5)]
n=len(wong_a); won = wong_a.home_tease_cover.dropna(); k=int(won.sum())
if n>0:
    lo,hi = wilson_ci(k, len(won)); roi_120 = (k * (100/120) - (len(won)-k))/len(won)*100
    L(f"  Pooled: n={n}  hit={k}/{len(won)}={k/len(won)*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
    L(f"  Per leg breakeven at -120 = 73.85% (2-team teaser)")
    L(f"  Per-season:")
    for Y in sorted(g.season.unique()):
        sy = wong_a[wong_a.season==Y]; sw=sy.home_tease_cover.dropna()
        if len(sw)>0: L(f"    {Y}: n={len(sy)}  hit={int(sw.sum())}/{len(sw)}={sw.mean()*100:.1f}%")

L(f"\nWONG SPOT B — HOME underdogs +1.5 to +2.5, teased to +7.5/+8.5 (crosses 3 AND 7):")
wong_b = g[(g.open_spread>=1.5) & (g.open_spread<=2.5)]
n=len(wong_b); won = wong_b.away_tease_cover.dropna()  # team is HOME but the +1.5 to +2.5 means HOME is dog
# Wait — Wong B: home is the DOG by 1.5/2.5. We tease the HOME side from +1.5 to +7.5.
won = wong_b.home_tease_cover.dropna(); k=int(won.sum())
if len(won)>0:
    lo,hi = wilson_ci(k, len(won))
    L(f"  Pooled: n={len(wong_b)}  hit={k}/{len(won)}={k/len(won)*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
    L(f"  Per-season:")
    for Y in sorted(g.season.unique()):
        sy = wong_b[wong_b.season==Y]; sw=sy.home_tease_cover.dropna()
        if len(sw)>0: L(f"    {Y}: n={len(sy)}  hit={int(sw.sum())}/{len(sw)}={sw.mean()*100:.1f}%")

L(f"\nWONG SPOT C — AWAY favorites in +7.5 to +8.5 (i.e. open_spread = +7.5/+8.5 means AWAY is fav by that),")
L("teased to +1.5/+2.5. Symmetric to A but for away favorites.")
wong_c = g[(g.open_spread>=7.5) & (g.open_spread<=8.5)]
won = wong_c.away_tease_cover.dropna(); k=int(won.sum())
if len(won)>0:
    lo,hi = wilson_ci(k, len(won))
    L(f"  Pooled: n={len(wong_c)}  hit={k}/{len(won)}={k/len(won)*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
    for Y in sorted(g.season.unique()):
        sy = wong_c[wong_c.season==Y]; sw=sy.away_tease_cover.dropna()
        if len(sw)>0: L(f"    {Y}: n={len(sy)}  hit={int(sw.sum())}/{len(sw)}={sw.mean()*100:.1f}%")

L(f"\nWONG SPOT D — AWAY underdogs (home favored by 1.5/2.5; away is dog +1.5/+2.5), teased to +7.5/+8.5:")
wong_d = g[(g.open_spread<=-1.5) & (g.open_spread>=-2.5)]
won = wong_d.away_tease_cover.dropna(); k=int(won.sum())
if len(won)>0:
    lo,hi = wilson_ci(k, len(won))
    L(f"  Pooled: n={len(wong_d)}  hit={k}/{len(won)}={k/len(won)*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
    for Y in sorted(g.season.unique()):
        sy = wong_d[wong_d.season==Y]; sw=sy.away_tease_cover.dropna()
        if len(sw)>0: L(f"    {Y}: n={len(sy)}  hit={int(sw.sum())}/{len(sw)}={sw.mean()*100:.1f}%")

# =================================================================================
# PART 3 — TOTALS DISTRIBUTION + TEASER LEG HIT % BY TOTAL BUCKET
# =================================================================================
L(f"\n{'='*92}\nPART 3: 6-pt totals teaser by opening total bucket\n{'='*92}")
g["over_tease_cover"]  = (g.actual_total > g.open_total - 6).astype(float)  # OVER teased DOWN by 6
g.loc[g.actual_total == g.open_total - 6, "over_tease_cover"] = np.nan
g["under_tease_cover"] = (g.actual_total < g.open_total + 6).astype(float)  # UNDER teased UP by 6
g.loc[g.actual_total == g.open_total + 6, "under_tease_cover"] = np.nan

L(f"{'total bucket':14s} {'n':>4s}  {'OVER tease win%':>17s}  {'UNDER tease win%':>17s}")
L("-"*92)
tbuckets = [(33,37),(37.5,39),(39.5,41),(41.5,43),(43.5,45),(45.5,47),(47.5,49),(49.5,51),(51.5,53),(53.5,56)]
for lo,hi in tbuckets:
    sub = g[(g.open_total>=lo) & (g.open_total<=hi)]
    if len(sub)<5: continue
    o = sub.over_tease_cover.dropna(); u = sub.under_tease_cover.dropna()
    o_lo,o_hi = wilson_ci(int(o.sum()), len(o)) if len(o) else (0,0)
    u_lo,u_hi = wilson_ci(int(u.sum()), len(u)) if len(u) else (0,0)
    L(f"  {lo:4.1f} to {hi:4.1f}    {len(sub):4d}   {o.mean()*100:5.1f}% [{o_lo*100:.0f},{o_hi*100:.0f}]   {u.mean()*100:5.1f}% [{u_lo*100:.0f},{u_hi*100:.0f}]")

# =================================================================================
# PART 4 — RESIDUAL STD FROM b70 REGRESSION (sigma estimate for Phase 2)
# =================================================================================
L(f"\n{'='*92}\nPART 4: b70 margin-regression residual std (walk-forward, 2024+2025 out-of-sample)\n{'='*92}")
W = m[m.week>=4].copy()
W["pred_margin"] = np.nan
for Y in [2024, 2025]:
    tr = W[W.season<Y].dropna(subset=["actual_margin"]+BASE)
    te = W[W.season==Y]
    reg = HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=300,
        l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[BASE], tr.actual_margin)
    W.loc[te.index,"pred_margin"] = reg.predict(te[BASE])
oof = W[W.season.isin([2024,2025])].dropna(subset=["pred_margin","actual_margin"]).copy()
oof["resid"] = oof.actual_margin - oof.pred_margin
sigma = oof.resid.std()
mae = oof.resid.abs().mean()
L(f"  Out-of-sample residuals (n={len(oof)}):")
L(f"    mean(resid):    {oof.resid.mean():+.3f}  (should be ~0; bias check)")
L(f"    std(resid):     {sigma:.2f}  <-- THIS IS THE SIGMA FOR Φ((pred - target)/σ)")
L(f"    MAE:            {mae:.2f}")
L(f"  Residual quantiles (Gaussian comparison):")
for q in [0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95]:
    actual = oof.resid.quantile(q)
    gaussian = sigma * pd.Series([-1.645,-1.282,-0.674,0,0.674,1.282,1.645]).iloc[[0.05,0.10,0.25,0.50,0.75,0.90,0.95].index(q)]
    L(f"    q={q:.2f}: actual={actual:+6.2f}  N(0,σ)={gaussian:+6.2f}  diff={actual-gaussian:+.2f}")
L(f"  Skew={oof.resid.skew():+.3f}  Kurt={oof.resid.kurt():+.3f}  (Gaussian = 0, 0)")
L(f"  -> Use σ={sigma:.1f} in Phase 2 for per-game teaser leg probability.")

# Sanity: validate Φ approximation
from scipy.stats import norm
oof["p_home_tease"] = norm.cdf((oof.pred_margin - (-oof.open_spread - 6)) / sigma) if False else np.nan
# Re-do: need open_spread on oof
oof2 = oof.merge(od[["season","home_ab","away_ab","open_spread"]], on=["season","home_ab","away_ab"], how="left").dropna(subset=["open_spread"])
oof2["p_home_tease"] = norm.cdf((oof2.pred_margin - (-oof2.open_spread - 6)) / sigma)
oof2["home_tease_won"] = (oof2.actual_margin + oof2.open_spread + 6 > 0).astype(float)
oof2.loc[oof2.actual_margin + oof2.open_spread + 6 == 0, "home_tease_won"] = np.nan
L(f"\n  Calibration check: P(home_tease) vs realized hit % (the model probabilities should match reality)")
for lo,hi in [(0.60,0.65),(0.65,0.70),(0.70,0.75),(0.75,0.80),(0.80,0.85),(0.85,1.00)]:
    sub = oof2[(oof2.p_home_tease>=lo) & (oof2.p_home_tease<hi)].dropna(subset=["home_tease_won"])
    if len(sub)<5: continue
    pred = sub.p_home_tease.mean()*100
    actual = sub.home_tease_won.mean()*100
    n = len(sub); k = int(sub.home_tease_won.sum())
    lo_ci,hi_ci = wilson_ci(k, n)
    L(f"    P in [{lo:.2f},{hi:.2f}):  n={n:3d}  predicted_avg={pred:.1f}%  actual={actual:.1f}% [{lo_ci*100:.0f},{hi_ci*100:.0f}]")

L(f"\n{'-'*92}\nPHASE 1 COMPLETE. Outputs to feed Phase 2:")
L(f"  - sigma_margin = {sigma:.2f}")
L(f"  - Wong spot empirical hit rates above")
L(f"  - Key-number presence ~{(key_3+key_7)/total_n*100:.1f}% (vs ~7% for uniform, so still alive)")
L(f"  - Calibration check tells us if Phase 2 prob estimates will be honest")
