#!/usr/bin/env python3
"""Pressure-test the line-shopping edge: UNDER at the best available prop number.

Baseline said blind UNDER goes from -3.71 ROI at consensus to -1.07 at the best line,
and to +4.34 where books disagree by 1.5+ (n=9,419, all three seasons positive). Before
that is worth anything it has to survive the four ways it could be fake:

  1  STALE OUTLIER. If the "best" number is one book's error that would have been taken
     down or was never really available, the edge dies at the SECOND best line. This is
     the test that matters most — a real edge should degrade gracefully, not collapse.
  2  UNREACHABLE BOOK. An edge that only exists at a low-limit offshore shop is not an
     edge. Re-run restricted to books a normal bettor actually has.
  3  MONOTONICITY. Real shopping value should scale with how far the best number sits
     above consensus. A spike in one bucket is noise.
  4  SIDE SYMMETRY. Shopping should help the OVER too (at its own best number). If only
     the under improves, that is the shade, not the shopping — worth knowing which is
     which, since they are separately exploitable.

Grading discipline: every bet is graded at the exact line AND price of the book it is
struck at. Consensus bets never borrow the best line's result, and vice versa.
"""
import os

import numpy as np
import pandas as pd

from build_nba_props import book_view, norm_name, american_to_dec, MARKET_STAT

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

# books a US bettor can realistically hold and get filled at
MAINSTREAM = {"draftkings", "fanduel", "betmgm", "williamhill_us", "pointsbetus",
              "betrivers", "barstool", "wynnbet", "unibet_us", "fanatics"}


def per_book():
    """Per-book MAIN line at T-60 (alt ladders collapsed), joined to the settled stat."""
    frames = []
    for f in sorted(os.listdir(OUT)):
        if f.startswith("props_nba_") and f.endswith(".parquet"):
            frames.append(pd.read_parquet(os.path.join(OUT, f)))
    p = pd.concat(frames, ignore_index=True)
    p["snap"] = pd.to_datetime(p["snap_ts"], utc=True)
    p["ct"] = pd.to_datetime(p["commence_time"], utc=True)
    p = p[(p["ct"] - p["snap"]).dt.total_seconds() / 60 >= 60].copy()
    p["over_dec"] = american_to_dec(p["over_price"])
    p["under_dec"] = american_to_dec(p["under_price"])
    p = p[p["over_dec"].notna() & p["under_dec"].notna() & p["line_point"].notna()]
    p["pkey"] = p["player"].map(norm_name)
    p = p[p["market"].isin(MARKET_STAT)]
    bk = ["event_id", "market", "pkey", "book"]
    p["_bal"] = (p["over_dec"] - p["under_dec"]).abs()
    p = p.sort_values(bk + ["_bal"]).groupby(bk, sort=False).head(1).drop(columns=["_bal"])

    G = pd.read_parquet(f"{OUT}/props_graded.parquet")
    G["pkey"] = G["player"].map(norm_name)
    G = G[["event_id", "market", "pkey", "actual", "season", "date_et"]].drop_duplicates(
        ["event_id", "market", "pkey"])
    p = p.merge(G, on=["event_id", "market", "pkey"], how="inner")
    return p


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def grade_under(df, line_col, dec_col):
    m = df[line_col].notna() & df[dec_col].notna() & df["actual"].notna()
    d = df[m]
    live = d["actual"] != d[line_col]                      # drop pushes
    d = d[live]
    if len(d) < 50:
        return 0, np.nan, np.nan
    win = (d["actual"] < d[line_col]).values.astype(float)
    return len(d), 100 * win.mean(), roi(win, d[dec_col].values)


def grade_over(df, line_col, dec_col):
    m = df[line_col].notna() & df[dec_col].notna() & df["actual"].notna()
    d = df[m]
    d = d[d["actual"] != d[line_col]]
    if len(d) < 50:
        return 0, np.nan, np.nan
    win = (d["actual"] > d[line_col]).values.astype(float)
    return len(d), 100 * win.mean(), roi(win, d[dec_col].values)


def ranked(p, mainstream_only=False):
    """Collapse to one row per prop carrying best / 2nd best / consensus under numbers."""
    q = p[p["book"].isin(MAINSTREAM)] if mainstream_only else p
    k = ["event_id", "market", "pkey"]
    cons = q.groupby(k).agg(cons_line=("line_point", "median"),
                            cons_under_dec=("under_dec", "median"),
                            cons_over_dec=("over_dec", "median"),
                            n_books=("book", "nunique"),
                            actual=("actual", "first"),
                            season=("season", "first")).reset_index()
    # under-friendliness: highest line first, then best price
    u = q.sort_values(["line_point", "under_dec"], ascending=[False, False])
    u["_r"] = u.groupby(k).cumcount()
    for r in (0, 1):
        s = u[u["_r"] == r].set_index(k)[["line_point", "under_dec", "book"]]
        s.columns = [f"u{r}_line", f"u{r}_dec", f"u{r}_book"]
        cons = cons.merge(s.reset_index(), on=k, how="left")
    # over-friendliness: lowest line first
    o = q.sort_values(["line_point", "over_dec"], ascending=[True, False])
    o["_r"] = o.groupby(k).cumcount()
    for r in (0, 1):
        s = o[o["_r"] == r].set_index(k)[["line_point", "over_dec", "book"]]
        s.columns = [f"o{r}_line", f"o{r}_dec", f"o{r}_book"]
        cons = cons.merge(s.reset_index(), on=k, how="left")
    cons["under_edge"] = cons["u0_line"] - cons["cons_line"]
    cons["over_edge"] = cons["cons_line"] - cons["o0_line"]
    return cons


def main():
    print("building per-book view...", flush=True)
    p = per_book()
    A = ranked(p, mainstream_only=False)
    M = ranked(p, mainstream_only=True)
    seasons = sorted(A["season"].dropna().unique())
    print(f"  {len(A):,} props", flush=True)

    L = ["# NBA props — is the line-shopping edge real?", "",
         f"{len(A):,} props, seasons {seasons}, per-book main lines at T-60. Every bet "
         "graded at the line AND price of the book it is struck at.", ""]

    # ------------------------------------------------------------------ 1 stale outlier
    L += ["## 1 — best vs SECOND best line (the stale-outlier test)\n",
          "| bet | n | win% | ROI | per-season ROI |", "|---|---|---|---|---|"]
    for nm, lc, dc in (("UNDER @ consensus", "cons_line", "cons_under_dec"),
                       ("UNDER @ 2nd best line", "u1_line", "u1_dec"),
                       ("UNDER @ best line", "u0_line", "u0_dec")):
        n, w, r = grade_under(A, lc, dc)
        per = [f"{grade_under(A[A['season'] == s], lc, dc)[2]:+.1f}" for s in seasons]
        L.append(f"| {nm} | {n:,} | {w:.2f} | {r:+.2f} | {'/'.join(per)} |")

    # ------------------------------------------------------------------ 2 reachability
    L += ["\n## 2 — restricted to mainstream US books\n",
          "| bet | n | win% | ROI | per-season ROI |", "|---|---|---|---|---|"]
    for nm, lc, dc in (("UNDER @ consensus (mainstream)", "cons_line", "cons_under_dec"),
                       ("UNDER @ 2nd best (mainstream)", "u1_line", "u1_dec"),
                       ("UNDER @ best (mainstream)", "u0_line", "u0_dec")):
        n, w, r = grade_under(M, lc, dc)
        per = [f"{grade_under(M[M['season'] == s], lc, dc)[2]:+.1f}" for s in seasons]
        L.append(f"| {nm} | {n:,} | {w:.2f} | {r:+.2f} | {'/'.join(per)} |")

    # ------------------------------------------------------------------ 3 monotonicity
    L += ["\n## 3 — does it scale with how far the best number sits above consensus?\n",
          "| under_edge (pts) | n | win% | ROI @best | ROI @2nd best | per-season ROI @best |",
          "|---|---|---|---|---|---|"]
    for lo, hi, lbl in ((-0.01, 0.01, "0.0"), (0.01, 0.6, "0.5"), (0.6, 1.1, "1.0"),
                        (1.1, 1.6, "1.5"), (1.6, 2.6, "2.0-2.5"), (2.6, 99, "3.0+")):
        s = A[(A["under_edge"] >= lo) & (A["under_edge"] < hi)]
        n, w, r = grade_under(s, "u0_line", "u0_dec")
        _, _, r2 = grade_under(s, "u1_line", "u1_dec")
        if n == 0:
            continue
        per = [f"{grade_under(s[s['season'] == ss], 'u0_line', 'u0_dec')[2]:+.1f}"
               for ss in seasons]
        L.append(f"| {lbl} | {n:,} | {w:.2f} | {r:+.2f} | {r2:+.2f} | {'/'.join(per)} |")

    # ------------------------------------------------------------------ 4 side symmetry
    L += ["\n## 4 — does shopping help the OVER too? (shade vs shopping)\n",
          "| bet | n | win% | ROI |", "|---|---|---|---|"]
    for nm, fn, lc, dc in (("OVER @ consensus", grade_over, "cons_line", "cons_over_dec"),
                           ("OVER @ best line", grade_over, "o0_line", "o0_dec"),
                           ("UNDER @ consensus", grade_under, "cons_line", "cons_under_dec"),
                           ("UNDER @ best line", grade_under, "u0_line", "u0_dec")):
        n, w, r = fn(A, lc, dc)
        L.append(f"| {nm} | {n:,} | {w:.2f} | {r:+.2f} |")

    # ------------------------------------------------- per market at the best under line
    L += ["\n## Per market — UNDER at best line, and at best line with 1.5+ disagreement\n",
          "| market | n all | ROI all | n 1.5+ | win% 1.5+ | ROI 1.5+ | per-season ROI 1.5+ |",
          "|---|---|---|---|---|---|---|"]
    for mk in sorted(A["market"].unique()):
        s = A[A["market"] == mk]
        n, _, r = grade_under(s, "u0_line", "u0_dec")
        big = s[s["under_edge"] >= 1.5]
        nb, wb, rb = grade_under(big, "u0_line", "u0_dec")
        per = [f"{grade_under(big[big['season'] == ss], 'u0_line', 'u0_dec')[2]:+.1f}"
               for ss in seasons]
        L.append(f"| {mk} | {n:,} | {r:+.2f} | {nb:,} | "
                 f"{wb:.1f} | {rb:+.2f} | {'/'.join(per)} |")

    path = os.path.join(ROOT, "NBA_PROPS_SHOPPING_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
