#!/usr/bin/env python3
"""Real tail vs shuffled-target nulls (reads data/_prop_tail_rows*.parquet from exp_prop_tail.py).
The null keeps EVERYTHING about the pipeline except the labels the model learned from — same
features, same best-book execution, same weekly ranking — so whatever the null's tail wins is the
best-book / line-level selection effect, not the model. Real minus null is what the model adds."""
import glob, numpy as np, pandas as pd
def tails(A, q):
    out = {}
    for (s, l), x in A.groupby(["stack","lam"]):
        x = x.copy(); x["rk"] = x.groupby(["season","week"]).z.rank(pct=True, ascending=False); out[(s, l)] = x[x.rk <= q]
    return out
def bands(A):
    x = A.copy(); x["rk"] = x.groupby(["season","week","stack","lam"]).z.rank(pct=True, ascending=False); x = x[~x.push]
    x["band"] = pd.cut(x.rk, [0, .02, .05, .10, .20, .35, .50, 1.01], labels=["0-2","2-5","5-10","10-20","20-35","35-50","50+"]); return x
def consensus(A, q=0.10, drop_top=0.02):
    T = tails(A, q); keys = set.intersection(*[set(t.key) for t in T.values()]); top = set(tails(A, drop_top)[("+ctx+fp", 200)].key)
    x = A[(A["stack"] == "+ctx+fp") & (A.lam == 200) & A.key.isin(keys - top) & ~A.push]; return x
real = pd.read_parquet("data/_prop_tail_rows.parquet"); nulls = {f: pd.read_parquet(f) for f in sorted(glob.glob("data/_prop_tail_rows_null*.parquet"))}
print(f"real + {len(nulls)} nulls\n")
print("BANDS (+ctx+fp, pooled lam) — win% real | null mean (min..max)")
rb = bands(real[real["stack"] == "+ctx+fp"]); nb = [bands(n[n["stack"] == "+ctx+fp"]) for n in nulls.values()]
for yr in (2024, 2025):
    print(f"  {yr}")
    for b in ["0-2","2-5","5-10","10-20","20-35","35-50","50+"]:
        r = rb[(rb.season == yr) & (rb.band == b)]; ns = [n[(n.season == yr) & (n.band == b)].won.mean() * 100 for n in nb]
        print(f"    {b:6s} real {100*r.won.mean():5.1f}% ROI {100*r.pl.mean():+5.1f}%  n/lam={len(r)//3:4d} | null {np.mean(ns):5.1f}% ({min(ns):4.1f}..{max(ns):4.1f})  -> model adds {100*r.won.mean()-np.mean(ns):+4.1f} pts")
print("\nCONSENSUS SLICE (top 10% under all 9 settings, minus the extreme top 2%) — the product slice")
rc = consensus(real); nc = [consensus(n) for n in nulls.values()]
for yr in (2024, 2025):
    r = rc[rc.season == yr]; ns = [(n[n.season == yr].won.mean() * 100, n[n.season == yr].pl.mean() * 100, len(n[n.season == yr])) for n in nc]
    print(f"  {yr}: real {100*r.won.mean():5.1f}% ROI {100*r.pl.mean():+5.1f}% n={len(r)} ({len(r)/18:.0f}/wk)  [over {100*r[r.over].won.mean():4.1f}% n={int(r.over.sum())}, under {100*r[~r.over].won.mean():4.1f}% n={int((~r.over).sum())}] | nulls: " + ", ".join(f"{w:4.1f}%/{p:+4.1f}% n={n}" for w, p, n in ns))
print("\nCONSENSUS SLICE by market (real):")
print(rc.groupby(["mkt","season"]).agg(n=("won","size"), win=("won","mean"), roi=("pl","mean")).round(3).unstack("season").to_string())
