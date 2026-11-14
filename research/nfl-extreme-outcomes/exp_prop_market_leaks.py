#!/usr/bin/env python3
"""PROP MARKET vs GAME MARKET — is there a leak? (owner, 2026-09-18)  The RB attempts inflation looked like
a favorite-cover leak in 2023 (61%/136) and vanished. Pre-registered family of prop-vs-game signals, each
tested per season on covers / game over / team-total over, with a shuffled-outcome null so a 61% one-season
cell can be judged against chance.
Signals per team-game (2023-25):
  qb_att_infl   QB pass-attempts line − his entering average attempts
  qb_yds_infl   QB pass-yards line − his entering average yards
  rb_att_infl   lead back's rush-attempts line − his entering average
  rb_yds_infl   lead back's rush-yards line − his entering average
  pass_share    props-implied pass rate (QB att line / (QB att line + Σ RB att lines)) − team entering pass rate
  props_yds     props-implied yards (QB yds line + Σ RB yds lines) − team's implied points x league yds/pt
  att_move      QB attempts line move open→close (props_frame)   |  yds_move: QB yards line move
Outcomes: this team covers (vs close), game over, team-total over (pts > implied team total), team wins."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
QA = pd.read_parquet("data/_attempts_deep_frame.parquet"); QY = pd.read_parquet("data/_yds_deep_frame.parquet"); RA = pd.read_parquet("data/_rush_attempts_deep_frame.parquet"); RY = pd.read_parquet("data/_rush_yds_deep_frame.parquet")
K = ["season","week","team"]
def lead(df, col):
    x = df[df.close_line.notna()].copy(); x["base"] = x.szn.fillna(x.l5); x = x.sort_values("close_line", ascending=False).groupby(K).head(1); return x[K + ["close_line","base"]].rename(columns={"close_line": col + "_line", "base": col + "_base"})
def team_sum(df, col):
    x = df[df.close_line.notna()].groupby(K).close_line.sum().reset_index(); return x.rename(columns={"close_line": col})
T = lead(QA, "qb_att").merge(lead(QY, "qb_yds"), on=K, how="outer").merge(lead(RA, "rb_att"), on=K, how="outer").merge(lead(RY, "rb_yds"), on=K, how="outer").merge(team_sum(RA, "rb_att_sum"), on=K, how="left").merge(team_sum(RY, "rb_yds_sum"), on=K, how="left")
for c in ("qb_att","qb_yds","rb_att","rb_yds"): T[c + "_infl"] = T[c + "_line"] - T[c + "_base"]
tp = QA[QA.close_line.notna()].groupby(K).agg(passrate=("T_rp_passrate","first"), spread=("team_spread","first"), total=("total","first")).reset_index(); T = T.merge(tp, on=K, how="left")
T["pass_share"] = T.qb_att_line / (T.qb_att_line + T.rb_att_sum) - T.passrate
T["implied_tt"] = (T.total - T.spread) / 2; T["props_yds"] = (T.qb_yds_line + T.rb_yds_sum.fillna(0)) - T.implied_tt * 15.0   # ~15 scrimmage yards per point league-wide
# line moves (props_frame: per book open/close) — QB attempts and yards, median across books
pf = pd.read_parquet("data/props_frame.parquet"); pf = pf[pf.market.isin(["player_pass_attempts","player_pass_yds"]) & pf.open_line.notna() & pf.close_line.notna()]
pf["team"] = pf.team.replace({"LAR":"LA"}); mv = pf.groupby(["season","week","team","market"]).apply(lambda g: (g.close_line - g.open_line).median()).unstack("market").reset_index().rename(columns={"player_pass_attempts":"att_move","player_pass_yds":"yds_move"})
T = T.merge(mv, on=K, how="left")
m = pd.read_parquet("data/matchup.parquet")[["season","week","home_ab","away_ab","home_score","away_score","home_spread","nv_total_line"]]
m["home_ab"] = m.home_ab.replace({"LAR":"LA"}); m["away_ab"] = m.away_ab.replace({"LAR":"LA"})
h = m.rename(columns={"home_ab":"team","home_score":"pts","away_score":"opp_pts"}).assign(sp=lambda z: z.home_spread); a = m.rename(columns={"away_ab":"team","away_score":"pts","home_score":"opp_pts"}).assign(sp=lambda z: -z.home_spread)
G = pd.concat([h, a])[["season","week","team","pts","opp_pts","sp","nv_total_line"]]
X = T.merge(G, on=K, how="inner"); X["cover"] = ((X.pts - X.opp_pts + X.sp) > 0).astype(float); X.loc[(X.pts - X.opp_pts + X.sp) == 0, "cover"] = np.nan
X["over"] = ((X.pts + X.opp_pts) > X.nv_total_line).astype(float); X["tt_over"] = (X.pts > (X.nv_total_line - X.sp) / 2).astype(float); X["win"] = (X.pts > X.opp_pts).astype(float); X["fav"] = X.sp < 0
SIG = ["qb_att_infl","qb_yds_infl","rb_att_infl","rb_yds_infl","pass_share","props_yds","att_move","yds_move"]; OUT = ["cover","over","tt_over"]
print(f"{len(X)} team-games with results | signal coverage: " + ", ".join(f"{s} {X[s].notna().mean():.0%}" for s in SIG))
print("\nTOP vs BOTTOM QUINTILE of each signal, per season — outcome rate in the top quintile (n) / bottom quintile (n).  Chance = ~50% / ~50%.")
rows = []
for s in SIG:
    for o in OUT:
        line = f"  {s:12s} -> {o:8s}"
        for yr in (2023, 2024, 2025):
            x = X[(X.season == yr)].dropna(subset=[s, o]); q1, q4 = x[s].quantile(0.2), x[s].quantile(0.8); top, bot = x[x[s] >= q4], x[x[s] <= q1]
            line += f" | {yr}: {100*top[o].mean():4.1f}({len(top):3d}) / {100*bot[o].mean():4.1f}({len(bot):3d})"; rows.append((s, o, yr, top[o].mean(), len(top), bot[o].mean(), len(bot)))
        print(line)
R = pd.DataFrame(rows, columns=["sig","out","yr","top","ntop","bot","nbot"]); R["gap"] = R.top - R.bot
print("\nSTABLE cells (same sign of top−bottom gap in all three seasons, |gap| ≥ 5 pts each):")
for (s, o), g in R.groupby(["sig","out"]):
    if len(g) == 3 and (np.sign(g.gap).nunique() == 1) and (g.gap.abs() >= 0.05).all(): print(f"  {s} -> {o}: " + ", ".join(f"{int(r.yr)} {100*r.gap:+.1f}" for r in g.itertuples()))
print("  (none listed = nothing holds all three seasons)")
# NULL: shuffle outcomes within season, recompute the max |gap| over all signal x outcome cells, 200 times
rng = np.random.default_rng(0); mx = []
for rep in range(200):
    best = 0
    for yr in (2023, 2024, 2025):
        x = X[X.season == yr].copy()
        for o in OUT: x[o] = rng.permutation(x[o].values)
        for s in SIG:
            xx = x.dropna(subset=[s]); q1, q4 = xx[s].quantile(0.2), xx[s].quantile(0.8)
            for o in OUT:
                t, b = xx[xx[s] >= q4][o].dropna(), xx[xx[s] <= q1][o].dropna(); best = max(best, abs(t.mean() - b.mean()))
    mx.append(best)
print(f"\nNULL: with outcomes shuffled, the LARGEST top-vs-bottom gap across all {len(SIG)*len(OUT)*3} cells is {100*np.median(mx):.1f} pts (median), {100*np.percentile(mx, 95):.1f} pts (95th pct).")
print(f"REAL: largest gap observed = {100*R.gap.abs().max():.1f} pts ({R.loc[R.gap.abs().idxmax(), 'sig']} -> {R.loc[R.gap.abs().idxmax(), 'out']}, {int(R.loc[R.gap.abs().idxmax(), 'yr'])}).  If real ≈ null, the 2023 cell was chance.")
