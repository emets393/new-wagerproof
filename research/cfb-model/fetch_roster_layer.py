"""Player-level roster layer for roster-reconstruction research (task #100).

Pulls three CFBD feeds -> data/cfbd/:
  rosters.parquet      /roster 2016-2026: every rostered player per team-year (id links across
                       years -> returning/transfer/freshman classification; recruitIds -> composite)
  recruits.parquet     /recruiting/players 2013-2026: HS composite ratings/stars/ranking
  player_ppa.parquet   /ppa/players/season 2016-2025: per-player production quality (flattened)

Portal (player-level, ratings, 2021-2026) and per-game usage (2021-2025) are already cached.
"""
import pandas as pd
import cfbd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data" / "cfbd"
ROSTER_YEARS = list(range(2016, 2027))
RECRUIT_YEARS = list(range(2013, 2027))
PPA_YEARS = [y for y in range(2016, 2026) if y != 2020]


def flat(prefix, d):
    return {f"{prefix}_{k}": v for k, v in (d or {}).items()}


def main():
    rows = []
    for y in ROSTER_YEARS:
        try:
            r = cfbd.get("/roster", year=y)
        except Exception as e:
            print(f"roster {y}: FAIL {e}"); r = []
        for p in r:
            rows.append({"season": y, "athlete_id": p.get("id"), "team": p.get("team"),
                         "first": p.get("firstName"), "last": p.get("lastName"),
                         "position": p.get("position"), "class_year": p.get("year"),
                         "height": p.get("height"), "weight": p.get("weight"),
                         "recruit_ids": ",".join(str(i) for i in (p.get("recruitIds") or []))})
        print(f"roster {y}: {len(r)}")
    pd.DataFrame(rows).to_parquet(DATA / "rosters.parquet", index=False)

    rows = []
    for y in RECRUIT_YEARS:
        try:
            r = cfbd.get("/recruiting/players", year=y)
        except Exception as e:
            print(f"recruits {y}: FAIL {e}"); r = []
        for p in r:
            rows.append({"recruit_year": y, "recruit_id": p.get("id"), "athlete_id": p.get("athleteId"),
                         "name": p.get("name"), "position": p.get("position"),
                         "committed_to": p.get("committedTo"), "stars": p.get("stars"),
                         "rating": p.get("rating"), "ranking": p.get("ranking"),
                         "recruit_type": p.get("recruitType")})
        print(f"recruits {y}: {len(r)}")
    pd.DataFrame(rows).to_parquet(DATA / "recruits.parquet", index=False)

    rows = []
    for y in PPA_YEARS:
        try:
            r = cfbd.get("/ppa/players/season", year=y)
        except Exception as e:
            print(f"ppa {y}: FAIL {e}"); r = []
        for p in r:
            rows.append({"season": y, "athlete_id": p.get("id"), "name": p.get("name"),
                         "position": p.get("position"), "team": p.get("team"),
                         **flat("avg", p.get("averagePPA")), **flat("tot", p.get("totalPPA"))})
        print(f"ppa {y}: {len(r)}")
    pd.DataFrame(rows).to_parquet(DATA / "player_ppa.parquet", index=False)
    print("done")


if __name__ == "__main__":
    main()
