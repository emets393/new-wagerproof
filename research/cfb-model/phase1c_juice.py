"""
PHASE 1c — ODDS/JUICE movement & asymmetry (not just the line number).
Per game: consensus spread/total LINE + PRICES at open/24h/close. Analyze:
  A. Juice ASYMMETRY at close: which side is juiced (more money) -> does it cover/hit?
  B. Juice MOVEMENT open->close: side gaining juice -> does it cover/hit?
  C. *** Hidden steam: NUMBER stayed flat but JUICE moved toward a side -> does that side cover? ***
For spread AND totals. Graded at close. 2021-25.
"""
import os, glob
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
cfbd = sorted(set(gm.homeTeam) | set(gm.awayTeam))
ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
         "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
         "Southern Miss Golden Eagles": "Southern Miss"}
def to_cfbd(o):
    if o in ALIAS: return ALIAS[o]
    c = [x for x in cfbd if o.startswith(x + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None
def prob(p):  # american price -> implied prob
    if pd.isna(p): return np.nan
    return (-p/(-p+100)) if p < 0 else (100/(p+100))

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0]); d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
od = pd.concat(parts, ignore_index=True)
od["home_c"] = od.home_team.map(to_cfbd); od["away_c"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home_c", "away_c"])
snap = od.groupby(["season", "game_id", "snapshot", "home_c", "away_c"]).agg(
    sp=("spread_home", "median"), sp_hp=("spread_home_price", "median"), sp_ap=("spread_away_price", "median"),
    tot=("total", "median"), ov=("over_price", "median"), un=("under_price", "median"),
    hrs=("hrs_to_kick", "max")).reset_index()

rows = []
for gid, d in snap.groupby("game_id"):
    d = d[d.hrs >= 0]
    if d.empty: continue
    o = d.loc[d.hrs.idxmax()]; c = d.loc[d.hrs.idxmin()]
    rows.append({"season": d.season.iloc[0], "home": d.home_c.iloc[0], "away": d.away_c.iloc[0], "game_id": gid,
                 "sp_o": o.sp, "sp_c": c.sp, "sp_hp_o": o.sp_hp, "sp_ap_o": o.sp_ap, "sp_hp_c": c.sp_hp, "sp_ap_c": c.sp_ap,
                 "tot_o": o.tot, "tot_c": c.tot, "ov_o": o.ov, "un_o": o.un, "ov_c": c.ov, "un_c": c.un})
f = pd.DataFrame(rows)
mg = gm[["season", "homeTeam", "awayTeam", "actual_margin", "actual_total"]].rename(columns={"homeTeam": "home", "awayTeam": "away"})
f = f.merge(mg, on=["season", "home", "away"], how="inner").dropna(subset=["sp_c", "actual_margin"])

# juice share = home/over implied prob share (0.5 balanced; >0.5 = that side more juiced = more money)
f["sp_home_share_c"] = f.apply(lambda r: prob(r.sp_hp_c)/(prob(r.sp_hp_c)+prob(r.sp_ap_c)) if prob(r.sp_hp_c) and prob(r.sp_ap_c) else np.nan, axis=1)
f["sp_home_share_o"] = f.apply(lambda r: prob(r.sp_hp_o)/(prob(r.sp_hp_o)+prob(r.sp_ap_o)) if prob(r.sp_hp_o) and prob(r.sp_ap_o) else np.nan, axis=1)
f["sp_juice_move"] = f.sp_home_share_c - f.sp_home_share_o
f["ov_share_c"] = f.apply(lambda r: prob(r.ov_c)/(prob(r.ov_c)+prob(r.un_c)) if prob(r.ov_c) and prob(r.un_c) else np.nan, axis=1)
f["ov_share_o"] = f.apply(lambda r: prob(r.ov_o)/(prob(r.ov_o)+prob(r.un_o)) if prob(r.ov_o) and prob(r.un_o) else np.nan, axis=1)
f["ov_juice_move"] = f.ov_share_c - f.ov_share_o
f["home_cover"] = (f.actual_margin + f.sp_c) > 0
f["over"] = f.actual_total > f.tot_c
f["sp_num_move"] = f.sp_c - f.sp_o; f["tot_num_move"] = f.tot_c - f.tot_o
def roi(h, n): return (h*0.909-(n-h))/n*100 if n else 0

print(f"games: {len(f)} | sp juice share coverage {f.sp_home_share_c.notna().mean()*100:.0f}%")
print("\n=== A. SPREAD juice ASYMMETRY at close: bet the MORE-JUICED side (share>.5=home) ===")
for lo,hi in [(.52,.55),(.55,.60),(.60,1)]:
    m=(f.sp_home_share_c>=lo)&(f.sp_home_share_c<hi); b=f[m]; win=b.home_cover; n=len(b)
    m2=(f.sp_home_share_c<=1-lo)&(f.sp_home_share_c>1-hi); b2=f[m2]; win2=~b2.home_cover; n2=len(b2)
    if n+n2>=25: print(f'  juiced side share {lo}-{hi}: n={n+n2} covers {100*(win.sum()+win2.sum())/(n+n2):.1f}%')
print("\n=== B. SPREAD juice MOVEMENT open->close: side GAINING juice covers? ===")
for lo,hi in [(.02,.05),(.05,.10),(.10,1)]:
    m=(f.sp_juice_move.abs()>=lo)&(f.sp_juice_move.abs()<hi); b=f[m]
    win=np.where(b.sp_juice_move>0,b.home_cover,~b.home_cover); n=len(b)
    if n>=25: print(f'  |juice move| {lo}-{hi}: n={n} gaining-side covers {100*win.mean():.1f}%')
print("\n=== C. HIDDEN STEAM: NUMBER flat (|num move|<0.5) but JUICE moved >=.04 ===")
flat=f[f.sp_num_move.abs()<0.5]
b=flat[flat.sp_juice_move.abs()>=.04]; win=np.where(b.sp_juice_move>0,b.home_cover,~b.home_cover)
print(f"  spread number flat + juice moved: n={len(b)} juice-side covers {100*win.mean() if len(b) else 0:.1f}%")
print("\n=== TOTALS juice movement (side gaining juice) ===")
for lo,hi in [(.03,.07),(.07,1)]:
    m=(f.ov_juice_move.abs()>=lo)&(f.ov_juice_move.abs()<hi); b=f[m]; win=np.where(b.ov_juice_move>0,b.over,~b.over); n=len(b)
    if n>=25: print(f'  |total juice move| {lo}-{hi}: n={n} gaining-side hits {100*win.mean():.1f}%')
totflat=f[f.tot_num_move.abs()<0.5]; b=totflat[totflat.ov_juice_move.abs()>=.04]; win=np.where(b.ov_juice_move>0,b.over,~b.over)
print(f"  total number flat + juice moved: n={len(b)} juice-side hits {100*win.mean() if len(b) else 0:.1f}%")
