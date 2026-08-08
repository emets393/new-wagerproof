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

        # New-HC pace gaps (coach's prior-team tempo vs the new team's) -> the wk1-3
        # coach_pace_under signal (FOOTBALL_PROFILES: market overprices a new fast scheme).
        # prev school via coach_seasons; pace = mean offense.plays from last season's
        # game_advanced. NaN prev school (promoted coordinator / FCS hire) -> no gap, no flag.
        prev_sch = (cs[cs.year == SEASON - 1].sort_values("games", ascending=False)
                    .drop_duplicates("coach").set_index("coach").school)
        ga = pd.read_parquet(HERE / "data" / "cfbd" / f"game_advanced_{SEASON-1}.parquet")
        if "seasonType" in ga.columns:
            ga = ga[ga.seasonType == "regular"]
        pace = ga.groupby("team")["offense.plays"].mean()
        mv = c_now[c_now.new_hc].copy()
        mv["prev_school"] = mv.coach.map(prev_sch)
        mv["coach_prior_pace"] = mv.prev_school.map(pace)
        mv["new_prior_pace"] = mv.school.map(pace)
        mv["pace_gap"] = mv.coach_prior_pace - mv.new_prior_pace
        mv.to_parquet(HERE / "data" / "cfbd" / f"coach_moves_{SEASON}.parquet", index=False)
        _fast = mv[mv.pace_gap >= 8]
        print(f"[preseason] coach moves: {len(mv)} new HCs, {mv.pace_gap.notna().sum()} with pace gap, "
              f"{len(_fast)} fast (>=+8): {', '.join(_fast.school + ' (' + _fast.coach + ')')}")
    except Exception as e:
        print(f"[preseason] coaches fetch failed: {e}")

    # CFBD CORE ratings (context+opponent-adjusted PPA, /ratings/core, added 2026-08).
    # The endpoint serves ONLY the latest snapshot (no as-of history), so we build our
    # own as-of archive by appending a dated snapshot each weekly run — same philosophy
    # as the T-60 line captures. Backtestable in-season usage starts accruing NOW.
    try:
        import cfbd
        from datetime import date
        rows = cfbd.get("/ratings/core", year=SEASON)
        if rows:
            snap = pd.DataFrame(rows)
            snap["fetched"] = str(date.today())
            fp = HERE / "data" / "cfbd" / "core_snapshots.parquet"
            hist = pd.read_parquet(fp) if fp.exists() else pd.DataFrame()
            allx = pd.concat([hist, snap], ignore_index=True)
            allx = allx.drop_duplicates(["year", "team", "throughSeasonType", "throughWeek"], keep="first")
            allx.to_parquet(fp, index=False)
            print(f"[preseason] CORE snapshot: {len(snap)} teams "
                  f"(thru {snap.throughSeasonType.iloc[0]} wk{snap.throughWeek.iloc[0]}); "
                  f"archive {len(allx)} rows")
        else:
            print(f"[preseason] CORE: no {SEASON} rows yet (posts once the season starts)")
    except Exception as e:
        print(f"[preseason] CORE snapshot failed: {e}")


if __name__ == "__main__":
    # ORDER MATTERS (2026-08-08 incident): tr_and_coaches() writes the regime/pace/CORE
    # signal inputs and must run FIRST — main()'s priors patch used to crash on a missing
    # priors.parquet (ephemeral disk) and silently starved every canonical Render slate
    # of TR ratings, coach flags, coach moves and CORE snapshots.
    tr_and_coaches()
    main()
