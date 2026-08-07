#!/usr/bin/env python3
"""Every NBA market, one frame, the repaired feature stack.

THE POINT. The full-game TOTAL is the only market that was ever rebuilt on the corrected data.
Everything else was built earlier and never revisited:

    market        built in                    on the repaired stack?
    FG total      nba_total_v2/v3/v4          yes  -- +3.5 edge
    FG spread     nba_spread_dims             yes  -- still -1.2
    1H spread     nba_h1_model                NO   -- own ad-hoc feature_cols
    1H total      nba_h1_total_model          NO   -- none of it
    team totals   never built                 --
    moneyline     never built                 --

"The repaired stack" means four specific fixes that all landed after the 1H files were
written: the possession block was joining COLLEGE basketball at 0.0% coverage; the adjusted
scoring ratings had no global intercept and correlated 0.005 with the line instead of 0.644;
the recency half-life was in league-game rows rather than days; and usage concentration was
identified as the load-bearing block rather than one theme among many. A model built before
those is not a model that failed, it is a model that was never run.

WHY TEAM TOTALS ARE THE BEST BET HERE, mechanically and not hopefully. Usage concentration is
a ONE-TEAM property, and it measures against a one-team outcome: a team's own next-game points
(corr -0.058, t about -5.9, on 10,324 team-games). On a game total that quantity gets summed
with the opponent's and diluted. A team total is exactly the outcome it was measured against.
If concentration is real anywhere in a betting market, it is here.

THE ONE GENUINELY NEW FEATURE FAMILY, ported from the NFL 1H/team-total work rather than
invented: DERIVATIVE-MARKET CONSISTENCY. The team totals, the first-half lines and the
full-game spread/total are three descriptions of the same game, and they are priced by
different people at different times. `tt_h + tt_a` should equal the full-game total; the
posted team total should equal the one implied by the spread and total together; the 1H total
should be about half the full-game total. Where they disagree, one of them is stale. In the
NFL that disagreement is keeper K1. It has never been computed for the NBA.

MONEYLINE IS A DERIVATIVE, NOT A MODEL. The ML carries no information the spread does not --
it is the same margin distribution read at a different point. So it is built here as a
transform of the spread prediction rather than a sixth fit, which also means it can only win
if the spread model works or if the ML price is softer than the spread price at some margins.
Pretending otherwise would be manufacturing a seventh chance to get lucky.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd
from scipy.stats import norm

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
v3 = _load("v3", "nba_total_v3.py")
v4 = _load("v4", "nba_total_v4.py")
sd = _load("sd", "nba_spread_dims.py")
nets = _load("nets", "nba_matchup_nets.py")
adj = _load("adj", "nba_adj_stats.py")

NULLS = 5
MARGIN_SD = 13.2      # sd of the NBA final margin around the spread; used only for ML conversion

# k is in the market's own POINTS, scaled to its scale: a first half is about half a game and a
# team total is about half a game total, so the same fraction of a standard deviation is a
# smaller number of points. Picking one k per market from the ladder afterwards would be
# selection; these are set here, before anything is graded.
MARKETS = [
    dict(key="fg_spread", name="full-game spread", y="y_fg_marg_resid",
         po="t60_spread_home_price", pu="t60_spread_away_price", line="t60_spread_home_point",
         k=1.5, over="home", under="away"),
    dict(key="fg_total", name="full-game total", y="y_fg_tot_resid",
         po="t60_total_over_price", pu="t60_total_under_price", line="t60_total_point",
         k=2.0, over="over", under="under"),
    dict(key="h1_spread", name="first-half spread", y="y_h1_marg_resid",
         po="h1_sp_h", pu="h1_sp_a", line="h1_spread",
         k=1.0, over="home", under="away"),
    dict(key="h1_total", name="first-half total", y="y_h1_tot_resid",
         po="h1_ov", pu="h1_un", line="h1_total_line",
         k=1.25, over="over", under="under"),
    dict(key="tt_home", name="home team total", y="y_tt_h_resid",
         po="tt_h_o", pu="tt_h_u", line="tt_h", k=1.25, over="over", under="under"),
    dict(key="tt_away", name="away team total", y="y_tt_a_resid",
         po="tt_a_o", pu="tt_a_u", line="tt_a", k=1.25, over="over", under="under"),
]


def market_structure(D):
    """Do the derivative markets agree with the main one? Where they don't, one side is stale.

    Every quantity here is a difference between two PRICES, never between a price and a
    result, so none of it can leak. The sign convention of `t60_spread_home_point` is resolved
    against the posted team total rather than assumed -- getting it backwards would silently
    invert the whole family, which is the single most common way this class of feature breaks.
    """
    made = []
    tot, spr = D["t60_total_point"], D["t60_spread_home_point"]
    cand = {"plus": (tot + spr) / 2.0, "minus": (tot - spr) / 2.0}
    ref = D["tt_h"]
    m = ref.notna() & tot.notna() & spr.notna()
    corrs = {k: np.corrcoef(v[m], ref[m])[0, 1] for k, v in cand.items()}
    pick = max(corrs, key=lambda k: corrs[k])
    print(f"[mkt] implied home TT sign check: {corrs} -> using '{pick}'", flush=True)
    assert corrs[pick] > 0.85, f"neither sign convention reproduces the posted team total: {corrs}"
    imp_h = cand[pick]
    imp_a = tot - imp_h

    # posted vs implied: the team-total market disagreeing with the spread+total market
    D["mk_tt_disc_h"] = D["tt_h"] - imp_h
    D["mk_tt_disc_a"] = D["tt_a"] - imp_a
    # the two team totals should sum to the game total; mkt_tt_gap already exists but is
    # recomputed here so the family is self-contained and its sign is known
    D["mk_tt_sum_gap"] = (D["tt_h"] + D["tt_a"]) - tot
    D["mk_tt_split"] = (D["tt_h"] - D["tt_a"]) / tot.replace(0, np.nan)
    made += ["mk_tt_disc_h", "mk_tt_disc_a", "mk_tt_sum_gap", "mk_tt_split"]

    # the first half should be a roughly fixed share of the game. Deviations are the 1H market
    # disagreeing with the full-game market about pace or about who starts fast.
    D["mk_h1_tot_share"] = D["h1_total_line"] / tot.replace(0, np.nan)
    D["mk_h1_sp_share"] = D["h1_spread"] / spr.replace(0, np.nan)
    D["mk_h1_tot_disc"] = D["h1_total_line"] - 0.505 * tot     # 0.505 = league 1H share of scoring
    D["mk_h1_sp_disc"] = D["h1_spread"] - 0.50 * spr
    made += ["mk_h1_tot_share", "mk_h1_sp_share", "mk_h1_tot_disc", "mk_h1_sp_disc"]

    return D, [c for c in made if D[c].notna().mean() > 0.60]


def leak(D, cols, ycol, linecol, tol=0.10):
    """Per-market leak screen: a feature must track that market's LINE at least as well as its
    RESULT. v2's version is hardcoded to the full-game total, which would clear a column that
    knows the first-half box score."""
    y, line = D[ycol], D[linecol]
    bad = []
    for c in cols:
        if c == linecol:
            continue
        x = pd.to_numeric(D[c], errors="coerce")
        m = x.notna() & y.notna() & line.notna()
        if m.sum() < 400:
            continue
        a = abs(np.corrcoef(x[m], y[m])[0, 1])
        b = abs(np.corrcoef(x[m], line[m])[0, 1])
        if a - b > tol:
            bad.append(c)
    return set(bad)


def ladder(D, p, yb, po, pu, bag, ks):
    for k in ks:
        g = v2.grade(p, yb, po, pu, k)
        if g["n"]:
            bag.append(f"| ≥{k:g} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                       f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print(bag[-1], flush=True)


def split(D, p, yb, po, pu, bag, k, col, order=None):
    for v in (order or sorted(D[col].dropna().unique())):
        g = v2.grade(p, yb, po, pu, k, mask=(D[col] == v))
        if g["n"]:
            bag.append(f"| {v} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                       f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print(bag[-1], flush=True)


def main():
    D = sd.build_spread()
    assert D["event_id"].is_unique, "frame has duplicate event_ids — totals would be double-counted"
    D = v3.with_fixed_ratings(D)
    D, themes = v4.dim_features(D)
    D, rblocks = nets.attach(D)
    D, ablocks = adj.attach(D)
    D, mkcols = market_structure(D)

    radj = [c for c in D.columns if c.startswith("radj_") and D[c].notna().mean() > 0.80]
    dims = [c for t in themes.values() for c in t if D[c].notna().mean() > 0.80]
    extra = [c for grp in (rblocks["raw"], rblocks["net"], ablocks["aown"], ablocks["anet"])
             for c in grp
             if c in D.columns and not c.startswith("adjr_") and D[c].notna().mean() > 0.80]
    stack = list(dict.fromkeys(v2.feature_cols(D) + radj + dims + extra + mkcols))
    assert not any(c.startswith("y_") for c in stack), "an outcome column got into the stack"
    print(f"[stack] {len(stack)} candidate columns "
          f"(base+ratings {len(radj)} dims {len(dims)} poss/net/adj {len(extra)} "
          f"market-structure {len(mkcols)})", flush=True)

    L = ["# NBA — every market on the repaired feature stack", "",
         "The full-game total is the only market that was ever rebuilt after the data repairs "
         "(college possessions joining at 0%, adjusted ratings with no intercept, a recency "
         "half-life in rows instead of days, usage concentration identified as the engine). "
         "The 1H models predate all four; team totals and the moneyline were never built at "
         "all. This runs one frame and one stack against all of them.", "",
         "New here: a **derivative-market consistency** family (`mk_*`) — where the team "
         "totals, the 1H lines and the full-game spread/total disagree about the same game, "
         "one of them is stale. Ported from the NFL 1H/team-total work, never computed for the "
         "NBA before.", "",
         "Baselines are each cell's own majority side, never 50%. Breakeven at −110 is 52.4%.",
         "", "## 1. Headline — all six markets", "",
         "| market | n games | cols | oos corr | bets | win% | base% | edge | ROI | null z (edge) |",
         "|---|---|---|---|---|---|---|---|---|---|"]

    keep = {}
    for M in MARKETS:
        y = pd.to_numeric(D[M["y"]], errors="coerce")
        if y.notna().sum() < 800:
            print(f"[{M['key']}] only {y.notna().sum()} graded rows — skipped", flush=True)
            continue
        cols = [c for c in stack if c in D.columns and D[c].notna().mean() > 0.60]
        cols = [c for c in cols if c not in leak(D, cols, M["y"], M["line"])]
        yb = pd.Series(np.where(y > 0, 1.0, np.where(y < 0, 0.0, np.nan)), index=D.index)
        po = pd.Series(v2.to_dec(D[M["po"]]), index=D.index)
        pu = pd.Series(v2.to_dec(D[M["pu"]]), index=D.index)

        p = v2.walk(D[cols].astype(float), D["date"], y, kind="ridge")
        mm = p.notna() & y.notna()
        r = np.corrcoef(p[mm], y[mm])[0, 1]
        g = v2.grade(p, yb, po, pu, M["k"])

        ne = []
        rng = np.random.default_rng(1234)
        for _ in range(NULLS):
            ys = y.copy()
            for s in D["season"].unique():
                msk = (D["season"] == s) & y.notna()
                ys.loc[msk] = rng.permutation(y.loc[msk].values)
            ps = v2.walk(D[cols].astype(float), D["date"], ys, kind="ridge")
            ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=D.index)
            gg = v2.grade(ps, ybs, po, pu, M["k"])
            ne.append(gg["win"] - gg["base"])
        ne = np.array(ne, dtype=float)
        z = (g["win"] - g["base"] - np.nanmean(ne)) / np.nanstd(ne, ddof=1)

        L.append(f"| **{M['name']}** | {int(y.notna().sum()):,} | {len(cols)} | {r:+.4f} | "
                 f"{g['n']} | {g['win']:.1f} | {g['base']:.1f} | **{g['win']-g['base']:+.1f}** | "
                 f"{g['roi']:+.1f} | {z:+.2f} |")
        print(L[-1], flush=True)
        keep[M["key"]] = (M, p, y, yb, po, pu, g, z)

    # ------------------------------------------------------------------ moneyline, as a transform
    if "fg_spread" in keep:
        M, p, y, yb, po, pu, g, z = keep["fg_spread"]
        implied = -pd.to_numeric(D["t60_spread_home_point"], errors="coerce")  # home margin
        pm = implied + p
        ph_model = pd.Series(norm.cdf(pm / MARGIN_SD), index=D.index)
        mh = 1.0 / pd.Series(v2.to_dec(D["t60_ml_home_price"]), index=D.index)
        ma = 1.0 / pd.Series(v2.to_dec(D["t60_ml_away_price"]), index=D.index)
        vig = mh + ma
        fair_h = mh / vig                                  # no-vig market probability
        home_won = pd.Series(np.where(pd.to_numeric(D["y_fg_margin"], errors="coerce") > 0, 1.0,
                                      np.nan), index=D.index).fillna(0.0)
        home_won[pd.to_numeric(D["y_fg_margin"], errors="coerce").isna()] = np.nan
        L += ["", "## 2. Moneyline — the spread model read as a win probability", "",
              "No separate fit: the ML carries the same margin distribution as the spread, so a "
              "sixth model here would just be a sixth chance to get lucky. The spread residual "
              "is added to the market's implied margin, converted with a normal of sd "
              f"{MARGIN_SD}, and compared with the **no-vig** market probability. `edge` is in "
              "percentage points of win probability.", "",
              "| prob edge ≥ | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
        for thr in (0.02, 0.04, 0.06, 0.08):
            side_home = (ph_model - fair_h) > thr
            side_away = (fair_h - ph_model) > thr
            m = (side_home | side_away) & home_won.notna() & mh.notna()
            if m.sum() < 40:
                continue
            win = np.where(side_home[m], home_won[m], 1 - home_won[m])
            dec = np.where(side_home[m], v2.to_dec(D["t60_ml_home_price"])[m],
                           v2.to_dec(D["t60_ml_away_price"])[m])
            base = max(np.mean(win), 1 - np.mean(win))
            # base for a variable-side rule is the better of the two constant strategies IN CELL
            bh = np.mean(home_won[m])
            base = 100 * max(bh, 1 - bh)
            roi = 100 * np.mean(win * (dec - 1) - (1 - win))
            L.append(f"| {thr:.0%} | {int(m.sum())} | {100*np.mean(win):.1f} | {base:.1f} | "
                     f"**{100*np.mean(win)-base:+.1f}** | {roi:+.1f} |")
            print(L[-1], flush=True)

    # ------------------------------------------------------------------ detail on every market
    for key, (M, p, y, yb, po, pu, g, z) in keep.items():
        L += ["", f"## 3.{key} — {M['name']}: threshold, phase and season", "",
              "| k (pts) | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
        ladder(D, p, yb, po, pu, L, (0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0))
        L += ["", f"| phase (k={M['k']:g}) | bets | win% | base% | edge | ROI |",
              "|---|---|---|---|---|---|"]
        split(D, p, yb, po, pu, L, M["k"], "phase", ("EARLY", "MID", "LATE", "POST"))
        L += ["", f"| season (k={M['k']:g}) | bets | win% | base% | edge | ROI |",
              "|---|---|---|---|---|---|"]
        split(D, p, yb, po, pu, L, M["k"], "season")

    with open(os.path.join(ROOT, "NBA_MARKETS.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_MARKETS.md", flush=True)


if __name__ == "__main__":
    main()
