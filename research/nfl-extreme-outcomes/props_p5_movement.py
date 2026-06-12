"""Intraweek line-movement signals + consensus-side variant of outlier signal.

Grading honesty: every bet is graded at the line/odds available AT or AFTER the
signal triggers (close signals -> close line). Per-season throughout.
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)
OU = ["player_pass_yds", "player_pass_tds", "player_receptions",
      "player_reception_yds", "player_rush_yds"]
BOOKS = ["draftkings", "fanduel", "betmgm", "williamhill_us"]


def payout(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o > 0, o / 100, 100 / -o)


def roi(g, side):
    odds = g.close_over if side == "over" else g.close_under
    pnl = np.where(g.result_close.eq(side), payout(odds),
                   np.where(g.result_close.eq("push"), 0, -1.0))
    pnl = pnl[~np.isnan(pnl)]
    return (pnl.mean() * 100 if len(pnl) else np.nan), len(pnl)


def table(df, by, label, min_n=40):
    rows = []
    for keys, g in df.groupby(by, observed=True):
        if len(g) < min_n:
            continue
        ro, n = roi(g, "over")
        ru, _ = roi(g, "under")
        rows.append((*np.atleast_1d(keys), n, f"{g.result_close.eq('over').mean():.1%}",
                     f"{ro:+.1f}%", f"{ru:+.1f}%"))
    cols = (by if isinstance(by, list) else [by]) + ["n", "over%", "ROI_over", "ROI_under"]
    print(f"\n== {label} ==")
    print(pd.DataFrame(rows, columns=cols).to_string(index=False))


def main():
    f = pd.read_parquet(ROOT / "data" / "props_frame.parquet")
    ou = f[f.market.isin(OU) & f.played & f.close_line.notna()
           & f.open_line.notna() & (f.n_snaps >= 4)].copy()

    # normalized move: line delta as % of open line
    ou["mv"] = (ou.close_line - ou.open_line) / ou.open_line.clip(lower=0.5)

    # ---------- 1. open->close movement, follow vs fade at close
    print("=" * 80)
    print("1. OPEN->CLOSE MOVEMENT (bet at close)")
    ou["mv_b"] = pd.cut(ou.mv, [-np.inf, -.15, -.07, -.02, .02, .07, .15, np.inf],
                        labels=["big down", "down", "sm down", "flat", "sm up", "up", "big up"])
    table(ou, ["mv_b", "season"], "all OU x movement bucket")
    for mkt in OU:
        table(ou[ou.market == mkt], ["mv_b", "season"], f"{mkt} x movement", 30)

    # ---------- 2. gameday-only movement (line moved on game day specifically)
    print("\n" + "=" * 80)
    print("2. GAMEDAY-ONLY MOVE (close vs final pre-gameday line)")
    gd = ou[ou.pregame_line.notna()].copy()
    gd["gmv"] = (gd.close_line - gd.pregame_line) / gd.pregame_line.clip(lower=0.5)
    gd["gmv_b"] = pd.cut(gd.gmv, [-np.inf, -.07, -.02, .02, .07, np.inf],
                         labels=["gd down big", "gd down", "flat", "gd up", "gd up big"])
    table(gd, ["gmv_b", "season"], "all OU x gameday move")
    table(gd[gd.market == "player_rush_yds"], ["gmv_b", "season"], "rush_yds x gameday move", 25)
    table(gd[gd.market == "player_receptions"], ["gmv_b", "season"], "receptions x gameday move", 25)
    table(gd[gd.market == "player_reception_yds"], ["gmv_b", "season"], "reception_yds x gameday move", 25)

    # ---------- 3. juice movement with flat line (steam without repricing line)
    print("\n" + "=" * 80)
    print("3. JUICE STEAM, LINE FLAT (over prob rose >=3pts open->close, line unchanged)")
    j = ou[ou.close_line.eq(ou.open_line)].copy()
    j["dp"] = pd.Series(np.where(j.close_over.notna() & j.open_over.notna(),
                                 np.array(payout(j.open_over)) * 0, np.nan), index=j.index)
    p_open = 1 / (1 + payout(j.open_over))
    p_close = 1 / (1 + payout(j.close_over))
    j["jmv"] = p_close - p_open
    j["jmv_b"] = pd.cut(j.jmv, [-1, -.03, -.01, .01, .03, 1],
                        labels=["over cheapened big", "over cheapened", "flat", "over juiced", "over juiced big"])
    table(j, ["jmv_b", "season"], "line-flat juice moves (over implied prob delta)")

    # ---------- 4. ATD yes-prob movement
    print("\n" + "=" * 80)
    print("4. ANYTIME TD: yes-price steam open->close")
    atd = f[(f.market == "player_anytime_td") & f.played
            & f.open_yes_prob.notna() & f.close_yes_prob.notna() & (f.n_snaps >= 4)].copy()
    atd["dmv"] = atd.close_yes_prob - atd.open_yes_prob
    atd["b"] = pd.cut(atd.dmv, [-1, -.05, -.02, .02, .05, 1],
                      labels=["steamed down big", "steamed down", "flat", "steamed up", "steamed up big"])
    rows = []
    for (b, s), g in atd.groupby(["b", "season"], observed=True):
        if len(g) < 100:
            continue
        pnl = np.where(g.result_close.eq("yes"), payout(g.close_over), -1.0)
        rows.append((b, s, len(g), f"{g.close_yes_prob.mean():.3f}",
                     f"{g.result_close.eq('yes').mean():.3f}", f"{pnl.mean()*100:+.1f}%"))
    print(pd.DataFrame(rows, columns=["move", "season", "n", "implied_close", "actual", "ROI_yes_at_close"]).to_string(index=False))

    # ---------- 5. outlier-high variant: bet under at CONSENSUS books (normal juice)
    print("\n" + "=" * 80)
    print("5. RECEPTIONS: one book >=0.5 above other 3 -> UNDER at a median-line book")
    rec = f[(f.market == "player_receptions") & f.played & f.close_line.notna()]
    idx = ["event_id", "season", "week", "player_id", "actual"]
    w = rec.pivot_table(index=idx, columns="bookmaker",
                        values=["close_line", "close_under"], aggfunc="first")
    w.columns = [f"{a}_{b}" for a, b in w.columns]
    w = w.reset_index()
    w = w[w[[f"close_line_{b}" for b in BOOKS]].notna().sum(axis=1) == 4]
    for season in (2024, 2025):
        s = w[w.season == season]
        pnl_all, win_all, odds_all = [], [], []
        for b in BOOKS:
            others = [x for x in BOOKS if x != b]
            med = s[[f"close_line_{x}" for x in others]].median(axis=1)
            d = s[s[f"close_line_{b}"] - med >= 0.5].copy()
            dmed = med[s[f"close_line_{b}"] - med >= 0.5]
            # bet under at the first OTHER book whose line equals the median
            line = np.full(len(d), np.nan)
            odds = np.full(len(d), np.nan)
            for ob in others:
                hit = (d[f"close_line_{ob}"] == dmed) & np.isnan(odds)
                line = np.where(hit, d[f"close_line_{ob}"], line)
                odds = np.where(hit, d[f"close_under_{ob}"], odds)
            win = d.actual < line
            push = d.actual == line
            pnl = np.where(push, 0, np.where(win, payout(pd.Series(odds)), -1.0))
            ok = ~pd.isna(odds)
            pnl_all.extend(pnl[ok]); win_all.extend(win[ok & ~push]); odds_all.extend(odds[ok])
        pnl_all = np.array(pnl_all)
        print(f"{season}: n={len(pnl_all)} win%={np.mean(win_all):.1%} "
              f"ROI={pnl_all.mean()*100:+.1f}% avg_odds={np.nanmean(odds_all):.0f}")


if __name__ == "__main__":
    main()
