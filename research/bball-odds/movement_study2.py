#!/usr/bin/env python3
"""Movement Study #2 — the four gaps Brief #1 left, on the six-season warehouse.

Owner asks (2026-08-18): thresholds/timing were covered; ML bands, ML-x-spread combined,
finer timing, and cross-book disagreement were NOT. Plus Brief #1 parked two ML-steam
cells as "tracking only, small n" — the bought seasons are exactly the sample they wanted.

Sections (pre-registered here, not searched):
  A  ML PRICE-BAND CALIBRATION — flat-bet every game by T-60 price band, home/away x
     fav/dog. Calibration table (where does the vig actually sit), not a signal claim.
     CFB/DK prior: fav-longshot bias, small home dogs +100..140 the one bettable cell.
  B  ML x SPREAD DIVERGENCE — the two books' moves disagree about a side:
       ML-ONLY steam: implied prob moved >=2pp toward X, spread moved <0.5 toward X
         -> books moved the PRICE but defended the NUMBER; pre-registered read: follow X
         on the SPREAD (the number is stale).
       SPREAD-ONLY steam: spread moved >=1.0 toward X, implied prob moved <0.5pp
         -> follow X on the ML (the price is stale).
     Both derivatives graded for completeness; concordant steam shown as reference.
  C  PATH SHAPE — Brief #1 graded open->T60 and T4->T60 separately but never the
     RELATION between legs. Reversal games (early leg open->T24 and late leg T24->T60
     move OPPOSITE, both >=0.5): does the late leg know more? (CFB prior: early moves
     reverse 63% — follow the LATE leg.) One-way games as the contrast.
  D  CROSS-BOOK DISPERSION at T-60 — per-book close from openclose_*: spread
     max-min >=1.5 (total >=2.0) AND consensus moved >=1.0 in a direction -> follow at
     the T-60 median. CFB prior: cross-book disagreement was the ONE movement edge.
  E  BRIEF-1 PARKED CELLS, six seasons — identical definitions (p_t60 bands, +/-2pp):
     NBA small-dog steam home/away; NCAAB med/small-dog steam.

Grading: everything triggers at T-60 and is graded at the T-60 median line/price
(nfl-backtest-grading-framework). Prices in movement_games/openclose are DECIMAL.
Per-season always shown; n floor 30. Writes MOVEMENT_BRIEF2.md.
"""
import glob
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
OUT = os.path.join(ROOT, "MOVEMENT_BRIEF2.md")

spec = importlib.util.spec_from_file_location("ms", os.path.join(ROOT, "movement_study.py"))
ms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ms)

DOG_BANDS = [(2.00, 2.40, "+100..+140"), (2.40, 2.65, "+140..+165"),
             (2.65, 3.00, "+165..+200"), (3.00, 4.00, "+200..+300"), (4.00, 99.0, "+300+")]
FAV_BANDS = [(1.667, 1.909, "-110..-150"), (1.500, 1.667, "-150..-200"),
             (1.333, 1.500, "-200..-300"), (1.200, 1.333, "-300..-500"), (1.001, 1.200, "-500+")]


def ml_row(df, side, mask, label, lines):
    sub = df[mask]
    n = len(sub)
    if n < 30:
        return
    margin = sub["home_score"] - sub["away_score"]
    win = (margin > 0) if side == "home" else (margin < 0)
    dec = sub[f"t60_ml_{side}_price"]
    profit = np.where(win, dec - 1, -1.0)
    per = []
    for s, g in sub.assign(win=win, profit=profit).groupby("season"):
        if len(g):
            per.append(f"{s[2:5]}{s[7:]}: {int(g['win'].sum())}/{len(g)} "
                       f"{g['profit'].mean()*100:+.0f}%")
    lines.append(f"| {label} | {n:,} | {win.mean()*100:.1f}% | {profit.mean()*100:+.1f}% | "
                 f"{' · '.join(per)} |")


def section_a(df, sport, lines):
    lines += [f"\n### {sport.upper()} — A. ML price-band calibration (flat bet every game "
              "in band at T-60 median price)\n",
              "| band | n | win% | ROI | per season |", "|---|---|---|---|---|"]
    for side in ("home", "away"):
        dec = df[f"t60_ml_{side}_price"]
        for lo, hi, tag in FAV_BANDS + DOG_BANDS:
            ml_row(df, side, dec.ge(lo) & dec.lt(hi), f"{side.upper()} {tag}", lines)


def section_b(df, sport, lines):
    p_open = 1.0 / df["open_ml_home_price"]
    p_t60 = 1.0 / df["t60_ml_home_price"]
    dp = p_t60 - p_open                                  # + = toward home
    sm = df["t60_spread_home_point"] - df["open_spread_home_point"]   # - = toward home
    lines += [f"\n### {sport.upper()} — B. ML x spread divergence (open→T-60)\n",
              "| signal | n | win% | ROI | per season |", "|---|---|---|---|---|"]
    for side in ("home", "away"):
        s = 1.0 if side == "home" else -1.0
        toward_ml = s * dp            # pp toward this side
        toward_sp = -s * sm           # points toward this side
        cells = [
            (f"ML-only steam → {side} SPREAD", (toward_ml >= 0.02) & (toward_sp.abs() < 0.5), "spread"),
            (f"ML-only steam → {side} ML", (toward_ml >= 0.02) & (toward_sp.abs() < 0.5), "ml"),
            (f"SPREAD-only steam → {side} ML", (toward_sp >= 1.0) & (toward_ml.abs() < 0.005), "ml"),
            (f"SPREAD-only steam → {side} SPREAD", (toward_sp >= 1.0) & (toward_ml.abs() < 0.005), "spread"),
            (f"concordant steam → {side} SPREAD", (toward_ml >= 0.02) & (toward_sp >= 1.0), "spread"),
        ]
        for label, mask, deriv in cells:
            mask = mask & df["t60_ml_home_price"].notna() & df["open_ml_home_price"].notna()
            if deriv == "ml":
                ml_row(df, side, mask, label, lines)
            else:
                sub = df[mask]
                if len(sub) < 30:
                    continue
                win, push, profit = ms.grade_side(sub, side)
                ms.summarize(sub, win, push, profit, label, lines)


def section_c(df, sport, lines):
    lines += [f"\n### {sport.upper()} — C. Path shape: reversal vs one-way (early leg "
              "open→T-24 vs late leg T-24→T-60)\n",
              "| signal | n | win% | ROI | per season |", "|---|---|---|---|---|"]
    for mkt, grade, sides in (("total", ms.grade_total, ("over", "under")),
                              ("spread", ms.grade_side, ("home", "away"))):
        col = "total_point" if mkt == "total" else "spread_home_point"
        early = df[f"t24_{col}"] - df[f"open_{col}"]
        late = df[f"t60_{col}"] - df[f"t24_{col}"]
        rev = (early.abs() >= 0.5) & (late.abs() >= 0.5) & (np.sign(early) != np.sign(late))
        oneway = (early.abs() >= 0.5) & (late.abs() >= 0.5) & (np.sign(early) == np.sign(late))
        for name, mask, leg in ((f"{mkt} REVERSAL follow LATE leg", rev, late),
                                (f"{mkt} REVERSAL follow EARLY leg", rev, early),
                                (f"{mkt} ONE-WAY follow", oneway, late)):
            for sgn, side in ((1.0, sides[0]), (-1.0, sides[1])):
                if mkt == "spread":
                    m = mask & ((leg < 0) if side == "home" else (leg > 0))
                else:
                    m = mask & ((leg > 0) if side == "over" else (leg < 0))
                sub = df[m]
                if len(sub) < 30:
                    continue
                win, push, profit = grade(sub, side)
                ms.summarize(sub, win, push, profit, f"{name} ({side})", lines)


def section_d(sport, mg, lines):
    frames = []
    for p in sorted(glob.glob(f"{PQ}/openclose_{sport}_*.parquet")):
        d = pd.read_parquet(p, columns=["event_id", "book", "close_spread_home_point",
                                        "close_total_point"])
        frames.append(d)
    ob = pd.concat(frames, ignore_index=True)
    disp = ob.groupby("event_id").agg(
        sp_disp=("close_spread_home_point", lambda s: s.max() - s.min()),
        tot_disp=("close_total_point", lambda s: s.max() - s.min()),
        books=("book", "nunique"))
    df = mg.merge(disp, on="event_id", how="left")
    df = df[df["books"] >= 5]
    sm = df["t60_spread_home_point"] - df["open_spread_home_point"]
    tm = df["t60_total_point"] - df["open_total_point"]
    lines += [f"\n### {sport.upper()} — D. cross-book dispersion at T-60 (books ≥5) + "
              "consensus move ≥1 → follow at median\n",
              "| signal | n | win% | ROI | per season |", "|---|---|---|---|---|"]
    for tag, dmask in (("disp<1", df["sp_disp"] < 1.0), ("disp≥1.5", df["sp_disp"] >= 1.5)):
        for side, m in (("home", sm <= -1.0), ("away", sm >= 1.0)):
            sub = df[dmask & m]
            if len(sub) < 30:
                continue
            win, push, profit = ms.grade_side(sub, side)
            ms.summarize(sub, win, push, profit, f"spread {tag} steam → {side}", lines)
    for tag, dmask in (("disp<1", df["tot_disp"] < 1.0), ("disp≥2", df["tot_disp"] >= 2.0)):
        for side, m in (("over", tm >= 1.0), ("under", tm <= -1.0)):
            sub = df[dmask & m]
            if len(sub) < 30:
                continue
            win, push, profit = ms.grade_total(sub, side)
            ms.summarize(sub, win, push, profit, f"total {tag} steam → {side}", lines)


def section_e(df, sport, lines):
    p_home = 1.0 / df["t60_ml_home_price"]
    p_open = 1.0 / df["open_ml_home_price"]
    pmove = p_home - p_open
    lines += [f"\n### {sport.upper()} — E. Brief-1 parked ML cells, six seasons "
              "(identical definitions)\n",
              "| signal | n | win% | ROI | per season |", "|---|---|---|---|---|"]
    for side in ("home", "away"):
        p_t60 = p_home if side == "home" else 1 - p_home
        pm = pmove if side == "home" else -pmove
        for plo, phi, tag in ((0.30, 0.45, "med dog"), (0.45, 0.50, "small dog")):
            for mlo, mtag in ((0.02, "steamed ≥2pp"), (-0.02, "faded ≥2pp")):
                mask = (p_t60 >= plo) & (p_t60 < phi) & \
                       ((pm >= mlo) if mlo > 0 else (pm <= mlo))
                ml_row(df, side, mask, f"{side} {tag} {mtag}", lines)


def main():
    lines = ["# Movement Brief #2 — ML bands, divergence, path shape, dispersion "
             "(six seasons)", "",
             "All signals trigger at T-60, graded at the T-60 median line/price. "
             "Prices decimal. n floor 30. Sections pre-registered in movement_study2.py.", ""]
    for sport in ("nba", "ncaab"):
        mg = pd.read_parquet(f"{PQ}/movement_games_{sport}.parquet")
        mg = mg[mg["home_score"].notna()]
        print(f"[{sport}] {len(mg):,} graded games, seasons "
              f"{sorted(mg['season'].unique())}", flush=True)
        section_a(mg, sport, lines)
        section_b(mg, sport, lines)
        section_c(mg, sport, lines)
        section_d(sport, mg, lines)
        section_e(mg, sport, lines)
    with open(OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
