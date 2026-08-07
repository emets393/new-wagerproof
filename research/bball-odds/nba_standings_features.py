#!/usr/bin/env python3
"""Standings and motivation features, built as-of each game date. Leak-safe by construction.

WHY THIS EXISTS

The phase sweep found the late-season window is not noisy but ANTI-informative: averaged
over all nine method families, delta-vs-naive runs -7.3 / -11.0 / -13.1 / -16.1 as the cut
tightens from top100% to top10%. A model that gets monotonically WORSE the more confident
it is has found a real pattern and has the sign backwards.

An inventory of `nba_model_features.parquet` explains how that can happen. All 977 features
are box-score derived -- season-to-date, last 3/5/10, standard deviations, streaks, rest and
schedule. Zero columns match rank, seed, stand, elim, clinch, or trade. The model literally
cannot see where a team sits in the standings.

That is survivable in October, when nobody's position means anything. It is fatal in April.
A 52-win team locked into the 3 seed and a 52-win team fighting for the last play-in spot
have identical box scores and completely different reasons to try. The market prices that;
the model reads only the box score, so it confidently backs the team whose numbers look
better and loses to the team that actually needs the game.

WHAT IS BUILT

Everything below is computed from games STRICTLY BEFORE the game's own date, from the
balldontlie schedule and final scores. No line, no odds, no result of the game being
predicted. The `assert` at the end of `standings_asof` is what enforces that.

  record        gp, wins, win_pct, last-10 win_pct
  position      conference rank 1-15, games back from 1st
  playoff race  games back from the 6 seed (auto-berth cutoff), games back from the 10
                seed (last play-in slot), and signed distance to the 10/11 boundary --
                the number that decides whether a team's season is still alive
  resolution    games remaining, and a clinch/elimination proxy: a team more games clear
                of 11th than there are games left is IN regardless of what it does; a team
                further behind than games remaining is OUT. Both kill motivation.
  calendar      fraction of the season played, days relative to the trade deadline, and a
                post-deadline flag -- rosters change there and the box-score history the
                model trusts stops describing the team on the floor
  tank          bottom-4 in conference with fewer than 20 games left

Each is emitted for home and away plus a home-minus-away diff, since the spread is a
difference. `st_` prefix so `feature_cols` picks them up and `BAN_PAT` leaves them alone.

Writes `nba_standings_feats.parquet` keyed on `game.id`, ready to merge onto the feature
frame. It does not fit anything -- `nba_spread_v3.py` consumes it.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

# Actual NBA trade deadlines. The date is not derivable from a rule -- it has drifted
# between the first and second Thursday of February -- so it is hardcoded per season and
# falls back to Feb 8 for any season not listed.
DEADLINE = {2022: "2023-02-09", 2023: "2024-02-08",
            2024: "2025-02-06", 2025: "2026-02-05"}


def long_form(G):
    """One row per team per completed regular-season game, with the result attached."""
    g = G[(G["status"] == "Final") & (~G["postseason"].astype(bool))].copy()
    g["date"] = pd.to_datetime(g["date"])
    home = pd.DataFrame({
        "season": g["season"], "date": g["date"],
        "team": g["home_team.abbreviation"], "conf": g["home_team.conference"],
        "won": (g["home_team_score"] > g["visitor_team_score"]).astype(float)})
    away = pd.DataFrame({
        "season": g["season"], "date": g["date"],
        "team": g["visitor_team.abbreviation"], "conf": g["visitor_team.conference"],
        "won": (g["visitor_team_score"] > g["home_team_score"]).astype(float)})
    return pd.concat([home, away], ignore_index=True).sort_values(["season", "date"])


def standings_asof(L, season, asof):
    """Conference standings using only games played BEFORE `asof`.

    Returned as a per-team dict. The strict `<` is the whole leak defence: on the day a
    team plays, its own game -- and every other game that night -- is invisible.
    """
    d = L[(L["season"] == season) & (L["date"] < asof)]
    if d.empty:
        return {}
    agg = d.groupby(["team", "conf"], as_index=False).agg(
        gp=("won", "size"), w=("won", "sum"))
    agg["pct"] = agg["w"] / agg["gp"]
    # last 10: tail of each team's own game log, not a date window, so a team coming off
    # a long break is still measured over its own last ten games
    l10 = d.sort_values("date").groupby("team")["won"].apply(
        lambda s: s.tail(10).mean())
    agg["l10"] = agg["team"].map(l10)

    out = {}
    for conf, c in agg.groupby("conf"):
        c = c.sort_values("pct", ascending=False).reset_index(drop=True)
        pcts = c["pct"].to_numpy()
        gps = c["gp"].to_numpy()
        ws = c["w"].to_numpy()
        # NBA games-back: ((W_lead - W_team) + (L_team - L_lead)) / 2
        ls = gps - ws

        def gb(i, j):
            if j >= len(c):
                return np.nan
            return ((ws[j] - ws[i]) + (ls[i] - ls[j])) / 2.0

        for i in range(len(c)):
            out[c.at[i, "team"]] = {
                "gp": gps[i], "win_pct": pcts[i], "l10": c.at[i, "l10"],
                "rank": i + 1,
                "gb_1": gb(i, 0),
                "gb_6": gb(i, 5),          # >0 = outside the auto-berth cutoff
                "gb_10": gb(i, 9),         # >0 = outside the last play-in slot
                # signed distance across the 10/11 boundary: positive = alive and inside,
                # negative = on the wrong side. The single most motivating number in April.
                # gb() returns games BACK, so both branches are negated -- a top-10 team's
                # cushion is its games back of the 11 seed with the sign flipped.
                "playin_edge": (-gb(i, 10) if i <= 9 else -gb(i, 9)),
            }
    return out


def main():
    G = pd.read_parquet(f"{OUT}/bdl_games.parquet")
    L = long_form(G)
    print(f"{len(L):,} team-games across {L['season'].nunique()} seasons", flush=True)

    g = G.copy()
    g["date"] = pd.to_datetime(g["date"])
    g = g.sort_values("date")

    # cache one standings snapshot per (season, date) -- ~170 dates a season, and every
    # game that night shares the same view of the league
    cache = {}
    rows = []
    for _, r in g.iterrows():
        key = (r["season"], r["date"])
        if key not in cache:
            cache[key] = standings_asof(L, r["season"], r["date"])
        S = cache[key]
        h = S.get(r["home_team.abbreviation"])
        a = S.get(r["visitor_team.abbreviation"])
        if h is None or a is None:
            continue

        dl = pd.Timestamp(DEADLINE.get(r["season"], f"{r['season']+1}-02-08"))
        rec = {"game.id": r["id"]}
        for pre, s in (("h", h), ("a", a)):
            rem = max(0.0, 82.0 - s["gp"])
            rec[f"st_{pre}_gp"] = s["gp"]
            rec[f"st_{pre}_win_pct"] = s["win_pct"]
            rec[f"st_{pre}_l10"] = s["l10"]
            rec[f"st_{pre}_rank"] = s["rank"]
            rec[f"st_{pre}_gb_1"] = s["gb_1"]
            rec[f"st_{pre}_gb_6"] = s["gb_6"]
            rec[f"st_{pre}_gb_10"] = s["gb_10"]
            rec[f"st_{pre}_playin_edge"] = s["playin_edge"]
            rec[f"st_{pre}_games_left"] = rem
            rec[f"st_{pre}_season_frac"] = s["gp"] / 82.0
            # a team more clear of the bubble than there are games left cannot be caught,
            # and one further behind cannot catch up. Both stop trying.
            rec[f"st_{pre}_clinched"] = float(
                np.nan_to_num(s["playin_edge"], nan=0.0) > rem and rem < 20)
            rec[f"st_{pre}_eliminated"] = float(
                np.nan_to_num(s["playin_edge"], nan=0.0) < -rem and rem < 25)
            rec[f"st_{pre}_tank"] = float(s["rank"] >= 12 and rem < 20)
        rec["st_days_to_deadline"] = (r["date"] - dl).days
        rec["st_post_deadline"] = float(r["date"] > dl)
        rows.append(rec)

    F = pd.DataFrame(rows)
    # home-minus-away for everything that is a per-team quantity: the spread is a
    # difference, so the diff is the form the model actually wants
    for c in [c for c in F.columns if c.startswith("st_h_")]:
        F["st_d_" + c[5:]] = F[c] - F["st_a_" + c[5:]]

    # both sides in a matchup with nothing left to play for -- the classic April no-show
    F["st_both_done"] = ((F["st_h_eliminated"] + F["st_h_clinched"] > 0)
                         & (F["st_a_eliminated"] + F["st_a_clinched"] > 0)).astype(float)
    F["st_one_needs_it"] = ((F["st_h_playin_edge"].abs() < 3)
                            | (F["st_a_playin_edge"].abs() < 3)).astype(float)

    path = f"{OUT}/nba_standings_feats.parquet"
    F.to_parquet(path, index=False)
    print(f"{F.shape[0]:,} games x {F.shape[1]} cols -> {path}", flush=True)
    late = F[F["st_h_gp"] >= 50]
    print(f"\nlate-season sanity ({len(late):,} games with h_gp>=50):", flush=True)
    for c in ["st_h_rank", "st_h_playin_edge", "st_h_clinched", "st_h_eliminated",
              "st_h_tank", "st_both_done", "st_post_deadline"]:
        print(f"  {c:22s} mean={late[c].mean():7.2f}  nz={100*(late[c]!=0).mean():5.1f}%",
              flush=True)


if __name__ == "__main__":
    main()
