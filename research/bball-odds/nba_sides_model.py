#!/usr/bin/env python3
"""The NBA sides model. Walk-forward, every validated play-by-play feature, phase-aware.

This is the assembly step. The pieces were each earned separately and each has a control
behind it, so nothing here is a feature that merely looked good once:

  d_p_heat        player-level shooting above each man's OWN career finishing rate,
                  volume-weighted over the projected rotation. Survives C3 (the team
                  aggregate fails in the same cell) and C4 (the same rule WITHOUT the
                  own-baseline subtraction loses 7.9%). NBA_CONC_CONTROLS_BRIEF.md.
  conc_drv        HHI of that heat on the side carrying it. A moderator, not a signal:
                  diffuse heat does not regress (corr +1.45), concentrated heat does.
  d_xefg_net      team expected-eFG from shot coordinates. corr +4.65 vs the T-60 residual
                  where ACTUAL eFG is +0.05 -- the market prices results, not process.
  d_p_ownx        career shot-selection quality of tonight's actual rotation, corr +4.10.
  d_talent_m      minutes-weighted RAPM of the projected-available rotation.

PHASE IS A FEATURE, NOT A FILTER. Two independent tests -- xEFG (NBA_XEFG_PHASE_BRIEF.md)
and concentrated heat (C6) -- both put their strength late in the season and their weakness
mid-season. Rather than hand-pick the late cell and quote its number, `gp` goes in as a
feature so the model can learn the interaction, and a late-only fit is reported ALONGSIDE
the pooled one so the difference between "learned" and "assumed" stays visible.

R2 is measured against the market residual, so R2 > 0 means beating the posted line and
R2 < 0 means the line is better. Graded at BOTH the opener and the T-60 close. Every win
rate sits beside its own slice's hindsight max-side baseline, which a coin flip beats by
about -2, so the 2,000-permutation null mean is the comparison and not zero.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

from nba_player_model import bet, load_all
from nba_regression_model import MKT

ROOT = os.path.dirname(os.path.abspath(__file__))
MIN_TRAIN = 700
N_BLOCK = 24

BASE = ["d_p_heat", "d_p_top", "d_p_ownx", "d_xefg_net", "d_xefg", "d_xefg_a",
        "d_luck_net", "d_talent_m", "d_talent_sd", "d_results", "mkt_spread", "mkt_total"]
FULL = BASE + ["conc_drv", "heat_conc", "gp"]


def prep(d):
    # the interaction the controls earned: heat only regresses when it is concentrated,
    # so hand the model the product rather than hoping a depth-3 tree rediscovers it
    d["heat_conc"] = d["d_p_heat"] * d["conc_drv"]
    d["gm_date"] = pd.to_datetime(d["date"]) if "date" in d else pd.to_datetime(d["game.id"],
                                                                                errors="coerce")
    return d.sort_values("gm_date").reset_index(drop=True)


def walk_forward(d, feats, ycol, make):
    """Expanding-window fit in date order. Each block is predicted from its past only."""
    X = d[feats].to_numpy(dtype=float)
    y = d[ycol].to_numpy(dtype=float)
    pred = np.full(len(d), np.nan)
    seen = 0
    for b in np.array_split(np.arange(len(d)), N_BLOCK):
        if seen >= MIN_TRAIN:
            tr = np.arange(seen)
            ok = np.isfinite(y[tr]) & np.isfinite(X[tr]).all(axis=1)
            if ok.sum() >= MIN_TRAIN:
                sc = StandardScaler().fit(X[tr][ok])
                m = make()
                m.fit(sc.transform(X[tr][ok]), y[tr][ok])
                te = np.isfinite(X[b]).all(axis=1)
                if te.any():
                    pred[b[te]] = m.predict(sc.transform(X[b][te]))
        seen += len(b)
    return pred, y


MODELS = {
    "ridge": lambda: Ridge(alpha=30.0),
    "gbm": lambda: HistGradientBoostingRegressor(
        max_depth=3, learning_rate=0.03, max_iter=300, min_samples_leaf=60,
        l2_regularization=1.0, random_state=0),
    "gbm-shallow": lambda: HistGradientBoostingRegressor(
        max_depth=2, learning_rate=0.05, max_iter=200, min_samples_leaf=120,
        l2_regularization=5.0, random_state=0),
    "rf": lambda: RandomForestRegressor(
        n_estimators=300, max_depth=6, min_samples_leaf=40, n_jobs=2, random_state=0),
}

SETS = {"player only": ["d_p_heat", "d_p_top", "conc_drv", "heat_conc", "d_p_ownx"],
        "team process only": ["d_xefg_net", "d_xefg", "d_xefg_a", "d_luck_net"],
        "base (no phase, no interaction)": BASE,
        "FULL (phase + interaction)": FULL}


def main():
    d = prep(load_all())
    L = [f"# NBA sides model — walk-forward on play-by-play features", "",
         f"n = {len(d):,} games, 4 seasons. Target = market residual, so R² > 0 beats the "
         f"posted line.", "",
         "## Walk-forward out-of-sample R² vs trusting the line", "",
         "| feature set | model | R² T-60 | R² OPEN | corr T-60 | corr OPEN |",
         "|---|---|---|---|---|---|"]
    best = None
    for sname, feats in SETS.items():
        for mname, make in MODELS.items():
            r2, cr = {}, {}
            for mkt in ("T-60", "OPEN"):
                p, y = walk_forward(d, feats, MKT[mkt][0], make)
                ok = np.isfinite(p) & np.isfinite(y)
                r2[mkt] = 100 * (1 - np.sum((y[ok] - p[ok]) ** 2) / np.sum(y[ok] ** 2))
                cr[mkt] = 100 * np.corrcoef(p[ok], y[ok])[0, 1]
                if mkt == "T-60":
                    pt60 = p
            L.append(f"| {sname} | {mname} | {r2['T-60']:+.2f} | {r2['OPEN']:+.2f} | "
                     f"{cr['T-60']:+.2f} | {cr['OPEN']:+.2f} |")
            print(L[-1], flush=True)
            if best is None or cr["T-60"] > best[0]:
                best = (cr["T-60"], sname, mname, pt60.copy())

    cor, sname, mname, p = best
    L += ["", f"## Bet test — best cell by correlation ({sname} / {mname}, corr {cor:+.2f})",
          "",
          "`edge` = win% − the hindsight max-side baseline of the same subset. A coin flip "
          "scores ≈ −2 on it, so compare `null mean`, not zero.", "",
          "| cell | market | bets | win % | base % | edge | null mean | p | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for n in (300, 600, 1000):
        for mkt in ("OPEN", "T-60"):
            bet(d, p.copy(), mkt, n, f"pooled @{n}", L)

    # the phase question, asked of the MODEL rather than of a hand-picked slice
    L += ["", "### the same model, by season phase", ""]
    L += ["| cell | market | bets | win % | base % | edge | null mean | p | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for name, lo, hi in [("mid (16-45)", 16, 45), ("late (46-81)", 46, 81)]:
        m = (d["gp"] >= lo) & (d["gp"] <= hi)
        s = d[m].reset_index(drop=True)
        for mkt in ("OPEN", "T-60"):
            bet(s, p[m.to_numpy()].copy(), mkt, 250, name, L)

    path = os.path.join(ROOT, "NBA_SIDES_MODEL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
