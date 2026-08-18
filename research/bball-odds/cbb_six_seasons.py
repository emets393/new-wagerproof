#!/usr/bin/env python3
"""Six-season CBB panel: does the new 2020-22 history help, and does COVID hurt?

Owner concern (2026-08-18): "wary about over-weighing the COVID year." The 365d recency
half-life already discounts it (a Jan-2021 row is at 25% weight for Jan-2023 predictions,
6% by 2025) — but that is an argument, not a measurement. So three configs, all graded on
the SHARED evaluation window (2023-24 .. 2025-26, the seasons the 4-season baseline
grades), paired on the same games:

  BASE   the shipping 4-season run (numbers from the cached baseline predictions)
  SIX    all six seasons in the walk-forward; COVID included at natural recency weight
  NOCOV  six-season frame, but 2020-21 rows REMOVED from training entirely
         (targets NaN'd -> ridge_multi drops them from every training window)

SIX vs BASE on the shared window isolates "does more history help the same games".
SIX vs NOCOV isolates "does the COVID year specifically help or hurt". If SIX ~= NOCOV
the half-life is doing its job and the owner's worry is answered with a number.

FEATURE-GATE FIX (the trap found on 2026-08-18): lineup-profile coverage is 50.8% on the
6-season frame because CBBD lineups barely exist before 2022, and build_frame's 0.55
coverage gate would silently drop the most load-bearing family in the model. Coverage is
therefore measured on the WELL-COVERED ERA (2022-23+) — the same rule that produced the
shipping feature list — and NaNs in the early seasons are left to the ridge's imputation.

Extended-eval section: SIX also grades 2021-22 and 2022-23 (the baseline's burn-in), the
two seasons the backfill actually buys. Writes CBB_SIX_SEASONS.md.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

import cbb_panel as cp
import ncaab_frame as nf

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "CBB_SIX_SEASONS.md")
NULLS = 8
SHARED = ("2023-24", "2024-25", "2025-26")
NEW_EVAL = ("2021-22", "2022-23")


def main():
    D, feat, blocks = cp.build_frame()
    recent = D["season"].isin(("2022-23", "2023-24", "2024-25", "2025-26"))
    bad = cp.MARKET | cp.OUTCOME | cp.IDS
    feat2 = [c for c in D.columns
             if c not in bad and not c.startswith(("y_", "open_", "t24_", "t4_", "t60_",
                                                   "h1_", "tt_"))
             and pd.api.types.is_numeric_dtype(D[c])
             and D.loc[recent, c].notna().mean() > 0.55]
    for c in ("conferenceGame", "neutralSite"):
        D[c] = D[c].astype(float)
        if c not in feat2:
            feat2.append(c)
    cp.assert_originator(feat2)
    print(f"[six] {len(feat2)} features under the recent-era gate", flush=True)

    P, fcols = cp.build_panel(D, feat2)
    P["_yfg"] = P["pts"].astype(float) - P["impl"].astype(float)
    G = D.set_index("event_id")
    season_of = P["event_id"].map(G["season"])

    rng = np.random.default_rng(20260818)
    y = P["_yfg"]
    targets = [y] + [cp.pa.game_shuffle(P, y, rng) for _ in range(NULLS)]

    X = P[fcols].astype(float)
    runs = {}
    for tag, mask_covid in (("SIX", False), ("NOCOV", True)):
        ys = targets
        if mask_covid:
            drop = (season_of == "2020-21").values
            ys = [t.mask(drop) for t in targets]
        print(f"[six] fitting {tag} ({len(ys)} targets, {len(fcols)} features)", flush=True)
        runs[tag] = cp.pa.ridge_multi(X, P["date"], ys, min_train=cp.MIN_TRAIN,
                                      refit_days=cp.REFIT_DAYS, half_life=cp.HL_FG)
        print(f"[six] {tag} oos corr {runs[tag][0].corr(y):+.4f}", flush=True)

    # -- grade the full-game spread (the shipping bet) per config on shared + new windows
    line = G["t60_spread_home_point"].astype(float)
    resid = G["margin"].astype(float) + line
    yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
    po = pd.Series(cp.pa.v2.to_dec(G["t60_spread_home_price"]), index=G.index)
    pu = pd.Series(cp.pa.v2.to_dec(G["t60_spread_away_price"]), index=G.index)
    gseason = G["season"]

    def to_game(pred):
        t = P.assign(p=pred)[["event_id", "team_row", "p"]]
        g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
        # model margin minus market margin, home perspective — same construction as the
        # outcome (resid = margin + t60_spread_home_point), per cbb_panel.markets. NO /2.
        return g["home"] - g["away"]

    L = ["# CBB six-season panel — does history help, does COVID hurt?", "",
         f"Recent-era feature gate: {len(feat2)} features (lineup family retained). "
         f"{NULLS} nulls. FG spread graded at the shipping cuts; windows are seasons.", ""]

    rows = []
    for tag in ("SIX", "NOCOV"):
        d = to_game(runs[tag][0])
        nd = [to_game(p) for p in runs[tag][1:]]
        for win_name, seasons in (("SHARED 2023-26", SHARED), ("NEW 2021-23", NEW_EVAL)):
            mask = gseason.isin(seasons)
            for k in (1.5, 2.0):
                g0 = cp.grade(d, yb, po, pu, k, mask=mask)
                ng = [cp.grade(n, yb, po, pu, k, mask=mask) for n in nd]
                ne = np.array([q["win"] - q["base"] for q in ng if q["n"] > 0], dtype=float)
                z = ((g0["win"] - g0["base"]) - np.nanmean(ne)) / max(np.nanstd(ne, ddof=1), 1e-9) \
                    if len(ne) > 1 and g0["n"] > 0 else np.nan
                rows.append(dict(config=tag, window=win_name, k=k, n=g0["n"], win=g0["win"],
                                 base=g0["base"], roi=g0["roi"], z=z))
                print(f"[six] {tag:6s} {win_name:14s} >={k}: n={g0['n']:>5} win {g0['win']:.1f} "
                      f"base {g0['base']:.1f} roi {g0['roi']:+.2f} z {z:+.2f}" if g0["n"] else
                      f"[six] {tag:6s} {win_name:14s} >={k}: no bets", flush=True)

    R = pd.DataFrame(rows)
    L += ["| config | window | cut | n | win% | base% | ROI | z |", "|---|---|---|---|---|---|---|---|"]
    for _, r in R.iterrows():
        L.append(f"| {r['config']} | {r['window']} | ≥{r['k']} | {r['n']:,} | {r['win']:.1f} | "
                 f"{r['base']:.1f} | {r['roi']:+.2f} | {r['z']:+.2f} |")

    # paired MAE, SIX vs NOCOV, shared window — the COVID question on the product metric
    d6, dn = to_game(runs["SIX"][0]), to_game(runs["NOCOV"][0])
    shared_mask = gseason.isin(SHARED)
    both = shared_mask & d6.notna() & dn.notna() & resid.notna()
    e6 = (d6[both] - resid[both]).abs()
    en = (dn[both] - resid[both]).abs()
    diff = (e6 - en).values
    t = diff.mean() / (diff.std(ddof=1) / np.sqrt(len(diff)))
    L += ["", f"**Paired MAE on shared window (n={both.sum():,}): SIX {e6.mean():.4f} vs "
          f"NOCOV {en.mean():.4f}, paired t {t:+.2f}** (positive t = COVID inclusion HURTS).", ""]
    print(f"[six] paired MAE shared: SIX {e6.mean():.4f} NOCOV {en.mean():.4f} t {t:+.2f}", flush=True)

    with open(OUT, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
