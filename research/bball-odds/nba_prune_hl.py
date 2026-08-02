#!/usr/bin/env python3
"""Recency half-life sweep for the pruned originator spread model (CORE = rapm + pl_regr).

`model-regime-drift-law` makes this mandatory before any multi-season fit is believed, and its
rule 1-bis makes the GRADING mandatory too: sweep at FIXED SELECTIVITY (top-N% of disagreements),
never at a fixed points cut. A shorter half-life makes predictions more volatile, so a fixed ≥7
rung would select several times more bets at 60 days than pooled and manufacture a spike out of
nothing but bet count.

READ THE SHAPE, NOT THE ARGMAX. A real effect is a broad hill whose neighbours score alike. A lone
spike with dead neighbours is a fluke wearing a parameter's clothes, and picking it is a selection
the z does not pay for.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "NBA_PRUNE.md")
HLS = (60, 90, 120, 180, 240, 365, 545, None)     # None = pooled, equal weight on all history
QS = (0.20, 0.15, 0.09, 0.05)
KEEP = ("rapm", "pl_regr")


def main():
    pr = _mod("pr", "nba_prune.py")
    pa, P, G, cols = pr.load()
    fam = pd.Series({c: pr.famof(c) for c in cols})
    use = [c for c in cols if fam[c] in KEEP]

    sgn = np.where(P["team_row"] == "home", 1.0, -1.0)
    y = pd.Series(P["event_id"].map(G["y_fg_margin"]).astype(float) * sgn, index=P.index)
    sp = G["t60_spread_home_point"].astype(float)
    resid = G["y_fg_marg_resid"]
    yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
    po = pd.Series(pa.v2.to_dec(G["t60_spread_home_price"]), index=G.index)
    pu = pd.Series(pa.v2.to_dec(G["t60_spread_away_price"]), index=G.index)
    assert pa.grade(resid, yb, po, pu, 0)["win"] > 99.5, "grader sign is inverted"

    print(f"[hl] {len(use)} CORE features | sweeping {len(HLS)} half-lives", flush=True)
    rows = []
    for hl in HLS:
        p = pa.ridge_multi(P[use].astype(float), P["date"], [y], half_life=hl)[0]
        t = P.assign(p=p)[["event_id", "team_row", "p"]]
        g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
        d = (g["home"] - g["away"]) / 2.0 + sp
        a = d[d.notna() & yb.notna()].abs()
        r = {"hl": "pooled" if hl is None else str(hl), "corr": float(d.corr(resid))}
        for q in QS:
            gr = pa.grade(d, yb, po, pu, a.quantile(1 - q))
            r[f"roi{int(q*100)}"] = gr["roi"]
            r[f"n{int(q*100)}"] = gr["n"]
            r[f"e{int(q*100)}"] = gr["win"] - gr["base"]
        rows.append(r)
        print(f"[hl] {r['hl']:>6s} corr {r['corr']:+.4f} | " +
              " | ".join(f"top{int(q*100)}% {r[f'roi{int(q*100)}']:+6.2f}% (n={r[f'n{int(q*100)}']:,})"
                         for q in QS), flush=True)

    R = pd.DataFrame(rows)
    prev = open(OUT).read().split("\n---\n\n## Half-life sweep")[0].rstrip() + "\n"
    L = ["", "---", "", "## Half-life sweep on CORE", "",
         "`nba_prune_hl.py`. Graded at fixed selectivity, so the bet count is held constant across "
         "settings and only the feature weighting moves. Read the shape, not the argmax.", "",
         "| half-life (d) | corr | " + " | ".join(f"ROI top {int(q*100)}%" for q in QS) + " |",
         "|---|---|" + "---|" * len(QS)]
    for _, r in R.iterrows():
        L.append(f"| {r['hl']} | {r['corr']:+.4f} | " +
                 " | ".join(f"**{r[f'roi{int(q*100)}']:+.2f}**" for q in QS) + " |")
    L.append("")
    open(OUT, "w").write(prev + "\n".join(L) + "\n")
    print(f"\nappended to {OUT}", flush=True)


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


if __name__ == "__main__":
    main()
