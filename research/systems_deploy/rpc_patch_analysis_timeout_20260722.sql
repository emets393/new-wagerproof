-- Historical Trends warehouse fix (applied 2026-07-22 to jpxnjuwglavsjbgbasnl)
--
-- Root cause
-- ----------
-- PostgREST calls use the `anon` role, which has statement_timeout=3s.
-- *_system_rows do a LEFT JOIN LATERAL opponent lookup on unique_id with no
-- supporting index. CFB defaults (season_min=2025, game_type=regular) took
-- ~2.8–3.2s and flapped over the 3s budget → HTTP 500
--   {"code":"57014","message":"canceling statement due to statement timeout"}
-- NFL defaults (~1.5s) had little headroom under concurrent page load;
-- unrestricted NFL/CFB scans always timed out. MLB was usually fine (~0.3s)
-- because game_pk is already in the primary key used by its LATERAL join.
--
-- Client season_min narrowing (PR #55) was necessary but not sufficient for CFB.
--
-- Fix (prefer optimize + modest per-RPC budget; do NOT raise anon globally)
-- ------------------------------------------------------------------------

-- 1) Index the LATERAL join key (the big win — CFB default ~3s → ~0.25s)
CREATE INDEX IF NOT EXISTS idx_cab_unique_id ON public.cfb_analysis_base (unique_id);
CREATE INDEX IF NOT EXISTS idx_nab_unique_id ON public.nfl_analysis_base (unique_id);

-- 2) Per-function timeout override so heavy filtered scans stay under budget
--    without opening the door for every anon query.
ALTER FUNCTION public.mlb_analysis(text, jsonb) SET statement_timeout TO '15s';
ALTER FUNCTION public.nfl_analysis(text, jsonb) SET statement_timeout TO '15s';
ALTER FUNCTION public.cfb_analysis(text, jsonb) SET statement_timeout TO '15s';

ALTER FUNCTION public.mlb_analysis_upcoming(text, jsonb) SET statement_timeout TO '15s';
ALTER FUNCTION public.nfl_analysis_upcoming(text, jsonb) SET statement_timeout TO '15s';
ALTER FUNCTION public.cfb_analysis_upcoming(text, jsonb) SET statement_timeout TO '15s';

ALTER FUNCTION public.mlb_system_rows(text, jsonb) SET statement_timeout TO '15s';
ALTER FUNCTION public.nfl_system_rows(text, jsonb) SET statement_timeout TO '15s';
ALTER FUNCTION public.cfb_system_rows(text, jsonb) SET statement_timeout TO '15s';

-- Verify (optional):
--   SELECT proname, proconfig FROM pg_proc p
--   JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND proname LIKE '%analysis%';
--   SELECT indexname FROM pg_indexes WHERE indexname IN ('idx_cab_unique_id','idx_nab_unique_id');
