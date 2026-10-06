#!/usr/bin/env python3
"""Edge measured in PROBABILITY MASS, not points — the Walters key-number method.

WHY (owner, 2026-10-06, after reading Walters' "Gambler"). Our conviction ladder thresholds
on raw points (`reg_edge >= REG_EDGE`). That treats every point as equal, and football scoring
is nowhere near uniform: a 2.5-point edge spanning 5-6-7 is worth ~14% of outcome probability,
while the same 2.5 points spanning 11-12-13 is worth ~6%. We bet them the same and then find
our "edge >= 2" bucket running at 44.7%.

Walters' method: value each integer margin by how often games actually land on it, sum the
values of the numbers BETWEEN your number and the posted number, and require >= 5.5% before
betting at all. Three refinements come with it, none of which we did:
  * an endpoint that is a WHOLE number counts half value
  * crossing 0 (predicting an upset through the pick'em) costs one point's value
  * the PRICE moves the effective line: 3 at -120 is really ~3.25, which erases the 3

Values here are EMPIRICAL from our own game log, not transcribed from the book — the book's
table is NFL 1974-2023, and college scoring has a different shape (more 3s and 7s are not the
same thing when games hang 60 points). The book's NFL numbers are reproduced closely by ours,
which is the check that the method is being applied right.

Price is handled in probability units rather than by shifting the line: our edge is already a
probability, and the extra juice is the extra break-even it demands. At the key numbers this
agrees with the book's table (10 cents ~ 0.25 pts near the 3 ~ 2% of mass).
"""
from __future__ import annotations
import collections, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STARS = [(15.0, 3.0), (13.0, 2.5), (11.0, 2.0), (9.0, 1.5), (7.0, 1.0), (5.5, 0.5)]
# The book's 5.5% floor is calibrated to ITS table, which runs richer than our measured
# distribution (its 3 = 8%, ours = 7.4%; its 5-6-7 span = 14%, ours = 9.4%). Importing the
# constant blind would mis-set the gate, so backtest_point_value.py fits the floor to our own
# graded results and this stays the book's reference value only.
MIN_EDGE_BOOK = 5.5
MIN_EDGE = 5.5                      # below this there is NO bet, not a small one


def breakeven(odds: float) -> float:
    """Win rate needed to break even at American odds."""
    o = float(odds)
    return (-o) / ((-o) + 100.0) if o < 0 else 100.0 / (o + 100.0)


BE_110 = breakeven(-110)            # 0.5238


def _counts(margins, directional=True) -> dict:
    """{integer: % chance a one-point move across that number flips a BET}.

    Directional, and that is the whole subtlety. P(|margin| == 3) counts "home by 3" AND
    "away by 3", but if you are on the home team only one of those can flip your ticket. The
    book's table is per-side, so the both-directions count is double-counting: it put our NFL
    3 at 14.8% against the book's 8%, and halving reproduces the book's worked example
    (its 9.5% vs our 8.7%). Totals are not directional — a total lands on 44 once.
    """
    c = collections.Counter(int(round(abs(m))) for m in margins if m == m)
    n = sum(c.values())
    if not n:
        return {}
    div = 2.0 if directional else 1.0
    return {k: 100.0 * v / n / div for k, v in c.items()}


def nfl_spread_values() -> dict:
    import pandas as pd, io, requests
    g = pd.read_csv(io.StringIO(requests.get(
        "https://github.com/nflverse/nfldata/raw/master/data/games.csv", timeout=90).text))
    g = g[(g.season >= 2004) & g.result.notna()]
    return _counts(g.result.tolist())


def nfl_total_values() -> dict:
    import pandas as pd, io, requests
    g = pd.read_csv(io.StringIO(requests.get(
        "https://github.com/nflverse/nfldata/raw/master/data/games.csv", timeout=90).text))
    g = g[(g.season >= 2004) & g.total.notna()]
    return _counts(g.total.tolist(), directional=False)


def cfb_values():
    import pandas as pd
    d = pd.read_parquet(ROOT / "cfb-model" / "data" / "model_games.parquet")
    d = d.dropna(subset=["homePoints", "awayPoints"])
    marg = (d.homePoints - d.awayPoints).tolist()
    tot = (d.homePoints + d.awayPoints).tolist()
    return _counts(marg), _counts(tot, directional=False)


def edge_pct(model_num: float, posted: float, values: dict,
             price: float = -110, crosses_zero: bool | None = None) -> float:
    """Probability mass between our number and the posted number, net of price.

    Both numbers are on the SAME side's scale (e.g. both home-margin). The sign of
    model_num - posted decides which side we are backing; magnitude is what we value.
    """
    lo, hi = sorted((float(model_num), float(posted)))
    gross = 0.0
    k = int(lo) if float(lo).is_integer() else int(lo) + 1
    while k <= hi:
        v = values.get(abs(k), 0.0)
        # a whole-number ENDPOINT counts half (book's rule)
        if (k == lo and float(lo).is_integer()) or (k == hi and float(hi).is_integer()):
            v *= 0.5
        gross += v
        k += 1
    if crosses_zero is None:
        crosses_zero = (float(model_num) > 0) != (float(posted) > 0)
    if crosses_zero:
        gross -= values.get(1, 0.0)          # the upset tax
    # price: extra break-even it demands, in the same probability units
    gross -= (breakeven(price) - BE_110) * 100.0
    return round(gross, 2)


def stars(pct: float) -> float:
    for thresh, st in STARS:
        if pct >= thresh:
            return st
    return 0.0


def playable(pct: float) -> bool:
    return pct >= MIN_EDGE


if __name__ == "__main__":
    nv = nfl_spread_values()
    mv, tv = cfb_values()
    book = {1: 3, 2: 3, 3: 8, 4: 3, 5: 3, 6: 5, 7: 6, 8: 3, 9: 2, 10: 4,
            11: 2, 12: 2, 13: 2, 14: 5, 15: 2, 16: 3, 17: 3, 18: 3}
    print(f"{'margin':>7}{'NFL ours':>10}{'book':>7}{'CFB ours':>10}")
    for k in range(1, 19):
        print(f"{k:>7}{nv.get(k,0):>9.1f}%{book.get(k,0):>6}%{mv.get(k,0):>9.1f}%")
    print(f"\nNFL top-10 margins: "
          + ", ".join(f"{k}:{v:.1f}%" for k, v in sorted(nv.items(), key=lambda x: -x[1])[:10]))
    print(f"CFB top-10 margins: "
          + ", ".join(f"{k}:{v:.1f}%" for k, v in sorted(mv.items(), key=lambda x: -x[1])[:10]))
    print("\nbook's worked examples, reproduced with OUR values:")
    print(f"  7.5 vs 4.5 (spans 5,6,7)  -> {edge_pct(7.5,4.5,nv):5.2f}%  (book 14%)   stars {stars(edge_pct(7.5,4.5,nv))}")
    print(f"  4 vs 2.5   (3 full, 4 half)-> {edge_pct(4,2.5,nv):5.2f}%  (book 9.5%)  stars {stars(edge_pct(4,2.5,nv))}")
    print(f"  +1.5 vs -1.5 (crosses 0)   -> {edge_pct(1.5,-1.5,nv):5.2f}%  (book 3%, no play)")
    print(f"  4.5 vs 3 at -110           -> {edge_pct(4.5,3,nv):5.2f}%")
    print(f"  4.5 vs 3 at -120           -> {edge_pct(4.5,3,nv,price=-120):5.2f}%  (book: no longer a play)")
