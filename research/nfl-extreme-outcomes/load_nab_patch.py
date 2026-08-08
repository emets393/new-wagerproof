"""Load per-game META (coach + normalized playing surface, nflverse schedules, all seasons)
+ 1H half scores (quarter_scores, 2023-25) into the _nab_patch staging table, keyed on nflverse
game_id. refresh_nfl_analysis_base() LEFT JOINs this to fill coach/opp_coach/surface on the
exploded rows (those aren't in nfl_dryrun_games), so the live-season append gets them too.
Idempotent (delete-all + insert). Run before the refresh RPC (wired into grade_week.sh)."""
import io
import json
import sys
from pathlib import Path
import pandas as pd
import requests


def norm_surface(s):
    # base convention: grass-family -> 'Grass', every turf variant -> 'Turf'
    if not isinstance(s, str) or not s:
        return None
    return "Grass" if "grass" in s.lower() else "Turf"

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
BASE = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
GAMES_CSV = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"


def key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found")


def main():
    # coach + surface — all seasons from nflverse schedules (games.csv carries both, incl. the
    # upcoming season once the schedule posts, so 2026 coach/surface fill as games are added)
    g = pd.read_csv(io.StringIO(requests.get(GAMES_CSV, timeout=90).text))
    g = g[g.season >= 2018][["game_id", "home_coach", "away_coach", "surface"]].dropna(subset=["game_id"])
    g["surface"] = g["surface"].map(norm_surface)
    # 1H half scores — 2023-25 (null for older games; coach/surface still apply).
    # quarter_scores.parquet is a local research artifact that does NOT exist on Render's
    # ephemeral disk — degrade to coach/surface-only rather than crash the grade run.
    qsp = DATA / "quarter_scores.parquet"
    if qsp.exists():
        qs = pd.read_parquet(qsp)[["game_id", "h1_home", "h1_away"]]
    else:
        print("[nab_patch] quarter_scores.parquet absent (ephemeral env) — h1 columns null")
        qs = pd.DataFrame(columns=["game_id", "h1_home", "h1_away"])
    patch = g.merge(qs, on="game_id", how="left")
    for c in ("h1_home", "h1_away"):
        patch[c] = patch[c].astype("Int64")           # nullable int (NaN -> <NA>)
    patch = patch.astype(object).where(pd.notna(patch), None)
    print(f"patch rows: {len(patch)} | with coach: {patch.home_coach.notna().sum()} | "
          f"with surface: {patch.surface.notna().sum()} | with h1: {patch.h1_home.notna().sum()}")

    k = key()
    hdr = {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json",
           "Prefer": "return=minimal"}
    requests.delete(f"{BASE}/_nab_patch?game_id=neq.__none__", headers=hdr, timeout=60)
    recs = json.loads(patch.to_json(orient="records"))
    for i in range(0, len(recs), 500):
        r = requests.post(f"{BASE}/_nab_patch", headers=hdr, json=recs[i:i + 500], timeout=120)
        if r.status_code not in (200, 201, 204):
            sys.exit(f"insert {i}: {r.status_code} {r.text[:300]}")
    print(f"loaded {len(recs)} rows -> _nab_patch")


if __name__ == "__main__":
    main()
