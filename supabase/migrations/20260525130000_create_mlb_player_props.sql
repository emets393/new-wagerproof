-- Current MLB player-prop lines (DraftKings via The Odds API), upsert-latest
-- per (game_pk, bookmaker, market, player_name). The matchups page reads the
-- live line + odds here and joins player_id to mlb_batter_logs / mlb_pitcher_logs
-- for last-10 hit/miss. Ingested by scripts/mlb/mlb_fetch_player_props.py
-- (cfb_automation) via the mlb-player-props workflow (3/5/7pm ET).
--
-- market -> stat column for L10 hit/miss:
--   batter_home_runs->home_runs, batter_hits->hits, batter_total_bases->total_bases,
--   batter_rbis->rbi, batter_hits_runs_rbis->hits_runs_rbis, batter_walks->walks,
--   batter_strikeouts->strikeouts (mlb_batter_logs);
--   pitcher_strikeouts->strikeouts, pitcher_hits_allowed->hits_allowed,
--   pitcher_walks->walks, pitcher_outs->round(ip_official*3) (mlb_pitcher_logs).
CREATE TABLE IF NOT EXISTS public.mlb_player_props (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_pk       bigint  NOT NULL,
  official_date date,
  bookmaker     text    NOT NULL,
  market        text    NOT NULL,
  player_name   text    NOT NULL,
  player_id     integer,
  is_pitcher    boolean NOT NULL DEFAULT false,
  line          numeric(4,1),
  over_odds     integer,
  under_odds    integer,
  home_team     text,
  away_team     text,
  fetched_at    timestamptz,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (game_pk, bookmaker, market, player_name)
);
CREATE INDEX IF NOT EXISTS mlb_player_props_game_idx       ON public.mlb_player_props (game_pk);
CREATE INDEX IF NOT EXISTS mlb_player_props_player_mkt_idx ON public.mlb_player_props (player_id, market);
CREATE INDEX IF NOT EXISTS mlb_player_props_date_idx       ON public.mlb_player_props (official_date);

COMMENT ON TABLE public.mlb_player_props IS
  'Current MLB player-prop lines (DraftKings via The Odds API), upsert-latest per '
  '(game_pk, bookmaker, market, player_name). UI joins player_id to mlb_batter_logs / '
  'mlb_pitcher_logs for last-10 hit/miss.';
