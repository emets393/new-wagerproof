#!/usr/bin/env python3
"""Player-availability study, both sports (AVAILABILITY_BRIEF1.md).

Two questions per absence flag (fresh absences only — player was in the
previous game's box, missing from this one):

  1. ON-COURT: what actually changes? Game pace vs the team's prior s2d pace
     (big man out -> faster or slower?), team turnovers (low-TO guard out ->
     more TOs?), team points vs prior average.
  2. MARKET: does the T-60 close already price it? Bet the affected team's
     TT over/under, the game total, and the team ATS — win%/ROI vs close.

If (1) shows a real effect and (2) shows the close absorbs it, the signal is
worthless live. Only a (1)+(2) combination — real effect AND market miss —
is productionizable (would then need a pregame injury feed).
"""
import glob
import os

import numpy as np
import pandas as pd

from movement_study import am_to_dec
from name_maps import norm

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

FLAGS = ["top1_out", "big_out", "guard_out", "lowto_guard_out"]


def h1tt_cons(sport):
    h = pd.concat([pd.read_parquet(p) for p in
                   sorted(glob.glob(f"{OUT}/h1tt_{sport}_*.parquet"))], ignore_index=True)
    for c in ("tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"):
        h[c] = am_to_dec(h[c])
    return h.groupby("event_id")[["tt_home_point", "tt_home_over_price",
                                  "tt_home_under_price", "tt_away_point",
                                  "tt_away_over_price", "tt_away_under_price"]].median()


def team_view(sport):
    """One row per team-game joined to odds spine: flags + on-court stats +
    prior baselines + market lines from the flagged team's perspective."""
    fl = pd.read_parquet(f"{OUT}/player_flags_{sport}.parquet").drop(columns=["season"])

    if sport == "ncaab":
        tb = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet").drop_duplicates(
            ["gameId", "teamId"])
        tb = pd.DataFrame({
            "game_key": tb["gameId"], "team_id": tb["teamId"],
            "is_home": tb["isHome"], "pace": tb["pace"],
            "tov": tb["teamStats.turnovers.total"],
            "pts": tb["teamStats.points.total"]})
        fl = fl.merge(tb, on=["game_key", "team_id"])
        spine = pd.read_parquet(f"{OUT}/games_ncaab.parquet").dropna(subset=["cbbd_id"])
        spine = spine[["event_id", "season", "cbbd_id"]].rename(columns={"cbbd_id": "game_key"})
        fl = fl.merge(spine, on="game_key")
        mg_name = "movement_games_ncaab"
    else:
        pb = pd.read_parquet(f"{OUT}/bdl_player_box.parquet")
        team_tov = pb.groupby(["game.id", "team.id"])["turnover"].sum().rename("tov")
        adv = pd.read_parquet(f"{OUT}/bdl_player_advanced.parquet")
        pace = adv.groupby("game.id")["pace"].median().rename("pace")
        bg = pd.read_parquet(f"{OUT}/bdl_games.parquet").drop_duplicates("id")
        bg["date_et"] = pd.to_datetime(bg["date"])
        fl = fl.merge(bg[["id", "date_et", "home_team.full_name", "visitor_team.full_name",
                          "home_team_score", "visitor_team_score", "home_team.id"]]
                      .rename(columns={"id": "game_key"}), on="game_key")
        fl["is_home"] = fl["team_id"] == fl["home_team.id"]
        fl["pts"] = np.where(fl["is_home"], fl["home_team_score"], fl["visitor_team_score"])
        fl = fl.merge(team_tov, left_on=["game_key", "team_id"],
                      right_on=["game.id", "team.id"])
        fl = fl.merge(pace, left_on="game_key", right_on="game.id", how="left")
        spine = pd.read_parquet(f"{OUT}/games_nba.parquet")
        spine["date_et"] = (pd.to_datetime(spine["commence_time"]).dt.tz_localize(None)
                            - pd.Timedelta(hours=5)).dt.normalize()
        spine["hkey"] = spine["home_team"].map(norm)
        fl["hkey"] = fl["home_team.full_name"].map(norm)
        fl = fl.merge(spine[["event_id", "hkey", "date_et", "season"]],
                      on=["hkey", "date_et"], how="inner")
        mg_name = "movement_games_nba"

    mg = pd.read_parquet(f"{OUT}/{mg_name}.parquet")[
        ["event_id", "t60_total_point", "t60_total_over_price", "t60_total_under_price",
         "t60_spread_home_point", "t60_spread_home_price", "t60_spread_away_price",
         "home_score", "away_score"]]
    fl = fl.merge(mg, on="event_id", how="inner")
    fl = fl.merge(h1tt_cons(sport), on="event_id", how="left")

    # prior baselines (strictly before this game) for pace/tov/pts
    fl = fl.sort_values(["team_key", "gidx"])
    g = fl.groupby("team_key")
    for c in ("pace", "tov", "pts"):
        fl[f"prior_{c}"] = g[c].transform(lambda s: s.shift(1).expanding().mean())
    fl["season"] = fl["season"].astype(str)
    return fl.dropna(subset=["prior_pace"])


def summarize_bet(df, win, push, dec, label, lines, min_n=25):
    ok = ~push & win.notna()
    n = int(ok.sum())
    if n < min_n:
        return
    profit = np.where(push, 0.0, np.where(win.fillna(False), dec.fillna(1.909) - 1, -1.0))
    wr = (win & ok).sum() / n * 100
    roi = profit[ok].mean() * 100
    per = []
    for s, gg in df.assign(w=win & ok, ok=ok, pr=profit).groupby("season"):
        m = int(gg["ok"].sum())
        if m:
            per.append(f"{s}: {gg['w'].sum()}/{m} {gg['w'].sum()/m*100:.0f}% {gg[gg['ok']]['pr'].mean()*100:+.0f}%")
    lines.append(f"| {label} | {n:,} | {wr:.1f}% | {roi:+.1f}% | {' · '.join(per)} |")


def run(sport, lines):
    df = team_view(sport)
    clean = df[df["reg_out_n"] + df["stale_out_n"] == 0]
    lines.append(f"\n## {sport.upper()} — {len(df):,} team-games on the odds spine\n")

    lines.append("### On-court effects (delta vs team's prior season-to-date, fresh absences)\n")
    lines.append("| flag | n | Δpace | Δteam TOs | Δteam pts | (no-absence baseline Δ) |")
    lines.append("|---|---|---|---|---|---|")
    base = {c: (clean[c] - clean[f"prior_{c}"]).mean() for c in ("pace", "tov", "pts")}
    for f in FLAGS:
        sub = df[df[f] > 0]
        if len(sub) < 25:
            continue
        d = {c: (sub[c] - sub[f"prior_{c}"]).mean() for c in ("pace", "tov", "pts")}
        lines.append(f"| {f} | {len(sub):,} | {d['pace']:+.2f} | {d['tov']:+.2f} | "
                     f"{d['pts']:+.2f} | ({base['pace']:+.2f} / {base['tov']:+.2f} / {base['pts']:+.2f}) |")

    lines.append("\n### Market tests — bets on games where the flagged team's absence is fresh\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    total = df["home_score"] + df["away_score"]
    tline = df["t60_total_point"]
    margin = df["home_score"] - df["away_score"]
    cover = margin + df["t60_spread_home_point"]
    for f in FLAGS:
        m = df[f] > 0
        sub = df[m]
        # game total under/over
        summarize_bet(sub, (total < tline)[m], (total == tline)[m],
                      df["t60_total_under_price"][m], f"{f} → game UNDER", lines)
        summarize_bet(sub, (total > tline)[m], (total == tline)[m],
                      df["t60_total_over_price"][m], f"{f} → game OVER", lines)
        # flagged team's TT under
        tt_line = np.where(sub["is_home"], sub["tt_home_point"], sub["tt_away_point"])
        tt_under = np.where(sub["is_home"], sub["tt_home_under_price"], sub["tt_away_under_price"])
        w = pd.Series(sub["pts"].values < tt_line, index=sub.index).where(~pd.isna(tt_line))
        p = pd.Series(sub["pts"].values == tt_line, index=sub.index).fillna(False)
        summarize_bet(sub, w, p, pd.Series(tt_under, index=sub.index), f"{f} → team TT UNDER", lines)
        # fade the shorthanded team ATS
        team_cover = pd.Series(np.where(sub["is_home"], cover[m] > 0, cover[m] < 0), index=sub.index)
        opp_price = pd.Series(np.where(sub["is_home"], sub["t60_spread_away_price"],
                                       sub["t60_spread_home_price"]), index=sub.index)
        own_price = pd.Series(np.where(sub["is_home"], sub["t60_spread_home_price"],
                                       sub["t60_spread_away_price"]), index=sub.index)
        summarize_bet(sub, ~team_cover & (cover[m] != 0), (cover == 0)[m], opp_price,
                      f"{f} → FADE team ATS", lines)
        summarize_bet(sub, team_cover, (cover == 0)[m], own_price,
                      f"{f} → BACK team ATS", lines)


def main():
    lines = ["# Availability Brief #1 — fresh regular absences vs the market",
             "",
             "Flags from build_player_flags.py (fresh = played previous game, out this",
             "one; roles from strictly-prior stats). Market bets at T-60 consensus."]
    for sport in ("nba", "ncaab"):
        run(sport, lines)
    path = os.path.join(ROOT, "AVAILABILITY_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
