-- mlb_inning_scores
-- ==================
-- Per-game half-inning scoring, backfilled from MLB Stats API
-- (https://statsapi.mlb.com/api/v1/game/{game_pk}/linescore).
--
-- Why
-- ---
-- Two analyses we want to enable:
--   1. Walk-off "hangover/bounce-back" angle — does a team's next-game
--      performance differ after a walk-off loss/win? Needs per-inning
--      data to identify walk-offs reliably.
--   2. NRFI/YRFI model — first-inning over/under is a thinner market
--      than full-game ML and a more promising venue for finding edge.
--
-- Schema choice
-- -------------
-- One row per game with explicit per-inning columns 1-9 for fast NRFI
-- queries. Innings 10+ are stored as a JSONB array since few games go
-- that deep. Walk-off and NRFI flags are pre-computed on insert so
-- analysis queries don't have to redo the logic.
--
-- A NULL inning column means the half-inning was not played
-- (e.g. home walks off in the bottom of the 9th and never bats further;
-- or game was rained out before reaching that inning).

CREATE TABLE IF NOT EXISTS public.mlb_inning_scores (
  game_pk          BIGINT       PRIMARY KEY,
  official_date    DATE         NOT NULL,
  season           SMALLINT     NOT NULL,
  home_team_abbr   TEXT,
  away_team_abbr   TEXT,
  home_team_id     INTEGER,
  away_team_id     INTEGER,

  -- Final game state
  home_total_runs  SMALLINT     NOT NULL,
  away_total_runs  SMALLINT     NOT NULL,
  final_inning     SMALLINT     NOT NULL,  -- last inning played (>= 9)
  home_won         BOOLEAN,                -- denormalized for query speed

  -- Per-inning scoring (NULL = inning not played for that half)
  home_inn1 SMALLINT, away_inn1 SMALLINT,
  home_inn2 SMALLINT, away_inn2 SMALLINT,
  home_inn3 SMALLINT, away_inn3 SMALLINT,
  home_inn4 SMALLINT, away_inn4 SMALLINT,
  home_inn5 SMALLINT, away_inn5 SMALLINT,
  home_inn6 SMALLINT, away_inn6 SMALLINT,
  home_inn7 SMALLINT, away_inn7 SMALLINT,
  home_inn8 SMALLINT, away_inn8 SMALLINT,
  home_inn9 SMALLINT, away_inn9 SMALLINT,

  -- Innings 10+ as raw JSONB: [{"inning":10,"home":1,"away":0}, ...]
  extra_innings    JSONB,

  -- Pre-computed flags for common queries
  is_walkoff       BOOLEAN      NOT NULL DEFAULT FALSE,
  walkoff_inning   SMALLINT,
  nrfi             BOOLEAN,                -- TRUE iff inn1 home+away = 0
  yrfi             BOOLEAN,                -- inverse of nrfi

  -- F5 totals (for cross-check vs mlb_game_log.f5_runs_*)
  f5_home_runs     SMALLINT,
  f5_away_runs     SMALLINT,

  fetched_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  source           TEXT         NOT NULL DEFAULT 'mlb_stats_api'
);

CREATE INDEX IF NOT EXISTS mlb_inning_scores_official_date_idx
  ON public.mlb_inning_scores (official_date);
CREATE INDEX IF NOT EXISTS mlb_inning_scores_season_idx
  ON public.mlb_inning_scores (season);
CREATE INDEX IF NOT EXISTS mlb_inning_scores_home_abbr_idx
  ON public.mlb_inning_scores (home_team_abbr);
CREATE INDEX IF NOT EXISTS mlb_inning_scores_away_abbr_idx
  ON public.mlb_inning_scores (away_team_abbr);
CREATE INDEX IF NOT EXISTS mlb_inning_scores_walkoff_idx
  ON public.mlb_inning_scores (is_walkoff) WHERE is_walkoff;
CREATE INDEX IF NOT EXISTS mlb_inning_scores_nrfi_idx
  ON public.mlb_inning_scores (nrfi);

COMMENT ON TABLE public.mlb_inning_scores IS
  'Per-game half-inning scoring backfilled from MLB Stats API. Drives NRFI/YRFI modeling and walk-off angle analysis. See migration 20260509120000.';
