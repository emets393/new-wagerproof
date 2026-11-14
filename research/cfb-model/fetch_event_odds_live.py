"""
Materialize ncaaf_event_odds (DB) -> data/event_odds/events_<season>.parquet for build_odds_frame.

The NFL pattern: the DB table is the persistent source of truth (written hourly by
live_odds_cfb_1h.py), and this renders it to the parquet the CFB build already reads — so the
build is unchanged. Run in run_cfb_week.sh BEFORE build_odds_frame, in place of the historical
fetch_event_odds.py (which stays as the past-seasons backfill tool).

⛔ THIS STEP KILLED THE WHOLE CFB SLATE FOR THREE DAYS (2026-10-17 → 10-19). It used to collect
every row of the season into a Python list of dicts and only then build the DataFrame. The table
is written HOURLY all season, so it only grows: by 2026 wk8 it held 1,601,500 rows, and 1.6M
13-key dicts is over 2Gi — the job OOMed on `plan: standard` in both cfb-slate-weekly and
cfb-slate-refresh, at the identical step, before either could build week 8. `cfb_slate_feed`
hides played games, so an unbuilt week is not a stale board on the site, it is an EMPTY one.
Nothing shipped CFB predictions until this was fixed. The rows are now streamed to the parquet a
page at a time and never all held at once, so the cost is flat in season length rather than
growing into the ceiling again every October.

Two details that are load-bearing, not tidying:
  - KEYSET pagination on `id`, not `offset`. PostgREST caps a page at 10,000 rows, so this is 161
    requests instead of 1,601, and OFFSET makes the server re-scan the skipped rows every time,
    which is what made the doomed run take nine minutes to reach its own OOM.
  - An EXPLICIT pyarrow schema. Writing page-by-page means each page is converted on its own, and
    a page where every `point` happens to be null infers as pa.null() and then fails to append to
    a writer opened on a double column. Declaring the schema up front makes every page match.

Run:  python3 fetch_event_odds_live.py [SEASON]
"""
import os
import sys
import datetime as dt
from pathlib import Path
import requests
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

HERE = Path(__file__).resolve().parent
OUTD = HERE / "data" / "event_odds"
OUTD.mkdir(parents=True, exist_ok=True)
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
_today = dt.date.today()
SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else (_today.year if _today.month >= 3 else _today.year - 1)

PAGE = 10000            # PostgREST's own ceiling; a larger limit is silently clamped to this
# the parquet shape fetch_event_odds.py writes, which build_odds_frame and gen_cfb_slate_games
# read positionally-by-name — do not reorder without changing those.
COLS = ["season", "game_id", "home", "away", "snap_tag", "snap",
        "book", "market", "name", "description", "price", "point"]
_STR = pa.string()
SCHEMA = pa.schema([("season", pa.int64()), ("game_id", pa.int64()),
                    ("home", _STR), ("away", _STR), ("snap_tag", _STR), ("snap", _STR),
                    ("book", _STR), ("market", _STR), ("name", _STR), ("description", _STR),
                    ("price", pa.float64()), ("point", pa.float64())])


def key():
    if os.environ.get("SUPABASE_SERVICE_KEY"):
        return os.environ["SUPABASE_SERVICE_KEY"]
    for line in (HERE.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("SUPABASE_SERVICE_KEY not found")


def _page_to_table(batch):
    """One page of rows -> an arrow table on SCHEMA, matching the old frame's dtypes exactly."""
    df = pd.DataFrame(batch).rename(columns={"snap_ts": "snap"})
    df["snap_tag"] = "live"
    for c in COLS:                      # a page can legitimately lack an all-null column
        if c not in df.columns:
            df[c] = None
    df = df[COLS]
    df["season"] = pd.to_numeric(df.season, errors="coerce").astype("Int64")
    df["game_id"] = pd.to_numeric(df.game_id, errors="coerce").astype("Int64")
    for c in ("price", "point"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    for c in ("home", "away", "snap_tag", "snap", "book", "market", "name", "description"):
        df[c] = df[c].astype("string")
    return pa.Table.from_pandas(df, schema=SCHEMA, preserve_index=False)


def main():
    hdr = {"apikey": key(), "Authorization": f"Bearer {key()}"}
    fp = OUTD / f"events_{SEASON}.parquet"
    tmp = fp.with_suffix(".parquet.tmp")    # never leave a half-written parquet where the build reads
    writer, total, last_id, pages = None, 0, None, 0
    try:
        while True:
            q = {"select": ",".join(["id", "season", "game_id", "home", "away", "snap_ts",
                                     "book", "market", "name", "description", "price", "point"]),
                 "season": f"eq.{SEASON}", "order": "id.asc", "limit": PAGE}
            if last_id is not None:
                q["id"] = f"gt.{last_id}"
            r = requests.get(f"{SUPA}/ncaaf_event_odds", params=q, headers=hdr, timeout=120)
            r.raise_for_status()
            batch = r.json()
            if not batch:
                break
            last_id = batch[-1]["id"]
            tbl = _page_to_table(batch)
            if writer is None:
                writer = pq.ParquetWriter(tmp, SCHEMA, compression="snappy")
            writer.write_table(tbl)
            total += len(batch)
            pages += 1
            done = len(batch) < PAGE
            del batch, tbl
            if pages % 25 == 0:
                print(f"  [fetch_event_odds_live] {total:,} rows streamed...")
            if done:
                break
        if writer is None:
            # no rows for the season: preserve the schema-less 0-row parquet the consumers
            # already special-case ("preseason collector writes a schema-less 0-row parquet")
            pd.DataFrame().to_parquet(tmp, index=False)
        else:
            writer.close()
            writer = None
        os.replace(tmp, fp)
    finally:
        if writer is not None:
            writer.close()
        if tmp.exists():
            tmp.unlink()
    print(f"[fetch_event_odds_live] {total} rows ({SEASON}) -> {fp}")


if __name__ == "__main__":
    main()
