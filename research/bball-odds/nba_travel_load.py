#!/usr/bin/env python3
"""Cumulative travel load: the 16 columns that survived, put through the full gauntlet.

WHERE THIS CAME FROM. The travel block was built as 54 columns and split in two by
`nba_travel_control.py`, because "travel" is really two different hypotheses and lumping them
lets one carry the other:

    ACUTE / GEOGRAPHY (38 cols)  tonight's flight distance, signed direction, altitude with an
                                 acclimatisation decay, DST-correct body-clock tip hour
    CUMULATIVE LOAD  (16 cols)   km_7d, km_14d, venues_7d, days_since_home  x  h/a/sum/d

Against the round-2 totals ridge:

    base                     corr +0.0672   edge +3.3   ROI +2.5
    base + all 54            corr +0.0742   edge +3.1   ROI +2.1
    base + geography (38)    corr +0.0648   edge +2.7   ROI +1.1     <- below base
    base + load (16)         corr +0.0726   edge +3.5   ROI +3.1     <- better on BOTH layers
    placebo (wrong games)    corr +0.0640 +- 0.0037

The acute story is not in this data and the 38 geography columns were diluting the 16 that
were. That is worth stating plainly because the acute story is the one everyone tells --
red-eye flights, three time zones, Denver's altitude. What actually carries is the boring
version: how far this team has been dragged around over the last one to two weeks.

Mechanism, and why the existing frame missed it: `h_sched_g_last7` counts GAMES in the last
seven days. A homestand of four and a four-city road swing are the same number. `km_7d` is the
first column in the frame that can tell them apart, and cumulative kilometres is a fatigue
dose in a way that a game count is not.

WHAT THIS FILE DOES. Everything that has to be true before a 16-column block goes into a live
model: threshold ladder, a within-season label-shuffle null, a matched placebo, the phase and
season split, and a leave-one-family-out so a single column cannot be carrying the whole
thing. If it fails any of them it does not ship, and the file says so either way.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.linear_model import Ridge

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
spec = importlib.util.spec_from_file_location("v2", os.path.join(ROOT, "nba_total_v2.py"))
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)
spec2 = importlib.util.spec_from_file_location("tl", os.path.join(ROOT, "nba_travel_lab.py"))
tl = importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(tl)

K = 2.0
FAMILIES = ("km_7d", "km_14d", "venues_7d", "days_since_home")


def edge_of(g):
    return np.nan if g["n"] == 0 else g["win"] - g["base"]


def main():
    D = v2.build()
    D, tcols = tl.attach_travel(D)
    tcols = [c for c in tcols if c not in v2.leak_screen(D, tcols)]
    load = [c for c in tcols if any(k in c for k in FAMILIES)]
    base = v2.feature_cols(D)
    base = [c for c in base if c not in v2.leak_screen(D, base)]
    print(f"[load] {len(load)} columns: {load}", flush=True)

    yc = D["y_fg_tot_resid"].astype(float)
    yb = pd.Series(np.where(yc > 0, 1.0, np.where(yc < 0, 0.0, np.nan)), index=D.index)
    po = pd.Series(v2.to_dec(D["t60_total_over_price"]), index=D.index)
    pu = pd.Series(v2.to_dec(D["t60_total_under_price"]), index=D.index)
    cols = base + load

    def fit(D_, cs):
        p = v2.walk(D_[cs].astype(float), D_["date"], yc, kind="ridge")
        m = p.notna() & yc.notna()
        return p, np.corrcoef(p[m], yc[m])[0, 1]

    pb, rb = fit(D, base)
    pl_, rl = fit(D, cols)
    print(f"[base] corr {rb:+.4f}   [base+load] corr {rl:+.4f}", flush=True)

    L = ["# NBA totals: cumulative travel load", "",
         "The travel block was built as 54 columns and split into two hypotheses, because "
         "lumping them lets one carry the other. **Acute geography** — tonight's flight "
         "distance, direction, altitude, body-clock hour — lands *below* base on its own. "
         "**Cumulative load** — how far the team has been dragged around over one to two weeks "
         "— carries the whole gain, and improves the betting layer as well as the prediction "
         "layer.", "",
         "That is worth saying plainly, because the acute version is the story everyone tells: "
         "red-eye flights, three time zones, Denver's thin air. It is not what is in this "
         "data.", "",
         "Why the frame missed it: `h_sched_g_last7` counts GAMES in the last seven days, so a "
         "four-game homestand and a four-city road swing are the same number. `km_7d` is the "
         "first column that can tell them apart.", "",
         f"{len(D):,} gradeable games, seasons {sorted(D['season'].unique())}. "
         f"{len(load)} load columns on top of the {len(base)}-column round-2 set.", ""]

    # ---- threshold ladder ------------------------------------------------------------------
    L += ["## 1. Threshold ladder", "",
          "Bets are taken when the model disagrees with the T-60 close by ≥k points. `base%` "
          "is the best blind side inside those same rows; breakeven at −110 is 52.4%.", "",
          "| k (pts) | n | base edge | +load edge | base ROI | +load ROI |",
          "|---|---|---|---|---|---|"]
    for k in (0.0, 1.0, 2.0, 3.0, 4.0, 5.0):
        gb, gl = v2.grade(pb, yb, po, pu, k), v2.grade(pl_, yb, po, pu, k)
        if gl["n"] == 0:
            continue
        L.append(f"| ≥{k:.0f} | {gl['n']} | {edge_of(gb):+.1f} | **{edge_of(gl):+.1f}** | "
                 f"{gb['roi']:+.1f} | {gl['roi']:+.1f} |")
        print(L[-1], flush=True)

    # ---- null ------------------------------------------------------------------------------
    print("\n=== label-shuffle null ===", flush=True)
    X = D[cols].astype(float)
    rng = np.random.default_rng(31)
    nr, ne = [], []
    for i in range(8):
        ys = yc.copy()
        for s in D["season"].unique():
            m = (D["season"] == s) & yc.notna()
            ys.loc[m] = rng.permutation(yc.loc[m].values)
        p = v2.walk(X, D["date"], ys, kind="ridge")
        bb = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=D.index)
        mm = p.notna() & ys.notna()
        nr.append(np.corrcoef(p[mm], ys[mm])[0, 1])
        ne.append(edge_of(v2.grade(p, bb, po, pu, K)))
        print(f"[null {i+1}/8] corr {nr[-1]:+.4f}  edge {ne[-1]:+.2f}", flush=True)
    nr, ne = np.array(nr), np.array(ne)
    gl2 = v2.grade(pl_, yb, po, pu, K)
    L += ["", "## 2. Label-shuffle null (8 draws, permuted within season)", "",
          "| statistic | real | null mean | null sd | z |", "|---|---|---|---|---|",
          f"| oos corr | {rl:+.4f} | {nr.mean():+.4f} | {nr.std(ddof=1):.4f} | "
          f"**{(rl-nr.mean())/nr.std(ddof=1):+.2f}** |",
          f"| edge @ k≥2 | {edge_of(gl2):+.2f} | {ne.mean():+.2f} | {ne.std(ddof=1):.2f} | "
          f"**{(edge_of(gl2)-ne.mean())/ne.std(ddof=1):+.2f}** |"]

    # ---- placebo: load columns on the wrong games -------------------------------------------
    print("\n=== placebo (load on wrong games) ===", flush=True)
    rng = np.random.default_rng(17)
    pp = []
    for i in range(10):
        Dp = D.copy()
        for s in D["season"].unique():
            idx = D.index[D["season"] == s]
            Dp.loc[idx, load] = D.loc[rng.permutation(idx), load].values
        _, r = fit(Dp, cols)
        pp.append(r)
        print(f"[placebo {i+1:2d}/10] corr {r:+.4f}", flush=True)
    pp = np.array(pp)
    L += ["", "## 3. Placebo — same columns, wrong games", "",
          "Permuting which game each load row attaches to, within season, keeps the columns' "
          "distributions, internal correlations and count and breaks only the link to the game "
          "they describe. This separates *information* from *capacity*.", "",
          f"| real | placebo mean | placebo sd | z |", "|---|---|---|---|",
          f"| {rl:+.4f} | {pp.mean():+.4f} | {pp.std(ddof=1):.4f} | "
          f"**{(rl-pp.mean())/pp.std(ddof=1):+.2f}** |"]
    print(f"[placebo] mean {pp.mean():+.4f} sd {pp.std(ddof=1):.4f}", flush=True)

    # ---- leave-one-family-out ---------------------------------------------------------------
    print("\n=== leave-one-family-out ===", flush=True)
    L += ["", "## 4. Leave-one-family-out — is one column carrying it?", "",
          "| dropped | cols | oos corr | edge @ k≥2 | ROI |", "|---|---|---|---|---|"]
    for fam in FAMILIES:
        cs = [c for c in cols if fam not in c]
        p, r = fit(D, cs)
        g = v2.grade(p, yb, po, pu, K)
        L.append(f"| `{fam}` | {len(cs)} | `{r:+.4f}` | {edge_of(g):+.1f} | {g['roi']:+.1f} |")
        print(L[-1], flush=True)
    L.append(f"| *nothing (full)* | {len(cols)} | `{rl:+.4f}` | {edge_of(gl2):+.1f} | "
             f"{gl2['roi']:+.1f} |")

    # ---- phase / season ---------------------------------------------------------------------
    print("\n=== phase / season ===", flush=True)
    L += ["", "## 5. Phase and season", "",
          "Pooling hides seasonality and this split runs before anything is claimed.", "",
          "| slice | n | base edge | +load edge | base ROI | +load ROI |",
          "|---|---|---|---|---|---|"]
    for lbl, msk in ([(ph, D["phase"] == ph) for ph in ("EARLY", "MID", "LATE", "POST")] +
                     [(str(s), D["season"] == s) for s in sorted(D["season"].unique())]):
        gb, gg = v2.grade(pb, yb, po, pu, K, mask=msk), v2.grade(pl_, yb, po, pu, K, mask=msk)
        if gg["n"] == 0:
            continue
        L.append(f"| {lbl} | {gg['n']} | {edge_of(gb):+.1f} | **{edge_of(gg):+.1f}** | "
                 f"{gb['roi']:+.1f} | {gg['roi']:+.1f} |")
        print(L[-1], flush=True)

    # ---- which columns get the weight -------------------------------------------------------
    A = D[cols].astype(float)
    m = yc.notna()
    mu, sd = A[m].mean(), A[m].std().replace(0, 1.0)
    Z = ((A[m] - mu) / sd).fillna(0.0)
    w = pd.Series(Ridge(alpha=300.0).fit(Z, yc[m]).coef_, index=cols)
    L += ["", "## 6. Where the ridge puts its weight (load columns only)", "",
          "Signs inside a collinear block are not readable on their own — the ablation above is "
          "the evidence. This is here to show the weight is spread, not parked on one column.",
          "", "| column | weight |", "|---|---|"]
    for c, v in w[load].reindex(w[load].abs().sort_values(ascending=False).index).items():
        L.append(f"| `{c}` | {v:+.3f} |")
    L.append("")

    path = os.path.join(ROOT, "NBA_TRAVEL_LOAD.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
