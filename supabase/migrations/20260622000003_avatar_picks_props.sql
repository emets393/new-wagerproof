-- ============================================================================
-- Migration: STRAIGHT player-prop picks on avatar_picks (V3 agent engine)
--
-- Adds 'prop' as a fourth bet_type plus four nullable structured prop columns.
-- Props are NFL-only and signal-gated (only props get_props surfaced as bettable
-- can be staked). See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md.
--
-- IMPORTANT: this migration is ADD-ONLY. The unique_avatar_pick
-- UNIQUE(avatar_id, game_id, bet_type) key is intentionally LEFT UNCHANGED.
-- Two props in one game both key to (avatar_id, game_id, 'prop'), so they would
-- collide on that index — props therefore use a delete-then-insert write path in
-- tools/submitPicks.ts (delete all prop rows for the game, then plain insert),
-- NOT the per-row upsert the straights use. Relaxing the unique key here would
-- ripple into the live straights upsert + payout RPC, so we don't touch it.
-- ============================================================================

-- 1. Allow 'prop' as a bet_type (drop + recreate the inline CHECK from the
--    original CREATE TABLE in 20260205000001_create_avatar_tables.sql).
ALTER TABLE public.avatar_picks
  DROP CONSTRAINT avatar_picks_bet_type_check;

ALTER TABLE public.avatar_picks
  ADD CONSTRAINT avatar_picks_bet_type_check
    CHECK (bet_type = ANY (ARRAY['spread', 'moneyline', 'total', 'prop']));

-- 2. Structured prop columns. Nullable — only set on rows where bet_type='prop';
--    straights leave them NULL. These mirror the get_props result fields verbatim
--    (player name, market, posted line, over/under) so the grader can resolve the
--    prop without re-parsing pick_selection.
ALTER TABLE public.avatar_picks
  ADD COLUMN IF NOT EXISTS prop_player TEXT,
  ADD COLUMN IF NOT EXISTS prop_market TEXT,
  ADD COLUMN IF NOT EXISTS prop_line NUMERIC,
  ADD COLUMN IF NOT EXISTS prop_direction TEXT;

ALTER TABLE public.avatar_picks
  ADD CONSTRAINT avatar_picks_prop_direction_check
    CHECK (prop_direction IS NULL OR prop_direction IN ('over', 'under'));

COMMENT ON COLUMN public.avatar_picks.prop_player IS
  'Player name for a prop pick (bet_type=''prop''). NULL for straights.';
COMMENT ON COLUMN public.avatar_picks.prop_market IS
  'Prop market key for a prop pick (e.g. passing_yards). NULL for straights.';
COMMENT ON COLUMN public.avatar_picks.prop_line IS
  'Posted line for a prop pick, copied verbatim from get_props. NULL for straights.';
COMMENT ON COLUMN public.avatar_picks.prop_direction IS
  'Over/under side for a prop pick. NULL for straights.';
