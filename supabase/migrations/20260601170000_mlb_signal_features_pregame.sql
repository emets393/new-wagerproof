-- mlb_signal_features_pregame: one row per (game_pk, team_abbr) with
-- point-in-time features that drive the validated signal rules
-- (g2_blowout_*, transition_collision, g3/g4 series spots).
--
-- Populated by scripts/mlb/mlb_feature_eng_signal_inputs.py. Trainer and
-- runner pull from here just like mlb_starter_pregame / mlb_batting_pregame.
--
-- All numeric fields are computed point-in-time (i.e., reflect the team's
-- state BEFORE the listed game_pk). Safe to feed directly into ML training
-- without further leak guards.

CREATE TABLE IF NOT EXISTS public.mlb_signal_features_pregame (
  game_pk                      bigint  NOT NULL,
  official_date                date    NOT NULL,
  season                       int     NOT NULL,
  team_abbr                    text    NOT NULL,
  opp_team_abbr                text,
  home_away                    text,   -- 'home' | 'away'

  -- g2_blowout signals
  team_prev_game_margin        numeric,   -- signed: runs - opp_runs, prior game
  team_prev_game_was_blowout   boolean,   -- abs(margin) >= 5

  -- Transition spot detection
  team_prev_loc_opposite       boolean,   -- prev game's home_away != current
  team_home_back_delta         numeric,   -- when home + prev was away: team's
                                          -- avg R in prior home-back games
                                          -- minus season avg (NULL if n<3)
  team_away_out_delta          numeric,   -- mirror for away-out games
  team_n_prior_home_backs      int,       -- count of prior home-back games
  team_n_prior_away_outs       int,       -- count of prior away-out games

  -- Series context (gaps-and-islands derived)
  series_game_number           int,       -- 1, 2, 3, 4+ within current series
  team_series_wins_so_far      int,       -- wins in current series BEFORE this game
  team_series_runs_so_far      numeric,   -- runs scored in current series BEFORE this game

  -- Chronic home/road split (the "team plays 10x better at home" thing)
  team_home_minus_road_runs       numeric,  -- season-to-date avg R at home minus avg R on road
  team_home_minus_road_f5_runs    numeric,  -- same on F5 runs

  -- Chronic platoon split (the "team can't hit lefties" thing)
  team_vs_LHP_minus_RHP_runs      numeric,  -- avg R vs LHP minus vs RHP (signed: + = LHP-killer)
  team_vs_LHP_minus_RHP_f5_runs   numeric,  -- same on F5 runs
  team_n_games_vs_LHP             int,      -- sample size — used to gate the platoon delta
  team_n_games_vs_RHP             int,

  computed_at                  timestamptz DEFAULT now(),
  PRIMARY KEY (game_pk, team_abbr)
);

CREATE INDEX IF NOT EXISTS idx_sig_features_season_date
  ON public.mlb_signal_features_pregame (season, official_date);
CREATE INDEX IF NOT EXISTS idx_sig_features_team_season_date
  ON public.mlb_signal_features_pregame (team_abbr, season, official_date);

GRANT SELECT ON public.mlb_signal_features_pregame
  TO anon, authenticated, service_role;

COMMENT ON TABLE public.mlb_signal_features_pregame IS
'Point-in-time features driving the validated signal rules. Populated by
scripts/mlb/mlb_feature_eng_signal_inputs.py. Read by trainer + runner to
feed the ML model the same inputs that the signal engine threshold-rules
operate on.';
