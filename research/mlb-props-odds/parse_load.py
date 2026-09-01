"""Parse the cached historical prop gz files into (a) a per-book parquet warehouse and
(b) the Supabase table mlb_player_props_hist. game_pk / player_id are left NULL here and
filled by SQL joins after load (schedule + batter/pitcher logs live in Supabase).

Usage:
  python3 parse_load.py --parquet            # build data/parquet/props_<season>.parquet
  python3 parse_load.py --push               # push parquet -> Supabase in batches
  python3 parse_load.py --parquet --push
"""
import argparse, glob, gzip, json, os, sys, time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
PARQ = DATA / "parquet"
ET = timezone(timedelta(hours=-4))  # EDT; only used to derive official_date, DST-agnostic is fine here


def load_env(k):
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith(k + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"{k} not found in .env.local")


def parse_season(season):
    rows = []
    for f in glob.glob(str(DATA / "props" / season / "*.json.gz")):
        d = json.loads(gzip.decompress(open(f, "rb").read()))
        data = d.get("data") or {}
        if not data.get("bookmakers"):
            continue
        eid = data["id"]; ct = data["commence_time"]; snap = d.get("timestamp")
        home = data.get("home_team"); away = data.get("away_team")
        offdate = datetime.fromisoformat(ct.replace("Z", "+00:00")).astimezone(ET).date().isoformat()
        # pivot over/under by (book, market, player, line)
        acc = {}
        for b in data["bookmakers"]:
            bk = b["key"]
            for m in b.get("markets", []):
                mk = m["key"]
                for o in m.get("outcomes", []):
                    key = (bk, mk, o.get("description"), o.get("point"))
                    e = acc.setdefault(key, {"over": None, "under": None})
                    if o.get("name") == "Over":
                        e["over"] = o.get("price")
                    elif o.get("name") == "Under":
                        e["under"] = o.get("price")
        for (bk, mk, player, line), v in acc.items():
            if player is None or line is None:
                continue
            rows.append((int(season), eid, ct, snap, home, away, bk, mk, player,
                         mk.startswith("pitcher_"), float(line), v["over"], v["under"]))
    df = pd.DataFrame(rows, columns=["season", "odds_event_id", "commence_time", "snapshot_ts",
                                     "home_team", "away_team", "bookmaker", "market", "player_name",
                                     "is_pitcher", "line", "over_odds", "under_odds"])
    PARQ.mkdir(parents=True, exist_ok=True)
    out = PARQ / f"props_{season}.parquet"
    df.to_parquet(out, index=False)
    print(f"[{season}] {len(df):,} rows, {df.odds_event_id.nunique():,} events -> {out.name}", flush=True)
    return df


def push():
    url = load_env("SUPABASE_URL") if False else "https://jpxnjuwglavsjbgbasnl.supabase.co"
    key = load_env("SUPABASE_SERVICE_KEY")
    endpoint = f"{url}/rest/v1/mlb_player_props_hist"
    H = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
         "Prefer": "resolution=merge-duplicates,return=minimal"}
    sess = requests.Session()
    for pf in sorted(PARQ.glob("props_*.parquet")):
        df = pd.read_parquet(pf)
        df = df.where(pd.notnull(df), None)
        recs = df.to_dict("records")
        n = 0
        for i in range(0, len(recs), 5000):
            chunk = recs[i:i + 5000]
            for attempt in range(5):
                r = sess.post(endpoint, headers=H, data=json.dumps(chunk, default=str))
                if r.status_code in (200, 201, 204):
                    break
                time.sleep(3 * (attempt + 1))
            else:
                sys.exit(f"push failed {pf.name} @ {i}: {r.status_code} {r.text[:200]}")
            n += len(chunk)
        print(f"pushed {pf.name}: {n:,} rows", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--parquet", action="store_true")
    ap.add_argument("--push", action="store_true")
    a = ap.parse_args()
    if a.parquet:
        for s in ["2023", "2024", "2025", "2026"]:
            if list((DATA / "props" / s).glob("*.json.gz")) if (DATA / "props" / s).exists() else []:
                parse_season(s)
    if a.push:
        push()
