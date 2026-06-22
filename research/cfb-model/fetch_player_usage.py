"""
Full per-player usage per team-game from /games/players, 2021-2025 (+ postseason for opt-outs).
Long format: one row per player per team-game with carries / receptions / targets / yards.
Enables GENUINE absence detection (established star records ~0 usage = out / opt-out).
-> data/cfbd/player_usage.parquet
"""
import os
import pandas as pd
import cfbd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2021, 2022, 2023, 2024, 2025]


def _num(x):
    try:
        return int(str(x).split("/")[0])
    except Exception:
        try:
            return float(x)
        except Exception:
            return 0


def main():
    out = os.path.join(DATA, "player_usage.parquet")
    if os.path.exists(out):
        print("cached"); return
    rows = []
    for y in YEARS:
        for st in ("regular", "postseason"):
            for wk in range(1, 16):
                try:
                    games = cfbd.get("/games/players", year=y, week=wk, seasonType=st)
                except Exception:
                    continue
                for g in games:
                    gid = g.get("id")
                    for t in g.get("teams", []):
                        team = t.get("team")
                        # gather per-player stat dicts by category
                        rush, recv = {}, {}
                        for cat in t.get("categories", []):
                            nm = cat.get("name")
                            if nm not in ("rushing", "receiving"):
                                continue
                            for typ in cat.get("types", []):
                                tn = typ["name"]
                                for a in typ.get("athletes", []):
                                    d = (rush if nm == "rushing" else recv).setdefault(a["name"], {})
                                    d[tn] = a["stat"]
                        players = set(rush) | set(recv)
                        for p in players:
                            r, rc = rush.get(p, {}), recv.get(p, {})
                            rows.append({
                                "season": y, "season_type": st, "week": wk, "game_id": gid, "team": team,
                                "player": p,
                                "car": _num(r.get("CAR", 0)), "rush_yds": _num(r.get("YDS", 0)),
                                "rec": _num(rc.get("REC", 0)), "rec_yds": _num(rc.get("YDS", 0)),
                                "tar": _num(rc.get("TAR", 0)),
                            })
                if st == "postseason":
                    break  # postseason isn't weekly-indexed the same; one pass
        print(f"  {y}: {len(rows)} rows")
    df = pd.DataFrame(rows).drop_duplicates(["season", "week", "game_id", "team", "player"])
    df.to_parquet(out, index=False)
    print(f"player_usage -> {out} ({len(df)} rows)")


if __name__ == "__main__":
    main()
