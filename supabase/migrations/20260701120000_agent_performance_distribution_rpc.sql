-- Agents "Platform Statistics" screen (iOS Secret Settings).
--
-- Two read-only RPCs powering the win-rate distribution / bell-curve screen:
--
--   1. get_agent_performance_distribution — the whole-population per-agent rows
--      the histogram + normal fit are built from. Unlike get_leaderboard_v2 this
--      does NOT filter is_public/is_active: the distribution must describe EVERY
--      agent, not just the public ones, or the mean/SD are wrong. It returns only
--      aggregate + archetype/is_public columns (no name/user_id), so bypassing the
--      is_public RLS narrowing on avatar_profiles leaks no PII. Raw per-agent rows
--      (not pre-bucketed) so the client's threshold slider / bin-width / metric /
--      sport controls stay interactive with no refetch.
--
--   2. get_distribution_bin_agents — the drill-down when a histogram bar is
--      tapped: the top PUBLIC agents whose metric falls in the tapped bin, plus
--      each one's currently-open (pending) picks. SECURITY DEFINER + a hard
--      is_public filter so it surfaces exactly the public agents (avatar_picks
--      RLS otherwise gates public-agent picks behind Pro via
--      can_access_agent_picks; the DEFINER path serves the internal stats screen
--      regardless of the viewer's tier, while never exposing a private agent).
--
-- win_rate is recomputed as wins/NULLIF(wins+losses,0) (pushes excluded) so it
-- matches the definition the screen documents, independent of the cached column.

-- 1. Whole-population distribution rows -------------------------------------

CREATE OR REPLACE FUNCTION public.get_agent_performance_distribution(
  p_min_decided integer DEFAULT 1
)
RETURNS TABLE (
  avatar_id uuid,
  archetype text,
  is_public boolean,
  wins integer,
  losses integer,
  pushes integer,
  decided integer,
  win_rate numeric,
  net_units numeric,
  stats_by_sport jsonb,
  last_calculated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ap.id,
    ap.archetype,
    ap.is_public,
    COALESCE(pc.wins, 0)::int,
    COALESCE(pc.losses, 0)::int,
    COALESCE(pc.pushes, 0)::int,
    (COALESCE(pc.wins, 0) + COALESCE(pc.losses, 0))::int AS decided,
    (COALESCE(pc.wins, 0)::numeric
       / NULLIF(COALESCE(pc.wins, 0) + COALESCE(pc.losses, 0), 0)) AS win_rate,
    COALESCE(pc.net_units, 0)::numeric,
    COALESCE(pc.stats_by_sport, '{}'::jsonb),
    pc.last_calculated_at
  FROM public.avatar_profiles ap
  JOIN public.avatar_performance_cache pc ON pc.avatar_id = ap.id
  WHERE (COALESCE(pc.wins, 0) + COALESCE(pc.losses, 0)) >= GREATEST(COALESCE(p_min_decided, 1), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_performance_distribution(integer) TO authenticated, anon;

-- 2. Bin drill-down: top public agents in a metric range + their open picks ---

CREATE OR REPLACE FUNCTION public.get_distribution_bin_agents(
  p_metric text,               -- 'win_rate' | 'net_units'
  p_sport text DEFAULT NULL,   -- NULL = all sports; scopes the pending-picks list
  p_lower numeric DEFAULT 0,
  p_upper numeric DEFAULT 1,
  p_min_decided integer DEFAULT 1,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  avatar_id uuid,
  name text,
  avatar_emoji text,
  avatar_color text,
  archetype text,
  wins integer,
  losses integer,
  pushes integer,
  win_rate numeric,
  net_units numeric,
  pending_picks jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT
      ap.id,
      ap.name,
      ap.avatar_emoji,
      ap.avatar_color,
      ap.archetype,
      COALESCE(pc.wins, 0)::int AS wins,
      COALESCE(pc.losses, 0)::int AS losses,
      COALESCE(pc.pushes, 0)::int AS pushes,
      (COALESCE(pc.wins, 0)::numeric
         / NULLIF(COALESCE(pc.wins, 0) + COALESCE(pc.losses, 0), 0)) AS win_rate,
      COALESCE(pc.net_units, 0)::numeric AS net_units
    FROM public.avatar_profiles ap
    JOIN public.avatar_performance_cache pc ON pc.avatar_id = ap.id
    WHERE ap.is_public = true
      AND ap.is_active = true
      AND (COALESCE(pc.wins, 0) + COALESCE(pc.losses, 0)) >= GREATEST(COALESCE(p_min_decided, 1), 1)
  ),
  in_bin AS (
    SELECT *,
      CASE WHEN p_metric = 'net_units' THEN net_units ELSE win_rate END AS metric_value
    FROM scoped
  )
  SELECT
    b.id,
    b.name,
    b.avatar_emoji,
    b.avatar_color,
    b.archetype,
    b.wins,
    b.losses,
    b.pushes,
    b.win_rate,
    b.net_units,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pk.id,
          'avatar_id', pk.avatar_id,
          'game_id', pk.game_id,
          'sport', pk.sport,
          'matchup', pk.matchup,
          'game_date', pk.game_date,
          'bet_type', pk.bet_type,
          'pick_selection', pk.pick_selection,
          'odds', pk.odds,
          'units', pk.units,
          'confidence', pk.confidence,
          'reasoning_text', pk.reasoning_text,
          'result', pk.result,
          'created_at', pk.created_at
        )
        ORDER BY pk.confidence DESC NULLS LAST, pk.created_at DESC
      )
      FROM public.avatar_picks pk
      WHERE pk.avatar_id = b.id
        AND pk.result = 'pending'
        AND (p_sport IS NULL OR pk.sport = p_sport)
    ), '[]'::jsonb) AS pending_picks
  FROM in_bin b
  WHERE b.metric_value IS NOT NULL
    AND b.metric_value >= p_lower
    AND b.metric_value <= p_upper
  ORDER BY b.net_units DESC, b.win_rate DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_distribution_bin_agents(text, text, numeric, numeric, integer, integer) TO authenticated, anon;
