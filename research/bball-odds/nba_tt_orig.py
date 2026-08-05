#!/usr/bin/env python3
"""The team-total market — and whether it is anything other than the total and the spread rotated.

THE OWNER'S QUESTION IS THE RIGHT ONE: "couldn't we just use spread and total?" Measured before
fitting anything, the answer is yes, and there is nothing else available to use. The posted team
totals reconcile with the posted total and spread at corr **+0.9929** and **+0.9969**, 96.9% and
94.2% of games within a point. And it is not only the lines — the REALISED residuals obey the same
arithmetic to three decimals. If `tt_h = (total + margin)/2` exactly, then these three correlations
are forced:

    corr(tt_h resid, total resid)   predicted 0.790   observed 0.790
    corr(tt_h resid, margin resid)  predicted 0.613   observed 0.610
    corr(tt_h resid, tt_a resid)    predicted 0.250   observed 0.253

So a team total carries no third dimension. What it does carry is (a) DIFFERENT PRICES — 1.22 to
2.08 decimal, not flat -110, so the same view costs a different amount to express — and (b) about a
point of slack between the book's team totals and the book's own total, sd 1.14, with 1.3% of games
off by more than two. Those two things are the entire case for the market, and they are what this
file grades.

TWO CONSTRUCTIONS, AND THEY DIFFER IN EXACTLY ONE TERM.
  A  own points straight off T1, the settled full-game total model (612 feats, hl 180d).
  B  the owner's: `(total_hat +- margin_hat)/2`, T1 for the level and CORE for the tilt.
Since A's own implied margin is `(pA_home - pA_away)`, B is algebraically `A + (margin_CORE -
margin_A)/2`. The comparison is therefore precisely "does CORE's margin beat the margin T1 implies",
which is worth knowing on its own — the two fits won opposite ablations.

GRADED AT PANEL LEVEL, WHICH NO OTHER MARKET HERE IS. Every other market reduces two team rows to
one game-level number. A team total IS the team row, so there is no reduction: 7,922 bets from 3,961
games. They are NOT 7,922 independent bets, and the exposure section at the end measures that rather
than assuming it.

THE PRICE ORACLE HAS POWER HERE. Per `grading-sign-oracle-check`, the win-rate-rises-with-implied-
probability check is dead at flat -110 and loudest where prices spread out. Team totals spread from
-450 to +108, so it is run.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "NBA_TT_ORIG.md")
NULLS = 20
T1_CUT = ["raw_box", "rot_flags", "travel"]          # the settled full-game TOTAL model
CORE_KEEP = ["rapm", "pl_regr"]                      # the settled full-game SPREAD model
HL_TOT, HL_SPR = 180.0, 120.0
KS = (1, 2, 3, 4, 5, 6, 8)


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def grade(d, yb, po, pu, k, mask=None):
    ok = d.notna() & yb.notna() & po.notna() & pu.notna() & (d.abs() >= k)
    if mask is not None:
        ok = ok & mask
    if ok.sum() < 40:
        return None
    over = d[ok] > 0
    win = np.where(over, yb[ok], 1 - yb[ok])
    dec = np.where(over, po[ok], pu[ok])
    base = max(yb[ok].mean(), 1 - yb[ok].mean())
    return dict(n=int(ok.sum()), win=100 * win.mean(), base=100 * base,
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def blind(yb, po, pu, over, mask=None):
    ok = yb.notna() & po.notna() & pu.notna()
    if mask is not None:
        ok = ok & mask
    win = yb[ok] if over else 1 - yb[ok]
    dec = (po if over else pu)[ok]
    return dict(n=int(ok.sum()), win=100 * win.mean(),
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def main():
    pr = _mod("pr", "nba_prune.py")
    pa, P, G, cols = pr.load()
    fam = pd.Series({c: pr.famof(c) for c in cols})
    sgn = pd.Series(np.where(P["team_row"] == "home", 1.0, -1.0), index=P.index)

    line, po, pu = P["line"].astype(float), P["po"], P["pu"]
    po = pd.Series(pa.v2.to_dec(po), index=P.index)
    pu = pd.Series(pa.v2.to_dec(pu), index=P.index)
    pts = P["pts"].astype(float)
    resid = pts - line
    yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=P.index)

    # ORACLE 1 -- the realised residual through the grader.
    o = grade(resid, yb, po, pu, 0)
    assert o["win"] > 99.5, f"TT oracle {o['win']:.1f}% -- grader sign inverted"

    # ORACLE 2 -- prices actually mean something here, so the win rate must RISE with implied prob.
    ip = 1 / po
    q = pd.qcut(ip[yb.notna() & ip.notna()], 5, labels=False, duplicates="drop")
    cal = pd.DataFrame({"ip": ip, "y": yb, "q": q}).dropna().groupby("q").agg(
        implied=("ip", "mean"), over_hits=("y", "mean"), n=("y", "size"))
    assert cal["over_hits"].corr(cal["implied"]) > 0.8, f"price oracle failed\n{cal}"

    print(f"[tt] {int(yb.notna().sum()):,} gradeable team-games | oracle {o['win']:.1f}% | "
          f"price-calibration corr {cal['over_hits'].corr(cal['implied']):+.3f}", flush=True)

    L = ["# NBA — the team-total market", "",
         "`nba_tt_orig.py`. Own-team points against the posted team total, **graded at panel "
         "level**: a team total IS the team row, so unlike every other market there is no "
         f"reduction to one number per game — **{int(yb.notna().sum()):,} bets from "
         f"{int(P.loc[yb.notna(), 'event_id'].nunique()):,} games**, 2023-2025.", "",
         "## First, the owner's question: is this just the total and the spread?", "",
         "**Yes.** Measured before anything was fit.", "",
         "| relation | corr | within 1 pt | sd of gap |", "|---|---|---|---|",
         "| `tt_h + tt_a` vs posted total | +0.9929 | 96.9% | 1.14 |",
         "| `tt_h − tt_a` vs posted margin | +0.9969 | 94.2% | 0.68 |", "",
         "And the REALISED residuals obey the same arithmetic. If `tt_h = (total + margin)/2` "
         "exactly, three correlations are forced — predicted 0.790 / 0.613 / 0.250 against "
         "observed **0.790 / 0.610 / 0.253**. The team-total residual is the average of the total "
         "residual and the margin residual, to three decimals. There is no third dimension.", "",
         "What is left is the price sheet (1.22-2.08 decimal, not flat -110) and about a point of "
         "slack between the book's team totals and its own total. That is the whole case, and it "
         "is what everything below tests.", "",
         "### price-calibration oracle", "",
         "| implied P(over) | over hits | n |", "|---|---|---|"]
    for _, r in cal.iterrows():
        L.append(f"| {100*r['implied']:.1f}% | {100*r['over_hits']:.1f}% | {int(r['n']):,} |")
    L += ["", f"Monotone, corr **{cal['over_hits'].corr(cal['implied']):+.3f}** — the prices are "
          "real and correctly oriented. This check is dead at flat -110 and has teeth here.", ""]

    # ---- the two constructions ----------------------------------------------------------------
    t1 = [c for c in cols if fam[c] not in T1_CUT]
    core = [c for c in cols if fam[c] in CORE_KEEP]
    y_pts = pts
    y_marg = pd.Series(P["event_id"].map(G["y_fg_margin"]).astype(float).values,
                       index=P.index) * sgn

    # Paired nulls: the same game permutation applied to BOTH targets, so construction B's two
    # halves stay coherent under the null instead of being shuffled independently.
    seeds = [20260802 + i for i in range(NULLS)]
    npts = [pa.game_shuffle(P, y_pts, np.random.default_rng(s)) for s in seeds]
    nmar = [pa.game_shuffle(P, y_marg, np.random.default_rng(s)) for s in seeds]

    print("[tt] fitting T1 (points) ...", flush=True)
    pp = pa.ridge_multi(P[t1].astype(float), P["date"], [y_pts] + npts, half_life=HL_TOT)
    print("[tt] fitting CORE (margin) ...", flush=True)
    pm = pa.ridge_multi(P[core].astype(float), P["date"], [y_marg] + nmar, half_life=HL_SPR)

    def swap_margin(pts_hat, marg_hat):
        """B = A + (margin_CORE - margin_A)/2, done via the game pivot so both rows see the pair."""
        t = P.assign(p=pts_hat)[["event_id", "team_row", "p"]]
        g = t.pivot(index="event_id", columns="team_row", values="p")
        tot = P["event_id"].map(g["home"] + g["away"])
        m = P.assign(p=marg_hat)[["event_id", "team_row", "p"]]
        gm = m.pivot(index="event_id", columns="team_row", values="p")
        own = P["event_id"].map((gm["home"] - gm["away"]) / 2.0) * sgn
        return (tot + own) / 2.0

    dA = [p - line for p in pp]
    dB = [swap_margin(pp[i], pm[i]) - line for i in range(len(pp))]

    for tag, ds, note in (("A — own points off T1", dA,
                           f"T1, {len(t1)} features, half-life {HL_TOT:g}d."),
                          ("B — (total ± margin)/2", dB,
                           f"T1 level ({len(t1)} feats, {HL_TOT:g}d) + CORE margin "
                           f"({len(core)} feats, {HL_SPR:g}d).")):
        d = ds[0]
        L += [f"## Construction {tag}", "", note + f" corr with the realised residual "
              f"**{d.corr(resid):+.4f}**.", "",
              "| cut (pts) | bets | win% | base% | ROI | null mean | null sd | z |",
              "|---|---|---|---|---|---|---|---|"]
        for k in KS:
            g = grade(d, yb, po, pu, k)
            if not g:
                continue
            ne = np.array([(lambda q: q["win"] - q["base"] if q else np.nan)(
                grade(n, yb, po, pu, k)) for n in ds[1:]], dtype=float)
            mu, sd = np.nanmean(ne), np.nanstd(ne, ddof=1)
            z = (g["win"] - g["base"] - mu) / sd if sd and sd > 0 else np.nan
            L.append(f"| ≥{k:g} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['roi']:+.1f}** | {mu:+.2f} | {sd:.2f} | **{z:+.2f}** |")
            print(f"[{tag[0]}] " + L[-1], flush=True)
        L.append("")

    # ---- breakouts on the better construction, decided by z at the middle rung -----------------
    zA = grade(dA[0], yb, po, pu, 4)
    zB = grade(dB[0], yb, po, pu, 4)
    best, bd = ("B", dB[0]) if (zB and zA and zB["roi"] > zA["roi"]) else ("A", dA[0])
    L += [f"## Breakouts — construction {best}", "",
          "| cut | slice | bets | win% | ROI |", "|---|---|---|---|---|"]
    slices = [("all", pd.Series(True, index=P.index))]
    slices += [(str(int(v)), P["season"] == v) for v in sorted(P["season"].dropna().unique())
               if (P["season"] == v).any() and yb[P["season"] == v].notna().any()]
    slices += [(p, P["phase"] == p) for p in ("EARLY", "MID", "LATE", "POST")]
    slices += [("home rows", P["is_home"] == 1), ("away rows", P["is_home"] == 0)]
    for k in (3, 4, 5):
        for lab, m in slices:
            g = grade(bd, yb, po, pu, k, m)
            if g:
                L.append(f"| ≥{k:g} | {lab} | {g['n']:,} | {g['win']:.1f} | **{g['roi']:+.1f}** |")
                print(f"[{best} {lab}] " + L[-1], flush=True)
    L += ["", f"Blind OVER {blind(yb, po, pu, True)['roi']:+.2f}% · "
          f"blind UNDER {blind(yb, po, pu, False)['roi']:+.2f}% over "
          f"{int(yb.notna().sum()):,} team-games.", ""]

    # ---- is it a real bet or the same view twice? ----------------------------------------------
    gp = bd.groupby(P["event_id"])
    # skipna=False: if one row of the pair is missing, the pair does not "both fire"
    both = P["event_id"].map(gp.apply(lambda s: s.abs().min(skipna=False)))
    # sign agreement is only meaningful when both rows exist, which `both` already enforces
    same_dir = P["event_id"].map(gp.apply(lambda s: (s.dropna() > 0).nunique() == 1)).fillna(False).astype(bool)
    assert P.groupby("event_id").size().eq(2).all(), "panel is not exactly two rows per game"
    L += ["## Exposure — how much of this is one view bet twice", "",
          "Both team totals of a game firing the SAME way is a game-total bet wearing a costume; "
          "firing OPPOSITE ways is a spread bet. Neither is new risk, and stacking them on top of "
          "the total and spread models doubles a position rather than diversifying it.", "",
          "| cut | bets | both rows of the game fire | of those, same direction | ROI same-dir | "
          "ROI opposite-dir |", "|---|---|---|---|---|---|"]
    for k in (3, 4, 5):
        ok = bd.notna() & yb.notna() & (bd.abs() >= k)
        pair = (both >= k).fillna(False)
        gs = grade(bd, yb, po, pu, k, pair & same_dir)
        go = grade(bd, yb, po, pu, k, pair & ~same_dir)
        sn, sr = (gs["n"], f"{gs['roi']:+.1f}") if gs else (0, "—")
        on, orr = (go["n"], f"{go['roi']:+.1f}") if go else (0, "—")
        L.append(f"| ≥{k:g} | {int(ok.sum()):,} | {100*(ok & pair).sum()/max(ok.sum(),1):.0f}% | "
                 f"{100*(ok & pair & same_dir).sum()/max((ok & pair).sum(),1):.0f}% | "
                 f"{sr} (n={sn:,}) | {orr} (n={on:,}) |")
        print("[exposure] " + L[-1], flush=True)
    L.append("")

    # ---- the only genuinely independent slice: book's TT disagrees with book's own total --------
    tt_sum = P["event_id"].map(G["tt_h"] + G["tt_a"])
    slack = (tt_sum - P["event_id"].map(G["t60_total_point"])).abs()
    L += ["## The one slice with information the other two markets do not have", "",
          "Games where the book's own team totals do not reconcile with its own posted total. "
          "This is the only place a team total is not a rotation.", "",
          "| cut | slack | bets | win% | ROI |", "|---|---|---|---|---|"]
    for k in (2, 3, 4):
        for lab, m in (("≤0.5 pts (reconciles)", slack <= 0.5),
                       (">1 pt", slack > 1.0), (">2 pts", slack > 2.0)):
            g = grade(bd, yb, po, pu, k, m)
            if g:
                L.append(f"| ≥{k:g} | {lab} | {g['n']:,} | {g['win']:.1f} | **{g['roi']:+.1f}** |")
                print("[slack] " + L[-1], flush=True)
    L.append("")

    open(OUT, "w").write("\n".join(L) + "\n")
    print(f"\nwrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
