#!/usr/bin/env python3
"""Round three: the home side was never broken, so grade the whole rule properly.

WHAT ROUNDS ONE AND TWO ESTABLISHED. The line mismatch, the level bias and the shrinkage story are
all dead. The 2x2 then dissolved the premise: of the four cells at >=6, **three pay +11.9%, +11.9%
and +47.7%, and only `model takes HOME while the market favours HOME` loses (-10.1% on 91 bets)**.
That cell's blind rate is -5.5%, so the model is 0.44 sd from simply adding nothing there — not
broken, just no lift on the worst blind population in the market. Backing favourites (+10.1%) and
backing dogs (+11.9%) pay the same, so it was never a dog rule either.

And the control refused to cooperate in the useful direction: the FULL-GAME spread model at >=8 is
**HOME +36.4% on 63 bets, AWAY +4.0% on 314** — the exact opposite tilt to the first half's. Two
models, two opposite side asymmetries, both concentrated in fifty-to-two-hundred bets. That is what
side splits at this sample size look like, and it is the reason to stop reading them as structure.

SO THIS FILE ASKS THE QUESTIONS THAT SURVIVE.
  1. LIFT OVER BLIND, cell by cell — model ROI minus the ROI of betting that same cell blind. It is
     the only comparison that does not punish a side for being an expensive side to bet.
  2. The FULL rule per season and per phase, with nulls. Every earlier breakout was of the away side
     alone, which is why the whole rule was never actually examined.
  3. A pre-registered `skip home favourites` variant. Stated honestly: that exclusion was chosen
     AFTER seeing the 2x2, so its ROI is not an out-of-sample number and it is reported for
     mechanism, not as a product.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "NBA_H1_SPREAD_DIAG.md")
HALF_LIFE = 120.0
CUT = ["nets", "usage", "h1_streak", "raw_box", "form", "h1_form", "dims"]
NULLS = 30
KS = (3, 4, 5, 6)


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def roi_of(yb, po, pu, m, home_side):
    m = m & yb.notna() & po.notna() & pu.notna()
    if m.sum() < 25:
        return None
    win = yb[m] if home_side else 1 - yb[m]
    dec = (po if home_side else pu)[m]
    return dict(n=int(m.sum()), win=100 * win.mean(),
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def rule_roi(d, yb, po, pu, k, mask=None):
    """ROI of the whole two-sided rule, optionally restricted."""
    ok = d.notna() & yb.notna() & po.notna() & pu.notna() & (d.abs() >= k)
    if mask is not None:
        ok = ok & mask
    if ok.sum() < 25:
        return None
    hs = d[ok] > 0
    win = np.where(hs, yb[ok], 1 - yb[ok])
    dec = np.where(hs, po[ok], pu[ok])
    return dict(n=int(ok.sum()), win=100 * win.mean(),
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def main():
    hp = _mod("hp", "nba_h1_prune.py")
    pa, P, G, cols = hp.load()
    fam = pd.Series({c: hp.famof(c) for c in cols})
    rng = np.random.default_rng(20260802)

    S = hp.markets(pa, P, G)["1H_SPREAD"]
    resid = S["resid"]
    yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
    po, pu = S["po"], S["pu"]
    hf = -G["h1_spread"].astype(float) > 0

    use = [c for c in cols if fam[c] not in CUT]
    nulls_y = [pa.game_shuffle(P, S["y"], rng) for _ in range(NULLS)]
    preds = pa.ridge_multi(P[use].astype(float), P["date"],
                           [S["y"]] + nulls_y, half_life=HALF_LIFE)
    ds = [S["reduce"](p) for p in preds]
    d = ds[0]

    L = ["", "---", "", "# Round three — the rule, not the side", "",
         "`nba_h1_spread_diag3.py`. 475 features, half-life 120d, "
         f"{NULLS} game-level null shuffles.", "",
         "## Lift over blind — the only fair way to compare two sides", "",
         "A side is not weak because it loses money; it is weak because it loses more money than "
         "betting that same population blind. 1H home is an expensive side to be on.", "",
         "| cut | cell | bets | model ROI | blind ROI | **lift** |", "|---|---|---|---|---|---|"]
    cells = [("HOME, home favoured", d > 0, True, hf),
             ("HOME, away favoured", d > 0, True, ~hf),
             ("AWAY, home favoured", d < 0, False, hf),
             ("AWAY, away favoured", d < 0, False, ~hf),
             ("HOME, all", d > 0, True, pd.Series(True, index=G.index)),
             ("AWAY, all", d < 0, False, pd.Series(True, index=G.index))]
    for k in KS:
        for lab, sd_, hs, fm in cells:
            c = roi_of(yb, po, pu, d.notna() & sd_ & (d.abs() >= k) & fm, hs)
            b = roi_of(yb, po, pu, d.notna() & fm, hs)
            if not c or not b:
                continue
            L.append(f"| ≥{k:g} | {lab} | {c['n']:,} | {c['roi']:+.1f} | {b['roi']:+.1f} | "
                     f"**{c['roi']-b['roi']:+.1f}** |")
            print(L[-1], flush=True)
    L.append("")

    # --- the FULL rule, broken out the way the away side alone was --------------------------
    L += ["## The full two-sided rule, per season and per phase", "",
          "Every earlier breakout was of the away side by itself. This is the rule.", "",
          "| cut | slice | bets | win% | ROI |", "|---|---|---|---|---|"]
    slices = [("all", pd.Series(True, index=G.index))]
    slices += [(str(int(v)), G["season"] == v) for v in sorted(G["season"].dropna().unique())]
    slices += [(p, G["phase"] == p) for p in ("EARLY", "MID", "LATE", "POST")]
    for k in (5, 6):
        for lab, m in slices:
            r = rule_roi(d, yb, po, pu, k, m)
            if r:
                L.append(f"| ≥{k:g} | {lab} | {r['n']:,} | {r['win']:.1f} | **{r['roi']:+.1f}** |")
                print(L[-1], flush=True)
    L.append("")

    # --- z on the whole rule ------------------------------------------------------------------
    L += ["## z on the whole rule", "",
          "| cut | bets | win% | base% | ROI | null mean | null sd | z |", "|---|---|---|---|---|---|---|---|"]
    for k in KS:
        g = pa.grade(d, yb, po, pu, k)
        if not g["n"]:
            continue
        ne = np.array([(lambda q: q["win"] - q["base"])(pa.grade(n, yb, po, pu, k))
                       for n in ds[1:]], dtype=float)
        mu, sd = np.nanmean(ne), np.nanstd(ne, ddof=1)
        z = (g["win"] - g["base"] - mu) / sd if sd and sd > 0 else np.nan
        L.append(f"| ≥{k:g} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | **{g['roi']:+.1f}** | "
                 f"{mu:+.2f} | {sd:.2f} | **{z:+.2f}** |")
        print(L[-1], flush=True)
    L.append("")

    # --- the post-hoc exclusion, labelled as post-hoc ------------------------------------------
    skip = ~((d > 0) & hf)
    L += ["## `skip home favourites` — reported for mechanism, NOT as a product", "",
          "**This exclusion was chosen after seeing the 2x2.** It drops the one cell with no lift "
          "over blind. It is here to show how much of the rule that cell was dragging, and it has "
          "no out-of-sample standing whatsoever.", "",
          "| cut | bets | win% | ROI | (full rule) |", "|---|---|---|---|---|"]
    for k in KS:
        r = rule_roi(d, yb, po, pu, k, skip)
        f = rule_roi(d, yb, po, pu, k)
        if r and f:
            L.append(f"| ≥{k:g} | {r['n']:,} | {r['win']:.1f} | **{r['roi']:+.1f}** | "
                     f"{f['roi']:+.1f} on {f['n']:,} |")
            print(L[-1], flush=True)
    L += ["", "### and per season, same exclusion", "",
          "| cut | season | bets | win% | ROI |", "|---|---|---|---|---|"]
    for k in (5, 6):
        for v in sorted(G["season"].dropna().unique()):
            r = rule_roi(d, yb, po, pu, k, skip & (G["season"] == v))
            if r:
                L.append(f"| ≥{k:g} | {int(v)} | {r['n']:,} | {r['win']:.1f} | "
                         f"**{r['roi']:+.1f}** |")
                print(L[-1], flush=True)
    L.append("")

    open(OUT, "a").write("\n".join(L) + "\n")
    print(f"\nappended to {OUT}", flush=True)


if __name__ == "__main__":
    main()
