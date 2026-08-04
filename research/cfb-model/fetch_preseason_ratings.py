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


def tr_and_coaches():
    """Refresh the regime-fade inputs: current TR predictive preseason ratings + the season's
    coach table w/ new-HC flags. Best-effort — regime flags silently skip if either is stale."""
    import pandas as pd
    UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    try:
        r = requests.get("https://www.teamrankings.com/college-football/ranking/predictive-by-other",
                         headers=UA, timeout=30)
        import io
        t = pd.read_html(io.StringIO(r.text))[0]
        t["tr_team"] = t.Team.str.replace(r"\s*\(\d+-\d+\)$", "", regex=True).str.strip()
        mp = pd.read_parquet(HERE / "data" / "cfbd" / "preseason_tr_mapped.parquet")[
            ["tr_team", "team"]].drop_duplicates()
        t = t.merge(mp, on="tr_team", how="left")
        t.loc[t.team.isna(), "team"] = t.tr_team   # new/renamed teams pass through
        out = t.dropna(subset=["team"])[["team", "Rating"]].rename(columns={"Rating": "tr_rating"})
        out["season"] = SEASON
        out.to_parquet(HERE / "data" / "cfbd" / f"preseason_tr_{SEASON}.parquet", index=False)
        print(f"[preseason] TR predictive: {len(out)} teams")
    except Exception as e:
        print(f"[preseason] TR fetch failed: {e}")
    try:
        import cfbd
        rows = []
        for c in cfbd.get("/coaches", year=SEASON):
            nm = f"{c.get('firstName','')} {c.get('lastName','')}".strip()
            for se in c.get("seasons", []):
                if se.get("year") == SEASON:
                    rows.append({"school": se["school"], "coach": nm, "games": se.get("games") or 0})
        c_now = pd.DataFrame(rows).sort_values("games", ascending=False).drop_duplicates("school")
        cs = pd.read_parquet(HERE / "data" / "cfbd" / "coach_seasons.parquet")
        prv = cs[cs.year == SEASON - 1].set_index("school").coach
        c_now["new_hc"] = [prv.get(s) != co for s, co in zip(c_now.school, c_now.coach)]
        c_now.to_parquet(HERE / "data" / "cfbd" / f"coaches_{SEASON}.parquet", index=False)
        print(f"[preseason] coaches: {len(c_now)} programs, {int(c_now.new_hc.sum())} new HCs")
    except Exception as e:
        print(f"[preseason] coaches fetch failed: {e}")


if __name__ == "__main__":
    main()
    tr_and_coaches()
