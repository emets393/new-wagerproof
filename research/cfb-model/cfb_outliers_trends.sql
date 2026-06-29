-- CFB Outliers Trends — DDL for the team-splits/matchups columns + the coach trends table.
-- Apply ONCE in the Supabase SQL editor of the DATA project (jpxnjuwglavsjbgbasnl) before running
-- gen_cfb_team_trends.py / gen_cfb_coach_trends.py. Mirrors the NFL Outliers schema so one Swift
-- code path renders both sports. Idempotent (IF NOT EXISTS + drop-then-create policy).

-- 1) Team trends: add the Outliers jsonb columns (overall records + game_log already exist).
ALTER TABLE public.cfb_team_trends ADD COLUMN IF NOT EXISTS splits jsonb;     -- {market:{dim:{window:{h,l,p,n,pct}}}} season-scoped
ALTER TABLE public.cfb_team_trends ADD COLUMN IF NOT EXISTS matchups jsonb;   -- {opp:{meetings,spread,moneyline,total}} cross-season

-- 2) Coach trends: NEW table (career, windows 5/10/15, 9 dims, 6 markets).
CREATE TABLE IF NOT EXISTS public.cfb_coach_trends (
  coach           text    NOT NULL,
  current_team    text,
  career_games    integer,
  first_season    integer,
  last_season     integer,
  through_season  integer NOT NULL,
  through_week    integer NOT NULL,
  splits          jsonb,            -- {market:{dim:{window:{h,l,p,n,pct}}}}, dims include division/non_division/primetime/regular
  matchups        jsonb,            -- {opp_team_name:{meetings, <6 markets>:{h,n,pct}}} career
  market_coverage jsonb,            -- {market:'<year-range>'} — FG 2016-2025, derivatives 2023-2025
  recent_game_log jsonb,            -- last 15 games, newest-first
  updated_at      timestamptz DEFAULT now(),
  PRIMARY KEY (coach, through_season, through_week)
);

CREATE INDEX IF NOT EXISTS idx_cfb_coach_trends_slate
  ON public.cfb_coach_trends (through_season, through_week);

ALTER TABLE public.cfb_coach_trends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read cfb_coach_trends" ON public.cfb_coach_trends;
CREATE POLICY "public read cfb_coach_trends" ON public.cfb_coach_trends FOR SELECT USING (true);
