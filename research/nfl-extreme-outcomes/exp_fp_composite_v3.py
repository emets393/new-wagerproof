#!/usr/bin/env python3
"""Composite v3 — dissection fits (owner mandate: QB-vs-coverage, OL-vs-DL
timing, run-concept vs front) + the SPREAD application.

New engineered FITS (all entering-game, opponent-mix-weighted expectations):
  fit_scheme_pass : Σ_shell [own pass yds/target vs shell] × [opp shell rate]
                    (QB-vs-coverage dissection as one number)
  fit_sack_timing : own QB hold time MINUS opp time-to-sack (hold longer than
                    they need = sacks coming)
  fit_run_concept : own man/zone-concept rushing success weighted by own usage,
                    MINUS opp concept success allowed weighted the same way
  fit_explosive   : own explosive-run rate + opp explosive-rate allowed
Model: v2 features + fits -> team points, ridge λ=50, walk-forward 2023-25.
Eval: totals AND spreads vs close with dose + per-season; plus points-better
calibration (predicted margin disagreement vs realized margin).
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


def num(s):
    return pd.to_numeric(s, errors="coerce")


def pre(df, keys, col, minp=3):
    return df.groupby(keys)[col].transform(lambda s: s.shift(1).expanding(min_periods=minp).mean())


K = ["ab", "__season", "__week"]

# ---------- fit_scheme_pass: own efficiency per shell × opp shell mix ----------
sc = pd.read_parquet("data/fpdata/split_recv_adv_x_coverage.parquet")
sc["tgt"] = num(sc.playerStatsReceivingTargetsTotal)
sc["yds"] = num(sc.playerStatsReceivingYardsTotal)
sc["ab"] = sc.teamAbbreviation
SHELLS = ["Cover 1", "Cover 2", "Cover 3", "Cover 4", "Cover 6", "Cover 0"]
tm = (sc[sc.playDefenseCoverageSchemeParent.isin(SHELLS)]
      .groupby(["ab", "__season", "__week", "playDefenseCoverageSchemeParent"])
      .agg(tgt=("tgt", "sum"), yds=("yds", "sum")).reset_index())
tm = tm.sort_values(["ab", "__season", "__week"])
g2 = tm.groupby(["ab", "__season", "playDefenseCoverageSchemeParent"])
tm["cyds"] = g2.yds.transform(lambda s: s.shift(1).expanding().sum())
tm["ctgt"] = g2.tgt.transform(lambda s: s.shift(1).expanding().sum())
tm["ypt_shell"] = tm.cyds / tm.ctgt.replace(0, np.nan)
off_shell = tm.pivot_table(index=K, columns="playDefenseCoverageSchemeParent",
                           values="ypt_shell").add_prefix("ypt_")

dm = (sc[sc.playDefenseCoverageSchemeParent.isin(SHELLS)]
      .groupby(["opponentAbbreviation", "__season", "__week", "playDefenseCoverageSchemeParent"])
      .tgt.sum().reset_index())
dm = dm.sort_values(["opponentAbbreviation", "__season", "__week"])
g3 = dm.groupby(["opponentAbbreviation", "__season", "playDefenseCoverageSchemeParent"])
dm["ct"] = g3.tgt.transform(lambda s: s.shift(1).expanding().sum())
tot = dm.groupby(["opponentAbbreviation", "__season", "__week"]).ct.transform("sum")
dm["rate"] = dm.ct / tot.replace(0, np.nan)
def_mix = dm.pivot_table(index=["opponentAbbreviation", "__season", "__week"],
                         columns="playDefenseCoverageSchemeParent", values="rate").add_prefix("mix_")

# ---------- concept + timing + explosive inputs ----------
toR = pd.read_parquet("data/fpdata/team_offense_rushing-advanced.parquet")
toR["ab"] = toR.teamNickname.map(NICK)
tdR = pd.read_parquet("data/fpdata/team_defense_rushing-advanced.parquet")
tdR["ab"] = tdR.teamNickname.map(NICK)
toP = pd.read_parquet("data/fpdata/team_offense_passing-advanced.parquet")
toP["ab"] = toP.teamNickname.map(NICK)
tdP = pd.read_parquet("data/fpdata/team_defense_passing-advanced.parquet")
tdP["ab"] = tdP.teamNickname.map(NICK)


def team_pre(df, spec):
    out = df[K].copy()
    for k, c in spec.items():
        out[k] = num(df[c])
    out = out.groupby(K, as_index=False).mean().sort_values(K)
    for k in spec:
        out["p_" + k] = pre(out, ["ab", "__season"], k)
    return out[K + ["p_" + k for k in spec]]


offR = team_pre(toR, {
    "man_att": "teamStatsRushingConceptManAttemptsTotal",
    "zone_att": "teamStatsRushingConceptZoneAttemptsTotal",
    "man_succ": "teamStatsRushingConceptManAttemptsSuccessPercentage",
    "zone_succ": "teamStatsRushingConceptZoneAttemptsSuccessPercentage",
    "expl": "teamStatsRushingYardsExplosivePercentage"})
defR = team_pre(tdR, {
    "man_succ_a": "opponentStatsRushingConceptManAttemptsSuccessPercentage",
    "zone_succ_a": "opponentStatsRushingConceptZoneAttemptsSuccessPercentage",
    "expl_a": "opponentStatsRushingYardsExplosivePercentage"})
offP = team_pre(toP, {"ttt": "teamStatsPassingAverageTimeToThrow"})
defP = team_pre(tdP, {"tts": "opponentStatsPassingAverageTimeToSack"})

# ---------- game rows ----------
g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv",
                low_memory=False)
g = g[(g.game_type == "REG") & g.result.notna() & g.spread_line.notna() & g.total_line.notna()
      & (g.season >= 2021) & (g.season <= 2025)]
rows = []
for _, r in g.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, 1), (r.away_team, r.home_team, 0)):
        rows.append(dict(season=r.season, week=r.week, game_id=r.game_id, team=team, opp=opp,
                         home=home, pts=r.home_score if home else r.away_score,
                         margin=r.result if home else -r.result,
                         line=-r.spread_line if home else r.spread_line, total=r.total_line,
                         act_total=r.home_score + r.away_score))
p = pd.DataFrame(rows)
p["mkt_pts"] = p.total / 2 - p.line / 2
p["team_fp"] = p.team.map({v: k for k, v in AB_NV.items()}).fillna(p.team)
p["opp_fp"] = p.opp.map({v: k for k, v in AB_NV.items()}).fillna(p.opp)

# scheme-pass fit
p = p.merge(off_shell.reset_index(), left_on=["team_fp", "season", "week"],
            right_on=["ab", "__season", "__week"], how="left")
p = p.merge(def_mix.reset_index(), left_on=["opp_fp", "season", "week"],
            right_on=["opponentAbbreviation", "__season", "__week"], how="left",
            suffixes=("", "_dm"))
lg_ypt = pd.concat([p["ypt_" + s] for s in SHELLS], axis=1).stack().mean()
fit = 0
for s in SHELLS:
    fit = fit + p["ypt_" + s].fillna(lg_ypt) * p["mix_" + s].fillna(1 / len(SHELLS))
p["fit_scheme_pass"] = fit

# concept fit: own usage-weighted success minus opp usage-weighted success allowed
for side, sfx in (("team_fp", ""), ):
    p = p.merge(offR, left_on=["team_fp", "season", "week"], right_on=K, how="left", suffixes=("", "_oR"))
    p = p.merge(defR, left_on=["opp_fp", "season", "week"], right_on=K, how="left", suffixes=("", "_dR"))
    p = p.merge(offP, left_on=["team_fp", "season", "week"], right_on=K, how="left", suffixes=("", "_oP"))
    p = p.merge(defP, left_on=["opp_fp", "season", "week"], right_on=K, how="left", suffixes=("", "_dP"))
wman = p.p_man_att / (p.p_man_att + p.p_zone_att)
p["fit_run_concept"] = (wman * (p.p_man_succ - p.p_man_succ_a).fillna(0)
                        + (1 - wman) * (p.p_zone_succ - p.p_zone_succ_a).fillna(0))
p["fit_sack_timing"] = p.p_ttt - p.p_tts       # + = QB holds LONGER than D needs (bad)
p["fit_explosive"] = p.p_expl + p.p_expl_a

# v2 composites + diffs
comp = pd.read_parquet("data/fpdata/composites_v2.parquet")
comp["ab_nv"] = comp.ab.map(lambda a: AB_NV.get(a, a))
CN = [c for c in comp.columns if c.startswith("c_") and not c.endswith("_game")]
p = p.merge(comp[["ab_nv", "__season", "__week"] + CN],
            left_on=["team", "season", "week"], right_on=["ab_nv", "__season", "__week"],
            how="left", suffixes=("", "_cc"))
p = p.merge(comp[["ab_nv", "__season", "__week"] + CN].add_prefix("O_"),
            left_on=["opp", "season", "week"], right_on=["O_ab_nv", "O___season", "O___week"],
            how="left")
DIFFS = {"d_trench_pass": ("c_passpro", "O_c_passrush"), "d_trench_run": ("c_runblock", "O_c_runfront"),
         "d_playmaking": ("c_recv_playmaking", "O_c_tackling"), "d_power": ("c_rb_power", "O_c_tackling"),
         "d_precision_cov": ("c_qb_precision", "O_c_cov_disruption"),
         "d_deep_fit": ("c_qb_aggression", "O_c_deep_denial"), "d_rz": ("c_rz_usage", "O_c_rz_defense")}
for d, (a, b) in DIFFS.items():
    p[d] = p[a] - p[b]
tw = pd.read_parquet("data/team_week.parquet")
_C2A = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR",
"Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN",
"Detroit":"DET","Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX",
"Kansas City":"KC","LA Rams":"LA","LA Chargers":"LAC","Las Vegas":"LV","Miami":"MIA",
"Minnesota":"MIN","New England":"NE","New Orleans":"NO","NY Giants":"NYG","NY Jets":"NYJ",
"Philadelphia":"PHI","Pittsburgh":"PIT","Seattle":"SEA","San Francisco":"SF",
"Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS"}
tw["team"] = tw.team.map(_C2A).fillna(tw.team)
CORE_TW = ["off_pass_epa_neutral_s2d", "off_rush_epa_neutral_s2d",
           "def_pass_epa_allowed_neutral_s2d", "def_rush_epa_allowed_neutral_s2d",
           "off_proe_s2d", "off_sec_per_play_neutral_s2d", "off_plays_per_game_s2d",
           "off_pts_per_drive_s2d", "def_pts_per_drive_allowed_s2d"]
p = p.merge(tw[["season", "week", "team"] + CORE_TW], on=["season", "week", "team"], how="left")
p = p.merge(tw[["season", "week", "team"] + CORE_TW].rename(columns={"team": "opp"}).add_prefix("T_")
            .rename(columns={"T_season": "season", "T_week": "week", "T_opp": "opp"}),
            on=["season", "week", "opp"], how="left")
FITS = ["fit_scheme_pass", "fit_run_concept", "fit_sack_timing", "fit_explosive"]
FEATS = (["line", "total", "mkt_pts", "home", "week"] + CORE_TW + ["T_" + c for c in CORE_TW]
         + list(DIFFS) + ["c_qb_poise", "O_c_scheme_man", "O_c_scheme_twohigh",
                          "c_qb_aggression", "c_qb_hold"] + FITS)
p = p[p.week >= 4].dropna(subset=["pts", "line", "total"]).copy()
for c in FEATS:
    p[c] = num(p[c])
FEATS = [c for c in FEATS if not p[c].isna().all()]
p[FEATS] = p[FEATS].fillna(p[FEATS].mean())
print(f"panel: {len(p)} team-games × {len(FEATS)} features (v2 + 4 dissection fits)")


def ridge_fit(X, y, lam):
    Xb = np.hstack([X, np.ones((len(X), 1))])
    A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.solve(A, Xb.T @ y)


preds = []
fit_coefs = {}
for season in (2023, 2024, 2025):
    tr, te = p[p.season < season], p[p.season == season].copy()
    X = tr[FEATS].values.astype(float)
    m, s = X.mean(0), X.std(0); s[s == 0] = 1
    w = ridge_fit((X - m) / s, tr.pts.values.astype(float), 50.0)
    te["pred"] = np.hstack([(te[FEATS].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
    preds.append(te)
    if season == 2025:
        fit_coefs = {f: round(float(c), 3) for f, c in zip(FEATS, w[:-1]) if f in FITS or f in DIFFS}
pr = pd.concat(preds)
own = pr.set_index(["game_id", "team"]).pred
pr["opp_pred"] = own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
pr["pm"] = pr.pred - pr.opp_pred
pr["pt"] = pr.pred + pr.opp_pred
gg = pr.drop_duplicates("game_id").copy()
om = gg.margin - (-gg.line)
ow = np.where(om >= 0, (gg.margin + gg.line) > 0, (gg.margin + gg.line) < 0)
ok = (gg.margin + gg.line) != 0
assert ow[ok].mean() > 0.99
print("fit/diff coefs:", fit_coefs)

print("\nTOTALS vs close:")
for thr in (2, 3, 4):
    m2 = (gg.pt - gg.total).abs() >= thr
    pick = (gg.pt - gg.total) >= thr
    w2 = np.where(pick, gg.act_total > gg.total, gg.act_total < gg.total)
    okk = m2 & (gg.act_total != gg.total)
    z = (w2[okk].mean() - .5) * 2 * np.sqrt(okk.sum())
    print(f"  thr {thr}: {w2[okk].sum()}-{okk.sum()-w2[okk].sum()} ({100*w2[okk].mean():.1f}%) z={z:+.2f}")
print("SPREADS vs close (points-better disagreement):")
gg["sp_edge"] = gg.pm - (-gg.line)
for thr in (1, 2, 3, 4):
    m2 = gg.sp_edge.abs() >= thr
    pick = gg.sp_edge >= thr
    w2 = np.where(pick, (gg.margin + gg.line) > 0, (gg.margin + gg.line) < 0)
    okk = m2 & ((gg.margin + gg.line) != 0)
    if okk.sum() >= 20:
        z = (w2[okk].mean() - .5) * 2 * np.sqrt(okk.sum())
        print(f"  thr {thr}: {w2[okk].sum()}-{okk.sum()-w2[okk].sum()} ({100*w2[okk].mean():.1f}%) z={z:+.2f}")
print("\npoints-better CALIBRATION (spread edge bucket -> realized margin vs line):")
gg["real_edge"] = gg.margin - (-gg.line)
b = pd.cut(gg.sp_edge, [-99, -4, -2, 0, 2, 4, 99])
print(gg.groupby(b).agg(n=("real_edge", "size"), mean_realized=("real_edge", "mean")).round(2).to_string())
print("\nper-season spreads thr>=2:")
for s2 in (2023, 2024, 2025):
    d = gg[(gg.season == s2) & (gg.sp_edge.abs() >= 2) & ((gg.margin + gg.line) != 0)]
    pick = d.sp_edge >= 2
    w2 = np.where(pick, (d.margin + d.line) > 0, (d.margin + d.line) < 0)
    print(f"  {s2}: {w2.sum()}-{len(d)-w2.sum()} ({100*w2.mean():.0f}%)" if len(d) else "")
