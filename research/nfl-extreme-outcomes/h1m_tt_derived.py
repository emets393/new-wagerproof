"""DERIVED team-total model (suggestion 1): no separate TT model.

TT predictions are split from FG total + margin predictions, so they can never
contradict the total/spread models:
    pred_total  = fg_tot_close + GBM residual (target: actual total - line)
    pred_margin = -fg_sp_close + GBM residual (target: actual margin + sp)
    TT_home = (pred_total + pred_margin) / 2
    TT_away = (pred_total - pred_margin) / 2

Walk-forward (2024 from 2023-train; 2025 from 2023-24-train). Bets and grades
at posted TT consensus CLOSE (median line + median payout).

BASELINE shown first: pure market-implied TT (no model) vs the posted TT line
— implied_tt_home = (fg_tot - fg_sp)/2 — the continuous version of K1's
internal-inconsistency mechanism, per team.
"""
import numpy as np
import pandas as pd
from pathlib import Path

from h1m_models import build_frame
from h1m_models2 import add_xmkt, gbr, FEATS
from h1m_walkforward import wilson

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)
SEASONS = (2024, 2025)


def report(d, win, push, pay, lab):
    win, push, pay = (np.asarray(x, dtype=float) for x in (win, push, pay))
    if len(d) == 0:
        print(f"  {lab:<44} n=0")
        return
    pb = push.astype(bool)
    r = np.where(pb, 0.0, np.where(win.astype(bool), pay, -1.0))
    w, n = int(win[~pb].sum()), int((~pb).sum())
    lo, hi = wilson(w, max(n, 1))
    per = []
    for s in SEASONS:
        i = (d.season == s).values
        if i.sum() == 0:
            continue
        nzs = i & ~pb
        per.append(f"{s}: {int(win[nzs].sum())}/{int(nzs.sum())} "
                   f"{np.nanmean(r[i])*100:+.0f}%")
    print(f"  {lab:<44} n={len(d):<4} win {w}/{n} = {w/max(n,1):.1%} "
          f"roi {np.nanmean(r)*100:+.1f}%  CI[{lo:.0%}-{hi:.0%}]  [" + " | ".join(per) + "]")


def tt_ledger(d, edge, y, line, pay_o, pay_u, lab_prefix):
    """Edge-bucket report for one team's TT: bet over if edge>0 else under."""
    win = np.where(edge > 0, y > line, y < line)
    push = (y == line).values
    pay = np.where(edge > 0, pay_o, pay_u)
    for lo, hi, lab in ((0.0, 99, "ALL (model side)"),
                        (1.0, 99, "|edge| >= 1.0"),
                        (1.5, 99, "|edge| >= 1.5"),
                        (2.0, 99, "|edge| >= 2.0"),
                        (1.0, 3.5, "1.0 <= |edge| < 3.5"),
                        (3.5, 99, "|edge| >= 3.5 (cap zone?)")):
        i = ((edge.abs() >= lo) & (edge.abs() < hi)).values
        report(d[i], win[i], push[i], pay[i], f"{lab_prefix} {lab}")
    i = (edge >= 1.0).values
    report(d[i], (y > line)[i], push[i], pay_o[i], f"{lab_prefix} OVER side >= 1.0")
    i = (edge <= -1.0).values
    report(d[i], (y < line)[i], push[i], pay_u[i], f"{lab_prefix} UNDER side >= 1.0")


def main():
    f = build_frame()
    f = add_xmkt(f)
    f["r_fgtot"] = (f.final_home + f.final_away) - f.fg_tot
    f["r_fgmar"] = (f.final_home - f.final_away) + f.fg_sp

    f["e1"], f["e2"] = np.nan, np.nan
    for test, train in ((2024, [2023]), (2025, [2023, 2024])):
        tr, tei = f[f.season.isin(train)], f.season == test
        m1 = gbr(); m1.fit(tr[FEATS], tr.r_fgtot)
        m2 = gbr(); m2.fit(tr[FEATS], tr.r_fgmar)
        f.loc[tei, "e1"] = m1.predict(f.loc[tei, FEATS])
        f.loc[tei, "e2"] = m2.predict(f.loc[tei, FEATS])
    d = f[f.season.isin(SEASONS)].copy()

    # market-implied and model TTs
    d["imp_tth"] = (d.fg_tot - d.fg_sp) / 2
    d["imp_tta"] = (d.fg_tot + d.fg_sp) / 2
    d["pred_tth"] = d.imp_tth + (d.e1 + d.e2) / 2
    d["pred_tta"] = d.imp_tta + (d.e1 - d.e2) / 2

    # stack home+away into one per-team ledger
    rows = []
    for side, pred, imp, line, y, po, pu in (
        ("H", "pred_tth", "imp_tth", "tt_h", "final_home",
         "tt_home_close_pay_tt_home_over_price", "tt_home_close_pay_tt_home_under_price"),
        ("A", "pred_tta", "imp_tta", "tt_a", "final_away",
         "tt_away_close_pay_tt_away_over_price", "tt_away_close_pay_tt_away_under_price")):
        s = d[["season", "week", "gameday", "home_ab", "away_ab",
               pred, imp, line, y, po, pu]].copy()
        s.columns = ["season", "week", "gameday", "home_ab", "away_ab",
                     "pred", "imp", "line", "y", "pay_o", "pay_u"]
        s["side"] = side
        rows.append(s)
    t = pd.concat(rows, ignore_index=True)
    t = t.dropna(subset=["pred", "line", "y", "pay_o", "pay_u"])
    print(f"DERIVED TT — walk-forward {len(t)} team-lines "
          f"({int((t.season==2024).sum())} in 2024, {int((t.season==2025).sum())} in 2025)")
    print(f"  MAE: derived model {np.abs(t.pred - t.y).mean():.2f} | "
          f"market-implied {np.abs(t.imp - t.y).mean():.2f} | "
          f"posted TT line {np.abs(t.line - t.y).mean():.2f}\n")

    print("BASELINE — market-implied TT vs posted line, NO model")
    tt_ledger(t, t.imp - t.line, t.y, t.line, t.pay_o, t.pay_u, "imp-line")

    print("\nDERIVED MODEL — pred TT vs posted line")
    tt_ledger(t, t.pred - t.line, t.y, t.line, t.pay_o, t.pay_u, "model")

    print("\nCONFLUENCE — model and implied gap agree on direction, both >= 1.0")
    agree = (np.sign(t.pred - t.line) == np.sign(t.imp - t.line)) & \
            ((t.pred - t.line).abs() >= 1.0) & ((t.imp - t.line).abs() >= 1.0)
    e = (t.pred - t.line)[agree]
    sub = t[agree]
    win = np.where(e > 0, sub.y > sub.line, sub.y < sub.line)
    push = (sub.y == sub.line).values
    pay = np.where(e > 0, sub.pay_o, sub.pay_u)
    report(sub, win, push, pay, "both agree, |edge|>=1")
    i = (e >= 1.0).values
    report(sub[i], (sub.y > sub.line)[i], push[i], sub.pay_o[i], "  agree OVER side")
    i = (e <= -1.0).values
    report(sub[i], (sub.y < sub.line)[i], push[i], sub.pay_u[i], "  agree UNDER side")


if __name__ == "__main__":
    main()
