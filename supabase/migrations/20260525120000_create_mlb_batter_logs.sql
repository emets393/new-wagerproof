-- Per-batter per-game box-score counting stats from MLB Stats API boxscores.
-- Powers the player-prop L10 hit/miss feature for batter markets. Mirrors
-- mlb_pitcher_logs (which already covers pitcher prop markets). Counting stats
-- only (the official box score is the authoritative source for props) — no
-- Statcast enrichment needed. Ingested by scripts/mlb/mlb_fetch_batter_logs.py
-- (cfb_automation repo) via the mlb-batter-logs workflow.
CREATE TABLE IF NOT EXISTS public.mlb_batter_logs (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season             smallint NOT NULL,
  game_pk            bigint   NOT NULL,
  official_date      date,
  game_type          text,
  player_id          integer  NOT NULL,
  player_name        text,
  team_id            integer  NOT NULL,
  team_name          text,
  opponent_team_id   integer,
  opponent_team_name text,
  home_away          text,
  bat_side           text,
  lineup_spot        smallint,
  plate_appearances  smallint,
  at_bats            smallint,
  hits               smallint,
  doubles            smallint,
  triples            smallint,
  home_runs          smallint,
  total_bases        smallint,
  rbi                smallint,
  runs               smallint,
  walks              smallint,
  strikeouts         smallint,
  hit_by_pitch       smallint,
  stolen_bases       smallint,
  hits_runs_rbis     smallint GENERATED ALWAYS AS
                       (COALESCE(hits,0) + COALESCE(runs,0) + COALESCE(rbi,0)) STORED,
  created_at         timestamptz DEFAULT now(),
  UNIQUE (game_pk, player_id, team_id)
);
CREATE INDEX IF NOT EXISTS mlb_batter_logs_player_date_idx ON public.mlb_batter_logs (player_id, official_date DESC);
CREATE INDEX IF NOT EXISTS mlb_batter_logs_season_idx       ON public.mlb_batter_logs (season);

COMMENT ON TABLE public.mlb_batter_logs IS
  'Per-batter per-game box-score counting stats (MLB Stats API boxscores). Powers '
  'player-prop last-10 hit/miss for batter markets: home_runs, hits, total_bases, '
  'rbi, walks, strikeouts, and the generated hits_runs_rbis. Mirrors mlb_pitcher_logs.';
