-- =============================================================================
-- Game Agent Consensus — "N agents on <side>" + the green Bet flag
--
-- Powers the agent-consensus strip on the /games feed cards (web + iOS +
-- Android). For each game on a slate it returns how many PUBLIC + ACTIVE agents
-- bet it, which single side they most agree on, and whether that agreement is
-- strong enough to earn the flag.
--
-- WHY AN RPC AND NOT A CLIENT QUERY: `avatar_picks` is RLS-gated and the anon
-- key sees ZERO rows, so a direct PostgREST select returns nothing for signed-
-- out and signed-in users alike. This is SECURITY DEFINER so the aggregate is
-- computed server-side over the public-agent population, and only the aggregate
-- (counts + the 4 avatars in the stack) crosses the wire — never raw picks.
--
-- WHY THE THRESHOLD SCALES: flagging "any agent bet this" fires on ~96% of
-- games (measured over 10 slates) because agents bet nearly everything — the
-- count tracks how many agents RAN that day, not how notable the game is. The
-- flag therefore keys off AGREEMENT, and the bar scales with the day's volume
-- so it does not drift as the agent population grows.
-- See .claude/docs/18_agent_consensus.md for the calibration data.
-- =============================================================================

-- The RPC filters by (sport, game_date) then groups by game_id; without this it
-- degenerates to a full scan of avatar_picks on every feed load.
CREATE INDEX IF NOT EXISTS idx_avatar_picks_sport_date_game
  ON public.avatar_picks (sport, game_date, game_id);

CREATE OR REPLACE FUNCTION public.get_game_agent_consensus(
  p_sport      text,
  p_game_dates date[],
  -- Defaults are the calibrated values (≈3 flags/day on a 15-game MLB slate,
  -- range 1-5, never empty across the 10-slate backtest). Exposed as params so
  -- the rate can be retuned from the client without shipping a migration.
  p_min_share  numeric DEFAULT 0.55,
  p_rel_share  numeric DEFAULT 0.08,
  p_min_agents integer DEFAULT 8
)
RETURNS TABLE (
  game_id     text,
  game_date   date,
  agents      integer,
  side        text,
  side_agents integer,
  agreement   numeric,
  threshold   integer,
  flagged     boolean,
  avatars     jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    -- NOTE: deliberately NOT filtered on result='pending'. Games grade through
    -- the day, and dropping graded picks would make the flag vanish from a card
    -- that is still on screen. Scoping by game_date is what bounds this.
    SELECT
      ap.game_id,
      ap.game_date,
      ap.avatar_id,
      trim(ap.pick_selection) AS selection
    FROM public.avatar_picks ap
    JOIN public.avatar_profiles pr
      ON  pr.id        = ap.avatar_id
      AND pr.is_public = true
      AND pr.is_active = true
    WHERE ap.sport     = p_sport
      AND ap.game_date = ANY(p_game_dates)
      AND trim(ap.pick_selection) <> ''
  ),
  per_game AS (
    SELECT game_id, game_date, count(DISTINCT avatar_id)::int AS agents
    FROM scoped
    GROUP BY game_id, game_date
  ),
  per_side AS (
    -- Sides are compared case-insensitively but reported verbatim. First-5
    -- (F5) selections stay SEPARATE from their full-game equivalent: "Twins F5
    -- ML" is a different bet from "Twins ML", and folding them would let the
    -- card claim agreement on a line nobody actually agreed on.
    SELECT
      game_id,
      game_date,
      lower(selection)               AS norm,
      min(selection)                 AS label,
      count(DISTINCT avatar_id)::int AS side_agents
    FROM scoped
    GROUP BY game_id, game_date, lower(selection)
  ),
  top_side AS (
    SELECT DISTINCT ON (game_id, game_date)
      game_id, game_date, norm, label, side_agents
    FROM per_side
    -- label ASC breaks ties deterministically so the card doesn't flip between
    -- two equally-backed sides on refetch.
    ORDER BY game_id, game_date, side_agents DESC, label ASC
  ),
  day_scale AS (
    -- "Picking agents" is the SUM of per-game distinct agent counts
    -- (agent-games), NOT distinct agents across the slate. That is the
    -- denominator the 8% was calibrated against — swapping it silently
    -- re-tunes the flag rate.
    SELECT
      game_date,
      GREATEST(p_min_agents, ceil(p_rel_share * sum(agents))::int) AS threshold
    FROM per_game
    GROUP BY game_date
  ),
  stack AS (
    -- Avatars shown in the overlap cluster are drawn from the agents on the
    -- WINNING side only, so the faces match the claim the strip is making.
    --
    -- Agent avatars are always pixel-people sprites, never the emoji.
    --
    -- `spriteIndex` is returned RAW and nullable — do NOT coalesce it to 0.
    -- 96% of agents (1491/1556) have no explicit sprite_index, and the app-wide
    -- rule is "explicit override wins, else FNV-1a(avatar_id) % 8" (see
    -- src/utils/agentSprites.ts, mirrored on iOS/Android). Coalescing here would
    -- render almost every stack as four identical sprite-0 characters AND
    -- disagree with the same agent's avatar everywhere else in the product.
    -- Clients MUST apply the hash fallback themselves.
    SELECT
      t.game_id,
      t.game_date,
      jsonb_agg(
        jsonb_build_object(
          'avatarId',    a.avatar_id,
          'name',        a.name,
          'spriteIndex', a.sprite_index,
          'color',       a.avatar_color
        )
      ) AS avatars
    FROM top_side t
    JOIN LATERAL (
      SELECT DISTINCT pr.id AS avatar_id, pr.name, pr.sprite_index, pr.avatar_color
      FROM scoped sc
      JOIN public.avatar_profiles pr ON pr.id = sc.avatar_id
      WHERE sc.game_id   = t.game_id
        AND sc.game_date = t.game_date
        AND lower(sc.selection) = t.norm
      ORDER BY pr.name
      LIMIT 4
    ) a ON true
    GROUP BY t.game_id, t.game_date
  )
  SELECT
    g.game_id,
    g.game_date,
    g.agents,
    t.label       AS side,
    t.side_agents,
    round(t.side_agents::numeric / NULLIF(g.agents, 0), 4) AS agreement,
    d.threshold,
    (
      t.side_agents >= d.threshold
      AND t.side_agents::numeric / NULLIF(g.agents, 0) >= p_min_share
    )             AS flagged,
    COALESCE(s.avatars, '[]'::jsonb) AS avatars
  FROM per_game  g
  JOIN top_side  t USING (game_id, game_date)
  JOIN day_scale d USING (game_date)
  LEFT JOIN stack s USING (game_id, game_date)
  ORDER BY g.game_date, t.side_agents DESC;
$$;

COMMENT ON FUNCTION public.get_game_agent_consensus(text, date[], numeric, numeric, integer) IS
  'Per-game public-agent consensus for the /games feed: agent count, most-backed side, agreement share, and whether it clears the scaled flag threshold. SECURITY DEFINER because avatar_picks RLS hides all rows from anon.';

-- Public read: the underlying population is public agents only, and the
-- function returns aggregates plus the same avatar fields already exposed by
-- get_agent_pick_overlap_batch.
GRANT EXECUTE ON FUNCTION public.get_game_agent_consensus(text, date[], numeric, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_agent_consensus(text, date[], numeric, numeric, integer) TO anon;
