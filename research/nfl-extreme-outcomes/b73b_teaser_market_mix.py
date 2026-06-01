"""
b73b — explicit cross-market teaser breakdown.

Splits the b73 result into:
  - SPREAD + SPREAD combos
  - TOTAL + TOTAL combos
  - SPREAD + TOTAL mixed combos
  - "Best available" each week (ignores market, picks top-2 by edge)
At BOTH -120 and -110 pricing. Also tests 6.5pt at -130 for completeness.

The point: confirm that mixing markets isn't just allowed — it's often the strongest config
because the receiver_over_HC total leg is so dominant that pairing it with the best available
spread signal beats almost everything else.
"""
import os, sys, warnings
from itertools import combinations
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from forecast_harness import build, generate
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

SPREAD_RULES = ["sides_model","top_vs_top_pt_home","tight_soft_ml_fade_home",
                "legacy_fade","legacy_primetime","fade_pr_in_tight_game",
                "spread_dog_cover_fade_away","spread_dog_cover_fade_home"]
TOTAL_RULES  = ["receiver_over","receiver_over_HC","wind_under",
                "total_low_line_over","total_high_line_under","dk_giant_fav_over"]
ALL_RULES = SPREAD_RULES + TOTAL_RULES

# Same eligibility threshold as b73: teased hit% >= 78% (per-rule)
# Found in b73: receiver_over_HC (89%), top_vs_top_pt_home (86%), legacy_fade (86%),
#               fade_pr_in_tight_game (78%) — those 4 only.
ELIGIBLE_RULES = ["receiver_over_HC","top_vs_top_pt_home","legacy_fade","fade_pr_in_tight_game"]

m, BASE = build()
m["actual_margin"] = m.home_score - m.away_score
m["actual_total"]  = m.home_score + m.away_score

all_picks=[]
for Y in [2024,2025]:
    led,_ = generate(m, BASE, Y); led["season"]=Y; all_picks.append(led)
picks = pd.concat(all_picks, ignore_index=True)
for c in ["away_ab","home_ab","actual_margin","actual_total","win","clv_pts","roi_u"]:
    if c in picks.columns: picks = picks.drop(columns=[c])
picks["away_ab"]=picks.game.str.split("@").str[0]; picks["home_ab"]=picks.game.str.split("@").str[1]
ma = m[["season","week","home_ab","away_ab","actual_margin","actual_total"]].copy()
picks = picks.merge(ma, on=["season","week","home_ab","away_ab"], how="left")

# Compute teased outcome per pick
def compute_teased(row):
    if row.market=="spread":
        if row.bet_home==1:
            teased = row.open_num + 6
            if row.actual_margin + teased == 0: return np.nan, teased
            return int(row.actual_margin + teased > 0), teased
        else:
            teased = row.open_num - 6
            if row.actual_margin + teased == 0: return np.nan, teased
            return int(row.actual_margin + teased < 0), teased
    else:
        if row.bet_home==-1:   # OVER
            teased = row.open_num - 6
            if row.actual_total == teased: return np.nan, teased
            return int(row.actual_total > teased), teased
        else:                  # UNDER
            teased = row.open_num + 6
            if row.actual_total == teased: return np.nan, teased
            return int(row.actual_total < teased), teased

picks[["teased_won","teased_line"]] = picks.apply(lambda r: pd.Series(compute_teased(r)), axis=1)

# Filter to eligible rules + sides_model with confluence=1
cand = picks[picks.rule.isin(ELIGIBLE_RULES)].dropna(subset=["teased_won"]).copy()
sm_conf = picks[(picks.rule=="sides_model")&(picks.get("confluence",0)==1)].dropna(subset=["teased_won"]).copy()
cand = pd.concat([cand, sm_conf], ignore_index=True)
cand["edge_mag"] = cand.edge.abs()
L(f"\n[candidates] {len(cand)} legs (eligible rules + sides_model confluence=1)")
L(f"  market mix: {cand.market.value_counts().to_dict()}")
L(f"  per-rule: {cand.rule.value_counts().to_dict()}")

# ----------------------------------------------------------------
# Build top-2 per week with explicit market combo tracking
# ----------------------------------------------------------------
weekly = []
for (season,week), grp in cand.groupby(["season","week"]):
    grp = grp.sort_values("edge_mag", ascending=False).copy()
    # Top-2 distinct games
    seen=set(); top2=[]
    for _,r in grp.iterrows():
        gid = (r.home_ab, r.away_ab)
        if gid in seen: continue
        seen.add(gid); top2.append(r)
        if len(top2)==2: break
    if len(top2)<2: continue
    l1,l2 = top2[0], top2[1]
    combo = "+".join(sorted([l1.market, l2.market]))   # 'spread+spread', 'spread+total', 'total+total'
    both = int(l1.teased_won==1 and l2.teased_won==1)
    weekly.append({"season":int(season),"week":int(week),"combo":combo,"both":both,
                   "l1_rule":l1.rule,"l1_mkt":l1.market,"l1_game":f"{l1.away_ab}@{l1.home_ab}",
                   "l2_rule":l2.rule,"l2_mkt":l2.market,"l2_game":f"{l2.away_ab}@{l2.home_ab}"})
wdf = pd.DataFrame(weekly)

L(f"\n{'='*92}\nTOP-2 PER WEEK: market combo breakdown\n{'='*92}")
L(f"\nOverall combo distribution:")
L(wdf.combo.value_counts().to_string())

L(f"\n{'='*92}\nPERFORMANCE BY COMBO TYPE (top-2 per week)\n{'='*92}")
def report(sub, label, payoff, juice):
    n = len(sub); k = int(sub.both.sum()) if n>0 else 0
    if n==0: L(f"  {label:32s} (no weeks)"); return
    lo,hi = wilson_ci(k,n); roi = (sub.both * payoff + (1-sub.both) * (-1)).mean()*100
    L(f"  {label:32s} weeks={n:3d}  both_hit={k}/{n}={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  ROI{juice}={roi:+5.1f}%")

for juice,payoff in [("@-120", 100/120),("@-110",100/110),("@-130", 100/130)]:
    L(f"\n--- Pricing {juice} (per-$1 payoff = {payoff:.3f}) ---")
    report(wdf, "ALL combos (best 2/week)", payoff, juice)
    report(wdf[wdf.combo=="spread+spread"], "  spread + spread only", payoff, juice)
    report(wdf[wdf.combo=="total+total"],   "  total + total only", payoff, juice)
    report(wdf[wdf.combo=="spread+total"],  "  spread + total mixed", payoff, juice)

L(f"\nPer-season ALL combos @ -120:")
for Y in [2024,2025]:
    sy = wdf[wdf.season==Y]; n=len(sy); k=int(sy.both.sum())
    if n>0:
        roi = (sy.both*(100/120) - (1-sy.both)*1).mean()*100
        lo,hi = wilson_ci(k,n)
        L(f"  {Y}: weeks={n}  hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+.1f}%")
    # Combo breakdown per season
    for combo in ["spread+spread","total+total","spread+total"]:
        sub = sy[sy.combo==combo]
        if len(sub)>0:
            k=int(sub.both.sum()); n=len(sub)
            L(f"    {combo:18s}: weeks={n} hit={k/n*100:.1f}%")

# ----------------------------------------------------------------
# Same but with TOP-3 (more combinations)
# ----------------------------------------------------------------
L(f"\n{'='*92}\nTOP-3 PER WEEK, ALL COMBOS (3 pairs/week max) — bigger sample, market mix\n{'='*92}")
allp=[]
for (season,week), grp in cand.groupby(["season","week"]):
    grp = grp.sort_values("edge_mag", ascending=False).copy()
    # Top-3 distinct games
    seen=set(); top3=[]
    for _,r in grp.iterrows():
        gid = (r.home_ab, r.away_ab)
        if gid in seen: continue
        seen.add(gid); top3.append(r)
        if len(top3)==3: break
    if len(top3)<2: continue
    for i,j in combinations(range(len(top3)), 2):
        l1,l2 = top3[i], top3[j]
        combo = "+".join(sorted([l1.market, l2.market]))
        both = int(l1.teased_won==1 and l2.teased_won==1)
        allp.append({"season":int(season),"week":int(week),"combo":combo,"both":both,
                     "l1_rule":l1.rule,"l2_rule":l2.rule})
pdf = pd.DataFrame(allp)
L(f"\nTop-3 combos: {pdf.combo.value_counts().to_dict()}")
for juice,payoff in [("@-120",100/120),("@-110",100/110)]:
    L(f"\n--- Pricing {juice} ---")
    report(pdf, "ALL pairs from top-3", payoff, juice)
    report(pdf[pdf.combo=="spread+spread"], "  spread + spread", payoff, juice)
    report(pdf[pdf.combo=="total+total"],   "  total + total", payoff, juice)
    report(pdf[pdf.combo=="spread+total"],  "  spread + total mixed", payoff, juice)

# ----------------------------------------------------------------
# Sample weeks with explicit combo tags
# ----------------------------------------------------------------
L(f"\n{'='*92}\nSAMPLE WEEKS: top-2 with explicit market combo\n{'='*92}")
for _,r in wdf.iterrows():
    res = "WIN" if r.both==1 else "loss"
    L(f"  {r.season} W{r.week:2d} [{r.combo:13s}] {r.l1_rule:24s}/{r.l1_game:8s} ({r.l1_mkt}) + {r.l2_rule:24s}/{r.l2_game:8s} ({r.l2_mkt}) -> {res}")
