#!/usr/bin/env python3
"""NBA full-game SPREAD: do the situational dimensions give it the model it does not have?

WHY THE SPREAD AND NOT THE TOTAL. `nba_total_v4.py` just answered the total version of this
question and the answer was no -- adding all 52 situational columns moved out-of-sample corr
from +0.0725 to +0.0653 and the edge from +3.0 to +3.5 against a null sd of 0.86, i.e. down on
one axis and inside the noise on the other. But the total was always the wrong place to ask.

Every situational finding from the scan lived on the SPREAD, not the total:
  - S16  a top-third-pace team 3+ legs into a road trip fails to cover by 1.32 points, with
         every one-term control flat and the leg ladder grading for fast teams only.
  - S17  an away favourite off a 20+ point win covers 57.4% against 49.2% for away favourites
         generally.
  - The scan's total-side leads were the weak ones -- T4 died outright under the +0.72
         baseline correction, T3 sits at t=1.32.
And the spread is the market with NO working model: `NBA_PROVEN.md` §3 records that the FG
spread has never cleared its baseline in-model, which is why S9/S11/S14/S15/S17 are rules
rather than model output. So this asks the question the other way round: the rules work, does
the information behind them generalise into a model?

READ THE BASELINE CAREFULLY. A spread residual model is graded on which side of the number
the game lands, and the blind baseline inside any slice is ~50% by construction (both sides of
every game are in the panel). Breakeven at -110 is 52.4%. An edge of +2.4 is the bar to be
worth anything, and +3 or better is what the rules already deliver.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
v3 = _load("v3", "nba_total_v3.py")
v4 = _load("v4", "nba_total_v4.py")

K = 1.5   # spreads are tighter than totals, so the disagreement threshold is smaller


def build_spread():
    """Same frame as the total work, re-gated on the spread columns instead of the total."""
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    n0 = len(D)
    need = ["y_fg_margin", "t60_spread_home_point", "t60_spread_home_price",
            "t60_spread_away_price", "y_fg_marg_resid"]
    D = D[D[need].notna().all(axis=1)].copy()
    D["date"] = pd.to_datetime(D["date"])
    D = D.sort_values("date").reset_index(drop=True)
    print(f"[frame] {n0:,} -> {len(D):,} gradeable games", flush=True)

    lp = v2.asof_league_mean(D, "h_s2d_adv_pace", "a_s2d_adv_pace")
    lo = v2.asof_league_mean(D, "h_s2d_ortg", "a_s2d_ortg")
    poss = D["h_s2d_adv_pace"] + D["a_s2d_adv_pace"] - lp
    oh = D["h_s2d_ortg"] + D["a_s2d_adv_defensive_rating"] - lo
    oa = D["a_s2d_ortg"] + D["h_s2d_adv_defensive_rating"] - lo
    D["st_total"] = poss * (oh + oa) / 100.0
    D["st_gap"] = D["st_total"] - D["t60_total_point"]
    D["st_poss"], D["st_eff"] = poss, (oh + oa) / 2.0

    gp = pd.to_numeric(D.get("h_gp"), errors="coerce")
    post = pd.to_numeric(D.get("game.postseason").astype(float), errors="coerce").fillna(0)
    D["phase"] = np.where(post > 0, "POST", np.where(gp < 20, "EARLY",
                          np.where(gp < 50, "MID", "LATE")))
    return D


def main():
    D = build_spread()
    D = v3.with_fixed_ratings(D)
    D, themes = v4.dim_features(D)

    base_cols = [c for c in v2.feature_cols(D) if c not in v2.leak_screen(D, v2.feature_cols(D))]
    radj = [c for c in D.columns if c.startswith("radj_") and D[c].notna().mean() > 0.80]
    r3_cols = base_cols + radj
    dim_cols = [c for t in themes.values() for c in t if D[c].notna().mean() > 0.80]
    full_cols = r3_cols + dim_cols
    print(f"[features] base={len(r3_cols)}  dims={len(dim_cols)}  total={len(full_cols)}",
          flush=True)

    # residual of the actual margin against the closing number, from the HOME side
    y = D["y_fg_marg_resid"].astype(float)
    yb = pd.Series(np.where(y > 0, 1.0, np.where(y < 0, 0.0, np.nan)), index=D.index)
    ph = pd.Series(v2.to_dec(D["t60_spread_home_price"]), index=D.index)
    pa = pd.Series(v2.to_dec(D["t60_spread_away_price"]), index=D.index)

    L = ["# NBA full-game SPREAD — do the situational dimensions build the missing model?", "",
         f"{len(D):,} gradeable games. Walk-forward ridge on the margin residual vs the T-60 "
         f"close, bets at |disagreement| ≥ {K} points. Breakeven at −110 is 52.4%, and the "
         f"blind baseline is ~50% by construction.", "",
         "Context: the total version of this test (`NBA_TOTAL_V4.md`) came back negative. The "
         "spread is where every situational finding actually lived (S16, S17), and it is the "
         "market with no working model — so this is the question that matters.", "",
         "## 1. Headline", "",
         "| feature set | cols | oos corr | n | win% | base% | edge | ROI |",
         "|---|---|---|---|---|---|---|---|"]
    P = {}
    for tag, cs in (("base + repaired ratings", r3_cols),
                    ("+ situational dims", full_cols),
                    ("situational dims ALONE", dim_cols)):
        P[tag] = v2.walk(D[cs].astype(float), D["date"], y, kind="ridge")
        v4.report(L, tag, P[tag], y, yb, ph, pa, len(cs), k=K)

    best = P["+ situational dims"]

    L += ["", "## 2. Each theme added on its own", "",
          "| added | cols | oos corr | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|"]
    for t, cs_t in themes.items():
        cs_t = [c for c in cs_t if c in dim_cols]
        if not cs_t:
            continue
        p = v2.walk(D[r3_cols + cs_t].astype(float), D["date"], y, kind="ridge")
        v4.report(L, f"+ {t} ({len(cs_t)} cols)", p, y, yb, ph, pa, len(r3_cols) + len(cs_t), k=K)

    L += ["", "## 3. Threshold ladder", "",
          "| k (pts) | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for k in (0.0, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0):
        g = v2.grade(best, yb, ph, pa, k)
        if g["n"]:
            L.append(f"| ≥{k} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print(L[-1], flush=True)

    L += ["", "## 4. Season and phase (k ≥ %.1f)" % K, "",
          "| slice | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for lab, msk in ([(str(s), D["season"] == s) for s in sorted(D["season"].unique())] +
                     [(pz, D["phase"] == pz) for pz in ("EARLY", "MID", "LATE", "POST")]):
        g = v2.grade(best, yb, ph, pa, K, mask=msk)
        if g["n"]:
            L.append(f"| {lab} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print(L[-1], flush=True)

    rng = np.random.default_rng(77)
    nr, ne = [], []
    for i in range(8):
        ys = y.copy()
        for s in D["season"].unique():
            msk = (D["season"] == s) & y.notna()
            ys.loc[msk] = rng.permutation(y.loc[msk].values)
        ps = v2.walk(D[full_cols].astype(float), D["date"], ys, kind="ridge")
        ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=D.index)
        mm = ps.notna() & ys.notna()
        nr.append(np.corrcoef(ps[mm], ys[mm])[0, 1])
        gg = v2.grade(ps, ybs, ph, pa, K)
        ne.append(gg["win"] - gg["base"])
        print(f"[null {i+1}/8] corr {nr[-1]:+.4f}  edge {ne[-1]:+.2f}", flush=True)

    mm = best.notna() & y.notna()
    rr = np.corrcoef(best[mm], y[mm])[0, 1]
    gg = v2.grade(best, yb, ph, pa, K)
    re_ = gg["win"] - gg["base"]
    nr, ne = np.array(nr), np.array(ne)
    L += ["", "## 5. Label-shuffle null (8 draws, within season)", "",
          "| statistic | real | null mean | null sd | z |", "|---|---|---|---|---|",
          f"| oos corr | {rr:+.4f} | {nr.mean():+.4f} | {nr.std(ddof=1):.4f} | "
          f"**{(rr-nr.mean())/nr.std(ddof=1):+.2f}** |",
          f"| edge @ k≥{K} | {re_:+.2f} | {ne.mean():+.2f} | {ne.std(ddof=1):.2f} | "
          f"**{(re_-ne.mean())/ne.std(ddof=1):+.2f}** |", ""]
    print("\n".join(L[-4:]), flush=True)

    path = os.path.join(ROOT, "NBA_SPREAD_DIMS.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
