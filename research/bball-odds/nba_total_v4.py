#!/usr/bin/env python3
"""NBA full-game total, round 4: do the situational dimensions earn a place IN the model?

WHY THIS FILE EXISTS. The 2026-07-31 situational scan (`nba_dims_*.py`) measured scenarios as
POINTS OF ATTRIBUTION rather than win-rate cuts, and three of its findings were explicitly
filed as "model ingredient, not a bet":

  - TEAM ARCHITECTURE. The pace 3x3 moves the RAW game total from 219.4 (slow/slow) to 237.6
    (fast/fast) -- an 18-point gradient, the largest clean structure anywhere in the NBA work
    -- while the same grid against the POSTED total is flat in every cell. Read one way that
    says "fully priced, forget it". Read another it says the market gets the LEVEL right, which
    tells you nothing about whether the interaction helps a residual model.
  - ROTATION EXPERIENCE x FATIGUE. +0.69 excess points on the total, t=1.32. Coherent ordering
    (veteran+fatigued > anyone fatigued > any veteran), too weak to bet on its own.
  - ROAD-TRIP DEPTH. Real on the spread (S16) and directionally positive on the total (+1.07
    excess, t=1.38), but priced at +0.70% ROI as a standalone fade.

Each of those was rejected as a CARD. None was ever tested as a FEATURE. Those are different
questions: a card has to clear the vig by itself, a feature only has to carry information the
other 392 columns do not already have. Round 3's own theme ablation is the precedent -- usage
concentration is not a bet either, and it is the single load-bearing block in the model.

WHAT WOULD COUNT AS AN ANSWER. Round 3 is the incumbent: oos corr +0.067, edge +3.3 at k>=2.
The dimensions earn their place only if adding them moves BOTH corr and edge, if a drop-one
ablation shows the gain survives removing each other theme, and if the gain is larger than the
label-shuffle null's spread. Anything less and they are decoration -- I would rather report
that than ship 40 columns that do nothing.

THE ONE TRAP. The panel is TEAM-level (two rows per game) and the model is GAME-level. Joining
naively would leak the away team's row into the home team's features and double-count. This
takes the HOME team's row only and uses its own_* / opp_* pairs, which already carry both
sides. `sum` columns are built before `diff` for the same reason as round 3: a total is a sum.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
spec = importlib.util.spec_from_file_location("v2", os.path.join(ROOT, "nba_total_v2.py"))
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)
spec3 = importlib.util.spec_from_file_location("v3", os.path.join(ROOT, "nba_total_v3.py"))
v3 = importlib.util.module_from_spec(spec3)
spec3.loader.exec_module(v3)

K = 2.0
PAN = os.path.join(OUT, "nba_dims_panel.parquet")

# Each theme is one mechanism, named before it was tested, so the ablation below is
# interpretable. Column names are the panel's own_*/opp_* pairs.
PAIRS = {
    "sched": ["trip_leg", "trip_len", "trip_left", "is_last_of_trip", "homestand_leg",
              "next_rest", "next_is_away", "sandwich", "days_since_home"],
    "arch":  ["l10_pace", "l3_pace", "l10_def_eff", "l3_def_eff"],
    "seq":   ["seq_opp_pace3", "seq_opp_off3", "seq_opp_def3"],
    "trav":  ["km_7d", "km_14d", "venues_7d", "b2b", "rest_days"],
}
# Rotation experience is the one panel column whose mirror is named `o_own_exp` rather than
# `opp_*` -- it came from the opponent-view join, not the own/opp pairing. Handled separately
# so the generic pair loop above does not skip it silently, which is exactly what it did once.
EXP_PAIR = ("own_exp", "o_own_exp")


def dim_features(D):
    """Attach the situational panel to the game-level model frame.

    Returns (D, theme_map). Every column is prefixed `dm_<theme>_` so a theme can be dropped
    by name in the ablation without maintaining a second list.
    """
    p = pd.read_parquet(PAN)
    p = p[p["is_home"] == 1].drop_duplicates("event_id")  # home row only -- see the docstring

    cols, themes = {}, {}
    for theme, stems in PAIRS.items():
        got = []
        for stem in stems:
            # the panel names the home team's own value own_*, the away team's opp_*
            a, b = f"own_{stem}", f"opp_{stem}"
            if a not in p.columns or b not in p.columns:
                continue
            h, v = pd.to_numeric(p[a], errors="coerce"), pd.to_numeric(p[b], errors="coerce")
            cols[f"dm_{theme}_h_{stem}"] = h
            cols[f"dm_{theme}_a_{stem}"] = v
            cols[f"dm_{theme}_sum_{stem}"] = h + v          # a total is a sum
            cols[f"dm_{theme}_d_{stem}"] = h - v
            got += [f"dm_{theme}_{s}_{stem}" for s in ("h", "a", "sum", "d")]
        themes[theme] = got

    eh = pd.to_numeric(p[EXP_PAIR[0]], errors="coerce")
    ea = pd.to_numeric(p[EXP_PAIR[1]], errors="coerce")
    cols["dm_exp_h_exp"], cols["dm_exp_a_exp"] = eh, ea
    cols["dm_exp_sum_exp"], cols["dm_exp_d_exp"] = eh + ea, eh - ea
    themes["exp"] = ["dm_exp_h_exp", "dm_exp_a_exp", "dm_exp_sum_exp", "dm_exp_d_exp"]

    # ---- the interactions the scan actually pointed at -----------------------------------
    # These are the whole reason for this file. Nothing here is a new mechanism; each one is
    # a cell from `dims.log` written as a continuous feature instead of a threshold.
    ph, pa = pd.to_numeric(p["own_l10_pace"], errors="coerce"), pd.to_numeric(p["opp_l10_pace"], errors="coerce")
    # style-vs-style: the 3x3's diagonal is a PRODUCT, its corners are a |difference|
    cols["dm_ix_pace_prod"] = (ph * pa) / 100.0
    cols["dm_ix_pace_gap"] = (ph - pa).abs()
    cols["dm_ix_pace_min"] = np.minimum(ph, pa)   # the slower team caps the possessions
    dh = pd.to_numeric(p["own_l10_def_eff"], errors="coerce")
    da = pd.to_numeric(p["opp_l10_def_eff"], errors="coerce")
    cols["dm_ix_leak_prod"] = (dh * da) / 100.0   # both-leaky was the 241-point corner
    cols["dm_ix_pace_x_leak"] = (ph + pa) * (dh + da) / 1000.0

    # experience x fatigue -- T3. fatigue is b2b or a heavy travel week, per side.
    for side, ex, b2, km in (("h", EXP_PAIR[0], "own_b2b", "own_km_7d"),
                             ("a", EXP_PAIR[1], "opp_b2b", "opp_km_7d")):
        e = pd.to_numeric(p[ex], errors="coerce")
        f = pd.to_numeric(p[b2], errors="coerce").fillna(0) + \
            (pd.to_numeric(p[km], errors="coerce") > pd.to_numeric(p[km], errors="coerce").quantile(0.75)).astype(float)
        cols[f"dm_ix_exp_x_fatigue_{side}"] = e * f
    cols["dm_ix_exp_x_fatigue_sum"] = cols["dm_ix_exp_x_fatigue_h"] + cols["dm_ix_exp_x_fatigue_a"]

    # trip depth x own pace -- S16/T2, as a product rather than a 66th-percentile cut
    for side, lg, pc in (("h", "own_trip_leg", "own_l10_pace"), ("a", "opp_trip_leg", "opp_l10_pace")):
        if lg in p.columns:
            cols[f"dm_ix_trip_x_pace_{side}"] = pd.to_numeric(p[lg], errors="coerce").clip(0, 6) * \
                pd.to_numeric(p[pc], errors="coerce") / 100.0
    themes["ix"] = [c for c in cols if c.startswith("dm_ix_")]

    F = pd.DataFrame(cols)
    F["event_id"] = p["event_id"].values
    n0 = len(D)
    D = D.merge(F, on="event_id", how="left")
    assert len(D) == n0, "dim join changed the row count"
    cov = D["dm_arch_sum_l10_pace"].notna().mean()
    print(f"[dims] {len(F.columns)-1} columns joined on {cov:.1%} of games", flush=True)
    return D, themes


def report(L, tag, p, y, yb, po, pu, ncols, k=K):
    m = p.notna() & y.notna()
    r = np.corrcoef(p[m], y[m])[0, 1]
    g = v2.grade(p, yb, po, pu, k)
    L.append(f"| {tag} | {ncols} | {r:+.4f} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} "
             f"| **{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
    print(L[-1], flush=True)
    return r, g["win"] - g["base"]


def main():
    D = v2.build()
    D = v3.with_fixed_ratings(D)
    D, themes = dim_features(D)

    base_cols = [c for c in v2.feature_cols(D) if c not in v2.leak_screen(D, v2.feature_cols(D))]
    radj = [c for c in D.columns if c.startswith("radj_") and D[c].notna().mean() > 0.80]
    r3_cols = base_cols + radj                                   # the round-3 incumbent
    dim_cols = [c for t in themes.values() for c in t if D[c].notna().mean() > 0.80]
    full_cols = r3_cols + dim_cols
    print(f"[features] round3={len(r3_cols)}  dims={len(dim_cols)}  total={len(full_cols)}",
          flush=True)

    y = D["y_fg_tot_resid"].astype(float)
    yb = pd.Series(np.where(y > 0, 1.0, np.where(y < 0, 0.0, np.nan)), index=D.index)
    po = pd.Series(v2.to_dec(D["t60_total_over_price"]), index=D.index)
    pu = pd.Series(v2.to_dec(D["t60_total_under_price"]), index=D.index)

    L = ["# NBA full-game total — round 4: do the situational dimensions earn a place?", "",
         f"{len(D):,} gradeable games. Walk-forward ridge on the residual vs the T-60 close, "
         f"bets at |disagreement| ≥ {K:.0f} points. Round 3 is the incumbent; the only change "
         f"is the {len(dim_cols)} situational columns built from `nba_dims_panel`.", "",
         "The scan filed team architecture, rotation experience and road-trip depth as "
         "*model ingredients, not bets*. This is the test of that claim — a card must clear "
         "the vig alone, a feature only has to carry information the other columns lack.", ""]

    L += ["## 1. Headline", "",
          "| feature set | cols | oos corr | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|"]
    P = {}
    for tag, cs in (("round 3 (incumbent)", r3_cols),
                    ("round 4 (+ situational dims)", full_cols),
                    ("situational dims ALONE", dim_cols)):
        P[tag] = v2.walk(D[cs].astype(float), D["date"], y, kind="ridge")
        report(L, tag, P[tag], y, yb, po, pu, len(cs))

    best = P["round 4 (+ situational dims)"]

    L += ["", "## 2. Which theme is doing the work? (drop-one from the full set)", "",
          "Each row removes ONE theme and refits. A theme that matters shows a DROP in both "
          "corr and edge. This is the same ablation that identified usage concentration as "
          "round 2's load-bearing block.", "",
          "| dropped | cols | oos corr | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|"]
    for t, cs_t in themes.items():
        drop = set(cs_t)
        keep = [c for c in full_cols if c not in drop]
        p = v2.walk(D[keep].astype(float), D["date"], y, kind="ridge")
        report(L, f"− {t} ({len(drop & set(dim_cols))} cols)", p, y, yb, po, pu, len(keep))

    L += ["", "## 3. Each theme ADDED to round 3 on its own", "",
          "The mirror of §2: does the theme help when it is the only thing added?", "",
          "| added | cols | oos corr | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|"]
    for t, cs_t in themes.items():
        cs_t = [c for c in cs_t if c in dim_cols]
        if not cs_t:
            continue
        p = v2.walk(D[r3_cols + cs_t].astype(float), D["date"], y, kind="ridge")
        report(L, f"+ {t} ({len(cs_t)} cols)", p, y, yb, po, pu, len(r3_cols) + len(cs_t))

    L += ["", "## 4. Threshold ladder and season/phase split (round 4)", "",
          "| k (pts) | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for k in (0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0):
        g = v2.grade(best, yb, po, pu, k)
        if g["n"]:
            L.append(f"| ≥{k:.0f} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print(L[-1], flush=True)

    L += ["", "| slice | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for lab, msk in ([(str(s), D["season"] == s) for s in sorted(D["season"].unique())] +
                     [(ph, D["phase"] == ph) for ph in ("EARLY", "MID", "LATE", "POST")]):
        g = v2.grade(best, yb, po, pu, K, mask=msk)
        if g["n"]:
            L.append(f"| {lab} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print(L[-1], flush=True)

    # ---- 5. null ---------------------------------------------------------------------------
    rng = np.random.default_rng(44)
    nr, ne = [], []
    for i in range(8):
        ys = y.copy()
        for s in D["season"].unique():
            msk = (D["season"] == s) & y.notna()
            ys.loc[msk] = rng.permutation(y.loc[msk].values)
        ps = v2.walk(D[full_cols].astype(float), D["date"], ys, kind="ridge")
        ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=D.index)
        mm = ps.notna() & ys.notna()
        nr.append(np.corrcoef(ps[mm], ys[mm])[0, 1])
        gg = v2.grade(ps, ybs, po, pu, K)
        ne.append(gg["win"] - gg["base"])
        print(f"[null {i+1}/8] corr {nr[-1]:+.4f}  edge {ne[-1]:+.2f}", flush=True)

    mm = best.notna() & y.notna()
    rr = np.corrcoef(best[mm], y[mm])[0, 1]
    gg = v2.grade(best, yb, po, pu, K)
    re_ = gg["win"] - gg["base"]
    nr, ne = np.array(nr), np.array(ne)
    L += ["", "## 5. Label-shuffle null on the round-4 config (8 draws, within season)", "",
          "| statistic | real | null mean | null sd | z |", "|---|---|---|---|---|",
          f"| oos corr | {rr:+.4f} | {nr.mean():+.4f} | {nr.std(ddof=1):.4f} | "
          f"**{(rr-nr.mean())/nr.std(ddof=1):+.2f}** |",
          f"| edge @ k≥{K:.0f} | {re_:+.2f} | {ne.mean():+.2f} | {ne.std(ddof=1):.2f} | "
          f"**{(re_-ne.mean())/ne.std(ddof=1):+.2f}** |", ""]
    print("\n".join(L[-4:]), flush=True)

    path = os.path.join(ROOT, "NBA_TOTAL_V4.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
