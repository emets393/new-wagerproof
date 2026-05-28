"""
FALSE-POSITIVE CONTROL for the trend scan: re-run the IDENTICAL singles+2-way scan on SHUFFLED
outcomes (permuted within season to preserve base rates). If the null produces a similar number of
'passers', the guarding bar is mostly catching noise -> only survivors far above the null + with a
mechanism are real. Reports real vs null passer counts for ATS and O/U.
"""
import os, sys, warnings, itertools
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from b3_scan import conds_team, conds_game, qualify, tg, gl   # reuse exact logic
np.random.seed(0)


def count_passers(d, outcome, condfn, anchors):
    C = condfn(d); names = list(C.keys()); n_pass = 0; screened = 0
    masks = {nm: C[nm].values for nm in names}
    for nm in names:
        screened += 1
        if qualify(d[C[nm]], outcome):
            n_pass += 1
    for a, b in itertools.combinations(names, 2):
        mask = C[a] & C[b]
        if mask.sum() < 40:
            continue
        screened += 1
        if qualify(d[mask], outcome):
            n_pass += 1
    return screened, n_pass


def shuffle_within_season(d, col):
    d2 = d.copy()
    d2[col] = d2.groupby("season")[col].transform(lambda s: np.random.permutation(s.values))
    return d2


print("=" * 80)
print("PERMUTATION NULL — passers on REAL vs SHUFFLED outcomes (singles + 2-way)")
print("=" * 80)
# ATS
sc, real_ats = count_passers(tg, "team_cover", conds_team, [])
nulls = []
for i in range(4):
    nulls.append(count_passers(shuffle_within_season(tg, "team_cover"), "team_cover", conds_team, [])[1])
print(f"  ATS: screened {sc} singles+2way | REAL passers={real_ats} | "
      f"NULL passers (4 shuffles)={nulls} mean={np.mean(nulls):.0f}")
# OU
sc2, real_ou = count_passers(gl, "over", conds_game, [])
nulls2 = []
for i in range(4):
    nulls2.append(count_passers(shuffle_within_season(gl, "over"), "over", conds_game, [])[1])
print(f"  O/U: screened {sc2} singles+2way | REAL passers={real_ou} | "
      f"NULL passers (4 shuffles)={nulls2} mean={np.mean(nulls2):.0f}")
print("\n  Interpretation: REAL >> NULL => enrichment (real trends exist among them).")
print("  REAL ~ NULL => the bar mostly catches noise; trust only top survivors + mechanism.")
