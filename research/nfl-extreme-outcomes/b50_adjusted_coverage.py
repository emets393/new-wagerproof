"""
ADJUSTED coverage analysis — conditioning on pressure as the user (correctly) demanded.
Premise: coverage TYPE (man/zone) is a label; its effectiveness is conditional on whether the pass rush gets
home. A "good" man D without pressure becomes bad; a "bad" zone D with pressure becomes good. Build the 2x2
properly, derive effective team-defense ratings, surface QB/receiver pressure-conditioned splits, and STABILITY-
TEST them: does conditioning on pressure make per-player splits stable (real skill) or still noise?
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
d=pd.read_parquet(os.path.join(DATA,"scheme_plays.parquet"))
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet"))[["gsis_id","display_name"]]
name=dict(zip(px.gsis_id,px.display_name))
def nm(pid): return name.get(pid,pid) if pid else ""

# pass plays, 2023-2025 (clean man/zone), labeled
p=d[(d["pass"]==1)&(d.season>=2023)&d.defense_man_zone_type.isin(["MAN_COVERAGE","ZONE_COVERAGE"])].copy()
p["mz"]=np.where(p.defense_man_zone_type=="MAN_COVERAGE","M","Z")
p["pr"]=pd.to_numeric(p.was_pressure,errors="coerce").fillna(0).astype(int)
for c in ["epa","cpoe","success","yards_gained"]: p[c]=pd.to_numeric(p[c],errors="coerce")
p["bucket"]=p.mz+"_"+np.where(p.pr==1,"P","N")     # M_P, M_N, Z_P, Z_N
L(f"[data] dropback plays 2023-25: {len(p)}")

# ---------- (1) PRESSURE x COVERAGE 2x2 baseline ----------
L("\n"+"="*86); L("(1) LEAGUE BASELINE — pressure x coverage 2x2 (EPA/play, success%, catch%, CPOE)"); L("="*86)
g=p.groupby("bucket").agg(n=("epa","size"),epa=("epa","mean"),succ=("success","mean"),cpoe=("cpoe","mean"),yds=("yards_gained","mean")).round(3)
g.index=["MAN +pressure","MAN no-pressure","ZONE +pressure","ZONE no-pressure"]
L(g.to_string())
L(f"  -> 'how much does pressure matter PER coverage?'")
L(f"     MAN: pressure drops EPA by {p[p.bucket=='M_N'].epa.mean()-p[p.bucket=='M_P'].epa.mean():.3f}")
L(f"     ZONE: pressure drops EPA by {p[p.bucket=='Z_N'].epa.mean()-p[p.bucket=='Z_P'].epa.mean():.3f}")

# ---------- (2) TEAM-DEFENSE pressure-adjusted ratings ----------
L("\n"+"="*86); L("(2) TEAM-DEF effective coverage rating — pressure-adjusted (lower EPA-allowed = better)"); L("="*86)
ts=p.groupby(["defteam","season"]).agg(
    n=("epa","size"), pr_rate=("pr","mean"),
    epa_M=("epa",lambda s: s[p.loc[s.index,"mz"]=="M"].mean()),
    epa_Z=("epa",lambda s: s[p.loc[s.index,"mz"]=="Z"].mean()),
    epa_M_P=("epa",lambda s: s[(p.loc[s.index,"mz"]=="M")&(p.loc[s.index,"pr"]==1)].mean()),
    epa_M_N=("epa",lambda s: s[(p.loc[s.index,"mz"]=="M")&(p.loc[s.index,"pr"]==0)].mean()),
    epa_Z_P=("epa",lambda s: s[(p.loc[s.index,"mz"]=="Z")&(p.loc[s.index,"pr"]==1)].mean()),
    epa_Z_N=("epa",lambda s: s[(p.loc[s.index,"mz"]=="Z")&(p.loc[s.index,"pr"]==0)].mean()),
).reset_index()
L(f"  league pressure rate: {p.pr.mean()*100:.1f}%")
L(f"\n  example: team-seasons with HIGH man rate but LOW pressure rate ('fake good vs man'):")
ts2=ts.copy()
mrate=p.groupby(["defteam","season"]).mz.apply(lambda s:(s=='M').mean()).rename("man_rate").reset_index()
ts2=ts2.merge(mrate,on=["defteam","season"])
fake=ts2[(ts2.man_rate>=0.45)&(ts2.pr_rate<=0.30)].sort_values("epa_M",ascending=False).head(6)
L(f"  {'team':5s} {'yr':4s} {'man%':>5s} {'pr%':>5s} {'epa/M':>7s} {'epa/M+P':>8s} {'epa/M-P':>8s}")
for _,r in fake.iterrows():
    L(f"  {r.defteam:5s} {int(r.season):4d} {r.man_rate*100:5.0f} {r.pr_rate*100:5.0f} {r.epa_M:+7.3f} {r.epa_M_P:+8.3f} {r.epa_M_N:+8.3f}")
L(f"\n  HIGH zone rate + HIGH pressure rate ('really good zone, helped by pass rush'):")
good=ts2[(ts2.man_rate<=0.30)&(ts2.pr_rate>=0.40)].sort_values("epa_Z").head(6)
L(f"  {'team':5s} {'yr':4s} {'zone%':>6s} {'pr%':>5s} {'epa/Z':>7s} {'epa/Z+P':>8s} {'epa/Z-P':>8s}")
for _,r in good.iterrows():
    L(f"  {r.defteam:5s} {int(r.season):4d} {(1-r.man_rate)*100:6.0f} {r.pr_rate*100:5.0f} {r.epa_Z:+7.3f} {r.epa_Z_P:+8.3f} {r.epa_Z_N:+8.3f}")

# ---------- (3) QB 4-way splits ----------
L("\n"+"="*86); L("(3) QB 4-way splits (EPA/play). 'Zone killer' = high EPA vs zone, esp w/o pressure"); L("="*86)
qb=p.groupby(["passer_player_id","season","bucket"]).agg(n=("epa","size"),epa=("epa","mean")).reset_index()
qbp=qb.pivot_table(index=["passer_player_id","season"],columns="bucket",values=["n","epa"])
qbp.columns=[f"{a}_{b}" for a,b in qbp.columns]; qbp=qbp.reset_index()
for c in ["M_P","M_N","Z_P","Z_N"]: qbp=qbp[qbp[f"n_{c}"].fillna(0)>=30]
qbp["zone_kill"]=qbp["epa_Z_N"]   # zone-killer score: EPA vs zone-no-pressure
qbp["man_strug"]=qbp["epa_M_P"]   # man-struggler score: EPA vs man-with-pressure (lower = worse)
qbp["name"]=qbp.passer_player_id.map(nm)
L(f"  qualifying QB-seasons (>=30 plays in each of 4 cells): {len(qbp)}")
L(f"\n  Top ZONE KILLERS (highest EPA vs zone, no pressure):")
L(f"  {'QB':22s} {'yr':4s} {'M+P':>6s} {'M-P':>6s} {'Z+P':>6s} {'Z-P':>6s}  (n cells)")
for _,r in qbp.sort_values("zone_kill",ascending=False).head(8).iterrows():
    L(f"  {r['name']:22s} {int(r.season):4d} {r.epa_M_P:+6.2f} {r.epa_M_N:+6.2f} {r.epa_Z_P:+6.2f} {r.epa_Z_N:+6.2f}  ({int(r.n_M_P)}/{int(r.n_M_N)}/{int(r.n_Z_P)}/{int(r.n_Z_N)})")
L(f"\n  Top MAN STRUGGLERS (lowest EPA vs man w/ pressure):")
for _,r in qbp.sort_values("man_strug").head(8).iterrows():
    L(f"  {r['name']:22s} {int(r.season):4d} {r.epa_M_P:+6.2f} {r.epa_M_N:+6.2f} {r.epa_Z_P:+6.2f} {r.epa_Z_N:+6.2f}")

# ---------- (4) STABILITY: does conditioning on pressure make signals stable? ----------
L("\n"+"="*86); L("(4) STABILITY — prior 2 yrs (2023+2024) cell EPA vs 2025 EPA, per QB"); L("="*86)
def st(metric, label, min_n=30):
    pri=p[p.season.isin([2023,2024])].groupby(["passer_player_id","bucket"]).agg(n=("epa","size"),v=("epa","mean")).reset_index()
    pri=pri[pri.n>=min_n*2]   # 30/yr → ~60 over 2 yrs combined
    fut=p[p.season==2025].groupby(["passer_player_id","bucket"]).agg(n=("epa","size"),v=("epa","mean")).reset_index()
    fut=fut[fut.n>=min_n]
    L(f"\n  metric: {label}")
    for b in ["M_P","M_N","Z_P","Z_N"]:
        m=pri[pri.bucket==b].merge(fut[fut.bucket==b],on="passer_player_id",suffixes=("_pri","_fut"))
        if len(m)<10: L(f"    {b}: n={len(m)} (few)"); continue
        rho=np.corrcoef(m.v_pri,m.v_fut)[0,1]
        L(f"    QB EPA in {b}: prior-vs-2025 corr = {rho:+.3f}  (n={len(m)})  -> {'STABLE' if rho>=0.30 else 'noisy'}")
st("epa","QB EPA per play (4-cell)")
# also test the 2-way for comparison
def st2(label, min_n=60):
    pri=p[p.season.isin([2023,2024])].groupby(["passer_player_id","mz"]).agg(n=("epa","size"),v=("epa","mean")).reset_index()
    pri=pri[pri.n>=min_n*2]
    fut=p[p.season==2025].groupby(["passer_player_id","mz"]).agg(n=("epa","size"),v=("epa","mean")).reset_index()
    fut=fut[fut.n>=min_n]
    L(f"\n  metric: {label} (2-way man/zone, no pressure split)")
    for b in ["M","Z"]:
        m=pri[pri.mz==b].merge(fut[fut.mz==b],on="passer_player_id",suffixes=("_pri","_fut"))
        if len(m)<10: continue
        rho=np.corrcoef(m.v_pri,m.v_fut)[0,1]
        L(f"    QB EPA vs {b}: prior-vs-2025 corr = {rho:+.3f}  (n={len(m)})  -> {'STABLE' if rho>=0.30 else 'noisy'}")
st2("QB EPA per play")

# receivers: stability of pressure-conditioned splits
L("\n"+"="*86); L("(4b) STABILITY — receiver EPA/target by 4-way bucket (prior 2023-24 vs 2025)"); L("="*86)
def rst(min_n=20):
    pri=p[p.season.isin([2023,2024])&p.receiver_player_id.notna()].groupby(["receiver_player_id","bucket"]).agg(n=("epa","size"),v=("epa","mean")).reset_index()
    pri=pri[pri.n>=min_n*2]
    fut=p[(p.season==2025)&p.receiver_player_id.notna()].groupby(["receiver_player_id","bucket"]).agg(n=("epa","size"),v=("epa","mean")).reset_index()
    fut=fut[fut.n>=min_n]
    for b in ["M_P","M_N","Z_P","Z_N"]:
        m=pri[pri.bucket==b].merge(fut[fut.bucket==b],on="receiver_player_id",suffixes=("_pri","_fut"))
        if len(m)<15: L(f"    REC {b}: n={len(m)} (few)"); continue
        rho=np.corrcoef(m.v_pri,m.v_fut)[0,1]
        L(f"    REC EPA/tgt in {b}: prior-vs-2025 corr = {rho:+.3f}  (n={len(m)})  -> {'STABLE' if rho>=0.30 else 'noisy'}")
rst()
