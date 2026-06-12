"""Battery 5: confluence + situational splits.

A. TT-sum q5 over signal x P11 ATD-implied-total residual (2024-25 overlap)
B. Keeper overlap: big-fav home-TT-over x TT-sum q5
C. Situational splits: primetime/weekday/roof/wind/div for 1H totals,
   1H spreads, home TT over
All close bets vs consensus close + median payout. Per-season.
"""
import numpy as np
import pandas as pd
from pathlib import Path

from h1tt_p4_teamtotals import roi, rep
from props_p8_gamelines import team_aggregates

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)


def main():
    f = pd.read_parquet(ROOT / "data" / "h1tt_frame.parquet")
    f["total_actual"] = f.final_home + f.final_away
    f["h1_total_actual"] = f.h1_home + f.h1_away
    f["h1_margin"] = f.h1_home - f.h1_away
    f["fg_over"] = f.total_actual > f.total_close_total_point
    f["fg_push_t"] = f.total_actual == f.total_close_total_point
    f["h1_over"] = f.h1_total_actual > f.h1_total_close_h1_total_point
    f["h1_push_t"] = f.h1_total_actual == f.h1_total_close_h1_total_point
    f["tt_home_over"] = f.final_home > f.tt_home_close_tt_home_point
    f["tt_home_push"] = f.final_home == f.tt_home_close_tt_home_point
    f["sum_resid"] = (f.tt_home_close_tt_home_point + f.tt_away_close_tt_away_point
                      - f.total_close_total_point)
    f["srb"] = f.groupby("season").sum_resid.transform(
        lambda x: pd.qcut(x.rank(method="first"), 5, labels=["q1", "q2", "q3", "q4", "q5"]))
    f["ttsum_q5"] = f.srb == "q5"
    f["bigfav"] = f.spread_close_spread_home.abs() >= 7

    # ---------- A. P11 confluence (2024-25 where props exist)
    print("=" * 90)
    print("A. TT-SUM q5 x P11 (ATD-implied total residual), 2024-25")
    t = team_aggregates()
    hm = t[t.team == t.home_team][["season", "week", "home_team", "away_team", "atd_exp"]]
    aw = t[t.team == t.away_team][["season", "week", "home_team", "away_team", "atd_exp"]]
    g = hm.merge(aw, on=["season", "week", "home_team", "away_team"],
                 suffixes=("_hm", "_aw"))
    g["atd_tot"] = g.atd_exp_hm + g.atd_exp_aw
    m = f.merge(g.rename(columns={"home_team": "home_ab", "away_team": "away_ab"}),
                on=["season", "week", "home_ab", "away_ab"], how="left")
    m["p11_imp"] = 8.445 + 7.392 * m.atd_tot          # frozen 2025 fit (LOCKED_MODELS §7)
    m["p11_resid"] = m.p11_imp - m.total_close_total_point
    has = m[m.p11_resid.notna()].copy()
    has["p11_q5"] = has.groupby("season").p11_resid.transform(
        lambda x: x.rank(pct=True) >= 0.8)
    print(f"games with both signals computable: {len(has)}")
    for name, mask in [("TT-sum q5 only", has.ttsum_q5 & ~has.p11_q5),
                       ("P11 q5 only", ~has.ttsum_q5 & has.p11_q5),
                       ("BOTH", has.ttsum_q5 & has.p11_q5),
                       ("either", has.ttsum_q5 | has.p11_q5)]:
        sub = has[mask].copy()
        sub["win"], sub["push"] = sub.fg_over, sub.fg_push_t
        sub["pay"] = sub.total_close_pay_total_over_price
        rep(sub, f"FG OVER | {name}")

    # ---------- B. keeper overlap
    print("\n" + "=" * 90)
    print("B. KEEPER OVERLAP: big-fav home-TT-over vs TT-sum q5")
    both = f[f.bigfav & f.ttsum_q5]
    print(f"bigfav n={f.bigfav.sum()}, ttsum_q5 n={f.ttsum_q5.sum()}, overlap n={len(both)}")
    sub = f[f.bigfav & f.ttsum_q5].copy()
    sub["win"], sub["push"] = sub.tt_home_over, sub.tt_home_push
    sub["pay"] = sub.tt_home_close_pay_tt_home_over_price
    rep(sub, "home TT OVER | bigfav AND ttsum_q5")
    sub = f[f.bigfav & ~f.ttsum_q5].copy()
    sub["win"], sub["push"] = sub.tt_home_over, sub.tt_home_push
    sub["pay"] = sub.tt_home_close_pay_tt_home_over_price
    rep(sub, "home TT OVER | bigfav, NOT ttsum_q5")

    # ---------- C. situational splits
    print("\n" + "=" * 90)
    print("C. SITUATIONAL SPLITS")
    hr = pd.to_datetime(f.gametime, format="%H:%M", errors="coerce").dt.hour
    f["slot"] = np.select(
        [f.weekday.isin(["Thursday", "Friday"]), f.weekday.isin(["Monday"]),
         (f.weekday == "Sunday") & (hr >= 19), (f.weekday == "Sunday") & (hr < 16)],
        ["thu_fri", "monday", "snf", "sun_early"], default="sun_late_sat")
    f["outdoor"] = f.roof.isin(["outdoors", "open"])
    f["windy"] = f.outdoor & (pd.to_numeric(f.wind, errors="coerce") >= 12)

    def split(bcol, lab):
        print(f"\n-- {lab} --")
        for b, g2 in f.groupby(bcol, observed=True):
            o = roi(g2.h1_over, g2.h1_push_t, g2.h1_total_close_pay_h1_total_over_price)
            u = roi(~g2.h1_over & ~g2.h1_push_t, g2.h1_push_t,
                    g2.h1_total_close_pay_h1_total_under_price)
            ho = roi(g2.tt_home_over, g2.tt_home_push, g2.tt_home_close_pay_tt_home_over_price)
            print(f"  {b} (n={len(g2)}): 1H over {np.nanmean(o)*100:+.1f}% | "
                  f"1H under {np.nanmean(u)*100:+.1f}% | homeTTover {np.nanmean(ho)*100:+.1f}%")

    split("slot", "by time slot")
    split("windy", "windy (outdoor wind>=12) vs not")
    split("div_game", "division game")
    # promising slot cells -> per-season
    for slot, bet, wcol, pcol, paycol in [
        ("thu_fri", "1H under", None, None, None)]:
        pass
    # per-season detail for any slot showing |roi|>8 on a side
    for b, g2 in f.groupby("slot"):
        for nm, win, push, pay in [
            ("1H over", g2.h1_over, g2.h1_push_t, g2.h1_total_close_pay_h1_total_over_price),
            ("1H under", ~g2.h1_over & ~g2.h1_push_t, g2.h1_push_t,
             g2.h1_total_close_pay_h1_total_under_price)]:
            r = np.nanmean(roi(win, push, pay))
            if r > 0.06:
                sub = g2.copy()
                sub["win"], sub["push"], sub["pay"] = win, push, pay
                rep(sub, f"slot={b}: {nm} per-season")


if __name__ == "__main__":
    main()
