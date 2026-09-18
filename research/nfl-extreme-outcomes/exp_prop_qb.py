#!/usr/bin/env python3
"""Distilled QB prop model — ALL QB markets (owner 2026-09-17). QB composites
(accuracy, aggression, poise/pressure-handling, read profile, volume) + opponent
defense (pass rush, coverage diet, EPA allowed) + matchup interactions + line,
ridge, walk-forward, over/under vs close with dose-response. Same architecture
that cracked RB receptions."""
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

# ---- QB composites from passing-advanced (player_id, prior-season seed via expanding) ----
qb = pd.read_parquet("data/fpdata/player_passing-advanced.parquet")
qb["db"] = num(qb.playerStatsPassingDropbacksTotal)
qb = qb[qb.db >= 10].copy()
QC = {"cpoe": "playerStatsPassingCompletionsOverExpected", "acc": "playerStatsPassingThrowAccuracyHighlyAccuratePercentage",
      "offtgt": "playerStatsPassingOffTargetThrowAttemptsPercentage", "ypa": "playerStatsPassingYardsPerAttempt",
      "adot": "playerStatsPassingAverageDepthOfTarget", "deep": "playerStatsPassingDeepThrowAttemptsPercentage",
      "hero": "playerStatsPassingHeroThrowPercentage", "sackpct": "playerStatsPassingSackedPercentage",
      "poe": "playerStatsPassingPressuredOverExpected", "ttt": "playerStatsPassingAverageTimeToThrow",
      "firstread": "playerStatsPassingTargetedReadFirstPercentage", "checkdown": "playerStatsPassingTargetedReadCheckdownPercentage",
      "scramble": "playerStatsPassingScramblesTotal", "dbks": "playerStatsPassingDropbacksTotal",
      "att": "playerStatsPassingAttemptsTotal"}
for k, c in QC.items():
    qb[k] = num(qb[c])
qb = qb.sort_values(["playerPlayerId", "__season", "__week"])
for k in QC:
    qb["q_" + k] = pre(qb, ["playerPlayerId", "__season"], k)
qprof = qb[["playerPlayerId", "__season", "__week"] + ["q_" + k for k in QC]]
panel = panel.merge(qprof, left_on=["playerPlayerId", "season", "week"],
                    right_on=["playerPlayerId", "__season", "__week"], how="left")

# ---- opponent defense: coverage diet + pass rush ----
cov = pd.read_parquet("data/fpdata/team_defense_coverage-matrix.parquet")
cov["ab_nv"] = cov.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
for k, c in (("man", "opponentStatsCoverageSchemeManPassingDropbacksPercentage"),
             ("zone", "opponentStatsCoverageSchemeZonePassingDropbacksPercentage"),
             ("twohigh", "opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage")):
    cov[k] = num(cov[c])
cov = cov.sort_values(["ab_nv", "__season", "__week"])
for k in ("man", "zone", "twohigh"):
    cov["d_" + k] = pre(cov, ["ab_nv", "__season"], k, mp=2)
lm = pd.read_parquet("data/fpdata/lineMatchups__team.parquet")
lm["ab_nv"] = lm.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
lm["rush_poe"] = num(lm.opponentStatsPassingPressuredOverExpected)
lm = lm.sort_values(["ab_nv", "__season", "__week"])
lm["d_rush_poe"] = pre(lm, ["ab_nv", "__season"], "rush_poe", mp=2)
panel = panel.merge(cov[["ab_nv", "__season", "__week", "d_man", "d_zone", "d_twohigh"]],
                    left_on=["opp", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="left", suffixes=("", "_c"))
panel = panel.merge(lm[["ab_nv", "__season", "__week", "d_rush_poe"]],
                    left_on=["opp", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="left", suffixes=("", "_l"))

# ---- matchup interactions ----
panel["mx_press_rush"] = panel.q_poe * panel.d_rush_poe        # QB pressure-prone × strong pass rush
panel["mx_deep_2h"] = panel.q_deep * panel.d_twohigh          # deep QB × two-high (suppress)
panel["mx_chk_2h"] = panel.q_checkdown * panel.d_twohigh      # checkdown QB × two-high
panel["mx_hold_rush"] = panel.q_ttt * panel.d_rush_poe        # slow release × pass rush (sacks)

FEATS = (["close_line", "l3", "l5", "szn", "total", "team_spread", "is_home",
          "off_plays_per_game_s2d", "off_proe_s2d", "off_pass_success_rate_s2d",
          "def_pass_epa_allowed_neutral_s2d", "def_pass_success_allowed_s2d", "def_explosive_pass_allowed_s2d",
          "tm_opp_def_pressure_rate_s2d", "own_avg_time_to_throw_s2d",
          "own_completion_percentage_above_expectation_s2d", "own_aggressiveness_s2d"]
         + ["q_" + k for k in QC] + ["d_man", "d_zone", "d_twohigh", "d_rush_poe",
            "mx_press_rush", "mx_deep_2h", "mx_chk_2h", "mx_hold_rush"])


def ridge(X, y, lam):
    Xb = np.hstack([X, np.ones((len(X), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.lstsq(A, Xb.T @ y, rcond=None)[0]


def run(mkt, lam=40.0):
    d = panel[(panel.market == mkt) & (panel.position == "QB")].copy()
    d = d[(d.week >= 4) & d.close_line.notna() & (d.close_line > 0) & d.actual.notna()]
    F = [c for c in FEATS if c in d.columns and d[c].notna().mean() > 0.4]
    d[F] = d[F].fillna(d[F].median()).fillna(0)
    preds = []
    for ssn in (2024, 2025):
        tr, te = d[d.season < ssn], d[d.season == ssn].copy()
        if len(tr) < 200 or not len(te):
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
    row = f"{mkt:26s} n={len(pr):4d}"
    for fr in (0.04, 0.08, 0.12):
        thr = med * fr
        m = pr.edge.abs() >= thr; pk = pr.edge >= thr
        w = np.where(pk, pr.actual > pr.close_line, pr.actual < pr.close_line)
        ok = m & (pr.actual != pr.close_line)
        if ok.sum() >= 20:
            z = (w[ok].mean() - .5) * 2 * np.sqrt(ok.sum())
            row += f" | {fr*100:.0f}%: {100*w[ok].mean():.1f}%({ok.sum()},z{z:+.1f})"
    print(row)
    # per-season at 8% for the promising ones
    for ssn in (2024, 2025):
        s = pr[pr.season == ssn]; thr = med * 0.08
        m = s.edge.abs() >= thr; pk = s.edge >= thr; ok = m & (s.actual != s.close_line)
        w = np.where(pk, s.actual > s.close_line, s.actual < s.close_line)
        if ok.sum() >= 15:
            print(f"      {ssn}: {100*w[ok].mean():.0f}% (n={ok.sum()})", end="")
    print()


print("QB PROP MARKETS (distilled, dose-response, per-season):")
for m in ["player_pass_yds", "player_pass_completions", "player_pass_attempts",
          "player_pass_tds", "player_rush_yds", "player_rush_attempts"]:
    run(m)
