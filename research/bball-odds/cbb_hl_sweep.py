#!/usr/bin/env python3
"""Recency half-life sweep for both CBB team-points models, graded on every market.

WHY THIS RUNS BEFORE ANYTHING ELSE IS BELIEVED. `model-regime-drift-law`: seasons are not one
league, and on the NBA pooled training was the WORST available setting in every market tested.
College has never had a half-life swept at all -- `NCAAB_MODEL_BRIEF2.md` tried a single 40-day
Torvik window once, found "no help", and the question was dropped. `cbb_panel.py` currently runs on
240 days, which is a placeholder, not a measurement. This file is what replaces it.

TWO THINGS COLLEGE DOES THAT THE NBA DOES NOT, and both argue the answer will differ:

  * THE SEASON IS SHORT AND THE OFFSEASON IS LONG. November to March is about 140 days, so a
    240-day half-life still puts ~2/3 weight on games from the PREVIOUS season -- played by a
    roster that has largely graduated or transferred. In the NBA, continuity across a summer is
    high and a long half-life is cheap; in college it is not obviously cheap at all.
  * THE FIELD IS 360-ODD TEAMS, not 30. Each team plays ~31 games a season, so shortening the
    window costs a lot more per-team information here than it does in the NBA.

Those pull in opposite directions, which is exactly why it has to be measured rather than argued.

GRADED AT FIXED SELECTIVITY, never at a fixed points cut (rule 1-bis). A shorter half-life makes
predictions more volatile, so a fixed "≥4 points" rung would select several times more bets at 45
days than at pooled and manufacture a spike out of nothing but bet count. Every setting below bets
the same top-N% of disagreements, so only the ORDERING of games can move.

READ THE SHAPE, NOT THE ARGMAX. A real effect is a broad hill whose neighbours score alike. A lone
spike with dead neighbours is a fluke wearing a parameter's clothes, and picking it is a selection
the z never pays for.

The sweep is diagonal -- both horizons are refitted at the same half-life on each pass -- but that
is not a constraint on the answer. The full-game markets read only the full-game model and the
first-half markets read only the first-half model, so one pass measures the two independently.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "CBB_HL_SWEEP.md")
HLS = (45, 60, 90, 120, 180, 240, 365, 545, None)      # None = pooled, equal weight on all history
QS = (0.20, 0.10, 0.05)                                # top-N% of |model - market|
FG = ("tt", "fg_total", "fg_spread", "fg_ml")
H1 = ("h1_total", "h1_spread", "h1_ml")


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


cp = _mod("cp", "cbb_panel.py")
pa = cp.pa


def sel(S, q):
    """Grade the top-q share of disagreements. Bet count held constant across settings."""
    ok = S["d"].notna() & S["yb"].notna() & S["po"].notna() & S["pu"].notna()
    k = S["d"][ok].abs().quantile(1 - q)
    return cp.grade(S["d"], S["yb"], S["po"], S["pu"], k)


def main():
    P, G, fcols, _ = cp.load()
    X = P[fcols].astype(float)
    keys = [m["key"] for m in cp.META]
    res = {k: [] for k in keys}

    for hl in HLS:
        lab = "pooled" if hl is None else str(hl)
        pr = {t: pa.ridge_multi(X, P["date"], [P[y]], min_train=cp.MIN_TRAIN,
                                refit_days=cp.REFIT_DAYS, half_life=hl)[0]
              for t, y in (("fg", "_yfg"), ("h1", "_yh1"))}
        mk = cp.markets(P, G, pr["fg"], pr["h1"])
        if hl == HLS[0]:
            cp.oracle_check(mk)                 # sign guard once; the rule does not vary with hl
        cfg = pr["fg"].corr(P["_yfg"])
        ch1 = pr["h1"].corr(P["_yh1"])
        for k in keys:
            r = dict(hl=lab, corr=cfg if k in FG else ch1)
            for q in QS:
                g = sel(mk[k], q)
                r[f"roi{int(q*100)}"] = g["roi"]
                r[f"n{int(q*100)}"] = g["n"]
                r[f"e{int(q*100)}"] = g["win"] - g["base"]
            res[k].append(r)
        print(f"[hl {lab:>6s}] corr fg {cfg:+.4f} h1 {ch1:+.4f} | " +
              " | ".join(f"{k} {res[k][-1]['roi10']:+5.1f}%" for k in keys), flush=True)

    L = ["# CBB — recency half-life sweep", "",
         "`cbb_hl_sweep.py`. Two models (full-game points per team, first-half points per team) "
         "refitted at each half-life, then every market re-graded. **Graded at fixed selectivity**: "
         "each cell bets the same top-N% of disagreements, so the bet count is held constant and "
         "only the ordering of games can move. A fixed points cut would let a short half-life buy "
         "extra bets with its own extra volatility and print a spike that is not there.", "",
         "**Read the shape, not the argmax.** A real effect is a broad hill whose neighbours score "
         "alike; a lone spike with dead neighbours is noise wearing a parameter's clothes.", "",
         "College cuts against the NBA answer in two ways at once. The season is ~140 days long, so "
         "a 240-day half-life still puts most of its weight on a roster that has since graduated — "
         "but the field is 360-odd teams playing ~31 games each, so a short window starves every "
         "team of history. Which effect wins is the whole question.", ""]
    for m in cp.META:
        R = pd.DataFrame(res[m["key"]])
        L += [f"## {m['name']}", "",
              "| half-life (d) | model corr | " +
              " | ".join(f"ROI top {int(q*100)}% (n)" for q in QS) + " | edge top 10% |",
              "|---|---|" + "---|" * (len(QS) + 1)]
        for _, r in R.iterrows():
            L.append(f"| {r['hl']} | {r['corr']:+.4f} | " +
                     " | ".join(f"**{r[f'roi{int(q*100)}']:+.1f}** ({int(r[f'n{int(q*100)}']):,})"
                                for q in QS) + f" | {r['e10']:+.1f} |")
        L.append("")
    open(OUT, "w").write("\n".join(L) + "\n")
    print(f"wrote {os.path.basename(OUT)}", flush=True)


if __name__ == "__main__":
    main()
