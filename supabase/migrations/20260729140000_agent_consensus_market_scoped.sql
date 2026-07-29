-- =============================================================================
-- Agent consensus — scope agreement to the MARKET, not the whole game
--
-- Supersedes the agreement math in 20260726140000_game_agent_consensus.sql.
--
-- THE BUG: `agreement` divided agents-on-one-selection by agents-on-the-game.
-- Those count different populations. A selection lives in exactly one market
-- (bet_type × period), but the denominator pooled every agent who bet the game
-- in ANY market. MLB alone has six shapes (full/f5 × moneyline/spread/total)
-- plus team totals, so the picks fragment and the winner looks like a minority.
--
-- Measured on the 2026-07-29 MLB slate (15 games): 9 games reported a
-- "most-backed side" under 50%, e.g. "Pittsburgh Pirates F5 -0.5, 5 of 17
-- agents, 29% agreement" — where 12 of those 17 agents were not betting the F5
-- run line at all. Worse, the metric was inversely correlated with sample size:
-- every high-agreement game had few agents (13/13, 4/4, 2/2) while every
-- heavily-bet game scored low (10/21, 7/18, 5/17), because more agents means
-- more markets covered. A consensus signal that degrades as participation grows
-- is measuring fragmentation, not agreement.
--
-- THE FIX: denominator = distinct agents who bet the SAME market as the winning
-- selection. "5 of 6 agents betting the F5 run line" is a claim that holds.
-- `agents` is still returned (unchanged) for the "N agents" participation strip.
--
-- FLAG RATE: deliberately NOT recalibrated. p_min_share now tests a meaningful
-- share, so more games can clear it; the absolute `side_agents >= threshold`
-- bar is untouched and still prevents a 2-of-2 market from flagging.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_game_agent_consensus(text, date[], numeric, numeric, integer);

CREATE OR REPLACE FUNCTION public.get_game_agent_consensus(
  p_sport      text,
  p_game_dates date[],
  p_min_share  numeric DEFAULT 0.55,
  p_rel_share  numeric DEFAULT 0.08,
  p_min_agents integer DEFAULT 8
)
RETURNS TABLE (
  game_id       text,
  game_date     date,
  agents        integer,
  side          text,
  side_agents   integer,
  market_agents integer,
  market_label  text,
  agreement     numeric,
  threshold     integer,
  flagged       boolean,
  avatars       jsonb
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
      ap.bet_type,
      COALESCE(NULLIF(trim(ap.period), ''), 'full') AS period,
      trim(ap.pick_selection)                       AS selection
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
    -- Participation across every market. Drives the "N agents" strip, and is
    -- NOT the agreement denominator.
    SELECT game_id, game_date, count(DISTINCT avatar_id)::int AS agents
    FROM scoped
    GROUP BY game_id, game_date
  ),
  per_market AS (
    -- The comparable population: one bet shape on one game.
    SELECT game_id, game_date, bet_type, period,
           count(DISTINCT avatar_id)::int AS market_agents
    FROM scoped
    GROUP BY game_id, game_date, bet_type, period
  ),
  per_side AS (
    -- Sides are compared case-insensitively but reported verbatim. Grouped by
    -- market as well as selection: F5 stays SEPARATE from its full-game
    -- equivalent ("Twins F5 ML" is a different bet from "Twins ML"), and the
    -- same string under two bet_types must not be merged.
    SELECT
      game_id, game_date, bet_type, period,
      lower(selection)               AS norm,
      min(selection)                 AS label,
      count(DISTINCT avatar_id)::int AS side_agents
    FROM scoped
    GROUP BY game_id, game_date, bet_type, period, lower(selection)
  ),
  top_side AS (
    SELECT DISTINCT ON (game_id, game_date)
      game_id, game_date, bet_type, period, norm, label, side_agents
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
    -- 96% of agents have no explicit sprite_index, and the app-wide rule is
    -- "explicit override wins, else FNV-1a(avatar_id) % 8" (see
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
        AND sc.bet_type  = t.bet_type
        AND sc.period    = t.period
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
    t.label         AS side,
    t.side_agents,
    m.market_agents,
    -- Names the population the percentage is over, so the card can say which
    -- bet the agents agreed on. MLB spreads are run lines.
    (
      CASE t.period WHEN 'f5' THEN 'F5 ' WHEN 'h1' THEN '1H ' ELSE '' END
      ||
      CASE t.bet_type
        WHEN 'moneyline'  THEN 'moneyline'
        WHEN 'spread'     THEN CASE WHEN p_sport = 'mlb' THEN 'run line' ELSE 'spread' END
        WHEN 'total'      THEN 'total'
        WHEN 'team_total' THEN 'team total'
        ELSE t.bet_type
      END
    )               AS market_label,
    round(t.side_agents::numeric / NULLIF(m.market_agents, 0), 4) AS agreement,
    d.threshold,
    (
      t.side_agents >= d.threshold
      AND t.side_agents::numeric / NULLIF(m.market_agents, 0) >= p_min_share
    )               AS flagged,
    COALESCE(s.avatars, '[]'::jsonb) AS avatars
  FROM per_game   g
  JOIN top_side   t USING (game_id, game_date)
  JOIN per_market m USING (game_id, game_date, bet_type, period)
  JOIN day_scale  d USING (game_date)
  LEFT JOIN stack s USING (game_id, game_date)
  ORDER BY g.game_date, t.side_agents DESC;
$$;

COMMENT ON FUNCTION public.get_game_agent_consensus(text, date[], numeric, numeric, integer) IS
  'Per-game public-agent consensus for the /games feed: participation count, most-backed side, the market that side belongs to, agreement WITHIN that market, and whether it clears the scaled flag threshold. SECURITY DEFINER because avatar_picks RLS hides all rows from anon.';

GRANT EXECUTE ON FUNCTION public.get_game_agent_consensus(text, date[], numeric, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_agent_consensus(text, date[], numeric, numeric, integer) TO anon;
