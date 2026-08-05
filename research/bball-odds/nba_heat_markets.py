#!/usr/bin/env python3
"""Does concentrated player heat pay in markets OTHER than the full-game spread?

S10 was graded on the FG spread only. That is a gap, because every other NBA edge in
BBALL_SIGNALS.md lives in the FIRST-HALF derivative -- S7 (shared 1H-total streak fade,
61.9%) and S8 (moderate-absence 1H spread, 60.9%) both dwarf anything found on the full
game. If shot-location regression is real, the 1H is where it should show up largest: the
market prices halves more lazily, and a hot player's unsustainable finishing is front-loaded
into the minutes he actually plays, which skew early.

Four markets, one rule:

  FG spread    the known result. This is the CONTROL ROW -- if the harness does not
               reproduce ~54% here, the join or the grading is broken and nothing else
               on the page can be read.
  FG total     never tested.
  1H spread    never tested.
  1H total     never tested.

DIRECTION, and this is the part that is easy to get wrong. For a SIDE, the relevant
quantity is the heat DIFFERENTIAL (home minus away) -- one team is due to regress relative
to the other. For a TOTAL it is the heat SUM: the total goes under when BOTH teams are
shooting above their own sustainable rates, and a differential is blind to that by
construction (two equally hot teams net to zero). Using d_p_heat for totals would be a
silent bug that still produces plausible-looking numbers.

NO PARAMETER IS FITTED HERE. The HHI and heat cuts are frozen from the FG-spread training
seasons and applied blind to every market. That is deliberately stricter than a per-market
walk-forward: it spends no test season on tuning, and a rule that only works with
market-specific thresholds is a rule that was fitted to the market. 1H lines cover fewer
seasons than the heat frame, so the 1H rows are thinner -- reported per season, never pooled
into a single flattering number.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import to_dec
from nba_player_model import load_all

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
N_PERM = 20000
RNG = np.random.default_rng(83)

TRAIN_SEASONS = (2022, 2023)     # thresholds come from here and nowhere else
HHI_Q = 0.60                     # quantile of conc_drv
HEAT_Q = 0.60                    # bet the top 40% of |heat| inside the concentrated cell


def build():
    # load_all() ALREADY carries the 1H consensus close (h1_spread / h1_total_line /
    # h1_sp_h / h1_sp_a / h1_ov / h1_un), decimal-median across books, on 3,659 games.
    # Verified identical to a fresh median over h1tt_nba_*.parquet, so do not re-merge it:
    # doing so silently suffixes both copies to _x/_y and the real column disappears.
    d = load_all()
    g = pd.read_parquet(f"{OUT}/games_nba.parquet")
    keep = [c for c in ("event_id", "home_h1", "away_h1") if c in g.columns]
    d = d.merge(g[keep].drop_duplicates("event_id"), on="event_id", how="left")

    # 1H outcomes, home perspective. h1_spread is the HOME number, so adding it to the
    # home margin gives >0 = home covers, matching y_open/y_t60 sign convention.
    d["y_h1_sp"] = (d["home_h1"] - d["away_h1"]) + d["h1_spread"]
    d["y_h1_ou"] = (d["home_h1"] + d["away_h1"]) - d["h1_total_line"]
    d["y_fg_ou"] = d["y_fg_total"] - pd.to_numeric(d["t60_total_point"], errors="coerce")
    return d


# market -> (outcome, price if betting POSITIVE side, price if NEGATIVE, kind)
# for spreads positive = home covers; for totals positive = over
MARKETS = {
    # y_fg_marg_resid is the FG margin residual vs the T-60 spread (MKT["T-60"] in
    # nba_regression_model), i.e. >0 = home covers the close. Same convention as the 1H cols.
    "FG spread (control)": ("y_fg_marg_resid", "t60_spread_home_price",
                            "t60_spread_away_price", "side"),
    "FG total":            ("y_fg_ou", "t60_total_over_price", "t60_total_under_price", "tot"),
    "1H spread":           ("y_h1_sp", "h1_sp_h", "h1_sp_a", "side"),
    "1H total":            ("y_h1_ou", "h1_ov", "h1_un", "tot"),
}


def signal(d, kind):
    """Heat quantity and the side it implies. Differential for sides, SUM for totals."""
    if kind == "side":
        s = d["d_p_heat"].to_numpy(dtype=float)
        return s, -np.sign(s)            # fade the hotter team
    s = (d["hp_p_heat"].to_numpy(dtype=float) + d["ap_p_heat"].to_numpy(dtype=float))
    return s, -np.sign(s)                # both teams hot -> under


def thresholds(d, kind):
    """Frozen on TRAIN_SEASONS only."""
    tr = d[d["season"].isin(TRAIN_SEASONS)]
    conc = tr["conc_drv"].to_numpy(dtype=float)
    s, _ = signal(tr, kind)
    ok = np.isfinite(conc) & np.isfinite(s) & (s != 0)
    hthr = np.quantile(conc[ok], HHI_Q)
    q = ok & (conc > hthr)
    return hthr, np.quantile(np.abs(s[q]), HEAT_Q)


def run(d, label, spec, L):
    ycol, ppos, pneg, kind = spec
    y = pd.to_numeric(d[ycol], errors="coerce").to_numpy(dtype=float)
    dp, dn = to_dec(d[ppos]), to_dec(d[pneg])
    conc = d["conc_drv"].to_numpy(dtype=float)
    s, side = signal(d, kind)
    hthr, sthr = thresholds(d, kind)

    ok = (np.isfinite(y) & (y != 0) & np.isfinite(dp) & np.isfinite(dn)
          & np.isfinite(conc) & np.isfinite(s) & (s != 0))
    m = ok & (conc > hthr) & (np.abs(s) >= sthr) & ~d["season"].isin(TRAIN_SEASONS).to_numpy()
    if m.sum() < 40:
        L.append(f"| {label} | {int(m.sum())} | — | — | — | — | too few OOS bets |")
        print(L[-1], flush=True)
        return

    win = np.where(side[m] > 0, y[m] > 0, y[m] < 0)
    dec = np.where(side[m] > 0, dp[m], dn[m])
    roi = np.where(win, dec - 1.0, -1.0).mean()
    base = max((y[m] > 0).mean(), (y[m] < 0).mean())
    nul = RNG.binomial(len(win), base, N_PERM) / len(win)
    seas = d["season"].to_numpy()[m]
    per = " ".join(f"{t}:{100*win[seas == t].mean():.0f}" for t in sorted(set(seas)))
    L.append(f"| {label} | {len(win)} | {100*win.mean():.1f} | {100*base:.1f} | "
             f"**{100*(win.mean()-base):+.1f}** | {100*roi:+.1f} | {per} | "
             f"{(nul >= win.mean()).mean():.3f} |")
    print(L[-1], flush=True)


def main():
    d = build()
    n1 = int(np.isfinite(pd.to_numeric(d["y_h1_sp"], errors="coerce")).sum())
    L = ["# Concentrated player heat across NBA markets", "",
         f"n = {len(d):,} games; {n1:,} have a 1H line and 1H scores. Thresholds frozen on "
         f"seasons {TRAIN_SEASONS} (HHI p{int(HHI_Q*100)}, heat p{int(HEAT_Q*100)}) and "
         "applied blind to every market. Only NON-training seasons are bet.", "",
         "`edge` = win rate minus THIS SLICE's own baseline. Totals use the heat SUM "
         "(both teams regressing), sides the heat DIFFERENTIAL. `p` = chance the slice "
         "baseline produces this win rate by luck at this bet count.", "",
         "| market | OOS bets | win % | base % | edge | ROI % | by season | p |",
         "|---|---|---|---|---|---|---|---|"]
    for label, spec in MARKETS.items():
        run(d, label, spec, L)

    path = os.path.join(ROOT, "NBA_HEAT_MARKETS_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
