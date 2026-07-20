#!/usr/bin/env python3
"""NCAAB totals model v1 — walk-forward, graded vs the T-60 close.

Two variants:
  RAW      — no market inputs; predicts the total from team features alone.
             Edge = prediction - T-60 close.
  RESIDUAL — predicts (actual - T-60 close) with market features included
             (open, close, movement) — models where the market errs.
             Edge = predicted residual. (NFL 1H model's winning shape.)

Walk-forward: train on all seasons strictly before the test season
(2023-24, 2024-25, 2025-26 tested; 2022-23 is train-only). Bets at T-60
consensus price (decimal). Per-season breakdowns always shown.

Writes NCAAB_MODEL_BRIEF1.md.
"""
import os

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

SEASONS = ["2022-23", "2023-24", "2024-25", "2025-26"]
MARKET_FEATS = ["open_total_point", "t60_total_point", "tmove",
                "open_spread_home_point", "t60_spread_home_point"]


def load():
    df = pd.read_parquet(f"{OUT}/ncaab_model_features.parquet")
    if "season" not in df.columns:  # games/mg merge suffixed the duplicate col
        df = df.rename(columns={"season_x": "season"})
    df = df.dropna(subset=["total_actual", "t60_total_point"]).copy()
    df["tmove"] = df["t60_total_point"] - df["open_total_point"]
    feats = [c for c in df.columns
             if c.startswith(("home_s2d_", "away_s2d_", "home_l5_", "away_l5_",
                              "home_kp_", "away_kp_"))
             or c in ("home_game_num", "away_game_num", "home_rest_days",
                      "away_rest_days", "home_b2b", "away_b2b")]
    return df, feats


def fit_predict(df, feats, test_season, target_col, extra_feats=()):
    cols = feats + list(extra_feats)
    tr = df[df["season"] < test_season]
    te = df[df["season"] == test_season]
    model = HistGradientBoostingRegressor(
        max_iter=400, learning_rate=0.05, max_depth=None, max_leaf_nodes=31,
        min_samples_leaf=40, l2_regularization=1.0, random_state=7)
    model.fit(tr[cols], tr[target_col])
    return te.index, model.predict(te[cols])


def bet_table(df, edge_col, lines, title):
    lines.append(f"\n### {title}\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    total = df["total_actual"]
    line = df["t60_total_point"]
    push = total == line
    for thr in (2, 3, 4, 5, 6, 8):
        for side, mask, win, dec in (
                ("OVER", df[edge_col] >= thr, total > line, df["t60_total_over_price"]),
                ("UNDER", df[edge_col] <= -thr, total < line, df["t60_total_under_price"])):
            sub = df[mask]
            if int((~push[mask]).sum()) < 30:
                continue
            w = win[mask] & ~push[mask]
            profit = np.where(push[mask], 0.0,
                              np.where(win[mask], dec[mask].fillna(1.909) - 1, -1.0))
            n = int((~push[mask]).sum())
            wr = w.sum() / n * 100
            roi = profit.mean() * 100
            per = []
            for s, g in sub.assign(w=w, p=push[mask], pr=profit).groupby("season"):
                m = int((~g["p"]).sum())
                if m:
                    per.append(f"{s}: {g['w'].sum()}/{m} {g['w'].sum()/m*100:.0f}% {g['pr'].mean()*100:+.0f}%")
            lines.append(f"| edge ≥{thr} → {side} | {n:,} | {wr:.1f}% | {roi:+.1f}% | {' · '.join(per)} |")


def main():
    df, feats = load()
    lines = ["# NCAAB Totals Model Brief #1 (walk-forward)",
             "",
             f"{len(df):,} games; features = s2d/l5 boxscore + schedule + dated KenPom.",
             "Train = strictly prior seasons; test seasons 2023-24 → 2025-26.",
             "All bets at T-60 consensus line & decimal price. Breakeven 52.4%."]

    df["pred_raw"] = np.nan
    df["pred_resid"] = np.nan
    df["resid_target"] = df["total_actual"] - df["t60_total_point"]
    for ts in SEASONS[1:]:
        idx, p = fit_predict(df, feats, ts, "total_actual")
        df.loc[idx, "pred_raw"] = p
        idx, p = fit_predict(df, feats, ts, "resid_target", extra_feats=MARKET_FEATS)
        df.loc[idx, "pred_resid"] = p
        n_tr = (df["season"] < ts).sum()
        print(f"[{ts}] trained on {n_tr:,} games", flush=True)

    te = df.dropna(subset=["pred_raw"]).copy()
    te["edge_raw"] = te["pred_raw"] - te["t60_total_point"]
    te["edge_resid"] = te["pred_resid"]

    mae_market = (te["total_actual"] - te["t60_total_point"]).abs().mean()
    mae_raw = (te["total_actual"] - te["pred_raw"]).abs().mean()
    corr = te[["edge_raw", "resid_target"]].corr().iloc[0, 1]
    corr_r = te[["edge_resid", "resid_target"]].corr().iloc[0, 1]
    lines.append(f"\n**Accuracy (test seasons):** market MAE {mae_market:.2f}, raw-model MAE "
                 f"{mae_raw:.2f}. Edge↔actual-residual corr: raw {corr:.3f}, residual {corr_r:.3f}.")
    lines.append(f"Raw-model edge distribution: |edge|≥3 in {(te['edge_raw'].abs()>=3).mean()*100:.0f}% "
                 f"of games, ≥5 in {(te['edge_raw'].abs()>=5).mean()*100:.0f}%.")

    bet_table(te, "edge_raw", lines, "RAW model (no market inputs) — edge vs T-60 close")
    bet_table(te, "edge_resid", lines, "RESIDUAL model (market-aware) — predicted residual as edge")

    # agreement filter: both models point the same way
    te["agree_edge"] = np.where(np.sign(te["edge_raw"]) == np.sign(te["edge_resid"]),
                                np.sign(te["edge_raw"]) * np.minimum(
                                    te["edge_raw"].abs(), te["edge_resid"].abs() * 3), 0.0)
    bet_table(te, "agree_edge", lines,
              "AGREEMENT (raw & residual same direction; edge = min(raw, 3×resid))")

    path = os.path.join(ROOT, "NCAAB_MODEL_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
