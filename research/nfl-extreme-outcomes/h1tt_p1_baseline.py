"""1H baselines + cross-market residual signals.

All bets graded vs the consensus line/payout at the snapshot used (open bets
vs open line+price, close bets vs close). Per-season always. Fitted models are
cross-season (fit one, test the other two pooled per-season-reported).
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)


def roi_side(win, push, pay):
    return np.where(push, 0.0, np.where(win, pay, -1.0))


def seasontab(df, label, cols):
    """cols = list of (name, win, push, pay) tuples already in df."""
    rows = []
    for s, g in df.groupby("season"):
        r = [s, len(g)]
        for name, win, push, pay in cols:
            w, p, pk = g[win], g[push], g[pay]
            valid = w.notna() & pk.notna()
            roi = roi_side(w[valid].astype(bool), p[valid].astype(bool), pk[valid])
            wr = w[valid & ~p].mean()
            r += [f"{wr:.1%}", f"{np.nanmean(roi)*100:+.1f}%"]
        rows.append(r)
    hdr = ["season", "n"] + [x for name, *_ in cols for x in (f"{name}_w%", f"{name}_roi")]
    print(f"\n== {label} ==")
    print(pd.DataFrame(rows, columns=hdr).to_string(index=False))


def add_grades(f):
    f = f.copy()
    f["h1_margin"] = f.h1_home - f.h1_away
    f["h1_total_actual"] = f.h1_home + f.h1_away
    f["margin"] = f.final_home - f.final_away
    f["total_actual"] = f.final_home + f.final_away
    for ts in ("open", "close"):
        sp = f[f"h1_spread_{ts}_h1_spread_home"]
        f[f"h1_home_cov_{ts}"] = f.h1_margin + sp > 0
        f[f"h1_push_sp_{ts}"] = f.h1_margin + sp == 0
        tot = f[f"h1_total_{ts}_h1_total_point"]
        f[f"h1_over_{ts}"] = f.h1_total_actual > tot
        f[f"h1_push_tot_{ts}"] = f.h1_total_actual == tot
        fsp = f[f"spread_{ts}_spread_home"]
        f[f"fg_home_cov_{ts}"] = f.margin + fsp > 0
        f[f"fg_push_sp_{ts}"] = f.margin + fsp == 0
        ftot = f[f"total_{ts}_total_point"]
        f[f"fg_over_{ts}"] = f.total_actual > ftot
        f[f"fg_push_tot_{ts}"] = f.total_actual == ftot
        for side, sc in (("home", "h1_home"), ("away", "h1_away")):
            ttl = f[f"tt_{side}_{ts}_tt_{side}_point"]
            # team totals are FULL GAME team totals
            act = f[f"final_{side}"]
            f[f"tt_{side}_over_{ts}"] = act > ttl
            f[f"tt_{side}_push_{ts}"] = act == ttl
    # inverse outcomes for betting the other side
    for ts in ("open", "close"):
        f[f"h1_away_cov_{ts}"] = ~f[f"h1_home_cov_{ts}"] & ~f[f"h1_push_sp_{ts}"]
        f[f"h1_under_{ts}"] = ~f[f"h1_over_{ts}"] & ~f[f"h1_push_tot_{ts}"]
        for side in ("home", "away"):
            f[f"tt_{side}_under_{ts}"] = (~f[f"tt_{side}_over_{ts}"]
                                          & ~f[f"tt_{side}_push_{ts}"])
    return f


def main():
    f = pd.read_parquet(ROOT / "data" / "h1tt_frame.parquet")
    f = add_grades(f)
    print(f"games: {len(f)}")

    # ---------- 1. BASELINES at close
    print("\n" + "=" * 100)
    print("1. BASELINES (bet every game at consensus CLOSE)")
    seasontab(f, "1H spread: home / away", [
        ("h1_home", "h1_home_cov_close", "h1_push_sp_close", "h1_spread_close_pay_h1_spread_home_price"),
        ("h1_away", "h1_away_cov_close", "h1_push_sp_close", "h1_spread_close_pay_h1_spread_away_price")])
    seasontab(f, "1H total: over / under", [
        ("h1_over", "h1_over_close", "h1_push_tot_close", "h1_total_close_pay_h1_total_over_price"),
        ("h1_under", "h1_under_close", "h1_push_tot_close", "h1_total_close_pay_h1_total_under_price")])
    f["fav_home"] = f.spread_close_spread_home < 0
    fav = f[f.fav_home]
    dog = f[~f.fav_home & (f.spread_close_spread_home > 0)]
    seasontab(fav, "1H spread when HOME is FG favorite (bet home / bet away)", [
        ("home", "h1_home_cov_close", "h1_push_sp_close", "h1_spread_close_pay_h1_spread_home_price"),
        ("away", "h1_away_cov_close", "h1_push_sp_close", "h1_spread_close_pay_h1_spread_away_price")])
    seasontab(dog, "1H spread when HOME is FG dog (bet home / bet away)", [
        ("home", "h1_home_cov_close", "h1_push_sp_close", "h1_spread_close_pay_h1_spread_home_price"),
        ("away", "h1_away_cov_close", "h1_push_sp_close", "h1_spread_close_pay_h1_spread_away_price")])
    seasontab(f, "team totals at close: home over/under", [
        ("hm_ov", "tt_home_over_close", "tt_home_push_close", "tt_home_close_pay_tt_home_over_price"),
        ("hm_un", "tt_home_under_close", "tt_home_push_close", "tt_home_close_pay_tt_home_under_price")])
    seasontab(f, "team totals at close: away over/under", [
        ("aw_ov", "tt_away_over_close", "tt_away_push_close", "tt_away_close_pay_tt_away_over_price"),
        ("aw_un", "tt_away_under_close", "tt_away_push_close", "tt_away_close_pay_tt_away_under_price")])

    # ---------- 2. RATIO EXTREMES (1H line vs FG line, both at close)
    print("\n" + "=" * 100)
    print("2. RATIO EXTREMES at close")
    f["tot_ratio"] = f.h1_total_close_h1_total_point / f.total_close_total_point
    f["rat_b"] = pd.qcut(f.tot_ratio, 5, labels=["very low", "low", "mid", "high", "very high"])
    for b, g in f.groupby("rat_b", observed=True):
        roi_o = roi_side(g.h1_over_close, g.h1_push_tot_close, g.h1_total_close_pay_h1_total_over_price)
        roi_u = roi_side(g.h1_under_close, g.h1_push_tot_close, g.h1_total_close_pay_h1_total_under_price)
        fg_o = roi_side(g.fg_over_close, g.fg_push_tot_close, g.total_close_pay_total_over_price)
        print(f"  h1/fg total ratio {b:>9} (n={len(g)}): ratio {g.tot_ratio.mean():.3f} | "
              f"1H over {g.h1_over_close[~g.h1_push_tot_close].mean():.1%} roi {np.nanmean(roi_o)*100:+.1f}% | "
              f"1H under roi {np.nanmean(roi_u)*100:+.1f}% | FG over roi {np.nanmean(fg_o)*100:+.1f}%")
    # spread ratio only when FG spread is meaningful
    sp = f[f.spread_close_spread_home.abs() >= 2.5].copy()
    sp["sp_ratio"] = sp.h1_spread_close_h1_spread_home / sp.spread_close_spread_home
    sp["spb"] = pd.qcut(sp.sp_ratio, 5, labels=["very low", "low", "mid", "high", "very high"])
    for b, g in sp.groupby("spb", observed=True):
        roi_h = roi_side(g.h1_home_cov_close, g.h1_push_sp_close, g.h1_spread_close_pay_h1_spread_home_price)
        roi_a = roi_side(g.h1_away_cov_close, g.h1_push_sp_close, g.h1_spread_close_pay_h1_spread_away_price)
        print(f"  h1/fg spread ratio {b:>9} (n={len(g)}): ratio {g.sp_ratio.mean():.3f} | "
              f"1H home cov {g.h1_home_cov_close[~g.h1_push_sp_close].mean():.1%} "
              f"roi H {np.nanmean(roi_h)*100:+.1f}% A {np.nanmean(roi_a)*100:+.1f}%")

    # ---------- 3. CROSS-SEASON FITTED RESIDUALS (FG close -> implied 1H, vs posted 1H)
    print("\n" + "=" * 100)
    print("3. FG-IMPLIED 1H RESIDUALS (fit season X, test others; rank-based quintiles)")
    for target, post, actual, win_o, push_o, pay_o, pay_u, lab in [
        ("h1_total_actual", "h1_total_close_h1_total_point", "h1_total_actual",
         "h1_over_close", "h1_push_tot_close",
         "h1_total_close_pay_h1_total_over_price", "h1_total_close_pay_h1_total_under_price",
         "1H TOTAL"),
        ("h1_margin", "h1_spread_close_h1_spread_home", "h1_margin",
         "h1_home_cov_close", "h1_push_sp_close",
         "h1_spread_close_pay_h1_spread_home_price", "h1_spread_close_pay_h1_spread_away_price",
         "1H SPREAD (resid>0 = model likes home)"),
    ]:
        X_cols = ["spread_close_spread_home", "total_close_total_point"]
        for tr in (2023, 2024, 2025):
            train = f[f.season == tr].dropna(subset=X_cols + [target])
            X1 = np.column_stack([np.ones(len(train)), train[X_cols].values])
            beta, *_ = np.linalg.lstsq(X1, train[target].values, rcond=None)
            test = f[f.season != tr].dropna(subset=X_cols + [post]).copy()
            imp = np.column_stack([np.ones(len(test)), test[X_cols].values]) @ beta
            if "TOTAL" in lab:
                test["resid"] = imp - test[post]
            else:
                test["resid"] = imp + test[post]  # spread_home is a handicap
            test["rb"] = pd.qcut(test.resid, 5, labels=["q1", "q2", "q3", "q4", "q5"])
            print(f"\n  {lab} | fit {tr} -> test others")
            for (b, s), g in test.groupby(["rb", "season"], observed=True):
                ro = roi_side(g[win_o], g[push_o], g[pay_o])
                ru = roi_side(~g[win_o] & ~g[push_o], g[push_o], g[pay_u])
                print(f"    {b} {s} (n={len(g)}): resid {g.resid.mean():+.2f} | "
                      f"over/home {g[win_o][~g[push_o]].mean():.1%} "
                      f"ROI o/h {np.nanmean(ro)*100:+.1f}% u/a {np.nanmean(ru)*100:+.1f}%")


if __name__ == "__main__":
    main()
