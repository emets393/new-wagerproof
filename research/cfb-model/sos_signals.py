"""
As-of STRENGTH OF SCHEDULE module. Each model_games row carries both teams' as-of net_rating, so a team's SOS
= average opponent net_rating over PRIOR games (leak-free). Used by the padded-road-team fade spot.
build(gm) -> per (season, game_id, team): sos (prior-games avg opp net_rating) + sos_np (# prior games).
"""
import numpy as np
import pandas as pd


def build(gm):
    g = gm[["season", "week", "game_id", "homeTeam", "awayTeam", "home_net_rating", "away_net_rating"]].dropna(
        subset=["home_net_rating", "away_net_rating"])
    rows = []
    for _, r in g.iterrows():
        rows.append({"season": r.season, "week": r.week, "game_id": r.game_id, "team": r.homeTeam, "opp_net": r.away_net_rating})
        rows.append({"season": r.season, "week": r.week, "game_id": r.game_id, "team": r.awayTeam, "opp_net": r.home_net_rating})
    L = pd.DataFrame(rows).sort_values(["team", "season", "week"])
    gb = L.groupby(["team", "season"], group_keys=False)
    L["sos"] = gb["opp_net"].apply(lambda s: s.shift().expanding().mean())
    L["sos_np"] = gb.cumcount()
    return L[["season", "game_id", "team", "sos", "sos_np"]]
