"""Robustness checks on the 1H-total residual model edge window."""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.inspection import permutation_importance

from h1m_models import build_frame, SEASONS
from h1m_models2 import add_xmkt, gbr, FEATS, loso_pred

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)


def roi_line(d, win, push, pay, lab):
    r = np.where(push, 0.0, np.where(win, pay, -1.0))
    wr = pd.Series(win)[~pd.Series(np.asarray(push))].mean()
    per = []
    for s in SEASONS:
        i = (d.season == s).values
        if i.sum() < 3:
            continue
        rr = r[i]
        per.append(f"{s}: {np.nanmean(rr)*100:+.0f}% (n={i.sum()})")
    print(f"  {lab:<46} n={len(d):<4} win {wr:.1%} roi {np.nanmean(r)*100:+.1f}%"
          f"   [" + " | ".join(per) + "]")


def main():
    f = build_frame()
    f = add_xmkt(f)
    f["r_tot"] = f.y_tot - f.h1_tot_close
    gb_t, _ = loso_pred(f, "r_tot")
    f["edge"] = gb_t
    win_o = (f.y_tot > f.h1_tot_close).values
    win_u = (f.y_tot < f.h1_tot_close).values
    push = (f.y_tot == f.h1_tot_close).values
    pay_o = f.h1_total_close_pay_h1_total_over_price.values
    pay_u = f.h1_total_close_pay_h1_total_under_price.values

    print("WINDOW SENSITIVITY (1H total, gb resid)")
    for lo, hi in ((1.25, 2.25), (1.25, 2.75), (1.5, 2.5), (1.5, 3.0),
                   (1.75, 2.75), (2.0, 3.0), (1.25, 99), (1.75, 99)):
        i = (f.edge.abs() >= lo) & (f.edge.abs() < hi)
        d = f[i]
        w = np.where(d.edge > 0, win_o[i], win_u[i])
        p = push[i]
        py = np.where(d.edge > 0, pay_o[i], pay_u[i])
        roi_line(d, w, p, py, f"|edge| {lo}-{hi}")

    print("\nSIDE SPLIT in 1.5-2.5 window")
    i = (f.edge.abs() >= 1.5) & (f.edge.abs() < 2.5)
    for side, lab in ((f.edge > 0, "OVER picks"), (f.edge < 0, "UNDER picks")):
        j = i & side
        d = f[j]
        w = win_o[j] if lab == "OVER picks" else win_u[j]
        py = pay_o[j] if lab == "OVER picks" else pay_u[j]
        roi_line(d, w, push[j], py, lab)

    print("\nSIDE SPLIT, all |edge| >= 1.5")
    i = f.edge.abs() >= 1.5
    for side, lab in ((f.edge > 0, "OVER picks"), (f.edge < 0, "UNDER picks")):
        j = i & side
        d = f[j]
        w = win_o[j] if lab == "OVER picks" else win_u[j]
        py = pay_o[j] if lab == "OVER picks" else pay_u[j]
        roi_line(d, w, push[j], py, lab)

    print("\nPERMUTATION IMPORTANCE (fit 2023-24, importance on 2025)")
    tr, te = f[f.season != 2025], f[f.season == 2025]
    m = gbr()
    m.fit(tr[FEATS], tr.r_tot)
    pi = permutation_importance(m, te[FEATS], te.r_tot, n_repeats=10, random_state=7)
    imp = pd.Series(pi.importances_mean, index=FEATS).sort_values(ascending=False)
    print(imp.head(12).round(4).to_string())

    print("\nOVERLAP with K1 (tt_sum FG-over keeper): edge-window games also K1?")
    g = f[f.tt_sum.notna() & f.fg_tot.notna()].copy()
    g["k1"] = g.groupby("season").apply(
        lambda x: (x.tt_sum - x.fg_tot).rank(pct=True) >= 0.8,
        include_groups=False).reset_index(level=0, drop=True)
    win_idx = (f.edge.abs() >= 1.5) & (f.edge.abs() < 2.5)
    both = f[win_idx].join(g.k1).fillna({"k1": False})
    print(f"  window n={win_idx.sum()}, also K1: {int(both.k1.sum())} "
          f"({both.k1.mean():.0%}) — and window OVER picks: "
          f"{int((both[both.edge > 0]).k1.sum())}/{(both.edge > 0).sum()} on K1")


if __name__ == "__main__":
    main()
