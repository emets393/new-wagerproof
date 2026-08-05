#!/usr/bin/env python3
"""Does the pricing law hold WITHIN a market, across its own line ladder?

THE CLAIM UNDER TEST. NBA_PROPS_VERDICT.md §1 says the losing markets lose on PRICE, not on
modelling: win% is flat 57-60% everywhere and what varies is `need`, the breakeven the quoted odds
demand, which falls from 67.2% on a 0.5 blocks line to 53.6% on a 20.5 PRA line. That was measured
ACROSS markets, where it is confounded with everything else that differs between blocks and PRA.

If it is really about line scale it must also hold WITHIN one market. `player_threes` prices four
lines -- 0.5, 1.5, 2.5, 3.5 -- on the same stat, the same players, the same model. The law predicts
`need` falls monotonically along that ladder and ROI rises with it. If instead need is flat within
threes and only differs between markets, the law is wrong and the real story is that some STATS are
predictable and others aren't.

Threes is the sharpest place to ask, because it is the one losing market where the model clearly
out-forecasts the book (+0.033 MAE, t +13.73). The information is there; only the toll is in the
way. points/PRA run as a POSITIVE CONTROL -- markets already known to pay, so the ladder's shape
there tells us what a working ladder looks like.

METHOD NOTES:
  - The top-X% edge cut is taken WITHIN each line bucket. Pooled, big lines would monopolise the
    top of the edge distribution purely because a 3.5 line has more room to be wrong about than a
    0.5 one, and the ladder would measure that instead of the price.
  - Every cell prints `need` (breakeven from the price actually taken) next to `win`, because the
    entire point is the gap between them, and both blind sides on the same rows.
  - Per-season is printed for anything that looks bettable. Standing rule: never one pool.
  - One sigma is printed per cell -- buckets get small fast and 3.5 has ~2.8k rows before selection.

usage: python3 nba_props_lines.py [--markets a,b,c] [--min-n 300]
"""
import argparse
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nba_props_originator import grade
from nba_props_report import md, sigma

ROOT = os.path.dirname(os.path.abspath(__file__))
PRED = os.path.join(ROOT, "data", "parquet", "_props_preds")
DOC = os.path.join(ROOT, "NBA_PROPS_LINE_LADDER.md")

# threes/assists are the question; points/PRA are the positive control
DEFAULT = ["player_threes", "player_assists", "player_points", "player_points_rebounds_assists"]
TOPS = [100, 50, 25, 10]

# every market with enough distinct lines to fit a slope through
ALL_LADDER = ["player_threes", "player_assists", "player_rebounds", "player_rebounds_assists",
              "player_points", "player_points_rebounds", "player_points_assists",
              "player_points_rebounds_assists"]

# (market, headline cut, the sweep proving the cut is a slope and not an argmax)
HIGHLINE = [
    ("player_points", 21.5, [12.5, 14.5, 16.5, 18.5, 20.5, 21.5, 22.5, 24.5, 26.5]),
    ("player_points_rebounds_assists", 30.5, [22.5, 24.5, 26.5, 28.5, 30.5, 32.5, 34.5, 36.5]),
    ("player_rebounds", 9.5, [6.5, 7.5, 8.5, 9.5, 10.5, 11.5]),
    ("player_threes", 3.5, [1.5, 2.5, 3.5]),
]


def load(mk):
    R = pd.read_parquet(os.path.join(PRED, f"{mk}.parquet"))
    R["edge"] = (R["lgbm"] - R["cons_line"]).abs()
    R["over"] = R["lgbm"] > R["cons_line"]
    R["ok"] = R["lgbm"].notna() & R["y_cons"].notna()
    return R


def ladder(R, min_n):
    """One row per (line, selectivity). Edge quantile is taken inside the bucket."""
    rows = []
    for line, g in R[R["ok"]].groupby("cons_line"):
        if len(g) < min_n:
            continue
        for top in TOPS:
            thr = g["edge"].quantile(1 - top / 100)
            sel = pd.Series(False, index=R.index)
            sel.loc[g.index[g["edge"] >= thr]] = True
            n, win, roi, dec, need = grade(R, sel, R["over"], "best", price=True)
            if n < 100:
                continue
            _, _, oroi = grade(R, sel, pd.Series(True, index=R.index), "best")
            _, _, uroi = grade(R, sel, pd.Series(False, index=R.index), "best")
            rows.append(dict(line=line, top=f"{top}%", n=n, win=win, need=need,
                             gap=win - need, roi=roi,
                             blind_ov=oroi, blind_un=uroi,
                             vs_blind=roi - max(oroi, uroi), sigma=sigma(n)))
    return pd.DataFrame(rows)


def seasons(R, line, top):
    g = R[R["ok"] & (R["cons_line"] == line)]
    thr = g["edge"].quantile(1 - top / 100)
    rows = []
    for s, gs in g.groupby("season_x"):
        sel = pd.Series(False, index=R.index)
        sel.loc[gs.index[gs["edge"] >= thr]] = True
        n, win, roi, dec, need = grade(R, sel, R["over"], "best", price=True)
        _, _, oroi = grade(R, sel, pd.Series(True, index=R.index), "best")
        _, _, uroi = grade(R, sel, pd.Series(False, index=R.index), "best")
        rows.append(dict(season=s, n=n, win=win, need=need, roi=roi,
                         vs_blind=roi - max(oroi, uroi), sigma=sigma(n)))
    return pd.DataFrame(rows)


def sides(R, line, top):
    g = R[R["ok"] & (R["cons_line"] == line)]
    thr = g["edge"].quantile(1 - top / 100)
    sel = pd.Series(False, index=R.index)
    sel.loc[g.index[g["edge"] >= thr]] = True
    rows = []
    for name, m in (("over", sel & R["over"]), ("under", sel & ~R["over"])):
        n, win, roi, dec, need = grade(R, m, R["over"], "best", price=True)
        # that side bet blindly on EVERY row of the bucket -- the only non-degenerate baseline
        allb = pd.Series(False, index=R.index)
        allb.loc[g.index] = True
        _, _, base = grade(R, allb, pd.Series(name == "over", index=R.index), "best")
        rows.append(dict(side=name, n=n, win=win, need=need, roi=roi,
                         base_roi=base, vs_base=roi - base, sigma=sigma(n)))
    return pd.DataFrame(rows)


def slopes(R):
    """Per point of line: how fast does the TOLL fall, and how fast does the model's EDGE grow?

    Separating these is the whole point. `need` falling is a pricing story; `gap = win - need`
    rising is an accuracy story. They are not the same claim and they do not hold in the same
    markets."""
    rows = []
    for ln, g in R[R["ok"]].groupby("cons_line"):
        if len(g) < 300:
            continue
        sel = pd.Series(False, index=R.index)
        sel.loc[g.index] = True
        n, win, roi, dec, need = grade(R, sel, R["over"], "best", price=True)
        rows.append((ln, win, need, win - need))
    T = pd.DataFrame(rows, columns=["line", "win", "need", "gap"])
    if len(T) < 3:
        return None
    return dict(buckets=len(T), need_hi=T["need"].max(), need_lo=T["need"].min(),
                need_slope=np.polyfit(T["line"], T["need"], 1)[0],
                gap_slope=np.polyfit(T["line"], T["gap"], 1)[0])


def concentration(R, cut):
    """Is a high-line rule really a bet on six superstars? Units are recomputed here rather than
    read out of grade(), so they are ASSERTED against grade() first -- an under leg needs `1 - y`
    and dropping that flip silently inverts half the book (see [[grading-sign-oracle-check]])."""
    sel = R["ok"] & (R["cons_line"] >= cut) & R["y_best_over"].notna() & R["y_best_under"].notna()
    S = R[sel].copy()
    o = S["over"].to_numpy()
    y = np.where(o, S["y_best_over"], S["y_best_under"])
    win = np.where(o, y, 1 - y)
    dec = np.where(o, S["best_over_dec"], S["best_under_dec"])
    g = (~pd.isna(dec)) & (~pd.isna(win))
    S = S[g]
    S["u"] = win[g] * (dec[g] - 1) - (1 - win[g])
    ref = grade(R, sel, R["over"], "best")[2]
    assert abs(100 * S["u"].mean() - ref) < 0.02, \
        f"unit math disagrees with grade(): {100 * S['u'].mean():.2f} vs {ref:.2f}"
    per = S.groupby("pkey")["u"].agg(["count", "mean"]).sort_values("count", ascending=False)
    tot = S["u"].sum()
    drops = [(tot - per.loc[p, "count"] * per.loc[p, "mean"]) / (len(S) - per.loc[p, "count"])
             for p in per.index]
    big = per[per["count"] >= 20]
    return dict(n=len(S), roi=100 * S["u"].mean(), players=len(per),
                top10_share=100 * per.head(10)["count"].sum() / len(S),
                drop_best=100 * min(drops),
                pos_players=100 * (per["mean"] > 0).mean(),
                pos_players_20=100 * (big["mean"] > 0).mean() if len(big) else np.nan)


def robustness(R, cuts):
    """A real threshold effect is a SLOPE. If ROI only appears at one cut value it is an argmax,
    not a finding -- standing rule, read the sweep's shape."""
    rows = []
    for c in cuts:
        sel = R["ok"] & (R["cons_line"] >= c)
        n, win, roi, dec, need = grade(R, sel, R["over"], "best", price=True)
        if n < 300:
            continue
        ss = {s: grade(R, sel & (R["season_x"] == s), R["over"], "best")[2]
              for s in sorted(R["season_x"].dropna().unique())}
        rows.append(dict(cut=c, n=n, win=win, need=need, roi=roi, sigma=sigma(n), **ss))
    return pd.DataFrame(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--markets", default=",".join(DEFAULT))
    ap.add_argument("--min-n", type=int, default=300)
    a = ap.parse_args()

    parts = ["# NBA props — is the toll a function of the LINE, or of the STAT?",
             "",
             "`nba_props_lines.py`. **Regenerated wholesale; do not edit.**",
             "",
             "`NBA_PROPS_VERDICT.md` §1 claims the four losing markets lose on price rather than on "
             "modelling, because a half-point line is quoted at odds demanding ~67% while a 20.5 "
             "line demands ~53%. Measured across markets that is confounded with everything else "
             "that differs between blocks and PRA. This re-asks it **inside a single market**, "
             "where the stat, the players and the model are held fixed and only the line moves.",
             "",
             "`need` is the breakeven win rate the taken price demands; `gap` is `win − need` and is "
             "the thing that decides profit. The edge cut is taken WITHIN each line bucket.",
             ""]

    for mk in a.markets.split(","):
        f = os.path.join(PRED, f"{mk}.parquet")
        if not os.path.exists(f):
            continue
        R = load(f and mk)
        L = ladder(R, a.min_n)
        if L.empty:
            continue
        parts += [f"## {mk}", "", md(L), ""]
        print(f"\n=== {mk} ===", flush=True)
        print(L.to_string(index=False, float_format="%.2f"), flush=True)

        # anything clearing a sigma at top25 gets the per-season and per-side treatment
        cand = L[(L["top"] == "25%") & (L["roi"] > L["sigma"])]
        for line in cand["line"]:
            S, D = seasons(R, line, 25), sides(R, line, 25)
            parts += [f"**line {line}, top 25% — per season**", "", md(S), "",
                      f"**line {line}, top 25% — by side** (`base_roi` = that side bet blindly on "
                      "every row of this bucket)", "", md(D), ""]
            print(f"-- line {line} per season --", flush=True)
            print(S.to_string(index=False, float_format="%.2f"), flush=True)
            print(D.to_string(index=False, float_format="%.2f"), flush=True)

    # ---- the two mechanisms, separated, across every market with a ladder ----
    SL = []
    for mk in ALL_LADDER:
        f = os.path.join(PRED, f"{mk}.parquet")
        if not os.path.exists(f):
            continue
        s = slopes(load(mk))
        if s:
            SL.append(dict(market=mk.replace("player_", ""), **s))
    if SL:
        parts += ["## The two mechanisms are not the same claim", "",
                  "`need_slope` is how much the breakeven falls per point of line (a PRICING "
                  "effect). `gap_slope` is how much `win − need` rises per point of line (an "
                  "ACCURACY effect). They come apart:", "", md(pd.DataFrame(SL)), "",
                  "**The pricing effect is real but local.** `need` falls steeply inside threes "
                  "and assists, mildly inside rebounds, and is FLAT inside points and PRA — those "
                  "are quoted at ~53.2 whether the line is 3.5 or 28.5. The toll bottoms out "
                  "around a line of 4–5 and after that stops being the story.",
                  "",
                  "**The accuracy effect is universal.** `gap_slope` is positive in every market "
                  "listed, including the two where the price never moves. So the general law is "
                  "not \"big lines are cheaper\" — on points they are not. It is **the model's "
                  "edge over the book grows with the size of the line.** That is a broader claim "
                  "than §1 of the verdict made, and it is the one that survives its own test.", ""]

    # ---- the resulting rule, its robustness, and whether six stars are carrying it ----
    for mk, cut, sweep in HIGHLINE:
        f = os.path.join(PRED, f"{mk}.parquet")
        if not os.path.exists(f):
            continue
        R = load(mk)
        RB, CN = robustness(R, sweep), concentration(R, cut)
        parts += [f"### {mk} — high-line cut", "",
                  "Every row of the bucket bet on the model's side, **no edge filter at all**. "
                  "Season columns are ROI.", "", md(RB), "",
                  f"Concentration at `line ≥ {cut}`: **{CN['n']:,} bets across "
                  f"{CN['players']} distinct players**, top-10 players are "
                  f"{CN['top10_share']:.1f}% of them, dropping the single best player takes ROI "
                  f"from {CN['roi']:+.2f} to {CN['drop_best']:+.2f}, and "
                  f"{CN['pos_players_20']:.0f}% of players with 20+ bets are individually "
                  f"profitable.", ""]
        print(f"\n=== {mk} high-line ===", flush=True)
        print(RB.to_string(index=False, float_format="%.2f"), flush=True)
        print(CN, flush=True)

    open(DOC, "w").write("\n".join(parts) + "\n")
    print(f"\nwrote {DOC}", flush=True)


if __name__ == "__main__":
    main()
