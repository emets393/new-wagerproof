#!/usr/bin/env python3
"""Does the model have ANY forecasting skill, or are my features simply weak?

Five method families have now returned a delta of ~0 against blind under on props. That
result has two completely different explanations and they demand opposite responses:

  A  THE MARKET IS EFFICIENT. The model forecasts the stat about as well as the posted
     line does, and the line already contains everything the model knows. Nothing more to
     build here; go spend the effort elsewhere.
  B  MY FEATURES ARE WEAK. The model is a poor forecaster in absolute terms, the null
     results say nothing about the market, and the honest move is better features rather
     than more algorithms.

Betting results cannot distinguish these. Both produce ROI ~ 0. So stop grading bets and
grade FORECASTS, against the only benchmark that matters: the line itself. A posted prop
line is the market's own median forecast of the same quantity, so it is a directly
comparable competitor -- not a strawman.

Three tests, in increasing strictness:

  1  MAE / correlation, model vs line. Level comparison. If the model is far worse the
     answer is B and everything else here is moot.

  2  FORECAST ENCOMPASSING (Mincer-Zarnowitz style). Regress the outcome on BOTH the line
     and the model prediction:  actual = a + b*line + c*model.
     If the market's number already contains the model's information, c = 0 -- the line
     ENCOMPASSES the model, which is explanation A stated precisely. If c is reliably
     non-zero the model carries information the line lacks, and the null betting results
     mean the vig ate a real but small edge, not that the edge is absent.

  3  RESIDUAL-EDGE CONCENTRATION. Where c > 0, does the disagreement between model and
     line actually predict the direction of the outcome? Split by (model - line) and read
     the over rate. This is test 2 in the units the bet is actually placed in.

Nothing here is a bet, so nothing here needs a price. That is the point: this file is
diagnosis, and it is what tells me whether the whole props programme should continue.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

import lightgbm as lgb

from nba_props_model import feature_cols

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
BLOCK_MONTHS = 2
MIN_TRAIN = 4000


def main():
    panel = os.environ.get("PANEL", f"{OUT}/nba_props_panel.parquet")
    D = pd.read_parquet(panel).rename(columns={"season_x": "season"})
    D["date"] = pd.to_datetime(D["date"])
    D = D[(D["gp_prior"] >= 5) & D["actual"].notna()
          & D["cons_line"].notna()].sort_values("date").reset_index(drop=True)

    L = ["# NBA props — does the model forecast at all?", "",
         f"{len(D):,} props from `{os.path.basename(panel)}`. Walk-forward LGBM "
         "regression on the settled stat, benchmarked against the posted line, which is "
         "the market's own median forecast of the same quantity.", "",
         "This is a DIAGNOSTIC, not a bet: no prices appear anywhere below. It exists to "
         "separate 'the market is efficient' from 'my features are weak', which the "
         "betting runs cannot tell apart because both give ROI ~ 0.", ""]

    rows = []
    for mk in sorted(D["market"].unique()):
        M = D[D["market"] == mk].copy().reset_index(drop=True)
        cols = [c for c in feature_cols(M)
                if M[c].notna().mean() >= 0.5 and M[c].nunique() > 1]
        mo = M["date"].dt.to_period("M")
        uniq = sorted(mo.unique())
        blocks = [uniq[i:i + BLOCK_MONTHS] for i in range(0, len(uniq), BLOCK_MONTHS)]
        M["_pred"] = np.nan
        for blk in blocks:
            te = M.index[mo.isin(blk)]
            tr = M.index[mo < blk[0]]
            if len(te) == 0 or len(tr) < MIN_TRAIN:
                continue
            m = lgb.LGBMRegressor(objective="regression", n_estimators=350,
                                  learning_rate=0.04, num_leaves=31,
                                  min_child_samples=60, subsample=0.8, subsample_freq=1,
                                  colsample_bytree=0.6, reg_lambda=5.0, random_state=0,
                                  verbose=-1, n_jobs=4)
            m.fit(M.loc[tr, cols].to_numpy(dtype=np.float32),
                  M.loc[tr, "actual"].to_numpy(dtype=float))
            M.loc[te, "_pred"] = m.predict(M.loc[te, cols].to_numpy(dtype=np.float32))

        s = M[M["_pred"].notna()].copy()
        if len(s) < 2000:
            continue
        y = s["actual"].to_numpy(dtype=float)
        ln = s["cons_line"].to_numpy(dtype=float)
        pr = s["_pred"].to_numpy(dtype=float)

        # ---- 2: encompassing regression, actual ~ a + b*line + c*model
        X = np.column_stack([np.ones(len(y)), ln, pr])
        beta, *_ = np.linalg.lstsq(X, y, rcond=None)
        resid = y - X @ beta
        dof = max(len(y) - 3, 1)
        try:
            cov = np.linalg.inv(X.T @ X) * (resid @ resid) / dof
            se = np.sqrt(np.diag(cov))
            t_line, t_model = beta[1] / se[1], beta[2] / se[2]
        except np.linalg.LinAlgError:
            t_line = t_model = np.nan

        rows.append(dict(market=mk, n=len(s),
                         mae_model=np.abs(y - pr).mean(), mae_line=np.abs(y - ln).mean(),
                         corr_model=np.corrcoef(y, pr)[0, 1],
                         corr_line=np.corrcoef(y, ln)[0, 1],
                         b_line=beta[1], c_model=beta[2],
                         t_line=t_line, t_model=t_model))
        print(f"  {mk}: MAE model {rows[-1]['mae_model']:.3f} vs line "
              f"{rows[-1]['mae_line']:.3f} | c_model={beta[2]:+.3f} (t={t_model:+.1f})",
              flush=True)
        s[["event_id", "market", "pkey", "date", "cons_line", "_pred",
           "actual"]].to_parquet(f"{OUT}/nba_props_skill_{mk}.parquet", index=False)

    R = pd.DataFrame(rows)
    R.to_csv(os.path.join(ROOT, "nba_props_skill_results.csv"), index=False)

    L += ["## 1 — level: can the model forecast the stat as well as the line?\n",
          "| market | n | MAE model | MAE line | MAE ratio | corr model | corr line |",
          "|---|---|---|---|---|---|---|"]
    for _, r in R.iterrows():
        L.append(f"| {r['market']} | {r['n']:,} | {r['mae_model']:.3f} | "
                 f"{r['mae_line']:.3f} | {r['mae_model']/r['mae_line']:.4f} | "
                 f"{r['corr_model']:.3f} | {r['corr_line']:.3f} |")

    L += ["\n## 2 — encompassing: actual ~ a + b*line + c*model\n",
          "`c` is the weight the outcome puts on the model AFTER the line is already in "
          "the regression. c = 0 means the line encompasses the model entirely.\n",
          "| market | b (line) | t | c (model) | t | verdict |",
          "|---|---|---|---|---|---|"]
    for _, r in R.iterrows():
        v = ("line encompasses model" if abs(r["t_model"]) < 2 else
             "model adds information" if r["c_model"] > 0 else
             "model adds, wrong sign")
        L.append(f"| {r['market']} | {r['b_line']:+.3f} | {r['t_line']:+.1f} | "
                 f"{r['c_model']:+.3f} | {r['t_model']:+.1f} | {v} |")

    L += ["\n## 3 — does model-minus-line predict the outcome's direction?\n",
          "Over rate by how far the model sits above the posted line. If the model "
          "carries real information this must slope upward.\n",
          "| model - line | n | over rate | mean line |", "|---|---|---|---|"]
    S = []
    for mk in sorted(D["market"].unique()):
        f = f"{OUT}/nba_props_skill_{mk}.parquet"
        if os.path.exists(f):
            S.append(pd.read_parquet(f))
    if S:
        S = pd.concat(S, ignore_index=True)
        # normalise the disagreement by the line so markets pool sensibly: 1 point of
        # disagreement means something very different on blocks 0.5 than on points 27.5
        S["d"] = (S["_pred"] - S["cons_line"]) / S["cons_line"].clip(lower=0.5)
        S = S[S["actual"] != S["cons_line"]]
        for lo, hi, lbl in ((-9, -.20, "< -20%"), (-.20, -.10, "-20..-10%"),
                            (-.10, -.03, "-10..-3%"), (-.03, .03, "-3..+3%"),
                            (.03, .10, "+3..+10%"), (.10, .20, "+10..+20%"),
                            (.20, 9, "> +20%")):
            t = S[(S["d"] >= lo) & (S["d"] < hi)]
            if len(t) < 200:
                continue
            L.append(f"| {lbl} | {len(t):,} | "
                     f"{100*(t['actual'] > t['cons_line']).mean():.2f} | "
                     f"{t['cons_line'].mean():.2f} |")

    path = os.path.join(ROOT, "NBA_PROPS_SKILL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
