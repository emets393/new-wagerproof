#!/usr/bin/env python3
"""
Raw 2H quotes -> one row per game: halftime OPEN and CLOSE consensus per market.

open  = earliest probe snapshot with >=2 fresh books (first prices posted at half)
close = latest such snapshot (last prices before the 3rd-quarter kick we saw)
Consensus = median across fresh books. Spread stored home-relative
(negative = home favored for the 2H). Usage: python3 build_frame.py nfl|ncaaf
"""
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))


def _med_price(s):
    """American odds are bimodal around +/-100 — median in DECIMAL space, convert
    back (same bug class as the 2026-09-08 slate amer() incident)."""
    s = pd.to_numeric(s, errors="coerce").dropna()
    if not len(s):
        return np.nan
    dec = np.where(s > 0, 1 + s / 100, 1 + 100 / (-s))
    m = float(np.median(dec))
    return round((m - 1) * 100) if m >= 2 else round(-100 / (m - 1))


def snap_consensus(g, home):
    """One snapshot's fresh-book medians for the three 2H markets."""
    out = {}
    for mk, sub in g.groupby("market"):
        if sub.book.nunique() < 2:
            continue
        if mk == "spreads_h2":
            h = sub[sub.name == home]
            if len(h):
                out["h2_spread"] = h.point.median()
                out["h2_spread_home_price"] = _med_price(h.price)
        elif mk == "totals_h2":
            o = sub[sub.name == "Over"]
            u = sub[sub.name == "Under"]
            if len(o):
                out["h2_total"] = o.point.median()
                out["h2_over_price"] = _med_price(o.price)
                out["h2_under_price"] = _med_price(u.price) if len(u) else np.nan
        elif mk == "h2h_h2":
            h = sub[sub.name == home]
            a = sub[sub.name != home]
            if len(h):
                out["h2_ml_home"] = _med_price(h.price)
                out["h2_ml_away"] = _med_price(a.price) if len(a) else np.nan
        out[f"{mk}_nbooks"] = sub.book.nunique()
    return out


def main():
    sport = sys.argv[1]
    raw = pd.read_parquet(os.path.join(HERE, "data", f"{sport}_2h_raw.parquet"))
    raw = raw[raw.fresh].copy()
    rows = []
    for eid, g in raw.groupby("event_id"):
        home = g.home.iloc[0]
        snaps = sorted(g.snap_ts.unique())
        usable = []
        for ts in snaps:
            c = snap_consensus(g[g.snap_ts == ts], home)
            if "h2_spread" in c or "h2_total" in c:
                usable.append((ts, c))
        if not usable:
            continue
        row = dict(sport=sport, event_id=eid, home=home, away=g.away.iloc[0],
                   commence=g.commence.iloc[0], n_snaps=len(usable),
                   open_ts=usable[0][0], close_ts=usable[-1][0])
        row.update({f"open_{k}": v for k, v in usable[0][1].items()})
        row.update({f"close_{k}": v for k, v in usable[-1][1].items()})
        rows.append(row)
    out = pd.DataFrame(rows).sort_values("commence")
    path = os.path.join(HERE, "data", f"{sport}_2h_frame.parquet")
    out.to_parquet(path, index=False)
    print(f"{sport}: {len(out)} games -> {path}")
    print(out.filter(["close_h2_spread", "close_h2_total"]).describe().loc[["count", "50%", "min", "max"]].to_string())


if __name__ == "__main__":
    main()
