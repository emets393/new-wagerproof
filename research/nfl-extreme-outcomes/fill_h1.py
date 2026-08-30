"""
1H (halftime) finals writer — NFL + CFB. Companion to fill_finals.py (full game).
Post-game, UPDATE {nfl,cfb}_dryrun_games.h1_home/h1_away from the per-quarter sources:
  NFL <- nflverse play-by-play (end-of-Q2 cumulative score; same derivation as quarter_scores.py)
  CFB <- CFBD /games homeLineScores/awayLineScores (Q1 + Q2), keyed by CFBD game id

Once h1_* is set, ALL 1H grading unblocks with no further wiring — the pick/signal graders
(grade_{nfl,cfb}_dryrun_picks), the agent grader (football_game_results view) and the trends
appender (refresh_{nfl,cfb}_analysis_base -> h1_covered/h1_won/h1_total_over) all read h1_* off
dryrun_games. Idempotent PATCH by game_id; only writes rows where a source h1 exists.

Live source freshness: the current season's nflverse PBP file is force-refreshed each run
(games appear as they're played); CFBD /games is always a live call. Run post-game, after
fill_finals.py (wired into grade_week.sh).

Usage:  python3 fill_h1.py 2026            # dry-run: compute + report coverage
        python3 fill_h1.py 2026 --write    # PATCH h1_home/h1_away
"""
import os
import sys
from pathlib import Path

import pandas as pd
import requests

from quarter_scores import season_pbp, PBP_CACHE

ROOT = Path(__file__).resolve().parent
BASE = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
WRITE = "--write" in sys.argv
SEASON = next((int(a) for a in sys.argv[1:] if a.isdigit()), 2026)


def env(name):
    envf = ROOT.parent.parent / ".env.local"
    if envf.exists():
        for line in envf.read_text().splitlines():
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip()
    return os.environ.get(name)


def fetch_table(table, select):
    k = env("SUPABASE_SERVICE_KEY")
    r = requests.get(f"{BASE}/{table}?select={select}",
                     headers={"apikey": k, "Authorization": f"Bearer {k}"}, timeout=60)
    r.raise_for_status()
    return pd.DataFrame(r.json())


def nfl_h1(season):
    """End-of-H1 = max cumulative score within quarters 1-2 (cumulative is monotonic)."""
    fn = PBP_CACHE / f"pbp_{season}.parquet"
    if fn.exists():
        fn.unlink()   # force-refresh: the live season's PBP grows as games are played
    try:
        pbp = season_pbp(season)
    except Exception as e:
        print(f"[NFL] pbp {season} unavailable ({type(e).__name__}) — no 1H yet")
        return pd.DataFrame(columns=["game_id", "h1_home", "h1_away"])
    pbp = pbp[pbp.qtr.notna()]
    h1 = pbp[pbp.qtr <= 2].groupby("game_id")[["total_home_score", "total_away_score"]].max()
    h1.columns = ["h1_home", "h1_away"]
    return h1.reset_index()


def cfb_h1(season):
    key = env("CFBD_API_KEY")
    if not key:
        print("[CFB] CFBD_API_KEY not set — skipping CFB 1H")
        return pd.DataFrame(columns=["game_id", "h1_home", "h1_away"])
    r = requests.get("https://api.collegefootballdata.com/games",
                     params={"year": season, "seasonType": "both"},
                     headers={"Authorization": f"Bearer {key}", "Accept": "application/json"}, timeout=90)
    r.raise_for_status()
    recs = []
    for g in r.json():
        hl, al = g.get("homeLineScores"), g.get("awayLineScores")
        if hl and al and len(hl) >= 2 and len(al) >= 2:
            recs.append({"game_id": g["id"], "h1_home": int(hl[0] + hl[1]), "h1_away": int(al[0] + al[1])})
    return pd.DataFrame(recs)


def apply_h1(label, table, dg, src, hdr):
    if not len(src):
        print(f"[{label}] no source 1H rows for {SEASON}")
        return
    m = dg.merge(src, on="game_id", how="left", suffixes=("", "_src"))
    have = m[m["h1_home_src"].notna()]
    print(f"[{label}] {len(have)}/{len(dg)} dryrun games have a source 1H score")
    chk = have[have["h1_home"].notna()]
    mism = chk[(chk["h1_home"] != chk["h1_home_src"]) | (chk["h1_away"] != chk["h1_away_src"])]
    if len(mism):
        print(f"[{label}] WARN {len(mism)} existing-h1 mismatches vs source (source wins on write)")
    if WRITE and hdr is not None:
        n = 0
        for _, r in have.iterrows():
            resp = requests.patch(f"{BASE}/{table}?game_id=eq.{r.game_id}", headers=hdr,
                                  json={"h1_home": int(r.h1_home_src), "h1_away": int(r.h1_away_src)}, timeout=30)
            resp.raise_for_status()
            n += 1
        print(f"[{label}] PATCHed h1_home/h1_away on {n} games")


def main():
    hdr = None
    if WRITE:
        k = env("SUPABASE_SERVICE_KEY")
        hdr = {"apikey": k, "Authorization": f"Bearer {k}",
               "Content-Type": "application/json", "Prefer": "return=minimal"}
    print(f"=== fill_h1 :: season={SEASON} {'(write)' if WRITE else '(dry-run)'} ===")

    ndg = fetch_table("nfl_slate_games", "game_id,season,week,h1_home,h1_away")
    ndg = ndg[ndg.season == SEASON]
    apply_h1("NFL", "nfl_slate_games", ndg, nfl_h1(SEASON), hdr)

    cdg = fetch_table("cfb_slate_games", "game_id,season,week,h1_home,h1_away")
    cdg = cdg[cdg.season == SEASON]
    # cfb game_id is bigint; align dtypes for the merge
    cdg["game_id"] = cdg["game_id"].astype("int64")
    ch1 = cfb_h1(SEASON)
    if len(ch1):
        ch1["game_id"] = ch1["game_id"].astype("int64")
    apply_h1("CFB", "cfb_slate_games", cdg, ch1, hdr)

    if not WRITE:
        print("\n[dry-run] no writes. Re-run with --write once coverage looks right.")


if __name__ == "__main__":
    main()
