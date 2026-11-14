"""
Pull ELO (weekly), talent (yearly), rankings (weekly) for all seasons -> parquet.
ELO entering week W and rankings entering week W are leak-safe pregame signals.

Usage: python3 fetch_cfbd_extra.py
"""
import os
import pandas as pd
import cfbd
from cfbd_cache import live_season, stale

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "cfbd")
os.makedirs(DATA, exist_ok=True)
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
LIVE = live_season()
if LIVE not in YEARS: YEARS = YEARS + [LIVE]
WEEKS = range(1, 17)


def _merge(out, year_col, fetch_year, label):
    """Past years from the file (immutable); the live year refetched when the file is older than the cache window."""
    have = pd.read_parquet(out) if os.path.exists(out) else pd.DataFrame()
    years = YEARS if have.empty else ([LIVE] if stale(out, LIVE) else [])
    if not years:
        print(f"{label}: cached"); return
    rows = []
    for y in years: rows += fetch_year(y)
    new = pd.DataFrame(rows)
    keep = have[~have[year_col].isin(years)] if (len(have) and year_col in have.columns) else pd.DataFrame()
    pd.concat([keep, new], ignore_index=True).to_parquet(out, index=False)
    print(f"{label}: {len(new)} rows refetched for {years}, {len(keep)} kept")


def _talent(y):
    rows = []
    for r in cfbd.get("/talent", year=y):
        r["year"] = y; rows.append(r)
    return rows


def _elo(y):
    rows = []
    for w in WEEKS:
        try:
            for r in cfbd.get("/ratings/elo", year=y, week=w):
                r["asof_week"] = w; rows.append(r)
        except Exception:
            pass
    return rows


def _rankings(y):
    rows = []
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
                    rows.append({"year": y, "asof_week": w, "poll": poll["poll"], "rank": rk["rank"], "team": rk["school"]})
    return rows


def main():
    _merge(os.path.join(DATA, "talent.parquet"), "year", _talent, "talent")
    _merge(os.path.join(DATA, "elo_weekly.parquet"), "year", _elo, "elo_weekly")
    _merge(os.path.join(DATA, "rankings_weekly.parquet"), "year", _rankings, "rankings_weekly")


if __name__ == "__main__":
    main()
