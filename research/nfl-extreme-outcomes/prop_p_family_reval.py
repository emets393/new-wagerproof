"""Third-season (2023) revalidation of the movement/form prop signals + attempts price QC.

Part 1 — P10/P12/P13/P15/P16 at FROZEN production thresholds (nfl_slate_props_build.py):
  P12: rec_yds, close <= player's L3 actual avg AND NGS L3 separation >= 3.6335 -> OVER
  P13: rush_yds, close <= L3 avg AND NGS L3 rush efficiency >= 4.8384 -> OVER
  P10: receptions, close line raised two straight prop-weeks -> UNDER
  P15: attempts markets, close - open >= 1.0 -> UNDER
  P16: P15 AND model_pred <= close - 1.5 (prop_model_eval walk-forward preds) -> UNDER
Grade at the T-60 close with the row's real posted price. Per-season splits 2023/24/25.

Part 2 — attempts market PRICE QUALITY: the P14 regrade printed +39% ROI at a 55% hit
rate, which market prices cannot support. Compare the T-60 over/under price
distributions on attempts vs yardage markets, per book, and re-grade P14 under three
price treatments (raw / clamped to [-250,+200] / flat -110) to find what's honest.
"""
import numpy as np
import pandas as pd
from prop_model import t60_lines, MKT_STAT
from attempts_model import amer_profit

D = "data"
P12_SEP, P13_EFF, STEAM, P14_EDGE = 3.6335, 4.8384, 1.0, 1.5


def ngs_l3(fname, col):
    d = pd.read_parquet(f"{D}/{fname}")
    d = d[["season", "week", "player_id", col]].dropna()
    d = d.sort_values(["season", "week"])
    d["v"] = d.groupby(["player_id", "season"])[col].transform(
        lambda s: s.shift(1).rolling(3, min_periods=2).mean())
    return d[["season", "week", "player_id", "v"]]


def main():
    po = pd.read_parquet(f"{D}/player_offense.parquet")
    lines = t60_lines()
    frames = {}
    for mkt, stat in MKT_STAT.items():
        d = po[["season", "week", "player_id", stat]].rename(columns={stat: "actual"}).copy()
        d = d.sort_values(["player_id", "season", "week"])
        d["l3_avg"] = d.groupby("player_id").actual.transform(
            lambda s: s.shift(1).rolling(3, min_periods=2).mean())
        m = lines[lines.market == mkt].merge(d, on=["season", "week", "player_id"], how="inner")
        m = m.dropna(subset=["close_line", "actual"])
        frames[mkt] = m

    def cell(name, s, win, px):
        s = s.copy()
        dec = s.actual != s.close_line
        s, win, px = s[dec], win[dec], px[dec]
        if len(s) < 12:
            print(f"  {name:34s} n={len(s)} (<12 skip)")
            return
        roi = np.nanmean(np.where(win, amer_profit(px.fillna(-110)), -1.0)) * 100
        per = " ".join(f"{y}:{win[s.season == y].mean()*100:.0f}%({(s.season == y).sum()})"
                       for y in (2023, 2024, 2025) if (s.season == y).sum() > 0)
        print(f"  {name:34s} n={len(s):4d} hit={win.mean()*100:5.1f}% ROI={roi:+6.1f}% [{per}]")

    print("=== PART 1: movement/form signals, frozen thresholds, 3 seasons ===")
    sep = ngs_l3("ngs_receiving.parquet", "avg_separation").rename(columns={"v": "sep"})
    m = frames["player_reception_yds"].merge(sep, on=["season", "week", "player_id"], how="left")
    fire = (m.close_line <= m.l3_avg) & (m.sep >= P12_SEP)
    cell("P12 featured WR OVER", m[fire], (m[fire].actual > m[fire].close_line), m[fire].over_px)

    eff = ngs_l3("ngs_rushing.parquet", "efficiency").rename(columns={"v": "eff"})
    m = frames["player_rush_yds"].merge(eff, on=["season", "week", "player_id"], how="left")
    fire = (m.close_line <= m.l3_avg) & (m.eff >= P13_EFF)
    cell("P13 featured RB OVER", m[fire], (m[fire].actual > m[fire].close_line), m[fire].over_px)

    m = frames["player_receptions"].sort_values(["player_id", "season", "week"]).copy()
    g = m.groupby(["player_id"])
    m["prev1"] = g.close_line.shift(1)
    m["prev2"] = g.close_line.shift(2)
    m["prev_season"] = g.season.shift(2)
    fire = (m.close_line > m.prev1) & (m.prev1 > m.prev2) & (m.prev_season == m.season)
    cell("P10 receptions raised x2 UNDER", m[fire], (m[fire].actual < m[fire].close_line), m[fire].under_px)

    att = pd.concat([frames["player_rush_attempts"], frames["player_pass_attempts"]])
    att["steam"] = att.close_line - att.open_line
    f15 = att.steam >= STEAM
    cell("P15 attempts steam UNDER", att[f15], (att[f15].actual < att[f15].close_line), att[f15].under_px)

    ev = pd.read_parquet(f"{D}/prop_model_eval.parquet")
    ev = ev[["season", "week", "player_id", "market", "pred"]]
    att2 = att.merge(ev, on=["season", "week", "player_id", "market"], how="left")
    f16 = (att2.steam >= STEAM) & (att2.pred <= att2.close_line - P14_EDGE)
    cell("P16 steam+model confluence UNDER", att2[f16], (att2[f16].actual < att2[f16].close_line), att2[f16].under_px)

    print("\n=== PART 2: attempts price quality ===")
    pr = pd.read_parquet(f"{D}/props_rows.parquet")
    pr2 = pd.concat([pr, pd.read_parquet(f"{D}/props_rows_extra.parquet")], ignore_index=True)
    for grp, mkts in [("attempts", ["player_rush_attempts", "player_pass_attempts", "player_pass_completions"]),
                      ("yardage", ["player_rush_yds", "player_pass_yds", "player_reception_yds"])]:
        x = pr2[pr2.market.isin(mkts)]
        up = pd.to_numeric(x.under_odds, errors="coerce").dropna()
        print(f"  {grp}: n={len(up)} under-price median={up.median():.0f} "
              f"p10={up.quantile(.1):.0f} p90={up.quantile(.9):.0f} "
              f"plus-money share={(up > 0).mean()*100:.1f}% | worse than -150: {(up < -150).mean()*100:.1f}%")
    x = pr2[pr2.market.isin(["player_rush_attempts", "player_pass_attempts"])]
    x = x.assign(u=pd.to_numeric(x.under_odds, errors="coerce"))
    bad = x.groupby("bookmaker").u.agg(["median", "count"])
    print("  per-book under-price median:\n", bad.to_string())

    # P14 regrade under three price treatments
    m14 = att.merge(ev, on=["season", "week", "player_id", "market"], how="left")
    f = (m14.pred <= m14.close_line - P14_EDGE) & m14.actual.notna()
    s = m14[f]
    s = s[s.actual != s.close_line]
    win = s.actual < s.close_line
    for lbl, px in [("raw prices", s.under_px),
                    ("clamped [-250,+200]", s.under_px.clip(-250, 200)),
                    ("flat -110", pd.Series(-110.0, index=s.index))]:
        roi = np.nanmean(np.where(win, amer_profit(px.fillna(-110)), -1.0)) * 100
        print(f"  P14 regrade {lbl:22s} n={len(s)} hit={win.mean()*100:.1f}% ROI={roi:+6.1f}%")
    hi = s[s.under_px > 0]
    print(f"  rows with PLUS-money under at T-60: {len(hi)} ({len(hi)/max(len(s),1)*100:.1f}%) "
          f"— their hit rate: {(hi.actual < hi.close_line).mean()*100:.1f}%" if len(hi) else "  no plus-money unders")


if __name__ == "__main__":
    main()
