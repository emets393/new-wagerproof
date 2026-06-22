"""
Time-windowed line frame: per game, consensus line at the snapshot NEAREST each target hrs-to-kick
(open / 72h / 24h / 6h / close) for spread, total, and no-vig ML. Enables magnitude x timing analysis.
-> data/movement_windows.parquet
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
def novig(h, a):
    if pd.isna(h) or pd.isna(a): return np.nan
    hp = (-h/(-h+100)) if h < 0 else (100/(h+100)); ap = (-a/(-a+100)) if a < 0 else (100/(a+100))
    return hp/(hp+ap) if (hp+ap) else np.nan

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0])
    d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
od = pd.concat(parts, ignore_index=True)
od["home_c"] = od.home_team.map(to_cfbd); od["away_c"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home_c", "away_c"])
# consensus per (game, snapshot)
snap = od.groupby(["season", "game_id", "snapshot", "home_c", "away_c"]).agg(
    spread=("spread_home", "median"), total=("total", "median"),
    hml=("home_ml", "median"), aml=("away_ml", "median"), hrs=("hrs_to_kick", "max")).reset_index()
snap["novig"] = [novig(h, a) for h, a in zip(snap.hml, snap.aml)]

TARGETS = {"open": 999, "h72": 72, "h24": 24, "h6": 6, "close": 0}
rows = []
for gid, d in snap.groupby("game_id"):
    d = d[d.hrs >= 0]
    if d.empty: continue
    rec = {"season": d.season.iloc[0], "home": d.home_c.iloc[0], "away": d.away_c.iloc[0], "game_id": gid}
    for name, tgt in TARGETS.items():
        if name == "open":
            row = d.loc[d.hrs.idxmax()]
        elif name == "close":
            row = d.loc[d.hrs.idxmin()]
        else:
            row = d.iloc[(d.hrs - tgt).abs().argmin()]
        rec[f"sp_{name}"] = row.spread; rec[f"tot_{name}"] = row.total; rec[f"ml_{name}"] = row.novig
        rec[f"hrs_{name}"] = row.hrs
    rows.append(rec)
fr = pd.DataFrame(rows)
mg = gm[["season", "homeTeam", "awayTeam", "actual_margin", "actual_total", "homeConference", "awayConference"]].rename(columns={"homeTeam": "home", "awayTeam": "away"})
fr = fr.merge(mg, on=["season", "home", "away"], how="inner")
out = os.path.join(HERE, "data", "movement_windows.parquet")
fr.to_parquet(out, index=False)
print(f"movement_windows: {len(fr)} games -> {out}")
print(f"  median hrs at each point: open {fr.hrs_open.median():.0f} h72 {fr.hrs_h72.median():.0f} h24 {fr.hrs_h24.median():.0f} h6 {fr.hrs_h6.median():.1f} close {fr.hrs_close.median():.1f}")
