-- ============================================================================
-- Migration: make first-half (1H) + team-total markets STAKEABLE (V3 agents)
--
-- NFL/CFB V3 agents can already SEE the 1H model (get_first_half) and the
-- team-total model (get_team_totals), but until now the write path capped at
-- period IN ('full','f5') and bet_type IN ('spread','moneyline','total','prop'),
-- so neither could be bet. This migration opens both markets:
--
--   period 'h1'        — first half (NFL/CFB). Combined with spread/moneyline/
--                        total it expresses the three 1H bet shapes. Mirrors how
--                        'f5' (MLB) already works. Graded against the h1_* fields
--                        of football_game_results (grade-avatar-picks).
--   bet_type 'team_total' — a single team's total points (NFL/CFB). The team is
--                        named in pick_selection (e.g. "Buffalo Bills Over 24.5");
--                        period stays 'full'. Graded against that team's full-game
--                        score from football_game_results.
--
-- ADD-ONLY: full-game / prop / MLB-F5 behavior is untouched — we only widen the
-- two CHECK enums. avatar_parlay_legs.period already allows 'h1' (added in
-- 20260622000001_avatar_parlays.sql), so only its bet_type CHECK needs widening.
-- ============================================================================

-- 1. avatar_picks.period: add 'h1' (first half — NFL/CFB).
--    The check was created in 20260501140000_add_period_to_avatar_picks.sql as
--    ('full','f5'); drop + recreate it with 'h1'.
ALTER TABLE public.avatar_picks
  DROP CONSTRAINT avatar_picks_period_check;

ALTER TABLE public.avatar_picks
  ADD CONSTRAINT avatar_picks_period_check
    CHECK (period IN ('full', 'f5', 'h1'));

COMMENT ON COLUMN public.avatar_picks.period IS
  'Game period for the bet. ''full'' = whole game (default). ''f5'' = '
  'first 5 innings (MLB only). ''h1'' = first half (NFL/CFB only). Combined '
  'with bet_type to express the per-period bet shapes.';

-- 2. avatar_picks.bet_type: add 'team_total' (a single team''s total points,
--    NFL/CFB). The check was last recreated in 20260622000003_avatar_picks_props.sql
--    as ('spread','moneyline','total','prop'); drop + recreate it with 'team_total'.
ALTER TABLE public.avatar_picks
  DROP CONSTRAINT avatar_picks_bet_type_check;

ALTER TABLE public.avatar_picks
  ADD CONSTRAINT avatar_picks_bet_type_check
    CHECK (bet_type = ANY (ARRAY['spread', 'moneyline', 'total', 'prop', 'team_total']));

-- 3. avatar_parlay_legs.bet_type: add 'team_total' so a parlay leg can be a
--    team total too. period already allows 'h1' (inline CHECK in
--    20260622000001_avatar_parlays.sql), so 1H legs need no change here.
--    The inline CREATE TABLE CHECK is named avatar_parlay_legs_bet_type_check.
ALTER TABLE public.avatar_parlay_legs
  DROP CONSTRAINT avatar_parlay_legs_bet_type_check;

ALTER TABLE public.avatar_parlay_legs
  ADD CONSTRAINT avatar_parlay_legs_bet_type_check
    CHECK (bet_type IN ('spread', 'moneyline', 'total', 'prop', 'team_total'));
