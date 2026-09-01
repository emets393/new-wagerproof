"""Collapse the per-book parquet to a consensus grain (one row per event/market/player/line)
and push to Supabase mlb_player_props_hist. Consensus prices are medianed in DECIMAL space
(American odds are discontinuous at +/-100), then converted back to American. Also keeps the
best available price per side. game_pk / player_id filled by SQL after load.
"""
import glob, json, sys, time
from pathlib import Path
import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
PARQ = ROOT / "data" / "parquet"
URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/mlb_player_props_hist"


def key():
    for l in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if l.startswith("SUPABASE_SERVICE_KEY="):
            return l.split("=", 1)[1].strip()
    sys.exit("no key")


def a2d(a):
    a = pd.to_numeric(a, errors="coerce")
    return np.where(a >= 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))


def d2a(d):
    d = pd.to_numeric(d, errors="coerce")
    out = np.where(d >= 2, (d - 1) * 100.0, -100.0 / (d - 1))
    return pd.Series(np.round(out)).astype("Int64")


def build():
    frames = []
    for pf in sorted(PARQ.glob("props_*.parquet")):
        df = pd.read_parquet(pf)
        df["od"] = a2d(df["over_odds"]); df["ud"] = a2d(df["under_odds"])
        gk = ["season", "odds_event_id", "commence_time", "snapshot_ts", "home_team",
              "away_team", "market", "player_name", "is_pitcher", "line"]
        g = df.groupby(gk, sort=False)
        c = g.agg(n_books=("bookmaker", "nunique"),
                  over_dec=("od", "median"), under_dec=("ud", "median"),
                  best_over_dec=("od", "max"), best_under_dec=("ud", "max")).reset_index()
        c["over_odds"] = d2a(c["over_dec"]); c["under_odds"] = d2a(c["under_dec"])
        c["best_over_odds"] = d2a(c["best_over_dec"]); c["best_under_odds"] = d2a(c["best_under_dec"])
        c = c.drop(columns=["over_dec", "under_dec", "best_over_dec", "best_under_dec"])
        frames.append(c)
        print(f"{pf.name}: {len(df):,} book-rows -> {len(c):,} consensus rows", flush=True)
    out = pd.concat(frames, ignore_index=True)
    out.to_parquet(PARQ / "consensus.parquet", index=False)
    print(f"TOTAL consensus {len(out):,} rows", flush=True)
    return out


def push(df):
    k = key()
    H = {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json",
         "Prefer": "resolution=merge-duplicates,return=minimal"}
    df = df.astype(object).where(pd.notnull(df), None)
    recs = df.to_dict("records")
    sess = requests.Session()
    done = 0
    for i in range(0, len(recs), 2000):
        chunk = recs[i:i + 2000]
        for attempt in range(5):
            try:
                r = sess.post(URL, headers=H, data=json.dumps(chunk, default=str), timeout=60)
                if r.status_code in (200, 201, 204):
                    break
                print(f"  batch {i} status {r.status_code}: {r.text[:160]}", flush=True)
            except requests.RequestException as e:
                print(f"  batch {i} exc {e}", flush=True)
            time.sleep(3 * (attempt + 1))
        else:
            sys.exit(f"FAILED at {i}")
        done += len(chunk)
        if i % 40000 == 0:
            print(f"  pushed {done:,}/{len(recs):,}", flush=True)
    print(f"PUSH DONE {done:,} rows", flush=True)


if __name__ == "__main__":
    push(build())
