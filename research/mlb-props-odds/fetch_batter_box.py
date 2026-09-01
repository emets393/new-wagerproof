"""Backfill batter box-score actuals for 2023-2025 from MLB StatsAPI (free, no credits) so
historical batter props can be graded. Our mlb_batter_logs is 2026-only; pitcher_logs is
multi-season already. Writes data/batterbox/<game_pk>.json.gz (resumable) then a parquet.

Usage: python3 fetch_batter_box.py            # fetch all 2023-2025 completed games
       python3 fetch_batter_box.py --load     # parse cache -> parquet
"""
import argparse, gzip, json, sys, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "data" / "batterbox"
CACHE.mkdir(parents=True, exist_ok=True)


def env(k):
    for l in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if l.startswith(k + "="):
            return l.split("=", 1)[1].strip()
    sys.exit(f"{k} missing")


def game_list():
    """game_pks + season + official_date for 2023-2025 completed regular games (from Supabase)."""
    key = env("SUPABASE_SERVICE_KEY")
    url = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/mlb_schedule"
    H = {"apikey": key, "Authorization": f"Bearer {key}"}
    out = []
    for season in (2023, 2024, 2025):
        off = 0
        while True:
            r = requests.get(url, headers={**H, "Range-Unit": "items", "Range": f"{off}-{off+999}"},
                             params={"select": "game_pk,official_date,season", "season": f"eq.{season}",
                                     "game_type": "eq.R", "home_score": "not.is.null"}, timeout=45)
            b = r.json()
            if not b:
                break
            out.extend(b)
            if len(b) < 1000:
                break
            off += 1000
    return out


def fetch():
    games = game_list()
    print(f"{len(games)} games to consider", flush=True)
    sess = requests.Session()
    todo = [g for g in games if not (CACHE / f"{g['game_pk']}.json.gz").exists()]
    print(f"{len(todo)} to fetch", flush=True)
    for i, g in enumerate(todo):
        gp = g["game_pk"]
        for attempt in range(5):
            try:
                r = sess.get(f"https://statsapi.mlb.com/api/v1/game/{gp}/boxscore", timeout=30)
                if r.status_code == 200:
                    (CACHE / f"{gp}.json.gz").write_bytes(gzip.compress(r.content))
                    break
                time.sleep(2 * (attempt + 1))
            except requests.RequestException:
                time.sleep(3 * (attempt + 1))
        if i % 200 == 0:
            print(f"  {i}/{len(todo)}", flush=True)
        time.sleep(0.05)
    print("FETCH DONE", flush=True)


def load():
    import pandas as pd
    meta = {g["game_pk"]: g for g in game_list()}
    rows = []
    for f in CACHE.glob("*.json.gz"):
        gp = int(f.name.split(".")[0])
        m = meta.get(gp, {})
        d = json.loads(gzip.decompress(f.read_bytes()))
        for side in ("away", "home"):
            for _, p in d.get("teams", {}).get(side, {}).get("players", {}).items():
                b = p.get("stats", {}).get("batting", {})
                if not b or b.get("gamesPlayed") != 1:
                    continue
                per = p["person"]
                h = b.get("hits", 0); r_ = b.get("runs", 0); rbi = b.get("rbi", 0)
                rows.append((gp, m.get("season"), m.get("official_date"), per["id"], per["fullName"],
                             b.get("plateAppearances", 0), b.get("atBats", 0), h,
                             b.get("doubles", 0), b.get("triples", 0), b.get("homeRuns", 0),
                             b.get("totalBases", 0), rbi, r_, b.get("baseOnBalls", 0),
                             b.get("strikeOuts", 0), b.get("stolenBases", 0), h + r_ + rbi))
    cols = ["game_pk", "season", "official_date", "player_id", "player_name", "plate_appearances",
            "at_bats", "hits", "doubles", "triples", "home_runs", "total_bases", "rbi", "runs",
            "walks", "strikeouts", "stolen_bases", "hits_runs_rbis"]
    df = pd.DataFrame(rows, columns=cols)
    df.to_parquet(ROOT / "data" / "parquet" / "batter_box_hist.parquet", index=False)
    print(f"{len(df):,} batter-game rows, {df.game_pk.nunique():,} games", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--load", action="store_true")
    a = ap.parse_args()
    load() if a.load else fetch()
