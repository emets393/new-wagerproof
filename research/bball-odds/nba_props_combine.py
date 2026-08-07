#!/usr/bin/env python3
"""FORECAST COMBINATION: the test the encompassing diagnostic directly implies.

The skill diagnostic returned a specific, unusual pair of facts, and every market agreed:

    MAE(model) / MAE(line) = 1.01 on the liquid markets   -- the model is slightly WORSE
    c (model) > 0 with t = +6.3 to +47.3 in the regression actual ~ a + b*line + c*model

Those two together are not a contradiction, they are a well-known signature. Neither
forecast dominates. The line is the better standalone predictor, but the model carries a
component the line lacks, so the OPTIMAL forecast is a weighted blend of the two -- and a
blend beats both parents. That is the textbook forecast-combination result and it is the
one thing none of the five method families here has actually done.

What the earlier runs did instead:
  - the classifier and count models learned P(over) directly, with the line as one
    feature among 148. A booster is free to underweight it and generally did.
  - the stack combined PROBABILITIES from five learners. That is a different operation:
    it never fits the line and the model against each other as competing point forecasts,
    so it can never recover the b/c weights the diagnostic just measured.

So do it explicitly:

  1  Fit  actual ~ a + b*line + c*model  on strictly earlier games only, per market.
  2  Blend this prop's line and model prediction with those out-of-sample weights.
  3  Price P(over) off the empirical distribution of the BLEND's residuals, bucketed by
     predicted level so a star and a bench player do not get the same spread.
  4  Grade against blind under on the identical rows, at consensus, best, and 2nd-best.

The bar is unchanged and it is high: the market's hold is 6.9%, so the blend has to be
better than the line by more than the vig, not merely better. The diagnostic says the
residual information is real; it does not say it is big enough. This measures whether it
is, and the 2nd-best column decides whether any of it is executable.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
MIN_FIT = 3000                       # prior props needed before weights are trusted


def resid_prob(mu_tr, y_tr, mu_te, line_te, nbuck=8):
    """P(X > line) from the empirical residual CDF of the BLEND, bucketed by level."""
    edges = np.unique(np.quantile(mu_tr, np.linspace(0, 1, nbuck + 1)))
    if len(edges) < 3:
        return np.full(len(mu_te), np.nan)
    btr = np.clip(np.digitize(mu_tr, edges[1:-1]), 0, len(edges) - 2)
    bte = np.clip(np.digitize(mu_te, edges[1:-1]), 0, len(edges) - 2)
    res = np.sort(y_tr - mu_tr)
    out = np.full(len(mu_te), np.nan)
    for b in np.unique(bte):
        src = np.sort((y_tr - mu_tr)[btr == b])
        if len(src) < 300:
            continue
        sel = bte == b
        need = line_te[sel] - mu_te[sel]
        out[sel] = 1.0 - np.searchsorted(src, need, side="right") / len(src)
    return out


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def grade(D, prob, pct, lc, dco, dcu, force=None):
    """Bet the side the blend favours vs the market's de-vigged price, at one venue."""
    edge = prob - D["cons_p_over"]
    ok = edge.notna() & D[lc].notna() & D[dco].notna() & D[dcu].notna() \
        & D["actual"].notna()
    if ok.sum() < 100:
        return 0, np.nan, np.nan
    thr = edge.abs()[ok].quantile(1 - pct / 100) if pct < 100 else -1
    m = ok & (edge.abs() >= thr)
    d = D[m]
    live = d["actual"] != d[lc]
    d, e = d[live], edge[m][live.to_numpy()]
    if len(d) < 60:
        return 0, np.nan, np.nan
    over = (e > 0).to_numpy() if force is None else np.zeros(len(d), dtype=bool)
    ow = (d["actual"] > d[lc]).to_numpy(dtype=float)
    win = np.where(over, ow, 1 - ow)
    dec = np.where(over, d[dco], d[dcu])
    g = ~np.isnan(dec)
    if g.sum() < 60:
        return 0, np.nan, np.nan
    return int(g.sum()), 100 * win[g].mean(), roi(win[g], dec[g])


def main():
    from nba_props_combo_exec import per_book, ranked, MAINSTREAM

    panel = pd.read_parquet(f"{OUT}/nba_props_panel.parquet").rename(
        columns={"season_x": "season"})
    price = panel[["event_id", "market", "pkey", "cons_line", "cons_over_dec",
                   "cons_under_dec", "cons_p_over", "season"]].drop_duplicates(
        ["event_id", "market", "pkey"])
    R = ranked(per_book())

    rows, allp = [], []
    for f in sorted(os.listdir(OUT)):
        if not f.startswith("nba_props_skill_"):
            continue
        S = pd.read_parquet(os.path.join(OUT, f)).sort_values("date")
        mk = S["market"].iloc[0]
        S = S.drop(columns=["cons_line"]).merge(price, on=["event_id", "market", "pkey"],
                                                how="inner")
        S = S.merge(R, on=["event_id", "market", "pkey"], how="left").sort_values("date")
        S = S.dropna(subset=["cons_line", "_pred", "actual"]).reset_index(drop=True)
        if len(S) < 8000:
            continue

        # ---- walk forward by month: weights and residual CDF from earlier props only
        mo = S["date"].dt.to_period("M")
        S["_blend"] = np.nan
        S["_p"] = np.nan
        for m in sorted(mo.unique()):
            te = S.index[mo == m]
            tr = S.index[mo < m]
            if len(te) == 0 or len(tr) < MIN_FIT:
                continue
            X = np.column_stack([np.ones(len(tr)), S.loc[tr, "cons_line"],
                                 S.loc[tr, "_pred"]])
            y = S.loc[tr, "actual"].to_numpy(dtype=float)
            beta, *_ = np.linalg.lstsq(X, y, rcond=None)
            fit_tr = X @ beta
            Xte = np.column_stack([np.ones(len(te)), S.loc[te, "cons_line"],
                                   S.loc[te, "_pred"]])
            fit_te = Xte @ beta
            S.loc[te, "_blend"] = fit_te
            S.loc[te, "_p"] = resid_prob(fit_tr, y, fit_te,
                                         S.loc[te, "cons_line"].to_numpy(dtype=float))

        ok = S["_p"].notna()
        if ok.sum() < 2000:
            continue
        # how much better is the blend than the line, in MAE, out of sample?
        s = S[S["_blend"].notna()]
        mae_b = (s["actual"] - s["_blend"]).abs().mean()
        mae_l = (s["actual"] - s["cons_line"]).abs().mean()
        mae_m = (s["actual"] - s["_pred"]).abs().mean()

        for pct in (100, 25, 10, 5):
            for venue, lc, dco, dcu in (("cons", "cons_line", "cons_over_dec",
                                         "cons_under_dec"),
                                        ("best", None, None, None),
                                        ("second", None, None, None)):
                if venue == "cons":
                    n, w, r = grade(S, S["_p"], pct, lc, dco, dcu)
                    _, _, br = grade(S, S["_p"], pct, lc, dco, dcu, force="under")
                else:
                    # best/2nd-best are side-specific: the over is struck at the lowest
                    # line, the under at the highest, each at its own book's price
                    i = "0" if venue == "best" else "1"
                    n_o, w_o, r_o = grade(S, S["_p"], pct, f"o{i}_line", f"o{i}_dec",
                                          f"o{i}_dec")
                    n_u, w_u, r_u = grade(S, S["_p"], pct, f"u{i}_line", f"u{i}_dec",
                                          f"u{i}_dec")
                    n = (n_o + n_u) // 2
                    w = np.nanmean([w_o, w_u])
                    r = np.nanmean([r_o, r_u])
                    _, _, br = grade(S, S["_p"], pct, f"u{i}_line", f"u{i}_dec",
                                     f"u{i}_dec", force="under")
                rows.append(dict(market=mk, cut=f"top{pct}%", venue=venue, n=n, win=w,
                                 roi=r, blind_roi=br, delta=r - br,
                                 mae_blend=mae_b, mae_line=mae_l, mae_model=mae_m))
        allp.append(S[["event_id", "market", "pkey", "date", "season", "_blend", "_p"]])
        print(f"  {mk}: MAE blend {mae_b:.3f} vs line {mae_l:.3f} vs model {mae_m:.3f} "
              f"({100*(mae_b/mae_l-1):+.2f}% vs line)", flush=True)

    T = pd.DataFrame(rows)
    T.to_csv(os.path.join(ROOT, "nba_props_combine_results.csv"), index=False)
    if allp:
        pd.concat(allp, ignore_index=True).to_parquet(
            f"{OUT}/nba_props_combine_scored.parquet", index=False)

    L = ["# NBA props — forecast combination (line + model)", "",
         "Weights from `actual ~ a + b*line + c*model`, fitted walk-forward on strictly "
         "earlier props. P(over) priced off the blend's own residual distribution.", "",
         "The bar is the 6.9% hold: the blend must beat the line by MORE than the vig, "
         "not merely beat it.", ""]

    L += ["## Does the blend forecast better than the line it blends with?\n",
          "| market | MAE line | MAE model | MAE blend | blend vs line |",
          "|---|---|---|---|---|"]
    for mk in sorted(T["market"].unique()):
        r = T[T["market"] == mk].iloc[0]
        L.append(f"| {mk} | {r['mae_line']:.3f} | {r['mae_model']:.3f} | "
                 f"{r['mae_blend']:.3f} | {100*(r['mae_blend']/r['mae_line']-1):+.2f}% |")

    L += ["\n## Pooled — blend vs blind under on the identical rows\n",
          "| cut | venue | n | win% | ROI | blind under | delta |",
          "|---|---|---|---|---|---|---|"]
    for pct in (100, 25, 10, 5):
        for venue in ("cons", "best", "second"):
            s = T[(T["cut"] == f"top{pct}%") & (T["venue"] == venue)].dropna(
                subset=["roi"])
            n = s["n"].sum()
            if n == 0:
                continue
            wt = lambda c: (s[c] * s["n"]).sum() / n                    # noqa: E731
            L.append(f"| top{pct}% | {venue} | {n:,} | {wt('win'):.2f} | "
                     f"{wt('roi'):+.2f} | {wt('blind_roi'):+.2f} | "
                     f"{wt('roi')-wt('blind_roi'):+.2f} |")

    L += ["\n## Per market at top10%, best line\n",
          "| market | n | win% | ROI | blind under | delta |", "|---|---|---|---|---|---|"]
    for mk in sorted(T["market"].unique()):
        s = T[(T["market"] == mk) & (T["cut"] == "top10%") & (T["venue"] == "best")]
        if len(s) and pd.notna(s.iloc[0]["roi"]):
            s = s.iloc[0]
            L.append(f"| {mk} | {s['n']:,} | {s['win']:.2f} | {s['roi']:+.2f} | "
                     f"{s['blind_roi']:+.2f} | {s['delta']:+.2f} |")

    path = os.path.join(ROOT, "NBA_PROPS_COMBINE_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
