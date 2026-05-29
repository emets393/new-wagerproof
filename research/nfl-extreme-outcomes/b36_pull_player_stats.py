"""
Pull nflverse weekly player-OFFENSE stats (per player-game): rushing/receiving TDs + yards/receptions/etc.
Closes the anytime-TD data gap (the DB only had QB pass TDs). Source: nflverse-data player_stats release.
Saves data/player_offense.parquet (2018-2025, gsis player_id -> joins to players_xwalk / madden_ratings).
"""
import os, io, sys, warnings
import requests, numpy as np, pandas as pd
warnings.filterwarnings("ignore")
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
REL="https://github.com/nflverse/nflverse-data/releases/download"
def get(url):
    r=requests.get(url,timeout=180)
    if r.status_code!=200: raise FileNotFoundError(f"{r.status_code}")
    return pd.read_parquet(io.BytesIO(r.content))
# stats_player tag (current, has all yrs incl 2025) first; old player_stats tag as fallback
parts=[]
for yr in range(2018,2026):
    got=None
    for url in (f"{REL}/stats_player/stats_player_week_{yr}.parquet", f"{REL}/player_stats/player_stats_{yr}.parquet"):
        try: got=get(url); L(f"   {yr} ok ({len(got)} rows) <- {url.split('/download/')[1]}"); break
        except Exception: pass
    if got is None: L(f"   {yr} FAIL")
    else: parts.append(got)
df=pd.concat(parts,ignore_index=True)
L(f"[pull] all seasons: {df.shape}  seasons {sorted(int(s) for s in df.season.unique())}")
# normalize column names across nflverse versions
ren={"player_display_name":"player_name","recent_team":"team"}
df=df.rename(columns={k:v for k,v in ren.items() if k in df.columns and v not in df.columns})
L(f"[cols] {sorted([c for c in df.columns if any(k in c for k in ['td','touchdown','yard','recept','target','carr','attempt','player_id','season','week','team','position'])])[:30]}")
keep=[c for c in ["player_id","player_name","position","position_group","season","week","season_type","team",
      "carries","rushing_yards","rushing_tds","targets","receptions","receiving_yards","receiving_tds",
      "attempts","passing_yards","passing_tds","fantasy_points_ppr"] if c in df.columns]
o=df[keep].copy()
o=o[(o.season>=2018)&(o.season<=2025)]
if "season_type" in o.columns: o=o[o.season_type.isin(["REG","POST"])]
# keep only OFFENSIVE-INVOLVEMENT rows (the feed includes every rostered player incl 0-touch defenders/OL)
touch=sum(pd.to_numeric(o[c],errors="coerce").fillna(0) for c in ["carries","targets","attempts","receptions"] if c in o.columns)
o=o[touch>0].copy()
for c in ["rushing_tds","receiving_tds","passing_tds"]:
    if c in o.columns: o[c]=pd.to_numeric(o[c],errors="coerce").fillna(0)
if "rushing_tds" in o.columns and "receiving_tds" in o.columns:
    o["anytime_td"]=((o.rushing_tds+o.receiving_tds)>0).astype(int)
o.to_parquet(os.path.join(DATA,"player_offense.parquet"),index=False)
L(f"\n[save] player_offense.parquet: {o.shape}  seasons {int(o.season.min())}-{int(o.season.max())}")
L(f"[check] rows w/ rushing_tds col: {'rushing_tds' in o.columns}, receiving_tds: {'receiving_tds' in o.columns}")
if "anytime_td" in o.columns:
    L(f"[check] player-games: {len(o)} | anytime-TD rate (any rush/rec TD): {o.anytime_td.mean()*100:.1f}%")
    # quick join sanity to birthdate
    px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet"))[["gsis_id","birth_date"]]
    j=o.merge(px,left_on="player_id",right_on="gsis_id",how="left")
    L(f"[check] player-games joined to a birthdate: {j.birth_date.notna().mean()*100:.1f}%  (enables the birthday-TD analysis)")
    top=o.groupby("player_name").receiving_tds.sum().sort_values(ascending=False).head(3) if "receiving_tds" in o.columns else None
    if top is not None: L(f"[sanity] top career rec-TD in window: {top.to_dict()}")