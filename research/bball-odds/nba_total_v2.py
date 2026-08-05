#!/usr/bin/env python3
"""NBA FULL-GAME TOTAL, round 2: the diffuse-signal build.

WHAT ROUND 1 GOT WRONG. `nba_total_lab.py` threw 1,678 features at a gradient-boosted
classifier trained on 700-4,000 rows per refit. In a market where the true edge is one or two
points of win rate, that ratio guarantees the trees fit noise -- and the ablation proved it:
DELETING 41 market columns moved the full model from 51.7% to 53.4%. A result that swings 1.7
points on the removal of 2% of the inputs is a variance measurement, not a signal measurement.

WHAT THE UNIVARIATE SCAN SAYS. Correlating all 931 pregame columns against the residual and
comparing to 40 within-column label shuffles:

    best single |corr|          0.058   (95th percentile of the shuffled null's best -- nothing)
    count of |corr| > 0.04         32   (the null produces ~1)

Those two lines are the whole thesis. NO SINGLE FEATURE beats chance, so every "find the one
predictor" search was always going to come back empty. But thirty-two columns clear 0.04 when
noise gives you one, so the information is REAL and it is DIFFUSE -- thirty small pushes, not
one big one. That is precisely the regime where a tree ensemble is the wrong estimator (it
must spend splits to find any one of them, and none is strong enough to earn a split) and a
regularised LINEAR model is the right one (it sums them).

WHAT THE THIRTY-TWO ARE. They are not scattered; they cluster into five themes:
  usage concentration  h_l5_adv_usg_max, h_l3_adv_usg_max, sum_l5_adv_usg_max, usage_pct
  fresh absences       d_abs_fresh_sum_ppg, a_abs_fresh_sum_min, a_abs_fresh_n
  perimeter defence    a_s_d_p3_pct, sum_s_d_p3_pct
  fouling defence      h_s_d_ftr
  recent form          h_l5_margin, h_form_margin
So the feature set below is built from those themes ON PURPOSE, a priori, instead of from
everything we happen to own.

TWO THINGS THAT DIED ON THE WAY IN, both worth writing down:

  1. THE OPPONENT-ADJUSTED RATINGS ARE BROKEN. h_adj_off correlates -0.015 with the total and
     -0.015 with the line; h_adj_tempo_pts correlates +0.001 with the total. A working
     opponent-adjusted rating correlates ~0.3 with the result and ~0.6 with the line. These
     columns contain nothing, and they are the closest thing in the frame to what production
     feeds its total model. They are excluded here and flagged in the brief.

  2. STRUCTURAL PACE x EFFICIENCY DOES NOT BEAT THE LINE. Built properly -- expanding as-of
     league means, exp_poss = pace_h + pace_a - lg_pace, exp_ortg = off + opp_def - lg_off,
     total = poss * (ortg_h + ortg_a)/100 -- it lands corr +0.335 with the total and +0.753
     with the line, i.e. it IS a real total model. But its MAE is 15.12 against the line's
     14.28 even calibrated in-sample, and its deviation from the line correlates -0.015 with
     the residual (negative in 3 of 4 seasons). Betting the gap loses at every threshold from
     0 to 10 points. It is kept as ONE feature, not as the model.

GRADING. Trained on the continuous residual, not the sign, so the size of the disagreement
survives to the bet rule. Bets are taken on |predicted residual| >= k POINTS -- a threshold a
bettor can actually read -- rather than a confidence percentile. Every win rate sits next to
the best blind side computed inside its own rows; breakeven at -110 is 52.4%. Phases, seasons,
and a within-season label shuffle all run before anything is claimed.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.linear_model import Ridge
from sklearn.ensemble import HistGradientBoostingRegressor

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

REFIT_DAYS = 28
MIN_TRAIN = 1500      # round 1 used 700; a linear model wants far more rows than columns
ALPHAS = (30.0, 100.0, 300.0, 1000.0)   # averaged, not selected -- selecting is another search


# ---------------------------------------------------------------------------------- frame
def asof_league_mean(D, ch, ca):
    """League average of a team stat, using only games already played this season.

    A structural total needs a league baseline (pace_h + pace_a - lg_pace). Using the season's
    final average would leak the rest of the year into October, so this expands and shifts.
    """
    out = pd.Series(index=D.index, dtype=float)
    for _, g in D.groupby("season"):
        v = (D.loc[g.index, ch] + D.loc[g.index, ca]) / 2
        out.loc[g.index] = v.expanding().mean().shift(1)
    return out


def build():
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    n0 = len(D)
    D = D[D[["y_fg_total", "t60_total_point", "t60_total_over_price", "t60_total_under_price",
             "y_fg_tot_resid"]].notna().all(axis=1)].copy()
    D["date"] = pd.to_datetime(D["date"])
    D = D.sort_values("date").reset_index(drop=True)
    print(f"[frame] {n0:,} -> {len(D):,} gradeable games", flush=True)

    # --- structural pace x efficiency. One feature, not the model. See the docstring.
    lp = asof_league_mean(D, "h_s2d_adv_pace", "a_s2d_adv_pace")
    lo = asof_league_mean(D, "h_s2d_ortg", "a_s2d_ortg")
    poss = D["h_s2d_adv_pace"] + D["a_s2d_adv_pace"] - lp
    oh = D["h_s2d_ortg"] + D["a_s2d_adv_defensive_rating"] - lo
    oa = D["a_s2d_ortg"] + D["h_s2d_adv_defensive_rating"] - lo
    D["st_total"] = poss * (oh + oa) / 100.0
    D["st_gap"] = D["st_total"] - D["t60_total_point"]
    D["st_poss"] = poss
    D["st_eff"] = (oh + oa) / 2.0

    # phase, same definition as round 1 so the two studies are comparable
    gp = pd.to_numeric(D.get("h_gp"), errors="coerce")
    post = pd.to_numeric(D.get("game.postseason").astype(float), errors="coerce").fillna(0)
    D["phase"] = np.where(post > 0, "POST",
                  np.where(gp < 20, "EARLY",
                   np.where(gp < 50, "MID", "LATE")))
    print("[frame] phases:", D["phase"].value_counts().to_dict(), flush=True)
    return D


# ------------------------------------------------------------------------------- features
THEMES = {
    # Four of the eleven strongest columns in the univariate scan are usage concentration.
    # Mechanism: a team funnelling possessions through one high-usage creator scores
    # differently from one distributing them, and the total line is set off team pace and
    # efficiency, which cannot see that shape.
    "usage": ["adv_usg_max", "adv_usage_percentage", "pts_hhi", "min_hhi",
              "top_min_share", "adv_rot_n"],
    # Recent scoring form. Weak individually, and the market prices most of it -- included
    # because the scan says the leftovers are non-zero, not because form is a secret.
    "form":  ["margin", "ortg", "total", "adv_pace", "own_score", "opp_score", "efg"],
}
WINDOWS = ("l3", "l5", "l10", "s2d")
SIDES = ("h", "a", "sum", "d")


def feature_cols(D):
    """~100 columns chosen a priori from the five themes the scan surfaced.

    Round 1 took every column we own (1,678) and asked the model to sort them out. With ~3,000
    training rows that is hopeless. This takes two orders of magnitude fewer and picks them
    from the themes that cleared the noise floor, then hands them to a model that can actually
    use a hundred weak inputs.
    """
    have = set(D.columns)
    cols = []

    for _, stats in THEMES.items():
        for s in SIDES:
            for w in WINDOWS:
                cols += [f"{s}_{w}_{st}" for st in stats if f"{s}_{w}_{st}" in have]

    # absences: three of the top fifteen. `fresh` = newly out, which is the only variant that
    # ever tested positive in the NBA work -- stale absences are priced.
    cols += [c for c in D.columns if "_abs_" in c]
    # style, season-to-date only (the bare style columns are that game's own box score --
    # see leak-screen memory). d_ prefixed ones inside style_nba are DEFENCE allowed.
    cols += [c for c in D.columns if any(c.startswith(f"{s}_s_") for s in SIDES)
             and "trk_" not in c]
    # schedule / rest, and the short-window form deltas
    cols += [c for c in D.columns if "_sched" in c or "_form" in c]
    # the structural model, as a single input
    cols += ["st_total", "st_gap", "st_poss", "st_eff"]
    # the line level itself: not to predict from, but so the model can express "high totals
    # behave differently", which is a real and heavily-documented effect in every sport
    cols += ["t60_total_point"]

    cols = [c for c in dict.fromkeys(cols) if c in have
            and pd.api.types.is_numeric_dtype(D[c])
            and D[c].notna().mean() > 0.80 and D[c].nunique() > 5]

    # The opponent-adjusted ratings are excluded by construction, but assert it: they correlate
    # -0.015 / +0.001 with the total and would only add noise dimensions.
    assert not any("_adj_" in c for c in cols), "broken adj_ ratings leaked into the feature set"
    return cols


def leak_screen(D, cols, tol=0.10):
    """A feature must track the LINE at least as well as it tracks the RESULT.

    Any genuine pregame driver of scoring is already priced. A column that knows the final
    score but not the line has seen the box score. This caught two families in round 1 and
    runs on every build now. See memory: leak-screen-line-vs-result.
    """
    y, line = D["y_fg_total"], D["t60_total_point"]
    bad = []
    for c in cols:
        if c in ("t60_total_point", "st_gap"):     # the line, and the line by construction
            continue
        x = pd.to_numeric(D[c], errors="coerce")
        m = x.notna() & y.notna() & line.notna()
        if m.sum() < 500:
            continue
        a = abs(np.corrcoef(x[m], y[m])[0, 1])
        b = abs(np.corrcoef(x[m], line[m])[0, 1])
        if a - b > tol:
            bad.append((c, a, b))
    if bad:
        print(f"[LEAK] dropping {len(bad)}:", flush=True)
        for c, a, b in sorted(bad, key=lambda t: -(t[1] - t[2]))[:10]:
            print(f"        {c:32s} result {a:.3f} vs line {b:.3f}", flush=True)
    return {c for c, _, _ in bad}


# -------------------------------------------------------------------------------- fitting
def walk(X, dates, y, kind="ridge", seed=0):
    """Rolling-origin refit, predicting the residual in POINTS.

    Standardisation is refit on each training window only -- fitting the scaler on the full
    frame is a quiet leak of future variance into past predictions.
    """
    P = pd.Series(index=X.index, dtype=float)
    idx = pd.DatetimeIndex(dates)
    starts = sorted({d for d in pd.date_range(idx.min(), idx.max(), freq=f"{REFIT_DAYS}D")
                     if (idx < d).sum() >= MIN_TRAIN})
    for i, d0 in enumerate(starts):
        d1 = starts[i + 1] if i + 1 < len(starts) else idx.max() + pd.Timedelta(days=1)
        tr = X.index[(idx < d0) & y.notna()]
        te = X.index[(idx >= d0) & (idx < d1)]
        if len(te) == 0 or len(tr) < MIN_TRAIN:
            continue
        A, B = X.loc[tr], X.loc[te]
        mu, sd = A.mean(), A.std().replace(0, 1.0)
        A = ((A - mu) / sd).fillna(0.0)
        B = ((B - mu) / sd).fillna(0.0)
        if kind == "ridge":
            # average over the alpha grid instead of picking one: choosing the best alpha on
            # the same data you report is one more selection to pay for in the null
            pr = np.mean([Ridge(alpha=a).fit(A, y.loc[tr]).predict(B) for a in ALPHAS], axis=0)
        else:
            m = HistGradientBoostingRegressor(max_iter=200, learning_rate=0.03,
                                              max_leaf_nodes=8, min_samples_leaf=60,
                                              l2_regularization=5.0, random_state=seed)
            pr = m.fit(A, y.loc[tr]).predict(B)
        P.loc[te] = pr
    return P


def to_dec(a):
    """nba_model_features stores DECIMAL prices (t60 totals sit at 1.909 = -110)."""
    a = pd.to_numeric(a, errors="coerce")
    am = a.abs() >= 100
    return np.where(am, np.where(a < 0, 1 + 100.0 / a.abs().clip(lower=1e-9), 1 + a / 100.0), a)


def grade(pred, yb, po, pu, k, mask=None):
    """Bet when the model disagrees with the line by at least k POINTS."""
    ok = pred.notna() & yb.notna()
    if mask is not None:
        ok = ok & mask
    m = ok & (pred.abs() >= k)
    if m.sum() < 25:
        return dict(n=0, win=np.nan, base=np.nan, roi=np.nan)
    side = pred[m] > 0                      # True = model says OVER
    win = np.where(side, yb[m], 1 - yb[m])
    dec = np.where(side, po[m], pu[m])
    base = max(yb[m].mean(), 1 - yb[m].mean())
    return dict(n=int(m.sum()), win=100 * win.mean(), base=100 * base,
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def main():
    D = build()
    cols = feature_cols(D)
    cols = [c for c in cols if c not in leak_screen(D, cols)]
    print(f"[features] {len(cols)} columns (round 1 used 1,678)", flush=True)

    X = D[cols].astype(float)
    yc = D["y_fg_tot_resid"].astype(float)                      # continuous target, in points
    yb = pd.Series(np.where(yc > 0, 1.0, np.where(yc < 0, 0.0, np.nan)), index=D.index)
    po = pd.Series(to_dec(D["t60_total_over_price"]), index=D.index)
    pu = pd.Series(to_dec(D["t60_total_under_price"]), index=D.index)

    L = ["# NBA full-game total — round 2 (diffuse signal, regularised linear)", "",
         f"{len(D):,} gradeable games, seasons {sorted(D['season'].unique())}, "
         f"**{len(cols)} features** (round 1 used 1,678). Target is the residual vs the T-60 "
         f"close in points. Bets are taken on |predicted residual| ≥ k points. `base` is the "
         f"best blind side inside the same rows; breakeven at −110 is 52.4%.", ""]

    preds = {}
    for kind in ("ridge", "hgb"):
        p = walk(X, D["date"], yc, kind=kind)
        preds[kind] = p
        m = p.notna() & yc.notna()
        # the single most honest number in the file: out-of-sample correlation between what
        # the model says the residual will be and what it actually was
        r = np.corrcoef(p[m], yc[m])[0, 1]
        print(f"[{kind}] oos corr(pred, actual residual) = {r:+.4f}  on n={m.sum():,}", flush=True)
        L.append(f"- **{kind}**: out-of-sample corr(predicted residual, actual residual) = "
                 f"`{r:+.4f}` over {m.sum():,} games")
    # blend: ridge finds the diffuse linear part, the tree finds whatever interaction is left
    preds["blend"] = (preds["ridge"] + preds["hgb"]) / 2
    m = preds["blend"].notna() & yc.notna()
    rb = np.corrcoef(preds["blend"][m], yc[m])[0, 1]
    print(f"[blend] oos corr = {rb:+.4f}", flush=True)
    L.append(f"- **blend**: `{rb:+.4f}`")

    # ---- threshold ladder ----------------------------------------------------------------
    L += ["", "## Bet threshold ladder", "",
          "| model | k (pts) | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|---|"]
    for kind, p in preds.items():
        for k in (0.0, 1.0, 2.0, 3.0, 4.0, 5.0):
            g = grade(p, yb, po, pu, k)
            if g["n"] == 0:
                continue
            L.append(f"| {kind} | ≥{k:.0f} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print(L[-1], flush=True)

    # ---- phases and seasons on the blend --------------------------------------------------
    best = preds["blend"]
    L += ["", "## By phase (blend, k ≥ 2)", "",
          "| phase | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for ph in ("EARLY", "MID", "LATE", "POST"):
        g = grade(best, yb, po, pu, 2.0, mask=(D["phase"] == ph))
        if g["n"] == 0:
            continue
        L.append(f"| {ph} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)

    L += ["", "## By season (blend, k ≥ 2)", "",
          "| season | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for s in sorted(D["season"].unique()):
        g = grade(best, yb, po, pu, 2.0, mask=(D["season"] == s))
        if g["n"] == 0:
            continue
        L.append(f"| {s} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)

    # ---- null -----------------------------------------------------------------------------
    # Ridge only: it is the estimator the thesis rests on, and 8 shuffles of it cost less than
    # 3 of the blend. The statistic shuffled is the CORRELATION, which is the claim.
    rng = np.random.default_rng(11)
    nulls_r, nulls_e = [], []
    for i in range(8):
        ys = yc.copy()
        for s in D["season"].unique():
            msk = (D["season"] == s) & yc.notna()
            ys.loc[msk] = rng.permutation(yc.loc[msk].values)
        ps = walk(X, D["date"], ys, kind="ridge")
        ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=D.index)
        mm = ps.notna() & ys.notna()
        nulls_r.append(np.corrcoef(ps[mm], ys[mm])[0, 1])
        gg = grade(ps, ybs, po, pu, 2.0)
        nulls_e.append(gg["win"] - gg["base"])
        print(f"[null {i+1}/8] corr {nulls_r[-1]:+.4f}  edge@k2 {nulls_e[-1]:+.2f}", flush=True)

    mr = preds["ridge"].notna() & yc.notna()
    real_r = np.corrcoef(preds["ridge"][mr], yc[mr])[0, 1]
    real_e = (lambda g: g["win"] - g["base"])(grade(preds["ridge"], yb, po, pu, 2.0))
    nr, ne = np.array(nulls_r), np.array(nulls_e)
    L += ["", "## Label-shuffle null (ridge, 8 draws, permuted within season)", "",
          "| statistic | real | null mean | null sd | z |", "|---|---|---|---|---|",
          f"| oos corr | {real_r:+.4f} | {nr.mean():+.4f} | {nr.std(ddof=1):.4f} | "
          f"**{(real_r-nr.mean())/nr.std(ddof=1):+.2f}** |",
          f"| edge @ k≥2 | {real_e:+.2f} | {ne.mean():+.2f} | {ne.std(ddof=1):.2f} | "
          f"**{(real_e-ne.mean())/ne.std(ddof=1):+.2f}** |", ""]
    print("\n".join(L[-4:]), flush=True)

    path = os.path.join(ROOT, "NBA_TOTAL_V2.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
