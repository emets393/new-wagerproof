"""Model x signal confluence for 1H markets.

Questions:
  A. 1H-total model window picks: does K1 (tt-sum) alignment help? And does
     the model edge improve K1's own FG-over bets?
  B. K3 steam-follow: split by whether the 1H spread model tilt agrees.
  C. K7 slow-start-dog fade: split by model agreement.
  D. K8 primetime fav: split by model agreement.
All bets at 1H consensus close (median line + payout), per-season always.
"""
import numpy as np
import pandas as pd
from pathlib import Path

from h1m_models import build_frame, SEASONS
from h1m_models2 import add_xmkt
from h1tt_p7_situational import team_rows, bet

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)


def rep(d, win, push, pay, lab):
    win, push, pay = (np.asarray(x) for x in (win, push, pay))
    if len(d) < 5:
        print(f"  {lab:<52} n={len(d):<4} (too thin)")
        return
    r = np.where(push, 0.0, np.where(win, pay, -1.0))
    wr = pd.Series(win)[~pd.Series(push)].mean()
    per = []
    for s in SEASONS:
        i = (d.season == s).values
        if i.sum() >= 3:
            per.append(f"{s}: {np.nanmean(r[i])*100:+.0f}% (n={i.sum()})")
    print(f"  {lab:<52} n={len(d):<4} win {wr:.1%} roi {np.nanmean(r)*100:+.1f}%"
          f"   [" + " | ".join(per) + "]")


def main():
    preds = pd.read_parquet(ROOT / "data" / "h1m_preds.parquet")
    f = build_frame()
    f = add_xmkt(f)
    f = f.merge(preds[["game_id", "resid_tot", "resid_cov", "prob_home_1h"]],
                on="game_id", how="left")

    # ---------------- A. 1H total model x K1
    f["k1"] = f.groupby("season", group_keys=False).apply(
        lambda x: ((x.tt_sum - x.fg_tot).rank(pct=True) >= 0.8),
        include_groups=False)
    f["k1"] = f.k1.fillna(False)
    win_o = f.y_tot > f.h1_tot_close
    win_u = f.y_tot < f.h1_tot_close
    push = f.y_tot == f.h1_tot_close
    pay_o = f.h1_total_close_pay_h1_total_over_price
    pay_u = f.h1_total_close_pay_h1_total_under_price

    print("A. 1H TOTAL MODEL x K1 (tt-sum top quintile)")
    wnd = (f.resid_tot.abs() >= 1.25) & (f.resid_tot.abs() < 2.75)
    over_pick = wnd & (f.resid_tot > 0)
    d = f[over_pick]
    rep(d, win_o[over_pick], push[over_pick], pay_o[over_pick],
        "model window OVER picks (1H over)")
    for cond, lab in (((over_pick & f.k1), "  + K1 fired (confluence)"),
                      ((over_pick & ~f.k1), "  + K1 quiet")):
        d = f[cond]
        rep(d, win_o[cond], push[cond], pay_o[cond], lab)
    # does the 1H model help K1's own FG over bet?
    fin = f.final_home + f.final_away
    k1i = f.k1.astype(bool)
    fg_win = fin > f.fg_tot
    fg_push = fin == f.fg_tot
    fg_pay_o = f.total_close_pay_total_over_price
    print("  -- K1's FG over, split by 1H model lean --")
    for cond, lab in ((k1i & (f.resid_tot > 0.5), "K1 + model 1H-over lean"),
                      (k1i & (f.resid_tot <= 0.5), "K1, model flat/under")):
        d = f[cond]
        rep(d, fg_win[cond], fg_push[cond], fg_pay_o[cond], f"  {lab}")

    # ---------------- B. K3 steam follow x model tilt
    print("\nB. K3 STEAM-FOLLOW x 1H spread model tilt")
    k3 = f[f.h1_sp_open.notna() & f.h1_sp_close.notna()
           & f.fg_sp.notna() & f.resid_cov.notna()].copy()
    k3["move"] = k3.h1_sp_close - k3.h1_sp_open
    k3 = k3[(k3.move.abs() >= 1.0) & (k3.fg_sp.abs() < 7)].copy()
    m = k3.y_m
    steam_home = k3.move < 0
    win = np.where(steam_home, m + k3.h1_sp_close > 0, m + k3.h1_sp_close < 0)
    pp = (m + k3.h1_sp_close) == 0
    pay = np.where(steam_home, k3.h1_spread_close_pay_h1_spread_home_price,
                   k3.h1_spread_close_pay_h1_spread_away_price)
    rep(k3, win, pp, pay, "all K3 bets")
    agree = np.where(steam_home, k3.resid_cov > 0, k3.resid_cov < 0)
    for a, lab in ((agree, "model AGREES with steam"),
                   (~agree, "model DISAGREES")):
        rep(k3[a], win[a], pp[a], pay[a], "  " + lab)

    # ---------------- C/D on team rows
    t = team_rows(pd.read_parquet(ROOT / "data" / "h1tt_context.parquet"))
    hv = f[["gameday", "season", "resid_cov"]].assign(team=f.home_ab, opp=f.away_ab)
    av = f[["gameday", "season"]].assign(team=f.away_ab, opp=f.home_ab,
                                         resid_cov=-f.resid_cov)
    t = t.merge(pd.concat([hv, av], ignore_index=True),
                on=["season", "gameday", "team", "opp"], how="left")
    t["tilt"] = t.resid_cov   # already in this team's view

    print("\nC. K7 SLOW-START DOG FADE x model tilt")
    k7 = t[(t.h1_pf_avg <= 8) & t.h1_pf_avg.notna() & (t.fg_sp > 0)]
    d = bet(k7, "h1sp", "against")
    rep(d, d.win, d.push, d.pay, "all K7 bets")
    # betting AGAINST the team -> agree means tilt < 0 (model against them too)
    for cond, lab in ((d.tilt < 0, "model agrees (against slow team)"),
                      (d.tilt >= 0, "model disagrees")):
        g = d[cond.fillna(False)]
        rep(g, g.win, g.push, g.pay, "  " + lab)

    print("\nD. K8 PRIMETIME FAV x model tilt")
    k8 = t[t.slot.isin(["snf", "monday"]) & t.fav]
    d = bet(k8, "h1sp", "on")
    rep(d, d.win, d.push, d.pay, "all K8 bets")
    for cond, lab in ((d.tilt > 0, "model agrees (on the fav)"),
                      (d.tilt <= 0, "model disagrees")):
        g = d[cond.fillna(False)]
        rep(g, g.win, g.push, g.pay, "  " + lab)

    # ---------------- E. portfolio: model window over + any totals keeper
    print("\nE. 1H TOTAL portfolio: model-window over OR (K1 + model lean)")
    port = over_pick | (k1i & (f.resid_tot > 0.5))
    d = f[port]
    rep(d, win_o[port], push[port], pay_o[port], "portfolio (1H over at close)")


if __name__ == "__main__":
    main()
