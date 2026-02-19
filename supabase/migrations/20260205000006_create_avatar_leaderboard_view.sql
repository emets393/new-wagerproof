-- ============================================================================
-- Migration: Create Avatar Leaderboard View
-- Description: Optimized view for leaderboard queries joining profiles with performance
-- ============================================================================

CREATE OR REPLACE VIEW public.avatar_leaderboard AS
SELECT
  ap.id AS avatar_id,
  ap.name,
  ap.avatar_emoji,
  ap.avatar_color,
  ap.user_id,
  ap.preferred_sports,
  ap.archetype,
  COALESCE(apc.total_picks, 0) AS total_picks,
  COALESCE(apc.wins, 0) AS wins,
  COALESCE(apc.losses, 0) AS losses,
  COALESCE(apc.pushes, 0) AS pushes,
  apc.win_rate,
  COALESCE(apc.net_units, 0) AS net_units,
  COALESCE(apc.current_streak, 0) AS current_streak,
  COALESCE(apc.best_streak, 0) AS best_streak,
  apc.stats_by_sport,
  apc.last_calculated_at
FROM public.avatar_profiles ap
LEFT JOIN public.avatar_performance_cache apc ON ap.id = apc.avatar_id
WHERE ap.is_public = true
  AND ap.is_active = true;

-- Grant select to authenticated users
GRANT SELECT ON public.avatar_leaderboard TO authenticated;

-- Grant select to anon for public access
GRANT SELECT ON public.avatar_leaderboard TO anon;

COMMENT ON VIEW public.avatar_leaderboard IS 'Optimized view for public agent leaderboard with performance stats';
