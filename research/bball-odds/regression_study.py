#!/usr/bin/env python3
"""Regression-to-the-mean study, both sports (REGRESSION_BRIEF1.md).

Per team-game, strictly-prior features:
  hot/cold     l5 scoring margin minus season-to-date margin (recent over/
               under-performance vs own baseline)
  3P luck      l5 team 3P% minus s2d 3P% (shooting variance — the classic
               college regression driver)
  ATS streak   covers in last 3 (market-relative form)
  O/U streak   overs in last 3 team games

Signals: back/fade the team ATS next game, game over/under — all at the T-60
consensus line/price. If markets over- or under-react to recent form, one
direction clears the vig.
"""
import os

import numpy as np
import pandas as pd

from name_maps import norm

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def team_games(sport):
    mg_cols = ["event_id", "season", "home_score", "away_score",
               "t60_spread_home_point", "t60_spread_home_price", "t60_spread_away_price",
               "t60_total_point", "t60_total_over_price", "t60_total_under_price"]
    mg = pd.read_parquet(f"{OUT}/movement_games_{sport}.parquet")[mg_cols]
    mg = mg.dropna(subset=["home_score", "t60_spread_home_point"])

    if sport == "ncaab":
        tb = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet").drop_duplicates(
            ["gameId", "teamId"])
        t = pd.DataFrame({
            "game_key": tb["gameId"],
            "team_key": tb["teamId"].astype(str) + "_" + tb["season"].astype(str),
            "date": pd.to_datetime(tb["startDate"]).dt.tz_localize(None),
            "is_home": tb["isHome"],
            "fg3m": tb["teamStats.threePointFieldGoals.made"],
            "fg3a": tb["teamStats.threePointFieldGoals.attempted"]})
        spine = pd.read_parquet(f"{OUT}/games_ncaab.parquet").dropna(subset=["cbbd_id"])
        t = t.merge(spine[["event_id", "cbbd_id"]].rename(columns={"cbbd_id": "game_key"}),
                    on="game_key")
    else:
        pb = pd.read_parquet(f"{OUT}/bdl_player_box.parquet")
        agg = pb.groupby(["game.id", "team.id"]).agg(
            fg3m=("fg3m", "sum"), fg3a=("fg3a", "sum")).reset_index()
        bg = pd.read_parquet(f"{OUT}/bdl_games.parquet").drop_duplicates("id")
        bg["date"] = pd.to_datetime(bg["date"])
        agg = agg.merge(bg[["id", "date", "home_team.id", "home_team.full_name",
                            "game.season" if "game.season" in bg.columns else "season"]]
                        .rename(columns={"id": "game.id"}), on="game.id")
        agg["is_home"] = agg["team.id"] == agg["home_team.id"]
        agg["team_key"] = agg["team.id"].astype(str) + "_" + agg["season"].astype(str)
        agg["hkey"] = agg["home_team.full_name"].map(norm)
        spine = pd.read_parquet(f"{OUT}/games_nba.parquet")
        spine["date"] = (pd.to_datetime(spine["commence_time"]).dt.tz_localize(None)
                         - pd.Timedelta(hours=5)).dt.normalize()
        spine["hkey"] = spine["home_team"].map(norm)
        agg = agg.drop(columns=["season"])  # int start-year; mg brings the display season
        t = agg.merge(spine[["event_id", "hkey", "date"]], on=["hkey", "date"],
                      how="inner").rename(columns={"game.id": "game_key"})

    t = t.merge(mg, on="event_id")
    m = np.where(t["is_home"], 1, -1)
    t["margin"] = (t["home_score"] - t["away_score"]) * m
    t["team_spread"] = t["t60_spread_home_point"] * np.where(t["is_home"], 1, -1)
    t["cover_amt"] = t["margin"] + t["team_spread"]
    t["cover"] = t["cover_amt"] > 0
    t["push"] = t["cover_amt"] == 0
    tot = t["home_score"] + t["away_score"]
    t["over"] = tot > t["t60_total_point"]
    t["opush"] = tot == t["t60_total_point"]
    t["p3"] = t["fg3m"] / t["fg3a"].replace(0, np.nan)

    t = t.sort_values(["team_key", "date"])
    g = t.groupby("team_key")
    t["s2d_margin"] = g["margin"].transform(lambda s: s.shift(1).expanding().mean())
    t["l5_margin"] = g["margin"].transform(lambda s: s.shift(1).rolling(5, min_periods=3).mean())
    t["s2d_p3"] = g["p3"].transform(lambda s: s.shift(1).expanding().mean())
    t["l5_p3"] = g["p3"].transform(lambda s: s.shift(1).rolling(5, min_periods=3).mean())
    t["l3_covers"] = g["cover"].transform(lambda s: s.shift(1).rolling(3).sum())
    t["l3_overs"] = g["over"].transform(lambda s: s.shift(1).rolling(3).sum())
    t["hot"] = t["l5_margin"] - t["s2d_margin"]
    t["luck3"] = t["l5_p3"] - t["s2d_p3"]
    t["own_price"] = np.where(t["is_home"], t["t60_spread_home_price"], t["t60_spread_away_price"])
    t["opp_price"] = np.where(t["is_home"], t["t60_spread_away_price"], t["t60_spread_home_price"])
    return t


def bet(df, win, push, dec, label, lines, min_n=50):
    ok = ~push
    n = int(ok.sum())
    if n < min_n:
        return
    profit = np.where(push, 0.0, np.where(win, dec.fillna(1.909) - 1, -1.0))
    per = []
    for s, g in df.assign(w=win & ok, ok=ok, pr=profit).groupby("season"):
        m = int(g["ok"].sum())
        if m:
            per.append(f"{s}: {g['w'].sum()}/{m} {g['w'].sum()/m*100:.0f}% {g[g['ok']]['pr'].mean()*100:+.0f}%")
    lines.append(f"| {label} | {n:,} | {(win & ok).sum()/n*100:.1f}% | "
                 f"{profit[ok].mean()*100:+.1f}% | {' · '.join(per)} |")


def run(sport, lines):
    t = team_games(sport)
    lines.append(f"\n## {sport.upper()} — {len(t):,} team-games\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")

    hot_hi = t["hot"].quantile(0.9)
    hot_lo = t["hot"].quantile(0.1)
    for tag, mask in ((f"HOT (l5 margin - s2d ≥ {hot_hi:.1f}, top decile)", t["hot"] >= hot_hi),
                      (f"COLD (≤ {hot_lo:.1f}, bottom decile)", t["hot"] <= hot_lo)):
        sub = t[mask & t["s2d_margin"].notna()]
        bet(sub, ~sub["cover"] & ~sub["push"], sub["push"], sub["opp_price"],
            f"{tag} → FADE ATS", lines)
        bet(sub, sub["cover"], sub["push"], sub["own_price"], f"{tag} → BACK ATS", lines)

    lk_hi = t["luck3"].quantile(0.9)
    lk_lo = t["luck3"].quantile(0.1)
    for tag, mask, better in ((f"3P HOT (l5-s2d 3P% ≥ {lk_hi*100:.1f}pp)", t["luck3"] >= lk_hi, "fade"),
                              (f"3P COLD (≤ {lk_lo*100:.1f}pp)", t["luck3"] <= lk_lo, "back")):
        sub = t[mask]
        bet(sub, ~sub["cover"] & ~sub["push"], sub["push"], sub["opp_price"],
            f"{tag} → FADE ATS", lines)
        bet(sub, sub["cover"], sub["push"], sub["own_price"], f"{tag} → BACK ATS", lines)
        bet(sub, ~sub["over"] & ~sub["opush"], sub["opush"], sub["t60_total_under_price"],
            f"{tag} → game UNDER", lines)
        bet(sub, sub["over"], sub["opush"], sub["t60_total_over_price"],
            f"{tag} → game OVER", lines)

    for k, tag in ((3, "covered 3 straight"), (0, "failed to cover 3 straight")):
        sub = t[t["l3_covers"] == k]
        bet(sub, ~sub["cover"] & ~sub["push"], sub["push"], sub["opp_price"],
            f"{tag} → FADE ATS", lines)
        bet(sub, sub["cover"], sub["push"], sub["own_price"], f"{tag} → BACK ATS", lines)
    for k, tag in ((3, "3 straight OVERS"), (0, "3 straight UNDERS")):
        sub = t[t["l3_overs"] == k]
        bet(sub, ~sub["over"] & ~sub["opush"], sub["opush"], sub["t60_total_under_price"],
            f"{tag} → game UNDER", lines)
        bet(sub, sub["over"], sub["opush"], sub["t60_total_over_price"],
            f"{tag} → game OVER", lines)


def main():
    lines = ["# Regression Brief #1 — recent form vs the market",
             "",
             "All features strictly prior (shift-1). Bets at T-60 consensus. 52.4% breakeven."]
    for sport in ("ncaab", "nba"):
        run(sport, lines)
    path = os.path.join(ROOT, "REGRESSION_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
