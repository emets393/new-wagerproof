# Fantasy Points Data Suite warehouse (`data/fpdata/`)

**What:** every table the paid Fantasy Points Data subscription (data.fantasypoints.com)
lets our role read — passing / rushing / receiving in basic, advanced and split forms,
offense snaps, run/pass, coverage matrix, OL/DL matchups, fantasy points scored and
allowed, the weekly share reports — in every scope the tool offers: **player**, **team**
(offense) and **opponent** (defense). One row per player-game or team-game, the tool's full
column set. History starts 2021 for every family (probed 2013–2020: empty).

**Why the API, not the browser:** the site is a thin client over
`POST /v2/ds/nfl/tools/<scope>/<tool>/values` with a JSON filter body and the app's JWT in
`Authorization`. Owner wants it continuous through the season, which a browser drop cannot be.

## Pieces

| File | Role |
|---|---|
| `fp_pull.py` | catalog from `/v2/ds/all/tools`, one call per (tool, scope, season, week) → `data/fpdata/raw/<tool>/<scope>/<season>_w<week>.json`; `--consolidate` → `data/fpdata/<tool>__<scope>.parquet` |
| `fp_load.py` | raw cells → Supabase `fp_data` (CFB warehouse), LEAN: current + prior season, identity columns typed + `stats` jsonb |
| `render.yaml` `fp-data-inseason` | Tue/Thu 12:00 UTC in season: `--inseason` (last completed week ±1) then load |
| `data/fpdata/catalog.json` | the tools pulled + the private-tier tools skipped |

## Rules

- **Player scope is pulled without a position filter.** The API returns the whole roster;
  rows with no real stat (only gamesPlayed + the Yes/No filter labels) are dropped at
  consolidation and load. No assumptions about which positions a tool covers.
- **Full history = parquet, Supabase = lean.** ~1M player-game rows × ~80 fields as jsonb is
  the load size that pushed the warehouse disk read-only during the MLB props backfill; so
  `fp_load.py` defaults to `{now-1, now}` seasons. Research reads the parquet.
- **Private-tier tools** (XFP report, pressure, dropback, game logs, personnel, points per
  game, …) answer with a 5-row preview on our plan. They are recorded as skipped in the
  catalog and never pulled, so no preview stubs land in the warehouse.
- **Token:** `FP_DATA_TOKEN` (.env.local locally, `wagerproof-model-secrets` on Render) is the
  JWT the logged-in web app sends. It has no exp claim; on 401/403 the puller exits loudly —
  capture a fresh one from the request headers on any tool page.
- The API 403s browser user agents on some endpoints; the scripts use the default
  python-requests UA on purpose.
- The earlier browser-drop helpers (`fpdata_receiver.py`, `fpdata_ingest.py`) are the
  first-day manual path and are superseded by `fp_pull.py`.

## Ops

```
python3 fp_pull.py --backfill --workers 4       # 2021..now, all tools, skips cells on disk
python3 fp_pull.py --inseason && python3 fp_load.py
python3 fp_pull.py --consolidate                # rebuild the parquets from raw cells
```
