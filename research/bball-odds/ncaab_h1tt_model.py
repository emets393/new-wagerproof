#!/usr/bin/env python3
"""NCAAB model v1 aimed at the SOFTER markets: 1H totals + team totals.

Same feature table and walk-forward protocol as ncaab_totals_model.py, but the
targets are 1H total points and per-team points; edges are measured against
the h1tt T-60 closes (available 2023-24 onward; 1H ACTUALS exist for all 4
seasons so training uses 2022-23 too).

Writes NCAAB_H1TT_MODEL_BRIEF1.md.
"""
import glob
import os

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from movement_study import am_to_dec

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

SEASONS = ["2022-23", "2023-24", "2024-25", "2025-26"]
H1TT_PRICE_COLS = ["h1_total_over_price", "h1_total_under_price",
                   "tt_home_over_price", "tt_home_under_price",
                   "tt_away_over_price", "tt_away_under_price"]


def load():
    df = pd.read_parquet(f"{OUT}/ncaab_model_features.parquet")
    if "season" not in df.columns:
        df = df.rename(columns={"season_x": "season"})
    h = pd.concat([pd.read_parquet(p) for p in
                   sorted(glob.glob(f"{OUT}/h1tt_ncaab_*.parquet"))], ignore_index=True)
    for c in H1TT_PRICE_COLS:
        h[c] = am_to_dec(h[c])
    cons = h.groupby("event_id")[
        ["h1_total_point", "tt_home_point", "tt_away_point"] + H1TT_PRICE_COLS
    ].median()
    df = df.merge(cons, on="event_id", how="left")
    df = df.dropna(subset=["total_actual"]).copy()
    feats = [c for c in df.columns
             if c.startswith(("home_s2d_", "away_s2d_", "home_l5_", "away_l5_",
                              "home_kp_", "away_kp_"))
             or c in ("home_game_num", "away_game_num", "home_rest_days",
                      "away_rest_days", "home_b2b", "away_b2b")]
    return df, feats


def walk_forward(df, feats, target_col, out_col):
    df[out_col] = np.nan
    for ts in SEASONS[1:]:
        tr = df[(df["season"] < ts) & df[target_col].notna()]
        te = df[df["season"] == ts]
        model = HistGradientBoostingRegressor(
            max_iter=400, learning_rate=0.05, max_leaf_nodes=31,
            min_samples_leaf=40, l2_regularization=1.0, random_state=7)
        model.fit(tr[feats], tr[target_col])
        df.loc[te.index, out_col] = model.predict(te[feats])
    return df


def bet_rows(df, edge, actual, line, over_dec, under_dec, tag, lines):
    push = actual == line
    for thr in (1, 2, 3, 4):
        for side, mask, win, dec in (
                ("OVER", edge >= thr, actual > line, over_dec),
                ("UNDER", edge <= -thr, actual < line, under_dec)):
            mask = mask & line.notna() & actual.notna()
            n = int((mask & ~push).sum())
            if n < 30:
                continue
            w = win & mask & ~push
            profit = pd.Series(np.where(win, dec.fillna(1.909) - 1, -1.0), index=df.index)
            profit[push] = 0.0
            wr = w.sum() / n * 100
            roi = profit[mask & ~push].mean() * 100
            per = []
            for s, g in df[mask].assign(w=w[mask], p=push[mask], pr=profit[mask]).groupby("season"):
                m = int((~g["p"]).sum())
                if m:
                    per.append(f"{s}: {g['w'].sum()}/{m} {g['w'].sum()/m*100:.0f}% {g['pr'].mean()*100:+.0f}%")
            lines.append(f"| {tag} edge ≥{thr} → {side} | {n:,} | {wr:.1f}% | {roi:+.1f}% | {' · '.join(per)} |")


def main():
    df, feats = load()
    df = walk_forward(df, feats, "h1_total_actual", "pred_h1")
    df = walk_forward(df, feats, "home_score", "pred_home_pts")
    df = walk_forward(df, feats, "away_score", "pred_away_pts")
    te = df[df["pred_h1"].notna()].copy()

    lines = ["# NCAAB 1H + Team-Totals Model Brief #1 (walk-forward)",
             "",
             "Same features/protocol as the FG totals model; targets = 1H total and",
             "per-team points. Graded vs h1tt T-60 consensus closes (2023-24 onward).",
             "Breakeven 52.4%."]

    # accuracy vs market where lines exist
    m = te.dropna(subset=["h1_total_point", "h1_total_actual"])
    lines.append(f"\n**1H accuracy:** market MAE "
                 f"{(m['h1_total_actual']-m['h1_total_point']).abs().mean():.2f}, model MAE "
                 f"{(m['h1_total_actual']-m['pred_h1']).abs().mean():.2f} (n={len(m):,}).")
    mh = te.dropna(subset=["tt_home_point"])
    lines.append(f"**Home TT accuracy:** market MAE "
                 f"{(mh['home_score']-mh['tt_home_point']).abs().mean():.2f}, model MAE "
                 f"{(mh['home_score']-mh['pred_home_pts']).abs().mean():.2f} (n={len(mh):,}).")

    lines.append("\n| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    bet_rows(te, te["pred_h1"] - te["h1_total_point"], te["h1_total_actual"],
             te["h1_total_point"], te["h1_total_over_price"], te["h1_total_under_price"],
             "1H total", lines)
    bet_rows(te, te["pred_home_pts"] - te["tt_home_point"], te["home_score"],
             te["tt_home_point"], te["tt_home_over_price"], te["tt_home_under_price"],
             "home TT", lines)
    bet_rows(te, te["pred_away_pts"] - te["tt_away_point"], te["away_score"],
             te["tt_away_point"], te["tt_away_over_price"], te["tt_away_under_price"],
             "away TT", lines)

    path = os.path.join(ROOT, "NCAAB_H1TT_MODEL_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
