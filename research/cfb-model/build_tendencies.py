"""
Season-to-date team TENDENCIES (as-of each week, leak-safe) from /games/teams box scores.
For the shootout/over hypothesis: pass-heaviness, tempo, and pressure generated/allowed.

Output: data/tendencies_asof.parquet  (season, asof_week, team, <tendency cols>)
  pass_rate         : pass_att / (pass_att + rush_att)  [offensive pass-heaviness]
  plays_pg          : plays per game  [tempo / pace]
  pressure_pg       : (sacks + qb_hurries) per game BY this team's defense
  pressure_allowed_pg: sacks allowed (proxy from opponent) -- approx via own offense being sacked
  pass_yds_pg / points_pg / first_downs_pg
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]


def main():
    box_frames, wk_frames = [], []
    for y in YEARS:
        p = os.path.join(DATA, f"teamgame_box_{y}.parquet")
        if not os.path.exists(p):
            print(f"  missing {p}"); continue
        box_frames.append(pd.read_parquet(p))
        g = pd.read_parquet(os.path.join(DATA, f"games_{y}.parquet"))
        g["season"] = y
        wk_frames.append(g[["id", "season", "week"]].rename(columns={"id": "game_id"}))
    box = pd.concat(box_frames, ignore_index=True)
    wk = pd.concat(wk_frames, ignore_index=True)
    box = box.merge(wk, on=["season", "game_id"], how="left")
    box = box.dropna(subset=["week"]).sort_values(["season", "team", "week"])

    # per-game derived
    box["pass_rate_g"] = box["pass_att"] / (box["pass_att"] + box["rush_att"])
    box["pressure_g"] = box[["sacks", "qb_hurries"]].sum(axis=1, min_count=1)

    rows = []
    for (season, team), d in box.groupby(["season", "team"]):
        d = d.sort_values("week")
        for asof in range(1, int(d["week"].max()) + 1):
            w = d[d["week"] <= asof]
            if len(w) == 0:
                continue
            rows.append({
                "season": season, "asof_week": asof, "team": team,
                "pass_rate": w["pass_rate_g"].mean(),
                "plays_pg": w["plays"].mean(),
                "pressure_pg": w["pressure_g"].mean(),
                "pass_yds_pg": w["pass_yds"].mean(),
                "points_pg": w["points"].mean(),
                "first_downs_pg": w["first_downs"].mean(),
                "poss_secs_pg": w["poss_secs"].mean(),
            })
    out = pd.DataFrame(rows)
    outp = os.path.join(HERE, "data", "tendencies_asof.parquet")
    out.to_parquet(outp, index=False)
    print(f"tendencies_asof: {len(out)} rows ({out['team'].nunique()} teams) -> {outp}")
    print(out[["pass_rate", "plays_pg", "pressure_pg", "points_pg"]].describe().round(2).to_string())


if __name__ == "__main__":
    main()
