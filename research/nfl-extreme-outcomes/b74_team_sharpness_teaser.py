"""
b74 — TEAM-LEVEL VEGAS-SHARPNESS overlay for teaser candidate filtering.

HYPOTHESIS (user-driven)
  Some teams Vegas is sharp on (small |line - actual| errors), some teams Vegas is soft on
  (large errors). For teasers, we want games where BOTH teams have been historically sharp —
  because the line is well-calibrated, and teasing it 6 points lands us in a high-confidence
  zone. Soft teams = unpredictable outcomes = teaser unreliable.

IMPLEMENTATION
  For each (season, team), compute:
    sharp_spread = mean(|actual_margin - market_margin|) across team's games
    sharp_total  = mean(|actual_total - market_total|)  across team's games
  Where market_margin = -home_spread if team=home else home_spread.
  Lower = sharper.

  Walk-forward: for game in season Y, use sharpness computed from PRIOR seasons only
  (sliding window: prior 2 seasons, requires min 20 games to be reliable).

  Per-game "matchup sharpness" = mean of both teams' historical sharpness.

  Layer this onto b73 teaser candidates:
    1. all candidates
    2. require BOTH teams in the matchup to be below median sharpness (sharper than avg)
    3. require BOTH teams in TOP QUARTILE sharpness (sharpest)
  Test if the filter boosts per-leg teased hit % and 2-team teaser ROI.

DATA
  - Outcomes + closing spread/total from matchup_arch (2018-2025)
  - Use closing spread as "the line" for sharpness — for 2018-2022 we only have close
  - For 2023-2025 the difference between using open vs close as the sharpness benchmark
    is small (line moves <1pt mean); we'll use close consistently
"""
import os, sys, warnings
from itertools import combinations
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from forecast_harness import build, generate
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

# ---------- STEP 1: build per-(season, team) sharpness from matchup_arch ----
ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
ma["actual_margin"] = ma.home_score - ma.away_score
ma["actual_total"]  = ma.home_score + ma.away_score
ma["spread_err"]    = (ma.actual_margin - (-ma.home_spread)).abs()
ma["total_err"]     = (ma.actual_total - ma.ou_vegas_line).abs()

# Long form: one row per team per game
home = ma[["season","week","home_ab","spread_err","total_err"]].rename(columns={"home_ab":"team"})
away = ma[["season","week","away_ab","spread_err","total_err"]].rename(columns={"away_ab":"team"})
tg = pd.concat([home, away], ignore_index=True)

# Per-season per-team sharpness
sea_sharp = tg.groupby(["season","team"]).agg(
    n=("spread_err","count"),
    sharp_spread=("spread_err","mean"),
    sharp_total=("total_err","mean")
).reset_index()
L(f"\n[sharpness] computed for {len(sea_sharp)} (season, team) rows")
L(f"  League-avg spread error per season:")
for Y in sorted(sea_sharp.season.unique()):
    sy = sea_sharp[sea_sharp.season==Y]
    L(f"    {Y}: spread_err mean={sy.sharp_spread.mean():.2f}  std={sy.sharp_spread.std():.2f}  "
      f"total_err mean={sy.sharp_total.mean():.2f}  std={sy.sharp_total.std():.2f}")

# Show a few examples of sharpest/softest teams 2024
L(f"\n  Sharpest teams (spread) in 2024:")
ex = sea_sharp[sea_sharp.season==2024].sort_values("sharp_spread").head(5)
for _,r in ex.iterrows(): L(f"    {r.team}: spread_err={r.sharp_spread:.2f}  total_err={r.sharp_total:.2f}")
L(f"  Softest teams (spread) in 2024:")
ex = sea_sharp[sea_sharp.season==2024].sort_values("sharp_spread", ascending=False).head(5)
for _,r in ex.iterrows(): L(f"    {r.team}: spread_err={r.sharp_spread:.2f}  total_err={r.sharp_total:.2f}")

# ---------- STEP 2: walk-forward team sharpness ranking -----------------------
# For test year Y, use prior 2 seasons (Y-2, Y-1) combined to compute each team's sharpness
def wf_sharpness(target):
    """Return DataFrame indexed by team with sharp_spread, sharp_total from PRIOR 2 seasons."""
    prev = tg[(tg.season>=target-2) & (tg.season<target)]
    if len(prev)==0: return pd.DataFrame(columns=["team","sharp_spread","sharp_total","n"])
    return prev.groupby("team").agg(
        n=("spread_err","count"),
        sharp_spread=("spread_err","mean"),
        sharp_total=("total_err","mean")
    ).reset_index()

# ---------- STEP 3: run teaser candidate generation ---------------------------
ELIGIBLE_RULES = ["receiver_over_HC","top_vs_top_pt_home","legacy_fade","fade_pr_in_tight_game"]
m, BASE = build(); m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score
all_picks=[]
for Y in [2024,2025]:
    led,_ = generate(m, BASE, Y); led["season"]=Y; all_picks.append(led)
picks = pd.concat(all_picks, ignore_index=True)
for c in ["away_ab","home_ab","actual_margin","actual_total","win","clv_pts","roi_u"]:
    if c in picks.columns: picks = picks.drop(columns=[c])
picks["away_ab"]=picks.game.str.split("@").str[0]; picks["home_ab"]=picks.game.str.split("@").str[1]
mm = m[["season","week","home_ab","away_ab","actual_margin","actual_total"]].copy()
picks = picks.merge(mm, on=["season","week","home_ab","away_ab"], how="left")

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

cand = picks[picks.rule.isin(ELIGIBLE_RULES)].dropna(subset=["teased_won"]).copy()
sm_conf = picks[(picks.rule=="sides_model")&(picks.get("confluence",0)==1)].dropna(subset=["teased_won"]).copy()
cand = pd.concat([cand, sm_conf], ignore_index=True)
cand["edge_mag"] = cand.edge.abs()

# ---------- STEP 4: attach sharpness to each candidate leg --------------------
def attach_sharpness(df):
    """For each row, attach home_sharp_spread, away_sharp_spread, home_sharp_total, away_sharp_total
       from prior-2-seasons walk-forward sharpness."""
    out=[]
    for Y, ydf in df.groupby("season"):
        ws = wf_sharpness(Y)
        ydf = ydf.merge(ws.add_prefix("home_").rename(columns={"home_team":"home_ab"}),
                        on="home_ab", how="left")
        ydf = ydf.merge(ws.add_prefix("away_").rename(columns={"away_team":"away_ab"}),
                        on="away_ab", how="left")
        out.append(ydf)
    return pd.concat(out, ignore_index=True)

cand = attach_sharpness(cand)
L(f"\n[attach] sharpness merged. coverage: home_sharp_spread = {cand.home_sharp_spread.notna().sum()}/{len(cand)}")

# Per-leg: matchup sharpness = mean of both teams' spread or total sharpness
cand["matchup_sharp_spread"] = (cand.home_sharp_spread + cand.away_sharp_spread) / 2
cand["matchup_sharp_total"]  = (cand.home_sharp_total  + cand.away_sharp_total)  / 2

# Use the relevant sharpness for each leg's market
def relevant_sharp(row):
    return row.matchup_sharp_total if row.market=="total" else row.matchup_sharp_spread
cand["leg_sharp"] = cand.apply(relevant_sharp, axis=1)

# Per-year tier: top quartile = "very sharp", bottom quartile = "very soft"
def tier_sharp(df, market):
    by_year = []
    for Y, sub in df[df.market==market].groupby("season"):
        q25, q50, q75 = sub.leg_sharp.quantile([0.25,0.50,0.75])
        sub = sub.copy()
        sub["sharp_tier"] = pd.cut(sub.leg_sharp, [-1,q25,q50,q75,99],
                                    labels=["VERY_SHARP","SHARP","SOFT","VERY_SOFT"])
        by_year.append(sub)
    return pd.concat(by_year, ignore_index=True) if by_year else df

spread_legs = tier_sharp(cand[cand.market=="spread"], "spread")
total_legs  = tier_sharp(cand[cand.market=="total"],  "total")
cand2 = pd.concat([spread_legs, total_legs], ignore_index=True)

# ---------- STEP 5: per-leg teased hit% by sharpness tier ---------------------
L(f"\n{'='*92}\nPER-LEG teased hit% by matchup sharpness tier (walk-forward, prior 2 seasons)\n{'='*92}")
L(f"  Lower 'leg_sharp' = Vegas more accurate on these teams = teaser more reliable\n")
for mkt in ["spread","total"]:
    sub = cand2[cand2.market==mkt]
    L(f"  Market: {mkt.upper()}  (n={len(sub)})")
    for tier in ["VERY_SHARP","SHARP","SOFT","VERY_SOFT"]:
        t = sub[sub.sharp_tier==tier]; won = t.teased_won.dropna()
        if len(won)==0: continue
        n=len(won); k=int(won.sum()); lo,hi=wilson_ci(k,n); mean_sharp = t.leg_sharp.mean()
        L(f"    {tier:12s} avg_sharp={mean_sharp:5.2f}  n={n:3d}  hit={k}/{n}={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
    L("")

# ---------- STEP 6: 2-team teaser with sharpness overlay ----------------------
def build_topN_per_week(df, n_top=2):
    weekly=[]
    for (season,week), grp in df.groupby(["season","week"]):
        grp = grp.sort_values("edge_mag", ascending=False)
        seen=set(); top=[]
        for _,r in grp.iterrows():
            gid=(r.home_ab,r.away_ab)
            if gid in seen: continue
            seen.add(gid); top.append(r)
            if len(top)==n_top: break
        if len(top)<n_top: continue
        weekly.append(top)
    return weekly

def grade_2team(weekly_picks, payoff):
    pairs=[]
    for top in weekly_picks:
        l1,l2 = top[0], top[1]
        w1,w2 = l1.teased_won, l2.teased_won
        if pd.isna(w1) or pd.isna(w2): continue
        both = int(w1==1 and w2==1)
        pnl = payoff if both else -1.0
        # avg sharpness across the 2 legs
        avg_sharp = (l1.leg_sharp + l2.leg_sharp)/2 if pd.notna(l1.leg_sharp) and pd.notna(l2.leg_sharp) else np.nan
        pairs.append({"season":int(l1.season),"week":int(l1.week),"both":both,"pnl":pnl,
                      "avg_sharp":avg_sharp,
                      "min_sharp":(min(l1.leg_sharp, l2.leg_sharp) if pd.notna(l1.leg_sharp) and pd.notna(l2.leg_sharp) else np.nan),
                      "max_sharp":(max(l1.leg_sharp, l2.leg_sharp) if pd.notna(l1.leg_sharp) and pd.notna(l2.leg_sharp) else np.nan),
                      "combo":"+".join(sorted([l1.market,l2.market]))})
    return pd.DataFrame(pairs)

L(f"\n{'='*92}\n2-TEAM TEASER (top-2 per week) with SHARPNESS overlay\n{'='*92}")
weekly = build_topN_per_week(cand2, n_top=2)
all_pairs = grade_2team(weekly, payoff=100/120)
L(f"\nAll top-2 weeks (baseline): n={len(all_pairs)}  hit={all_pairs.both.mean()*100:.1f}%  ROI={all_pairs.pnl.mean()*100:+.1f}%")

# Filter by max_sharp (the WORST of the two — the bottleneck)
# Lower max_sharp = both teams in this pair were sharp
L(f"\nBy max_sharp (the worse of the two — both must be sharp to qualify):")
for q in [0.25, 0.50, 0.75, 1.0]:
    if q < 1.0:
        thr = all_pairs.max_sharp.quantile(q)
        sub = all_pairs[all_pairs.max_sharp <= thr]
        label = f"  max_sharp <= {q*100:.0f}th pct ({thr:.2f}):"
    else:
        sub = all_pairs
        label = f"  all (no filter):                "
    if len(sub)>0:
        n=len(sub); k=int(sub.both.sum()); roi=sub.pnl.mean()*100; lo,hi=wilson_ci(k,n)
        L(f"  {label} n={n:3d}  hit={k}/{n}={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+5.1f}%")

# Filter by avg_sharp
L(f"\nBy avg_sharp (mean of the two legs):")
for q in [0.25, 0.50, 0.75, 1.0]:
    if q < 1.0:
        thr = all_pairs.avg_sharp.quantile(q)
        sub = all_pairs[all_pairs.avg_sharp <= thr]
        label = f"  avg_sharp <= {q*100:.0f}th pct ({thr:.2f}):"
    else:
        sub = all_pairs
        label = f"  all (no filter):                "
    if len(sub)>0:
        n=len(sub); k=int(sub.both.sum()); roi=sub.pnl.mean()*100; lo,hi=wilson_ci(k,n)
        L(f"  {label} n={n:3d}  hit={k}/{n}={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+5.1f}%")

# Same for top-3 (more sample)
L(f"\n{'='*92}\n2-TEAM TEASER (all combos from top-3 per week) with SHARPNESS overlay\n{'='*92}")
weekly3 = build_topN_per_week(cand2, n_top=3)
pairs3=[]
for top in weekly3:
    for i,j in combinations(range(len(top)),2):
        l1,l2 = top[i], top[j]
        w1,w2 = l1.teased_won, l2.teased_won
        if pd.isna(w1) or pd.isna(w2): continue
        both = int(w1==1 and w2==1)
        pnl = (100/120) if both else -1.0
        max_s = max(l1.leg_sharp, l2.leg_sharp) if pd.notna(l1.leg_sharp) and pd.notna(l2.leg_sharp) else np.nan
        avg_s = (l1.leg_sharp + l2.leg_sharp)/2 if pd.notna(l1.leg_sharp) and pd.notna(l2.leg_sharp) else np.nan
        pairs3.append({"season":int(l1.season),"week":int(l1.week),"both":both,"pnl":pnl,
                       "avg_sharp":avg_s,"max_sharp":max_s,
                       "combo":"+".join(sorted([l1.market,l2.market]))})
pdf3 = pd.DataFrame(pairs3)
L(f"\nAll top-3 pairs (baseline): n={len(pdf3)} hit={pdf3.both.mean()*100:.1f}% ROI={pdf3.pnl.mean()*100:+.1f}%")
L(f"\nBy max_sharp quartile (more sample):")
for q in [0.25, 0.50, 0.75, 1.0]:
    if q<1.0:
        thr = pdf3.max_sharp.quantile(q)
        sub = pdf3[pdf3.max_sharp<=thr]
        label = f"  max_sharp <= {q*100:.0f}th ({thr:.2f}):"
    else:
        sub = pdf3
        label = f"  all (no filter):           "
    if len(sub)>0:
        n=len(sub); k=int(sub.both.sum()); roi=sub.pnl.mean()*100; lo,hi=wilson_ci(k,n)
        L(f"  {label} n={n:4d}  hit={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+5.1f}%")

# Combine sharpness filter with market combo
L(f"\nMARKET combo + max_sharp <= 50th pct (top-3 sample, the operational sweet spot):")
thr50 = pdf3.max_sharp.quantile(0.50)
sub = pdf3[pdf3.max_sharp<=thr50]
for combo in ["spread+spread","total+total","spread+total"]:
    c = sub[sub.combo==combo]
    if len(c)>0:
        n=len(c); k=int(c.both.sum()); roi=c.pnl.mean()*100; lo,hi=wilson_ci(k,n)
        L(f"  {combo:14s}  n={n:3d}  hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  ROI={roi:+.1f}%")

# Per-season check
L(f"\nPer-season for max_sharp<=50th pct (top-3 all combos):")
for Y in [2024,2025]:
    sy = pdf3[(pdf3.season==Y)&(pdf3.max_sharp<=thr50)]
    if len(sy)>0:
        n=len(sy); k=int(sy.both.sum()); roi=sy.pnl.mean()*100; lo,hi=wilson_ci(k,n)
        L(f"  {Y}: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

L(f"\n{'-'*92}")
L(f"VERDICT: does the team-sharpness overlay improve teasers?")
