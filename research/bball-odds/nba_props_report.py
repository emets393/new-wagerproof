#!/usr/bin/env python3
"""Read the saved originator predictions and write NBA_PROPS_ORIGINATOR_BRIEF.md.

Separate from the fitting script so the brief can be regenerated without a refit, and so the
grading rules live in one place. Three tables per market, in order of how much weight they carry:

  PRODUCT   paired MAE, model vs the posted line, every row, nothing filtered. The line is the
            market's own point forecast so this is like-for-like, and differencing per row kills
            the "how did the game go" noise that dominates both. Highest-powered thing here.

  BANDS     disjoint quantile bands of |model - line|. Every row is in exactly one; no band is a
            subset of another. The market's MAE is printed beside the model's in every band --
            without it you cannot tell the model getting better from the book getting worse.

  LADDER    top-X% by the same edge, for direct comparison with the old NBA_PROPS_MODEL_BRIEF.md
            numbers, which is the only reason it is here.

EVERY ROI CELL CARRIES THE BLIND UNDER NEXT TO IT. Unders win 52-58% pre-juice in this data, so an
unaccompanied props ROI says nothing. `vs_blind` is the column that matters, and one sigma of its
noise is printed under each table.
"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nba_props_originator import (MARKETS, band_table, grade, ladder_table, product_table,
                                  side_table)

ROOT = os.path.dirname(os.path.abspath(__file__))
PRED = os.path.join(ROOT, "data", "parquet", "_props_preds")
DOC = os.path.join(ROOT, "NBA_PROPS_ORIGINATOR_BRIEF.md")


def sigma(n, roi_dec=1.91):
    """One sigma of ROI in points for an n-bet cell at a typical props price."""
    p = 0.5
    return 100 * np.sqrt(p * (1 - p)) * roi_dec / np.sqrt(max(n, 1))


def md(df):
    """Hand-rolled markdown — `to_markdown` needs `tabulate`, which is not installed here."""
    def cell(v):
        if isinstance(v, float):
            return "" if pd.isna(v) else f"{v:.2f}"
        return str(v)
    head = "| " + " | ".join(df.columns) + " |"
    rule = "|" + "|".join("---" for _ in df.columns) + "|"
    body = ["| " + " | ".join(cell(v) for v in r) + " |" for r in df.itertuples(index=False)]
    return "\n".join([head, rule] + body)


def season_table(R, mn, venue):
    pred = R[mn]
    edge = (pred - R["cons_line"]).abs()
    ok = pred.notna() & R["y_cons"].notna()
    thr = edge[ok].quantile(0.75)
    rows = []
    for s, g in R.groupby("season_x"):
        sel = pd.Series(False, index=R.index)
        sel.loc[g.index] = True
        sel &= ok & (edge >= thr)
        over = pred > R["cons_line"]
        n, w, roi = grade(R, sel, over, venue)
        bn, bw, broi = grade(R, sel, pd.Series(False, index=R.index), venue)
        rows.append(dict(season=s, n=n, win=w, roi=roi, blind_roi=broi, vs_blind=roi - broi))
    return pd.DataFrame(rows)


def main():
    parts = ["# NBA player props — the originator rebuild",
             "",
             "`nba_props_blocks.py` + `nba_props_originator.py`. Regenerate with "
             "`python3 nba_props_report.py`; **this file is written wholesale, do not edit it.**",
             "",
             "The predecessor (`nba_props_model.py`) classified the sign of the residual and never "
             "beat a blind under at any cut or venue. This predicts the raw stat with the line as a "
             "feature and adds the opponent context the panel never had. Read `vs_blind`, not `roi`.",
             ""]

    summary = []
    for mk in MARKETS:
        f = os.path.join(PRED, f"{mk}.parquet")
        if not os.path.exists(f):
            continue
        R = pd.read_parquet(f)
        parts += [f"## {mk}", ""]
        for mn in ("lgbm", "ridge"):
            if mn not in R.columns or R[mn].notna().sum() < 500:
                continue
            pt = product_table(R, R[mn])
            parts += [f"### {mn}", "",
                      f"**PRODUCT** — {pt['n']:,} rows. model MAE **{pt['model']:.3f}** vs line "
                      f"**{pt['market']:.3f}**, model better by **{pt['better']:+.4f}**, "
                      f"paired t **{pt['t']:+.2f}**.", ""]
            for venue in ("cons", "best"):
                B = band_table(R, R[mn], venue)
                L = ladder_table(R, R[mn], venue)
                parts += [f"**Bands @ {venue}** (disjoint, nothing filtered)", "", md(B), "",
                          f"_one sigma on a {int(B['n'].median())}-bet band ≈ "
                          f"±{sigma(B['n'].median()):.2f} ROI points_", "",
                          f"**Ladder @ {venue}**", "", md(L), ""]
            parts += ["**By side, top 25% by edge, best price** — `base_roi` is that side bet "
                      "blindly on EVERY row of the market, which is the only non-degenerate "
                      "baseline for the under half.", "",
                      md(side_table(R, R[mn], "best")), ""]
            S = season_table(R, mn, "best")
            parts += ["**Per season, top 25% by edge, best price**", "", md(S), ""]
            top = ladder_table(R, R[mn], "best")
            summary.append(dict(market=mk, model=mn,
                                line=R["cons_line"].median(),
                                mae_better=pt["better"], t=pt["t"],
                                n_25=top.loc[2, "n"], win_25=top.loc[2, "win"],
                                need_25=top.loc[2, "need"], roi_25=top.loc[2, "roi"],
                                vsblind_25=top.loc[2, "vs_blind"],
                                seasons_up=int((S["vs_blind"] > 0).sum())))
        parts.append("")

    if summary:
        S = pd.DataFrame(summary)
        parts = parts[:5] + ["## Every market at a glance", "",
                             "`mae_better` is the paired product test (positive = model beats the "
                             "line as a forecast). `vsblind_*` is ROI minus the blind under on the "
                             "same rows, at best price.", "", md(S), ""] + parts[5:]

    open(DOC, "w").write("\n".join(parts) + "\n")
    print(f"wrote {DOC} ({len(parts)} blocks)", flush=True)
    if summary:
        print(pd.DataFrame(summary).to_string(index=False, float_format="%.2f"), flush=True)


if __name__ == "__main__":
    main()
