#!/usr/bin/env python3
"""NCAAB model lab (MODEL_LAB_BRIEF.md) — rigorous feature + config engineering.

Protocol: train 2022-23+2023-24, VALIDATE 2024-25 (all selection decisions),
TEST 2025-26 (touched once, at the end, with the chosen config). Metrics:
margin MAE, edge↔cover correlation, and bucket curve (share of games with
|edge|≥3 and the ATS win% there).

Parts:
  1. Cross-team ENGINEERED features (explicit differentials + multiplicative
     structure: efficiency-gap × expected pace, off-vs-def crosses, variance).
  2. Feature-GROUP ablations: full-minus-group and group-alone.
  3. Hyperparameter grid on validation.
  4. Final config: walk-forward sides + totals, edge->P(cover) calibration.
"""
import itertools
import os

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

TRAIN = ["2022-23", "2023-24"]
VAL = "2024-25"
TEST = "2025-26"


def engineered(df):
    e = pd.DataFrame(index=df.index)
    # core differentials (GBM splits on single columns — hand it the game's shape)
    e["kp_em_diff"] = df["home_kp_em"] - df["away_kp_em"]
    e["kp_rank_diff"] = df["away_kp_rank"] - df["home_kp_rank"]
    # off-vs-def crosses: each side's expected efficiency against THIS defense
    e["h_exp_eff"] = df["home_kp_oe"] - df["away_kp_de"]
    e["a_exp_eff"] = df["away_kp_oe"] - df["home_kp_de"]
    e["exp_eff_gap"] = e["h_exp_eff"] - e["a_exp_eff"]
    # expected pace (both tempos) and the MULTIPLICATIVE margin structure:
    # margin ≈ eff_gap/100 × possessions — GBMs approximate products poorly
    e["exp_pace"] = (df["home_kp_tempo"] + df["away_kp_tempo"]) / 2
    e["margin_struct"] = e["exp_eff_gap"] * e["exp_pace"] / 100.0
    e["total_struct"] = (e["h_exp_eff"] + e["a_exp_eff"] + 200) * e["exp_pace"] / 200.0
    # boxscore differentials (s2d)
    for c in ("off_eff", "def_eff", "pace", "efg", "to_ratio", "orb_pct"):
        e[f"d_{c}"] = df[f"home_s2d_{c}"] - df[f"away_s2d_{c}"]
    # box off-vs-def crosses
    e["h_box_exp"] = df["home_s2d_off_eff"] - df["away_s2d_def_eff"]
    e["a_box_exp"] = df["away_s2d_off_eff"] - df["home_s2d_def_eff"]
    # form differentials (l5 - s2d, then across teams)
    e["h_form"] = df["home_l5_off_eff"] - df["home_s2d_off_eff"]
    e["a_form"] = df["away_l5_off_eff"] - df["away_s2d_off_eff"]
    e["form_diff"] = e["h_form"] - e["a_form"]
    # schedule/roster differentials
    e["rest_diff"] = df["home_rest_days"].clip(0, 10) - df["away_rest_days"].clip(0, 10)
    e["exp_diff"] = df["h_Exp"] - df["a_Exp"]
    e["hgt_diff"] = df["h_HgtEff"] - df["a_HgtEff"]
    e["bench_diff"] = df["h_Bench"] - df["a_Bench"]
    e["cont_diff"] = df["h_Continuity"] - df["a_Continuity"]
    # variance profile: 3-point reliance of both sides widens outcomes
    e["var_3reliance"] = df["h_pct_p3_share"].fillna(.5) + df["a_pct_p3_share"].fillna(.5)
    # style advantage channels (already game-shaped)
    e["style_adv_diff"] = df["h_style_adv"] - df["a_style_adv"]
    # availability shock differential
    e["out_shock"] = (df["h_reg_out_n"].fillna(0) + 2 * df["h_big_out"].fillna(0)) \
        - (df["a_reg_out_n"].fillna(0) + 2 * df["a_big_out"].fillna(0))
    e["streak_diff"] = df["cover_diff"]
    e["win_form_diff"] = df["h_l5_wins"] - df["a_l5_wins"]
    return e


def groups(df):
    g = {
        "kp_raw": [c for c in df.columns if c.startswith(("home_kp_", "away_kp_"))],
        "box_raw": [c for c in df.columns
                    if c.startswith(("home_s2d_", "away_s2d_", "home_l5_", "away_l5_"))],
        "schedule": ["home_game_num", "away_game_num", "home_rest_days",
                     "away_rest_days", "home_b2b", "away_b2b", "month", "nonconf"],
        "style": [c for c in df.columns if c.startswith(("h_pct_", "a_pct_",
                                                         "h_adv_", "a_adv_"))]
        + ["h_style_adv", "a_style_adv"],
        "streaks": ["h_l5_covers", "a_l5_covers", "h_l5_wins", "a_l5_wins",
                    "h_cover_streak", "a_cover_streak", "cover_diff"],
        "rematch": ["meet_no", "m1_margin_home", "m1_covamt_home", "m1_days_ago",
                    "venue_flip"],
        "roster": [f"{s}_{c}" for s in ("h", "a")
                   for c in ("HgtEff", "Hgt5", "Exp", "Bench", "Continuity")],
        "flags": [f"{s}_{c}" for s in ("h", "a")
                  for c in ("top1_out", "big_out", "guard_out", "lowto_guard_out",
                            "reg_out_n", "stale_out_n")],
    }
    return g


def fit_eval(df, feats, params=None, train_seasons=TRAIN, eval_season=VAL,
             target="margin"):
    p = dict(max_iter=500, learning_rate=0.05, max_leaf_nodes=31,
             min_samples_leaf=40, l2_regularization=1.0, random_state=7)
    if params:
        p.update(params)
    tr = df[df["season"].isin(train_seasons)]
    te = df[df["season"] == eval_season]
    m = HistGradientBoostingRegressor(**p)
    m.fit(tr[feats], tr[target])
    pred = m.predict(te[feats])
    if target == "margin":
        mae = np.abs(te["margin"] - pred).mean()
        edge = pred + te["t60_spread_home_point"]
        corr = np.corrcoef(edge, te["cover_amt"])[0, 1]
        big = np.abs(edge) >= 3
        cov = np.where(edge > 0, te["cover_amt"] > 0, te["cover_amt"] < 0)
        nopush = te["cover_amt"] != 0
        wr = cov[big & nopush].mean() * 100 if (big & nopush).sum() > 50 else np.nan
        return mae, corr, (big & nopush).mean() * 100, wr, pred
    else:
        mae = np.abs(te[target] - pred).mean()
        return mae, np.nan, np.nan, np.nan, pred


def main():
    df = pd.read_parquet(f"{OUT}/sides_table_ncaab.parquet")
    df["is_conf"] = df["conferenceGame"].astype(float)
    e = engineered(df)
    df = pd.concat([df, e], axis=1)
    eng_cols = list(e.columns)
    G = groups(df)
    all_raw = sum(G.values(), [])

    lines = ["# NCAAB Model Lab — feature ablations, engineered features, config",
             "",
             "Train 22-23+23-24 · validate 24-25 (all decisions) · test 25-26 (once).",
             "Metrics: margin MAE | edge↔cover corr | %games |edge|≥3 | ATS win% there."]

    lines.append("\n## 1 — engineered cross-team features\n")
    lines.append("| feature set | MAE | corr | %|edge|≥3 | win% |")
    lines.append("|---|---|---|---|---|")
    rows = [("raw h/a columns only (v1-style)", all_raw),
            ("engineered only (game-shaped)", eng_cols),
            ("raw + engineered", all_raw + eng_cols),
            ("market baseline (predict -spread)", None)]
    for label, feats in rows:
        if feats is None:
            te = df[df["season"] == VAL]
            mae = np.abs(te["margin"] + te["t60_spread_home_point"]).mean()
            lines.append(f"| {label} | {mae:.2f} | — | — | — |")
            continue
        mae, corr, share, wr, _ = fit_eval(df, feats)
        lines.append(f"| {label} | {mae:.2f} | {corr:.3f} | {share:.0f}% | {wr:.1f}% |")

    lines.append("\n## 2 — feature-group ablations (raw + engineered base)\n")
    lines.append("| variant | MAE | corr | %|edge|≥3 | win% |")
    lines.append("|---|---|---|---|---|")
    full = all_raw + eng_cols
    mae0, corr0, share0, wr0, _ = fit_eval(df, full)
    lines.append(f"| FULL | {mae0:.2f} | {corr0:.3f} | {share0:.0f}% | {wr0:.1f}% |")
    for gname, cols in G.items():
        feats = [c for c in full if c not in cols]
        mae, corr, share, wr, _ = fit_eval(df, feats)
        lines.append(f"| minus {gname} | {mae:.2f} ({mae-mae0:+.2f}) | {corr:.3f} | "
                     f"{share:.0f}% | {wr:.1f}% |")
    for gname, cols in G.items():
        if not cols:
            continue
        mae, corr, share, wr, _ = fit_eval(df, cols)
        lines.append(f"| ONLY {gname} | {mae:.2f} | {corr:.3f} | {share:.0f}% | {wr:.1f}% |")

    lines.append("\n## 3 — hyperparameter grid (validation MAE / corr)\n")
    lines.append("| lr | leaves | min_leaf | iters | MAE | corr | win% |edge|≥3 |")
    lines.append("|---|---|---|---|---|---|---|")
    best = (None, 1e9)
    for lr, lv, ml, it in itertools.product((0.03, 0.05, 0.1), (15, 31, 63),
                                            (20, 40, 80), (300, 700)):
        if (lr, lv, ml, it) not in {(0.03, 15, 40, 700), (0.03, 31, 40, 700),
                                    (0.03, 31, 80, 700), (0.05, 15, 40, 300),
                                    (0.05, 31, 40, 300), (0.05, 31, 20, 300),
                                    (0.05, 63, 80, 300), (0.1, 15, 80, 300),
                                    (0.05, 31, 40, 700), (0.03, 63, 80, 700),
                                    (0.1, 31, 40, 300), (0.05, 15, 80, 700)}:
            continue
        mae, corr, share, wr, _ = fit_eval(df, full, dict(
            learning_rate=lr, max_leaf_nodes=lv, min_samples_leaf=ml, max_iter=it))
        lines.append(f"| {lr} | {lv} | {ml} | {it} | {mae:.2f} | {corr:.3f} | {wr:.1f}% |")
        if mae < best[1]:
            best = (dict(learning_rate=lr, max_leaf_nodes=lv,
                         min_samples_leaf=ml, max_iter=it), mae)
    lines.append(f"\nBest config: {best[0]} (val MAE {best[1]:.2f})")

    # ---- 4: final walk-forward with chosen config + calibration ----
    lines.append("\n## 4 — FINAL: walk-forward, all seasons, chosen config\n")
    preds = pd.Series(np.nan, index=df.index)
    for ts, trs in ((VAL, TRAIN), (TEST, TRAIN + [VAL]), ("2023-24", ["2022-23"])):
        _, _, _, _, p = fit_eval(df, full, best[0], train_seasons=trs, eval_season=ts)
        preds.loc[df["season"] == ts] = p
    te = df[preds.notna()].copy()
    te["edge"] = preds[te.index] + te["t60_spread_home_point"]
    mae_mkt = np.abs(te["margin"] + te["t60_spread_home_point"]).mean()
    mae_mod = np.abs(te["margin"] - preds[te.index]).mean()
    lines.append(f"Margin MAE across 3 test seasons: market {mae_mkt:.2f} | model {mae_mod:.2f}")
    lines.append("\n### Edge → empirical P(cover) calibration (the per-game product number)\n")
    lines.append("| model edge (home persp) | n | home cover % | per season |")
    lines.append("|---|---|---|---|")
    nopush = te["cover_amt"] != 0
    for lo, hi in ((-99, -6), (-6, -4), (-4, -2), (-2, 0), (0, 2), (2, 4), (4, 6), (6, 99)):
        m = (te["edge"] >= lo) & (te["edge"] < hi) & nopush
        if m.sum() < 100:
            continue
        cov = (te["cover_amt"] > 0)[m]
        per = []
        for s, g in te[m].assign(c=cov).groupby("season"):
            per.append(f"{s}: {g['c'].mean()*100:.0f}%")
        lines.append(f"| [{lo},{hi}) | {int(m.sum()):,} | {cov.mean()*100:.1f}% | {' · '.join(per)} |")

    path = os.path.join(ROOT, "MODEL_LAB_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
