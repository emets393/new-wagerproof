#!/usr/bin/env python3
"""Team-level luck regression, college edition. The MLB question, asked where it might work.

WHY RE-ASK A DEAD QUESTION. The identical study in the NBA was null across four designs
(BBALL_SIGNALS.md, "NBA TEAM-luck regression"). The stated MECHANISM for that null was that
an NBA team plays 82 games with a stable rotation, so by game ten the market knows more than
any trailing luck window can tell it. That mechanism does not transfer:

  - a college season is ~31 games, so a 5-game window is a sixth of the evidence, not a
    sixteenth
  - rosters turn over massively every year, so "the team's own baseline" is genuinely
    re-estimated in-season rather than carried in from last year
  - there are 360 teams and the market's attention is concentrated on maybe 60 of them

So this is a different prior, not a re-slice. It is also 22.7k priced games against 5.3k.

CONSTRUCTION. `ncaab_model_features` already carries, per side, season-to-date (`s2d_`) and
trailing-five (`l5_`) team efficiency. Luck = l5 MINUS s2d: recent form against the team's
OWN baseline, which is the same own-baseline discipline the NBA build used and the reason a
team that always shoots 38% is not flagged as lucky when it shoots 38%.

SIGNS, pre-registered. Getting these backwards produces plausible numbers and a silent bug,
so they are written down before anything runs:
  SIDES   own-offence luck and opponent-ALLOWED luck OPPOSE. Scoring above your own rate is
          lucky (+1); ALLOWING less than your own rate is also lucky, so `def_eff` and
          `efg_allowed` enter NEGATED.
  TOTALS  they ALIGN. Both a hot offence and a leaky defence push the total up, so every
          term enters positive, and the composite is a SUM over both teams rather than a
          home-minus-away difference.

THE PLACEBO. `three_rate` (share of attempts taken from three) and `pace` are STYLE. A team
that shoots a lot of threes just shoots a lot of threes -- it cannot regress the way a
percentage can. Carried through every table. In the NBA it scored as well as or better than
the real luck features everywhere, which is what actually killed that program. Any luck
result here that the placebo matches is not a luck result.

PRIMARY TEST IS THE GRADIENT. Regression to the mean is a SLOPE, not a threshold: decile the
signal and read the trend. One ordered test, ungameable, and it cannot be rescued by picking
a bucket.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import MARKETS, load, usable, grade

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(1123)
TOP = 0.20

# base -> (sign for SIDES, sign for TOTALS)
LUCK = {
    "off_eff":     (+1, +1),
    "efg":         (+1, +1),
    "pts":         (+1, +1),
    "def_eff":     (-1, +1),     # allowing less than own rate = lucky, but suppresses totals
    "efg_allowed": (-1, +1),
    "opp_pts":     (-1, +1),
}
RATE = {"three_rate": (+1, +1), "pace": (+1, +1)}      # style, cannot regress -- the placebo
FAMILIES = {"shooting luck": {k: v for k, v in LUCK.items() if "eff" in k or "efg" in k},
            "results luck": {k: v for k, v in LUCK.items() if "pts" in k},
            "all luck": LUCK,
            "RATE placebo": RATE}
SIDE_M = ("FG spread OPEN", "FG spread T-60", "1H spread")
TOT_M = ("FG total OPEN", "FG total T-60", "1H total")


def zs(v, seas):
    d = pd.DataFrame({"v": pd.to_numeric(v, errors="coerce"), "s": seas.astype(str)})
    g = d.groupby("s")["v"]
    return ((d["v"] - g.transform("mean")) / g.transform("std").replace(0, np.nan)).to_numpy()


def build():
    G = load()
    F = pd.read_parquet(f"{OUT}/ncaab_model_features.parquet")
    keep = ["event_id", "home_game_num", "away_game_num", "home_kp_em", "away_kp_em"]
    for side in ("home", "away"):
        for b in set(LUCK) | set(RATE):
            keep += [f"{side}_l5_{b}", f"{side}_s2d_{b}"]
    G = G.merge(F[[c for c in keep if c in F.columns]], on="event_id", how="left")

    for b in set(LUCK) | set(RATE):
        for side in ("home", "away"):
            # luck = recent form MINUS the team's own season baseline
            G[f"{side}_lk_{b}"] = (pd.to_numeric(G[f"{side}_l5_{b}"], errors="coerce")
                                   - pd.to_numeric(G[f"{side}_s2d_{b}"], errors="coerce"))
    G["gp"] = G[["home_game_num", "away_game_num"]].min(axis=1)
    return G


def compose(G, fam, kind):
    """SIDES: home-minus-away differential. TOTALS: sum over both teams -- for a total it does
    not matter WHO is running hot, only that somebody is."""
    parts = []
    for b, (ss, st) in fam.items():
        if f"home_lk_{b}" not in G.columns:
            continue
        sg = ss if kind == "side" else st
        h = sg * zs(G[f"home_lk_{b}"], G["season"])
        a = sg * zs(G[f"away_lk_{b}"], G["season"])
        parts.append(h - a if kind == "side" else h + a)
    return np.nanmean(np.vstack(parts), axis=0) if parts else None


def gradient(G, sig, mkt, L, tag):
    ok = usable(G, pd.Series(sig, index=G.index), mkt)
    if ok.sum() < 3000:
        return
    y = pd.to_numeric(G[MARKETS[mkt][0]], errors="coerce").to_numpy(float)[ok]
    s = sig[ok]
    q = pd.qcut(s, 10, labels=False, duplicates="drop")
    rates = [100 * (y[q == i] > 0).mean() for i in range(int(np.nanmax(q)) + 1)]
    r = np.corrcoef(s, (y > 0).astype(float))[0, 1]
    L.append(f"| {tag} | {mkt} | {ok.sum():,} | " + " ".join(f"{v:.0f}" for v in rates)
             + f" | {r:+.3f} |")


def bet(G, sig, mkt, L, tag, sub=None):
    S = sig if sub is None else np.where(sub, sig, np.nan)
    ok = usable(G, pd.Series(S, index=G.index), mkt)
    if ok.sum() < 1000:
        return None
    thr = np.nanquantile(np.abs(S[ok]), 1 - TOP)
    m = ok & (np.abs(np.nan_to_num(S)) >= thr)
    if m.sum() < 200:
        return None
    g = grade(G, mkt, m, -np.sign(np.nan_to_num(S)), rng=RNG)   # FADE the lucky side
    L.append(f"| {tag} | {mkt} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
             f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")
    return g


def main():
    G = build()
    sigs = {}
    for name, fam in FAMILIES.items():
        sigs[(name, "side")] = compose(G, fam, "side")
        sigs[(name, "tot")] = compose(G, fam, "tot")

    L = ["# NCAAB team luck — the MLB question in the softer basketball market", "",
         f"{len(G):,} priced games, four seasons. Luck = trailing-5 minus the team's own "
         "season-to-date. The NBA version of this was null four ways; the mechanism for that "
         "null (82 games, stable rotation) does not transfer to a 31-game season with "
         "wholesale roster turnover.", "",
         "## 1. The gradient (primary)", "",
         "Cover/over % of backing the POSITIVE side, by decile of the luck composite. "
         "Regression predicts a DOWNWARD slope: the luckier, the less it repeats. The placebo "
         "should be flat -- and if it is not flat, nothing here is about luck.", "",
         "| family | market | n | decile % backing positive (unlucky→lucky) | r |",
         "|---|---|---|---|---|"]
    for name in FAMILIES:
        for mkt in SIDE_M:
            gradient(G, sigs[(name, "side")], mkt, L, name)
        for mkt in TOT_M:
            gradient(G, sigs[(name, "tot")], mkt, L, name)
        L.append("")

    L += ["## 2. Fade the lucky side, top 20% of |composite|", "",
          "| family | market | bets | win % | base % | edge | ROI % | p | by season |",
          "|---|---|---|---|---|---|---|---|---|"]
    for name in FAMILIES:
        for mkt in SIDE_M:
            bet(G, sigs[(name, "side")], mkt, L, name)
        for mkt in TOT_M:
            bet(G, sigs[(name, "tot")], mkt, L, name)
        L.append("")

    L += ["## 3. Season phase — a 5-game window is a different object in November", "",
          "| slice | family | market | bets | win % | base % | edge | ROI % | p | by season |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    gp = G["gp"].to_numpy(float)
    for lab, sub in (("early <12gp", gp < 12), ("mid 12-21gp", (gp >= 12) & (gp < 22)),
                     ("late 22+gp", gp >= 22)):
        for name in ("all luck", "RATE placebo"):
            for mkt in ("FG spread T-60", "FG total T-60"):
                k = "side" if "spread" in mkt else "tot"
                g = bet(G, sigs[(name, k)], mkt, [], name, sub=sub)
                if g:
                    L.append(f"| {lab} | {name} | {mkt} | {g['n']:,} | {g['win']:.1f} | "
                             f"{g['base']:.1f} | **{g['edge']:+.1f}** | {g['roi']:+.1f} | "
                             f"{g['p']:.3f} | {g['per']} |")
        L.append("")

    path = os.path.join(ROOT, "NCAAB_LUCK_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
