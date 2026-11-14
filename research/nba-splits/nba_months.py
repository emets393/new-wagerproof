#!/usr/bin/env python3
"""NBA month by month: betting percentages, ticket volume, and what happened.

⛔ NBA ONLY.

Two tables per view. The first is what the PUBLIC did — volume and how lopsided the
percentages got in each market. The second is what HAPPENED — base rates and whether the
crowd's side won. Pooled across seasons first, then one pair per season, because ticket
volume and the money-vs-tickets gap are NOT comparable across these three seasons:
median volume falls 44,379 -> 23,860 -> 18,036, and AN's NBA money% changed between
2023-24 and 2024-25 (see the README). Outcomes pool fine; those two columns do not.

Placeholder splits (0%/100%) are already excluded upstream by `derive()`.

    python3 nba_months.py
"""
import argparse
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
PARQUET = os.path.join(HERE, "data", "nba_splits.parquet")

ORDER = [10, 11, 12, 1, 2, 3, 4]
NAME = {10: "Oct", 11: "Nov", 12: "Dec", 1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr"}


PUB_POST = [None]


def pub_table(d, title):
    """What the public did: volume and the percentages.

    ⛔ Month rows are REGULAR SEASON only. April holds both the end of the regular
    season and the first round of the playoffs, and mixing them diluted April's over
    rate from 57.6% (n=311) to 53.2% (n=450) — two different competitions in one row.
    The post-season has its own line.
    """
    PUB_POST[0] = d[d.game_type == "post"]
    d = d[d.game_type == "reg"]
    print(f"\n  {title} — WHAT THE PUBLIC DID")
    print(f"    {'month':<7}{'games':>7}{'med tix':>10}{'tix p90':>10}"
          f"{'crowd% sp':>11}{'crowd% ou':>11}{'crowd% ml':>11}"
          f"{'on fav':>8}{'on over':>9}{'|gap| sp':>10}{'|gap| ou':>10}")
    for m in ORDER:
        g = d[d.month == m]
        sp, ou, ml = g[g.sp_ok], g[g.ou_ok], g[g.ml_ok]
        if len(sp) < 25:
            continue
        gap_sp = (sp.mny_away - sp.tix_away).abs().median()
        gap_ou = (ou.mny_over - ou.tix_over).abs().median()
        on_fav = (sp.pub_away == sp.fav_away).mean()
        on_over = (ou.tix_over > 50).mean()
        ml_pct = np.where(ml.tix_ml_away > 50, ml.tix_ml_away, 100 - ml.tix_ml_away)
        print(f"    {NAME[m]:<7}{len(g):>7}{g.tickets.median():>10,.0f}"
              f"{g.tickets.quantile(.9):>10,.0f}{sp.pub_pct.median():>10.0f}%"
              f"{ou.ou_pub_pct.median():>10.0f}%{np.median(ml_pct):>10.0f}%"
              f"{on_fav:>8.0%}{on_over:>9.0%}{gap_sp:>10.1f}{gap_ou:>10.1f}")
    po = PUB_POST[0]
    if len(po) >= 25:
        sp, ou = po[po.sp_ok], po[po.ou_ok]
        print(f"    {'(post)':<7}{len(po):>7}{po.tickets.median():>10,.0f}"
              f"{po.tickets.quantile(.9):>10,.0f}{sp.pub_pct.median():>10.0f}%"
              f"{ou.ou_pub_pct.median():>10.0f}%{'':>11}"
              f"{(sp.pub_away == sp.fav_away).mean():>8.0%}"
              f"{(ou.tix_over > 50).mean():>9.0%}")


def out_table(d, title):
    """What happened, and whether the crowd's side won. Read from the bet's side.

    ⛔ Month rows are REGULAR SEASON only — see pub_table().
    """
    post = d[d.game_type == "post"]
    d = d[d.game_type == "reg"]
    print(f"\n  {title} — WHAT HAPPENED  (break-even 52.4%; FADE = the crowd's side lost)")
    print(f"    {'month':<7}{'home cov':>10}{'over':>8}{'fav cov':>9}"
          f"{'crowd spread':>22}{'crowd totals':>22}")
    for m in ORDER:
        g = d[d.month == m]
        sp, ou = g[g.sp_ok], g[g.ou_ok]
        if len(sp) < 25:
            continue
        ks, ns = int(sp.pub_covered.sum()), len(sp)
        ko, no = int(ou.ou_pub_won.sum()), len(ou)
        ss = (f"{ks}-{ns - ks} {ks / ns:.1%}" + ("  FADE" if ks / ns < .5 else ""))
        oo = (f"{ko}-{no - ko} {ko / no:.1%}" + ("  FADE" if ko / no < .5 else ""))
        print(f"    {NAME[m]:<7}{sp.home_covered.mean():>10.1%}{ou.over_hit.mean():>8.1%}"
              f"{sp.fav_covered.mean():>9.1%}{ss:>22}{oo:>22}")
    po = post
    if len(po) >= 25:
        sp, ou = po[po.sp_ok], po[po.ou_ok]
        ks, ns = int(sp.pub_covered.sum()), len(sp)
        ko, no = int(ou.ou_pub_won.sum()), len(ou)
        print(f"    {'(post)':<7}{sp.home_covered.mean():>10.1%}{ou.over_hit.mean():>8.1%}"
              f"{sp.fav_covered.mean():>9.1%}"
              f"{f'{ks}-{ns - ks} {ks / ns:.1%}' + ('  FADE' if ks / ns < .5 else ''):>22}"
              f"{f'{ko}-{no - ko} {ko / no:.1%}' + ('  FADE' if ko / no < .5 else ''):>22}")


def main():
    argparse.ArgumentParser(description=__doc__,
                            formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    d = pd.read_parquet(PARQUET)
    d = d[d.game_type != "pre"].copy()
    d["slate_date"] = pd.to_datetime(d.slate_date)
    d["month"] = d.slate_date.dt.month
    reg = d[d.game_type == "reg"]

    print("=" * 118)
    print(f"POOLED, 3 SEASONS — regular season by month ({len(reg)} games)")
    print("⚠ med tix and |gap| are pooled here ONLY for shape; they are not comparable "
          "across seasons. Per-season tables follow.")
    print("=" * 118)
    pub_table(d, "POOLED")
    out_table(d, "POOLED")

    for season, sd in d.groupby("season"):
        print("\n" + "=" * 118)
        print(f"SEASON {season - 1}-{str(season)[2:]}  ({len(sd)} games)")
        print("=" * 118)
        pub_table(sd, f"{season - 1}-{str(season)[2:]}")
        out_table(sd, f"{season - 1}-{str(season)[2:]}")


if __name__ == "__main__":
    main()
