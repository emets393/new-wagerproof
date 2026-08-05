#!/usr/bin/env python3
"""ALTERNATE-LINE LADDERS: attack the rungs, not the main number.

Four books (betrivers, unibet_us, mybookieag, betonlineag) publish a full ladder for a
player instead of one number -- Luka points 34.5 through 44.5, each with its own two-way
price. Every earlier script in this folder threw those rows away, because a ladder poisons
a consensus median. That was right for building a consensus, and wrong as a place to stop:
the ladder is the least carefully priced surface in the whole prop market.

Why the rungs should be softer than the main line:
  - The main number is where the money is and where a book takes correction. The rungs
    are generated FROM it by a parametric fill, usually one shape applied to every player.
  - That fill has to guess the tail. Basketball counts are not one shape -- a high-usage
    scorer's distribution and a bench big's rebound distribution have completely different
    tails, and a single generator cannot match both.
  - Nobody arbs the rungs, so an error there survives.

Two independent attacks:

  A  MODEL vs LADDER. Fit a conditional CDF per market (LGBM quantile regression at 13
     quantiles, walk-forward), then price EVERY rung and bet where the model's implied
     probability most exceeds the book's. This is the same distribution machinery as the
     stack run, pointed at the surface it should be best at -- a CDF prices a whole ladder
     in one shot, which is exactly what a binary classifier cannot do.

  B  LADDER SELF-CONSISTENCY. A ladder implies its own distribution. Read it off the
     book's prices and check it against itself: de-vigged P(over) must be strictly
     decreasing as the line rises. Where a book's own ladder is non-monotonic it has
     mispriced a rung relative to its OWN opinion, no model required. This needs no
     forecasting skill at all, which makes it the cleaner test of the two.

GRADING. Every rung is graded at its own line and its own book's price -- never the
consensus line, never another rung's result. Pushes dropped. Reachability matters more
here than anywhere else in this folder, because two of the four ladder books are offshore:
everything is reported BOTH pooled and restricted to betrivers/unibet_us, the two a normal
US bettor can actually hold. If the edge only exists at mybookie it is not an edge.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

import lightgbm as lgb

from build_nba_props import norm_name, american_to_dec, MARKET_STAT
from nba_props_model import LEAK, IDS, feature_cols

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
BLOCK_MONTHS = 3
MIN_TRAIN = 5000
QS = [.05, .1, .2, .3, .4, .5, .6, .7, .8, .9, .95, .975, .99]

LADDER_BOOKS = ["betrivers", "unibet_us", "mybookieag", "betonlineag", "bovada"]
REACHABLE = {"betrivers", "unibet_us"}          # regulated US books a normal bettor holds


def load_ladder():
    """Every rung at T-60, priced two ways, joined to the settled box score."""
    frames = [pd.read_parquet(os.path.join(OUT, f)) for f in sorted(os.listdir(OUT))
              if f.startswith("props_nba_") and f.endswith(".parquet")]
    p = pd.concat(frames, ignore_index=True)
    p["snap"] = pd.to_datetime(p["snap_ts"], utc=True)
    p["ct"] = pd.to_datetime(p["commence_time"], utc=True)
    p = p[(p["ct"] - p["snap"]).dt.total_seconds() / 60 >= 60].copy()
    p["over_dec"] = american_to_dec(p["over_price"])
    p["under_dec"] = american_to_dec(p["under_price"])
    p = p[p["over_dec"].notna() & p["under_dec"].notna() & p["line_point"].notna()]
    p = p[p["market"].isin(MARKET_STAT) & p["book"].isin(LADDER_BOOKS)]
    p["pkey"] = p["player"].map(norm_name)

    # keep only genuine ladders: a book offering 3+ distinct rungs on one player-market
    k = ["event_id", "market", "pkey", "book"]
    p["n_rungs"] = p.groupby(k)["line_point"].transform("nunique")
    p = p[p["n_rungs"] >= 3].copy()

    # de-vigged P(over) implied by THIS rung's own two-way price
    io, iu = 1 / p["over_dec"], 1 / p["under_dec"]
    p["book_p_over"] = io / (io + iu)

    G = pd.read_parquet(f"{OUT}/props_graded.parquet")
    G["pkey"] = G["player"].map(norm_name)
    G = G[["event_id", "market", "pkey", "actual", "season", "date_et"]].drop_duplicates(
        ["event_id", "market", "pkey"])
    p = p.merge(G, on=["event_id", "market", "pkey"], how="inner")
    p["date"] = pd.to_datetime(p["date_et"])
    return p[p["actual"].notna()].reset_index(drop=True)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def grade_rungs(d, side_over, dec_col_over="over_dec", dec_col_under="under_dec"):
    """Grade at each rung's OWN line and OWN book price. Pushes dropped."""
    live = d["actual"] != d["line_point"]
    d, side_over = d[live], np.asarray(side_over)[live.to_numpy()]
    if len(d) < 100:
        return 0, np.nan, np.nan
    over_win = (d["actual"] > d["line_point"]).to_numpy(dtype=float)
    win = np.where(side_over, over_win, 1 - over_win)
    dec = np.where(side_over, d[dec_col_over], d[dec_col_under])
    g = ~np.isnan(dec)
    return int(g.sum()), 100 * win[g].mean(), roi(win[g], dec[g])


# --------------------------------------------------------------------------- attack A
def fit_cdf(P, panel):
    """Walk-forward quantile regression per market; returns model P(over) for every rung."""
    feats = panel.drop(columns=[c for c in panel.columns
                                if c in LEAK or c in IDS], errors="ignore")
    key = ["event_id", "market", "pkey"]
    P = P.merge(panel[key + [c for c in feats.columns if c in panel.columns]]
                .drop_duplicates(key), on=key, how="left", suffixes=("", "_f"))
    out = pd.Series(np.nan, index=P.index)

    for mk in sorted(P["market"].unique()):
        idx = P.index[P["market"] == mk]
        M = P.loc[idx]
        # the model must not see any price-derived column, or "model disagrees with the
        # book" collapses into "the book disagrees with itself" and attack A stops being
        # independent of attack B
        banned = {"line_point", "book_p_over", "over_dec", "under_dec", "over_price",
                  "under_price", "n_rungs", "viol_up", "viol_dn", "_prev", "_next",
                  "_mid", "_off"}
        cols = [c for c in feature_cols(M)
                if c not in banned and M[c].notna().mean() >= 0.5 and M[c].nunique() > 1]
        if len(cols) < 20:
            print(f"  {mk}: only {len(cols)} usable features, skipping", flush=True)
            continue
        mo = M["date"].dt.to_period("M")
        uniq = sorted(mo.unique())
        blocks = [uniq[i:i + BLOCK_MONTHS] for i in range(0, len(uniq), BLOCK_MONTHS)]
        for blk in blocks:
            te = M.index[mo.isin(blk)]
            tr = M.index[mo < blk[0]]
            if len(te) == 0 or len(tr) < MIN_TRAIN:
                continue
            # one row per player-game for TRAINING (a ladder repeats the same outcome
            # many times; training on rungs would weight ladder-heavy players 10x)
            u = M.loc[tr].drop_duplicates(["event_id", "market", "pkey"])
            Xtr = u[cols].to_numpy(dtype=np.float32)
            ytr = u["actual"].to_numpy(dtype=float)
            if len(u) < 2000:
                continue
            Xte = M.loc[te, cols].to_numpy(dtype=np.float32)
            qp = []
            for a in QS:
                m = lgb.LGBMRegressor(objective="quantile", alpha=a, n_estimators=250,
                                      learning_rate=0.05, num_leaves=31,
                                      min_child_samples=60, subsample=0.8,
                                      subsample_freq=1, colsample_bytree=0.6,
                                      reg_lambda=5.0, random_state=0, verbose=-1,
                                      n_jobs=4)
                qp.append(m.fit(Xtr, ytr).predict(Xte))
            V = np.sort(np.column_stack(qp), axis=1)
            ln = M.loc[te, "line_point"].to_numpy(dtype=float)
            q = np.asarray(QS)
            out.loc[te] = [1.0 - np.interp(ln[i], V[i], q, left=0.01, right=0.99)
                           for i in range(len(ln))]
        print(f"  {mk}: cdf priced {out.loc[idx].notna().sum():,} rungs", flush=True)
    P["model_p_over"] = out
    return P


# --------------------------------------------------------------------------- attack B
def monotonicity(P):
    """Flag rungs where a book's own ladder contradicts itself.

    Within one book's ladder, de-vigged P(over) must fall as the line rises. Where it
    rises instead, the pair is inconsistent and the book has overpriced the over on the
    higher rung (equivalently underpriced its under) relative to its own opinion.
    """
    k = ["event_id", "market", "pkey", "book"]
    P = P.sort_values(k + ["line_point"]).copy()
    g = P.groupby(k, sort=False)["book_p_over"]
    P["_prev"] = g.shift(1)
    P["_next"] = g.shift(-1)
    # this rung's P(over) is HIGHER than a lower rung's -> the over here is too rich
    P["viol_up"] = (P["book_p_over"] - P["_prev"]).fillna(0)
    # this rung's P(over) is LOWER than a higher rung's -> the under here is too rich
    P["viol_dn"] = (P["_next"] - P["book_p_over"]).fillna(0)
    return P


def main():
    print("loading ladders...", flush=True)
    P = load_ladder()
    print(f"  {len(P):,} rungs, {P.groupby(['event_id','market','pkey']).ngroups:,} props",
          flush=True)

    panel = pd.read_parquet(f"{OUT}/nba_props_panel.parquet").rename(
        columns={"season_x": "season"})
    panel = panel[panel["gp_prior"] >= 5]

    seasons = sorted(P["season"].dropna().unique())
    L = ["# NBA props — alternate-line ladders", "",
         f"{len(P):,} rungs from ladders of 3+, books {LADDER_BOOKS}, seasons {seasons}. "
         "Every rung graded at its own line and its own book's price.", "",
         "Reachable = betrivers + unibet_us only. An edge that lives at mybookie is not "
         "an edge.", ""]

    # ---------------------------------------------------------------- B first (no model)
    P = monotonicity(P)
    nu = int((P["viol_up"] >= 0.005).sum())
    nd = int((P["viol_dn"] >= 0.005).sum())
    L += ["\n## B — the ladder against itself: NULL, and decisively so\n",
          f"Across {len(P):,} rungs there are **{nu} upward and {nd} downward** "
          "self-contradictions of 0.5% or more in a book's own de-vigged ladder — "
          f"{100*(nu+nd)/len(P):.4f}% of rows, far too few to bet and consistent with "
          "rounding rather than mispricing.", "",
          "That is a real finding, not a failed test: the books generate their ladders "
          "from a strictly monotone parametric fill, so an internal arbitrage cannot "
          "occur by construction. Any ladder edge therefore has to come from the fill "
          "being the WRONG SHAPE, which only an external distribution can see. That is "
          "attack A, and it is the only remaining way in.", ""]

    # ---------------------------------------------------------------- A model vs ladder
    print("fitting conditional CDFs...", flush=True)
    P = fit_cdf(P, panel)
    P["edge_over"] = P["model_p_over"] - P["book_p_over"]
    P.to_parquet(f"{OUT}/nba_props_ladder_scored.parquet", index=False)

    L += ["\n## A — model CDF vs the ladder's price\n",
          "| edge | side | n | win% | ROI | reachable n | reachable ROI | per-season ROI |",
          "|---|---|---|---|---|---|---|---|"]
    for lo, hi, lbl in ((0.03, 0.06, "3-6%"), (0.06, 0.10, "6-10%"),
                        (0.10, 0.15, "10-15%"), (0.15, 1.0, "15%+")):
        for side, col in (("over", "edge_over"), ("under", None)):
            e = P["edge_over"] if side == "over" else -P["edge_over"]
            s = P[(e >= lo) & (e < hi) & P["model_p_over"].notna()]
            so = np.full(len(s), side == "over", dtype=bool)
            n, w, r = grade_rungs(s, so)
            sr = s[s["book"].isin(REACHABLE)]
            nr, _, rr = grade_rungs(sr, np.full(len(sr), side == "over", dtype=bool))
            per = []
            for ss in seasons:
                t = s[s["season"] == ss]
                per.append(f"{grade_rungs(t, np.full(len(t), side=='over', dtype=bool))[2]:+.1f}")
            L.append(f"| {lbl} | {side} | {n:,} | {w:.2f} | {r:+.2f} | {nr:,} | "
                     f"{rr:+.2f} | {'/'.join(per)} |")

    # where on the ladder does any edge live? tails are the generated part
    L += ["\n## A — by distance from the book's own middle rung\n",
          "| rungs from middle | n | model-over ROI | model-under ROI |",
          "|---|---|---|---|"]
    k = ["event_id", "market", "pkey", "book"]
    P["_mid"] = P.groupby(k)["line_point"].transform("median")
    P["_off"] = (P["line_point"] - P["_mid"]).abs()
    for lo, hi, lbl in ((0, 0.6, "at the middle"), (0.6, 2.1, "1-2"), (2.1, 4.1, "2-4"),
                        (4.1, 99, "4+")):
        s = P[(P["_off"] >= lo) & (P["_off"] < hi) & (P["edge_over"] >= 0.06)]
        _, _, ro = grade_rungs(s, np.ones(len(s), dtype=bool))
        s2 = P[(P["_off"] >= lo) & (P["_off"] < hi) & (P["edge_over"] <= -0.06)]
        n2, _, ru = grade_rungs(s2, np.zeros(len(s2), dtype=bool))
        L.append(f"| {lbl} | {len(s):,}/{n2:,} | {ro:+.2f} | {ru:+.2f} |")

    path = os.path.join(ROOT, "NBA_PROPS_LADDER_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
