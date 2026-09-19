#!/usr/bin/env python3
"""Compare the attempts and completions QB profiles (qb_profiles.py output): predictability rank in each,
bias in each, who is predictable in both, and which tendencies carry across markets."""
import pandas as pd, numpy as np, sys
S = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
A = pd.read_parquet(f"data/_qb_profiles_attempts_{S}.parquet"); C = pd.read_parquet(f"data/_qb_profiles_completions_{S}.parquet")
M = A.merge(C, on=["qb","name"], suffixes=("_att","_cmp")); M["rank_att"] = M.line_mae_att.rank(); M["rank_cmp"] = M.line_mae_cmp.rank()
print(f"{len(M)} starters | rank corr {M.rank_att.corr(M.rank_cmp, method='spearman'):+.2f} | bias corr {M.mean_res_att.corr(M.mean_res_cmp):+.2f}")
tl = lambda t: {x["factor"]: np.sign(x["r"]) for x in t}
for r in M.sort_values("rank_att").itertuples():
    ta, tc = tl(r.tendencies_att), tl(r.tendencies_cmp); both = [f + ("(+)" if ta[f] > 0 else "(-)") for f in ta if f in tc and ta[f] == tc[f]]
    print(f"  {r.name[:20]:20s} att #{int(r.rank_att):2d} {r.line_mae_att:5.2f} {r.mean_res_att:+5.2f} | cmp #{int(r.rank_cmp):2d} {r.line_mae_cmp:5.2f} {r.mean_res_cmp:+5.2f} | {', '.join(both) or '—'}")
