"""MODEL CARD — raw 1H model results, walk-forward, NO signals.

2024 predictions: trained on 2023. 2025 predictions: trained on 2023-24.
Every game gets a prediction. Bets at 1H consensus close, graded at close.
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


def line(d, win, push, pay, lab):
    win, push, pay = (np.asarray(x) for x in (win, push, pay))
    nz = ~pd.Series(push).astype(bool)
    w, n = int(pd.Series(win)[nz].sum()), int(nz.sum())
    if n == 0:
        return
    r = np.where(push, 0.0, np.where(win, pay, -1.0))
    per = []
    for s in (2024, 2025):
        i = (d.season == s).values
        if i.sum() >= 3:
            nzs = i & ~np.asarray(push, dtype=bool)
            ws = int(win[nzs].sum())
            per.append(f"{s}: {ws}/{nzs.sum()}={ws/max(nzs.sum(),1):.0%} "
                       f"{np.nanmean(r[i])*100:+.0f}%")
    lo, hi = wilson(w, n)
    print(f"  {lab:<36} n={len(d):<4} win {w}/{n} = {w/n:.1%} "
          f"roi {np.nanmean(r)*100:+.1f}%  CI[{lo:.0%}-{hi:.0%}]   "
          + " | ".join(per))


def main():
    f = build_frame()
    f = add_xmkt(f)
    f["r_tot"] = f.y_tot - f.h1_tot_close
    f["r_cov"] = f.y_m + f.h1_sp_close

    f["e_tot"], f["e_cov"], f["p_home"] = np.nan, np.nan, np.nan
    for test, train in ((2024, [2023]), (2025, [2023, 2024])):
        tr, tei = f[f.season.isin(train)], f.season == test
        mt = gbr(); mt.fit(tr[FEATS], tr.r_tot)
        ms = gbr(); ms.fit(tr[FEATS], tr.r_cov)
        f.loc[tei, "e_tot"] = mt.predict(f.loc[tei, FEATS])
        f.loc[tei, "e_cov"] = ms.predict(f.loc[tei, FEATS])
        lg = LogisticRegression(); lg.fit(tr[["h1_sp_close"]], tr.y_w)
        f.loc[tei, "p_home"] = lg.predict_proba(f.loc[tei, ["h1_sp_close"]])[:, 1]
    d = f[f.season.isin([2024, 2025])].copy()
    print(f"WALK-FORWARD MODEL CARD — {len(d)} games "
          f"(2024 n={int((d.season==2024).sum())}, 2025 n={int((d.season==2025).sum())})")

    # ================= TOTALS =================
    print("\n================ 1H TOTALS ================")
    win_o, win_u = d.y_tot > d.h1_tot_close, d.y_tot < d.h1_tot_close
    push = d.y_tot == d.h1_tot_close
    pay_o = d.h1_total_close_pay_h1_total_over_price
    pay_u = d.h1_total_close_pay_h1_total_under_price
    e = d.e_tot
    for lo, hi, lab in ((0.0, 99, "ALL GAMES (model side)"),
                        (0.5, 99, "|edge| >= 0.5"),
                        (1.0, 99, "|edge| >= 1.0"),
                        (0.5, 3.0, "0.5 <= |edge| < 3.0 (mod band)"),
                        (1.25, 2.75, "1.25-2.75 (HC window)"),
                        (3.0, 99, "|edge| >= 3.0 (capped out)")):
        i = (e.abs() >= lo) & (e.abs() < hi)
        line(d[i], np.where(e[i] > 0, win_o[i], win_u[i]), push[i],
             np.where(e[i] > 0, pay_o[i], pay_u[i]), lab)
    i = (e >= 0.5) & (e < 3.0)
    line(d[i], win_o[i], push[i], pay_o[i], "mod band, OVER side only")
    i = (e <= -0.5) & (e > -3.0)
    line(d[i], win_u[i], push[i], pay_u[i], "mod band, UNDER side only")

    # ================= SPREAD =================
    print("\n================ 1H SPREAD ================")
    win_h, win_a = d.r_cov > 0, d.r_cov < 0
    push_s = d.r_cov == 0
    pay_h = d.h1_spread_close_pay_h1_spread_home_price
    pay_a = d.h1_spread_close_pay_h1_spread_away_price
    es = d.e_cov
    for lo, lab in ((0.0, "ALL GAMES (model side)"), (1.0, "|edge| >= 1.0"),
                    (1.5, "|edge| >= 1.5"), (2.0, "|edge| >= 2.0"),
                    (2.5, "|edge| >= 2.5")):
        i = es.abs() >= lo
        line(d[i], np.where(es[i] > 0, win_h[i], win_a[i]), push_s[i],
             np.where(es[i] > 0, pay_h[i], pay_a[i]), lab)

    # ================= MONEYLINE =================
    print("\n================ 1H MONEYLINE ================")
    ph, pa = d.h1_ml_close_pay_h1_ml_home, d.h1_ml_close_pay_h1_ml_away
    imp = (1 / (1 + ph)) / ((1 / (1 + ph)) + (1 / (1 + pa)))
    ok = imp.notna()
    print(f"  calibration brier: model {brier_score_loss(d.y_w[ok], d.p_home[ok]):.4f} "
          f"vs de-vigged market {brier_score_loss(d.y_w[ok], imp[ok]):.4f}")
    nz = d.y_m != 0
    for s in (2024, 2025):
        i = nz & (d.season == s)
        acc = ((d.p_home[i] >= 0.5) == (d.y_m[i] > 0)).mean()
        print(f"  {s} straight 1H-winner accuracy: {acc:.1%} (n={int(i.sum())})")
    # bet model side at median price whenever model prob differs from implied
    pick_h = d.p_home >= imp
    win = np.where(pick_h, d.y_m > 0, d.y_m < 0)
    pu = (d.y_m == 0).values
    pay = np.where(pick_h, ph, pa)
    line(d[ok], win[ok], pu[ok.values], pay[ok], "bet model-vs-implied side, ALL")
    for thr in (0.03, 0.05):
        gap = (d.p_home - imp).abs() >= thr
        i = ok & gap
        line(d[i], win[i.values], pu[i.values], pay[i.values],
             f"  prob gap >= {thr:.2f}")


if __name__ == "__main__":
    main()
