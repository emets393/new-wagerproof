#!/usr/bin/env python3
"""Prop pricing by CONDITIONAL DISTRIBUTION rather than binary classification.

A binary classifier on P(over) throws away the structure of the problem. These outcomes
are small counts settled at a half-point threshold: blocks at 0.5, steals at 0.5, threes
at 1.5, assists at 4.5. What matters there is the SHAPE of the count distribution near
the line, not the conditional mean — and a classifier has to relearn that shape from
scratch, separately, at every line value it encounters.

So instead: model the mean with a Poisson-objective booster, then price the exact
threshold analytically off a fitted count distribution. Three variants, because the
right dispersion is an empirical question:

  POIS    Poisson survival at the predicted mean. Assumes var = mean, which is wrong for
          basketball counts (rotation and blowout risk fatten the tail) — the honest
          null for the other two.
  NB      Negative binomial, dispersion fitted per market on TRAIN residuals only.
          var = mu + mu^2/alpha, which is the standard fix for overdispersed counts.
  EMP     Fully non-parametric: bucket train rows by predicted mean, read P(X > line)
          straight off the empirical distribution in that bucket. Assumes nothing about
          the shape at the cost of resolution.

Same discipline as everywhere else: leak-safe features, rolling-origin refits, graded at
the real T-60 price, and reported against BLIND UNDER on the identical rows, because the
prop market's standing over-shade makes any comparison to 50% meaningless.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from scipy.stats import poisson, nbinom
import lightgbm as lgb

from nba_props_model import LEAK, IDS, feature_cols, _venue

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
BLOCK_MONTHS = 2
MIN_TRAIN = 4000

# markets whose outcome is a genuine small count settled near the distribution's mode
COUNT_MARKETS = ["player_blocks", "player_steals", "player_threes", "player_assists",
                 "player_rebounds", "player_points"]


def nb_sf(line, mu, alpha):
    """P(X > line) for a negative binomial with mean mu and var = mu + mu^2/alpha."""
    mu = np.clip(mu, 1e-6, None)
    n = alpha
    p = n / (n + mu)
    return nbinom.sf(np.floor(line), n, p)


def fit_alpha(y, mu):
    """Method-of-moments dispersion on TRAIN only. var = mu + mu^2/alpha."""
    v = np.nanvar(y - mu) + np.nanmean(mu)
    excess = max(v - np.nanmean(mu), 1e-6)
    return float(np.clip(np.nanmean(mu) ** 2 / excess, 0.5, 200.0))


def main():
    D = pd.read_parquet(f"{OUT}/nba_props_panel.parquet").rename(columns={"season_x": "season"})
    D["date"] = pd.to_datetime(D["date"])
    D = D[D["gp_prior"] >= 5].sort_values("date").reset_index(drop=True)
    seasons = sorted(D["season"].unique())

    L = ["# NBA props — conditional-distribution pricing", "",
         f"Poisson-objective booster for the mean, then P(X>line) priced three ways. "
         f"Seasons {seasons}, rolling origin every {BLOCK_MONTHS} months.", "",
         "Reported against BLIND UNDER on the identical rows — the prop market's "
         "over-shade means beating 50% proves nothing.", ""]
    rows = []

    for mk in COUNT_MARKETS:
        M = D[D["market"] == mk].copy().reset_index(drop=True)
        if len(M) < 8000:
            continue
        cols = [c for c in feature_cols(M)
                if M[c].notna().mean() >= 0.5 and M[c].nunique() > 1]
        mo = M["date"].dt.to_period("M")
        uniq = sorted(mo.unique())
        blocks = [uniq[i:i + BLOCK_MONTHS] for i in range(0, len(uniq), BLOCK_MONTHS)]

        M["_mu"] = np.nan
        M["_alpha"] = np.nan
        emp = pd.Series(np.nan, index=M.index)
        for blk in blocks:
            te = M.index[mo.isin(blk)]
            tr = M.index[(mo < blk[0]) & M["actual"].notna()]
            if len(te) == 0 or len(tr) < MIN_TRAIN:
                continue
            Xtr = M.loc[tr, cols].to_numpy(dtype=np.float32)
            ytr = M.loc[tr, "actual"].to_numpy(dtype=float)
            Xte = M.loc[te, cols].to_numpy(dtype=np.float32)
            m = lgb.LGBMRegressor(objective="poisson", n_estimators=350,
                                  learning_rate=0.04, num_leaves=31,
                                  min_child_samples=60, subsample=0.8, subsample_freq=1,
                                  colsample_bytree=0.6, reg_lambda=5.0,
                                  random_state=0, verbose=-1, n_jobs=-1)
            m.fit(Xtr, ytr)
            mu_tr = np.clip(m.predict(Xtr), 1e-6, None)
            mu_te = np.clip(m.predict(Xte), 1e-6, None)
            M.loc[te, "_mu"] = mu_te
            M.loc[te, "_alpha"] = fit_alpha(ytr, mu_tr)

            # EMP: P(X > line) read off the train rows with a similar predicted mean.
            # Bins come from TRAIN quantiles only, so the test fold never informs them.
            qs = np.unique(np.quantile(mu_tr, np.linspace(0, 1, 21)))
            if len(qs) > 2:
                btr = np.digitize(mu_tr, qs[1:-1])
                bte = np.digitize(mu_te, qs[1:-1])
                lines_te = M.loc[te, "cons_line"].to_numpy(dtype=float)
                out = np.full(len(te), np.nan)
                for b in np.unique(bte):
                    src = ytr[btr == b]
                    if len(src) < 200:
                        continue
                    sel = bte == b
                    out[sel] = [(src > ln).mean() for ln in lines_te[sel]]
                emp.loc[te] = out

        ok = M["_mu"].notna() & M["y_cons"].notna()
        if ok.sum() < 500:
            print(f"  {mk}: too few scored rows", flush=True)
            continue

        pm = {
            "pois": pd.Series(poisson.sf(np.floor(M["cons_line"]), M["_mu"]), index=M.index),
            "nb": pd.Series(nb_sf(M["cons_line"].to_numpy(dtype=float),
                                  M["_mu"].to_numpy(dtype=float),
                                  M["_alpha"].to_numpy(dtype=float)), index=M.index),
            "emp": emp,
        }
        for vname, prob in pm.items():
            prob = prob.where(ok)
            for pct in (100, 25, 10):
                for venue in ("cons", "best"):
                    n, w, r = grade(M, prob, pct, venue)
                    _, _, br = grade(M, prob, pct, venue, force="under")
                    rows.append(dict(market=mk, variant=vname, cut=f"top{pct}%",
                                     venue=venue, n=n, win=w, roi=r, blind_roi=br,
                                     delta=r - br))
            n, w, r = grade(M, prob, 10, "best")
            _, _, br = grade(M, prob, 10, "best", force="under")
            print(f"  {mk}/{vname}: top10%@best n={n} {w:.1f}% {r:+.1f} "
                  f"vs blind {br:+.1f} (delta {r-br:+.1f})", flush=True)

    R = pd.DataFrame(rows)
    R.to_csv(os.path.join(ROOT, "nba_props_count_results.csv"), index=False)

    L += ["## Per market x variant, top10% at the best line\n",
          "| market | variant | n | win% | ROI | blind-under ROI | delta |",
          "|---|---|---|---|---|---|---|"]
    for _, r in R[(R["cut"] == "top10%") & (R["venue"] == "best")].iterrows():
        if pd.notna(r["roi"]):
            L.append(f"| {r['market']} | {r['variant']} | {r['n']:,} | {r['win']:.2f} | "
                     f"{r['roi']:+.2f} | {r['blind_roi']:+.2f} | {r['delta']:+.2f} |")

    L += ["\n## Pooled by variant\n",
          "| variant | cut | venue | n | win% | ROI | blind ROI | delta |",
          "|---|---|---|---|---|---|---|---|"]
    for v in ("pois", "nb", "emp"):
        for pct in (100, 25, 10):
            for venue in ("cons", "best"):
                s = R[(R["variant"] == v) & (R["cut"] == f"top{pct}%")
                      & (R["venue"] == venue)].dropna(subset=["roi"])
                n = s["n"].sum()
                if n == 0:
                    continue
                wt = lambda c: (s[c] * s["n"]).sum() / n                # noqa: E731
                L.append(f"| {v} | top{pct}% | {venue} | {n:,} | {wt('win'):.2f} | "
                         f"{wt('roi'):+.2f} | {wt('blind_roi'):+.2f} | "
                         f"{wt('roi')-wt('blind_roi'):+.2f} |")

    path = os.path.join(ROOT, "NBA_PROPS_COUNT_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


def grade(D, prob, pct, venue, force=None):
    """Bet the side the distribution favours vs the market's own de-vigged probability."""
    yo, do, yu, du = _venue(D, venue)
    # edge is measured against the MARKET's no-vig P(over), not against 0.5 — otherwise
    # every low line (blocks 0.5) would read as a permanent 'over' signal
    edge = prob - D["cons_p_over"]
    ok = edge.notna() & D[yo].notna() & D[yu].notna()
    if ok.sum() < 50:
        return 0, np.nan, np.nan
    thr = edge.abs()[ok].quantile(1 - pct / 100) if pct < 100 else -1
    m = ok & (edge.abs() >= thr)
    over = (edge[m] > 0) if force is None else pd.Series(False, index=D.index[m])
    y = np.where(over, D.loc[m, yo], D.loc[m, yu])
    win = np.where(over, y, 1 - y)
    dec = np.where(over, D.loc[m, do], D.loc[m, du])
    g = ~np.isnan(dec) & ~np.isnan(win)
    win, dec = win[g], dec[g]
    if len(win) < 50:
        return 0, np.nan, np.nan
    return len(win), 100 * win.mean(), 100 * (win * (dec - 1) - (1 - win)).mean()


if __name__ == "__main__":
    main()
