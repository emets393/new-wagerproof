"""Print real-game examples for each H1TT keeper (K1-K8).

Re-runs each trigger and shows the most recent qualifying games with the
lines, scores, and bet result so the rules are concrete.
"""
import numpy as np
import pandas as pd
from pathlib import Path

from h1tt_p7_situational import team_rows, bet
from h1tt_p2_movement import payout

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 240)
GK = ["season", "gameday", "home_ab", "away_ab"]
N_SHOW = 6


def show(df, cols, label, n=N_SHOW):
    print(f"\n{'=' * 110}\n{label}  (showing {min(n, len(df))} of {len(df)} bets)\n{'-' * 110}")
    d = df.sort_values("gameday", ascending=False).head(n)
    print(d[cols].to_string(index=False))


def res_col(d):
    return np.where(d.push, "PUSH", np.where(d.win, "WIN", "LOSS"))


def main():
    f = pd.read_parquet(ROOT / "data" / "h1tt_context.parquet")
    t = team_rows(f)

    # ---------------- K1: TT-sum residual top quintile -> game OVER
    g = f[f.tt_home_close_tt_home_point.notna() & f.tt_away_close_tt_away_point.notna()
          & f.total_close_total_point.notna()].copy()
    g["tt_sum"] = g.tt_home_close_tt_home_point + g.tt_away_close_tt_away_point
    g["resid"] = g.tt_sum - g.total_close_total_point
    g["q5"] = g.groupby("season").resid.transform(
        lambda x: x.rank(pct=True) >= 0.8)
    k1 = g[g.q5].copy()
    k1["matchup"] = k1.away_ab + "@" + k1.home_ab
    k1["final_pts"] = k1.final_home + k1.final_away
    k1["win"] = k1.final_pts > k1.total_close_total_point
    k1["push"] = k1.final_pts == k1.total_close_total_point
    k1["result"] = res_col(k1)
    k1 = k1.rename(columns={"tt_home_close_tt_home_point": "tt_home",
                            "tt_away_close_tt_away_point": "tt_away",
                            "total_close_total_point": "game_total"})
    show(k1, ["gameday", "matchup", "tt_home", "tt_away", "tt_sum", "game_total",
              "resid", "final_pts", "result"],
         "K1 tt_sum_q5_over — team totals sum >> posted total -> bet game OVER")

    # ---------------- K2: |spread| >= 7 -> home TT OVER
    k2 = f[(f.spread_close_spread_home.abs() >= 7)
           & f.tt_home_close_tt_home_point.notna()].copy()
    k2["matchup"] = k2.away_ab + "@" + k2.home_ab
    k2["win"] = k2.final_home > k2.tt_home_close_tt_home_point
    k2["push"] = k2.final_home == k2.tt_home_close_tt_home_point
    k2["result"] = res_col(k2)
    k2 = k2.rename(columns={"spread_close_spread_home": "fg_spread_home",
                            "tt_home_close_tt_home_point": "home_tt",
                            "final_home": "home_pts"})
    show(k2, ["gameday", "matchup", "fg_spread_home", "home_tt", "home_pts", "result"],
         "K2 bigfav_home_tt_over — |FG spread| >= 7 -> bet HOME team total OVER")

    # ---------------- K3: 1H spread steam follow, |FG spread| < 7
    k3 = f[f.h1_spread_open_h1_spread_home.notna()
           & f.h1_spread_close_h1_spread_home.notna()
           & f.spread_close_spread_home.notna()].copy()
    k3["move"] = k3.h1_spread_close_h1_spread_home - k3.h1_spread_open_h1_spread_home
    k3 = k3[(k3.move.abs() >= 1.0) & (k3.spread_close_spread_home.abs() < 7)].copy()
    k3["matchup"] = k3.away_ab + "@" + k3.home_ab
    # spread_home dropped -> money on HOME -> bet home 1H
    k3["bet_side"] = np.where(k3.move < 0, k3.home_ab + " 1H", k3.away_ab + " 1H")
    k3["h1_score"] = (k3.h1_away.astype(int).astype(str) + "-"
                      + k3.h1_home.astype(int).astype(str))
    m = k3.h1_home - k3.h1_away
    edge = np.where(k3.move < 0, m + k3.h1_spread_close_h1_spread_home,
                    -(m + k3.h1_spread_close_h1_spread_home))
    k3["win"], k3["push"] = edge > 0, edge == 0
    k3["result"] = res_col(k3)
    k3 = k3.rename(columns={"h1_spread_open_h1_spread_home": "h1_open",
                            "h1_spread_close_h1_spread_home": "h1_close",
                            "spread_close_spread_home": "fg_spread"})
    show(k3, ["gameday", "matchup", "h1_open", "h1_close", "move", "fg_spread",
              "bet_side", "h1_score", "result"],
         "K3 h1_steam_follow_small — 1H spread moved >=1 & |FG spread|<7 -> follow steam (away-home 1H score)")

    # ---------------- K4: offshore stale chase
    d = pd.read_parquet(ROOT / "data" / "odds_hist.parquet")
    from h1tt_p2_movement import CITY_NAMES
    d["snap_dt"] = pd.to_datetime(d.snap_ts, utc=True, format="ISO8601")
    comm = pd.to_datetime(d.commence_time, utc=True, format="ISO8601")
    d["gameday"] = comm.dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d")
    d["home_ab"] = d.home_team.map(CITY_NAMES)
    d["away_ab"] = d.away_team.map(CITY_NAMES)
    d = d[d.snap_dt < comm]
    frame = f.copy()
    frame["h1_margin"] = frame.h1_home - frame.h1_away
    resmap = frame.set_index(GK)["h1_margin"]

    rows = []
    sub = d[d.h1_spread_home.notna()][GK + ["book", "snap_dt", "h1_spread_home",
                                            "h1_spread_home_price",
                                            "h1_spread_away_price"]].sort_values("snap_dt")
    for lead_book in ("betus", "betonlineag"):
        for key, g in sub.groupby(GK):
            if key not in resmap.index:
                continue
            lead = g[g.book == lead_book]
            if len(lead) < 2:
                continue
            v = lead.h1_spread_home.values
            moves = np.where(np.abs(v[1:] - v[:-1]) >= 1.0)[0]
            if not len(moves):
                continue
            i = moves[0]
            t_move, frm, to = lead.snap_dt.iloc[i + 1], v[i], v[i + 1]
            lag = g[(g.snap_dt == t_move) & (g.book != lead_book)
                    & (g.h1_spread_home == frm)
                    & g.book.isin(["draftkings", "fanduel", "betmgm",
                                   "williamhill_us", "betrivers"])]
            if not len(lag):
                continue
            b = lag.iloc[0]
            m = resmap.loc[key]
            if to < frm:   # home steamed -> bet home at stale line
                side = f"{key[2]} 1H {frm:+g}"
                win, push = m + frm > 0, m + frm == 0
            else:
                side = f"{key[3]} 1H {-frm:+g}"
                win, push = m + frm < 0, m + frm == 0
            rows.append(dict(season=key[0], gameday=key[1],
                             matchup=f"{key[3]}@{key[2]}", leader=lead_book,
                             lead_move=f"{frm:+g}->{to:+g}", stale_book=b.book,
                             bet=side, h1_margin=m, win=win, push=push))
    k4 = pd.DataFrame(rows)
    k4["result"] = res_col(k4)
    show(k4, ["gameday", "matchup", "leader", "lead_move", "stale_book", "bet",
              "h1_margin", "result"],
         "K4 offshore_stale_h1sp — BetUS/BetOnline 1H move >=1, US book stale -> bet stale line")

    # ---------------- K5/K6: prior-game TT performance x this week's TT move
    tr = t[t.tt_line.notna()].sort_values(["team", "season", "gameday"]).copy()
    gper = tr.groupby(["team", "season"])
    tr["prev_tt"] = gper.tt_line.shift(1)
    tr["prev_pts"] = gper.pts.shift(1)
    tr["prev_opp"] = gper.opp.shift(1)
    tr["miss"] = tr.prev_tt - tr.prev_pts
    tr["line_chg"] = tr.tt_line - tr.prev_tt

    k5 = tr[(tr.miss >= 8) & (tr.line_chg <= -2)].copy()
    k5 = bet(k5, "tt", "over")
    k5["result"] = res_col(k5)
    k5["last_game"] = (k5.prev_opp.astype(str) + ": TT " + k5.prev_tt.astype(str)
                       + ", scored " + k5.prev_pts.astype(int).astype(str))
    show(k5, ["gameday", "team", "opp", "last_game", "tt_line", "line_chg",
              "pts", "result"],
         "K5 tt_cut_bounceback_over — missed own TT by >=8, book cut TT >=2 -> bet their TT OVER")

    k6 = tr[(tr.miss <= -10) & (tr.line_chg >= 3)].copy()
    k6 = bet(k6, "tt", "over")
    k6["result"] = res_col(k6)
    k6["last_game"] = (k6.prev_opp.astype(str) + ": TT " + k6.prev_tt.astype(str)
                       + ", scored " + k6.prev_pts.astype(int).astype(str))
    show(k6, ["gameday", "team", "opp", "last_game", "tt_line", "line_chg",
              "pts", "result"],
         "K6 tt_raise_momentum_over — beat own TT by >=10, book raised TT >=3 -> bet their TT OVER anyway")

    # ---------------- K7: slow-start dog fade in 1H
    k7 = t[(t.h1_pf_avg <= 8) & t.h1_pf_avg.notna() & (t.fg_sp > 0)].copy()
    k7 = bet(k7, "h1sp", "against")
    k7["result"] = res_col(k7)
    k7["h1_pf_avg"] = k7.h1_pf_avg.round(1)
    k7["bet_side"] = k7.opp + " 1H " + (-k7.h1_sp).map("{:+g}".format)
    show(k7, ["gameday", "team", "h1_pf_avg", "fg_sp", "bet_side", "h1_m", "result"],
         "K7 slow_start_dog_fade_1h — team <=8 1H ppg to date + FG dog -> bet opponent on 1H spread "
         "(h1_m = slow team's 1H margin)")

    # ---------------- K8: primetime 1H favorites
    k8 = t[t.slot.isin(["snf", "monday"]) & t.fav].copy()
    k8 = bet(k8, "h1sp", "on")
    k8["result"] = res_col(k8)
    k8["bet_side"] = k8.team + " 1H " + k8.h1_sp.map("{:+g}".format)
    show(k8, ["gameday", "slot", "team", "opp", "fg_sp", "bet_side", "h1_m", "result"],
         "K8 primetime_1h_fav — SNF/MNF -> bet FG favorite on 1H spread (h1_m = fav's 1H margin)")

    # tallies
    print("\n" + "=" * 110)
    for lab, dd in (("K1", k1), ("K2", k2), ("K3", k3), ("K4", k4),
                    ("K5", k5), ("K6", k6), ("K7", k7), ("K8", k8)):
        w = dd.win[~dd.push.astype(bool)].mean()
        print(f"{lab}: n={len(dd)}  win {w:.1%}")


if __name__ == "__main__":
    main()
