#!/usr/bin/env python3
"""Do process-vs-results features predict the NBA spread residual? Sides model, walk-forward.

The hypothesis, stated with its sign BEFORE fitting so it cannot be reinterpreted after:

  H1  A team flattered by recent shooting luck is overrated by the market and should
      UNDERPERFORM the spread. corr(d_luck_net, residual) < 0.
  H2  Expected eFG (process) should predict the residual BETTER than actual eFG (results),
      because the market already prices results. |corr(d_xefg_net)| > |corr(d_aefg_net)|.
  H3  A team whose RAPM talent exceeds its trailing margin is better than its record and
      should OUTPERFORM. corr(talent − results, residual) > 0.

Any of these coming back the wrong sign is a result, not a thing to re-lever until it works.

TARGET is the market residual (actual margin + posted spread), so R² is measured against
predicting a zero residual -- i.e. against trusting the line. Negative R² means the features
are worse than the market. That is the only honest scoreboard for a sides model.

Graded at BOTH the opener and the T-60 close, always, per the standing rule: the absence
signal in NBA_ABSENCE_SUMMARY.md was strong vs the opener and worth nothing vs the close,
and a model tested only against one of them cannot tell those two cases apart.

Every win rate is printed next to the baseline OF ITS OWN SLICE, and because that baseline
is max(home, away) chosen with hindsight, a coin flip scores about −2 on it. So the null
column, not zero, is the comparison.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

from nba_out_isolate import to_dec

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
N_PERM = 2000
MIN_TRAIN = 600
RNG = np.random.default_rng(31)

MKT = {"OPEN": ("y_open", "open_spread_home_price", "open_spread_away_price"),
       "T-60": ("y_fg_marg_resid", "t60_spread_home_price", "t60_spread_away_price")}


def load():
    R = pd.read_parquet(f"{OUT}/nba_regression_features.parquet")
    cols = ["talent_m", "talent_sd", "r_luck_off", "r_luck_def", "r_luck_net",
            "r_xefg", "r_xefg_a", "r_xefg_net", "r_aefg_net", "r_aefg", "r_aefg_a"]
    H = R[R["is_home"]][["game.id"] + cols].rename(columns={c: f"h_{c}" for c in cols})
    A = R[~R["is_home"]][["game.id"] + cols].rename(columns={c: f"a_{c}" for c in cols})
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    d = F.merge(H, on="game.id", how="inner").merge(A, on="game.id", how="inner")
    d["y_open"] = d["y_fg_margin"] + d["open_spread_home_point"]

    # the builder prefixes rolling columns with r_; drop it so feature names read cleanly
    for c in cols:
        short = c[2:] if c.startswith("r_") else c
        d[f"d_{short}"] = d[f"h_{c}"] - d[f"a_{c}"]
    # the regression claim itself: talent the market cannot see, minus the results it can
    d["d_results"] = d["h_l10_margin"] - d["a_l10_margin"]
    d["d_gap"] = d["d_talent_m"] - d["d_results"]
    d["mkt_spread"] = pd.to_numeric(d["t60_spread_home_point"], errors="coerce")
    tot = [c for c in ("t60_total_point", "t60_total_over_point", "open_total_point")
           if c in d.columns]
    d["mkt_total"] = pd.to_numeric(d[tot[0]], errors="coerce") if tot else 0.0
    d = d.sort_values("date").reset_index(drop=True) if "date" in d else d
    return d


FEATS = ["d_talent_m", "d_talent_sd", "d_gap", "d_results", "d_luck_net", "d_luck_off",
         "d_luck_def", "d_xefg_net", "d_aefg_net", "d_xefg", "d_xefg_a"]

SETS = {"shot-quality luck only": ["d_luck_net", "d_luck_off", "d_luck_def"],
        "process (xefg) only": ["d_xefg_net", "d_xefg", "d_xefg_a"],
        "results (aefg) only": ["d_aefg_net"],
        "RAPM talent only": ["d_talent_m", "d_talent_sd"],
        "talent minus results": ["d_gap"],
        "ALL process+talent": FEATS,
        # xEFG alone is a 3-feature model with no idea what game it is looking at. Giving
        # it the posted line and total lets it learn where shot quality matters rather than
        # applying one flat coefficient to blowouts and coin flips alike.
        "process + market context": ["d_xefg_net", "d_xefg", "d_xefg_a", "d_luck_net",
                                     "d_talent_m", "d_results", "mkt_spread", "mkt_total"]}


def walk_forward(d, X, y, model):
    """Expanding-window fit ordered by game date; predict each block from its past only."""
    order = np.argsort(d["gm_date"].to_numpy())
    pred = np.full(len(d), np.nan)
    Xo, yo = X[order], y[order]
    blocks = np.array_split(np.arange(len(d)), 24)
    seen = 0
    for b in blocks:
        if seen >= MIN_TRAIN:
            tr = slice(0, seen)
            ok = np.isfinite(yo[tr]) & np.isfinite(Xo[tr]).all(axis=1)
            if ok.sum() >= MIN_TRAIN:
                sc = StandardScaler().fit(Xo[tr][ok])
                m = model()
                m.fit(sc.transform(Xo[tr][ok]), yo[tr][ok])
                te = np.isfinite(Xo[b]).all(axis=1)
                if te.any():
                    pred[order[b[te]]] = m.predict(sc.transform(Xo[b][te]))
        seen += len(b)
    return pred


def bet_table(d, sig, mkt, counts, L, tag):
    ycol, phc, plc = MKT[mkt]
    y = d[ycol].to_numpy(dtype=float)
    dh, da = to_dec(d[phc]), to_dec(d[plc])
    seas = d["season"].to_numpy()
    ok = np.isfinite(y) & (y != 0) & np.isfinite(sig) & (sig != 0)
    if ok.sum() < 200:
        return
    # Permute only among the rows that are actually bettable. Permuting across NaN rows
    # pushes NaNs into `ok` positions, the quantile goes NaN, every permutation returns
    # nothing and the null silently prints as nan -- which is what the first run did.
    idxs = [np.where(seas == s)[0] for s in np.unique(seas)]
    idxs = [ix[ok[ix]] for ix in idxs]
    idxs = [ix for ix in idxs if len(ix) > 1]

    def score(g, n):
        thr = np.quantile(np.abs(g[ok]), max(0.0, 1.0 - n / ok.sum()))
        m = ok & (np.abs(g) >= thr)
        if m.sum() < 20:
            return None
        hi = g[m] > 0
        win = np.where(hi, y[m] > 0, y[m] < 0)
        base = max((y[m] > 0).mean(), (y[m] < 0).mean())
        roi = np.where(win, np.where(hi, dh[m], da[m]) - 1.0, -1.0).mean()
        return 100 * (win.mean() - base), 100 * win.mean(), 100 * base, 100 * roi, m, win

    for c in counts:
        r = score(sig, c)
        if r is None:
            continue
        e, w, b, roi, m, win = r
        per = " ".join(f"{s}:{100*win[seas[m] == s].mean():.0f}"
                       for s in sorted(set(seas[m])))
        null = np.empty(N_PERM)
        pg = sig.copy()
        for i in range(N_PERM):
            for ix in idxs:
                pg[ix] = sig[RNG.permutation(ix)]
            q = score(pg, c)
            null[i] = q[0] if q else np.nan
        null = null[np.isfinite(null)]
        L.append(f"| {tag} | {mkt} | {m.sum():,} | {w:.1f} | {b:.1f} | **{e:+.1f}** | "
                 f"{null.mean():+.1f} | {(null >= e).mean():.3f} | {roi:+.1f} | {per} |")
        print(L[-1], flush=True)


def main():
    d = load()
    # a stable date for ordering: the odds table's own game date
    dcol = [c for c in d.columns if c.lower() in ("date", "game_date", "gm_date")]
    d["gm_date"] = pd.to_datetime(d[dcol[0]]) if dcol else pd.to_datetime(d["game.id"],
                                                                          errors="coerce")
    L = ["# NBA sides — process-vs-results features from play-by-play", ""]

    # ---- H1/H2/H3: signs first, before any model ----------------------------------
    L += ["## Pre-registered hypotheses, tested as raw correlations", "",
          "Correlation with the T-60 spread residual (positive = home covers more). "
          "Sign, not size, is the test.", "",
          "| feature | corr vs T-60 resid | corr vs OPEN resid | n |", "|---|---|---|---|"]
    for c, lab in [("d_luck_net", "H1 shooting luck (expect NEGATIVE)"),
                   ("d_xefg_net", "H2 process xEFG"),
                   ("d_aefg_net", "H2 results aEFG"),
                   ("d_gap", "H3 talent − results (expect POSITIVE)"),
                   ("d_talent_m", "RAPM talent"),
                   ("d_results", "trailing margin (market's view)")]:
        v = d[c].to_numpy(dtype=float)
        out = []
        for mk in ("T-60", "OPEN"):
            yy = d[MKT[mk][0]].to_numpy(dtype=float)
            m = np.isfinite(v) & np.isfinite(yy)
            out.append(np.corrcoef(v[m], yy[m])[0, 1])
        L.append(f"| {lab} (`{c}`) | {100*out[0]:+.2f} | {100*out[1]:+.2f} | {m.sum():,} |")
    print("\n".join(L[-8:]), flush=True)

    # ---- model ceiling -------------------------------------------------------------
    L += ["", "## Walk-forward out-of-sample R² vs trusting the line", "",
          "Target = market residual, so R² > 0 means the features beat the posted spread "
          "and R² < 0 means they are worse than it.", "",
          "| feature set | model | R² vs T-60 | R² vs OPEN | corr T-60 |",
          "|---|---|---|---|---|"]
    models = {"ridge": lambda: Ridge(alpha=25.0),
              "gbm": lambda: HistGradientBoostingRegressor(
                  max_depth=3, learning_rate=0.03, max_iter=300,
                  min_samples_leaf=60, l2_regularization=1.0, random_state=0)}
    best = None
    for sname, feats in SETS.items():
        X = d[feats].to_numpy(dtype=float)
        for mname, mk in models.items():
            r2s, cor = [], np.nan
            for mkt in ("T-60", "OPEN"):
                y = d[MKT[mkt][0]].to_numpy(dtype=float)
                p = walk_forward(d, X, y, mk)
                ok = np.isfinite(p) & np.isfinite(y)
                r2 = 1 - np.sum((y[ok] - p[ok]) ** 2) / np.sum(y[ok] ** 2)
                r2s.append(100 * r2)
                if mkt == "T-60":
                    cor = 100 * np.corrcoef(p[ok], y[ok])[0, 1]
                    if best is None or cor > best[0]:
                        best = (cor, sname, mname, p.copy())
            L.append(f"| {sname} | {mname} | {r2s[0]:+.2f} | {r2s[1]:+.2f} | {cor:+.2f} |")
            print(L[-1], flush=True)

    # ---- bet test on the best model, both markets, with a real null ----------------
    cor, sname, mname, p = best
    L += ["", f"## Bet test — best cell ({sname} / {mname}, corr {cor:+.2f})", "",
          "`edge` = win% − the max-side baseline of the same subset. That baseline is picked "
          "with hindsight, so a coin flip scores about −2; compare to `null mean`, not 0.",
          "",
          "| set | market | bets | win % | base % | edge | null mean | p | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for mkt in ("OPEN", "T-60"):
        bet_table(d, p.copy(), mkt, (400, 800, 1600), L, f"{sname}/{mname}")

    path = os.path.join(ROOT, "NBA_REGRESSION_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
