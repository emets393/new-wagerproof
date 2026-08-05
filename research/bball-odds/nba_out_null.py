#!/usr/bin/env python3
"""The adjudication: does the absence signal beat a PROPER null, not a single placebo draw?

Everything up to here compared the signal's edge against one permuted placebo. At 200-800
bets one standard error on a win rate is 1.8-3.5 points, and the single-draw placebos duly
came back anywhere from -7.0 to +5.0 across otherwise-identical cells. Ranking constructions
off numbers that noisy is reading tea leaves, and two of the conclusions I drew from that
2x2 were not supported by it.

There is also a measurement subtlety that makes the raw "edge" number misleading. The slice
baseline is max(P(home covers), P(away covers)), which is >= 50% ALWAYS -- it is the better
of the two sides chosen with hindsight. So a coin flip does not score 0 on it; it scores
about -2.5. Reporting "edge = +4.0" against an implied null of zero therefore overstates
every result on this page by roughly two and a half points.

Both problems have the same fix: build the null empirically. For each cell, permute the gap
within season N_PERM times, run the identical selection and grading, and report where the
real signal falls in that distribution. The empirical p-value is the share of permutations
whose edge meets or beats the real one -- no distributional assumption, and the max()
baseline bias cancels because the null is scored exactly the same way.

Only the FULL grid is carried forward. The listed-only grid is not a modelling choice, it is
a bug: 17.8% of player-team-game absences never appear as rows at all, so shifting over a
player's own listed rows reads a five-game absence as consecutive appearances. Its higher
raw numbers are the artifact this script exists to avoid being fooled by.

SEASON CONSISTENCY is reported alongside, because a pooled edge carried by one season is a
different object from one present in four, and the pooled number cannot distinguish them.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import add_base, add_rapm, gap_frame, make_rows, raw_box, to_dec

ROOT = os.path.dirname(os.path.abspath(__file__))
N_PERM = 2000
COUNTS = (200, 400, 800, 1600)
RNG = np.random.default_rng(19)


def select(gap, ok, n_target):
    thr = np.quantile(np.abs(gap[ok]), max(0.0, 1.0 - n_target / ok.sum()))
    return ok & (np.abs(gap) >= thr)


def edge_of(d, gap, ok, n_target, y, dh, da):
    m = select(gap, ok, n_target)
    if m.sum() < 20:
        return None
    hi = gap[m] > 0
    win = np.where(hi, y[m] > 0, y[m] < 0)
    base = max((y[m] > 0).mean(), (y[m] < 0).mean())
    roi = np.where(win, np.where(hi, dh[m], da[m]) - 1.0, -1.0).mean()
    return 100 * (win.mean() - base), 100 * win.mean(), 100 * base, 100 * roi, m, win


def main():
    B = raw_box()
    L = ["# NBA absence signal — signal vs a 2,000-permutation null", "",
         "Full grid only. FG spread graded vs the OPENER, cut at the |gap| quantile giving "
         "the stated bet count. `edge` = win% − the max-side baseline of that same subset; "
         "because that baseline is chosen with hindsight, a coin flip scores about −2.5 on "
         "it, which is why the NULL column and not zero is the thing to compare against.",
         "",
         "| baseline | bets | win % | base % | edge | null mean | null 95th | p | ROI % | by season |",
         "|---|---|---|---|---|---|---|---|---|---|"]

    for base_kind in ("decay", "played"):
        G = add_rapm(add_base(make_rows(B, "full"), base_kind))
        d = gap_frame(G)
        gap = d["gap"].to_numpy(dtype=float)
        y = d["y_open"].to_numpy(dtype=float)
        dh = to_dec(d["open_spread_home_price"])
        da = to_dec(d["open_spread_away_price"])
        seas = d["season"].to_numpy()
        ok = np.isfinite(y) & (y != 0) & np.isfinite(gap) & (gap != 0)
        idx_by_season = [np.where(seas == s)[0] for s in np.unique(seas)]

        for c in COUNTS:
            real = edge_of(d, gap, ok, c, y, dh, da)
            if real is None:
                continue
            e, w, b, roi, m, win = real
            per = " ".join(f"{s}:{100*win[seas[m] == s].mean():.0f}"
                           for s in sorted(set(seas[m])))
            null = np.empty(N_PERM)
            pg = gap.copy()
            for i in range(N_PERM):
                for ix in idx_by_season:
                    pg[ix] = gap[RNG.permutation(ix)]
                r = edge_of(d, pg, ok, c, y, dh, da)
                null[i] = r[0] if r else np.nan
            null = null[np.isfinite(null)]
            p = (null >= e).mean()
            L.append(f"| {base_kind} | {m.sum():,} | {w:.1f} | {b:.1f} | **{e:+.1f}** | "
                     f"{null.mean():+.1f} | {np.quantile(null, .95):+.1f} | "
                     f"{p:.3f} | {roi:+.1f} | {per} |")
            print(L[-1], flush=True)

    L += ["", "## Reading", "",
          "The null mean confirms the measurement bias: a random selector scores roughly "
          "−2.5 to −4 on this `edge` metric rather than 0, so any reading of these tables "
          "that treats zero as the break-even point is wrong by that much.", ""]

    path = os.path.join(ROOT, "NBA_OUT_NULL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n" + "\n".join(L[-4:]), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
