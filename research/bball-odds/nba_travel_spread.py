#!/usr/bin/env python3
"""Travel lands on the SPREAD, not the total — and in the tails, not on average.

WHAT THE FIRST TRAVEL PASS FOUND (`NBA_TRAVEL.md`). Running the same univariate-vs-shuffle
diagnostic that overturned the round-1 null, on both markets:

    target            best real   best null   count>0.03 real   count>0.03 null
    total residual      0.0299      0.0275           0                1.0
    spread residual     0.0381      0.0298           7                0.9

The total row is a clean null on BOTH statistics. The spread row is the diffuse-signal
fingerprint — seven columns clear the floor where noise gives one — and the seven are not
scattered, they are the CLOCK: `a_tv_trav_tz`, `d_tv_body_tip_hour`, `d_tv_bodyclock_off`,
`d_tv_trav_tz`, `d_tv_east_km`.

That is mechanistically the right answer and I had the market wrong. Fatigue is ASYMMETRIC —
one team flew, the other slept at home — and asymmetry between two teams is precisely what a
spread prices and what a total averages away. I built travel into a totals model, where the
two teams' effects partially cancel, and then read the weak result as "travel doesn't matter".

THE SECOND THING THE FIRST PASS FOUND, which the linear scan is structurally blind to. Direct
cuts on the total:

    visitor at altitude, unacclimatised     n=343    54.8% over vs 50.3% elsewhere   +4.5
    both teams flew 1500km+                 n=702    47.9% over vs 51.0% elsewhere   −3.1
    visitor body clock before 5pm           n=1053   48.2% over vs 51.2% elsewhere   −2.9

A correlation computed across all 5,271 games cannot see these, because 93% of games have
`alt_exposure` at essentially zero — the effect is a THRESHOLD, and a linear correlation
against a column that is zero almost everywhere is near zero by construction. "No linear
correlation" and "no effect" are not the same claim, and conflating them is how the altitude
of Denver — the single largest known physical effect on scoring in the sport — went missing
from the frame for this long.

SO THIS FILE DOES TWO THINGS:
  1. Fits the spread residual, base vs base+travel vs travel-only, on identical folds, with a
     within-season label-shuffle null and the phase/season split.
  2. Puts the tail cuts through the test the first pass explicitly said they had not had:
     a shuffle null on the cut statistic itself, and a per-season breakdown. A cut that only
     works in two of four seasons is not a signal, however good the pooled number looks.
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
spec2 = importlib.util.spec_from_file_location("tl", os.path.join(ROOT, "nba_travel_lab.py"))
tl = importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(tl)

K_SPREAD = 2.0


def edge_of(g):
    return np.nan if g["n"] == 0 else g["win"] - g["base"]


def grade_spread(pred, yb, ph, pa, k, mask=None):
    """Bet the home side when the model likes it by k+ points, the away side when it hates it.

    `yb` = 1 when the HOME team covered the T-60 spread. Prices are the two sides of that
    spread. Baseline is the best blind side inside the same rows, so a slate that is 55% home
    -covers is not allowed to masquerade as a 55% model.
    """
    ok = pred.notna() & yb.notna()
    if mask is not None:
        ok = ok & mask
    m = ok & (pred.abs() >= k)
    if m.sum() < 25:
        return dict(n=0, win=np.nan, base=np.nan, roi=np.nan)
    side = pred[m] > 0                       # True = back the HOME side
    win = np.where(side, yb[m], 1 - yb[m])
    dec = np.where(side, ph[m], pa[m])
    return dict(n=int(m.sum()), win=100 * win.mean(),
                base=100 * max(yb[m].mean(), 1 - yb[m].mean()),
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def cut_null(D, msk, ov, nshuf=200, seed=3):
    """How often does a random cut of this size beat the rest of the slate by this much?

    The tail cuts were chosen by looking at the data, so their pooled numbers are worth
    whatever a search of that size is worth. This prices the search: resample a random subset
    of the same size within each season and rebuild the same statistic.
    """
    rng = np.random.default_rng(seed)
    m = msk & ov.notna()
    real = 100 * ov[m].mean() - 100 * ov[(~msk) & ov.notna()].mean()
    per_season = {s: int((msk & (D["season"] == s) & ov.notna()).sum())
                  for s in D["season"].unique()}
    draws = []
    for _ in range(nshuf):
        pick = pd.Series(False, index=D.index)
        for s, n in per_season.items():
            pool = D.index[(D["season"] == s) & ov.notna()]
            if n and len(pool) >= n:
                pick.loc[rng.choice(pool, n, replace=False)] = True
        draws.append(100 * ov[pick].mean() - 100 * ov[(~pick) & ov.notna()].mean())
    d = np.array(draws)
    return real, float(d.mean()), float(d.std(ddof=1)), (real - d.mean()) / d.std(ddof=1)


def main():
    D = v2.build()
    D, tcols = tl.attach_travel(D)
    tcols = [c for c in tcols if c not in v2.leak_screen(D, tcols)]

    base_cols = v2.feature_cols(D)
    base_cols = [c for c in base_cols if c not in v2.leak_screen(D, base_cols)]
    # the spread's own line level, the analogue of t60_total_point in the totals build
    if "t60_spread_home_point" not in base_cols:
        base_cols = base_cols + ["t60_spread_home_point"]

    # ---- verify the residual's sign before betting a single simulated dollar on it ---------
    chk = D[["y_fg_margin", "t60_spread_home_point", "y_fg_marg_resid"]].dropna()
    alt = chk["y_fg_margin"] + chk["t60_spread_home_point"]
    assert np.allclose(alt, chk["y_fg_marg_resid"], atol=1e-6), \
        "y_fg_marg_resid is not margin + home spread; the bet side would be inverted"
    print("[check] y_fg_marg_resid = home margin + home spread; positive = HOME covered",
          flush=True)

    ys = D["y_fg_marg_resid"].astype(float)
    sb = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=D.index)
    ph = pd.Series(v2.to_dec(D["t60_spread_home_price"]), index=D.index)
    pa = pd.Series(v2.to_dec(D["t60_spread_away_price"]), index=D.index)
    print(f"[frame] home covers {100*sb.mean():.1f}% of {sb.notna().sum():,} gradeable spreads",
          flush=True)

    L = ["# NBA travel — it lands on the SPREAD, and in the tails", "",
         "The first pass (`NBA_TRAVEL.md`) ran the univariate-vs-shuffle diagnostic on both "
         "markets. The total was a clean null on both statistics; the spread showed the "
         "diffuse fingerprint — **7 columns above 0.03 where the shuffle gives 0.9** — and the "
         "seven were all clock and direction columns. That is the mechanically correct answer: "
         "fatigue is *asymmetric*, one team flew and the other slept at home, and asymmetry is "
         "what a spread prices and what a total averages away. I had built travel into a "
         "totals model, where the two teams' effects partly cancel.", "",
         f"{len(D):,} gradeable games, home covers {100*sb.mean():.1f}%. Bets are taken when "
         f"the model disagrees with the spread by ≥{K_SPREAD:.0f} points. `base` is the best "
         f"blind side inside the same rows; breakeven at −110 is 52.4%.", ""]

    # ---- 1. the spread model ---------------------------------------------------------------
    print("\n=== spread model ===", flush=True)
    runs = {}
    for tag, cols in (("base", base_cols),
                      ("base + travel", base_cols + tcols),
                      ("travel only", tcols)):
        X = D[cols].astype(float)
        p = v2.walk(X, D["date"], ys, kind="ridge")
        m = p.notna() & ys.notna()
        r = np.corrcoef(p[m], ys[m])[0, 1]
        g = grade_spread(p, sb, ph, pa, K_SPREAD)
        runs[tag] = (p, r, g, len(cols))
        print(f"[{tag:14s}] cols {len(cols):4d}  oos corr {r:+.4f}  n {g['n']:5d}  "
              f"win {g['win']:.1f}  base {g['base']:.1f}  edge {edge_of(g):+.1f}  "
              f"ROI {g['roi']:+.1f}", flush=True)

    L += ["## 1. Spread model — does travel add?", "",
          "| feature set | cols | oos corr | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|"]
    for tag, (p, r, g, nc) in runs.items():
        L.append(f"| {tag} | {nc} | `{r:+.4f}` | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{edge_of(g):+.1f}** | {g['roi']:+.1f} |")

    # ---- 2. null on the spread arm ---------------------------------------------------------
    print("\n=== shuffle null (spread, base+travel) ===", flush=True)
    X = D[base_cols + tcols].astype(float)
    rng = np.random.default_rng(23)
    nr, ne = [], []
    for i in range(8):
        yy = ys.copy()
        for s in D["season"].unique():
            msk = (D["season"] == s) & ys.notna()
            yy.loc[msk] = rng.permutation(ys.loc[msk].values)
        pp = v2.walk(X, D["date"], yy, kind="ridge")
        bb = pd.Series(np.where(yy > 0, 1.0, np.where(yy < 0, 0.0, np.nan)), index=D.index)
        mm = pp.notna() & yy.notna()
        nr.append(np.corrcoef(pp[mm], yy[mm])[0, 1])
        ne.append(edge_of(grade_spread(pp, bb, ph, pa, K_SPREAD)))
        print(f"[null {i+1}/8] corr {nr[-1]:+.4f}  edge {ne[-1]:+.2f}", flush=True)
    nr, ne = np.array(nr), np.array(ne)
    _, rr, gg, _ = runs["base + travel"]
    L += ["", "## 2. Label-shuffle null (base + travel, 8 draws, permuted within season)", "",
          "| statistic | real | null mean | null sd | z |", "|---|---|---|---|---|",
          f"| oos corr | {rr:+.4f} | {nr.mean():+.4f} | {nr.std(ddof=1):.4f} | "
          f"**{(rr-nr.mean())/nr.std(ddof=1):+.2f}** |",
          f"| edge | {edge_of(gg):+.2f} | {ne.mean():+.2f} | {ne.std(ddof=1):.2f} | "
          f"**{(edge_of(gg)-ne.mean())/ne.std(ddof=1):+.2f}** |"]
    print("\n".join(L[-2:]), flush=True)

    # ---- 3. phase / season ------------------------------------------------------------------
    print("\n=== phase / season (spread) ===", flush=True)
    pb, pt = runs["base"][0], runs["base + travel"][0]
    L += ["", "## 3. Phase and season", "",
          "| slice | n | base edge | +travel edge | base ROI | +travel ROI |",
          "|---|---|---|---|---|---|"]
    for lbl, msk in ([(ph_, D["phase"] == ph_) for ph_ in ("EARLY", "MID", "LATE", "POST")] +
                     [(str(s), D["season"] == s) for s in sorted(D["season"].unique())]):
        gb = grade_spread(pb, sb, ph, pa, K_SPREAD, mask=msk)
        gt = grade_spread(pt, sb, ph, pa, K_SPREAD, mask=msk)
        if gb["n"] == 0 and gt["n"] == 0:
            continue
        L.append(f"| {lbl} | {gt['n']} | {edge_of(gb):+.1f} | **{edge_of(gt):+.1f}** | "
                 f"{gb['roi']:+.1f} | {gt['roi']:+.1f} |")
        print(L[-1], flush=True)

    # ---- 4. the tail cuts, now with a null and a per-season split ---------------------------
    # These were surfaced by looking at the data. That search has to be priced, and the pooled
    # number has to be broken by season -- a cut that works in two of four seasons is noise
    # with a good headline.
    print("\n=== tail cuts, nulled and split by season ===", flush=True)
    ov = pd.Series(np.where(D["y_fg_tot_resid"] > 0, 1.0,
                            np.where(D["y_fg_tot_resid"] < 0, 0.0, np.nan)), index=D.index)
    seasons = sorted(D["season"].unique())
    L += ["", "## 4. The tail cuts on the TOTAL — priced against a matched-size random cut", "",
          "A linear correlation across 5,271 games is blind to these: 93% of games sit at "
          "essentially zero `alt_exposure`, so a threshold effect shows up as ~0 correlation "
          "by construction. That is why the scan says the total is null and these rows do not. "
          "`z` compares the cut's over-rate gap against 200 random cuts of the same size drawn "
          "within the same seasons — it prices the fact that I went looking.", "",
          "| cut | n | over% | rest | diff | z vs random cut | " +
          " | ".join(str(s) for s in seasons) + " |",
          "|---|---|---|---|---|---|" + "---|" * len(seasons)]
    cuts = {
        "visitor unacclimatised at altitude (a_tv_alt_exposure > 1200)":
            (D["a_tv_alt_exposure"] > 1200),
        "both teams flew 1500km+ (sum_tv_trav_km > 3000)": (D["sum_tv_trav_km"] > 3000),
        "visitor body clock before 5pm (a_tv_body_tip_hour <= 17)":
            (D["a_tv_body_tip_hour"] <= 17),
        "visitor body clock past 10pm (a_tv_body_tip_hour >= 22)":
            (D["a_tv_body_tip_hour"] >= 22),
    }
    for lbl, msk in cuts.items():
        msk = msk.fillna(False)
        real, nm, nsd, z = cut_null(D, msk, ov)
        per = []
        for s in seasons:
            mm = msk & (D["season"] == s) & ov.notna()
            per.append(f"{100*ov[mm].mean():.0f}% ({int(mm.sum())})" if mm.sum() >= 30 else "—")
        L.append(f"| {lbl} | {int((msk & ov.notna()).sum())} | "
                 f"{100*ov[msk & ov.notna()].mean():.1f} | "
                 f"{100*ov[(~msk) & ov.notna()].mean():.1f} | **{real:+.1f}** | "
                 f"**{z:+.2f}** | " + " | ".join(per) + " |")
        print(L[-1], flush=True)

    L += ["", "A cut needs three things before it is a signal: a z that survives the "
              "matched-size null, the same sign in every season, and a mechanism. Read the "
              "season columns first — a pooled number that comes from two of four seasons is "
              "a good headline and nothing else.", ""]

    path = os.path.join(ROOT, "NBA_TRAVEL_SPREAD.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
