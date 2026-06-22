"""Context frame for 1H/TT situational mining.

Adds POINT-IN-TIME features to h1tt_frame (only games strictly before the
current one feed each feature):
  per side (home/away):
    l3_pf, l3_pa          last-3 points for/against, within season
    std_pf                season-to-date ppg
    streak                signed current W/L streak entering the game
    last_mtg_won          won most recent meeting vs this opponent (back to 2020)
    last_mtg_margin       margin in that meeting (from this team's view)
    h1_cov_rate, h1_n     season-to-date 1H ATS cover rate (vs 1H close)
    h1_win_rate           season-to-date 1H ML win rate (ties excluded)
    h1_pf_avg             season-to-date 1H points for per game
    coach, qb, rest
  game: slot, outdoor, windy (frame already has div_game, roof, temp, wind)

Output: data/h1tt_context.parquet (one row per game, 855 rows)
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GK = ["season", "gameday", "home_ab", "away_ab"]


def team_log(games):
    """Long per-team-game log from schedules, with results, ordered by date."""
    base = games[["game_id", "season", "week", "gameday", "home_team", "away_team",
                  "home_score", "away_score"]].dropna(subset=["home_score"])
    h = base.rename(columns={"home_team": "team", "away_team": "opp",
                             "home_score": "pf", "away_score": "pa"})
    a = base.rename(columns={"away_team": "team", "home_team": "opp",
                             "away_score": "pf", "home_score": "pa"})
    log = pd.concat([h, a], ignore_index=True)
    log["won"] = log.pf > log.pa
    log["lost"] = log.pf < log.pa
    return log.sort_values(["team", "gameday"]).reset_index(drop=True)


def form_features(log):
    """Within-season L3 / season-to-date, shifted so current game excluded."""
    g = log.groupby(["team", "season"], group_keys=False)
    log["l3_pf"] = g.pf.apply(lambda x: x.shift(1).rolling(3, min_periods=3).mean())
    log["l3_pa"] = g.pa.apply(lambda x: x.shift(1).rolling(3, min_periods=3).mean())
    log["std_pf"] = g.pf.apply(lambda x: x.shift(1).expanding(min_periods=3).mean())
    # signed streak entering game: +n = won last n, -n = lost last n
    def streak(s):
        out, run = [], 0
        for w in s:
            out.append(run)
            if pd.isna(w):
                run = 0
            elif w:
                run = run + 1 if run > 0 else 1
            else:
                run = run - 1 if run < 0 else -1
        return pd.Series(out, index=s.index)
    log["streak"] = g.apply(lambda x: streak(x.won.where(x.pf != x.pa)),
                            include_groups=False) \
        if pd.__version__ >= "2.2" else g.apply(lambda x: streak(x.won.where(x.pf != x.pa)))
    return log


def last_meeting(log):
    """Most recent prior meeting vs same opponent (any season)."""
    log = log.sort_values(["team", "opp", "gameday"])
    g = log.groupby(["team", "opp"], group_keys=False)
    log["last_mtg_won"] = g.won.shift(1).where(g.pf.shift(1) != g.pa.shift(1))
    log["last_mtg_margin"] = (g.pf.shift(1) - g.pa.shift(1))
    log["last_mtg_gameday"] = g.gameday.shift(1)
    return log


def h1_history(frame):
    """Per-team season-to-date 1H ATS / ML / scoring, point-in-time."""
    f = frame.sort_values("gameday")
    f["h1_margin"] = f.h1_home - f.h1_away
    rows = []
    hist = {}   # (team, season) -> list of dicts
    for _, r in f.iterrows():
        sp = r.h1_spread_close_h1_spread_home
        for team, opp, is_home in ((r.home_ab, r.away_ab, True),
                                   (r.away_ab, r.home_ab, False)):
            key = (team, r.season)
            past = hist.get(key, [])
            covs = [p["cov"] for p in past if p["cov"] is not None]
            wins = [p["win"] for p in past if p["win"] is not None]
            h1pf = [p["h1_pf"] for p in past]
            rows.append(dict(season=r.season, gameday=r.gameday,
                             home_ab=r.home_ab, away_ab=r.away_ab, team=team,
                             h1_cov_rate=np.mean(covs) if len(covs) >= 4 else np.nan,
                             h1_win_rate=np.mean(wins) if len(wins) >= 4 else np.nan,
                             h1_pf_avg=np.mean(h1pf) if len(h1pf) >= 4 else np.nan,
                             h1_n=len(past)))
        # append result AFTER computing features
        m = r.h1_margin
        for team, is_home in ((r.home_ab, True), (r.away_ab, False)):
            tm = m if is_home else -m
            tsp = sp if is_home else -sp
            cov = None if (pd.isna(tsp) or tm + tsp == 0) else bool(tm + tsp > 0)
            win = None if tm == 0 else bool(tm > 0)
            h1_pf = r.h1_home if is_home else r.h1_away
            hist.setdefault((team, r.season), []).append(
                dict(cov=cov, win=win, h1_pf=h1_pf))
    return pd.DataFrame(rows)


def main():
    frame = pd.read_parquet(ROOT / "data" / "h1tt_frame.parquet")
    games = pd.read_parquet(ROOT / "data" / "nflverse_games.parquet")
    games["gameday"] = pd.to_datetime(games.gameday).dt.strftime("%Y-%m-%d")
    games = games[games.season >= 2020]

    log = team_log(games)
    log = form_features(log)
    log = last_meeting(log)
    feat_cols = ["l3_pf", "l3_pa", "std_pf", "streak",
                 "last_mtg_won", "last_mtg_margin"]
    lf = log[["game_id", "team"] + feat_cols]

    out = frame.copy()
    for side in ("home", "away"):
        m = out[["game_id", f"{side}_ab"]].merge(
            lf, left_on=["game_id", f"{side}_ab"], right_on=["game_id", "team"],
            how="left")
        for c in feat_cols:
            out[f"{side[0]}_{c}"] = m[c].values
        sched = games[["game_id", f"{side}_coach", f"{side}_qb_name", f"{side}_rest"]]
        out = out.merge(sched, on="game_id", how="left")

    h1h = h1_history(frame)
    for side in ("home", "away"):
        sidefeat = h1h[h1h.team == h1h[f"{side}_ab"]]
        m = out[GK].merge(sidefeat, on=GK, how="left")
        for c in ("h1_cov_rate", "h1_win_rate", "h1_pf_avg", "h1_n"):
            out[f"{side[0]}_{c}"] = m[c].values

    hr = pd.to_datetime(out.gametime, format="%H:%M", errors="coerce").dt.hour
    out["slot"] = np.select(
        [out.weekday.isin(["Thursday", "Friday"]), out.weekday == "Monday",
         (out.weekday == "Sunday") & (hr >= 19),
         (out.weekday == "Sunday") & (hr < 16)],
        ["thu_fri", "monday", "snf", "sun_early"], default="sun_late_sat")
    out["outdoor"] = out.roof.isin(["outdoors", "open"])
    out["windy"] = out.outdoor & (pd.to_numeric(out.wind, errors="coerce") >= 12)

    out.to_parquet(ROOT / "data" / "h1tt_context.parquet", index=False)
    print(f"rows: {len(out)}")
    chk = ["h_l3_pf", "h_streak", "h_last_mtg_won", "h_h1_cov_rate",
           "home_coach", "a_l3_pf", "a_h1_cov_rate"]
    print("non-null:", {c: int(out[c].notna().sum()) for c in chk})
    print("\nsanity: home l3_pf mean", round(out.h_l3_pf.mean(), 1),
          "| away", round(out.a_l3_pf.mean(), 1),
          "| h1_cov_rate mean", round(out.h_h1_cov_rate.mean(), 3))
    print("streak dist (home):")
    print(out.h_streak.value_counts().sort_index().to_string())


if __name__ == "__main__":
    main()
