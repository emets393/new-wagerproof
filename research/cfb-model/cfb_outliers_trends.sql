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

-- 3) Pre-rendered Outliers cards (teams + coaches). Populated by gen_cfb_outliers_trend_cards.py.
-- Full DDL also lives in supabase/migrations/20260622130000_cfb_outliers_trend_cards.sql
CREATE TABLE IF NOT EXISTS public.cfb_outliers_trend_cards (
  card_id text PRIMARY KEY,
  season integer NOT NULL,
  week integer NOT NULL,
  through_week integer NOT NULL,
  game_id text NOT NULL,
  matchup_label text NOT NULL,
  subject_kind text NOT NULL CHECK (subject_kind IN ('team', 'coach')),
  subject_name text NOT NULL,
  subject_detail text,
  team_abbr text,
  player_id text,
  market_key text NOT NULL,
  bet_type_label text NOT NULL,
  trend_value numeric NOT NULL,
  trend_sample_n integer NOT NULL,
  sort_rank numeric NOT NULL,
  trend_hit_side boolean NOT NULL,
  headshot_url text,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  betting_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  betting_lines_updated_at timestamptz,
  is_player_overflow boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cfb_outliers_trend_cards_slate ON public.cfb_outliers_trend_cards (season, week);
CREATE INDEX IF NOT EXISTS idx_cfb_outliers_trend_cards_game ON public.cfb_outliers_trend_cards (game_id);
CREATE INDEX IF NOT EXISTS idx_cfb_outliers_trend_cards_sort ON public.cfb_outliers_trend_cards (season, week, sort_rank DESC);
ALTER TABLE public.cfb_outliers_trend_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read cfb_outliers_trend_cards" ON public.cfb_outliers_trend_cards;
CREATE POLICY "Public read cfb_outliers_trend_cards" ON public.cfb_outliers_trend_cards FOR SELECT USING (true);
