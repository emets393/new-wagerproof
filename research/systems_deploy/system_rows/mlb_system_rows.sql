CREATE OR REPLACE FUNCTION public.mlb_system_rows(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb, p_include_opp boolean DEFAULT true)
 RETURNS TABLE(
  "game_pk" bigint,
  "is_home" boolean,
  "season" integer,
  "game_date" date,
  "month" integer,
  "time_et" time without time zone,
  "day_of_week" text,
  "is_doubleheader" boolean,
  "team_abbr" text,
  "opponent_abbr" text,
  "venue_name" text,
  "runs_scored" integer,
  "runs_allowed" integer,
  "margin" integer,
  "total_runs" integer,
  "f5_runs_scored" integer,
  "f5_runs_allowed" integer,
  "closing_ml" integer,
  "closing_total" numeric,
  "closing_runline" numeric,
  "f5_total_line" numeric,
  "is_favorite" boolean,
  "ml_won" integer,
  "ml_profit" numeric,
  "rl_covered" integer,
  "ou_over" integer,
  "f5_ml_won" integer,
  "f5_rl_covered" integer,
  "f5_over" integer,
  "series_game" integer,
  "trip_series_index" integer,
  "is_switch_game" boolean,
  "prev_result" text,
  "prev_margin" integer,
  "days_rest" integer,
  "win_loss_streak" integer,
  "is_divisional" boolean,
  "is_interleague" boolean,
  "sp_hand" text,
  "opp_sp_hand" text,
  "sp_season_xfip" numeric,
  "opp_sp_season_xfip" numeric,
  "sp_prior_starts" integer,
  "opp_bp_ip_last3d" numeric,
  "opp_bp_season_xfip" numeric,
  "temperature_f" numeric,
  "wind_speed_mph" numeric,
  "wind_dir" text,
  "is_dome" boolean,
  "pf_runs" numeric,
  "sp_id" integer,
  "sp_name" text,
  "opp_sp_id" integer,
  "opp_sp_name" text,
  "team_gp_s2d" integer,
  "team_wins_s2d" integer,
  "team_losses_s2d" integer,
  "team_win_pct" numeric,
  "team_win_streak" integer,
  "team_loss_streak" integer,
  "team_rl_wins_s2d" integer,
  "team_rl_cover_pct" numeric,
  "team_rl_streak" integer,
  "team_over_count_s2d" integer,
  "team_ou_games_s2d" integer,
  "team_over_pct" numeric,
  "team_over_streak" integer,
  "team_under_streak" integer,
  "team_rpg" numeric,
  "team_rapg" numeric,
  "team_run_diff_pg" numeric,
  "team_prev_wins" integer,
  "team_prev_win_pct" numeric,
  "h2h_last_win" integer,
  "h2h_last_over" integer,
  "h2h_last_margin" numeric,
  "h2h_last_season" integer,
  "h2h_same_season" boolean,
  "opp_gp_s2d" integer,
  "opp_wins_s2d" integer,
  "opp_losses_s2d" integer,
  "opp_win_pct" numeric,
  "opp_win_streak" integer,
  "opp_loss_streak" integer,
  "opp_rl_wins_s2d" integer,
  "opp_rl_cover_pct" numeric,
  "opp_rl_streak" integer,
  "opp_over_count_s2d" integer,
  "opp_ou_games_s2d" integer,
  "opp_over_pct" numeric,
  "opp_over_streak" integer,
  "opp_under_streak" integer,
  "opp_rpg" numeric,
  "opp_rapg" numeric,
  "opp_run_diff_pg" numeric,
  "opp_prev_wins" integer,
  "opp_prev_win_pct" numeric,
  "opp_prev_margin" numeric,
  "opp_prev_result" text,
  "rl_px" numeric,
  "total_over_px" numeric,
  "total_under_px" numeric,
  "f5_ml_px" numeric,
  "f5_rl_px" numeric,
  "f5_total_over_px" numeric,
  "f5_total_under_px" numeric,
  "last_rl_covered" integer,
  "last_ou_over" integer,
  "last_is_favorite" boolean,
  "opp_last_rl_covered" integer,
  "opp_last_ou_over" integer,
  "opp_last_is_favorite" boolean,
  "h2h_last_rl_cover" integer,
  "h2h_last_home" boolean,
  "h2h_last_fav" boolean,
  hit integer,
  bet_profit numeric,
  under_profit numeric,
  keep_game boolean,
  opp_hit integer,
  opp_profit numeric)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT b.*,
    
    CASE p_bet_type
      WHEN 'ml' THEN b.ml_won         WHEN 'rl' THEN b.rl_covered
      WHEN 'total' THEN b.ou_over     WHEN 'f5_ml' THEN b.f5_ml_won
      WHEN 'f5_rl' THEN b.f5_rl_covered WHEN 'f5_total' THEN b.f5_over
    END AS hit,
    CASE p_bet_type
      WHEN 'ml' THEN b.ml_profit
      WHEN 'rl' THEN CASE WHEN b.rl_covered=1 THEN COALESCE(b.rl_px-1, 0.909) ELSE -1 END
      WHEN 'total' THEN CASE WHEN b.ou_over=1 THEN COALESCE(b.total_over_px-1, 0.909) ELSE -1 END
      WHEN 'f5_ml' THEN CASE WHEN b.f5_ml_px IS NOT NULL THEN CASE WHEN b.f5_ml_won=1 THEN b.f5_ml_px-1 ELSE -1 END END
      WHEN 'f5_rl' THEN CASE WHEN b.f5_rl_covered=1 THEN COALESCE(b.f5_rl_px-1, 0.909) ELSE -1 END
      WHEN 'f5_total' THEN CASE WHEN b.f5_over=1 THEN COALESCE(b.f5_total_over_px-1, 0.909) ELSE -1 END
    END AS bet_profit,
    CASE p_bet_type
      WHEN 'total' THEN CASE WHEN b.ou_over=0 THEN COALESCE(b.total_under_px-1, 0.909) ELSE -1 END
      WHEN 'f5_total' THEN CASE WHEN b.f5_over=0 THEN COALESCE(b.f5_total_under_px-1, 0.909) ELSE -1 END
    END AS under_profit,
    true AS keep_game,
    opp.o_hit::integer AS opp_hit,
    opp.o_profit::numeric AS opp_profit
  FROM mlb_analysis_base b
  CROSS JOIN LATERAL (SELECT p_filters->>'bp_ip3d_max' AS "bp_ip3d_max_t",
    p_filters->>'bp_ip3d_min' AS "bp_ip3d_min_t",
    p_filters->>'bp_xfip_max' AS "bp_xfip_max_t",
    p_filters->>'bp_xfip_min' AS "bp_xfip_min_t",
    p_filters->>'division' AS "division_t",
    p_filters->>'dome' AS "dome_t",
    p_filters->>'doubleheader' AS "doubleheader_t",
    p_filters->>'f5_total_max' AS "f5_total_max_t",
    p_filters->>'f5_total_min' AS "f5_total_min_t",
    p_filters->>'fav_dog' AS "fav_dog_t",
    p_filters->>'h2h_last_ats_win' AS "h2h_last_ats_win_t",
    p_filters->>'h2h_last_fav' AS "h2h_last_fav_t",
    p_filters->>'h2h_last_home' AS "h2h_last_home_t",
    p_filters->>'h2h_last_margin_max' AS "h2h_last_margin_max_t",
    p_filters->>'h2h_last_margin_min' AS "h2h_last_margin_min_t",
    p_filters->>'h2h_last_over' AS "h2h_last_over_t",
    p_filters->>'h2h_last_win' AS "h2h_last_win_t",
    p_filters->>'h2h_same_season' AS "h2h_same_season_t",
    p_filters->>'interleague' AS "interleague_t",
    p_filters->>'last_covered' AS "last_covered_t",
    p_filters->>'last_favorite' AS "last_favorite_t",
    p_filters->>'last_margin_max' AS "last_margin_max_t",
    p_filters->>'last_margin_min' AS "last_margin_min_t",
    p_filters->>'last_over' AS "last_over_t",
    p_filters->>'last_result' AS "last_result_t",
    p_filters->>'loss_streak_max' AS "loss_streak_max_t",
    p_filters->>'loss_streak_min' AS "loss_streak_min_t",
    p_filters->>'min_games' AS "min_games_t",
    p_filters->>'ml_max' AS "ml_max_t",
    p_filters->>'ml_min' AS "ml_min_t",
    p_filters->>'month_max' AS "month_max_t",
    p_filters->>'month_min' AS "month_min_t",
    p_filters->>'opp_last_covered' AS "opp_last_covered_t",
    p_filters->>'opp_last_favorite' AS "opp_last_favorite_t",
    p_filters->>'opp_last_margin_max' AS "opp_last_margin_max_t",
    p_filters->>'opp_last_margin_min' AS "opp_last_margin_min_t",
    p_filters->>'opp_last_over' AS "opp_last_over_t",
    p_filters->>'opp_last_result' AS "opp_last_result_t",
    p_filters->>'opp_loss_streak_max' AS "opp_loss_streak_max_t",
    p_filters->>'opp_loss_streak_min' AS "opp_loss_streak_min_t",
    p_filters->>'opp_over_pct_max' AS "opp_over_pct_max_t",
    p_filters->>'opp_over_pct_min' AS "opp_over_pct_min_t",
    p_filters->>'opp_prev_win_pct_max' AS "opp_prev_win_pct_max_t",
    p_filters->>'opp_prev_win_pct_min' AS "opp_prev_win_pct_min_t",
    p_filters->>'opp_rapg_max' AS "opp_rapg_max_t",
    p_filters->>'opp_rapg_min' AS "opp_rapg_min_t",
    p_filters->>'opp_rl_cover_pct_max' AS "opp_rl_cover_pct_max_t",
    p_filters->>'opp_rl_cover_pct_min' AS "opp_rl_cover_pct_min_t",
    p_filters->>'opp_rpg_max' AS "opp_rpg_max_t",
    p_filters->>'opp_rpg_min' AS "opp_rpg_min_t",
    p_filters->>'opp_sp_hand' AS "opp_sp_hand_t",
    p_filters->>'opp_sp_xfip_max' AS "opp_sp_xfip_max_t",
    p_filters->>'opp_sp_xfip_min' AS "opp_sp_xfip_min_t",
    p_filters->>'opp_win_pct_max' AS "opp_win_pct_max_t",
    p_filters->>'opp_win_pct_min' AS "opp_win_pct_min_t",
    p_filters->>'opp_win_streak_max' AS "opp_win_streak_max_t",
    p_filters->>'opp_win_streak_min' AS "opp_win_streak_min_t",
    p_filters->>'over_pct_max' AS "over_pct_max_t",
    p_filters->>'over_pct_min' AS "over_pct_min_t",
    p_filters->>'over_streak_max' AS "over_streak_max_t",
    p_filters->>'over_streak_min' AS "over_streak_min_t",
    p_filters->>'pf_runs_max' AS "pf_runs_max_t",
    p_filters->>'pf_runs_min' AS "pf_runs_min_t",
    p_filters->>'prev_win_pct_max' AS "prev_win_pct_max_t",
    p_filters->>'prev_win_pct_min' AS "prev_win_pct_min_t",
    p_filters->>'prev_wins_max' AS "prev_wins_max_t",
    p_filters->>'prev_wins_min' AS "prev_wins_min_t",
    p_filters->>'rapg_max' AS "rapg_max_t",
    p_filters->>'rapg_min' AS "rapg_min_t",
    p_filters->>'rest_max' AS "rest_max_t",
    p_filters->>'rest_min' AS "rest_min_t",
    p_filters->>'rl_cover_pct_max' AS "rl_cover_pct_max_t",
    p_filters->>'rl_cover_pct_min' AS "rl_cover_pct_min_t",
    p_filters->>'rl_streak_max' AS "rl_streak_max_t",
    p_filters->>'rl_streak_min' AS "rl_streak_min_t",
    p_filters->>'rpg_max' AS "rpg_max_t",
    p_filters->>'rpg_min' AS "rpg_min_t",
    p_filters->>'run_diff_pg_max' AS "run_diff_pg_max_t",
    p_filters->>'run_diff_pg_min' AS "run_diff_pg_min_t",
    p_filters->>'season_max' AS "season_max_t",
    p_filters->>'season_min' AS "season_min_t",
    p_filters->>'series_game_max' AS "series_game_max_t",
    p_filters->>'series_game_min' AS "series_game_min_t",
    p_filters->>'side' AS "side_t",
    p_filters->>'sp_hand' AS "sp_hand_t",
    p_filters->>'sp_xfip_max' AS "sp_xfip_max_t",
    p_filters->>'sp_xfip_min' AS "sp_xfip_min_t",
    p_filters->>'streak_max' AS "streak_max_t",
    p_filters->>'streak_min' AS "streak_min_t",
    p_filters->>'switch_game' AS "switch_game_t",
    p_filters->>'temp_max' AS "temp_max_t",
    p_filters->>'temp_min' AS "temp_min_t",
    p_filters->>'time_max' AS "time_max_t",
    p_filters->>'time_min' AS "time_min_t",
    p_filters->>'total_max' AS "total_max_t",
    p_filters->>'total_min' AS "total_min_t",
    p_filters->>'trip_max' AS "trip_max_t",
    p_filters->>'trip_min' AS "trip_min_t",
    p_filters->>'under_streak_max' AS "under_streak_max_t",
    p_filters->>'under_streak_min' AS "under_streak_min_t",
    p_filters->>'win_pct_max' AS "win_pct_max_t",
    p_filters->>'win_pct_min' AS "win_pct_min_t",
    p_filters->>'win_streak_max' AS "win_streak_max_t",
    p_filters->>'win_streak_min' AS "win_streak_min_t",
    p_filters->>'wind_dir' AS "wind_dir_t",
    p_filters->>'wind_max' AS "wind_max_t",
    p_filters->>'wind_min' AS "wind_min_t",
    p_filters->'day_of_week' AS "day_of_week_j",
    p_filters->'opp_sp' AS "opp_sp_j",
    p_filters->'opponent' AS "opponent_j",
    p_filters->'sp' AS "sp_j",
    p_filters->'team' AS "team_j" OFFSET 0) f
  LEFT JOIN LATERAL (
    SELECT
      
    CASE p_bet_type
      WHEN 'ml' THEN o.ml_won         WHEN 'rl' THEN o.rl_covered
      WHEN 'total' THEN o.ou_over     WHEN 'f5_ml' THEN o.f5_ml_won
      WHEN 'f5_rl' THEN o.f5_rl_covered WHEN 'f5_total' THEN o.f5_over
    END AS o_hit,
      
    CASE p_bet_type
      WHEN 'ml' THEN o.ml_profit
      WHEN 'rl' THEN CASE WHEN o.rl_covered=1 THEN COALESCE(o.rl_px-1, 0.909) ELSE -1 END
      WHEN 'total' THEN CASE WHEN o.ou_over=1 THEN COALESCE(o.total_over_px-1, 0.909) ELSE -1 END
      WHEN 'f5_ml' THEN CASE WHEN o.f5_ml_px IS NOT NULL THEN CASE WHEN o.f5_ml_won=1 THEN o.f5_ml_px-1 ELSE -1 END END
      WHEN 'f5_rl' THEN CASE WHEN o.f5_rl_covered=1 THEN COALESCE(o.f5_rl_px-1, 0.909) ELSE -1 END
      WHEN 'f5_total' THEN CASE WHEN o.f5_over=1 THEN COALESCE(o.f5_total_over_px-1, 0.909) ELSE -1 END
    END AS o_profit
    FROM mlb_analysis_base o
    -- upper(): case-blind so a mixed-case duplicate row can never self-match.
    -- ORDER BY: deterministic mirror if a >2-row game ever appears.
    WHERE p_include_opp AND p_bet_type IN ('ml','rl','f5_ml','f5_rl')
      AND o.game_pk = b.game_pk AND upper(o.team_abbr) <> upper(b.team_abbr)
    ORDER BY o.team_abbr
    LIMIT 1
  ) opp ON true
  WHERE 
    (f."min_games_t" IS NULL OR b.team_gp_s2d >= (f."min_games_t")::int)
    AND (f."win_pct_min_t" IS NULL OR b.team_win_pct >= (f."win_pct_min_t")::numeric)
    AND (f."win_pct_max_t" IS NULL OR b.team_win_pct <= (f."win_pct_max_t")::numeric)
    AND (f."win_streak_min_t" IS NULL OR b.team_win_streak >= (f."win_streak_min_t")::numeric)
    AND (f."win_streak_max_t" IS NULL OR b.team_win_streak <= (f."win_streak_max_t")::numeric)
    AND (f."loss_streak_min_t" IS NULL OR b.team_loss_streak >= (f."loss_streak_min_t")::numeric)
    AND (f."loss_streak_max_t" IS NULL OR b.team_loss_streak <= (f."loss_streak_max_t")::numeric)
    AND (f."rl_cover_pct_min_t" IS NULL OR b.team_rl_cover_pct >= (f."rl_cover_pct_min_t")::numeric)
    AND (f."rl_cover_pct_max_t" IS NULL OR b.team_rl_cover_pct <= (f."rl_cover_pct_max_t")::numeric)
    AND (f."rl_streak_min_t" IS NULL OR b.team_rl_streak >= (f."rl_streak_min_t")::numeric)
    AND (f."rl_streak_max_t" IS NULL OR b.team_rl_streak <= (f."rl_streak_max_t")::numeric)
    AND (f."over_pct_min_t" IS NULL OR b.team_over_pct >= (f."over_pct_min_t")::numeric)
    AND (f."over_pct_max_t" IS NULL OR b.team_over_pct <= (f."over_pct_max_t")::numeric)
    AND (f."over_streak_min_t" IS NULL OR b.team_over_streak >= (f."over_streak_min_t")::numeric)
    AND (f."over_streak_max_t" IS NULL OR b.team_over_streak <= (f."over_streak_max_t")::numeric)
    AND (f."under_streak_min_t" IS NULL OR b.team_under_streak >= (f."under_streak_min_t")::numeric)
    AND (f."under_streak_max_t" IS NULL OR b.team_under_streak <= (f."under_streak_max_t")::numeric)
    AND (f."rpg_min_t" IS NULL OR b.team_rpg >= (f."rpg_min_t")::numeric)
    AND (f."rpg_max_t" IS NULL OR b.team_rpg <= (f."rpg_max_t")::numeric)
    AND (f."rapg_min_t" IS NULL OR b.team_rapg >= (f."rapg_min_t")::numeric)
    AND (f."rapg_max_t" IS NULL OR b.team_rapg <= (f."rapg_max_t")::numeric)
    AND (f."run_diff_pg_min_t" IS NULL OR b.team_run_diff_pg >= (f."run_diff_pg_min_t")::numeric)
    AND (f."run_diff_pg_max_t" IS NULL OR b.team_run_diff_pg <= (f."run_diff_pg_max_t")::numeric)
    AND (f."prev_wins_min_t" IS NULL OR b.team_prev_wins >= (f."prev_wins_min_t")::numeric)
    AND (f."prev_wins_max_t" IS NULL OR b.team_prev_wins <= (f."prev_wins_max_t")::numeric)
    AND (f."prev_win_pct_min_t" IS NULL OR b.team_prev_win_pct >= (f."prev_win_pct_min_t")::numeric)
    AND (f."prev_win_pct_max_t" IS NULL OR b.team_prev_win_pct <= (f."prev_win_pct_max_t")::numeric)
    AND (f."h2h_last_margin_min_t" IS NULL OR b.h2h_last_margin >= (f."h2h_last_margin_min_t")::numeric)
    AND (f."h2h_last_margin_max_t" IS NULL OR b.h2h_last_margin <= (f."h2h_last_margin_max_t")::numeric)
    AND (f."opp_win_pct_min_t" IS NULL OR b.opp_win_pct >= (f."opp_win_pct_min_t")::numeric)
    AND (f."opp_win_pct_max_t" IS NULL OR b.opp_win_pct <= (f."opp_win_pct_max_t")::numeric)
    AND (f."opp_over_pct_min_t" IS NULL OR b.opp_over_pct >= (f."opp_over_pct_min_t")::numeric)
    AND (f."opp_over_pct_max_t" IS NULL OR b.opp_over_pct <= (f."opp_over_pct_max_t")::numeric)
    AND (f."opp_rl_cover_pct_min_t" IS NULL OR b.opp_rl_cover_pct >= (f."opp_rl_cover_pct_min_t")::numeric)
    AND (f."opp_rl_cover_pct_max_t" IS NULL OR b.opp_rl_cover_pct <= (f."opp_rl_cover_pct_max_t")::numeric)
    AND (f."opp_win_streak_min_t" IS NULL OR b.opp_win_streak >= (f."opp_win_streak_min_t")::numeric)
    AND (f."opp_win_streak_max_t" IS NULL OR b.opp_win_streak <= (f."opp_win_streak_max_t")::numeric)
    AND (f."opp_loss_streak_min_t" IS NULL OR b.opp_loss_streak >= (f."opp_loss_streak_min_t")::numeric)
    AND (f."opp_loss_streak_max_t" IS NULL OR b.opp_loss_streak <= (f."opp_loss_streak_max_t")::numeric)
    AND (f."opp_rpg_min_t" IS NULL OR b.opp_rpg >= (f."opp_rpg_min_t")::numeric)
    AND (f."opp_rpg_max_t" IS NULL OR b.opp_rpg <= (f."opp_rpg_max_t")::numeric)
    AND (f."opp_rapg_min_t" IS NULL OR b.opp_rapg >= (f."opp_rapg_min_t")::numeric)
    AND (f."opp_rapg_max_t" IS NULL OR b.opp_rapg <= (f."opp_rapg_max_t")::numeric)
    AND (f."opp_prev_win_pct_min_t" IS NULL OR b.opp_prev_win_pct >= (f."opp_prev_win_pct_min_t")::numeric)
    AND (f."opp_prev_win_pct_max_t" IS NULL OR b.opp_prev_win_pct <= (f."opp_prev_win_pct_max_t")::numeric)
    AND (f."opp_last_margin_min_t" IS NULL OR b.opp_prev_margin >= (f."opp_last_margin_min_t")::numeric)
    AND (f."opp_last_margin_max_t" IS NULL OR b.opp_prev_margin <= (f."opp_last_margin_max_t")::numeric)
    AND (f."h2h_last_win_t" IS NULL OR b.h2h_last_win = (f."h2h_last_win_t")::int)
    AND (f."h2h_last_over_t" IS NULL OR b.h2h_last_over = (f."h2h_last_over_t")::int)
    AND (f."h2h_same_season_t" IS NULL OR b.h2h_same_season = (f."h2h_same_season_t")::boolean)
    AND (f."opp_last_result_t" IS NULL OR b.opp_prev_result = (CASE WHEN (f."opp_last_result_t")='won' THEN 'W' ELSE 'L' END))
    AND (f."last_covered_t" IS NULL OR b.last_rl_covered = (f."last_covered_t")::int)
    AND (f."last_over_t" IS NULL OR b.last_ou_over = (f."last_over_t")::int)
    AND (f."last_favorite_t" IS NULL OR b.last_is_favorite = (f."last_favorite_t")::boolean)
    AND (f."opp_last_covered_t" IS NULL OR b.opp_last_rl_covered = (f."opp_last_covered_t")::int)
    AND (f."opp_last_over_t" IS NULL OR b.opp_last_ou_over = (f."opp_last_over_t")::int)
    AND (f."opp_last_favorite_t" IS NULL OR b.opp_last_is_favorite = (f."opp_last_favorite_t")::boolean)
    AND (f."h2h_last_ats_win_t" IS NULL OR b.h2h_last_rl_cover = (f."h2h_last_ats_win_t")::int)
    AND (f."h2h_last_home_t" IS NULL OR b.h2h_last_home = (f."h2h_last_home_t")::boolean)
    AND (f."h2h_last_fav_t" IS NULL OR b.h2h_last_fav = (f."h2h_last_fav_t")::boolean)
    AND (f."season_min_t" IS NULL OR b.season >= (f."season_min_t")::int)
    AND (f."season_max_t" IS NULL OR b.season <= (f."season_max_t")::int)
    AND (f."month_min_t" IS NULL OR b.month >= (f."month_min_t")::int)
    AND (f."month_max_t" IS NULL OR b.month <= (f."month_max_t")::int)
    AND (f."team_j" IS NULL OR b.team_abbr IN (SELECT jsonb_array_elements_text(f."team_j")))
    AND (f."opponent_j" IS NULL OR b.opponent_abbr IN (SELECT jsonb_array_elements_text(f."opponent_j")))
    AND (f."division_t" IS NULL OR b.is_divisional = (f."division_t")::boolean)
    AND (f."interleague_t" IS NULL OR b.is_interleague = (f."interleague_t")::boolean)
    AND (f."side_t" IS NULL OR b.is_home = ((f."side_t")='home'))
    AND (f."fav_dog_t" IS NULL OR b.is_favorite = ((f."fav_dog_t")='favorite'))
    AND (f."ml_min_t" IS NULL OR b.closing_ml >= (f."ml_min_t")::numeric)
    AND (f."ml_max_t" IS NULL OR b.closing_ml <= (f."ml_max_t")::numeric)
    AND (f."total_min_t" IS NULL OR b.closing_total >= (f."total_min_t")::numeric)
    AND (f."total_max_t" IS NULL OR b.closing_total <= (f."total_max_t")::numeric)
    AND (f."f5_total_min_t" IS NULL OR b.f5_total_line >= (f."f5_total_min_t")::numeric)
    AND (f."f5_total_max_t" IS NULL OR b.f5_total_line <= (f."f5_total_max_t")::numeric)
    AND (f."series_game_min_t" IS NULL OR b.series_game >= (f."series_game_min_t")::int)
    AND (f."series_game_max_t" IS NULL OR b.series_game <= (f."series_game_max_t")::int)
    AND (f."trip_min_t" IS NULL OR b.trip_series_index >= (f."trip_min_t")::int)
    AND (f."trip_max_t" IS NULL OR b.trip_series_index <= (f."trip_max_t")::int)
    AND (f."switch_game_t" IS NULL OR b.is_switch_game = (f."switch_game_t")::boolean)
    AND (f."time_min_t" IS NULL OR b.time_et >= (f."time_min_t")::time)
    AND (f."time_max_t" IS NULL OR b.time_et <= (f."time_max_t")::time)
    AND (f."day_of_week_j" IS NULL OR b.day_of_week IN (SELECT jsonb_array_elements_text(f."day_of_week_j")))
    AND (f."doubleheader_t" IS NULL OR b.is_doubleheader = (f."doubleheader_t")::boolean)
    AND (f."rest_min_t" IS NULL OR b.days_rest >= (f."rest_min_t")::int)
    AND (f."rest_max_t" IS NULL OR b.days_rest <= (f."rest_max_t")::int)
    AND (f."streak_min_t" IS NULL OR b.win_loss_streak >= (f."streak_min_t")::int)
    AND (f."streak_max_t" IS NULL OR b.win_loss_streak <= (f."streak_max_t")::int)
    AND (f."last_result_t" IS NULL OR b.prev_result = (CASE WHEN (f."last_result_t")='won' THEN 'W' ELSE 'L' END))
    AND (f."last_margin_min_t" IS NULL OR b.prev_margin >= (f."last_margin_min_t")::int)
    AND (f."last_margin_max_t" IS NULL OR b.prev_margin <= (f."last_margin_max_t")::int)
    AND (f."sp_hand_t" IS NULL OR b.sp_hand = (f."sp_hand_t"))
    AND (f."opp_sp_hand_t" IS NULL OR b.opp_sp_hand = (f."opp_sp_hand_t"))
    AND (f."sp_xfip_min_t" IS NULL OR b.sp_season_xfip >= (f."sp_xfip_min_t")::numeric)
    AND (f."sp_xfip_max_t" IS NULL OR b.sp_season_xfip <= (f."sp_xfip_max_t")::numeric)
    AND (f."opp_sp_xfip_min_t" IS NULL OR b.opp_sp_season_xfip >= (f."opp_sp_xfip_min_t")::numeric)
    AND (f."opp_sp_xfip_max_t" IS NULL OR b.opp_sp_season_xfip <= (f."opp_sp_xfip_max_t")::numeric)
    AND (f."bp_ip3d_min_t" IS NULL OR b.opp_bp_ip_last3d >= (f."bp_ip3d_min_t")::numeric)
    AND (f."bp_ip3d_max_t" IS NULL OR b.opp_bp_ip_last3d <= (f."bp_ip3d_max_t")::numeric)
    AND (f."bp_xfip_min_t" IS NULL OR b.opp_bp_season_xfip >= (f."bp_xfip_min_t")::numeric)
    AND (f."bp_xfip_max_t" IS NULL OR b.opp_bp_season_xfip <= (f."bp_xfip_max_t")::numeric)
    AND (f."temp_min_t" IS NULL OR b.temperature_f >= (f."temp_min_t")::numeric)
    AND (f."temp_max_t" IS NULL OR b.temperature_f <= (f."temp_max_t")::numeric)
    AND (f."wind_min_t" IS NULL OR b.wind_speed_mph >= (f."wind_min_t")::numeric)
    AND (f."wind_max_t" IS NULL OR b.wind_speed_mph <= (f."wind_max_t")::numeric)
    AND (f."wind_dir_t" IS NULL OR b.wind_dir = (f."wind_dir_t"))
    AND (f."dome_t" IS NULL OR b.is_dome = (f."dome_t")::boolean)
    AND (f."pf_runs_min_t" IS NULL OR b.pf_runs >= (f."pf_runs_min_t")::numeric)
    AND (f."pf_runs_max_t" IS NULL OR b.pf_runs <= (f."pf_runs_max_t")::numeric)
    AND (f."sp_j" IS NULL OR b.sp_id::text IN (SELECT jsonb_array_elements_text(f."sp_j")))
    AND (f."opp_sp_j" IS NULL OR b.opp_sp_id::text IN (SELECT jsonb_array_elements_text(f."opp_sp_j")));
$function$