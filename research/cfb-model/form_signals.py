"""
WALK-FORWARD TEAM FORM signals (as-of, season-to-date). Currently: each team's running OVER rate from prior
games THIS season (leak-safe: shift excludes the current game). Used by the over-hot-fade-under totals spot
(team_form.py: over-hot teams REGRESS -> game goes under, strongest when the total isn't inflated <=58).

build(gm) -> per (season, game_id, team): over_rate (prior games this season) + form_gp (# prior games).
For live production the in-season completed games must have actual_total populated in model_games (same as
all other as-of features); unplayed target games still get a rate computed from their prior weeks.
"""
import numpy as np
import pandas as pd


def build(gm):
    # long per-team-game; over result only where the game has been played (actual_total present, non-push)
    g = gm[["season", "week", "game_id", "homeTeam", "awayTeam", "total_close", "actual_total"]].copy()
    rows = []
    for _, r in g.iterrows():
        if pd.notna(r.actual_total) and pd.notna(r.total_close) and r.actual_total != r.total_close:
            over = float(r.actual_total > r.total_close)
        else:
            over = np.nan
        rows.append({"season": r.season, "week": r.week, "game_id": r.game_id, "team": r.homeTeam, "over": over})
        rows.append({"season": r.season, "week": r.week, "game_id": r.game_id, "team": r.awayTeam, "over": over})
    L = pd.DataFrame(rows).sort_values(["team", "season", "week"])
    gb = L.groupby(["team", "season"], group_keys=False)
    # prior games only (shift): cumulative overs / cumulative graded games
    L["cum_over"] = gb["over"].apply(lambda s: s.shift().expanding().sum())
    L["form_gp"] = gb["over"].apply(lambda s: s.shift().expanding().count())
    L["over_rate"] = L.cum_over / L.form_gp
    return L[["season", "game_id", "team", "form_gp", "over_rate"]]
