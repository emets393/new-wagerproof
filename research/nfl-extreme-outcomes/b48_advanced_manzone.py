"""
Refresh scheme_plays with nflfastR ADVANCED metrics (EPA, CPOE, success, QB_EPA, YAC over expected) joined
to defensive scheme (man/zone, coverage), then re-run per-receiver man/zone splits on those richer signals.
Test stability (year-to-year corr) of EACH metric to find the most reliable forward signal.
"""
import os, io, sys, warnings
import requests, numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
REL="https://github.com/nflverse/nflverse-data/releases/download"
PART=["nflverse_game_id","play_id","possession_team","offense_formation","offense_personnel","defenders_in_box",
      "defense_personnel","number_of_pass_rushers","defense_man_zone_type","defense_coverage_type","route","was_pressure","time_to_throw"]
PBP=["game_id","play_id","season","week","posteam","defteam","play_type","qb_dropback","pass","rush",
     "passer_player_id","receiver_player_id","receiver_player_name","air_yards","yards_gained","complete_pass",
     "pass_location","yards_after_catch","epa","success","cpoe","qb_epa","comp_air_epa","comp_yac_epa",
     "xyac_epa","xyac_success","xpass","touchdown","pass_touchdown","rush_touchdown","interception","sack"]
def get(url, cols=None):
    r=requests.get(url,timeout=300); r.raise_for_status()
    df=pd.read_parquet(io.BytesIO(r.content))
    return df[[c for c in cols if c in df.columns]] if cols else df

parts=[]
for yr in range(2018,2026):
    try:
        pa=get(f"{REL}/pbp_participation/pbp_participation_{yr}.parquet",PART).rename(columns={"nflverse_game_id":"game_id"})
        pb=get(f"{REL}/pbp/play_by_play_{yr}.parquet",PBP)
        parts.append(pb.merge(pa,on=["game_id","play_id"],how="left"))
        L(f"  {yr}: joined {len(parts[-1])}  | advanced cols present: {sorted(set(PBP)&set(parts[-1].columns) - set(['game_id','play_id','season','week','posteam','defteam','play_type','pass','rush','qb_dropback','passer_player_id','receiver_player_id','receiver_player_name','complete_pass','pass_location','air_yards','yards_gained','yards_after_catch','touchdown','pass_touchdown','rush_touchdown','interception','sack']))}")
    except Exception as e: L(f"  {yr}: FAIL {e}")
d=pd.concat(parts,ignore_index=True); d.to_parquet(os.path.join(DATA,"scheme_plays.parquet"),index=False)
L(f"[refresh] scheme_plays: {d.shape}\n")

# --- receiver man/zone splits on ADVANCED metrics (2023-2025, clean man/zone) ---
p=d[(d["pass"]==1)&(d.season>=2023)&d.receiver_player_id.notna()].copy()
p["mz"]=p.defense_man_zone_type.replace("",np.nan); p=p.dropna(subset=["mz"])
for c in ["epa","cpoe","success","comp_yac_epa","xyac_epa","yards_gained","pass_touchdown","complete_pass"]:
    p[c]=pd.to_numeric(p.get(c),errors="coerce")
L("LEAGUE BASELINE 2023-25 (per target):")
for mz in ["MAN_COVERAGE","ZONE_COVERAGE"]:
    s=p[p.mz==mz]
    L(f"  vs {mz:14s} n={len(s):6d} | EPA/tgt={s.epa.mean():+.3f}  success={s.success.mean()*100:.1f}%  CPOE={s.cpoe.mean():+.1f}  yac_EPA-x={(s.comp_yac_epa-s.xyac_epa).mean():+.3f}")

def splits(metric, label, min_tgt=60):
    g=p.groupby(["receiver_player_name","mz"]).agg(n=("epa","size"),v=(metric,"mean")).reset_index()
    piv=g.pivot_table(index="receiver_player_name",columns="mz",values=["n","v"])
    piv.columns=[f"{a}_{'M' if b=='MAN_COVERAGE' else 'Z'}" for a,b in piv.columns]; piv=piv.reset_index().dropna(subset=["v_M","v_Z"])
    piv=piv[(piv.n_M>=min_tgt)&(piv.n_Z>=min_tgt)]; piv["split"]=piv.v_Z-piv.v_M
    if len(piv)<10: L(f"\n{label}: n_receivers={len(piv)} (too few)"); return
    L(f"\n{label}  (n_receivers w/ >={min_tgt} ea: {len(piv)})  league split (Z-M): {piv.split.mean():+.3f}")
    L(f"  top BEATS ZONE:")
    for _,r in piv.sort_values("split",ascending=False).head(6).iterrows():
        L(f"    {r.receiver_player_name:22s} M={r.v_M:+.3f}  Z={r.v_Z:+.3f}  split={r.split:+.3f}  (M n={int(r.n_M)} Z n={int(r.n_Z)})")
    L(f"  top BEATS MAN:")
    for _,r in piv.sort_values("split").head(6).iterrows():
        L(f"    {r.receiver_player_name:22s} M={r.v_M:+.3f}  Z={r.v_Z:+.3f}  split={r.split:+.3f}  (M n={int(r.n_M)} Z n={int(r.n_Z)})")
splits("epa","=== SPLIT: EPA/target ===",60)
splits("cpoe","=== SPLIT: CPOE per target ===",60)
splits("success","=== SPLIT: success rate per target ===",60)

# --- STABILITY per metric: prior=2023-24 (combined), test=2025 ---
L("\n"+"="*82); L("STABILITY — does each metric's man/zone split PERSIST? (prior 2023-24 -> 2025)"); L("="*82)
def stability(metric, label):
    pri=p[p.season.isin([2023,2024])].groupby(["receiver_player_name","mz"]).agg(n=("epa","size"),v=(metric,"mean")).reset_index()
    piv1=pri.pivot_table(index="receiver_player_name",columns="mz",values=["n","v"])
    piv1.columns=[f"{a}_{'M' if b=='MAN_COVERAGE' else 'Z'}" for a,b in piv1.columns]; piv1=piv1.reset_index().dropna(subset=["v_M","v_Z"])
    piv1=piv1[(piv1.n_M>=40)&(piv1.n_Z>=40)]; piv1["prior_split"]=piv1.v_Z-piv1.v_M
    fut=p[p.season==2025].groupby(["receiver_player_name","mz"]).agg(n=("epa","size"),v=(metric,"mean")).reset_index()
    piv2=fut.pivot_table(index="receiver_player_name",columns="mz",values=["n","v"])
    piv2.columns=[f"{a}_{'M' if b=='MAN_COVERAGE' else 'Z'}" for a,b in piv2.columns]; piv2=piv2.reset_index().dropna(subset=["v_M","v_Z"])
    piv2=piv2[(piv2.n_M>=20)&(piv2.n_Z>=20)]; piv2["fut_split"]=piv2.v_Z-piv2.v_M
    m=piv1[["receiver_player_name","prior_split"]].merge(piv2[["receiver_player_name","fut_split"]],on="receiver_player_name")
    if len(m)<15: L(f"  {label:20s} n={len(m)} (too few)"); return
    rho=np.corrcoef(m.prior_split,m.fut_split)[0,1]; ic="STABLE" if rho>=0.30 else ("modest" if rho>=0.15 else "noisy")
    L(f"  {label:20s} corr(2023-24 split, 2025 split) = {rho:+.3f}  (n={len(m)}) -> {ic}")
for m,lab in [("yards_gained","raw yds/target"),("epa","EPA/target"),("cpoe","CPOE"),("success","success rate"),("comp_yac_epa","YAC EPA")]:
    stability(m,lab)
