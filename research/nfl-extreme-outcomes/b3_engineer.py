"""
Brief #3 — engineer the trend feature library.
Builds a TEAM-GAME long table (2 rows/game, team perspective) with leak-safe condition features
+ outcomes (ATS cover, SU win, ML result + real price). All form/streak features use ONLY prior
games (shifted). Saves tg.parquet. Also attaches game-level O/U fields for the totals scan.
"""
import os, sys
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
load = lambda n: pd.read_parquet(os.path.join(DATA, f"{n}.parquet"))
L = print
m = load("matchup"); ng = load("nflverse_games"); tm = load("team_mapping")
od = load("odds_consensus"); sp = load("splits_2025")

# ---- ML prices from nflverse (all years), vig-sane filter ----
nv_ab = {"LA": "LAR", "SD": "LAC", "STL": "LAR"}
ng = ng[ng.season.between(2018, 2025)].copy()
ng["home_ab"] = ng["home_team"].replace(nv_ab); ng["away_ab"] = ng["away_team"].replace(nv_ab)
mlcols = ng[["season", "week", "home_ab", "away_ab", "home_moneyline", "away_moneyline"]].rename(
    columns={"home_moneyline": "ml_home", "away_moneyline": "ml_away"})
m = m.merge(mlcols, on=["season", "week", "home_ab", "away_ab"], how="left")

# ---- base game fields ----
m["mkt_margin"] = -m["home_spread"]
m["abs_spread"] = m["home_spread"].abs()
m["pr_diff"] = m["home_predictive_pr"] - m["away_predictive_pr"]
m["rest_diff"] = m["home_rest"] - m["away_rest"]
m["is_outdoor"] = (~m["dome_closed"].astype("boolean").fillna(False)).astype(int)
m["over"] = np.where(m["total_diff"] > 0, 1.0, np.where(m["total_diff"] < 0, 0.0, np.nan))
m["ats_home"] = np.where(m["spread_diff"] > 0, 1.0, np.where(m["spread_diff"] < 0, 0.0, np.nan))

# ---- line movement (2023-25) merged ----
mvc = od[["season", "home_ab", "away_ab", "open_spread", "close_spread", "spread_move",
          "open_total", "close_total", "total_move"]]
m = m.merge(mvc, on=["season", "home_ab", "away_ab"], how="left")

# ---- 2025 splits merged ----
spc = sp[["season", "home_ab", "away_ab", "home_spread_handle", "home_spread_bets",
          "spread_splits_label", "total_splits_label"]]
m = m.merge(spc, on=["season", "home_ab", "away_ab"], how="left")


def vig_ok(a, b):
    def imp(o): return np.where(o < 0, -o/(-o+100), 100/(o+100))
    s = imp(a) + imp(b)
    return (a.abs().between(100, 2000)) & (b.abs().between(100, 2000)) & (s >= 1.0) & (s <= 1.12)


m["ml_vig_ok"] = vig_ok(m["ml_home"], m["ml_away"])

# ================= build TEAM-GAME long table =================
def side(df, venue):
    opp = "away" if venue == "home" else "home"
    sgn = 1 if venue == "home" else -1
    d = pd.DataFrame({
        "season": df["season"], "week": df["week"], "unique_id": df["unique_id"],
        "team": df[f"{venue}_ab"], "opp": df[f"{opp}_ab"], "is_home": 1 if venue == "home" else 0,
        "team_score": df[f"{venue}_score"], "opp_score": df[f"{opp}_score"],
        "margin": sgn * df["actual_margin"],
        "team_spread": sgn * df["home_spread"],                       # team's number (neg=team favored)
        "team_cover": df["ats_home"] if venue == "home" else 1 - df["ats_home"],
        "su_win": (sgn * df["actual_margin"] > 0).astype(float),
        "ml_price": df["ml_home"] if venue == "home" else df["ml_away"],
        "ml_vig_ok": df["ml_vig_ok"],
        "team_pr": df[f"{venue}_predictive_pr"], "opp_pr": df[f"{opp}_predictive_pr"],
        "team_rest": df[f"{venue}_rest"], "opp_rest": df[f"{opp}_rest"],
        "team_last5_pr": df[f"{venue}_last5_pr"],
        "spread_move_team": (df["spread_move"] if venue == "home" else -df["spread_move"]),
        "total_move": df["total_move"], "total": df["total_points"], "over": df["over"],
        "ou_line": df["ou_vegas_line"], "div_game": df["div_game"], "is_outdoor": df["is_outdoor"],
        "wind_mph": df["wind_mph"], "temp_f": df["temp_f"], "precip": df["precipitation_pct"],
        "dome_closed": df["dome_closed"], "primetime": df["primetime"], "is_thu": df["is_thu"],
        "is_mon": df["is_mon"], "ref_total": df["ref_total_pts_avg"],
        "team_backup_qb": df[f"{venue}_backup_qb"], "opp_backup_qb": df[f"{opp}_backup_qb"],
        "spread_splits_label": df["spread_splits_label"], "total_splits_label": df["total_splits_label"],
        "home_spread_handle": df["home_spread_handle"], "home_spread_bets": df["home_spread_bets"],
        "game_date": df["game_date"],
    })
    return d


tg = pd.concat([side(m, "home"), side(m, "away")], ignore_index=True)
tg = tg.sort_values(["team", "season", "week"]).reset_index(drop=True)
g = tg.groupby(["team", "season"], group_keys=False)

# ---- prior-game (shifted) form, leak-safe ----
tg["prev_margin"] = g["margin"].shift(1)
tg["prev_cover"] = g["team_cover"].shift(1)
tg["prev_over"] = g["over"].shift(1)
tg["prev_week"] = g["week"].shift(1)
tg["next_week"] = g["week"].shift(-1)
tg["next_opp_pr"] = g["opp_pr"].shift(-1)
tg["prev_opp_pr"] = g["opp_pr"].shift(1)
tg["team_fav"] = (tg["team_spread"] < 0).astype(int)


def entering_streak(binary):
    """consecutive run of 1s ending the PRIOR game (leak-safe)."""
    s = binary.shift(1)
    grp = (s != s.shift()).cumsum()
    run = s.groupby(grp).cumcount() + 1
    return np.where(s == 1, run, 0)


tg["cover_streak"] = g["team_cover"].transform(lambda s: pd.Series(entering_streak(s), index=s.index))
tg["over_streak"] = g["over"].transform(lambda s: pd.Series(entering_streak(s), index=s.index))
tg["win_streak"] = g["su_win"].transform(lambda s: pd.Series(entering_streak(s), index=s.index))

# rolling last-3 (prior games only)
tg["l3_margin"] = g["margin"].transform(lambda s: s.shift(1).rolling(3, min_periods=2).mean())
tg["l3_pts"] = g["team_score"].transform(lambda s: s.shift(1).rolling(3, min_periods=2).mean())
tg["l3_allowed"] = g["opp_score"].transform(lambda s: s.shift(1).rolling(3, min_periods=2).mean())

# situational flags
tg["off_bye"] = ((tg["week"] - tg["prev_week"]) >= 2).fillna(False).astype(int)
tg["pre_bye"] = ((tg["next_week"] - tg["week"]) >= 2).fillna(False).astype(int)
tg["short_week"] = (tg["team_rest"] <= 4).astype(int)
tg["long_rest"] = (tg["team_rest"] >= 10).astype(int)
tg["rest_edge"] = tg["team_rest"] - tg["opp_rest"]
tg["blowout_win_last"] = (tg["prev_margin"] >= 14).fillna(False).astype(int)
tg["blowout_loss_last"] = (tg["prev_margin"] <= -14).fillna(False).astype(int)
tg["off_cover"] = (tg["prev_cover"] == 1).fillna(False).astype(int)
tg["off_noncover"] = (tg["prev_cover"] == 0).fillna(False).astype(int)
tg["home_dog"] = ((tg["is_home"] == 1) & (tg["team_spread"] > 0)).astype(int)
tg["road_dog"] = ((tg["is_home"] == 0) & (tg["team_spread"] > 0)).astype(int)
tg["road_fav"] = ((tg["is_home"] == 0) & (tg["team_spread"] < 0)).astype(int)
tg["big_dog"] = (tg["team_spread"] >= 7).astype(int)
tg["big_fav"] = (tg["team_spread"] <= -7).astype(int)
tg["pr_edge"] = tg["team_pr"] - tg["opp_pr"]
# look-ahead / let-down (strong opp next/prev week)
prq = tg["next_opp_pr"].quantile(0.75)
tg["lookahead"] = (tg["next_opp_pr"] >= prq).fillna(False).astype(int)     # tough game next week
tg["letdown"] = (tg["prev_opp_pr"] >= prq).fillna(False).astype(int)       # tough game last week
# division 2nd meeting + lost first (revenge)
tg["div_meet_n"] = tg.groupby(["season", "team", "opp"]).cumcount()        # 0 = first meeting
tg["lost_to_opp_prev"] = (tg.groupby(["season", "team", "opp"])["su_win"].shift(1) == 0).fillna(False).astype(int)
tg["div_revenge"] = ((tg["div_game"] == 1) & (tg["div_meet_n"] >= 1) & (tg["lost_to_opp_prev"] == 1)).astype(int)
# 3rd straight road/home
tg["home_run"] = g["is_home"].transform(lambda s: s.shift(1).rolling(2, min_periods=2).sum())
tg["third_road"] = ((tg["is_home"] == 0) & (tg["home_run"] == 0)).fillna(False).astype(int)
tg["third_home"] = ((tg["is_home"] == 1) & (tg["home_run"] == 2)).fillna(False).astype(int)
# RLM (2025): sharp gap on this team's side
tg["home_sharp_gap"] = tg["home_spread_handle"] - tg["home_spread_bets"]

tg.to_parquet(os.path.join(DATA, "tg.parquet"), index=False)
L(f"[saved] tg (team-game): {tg.shape}")
# validation: team_cover reproduces (cover rate ~ 0.5 overall, and equals ats consistency)
L(f"[validate] overall team ATS cover rate = {tg['team_cover'].mean():.3f} (should ~0.50)")
L(f"[validate] overall SU win rate = {tg['su_win'].mean():.3f} (=0.50 by construction over both sides)")
L(f"[validate] ML prices vig-ok: {int(tg['ml_vig_ok'].sum())} team-rows ({tg['ml_vig_ok'].mean()*100:.0f}%)")
L(f"  seasons: {sorted(tg.season.unique())}; games/season ~ {len(tg)//8//2}")
L(f"  line-movement coverage (2023-25): {tg['spread_move_team'].notna().sum()} rows")
L(f"  splits coverage (2025): {tg['spread_splits_label'].notna().sum()} rows")
print("\nengineered condition columns:")
print([c for c in tg.columns if c not in ('season','week','unique_id','team','opp','game_date')])
