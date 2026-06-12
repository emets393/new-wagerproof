"""2025 season ledger: walk-forward model bands x point-in-time signal triggers.

Model trained on 2023-24 only. Signals computed point-in-time (weekly-slate K1,
season-to-date 1H form). Flags:
  M1  model window over (+1.25..+2.75) AND K1(pit)        -> 1H total OVER
  M2  K1(pit) AND model 1H lean (e_tot > +0.5)            -> FG total OVER
  M3  SNF/MNF favorite AND spread-tilt agrees             -> fav 1H spread
  M4  slow-start dog (<=8 1H ppg, dog) AND tilt agrees    -> fade on 1H spread
All bets at consensus close, median payout. Flat 1u.
"""
import numpy as np
import pandas as pd
from pathlib import Path

from h1m_models import build_frame
from h1m_models2 import add_xmkt, gbr, FEATS

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)


def ledger_line(name, df):
    w = int(df.win.sum())
    p = int(df.push.sum())
    l = len(df) - w - p
    r = np.where(df.push, 0.0, np.where(df.win, df.pay, -1.0))
    units = np.nansum(r)
    wr = w / max(w + l, 1)
    print(f"  {name:<44} bets={len(df):<3} {w}-{l}-{p}  win {wr:.1%}  "
          f"roi {np.nanmean(r)*100:+.1f}%  units {units:+.1f}")
    return df.assign(flag=name)


def main():
    f = build_frame()
    f = add_xmkt(f)
    f["r_tot"] = f.y_tot - f.h1_tot_close
    f["r_cov"] = f.y_m + f.h1_sp_close
    tr = f[f.season != 2025]
    te = f[f.season == 2025].copy()
    mt = gbr(); mt.fit(tr[FEATS], tr.r_tot)
    ms = gbr(); ms.fit(tr[FEATS], tr.r_cov)
    te["e_tot"] = mt.predict(te[FEATS])
    te["e_cov"] = ms.predict(te[FEATS])

    # point-in-time K1: weekly slate rank of tt_sum - fg_tot
    te["k1"] = (te.groupby("week")
                .apply(lambda x: (x.tt_sum - x.fg_tot).rank(pct=True) >= 0.8,
                       include_groups=False)
                .reset_index(level=0, drop=True)).fillna(False)

    bets = []
    print(f"2025 SEASON LEDGER — {len(te)} games, model trained 2023-24\n")

    # M1: 1H total over
    m1 = te[(te.e_tot >= 1.25) & (te.e_tot < 2.75) & te.k1].copy()
    m1["win"] = m1.y_tot > m1.h1_tot_close
    m1["push"] = m1.y_tot == m1.h1_tot_close
    m1["pay"] = m1.h1_total_close_pay_h1_total_over_price
    m1["bet"] = "1H OVER " + m1.h1_tot_close.astype(str)
    bets.append(ledger_line("M1 window-over + K1 -> 1H OVER", m1))

    # M2: FG total over
    m2 = te[te.k1 & (te.e_tot > 0.5)].copy()
    fin = m2.final_home + m2.final_away
    m2["win"] = fin > m2.fg_tot
    m2["push"] = fin == m2.fg_tot
    m2["pay"] = m2.total_close_pay_total_over_price
    m2["bet"] = "FG OVER " + m2.fg_tot.astype(str)
    bets.append(ledger_line("M2 K1 + model lean -> FG OVER", m2))

    # M3: primetime fav + tilt agree
    pt = te[te.slot.isin(["snf", "monday"])].copy()
    fav_home = pt.fg_sp < 0
    pt["agree"] = np.where(fav_home, pt.e_cov > 0, pt.e_cov < 0)
    m3 = pt[pt.agree].copy()
    cov_fav = np.where(m3.fg_sp < 0, m3.r_cov, -m3.r_cov)
    m3["win"] = cov_fav > 0
    m3["push"] = cov_fav == 0
    m3["pay"] = np.where(m3.fg_sp < 0, m3.h1_spread_close_pay_h1_spread_home_price,
                         m3.h1_spread_close_pay_h1_spread_away_price)
    m3["bet"] = np.where(m3.fg_sp < 0,
                         m3.home_ab + " 1H " + m3.h1_sp_close.map("{:+g}".format),
                         m3.away_ab + " 1H " + (-m3.h1_sp_close).map("{:+g}".format))
    bets.append(ledger_line("M3 SNF/MNF fav + tilt agree -> fav 1H", m3))

    # M4: slow-start dog fade + tilt agree
    rows = []
    for slow, dogc, bet_home in (("h_h1_pf_avg", te.fg_sp > 0, False),
                                 ("a_h1_pf_avg", te.fg_sp < 0, True)):
        sub = te[(te[slow] <= 8) & te[slow].notna() & dogc].copy()
        agree = sub.e_cov > 0 if bet_home else sub.e_cov < 0
        sub = sub[agree]
        if bet_home:
            sub["win"] = sub.r_cov > 0
            sub["pay"] = sub.h1_spread_close_pay_h1_spread_home_price
            sub["bet"] = sub.home_ab + " 1H " + sub.h1_sp_close.map("{:+g}".format)
        else:
            sub["win"] = sub.r_cov < 0
            sub["pay"] = sub.h1_spread_close_pay_h1_spread_away_price
            sub["bet"] = sub.away_ab + " 1H " + (-sub.h1_sp_close).map("{:+g}".format)
        sub["push"] = sub.r_cov == 0
        rows.append(sub)
    m4 = pd.concat(rows)
    bets.append(ledger_line("M4 slow-start dog fade + tilt agree", m4))

    # portfolio
    cols = ["gameday", "week", "home_ab", "away_ab", "bet", "win", "push", "pay", "flag"]
    port = pd.concat([b[cols] for b in bets], ignore_index=True)
    w, p = int(port.win.sum()), int(port.push.sum())
    l = len(port) - w - p
    r = np.where(port.push, 0.0, np.where(port.win, port.pay, -1.0))
    print(f"\nPORTFOLIO: {len(port)} bets on {port.gameday.str.cat(port.home_ab).nunique()} "
          f"distinct games across {port.week.nunique()} weeks "
          f"(~{len(port)/port.week.nunique():.1f} bets/wk)")
    print(f"  record {w}-{l}-{p}  win {w/(w+l):.1%}  roi {np.nanmean(r)*100:+.1f}%  "
          f"units {np.nansum(r):+.1f}u (flat 1u)")
    ov = port.duplicated(subset=["gameday", "home_ab"], keep=False)
    print(f"  games with 2+ flags: {port[ov].gameday.str.cat(port[ov].home_ab).nunique()}")

    print("\nFULL 2025 BET LIST")
    port["result"] = np.where(port.push, "PUSH", np.where(port.win, "WIN", "LOSS"))
    show = port.sort_values(["week", "gameday"])[
        ["week", "gameday", "away_ab", "home_ab", "flag", "bet", "result"]]
    print(show.to_string(index=False))


if __name__ == "__main__":
    main()
