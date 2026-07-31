#!/usr/bin/env python3
"""The FG spread, cut by where in the season the game sits. No refit -- saved predictions.

The pooled spread number (52.36% at best, nothing consistent) is an AVERAGE over four
regimes that have no business being averaged:

  EARLY      both teams under ~15 games played. Nobody -- market or model -- has current-
             season information yet, so the line is built off last season's ratings plus
             offseason roster moves. This is the one window where the market is provably
             working with a thin prior, and where a model carrying a proper prior-season
             posterior can differ from it for a real reason.
  MID        the fat middle. Everyone has information. This is where an efficient market
             should be hardest to beat, and it is ~55% of the sample, so it DOMINATES the
             pooled number and drowns anything the other three windows do.
  LATE       tanking, playoff seeding locked, rest days, load management. The market prices
             announced rest, but motivation is the least machine-readable input there is.
  PLAYOFFS   different rotations, different pace, seven-game adjustments, no b2b.

Pooling these is the modelling error. A 56% early-season edge on 400 games and a 49%
mid-season fade on 2,800 pool to 50.9% and get written up as "dead" -- which is what I did.

This script does no fitting. It reads the predictions already written by nba_open_model.py
and re-grades them inside each window, per method, so the cost of asking is zero.

Read it with the multiple-comparisons problem in the front of your mind: 8 methods x 4
phases x 4 cuts is 128 cells and roughly six of them will clear 55% on noise alone. Nothing
here is a finding. This is a MAP telling us which window is worth a properly-controlled,
phase-specific refit -- that refit is nba_spread_v2.py, and it is the thing that decides.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
CUTS = (100, 50, 25, 10)


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def phases(d):
    """Four windows, defined off information available before tip -- never off the result."""
    gp = np.minimum(d["h_gp"].to_numpy(dtype=float), d["a_gp"].to_numpy(dtype=float))
    post = d["game.postseason"].to_numpy(dtype=float) > 0
    ph = np.where(post, "playoffs",
                  np.where(gp < 15, "early", np.where(gp < 50, "mid", "late")))
    return pd.Series(ph, index=d.index)


def grade(d, pcol, seasons):
    """Bet the side the model's margin disagrees with the open about, ranked by |edge|."""
    rows = []
    # open_spread_home_point is the HOME spread, so margin + spread = home-side edge
    edge = (d[pcol] + d["open_spread_home_point"]).to_numpy(dtype=float)
    home = edge > 0
    live = d["y_fg_margin"].to_numpy(dtype=float) != -d["open_spread_home_point"].to_numpy(
        dtype=float)
    win = np.where(home,
                   d["y_fg_margin"].to_numpy(dtype=float)
                   > -d["open_spread_home_point"].to_numpy(dtype=float),
                   d["y_fg_margin"].to_numpy(dtype=float)
                   < -d["open_spread_home_point"].to_numpy(dtype=float)).astype(float)
    dec = np.where(home, american_to_dec(d["open_spread_home_price"]),
                   american_to_dec(d["open_spread_away_price"]))
    ok = live & np.isfinite(edge) & np.isfinite(dec)
    if ok.sum() < 120:
        return rows
    a = np.abs(edge)
    for pct in CUTS:
        thr = np.nanquantile(a[ok], 1 - pct / 100) if pct < 100 else -1
        m = ok & (a >= thr)
        if m.sum() < 60:
            continue
        per = []
        for s in seasons:
            k = (d["season"].to_numpy()[m] == s)
            per.append(f"{100*win[m][k].mean():.0f}" if k.sum() >= 20 else "-")
        rows.append(dict(cut=f"top{pct}%", n=int(m.sum()), win=100 * win[m].mean(),
                         roi=roi(win[m], dec[m]), home=100 * home[m].mean(),
                         per="/".join(per)))
    return rows


def main():
    M = pd.read_parquet(f"{OUT}/nba_open_margin_preds.parquet")
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    # the saved preds carry the line but not the two prices, so pull those back too
    need = ["game.id", "h_gp", "a_gp", "game.postseason",
            "open_spread_home_price", "open_spread_away_price"]
    # same 45 ambiguous odds joins dropped everywhere else in this folder
    dup = set(F.loc[F.duplicated("game.id", keep=False), "game.id"])
    F = F[~F["game.id"].isin(dup)][need].drop_duplicates("game.id")
    D = M.merge(F, on="game.id", how="inner")
    D["phase"] = phases(D)
    seasons = sorted(D["season"].unique())
    pcols = [c for c in D.columns if c.startswith("p_")]
    print(f"{len(D):,} graded games, methods {pcols}", flush=True)
    print(D["phase"].value_counts().to_string(), flush=True)

    L = ["# NBA full-game spread, by season phase", "",
         "No refitting. These are the predictions `nba_open_model.py` already wrote, "
         "re-graded inside four windows instead of pooled into one number. Betting the "
         "opening spread, graded against the opening spread.", "",
         "**This is a map, not a finding.** 8 methods x 4 phases x 4 cuts is 128 cells; "
         "a handful will clear 55% on noise alone. The only thing it decides is which "
         "window earns a phase-specific refit with real controls.", "",
         "| phase | games | share |", "|---|---|---|"]
    vc = D["phase"].value_counts()
    for ph in ["early", "mid", "late", "playoffs"]:
        if ph in vc:
            L.append(f"| {ph} | {vc[ph]:,} | {100*vc[ph]/len(D):.1f}% |")

    for ph in ["early", "mid", "late", "playoffs"]:
        d = D[D["phase"] == ph]
        if len(d) < 200:
            continue
        L += [f"\n## {ph} — n={len(d):,}\n",
              "| method | cut | n | win% | ROI | home side % | by season |",
              "|---|---|---|---|---|---|---|"]
        for pc in pcols:
            for r in grade(d.reset_index(drop=True), pc, seasons):
                L.append(f"| {pc[2:]} | {r['cut']} | {r['n']:,} | {r['win']:.1f} | "
                         f"{r['roi']:+.2f} | {r['home']:.0f} | {r['per']} |")

    # the honest baseline for every cell above: what a coin does in the same window
    L += ["\n## Baseline — no model at all\n",
          "Blind home and blind favourite in each window. Any model cell has to beat the "
          "window's own baseline, not 50%.", "",
          "| phase | n | home covers % | fav covers % |", "|---|---|---|---|"]
    for ph in ["early", "mid", "late", "playoffs"]:
        d = D[D["phase"] == ph]
        if len(d) < 200:
            continue
        sp = d["open_spread_home_point"].to_numpy(dtype=float)
        y = d["y_fg_margin"].to_numpy(dtype=float)
        live = (y != -sp) & np.isfinite(sp)
        hc = (y[live] > -sp[live]).mean()
        favhome = sp[live] < 0
        fc = np.where(favhome, y[live] > -sp[live], y[live] < -sp[live]).mean()
        L.append(f"| {ph} | {live.sum():,} | {100*hc:.2f} | {100*fc:.2f} |")

    path = os.path.join(ROOT, "NBA_SPREAD_PHASE_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
