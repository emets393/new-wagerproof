#!/usr/bin/env python3
"""Which features help the ORIGINATOR total model? Family ablation, same recipe as the spread.

WHY THIS IS RUN FRESH RATHER THAN INHERITING `CORE`. The spread ablation named `rapm` + `pl_regr`
and told us to cut `usage`. But `nba-total-model-null` records that **usage concentration is the
load-bearing theme of the total** — a family the spread wants deleted. Two markets, two different
information sets. Assuming the spread's answer transfers is exactly the shortcut that put 96 raw
box columns in a model nobody had ever ablated.

THE TARGET IS OWN-TEAM POINTS, with no market column anywhere. The model total is the two rows
added together; the bet is the disagreement with the posted number. Contrast the spread, which
predicts own-minus-opp margin off the same panel — one model per market, each predicting the RAW
quantity rather than a residual against the line (`predict-the-raw-quantity-not-the-residual`).

TWO TOTAL-SPECIFIC TRAPS, both already paid for once:
  * The NBA total's baseline is **+0.675 points, not zero** — games run over the T-60 close and the
    over hits 50.2%. `pa.grade` takes the in-slice base rate, so this is handled, but any hand-rolled
    "is it above 50" reading of a total cell is wrong by construction.
  * The panel has two rows per game; the total is a GAME-level quantity. Reduce to one row per
    `event_id` before grading or every game is counted twice.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "NBA_TOTAL_ORIG.md")
QS = (0.85, 0.91)


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def setup():
    """Panel, features and every input the total bet rule needs. Shared by the later stages."""
    pr = _mod("pr", "nba_prune.py")
    pa, P, G, cols = pr.load()
    fam = pd.Series({c: pr.famof(c) for c in cols})

    # own-team points: the raw quantity, one model, both rows
    pts = np.where(P["team_row"] == "home", P["event_id"].map(G["y_home_pts"]),
                   P["event_id"].map(G["y_away_pts"]))
    y = pd.Series(pts.astype(float), index=P.index)

    line = G["t60_total_point"].astype(float)
    resid = G["y_fg_tot_resid"].astype(float)
    yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
    po = pd.Series(pa.v2.to_dec(G["t60_total_over_price"]), index=G.index)
    pu = pd.Series(pa.v2.to_dec(G["t60_total_under_price"]), index=G.index)

    # ORACLE -- feed the realised residual into the rule everything is graded by. Wins ~100% when
    # the sign is coherent. This is the check that caught the inverted spread grader.
    o = pa.grade(resid, yb, po, pu, 0)
    assert o["win"] > 99.5, f"oracle {o['win']:.1f}% -- total grader sign is inverted"
    print(f"[total] {len(P):,} team-games | {len(cols)} originator features | oracle {o['win']:.1f}% "
          f"| over hits {100*yb.mean():.1f}% | mean resid {resid.mean():+.3f} pts", flush=True)
    return pa, P, G, cols, fam, y, line, resid, yb, po, pu


def to_game(pa, P, G, pred, line):
    """Panel prediction -> model total minus the posted total, one row per game."""
    t = P.assign(p=pred)[["event_id", "team_row", "p"]]
    g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
    return (g["home"] + g["away"]) - line          # + means the model is OVER the number


def main():
    pa, P, G, cols, fam, y, line, resid, yb, po, pu = setup()
    counts = fam.value_counts()
    print(counts.to_string(), flush=True)

    rows = []

    def record(tag, kind, use):
        if len(use) < 3:
            return
        pred = pa.ridge_multi(P[use].astype(float), P["date"], [y])[0]
        d = to_game(pa, P, G, pred, line)
        a = d[d.notna() & yb.notna()].abs()
        r = dict(tag=tag, kind=kind, k=len(use), corr=float(d.corr(resid)))
        for q, lab in zip(QS, ("15", "9")):
            g = pa.grade(d, yb, po, pu, a.quantile(q))
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
    R.to_parquet(os.path.join(ROOT, "data", "parquet", "_nba_total_prune.parquet"), index=False)
    write(R, counts)


def write(R, counts):
    base = R[R["kind"] == "base"].iloc[0]
    L = ["# NBA — the originator total model", "",
         "Predict own-team points with **no market column anywhere**, add the two rows, bet the "
         "disagreement with the posted total. `nba_total_prune.py`. Run fresh rather than "
         "inheriting the spread's `CORE`, because the two markets do not share an information set.",
         "",
         f"Baseline: **{int(base['k'])} features**, corr with the realised residual "
         f"{base['corr']:+.4f}, **{base['roi15']:+.2f}%** ROI on the top 15% of disagreements and "
         f"**{base['roi9']:+.2f}%** on the top 9%.", "",
         "## Drop-one — does the model improve without this family?", "",
         "**Positive delta means cutting the family HELPS.** This column decides what gets cut; "
         "solo only says whether the information exists at all.", "",
         "| family | cols | ROI top 15% | delta | ROI top 9% | delta |", "|---|---|---|---|---|---|"]
    for _, r in R[R["kind"] == "drop-one"].sort_values("roi15", ascending=False).iterrows():
        L.append(f"| {r['tag']} | {counts[r['tag']]} | {r['roi15']:+.2f} | "
                 f"**{r['roi15']-base['roi15']:+.2f}** | {r['roi9']:+.2f} | "
                 f"**{r['roi9']-base['roi9']:+.2f}** |")
    L += ["", "## Solo — does the family carry anything by itself?", "",
          "| family | cols | corr | ROI top 15% | ROI top 9% |", "|---|---|---|---|---|"]
    for _, r in R[R["kind"] == "solo"].sort_values("roi15", ascending=False).iterrows():
        L.append(f"| {r['tag']} | {counts[r['tag']]} | {r['corr']:+.4f} | "
                 f"{r['roi15']:+.2f} | {r['roi9']:+.2f} |")
    L.append("")
    open(OUT, "w").write("\n".join(L))
    print(f"\nwrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
