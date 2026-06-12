"""Battery 7: situational / contextual mining on the context frame.

Team-row design: every game yields 2 rows (one per team) carrying that team's
form, streak, revenge, 1H season-to-date record + the bets gradeable from its
view (its TT over/under, 1H spread cover, 1H ML). All close-consensus bets at
median payout. Per-season shown for any screen that passes pooled roi > +4%
and n >= 45. Sections:
  1. TT line vs L3 scoring form gap (incl extreme jumps)
  2. Divisional games (1H spread/ML/total, TT)
  3. W/L streaks entering the game
  4. Revenge (lost last meeting vs this opponent)
  5. Season-to-date 1H cover/win persistence
  6. Slots x 1H fav/dog
  7. Coach 1H tables + honest OOS tests are in h1tt_p8_coach.py
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)


def roi(win, push, pay):
    return np.where(push, 0.0, np.where(win, pay, -1.0))


def rep(df, lab, always=False):
    if not len(df):
        return
    r = roi(df.win.astype(bool), df.push.astype(bool), df.pay)
    pooled = np.nanmean(r) * 100
    wr = df.win[~df.push.astype(bool)].mean()
    line = f"  {lab:<58} n={len(df):<4} win {wr:.1%} roi {pooled:+.1f}%"
    print(line)
    if always or (pooled > 4 and len(df) >= 45):
        for s in sorted(df.season.unique()):
            g = df[df.season == s]
            rr = roi(g.win.astype(bool), g.push.astype(bool), g.pay)
            print(f"      {s} n={len(g):<4} win {g.win[~g.push.astype(bool)].mean():.1%} "
                  f"roi {np.nanmean(rr)*100:+.1f}%")


def team_rows(f):
    f = f.copy()
    f["h1_margin"] = f.h1_home - f.h1_away
    f["h1_tot_act"] = f.h1_home + f.h1_away
    rows = []
    for side, opp in (("home", "away"), ("away", "home")):
        s0 = side[0]
        o0 = opp[0]
        t = pd.DataFrame({
            "season": f.season, "gameday": f.gameday, "week": f.week,
            "team": f[f"{side}_ab"], "opp": f[f"{opp}_ab"], "is_home": side == "home",
            "slot": f.slot, "divg": f.div_game.astype(bool), "windy": f.windy,
            "coach": f[f"{side}_coach"], "opp_coach": f[f"{opp}_coach"],
            "rest": f[f"{side}_rest"],
            "l3_pf": f[f"{s0}_l3_pf"], "l3_pa": f[f"{s0}_l3_pa"],
            "std_pf": f[f"{s0}_std_pf"], "streak": f[f"{s0}_streak"],
            "opp_streak": f[f"{o0}_streak"],
            "last_mtg_won": f[f"{s0}_last_mtg_won"],
            "h1_cov_rate": f[f"{s0}_h1_cov_rate"], "h1_win_rate": f[f"{s0}_h1_win_rate"],
            "h1_pf_avg": f[f"{s0}_h1_pf_avg"], "h1_n": f[f"{s0}_h1_n"],
            "opp_h1_cov_rate": f[f"{o0}_h1_cov_rate"],
            # team total
            "tt_line": f[f"tt_{side}_close_tt_{side}_point"],
            "tt_pay_o": f[f"tt_{side}_close_pay_tt_{side}_over_price"],
            "tt_pay_u": f[f"tt_{side}_close_pay_tt_{side}_under_price"],
            "pts": f[f"final_{side}"],
            # 1H spread from this team's view
            "h1_sp": (f.h1_spread_close_h1_spread_home if side == "home"
                      else -f.h1_spread_close_h1_spread_home),
            "h1_sp_pay": (f.h1_spread_close_pay_h1_spread_home_price if side == "home"
                          else f.h1_spread_close_pay_h1_spread_away_price),
            "h1_sp_pay_opp": (f.h1_spread_close_pay_h1_spread_away_price if side == "home"
                              else f.h1_spread_close_pay_h1_spread_home_price),
            "h1_m": np.where(side == "home", f.h1_margin, -f.h1_margin),
            # 1H ML from this team's view
            "h1_ml_pay": (f.h1_ml_close_pay_h1_ml_home if side == "home"
                          else f.h1_ml_close_pay_h1_ml_away),
            # FG context
            "fg_sp": (f.spread_close_spread_home if side == "home"
                      else -f.spread_close_spread_home),
            "fg_total": f.total_close_total_point,
        })
        rows.append(t)
    t = pd.concat(rows, ignore_index=True)
    t["tt_over"] = t.pts > t.tt_line
    t["tt_push"] = t.pts == t.tt_line
    t["h1_cov"] = t.h1_m + t.h1_sp > 0
    t["h1_push"] = t.h1_m + t.h1_sp == 0
    t["h1_mlw"] = t.h1_m > 0
    t["h1_mlp"] = t.h1_m == 0
    t["fav"] = t.fg_sp < 0
    return t


def bet(t, kind, side):
    """Return df with win/push/pay for a bet from the team-row view."""
    d = t.copy()
    if kind == "tt":
        if side == "over":
            d["win"], d["push"], d["pay"] = d.tt_over, d.tt_push, d.tt_pay_o
        else:
            d["win"], d["push"], d["pay"] = ~d.tt_over & ~d.tt_push, d.tt_push, d.tt_pay_u
    elif kind == "h1sp":
        if side == "on":
            d["win"], d["push"], d["pay"] = d.h1_cov, d.h1_push, d.h1_sp_pay
        else:
            d["win"], d["push"], d["pay"] = ~d.h1_cov & ~d.h1_push, d.h1_push, d.h1_sp_pay_opp
    elif kind == "h1ml":
        d["win"], d["push"], d["pay"] = d.h1_mlw, d.h1_mlp, d.h1_ml_pay
    return d.dropna(subset=["pay"])


def main():
    f = pd.read_parquet(ROOT / "data" / "h1tt_context.parquet")
    t = team_rows(f)
    print(f"team-rows: {len(t)}")

    # ---------- 1. TT vs L3 form gap
    print("\n" + "=" * 95)
    print("1. TT LINE vs L3 FORM (gap = tt_close - l3 ppg; the 'huge jump' screen)")
    g = t[t.l3_pf.notna() & t.tt_line.notna()].copy()
    g["gap"] = g.tt_line - g.l3_pf
    print(g.gap.describe().round(1).to_string())
    g["gb"] = g.groupby("season").gap.transform(
        lambda x: pd.qcut(x.rank(method="first"), 5, labels=["q1", "q2", "q3", "q4", "q5"]))
    for b in ("q1", "q2", "q3", "q4", "q5"):
        rep(bet(g[g.gb == b], "tt", "over"), f"gap {b}: TT OVER")
        rep(bet(g[g.gb == b], "tt", "under"), f"gap {b}: TT UNDER")
    print("  -- extremes --")
    rep(bet(g[g.gap >= 7], "tt", "under"), "line >= 7 ABOVE L3 form: TT UNDER", always=True)
    rep(bet(g[g.gap >= 7], "tt", "over"), "line >= 7 ABOVE L3 form: TT OVER")
    rep(bet(g[g.gap <= -5], "tt", "over"), "line >= 5 BELOW L3 form: TT OVER", always=True)
    rep(bet(g[g.gap <= -5], "tt", "under"), "line >= 5 BELOW L3 form: TT UNDER")
    # also vs season-to-date ppg
    g["gap_std"] = g.tt_line - g.std_pf
    rep(bet(g[g.gap_std >= 6], "tt", "under"), "line >= 6 above SEASON ppg: TT UNDER", always=True)
    rep(bet(g[g.gap_std <= -5], "tt", "over"), "line >= 5 below SEASON ppg: TT OVER", always=True)

    # ---------- 2. divisional
    print("\n" + "=" * 95)
    print("2. DIVISIONAL GAMES")
    for dv in (True, False):
        sub = t[t.divg == dv]
        lab = "DIV" if dv else "non-div"
        rep(bet(sub[sub.is_home], "h1sp", "on"), f"{lab}: 1H spread HOME")
        rep(bet(sub[sub.fav], "h1sp", "on"), f"{lab}: 1H spread FAV")
        rep(bet(sub[~sub.fav & (sub.fg_sp > 0)], "h1sp", "on"), f"{lab}: 1H spread DOG")
        rep(bet(sub[~sub.fav & (sub.fg_sp > 0)], "h1ml", None), f"{lab}: 1H ML DOG")
        rep(bet(sub[sub.is_home], "tt", "over"), f"{lab}: home TT OVER")
        rep(bet(sub[sub.is_home], "tt", "under"), f"{lab}: home TT UNDER")
    # 1H total in div games
    f2 = f.copy()
    f2["h1_tot_act"] = f2.h1_home + f2.h1_away
    for dv in (1, 0):
        sub = f2[f2.div_game == dv].copy()
        sub["win"] = sub.h1_tot_act < sub.h1_total_close_h1_total_point
        sub["push"] = sub.h1_tot_act == sub.h1_total_close_h1_total_point
        sub["pay"] = sub.h1_total_close_pay_h1_total_under_price
        rep(sub, f"div={dv}: 1H total UNDER")

    # ---------- 3. streaks
    print("\n" + "=" * 95)
    print("3. STREAKS entering the game")
    for cond, lab in [(t.streak <= -2, "lost 2+ straight"),
                      (t.streak <= -3, "lost 3+ straight"),
                      (t.streak >= 2, "won 2+ straight"),
                      (t.streak >= 3, "won 3+ straight")]:
        sub = t[cond]
        rep(bet(sub, "tt", "over"), f"{lab}: their TT OVER")
        rep(bet(sub, "tt", "under"), f"{lab}: their TT UNDER")
        rep(bet(sub, "h1sp", "on"), f"{lab}: 1H spread ON them")
        rep(bet(sub, "h1sp", "against"), f"{lab}: 1H spread AGAINST")
        rep(bet(sub, "h1ml", None), f"{lab}: 1H ML on them")

    # ---------- 4. revenge
    print("\n" + "=" * 95)
    print("4. REVENGE (vs most recent meeting with this opponent)")
    for cond, lab in [(t.last_mtg_won == 0, "LOST last meeting"),
                      (t.last_mtg_won == 1, "WON last meeting"),
                      ((t.last_mtg_won == 0) & t.divg, "LOST last mtg + DIV"),
                      ((t.last_mtg_won == 0) & ~t.fav, "LOST last mtg + now DOG"),
                      ((t.last_mtg_won == 1) & t.fav, "WON last mtg + now FAV")]:
        sub = t[cond.fillna(False)]
        rep(bet(sub, "h1sp", "on"), f"{lab}: 1H spread ON")
        rep(bet(sub, "h1ml", None), f"{lab}: 1H ML on")
        rep(bet(sub, "tt", "over"), f"{lab}: TT OVER")

    # ---------- 5. 1H season-to-date persistence
    print("\n" + "=" * 95)
    print("5. SEASON-TO-DATE 1H RECORD (entering game, >=4 graded 1H games)")
    h = t[t.h1_cov_rate.notna()]
    for cond, lab in [(h.h1_cov_rate >= 0.65, "1H cover rate >= 65%"),
                      (h.h1_cov_rate <= 0.35, "1H cover rate <= 35%"),
                      (h.h1_win_rate >= 0.70, "1H ML win rate >= 70%"),
                      (h.h1_win_rate <= 0.30, "1H ML win rate <= 30%")]:
        sub = h[cond]
        rep(bet(sub, "h1sp", "on"), f"{lab}: 1H spread ON them")
        rep(bet(sub, "h1sp", "against"), f"{lab}: 1H spread AGAINST")
        rep(bet(sub, "h1ml", None), f"{lab}: 1H ML on them")
    # matchup: hot-1H team vs cold-1H team
    both = h[h.opp_h1_cov_rate.notna()]
    hot_v_cold = both[(both.h1_cov_rate >= 0.6) & (both.opp_h1_cov_rate <= 0.4)]
    rep(bet(hot_v_cold, "h1sp", "on"), "hot-1H (>=60%) vs cold-1H (<=40%): 1H spread ON hot", always=True)
    rep(bet(hot_v_cold, "h1ml", None), "hot vs cold: 1H ML on hot")
    # 1H scoring form vs 1H spread: high h1_pf teams
    rep(bet(h[h.h1_pf_avg >= 17], "h1sp", "on"), "1H ppg >= 17 to date: 1H spread ON")
    rep(bet(h[h.h1_pf_avg <= 8], "h1sp", "against"), "1H ppg <= 8 to date: 1H spread AGAINST")

    # ---------- 6. slots x fav/dog
    print("\n" + "=" * 95)
    print("6. SLOTS x 1H FAV/DOG/HOME")
    for slot in ("sun_early", "sun_late_sat", "snf", "monday", "thu_fri"):
        sub = t[t.slot == slot]
        rep(bet(sub[sub.fav], "h1sp", "on"), f"{slot}: 1H spread FAV")
        rep(bet(sub[~sub.fav & (sub.fg_sp > 0)], "h1sp", "on"), f"{slot}: 1H spread DOG")
        rep(bet(sub[~sub.fav & (sub.fg_sp > 0)], "h1ml", None), f"{slot}: 1H ML DOG")
        rep(bet(sub[sub.is_home], "tt", "over"), f"{slot}: home TT over")


if __name__ == "__main__":
    main()
