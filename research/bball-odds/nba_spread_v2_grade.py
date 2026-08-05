#!/usr/bin/env python3
"""Grade the v2 spread predictions. No fitting -- the two pooled passes are already saved.

`nba_spread_v2.py` wrote both framings to parquet before its phase section, so the
question it was built to answer can be read off disk:

    does modelling the market's ERROR beat modelling the raw margin?

v1 predicted the raw margin with the opening line sitting in X as one feature among 220,
which makes every tree reconstruct the market's number before it can disagree with it.
Modelling the residual (margin + open spread) makes the market the intercept and leaves
the model only its error to learn. Same folds, same features, same eight families, so the
difference between the two tables is the framing and nothing else.

Read per phase, because the pooled number averages four regimes and that was the original
mistake. The comparator in every window is the naive rule that already works there --
blind home early, blind favourite late -- reweighted to the selection's own |open spread|
bucket mix, exactly as in `nba_spread_phase_control.py`.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
CUTS = (100, 50, 25, 10)
PHASES = ("early", "mid", "late", "playoffs")
NAIVE = {"early": "home", "mid": "home", "late": "fav", "playoffs": "home"}


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def cell_matched(sp, live, sel, nwin, ndec):
    edges = np.array([0, 2.5, 5.5, 8.5, 12.5, 99.0])
    b = np.digitize(np.abs(sp), edges[1:-1])
    tot = wsum = 0.0
    for k in np.unique(b[sel]):
        w = (b[sel] == k).sum()
        pool = live & (b == k)
        if pool.sum() < 40:
            continue
        tot += w * roi(nwin[pool], ndec[pool])
        wsum += w
    return tot / wsum if wsum else np.nan


def main():
    R = pd.read_parquet(f"{OUT}/nba_spread_v2_resid.parquet")
    M = pd.read_parquet(f"{OUT}/nba_spread_v2_margin.parquet")
    seasons = sorted(R["season"].unique())
    names = [c[2:] for c in R.columns if c.startswith("p_")]
    print(f"resid {R.shape}, margin {M.shape}, methods {names}", flush=True)

    L = ["# NBA full-game spread v2 — residual framing vs margin framing", "",
         "No refitting: both pooled passes were written to parquet by `nba_spread_v2.py` "
         "before its phase section. Same folds, same features, same eight families — the "
         "only difference between the two `framing` rows is what the model was asked to "
         "predict.", "",
         "- **margin** — predict the final margin, with the opening line in X as one "
         "feature among 220. The v1 framing. Every tree has to rebuild the market's "
         "number before it can disagree with it.",
         "- **resid** — predict `margin + open spread`, i.e. the market's error directly. "
         "The market is the intercept; the model only learns where it is wrong.", "",
         "`delta cell` is ROI minus the window's own naive rule (blind home early and in "
         "the playoffs, blind favourite late), reweighted to the selection's |open "
         "spread| bucket mix. That is the number that decides whether the model is adding "
         "anything, and it is the same control that decided the props programme.", "",
         "Breakeven at -110 is 52.4%.", ""]

    for ph in PHASES:
        L += [f"\n## {ph}\n",
              "| framing | method | cut | n | win% | ROI | delta cell | naive share | by season |",
              "|---|---|---|---|---|---|---|---|---|"]
        for lbl, F in (("resid", R), ("margin", M)):
            d = F[F["phase"] == ph].reset_index(drop=True)
            if len(d) < 200:
                continue
            sp = d["open_spread_home_point"].to_numpy(dtype=float)
            y = d["y_fg_margin"].to_numpy(dtype=float)
            dh = american_to_dec(d["open_spread_home_price"])
            da = american_to_dec(d["open_spread_away_price"])
            live = (y != -sp) & np.isfinite(sp) & np.isfinite(dh) & np.isfinite(da)
            n_home = (sp < 0) if NAIVE[ph] == "fav" else np.ones(len(sp), dtype=bool)
            nwin = np.where(n_home, (y > -sp).astype(float), (y < -sp).astype(float))
            ndec = np.where(n_home, dh, da)
            for nm in names:
                e = (d[f"p_{nm}"] if lbl == "resid"
                     else d[f"p_{nm}"] + d["open_spread_home_point"]).to_numpy(dtype=float)
                take_home = e > 0
                win = np.where(take_home, (y > -sp).astype(float),
                               (y < -sp).astype(float))
                dec = np.where(take_home, dh, da)
                ok = live & np.isfinite(e)
                if ok.sum() < 150:
                    continue
                a = np.abs(e)
                for pct in CUTS:
                    m = ok & (a >= np.nanquantile(a[ok], 1 - pct / 100)) if pct < 100 \
                        else ok
                    if m.sum() < 60:
                        continue
                    nc = cell_matched(sp, live, m, nwin, ndec)
                    per = []
                    for s in seasons:
                        k = d["season"].to_numpy()[m] == s
                        per.append(f"{100*win[m][k].mean():.0f}" if k.sum() >= 20 else "-")
                    L.append(
                        f"| {lbl} | {nm} | top{pct}% | {m.sum():,} | "
                        f"{100*win[m].mean():.1f} | {roi(win[m], dec[m]):+.2f} | "
                        f"**{roi(win[m], dec[m]) - nc:+.2f}** | "
                        f"{100*(take_home[m] == n_home[m]).mean():.0f}% | "
                        f"{'/'.join(per)} |")

    path = os.path.join(ROOT, "NBA_SPREAD_V2_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
