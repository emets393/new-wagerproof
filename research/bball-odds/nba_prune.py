#!/usr/bin/env python3
"""Which features actually help the ORIGINATOR spread model, and which are dead weight?

THE PROBLEM. The panel carries 433 columns and they went into the model as one undifferentiated
block. Counted by family, **96 are raw box rates** (efg, tov, oreb, ftr, 3pt%) and another ~126 are
recent-form averages and raw diffs of the same -- roughly 41% of the stack is box-score percentages.
Meanwhile `NCAAB_MODEL_LAB` already recorded, on a different sport, that raw box columns HURT and
engineered cross-team constructions help. That finding was never applied here.

WHAT THIS FILE MEASURES. Family-level ablation against the originator target: predict the raw margin
of victory with NO market column anywhere, reduce to the model's margin minus the posted margin, and
grade the disagreement. Three passes:

    BASE      all families
    DROP-ONE  remove one family, keep the rest -- does the model get better without it?
    SOLO      that family alone -- does it carry anything by itself?

DROP-ONE and SOLO answer different questions and a family can score well on one and badly on the
other. A block that is genuinely redundant with the rest of the stack looks fine solo and changes
nothing when dropped. A block that is actively harmful IMPROVES the model when dropped. Only the
drop-one column decides what gets cut; solo is there to say whether the information exists at all.

GRADED AT FIXED SELECTIVITY. A configuration with fewer features produces less volatile predictions,
so a fixed `>=3 points` cut would select wildly different bet counts across configs and compare two
strategies rather than two feature sets. Everything is graded at the same top-N% of disagreements.

NO NULLS HERE. Nulls price the search that found a result; this pass is a ranking, not a claim, and
the winning configuration has to go back through `nba_targets.py`-style null grading before any
number from it is believed.
"""
import importlib.util
import os
import re
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "data", "parquet", "_nba_wide_cache.parquet")
OUT = os.path.join(ROOT, "NBA_PRUNE.md")
QS = (0.85, 0.91)                 # top 15% and top 9% of disagreements
MARKET = ("impl", "t60_total_point")

# Family definitions, matched against the name with own_/opp_ stripped. Order matters: the first
# pattern that hits wins, so the specific blocks are listed before the catch-alls.
FAMILIES = [
    # the blocks that were built and never wired in -- listed first so they win the match
    ("rapm",      r"^rapm_"),
    ("pl_regr",   r"^preg_"),
    ("talent",    r"^rgf_"),
    ("rot_flags", r"^pfl_"),
    ("style",     r"^sty_"),
    ("absence",   r"^abs_"),
    ("travel",    r"^dm_trav"),
    ("pace_ix",   r"^dm_ix"),
    ("dims",      r"^dm_"),
    ("standings", r"^st_"),
    ("adj_eff",   r"^adj_"),
    ("ratings",   r"^radj"),
    ("schedule",  r"sched"),
    ("usage",     r"hhi|top_min"),
    ("nets",      r"net"),
    ("form",      r"^l3_|^l5_|^l10_|^s2d_"),
    ("raw_box",   r"^raw_"),
]


def famof(c):
    b = re.sub(r"^(own_|opp_)", "", c)
    for name, pat in FAMILIES:
        if re.search(pat, b):
            return name
    return "misc"


def load():
    pa = _mod("pa", "nba_panel_all.py")
    bl = _mod("bl", "nba_blocks.py")
    D = pd.read_parquet(CACHE).sort_values("date").reset_index(drop=True)
    D["date"] = pd.to_datetime(D["date"])
    # The player-level blocks are joined here rather than baked into the cache: they are the thing
    # under test, and an ablation that cannot turn them off is not an ablation.
    D, blocks = bl.attach(D)
    flagged = set(bl.leak_screen(D, blocks, strict=False))
    if flagged:
        D = D.drop(columns=[c for c in flagged if c in D.columns])
        print(f"[prune] dropped {len(flagged)} leak-flagged column(s): "
              f"{', '.join(sorted(flagged))}", flush=True)
    D = D.sort_values("date").reset_index(drop=True)
    # `wide_stack` selects by a fixed prefix whitelist so the panel results stay comparable to the
    # wide models. The new blocks are not in that whitelist by design -- extend the stack here
    # rather than editing wide_stack, which four other scripts depend on.
    extra = [c for v in blocks.values() for c in v
             if c in D.columns and pd.api.types.is_numeric_dtype(D[c])
             and D[c].notna().mean() > 0.80]
    stack = list(dict.fromkeys(pa.wide_stack(D) + extra))
    print(f"[prune] stack {len(stack)} columns ({len(extra)} from the new blocks)", flush=True)
    P, fcols = pa.build_panel(D, stack)
    G = D.set_index("event_id").copy()
    # The originator never sees a price. `impl` is the spread (own minus opp) and t60_total_point is
    # the total, so those two and nothing else have to go.
    cols = [c for c in fcols
            if pd.api.types.is_numeric_dtype(P[c]) and c not in MARKET]
    return pa, P, G, cols


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def run(pa, P, G, cols, y, sp):
    """One walk-forward fit over `cols`; returns the game-level disagreement with the posted line."""
    pred = pa.ridge_multi(P[cols], P["date"], [y])[0]
    t = P.assign(p=pred)[["event_id", "team_row", "p"]]
    g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
    # own-minus-opp margin, averaged over both perspectives, then compared to the posted margin
    return (g["home"] - g["away"]) / 2.0 + sp


def cells(pa, d, yb, po, pu):
    a = d[d.notna() & yb.notna()].abs()
    out = []
    for q in QS:
        gr = pa.grade(d, yb, po, pu, a.quantile(q))
        out.append(gr)
    return out


def main():
    pa, P, G, cols = load()
    sgn = np.where(P["team_row"] == "home", 1.0, -1.0)
    y = pd.Series(P["event_id"].map(G["y_fg_margin"]).astype(float) * sgn, index=P.index)
    sp = G["t60_spread_home_point"].astype(float)
    resid = G["y_fg_marg_resid"]
    yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
    po = pd.Series(pa.v2.to_dec(G["t60_spread_home_price"]), index=G.index)
    pu = pd.Series(pa.v2.to_dec(G["t60_spread_away_price"]), index=G.index)

    # ORACLE -- feed the realised residual into the very rule every config is graded by. A
    # coherently-signed grader wins ~100%; anything less means the sign is inverted and every row
    # below would be backwards. Cheap, and it is what caught the last inversion.
    o = pa.grade(resid, yb, po, pu, 0)
    assert o["win"] > 99.5, f"oracle {o['win']:.1f}% -- grader sign is inverted"

    fam = pd.Series({c: famof(c) for c in cols})
    counts = fam.value_counts()
    print(f"[prune] {len(P):,} team-games | {len(cols)} originator features | "
          f"oracle {o['win']:.1f}%", flush=True)
    print(counts.to_string(), flush=True)

    rows = []

    def record(tag, kind, use):
        if len(use) < 3:
            return
        d = run(pa, P, G, use, y, sp)
        c15, c9 = cells(pa, d, yb, po, pu)
        r = dict(tag=tag, kind=kind, k=len(use),
                 corr=float(d.corr(resid)), sd=float(d.std()),
                 n15=c15["n"], w15=c15["win"], b15=c15["base"], roi15=c15["roi"],
                 n9=c9["n"], w9=c9["win"], b9=c9["base"], roi9=c9["roi"])
        rows.append(r)
        print(f"  {kind:9s} {tag:12s} k={len(use):3d}  corr {r['corr']:+.4f}  "
              f"top15% {r['roi15']:+6.2f}%  top9% {r['roi9']:+6.2f}%", flush=True)
        return r

    record("ALL", "base", cols)
    for name in counts.index:
        record(name, "drop-one", [c for c in cols if fam[c] != name])
    for name in counts.index:
        record(name, "solo", [c for c in cols if fam[c] == name])

    R = pd.DataFrame(rows)
    R.to_parquet(os.path.join(ROOT, "data", "parquet", "_nba_prune.parquet"), index=False)
    write(R, counts)


def write(R, counts):
    base = R[R["kind"] == "base"].iloc[0]
    L = ["# NBA — pruning the originator spread model", "",
         "Family-level ablation on the originator target: predict the raw margin of victory with "
         "**no market column anywhere**, reduce to the model's margin minus the posted margin, "
         "grade the disagreement at fixed selectivity. `nba_prune.py`.", "",
         f"Baseline: **{int(base['k'])} features**, corr with the realised residual "
         f"{base['corr']:+.4f}, **{base['roi15']:+.2f}%** ROI on the top 15% of disagreements and "
         f"**{base['roi9']:+.2f}%** on the top 9%.", "",
         "## Drop-one — does the model improve without this family?", "",
         "A **positive delta means cutting the family HELPS.** This is the column that decides "
         "what gets removed.", "",
         "| family | cols | ROI top 15% | delta | ROI top 9% | delta |", "|---|---|---|---|---|---|"]
    for _, r in R[R["kind"] == "drop-one"].sort_values("roi15", ascending=False).iterrows():
        L.append(f"| {r['tag']} | {counts[r['tag']]} | {r['roi15']:+.2f} | "
                 f"**{r['roi15']-base['roi15']:+.2f}** | {r['roi9']:+.2f} | "
                 f"**{r['roi9']-base['roi9']:+.2f}** |")
    L += ["", "## Solo — does the family carry anything by itself?", "",
          "A family can be fine solo and still worth cutting: that is what redundancy looks like. "
          "Only a family that is both weak solo and improves the model when dropped is dead weight.", "",
          "| family | cols | corr | ROI top 15% | ROI top 9% |", "|---|---|---|---|---|"]
    for _, r in R[R["kind"] == "solo"].sort_values("roi15", ascending=False).iterrows():
        L.append(f"| {r['tag']} | {counts[r['tag']]} | {r['corr']:+.4f} | "
                 f"{r['roi15']:+.2f} | {r['roi9']:+.2f} |")
    L.append("")
    open(OUT, "w").write("\n".join(L))
    print(f"\nwrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
