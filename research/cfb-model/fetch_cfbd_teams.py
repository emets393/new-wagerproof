"""
Pull /games/teams (team box scores) per season -> tendencies + pressure + tempo.
Flatten the stats list into columns we need for the over/shootout hypothesis.
-> data/cfbd/teamgame_box_<year>.parquet
"""
import os
import pandas as pd
import cfbd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]


def pace_secs(mmss):
    try:
        m, s = str(mmss).split(":"); return int(m) * 60 + int(s)
    except Exception:
        return None


def att(comp_att):
    # "20-29" -> attempts 29
    try:
        return int(str(comp_att).split("-")[1])
    except Exception:
        return None


def comp(comp_att):
    try:
        return int(str(comp_att).split("-")[0])
    except Exception:
        return None


def main():
    for y in YEARS:
        out = os.path.join(DATA, f"teamgame_box_{y}.parquet")
        if os.path.exists(out):
            print(f"  box {y}: cached"); continue
        rows = []
        games = []
        for wk in range(1, 16):
            try:
                games += cfbd.get("/games/teams", year=y, week=wk)
            except Exception:
                pass
        for gobj in games:
            gid = gobj.get("id")
            for t in gobj.get("teams", []):
                s = {x["category"]: x["stat"] for x in t.get("stats", [])}
                pa = att(s.get("completionAttempts"))
                ra = pd.to_numeric(s.get("rushingAttempts"), errors="coerce")
                plays = (pa or 0) + (ra or 0)
                rows.append({
                    "season": y, "game_id": gid, "team": t.get("team"),
                    "home_away": t.get("homeAway"), "points": t.get("points"),
                    "pass_att": pa, "rush_att": ra,
                    "pass_yds": pd.to_numeric(s.get("netPassingYards"), errors="coerce"),
                    "rush_yds": pd.to_numeric(s.get("rushingYards"), errors="coerce"),
                    "plays": plays if plays else None,
                    "poss_secs": pace_secs(s.get("possessionTime")),
                    "sacks": pd.to_numeric(s.get("sacks"), errors="coerce"),
                    "qb_hurries": pd.to_numeric(s.get("qbHurries"), errors="coerce"),
                    "tfl": pd.to_numeric(s.get("tacklesForLoss"), errors="coerce"),
                    "turnovers": pd.to_numeric(s.get("turnovers"), errors="coerce"),
                    "first_downs": pd.to_numeric(s.get("firstDowns"), errors="coerce"),
                })
        pd.DataFrame(rows).to_parquet(out, index=False)
        print(f"  box {y}: {len(rows)} team-game rows")


if __name__ == "__main__":
    main()
