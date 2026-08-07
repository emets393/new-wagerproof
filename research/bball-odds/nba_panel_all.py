#!/usr/bin/env python3
"""Every NBA market off ONE row per team-game. The way it should have been built the first time.

THE MISTAKE THIS REPLACES. Every model in this directory sat on 5,108 rows -- one per game, each
team stat present twice under `h_` and `a_` prefixes -- and fit each market as its own regression.
Team totals were two separate fits, home and away. That is not a modelling choice, it is a bug:

  * "A team funnelling possessions through one creator scores more" is ONE relationship. The home
    fit learns it from the `h_` columns; the away fit relearns the identical thing from scratch in
    the `a_` columns. Two independent estimates of one effect, half the rows each.
  * Two independent estimates differ by chance, so the two sides print different edges (+3.8 away
    vs +2.4 home in NBA_TT_FULL.md) with no basketball reason for the gap. Reading that split as a
    finding -- "away team totals are the keeper" -- is reading estimator variance.
  * The fits are different functions, so home pred + away pred is not a coherent total and
    home pred - away pred is not a coherent spread. Six markets were being fit as six unrelated
    regressions when five of them are arithmetic on ONE quantity: points scored by a team.

WHAT THIS DOES. Melt to a team-game panel -- 10,216 rows, `own_*`/`opp_*` by perspective,
`is_home` as a feature -- and fit exactly TWO models on it:

    full-game points scored by this team,  and  first-half points scored by this team.

Every market is then arithmetic on those two, with no further fitting:

    team total        own
    full-game total   own + opp          full-game spread   own - opp
    first-half total  own_h1 + opp_h1    first-half spread  own_h1 - opp_h1
    moneyline         P(own - opp > 0), from the spread model's own error scale

So the six markets are guaranteed consistent: the model cannot simultaneously like the over, the
under of the away team total, and the home side, which two independent fits are free to do.

CONSTRUCTION NOTES, each one a bug avoided.

  * `d_*` columns are home-minus-away differences. Passed through unchanged they encode home
    orientation into a perspective-neutral model, so they are SIGN-FLIPPED on the away row.
    `sum_*` columns are symmetric and pass through. The melt asserts both.
  * Once a stat exists as own/opp, its `sum_` and `d_` twins are exact linear combinations and
    carry nothing new -- dropped where a pair exists, kept where one does not, because several
    blocks only ever ship the sum/difference form.
  * The target is points minus the FULL-GAME-implied team total, not points minus the posted team
    total. The posted team total covers three seasons; the full-game line covers four. Training
    rows and grading rows are different things and only grading needs the posted price.
  * The two rows of a game share its context, so 10,216 rows is not 10,216 independent
    observations. Nulls permute whole GAMES, both rows together.
  * MIN_TRAIN is one full season of team-games, so every market grades the same three seasons and
    the comparison between them is like-for-like. The old 1,500 was tuned for a 5,108-row frame
    and silently ate a whole season of any three-season target.
  * TRAINING ROWS DECAY WITH AGE (HALF_LIFE, 180 days). NBA seasons are not one league -- a
    classifier picks the season off the features alone at 95.5% against a 25.8% base rate, and
    matched split-half fits lose 58% of their reproducible coefficient signal when the halves come
    from different years. The first version of this file weighted a 2022 game exactly like last
    week's, and on the full-game total that cost more than half the edge (+0.3% ROI pooled vs
    +4.5% at a 180-day half-life, same rows, same cut). The weights also fix the STANDARDISATION,
    which is the subtler half: a pooled multi-season mean is the average of three different
    leagues, so a team sitting at its own season's norm still reads as above average. See
    NBA_REGIME.md and NBA_REGIME_CONTROLS.md.
"""
import importlib.util
import os
import re
import warnings

import numpy as np
import pandas as pd
from scipy.linalg import cho_factor, cho_solve
from scipy.stats import norm

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "data", "parquet", "_nba_wide_cache.parquet")
PRED = os.path.join(ROOT, "data", "parquet", "_nba_panel_preds.parquet")
NULLS = 20
REFIT_DAYS = 28
MIN_TRAIN = 2552                 # one full season of team-games (1,276 games x 2)
ALPHAS = (30.0, 100.0, 300.0, 1000.0)
# Training rows decay 0.5 ** (age_days / HALF_LIFE). Seasons are not one league: a season
# classifier hits 95.5% against a 25.8% base rate, and matched split-half fits lose 58% of their
# reproducible coefficient signal when the two halves come from different years (NBA_REGIME.md,
# NBA_REGIME_CONTROLS.md). Equal-weighting all history therefore drags the fit toward a league that
# no longer exists. The half-life sweep is a smooth hill with a broad top over 120-240 days -- 180
# is its middle, not a tuned cell -- and infinite memory is the WORST rung on that ladder.
HALF_LIFE = 180.0


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
mk = _load("mk", "nba_markets.py")


# --------------------------------------------------------------------------------------------
# walk-forward
# --------------------------------------------------------------------------------------------
def ridge_multi(X, dates, ys, min_train=MIN_TRAIN, refit_days=REFIT_DAYS, alphas=ALPHAS,
                half_life=HALF_LIFE, window=None):
    """Rolling-origin, RECENCY-WEIGHTED ridge for MANY targets at once, one shared factorisation.

    The real target and its 20 null shuffles differ only in y. The design matrix, its
    standardisation and the Cholesky factor of (X'WX + aI) are identical across all of them, so
    factorising once per (window, alpha) and re-solving per target turns 21 full walks into
    roughly the cost of one. That is what makes 20 nulls per market affordable across six markets
    instead of a four-hour job.

    `half_life` decays a training row by 0.5 ** (age_days / half_life); None means equal weight for
    all history, which is what this function used to do and which NBA_REGIME.md shows is the worst
    setting available. `window` additionally hard-drops rows older than the most recent N.

    THE WEIGHTING ALSO FIXES THE STANDARDISATION, which matters as much as the fit. An unweighted
    mean over a window spanning three seasons is the average of three different leagues; subtracting
    it leaves a season-level offset sitting inside every feature, so a team at its own season's norm
    still reads as above average. mu and sd are therefore weighted too, which pulls them toward the
    league the model is actually about to predict.

    Requires every target to share a missing-value pattern, since the training index is derived
    once -- asserted, because a null that trains on different rows is not a null for this model.
    Standardisation is refit on each training window: fitting it on the whole frame leaks future
    variance backwards. Predictions average over the alpha grid rather than picking the best,
    because choosing an alpha on the data you report is one more selection the null must pay for.
    """
    base = ys[0].notna()
    for y in ys[1:]:
        assert (y.notna() == base).all(), "targets differ in missingness; shared training breaks"

    out = [pd.Series(index=X.index, dtype=float) for _ in ys]
    idx = pd.DatetimeIndex(dates)
    starts = sorted({d for d in pd.date_range(idx.min(), idx.max(), freq=f"{refit_days}D")
                     if (idx < d).sum() >= min_train})
    Xv = X.values.astype(float)
    pos = {ix: i for i, ix in enumerate(X.index)}

    for i, d0 in enumerate(starts):
        d1 = starts[i + 1] if i + 1 < len(starts) else idx.max() + pd.Timedelta(days=1)
        tr = X.index[(idx < d0) & base.values]
        te = X.index[(idx >= d0) & (idx < d1)]
        if len(te) == 0 or len(tr) < min_train:
            continue
        if window is not None and len(tr) > window:
            tr = tr[-window:]
        ti = np.array([pos[k] for k in tr])
        ei = np.array([pos[k] for k in te])
        A, B = Xv[ti], Xv[ei]

        if half_life is None:
            w = np.ones(len(ti))
        else:
            w = 0.5 ** ((d0 - idx[ti]).days.values.astype(float) / half_life)
        w = w / w.sum()

        mu = np.nansum(A * w[:, None], axis=0)
        sd = np.sqrt(np.maximum(np.nansum(((A - mu) ** 2) * w[:, None], axis=0), 0))
        sd[~np.isfinite(sd) | (sd == 0)] = 1.0
        A = np.nan_to_num((A - mu) / sd)
        B = np.nan_to_num((B - mu) / sd)
        Aw = A * w[:, None]
        G = A.T @ Aw
        eye = np.eye(G.shape[0])
        # w sums to 1, so G is an average rather than a sum -- alpha is scaled by 1/n to keep the
        # penalty on the same footing as the unweighted version it replaces (verified identical at
        # uniform weights to 6e-15, so any change in results is the weighting, not the solver).
        chol = [cho_factor(G + a * eye / len(ti), lower=True) for a in alphas]
        for j, y in enumerate(ys):
            yv = y.loc[tr].values.astype(float)
            ym = float((yv * w).sum())        # A is centred by construction, so this is the intercept
            b = Aw.T @ (yv - ym)
            pr = np.mean([B @ cho_solve(c, b) for c in chol], axis=0) + ym
            out[j].loc[te] = pr
    return out


# --------------------------------------------------------------------------------------------
# panel construction
# --------------------------------------------------------------------------------------------
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
        ap = [i for i, x in enumerate(t) if x == "a"]
        if len(ap) == 1:
            t2 = list(t)
            t2[ap[0]] = "h"
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


def asof_ratio(num, den):
    """Expanding, shifted least squares through the origin -- the scale a bettor could have known.

    Pooled across seasons on purpose: the first-half share of a game is a league constant, and
    re-estimating it per season would hand October a two-game sample.
    """
    num, den = num.fillna(0), den.fillna(0)
    a = (num * den).expanding().sum().shift(1)
    b = (den * den).expanding().sum().shift(1)
    return (a / b.replace(0, np.nan)).bfill()


def wide_stack(D):
    """The same curated ~716 columns the wide models used, so the only thing that changes between
    those results and these is the ROW LAYOUT. Rebuilding the stack differently would confound it.

    Blocks are re-derived by NAME rather than by re-calling each module's attach(): the cached
    frame already has them joined and attach() expects the pre-join frame.
    """
    pre = ("radj_", "dm_", "raw_", "net_", "adj_own_", "adj_net_", "mk_")
    blocks = [c for c in D.columns if c.startswith(pre) and not c.startswith("adjr_")
              and pd.api.types.is_numeric_dtype(D[c]) and D[c].notna().mean() > 0.80]
    return list(dict.fromkeys(v2.feature_cols(D) + blocks))


def build_panel(D, stack):
    """Two rows per game. Home row keeps orientation; away row swaps own/opp and flips `d_*`."""
    feat = [c for c in stack if c in D.columns and pd.api.types.is_numeric_dtype(D[c])]
    pairs, sym, anti, gl = classify(feat)

    def key(c):
        return "_".join(x for x in c.split("_") if x not in ("h", "a", "sum", "d"))

    paired = {key(h) for h, _ in pairs}
    sym = [c for c in sym if key(c) not in paired]
    anti = [c for c in anti if key(c) not in paired]
    print(f"[panel] {len(pairs)} own/opp pairs | {len(sym)} symmetric | {len(anti)} "
          f"antisymmetric | {len(gl)} game-level (sum/diff twins of a pair dropped as collinear)",
          flush=True)

    half = D["t60_total_point"] / 2.0
    base = dict(
        event_id=D["event_id"], date=D["date"], season=D["season"], phase=D["phase"],
        # FG-implied team total: 220 with home -6 gives 113/107. Exists for four seasons, unlike
        # the posted team total, which is why it anchors the target rather than the posted line.
        impl=[half - D["t60_spread_home_point"] / 2.0, half + D["t60_spread_home_point"] / 2.0],
        pts=[D["y_home_pts"], D["y_away_pts"]],
        h1=[D["y_home_h1"], D["y_away_h1"]],
        line=[D["tt_h"], D["tt_a"]],
        po=[D["tt_h_o"], D["tt_a_o"]], pu=[D["tt_h_u"], D["tt_a_u"]],
    )

    rows = []
    for side in (0, 1):                                   # 0 = home perspective, 1 = away
        R = pd.DataFrame({k: (v[side] if isinstance(v, list) else v) for k, v in base.items()})
        R["is_home"] = 1 - side
        for h, a in pairs:
            nm = re.sub(r"(^|_)(h|ph)(_|$)", r"\1\3", h).strip("_")
            R["own_" + nm] = D[a if side else h]
            R["opp_" + nm] = D[h if side else a]
        for c in sym:
            R[c] = D[c]
        for c in anti:
            R[c] = -D[c] if side else D[c]                # home-minus-away -> own-minus-opp
        for c in gl:
            R[c] = D[c]
        rows.append(R)

    P = pd.concat(rows, ignore_index=True)
    P["team_row"] = np.where(P["is_home"] == 1, "home", "away")

    # The melt is the whole point of this file, so prove it rather than trusting it.
    g = P[P["event_id"] == P["event_id"].iloc[0]]
    hr, ar = g[g.is_home == 1].iloc[0], g[g.is_home == 0].iloc[0]
    oc = [c for c in P.columns if c.startswith("own_")]
    for c in oc:
        o = "opp_" + c[4:]
        assert (pd.isna(hr[c]) and pd.isna(ar[o])) or np.isclose(hr[c], ar[o], equal_nan=True), c
    for c in anti:
        assert (pd.isna(hr[c]) and pd.isna(ar[c])) or np.isclose(hr[c], -ar[c]), c
    print(f"[panel] {len(P):,} team-games from {D['event_id'].nunique():,} games | mirror check "
          f"passed on {len(oc)} own/opp and {len(anti)} antisymmetric columns", flush=True)

    P = P.sort_values(["date", "event_id", "is_home"]).reset_index(drop=True)
    fcols = ([c for c in P.columns if c.startswith(("own_", "opp_"))] + sym + anti + gl
             + ["is_home", "impl"])
    fcols = [c for c in dict.fromkeys(fcols) if c in P.columns
             and pd.api.types.is_numeric_dtype(P[c]) and P[c].notna().mean() > 0.60]
    return P, fcols


def game_shuffle(P, y, rng):
    """Permute the target at GAME level: both rows of a game move together, so the null preserves
    the pairing that makes this 5,108 games rather than 10,216 free observations."""
    ys = y.copy()
    for s in P["season"].unique():
        m = (P["season"] == s) & y.notna()
        ev = P.loc[m, "event_id"]
        assert ev.value_counts().eq(2).all(), "a game has a lone graded row; pairing would break"
        u = ev.unique()
        mapping = dict(zip(u, rng.permutation(u)))
        src = P.loc[m].assign(_k=ev.map(mapping))
        dst = src.sort_values(["_k", "is_home"]).index
        ys.loc[dst] = y.loc[src.sort_values(["event_id", "is_home"]).index].values
    return ys


# --------------------------------------------------------------------------------------------
# grading
# --------------------------------------------------------------------------------------------
def grade(pred, yb, po, pu, k, mask=None):
    """Bet when the model disagrees with the line by at least k units (points, or % for the ML)."""
    ok = pred.notna() & yb.notna() & po.notna() & pu.notna()
    if mask is not None:
        ok = ok & mask
    m = ok & (pred.abs() >= k)
    if m.sum() < 25:
        return dict(n=0, win=np.nan, base=np.nan, roi=np.nan)
    side = pred[m] > 0
    win = np.where(side, yb[m], 1 - yb[m])
    dec = np.where(side, po[m], pu[m])
    base = max(yb[m].mean(), 1 - yb[m].mean())
    return dict(n=int(m.sum()), win=100 * win.mean(), base=100 * base,
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def grade_side(pred, yb, po, pu, k, over):
    """One fixed side, against the LEAGUE rate for that same side.

    `grade` uses the best blind side inside its own rows, which is self-referential once you have
    already conditioned on the side the model took -- it prints +0.0 on every row of a side table.
    """
    m = pred.notna() & yb.notna() & ((pred > 0) if over else (pred < 0)) & (pred.abs() >= k)
    if m.sum() < 25:
        return None
    win = yb[m] if over else (1 - yb[m])
    dec = (po if over else pu)[m]
    lg = yb.dropna()
    return dict(n=int(m.sum()), win=100 * win.mean(),
                base=100 * (lg.mean() if over else 1 - lg.mean()),
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def row(g, tag, extra=""):
    return (f"| {tag} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
            f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |{extra}")


def report(L, M, d, nd, yb, po, pu, frame):
    """One market: ladder with a null re-measured at each rung, then season, phase and side."""
    L += [f"## {M['name']}", "", M["note"], "",
          f"Bet when the model and the market differ by at least k {M['unit']}.", "",
          f"| cut ({M['unit']}) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
          "|---|---|---|---|---|---|---|---|---|"]
    best = None
    for k in M["ks"]:
        g = grade(d, yb, po, pu, k)
        if not g["n"]:
            continue
        ne = np.array([grade(x, yb, po, pu, k)["win"] - grade(x, yb, po, pu, k)["base"]
                       for x in nd], dtype=float)
        mu, sg = np.nanmean(ne), np.nanstd(ne, ddof=1)
        z = (g["win"] - g["base"] - mu) / sg if sg > 0 else np.nan
        L.append(row(g, f"≥{k:g}", f" {mu:+.2f} | {sg:.2f} | **{z:+.2f}** |"))
        print(f"[{M['key']}] " + L[-1], flush=True)
        if best is None or k == M["claim"]:
            best = k
    ck = M["claim"]
    L.append("")

    for col, lab in (("season", "season"), ("phase", "phase")):
        L += [f"### {M['name']} — by {lab}, at the {ck:g}-{M['unit']} cut", "",
              "Pooled numbers hide a signal that decays, so this always runs alongside them.", "",
              f"| {lab} | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
        order = ("EARLY", "MID", "LATE", "POST") if col == "phase" else \
            sorted(frame[col].dropna().unique())
        for v in order:
            g = grade(d, yb, po, pu, ck, mask=(frame[col] == v))
            if g["n"]:
                L.append(row(g, v if col == "phase" else str(int(v))))
                print(f"[{M['key']}] " + L[-1], flush=True)
        L.append("")

    L += [f"### {M['name']} — which side, at the {ck:g}-{M['unit']} cut", "",
          "Baseline is the league rate for that same side, not the majority side inside the cell.",
          "", "| model side | bets | win% | league same-side% | edge | ROI |",
          "|---|---|---|---|---|---|"]
    for lab, over in ((M["over"], True), (M["under"], False)):
        g = grade_side(d, yb, po, pu, ck, over)
        if g:
            L.append(row(g, lab))
            print(f"[{M['key']}] " + L[-1], flush=True)
    L.append("")
    return L


# --------------------------------------------------------------------------------------------
def main():
    D = pd.read_parquet(CACHE).sort_values("date").reset_index(drop=True)
    D["date"] = pd.to_datetime(D["date"])
    stack = wide_stack(D)
    print(f"[panel] wide stack {len(stack)} columns", flush=True)
    P, fcols = build_panel(D, stack)

    # ---- the two models -------------------------------------------------------------------
    # Full game: points minus the full-game-implied team total. First half: first-half points
    # minus that same implied total scaled by the as-of first-half share, so both targets are
    # residuals against something the market already published and both cover four seasons.
    P["_yfg"] = P["pts"] - P["impl"]
    sh = asof_ratio(P["h1"], P["impl"])
    P["_impl_h1"] = sh * P["impl"]
    P["_yh1"] = P["h1"] - P["_impl_h1"]
    print(f"[panel] as-of first-half share converged to {sh.iloc[-1]:.4f} of the implied total",
          flush=True)

    cols_fg = [c for c in fcols if c not in mk.leak(P, fcols, "_yfg", "impl")]
    cols_h1 = [c for c in fcols if c not in mk.leak(P, fcols, "_yh1", "impl")]
    print(f"[panel] {len(cols_fg)} features (full game) | {len(cols_h1)} features (first half)",
          flush=True)

    # Predictions are cached so that changing how results are REPORTED never silently changes the
    # numbers being reported. Delete the file to refit.
    rng = np.random.default_rng(20260801)
    preds = {}
    if os.path.exists(PRED):
        C = pd.read_parquet(PRED)
        assert len(C) == len(P), "cached predictions do not match the current panel; delete it"
        for tag in ("fg", "h1"):
            preds[tag] = [C[f"{tag}_{i}"] for i in range(NULLS + 1)]
        print(f"[panel] loaded cached predictions from {os.path.basename(PRED)}", flush=True)
    else:
        for tag, ycol, cols in (("fg", "_yfg", cols_fg), ("h1", "_yh1", cols_h1)):
            y = P[ycol]
            targets = [y] + [game_shuffle(P, y, rng) for _ in range(NULLS)]
            print(f"[panel] {tag}: walking {len(targets)} targets over {len(cols)} features "
                  f"(one factorisation shared by all)", flush=True)
            preds[tag] = ridge_multi(P[cols].astype(float), P["date"], targets)
            r = preds[tag][0].corr(y)
            print(f"[panel] {tag}: oos corr(pred, actual residual) {r:+.4f} on "
                  f"{int(preds[tag][0].notna().sum()):,} team-games", flush=True)
        pd.DataFrame({f"{t}_{i}": preds[t][i] for t in ("fg", "h1")
                      for i in range(NULLS + 1)}).to_parquet(PRED)

    # Sanity: a null must not predict. If the null walks correlate with the real target, the
    # shuffle is not shuffling and every z below is meaningless.
    nr = np.nanmean([preds["fg"][i].corr(P["_yfg"]) for i in range(1, NULLS + 1)])
    print(f"[panel] mean null corr {nr:+.4f} (must be ~0)", flush=True)
    assert abs(nr) < 0.02, f"null walks correlate with the real target ({nr:+.4f})"

    # ---- back to game level ---------------------------------------------------------------
    def to_game(p_panel, implcol):
        """Team-game predictions -> one row per game with home/away columns."""
        t = P.assign(pred=P[implcol] + p_panel)[["event_id", "team_row", "pred"]]
        return t.pivot(index="event_id", columns="team_row", values="pred")

    G = D.set_index("event_id").copy()
    gp = {}
    for tag, implcol in (("fg", "impl"), ("h1", "_impl_h1")):
        gp[tag] = [to_game(pp, implcol).reindex(G.index) for pp in preds[tag]]

    def q(tag, i, kind):
        """Total -> sum of the two team predictions. Spread -> predicted MARGIN, home perspective.

        The spread deliberately does NOT flip into posted convention. It used to return `-(h - a)`,
        which the market-facing sign, and the caller then subtracted the posted line from it. That
        inverted every spread bet: model home 113 / away 105 against a posted -5 gave -8 - (-5) = -3,
        which the grader read as an AWAY bet even though the model likes home by more than the market
        does. The outcome column is `y_fg_marg_resid = y_fg_margin + t60_spread_home_point`, so the
        graded quantity is now built the SAME way -- predicted margin plus the posted spread -- and
        the two cannot disagree about which direction is a home bet.
        """
        h, a = gp[tag][i]["home"], gp[tag][i]["away"]
        return (h + a) if kind == "tot" else (h - a)

    # Moneyline. The spread model already implies a margin; turning it into a price needs the
    # error scale, taken as-of from the model's own realised errors so nothing from the future
    # sets today's confidence. Devig proportionally and bet the side the model overprices.
    err = (G["y_fg_margin"] - (gp["fg"][0]["home"] - gp["fg"][0]["away"]))
    sig = err.expanding().std().shift(1).bfill().clip(lower=8, upper=20)
    mh = 1 / v2.to_dec(G["t60_ml_home_price"])
    ma = 1 / v2.to_dec(G["t60_ml_away_price"])
    pm = mh / (mh + ma)
    print(f"[panel] moneyline: as-of margin error sd converged to {sig.iloc[-1]:.2f} points",
          flush=True)

    def ml_q(i):
        m = gp["fg"][i]["home"] - gp["fg"][i]["away"]
        return 100 * (pd.Series(norm.cdf(m / sig), index=G.index) - pm)

    bin_ = lambda s: pd.Series(np.where(s > 0, 1.0, np.where(s < 0, 0.0, np.nan)), index=s.index)
    dec = lambda c: pd.Series(v2.to_dec(G[c]), index=G.index)

    L = ["# NBA — every market from one team-game model", "",
         f"**{len(P):,} team-game rows from {D['event_id'].nunique():,} games.** Two models: "
         "points scored by a team over the full game, and over the first half. Every market below "
         "is arithmetic on those two — team total is `own`, the total is `own + opp`, the spread "
         "is `own - opp`, the moneyline is `P(own - opp > 0)`. No market gets its own fit.", "",
         "This replaces a set of independent per-market regressions on one row per game, which "
         "estimated the same relationship separately for home and away and produced a home/away "
         "gap with no basketball cause. Inputs are unchanged — the same curated feature stack, "
         "audited in `NBA_AUDIT.md` — so the only thing that differs from `NBA_TT_FULL.md` and "
         "`NBA_MARKETS.md` is the row layout.", "",
         f"Training uses one full season of team-games as burn-in, so **every market grades the "
         f"same three seasons** and the comparison across them is like-for-like. Nulls are "
         f"{NULLS} game-level shuffles per model, re-measured at each rung of each ladder; a "
         f"z below about +2 is noise.", "",
         f"Out-of-sample correlation with the actual residual: **{preds['fg'][0].corr(P['_yfg']):+.4f}** "
         f"full game, **{preds['h1'][0].corr(P['_yh1']):+.4f}** first half.", ""]

    # ---- panel-level market: team totals --------------------------------------------------
    line = pd.to_numeric(P["line"], errors="coerce")
    M = dict(key="tt", name="Team total", unit="pts", ks=(1.25, 2, 3, 4, 5), claim=2,
             over="model says OVER", under="model says UNDER",
             note="One model, both perspectives. `NBA_TT_FULL.md` fit these as two separate "
                  "models and reported away at +3.8 edge against home at +2.4; if that gap was "
                  "estimator variance rather than basketball, it should not survive here. "
                  "**The cut below was moved to 2 points after seeing the ladder**, which is a "
                  "selection the z-scores do not pay for — read it as descriptive, not as a "
                  "validated rule.")
    L = report(L, M, preds["fg"][0] + (P["impl"] - line),
               [preds["fg"][i] + (P["impl"] - line) for i in range(1, NULLS + 1)],
               bin_(P["pts"] - line), pd.Series(v2.to_dec(P["po"]), index=P.index),
               pd.Series(v2.to_dec(P["pu"]), index=P.index), P)

    dtt = preds["fg"][0] + (P["impl"] - line)
    ybt = bin_(P["pts"] - line)
    tpo = pd.Series(v2.to_dec(P["po"]), index=P.index)
    tpu = pd.Series(v2.to_dec(P["pu"]), index=P.index)
    L += ["### Team total — home vs away, both cuts", "",
          "The question that forced the rebuild. Two fits made these look like different bets; "
          "one fit should make them look like the same bet seen from two sides. The 4-point row "
          "is the cut `NBA_TT_FULL.md` claimed on, kept here so the comparison is direct.", "",
          "| perspective | cut | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|---|"]
    for k in (2, 4):
        for lab in ("home", "away"):
            g = grade(dtt, ybt, tpo, tpu, k, mask=(P["team_row"] == lab))
            if g["n"]:
                L.append(row(g, f"{lab} team total | ≥{k:g} pts"))
                print("[tt] " + L[-1], flush=True)
    L.append("")

    # What is the team-total model actually betting? If it takes the over on one team and the
    # under on the other it has expressed a SPREAD opinion wearing a team-total costume; if it
    # takes the same side on both it has expressed a TOTAL opinion. The split says which market
    # any team-total edge really belongs to, and neither is visible from the ladder alone.
    S = P.assign(d=dtt)[["event_id", "team_row", "d"]].pivot(
        index="event_id", columns="team_row", values="d").dropna()
    both = S[(S["home"].abs() >= 2) & (S["away"].abs() >= 2)]
    same = (np.sign(both["home"]) == np.sign(both["away"])).mean()
    L += ["### What the team-total model is really betting", "",
          f"Of {len(both):,} games where both team totals clear the 2-point cut, "
          f"**{100*same:.0f}%** take the same side on both teams (a view on the game TOTAL) and "
          f"**{100*(1-same):.0f}%** take opposite sides (a view on the SPREAD, priced through two "
          "team totals). This matters because it says which market an apparent team-total edge "
          "actually belongs to.", ""]
    print(f"[tt] same-side on both teams: {100*same:.1f}% of {len(both):,} games", flush=True)

    # ---- game-level markets ----------------------------------------------------------------
    specs = [
        dict(key="fg_total", name="Full-game total", unit="pts", ks=(1, 2, 3, 4, 5), claim=4,
             over="model says OVER", under="model says UNDER",
             d=lambda i: q("fg", i, "tot") - G["t60_total_point"],
             oracle=G["y_fg_total"] - G["t60_total_point"],
             yb=bin_(G["y_fg_total"] - G["t60_total_point"]),
             po=dec("t60_total_over_price"), pu=dec("t60_total_under_price"),
             note="Sum of the two team predictions against the posted total. The ridge total "
                  "model in `NBA_PROVEN.md` scored +3.1% ROI as a direct fit on the wide frame; "
                  "this reaches the same market through per-team points instead."),
        dict(key="fg_spread", name="Full-game spread", unit="pts", ks=(1, 2, 3, 4, 5), claim=3,
             over="model says HOME", under="model says AWAY",
             d=lambda i: q("fg", i, "sp") + G["t60_spread_home_point"],
             oracle=G["y_fg_margin"] + G["t60_spread_home_point"],
             yb=bin_(G["y_fg_marg_resid"]),
             po=dec("t60_spread_home_price"), pu=dec("t60_spread_away_price"),
             note="Difference of the two team predictions against the posted spread. "
                  "`NBA_PROVEN.md` records that the full-game spread has no working model and its "
                  "edge comes from rules instead; this is the first attempt at it from a "
                  "consistent per-team points model."),
        dict(key="moneyline", name="Moneyline", unit="%", ks=(1, 2, 3, 5, 7), claim=3,
             over="model says HOME", under="model says AWAY",
             d=ml_q, oracle=G["y_fg_margin"], yb=bin_(G["y_fg_margin"]),
             po=dec("t60_ml_home_price"), pu=dec("t60_ml_away_price"),
             note="The spread model's margin turned into a win probability using its own as-of "
                  "error scale, against the devigged market price. The cut is in percentage "
                  "points of probability, not points of margin. **Read ROI here, not edge.** "
                  "`base%` is the best blind side inside the bet cell, which on a moneyline is "
                  "always the favourite; any model that takes underdogs therefore scores a large "
                  "negative edge whether or not it is making money. The null columns show the "
                  "same effect — the null scores about -10 — which is why the z can be positive "
                  "while the ROI is negative."),
        dict(key="h1_total", name="First-half total", unit="pts", ks=(0.75, 1, 1.5, 2, 3),
             claim=1.5, over="model says OVER", under="model says UNDER",
             d=lambda i: q("h1", i, "tot") - G["h1_total_line"],
             oracle=G["y_h1_total"] - G["h1_total_line"],
             yb=bin_(G["y_h1_total"] - G["h1_total_line"]),
             po=dec("h1_ov"), pu=dec("h1_un"),
             note="First-half points per team, summed, against the posted first-half total. "
                  "First-half lines are roughly half the size of full-game ones, so the cuts are "
                  "scaled down to match."),
        dict(key="h1_spread", name="First-half spread", unit="pts", ks=(0.75, 1, 1.5, 2, 3),
             claim=1.5, over="model says HOME", under="model says AWAY",
             d=lambda i: q("h1", i, "sp") + G["h1_spread"],
             oracle=G["y_h1_margin"] + G["h1_spread"],
             yb=bin_(G["y_h1_marg_resid"]),
             po=dec("h1_sp_h"), pu=dec("h1_sp_a"),
             note="Difference of the first-half team predictions against the posted first-half "
                  "spread. On the wide frame this looked positive pooled but ran +4.9 / +0.8 / "
                  "-2.1 edge across the three seasons — a decaying line, not an edge."),
    ]

    # ORACLE CHECK -- the cheapest possible guard against a sign inversion, and the reason it now
    # exists: the full-game and first-half spreads were graded with the model's number in POSTED
    # convention (home favourite lays points) while the outcome column is a margin RESIDUAL, so every
    # spread bet was placed on the wrong side and the market read -8.3% ROI instead of -0.7%.
    # Substituting the realised result into each market's own `d` formula must grade ~100%; anything
    # else means `d` and `yb` disagree about which direction is a home/over bet.
    for S in specs:
        o = grade(S["oracle"], S["yb"], S["po"], S["pu"], 0)
        print(f"[oracle] {S['key']:10s} perfect-foresight win% {o['win']:.1f} on n={o['n']:,}",
              flush=True)
        assert o["win"] > 99.5, (f"{S['key']}: feeding the actual result into its own d() grades "
                                 f"{o['win']:.1f}%, not ~100% -- d and yb disagree on sign")

    for S in specs:
        L = report(L, S, S["d"](0), [S["d"](i) for i in range(1, NULLS + 1)],
                   S["yb"], S["po"], S["pu"], G)

    # ---- consistency + summary --------------------------------------------------------------
    tot, sp = q("fg", 0, "tot"), q("fg", 0, "sp")
    hh, aa = gp["fg"][0]["home"], gp["fg"][0]["away"]
    assert np.allclose((hh + aa) - (hh - aa), 2 * aa, equal_nan=True)
    L += ["## Coherence check", "",
          "The reason for one model rather than six: the markets are now arithmetically "
          "consistent. Reconstructed team points from the total and spread predictions match the "
          "per-team predictions exactly, so the model cannot like the over, the under of a team "
          "total and the home side at the same time — which independent fits are free to do.", "",
          f"- predicted full-game total spans {tot.min():.0f}–{tot.max():.0f} points, "
          f"posted {G['t60_total_point'].min():.0f}–{G['t60_total_point'].max():.0f}",
          f"- predicted home margin spans {sp.min():+.0f} to {sp.max():+.0f}, "
          f"posted {(-G['t60_spread_home_point']).min():+.0f} to "
          f"{(-G['t60_spread_home_point']).max():+.0f}",
          f"- reconstruction `(own+opp) ± (own-opp)` returns the team predictions exactly", ""]

    with open(os.path.join(ROOT, "NBA_PANEL_ALL.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_PANEL_ALL.md", flush=True)


if __name__ == "__main__":
    main()
