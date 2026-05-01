-- Add `period` to avatar_picks so MLB agents can return F5 picks
-- alongside full-game picks under the same `bet_type` enum.
--
-- Bet-type matrix for MLB after this migration:
--   bet_type=moneyline + period=full  -> Full game ML
--   bet_type=moneyline + period=f5    -> First 5 innings ML
--   bet_type=spread    + period=full  -> Full game runline (typically -1.5)
--   bet_type=spread    + period=f5    -> F5 runline (typically -0.5)
--   bet_type=total     + period=full  -> Full game O/U
--   bet_type=total     + period=f5    -> F5 O/U
--
-- For non-MLB sports the column stays 'full' — a no-op.
-- Default 'full' so existing picks (all of which are full-game) need
-- no backfill and the grader logic doesn't break for legacy rows.

ALTER TABLE public.avatar_picks
  ADD COLUMN IF NOT EXISTS period text NOT NULL DEFAULT 'full';

ALTER TABLE public.avatar_picks
  ADD CONSTRAINT avatar_picks_period_check
    CHECK (period IN ('full', 'f5'));

COMMENT ON COLUMN public.avatar_picks.period IS
  'Game period for the bet. ''full'' = whole game (default). ''f5'' = '
  'first 5 innings (MLB only). Combined with bet_type to express six '
  'MLB bet shapes: full/f5 × moneyline/spread/total.';

-- Index so the grader can scope F5 vs full game queries cheaply when
-- it needs to fetch grading-relevant picks per period.
CREATE INDEX IF NOT EXISTS avatar_picks_period_idx
  ON public.avatar_picks (period)
  WHERE result = 'pending';
