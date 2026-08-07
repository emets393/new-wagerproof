#!/usr/bin/env python3
"""Team totals on THREE seasons, not two. NBA_TT_VERIFY.md's ceiling was mine, not the data's.

WHAT I GOT WRONG. NBA_TT_VERIFY.md says "only two seasons are evaluable ... 1H/TT prices cover
three and the walk-forward consumes the first", and presents that as a property of the data. Half
of it is true and half is my own parameter leaking into a conclusion:

  * TRUE: team-total prices exist for three seasons only. The Odds API's additional markets start
    2023-05-03, so 2022-23 cannot be bought at any price (event_backfill.py line 35).
  * FALSE: that three seasons of prices only buys two seasons of evaluation. nba_total_v2.MIN_TRAIN
    is 1500 and an NBA season is ~1,276 games, so ONE season cannot fill a training window --
    season 2023 was wholly eaten and the walk could not start until partway through 2024. That
    number was tuned for the full-game total, where four seasons make 1,500 rows cost ~1.2 of
    them. Applied to a three-season target it silently deletes a third of the evidence.

THE FIX IS NOT A SMALLER MIN_TRAIN. Dropping to ~900 rows against 724 columns trades one bias for
a worse one. The real observation is that TRAINING and GRADING do not need the same rows:

  * GRADING needs a posted team-total line and its two prices. Three seasons. Cannot be widened.
  * TRAINING only needs a team's points and something to measure them against -- and the full-game
    market gives that for all FOUR seasons. A total of 220 with the home team -6 implies home 113 /
    away 107 (total/2 -+ spread/2). So fit the model on
        y = actual team points - FG-implied team total
    over 2022-2025, which is 5,108 rows, then at bet time convert the prediction back to a points
    estimate and compare it with the POSTED team total wherever one exists.

That makes season 2023 evaluable: the window now fills inside 2022, which has no team-total prices
to spend anyway. Three graded seasons, and 33% more training rows than the old construction had.

THE DECOMPOSITION THAT HAS TO BE REPORTED. Under this construction the quantity bet is
    d = (FG-implied TT + model residual) - posted TT
      = model residual + (FG-implied TT - posted TT)
The second term contains no model at all -- it is the book disagreeing with itself across two of
its own markets. That is a legitimate pregame signal, but if it carries the whole edge then this is
a market-consistency trade and the feature stack is decoration. So the ladder below is run three
ways: full d, model-only, and line-gap-only. Whichever wins, the claim matches what did the work.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
NULLS = 20
KS = (1.25, 2, 3, 4, 5)
CLAIM_K = 4


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
    dict(key="tt_home", name="home team total", pts="y_home_pts", sign=-1,
         po="tt_h_o", pu="tt_h_u", line="tt_h"),
    dict(key="tt_away", name="away team total", pts="y_away_pts", sign=+1,
         po="tt_a_o", pu="tt_a_u", line="tt_a"),
]


def row(g, tag, extra=""):
    return (f"| {tag} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
            f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |{extra}")


def grade_one_side(yb, po, pu, mask, over):
    """Grade a cell in which the model always takes the SAME side.

    v2.grade uses each cell's own majority side as the baseline, which is right when the model
    picks sides freely but self-referential the moment you condition ON the side it picked: the
    cell's over-rate then IS the win rate and the edge column prints +0.0 on every row. The
    comparator for a fixed-side cell is the LEAGUE rate for that side over every graded game.
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

    # FG-implied team totals. Home spread is negative when the home side is favoured, so the
    # favourite's implied total is total/2 minus half the (negative) spread -- 220 with home -6
    # gives 113/107. Present for all four seasons, which is the whole point.
    half = D["t60_total_point"] / 2.0
    D["impl_tt_h"] = half - D["t60_spread_home_point"] / 2.0
    D["impl_tt_a"] = half + D["t60_spread_home_point"] / 2.0

    radj = [c for c in D.columns if c.startswith("radj_") and D[c].notna().mean() > 0.80]
    dims = [c for t in themes.values() for c in t if D[c].notna().mean() > 0.80]
    extra = [c for grp in (rblocks["raw"], rblocks["net"], ablocks["aown"], ablocks["anet"])
             for c in grp
             if c in D.columns and not c.startswith("adjr_") and D[c].notna().mean() > 0.80]
    stack = list(dict.fromkeys(v2.feature_cols(D) + radj + dims + extra + mkcols))

    gpc = D.groupby("season").size().to_dict()
    tt = {s: int(g["tt_h"].notna().sum()) for s, g in D.groupby("season")}
    L = ["# NBA team totals — the third season", "",
         "`NBA_TT_VERIFY.md` reported two evaluable seasons and called that the ceiling of the "
         "data. It is not. Team-total PRICES cover three seasons (2022-23 predates the Odds "
         "API's additional markets and cannot be bought), but the evaluation only saw two "
         f"because `MIN_TRAIN = 1500` in `nba_total_v2.py` is larger than an NBA season "
         f"(~{int(np.mean(list(gpc.values()))):,} games), so season 2023 was consumed whole.", "",
         "This file separates training from grading. The model is fit on **actual team points "
         "minus the full-game market's implied team total** (`total/2 ∓ spread/2`), which exists "
         "for all four seasons, then converted back to a points estimate and compared with the "
         "**posted** team total wherever one is available. Same bets, three graded seasons "
         "instead of two, and a third more training rows.", "",
         f"Games by season: {gpc}. Posted team totals by season: {tt}.", ""]

    P = {}
    for S in SIDES:
        impl = D["impl_tt_h"] if S["key"] == "tt_home" else D["impl_tt_a"]
        y = pd.to_numeric(D[S["pts"]], errors="coerce") - impl      # 4 seasons of training rows
        D["_y"] = y
        cols = [c for c in stack if c in D.columns and D[c].notna().mean() > 0.60]
        cols = [c for c in cols if c not in mk.leak(D, cols, "_y", S["line"])]

        line = pd.to_numeric(D[S["line"]], errors="coerce")
        pts = pd.to_numeric(D[S["pts"]], errors="coerce")
        yb = pd.Series(np.where(pts > line, 1.0, np.where(pts < line, 0.0, np.nan)), index=D.index)
        po = pd.Series(v2.to_dec(D[S["po"]]), index=D.index)
        pu = pd.Series(v2.to_dec(D[S["pu"]]), index=D.index)
        gap = impl - line                                            # book vs itself, no model

        p = v2.walk(D[cols].astype(float), D["date"], y, kind="ridge")
        d = p + gap                                                  # what is actually bet
        P[S["key"]] = dict(d=d, p=p, gap=gap, yb=yb, po=po, pu=pu, y=y, cols=cols)
        oos = d.corr(pts - line)
        print(f"[{S['key']}] {len(cols)} cols | train rows {int(y.notna().sum())} | "
              f"graded {int(yb.notna().sum())} | oos corr {oos:+.4f}", flush=True)

        L += [f"## {S['name']}", "",
              f"{int(y.notna().sum()):,} training rows (was {int(yb.notna().sum()):,} under the "
              f"old construction), {int(yb.notna().sum()):,} graded bets available, "
              f"out-of-sample correlation with the posted-line residual **{oos:+.4f}**.", "",
              f"### {S['name']} — where the edge comes from, at the {CLAIM_K}-point cut", "",
              "`model + line gap` is the bet. `model only` ignores the book's own FG-vs-TT "
              "disagreement; `line gap only` is that disagreement with no model at all. If the "
              "third row carried it, this would be a market-consistency trade, not a model.", "",
              "| quantity bet | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
        for lab, q in (("model + line gap", d), ("model only", p), ("line gap only", gap)):
            g = v2.grade(q, yb, po, pu, CLAIM_K)
            if g["n"]:
                L.append(row(g, lab))
                print(L[-1], flush=True)
        L.append("")

        # Shuffle ONCE per side and grade every rung off the same null predictions -- the null fit
        # does not depend on k, and re-drawing per rung makes the z's incomparable across the
        # ladder. The line gap is left INTACT in the null: shuffling the labels kills the model's
        # information but must not also destroy the market-consistency term, or the null answers
        # a different question than the bet does.
        nulls = []
        rng = np.random.default_rng(20260801)
        for _ in range(NULLS):
            ys = y.copy()
            for s in D["season"].unique():
                m = (D["season"] == s) & y.notna()
                ys.loc[m] = rng.permutation(y.loc[m].values)
            ps = v2.walk(D[cols].astype(float), D["date"], ys, kind="ridge")
            nulls.append(ps + gap)
        print(f"[{S['key']}] {NULLS} null walks done", flush=True)

        L += [f"### {S['name']} — ladder, null re-measured at each rung", "",
              "| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
              "|---|---|---|---|---|---|---|---|---|"]
        for k in KS:
            g = v2.grade(d, yb, po, pu, k)
            if not g["n"]:
                continue
            ne = np.array([v2.grade(ds, yb, po, pu, k) for ds in nulls], dtype=object)
            ne = np.array([x["win"] - x["base"] for x in ne], dtype=float)
            z = (g["win"] - g["base"] - np.nanmean(ne)) / np.nanstd(ne, ddof=1)
            L.append(row(g, f"≥{k:g}", f" {np.nanmean(ne):+.2f} | {np.nanstd(ne, ddof=1):.2f} "
                                      f"| **{z:+.2f}** |"))
            print(L[-1], flush=True)
        L.append("")

        for col, lab in (("season", "season"), ("phase", "phase")):
            L += [f"### {S['name']} — by {lab}, at the {CLAIM_K}-point cut", "",
                  f"| {lab} | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
            order = ("EARLY", "MID", "LATE", "POST") if col == "phase" else None
            for v in (order or sorted(D[col].dropna().unique())):
                g = v2.grade(d, yb, po, pu, CLAIM_K, mask=(D[col] == v))
                if g["n"]:
                    L.append(row(g, v))
                    print(L[-1], flush=True)
            L.append("")

        L += [f"### {S['name']} — over vs under, at the {CLAIM_K}-point cut", "",
              "Baseline is the **league rate for that same side**, not the cell's own majority — "
              "conditioning on the side the model took makes the majority self-referential and "
              "prints +0.0 on every row.", "",
              "| model side | bets | win% | league same-side% | edge | ROI |",
              "|---|---|---|---|---|---|"]
        for lab, over in (("model says OVER", True), ("model says UNDER", False)):
            msk = (d > 0) if over else (d < 0)
            g = grade_one_side(yb, po, pu, msk & (d.abs() >= CLAIM_K), over)
            if g:
                L.append(row(g, lab))
                print(L[-1], flush=True)
        L.append("")

    # season table across both sides, which is the question the old file got wrong
    L += ["## Verdict — both team totals, all three graded seasons", "",
          f"At the {CLAIM_K}-point cut. `NBA_TT_VERIFY.md` called home 1-of-2 and away 2-of-2 on "
          "a window that never saw season 2023.", "",
          "| market | " + " | ".join(str(s) for s in sorted(D["season"].dropna().unique()))
          + " | seasons positive |",
          "|---|" + "---|" * (len(sorted(D["season"].dropna().unique())) + 1)]
    for S in SIDES:
        T = P[S["key"]]
        cells, pos, tot = [], 0, 0
        for s in sorted(D["season"].dropna().unique()):
            g = v2.grade(T["d"], T["yb"], T["po"], T["pu"], CLAIM_K, mask=(D["season"] == s))
            if not g["n"]:
                cells.append("—")
                continue
            cells.append(f"{g['win']-g['base']:+.1f} edge, {g['roi']:+.1f} ROI")
            tot += 1
            pos += (g["win"] - g["base"]) > 0
        L.append(f"| {S['name']} | " + " | ".join(cells) + f" | **{pos} of {tot}** |")
        print(L[-1], flush=True)

    with open(os.path.join(ROOT, "NBA_TT_FULL.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_TT_FULL.md", flush=True)


if __name__ == "__main__":
    main()
