"""
VALUE-WEIGHTED INJURY analysis (uses the player-level data we now have).
- Each skill player's importance = prior-weeks NGS air-yards share / target share (leak-safe, s2d).
- From injuries_raw (Out+Doubtful), weight missing players by that importance -> 'offensive value out'.
- QB out (starter) flag. OL/defense out = counts.
- Test vs the CLOSING line (pricing inefficiency): do injured teams cover less / go under, beyond the line?
  Per-season + permutation null. (Injuries are pregame-known to the market too, so this is a PRICING test,
  not an information edge.)
"""
import os, sys
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from scipy import stats as st
rng = np.random.default_rng(0)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
inj = pd.read_parquet(os.path.join(DATA, "injuries_raw.parquet"))
rec = pd.read_parquet(os.path.join(DATA, "ngs_receiving.parquet"))
pas = pd.read_parquet(os.path.join(DATA, "ngs_passing.parquet"))
g = pd.read_parquet(os.path.join(DATA, "games_enriched.parquet"))

# ---- per-player leak-safe importance, carried forward into weeks they're OUT ----
def prior_importance(df, col, outname):
    df = df.sort_values(["player_id", "season", "week"]).copy()
    # cumulative mean of PRIOR played weeks (importance entering each played week)
    df["_cum"] = df.groupby(["player_id", "season"])[col].apply(
        lambda s: s.shift(1).expanding().mean()).reset_index(level=[0, 1], drop=True)
    # build full (season, player_id, week 1..22) grid and forward-fill so OUT weeks get last-known value
    players = df[["season", "player_id"]].drop_duplicates()
    weeks = pd.DataFrame({"week": range(1, 23)})
    grid = players.merge(weeks, how="cross").merge(
        df[["season", "player_id", "week", "_cum"]], on=["season", "player_id", "week"], how="left")
    grid = grid.sort_values(["season", "player_id", "week"])
    grid[outname] = grid.groupby(["season", "player_id"])["_cum"].ffill()
    return grid[["season", "week", "player_id", outname]]

imp = prior_importance(rec, "percent_share_of_intended_air_yards", "airshare_prior")
qbimp = prior_importance(pas, "attempts", "att_prior")

# ---- injuries: Out + Doubtful = missing ----
miss = inj[inj.report_status.isin(["Out", "Doubtful"])].copy()
miss = miss.merge(imp, on=["season", "week", "player_id"], how="left")
miss = miss.merge(qbimp, on=["season", "week", "player_id"], how="left")
SKILL = {"WR", "TE", "RB", "FB"}
OL = {"T", "G", "C", "OL", "OT", "OG"}
miss["is_skill"] = miss.position.isin(SKILL)
miss["is_qb"] = miss.position == "QB"
miss["is_ol"] = miss.position.isin(OL)
# value-weighted offensive loss: air-yards share of missing skill (fill missing importance with small default)
miss["airshare_out"] = np.where(miss.is_skill, miss.airshare_prior.fillna(0), 0.0)
miss["qb_starter_out"] = np.where(miss.is_qb & (miss.att_prior.fillna(0) >= 15), 1.0, 0.0)  # a real starter (15+ att/g)

team_inj = miss.groupby(["season", "week", "team"]).agg(
    airshare_out=("airshare_out", "sum"),
    n_skill_out=("is_skill", "sum"),
    n_ol_out=("is_ol", "sum"),
    qb_starter_out=("qb_starter_out", "max"),
    n_out_total=("player_id", "size"),
).reset_index()
join_rate = miss[miss.is_skill].airshare_prior.notna().mean()
L(f"[build] team-weeks with injuries: {len(team_inj)} | skill-injury importance join rate: {join_rate*100:.0f}%")

# ---- team-game outcomes from games_enriched (2018-25, lines) ----
gg = g[(g.game_type == "REG") & (g.season >= 2018) & g.home_score.notna() & g.spread_line.notna()].copy()
gg["result"] = gg.home_score - gg.away_score; gg["total_pts"] = gg.home_score + gg.away_score
rows = []
for r in gg.itertuples():
    for team, ishome in ((r.home_team, 1), (r.away_team, 0)):
        cov = (r.result > r.spread_line) if ishome else (r.result < r.spread_line)
        push = (r.result == r.spread_line)
        rows.append(dict(season=r.season, week=r.week, team=team, opp=(r.away_team if ishome else r.home_team),
                         is_home=ishome, team_cover=(np.nan if push else float(cov)),
                         su_win=float((r.result > 0) == bool(ishome)),
                         over=(np.nan if r.total_pts == r.total_line else float(r.total_pts > r.total_line)),
                         total_pts=r.total_pts, total_line=r.total_line))
d = pd.DataFrame(rows).merge(team_inj, on=["season", "week", "team"], how="left").fillna(
    {"airshare_out": 0, "n_skill_out": 0, "n_ol_out": 0, "qb_starter_out": 0, "n_out_total": 0})
# opponent injuries + differential
oppi = team_inj.rename(columns={"team": "opp", "airshare_out": "opp_airshare_out", "qb_starter_out": "opp_qb_out",
                                "n_skill_out": "opp_skill_out"})[["season", "week", "opp", "opp_airshare_out", "opp_qb_out", "opp_skill_out"]]
d = d.merge(oppi, on=["season", "week", "opp"], how="left").fillna({"opp_airshare_out": 0, "opp_qb_out": 0, "opp_skill_out": 0})
d["airshare_diff"] = d.airshare_out - d.opp_airshare_out   # >0 = WE are more injured (offense)
L(f"[merge] team-games 2018-25: {len(d)} | with any skill air-share out: {(d.airshare_out>0).sum()}")
L(f"  airshare_out distribution: {d.airshare_out.describe()[['mean','75%','max']].round(1).to_dict()}")


def per_season(label, sub, outcome):
    rows = []
    for s in sorted(sub.season.dropna().unique()):
        oc = sub[sub.season == s][outcome].dropna()
        rows.append(bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), str(int(s))))
    oc = sub[outcome].dropna(); allr = bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), "ALL")
    nyr = sum(1 for r in rows if r.get("n", 0) >= 8); beat = sum(1 for r in rows if r.get("n", 0) >= 8 and r.get("hit", 0) >= 0.524)
    L(f"  >> {label:46s} [{beat}/{nyr} szn] {fmt(allr)}")


L("\n" + "=" * 88); L("VALUE-WEIGHTED INJURY vs the CLOSING line (pricing-inefficiency test, 2018-25)"); L("=" * 88)

L("\n[1] Continuous correlations (does injury burden predict cover/total beyond the line?):")
for col in ["airshare_out", "n_skill_out", "qb_starter_out", "airshare_diff"]:
    d1 = d.dropna(subset=[col, "team_cover"]); d2 = d.dropna(subset=[col, "over"])
    L(f"  corr({col:16s}, cover)={st.pearsonr(d1[col], d1.team_cover)[0]:+.3f}  corr(.,over)={st.pearsonr(d2[col], d2.over)[0]:+.3f}")

L("\n[2] HEAVY offensive injuries (top air-share-out) -> team ATS & UNDER:")
thr = d[d.airshare_out > 0].airshare_out.quantile(0.75)
heavy = d[d.airshare_out >= thr]
per_season(f"team air-share-out>={thr:.0f}: team ATS cover", heavy, "team_cover")
per_season(f"team air-share-out>={thr:.0f}: game UNDER", heavy.assign(u=1 - heavy.over), "u")

L("\n[3] QB starter OUT -> team ATS / UNDER / ML (vs close):")
qo = d[d.qb_starter_out == 1]
per_season("QB starter out: team ATS", qo, "team_cover")
per_season("QB starter out: UNDER", qo.assign(u=1 - qo.over), "u")
per_season("QB starter out: team ML (SU)", qo, "su_win")

L("\n[4] INJURY DIFFERENTIAL (we more injured than opp) -> fade us ATS:")
inj_edge = d[d.airshare_diff >= 10]   # we are missing 10%+ more air-share than opp
per_season("we 10%+ more air-share-out: our ATS", inj_edge, "team_cover")
healthy_edge = d[d.airshare_diff <= -10]
per_season("opp 10%+ more air-share-out: our ATS", healthy_edge, "team_cover")

L("\n[5] SKILL injuries -> totals (does market under-adjust non-QB skill losses?):")
for k in [1, 2, 3]:
    sub = d[d.n_skill_out >= k]
    per_season(f">={k} skill players out: UNDER", sub.assign(u=1 - sub.over), "u")

L("\n[null] heavy air-share-out UNDER vs chance:")
sub = heavy.assign(u=1 - heavy.over).dropna(subset=["u"]); real = sub.u.mean(); n = len(sub)
allu = (1 - d.over).dropna().values
nulls = [rng.choice(allu, n, replace=False).mean() for _ in range(3000)]
L(f"  under={real*100:.1f}% (n={n}) p(|dev|>=real)={np.mean([abs(x-.5)>=abs(real-.5) for x in nulls]):.2f}")
