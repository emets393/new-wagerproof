#!/usr/bin/env python3
"""Does travel and schedule condition actually move an NBA game? The honest test.

WHY THIS EXISTS. Rounds 1 and 2 both found that removing the schedule block IMPROVED the
model, and I reported that as "schedule doesn't matter". That reading was lazy. The block was
six counters -- days of rest, back-to-back, rest-before-last, three-in-four, games in the last
seven, consecutive road games -- and every one of them counts GAMES. None of them knew the
team flew, how far, in which direction, into what altitude, or what time their body thought it
was. "These six counters carry nothing" and "travel carries nothing" are different claims and
only the first one was ever tested.

`build_nba_travel.py` builds the missing block: great-circle distance from the previous
arena, SIGNED time-zone movement (east positive -- averaging the two directions is why an
unsigned column finds nothing), DST-correct body-clock tip hour, altitude with an
acclimatisation decay that separates Denver's roster from a visitor who landed yesterday, and
cumulative trailing load. This file tests it four ways, in increasing order of how easy it is
to fool yourself:

  1. LEAK SCREEN. Same rule as every other build: a real pregame driver of scoring is priced,
     so it must track the LINE at least as well as the RESULT.
  2. UNIVARIATE SCAN vs a label-shuffle null, on BOTH the total and the spread. Travel is a
     fatigue story, and fatigue has an obvious route into the margin as well as the total, so
     testing only the total would be assuming the answer.
  3. ADD-TO-MODEL. The number that decides it: does the round-2 ridge get better? Measured on
     out-of-sample correlation AND on money at k>=2 points, with the identical folds.
  4. TRAVEL-ONLY. A model built from nothing but these columns. If the add-to-model delta is
     positive but travel-only is at chance, the block is a variance sponge, not a signal.

Everything is quoted against the baseline computed INSIDE its own rows, and nothing is claimed
before the shuffle null and the phase/season split have both run.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.linear_model import Ridge

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
spec = importlib.util.spec_from_file_location("v2", os.path.join(ROOT, "nba_total_v2.py"))
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)

K = 2.0
TRAVEL = ["trav_km", "trav_tz", "alt_m", "alt_jump", "days_at_alt", "alt_exposure",
          "km_7d", "km_14d", "venues_7d", "days_since_home", "km_per_rest", "east_km",
          "local_hour", "bodyclock_off", "body_tip_hour"]


def attach_travel(D):
    """Widen the per-team travel ledger onto the game frame as h_/a_/d_/sum_.

    `d_` (home minus away) is the one that should matter for the SPREAD -- travel is a
    relative-disadvantage story there. `sum_` is the one that should matter for the TOTAL: two
    tired teams is a different game from one tired team, and the sum is what a scoring
    environment responds to. Both are built so the test can tell them apart.
    """
    T = pd.read_parquet(f"{OUT}/nba_travel.parquet")
    h = T[T["is_home"] == 1].set_index("bdl_id")[TRAVEL].add_prefix("h_tv_")
    a = T[T["is_home"] == 0].set_index("bdl_id")[TRAVEL].add_prefix("a_tv_")
    W = h.join(a, how="inner")
    for c in TRAVEL:
        W[f"sum_tv_{c}"] = W[f"h_tv_{c}"] + W[f"a_tv_{c}"]
        W[f"d_tv_{c}"] = W[f"h_tv_{c}"] - W[f"a_tv_{c}"]
    # `local_hour` is a property of the GAME, not of a team; the h_/a_ pair is the same number
    # and the sum/diff of it are an artefact. Keep one copy.
    W = W.drop(columns=["a_tv_local_hour", "sum_tv_local_hour", "d_tv_local_hour",
                        "a_tv_alt_m", "sum_tv_alt_m", "d_tv_alt_m"])
    W = W.rename(columns={"h_tv_local_hour": "tv_local_hour", "h_tv_alt_m": "tv_alt_m"})
    cols = list(W.columns)
    n0 = len(D)
    D = D.merge(W.reset_index().rename(columns={"bdl_id": "game.id"}), on="game.id", how="left")
    cov = D[cols].notna().all(axis=1).mean()
    print(f"[travel] attached {len(cols)} columns to {n0:,} games, coverage {cov:.3f}", flush=True)
    return D, cols


def scan(D, cols, target, nshuf=30, seed=7):
    """Univariate correlations vs a within-season label shuffle.

    Reports the two statistics that diagnose the ESTIMATOR, not just the signal:
    the best single |corr| (is there one predictor?) and the COUNT above a threshold (are
    there many weak ones?). This is the diagnostic that overturned round 1's null verdict.
    """
    y = D[target]
    m0 = y.notna()
    real = {}
    for c in cols:
        x = pd.to_numeric(D[c], errors="coerce")
        m = m0 & x.notna()
        if m.sum() < 500 or x[m].nunique() < 5:
            continue
        real[c] = abs(np.corrcoef(x[m], y[m])[0, 1])
    rs = pd.Series(real).sort_values(ascending=False)

    rng = np.random.default_rng(seed)
    nb, nc = [], []
    for _ in range(nshuf):
        ys = y.copy()
        for s in D["season"].unique():
            msk = (D["season"] == s) & m0
            ys.loc[msk] = rng.permutation(y.loc[msk].values)
        vals = []
        for c in rs.index:
            x = pd.to_numeric(D[c], errors="coerce")
            m = ys.notna() & x.notna()
            vals.append(abs(np.corrcoef(x[m], ys[m])[0, 1]))
        vals = np.array(vals)
        nb.append(vals.max())
        nc.append((vals > 0.03).sum())
    return rs, float(np.mean(nb)), float(np.mean(nc)), int((rs > 0.03).sum())


def edge_of(g):
    return np.nan if g["n"] == 0 else g["win"] - g["base"]


def main():
    D = v2.build()
    D, tcols = attach_travel(D)

    base_cols = v2.feature_cols(D)
    base_cols = [c for c in base_cols if c not in v2.leak_screen(D, base_cols)]

    # ---- 1. leak screen on the travel block itself ----------------------------------------
    print("\n=== 1. leak screen (travel) ===", flush=True)
    bad = v2.leak_screen(D, tcols)
    tcols = [c for c in tcols if c not in bad]
    print(f"[travel] {len(tcols)} columns survive the leak screen", flush=True)

    yc = D["y_fg_tot_resid"].astype(float)
    ym = D["y_fg_marg_resid"].astype(float) if "y_fg_marg_resid" in D else None
    yb = pd.Series(np.where(yc > 0, 1.0, np.where(yc < 0, 0.0, np.nan)), index=D.index)
    po = pd.Series(v2.to_dec(D["t60_total_over_price"]), index=D.index)
    pu = pd.Series(v2.to_dec(D["t60_total_under_price"]), index=D.index)

    L = ["# NBA travel & schedule conditions — does any of it move a game?", "",
         "The schedule block in rounds 1-2 was six counters of GAMES (rest, b2b, 3-in-4, "
         "games-last-7, road-run) and removing it *improved* the model. I read that as "
         "\"schedule doesn't matter\". It only ever tested those six counters. This adds real "
         "travel — great-circle distance, signed time-zone direction, DST-correct body-clock "
         "tip hour, altitude with an acclimatisation decay, cumulative trailing load — and "
         "tests it properly.", "",
         f"{len(D):,} gradeable games, seasons {sorted(D['season'].unique())}. "
         f"{len(tcols)} travel columns after the leak screen.", ""]

    # ---- 2. univariate scan, total AND spread ---------------------------------------------
    print("\n=== 2. univariate scan vs shuffle null ===", flush=True)
    L += ["## 1. Univariate scan vs a within-season label shuffle", "",
          "Two statistics, because they diagnose different things: the best single |corr| asks "
          "*is there one predictor* (if not, trees are the wrong estimator), the count above "
          "0.03 asks *are there many weak ones* (if so, a regularised linear model can sum "
          "them).", "",
          "| target | best real | best null | count>0.03 real | count>0.03 null |",
          "|---|---|---|---|---|"]
    scans = {}
    for tgt, lbl in (("y_fg_tot_resid", "total residual"), ("y_fg_marg_resid", "spread residual")):
        if tgt not in D.columns:
            continue
        rs, nb, nc, cnt = scan(D, tcols, tgt)
        scans[tgt] = rs
        L.append(f"| {lbl} | {rs.iloc[0]:.4f} (`{rs.index[0]}`) | {nb:.4f} | {cnt} | {nc:.1f} |")
        print(L[-1], flush=True)
        L.append("")
        L.append(f"Strongest travel columns vs the {lbl}: " +
                 ", ".join(f"`{c}` {v:+.4f}" for c, v in rs.head(8).items()))
        L.append("")
        print("   " + ", ".join(f"{c} {v:.4f}" for c, v in rs.head(8).items()), flush=True)

    # ---- 3. add-to-model ------------------------------------------------------------------
    print("\n=== 3. add to the round-2 ridge ===", flush=True)
    runs = {}
    for tag, cols in (("base (round 2)", base_cols),
                      ("base + travel", base_cols + tcols),
                      ("travel only", tcols)):
        X = D[cols].astype(float)
        p = v2.walk(X, D["date"], yc, kind="ridge")
        m = p.notna() & yc.notna()
        r = np.corrcoef(p[m], yc[m])[0, 1]
        g = v2.grade(p, yb, po, pu, K)
        runs[tag] = (p, r, g, len(cols))
        print(f"[{tag:16s}] cols {len(cols):4d}  oos corr {r:+.4f}  "
              f"n {g['n']:5d}  win {g['win']:.1f}  base {g['base']:.1f}  "
              f"edge {edge_of(g):+.1f}  ROI {g['roi']:+.1f}", flush=True)

    L += ["## 2. Does it help the model?", "",
          "Identical folds, identical target, identical alphas — the only change is the "
          "feature set. `edge` is win% minus the best blind side inside the same rows; "
          "breakeven at −110 is 52.4%.", "",
          "| feature set | cols | oos corr | n @ k≥2 | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|"]
    for tag, (p, r, g, nc_) in runs.items():
        L.append(f"| {tag} | {nc_} | `{r:+.4f}` | {g['n']} | {g['win']:.1f} | {g['base']:.1f} "
                 f"| **{edge_of(g):+.1f}** | {g['roi']:+.1f} |")

    # ---- 4. phases and seasons on base+travel ---------------------------------------------
    print("\n=== 4. phase / season split ===", flush=True)
    pb, pt = runs["base (round 2)"][0], runs["base + travel"][0]
    L += ["", "## 3. Where it lands, phase by phase", "",
          "Pooling all games hides seasonality, and this is exactly the split that has to run "
          "before anything is claimed.", "",
          "| slice | n | base edge | +travel edge | base ROI | +travel ROI |",
          "|---|---|---|---|---|---|"]
    for lbl, msk in ([(ph, D["phase"] == ph) for ph in ("EARLY", "MID", "LATE", "POST")] +
                     [(str(s), D["season"] == s) for s in sorted(D["season"].unique())]):
        gb = v2.grade(pb, yb, po, pu, K, mask=msk)
        gt = v2.grade(pt, yb, po, pu, K, mask=msk)
        if gb["n"] == 0 and gt["n"] == 0:
            continue
        L.append(f"| {lbl} | {gt['n']} | {edge_of(gb):+.1f} | **{edge_of(gt):+.1f}** | "
                 f"{gb['roi']:+.1f} | {gt['roi']:+.1f} |")
        print(L[-1], flush=True)

    # ---- 5. targeted physical hypotheses ---------------------------------------------------
    # The add-to-model test asks whether travel helps ON AVERAGE across 5,271 games, most of
    # which involve two rested teams on a two-day gap. That will dilute a real effect that only
    # exists in the tail. These cuts ask the physical questions directly.
    print("\n=== 5. direct physical cuts (no model) ===", flush=True)
    L += ["", "## 4. The physical hypotheses, asked directly", "",
          "The add-to-model test averages over 5,000 games, most of them two rested teams on a "
          "normal two-day gap. A real physical effect lives in the tail, so ask it there. "
          "`over%` is how often the game went OVER the T-60 close inside that cut; the "
          "comparison column is the same statistic on every other game.", "",
          "| cut | n | over% | rest of slate over% | diff |", "|---|---|---|---|---|"]
    ov = yb
    cuts = {
        "visitor at altitude, unacclimatised (a_tv_alt_exposure > 1200)":
            D.get("a_tv_alt_exposure", pd.Series(np.nan, index=D.index)) > 1200,
        "both teams flew 1500km+ (sum_tv_trav_km > 3000)": D["sum_tv_trav_km"] > 3000,
        "visitor 3+ zones east of home (a_tv_bodyclock_off <= -3)":
            D["a_tv_bodyclock_off"] <= -3,
        "visitor body clock past 10pm (a_tv_body_tip_hour >= 22)":
            D["a_tv_body_tip_hour"] >= 22,
        "visitor body clock before 5pm (a_tv_body_tip_hour <= 17)":
            D["a_tv_body_tip_hour"] <= 17,
        "combined trailing load top decile (sum_tv_km_7d)":
            D["sum_tv_km_7d"] >= D["sum_tv_km_7d"].quantile(0.90),
        "visitor deep in a road trip (a_tv_days_since_home >= 8)":
            D["a_tv_days_since_home"] >= 8,
    }
    for lbl, msk in cuts.items():
        m = msk.fillna(False) & ov.notna()
        r_ = (~msk.fillna(False)) & ov.notna()
        if m.sum() < 60:
            L.append(f"| {lbl} | {int(m.sum())} | — | — | too few |")
            continue
        a_, b_ = 100 * ov[m].mean(), 100 * ov[r_].mean()
        L.append(f"| {lbl} | {int(m.sum())} | {a_:.1f} | {b_:.1f} | **{a_-b_:+.1f}** |")
        print(L[-1], flush=True)

    L += ["", "Nothing here is a bet until it survives a shuffle null and holds across "
              "seasons — these rows are a map of where to look, not a signal list.", ""]

    path = os.path.join(ROOT, "NBA_TRAVEL.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
