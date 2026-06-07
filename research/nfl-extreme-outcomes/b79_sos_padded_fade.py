"""
b79 — Strength-of-Schedule "padded team" fade (NFL replication of CFB Signal #4).

HYPOTHESIS (from CFB)
  A team with strong power rating built against a weak schedule, playing on the road, when the
  market spread still trusts that inflated rating → fade them. Hit 62-74% in CFB.

NFL CAVEAT (user warning)
  NFL schedules are more uniform than CFB (17 games, structured rotations), so SOS variance is
  smaller. Pre-check: is there enough SOS spread to matter?

METHOD
  1. Per game, build each team's AS-OF predictive_pr (already in matchup) — this IS the model PR
  2. Build season-to-date opponent-PR-faced as SOS (avg of prior opponents' predictive_pr that
     team has faced this year)
  3. Compute PR-implied spread = away_pr - home_pr (rough; pos = away better)
  4. Identify "padded teams": top-quartile PR + bottom-quartile SOS (faced weak opps)
  5. When the padded team is on the road and the market line gives them MORE than PR-implied →
     fade them (bet the other side)

FRAMEWORK RULES
  - As-of-week SOS (no leak)
  - Per-season + 2025 holdout
  - Confound check: does padded-road-fav fade still work AFTER controlling for spread bucket?
  - Pre-check #1: NFL SOS variance — verify there's enough signal in the SOS distribution
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m  = pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"] = m.home_score - m.away_score
g = m.merge(od[["season","home_ab","away_ab","open_spread"]], on=["season","home_ab","away_ab"], how="left")
g["spread"] = g.open_spread.fillna(g.home_spread)
g = g.dropna(subset=["spread","actual_margin","home_predictive_pr","away_predictive_pr"]).copy()
L(f"[load] {len(g)} games with PR + spread")

# Long form: one row per team-game with that team's PR and the opponent's PR
home_rows = g[["season","week","home_ab","away_ab","home_predictive_pr","away_predictive_pr"]].rename(
    columns={"home_ab":"team","away_ab":"opp","home_predictive_pr":"team_pr","away_predictive_pr":"opp_pr"})
away_rows = g[["season","week","away_ab","home_ab","away_predictive_pr","home_predictive_pr"]].rename(
    columns={"away_ab":"team","home_ab":"opp","away_predictive_pr":"team_pr","home_predictive_pr":"opp_pr"})
tg = pd.concat([home_rows, away_rows], ignore_index=True).sort_values(["season","team","week"])

# As-of SOS for each (season, team, week): average of opp_pr in prior weeks
def cumulative_sos(group):
    group = group.sort_values("week")
    cum_n = group.opp_pr.expanding().count().shift(1)
    cum_s = group.opp_pr.expanding().sum().shift(1)
    group["sos_prior_n"] = cum_n
    group["sos"] = cum_s / cum_n
    return group
tg = tg.groupby(["season","team"], group_keys=False).apply(cumulative_sos)

# Pre-check: SOS variance per season
L(f"\n{'='*92}\nPRE-CHECK: NFL SOS variance\n{'='*92}")
for s in sorted(tg.season.unique()):
    sy = tg[(tg.season==s) & (tg.sos_prior_n>=4)]
    if len(sy)==0: continue
    L(f"  {s}: SOS mean={sy.sos.mean():.3f}  std={sy.sos.std():.3f}  "
      f"q25={sy.sos.quantile(.25):.3f}  q75={sy.sos.quantile(.75):.3f}  range={sy.sos.max()-sy.sos.min():.3f}")
L(f"  NFL PR scale: home_predictive_pr mean={g.home_predictive_pr.mean():.2f} std={g.home_predictive_pr.std():.2f}")

# Attach SOS to each game (home + away)
g = g.merge(tg[["season","week","team","sos","sos_prior_n"]].rename(
              columns={"team":"home_ab","sos":"home_sos","sos_prior_n":"home_sos_n"}),
            on=["season","week","home_ab"], how="left")
g = g.merge(tg[["season","week","team","sos","sos_prior_n"]].rename(
              columns={"team":"away_ab","sos":"away_sos","sos_prior_n":"away_sos_n"}),
            on=["season","week","away_ab"], how="left")

# Need 4+ prior games for SOS to be meaningful (~mid-season onwards)
q = g[(g.home_sos_n>=4) & (g.away_sos_n>=4)].copy()
L(f"\n[qual] {len(q)} games with both teams 4+ prior games (mid-season+)")

# PR-implied spread (rough linear): if PR units ≈ points already, then
# expected home margin ≈ home_pr - away_pr + HFA. Use a simple HFA=2.0 estimate.
HFA = 2.0
q["pr_implied_margin_home"] = q.home_predictive_pr - q.away_predictive_pr + HFA
q["pr_implied_spread"] = -q["pr_implied_margin_home"]   # spread convention: neg = home favored
q["spread_minus_pr"] = q.spread - q.pr_implied_spread   # positive = market gives home worse spread than PR
# In NFL terms, if spread is -7 and pr_implied is -5, then spread_minus_pr = -2. Market makes
# home a heavier favorite than PR thinks. That makes home the "padded" pick.

# Define "padded road favorite" — focus on AWAY favorites since CFB version was about road favs
# AWAY favorite means spread > 0 (home gets points)
# AWAY team is the "padded" candidate if:
#   away_pr is high (top quartile by season)
#   away_sos is low (bottom quartile by season — faced weak opps)
#   spread gives away MORE than PR-implied (market trusts inflated PR)
def label_padded(df):
    by=[]
    for s, sub in df.groupby("season"):
        sub=sub.copy()
        pr_hi = sub.away_predictive_pr.quantile(0.75)
        sos_lo = sub.away_sos.quantile(0.25)
        sub["away_padded"] = ((sub.away_predictive_pr>=pr_hi) & (sub.away_sos<=sos_lo)).astype(int)
        pr_hi_h = sub.home_predictive_pr.quantile(0.75)
        sos_lo_h = sub.home_sos.quantile(0.25)
        sub["home_padded"] = ((sub.home_predictive_pr>=pr_hi_h) & (sub.home_sos<=sos_lo_h)).astype(int)
        by.append(sub)
    return pd.concat(by, ignore_index=True)
q = label_padded(q)
L(f"  padded-away counts by season:")
L(f"  {q.groupby('season').away_padded.sum().to_dict()}")
L(f"  padded-home counts by season:")
L(f"  {q.groupby('season').home_padded.sum().to_dict()}")

# Test: fade away-padded teams when (1) away is favored AND (2) line gives away more than PR
def hit_rate(df, bet_home):
    d = df.dropna(subset=["actual_margin","spread"]).copy()
    d["home_cov"] = (d.actual_margin + d.spread > 0).astype(float)
    d.loc[d.actual_margin + d.spread == 0, "home_cov"] = np.nan
    won = d.home_cov if bet_home else 1 - d.home_cov
    won = won.dropna(); n=len(won); k=int(won.sum())
    if n==0: return (0,0,0,0,0)
    lo,hi = wilson_ci(k,n)
    return (n,k, k/n*100, lo*100, hi*100)

L(f"\n{'='*92}\nSOS-PADDED ROAD FAVORITE FADE — per season\n{'='*92}")
L(f"  Fade away (bet home) when: away_favored AND away_padded=1 AND spread_minus_pr <= 0 (line gives away more than PR)\n")
for s in sorted(q.season.unique()):
    sub = q[(q.season==s) & (q.spread>0) & (q.away_padded==1) & (q.spread_minus_pr<=0)]
    # spread>0 means home is dog, away is fav; bet HOME (=fade away)
    n,k,p,lo,hi = hit_rate(sub, bet_home=True)
    if n<3: L(f"  {s}:  n={n} (too thin)"); continue
    L(f"  {s}:  n={n:3d}  fade-away (bet home)  hit={p:5.1f}%  CI[{lo:.0f},{hi:.0f}]")

L(f"\n  POOLED:")
sub = q[(q.spread>0) & (q.away_padded==1) & (q.spread_minus_pr<=0)]
n,k,p,lo,hi = hit_rate(sub, bet_home=True)
L(f"    n={n}  hit={k}/{n}={p:.1f}%  CI[{lo:.0f},{hi:.0f}]")
L(f"  HOLDOUT 2025:")
sub = q[(q.season==2025) & (q.spread>0) & (q.away_padded==1) & (q.spread_minus_pr<=0)]
n,k,p,lo,hi = hit_rate(sub, bet_home=True)
L(f"    n={n}  hit={k}/{n}={p:.1f}%  CI[{lo:.0f},{hi:.0f}]")

# Also test home-padded version (fade home favs when padded)
L(f"\n  PADDED HOME FAVORITE FADE (bet away when home_padded and home favored):")
for s in sorted(q.season.unique()):
    sub = q[(q.season==s) & (q.spread<0) & (q.home_padded==1) & (q.spread_minus_pr>=0)]
    n,k,p,lo,hi = hit_rate(sub, bet_home=False)
    if n<3: L(f"  {s}:  n={n} (too thin)"); continue
    L(f"  {s}:  n={n:3d}  fade-home (bet away)  hit={p:5.1f}%  CI[{lo:.0f},{hi:.0f}]")
sub = q[(q.spread<0) & (q.home_padded==1) & (q.spread_minus_pr>=0)]
n,k,p,lo,hi = hit_rate(sub, bet_home=False)
L(f"  POOLED: n={n}  hit={p:.1f}%")

# Confound check (rule #3): does padded-fade still work WITHIN spread buckets?
L(f"\n{'='*92}\nCONFOUND CHECK: signal within road-favorite spread buckets\n{'='*92}")
L(f"  Baseline home cover% (the side we'd bet) by spread bucket — no padded filter")
for lo_sp, hi_sp, name in [(0.5,3.5,"sm_road_fav"),(3.5,7.5,"md_road_fav"),(7.5,99,"big_road_fav")]:
    base = q[(q.spread>lo_sp) & (q.spread<=hi_sp)]
    n,k,p,_,_ = hit_rate(base, bet_home=True)
    L(f"    {name:13s} spread {lo_sp:.1f}-{hi_sp:.1f}:  base n={n}  home_cover={p:.1f}%")
    pad = base[(base.away_padded==1) & (base.spread_minus_pr<=0)]
    pn,pk,pp,plo,phi = hit_rate(pad, bet_home=True)
    if pn<5: L(f"      padded:        n={pn} (too thin)"); continue
    delta = pp - p
    L(f"      padded:        n={pn:3d}  home_cover={pp:.1f}%  CI[{plo:.0f},{phi:.0f}]  delta={delta:+.1f}pp")

L(f"\n{'-'*92}\nVerdict pending — see per-season pattern, sample sizes, and confound deltas above.")
