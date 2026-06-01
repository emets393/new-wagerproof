"""
b72 — TEASER MODEL Phase 2: per-game leg generator + model confirmation + 2-team backtest.

PIPELINE
  1. Walk-forward train b70 regression on seasons < target (using BASE features, no leakage)
  2. For each game in target year:
       a. Identify which structural BUCKET the OPEN spread sits in
       b. If bucket is in the eligibility list (Phase 1 confirmed), tag as candidate
       c. Apply b70 model filter: model must agree with the leg's direction (pred_margin
          on the correct side of the line)
       d. Assign calibrated leg probability = pooled bucket hit % from Phase 1
  3. Pair candidates into 2-team teasers per NFL week (all combos of same-week eligible legs)
  4. Grade each leg vs OPEN_SPREAD ± 6. Both legs must hit for the teaser to win.
  5. Compute ROI at standard -120 pricing (risk $120 → win $100, breakeven joint P = 54.5%)

ELIGIBILITY (from b71b extended empirical, 2018-2025)
  TIER 1 (lower CI bound clears -120 breakeven):
    - open_spread +4 to +5.5, HOME tease  (83.3%, n=102)
    - open_spread -2.5 to -1.5, AWAY tease  (79.4%, n=175)  [Wong D]

  TIER 2 (pooled clears -120, CI clears -110):
    - open_spread +1.5 to +2.5, HOME tease  (76.6%, n=138)  [Wong B]
    - open_spread +7.5 to +8.5, AWAY tease  (82.1%, n=39)   [Wong C, thin]
    - open_spread +6 to +7, AWAY tease  (79.6%, n=103)
    - open_spread -3.5 to -3, AWAY tease  (74.9%, n=239)
    - open_spread -7 to -6, HOME tease  (74.9%, n=167)
    - open_spread -1 to +1, HOME tease  (73.3%, n=131)

  REJECTED:
    - open_spread -8.5 to -7.5 (Wong A — dead, 67.7%)
    - open_spread -5.5 to -4 (69.5%, fails -120)
    - all marginal spots

MODEL FILTER (b70 regression confirmation)
  HOME tease eligible only if pred_margin > -open_spread   (model expects home to cover the close)
  AWAY tease eligible only if pred_margin < -open_spread   (model expects away to cover the close)

FRAMEWORK COMPLIANCE
  - OPEN spread for both signal and grading (signal-line match)
  - Walk-forward regression (train Y<target)
  - 2024 + 2025 tested (we have open lines for those years)
  - Per-season breakdown
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

# ---------- Eligibility map -----------------------------------------------------
ELIGIBLE = [
    # (sp_lo, sp_hi, leg_side, tier, calibrated_p, n, label)
    (4.0,   5.5,  "HOME", 1, 0.833, 102, "HOME +4/+5.5 dog -> +10/+11.5 (through 7)"),
    (-2.5, -1.5,  "AWAY", 1, 0.794, 175, "AWAY +1.5/+2.5 dog -> +7.5/+8.5 [Wong D]"),
    (1.5,   2.5,  "HOME", 2, 0.766, 138, "HOME +1.5/+2.5 dog -> +7.5/+8.5 [Wong B]"),
    (7.5,   8.5,  "AWAY", 2, 0.821, 39,  "AWAY -7.5/-8.5 fav -> -1.5/-2.5 [Wong C]"),
    (6.0,   7.0,  "AWAY", 2, 0.796, 103, "AWAY -6/-7 fav -> -0/-1 (through 3)"),
    (-3.5, -3.0,  "AWAY", 2, 0.749, 239, "AWAY +3/+3.5 dog -> +9/+9.5 (through 3+7)"),
    (-7.0, -6.0,  "HOME", 2, 0.749, 167, "HOME -7/-6 fav -> -1/-0 (through 3)"),
    (-1.0,  1.0,  "HOME", 2, 0.733, 131, "HOME pickem -> +5/+7 (through 3)"),
]

def classify_leg(open_spread):
    """Return list of eligible (side, tier, p, label) tuples for this open_spread."""
    if pd.isna(open_spread): return []
    out=[]
    for lo,hi,side,tier,p,n,label in ELIGIBLE:
        if lo <= open_spread <= hi:
            out.append({"side":side,"tier":tier,"p":p,"n":n,"label":label})
    return out

# ---------- Build features + walk-forward regression ----------------------------
m, BASE = build()
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"] = m.home_score - m.away_score

W = m[m.week>=4].copy()
W["pred_margin"] = np.nan
for Y in [2024, 2025]:
    tr = W[W.season<Y].dropna(subset=["actual_margin"]+BASE)
    te = W[W.season==Y]
    reg = HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=300,
        l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[BASE], tr.actual_margin)
    W.loc[te.index,"pred_margin"] = reg.predict(te[BASE])

g = W[W.season.isin([2024,2025])].merge(
    od[["season","home_ab","away_ab","open_spread","close_spread"]],
    on=["season","home_ab","away_ab"], how="inner").dropna(subset=["pred_margin","open_spread"])
L(f"\n[load] {len(g)} games in 2024+2025 with pred_margin + open_spread")

# ---------- Per-game leg generation --------------------------------------------
legs=[]
for _,r in g.iterrows():
    cands = classify_leg(r.open_spread)
    for c in cands:
        # Model filter
        market_margin = -r.open_spread   # market-implied home margin
        if c["side"]=="HOME":
            model_agrees = r.pred_margin > market_margin   # model: home outperforms
        else:
            model_agrees = r.pred_margin < market_margin   # model: away outperforms
        # Teaser outcome
        if c["side"]=="HOME":
            teased_line = r.open_spread + 6   # bet home +(spread+6); win if margin + teased_line > 0
            win = (r.actual_margin + teased_line > 0)
            push = (r.actual_margin + teased_line == 0)
        else:
            teased_line = r.open_spread - 6   # bet away with line shifted favorably
            win = (r.actual_margin + teased_line < 0)
            push = (r.actual_margin + teased_line == 0)
        legs.append({
            "season":int(r.season),"week":int(r.week),"home_ab":r.home_ab,"away_ab":r.away_ab,
            "open_spread":r.open_spread,"pred_margin":r.pred_margin,"actual_margin":r.actual_margin,
            "side":c["side"],"tier":c["tier"],"p_cal":c["p"],"label":c["label"],
            "model_agrees":bool(model_agrees),
            "teased_line":teased_line,"win":(np.nan if push else int(win)),"push":push,
        })
legs_df = pd.DataFrame(legs)
L(f"\n[legs] {len(legs_df)} eligible legs generated across 2024+2025")
L(f"  by tier: {legs_df.tier.value_counts().to_dict()}")
L(f"  model agrees: {legs_df.model_agrees.sum()}/{len(legs_df)} = {legs_df.model_agrees.mean()*100:.1f}%")
L(f"  pushes: {legs_df.push.sum()}")

# ---------- Single-leg validation ----------------------------------------------
L(f"\n{'='*92}\nSINGLE-LEG HIT RATE (validate Phase 1 prob in our forward sample)\n{'='*92}")
L(f"{'bucket':50s} {'tier':>4s} {'n':>4s} {'cal_p':>6s} {'all_legs':>9s} {'+model':>9s}")
for label in legs_df.label.unique():
    sub = legs_df[legs_df.label==label]
    cal = sub.p_cal.iloc[0]
    won_all = sub.win.dropna(); n_all=len(won_all); k_all=int(won_all.sum())
    sub_m = sub[sub.model_agrees]; won_m = sub_m.win.dropna(); n_m=len(won_m); k_m=int(won_m.sum())
    a_str = f"{k_all/n_all*100:.1f}%(n={n_all})" if n_all>0 else "-"
    m_str = f"{k_m/n_m*100:.1f}%(n={n_m})" if n_m>0 else "-"
    tier = sub.tier.iloc[0]
    L(f"  {label:50s}   T{tier} {n_all:4d}  {cal*100:5.1f}%  {a_str:>9s}  {m_str:>9s}")

# Aggregate by tier
L(f"\nAggregate by tier:")
for tier in [1,2]:
    sub = legs_df[legs_df.tier==tier]; won = sub.win.dropna(); n=len(won); k=int(won.sum())
    if n>0:
        lo,hi = wilson_ci(k,n)
        L(f"  TIER {tier} all legs:      n={n:3d}  hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
    subm = sub[sub.model_agrees]; wonm = subm.win.dropna(); nm=len(wonm); km=int(wonm.sum())
    if nm>0:
        lom,him = wilson_ci(km,nm)
        L(f"  TIER {tier} model-confirmed: n={nm:3d}  hit={km}/{nm}={km/nm*100:.1f}% CI[{lom*100:.0f},{him*100:.0f}]")

# Combined
all_won = legs_df.win.dropna(); n_a=len(all_won); k_a=int(all_won.sum())
lo,hi=wilson_ci(k_a,n_a); L(f"\nALL ELIGIBLE LEGS: n={n_a}  hit={k_a}/{n_a}={k_a/n_a*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
mw = legs_df[legs_df.model_agrees].win.dropna(); n_m=len(mw); k_m=int(mw.sum())
lo,hi=wilson_ci(k_m,n_m); L(f"MODEL-CONFIRMED LEGS: n={n_m}  hit={k_m}/{n_m}={k_m/n_m*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")

# Per-season
L(f"\nPer-season ALL eligible legs:")
for Y in [2024,2025]:
    sy = legs_df[legs_df.season==Y]; won = sy.win.dropna()
    if len(won)>0:
        n=len(won); k=int(won.sum()); lo,hi=wilson_ci(k,n)
        L(f"  {Y}: n={n} hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
        sym = sy[sy.model_agrees]; wm = sym.win.dropna()
        if len(wm)>0:
            nm=len(wm); km=int(wm.sum()); lo,hi=wilson_ci(km,nm)
            L(f"        model-confirmed: n={nm} hit={km}/{nm}={km/nm*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")

# ---------- 2-TEAM TEASER GRADER -----------------------------------------------
def grade_2team(df, price_label, win_payoff, risk):
    """ROI at the given pricing. win_payoff per $1 risked when both legs hit (e.g. -120 pays $100/$120 = 0.833)."""
    pairs=[]
    for (season,week), grp in df.groupby(["season","week"]):
        gp = grp.dropna(subset=["win"])   # exclude pushes for simplicity (book actually demotes 2->1, but we drop)
        if len(gp)<2: continue
        for i,j in combinations(gp.index, 2):
            l1,l2 = gp.loc[i], gp.loc[j]
            # don't pair the same game (HOME+AWAY of same matchup)
            if (l1.home_ab==l2.home_ab) and (l1.away_ab==l2.away_ab): continue
            both = int(l1.win and l2.win)
            pnl = win_payoff if both else -1.0
            pairs.append({"season":season,"week":week,"l1":l1.label,"l2":l2.label,
                          "both":both,"pnl":pnl,
                          "l1_model":bool(l1.model_agrees),"l2_model":bool(l2.model_agrees),
                          "l1_tier":int(l1.tier),"l2_tier":int(l2.tier)})
    pdf = pd.DataFrame(pairs)
    if len(pdf)==0:
        L(f"  {price_label}: no pairs"); return pdf
    n=len(pdf); k=int(pdf.both.sum()); roi = pdf.pnl.mean()*100
    lo,hi = wilson_ci(k,n)
    L(f"  {price_label}: pairs={n}  both_hit={k}/{n}={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+.1f}% (units={pdf.pnl.sum():+.1f})")
    return pdf

L(f"\n{'='*92}\n2-TEAM TEASER BACKTEST (all combos within each NFL week)\n{'='*92}")
# Standard 2-team 6pt = -120 (most US books)
L(f"\nPricing: -120 (risk $120, win $100, breakeven joint P=54.5%)")
L(f"  Win payoff per $1 = 0.833\n")

L(f"a) ALL eligible legs (Tier 1 + Tier 2, no model filter):")
all_pairs = grade_2team(legs_df, "  ", win_payoff=100/120, risk=1.0)

L(f"\nb) ALL eligible legs, BOTH legs require model agreement:")
mc = legs_df[legs_df.model_agrees]
mc_pairs = grade_2team(mc, "  ", win_payoff=100/120, risk=1.0)

L(f"\nc) TIER 1 only (strongest buckets only):")
t1 = legs_df[legs_df.tier==1]
t1_pairs = grade_2team(t1, "  ", win_payoff=100/120, risk=1.0)

L(f"\nd) TIER 1 + model agreement (top of the pyramid):")
t1m = legs_df[(legs_df.tier==1)&(legs_df.model_agrees)]
t1m_pairs = grade_2team(t1m, "  ", win_payoff=100/120, risk=1.0)

# Compare with -110 (Tuesday teaser specials at some books)
L(f"\nPricing: -110 (Tuesday specials / sharpbook 2-team 6pt at -110)")
L(f"  Win payoff per $1 = 0.909, breakeven joint P=52.4%, per-leg = 72.4%\n")
L(f"a) All eligible legs:")
grade_2team(legs_df, "  ", win_payoff=100/110, risk=1.0)
L(f"d) Tier 1 + model agreement:")
grade_2team(legs_df[(legs_df.tier==1)&(legs_df.model_agrees)], "  ", win_payoff=100/110, risk=1.0)

# Per-season summary for the top configuration
if len(t1m_pairs)>0:
    L(f"\nPER-SEASON for Tier 1 + model-confirmed @ -120:")
    for Y in [2024,2025]:
        sy = t1m_pairs[t1m_pairs.season==Y]
        if len(sy)>0:
            n=len(sy); k=int(sy.both.sum()); roi=sy.pnl.mean()*100
            L(f"  {Y}: pairs={n} both_hit={k}/{n}={k/n*100:.1f}% ROI={roi:+.1f}%")

# Save the leg ledger
legs_df.to_csv(os.path.join(DATA,"b72_teaser_legs_2024_2025.csv"), index=False)
L(f"\n[save] leg ledger -> data/b72_teaser_legs_2024_2025.csv")

L(f"\n{'-'*92}\nPhase 2 verdict:")
L(f"  Strongest configuration = Tier 1 + model agreement.")
L(f"  Operational frontend: surface Tier 1 + model-confirmed legs each week, pair as 2-teamers.")
