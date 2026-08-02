#!/usr/bin/env python3
"""The 1H markets on THREE seasons, under the same anchor fix as nba_tt_full.py.

NBA_MARKETS.md reported the first-half spread at -0.7 edge and the first-half total at -0.1, and
concluded "the data was not their problem, so the fix for them is construction, not features."
That conclusion was drawn on the same truncated window as the team-total one: 1H prices cover
three seasons, MIN_TRAIN = 1500 exceeds an NBA season, so season 2023 was consumed as training and
never graded. Both season tables in that file show 2024 and 2025 only.

Same repair. Grading needs a posted 1H line and cannot be widened past three seasons, but training
only needs the first-half box score and something to measure it against -- and the FULL-GAME line
supplies that for all four. A first-half line is very close to a fixed fraction of the full-game
line (posted 1H total / FG total: mean 0.5017, sd 0.0127 across 3,831 games), so:

    implied 1H total  = s_tot * FG total
    implied 1H spread = s_sp  * FG home spread

with both scale factors estimated AS OF each game by expanding least squares through the origin --
no season-final ratio leaking back into October. Fit on (first-half result - implied line) over
2022-2025, convert back, compare with the POSTED 1H line wherever there is one.

As in nba_tt_full.py the bet decomposes into model + (implied line - posted line), and the second
term is the book disagreeing with itself across its own full-game and first-half markets. Both are
reported separately so the claim matches whichever did the work.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
NULLS = 20
KS = (1, 1.5, 2, 3, 4)
CLAIM_K = 2


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


def asof_slope(x, y):
    """Least squares through the origin, expanding and shifted -- the scale factor a bettor could
    have known before the game. Pooled across seasons on purpose: the first-half share of a game
    is a league constant, and re-estimating it per season would hand October a two-game sample."""
    num = (x * y).expanding().sum().shift(1)
    den = (x * x).expanding().sum().shift(1)
    return (num / den.replace(0, np.nan)).bfill()


MARKETS = [
    dict(key="h1_spread", name="first-half spread",
         # resid convention matches build_nba_features: margin + home spread, positive = home cover
         res=lambda D, imp: D["y_h1_margin"] + imp,
         # The slope is fit margin-on-spread, so it comes out NEGATIVE (~-0.58): a home favourite
         # carries a negative spread and a positive margin. A LINE has to be quoted in the posted
         # convention -- negative when the home side is laying -- so the implied first-half spread
         # is -s * FG spread, not s * FG spread. Left unflipped this hands a -6 home favourite an
         # implied 1H line of +3.5 instead of -3.5 and poisons both the target and the line gap.
         imp=lambda D, s: -s * D["t60_spread_home_point"],
         fgx="t60_spread_home_point", fgy="y_h1_margin", floor=0.85,
         gap=lambda D, imp: D["h1_spread"] - imp,
         yb=lambda D: D["y_h1_margin"] + D["h1_spread"],
         po="h1_sp_h", pu="h1_sp_a", line="h1_spread",
         over="model says HOME", under="model says AWAY"),
    dict(key="h1_total", name="first-half total",
         res=lambda D, imp: D["y_h1_total"] - imp,
         imp=lambda D, s: s * D["t60_total_point"],
         # Looser floor than the spread on purpose. A first-half total is posted in whole or
         # half points off a ~110 number, and its share of the full-game total genuinely moves
         # with pace expectations, so a derived version tops out near +0.85 even when it is
         # perfectly correct. The spread rides at +0.99 because 1H spreads are near-exactly half.
         # The guard is a sign-and-scale check, not a precision check.
         fgx="t60_total_point", fgy="y_h1_total", floor=0.70,
         gap=lambda D, imp: imp - D["h1_total_line"],
         yb=lambda D: D["y_h1_total"] - D["h1_total_line"],
         po="h1_ov", pu="h1_un", line="h1_total_line",
         over="model says OVER", under="model says UNDER"),
]


def row(g, tag, extra=""):
    return (f"| {tag} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
            f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |{extra}")


def grade_one_side(yb, po, pu, mask, over):
    """League same-side baseline. The cell's own majority is self-referential once you condition
    on the side the model took, and prints +0.0 on every row."""
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

    L = ["# NBA first-half markets — the third season", "",
         "`NBA_MARKETS.md` graded both 1H markets on two seasons and concluded the data was not "
         "their problem. That was measured on a window `MIN_TRAIN = 1500` had truncated: 1H "
         "prices cover three seasons, and one NBA season (~1,276 games) cannot fill a 1,500-row "
         "training set, so season 2023 was consumed whole.", "",
         "Here the model trains on **the first-half result minus a full-game-implied first-half "
         "line** over all four seasons, with the scale factor fit as-of by expanding least "
         "squares through the origin, then grades against the **posted** 1H line. Three graded "
         "seasons, a third more training rows.", ""]

    for M in MARKETS:
        s = asof_slope(pd.to_numeric(D[M["fgx"]], errors="coerce").fillna(0),
                       pd.to_numeric(D[M["fgy"]], errors="coerce").fillna(0))
        imp = M["imp"](D, s)
        # A derived line must track the posted one. This assert exists because the spread slope
        # comes out negative and the first version of this file forgot to flip it, which produced
        # an implied line of the wrong sign that still ran end-to-end and printed plausible tables.
        post = pd.to_numeric(D[M["line"]], errors="coerce")
        chk = imp.corr(post)
        bias = (imp - post).mean()
        print(f"[{M['key']}] implied vs posted line corr {chk:+.4f} | mean offset "
              f"{bias:+.2f} pts", flush=True)
        assert chk > M["floor"], \
            f"{M['key']}: implied line does not track the posted line ({chk:+.3f})"
        # A sign flip survives a correlation check on a symmetric market but shows up here as a
        # large offset, so both are asserted.
        assert abs(bias) < 1.5, f"{M['key']}: implied line is offset {bias:+.2f} pts from posted"
        y = M["res"](D, imp)
        D["_y"] = y
        cols = [c for c in stack if c in D.columns and D[c].notna().mean() > 0.60]
        cols = [c for c in cols if c not in mk.leak(D, cols, "_y", M["line"])]

        r = M["yb"](D)
        yb = pd.Series(np.where(r > 0, 1.0, np.where(r < 0, 0.0, np.nan)), index=D.index)
        po = pd.Series(v2.to_dec(D[M["po"]]), index=D.index)
        pu = pd.Series(v2.to_dec(D[M["pu"]]), index=D.index)
        gap = M["gap"](D, imp)

        p = v2.walk(D[cols].astype(float), D["date"], y, kind="ridge")
        d = p + gap
        print(f"[{M['key']}] slope {s.iloc[-1]:.4f} | {len(cols)} cols | train "
              f"{int(y.notna().sum())} | graded {int(yb.notna().sum())} | oos corr "
              f"{d.corr(r):+.4f}", flush=True)

        L += [f"## {M['name']}", "",
              f"As-of scale factor converged to **{s.iloc[-1]:.4f}** of the full-game line. "
              f"{int(y.notna().sum()):,} training rows against {int(yb.notna().sum()):,} under "
              f"the old construction; out-of-sample correlation with the posted-line residual "
              f"**{d.corr(r):+.4f}**.", "",
              f"### {M['name']} — where the edge comes from, at the {CLAIM_K}-point cut", "",
              "| quantity bet | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
        for lab, q in (("model + line gap", d), ("model only", p), ("line gap only", gap)):
            g = v2.grade(q, yb, po, pu, CLAIM_K)
            if g["n"]:
                L.append(row(g, lab))
                print(L[-1], flush=True)
        L.append("")

        nulls = []
        rng = np.random.default_rng(20260801)
        for _ in range(NULLS):
            ys = y.copy()
            for ssn in D["season"].unique():
                m = (D["season"] == ssn) & y.notna()
                ys.loc[m] = rng.permutation(y.loc[m].values)
            nulls.append(v2.walk(D[cols].astype(float), D["date"], ys, kind="ridge") + gap)
        print(f"[{M['key']}] {NULLS} null walks done", flush=True)

        L += [f"### {M['name']} — ladder, null re-measured at each rung", "",
              "| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
              "|---|---|---|---|---|---|---|---|---|"]
        for k in KS:
            g = v2.grade(d, yb, po, pu, k)
            if not g["n"]:
                continue
            ne = np.array([v2.grade(ds, yb, po, pu, k)["win"]
                           - v2.grade(ds, yb, po, pu, k)["base"] for ds in nulls], dtype=float)
            z = (g["win"] - g["base"] - np.nanmean(ne)) / np.nanstd(ne, ddof=1)
            L.append(row(g, f"≥{k:g}", f" {np.nanmean(ne):+.2f} | {np.nanstd(ne, ddof=1):.2f} "
                                      f"| **{z:+.2f}** |"))
            print(L[-1], flush=True)
        L.append("")

        for col, lab in (("season", "season"), ("phase", "phase")):
            L += [f"### {M['name']} — by {lab}, at the {CLAIM_K}-point cut", "",
                  f"| {lab} | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
            order = ("EARLY", "MID", "LATE", "POST") if col == "phase" else None
            for v in (order or sorted(D[col].dropna().unique())):
                g = v2.grade(d, yb, po, pu, CLAIM_K, mask=(D[col] == v))
                if g["n"]:
                    L.append(row(g, v))
                    print(L[-1], flush=True)
            L.append("")

        L += [f"### {M['name']} — which side, at the {CLAIM_K}-point cut", "",
              "Baseline is the league rate for that same side.", "",
              "| model side | bets | win% | league same-side% | edge | ROI |",
              "|---|---|---|---|---|---|"]
        for lab, over in ((M["over"], True), (M["under"], False)):
            msk = (d > 0) if over else (d < 0)
            g = grade_one_side(yb, po, pu, msk & (d.abs() >= CLAIM_K), over)
            if g:
                L.append(row(g, lab))
                print(L[-1], flush=True)
        L.append("")

    with open(os.path.join(ROOT, "NBA_H1_FULL.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_H1_FULL.md", flush=True)


if __name__ == "__main__":
    main()
