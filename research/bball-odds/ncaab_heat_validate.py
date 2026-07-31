#!/usr/bin/env python3
"""Does the concentrated-heat fade survive the three tests that killed the NBA near-misses?

Section 3 of NCAAB_HEAT_BRIEF.md found the pre-registered P2 result: fading the hotter team
when its heat is CONCENTRATED in one or two players goes 54.3% on 1,151 opener bets, +3.7%,
positive in all four seasons, while the diffuse third of the same rule is +0.4. That is the
right shape. It is not yet a bet. Three things have to clear first.

T1  TIMING. Heat is only known after the team's previous game. The opener is captured a
    median 25h before tip, which is usually after both teams last played -- but not always.
    Any game whose opener was posted before either team's previous game FINISHED could not
    have been bet on this information. 2.7% of games. Drop them.

T2  WALK-FORWARD. Both cutoffs (how hot, how concentrated) are quantiles of the full sample,
    which is hindsight. Recompute them from strictly PRIOR seasons and apply blind. This is
    exactly the test that turned the NBA shooting-luck-to-UNDER idea from 53.1% pooled into
    -0.9% real.

T3  RANDOM-CUT PLACEBO. Cutting a validated signal into thirds and reporting the good third
    is rigged by construction: the good third is good BECAUSE the bad third is bad. So the
    honest question is not "is the concentrated third profitable" but "does the CONCENTRATION
    cut beat a random cut of the same size?" This is the test that kept the NBA's best-looking
    cell (61%, +16.5%) off the bet list -- it only won 90% of random draws.

Both the opener and the T-60 close are reported for every row. An opener-only edge is a
news-latency effect, not a model edge -- the same distinction that retired the NBA absence
signal.
"""
import glob
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import load, usable, grade
from ncaab_heat_grade import build

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(77)
MKTS = ("FG spread OPEN", "FG spread T-60")
TOP, CONC = 0.20, 2 / 3      # fixed in ncaab_heat_grade.py before any of this was graded


def bettable(G):
    """T1. Flag games whose opener predates either team's previous game finishing."""
    oc = pd.concat([pd.read_parquet(p, columns=["event_id", "open_spread_ts"])
                    for p in sorted(glob.glob(f"{OUT}/openclose_ncaab_*.parquet"))],
                   ignore_index=True)
    oc["open_spread_ts"] = pd.to_datetime(oc["open_spread_ts"], utc=True)
    o = oc.groupby("event_id", as_index=False)["open_spread_ts"].min()

    H = pd.read_parquet(f"{OUT}/ncaab_player_heat.parquet")[["gameId", "teamId"]]
    t = G[["event_id", "gameId", "commence_time"]].copy()
    t["ct"] = pd.to_datetime(t["commence_time"], utc=True)
    t = t.merge(H, on="gameId").sort_values(["teamId", "ct"])
    t["prev_ct"] = t.groupby("teamId")["ct"].shift(1)
    # the LATER of the two teams' previous games is the one the opener has to postdate
    k = t.groupby("event_id", as_index=False)["prev_ct"].max()

    G = G.merge(o, on="event_id", how="left").merge(k, on="event_id", how="left")
    # +3h: a college game is over about three hours after tip
    gap = (G["open_spread_ts"] - G["prev_ct"]).dt.total_seconds() / 3600
    G["timing_ok"] = ~(gap < 3)          # NaN prev_ct (season opener) stays usable
    return G


def rule(G, top_q, conc_q, sub=None):
    """The rule as a mask + side. Thresholds passed in so walk-forward can vary them."""
    s = G["d_p_heat"].to_numpy(float)
    c = G["conc_drv"].to_numpy(float)
    ok = np.isfinite(s) & np.isfinite(c) & G["timing_ok"].to_numpy(bool)
    if sub is not None:
        ok &= sub
    if ok.sum() < 50:
        return None, None
    m = ok & (np.abs(s) >= top_q) & (c >= conc_q)
    return m, -np.sign(np.nan_to_num(s))


def row(G, mkt, m, side, tag, L):
    if m is None or m.sum() < 60:
        return None
    g = grade(G, mkt, m & usable(G, pd.Series(np.where(m, 1.0, np.nan), index=G.index), mkt),
              side, rng=RNG)
    L.append(f"| {tag} | {mkt} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
             f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")
    return g


def main():
    G = bettable(build())
    n_drop = int((~G["timing_ok"]).sum())
    L = ["# NCAAB concentrated player heat — validation", "",
         f"T1 drops {n_drop:,} games ({100*n_drop/len(G):.1f}%) whose opener predates a "
         "previous game finishing. Everything below is on the remainder.", "",
         "## Pooled, after the timing filter", "",
         "| rule | market | bets | win % | base % | edge | ROI % | p | by season |",
         "|---|---|---|---|---|---|---|---|---|"]

    s, c = G["d_p_heat"], G["conc_drv"]
    tq = np.nanquantile(np.abs(s), 1 - TOP)
    cq = np.nanquantile(c, CONC)
    for mkt in MKTS:
        m, side = rule(G, tq, cq)
        row(G, mkt, m, side, "concentrated heat fade", L)
    # the diffuse third, as the internal contrast
    for mkt in MKTS:
        m, side = rule(G, tq, -np.inf, sub=(c <= np.nanquantile(c, 1 / 3)).to_numpy())
        row(G, mkt, m, side, "diffuse third (contrast)", L)

    # ---- T2 walk-forward ------------------------------------------------------------
    L += ["", "## T2 — walk-forward (cutoffs from strictly prior seasons only)", "",
          "| rule | market | bets | win % | base % | edge | ROI % | p | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    seas = sorted(G["season"].astype(str).unique())
    wf = np.zeros(len(G), bool)
    for i, sn in enumerate(seas):
        if i == 0:
            continue                      # no prior season to learn from
        prior = G["season"].astype(str).isin(seas[:i]).to_numpy()
        cur = (G["season"].astype(str) == sn).to_numpy()
        tq_i = np.nanquantile(np.abs(s.to_numpy()[prior]), 1 - TOP)
        cq_i = np.nanquantile(c.to_numpy()[prior], CONC)
        m, _ = rule(G, tq_i, cq_i, sub=cur)
        if m is not None:
            wf |= m
    side = -np.sign(np.nan_to_num(s.to_numpy(float)))
    for mkt in MKTS:
        row(G, mkt, wf, side, "walk-forward", L)

    # ---- T3 random-cut placebo ------------------------------------------------------
    L += ["", "## T3 — is the CONCENTRATION cut better than a random cut of the same size?",
          "", "The concentrated third is compared against 2,000 random thirds drawn from the "
          "same hot-signal pool. `beats` is the share of random cuts the real cut outscores "
          "on ROI. Below ~95% the cut is not carrying information.", "",
          "| market | real ROI % | random ROI mean % | beats |", "|---|---|---|---|"]
    hot = (np.isfinite(s) & np.isfinite(c) & G["timing_ok"].to_numpy(bool)
           & (np.abs(s) >= tq)).to_numpy()
    for mkt in MKTS:
        u = hot & usable(G, pd.Series(np.where(hot, 1.0, np.nan), index=G.index), mkt)
        real = grade(G, mkt, u & (c >= cq).to_numpy(), side)["roi"]
        k = int((u & (c >= cq).to_numpy()).sum())
        idx = np.flatnonzero(u)
        draws = []
        for _ in range(2000):
            pick = np.zeros(len(G), bool)
            pick[RNG.choice(idx, k, replace=False)] = True
            draws.append(grade(G, mkt, pick, side)["roi"])
        draws = np.array(draws)
        L.append(f"| {mkt} | {real:+.2f} | {draws.mean():+.2f} | "
                 f"**{100*(real > draws).mean():.1f}%** |")

    path = os.path.join(ROOT, "NCAAB_HEAT_VALIDATION.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
