#!/usr/bin/env python3
"""Prop baselines BEFORE any model: is there structure a model would have to beat?

Two pre-registered hypotheses, both with a stated mechanism, both checked at the real
T-60 price so nothing here is CLV-inflated:

  H1  UNDER BIAS. Public prop money buys overs (it is a lottery ticket on a name you
      know), so books shade the number up. The panel already shows actual over rate
      landing below the de-vigged implied probability in every probability bucket.
      If that survives the 6.9% hold it is a standing edge, not a model.

  H2  LINE SHOPPING. 43.5% of props carry a >=1 point cross-book range. Betting the
      most favourable number available is mechanically better than betting consensus,
      and the panel prices each side at the book that actually offered it.

Grading discipline (memory: nfl-backtest-grading-framework): a bet placed at the best
line is graded against THAT line at THAT book's price. Consensus bets are graded at the
consensus line and consensus price. The two are never mixed.

Everything is broken out per season, because pooled numbers hide late-sample decay.
"""
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def roi(win, dec):
    """Units returned per unit staked at real decimal odds."""
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def grade(D, side, line_col, dec_col, y_col, mask=None):
    """side: 'over' or 'under'. y_col is 1 when the OVER wins at line_col."""
    m = D[y_col].notna() & D[dec_col].notna() & D[line_col].notna()
    if mask is not None:
        m = m & mask
    if m.sum() == 0:
        return 0, np.nan, np.nan
    y = D.loc[m, y_col].values
    win = y if side == "over" else 1 - y
    return int(m.sum()), 100 * win.mean(), roi(win, D.loc[m, dec_col].values)


def main():
    D = pd.read_parquet(f"{OUT}/nba_props_panel.parquet")
    D = D.rename(columns={"season_x": "season"})
    seasons = sorted(D["season"].unique())
    L = ["# NBA player props — pre-model baselines", "",
         f"{len(D):,} props, seasons {seasons}, 10 markets, T-60 prices, median hold "
         f"{100*D['cons_hold'].median():.2f}%.", "",
         "Consensus bets graded at the consensus line and price; best-line bets graded at "
         "the book that offered that line, at its own price. Never mixed.", ""]

    # ------------------------------------------------------------------ H1 under bias
    L += ["## H1 — blind side bias at the CONSENSUS line\n",
          "| side | n | win% | ROI | per-season win% |", "|---|---|---|---|---|"]
    for side in ("over", "under"):
        n, w, r = grade(D, side, "cons_line", f"cons_{side}_dec", "y_cons")
        per = []
        for s in seasons:
            _, ws, _ = grade(D, side, "cons_line", f"cons_{side}_dec", "y_cons",
                             mask=(D["season"] == s))
            per.append(f"{ws:.1f}")
        L.append(f"| blind {side.upper()} | {n:,} | {w:.2f} | {r:+.2f} | {'/'.join(per)} |")

    L += ["\n### H1 by market (blind UNDER at consensus)\n",
          "| market | n | win% | ROI | per-season ROI |", "|---|---|---|---|---|"]
    for mk in sorted(D["market"].unique()):
        mm = D["market"] == mk
        n, w, r = grade(D, "under", "cons_line", "cons_under_dec", "y_cons", mask=mm)
        per = []
        for s in seasons:
            _, _, rs = grade(D, "under", "cons_line", "cons_under_dec", "y_cons",
                             mask=mm & (D["season"] == s))
            per.append(f"{rs:+.1f}")
        L.append(f"| {mk} | {n:,} | {w:.2f} | {r:+.2f} | {'/'.join(per)} |")

    # ------------------------------------------------------------------ H2 shopping
    L += ["\n## H2 — best available line vs consensus\n",
          "| bet | n | win% | ROI | per-season ROI |", "|---|---|---|---|---|"]
    rows = [("OVER at consensus", "over", "cons_line", "cons_over_dec", "y_cons"),
            ("OVER at best line", "over", "best_over_line", "best_over_dec", "y_best_over"),
            ("UNDER at consensus", "under", "cons_line", "cons_under_dec", "y_cons"),
            ("UNDER at best line", "under", "best_under_line", "best_under_dec",
             "y_best_under")]
    for nm, side, lc, dc, yc in rows:
        n, w, r = grade(D, side, lc, dc, yc)
        per = []
        for s in seasons:
            _, _, rs = grade(D, side, lc, dc, yc, mask=(D["season"] == s))
            per.append(f"{rs:+.1f}")
        L.append(f"| {nm} | {n:,} | {w:.2f} | {r:+.2f} | {'/'.join(per)} |")

    # how much is the shopping worth, conditional on there BEING a disagreement?
    L += ["\n### H2 by size of the cross-book disagreement (UNDER at best line)\n",
          "| line range | n | win% | ROI | per-season ROI |", "|---|---|---|---|---|"]
    for lo, hi, lbl in ((0, 0.01, "0 (books agree)"), (0.01, 1.0, "0-1"),
                        (1.0, 1.51, "1-1.5"), (1.51, 99, "1.5+")):
        mm = (D["line_range"] >= lo) & (D["line_range"] < hi)
        n, w, r = grade(D, "under", "best_under_line", "best_under_dec", "y_best_under",
                        mask=mm)
        per = []
        for s in seasons:
            _, _, rs = grade(D, "under", "best_under_line", "best_under_dec",
                             "y_best_under", mask=mm & (D["season"] == s))
            per.append(f"{rs:+.1f}")
        L.append(f"| {lbl} | {n:,} | {w:.2f} | {r:+.2f} | {'/'.join(per)} |")

    # ------------------------------------------- H1 x H2: shade the number AND shop it
    L += ["\n## H1 x H2 — UNDER at the best line, by market\n",
          "| market | n | win% | ROI | per-season ROI |", "|---|---|---|---|---|"]
    for mk in sorted(D["market"].unique()):
        mm = D["market"] == mk
        n, w, r = grade(D, "under", "best_under_line", "best_under_dec", "y_best_under",
                        mask=mm)
        per = []
        for s in seasons:
            _, _, rs = grade(D, "under", "best_under_line", "best_under_dec",
                             "y_best_under", mask=mm & (D["season"] == s))
            per.append(f"{rs:+.1f}")
        L.append(f"| {mk} | {n:,} | {w:.2f} | {r:+.2f} | {'/'.join(per)} |")

    # ------------------------------------------------------- is the bias a price story?
    # If books shade the LINE, the under bias should persist after conditioning on the
    # de-vigged price. If it is only a favourite-longshot artifact of proportional
    # de-vigging, it should vanish in the middle buckets.
    L += ["\n## H1 diagnostic — under ROI by de-vigged market P(over)\n",
          "| P(over) | n | under win% | under ROI |", "|---|---|---|---|"]
    for lo, hi in ((0, .40), (.40, .45), (.45, .48), (.48, .50), (.50, .52), (.52, .55),
                   (.55, .60), (.60, 1.01)):
        mm = (D["cons_p_over"] >= lo) & (D["cons_p_over"] < hi)
        n, w, r = grade(D, "under", "cons_line", "cons_under_dec", "y_cons", mask=mm)
        L.append(f"| {lo:.2f}-{hi:.2f} | {n:,} | {w:.2f} | {r:+.2f} |")

    # ------------------------------------------------------------------ line vs form
    L += ["\n## Does the line already contain the player's recent form?\n",
          "| line - L5 form | n | under win% | under ROI |", "|---|---|---|---|"]
    q = D["line_vs_form"]
    for lo, hi, lbl in ((-99, -2, "< -2 (line well under form)"), (-2, -0.5, "-2..-0.5"),
                        (-0.5, 0.5, "-0.5..0.5"), (0.5, 2, "0.5..2"),
                        (2, 99, "> 2 (line well over form)")):
        mm = (q >= lo) & (q < hi)
        n, w, r = grade(D, "under", "cons_line", "cons_under_dec", "y_cons", mask=mm)
        L.append(f"| {lbl} | {n:,} | {w:.2f} | {r:+.2f} |")

    path = os.path.join(ROOT, "NBA_PROPS_BASELINE_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
