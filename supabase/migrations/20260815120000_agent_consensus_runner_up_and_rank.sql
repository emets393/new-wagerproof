-- =============================================================================
-- Agent consensus — return the runner-up side and the slate rank
--
-- Supersedes 20260729140000_agent_consensus_market_scoped.sql. That migration's
-- market-scoped agreement math is carried over VERBATIM here; the calibration
-- constants (p_min_share / p_rel_share / p_min_agents) and the `day_scale`
-- denominator are untouched. This change is presentational.
--
-- NOTE ON PROD DRIFT: as of 2026-08-15 the deployed function was still the
-- 20260726 original — a live call returned neither `market_agents` nor
-- `market_label`, which is why the widget read "MOST-BACKED SIDE" instead of
-- "MOST-BACKED SPREAD" and divided agreement by the whole-game population.
-- Applying THIS migration also lands the market scoping; 20260729 does not need
-- to be applied separately.
--
-- WHY: the card said "51% agreement" and drew the other 49% as an unlabelled
-- grey remainder, so a coin flip read as a lean. It also printed
-- "flag needs 13" — the agent-COUNT gate only — while `flagged` is
-- `side_agents >= threshold AND agreement >= p_min_share`. A game could satisfy
-- the printed gate, sit visibly past the tick, and still not flag, with nothing
-- on screen explaining why.
--
-- WHAT'S NEW:
--   runner_up_side / runner_up_agents  the 2nd-most-backed selection IN THE
--                                      WINNER'S MARKET, so the three bar
--                                      segments sum to market_agents.
--   slate_rank / slate_games           where this game sits on its own date,
--                                      so "51%" can be read against the board
--                                      instead of against nothing.
--
-- The runner-up is "the second-most-backed selection", NOT "the other side".
-- `pick_selection` is unnormalized (odds are sometimes embedded, alt lines
-- exist), so the remainder is genuinely "everything else in this market" and
-- the clients label it that way.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_game_agent_consensus(text, date[], numeric, numeric, integer);

CREATE FUNCTION public.get_game_agent_consensus(
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
  per_side_ranked AS (
    -- Rank WITHIN a market so the runner-up is comparable to the winner. Ranking
    -- across markets instead would let the 2nd row come from a different bet
    -- shape, and the bar segments would no longer sum to market_agents.
    -- label ASC breaks ties deterministically so the card doesn't flip between
    -- two equally-backed sides on refetch.
    SELECT
      *,
      row_number() OVER (
        PARTITION BY game_id, game_date, bet_type, period
        ORDER BY side_agents DESC, label ASC
      ) AS rn
    FROM per_side
  ),
  top_side AS (
    -- The winning selection for the game: the strongest market leader.
    SELECT DISTINCT ON (game_id, game_date)
      game_id, game_date, bet_type, period, norm, label, side_agents
    FROM per_side_ranked
    WHERE rn = 1
    ORDER BY game_id, game_date, side_agents DESC, label ASC
  ),
  runner_up AS (
    SELECT
      r.game_id,
      r.game_date,
      r.label       AS runner_up_side,
      r.side_agents AS runner_up_agents
    FROM per_side_ranked r
    JOIN top_side t USING (game_id, game_date, bet_type, period)
    WHERE r.rn = 2
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
    JOIN top_side   t USING (game_id, game_date)
    JOIN per_market m USING (game_id, game_date, bet_type, period)
    JOIN day_scale  d USING (game_date)
    LEFT JOIN runner_up r USING (game_id, game_date)
    LEFT JOIN stack     s USING (game_id, game_date)
  )
  SELECT
    game_id,
    game_date,
    agents,
    side,
    side_agents,
    market_agents,
    market_label,
    agreement,
    threshold,
    flagged,
    runner_up_side,
    runner_up_agents,
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
    CASE WHEN market_agents >= 3 THEN
      row_number() OVER (
        PARTITION BY game_date, (market_agents >= 3)
        ORDER BY flagged DESC, agreement DESC NULLS LAST, side_agents DESC, game_id
      )::int
    END AS slate_rank,
    CASE WHEN market_agents >= 3 THEN
      count(*) FILTER (WHERE market_agents >= 3) OVER (PARTITION BY game_date)::int
    END AS slate_games,
    avatars
  FROM scored
  ORDER BY game_date, side_agents DESC;
$$;

COMMENT ON FUNCTION public.get_game_agent_consensus(text, date[], numeric, numeric, integer) IS
  'Per-game public-agent consensus for the /games feed: participation count, most-backed side, the market that side belongs to, agreement WITHIN that market, the runner-up selection in that same market, where the game ranks on its slate, and whether it clears the scaled flag threshold. SECURITY DEFINER because avatar_picks RLS hides all rows from anon.';

GRANT EXECUTE ON FUNCTION public.get_game_agent_consensus(text, date[], numeric, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_agent_consensus(text, date[], numeric, numeric, integer) TO anon;
