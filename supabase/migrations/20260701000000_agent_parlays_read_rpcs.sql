-- Surface parlays (avatar_parlays + nested avatar_parlay_legs) through the two
-- premium-gated read RPCs the clients use. Bodies are copied from
-- 20260620120000_agent_owner_picks_access.sql with ONLY the parlay aggregates
-- added, under the SAME v_can_view_picks gate as picks — without this, a
-- non-owner viewer with an active entitlement would see straight picks but
-- never parlays. See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md (Part B).
--
--   detail snapshot: + 'todays_parlays' (today's tickets, legs embedded)
--   picks page:      + 'parlays' (first page only — tickets are few, so they
--                    ride along with page 1 instead of joining the pick cursor)

CREATE OR REPLACE FUNCTION public.get_agent_detail_snapshot_v3(
  p_agent_id uuid,
  p_viewer_user_id uuid DEFAULT NULL,
  p_viewer_has_active_entitlement boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := p_viewer_user_id;
  v_can_view_picks boolean := false;
  v_is_readable boolean := false;
  v_is_admin boolean := false;
  v_is_owner boolean := false;
  v_is_following boolean := false;
  v_agent jsonb := '{}'::jsonb;
  v_performance jsonb := null;
  v_todays_picks jsonb := '[]'::jsonb;
  v_todays_parlays jsonb := '[]'::jsonb;
  v_todays_run jsonb := null;
BEGIN
  IF p_agent_id IS NULL THEN
    RETURN jsonb_build_object('api_version', 'v3', 'error', 'invalid_agent_id');
  END IF;

  SELECT to_jsonb(ap),
         (ap.is_public = true OR (v_viewer IS NOT NULL AND ap.user_id = v_viewer)),
         (v_viewer IS NOT NULL AND ap.user_id = v_viewer)
  INTO v_agent, v_is_readable, v_is_owner
  FROM public.avatar_profiles ap
  WHERE ap.id = p_agent_id;

  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('api_version', 'v3', 'error', 'not_found');
  END IF;

  IF NOT v_is_readable THEN
    RETURN jsonb_build_object('api_version', 'v3', 'error', 'forbidden');
  END IF;

  IF v_viewer IS NOT NULL THEN
    v_is_admin := public.has_role(v_viewer, 'admin');
    v_can_view_picks := v_is_admin
      OR v_is_owner
      OR COALESCE(p_viewer_has_active_entitlement, false);

    SELECT EXISTS(
      SELECT 1
      FROM public.user_avatar_follows
      WHERE user_id = v_viewer
        AND avatar_id = p_agent_id
    ) INTO v_is_following;
  END IF;

  SELECT to_jsonb(pc)
  INTO v_performance
  FROM public.avatar_performance_cache pc
  WHERE pc.avatar_id = p_agent_id;

  IF v_can_view_picks THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC), '[]'::jsonb)
    INTO v_todays_picks
    FROM (
      SELECT *
      FROM public.avatar_picks
      WHERE avatar_id = p_agent_id
        AND game_date = (now() AT TIME ZONE 'America/New_York')::date
      ORDER BY created_at DESC
      LIMIT 25
    ) p;

    -- Today's parlay tickets, legs embedded under a 'legs' key (matches the
    -- PostgREST alias `legs:avatar_parlay_legs(*)` used by direct client reads,
    -- so both paths decode identically).
    SELECT COALESCE(jsonb_agg(sub.parlay_row ORDER BY sub.created_at DESC), '[]'::jsonb)
    INTO v_todays_parlays
    FROM (
      SELECT
        jsonb_set(
          to_jsonb(pl),
          '{legs}',
          COALESCE((
            SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at ASC, l.id ASC)
            FROM public.avatar_parlay_legs l
            WHERE l.parlay_id = pl.id
          ), '[]'::jsonb),
          true
        ) AS parlay_row,
        pl.created_at
      FROM public.avatar_parlays pl
      WHERE pl.avatar_id = p_agent_id
        AND pl.target_date = (now() AT TIME ZONE 'America/New_York')::date
      ORDER BY pl.created_at DESC
      LIMIT 25
    ) sub;

    SELECT to_jsonb(r)
    INTO v_todays_run
    FROM (
      SELECT
        id,
        avatar_id,
        generation_type,
        target_date,
        status,
        weak_slate,
        no_games,
        picks_generated,
        completed_at,
        created_at
      FROM public.agent_generation_runs
      WHERE avatar_id = p_agent_id
        AND target_date = (now() AT TIME ZONE 'America/New_York')::date
        AND status = 'succeeded'
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    ) r;
  END IF;

  RETURN jsonb_build_object(
    'api_version', 'v3',
    'agent', COALESCE(v_agent, '{}'::jsonb),
    'performance', v_performance,
    'todays_picks', COALESCE(v_todays_picks, '[]'::jsonb),
    'todays_parlays', COALESCE(v_todays_parlays, '[]'::jsonb),
    'todays_generation_run', v_todays_run,
    'can_view_agent_picks', v_can_view_picks,
    'is_following', v_is_following
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_agent_picks_page_v3(
  p_agent_id uuid,
  p_viewer_user_id uuid DEFAULT NULL,
  p_viewer_has_active_entitlement boolean DEFAULT false,
  p_filter text DEFAULT 'all',
  p_page_size integer DEFAULT 20,
  p_cursor timestamptz DEFAULT NULL,
  p_include_overlap boolean DEFAULT false,
  p_game_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := p_viewer_user_id;
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_filter text := COALESCE(p_filter, 'all');
  v_can_view_picks boolean := false;
  v_is_readable boolean := false;
  v_is_admin boolean := false;
  v_is_owner boolean := false;
  v_next_cursor timestamptz := NULL;
  v_has_more boolean := false;
  v_picks jsonb := '[]'::jsonb;
  v_parlays jsonb := '[]'::jsonb;
BEGIN
  IF v_filter NOT IN ('all', 'won', 'lost', 'pending', 'push') THEN
    v_filter := 'all';
  END IF;

  SELECT (ap.is_public = true OR (v_viewer IS NOT NULL AND ap.user_id = v_viewer)),
         (v_viewer IS NOT NULL AND ap.user_id = v_viewer)
  INTO v_is_readable, v_is_owner
  FROM public.avatar_profiles ap
  WHERE ap.id = p_agent_id;

  IF COALESCE(v_is_readable, false) = false THEN
    RETURN jsonb_build_object('api_version', 'v3', 'picks', '[]'::jsonb, 'parlays', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false);
  END IF;

  IF v_viewer IS NOT NULL THEN
    v_is_admin := public.has_role(v_viewer, 'admin');
    v_can_view_picks := v_is_admin
      OR v_is_owner
      OR COALESCE(p_viewer_has_active_entitlement, false);
  END IF;

  IF NOT v_can_view_picks THEN
    RETURN jsonb_build_object('api_version', 'v3', 'picks', '[]'::jsonb, 'parlays', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false);
  END IF;

  WITH base AS (
    SELECT p.*
    FROM public.avatar_picks p
    WHERE p.avatar_id = p_agent_id
      AND (v_filter = 'all' OR p.result = v_filter)
      AND (p_game_date IS NULL OR p.game_date = p_game_date)
      AND (p_cursor IS NULL OR p.created_at < p_cursor)
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT (v_page_size + 1)
  ), page AS (
    SELECT *
    FROM base
    ORDER BY created_at DESC, id DESC
    LIMIT v_page_size
  ), has_more_cte AS (
    SELECT (COUNT(*) > v_page_size) AS has_more
    FROM base
  ), next_cursor_cte AS (
    SELECT b.created_at AS next_cursor
    FROM base b
    ORDER BY b.created_at DESC, b.id DESC
    OFFSET v_page_size
    LIMIT 1
  )
  SELECT
    COALESCE(jsonb_agg(
      CASE
        WHEN p_include_overlap THEN
          jsonb_set(
            to_jsonb(pg),
            '{overlap}',
            jsonb_build_object(
              'totalCount', COALESCE(ov.total_count, 0),
              'agents', COALESCE(ov.agents, '[]'::jsonb)
            ),
            true
          )
        ELSE to_jsonb(pg)
      END
      ORDER BY pg.created_at DESC, pg.id DESC
    ), '[]'::jsonb),
    COALESCE((SELECT has_more FROM has_more_cte), false),
    (SELECT next_cursor FROM next_cursor_cte)
  INTO v_picks, v_has_more, v_next_cursor
  FROM page pg
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::integer AS total_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'avatar_id', x.avatar_id,
            'name', x.name,
            'avatar_emoji', x.avatar_emoji,
            'avatar_color', x.avatar_color
          )
        ),
        '[]'::jsonb
      ) AS agents
    FROM (
      SELECT DISTINCT
        ap2.avatar_id,
        prof.name,
        prof.avatar_emoji,
        prof.avatar_color
      FROM public.avatar_picks ap2
      INNER JOIN public.avatar_profiles prof ON prof.id = ap2.avatar_id
      WHERE ap2.game_id = pg.game_id
        AND ap2.bet_type = pg.bet_type
        AND ap2.pick_selection = pg.pick_selection
        AND ap2.avatar_id <> pg.avatar_id
        AND prof.is_public = true
      LIMIT 5
    ) x
  ) ov ON p_include_overlap = true;

  -- Parlays ride along on the FIRST page only (p_cursor IS NULL) — an agent
  -- has at most a handful of tickets, so they don't join the pick cursor.
  -- Clients paging with a cursor must take parlays from page 1.
  IF p_cursor IS NULL THEN
    SELECT COALESCE(jsonb_agg(sub.parlay_row ORDER BY sub.created_at DESC), '[]'::jsonb)
    INTO v_parlays
    FROM (
      SELECT
        jsonb_set(
          to_jsonb(pl),
          '{legs}',
          COALESCE((
            SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at ASC, l.id ASC)
            FROM public.avatar_parlay_legs l
            WHERE l.parlay_id = pl.id
          ), '[]'::jsonb),
          true
        ) AS parlay_row,
        pl.created_at
      FROM public.avatar_parlays pl
      WHERE pl.avatar_id = p_agent_id
        AND (v_filter = 'all' OR pl.result = v_filter)
        AND (p_game_date IS NULL OR pl.target_date = p_game_date)
      ORDER BY pl.created_at DESC
      LIMIT 200
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'api_version', 'v3',
    'picks', COALESCE(v_picks, '[]'::jsonb),
    'parlays', COALESCE(v_parlays, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', COALESCE(v_has_more, false)
  );
END;
$$;
