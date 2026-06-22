"""
GAME-ENVIRONMENT vs POSTED TOTAL. Characterize each game's scoring environment from archetypes (shootout <->
rockfight), derive an archetype-IMPLIED total, and bet when the POSTED total disagrees:
  rockfight priced too HIGH  -> UNDER ;  shootout priced too LOW -> OVER.
env score (higher=shootout): +explosive +leakyD +uptempo +weakfront +weaksec  -methodical -stout -domfront
  -lockdown -slow -bdb  (both teams counted).
WALK-FORWARD: expected_total = linear fit of actual_total on env using PRIOR seasons only. resid = exp - close.
Bet OVER if resid>=R, UNDER if resid<=-R. Grade @ close, per-season + 2025 holdout. (archetypes start 2021.)
"""
import numpy as np
import pandas as pd
import archetypes as AR

out, tg, AX = AR.build_archetypes()
g = out[out.actual_total.notna() & out.total_close.notna()].copy()
def cnt(base, val): return (g[f"home_{base}"]==val).astype(int) + (g[f"away_{base}"]==val).astype(int)
g["env"] = (cnt("A_style","Explosive") + cnt("D_bigplay","Leaky") + cnt("A_tempo","Up-tempo")
            + cnt("D_front7","Weak-front") + cnt("D_secondary","Weak-secondary")
            - cnt("A_style","Methodical") - cnt("D_run","Stout-runD") - cnt("D_front7","Dominant-front")
            - cnt("D_secondary","Lockdown-secondary") - cnt("A_tempo","Slow") - cnt("D_bigplay","BendDontBreak"))
g = g[g.actual_total != g.total_close]
TS = [2022, 2023, 2024, 2025]
def roi(w,n): return (w*0.909-(n-w))/n*100 if n else 0.0

# walk-forward archetype-implied total
g["exp_total"] = np.nan
for S in TS:
    prior = g[g.season < S]
    if len(prior) < 200: continue
    b1, b0 = np.polyfit(prior.env, prior.actual_total, 1)
    g.loc[g.season == S, "exp_total"] = b0 + b1 * g.loc[g.season == S, "env"]
gg = g[g.exp_total.notna()].copy()
gg["resid"] = gg.exp_total - gg.total_close          # >0 archetype expects MORE than market
gg["over"] = gg.actual_total > gg.total_close
print(f"games (2022-25): {len(gg)} | env->total slope ~{np.polyfit(gg.env,gg.actual_total,1)[0]:.2f} pts/unit")
print(f"resid std {gg.resid.std():.2f} | corr(resid, over) {np.corrcoef(gg.resid, gg.over.astype(int))[0,1]:+.3f}\n")

def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
print("=== bet by archetype-vs-market residual (resid = archetype_total - posted) ===")
print(f"{'rule':<34}{'n':>5}{'hit%':>7}{'roi':>7}  pool22-24 / 2025  [per-season]")
for R in [1.5, 2.5, 3.5, 4.5]:
    for lab, mask, side in [(f"OVER resid>=+{R}", gg.resid >= R, "over"),
                            (f"UNDER resid<=-{R}", gg.resid <= -R, "under")]:
        b = gg[mask]
        if len(b) < 30: continue
        w = b.over if side == "over" else ~b.over
        pool = b[b.season <= 2024]; hold = b[b.season == 2025]
        pw = (pool.over if side=="over" else ~pool.over); hw = (hold.over if side=="over" else ~hold.over)
        flag = "  <<HOLDS" if (pw.mean()>0.524 and hw.mean()>0.524 and len(hold)>=15) else ""
        print(f"{lab:<34}{len(b):>5}{100*w.mean():>7.1f}{roi(int(w.sum()),len(b)):>7.1f}  {100*pw.mean():.0f}%/{100*hw.mean():.0f}%(n{len(hold)}) [{per(b,w)}]{flag}")

# user's exact framing: within rockfight / shootout game-types, is the posted total out of line?
print("\n=== game-type conditional: rockfight (env<=-2) priced HIGH -> under; shootout (env>=+2) priced LOW -> over ===")
rk = gg[gg.env <= -2]; sh = gg[gg.env >= 2]
print(f"  rockfights n={len(rk)} (env<=-2): avg posted {rk.total_close.mean():.1f} vs avg actual {rk.actual_total.mean():.1f}")
print(f"  shootouts  n={len(sh)} (env>=+2): avg posted {sh.total_close.mean():.1f} vs avg actual {sh.actual_total.mean():.1f}")
for lab, sub, side, mask in [("ROCKFIGHT & posted ABOVE archetype (under)", rk, "under", rk.resid <= -1.5),
                             ("SHOOTOUT & posted BELOW archetype (over)", sh, "over", sh.resid >= 1.5)]:
    b = sub[mask]
    if len(b) >= 25:
        w = (~b.over) if side=="under" else b.over
        pool=b[b.season<=2024]; hold=b[b.season==2025]
        pw=(~pool.over if side=='under' else pool.over); hw=(~hold.over if side=='under' else hold.over)
        print(f"  {lab:<44} n={len(b):<3} {100*w.mean():.1f}%  pool {100*pw.mean():.0f}% / 2025 {100*hw.mean():.0f}%(n{len(hold)}) [{per(b,w)}]")
