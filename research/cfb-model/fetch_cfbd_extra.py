"""
Pull ELO (weekly), talent (yearly), rankings (weekly) for all seasons -> parquet.
ELO entering week W and rankings entering week W are leak-safe pregame signals.

Usage: python3 fetch_cfbd_extra.py
"""
import os
import pandas as pd
import cfbd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
os.makedirs(DATA, exist_ok=True)
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
WEEKS = range(1, 17)


def main():
    # talent: one call per year
    out = os.path.join(DATA, "talent.parquet")
    if not os.path.exists(out):
        rows = []
        for y in YEARS:
            for r in cfbd.get("/talent", year=y):
                r["year"] = y
                rows.append(r)
        pd.DataFrame(rows).to_parquet(out, index=False)
        print(f"talent: {len(rows)} rows")
    else:
        print("talent: cached")

    # elo: per (year, week) = elo entering that week
    out = os.path.join(DATA, "elo_weekly.parquet")
    if not os.path.exists(out):
        rows = []
        for y in YEARS:
            for w in WEEKS:
                try:
                    for r in cfbd.get("/ratings/elo", year=y, week=w):
                        r["asof_week"] = w
                        rows.append(r)
                except Exception:
                    pass
        pd.DataFrame(rows).to_parquet(out, index=False)
        print(f"elo_weekly: {len(rows)} rows")
    else:
        print("elo_weekly: cached")

    # rankings: per (year, week), flatten AP + Coaches Top 25
    out = os.path.join(DATA, "rankings_weekly.parquet")
    if not os.path.exists(out):
        rows = []
        for y in YEARS:
            for w in WEEKS:
                try:
                    res = cfbd.get("/rankings", year=y, week=w)
                except Exception:
                    continue
                for entry in res:
                    for poll in entry.get("polls", []):
                        if poll["poll"] not in ("AP Top 25", "Coaches Poll"):
                            continue
                        for rk in poll["ranks"]:
                            rows.append({"year": y, "asof_week": w, "poll": poll["poll"],
                                         "rank": rk["rank"], "team": rk["school"]})
        pd.DataFrame(rows).to_parquet(out, index=False)
        print(f"rankings_weekly: {len(rows)} rows")
    else:
        print("rankings_weekly: cached")


if __name__ == "__main__":
    main()
