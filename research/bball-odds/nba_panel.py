#!/usr/bin/env python3
"""One row per TEAM-GAME, not one row per game. The layout everything else should have used.

THE MISTAKE THIS FIXES. Every NBA model in this directory sits on a frame of 5,108 rows, one per
game, with each team stat present twice under an `h_` and an `a_` prefix. Team totals were then
built as TWO SEPARATE FITS on that frame -- one targeting home points, one targeting away points.

That is not a modelling choice, it is a bug with a plausible face on it:

  * "A team funnelling possessions through one creator scores more" is ONE relationship. The home
    fit learns it in the `h_` columns; the away fit has to relearn the identical thing from
    scratch in the `a_` columns. Two independent estimates of one effect, 5,108 rows each.
  * Two independent estimates differ by chance, so the two sides print different edges (+3.8 away
    vs +2.4 home in NBA_TT_FULL.md) with no basketball reason behind the gap. Reading that split
    as a finding -- "away team totals are the keeper" -- is reading estimator variance.
  * The two fits are different functions, so home pred + away pred is not a coherent full-game
    total and home pred - away pred is not a coherent spread. Six markets were being fit as six
    unrelated regressions when five of them are arithmetic on ONE quantity: points per team.
  * NBA_PROVEN.md already says usage concentration is "a ONE-TEAM property measured against a
    one-team outcome". The mechanism was written down correctly and then encoded per-GAME anyway.

WHAT THIS DOES INSTEAD. Melt the wide frame to a team-game panel: 10,216 rows, `own_*` / `opp_*`
by perspective, `is_home` as a feature. One model, each coefficient estimated once on twice the
rows. Points per team come out of a single function, so the team totals, the full-game total
(own + opp) and the full-game spread (own - opp) are consistent with each other by construction.

TWO THINGS THE WIDE LAYOUT WAS HIDING, both handled here.

  * `d_*` columns are home-minus-away differences. Passed through unchanged they would encode
    home orientation into a perspective-neutral model, so they are SIGN-FLIPPED on the away row.
    `sum_*` columns are symmetric and pass through untouched. The melt asserts this: after the
    flip, the away row's own/opp values must equal the home row's opp/own values.
  * The two rows of a game share its context, so 10,216 rows is not 10,216 independent
    observations. Null shuffles permute at the GAME level, keeping both rows of a game together;
    permuting rows independently would break the pairing and deflate the null.
"""
import importlib.util
import os
import re
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "data", "parquet", "_nba_wide_cache.parquet")
NULLS = 20
KS = (1.25, 2, 3, 4, 5)
CLAIM_K = 4


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
mk = _load("mk", "nba_markets.py")


def classify(cols):
    """Sort wide columns into home/away pairs, symmetric, antisymmetric and game-level.

    The h/a token is not always in the same place -- `h_l5_pace`, `net_eff_l5_h`,
    `dm_sched_h_days_since_home`, `radj_h_adj_net`, `mk_tt_disc_h` all carry it differently -- so
    pair columns by substituting the token wherever it appears and checking the partner exists,
    rather than by matching a prefix. `ph_`/`pa_` are the one pair that is not a bare token.
    """
    have = set(cols)
    pairs, sym, anti, gl, seen = [], [], [], [], set()
    for c in cols:
        if c in seen:
            continue
        if c.startswith("ph_"):
            p = "pa_" + c[3:]
            if p in have:
                pairs.append((c, p))
                seen.update((c, p))
                continue
        if c.startswith("pa_"):
            continue
        t = c.split("_")
        hp = [i for i, x in enumerate(t) if x == "h"]
        if len(hp) == 1:
            t2 = list(t)
            t2[hp[0]] = "a"
            p = "_".join(t2)
            if p in have:
                pairs.append((c, p))
                seen.update((c, p))
                continue
        if any(x == "a" for x in t) and len([i for i, x in enumerate(t) if x == "a"]) == 1:
            t2 = list(t)
            t2[[i for i, x in enumerate(t) if x == "a"][0]] = "h"
            if "_".join(t2) in have:
                continue                      # partner of an already-recorded pair
        if any(x == "sum" for x in t):
            sym.append(c)
        elif any(x == "d" for x in t):
            anti.append(c)
        else:
            gl.append(c)
        seen.add(c)
    return pairs, sym, anti, gl


def build_panel(D, stack):
    """Two rows per game. Home row keeps orientation; away row swaps own/opp and flips `d_*`.

    Only the CURATED wide stack is melted, never every numeric column. Melting the whole frame
    yields 1,560 features, which is the "hand the model 1,678 columns and let it sort them out"
    approach nba_total_v2.py was written to undo. And once a stat is present as own/opp, its
    `sum_` and `d_` twins are exact linear combinations (own+opp, own-opp) carrying no new
    information -- so they are dropped WHERE a pair exists and kept where one does not, because
    several blocks (`raw_*`, `adj_own_*`) only ever ship the sum/difference form.
    """
    feat = [c for c in stack if c in D.columns and pd.api.types.is_numeric_dtype(D[c])]
    pairs, sym, anti, gl = classify(feat)

    def key(c):
        return "_".join(x for x in c.split("_") if x not in ("h", "a", "sum", "d"))

    paired = {key(h) for h, _ in pairs}
    sym_k = [c for c in sym if key(c) not in paired]
    anti_k = [c for c in anti if key(c) not in paired]
    print(f"[panel] {len(pairs)} own/opp pairs | symmetric {len(sym)}->{len(sym_k)} | "
          f"antisymmetric {len(anti)}->{len(anti_k)} | {len(gl)} game-level "
          f"(sum/diff twins of a pair dropped as collinear)", flush=True)
    sym, anti = sym_k, anti_k

    half = D["t60_total_point"] / 2.0
    base = dict(
        event_id=D["event_id"], date=D["date"], season=D["season"], phase=D["phase"],
        # FG-implied team total: 220 with home -6 gives 113/107. Four seasons, unlike the posted
        # team total, which is why it anchors the target instead of the posted line.
        impl=[half - D["t60_spread_home_point"] / 2.0, half + D["t60_spread_home_point"] / 2.0],
        pts=[D["y_home_pts"], D["y_away_pts"]],
        line=[D["tt_h"], D["tt_a"]],
        po=[D["tt_h_o"], D["tt_a_o"]], pu=[D["tt_h_u"], D["tt_a_u"]],
    )

    rows = []
    for side in (0, 1):                                   # 0 = home perspective, 1 = away
        R = pd.DataFrame({k: (v[side] if isinstance(v, list) else v) for k, v in base.items()})
        R["is_home"] = 1 - side
        for h, a in pairs:
            R["own_" + re.sub(r"(^|_)(h|ph)(_|$)", r"\1\3", h).strip("_")] = D[a if side else h]
            R["opp_" + re.sub(r"(^|_)(h|ph)(_|$)", r"\1\3", h).strip("_")] = D[h if side else a]
        for c in sym:
            R[c] = D[c]
        for c in anti:
            R[c] = -D[c] if side else D[c]                # home-minus-away -> own-minus-opp
        for c in gl:
            R[c] = D[c]
        rows.append(R)

    P = pd.concat(rows, ignore_index=True)
    P["team_row"] = np.where(P["is_home"] == 1, "home", "away")

    # The melt is the whole point of this file, so prove it rather than trusting it: for one
    # game, the away row's own/opp must mirror the home row's opp/own, and its antisymmetric
    # columns must be the exact negation.
    g = P[P["event_id"] == P["event_id"].iloc[0]]
    hr, ar = g[g.is_home == 1].iloc[0], g[g.is_home == 0].iloc[0]
    oc = [c for c in P.columns if c.startswith("own_")]
    for c in oc[:200]:
        o = "opp_" + c[4:]
        assert (pd.isna(hr[c]) and pd.isna(ar[o])) or np.isclose(hr[c], ar[o], equal_nan=True), c
    for c in anti[:200]:
        assert (pd.isna(hr[c]) and pd.isna(ar[c])) or np.isclose(hr[c], -ar[c]), c
    print(f"[panel] {len(P):,} team-games from {D['event_id'].nunique():,} games | "
          f"mirror check passed on {min(200, len(oc))} own/opp and {min(200, len(anti))} "
          f"antisymmetric columns", flush=True)

    P = P.sort_values(["date", "event_id", "is_home"]).reset_index(drop=True)
    # `impl` is this team's implied total from the full-game line -- the per-team analogue of the
    # `t60_total_point` level the wide model carried, so a high-total team can behave differently.
    fcols = ([c for c in P.columns if c.startswith(("own_", "opp_"))] + sym + anti + gl
             + ["is_home", "impl"])
    fcols = [c for c in dict.fromkeys(fcols) if c in P.columns
             and pd.api.types.is_numeric_dtype(P[c]) and P[c].notna().mean() > 0.60]
    return P, fcols


def game_shuffle(P, y, rng):
    """Permute the target at GAME level: both rows of a game move together, so the null keeps the
    home/away pairing that makes the panel 5,108 games rather than 10,216 free observations."""
    ys = y.copy()
    for s in P["season"].unique():
        m = (P["season"] == s) & y.notna()
        ev = P.loc[m, "event_id"]
        u = ev.unique()
        # both rows of a game must be in the mask, or the two sort orders below pair a home row
        # with an away row from a different game and the "null" quietly becomes a real shuffle
        assert ev.value_counts().eq(2).all(), "a game has a lone graded row; pairing would break"
        mapping = dict(zip(u, rng.permutation(u)))
        # move each game's pair of targets onto another game's pair, keeping home/away order
        src = P.loc[m].assign(_k=ev.map(mapping))
        order = src.sort_values(["_k", "is_home"]).index
        ys.loc[order] = y.loc[src.sort_values(["event_id", "is_home"]).index].values
    return ys


def row(g, tag, extra=""):
    return (f"| {tag} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
            f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |{extra}")


def wide_stack(D):
    """The same ~724 curated columns nba_tt_full.py used, so the only thing changing between the
    two files is the ROW LAYOUT. Rebuilding the stack differently would confound the comparison.

    The blocks are re-derived by NAME rather than by re-calling each module's attach(): the cached
    frame already has them joined, and attach() expects the pre-join frame (v4.dim_features looks
    for a dm_ column it is itself supposed to create). Prefixes reproduce the same sets --
    dims = dm_*, nets = raw_*/net_*, adjusted = adj_own_*/adj_net_* with the broken adjr_ variants
    excluded exactly as before, market structure = mk_*.
    """
    pre = ("radj_", "dm_", "raw_", "net_", "adj_own_", "adj_net_", "mk_")
    blocks = [c for c in D.columns if c.startswith(pre) and not c.startswith("adjr_")
              and pd.api.types.is_numeric_dtype(D[c]) and D[c].notna().mean() > 0.80]
    return list(dict.fromkeys(v2.feature_cols(D) + blocks))


def main():
    D = pd.read_parquet(CACHE)
    D["date"] = pd.to_datetime(D["date"])
    stack = wide_stack(D)
    print(f"[panel] wide stack {len(stack)} columns", flush=True)
    P, fcols = build_panel(D, stack)

    y = P["pts"] - P["impl"]                       # 4 seasons of training rows, both perspectives
    P["_y"] = y
    cols = [c for c in fcols if c not in mk.leak(P, fcols, "_y", "impl")]
    print(f"[panel] {len(cols)} features after the leak screen", flush=True)

    line = pd.to_numeric(P["line"], errors="coerce")
    yb = pd.Series(np.where(P["pts"] > line, 1.0, np.where(P["pts"] < line, 0.0, np.nan)),
                   index=P.index)
    po = pd.Series(v2.to_dec(P["po"]), index=P.index)
    pu = pd.Series(v2.to_dec(P["pu"]), index=P.index)
    gap = P["impl"] - line

    p = v2.walk(P[cols].astype(float), P["date"], y, kind="ridge")
    d = p + gap
    print(f"[panel] train {int(y.notna().sum()):,} rows | graded {int(yb.notna().sum()):,} | "
          f"oos corr {d.corr(P['pts'] - line):+.4f}", flush=True)

    L = ["# NBA team totals — one row per TEAM-GAME", "",
         "`NBA_TT_FULL.md` fit home and away team totals as two separate models on a frame of one "
         "row per game. That estimates the same relationship twice from disjoint columns, so the "
         "two sides disagree for no basketball reason and neither prediction is consistent with "
         "the other. This rebuilds the target as a team-game panel: "
         f"**{len(P):,} rows from {D['event_id'].nunique():,} games**, `own_*`/`opp_*` by "
         "perspective, `is_home` as a feature, **one** model.", "",
         f"{len(cols)} features survive the leak screen. Out-of-sample correlation with the "
         f"posted-line residual **{d.corr(P['pts'] - line):+.4f}** "
         f"(two-model version: +0.083 home / +0.057 away, which are not comparable to each other "
         "and were the symptom).", "",
         f"## Ladder — one model, both sides, null shuffled at game level", "",
         "| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
         "|---|---|---|---|---|---|---|---|---|"]

    nulls = []
    rng = np.random.default_rng(20260801)
    for i in range(NULLS):
        ys = game_shuffle(P, y, rng)
        nulls.append(v2.walk(P[cols].astype(float), P["date"], ys, kind="ridge") + gap)
        if i % 5 == 0:
            print(f"  null {i+1}/{NULLS}", flush=True)
    print("[panel] nulls done", flush=True)

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

    # The question that motivated the rebuild: is the home/away gap still there once one model
    # produces both? If it collapses, the old split was estimator variance, as suspected.
    L += [f"## Home vs away, at the {CLAIM_K}-point cut", "",
          "Two fits made these look like different bets. One fit should make them look like the "
          "same bet seen from two sides.", "",
          "| perspective | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for lab in ("home", "away"):
        g = v2.grade(d, yb, po, pu, CLAIM_K, mask=(P["team_row"] == lab))
        if g["n"]:
            L.append(row(g, f"{lab} team total"))
            print(L[-1], flush=True)
    L.append("")

    for col, lab in (("season", "season"), ("phase", "phase")):
        L += [f"## By {lab}, at the {CLAIM_K}-point cut", "",
              f"| {lab} | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
        order = ("EARLY", "MID", "LATE", "POST") if col == "phase" else None
        for v in (order or sorted(P[col].dropna().unique())):
            g = v2.grade(d, yb, po, pu, CLAIM_K, mask=(P[col] == v))
            if g["n"]:
                L.append(row(g, v))
                print(L[-1], flush=True)
        L.append("")

    # Derived markets: the payoff of one coherent points model is that the full-game total and
    # spread fall out of it instead of being two more independent fits.
    pr = P.assign(pred=P["impl"] + p)[["event_id", "team_row", "pred"]]
    pr = pr.pivot(index="event_id", columns="team_row", values="pred")
    G = D.set_index("event_id")
    G = G.join(pr)
    fg_tot = (G["home"] + G["away"]) - G["t60_total_point"]
    # SIGN. This line used to read `-(home - away) - t60_spread_home_point`, i.e. the predicted
    # margin flipped into POSTED convention and then compared to the posted line by subtraction,
    # while the outcome it is graded against (`y_fg_marg_resid`) is a margin RESIDUAL built by
    # ADDITION. The two disagreed about which direction is a home bet, so EVERY derived spread bet
    # was placed on the wrong side -- home 113 / away 105 against a posted -5 gave -8 - (-5) = -3,
    # read as an AWAY bet even though the model likes home by more than the market does. Building
    # the graded quantity the same way as the outcome is what makes them impossible to disagree.
    # The same bug was copied into nba_panel_all.py; both are fixed and both now assert below.
    fg_sp = (G["home"] - G["away"]) + G["t60_spread_home_point"]
    L += ["## Derived full-game markets — the point of one coherent model", "",
          "Team predictions summed and differenced, compared with the posted full-game lines. "
          "No new fit: these are the same numbers rearranged.", "",
          "| market | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for lab, q, res, o, u in (
            ("full-game total", fg_tot, G["y_fg_total"] - G["t60_total_point"],
             G["t60_total_over_price"], G["t60_total_under_price"]),
            ("full-game spread", fg_sp, G["y_fg_marg_resid"],
             G["t60_spread_home_price"], G["t60_spread_away_price"])):
        b = pd.Series(np.where(res > 0, 1.0, np.where(res < 0, 0.0, np.nan)), index=G.index)
        po_, pu_ = (pd.Series(v2.to_dec(o), index=G.index),
                    pd.Series(v2.to_dec(u), index=G.index))
        # ORACLE. Substitute the realised result for the prediction; a market graded on a
        # coherent sign must then win ~100% of the time. This is the cheapest possible guard
        # against the inversion above, and it costs one line per market.
        orc = v2.grade(res, b, po_, pu_, 0)
        assert orc["win"] > 99.5, (f"{lab}: feeding the actual result into its own bet rule grades "
                                   f"{orc['win']:.1f}%, not ~100% -- the sign is inverted")
        g = v2.grade(q, b, po_, pu_, 2)
        if g["n"]:
            L.append(row(g, lab))
            print(L[-1], flush=True)

    with open(os.path.join(ROOT, "NBA_PANEL.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_PANEL.md", flush=True)


if __name__ == "__main__":
    main()
