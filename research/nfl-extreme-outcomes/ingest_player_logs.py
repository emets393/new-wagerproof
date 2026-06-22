"""
NFL player game-logs ingest (task #14) — the only missing input for the prop grader.

Fetches nflverse weekly player stats (offense) -> nfl_player_game_logs. The grader
(grade_nfl_props) joins on (player_id, season, week) using GSIS ids, which nflverse
provides natively, so no id mapping is needed. Idempotent per (season[,week]): delete
+ insert. Run next-morning during the season so Thursday-night props grade by Friday AM.

Run:  python3 ingest_player_logs.py 2025        # dry-run, whole season
      python3 ingest_player_logs.py 2025 12     # dry-run, one week
      python3 ingest_player_logs.py 2025 12 --write
"""
import sys
import json
import requests
import pandas as pd
from pathlib import Path
from fetch import fetch_table

ROOT = Path(__file__).resolve().parent
BASE = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
WRITE = "--write" in sys.argv
_args = [a for a in sys.argv[1:] if not a.startswith("--")]
SEASON = int(_args[0]) if _args else 2025
WEEK = int(_args[1]) if len(_args) > 1 else None

# nflverse offense weekly stats column -> nfl_player_game_logs column
COLMAP = {
    "player_id": "player_id", "player_display_name": "player_name", "position": "position",
    "team": "team", "opponent_team": "opponent", "season": "season", "week": "week",
    "completions": "completions", "attempts": "pass_attempts", "passing_yards": "pass_yds",
    "passing_tds": "pass_tds", "passing_interceptions": "interceptions", "carries": "carries",
    "rushing_yards": "rush_yds", "rushing_tds": "rush_tds", "targets": "targets",
    "receptions": "receptions", "receiving_yards": "rec_yds", "receiving_tds": "rec_tds",
}
INT_COLS = ["completions", "pass_attempts", "pass_yds", "pass_tds", "interceptions",
            "carries", "rush_yds", "rush_tds", "targets", "receptions", "rec_yds", "rec_tds"]


def player_stats_off(season):
    """nflverse weekly player stats for one season (GSIS player_id). The release moved to
    stats_player/stats_player_week_{season}.parquet (the old combined player_stats.parquet
    froze at 2024)."""
    return pd.read_parquet(
        f"https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{season}.parquet")


def service_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("SUPABASE_SERVICE_KEY not found in .env.local")


def main():
    ps = player_stats_off(SEASON)
    missing = [c for c in COLMAP if c not in ps.columns]
    if missing:
        print(f"[!] nflverse columns missing: {missing}")
        print(f"    available sample: {sorted(ps.columns)[:40]}")
    ps = ps[ps["season"] == SEASON].copy()
    if WEEK is not None:
        ps = ps[ps["week"] == WEEK]
    # offense skill positions only (the prop-relevant players). The new nflverse file
    # bundles defense/ST; the grader's player_id join would ignore them, but we keep the
    # table lean and matching the original backfill's shape.
    if "position" in ps.columns:
        ps = ps[ps["position"].isin(["QB", "RB", "WR", "TE", "FB"])]
    print(f"[pull] nflverse offense rows for {SEASON}" + (f" wk{WEEK}" if WEEK else "") + f": {len(ps)}")

    out = ps[[c for c in COLMAP if c in ps.columns]].rename(columns=COLMAP)
    for c in INT_COLS:
        if c in out.columns:
            out[c] = pd.to_numeric(out[c], errors="coerce").fillna(0).astype(int)
    # anytime_td is a GENERATED column in nfl_player_game_logs (DB derives it from
    # rush_tds + rec_tds) — it must NOT be inserted.
    out = out[out["player_id"].notna()]

    # compare to the existing backfill so we know the source + mapping line up
    existing = fetch_table("nfl_player_game_logs", select="player_id,season,week")
    existing = existing[existing.season == SEASON]
    if WEEK is not None:
        existing = existing[existing.week == WEEK]
    print(f"[compare] ingest rows: {len(out)};  existing logs rows: {len(existing)}")
    print("[per-week] ingest vs existing:")
    iw = out.groupby("week").size()
    ew = existing.groupby("week").size()
    cmp = pd.DataFrame({"ingest": iw, "existing": ew}).fillna(0).astype(int)
    print(cmp.to_string())

    if not WRITE:
        print("\n[dry-run] no writes. Re-run with --write once counts line up.")
        return

    k = service_key()
    hdr = {"apikey": k, "Authorization": f"Bearer {k}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    for w in sorted(out["week"].unique()):
        wk = out[out["week"] == w]
        # JSON via to_json: NaN -> null and numpy scalars -> native (PostgREST rejects both raw)
        recs = json.loads(wk.to_json(orient="records"))
        # idempotent: delete the (season, week) slice, then insert fresh
        requests.delete(f"{BASE}/nfl_player_game_logs?season=eq.{SEASON}&week=eq.{int(w)}",
                        headers=hdr, timeout=60).raise_for_status()
        for i in range(0, len(recs), 500):
            r = requests.post(f"{BASE}/nfl_player_game_logs", headers=hdr,
                              json=recs[i:i + 500], timeout=120)
            if not r.ok:
                print(f"  POST {r.status_code}: {r.text[:400]}")
                print(f"  sample record: {recs[i] if recs else None}")
                r.raise_for_status()
        print(f"  wrote {len(recs)} logs for {SEASON} wk{int(w)}")


if __name__ == "__main__":
    main()
