"""
Backfill the scheme + outcome play table (2018-2025): nflverse PARTICIPATION (man/zone, coverage, formation,
personnel, box, pass-rushers, route) JOINED to nflfastR PBP (posteam/defteam, targeted receiver, air yards,
yards, EPA, pass location) on game_id+play_id. Saves data/scheme_plays.parquet — the foundation for defense
scheme profiles + per-receiver man/zone splits. Re-runnable each week in 2026 to roll forward.
"""
import os, io, sys, warnings
import requests, numpy as np, pandas as pd
warnings.filterwarnings("ignore")
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
REL="https://github.com/nflverse/nflverse-data/releases/download"
PART=["nflverse_game_id","play_id","possession_team","offense_formation","offense_personnel","defenders_in_box",
      "defense_personnel","number_of_pass_rushers","defense_man_zone_type","defense_coverage_type","route","was_pressure","time_to_throw"]
PBP=["game_id","play_id","season","week","posteam","defteam","play_type","qb_dropback","pass","rush",
     "passer_player_id","receiver_player_id","receiver_player_name","air_yards","yards_gained","complete_pass",
     "pass_location","yards_after_catch","epa","touchdown","pass_touchdown","rush_touchdown","interception","sack"]
def get(url, cols=None):
    r=requests.get(url,timeout=300)
    if r.status_code!=200: raise FileNotFoundError(r.status_code)
    df=pd.read_parquet(io.BytesIO(r.content))
    return df[[c for c in cols if c in df.columns]] if cols else df
parts=[]
for yr in range(2018,2026):
    try:
        pa=get(f"{REL}/pbp_participation/pbp_participation_{yr}.parquet",PART).rename(columns={"nflverse_game_id":"game_id"})
        pb=get(f"{REL}/pbp/play_by_play_{yr}.parquet",PBP)
        m=pb.merge(pa,on=["game_id","play_id"],how="left")
        parts.append(m); L(f"  {yr}: pbp {len(pb)} + part {len(pa)} -> joined {len(m)} | man/zone labeled {m.defense_man_zone_type.replace('',np.nan).notna().mean()*100:.0f}%")
    except Exception as e:
        L(f"  {yr}: FAIL {e}")
d=pd.concat(parts,ignore_index=True)
d.to_parquet(os.path.join(DATA,"scheme_plays.parquet"),index=False)
L(f"\n[save] scheme_plays.parquet: {d.shape}  seasons {sorted(d.season.unique().tolist())}")
# sanity
pp=d[d["pass"]==1] if "pass" in d.columns else d[d.play_type=="pass"]
L(f"[check] pass plays: {len(pp)} | with man/zone label: {pp.defense_man_zone_type.replace('',np.nan).notna().mean()*100:.0f}% | with receiver_id: {pp.receiver_player_id.notna().mean()*100:.0f}%")
mz=d.defense_man_zone_type.replace("",np.nan)
L(f"[check] man/zone mix (labeled pass plays): {mz.value_counts().to_dict()}")
L(f"[check] offense_formation: {d.offense_formation.replace('',np.nan).value_counts().head(7).to_dict()}")
L(f"[check] coverage shells: {d.defense_coverage_type.replace('',np.nan).value_counts().to_dict()}")