"""
(A) Per-receiver MAN vs ZONE splits — the player-prop prior. From scheme_plays (2023-2025, clean man/zone).
For each targeted receiver: targets / catch% / yards-per-target / TD-rate vs MAN vs ZONE. Find the biggest
splits (zone-beaters & man-beaters) with real samples, and check whether the split PERSISTS year-to-year
(is it a stable skill = usable prior, or noise?).
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
d=pd.read_parquet(os.path.join(DATA,"scheme_plays.parquet"))
d=d[(d["pass"]==1)&(d.season>=2023)&d.receiver_player_id.notna()].copy()
d["mz"]=d.defense_man_zone_type.replace("",np.nan); d=d.dropna(subset=["mz"])
d["yds"]=pd.to_numeric(d.yards_gained,errors="coerce").fillna(0); d["cp"]=pd.to_numeric(d.complete_pass,errors="coerce").fillna(0); d["td"]=pd.to_numeric(d.pass_touchdown,errors="coerce").fillna(0)
L(f"[data] targeted pass plays 2023-25 w/ man/zone: {len(d)} | MAN {int((d.mz=='MAN_COVERAGE').sum())} / ZONE {int((d.mz=='ZONE_COVERAGE').sum())}")
L(f"[league baseline] yds/target: MAN {d[d.mz=='MAN_COVERAGE'].yds.mean():.2f}  ZONE {d[d.mz=='ZONE_COVERAGE'].yds.mean():.2f} | catch%: MAN {d[d.mz=='MAN_COVERAGE'].cp.mean()*100:.1f} ZONE {d[d.mz=='ZONE_COVERAGE'].cp.mean()*100:.1f} | TD/tgt: MAN {d[d.mz=='MAN_COVERAGE'].td.mean()*100:.1f} ZONE {d[d.mz=='ZONE_COVERAGE'].td.mean()*100:.1f}")

g=d.groupby(["receiver_player_name","mz"]).agg(tgt=("yds","size"),ypt=("yds","mean"),catch=("cp","mean"),tdr=("td","mean")).reset_index()
piv=g.pivot_table(index="receiver_player_name",columns="mz",values=["tgt","ypt","catch","tdr"])
piv.columns=[f"{a}_{ 'M' if b=='MAN_COVERAGE' else 'Z'}" for a,b in piv.columns]; piv=piv.reset_index().dropna(subset=["tgt_M","tgt_Z"])
piv=piv[(piv.tgt_M>=40)&(piv.tgt_Z>=40)]
piv["ypt_split"]=piv.ypt_Z-piv.ypt_M           # +ve => better vs ZONE
L(f"\n[build] {len(piv)} receivers w/ >=40 targets vs BOTH man & zone (2023-25)")
L("="*88); L("BIGGEST 'BEATS ZONE' (yds/target zone - man), n shown"); L("="*88)
L(f"  {'receiver':22s} {'ypt_M':>5s} {'ypt_Z':>5s} {'split':>6s} {'tgtM':>4s} {'tgtZ':>4s} {'tdM%':>4s} {'tdZ%':>4s}")
for _,r in piv.sort_values("ypt_split",ascending=False).head(10).iterrows():
    L(f"  {r.receiver_player_name:22s} {r.ypt_M:5.1f} {r.ypt_Z:5.1f} {r.ypt_split:+6.1f} {int(r.tgt_M):4d} {int(r.tgt_Z):4d} {r.tdr_M*100:4.0f} {r.tdr_Z*100:4.0f}")
L("\n"+"="*88); L("BIGGEST 'BEATS MAN' (yds/target man - zone)"); L("="*88)
L(f"  {'receiver':22s} {'ypt_M':>5s} {'ypt_Z':>5s} {'split':>6s} {'tgtM':>4s} {'tgtZ':>4s}")
for _,r in piv.sort_values("ypt_split").head(10).iterrows():
    L(f"  {r.receiver_player_name:22s} {r.ypt_M:5.1f} {r.ypt_Z:5.1f} {r.ypt_split:+6.1f} {int(r.tgt_M):4d} {int(r.tgt_Z):4d}")

# STABILITY: does a receiver's man/zone split persist year to year? (is it a usable prior?)
L("\n"+"="*88); L("STABILITY — does the per-receiver split PERSIST (2023->2024->2025)?"); L("="*88)
yr=d.groupby(["receiver_player_name","season","mz"]).yds.agg(["size","mean"]).reset_index()
yp=yr.pivot_table(index=["receiver_player_name","season"],columns="mz",values=["size","mean"])
yp.columns=[f"{a}_{'M' if b=='MAN_COVERAGE' else 'Z'}" for a,b in yp.columns]; yp=yp.reset_index().dropna(subset=["mean_M","mean_Z"])
yp=yp[(yp.size_M>=20)&(yp.size_Z>=20)]; yp["split"]=yp["mean_Z"]-yp["mean_M"]
wide=yp.pivot_table(index="receiver_player_name",columns="season",values="split")
pairs=wide.dropna(subset=[2023,2024]) if 2023 in wide and 2024 in wide else pd.DataFrame()
if len(pairs)>=15:
    rho=np.corrcoef(pairs[2023],pairs[2024])[0,1]; L(f"  receiver man/zone split: corr(2023, 2024) = {rho:+.3f} (n={len(pairs)})  [>0 = persists/stable skill]")
pairs2=wide.dropna(subset=[2024,2025]) if 2024 in wide and 2025 in wide else pd.DataFrame()
if len(pairs2)>=15:
    rho=np.corrcoef(pairs2[2024],pairs2[2025])[0,1]; L(f"  receiver man/zone split: corr(2024, 2025) = {rho:+.3f} (n={len(pairs2)})")
L("  (low/zero corr => the split is mostly noise year-to-year, NOT a reliable prop prior)")
