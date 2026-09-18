#!/usr/bin/env python3
"""UNIFIED PROP ENGINE (owner mandate 2026-09-17: "find something for every market").

Prior prop scripts touched 3 of 79 FP tables. This one builds a real feature library
from the whole warehouse — rushing workload/efficiency/concepts, bell-cow shares,
receiving role + man-vs-zone, QB passing + depth, opponent run/pass/coverage defense,
OL-vs-DL trenches, and GAME SCRIPT (PROE / pace / dropback volume) — then fits a
market-specific regularized model per prop market.

Design rules learned the hard way:
  - entering-game values only (shift(1) expanding), with PRIOR-SEASON SEED blend
    (v4 lesson: K*prior + cumsum)/(K+count)) so week 4-8 isn't dead weight
  - ABSOLUTE edge thresholds per market (%-of-median selects nothing on a 1.5 line)
  - always report bet-fraction (selectivity) + per-season, dose-response required
  - 2023 close lines patched in from _close_2023.parquet -> 2024 AND 2025 clean tests
"""
import numpy as np
import pandas as pd

pd.options.mode.chained_assignment = None
AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR","Bears":"CHI",
"Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HST",
"Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA",
"Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT",
"Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
num = lambda s: pd.to_numeric(s, errors="coerce")
FP = "data/fpdata/"
from fp_hist import read_fp as _read_fp   # hist + current merge (Render clones carry only this season in data/fpdata)


def entering(df, key, cols, prefix, K=4.0, minp=1):
    """Entering-game season-to-date mean per key, seeded with that key's prior-season
    mean (shrinks out as games accrue). Returns df with prefix+alias columns."""
    d = df.sort_values([key, "__season", "__week"]).copy()
    # prior-season mean per key
    pri = d.groupby([key, "__season"])[cols].mean().reset_index()
    pri["__nxt"] = pri.__season + 1
    pri = pri.rename(columns={c: "__pri_" + c for c in cols})
    d = d.merge(pri[[key, "__nxt"] + ["__pri_" + c for c in cols]],
                left_on=[key, "__season"], right_on=[key, "__nxt"], how="left")
    g = d.groupby([key, "__season"])
    out = {}
    for c in cols:
        csum = g[c].transform(lambda x: x.shift(1).expanding().sum())
        cnt = g[c].transform(lambda x: x.shift(1).expanding().count()).fillna(0)
        pr = d["__pri_" + c]
        blended = (pr.fillna(0) * K + csum.fillna(0)) / (K + cnt)
        # no prior and no games yet -> NaN (don't fabricate a zero)
        blended[(pr.isna()) & (cnt < minp)] = np.nan
        out[prefix + c] = blended
    return pd.concat([d[[key, "__season", "__week"]], pd.DataFrame(out, index=d.index)], axis=1)


def team_key(df, col="teamNickname"):
    if "teamAbbreviation" in df.columns and df.teamAbbreviation.notna().any():
        ab = df.teamAbbreviation
    else:
        ab = df[col].map(NICK)
    return ab.map(lambda a: AB_NV.get(a, a))


# ---------------------------------------------------------------- panel + lines
panel = pd.read_parquet("data/nfl_prop_v3_panel.parquet")
cw = _read_fp("player_crosswalk")[["player_id", "playerPlayerId"]].drop_duplicates("player_id")
panel = panel.merge(cw, on="player_id", how="left")
_cl23 = _read_fp("_close_2023")
panel = panel.merge(_cl23, on=["player_id", "market", "season", "week"], how="left")
panel["close_line"] = panel.close_line.fillna(panel.cl23)

# ============================================================ PLAYER FEATURE BLOCKS
# ---- RUSHING: workload + efficiency + concepts (NEVER used by prior prop models) ----
ru = _read_fp("player_rushing-advanced")
RU = {"ru_att": "playerStatsRushingAttemptsTotal", "ru_ypa": "playerStatsRushingYardsPerAttempt",
      "ru_ybc": "playerStatsRushingYardsBeforeContactPerAttempt",
      "ru_yac": "playerStatsRushingYardsAfterContactPerAttempt",
      "ru_yacpct": "playerStatsRushingYardsAfterContactPercentage",
      "ru_mtf": "playerStatsRushingMissedTacklesForcedPerAttempt",
      "ru_succ": "playerStatsRushingAttemptsSuccessPercentage",
      "ru_stuff": "playerStatsRushingAttemptsStuffsPercentage",
      "ru_expl": "playerStatsRushingRunsExplosivePercentage",
      "ru_zonepct": "playerStatsRushingConceptZoneAttemptsPercentage",
      "ru_zoneypa": "playerStatsRushingConceptZoneYardsPerAttempt",
      "ru_manypa": "playerStatsRushingConceptManYardsPerAttempt",
      "ru_tdpct": "playerStatsRushingTouchdownsPercentage",
      "ru_in5": "marketShareInside5RushingAttemptsTotal",
      "ru_snaps": "playerStatsSnapsOffenseTotal", "ru_yds": "playerStatsRushingYardsTotal"}
for k, c in RU.items():
    ru[k] = num(ru[c])
f_rush = entering(ru, "playerPlayerId", list(RU), "")

# ---- BELL COW: market shares (the workload driver for attempts) ----
bc = _read_fp("player_rushing-bell-cow")
BC = {"ms_rush": "marketShareRushingAttemptsTotal", "ms_snap": "marketShareSnapsOffenseTotal",
      "ms_route": "marketShareReceivingRoutesTotal", "ms_tgt": "marketShareReceivingTargetsTotal",
      "ms_xfp": "marketShareXfpPprTotal", "tm_rush_att": "teamStatsRushingAttemptsTotal",
      "tm_dropbacks": "teamStatsPassingDropbacksTotal", "tm_snaps": "teamStatsSnapsOffenseTotal"}
for k, c in BC.items():
    bc[k] = num(bc[c])
f_bc = entering(bc, "playerPlayerId", list(BC), "")

# ---- RECEIVING advanced (role + efficiency + alignment) ----
ra = _read_fp("player_receiving-advanced")
RC = {"rc_routeshare": "marketShareReceivingRoutesTotal", "rc_airshare": "marketShareReceivingYardsAir",
      "rc_tprr": "playerStatsReceivingTargetsPerRoute", "rc_yprr": "playerStatsReceivingAveragesPerRouteYardsTotal",
      "rc_slot": "playerStatsReceivingAlignmentSlotRoutesPercentage",
      "rc_wide": "playerStatsReceivingAlignmentWideRoutesPercentage",
      "rc_bfield": "playerStatsReceivingAlignmentBackfieldRoutesPercentage",
      "rc_adot": "playerStatsReceivingAverageDepthOfTarget",
      "rc_firstread": "marketShareReceivingTargetedReadFirst",
      "rc_design": "playerStatsReceivingTargetedReadDesignPercentage",
      "rc_catchable": "playerStatsReceivingTargetsCatchablePercentage",
      "rc_routes": "playerStatsReceivingRoutesTotal"}
for k, c in RC.items():
    ra[k] = num(ra[c])
f_recv = entering(ra, "playerPlayerId", list(RC), "")

# ---- SEPARATION ----
sep = _read_fp("player_receiving-separation-by-alignment")
SE = {"sp_score": "playerStatsReceivingSeparationScorePercentage",
      "sp_win": "playerStatsReceivingSeparationWinsPercentage"}
for k, c in SE.items():
    sep[k] = num(sep[c])
f_sep = entering(sep, "playerPlayerId", list(SE), "")

# ---- QB passing advanced + depth ----
qb = _read_fp("player_passing-advanced")
qb = qb[num(qb.playerStatsPassingDropbacksTotal) >= 10]
QC = {"qb_cpoe": "playerStatsPassingCompletionsOverExpected",
      "qb_acc": "playerStatsPassingThrowAccuracyHighlyAccuratePercentage",
      "qb_offtgt": "playerStatsPassingOffTargetThrowAttemptsPercentage",
      "qb_ypa": "playerStatsPassingYardsPerAttempt", "qb_adot": "playerStatsPassingAverageDepthOfTarget",
      "qb_deep": "playerStatsPassingDeepThrowAttemptsPercentage",
      "qb_hero": "playerStatsPassingHeroThrowPercentage", "qb_sackpct": "playerStatsPassingSackedPercentage",
      "qb_poe": "playerStatsPassingPressuredOverExpected", "qb_ttt": "playerStatsPassingAverageTimeToThrow",
      "qb_firstread": "playerStatsPassingTargetedReadFirstPercentage",
      "qb_checkdown": "playerStatsPassingTargetedReadCheckdownPercentage",
      "qb_scramble": "playerStatsPassingScramblesTotal", "qb_db": "playerStatsPassingDropbacksTotal",
      "qb_att": "playerStatsPassingAttemptsTotal"}
for k, c in QC.items():
    qb[k] = num(qb[c])
f_qb = entering(qb, "playerPlayerId", list(QC), "")

# ============================================================ OPPONENT / TEAM BLOCKS
# ---- opponent RUN defense ----
dr = _read_fp("team_defense_rushing-advanced")
dr["__k"] = team_key(dr)
DR = {"dru_ypa": "opponentStatsRushingYardsPerAttempt", "dru_ybc": "opponentStatsRushingYardsBeforeContactPerAttempt",
      "dru_yac": "opponentStatsRushingYardsAfterContactPerAttempt",
      "dru_stuff": "opponentStatsRushingAttemptsStuffsPercentage",
      "dru_succ": "opponentStatsRushingAttemptsSuccessPercentage",
      "dru_expl": "opponentStatsRushingRunsExplosivePercentage",
      "dru_mtf": "opponentStatsRushingMissedTacklesForcedPerAttempt",
      "dru_att": "opponentStatsRushingAttemptsTotal", "dru_in5": "opponentStatsInside5RushingAttemptsTotal",
      "dru_zoneypa": "opponentStatsRushingConceptZoneYardsPerAttempt",
      "dru_manypa": "opponentStatsRushingConceptManYardsPerAttempt",
      "dru_tdpct": "opponentStatsRushingTouchdownsPercentage"}
for k, c in DR.items():
    dr[k] = num(dr[c])
f_dr = entering(dr, "__k", list(DR), "")

# ---- opponent COVERAGE diet ----
cov = _read_fp("team_defense_coverage-matrix")
cov["__k"] = team_key(cov)
CV = {"dcv_man": "opponentStatsCoverageSchemeManPassingDropbacksPercentage",
      "dcv_zone": "opponentStatsCoverageSchemeZonePassingDropbacksPercentage",
      "dcv_twohigh": "opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage"}
for k, c in CV.items():
    cov[k] = num(cov[c])
f_cov = entering(cov, "__k", list(CV), "")

# ---- opponent PASS defense ----
dp = _read_fp("team_defense_passing-advanced")
dp["__k"] = team_key(dp)
DP = {"dps_ypa": "opponentStatsPassingYardsPerAttempt", "dps_cpoe": "opponentStatsPassingCompletionsOverExpected",
      "dps_sack": "opponentStatsPassingSackedPercentage", "dps_poe": "opponentStatsPassingPressuredOverExpected",
      "dps_adot": "opponentStatsPassingAverageDepthOfTarget", "dps_att": "opponentStatsPassingAttemptsTotal",
      "dps_db": "opponentStatsPassingDropbacksTotal"}
DP = {k: c for k, c in DP.items() if c in dp.columns}
for k, c in DP.items():
    dp[k] = num(dp[c])
f_dp = entering(dp, "__k", list(DP), "")

# ---- opponent RECEIVING allowed ----
drc = _read_fp("team_defense_receiving-advanced")
drc["__k"] = team_key(drc)
DRC = {"drc_yds": "opponentStatsReceivingYardsTotal", "drc_tgt": "opponentStatsReceivingTargetsTotal",
       "drc_rec": "opponentStatsReceivingReceptionsTotal", "drc_yprr": "opponentStatsReceivingAveragesPerRouteYardsTotal",
       "drc_adot": "opponentStatsReceivingAverageDepthOfTarget"}
DRC = {k: c for k, c in DRC.items() if c in drc.columns}
for k, c in DRC.items():
    drc[k] = num(drc[c])
f_drc = entering(drc, "__k", list(DRC), "")

# ---- TRENCHES (OL vs DL) ----
lm = _read_fp("lineMatchups__team")
lm["__k"] = team_key(lm)
LM = {"ol_press_allow": "teamStatsPassingPressuredPercentage", "ol_poe": "teamStatsPassingPressuredOverExpected",
      "ol_ybc_tot": "teamStatsRushingYardsBeforeContactTotal", "ol_rush_att": "teamStatsRushingAttemptsTotal",
      "dl_press": "opponentStatsPassingPressuredPercentage", "dl_poe": "opponentStatsPassingPressuredOverExpected",
      "dl_ybc_tot": "opponentStatsRushingYardsBeforeContactTotal"}
for k, c in LM.items():
    lm[k] = num(lm[c])
f_lm = entering(lm, "__k", list(LM), "")

# ---- GAME SCRIPT: PROE (proeReport) + pass/rush snap split (run-pass report) ----
# This is the volume engine for attempts/completions/receptions markets.
pr_t = _read_fp("proeReport__team")
pr_t["__k"] = team_key(pr_t)
pr_t["gs_db"] = num(pr_t.teamStatsPassingDropbacksTotal)
pr_t["gs_db_exp"] = num(pr_t.teamStatsPassingDropbacksExpected)
pr_t["gs_proe"] = pr_t.gs_db - pr_t.gs_db_exp            # pass-rate over expected (volume tilt)
pr_t["gs_snaps"] = num(pr_t.teamStatsSnapsOffenseTotal)
f_gs = entering(pr_t, "__k", ["gs_db", "gs_db_exp", "gs_proe", "gs_snaps"], "")

rpr = _read_fp("team_run-pass-report")
rpr["__k"] = team_key(rpr)
rpr["rp_pass"] = num(rpr.teamStatsSnapsOffensePass)
rpr["rp_rush"] = num(rpr.teamStatsSnapsOffenseRush)
rpr["rp_tot"] = num(rpr.teamStatsSnapsOffenseTotal)
rpr["rp_passrate"] = rpr.rp_pass / rpr.rp_tot.replace(0, np.nan)
f_rp = entering(rpr, "__k", ["rp_pass", "rp_rush", "rp_tot", "rp_passrate"], "")

# opponent pace/volume allowed
pr_o = _read_fp("proeReport__opponent")
pr_o["__k"] = team_key(pr_o)
oc = {"ogs_db": "opponentStatsPassingDropbacksTotal", "ogs_snaps": "opponentStatsSnapsOffenseTotal"}
oc = {k: c for k, c in oc.items() if c in pr_o.columns}
for k, c in oc.items():
    pr_o[k] = num(pr_o[c])
f_ogs = entering(pr_o, "__k", list(oc), "") if oc else None

print("feature blocks built: rush/bellcow/recv/sep/qb + oppRun/cov/pass/recvAllowed/trench/gamescript")

# ============================================================ ASSEMBLE
def attach(pn):
    """Merge every block onto the panel: player blocks on player+season+week,
    opponent blocks on opp, team blocks on the player's own team."""
    def pm(p, f):
        return p.merge(f, left_on=["playerPlayerId", "season", "week"],
                       right_on=["playerPlayerId", "__season", "__week"], how="left").drop(
                           columns=["__season", "__week"], errors="ignore")
    for f in (f_rush, f_bc, f_recv, f_sep, f_qb):
        pn = pm(pn, f)
    def tm(p, f, on, pref):
        g = f.rename(columns={c: pref + c for c in f.columns if c not in ("__k", "__season", "__week")})
        return p.merge(g, left_on=[on, "season", "week"], right_on=["__k", "__season", "__week"],
                       how="left").drop(columns=["__k", "__season", "__week"], errors="ignore")
    pn = tm(pn, f_dr, "opp", "O_")
    pn = tm(pn, f_cov, "opp", "O_")
    pn = tm(pn, f_dp, "opp", "O_")
    pn = tm(pn, f_drc, "opp", "O_")
    pn = tm(pn, f_lm, "opp", "OL_")      # opponent's DL vs us
    pn = tm(pn, f_lm, "team", "T_")      # our own OL
    pn = tm(pn, f_gs, "team", "T_")      # our PROE / dropback volume
    pn = tm(pn, f_gs, "opp", "O_")       # opponent's own pass volume (game flow)
    pn = tm(pn, f_rp, "team", "T_")      # our pass/rush snap split
    pn = tm(pn, f_rp, "opp", "O_")       # opponent pass/rush split faced
    if f_ogs is not None:
        pn = tm(pn, f_ogs, "opp", "O_")  # volume the opponent defense allows
    return pn


panel = attach(panel)

# ---- engineered INTERACTIONS (trait x matchup) ----
P = panel
P["ix_rush_front"] = P.ru_ypa - P.O_dru_ypa                 # back efficiency vs run D
P["ix_ybc_gap"] = P.ru_ybc - P.O_dru_ybc                    # OL push vs their front
P["ix_yac_soft"] = P.ru_yac * P.O_dru_mtf                   # tackle-breaker vs poor tacklers
P["ix_stuff"] = P.ru_stuff * P.O_dru_stuff                  # stuff-prone vs stuffing D
P["ix_zone_fit"] = P.ru_zoneypa * P.O_dru_zoneypa           # zone runner vs zone-vulnerable
P["ix_workload"] = P.ms_rush * P.tm_rush_att                # share x team volume = attempts
P["ix_script_rush"] = P.ms_rush * (-P.team_spread)          # favorite => more rush
P["ix_script_pass"] = P.T_gs_proe * P.total                 # pass-happy x high total
P["ix_sep_man"] = P.sp_score * P.O_dcv_man
P["ix_slot_zone"] = P.rc_slot * P.O_dcv_zone
P["ix_deep_2h"] = P.rc_adot * P.O_dcv_twohigh
P["ix_bfield_2h"] = P.rc_bfield * P.O_dcv_twohigh
P["ix_tprr_soft"] = P.rc_tprr * P.O_drc_tgt
P["ix_press_rush"] = P.qb_poe * P.OL_dl_poe
P["ix_hold_rush"] = P.qb_ttt * P.OL_dl_poe
P["ix_scram_2h"] = P.qb_scramble * P.O_dcv_twohigh          # two-high invites scrambles
P["ix_chk_2h"] = P.qb_checkdown * P.O_dcv_twohigh
P["ix_qb_vol"] = P.qb_db * P.T_gs_proe
panel = P

# ============================================================ FEATURE SETS PER MARKET
MKT_CTX = ["close_line", "l3", "l5", "szn", "total", "team_spread", "is_home"]
B_RUSH = [c for c in panel.columns if c.startswith(("ru_", "ms_", "tm_", "O_dru", "OL_dl", "T_ol", "T_gs", "O_gs", "T_rp", "O_rp", "O_ogs"))]
B_RECV = [c for c in panel.columns if c.startswith(("rc_", "sp_", "O_dcv", "O_drc", "ms_", "T_gs", "O_gs", "T_rp", "O_rp", "O_ogs"))]
B_QB = [c for c in panel.columns if c.startswith(("qb_", "O_dps", "O_dcv", "OL_dl", "T_ol", "T_gs", "O_gs", "T_rp", "O_rp", "O_ogs"))]
IX = [c for c in panel.columns if c.startswith("ix_")]
SETS = {
    "player_rush_yds":        MKT_CTX + B_RUSH + [c for c in IX if c.split("_")[1] in ("rush","ybc","yac","stuff","zone","workload","script")],
    "player_rush_attempts":   MKT_CTX + B_RUSH + [c for c in IX if c.split("_")[1] in ("workload","script","stuff")],
    "player_receptions":      MKT_CTX + B_RECV + [c for c in IX if c.split("_")[1] in ("sep","slot","deep","bfield","tprr","script")],
    "player_reception_yds":   MKT_CTX + B_RECV + [c for c in IX if c.split("_")[1] in ("sep","slot","deep","bfield","tprr","script")],
    "player_pass_yds":        MKT_CTX + B_QB + [c for c in IX if c.split("_")[1] in ("press","hold","chk","qb","script")],
    "player_pass_tds":        MKT_CTX + B_QB + [c for c in IX if c.split("_")[1] in ("press","hold","chk","qb","script")],
    "player_pass_attempts":   MKT_CTX + B_QB + [c for c in IX if c.split("_")[1] in ("qb","script","press")],
    "player_pass_completions": MKT_CTX + B_QB + [c for c in IX if c.split("_")[1] in ("qb","script","press")],
}
# absolute edge thresholds (units of the market) — %-of-median selects nothing on small lines
THR = {"player_rush_yds": (6, 12, 18), "player_rush_attempts": (0.8, 1.3, 1.8),
       "player_receptions": (0.4, 0.7, 1.0), "player_reception_yds": (6, 12, 18),
       "player_pass_yds": (10, 20, 30), "player_pass_tds": (0.15, 0.25, 0.35),
       "player_pass_attempts": (1.5, 2.5, 3.5), "player_pass_completions": (1.0, 1.75, 2.5)}


def ridge(X, y, lam):
    Xb = np.hstack([X, np.ones((len(X), 1))])
    A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.lstsq(A, Xb.T @ y, rcond=None)[0]


def run(mkt, positions, lam=60.0, label=None, minwk=4):
    d = panel[(panel.market == mkt) & panel.position.isin(positions)].copy()
    d = d[(d.week >= minwk) & d.close_line.notna() & (d.close_line > 0) & d.actual.notna()]
    F = [c for c in dict.fromkeys(SETS[mkt]) if c in d.columns and d[c].notna().mean() > 0.35]
    if len(d) < 400 or len(F) < 5:
        print(f"  {mkt}/{'+'.join(positions)}: thin (n={len(d)})"); return None
    d[F] = d[F].apply(lambda s: s.fillna(s.median())).fillna(0)
    preds = []
    for ssn in (2024, 2025):
        tr, te = d[d.season < ssn], d[d.season == ssn].copy()
        if len(tr) < 300 or not len(te):
            continue
        Fk = [c for c in F if tr[c].std() > 1e-9]
        X = tr[Fk].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
        w = ridge((X - m) / s, tr.actual.values.astype(float), lam)
        te["pred"] = np.hstack([(te[Fk].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
        preds.append(te)
    if not preds:
        return None
    pr = pd.concat(preds); pr["edge"] = pr.pred - pr.close_line
    tag = label or f"{mkt} [{'+'.join(positions)}]"
    live = (pr.actual != pr.close_line)
    print(f"\n== {tag} ==  n={len(pr)}  feats={len(F)}  (2023-lined training)")
    for thr in THR[mkt]:
        m = pr.edge.abs() >= thr; pk = pr.edge >= thr
        w = np.where(pk, pr.actual > pr.close_line, pr.actual < pr.close_line)
        ok = m & live
        if ok.sum() < 25:
            continue
        z = (w[ok].mean() - .5) * 2 * np.sqrt(ok.sum())
        frac = 100 * ok.sum() / live.sum()
        row = f"   edge>={thr:>5}: {100*w[ok].mean():5.1f}%  n={ok.sum():4d} ({frac:4.1f}% of board)  z={z:+.2f}"
        for ssn in (2024, 2025):
            sm = ok & (pr.season == ssn)
            if sm.sum() >= 20:
                row += f"  [{ssn}:{100*w[sm].mean():.1f}%/{sm.sum()}]"
        print(row)
    return pr


# ============================================================ FROZEN SPECS
# Best configuration per market, chosen on: both-season stability, two-sided win
# (wins betting OVER *and* UNDER = not a base-rate lean), placebo margin, and
# robustness to lambda. Feature-set matters as much as lambda: the receiving
# markets DEGRADE when rushing/game-script columns are added (2024 fell 54->50),
# so they get the narrow role/separation/coverage set. See FPDATA_RESEARCH_PROGRAM.md.
NARROW_RECV = MKT_CTX + [c for c in panel.columns if c.startswith(("rc_", "sp_", "O_dcv", "O_drc"))] \
    + [c for c in panel.columns if c.startswith("ix_") and c.split("_")[1] in ("sep", "slot", "deep", "bfield", "tprr")]
NARROW_RUSH = MKT_CTX + [c for c in panel.columns if c.startswith(("ru_", "ms_", "tm_", "O_dru"))] \
    + [c for c in panel.columns if c.startswith("ix_") and c.split("_")[1] in ("rush", "ybc", "yac", "stuff", "zone", "workload", "script")]

# ★★★ PROPS — FINAL READ, ALL CONFIGS SCORED, NO SELECTION (2026-09-18, exp_prop_config_robustness.py)
# The right question is not "does the best config hold" (one draw, can be unlucky) but "what share
# of ALL configs (lambda x threshold x feature set x injury-ctx) is profitable in EACH season" at
# best-book T-60 execution:
#                          2024 %>0  median | 2025 %>0  median | both>0
#   ★ pass_yds QB            100%   +7.6%  |   81%   +6.9%  |  81%   ROBUST. (the one 2024-best config
#       that lost in 2025 was in the unlucky 19%; the market itself is real)              SHIP
#   ★ reception_yds WR/TE     92%   +2.9%  |   79%   +2.5%  |  71%   ROBUST but small. SHIP-lean
#   ~ pass_completions QB      43%   -1.3%  |  100%  +22.1%  |  43%   REAL IN 2025, flat 2024. Season-
#       variable; ship at reduced stakes, expect +5..+20 not +22.
#   ~ receptions WR/TE         30%   -2.3%  |  100%   +7.3%  |  30%   2025-only. candidate.
#   ~ pass_attempts QB         25%   -3.5%  |  100%   +9.1%  |  25%   2025-only. candidate.
#   x rush_attempts (19% both), rush_yds (0%), RB receptions (18%): no.
# Earlier verdicts ("five markets", then "pass_yds fails") were both single-config views; this
# table supersedes them. Execution unchanged: T-60, best available book, DNP = no action, +CTX for QB.
SPECS = [
    # (market, positions, lambda, threshold, feature_set, tier, note)
    ("player_pass_tds", ["QB"], 200, 0.35, None, "CONFIRMED",
     "61.0% n=351 (39% of board) 2024:61.0/2025:61.0; two-sided; beats 100% of placebos; stronger as lambda rises"),
    ("player_pass_yds", ["QB"], 60, 20, None, "CONFIRMED",
     "56.8% n=400 (45%) 2024:56.9/2025:56.6; two-sided (OVER 55.9/UNDER 60.0); 100% of placebos"),
    ("player_receptions", ["WR", "TE"], 200, 0.7, NARROW_RECV, "CONFIRMED",
     "56.7% n=365 (11%) 2024:54.9/2025:59.1; narrow set beats wide; thr0.4 = 55.3% on 36% of board"),
    ("player_reception_yds", ["WR", "TE"], 200, 12, NARROW_RECV, "CANDIDATE",
     "56.8% n=310 (8.4%) 2024:55.7/2025:60.9 — was declared dead under the wide set; narrow+lam200 revives it"),
    ("player_receptions", ["RB"], 600, 0.7, NARROW_RECV, "CANDIDATE",
     "56.8% n=206 (24%) 2024:54.1/2025:60.0; thr1.0 -> 61.0% but n=82"),
    ("player_rush_attempts", ["RB"], 200, 1.8, NARROW_RUSH, "CANDIDATE",
     "56.7% n=277 (20%) 2024:58.3/2025:54.8; two-sided; NON-MONOTONE dose and collapses at lam600 -> lambda-fragile"),
    # --- not shippable: documented so nobody re-runs them expecting a find ---
    ("player_pass_completions", ["QB"], 60, 1.75, None, "UNSTABLE",
     "pooled 56.4% but 2024:51.5 vs 2025:65.0 — one-season mirage, do NOT ship"),
    ("player_pass_attempts", ["QB"], 60, 1.5, None, "UNSTABLE",
     "pooled 54.6% but 2024:52.5 vs 2025:58.0 and negative at high thresholds"),
    ("player_rush_yds", ["RB"], 200, 12, NARROW_RUSH, "DEAD", "50-52% at every lambda/threshold"),
    ("player_rush_yds", ["QB"], 200, 12, None, "DEAD", "50-51%; earlier 55-56% was small-sample noise"),
]

if __name__ == "__main__":
    print("\n" + "=" * 100)
    print("UNIFIED PROP ENGINE — frozen specs, every market")
    print("=" * 100)
    for mkt, pos, lam, thr, fs, tier, note in SPECS:
        if fs is not None:
            SETS[mkt] = fs
        THR[mkt] = (thr,)
        print(f"\n[{tier}] {note}")
        run(mkt, pos, lam=lam, label=f"{mkt} [{'+'.join(pos)}] lam={lam}")
