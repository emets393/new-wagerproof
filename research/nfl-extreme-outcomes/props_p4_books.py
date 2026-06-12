"""Cross-book analysis: outlier lines, line shopping, book sharpness.

Signals computed at CLOSE and graded vs the line of the book actually bet.
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


def roi_rows(df, side_col, line_col, over_col, under_col, actual_col="actual"):
    side = df[side_col]
    line = df[line_col]
    act = df[actual_col]
    odds = np.where(side == "over", df[over_col], df[under_col])
    win = np.where(side == "over", act > line, act < line)
    push = act == line
    pnl = np.where(push, 0.0, np.where(win, payout(pd.Series(odds)), -1.0))
    ok = ~np.isnan(pnl) & ~pd.isna(odds)
    return pnl[ok].mean() * 100, ok.sum(), (win[ok] & ~push[ok]).mean()


def main():
    f = pd.read_parquet(ROOT / "data" / "props_frame.parquet")
    ou = f[f.market.isin(OU) & f.played & f.close_line.notna()].copy()

    # wide: one row per (event, player, market) with each book's close line/odds
    idx = ["event_id", "season", "week", "player_id", "player_name", "market", "actual"]
    w = ou.pivot_table(index=idx, columns="bookmaker",
                       values=["close_line", "close_over", "close_under"], aggfunc="first")
    w.columns = [f"{a}_{b}" for a, b in w.columns]
    w = w.reset_index()
    lines = w[[f"close_line_{b}" for b in BOOKS]]
    w["n_books"] = lines.notna().sum(axis=1)
    w = w[w.n_books >= 3].copy()
    w["med_line"] = lines.median(axis=1)
    w["hi_line"] = lines.max(axis=1)
    w["lo_line"] = lines.min(axis=1)
    w["spread"] = w.hi_line - w.lo_line
    print(f"matchable props (>=3 books at close): {len(w):,}")
    print("\nline spread across books by market:")
    print(w.groupby(w.market).spread.describe().round(2).to_string())

    # ---------- 1. pure line shopping: bet UNDER at highest book / OVER at lowest
    print("\n" + "=" * 80)
    print("1. LINE SHOPPING when books disagree (spread >= thresh)")
    thr = {"player_pass_yds": 4, "player_reception_yds": 3, "player_rush_yds": 3,
           "player_receptions": 0.5, "player_pass_tds": 0.5}
    for mkt, t in thr.items():
        d = w[(w.market == mkt) & (w.spread >= t)].copy()
        if len(d) < 50:
            continue
        for season in (2024, 2025):
            s = d[d.season == season].copy()
            if len(s) < 30:
                continue
            res = []
            for side, pick_line in (("under", "hi_line"), ("over", "lo_line")):
                tgt = s[pick_line]
                # find which book offers that line; take its odds
                odds = np.full(len(s), np.nan)
                for b in BOOKS:
                    hit = (s[f"close_line_{b}"] == tgt) & np.isnan(odds)
                    col = f"close_{'under' if side=='under' else 'over'}_{b}"
                    odds = np.where(hit, s[col], odds)
                win = np.where(side == "under", s.actual < tgt, s.actual > tgt)
                push = s.actual == tgt
                pnl = np.where(push, 0.0, np.where(win, payout(pd.Series(odds)), -1.0))
                ok = ~pd.isna(odds)
                res.append(f"{side}@best: {win[ok & ~push].mean():.1%} ROI {pnl[ok].mean()*100:+.1f}% (n={ok.sum()})")
            print(f"{mkt:24s} {season} spread>={t}: " + " | ".join(res))

    # ---------- 2. single-book outlier: one book away from the other three
    print("\n" + "=" * 80)
    print("2. ONE-BOOK OUTLIER (book minus median of other 3, all 4 books present)")
    w4 = w[w.n_books == 4].copy()
    rows = []
    for b in BOOKS:
        others = [x for x in BOOKS if x != b]
        med_o = w4[[f"close_line_{x}" for x in others]].median(axis=1)
        diff = w4[f"close_line_{b}"] - med_o
        for mkt in OU:
            m = w4.market == mkt
            t = thr[mkt]
            for direction, mask in (("book HIGH", diff >= t), ("book LOW", diff <= -t)):
                d = w4[m & mask]
                if len(d) < 40:
                    continue
                # fade the outlier book at its own line (under if high, over if low)
                side = "under" if direction == "book HIGH" else "over"
                line = d[f"close_line_{b}"]
                odds = d[f"close_{side}_{b}"]
                win = np.where(side == "under", d.actual < line, d.actual > line)
                push = d.actual == line
                pnl = np.where(push, 0, np.where(win, payout(odds), -1.0))
                ok = ~pd.isna(odds)
                rows.append((b, mkt, direction, len(d), f"{win[ok & ~push].mean():.1%}",
                             f"{pnl[ok].mean()*100:+.1f}%"))
    print(pd.DataFrame(rows, columns=["book", "market", "outlier_dir", "n", "fade_win%", "fade_ROI"]).to_string(index=False))

    # ---------- 3. book sharpness: |close - actual| percentile within prop
    print("\n" + "=" * 80)
    print("3. BOOK SHARPNESS (avg |close_line - actual| z within prop, lower=sharper)")
    errs = {}
    for b in BOOKS:
        errs[b] = (w[f"close_line_{b}"] - w.actual).abs()
    e = pd.DataFrame(errs)
    e_rank = e.rank(axis=1)  # 1 = closest to actual
    e_rank["season"] = w.season.values
    e_rank["market"] = w.market.values
    print("\nmean rank by season (1=sharpest of 4):")
    print(e_rank.groupby("season")[BOOKS].mean().round(3).to_string())
    print("\nmean rank by market:")
    print(e_rank.groupby("market")[BOOKS].mean().round(3).to_string())

    # ---------- 4. does the outlier book predict where consensus closes next week?
    # (proxy for "who moves first": book line vs consensus actual error)
    print("\n" + "=" * 80)
    print("4. WHEN ONE BOOK IS HIGH: was IT right (actual closer to it) or consensus?")
    rows = []
    for b in BOOKS:
        others = [x for x in BOOKS if x != b]
        med_o = w4[[f"close_line_{x}" for x in others]].median(axis=1)
        diff = w4[f"close_line_{b}"] - med_o
        sel = diff.abs() >= w4.market.map(thr)
        d = w4[sel]
        mo = med_o[sel]
        df_ = diff[sel]
        closer_book = (d[f"close_line_{b}"] - d.actual).abs() < (mo - d.actual).abs()
        rows.append((b, len(d), f"{closer_book.mean():.1%}"))
    print(pd.DataFrame(rows, columns=["outlier book", "n", "outlier closer to actual"]).to_string(index=False))


if __name__ == "__main__":
    main()
