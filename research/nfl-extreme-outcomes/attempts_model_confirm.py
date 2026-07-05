"""Confirm the model-UNDER edge is real: (a) beats a 'bet every under' baseline (selectivity),
(b) not just re-identifying favorites/dogs (game-script collinearity control),
(c) independent of / additive to the steam-UNDER signal. rush + pass attempts. Read-only.
"""
import numpy as np
import pandas as pd
from attempts_model import panel, props_t60, walk_forward, amer_profit, MKT
from stats_helpers import wilson_ci


def u(sub):
    """grade UNDER at T-60."""
    s = sub[sub.actual != sub.close_line]
    if len(s) < 12:
        return f"n={len(s):4d} (thin)"
    win = (s.actual < s.close_line).values
    roi = np.nanmean(np.where(win, amer_profit(s.under_px.values), -1.0)) * 100
    k, n = int(win.sum()), len(s)
    lo, hi = wilson_ci(k, n)
    per = " ".join(f"{y}:{((s[s.season==y].actual<s[s.season==y].close_line).mean()*100):.0f}%"
                   for y in (2024, 2025) if len(s[s.season == y]))
    return f"n={n:4d} hit={k/n*100:5.1f}% ROI={roi:+6.1f}% [{per}] CI[{lo*100:.0f},{hi*100:.0f}]"


def main():
    p = panel()
    prop = props_t60()
    for mkt in ("player_rush_attempts", "player_pass_attempts"):
        pr = walk_forward(p, mkt).merge(prop[prop.market == mkt].drop(columns="market"),
                                        on=["season", "week", "player_id"], how="inner").dropna(subset=["close_line"])
        pr["edge"] = pr.pred - pr.close_line
        pr["move"] = pr.close_line - pr.open_line
        pr["is_fav"] = pr.team_spread < 0
        print(f"\n========== {mkt}  (n={len(pr)}) ==========")
        print("(a) SELECTIVITY vs 'bet every under':")
        print(f"    ALL unders (baseline)      {u(pr)}")
        print(f"    model UNDER edge>1.5       {u(pr[pr.edge < -1.5])}")
        print(f"    model UNDER edge>2.0       {u(pr[pr.edge < -2.0])}")
        print("(b) FAVORITE control (is model-under just picking dogs/favs?):")
        me = pr[pr.edge < -1.5]
        print(f"    model-under & FAVORITE     {u(me[me.is_fav])}")
        print(f"    model-under & UNDERDOG     {u(me[~me.is_fav])}")
        print(f"    (context: model-under is {me.is_fav.mean()*100:.0f}% favorites)")
        print("(c) INDEPENDENCE from steam-under (open->T-60 move>=1):")
        print(f"    steam-up-under ALONE       {u(pr[pr.move >= 1])}")
        print(f"    model-under ALONE (e>1.5)  {u(pr[pr.edge < -1.5])}")
        print(f"    BOTH (model-under & steam) {u(pr[(pr.edge < -1.5) & (pr.move >= 1)])}")
        print(f"    model-under & NO steam     {u(pr[(pr.edge < -1.5) & (pr.move < 1)])}")


if __name__ == "__main__":
    main()
