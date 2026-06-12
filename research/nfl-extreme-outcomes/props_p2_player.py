"""Player-side deep dive: form vs line vs result.

All signals here are close-line signals graded vs the close (honest). ROI uses
the actual close juice of the side bet. Per-season breakdowns throughout.
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 200)

OU = ["player_pass_yds", "player_pass_tds", "player_receptions",
      "player_reception_yds", "player_rush_yds"]


def payout(odds):
    odds = pd.to_numeric(odds, errors="coerce")
    return np.where(odds > 0, odds / 100.0, 100.0 / -odds)


def roi_line(df, side):
    """ROI betting `side` (over/under) at close on every row of df."""
    if not len(df):
        return np.nan, 0
    odds = df.close_over if side == "over" else df.close_under
    win = df.result_close.eq(side)
    push = df.result_close.eq("push")
    pnl = np.where(win, payout(odds), np.where(push, 0.0, -1.0))
    pnl = pnl[~np.isnan(pnl)]
    return pnl.mean() * 100, len(pnl)


def show(df, label, by):
    out = []
    for keys, grp in df.groupby(by):
        grp = grp[grp.played & grp.result_close.notna()]
        n = len(grp)
        if n < 30:
            continue
        over = grp.result_close.eq("over").mean()
        roi_o, _ = roi_line(grp, "over")
        roi_u, _ = roi_line(grp, "under")
        out.append((*np.atleast_1d(keys), n, f"{over:.1%}", f"{roi_o:+.1f}%", f"{roi_u:+.1f}%"))
    cols = (by if isinstance(by, list) else [by]) + ["n", "over%", "ROI_over", "ROI_under"]
    print(f"\n== {label} ==")
    print(pd.DataFrame(out, columns=cols).to_string(index=False))


def main():
    f = pd.read_parquet(ROOT / "data" / "props_frame.parquet")
    ou = f[f.market.isin(OU) & f.close_line.notna()].copy()
    played = ou[ou.played]

    # ---------- 1. calibration: does the close line center the distribution?
    print("=" * 80)
    print("1. CALIBRATION (played only): actual - close_line")
    cal = played.groupby(["market", "season"]).apply(
        lambda g: pd.Series({
            "n": len(g), "mean_err": (g.actual - g.close_line).mean(),
            "med_err": (g.actual - g.close_line).median(),
            "over%": g.result_close.eq("over").mean(),
            "push%": g.result_close.eq("push").mean()}), include_groups=False).round(3)
    print(cal.to_string())

    # ---------- 2. line vs form deviation
    print("\n" + "=" * 80)
    print("2. LINE vs L5 FORM (dev = (close_line - l5_avg)/l5_avg), gp_prior>=4")
    d = played[(played.gp_prior >= 4) & (played.l5_avg > 0)].copy()
    d["dev"] = (d.close_line - d.l5_avg) / d.l5_avg
    d["dev_b"] = pd.cut(d.dev, [-np.inf, -.4, -.2, -.05, .05, .2, .4, np.inf],
                        labels=["<-40%", "-40:-20", "-20:-5", "-5:+5", "+5:+20", "+20:+40", ">+40%"])
    show(d, "all OU markets x dev bucket", ["dev_b", "season"])
    for mkt in OU:
        show(d[d.market == mkt], f"{mkt} x dev bucket (pooled seasons)", "dev_b")

    # ---------- 3. anomalies
    print("\n" + "=" * 80)
    print("3. ANOMALIES (gp_prior>=4)")
    a = played[played.gp_prior >= 4].copy()
    cases = {
        "line ABOVE season max": a[a.close_line > a.szn_max],
        "line >=1.5x season avg": a[(a.szn_avg > 0) & (a.close_line >= 1.5 * a.szn_avg)],
        "line BELOW season min": a[a.close_line < a.szn_min],
        "line <=0.6x season avg": a[(a.szn_avg > 0) & (a.close_line <= 0.6 * a.szn_avg)],
        "line above L5 max-ish (l5avg*1.6)": a[(a.l5_avg > 0) & (a.close_line >= 1.6 * a.l5_avg)],
    }
    for label, grp in cases.items():
        for season in (2024, 2025):
            s = grp[grp.season == season]
            if len(s) < 20:
                continue
            roi_o, n = roi_line(s, "over")
            roi_u, _ = roi_line(s, "under")
            print(f"{label:38s} {season} n={n:5d} over={s.result_close.eq('over').mean():.1%} "
                  f"ROI_over={roi_o:+.1f}% ROI_under={roi_u:+.1f}%")

    # ---------- 4. no-history players (rookies wk1 / returners)
    print("\n" + "=" * 80)
    print("4. NO PRIOR GAMES THIS SEASON (gp_prior==0, incl wk1)")
    nh = ou[ou.gp_prior == 0]
    show(nh, "no-history x market", ["market", "season"])

    # ---------- 5. ATD calibration
    print("\n" + "=" * 80)
    print("5. ANYTIME TD: close yes-prob bucket vs actual TD rate (played only)")
    atd = f[(f.market == "player_anytime_td") & f.played & f.close_yes_prob.notna()].copy()
    atd["b"] = pd.cut(atd.close_yes_prob, [0, .15, .25, .35, .45, .55, .7, 1])
    t = atd.groupby(["b", "season"], observed=True).apply(
        lambda g: pd.Series({"n": len(g), "implied": g.close_yes_prob.mean(),
                             "actual_td%": g.result_close.eq("yes").mean(),
                             "edge": g.result_close.eq("yes").mean() - g.close_yes_prob.mean()}),
        include_groups=False).round(3)
    print(t.to_string())
    # ROI betting every Yes at close
    win = atd.result_close.eq("yes")
    pnl = np.where(win, payout(atd.close_over), -1.0)
    print(f"\nblind YES all props: n={len(atd):,} ROI={pnl.mean()*100:+.1f}%")


if __name__ == "__main__":
    main()
