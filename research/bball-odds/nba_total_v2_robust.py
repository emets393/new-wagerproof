#!/usr/bin/env python3
"""Round 2 said the ridge has an edge. This tries to break it.

WHY THIS FILE EXISTS. Round 1 produced a phase cell that swung 13.6 points of win rate when I
deleted 2% of the inputs, and I had already written a mechanistic story about it before the
second run contradicted itself. The rule that came out of that: NEVER narrate a result until
the feature set has been perturbed and the result has survived. Round 2's headline —
out-of-sample corr +0.067 against a shuffled null of -0.006 ± 0.017, z = +4.39, and positive
ROI at all six bet thresholds — is exactly the kind of number that deserves the same treatment
before anyone bets a dollar on it.

FOUR WAYS TO BREAK IT, in descending order of how much I expect them to hurt:

  1. RANDOM FEATURE DROPS. Refit on a random 70% of the columns, eight times. If the edge is
     carried by a handful of lucky columns this collapses; if it is genuinely diffuse across
     ~30 weak signals, dropping a third of them barely moves it. This is the single most
     direct test of the round-2 thesis, because the thesis IS "the signal is diffuse".
  2. THEME ABLATION. Drop each theme block whole. Tells us what is actually paying.
  3. HYPERPARAMETERS. Ridge alpha and the training-window size were both chosen by me with no
     search. If the result only exists at alpha=300 and MIN_TRAIN=1500 it is a coincidence I
     stumbled into.
  4. BURN-IN. Round 2 graded 3,515 of 5,271 games because MIN_TRAIN=1500 eats the first season
     and a half, which is also why 2022 is missing from its season table. Refitting at 800
     grades 2022 too, and 2022 is a season the model has never been scored on.

Every win rate is quoted next to the best blind side inside its own rows. Breakeven is 52.4%.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("v2", os.path.join(ROOT, "nba_total_v2.py"))
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)

K = 2.0     # the headline bet threshold: model disagrees with the line by >= 2 points


def theme_of(c):
    """Which block a column belongs to, for the ablation."""
    if any(k in c for k in ("usg", "usage", "hhi", "top_min_share", "rot_n")):
        return "usage"
    if "_abs_" in c:
        return "absence"
    if "_sched" in c:
        return "schedule"
    if "_form" in c:
        return "form_delta"
    if c.startswith("st_"):
        return "structural"
    if c == "t60_total_point":
        return "line_level"
    if any(c.startswith(f"{s}_s_") for s in ("h", "a", "sum", "d")):
        return "style"
    return "box_form"


def run(D, cols, y, yb, po, pu, alpha=None, min_train=None, kind="ridge"):
    a0, m0 = v2.ALPHAS, v2.MIN_TRAIN
    if alpha is not None:
        v2.ALPHAS = (alpha,)
    if min_train is not None:
        v2.MIN_TRAIN = min_train
    try:
        p = v2.walk(D[cols].astype(float), D["date"], y, kind=kind)
    finally:
        v2.ALPHAS, v2.MIN_TRAIN = a0, m0
    m = p.notna() & y.notna()
    g = v2.grade(p, yb, po, pu, K)
    return p, np.corrcoef(p[m], y[m])[0, 1], g


def main():
    D = v2.build()
    cols = v2.feature_cols(D)
    cols = [c for c in cols if c not in v2.leak_screen(D, cols)]
    y = D["y_fg_tot_resid"].astype(float)
    yb = pd.Series(np.where(y > 0, 1.0, np.where(y < 0, 0.0, np.nan)), index=D.index)
    po = pd.Series(v2.to_dec(D["t60_total_over_price"]), index=D.index)
    pu = pd.Series(v2.to_dec(D["t60_total_under_price"]), index=D.index)

    themes = {}
    for c in cols:
        themes.setdefault(theme_of(c), []).append(c)
    print("[themes] " + "  ".join(f"{k}={len(v)}" for k, v in sorted(themes.items())), flush=True)

    L = ["# NBA total round 2 — robustness", "",
         f"Baseline: {len(cols)} features, ridge, bets at |predicted residual| ≥ {K:.0f} points. "
         f"`edge` is win% minus the best blind side inside the same rows. Breakeven −110 = 52.4%.",
         ""]

    _, r0, g0 = run(D, cols, y, yb, po, pu)
    base_line = (f"| **baseline** | {len(cols)} | {r0:+.4f} | {g0['n']} | {g0['win']:.1f} | "
                 f"{g0['base']:.1f} | **{g0['win']-g0['base']:+.1f}** | {g0['roi']:+.1f} |")

    # ---- 1. random 70% feature drops ------------------------------------------------------
    L += ["## 1. Random 70% feature subsets", "",
          "The thesis is that the signal is spread across ~30 weak columns. If so, throwing "
          "away a random third of them should barely register. If one lucky column is carrying "
          "everything, these collapse.", "",
          "| run | cols | oos corr | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|", base_line]
    print(base_line, flush=True)
    rng = np.random.default_rng(7)
    edges = []
    for i in range(8):
        sub = sorted(rng.choice(cols, size=int(0.7 * len(cols)), replace=False))
        _, r, g = run(D, sub, y, yb, po, pu)
        edges.append(g["win"] - g["base"])
        L.append(f"| drop-{i+1} | {len(sub)} | {r:+.4f} | {g['n']} | {g['win']:.1f} | "
                 f"{g['base']:.1f} | **{edges[-1]:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)
    L += ["", f"Spread across the eight subsets: **{min(edges):+.1f} to {max(edges):+.1f}** "
              f"(mean {np.mean(edges):+.1f}). Round 1's comparable swing was 13.6 points.", ""]
    print(L[-2], flush=True)

    # ---- 2. theme ablation ----------------------------------------------------------------
    L += ["## 2. Leave-one-theme-out", "",
          "| removed | cols | oos corr | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|", base_line]
    for t, tc in sorted(themes.items()):
        sub = [c for c in cols if c not in set(tc)]
        _, r, g = run(D, sub, y, yb, po, pu)
        L.append(f"| −{t} ({len(tc)}) | {len(sub)} | {r:+.4f} | {g['n']} | {g['win']:.1f} | "
                 f"{g['base']:.1f} | **{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)
    L.append("")

    # ---- 3. hyperparameters ---------------------------------------------------------------
    L += ["## 3. Hyperparameter sensitivity", "",
          "Neither alpha nor the training window was searched — both were picked by hand. A "
          "result that only exists at one setting is a setting, not a result.", "",
          "| setting | oos corr | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|---|"]
    for a in (10.0, 30.0, 100.0, 300.0, 1000.0, 3000.0):
        _, r, g = run(D, cols, y, yb, po, pu, alpha=a)
        L.append(f"| alpha={a:.0f} | {r:+.4f} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)
    for mt in (800, 1500, 2500):
        _, r, g = run(D, cols, y, yb, po, pu, min_train=mt)
        L.append(f"| min_train={mt} | {r:+.4f} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)
    L.append("")

    # ---- 4. all four seasons, short burn-in -------------------------------------------------
    # min_train=800 buys 2022 back. That season has never been graded and is the closest thing
    # to a holdout this study has.
    p8, r8, g8 = run(D, cols, y, yb, po, pu, min_train=800)
    L += ["## 4. Every season, min_train=800", "",
          f"Round 2's table skipped 2022 entirely — 1,500 training rows eats a season and a "
          f"half. At 800 it grades, and it is the one season this model has never been scored "
          f"on. Pooled here: oos corr {r8:+.4f}, edge {g8['win']-g8['base']:+.1f}, "
          f"ROI {g8['roi']:+.1f}.", "",
          "| season | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for s in sorted(D["season"].unique()):
        g = v2.grade(p8, yb, po, pu, K, mask=(D["season"] == s))
        if g["n"] == 0:
            continue
        L.append(f"| {s} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)
    L += ["", "| phase | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for ph in ("EARLY", "MID", "LATE", "POST"):
        g = v2.grade(p8, yb, po, pu, K, mask=(D["phase"] == ph))
        if g["n"] == 0:
            continue
        L.append(f"| {ph} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)
    L.append("")

    path = os.path.join(ROOT, "NBA_TOTAL_V2_ROBUST.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
