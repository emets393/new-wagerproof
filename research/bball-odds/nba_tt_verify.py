#!/usr/bin/env python3
"""Team totals were the standout in NBA_MARKETS.md. Does the TAIL survive its own scrutiny?

WHAT THE SIX-MARKET RUN SAID. On the repaired stack the home team total scored +2.7 points of
edge at the default cut with a label-shuffle z of +5.01 -- the highest of any NBA market, above
the full-game total's +1.93 -- and unlike the full-game total it showed a monotone ladder:
+2.4 at 0 points of disagreement, +3.4 at 1, +4.6 at 3, +6.8 at 4. Away was the same shape,
weaker (+1.9, z +3.16, +4.5 at the 4-point cut).

WHY THAT IS NOT YET A FINDING, and what this file is for.

1. THE NULL WAS COMPUTED AT THE WRONG PLACE. NBA_MARKETS.md shuffles labels at each market's
   default k, but the edge lives at k>=4, which keeps only a fifth of the slate. A tail cell
   has a wider null than the cell the z was measured on, so quoting +5.01 next to the +6.8
   tail number silently borrows significance from a different bet. Re-run the shuffle AT the
   threshold being claimed.

2. TWO EVALUATED SEASONS, NOT FOUR. 1H/TT prices only exist for three seasons and the
   walk-forward eats the first as training, so "4/4 seasons" is not available here at any
   price. 2/2 is the ceiling of the evidence and must be stated as such -- the standing rule
   in this repo is that pooled results hide late-year decay, and with two seasons the pooled
   number is one season away from being an average of a winner and a loser.

3. THE HOME AND AWAY BETS ARE NOT INDEPENDENT. They are two halves of the same game with a
   shared total, so stacking them is not 2x the sample. Reported separately, and the pooled
   row is labelled as correlated rather than presented as a bigger n.

4. WHICH SIDE IS DOING THE WORK. A model that only ever profits betting overs has found the
   league's scoring drift, not a team's. Split the tail by the side the model actually took.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
NULLS = 20          # at the tail, not at the default cut


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
v3 = _load("v3", "nba_total_v3.py")
v4 = _load("v4", "nba_total_v4.py")
sd = _load("sd", "nba_spread_dims.py")
nets = _load("nets", "nba_matchup_nets.py")
adj = _load("adj", "nba_adj_stats.py")
mk = _load("mk", "nba_markets.py")

SIDES = [
    dict(key="tt_home", name="home team total", y="y_tt_h_resid",
         po="tt_h_o", pu="tt_h_u", line="tt_h"),
    dict(key="tt_away", name="away team total", y="y_tt_a_resid",
         po="tt_a_o", pu="tt_a_u", line="tt_a"),
]
KS = (1.25, 2, 3, 4, 5)
CLAIM_K = 4          # the cut the tail claim is made at


def row(g, tag, extra=""):
    return (f"| {tag} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
            f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |{extra}")


def grade_one_side(yb, po, pu, mask, over):
    """Grade a cell in which the model always takes the SAME side.

    v2.grade uses each cell's own majority side as the baseline, which is right when the model
    picks sides freely but self-referential the moment you condition ON the side it picked: the
    cell's over-rate then IS the win rate and the edge column prints +0.0 on every row. That is
    the same trap that made nba_conc_rule.py report a flat zero. The comparator for a fixed-side
    cell is the LEAGUE rate for that side over every graded game -- "what if I bet overs on
    everything" -- which is the question the cell is actually asking.
    """
    m = mask & yb.notna()
    if m.sum() < 25:
        return None
    win = yb[m] if over else (1 - yb[m])
    dec = (po if over else pu)[m]
    lg = yb.dropna()
    return dict(n=int(m.sum()), win=100 * win.mean(),
                base=100 * (lg.mean() if over else 1 - lg.mean()),
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def main():
    D = sd.build_spread()
    assert D["event_id"].is_unique, "frame has duplicate event_ids"
    D = v3.with_fixed_ratings(D)
    D, themes = v4.dim_features(D)
    D, rblocks = nets.attach(D)
    D, ablocks = adj.attach(D)
    D, mkcols = mk.market_structure(D)

    radj = [c for c in D.columns if c.startswith("radj_") and D[c].notna().mean() > 0.80]
    dims = [c for t in themes.values() for c in t if D[c].notna().mean() > 0.80]
    extra = [c for grp in (rblocks["raw"], rblocks["net"], ablocks["aown"], ablocks["anet"])
             for c in grp
             if c in D.columns and not c.startswith("adjr_") and D[c].notna().mean() > 0.80]
    stack = list(dict.fromkeys(v2.feature_cols(D) + radj + dims + extra + mkcols))

    L = ["# NBA team totals — does the tail hold up?", "",
         "`NBA_MARKETS.md` put the home team total ahead of every other NBA market: +2.7 edge, "
         "label-shuffle z +5.01, and a **monotone ladder** rising to +6.8 at the 4-point cut. "
         "The ladder is the part that matters — a real effect gets stronger when you tighten "
         "the cut, and the full-game total's ladder is flat by comparison.", "",
         "This file re-tests the claim where the claim is actually made. **The z in "
         "`NBA_MARKETS.md` was measured at each market's default cut, not at the tail**, so it "
         "cannot be quoted next to the tail number. Everything below re-runs the shuffle at "
         f"the {CLAIM_K}-point cut, {NULLS} permutations.", "",
         "Two structural limits, stated up front rather than buried: **only two seasons are "
         "evaluable** (1H/TT prices cover three and the walk-forward consumes the first), and "
         "**home and away are not independent bets** — same game, shared total.", ""]

    P, keep = {}, {}
    for S in SIDES:
        y = pd.to_numeric(D[S["y"]], errors="coerce")
        cols = [c for c in stack if c in D.columns and D[c].notna().mean() > 0.60]
        cols = [c for c in cols if c not in mk.leak(D, cols, S["y"], S["line"])]
        yb = pd.Series(np.where(y > 0, 1.0, np.where(y < 0, 0.0, np.nan)), index=D.index)
        po = pd.Series(v2.to_dec(D[S["po"]]), index=D.index)
        pu = pd.Series(v2.to_dec(D[S["pu"]]), index=D.index)
        p = v2.walk(D[cols].astype(float), D["date"], y, kind="ridge")
        P[S["key"]] = (p, yb, po, pu, y, cols)
        print(f"[{S['key']}] {len(cols)} cols, {int(y.notna().sum())} graded", flush=True)

        L += [f"## {S['name']} — ladder, with the null re-measured at each rung", "",
              "| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
              "|---|---|---|---|---|---|---|---|---|"]
        # Shuffle ONCE per side and grade every rung off the same null predictions. The null
        # fit does not depend on k, so re-walking inside the k loop would cost 5x the compute
        # for identical numbers -- and it would also give each rung an independently-drawn
        # null, which makes the z's incomparable across the ladder.
        nulls = []
        rng = np.random.default_rng(20260731)
        for _ in range(NULLS):
            ys = y.copy()
            for s in D["season"].unique():
                m = (D["season"] == s) & y.notna()
                ys.loc[m] = rng.permutation(y.loc[m].values)
            ps = v2.walk(D[cols].astype(float), D["date"], ys, kind="ridge")
            ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=D.index)
            nulls.append((ps, ybs))
        print(f"[{S['key']}] {NULLS} null walks done", flush=True)

        for k in KS:
            g = v2.grade(p, yb, po, pu, k)
            ng = [v2.grade(ps, ybs, po, pu, k) for ps, ybs in nulls]
            ne = np.array([x["win"] - x["base"] for x in ng], dtype=float)
            z = (g["win"] - g["base"] - np.nanmean(ne)) / np.nanstd(ne, ddof=1)
            L.append(row(g, f"≥{k:g}", f" {np.nanmean(ne):+.2f} | {np.nanstd(ne, ddof=1):.2f} "
                                      f"| **{z:+.2f}** |"))
            print(L[-1], flush=True)
        L.append("")

        # season and phase at the claimed cut
        for col, lab in (("season", "season"), ("phase", "phase")):
            L += [f"### {S['name']} — by {lab}, at the {CLAIM_K}-point cut", "",
                  f"| {lab} | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
            order = ("EARLY", "MID", "LATE", "POST") if col == "phase" else None
            for v in (order or sorted(D[col].dropna().unique())):
                g = v2.grade(p, yb, po, pu, CLAIM_K, mask=(D[col] == v))
                if g["n"]:
                    L.append(row(g, v))
                    print(L[-1], flush=True)
            L.append("")

        # which side is the model taking, and does it profit on both?
        L += [f"### {S['name']} — over vs under, at the {CLAIM_K}-point cut", "",
              "A model that only wins betting overs has found the league's scoring drift, not "
              "anything about a team. Baseline here is the **league rate for that same side**, "
              "not the cell's majority — see `grade_one_side`.", "",
              "| model side | bets | win% | league same-side% | edge | ROI |",
              "|---|---|---|---|---|---|"]
        for lab, over in (("model says OVER", True), ("model says UNDER", False)):
            msk = (p > 0) if over else (p < 0)
            g = grade_one_side(yb, po, pu, msk & (p.abs() >= CLAIM_K), over)
            if g:
                L.append(row(g, lab))
                print(L[-1], flush=True)
        L.append("")
        keep[S["key"]] = p

    # correlated pool — both team totals on the same game
    ph, ah = P["tt_home"], P["tt_away"]
    L += ["## Both team totals together — correlated, not a bigger sample", "",
          "These are two bets on one game sharing a total, so this row is **not** independent "
          "evidence and its n should not be read as sample size. It is here to answer one "
          "question: does taking both sides when the model disagrees with both halves of the "
          "same game do better than taking either alone?", "",
          "| cell | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    both = (ph[0].abs() >= CLAIM_K) & (ah[0].abs() >= CLAIM_K)
    for lab, S, T in (("home leg, both legs qualify", SIDES[0], ph),
                      ("away leg, both legs qualify", SIDES[1], ah)):
        g = v2.grade(T[0], T[1], T[2], T[3], CLAIM_K, mask=both)
        if g["n"]:
            L.append(row(g, lab))
            print(L[-1], flush=True)
    # same-direction: model says both teams over (or both under) -> a full-game total view
    same = both & (np.sign(ph[0]) == np.sign(ah[0]))
    for lab, T in (("home leg, both legs same direction", ph),
                   ("away leg, both legs same direction", ah)):
        g = v2.grade(T[0], T[1], T[2], T[3], CLAIM_K, mask=same)
        if g["n"]:
            L.append(row(g, lab))
            print(L[-1], flush=True)

    with open(os.path.join(ROOT, "NBA_TT_VERIFY.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_TT_VERIFY.md", flush=True)


if __name__ == "__main__":
    main()
