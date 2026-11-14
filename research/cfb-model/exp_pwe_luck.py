#!/usr/bin/env python3
"""
Postgame Win Expectancy (PWE) luck study — pre-registered.

Theory (owner, 2026-09-10): CFBD's postgame win expectancy says how often a team
wins the game GIVEN HOW IT WAS PLAYED, independent of the final score
(Toledo @ Michigan St 2026 wk1: lost by 10, PWE 0.468). A team that loses a game
it "deserved" to win got unlucky — does it come out stronger or weaker next game?

Pre-registered triggers (set before looking at any results):
  UNLUCKY_LOSS : lost the game with own PWE >= 0.50   (dose rung: >= 0.60)
  LUCKY_WIN    : won  the game with own PWE <= 0.50   (dose rung: <= 0.40)
Placebo (does PWE add anything beyond the scoreboard?):
  CLOSE_LOSS   : lost by <= 3 points with PWE < 0.50  (scoreline-unlucky only)
  Also the complement: lost by <= 3 WITH PWE >= 0.50 vs without.

Test: that team's NEXT game in the same season, ATS graded vs the OPENER
(the signal is known at the final whistle; the opener is the first line it could
bet — repo grading law). Report win% vs the blind base rate of the same side,
per-season breakdown, and the close-line comparison to see if the market moves.

One row per TEAM-GAME (panel law). Oracle check on the grader before any result.
"""
import os, sys, time, requests
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "data", "cfbd", "pwe_games.parquet")
SEASONS = list(range(2016, 2026))  # matches model_games_hist coverage (no 2020 in frame)


def api_key():
    for env in (os.path.join(HERE, "..", "..", ".env.local"),):
        if os.path.exists(env):
            for line in open(env):
                if line.startswith("CFBD_API_KEY="):
                    return line.split("=", 1)[1].strip()
    return os.environ.get("CFBD_API_KEY", "")


def fetch_pwe():
    if os.path.exists(CACHE):
        df = pd.read_parquet(CACHE)
        if set(SEASONS) <= set(df.season.unique()):
            return df
    key = api_key()
    rows = []
    for yr in SEASONS:
        for st in ("regular", "postseason"):
            r = requests.get("https://api.collegefootballdata.com/games",
                             params={"year": yr, "seasonType": st},
                             headers={"Authorization": f"Bearer {key}"}, timeout=60)
            r.raise_for_status()
            for g in r.json():
                if g.get("homePoints") is None:
                    continue
                rows.append(dict(
                    game_id=int(g["id"]), season=yr, week=int(g.get("week") or 0),
                    season_type=st, start_date=g.get("startDate"),
                    home_team=g.get("homeTeam"), away_team=g.get("awayTeam"),
                    home_points=g.get("homePoints"), away_points=g.get("awayPoints"),
                    home_pwe=g.get("homePostgameWinProbability"),
                    away_pwe=g.get("awayPostgameWinProbability"),
                    home_class=g.get("homeClassification"),
                    away_class=g.get("awayClassification")))
            time.sleep(0.4)
        print(f"  {yr}: cumulative {len(rows)} completed games")
    df = pd.DataFrame(rows)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    df.to_parquet(CACHE, index=False)
    return df


def build_panel(pwe, hist):
    # market frame: one row per game with opener/closer + result
    m = hist[["game_id", "season", "week", "spread_open", "spread_close",
              "actual_margin"]].dropna(subset=["spread_open", "actual_margin"]).copy()
    g = pwe.merge(m, on=["game_id", "season", "week"], how="inner")
    print(f"joined market+PWE games: {len(g)} "
          f"(of {len(m)} market games; PWE missing on the rest)")

    # melt to team-game panel
    home = pd.DataFrame(dict(
        game_id=g.game_id, season=g.season, week=g.week, date=g.start_date,
        team=g.home_team, opp=g.away_team, is_home=True,
        pts=g.home_points, opp_pts=g.away_points, pwe=g.home_pwe,
        spread_open=g.spread_open, spread_close=g.spread_close,
        margin=g.actual_margin))
    away = pd.DataFrame(dict(
        game_id=g.game_id, season=g.season, week=g.week, date=g.start_date,
        team=g.away_team, opp=g.home_team, is_home=False,
        pts=g.away_points, opp_pts=g.home_points, pwe=g.away_pwe,
        spread_open=-g.spread_open, spread_close=-g.spread_close,
        margin=-g.actual_margin))
    p = pd.concat([home, away], ignore_index=True)
    # spread_open here is now TEAM-relative (negative = this team favored)
    p["won"] = (p.margin > 0).astype(int)
    p["cover_open"] = np.sign(p.margin + p.spread_open)   # +1 cover / -1 no / 0 push
    p["cover_close"] = np.sign(p.margin + p.spread_close)
    p = p.dropna(subset=["pwe"]).sort_values(["team", "date"]).reset_index(drop=True)

    # ORACLE CHECK (repo law): a rule that bets the realized cover side must win ~100%
    o = p[p.cover_open != 0]
    oracle = (np.sign(o.margin + o.spread_open) == o.cover_open).mean()
    assert oracle == 1.0, f"grader oracle failed: {oracle}"
    home_cover = (p[p.is_home & (p.cover_open != 0)].cover_open > 0).mean()
    print(f"oracle passed; blind home cover vs open = {home_cover:.3f} (sanity ~0.50)")

    # prior game (same season) for each team-game
    p["prev_pwe"] = p.groupby(["team", "season"]).pwe.shift(1)
    p["prev_won"] = p.groupby(["team", "season"]).won.shift(1)
    p["prev_margin"] = p.groupby(["team", "season"]).margin.shift(1)
    return p


def report(name, sub, base):
    """win% backing the TEAM next game, ATS vs opener, vs blind base of same rows."""
    s = sub[sub.cover_open != 0]
    if not len(s):
        print(f"{name:34s} n=0")
        return
    win = (s.cover_open > 0).mean()
    b = base[base.cover_open != 0]
    blind = (b.cover_open > 0).mean()
    roi = win * (100 / 110 + 1) - 1
    z = (win - 0.5) * 2 * np.sqrt(len(s)) / 1.0
    per = []
    for yr, gs in s.groupby("season"):
        per.append(f"{yr}: {100*(gs.cover_open>0).mean():.0f}% (n={len(gs)})")
    print(f"{name:34s} n={len(s):5d}  cover {100*win:.1f}%  roi {100*roi:+.1f}%  "
          f"blind-same-rows {100*blind:.1f}%  z={z:+.2f}")
    print(" " * 36 + " | ".join(per))
    # market check: does the close move toward or away from the team?
    sc = sub[sub.cover_close != 0]
    if len(sc):
        winc = (sc.cover_close > 0).mean()
        print(" " * 36 + f"vs CLOSE: {100*winc:.1f}% (n={len(sc)})  "
              f"line move open->close on team: {(sub.spread_close - sub.spread_open).mean():+.2f} pts")


def main():
    print(">>> fetching / loading PWE 2016-2025")
    pwe = fetch_pwe()
    hist = pd.read_parquet(os.path.join(HERE, "data", "model_games_hist.parquet"))
    p = build_panel(pwe, hist)

    nxt = p.dropna(subset=["prev_pwe", "prev_won"])
    print(f"\npanel team-games with a previous game: {len(nxt)}")

    print("\n================ PRE-REGISTERED TRIGGERS (next-game ATS vs OPENER) ================")
    all_rows = nxt
    report("ALL rows (baseline)", all_rows, all_rows)
    report("UNLUCKY LOSS (lost, prev_pwe>=.50)",
           nxt[(nxt.prev_won == 0) & (nxt.prev_pwe >= 0.50)], all_rows)
    report("  dose: lost, prev_pwe>=.60",
           nxt[(nxt.prev_won == 0) & (nxt.prev_pwe >= 0.60)], all_rows)
    report("  dose: lost, prev_pwe>=.70",
           nxt[(nxt.prev_won == 0) & (nxt.prev_pwe >= 0.70)], all_rows)
    report("LUCKY WIN (won, prev_pwe<=.50)",
           nxt[(nxt.prev_won == 1) & (nxt.prev_pwe <= 0.50)], all_rows)
    report("  dose: won, prev_pwe<=.40",
           nxt[(nxt.prev_won == 1) & (nxt.prev_pwe <= 0.40)], all_rows)
    report("  dose: won, prev_pwe<=.30",
           nxt[(nxt.prev_won == 1) & (nxt.prev_pwe <= 0.30)], all_rows)

    print("\n================ PLACEBO: scoreboard-only vs PWE ================")
    close_loss = nxt[(nxt.prev_won == 0) & (nxt.prev_margin >= -3)]
    report("close loss (<=3), ANY pwe", close_loss, all_rows)
    report("close loss (<=3), pwe>=.50", close_loss[close_loss.prev_pwe >= 0.50], all_rows)
    report("close loss (<=3), pwe<.50", close_loss[close_loss.prev_pwe < 0.50], all_rows)
    report("NON-close loss (4+), pwe>=.50",
           nxt[(nxt.prev_won == 0) & (nxt.prev_margin < -3) & (nxt.prev_pwe >= 0.50)], all_rows)

    print("\n================ CONTINUOUS: prev pwe_gap quintiles ================")
    nxt = nxt.copy()
    nxt["prev_gap"] = nxt.prev_pwe - nxt.prev_won   # >0 unlucky, <0 lucky
    nxt["gap_q"] = pd.qcut(nxt.prev_gap, 5, labels=False, duplicates="drop")
    for q, gs in nxt.groupby("gap_q"):
        s = gs[gs.cover_open != 0]
        print(f"  gap Q{q} [{gs.prev_gap.min():+.2f},{gs.prev_gap.max():+.2f}] "
              f"n={len(s):5d}  next-game cover {100*(s.cover_open>0).mean():.1f}%")

    print("\n================ PHASE 2: cumulative season-to-date LUCK RATING ================")
    # luck debt = mean pwe_gap over all PRIOR games this season (>=3 priors).
    # Positive = team has been repeatedly unlucky. Does accumulated luck predict?
    p2 = p.copy()
    p2["gap"] = p2.pwe - p2.won
    p2["cum_gap"] = p2.groupby(["team", "season"]).gap.transform(
        lambda s: s.shift(1).expanding().mean())
    p2["prior_n"] = p2.groupby(["team", "season"]).cumcount()
    p2 = p2[(p2.prior_n >= 3) & p2.cum_gap.notna()]
    p2["luck_q"] = pd.qcut(p2.cum_gap, 5, labels=False, duplicates="drop")
    for q, gs in p2.groupby("luck_q"):
        s = gs[gs.cover_open != 0]
        per = " | ".join(f"{yr}:{100*(g2[g2.cover_open!=0].cover_open>0).mean():.0f}%"
                         for yr, g2 in gs.groupby("season"))
        print(f"  luck Q{q} [{gs.cum_gap.min():+.2f},{gs.cum_gap.max():+.2f}] "
              f"n={len(s):5d}  cover {100*(s.cover_open>0).mean():.1f}%   {per}")
    # dose tails
    for lbl, sel in (("luck debt >= +0.15 (very unlucky s2d)", p2.cum_gap >= 0.15),
                     ("luck credit <= -0.15 (very lucky s2d)", p2.cum_gap <= -0.15)):
        s = p2[sel & (p2.cover_open != 0)]
        if len(s):
            per = " | ".join(f"{yr}:{100*(g2.cover_open>0).mean():.0f}%(n={len(g2)})"
                             for yr, g2 in s.groupby("season"))
            print(f"  {lbl:38s} n={len(s):4d}  cover {100*(s.cover_open>0).mean():.1f}%   {per}")


if __name__ == "__main__":
    main()
