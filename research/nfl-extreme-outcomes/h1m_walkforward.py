"""TRUE walk-forward audit of the 1H models + confluence flags.

Fixes two honesty gaps vs h1m_models2/h1m_confluence:
  1. LOSO trained on future seasons for 2023/2024 rows. Here: 2024 preds from a
     model trained on 2023 only; 2025 preds trained on 2023+2024. 2023 dropped.
  2. K1 used full-season residual rank (look-ahead). Here: rank within the
     WEEK's slate only (achievable live at close).
Adds 95% Wilson CIs on headline win rates.
"""
import numpy as np
import pandas as pd
from pathlib import Path

from h1m_models import build_frame
from h1m_models2 import add_xmkt, gbr, FEATS

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)


def wilson(w, n, z=1.96):
    if n == 0:
        return (np.nan, np.nan)
    p = w / n
    den = 1 + z**2 / n
    c = (p + z**2 / (2 * n)) / den
    h = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / den
    return c - h, c + h


def rep(d, win, push, pay, lab, ci=False):
    win, push, pay = (np.asarray(x) for x in (win, push, pay))
    if len(d) < 5:
        print(f"  {lab:<52} n={len(d):<4} (too thin)")
        return
    r = np.where(push, 0.0, np.where(win, pay, -1.0))
    nz = ~pd.Series(push).astype(bool)
    wr = pd.Series(win)[nz].mean()
    per = []
    for s in (2024, 2025):
        i = (d.season == s).values
        if i.sum() >= 3:
            per.append(f"{s}: {np.nanmean(r[i])*100:+.0f}% (n={i.sum()})")
    extra = ""
    if ci:
        lo, hi = wilson(int(pd.Series(win)[nz].sum()), int(nz.sum()))
        extra = f"  CI95 [{lo:.1%}, {hi:.1%}]"
    print(f"  {lab:<52} n={len(d):<4} win {wr:.1%} roi {np.nanmean(r)*100:+.1f}%"
          f"   [" + " | ".join(per) + "]" + extra)


def main():
    f = build_frame()
    f = add_xmkt(f)
    f["r_tot"] = f.y_tot - f.h1_tot_close
    f["r_cov"] = f.y_m + f.h1_sp_close

    # ---- true walk-forward residual preds
    f["wf_tot"] = np.nan
    f["wf_cov"] = np.nan
    for test, train in ((2024, [2023]), (2025, [2023, 2024])):
        tr, te = f[f.season.isin(train)], f.season == test
        for tgt, col in (("r_tot", "wf_tot"), ("r_cov", "wf_cov")):
            m = gbr()
            m.fit(tr[FEATS], tr[tgt])
            f.loc[te, col] = m.predict(f.loc[te, FEATS])
    wf = f[f.season.isin([2024, 2025])].copy()
    print(f"walk-forward rows: {len(wf)} (2024 model = 2023-only train; "
          f"2025 = 23-24 train)")

    # ---- point-in-time K1: rank within week slate
    wf["k1_resid"] = wf.tt_sum - wf.fg_tot
    wf["k1_pit"] = (wf.groupby(["season", "week"]).k1_resid
                    .transform(lambda x: x.rank(pct=True) >= 0.8)
                    .fillna(False))

    win_o = wf.y_tot > wf.h1_tot_close
    win_u = wf.y_tot < wf.h1_tot_close
    push = wf.y_tot == wf.h1_tot_close
    pay_o = wf.h1_total_close_pay_h1_total_over_price
    pay_u = wf.h1_total_close_pay_h1_total_under_price

    print("\n1H TOTAL — walk-forward edge buckets")
    for lo, hi in ((0.5, 1.25), (1.25, 2.75), (1.5, 2.5), (1.25, 99), (2.75, 99)):
        i = ((wf.wf_tot.abs() >= lo) & (wf.wf_tot.abs() < hi)).values
        d = wf[i]
        w = np.where(d.wf_tot > 0, win_o[i], win_u[i])
        py = np.where(d.wf_tot > 0, pay_o[i], pay_u[i])
        rep(d, w, push[i], py, f"|edge| {lo}-{hi}", ci=(lo, hi) == (1.25, 2.75))

    print("\nM1: model window over (+1.25..+2.75) x K1 point-in-time")
    over_pick = ((wf.wf_tot >= 1.25) & (wf.wf_tot < 2.75)).values
    rep(wf[over_pick], win_o[over_pick], push[over_pick], pay_o[over_pick],
        "model window OVER picks (1H over)", ci=True)
    both = over_pick & wf.k1_pit.values
    rep(wf[both], win_o[both], push[both], pay_o[both],
        "  + K1(pit) fired -> 1H OVER", ci=True)

    print("\nM2: K1(pit) FG over, filtered by model lean")
    fin = wf.final_home + wf.final_away
    fg_win = fin > wf.fg_tot
    fg_push = fin == wf.fg_tot
    fg_pay = wf.total_close_pay_total_over_price
    k1i = wf.k1_pit.values
    rep(wf[k1i], fg_win[k1i], fg_push[k1i], fg_pay[k1i], "K1(pit) alone -> FG OVER", ci=True)
    filt = k1i & (wf.wf_tot > 0.5).values
    rep(wf[filt], fg_win[filt], fg_push[filt], fg_pay[filt],
        "K1(pit) + model lean -> FG OVER", ci=True)
    anti = k1i & (wf.wf_tot <= 0.5).values
    rep(wf[anti], fg_win[anti], fg_push[anti], fg_pay[anti],
        "K1(pit), model flat/under (the drops)")

    print("\nM3: K8 primetime fav x walk-forward spread tilt")
    pt = wf[wf.slot.isin(["snf", "monday"])].copy()
    # favorite's view: fav is home if fg_sp<0
    fav_home = pt.fg_sp < 0
    tilt_fav = np.where(fav_home, pt.wf_cov, -pt.wf_cov)
    cov_fav = np.where(fav_home, pt.r_cov, -pt.r_cov)
    pay_fav = np.where(fav_home, pt.h1_spread_close_pay_h1_spread_home_price,
                       pt.h1_spread_close_pay_h1_spread_away_price)
    w = cov_fav > 0
    p = cov_fav == 0
    rep(pt, w, p, pay_fav, "all K8 (fav 1H, walk-forward seasons)", ci=True)
    a = tilt_fav > 0
    rep(pt[a], w[a], p[a], pay_fav[a], "  model agrees", ci=True)
    rep(pt[~a], w[~a], p[~a], pay_fav[~a], "  model disagrees")


if __name__ == "__main__":
    main()
