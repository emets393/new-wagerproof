#!/usr/bin/env python3
"""Two controls the first regime run needs before its result can be believed.

CONTROL 1 -- IS THE COEFFICIENT ROTATION REAL, OR JUST NOISE?
nba_regime.py fit the ridge inside each season and found the coefficient vectors correlate +0.040
across seasons -- essentially orthogonal, which reads as "the relationships themselves change".
But a one-season fit is 2,552 rows against 433 features. At that ratio the coefficients are mostly
noise, and two noisy estimates of the SAME true vector also correlate near zero. So the number on
its own proves nothing.

The control is a matched within-season comparison: split one season's GAMES in half at random, fit
both halves, correlate. Same row count, same feature count, same estimator, and no regime change
possible because it is one season. If within-season halves correlate around +0.04 too, the
cross-season figure is measuring noise and the "seasons are different leagues" story is unsupported
by this test. If within-season sits far above cross-season, the rotation is real.

CONTROL 2 -- WAS 180 DAYS A REAL OPTIMUM OR THE LUCKIEST OF SEVEN GUESSES?
The bake-off tried two half-lives and picked the better. Picking the best of a small grid and then
quoting its z is a selection the z does not pay for. The honest test is the SHAPE of the curve: a
real effect gives a smooth hill with a broad top, so neighbouring half-lives score similarly and the
exact choice barely matters. A spike at one value with dead neighbours is a fluke. Ten half-lives
from 45 days to infinity, same rows, same cut, reported per season.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "data", "parquet", "_nba_wide_cache.parquet")
PRED = os.path.join(ROOT, "data", "parquet", "_nba_hl_sweep.parquet")
NULLS = 20
HALF_LIVES = [45, 60, 90, 120, 180, 240, 365, 545, 730, None]


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
mk = _load("mk", "nba_markets.py")
pa = _load("pa", "nba_panel_all.py")
rg = _load("rg", "nba_regime.py")


def fit(P, rows, cols, ycol, alpha=300.0):
    A = P.loc[rows, cols].astype(float)
    A = ((A - A.mean()) / A.std().replace(0, 1)).fillna(0.0).values
    y = P.loc[rows, ycol].astype(float).values
    G = A.T @ A + alpha * np.eye(A.shape[1])
    return np.linalg.solve(G, A.T @ (y - y.mean()))


def control_noise(L, P, cols, ycol, reps=12):
    """Within-season split-half vs cross-season, both fit on the same number of rows.

    The two arms are PAIRED by redraw: one random split of the games gives both a within-season and a
    cross-season correlation, so the comparison is a paired test over `reps` independent redraws.
    Pooling every pair into one mean and eyeballing the gap would overstate the evidence, because the
    12 x 4 within pairs are re-splits of the same four seasons and are nowhere near independent.
    """
    seasons = sorted(P["season"].dropna().unique())
    ok = P[ycol].notna()
    games = {s: P.loc[ok & (P["season"] == s), "event_id"].unique() for s in seasons}
    seasons = [s for s in seasons if len(games[s]) >= 400]

    def half(s, which, seed):
        p = np.random.default_rng(seed).permutation(games[s])
        pick = p[: len(p) // 2] if which == 0 else p[len(p) // 2:]
        return P.index[ok & P["event_id"].isin(set(pick))]

    wr, cr = [], []
    for r in range(reps):
        # Fit each half ONCE per redraw and reuse it in both arms -- the within and cross numbers are
        # then built from literally the same fits, so nothing but the season pairing differs.
        F = {(s, h): fit(P, half(s, h, 1000 * r + int(s)), cols, ycol)
             for s in seasons for h in (0, 1)}
        wr.append(np.mean([np.corrcoef(F[(s, 0)], F[(s, 1)])[0, 1] for s in seasons]))
        cr.append(np.mean([np.corrcoef(F[(s, 0)], F[(t, 1)])[0, 1]
                           for i, s in enumerate(seasons) for t in seasons[i + 1:]]))
    wr, cr = np.array(wr), np.array(cr)
    d = wr - cr
    t = d.mean() / (d.std(ddof=1) / np.sqrt(len(d)))
    w, c = wr.mean(), cr.mean()
    L += ["## Control 1 — is the coefficient rotation real, or is it noise?", "",
          "A one-season ridge fit is 2,552 rows against 433 features, so its coefficients are mostly "
          "noise, and two noisy estimates of the SAME vector correlate near zero all by themselves. "
          "The cross-season +0.040 from `NBA_REGIME.md` therefore proves nothing on its own.", "",
          "This splits a single season's games in half at random and correlates the two halves' "
          "coefficients — identical row count, identical estimator, and no regime change possible "
          "because it is one season. That is the ceiling this estimator can reach. Cross-season "
          "pairs are built the same way, half a season against half a different season, so both "
          "sides of the comparison are fit on the same amount of data. Both arms come out of the "
          f"SAME {reps} random redraws, so they can be compared as a paired test rather than as two "
          "independent piles of correlations.", "",
          "| comparison | mean coefficient correlation | sd across redraws |", "|---|---|---|",
          f"| within one season (split-half) | **{w:+.3f}** | {wr.std(ddof=1):.3f} |",
          f"| across two seasons | **{c:+.3f}** | {cr.std(ddof=1):.3f} |",
          f"| paired difference | **{d.mean():+.3f}** | {d.std(ddof=1):.3f} |", "",
          f"Within-season is the ceiling at **{w:+.3f}**; across seasons it falls to **{c:+.3f}**, "
          f"about **{100*(1-c/w) if w else float('nan'):.0f}% of the reproducible signal lost** when "
          f"the two halves come from different years. Within beats cross in "
          f"**{int((d>0).sum())} of {len(d)}** redraws, paired **t = {t:+.2f}** on {len(d)-1} df.", "",
          ("Both numbers are small in absolute terms — that is the estimator's noise floor, not the "
           "effect size — so read the RATIO, not the gap. The rotation is real: same estimator, same "
           "sample size, same fits on both sides, and the only thing that changed is whether the two "
           "halves came from one season or two."
           if t > 3 and c < 0.6 * w else
           "The gap does not survive the paired test, so this does NOT establish that the "
           "relationships rotate — the earlier +0.040 was mostly estimator noise."), ""]
    print(f"[control] within {w:+.3f} vs cross {c:+.3f} | paired t {t:+.2f} "
          f"({int((d>0).sum())}/{len(d)} redraws)", flush=True)
    return L


def main():
    D = pd.read_parquet(CACHE).sort_values("date").reset_index(drop=True)
    D["date"] = pd.to_datetime(D["date"])
    P, fcols = pa.build_panel(D, pa.wide_stack(D))
    P["_yfg"] = P["pts"] - P["impl"]
    cols = [c for c in fcols if c not in mk.leak(P, fcols, "_yfg", "impl")]
    print(f"[regime2] {len(cols)} features", flush=True)

    L = ["# NBA regime study — the two controls", "",
         "`NBA_REGIME.md` reported that recency weighting roughly doubles the full-game total's "
         "edge and that per-season coefficient vectors are nearly orthogonal. Both claims need a "
         "control before they can be used: one to separate regime change from estimator noise, "
         "one to check that the winning half-life is a broad optimum rather than the luckiest cell "
         "of a small grid.", ""]
    L = control_noise(L, P, cols, "_yfg")

    # ---- Control 2: the half-life sweep ----------------------------------------------------
    rng = np.random.default_rng(20260801)
    y = P["_yfg"]
    targets = [y] + [pa.game_shuffle(P, y, rng) for _ in range(NULLS)]
    if os.path.exists(PRED):
        C = pd.read_parquet(PRED)
        assert len(C) == len(P), "cached sweep does not match the panel; delete it"
        preds = {str(h): [C[f"h{h}_{i}"] for i in range(NULLS + 1)] for h in HALF_LIVES}
        print("[regime2] loaded cached sweep", flush=True)
    else:
        preds = {}
        X = P[cols].astype(float)
        for h in HALF_LIVES:
            print(f"[regime2] walking half-life {h}", flush=True)
            preds[str(h)] = rg.walk(X, P["date"], targets, half_life=h, seasons=P["season"])
        pd.DataFrame({f"h{h}_{i}": preds[str(h)][i]
                      for h in HALF_LIVES for i in range(NULLS + 1)}).to_parquet(PRED)

    common = P.index.to_series().notna()
    for h in HALF_LIVES:
        common &= preds[str(h)][0].notna()
    okg = P.loc[common, "event_id"].value_counts()
    okg = set(okg[okg == 2].index)

    G = D.set_index("event_id").copy()
    gmask = pd.Series(G.index.isin(okg), index=G.index)
    bin_ = lambda s: pd.Series(np.where(s > 0, 1.0, np.where(s < 0, 0.0, np.nan)), index=s.index)
    yb = bin_(G["y_fg_total"] - G["t60_total_point"])
    po = pd.Series(v2.to_dec(G["t60_total_over_price"]), index=G.index)
    pu = pd.Series(v2.to_dec(G["t60_total_under_price"]), index=G.index)
    seasons = sorted(G["season"].dropna().unique())[1:]

    L += ["## Control 2 — is 180 days a broad optimum or a lucky cell?", "",
          "Ten half-lives on the same rows, same 4-point cut, full-game total. A real preference for "
          "recent data shows up as a smooth hill with a wide top, where neighbouring half-lives "
          "score alike and the exact number barely matters. A spike with dead neighbours is a fluke "
          "dressed as a parameter. `None` is the current pooled baseline — infinite memory.", "",
          "| half-life (days) | bets | win% | base% | edge | ROI | z | "
          + " | ".join(f"{int(s)} ROI" for s in seasons) + " |",
          "|---" * (8 + len(seasons)) + "|"]

    def d(h, i):
        t = P.assign(pred=P["impl"] + preds[str(h)][i])[["event_id", "team_row", "pred"]]
        g = t.pivot(index="event_id", columns="team_row", values="pred").reindex(G.index)
        return (g["home"] + g["away"]) - G["t60_total_point"]

    for h in HALF_LIVES:
        g = pa.grade(d(h, 0), yb, po, pu, 4, mask=gmask)
        if not g["n"]:
            continue
        ne = np.array([(lambda x: x["win"] - x["base"])(
            pa.grade(d(h, i), yb, po, pu, 4, mask=gmask)) for i in range(1, NULLS + 1)], dtype=float)
        mu, sg = np.nanmean(ne), np.nanstd(ne, ddof=1)
        z = (g["win"] - g["base"] - mu) / sg if sg > 0 else np.nan
        per = []
        for s in seasons:
            gs = pa.grade(d(h, 0), yb, po, pu, 4, mask=gmask & (G["season"] == s))
            per.append("—" if not gs["n"] else f"{gs['roi']:+.1f}")
        lab = "**None (pooled)**" if h is None else str(h)
        L.append(f"| {lab} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** | {z:+.2f} | "
                 + " | ".join(per) + " |")
        print("[sweep] " + L[-1], flush=True)
    L.append("")

    with open(os.path.join(ROOT, "NBA_REGIME_CONTROLS.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_REGIME_CONTROLS.md", flush=True)


if __name__ == "__main__":
    main()
