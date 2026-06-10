"""
PRE-REGISTERED CONFIRMATION RUN (stated before execution; rule 5 of the sweep):
WINNER: A2 SIDES = BASE + 12 cross-team net_X features (SUM semantics), target actual_margin.
EVAL (all must pass to upgrade the locked model):
  1. Identical folds (2021-25); FIVE-seed averaged predictions for BOTH variants (seed robustness).
  2. BASE+nets pooled hit% > BASE at ALL gates {3,4,5} (product-style, grade @ open).
  3. 2025 holdout hit% (gate 4): BASE+nets >= BASE.
  4. CLV at gate 4: BASE+nets >= BASE - 0.02.
If any criterion fails, the locked model STANDS.
"""
import numpy as np
import pandas as pd
import exp_shared as E

gm, FEATS = E.load()
bases = [c[len("home_adj_"):-len("_allowed")] for c in gm.columns if c.startswith("home_adj_") and c.endswith("_allowed")]
nets = []
for b in bases:
    gm[f"net_{b}"] = (gm[f"home_adj_{b}"] + gm[f"away_adj_{b}_allowed"]) - (gm[f"away_adj_{b}"] + gm[f"home_adj_{b}_allowed"])
    nets.append(f"net_{b}")

def walk5(feats):
    parts = []
    for S in E.TS:
        tr = gm[(gm.season < S) & gm.actual_margin.notna()]; te = gm[gm.season == S].copy()
        te["pred"] = np.mean([E.gbm(sd).fit(tr[feats], tr.actual_margin).predict(te[feats]) for sd in range(5)], axis=0)
        parts.append(te)
    return pd.concat(parts)

A0 = walk5(FEATS); A1 = walk5(FEATS + nets)
res = {}
for gate in [3, 4, 5]:
    print(f"--- gate {gate} ---")
    r0 = E.grade_sides(A0, gate=gate, label=f"BASE g{gate}")
    r1 = E.grade_sides(A1, gate=gate, label=f"+nets g{gate}")
    res[gate] = (r0, r1)
b0, b1 = res[4]
h25_0 = b0["frame"]; h25_0 = h25_0[h25_0.season == 2025].win.mean()
h25_1 = b1["frame"]; h25_1 = h25_1[h25_1.season == 2025].win.mean()
c1 = all(res[g][1]["hit"] > res[g][0]["hit"] for g in [3, 4, 5])
c2 = h25_1 >= h25_0
c3 = b1["clv"] >= b0["clv"] - 0.02
print(f"\nCRITERIA: all-gates-beat={c1} | 2025 holdout +nets {100*h25_1:.1f} vs base {100*h25_0:.1f} -> {c2} | CLV ok={c3}")
print("VERDICT:", "UPGRADE CONFIRMED" if (c1 and c2 and c3) else "FAILED — LOCKED MODEL STANDS")
