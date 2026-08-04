"""Current-season PRESEASON power ratings (SP+/FPI/FEI) -> patch priors.parquet.

Owner-identified gap (2026-08-04): our priors used LAST season's final SP+ — blind to
portal rebuilds (OSU: stale -15.1 vs preseason +7.1; preseason-implied OSU@Tulsa ≈ -12.2
vs market -12.5). cfbtxt.com publishes the current year's preseason FEI/SP+/FPI as CSV
(2026 verified: 138 teams, 100% CFBD name match). Only the CURRENT season is hosted —
historical preseason archives are ESPN+-locked, so past-season priors stay prior-year
finals (documented in FOOTBALL_PROFILES.md).

Patches season-CURRENT rows of data/priors.parquet: prior_sp <- sp_plus, prior_fpi <- fpi
(off/def splits unavailable preseason -> untouched). Idempotent; runner-safe (|| true).
"""
import sys
import requests
import pandas as pd
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
URL = f"https://cfbtxt.com/data/ratings_preseason_{SEASON}.csv"


def main():
    r = requests.get(URL, timeout=30)
    if r.status_code != 200 or not r.text.startswith('"team"'):
        print(f"[preseason] {SEASON}: not available at {URL} — priors unchanged")
        return
    csv_path = HERE / "data" / "cfbd" / f"preseason_ratings_{SEASON}.csv"
    csv_path.write_text(r.text)
    ps = pd.read_csv(csv_path)[["team", "sp_plus", "fpi"]]
    pri = pd.read_parquet(HERE / "data" / "priors.parquet")
    m = pri.season == SEASON
    before = pri.loc[m].set_index("team").prior_sp
    upd = pri.loc[m, "team"].map(ps.set_index("team").sp_plus)
    updf = pri.loc[m, "team"].map(ps.set_index("team").fpi)
    pri.loc[m, "prior_sp"] = upd.fillna(pri.loc[m, "prior_sp"])
    pri.loc[m, "prior_fpi"] = updf.fillna(pri.loc[m, "prior_fpi"])
    pri.to_parquet(HERE / "data" / "priors.parquet", index=False)
    n = upd.notna().sum()
    big = (upd - pri.loc[m, "team"].map(before)).abs().nlargest(3)
    print(f"[preseason] {SEASON}: patched {n} teams' prior_sp/fpi with true preseason ratings")


if __name__ == "__main__":
    main()
