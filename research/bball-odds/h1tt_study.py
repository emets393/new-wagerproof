#!/usr/bin/env python3
"""1H + team-totals relationship study, NBA + NCAAB (analog of NFL H1TT_BRIEF1).

We hold T-60 closes for h2h_h1/spreads_h1/totals_h1/team_totals (3 seasons per
sport) plus FG T-60 consensus and FG+1H final scores. No movement data for
these markets (single snapshot), so signals are RELATIONSHIP-based: internal
inconsistency between what books post across related markets.

Families tested (NFL keeper analogs):
  R1  1H total / FG total ratio extremes        -> 1H over/under
  R2  1H spread vs half-of-FG-spread deviation  -> 1H side
  R3  TT-sum vs FG total divergence             -> FG over/under
  R4  TT vs spread+total implied deviation      -> TT over/under
  R5  Big favorites                             -> favorite TT over
  R6  Stale-book chase: one book's 1H total far off 1H consensus -> bet toward
      consensus AT THE STALE BOOK'S line/price

All graded at T-60 prices (decimal). Writes H1TT_BBALL_BRIEF1.md.
"""
import glob
import os

import numpy as np
import pandas as pd

from movement_study import am_to_dec, summarize

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

PRICE_COLS = ["h1_ml_home_price", "h1_ml_away_price", "h1_spread_home_price",
              "h1_spread_away_price", "h1_total_over_price", "h1_total_under_price",
              "tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"]


def load(sport):
    frames = []
    for p in sorted(glob.glob(f"{OUT}/h1tt_{sport}_*.parquet")):
        df = pd.read_parquet(p)
        frames.append(df)
    h = pd.concat(frames, ignore_index=True)
    for c in PRICE_COLS:
        h[c] = am_to_dec(h[c])
    cons = h.groupby("event_id").median(numeric_only=True)

    mg = pd.read_parquet(f"{OUT}/movement_games_{sport}.parquet")
    keep = ["event_id", "season", "home_score", "away_score", "home_h1", "away_h1",
            "t60_spread_home_point", "t60_total_point",
            "t60_spread_home_price", "t60_spread_away_price",
            "t60_total_over_price", "t60_total_under_price"]
    df = mg[keep].merge(cons, on="event_id", how="inner")
    df = df.dropna(subset=["home_score", "home_h1"]).copy()
    print(f"{sport}: {len(df):,} games with 1H/TT closes + results", flush=True)
    return df, h


def grade(win, push, dec, default=1.909):
    return np.where(push, 0.0, np.where(win, dec.fillna(default) - 1, -1.0))


def h1_total_bet(df, side):
    h1 = df["home_h1"] + df["away_h1"]
    line = df["h1_total_point"]
    push = h1 == line
    if side == "over":
        return (h1 > line) & ~push, push, grade(h1 > line, push, df["h1_total_over_price"])
    return (h1 < line) & ~push, push, grade(h1 < line, push, df["h1_total_under_price"])


def h1_side_bet(df, side):
    m = df["home_h1"] - df["away_h1"]
    cover = m + df["h1_spread_home_point"]
    push = cover == 0
    if side == "home":
        return (cover > 0) & ~push, push, grade(cover > 0, push, df["h1_spread_home_price"])
    return (cover < 0) & ~push, push, grade(cover < 0, push, df["h1_spread_away_price"])


def fg_total_bet(df, side):
    tot = df["home_score"] + df["away_score"]
    line = df["t60_total_point"]
    push = tot == line
    if side == "over":
        return (tot > line) & ~push, push, grade(tot > line, push, df["t60_total_over_price"])
    return (tot < line) & ~push, push, grade(tot < line, push, df["t60_total_under_price"])


def tt_bet(df, team, side):
    pts = df["home_score"] if team == "home" else df["away_score"]
    line = df[f"tt_{team}_point"]
    push = pts == line
    win = pts > line if side == "over" else pts < line
    return win & ~push, push, grade(win, push, df[f"tt_{team}_{side}_price"])


def run(sport, lines):
    df, per_book = load(sport)
    lines.append(f"\n## {sport.upper()} — {len(df):,} games\n")
    tbl = lambda: (lines.append("| signal | n | win% | ROI | per season |"),
                   lines.append("|---|---|---|---|---|"))

    # R1: 1H/FG total ratio
    df["r1"] = df["h1_total_point"] / df["t60_total_point"]
    qs = df["r1"].quantile([0.1, 0.25, 0.75, 0.9])
    lines.append(f"### R1 — 1H total as share of FG total (median {df['r1'].median():.3f})\n")
    tbl()
    sub = df[df["r1"] <= qs[0.1]]
    summarize(sub, *h1_total_bet(sub, "over"), "1H share LOWEST decile → 1H OVER", lines)
    summarize(sub, *h1_total_bet(sub, "under"), "1H share LOWEST decile → 1H UNDER", lines)
    sub = df[df["r1"] >= qs[0.9]]
    summarize(sub, *h1_total_bet(sub, "over"), "1H share HIGHEST decile → 1H OVER", lines)
    summarize(sub, *h1_total_bet(sub, "under"), "1H share HIGHEST decile → 1H UNDER", lines)

    # R2: 1H spread vs half FG spread
    df["r2"] = df["h1_spread_home_point"] - df["t60_spread_home_point"] / 2
    lines.append("\n### R2 — 1H spread vs FG/2 deviation (dev>0 = 1H line softer on home)\n")
    tbl()
    for lo in (0.5, 1.0):
        sub = df[df["r2"] >= lo]
        summarize(sub, *h1_side_bet(sub, "home"), f"1H home line ≥{lo} SOFTER than FG/2 → 1H HOME", lines)
        sub = df[df["r2"] <= -lo]
        summarize(sub, *h1_side_bet(sub, "away"), f"1H home line ≥{lo} HARSHER than FG/2 → 1H AWAY", lines)

    # R3: TT sum vs FG total
    df["tt_sum"] = df["tt_home_point"] + df["tt_away_point"]
    df["r3"] = df["tt_sum"] - df["t60_total_point"]
    lines.append(f"\n### R3 — team-total sum minus FG total (median {df['r3'].median():+.2f})\n")
    tbl()
    for lo in (0.5, 1.0):
        sub = df[df["r3"] >= lo]
        summarize(sub, *fg_total_bet(sub, "over"), f"TT-sum ≥{lo} ABOVE total → FG OVER", lines)
        sub = df[df["r3"] <= -lo]
        summarize(sub, *fg_total_bet(sub, "under"), f"TT-sum ≥{lo} BELOW total → FG UNDER", lines)

    # R4: TT vs implied. home expected = (total - home_spread)/2 (spread is home
    # perspective, e.g. -8.5 when home favored -> home implied above half)
    df["impl_home"] = (df["t60_total_point"] - df["t60_spread_home_point"]) / 2
    df["impl_away"] = (df["t60_total_point"] + df["t60_spread_home_point"]) / 2
    for team in ("home", "away"):
        df[f"r4_{team}"] = df[f"tt_{team}_point"] - df[f"impl_{team}"]
    lines.append("\n### R4 — posted TT vs spread/total-implied TT\n")
    tbl()
    for team in ("home", "away"):
        for lo in (0.75, 1.5):
            sub = df[df[f"r4_{team}"] <= -lo]
            summarize(sub, *tt_bet(sub, team, "over"), f"{team} TT ≥{lo} BELOW implied → {team} TT OVER", lines)
            sub = df[df[f"r4_{team}"] >= lo]
            summarize(sub, *tt_bet(sub, team, "under"), f"{team} TT ≥{lo} ABOVE implied → {team} TT UNDER", lines)

    # R5: big favorites TT over
    big = -10 if sport == "nba" else -14
    lines.append(f"\n### R5 — big favorites (FG spread ≤ {big})\n")
    tbl()
    sub = df[df["t60_spread_home_point"] <= big]
    summarize(sub, *tt_bet(sub, "home", "over"), f"home fav ≤{big} → home TT OVER", lines)
    summarize(sub, *tt_bet(sub, "home", "under"), f"home fav ≤{big} → home TT UNDER", lines)
    sub = df[df["t60_spread_home_point"] >= -big]
    summarize(sub, *tt_bet(sub, "away", "over"), f"away fav ≥{-big} → away TT OVER", lines)
    summarize(sub, *tt_bet(sub, "away", "under"), f"away fav ≥{-big} → away TT UNDER", lines)

    # R6: stale-book chase on 1H totals — bet toward consensus at the stale book's number
    pb = per_book.merge(df[["event_id", "season", "home_h1", "away_h1",
                            "h1_total_point"]].rename(
        columns={"h1_total_point": "cons_h1_total"}), on="event_id", how="inner")
    pb["dev"] = pb["h1_total_point"] - pb["cons_h1_total"]
    h1 = pb["home_h1"] + pb["away_h1"]
    lines.append("\n### R6 — stale-book chase: book's 1H total vs consensus (bet toward consensus at that book)\n")
    tbl()
    for lo in (1.0, 1.5, 2.0):
        sub = pb[pb["dev"] >= lo]  # book too HIGH -> under at that book
        win = (h1[sub.index] < sub["h1_total_point"])
        push = h1[sub.index] == sub["h1_total_point"]
        summarize(sub, win & ~push, push,
                  grade(win, push, sub["h1_total_under_price"]),
                  f"book 1H total ≥{lo} ABOVE consensus → UNDER at book", lines)
        sub = pb[pb["dev"] <= -lo]
        win = (h1[sub.index] > sub["h1_total_point"])
        push = h1[sub.index] == sub["h1_total_point"]
        summarize(sub, win & ~push, push,
                  grade(win, push, sub["h1_total_over_price"]),
                  f"book 1H total ≥{lo} BELOW consensus → OVER at book", lines)


def main():
    lines = ["# H1TT Basketball Brief #1 — 1H + team-total relationship signals",
             "",
             "T-60 closes only (no movement exists for these markets). Consensus =",
             "cross-book median (prices decimal). Graded vs 1H/FG finals. Breakeven 52.4%."]
    for sport in ("nba", "ncaab"):
        run(sport, lines)
    path = os.path.join(ROOT, "H1TT_BBALL_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
