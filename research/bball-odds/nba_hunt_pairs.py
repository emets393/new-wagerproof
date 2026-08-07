#!/usr/bin/env python3
"""Pairwise INTERACTION search -- the thing the first hunt never did.

nba_hunt_validate.py looped `for c in cols` and tested one feature at a time. Every one of
its 308,860 "cells" was a single cut. So it could not have found S11, which is
dead-team AND road-grind and whose second half is worth -0.39% on its own. The search
space did not contain the answer.

This tests PAIRS, and it scores them on the only statistic that makes an interaction
interesting:

    interaction excess = ROI(A and B) - max(ROI(A), ROI(B))

A pair that merely inherits a strong marginal scores ~0 here and is correctly ignored --
which kills the dominant failure mode of any conjunction sweep, where the "discovery" is a
slightly smaller slice of something you already knew. S11 scores +4.3 on this statistic
(16.08 vs dead-alone 11.75); the tired-alone leg is negative.

Honesty machinery, carried over from the stage-B post-mortem:
  * thresholds AND selection use the discovery seasons only; the validation seasons are
    never touched until scoring
  * the headline is an AGGREGATE over everything selected, not the best held-out cell
  * the null is the mean held-out excess over ALL evaluated pairs -- if selection has no
    skill, the selected set looks exactly like the population

    python3 nba_hunt_pairs.py --universe gp25 --markets core
"""
import argparse
import hashlib
import os
import warnings

import numpy as np
import pandas as pd

from nba_hunt_sweep import build_markets

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")

DISCOVER = ["2022-23", "2023-24"]
VALIDATE = ["2024-25", "2025-26"]

UNIVERSE = {
    "all":   lambda d: d["postseason"] == 0,
    "gp25":  lambda d: (d["postseason"] == 0) & (d["min_gp"] >= 25),
    "gp50":  lambda d: (d["postseason"] == 0) & (d["min_gp"] >= 50),
    "early": lambda d: (d["postseason"] == 0) & (d["min_gp"] < 25),
}

MARKETS = {
    "core": ["fg_spread_home", "fg_spread_away", "fg_spread_fav", "fg_spread_dog",
             "fg_total_over", "fg_total_under"],
    "wide": ["fg_spread_home", "fg_spread_away", "fg_spread_fav", "fg_spread_dog",
             "fg_total_over", "fg_total_under", "h1_spread_home", "h1_spread_away",
             "h1_total_over", "h1_total_under", "tt_home_over", "tt_home_under",
             "tt_away_over", "tt_away_under"],
}

# Non-feature columns: outcomes, prices, ids. Anything that encodes the result of THIS
# game is a leak, and anything that is an id is noise with a spurious ordering.
BAN_EXACT = {
    "margin", "gm_total", "h1_margin", "h1_total", "ats_margin", "ou_margin",
    "home_cover", "over", "home_win", "h1_ats_margin", "h1_ou_margin", "h1_home_cover",
    "h1_over", "tt_home_over", "tt_away_over", "is_ot", "home_score", "away_score",
    "home_h1", "away_h1", "home_q1", "home_q2", "visitor_q1", "visitor_q2",
    "postseason", "season", "home_tid", "away_tid", "bdl_id", "espn_id", "espn_game_id",
}
BAN_PREFIX = ("t60_", "t4_", "t24_", "c_h1_", "c_tt_")  # prices; points are re-added below
KEEP_ANYWAY = {"t60_spread_home_point", "t60_total_point", "late_spread_move",
               "late_total_move"}


def feature_cols(d):
    out = []
    for c in d.columns:
        if c in KEEP_ANYWAY:
            out.append(c)
            continue
        if c in BAN_EXACT or c.startswith(BAN_PREFIX):
            continue
        if not pd.api.types.is_numeric_dtype(d[c]):
            continue
        if d[c].nunique(dropna=True) < 3:
            continue
        out.append(c)
    return out


def build_masks(d, cols, uni, thr_rows, lo=0.18, hi=0.62):
    """Marginal masks sized to be useful as interaction PARTNERS.

    A mask covering 90% of the universe pairs into something indistinguishable from its
    partner; one covering 3% pairs into nothing. Only masks between `lo` and `hi` of the
    universe survive. Cut points come from the discovery rows only.
    """
    masks, meta, seen = [], [], set()
    nu = uni.sum()
    for c in cols:
        v = d[c].to_numpy(float)
        sub = v[uni & thr_rows & np.isfinite(v)]
        if len(sub) < 200:
            continue
        cands = []
        uq = np.unique(sub)
        if len(uq) <= 5:
            for u in uq:
                cands.append((f"{c}=={u:g}", v == u))
        else:
            q = np.quantile(sub, [0.25, 0.35, 0.5, 0.65, 0.75])
            for lab, thr in zip(["hi75", "hi65", "hi50", "lo35", "lo25"],
                                [q[4], q[3], q[2], q[1], q[0]]):
                m = (v >= thr) if lab.startswith("hi") else (v <= thr)
                cands.append((f"{c}{'>=' if lab.startswith('hi') else '<='}{thr:.4g}", m))
        for lab, m in cands:
            full = uni & np.isfinite(v) & m
            frac = full.sum() / nu
            if not (lo <= frac <= hi):
                continue
            h = hashlib.blake2b(np.packbits(full).tobytes(), digest_size=12).digest()
            if h in seen:
                continue
            seen.add(h)
            masks.append(full)
            meta.append({"feature": c, "rule": lab})
    return np.asarray(masks, np.float32), pd.DataFrame(meta)


def stat_matrix(d, mkts, markets, rows):
    """(ngames x 3*nmarket) of [win, n, profit] with non-`rows` games zeroed out."""
    blocks = []
    for m in mkts:
        y, price = markets[m]
        ok = np.isfinite(y) & np.isfinite(price) & rows
        yy = np.where(ok, np.nan_to_num(y), 0.0)
        nn = ok.astype(np.float32)
        pr = np.where(ok, np.where(np.nan_to_num(y) > 0,
                                   np.nan_to_num(price) - 1.0, -1.0), 0.0)
        blocks += [yy, nn, pr]
    return np.asarray(blocks, np.float32).T.copy()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--universe", default="gp25", choices=list(UNIVERSE))
    ap.add_argument("--markets", default="core", choices=list(MARKETS))
    ap.add_argument("--min-disc", type=int, default=60)
    ap.add_argument("--min-val", type=int, default=40)
    ap.add_argument("--excess", type=float, default=3.0,
                    help="pp the pair must beat its BEST marginal by, in discovery")
    ap.add_argument("--over-base", type=float, default=5.0)
    ap.add_argument("--max-masks", type=int, default=1600)
    ap.add_argument("--out", default="nba_hunt_pairs.csv")
    a = ap.parse_args()

    d = (pd.read_parquet(os.path.join(PQ, "nba_hunt_frame2.parquet"))
           .sort_values("game_date").reset_index(drop=True))
    markets = build_markets(d)
    mkts = MARKETS[a.markets]
    nm = len(mkts)

    uni = UNIVERSE[a.universe](d).to_numpy()
    disc = d["season"].isin(DISCOVER).to_numpy() & uni
    val = d["season"].isin(VALIDATE).to_numpy() & uni
    print(f"universe {a.universe}: {uni.sum():,} games "
          f"({disc.sum():,} discovery / {val.sum():,} validation)", flush=True)

    cols = feature_cols(d)
    print(f"{len(cols)} candidate features", flush=True)
    B, meta = build_masks(d, cols, uni, disc)
    if len(B) > a.max_masks:
        # Deterministic thinning -- keep an even spread across features rather than the
        # first N, which would be alphabetical and therefore all one family.
        keep = np.linspace(0, len(B) - 1, a.max_masks).astype(int)
        B, meta = B[keep], meta.iloc[keep].reset_index(drop=True)
    nmask = len(B)
    print(f"{nmask} marginal masks -> {nmask * (nmask - 1) // 2:,} pairs x {nm} markets = "
          f"{nmask * (nmask - 1) // 2 * nm:,} cells", flush=True)

    Sd = stat_matrix(d, mkts, markets, disc)
    Sv = stat_matrix(d, mkts, markets, val)
    S = np.concatenate([Sd, Sv], axis=1)          # (ngames x 6*nm)

    # baselines: universe ROI per market, per split
    Cu = np.concatenate([disc, val]).astype(np.float32)  # unused, kept for clarity
    base = {}
    for tag, rows, Sx in (("d", disc, Sd), ("v", val, Sv)):
        r = rows.astype(np.float32) @ Sx
        n = np.maximum(r[1::3], 1)
        base[tag] = r[2::3] / n

    Call = B @ S                                   # (nmask x 6*nm) marginals
    def split(C):
        Wd, Nd, Pd = C[..., 0:3 * nm:3], C[..., 1:3 * nm:3], C[..., 2:3 * nm:3]
        o = 3 * nm
        Wv, Nv, Pv = C[..., o + 0::3], C[..., o + 1::3], C[..., o + 2::3]
        return (Nd, Pd / np.maximum(Nd, 1), Wd / np.maximum(Nd, 1),
                Nv, Pv / np.maximum(Nv, 1), Wv / np.maximum(Nv, 1))

    mNd, mRd, _, mNv, mRv, _ = split(Call)

    rows_out, n_eval = [], 0
    val_excess_all = []
    Bb = B.astype(bool)
    for i in range(nmask - 1):
        idx = np.flatnonzero(Bb[i])
        if len(idx) < a.min_disc:
            continue
        Ci = Bb[i + 1:, idx].astype(np.float32) @ S[idx]      # (nmask-i-1 x 6*nm)
        Nd, Rd, Wd, Nv, Rv, Wv = split(Ci)
        big = (Nd >= a.min_disc) & (Nv >= a.min_val)
        if not big.any():
            continue
        # 100x because ROI is carried as a fraction here and quoted in points everywhere else
        best_marg = np.maximum(mRd[i][None, :], mRd[i + 1:])
        exc_d = 100 * (Rd - best_marg)
        over_b = 100 * (Rd - base["d"][None, :])
        exc_v = 100 * (Rv - base["v"][None, :])

        val_excess_all.append(exc_v[big])
        n_eval += int(big.sum())

        sel = big & (exc_d >= a.excess) & (over_b >= a.over_base)
        for jj, mm in zip(*np.nonzero(sel)):
            j = i + 1 + jj
            rows_out.append({
                "market": mkts[mm],
                "A": f"{meta.rule[i]}", "B": f"{meta.rule[j]}",
                "fA": meta.feature[i], "fB": meta.feature[j],
                "n_disc": int(Nd[jj, mm]), "roi_disc": 100 * Rd[jj, mm],
                "win_disc": 100 * Wd[jj, mm],
                "marg_A": 100 * mRd[i, mm], "marg_B": 100 * mRd[j, mm],
                "exc_disc": exc_d[jj, mm], "over_base_disc": over_b[jj, mm],
                "n_val": int(Nv[jj, mm]), "roi_val": 100 * Rv[jj, mm],
                "win_val": 100 * Wv[jj, mm], "exc_val": exc_v[jj, mm],
            })

    va = np.concatenate(val_excess_all) if val_excess_all else np.array([0.0])
    R = pd.DataFrame(rows_out)
    print(f"\nevaluated {n_eval:,} pairs meeting the size floor", flush=True)
    print(f"selected  {len(R):,} in discovery "
          f"(excess >= {a.excess}pp over best marginal AND >= {a.over_base}pp over base)",
          flush=True)

    print("\n" + "=" * 74)
    print("DOES INTERACTION SEARCH TRANSFER?  (the only question that matters)")
    print("=" * 74)
    if len(R):
        sel_v, pop_mu, pop_sd = R["exc_val"].to_numpy(), va.mean(), va.std()
        z = (sel_v.mean() - pop_mu) / (pop_sd / np.sqrt(len(sel_v)))
        print(f"  held-out excess ROI, SELECTED pairs : {sel_v.mean():+7.3f}%  (k={len(sel_v):,})")
        print(f"  held-out excess ROI, ALL pairs      : {pop_mu:+7.3f}%  (sd {pop_sd:.3f})")
        print(f"  z of selection skill                : {z:+7.2f}")
        print(f"  share of selected staying positive  : {100 * (sel_v > 0).mean():6.1f}%"
              f"   (population {100 * (va > 0).mean():.1f}%)")
        R = R.sort_values("exc_val", ascending=False)
        R.to_csv(os.path.join(ROOT, a.out), index=False)
        print(f"\n-> {a.out}")
        cc = ["market", "fA", "fB", "n_disc", "roi_disc", "marg_A", "marg_B",
              "exc_disc", "n_val", "roi_val", "exc_val"]
        print("\ntop 25 by HELD-OUT excess (these are hypotheses, not results):")
        print(R.head(25)[cc].to_string(index=False, float_format=lambda x: f"{x:7.2f}"))
    else:
        print("  nothing cleared discovery -- loosen --excess or widen --universe")


if __name__ == "__main__":
    main()
