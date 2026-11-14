#!/usr/bin/env python3
"""Composite engineering v2 — the distillation build (owner mandate).

Every top-ranked raw family from the mega-run gets compressed into an engineered
composite (z-scored inputs, sign-aligned), reliability-gated (split-half r>=0.10),
then modeled as OWN vs OPP DIFFERENTIALS + scheme identity + market, λ-swept,
walk-forward 2023-2025, dose-response report vs the close.
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


def team_table(name):
    df = pd.read_parquet(f"data/fpdata/{name}.parquet")
    df["ab"] = df.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
    return df


toP, toR, toC = team_table("team_offense_passing-advanced"), team_table("team_offense_rushing-advanced"), team_table("team_offense_receiving-advanced")
tdP, tdR, tdC = team_table("team_defense_passing-advanced"), team_table("team_defense_rushing-advanced"), team_table("team_defense_receiving-advanced")
toM, tdM = team_table("team_offense_coverage-matrix"), team_table("team_defense_coverage-matrix")
lm = team_table("lineMatchups__team")

K = ["ab", "__season", "__week"]
t = toP[K].drop_duplicates().copy()


def add(frame, src, spec):
    """spec: {newcol: (src_col, sign)} — merge sign-aligned numeric inputs."""
    cols = {k: num(src[c]) * sgn for k, (c, sgn) in spec.items()}
    sub = pd.concat([src[K].reset_index(drop=True),
                     pd.DataFrame(cols).reset_index(drop=True)], axis=1)
    sub = sub.groupby(K, as_index=False).mean()
    return frame.merge(sub, on=K, how="left")


# ---------------- OFFENSE inputs ----------------
t = add(t, lm, {"i_passpro": ("teamStatsPassingPressuredOverExpected", -1)})
t = add(t, toP, {
    "i_qb_cpoe": ("teamStatsPassingCompletionsOverExpected", 1),
    "i_qb_acc": ("teamStatsPassingThrowAccuracyHighlyAccuratePercentage", 1),
    "i_qb_offtgt": ("teamStatsPassingOffTargetThrowAttemptsPercentage", -1),
    "i_qb_deep": ("teamStatsPassingDeepThrowAttemptsPercentage", 1),
    "i_qb_hero": ("teamStatsPassingHeroThrowPercentage", 1),
    "i_qb_adot": ("teamStatsPassingAverageDepthOfTarget", 1),
    "i_qb_swp": ("teamStatsPassingSackedPercentage", -1),
    "i_qb_ttt": ("teamStatsPassingAverageTimeToThrow", 1)})
t = add(t, toR, {
    "i_runblk_ybc": ("teamStatsRushingYardsBeforeContactPerAttempt", 1),
    "i_runblk_stuff": ("teamStatsRushingAttemptsStuffsPercentage", -1),
    "i_rb_yac": ("teamStatsRushingYardsAfterContactPerAttempt", 1),
    "i_rb_mtf": ("teamStatsRushingMissedTacklesForcedPerAttempt", 1),
    "i_run_expl": ("teamStatsRushingYardsExplosivePercentage", 1)})
t = add(t, toC, {
    "i_recv_yacP": ("teamStatsReceivingYardsAfterCatchTotal", 1),
    "i_recv_mtf": ("teamStatsReceivingMissedTacklesForcedPerReception", 1),
    "i_recv_ctc": ("teamStatsReceivingTargetsCatchablePercentage", 1),
    "i_rz_tgt": ("teamStatsInside20ReceivingTargetsTotal", 1)})
# ---------------- DEFENSE inputs ----------------
t = add(t, lm, {"i_passrush": ("opponentStatsPassingPressuredOverExpected", 1)})
t = add(t, tdP, {
    "i_dqb_cpoe": ("opponentStatsPassingCompletionsOverExpected", -1),
    "i_deep_allow": ("opponentStatsPassingDeepThrowAttemptsPercentage", -1),
    "i_tts_gen": ("opponentStatsPassingAverageTimeToSack", -1)})
t = add(t, tdR, {
    "i_front_ybc": ("opponentStatsRushingYardsBeforeContactPerAttempt", -1),
    "i_front_stuff": ("opponentStatsRushingAttemptsStuffsPercentage", 1),
    "i_tkl_rush": ("opponentStatsRushingMissedTacklesForcedPerAttempt", -1),
    "i_dfront_expl": ("opponentStatsRushingYardsExplosivePercentage", -1)})
t = add(t, tdC, {
    "i_tkl_recv": ("opponentStatsReceivingMissedTacklesForcedPerReception", -1),
    "i_cov_ctc": ("opponentStatsReceivingTargetsCatchablePercentage", -1),
    "i_rz_allow": ("opponentStatsInside20ReceivingTargetsTotal", -1)})
t = add(t, tdM, {
    "i_d_man": ("opponentStatsCoverageSchemeManPassingDropbacksPercentage", 1),
    "i_d_twohigh": ("opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage", 1)})

COMPOSITES = {
    "c_passpro": ["i_passpro"],
    "c_qb_precision": ["i_qb_cpoe", "i_qb_acc", "i_qb_offtgt"],
    "c_qb_aggression": ["i_qb_deep", "i_qb_hero", "i_qb_adot"],
    "c_qb_poise": ["i_qb_swp"],
    "c_qb_hold": ["i_qb_ttt"],
    "c_runblock": ["i_runblk_ybc", "i_runblk_stuff"],
    "c_rb_power": ["i_rb_yac", "i_rb_mtf", "i_run_expl"],
    "c_recv_playmaking": ["i_recv_mtf", "i_recv_yacP"],
    "c_recv_hands": ["i_recv_ctc"],
    "c_rz_usage": ["i_rz_tgt"],
    "c_passrush": ["i_passrush", "i_tts_gen"],
    "c_cov_disruption": ["i_dqb_cpoe", "i_cov_ctc"],
    "c_deep_denial": ["i_deep_allow"],
    "c_runfront": ["i_front_ybc", "i_front_stuff", "i_dfront_expl"],
    "c_tackling": ["i_tkl_rush", "i_tkl_recv"],
    "c_rz_defense": ["i_rz_allow"],
    "c_scheme_man": ["i_d_man"],
    "c_scheme_twohigh": ["i_d_twohigh"],
}
for cols in COMPOSITES.values():
    for c in cols:
        t[c + "_z"] = t.groupby("__season")[c].transform(lambda s: (s - s.mean()) / s.std())
for name, cols in COMPOSITES.items():
    t[name + "_game"] = t[[c + "_z" for c in cols]].mean(axis=1)
t = t.sort_values(K)
print("RELIABILITY (split-half r, realized per-game):")
keep = []
for name in COMPOSITES:
    pairs = [(g[g.__week % 2 == 0][name + "_game"].mean(), g[g.__week % 2 == 1][name + "_game"].mean())
             for _, g in t.dropna(subset=[name + "_game"]).groupby(["ab", "__season"]) if len(g) >= 10]
    r = np.corrcoef([a for a, _ in pairs], [b for _, b in pairs])[0, 1]
    ok = r >= 0.10
    keep.append(name) if ok else None
    print(f"  {name:20s} r={r:+.3f} {'KEEP' if ok else 'DROP'}")
for name in COMPOSITES:
    grp = t.groupby(["ab", "__season"])[name + "_game"]
    t[name] = grp.transform(lambda x: x.shift(1).expanding().sum()) / (
        grp.transform(lambda x: x.shift(1).expanding().count()) + 6)
t[["ab", "__season", "__week"] + [n for n in COMPOSITES] + [n + "_game" for n in COMPOSITES]] \
    .to_parquet("data/fpdata/composites_v2.parquet")

# ---------------- model on composite DIFFERENTIALS ----------------
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
p = p.merge(tw[["season", "week", "team"] + CORE_TW].rename(columns={"team": "opp"}).add_prefix("O_")
            .rename(columns={"O_season": "season", "O_week": "week", "O_opp": "opp"}),
            on=["season", "week", "opp"], how="left")
comp = pd.read_parquet("data/fpdata/composites_v2.parquet")
comp["ab_nv"] = comp.ab.map(lambda a: AB_NV.get(a, a))
CN = list(COMPOSITES)
p = p.merge(comp[["ab_nv", "__season", "__week"] + CN],
            left_on=["team", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="left")
p = p.merge(comp[["ab_nv", "__season", "__week"] + CN].add_prefix("O_"),
            left_on=["opp", "season", "week"], right_on=["O_ab_nv", "O___season", "O___week"], how="left")
# engineered DIFFERENTIALS: own offense unit vs the opposing defense unit
DIFFS = {
    "d_trench_pass": ("c_passpro", "O_c_passrush"),
    "d_trench_run": ("c_runblock", "O_c_runfront"),
    "d_playmaking": ("c_recv_playmaking", "O_c_tackling"),
    "d_power": ("c_rb_power", "O_c_tackling"),
    "d_precision_cov": ("c_qb_precision", "O_c_cov_disruption"),
    "d_deep_fit": ("c_qb_aggression", "O_c_deep_denial"),
    "d_hold_rush": ("c_qb_hold", "O_c_passrush"),
    "d_rz": ("c_rz_usage", "O_c_rz_defense"),
}
for d, (a, b) in DIFFS.items():
    p[d] = p[a] - p[b]
FEATS = (["line", "total", "mkt_pts", "home", "week"] + CORE_TW + ["O_" + c for c in CORE_TW]
         + list(DIFFS) + ["c_qb_poise", "O_c_scheme_man", "O_c_scheme_twohigh",
                          "c_qb_aggression", "c_qb_hold"])
p = p[p.week >= 4].dropna(subset=["pts", "line", "total"]).copy()
for c in FEATS:
    p[c] = num(p[c])
FEATS = [c for c in FEATS if not p[c].isna().all()]
p[FEATS] = p[FEATS].fillna(p[FEATS].mean())
print(f"\npanel: {len(p)} team-games × {len(FEATS)} engineered features")


def ridge_fit(X, y, lam):
    Xb = np.hstack([X, np.ones((len(X), 1))])
    A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.solve(A, Xb.T @ y)


for lam in (10.0, 50.0, 200.0):
    preds = []
    for season in (2023, 2024, 2025):
        tr, te = p[p.season < season], p[p.season == season].copy()
        X = tr[FEATS].values.astype(float)
        m, s = X.mean(0), X.std(0); s[s == 0] = 1
        w = ridge_fit((X - m) / s, tr.pts.values.astype(float), lam)
        te["pred"] = np.hstack([(te[FEATS].values.astype(float) - m) / s,
                                np.ones((len(te), 1))]) @ w
        preds.append(te)
    pr = pd.concat(preds)
    own = pr.set_index(["game_id", "team"]).pred
    pr["opp_pred"] = own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
    pr["pm"] = pr.pred - pr.opp_pred
    pr["pt"] = pr.pred + pr.opp_pred
    gg = pr.drop_duplicates("game_id")
    om = gg.margin - (-gg.line)
    ow = np.where(om >= 0, (gg.margin + gg.line) > 0, (gg.margin + gg.line) < 0)
    ok = (gg.margin + gg.line) != 0
    assert ow[ok].mean() > 0.99
    row = f"λ={lam:5.0f} TOTALS:"
    for thr in (1, 2, 3, 4):
        m2 = (gg.pt - gg.total).abs() >= thr
        pick = (gg.pt - gg.total) >= thr
        w2 = np.where(pick, gg.act_total > gg.total, gg.act_total < gg.total)
        okk = m2 & (gg.act_total != gg.total)
        row += f" thr{thr} {100*w2[okk].mean():.1f}%({okk.sum()})"
    row += "  SPREAD:"
    for thr in (2, 3):
        m2 = (gg.pm - (-gg.line)).abs() >= thr
        pick = (gg.pm - (-gg.line)) >= thr
        w2 = np.where(pick, (gg.margin + gg.line) > 0, (gg.margin + gg.line) < 0)
        okk = m2 & ((gg.margin + gg.line) != 0)
        row += f" thr{thr} {100*w2[okk].mean():.1f}%({okk.sum()})"
    print(row)
    if lam == 50.0:
        for s2 in (2023, 2024, 2025):
            d = gg[(gg.season == s2) & ((gg.pt - gg.total).abs() >= 3) & (gg.act_total != gg.total)]
            pick = (d.pt - d.total) >= 3
            w2 = np.where(pick, d.act_total > d.total, d.act_total < d.total)
            print(f"    {s2} totals thr3: {w2.sum()}-{len(d)-w2.sum()} ({100*w2.mean():.0f}%)" if len(d) else "")
