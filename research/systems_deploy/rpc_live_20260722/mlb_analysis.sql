CREATE OR REPLACE FUNCTION public.mlb_analysis(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  is_ml_real boolean := p_bet_type = 'ml';
  is_ml_nodds boolean := p_bet_type = 'f5_ml';
  is_game_level boolean := p_bet_type IN ('total','f5_total');
  v jsonb; bars jsonb; cov jsonb; baseline numeric; overall jsonb;
BEGIN
  CREATE TEMP TABLE _f ON COMMIT DROP AS
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
    true AS keep_game
  FROM mlb_analysis_base b
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

  DELETE FROM _f WHERE hit IS NULL;
  -- Game-level bet types: keep_game marks ONE row per game (home preferred,
  -- away row kept when it's the only survivor of the filters). overall / bars
  -- / coverage / by_venue read keep_game rows so each game counts once;
  -- by_team reads ALL rows so a team's line covers its full schedule.
  IF is_game_level THEN
    UPDATE _f a SET keep_game = false
    WHERE NOT a.is_home
      AND EXISTS (SELECT 1 FROM _f b WHERE b.game_pk = a.game_pk AND b.is_home);
  END IF;

  SELECT jsonb_build_object('season_min',min(season),'season_max',max(season),
    'n_bets', count(*), 'n_games', count(DISTINCT game_pk)) INTO cov FROM _f WHERE keep_game;

  SELECT jsonb_build_object('n', count(*), 'wins', count(*) FILTER (WHERE hit=1),
    'hit_pct', round(avg(hit)::numeric*100,1),
    'roi', round(avg(bet_profit)::numeric*100,1))
  INTO overall FROM _f WHERE keep_game;

  SELECT round(avg(CASE p_bet_type
      WHEN 'ml' THEN ml_won WHEN 'rl' THEN rl_covered WHEN 'total' THEN ou_over
      WHEN 'f5_ml' THEN f5_ml_won WHEN 'f5_rl' THEN f5_rl_covered ELSE f5_over
    END)::numeric*100,1)
  INTO baseline FROM mlb_analysis_base WHERE (NOT is_game_level OR is_home);

  IF is_game_level THEN
    SELECT jsonb_build_array(jsonb_build_object('dimension','over_under','options', jsonb_build_array(
      (SELECT jsonb_build_object('side','over','n',count(*),'wins',count(*) FILTER (WHERE hit=1),
         'hit_pct',round(avg(hit)::numeric*100,1),'roi',round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE keep_game),
      (SELECT jsonb_build_object('side','under','n',count(*),'wins',count(*) FILTER (WHERE hit=0),
         'hit_pct',round((1-avg(hit))::numeric*100,1),'roi',round(avg(under_profit)::numeric*100,1)) FROM _f WHERE keep_game))))
    INTO bars;
  ELSE
    SELECT jsonb_build_array(
      jsonb_build_object('dimension','home_away','options', jsonb_build_array(
        (SELECT jsonb_build_object('side','home','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE is_home),
        (SELECT jsonb_build_object('side','away','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE NOT is_home))),
      jsonb_build_object('dimension','fav_dog','options', jsonb_build_array(
        (SELECT jsonb_build_object('side','favorite','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE is_favorite),
        (SELECT jsonb_build_object('side','underdog','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE NOT is_favorite))))
    INTO bars;
  END IF;

  v := jsonb_build_object('bet_type', p_bet_type, 'coverage', cov, 'baseline_pct', baseline,
    'overall', overall, 'bars', bars,
    'by_team', COALESCE((SELECT jsonb_agg(jsonb_build_object('team',team_abbr,'n',n,'hit_pct',hp,'roi',r) ORDER BY n DESC)
       FROM (SELECT team_abbr, count(*) n, round(avg(hit)::numeric*100,1) hp,
               round(avg(bet_profit)::numeric*100,1) r
             FROM _f GROUP BY team_abbr HAVING count(*)>=1) t), '[]'::jsonb),
    'by_venue', COALESCE((SELECT jsonb_agg(jsonb_build_object('venue',venue_name,'n',n,'hit_pct',hp,'roi',r) ORDER BY n DESC)
       FROM (SELECT venue_name, count(*) n, round(avg(hit)::numeric*100,1) hp,
               round(avg(bet_profit)::numeric*100,1) r
             FROM _f WHERE keep_game AND venue_name IS NOT NULL GROUP BY venue_name HAVING count(*)>=1) t), '[]'::jsonb));
  DROP TABLE _f;
  RETURN v;
END;
$function$
