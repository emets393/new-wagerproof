#!/usr/bin/env python3
"""Is the combo-consistency signal EXECUTABLE?

The consensus-priced test found real information: bet the residual between a combo line
and its own components, and the delta over blind same-side betting rises monotonically
from +0.70 to +4.97 across six thresholds. Model-free, both sides, all three seasons.

And it lands on breakeven, because the books price exactly that uncertainty. The average
combo prop pays 1.871 (53.4% breakeven), but in the cells where the combo line sits
furthest from its components the price drops to ~1.80 -- a 55.0-55.6% breakeven. The book
is not unaware that its own numbers disagree; it charges for it.

So the signal wins 54.95% into a 55.02% breakeven. Everything now turns on price, which
means one question: does shopping close it, and is that shopping REAL?

The last time a shopping edge appeared in this folder it was fake -- ROI at the best line
was +18.68 and at the SECOND best line -0.68, the signature of one stale book rather than
a market-wide opportunity. So the same control applies here and it is the whole point of
this file:

  CONSENSUS   the median number             -- the signal's own merit
  BEST        the most favourable number    -- signal + shopping
  2ND BEST    one rung down                 -- THE TEST

A real edge degrades gracefully to the second-best number. A stale outlier collapses.
If 2nd-best is negative, this dies exactly like the last one did, and it dies here.

Also reported restricted to books a normal US bettor can actually hold, because an edge
that only exists offshore is not an edge.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from build_nba_props import norm_name, american_to_dec, MARKET_STAT
from nba_props_combo import COMBOS, add_expected_gap, roi

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
MAINSTREAM = {"draftkings", "fanduel", "betmgm", "williamhill_us", "pointsbetus",
              "betrivers", "barstool", "wynnbet", "unibet_us", "fanatics"}


def per_book():
    """Per-book MAIN line at T-60, alt ladders collapsed to their most balanced rung."""
    frames = [pd.read_parquet(os.path.join(OUT, f)) for f in sorted(os.listdir(OUT))
              if f.startswith("props_nba_") and f.endswith(".parquet")]
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
    return p.sort_values(bk + ["_bal"]).groupby(bk, sort=False).head(1).drop(
        columns=["_bal"])


def ranked(q):
    """Best and 2nd-best number per prop, for each side, with the price that came with it."""
    k = ["event_id", "market", "pkey"]
    out = q.groupby(k).size().rename("n_books").reset_index()
    # under wants the HIGHEST line, then the best price at that line
    u = q.sort_values(["line_point", "under_dec"], ascending=[False, False])
    u["_r"] = u.groupby(k).cumcount()
    for r in (0, 1):
        s = u[u["_r"] == r].set_index(k)[["line_point", "under_dec", "book"]]
        s.columns = [f"u{r}_line", f"u{r}_dec", f"u{r}_book"]
        out = out.merge(s.reset_index(), on=k, how="left")
    # over wants the LOWEST line
    o = q.sort_values(["line_point", "over_dec"], ascending=[True, False])
    o["_r"] = o.groupby(k).cumcount()
    for r in (0, 1):
        s = o[o["_r"] == r].set_index(k)[["line_point", "over_dec", "book"]]
        s.columns = [f"o{r}_line", f"o{r}_dec", f"o{r}_book"]
        out = out.merge(s.reset_index(), on=k, how="left")
    return out


def grade(d, side_over, line_col, dec_col):
    """Grade at the given line AND the price that came with it. Pushes dropped."""
    m = d[line_col].notna() & d[dec_col].notna() & d["actual"].notna()
    d = d[m]
    d = d[d["actual"] != d[line_col]]
    if len(d) < 60:
        return 0, np.nan, np.nan
    ow = (d["actual"] > d[line_col]).to_numpy(dtype=float)
    win = ow if side_over else 1 - ow
    return len(d), 100 * win.mean(), roi(win, d[dec_col].to_numpy(dtype=float))


def both_sides(P, thr, venue, mainstream=False):
    """Pool the under cell (resid high) and the over cell (resid low) at one venue."""
    lc_u, dc_u, lc_o, dc_o = {
        "cons": ("cons_line", "cons_under_dec", "cons_line", "cons_over_dec"),
        "best": ("u0_line", "u0_dec", "o0_line", "o0_dec"),
        "second": ("u1_line", "u1_dec", "o1_line", "o1_dec"),
    }[venue]
    if mainstream:
        P = P[P["u0_book"].isin(MAINSTREAM) | P["o0_book"].isin(MAINSTREAM)]
    nu, wu, ru = grade(P[P["resid"] >= thr], False, lc_u, dc_u)
    no, wo, ro = grade(P[P["resid"] <= -thr], True, lc_o, dc_o)
    n = nu + no
    if n == 0 or (np.isnan(ru) and np.isnan(ro)):
        return 0, np.nan, np.nan
    ru = 0 if np.isnan(ru) else ru
    ro = 0 if np.isnan(ro) else ro
    wu = 0 if np.isnan(wu) else wu
    wo = 0 if np.isnan(wo) else wo
    return n, (wu * nu + wo * no) / n, (ru * nu + ro * no) / n


def main():
    print("per-book view...", flush=True)
    p = per_book()
    R = ranked(p)
    Rm = ranked(p[p["book"].isin(MAINSTREAM)])

    print("combo residuals...", flush=True)
    P = pd.read_parquet(f"{OUT}/nba_props_combo_scored.parquet")
    P = P.merge(R, on=["event_id", "market", "pkey"], how="left")
    seasons = sorted(P["season"].dropna().unique())
    print(f"  {len(P):,} combo props, {P['u0_line'].notna().mean():.1%} with a book view",
          flush=True)

    L = ["# NBA combo-consistency — executable, or another stale line?", "",
         f"{len(P):,} combo props, seasons {seasons}. Signal from consensus component "
         "lines; bet graded at the line AND price of the book it is struck at.", "",
         "**The 2nd-best column is the test.** A real shopping edge degrades gracefully "
         "one rung down; a stale outlier collapses. That control killed the last "
         "shopping finding in this folder (+18.68 at best, -0.68 at 2nd best).", ""]

    L += ["\n## Both sides pooled, by residual threshold\n",
          "| \\|resid\\| >= | n | win% | ROI @cons | ROI @best | **ROI @2nd best** |",
          "|---|---|---|---|---|---|"]
    for t in (0.5, 0.75, 1.0, 1.25, 1.5):
        n, w, rc = both_sides(P, t, "cons")
        _, wb, rb = both_sides(P, t, "best")
        _, _, r2 = both_sides(P, t, "second")
        L.append(f"| {t:.2f} | {n:,} | {w:.2f} | {rc:+.2f} | {rb:+.2f} | **{r2:+.2f}** |")

    L += ["\n## Restricted to mainstream US books\n",
          "| \\|resid\\| >= | n | ROI @best | ROI @2nd best |", "|---|---|---|---|"]
    Pm = P.drop(columns=[c for c in P.columns if c[:2] in ("u0", "u1", "o0", "o1")
                         or c == "n_books"]).merge(
        Rm, on=["event_id", "market", "pkey"], how="left")
    for t in (0.5, 0.75, 1.0, 1.25, 1.5):
        n, _, rb = both_sides(Pm, t, "best")
        _, _, r2 = both_sides(Pm, t, "second")
        L.append(f"| {t:.2f} | {n:,} | {rb:+.2f} | {r2:+.2f} |")

    L += ["\n## Per season at |resid| >= 1.0 (pooled sides)\n",
          "| season | n | ROI @cons | ROI @best | ROI @2nd best |", "|---|---|---|---|---|"]
    for s in seasons:
        Ps = P[P["season"] == s]
        n, _, rc = both_sides(Ps, 1.0, "cons")
        _, _, rb = both_sides(Ps, 1.0, "best")
        _, _, r2 = both_sides(Ps, 1.0, "second")
        L.append(f"| {s} | {n:,} | {rc:+.2f} | {rb:+.2f} | {r2:+.2f} |")

    L += ["\n## Per market at |resid| >= 1.0\n",
          "| market | n | ROI @cons | ROI @best | ROI @2nd best |", "|---|---|---|---|---|"]
    for mk in sorted(P["market"].unique()):
        Pk = P[P["market"] == mk]
        n, _, rc = both_sides(Pk, 1.0, "cons")
        _, _, rb = both_sides(Pk, 1.0, "best")
        _, _, r2 = both_sides(Pk, 1.0, "second")
        L.append(f"| {mk} | {n:,} | {rc:+.2f} | {rb:+.2f} | {r2:+.2f} |")

    path = os.path.join(ROOT, "NBA_PROPS_COMBO_EXEC_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
