#!/usr/bin/env python3
"""v4 — early-season fix (owner mandate 2026-09-17).

The v3 dissection fits reset each September, so weeks 1-6 have near-empty
entering-game state and the model is weak early. v4 SEEDS every entering-game
value with the prior season's, shrinking it out as current games accrue:

  - composites: selective carry (only the 7 with YoY r>=0.35)
  - fit_scheme_pass: team per-shell passing efficiency AND opp shell diet both
    prior-season-seeded (Rodgers' 2024 vs-Cover-2 -> 2025 wk1); shells are
    coach/QB-driven and persist
  - concept/timing fits: prior-season-seeded

Evaluate the FULL v3 feature set (not stripped) by WEEK BUCKET, wk1+.
"""
import numpy as np
import pandas as pd

AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR",
"Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET",
"Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA",
"Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE",
"Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA",
"49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
CARRY = ['c_qb_hold', 'c_runblock', 'c_recv_playmaking', 'c_rz_usage', 'c_passrush',
         'c_scheme_man', 'c_scheme_twohigh']
K_PRIOR = 5


def num(s):
    return pd.to_numeric(s, errors="coerce")


def seeded(df, keys, gamecol, prior_map=None, k=K_PRIOR):
    """entering-game value seeded with prior-season mean (prior_map: {key->val})."""
    df = df.sort_values(keys)
    grp = df.groupby(keys[:-1] if len(keys) > 1 else keys)[gamecol]
    return grp


# ---------- shell efficiency (offense) + diet (defense), prior-season seeded ----
sc = pd.read_parquet("data/fpdata/split_recv_adv_x_coverage.parquet")
sc["tgt"] = num(sc.playerStatsReceivingTargetsTotal); sc["yds"] = num(sc.playerStatsReceivingYardsTotal)
SHELLS = ["Cover 1", "Cover 2", "Cover 3", "Cover 4", "Cover 6", "Cover 0"]
sc = sc[sc.playDefenseCoverageSchemeParent.isin(SHELLS)]
# offense per shell per team-game
og = sc.groupby(["teamAbbreviation", "__season", "__week", "playDefenseCoverageSchemeParent"]).agg(
    y=("yds", "sum"), t=("tgt", "sum")).reset_index().rename(columns={"teamAbbreviation": "ab"})
# prior-season efficiency per team per shell
pri_o = og.groupby(["ab", "__season", "playDefenseCoverageSchemeParent"]).apply(
    lambda g: g.y.sum() / max(g.t.sum(), 1)).rename("ypt_prior").reset_index()
pri_o["nxt"] = pri_o.__season + 1
og = og.sort_values(["ab", "__season", "__week"])
gk = og.groupby(["ab", "__season", "playDefenseCoverageSchemeParent"])
og["cy"] = gk.y.transform(lambda s: s.shift(1).expanding().sum())
og["ct"] = gk.t.transform(lambda s: s.shift(1).expanding().count())
og["cyt"] = gk.t.transform(lambda s: s.shift(1).expanding().sum())
og = og.merge(pri_o[["ab", "nxt", "playDefenseCoverageSchemeParent", "ypt_prior"]],
              left_on=["ab", "__season", "playDefenseCoverageSchemeParent"],
              right_on=["ab", "nxt", "playDefenseCoverageSchemeParent"], how="left")
lg = (og.y.sum() / max(og.t.sum(), 1))
og["ypt_seed"] = (og.ypt_prior.fillna(lg) * 8 + og.cy.fillna(0)) / (8 + og.cyt.fillna(0))
off_shell = og.pivot_table(index=["ab", "__season", "__week"],
                           columns="playDefenseCoverageSchemeParent", values="ypt_seed").add_prefix("ypt_")
# defense diet (opp shell rates), prior seeded
dg = sc.groupby(["opponentAbbreviation", "__season", "__week", "playDefenseCoverageSchemeParent"]).tgt.sum().reset_index()
pri_d = dg.groupby(["opponentAbbreviation", "__season", "playDefenseCoverageSchemeParent"]).tgt.sum().reset_index()
pri_d["tot"] = pri_d.groupby(["opponentAbbreviation", "__season"]).tgt.transform("sum")
pri_d["rate_prior"] = pri_d.tgt / pri_d.tot
pri_d["nxt"] = pri_d.__season + 1
dg = dg.sort_values(["opponentAbbreviation", "__season", "__week"])
dk = dg.groupby(["opponentAbbreviation", "__season", "playDefenseCoverageSchemeParent"])
dg["ct"] = dk.tgt.transform(lambda s: s.shift(1).expanding().sum())
tot = dg.groupby(["opponentAbbreviation", "__season", "__week"]).ct.transform("sum")
dg["rate_cur"] = dg.ct / tot.replace(0, np.nan)
dg = dg.merge(pri_d[["opponentAbbreviation", "nxt", "playDefenseCoverageSchemeParent", "rate_prior"]],
              left_on=["opponentAbbreviation", "__season", "playDefenseCoverageSchemeParent"],
              right_on=["opponentAbbreviation", "nxt", "playDefenseCoverageSchemeParent"], how="left")
dg["rate_seed"] = dg.rate_cur.fillna(dg.rate_prior).fillna(1 / len(SHELLS))
def_mix = dg.pivot_table(index=["opponentAbbreviation", "__season", "__week"],
                         columns="playDefenseCoverageSchemeParent", values="rate_seed").add_prefix("mix_")

# ---------- composites with SELECTIVE prior seed ----------
comp = pd.read_parquet("data/fpdata/composites_v2.parquet"); comp["ab_nv"] = comp.ab.map(lambda a: AB_NV.get(a, a))
CN = [c for c in comp.columns if c.startswith("c_") and not c.endswith("_game")]
comp = comp.sort_values(["ab_nv", "__season", "__week"])
cprior = comp.groupby(["ab_nv", "__season"])[[c + "_game" for c in CN]].mean().reset_index()
cprior["nxt"] = cprior.__season + 1
comp = comp.merge(cprior.rename(columns={c + "_game": c + "_pr" for c in CN})[["ab_nv", "nxt"] + [c + "_pr" for c in CN]],
                  left_on=["ab_nv", "__season"], right_on=["ab_nv", "nxt"], how="left")
for name in CN:
    grp = comp.groupby(["ab_nv", "__season"])[name + "_game"]
    csum = grp.transform(lambda x: x.shift(1).expanding().sum()); cnt = grp.transform(lambda x: x.shift(1).expanding().count()).fillna(0)
    if name in CARRY:
        pr = comp[name + "_pr"]
        comp[name] = (pr.fillna(0) * K_PRIOR + csum.fillna(0)) / (K_PRIOR + cnt)
        comp.loc[pr.isna(), name] = csum.fillna(0)[pr.isna()] / (cnt[pr.isna()] + 6)
    else:
        comp[name] = csum.fillna(0) / (cnt + 6)
compS = comp[["ab_nv", "__season", "__week"] + CN]

# ---------- game rows + assemble ----------
g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv", low_memory=False)
g = g[(g.game_type == "REG") & g.result.notna() & g.spread_line.notna() & g.total_line.notna()
      & (g.season >= 2021) & (g.season <= 2025)]
rows = []
for _, r in g.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, 1), (r.away_team, r.home_team, 0)):
        rows.append(dict(season=r.season, week=r.week, game_id=r.game_id, team=team, opp=opp, home=home,
                         pts=r.home_score if home else r.away_score, margin=r.result if home else -r.result,
                         line=-r.spread_line if home else r.spread_line, total=r.total_line))
p = pd.DataFrame(rows); p["mkt_pts"] = p.total / 2 - p.line / 2
INV = {v: k for k, v in AB_NV.items()}
p["team_fp"] = p.team.map(INV).fillna(p.team); p["opp_fp"] = p.opp.map(INV).fillna(p.opp)
p = p.merge(off_shell.reset_index(), left_on=["team_fp", "season", "week"], right_on=["ab", "__season", "__week"], how="left")
p = p.merge(def_mix.reset_index(), left_on=["opp_fp", "season", "week"],
            right_on=["opponentAbbreviation", "__season", "__week"], how="left", suffixes=("", "_d"))
lgy = pd.concat([p["ypt_" + s] for s in SHELLS], axis=1).stack().mean()
p["fit_scheme_pass"] = sum(p["ypt_" + s].fillna(lgy) * p["mix_" + s].fillna(1 / len(SHELLS)) for s in SHELLS)
p = p.merge(compS, left_on=["team", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="left", suffixes=("", "_c"))
p = p.merge(compS.add_prefix("O_"), left_on=["opp", "season", "week"], right_on=["O_ab_nv", "O___season", "O___week"], how="left")
DIFFS = {"d_trench_pass": ("c_passpro", "O_c_passrush"), "d_trench_run": ("c_runblock", "O_c_runfront"),
         "d_playmaking": ("c_recv_playmaking", "O_c_tackling"), "d_power": ("c_rb_power", "O_c_tackling"),
         "d_precision_cov": ("c_qb_precision", "O_c_cov_disruption"),
         "d_deep_fit": ("c_qb_aggression", "O_c_deep_denial"), "d_rz": ("c_rz_usage", "O_c_rz_defense")}
for d, (a, b) in DIFFS.items():
    p[d] = p[a] - p[b]
tw = pd.read_parquet("data/team_week.parquet")
_C2A = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR","Chicago":"CHI",
"Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET","Green Bay":"GB",
"Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC","LA Rams":"LA","LA Chargers":"LAC",
"Las Vegas":"LV","Miami":"MIA","Minnesota":"MIN","New England":"NE","New Orleans":"NO","NY Giants":"NYG",
"NY Jets":"NYJ","Philadelphia":"PHI","Pittsburgh":"PIT","Seattle":"SEA","San Francisco":"SF","Tampa Bay":"TB",
"Tennessee":"TEN","Washington":"WAS"}
tw["team"] = tw.team.map(_C2A).fillna(tw.team)
CORE = ["off_pass_epa_neutral_s2d", "off_rush_epa_neutral_s2d", "def_pass_epa_allowed_neutral_s2d",
        "def_rush_epa_allowed_neutral_s2d", "off_proe_s2d", "off_pts_per_drive_s2d", "def_pts_per_drive_allowed_s2d"]
p = p.merge(tw[["season", "week", "team"] + CORE], on=["season", "week", "team"], how="left")
p = p.merge(tw[["season", "week", "team"] + CORE].rename(columns={"team": "opp"}).add_prefix("T_")
            .rename(columns={"T_season": "season", "T_week": "week", "T_opp": "opp"}),
            on=["season", "week", "opp"], how="left")
FEATS = (["line", "total", "mkt_pts", "home", "week"] + CORE + ["T_" + c for c in CORE]
         + list(DIFFS) + ["c_qb_hold", "c_qb_aggression", "O_c_scheme_man", "O_c_scheme_twohigh", "fit_scheme_pass"])
p = p.dropna(subset=["pts", "line", "total"]).copy()
for c in FEATS:
    p[c] = num(p[c])
FEATS = [c for c in FEATS if not p[c].isna().all()]
p[FEATS] = p[FEATS].fillna(p[FEATS].mean())


def rf(X, y, lam=50.0):
    Xb = np.hstack([X, np.ones((len(X), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.solve(A, Xb.T @ y)


preds = []
for ssn in (2023, 2024, 2025):
    tr, te = p[p.season < ssn], p[p.season == ssn].copy()
    X = tr[FEATS].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
    w = rf((X - m) / s, tr.pts.values.astype(float))
    te["pred"] = np.hstack([(te[FEATS].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
    preds.append(te)
pr = pd.concat(preds)
own = pr.set_index(["game_id", "team"]).pred
pr["pm"] = pr.pred - own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
gg = pr.drop_duplicates("game_id").copy(); gg["e"] = gg.pm - (-gg.line)
