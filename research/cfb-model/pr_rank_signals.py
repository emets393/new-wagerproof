"""
As-of CONFERENCE POWER-RATING RANK. For each game, rank both teams within their conference by as-of net_rating
(among teams playing that week). Used by the G5 "top-2 conference PR" fade-after-loss spot.
build(gm) -> per (season, game_id, team): pr_rank (1 = best PR in conference that week).
"""
import pandas as pd


def build(gm):
    g = gm[["season", "week", "game_id", "homeTeam", "awayTeam", "homeConference", "awayConference",
            "home_net_rating", "away_net_rating"]]
    rows = []
    for _, r in g.iterrows():
        rows.append({"season": r.season, "week": r.week, "game_id": r.game_id, "team": r.homeTeam,
                     "conf": r.homeConference, "net": r.home_net_rating})
        rows.append({"season": r.season, "week": r.week, "game_id": r.game_id, "team": r.awayTeam,
                     "conf": r.awayConference, "net": r.away_net_rating})
    p = pd.DataFrame(rows).dropna(subset=["net"])
    p["pr_rank"] = p.groupby(["season", "week", "conf"]).net.rank(ascending=False, method="min")
    return p[["season", "game_id", "team", "pr_rank"]]
