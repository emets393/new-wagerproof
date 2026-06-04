"""
Pull per-game top RUSHER and top RECEIVER per team from /games/players, 2021-2025.
For detecting when a team's primary skill player is OUT (CFB analog of NFL key-player-out edge;
strongly validated by the sharp's writeups citing player availability as the unpriced edge).
-> data/cfbd/skill_usage.parquet : season, week, game_id, team, rb, rb_car, wr, wr_rec
"""
import os
import pandas as pd
import cfbd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
YEARS = [2021, 2022, 2023, 2024, 2025]


def _int(x):
    try:
        return int(str(x).split("/")[0])
    except Exception:
        try:
            return int(float(x))
        except Exception:
            return 0


def main():
    out = os.path.join(DATA, "skill_usage.parquet")
    if os.path.exists(out):
        print("cached"); return
    rows = []
    for y in YEARS:
        for wk in range(1, 16):
            try:
                games = cfbd.get("/games/players", year=y, week=wk)
            except Exception:
                continue
            for g in games:
                gid = g.get("id")
                for t in g.get("teams", []):
                    team = t.get("team")
                    rush, recv = {}, {}
                    for cat in t.get("categories", []):
                        nm = cat.get("name")
                        if nm not in ("rushing", "receiving"):
                            continue
                        ts = {}
                        for typ in cat.get("types", []):
                            for a in typ.get("athletes", []):
                                ts.setdefault(a["name"], {})[typ["name"]] = a["stat"]
                        if nm == "rushing":
                            rush = ts
                        else:
                            recv = ts
                    rb, rb_car = None, -1
                    for name, s in rush.items():
                        c = _int(s.get("CAR", 0))
                        if c > rb_car:
                            rb, rb_car = name, c
                    wr, wr_rec = None, -1
                    for name, s in recv.items():
                        r = _int(s.get("REC", 0))
                        if r > wr_rec:
                            wr, wr_rec = name, r
                    rows.append({"season": y, "week": wk, "game_id": gid, "team": team,
                                 "rb": rb, "rb_car": max(rb_car, 0), "wr": wr, "wr_rec": max(wr_rec, 0)})
        print(f"  {y}: {len(rows)} rows")
    pd.DataFrame(rows).drop_duplicates(["season", "week", "team"]).to_parquet(out, index=False)
    print(f"skill_usage -> {out}")


if __name__ == "__main__":
    main()
