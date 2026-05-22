-- Daily AI-generated pitcher matchups report. Mirrors mlb_regression_report:
-- structured JSONB findings (computed in Python) + an AI narrative written
-- by gpt-4o over those findings. Keyed by report_date so re-runs upsert.
CREATE TABLE IF NOT EXISTS public.mlb_pitcher_matchups_report (
  report_date         date PRIMARY KEY,
  season              smallint,
  generated_at        timestamptz,
  generation_version  integer DEFAULT 1,
  games_count         integer,
  -- 'confirmed' (all games have official cards), 'partial' (mix), or
  -- 'projected' (no confirmed lineups yet — report is preliminary).
  lineups_status      text,
  -- Slate-wide ranked findings: hr_opportunities, hottest_batters,
  -- pitcher_advantages, pitcher_disadvantages, notable_pitch_matchups.
  top_plays           jsonb,
  -- Per-game deep dives (one object per game with its notable matchups).
  game_breakdowns     jsonb,
  narrative_text      text,
  narrative_model     text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

COMMENT ON TABLE public.mlb_pitcher_matchups_report IS
  'Daily pitcher/batter matchup report for the pitcher-matchups page. '
  'Edge engine computed in Python (mlb_pitcher_matchups_report.py); narrative '
  'written by gpt-4o via the MLB_PITCHER_MATCHUPS OpenAI key. Upserted on report_date.';
