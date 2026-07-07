"""Stage 3 of nfl_analysis_base: load coach (nflverse schedules, all seasons) + 1H half scores
(quarter_scores, 2023-25) into the _nab_patch staging table, keyed on nflverse game_id.
A follow-up SQL UPDATE merges these into nfl_analysis_base. Idempotent (delete-all + insert)."""
import io
import json
import sys
from pathlib import Path
import pandas as pd
import requests

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
    # coach — all seasons from nflverse schedules
    g = pd.read_csv(io.StringIO(requests.get(GAMES_CSV, timeout=90).text))
    g = g[g.season >= 2018][["game_id", "home_coach", "away_coach"]].dropna(subset=["game_id"])
    # 1H half scores — 2023-25 (null for older games; coach still applies)
    qs = pd.read_parquet(DATA / "quarter_scores.parquet")[["game_id", "h1_home", "h1_away"]]
    patch = g.merge(qs, on="game_id", how="left")
    for c in ("h1_home", "h1_away"):
        patch[c] = patch[c].astype("Int64")           # nullable int (NaN -> <NA>)
    patch = patch.astype(object).where(pd.notna(patch), None)
    print(f"patch rows: {len(patch)} | with coach: {patch.home_coach.notna().sum()} | "
          f"with h1: {patch.h1_home.notna().sum()}")

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
