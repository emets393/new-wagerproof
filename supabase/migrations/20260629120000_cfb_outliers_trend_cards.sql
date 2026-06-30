-- CFB Outliers Trends — team splits/matchups columns + the coach trends table.
-- Mirror of 20260622120000_nfl_outliers_trend_cards.sql (NFL) for College Football.
-- Populated by research/cfb-model/gen_cfb_team_trends.py + gen_cfb_coach_trends.py.
-- CFB has only TEAM + COACH trends (no referee / player-prop data).

-- Team trends: Outliers jsonb columns (season-scoped splits + cross-season H2H matchups).
ALTER TABLE public.cfb_team_trends ADD COLUMN IF NOT EXISTS splits jsonb;
ALTER TABLE public.cfb_team_trends ADD COLUMN IF NOT EXISTS matchups jsonb;

-- Coach trends: per head coach CAREER betting trends (windows 5/10/15, 9 dims, 6 markets).
CREATE TABLE IF NOT EXISTS public.cfb_coach_trends (
  coach           text    NOT NULL,
  current_team    text,
  career_games    integer,
  first_season    integer,
  last_season     integer,
  through_season  integer NOT NULL,
  through_week    integer NOT NULL,
  splits          jsonb,
  matchups        jsonb,
  market_coverage jsonb,
  recent_game_log jsonb,
  updated_at      timestamptz DEFAULT now(),
  PRIMARY KEY (coach, through_season, through_week)
);

CREATE INDEX IF NOT EXISTS idx_cfb_coach_trends_slate
  ON public.cfb_coach_trends (through_season, through_week);

COMMENT ON TABLE public.cfb_coach_trends IS
  'Per head coach career betting trends for the Outliers tab; CFB "division" key = conference game.';

ALTER TABLE public.cfb_coach_trends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read cfb_coach_trends" ON public.cfb_coach_trends;
CREATE POLICY "public read cfb_coach_trends" ON public.cfb_coach_trends FOR SELECT USING (true);
