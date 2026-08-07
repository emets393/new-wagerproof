#!/usr/bin/env python3
"""NBA full-game total, round 3: repaired ratings, and the 2022 question.

WHAT ROUND 2 ESTABLISHED. A ridge on 383 a-priori features, trained on the residual vs the
T-60 close, grades 53.7% against a 50.4% in-slice baseline (+2.5% ROI) on the 2,280 games where
it disagrees with the line by two or more points. Out-of-sample corr(predicted, actual) is
+0.067 against a within-season label-shuffle null of -0.006 ± 0.017 — z = +4.39. Robustness
(`NBA_TOTAL_V2_ROBUST.md`) held on all three axes that matter:
  - random 70% feature subsets, 8 draws: edge +2.6 to +3.9 (round 1 swung 13.6 points)
  - ridge alpha from 10 to 3000: edge +1.9 to +3.3, positive throughout
  - more training data monotonically HELPS: corr 0.049 → 0.067 → 0.078 at min_train 800 →
    1500 → 2500. Noise does not get better when you feed it more rows.
The theme ablation named the load-bearing block: dropping the 96 USAGE-CONCENTRATION columns
takes corr from 0.067 to 0.044 and edge from +3.3 to +1.4, more than twice the damage of any
other theme. Team pace and efficiency are priced; how concentrated a team's possessions are is
not, and that is what this model is actually trading.

THE TWO OPEN PROBLEMS THIS FILE ADDRESSES.

1. THE RATINGS WERE BROKEN AND ARE NOW FIXED. `NBA_ADJ_RATINGS_FIX.md`: the scoring ridge in
   `build_nba_features.py` had no global intercept, so alpha=25 flattened the off/def
   coefficients against a 48-point-per-team shrinkage sink. Repaired, the team scoring
   environment (`sum_tempo`) goes from +0.005 to **+0.644** correlation with the closing total,
   and the discriminant check passes cleanly: `adj_tempo_pts` correlates +0.53 with the TOTAL
   and +0.05 with the SPREAD, while `adj_net` does the reverse. Round 2 never saw a working
   opponent-adjusted rating. This adds one.

2. 2022 LOSES AND I DO NOT YET KNOW WHY. At min_train=800, which is the only setting that
   grades 2022 at all, that season runs 43.5% / −17.0% ROI while 2023/24/25 run +1.1 / +2.5 /
   +5.5 edge. Two explanations fit and they demand opposite conclusions:
     (a) BURN-IN. 2022 is graded on 800-1,500 training rows — half a season — and the
         min_train ladder says this model is data-hungry. Then 2022 is not evidence about the
         edge, it is evidence about training size.
     (b) REGIME. 2022 is genuinely different and the model does not transfer.
   The season-holdout below separates them: train on the OTHER three seasons in full, predict
   the held-out one. That uses future data and is therefore NOT a betting simulation — it is
   a diagnostic, and it is labelled as one everywhere it appears. If 2022 grades fine with
   3,900 training rows drawn from elsewhere, (a) is the answer.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.linear_model import Ridge

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
spec = importlib.util.spec_from_file_location("v2", os.path.join(ROOT, "nba_total_v2.py"))
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)

K = 2.0
ALPHAS = (30.0, 100.0, 300.0, 1000.0)


def with_fixed_ratings(D):
    """Attach the repaired opponent-adjusted ratings as home/away/sum/diff columns.

    `sum` before `diff` on purpose: a TOTAL is a sum, so the home and away scoring
    environments added together (`radj_sum_tempo_pts`) is the quantity the market is pricing,
    and it is the one that correlates +0.64 with the closing line.
    """
    R = pd.read_parquet(f"{OUT}/nba_adj_ratings_fixed.parquet")
    R["date"] = pd.to_datetime(R["date"])
    G = pd.read_parquet(f"{OUT}/bdl_games.parquet")[["id", "home_team.id", "visitor_team.id"]]
    G = G.drop_duplicates("id").rename(columns={"id": "bdl_id", "home_team.id": "hid",
                                                "visitor_team.id": "aid"})
    key = "bdl_id" if "bdl_id" in D.columns else "game.id"
    D = D.merge(G, left_on=key, right_on="bdl_id", how="left")

    cols = ["adj_net", "adj_off", "adj_def", "adj_tempo_pts"]
    H = R[["date", "team.id"] + cols].rename(
        columns={"team.id": "hid", **{c: f"radj_h_{c}" for c in cols}})
    A = R[["date", "team.id"] + cols].rename(
        columns={"team.id": "aid", **{c: f"radj_a_{c}" for c in cols}})
    D = D.merge(H, on=["date", "hid"], how="left").merge(A, on=["date", "aid"], how="left")
    for c in cols:
        D[f"radj_sum_{c}"] = D[f"radj_h_{c}"] + D[f"radj_a_{c}"]
        D[f"radj_d_{c}"] = D[f"radj_h_{c}"] - D[f"radj_a_{c}"]
    # the market's own view of the same quantity, minus ours: the direct disagreement
    D["radj_gap"] = D["radj_sum_adj_tempo_pts"] - D["t60_total_point"]
    cov = D["radj_sum_adj_tempo_pts"].notna().mean()
    print(f"[ratings] repaired ratings joined on {cov:.1%} of games", flush=True)
    return D


def fit_predict(Xtr, ytr, Xte):
    mu, sd = Xtr.mean(), Xtr.std().replace(0, 1.0)
    A = ((Xtr - mu) / sd).fillna(0.0)
    B = ((Xte - mu) / sd).fillna(0.0)
    return np.mean([Ridge(alpha=a).fit(A, ytr).predict(B) for a in ALPHAS], axis=0)


def season_holdout(D, cols, y):
    """DIAGNOSTIC ONLY — trains on future seasons. Never quote this as a bettable number."""
    P = pd.Series(index=D.index, dtype=float)
    for s in sorted(D["season"].unique()):
        tr = D.index[(D["season"] != s) & y.notna()]
        te = D.index[D["season"] == s]
        P.loc[te] = fit_predict(D.loc[tr, cols].astype(float), y.loc[tr],
                                D.loc[te, cols].astype(float))
    return P


def main():
    D = v2.build()
    D = with_fixed_ratings(D)

    base_cols = [c for c in v2.feature_cols(D) if c not in v2.leak_screen(D, v2.feature_cols(D))]
    radj = [c for c in D.columns if c.startswith("radj_") and D[c].notna().mean() > 0.80]
    # the repaired ratings are exempt from the leak screen for the same reason the line is:
    # radj_gap is defined against the line, and adj_tempo_pts tracks the line by design
    full_cols = base_cols + radj
    print(f"[features] base={len(base_cols)}  +repaired ratings={len(radj)}  "
          f"total={len(full_cols)}", flush=True)

    y = D["y_fg_tot_resid"].astype(float)
    yb = pd.Series(np.where(y > 0, 1.0, np.where(y < 0, 0.0, np.nan)), index=D.index)
    po = pd.Series(v2.to_dec(D["t60_total_over_price"]), index=D.index)
    pu = pd.Series(v2.to_dec(D["t60_total_under_price"]), index=D.index)

    L = ["# NBA full-game total — round 3", "",
         f"{len(D):,} gradeable games. Ridge on the residual vs the T-60 close. Bets taken "
         f"when the model disagrees with the line by ≥{K:.0f} points. `base` is the best blind "
         f"side inside the same rows; breakeven at −110 is 52.4%.", ""]

    # ---- 1. do the repaired ratings add anything? ------------------------------------------
    L += ["## 1. Does repairing the opponent-adjusted ratings help?", "",
          "Walk-forward, identical settings, the only difference being the 9 repaired rating "
          "columns. See `NBA_ADJ_RATINGS_FIX.md` for what was broken.", "",
          "| feature set | cols | oos corr | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|"]
    preds = {}
    for tag, cs in (("round 2 (broken ratings excluded)", base_cols),
                    ("round 3 (+ repaired ratings)", full_cols),
                    ("repaired ratings ALONE", radj)):
        p = v2.walk(D[cs].astype(float), D["date"], y, kind="ridge")
        preds[tag] = p
        m = p.notna() & y.notna()
        r = np.corrcoef(p[m], y[m])[0, 1]
        g = v2.grade(p, yb, po, pu, K)
        L.append(f"| {tag} | {len(cs)} | {r:+.4f} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} "
                 f"| **{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)

    best_tag = "round 3 (+ repaired ratings)"
    P = preds[best_tag]

    L += ["", "## 2. Threshold ladder, round 3", "",
          "| k (pts) | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for k in (0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0):
        g = v2.grade(P, yb, po, pu, k)
        if g["n"] == 0:
            continue
        L.append(f"| ≥{k:.0f} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)

    L += ["", "## 3. Walk-forward by season and phase (round 3, k ≥ 2)", "",
          "| slice | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for lab, msk in ([(str(s), D["season"] == s) for s in sorted(D["season"].unique())] +
                     [(ph, D["phase"] == ph) for ph in ("EARLY", "MID", "LATE", "POST")]):
        g = v2.grade(P, yb, po, pu, K, mask=msk)
        if g["n"] == 0:
            continue
        L.append(f"| {lab} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)

    # ---- 4. the 2022 question ---------------------------------------------------------------
    Ph = season_holdout(D, full_cols, y)
    L += ["", "## 4. Season holdout — burn-in or regime? (DIAGNOSTIC, NOT BETTABLE)", "",
          "Each season predicted by a model trained on the other three IN FULL. This uses "
          "future data, so the numbers are **not** achievable live — the only question it "
          "answers is whether 2022's walk-forward loss is a training-size artefact (it should "
          "grade normally here) or a genuine regime break (it should still lose).", "",
          "| season | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for s in sorted(D["season"].unique()):
        g = v2.grade(Ph, yb, po, pu, K, mask=(D["season"] == s))
        if g["n"] == 0:
            continue
        L.append(f"| {s} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)

    # ---- 5. null on the round-3 config ------------------------------------------------------
    rng = np.random.default_rng(23)
    nr, ne = [], []
    for i in range(8):
        ys = y.copy()
        for s in D["season"].unique():
            msk = (D["season"] == s) & y.notna()
            ys.loc[msk] = rng.permutation(y.loc[msk].values)
        ps = v2.walk(D[full_cols].astype(float), D["date"], ys, kind="ridge")
        ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=D.index)
        mm = ps.notna() & ys.notna()
        nr.append(np.corrcoef(ps[mm], ys[mm])[0, 1])
        gg = v2.grade(ps, ybs, po, pu, K)
        ne.append(gg["win"] - gg["base"])
        print(f"[null {i+1}/8] corr {nr[-1]:+.4f}  edge {ne[-1]:+.2f}", flush=True)

    mm = P.notna() & y.notna()
    rr = np.corrcoef(P[mm], y[mm])[0, 1]
    gg = v2.grade(P, yb, po, pu, K)
    re_ = gg["win"] - gg["base"]
    nr, ne = np.array(nr), np.array(ne)
    L += ["", "## 5. Label-shuffle null on the round-3 config (8 draws, within season)", "",
          "| statistic | real | null mean | null sd | z |", "|---|---|---|---|---|",
          f"| oos corr | {rr:+.4f} | {nr.mean():+.4f} | {nr.std(ddof=1):.4f} | "
          f"**{(rr-nr.mean())/nr.std(ddof=1):+.2f}** |",
          f"| edge @ k≥{K:.0f} | {re_:+.2f} | {ne.mean():+.2f} | {ne.std(ddof=1):.2f} | "
          f"**{(re_-ne.mean())/ne.std(ddof=1):+.2f}** |", ""]
    print("\n".join(L[-4:]), flush=True)

    path = os.path.join(ROOT, "NBA_TOTAL_V3.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
