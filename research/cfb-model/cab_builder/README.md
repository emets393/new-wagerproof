# CFB analysis base — weather / dome column tooling

Target warehouse: **`jpxnjuwglavsjbgbasnl`** (`collegeFootballSupabase`). This is the
production CFB DB the live `/cfb-analytics` page reads. Main project
`gnjrklxotmbvnxbnnqgq` only holds `cfb_analysis_saved_filters` (no changes here).

## Files

| File | Purpose |
|------|---------|
| `weather_dome_migration.sql` | Idempotent `ALTER TABLE cfb_analysis_base ADD COLUMN IF NOT EXISTS` for `weather_condition` + `dome`. |
| `cfb_analysis_rpc.sql` | Record of the live `cfb_analysis` RPC (weather/dome predicates). Refresh body with `dump_cfb_analysis_rpc.py` + `SUPABASE_ACCESS_TOKEN`. |
| `load_cfb_weather_dome.py` | Stages CFBD `data/cfbd/weather_*.parquet` into `cfb_wx_backfill` and prints the join `UPDATE` for SQL. |
| `dump_cfb_analysis_rpc.py` | Management-API dump of `pg_get_functiondef('public.cfb_analysis(text,jsonb)')`. |

## Already live

DDL + CFBD backfill + RPC weather/dome clauses were applied ad-hoc to
`jpxnjuwglavsjbgbasnl` before these files were committed. **No re-apply needed** for
production. These files are the reproducibility record.

## Rebuild note

`cfb_analysis_base` is additive. Any future rebuild must preserve:
`weather_condition`, `dome`, `team_ml`, `team_rank`, and the `last_*` columns.

## Probe (must move the numbers)

```sql
select 'baseline'  k,(cfb_analysis('fg_total','{}')->'overall'->>'n') n,(cfb_analysis('fg_total','{}')->'overall'->>'hit_pct') hit
union all select 'rain',   (cfb_analysis('fg_total','{"weather":"rain"}')->'overall'->>'n'),(cfb_analysis('fg_total','{"weather":"rain"}')->'overall'->>'hit_pct')
union all select 'snow',   (cfb_analysis('fg_total','{"weather":"snow"}')->'overall'->>'n'),(cfb_analysis('fg_total','{"weather":"snow"}')->'overall'->>'hit_pct')
union all select 'dome',   (cfb_analysis('fg_total','{"dome":true}')->'overall'->>'n'),(cfb_analysis('fg_total','{"dome":true}')->'overall'->>'hit_pct');
```

Expected order-of-magnitude: baseline ≈ 6,949 (49% over); rain ≈ 499; snow ≈ 24; dome ≈ 283.

Weather **condition** text is complete for 2022+, partial 2018–2021, sparse 2016–2017
(CFBD source). Temp/wind are complete for all seasons after the backfill.
