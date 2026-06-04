"""
Per-game LINE SIGNALS from the odds archive — the inputs to all market-microstructure spots.
Keyed by (season, home, away) in CFBD names. Covers 2021-2025 (and 2026+ once odds are pulled).

Provides:
  soft_gap   = sharp_close - soft_close   (line DISCREPANCY; <0 sharp leans HOME)  [book_consensus_blend]
  sharp_close, soft_close (consensus close home-spreads), n_sharp, n_soft
  soft_best_home / soft_best_away  (best soft number on each side — line-shop execution price)
  dk_sp_close (DraftKings close home-spread), dk_tot_close                          [dk_numbers]
  sp_early, sp_late  (open->24h, 24h->close spread move; for the REVERSAL veto)      [phase1b]

Sharp books = {williamhill_us, twinspires, draftkings}; Soft = {bovada, mybookieag}.
If the odds archive is absent for a season the columns come back NaN and dependent spots simply don't fire.
"""
import os, glob
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
SHARP = ["williamhill_us", "twinspires", "draftkings"]
SOFT = ["bovada", "mybookieag"]
ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
         "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
         "Southern Miss Golden Eagles": "Southern Miss"}


def _to_cfbd(o, names):
    if o in ALIAS: return ALIAS[o]
    c = [x for x in names if o.startswith(x + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None


def build(cfbd_names):
    """Return a DataFrame keyed (season, home, away) with the line-signal columns. cfbd_names = the
    universe of CFBD team names (to map Odds-API names)."""
    files = glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet"))
    cols = ["season", "home", "away"]
    if not files:
        return pd.DataFrame(columns=cols)
    parts = []
    for f in files:
        yr = int(os.path.basename(f).split("_")[1].split(".")[0])
        d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
    od = pd.concat(parts, ignore_index=True)
    od["home"] = od.home_team.map(lambda x: _to_cfbd(x, cfbd_names))
    od["away"] = od.away_team.map(lambda x: _to_cfbd(x, cfbd_names))
    od = od.dropna(subset=["home", "away", "hrs_to_kick", "spread_home"])
    od = od[od.hrs_to_kick >= 0]

    # CLOSE = last pre-kick (<12h) snapshot per (game, book)
    close = od[od.hrs_to_kick < 12].copy()
    ci = close.groupby(["season", "game_id", "book"]).hrs_to_kick.idxmin()
    cl = close.loc[ci]

    def blend(books, **agg):
        sub = cl[cl.book.isin(books)]
        return sub.groupby(["season", "home", "away"]).agg(**agg)

    sh = blend(SHARP, sharp_close=("spread_home", "median"), n_sharp=("book", "nunique"))
    sf = blend(SOFT, soft_close=("spread_home", "median"), n_soft=("book", "nunique"),
               soft_best_home=("spread_home", "max"), soft_best_away=("spread_home", "min"))
    out = sh.join(sf, how="outer")
    out["soft_gap"] = out.sharp_close - out.soft_close

    # DraftKings close (home spread + total)
    dk = cl[cl.book == "draftkings"].groupby(["season", "home", "away"]).agg(
        dk_sp_close=("spread_home", "median"), dk_tot_close=("total", "median"))
    out = out.join(dk, how="outer")

    # reversal windows (open->24h early, 24h->close late) from movement_windows
    mwp = os.path.join(HERE, "data", "movement_windows.parquet")
    if os.path.exists(mwp):
        mw = pd.read_parquet(mwp)
        mw["sp_early"] = mw.sp_h24 - mw.sp_open
        mw["sp_late"] = mw.sp_close - mw.sp_h24
        out = out.join(mw.set_index(["season", "home", "away"])[["sp_early", "sp_late"]], how="outer")

    return out.reset_index()
