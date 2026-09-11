#!/usr/bin/env python3
"""
NFL 2H live-bet edge study (owner request 2026-09-11) — pre-registered.

Data: halftime 2H consensus (data/nfl_2h_frame.parquet, 2023-25) joined to
nfl-extreme-outcomes quarter_scores (1H/final actuals) + h1m_preds (1H closes,
FG closes, our pregame 1H model). Grade vs the 2H CLOSE consensus at real
median prices (fallback -110). One family, all rungs reported:

  R1 1H-pace overreaction (2H total): 1H total surprise vs 1H close line;
     does the 2H total over-adjust? Both directions tested.
  R2 naive-anchor gap (2H total): posted 2H total vs (FG close total - 1H pts);
     bet against the market's in-game adjustment, threshold rungs.
  R3 favorite trailing at half (2H spread): back the pregame favorite's 2H
     line when they trail, dose by deficit.
  R4 momentum fade (2H spread): fade the 1H dominator's 2H spread.
  R5 pregame 1H-model residual persistence: our 1H total edge applied to the
     2H market.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
NFLX = os.path.join(HERE, "..", "nfl-extreme-outcomes")

NAME_AB = {
 "Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL","Buffalo Bills":"BUF",
 "Carolina Panthers":"CAR","Chicago Bears":"CHI","Cincinnati Bengals":"CIN","Cleveland Browns":"CLE",
 "Dallas Cowboys":"DAL","Denver Broncos":"DEN","Detroit Lions":"DET","Green Bay Packers":"GB",
 "Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX","Kansas City Chiefs":"KC",
 "Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC","Los Angeles Rams":"LA","Miami Dolphins":"MIA",
 "Minnesota Vikings":"MIN","New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG",
 "New York Jets":"NYJ","Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT","San Francisco 49ers":"SF",
 "Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB","Tennessee Titans":"TEN","Washington Commanders":"WSH"}


def roi_line(name, mask, side_win, prices, df):
    """side_win: bool Series (bet wins). prices: american odds Series aligned."""
    m = mask & side_win.notna()
    n = int(m.sum())
    if n < 25:
        print(f"{name:46s} n={n} (too small)")
        return
    w = side_win[m].astype(float)
    pr = prices[m].fillna(-110.0)
    dec = np.where(pr > 0, 1 + pr / 100, 1 + 100 / (-pr))
    ret = np.where(w > 0.5, dec - 1, -1.0)
    per = " | ".join(f"{yr}:{100*w[df.season[m]==yr].mean():.0f}%(n={(df.season[m]==yr).sum()})"
                     for yr in sorted(df.season[m].unique()))
    z = (w.mean() - 0.5) * 2 * np.sqrt(n)
    print(f"{name:46s} n={n:4d}  win {100*w.mean():.1f}%  roi {100*ret.mean():+.1f}%  z={z:+.2f}   {per}")


def main():
    f2 = pd.read_parquet(os.path.join(HERE, "data", "nfl_2h_frame.parquet"))
    f2["home_ab"] = f2.home.map(NAME_AB)
    ct = pd.to_datetime(f2.commence)
    f2["gameday"] = (ct - pd.Timedelta(hours=9)).dt.strftime("%Y-%m-%d")  # UTC night games -> US date

    h1 = pd.read_parquet(os.path.join(NFLX, "data", "h1m_preds.parquet"))
    qs = pd.read_parquet(os.path.join(NFLX, "data", "quarter_scores.parquet"))
    h1 = h1.merge(qs[["game_id", "h1_home", "h1_away", "final_home", "final_away"]], on="game_id")
    h1["gameday"] = pd.to_datetime(h1.gameday).dt.strftime("%Y-%m-%d")

    d = f2.merge(h1, on=["gameday", "home_ab"], how="inner", suffixes=("", "_h1"))
    print(f"joined: {len(d)} of {len(f2)} 2H games ({len(h1)} model games)")

    # actual 2H results
    d["h2_total_act"] = (d.final_home + d.final_away) - (d.h1_home + d.h1_away)
    d["h2_margin_act"] = (d.final_home - d.h1_home) - (d.final_away - d.h1_away)
    d["h1_tot_act"] = d.h1_home + d.h1_away
    d["h1_m_act"] = d.h1_home - d.h1_away

    # grade vs 2H close (pushes -> NaN win, excluded)
    tot_diff = d.h2_total_act - d.close_h2_total
    d["h2_over_win"] = pd.Series(np.where(tot_diff == 0, np.nan, tot_diff > 0), dtype="object")
    sp_diff = d.h2_margin_act + d.close_h2_spread
    d["h2_home_cover"] = pd.Series(np.where(sp_diff == 0, np.nan, sp_diff > 0), dtype="object")

    # ORACLE: betting the realized side must win 100%
    o = d[d.h2_over_win.notna()]
    assert ((o.h2_total_act > o.close_h2_total) == o.h2_over_win.astype(bool)).all()

    ov = d.h2_over_win.astype("float")
    hc = d.h2_home_cover.astype("float")
    print(f"blind: 2H OVER {100*np.nanmean(ov):.1f}% | 2H home cover {100*np.nanmean(hc):.1f}% "
          f"| median 2H total line {d.close_h2_total.median()} vs actual median {d.h2_total_act.median()}")

    over_w = d.h2_over_win.astype("float")
    under_w = 1 - over_w
    homec = d.h2_home_cover.astype("float")
    awayc = 1 - homec
    p_ov, p_un = d.close_h2_over_price, d.close_h2_under_price
    p_hm = d.close_h2_spread_home_price
    p_aw = pd.Series(-110.0, index=d.index)   # away 2H price not stored; assume -110

    print("\n== R1: 1H total surprise (vs 1H close line) -> 2H total ==")
    surp = d.h1_tot_act - d.h1_tot_close if "h1_tot_close" in d else d.h1_tot_act - d["h1_tot_close"]
    for lo, hi, lbl in ((7, 99, "1H ran HOT (>=+7 over 1H line)"), (3, 7, "1H mildly hot (+3..7)"),
                        (-7, -3, "1H mildly cold (-3..-7)"), (-99, -7, "1H ran COLD (<=-7)")):
        m = (surp >= lo) & (surp < hi)
        roi_line(f"{lbl}: bet 2H OVER", m, over_w, p_ov, d)
        roi_line(f"{lbl}: bet 2H UNDER", m, under_w, p_un, d)

    print("\n== R2: posted 2H total vs naive anchor (FG close - 1H pts) ==")
    d["anchor_gap"] = d.close_h2_total - (d.fg_tot - d.h1_tot_act)
    for th in (2, 3, 4):
        roi_line(f"line >= anchor+{th}: bet 2H UNDER", d.anchor_gap >= th, under_w, p_un, d)
        roi_line(f"line <= anchor-{th}: bet 2H OVER", d.anchor_gap <= -th, over_w, p_ov, d)

    print("\n== R3: pregame favorite trailing at half -> 2H spread on favorite ==")
    fav_home = d.fg_sp < 0
    fav_trail = np.where(fav_home, d.h1_m_act < 0, d.h1_m_act > 0)
    fav_cover = pd.Series(np.where(fav_home, homec, awayc), index=d.index)
    fav_price = pd.Series(np.where(fav_home, p_hm, p_aw), index=d.index)
    roi_line("fav trails at half: back fav 2H", pd.Series(fav_trail, index=d.index) & (d.fg_sp.abs() >= 3),
             fav_cover, fav_price, d)
    roi_line("BIG fav (>=6.5) trails: back fav 2H",
             pd.Series(fav_trail, index=d.index) & (d.fg_sp.abs() >= 6.5), fav_cover, fav_price, d)
    roi_line("fav trails by 7+: back fav 2H",
             pd.Series(fav_trail, index=d.index) & (d.fg_sp.abs() >= 3) &
             (np.where(fav_home, -d.h1_m_act, d.h1_m_act) >= 7), fav_cover, fav_price, d)

    print("\n== R4: fade the 1H dominator's 2H spread ==")
    dom_home = d.h1_m_act >= 10
    dom_away = d.h1_m_act <= -10
    roi_line("home dominated 1H by 10+: bet AWAY 2H", pd.Series(dom_home), awayc, p_aw, d)
    roi_line("away dominated 1H by 10+: bet HOME 2H", pd.Series(dom_away), homec, p_hm, d)

    print("\n== R5: pregame 1H-model residual persistence into the 2H market ==")
    for th in (1.0, 1.5):
        roi_line(f"model 1H edge OVER >= {th}: bet 2H OVER", d.resid_tot >= th, over_w, p_ov, d)
        roi_line(f"model 1H edge UNDER <= -{th}: bet 2H UNDER", d.resid_tot <= -th, under_w, p_un, d)


if __name__ == "__main__":
    main()
