"""
Build the per-game modeling table with COMPREHENSIVE situational features.

Universe: FBS-vs-FBS regular-season completed games, all seasons, with a betting line.
Leak-safety:
  - team ratings joined as-of (week-1)  [strictly before kickoff]
  - opponent (last/next) ratings as-of current (week-1)  [known at kickoff]
  - ELO/rankings entering the current week  [pregame]
  - last-game OUTCOMES are past (known); next-game uses only OPPONENT identity/strength,
    never its result.

Situational features (per team, then framed home/away) cover the spots the user wants:
  rest/bye/short-week, win streak, blowout bounce/letdown, last-opp strength + ranked
  (big-game hangover), next-opp strength + ranked (look-ahead/trap), totals form, travel,
  dome/elevation, neutral, conference, ranked self/opp.

Output: data/model_games.parquet
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]


# ---------- helpers ----------
def haversine(lat1, lon1, lat2, lon2):
    r = 3959.0  # miles
    p = np.pi / 180
    a = (np.sin((lat2 - lat1) * p / 2) ** 2
         + np.cos(lat1 * p) * np.cos(lat2 * p) * np.sin((lon2 - lon1) * p / 2) ** 2)
    return 2 * r * np.arcsin(np.sqrt(a))


def load_games():
    frames = []
    for y in YEARS:
        g = pd.read_parquet(os.path.join(DATA, f"games_{y}.parquet"))
        g = g[(g["seasonType"] == "regular")
              & (g["homeClassification"] == "fbs")
              & (g["awayClassification"] == "fbs")
              & g["homePoints"].notna() & g["awayPoints"].notna()].copy()
        g["season"] = y
        frames.append(g)
    g = pd.concat(frames, ignore_index=True)
    g["date"] = pd.to_datetime(g["startDate"], utc=True, errors="coerce")
    return g


def consensus_lines():
    """Robust consensus that corrects mis-oriented spreads (CFBD has ~1-4% sign-flipped rows,
    esp. Bovada). Fix: (1) ML-anchor each row — flip spread if its sign disagrees with the
    moneyline favorite; (2) per-game majority-sign vote; (3) orient OPEN to match CLOSE."""
    frames = []
    for y in YEARS:
        l = pd.read_parquet(os.path.join(DATA, f"lines_{y}.parquet"))
        for c in ["spread", "spreadOpen", "overUnder", "overUnderOpen", "homeMoneyline", "awayMoneyline"]:
            if c in l.columns:
                l[c] = pd.to_numeric(l[c], errors="coerce")
        # (1) ML-anchor: home favored by ML = homeMoneyline < awayMoneyline; spread should be <0
        ml_ok = l["homeMoneyline"].notna() & l["awayMoneyline"].notna() & (l["spread"].abs() >= 2)
        flip = ml_ok & ((l["spread"] < 0) != (l["homeMoneyline"] < l["awayMoneyline"]))
        l.loc[flip, ["spread", "spreadOpen"]] *= -1
        # (2) per-game majority sign (from all corrected rows), flip stragglers
        gsign = l.groupby("id")["spread"].transform(lambda s: np.sign(s[s.abs() >= 2].median()) if (s.abs() >= 2).any() else np.nan)
        strag = gsign.notna() & (l["spread"].abs() >= 2) & (np.sign(l["spread"]) != gsign)
        l.loc[strag, ["spread", "spreadOpen"]] *= -1
        agg = l.groupby("id").agg(
            spread_close=("spread", "median"), spread_open=("spreadOpen", "median"),
            total_close=("overUnder", "median"), total_open=("overUnderOpen", "median")).reset_index()
        # (3) orient OPEN to match the (clean) CLOSE sign
        bad_open = (agg["spread_open"].abs() >= 2) & (agg["spread_close"].abs() >= 2) & \
                   (np.sign(agg["spread_open"]) != np.sign(agg["spread_close"]))
        agg.loc[bad_open, "spread_open"] *= -1
        frames.append(agg)
    return pd.concat(frames, ignore_index=True)


def stadium_coords():
    s = pd.read_parquet(os.path.join(HERE, "data", "cfb_stadium_info.parquet"))
    s = s.rename(columns={"Id": "venueId", "Latitude": "lat", "Longitude": "lon",
                          "Dome": "dome", "Elevation": "elev"})
    return s[["venueId", "lat", "lon", "dome", "elev"]]


# ---------- team-game long + situational ----------
def build_team_games(g):
    """One row per team per game with outcomes, chronological per team-season."""
    def side(g, who):
        opp = "away" if who == "home" else "home"
        d = pd.DataFrame({
            "season": g["season"], "week": g["week"], "game_id": g["id"], "date": g["date"],
            "team": g[f"{who}Team"], "opponent": g[f"{opp}Team"],
            "is_home": 1 if who == "home" else 0,
            "neutral": g["neutralSite"].astype(int), "conf_game": g["conferenceGame"].astype(int),
            "venueId": g["venueId"],
            "pts_for": g[f"{who}Points"], "pts_against": g[f"{opp}Points"],
        })
        d["margin"] = d["pts_for"] - d["pts_against"]
        d["win"] = (d["margin"] > 0).astype(int)
        d["total"] = d["pts_for"] + d["pts_against"]
        return d
    tg = pd.concat([side(g, "home"), side(g, "away")], ignore_index=True)
    tg = tg.sort_values(["team", "season", "date"]).reset_index(drop=True)
    gb = tg.groupby(["team", "season"], group_keys=False)

    # rest / scheduling
    tg["prev_date"] = gb["date"].shift(1)
    tg["days_rest"] = (tg["date"] - tg["prev_date"]).dt.days
    tg["off_bye"] = (tg["days_rest"] >= 13).astype("Int64")
    tg["short_week"] = (tg["days_rest"] <= 5).astype("Int64")

    # last-game outcomes (past, known)
    for c in ["margin", "win", "pts_for", "pts_against", "total", "opponent"]:
        tg[f"last_{c}"] = gb[c].shift(1)
    tg["last_blowout_win"] = ((tg["last_margin"] >= 21)).astype("Int64")
    tg["last_blowout_loss"] = ((tg["last_margin"] <= -21)).astype("Int64")
    tg["last_was_over"] = np.nan  # filled after line join (needs last game's total line); placeholder

    # signed win streak entering the game
    def streak(s):
        out, run = [], 0
        for w in s:
            out.append(run)
            if pd.isna(w):
                run = 0
            elif w == 1:
                run = run + 1 if run >= 0 else 1
            else:
                run = run - 1 if run <= 0 else -1
        return out
    tg["win_streak"] = gb["win"].transform(lambda s: streak(s.tolist()))

    # consecutive home/away entering the game
    def consec(s):
        out, run, prev = [], 0, None
        for v in s:
            if prev is None or v != prev:
                run = 1
            else:
                run += 1
            out.append(run)
            prev = v
        # shift by one: streak entering this game = prior streak
        return [0] + out[:-1]
    tg["consec_home"] = gb["is_home"].transform(lambda s: consec(s.tolist())) * tg["is_home"]
    tg["consec_away"] = gb["is_home"].transform(lambda s: consec(s.tolist())) * (1 - tg["is_home"])

    # next opponent (look-ahead) — identity only, NOT result
    tg["next_opponent"] = gb["opponent"].shift(-1)

    # first conference game of the season (per team) — a "stakes ramp up" spot
    tg["_conf_cum"] = gb["conf_game"].cumsum()
    tg["first_conf_game"] = ((tg["conf_game"] == 1) & (tg["_conf_cum"] == 1)).astype("Int64")
    tg = tg.drop(columns="_conf_cum")
    return tg


def main():
    g = load_games()
    print(f"FBS-vs-FBS regular games: {len(g)}")

    tg = build_team_games(g)

    # ---- ratings / elo / talent / rankings lookups ----
    rat = pd.read_parquet(os.path.join(HERE, "data", "team_ratings_asof.parquet"))
    rat["net_rating"] = rat["adj_epa"] - rat["adj_epa_allowed"]
    elo = pd.read_parquet(os.path.join(DATA, "elo_weekly.parquet")).rename(columns={"year": "season"})
    tal = pd.read_parquet(os.path.join(DATA, "talent.parquet")).rename(columns={"year": "season"})
    rk = pd.read_parquet(os.path.join(DATA, "rankings_weekly.parquet")).rename(columns={"year": "season"})
    rk_ap = (rk[rk["poll"] == "AP Top 25"][["season", "asof_week", "team", "rank"]]
             .sort_values("rank").drop_duplicates(["season", "asof_week", "team"], keep="first"))

    # as-of (week-1) merge keys
    tg["asof"] = tg["week"] - 1

    def merge_asof_ratings(tg, team_col, prefix):
        m = rat[["season", "asof_week", "team"] + [c for c in rat.columns if c.startswith("adj_")] + ["net_rating", "games_played"]]
        m = m.rename(columns={c: f"{prefix}{c}" for c in m.columns if c not in ("season", "asof_week", "team")})
        out = tg.merge(m, left_on=["season", "asof", team_col], right_on=["season", "asof_week", "team"],
                       how="left", suffixes=("", "_r")).drop(columns=["asof_week", "team_r"], errors="ignore")
        return out

    # self ratings as-of week-1
    tg = tg.merge(
        rat[["season", "asof_week", "team", "net_rating", "games_played"]
            + [c for c in rat.columns if c.startswith("adj_")]],
        left_on=["season", "asof", "team"], right_on=["season", "asof_week", "team"], how="left"
    ).drop(columns=["asof_week"])

    # opponent strength: last + next opponent net_rating as-of current (week-1) [known now]
    net_lk = rat[["season", "asof_week", "team", "net_rating"]].rename(
        columns={"team": "opp", "net_rating": "opp_net", "asof_week": "asof"})
    tg = tg.merge(net_lk.rename(columns={"opp": "last_opponent", "opp_net": "last_opp_net"}),
                  on=["season", "asof", "last_opponent"], how="left")
    tg = tg.merge(net_lk.rename(columns={"opp": "next_opponent", "opp_net": "next_opp_net"}),
                  on=["season", "asof", "next_opponent"], how="left")
    tg = tg.merge(net_lk.rename(columns={"opp": "opponent", "opp_net": "cur_opp_net"}),
                  on=["season", "asof", "opponent"], how="left")

    # ELO entering current week = ELO as of the PRIOR week (CFBD weekly elo is POST-game,
    # so elo at asof_week=W already reflects week-W results -> use asof=W-1 to stay leak-safe).
    tg = tg.merge(elo[["season", "asof_week", "team", "elo"]].rename(columns={"asof_week": "asof"}),
                  on=["season", "asof", "team"], how="left")
    tg = tg.merge(tal[["season", "team", "talent"]], on=["season", "team"], how="left")

    # season-to-date havoc / PPO / pace / field position, as-of (week-1)  [raw, leak-safe]
    sa_path = os.path.join(HERE, "data", "season_advanced_asof.parquet")
    SA_COLS = []
    if os.path.exists(sa_path):
        sa = pd.read_parquet(sa_path)
        sa_feats = [c for c in sa.columns if c not in ("season", "asof_week", "team")]
        sa = sa.rename(columns={"asof_week": "asof"})
        tg = tg.merge(sa, on=["season", "asof", "team"], how="left")
        SA_COLS = sa_feats  # off_plays/drives/ppo/start/havoc(_f7/_db) + def_*
        # pace proxy: total expected plays = own off plays + opp def plays (raw season pace)
        tg["pace_off_plays"] = tg["off_plays"]
        tg["pace_off_drives"] = tg["off_drives"]
        SA_COLS += ["pace_off_plays", "pace_off_drives"]

    # preseason priors (returning production / recruiting / prior-year SP+/FPI) tested via build_priors.py
    # but EXCLUDED from the model: they improve raw prediction trivially yet HURT the betting edge —
    # the market already prices them, so including them makes us agree with the (biased) line and
    # shrinks exploitable divergence (sides P5 away edge 58.6%->55.6%). Lean model = the betting edge.
    PRIOR_COLS = []

    # box-score tendencies (pass-heaviness / tempo / pressure), as-of (week-1)
    td_path = os.path.join(HERE, "data", "tendencies_asof.parquet")
    TEND_COLS = []
    if os.path.exists(td_path):
        td = pd.read_parquet(td_path)
        TEND_COLS = [c for c in td.columns if c not in ("season", "asof_week", "team")]
        td = td.rename(columns={"asof_week": "asof"})
        tg = tg.merge(td, on=["season", "asof", "team"], how="left")

    # ranked flags (AP) entering current week — self, last opp, next opp
    def ranked_flag(tg, team_col, name):
        r = rk_ap.rename(columns={"asof_week": "week", "team": team_col, "rank": name})
        tg = tg.merge(r, on=["season", "week", team_col], how="left")
        tg[f"{name}_is"] = tg[name].notna().astype(int)
        return tg
    tg = ranked_flag(tg, "team", "self_rank")
    tg = ranked_flag(tg, "last_opponent", "last_opp_rank")
    tg = ranked_flag(tg, "next_opponent", "next_opp_rank")

    # travel: team modal home venue -> distance to game venue
    sc = stadium_coords()
    tg = tg.merge(sc.rename(columns={"lat": "v_lat", "lon": "v_lon", "dome": "dome", "elev": "elev"}),
                  on="venueId", how="left")
    home_venue = (tg[tg["is_home"] == 1].groupby(["season", "team"])["venueId"]
                  .agg(lambda s: s.mode().iloc[0] if len(s.mode()) else np.nan).reset_index()
                  .rename(columns={"venueId": "home_venueId"}))
    tg = tg.merge(home_venue, on=["season", "team"], how="left")
    tg = tg.merge(sc.rename(columns={"venueId": "home_venueId", "lat": "h_lat", "lon": "h_lon"})[
        ["home_venueId", "h_lat", "h_lon"]], on="home_venueId", how="left")
    tg["travel_miles"] = haversine(tg["h_lat"], tg["h_lon"], tg["v_lat"], tg["v_lon"]).fillna(0)

    # ---- frame back to game rows (home_/away_) ----
    feat_cols = ["net_rating", "games_played", "elo", "talent", "days_rest", "off_bye",
                 "short_week", "win_streak", "consec_home", "consec_away",
                 "last_margin", "last_win", "last_pts_for", "last_pts_against", "last_total",
                 "last_blowout_win", "last_blowout_loss", "last_opp_net", "last_opp_rank_is",
                 "next_opp_net", "next_opp_rank_is", "cur_opp_net", "self_rank_is", "self_rank",
                 "travel_miles", "elev", "first_conf_game"] + SA_COLS + TEND_COLS + PRIOR_COLS + [c for c in tg.columns if c.startswith("adj_")]
    feat_cols = [c for c in dict.fromkeys(feat_cols) if c in tg.columns]

    base = tg[["game_id", "is_home"] + feat_cols]
    home = base[base["is_home"] == 1].drop(columns="is_home").add_prefix("home_").rename(columns={"home_game_id": "game_id"})
    away = base[base["is_home"] == 0].drop(columns="is_home").add_prefix("away_").rename(columns={"away_game_id": "game_id"})

    gm = g[["id", "season", "week", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
            "neutralSite", "conferenceGame", "homePoints", "awayPoints", "venueId"]].rename(columns={"id": "game_id"})
    gm = gm.merge(home, on="game_id", how="left").merge(away, on="game_id", how="left")
    gm = gm.merge(consensus_lines().rename(columns={"id": "game_id"}), on="game_id", how="left")

    # weather (game-level) — wind/precip/cold push UNDER; indoors/dome push OVER
    wx_frames = []
    for y in YEARS:
        wp = os.path.join(DATA, f"weather_{y}.parquet")
        if os.path.exists(wp):
            w = pd.read_parquet(wp)
            keep = {"id": "game_id", "temperature": "wx_temp", "windSpeed": "wx_wind",
                    "precipitation": "wx_precip", "snowfall": "wx_snow", "humidity": "wx_humidity",
                    "gameIndoors": "wx_indoors"}
            w = w[[c for c in keep if c in w.columns]].rename(columns=keep)
            wx_frames.append(w)
    if wx_frames:
        wx = pd.concat(wx_frames, ignore_index=True).drop_duplicates("game_id")
        gm = gm.merge(wx, on="game_id", how="left")
        gm["wx_indoors"] = gm["wx_indoors"].astype("boolean").astype("Int64")
        gm["wx_high_wind"] = (pd.to_numeric(gm["wx_wind"], errors="coerce") >= 15).astype("Int64")
        gm["wx_cold"] = (pd.to_numeric(gm["wx_temp"], errors="coerce") <= 35).astype("Int64")
        gm["wx_wet"] = (pd.to_numeric(gm["wx_precip"], errors="coerce") > 0).astype("Int64")

    # labels + diffs
    # kickoff timing — night/primetime (ET approx; CFB season mostly EDT -4)
    kt = pd.to_datetime(gm["date"], utc=True, errors="coerce") - pd.Timedelta(hours=4)
    gm["kick_hour_et"] = kt.dt.hour
    gm["night_game"] = (gm["kick_hour_et"] >= 19).astype("Int64")
    gm["primetime"] = ((gm["kick_hour_et"] >= 19) & (gm["date"].dt.dayofweek == 5)).astype("Int64")  # Sat night
    gm["either_first_conf"] = ((gm["home_first_conf_game"].fillna(0) + gm["away_first_conf_game"].fillna(0)) >= 1).astype("Int64")

    gm["actual_total"] = gm["homePoints"] + gm["awayPoints"]
    gm["actual_margin"] = gm["homePoints"] - gm["awayPoints"]  # >0 home win
    gm["net_rating_diff"] = gm["home_net_rating"] - gm["away_net_rating"]
    gm["elo_diff"] = gm["home_elo"] - gm["away_elo"]
    gm["talent_diff"] = gm["home_talent"] - gm["away_talent"]
    gm["sum_off_epa"] = gm[["home_adj_epa", "away_adj_epa", "home_adj_epa_allowed", "away_adj_epa_allowed"]].sum(axis=1)
    # scoring-environment / pace combos (over-side hypotheses)
    for a, b, name in [("home_pace_off_plays", "away_pace_off_plays", "expected_plays"),
                       ("home_off_ppo", "away_off_ppo", "sum_off_ppo"),
                       ("home_off_drives", "away_off_drives", "sum_drives"),
                       ("home_off_havoc", "away_off_havoc", "sum_off_havoc")]:
        if a in gm.columns and b in gm.columns:
            gm[name] = pd.to_numeric(gm[a], errors="coerce") + pd.to_numeric(gm[b], errors="coerce")
    # look-ahead / letdown interaction flags (situational spots)
    gm["home_lookahead"] = ((gm["away_net_rating"] < gm["home_next_opp_net"])).astype("Int64")  # next opp stronger than current
    gm["home_letdown"] = gm["home_last_opp_rank_is"].fillna(0).astype(int)  # came off ranked opp
    gm["ranked_matchup"] = ((gm["home_self_rank_is"].fillna(0) + gm["away_self_rank_is"].fillna(0)) >= 2).astype(int)

    out = os.path.join(HERE, "data", "model_games.parquet")
    gm.to_parquet(out, index=False)
    has_line = gm["total_open"].notna() | gm["total_close"].notna()
    print(f"model_games: {len(gm)} games ({has_line.sum()} with a total line) -> {out}")
    print(f"  cols: {gm.shape[1]}  | seasons: {sorted(gm['season'].unique())}")
    print(f"  ratings present (home_net_rating notna): {gm['home_net_rating'].notna().sum()}")


if __name__ == "__main__":
    main()
