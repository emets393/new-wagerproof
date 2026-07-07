-- Allow multiple distinct player props from the same game while preserving the
-- one-pick-per-game-market rule for straight markets.
--
-- The original unique_avatar_pick constraint keyed every pick by
-- (avatar_id, game_id, bet_type). That works for spread/moneyline/total, but it
-- collapses every player prop in a game into the same "prop" bucket. V3 can
-- legitimately generate multiple signal-backed props for one game, so the
-- uniqueness identity has to include prop dimensions for bet_type='prop'.

ALTER TABLE public.avatar_picks
  ADD COLUMN IF NOT EXISTS pick_identity text GENERATED ALWAYS AS (
    CASE
      WHEN bet_type = 'prop' THEN
        lower(coalesce(prop_player, '')) || '|' ||
        lower(coalesce(prop_market, '')) || '|' ||
        coalesce(prop_line::text, '') || '|' ||
        lower(coalesce(prop_direction, ''))
      ELSE
        bet_type
    END
  ) STORED;

ALTER TABLE public.avatar_picks
  DROP CONSTRAINT IF EXISTS unique_avatar_pick;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.avatar_picks'::regclass
      AND conname = 'unique_avatar_pick_identity'
  ) THEN
    ALTER TABLE public.avatar_picks
      ADD CONSTRAINT unique_avatar_pick_identity
      UNIQUE (avatar_id, game_id, bet_type, pick_identity);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_avatar_picks_prop_identity
  ON public.avatar_picks (avatar_id, game_id, prop_player, prop_market, prop_line, prop_direction)
  WHERE bet_type = 'prop';
