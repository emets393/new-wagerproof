#!/usr/bin/env python3
"""Noon-ET college football: what do tickets and percentages do in that window?

Owner's question (2026-10-16). The noon window is the one every CFB bettor has a feeling
about — early kick, body-clock games, the slate's dumping ground — so the question is
whether the crowd behaves differently there, and whether that is worth anything.

⛔ READ THE SAMPLE SIZE BEFORE THE RATES. There are 59 graded noon games this season. At
n=59 the 95% band around a coin flip is roughly +/- 13 points, so NOTHING under about 63%
is distinguishable from noise, and a tercile cell (n~20) needs about 72%. Several cells
below WILL print 60-something percent. That is what noise looks like at this n, not a lead.

## Two different questions, kept apart

DESCRIPTIVE — is the noon window different? (volume, how lopsided the crowd gets, how
often favourites cover.) These are honest at this n and are the real content here.

PREDICTIVE — is any of it bettable? This is where the README's standing rule bites: do
NOT re-scan for new cells, because four good-looking cells have already moved once new
games arrived. So every cell is pre-registered in CELLS below and the whole family is
corrected together.

## The correction, and why it is not optional

Testing 13 cells and reporting the best one is how you manufacture an edge. The null here
SHUFFLES THE NOON LABEL across all CFB games, keeping n fixed, recomputes every cell, and
records the single BIGGEST deviation in that permutation. The observed best cell is then
compared against the distribution of best-of-13, not against a coin flip. `p_family` is
the honest number; the per-cell p is shown only so the shape is visible.

Markets are combined where they are related, as asked: a game's moneyline and spread
crowds are two readings of one opinion, so CELLS includes the cross (crowd on the
favourite in BOTH, crowd split between them) alongside the single-market reads. That
cross is the same construct as cross_ml_spread.py — see the README for the C1 verdict on
the full slate; this only asks whether the noon window behaves differently.

    python3 noon_cfb.py [--hour 12]
"""
import argparse
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import timing_study as T

HERE = os.path.dirname(os.path.abspath(__file__))
JOINED = os.path.join(HERE, "data", "action_joined.parquet")
NPERM = 4000
RNG = np.random.default_rng(20261016)


def games():
    """One row per CFB game: the three markets side by side, plus kickoff."""
    d = pd.read_parquet(JOINED)
    d = d[d.sport == "cfb"].copy()
    d["week"] = d.week.astype(int)

    k = T.kickoffs({"cfb": set(d.week)})
    d = d.merge(k, on=["sport", "week", "away", "home"], how="left").dropna(subset=["kick"])

    wide = {}
    for mkt in ("spread", "total", "ml"):
        m = d[d.market == mkt].set_index("game_id")
        wide[mkt] = m[["bets_away", "money_away", "tickets", "away_result"]].add_prefix(f"{mkt}_")
    g = wide["spread"].join(wide["total"], how="outer").join(wide["ml"], how="outer")

    meta = (d.drop_duplicates("game_id").set_index("game_id")
              [["week", "away", "home", "kick", "spread_close"]])
    g = g.join(meta, how="inner")
    g["hour"] = g.kick.dt.hour

    # The crowd's side in each market, and whether it won. away_result is +1 when the
    # away side of that market won (covered / over hit / won outright).
    for mkt in ("spread", "total", "ml"):
        pa = g[f"{mkt}_bets_away"] > 50
        g[f"{mkt}_pub_away"] = pa
        g[f"{mkt}_pub_pct"] = np.where(pa, g[f"{mkt}_bets_away"], 100 - g[f"{mkt}_bets_away"])
        g[f"{mkt}_pub_won"] = np.where(pa, g[f"{mkt}_away_result"] > 0,
                                       g[f"{mkt}_away_result"] < 0)
        g[f"{mkt}_graded"] = g[f"{mkt}_away_result"].abs() > 0

    g["fav_away"] = g.spread_close > 0                  # home-perspective close
    g["fav_covered"] = np.where(g.fav_away, g.spread_away_result > 0,
                                g.spread_away_result < 0)
    g["crowd_on_fav_spread"] = g.spread_pub_away == g.fav_away
    g["crowd_on_fav_ml"] = g.ml_pub_away == g.fav_away
    # the two readings of one opinion: do the spread and ML crowds agree?
    g["cross_agree"] = g.crowd_on_fav_spread == g.crowd_on_fav_ml
    return g


# (label, row filter, outcome column) — pre-registered, in this order, no additions
# without re-running the whole family.
CELLS = [
    ("spread: crowd side covers",        lambda g: g.spread_graded,                      "spread_pub_won"),
    ("total:  crowd side hits",          lambda g: g.total_graded,                       "total_pub_won"),
    ("ml:     crowd side wins",          lambda g: g.ml_graded,                          "ml_pub_won"),
    ("spread: favourite covers",         lambda g: g.spread_graded,                      "fav_covered"),
    ("spread: crowd >=70% covers",       lambda g: g.spread_graded & (g.spread_pub_pct >= 70), "spread_pub_won"),
    ("total:  crowd >=70% hits",         lambda g: g.total_graded & (g.total_pub_pct >= 70),   "total_pub_won"),
    ("spread: top-third ticket games",   lambda g: g.spread_graded & g.hi_tix,           "spread_pub_won"),
    ("spread: bottom-third ticket",      lambda g: g.spread_graded & g.lo_tix,           "spread_pub_won"),
    ("spread: money disagrees >=15pts",  lambda g: g.spread_graded & g.money_split,      "money_side_won"),
    ("CROSS: crowd on fav in BOTH",      lambda g: g.spread_graded & g.crowd_on_fav_spread & g.crowd_on_fav_ml, "fav_covered"),
    ("CROSS: crowd SPLIT across mkts",   lambda g: g.spread_graded & ~g.cross_agree,     "fav_covered"),
    ("CROSS: both + top-third ticket",   lambda g: g.spread_graded & g.crowd_on_fav_spread & g.crowd_on_fav_ml & g.hi_tix, "fav_covered"),
    ("CROSS: ml crowd heavier than ATS", lambda g: g.spread_graded & g.ml_heavier,       "fav_covered"),
]


def derive(g):
    """Cell inputs that depend on the slice they are computed in."""
    g = g.copy()
    tix = g.spread_tickets
    g["hi_tix"] = tix >= tix.quantile(2 / 3)
    g["lo_tix"] = tix <= tix.quantile(1 / 3)
    g["money_split"] = (g.spread_money_away - g.spread_bets_away).abs() >= 15
    money_away = g.spread_money_away > 50
    g["money_side_won"] = np.where(money_away, g.spread_away_result > 0,
                                   g.spread_away_result < 0)
    fav_ml = np.where(g.fav_away, g.ml_bets_away, 100 - g.ml_bets_away)
    fav_sp = np.where(g.fav_away, g.spread_bets_away, 100 - g.spread_bets_away)
    g["ml_heavier"] = fav_ml > fav_sp
    return g


def measure(g):
    """Every cell's hit rate and n, for one slice."""
    g = derive(g)
    out = []
    for label, flt, col in CELLS:
        s = g.loc[flt(g), col]
        out.append((label, s.mean() if len(s) else np.nan, len(s)))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hour", type=int, default=12)
    a = ap.parse_args()

    g = games()
    noon = g.hour == a.hour
    n_noon = int((noon & g.spread_graded).sum())
    print(f"CFB games with a kickoff: {len(g)} | {a.hour}:00 ET window: {int(noon.sum())} "
          f"({n_noon} graded on the spread)")
    band = 1.96 * np.sqrt(0.25 / max(n_noon, 1)) * 100
    print(f"⛔ at n={n_noon} the 95% band around a coin flip is ±{band:.0f} points — "
          f"read nothing below ~{50 + band:.0f}%\n")

    # ---- descriptive: is the window different at all? ----
    rest = ~noon
    print("=" * 84)
    print(f"DESCRIPTIVE — the {a.hour}:00 window vs the rest of the CFB slate")
    print("=" * 84)
    for label, col, fmt in [
        ("median tickets per game", "spread_tickets", "{:,.0f}"),
        ("crowd's share on its own side (spread)", "spread_pub_pct", "{:.1f}%"),
        ("crowd's share on its own side (ml)", "ml_pub_pct", "{:.1f}%"),
    ]:
        x, y = g.loc[noon, col].median(), g.loc[rest, col].median()
        print(f"  {label:<42} {a.hour}:00 {fmt.format(x):>10}   rest {fmt.format(y):>10}")
    for label, col in [("favourite covers", "fav_covered"),
                       ("over hits", None),
                       ("crowd is on the favourite (spread)", "crowd_on_fav_spread"),
                       ("spread and ml crowds agree", "cross_agree")]:
        if col is None:
            x = (g.loc[noon & g.total_graded, "total_away_result"] > 0).mean()
            y = (g.loc[rest & g.total_graded, "total_away_result"] > 0).mean()
        else:
            x = g.loc[noon & g.spread_graded, col].mean()
            y = g.loc[rest & g.spread_graded, col].mean()
        print(f"  {label:<42} {a.hour}:00 {x:9.1%}   rest {y:9.1%}")

    # ---- predictive: the pre-registered family ----
    obs = measure(g[noon])
    print("\n" + "=" * 84)
    print(f"PREDICTIVE — {len(CELLS)} pre-registered cells, corrected as a family")
    print("=" * 84)

    # null: reshuffle which games are "noon", keep n fixed, record the family's best cell
    idx = np.arange(len(g))
    best_null, per_cell = [], [[] for _ in CELLS]
    for _ in range(NPERM):
        pick = np.zeros(len(g), bool)
        pick[RNG.choice(idx, size=int(noon.sum()), replace=False)] = True
        vals = measure(g[pick])
        devs = []
        for i, (_l, v, n) in enumerate(vals):
            per_cell[i].append(v)
            if not np.isnan(v) and n >= 10:
                devs.append(abs(v - 0.5))
        best_null.append(max(devs) if devs else np.nan)
    best_null = np.array(best_null, float)
    best_null = best_null[~np.isnan(best_null)]

    rows = []
    for i, (label, v, n) in enumerate(obs):
        if np.isnan(v) or n < 10:
            print(f"  {label:<36} n={n:<4} too thin to read")
            continue
        col = np.array(per_cell[i], float)
        col = col[~np.isnan(col)]
        p_cell = (np.abs(col - 0.5) >= abs(v - 0.5)).mean()
        p_fam = (best_null >= abs(v - 0.5)).mean()
        rows.append((abs(v - 0.5), label, v, n, p_cell, p_fam))
        flag = "<-- survives family" if p_fam < 0.05 else ""
        print(f"  {label:<36} {v:6.1%}  n={n:<4} p_cell={p_cell:.3f}  "
              f"p_family={p_fam:.3f} {flag}")

    print("\n" + "-" * 84)
    if rows:
        dev, label, v, n, p_cell, p_fam = max(rows)
        print(f"BEST CELL: {label} at {v:.1%} (n={n}).")
        print(f"  on its own           p={p_cell:.3f}")
        print(f"  against best-of-{len(rows):<3}  p={p_fam:.3f}  "
              f"{'-> survives' if p_fam < 0.05 else '-> this is what noise looks like'}")
        print(f"  a random slice of {int(noon.sum())} CFB games produces a best cell "
              f"{best_null.mean() * 100:.1f} ± {best_null.std() * 100:.1f} points off 50%.")
    print("-" * 84)


if __name__ == "__main__":
    main()
