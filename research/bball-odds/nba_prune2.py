#!/usr/bin/env python3
"""Grade the PRUNED originator spread model — pre-registered cuts, nulls, per-season, per-phase.

`nba_prune.py` ranked eighteen feature families by drop-one ablation. This file turns that ranking
into a small number of configurations, fits each one, and grades it properly. The distinction
matters: the ablation was a ranking with no nulls and nothing in it is a claim.

THE CUTS ARE PRE-REGISTERED FROM THE ABLATION, not searched. `nba-blind-sweep-fails` is the reason:
308,860 blind cells transferred at −0.017% excess ROI, so a greedy backward elimination over
eighteen families with two grading columns would be a search whose winner the z cannot pay for.
Instead the drop-one table names the cut once, and exactly four configurations are graded:

    ALL        every family (739 features) — the ablation baseline
    C1         cut the five families that improve BOTH selectivity columns by ≥1.9 points
    C2         cut every family with a positive drop-one delta on BOTH columns
    CORE       rapm + pl_regr only — the two families the ablation says carry information

Configurations are compared at FIXED SELECTIVITY (top-N% of disagreements) because fewer features
means less volatile predictions, so a fixed points cut would select different bet counts and
compare two strategies rather than two feature sets. The WINNER is then re-graded on the points
ladder with 20 game-level null shuffles, per season and per phase — the same treatment every other
NBA market claim in this repo has had.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "data", "parquet", "_nba_wide_cache.parquet")
OUT = os.path.join(ROOT, "NBA_PRUNE.md")
NULLS = 20
# 180 was inherited from the total model. `nba_prune_hl.py` sweeps it at fixed selectivity on THIS
# feature set: 90 and 120 tie to two decimals at three of four selectivities and 180 is a clear step
# down, so 120 is the middle of a genuine plateau rather than a tuned cell.
HALF_LIFE = 120.0
QS = (0.85, 0.91)
# The ladder runs past the usual 5 because the pruned model's edge lives entirely in the tail --
# every rung below 5 loses and the top 15% of disagreements scores three times the ≥5 rung.
KS = (1, 2, 3, 4, 5, 6, 7, 8, 9)
MARKET = ("impl", "t60_total_point")

# Families cut by each configuration. Read off the drop-one column of the ablation, once.
CUT = {
    "ALL": [],
    "C1": ["misc", "style", "absence", "rot_flags", "usage"],
    "C2": ["misc", "style", "schedule", "absence", "usage", "rot_flags",
           "adj_eff", "form", "nets", "dims", "travel", "raw_box"],
    "CORE": ["misc", "style", "schedule", "absence", "usage", "rot_flags", "adj_eff", "form",
             "nets", "dims", "travel", "raw_box", "talent", "ratings", "pace_ix", "standings"],
}


def main():
    pr = _mod("pr", "nba_prune.py")
    pa, P, G, cols = pr.load()
    fam = pd.Series({c: pr.famof(c) for c in cols})

    sgn = np.where(P["team_row"] == "home", 1.0, -1.0)
    y = pd.Series(P["event_id"].map(G["y_fg_margin"]).astype(float) * sgn, index=P.index)
    sp = G["t60_spread_home_point"].astype(float)
    resid = G["y_fg_marg_resid"]
    yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
    po = pd.Series(pa.v2.to_dec(G["t60_spread_home_price"]), index=G.index)
    pu = pd.Series(pa.v2.to_dec(G["t60_spread_away_price"]), index=G.index)

    o = pa.grade(resid, yb, po, pu, 0)
    assert o["win"] > 99.5, f"oracle {o['win']:.1f}% -- grader sign is inverted"

    rng = np.random.default_rng(20260801)
    nulls_y = [pa.game_shuffle(P, y, rng) for _ in range(NULLS)]

    fits, rows = {}, []
    for tag, drop in CUT.items():
        use = [c for c in cols if fam[c] not in drop]
        out = pa.ridge_multi(P[use].astype(float), P["date"], [y] + nulls_y, half_life=HALF_LIFE)
        d = [_to_game(P, p, G) + sp for p in out]
        fits[tag] = d
        # A null that knows nothing still carries the home-field constant, so the null check is run
        # on the GAME-SPECIFIC opinion: the prediction with each team_row's mean removed.
        r = dict(tag=tag, k=len(use), corr=float(d[0].corr(resid)))
        for q, lab in zip(QS, ("15", "9")):
            thr = d[0][d[0].notna() & yb.notna()].abs().quantile(q)
            g = pa.grade(d[0], yb, po, pu, thr)
            ne = np.array([pa.grade(n, yb, po, pu, thr)["roi"] for n in d[1:]], dtype=float)
            r[f"n{lab}"], r[f"roi{lab}"] = g["n"], g["roi"]
            r[f"w{lab}"], r[f"b{lab}"] = g["win"], g["base"]
            r[f"z{lab}"] = (g["win"] - g["base"] - np.nanmean(
                [pa.grade(n, yb, po, pu, thr)["win"] - pa.grade(n, yb, po, pu, thr)["base"]
                 for n in d[1:]])) / max(np.nanstd(ne, ddof=1), 1e-9)
        rows.append(r)
        print(f"[prune2] {tag:5s} k={len(use):3d} corr {r['corr']:+.4f} | "
              f"top15% {r['roi15']:+6.2f}% (n={r['n15']:,}) | "
              f"top9% {r['roi9']:+6.2f}% (n={r['n9']:,})", flush=True)

    R = pd.DataFrame(rows)
    win = R.loc[(R["roi15"] + R["roi9"]).idxmax(), "tag"]
    print(f"[prune2] winner: {win}", flush=True)
    write(pa, R, win, fits[win], G, yb, po, pu, resid, len(P))


def _to_game(P, p, G):
    t = P.assign(p=p)[["event_id", "team_row", "p"]]
    g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
    return (g["home"] - g["away"]) / 2.0


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def write(pa, R, win, d, G, yb, po, pu, resid, npanel):
    # Replace this file's own section rather than appending, so a re-run does not stack copies of
    # the grading under the ablation that `nba_prune.py` wrote.
    prev = open(OUT).read() if os.path.exists(OUT) else ""
    prev = prev.split("\n---\n\n# Grading the pruned model")[0].rstrip() + "\n"
    L = ["", "---", "", "# Grading the pruned model", "",
         f"`nba_prune2.py`. Four pre-registered configurations, {NULLS} game-level null shuffles, "
         "compared at fixed selectivity so the comparison is between feature sets and not between "
         "strategies.", "",
         "| config | features | corr | bets (top 15%) | win% | base% | ROI | z | ROI top 9% | z |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    for _, r in R.iterrows():
        L.append(f"| {'**'+r['tag']+'**' if r['tag'] == win else r['tag']} | {int(r['k'])} | "
                 f"{r['corr']:+.4f} | {int(r['n15']):,} | {r['w15']:.1f} | {r['b15']:.1f} | "
                 f"**{r['roi15']:+.2f}** | {r['z15']:+.2f} | **{r['roi9']:+.2f}** | {r['z9']:+.2f} |")

    L += ["", f"## {win} on the points ladder", "",
          "Disagreement with the posted spread, in points. Nulls are the same 20 game-level "
          "shuffles, graded at the same rung.", ""]
    L, best = pa_ladder(pa, L, d[0], yb, po, pu, d[1:], KS)

    k = best[0]
    L += ["", f"## {win} broken out at the ≥{k:g} cut", "",
          "Pooled numbers hide a signal that lives in one season or decays out.", ""]
    for col, lab in (("season", "season"), ("phase", "phase")):
        L += [f"| {lab} | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
        order = (("EARLY", "MID", "LATE", "POST") if col == "phase"
                 else sorted(G[col].dropna().unique()))
        for vv in order:
            g = pa.grade(d[0], yb, po, pu, k, mask=(G[col] == vv))
            if g["n"]:
                t = vv if col == "phase" else str(int(vv))
                L.append(f"| {t} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                         f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** |")
                print(f"[{col}] " + L[-1], flush=True)
        L.append("")
    open(OUT, "w").write(prev + "\n".join(L) + "\n")
    print(f"\nappended to {OUT}", flush=True)


def pa_ladder(pa, L, d, yb, po, pu, nulls, ks):
    L += ["| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |",
          "|---|---|---|---|---|---|---|---|---|"]
    best = None
    for k in ks:
        g = pa.grade(d, yb, po, pu, k)
        if not g["n"]:
            continue
        ne = np.array([(lambda q: q["win"] - q["base"])(pa.grade(n, yb, po, pu, k))
                       for n in nulls], dtype=float)
        mu, sd = np.nanmean(ne), np.nanstd(ne, ddof=1)
        z = (g["win"] - g["base"] - mu) / sd if sd and sd > 0 else np.nan
        L.append(f"| ≥{k:g} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                 f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** | {mu:+.2f} | {sd:.2f} "
                 f"| **{z:+.2f}** |")
        print("[ladder] " + L[-1], flush=True)
        if best is None or g["roi"] > best[1]["roi"]:
            best = (k, g, z)
    L.append("")
    return L, best


if __name__ == "__main__":
    main()
