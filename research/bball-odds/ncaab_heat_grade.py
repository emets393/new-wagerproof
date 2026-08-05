#!/usr/bin/env python3
"""Grade college player heat into all eight markets. The S10 port, tested.

TWO DESIGNS, in this order, because the second one is gameable and the first is not.

1. THE GRADIENT. Regression to the mean is a SLOPE, not a threshold. If hot teams give it
   back, then the hotter the team the less it covers -- steadily, across the whole range.
   Decile the signed differential and read the cover rate. One test over ten ordered bins.
   You cannot pick a bucket out of this. It is what killed the NBA team-luck program and it
   gets to speak first here too.

2. THE BET. Fade the hotter side on the top 20% of |differential|. The fraction is fixed
   before anything is graded; tuning it against ROI is fitting the answer.

THREE CONTROLS, carried through every table:
  p_raw   recent finishing with NO own-baseline subtraction -- "he's just been scoring a
          lot". Loses 7.9% in the NBA. If it scores like the real thing here, the
          own-baseline correction is not what is doing the work.
  t_heat  the same metric computed on the team's pooled shots: what you get if you average
          the roster BEFORE measuring instead of after. This is P2's control.
  p_ownx  the rotation's career shot SELECTION. Stable trait, cannot regress. The placebo.

Every win % is printed beside the max-side baseline of ITS OWN subset. A coin flip scores
about -2 against that comparator, so read `edge` against the permutation null, never 0.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import MARKETS, load, usable, grade

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(2026)
TOP = 0.20        # fraction of the slate bet, fixed before grading
SIGS = [("player heat", "p_heat"), ("NO own-baseline (ctrl)", "p_raw"),
        ("team aggregate (ctrl)", "t_heat"), ("shot selection (placebo)", "p_ownx")]


def zseason(s, seas):
    """Standardise within season -- four seasons of college shot data are not on one scale,
    and a decile cut pooled across them would just be sorting seasons."""
    d = pd.DataFrame({"v": pd.to_numeric(s, errors="coerce"), "s": seas.astype(str)})
    g = d.groupby("s")["v"]
    return ((d["v"] - g.transform("mean")) / g.transform("std").replace(0, np.nan)).to_numpy()


def build():
    G = load()
    G = G.dropna(subset=["cbbd_id"]).copy()
    G["gameId"] = G["cbbd_id"].astype("int64")
    H = pd.read_parquet(f"{OUT}/ncaab_player_heat.parquet")
    cols = ["p_heat", "p_conc", "p_top", "p_raw", "p_ownx", "t_heat", "n_rot", "p_astdr"]
    h = H[H["is_home"]][["gameId"] + cols].add_prefix("h_").rename(columns={"h_gameId": "gameId"})
    a = H[~H["is_home"]][["gameId"] + cols].add_prefix("a_").rename(columns={"a_gameId": "gameId"})
    G = G.merge(h, on="gameId", how="left").merge(a, on="gameId", how="left")

    for _, c in SIGS:
        G[f"d_{c}"] = zseason(G[f"h_{c}"], G["season"]) - zseason(G[f"a_{c}"], G["season"])
    # Concentration of the side that is DRIVING the differential -- the hotter team is the
    # one being faded, so its HHI is the one that matters, not the cooler team's.
    hot_home = G["h_p_heat"].abs() >= G["a_p_heat"].abs()
    G["conc_drv"] = np.where(hot_home, G["h_p_conc"], G["a_p_conc"])
    return G


def gradient(G, sig, mkt, L, tag):
    """Cover rate of BACKING HOME across deciles of the signed differential. P1 says this
    slopes DOWN: the hotter home is relative to away, the less home covers."""
    ok = usable(G, pd.Series(np.where(np.isfinite(sig), sig, np.nan), index=G.index), mkt)
    if ok.sum() < 2000:
        return
    ycol = MARKETS[mkt][0]
    y = pd.to_numeric(G[ycol], errors="coerce").to_numpy(float)[ok]
    s = sig[ok]
    q = pd.qcut(s, 10, labels=False, duplicates="drop")
    rates = [100 * (y[q == i] > 0).mean() for i in range(int(np.nanmax(q)) + 1)]
    r = np.corrcoef(s, (y > 0).astype(float))[0, 1]
    L.append(f"| {tag} | {mkt} | {ok.sum():,} | " + " ".join(f"{v:.0f}" for v in rates)
             + f" | {r:+.3f} |")


def bet(G, sig, mkt, L, tag, sub=None):
    """Fade the hotter side on the top TOP fraction of |differential|."""
    S = sig if sub is None else np.where(sub, sig, np.nan)
    ok = usable(G, pd.Series(S, index=G.index), mkt)
    if ok.sum() < 400:
        return
    thr = np.nanquantile(np.abs(S[ok]), 1.0 - TOP)
    m = ok & (np.abs(np.nan_to_num(S)) >= thr)
    if m.sum() < 200:
        return
    side = -np.sign(np.nan_to_num(S))          # P1: fade the hotter team
    g = grade(G, mkt, m, side, rng=RNG)
    L.append(f"| {tag} | {mkt} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
             f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")
    return g


def main():
    G = build()
    cov = G["d_p_heat"].notna().mean()
    L = ["# NCAAB player heat — the S10 port", "",
         f"{len(G):,} priced games, {100*cov:.1f}% with heat on both sides "
         f"({int(G['d_p_heat'].notna().sum()):,} usable). The NBA version had 5,278 games "
         "total and bet 446 of them.", "",
         "## 1. The gradient (primary — one test, cannot be gamed)", "",
         "Cover rate of BACKING HOME, by decile of the home-minus-away differential, coldest "
         "home on the left. P1 predicts a DOWNWARD slope for real heat and a flat line for "
         "the placebo.", "",
         "| signal | market | n | decile cover % of backing home (cold→hot home) | r |",
         "|---|---|---|---|---|"]
    for tag, c in SIGS:
        s = G[f"d_{c}"].to_numpy(float)
        for mkt in MARKETS:
            gradient(G, s, mkt, L, tag)
        L.append("")

    L += ["## 2. The bet — fade the hotter side, top 20% of |differential|", "",
          "`base` is the max-side rate INSIDE the selection, never 50%. Breakeven at -110 is "
          "52.4%.", "",
          "| signal | market | bets | win % | base % | edge | ROI % | p | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    best = {}
    for tag, c in SIGS:
        s = G[f"d_{c}"].to_numpy(float)
        for mkt in MARKETS:
            g = bet(G, s, mkt, L, tag)
            if g and c == "p_heat":
                best[mkt] = g["edge"]
        L.append("")

    # P2: does concentration buy anything over the plain differential?
    q = pd.Series(G["conc_drv"]).quantile([1 / 3, 2 / 3]).to_numpy()
    L += ["## 3. P2 — concentrated heat vs diffuse heat", "",
          "Same rule, split by how much of the hot side's heat sits in one player (HHI of the "
          "driving team). If the concentrated third does not beat the diffuse third, going to "
          "player level bought nothing over the team aggregate.", "",
          "| signal | market | bets | win % | base % | edge | ROI % | p | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    s = G["d_p_heat"].to_numpy(float)
    for lab, sub in (("heat, CONCENTRATED third", G["conc_drv"] > q[1]),
                     ("heat, DIFFUSE third", G["conc_drv"] <= q[0])):
        for mkt in MARKETS:
            bet(G, s, mkt, L, lab, sub=sub.to_numpy())
        L.append("")

    # Family-wise: 4 signals x 8 markets = 32 cells were looked at. The honest headline is
    # the best-cell-anywhere null, not the best cell.
    L += ["## 4. Multiplicity", "",
          f"32 cells were tested in section 2 ({len(SIGS)} signals x {len(MARKETS)} markets). "
          f"Best real-heat edge: **{max(best.values()):+.2f}** "
          f"({max(best, key=best.get)}). Read every p above against that, not against .05.", ""]

    path = os.path.join(ROOT, "NCAAB_HEAT_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
