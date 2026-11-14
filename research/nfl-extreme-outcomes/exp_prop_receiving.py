#!/usr/bin/env python3
"""Receiving prop model (owner mandate 2026-09-17): predict actual reception
yards / receptions with the market line + GRANULAR matchup features. Tests
whether FP granular layer (slot alignment, TPRR, first-read, per-coverage
efficiency, opp coverage diet) beats the v3 base panel. Walk-forward, grade
over/under vs close at edge thresholds."""
import numpy as np
import pandas as pd

AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}


def num(s):
    return pd.to_numeric(s, errors="coerce")


panel = pd.read_parquet("data/nfl_prop_v3_panel.parquet")
panel = panel[panel.market.isin(["player_reception_yds", "player_receptions"])].copy()
cw = pd.read_parquet("data/fpdata/player_crosswalk.parquet")[["player_id", "playerPlayerId"]].drop_duplicates("player_id")
panel = panel.merge(cw, on="player_id", how="left")

# ---- FP granular player features (entering-game, leak-safe s2d) ----
ra = pd.read_parquet("data/fpdata/player_receiving-advanced.parquet")
ra["rte"] = num(ra.playerStatsReceivingRoutesTotal)
G = {"slot_pct": "playerStatsReceivingAlignmentSlotRoutesPercentage",
     "wide_pct": "playerStatsReceivingAlignmentWideRoutesPercentage",
     "tprr": "playerStatsReceivingTargetsPerRoute",
     "yprr": "playerStatsReceivingAveragesPerRouteYardsTotal",
     "firstread_sh": "marketShareReceivingTargetedReadFirst",
     "routeshare": "marketShareReceivingRoutesTotal",
     "catchable": "playerStatsReceivingTargetsCatchablePercentage"}
for k, c in G.items():
    ra[k] = num(ra[c])
ra = ra.sort_values(["playerPlayerId", "__season", "__week"])
for k in G:
    ra["fp_" + k] = ra.groupby(["playerPlayerId", "__season"])[k].transform(
        lambda s: s.shift(1).expanding(min_periods=2).mean())
fp_feats = ra[["playerPlayerId", "__season", "__week"] + ["fp_" + k for k in G]]
panel = panel.merge(fp_feats, left_on=["playerPlayerId", "season", "week"],
                    right_on=["playerPlayerId", "__season", "__week"], how="left")

# ---- per-coverage efficiency fit: player YPT vs shells × opp coverage diet ----
sc = pd.read_parquet("data/fpdata/split_recv_adv_x_coverage.parquet")
sc["yds"] = num(sc.playerStatsReceivingYardsTotal); sc["tgt"] = num(sc.playerStatsReceivingTargetsTotal)
SH = ["Cover 1", "Cover 2", "Cover 3", "Cover 4", "Cover 6", "Cover 0"]
sc = sc[sc.playDefenseCoverageSchemeParent.isin(SH)].sort_values(["playerPlayerId", "__season", "__week"])
pg = sc.groupby(["playerPlayerId", "__season", "playDefenseCoverageSchemeParent"])
sc["cy"] = pg.yds.transform(lambda s: s.shift(1).expanding().sum())
sc["ct"] = pg.tgt.transform(lambda s: s.shift(1).expanding().sum())
sc["ypt_pre"] = sc.cy / sc.ct.replace(0, np.nan)
pl_shell = sc.pivot_table(index=["playerPlayerId", "__season", "__week"],
                          columns="playDefenseCoverageSchemeParent", values="ypt_pre").add_prefix("plypt_")
# opp coverage diet (composite scheme rates, entering game)
comp = pd.read_parquet("data/fpdata/composites_v2.parquet"); comp["ab_nv"] = comp.ab.map(lambda a: AB_NV.get(a, a))
cov = pd.read_parquet("data/fpdata/team_defense_coverage-matrix.parquet")
cov["ab"] = cov.teamNickname.map({"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"})
cov["ab_nv"] = cov.ab.map(lambda a: AB_NV.get(a, a))
cov["twohigh"] = num(cov.opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage)
cov["man"] = num(cov.opponentStatsCoverageSchemeManPassingDropbacksPercentage)
cov = cov.sort_values(["ab_nv", "__season", "__week"])
for k in ("twohigh", "man"):
    cov["oppdef_" + k] = cov.groupby(["ab_nv", "__season"])[k].transform(lambda s: s.shift(1).expanding(min_periods=2).mean())
panel = panel.merge(pl_shell.reset_index(), left_on=["playerPlayerId", "season", "week"],
                    right_on=["playerPlayerId", "__season", "__week"], how="left", suffixes=("", "_ps"))
panel = panel.merge(cov[["ab_nv", "__season", "__week", "oppdef_twohigh", "oppdef_man"]],
                    left_on=["opp", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="left", suffixes=("", "_cv"))

FP_LAYER = ["fp_" + k for k in G] + ["oppdef_twohigh", "oppdef_man"]
BASE = ["close_line", "l3", "l5", "szn", "tgt_share_s2d", "tgt_share_l3", "snap_pct_s2d",
        "off_plays_per_game_s2d", "off_proe_s2d", "team_spread", "total", "is_home",
        "oppallow_receiving_yards_s2d", "oppallow_targets_s2d", "opp_pos_allow_s2d",
        "own_avg_separation_s2d", "own_catch_percentage_s2d", "def_pass_epa_allowed_neutral_s2d"]


def rf(X, y, lam=25.0):
    Xb = np.hstack([X, np.ones((len(X), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.lstsq(A, Xb.T @ y, rcond=None)[0]


def run(mkt, feats, tag):
    d = panel[panel.market == mkt].dropna(subset=["actual", "close_line"]).copy()
    F = [c for c in feats if c in d.columns and d[c].notna().mean() > 0.5]
    d[F] = d[F].fillna(d[F].median()).fillna(0)
    d = d[d.week >= 4]
    preds = []
    for ssn in (2023, 2024, 2025):
        tr, te = d[d.season < ssn], d[d.season == ssn].copy()
        if len(tr) < 200 or not len(te):
            continue
        Fk = [c for c in F if tr[c].std() > 1e-9]
        X = tr[Fk].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
        w = rf((X - m) / s, tr.actual.values.astype(float))
        te["pred"] = np.hstack([(te[Fk].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
        preds.append(te)
    pr = pd.concat(preds)
    pr["edge"] = pr.pred - pr.close_line
    out = f"{tag:22s}"
    for thr_frac in (0.05, 0.10):
        thr = pr.close_line.median() * thr_frac
        m = pr.edge.abs() >= thr
        pk = pr.edge >= thr
        w = np.where(pk, pr.actual > pr.close_line, pr.actual < pr.close_line)
        ok = m & (pr.actual != pr.close_line)
        out += f"  edge>={100*thr_frac:.0f}%: {100*w[ok].mean():.1f}% (n={ok.sum()})"
    print(out)


for mkt in ("player_reception_yds", "player_receptions"):
    print(f"\n== {mkt} (base over rate ~50%) ==")
    run(mkt, BASE, "v3 BASE")
    run(mkt, BASE + FP_LAYER, "BASE + FP granular")
    run(mkt, BASE + FP_LAYER + [f"plypt_{s}" for s in SH], "BASE + FP + per-coverage")
