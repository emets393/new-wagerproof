#!/usr/bin/env python3
"""Final confirmation of the one surviving NBA signal, across markets, against a real null.

WHAT SURVIVED, after the audit chain in nba_out_signal -> nba_out_controls -> nba_out_streaks
-> nba_out_isolate -> nba_out_null:

    Full grid (every player reindexed onto his team's schedule, so an unlisted game counts
    as an absence). Rotation-minute baseline from a 10-game rolling mean that COUNTS an
    absence as zero. Value each side's rotation players (>=16 baseline minutes) who are out
    tonight AND were out last game, in RAPM margin pts/48 weighted by rotation-minute share.
    Back the side whose OPPONENT is more depleted.

WHY THE DECAYING BASELINE IS THE MECHANISM AND NOT THE BUG. I originally flagged it as a
confound: a player out ~10 straight decays below the rotation filter and silently stops
counting. But that is precisely a RECENCY FILTER, and two independent tests say recency is
the whole effect. (1) The streak decomposition: FRESH absences carry the edge, MID is flat,
LONG is negative -- the market has days to price a known absence and prices it. (2) The
permutation null: the decaying baseline is significant at every bet count and strengthens
with sample size (p .039 -> .001), while the "corrected" played-only baseline, which lets
long absences back in, is not significant anywhere. The docstring of nba_out_streaks.py
asserts the opposite and is wrong.

WHAT THIS SCRIPT ADDS. Everything so far was graded against the OPENER. A signal that only
works at the opener is not necessarily tradeable -- the number that matters is whether it
survives at the price actually available near tip. So: all three markets, each against its
own 2,000-permutation null, plus the streak decomposition re-run under the winning
construction to confirm the mechanism rather than assume it.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import add_base, add_rapm, make_rows, raw_box, to_dec

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
ROT_MIN = 16.0
N_PERM = 2000
COUNTS = (400, 800, 1600)
RNG = np.random.default_rng(23)

MKT = {"FG spread vs OPEN": ("y_open", "open_spread_home_price", "open_spread_away_price"),
       "FG spread vs T-60": ("y_fg_marg_resid", "t60_spread_home_price",
                             "t60_spread_away_price"),
       "1H spread vs T-60": ("y_h1_marg_resid", "t60_spread_home_price",
                             "t60_spread_away_price")}


def build(G, streak_lo=None, streak_hi=None):
    """Team-level OUT value; optionally restricted to a prior-absence-streak band."""
    G = G.sort_values(["athlete_id", "season", "date"]).reset_index(drop=True)
    prev = G.groupby(["athlete_id", "season"])["out"].shift(1).fillna(False).astype(int)
    key = G["athlete_id"].astype("int64").astype(str) + "_" + G["season"].astype(str)
    brk = (prev == 0) | (key != key.shift(1))
    G["streak"] = prev.groupby(brk.cumsum()).cumsum().to_numpy()

    sel = G["out"] & (G["streak"] >= 1)
    if streak_lo is not None:
        sel &= G["streak"] >= streak_lo
    if streak_hi is not None:
        sel &= G["streak"] <= streak_hi

    rot = G[G["b"] >= ROT_MIN].copy()
    den = rot.groupby(["game_id", "team_id"])["b"].transform("sum")
    rot["v"] = (5.0 * rot["b"] / den.clip(lower=1e-9) * rot["rapm_m"]
                * sel.reindex(rot.index).astype(float))
    agg = rot.groupby(["game_id", "team_id"])["v"].sum().reset_index()
    ha = G.drop_duplicates(["game_id", "team_id"])[["game_id", "team_id", "home_away"]]
    agg = agg.merge(ha, on=["game_id", "team_id"])
    C = pd.read_parquet(f"{OUT}/nba_game_crosswalk.parquet")
    agg = agg.merge(C, left_on="game_id", right_on="espn_game_id").rename(
        columns={"bdl_game_id": "game.id"})
    H = agg[agg["home_away"] == "home"][["game.id", "v"]].rename(columns={"v": "hv"})
    V = agg[agg["home_away"] == "away"][["game.id", "v"]].rename(columns={"v": "av"})
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    d = F.merge(H, on="game.id", how="inner").merge(V, on="game.id", how="inner")
    d["y_open"] = d["y_fg_margin"] + d["open_spread_home_point"]
    d["gap"] = d["av"] - d["hv"]
    return d


def score(d, gap, ok, n_target, y, dh, da):
    thr = np.quantile(np.abs(gap[ok]), max(0.0, 1.0 - n_target / ok.sum()))
    m = ok & (np.abs(gap) >= thr)
    if m.sum() < 20:
        return None
    hi = gap[m] > 0
    win = np.where(hi, y[m] > 0, y[m] < 0)
    base = max((y[m] > 0).mean(), (y[m] < 0).mean())
    roi = np.where(win, np.where(hi, dh[m], da[m]) - 1.0, -1.0).mean()
    return 100 * (win.mean() - base), 100 * win.mean(), 100 * base, 100 * roi, m, win


def run(d, mkt, counts, L, tag=""):
    ycol, phc, plc = MKT[mkt]
    gap = d["gap"].to_numpy(dtype=float)
    y = d[ycol].to_numpy(dtype=float)
    dh, da = to_dec(d[phc]), to_dec(d[plc])
    seas = d["season"].to_numpy()
    ok = np.isfinite(y) & (y != 0) & np.isfinite(gap) & (gap != 0)
    if ok.sum() < 100:
        return
    idxs = [np.where(seas == s)[0] for s in np.unique(seas)]
    for c in counts:
        r = score(d, gap, ok, c, y, dh, da)
        if r is None:
            continue
        e, w, b, roi, m, win = r
        per = " ".join(f"{s}:{100*win[seas[m] == s].mean():.0f}"
                       for s in sorted(set(seas[m])))
        null = np.empty(N_PERM)
        pg = gap.copy()
        for i in range(N_PERM):
            for ix in idxs:
                pg[ix] = gap[RNG.permutation(ix)]
            q = score(d, pg, ok, c, y, dh, da)
            null[i] = q[0] if q else np.nan
        null = null[np.isfinite(null)]
        L.append(f"| {tag}{mkt} | {m.sum():,} | {w:.1f} | {b:.1f} | **{e:+.1f}** | "
                 f"{null.mean():+.1f} | {(null >= e).mean():.3f} | {roi:+.1f} | {per} |")
        print(L[-1], flush=True)


HDR = ["| market | bets | win % | base % | edge | null mean | p | ROI % | by season |",
       "|---|---|---|---|---|---|---|---|---|"]


def main():
    B = raw_box()
    G = add_rapm(add_base(make_rows(B, "full"), "decay"))

    L = ["# NBA absence signal — final confirmation across markets", "",
         "Full grid, decaying rotation baseline, RAPM-valued durable absences. `edge` = "
         "win% − the max-side baseline of the same subset; that baseline is picked with "
         "hindsight so a coin flip scores about −2 on it, which is what `null mean` "
         "measures. Compare edge to null mean, not to zero. p = share of 2,000 "
         "within-season permutations reaching the real edge.", "",
         "## The rule across all three markets", ""] + HDR
    d = build(G)
    for mkt in MKT:
        run(d, mkt, COUNTS, L)

    L += ["", "## Mechanism check — the same rule split by how long he has been out", "",
          "If the market prices known absences and misprices new ones, FRESH must carry the "
          "edge and LONG must not. Graded vs the opener.", ""] + HDR
    for lo, hi, tag in [(1, 1, "FRESH "), (2, 4, "MID "), (5, None, "LONG ")]:
        run(build(G, lo, hi), "FG spread vs OPEN", (400, 800), L, tag=tag)

    path = os.path.join(ROOT, "NBA_OUT_FINAL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
