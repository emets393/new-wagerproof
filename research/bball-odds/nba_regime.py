#!/usr/bin/env python3
"""Are NBA seasons the same league? nba_panel_all.py assumes yes. This tests it.

THE COMPLAINT, restated as something measurable. The walk-forward in nba_panel_all.py trains on
`idx < d0` -- every game ever played, unweighted -- and standardises features using the mean and sd
of that whole pooled window. Two consequences if seasons are genuinely different environments:

  1. LEVEL DRIFT BECOMES BIAS. A feature like "team pace over the last five games" is a raw level.
     If the league's pace rises, every team in the new season sits above the pooled mean, so a fixed
     coefficient pushes every prediction the same direction for a reason that has nothing to do with
     any team. The fix is to ask "how far above THIS season's norm" instead of "how big".
  2. STALE RELATIONSHIPS GET EQUAL VOTES. If the mapping from features to points changes -- rule
     changes, a three-point revolution, defensive adaptation -- then 2022 rows are not just less
     relevant, they are actively wrong, and giving them the same weight as last week's rows drags
     the fit toward a league that no longer exists.

Neither is obviously fatal. The TARGET here is points minus the market's implied team total, and the
market absorbs league-level drift on its own, so the target is already roughly regime-neutral even
when the features are not. Which of those two effects wins is an empirical question, so:

  STUDY 1  How different ARE the seasons? League aggregates, per-feature between-season variance,
           and a season classifier -- if a model can tell you which season a row came from using
           only the features, the regimes are distinguishable and the concern is real.
  STUDY 2  Do the RELATIONSHIPS change, or only the levels? Fit the same ridge separately per
           season and correlate the coefficient vectors. Levels drifting is a normalisation problem;
           coefficients rotating is a pooling problem, and they need different fixes.
  STUDY 3  The bake-off. Seven training regimes, same features, same grading rows, same nulls:
           pooled (the current baseline), two trailing-window lengths, two recency half-lives,
           season-relative features, and the combination. Graded per season, never pooled.
  STUDY 4  Cold start. Rolling features carry the previous roster into October. Grade by month to
           see whether the early season is being predicted with stale inputs.

Every variant is graded on the SAME rows -- the intersection of what all seven can predict -- so the
comparison is like-for-like rather than a contest about who bets more often.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd
from scipy.linalg import cho_factor, cho_solve

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "data", "parquet", "_nba_wide_cache.parquet")
PRED = os.path.join(ROOT, "data", "parquet", "_nba_regime_preds.parquet")
NULLS = 20
REFIT_DAYS = 28
MIN_TRAIN = 2552
ALPHAS = (30.0, 100.0, 300.0, 1000.0)
SEASON_ROWS = 2552               # one season of team-games
SHRINK_K = 500                   # pseudo-rows pulling a young season's norm toward all-history


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
mk = _load("mk", "nba_markets.py")
pa = _load("pa", "nba_panel_all.py")


# --------------------------------------------------------------------------------------------
# the walk, generalised: trailing window and/or recency weights
# --------------------------------------------------------------------------------------------
def walk(X, dates, ys, window=None, half_life=None, seasons=None, **kw):
    """Thin alias over nba_panel_all.ridge_multi so the two files cannot drift apart.

    The weighting lives there because that is the file that ships predictions; this study only
    varies its knobs. `half_life=None` reproduces the original equal-weight behaviour exactly
    (verified to 6e-15), so the baseline row of the bake-off is genuinely the old model.
    """
    return pa.ridge_multi(X, dates, ys, half_life=half_life, window=window,
                          min_train=MIN_TRAIN, refit_days=REFIT_DAYS, alphas=ALPHAS, **kw)


# --------------------------------------------------------------------------------------------
# season-relative features
# --------------------------------------------------------------------------------------------
def season_relative(P, cols, k=SHRINK_K):
    """Rewrite each feature as "how far from this season's norm", using only the past.

    Two expanding statistics, both shifted so today never sees itself: one within the current
    season, one over all history. A young season has a tiny sample, so its own mean is noise --
    blend the two with a pseudo-count, n/(n+k), which starts the season on all-history norms and
    slides to season-specific norms as games accumulate. No prior-season special case, and the
    first season degenerates to the pooled behaviour, which is what it should do.
    """
    Xs = P[cols].astype(float)
    n_all = Xs.notna().expanding().sum().shift(1)
    mu_all = Xs.expanding().mean().shift(1)
    sd_all = Xs.expanding().std().shift(1)

    mu_s = pd.DataFrame(index=Xs.index, columns=cols, dtype=float)
    sd_s = pd.DataFrame(index=Xs.index, columns=cols, dtype=float)
    n_s = pd.DataFrame(index=Xs.index, columns=cols, dtype=float)
    for s in P["season"].unique():
        m = P["season"] == s
        sub = Xs.loc[m]
        mu_s.loc[m] = sub.expanding().mean().shift(1).values
        sd_s.loc[m] = sub.expanding().std().shift(1).values
        n_s.loc[m] = sub.notna().expanding().sum().shift(1).values

    w = (n_s / (n_s + k)).fillna(0.0)
    mu = w * mu_s.fillna(mu_all) + (1 - w) * mu_all
    sd = w * sd_s.fillna(sd_all) + (1 - w) * sd_all
    sd = sd.where(sd.abs() > 1e-9)
    Z = (Xs - mu) / sd
    # burn-in rows have no history to normalise against; leave them raw-centred rather than NaN,
    # since they are training fodder only and dropping them would shrink every variant's window
    return Z.where(Z.notna(), Xs - Xs.expanding().mean().shift(1)).fillna(0.0)


# --------------------------------------------------------------------------------------------
# STUDY 1 -- how different are the seasons?
# --------------------------------------------------------------------------------------------
def study_drift(L, D, P, cols):
    L += ["## Study 1 — how different are the seasons, actually?", "",
          "Before changing anything, measure the thing being complained about. If the seasons are "
          "the same league, none of this matters and the pooled fit is right.", "",
          "### League environment by season", "",
          "| season | games | avg total pts | avg pace | 3PA share of FGA | home margin | "
          "avg posted total |", "|---|---|---|---|---|---|---|"]
    for s in sorted(D["season"].dropna().unique()):
        d = D[D["season"] == s]
        pace = d[[c for c in ("h_l5_pace", "a_l5_pace") if c in d.columns]].mean().mean()
        tpa = [c for c in d.columns if "3pa" in c.lower() and "rate" in c.lower()]
        share = d[tpa].mean().mean() if tpa else np.nan
        L.append(f"| {int(s)} | {len(d):,} | {d['y_fg_total'].mean():.1f} | "
                 f"{pace:.1f} | {share:.3f} | {d['y_fg_margin'].mean():+.2f} | "
                 f"{d['t60_total_point'].mean():.1f} |")
        print("[drift] " + L[-1], flush=True)

    # Between-season variance as a share of total variance, per feature. This is the direct measure
    # of "the same number means something different each year".
    eta = {}
    for c in cols:
        v = P[c].astype(float)
        if v.notna().sum() < 2000 or v.std() == 0:
            continue
        gm = v.groupby(P["season"]).mean()
        gn = v.groupby(P["season"]).count()
        ssb = float((gn * (gm - v.mean()) ** 2).sum())
        sst = float(((v - v.mean()) ** 2).sum())
        if sst > 0:
            eta[c] = ssb / sst
    E = pd.Series(eta).sort_values(ascending=False)
    L += ["", "### Which features drift between seasons", "",
          "Between-season variance as a share of each feature's total variance. A feature at 0.30 "
          "spends nearly a third of its spread just being in a different year — for that column, "
          "a pooled mean is an average of four different leagues.", "",
          f"- features measured: **{len(E):,}**",
          f"- median share of variance that is between-season: **{E.median():.3f}**",
          f"- features above 0.10: **{int((E > 0.10).sum())}**  |  above 0.25: "
          f"**{int((E > 0.25).sum())}**  |  above 0.50: **{int((E > 0.50).sum())}**", "",
          "| feature | between-season share |", "|---|---|"]
    for c, v in E.head(15).items():
        L.append(f"| `{c}` | {v:.3f} |")
    print(f"[drift] median eta2 {E.median():.3f}, >0.25: {int((E>0.25).sum())} of {len(E)}",
          flush=True)

    # Season classifier. If features alone identify the season out-of-sample, the regimes are
    # distinguishable -- which is exactly the claim being tested, stated as a prediction problem.
    Xz = P[cols].astype(float)
    Xz = ((Xz - Xz.mean()) / Xz.std().replace(0, 1)).fillna(0.0).values
    ss = P["season"].values
    rng = np.random.default_rng(7)
    perm = rng.permutation(len(P))
    cut = int(0.7 * len(P))
    trn, tst = perm[:cut], perm[cut:]
    seasons = sorted(pd.unique(ss))
    Wc = []
    for s in seasons:
        y = (ss[trn] == s).astype(float)
        A = Xz[trn]
        G = A.T @ A + 500.0 * np.eye(A.shape[1])
        Wc.append(np.linalg.solve(G, A.T @ (y - y.mean())))
    S = np.column_stack([Xz[tst] @ w for w in Wc])
    pred = np.array(seasons)[S.argmax(axis=1)]
    acc = float((pred == ss[tst]).mean())
    basec = float(pd.Series(ss[tst]).value_counts(normalize=True).max())
    L += ["", "### Can a model tell which season a row came from?", "",
          "One-vs-rest ridge on the features alone, 70/30 split, predicting the SEASON label. This "
          "is the complaint as a prediction problem: if the seasons were one league, this would sit "
          "at the base rate.", "",
          f"- accuracy **{100*acc:.1f}%** against a **{100*basec:.1f}%** base rate "
          f"({len(seasons)} seasons)", ""]
    print(f"[drift] season classifier {100*acc:.1f}% vs base {100*basec:.1f}%", flush=True)
    return L, E


# --------------------------------------------------------------------------------------------
# STUDY 2 -- do the relationships change, or only the levels?
# --------------------------------------------------------------------------------------------
def study_coefs(L, P, cols, ycol):
    """Fit the same ridge inside each season and compare the coefficient vectors.

    This separates the two failure modes. If levels drift but coefficients hold, the fix is
    normalisation and pooling is still buying real sample. If the coefficients rotate season to
    season, pooling is averaging incompatible models and no amount of normalisation saves it.
    """
    seasons = sorted(P["season"].dropna().unique())
    B = {}
    for s in seasons:
        m = (P["season"] == s) & P[ycol].notna()
        if m.sum() < 1500:
            continue
        A = P.loc[m, cols].astype(float)
        A = ((A - A.mean()) / A.std().replace(0, 1)).fillna(0.0).values
        y = P.loc[m, ycol].astype(float).values
        G = A.T @ A + 300.0 * np.eye(A.shape[1])
        B[int(s)] = np.linalg.solve(G, A.T @ (y - y.mean()))
    ks = sorted(B)
    C = pd.DataFrame(index=ks, columns=ks, dtype=float)
    for i in ks:
        for j in ks:
            C.loc[i, j] = float(np.corrcoef(B[i], B[j])[0, 1])
    off = [C.loc[i, j] for i in ks for j in ks if i < j]
    L += ["", "## Study 2 — do the relationships change, or only the levels?", "",
          "The same ridge fit inside each season separately, then the coefficient vectors "
          "correlated against each other. Two very different diagnoses hide behind the same "
          "complaint: if the numbers only shift LEVEL, normalising per season fixes it and pooling "
          "still buys real sample; if the COEFFICIENTS rotate, pooling is averaging models of "
          "different leagues and normalisation will not save it.", "",
          "| | " + " | ".join(str(k) for k in ks) + " |",
          "|---" * (len(ks) + 1) + "|"]
    for i in ks:
        L.append(f"| **{i}** | " + " | ".join(f"{C.loc[i, j]:+.3f}" for j in ks) + " |")
    L += ["", f"Mean off-diagonal correlation **{np.mean(off):+.3f}** "
          f"(range {min(off):+.3f} to {max(off):+.3f}).", ""]
    print(f"[coef] mean cross-season coefficient corr {np.mean(off):+.3f}", flush=True)
    return L, float(np.mean(off))


# --------------------------------------------------------------------------------------------
# STUDY 3 -- the bake-off
# --------------------------------------------------------------------------------------------
VARIANTS = [
    dict(key="A_pooled", name="pooled, all history (current baseline)", kw={},
         note="what nba_panel_all.py does today"),
    dict(key="B1_win1", name="trailing 1 season of rows", kw=dict(window=SEASON_ROWS),
         note="hard cutoff: nothing older than ~one season votes"),
    dict(key="B2_win2", name="trailing 2 seasons of rows", kw=dict(window=2 * SEASON_ROWS),
         note="hard cutoff, longer memory"),
    dict(key="C180", name="recency half-life 180 days", kw=dict(half_life=180.0),
         note="a game from last season counts about a quarter of a recent one"),
    dict(key="C365", name="recency half-life 365 days", kw=dict(half_life=365.0),
         note="soft decay, one season half-life"),
    dict(key="D_srel", name="season-relative features, all history", kw={}, srel=True,
         note="features as distance from this season's own norm, not raw level"),
    dict(key="E_both", name="season-relative + half-life 365", kw=dict(half_life=365.0), srel=True,
         note="both fixes at once"),
]


def main():
    D = pd.read_parquet(CACHE).sort_values("date").reset_index(drop=True)
    D["date"] = pd.to_datetime(D["date"])
    stack = pa.wide_stack(D)
    P, fcols = pa.build_panel(D, stack)

    P["_yfg"] = P["pts"] - P["impl"]
    sh = pa.asof_ratio(P["h1"], P["impl"])
    P["_impl_h1"] = sh * P["impl"]
    P["_yh1"] = P["h1"] - P["_impl_h1"]
    cols = [c for c in fcols if c not in mk.leak(P, fcols, "_yfg", "impl")]
    print(f"[regime] {len(cols)} features after the leak screen", flush=True)

    L = ["# NBA — are the seasons the same league?", "",
         "`nba_panel_all.py` trains every model on all prior history with equal weight and "
         "standardises features against a pooled multi-season mean. That is only correct if the "
         "seasons are one environment. This file tests that assumption four ways and, where it "
         "fails, measures whether fixing it changes any betting conclusion.", "",
         f"{len(P):,} team-games, {len(cols)} features, seasons "
         f"{int(P['season'].min())}–{int(P['season'].max())}.", ""]

    L, E = study_drift(L, D, P, cols)
    L, coefcorr = study_coefs(L, P, cols, "_yfg")

    # ---- run every variant -----------------------------------------------------------------
    rng = np.random.default_rng(20260801)
    ytgt = P["_yfg"]
    targets = [ytgt] + [pa.game_shuffle(P, ytgt, rng) for _ in range(NULLS)]

    if os.path.exists(PRED):
        C = pd.read_parquet(PRED)
        assert len(C) == len(P), "cached regime predictions do not match the panel; delete it"
        preds = {V["key"]: [C[f"{V['key']}_{i}"] for i in range(NULLS + 1)] for V in VARIANTS}
        print("[regime] loaded cached predictions", flush=True)
    else:
        Zs = season_relative(P, cols)
        print("[regime] season-relative features built", flush=True)
        preds = {}
        for V in VARIANTS:
            X = Zs if V.get("srel") else P[cols].astype(float)
            print(f"[regime] walking {V['key']} ({V['name']})", flush=True)
            preds[V["key"]] = walk(X, P["date"], targets, seasons=P["season"], **V["kw"])
            print(f"[regime]   oos corr {preds[V['key']][0].corr(ytgt):+.4f} on "
                  f"{int(preds[V['key']][0].notna().sum()):,} rows", flush=True)
        pd.DataFrame({f"{V['key']}_{i}": preds[V["key"]][i]
                      for V in VARIANTS for i in range(NULLS + 1)}).to_parquet(PRED)

    # Common grading rows: every variant must be able to predict them, or the comparison is about
    # coverage rather than accuracy.
    common = P.index.to_series().notna()
    for V in VARIANTS:
        common &= preds[V["key"]][0].notna()
    print(f"[regime] {int(common.sum()):,} team-games predictable by all variants", flush=True)

    # ---- grade at game level ----------------------------------------------------------------
    G = D.set_index("event_id").copy()
    okg = P.loc[common, "event_id"]
    okg = set(okg.value_counts()[lambda s: s == 2].index)      # both rows present
    gmask = pd.Series(G.index.isin(okg), index=G.index)

    def game_pred(key, i):
        t = P.assign(pred=P["impl"] + preds[key][i])[["event_id", "team_row", "pred"]]
        return t.pivot(index="event_id", columns="team_row", values="pred").reindex(G.index)

    bin_ = lambda s: pd.Series(np.where(s > 0, 1.0, np.where(s < 0, 0.0, np.nan)), index=s.index)
    dec = lambda c: pd.Series(v2.to_dec(G[c]), index=G.index)

    MKTS = [
        dict(key="fg_total", name="Full-game total", k=4, kind="tot",
             yb=bin_(G["y_fg_total"] - G["t60_total_point"]), line=G["t60_total_point"],
             po=dec("t60_total_over_price"), pu=dec("t60_total_under_price")),
        dict(key="fg_spread", name="Full-game spread", k=3, kind="sp",
             yb=bin_(G["y_fg_marg_resid"]), line=G["t60_spread_home_point"],
             po=dec("t60_spread_home_price"), pu=dec("t60_spread_away_price")),
    ]

    for MK in MKTS:
        L += ["", f"## Study 3 — {MK['name']}: seven training regimes, same rows", "",
              "Every regime is graded on the identical set of games — the ones all seven can "
              "predict — so this is a contest about accuracy, not about who bets more often. "
              f"Bet when the model and the market differ by at least {MK['k']} points. Nulls are "
              f"{NULLS} game-level shuffles per regime, re-measured in this cell.", "",
              "| regime | bets | win% | base% | edge | ROI | z | " +
              " | ".join(f"{int(s)} ROI" for s in sorted(G['season'].dropna().unique())[1:]) + " |",
              "|---" * (8 + len(sorted(G['season'].dropna().unique())[1:])) + "|"]
        for V in VARIANTS:
            def d(i):
                gp = game_pred(V["key"], i)
                v = (gp["home"] + gp["away"]) if MK["kind"] == "tot" else -(gp["home"] - gp["away"])
                return v - MK["line"]
            g = pa.grade(d(0), MK["yb"], MK["po"], MK["pu"], MK["k"], mask=gmask)
            if not g["n"]:
                continue
            ne = []
            for i in range(1, NULLS + 1):
                gg = pa.grade(d(i), MK["yb"], MK["po"], MK["pu"], MK["k"], mask=gmask)
                ne.append(gg["win"] - gg["base"])
            ne = np.array(ne, dtype=float)
            mu, sg = np.nanmean(ne), np.nanstd(ne, ddof=1)
            z = (g["win"] - g["base"] - mu) / sg if sg > 0 else np.nan
            per = []
            for s in sorted(G["season"].dropna().unique())[1:]:
                gs = pa.grade(d(0), MK["yb"], MK["po"], MK["pu"], MK["k"],
                              mask=gmask & (G["season"] == s))
                per.append("—" if not gs["n"] else f"{gs['roi']:+.1f}")
            L.append(f"| {V['name']} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** | {z:+.2f} | "
                     + " | ".join(per) + " |")
            print(f"[{MK['key']}] " + L[-1], flush=True)
        L.append("")

    # ---- STUDY 4 -- cold start ---------------------------------------------------------------
    L += ["", "## Study 4 — is the early season predicted with last season's team?", "",
          "Rolling features need games to fill. In October a five-game window is partly last "
          "season's roster, so if the regime concern is real anywhere it should be worst here. "
          "Baseline regime, full-game total, by calendar month.", "",
          "| month | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    gp = game_pred("A_pooled", 0)
    dtot = (gp["home"] + gp["away"]) - G["t60_total_point"]
    yb = bin_(G["y_fg_total"] - G["t60_total_point"])
    mo = pd.to_datetime(G["date"]).dt.month
    for m in (10, 11, 12, 1, 2, 3, 4, 5, 6):
        g = pa.grade(dtot, yb, dec("t60_total_over_price"), dec("t60_total_under_price"), 4,
                     mask=gmask & (mo == m))
        if g["n"]:
            nm = pd.Timestamp(2024, m, 1).strftime("%B")
            L.append(f"| {nm} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print("[month] " + L[-1], flush=True)
    L.append("")

    with open(os.path.join(ROOT, "NBA_REGIME.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_REGIME.md", flush=True)


if __name__ == "__main__":
    main()
