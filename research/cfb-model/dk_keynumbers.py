"""
DK key-number analysis, push-correct. Closing-number cover (fav & dog, pushes excluded), per-season for
notable numbers, key-number CROSSING, and totals key numbers.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
fr = pd.read_parquet(os.path.join(HERE, "data", "dk_frame.parquet"))
TS = [2021, 2022, 2023, 2024, 2025]
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
fr["fav_sp"] = -fr.sp_c.abs()
fr["fav_is_home"] = fr.sp_c < 0
fr["fav_margin"] = np.where(fr.fav_is_home, fr.actual_margin, -fr.actual_margin)
fr["ats"] = fr.fav_margin + fr.fav_sp     # >0 fav covers, <0 dog covers, =0 push
npush = fr[fr.ats != 0]

print(f"OVERALL dog cover% (push excl): {100*(npush.ats<0).mean():.1f}% (n={len(npush)}) | overall push%: {100*(fr.ats==0).mean():.1f}%")
print("\n=== FAVORITE vs DOG cover% by EXACT closing spread (pushes EXCLUDED), DK ===")
print(f"{'fav_sp':>7}{'n':>6}{'push%':>7}{'FAVcov%':>9}{'DOGcov%':>9}{'per-season DOGcov%':>26}")
for v in sorted(fr.fav_sp.unique()):
    allg = fr[fr.fav_sp == v]; b = allg[allg.ats != 0]
    if len(allg) < 50: continue
    favc = 100 * (b.ats > 0).mean(); dogc = 100 - favc
    pushp = 100 * (allg.ats == 0).mean()
    per = "/".join(f"{100*(b.ats[b.season==s]<0).mean():.0f}" if (b.season==s).sum()>=10 else "--" for s in TS)
    flag = " <<" if abs(dogc - 50) >= 5 else ""
    print(f"{v:>7}{len(allg):>6}{pushp:>7.1f}{favc:>9.1f}{dogc:>9.1f}{per:>26}{flag}")

print("\n=== KEY-NUMBER GROUPS: take the DOG at +3 / +7 / +10 (pushes excl), per-season ===")
def grp(name, mask):
    b = npush[mask.reindex(npush.index, fill_value=False)]; n = len(b); dc = int((b.ats < 0).sum())
    per = "/".join(f"{100*(b.ats[b.season==s]<0).mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
    print(f"  {name:<26} n={n:<4} DOG cover {100*dc/n if n else 0:.1f}% roi {roi(dc,n):+.1f} [{per}]")
grp("dog +2.5/+3/+3.5", fr.fav_sp.isin([-2.5, -3.0, -3.5]))
grp("dog exactly +3", fr.fav_sp == -3.0)
grp("dog +6.5/+7/+7.5", fr.fav_sp.isin([-6.5, -7.0, -7.5]))
grp("dog exactly +7", fr.fav_sp == -7.0)
grp("dog +9.5/+10/+10.5", fr.fav_sp.isin([-9.5, -10.0, -10.5]))
grp("fav -6.5/-7.5/-9.5 (back fav)", fr.fav_sp.isin([-6.5, -7.5, -9.5]))

print("\n=== CROSSING key number 3 or 7 (open->close moved ACROSS) ===")
def crossed(o, c, k):
    return (min(abs(o), abs(c)) < k < max(abs(o), abs(c)))
for k in [3, 7]:
    fr[f"cross{k}"] = fr.apply(lambda r: crossed(r.sp_o, r.sp_c, k), axis=1)
    b = fr[(fr[f"cross{k}"]) & (fr.ats != 0)]
    if len(b) >= 25:
        # direction: did |spread| increase (fav got bigger)? bet fav if so
        bigger = b.sp_c.abs() > b.sp_o.abs()
        win = np.where(bigger, b.ats > 0, b.ats < 0)  # crossed up->back fav; crossed down->back dog
        print(f"  crossed {k}: n={len(b)} follow-cross-direction covers {100*win.mean():.1f}%")

print("\n=== TOTALS: over% by EXACT closing total (push excl) ===")
fr["tot_res"] = fr.actual_total - fr.tot_c
ntp = fr[fr.tot_res != 0]
print(f"{'total':>7}{'n':>6}{'over%':>8}")
for v in sorted(fr.tot_c.dropna().unique()):
    b = ntp[ntp.tot_c == v]
    if len(b) >= 50: print(f"{v:>7}{len(b):>6}{100*(b.tot_res>0).mean():>8.1f}")
