"""Battery 4: team-total (full-game) signal mining.

All close bets graded vs consensus close line + median payout. Per-season.
  1. TT-sum residual: (tt_home + tt_away) - game total -> quintiles -> TT and FG bets
  2. TT-implied margin: (tt_away - tt_home) vs FG spread_home -> residual -> spread/TT bets
  3. TT open->close movement: follow/fade; TT lag vs FG total move
  4. Situational TT O/U: fav size, total level, home/away
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)


def payout_arr(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o > 0, o / 100, 100 / -o)


def roi(win, push, pay):
    return np.where(push, 0.0, np.where(win, pay, -1.0))


def rep(df, lab, win="win", push="push", pay="pay"):
    print(f"\n== {lab} ==")
    if not len(df):
        print("  (no bets)")
        return
    for s in sorted(df.season.unique()):
        g = df[df.season == s]
        r = roi(g[win].astype(bool), g[push].astype(bool), g[pay])
        wr = g[win][~g[push].astype(bool)].mean()
        print(f"  {s} (n={len(g)}): win {wr:.1%} | roi {np.nanmean(r)*100:+.1f}%")
    r = roi(df[win].astype(bool), df[push].astype(bool), df[pay])
    print(f"  ALL (n={len(df)}): win {df[win][~df[push].astype(bool)].mean():.1%} | "
          f"roi {np.nanmean(r)*100:+.1f}%")


def bucket_roi(df, bcol, lab, bets):
    """bets = list of (name, win, push, pay)."""
    print(f"\n== {lab} ==")
    for b, g in df.groupby(bcol, observed=True):
        out = [f"  {b} (n={len(g)})"]
        for name, w, p, pa in bets:
            r = roi(g[w].astype(bool), g[p].astype(bool), g[pa])
            out.append(f"{name} {g[w][~g[p].astype(bool)].mean():.1%}/{np.nanmean(r)*100:+.1f}%")
        print(" | ".join(out))


def main():
    f = pd.read_parquet(ROOT / "data" / "h1tt_frame.parquet")
    f["margin"] = f.final_home - f.final_away
    f["total_actual"] = f.final_home + f.final_away
    for side in ("home", "away"):
        ttl = f[f"tt_{side}_close_tt_{side}_point"]
        f[f"tt_{side}_over"] = f[f"final_{side}"] > ttl
        f[f"tt_{side}_push"] = f[f"final_{side}"] == ttl
        f[f"tt_{side}_under"] = ~f[f"tt_{side}_over"] & ~f[f"tt_{side}_push"]
    f["fg_over"] = f.total_actual > f.total_close_total_point
    f["fg_push_t"] = f.total_actual == f.total_close_total_point
    f["fg_under"] = ~f.fg_over & ~f.fg_push_t
    f["home_cov"] = f.margin + f.spread_close_spread_home > 0
    f["push_sp"] = f.margin + f.spread_close_spread_home == 0
    f["away_cov"] = ~f.home_cov & ~f.push_sp

    # ---------- 1. TT-sum residual vs game total
    print("=" * 100)
    print("1. TT-SUM RESIDUAL: (tt_home + tt_away) - posted game total, quintiles")
    f["tt_sum"] = f.tt_home_close_tt_home_point + f.tt_away_close_tt_away_point
    f["sum_resid"] = f.tt_sum - f.total_close_total_point
    print(f.sum_resid.describe().round(2).to_string())
    f["srb"] = pd.qcut(f.sum_resid.rank(method="first"), 5,
                       labels=["q1_low", "q2", "q3", "q4", "q5_high"])
    bucket_roi(f, "srb", "TT-sum residual quintiles (per-bet win%/roi)", [
        ("FGover", "fg_over", "fg_push_t", "total_close_pay_total_over_price"),
        ("FGunder", "fg_under", "fg_push_t", "total_close_pay_total_under_price"),
        ("hmTTov", "tt_home_over", "tt_home_push", "tt_home_close_pay_tt_home_over_price"),
        ("hmTTun", "tt_home_under", "tt_home_push", "tt_home_close_pay_tt_home_under_price"),
        ("awTTov", "tt_away_over", "tt_away_push", "tt_away_close_pay_tt_away_over_price"),
        ("awTTun", "tt_away_under", "tt_away_push", "tt_away_close_pay_tt_away_under_price")])
    # per-season for extreme buckets
    for b in ("q1_low", "q5_high"):
        sub = f[f.srb == b].copy()
        sub["win"], sub["push"] = sub.fg_over, sub.fg_push_t
        sub["pay"] = sub.total_close_pay_total_over_price
        rep(sub, f"{b}: FG OVER per-season")
        sub2 = sub.copy()
        sub2["win"], sub2["pay"] = sub.fg_under, sub.total_close_pay_total_under_price
        rep(sub2, f"{b}: FG UNDER per-season")

    # ---------- 2. TT-implied margin vs spread
    print("\n" + "=" * 100)
    print("2. TT-IMPLIED MARGIN: (tt_home - tt_away) + spread_home, quintiles")
    f["tt_margin"] = f.tt_home_close_tt_home_point - f.tt_away_close_tt_away_point
    f["mar_resid"] = f.tt_margin + f.spread_close_spread_home  # >0 TTs like home more than spread
    print(f.mar_resid.describe().round(2).to_string())
    f["mrb"] = pd.qcut(f.mar_resid.rank(method="first"), 5,
                       labels=["q1_low", "q2", "q3", "q4", "q5_high"])
    bucket_roi(f, "mrb", "TT-margin residual quintiles", [
        ("homeCov", "home_cov", "push_sp", "spread_close_pay_spread_home_price"),
        ("awayCov", "away_cov", "push_sp", "spread_close_pay_spread_away_price"),
        ("hmTTov", "tt_home_over", "tt_home_push", "tt_home_close_pay_tt_home_over_price"),
        ("awTTov", "tt_away_over", "tt_away_push", "tt_away_close_pay_tt_away_over_price")])
    for b in ("q1_low", "q5_high"):
        sub = f[f.mrb == b].copy()
        sub["win"], sub["push"] = sub.home_cov, sub.push_sp
        sub["pay"] = sub.spread_close_pay_spread_home_price
        rep(sub, f"{b}: bet HOME spread per-season")

    # ---------- 3. TT movement open->close
    print("\n" + "=" * 100)
    print("3. TT MOVEMENT (open->close, within TT market's own window)")
    for side in ("home", "away"):
        f[f"tt_{side}_move"] = (f[f"tt_{side}_close_tt_{side}_point"]
                                - f[f"tt_{side}_open_tt_{side}_point"])
    f["fg_tot_move"] = f.total_close_total_point - f.total_open_total_point
    for side in ("home", "away"):
        mv = f[np.abs(f[f"tt_{side}_move"]) >= 1.0].copy()
        up = mv[f"tt_{side}_move"] > 0
        mv["win"] = np.where(up, mv[f"tt_{side}_over"], mv[f"tt_{side}_under"])
        mv["push"] = mv[f"tt_{side}_push"]
        mv["pay"] = np.where(up, mv[f"tt_{side}_close_pay_tt_{side}_over_price"],
                             mv[f"tt_{side}_close_pay_tt_{side}_under_price"])
        rep(mv, f"FOLLOW {side} TT steam >=1.0 at close (n={len(mv)})")
        mv["win"] = np.where(up, mv[f"tt_{side}_under"], mv[f"tt_{side}_over"])
        mv["pay"] = np.where(up, mv[f"tt_{side}_close_pay_tt_{side}_under_price"],
                             mv[f"tt_{side}_close_pay_tt_{side}_over_price"])
        rep(mv, f"FADE {side} TT steam >=1.0 at close")
    # TT lag: FG total moved >=2 but TT side moved < 1 -> bet stale-direction TT at close
    for side in ("home", "away"):
        lag = f[(np.abs(f.fg_tot_move) >= 2.0)
                & (np.abs(f[f"tt_{side}_move"]) < 1.0)].copy()
        up = lag.fg_tot_move > 0
        lag["win"] = np.where(up, lag[f"tt_{side}_over"], lag[f"tt_{side}_under"])
        lag["push"] = lag[f"tt_{side}_push"]
        lag["pay"] = np.where(up, lag[f"tt_{side}_close_pay_tt_{side}_over_price"],
                              lag[f"tt_{side}_close_pay_tt_{side}_under_price"])
        rep(lag, f"FG total moved >=2, {side} TT lagged (<1): bet TT in FG direction")

    # ---------- 4. Situational TT O/U
    print("\n" + "=" * 100)
    print("4. SITUATIONAL TT O/U")
    f["fav_size"] = pd.cut(f.spread_close_spread_home,
                           [-30, -7, -3, 0, 3, 7, 30],
                           labels=["hm_big_fav", "hm_mid_fav", "hm_small_fav",
                                   "aw_small_fav", "aw_mid_fav", "aw_big_fav"])
    bucket_roi(f, "fav_size", "TT O/U by favorite size", [
        ("hmTTov", "tt_home_over", "tt_home_push", "tt_home_close_pay_tt_home_over_price"),
        ("hmTTun", "tt_home_under", "tt_home_push", "tt_home_close_pay_tt_home_under_price"),
        ("awTTov", "tt_away_over", "tt_away_push", "tt_away_close_pay_tt_away_over_price"),
        ("awTTun", "tt_away_under", "tt_away_push", "tt_away_close_pay_tt_away_under_price")])
    f["tot_lvl"] = pd.qcut(f.total_close_total_point, 4,
                           labels=["lowest", "low", "high", "highest"])
    bucket_roi(f, "tot_lvl", "TT O/U by game-total level", [
        ("hmTTov", "tt_home_over", "tt_home_push", "tt_home_close_pay_tt_home_over_price"),
        ("hmTTun", "tt_home_under", "tt_home_push", "tt_home_close_pay_tt_home_under_price"),
        ("awTTov", "tt_away_over", "tt_away_push", "tt_away_close_pay_tt_away_over_price"),
        ("awTTun", "tt_away_under", "tt_away_push", "tt_away_close_pay_tt_away_under_price")])
    # home TT over (battery-1 lean) per-season by fav bucket
    for b in ("hm_big_fav", "hm_mid_fav"):
        sub = f[f.fav_size == b].copy()
        sub["win"], sub["push"] = sub.tt_home_over, sub.tt_home_push
        sub["pay"] = sub.tt_home_close_pay_tt_home_over_price
        rep(sub, f"{b}: home TT OVER per-season")


if __name__ == "__main__":
    main()
