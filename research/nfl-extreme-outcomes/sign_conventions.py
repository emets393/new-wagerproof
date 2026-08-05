"""CANONICAL LINE-SIGN CONVENTIONS + mandatory sanity asserts. Import this in EVERY grading script.

A flipped spread sign silently converts "covers" into "wins" and produces plausible-looking 60-75%
garbage. Two bugs have shipped from this. The fix is structural: (1) one reference table for every
source's convention, (2) assert_ats_sane() — favorites must cover ~44-56% of a big sample; a flipped
sign reads ~70-80% and the assert kills the run.

CONVENTIONS (verified in-data 2026-08-02):
  nflverse games.csv `spread_line`      : >0 = HOME FAVORED by that much.
      home ATS margin = result - spread_line          (result = home_score - away_score)
      away ATS margin = -result + spread_line
      favorite covers check: home fav when spread_line>0.
  slate tables `fg_spread_close` (nfl/cfb_slate_games, Odds-API derived): HOME-PERSPECTIVE line.
      <0 = home favored (e.g. -27.5 = home lays 27.5). home covers iff (final_home-final_away) + fg_spread_close > 0.
      NOTE: OPPOSITE meaning of sign vs nflverse. Never mix without converting.
  Odds API raw (`nfl_historical_odds.spread_home`, `ncaaf_odds_history.spread_home`): HOME-PERSPECTIVE
      (same as slate: negative = home favored).
  Odds API totals: over wins iff actual_total > total_point/total_line (no sign trap).
  Moneyline American odds: negative = favorite; convert via amer_profit before any averaging.
"""
import numpy as np
import pandas as pd


def ats_margin_nflverse(result, spread_line, home=True):
    """ATS margin from nflverse convention (spread_line>0 = home favored)."""
    return (result - spread_line) if home else (-result + spread_line)


def ats_margin_slate(final_home, final_away, fg_spread_close, home=True):
    """ATS margin from slate/Odds-API home-perspective convention (<0 = home favored)."""
    m = (final_home - final_away) + fg_spread_close
    return m if home else -m


def assert_ats_sane(df, margin_col, fav_mask, min_n=300, lo=0.43, hi=0.57, label=""):
    """MANDATORY before trusting any ATS grading. fav_mask = rows where the graded team is the
    favorite. Favorites cover ~47-50% long-run; a flipped sign reads ~70-80% (or ~20-30%).
    Raises on violation. Returns the observed favorite cover rate."""
    d = df.dropna(subset=[margin_col])
    d = d[d[margin_col] != 0]
    f = d[fav_mask.reindex(d.index, fill_value=False)]
    if len(f) < min_n:
        print(f"[sign-check{' ' + label if label else ''}] n={len(f)} favorites < {min_n} — SKIPPED (thin), verify manually")
        return np.nan
    rate = (f[margin_col] > 0).mean()
    assert lo <= rate <= hi, (
        f"SIGN BUG{' ' + label if label else ''}: favorites cover {rate:.1%} (expected ~47-50%). "
        f"The ATS margin sign is almost certainly flipped — check the source convention in sign_conventions.py")
    print(f"[sign-check{' ' + label if label else ''}] favorites cover {rate:.1%} on n={len(f)} — sane")
    return rate
