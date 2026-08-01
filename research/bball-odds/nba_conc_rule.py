#!/usr/bin/env python3
"""Is the concentration effect a RULE rather than a model feature?

WHAT CAME BEFORE. `nba_conc_window.py` measured, on 10,324 team-games with no market
involved, that a team whose minutes are concentrated scores FEWER points in its next game
(corr -0.058 on `top_min_share`, t about -5.9), and that the CHANGE in concentration adds to
that beyond the level (t = -2.77 on `min_hhi`). That is a real mechanism, stated as an UNDER
story before anything was graded. But feeding the change to the ridge as continuous columns
gained correlation and LOST betting edge (+3.5 -> +3.2, against a null sd of 0.93). That is
the signature of an effect the market already prices on average.

WHY THAT IS NOT THE END OF IT. The standing division of labour in this repo is that diffuse
effects belong in the model and conditional ones belong in the rule layer, and moving either
across the line destroys it. A continuous column asks the ridge to price concentration
everywhere; a rule asks only about the tail, where both teams have just shortened up at once.
Those are different claims and the first failing says nothing about the second.

ONE HYPOTHESIS, FIXED IN ADVANCE, because blind sweeps over this data have already been shown
to transfer at exactly zero (308,860 cells, -0.017% excess ROI). The direction comes from the
mechanism, not from the grade: concentration UP in both teams -> the game goes UNDER.

THE CONTROL IS MANDATORY. Concentration LEVEL and concentration CHANGE are different claims
and the level is the naive one, so the level rule is computed IN THE SAME SUBSET and reported
alongside. A change rule that only reproduces the level rule has found nothing.

THRESHOLDS ARE LEAK-SAFE. The cut is an expanding quantile over strictly prior games, so a
2023 game is judged against the distribution as it stood in 2023, never against the full
four-season spread it is part of.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")

# The two concentration stats whose CHANGE term cleared |t| = 2 against the team's own next
# game. adv_usg_max and pts_hhi did not, so they are not in the rule.
STATS = ["top_min_share", "min_hhi"]


def z_expanding(s, dates):
    """Standardise against strictly prior games only — no future variance in a past z."""
    o = np.argsort(dates.values, kind="stable")
    x = s.values[o]
    mu = pd.Series(x).expanding(min_periods=200).mean().shift(1)
    sd = pd.Series(x).expanding(min_periods=200).std().shift(1)
    z = (x - mu) / sd.replace(0, np.nan)
    out = pd.Series(np.nan, index=s.index, dtype=float)
    out.iloc[o] = z.values
    return out


def grade(D, m, side_under, tag, bag, base):
    """Grade one cell against the LEAGUE rate for the same side.

    The comparator for a rule that always bets one side is "what if I bet that side on
    everything", not the cell's own rate for that side -- those are the same number, which is
    how the first version of this file reported an edge of exactly +0.0 in every row. Totals
    run +0.72 points over the T-60 close league-wide, so unders hit 49.4% and scoring an under
    rule against 50 would charge it half a point it never owed.
    """
    m = m & D["yb"].notna()
    if m.sum() < 40:
        return
    yb = D.loc[m, "yb"]                                   # 1 = over cashed
    win = (1 - yb) if side_under else yb
    dec = D.loc[m, "pu" if side_under else "po"]
    roi = 100 * (win * (dec - 1) - (1 - win)).mean()
    # binomial sd of the cell, so a reader can see instantly whether an edge is inside noise
    sd = 100 * np.sqrt(0.25 / m.sum())
    bag.append(f"| {tag} | {int(m.sum())} | {100*win.mean():.1f} | {base:.1f} | "
               f"**{100*win.mean()-base:+.1f}** | ±{sd:.1f} | {roi:+.1f} |")
    print(bag[-1], flush=True)


def main():
    D = v2.build()
    y = D["y_fg_tot_resid"].astype(float)
    D["yb"] = np.where(y > 0, 1.0, np.where(y < 0, 0.0, np.nan))
    D["po"] = v2.to_dec(D["t60_total_over_price"])
    D["pu"] = v2.to_dec(D["t60_total_under_price"])
    D = D.sort_values("date").reset_index(drop=True)

    # the two signals: how much has concentration MOVED, and how HIGH is it, summed over both
    # teams so the quantity describes the game rather than one side of it
    chg, lvl = [], []
    for st in STATS:
        for s in ("h", "a"):
            c3, c10 = f"{s}_l3_{st}", f"{s}_l10_{st}"
            if c3 not in D.columns or c10 not in D.columns:
                continue
            chg.append(z_expanding(D[c3] - D[c10], D["date"]))
            lvl.append(z_expanding(D[c10], D["date"]))
    D["conc_chg"] = pd.concat(chg, axis=1).mean(axis=1)
    D["conc_lvl"] = pd.concat(lvl, axis=1).mean(axis=1)
    print(f"[rule] chg cols={len(chg)} lvl cols={len(lvl)} "
          f"coverage={D['conc_chg'].notna().mean():.1%} "
          f"corr(chg,lvl)={D['conc_chg'].corr(D['conc_lvl']):+.3f}", flush=True)

    # leak-safe cut: the top-q share of everything seen BEFORE this game
    for nm in ("conc_chg", "conc_lvl"):
        for q, lab in ((0.80, "q80"), (0.90, "q90")):
            D[f"{nm}_{lab}"] = D[nm] > D[nm].expanding(min_periods=300).quantile(q).shift(1)

    BASE = 100 * (1 - D.loc[D["yb"].notna(), "yb"]).mean()   # bet under on everything
    print(f"[rule] league under rate {BASE:.2f}%", flush=True)

    L = ["# NBA usage concentration as a RULE — does the tail behave?", "",
         "Mechanism, measured with no market involved on 10,324 team-games: concentrated "
         "minutes mean fewer points next game, and a concentration RISE adds to that beyond "
         "the level. Direction was fixed from that measurement — **under** — before anything "
         "here was graded. See `NBA_CONC_WINDOW.md` §2b.", "",
         "`conc_chg` is the three-game mean minus the ten-game mean of minute/point "
         "concentration, z-scored against prior games only and averaged over both teams: "
         "*both these teams have just shortened up*. `conc_lvl` is the ten-game level, which is "
         "the naive version and is the control.", "",
         "## 1. Headline — the rule and its control", "",
         "| cell | n | under% | league% | edge | ±1sd | ROI |", "|---|---|---|---|---|---|---|"]
    grade(D, D["conc_chg_q80"], True, "concentration RISING (top 20%)", L, BASE)
    grade(D, D["conc_chg_q90"], True, "concentration RISING (top 10%)", L, BASE)
    grade(D, D["conc_lvl_q80"], True, "CONTROL: concentration HIGH (top 20%)", L, BASE)
    grade(D, D["conc_lvl_q90"], True, "CONTROL: concentration HIGH (top 10%)", L, BASE)
    grade(D, D["conc_chg_q80"] & D["conc_lvl_q80"], True, "both: rising AND already high", L, BASE)
    grade(D, D["conc_chg"].notna(), True, "every game (the league baseline)", L, BASE)

    L += ["", "## 2. Phase split — a pooled number can hide a rule that only lives in one part "
          "of the season", "",
          "| phase | n | under% | league% | edge | ±1sd | ROI |", "|---|---|---|---|---|---|---|"]
    for ph in ("EARLY", "MID", "LATE", "POST"):
        grade(D, D["conc_chg_q80"] & (D["phase"] == ph), True, ph, L, BASE)

    L += ["", "## 3. Season split — pooled results hide late-year decay", "",
          "| season | n | under% | league% | edge | ±1sd | ROI |", "|---|---|---|---|---|---|---|"]
    for s in sorted(D["season"].dropna().unique()):
        grade(D, D["conc_chg_q80"] & (D["season"] == s), True, str(s), L, BASE)

    with open(os.path.join(ROOT, "NBA_CONC_RULE.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_CONC_RULE.md", flush=True)


if __name__ == "__main__":
    main()
