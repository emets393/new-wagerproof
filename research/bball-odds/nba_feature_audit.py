#!/usr/bin/env python3
"""Per-feature audit: which columns help the NBA models, and which actively hurt.

WHY THEME ABLATION WAS NOT ENOUGH. `nba_total_v4.py` dropped features in blocks of 4-20 and
could only say "the schedule theme is worth about nothing". That hides the case that matters:
a block whose average effect is zero because three columns carry real signal and nine are
noise the ridge still has to spend variance on. This resolves every column individually.

THE METHOD. Permutation importance on OUT-OF-SAMPLE predictions, inside the existing
walk-forward. For each refit window the model is fitted once; then, for each feature, that
column is shuffled IN THE TEST MATRIX ONLY and the already-fitted model re-predicts. Nothing
is refitted, so the number answers "how much does the fitted model lean on this column when
it forecasts games it has never seen" -- which is the question -- rather than "how much would
the model change if retrained without it", which conflates leaning with substitutability.

    delta = corr(permuted predictions, truth) - corr(real predictions, truth)
    delta < 0  ->  shuffling the column DESTROYED accuracy  ->  the feature HELPS
    delta > 0  ->  shuffling the column IMPROVED accuracy   ->  the feature HURTS

An exact shortcut makes this affordable. `v2.walk` averages Ridge over four alphas, and Ridge
is linear, so the mean of four predictions equals one prediction from the mean coefficient
vector. Averaging the coefficients once per fold turns each permutation into a single matrix
multiply instead of four model calls, and the result is identical to the long way round.

THE TRAP THIS FILE MUST NOT FALL INTO. Ranking features on all four seasons and then dropping
the bad ones and re-scoring on those same four seasons is selection on the test set, and it
will always look like an improvement. The drop test at the end therefore measures importance
on the EARLY seasons only and evaluates the pruned model on the LATE ones, which the ranking
never saw. That number is honest; a same-data version would not be.
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


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
v3 = _load("v3", "nba_total_v3.py")
v4 = _load("v4", "nba_total_v4.py")
nets = _load("nets", "nba_matchup_nets.py")
adj = _load("adj", "nba_adj_stats.py")

REPEATS = 3
RNG = np.random.default_rng(9001)


def family(c):
    """Bucket a column name into the block it came from, for the group roll-up."""
    if c.startswith("adjr_net_"):
        return "adj net (recency)"
    if c.startswith("adjr_own_"):
        return "adj own (recency)"
    if c.startswith("adj_net_"):
        return "adj matchup net"
    if c.startswith("adj_own_"):
        return "adj own levels"
    if c.startswith("net_"):
        return "matchup net"
    if c.startswith("raw_"):
        return "possession raw"
    if c.startswith("radj_"):
        return "adj ratings"
    if c.startswith("dm_ix_"):
        return "dims interaction"
    if c.startswith("dm_"):
        return "dims " + c.split("_")[1]
    if c.startswith("st_"):
        return "structural"
    for k in ("usg", "usage", "hhi", "top_min", "rot_n"):
        if k in c:
            return "usage concentration"
    for k in ("ortg", "efg", "adv_off", "adv_def", "pace", "tov", "ftr", "oreb", "dreb", "ast"):
        if k in c:
            return "team form/efficiency"
    return "other"


def audit(X, dates, y, cols):
    """Walk-forward permutation importance. Returns (base_pred, per-feature permuted preds)."""
    idx = pd.DatetimeIndex(dates)
    starts = sorted({d for d in pd.date_range(idx.min(), idx.max(), freq=f"{v2.REFIT_DAYS}D")
                     if (idx < d).sum() >= v2.MIN_TRAIN})
    P = pd.Series(index=X.index, dtype=float)
    PP = {c: pd.Series(index=X.index, dtype=float) for c in cols}
    pos = {c: i for i, c in enumerate(cols)}

    for i, d0 in enumerate(starts):
        d1 = starts[i + 1] if i + 1 < len(starts) else idx.max() + pd.Timedelta(days=1)
        tr = X.index[(idx < d0) & y.notna()]
        te = X.index[(idx >= d0) & (idx < d1)]
        if len(te) == 0 or len(tr) < v2.MIN_TRAIN:
            continue
        A, B = X.loc[tr], X.loc[te]
        mu, sd = A.mean(), A.std().replace(0, 1.0)
        A = ((A - mu) / sd).fillna(0.0).to_numpy()
        Bn = ((B - mu) / sd).fillna(0.0).to_numpy()
        yt = y.loc[tr].to_numpy()

        # Ridge is linear -> the mean of the alpha-grid predictions IS the prediction from the
        # mean coefficients. One matmul per permutation instead of four model calls.
        C, I0 = [], []
        for a in v2.ALPHAS:
            m = Ridge(alpha=a).fit(A, yt)
            C.append(m.coef_)
            I0.append(m.intercept_)
        coef, b0 = np.mean(C, axis=0), float(np.mean(I0))
        base = Bn @ coef + b0        # hoisted: this does not depend on which column is shuffled
        P.loc[te] = base

        for c in cols:
            j = pos[c]
            col = Bn[:, j]
            acc = np.zeros(len(te))
            for _ in range(REPEATS):
                # only column j changes, so the delta is a rank-1 correction to the base pred
                acc += (RNG.permutation(col) - col) * coef[j]
            PP[c].loc[te] = base + acc / REPEATS
        if i % 5 == 0:
            print(f"  fold {i+1}/{len(starts)}  train={len(tr)} test={len(te)}", flush=True)
    return P, PP


def score(P, y):
    m = P.notna() & y.notna()
    return np.corrcoef(P[m], y[m])[0, 1]


def run(D, y, yb, pw, pl, k, cols, title, path):
    X = D[cols].astype(float)
    print(f"[{title}] auditing {len(cols)} columns", flush=True)
    P, PP = audit(X, D["date"], y, cols)
    base_r = score(P, y)
    base_g = v2.grade(P, yb, pw, pl, k)
    print(f"[{title}] baseline corr {base_r:+.4f}  edge {base_g['win']-base_g['base']:+.2f}",
          flush=True)

    rows = []
    for c in cols:
        r = score(PP[c], y)
        rows.append({"feature": c, "family": family(c), "delta": r - base_r})
    F = pd.DataFrame(rows).sort_values("delta")
    F["verdict"] = np.where(F["delta"] < 0, "helps", "hurts")

    L = [f"# {title} — per-feature audit", "",
         f"Baseline out-of-sample corr **{base_r:+.4f}**, edge "
         f"**{base_g['win']-base_g['base']:+.2f}** on n={base_g['n']}, over {len(cols)} columns.",
         "", "`delta` is the change in out-of-sample correlation when that column alone is "
         "shuffled in the test matrix. **Negative delta = shuffling hurt = the feature helps.** "
         "Positive delta = the model is better off without it.", "",
         f"{(F['delta']<0).sum()} of {len(F)} columns help; {(F['delta']>=0).sum()} hurt.", "",
         "## The 25 features carrying the model", "",
         "| feature | family | delta |", "|---|---|---|"]
    for _, r in F.head(25).iterrows():
        L.append(f"| `{r['feature']}` | {r['family']} | {r['delta']:+.5f} |")

    L += ["", "## The 25 features doing the most damage", "",
          "| feature | family | delta |", "|---|---|---|"]
    for _, r in F.tail(25).iloc[::-1].iterrows():
        L.append(f"| `{r['feature']}` | {r['family']} | {r['delta']:+.5f} |")

    G = F.groupby("family").agg(n=("delta", "size"), total=("delta", "sum"),
                                mean=("delta", "mean"),
                                helps=("verdict", lambda s: (s == "helps").sum())).sort_values("total")
    L += ["", "## By family — `total` is the sum of deltas, i.e. the block's net contribution",
          "", "| family | cols | helps | total delta | mean delta |", "|---|---|---|---|---|"]
    for fam, r in G.iterrows():
        L.append(f"| {fam} | {int(r['n'])} | {int(r['helps'])} | {r['total']:+.4f} | "
                 f"{r['mean']:+.5f} |")
        print(L[-1], flush=True)

    # ---- honest prune test ------------------------------------------------------------------
    seasons = sorted(D["season"].unique())
    early, late = seasons[:2], seasons[2:]
    Xe, ye = X[D["season"].isin(early)], y[D["season"].isin(early)]
    print(f"[{title}] prune test: rank on {early}, evaluate on {late}", flush=True)
    Pe, PPe = audit(Xe, D.loc[Xe.index, "date"], ye, cols)
    be = score(Pe, ye)
    dl = pd.Series({c: score(PPe[c], ye) - be for c in cols})
    keep = [c for c in cols if dl[c] < 0]

    L += ["", "## Prune test — drop the hurters, honestly", "",
          f"Importance ranked on **{early}** only, then the pruned model is evaluated on "
          f"**{late}**, which the ranking never saw. Ranking and scoring on the same seasons "
          f"would guarantee an improvement and mean nothing.", "",
          f"{len(keep)} of {len(cols)} columns survive the early-season ranking.", "",
          "| feature set | cols | oos corr (late) | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|"]
    msk = D["season"].isin(late)
    for tag, cs in (("all columns", cols), ("pruned to early-season helpers", keep)):
        if not cs:
            continue
        p = v2.walk(D[cs].astype(float), D["date"], y, kind="ridge")
        m = p.notna() & y.notna() & msk
        r = np.corrcoef(p[m], y[m])[0, 1]
        g = v2.grade(p, yb, pw, pl, k, mask=msk)
        L.append(f"| {tag} | {len(cs)} | {r:+.4f} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} "
                 f"| **{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
        print(L[-1], flush=True)

    with open(os.path.join(ROOT, path), "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote {path}\n", flush=True)
    F.to_csv(os.path.join(ROOT, path.replace(".md", ".csv")), index=False)


def assemble(D):
    """Everything the model could see: base + ratings + dims + raw possession + both net blocks.

    The audit deliberately includes RAW and ADJUSTED versions of the same underlying stats side
    by side. They are collinear, and that is the point -- permutation importance then reports
    which of the two the fitted ridge actually leans on when it forecasts an unseen game.
    """
    D = v3.with_fixed_ratings(D)
    D, themes = v4.dim_features(D)
    D, blocks = nets.attach(D)
    D, ablocks = adj.attach(D)
    base = [c for c in v2.feature_cols(D) if c not in v2.leak_screen(D, v2.feature_cols(D))]
    radj = [c for c in D.columns if c.startswith("radj_") and D[c].notna().mean() > 0.80]
    dims = [c for t in themes.values() for c in t if D[c].notna().mean() > 0.80]
    # Only the flat-weighted adjusted block. The recency variant is excluded on purpose: its
    # half-life was expressed in league-game rows rather than days, so it is being rebuilt, and
    # auditing a block that is known to be wrong just launders the bug into a ranking.
    extra = [c for grp in (blocks["raw"], blocks["net"], ablocks["aown"], ablocks["anet"])
             for c in grp
             if c in D.columns and not c.startswith("adjr_") and D[c].notna().mean() > 0.80]
    return D, base + radj + dims + extra


def main():
    D = v2.build()
    D, cols = assemble(D)
    y = D["y_fg_tot_resid"].astype(float)
    yb = pd.Series(np.where(y > 0, 1.0, np.where(y < 0, 0.0, np.nan)), index=D.index)
    run(D, y, yb, pd.Series(v2.to_dec(D["t60_total_over_price"]), index=D.index),
        pd.Series(v2.to_dec(D["t60_total_under_price"]), index=D.index),
        2.0, cols, "NBA total", "NBA_FEATURE_AUDIT_TOTAL.md")

    import nba_spread_dims as sd
    S = sd.build_spread()
    S, cols_s = assemble(S)
    ys = S["y_fg_marg_resid"].astype(float)
    ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=S.index)
    run(S, ys, ybs, pd.Series(v2.to_dec(S["t60_spread_home_price"]), index=S.index),
        pd.Series(v2.to_dec(S["t60_spread_away_price"]), index=S.index),
        1.5, cols_s, "NBA spread", "NBA_FEATURE_AUDIT_SPREAD.md")


if __name__ == "__main__":
    main()
