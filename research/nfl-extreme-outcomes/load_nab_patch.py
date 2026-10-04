"""Load per-game META (coach + normalized playing surface, nflverse schedules, all seasons)
+ 1H half scores (quarter_scores, 2023-25) into the _nab_patch staging table, keyed on nflverse
game_id. refresh_nfl_analysis_base() LEFT JOINs this to fill coach/opp_coach/surface on the
exploded rows (those aren't in nfl_slate_games), so the live-season append gets them too.
Idempotent UPSERT on game_id. Run before the refresh RPC (wired into grade_week.sh)."""
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
    resp = requests.get(GAMES_CSV, timeout=90)
    resp.raise_for_status()   # an error page would otherwise parse into a coach-less frame
    g = pd.read_csv(io.StringIO(resp.text))
    g = g[g.season >= 2018][["game_id", "home_coach", "away_coach", "surface"]].dropna(subset=["game_id"])
    g["surface"] = g["surface"].map(norm_surface)
    # 1H half scores — 2023-25 (null for older games; coach/surface still apply).
    # quarter_scores.parquet is a local research artifact that does NOT exist on Render's
    # ephemeral disk — degrade to coach/surface-only rather than crash the grade run.
    qsp = DATA / "quarter_scores.parquet"
    have_h1 = qsp.exists()
    if have_h1:
        qs = pd.read_parquet(qsp)[["game_id", "h1_home", "h1_away"]]
    else:
        print("[nab_patch] quarter_scores.parquet absent (ephemeral env) — h1 left as stored")
        qs = pd.DataFrame(columns=["game_id", "h1_home", "h1_away"])
    patch = g.merge(qs, on="game_id", how="left")
    for c in ("h1_home", "h1_away"):
        patch[c] = patch[c].astype("Int64")           # nullable int (NaN -> <NA>)
    patch = patch.astype(object).where(pd.notna(patch), None)
    print(f"patch rows: {len(patch)} | with coach: {patch.home_coach.notna().sum()} | "
          f"with surface: {patch.surface.notna().sum()} | with h1: {patch.h1_home.notna().sum()}")

    k = key()
    hdr = {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json",
           "Prefer": "return=minimal,resolution=merge-duplicates"}
    recs = json.loads(patch.to_json(orient="records"))

    # UPSERT on game_id, no delete. The old delete-all ran
    # `DELETE /_nab_patch?game_id=neq.__none__` — a whole-table wipe whose cost grows with
    # the table, and at 2,499 rows it blew the 60s read timeout and failed the entire
    # nfl-cfb-grade-daily run (2026-10-04 16:05, ReadTimeout). Nothing here needs a wipe:
    # game_id is unique, the source is nflverse schedules, and schedules only ever gain
    # games. An upsert is also restartable, where delete-then-insert leaves the table EMPTY
    # if the insert dies in the middle. See .claude memory `postgrest-slate-write-laws`.
    if not have_h1:
        # Never overwrite good h1 values with nulls. quarter_scores.parquet does not exist on
        # Render, so every scheduled run shipped h1_home/h1_away = null and the wipe-and-
        # insert made that stick. PostgREST builds its column list from the payload keys, so
        # dropping these two keys leaves whatever is already stored untouched.
        for r in recs:
            r.pop("h1_home", None)
            r.pop("h1_away", None)
        print("  [nab_patch] h1 columns omitted from the payload — existing values preserved")

    for i in range(0, len(recs), 500):
        chunk = recs[i:i + 500]
        for attempt in range(3):
            try:
                r = requests.post(f"{BASE}/_nab_patch", headers=hdr, json=chunk, timeout=120)
                break
            except requests.exceptions.RequestException as e:
                if attempt == 2:
                    sys.exit(f"upsert {i}: {type(e).__name__} after 3 tries: {e}")
                print(f"  [nab_patch] chunk {i} {type(e).__name__} — retry {attempt + 1}/2")
        if r.status_code not in (200, 201, 204):
            sys.exit(f"upsert {i}: {r.status_code} {r.text[:300]}")
    print(f"upserted {len(recs)} rows -> _nab_patch")


if __name__ == "__main__":
    main()
