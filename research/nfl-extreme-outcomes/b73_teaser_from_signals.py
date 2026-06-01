"""
b73 — TEASERS FROM OUR LOCKED SIGNALS (the right way).

The premise of b71/b72 was structural-bucket teasers (Wong-style). The honest OOS hit rate
was ~70% per leg — not enough at -120. But our LOCKED active signals already hit 60-75%
straight up. Teasing those by 6 should push them to 78-85% per leg, which IS profitable.

PIPELINE
  1. Use forecast_harness to generate all active rule picks for 2024 + 2025 (walk-forward
     regression already trained inside generate()).
  2. Filter to active rules with proven straight-pick edge:
       SPREAD legs:
         - sides_model with confluence=1 (regression confirmation)
         - top_vs_top_pt_home, tight_soft_ml_fade_home, legacy_fade, legacy_primetime
         - dk_heavy_home_juice (graded carefully — was 22% in 2025, may drop)
       TOTAL legs:
         - receiver_over, receiver_over_HC, wind_under
         - total_low_line_over, total_high_line_under
  3. For each NFL week, rank candidates by edge magnitude. Take top-N (2 or 3).
  4. Tease each by 6 points in our pick's favor.
  5. Form 2-team teasers (and 3-team for comparison). Grade vs OPEN ± 6.
  6. Compare to b72b structural-only result.

GRADING
  Spread HOME pick: teased line = open_spread + 6. Wins if margin + teased_line > 0.
  Spread AWAY pick: teased line = open_spread - 6. Wins if margin + teased_line < 0.
  Total OVER pick:  teased line = open_total - 6. Wins if actual_total > teased_line.
  Total UNDER pick: teased line = open_total + 6. Wins if actual_total < teased_line.
"""
import os, sys, warnings
from itertools import combinations
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from forecast_harness import build, generate, train_predict, CONF, REG_EDGE
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

# Active rules we'll consider for teaser legs (from LOCKED_MODELS.md ACTIVE list)
SPREAD_RULES = ["sides_model", "top_vs_top_pt_home", "tight_soft_ml_fade_home",
                "legacy_fade", "legacy_primetime", "fade_pr_in_tight_game",
                "spread_dog_cover_fade_away", "spread_dog_cover_fade_home"]
TOTAL_RULES  = ["receiver_over", "receiver_over_HC", "wind_under",
                "total_low_line_over", "total_high_line_under",
                "dk_giant_fav_over"]
ALL_RULES = SPREAD_RULES + TOTAL_RULES

L(f"\n{'='*92}\nSTEP 1: Generate active picks for 2024+2025 via the locked harness\n{'='*92}")
m, BASE = build()
m["actual_margin"] = m.home_score - m.away_score
m["actual_total"]  = m.home_score + m.away_score

all_picks = []
for Y in [2024, 2025]:
    led, _ = generate(m, BASE, Y)
    led["season"] = Y
    all_picks.append(led)
picks = pd.concat(all_picks, ignore_index=True)
L(f"  Total picks generated: {len(picks)}")
L(f"  Rules firing: {picks.rule.value_counts().to_dict()}")

# Merge actual outcomes — ledger has NaN home_ab/away_ab/actual_margin until grade() runs.
# Drop those NaN cols and re-attach from the matchup frame.
for c in ["away_ab","home_ab","actual_margin","actual_total","win","clv_pts","roi_u"]:
    if c in picks.columns: picks = picks.drop(columns=[c])
picks["away_ab"] = picks.game.str.split("@").str[0]
picks["home_ab"] = picks.game.str.split("@").str[1]
ma = m[["season","week","home_ab","away_ab","actual_margin","actual_total"]].copy()
picks = picks.merge(ma, on=["season","week","home_ab","away_ab"], how="left")
L(f"  After outcome merge: {picks.actual_margin.notna().sum()}/{len(picks)} have actuals")

L(f"\n{'='*92}\nSTEP 2: Per-rule straight-pick hit rates (the baseline we're teasing FROM)\n{'='*92}")
L(f"{'rule':28s} {'mkt':>6s}  {'n':>4s}  {'straight hit%':>14s}  {'after-6pt tease%':>17s}  delta")
for rule in ALL_RULES:
    sub = picks[picks.rule==rule]
    if len(sub)==0: continue
    # Grade straight at OPEN line
    if sub.market.iloc[0]=="spread":
        sub["straight_won"] = np.where(sub.bet_home==1,
            (sub.actual_margin + sub.open_num > 0).astype(float),
            (sub.actual_margin + sub.open_num < 0).astype(float))
        sub.loc[sub.actual_margin + sub.open_num == 0, "straight_won"] = np.nan
        sub["teased_line"] = np.where(sub.bet_home==1, sub.open_num + 6, sub.open_num - 6)
        sub["teased_won"] = np.where(sub.bet_home==1,
            (sub.actual_margin + sub.teased_line > 0).astype(float),
            (sub.actual_margin + sub.teased_line < 0).astype(float))
        sub.loc[sub.actual_margin + sub.teased_line == 0, "teased_won"] = np.nan
    else:
        # bet_home==-1 means OVER; -2 means UNDER
        sub["straight_won"] = np.where(sub.bet_home==-1,
            (sub.actual_total > sub.open_num).astype(float),
            (sub.actual_total < sub.open_num).astype(float))
        sub.loc[sub.actual_total == sub.open_num, "straight_won"] = np.nan
        sub["teased_line"] = np.where(sub.bet_home==-1, sub.open_num - 6, sub.open_num + 6)
        sub["teased_won"] = np.where(sub.bet_home==-1,
            (sub.actual_total > sub.teased_line).astype(float),
            (sub.actual_total < sub.teased_line).astype(float))
        sub.loc[sub.actual_total == sub.teased_line, "teased_won"] = np.nan
    sw = sub.straight_won.dropna(); tw = sub.teased_won.dropna()
    if len(sw)==0: continue
    s_hit = sw.mean()*100; t_hit = tw.mean()*100 if len(tw)>0 else np.nan
    s_n = len(sw); t_n = len(tw)
    s_lo,s_hi = wilson_ci(int(sw.sum()), s_n)
    t_lo,t_hi = wilson_ci(int(tw.sum()), t_n) if t_n>0 else (0,0)
    delta = t_hit - s_hit
    L(f"  {rule:28s} {sub.market.iloc[0]:>6s}  {s_n:4d}  {s_hit:5.1f}%[{s_lo*100:.0f},{s_hi*100:.0f}]  {t_hit:5.1f}%[{t_lo*100:.0f},{t_hi*100:.0f}]  {delta:+5.1f}pp")
    # Save back
    picks.loc[sub.index, "straight_won"] = sub.straight_won
    picks.loc[sub.index, "teased_line"]  = sub.teased_line
    picks.loc[sub.index, "teased_won"]   = sub.teased_won

# Sides_model confluence subset specifically
sm = picks[picks.rule=="sides_model"].copy()
if "confluence" in sm.columns:
    L(f"\n  sides_model CONFLUENCE subset (regression layer agrees):")
    for tag, sub in [("clf only (conf=0)", sm[sm.confluence==0]), ("BOTH AGREE (conf=1)", sm[sm.confluence==1])]:
        sw = sub.straight_won.dropna(); tw = sub.teased_won.dropna()
        if len(sw)>0:
            s_hit = sw.mean()*100
            t_hit = tw.mean()*100 if len(tw)>0 else np.nan
            s_lo,s_hi = wilson_ci(int(sw.sum()), len(sw))
            t_lo,t_hi = wilson_ci(int(tw.sum()), len(tw)) if len(tw)>0 else (0,0)
            L(f"    {tag:24s}  n={len(sw):3d}  straight={s_hit:.1f}%[{s_lo*100:.0f},{s_hi*100:.0f}]  teased={t_hit:.1f}%[{t_lo*100:.0f},{t_hi*100:.0f}]")

# ----------------------------------------------------------------
# STEP 3: Define TEASER-ELIGIBLE rules (teased hit >= 78%)
# ----------------------------------------------------------------
L(f"\n{'='*92}\nSTEP 3: TEASER-ELIGIBLE rules (teased hit% >= 78%)\n{'='*92}")
eligibility = []
for rule in ALL_RULES:
    sub = picks[picks.rule==rule]
    tw = sub.teased_won.dropna()
    if len(tw) < 10: continue
    hit = tw.mean()
    if hit >= 0.78:
        eligibility.append({"rule":rule, "teased_hit":hit, "n":len(tw)})
elig_df = pd.DataFrame(eligibility).sort_values("teased_hit", ascending=False)
for _,r in elig_df.iterrows():
    L(f"  ✓ {r['rule']:28s} teased_hit={r.teased_hit*100:.1f}%  n={int(r.n)}")
ELIG_RULES = elig_df.rule.tolist()
L(f"\n  Total eligible rules: {len(ELIG_RULES)}")

# Build the teaser-candidate pool
cand = picks[picks.rule.isin(ELIG_RULES)].dropna(subset=["teased_won"]).copy()
# For sides_model, ONLY include confluence=1 picks if confluence available
if "confluence" in cand.columns:
    cand = cand[~((cand.rule=="sides_model") & (cand.confluence==0))]
L(f"  Total candidate legs after confluence filter: {len(cand)}")
L(f"  Avg per NFL week: {len(cand)/((2)*15):.1f}")

# Per-rule again in the filtered pool
L(f"\nFiltered candidate pool (teaser legs we'll bet):")
for rule in ELIG_RULES:
    sub = cand[cand.rule==rule]
    tw = sub.teased_won.dropna()
    if len(tw)==0: continue
    hit = tw.mean(); lo,hi = wilson_ci(int(tw.sum()), len(tw))
    L(f"  {rule:28s}  n={len(tw):3d}  teased_hit={hit*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")

# ----------------------------------------------------------------
# STEP 4: 2-team teaser, TOP-N per week from candidate pool
# ----------------------------------------------------------------
L(f"\n{'='*92}\nSTEP 4: 2-TEAM TEASER BACKTEST (top-N per week from signal-driven candidates)\n{'='*92}")

def grade_topN(cand, n_top, payoff, label, allow_cross=True):
    pairs=[]
    for (season,week), grp in cand.groupby(["season","week"]):
        # Rank by edge magnitude (larger edge = stronger signal)
        grp = grp.copy()
        grp["edge_mag"] = grp.edge.abs()
        grp = grp.sort_values("edge_mag", ascending=False)
        if not allow_cross:
            grp = grp[grp.market=="spread"]   # spread-only teasers if cross-market disabled
        if len(grp) < 2: continue
        top = grp.head(n_top)
        # Take only the first 2 for 2-team teaser (or all combos if n_top>2)
        if n_top==2:
            l1,l2 = top.iloc[0], top.iloc[1]
            # avoid same game
            if l1.home_ab==l2.home_ab and l1.away_ab==l2.away_ab:
                if len(grp)>=3: l2 = grp.iloc[2]
                else: continue
            w1, w2 = l1.teased_won, l2.teased_won
            if pd.isna(w1) or pd.isna(w2): continue
            both = int(w1==1 and w2==1)
            pnl = payoff if both else -1.0
            pairs.append({"season":season,"week":week,"both":both,"pnl":pnl,
                          "leg1":f"{l1.rule}/{l1.home_ab if l1.bet_home in (1,-1) else l1.away_ab}",
                          "leg2":f"{l2.rule}/{l2.home_ab if l2.bet_home in (1,-1) else l2.away_ab}"})
        else:
            # Form all combos from top-N
            for i,j in combinations(range(len(top)), 2):
                l1,l2 = top.iloc[i], top.iloc[j]
                if l1.home_ab==l2.home_ab and l1.away_ab==l2.away_ab: continue
                w1, w2 = l1.teased_won, l2.teased_won
                if pd.isna(w1) or pd.isna(w2): continue
                both = int(w1==1 and w2==1)
                pnl = payoff if both else -1.0
                pairs.append({"season":season,"week":week,"both":both,"pnl":pnl})
    pdf = pd.DataFrame(pairs)
    if len(pdf)==0: L(f"  {label}: no pairs"); return pdf
    n=len(pdf); k=int(pdf.both.sum()); roi=pdf.pnl.mean()*100
    lo,hi = wilson_ci(k,n)
    L(f"  {label:48s} n={n:3d}  both_hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+5.1f}%  units={pdf.pnl.sum():+.1f}")
    return pdf

L(f"\nPricing: -120 (payoff $0.833; joint breakeven 54.5%, per-leg breakeven ~74%)\n")
p2 = grade_topN(cand, n_top=2, payoff=100/120, label="Top-2 per week, one teaser/wk")
p_all = grade_topN(cand, n_top=10, payoff=100/120, label="All combos from top-3 per week")

L(f"\nPricing: -110 (sharpbook 2-team 6pt; joint BE 52.4%, per-leg BE ~72.4%)\n")
grade_topN(cand, n_top=2, payoff=100/110, label="Top-2 per week, one teaser/wk")
grade_topN(cand, n_top=10, payoff=100/110, label="All combos from top-3 per week")

# Per-season for top-2
if len(p2)>0:
    L(f"\nPer-season top-2 per week @ -120:")
    for Y in [2024,2025]:
        sy = p2[p2.season==Y]; n=len(sy); k=int(sy.both.sum()) if n>0 else 0
        if n>0:
            roi=sy.pnl.mean()*100; lo,hi=wilson_ci(k,n)
            L(f"  {Y}: weeks={n}  hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+.1f}%  units={sy.pnl.sum():+.1f}")

# Show what the top-2 actually picked each week
L(f"\nSample weekly top-2 teasers (first 20):")
for _,r in p2.head(20).iterrows():
    res = "WIN" if r.both==1 else "loss"
    L(f"  {r.season} W{int(r.week):2d}: {r.leg1:38s} + {r.leg2:38s} -> {res}")

# ----------------------------------------------------------------
# STEP 5: 3-team teaser at +160
# ----------------------------------------------------------------
L(f"\n{'='*92}\nSTEP 5: 3-TEAM TEASER (+160), top-3 per week\n{'='*92}\n")
L(f"Pricing: +160 (payoff $1.60 per $1; joint BE 38.5%, per-leg BE ~72.7%)\n")
records=[]
for (season,week), grp in cand.groupby(["season","week"]):
    grp = grp.copy().sort_values("edge", key=abs, ascending=False)
    # take top 3 distinct games
    used = set()
    picks_w = []
    for _,row in grp.iterrows():
        key = (row.home_ab, row.away_ab)
        if key in used: continue
        used.add(key); picks_w.append(row)
        if len(picks_w)==3: break
    if len(picks_w)<3: continue
    wins = [p.teased_won for p in picks_w]
    if any(pd.isna(w) for w in wins): continue
    all_hit = int(all(w==1 for w in wins))
    pnl = 1.60 if all_hit else -1.0
    records.append({"season":season,"week":week,"all_hit":all_hit,"pnl":pnl})
rdf = pd.DataFrame(records)
if len(rdf)>0:
    n=len(rdf); k=int(rdf.all_hit.sum()); roi=rdf.pnl.mean()*100; lo,hi=wilson_ci(k,n)
    L(f"  weeks={n}  all_hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+.1f}%  units={rdf.pnl.sum():+.1f}")
    for Y in [2024,2025]:
        sy = rdf[rdf.season==Y]; n=len(sy); k=int(sy.all_hit.sum()) if n>0 else 0
        if n>0:
            L(f"    {Y}: weeks={n} hit={k}/{n}={k/n*100:.1f}% ROI={sy.pnl.mean()*100:+.1f}%")

L(f"\n{'-'*92}\nb73 verdict: signal-driven legs (top picks from our locked rules) — is this the unlock?")
