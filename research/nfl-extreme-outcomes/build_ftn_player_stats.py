"""FTN-derived player stats for the prop pages (locked groupings, 2026-08-05).

Joins FTN charting flags onto scheme_plays (game_id+play_id) and aggregates career
2022-2025 per player -> data/nfl_ftn_player_stats.parquet:

  receivers: drop_rate           = drops / catchable targets
             contested_catch_rate = contested receptions / contested targets
             created_rate         = charted "created receptions" / receptions
  QBs:       pa_rate              = play-action dropbacks / dropbacks
             int_worthy_rate      = interception-worthy throws / dropbacks

Plus CURRENT-ROLE red-zone shares from full PBP (2025 season):
             rz_tgt_share         = player RZ targets / team RZ targets
             rz_carry_share       = player RZ carries / team RZ carries
"""
import pandas as pd
import numpy as np
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"

sp = pd.read_parquet(DATA / "scheme_plays.parquet")
ftn = pd.read_parquet(DATA / "ftn_charting.parquet")[
    ["game_id", "play_id", "is_drop", "is_contested_ball", "is_catchable_ball",
     "is_created_reception", "is_play_action", "is_interception_worthy"]]
m = sp.merge(ftn, on=["game_id", "play_id"], how="left")

# ---- receivers (targeted plays) ----
tg = m[m.receiver_player_id.notna()].copy()
for c in ("is_drop", "is_contested_ball", "is_catchable_ball", "is_created_reception"):
    tg[c] = tg[c].fillna(False).astype(bool)
tg["caught"] = tg.complete_pass == 1
rec = tg.groupby("receiver_player_id").apply(lambda d: pd.Series(dict(
    targets=len(d),
    drop_rate=(d.is_drop.sum() / max(d.is_catchable_ball.sum(), 1)),
    contested_catch_rate=(d[d.is_contested_ball].caught.mean()
                          if d.is_contested_ball.sum() >= 1 else np.nan),
    contested_n=int(d.is_contested_ball.sum()),
    created_rate=(d[d.caught].is_created_reception.mean() if d.caught.sum() >= 1 else np.nan),
))).reset_index().rename(columns={"receiver_player_id": "player_id"})

# ---- QBs (dropbacks) ----
db = m[(m.qb_dropback == 1) & m.passer_player_id.notna()].copy()
for c in ("is_play_action", "is_interception_worthy"):
    db[c] = db[c].fillna(False).astype(bool)
qb = db.groupby("passer_player_id").apply(lambda d: pd.Series(dict(
    dropbacks=len(d),
    pa_rate=d.is_play_action.mean(),
    int_worthy_rate=d.is_interception_worthy.mean(),
))).reset_index().rename(columns={"passer_player_id": "player_id"})

out = rec.merge(qb, on="player_id", how="outer")

# ---- red-zone role shares (2025, current role) ----
pb = pd.read_parquet(DATA / "pbp_cache" / "pbp_2025.parquet",
                     columns=["posteam", "yardline_100", "receiver_player_id",
                              "rusher_player_id", "pass_attempt", "rush_attempt", "season_type"])
pb = pb[(pb.season_type == "REG") & (pb.yardline_100 <= 20)]
rz_t = pb[(pb.pass_attempt == 1) & pb.receiver_player_id.notna()]
team_t = rz_t.groupby("posteam").size()
ply_t = rz_t.groupby(["posteam", "receiver_player_id"]).size().reset_index(name="n")
ply_t["rz_tgt_share"] = ply_t.n / ply_t.posteam.map(team_t)
rz_r = pb[(pb.rush_attempt == 1) & pb.rusher_player_id.notna()]
team_r = rz_r.groupby("posteam").size()
ply_r = rz_r.groupby(["posteam", "rusher_player_id"]).size().reset_index(name="n")
ply_r["rz_carry_share"] = ply_r.n / ply_r.posteam.map(team_r)

out = out.merge(ply_t.rename(columns={"receiver_player_id": "player_id"})[["player_id", "rz_tgt_share"]]
                .groupby("player_id").rz_tgt_share.max().reset_index(), on="player_id", how="outer")
out = out.merge(ply_r.rename(columns={"rusher_player_id": "player_id"})[["player_id", "rz_carry_share"]]
                .groupby("player_id").rz_carry_share.max().reset_index(), on="player_id", how="outer")

out.to_parquet(DATA / "nfl_ftn_player_stats.parquet", index=False)
q = out[out.targets.fillna(0) >= 100]
print(f"{len(out)} players | receivers>=100tgt {len(q)} | drop_rate med {q.drop_rate.median():.3f} "
      f"| contested med {q.contested_catch_rate.median():.2f} | QBs {out.dropbacks.notna().sum()}")
