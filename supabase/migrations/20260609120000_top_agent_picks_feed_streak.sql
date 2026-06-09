-- ---------------------------------------------------------------------------
-- Add agent_current_streak to the Top Agent Picks feed RPC.
--
-- The feed card (iOS `TopAgentPicksFeed` / `AgentSectionView`) now renders the
-- same streak + form chart as the My Agents list row. The streak value lives on
-- `avatar_performance_cache.current_streak`, which the RPC already joins (as
-- `pc`) but did not project. This migration recreates
-- `get_top_agent_picks_feed_v2` with `current_streak` carried through
-- `ranked_public` and out as the new `agent_current_streak` column.
--
-- Pure additive change: existing columns/positions are unchanged, so older
-- clients that don't decode the new column keep working.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_top_agent_picks_feed_v2(
  p_filter_mode text DEFAULT 'top10',
  p_viewer_user_id uuid DEFAULT NULL,
  p_search_text text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_cursor timestamptz DEFAULT NULL
)
RETURNS TABLE (
  api_version text,
  id uuid,
  avatar_id uuid,
  game_id text,
  sport text,
  matchup text,
  game_date date,
  bet_type text,
  pick_selection text,
  odds text,
  units numeric,
  confidence integer,
  reasoning_text text,
  key_factors jsonb,
  archived_game_data jsonb,
  archived_personality jsonb,
  result text,
  actual_result text,
  graded_at timestamptz,
  created_at timestamptz,
  agent_name text,
  agent_avatar_emoji text,
  agent_avatar_color text,
  agent_wins integer,
  agent_losses integer,
  agent_pushes integer,
  agent_net_units numeric,
  agent_rank integer,
  agent_current_streak integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_filter text := COALESCE(p_filter_mode, 'top10');
  v_viewer uuid := COALESCE(auth.uid(), p_viewer_user_id);
BEGIN
  IF v_filter NOT IN ('top10', 'following', 'favorites') THEN
    v_filter := 'top10';
  END IF;

  RETURN QUERY
  WITH ranked_public AS (
    SELECT
      ap.id AS avatar_id,
      ap.name,
      ap.avatar_emoji,
      ap.avatar_color,
      ROW_NUMBER() OVER (
        ORDER BY
          COALESCE(pc.net_units, 0) DESC,
          COALESCE(pc.win_rate, 0) DESC,
          COALESCE(pc.current_streak, 0) DESC,
          ap.id
      )::integer AS rank,
      COALESCE(pc.wins, 0)::integer AS wins,
      COALESCE(pc.losses, 0)::integer AS losses,
      COALESCE(pc.pushes, 0)::integer AS pushes,
      COALESCE(pc.net_units, 0)::numeric AS net_units,
      COALESCE(pc.current_streak, 0)::integer AS current_streak
    FROM public.avatar_profiles ap
    LEFT JOIN public.avatar_performance_cache pc ON pc.avatar_id = ap.id
    WHERE ap.is_public = true
  ), candidate_agents AS (
    SELECT rp.avatar_id
    FROM ranked_public rp
    WHERE v_filter = 'top10' AND rp.rank <= 50

    UNION

    SELECT uaf.avatar_id
    FROM public.user_avatar_follows uaf
    INNER JOIN ranked_public rp ON rp.avatar_id = uaf.avatar_id
    WHERE v_filter = 'following'
      AND v_viewer IS NOT NULL
      AND uaf.user_id = v_viewer

    UNION

    SELECT ap.id AS avatar_id
    FROM public.avatar_profiles ap
    INNER JOIN ranked_public rp ON rp.avatar_id = ap.id
    WHERE v_filter = 'favorites'
      AND v_viewer IS NOT NULL
      AND ap.user_id = v_viewer
      AND ap.is_widget_favorite = true

    UNION

    SELECT uaf.avatar_id
    FROM public.user_avatar_follows uaf
    INNER JOIN ranked_public rp ON rp.avatar_id = uaf.avatar_id
    WHERE v_filter = 'favorites'
      AND v_viewer IS NOT NULL
      AND uaf.user_id = v_viewer
      AND COALESCE(uaf.is_favorite, false) = true
  )
  SELECT
    'v2'::text,
    p.id,
    p.avatar_id,
    p.game_id,
    p.sport,
    p.matchup,
    p.game_date,
    p.bet_type,
    p.pick_selection,
    p.odds,
    p.units,
    p.confidence,
    p.reasoning_text,
    p.key_factors,
    p.archived_game_data,
    p.archived_personality,
    p.result,
    p.actual_result,
    p.graded_at,
    p.created_at,
    rp.name,
    rp.avatar_emoji,
    rp.avatar_color,
    rp.wins,
    rp.losses,
    rp.pushes,
    rp.net_units,
    rp.rank,
    rp.current_streak
  FROM public.avatar_picks p
  INNER JOIN candidate_agents ca ON ca.avatar_id = p.avatar_id
  INNER JOIN ranked_public rp ON rp.avatar_id = p.avatar_id
  WHERE p.game_date BETWEEN (now() AT TIME ZONE 'America/New_York')::date AND ((now() AT TIME ZONE 'America/New_York')::date + INTERVAL '3 days')::date
    AND (p_cursor IS NULL OR p.created_at < p_cursor)
    AND (
      p_search_text IS NULL
      OR p_search_text = ''
      OR LOWER(p.matchup) LIKE '%' || LOWER(p_search_text) || '%'
      OR LOWER(p.pick_selection) LIKE '%' || LOWER(p_search_text) || '%'
      OR LOWER(rp.name) LIKE '%' || LOWER(p_search_text) || '%'
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT v_limit;
END;
$$;
