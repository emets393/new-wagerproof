CREATE OR REPLACE FUNCTION public.cfb_analysis(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  is_ml boolean := p_bet_type IN ('fg_ml','h1_ml');
  is_game_level boolean := p_bet_type IN ('fg_total','h1_total');
  v jsonb; bars jsonb := '[]'::jsonb; cov jsonb; baseline numeric; overall jsonb;
BEGIN
  CREATE TEMP TABLE _f ON COMMIT DROP AS
  SELECT b.*,
    CASE p_bet_type
      WHEN 'fg_spread' THEN b.fg_covered WHEN 'fg_ml' THEN b.fg_won
      WHEN 'fg_total' THEN b.ou_result  WHEN 'team_total' THEN b.tt_over
      WHEN 'h1_spread' THEN b.h1_covered WHEN 'h1_ml' THEN b.h1_won
      WHEN 'h1_total' THEN b.h1_total_over END AS hit
  FROM cfb_analysis_base b
  WHERE
    (p_filters->>'min_games' IS NULL OR b.team_gp_s2d >= (p_filters->>'min_games')::int)
    AND (p_filters->>'win_pct_min' IS NULL OR b.team_win_pct >= (p_filters->>'win_pct_min')::numeric)
    AND (p_filters->>'win_pct_max' IS NULL OR b.team_win_pct <= (p_filters->>'win_pct_max')::numeric)
    AND (p_filters->>'ats_win_pct_min' IS NULL OR b.team_ats_win_pct >= (p_filters->>'ats_win_pct_min')::numeric)
    AND (p_filters->>'ats_win_pct_max' IS NULL OR b.team_ats_win_pct <= (p_filters->>'ats_win_pct_max')::numeric)
    AND (p_filters->>'over_pct_min' IS NULL OR b.team_over_pct >= (p_filters->>'over_pct_min')::numeric)
    AND (p_filters->>'over_pct_max' IS NULL OR b.team_over_pct <= (p_filters->>'over_pct_max')::numeric)
    AND (p_filters->>'win_streak_min' IS NULL OR b.team_win_streak >= (p_filters->>'win_streak_min')::numeric)
    AND (p_filters->>'win_streak_max' IS NULL OR b.team_win_streak <= (p_filters->>'win_streak_max')::numeric)
    AND (p_filters->>'loss_streak_min' IS NULL OR b.team_loss_streak >= (p_filters->>'loss_streak_min')::numeric)
    AND (p_filters->>'loss_streak_max' IS NULL OR b.team_loss_streak <= (p_filters->>'loss_streak_max')::numeric)
    AND (p_filters->>'ats_win_streak_min' IS NULL OR b.team_ats_win_streak >= (p_filters->>'ats_win_streak_min')::numeric)
    AND (p_filters->>'ats_win_streak_max' IS NULL OR b.team_ats_win_streak <= (p_filters->>'ats_win_streak_max')::numeric)
    AND (p_filters->>'over_streak_min' IS NULL OR b.team_over_streak >= (p_filters->>'over_streak_min')::numeric)
    AND (p_filters->>'over_streak_max' IS NULL OR b.team_over_streak <= (p_filters->>'over_streak_max')::numeric)
    AND (p_filters->>'under_streak_min' IS NULL OR b.team_under_streak >= (p_filters->>'under_streak_min')::numeric)
    AND (p_filters->>'under_streak_max' IS NULL OR b.team_under_streak <= (p_filters->>'under_streak_max')::numeric)
    AND (p_filters->>'avg_cover_margin_min' IS NULL OR b.team_avg_cover_margin >= (p_filters->>'avg_cover_margin_min')::numeric)
    AND (p_filters->>'avg_cover_margin_max' IS NULL OR b.team_avg_cover_margin <= (p_filters->>'avg_cover_margin_max')::numeric)
    AND (p_filters->>'ppg_min' IS NULL OR b.team_ppg >= (p_filters->>'ppg_min')::numeric)
    AND (p_filters->>'ppg_max' IS NULL OR b.team_ppg <= (p_filters->>'ppg_max')::numeric)
    AND (p_filters->>'pa_pg_min' IS NULL OR b.team_pa_pg >= (p_filters->>'pa_pg_min')::numeric)
    AND (p_filters->>'pa_pg_max' IS NULL OR b.team_pa_pg <= (p_filters->>'pa_pg_max')::numeric)
    AND (p_filters->>'point_diff_pg_min' IS NULL OR b.team_point_diff_pg >= (p_filters->>'point_diff_pg_min')::numeric)
    AND (p_filters->>'point_diff_pg_max' IS NULL OR b.team_point_diff_pg <= (p_filters->>'point_diff_pg_max')::numeric)
    AND (p_filters->>'prev_wins_min' IS NULL OR b.team_prev_wins >= (p_filters->>'prev_wins_min')::numeric)
    AND (p_filters->>'prev_wins_max' IS NULL OR b.team_prev_wins <= (p_filters->>'prev_wins_max')::numeric)
    AND (p_filters->>'prev_win_pct_min' IS NULL OR b.team_prev_win_pct >= (p_filters->>'prev_win_pct_min')::numeric)
    AND (p_filters->>'prev_win_pct_max' IS NULL OR b.team_prev_win_pct <= (p_filters->>'prev_win_pct_max')::numeric)
    AND (p_filters->>'opp_win_pct_min' IS NULL OR b.opp_win_pct >= (p_filters->>'opp_win_pct_min')::numeric)
    AND (p_filters->>'opp_win_pct_max' IS NULL OR b.opp_win_pct <= (p_filters->>'opp_win_pct_max')::numeric)
    AND (p_filters->>'opp_ats_win_pct_min' IS NULL OR b.opp_ats_win_pct >= (p_filters->>'opp_ats_win_pct_min')::numeric)
    AND (p_filters->>'opp_ats_win_pct_max' IS NULL OR b.opp_ats_win_pct <= (p_filters->>'opp_ats_win_pct_max')::numeric)
    AND (p_filters->>'opp_over_pct_min' IS NULL OR b.opp_over_pct >= (p_filters->>'opp_over_pct_min')::numeric)
    AND (p_filters->>'opp_over_pct_max' IS NULL OR b.opp_over_pct <= (p_filters->>'opp_over_pct_max')::numeric)
    AND (p_filters->>'opp_win_streak_min' IS NULL OR b.opp_win_streak >= (p_filters->>'opp_win_streak_min')::numeric)
    AND (p_filters->>'opp_win_streak_max' IS NULL OR b.opp_win_streak <= (p_filters->>'opp_win_streak_max')::numeric)
    AND (p_filters->>'opp_prev_win_pct_min' IS NULL OR b.opp_prev_win_pct >= (p_filters->>'opp_prev_win_pct_min')::numeric)
    AND (p_filters->>'opp_prev_win_pct_max' IS NULL OR b.opp_prev_win_pct <= (p_filters->>'opp_prev_win_pct_max')::numeric)
    AND (p_filters->>'made_playoffs_prev' IS NULL OR b.team_made_playoffs_prev = (p_filters->>'made_playoffs_prev')::boolean)
    AND (p_filters->>'opp_made_playoffs_prev' IS NULL OR b.opp_made_playoffs_prev = (p_filters->>'opp_made_playoffs_prev')::boolean)
    AND (p_filters->>'h2h_last_home' IS NULL OR b.h2h_last_home = (p_filters->>'h2h_last_home')::boolean)
    AND (p_filters->>'h2h_last_fav' IS NULL OR b.h2h_last_fav = (p_filters->>'h2h_last_fav')::boolean)
    AND (p_filters->>'h2h_same_season' IS NULL OR b.h2h_same_season = (p_filters->>'h2h_same_season')::boolean)
    AND (p_filters->>'h2h_last_win' IS NULL OR b.h2h_last_win = (p_filters->>'h2h_last_win')::int)
    AND (p_filters->>'h2h_last_ats_win' IS NULL OR b.h2h_last_ats_win = (p_filters->>'h2h_last_ats_win')::int)
    AND (p_filters->>'h2h_last_over' IS NULL OR b.h2h_last_over = (p_filters->>'h2h_last_over')::int)
    AND (p_filters->>'above_500' IS NULL OR (b.team_win_pct > 0.5) = (p_filters->>'above_500')::boolean)
    AND (p_filters->>'win_pct_gt_opp' IS NULL OR (b.team_win_pct > b.opp_win_pct) = (p_filters->>'win_pct_gt_opp')::boolean)
    AND (p_filters->>'more_wins_than_opp_prev' IS NULL OR (b.team_prev_wins > b.opp_prev_wins) = (p_filters->>'more_wins_than_opp_prev')::boolean)
    AND (p_filters->>'h2h_spread_lower' IS NULL OR (b.h2h_last_spread < b.fg_spread) = (p_filters->>'h2h_spread_lower')::boolean)
    AND (p_filters->>'h2h_spread_higher' IS NULL OR (b.h2h_last_spread > b.fg_spread) = (p_filters->>'h2h_spread_higher')::boolean)
    AND (p_filters->>'season_min' IS NULL OR b.season >= (p_filters->>'season_min')::int)
    AND (p_filters->>'season_max' IS NULL OR b.season <= (p_filters->>'season_max')::int)
    AND (p_filters->>'week_min' IS NULL OR b.week >= (p_filters->>'week_min')::int)
    AND (p_filters->>'week_max' IS NULL OR b.week <= (p_filters->>'week_max')::int)
    AND (p_filters->>'ml_min' IS NULL OR b.team_ml >= (p_filters->>'ml_min')::numeric)
    AND (p_filters->>'ml_max' IS NULL OR b.team_ml <= (p_filters->>'ml_max')::numeric)
    AND (p_filters->>'ranked_matchup' IS NULL
         OR ((p_filters->>'ranked_matchup')='both' AND b.team_rank IS NOT NULL AND b.opp_rank IS NOT NULL)
         OR ((p_filters->>'ranked_matchup')='neither' AND b.team_rank IS NULL AND b.opp_rank IS NULL)
         OR ((p_filters->>'ranked_matchup')='either' AND (b.team_rank IS NOT NULL OR b.opp_rank IS NOT NULL))
         OR ((p_filters->>'ranked_matchup')='home_ranked' AND (CASE WHEN b.is_home THEN (b.team_rank IS NOT NULL AND b.opp_rank IS NULL) ELSE (b.opp_rank IS NOT NULL AND b.team_rank IS NULL) END))
         OR ((p_filters->>'ranked_matchup')='away_ranked' AND (CASE WHEN b.is_home THEN (b.opp_rank IS NOT NULL AND b.team_rank IS NULL) ELSE (b.team_rank IS NOT NULL AND b.opp_rank IS NULL) END)))
    AND (p_filters->>'side' IS NULL OR b.is_home = ((p_filters->>'side')='home'))
    AND (p_filters->>'fav_dog' IS NULL OR b.is_favorite = ((p_filters->>'fav_dog')='favorite'))
    AND (p_filters->>'spread_min' IS NULL OR b.fg_spread >= (p_filters->>'spread_min')::numeric)
    AND (p_filters->>'spread_max' IS NULL OR b.fg_spread <= (p_filters->>'spread_max')::numeric)
    AND (p_filters->>'abs_spread_min' IS NULL OR abs(b.fg_spread) >= (p_filters->>'abs_spread_min')::numeric)
    AND (p_filters->>'abs_spread_max' IS NULL OR abs(b.fg_spread) <= (p_filters->>'abs_spread_max')::numeric)
    AND (p_filters->>'total_min' IS NULL OR b.fg_total >= (p_filters->>'total_min')::numeric)
    AND (p_filters->>'total_max' IS NULL OR b.fg_total <= (p_filters->>'total_max')::numeric)
    AND (p_filters->>'tt_min' IS NULL OR b.tt_line >= (p_filters->>'tt_min')::numeric)
    AND (p_filters->>'tt_max' IS NULL OR b.tt_line <= (p_filters->>'tt_max')::numeric)
    AND (p_filters->>'h1_spread_min' IS NULL OR b.h1_spread >= (p_filters->>'h1_spread_min')::numeric)
    AND (p_filters->>'h1_spread_max' IS NULL OR b.h1_spread <= (p_filters->>'h1_spread_max')::numeric)
    AND (p_filters->>'h1_abs_spread_min' IS NULL OR abs(b.h1_spread) >= (p_filters->>'h1_abs_spread_min')::numeric)
    AND (p_filters->>'h1_abs_spread_max' IS NULL OR abs(b.h1_spread) <= (p_filters->>'h1_abs_spread_max')::numeric)
    AND (p_filters->>'h1_total_min' IS NULL OR b.h1_total >= (p_filters->>'h1_total_min')::numeric)
    AND (p_filters->>'h1_total_max' IS NULL OR b.h1_total <= (p_filters->>'h1_total_max')::numeric)
    AND (p_filters->>'conference_game' IS NULL OR b.is_conference_game = (p_filters->>'conference_game')::boolean)
    AND (p_filters->>'neutral_site' IS NULL OR b.neutral_site = (p_filters->>'neutral_site')::boolean)
    AND (p_filters->>'primetime' IS NULL OR b.is_primetime = (p_filters->>'primetime')::boolean)
    AND (p_filters->>'conference' IS NULL OR b.team_conference = (p_filters->>'conference'))
    AND (p_filters->>'game_type' IS NULL
         OR ((p_filters->>'game_type')='postseason' AND b.game_type IN ('bowl','playoff'))
         OR b.game_type = (p_filters->>'game_type'))
    AND (p_filters->>'temp_min' IS NULL OR b.temperature >= (p_filters->>'temp_min')::numeric)
    AND (p_filters->>'temp_max' IS NULL OR b.temperature <= (p_filters->>'temp_max')::numeric)
    AND (p_filters->>'wind_max' IS NULL OR b.wind_speed <= (p_filters->>'wind_max')::numeric)
    AND (p_filters->>'weather' IS NULL OR b.weather_condition = (p_filters->>'weather'))
    AND (p_filters->>'dome' IS NULL OR b.dome = (p_filters->>'dome')::boolean)
    AND (p_filters->'team' IS NULL OR b.team IN (SELECT jsonb_array_elements_text(p_filters->'team')))
    AND (p_filters->'opponent' IS NULL OR b.opponent IN (SELECT jsonb_array_elements_text(p_filters->'opponent')))
    AND (p_filters->>'last_won' IS NULL OR b.last_fg_won = (p_filters->>'last_won')::int)
    AND (p_filters->>'last_covered' IS NULL OR b.last_fg_covered = (p_filters->>'last_covered')::int)
    AND (p_filters->>'last_over' IS NULL OR b.last_ou_result = (p_filters->>'last_over')::int)
    AND (p_filters->>'last_favorite' IS NULL OR b.last_is_favorite = (p_filters->>'last_favorite')::boolean)
    AND (p_filters->>'last_overtime' IS NULL OR b.last_overtime = (p_filters->>'last_overtime')::boolean)
    AND (p_filters->>'last_blowout' IS NULL
         OR ((p_filters->>'last_blowout')='win' AND b.last_margin >= 21)
         OR ((p_filters->>'last_blowout')='loss' AND b.last_margin <= -21));
  DELETE FROM _f WHERE hit IS NULL;

  SELECT jsonb_build_object('season_min',min(season),'season_max',max(season),
    'n_bets', count(*), 'n_games', count(DISTINCT unique_id)) INTO cov FROM _f;
  SELECT jsonb_build_object('n', count(*), 'wins', count(*) FILTER (WHERE hit=1),
    'hit_pct', round(avg(hit)::numeric*100,1),
    'roi', CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END)
    INTO overall FROM _f WHERE (NOT is_game_level OR is_home);
  IF is_game_level THEN
    SELECT round(avg(CASE p_bet_type WHEN 'fg_total' THEN ou_result ELSE h1_total_over END)::numeric*100,1)
      INTO baseline FROM cfb_analysis_base WHERE is_home;
  ELSE
    SELECT round(avg(CASE p_bet_type WHEN 'fg_spread' THEN fg_covered WHEN 'fg_ml' THEN fg_won
      WHEN 'team_total' THEN tt_over WHEN 'h1_spread' THEN h1_covered ELSE h1_won END)::numeric*100,1)
      INTO baseline FROM cfb_analysis_base;
  END IF;

  IF is_game_level OR p_bet_type='team_total' THEN
    SELECT jsonb_build_array(jsonb_build_object('dimension','over_under','options', jsonb_build_array(
      (SELECT jsonb_build_object('side','over','n',count(*),'wins',count(*) FILTER (WHERE hit=1),
         'hit_pct',round(avg(hit)::numeric*100,1),'roi',round((avg(hit)::numeric*1.909-1)*100,1)) FROM _f WHERE (NOT is_game_level OR is_home)),
      (SELECT jsonb_build_object('side','under','n',count(*),'wins',count(*) FILTER (WHERE hit=0),
         'hit_pct',round((1-avg(hit))::numeric*100,1),'roi',round(((1-avg(hit))::numeric*1.909-1)*100,1)) FROM _f WHERE (NOT is_game_level OR is_home)) )))
    INTO bars;
  ELSE
    SELECT jsonb_build_array(
      jsonb_build_object('dimension','home_away','options', jsonb_build_array(
        (SELECT jsonb_build_object('side','home','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END) FROM _f WHERE is_home),
        (SELECT jsonb_build_object('side','away','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END) FROM _f WHERE NOT is_home) )),
      jsonb_build_object('dimension','fav_dog','options', jsonb_build_array(
        (SELECT jsonb_build_object('side','favorite','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END) FROM _f WHERE is_favorite),
        (SELECT jsonb_build_object('side','underdog','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END) FROM _f WHERE NOT is_favorite) )))
    INTO bars;
  END IF;

  v := jsonb_build_object('bet_type', p_bet_type, 'coverage', cov, 'baseline_pct', baseline,
    'overall', overall, 'bars', bars,
    'by_team', COALESCE((SELECT jsonb_agg(jsonb_build_object('team',team,'n',n,'hit_pct',hp,'roi',r) ORDER BY n DESC)
       FROM (SELECT team, count(*) n, round(avg(hit)::numeric*100,1) hp,
               CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END r
             FROM _f GROUP BY team HAVING count(*)>=1) t), '[]'::jsonb),
    'by_conference', COALESCE((SELECT jsonb_agg(jsonb_build_object('conference',team_conference,'n',n,'hit_pct',hp,'roi',r) ORDER BY n DESC)
       FROM (SELECT team_conference, count(*) n, round(avg(hit)::numeric*100,1) hp,
               CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END r
             FROM _f WHERE (p_bet_type='team_total' OR is_home) AND team_conference IS NOT NULL
             GROUP BY team_conference HAVING count(*)>=1) t), '[]'::jsonb));
  DROP TABLE _f;
  RETURN v;
END;
$function$
