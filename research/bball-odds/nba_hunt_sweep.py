#!/usr/bin/env python3
"""NBA signal hunt: sweep every filter x cut x phase x market, and price the search.

The whole point of this file is the null. Running tens of thousands of filter cells
GUARANTEES 60% pockets from noise, so a raw binomial z is meaningless here. Instead the
ENTIRE sweep is re-run on outcomes shuffled within season, N times, and we keep the
distribution of the BEST cell under pure noise. A survivor has to beat that distribution,
not beat 50%.

Two things that are easy to get wrong and are handled explicitly:

1. The comparator is the same SIDE rule in the same PHASE universe, never 50%. Backing
   favourites late in the season is already 53%, so a late-season favourite rule graded
   against 50% reads three points better than it is. This is the S9 lesson.
2. Grading is against the T-60 close with the T-60 price, per the closing-line policy.

Speed note: masks are built once and stacked into one float32 matrix, so a permutation
costs a single matmul against all markets at once rather than a Python loop over cells.

    python3 nba_hunt_sweep.py --perms 100
"""
import argparse
import hashlib
import os
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
OUT = ROOT

# Anything computed from the game being predicted. Never a filter.
LEAK = {
    "home_score", "away_score", "home_h1", "away_h1", "margin", "gm_total",
    "h1_margin", "h1_total", "ats_margin", "ou_margin", "home_cover", "over",
    "home_win", "h1_ats_margin", "h1_ou_margin", "h1_home_cover", "h1_over",
    "tt_home_over", "tt_away_over", "is_ot", "espn_id", "espn_game_id",
    "bdl_id", "home_tid", "away_tid", "season", "min_gp",
    # Quarter scores ARE the first half. A smoke run surfaced `visitor_q2 >= 34`
    # winning 82% of 1H overs, which is not a signal, it is the answer.
    "home_q1", "home_q2", "visitor_q1", "visitor_q2",
}

PHASES = {
    "all": lambda d: d["postseason"] == 0,
    "early": lambda d: (d["phase"] == "early"),
    "mid": lambda d: (d["phase"] == "mid"),
    "late": lambda d: (d["phase"] == "late"),
    "veryLate": lambda d: (d["phase"] == "veryLate"),
    "stretch": lambda d: d["phase"].isin(["late", "veryLate"]),
    "playoffs": lambda d: (d["phase"] == "playoffs"),
}


def to_dec(american):
    """American -> decimal. ONLY for the h1tt tables.

    The two sources disagree on price format and it is not documented: the movement
    (open/t24/t4/t60) columns from build_openclose.py are ALREADY DECIMAL -- a -110
    spread reads 1.91 there -- while h1tt_nba_* stores raw American (-110). Running
    to_dec over a decimal price turns 1.91 into 1.019 and every market prints an
    impossible -50% blind ROI, which is how this was caught.
    """
    a = np.asarray(american, dtype=float)
    # American odds are never strictly between -100 and +100. A few dozen rows across the
    # h1tt tables violate that (c_h1_spread_away_price bottoms out at -1.00), and -1.00
    # converts to decimal 101.0 -- one such winner paid 100 units and pushed whole cells
    # to +37% ROI at a 57% win rate. Kill them rather than clamp them.
    a = np.where(np.abs(a) >= 100, a, np.nan)
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))


def dec(x):
    """Full-game movement prices: already decimal, pass through."""
    return np.asarray(x, dtype=float)


# --------------------------------------------------------------- markets ---

def build_markets(d):
    """Each entry: outcome (1/0/nan), decimal price for the bet, and a label.

    'fav'/'dog' are resolved per game off the T-60 spread, which is what makes the
    favourite-rate comparator possible.
    """
    home_fav = d["t60_spread_home_point"] < 0
    M = {}

    def add(name, y, price):
        y = np.asarray(y, dtype=float)
        price = np.asarray(price, dtype=float)
        # Band-guard the decimal price too: anything outside a real book's range is a
        # parse artifact, and a single fake longshot can carry a cell's whole ROI.
        ok = np.isfinite(y) & np.isfinite(price) & (price > 1.01) & (price < 26.0)
        M[name] = (np.where(ok, y, np.nan), np.where(ok, price, np.nan))

    hc = d["home_cover"].to_numpy(float)
    sp_h, sp_a = dec(d["t60_spread_home_price"]), dec(d["t60_spread_away_price"])
    add("fg_spread_home", hc, sp_h)
    add("fg_spread_away", 1 - hc, sp_a)
    add("fg_spread_fav", np.where(home_fav, hc, 1 - hc), np.where(home_fav, sp_h, sp_a))
    add("fg_spread_dog", np.where(home_fav, 1 - hc, hc), np.where(home_fav, sp_a, sp_h))

    ov = d["over"].to_numpy(float)
    add("fg_total_over", ov, dec(d["t60_total_over_price"]))
    add("fg_total_under", 1 - ov, dec(d["t60_total_under_price"]))

    hw = d["home_win"].to_numpy(float)
    ml_h, ml_a = dec(d["t60_ml_home_price"]), dec(d["t60_ml_away_price"])
    add("fg_ml_home", hw, ml_h)
    add("fg_ml_away", 1 - hw, ml_a)
    add("fg_ml_fav", np.where(home_fav, hw, 1 - hw), np.where(home_fav, ml_h, ml_a))
    add("fg_ml_dog", np.where(home_fav, 1 - hw, hw), np.where(home_fav, ml_a, ml_h))

    h1c = d["h1_home_cover"].to_numpy(float)
    h1_h, h1_a = to_dec(d["c_h1_spread_home_price"]), to_dec(d["c_h1_spread_away_price"])
    add("h1_spread_home", h1c, h1_h)
    add("h1_spread_away", 1 - h1c, h1_a)
    add("h1_spread_fav", np.where(home_fav, h1c, 1 - h1c), np.where(home_fav, h1_h, h1_a))
    add("h1_spread_dog", np.where(home_fav, 1 - h1c, h1c), np.where(home_fav, h1_a, h1_h))

    h1o = d["h1_over"].to_numpy(float)
    add("h1_total_over", h1o, to_dec(d["c_h1_total_over_price"]))
    add("h1_total_under", 1 - h1o, to_dec(d["c_h1_total_under_price"]))

    tth, tta = d["tt_home_over"].to_numpy(float), d["tt_away_over"].to_numpy(float)
    add("tt_home_over", tth, to_dec(d["c_tt_home_over_price"]))
    add("tt_home_under", 1 - tth, to_dec(d["c_tt_home_under_price"]))
    add("tt_away_over", tta, to_dec(d["c_tt_away_over_price"]))
    add("tt_away_under", 1 - tta, to_dec(d["c_tt_away_under_price"]))
    return M


# ----------------------------------------------------------------- masks ---

CUTS = [("hi10", 0.90), ("hi20", 0.80), ("hi30", 0.70),
        ("lo10", 0.10), ("lo20", 0.20), ("lo30", 0.30)]


def feature_cols(d):
    """Numeric, mostly-populated, non-leaking columns.

    The cardinality floor is 2, not 4. An earlier version required 4 distinct values and
    silently dropped every binary flag -- including st_h_tank and st_h_eliminated, which
    ARE S9's mechanism. The sweep therefore could not have rediscovered the one NBA
    signal we already know is real, which is the calibration check this whole file needs
    to pass before any of its output means anything.
    """
    cols = []
    for c in d.columns:
        if c in LEAK or (c.startswith("c_") and c.endswith("_price")):
            continue
        if not pd.api.types.is_numeric_dtype(d[c]):
            continue
        s = d[c]
        if s.notna().mean() < 0.55 or s.nunique(dropna=True) < 2:
            continue
        cols.append(c)
    return cols


def build_masks(d, cols, min_n):
    """(feature, cut, phase) -> boolean row mask, deduped by content hash."""
    n = len(d)
    masks, meta, seen = [], [], set()
    for pname, pfun in PHASES.items():
        pmask = pfun(d).to_numpy()
        if pmask.sum() < min_n * 2:
            continue
        for c in cols:
            v = d[c].to_numpy(float)
            sub = v[pmask & np.isfinite(v)]
            if len(sub) < min_n * 2:
                continue
            uniq = np.unique(sub)
            cands = []
            if len(uniq) <= 6:
                # Low-cardinality: flags and small counts (tank, eliminated, b2b,
                # meeting number). Quantile cuts are meaningless here -- equality is
                # the rule a human would actually write.
                for u in uniq:
                    cands.append((f"{c} == {u:g}", v == u))
                    if len(uniq) > 2:
                        cands.append((f"{c} >= {u:g}", v >= u))
            else:
                qs = np.quantile(sub, [q for _, q in CUTS])
                for (cname, _), thr in zip(CUTS, qs):
                    m = (v >= thr) if cname.startswith("hi") else (v <= thr)
                    cands.append((f"{c} {'>=' if cname.startswith('hi') else '<='} {thr:.4g}", m))
            # Sign cuts matter for gaps/diffs/moves where zero is the meaningful edge,
            # and a quantile cut can miss it entirely.
            if sub.min() < 0 < sub.max():
                cands.append((f"{c} > 0", v > 0))
                cands.append((f"{c} < 0", v < 0))
            for label, m in cands:
                full = pmask & np.isfinite(v) & m
                if full.sum() < min_n:
                    continue
                h = hashlib.blake2b(np.packbits(full).tobytes(), digest_size=16).digest()
                if h in seen:
                    continue
                seen.add(h)
                masks.append(full)
                meta.append({"phase": pname, "feature": c, "rule": label, "n_rows": int(full.sum())})
    M = np.asarray(masks, dtype=np.float32)
    return M, pd.DataFrame(meta)


# ------------------------------------------------------------- evaluation ---

def market_arrays(d, markets):
    """Stack outcome / validity / profit / profit^2 so one matmul answers everything."""
    names = list(markets)
    n, m = len(d), len(markets)
    Y = np.zeros((n, m), np.float32)    # outcome, 0 where invalid
    V = np.zeros((n, m), np.float32)    # validity
    P = np.zeros((n, m), np.float32)    # profit per 1u stake
    for j, nm in enumerate(names):
        y, dec = markets[nm]
        ok = np.isfinite(y)
        V[:, j] = ok
        Y[:, j] = np.where(ok, np.nan_to_num(y), 0)
        P[:, j] = np.where(ok, np.where(np.nan_to_num(y) > 0, dec - 1.0, -1.0), 0)
    return names, np.hstack([Y, V, P, P ** 2]), m


def evaluate(M, S, m, phase_rows, meta_phase):
    """Cell and phase-universe aggregates for every (cell, market).

    The statistic is PROFIT, not win rate. A win-rate z is nonsense on the moneyline --
    the smoke run's best cell was "back the away team when they are a 5-point favourite",
    70% wins and -29% ROI -- because the base rate moves with the price. Profit per unit
    is comparable across every market and already nets out the vig.
    """
    C = M @ S
    W, N, PR = C[:, :m], C[:, m:2 * m], C[:, 2 * m:3 * m]

    base_p = np.zeros_like(W)   # phase mean profit
    base_w = np.zeros_like(W)   # phase win rate, for reporting only
    base_sd = np.zeros_like(W)
    for pname, rows in phase_rows.items():
        c = rows.astype(np.float32) @ S
        w, nn, pr, p2 = c[:m], c[m:2 * m], c[2 * m:3 * m], c[3 * m:]
        nn = np.maximum(nn, 1)
        mu = pr / nn
        var = np.maximum(p2 / nn - mu ** 2, 1e-6)
        sel = (meta_phase == pname).to_numpy()
        base_p[sel, :] = mu
        base_w[sel, :] = w / nn
        base_sd[sel, :] = np.sqrt(var)
    return W, N, PR, base_p, base_w, base_sd


def zstat(W, N, PR, base_p, base_w, base_sd, min_n):
    n = np.maximum(N, 1)
    p = np.where(N > 0, W / n, np.nan)
    roi = np.where(N > 0, PR / n, np.nan)
    z = (roi - base_p) / (base_sd / np.sqrt(n))
    z = np.where(N >= min_n, z, np.nan)
    return p, roi, z


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--perms", type=int, default=100)
    ap.add_argument("--min-n", type=int, default=150)
    ap.add_argument("--seed", type=int, default=17)
    ap.add_argument("--stage", default="marginal", choices=["marginal", "pairs"])
    ap.add_argument("--top", type=int, default=25, help="features carried into the pair stage")
    args = ap.parse_args()

    d = pd.read_parquet(os.path.join(PQ, "nba_hunt_frame.parquet"))
    d = d.sort_values("game_date").reset_index(drop=True)
    markets = build_markets(d)
    names, S, nmk = market_arrays(d, markets)
    cols = feature_cols(d)
    print(f"games {len(d)}  features {len(cols)}  markets {len(names)}")

    if args.stage == "pairs":
        prev = pd.read_csv(os.path.join(OUT, "nba_hunt_marginal.csv"))
        keep = (prev.sort_values("z", ascending=False)
                    .drop_duplicates("feature").head(args.top)["feature"].tolist())
        cols = [c for c in cols if c in keep]
        print(f"pair stage over {len(cols)} features: {cols}")

    M, meta = build_masks(d, cols, args.min_n)
    print(f"masks {M.shape}")

    if args.stage == "pairs":
        M, meta = expand_pairs(M, meta, args.min_n)
        print(f"pair masks {M.shape}")

    phase_rows = {p: (PHASES[p](d).to_numpy().astype(np.float32)) for p in meta["phase"].unique()}
    W, N, PR, bp, bw, bsd = evaluate(M, S, nmk, phase_rows, meta["phase"])
    p, roi, z = zstat(W, N, PR, bp, bw, bsd, args.min_n)

    # ---- the null: re-run the WHOLE sweep on season-shuffled outcomes ----
    rng = np.random.default_rng(args.seed)
    season = d["season"].to_numpy()
    idx_by_season = [np.flatnonzero(season == s) for s in np.unique(season)]
    null_max = np.zeros(args.perms)
    # Family-wise (best cell) is the strict bar, but on its own it hides the more useful
    # question: is there an EXCESS of strong cells over what noise makes? Counting cells
    # above a ladder of thresholds under the null gives a false-discovery view.
    LADDER = np.arange(2.5, 5.01, 0.25)
    null_cnt = np.zeros((args.perms, len(LADDER)))
    for k in range(args.perms):
        perm = np.arange(len(d))
        for ix in idx_by_season:
            perm[ix] = rng.permutation(ix)
        Wp, Np, PRp, bpp, bwp, bsdp = evaluate(M, S[perm], nmk, phase_rows, meta["phase"])
        _, _, zp = zstat(Wp, Np, PRp, bpp, bwp, bsdp, args.min_n)
        null_max[k] = np.nanmax(zp)
        finite = zp[np.isfinite(zp)]
        null_cnt[k] = [(finite >= t).sum() for t in LADDER]
        if (k + 1) % 20 == 0:
            print(f"  perm {k+1}/{args.perms}  best-cell z under noise so far: "
                  f"{np.median(null_max[:k+1]):.2f} med / {null_max[:k+1].max():.2f} max")

    thr95 = np.quantile(null_max, 0.95)
    print(f"\nnull best-cell z: median {np.median(null_max):.2f}, "
          f"95th pct {thr95:.2f}, max {null_max.max():.2f}")

    zf = z[np.isfinite(z)]
    print("\n== excess over noise (false-discovery view) ==")
    print(f"{'z>=':>6} {'observed':>9} {'null mean':>10} {'excess':>8} {'est FDR':>8}")
    for t, nc in zip(LADDER, null_cnt.mean(axis=0)):
        obs = int((zf >= t).sum())
        fdr = (nc / obs) if obs else np.nan
        print(f"{t:6.2f} {obs:9d} {nc:10.1f} {obs - nc:8.1f} {fdr:8.2f}")

    rows = []
    for i in range(M.shape[0]):
        for j, nm in enumerate(names):
            if not np.isfinite(z[i, j]):
                continue
            rows.append({
                "phase": meta.at[i, "phase"], "feature": meta.at[i, "feature"],
                "rule": meta.at[i, "rule"], "market": nm,
                "n": int(N[i, j]), "win_pct": 100 * p[i, j], "base_pct": 100 * bw[i, j],
                "edge": 100 * (p[i, j] - bw[i, j]), "roi": 100 * roi[i, j],
                "base_roi": 100 * bp[i, j], "z": z[i, j], "mask_i": i,
            })
    res = pd.DataFrame(rows)
    res["search_p"] = res["z"].apply(lambda v: float((null_max >= v).mean()))
    res["survives"] = res["z"] >= thr95
    res = res.sort_values("z", ascending=False)
    fn = os.path.join(OUT, f"nba_hunt_{args.stage}.csv")
    res.to_csv(fn, index=False)
    np.save(os.path.join(OUT, f"nba_hunt_{args.stage}_nullmax.npy"), null_max)
    print(f"wrote {fn}  cells={len(res)}  survivors={int(res.survives.sum())}")

    # Calibration: S9 (dead home favourite, late season) is already validated end-to-end,
    # so the harness has to be able to see it. If this block prints nothing or prints a
    # weak cell, distrust everything else on the page rather than the signal.
    cal = res[res.feature.isin(["st_h_tank", "st_h_eliminated"])
              & res.phase.isin(["stretch", "late", "veryLate"])
              & (res.market == "fg_spread_fav")]
    print("\n== calibration: can the harness see S9? ==")
    print(cal.head(8)[["phase", "market", "rule", "n", "win_pct", "base_pct", "edge",
                       "roi", "base_roi", "z"]].to_string(index=False,
                                                          float_format=lambda x: f"{x:7.2f}")
          if len(cal) else "  NOT FOUND -- harness cannot see a known-real signal")

    print(f"\n== top 40 cells by z (null 95th pct = {thr95:.2f}) ==")
    show = res.head(40)[["phase", "market", "rule", "n", "win_pct", "base_pct",
                         "edge", "roi", "base_roi", "z", "search_p"]]
    print(show.to_string(index=False, float_format=lambda x: f"{x:7.2f}"))


def expand_pairs(M, meta, min_n):
    """AND every pair of surviving marginal masks -- the 'combination of filters' stage."""
    n_masks = M.shape[0]
    out, om, seen = [], [], set()
    for i in range(n_masks):
        for j in range(i + 1, n_masks):
            if meta.at[i, "phase"] != meta.at[j, "phase"]:
                continue
            if meta.at[i, "feature"] == meta.at[j, "feature"]:
                continue
            m = (M[i] * M[j])
            s = int(m.sum())
            if s < min_n:
                continue
            h = hashlib.blake2b(np.packbits(m.astype(bool)).tobytes(), digest_size=16).digest()
            if h in seen:
                continue
            seen.add(h)
            out.append(m)
            om.append({"phase": meta.at[i, "phase"],
                       "feature": f"{meta.at[i,'feature']} & {meta.at[j,'feature']}",
                       "rule": f"{meta.at[i,'rule']} AND {meta.at[j,'rule']}",
                       "n_rows": s})
    return np.asarray(out, dtype=np.float32), pd.DataFrame(om)


if __name__ == "__main__":
    main()
