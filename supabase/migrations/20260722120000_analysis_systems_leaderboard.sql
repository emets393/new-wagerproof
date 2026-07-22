-- Systems leaderboard backend (see .claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md).
-- Saved analysis filters become shareable "systems": at save time the client stores the
-- user's VERDICT (which side the system bets) + the exact RPC payload it queried with, so
-- the nightly grader reproduces the page's numbers verbatim (no client/server translation).
--
-- verdict vocabulary:
--   'team' = bet the team matching the filters   'fade' = bet against that team
--   'over' / 'under' = totals side
-- rpc_bet_type / rpc_filters = the exact (p_bet_type, p_filters) the page sent to the
-- warehouse *_analysis RPC when the user saved. Editing filters = a NEW save (since-saved
-- tracking must never survive a filter change), so no UPDATE grant on those columns.

-- ── 1. Extend the three saved-filters tables ────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['nfl_analysis_saved_filters','cfb_analysis_saved_filters','mlb_analysis_saved_filters'] LOOP
    EXECUTE format('ALTER TABLE public.%I
      ADD COLUMN IF NOT EXISTS verdict text CHECK (verdict IN (''team'',''fade'',''over'',''under'')),
      ADD COLUMN IF NOT EXISTS rpc_bet_type text,
      ADD COLUMN IF NOT EXISTS rpc_filters jsonb,
      ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS filters_hash text,
      ADD COLUMN IF NOT EXISTS since_saved jsonb,
      ADD COLUMN IF NOT EXISTS graded_at timestamptz', t);
    -- users may rename or share/unshare; filters+verdict stay immutable (delete + resave)
    EXECUTE format('REVOKE UPDATE ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT UPDATE (name, is_public) ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t || '_update_own', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (filters_hash) WHERE is_public', t || '_hash_idx', t);
  END LOOP;
END $$;

-- ── 2. Performance cache, one row per unique (sport, hash) system ───────────
-- hash = sha256(sport | rpc_bet_type | verdict | canonical rpc_filters), computed by the
-- grader (never trusted from clients). jsonb shapes:
--   all_time / current_season / since_saved: {n, wins, losses, pushes, hit_pct, roi, units}
--   last10: {n, wins, results:[1,0,...newest first]}   streak: {kind:'win'|'loss', len}
CREATE TABLE IF NOT EXISTS public.analysis_system_performance (
  sport text NOT NULL CHECK (sport IN ('nfl','cfb','mlb')),
  filters_hash text NOT NULL,
  rpc_bet_type text NOT NULL,
  verdict text NOT NULL,
  rpc_filters jsonb NOT NULL,
  all_time jsonb,
  current_season jsonb,
  season_label integer,
  last10 jsonb,
  streak jsonb,
  graded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sport, filters_hash)
);
ALTER TABLE public.analysis_system_performance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analysis_system_performance_read ON public.analysis_system_performance;
CREATE POLICY analysis_system_performance_read ON public.analysis_system_performance
  FOR SELECT USING (true);
GRANT SELECT ON public.analysis_system_performance TO authenticated, anon;
-- writes: service role only (RLS enabled, no write policies)

-- ── 3. Leaderboard RPC ──────────────────────────────────────────────────────
-- Top public systems by all-time ROI, min 10 graded games. Returns everything the
-- leaderboard card + click-through need (UI snapshot travels with the row so the
-- analytics page can restore the exact filters).
CREATE OR REPLACE FUNCTION public.analysis_systems_leaderboard(
  p_sport text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH saved AS (
    SELECT 'nfl' AS sport, s.id, s.user_id, s.name, s.bet_type, s.filters, s.verdict,
           s.rpc_bet_type, s.filters_hash, s.since_saved, s.created_at
      FROM nfl_analysis_saved_filters s WHERE s.is_public AND s.filters_hash IS NOT NULL
    UNION ALL
    SELECT 'cfb', s.id, s.user_id, s.name, s.bet_type, s.filters, s.verdict,
           s.rpc_bet_type, s.filters_hash, s.since_saved, s.created_at
      FROM cfb_analysis_saved_filters s WHERE s.is_public AND s.filters_hash IS NOT NULL
    UNION ALL
    SELECT 'mlb', s.id, s.user_id, s.name, s.bet_type, s.filters, s.verdict,
           s.rpc_bet_type, s.filters_hash, s.since_saved, s.created_at
      FROM mlb_analysis_saved_filters s WHERE s.is_public AND s.filters_hash IS NOT NULL
  )
  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'sport', s.sport, 'system_id', s.id, 'name', s.name,
      'verdict', s.verdict, 'bet_type', s.bet_type, 'rpc_bet_type', s.rpc_bet_type,
      'filters', s.filters,
      'username', COALESCE(NULLIF(p.display_name,''), NULLIF(p.username,''), 'WagerProof member'),
      'created_at', s.created_at, 'since_saved', s.since_saved,
      'all_time', c.all_time, 'current_season', c.current_season,
      'season_label', c.season_label, 'last10', c.last10, 'streak', c.streak,
      'graded_at', c.graded_at) AS row_json,
      (c.all_time->>'roi')::numeric AS roi
    FROM saved s
    JOIN analysis_system_performance c
      ON c.sport = s.sport AND c.filters_hash = s.filters_hash
    LEFT JOIN profiles p ON p.user_id = s.user_id
    WHERE (p_sport IS NULL OR s.sport = p_sport)
      AND (c.all_time->>'n')::int >= 10
    ORDER BY (c.all_time->>'roi')::numeric DESC NULLS LAST, (c.all_time->>'n')::int DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  ) ranked;
$$;

REVOKE ALL ON FUNCTION public.analysis_systems_leaderboard(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analysis_systems_leaderboard(text, integer) TO authenticated, anon, service_role;
