-- ============================================================================
-- Migration: structured player-prop columns on avatar_parlay_legs (V3 agents)
--
-- The avatar_parlay_legs.bet_type CHECK already allows 'prop' (added in
-- 20260622000001_avatar_parlays.sql, where prop player/market/line/dir were
-- noted as living in archived_game_data). These four nullable columns lift
-- those fields out into structured columns — mirroring avatar_picks' prop cols
-- (20260622000003_avatar_picks_props.sql) — so the parlay grader can resolve a
-- prop leg via gradeProp (player_id bridge + nfl_player_game_logs) instead of
-- re-parsing archived_game_data. NFL-only, signal-gated; only set on prop legs,
-- straight legs leave them NULL. See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md.
-- ============================================================================

ALTER TABLE public.avatar_parlay_legs
  ADD COLUMN IF NOT EXISTS prop_player TEXT,
  ADD COLUMN IF NOT EXISTS prop_market TEXT,
  ADD COLUMN IF NOT EXISTS prop_line NUMERIC,
  ADD COLUMN IF NOT EXISTS prop_direction TEXT;

ALTER TABLE public.avatar_parlay_legs
  ADD CONSTRAINT avatar_parlay_legs_prop_direction_check
    CHECK (prop_direction IS NULL OR prop_direction IN ('over', 'under'));

COMMENT ON COLUMN public.avatar_parlay_legs.prop_player IS
  'Player name for a prop leg (bet_type=''prop''). NULL for non-prop legs.';
COMMENT ON COLUMN public.avatar_parlay_legs.prop_market IS
  'Prop market key for a prop leg (e.g. passing_yards). NULL for non-prop legs.';
COMMENT ON COLUMN public.avatar_parlay_legs.prop_line IS
  'Posted line for a prop leg, copied verbatim from get_props. NULL for non-prop legs.';
COMMENT ON COLUMN public.avatar_parlay_legs.prop_direction IS
  'Over/under side for a prop leg. NULL for non-prop legs.';
