#!/usr/bin/env python3
"""Round two: is the 1H spread's split about HOME/AWAY at all, or about FAVOURITE/DOG?

Round one (`nba_h1_spread_diag.py`) killed all three mechanical explanations. The graded line and
the reducer's line are the same number on 3,961 of 3,961 games. The symmetric part of the panel
prediction is identically **0.000 with sd 0.000** — the fit is exactly antisymmetric, so there is no
level bias to find. And the model is not shrunk toward the market, it is 1.22x too WIDE (slope of
realised margin on mhat = +0.684 against the market's +1.038), which would make it a favourite-
BACKER, the opposite of what a shrunk model does. Every calibration repair left HOME negative and
AWAY strong, so the split is not an artefact of the transform.

What round one did surface: **at >=6 the away bets are 75% home-favoured games while the home bets
are 51%.** So "model takes the away side" and "model fades the favourite" are badly confounded, and
the 2x2 below is the only thing that can separate them. Three questions:

  1. Split the bets by model side x who the market favours. If the money is in both away cells it is
     an away rule; if it is in both dog cells it is a dog rule; if it is in one cell it is neither
     and the whole thing is 90 bets wearing a costume.
  2. Every cell gets its BLIND control — the same population bet the same way with no model. A cell
     only counts if the model beats betting that cell blind.
  3. Does the FULL-GAME spread model split the same way? If the four-season full-game model is also
     home-weak and away-strong, this is a property of an originator meeting an NBA side market and
     not a first-half bug. That control is the reason to bother.
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
H1_CUT = ["nets", "usage", "h1_streak", "raw_box", "form", "h1_form", "dims"]
FG_KEEP = ["rapm", "pl_regr"]          # the settled full-game CORE


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cell(yb, po, pu, m, home_side):
    """n / win% / ROI for a set of games all bet on the same side."""
    m = m & yb.notna() & po.notna() & pu.notna()
    if m.sum() < 25:
        return None
    win = yb[m] if home_side else 1 - yb[m]
    dec = (po if home_side else pu)[m]
    return dict(n=int(m.sum()), win=100 * win.mean(),
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def sides(d, yb, po, pu, ks, tag, L):
    L += [f"| **{tag}** | | | | | |"]
    for k in ks:
        for lab, hs in (("HOME", True), ("AWAY", False)):
            m = d.notna() & ((d > 0) if hs else (d < 0)) & (d.abs() >= k)
            c = cell(yb, po, pu, m, hs)
            if c:
                L.append(f"| ≥{k:g} | {lab} | {c['n']:,} | {c['win']:.1f} | "
                         f"**{c['roi']:+.1f}** | |")
                print(L[-1], flush=True)


def main():
    hp = _mod("hp", "nba_h1_prune.py")
    pa, P, G, cols = hp.load()
    fam = pd.Series({c: hp.famof(c) for c in cols})
    sgn = np.where(P["team_row"] == "home", 1.0, -1.0)

    S = hp.markets(pa, P, G)["1H_SPREAD"]
    resid = S["resid"]
    yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
    po, pu = S["po"], S["pu"]
    spr = G["h1_spread"].astype(float)

    use = [c for c in cols if fam[c] not in H1_CUT]
    d = S["reduce"](pa.ridge_multi(P[use].astype(float), P["date"],
                                   [S["y"]], half_life=HALF_LIFE)[0])
    hf = -spr > 0                                   # market favours the home team

    L = ["", "---", "", "# Round two — home/away, or favourite/dog?", "",
         "`nba_h1_spread_diag2.py`. Round one killed the line mismatch, the level bias and the "
         "shrinkage story; what it left was a confound. At ≥6 the model's away bets are **75% "
         "home-favoured games** and its home bets are 51%, so `takes the away side` and `fades the "
         "favourite` are the same variable until they are split apart.", "",
         "## The 2x2 — model side x who the market favours", "",
         "`blind` is the same population bet the same side with no model at all. A cell is only "
         "evidence if the model clears its own blind control.", "",
         "| cut | model takes | market favours | bets | win% | ROI | blind ROI (same cell) |",
         "|---|---|---|---|---|---|---|"]
    for k in (4, 5, 6):
        for lab, hs in (("HOME", True), ("AWAY", False)):
            for fv, fm in (("home", hf), ("away", ~hf)):
                m = d.notna() & ((d > 0) if hs else (d < 0)) & (d.abs() >= k) & fm
                c = cell(yb, po, pu, m, hs)
                if not c:
                    continue
                b = cell(yb, po, pu, d.notna() & fm, hs)
                L.append(f"| ≥{k:g} | {lab} | {fv} | {c['n']:,} | {c['win']:.1f} | "
                         f"**{c['roi']:+.1f}** | {b['roi']:+.1f} (n={b['n']:,}) |")
                print(L[-1], flush=True)
    L.append("")

    # Collapse the same bets the other way: is the winning axis dog-vs-favourite?
    L += ["## The same bets, collapsed on the other axis", "",
          "| cut | model backs the… | bets | win% | ROI |", "|---|---|---|---|---|"]
    for k in (4, 5, 6):
        for lab, m in (("favourite", ((d > 0) & hf) | ((d < 0) & ~hf)),
                       ("underdog", ((d > 0) & ~hf) | ((d < 0) & hf))):
            mm = d.notna() & (d.abs() >= k) & m
            hsm = (d > 0)
            ok = mm & yb.notna() & po.notna() & pu.notna()
            if ok.sum() < 25:
                continue
            win = np.where(hsm[ok], yb[ok], 1 - yb[ok])
            dec = np.where(hsm[ok], po[ok], pu[ok])
            L.append(f"| ≥{k:g} | {lab} | {int(ok.sum()):,} | {100*win.mean():.1f} | "
                     f"**{100*(win*(dec-1)-(1-win)).mean():+.1f}** |")
            print(L[-1], flush=True)
    L.append("")

    # Per-season stability of the away side, since that is the whole claim.
    L += ["## The away side, season by season", "",
          "| cut | season | bets | win% | ROI |", "|---|---|---|---|---|"]
    for k in (5, 6):
        for v in sorted(G["season"].dropna().unique()):
            m = d.notna() & (d < 0) & (d.abs() >= k) & (G["season"] == v)
            c = cell(yb, po, pu, m, False)
            if c:
                L.append(f"| ≥{k:g} | {int(v)} | {c['n']:,} | {c['win']:.1f} | "
                         f"**{c['roi']:+.1f}** |")
                print(L[-1], flush=True)
    L.append("")

    # --- the control that matters: does the FULL-GAME spread split the same way? ---------------
    fgu = [c for c in cols if fam[c] in FG_KEEP]
    fy = pd.Series(P["event_id"].map(G["y_fg_margin"]).astype(float) * sgn, index=P.index)
    fsp = G["t60_spread_home_point"].astype(float)
    fresid = G["y_fg_marg_resid"].astype(float)
    fyb = pd.Series(np.where(fresid > 0, 1.0, np.where(fresid < 0, 0.0, np.nan)), index=G.index)
    fpo = pd.Series(pa.v2.to_dec(G["t60_spread_home_price"]), index=G.index)
    fpu = pd.Series(pa.v2.to_dec(G["t60_spread_away_price"]), index=G.index)
    assert pa.grade(fresid, fyb, fpo, fpu, 0)["win"] > 99.5, "FG spread oracle inverted"
    fp = pa.ridge_multi(P[fgu].astype(float), P["date"], [fy], half_life=HALF_LIFE)[0]
    t = P.assign(p=fp)[["event_id", "team_row", "p"]]
    g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
    fd = (g["home"] - g["away"]) / 2.0 + fsp

    L += ["## Control — the FULL-GAME spread model, same split", "",
          f"CORE ({len(fgu)} features, `rapm`+`pl_regr`), half-life 120d, four seasons. If this "
          "splits the same way then home-weak/away-strong is what an NBA originator does, not a "
          "first-half bug.", "",
          "| cut | model takes | bets | win% | ROI | |", "|---|---|---|---|---|---|"]
    sides(fd, fyb, fpo, fpu, (6, 7, 8), "full-game spread", L)
    L += ["",
          f"Blind full-game HOME "
          f"{cell(fyb, fpo, fpu, fd.notna(), True)['roi']:+.2f}% · blind AWAY "
          f"{cell(fyb, fpo, fpu, fd.notna(), False)['roi']:+.2f}%.", ""]

    open(OUT, "a").write("\n".join(L) + "\n")
    print(f"\nappended to {OUT}", flush=True)


if __name__ == "__main__":
    main()
