"""Fetch CFBD /player/returning + /player/portal for a season and merge into the multi-season parquets that
feed the weeks-1-3 early-roster signals (ret_prod_edge, portal_talent_influx). Idempotent: replaces that
season's rows, keeps prior seasons. Usage: python3 fetch_cfbd_roster.py [season]
(Returning production for the upcoming season loads ~August; before then CFBD returns 0 rows and we keep the
old parquet unchanged — the signals just won't fire until the data is live.)"""
import sys, os, pandas as pd
import cfbd, dry_common as C

season = int(sys.argv[1]) if len(sys.argv) > 1 else C.season_week()[0]

def merge(path, rows):
    if not rows:
        return 0
    new = pd.DataFrame(rows)
    if os.path.exists(path):
        old = pd.read_parquet(path)
        old = old[old.season != season]
        new = pd.concat([old, new], ignore_index=True)
    new.to_parquet(path, index=False)
    return len(pd.DataFrame(rows))

try:
    n1 = merge("data/cfbd/returning_production.parquet", cfbd.get("/player/returning", year=season))
except Exception as e:
    n1 = 0; print("  returning fetch err", str(e)[:80])
try:
    n2 = merge("data/cfbd/portal.parquet", cfbd.get("/player/portal", year=season))
except Exception as e:
    n2 = 0; print("  portal fetch err", str(e)[:80])
print(f"[roster] {season}: returning_production {n1} rows, portal {n2} rows"
      + ("  (returning not loaded yet — normal pre-August)" if n1 == 0 else ""))
