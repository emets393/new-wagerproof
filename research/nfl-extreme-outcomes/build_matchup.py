"""
Build the MATCHUP FEATURE MATRIX: align home+away team-week profiles per game and engineer
unit-nets, interactions, asymmetry/separation terms, and orthogonal (line-relative) targets.
Validates the team-week<->view join by cross-checking shared metrics.
"""
import os
import numpy as np
import pandas as pd

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
load = lambda n: pd.read_parquet(os.path.join(DATA, f"{n}.parquet"))

master = load("master")
tw = load("team_week")
tm = load("team_mapping")
name2ab = dict(zip(tm["team_name"], tm["Team Abbrev"]))
tw["ab"] = tw["team"].map(name2ab)

# drop broken/empty cols
tw = tw.drop(columns=["off_sec_per_play_neutral_s2d", "def_rz_td_rate_allowed_s2d"], errors="ignore")

OFF = [c for c in tw.columns if c.startswith("off_") and c not in ("off_plays_seen", "off_drives_seen")]
DEF = [c for c in tw.columns if c.startswith("def_") and c != "def_plays_seen"]
META = ["off_plays_seen", "def_plays_seen", "off_drives_seen"]

home = tw.rename(columns={c: f"home_{c}" for c in OFF + DEF + META})
home = home.rename(columns={"ab": "home_ab"})[["season", "week", "home_ab"] +
                                              [f"home_{c}" for c in OFF + DEF + META]]
away = tw.rename(columns={c: f"away_{c}" for c in OFF + DEF + META})
away = away.rename(columns={"ab": "away_ab"})[["season", "week", "away_ab"] +
                                              [f"away_{c}" for c in OFF + DEF + META]]

# drop view columns whose names collide with the prefixed team-week columns (identical source)
collide = [c for c in home.columns.tolist() + away.columns.tolist()
           if c in master.columns and c not in ("season", "week", "home_ab", "away_ab")]
master2 = master.drop(columns=collide)
print(f"[merge] dropped {len(collide)} view cols that collide with team-week (identical): "
      f"{collide[:4]}{'...' if len(collide)>4 else ''}")
g = master2.merge(home, on=["season", "week", "home_ab"], how="left") \
           .merge(away, on=["season", "week", "away_ab"], how="left")
matched = g[[f"home_{OFF[0]}", f"away_{OFF[0]}"]].notna().all(axis=1)
print(f"[merge] team-week joined to {matched.sum()}/{len(g)} games ({matched.mean()*100:.1f}%)")

# ---- validate join: team-week off_pass_success should ~ view home_off_pass_sr_s2d ----
chk = g.dropna(subset=["home_off_pass_success_rate_s2d", "home_off_pass_sr_s2d"])
r = np.corrcoef(chk["home_off_pass_success_rate_s2d"], chk["home_off_pass_sr_s2d"])[0, 1]
d = (chk["home_off_pass_success_rate_s2d"] - chk["home_off_pass_sr_s2d"]).abs()
print(f"[validate] team-week home off_pass_success vs view home_off_pass_sr_s2d: corr={r:.3f} "
      f"|diff| mean={d.mean():.4f} (same metric -> should be ~1.0/near-0)")

# ---- MATCHUP NETS: home offense vs away defense, and away offense vs home defense ----
# pairs of (off_metric, def_allowed_metric) measuring the same phase
pairs = [
    ("pass_epa_neutral_s2d", "pass_epa_allowed_neutral_s2d", "pass_epa"),
    ("rush_epa_neutral_s2d", "rush_epa_allowed_neutral_s2d", "rush_epa"),
    ("pass_success_rate_s2d", "pass_success_allowed_s2d", "pass_sr"),
    ("rush_success_rate_s2d", "rush_success_allowed_s2d", "rush_sr"),
    ("explosive_pass_rate_s2d", "explosive_pass_allowed_s2d", "expl_pass"),
    ("explosive_rush_rate_s2d", "explosive_rush_allowed_s2d", "expl_rush"),
    ("pts_per_drive_s2d", "pts_per_drive_allowed_s2d", "ppd"),
    ("td_pct_per_drive_s2d", "td_pct_per_drive_allowed_s2d", "tdpd"),
    ("early_down_pass_epa_s2d", "early_down_pass_epa_allowed_s2d", "ed_pass"),
    ("early_down_rush_epa_s2d", "early_down_rush_epa_allowed_s2d", "ed_rush"),
]
for off_m, def_m, nm in pairs:
    # home offense advantage = home_off - away_def_allowed (positive=offense favored)
    g[f"hnet_{nm}"] = g[f"home_off_{off_m}"] - g[f"away_def_{def_m}"]
    g[f"anet_{nm}"] = g[f"away_off_{off_m}"] - g[f"home_def_{def_m}"]
    # net separation in this phase (home adv minus away adv) -> contributes to margin
    g[f"sep_{nm}"] = g[f"hnet_{nm}"] - g[f"anet_{nm}"]
    # combined scoring environment in this phase (both offenses' edges) -> contributes to total
    g[f"env_{nm}"] = g[f"hnet_{nm}"] + g[f"anet_{nm}"]

# 3-and-out / turnover are "off bad" so handle sign: off_three_and_out high = offense stalls
g["hnet_3out"] = g["away_def_three_and_out_forced_s2d"] - g["home_off_three_and_out_rate_s2d"]
g["anet_3out"] = g["home_def_three_and_out_forced_s2d"] - g["away_off_three_and_out_rate_s2d"]

# ---- expected points per drive for each team from the matchup (avg of off & opp-def) ----
g["exp_home_ppd"] = (g["home_off_pts_per_drive_s2d"] + g["away_def_pts_per_drive_allowed_s2d"]) / 2
g["exp_away_ppd"] = (g["away_off_pts_per_drive_s2d"] + g["home_def_pts_per_drive_allowed_s2d"]) / 2
g["exp_total_ppd"] = g["exp_home_ppd"] + g["exp_away_ppd"]
g["exp_margin_ppd"] = g["exp_home_ppd"] - g["exp_away_ppd"]

# ---- pace / scoring-environment matchup (totals-relevant) ----
g["pace_sum"] = g["home_off_plays_per_game_s2d"] + g["away_off_plays_per_game_s2d"]
g["proe_sum"] = g["home_off_proe_s2d"] + g["away_off_proe_s2d"]
g["proe_prod"] = g["home_off_proe_s2d"] * g["away_off_proe_s2d"]
g["nohuddle_sum"] = g["home_off_no_huddle_rate_s2d"] + g["away_off_no_huddle_rate_s2d"]
g["expl_pass_sum"] = g["home_off_explosive_pass_rate_s2d"] + g["away_off_explosive_pass_rate_s2d"]
g["to_rate_sum"] = g["home_off_drive_turnover_rate_s2d"] + g["away_off_drive_turnover_rate_s2d"]

# ---- ASYMMETRY / SEPARATION: total absolute phase mismatch -> blowout potential ----
sep_cols = [f"sep_{nm}" for (_, _, nm) in pairs]
g["mismatch_mag"] = g[[f"hnet_{nm}" for (_,_,nm) in pairs] + [f"anet_{nm}" for (_,_,nm) in pairs]].abs().sum(axis=1)
g["sep_mag"] = g[sep_cols].abs().sum(axis=1)  # net separation magnitude

# ---- STRENGTH-ON-WEAKNESS interaction products (elite unit vs terrible opp unit) ----
# z-score the nets within season to make products comparable
g["hpass_x_adeppass"] = g["home_off_explosive_pass_rate_s2d"] * g["away_def_explosive_pass_allowed_s2d"]
g["hrush_x_adefrush"] = g["home_off_rush_success_rate_s2d"] * g["away_def_rush_success_allowed_s2d"]
# pressure (from view FTN) vs offense pass tendency / time-to-throw
for side, opp in [("home", "away"), ("away", "home")]:
    if f"{opp}_def_pressure_rate_s2d" in g.columns:
        g[f"{side}_proe_x_{opp}pressure"] = g[f"{side}_off_proe_s2d"] * g[f"{opp}_def_pressure_rate_s2d"]
        if f"{side}_off_time_to_throw_s2d" in g.columns:
            g[f"{side}_ttt_x_{opp}pressure"] = g[f"{side}_off_time_to_throw_s2d"] * g[f"{opp}_def_pressure_rate_s2d"]

# ---- ORTHOGONAL (line-relative) TARGETS ----
g["mkt_margin"] = -g["home_spread"]                      # market expected home margin
g["implied_home_pts"] = (g["ou_vegas_line"] - g["home_spread"]) / 2.0
g["implied_away_pts"] = (g["ou_vegas_line"] + g["home_spread"]) / 2.0
g["resid_home_pts"] = g["home_score"] - g["implied_home_pts"]   # team scored more/less than priced
g["resid_away_pts"] = g["away_score"] - g["implied_away_pts"]
g["resid_margin"] = g["spread_diff"]                     # actual margin - market (=spread_diff)
g["resid_total"] = g["total_diff"]                       # actual total - market total
# market-relative outcomes
g["over_win"] = np.where(g["total_diff"] > 0, 1, np.where(g["total_diff"] < 0, 0, np.nan))
g["home_cover"] = np.where(g["spread_diff"] > 0, 1, np.where(g["spread_diff"] < 0, 0, np.nan))
g["home_win"] = (g["actual_margin"] > 0).astype(int)

# leak filter feature
g["min_plays_seen"] = g[["home_off_plays_seen", "away_off_plays_seen"]].min(axis=1)

out = os.path.join(DATA, "matchup.parquet")
g.to_parquet(out, index=False)
print(f"[saved] matchup: {g.shape} -> {out}")
print(f"  matchup feature families: nets({len(pairs)*4}) + env/sep + interactions + targets")
print(f"  games week>=4 with team-week data: {((g['week']>=4) & matched).sum()}")

# quick orthogonality preview: do nets correlate with residuals (after line)?
print("\n[preview] corr of matchup nets with LINE-RELATIVE residuals (should be ~0 if priced):")
for col, tgt in [("sep_ppd", "resid_margin"), ("exp_margin_ppd", "resid_margin"),
                 ("exp_total_ppd", "resid_total"), ("pace_sum", "resid_total"),
                 ("env_pass_epa", "resid_total"), ("sep_pass_epa", "resid_margin"),
                 ("mismatch_mag", "spread_miss"), ("proe_sum", "resid_total")]:
    d = g[(g["week"] >= 4)][[col, tgt]].dropna()
    if len(d) > 100:
        print(f"   corr({col:16s}, {tgt:13s}) = {np.corrcoef(d[col], d[tgt])[0,1]:+.3f}  (n={len(d)})")
