#!/usr/bin/env python3
"""DISTILLED prop model (owner mandate — the whole point): engineer per-player
composites from ALL granular dimensions (opportunity, role, efficiency, read
profile) + player×defense MATCHUP interactions + context + line, regularized
ridge, walk-forward, graded over/under vs close with dose-response. This is the
props analogue of the sides v3/v4 distillation that beat the market."""
import numpy as np
import pandas as pd

AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR","Bears":"CHI",
"Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HST",
"Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA",
"Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT",
"Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
num = lambda s: pd.to_numeric(s, errors="coerce")


def pre(df, keys, col, mp=3):
    return df.groupby(keys)[col].transform(lambda s: s.shift(1).expanding(min_periods=mp).mean())


panel = pd.read_parquet("data/nfl_prop_v3_panel.parquet")
cw = pd.read_parquet("data/fpdata/player_crosswalk.parquet")[["player_id", "playerPlayerId"]].drop_duplicates("player_id")
panel = panel.merge(cw, on="player_id", how="left")

# ---- engineer per-player composites from FP receiving-advanced ----
ra = pd.read_parquet("data/fpdata/player_receiving-advanced.parquet")
RC = {"routeshare": "marketShareReceivingRoutesTotal", "tgtshare_air": "marketShareReceivingYardsAir",
      "tprr": "playerStatsReceivingTargetsPerRoute", "yprr": "playerStatsReceivingAveragesPerRouteYardsTotal",
      "slot": "playerStatsReceivingAlignmentSlotRoutesPercentage", "wide": "playerStatsReceivingAlignmentWideRoutesPercentage",
      "bfield": "playerStatsReceivingAlignmentBackfieldRoutesPercentage", "adot": "playerStatsReceivingAverageDepthOfTarget",
      "firstread": "marketShareReceivingTargetedReadFirst", "design": "playerStatsReceivingTargetedReadDesignPercentage",
      "catchable": "playerStatsReceivingTargetsCatchablePercentage"}
for k, c in RC.items():
    ra[k] = num(ra[c])
ra = ra.sort_values(["playerPlayerId", "__season", "__week"])
for k in RC:
    ra["r_" + k] = pre(ra, ["playerPlayerId", "__season"], k)
sep = pd.read_parquet("data/fpdata/player_receiving-separation-by-alignment.parquet")
sep["ss"] = num(sep.playerStatsReceivingSeparationScorePercentage)
sep["win"] = num(sep.playerStatsReceivingSeparationWinsPercentage)
sep = sep.sort_values(["playerPlayerId", "__season", "__week"])
sep["r_sep"] = pre(sep, ["playerPlayerId", "__season"], "ss")
sep["r_sepwin"] = pre(sep, ["playerPlayerId", "__season"], "win")
plfeat = ra[["playerPlayerId", "__season", "__week"] + ["r_" + k for k in RC]].merge(
    sep[["playerPlayerId", "__season", "__week", "r_sep", "r_sepwin"]], on=["playerPlayerId", "__season", "__week"], how="outer")

# ---- opponent defense composites (coverage diet, pass-funnel, pos-allowed already in panel) ----
cov = pd.read_parquet("data/fpdata/team_defense_coverage-matrix.parquet")
cov["ab_nv"] = cov.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
for k, c in (("man", "opponentStatsCoverageSchemeManPassingDropbacksPercentage"),
             ("zone", "opponentStatsCoverageSchemeZonePassingDropbacksPercentage"),
             ("twohigh", "opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage")):
    cov[k] = num(cov[c])
cov = cov.sort_values(["ab_nv", "__season", "__week"])
for k in ("man", "zone", "twohigh"):
    cov["d_" + k] = pre(cov, ["ab_nv", "__season"], k, mp=2)

panel = panel.merge(plfeat, left_on=["playerPlayerId", "season", "week"],
                    right_on=["playerPlayerId", "__season", "__week"], how="left")
panel = panel.merge(cov[["ab_nv", "__season", "__week", "d_man", "d_zone", "d_twohigh"]],
                    left_on=["opp", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="left", suffixes=("", "_c"))

# ---- engineered MATCHUP interactions (player trait x opp defense) ----
panel["mx_sep_man"] = panel.r_sep * panel.d_man          # separator vs man
panel["mx_slot_zone"] = panel.r_slot * panel.d_zone      # slot vs zone
panel["mx_deep_2h"] = panel.r_adot * panel.d_twohigh     # deep vs two-high (should suppress)
panel["mx_wide_man"] = panel.r_wide * panel.d_man
panel["mx_bfield_2h"] = panel.r_bfield * panel.d_twohigh  # RB routes vs two-high (checkdowns)

FEATS = (["close_line", "l3", "l5", "szn", "total", "team_spread", "is_home",
          "tgt_share_s2d", "tgt_share_l3", "snap_pct_s2d", "off_plays_per_game_s2d", "off_proe_s2d",
          "oppallow_receiving_yards_s2d", "oppallow_targets_s2d", "oppallow_receptions_s2d",
          "opp_pos_allow_s2d", "def_pass_epa_allowed_neutral_s2d",
          "own_avg_separation_s2d", "own_catch_percentage_s2d"]
         + ["r_" + k for k in RC] + ["r_sep", "r_sepwin", "d_man", "d_zone", "d_twohigh",
            "mx_sep_man", "mx_slot_zone", "mx_deep_2h", "mx_wide_man", "mx_bfield_2h"])


def ridge(X, y, lam):
    Xb = np.hstack([X, np.ones((len(X), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.lstsq(A, Xb.T @ y, rcond=None)[0]


def run(mkt, positions, lam=40.0):
    d = panel[(panel.market == mkt) & panel.position.isin(positions)].copy()
    d = d[(d.week >= 4) & d.close_line.notna() & (d.close_line > 0) & d.actual.notna()]
    F = [c for c in FEATS if c in d.columns and d[c].notna().mean() > 0.4]
    d[F] = d[F].fillna(d[F].median()).fillna(0)
    preds = []
    for ssn in (2024, 2025):   # 2023 close_line NaN in panel -> train 2024 on 2021-23(lined subset), test 24/25
        tr = d[d.season < ssn]
        te = d[d.season == ssn].copy()
        if len(tr) < 300 or not len(te):
            continue
        Fk = [c for c in F if tr[c].std() > 1e-9]
        X = tr[Fk].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
        w = ridge((X - m) / s, tr.actual.values.astype(float), lam)
        te["pred"] = np.hstack([(te[Fk].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
        preds.append(te)
    if not preds:
        print(f"  {mkt}: insufficient"); return
    pr = pd.concat(preds)
    pr["edge"] = pr.pred - pr.close_line
    med = pr.close_line.median()
    print(f"== {mkt} ({'/'.join(positions)}) n={len(pr)}, {len(F)} feats ==")
    for fr in (0.04, 0.08, 0.12):
        thr = med * fr
        m = pr.edge.abs() >= thr; pk = pr.edge >= thr
        w = np.where(pk, pr.actual > pr.close_line, pr.actual < pr.close_line)
        ok = m & (pr.actual != pr.close_line)
        if ok.sum() >= 20:
            z = (w[ok].mean() - .5) * 2 * np.sqrt(ok.sum())
            print(f"  edge>={fr*100:.0f}%: {100*w[ok].mean():.1f}% (n={ok.sum()}) z={z:+.2f}")


run("player_receptions", ["WR", "TE"])
run("player_reception_yds", ["WR", "TE"])
run("player_receptions", ["RB"])
