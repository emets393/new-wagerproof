#!/usr/bin/env python3
"""Does the team-total market add anything, or is it the total and the spread bet twice?

`nba_tt_orig.py` established that the posted team totals ARE the posted total and spread rotated
(corr +0.9929 / +0.9969), and that construction A -- own points straight off T1 -- pays +7.1% at
>=6 points on 865 team-game bets. That is a real ROI. It is not yet an answer to the owner's
question, because a profitable re-expression of two views we already bet is not a third bet.

THE TEST. For every game we know what the two SETTLED models would do on their own:
    total model  T1 reduced to  (pred_home + pred_away)  vs the posted total, bets at >=8
    spread model CORE reduced to (pred_home - pred_away)/2 + posted spread, bets at >=8
Split the team-total bets by whether either of those two would already have fired. The only bets
that carry NEW risk are the ones in games where NEITHER fires. If the team-total edge lives there,
the market is additive and worth its own slot. If it lives only in games the other two already bet,
it is leverage on an existing position, and the honest thing to do is say so.

Nulls are run on the "neither fires" cell specifically, because that is the load-bearing claim and
it is the smallest slice. The conditioning mask is held FIXED at its real value across nulls -- only
the target is shuffled -- so the null answers "would a model with no signal score this on THESE
games", not "on some other games".
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "NBA_TT_INCREMENTAL.md")
NULLS = 15
T1_CUT = ["raw_box", "rot_flags", "travel"]
CORE_KEEP = ["rapm", "pl_regr"]
HL_TOT, HL_SPR = 180.0, 120.0
OTHER_CUT = 8.0          # the rung both settled full-game models actually bet at
KS = (4, 5, 6)


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

    nulls = [pa.game_shuffle(P, y_pts, np.random.default_rng(20260803 + i)) for i in range(NULLS)]
    print(f"[incr] fitting T1 (points) x{NULLS + 1} ...", flush=True)
    pp = pa.ridge_multi(P[t1].astype(float), P["date"], [y_pts] + nulls, half_life=HL_TOT)
    print("[incr] fitting CORE (margin) ...", flush=True)
    pm = pa.ridge_multi(P[core].astype(float), P["date"], [y_marg], half_life=HL_SPR)[0]

    def pivot(v):
        return P.assign(p=v)[["event_id", "team_row", "p"]].pivot(
            index="event_id", columns="team_row", values="p").reindex(G.index)

    gp, gm = pivot(pp[0]), pivot(pm)
    d_tot = (gp["home"] + gp["away"]) - G["t60_total_point"].astype(float)
    d_spr = (gm["home"] - gm["away"]) / 2.0 + G["t60_spread_home_point"].astype(float)
    bets_tot = P["event_id"].map(d_tot.abs() >= OTHER_CUT).fillna(False).astype(bool)
    bets_spr = P["event_id"].map(d_spr.abs() >= OTHER_CUT).fillna(False).astype(bool)
    neither = ~bets_tot & ~bets_spr

    dA = [p - line for p in pp]
    d = dA[0]

    gradeable = yb.notna()
    L = ["# NBA team totals — is it a third bet or the same two bets again?", "",
         "`nba_tt_incr.py`. Every team-total bet from construction A, split by whether the two "
         "SETTLED full-game models would already have fired on that game at their own >=8-point "
         "rung. Only the games where neither fires carry risk we are not already carrying.", "",
         f"Of {int(gradeable.sum()):,} gradeable team-games, the total model would bet "
         f"{100*bets_tot[gradeable].mean():.0f}% and the spread model "
         f"{100*bets_spr[gradeable].mean():.0f}%; **{100*neither[gradeable].mean():.0f}% are games "
         "neither touches.**", "",
         "| tt cut | which games | bets | win% | base% | ROI |", "|---|---|---|---|---|---|"]

    conds = [("all games", None),
             ("NEITHER model bets", neither),
             ("total model bets it", bets_tot),
             ("spread model bets it", bets_spr),
             ("both bet it", bets_tot & bets_spr)]
    for k in KS:
        for lab, m in conds:
            g = grade(d, yb, po, pu, k, m)
            if g:
                L.append(f"| >={k:g} | {lab} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                         f"**{g['roi']:+.1f}** |")
                print("[cell] " + L[-1], flush=True)
    L.append("")

    # ---- nulls on the load-bearing cell --------------------------------------------------------
    L += ["## The 'neither model bets' cell against nulls", "",
          f"{NULLS} game-level target shuffles, conditioning mask held fixed at its real value.", "",
          "| tt cut | bets | win% | base% | ROI | null mean | null sd | z |",
          "|---|---|---|---|---|---|---|---|"]
    for k in KS:
        g = grade(d, yb, po, pu, k, neither)
        if not g:
            continue
        ne = np.array([(lambda q: q["win"] - q["base"] if q else np.nan)(
            grade(n, yb, po, pu, k, neither)) for n in dA[1:]], dtype=float)
        mu, sd = np.nanmean(ne), np.nanstd(ne, ddof=1)
        z = (g["win"] - g["base"] - mu) / sd if sd and sd > 0 else np.nan
        L.append(f"| >={k:g} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['roi']:+.1f}** | {mu:+.2f} | {sd:.2f} | **{z:+.2f}** |")
        print("[null] " + L[-1], flush=True)
    L.append("")

    # ---- seasons inside the incremental cell ---------------------------------------------------
    L += ["## Seasons inside the incremental cell", "",
          "| tt cut | season | bets | win% | ROI |", "|---|---|---|---|---|"]
    for k in KS:
        for v in sorted(P.loc[gradeable, "season"].dropna().unique()):
            g = grade(d, yb, po, pu, k, neither & (P["season"] == v))
            if g:
                L.append(f"| >={k:g} | {int(v)} | {g['n']:,} | {g['win']:.1f} | "
                         f"**{g['roi']:+.1f}** |")
                print("[season] " + L[-1], flush=True)
    L.append("")

    open(OUT, "w").write("\n".join(L) + "\n")
    print(f"\nwrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
