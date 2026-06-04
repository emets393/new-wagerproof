"""
Load odds_history parquet -> Supabase public.ncaaf_odds_history (batched PostgREST insert).
Usage: python3 supabase_load_odds.py 2021
Idempotent-ish: deletes existing rows for that season first, then inserts.
"""
import os, sys, math
import requests
import pandas as pd
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impw"
       "eG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0"
       ".BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo")
HDRS = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
TABLE = "ncaaf_odds_history"


def main():
    yr = int(sys.argv[1])
    fp = os.path.join(HERE, "data", "odds_history", f"odds_{yr}.parquet")
    df = pd.read_parquet(fp)
    df["season"] = yr
    df["snapshot"] = df["snapshot"].astype(str)
    df["commence_time"] = df["commence_time"].astype(str)
    df = df.replace({np.nan: None})
    recs = df.to_dict("records")
    # clean NaN floats -> None
    for r in recs:
        for k, v in r.items():
            if isinstance(v, float) and math.isnan(v):
                r[k] = None
    print(f"{yr}: {len(recs)} rows to load")
    # delete existing for this season (idempotent reload)
    requests.delete(f"{SUPA}/{TABLE}?season=eq.{yr}", headers=HDRS, timeout=120)
    B = 1000
    for i in range(0, len(recs), B):
        batch = recs[i:i + B]
        for attempt in range(4):
            r = requests.post(f"{SUPA}/{TABLE}", headers={**HDRS, "Prefer": "return=minimal"}, json=batch, timeout=120)
            if r.status_code in (200, 201, 204):
                break
            if attempt == 3:
                print(f"  FAIL batch {i}: {r.status_code} {r.text[:200]}"); return
        if (i // B) % 25 == 0:
            print(f"  {i+len(batch)}/{len(recs)}")
    # verify count
    c = requests.get(f"{SUPA}/{TABLE}", headers={**HDRS, "Prefer": "count=exact", "Range": "0-0"},
                     params={"season": f"eq.{yr}", "select": "id"}, timeout=60)
    print(f"loaded. server count-range: {c.headers.get('content-range')}")


if __name__ == "__main__":
    main()
