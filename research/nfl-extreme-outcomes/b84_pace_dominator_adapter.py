"""
b84 — Pace dominator vs pace adapter (CFB Signal #7).

HYPOTHESIS
  Some teams IMPOSE their pace on the game (dominators) — their games consistently play at
  their own season-avg tempo regardless of opponent. Other teams ADAPT to the opponent's pace
  (adapters) — their games' tempo shifts with whoever they face.
  When a dominator plays an adapter, the game plays at the dominator's pace. If the total
  doesn't reflect this asymmetry, edge.

METRIC
  For each team, walk-forward dominance score:
    For each prior game: pace_diff = (this_game_total_plays - team_season_avg_plays)
    For each prior game: opp_pull = (opp_season_avg_plays - team_season_avg_plays)
    dominance_score = -corr(pace_diff, opp_pull)
      ≈ -1: team strongly adapts to opp (high pull correlation = pace shifts toward opp)
      ≈ 0:  no relationship — team's pace independent of opp
      ≈ +1: team's pace moves OPPOSITE to opp (rare — actively counter-paces)

  Simpler alternative: PACE_VOLATILITY = std(game_pace) / mean(game_pace) for team's prior games
    Low volatility = consistent pace (dominator)
    High volatility = adapts (adapter)

FRAMEWORK RULES
  - Walk-forward (rule 1) — score computed from PRIOR games only, applied to current
  - Per-season + 2025 holdout (rule 2)
  - Confound check (rule 3): does the pace edge survive within total bands? Or is it just
    "fade extreme totals" reexpressed?
  - Honest sample sizes (rule 8) — likely thin given the specificity of the pairing
  - NFL caveat (rule 11): markets watch pace closely, expect mostly priced
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m  = pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_total"] = m.home_score + m.away_score
m["actual_margin"] = m.home_score - m.away_score
g = m.merge(od[["season","home_ab","away_ab","open_total","open_spread"]],
            on=["season","home_ab","away_ab"], how="left")
g["total_line"] = g.open_total.fillna(g.nv_total_line if "nv_total_line" in g.columns else g.ou_vegas_line)
g["spread_use"] = g.open_spread.fillna(g.home_spread)
g = g.dropna(subset=["total_line","actual_total","week","season"]).copy()

# Pace proxy: total game plays = home offensive plays + away offensive plays
# Use plays_per_game_s2d as a fallback if game-specific not available
# Look for actual game plays — try anet_ppd (plays per drive) * drives, OR use plays_seen
g["home_plays"] = g.get("home_off_plays_seen", np.nan)
g["away_plays"] = g.get("away_off_plays_seen", np.nan)
g["game_pace"] = g.home_plays + g.away_plays   # actual total plays this game
n_pace = g.game_pace.notna().sum()
L(f"[load] {len(g)} games; game_pace available for {n_pace} ({n_pace/len(g)*100:.1f}%)")

if n_pace < 500:
    # Fallback to season-to-date plays-per-game as pace estimate
    L(f"[fallback] using s2d plays/game as pace proxy")
    g["game_pace"] = g.get("home_off_plays_per_game_s2d", 65) + g.get("away_off_plays_per_game_s2d", 65)

g = g.dropna(subset=["game_pace"]).copy()
L(f"[load] {len(g)} games after pace filter; mean game_pace = {g.game_pace.mean():.1f}, std = {g.game_pace.std():.1f}")

# Long-form: one row per team-game with this game's pace and team identity
hr = g[["season","week","home_ab","away_ab","game_pace"]].rename(columns={"home_ab":"team","away_ab":"opp"})
ar = g[["season","week","away_ab","home_ab","game_pace"]].rename(columns={"away_ab":"team","home_ab":"opp"})
tg = pd.concat([hr,ar], ignore_index=True).sort_values(["season","team","week"])

# As-of season pace per team
def asof_pace(group):
    group = group.sort_values("week")
    cn = group.game_pace.expanding().count().shift(1)
    cs = group.game_pace.expanding().sum().shift(1)
    group["asof_n"]    = cn
    group["asof_pace"] = cs / cn
    group["asof_pace_std"] = group.game_pace.expanding().std().shift(1)
    return group
tg = tg.groupby(["season","team"], group_keys=False).apply(asof_pace)

# Opponent's asof pace as they entered this game
opp_lookup = tg[["season","week","team","asof_pace"]].rename(columns={"team":"opp","asof_pace":"opp_asof_pace"})
tg = tg.merge(opp_lookup, on=["season","week","opp"], how="left")

# Dominance score per team-week: how strongly do team's games TRACK opp_asof_pace vs stay at own_asof_pace?
def dominance(group):
    group = group.sort_values("week")
    # For each prior game: pace_resid = game_pace - asof_pace (at the time of that game)
    # opp_pull = opp_asof_pace_at_that_time - team_asof_pace_at_that_time
    # dominance = -corr(pace_resid, opp_pull)  [negative because high corr = adapts]
    # Compute rolling, using all prior games
    scores=[]
    pace_resids = (group.game_pace - group.asof_pace).values
    opp_pulls   = (group.opp_asof_pace - group.asof_pace).values
    for i in range(len(group)):
        # use prior rows only (exclude this row's outcome)
        if i < 4:
            scores.append(np.nan); continue
        pr = pace_resids[:i][~np.isnan(pace_resids[:i])]
        op = opp_pulls[:i][~np.isnan(opp_pulls[:i])]
        n = min(len(pr), len(op))
        if n < 3:
            scores.append(np.nan); continue
        c = np.corrcoef(pr[:n], op[:n])[0,1]
        scores.append(-c if not np.isnan(c) else np.nan)
    group["dominance"] = scores
    # Also compute pace volatility CV
    cv = group.asof_pace_std / group.asof_pace
    group["pace_cv"] = cv
    return group
tg = tg.groupby(["season","team"], group_keys=False).apply(dominance)
L(f"[dominance] computed")

# Pre-check: dominance distribution
qual = tg[(tg.asof_n>=5) & tg.dominance.notna()].copy()
L(f"\n{'='*92}\nPRE-CHECK: dominance distribution (NFL teams, after 5+ games)\n{'='*92}")
for s in sorted(qual.season.unique()):
    sy = qual[qual.season==s]
    L(f"  {s}: dominance mean={sy.dominance.mean():+.3f}  std={sy.dominance.std():.3f}  "
      f"q25={sy.dominance.quantile(.25):+.3f}  q75={sy.dominance.quantile(.75):+.3f}")
# Most dominant / most adaptive teams in 2024 for sanity
ex24 = qual[(qual.season==2024)&(qual.asof_n>=10)].groupby("team").dominance.last().sort_values()
L(f"\n  2024 most ADAPTIVE teams (dominance <<0):")
for t,d in ex24.head(5).items(): L(f"    {t}: dominance={d:+.3f}")
L(f"  2024 most DOMINANT teams (dominance >>0):")
for t,d in ex24.tail(5).items(): L(f"    {t}: dominance={d:+.3f}")

# Attach to per-game frame
keep = ["season","week","team","dominance","asof_pace","asof_pace_std","asof_n"]
gq = g.merge(qual[keep].rename(columns={"team":"home_ab","dominance":"h_dom","asof_pace":"h_pace","asof_pace_std":"h_pcsd","asof_n":"h_n"}),
             on=["season","week","home_ab"], how="left")
gq = gq.merge(qual[keep].rename(columns={"team":"away_ab","dominance":"a_dom","asof_pace":"a_pace","asof_pace_std":"a_pcsd","asof_n":"a_n"}),
              on=["season","week","away_ab"], how="left")
gq = gq[(gq.h_n>=5) & (gq.a_n>=5)].copy()
L(f"\n[qual] {len(gq)} games with both teams 5+ priors")

# Bet logic: pace dominator (positive dominance) vs adapter (negative dominance)
# When dominator's own pace differs significantly from adapter's, predict game plays at dominator's pace
# Predicted game pace = h_pace * h_dom_weight + a_pace * a_dom_weight (weighted by dominance)
# But simpler: identify the more DOMINANT team and use their pace as the predicted game total influence

gq["dom_diff"] = gq.h_dom - gq.a_dom   # positive = home is more dominant
gq["pace_diff"] = gq.h_pace - gq.a_pace
# When home is dominator and home pace > away pace → expect OVER (game runs at home's higher pace)
# When home is dominator and home pace < away pace → expect UNDER
# Strength: |dom_diff| * |pace_diff|
gq["over_signal"] = ((gq.h_dom > 0.3) & (gq.a_dom < -0.1) & (gq.h_pace > gq.a_pace+2)) | \
                    ((gq.a_dom > 0.3) & (gq.h_dom < -0.1) & (gq.a_pace > gq.h_pace+2))
gq["under_signal"]= ((gq.h_dom > 0.3) & (gq.a_dom < -0.1) & (gq.h_pace < gq.a_pace-2)) | \
                    ((gq.a_dom > 0.3) & (gq.h_dom < -0.1) & (gq.a_pace < gq.h_pace-2))

gq["went_over"] = (gq.actual_total > gq.total_line).astype(float)
gq.loc[gq.actual_total==gq.total_line, "went_over"] = np.nan

L(f"\n{'='*92}\nDOMINATOR-vs-ADAPTER SIGNAL — per-season hit rates\n{'='*92}")
L(f"  OVER signal: dominator plays adapter, dominator has higher pace\n")
for s in sorted(gq.season.unique()):
    sub = gq[(gq.season==s) & gq.over_signal]
    w = sub.went_over.dropna(); n=len(w); k=int(w.sum())
    if n<3: L(f"  {s} OVER: n={n}"); continue
    lo,hi = wilson_ci(k,n)
    L(f"  {s} OVER:  n={n:3d}  hit={k/n*100:5.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
L(f"\n  POOLED OVER:")
sub = gq[gq.over_signal]; w=sub.went_over.dropna(); n,k=len(w),int(w.sum())
lo,hi=wilson_ci(k,n) if n else (0,0)
L(f"    n={n}  hit={k/n*100 if n else 0:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")

L(f"\n  UNDER signal: dominator plays adapter, dominator has lower pace\n")
for s in sorted(gq.season.unique()):
    sub = gq[(gq.season==s) & gq.under_signal]
    w = 1-sub.went_over.dropna(); n=len(w); k=int(w.sum())
    if n<3: L(f"  {s} UNDER: n={n}"); continue
    lo,hi = wilson_ci(k,n)
    L(f"  {s} UNDER: n={n:3d}  hit={k/n*100:5.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
L(f"\n  POOLED UNDER:")
sub = gq[gq.under_signal]; w=1-sub.went_over.dropna(); n,k=len(w),int(w.sum())
lo,hi=wilson_ci(k,n) if n else (0,0)
L(f"    n={n}  hit={k/n*100 if n else 0:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")

# Alternative metric: PACE_CV (volatility-based dominance)
L(f"\n{'='*92}\nALTERNATIVE: PACE VOLATILITY (low CV = dominator, high CV = adapter)\n{'='*92}")
gq["h_pcv"] = gq.h_pcsd / gq.h_pace
gq["a_pcv"] = gq.a_pcsd / gq.a_pace
# Identify "rigid dominator" (low pcv) vs "flexible adapter" (high pcv) pairings
gq["rigid_high_pace"] = ((gq.h_pcv < gq.h_pcv.median()) & (gq.h_pace > gq.a_pace+3) & (gq.a_pcv > gq.a_pcv.median())) | \
                        ((gq.a_pcv < gq.a_pcv.median()) & (gq.a_pace > gq.h_pace+3) & (gq.h_pcv > gq.h_pcv.median()))
gq["rigid_low_pace"]  = ((gq.h_pcv < gq.h_pcv.median()) & (gq.h_pace < gq.a_pace-3) & (gq.a_pcv > gq.a_pcv.median())) | \
                        ((gq.a_pcv < gq.a_pcv.median()) & (gq.a_pace < gq.h_pace-3) & (gq.h_pcv > gq.h_pcv.median()))

L(f"  rigid_high_pace OVER signal:")
for s in sorted(gq.season.unique()):
    sub = gq[(gq.season==s) & gq.rigid_high_pace]
    w = sub.went_over.dropna(); n=len(w); k=int(w.sum())
    if n<3: L(f"  {s}: n={n}"); continue
    lo,hi = wilson_ci(k,n); L(f"  {s}: n={n:3d}  hit={k/n*100:5.1f}%")
sub = gq[gq.rigid_high_pace]; w=sub.went_over.dropna(); n,k=len(w),int(w.sum())
if n>0:
    lo,hi=wilson_ci(k,n); L(f"  POOLED: n={n}  hit={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")

L(f"\n  rigid_low_pace UNDER signal:")
for s in sorted(gq.season.unique()):
    sub = gq[(gq.season==s) & gq.rigid_low_pace]
    w = 1-sub.went_over.dropna(); n=len(w); k=int(w.sum())
    if n<3: L(f"  {s}: n={n}"); continue
    lo,hi = wilson_ci(k,n); L(f"  {s}: n={n:3d}  hit={k/n*100:5.1f}%")
sub = gq[gq.rigid_low_pace]; w=1-sub.went_over.dropna(); n,k=len(w),int(w.sum())
if n>0:
    lo,hi=wilson_ci(k,n); L(f"  POOLED: n={n}  hit={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")

# Confound check: do these signals survive WITHIN total bands?
L(f"\n{'='*92}\nCONFOUND CHECK: signal within total bands\n{'='*92}")
for sig_name, mask, take_over in [("over_signal", gq.over_signal, True),
                                    ("under_signal", gq.under_signal, False),
                                    ("rigid_high_pace", gq.rigid_high_pace, True),
                                    ("rigid_low_pace", gq.rigid_low_pace, False)]:
    L(f"\n  {sig_name} (bet {'OVER' if take_over else 'UNDER'}):")
    for lo_t, hi_t, name in [(0,43,"low"),(43,47,"mid"),(47,99,"high")]:
        base = gq[(gq.total_line>=lo_t)&(gq.total_line<hi_t)]
        sig = base[mask.loc[base.index]]
        if take_over:
            base_w = base.went_over.dropna(); sig_w = sig.went_over.dropna()
        else:
            base_w = (1-base.went_over).dropna(); sig_w = (1-sig.went_over).dropna()
        if len(sig_w)<5: L(f"    {name:5s} sig n={len(sig_w)} (thin)"); continue
        bp = base_w.mean()*100; sp = sig_w.mean()*100; delta = sp-bp
        L(f"    {name:5s} base n={len(base_w):4d} base={bp:.1f}%  sig n={len(sig_w):3d} sig={sp:.1f}%  delta={delta:+.1f}pp")

L(f"\n{'-'*92}\nVerdict pending — see per-season hit rates, sample sizes, and confound deltas above.")
