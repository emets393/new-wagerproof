CREATE OR REPLACE FUNCTION public.mlb_system_rows(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb)
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
    -- upper(): MLB base still carries mixed-case 'Ath' duplicate rows; a case-blind
    -- inequality stops the mirror join from matching the same team's duplicate.
    WHERE o.game_pk = b.game_pk AND upper(o.team_abbr) <> upper(b.team_abbr)
    LIMIT 1
  ) opp ON p_bet_type IN ('ml','rl','f5_ml','f5_rl')
  WHERE 
    (p_filters->>'min_games' IS NULL OR b.team_gp_s2d >= (p_filters->>'min_games')::int)
    AND (p_filters->>'win_pct_min' IS NULL OR b.team_win_pct >= (p_filters->>'win_pct_min')::numeric)
    AND (p_filters->>'win_pct_max' IS NULL OR b.team_win_pct <= (p_filters->>'win_pct_max')::numeric)
    AND (p_filters->>'win_streak_min' IS NULL OR b.team_win_streak >= (p_filters->>'win_streak_min')::numeric)
    AND (p_filters->>'win_streak_max' IS NULL OR b.team_win_streak <= (p_filters->>'win_streak_max')::numeric)
    AND (p_filters->>'loss_streak_min' IS NULL OR b.team_loss_streak >= (p_filters->>'loss_streak_min')::numeric)
    AND (p_filters->>'loss_streak_max' IS NULL OR b.team_loss_streak <= (p_filters->>'loss_streak_max')::numeric)
    AND (p_filters->>'rl_cover_pct_min' IS NULL OR b.team_rl_cover_pct >= (p_filters->>'rl_cover_pct_min')::numeric)
    AND (p_filters->>'rl_cover_pct_max' IS NULL OR b.team_rl_cover_pct <= (p_filters->>'rl_cover_pct_max')::numeric)
    AND (p_filters->>'rl_streak_min' IS NULL OR b.team_rl_streak >= (p_filters->>'rl_streak_min')::numeric)
    AND (p_filters->>'rl_streak_max' IS NULL OR b.team_rl_streak <= (p_filters->>'rl_streak_max')::numeric)
    AND (p_filters->>'over_pct_min' IS NULL OR b.team_over_pct >= (p_filters->>'over_pct_min')::numeric)
    AND (p_filters->>'over_pct_max' IS NULL OR b.team_over_pct <= (p_filters->>'over_pct_max')::numeric)
    AND (p_filters->>'over_streak_min' IS NULL OR b.team_over_streak >= (p_filters->>'over_streak_min')::numeric)
    AND (p_filters->>'over_streak_max' IS NULL OR b.team_over_streak <= (p_filters->>'over_streak_max')::numeric)
    AND (p_filters->>'under_streak_min' IS NULL OR b.team_under_streak >= (p_filters->>'under_streak_min')::numeric)
    AND (p_filters->>'under_streak_max' IS NULL OR b.team_under_streak <= (p_filters->>'under_streak_max')::numeric)
    AND (p_filters->>'rpg_min' IS NULL OR b.team_rpg >= (p_filters->>'rpg_min')::numeric)
    AND (p_filters->>'rpg_max' IS NULL OR b.team_rpg <= (p_filters->>'rpg_max')::numeric)
    AND (p_filters->>'rapg_min' IS NULL OR b.team_rapg >= (p_filters->>'rapg_min')::numeric)
    AND (p_filters->>'rapg_max' IS NULL OR b.team_rapg <= (p_filters->>'rapg_max')::numeric)
    AND (p_filters->>'run_diff_pg_min' IS NULL OR b.team_run_diff_pg >= (p_filters->>'run_diff_pg_min')::numeric)
    AND (p_filters->>'run_diff_pg_max' IS NULL OR b.team_run_diff_pg <= (p_filters->>'run_diff_pg_max')::numeric)
    AND (p_filters->>'prev_wins_min' IS NULL OR b.team_prev_wins >= (p_filters->>'prev_wins_min')::numeric)
    AND (p_filters->>'prev_wins_max' IS NULL OR b.team_prev_wins <= (p_filters->>'prev_wins_max')::numeric)
    AND (p_filters->>'prev_win_pct_min' IS NULL OR b.team_prev_win_pct >= (p_filters->>'prev_win_pct_min')::numeric)
    AND (p_filters->>'prev_win_pct_max' IS NULL OR b.team_prev_win_pct <= (p_filters->>'prev_win_pct_max')::numeric)
    AND (p_filters->>'h2h_last_margin_min' IS NULL OR b.h2h_last_margin >= (p_filters->>'h2h_last_margin_min')::numeric)
    AND (p_filters->>'h2h_last_margin_max' IS NULL OR b.h2h_last_margin <= (p_filters->>'h2h_last_margin_max')::numeric)
    AND (p_filters->>'opp_win_pct_min' IS NULL OR b.opp_win_pct >= (p_filters->>'opp_win_pct_min')::numeric)
    AND (p_filters->>'opp_win_pct_max' IS NULL OR b.opp_win_pct <= (p_filters->>'opp_win_pct_max')::numeric)
    AND (p_filters->>'opp_over_pct_min' IS NULL OR b.opp_over_pct >= (p_filters->>'opp_over_pct_min')::numeric)
    AND (p_filters->>'opp_over_pct_max' IS NULL OR b.opp_over_pct <= (p_filters->>'opp_over_pct_max')::numeric)
    AND (p_filters->>'opp_rl_cover_pct_min' IS NULL OR b.opp_rl_cover_pct >= (p_filters->>'opp_rl_cover_pct_min')::numeric)
    AND (p_filters->>'opp_rl_cover_pct_max' IS NULL OR b.opp_rl_cover_pct <= (p_filters->>'opp_rl_cover_pct_max')::numeric)
    AND (p_filters->>'opp_win_streak_min' IS NULL OR b.opp_win_streak >= (p_filters->>'opp_win_streak_min')::numeric)
    AND (p_filters->>'opp_win_streak_max' IS NULL OR b.opp_win_streak <= (p_filters->>'opp_win_streak_max')::numeric)
    AND (p_filters->>'opp_loss_streak_min' IS NULL OR b.opp_loss_streak >= (p_filters->>'opp_loss_streak_min')::numeric)
    AND (p_filters->>'opp_loss_streak_max' IS NULL OR b.opp_loss_streak <= (p_filters->>'opp_loss_streak_max')::numeric)
    AND (p_filters->>'opp_rpg_min' IS NULL OR b.opp_rpg >= (p_filters->>'opp_rpg_min')::numeric)
    AND (p_filters->>'opp_rpg_max' IS NULL OR b.opp_rpg <= (p_filters->>'opp_rpg_max')::numeric)
    AND (p_filters->>'opp_rapg_min' IS NULL OR b.opp_rapg >= (p_filters->>'opp_rapg_min')::numeric)
    AND (p_filters->>'opp_rapg_max' IS NULL OR b.opp_rapg <= (p_filters->>'opp_rapg_max')::numeric)
    AND (p_filters->>'opp_prev_win_pct_min' IS NULL OR b.opp_prev_win_pct >= (p_filters->>'opp_prev_win_pct_min')::numeric)
    AND (p_filters->>'opp_prev_win_pct_max' IS NULL OR b.opp_prev_win_pct <= (p_filters->>'opp_prev_win_pct_max')::numeric)
    AND (p_filters->>'opp_last_margin_min' IS NULL OR b.opp_prev_margin >= (p_filters->>'opp_last_margin_min')::numeric)
    AND (p_filters->>'opp_last_margin_max' IS NULL OR b.opp_prev_margin <= (p_filters->>'opp_last_margin_max')::numeric)
    AND (p_filters->>'h2h_last_win' IS NULL OR b.h2h_last_win = (p_filters->>'h2h_last_win')::int)
    AND (p_filters->>'h2h_last_over' IS NULL OR b.h2h_last_over = (p_filters->>'h2h_last_over')::int)
    AND (p_filters->>'h2h_same_season' IS NULL OR b.h2h_same_season = (p_filters->>'h2h_same_season')::boolean)
    AND (p_filters->>'opp_last_result' IS NULL OR b.opp_prev_result = (CASE WHEN (p_filters->>'opp_last_result')='won' THEN 'W' ELSE 'L' END))
    AND (p_filters->>'last_covered' IS NULL OR b.last_rl_covered = (p_filters->>'last_covered')::int)
    AND (p_filters->>'last_over' IS NULL OR b.last_ou_over = (p_filters->>'last_over')::int)
    AND (p_filters->>'last_favorite' IS NULL OR b.last_is_favorite = (p_filters->>'last_favorite')::boolean)
    AND (p_filters->>'opp_last_covered' IS NULL OR b.opp_last_rl_covered = (p_filters->>'opp_last_covered')::int)
    AND (p_filters->>'opp_last_over' IS NULL OR b.opp_last_ou_over = (p_filters->>'opp_last_over')::int)
    AND (p_filters->>'opp_last_favorite' IS NULL OR b.opp_last_is_favorite = (p_filters->>'opp_last_favorite')::boolean)
    AND (p_filters->>'h2h_last_ats_win' IS NULL OR b.h2h_last_rl_cover = (p_filters->>'h2h_last_ats_win')::int)
    AND (p_filters->>'h2h_last_home' IS NULL OR b.h2h_last_home = (p_filters->>'h2h_last_home')::boolean)
    AND (p_filters->>'h2h_last_fav' IS NULL OR b.h2h_last_fav = (p_filters->>'h2h_last_fav')::boolean)
    AND (p_filters->>'season_min' IS NULL OR b.season >= (p_filters->>'season_min')::int)
    AND (p_filters->>'season_max' IS NULL OR b.season <= (p_filters->>'season_max')::int)
    AND (p_filters->>'month_min' IS NULL OR b.month >= (p_filters->>'month_min')::int)
    AND (p_filters->>'month_max' IS NULL OR b.month <= (p_filters->>'month_max')::int)
    AND (p_filters->'team' IS NULL OR b.team_abbr IN (SELECT jsonb_array_elements_text(p_filters->'team')))
    AND (p_filters->'opponent' IS NULL OR b.opponent_abbr IN (SELECT jsonb_array_elements_text(p_filters->'opponent')))
    AND (p_filters->>'division' IS NULL OR b.is_divisional = (p_filters->>'division')::boolean)
    AND (p_filters->>'interleague' IS NULL OR b.is_interleague = (p_filters->>'interleague')::boolean)
    AND (p_filters->>'side' IS NULL OR b.is_home = ((p_filters->>'side')='home'))
    AND (p_filters->>'fav_dog' IS NULL OR b.is_favorite = ((p_filters->>'fav_dog')='favorite'))
    AND (p_filters->>'ml_min' IS NULL OR b.closing_ml >= (p_filters->>'ml_min')::numeric)
    AND (p_filters->>'ml_max' IS NULL OR b.closing_ml <= (p_filters->>'ml_max')::numeric)
    AND (p_filters->>'total_min' IS NULL OR b.closing_total >= (p_filters->>'total_min')::numeric)
    AND (p_filters->>'total_max' IS NULL OR b.closing_total <= (p_filters->>'total_max')::numeric)
    AND (p_filters->>'f5_total_min' IS NULL OR b.f5_total_line >= (p_filters->>'f5_total_min')::numeric)
    AND (p_filters->>'f5_total_max' IS NULL OR b.f5_total_line <= (p_filters->>'f5_total_max')::numeric)
    AND (p_filters->>'series_game_min' IS NULL OR b.series_game >= (p_filters->>'series_game_min')::int)
    AND (p_filters->>'series_game_max' IS NULL OR b.series_game <= (p_filters->>'series_game_max')::int)
    AND (p_filters->>'trip_min' IS NULL OR b.trip_series_index >= (p_filters->>'trip_min')::int)
    AND (p_filters->>'trip_max' IS NULL OR b.trip_series_index <= (p_filters->>'trip_max')::int)
    AND (p_filters->>'switch_game' IS NULL OR b.is_switch_game = (p_filters->>'switch_game')::boolean)
    AND (p_filters->>'time_min' IS NULL OR b.time_et >= (p_filters->>'time_min')::time)
    AND (p_filters->>'time_max' IS NULL OR b.time_et <= (p_filters->>'time_max')::time)
    AND (p_filters->'day_of_week' IS NULL OR b.day_of_week IN (SELECT jsonb_array_elements_text(p_filters->'day_of_week')))
    AND (p_filters->>'doubleheader' IS NULL OR b.is_doubleheader = (p_filters->>'doubleheader')::boolean)
    AND (p_filters->>'rest_min' IS NULL OR b.days_rest >= (p_filters->>'rest_min')::int)
    AND (p_filters->>'rest_max' IS NULL OR b.days_rest <= (p_filters->>'rest_max')::int)
    AND (p_filters->>'streak_min' IS NULL OR b.win_loss_streak >= (p_filters->>'streak_min')::int)
    AND (p_filters->>'streak_max' IS NULL OR b.win_loss_streak <= (p_filters->>'streak_max')::int)
    AND (p_filters->>'last_result' IS NULL OR b.prev_result = (CASE WHEN (p_filters->>'last_result')='won' THEN 'W' ELSE 'L' END))
    AND (p_filters->>'last_margin_min' IS NULL OR b.prev_margin >= (p_filters->>'last_margin_min')::int)
    AND (p_filters->>'last_margin_max' IS NULL OR b.prev_margin <= (p_filters->>'last_margin_max')::int)
    AND (p_filters->>'sp_hand' IS NULL OR b.sp_hand = (p_filters->>'sp_hand'))
    AND (p_filters->>'opp_sp_hand' IS NULL OR b.opp_sp_hand = (p_filters->>'opp_sp_hand'))
    AND (p_filters->>'sp_xfip_min' IS NULL OR b.sp_season_xfip >= (p_filters->>'sp_xfip_min')::numeric)
    AND (p_filters->>'sp_xfip_max' IS NULL OR b.sp_season_xfip <= (p_filters->>'sp_xfip_max')::numeric)
    AND (p_filters->>'opp_sp_xfip_min' IS NULL OR b.opp_sp_season_xfip >= (p_filters->>'opp_sp_xfip_min')::numeric)
    AND (p_filters->>'opp_sp_xfip_max' IS NULL OR b.opp_sp_season_xfip <= (p_filters->>'opp_sp_xfip_max')::numeric)
    AND (p_filters->>'bp_ip3d_min' IS NULL OR b.opp_bp_ip_last3d >= (p_filters->>'bp_ip3d_min')::numeric)
    AND (p_filters->>'bp_ip3d_max' IS NULL OR b.opp_bp_ip_last3d <= (p_filters->>'bp_ip3d_max')::numeric)
    AND (p_filters->>'bp_xfip_min' IS NULL OR b.opp_bp_season_xfip >= (p_filters->>'bp_xfip_min')::numeric)
    AND (p_filters->>'bp_xfip_max' IS NULL OR b.opp_bp_season_xfip <= (p_filters->>'bp_xfip_max')::numeric)
    AND (p_filters->>'temp_min' IS NULL OR b.temperature_f >= (p_filters->>'temp_min')::numeric)
    AND (p_filters->>'temp_max' IS NULL OR b.temperature_f <= (p_filters->>'temp_max')::numeric)
    AND (p_filters->>'wind_min' IS NULL OR b.wind_speed_mph >= (p_filters->>'wind_min')::numeric)
    AND (p_filters->>'wind_max' IS NULL OR b.wind_speed_mph <= (p_filters->>'wind_max')::numeric)
    AND (p_filters->>'wind_dir' IS NULL OR b.wind_dir = (p_filters->>'wind_dir'))
    AND (p_filters->>'dome' IS NULL OR b.is_dome = (p_filters->>'dome')::boolean)
    AND (p_filters->>'pf_runs_min' IS NULL OR b.pf_runs >= (p_filters->>'pf_runs_min')::numeric)
    AND (p_filters->>'pf_runs_max' IS NULL OR b.pf_runs <= (p_filters->>'pf_runs_max')::numeric)
    AND (p_filters->'sp' IS NULL OR b.sp_id::text IN (SELECT jsonb_array_elements_text(p_filters->'sp')))
    AND (p_filters->'opp_sp' IS NULL OR b.opp_sp_id::text IN (SELECT jsonb_array_elements_text(p_filters->'opp_sp')));
$function$