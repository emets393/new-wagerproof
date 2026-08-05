#!/usr/bin/env python3
"""Does opponent-adjusting the NBA box actually help? A 2x2, plus a mechanism test.

THE TWO CLAIMS ARE SEPARATE AND MUST BE SEPARATED. "Adjust the stats for the opponents a team
played" and "combine team A's offence with team B's defence" are different ideas, and a naive
test credits both to whichever is run last. So the ladder is a 2x2:

                          own levels only        matchup net
    raw rolling means     base + RAW own         base + RAW net
    opponent-adjusted     base + ADJ own         base + ADJ net

Reading down a column isolates the ADJUSTMENT. Reading across a row isolates the MATCHUP
CONSTRUCTION. Reading the diagonal is what a sloppy version of this test would report.

SECTION 1 IS THE ONE THAT WILL ACTUALLY SETTLE IT. The betting edge has a null sd near 0.9
points of win rate, so a +0.5 move there is unreadable noise and no amount of staring fixes
that. But there is a far higher-powered question available: does the adjusted rating predict a
team's NEXT game better than the raw rolling mean does? That is thousands of observations
against a clean target, it needs no market at all, and if adjustment does not win THERE it
cannot possibly be helping downstream. Mechanism first, money second.

WHAT WOULD MAKE ADJUSTMENT MATTER LESS IN THE NBA THAN IN COLLEGE. Thirty teams playing a
balanced 82-game schedule see a far more uniform slate than 360 college teams playing mostly
inside their own conference. Schedule strength disperses less, so there is less for the
adjustment to remove. That is a reason to MEASURE the size of the effect rather than assume it,
not a reason to skip it -- and it is exactly why the mechanism test carries this file.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
v3 = _load("v3", "nba_total_v3.py")
v4 = _load("v4", "nba_total_v4.py")
nets = _load("nets", "nba_matchup_nets.py")
adj = _load("adj", "nba_adj_stats.py")


def mechanism():
    """Does the adjusted rating forecast the team's NEXT game better than the rolling mean?

    Both predictors are strictly pregame. The target is the team's actual value in the game
    being predicted. Thousands of rows, no market involved -- this is where the question has
    real statistical power, unlike the betting edge.
    """
    P = nets.team_game_box()
    P["season"] = np.where(P["date"].dt.month >= 8, P["date"].dt.year, P["date"].dt.year - 1)
    P = P.sort_values(["teamId", "season", "date"]).reset_index(drop=True)

    R = adj.build()
    P = P.merge(R.rename(columns={"team.id": "teamId"}), on=["date", "teamId"], how="left")

    rows = []
    for s in adj.STATS:
        v = pd.to_numeric(P[s], errors="coerce")
        grp = [P["teamId"], P["season"]]
        sh = v.groupby(grp).shift(1)
        roll10 = sh.groupby(grp).transform(lambda x: x.rolling(10, min_periods=4).mean())
        s2d = sh.groupby(grp).transform(lambda x: x.expanding(min_periods=4).mean())
        cand = {"rolling L10": roll10, "season-to-date": s2d,
                "opponent-adjusted": P.get(f"adj_off_{s}"),
                "adjusted, recency-weighted": P.get(f"adjr_off_{s}")}
        r = {"stat": s}
        m = v.notna()
        for c in cand.values():
            m &= c.notna()
        for nm, c in cand.items():
            r[nm] = np.corrcoef(c[m], v[m])[0, 1] if m.sum() > 100 else np.nan
        r["n"] = int(m.sum())
        rows.append(r)
    return pd.DataFrame(rows)


def ladder(D, y, yb, pw, pl, k, title, path):
    D = v3.with_fixed_ratings(D)
    D, rblocks = nets.attach(D)
    D, ablocks = adj.attach(D)

    def ok(cs):
        return [c for c in cs if c in D.columns and D[c].notna().mean() > 0.80]

    base_cols = [c for c in v2.feature_cols(D) if c not in v2.leak_screen(D, v2.feature_cols(D))]
    base = base_cols + [c for c in D.columns
                        if c.startswith("radj_") and D[c].notna().mean() > 0.80]
    raw_own = ok([c for c in rblocks["raw"]])
    raw_net = ok([c for c in rblocks["net"]])
    adj_own = ok([c for c in ablocks["aown"] if c.startswith("adj_")])
    adj_net = ok([c for c in ablocks["anet"] if c.startswith("adj_")])
    adjr_net = ok([c for c in ablocks["anet"] if c.startswith("adjr_")])
    print(f"[{title}] base={len(base)} raw_own={len(raw_own)} raw_net={len(raw_net)} "
          f"adj_own={len(adj_own)} adj_net={len(adj_net)}", flush=True)

    L = [f"# {title} — opponent-adjusted stats vs raw rolling means", "",
         f"{len(D):,} gradeable games, walk-forward ridge on the residual vs the T-60 close, "
         f"bets at |disagreement| ≥ {k}. Breakeven at −110 is 52.4%.", "",
         "Read **down** a pair of rows to isolate the adjustment; read **across** to isolate the "
         "matchup construction. Both moves at once tells you nothing about either.", "",
         "| feature set | cols | oos corr | n | win% | base% | edge | ROI |",
         "|---|---|---|---|---|---|---|---|"]
    sets = [("base (incumbent)", base),
            ("base + RAW own levels", base + raw_own),
            ("base + RAW matchup nets", base + raw_net),
            ("base + ADJUSTED own levels", base + adj_own),
            ("base + ADJUSTED matchup nets", base + adj_net),
            ("base + ADJUSTED nets, recency-weighted", base + adjr_net),
            ("ADJUSTED nets ALONE", adj_net)]
    P = {}
    for tag, cs in sets:
        if not cs:
            continue
        P[tag] = v2.walk(D[cs].astype(float), D["date"], y, kind="ridge")
        v4.report(L, tag, P[tag], y, yb, pw, pl, len(cs), k=k)

    # the null prices the search: seven feature sets tried against one label
    rng = np.random.default_rng(4242)
    nr, ne = [], []
    cs = base + adj_net
    for i in range(6):
        ys = y.copy()
        for s in D["season"].unique():
            m = (D["season"] == s) & y.notna()
            ys.loc[m] = rng.permutation(y.loc[m].values)
        ps = v2.walk(D[cs].astype(float), D["date"], ys, kind="ridge")
        ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=D.index)
        mm = ps.notna() & ys.notna()
        nr.append(np.corrcoef(ps[mm], ys[mm])[0, 1])
        g = v2.grade(ps, ybs, pw, pl, k)
        ne.append(g["win"] - g["base"])
        print(f"[null {i+1}/6] corr {nr[-1]:+.4f} edge {ne[-1]:+.2f}", flush=True)

    bt = "base + ADJUSTED matchup nets"
    mm = P[bt].notna() & y.notna()
    rr = np.corrcoef(P[bt][mm], y[mm])[0, 1]
    g = v2.grade(P[bt], yb, pw, pl, k)
    nr, ne = np.array(nr), np.array(ne)
    L += ["", "## Label-shuffle null (6 draws, within season) — how big is 'nothing'?", "",
          "| statistic | real | null mean | null sd | z |", "|---|---|---|---|---|",
          f"| oos corr | {rr:+.4f} | {nr.mean():+.4f} | {nr.std(ddof=1):.4f} | "
          f"**{(rr-nr.mean())/nr.std(ddof=1):+.2f}** |",
          f"| edge @ ≥{k} | {g['win']-g['base']:+.2f} | {ne.mean():+.2f} | {ne.std(ddof=1):.2f} | "
          f"**{(g['win']-g['base']-ne.mean())/ne.std(ddof=1):+.2f}** |", ""]
    print("\n".join(L[-4:]), flush=True)

    with open(os.path.join(ROOT, path), "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote {path}\n", flush=True)
    return D


def main():
    M = mechanism()
    L = ["# NBA opponent-adjusted stats", "",
         "## 1. Mechanism — does adjustment forecast the team's NEXT game better?", "",
         "Correlation between a pregame estimate of a team's stat and what that team actually "
         "does in the game being predicted. No market involved, thousands of rows per stat, so "
         "this is where the question has power. If the adjusted rating does not beat the plain "
         "rolling mean here, it cannot help anything downstream.", "",
         "| stat | n | rolling L10 | season-to-date | opponent-adjusted | adjusted + recency |",
         "|---|---|---|---|---|---|"]
    for _, r in M.iterrows():
        L.append(f"| `{r['stat']}` | {int(r['n']):,} | {r['rolling L10']:+.4f} | "
                 f"{r['season-to-date']:+.4f} | **{r['opponent-adjusted']:+.4f}** | "
                 f"{r['adjusted, recency-weighted']:+.4f} |")
        print(L[-1], flush=True)
    wins = int((M["opponent-adjusted"] > M[["rolling L10", "season-to-date"]].max(axis=1)).sum())
    L += ["", f"Opponent-adjusted beats both unadjusted estimates on **{wins} of {len(M)}** stats.",
          ""]
    with open(os.path.join(ROOT, "NBA_ADJ_STATS.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nadjusted wins on {wins}/{len(M)} stats\n", flush=True)

    D = v2.build()
    y = D["y_fg_tot_resid"].astype(float)
    yb = pd.Series(np.where(y > 0, 1.0, np.where(y < 0, 0.0, np.nan)), index=D.index)
    ladder(D, y, yb, pd.Series(v2.to_dec(D["t60_total_over_price"]), index=D.index),
           pd.Series(v2.to_dec(D["t60_total_under_price"]), index=D.index),
           2.0, "NBA total", "NBA_ADJ_TOTAL.md")

    import nba_spread_dims as sd
    S = sd.build_spread()
    ys = S["y_fg_marg_resid"].astype(float)
    ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=S.index)
    ladder(S, ys, ybs, pd.Series(v2.to_dec(S["t60_spread_home_price"]), index=S.index),
           pd.Series(v2.to_dec(S["t60_spread_away_price"]), index=S.index),
           1.5, "NBA spread", "NBA_ADJ_SPREAD.md")


if __name__ == "__main__":
    main()
