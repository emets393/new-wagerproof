"""
b78 — Team-form O/U mean reversion (NFL replication of CFB Signal #3).

HYPOTHESIS (from CFB)
  When BOTH teams come into a game with a high season over-rate (>=60% of their prior games
  went OVER), the next game goes UNDER ~58%. Over-streaks regress. CFB also found it strongest
  when posted total was NOT already high (<=58), which is the confound check: signal must beat
  the simple "fade-high-totals" baseline.

FRAMEWORK RULES applied
  - Walk-forward: as-of-week computation (each team's over-rate uses only games BEFORE the current)
  - Per-season + holdout (2024 train-period reveal, 2025 holdout)
  - Confound-check (rule #3): test signal WITHIN total bands. If the signal vanishes inside a band,
    it was just "fade high totals" reexpressed.
  - Signal-line = grade-line: signal uses opening total (computed at open or pre-game), grade vs open.
  - Honest sample sizes per season (rule #8).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
ma["actual_total"]  = ma.home_score + ma.away_score
g = ma.merge(od[["season","home_ab","away_ab","open_spread","open_total"]],
             on=["season","home_ab","away_ab"], how="left")
g["total_line"] = g.open_total.fillna(g.ou_vegas_line)
g = g.dropna(subset=["total_line","actual_total","home_score","away_score","week","season"]).copy()
g["went_over"]  = (g.actual_total > g.total_line).astype(int)
g.loc[g.actual_total==g.total_line, "went_over"] = np.nan   # push
L(f"[load] {len(g)} games {g.season.min()}-{g.season.max()}")

# Compute each team's AS-OF over-rate per (season, team, current_week): use only games STRICTLY
# before current_week. Long-form: one row per team per game.
home_rows = g[["season","week","home_ab","went_over"]].rename(columns={"home_ab":"team"})
away_rows = g[["season","week","away_ab","went_over"]].rename(columns={"away_ab":"team"})
tg = pd.concat([home_rows, away_rows], ignore_index=True).sort_values(["season","team","week"])

# For each row, compute prior-games-in-season over-rate (excludes current game)
def cumulative_priors(group):
    # cumulative count and over-count BEFORE current row
    group = group.sort_values("week")
    cum_n  = group.went_over.expanding().count().shift(1)
    cum_o  = group.went_over.expanding().sum().shift(1)
    group["prior_n"] = cum_n
    group["prior_over"] = cum_o
    group["prior_over_rate"] = cum_o / cum_n
    return group
tg = tg.groupby(["season","team"], group_keys=False).apply(cumulative_priors)
L(f"[asof] team-game frame: {len(tg)} rows; teams with >=3 prior games in season: ~{(tg.prior_n>=3).sum()}")

# Attach the home/away over-rate to each game
g = g.merge(tg[["season","week","team","prior_over_rate","prior_n"]].rename(
                columns={"team":"home_ab","prior_over_rate":"home_over_rate","prior_n":"home_prior_n"}),
            on=["season","week","home_ab"], how="left")
g = g.merge(tg[["season","week","team","prior_over_rate","prior_n"]].rename(
                columns={"team":"away_ab","prior_over_rate":"away_over_rate","prior_n":"away_prior_n"}),
            on=["season","week","away_ab"], how="left")

# Need both teams to have >=3 prior games to make rate meaningful
qualified = g[(g.home_prior_n>=3) & (g.away_prior_n>=3)].copy()
qualified["both_high_over"] = ((qualified.home_over_rate>=0.6) & (qualified.away_over_rate>=0.6)).astype(int)
qualified["both_low_over"]  = ((qualified.home_over_rate<=0.4) & (qualified.away_over_rate<=0.4)).astype(int)
L(f"[qual] {len(qualified)} games with both teams having >=3 prior games this season")

# Helper for per-cohort hit rate
def hit_rate(df, take_under):
    won = df.went_over.dropna()
    if take_under: won = 1 - won
    n = len(won); k = int(won.sum())
    if n==0: return (0,0,0,0,0)
    lo,hi = wilson_ci(k,n)
    return (n,k, k/n*100, lo*100, hi*100)

L(f"\n{'='*92}\nTEAM-FORM O/U MEAN REVERSION (raw, no confound check)\n{'='*92}")
L(f"  Bet UNDER when both teams' prior over-rate >= 60%")
L(f"  Bet OVER when both teams' prior over-rate <= 40%")

for season in sorted(qualified.season.unique()):
    sub_y = qualified[qualified.season==season]
    # Under-on-both-high
    bh = sub_y[sub_y.both_high_over==1]
    bl = sub_y[sub_y.both_low_over==1]
    n_u,k_u,p_u,lo_u,hi_u = hit_rate(bh, take_under=True)
    n_o,k_o,p_o,lo_o,hi_o = hit_rate(bl, take_under=False)
    L(f"  {season}:  both_high→UNDER n={n_u:3d} hit={p_u:5.1f}% [{lo_u:.0f},{hi_u:.0f}]   "
      f"both_low→OVER  n={n_o:3d} hit={p_o:5.1f}% [{lo_o:.0f},{hi_o:.0f}]")

# Pooled (with explicit per-year split visible)
L(f"\n  POOLED (2018-2025):")
bh = qualified[qualified.both_high_over==1]
bl = qualified[qualified.both_low_over==1]
n,k,p,lo,hi = hit_rate(bh, take_under=True)
L(f"    both_high→UNDER  n={n}  hit={k}/{n}={p:.1f}%  CI[{lo:.0f},{hi:.0f}]")
n,k,p,lo,hi = hit_rate(bl, take_under=False)
L(f"    both_low→OVER    n={n}  hit={k}/{n}={p:.1f}%  CI[{lo:.0f},{hi:.0f}]")

# Holdout 2025
L(f"\n  HOLDOUT 2025 ONLY:")
hold = qualified[qualified.season==2025]
bh = hold[hold.both_high_over==1]; bl = hold[hold.both_low_over==1]
n,k,p,lo,hi = hit_rate(bh, take_under=True)
L(f"    both_high→UNDER  n={n}  hit={k}/{n}={p:.1f}%  CI[{lo:.0f},{hi:.0f}]")
n,k,p,lo,hi = hit_rate(bl, take_under=False)
L(f"    both_low→OVER    n={n}  hit={k}/{n}={p:.1f}%  CI[{lo:.0f},{hi:.0f}]")

# ---------------------------------------------------------------------------
# CONFOUND CHECK — does signal still work WITHIN total bands?
# (The CFB version was stronger when posted total was NOT already high — proving it wasn't just
#  fade-high-totals dressed up. Replicate that test here.)
# ---------------------------------------------------------------------------
L(f"\n{'='*92}\nCONFOUND CHECK: signal WITHIN total bands (rule out 'fade high totals' explanation)\n{'='*92}")

bands = [("low",   qualified.total_line<=42),
         ("mid",   (qualified.total_line>42) & (qualified.total_line<=46.5)),
         ("high",  (qualified.total_line>46.5) & (qualified.total_line<=50)),
         ("vhigh", qualified.total_line>50)]

L(f"  Baseline UNDER hit-rate within each band (no form filter):")
for name, mask in bands:
    b = qualified[mask]
    n,k,p,lo,hi = hit_rate(b, take_under=True)
    L(f"    band={name:6s} (n={len(b):4d})  baseline_under={p:5.1f}%")

L(f"\n  both_high→UNDER hit-rate within each band (does signal beat baseline?):")
for name, mask in bands:
    sub = qualified[mask & (qualified.both_high_over==1)]
    n,k,p,lo,hi = hit_rate(sub, take_under=True)
    if n<5: L(f"    band={name:6s}  n={n}  (too thin)"); continue
    # baseline within band
    base = qualified[mask]
    bn,bk,bp,_,_ = hit_rate(base, take_under=True)
    delta = p - bp
    L(f"    band={name:6s}  n={n:3d}  signal_under={p:5.1f}%  CI[{lo:.0f},{hi:.0f}]  baseline={bp:5.1f}%  delta={delta:+.1f}pp")

L(f"\n  both_low→OVER hit-rate within each band:")
for name, mask in bands:
    sub = qualified[mask & (qualified.both_low_over==1)]
    n,k,p,lo,hi = hit_rate(sub, take_under=False)
    if n<5: L(f"    band={name:6s}  n={n}  (too thin)"); continue
    base = qualified[mask]
    bn,bk,bp,_,_ = hit_rate(base, take_under=False)
    delta = p - bp
    L(f"    band={name:6s}  n={n:3d}  signal_over={p:5.1f}%  CI[{lo:.0f},{hi:.0f}]  baseline={bp:5.1f}%  delta={delta:+.1f}pp")

# ---------------------------------------------------------------------------
# Decay check (rule #10): is the signal fading season-over-season as markets adapt?
# ---------------------------------------------------------------------------
L(f"\n{'='*92}\nDECAY CHECK (rule #10): is the signal fading season-over-season?\n{'='*92}")
L(f"  Yearly both_high→UNDER hit %:")
for season in sorted(qualified.season.unique()):
    sub = qualified[(qualified.season==season) & (qualified.both_high_over==1)]
    n,k,p,lo,hi = hit_rate(sub, take_under=True)
    if n<3: L(f"    {season}:  n={n} (too thin)"); continue
    L(f"    {season}:  n={n:3d}  hit={p:5.1f}%  CI[{lo:.0f},{hi:.0f}]")

L(f"\n{'-'*92}\nVerdict pending — see CI overlaps, per-season pattern, and confound deltas above.")
