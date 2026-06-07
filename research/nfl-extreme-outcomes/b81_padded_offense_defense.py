"""
b81 — SOS-ADJUSTED offense + defense: identify teams whose unit stats are PADDED.

REFINEMENT FROM b79
  b79 used aggregate PR + aggregate SOS and failed. The hypothesis here is sharper:
    - A team can have a great-looking OFFENSE that was built against weak defenses
    - A team can have a great-looking DEFENSE that was built against weak offenses
    - These two paddings live independently — a team can be padded on one side and clean on the other
  Markets may price these aggregately (via PR or implied team total), missing the unit-level padding.

METHODOLOGY (walk-forward, no leak)
  For each team-week as-of:
    raw_off_PPG    = team's PPG scored in prior games this season
    raw_def_PPG    = team's PPG allowed in prior games this season
    opp_def_PPG    = avg of prior opponents' SEASON-TO-DATE PPG_allowed (BEFORE they played us)
                     = defensive strength of the schedule the team has faced
    opp_off_PPG    = avg of prior opponents' SEASON-TO-DATE PPG_scored (BEFORE they played us)
                     = offensive strength of schedule the team has faced

    league_off_avg = season-to-date league average PPG scored
    league_def_avg = season-to-date league average PPG allowed

    off_padding    = (league_def_avg - opp_def_PPG)
                     positive = opponents were WEAK defenses (allowed more than avg)
                     → team's raw_off is inflated by this amount

    def_padding    = (league_off_avg - opp_off_PPG)
                     positive = opponents were WEAK offenses (scored less than avg)
                     → team's raw_def looks better than it is by this amount

  Then per-game, check whether market line OVER-trusts the padded ratings:
    - Team has high padded offense AND is favored → fade them (bet the spread+other-side)
    - Team has high padded defense AND total is low → take the OVER
    - And inverse for "clean against tough" teams

FRAMEWORK RULES
  - As-of week computation (no leak)
  - Per-season + 2025 holdout
  - Confound check by spread bucket / total bucket
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
m["actual_total"]  = m.home_score + m.away_score
g = m.merge(od[["season","home_ab","away_ab","open_spread","open_total"]], on=["season","home_ab","away_ab"], how="left")
g["spread_use"] = g.open_spread.fillna(g.home_spread)
g["total_use"]  = g.open_total.fillna(g.nv_total_line if "nv_total_line" in g.columns else g.ou_vegas_line)
g = g.dropna(subset=["spread_use","total_use","home_score","away_score","week","season"]).copy()
L(f"[load] {len(g)} games")

# Build long-form team-game frame with that game's points scored/allowed and current opponent
home_rows = g[["season","week","home_ab","away_ab","home_score","away_score"]].rename(
    columns={"home_ab":"team","away_ab":"opp","home_score":"pts_for","away_score":"pts_against"})
away_rows = g[["season","week","away_ab","home_ab","away_score","home_score"]].rename(
    columns={"away_ab":"team","home_ab":"opp","away_score":"pts_for","home_score":"pts_against"})
tg = pd.concat([home_rows, away_rows], ignore_index=True).sort_values(["season","team","week"])

# As-of: team's prior PPG (excludes current game)
def asof_team(group):
    group = group.sort_values("week")
    cum_n = group.pts_for.expanding().count().shift(1)
    group["asof_n"]       = cum_n
    group["asof_off_PPG"] = group.pts_for.expanding().sum().shift(1) / cum_n
    group["asof_def_PPG"] = group.pts_against.expanding().sum().shift(1) / cum_n
    return group
tg = tg.groupby(["season","team"], group_keys=False).apply(asof_team)

# League season-to-date avg PPG (excludes current week)
def league_asof(df):
    rows=[]
    for s in sorted(df.season.unique()):
        sy = df[df.season==s].sort_values("week")
        for w in sorted(sy.week.unique()):
            prior = sy[sy.week < w]
            if len(prior)==0: continue
            rows.append({"season":s,"week":w,
                         "league_off_PPG": prior.pts_for.mean(),
                         "league_def_PPG": prior.pts_against.mean()})
    return pd.DataFrame(rows)
league = league_asof(tg)
tg = tg.merge(league, on=["season","week"], how="left")

# Opponent's AS-OF rating (the opponent's stats as they entered this game). For each team-week,
# look at each PRIOR opponent and get THEIR asof_def_PPG / asof_off_PPG as of the week they played us.
opp_lookup = tg[["season","week","team","asof_off_PPG","asof_def_PPG"]].rename(
    columns={"team":"opp","asof_off_PPG":"opp_asof_off_PPG","asof_def_PPG":"opp_asof_def_PPG"})
tg = tg.merge(opp_lookup, on=["season","week","opp"], how="left")
L(f"[asof] team-game rows: {len(tg)}")

# For each team-week NOW, look at all PRIOR rows for this team and compute mean of opp ratings
def asof_sos(group):
    group = group.sort_values("week")
    group["opp_def_PPG_avg"] = group.opp_asof_def_PPG.expanding().mean().shift(1)
    group["opp_off_PPG_avg"] = group.opp_asof_off_PPG.expanding().mean().shift(1)
    return group
tg = tg.groupby(["season","team"], group_keys=False).apply(asof_sos)

# Compute padding metrics
tg["off_padding"] = tg.league_def_PPG - tg.opp_def_PPG_avg   # +ve: faced weak defenses (allowed > league avg)
tg["def_padding"] = tg.league_off_PPG - tg.opp_off_PPG_avg   # +ve: faced weak offenses (scored < league avg)
tg["off_adj"] = tg.asof_off_PPG - tg.off_padding             # discount raw offense by padding
tg["def_adj"] = tg.asof_def_PPG + tg.def_padding             # increase raw defense allowed by padding

# Pre-check
qual = tg[(tg.asof_n>=4) & tg.off_padding.notna() & tg.def_padding.notna()].copy()
L(f"\n{'='*92}\nPRE-CHECK: padding distribution (after 4+ games played)\n{'='*92}")
for s in sorted(qual.season.unique()):
    sy = qual[qual.season==s]
    L(f"  {s}: off_padding mean={sy.off_padding.mean():+.2f}  std={sy.off_padding.std():.2f}  "
      f"q25={sy.off_padding.quantile(.25):+.2f}  q75={sy.off_padding.quantile(.75):+.2f}")
    L(f"        def_padding mean={sy.def_padding.mean():+.2f}  std={sy.def_padding.std():.2f}  "
      f"q25={sy.def_padding.quantile(.25):+.2f}  q75={sy.def_padding.quantile(.75):+.2f}")

# Attach to per-game frame for both home and away
keep = ["season","week","team","asof_off_PPG","asof_def_PPG","off_padding","def_padding","off_adj","def_adj","asof_n"]
g2 = g.merge(qual[keep].rename(columns={"team":"home_ab",**{c:f"h_{c}" for c in keep[3:]}}),
             on=["season","week","home_ab"], how="left")
g2 = g2.merge(qual[keep].rename(columns={"team":"away_ab",**{c:f"a_{c}" for c in keep[3:]}}),
              on=["season","week","away_ab"], how="left")
gq = g2[(g2.h_asof_n>=4) & (g2.a_asof_n>=4)].copy()
L(f"\n[qual] {len(gq)} games where both teams have 4+ prior games")

# ---------------------------------------------------------------------------
# SIGNAL 1: padded-offense team FADE on spread
# When a team has a padded offense (off_padding >> 0) AND is favored, fade them
# ---------------------------------------------------------------------------
L(f"\n{'='*92}\nSIGNAL 1: FADE the spread of teams with PADDED offense (favored side overvalued)\n{'='*92}")
# For each game, identify if home OR away is favored
gq["fav_off_pad"] = np.where(gq.spread_use<0, gq.h_off_padding, gq.a_off_padding)
gq["dog_off_pad"] = np.where(gq.spread_use<0, gq.a_off_padding, gq.h_off_padding)
gq["home_cov"]   = (gq.actual_margin + gq.spread_use > 0).astype(float)
gq.loc[gq.actual_margin + gq.spread_use == 0, "home_cov"] = np.nan
# Bet the dog (fade the favorite) when favorite has off_padding above threshold
def hit_dog(df):
    won = np.where(df.spread_use<0, 1-df.home_cov, df.home_cov)
    won = pd.Series(won, index=df.index).dropna()
    if len(won)==0: return (0,0,0,0,0)
    n=len(won); k=int(won.sum()); lo,hi=wilson_ci(k,n)
    return (n,k,k/n*100,lo*100,hi*100)

for s in sorted(gq.season.unique()):
    sy = gq[gq.season==s]
    for thr,name in [(1.5,">1.5"),(2.5,">2.5"),(3.5,">3.5")]:
        sub = sy[sy.fav_off_pad > thr]
        n,k,p,lo,hi = hit_dog(sub)
        if n<5: continue
        L(f"  {s}  off_pad {name}: n={n:3d}  fade-fav hit={p:5.1f}%  CI[{lo:.0f},{hi:.0f}]")
L(f"\n  POOLED at off_pad>2.5:")
sub = gq[gq.fav_off_pad>2.5]
n,k,p,lo,hi = hit_dog(sub)
L(f"    n={n}  fade-fav hit={k}/{n}={p:.1f}%  CI[{lo:.0f},{hi:.0f}]")
L(f"  HOLDOUT 2025 at off_pad>2.5:")
sub = gq[(gq.season==2025) & (gq.fav_off_pad>2.5)]
n,k,p,lo,hi = hit_dog(sub)
L(f"    n={n}  fade-fav hit={p:.1f}%  CI[{lo:.0f},{hi:.0f}]")

# ---------------------------------------------------------------------------
# SIGNAL 2: padded-DEFENSE team — bet OVER when their TOTAL is set low because
# their fluffy stats anchor the line
# ---------------------------------------------------------------------------
L(f"\n{'='*92}\nSIGNAL 2: bet OVER when a team has PADDED defense (line set too low)\n{'='*92}")
gq["max_def_pad"] = np.maximum(gq.h_def_padding, gq.a_def_padding)
gq["actual_over"] = (gq.actual_total > gq.total_use).astype(float)
gq.loc[gq.actual_total == gq.total_use, "actual_over"] = np.nan
for s in sorted(gq.season.unique()):
    sy = gq[gq.season==s]
    for thr,name in [(2.0,">2"),(3.0,">3"),(4.0,">4")]:
        sub = sy[sy.max_def_pad > thr]
        w = sub.actual_over.dropna(); n=len(w); k=int(w.sum())
        if n<5: continue
        lo,hi=wilson_ci(k,n)
        L(f"  {s}  max_def_pad {name}: n={n:3d}  OVER hit={k/n*100:5.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
L(f"\n  POOLED max_def_pad>3:")
sub = gq[gq.max_def_pad>3]
w = sub.actual_over.dropna(); n=len(w); k=int(w.sum())
lo,hi=wilson_ci(k,n)
L(f"    n={n}  OVER hit={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
L(f"  HOLDOUT 2025 max_def_pad>3:")
sub = gq[(gq.season==2025) & (gq.max_def_pad>3)]
w = sub.actual_over.dropna(); n=len(w); k=int(w.sum())
lo,hi=wilson_ci(k,n) if n>0 else (0,0)
L(f"    n={n}  OVER hit={k/n*100 if n>0 else 0:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")

# ---------------------------------------------------------------------------
# SIGNAL 3: padded vs clean — "padded offense team plays a clean-against-tough defense"
# A team with high off_padding meets a team with low def_padding (faced strong offenses).
# The market may not realize the asymmetry. Fade the padded-offense team.
# ---------------------------------------------------------------------------
L(f"\n{'='*92}\nSIGNAL 3: padded-offense team vs CLEAN-against-tough defense — fade the padded\n{'='*92}")
# fav has padded off (positive), opp has clean defense (def_padding negative — faced strong offenses)
gq["fav_off_pad_v2"] = np.where(gq.spread_use<0, gq.h_off_padding, gq.a_off_padding)
gq["opp_def_pad_v2"] = np.where(gq.spread_use<0, gq.a_def_padding, gq.h_def_padding)
for s in sorted(gq.season.unique()):
    sy = gq[gq.season==s]
    sub = sy[(sy.fav_off_pad_v2 > 2) & (sy.opp_def_pad_v2 < 0)]
    n,k,p,lo,hi = hit_dog(sub)
    if n<5: continue
    L(f"  {s}  pad_off>2 & opp_def_pad<0: n={n:3d}  fade-fav hit={p:5.1f}%  CI[{lo:.0f},{hi:.0f}]")
sub = gq[(gq.fav_off_pad_v2>2) & (gq.opp_def_pad_v2<0)]
n,k,p,lo,hi = hit_dog(sub)
L(f"\n  POOLED: n={n}  fade-fav hit={p:.1f}%  CI[{lo:.0f},{hi:.0f}]")
sub = gq[(gq.season==2025) & (gq.fav_off_pad_v2>2) & (gq.opp_def_pad_v2<0)]
n,k,p,lo,hi = hit_dog(sub)
L(f"  HOLDOUT 2025: n={n}  fade-fav hit={p:.1f}%")

# Confound check: padded-offense fade WITHIN spread bands
L(f"\n{'='*92}\nCONFOUND CHECK: padded-offense fade WITHIN spread bands\n{'='*92}")
for lo_sp, hi_sp, name in [(0.5,3.5,"sm_fav"),(3.5,7.5,"md_fav"),(7.5,99,"big_fav")]:
    # Use abs spread to capture both home and away favorites
    base = gq[(gq.spread_use.abs()>=lo_sp) & (gq.spread_use.abs()<hi_sp)]
    n_base = len(base)
    won_base = np.where(base.spread_use<0, 1-base.home_cov, base.home_cov)
    won_base = pd.Series(won_base, index=base.index).dropna()
    if len(won_base)==0: continue
    base_dog_pct = (1 - won_base).mean() * 100   # base dog cover% (= 100 - fade fav %)
    # Hmm rephrase: hit_dog returns fade-fav hit% = how often dog covered
    base_fade = won_base.mean()*100
    sig = base[base.fav_off_pad>2.5]
    won_sig = np.where(sig.spread_use<0, 1-sig.home_cov, sig.home_cov)
    won_sig = pd.Series(won_sig, index=sig.index).dropna()
    if len(won_sig)<5: L(f"  {name:8s}: signal n={len(won_sig)} (thin)"); continue
    sig_pct = won_sig.mean()*100
    L(f"  {name:8s} n_base={n_base:4d}  base fade-fav={base_fade:.1f}%  signal n={len(won_sig):3d} fade-fav={sig_pct:.1f}%  delta={sig_pct-base_fade:+.1f}pp")

L(f"\n{'-'*92}\nVerdict pending — see per-season pattern and confound deltas above.")
