"""EXPERIMENT: does the closing line as a FEATURE improve the NFL per-market prop models?

Motivated by the NBA law (predict-the-raw-quantity-not-the-residual): raw target WITH the
line as a feature beat both the residual target and the line-blind model. The NFL per-market
models (prop_model.py) are line-blind. The 2023 backfill gives 3 seasons of T-60 lines —
enough to test the construction walk-forward.

Design (pre-registered):
- Frame: panel rows INNER-joined to T-60 lines (both arms score the SAME lined rows).
- Arm A (baseline): current FEATS, walk-forward per week 2023-2025, train on all prior
  lined+unlined rows (as production does) but evaluated on lined rows.
- Arm B (line-aware): FEATS + [open_line, close_line]; trains only on lined rows (the
  line must exist at train time), same eval weeks/rows.
- Adjudicators, per the pruning law: (1) unfiltered MAE on the shared eval rows;
  (2) the production cells (P17/P18/P14 thresholds) at matched rule definitions;
  (3) top-25% |edge| bet cells at matched bet counts.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from prop_model import panel, t60_lines, MKT_STAT
from attempts_model import FEATS, amer_profit

def run():
    p = panel()
    lines = t60_lines()
    p = p.merge(lines, on=["season", "week", "player_id", "market"], how="left")
    out = []
    for mkt in MKT_STAT:
        m = p[p.market == mkt].dropna(subset=["actual", "team_spread"]).copy()
        m["t"] = m.season * 100 + m.week
        lined = m.close_line.notna()
        eval_ts = sorted(m[(m.season >= 2023) & lined].t.unique())
        for arm, feats, train_lined_only in [("A_base", FEATS, False),
                                             ("B_line", FEATS + ["open_line", "close_line"], True)]:
            m[f"pred_{arm}"] = np.nan
            for t in eval_ts:
                tr = m[(m.t < t) & (lined if train_lined_only else slice(None) == slice(None))]
                if train_lined_only:
                    tr = m[(m.t < t) & lined]
                te_mask = (m.t == t) & lined
                if len(tr) < 400 or te_mask.sum() == 0:
                    continue
                mdl = HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05, max_iter=400,
                                                    min_samples_leaf=40, l2_regularization=1.0)
                mdl.fit(tr[feats], tr.actual)
                m.loc[te_mask, f"pred_{arm}"] = mdl.predict(m.loc[te_mask, feats])
        both = m[m.pred_A_base.notna() & m.pred_B_line.notna()].copy()
        if not len(both):
            continue
        both["market"] = mkt
        out.append(both)
        mae_a = np.abs(both.pred_A_base - both.actual).mean()
        mae_b = np.abs(both.pred_B_line - both.actual).mean()
        mae_l = np.abs(both.close_line - both.actual).mean()
        print(f"\n===== {mkt} (n={len(both)}) =====")
        print(f"  MAE  baseline={mae_a:.3f}  line-aware={mae_b:.3f}  line-itself={mae_l:.3f} "
              f"  {'LINE-AWARE BETTER' if mae_b < mae_a else 'baseline better'}")
        for arm in ("A_base", "B_line"):
            e = both[f"pred_{arm}"] - both.close_line
            thr = e.abs().quantile(0.75)
            for side_lbl, mask, over in [("top25% UNDER", e <= -thr, False), ("top25% OVER", e >= thr, True)]:
                s = both[mask & (both.actual != both.close_line)]
                if len(s) < 15:
                    continue
                win = (s.actual > s.close_line) if over else (s.actual < s.close_line)
                px = (s.over_px if over else s.under_px)
                roi = np.nanmean(np.where(win, amer_profit(px.fillna(-110)), -1.0)) * 100
                per = " ".join(f"{y}:{win[s.season == y].mean()*100:.0f}%" for y in (2023, 2024, 2025)
                               if (s.season == y).sum() > 0)
                print(f"  {arm} {side_lbl:14s} n={len(s):4d} hit={win.mean()*100:5.1f}% ROI={roi:+6.1f}% [{per}]")
    return pd.concat(out, ignore_index=True) if out else None


if __name__ == "__main__":
    run()
