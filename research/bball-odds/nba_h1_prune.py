#!/usr/bin/env python3
"""Which features help the ORIGINATOR first-half models? Family ablation, both 1H markets.

FIRST, THE THING THAT WAS BROKEN. The cache carries **179 first-half feature columns** — rolling
1H totals and margins, each team's share of its scoring that comes in the first half, 1H ATS and
O/U streaks, over l3/l5/l10/season-to-date — and **only 4 of them were reaching any model.**
`wide_stack` selects via `nba_total_v2.feature_cols`, an a-priori theme list curated for the
FULL-GAME total, and the 1H block was simply never added to it. This is the identical failure that
was crippling the full-game models until `nba_blocks.py` wired in the player tables, and per
`feature-pruning-drop-one-vs-solo` rule 1 it is worth more than any pruning decision. Extended at
the CALL SITE, not by editing `wide_stack`, which four other scripts depend on.

TWO MARKETS, TWO TARGETS, ONE PANEL. The 1H total predicts own-team first-half POINTS and adds the
two rows; the 1H spread predicts own-minus-opp first-half MARGIN and averages the two perspectives.
Same split as the full game, and the ablations are run separately because the full-game pair already
proved the two markets want opposite feature sets (see `nba-originator-total-model`).

THREE 1H-SPECIFIC FACTS, all measured on the repaired frame before anything was fit:
  * **Only 3,961 of 5,279 games have 1H lines** — 2023/2024/2025. The Odds API has no 1H market
    before 2023-05-03, so 2022 grades nothing. Three seasons to survive, not four. The model still
    TRAINS on all 5,279 (first-half scores exist for every game); only grading is restricted.
  * **The 1H total has no over-bias.** Mean 1H total residual is +0.093 points and the over hits
    49.68% — unlike the full game's +0.675 / 50.7%. So the full-game baseline correction does NOT
    carry over here, and `pa.grade`'s in-slice base rate handles it either way.
  * **1H prices are already DECIMAL** (1.80-2.00), where the full-game T-60 columns are American.
    `to_dec` is idempotent over that range, but the range is asserted rather than assumed.
"""
import importlib.util
import os
import re
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "data", "parquet", "_nba_wide_cache.parquet")
OUT = os.path.join(ROOT, "NBA_H1_ORIG.md")
QS = (0.85, 0.91)

# Every market-derived column, full-game and first-half. `impl` (own minus opp) IS the posted FG
# spread; the h1_* line and price columns are the numbers the model is supposed to disagree with.
MARKET_EXACT = {"impl", "t60_total_point", "h1_spread", "h1_total_line",
                "h1_sp_h", "h1_sp_a", "h1_ov", "h1_un"}
MARKET_PAT = re.compile(r"^(own_|opp_)?(mk|mkt)_")

# 1H families are listed FIRST so they win the match: `own_l3_h1_total` starts with `l3_` and would
# otherwise be swallowed by the `form` family and become invisible to the ablation.
H1_FAMILIES = [("h1_streak", r"strk_h1"), ("h1_form", r"h1")]


def famof(c):
    pr = _mod("pr", "nba_prune.py")
    b = re.sub(r"^(own_|opp_)", "", c)
    for name, pat in H1_FAMILIES:
        if re.search(pat, b):
            return name
    return pr.famof(c)


def load():
    pa = _mod("pa", "nba_panel_all.py")
    bl = _mod("bl", "nba_blocks.py")
    D = pd.read_parquet(CACHE).sort_values("date").reset_index(drop=True)
    D["date"] = pd.to_datetime(D["date"])
    D, blocks = bl.attach(D)
    flagged = set(bl.leak_screen(D, blocks, strict=False))
    if flagged:
        D = D.drop(columns=[c for c in flagged if c in D.columns])
        print(f"[h1] dropped {len(flagged)} leak-flagged column(s): "
              f"{', '.join(sorted(flagged))}", flush=True)
    D = D.sort_values("date").reset_index(drop=True)

    extra = [c for v in blocks.values() for c in v
             if c in D.columns and pd.api.types.is_numeric_dtype(D[c])
             and D[c].notna().mean() > 0.80]
    # THE FIX: the 1H feature block, which no model has ever seen. `y_` outcomes and every market
    # column are excluded here rather than after the panel is built, so a 1H line can never become
    # an own_/opp_ pair in the first place.
    h1 = [c for c in D.columns
          if "h1" in c and not c.startswith("y_") and c not in MARKET_EXACT
          and not MARKET_PAT.match(c) and pd.api.types.is_numeric_dtype(D[c])
          and D[c].notna().mean() > 0.70]
    print(f"[h1] attaching {len(h1)} first-half columns that were never in the stack", flush=True)

    stack = list(dict.fromkeys(pa.wide_stack(D) + extra + h1))
    P, fcols = pa.build_panel(D, stack)
    G = D.set_index("event_id").copy()
    cols = [c for c in fcols if pd.api.types.is_numeric_dtype(P[c])
            and c not in MARKET_EXACT and not MARKET_PAT.match(c)]

    leaked = [c for c in cols if c in MARKET_EXACT or MARKET_PAT.match(c)]
    assert not leaked, f"market column survived into the originator stack: {leaked}"
    return pa, P, G, cols


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def markets(pa, P, G):
    """The two 1H bet rules. Each returns its target, its reducer, and everything grading needs."""
    sgn = np.where(P["team_row"] == "home", 1.0, -1.0)

    def dec(s):
        d = pd.Series(pa.v2.to_dec(s), index=G.index)
        ok = d.dropna()
        assert ok.between(1.4, 3.0).all(), f"1H price out of range after to_dec: {ok.min()}-{ok.max()}"
        return d

    def red_tot(pred):
        t = P.assign(p=pred)[["event_id", "team_row", "p"]]
        g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
        return (g["home"] + g["away"]) - G["h1_total_line"].astype(float)

    def red_sp(pred):
        t = P.assign(p=pred)[["event_id", "team_row", "p"]]
        g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
        return (g["home"] - g["away"]) / 2.0 + G["h1_spread"].astype(float)

    return {
        "1H_TOTAL": dict(
            y=pd.Series(P["h1"].astype(float).to_numpy(), index=P.index), reduce=red_tot,
            resid=G["y_h1_tot_resid"].astype(float), po=dec(G["h1_ov"]), pu=dec(G["h1_un"])),
        "1H_SPREAD": dict(
            y=pd.Series(P["event_id"].map(G["y_h1_margin"]).astype(float) * sgn, index=P.index),
            reduce=red_sp,
            resid=G["y_h1_marg_resid"].astype(float), po=dec(G["h1_sp_h"]), pu=dec(G["h1_sp_a"])),
    }


def main():
    pa, P, G, cols = load()
    fam = pd.Series({c: famof(c) for c in cols})
    counts = fam.value_counts()
    print(f"[h1] {len(P):,} team-games | {len(cols)} originator features "
          f"({int(counts.get('h1_form', 0)) + int(counts.get('h1_streak', 0))} first-half)",
          flush=True)
    print(counts.to_string(), flush=True)

    rows = []
    for mkt, S in markets(pa, P, G).items():
        resid = S["resid"]
        yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
        # ORACLE -- the realised residual through the very rule every config is graded by.
        o = pa.grade(resid, yb, S["po"], S["pu"], 0)
        assert o["win"] > 99.5, f"{mkt} oracle {o['win']:.1f}% -- grader sign is inverted"
        print(f"\n[{mkt}] gradeable {int(yb.notna().sum()):,} games | oracle {o['win']:.1f}% "
              f"| favoured side hits {100*yb.mean():.2f}% | mean resid {resid.mean():+.3f} pts",
              flush=True)

        def record(tag, kind, use):
            if len(use) < 3:
                return
            d = S["reduce"](pa.ridge_multi(P[use].astype(float), P["date"], [S["y"]])[0])
            a = d[d.notna() & yb.notna()].abs()
            r = dict(market=mkt, tag=tag, kind=kind, k=len(use), corr=float(d.corr(resid)))
            for q, lab in zip(QS, ("15", "9")):
                g = pa.grade(d, yb, S["po"], S["pu"], a.quantile(q))
                r[f"n{lab}"], r[f"roi{lab}"] = g["n"], g["roi"]
                r[f"w{lab}"], r[f"b{lab}"] = g["win"], g["base"]
            rows.append(r)
            print(f"  {kind:9s} {tag:12s} k={len(use):3d}  corr {r['corr']:+.4f}  "
                  f"top15% {r['roi15']:+6.2f}%  top9% {r['roi9']:+6.2f}%", flush=True)

        record("ALL", "base", cols)
        for name in counts.index:
            record(name, "drop-one", [c for c in cols if fam[c] != name])
        for name in counts.index:
            record(name, "solo", [c for c in cols if fam[c] == name])

    R = pd.DataFrame(rows)
    R.to_parquet(os.path.join(ROOT, "data", "parquet", "_nba_h1_prune.parquet"), index=False)
    write(R, counts)


def write(R, counts):
    L = ["# NBA — the originator first-half models", "",
         "Predict first-half points (total) and first-half margin (spread) with **no market column "
         "anywhere**, then bet the disagreement with the posted 1H number. `nba_h1_prune.py`.", "",
         "**175 first-half feature columns were sitting in the cache unread** — `wide_stack` "
         "selects through a theme list curated for the full-game total, and the 1H block was never "
         "added to it. Only 4 of 179 were reaching any model before this run.", "",
         "**Three seasons, not four.** The Odds API has no 1H market before 2023-05-03, so 2022 "
         "grades nothing (3,961 of 5,279 games are gradeable). Training still uses all 5,279.", ""]
    for mkt in R["market"].unique():
        M = R[R["market"] == mkt]
        base = M[M["kind"] == "base"].iloc[0]
        L += [f"## {mkt}", "",
              f"Baseline: **{int(base['k'])} features**, corr with the realised residual "
              f"{base['corr']:+.4f}, **{base['roi15']:+.2f}%** ROI on the top 15% of "
              f"disagreements and **{base['roi9']:+.2f}%** on the top 9%.", "",
              "### Drop-one — positive delta means cutting the family HELPS", "",
              "| family | cols | ROI top 15% | delta | ROI top 9% | delta |",
              "|---|---|---|---|---|---|"]
        for _, r in M[M["kind"] == "drop-one"].sort_values("roi15", ascending=False).iterrows():
            L.append(f"| {r['tag']} | {counts[r['tag']]} | {r['roi15']:+.2f} | "
                     f"**{r['roi15']-base['roi15']:+.2f}** | {r['roi9']:+.2f} | "
                     f"**{r['roi9']-base['roi9']:+.2f}** |")
        L += ["", "### Solo — does the family carry anything by itself?", "",
              "| family | cols | corr | ROI top 15% | ROI top 9% |", "|---|---|---|---|---|"]
        for _, r in M[M["kind"] == "solo"].sort_values("roi15", ascending=False).iterrows():
            L.append(f"| {r['tag']} | {counts[r['tag']]} | {r['corr']:+.4f} | "
                     f"{r['roi15']:+.2f} | {r['roi9']:+.2f} |")
        L.append("")
    open(OUT, "w").write("\n".join(L))
    print(f"\nwrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
