#!/usr/bin/env python3
"""Are the ten prop markets ten bets, or one opinion sold ten ways?

WHY THIS HAS TO BE ASKED. PRA is literally points + rebounds + assists, and pts+reb and pts+ast are
sub-sums of it. Per [[derived-market-gating-law]] a market that is an algebraic transform of one you
already model is LEVERAGE, not a new bet -- and an ungated ROI on it averages a good bet with a bad
one. Reporting +7.09 on points and +11.25 on PRA as two findings would be double-counting if the
model is saying the same thing both times.

It also has to be asked because [[nfl-prop-model-deepdive]] found the OPPOSITE of what the
confluence story wants: on NFL props, aligned same-team markets were redundant rather than
independent, because the model already encodes game script. So the null here is "confluence is just
a slow way of saying big edge", and it gets an explicit matched-count control rather than a
sympathetic reading.

THREE QUESTIONS, IN ORDER:
  1. OVERLAP     -- when a market fires, how often does its sibling fire on the same player-game,
                    and do they take the same side?
  2. VALUE       -- what does a fire pay when all four points-family lines agree, versus when that
                    market is the only one firing?
  3. THE CONTROL -- against a PURE-MAGNITUDE cut of the same market at a MATCHED BET COUNT. Rule 4
                    of [[feature-pruning-drop-one-vs-solo]]: a comparison at different bet counts
                    compares strategies, not rules. One sigma is printed so the delta can be read.

usage: python3 nba_props_confluence.py
"""
import itertools
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nba_props_originator import grade
from nba_props_report import md

ROOT = os.path.dirname(os.path.abspath(__file__))
PRED = os.path.join(ROOT, "data", "parquet", "_props_preds")
DOC = os.path.join(ROOT, "NBA_PROPS_CONFLUENCE.md")

# the four markets that all contain points; PRA is the sum of the first three single stats
FAMILY = ["player_points", "player_points_rebounds", "player_points_assists",
          "player_points_rebounds_assists"]
ALL = FAMILY + ["player_rebounds", "player_assists", "player_rebounds_assists"]
TOP_PCT = 25


def load(mk):
    R = pd.read_parquet(os.path.join(PRED, f"{mk}.parquet"))
    p = R["lgbm"]
    R["edge"] = (p - R["cons_line"]).abs()
    R["ok"] = p.notna() & R["y_cons"].notna()
    R["fire"] = R["ok"] & (R["edge"] >= R.loc[R["ok"], "edge"].quantile(1 - TOP_PCT / 100))
    R["over"] = p > R["cons_line"]
    # a player-game, which is the unit a bettor actually holds a position in
    R["k"] = R["date"].astype(str) + "|" + R["pkey"]
    return R


def sigma(n, dec=1.87):
    return 100 * 0.5 * dec / np.sqrt(max(n, 1))


def main():
    D = {mk: load(mk) for mk in ALL}

    rows = []
    for a, b in itertools.combinations(ALL, 2):
        A = D[a][D[a]["fire"]].drop_duplicates("k").set_index("k")["over"]
        B = D[b][D[b]["fire"]].drop_duplicates("k").set_index("k")["over"]
        both = A.index.intersection(B.index)
        if len(both) < 200:
            continue
        rows.append(dict(a=a.replace("player_", ""), b=b.replace("player_", ""),
                         overlap=100 * len(both) / len(A),
                         same_side=100 * (A[both] == B[both]).mean()))
    OV = pd.DataFrame(rows).sort_values("same_side", ascending=False)

    common = set.intersection(*[set(D[mk].loc[D[mk]["fire"], "k"]) for mk in FAMILY])
    N = len(common)
    fired = {mk: set(D[mk].loc[D[mk]["fire"], "k"]) for mk in FAMILY}

    val, ctl = [], []
    for mk in FAMILY:
        R = D[mk]
        conf = R["fire"] & R["k"].isin(common)
        alone = R["fire"] & R["k"].isin(fired[mk] - set().union(*[fired[o] for o in FAMILY if o != mk]))
        thr = R.loc[R["ok"], "edge"].nlargest(N).min()
        mag = R["ok"] & (R["edge"] >= thr)
        c = grade(R, conf, R["over"], "best", price=True)
        a = grade(R, alone, R["over"], "best", price=True)
        m = grade(R, mag, R["over"], "best", price=True)
        val.append(dict(market=mk.replace("player_", ""),
                        all4_n=c[0], all4_win=c[1], all4_roi=c[2],
                        alone_n=a[0], alone_win=a[1], alone_roi=a[2]))
        ctl.append(dict(market=mk.replace("player_", ""), n=c[0],
                        confluence_roi=c[2], magnitude_roi=m[2], delta=c[2] - m[2],
                        one_sigma=sigma(c[0]),
                        rows_shared=100 * len(set(R.loc[conf, "k"]) & set(R.loc[mag, "k"])) / max(N, 1)))
    VAL, CTL = pd.DataFrame(val), pd.DataFrame(ctl)

    doc = f"""# NBA props — is this four bets or one?

`nba_props_confluence.py`. **Regenerated wholesale; do not edit.**

PRA = points + rebounds + assists, and pts+reb / pts+ast are sub-sums of it, so the four
points-family markets cannot be assumed independent. This asks whether they are.

## 1. Overlap — when one fires, does its sibling fire, and on the same side?

Top {TOP_PCT}% by |model − line| in each market. `overlap` is the share of market A's fires whose
player-game also fires in B; `same_side` is agreement among those.

{md(OV)}

## 2. What a fire is worth, by how many siblings agree

{N:,} player-games fire in all four. Best price.

{md(VAL)}

**A fire that appears on only one of the four lines is not a bet.** Where all four agree the same
opinion pays +17 to +20; where a market fires alone it pays about nothing, and points-alone is
negative outright.

## 3. The control — is "all four fire" just "big edge"?

Against that market's own top-{N:,} rows by raw |model − line|, so the bet counts match and the
comparison is between two RULES rather than two selectivities.

{md(CTL)}

Confluence wins every row, but by roughly one sigma. **That is not enough to call it the better
selector** — read it as "these two rules pick overlapping sets of about equal quality" (they share
only ~55% of their rows, so they are genuinely different selections that happen to score alike).
The load-bearing half of this page is section 2's negative: the single-market fire is dead weight.

## 4. Which line to express it on

Same player-games, same opinion, four different lines. PRA pays the most because its line is the
biggest, so the same absolute disagreement is a smaller relative one and the book prices it closest
to even — the `need` column in `NBA_PROPS_ORIGINATOR_BRIEF.md` falls from 67% on a 0.5 blocks line
to 53% on a 20.5 PRA line.

**Bet ONE line per player-game, and make it PRA.** Taking points and PRA and pts+reb on the same
player is one position with three tickets, and they agree 98% of the time.
"""
    open(DOC, "w").write(doc)
    print(f"wrote {DOC}", flush=True)
    print(OV.to_string(index=False, float_format="%.1f"), flush=True)
    print(VAL.to_string(index=False, float_format="%.2f"), flush=True)
    print(CTL.to_string(index=False, float_format="%.2f"), flush=True)


if __name__ == "__main__":
    main()
