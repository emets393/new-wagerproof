#!/usr/bin/env python3
"""Shared NCAAB market frame — one game per row, every market, outcomes pre-graded.

The college analogue of nba_luck_sweep.load(). Both the player-heat port and the team-luck
port grade against this, so a difference between the two studies can never be a difference
in how the games were joined or how a cover was scored.

23,031 games with prices across four seasons, against the NBA's 5,278. That ratio is the
whole reason to run the NBA nulls again over here: a rule that needs 800 bets to show itself
has four times the room to do it, and college is the market where we have already proven
absences go unpriced (S1, +10.4%) while the identical NBA signal dies at the close.

SIGN CONVENTION, identical to the NBA files: every outcome is HOME-positive for sides and
OVER-positive for totals, so `y > 0` always means "the positive side won" and a signal's
side can be carried as a plain +1/-1 without per-market special cases.
"""
import glob
import os

import numpy as np
import pandas as pd

from nba_out_isolate import to_dec

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

# market -> (outcome, price when betting POSITIVE, price when NEGATIVE, family)
MARKETS = {
    "FG spread OPEN": ("y_sp_open", "open_spread_home_price", "open_spread_away_price", "side"),
    "FG spread T-60": ("y_sp_t60", "t60_spread_home_price", "t60_spread_away_price", "side"),
    "FG total OPEN":  ("y_tot_open", "open_total_over_price", "open_total_under_price", "tot"),
    "FG total T-60":  ("y_tot_t60", "t60_total_over_price", "t60_total_under_price", "tot"),
    "1H spread":      ("y_h1_sp", "h1_sp_h", "h1_sp_a", "side"),
    "1H total":       ("y_h1_tot", "h1_ov", "h1_un", "tot"),
    "team total HOME": ("y_tt_h", "tt_h_ov", "tt_h_un", "tt_h"),
    "team total AWAY": ("y_tt_a", "tt_a_ov", "tt_a_un", "tt_a"),
}


def load():
    g = pd.read_parquet(f"{OUT}/games_ncaab.parquet")
    g = g.sort_values("commence_time").drop_duplicates("event_id")
    mv = pd.read_parquet(f"{OUT}/movement_games_ncaab.parquet").drop_duplicates("event_id")
    # movement_games carries its own copy of teams/scores/season. Keep the games-table copy as
    # the single truth so nothing downstream has to guess between an _x and a _y column.
    dup = [c for c in mv.columns if c in g.columns and c != "event_id"]
    G = g.merge(mv.drop(columns=dup), on="event_id", how="inner")

    # 1H and team-total consensus close: median ACROSS BOOKS in decimal space. Doing this in
    # American odds is wrong -- the scale is discontinuous across +100/-100, so a median of
    # -110 and +105 lands nowhere sensible. Same rule as the NBA files.
    files = sorted(glob.glob(f"{OUT}/h1tt_ncaab_*.parquet"))
    h = pd.concat([pd.read_parquet(p) for p in files], ignore_index=True)
    for c in ("h1_ml_home_price", "h1_ml_away_price",
              "h1_spread_home_price", "h1_spread_away_price", "h1_total_over_price",
              "h1_total_under_price", "tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"):
        h[c] = to_dec(h[c])
    cons = h.groupby("event_id").agg(
        # The first-half MONEYLINE is carried here but deliberately left out of MARKETS: adding a
        # ninth entry would silently change the output of every study that iterates the dict.
        # 82% covered on three seasons, and it is a market the NBA cannot grade at all -- there is
        # no NBA 1H moneyline in the odds archive. `cbb_panel.py` grades it.
        h1_ml_h=("h1_ml_home_price", "median"),
        h1_ml_a=("h1_ml_away_price", "median"),
        h1_spread=("h1_spread_home_point", "median"),
        h1_sp_h=("h1_spread_home_price", "median"),
        h1_sp_a=("h1_spread_away_price", "median"),
        h1_total=("h1_total_point", "median"),
        h1_ov=("h1_total_over_price", "median"),
        h1_un=("h1_total_under_price", "median"),
        tt_h=("tt_home_point", "median"),
        tt_h_ov=("tt_home_over_price", "median"),
        tt_h_un=("tt_home_under_price", "median"),
        tt_a=("tt_away_point", "median"),
        tt_a_ov=("tt_away_over_price", "median"),
        tt_a_un=("tt_away_under_price", "median")).reset_index()
    G = G.merge(cons, on="event_id", how="left")

    marg = G["home_score"] - G["away_score"]
    tot = G["home_score"] + G["away_score"]
    G["y_sp_open"] = marg + pd.to_numeric(G["open_spread_home_point"], errors="coerce")
    G["y_sp_t60"] = marg + pd.to_numeric(G["t60_spread_home_point"], errors="coerce")
    G["y_tot_open"] = tot - pd.to_numeric(G["open_total_point"], errors="coerce")
    G["y_tot_t60"] = tot - pd.to_numeric(G["t60_total_point"], errors="coerce")
    G["y_h1_sp"] = (G["home_h1"] - G["away_h1"]) + G["h1_spread"]
    G["y_h1_tot"] = (G["home_h1"] + G["away_h1"]) - G["h1_total"]
    G["y_tt_h"] = G["home_score"] - G["tt_h"]
    G["y_tt_a"] = G["away_score"] - G["tt_a"]
    return G


def usable(G, sig, mkt):
    """Rows where the market, the outcome and the signal all exist and the bet is not a push."""
    ycol, ppos, pneg, _ = MARKETS[mkt]
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)
    dp = np.asarray(to_dec(G[ppos]), dtype=float)
    dn = np.asarray(to_dec(G[pneg]), dtype=float)
    s = pd.to_numeric(sig, errors="coerce").to_numpy(float)
    return (np.isfinite(y) & (y != 0) & np.isfinite(dp) & np.isfinite(dn)
            & np.isfinite(s) & (s != 0))


def grade(G, mkt, m, side, rng=None, n_perm=20000):
    """Grade a boolean mask at real prices.

    `base` is the max-side rate INSIDE the selection, never 50%. The owner has been burned by
    a 54% headline sitting on a 53.7% slice; every number this returns carries its own
    comparator so that cannot happen silently.
    """
    ycol, ppos, pneg, _ = MARKETS[mkt]
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)
    dp = np.asarray(to_dec(G[ppos]), dtype=float)
    dn = np.asarray(to_dec(G[pneg]), dtype=float)
    side = np.asarray(side, dtype=float)
    win = np.where(side[m] > 0, y[m] > 0, y[m] < 0)
    dec = np.where(side[m] > 0, dp[m], dn[m])
    roi = np.where(win, dec - 1.0, -1.0).mean()
    base = max((y[m] > 0).mean(), (y[m] < 0).mean())
    p = np.nan
    if rng is not None:
        nul = rng.binomial(len(win), base, n_perm) / len(win)
        p = float((nul >= win.mean()).mean())
    seas = G["season"].astype(str).to_numpy()[m]
    per = " ".join(f"{t[-2:]}:{100*win[seas == t].mean():.0f}"
                   for t in sorted(set(seas)) if (seas == t).sum() >= 25)
    return dict(n=int(m.sum()), win=100 * win.mean(), base=100 * base,
                edge=100 * (win.mean() - base), roi=100 * roi, per=per, p=p)


if __name__ == "__main__":
    G = load()
    print(f"{len(G):,} games; seasons {sorted(G['season'].astype(str).unique())}")
    for mkt in MARKETS:
        n = int(usable(G, pd.Series(1.0, index=G.index), mkt).sum())
        print(f"  {mkt:<18} {n:>7,} gradeable")
