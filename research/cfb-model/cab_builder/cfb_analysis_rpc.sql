-- public.cfb_analysis(text, jsonb) — CFB Historical Analysis RPC
-- Warehouse: jpxnjuwglavsjbgbasnl (collegeFootballSupabase — production for /cfb-analytics)
--
-- STATUS (2026-07-14): weather + dome filters are LIVE on this project. Verified via
-- PostgREST probe on fg_total:
--   baseline n=6949 hit_pct=49.0
--   weather=rain → n=499 hit_pct≈47.7
--   weather=snow → n=24  hit_pct≈45.8
--   dome=true    → n=283 hit_pct≈42.4
--
-- Full CREATE OR REPLACE body: dump with
--   SUPABASE_ACCESS_TOKEN=… python3 cab_builder/dump_cfb_analysis_rpc.py
-- (Management API — the service role key is PostgREST-only and cannot run
-- pg_get_functiondef). Until a dump is committed, the required WHERE predicates
-- that must remain in the live function are:

--   AND (p_filters->>'weather' IS NULL OR b.weather_condition = (p_filters->>'weather'))
--   AND (p_filters->>'dome' IS NULL OR b.dome = (p_filters->>'dome')::boolean)

-- Related: weather_dome_migration.sql (columns) + load_cfb_weather_dome.py (CFBD backfill).
