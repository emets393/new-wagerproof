"""Re-run the K-signal reval using the TRUE actionable-close snapshots backfilled
by actionable_backfill.py (real lines at T-65 / T-120), instead of the sparse-
cadence proxy in reval_actionable_close.py.

open  = first pre-kick snapshot from odds_hist (the genuine opener)
close = the single backfilled snapshot (odds_hist_t65.parquet ~T-69, or _t120 ~T-124)

Reuses run_signals/report from reval_actionable_close so the trigger+grade logic
is byte-identical; only the line source changes.
"""
import numpy as np
import pandas as pd
from pathlib import Path

from reval_actionable_close import (MARKETS, payout, CITY_NAMES, run_signals,
                                    report, build_frame)

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"


def consensus(df, suffix):
    """Collapse per-book snapshot rows -> one consensus row per game, columns
    named '{mkt}_{suffix}_{linecol}' / '{mkt}_{suffix}_pay_{pricecol}'."""
    df = df.copy()
    df["snap_dt"] = pd.to_datetime(df.snap_ts, utc=True, format="ISO8601")
    comm = pd.to_datetime(df.commence_time, utc=True, format="ISO8601")
    df["gameday"] = comm.dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d")
    df["home_ab"] = df.home_team.map(CITY_NAMES)
    df["away_ab"] = df.away_team.map(CITY_NAMES)
    for c in ["spread_home_price", "spread_away_price", "total_over_price",
              "total_under_price", "h1_spread_home_price", "h1_spread_away_price",
              "h1_total_over_price", "h1_total_under_price",
              "tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"]:
        if c in df:
            df[f"pay__{c}"] = payout(df[c])
    gk = ["season", "gameday", "home_ab", "away_ab"]
    frames = []
    for mkt, (lines, prices) in MARKETS.items():
        anchor = lines[0] if lines else prices[0]
        if anchor not in df:
            continue
        sub = df[df[anchor].notna()]
        if not len(sub):
            continue
        agg = {c: (c, "median") for c in lines if c in df}
        agg.update({f"pay__{c}": (f"pay__{c}", "median") for c in prices if f"pay__{c}" in df})
        cons = sub.groupby(gk).agg(**agg).reset_index()
        ren = {c: f"{mkt}_{suffix}_{c.replace('pay__', 'pay_')}"
               for c in cons.columns if c not in gk}
        frames.append(cons.rename(columns=ren).set_index(gk))
    return pd.concat(frames, axis=1).reset_index()


def build_true_frame(close_parquet):
    """open from odds_hist first pre-kick snapshot; close from the backfilled snapshot."""
    oh = pd.read_parquet(DATA / "odds_hist.parquet")
    oh["snap_dt"] = pd.to_datetime(oh.snap_ts, utc=True, format="ISO8601")
    comm = pd.to_datetime(oh.commence_time, utc=True, format="ISO8601")
    oh = oh[oh.snap_dt < comm]
    # OPEN = earliest snapshot per game: keep only each game's first snap_dt rows
    oh["gameday"] = comm.dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d")
    oh["home_ab"] = oh.home_team.map(CITY_NAMES); oh["away_ab"] = oh.away_team.map(CITY_NAMES)
    firsts = oh.groupby(["season", "gameday", "home_ab", "away_ab"]).snap_dt.transform("min")
    open_rows = oh[oh.snap_dt == firsts]
    open_cons = consensus(open_rows, "open")

    close_df = pd.read_parquet(DATA / close_parquet)
    close_cons = consensus(close_df, "close")

    wide = open_cons.merge(close_cons, on=["season", "gameday", "home_ab", "away_ab"], how="inner")

    q = pd.read_parquet(DATA / "quarter_scores.parquet")
    g = pd.read_parquet(DATA / "nflverse_games.parquet")
    g["gameday"] = pd.to_datetime(g.gameday).dt.strftime("%Y-%m-%d")
    q = q.merge(g[["game_id", "gameday"]], on="game_id", how="left")
    out = wide.merge(q.rename(columns={"home_team": "home_ab", "away_team": "away_ab"}),
                     on=["season", "gameday", "home_ab", "away_ab"], how="inner")
    return out


if __name__ == "__main__":
    print("BASELINE (true close, last pre-kick ~T-34) for reference:")
    rc = run_signals(build_frame(0))
    report("BASELINE — true close ~T-34", rc)

    for cut, parq in [("T-65 (~T-69 actual)", "odds_hist_t65.parquet"),
                      ("T-120 (~T-124 actual)", "odds_hist_t120.parquet")]:
        if not (DATA / parq).exists():
            print(f"\n[skip] {parq} not built yet"); continue
        f = build_true_frame(parq)
        ra = run_signals(f)
        report(f"ACTIONABLE — real backfilled close {cut}  (games={len(f)})", ra)
        print(f"\n  DELTA vs baseline ({cut}):")
        print(f"  {'signal':30s} {'base hit/n':>13s} {'act hit/n':>13s} {'Δhit':>7s} {'Δroi':>7s}")
        for sig in sorted(set(rc.signal) | set(ra.signal)):
            sc = rc[rc.signal == sig].dropna(subset=["win"]); sc = sc[np.isfinite(sc.roi)]
            sa = ra[ra.signal == sig].dropna(subset=["win"]); sa = sa[np.isfinite(sa.roi)]
            if not len(sc) or not len(sa):
                continue
            print(f"  {sig:30s} {sc.win.mean()*100:5.1f}%/{len(sc):<5d} "
                  f"{sa.win.mean()*100:5.1f}%/{len(sa):<5d} "
                  f"{(sa.win.mean()-sc.win.mean())*100:+6.1f} "
                  f"{(sa.roi.mean()-sc.roi.mean())*100:+6.1f}")
    print("\n[done]")
