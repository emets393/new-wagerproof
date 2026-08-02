#!/usr/bin/env python3
"""Confirm the two rules that surfaced in CBB_PANEL_ALL.md, and make the null pay for the search.

TWO CANDIDATES CAME OUT OF THE PANEL RUN, and both were spotted by reading a breakout table AFTER
the fact. That is exactly the situation `nba-blind-sweep-fails` warns about: a per-cell z is priced
for one pre-registered test, not for the best of seven phases picked by eye. So every rule here is
scored twice --

  * the PLAIN z, against nulls that fire the same rule on shuffled targets, and
  * the SELECTION-PAID z, where each null contributes the BEST it achieves across the SAME menu of
    phases the real rule was chosen from. If the real winner does not clear the null's own best
    phase, the phase split is a reading of estimator variance, not a finding.

The second bar is the honest one and it is the one the verdict quotes.

  A. FULL-GAME SPREAD, CONFERENCE PLAY ONLY. The pooled spread rule pays +5.4% at a 2-point cut, but
     the phase table splits hard: CONF_EARLY +12.0%, CONF_LATE +8.4%, NONCONF -0.1%, MTE +0.4%,
     postseason negative. A cheap story for that is "the model needs history and non-conference
     games come first" -- but the ORDER refutes it. CONF_EARLY happens BEFORE CONF_LATE and scores
     BETTER, while MTE (an early-season tournament, non-conference) sits with the dead group despite
     being played at the same time as CONF_EARLY. This file separates the conference FLAG from the
     CALENDAR properly rather than resting on that observation.

  B. FIRST-HALF SPREAD GATED ON THE FULL-GAME SPREAD. `derived-market-gating-law` on a market that
     is not a rotation. The gate response is monotone through its interior -- ungated +2.3%, gate
     >=1 +4.1%, >=2 +5.3%, >=3 +9.1% -- and the two rows above that are on 131 and 42 bets, which is
     noise, not a ceiling. Testing whether the hill survives its own null.

WHAT WOULD KILL EACH ONE. A: the conference effect is really a days-into-season effect, in which
case non-conference games played late score like conference games and the flag adds nothing on top
of the calendar. B: the first-half bets are the full-game bets wearing a different number, in which
case the gated first-half rule adds nothing to simply betting the full-game spread in those games.
Both are measured below.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "CBB_CONFIRM.md")
PHASES = ["NONCONF", "MTE", "CONF_EARLY", "CONF_LATE", "CONF_TOURN", "NCAAT", "POST_OTHER"]


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


cp = _mod("cp", "cbb_panel.py")


def zrow(S, nulls, key, k, mask, lab):
    """Grade one rule and re-measure the IDENTICAL rule on every null walk.

    `nulls` is the full per-market dict from each null walk, so the market key has to be carried in
    -- grading a null of the wrong market would silently compare a first-half rule to a full-game
    null and hand back a z with no meaning.
    """
    g = cp.grade(S["d"], S["yb"], S["po"], S["pu"], k, mask=mask)
    if not g["n"]:
        return None, np.nan
    e = []
    for nl in nulls:
        n = nl[key]
        q = cp.grade(n["d"], n["yb"], n["po"], n["pu"], k, mask=mask)
        e.append(q["win"] - q["base"])
    e = np.array(e, dtype=float)
    mu, sd = np.nanmean(e), np.nanstd(e, ddof=1)
    z = (g["win"] - g["base"] - mu) / sd if sd > 0 else np.nan
    return dict(lab=lab, **g, nmu=mu, nsd=sd, z=z), z


def line(r):
    return (f"| {r['lab']} | {r['n']:,} | {r['win']:.1f} | {r['base']:.1f} | "
            f"**{r['win']-r['base']:+.1f}** | **{r['roi']:+.1f}** | {r['nmu']:+.2f} | "
            f"{r['nsd']:.2f} | **{r['z']:+.2f}** |")


HDR = ("| slice | bets | win% | base% | edge | ROI | null mean | null sd | z |\n"
       "|---|---|---|---|---|---|---|---|---|")


def main():
    P, G, fcols, _ = cp.load()
    preds = cp.fit(P, fcols, cache=cp.PRED)
    real = cp.markets(P, G, preds["fg"][0], preds["h1"][0])
    cp.oracle_check(real)
    nulls = [cp.markets(P, G, preds["fg"][i], preds["h1"][i], preds["fg"][0], preds["h1"][0])
             for i in range(1, cp.NULLS + 1)]

    ph = G["phase"].astype(str)
    conf = pd.to_numeric(G["conferenceGame"], errors="coerce").fillna(0) > 0
    seas = G["season"].astype(str)
    # Days into that season's own schedule -- the control variable for "the model just needs
    # history". Measured per season so a late-starting season is not read as a late-season game.
    doy = G.groupby(seas)["date"].transform(lambda s: (s - s.min()).dt.days)

    L = ["# CBB — confirming the two candidate rules, with the null paying for the search", "",
         "`cbb_confirm.py`. Both rules below were spotted by reading a breakout table after the "
         "panel run, so a plain per-cell z is priced for the wrong test. Each is therefore scored "
         "twice: against nulls firing the identical rule, and against nulls allowed to pick their "
         "own best phase from the same menu. **The second number is the verdict.**", ""]

    # ---------------------------------------------------------------- rule A
    S = real["fg_spread"]
    L += ["## Rule A — full-game spread, conference play only", "",
          "The pooled rule is a 2-point disagreement between the model and the posted spread. The "
          "question is only whether the conference split is real.", "", HDR]
    rows = []
    for lab, m in (("all games", None), ("CONFERENCE", conf), ("non-conference", ~conf)):
        r, _ = zrow(S, nulls, "fg_spread", 2, m, lab)
        if r:
            rows.append(r)
            L.append(line(r))
    L += ["", "### The same split by phase", "", HDR]
    for p in PHASES:
        r, _ = zrow(S, nulls, "fg_spread", 2, ph == p, p)
        if r:
            L.append(line(r))

    # SELECTION-PAID: let each null pick its own best phase from the same menu.
    obs = {}
    for p in PHASES:
        g = cp.grade(S["d"], S["yb"], S["po"], S["pu"], 2, mask=(ph == p))
        if g["n"] >= 200:
            obs[p] = g["win"] - g["base"]
    menu = list(obs)
    best_null = []
    for n in nulls:
        e = [cp.grade(n["fg_spread"]["d"], n["fg_spread"]["yb"], n["fg_spread"]["po"],
                      n["fg_spread"]["pu"], 2, mask=(ph == p)) for p in menu]
        best_null.append(max(x["win"] - x["base"] for x in e))
    bn = np.array(best_null, dtype=float)
    bw = max(obs, key=obs.get)
    zsel = (obs[bw] - bn.mean()) / bn.std(ddof=1)
    L += ["", f"**Selection-paid test.** Best real phase is **{bw}** at {obs[bw]:+.1f} edge. Each "
              f"null was allowed the best of the same {len(menu)} phases and averaged "
              f"{bn.mean():+.2f} (sd {bn.std(ddof=1):.2f}), so the real winner clears its own "
              f"search by **z {zsel:+.2f}**. A phase menu inflates the best cell by about "
              f"{bn.mean():+.1f} points of edge on noise alone — that is the price being paid "
              f"here.", ""]

    # ---- is it the conference FLAG or the CALENDAR? -----------------------------------------
    L += ["### Conference flag, or just later in the season?", "",
          "The cheap story is that the model needs history and non-conference games come first. "
          "Split both ways: if the calendar is doing the work, non-conference games played late "
          "score like conference games, and conference games played early do not.", "", HDR]
    cut = doy.quantile([1 / 3, 2 / 3]).tolist()
    for cl, cm in (("conference", conf), ("non-conference", ~conf)):
        for tl, tm in (("early third", doy <= cut[0]),
                       ("middle third", (doy > cut[0]) & (doy <= cut[1])),
                       ("late third", doy > cut[1])):
            r, _ = zrow(S, nulls, "fg_spread", 2, cm & tm, f"{cl}, {tl}")
            if r:
                L.append(line(r))
    L.append("")

    L += ["### Rule A by season, conference games only", "",
          "Pooled numbers hide a rule that decays.", "", HDR]
    for s in sorted(seas.unique()):
        r, _ = zrow(S, nulls, "fg_spread", 2, conf & (seas == s), s)
        if r and r["n"] >= 50:
            L.append(line(r))
    L += ["", "### Rule A — the ladder inside conference play", "", HDR]
    for k in (1, 1.5, 2, 2.5, 3, 4):
        r, _ = zrow(S, nulls, "fg_spread", k, conf, f"≥{k:g} pts")
        if r:
            L.append(line(r))
    L.append("")

    # ---------------------------------------------------------------- rule B
    H = real["h1_spread"]
    par = real["fg_spread"]["d"].abs()
    L += ["## Rule B — first-half spread, gated on the full-game spread", "",
          "A first half is not a rotation of the game the way a team total is, so this is a real "
          "test of whether the model knows something about the horizon or is only re-expressing "
          "its full-game opinion.", "", HDR]
    for g0 in (0, 1, 2, 3):
        r, _ = zrow(H, nulls, "h1_spread", 2, par >= g0, f"gate ≥{g0}, cut ≥2")
        if r:
            L.append(line(r))
    L += ["", "### Rule B by season, at gate ≥3", "", HDR]
    for s in sorted(seas.unique()):
        r, _ = zrow(H, nulls, "h1_spread", 2, (par >= 3) & (seas == s), s)
        if r and r["n"] >= 50:
            L.append(line(r))

    # ---- is Rule B just Rule A again? --------------------------------------------------------
    hm = H["d"].notna() & H["yb"].notna() & (H["d"].abs() >= 2) & (par >= 3)
    same = np.sign(H["d"][hm]) == np.sign(real["fg_spread"]["d"][hm])
    L += ["", "### Is Rule B just Rule A again?", "",
          f"On the {int(hm.sum()):,} games Rule B fires, the first-half model takes the **same "
          f"side** as the full-game model {100*same.mean():.1f}% of the time. A first-half bet that "
          f"always agrees with the full-game bet is the same position at a different price, not a "
          f"second one — size accordingly.", "", HDR]
    for lab, m in (("B fires and agrees with A", hm & same.reindex(hm.index, fill_value=False)),
                   ("B fires and DISAGREES with A",
                    hm & ~same.reindex(hm.index, fill_value=True))):
        r, _ = zrow(H, nulls, "h1_spread", 2, m, lab)
        if r:
            L.append(line(r))
    L.append("")

    open(OUT, "w").write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {os.path.basename(OUT)}", flush=True)


if __name__ == "__main__":
    main()
