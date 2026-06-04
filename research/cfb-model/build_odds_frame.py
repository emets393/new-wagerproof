"""
DATA LAYER for line-movement research. From odds_history snapshots -> per-game frame:
opening line (earliest snapshot), closing line (last pre-kickoff snapshot), movement, no-vig ML, juice.
Consensus = median across books per snapshot. Joined to model_games outcomes.
-> data/odds_game_frame.parquet
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
    if o in ALIAS:
        return ALIAS[o]
    cands = [c for c in cfbd if o.startswith(c + " ") or o == c]
    cands.sort(key=len, reverse=True)
    return cands[0] if cands else None

def novig(hml, aml):
    if pd.isna(hml) or pd.isna(aml):
        return np.nan
    hp = (-hml / (-hml + 100)) if hml < 0 else (100 / (hml + 100))
    ap = (-aml / (-aml + 100)) if aml < 0 else (100 / (aml + 100))
    return hp / (hp + ap) if (hp + ap) else np.nan

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0])
    df = pd.read_parquet(f); df["season"] = yr
    parts.append(df)
od = pd.concat(parts, ignore_index=True)
od["home_c"] = od.home_team.map(to_cfbd); od["away_c"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home_c", "away_c"])

# per (game_id, snapshot) consensus across books
g = od.groupby(["season", "game_id", "snapshot", "home_c", "away_c", "commence_time"]).agg(
    spread=("spread_home", "median"), total=("total", "median"),
    home_ml=("home_ml", "median"), away_ml=("away_ml", "median"),
    sp_h_price=("spread_home_price", "median"), sp_a_price=("spread_away_price", "median"),
    hrs=("hrs_to_kick", "max"), nbooks=("book", "nunique")).reset_index()

rows = []
for gid, d in g.groupby("game_id"):
    d = d.sort_values("hrs")               # ascending hrs: first=closest to kick (close), last=furthest (open)
    close = d.iloc[0]; open_ = d.iloc[-1]
    rows.append({
        "season": close.season, "home": close.home_c, "away": close.away_c, "game_id": gid,
        "open_spread": open_.spread, "close_spread": close.spread, "spread_move": close.spread - open_.spread,
        "open_total": open_.total, "close_total": close.total, "total_move": close.total - open_.total,
        "close_home_ml": close.home_ml, "close_away_ml": close.away_ml,
        "novig_home_prob": novig(close.home_ml, close.away_ml),
        "open_novig_home": novig(open_.home_ml, open_.away_ml),
        "close_sp_h_price": close.sp_h_price, "close_sp_a_price": close.sp_a_price,
        "open_hrs": open_.hrs, "close_hrs": close.hrs, "nbooks_close": close.nbooks, "n_snaps": len(d)})
fr = pd.DataFrame(rows)

# join outcomes from model_games (season, home, away)
mg = gm[["season", "week", "homeTeam", "awayTeam", "actual_margin", "actual_total", "homeConference", "awayConference"]].rename(
    columns={"homeTeam": "home", "awayTeam": "away"})
fr = fr.merge(mg, on=["season", "home", "away"], how="inner")
fr["home_cover_close"] = (fr.actual_margin + fr.close_spread) > 0
fr["over_close"] = fr.actual_total > fr.close_total
out = os.path.join(HERE, "data", "odds_game_frame.parquet")
fr.to_parquet(out, index=False)
print(f"odds_game_frame: {len(fr)} games joined to outcomes -> {out}")
print(f"  seasons: {fr.season.value_counts().sort_index().to_dict()}")
print(f"  avg snaps/game: {fr.n_snaps.mean():.0f} | avg open_hrs: {fr.open_hrs.mean():.0f} | close_hrs: {fr.close_hrs.mean():.1f}")
print(f"  coverage: spread {fr.open_spread.notna().mean()*100:.0f}% total {fr.open_total.notna().mean()*100:.0f}% novigML {fr.novig_home_prob.notna().mean()*100:.0f}%")
print(f"  mean |spread_move| {fr.spread_move.abs().mean():.2f} | mean |total_move| {fr.total_move.abs().mean():.2f}")
