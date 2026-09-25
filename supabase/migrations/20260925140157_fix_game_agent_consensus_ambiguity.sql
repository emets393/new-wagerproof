-- The tier-access migration converted this SQL function to PL/pgSQL. Its
-- RETURNS TABLE names then shadowed unqualified query columns (42702).
-- Keep the access guard, signature, grants, and consensus math unchanged;
-- qualify all query references instead of changing variable_conflict globally.
-- CREATE OR REPLACE preserves the existing function ownership and ACL.

CREATE OR REPLACE FUNCTION public.get_game_agent_consensus(
  p_sport      text,
  p_game_dates date[],
  p_min_share  numeric DEFAULT 0.55,
  p_rel_share  numeric DEFAULT 0.08,
  p_min_agents integer DEFAULT 8
)
RETURNS TABLE (
  game_id          text,
  game_date        date,
  agents           integer,
  side             text,
  side_agents      integer,
  market_agents    integer,
  market_label     text,
  agreement        numeric,
  threshold        integer,
  flagged          boolean,
  runner_up_side   text,
  runner_up_agents integer,
  slate_rank       integer,
  slate_games      integer,
  avatars          jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.tiered_agent_access_restricted(auth.uid()) THEN
    RAISE EXCEPTION 'Agent access requires WagerProof Pro' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
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
    SELECT sc.game_id, sc.game_date, count(DISTINCT sc.avatar_id)::int AS agents
    FROM scoped sc
    GROUP BY sc.game_id, sc.game_date
  ),
  per_market AS (
    -- The comparable population: one bet shape on one game.
    SELECT sc.game_id, sc.game_date, sc.bet_type, sc.period,
           count(DISTINCT sc.avatar_id)::int AS market_agents
    FROM scoped sc
    GROUP BY sc.game_id, sc.game_date, sc.bet_type, sc.period
  ),
  per_side AS (
    -- Sides are compared case-insensitively but reported verbatim. Grouped by
    -- market as well as selection: F5 stays SEPARATE from its full-game
    -- equivalent ("Twins F5 ML" is a different bet from "Twins ML"), and the
    -- same string under two bet_types must not be merged.
    SELECT
      sc.game_id, sc.game_date, sc.bet_type, sc.period,
      lower(sc.selection)               AS norm,
      min(sc.selection)                 AS label,
      count(DISTINCT sc.avatar_id)::int AS side_agents
    FROM scoped sc
    GROUP BY sc.game_id, sc.game_date, sc.bet_type, sc.period, lower(sc.selection)
  ),
  per_side_ranked AS (
    -- Rank WITHIN a market so the runner-up is comparable to the winner. Ranking
    -- across markets instead would let the 2nd row come from a different bet
    -- shape, and the bar segments would no longer sum to market_agents.
    -- label ASC breaks ties deterministically so the card doesn't flip between
    -- two equally-backed sides on refetch.
    SELECT
      ps.*,
      row_number() OVER (
        PARTITION BY ps.game_id, ps.game_date, ps.bet_type, ps.period
        ORDER BY ps.side_agents DESC, ps.label ASC
      ) AS rn
    FROM per_side ps
  ),
  top_side AS (
    -- The winning selection for the game: the strongest market leader.
    SELECT DISTINCT ON (psr.game_id, psr.game_date)
      psr.game_id, psr.game_date, psr.bet_type, psr.period, psr.norm, psr.label, psr.side_agents
    FROM per_side_ranked psr
    WHERE psr.rn = 1
    ORDER BY psr.game_id, psr.game_date, psr.side_agents DESC, psr.label ASC
  ),
  runner_up AS (
    SELECT
      r.game_id,
      r.game_date,
      r.label       AS runner_up_side,
      r.side_agents AS runner_up_agents
    FROM per_side_ranked r
    JOIN top_side t ON t.game_id = r.game_id AND t.game_date = r.game_date
      AND t.bet_type = r.bet_type AND t.period = r.period
    WHERE r.rn = 2
  ),
  day_scale AS (
    -- "Picking agents" is the SUM of per-game distinct agent counts
    -- (agent-games), NOT distinct agents across the slate. That is the
    -- denominator the 8% was calibrated against — swapping it silently
    -- re-tunes the flag rate.
    SELECT
      pg.game_date,
      GREATEST(p_min_agents, ceil(p_rel_share * sum(pg.agents))::int) AS threshold
    FROM per_game pg
    GROUP BY pg.game_date
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
  ),
  scored AS (
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
      r.runner_up_side,
      r.runner_up_agents,
      COALESCE(s.avatars, '[]'::jsonb) AS avatars
    FROM per_game   g
    JOIN top_side   t ON t.game_id = g.game_id AND t.game_date = g.game_date
    JOIN per_market m ON m.game_id = t.game_id AND m.game_date = t.game_date
      AND m.bet_type = t.bet_type AND m.period = t.period
    JOIN day_scale  d ON d.game_date = g.game_date
    LEFT JOIN runner_up r ON r.game_id = g.game_id AND r.game_date = g.game_date
    LEFT JOIN stack     s ON s.game_id = g.game_id AND s.game_date = g.game_date
  )
  SELECT
    sc.game_id,
    sc.game_date,
    sc.agents,
    sc.side,
    sc.side_agents,
    sc.market_agents,
    sc.market_label,
    sc.agreement,
    sc.threshold,
    sc.flagged,
    sc.runner_up_side,
    sc.runner_up_agents,
    -- Flagged games sort above everything so "#1 today" always names a game the
    -- product is actually pointing at; agreement then side_agents rank the rest,
    -- and game_id is the deterministic tiebreak so the rank can't shuffle
    -- between two identical rows on refetch.
    --
    -- ONLY markets with a real field are ranked. A 1-agent market scores 100%
    -- agreement for free, so ranking on agreement alone put "Boston Red Sox
    -- -1.5, 1 of 1" at #10 of 15 — above an 11-agent coin flip — and let a card
    -- print "TOO FEW" and "#6 of 15 today" together. Below the cutoff both the
    -- rank and its denominator are NULL and the clients drop the line, which is
    -- the same bar `verdict` uses for TOO_FEW, so the two can never disagree.
    CASE WHEN sc.market_agents >= 3 THEN
      row_number() OVER (
        PARTITION BY sc.game_date, (sc.market_agents >= 3)
        ORDER BY sc.flagged DESC, sc.agreement DESC NULLS LAST, sc.side_agents DESC, sc.game_id
      )::int
    END AS slate_rank,
    CASE WHEN sc.market_agents >= 3 THEN
      count(*) FILTER (WHERE sc.market_agents >= 3) OVER (PARTITION BY sc.game_date)::int
    END AS slate_games,
    sc.avatars
  FROM scored sc
  ORDER BY sc.game_date, sc.side_agents DESC;
END;
$$;
