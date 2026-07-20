#!/usr/bin/env python3
"""Movement playbook study #1: FG spread/total/ML movement signals, both sports.

Per game we derive the cross-book consensus (median) line at four checkpoints:
  open (first grid sighting), T-24h, T-4h, T-60 (= bettable trigger per the
  closing-line policy). Movement = open->T60; late movement = T4h->T60.

Grading (see memory: nfl-backtest-grading-framework): every signal triggers at
T-60 and is graded AGAINST THE T-60 LINE at the T-60 median price — what a user
could actually bet. Per-season breakdowns always shown.

Outputs:
  data/parquet/movement_games_{sport}.parquet  (game-level feature table)
  MOVEMENT_BRIEF1.md                           (signal results)
"""
import glob
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

CHECKPOINTS = {"open": None, "t24": 24 * 60, "t4": 4 * 60, "t60": 60}
MARKETS = {
    "spread": ["spread_home_point", "spread_home_price", "spread_away_price"],
    "total": ["total_point", "total_over_price", "total_under_price"],
    "ml": ["ml_home_price", "ml_away_price"],
}


def am_to_dec(price):
    """American odds -> decimal. American odds are discontinuous at +/-100, so
    cross-book consensus prices MUST be medianed in decimal space (a median of
    [-102, +101] in American space is ~0 -> infinite payout artifacts)."""
    p = np.asarray(price, dtype=float)
    return np.where(p > 0, 1 + p / 100.0, 1 + 100.0 / np.abs(p))


def implied_dec(dec):
    return 1.0 / np.asarray(dec, dtype=float)


def build_game_level(sport):
    frames = []
    for p in sorted(glob.glob(f"{OUT}/grid_{sport}_*.parquet")):
        season = os.path.basename(p).split("_")[-1].replace(".parquet", "")
        df = pd.read_parquet(p)
        df["season"] = season
        frames.append(df)
    g = pd.concat(frames, ignore_index=True)
    g["snap_ts"] = pd.to_datetime(g["snap_ts"])
    g["commence_time"] = pd.to_datetime(g["commence_time"])
    g = g.sort_values("snap_ts")

    meta = g.groupby("event_id").agg(season=("season", "last"),
                                     commence_time=("commence_time", "last"))
    out = meta
    for cp, mins in CHECKPOINTS.items():
        sub = g if mins is None else g[g["snap_ts"] <= g["commence_time"] - pd.Timedelta(minutes=mins)]
        for mkt, cols in MARKETS.items():
            anchor = cols[0]
            has = sub[sub[anchor].notna()]
            grp = has.groupby(["event_id", "book"])[cols]
            per_book = (grp.first() if mins is None else grp.last())
            for c in cols:
                if c.endswith("_price"):
                    per_book[c] = am_to_dec(per_book[c])
            cons = per_book.groupby("event_id").median()
            cons.columns = [f"{cp}_{c}" for c in cons.columns]
            out = out.join(cons)
    out = out.reset_index()

    games = pd.read_parquet(f"{OUT}/games_{sport}.parquet")[
        ["event_id", "home_team", "away_team", "home_score", "away_score",
         "home_h1", "away_h1"]]
    out = out.merge(games, on="event_id", how="left")
    out.to_parquet(f"{OUT}/movement_games_{sport}.parquet", index=False)
    print(f"movement_games_{sport}: {len(out):,} games", flush=True)
    return out


def grade_side(df, side):
    """Return (wins, losses, pushes, roi_per_bet) betting `side` vs the T-60 spread."""
    margin = df["home_score"] - df["away_score"]
    line = df["t60_spread_home_point"]
    cover = margin + line  # >0 home covers
    if side == "home":
        win, dec = cover > 0, df["t60_spread_home_price"]
    else:
        win, dec = cover < 0, df["t60_spread_away_price"]
    push = cover == 0
    profit = np.where(push, 0.0, np.where(win, dec.fillna(1.909) - 1, -1.0))
    return win & ~push, push, profit


def grade_total(df, side):
    total = df["home_score"] + df["away_score"]
    line = df["t60_total_point"]
    if side == "over":
        win, dec = total > line, df["t60_total_over_price"]
    else:
        win, dec = total < line, df["t60_total_under_price"]
    push = total == line
    profit = np.where(push, 0.0, np.where(win, dec.fillna(1.909) - 1, -1.0))
    return win & ~push, push, profit


def summarize(df, win, push, profit, label, lines):
    n = int((~push).sum())
    if n < 30:
        return
    wr = win.sum() / n * 100
    roi = profit.mean() * 100
    per = []
    for s, sub in df.assign(win=win, push=push, profit=profit).groupby("season"):
        m = int((~sub["push"]).sum())
        if m:
            per.append(f"{s.split('-')[0][2:]}-{s.split('-')[1]}: {sub['win'].sum()}/{m} "
                       f"{sub['win'].sum()/m*100:.0f}% {sub['profit'].mean()*100:+.0f}%")
    lines.append(f"| {label} | {n:,} | {wr:.1f}% | {roi:+.1f}% | {' · '.join(per)} |")


def run_signals(df, sport, lines):
    df = df.dropna(subset=["home_score"]).copy()
    lines.append(f"\n## {sport.upper()} — {len(df):,} graded games\n")

    # ---- Total movement: open -> T-60 ----
    df["tmove"] = df["t60_total_point"] - df["open_total_point"]
    df["tmove_late"] = df["t60_total_point"] - df["t4_total_point"]
    lines.append("### Totals — follow the move (bet the direction the line moved), graded at T-60 line/price\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for lo in (0.5, 1.0, 1.5, 2.0, 3.0):
        sub = df[df["tmove"] <= -lo]
        summarize(sub, *grade_total(sub, "under"), f"total DROPPED ≥{lo} → UNDER", lines)
        sub = df[df["tmove"] >= lo]
        summarize(sub, *grade_total(sub, "over"), f"total ROSE ≥{lo} → OVER", lines)
    for lo in (0.5, 1.0, 1.5):
        sub = df[df["tmove_late"] <= -lo]
        summarize(sub, *grade_total(sub, "under"), f"LATE (T-4h→T-60) drop ≥{lo} → UNDER", lines)
        sub = df[df["tmove_late"] >= lo]
        summarize(sub, *grade_total(sub, "over"), f"LATE rise ≥{lo} → OVER", lines)

    lines.append("\n### Totals — fade the move\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for lo in (1.0, 2.0, 3.0):
        sub = df[df["tmove"] <= -lo]
        summarize(sub, *grade_total(sub, "over"), f"total dropped ≥{lo} → fade w/ OVER", lines)
        sub = df[df["tmove"] >= lo]
        summarize(sub, *grade_total(sub, "under"), f"total rose ≥{lo} → fade w/ UNDER", lines)

    # ---- Spread movement ----
    df["smove"] = df["t60_spread_home_point"] - df["open_spread_home_point"]
    df["smove_late"] = df["t60_spread_home_point"] - df["t4_spread_home_point"]
    lines.append("\n### Spreads — follow the steam (line moved toward a side; bet that side at T-60)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for lo in (0.5, 1.0, 1.5, 2.0, 3.0):
        sub = df[df["smove"] <= -lo]  # home point got more negative = steam toward HOME
        summarize(sub, *grade_side(sub, "home"), f"steam toward HOME ≥{lo} → HOME", lines)
        sub = df[df["smove"] >= lo]
        summarize(sub, *grade_side(sub, "away"), f"steam toward AWAY ≥{lo} → AWAY", lines)
    for lo in (0.5, 1.0):
        sub = df[df["smove_late"] <= -lo]
        summarize(sub, *grade_side(sub, "home"), f"LATE steam HOME ≥{lo} → HOME", lines)
        sub = df[df["smove_late"] >= lo]
        summarize(sub, *grade_side(sub, "away"), f"LATE steam AWAY ≥{lo} → AWAY", lines)

    lines.append("\n### Spreads — fade the steam\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for lo in (1.0, 2.0, 3.0):
        sub = df[df["smove"] <= -lo]
        summarize(sub, *grade_side(sub, "away"), f"steam toward HOME ≥{lo} → fade w/ AWAY", lines)
        sub = df[df["smove"] >= lo]
        summarize(sub, *grade_side(sub, "home"), f"steam toward AWAY ≥{lo} → fade w/ HOME", lines)

    # ---- ML movement (implied prob shift), MLB-playbook style dog buckets ----
    df["p_home_open"] = implied_dec(df["open_ml_home_price"])
    df["p_home_t60"] = implied_dec(df["t60_ml_home_price"])
    df["pmove"] = df["p_home_t60"] - df["p_home_open"]
    margin = df["home_score"] - df["away_score"]
    lines.append("\n### Moneyline — dogs whose implied prob moved, bet ML at T-60 price\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for side, price_col, win_cond in (("home", "t60_ml_home_price", margin > 0),
                                      ("away", "t60_ml_away_price", margin < 0)):
        p_t60 = df["p_home_t60"] if side == "home" else 1 - df["p_home_t60"]
        pm = df["pmove"] if side == "home" else -df["pmove"]
        for plo, phi, tag in ((0.30, 0.45, "med dog"), (0.45, 0.50, "small dog")):
            for mlo, mtag in ((0.02, "steamed ≥2pp"), (-0.02, "faded ≥2pp")):
                mask = (p_t60 >= plo) & (p_t60 < phi) & ((pm >= mlo) if mlo > 0 else (pm <= mlo))
                sub = df[mask]
                if len(sub) < 30:
                    continue
                win = win_cond[mask]
                push = pd.Series(False, index=sub.index)
                profit = np.where(win, sub[price_col].fillna(2.0) - 1, -1.0)
                summarize(sub, win, push, profit, f"{side.upper()} {tag} {mtag} → {side} ML", lines)


def main():
    lines = ["# Movement Brief #1 — NBA/NCAAB FG movement signals",
             "",
             "Consensus = cross-book median. Trigger/grade = T-60 line & median price",
             "(honest per grading framework; movement measured open→T-60, late = T-4h→T-60).",
             "Breakeven at -110 = 52.4%."]
    for sport in ("nba", "ncaab"):
        df = build_game_level(sport)
        run_signals(df, sport, lines)
    path = os.path.join(ROOT, "MOVEMENT_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
