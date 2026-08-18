#!/usr/bin/env python3
"""Six-season NBA panel: grade the shipping models on the bought seasons; COVID in/out.

The CBB twin (`cbb_six_seasons.py`) answered the owner's COVID worry for college: at a 365d
half-life, including 2020-21 in training is marginally BETTER (paired t −3.63). The NBA
discounts history harder still (spread 120d, total 180d), and its COVID season had a visible
home-edge dip (54% vs ~57%) — so the same two questions, same design:

  SIX    all six seasons in the walk-forward, COVID at natural recency weight
  NOCOV  2020-21 rows stripped from training (targets NaN'd)

graded on the SHARED window (the 2023-26 end-year seasons the 4-season runs graded) and on
the NEW window (2021-22 + 2022-23 by label, i.e. seasons 2022-2023 end-years... NBA labels
here are START years: 2020 = the COVID season, 2021 = 2021-22). Windows below use the
cache's `season` column (start-year ints): SHARED = (2023, 2024, 2025); NEW = (2021, 2022).
Wait — the 4-season cache was seasons [2022..2025] with 2022 as burn-in, so the previously
graded seasons are 2023/2024/2025 and the bought ones are 2020/2021; with 2020 as the new
burn-in, NEW = (2021, 2022) gets graded fresh (2022 was burn-in before — never graded).

Configs use the PRE-REGISTERED shipping feature sets — spread CORE (rapm + pl_regr, hl 120)
and total T1 (cut raw_box/rot_flags/travel, hl 180) — nothing re-searched. Points-ladder
cuts quoted at the memory rungs (≥5, ≥8). Writes NBA_SIX_SEASONS.md.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "NBA_SIX_SEASONS.md")
NULLS = 8
SHARED = (2023, 2024, 2025)
NEW = (2021, 2022)
COVID = 2020

SPREAD_CUT = ["misc", "style", "schedule", "absence", "usage", "rot_flags", "adj_eff", "form",
              "nets", "dims", "travel", "raw_box", "talent", "ratings", "pace_ix", "standings"]
TOTAL_CUT = ["raw_box", "rot_flags", "travel"]


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def to_game_margin(P, p, G):
    t = P.assign(p=p)[["event_id", "team_row", "p"]]
    g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
    return (g["home"] - g["away"]) / 2.0  # matches nba_prune2._to_game (margin from ± rows)


def main():
    pr = _mod("pr", "nba_prune.py")
    tp = _mod("tp", "nba_total_prune.py")
    pa, P, G, cols = pr.load()
    fam = pd.Series({c: pr.famof(c) for c in cols})
    season = G["season"].astype(int)
    print(f"[nba6] panel {len(P):,} team-games | seasons {sorted(season.unique())}", flush=True)
    season_of_row = P["event_id"].map(season)

    L = ["# NBA six-season — shipping models on the bought seasons; COVID in/out", "",
         f"{NULLS} nulls, pre-registered feature sets (spread CORE hl120, total T1 hl180).", ""]
    results = []

    # ---- both markets share the machinery ----
    sgn = np.where(P["team_row"] == "home", 1.0, -1.0)
    jobs = []
    # spread
    y_sp = pd.Series(P["event_id"].map(G["y_fg_margin"]).astype(float) * sgn, index=P.index)
    resid_sp = G["y_fg_marg_resid"].astype(float)
    yb_sp = pd.Series(np.where(resid_sp > 0, 1.0, np.where(resid_sp < 0, 0.0, np.nan)), index=G.index)
    po_sp = pd.Series(pa.v2.to_dec(G["t60_spread_home_price"]), index=G.index)
    pu_sp = pd.Series(pa.v2.to_dec(G["t60_spread_away_price"]), index=G.index)
    sp_line = G["t60_spread_home_point"].astype(float)
    o = pa.grade(resid_sp, yb_sp, po_sp, pu_sp, 0)
    assert o["win"] > 99.5, f"spread oracle {o['win']:.1f}%"
    use_sp = [c for c in cols if fam[c] not in SPREAD_CUT]
    jobs.append(("spread", use_sp, 120.0, y_sp,
                 lambda p: to_game_margin(P, p, G) + sp_line,
                 resid_sp, yb_sp, po_sp, pu_sp))
    # total
    pts = np.where(P["team_row"] == "home", P["event_id"].map(G["y_home_pts"]),
                   P["event_id"].map(G["y_away_pts"]))
    y_tot = pd.Series(pts.astype(float), index=P.index)
    tot_line = G["t60_total_point"].astype(float)
    resid_tot = G["y_fg_tot_resid"].astype(float)
    yb_tot = pd.Series(np.where(resid_tot > 0, 1.0, np.where(resid_tot < 0, 0.0, np.nan)), index=G.index)
    po_tot = pd.Series(pa.v2.to_dec(G["t60_total_over_price"]), index=G.index)
    pu_tot = pd.Series(pa.v2.to_dec(G["t60_total_under_price"]), index=G.index)
    o = pa.grade(resid_tot, yb_tot, po_tot, pu_tot, 0)
    assert o["win"] > 99.5, f"total oracle {o['win']:.1f}%"
    use_tot = [c for c in cols if fam[c] not in TOTAL_CUT]
    jobs.append(("total", use_tot, 180.0, y_tot,
                 lambda p: tp.to_game(pa, P, G, p, tot_line),
                 resid_tot, yb_tot, po_tot, pu_tot))

    rng = np.random.default_rng(20260818)
    for mkt, use, hl, y, to_g, resid, yb, po, pu in jobs:
        targets = [y] + [pa.game_shuffle(P, y, rng) for _ in range(NULLS)]
        fits = {}
        for tag, mask_covid in (("SIX", False), ("NOCOV", True)):
            ys = targets
            if mask_covid:
                drop = (season_of_row == COVID).values
                ys = [t.mask(drop) for t in targets]
            print(f"[nba6] {mkt} {tag}: {len(use)} feats hl={hl:.0f}", flush=True)
            out = pa.ridge_multi(P[use].astype(float), P["date"], ys, half_life=hl)
            fits[tag] = [to_g(p) for p in out]
            print(f"[nba6] {mkt} {tag} corr {fits[tag][0].corr(resid):+.4f}", flush=True)

        gseason = season
        for tag in ("SIX", "NOCOV"):
            d, nd = fits[tag][0], fits[tag][1:]
            for win_name, seasons in (("SHARED 23-26", SHARED), ("NEW 21-23", NEW)):
                mask = gseason.isin(seasons)
                for k in (5, 8):
                    g0 = pa.grade(d, yb, po, pu, k, mask=mask)
                    ng = [pa.grade(n, yb, po, pu, k, mask=mask) for n in nd]
                    ne = np.array([q["win"] - q["base"] for q in ng if q["n"] > 0], dtype=float)
                    z = ((g0["win"] - g0["base"]) - np.nanmean(ne)) / max(np.nanstd(ne, ddof=1), 1e-9) \
                        if len(ne) > 1 and g0["n"] > 0 else np.nan
                    results.append(dict(market=mkt, config=tag, window=win_name, k=k,
                                        n=g0["n"], win=g0["win"], base=g0["base"],
                                        roi=g0["roi"], z=z))
                    if g0["n"]:
                        print(f"[nba6] {mkt:6s} {tag:6s} {win_name:12s} >={k}: n={g0['n']:>5,} "
                              f"win {g0['win']:.1f} base {g0['base']:.1f} roi {g0['roi']:+.2f} "
                              f"z {z:+.2f}", flush=True)

        # paired MAE on shared window, SIX vs NOCOV
        m = gseason.isin(SHARED) & fits["SIX"][0].notna() & fits["NOCOV"][0].notna() & resid.notna()
        e6 = (fits["SIX"][0][m] - resid[m]).abs()
        en = (fits["NOCOV"][0][m] - resid[m]).abs()
        diff = (e6 - en).values
        t = diff.mean() / (diff.std(ddof=1) / np.sqrt(len(diff)))
        L.append(f"**{mkt} paired MAE shared (n={m.sum():,}): SIX {e6.mean():.4f} vs NOCOV "
                 f"{en.mean():.4f}, t {t:+.2f}** (positive = COVID inclusion hurts).")
        print(f"[nba6] {mkt} paired MAE: SIX {e6.mean():.4f} NOCOV {en.mean():.4f} t {t:+.2f}",
              flush=True)

    R = pd.DataFrame(results)
    L += ["", "| market | config | window | cut | n | win% | base% | ROI | z |",
          "|---|---|---|---|---|---|---|---|---|"]
    for _, r in R.iterrows():
        L.append(f"| {r['market']} | {r['config']} | {r['window']} | ≥{r['k']} | {r['n']:,} | "
                 f"{r['win']:.1f} | {r['base']:.1f} | {r['roi']:+.2f} | {r['z']:+.2f} |")
    with open(OUT, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
