"""
b87 — Deep dive on the b86 'naive baseline' finding: sum of teams' season-to-date scoring
averages compared to the market total. When sum > market by 2+, UNDER hit 58.8% in 2025.

This is mean reversion to the MARKET, not to the season avg. Different mechanism.

THINGS TO TEST
  1. Is the finding robust across ALL years (not just 2025)?
  2. Magnitude thresholds: 2pts, 3pts, 5pts, 7pts, 10pts edge — which is best?
  3. Asymmetric: OVER side vs UNDER side, are they different?
  4. Combined with cv_for/against: do high-variance teams amplify or dampen?
  5. Combined with def_pass_epa: does elite-defense agreement strengthen the signal?
  6. Confound check: is this just 'fade high totals'?
  7. Decay check: per-season pattern over 8 years
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m = pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_total"] = m.home_score + m.away_score
g = m.merge(od[["season","home_ab","away_ab","open_total"]], on=["season","home_ab","away_ab"], how="left")
g["total_line"] = g.open_total.fillna(g.nv_total_line if "nv_total_line" in g.columns else g.ou_vegas_line)
g = g.dropna(subset=["total_line","actual_total","home_score","away_score","week","season"]).copy()

# Build per-team asof_pts_for + asof_pts_against (walk-forward)
home = g[["season","week","home_ab","away_ab","home_score","away_score"]].rename(
    columns={"home_ab":"team","away_ab":"opp","home_score":"pts_for","away_score":"pts_against"})
away = g[["season","week","away_ab","home_ab","away_score","home_score"]].rename(
    columns={"away_ab":"team","home_ab":"opp","away_score":"pts_for","home_score":"pts_against"})
tg = pd.concat([home,away], ignore_index=True).sort_values(["season","team","week"])
def asof(group):
    group = group.sort_values("week")
    cn = group.pts_for.expanding().count().shift(1)
    group["asof_n"] = cn
    group["asof_pts_for"] = group.pts_for.expanding().sum().shift(1) / cn
    group["asof_pts_against"] = group.pts_against.expanding().sum().shift(1) / cn
    group["asof_for_std"] = group.pts_for.expanding().std().shift(1)
    group["asof_against_std"] = group.pts_against.expanding().std().shift(1)
    return group
tg = tg.groupby(["season","team"], group_keys=False).apply(asof)

# Attach to game frame for home + away
g = g.merge(tg[["season","week","team","asof_pts_for","asof_pts_against","asof_for_std","asof_against_std","asof_n"]].rename(
    columns={"team":"home_ab","asof_pts_for":"h_for","asof_pts_against":"h_against","asof_for_std":"h_for_std","asof_against_std":"h_against_std","asof_n":"h_n"}),
    on=["season","week","home_ab"], how="left")
g = g.merge(tg[["season","week","team","asof_pts_for","asof_pts_against","asof_for_std","asof_against_std","asof_n"]].rename(
    columns={"team":"away_ab","asof_pts_for":"a_for","asof_pts_against":"a_against","asof_for_std":"a_for_std","asof_against_std":"a_against_std","asof_n":"a_n"}),
    on=["season","week","away_ab"], how="left")
gq = g[(g.h_n>=4) & (g.a_n>=4)].copy()

# Two "predicted total" variants — they're different things
# Variant A: pure offensive sum (h_for + a_for) — what their scoring AVERAGE suggests
# Variant B: matchup-balanced (h_for + a_against)/2 + (a_for + h_against)/2 — closer to actual game prediction
gq["pred_A"] = gq.h_for + gq.a_for
gq["pred_B"] = ((gq.h_for + gq.a_against) + (gq.a_for + gq.h_against)) / 2
gq["edge_A"] = gq.pred_A - gq.total_line
gq["edge_B"] = gq.pred_B - gq.total_line
gq["went_over"] = (gq.actual_total > gq.total_line).astype(float)
gq.loc[gq.actual_total==gq.total_line, "went_over"] = np.nan

L(f"\n[setup] {len(gq)} games 2018-2025 with 4+ priors per team")
L(f"  pred_A (sum-of-scoring) mean edge vs market: {gq.edge_A.mean():+.2f}")
L(f"  pred_B (matchup-balanced)  mean edge vs market: {gq.edge_B.mean():+.2f}")

def grade(df, take_over):
    w = df.went_over.dropna() if take_over else (1-df.went_over).dropna()
    n=len(w); k=int(w.sum())
    if n==0: return (0,0,0,0,0,0)
    lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    return (n,k,k/n*100,lo*100,hi*100,roi)

# ============================================================================
# TEST 1: Per-season hit rates at multiple thresholds — both variants, both sides
# ============================================================================
L(f"\n{'='*92}\nTEST 1: per-season hit % at multiple thresholds — UNDER side (edge POSITIVE = bet UNDER)\n{'='*92}")
for variant, edge_col in [("pred_A (sum)","edge_A"), ("pred_B (matchup)","edge_B")]:
    L(f"\n  Variant: {variant}")
    L(f"  {'thr':>4s}  " + "  ".join([f"{int(s)}" for s in sorted(gq.season.unique())]) + "  POOLED")
    for thr in [2, 3, 5, 7, 10]:
        line = f"  +{thr:3d}  "
        pool_n=0; pool_k=0
        for s in sorted(gq.season.unique()):
            sub = gq[(gq.season==s) & (gq[edge_col]>=thr)]
            n,k,p,lo,hi,roi = grade(sub, take_over=False)
            line += f" {p:5.1f}({n:3d})" if n>=5 else f" --({n:3d})"
            pool_n += n; pool_k += k
        pool_p = pool_k/pool_n*100 if pool_n else 0
        line += f"  {pool_p:5.1f}({pool_n})"
        L(line)

L(f"\n{'='*92}\nOVER side (edge NEGATIVE = market thinks too high, bet OVER): test for asymmetry\n{'='*92}")
for variant, edge_col in [("pred_A","edge_A"), ("pred_B","edge_B")]:
    L(f"\n  Variant: {variant}")
    L(f"  {'thr':>4s}  " + "  ".join([f"{int(s)}" for s in sorted(gq.season.unique())]) + "  POOLED")
    for thr in [2, 3, 5, 7]:
        line = f"  -{thr:3d}  "
        pool_n=0; pool_k=0
        for s in sorted(gq.season.unique()):
            sub = gq[(gq.season==s) & (gq[edge_col]<=-thr)]
            n,k,p,lo,hi,roi = grade(sub, take_over=True)
            line += f" {p:5.1f}({n:3d})" if n>=5 else f" --({n:3d})"
            pool_n += n; pool_k += k
        pool_p = pool_k/pool_n*100 if pool_n else 0
        line += f"  {pool_p:5.1f}({pool_n})"
        L(line)

# ============================================================================
# TEST 2: Confound check — does this just become 'fade high totals'?
# ============================================================================
L(f"\n{'='*92}\nTEST 2: CONFOUND CHECK — is this just 'fade high totals'?\n{'='*92}")
L(f"  Baseline UNDER hit% by total band, AND signal UNDER hit% within same band:\n")
for lo_t, hi_t, name in [(0,42,"low"),(42,46.5,"mid"),(46.5,50,"high"),(50,99,"vhigh")]:
    base = gq[(gq.total_line>=lo_t) & (gq.total_line<hi_t)]
    bw = 1-base.went_over.dropna(); bn=len(bw); bk=int(bw.sum())
    bp = bk/bn*100 if bn else 0
    sig = base[base.edge_A>=3]
    sw = 1-sig.went_over.dropna(); sn=len(sw); sk=int(sw.sum())
    sp = sk/sn*100 if sn else 0
    L(f"    band {name:5s} (total {lo_t}-{hi_t}): base UNDER n={bn:4d} hit={bp:5.1f}%  signal(edge_A>=3) n={sn:3d} hit={sp:5.1f}%  delta={sp-bp:+.1f}pp")

# ============================================================================
# TEST 3: Combined with variance — do high-cv teams behave differently?
# ============================================================================
gq["max_cv_for"] = np.maximum(gq.h_for_std/gq.h_for, gq.a_for_std/gq.a_for)
gq["min_cv_for"] = np.minimum(gq.h_for_std/gq.h_for, gq.a_for_std/gq.a_for)
L(f"\n{'='*92}\nTEST 3: edge_A signal split by team variance (high vs low CV)\n{'='*92}")
for cv_label, mask in [("Low max_cv (both consistent)", gq.max_cv_for<=gq.max_cv_for.quantile(0.33)),
                       ("Mid",                         (gq.max_cv_for>gq.max_cv_for.quantile(0.33))&(gq.max_cv_for<=gq.max_cv_for.quantile(0.67))),
                       ("High max_cv (volatile)",      gq.max_cv_for>gq.max_cv_for.quantile(0.67))]:
    sub = gq[mask & (gq.edge_A>=3)]
    n,k,p,lo,hi,roi = grade(sub, take_over=False)
    L(f"  {cv_label:32s} edge_A>=3 UNDER  n={n:3d}  hit={p:5.1f}%  CI[{lo:.0f},{hi:.0f}]  ROI={roi:+.1f}%")

# ============================================================================
# TEST 4: Combined with stingy defense (def_pass_epa s2d <= median)
#   If both teams have GOOD defenses AND market total is below sum-of-offense,
#   does UNDER hit even more?
# ============================================================================
# Need def_pass_epa s2d
m_off = pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
def_cols = ["season","week","home_ab","away_ab","home_def_pass_epa_s2d","away_def_pass_epa_s2d"]
def_cols = [c for c in def_cols if c in m_off.columns]
if len(def_cols)==6:
    gq2 = gq.merge(m_off[def_cols], on=["season","week","home_ab","away_ab"], how="left")
    gq2["max_def_pass_epa"] = np.maximum(gq2.home_def_pass_epa_s2d, gq2.away_def_pass_epa_s2d)
    gq2["min_def_pass_epa"] = np.minimum(gq2.home_def_pass_epa_s2d, gq2.away_def_pass_epa_s2d)
    L(f"\n{'='*92}\nTEST 4: edge_A UNDER signal split by defensive quality\n{'='*92}")
    # "Elite" pass defense = bottom quartile of def_pass_epa_s2d (lower EPA allowed = better)
    elite_thr = gq2.min_def_pass_epa.quantile(0.25)
    L(f"  Both-elite-pass-D threshold: min_def_pass_epa <= {elite_thr:.3f}")
    for label, mask in [("Both elite pass D",  gq2.min_def_pass_epa<=elite_thr),
                        ("Neither elite",      gq2.min_def_pass_epa>gq2.min_def_pass_epa.quantile(0.75)),
                        ("All",                gq2.min_def_pass_epa.notna())]:
        sub = gq2[mask & (gq2.edge_A>=3)]
        n,k,p,lo,hi,roi = grade(sub, take_over=False)
        if n>0: L(f"  {label:25s} edge_A>=3 UNDER  n={n:3d}  hit={p:5.1f}%  CI[{lo:.0f},{hi:.0f}]  ROI={roi:+.1f}%")

# ============================================================================
# TEST 5: Decay analysis — is this a fading edge?
# ============================================================================
L(f"\n{'='*92}\nTEST 5: per-season decay check at edge_A>=3 UNDER (the headline signal)\n{'='*92}")
for s in sorted(gq.season.unique()):
    sub = gq[(gq.season==s) & (gq.edge_A>=3)]
    n,k,p,lo,hi,roi = grade(sub, take_over=False)
    if n<5: L(f"  {s}: n={n}"); continue
    L(f"  {s}: n={n:3d}  hit={k}/{n}={p:5.1f}%  CI[{lo:.0f},{hi:.0f}]  ROI={roi:+.1f}%")

# Pooled headline numbers
L(f"\n{'='*92}\nHEADLINE — pooled performance with HONEST per-season splits\n{'='*92}")
sub_all = gq[gq.edge_A>=3]
sub_24 = gq[(gq.season<2025) & (gq.edge_A>=3)]
sub_25 = gq[(gq.season==2025) & (gq.edge_A>=3)]
for name, df in [("ALL years (pooled)", sub_all),
                 ("Train 2018-2024",    sub_24),
                 ("HOLDOUT 2025",       sub_25)]:
    n,k,p,lo,hi,roi = grade(df, take_over=False)
    L(f"  {name:25s} edge_A>=3 UNDER  n={n:3d}  hit={k}/{n}={p:.1f}%  CI[{lo:.0f},{hi:.0f}]  ROI@-110={roi:+.1f}%")

# ============================================================================
# TEST 6: Asymmetric — does UNDER work better than OVER?
# ============================================================================
L(f"\n{'='*92}\nTEST 6: asymmetric check — UNDER edge vs OVER edge (mirror)\n{'='*92}")
for thr in [2,3,5,7]:
    u = gq[gq.edge_A>=thr]; o = gq[gq.edge_A<=-thr]
    nu,ku,pu,lou,hiu,roiu = grade(u, take_over=False)
    no,ko,po,loo,hio,roio = grade(o, take_over=True)
    L(f"  thr={thr}:  UNDER n={nu:3d} hit={pu:.1f}% ROI{roiu:+5.1f}%   |   OVER n={no:3d} hit={po:.1f}% ROI{roio:+5.1f}%")

L(f"\n{'-'*92}\nVerdict: see headline, per-season decay, confound deltas above")
