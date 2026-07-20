#!/usr/bin/env python3
"""NCAAB model v2 — style-interaction features + model×signal confluence.

v1 features (s2d/l5 box + schedule + dated KenPom) + NEW:
  per-side style percentiles (3P/paint/FT shares, defensive channel weakness)
  explicit strength×weakness cross-products per channel (the interactions the
  market underweights per STYLE_BRIEF1)

Targets: FG total + per-team points (TT). Walk-forward as v1. Then the
confluence cut our successful systems use: MODEL edge aligned with the
STYLE composite — not either alone.

Writes NCAAB_MODEL_BRIEF2.md.
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

CHANNELS = (("p3_share", "d_p3_pct"), ("paint_share", "d_paint100"), ("ftr", "d_ftr"))


def load():
    df = pd.read_parquet(f"{OUT}/ncaab_model_features.parquet")
    if "season" not in df.columns:
        df = df.rename(columns={"season_x": "season"})
    st = pd.read_parquet(f"{OUT}/style_ncaab.parquet")
    pct_cols = [c for c in st.columns if c.startswith("pct_")]
    for side, is_home in (("h", True), ("a", False)):
        s = st[st["is_home"] == is_home][["game_key"] + pct_cols]
        s.columns = ["cbbd_id"] + [f"{side}_{c}" for c in pct_cols]
        df = df.merge(s, on="cbbd_id", how="left")

    # channel cross-products: my offense strength × your defensive weakness
    for att, deff in (("h", "a"), ("a", "h")):
        advs = []
        for oc, dc in CHANNELS:
            col = f"{att}_adv_{oc}"
            df[col] = (df[f"{att}_pct_{oc}"] - .5) * (df[f"{deff}_pct_{dc}"] - .5)
            advs.append(col)
        df[f"{att}_style_adv"] = df[advs].sum(axis=1, min_count=1)
    df["both_adv"] = df[["h_style_adv", "a_style_adv"]].min(axis=1)
    df["pace_clash"] = df["h_pct_pace"] + df["a_pct_pace"]

    h = pd.concat([pd.read_parquet(p) for p in
                   sorted(glob.glob(f"{OUT}/h1tt_ncaab_*.parquet"))], ignore_index=True)
    for c in ("tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"):
        h[c] = am_to_dec(h[c])
    cons = h.groupby("event_id")[["tt_home_point", "tt_home_over_price",
                                  "tt_home_under_price", "tt_away_point",
                                  "tt_away_over_price", "tt_away_under_price"]].median()
    df = df.merge(cons, on="event_id", how="left")
    df = df.dropna(subset=["total_actual", "t60_total_point"]).copy()

    base = [c for c in df.columns
            if c.startswith(("home_s2d_", "away_s2d_", "home_l5_", "away_l5_",
                             "home_kp_", "away_kp_"))
            or c in ("home_game_num", "away_game_num", "home_rest_days",
                     "away_rest_days", "home_b2b", "away_b2b")]
    style = ([f"{s}_pct_{c}" for s in ("h", "a") for c in
              ("pace", "p3_share", "paint_share", "ft_share", "p3a_rate", "p3_pct",
               "ftr", "oreb", "d_p3_pct", "d_p3a_rate", "d_paint100", "d_ftr", "d_efg")]
             + [f"{s}_adv_{oc}" for s in ("h", "a") for oc, _ in CHANNELS]
             + ["h_style_adv", "a_style_adv", "both_adv", "pace_clash"])
    return df, base, style


def walk_forward(df, feats, target, out_col):
    df[out_col] = np.nan
    for ts in SEASONS[1:]:
        tr = df[(df["season"] < ts) & df[target].notna()]
        te = df[df["season"] == ts]
        m = HistGradientBoostingRegressor(max_iter=400, learning_rate=0.05,
                                          max_leaf_nodes=31, min_samples_leaf=40,
                                          l2_regularization=1.0, random_state=7)
        m.fit(tr[feats], tr[target])
        df.loc[te.index, out_col] = m.predict(te[feats])
    return df


def bucket(df, edge, actual, line, over_dec, under_dec, tag, lines, thrs=(2, 3, 4, 5)):
    has = line.notna() & actual.notna()
    push = (actual == line) | ~has
    for thr in thrs:
        for side, mask, win, dec in (("OVER", edge >= thr, actual > line, over_dec),
                                     ("UNDER", edge <= -thr, actual < line, under_dec)):
            mask = mask & has
            n = int((mask & ~push).sum())
            if n < 30:
                continue
            w = win & mask & ~push
            profit = pd.Series(np.where(win, dec.fillna(1.909) - 1, -1.0), index=df.index)
            profit[push] = 0.0
            per = []
            for s, g in df[mask].assign(w=w[mask], p=push[mask], pr=profit[mask]).groupby("season"):
                m = int((~g["p"]).sum())
                if m:
                    per.append(f"{s}: {g['w'].sum()}/{m} {g['w'].sum()/m*100:.0f}% {g['pr'][~g['p']].mean()*100:+.0f}%")
            lines.append(f"| {tag} edge ≥{thr} → {side} | {n:,} | {w.sum()/n*100:.1f}% | "
                         f"{profit[mask & ~push].mean()*100:+.1f}% | {' · '.join(per)} |")


def main():
    df, base, style = load()
    for target, out in (("total_actual", "p_tot"), ("home_score", "p_h"),
                        ("away_score", "p_a")):
        df = walk_forward(df, base + style, target, out)
        print(f"trained {target}", flush=True)
    te = df[df["p_tot"].notna()].copy()

    lines = ["# NCAAB Model Brief #2 — style-interaction features + confluence",
             "",
             f"{len(te):,} test games (2023-24 → 2025-26 walk-forward)."]
    mae_m = (te["total_actual"] - te["t60_total_point"]).abs().mean()
    mae_v2 = (te["total_actual"] - te["p_tot"]).abs().mean()
    lines.append(f"\n**FG totals MAE:** market {mae_m:.2f} | v2 model {mae_v2:.2f} "
                 f"(v1 was 13.57).")

    te["edge_tot"] = te["p_tot"] - te["t60_total_point"]
    total = te["total_actual"]
    lines.append("\n## v2 FG-total edge buckets\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    bucket(te, te["edge_tot"], total, te["t60_total_point"],
           te["t60_total_over_price"], te["t60_total_under_price"], "v2", lines)

    lines.append("\n## Confluence: model edge ALIGNED with style composite\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    both_hi = te["both_adv"] >= te["both_adv"].quantile(0.8)
    for thr in (1, 2, 3):
        sub = te[(te["edge_tot"] >= thr) & both_hi]
        w = (total > te["t60_total_point"])[sub.index]
        p = (total == te["t60_total_point"])[sub.index]
        n = int((~p).sum())
        if n >= 30:
            profit = np.where(p, 0, np.where(w, sub["t60_total_over_price"].fillna(1.909) - 1, -1))
            per = []
            for s, g in sub.assign(w=w & ~p, p=p, pr=profit).groupby("season"):
                m = int((~g["p"]).sum())
                if m:
                    per.append(f"{s}: {g['w'].sum()}/{m} {g['w'].sum()/m*100:.0f}% {g['pr'][~g['p']].mean()*100:+.0f}%")
            lines.append(f"| model edge ≥{thr} AND both style-adv (top quintile) → OVER | {n:,} | "
                         f"{(w & ~p).sum()/n*100:.1f}% | {profit[~p].mean()*100:+.1f}% | {' · '.join(per)} |")

    lines.append("\n## Team-total edge buckets (v2 per-team models)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    bucket(te, te["p_h"] - te["tt_home_point"], te["home_score"], te["tt_home_point"],
           te["tt_home_over_price"], te["tt_home_under_price"], "home TT", lines, (1, 2, 3, 4))
    bucket(te, te["p_a"] - te["tt_away_point"], te["away_score"], te["tt_away_point"],
           te["tt_away_over_price"], te["tt_away_under_price"], "away TT", lines, (1, 2, 3, 4))

    # confluence on TT: model edge over + team is style-advantaged
    lines.append("\n## Confluence: TT model edge + that team style-advantaged\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for side, pcol, tcol, ocol, adv in (("home", "p_h", "tt_home_point", "tt_home_over_price", "h_style_adv"),
                                        ("away", "p_a", "tt_away_point", "tt_away_over_price", "a_style_adv")):
        adv_hi = te[adv] >= te[adv].quantile(0.8)
        for thr in (1, 2):
            sub = te[(te[pcol] - te[tcol] >= thr) & adv_hi]
            pts = sub["home_score"] if side == "home" else sub["away_score"]
            w = pts > sub[tcol]
            p = (pts == sub[tcol]) | sub[tcol].isna()
            n = int((~p).sum())
            if n >= 30:
                profit = np.where(p, 0, np.where(w, sub[ocol].fillna(1.909) - 1, -1))
                per = []
                for s, g in sub.assign(w=w & ~p, p=p, pr=profit).groupby("season"):
                    m = int((~g["p"]).sum())
                    if m:
                        per.append(f"{s}: {g['w'].sum()}/{m} {g['w'].sum()/m*100:.0f}% {g['pr'][~g['p']].mean()*100:+.0f}%")
                lines.append(f"| {side} TT model edge ≥{thr} AND team style-adv top quintile → TT OVER | "
                             f"{n:,} | {(w & ~p).sum()/n*100:.1f}% | {profit[~p].mean()*100:+.1f}% | {' · '.join(per)} |")

    path = os.path.join(ROOT, "NCAAB_MODEL_BRIEF2.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
