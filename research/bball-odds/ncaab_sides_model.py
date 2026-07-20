#!/usr/bin/env python3
"""NCAAB SIDES model v1 (NCAAB_SIDES_MODEL_BRIEF.md) — the kitchen-sink GBM.

Two walk-forward variants on sides_table_ncaab.parquet:
  RAW    — predict home margin from team features only (no market inputs).
           Edge = prediction + T-60 home spread.
  RESID  — predict cover_amt (actual - market) with the spread/movement as
           features: models where the spread market errs.

Feature groups: dated KenPom (EM/OE/DE/tempo/rank) · boxscore s2d+l5 ·
schedule · style pcts + advantage channels · ATS/win streak features both
teams · rematch details · roster attributes (height/exp/bench/continuity) ·
availability flags BOTH teams · phase flags.

Then MAMMOTH-style confluence: model edge aligned with the S1 big_out signal.
"""
import os

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
SEASONS = ["2022-23", "2023-24", "2024-25", "2025-26"]


def load():
    df = pd.read_parquet(f"{OUT}/sides_table_ncaab.parquet")
    base = [c for c in df.columns
            if c.startswith(("home_s2d_", "away_s2d_", "home_l5_", "away_l5_",
                             "home_kp_", "away_kp_"))
            or c in ("home_game_num", "away_game_num", "home_rest_days",
                     "away_rest_days", "home_b2b", "away_b2b")]
    style = [c for c in df.columns if c.startswith(("h_pct_", "a_pct_", "h_adv_",
                                                    "a_adv_"))] \
        + ["h_style_adv", "a_style_adv"]
    streaks = ["h_l5_covers", "a_l5_covers", "h_l5_wins", "a_l5_wins",
               "h_cover_streak", "a_cover_streak", "cover_diff"]
    rematch = ["meet_no", "m1_margin_home", "m1_covamt_home", "m1_days_ago",
               "venue_flip"]
    roster = [f"{s}_{c}" for s in ("h", "a")
              for c in ("HgtEff", "Hgt5", "Exp", "Bench", "Continuity")]
    flags = [f"{s}_{c}" for s in ("h", "a")
             for c in ("top1_out", "big_out", "guard_out", "lowto_guard_out",
                       "reg_out_n", "stale_out_n")]
    phase = ["month", "nonconf"]
    df["is_conf"] = df["conferenceGame"].astype(float)
    df["is_neutral"] = df["neutralSite"].astype(float)
    phase += ["is_conf", "is_neutral"]
    feats = base + style + streaks + rematch + roster + flags + phase
    market = ["t60_spread_home_point", "open_spread_home_point"]
    return df, feats, market


def walk_forward(df, feats, target):
    pred = pd.Series(np.nan, index=df.index)
    for ts in SEASONS[1:]:
        tr = df[(df["season"] < ts) & df[target].notna()]
        te = df[df["season"] == ts]
        m = HistGradientBoostingRegressor(max_iter=500, learning_rate=0.05,
                                          max_leaf_nodes=31, min_samples_leaf=40,
                                          l2_regularization=1.0, random_state=7)
        m.fit(tr[feats], tr[target])
        pred.loc[te.index] = m.predict(te[feats])
    return pred


def buckets(df, edge, lines, tag):
    cover = df["cover_amt"]
    push = cover == 0
    for thr in (1, 2, 3, 4, 6):
        for side, mask, win, dec in (
                ("HOME", edge >= thr, cover > 0, df["t60_spread_home_price"]),
                ("AWAY", edge <= -thr, cover < 0, df["t60_spread_away_price"])):
            m = mask & ~push
            n = int(m.sum())
            if n < 30:
                continue
            w = win & m
            profit = np.where(w[m], dec[m].fillna(1.909) - 1, -1.0)
            per = []
            for s, g in df[m].assign(w=w[m], pr=profit).groupby("season"):
                if len(g):
                    per.append(f"{s}: {g['w'].sum()}/{len(g)} {g['w'].mean()*100:.0f}% {g['pr'].mean()*100:+.0f}%")
            lines.append(f"| {tag} edge ≥{thr} → {side} | {n:,} | {w.sum()/n*100:.1f}% | "
                         f"{profit.mean()*100:+.1f}% | {' · '.join(per)} |")


def main():
    df, feats, market = load()
    print(f"{len(feats)} features", flush=True)
    df["pred_margin"] = walk_forward(df, feats, "margin")
    df["pred_resid"] = walk_forward(df, feats + market, "cover_amt")
    te = df[df["pred_margin"].notna()].copy()
    te["edge_raw"] = te["pred_margin"] + te["t60_spread_home_point"]
    te["edge_resid"] = te["pred_resid"]

    lines = ["# NCAAB Sides Model Brief — kitchen-sink GBM (walk-forward)",
             "",
             f"{len(te):,} test games; {len(feats)} features (KenPom, box s2d/l5, style,",
             "streaks, rematch, roster, availability flags, phase)."]
    mae_mkt = (te["margin"] + te["t60_spread_home_point"]).abs().mean()
    mae_mod = (te["margin"] - te["pred_margin"]).abs().mean()
    corr = te[["edge_raw", "cover_amt"]].corr().iloc[0, 1]
    corr_r = te[["edge_resid", "cover_amt"]].corr().iloc[0, 1]
    lines.append(f"\n**Margin MAE:** market {mae_mkt:.2f} | model {mae_mod:.2f}. "
                 f"Edge↔cover corr: raw {corr:.3f}, resid {corr_r:.3f}.")

    lines.append("\n## RAW model edge buckets (vs T-60 spread)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    buckets(te, te["edge_raw"], lines, "raw")

    lines.append("\n## RESIDUAL model edge buckets\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    buckets(te, te["edge_resid"], lines, "resid")

    # confluence with S1: model agrees with the big_out fade
    lines.append("\n## Confluence: S1 big_out fade + model agrees\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    cover = te["cover_amt"]
    push = cover == 0
    for flag_side, bet_side, win, dec in (
            ("h", "AWAY", cover < 0, te["t60_spread_away_price"]),
            ("a", "HOME", cover > 0, te["t60_spread_home_price"])):
        base = (te[f"{flag_side}_big_out"].fillna(0) > 0)
        agree = te["edge_raw"] <= -1 if bet_side == "AWAY" else te["edge_raw"] >= 1
        disagree = te["edge_raw"] >= 1 if bet_side == "AWAY" else te["edge_raw"] <= -1
        for label, mask in ((f"big_out({flag_side}) → {bet_side} (all)", base),
                            (f"big_out({flag_side}) + model AGREES ≥1 → {bet_side}", base & agree),
                            (f"big_out({flag_side}) + model DISAGREES → {bet_side}", base & disagree)):
            m = mask & ~push
            n = int(m.sum())
            if n < 25:
                continue
            w = win & m
            profit = np.where(w[m], dec[m].fillna(1.909) - 1, -1.0)
            per = []
            for s, g in te[m].assign(w=w[m], pr=profit).groupby("season"):
                per.append(f"{s}: {g['w'].sum()}/{len(g)} {g['w'].mean()*100:.0f}% {g['pr'].mean()*100:+.0f}%")
            lines.append(f"| {label} | {n:,} | {w.sum()/n*100:.1f}% | "
                         f"{profit.mean()*100:+.1f}% | {' · '.join(per)} |")

    path = os.path.join(ROOT, "NCAAB_SIDES_MODEL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
