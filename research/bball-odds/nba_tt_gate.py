#!/usr/bin/env python3
"""Where should the GATE sit? Two different thresholds got conflated and both need measuring.

There are two independent cuts in a gated team-total rule and they are not the same number:

  TT CUT    how far the predicted team points sit from the POSTED TEAM TOTAL. This is what
            decides whether a given team row is a bet at all. Ladder in NBA_TT_ORIG.md.
  GATE      how far the FULL-GAME total model sits from the POSTED GAME TOTAL. This does not
            select the bet, it selects the GAME the bet is allowed to live in.

`nba_tt_incr.py` hardcoded GATE = 8 because that is the rung the full-game total model ships at.
That was inherited, not measured -- the same mistake as inheriting a half-life. A gate of 8 keeps
573 bets at +13.1%; a looser gate would keep more. Nobody has checked whether it still pays.

This sweeps the full grid. Ungated is the GATE = 0 row, so the ungated ladder the owner is
pointing at (>=5 pays +5.0% on 1,429 bets) appears in the table as a row rather than as a rival
claim. Nulls are then run on the whole grid at fixed masks so a cell that only looks good because
it is small gets caught.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "NBA_TT_GATE.md")
NULLS = 15
T1_CUT = ["raw_box", "rot_flags", "travel"]
CORE_KEEP = ["rapm", "pl_regr"]
HL_TOT, HL_SPR = 180.0, 120.0
GATES = (0.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0)
KS = (3.0, 4.0, 5.0, 6.0)


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def grade(d, yb, po, pu, k, mask=None):
    ok = d.notna() & yb.notna() & po.notna() & pu.notna() & (d.abs() >= k)
    if mask is not None:
        ok = ok & mask
    if ok.sum() < 30:
        return None
    over = d[ok] > 0
    win = np.where(over, yb[ok], 1 - yb[ok])
    dec = np.where(over, po[ok], pu[ok])
    base = max(yb[ok].mean(), 1 - yb[ok].mean())
    return dict(n=int(ok.sum()), win=100 * win.mean(), base=100 * base,
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def main():
    pr = _mod("pr", "nba_prune.py")
    pa, P, G, cols = pr.load()
    fam = pd.Series({c: pr.famof(c) for c in cols})
    sgn = pd.Series(np.where(P["team_row"] == "home", 1.0, -1.0), index=P.index)

    line = P["line"].astype(float)
    po = pd.Series(pa.v2.to_dec(P["po"]), index=P.index)
    pu = pd.Series(pa.v2.to_dec(P["pu"]), index=P.index)
    resid = P["pts"].astype(float) - line
    yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=P.index)
    assert grade(resid, yb, po, pu, 0)["win"] > 99.5, "grader sign inverted"

    t1 = [c for c in cols if fam[c] not in T1_CUT]
    core = [c for c in cols if fam[c] in CORE_KEEP]
    y_pts = P["pts"].astype(float)
    y_marg = pd.Series(P["event_id"].map(G["y_fg_margin"]).astype(float).values,
                       index=P.index) * sgn

    nulls = [pa.game_shuffle(P, y_pts, np.random.default_rng(20260804 + i)) for i in range(NULLS)]
    print(f"[gate] fitting T1 x{NULLS + 1} ...", flush=True)
    pp = pa.ridge_multi(P[t1].astype(float), P["date"], [y_pts] + nulls, half_life=HL_TOT)
    print("[gate] fitting CORE ...", flush=True)
    pm = pa.ridge_multi(P[core].astype(float), P["date"], [y_marg], half_life=HL_SPR)[0]

    def pivot(v):
        return P.assign(p=v)[["event_id", "team_row", "p"]].pivot(
            index="event_id", columns="team_row", values="p").reindex(G.index)

    gp, gm = pivot(pp[0]), pivot(pm)
    # The gate is measured on the REAL fit only and then held fixed across nulls -- it selects
    # games, and shuffling the target must not be allowed to re-select which games qualify.
    d_tot = (gp["home"] + gp["away"]) - G["t60_total_point"].astype(float)
    d_spr = (gm["home"] - gm["away"]) / 2.0 + G["t60_spread_home_point"].astype(float)
    dA = [p - line for p in pp]
    d = dA[0]

    L = ["# NBA team totals — where the gate goes", "",
         "`nba_tt_gate.py`. Two thresholds, swept independently.", "",
         "* **TT cut** — predicted team points vs the POSTED TEAM TOTAL. Picks the bet.",
         "* **Gate** — the full-game total model vs the POSTED GAME TOTAL. Picks the GAME the bet "
         "is allowed to live in. **Gate 0 is ungated**, i.e. the plain ladder.", "",
         "ROI first, bet count in brackets. The gate=0 row is the ungated ladder for reference.",
         ""]

    for gate_on, gate_lab in ((d_tot, "total model"), (pd.concat([d_tot.abs(), d_spr.abs()],
                                                                 axis=1).max(axis=1),
                                                       "either model (max of the two)")):
        L += [f"## Gate on the {gate_lab}", "",
              "| gate | " + " | ".join(f"TT ≥{k:g}" for k in KS) + " |",
              "|---|" + "---|" * len(KS)]
        for gt in GATES:
            m = None if gt == 0 else P["event_id"].map(
                gate_on.abs() >= gt).fillna(False).astype(bool)
            cells = []
            for k in KS:
                g = grade(d, yb, po, pu, k, m)
                cells.append(f"**{g['roi']:+.1f}** ({g['n']:,})" if g else "—")
            L.append(f"| ≥{gt:g}{' (ungated)' if gt == 0 else ''} | " + " | ".join(cells) + " |")
            print(f"[{gate_lab}] " + L[-1], flush=True)
        L.append("")

    # ---- nulls + seasons on the shortlist ------------------------------------------------------
    short = [(0.0, 5.0), (0.0, 6.0), (3.0, 4.0), (4.0, 4.0), (4.0, 5.0),
             (5.0, 4.0), (5.0, 5.0), (6.0, 4.0), (8.0, 4.0), (8.0, 5.0), (8.0, 6.0)]
    L += ["## Shortlist against nulls, and per season", "",
          f"{NULLS} game-level target shuffles; the gate mask is held fixed at its real value.", "",
          "| gate | TT cut | bets | win% | base% | ROI | z | 2023 | 2024 | 2025 |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for gt, k in short:
        m = None if gt == 0 else P["event_id"].map(
            d_tot.abs() >= gt).fillna(False).astype(bool)
        g = grade(d, yb, po, pu, k, m)
        if not g:
            continue
        ne = np.array([(lambda q: q["win"] - q["base"] if q else np.nan)(
            grade(n, yb, po, pu, k, m)) for n in dA[1:]], dtype=float)
        mu, sd = np.nanmean(ne), np.nanstd(ne, ddof=1)
        z = (g["win"] - g["base"] - mu) / sd if sd and sd > 0 else np.nan
        yr = []
        for v in (2023, 2024, 2025):
            sm = (P["season"] == v) if m is None else (m & (P["season"] == v))
            q = grade(d, yb, po, pu, k, sm)
            yr.append(f"{q['roi']:+.1f} ({q['n']:,})" if q else "—")
        L.append(f"| ≥{gt:g}{'' if gt else ' (ungated)'} | ≥{k:g} | {g['n']:,} | {g['win']:.1f} | "
                 f"{g['base']:.1f} | **{g['roi']:+.1f}** | **{z:+.2f}** | " + " | ".join(yr) + " |")
        print("[short] " + L[-1], flush=True)
    L.append("")

    open(OUT, "w").write("\n".join(L) + "\n")
    print(f"\nwrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
