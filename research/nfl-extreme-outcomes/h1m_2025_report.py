"""MODEL-ALONE report: train 2023+2024 -> test 2025. No signals, no confluence.

The single fully-honest test of the 1H models: two training seasons, one
untouched test season. Bets at 1H consensus close, graded at close.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss

from h1m_models import build_frame
from h1m_models2 import add_xmkt, gbr, FEATS
from h1m_walkforward import wilson

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)


def line(d, win, push, pay, lab, ci=True):
    win, push, pay = (np.asarray(x) for x in (win, push, pay))
    if len(d) == 0:
        return
    r = np.where(push, 0.0, np.where(win, pay, -1.0))
    nz = ~pd.Series(push).astype(bool)
    w = int(pd.Series(win)[nz].sum())
    n = int(nz.sum())
    lo, hi = wilson(w, n)
    ci_s = f"  CI95 [{lo:.0%}-{hi:.0%}]" if ci else ""
    print(f"  {lab:<40} n={len(d):<4} win {w}/{n} = {w/n:.1%} "
          f"roi {np.nanmean(r)*100:+.1f}%{ci_s}")


def main():
    f = build_frame()
    f = add_xmkt(f)
    f["r_tot"] = f.y_tot - f.h1_tot_close
    f["r_cov"] = f.y_m + f.h1_sp_close
    tr, te = f[f.season != 2025], f[f.season == 2025].copy()
    print(f"train: {len(tr)} games (2023-24) -> test: {len(te)} games (2025)\n")

    mt = gbr(); mt.fit(tr[FEATS], tr.r_tot)
    ms = gbr(); ms.fit(tr[FEATS], tr.r_cov)
    te["e_tot"] = mt.predict(te[FEATS])
    te["e_cov"] = ms.predict(te[FEATS])

    # ---------- totals
    print("1H TOTAL MODEL, 2025 (pred = close line + residual edge)")
    print(f"  full-slate MAE: model {np.abs(te.h1_tot_close + te.e_tot - te.y_tot).mean():.2f} "
          f"vs market {np.abs(te.h1_tot_close - te.y_tot).mean():.2f}")
    win_o = te.y_tot > te.h1_tot_close
    win_u = te.y_tot < te.h1_tot_close
    push = te.y_tot == te.h1_tot_close
    pay_o = te.h1_total_close_pay_h1_total_over_price
    pay_u = te.h1_total_close_pay_h1_total_under_price
    e = te.e_tot
    print("  -- pick the model side on every game, by |edge| --")
    for lo, hi in ((0.0, 0.5), (0.5, 1.0), (1.0, 1.5), (1.5, 2.0), (2.0, 2.5),
                   (2.5, 3.0), (3.0, 99)):
        i = (e.abs() >= lo) & (e.abs() < hi)
        line(te[i], np.where(e[i] > 0, win_o[i], win_u[i]), push[i],
             np.where(e[i] > 0, pay_o[i], pay_u[i]), f"|edge| {lo}-{hi}", ci=False)
    print("  -- aggregate bands --")
    for lo, hi, lab in ((0.0, 99, "ALL games (model side)"),
                        (1.0, 99, "|edge| >= 1.0"),
                        (1.25, 2.75, "|edge| 1.25-2.75 (declared window)"),
                        (1.0, 3.0, "|edge| 1.0-3.0"),
                        (3.0, 99, "|edge| >= 3.0 (the cap zone)")):
        i = (e.abs() >= lo) & (e.abs() < hi)
        line(te[i], np.where(e[i] > 0, win_o[i], win_u[i]), push[i],
             np.where(e[i] > 0, pay_o[i], pay_u[i]), lab)
    print("  -- window side split --")
    i = (e >= 1.25) & (e < 2.75)
    line(te[i], win_o[i], push[i], pay_o[i], "window OVER picks")
    i = (e <= -1.25) & (e > -2.75)
    line(te[i], win_u[i], push[i], pay_u[i], "window UNDER picks")

    # ---------- spread
    print("\n1H SPREAD MODEL, 2025 (edge>0 = home side vs close)")
    win_h = te.r_cov > 0
    win_a = te.r_cov < 0
    push_s = te.r_cov == 0
    pay_h = te.h1_spread_close_pay_h1_spread_home_price
    pay_a = te.h1_spread_close_pay_h1_spread_away_price
    es = te.e_cov
    for lo, hi, lab in ((0.0, 99, "ALL games (model side)"),
                        (1.0, 99, "|edge| >= 1.0"),
                        (1.5, 99, "|edge| >= 1.5"),
                        (2.5, 99, "|edge| >= 2.5")):
        i = (es.abs() >= lo) & (es.abs() < hi)
        line(te[i], np.where(es[i] > 0, win_h[i], win_a[i]), push_s[i],
             np.where(es[i] > 0, pay_h[i], pay_a[i]), lab)

    # ---------- ML
    print("\n1H ML, 2025 (logistic of close 1H spread, fit 2023-24)")
    lg = LogisticRegression()
    lg.fit(tr[["h1_sp_close"]], tr.y_w)
    p = lg.predict_proba(te[["h1_sp_close"]])[:, 1]
    ph, pa = te.h1_ml_close_pay_h1_ml_home, te.h1_ml_close_pay_h1_ml_away
    imp = (1 / (1 + ph)) / ((1 / (1 + ph)) + (1 / (1 + pa)))
    ok = imp.notna()
    print(f"  brier: model {brier_score_loss(te.y_w[ok], p[ok]):.4f} "
          f"vs market {brier_score_loss(te.y_w[ok], imp[ok]):.4f}")
    nz = te.y_m != 0
    acc = ((p >= 0.5) == (te.y_m > 0))[nz].mean()
    print(f"  straight 1H-winner accuracy: {acc:.1%} (n={int(nz.sum())})")


if __name__ == "__main__":
    main()
